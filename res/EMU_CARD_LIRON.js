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
sAo4sAEYogd+eAQYoseO+AeiB63/z0zhy6AApUtI0ANMuMet/MAQ+4VZSkpK
KQ+qpVkpB4VZrfzAEPtdJ8qRVkVAhUDI0ALmV638wBD7XTfKkVZFQIVAyK38
wBD7XUfKkVZFQIVAyK38wBD7XVfKkVZFQIVAyNAC5lemWa38wBD7XTfKkVZF
QIVAyK38wBD7XUfKkVZFQIVAyK38wBD7XVfKkVZFQIVAyMZL8ANMK8et/MAQ
+4VZaIVLrfzAEPs4KiVZRUCs/MAQ+8DI0BymTPAIoABRVMjK0Pqq0BGt/cCt
/sAw+63wwBhgqSDQAqkQOGD/AAAAvwog7sogBcqgByCpy72LwL2JwKAyvY7A
MAeI0Pg4TEnJvYHAoAWp/52PwLlQyR6MwJD7nY3AiBDypVoJgCDYySDWyaVb
INjJINbJINbJpUwJgCDYyaVLCYAg2MmlTPAVoP+lWR6MwJD7nY3AyLFUCYDE
TJDvpUvQA0wTyeqgAKVBnY3ApU0JgIRZvIzAEPudjcCkWbFWhU0KJkHI0AXm
V0yjyEhoqQIFQYVBpU4JgJ2NwLFWhU4KJkHIpU8JgJ2NwLFWhU8KJkHIpVAJ
gJ2NwLFWhVAKJkHI0AXmV0zfyEhopVEJgJ2NwLFWhVEKJkHIpVIJgJ2NwLFW
hVIKJkHIpVMJgJ2NwLFWhVMKJkHIxkvwA0x9yKVACaq8jMAQ+52NwKVASgmq
INjJqcgg2Mm9jMApQND5nY3AoAqI0AipASAfyjiwBr2OwDDwGL2AwL2MwGDD
//zzzz8gW8nq6upgTD3JqQCFQKVUhValVYVXqSGFUqVYGGnAhVMgBcq9jcC9
jsAQ+72BwKAevYzAEPuIMM7Jw9D0oAa9jMAQ+yl/mUsASYBFQIVAiBDtpUzw
JxhlVIVWpVVpAIVXoAC9jMAQ+wqFQb2MwBD7BkGwAkmAkVTIxEyQ7mxSAKmA
vIzAEPudjcBFQIVAYCAPyr2BwL2FwKBQIPjJIA/KoAog/8mI0PpgosjK0P1g
IB/KvYPAvYfAYCAfyr2AwL2CwL2EwL2GwGClWAoKCgqqYICAgICAgICAAAAA
AAAAAACAgICAAAAAAICAgIAAAAAAgIAAAICAAACAgAAAgIAAAIAAgACAAIAA
gACAAIAAgACpBaAAIIrKkAWpgCDtzWAgisqQ+qmAIO3NrfgGhU2teAeFTqm4
oAumWJ34BJideAWlTY34BqVOjXgHIADIrfgGhU2teAeFTpAMplje+ATQ4N54
BRDbYKRYqQWZ+AQgYMmQD6ABIPjJID3Jplje+ATQ7GAAJEkABAEAAQIECRIA
AQIEAQIAf/+mTvATpVWFV6mA4AHwBOZXqQAYZVSFVr3ZyoVLvdzKhUyiBaVN
hVkpB6gGWZAVveXKGGVMyQeQAukHhUy938plS4VLyjAG0OKYTB/LpVVIqQCm
TvAWvOvKUVRRVojQ+VFUUVbgAfAC5lXmVaRN8AlRVFFUiND7UVSFQGiFVaRM
iKkAhVmxVApmWYgQ+DhmWaVMGGVUhValVWkAhVegBjixVplNADABGGZBiBDy
OGZBpVYYaQeFVpAC5ldgvYjAvY3ATLbLmJ2PwJhdjsApH9D0YKVLqKIAhkui
AwomS8rQ+hhlTJAC5kuETDjlTLACxkukS2CQA0xZztiKqLl4BDARaJn4BRhp
A6pomXgGaQBIikgIeKIbtUBIyhD6hFi5+AbJpdAHSf9ZeAfwBakAIO3NpUMq
CCoqKCopA0kCwASwAkkCquiGQ7l4BBADTM/MufgFhVS5eAaFVaABsVSFQsix
VKrIsVSFVYZUqQGmQuAKkANMn82gALFUhVqgCLFUmUIAiND4pUPQWaZCvePN
KX+oqQTEWtDb4AXQCqkAIO3NqQBMwc2K0COpIaZG0MSKpligB5FEiND7vfgH
kUTIqQCRRKkIiCBPzkyNzMkE0AumRvALyvAIqSHQmKkR0JSpH9CQqSikWL74
B+RDkOupCYVNqQCFToVVqUKFVKZYvXgEEBOmQr3jzSl/hVqpAIVIpULQAoVG
pVqmQ4ZahUOpgIVbIA/KIHbKsEalRIVUpUWFVaZCvePNEDvgBNAYoAGxVKqI
sVRIGKkCZVSFVGiQE+ZVTE/N4ALQBqkAogLQBKZHpUaGToVNqYKFWyBnypAE
qQbQP6RYuXgEEAylQtAIqUWiAIVUhlUgvcqw5CC/yyBPzqVC0BumWL14BBAU
pUad+AWlR514BqVFKRDQBKkv0AKlTaRYmfgEqvAavngEEBWiAMlAsA6iJ8kr
8AnJKPAFyS/wAYqkWJl4BaIAaJVA6OAckPgoufgFqrl4BUi5eAaoGGjwAThg
AwODAYMBAQEDg0gg5cloqqVCSKVDSKVGSIZGqQWFQqkAhVqpAoVDqUKFVKkA
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
    var bDebug = false;
    var devices = [];
    var units = new Array(9).fill(null);
    var residentIDs = new Array(9).fill(0);

    const SYNC = [0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3];
    const WAIT_SYNC="WAIT_SYNC";
    const RECEIVE_COMMAND="RECEIVE_COMMAND";
    const WRITE_COMMAND_ACK="WRITE_COMMAND_ACK";
    const WAIT_WRITE_DATA="WAIT_WRITE_DATA";
    const RECEIVE_WRITE_DATA="RECEIVE_WRITE_DATA";
    const WRITE_DATA_ACK="WRITE_DATA_ACK";
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
    // WRITE BLOCK spans an inbound command packet and a following $82 DATA packet.
    // The media write is committed only after the host releases DATA ACK.
    var pendingWrite=null;

    const SMARTPORT_COMMAND_NAMES={0x00:"STATUS",0x01:"READ BLOCK",0x02:"WRITE BLOCK",0x03:"FORMAT",0x04:"CONTROL",0x05:"INIT",0x06:"OPEN",0x07:"CLOSE"};
    function debugLog(event,fields)
    {
        if(!bDebug) return;
        console.log("[LIRON SmartPort] "+event,fields || {});
    }

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
        pendingWrite=null;
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

    function buildResponse(source,status,payload,assertAck)
    {
        debugLog("TX_RESPONSE",{"src":source&0x7F,"dest":0,"type":1,"status":status&0x7F,"statusHex":"$"+(status&0x7F).toString(16).toUpperCase().padStart(2,"0"),"payloadLength":payload ? payload.length : 0,"payloadPreview":payload ? Array.from(payload).slice(0,32) : []});
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
        ack=assertAck===false ? false : true;
        protocolState=RESPONSE_PENDING;
    }

    function failPacket(message)
    {
        debugLog("PROTOCOL_ERROR",{"reason":message,"protocolState":protocolState,"header":header.slice(),"rxLength":rx.length,"expectedLength":expectedLength});
        lastError=String(message||"SmartPort packet error");
        pendingWrite=null;
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

    function dispatchWriteData(rawHeader,payload)
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

    function dispatchPacket(rawHeader,payload)
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
        debugLog("RX_COMMAND",{"dest":dest,"command":command,"commandName":SMARTPORT_COMMAND_NAMES[command] || "UNKNOWN","payload":payload.slice(),"parameterCount":payload.length>1 ? payload[1]&0xFF : null,"residentUnit":findUnitByResidentID(dest) || null});
        if(command===0x05)
        {
            var unit=firstUnassignedUnit();
            if(!unit)
            {
                failPacket("SmartPort INIT found no unassigned device");
                return;
            }
            residentIDs[unit]=dest;
            debugLog("INIT",{"dest":dest,"assignedUnit":unit,"residentID":dest,"remainingUnassigned":hasUnassignedUnit(),"responseStatus":hasUnassignedUnit()?0x00:0x7F});
            buildResponse(dest,hasUnassignedUnit()?0x00:0x7F,[]);
            return;
        }

        if(command===0x02)
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

        if(command===0x01)
        {
            var readUnit=findUnitByResidentID(dest);
            if(!readUnit && dest>=1 && dest<=8 && units[dest]!==null) readUnit=dest;
            if(!readUnit)
            {
                buildResponse(dest,0x28,[]);
                return;
            }

            var readDevice=units[readUnit];
            if(!readDevice || typeof(readDevice.readBlock)!=="function")
            {
                buildResponse(dest,0x01,[]);
                return;
            }

            // External SmartPort transmits the parameter list beginning after
            // the unit byte: command, count, buffer pointer, 24-bit block.
            // DEST already identifies the resident/device.
            var blockNumber =
                 (payload.length>4 ? payload[4]&0xFF : 0)
                |((payload.length>5 ? payload[5]&0xFF : 0)<<8)
                |((payload.length>6 ? payload[6]&0xFF : 0)<<16);

            var readState=typeof(readDevice.getState)==="function" ? readDevice.getState() || {} : {};
            debugLog("READ_BLOCK",{"dest":dest,"residentUnit":readUnit,"payload":payload.slice(),"parameterCount":payload.length>1 ? payload[1]&0xFF : null,"bufferAddress":payload.length>3 ? ((payload[2]&0xFF)|((payload[3]&0xFF)<<8)) : null,"blockBytes":[payload.length>4?payload[4]&0xFF:null,payload.length>5?payload[5]&0xFF:null,payload.length>6?payload[6]&0xFF:null],"blockNumber":blockNumber,"mediaLoaded":!!readState.mediaLoaded,"mediaFilename":readState.mediaFilename || ""});
            var readReply=readDevice.readBlock(blockNumber);
            var readError=readReply && readReply.error!==undefined ? Number(readReply.error)&0x7F : 0x27;
            var readData=readReply && readReply.data ? Array.from(readReply.data) : [];
            debugLog("DEVICE_RESULT",{"command":"READ BLOCK","unit":readUnit,"blockNumber":blockNumber,"error":readError,"errorHex":"$"+readError.toString(16).toUpperCase().padStart(2,"0"),"dataLength":readData.length,"mediaLoaded":!!readState.mediaLoaded,"mediaFilename":readState.mediaFilename || ""});
            buildResponse(dest,readError,readData);
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
        debugLog("STATUS",{"dest":dest,"residentUnit":findUnitByResidentID(dest)||null,"frameUnit":frameUnit,"statusCode":statusCode});

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
            debugLog("CHECKSUM_ERROR",{"expected":checksum,"received":wireChecksum,"header":header.slice(),"payload":payload.slice(),"encodedPayload":encoded.slice()});
            failPacket("SmartPort checksum mismatch");
            return;
        }

        lastError="";
        debugLog("RX_PACKET",{"dest":header[0]&0x7F,"src":header[1]&0x7F,"type":header[2]&0x7F,"aux":header[3]&0x7F,"status":header[4]&0x7F,"oddCount":header[5]&0x7F,"groupCount":header[6]&0x7F,"rawHeader":header.slice(),"encodedPayload":encoded.slice(),"payload":payload.slice(),"checksumExpected":checksum,"checksumReceived":wireChecksum});
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
        var receivingWriteData=protocolState===WAIT_WRITE_DATA;
        if(!receivingWriteData) pendingWrite=null;
        protocolState=receivingWriteData ? RECEIVE_WRITE_DATA : RECEIVE_COMMAND;
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

    this.setDebug = function(value) { bDebug=!!value; return bDebug; };
    this.getDebug = function() { return bDebug; };

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
            "pendingWrite":pendingWrite ? {
                 "dest":pendingWrite.dest
                ,"unit":pendingWrite.unit
                ,"blockNumber":pendingWrite.blockNumber
                ,"bufferAddress":pendingWrite.bufferAddress
                ,"dataLength":pendingWrite.data ? pendingWrite.data.length : 0
            } : null,
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
        ,"writeDrainPending":false
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
        if(state.writeDrainPending)
        {
            state.writeDrainPending=false;
            state.writeReady=true;

            // Without cycle-accurate IWM timing, a handshake poll advances the
            // pending transmit byte. Only the final packet byte may underrun.
            // One-packet commands finish in RESPONSE_PENDING; WRITE BLOCK has
            // separate command- and DATA-packet completion states.
            var busState = bus && typeof(bus.getState)==="function" ? bus.getState() : null;
            var packetComplete = busState && (
                   busState.protocolState==="RESPONSE_PENDING"
                || busState.protocolState==="WRITE_COMMAND_ACK"
                || busState.protocolState==="WRITE_DATA_ACK"
            );
            if(packetComplete) state.underrun=true;
        }
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
        state.writeReady=false;
        state.underrun=false;
        state.writeDrainPending=true;
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
        state.writeReady=true; state.underrun=false; state.writeDrainPending=false;
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
    var iwm = new LironIWM(smartport);
    var deviceSurfaceMapState = {"unit":null,"hash":null,"page":0};
    var deviceSurfaceMapSyncEnabled = false;

    this.id = {"PCODE":"LIRON","icon":"fa fa-save"};
    this.deviceConfig = [{
         "DCODE":"UNIDISK"
        ,"hostPCODE":"LIRON"
        ,"coID":"UniDisk35Device"
        ,"deviceN":1
        ,"icon":"fa fa-hdd"
        ,"description":"Apple UniDisk 3.5"
        ,"autoAttach":"if-empty"
    },{
         "DCODE":"HD20"
        ,"hostPCODE":"LIRON"
        ,"coID":"HD20Device"
        ,"icon":"fa fa-hdd"
        ,"description":"Apple Hard Disk 20"
        ,"autoAttach":false
    }];
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

    this.attachSmartPortDevice = function(device)
    {
        if(!device || device.id?.hostPCODE!=="LIRON") return null;

        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit>=1 && unit<=8 && smartport.getDevice(unit)===device) return device;

        smartport.attach(device);
        unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(device.id && unit>=1 && unit<=8) device.id.deviceN=unit;
        return device;
    };

    this.detachSmartPortDevice = function(device)
    {
        if(!device) return false;
        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit<1 || unit>8 || smartport.getDevice(unit)!==device) return false;
        smartport.detach(device);
        return true;
    };

    this.attachUniDisk = function(device)
    {
        if(!device || device.id?.DCODE!=="UNIDISK") return null;

        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit>=1 && unit<=8 && smartport.getDevice(unit)===device) return device;

        smartport.attach(device);
        unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(device.id && unit>=1 && unit<=8) device.id.deviceN=unit;
        return device;
    };

    this.detachUniDisk = function(device)
    {
        if(!device) return false;
        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit<1 || unit>8 || smartport.getDevice(unit)!==device) return false;
        smartport.detach(device);
        return true;
    };

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

    this.deviceToolLoadFile = function(input,unit)
    {
        var file=input && input.files && input.files[0];
        if(!file) return false;

        unit=Number(unit);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(slotN))
            return false;

        function deviceUnit(device)
        {
            return device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
        }

        var target=smartport.getDevice(unit);
        if(!target)
        {
            var attached=Array.isArray(liron.devices) ? liron.devices : [];
            for(var i=0;i<attached.length;i++)
                if(deviceUnit(attached[i])===unit) { target=attached[i]; break; }
        }

        // Keep direct legacy calls compatible even when a test/tool invokes the
        // loader before the resident list has been populated.
        var deviceCode=String(target && target.id ? target.id.DCODE || "" : "") || "UNIDISK";
        var mediaLabel=deviceCode==="UNIDISK"
            ? "UniDisk 3.5"
            : (deviceCode==="HD20" ? "Apple Hard Disk 20" : deviceCode);
        var blockSize=target && typeof(target.getBlockSize)==="function"
            ? Number(target.getBlockSize())
            : 512;
        var blockCount=target && typeof(target.getBlockCount)==="function"
            ? Number(target.getBlockCount())
            : (deviceCode==="HD20" ? 40960 : 1600);
        var expectedBytes=blockSize*blockCount;

        function clearInput()
        {
            try { input.value=""; } catch(e) {}
        }

        if(!Number.isInteger(expectedBytes) || expectedBytes<=0 || Number(file.size)!==expectedBytes)
        {
            console.error(mediaLabel+" load failed: invalid image size",{
                 "slotN":slotN
                ,"unit":unit
                ,"filename":file.name || ""
                ,"expected":expectedBytes
                ,"actual":Number(file.size)
            });
            if(typeof(alert)==="function")
                alert(mediaLabel+" image must contain exactly "+expectedBytes+" bytes.");
            clearInput();
            return false;
        }

        var reader=new FileReader();
        reader.onload=function(ev)
        {
            try
            {
                var bytes=new Uint8Array(ev.target.result);
                var mounted=typeof(EMU_mountDiskImage)==="function" &&
                    EMU_mountDiskImage(bytes,slotN,deviceCode,file.name || "",unit);
                if(!mounted)
                {
                    console.error(mediaLabel+" load failed: mount rejected",{"slotN":slotN,"unit":unit,"filename":file.name || "","bytes":bytes.length});
                    if(typeof(alert)==="function") alert(mediaLabel+" load failed: mount rejected.");
                    clearInput();
                    return;
                }

                liron.deviceToolSyncMediaControls(unit);

                if(typeof(apple2plus)==="object" && apple2plus)
                {
                    var io=apple2plus.hwObj().io;
                    if(io && typeof(io.refreshDeviceToolboxes)==="function")
                        io.refreshDeviceToolboxes({
                             "id":"devices"
                            ,"default_slot":typeof(io.slot2ID)==="function"
                                ? io.slot2ID(slotN)
                                : undefined
                        });
                }
            }
            catch(err)
            {
                clearInput();
                console.error(mediaLabel+" load failed: exception",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":err && err.message ? err.message : String(err)},err);
                if(typeof(alert)==="function") alert(mediaLabel+" load failed: "+(err && err.message ? err.message : err));
            }
        };
        reader.onerror=function()
        {
            var msg=reader.error && reader.error.message ? reader.error.message : "Unable to read file.";
            clearInput();
            console.error(mediaLabel+" load failed: FileReader error",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":msg});
            if(typeof(alert)==="function") alert(mediaLabel+" load failed: "+msg);
        };
        reader.readAsArrayBuffer(file);
        return true;
    };

    this.deviceToolDownload = function(unit)
    {
        unit=Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8) return false;

        var target=smartport.getDevice(unit);
        if(!target)
        {
            var attached=Array.isArray(liron.devices) ? liron.devices : [];
            for(var i=0;i<attached.length;i++)
            {
                var candidate=attached[i];
                var candidateUnit=candidate && typeof(candidate.getUnit)==="function"
                    ? Number(candidate.getUnit())
                    : Number(candidate && candidate.id ? candidate.id.deviceN : NaN);
                if(candidateUnit===unit) { target=candidate; break; }
            }
        }

        if(!target || typeof(target.getImage)!=="function" || typeof(target.getSuggestedFilename)!=="function")
            return false;
        if(typeof(oCOM)!=="object" || !oCOM || typeof(oCOM.Download)!=="function")
            return false;

        var image=target.getImage();
        if(!image || typeof(image.length)!=="number" || image.length<=0) return false;
        var filename=String(target.getSuggestedFilename() || "HD20.po");
        oCOM.Download(filename,image);
        return true;
    };

    this.deviceMediaMetadataChanged = function(device)
    {
        var attached=Array.isArray(liron.devices) ? liron.devices : [];
        if(!device || attached.indexOf(device)<0) return false;
        if(typeof(apple2plus)!=="object" || !apple2plus) return false;

        var io=apple2plus.hwObj().io;
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        var slotID=Number.isInteger(slotN) && io && typeof(io.slot2ID)==="function"
            ? io.slot2ID(slotN)
            : undefined;
        if(!io || typeof(io.refreshDeviceToolboxes)!=="function") return false;

        io.refreshDeviceToolboxes({"id":"devices","default_slot":slotID});
        return true;
    };

    this.deviceToolEject = function(unit)
    {
        unit=Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8) return false;

        var devices=Array.isArray(liron.devices) ? liron.devices : [];
        var target=null;
        for(var i=0;i<devices.length;i++)
        {
            var device=devices[i];
            var deviceUnit=device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
            if(deviceUnit===unit)
            {
                target=device;
                break;
            }
        }

        if(!target || typeof(target.ejectImage)!=="function") return false;
        if(target.ejectImage()===false) return false;
        liron.deviceToolSyncMediaControls(unit,{"clearFile":true});

        if(typeof(apple2plus)==="object" && apple2plus)
        {
            var io=apple2plus.hwObj().io;
            var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
            var slotID=Number.isInteger(slotN) && typeof(io.slot2ID)==="function"
                ? io.slot2ID(slotN)
                : null;

            if(slotID!==null && typeof(document)==="object" && document)
            {
                var fileInput=document.getElementById("liron_unit_"+slotID+"_"+unit+"_file");
                if(fileInput) try { fileInput.value=""; } catch(e) {}
            }

            if(io && typeof(io.refreshDeviceToolboxes)==="function")
                io.refreshDeviceToolboxes({
                     "id":"devices"
                    ,"default_slot":slotID
                });
        }
        return true;
    };

    function deviceToolUnitDevice(unit)
    {
        unit=Number(unit);
        var device=smartport.getDevice(unit);
        if(device) return device;
        var attached=Array.isArray(liron.devices) ? liron.devices : [];
        for(var i=0;i<attached.length;i++)
        {
            var n=typeof(attached[i]?.getUnit)==="function" ? Number(attached[i].getUnit()) : Number(attached[i]?.id?.deviceN);
            if(n===unit) return attached[i];
        }
        return null;
    }

    function deviceToolInstanceHex(device)
    {
        var hash=Number(device && device.attach ? device.attach.hash : NaN);
        if(!Number.isInteger(hash)) return null;
        return (hash&0xFFFF).toString(16).toUpperCase().padStart(4,"0");
    }

    this.deviceToolSyncMediaControls = function(unit,options)
    {
        options=options || {}; unit=Number(unit);
        var device=deviceToolUnitDevice(unit); if(!device) return false;
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN; if(!Number.isInteger(slotN)) return false;
        var io=typeof(apple2plus)==="object" && apple2plus ? apple2plus.hwObj().io : null;
        var slotID=io && typeof(io.slot2ID)==="function" ? String(io.slot2ID(slotN)) : String(slotN-1);
        var controlID="liron_unit_"+slotID+"_"+unit;
        var deviceCode=String(device.id?.DCODE || "SMARTPORT"), hardDisk=deviceCode==="HD20";
        var state=typeof(device.getState)==="function" ? device.getState() || {} : {};
        var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
        var downloadable=exportable && (hardDisk || !!state.mediaLoaded);
        var filename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : "";
        var instance=deviceToolInstanceHex(device);
        if(typeof(document)==="undefined" || !document.getElementById) return false;
        function setClick(el,handler) { if(!el) return; if(handler) el.setAttribute("onclick",handler); else el.removeAttribute("onclick"); }
        var download=document.getElementById(controlID+"_dump");
        if(download)
        {
            download.disabled=!downloadable;
            download.title=downloadable ? ("Save "+filename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)");
            setClick(download,downloadable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : null);
        }
        var surface=document.getElementById(controlID+"_surface");
        if(surface)
        {
            var canMap=(deviceCode==="UNIDISK" || deviceCode==="HD20") && typeof(device.getSurfaceMapGeometry)==="function" && !!state.mediaLoaded;
            surface.disabled=!canMap; surface.title=canMap ? "Disk Surface Map" : "Disk Surface Map (no media loaded)";
            setClick(surface,canMap ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggle("+unit+","+Number(device.attach?.hash)+")") : null);
        }
        var eject=document.getElementById(controlID+"_but");
        if(eject) eject.title=(instance ? ("Instance #"+instance+": ") : ("Unit"+unit+": "))+(hardDisk ? "erase/reset disk" : "eject disk");
        if(options.clearFile) { var file=document.getElementById(controlID+"_file"); if(file) try { file.value=""; } catch(e) {} }
        if(deviceSurfaceMapState.unit===unit) liron.deviceToolSurfaceMapRefresh();
        return true;
    };

    function deviceToolSurfaceTarget(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(expectedHash)) return null;
        var device=deviceToolUnitDevice(unit);
        if(!device || (device.id?.DCODE!=="UNIDISK" && device.id?.DCODE!=="HD20") || typeof(device.getSurfaceMapGeometry)!=="function") return null;
        if(Number(device.attach?.hash)!==expectedHash) return null;
        return device;
    }

    function deviceToolSurfaceMapClassification(device)
    {
        if(!device || typeof(device.getImage)!=="function") return null;
        var image=device.getImage();
        if(!image || typeof(image.length)!=="number" || image.length<512) return null;

        var blockCount=Math.floor(image.length/512);
        var blocks=new Array(blockCount);
        var priority={
             "empty":0
            ,"raw":0
            ,"free":0
            ,"allocated":1
            ,"data":2
            ,"index":3
            ,"directory":4
            ,"bitmap":5
            ,"boot":6
            ,"unknown":7
        };

        function validBlock(block)
        {
            return Number.isInteger(block) && block>=0 && block<blockCount;
        }

        function le16(offset)
        {
            if(offset<0 || offset+1>=image.length) return 0;
            return (image[offset]&0xFF) | ((image[offset+1]&0xFF)<<8);
        }

        function pointer(block,index)
        {
            if(!validBlock(block) || index<0 || index>255) return 0;
            var base=block*512;
            return (image[base+index]&0xFF) | ((image[base+256+index]&0xFF)<<8);
        }

        function mark(block,kind,detail,owner)
        {
            if(!validBlock(block)) return;
            var current=blocks[block];
            if(current && (priority[current.kind]||0)>(priority[kind]||0)) return;
            blocks[block]={
                 "kind":kind
                ,"detail":detail || kind
                ,"owner":owner || ""
            };
        }

        for(var block=0;block<blockCount;block++)
        {
            var start=block*512, nonZero=false;
            for(var b=0;b<512;b++)
            {
                if(image[start+b]!==0) { nonZero=true; break; }
            }
            blocks[block]={
                 "kind":nonZero ? "raw" : "empty"
                ,"detail":nonZero ? "Raw data" : "Empty block"
                ,"owner":""
            };
        }

        // ProDOS volume directory header is at byte $04 of block 2.
        var volumeHeader=2*512+4;
        if(blockCount<=2 || ((image[volumeHeader]>>4)&0x0F)!==0x0F)
            return {"filesystem":"Raw image","blocks":blocks};

        var bitmapBlock=le16(2*512+0x27);
        var totalBlocks=le16(2*512+0x29);
        if(totalBlocks<=0 || totalBlocks>blockCount) totalBlocks=blockCount;

        // ProDOS volume bitmap: one bit per block, 1=free and 0=allocated.
        var bitmapBlocks=Math.ceil(totalBlocks/4096);
        if(validBlock(bitmapBlock))
        {
            for(block=0;block<totalBlocks;block++)
            {
                var bitmapOffset=bitmapBlock*512+(block>>3);
                if(bitmapOffset>=image.length) break;
                var free=!!(image[bitmapOffset] & (0x80>>(block&7)));
                mark(block,free ? "free" : "allocated",free ? "Free / unallocated" : "Allocated", "");
            }
            for(var bm=0;bm<bitmapBlocks;bm++)
                mark(bitmapBlock+bm,"bitmap","Volume bitmap","");
        }

        mark(0,"boot","Boot / loader block","");
        mark(1,"boot","Boot / loader block","");

        function entryName(offset)
        {
            var length=image[offset]&0x0F;
            var name="";
            for(var n=0;n<length && n<15;n++)
            {
                var ch=image[offset+1+n]&0x7F;
                name += ch>=32 && ch<127 ? String.fromCharCode(ch) : "?";
            }
            return name || "(unnamed)";
        }

        function markStandardFile(storage,key,owner)
        {
            if(!validBlock(key)) return;

            if(storage===1)
            {
                mark(key,"data","File data",owner);
                return;
            }

            if(storage===2)
            {
                mark(key,"index","Sapling index",owner);
                for(var i=0;i<256;i++)
                {
                    var dataBlock=pointer(key,i);
                    if(dataBlock) mark(dataBlock,"data","File data",owner);
                }
                return;
            }

            if(storage===3)
            {
                mark(key,"index","Tree master index",owner);
                for(var master=0;master<128;master++)
                {
                    var indexBlock=pointer(key,master);
                    if(!indexBlock || !validBlock(indexBlock)) continue;
                    mark(indexBlock,"index","Tree index",owner);
                    for(var child=0;child<256;child++)
                    {
                        var treeData=pointer(indexBlock,child);
                        if(treeData) mark(treeData,"data","File data",owner);
                    }
                }
                return;
            }

            // GS/OS extended file key block: data fork at +$000,
            // resource fork at +$100. Each mini-entry stores the standard
            // storage type in its low nibble and a key pointer at +1.
            if(storage===5)
            {
                mark(key,"index","Extended-file key block",owner);
                var base=key*512;
                for(var fork=0;fork<2;fork++)
                {
                    var forkOffset=base+(fork?0x100:0);
                    var forkStorage=image[forkOffset]&0x0F;
                    var forkKey=le16(forkOffset+1);
                    if(forkStorage>=1 && forkStorage<=3 && forkKey)
                        markStandardFile(forkStorage,forkKey,owner+(fork ? " · resource fork" : " · data fork"));
                }
            }
        }

        var seenDirectories={};
        function parseDirectory(key,path)
        {
            if(!validBlock(key) || seenDirectories[key]) return;
            seenDirectories[key]=true;

            var keyBase=key*512;
            var entryLength=image[keyBase+0x23] || 0x27;
            var entriesPerBlock=image[keyBase+0x24] || 0x0D;
            if(entryLength<0x27 || entriesPerBlock<1) { entryLength=0x27; entriesPerBlock=0x0D; }

            var current=key, first=true, seenBlocks={};
            while(validBlock(current) && !seenBlocks[current])
            {
                seenBlocks[current]=true;
                mark(current,"directory","Directory",path);
                var base=current*512;
                var firstEntry=first ? 1 : 0; // key block entry 0 is the directory header
                for(var entry=firstEntry;entry<entriesPerBlock;entry++)
                {
                    var offset=base+4+entry*entryLength;
                    if(offset+0x26>=base+512 || offset>=image.length) break;
                    var storage=(image[offset]>>4)&0x0F;
                    if(storage===0 || storage===0x0E || storage===0x0F) continue;

                    var name=entryName(offset);
                    var owner=path==="/" ? "/"+name : path+"/"+name;
                    var keyPointer=le16(offset+0x11);

                    if(storage===0x0D)
                        parseDirectory(keyPointer,owner);
                    else if(storage===1 || storage===2 || storage===3 || storage===5)
                        markStandardFile(storage,keyPointer,owner);
                    else if(storage===4)
                    {
                        var blocksUsed=le16(offset+0x13);
                        for(var p=0;p<blocksUsed;p++) mark(keyPointer+p,"data","Pascal area",owner);
                    }
                }
                current=le16(base+2);
                first=false;
            }
        }
        parseDirectory(2,"/");

        return {"filesystem":"ProDOS","blocks":blocks};
    }

    function deviceToolSurfaceEscape(value)
    {
        return String(value==null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/"/g,"&quot;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    function deviceToolSurfaceColor(kind)
    {
        switch(String(kind || "unknown"))
        {
            case "boot": return "#5856d6";
            case "directory": return "#007aff";
            case "bitmap": return "#ffcc00";
            case "index": return "#ff9500";
            case "data": return "#34c759";
            case "free": return "#f2f2f7";
            case "allocated": return "#af52de";
            case "raw": return "#5ac8fa";
            case "empty": return "#e5e5ea";
            default: return "#ff3b30";
        }
    }

    function deviceToolSurfaceCellStyle(kind,active,zoneEnd)
    {
        return "display:block;width:6px;height:6px;box-sizing:border-box;"+
            "border:1px solid rgba(0,0,0,0.24);"+
            "background:"+deviceToolSurfaceColor(active ? kind : "empty")+";"+
            (active ? "" : "opacity:0.12;")+
            (zoneEnd ? "border-bottom-width:2px;" : "");
    }

    var deviceToolSurfaceDensityPaletteCache=null;

    function deviceToolSurfaceDensityPalette()
    {
        if(deviceToolSurfaceDensityPaletteCache) return deviceToolSurfaceDensityPaletteCache;

        // Match Disk II's density palette exactly.
        var anchors=["#2D788E","#2CA984","#7DD552","#FDEA27"];
        var pal=Array(101);

        function rgb(hex)
        {
            hex=String(hex).replace("#","");
            return [
                 parseInt(hex.slice(0,2),16)
                ,parseInt(hex.slice(2,4),16)
                ,parseInt(hex.slice(4,6),16)
            ];
        }

        function hex(v)
        {
            return Math.max(0,Math.min(255,Math.round(v)))
                .toString(16).toUpperCase().padStart(2,"0");
        }

        for(var i=0;i<100;i++)
        {
            var range=100/(anchors.length-1);
            var index=Math.floor(i/range);
            if(index>=anchors.length-1) index=anchors.length-2;
            var pct=Math.round(Math.floor(i%range)*100/range);
            var a=rgb(anchors[index]), b=rgb(anchors[index+1]);
            pal[i]="#"+
                hex(a[0]+(b[0]-a[0])*pct/100)+
                hex(a[1]+(b[1]-a[1])*pct/100)+
                hex(a[2]+(b[2]-a[2])*pct/100);
        }

        pal[0]="#000000";
        pal[100]=anchors[anchors.length-1];
        deviceToolSurfaceDensityPaletteCache=pal;
        return pal;
    }

    function deviceToolSurfaceDensity(image,block)
    {
        var offset=Number(block)*512;
        if(!image || offset<0 || offset+512>image.length)
            return {"pct":0,"nonzero":0,"avg":0};

        var nonzero=0, sum=0;
        for(var i=0;i<512;i++)
        {
            var value=image[offset+i]&0xFF;
            sum+=value;
            if(value!==0) nonzero++;
        }

        return {
             "pct":Math.round(nonzero*100/512)
            ,"nonzero":nonzero
            ,"avg":Math.round(sum/512)
        };
    }

    function deviceToolSurfaceDensityCellStyle(pct,active)
    {
        var palette=deviceToolSurfaceDensityPalette();
        return "display:block;width:10px;height:10px;box-sizing:border-box;"+
            "border:1px solid #333;"+
            "background:"+(active ? palette[pct] : "#111")+";"+
            (active ? "" : "opacity:0.14;");
    }


    function deviceToolHD20SurfaceRangeLabel(page,panel)
    {
        var start=Number(page)+(Number(panel)*0.5), end=start+0.5;
        function point(value)
        {
            if(value===0) return "0";
            if(value<1) return Math.round(value*1024)+" KiB";
            return String(value)+" MiB";
        }
        return point(start)+"–"+point(end);
    }

    function deviceToolHD20SurfaceMapHTML(device,header)
    {
        var instance=deviceToolInstanceHex(device) || "????";
        var geometry=device.getSurfaceMapGeometry();
        var page=Math.max(0,Math.min(geometry.pageCount-1,Number(deviceSurfaceMapState.page)||0));
        deviceSurfaceMapState.page=page;
        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        var unit=Number(device.getUnit ? device.getUnit() : device.id?.deviceN);
        var hash=Number(device.attach?.hash);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        var previous=Math.max(0,page-1), next=Math.min(geometry.pageCount-1,page+1);
        var nav="";
        if(Number.isInteger(slotN))
        {
            nav="<div class=\"liron-surface-page\" style=\"display:flex;align-items:center;justify-content:center;gap:5px;margin:0 0 4px 0;font-size:10px\">"+
                "<button class=\"appbut\" type=\"button\" title=\"Previous MiB\" "+(page<=0?"disabled ":"")+"onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapSetPage("+previous+","+unit+","+hash+");event.stopPropagation();\">‹</button>"+
                "<span>MiB "+page+" / "+(geometry.pageCount-1)+"</span>"+
                "<button class=\"appbut\" type=\"button\" title=\"Next MiB\" "+(page>=geometry.pageCount-1?"disabled ":"")+"onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapSetPage("+next+","+unit+","+hash+");event.stopPropagation();\">›</button>"+
                "</div>";
        }
        var meta="<div class=\"liron-surface-meta\" style=\"font-size:10px;color:#888;margin-top:4px;line-height:12px\">"+
            "Instance #"+instance+" · 20 MiB · 40960 × 512-byte blocks · MiB "+page+"/"+(geometry.pageCount-1)+"</div>";
        var out=header+nav+"<div class=\"liron-surface-panels liron-surface-hd20\" style=\"display:inline-flex;align-items:flex-start;gap:8px;width:max-content\">";
        for(var panel=0;panel<geometry.panels;panel++)
        {
            out += "<section class=\"liron-surface-side liron-surface-hd20-panel\" data-panel=\""+panel+"\" style=\"flex:0 0 auto;margin:0\">"+
                "<div class=\"liron-surface-side-title\" style=\"text-align:center;font-size:11px;line-height:12px;padding:0 0 2px 30px\">"+deviceToolHD20SurfaceRangeLabel(page,panel)+"</div>"+
                "<div class=\"liron-surface-grid\" style=\"display:grid;grid-template-columns:30px repeat(16,10px);grid-template-rows:repeat(64,10px);gap:0;overflow:hidden\">";
            for(var row=0;row<geometry.rowsPerPanel;row++)
            {
                var rowLabel=(row%8===0) ? ((row*8)+"K") : "";
                out += "<span class=\"liron-surface-track\" data-row-label=\""+row+"\" style=\"display:flex;align-items:center;justify-content:flex-end;height:10px;padding-right:4px;box-sizing:border-box;color:#aaa;font-family:Courier;font-size:9px\">"+rowLabel+"</span>";
                for(var column=0;column<geometry.columnsPerPanel;column++)
                {
                    var block=device.surfaceCellToBlock(page,panel,row,column);
                    var offset=block*geometry.bytesPerBlock;
                    var density=deviceToolSurfaceDensity(image,block);
                    var isHead=!!(head && head.block===block);
                    var bandStart=row>0 && row%8===0;
                    var tip="Block "+block+" · 512 bytes · offset "+offset+" · nonzero="+density.nonzero+"/512 · avg="+density.avg;
                    out += "<span class=\"liron-surface-cell active"+(isHead?" liron-surface-head":"")+"\" style=\""+
                        deviceToolSurfaceDensityCellStyle(density.pct,true)+(bandStart?"border-top-width:2px;":"")+(isHead?"outline:2px solid #FFF;outline-offset:-1px;":"")+
                        "\" data-surface-cell=\"1\" data-active=\"1\" data-density=\""+density.pct+"\" data-page=\""+page+"\" data-panel=\""+panel+"\" data-row=\""+row+"\" data-column=\""+column+
                        "\" data-block=\""+block+"\" data-offset=\""+offset+"\" data-head=\""+(isHead?"1":"0")+"\" title=\""+deviceToolSurfaceEscape(tip)+"\"></span>";
                }
            }
            out += "</div></section>";
        }
        return out+"</div>"+meta;
    }

    function deviceToolHD20SurfaceMapUpdate(device,text)
    {
        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        if(deviceSurfaceMapSyncEnabled && head && Number(head.page)!==Number(deviceSurfaceMapState.page))
        {
            deviceSurfaceMapState.page=Number(head.page);
            text.innerHTML=liron.deviceToolSurfaceMapHTML(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
            return true;
        }
        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var cells=typeof(text.querySelectorAll)==="function" ? text.querySelectorAll('[data-surface-cell="1"][data-active="1"]') : [];
        for(var i=0;i<cells.length;i++)
        {
            var cell=cells[i];
            var block=Number(cell.dataset ? cell.dataset.block : cell.getAttribute("data-block"));
            var density=deviceToolSurfaceDensity(image,block);
            cell.style.backgroundColor=deviceToolSurfaceDensityPalette()[density.pct];
            if(cell.dataset) cell.dataset.density=String(density.pct);
            cell.style.outline=""; cell.style.outlineOffset="";
            if(cell.classList) cell.classList.remove("liron-surface-head");
            if(cell.dataset) cell.dataset.head="0";
        }
        if(head && Number(head.page)===Number(deviceSurfaceMapState.page) && typeof(text.querySelector)==="function")
        {
            var headCell=text.querySelector('[data-surface-cell="1"][data-block="'+head.block+'"]');
            if(headCell)
            {
                headCell.style.outline="2px solid #FFF"; headCell.style.outlineOffset="-1px";
                if(headCell.classList) headCell.classList.add("liron-surface-head");
                if(headCell.dataset) headCell.dataset.head="1";
            }
        }
        return true;
    }

    this.deviceToolSurfaceMapSetPage = function(page,unit,expectedHash)
    {
        if(unit!==undefined && expectedHash!==undefined)
        {
            unit=Number(unit); expectedHash=Number(expectedHash);
            if(!deviceToolSurfaceTarget(unit,expectedHash)) return false;
            deviceSurfaceMapState.unit=unit; deviceSurfaceMapState.hash=expectedHash;
        }
        var device=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        if(!device || device.id?.DCODE!=="HD20") return false;
        var geometry=device.getSurfaceMapGeometry();
        page=Math.max(0,Math.min(geometry.pageCount-1,Math.floor(Number(page)||0)));
        deviceSurfaceMapState.page=page;
        if(typeof(document)!=="undefined" && document.getElementById)
        {
            var popup=document.getElementById("lironSurfaceMap_popup");
            if(popup && popup.hidden===false) liron.deviceToolSurfaceMapRefresh();
        }
        return page;
    };

    this.deviceToolSurfaceMapFollowHead = function()
    {
        var device=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        if(!device || device.id?.DCODE!=="HD20" || typeof(device.getHeadSurfacePosition)!=="function") return false;
        var head=device.getHeadSurfacePosition();
        if(!head) return deviceSurfaceMapState.page;
        deviceSurfaceMapState.page=Number(head.page);
        if(typeof(document)!=="undefined" && document.getElementById)
        {
            var popup=document.getElementById("lironSurfaceMap_popup");
            if(popup && popup.hidden===false) liron.deviceToolSurfaceMapRefresh();
        }
        return deviceSurfaceMapState.page;
    };

    this.deviceToolSurfaceMapHTML = function(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        var device=deviceToolSurfaceTarget(unit,expectedHash);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        var iconClass=deviceSurfaceMapSyncEnabled ? "fa-stop-circle" : "fa-sync-alt";
        var syncOnClick=Number.isInteger(slotN)
            ? "apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggleSync();event.stopPropagation();"
            : "event.stopPropagation();";
        var header="<div class=\"liron-surface-header\" style=\"display:flex;align-items:center;gap:6px;margin:0 0 4px 0\">"+
            "<button class=\"appbut\" type=\"button\" style=\"text-align:center\" title=\"Disk surface map sync\" onclick=\""+syncOnClick+"\">"+
            "<i class=\"fa "+iconClass+"\" id=\"lironSurfaceMap_monitoring\"></i></button>"+
            "<div class=\"liron-surface-title\"><b>Disk surface map</b></div>"+
            "</div>";

        if(!device)
            return header+"<div class=\"liron-surface-status\">Device instance is no longer attached.</div>";

        if(device.id?.DCODE==="HD20")
            return deviceToolHD20SurfaceMapHTML(device,header);

        var instance=deviceToolInstanceHex(device) || "????";
        var state=typeof(device.getState)==="function" ? device.getState() || {} : {};
        var meta="<div class=\"liron-surface-meta\" style=\"font-size:10px;color:#888;margin-top:4px;line-height:12px\">"+
            "Instance #"+instance+" · 800 KB · 1600 × 512-byte sectors"+
            "</div>";

        if(!state.mediaLoaded)
            return header+"<div class=\"liron-surface-status\">No media loaded.</div>"+meta;

        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        var out=header+"<div class=\"liron-surface-panels\" style=\"display:inline-flex;align-items:flex-start;gap:8px;width:max-content\">";

        for(var side=0;side<2;side++)
        {
            out += "<section class=\"liron-surface-side\" data-side=\""+side+"\" style=\"flex:0 0 auto;margin:0\">"+
                "<div class=\"liron-surface-side-title\" style=\"text-align:center;font-size:11px;line-height:12px;padding:0 0 2px 22px\">Side "+side+"</div>"+
                "<div class=\"liron-surface-grid\" style=\"display:grid;grid-template-columns:22px repeat(12,10px);grid-template-rows:repeat(80,10px);gap:0;overflow:hidden\">";

            for(var track=0;track<80;track++)
            {
                out += "<span class=\"liron-surface-track\" data-track-label=\""+track+"\" style=\"display:flex;align-items:center;justify-content:flex-end;height:10px;padding-right:4px;box-sizing:border-box;color:#aaa;font-family:Courier;font-size:9px\">T"+track+"</span>";
                for(var sector=11;sector>=0;sector--)
                {
                    var count=device.getSurfaceTrackSectorCount(track);
                    var active=sector<count;
                    if(active)
                    {
                        var block=device.surfaceSectorToBlock(side,track,sector);
                        var offset=block*512;
                        var density=deviceToolSurfaceDensity(image,block);
                        var isHead=!!(head && head.side===side && head.track===track && head.sector===sector);
                        var tip="Side "+side+" · Track "+track+" · Sector "+sector+" · Block "+block+" · 512 bytes · nonzero="+density.nonzero+"/512 · avg="+density.avg;
                        out += "<span class=\"liron-surface-cell active"+(isHead?" liron-surface-head":"")+"\" style=\""+
                            deviceToolSurfaceDensityCellStyle(density.pct,true)+(isHead?"outline:2px solid #FFF;outline-offset:-1px;":"")+
                            "\" data-surface-cell=\"1\" data-active=\"1\" data-density=\""+density.pct+"\" data-side=\""+side+"\" data-track=\""+track+"\" data-sector=\""+sector+
                            "\" data-block=\""+block+"\" data-offset=\""+offset+"\" data-head=\""+(isHead?"1":"0")+"\" title=\""+deviceToolSurfaceEscape(tip)+"\"></span>";
                    }
                    else
                    {
                        out += "<span class=\"liron-surface-cell inactive\" style=\""+deviceToolSurfaceDensityCellStyle(0,false)+
                            "\" data-surface-cell=\"1\" data-active=\"0\" data-side=\""+side+"\" data-track=\""+track+"\" data-sector=\""+sector+
                            "\" title=\"Side "+side+" · Track "+track+" · Sector "+sector+" · not present\"></span>";
                    }
                }
            }
            out += "</div></section>";
        }
        return out+"</div>"+meta;
    };

    this.deviceToolSurfaceMapUpdate = function()
    {
        if(typeof(document)==="undefined" || !document.getElementById) return false;
        if(!Number.isInteger(deviceSurfaceMapState.unit) || !Number.isInteger(deviceSurfaceMapState.hash)) return false;

        var device=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        var popup=document.getElementById("lironSurfaceMap_popup");
        var text=document.getElementById("lironSurfaceMap_popup_text");
        if(!device || !popup || !text || popup.hidden!==false) return false;

        var state=typeof(device.getState)==="function" ? device.getState() || {} : {};
        if(!state.mediaLoaded) return false;

        if(device.id?.DCODE==="HD20")
            return deviceToolHD20SurfaceMapUpdate(device,text);

        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var cells=typeof(text.querySelectorAll)==="function"
            ? text.querySelectorAll('[data-surface-cell="1"][data-active="1"]')
            : [];

        for(var i=0;i<cells.length;i++)
        {
            var cell=cells[i];
            var block=Number(cell.dataset ? cell.dataset.block : cell.getAttribute("data-block"));
            var density=deviceToolSurfaceDensity(image,block);
            cell.style.backgroundColor=deviceToolSurfaceDensityPalette()[density.pct];
            if(cell.dataset) cell.dataset.density=String(density.pct);
            cell.style.outline="";
            cell.style.outlineOffset="";
            if(cell.classList) cell.classList.remove("liron-surface-head");
            if(cell.dataset) cell.dataset.head="0";
        }

        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        if(head && typeof(text.querySelector)==="function")
        {
            var selector='[data-surface-cell="1"][data-side="'+head.side+'"][data-track="'+head.track+'"][data-sector="'+head.sector+'"]';
            var headCell=text.querySelector(selector);
            if(headCell)
            {
                headCell.style.outline="2px solid #FFF";
                headCell.style.outlineOffset="-1px";
                if(headCell.classList) headCell.classList.add("liron-surface-head");
                if(headCell.dataset) headCell.dataset.head="1";
            }
        }
        return true;
    };

    this.deviceToolSurfaceMapToggleSync = function(force)
    {
        deviceSurfaceMapSyncEnabled = force===undefined ? !deviceSurfaceMapSyncEnabled : !!force;

        if(typeof(document)!=="undefined" && document.getElementById)
        {
            var icon=document.getElementById("lironSurfaceMap_monitoring");
            if(icon) icon.className="fa "+(deviceSurfaceMapSyncEnabled ? "fa-stop-circle" : "fa-sync-alt");
        }

        return deviceSurfaceMapSyncEnabled;
    };

    // Invoked by the shared surface-map dashboard refresh event used by Disk II.
    this.deviceToolSurfaceMapMonitoring = function()
    {
        if(!deviceSurfaceMapSyncEnabled || typeof(document)==="undefined" || !document.getElementById)
            return false;

        var popup=document.getElementById("lironSurfaceMap_popup");
        if(!popup || popup.hidden!==false) return false;

        return liron.deviceToolSurfaceMapUpdate();
    };

    this.deviceToolSurfaceMapPosition = function(unit)
    {
        if(typeof(document)==="undefined" || !document.getElementById || typeof(window)==="undefined") return false;
        var popup=document.getElementById("lironSurfaceMap_popup");
        if(!popup) return false;

        var anchorRect=null;
        var toolboxes=typeof(document.querySelectorAll)==="function"
            ? document.querySelectorAll(".toolbox")
            : [];

        for(var i=0;i<toolboxes.length;i++)
        {
            var toolbox=toolboxes[i];
            if(!toolbox || toolbox.hidden || typeof(toolbox.getBoundingClientRect)!=="function") continue;

            var style=typeof(window.getComputedStyle)==="function"
                ? window.getComputedStyle(toolbox)
                : null;
            if(style && (style.display==="none" || style.visibility==="hidden")) continue;

            var rect=toolbox.getBoundingClientRect();
            if(!rect || rect.width<=0 || rect.height<=0) continue;
            if(!anchorRect || rect.right>anchorRect.right) anchorRect=rect;
        }

        // Fallback to this device's own toolbox if generic discovery is unavailable.
        if(!anchorRect)
        {
            var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
            var io=typeof(apple2plus)==="object" && apple2plus ? apple2plus.hwObj().io : null;
            var slotID=Number.isInteger(slotN) && io && typeof(io.slot2ID)==="function"
                ? String(io.slot2ID(slotN))
                : (Number.isInteger(slotN) ? String(slotN-1) : "?");
            var surface=document.getElementById("liron_unit_"+slotID+"_"+Number(unit)+"_surface");
            var anchor=surface && typeof(surface.closest)==="function"
                ? surface.closest(".toolbox")
                : null;
            if(anchor && typeof(anchor.getBoundingClientRect)==="function")
                anchorRect=anchor.getBoundingClientRect();
        }

        var scrollX=Number(window.scrollX)||0;
        var scrollY=Number(window.scrollY)||0;
        var viewportLeft=anchorRect ? Math.round(anchorRect.right)+5 : 8;
        var viewportTop=anchorRect ? Math.max(8,Math.round(anchorRect.top)) : 8;
        var left=viewportLeft+scrollX;
        var top=viewportTop+scrollY;
        var available=Math.max(120,Math.floor(window.innerWidth-viewportLeft-8));

        popup.style.position="absolute";
        popup.style.left=left+"px";
        popup.style.right="auto";
        popup.style.top=top+"px";
        var surfaceDevice=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        var desiredWidth=surfaceDevice && surfaceDevice.id?.DCODE==="HD20" ? 414 : 326;
        popup.style.width=Math.min(desiredWidth,available)+"px";
        popup.style.maxWidth=available+"px";
        popup.style.maxHeight="calc(100vh - "+(viewportTop+8)+"px)";
        popup.style.overflow="auto";
        popup.style.padding="5px";
        popup.style.margin="0";
        popup.style.zIndex="30";
        return true;
    };

    this.deviceToolSurfaceMapRefresh = function()
    {
        if(!Number.isInteger(deviceSurfaceMapState.unit) || !Number.isInteger(deviceSurfaceMapState.hash)) return false;
        if(typeof(document)==="undefined" || !document.getElementById) return false;
        var popup=document.getElementById("lironSurfaceMap_popup");
        var text=document.getElementById("lironSurfaceMap_popup_text");
        if(!popup || !text) return false;
        text.innerHTML=liron.deviceToolSurfaceMapHTML(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        return true;
    };

    this.deviceToolSurfaceMapToggle = function(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(expectedHash)) return false;
        if(typeof(document)==="undefined" || !document.getElementById) return false;

        var popup=document.getElementById("lironSurfaceMap_popup");
        if(!popup) return false;

        var opening=popup.hidden!==false;
        if(opening)
        {
            var targetChanged=deviceSurfaceMapState.unit!==unit || deviceSurfaceMapState.hash!==expectedHash;
            deviceSurfaceMapState.unit=unit;
            deviceSurfaceMapState.hash=expectedHash;
            if(targetChanged) deviceSurfaceMapState.page=0;
            if(!liron.deviceToolSurfaceMapRefresh()) return false;
            liron.deviceToolSurfaceMapPosition(unit);
        }

        if(typeof(oCOM)==="object" && oCOM && oCOM.POPUP && typeof(oCOM.POPUP.toggle)==="function")
            oCOM.POPUP.toggle("lironSurfaceMap_popup");
        else
            popup.hidden=!popup.hidden;

        if(popup.hidden===false)
            return true;

        liron.deviceToolSurfaceMapToggleSync(false);
        return false;
    };

    this.deviceToolSurfaceMap = function(unit,expectedHash)
    {
        unit=Number(unit); expectedHash=Number(expectedHash);
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(expectedHash)) return false;
        var targetChanged=deviceSurfaceMapState.unit!==unit || deviceSurfaceMapState.hash!==expectedHash;
        deviceSurfaceMapState.unit=unit;
        deviceSurfaceMapState.hash=expectedHash;
        if(targetChanged) deviceSurfaceMapState.page=0;
        if(!liron.deviceToolSurfaceMapRefresh()) return false;
        var popup=document.getElementById("lironSurfaceMap_popup");
        if(typeof(oCOM)==="object" && oCOM && oCOM.POPUP && typeof(oCOM.POPUP.on)==="function") oCOM.POPUP.on("lironSurfaceMap_popup");
        else popup.hidden=false;
        liron.deviceToolSurfaceMapPosition(unit);
        return true;
    };

    this.deviceToolSlotHTML = function(ctx)
    {
        ctx = ctx || {};
        var slotN = Number(ctx.slotN);
        var slotID = ctx.slotID==null ? "?" : String(ctx.slotID);
        var toolboxID = ctx.toolboxID || ("device_tool_"+slotID);
        var devices = Array.isArray(ctx.devices)
            ? ctx.devices.slice()
            : (Array.isArray(liron.devices) ? liron.devices.slice() : []);

        function unitOf(device,index)
        {
            var unit = device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
            return Number.isInteger(unit) && unit>0 ? unit : index+1;
        }

        devices.sort(function(a,b)
        {
            return unitOf(a,0)-unitOf(b,0);
        });

        var rows="";
        for(var i=0;i<devices.length;i++)
        {
            var device=devices[i];
            if(!device) continue;
            var unit=unitOf(device,i);
            var controlID="liron_unit_"+slotID+"_"+unit;

            var deviceCode=String(device.id?.DCODE || "SMARTPORT");
            var hardDisk=deviceCode==="HD20";
            var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
            var deviceState=typeof(device.getState)==="function" ? device.getState() || {} : {};
            var downloadable=exportable && (hardDisk || !!deviceState.mediaLoaded);
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : undefined;
            var supportsSurfaceMap=(deviceCode==="UNIDISK" || deviceCode==="HD20") && typeof(device.getSurfaceMapGeometry)==="function";
            var instanceHash=Number(device.attach?.hash);
            var instanceHex=deviceToolInstanceHex(device);

            rows += EMU_deviceMediaRowHTML({
                 "label":deviceCode+" Unit"+unit
                ,"buttonID":controlID+"_but"
                ,"formID":controlID+"_form"
                ,"fileID":controlID+"_file"
                ,"downloadID":controlID+"_dump"
                ,"fileName":deviceCode+"_"+unit
                ,"fileDisplayName":hardDisk ? logicalFilename : undefined
                ,"buttonTitle":(instanceHex ? ("Instance #"+instanceHex+": ") : ("Unit"+unit+": "))+(hardDisk ? "erase/reset disk" : "eject disk")
                ,"buttonOnClick":"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolEject("+unit+")"
                ,"fileAccept":".po"
                ,"fileOnChange":"javascript:EMU_audio_event_unlock();apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolLoadFile(this,"+unit+")"
                ,"downloadDisabled":!downloadable
                ,"downloadOnClick":downloadable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : undefined
                ,"downloadTitle":downloadable ? ("Save "+logicalFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")
                ,"capabilityActions":supportsSurfaceMap ? [{"id":controlID+"_surface","icon":"fa fa-th","title":deviceState.mediaLoaded ? "Disk Surface Map" : "Disk Surface Map (no media loaded)","onClick":deviceState.mediaLoaded ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggle("+unit+","+instanceHash+")") : undefined,"disabled":!deviceState.mediaLoaded}] : []
            });
        }

        if(!rows)
            rows="<div style=\"padding:5px 2px\">No SmartPort devices attached.</div>";

        return ""
            + "<div class=toolbox id=\""+toolboxID+"\" hidden>"
            + " <div class=appbox style=\"box-sizing:border-box;text-align:left;min-height:63px;padding:0px 6px 0px 6px;\">"
            + rows
            + " </div>"
            + "</div>";
    };

    this.onDeviceTopologyChanged = function(change)
    {
        // Device attachment is a live hardware reconfiguration.  Do not
        // reboot the emulated Apple II: a user may be deliberately changing
        // SmartPort ordering (for example replacing Unit 1 with an HD20).
        // Software such as ProDOS can rediscover the topology on the next
        // explicit boot/reset chosen by the user.
        if(bDebug) console.log("Liron SmartPort topology changed",change || {});
        return true;
    };

    this.reset = function() { iwm.reset(); };
    this.restart = function() { iwm.restart(); };
    this.getIWM = function() { return iwm; };
    this.getBus = function() { return smartport; };
    this.setDebug = function(value) { return smartport.setDebug(value); };
    this.getDebug = function() { return smartport.getDebug(); };
    this.getUniDisk = function(unit)
    {
        if(unit!==undefined && unit!==null && unit!=="")
        {
            unit=Number(unit);
            if(!Number.isInteger(unit) || unit<1 || unit>8) return null;
            var exact=smartport.getDevice(unit);
            return exact && exact.id?.DCODE==="UNIDISK" ? exact : null;
        }

        var units=smartport.getUnits();
        for(var i=0;i<units.length;i++)
        {
            var device=smartport.getDevice(units[i]);
            if(device && device.id?.DCODE==="UNIDISK") return device;
        }
        return null;
    };

    this.getHD20 = function(unit)
    {
        if(unit!==undefined && unit!==null && unit!=="")
        {
            unit=Number(unit);
            if(!Number.isInteger(unit) || unit<1 || unit>8) return null;
            var device=smartport.getDevice(unit);
            return device?.id?.DCODE==="HD20" ? device : null;
        }

        var units=smartport.getUnits();
        for(var i=0;i<units.length;i++)
        {
            var device=smartport.getDevice(units[i]);
            if(device?.id?.DCODE==="HD20") return device;
        }
        return null;
    };
    this.getROM = function() { return LIRON_ROM; };
}
