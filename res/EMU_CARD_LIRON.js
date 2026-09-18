// 2026 Apple UniDisk 3.5 Interface Controller (Liron) for RetroAppleJS.
// ROM: POM2 roms/liron.rom, Git blob a7e7b6283f029834793e767b48dee866e23d0ff8
// Size: 4096 bytes, CRC32 974253FD.

const LIRON_ROM_B64 = `
xuny7ffh8uWg9/Lp9PTl7qDi+aDN6ePo4eXsoMHz6+nu8wD/////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
/////////////////////////////////////////6IgogCiA8kAsAo4sAEY
ogF+eAQYosGO+AeiAa3/z0zhy6AApUtI0ANMuMGtnMAQ+4VZSkpKKQ+qpVkp
B4VZrZzAEPtdJ8qRVkVAhUDI0ALmV62cwBD7XTfKkVZFQIVAyK2cwBD7XUfK
kVZFQIVAyK2cwBD7XVfKkVZFQIVAyNAC5lemWa2cwBD7XTfKkVZFQIVAyK2c
wBD7XUfKkVZFQIVAyK2cwBD7XVfKkVZFQIVAyMZL8ANMK8GtnMAQ+4VZaIVL
rZzAEPs4KiVZRUCsnMAQ+8DI0BymTPAIoABRVMjK0Pqq0BGtncCtnsAw+62Q
wBhgqSDQAqkQOGD/AAAAvwqiIKIAogPJALAKOLABGKICfngEGKLCjvgHogKt
/89M4cugAKVLSNADTLjCrazAEPuFWUpKSikPqqVZKQeFWa2swBD7XSfKkVZF
QIVAyNAC5letrMAQ+103ypFWRUCFQMitrMAQ+11HypFWRUCFQMitrMAQ+11X
ypFWRUCFQMjQAuZXplmtrMAQ+103ypFWRUCFQMitrMAQ+11HypFWRUCFQMit
rMAQ+11XypFWRUCFQMjGS/ADTCvCrazAEPuFWWiFS62swBD7OColWUVArKzA
EPvAyNAcpkzwCKAAUVTIytD6qtARra3Ara7AMPutoMAYYKkg0AKpEDhg/wAA
AL8KoiCiAKIDyQCwCjiwARiiA354BBiiw474B6IDrf/PTOHLoAClS0jQA0y4
w628wBD7hVlKSkopD6qlWSkHhVmtvMAQ+10nypFWRUCFQMjQAuZXrbzAEPtd
N8qRVkVAhUDIrbzAEPtdR8qRVkVAhUDIrbzAEPtdV8qRVkVAhUDI0ALmV6ZZ
rbzAEPtdN8qRVkVAhUDIrbzAEPtdR8qRVkVAhUDIrbzAEPtdV8qRVkVAhUDI
xkvwA0wrw628wBD7hVlohUutvMAQ+zgqJVlFQKy8wBD7wMjQHKZM8AigAFFU
yMrQ+qrQEa29wK2+wDD7rbDAGGCpINACqRA4YP8AAAC/CqIgogCiA8kAsAo4
sAEYogR+eAQYosSO+AeiBK3/z0zhy6AApUtI0ANMuMStzMAQ+4VZSkpKKQ+q
pVkpB4VZrczAEPtdJ8qRVkVAhUDI0ALmV63MwBD7XTfKkVZFQIVAyK3MwBD7
XUfKkVZFQIVAyK3MwBD7XVfKkVZFQIVAyNAC5lemWa3MwBD7XTfKkVZFQIVA
yK3MwBD7XUfKkVZFQIVAyK3MwBD7XVfKkVZFQIVAyMZL8ANMK8StzMAQ+4VZ
aIVLrczAEPs4KiVZRUCszMAQ+8DI0BymTPAIoABRVMjK0Pqq0BGtzcCtzsAw
+63AwBhgqSDQAqkQOGD/AAAAvwqiIKIAogPJALAKOLABGKIFfngEGKLFjvgH
ogWt/89M4cugAKVLSNADTLjFrdzAEPuFWUpKSikPqqVZKQeFWa3cwBD7XSfK
kVZFQIVAyNAC5let3MAQ+103ypFWRUCFQMit3MAQ+11HypFWRUCFQMit3MAQ
+11XypFWRUCFQMjQAuZXplmt3MAQ+103ypFWRUCFQMit3MAQ+11HypFWRUCF
QMit3MAQ+11XypFWRUCFQMjGS/ADTCvFrdzAEPuFWWiFS63cwBD7OColWUVA
rNzAEPvAyNAcpkzwCKAAUVTIytD6qtARrd3Ard7AMPut0MAYYKkg0AKpEDhg
/wAAAL8KoiCiAKIDyQCwCjiwARiiBn54BBiixo74B6IGrf/PTOHLoAClS0jQ
A0y4xq3swBD7hVlKSkopD6qlWSkHhVmt7MAQ+10nypFWRUCFQMjQAuZXrezA
EPtdN8qRVkVAhUDIrezAEPtdR8qRVkVAhUDIrezAEPtdV8qRVkVAhUDI0ALm
V6ZZrezAEPtdN8qRVkVAhUDIrezAEPtdR8qRVkVAhUDIrezAEPtdV8qRVkVA
hUDIxkvwA0wrxq3swBD7hVlohUut7MAQ+zgqJVlFQKzswBD7wMjQHKZM8Aig
AFFUyMrQ+qrQEa3twK3uwDD7reDAGGCpINACqRA4YP8AAAC/CqIgogCiA8kA
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
hVWpgIVbIA/K5lqpCYVNqQCFTiAAyJAFxlpMNM4gYMmlTfDlpVqkWJn4B2iF
RmiFQ2iFQqmlmfgGSf+ZeAdgplid+AWYnXgGYIZYqaqdeASd+AagBbkWz5lC
AIgQ96VYCgoKCoVDIObLsBWuAAjK0A+uAQjwCqVYCgoKCqpMAQggk/4gif6m
ANAKpgHs+AfQA0y6+qIXhiUgIvypAIUkogCkWLn4BNACogrJKNACoh7JL9AC
ojK91M7wBiDt/ejQ9UwA4Mmvz6DF0tLP0gDOz9SgwaDCz8/UwcLMxaDEydPL
AM7PoMTF1snDxaDDz87OxcPUxcQAzs+gxMnTy6DUz6DCz8/UAAFQAAgAAP//
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////qMOpoLG5uLWgwfDw7OWgw+/t8PX05fKsoMnu466gzdPBABD/
/w==
`;

