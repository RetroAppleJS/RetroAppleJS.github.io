// 2026 Apple UniDisk 3.5 Interface Controller (Liron) for RetroAppleJS.
//
// EMU_CARD_LIRON.js
//
// Foundation implemented here:
//   - authoritative 4 KiB Liron firmware image
//   - slot-dependent $Cn00-$CnFF firmware page
//   - shared $C800-$CFFF expansion-ROM ownership/release behavior
//   - all $C0n0-$C0nF accesses delegated to the IWM state machine
//   - empty SmartPort bus boundary for a later UniDisk 3.5 device
//
// ROM source:
//   POM2 roms/liron.rom, Git blob a7e7b6283f029834793e767b48dee866e23d0ff8
//   size 4096 bytes, CRC32 974253FD
//
// IWM state-register model
// ------------------------
// The 16 Apple II slot-I/O addresses clear/set eight state-register bits:
//
//   local $0/$1   PHASE0 low/high
//   local $2/$3   PHASE1 low/high
//   local $4/$5   PHASE2 low/high
//   local $6/$7   PHASE3 low/high
//   local $8/$9   MOTOR  off/on
//   local $A/$B   DRIVE  0/1
//   local $C/$D   Q6     low/high
//   local $E/$F   Q7     low/high
//
// Even addresses clear the selected bit; odd addresses set it. Q6/Q7 select
// DATA/STATUS/HANDSHAKE/MODE-or-write-DATA functions.


const LIRON_ROM_B64 = `
xuny7ffh8uWg9/Lp9PTl7qDi+aDN6ePo4eXsoMHz6+nu8wD////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
/////////////////////////////6IgogCiA8kAsAo4sAEYogF+eAQYosGO+AeiAa3/z0zhy6AApUtI0ANMuMGt
nMAQ+4VZSkpKKQ+qpVkpB4VZrZzAEPtdJ8qRVkVAhUDI0ALmV62cwBD7XTfKkVZFQIVAyK2c
wBD7XUfKkVZFQIVAyK2cwBD7XVfKkVZFQIVAyNAC5lemWa2cwBD7XTfKkVZFQIVAyK2cwBD7
XUfKkVZFQIVAyK2cwBD7XVfKkVZFQIVAyMZL8ANMK8GtnMAQ+4VZaIVLrZzAEPs4KiVZRUCs
nMAQ+8DI0BymTPAIoABRVMjK0Pqq0BGtncCtnsAw+62QwBhgqSDQAqkQOGD/AAAAvwqiIKIA
ogPJALAKOLABGKICfngEGKLCjvgHogKt/89M4cugAKVLSNADTLjCrazAEPuFWUpKSikPqqVZ
KQeFWa2swBD7XSfKkVZFQIVAyNAC5letrMAQ+103ypFWRUCFQMitrMAQ+11HypFWRUCFQMit
rMAQ+11XypFWRUCFQMjQAuZXplmtrMAQ+103ypFWRUCFQMitrMAQ+11HypFWRUCFQMitrMAQ
+11XypFWRUCFQMjGS/ADTCvCrazAEPuFWWiFS62swBD7OColWUVArKzAEPvAyNAcpkzwCKAA
UVTIytD6qtARra3Ara7AMPutoMAYYKkg0AKpEDhg/wAAAL8KoiCiAKIDyQCwCjiwARiiA354
BBiiw474B6IDrf/PTOHLoAClS0jQA0y4w628wBD7hVlKSkopD6qlWSkHhVmtvMAQ+10nypFW
RUCFQMjQAuZXrbzAEPtdN8qRVkVAhUDIrbzAEPtdR8qRVkVAhUDIrbzAEPtdV8qRVkVAhUDI
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
AP////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////qMOpoLG5uLWgwfDw7OWgw+/t8PX05fKsoMnu466gzdPB
ABD//w==
`;


