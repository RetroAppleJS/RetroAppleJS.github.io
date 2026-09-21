from pathlib import Path

path=Path('res/EMU_CARD_LIRON.js')
s=path.read_text()


def replace_once(old,new,label):
    global s
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    s=s.replace(old,new,1)

replace_once(
'''    const WAIT_SYNC="WAIT_SYNC";
    const RECEIVE_COMMAND="RECEIVE_COMMAND";
    const RESPONSE_PENDING="RESPONSE_PENDING";
    const SEND_RESPONSE="SEND_RESPONSE";
    const RESPONSE_DONE="RESPONSE_DONE";
''',
'''    const WAIT_SYNC="WAIT_SYNC";
    const RECEIVE_COMMAND="RECEIVE_COMMAND";
    const WRITE_COMMAND_ACK="WRITE_COMMAND_ACK";
    const WAIT_WRITE_DATA="WAIT_WRITE_DATA";
    const RECEIVE_WRITE_DATA="RECEIVE_WRITE_DATA";
    const WRITE_DATA_ACK="WRITE_DATA_ACK";
    const RESPONSE_PENDING="RESPONSE_PENDING";
    const SEND_RESPONSE="SEND_RESPONSE";
    const RESPONSE_DONE="RESPONSE_DONE";
''',
'write states')

replace_once(
'''    var tx=[];
    var txIndex=0;
    var lastError="";
''',
'''    var tx=[];
    var txIndex=0;
    var lastError="";
    // WRITE BLOCK spans an inbound command packet and a following $82 DATA packet.
    // The media write is committed only after the host releases DATA ACK.
    var pendingWrite=null;
''',
'pendingWrite declaration')

replace_once(
'''    function resetTransport(clearIDs)
    {
        protocolState=WAIT_SYNC;
        enabled=false;
        req=false;
        ack=false;
        syncWindow=[];
''',
'''    function resetTransport(clearIDs)
    {
        protocolState=WAIT_SYNC;
        enabled=false;
        req=false;
        ack=false;
        pendingWrite=null;
        syncWindow=[];
''',
'reset pending write')

replace_once(
'''    function buildResponse(source,status,payload)
''',
'''    function buildResponse(source,status,payload,assertAck)
''',
'buildResponse signature')

replace_once(
'''        txIndex=0;
        ack=true;
        protocolState=RESPONSE_PENDING;
    }

    function failPacket(message)
''',
'''        txIndex=0;
        ack=assertAck===false ? false : true;
        protocolState=RESPONSE_PENDING;
    }

    function failPacket(message)
''',
'buildResponse ack')

replace_once(
'''        lastError=String(message||"SmartPort packet error");
        protocolState=WAIT_SYNC;
''',
'''        lastError=String(message||"SmartPort packet error");
        pendingWrite=null;
        protocolState=WAIT_SYNC;
''',
'fail pending write')

marker='''    function dispatchPacket(rawHeader,payload)\n    {\n'''
insert='''    function dispatchWriteData(rawHeader,payload)
    {
        if(!pendingWrite)
        {
            failPacket("SmartPort WRITE DATA without pending WRITE BLOCK");
            return;
        }

        var dest=rawHeader[0]&0x7F;
        var source=rawHeader[1]&0x7F;
        if(dest!==pendingWrite.dest)
        {
            failPacket("SmartPort WRITE DATA destination mismatch");
            return;
        }
        if(source!==0)
        {
            failPacket("SmartPort WRITE DATA source must be host");
            return;
        }
        if(payload.length!==512)
        {
            failPacket("SmartPort WRITE DATA must contain exactly 512 bytes");
            return;
        }

        pendingWrite.data=Uint8Array.from(payload);
        debugLog("WRITE_DATA",{"dest":dest,"residentUnit":pendingWrite.unit,"blockNumber":pendingWrite.blockNumber,"dataLength":payload.length});
        ack=true;
        protocolState=WRITE_DATA_ACK;
    }

    function commitPendingWrite()
    {
        var write=pendingWrite;
        if(!write || !write.device || !write.data || write.data.length!==512)
        {
            pendingWrite=null;
            buildResponse(write ? write.dest : 0,0x27,[],false);
            return;
        }

        var reply;
        try
        {
            reply=write.device.writeBlock(write.blockNumber,write.data);
        }
        catch(err)
        {
            console.error("SmartPort WRITE BLOCK device exception",err);
            reply={"error":0x27};
        }

        var error=reply && reply.error!==undefined ? Number(reply.error)&0x7F : 0x27;
        debugLog("DEVICE_RESULT",{"command":"WRITE BLOCK","unit":write.unit,"blockNumber":write.blockNumber,"error":error,"errorHex":"$"+error.toString(16).toUpperCase().padStart(2,"0"),"dataLength":write.data.length});
        pendingWrite=null;
        // DATA ACK has already been released; prepare STATUS without reasserting ACK.
        buildResponse(write.dest,error,[],false);
    }

'''
if s.count(marker)!=1:
    raise SystemExit(f'dispatch marker: expected one match, found {s.count(marker)}')