function decodeLironBase64(text)
{
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    text = String(text).replace(/[^A-Za-z0-9+/=]/g,"");

    var padding = text.slice(-2)=="==" ? 2 : (text.slice(-1)=="=" ? 1 : 0);
    if((text.length & 3)!==0) throw new Error("Invalid Liron ROM base64 length");

    var out = new Uint8Array((text.length/4)*3-padding);
    var p = 0;

    for(var i=0;i<text.length;i+=4)
    {
        var c0 = alphabet.indexOf(text[i]);
        var c1 = alphabet.indexOf(text[i+1]);
        var c2 = text[i+2]=="=" ? 0 : alphabet.indexOf(text[i+2]);
        var c3 = text[i+3]=="=" ? 0 : alphabet.indexOf(text[i+3]);
        if(c0<0 || c1<0 || c2<0 || c3<0) throw new Error("Invalid Liron ROM base64");

        var n = (c0<<18) | (c1<<12) | (c2<<6) | c3;
        if(p<out.length) out[p++] = (n>>16)&0xFF;
        if(p<out.length) out[p++] = (n>>8)&0xFF;
        if(p<out.length) out[p++] = n&0xFF;
    }
    return out;
}

const LIRON_ROM = decodeLironBase64(LIRON_ROM_B64);
if(LIRON_ROM.length!==4096) throw new Error("Liron ROM must be exactly 4096 bytes");


