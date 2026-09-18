// 2026 Apple UniDisk 3.5 Interface Controller (Liron) foundation for RetroAppleJS.
//
// EMU_CARD_LIRON.js
//
// This first implementation slice deliberately contains only the reusable
// SmartPort-bus endpoint and the Integrated Woz Machine (IWM) state machine.
// The Apple II slot-card/ROM mapper and UniDisk 3.5 device are layered on top
// in subsequent steps.
//
// IWM state-register model
// ------------------------
// The 16 Apple II slot-I/O addresses do not represent 16 independent IWM
// registers.  They clear/set eight state-register bits:
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
// Even addresses clear the selected bit; odd addresses set it.  Q6/Q7 select
// the data/status/handshake/mode-write functions.  Register reads are made on
// even addresses; register writes are made on odd addresses while Q6 and Q7
// are both high.


function SmartPortBus()
{
    var devices = [];

    this.reset = function()
    {
        // Packet/line state will live here when the SmartPort transport is
        // implemented.  Attached physical devices survive an IWM reset.
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

    /*
     * Empty-chain electrical defaults.  These become real SmartPort line
     * semantics later, without changing the LironIWM interface.
     */
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

        // I = SENSE input, bit 6 reserved, E = drive enabled,
        // bits 4..0 mirror the low five mode-register bits.
        var enabled = (state.lines & MOTOR) ? 0x20 : 0x00;
        return (sense | enabled | (state.mode & 0x1F)) & 0xFF;
    }

    function readHandshake()
    {
        // B = register ready, U = no underrun, bits 5..0 are reserved ones.
        var value = 0x3F;
        if(state.writeReady) value |= 0x80;
        if(!state.underrun) value |= 0x40;
        return value & 0xFF;
    }

    function writeMode(value,ctx)
    {
        // Only S,C,M,H,L (bits 4..0) are represented by the IWM mode register
        // exposed through STATUS.  Reserved upper bits are not retained.
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

        /*
         * IWM register reads are defined on even addresses.  Odd reads still
         * update the selected state bit, but do not produce a register read.
         */
        if(reg & 1) return undefined;

        switch(selectedRegister())
        {
            case "ALLONES":   return 0xFF;
            case "DATA":      return readData(ctx);
            case "STATUS":    return readStatus(ctx);
            case "HANDSHAKE": return readHandshake();

            // Q6=Q7=1 is a write selection.  Keep reads deterministic while
            // avoiding invention of a non-existent readable register.
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

        /*
         * IWM writes use odd addresses.  If Q6 and Q7 are high after the
         * state-register transition, MOTOR chooses the destination:
         *
         *   MOTOR=0 -> MODE register
         *   MOTOR=1 -> DATA register
         */
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

    /*
     * These setters are the future timing/transport boundary.  The SmartPort
     * implementation can drive the write-buffer state without reaching into
     * the IWM's private state object.
     */
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