function decodeLironBase64(text)
{
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    text = String(text).replace(/[^A-Za-z0-9+/=]/g,"");

    var padding = 0;
    if(text.slice(-2)=="==") padding = 2;
    else if(text.slice(-1)=="=") padding = 1;

    if((text.length & 3)!==0)
        throw new Error("Invalid Liron ROM base64 length");

    var out = new Uint8Array((text.length/4)*3-padding);
    var p = 0;

    for(var i=0;i<text.length;i+=4)
    {
        var c0 = alphabet.indexOf(text[i]);
        var c1 = alphabet.indexOf(text[i+1]);
        var c2 = text[i+2]=="=" ? 0 : alphabet.indexOf(text[i+2]);
        var c3 = text[i+3]=="=" ? 0 : alphabet.indexOf(text[i+3]);

        if(c0<0 || c1<0 || c2<0 || c3<0)
            throw new Error("Invalid character in Liron ROM base64");

        var n = (c0<<18) | (c1<<12) | (c2<<6) | c3;

        if(p<out.length) out[p++] = (n>>16)&0xFF;
        if(p<out.length) out[p++] = (n>>8)&0xFF;
        if(p<out.length) out[p++] = n&0xFF;
    }

    return out;
}


const LIRON_ROM = decodeLironBase64(LIRON_ROM_B64);

if(LIRON_ROM.length!==4096)
    throw new Error("Liron ROM must be exactly 4096 bytes");


function SmartPortBus()
{
    var devices = [];

    this.reset = function()
    {
        // Packet/line state will live here when the SmartPort transport is
        // implemented. Attached physical devices survive an IWM reset.
    };

    this.attach = function(device)
    {
        if(device!=null && devices.indexOf(device)<0)
            devices.push(device);
        return device;
    };

    this.detach = function(device)
    {
        var i = devices.indexOf(device);
        if(i>=0) devices.splice(i,1);
        return device;
    };

    this.hasDevices = function()
    {
        return devices.length>0;
    };

    this.readSense = function(lines,ctx)
    {
        return 0;
    };

    this.readData = function(lines,ctx)
    {
        return 0xFF;
    };

    this.writeData = function(value,lines,ctx)
    {
        return value & 0xFF;
    };

    this.getState = function()
    {
        return {"deviceCount":devices.length};
    };
}


