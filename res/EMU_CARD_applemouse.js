//
// Copyright (c) 2021 Freddy Vandriessche
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_CARD_applemouse.js
//
// AppleMouse II Interface Card support for RetroAppleJS.
//
// This intentionally emulates the 68705 at command/handshake level rather
// than instruction level.  The real 6502 slot ROM still talks to a 6520/6821
// style PIA and therefore sees the original four-phase PB4-PB7 protocol.
//

function MousePIA6821()
{
    var ora=0, orb=0, ddra=0, ddrb=0, cra=0, crb=0;
    var inputA=0xFF, inputB=0x00;
    var portBCallback=null;

    function pinsB() { return orb&ddrb; }

    function notifyB(oldPins)
    {
        var newPins=pinsB();
        if(portBCallback && oldPins!==newPins)
            portBCallback(oldPins,newPins);
    }

    this.setPortBWriteCallback=function(fn)
    {
        portBCallback=typeof(fn)==="function" ? fn : null;
    };

    this.setInputA=function(value) { inputA=Number(value)&0xFF; };
    this.setInputB=function(value) { inputB=Number(value)&0xFF; };

    this.getOutputA=function() { return ora&0xFF; };
    this.getOutputB=function() { return orb&0xFF; };
    this.getDDRA=function() { return ddra&0xFF; };
    this.getDDRB=function() { return ddrb&0xFF; };
    this.getCRA=function() { return cra&0xFF; };
    this.getCRB=function() { return crb&0xFF; };

    this.read=function(reg)
    {
        switch(Number(reg)&3)
        {
            // CRA/CRB bit 2 selects peripheral-data register vs DDR.
            case 0: return (cra&0x04) ? ((ora&ddra)|(inputA&(~ddra&0xFF)))&0xFF : ddra;
            case 1: return cra;
            case 2: return (crb&0x04) ? ((orb&ddrb)|(inputB&(~ddrb&0xFF)))&0xFF : ddrb;
            case 3: return crb;
        }
        return 0;
    };

    this.write=function(reg,value)
    {
        value=Number(value)&0xFF;
        switch(Number(reg)&3)
        {
            case 0:
                if(cra&0x04) ora=value;
                else ddra=value;
                break;

            case 1:
                cra=value;
                break;

            case 2:
            {
                var oldPins=pinsB();
                if(crb&0x04) orb=value;
                else ddrb=value;
                notifyB(oldPins);
                break;
            }

            case 3:
                crb=value;
                break;
        }
    };

    this.reset=function()
    {
        ora=orb=ddra=ddrb=cra=crb=0;
        inputA=0xFF;
        inputB=0x00;
    };
}