function SmartPortBus()
{
    var devices = [];
    var units = new Array(9).fill(null);
    var residentIDs = new Array(9).fill(0);

    const SYNC = [0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3];
    const WAIT_SYNC="WAIT_SYNC";
    const RECEIVE_COMMAND="RECEIVE_COMMAND";
    const RESPONSE_PENDING="RESPONSE_PENDING";
    const SEND_RESPONSE="SEND_RESPONSE";
    const RESPONSE_DONE="RESPONSE_DONE";

    var protocolState=WAIT_SYNC;
    var phaseLines=0;
    var enabled=false;
    var req=false;
    var ack=false; // true = active-low ACK asserted on the physical bus
    var syncWindow=[];
    var rx=[];
    var header=[];
    var expectedLength=0;
    var tx=[];
    var txIndex=0;
    var lastError="";

    function normalizeUnit(unit)
    {
        unit = Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8)
            throw new RangeError("SmartPort unit must be an integer from 1 through 8");
        return unit;
    }

    function findUnit(device)
    {
        for(var unit=1;unit<=8;unit++) if(units[unit]===device) return unit;
        return 0;
    }

    function firstFreeUnit()
    {
        for(var unit=1;unit<=8;unit++) if(units[unit]===null) return unit;
        throw new RangeError("SmartPort bus has no free unit numbers");
    }

    function clearResidentIDs()
    {
        for(var unit=1;unit<=8;unit++) residentIDs[unit]=0;
    }

    function resetTransport(clearIDs)
    {
        protocolState=WAIT_SYNC;
        enabled=false;
        req=false;
        ack=false;
        syncWindow=[];
        rx=[];
        header=[];
        expectedLength=0;
        tx=[];
        txIndex=0;
        lastError="";
        if(clearIDs) clearResidentIDs();
    }

    function findUnitByResidentID(id)
    {
        id=Number(id)&0x7F;
        if(!id) return 0;
        for(var unit=1;unit<=8;unit++) if(residentIDs[unit]===id) return unit;
        return 0;
    }

    function firstUnassignedUnit()
    {
        for(var unit=1;unit<=8;unit++)
            if(units[unit]!==null && residentIDs[unit]===0) return unit;
        return 0;
    }

    function hasUnassignedUnit()
    {
        return firstUnassignedUnit()!==0;
    }

    function encodedPayloadLength(odd,groups)
    {
        return (odd ? odd+1 : 0) + groups*8;
    }

    function decodePayload(encoded,odd,groups)
    {
        var out=[];
        var pos=0;
        if(odd)
        {
            if(pos>=encoded.length) return null;
            var prefix=encoded[pos++]&0x7F;
            for(var i=0;i<odd;i++)
            {
                if(pos>=encoded.length) return null;
                var low=encoded[pos++]&0x7F;
                out.push(low | (((prefix>>(6-i))&1)?0x80:0));
            }
        }
        for(var g=0;g<groups;g++)
        {
            if(pos>=encoded.length) return null;
            var prefix7=encoded[pos++]&0x7F;
            for(var j=0;j<7;j++)
            {
                if(pos>=encoded.length) return null;
                var low7=encoded[pos++]&0x7F;
                out.push(low7 | (((prefix7>>(6-j))&1)?0x80:0));
            }
        }
        return out;
    }

    function encodePayload(payload)
    {
        var bytes=[];
        var odd=payload.length%7;
        var groups=Math.floor(payload.length/7);
        var pos=0;

        if(odd)
        {
            var prefix=0x80;
            for(var i=0;i<odd;i++) if(payload[pos+i]&0x80) prefix|=0x40>>i;
            bytes.push(prefix);
            for(var j=0;j<odd;j++) bytes.push((payload[pos+j]&0x7F)|0x80);
            pos+=odd;
        }

        for(var g=0;g<groups;g++)
        {
            var prefix7=0x80;
            for(var k=0;k<7;k++) if(payload[pos+k]&0x80) prefix7|=0x40>>k;
            bytes.push(prefix7);
            for(var m=0;m<7;m++) bytes.push((payload[pos+m]&0x7F)|0x80);
            pos+=7;
        }
        return {"bytes":bytes,"odd":odd,"groups":groups};
    }

    function buildResponse(source,status,payload)
    {
        payload=Array.from(payload||[],function(b){return Number(b)&0xFF;});
        var enc=encodePayload(payload);
        var rawHeader=[0x00,Number(source)&0x7F,0x01,0x00,Number(status)&0x7F,enc.odd,enc.groups];
        var wireHeader=rawHeader.map(function(b){return b|0x80;});
        var checksum=0;
        for(var i=0;i<payload.length;i++) checksum^=payload[i];
        for(var j=0;j<wireHeader.length;j++) checksum^=wireHeader[j];

        tx=SYNC.slice(0,6);
        tx.push(0xC3);
        tx.push.apply(tx,wireHeader);
        tx.push.apply(tx,enc.bytes);
        tx.push(checksum|0xAA,(checksum>>1)|0xAA,0xC8);
        txIndex=0;
        ack=true;
        protocolState=RESPONSE_PENDING;
    }

    function failPacket(message)
    {
        lastError=String(message||"SmartPort packet error");
        protocolState=WAIT_SYNC;
        ack=false;
        syncWindow=[];
        rx=[];
        header=[];
        expectedLength=0;
        tx=[];
        txIndex=0;
    }

    function statusResponseFor(device,source,code)
    {
        if(!device || typeof(device.status)!=="function")
        {
            buildResponse(source,0x28,[]);
            return;
        }
        var reply=device.status(code);
        var error=reply && reply.error!==undefined ? Number(reply.error)&0x7F : 0x01;
        var data=reply && reply.data ? Array.from(reply.data) : [];
        buildResponse(source,error,data);
    }

    function dispatchPacket(rawHeader,payload)
    {
        var dest=rawHeader[0]&0x7F;
        var packetType=rawHeader[2]&0x7F;
        if(packetType!==0x00)
        {
            failPacket("SmartPort expected command packet");
            return;
        }

        var command=payload.length ? payload[0]&0x7F : 0;
        if(command===0x05)
        {
            var unit=firstUnassignedUnit();
            if(!unit)
            {
                failPacket("SmartPort INIT found no unassigned device");
                return;
            }
            residentIDs[unit]=dest;
            buildResponse(dest,hasUnassignedUnit()?0x00:0x7F,[]);
            return;
        }

        if(command!==0x00)
        {
            buildResponse(dest,0x01,[]);
            return;
        }

        // Standard SmartPort command frame:
        // command, parameter count, device id, reserved, status/control code.
        var frameUnit=payload.length>2 ? payload[2]&0xFF : 0;
        var statusCode=payload.length>4 ? payload[4]&0xFF : 0;

        if(dest===0 && frameUnit===0 && statusCode===0)
        {
            buildResponse(0,0x00,[devices.length&0xFF,0x00,0x01,0x13]);
            return;
        }

        var unit=findUnitByResidentID(dest);
        if(!unit && dest>=1 && dest<=8 && units[dest]!==null) unit=dest;
        if(!unit && frameUnit>=1 && frameUnit<=8 && units[frameUnit]!==null) unit=frameUnit;
        if(!unit)
        {
            buildResponse(dest,0x28,[]);
            return;
        }
        statusResponseFor(units[unit],dest,statusCode);
    }

    function processPacket()
    {
        if(header.length!==7)
        {
            failPacket("SmartPort short header");
            return;
        }

        var odd=header[5]&0x7F;
        var groups=header[6]&0x7F;
        var encLen=encodedPayloadLength(odd,groups);
        if(rx.length!==7+encLen+3)
        {
            failPacket("SmartPort packet length mismatch");
            return;
        }
        if(rx[rx.length-1]!==0xC8)
        {
            failPacket("SmartPort packet end marker mismatch");
            return;
        }

        var encoded=rx.slice(7,7+encLen);
        var payload=decodePayload(encoded,odd,groups);
        if(payload===null)
        {
            failPacket("SmartPort payload decode error");
            return;
        }

        var checksum=0;
        for(var i=0;i<payload.length;i++) checksum^=payload[i];
        for(var j=0;j<7;j++) checksum^=rx[j];
        var c0=rx[7+encLen], c1=rx[8+encLen];
        var wireChecksum=(c0&0x55)|((c1&0x55)<<1);
        if(wireChecksum!==checksum)
        {
            failPacket("SmartPort checksum mismatch");
            return;
        }

        lastError="";
        dispatchPacket(header.slice(),payload);
        rx=[];
        header=[];
        expectedLength=0;
        syncWindow=[];
    }

    function feedSync(value)
    {
        syncWindow.push(value&0xFF);
        if(syncWindow.length>SYNC.length) syncWindow.shift();
        if(syncWindow.length!==SYNC.length) return false;
        for(var i=0;i<SYNC.length;i++) if(syncWindow[i]!==SYNC[i]) return false;
        protocolState=RECEIVE_COMMAND;
        rx=[];
        header=[];
        expectedLength=0;
        syncWindow=[];
        lastError="";
        return true;
    }

    function receiveByte(value)
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

        rx.push(value);
        if(header.length<7)
        {
            header.push(value&0x7F);
            if(header.length===7)
            {
                expectedLength=7+encodedPayloadLength(header[5],header[6])+3;
                if(expectedLength>1024)
                {
                    failPacket("SmartPort packet too large");
                    return;
                }
            }
        }
        if(expectedLength && rx.length===expectedLength) processPacket();
        else if(expectedLength && rx.length>expectedLength) failPacket("SmartPort packet overflow");
    }

    function onReqChange(newReq)
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

    this.reset = function()
    {
        phaseLines=0;
        resetTransport(true);
    };

    this.attach = function(device,unit)
    {
        if(device==null) return null;

        var existingUnit = findUnit(device);
        if(existingUnit)
        {
            if(unit===undefined || unit===null || Number(unit)===existingUnit) return device;
            throw new Error("SmartPort device is already attached as unit "+existingUnit);
        }

        unit = unit===undefined || unit===null ? firstFreeUnit() : normalizeUnit(unit);
        if(units[unit]!==null) throw new Error("SmartPort unit "+unit+" is already occupied");

        if(typeof(device.setUnit)==="function") device.setUnit(unit);
        else device.unit = unit;

        devices.push(device);
        units[unit]=device;
        residentIDs[unit]=0;
        return device;
    };

    this.detach = function(device)
    {
        var i = devices.indexOf(device);
        if(i<0) return device;

        var unit=findUnit(device);
        if(unit)
        {
            units[unit]=null;
            residentIDs[unit]=0;
        }
        devices.splice(i,1);

        if(typeof(device.setUnit)==="function") device.setUnit(0);
        else if(device && Object.prototype.hasOwnProperty.call(device,"unit")) device.unit=0;

        return device;
    };

    this.hasDevices = function() { return devices.length>0; };
    this.getDevice = function(unit)
    {
        unit=Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8) return null;
        return units[unit] || null;
    };
    this.getUnits = function()
    {
        var out=[];
        for(var unit=1;unit<=8;unit++) if(units[unit]!==null) out.push(unit);
        return out;
    };

    this.setLines = function(lines,ctx)
    {
        var phase=Number(lines)&0x0F;
        phaseLines=phase;

        // SmartPort reset is exactly PH2+PH0 (0101).
        if(phase===0x05)
        {
            resetTransport(true);
            phaseLines=phase;
            return;
        }

        var newEnabled=(phase===0x0A || phase===0x0B);
        var newReq=newEnabled && !!(phase&0x01);
        enabled=newEnabled;
        onReqChange(newReq);
    };

    // IWM SENSE sees the physical ACK line. ACK is active low, so a
    // deasserted/hi-Z line is SENSE=1 and asserted ACK is SENSE=0.
    this.readSense = function(lines,ctx)
    {
        if(lines!==undefined && lines!==null) this.setLines(lines,ctx);
        return !ack;
    };

    this.readData = function(lines,ctx)
    {
        if(lines!==undefined && lines!==null) this.setLines(lines,ctx);
        if(!enabled || protocolState!==SEND_RESPONSE || txIndex>=tx.length) return 0xFF;

        var value=tx[txIndex++]&0xFF;
        if(txIndex>=tx.length)
        {
            protocolState=RESPONSE_DONE;
            ack=true;
        }
        return value;
    };

    this.writeData = function(value,lines,ctx)
    {
        if(lines!==undefined && lines!==null) this.setLines(lines,ctx);
        value=Number(value)&0xFF;
        if(enabled && req) receiveByte(value);
        return value;
    };

    this.getState = function()
    {
        var ids={};
        for(var unit=1;unit<=8;unit++) if(residentIDs[unit]) ids[unit]=residentIDs[unit];
        return {
            "deviceCount":devices.length,
            "units":this.getUnits(),
            "residentIDs":ids,
            "protocolState":protocolState,
            "enabled":enabled,
            "req":req,
            "ack":ack,
            "phaseLines":phaseLines,
            "rxLength":rx.length,
            "txLength":tx.length,
            "txIndex":txIndex,
            "lastError":lastError
        };
    };

    this.reset();
}