s=s.replace(marker,insert+marker,1)

replace_once(
'''    function dispatchPacket(rawHeader,payload)
    {
        var dest=rawHeader[0]&0x7F;
        var packetType=rawHeader[2]&0x7F;
        if(packetType!==0x00)
        {
            failPacket("SmartPort expected command packet");
            return;
        }

        var command=payload.length ? payload[0]&0x7F : 0;
''',
'''    function dispatchPacket(rawHeader,payload)
    {
        var packetType=rawHeader[2]&0x7F;

        if(protocolState===RECEIVE_WRITE_DATA)
        {
            if(packetType!==0x02)
            {
                failPacket("SmartPort expected WRITE DATA packet");
                return;
            }
            dispatchWriteData(rawHeader,payload);
            return;
        }

        if(protocolState!==RECEIVE_COMMAND)
        {
            failPacket("SmartPort packet arrived outside receive state");
            return;
        }
        if(packetType!==0x00)
        {
            failPacket("SmartPort expected command packet");
            return;
        }

        var dest=rawHeader[0]&0x7F;
        var command=payload.length ? payload[0]&0x7F : 0;
''',
'dispatch packet role')

read_marker='''        if(command===0x01)\n        {\n'''
write_handler='''        if(command===0x02)
        {
            var writeUnit=findUnitByResidentID(dest);
            if(!writeUnit && dest>=1 && dest<=8 && units[dest]!==null) writeUnit=dest;
            if(!writeUnit)
            {
                buildResponse(dest,0x28,[]);
                return;
            }

            var writeDevice=units[writeUnit];
            if(!writeDevice || typeof(writeDevice.writeBlock)!=="function")
            {
                buildResponse(dest,0x01,[]);
                return;
            }

            var writeBufferAddress=
                 (payload.length>2 ? payload[2]&0xFF : 0)
                |((payload.length>3 ? payload[3]&0xFF : 0)<<8);
            var writeBlockNumber=
                 (payload.length>4 ? payload[4]&0xFF : 0)
                |((payload.length>5 ? payload[5]&0xFF : 0)<<8)
                |((payload.length>6 ? payload[6]&0xFF : 0)<<16);

            pendingWrite={
                 "dest":dest
                ,"unit":writeUnit
                ,"device":writeDevice
                ,"bufferAddress":writeBufferAddress
                ,"blockNumber":writeBlockNumber
                ,"data":null
            };
            debugLog("WRITE_BLOCK",{"phase":"COMMAND","dest":dest,"residentUnit":writeUnit,"parameterCount":payload.length>1 ? payload[1]&0xFF : null,"bufferAddress":writeBufferAddress,"blockNumber":writeBlockNumber});
            ack=true;
            protocolState=WRITE_COMMAND_ACK;
            return;
        }

        if(command===0x03)
        {
            var formatUnit=findUnitByResidentID(dest);
            if(!formatUnit && dest>=1 && dest<=8 && units[dest]!==null) formatUnit=dest;
            if(!formatUnit)
            {
                buildResponse(dest,0x28,[]);
                return;
            }

            var formatDevice=units[formatUnit];
            if(!formatDevice || typeof(formatDevice.format)!=="function")
            {
                buildResponse(dest,0x01,[]);
                return;
            }

            var formatReply;
            try { formatReply=formatDevice.format(); }
            catch(err)
            {
                console.error("SmartPort FORMAT device exception",err);
                formatReply={"error":0x27};
            }
            var formatError=formatReply && formatReply.error!==undefined ? Number(formatReply.error)&0x7F : 0x27;
            debugLog("DEVICE_RESULT",{"command":"FORMAT","unit":formatUnit,"error":formatError,"errorHex":"$"+formatError.toString(16).toUpperCase().padStart(2,"0")});
            buildResponse(dest,formatError,[]);
            return;
        }

'''
if s.count(read_marker)!=1:
    raise SystemExit(f'read marker: expected one match, found {s.count(read_marker)}')