function AppleMouse68705(pia,options)
{
    const PB_RDACK      = 0x10; // 6502 -> 68705
    const PB_WRREQUEST  = 0x20; // 6502 -> 68705
    const PB_RDREADY    = 0x40; // 68705 -> 6502
    const PB_WRACK      = 0x80; // 68705 -> 6502

    const STATUS_WAS_BUTTON1  = 0x01;
    const STATUS_IRQ_MOVEMENT = 0x02;
    const STATUS_IRQ_BUTTON   = 0x04;
    const STATUS_IRQ_VBL      = 0x08;
    const STATUS_IS_BUTTON1   = 0x10;
    const STATUS_MOVED        = 0x20;
    const STATUS_WAS_BUTTON0  = 0x40;
    const STATUS_IS_BUTTON0   = 0x80;

    options=options||{};

    var operatingMode=0;
    var inputB=0;
    var idleReadZero=options.idleReadZero!==false;

    var reply=[];
    var replyPos=0;
    var rdAcked=false;

    var current={x:0,y:0,button0:false,button1:false};
    var last={x:0,y:0,button0:false,button1:false};
    var clamp={minX:0,minY:0,maxX:1023,maxY:1023};

    var intState=0;
    var irqAsserted=false;
    var irqCallback=typeof(options.irq)==="function" ? options.irq : null;
    var interVblCycles=17030;

    var command=0;
    var parameters=[];
    var parametersExpected=0;

    function driveInputB(mask,set)
    {
        inputB=set ? (inputB|mask) : (inputB&(~mask&0xFF));
        pia.setInputB(inputB);
    }

    function setIRQ(state)
    {
        state=!!state;
        if(irqAsserted===state) return;
        irqAsserted=state;
        if(irqCallback) irqCallback(state);
    }

    function queueReply(bytes)
    {
        reply=bytes.slice();
        replyPos=0;
    }

    /*
     * Present data only after the write handshake is completely released.
     * When idleReadZero is enabled we reproduce the compatibility behaviour
     * used by modern command-level implementations: an unexpected ROM read
     * receives $00 instead of busy-waiting forever for RDREADY.
     */
    function presentReply()
    {
        if(rdAcked || (pia.getOutputB()&PB_WRREQUEST) || (inputB&PB_WRACK))
            return;

        if(replyPos<reply.length)
        {
            pia.setInputA(reply[replyPos]&0xFF);
            driveInputB(PB_RDREADY,true);
        }
        else if(idleReadZero)
        {
            pia.setInputA(0x00);
            driveInputB(PB_RDREADY,true);
        }
        else
            driveInputB(PB_RDREADY,false);
    }

    function parameterCount(value)
    {
        switch(value&0xF0)
        {
            case 0x40: return 4; // POSMOUSE: XL XH YL YH
            case 0x60: return 4; // CLAMPMOUSE: MinL MaxL MinH MaxH

            case 0x90:           // TIMEMOUSE internal variants
                switch(value&0x0C)
                {
                    case 0x04: return 2;
                    case 0x08: return 1;
                    case 0x0C: return 3;
                    default:   return 0;
                }

            case 0xA0: return 1; // undocumented/internal command
            case 0xF0: return 2; // RDMEMMOUSE: AddrL AddrH
            default:   return 0;
        }
    }

    function clampCurrent()
    {
        current.x=Math.max(clamp.minX,Math.min(clamp.maxX,current.x));
        current.y=Math.max(clamp.minY,Math.min(clamp.maxY,current.y));
    }

    function executeCommand()
    {
        switch(command&0xF0)
        {
            case 0x00: // SETMOUSE
                operatingMode=command&0x0F;
                break;

            case 0x10: // READMOUSE
            {
                var status=intState&STATUS_MOVED;
                if(last.button1)    status|=STATUS_WAS_BUTTON1;
                if(last.button0)    status|=STATUS_WAS_BUTTON0;
                if(current.button1) status|=STATUS_IS_BUTTON1;
                if(current.button0) status|=STATUS_IS_BUTTON0;

                queueReply([
                    current.x&0xFF,(current.x>>8)&0xFF,
                    current.y&0xFF,(current.y>>8)&0xFF,
                    status
                ]);

                // READMOUSE consumes movement-since-read but updates button history.
                intState=status&~STATUS_MOVED;
                last={
                    x:current.x,
                    y:current.y,
                    button0:current.button0,
                    button1:current.button1
                };
                break;
            }

            case 0x20: // SERVEMOUSE
                queueReply([intState&~STATUS_MOVED]);
                intState&=~(STATUS_IRQ_MOVEMENT|STATUS_IRQ_BUTTON|STATUS_IRQ_VBL);
                setIRQ(false);
                break;

            case 0x30: // CLEARMOUSE
                current.x=0;
                current.y=0;
                break;

            case 0x40: // POSMOUSE
                current.x=(parameters[0]|(parameters[1]<<8))&0xFFFF;
                current.y=(parameters[2]|(parameters[3]<<8))&0xFFFF;
                clampCurrent();
                last.x=current.x;
                last.y=current.y;
                break;

            case 0x50: // INITMOUSE
                clamp.minX=clamp.minY=0;
                clamp.maxX=clamp.maxY=1023;
                current.x=last.x=0;
                current.y=last.y=0;
                setIRQ(false);
                break;

            case 0x60: // CLAMPMOUSE
            {
                var minValue=(parameters[0]|(parameters[2]<<8))&0xFFFF;
                var maxValue=(parameters[1]|(parameters[3]<<8))&0xFFFF;

                // Preserve the controller behaviour used by the published
                // command-level reconstruction when min > max.
                if(minValue>maxValue)
                {
                    maxValue=((minValue+maxValue)>>>1)&0xFFFF;
                    minValue=0;
                }

                if(command&1)
                {
                    clamp.minY=minValue;
                    clamp.maxY=maxValue;
                }
                else
                {
                    clamp.minX=minValue;
                    clamp.maxX=maxValue;
                }
                clampCurrent();
                break;
            }

            case 0x70: // HOMEMOUSE
                current.x=last.x=clamp.minX;
                current.y=last.y=clamp.minY;
                break;

            case 0x90: // TIMEMOUSE
                interVblCycles=(command&1) ? 20280 : 17030;
                break;

            case 0xA0: // undocumented/internal, one parameter consumed
                break;

            case 0xF0: // RDMEMMOUSE
            {
                var address=(parameters[0]|(parameters[1]<<8))&0xFFFF;
                var memoryValue=0x00;

                switch(address)
                {
                    case 0x47: memoryValue=(clamp.minX>>8)&0xFF; break;
                    case 0x48: memoryValue=(clamp.minY>>8)&0xFF; break;
                    case 0x49: memoryValue=clamp.minX&0xFF; break;
                    case 0x4A: memoryValue=clamp.minY&0xFF; break;
                    case 0x4B: memoryValue=(clamp.maxX>>8)&0xFF; break;
                    case 0x4C: memoryValue=(clamp.maxY>>8)&0xFF; break;
                    case 0x4D: memoryValue=clamp.maxX&0xFF; break;
                    case 0x4E: memoryValue=clamp.maxY&0xFF; break;
                }
                queueReply([memoryValue]);
                break;
            }
        }

        parameters=[];
        parametersExpected=0;
    }

    function acceptByte(value)
    {
        value=Number(value)&0xFF;

        if(parametersExpected>0)
        {
            parameters.push(value);
            if(parameters.length===parametersExpected)
                executeCommand();
            return;
        }

        command=value;
        parameters=[];
        parametersExpected=parameterCount(command);
        if(parametersExpected===0)
            executeCommand();
    }

    /*
     * Four-phase handshakes.
     *
     * Write byte, 6502 -> 68705:
     *   WRREQUEST 0->1 : sample Port A, set WRACK
     *   WRREQUEST 1->0 : clear WRACK
     *
     * Read byte, 68705 -> 6502:
     *   RDREADY is raised with valid Port A data
     *   RDACK     0->1 : consume byte, clear RDREADY
     *   RDACK     1->0 : present next byte / raise RDREADY again
     */
    function onPortB(oldPins,newPins)
    {
        var changed=(oldPins^newPins)&0xFF;

        if(changed&PB_WRREQUEST)
        {
            if(newPins&PB_WRREQUEST)
            {
                // A new write aborts any unread response, matching the
                // command-level controller implementations.
                driveInputB(PB_RDREADY,false);
                reply=[];
                replyPos=0;

                acceptByte(pia.getOutputA());
                driveInputB(PB_WRACK,true);
            }
            else
            {
                driveInputB(PB_WRACK,false);
                presentReply();
            }
        }

        if(changed&PB_RDACK)
        {
            if(newPins&PB_RDACK)
            {
                rdAcked=true;
                if(inputB&PB_RDREADY)
                {
                    driveInputB(PB_RDREADY,false);
                    if(replyPos<reply.length) replyPos++;
                }
            }
            else
            {
                rdAcked=false;
                presentReply();
            }
        }
    }

    pia.setPortBWriteCallback(onPortB);
    pia.setInputB(inputB);

    this.setMouse=function(x,y,button0,button1)
    {
        x=Number(x)|0;
        y=Number(y)|0;
        x=Math.max(clamp.minX,Math.min(clamp.maxX,x));
        y=Math.max(clamp.minY,Math.min(clamp.maxY,y));
        button0=!!button0;
        button1=!!button1;

        if(x!==current.x || y!==current.y)
        {
            current.x=x;
            current.y=y;
            intState|=STATUS_MOVED;

            if((operatingMode&0x03)===0x03)
            {
                intState|=STATUS_IRQ_MOVEMENT;
                setIRQ(true);
            }
        }

        if(button0!==current.button0 || button1!==current.button1)
        {
            current.button0=button0;
            current.button1=button1;

            if((operatingMode&0x05)===0x05)
            {
                intState|=STATUS_IRQ_BUTTON;
                setIRQ(true);
            }
        }
    };

    this.vbl=function()
    {
        // VBL interrupts are controlled directly by mode bit 3; the mouse-on
        // bit is not required for this interrupt source.
        if(operatingMode&0x08)
        {
            intState|=STATUS_IRQ_VBL;
            setIRQ(true);
        }
    };

    this.reset=function()
    {
        operatingMode=0;
        inputB=0;
        reply=[];
        replyPos=0;
        rdAcked=false;
        current={x:0,y:0,button0:false,button1:false};
        last={x:0,y:0,button0:false,button1:false};
        clamp={minX:0,minY:0,maxX:1023,maxY:1023};
        intState=0;
        command=0;
        parameters=[];
        parametersExpected=0;
        interVblCycles=17030;
        setIRQ(false);
        pia.setInputA(0xFF);
        pia.setInputB(0x00);
    };

    this.getState=function()
    {
        return {
            operatingMode:operatingMode,
            current:{x:current.x,y:current.y,button0:current.button0,button1:current.button1},
            last:{x:last.x,y:last.y,button0:last.button0,button1:last.button1},
            clamp:{minX:clamp.minX,maxX:clamp.maxX,minY:clamp.minY,maxY:clamp.maxY},
            intState:intState,
            irqAsserted:irqAsserted,
            interVblCycles:interVblCycles,
            replyLength:Math.max(0,reply.length-replyPos),
            parametersRemaining:Math.max(0,parametersExpected-parameters.length)
        };
    };
}


