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

    this.reset = function() {};
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
        return device;
    };
    this.detach = function(device)
    {
        var i = devices.indexOf(device);
        if(i<0) return device;

        var unit=findUnit(device);
        if(unit) units[unit]=null;
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
    this.readSense = function(lines,ctx) { return 0; };
    this.readData = function(lines,ctx) { return 0xFF; };
    this.writeData = function(value,lines,ctx) { return value & 0xFF; };
    this.getState = function() { return {"deviceCount":devices.length,"units":this.getUnits()}; };
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

    function touchState(reg)
    {
        reg = Number(reg)&0x0F;
        var mask = 1<<(reg>>1);
        if(reg&1) state.lines |= mask;
        else state.lines &= ~mask;
        state.lines &= 0xFF;
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
        reg = touchState(reg);
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
        reg = touchState(reg);
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