function LironIWM(bus)
{
    const PHASE0 = 0x01;
    const PHASE1 = 0x02;
    const PHASE2 = 0x04;
    const PHASE3 = 0x08;
    const MOTOR  = 0x10;
    const DRIVE  = 0x20;
    const Q6     = 0x40;
    const Q7     = 0x80;

    bus = bus || new SmartPortBus();

    var state =
    {
         "lines":0x00
        ,"mode":0x00
        ,"readData":0xFF
        ,"writeData":0x00
        ,"writeReady":true
        ,"underrun":false
    };

    function normalizeRegister(reg)
    {
        return Number(reg) & 0x0F;
    }

    function touchState(reg)
    {
        reg = normalizeRegister(reg);

        var bit  = reg >> 1;
        var mask = 1 << bit;

        if(reg & 1)
            state.lines |= mask;
        else
            state.lines &= ~mask;

        state.lines &= 0xFF;
        return reg;
    }

    function selectedRegister()
    {
        var q6    = (state.lines & Q6)!==0;
        var q7    = (state.lines & Q7)!==0;
        var motor = (state.lines & MOTOR)!==0;

        if(!q7 && !q6) return motor ? "DATA" : "ALLONES";
        if(!q7 &&  q6) return "STATUS";
        if( q7 && !q6) return "HANDSHAKE";
        return motor ? "WRITEDATA" : "MODE";
    }

    function readData(ctx)
    {
        if(bus && typeof(bus.readData)=="function")
        {
            var value = bus.readData(state.lines,ctx);
            if(value!==undefined && value!==null)
                state.readData = Number(value) & 0xFF;
        }
        return state.readData & 0xFF;
    }

    function readStatus(ctx)
    {
        var sense = 0;
        if(bus && typeof(bus.readSense)=="function")
            sense = bus.readSense(state.lines,ctx) ? 0x80 : 0x00;

        var enabled = (state.lines & MOTOR) ? 0x20 : 0x00;
        return (sense | enabled | (state.mode & 0x1F)) & 0xFF;
    }

    function readHandshake()
    {
        var value = 0x3F;
        if(state.writeReady) value |= 0x80;
        if(!state.underrun) value |= 0x40;
        return value & 0xFF;
    }

    function writeMode(value,ctx)
    {
        state.mode = Number(value) & 0x1F;

        if(bus && typeof(bus.writeMode)=="function")
            bus.writeMode(state.mode,state.lines,ctx);
    }

    function writeData(value,ctx)
    {
        state.writeData = Number(value) & 0xFF;

        if(bus && typeof(bus.writeData)=="function")
            bus.writeData(state.writeData,state.lines,ctx);
    }

    this.read = function(reg,ctx)
    {
        reg = touchState(reg);

        if(reg & 1) return undefined;

        switch(selectedRegister())
        {
            case "ALLONES":   return 0xFF;
            case "DATA":      return readData(ctx);
            case "STATUS":    return readStatus(ctx);
            case "HANDSHAKE": return readHandshake();

            case "MODE":
            case "WRITEDATA":
            default:
                return 0xFF;
        }
    };

    this.write = function(reg,value,ctx)
    {
        reg = touchState(reg);
        value = Number(value) & 0xFF;

        if(!(reg & 1)) return undefined;
        if((state.lines & (Q6|Q7)) !== (Q6|Q7)) return undefined;

        if(state.lines & MOTOR)
            writeData(value,ctx);
        else
            writeMode(value,ctx);

        return undefined;
    };

    this.reset = function()
    {
        state.lines      = 0x00;
        state.mode       = 0x00;
        state.readData   = 0xFF;
        state.writeData  = 0x00;
        state.writeReady = true;
        state.underrun   = false;

        if(bus && typeof(bus.reset)=="function")
            bus.reset();
    };

    this.restart = function()
    {
        this.reset();
    };

    this.setWriteReady = function(value)
    {
        state.writeReady = !!value;
    };

    this.setUnderrun = function(value)
    {
        state.underrun = !!value;
    };

    this.setReadData = function(value)
    {
        state.readData = Number(value) & 0xFF;
    };

    this.getState = function()
    {
        return {
             "lines":state.lines & 0xFF
            ,"phase0":!!(state.lines & PHASE0)
            ,"phase1":!!(state.lines & PHASE1)
            ,"phase2":!!(state.lines & PHASE2)
            ,"phase3":!!(state.lines & PHASE3)
            ,"motor": !!(state.lines & MOTOR)
            ,"drive": !!(state.lines & DRIVE)
            ,"q6":    !!(state.lines & Q6)
            ,"q7":    !!(state.lines & Q7)
            ,"mode":state.mode & 0x1F
            ,"readData":state.readData & 0xFF
            ,"writeData":state.writeData & 0xFF
            ,"writeReady":!!state.writeReady
            ,"underrun":!!state.underrun
            ,"selectedRegister":selectedRegister()
        };
    };

    this.getBus = function()
    {
        return bus;
    };

    this.reset();
}


// Discovery container. Apple2IO mounts a separate live instance.
if(typeof(oEMU)==="undefined")
    var oEMU = {"component":{"IO":{}}};
else
{
    if(!oEMU.component) oEMU.component = {};
    if(!oEMU.component.IO) oEMU.component.IO = {};
}

oEMU.component.IO.AppleLiron = new AppleLiron();