function AppleMouse()
{
    var card=this;
    var rom=new Uint8Array(0x800);
    var pia=new MousePIA6821();

    this.id={"PCODE":"AMOUSE","icon":"fa fa-mouse-pointer"};
    this.state={"active":true,"irq":false};

    var controller=new AppleMouse68705(pia,{
        irq:function(state)
        {
            card.state.irq=!!state;
            if(typeof(card.onIRQ)==="function")
                card.onIRQ(!!state);
        }
    });

    this.action={
        "SlotIO":{
            "RD":{"callback":function(addr,ctx){ return card.readSlotIO(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx){ return card.writeSlotIO(addr,d8,ctx); }}
        },
        "SlotROM":{
            "RD":{"callback":function(addr,ctx){ return card.readROM(addr,ctx); }}
        }
    };

    // $C0n0-$C0nF mirrors the four PIA registers every four bytes.
    this.readSlotIO=function(addr)
    {
        return pia.read(Number(addr)&3);
    };

    this.writeSlotIO=function(addr,value)
    {
        pia.write(Number(addr)&3,Number(value)&0xFF);
        return 0;
    };

    // PB1-PB3 drive EPROM A8-A10: eight 256-byte pages in $Cn00-$CnFF.
    this.readROM=function(addr)
    {
        var bank=((pia.getOutputB()&pia.getDDRB()&0x0E)>>1)&7;
        return rom[(bank<<8)|(Number(addr)&0xFF)];
    };

    this.setROM=function(bytes)
    {
        if(!bytes || Number(bytes.length)!==0x800)
            throw new RangeError("AppleMouse slot ROM must be exactly 2048 bytes");

        rom=new Uint8Array(bytes);
        return rom;
    };

    this.setMouse=function(x,y,button0,button1)
    {
        controller.setMouse(x,y,button0,button1);
    };

    this.vbl=function() { controller.vbl(); };

    // Focused debugger/test hooks. Normal firmware traffic still goes through PIA.
    this.getPIA=function() { return pia; };
    this.getController=function() { return controller; };
    this.getROM=function() { return rom; };

    this.reset=function()
    {
        pia.reset();
        controller.reset();
        card.state.irq=false;
    };

    this.restart=this.reset;
}


// Discovery container. Apple2IO creates/mounts the live peripheral instance.
if(typeof(oEMU)!=="undefined" && oEMU && oEMU.component && oEMU.component.IO)
    oEMU.component.IO.AppleMouse=new AppleMouse();