function LironIWM(bus)
{
    const PHASE0=0x01, PHASE1=0x02, PHASE2=0x04, PHASE3=0x08;
    const MOTOR=0x10, DRIVE=0x20, Q6=0x40, Q7=0x80;

    bus = bus || new SmartPortBus();

    var state = {
         "lines":0x00
        ,"mode":0x00
        ,"readData":0xFF
        ,"writeData":0x00
        ,"writeReady":true
        ,"underrun":false
    };

    function touchState(reg,ctx)
    {
        reg = Number(reg)&0x0F;
        var bit = reg>>1;
        var mask = 1<<bit;
        if(reg&1) state.lines |= mask;
        else state.lines &= ~mask;
        state.lines &= 0xFF;
        if(bit<4 && bus && typeof(bus.setLines)==="function") bus.setLines(state.lines,ctx);
        return reg;
    }

    function selectedRegister()
    {
        var q6=!!(state.lines&Q6), q7=!!(state.lines&Q7), motor=!!(state.lines&MOTOR);
        if(!q7 && !q6) return motor ? "DATA" : "ALLONES";
        if(!q7 && q6) return "STATUS";
        if(q7 && !q6) return "HANDSHAKE";
        return motor ? "WRITEDATA" : "MODE";
    }

    function readData(ctx)
    {
        if(bus && typeof(bus.readData)==="function")
        {
            var value = bus.readData(state.lines,ctx);
            if(value!==undefined && value!==null) state.readData = Number(value)&0xFF;
        }
        return state.readData&0xFF;
    }

    function readStatus(ctx)
    {
        var sense = bus && typeof(bus.readSense)==="function" && bus.readSense(state.lines,ctx) ? 0x80 : 0;
        var enabled = state.lines&MOTOR ? 0x20 : 0;
        return (sense|enabled|(state.mode&0x1F))&0xFF;
    }

    function readHandshake()
    {
        return (0x3F | (state.writeReady?0x80:0) | (!state.underrun?0x40:0))&0xFF;
    }

    function writeMode(value,ctx)
    {
        state.mode = Number(value)&0x1F;
        if(bus && typeof(bus.writeMode)==="function") bus.writeMode(state.mode,state.lines,ctx);
    }

    function writeData(value,ctx)
    {
        state.writeData = Number(value)&0xFF;
        if(bus && typeof(bus.writeData)==="function") bus.writeData(state.writeData,state.lines,ctx);
    }

    this.read = function(reg,ctx)
    {
        reg = touchState(reg,ctx);
        if(reg&1) return undefined;

        switch(selectedRegister())
        {
            case "ALLONES": return 0xFF;
            case "DATA": return readData(ctx);
            case "STATUS": return readStatus(ctx);
            case "HANDSHAKE": return readHandshake();
            default: return 0xFF;
        }
    };

    this.write = function(reg,value,ctx)
    {
        reg = touchState(reg,ctx);
        value = Number(value)&0xFF;
        if(!(reg&1)) return undefined;
        if((state.lines&(Q6|Q7))!==(Q6|Q7)) return undefined;
        if(state.lines&MOTOR) writeData(value,ctx);
        else writeMode(value,ctx);
        return undefined;
    };

    this.reset = function()
    {
        state.lines=0; state.mode=0; state.readData=0xFF; state.writeData=0;
        state.writeReady=true; state.underrun=false;
        if(bus && typeof(bus.reset)==="function") bus.reset();
    };
    this.restart = function() { this.reset(); };
    this.setWriteReady = function(value) { state.writeReady=!!value; };
    this.setUnderrun = function(value) { state.underrun=!!value; };
    this.setReadData = function(value) { state.readData=Number(value)&0xFF; };
    this.getBus = function() { return bus; };
    this.getState = function()
    {
        return {
             "lines":state.lines&0xFF
            ,"phase0":!!(state.lines&PHASE0)
            ,"phase1":!!(state.lines&PHASE1)
            ,"phase2":!!(state.lines&PHASE2)
            ,"phase3":!!(state.lines&PHASE3)
            ,"motor":!!(state.lines&MOTOR)
            ,"drive":!!(state.lines&DRIVE)
            ,"q6":!!(state.lines&Q6)
            ,"q7":!!(state.lines&Q7)
            ,"mode":state.mode&0x1F
            ,"readData":state.readData&0xFF
            ,"writeData":state.writeData&0xFF
            ,"writeReady":!!state.writeReady
            ,"underrun":!!state.underrun
            ,"selectedRegister":selectedRegister()
        };
    };

    this.reset();
}