s=s.replace(read_marker,write_handler+read_marker,1)

replace_once(
'''        for(var i=0;i<SYNC.length;i++) if(syncWindow[i]!==SYNC[i]) return false;
        protocolState=RECEIVE_COMMAND;
        rx=[];
''',
'''        for(var i=0;i<SYNC.length;i++) if(syncWindow[i]!==SYNC[i]) return false;
        var receivingWriteData=protocolState===WAIT_WRITE_DATA;
        if(!receivingWriteData) pendingWrite=null;
        protocolState=receivingWriteData ? RECEIVE_WRITE_DATA : RECEIVE_COMMAND;
        rx=[];
''',
'feedSync write state')

replace_once(
'''    function receiveByte(value)
    {
        value=Number(value)&0xFF;
        if(protocolState!==RECEIVE_COMMAND)
        {
            if(protocolState===WAIT_SYNC) feedSync(value);
            else
            {
                // Permit a host retry to restart framing after a timed-out response.
                if(feedSync(value)) ack=false;
            }
            return;
        }
''',
'''    function receiveByte(value)
    {
        value=Number(value)&0xFF;
        if(protocolState!==RECEIVE_COMMAND && protocolState!==RECEIVE_WRITE_DATA)
        {
            if(protocolState===WAIT_SYNC || protocolState===WAIT_WRITE_DATA) feedSync(value);
            else
            {
                // Permit a host retry to restart framing after a timed-out response.
                if(feedSync(value)) ack=false;
            }
            return;
        }
''',
'receive write data')

replace_once(
'''    function onReqChange(newReq)
    {
        if(newReq===req) return;
        req=newReq;

        if(!req)
        {
            if(protocolState===RESPONSE_PENDING && ack)
            {
                // Host has observed active-low ACK for the command.
                ack=false;
            }
            else if(protocolState===RESPONSE_DONE)
            {
                ack=false;
                protocolState=WAIT_SYNC;
                tx=[];
                txIndex=0;
                syncWindow=[];
            }
            return;
        }

        if(protocolState===RESPONSE_PENDING && !ack)
        {
            protocolState=SEND_RESPONSE;
            txIndex=0;
        }
    }
''',
'''    function onReqChange(newReq)
    {
        if(newReq===req) return;
        req=newReq;

        if(!req)
        {
            if(protocolState===WRITE_COMMAND_ACK)
            {
                // Host has observed command ACK; accept the following DATA packet.
                ack=false;
                protocolState=WAIT_WRITE_DATA;
                return;
            }
            if(protocolState===WRITE_DATA_ACK)
            {
                // Complete, checksum-valid DATA is committed only when its ACK is released.
                ack=false;
                commitPendingWrite();
                return;
            }
            if(protocolState===RESPONSE_PENDING && ack)
            {
                // Host has observed active-low ACK for a one-packet command.
                ack=false;
                return;
            }
            if(protocolState===RESPONSE_DONE)
            {
                ack=false;
                protocolState=WAIT_SYNC;
                tx=[];
                txIndex=0;
                syncWindow=[];
                pendingWrite=null;
                return;
            }
            return;
        }

        if(protocolState===WAIT_WRITE_DATA)
        {
            // Incoming bytes must first establish a complete SmartPort sync sequence.
            return;
        }
        if(protocolState===RESPONSE_PENDING && !ack)
        {
            protocolState=SEND_RESPONSE;
            txIndex=0;
        }
    }
''',
'REQ ACK write transitions')

replace_once(
'''            "txLength":tx.length,
            "txIndex":txIndex,
            "lastError":lastError
''',
'''            "txLength":tx.length,
            "txIndex":txIndex,
            "pendingWrite":pendingWrite ? {
                 "dest":pendingWrite.dest
                ,"unit":pendingWrite.unit
                ,"blockNumber":pendingWrite.blockNumber
                ,"bufferAddress":pendingWrite.bufferAddress
                ,"dataLength":pendingWrite.data ? pendingWrite.data.length : 0
            } : null,
            "lastError":lastError
''',
'getState pending write')

path.write_text(s)
print('patched',path)