function AppleLiron()
{
    const bDebug = false;

    this.id = {"PCODE":"LIRON","icon":"fa fa-save"};
    this.deviceConfig = [];
    this.state = {"active":true};

    var liron = this;
    var smartport = new SmartPortBus();
    var iwm = new LironIWM(smartport);

    this.action =
    {
        "SlotIO":
        {
            "RD":{"callback":function(addr,ctx)
            {
                return liron.readSlotIO(addr,ctx);
            }},
            "WR":{"callback":function(addr,d8,ctx)
            {
                return liron.writeSlotIO(addr,d8,ctx);
            }}
        },
        "SlotROM":
        {
            "RD":{"callback":function(addr,ctx)
            {
                return liron.readROM(addr,ctx);
            }}
        },
        "HostROM":
        {
            "RD":{"callback":function(addr,ctx)
            {
                return liron.readHostROM(addr,ctx);
            }},
            "WR":{"callback":function(addr,d8,ctx)
            {
                return liron.writeHostROM(addr,d8,ctx);
            }}
        }
    };

    function physicalSlot()
    {
        if(!liron.mount) return null;

        var slot = Number(liron.mount.slotN)-1;
        if(!Number.isInteger(slot) || slot<1 || slot>7)
            return null;

        return slot;
    }

    function ownsExpansionROM()
    {
        var slot = physicalSlot();
        if(slot===null) return false;
        if(!oEMU || !oEMU.component || !oEMU.component.IO ||
           !oEMU.component.IO.ACTION_MAP)
            return false;

        return oEMU.component.IO.ACTION_MAP.Hslot == slot;
    }

    function selectExpansionROM(ctx)
    {
        if(ctx && ctx.bRO===true) return false;

        var slot = physicalSlot();
        if(slot===null ||
           !liron.mount ||
           !liron.mount.ranges ||
           !liron.mount.ranges.HostROM)
            return false;

        var CIO = oEMU.component.IO;
        if(!CIO || !CIO.ACTION_MAP) return false;

        if(CIO.ACTION_MAP.Hslot == slot)
            return true;

        CIO.ACTION_MAP.Hslot = slot;

        var range = liron.mount.ranges.HostROM;
        for(var i=range.from;i<=range.to;i++)
            CIO.ACTION_MAP.RD[i] = liron.action.HostROM.RD.callback;

        if(bDebug)
            console.log("Liron claims $C800-$CFFF from slot "+slot);

        return true;
    }

    function releaseExpansionROM()
    {
        var slot = physicalSlot();
        if(slot===null || !oEMU.component.IO || !oEMU.component.IO.ACTION_MAP)
            return false;

        var CIO = oEMU.component.IO;
        if(CIO.ACTION_MAP.Hslot != slot)
            return false;

        CIO.ACTION_MAP.Hslot = null;
        return true;
    }

    function hostRelativeAddress(addr,ctx)
    {
        if(ctx && Number.isFinite(ctx.rel_addr))
            return ctx.rel_addr & 0x0FFF;

        if(ctx && Number.isFinite(ctx.line))
            return (ctx.line + (Number(addr)&0xFF)) & 0x0FFF;

        return 0x800 + (Number(addr)&0x07FF);
    }

    this.readSlotIO = function(addr,ctx)
    {
        return iwm.read(Number(addr)&0x0F,ctx);
    };

    this.writeSlotIO = function(addr,d8,ctx)
    {
        return iwm.write(Number(addr)&0x0F,Number(d8)&0xFF,ctx);
    };

    this.readROM = function(addr,ctx)
    {
        selectExpansionROM(ctx);

        var slot = physicalSlot();
        if(slot===null) return 0x00;

        var romAddr = (slot<<8) | (Number(addr)&0xFF);
        return LIRON_ROM[romAddr] & 0xFF;
    };

    this.readHostROM = function(addr,ctx)
    {
        var rel_addr = hostRelativeAddress(addr,ctx);

        if(!ownsExpansionROM())
            return 0x00;

        var d8 = rel_addr>=0x800 && rel_addr<=0xFFF
            ? LIRON_ROM[rel_addr]
            : 0x00;

        if(rel_addr==0x0FFF && !(ctx && ctx.bRO===true))
            releaseExpansionROM();

        return d8 & 0xFF;
    };

    this.writeHostROM = function(addr,d8,ctx)
    {
        var rel_addr = hostRelativeAddress(addr,ctx);

        if(ownsExpansionROM() && rel_addr==0x0FFF && !(ctx && ctx.bRO===true))
            releaseExpansionROM();

        return 0x00;
    };

    this.reset = function()
    {
        iwm.reset();
    };

    this.restart = function()
    {
        iwm.restart();
    };

    this.getIWM = function()
    {
        return iwm;
    };

    this.getBus = function()
    {
        return smartport;
    };

    this.getROM = function()
    {
        return LIRON_ROM;
    };
}