if(typeof(oEMU)==="undefined") var oEMU = {"component":{"IO":{}}};
else
{
    if(!oEMU.component) oEMU.component={};
    if(!oEMU.component.IO) oEMU.component.IO={};
}
oEMU.component.IO.AppleLiron = new AppleLiron();


function AppleLiron()
{
    const bDebug = false;
    var liron = this;
    var smartport = new SmartPortBus();
    var unidisk = typeof(UniDisk35Device)==="function" ? new UniDisk35Device() : null;
    if(unidisk) smartport.attach(unidisk,1);
    var iwm = new LironIWM(smartport);

    this.id = {"PCODE":"LIRON","icon":"fa fa-save"};
    this.deviceConfig = [];
    this.state = {"active":true};

    this.action = {
        "SlotIO": {
            "RD":{"callback":function(addr,ctx){ return liron.readSlotIO(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx){ return liron.writeSlotIO(addr,d8,ctx); }}
        },
        "SlotROM": {
            "RD":{"callback":function(addr,ctx){ return liron.readROM(addr,ctx); }}
        },
        "HostROM": {
            "RD":{"callback":function(addr,ctx){ return liron.readHostROM(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx){ return liron.writeHostROM(addr,d8,ctx); }}
        }
    };

    function physicalSlot()
    {
        if(!liron.mount) return null;
        var slot = Number(liron.mount.slotN)-1;
        return Number.isInteger(slot) && slot>=1 && slot<=7 ? slot : null;
    }

    function ownsExpansionROM()
    {
        var slot = physicalSlot();
        return slot!==null && oEMU && oEMU.component && oEMU.component.IO &&
            oEMU.component.IO.ACTION_MAP &&
            oEMU.component.IO.ACTION_MAP.Hslot==slot;
    }

    function selectExpansionROM(ctx)
    {
        if(ctx && ctx.bRO===true) return false;

        var slot = physicalSlot();
        if(slot===null || !liron.mount || !liron.mount.ranges || !liron.mount.ranges.HostROM)
            return false;

        var CIO = oEMU.component.IO;
        if(!CIO || !CIO.ACTION_MAP) return false;
        if(CIO.ACTION_MAP.Hslot==slot) return true;

        CIO.ACTION_MAP.Hslot=slot;
        var range=liron.mount.ranges.HostROM;
        for(var i=range.from;i<=range.to;i++) CIO.ACTION_MAP.RD[i]=liron.action.HostROM.RD.callback;

        if(bDebug) console.log("Liron claims $C800-$CFFF from slot "+slot);
        return true;
    }

    function releaseExpansionROM()
    {
        var slot=physicalSlot();
        if(slot===null || !oEMU.component.IO || !oEMU.component.IO.ACTION_MAP) return false;
        var CIO=oEMU.component.IO;
        if(CIO.ACTION_MAP.Hslot!=slot) return false;
        CIO.ACTION_MAP.Hslot=null;
        return true;
    }

    function hostRelativeAddress(addr,ctx)
    {
        if(ctx && Number.isFinite(ctx.rel_addr)) return ctx.rel_addr&0x0FFF;
        if(ctx && Number.isFinite(ctx.line)) return (ctx.line+(Number(addr)&0xFF))&0x0FFF;
        return 0x800+(Number(addr)&0x07FF);
    }

    this.readSlotIO = function(addr,ctx) { return iwm.read(Number(addr)&0x0F,ctx); };
    this.writeSlotIO = function(addr,d8,ctx) { return iwm.write(Number(addr)&0x0F,Number(d8)&0xFF,ctx); };

    this.readROM = function(addr,ctx)
    {
        selectExpansionROM(ctx);
        var slot=physicalSlot();
        if(slot===null) return 0;
        return LIRON_ROM[(slot<<8)|(Number(addr)&0xFF)]&0xFF;
    };

    this.readHostROM = function(addr,ctx)
    {
        var rel=hostRelativeAddress(addr,ctx);
        if(!ownsExpansionROM()) return 0;
        var d8=rel>=0x800 && rel<=0xFFF ? LIRON_ROM[rel] : 0;
        if(rel==0xFFF && !(ctx && ctx.bRO===true)) releaseExpansionROM();
        return d8&0xFF;
    };

    this.writeHostROM = function(addr,d8,ctx)
    {
        var rel=hostRelativeAddress(addr,ctx);
        if(ownsExpansionROM() && rel==0xFFF && !(ctx && ctx.bRO===true)) releaseExpansionROM();
        return 0;
    };

    this.reset = function() { iwm.reset(); };
    this.restart = function() { iwm.restart(); };
    this.getIWM = function() { return iwm; };
    this.getBus = function() { return smartport; };
    this.getUniDisk = function() { return unidisk; };
    this.getROM = function() { return LIRON_ROM; };
}
