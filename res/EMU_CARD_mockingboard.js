//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_CARD_mockingboard.js
//

if(oEMU===undefined) var oEMU = {"component":{"IO":{}}};
oEMU.component.IO.mockingboard = new mockingboard();

function mockingboard()
{
    var bDebug = false;
    var card=this;
    const SAMPLE_RATE=44100;
    const AUDIO_CAPACITY=Math.ceil(SAMPLE_RATE*0.25);

    this.id={"PCODE":"MOCK","icon":"fa fa-assistive-listening-systems"};
    this.state={"active":true,"irq":false,"audio":true};
    this.deviceConfig=[{
         "DCODE":"MOCKAUDIO"
        ,"hostPCODE":"MOCK"
        ,"coID":"MockingboardAudio"
        ,"deviceN":1
        ,"icon":"fa fa-volume-up"
        ,"description":"Mockingboard stereo audio output"
        ,"autoAttach":true
    }];
    this.action={"SlotROM":{
         "RD":{"callback":function(addr,ctx){ return card.readSlotROM(addr,ctx); }}
        ,"WR":{"callback":function(addr,d8,ctx){ return card.writeSlotROM(addr,d8,ctx); }}
    }};

    var hw=null, io=null;
    var irqSource="MOCK:0";
    var lastCpuTick=0;
    var clockRate=(typeof(_o)!="undefined" && Number(_o.CPU_ClocksTicks_s)>0) ? Number(_o.CPU_ClocksTicks_s) : 1021800;
    var chips=[];
    var psgBuses=[];
    var vias=[];
    var syncingBus=[false,false];
    var timingRefresh=null;
    var history=new MockingboardHistory(64);
    this.history=history;

    var audioPhase=0;
    var audioConsumerActive=false;
    var audioLeft=new Float32Array(AUDIO_CAPACITY);
    var audioRight=new Float32Array(AUDIO_CAPACITY);
    var audioRead=0, audioWrite=0, audioCount=0;
    var audioStats={producedFrames:0,drainedFrames:0,droppedFrames:0,overruns:0,highWaterFrames:0};

    function configureChip(chip,index)
    {
        if(chip && typeof(chip.configure)==="function") chip.configure(false,clockRate,SAMPLE_RATE);
        if(chip && typeof(chip.setPan)==="function")
            for(var channel=0;channel<3;channel++) chip.setPan(channel,index===0?0.0:1.0,false);
    }
    function buildSoundChips()
    {
        chips=[new Ayumi(),new Ayumi()];
        configureChip(chips[0],0); configureChip(chips[1],1);
        function busOptions(index)
        {
            return {
                 "name":"AY"+index
                ,"onRegisterWrite":function(reg,value,cycle){ history.recordWrite(index,reg,value,cycle); }
                ,"onReset":function(cycle){ history.recordReset(index,cycle); }
            };
        }
        psgBuses=[
            new MockingboardAYBus(chips[0],busOptions(0)),
            new MockingboardAYBus(chips[1],busOptions(1))
        ];
    }
    function syncBus(index)
    {
        if(syncingBus[index] || !vias[index] || !psgBuses[index]) return;
        syncingBus[index]=true;
        var via=vias[index], bus=psgBuses[index];
        var driven=bus.observeViaPins(via.paPins,via.pbPins,lastCpuTick);
        via.setPortAInput(driven===null?0xFF:driven,0xFF);
        syncingBus[index]=false;
    }
    function setCardIRQ(level,force)
    {
        level=!!level;
        if(!force && level===card.state.irq) return;
        card.state.irq=level;
        if(hw && typeof(hw.setIRQSource)==="function") hw.setIRQSource(irqSource,level);
    }
    function updateIRQ()
    {
        setCardIRQ(!!((vias[0]&&vias[0].irqLevel)||(vias[1]&&vias[1].irqLevel)),false);
    }
    function buildVias()
    {
        function makeVia(index)
        {
            return new MockingboardR6522({
                 "name":"VIA"+index
                ,"onPortAChange":function(){ syncBus(index); }
                ,"onPortBChange":function(){ syncBus(index); }
                ,"onIrqChange":function(){ updateIRQ(); }
            });
        }
        vias=[makeVia(0),makeVia(1)];
    }
    function decodeAddress(addr)
    {
        var offset=Number(addr)&0xFF;
        if(offset>=0x00 && offset<=0x0F) return {via:0,reg:offset};
        if(offset>=0x80 && offset<=0x8F) return {via:1,reg:offset&0x0F};
        return null;
    }
    function floatingBus(ctx)
    {
        if(ctx && ctx.io && ctx.io.FLOATING_BUS!==undefined) return ctx.io.FLOATING_BUS;
        if(io && io.FLOATING_BUS!==undefined) return io.FLOATING_BUS;
        return -1;
    }
    function resolveTick(ctx)
    {
        var t=ctx && Number(ctx.cpuTick);
        if(Number.isFinite(t)) return t;
        if(io && typeof(io.getClockTicks)==="function")
        {
            t=Number(io.getClockTicks());
            if(Number.isFinite(t)) return t;
        }
        return lastCpuTick;
    }
    function historyID(suffix)
    {
        var hash=card.mount && card.mount.hash!==undefined ? Number(card.mount.hash) : 0;
        return "MOCK_history_"+hash+"_"+suffix;
    }
    function historySlotNumber()
    {
        if(!io || !io.slots || typeof(io.SLOT2obj)!=="function") return null;
        for(var slotN in io.slots)
            if(io.SLOT2obj(slotN)===card) return Number(slotN);
        return null;
    }
    function historyRegisters()
    {
        return [
            psgBuses[0] ? psgBuses[0].getRegisters() : [],
            psgBuses[1] ? psgBuses[1].getRegisters() : []
        ];
    }
    function syncHistoryControls()
    {
        if(typeof(document)!=="object") return;
        var state=history.getState();
        var mug=document.getElementById(historyID("toggle"));
        var kb=document.getElementById(historyID("kb"));
        var download=document.getElementById(historyID("download"));
        if(mug)
        {
            mug.style.opacity=state.capturing ? "1" : ".35";
            mug.title=state.capturing ? "Stop Mockingboard history capture" : "Start a fresh Mockingboard history capture";
        }
        if(kb) { kb.disabled=state.capturing; kb.value=state.capacityKB; }
        if(download) download.title="Download latest Mockingboard history ("+state.bytesUsed+" / "+state.capacityBytes+" bytes)";
    }
    function enqueueFrame(left,right)
    {
        if(audioCount===AUDIO_CAPACITY)
        {
            audioRead=(audioRead+1)%AUDIO_CAPACITY;
            audioCount--;
            audioStats.overruns++;
            audioStats.droppedFrames++;
        }
        audioLeft[audioWrite]=left;
        audioRight[audioWrite]=right;
        audioWrite=(audioWrite+1)%AUDIO_CAPACITY;
        audioCount++;
        if(audioCount>audioStats.highWaterFrames) audioStats.highWaterFrames=audioCount;
    }
    function renderAudioFrame()
    {
        for(var i=0;i<2;i++)
        {
            if(chips[i] && typeof(chips[i].process)==="function") chips[i].process();
            if(chips[i] && typeof(chips[i].removeDC)==="function") chips[i].removeDC();
        }
        audioStats.producedFrames++;
        if(!audioConsumerActive) return;
        var left=chips[0] && Number.isFinite(Number(chips[0].left)) ? Number(chips[0].left) : 0;
        var right=chips[1] && Number.isFinite(Number(chips[1].right)) ? Number(chips[1].right) : 0;
        enqueueFrame(left*0.5,right*0.5);
    }
    function advanceAudio(cycles)
    {
        audioPhase += cycles*SAMPLE_RATE;
        while(audioPhase>=clockRate)
        {
            audioPhase-=clockRate;
            renderAudioFrame();
        }
    }

    buildSoundChips();
    buildVias();

    this.setTimingRefreshCallback=function(callback)
    {
        timingRefresh=typeof(callback)==="function"?callback:null;
    };
    this.readSlotROM=function(addr,ctx)
    {
        var d=decodeAddress(addr);
        if(!d) return floatingBus(ctx);
        if(ctx && ctx.bRO===true) return vias[d.via].peekRegister(d.reg);
        this.advanceTo(resolveTick(ctx));
        syncBus(d.via);
        return vias[d.via].readRegister(d.reg);
    };
    this.writeSlotROM=function(addr,d8,ctx)
    {
        var d=decodeAddress(addr);
        if(!d || (ctx && ctx.bRO===true)) return false;
        this.advanceTo(resolveTick(ctx));
        vias[d.via].writeRegister(d.reg,Number(d8)&0xFF);
        if(timingRefresh) timingRefresh();
        return true;
    };
    this.advanceTo=function(cpuTick)
    {
        cpuTick=Math.floor(Number(cpuTick));
        if(!Number.isFinite(cpuTick)) return;
        if(cpuTick<lastCpuTick)
        {
            lastCpuTick=cpuTick;
            return;
        }
        var elapsed=cpuTick-lastCpuTick;
        if(elapsed<=0) return;
        vias[0].tick(elapsed); vias[1].tick(elapsed);
        advanceAudio(elapsed);
        lastCpuTick=cpuTick;
    };
    this.syncClock=function(cpuTick){ this.advanceTo(cpuTick); };
    this.needsRealtimeTick=function(){ return vias[0].needsRealtimeTick()||vias[1].needsRealtimeTick(); };
    this.getAudioFormat=function(){ return {sampleRate:SAMPLE_RATE,channels:2,format:"float32"}; };
    this.setAudioConsumerActive=function(active){ audioConsumerActive=!!active; };
    this.getAudioFramesAvailable=function(){ return audioCount; };
    this.drainAudioFrames=function(maxFrames)
    {
        var count=Math.min(audioCount,Math.max(0,Math.floor(Number(maxFrames)||0)));
        var left=new Float32Array(count), right=new Float32Array(count);
        for(var i=0;i<count;i++)
        {
            left[i]=audioLeft[audioRead]; right[i]=audioRight[audioRead];
            audioRead=(audioRead+1)%AUDIO_CAPACITY;
        }
        audioCount-=count;
        audioStats.drainedFrames+=count;
        return {frames:count,left:left,right:right};
    };
    this.clearAudioQueue=function(){ audioRead=audioWrite=audioCount=0; };
    this.getAudioStats=function()
    {
        return {
             producedFrames:audioStats.producedFrames
            ,queuedFrames:audioCount
            ,drainedFrames:audioStats.drainedFrames
            ,droppedFrames:audioStats.droppedFrames
            ,overruns:audioStats.overruns
            ,highWaterFrames:audioStats.highWaterFrames
            ,capacityFrames:AUDIO_CAPACITY
        };
    };
    this.getRegisters=function(index)
    {
        index=Number(index)|0;
        return psgBuses[index] ? psgBuses[index].getRegisters() : new Uint8Array(0);
    };
    this.getViaState=function(index)
    {
        index=Number(index)|0;
        return vias[index] ? vias[index].getState() : null;
    };
    this.getHistoryState=function(){ return history.getState(); };
    this.setHistoryBufferKB=function(value)
    {
        var result=history.setCapacityKB(value);
        syncHistoryControls();
        return result;
    };
    this.toggleHistoryCapture=function()
    {
        if(history.isCapturing())
            history.stop(resolveTick(null));
        else
        {
            if(typeof(document)==="object")
            {
                var kb=document.getElementById(historyID("kb"));
                if(kb) history.setCapacityKB(kb.value);
            }
            history.start(resolveTick(null),historyRegisters());
        }
        syncHistoryControls();
        return history.getState();
    };
    this.getHistoryJSON=function()
    {
        var meta={"slot":historySlotNumber(),"clockHz":clockRate};
        if(history.isCapturing()) meta.stopTick=resolveTick(null);
        return history.toJSON(meta);
    };
    this.downloadHistory=function()
    {
        if(typeof(document)!=="object" || typeof(Blob)!=="function" || typeof(window)!=="object" || !window.URL) return false;
        var json=this.getHistoryJSON();
        var blob=new Blob([JSON.stringify(json,null,2)+"\n"],{type:"application/json"});
        var url=window.URL.createObjectURL(blob);
        var a=document.createElement("a");
        a.href=url;
        a.download="mockingboard-slot"+(json.slot==null?"x":json.slot)+"-history.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ window.URL.revokeObjectURL(url); },1000);
        return true;
    };
    this.reset=function()
    {
        var resetTick=resolveTick(null);
        if(history.isCapturing())
        {
            history.recordReset(0,resetTick);
            history.recordReset(1,resetTick);
        }
        setCardIRQ(false,true);
        vias[0].reset(); vias[1].reset();
        buildSoundChips();
        audioPhase=0;
        this.clearAudioQueue();
        audioStats={producedFrames:0,drainedFrames:0,droppedFrames:0,overruns:0,highWaterFrames:0};
        lastCpuTick=(io && typeof(io.getClockTicks)==="function") ? Number(io.getClockTicks())||0 : 0;
        syncBus(0); syncBus(1);
    };
    this.restart=function()
    {
        if(typeof(apple2plus)!="undefined" && apple2plus && typeof(apple2plus.hwObj)==="function")
        {
            hw=apple2plus.hwObj();
            io=hw && hw.io ? hw.io : null;
        }
        clockRate=(typeof(_o)!="undefined" && Number(_o.CPU_ClocksTicks_s)>0) ? Number(_o.CPU_ClocksTicks_s) : clockRate;
        irqSource="MOCK:"+(this.mount && this.mount.hash!==undefined ? this.mount.hash : 0);
        this.state.active=true;
        this.reset();
    };
    this.onUnmount=function()
    {
        if(history.isCapturing()) history.stop(resolveTick(null));
        setCardIRQ(false,true);
        this.state.active=false;
        audioConsumerActive=false;
        this.clearAudioQueue();
    };
    this.deviceToolSlotHTML=function(ctx)
    {
        ctx=ctx||{};
        var access="apple2plus.hwObj().io.HASH2obj("+Number(this.mount.hash)+")";
        var state=history.getState();
        return "<div class=toolbox id='"+(ctx.toolboxID || "device_tool_"+ctx.slotID)+"' hidden>"
            +"<div class=appbox style='padding:4px 6px;min-height:32px' title='Mockingboard music/command history'>"
            +"<div style='display:flex;align-items:center;gap:6px;white-space:nowrap'>"
            +"<button class=appbut title='Start/stop Mockingboard history capture' onclick='"+access+"?.toggleHistoryCapture()'>"
            +"<i id='"+historyID("toggle")+"' class='fa fa-coffee' style='opacity:"+(state.capturing?"1":".35")+"'></i></button>"
            +"<input id='"+historyID("kb")+"' type=number min=1 max=1024 step=1 value='"+state.capacityKB+"' "
            +(state.capturing?"disabled ":"")+"title='History ring-buffer length in Kbytes' style='width:58px;height:24px;padding:0 4px;box-sizing:border-box;border-radius:7px' "
            +"onchange='"+access+"?.setHistoryBufferKB(this.value)'>"
            +"<span style='font-size:10px'>KB</span>"
            +"<button class=appbut id='"+historyID("download")+"' title='Download latest Mockingboard history' onclick='"+access+"?.downloadHistory()'>"
            +"<i class='fa fa-cloud-download-alt'></i></button>"
            +"</div></div></div>";
    };
}

function MockingboardR6522(options)
{
    options=options||{};
    var via=this;
    this.name=options.name||"6522";
    this.onPortAChange=typeof(options.onPortAChange)==="function"?options.onPortAChange:null;
    this.onPortBChange=typeof(options.onPortBChange)==="function"?options.onPortBChange:null;
    this.onIrqChange=typeof(options.onIrqChange)==="function"?options.onIrqChange:null;

    function updateIRQ()
    {
        var next=!!(via.ifr & via.ier & 0x7F);
        if(next===via.irqLevel) return;
        via.irqLevel=next;
        if(via.onIrqChange) via.onIrqChange(next,via);
    }
    function updatePins()
    {
        var oldA=via.paPins, oldB=via.pbPins;
        via.paPins=((via.ora & via.ddra) | (via.iraExternal & (~via.ddra & 0xFF))) & 0xFF;
        via.pbPins=((via.orb & via.ddrb) | (via.irbExternal & (~via.ddrb & 0xFF))) & 0xFF;
        if(oldA!==via.paPins && via.onPortAChange) via.onPortAChange(via.paPins,via);
        if(oldB!==via.pbPins && via.onPortBChange) via.onPortBChange(via.pbPins,via);
    }
    function visibleIFR(){ return (via.ifr & 0x7F) | ((via.ifr & via.ier & 0x7F)?0x80:0); }
    function clearIFR(mask){ via.ifr &= ~(mask & 0x7F); updateIRQ(); }
    function setIFR(mask){ via.ifr |= mask & 0x7F; updateIRQ(); }

    this.reset=function()
    {
        this.ora=this.orb=0;
        this.ddra=this.ddrb=0;
        this.iraExternal=this.irbExternal=0xFF;
        this.paPins=this.pbPins=0xFF;
        this.t1Counter=this.t1Latch=0xFFFF; this.t1Gap=false;
        this.t2Counter=0xFFFF; this.t2LatchLow=0xFF; this.t2StartValue=0xFFFF; this.t2Phase=0;
        this.t1Running=this.t2Running=false;
        this.t1HasInterrupted=this.t2HasInterrupted=false;
        this.sr=this.acr=this.pcr=this.ifr=this.ier=0;
        this.irqLevel=false;
        this.ca1=this.ca2=this.cb1=this.cb2=1;
    };
    this.peekRegister=function(reg)
    {
        switch(reg & 0x0F)
        {
            case 0x00:return this.pbPins;
            case 0x01:return this.paPins;
            case 0x02:return this.ddrb;
            case 0x03:return this.ddra;
            case 0x04:return this.t1Counter & 0xFF;
            case 0x05:return (this.t1Counter>>8)&0xFF;
            case 0x06:return this.t1Latch & 0xFF;
            case 0x07:return (this.t1Latch>>8)&0xFF;
            case 0x08:return this.t2Counter & 0xFF;
            case 0x09:return (this.t2Counter>>8)&0xFF;
            case 0x0A:return this.sr;
            case 0x0B:return this.acr;
            case 0x0C:return this.pcr;
            case 0x0D:return visibleIFR();
            case 0x0E:return (this.ier & 0x7F)|0x80;
            case 0x0F:return this.paPins;
        }
        return 0xFF;
    };
    this.readRegister=function(reg)
    {
        reg &= 0x0F;
        var value=this.peekRegister(reg);
        switch(reg)
        {
            case 0x00: clearIFR(0x18); break;
            case 0x01: clearIFR(0x03); break;
            case 0x04: clearIFR(0x40); break;
            case 0x08: clearIFR(0x20); break;
        }
        return value;
    };
    this.writeRegister=function(reg,value)
    {
        reg&=0x0F; value&=0xFF;
        switch(reg)
        {
            case 0x00:this.orb=value; clearIFR(0x18); updatePins(); break;
            case 0x01:this.ora=value; clearIFR(0x03); updatePins(); break;
            case 0x0F:this.ora=value; updatePins(); break;
            case 0x02:this.ddrb=value; updatePins(); break;
            case 0x03:this.ddra=value; updatePins(); break;
            case 0x04:this.t1Latch=(this.t1Latch & 0xFF00)|value; break;
            case 0x05:
                this.t1Latch=(value<<8)|(this.t1Latch & 0xFF);
                this.t1Counter=this.t1Latch; this.t1Gap=false; this.t1Running=true; this.t1HasInterrupted=false;
                clearIFR(0x40);
                break;
            case 0x06:this.t1Latch=(this.t1Latch & 0xFF00)|value; break;
            case 0x07:this.t1Latch=(value<<8)|(this.t1Latch & 0xFF); clearIFR(0x40); break;
            case 0x08:this.t2LatchLow=value; break;
            case 0x09:
                this.t2StartValue=(value<<8)|this.t2LatchLow;
                this.t2Counter=this.t2StartValue; this.t2Phase=0; this.t2Running=true; this.t2HasInterrupted=false;
                clearIFR(0x20);
                break;
            case 0x0A:this.sr=value; clearIFR(0x04); break;
            case 0x0B:this.acr=value; break;
            case 0x0C:this.pcr=value; break;
            case 0x0D:this.ifr &= ~(value & 0x7F); updateIRQ(); break;
            case 0x0E:
                if(value & 0x80) this.ier |= value & 0x7F;
                else this.ier &= ~(value & 0x7F);
                updateIRQ();
                break;
        }
    };
    this.setPortAInput=function(value,mask)
    {
        mask=mask===undefined?0xFF:(mask&0xFF); value&=0xFF;
        this.iraExternal=(this.iraExternal & (~mask & 0xFF)) | (value & mask);
        updatePins();
    };
    this.setPortBInput=function(value,mask)
    {
        mask=mask===undefined?0xFF:(mask&0xFF); value&=0xFF;
        this.irbExternal=(this.irbExternal & (~mask & 0xFF)) | (value & mask);
        updatePins();
    };
    this.setCA1=function(level){ level=level?1:0; var old=this.ca1; this.ca1=level; if(old!==level){ var rising=!!(this.pcr&0x01); if((rising&&level)||(!rising&&!level)) setIFR(0x02); } };
    this.setCA2=function(level){ level=level?1:0; var old=this.ca2; this.ca2=level; if(old!==level){ var rising=!!(this.pcr&0x04); if((rising&&level)||(!rising&&!level)) setIFR(0x01); } };
    this.setCB1=function(level){ level=level?1:0; var old=this.cb1; this.cb1=level; if(old!==level){ var rising=!!(this.pcr&0x10); if((rising&&level)||(!rising&&!level)) setIFR(0x10); } };
    this.setCB2=function(level){ level=level?1:0; var old=this.cb2; this.cb2=level; if(old!==level){ var rising=!!(this.pcr&0x40); if((rising&&level)||(!rising&&!level)) setIFR(0x08); } };
    this.needsRealtimeTick=function()
    {
        var t1=this.t1Running && !!(this.ier & 0x40) && ((this.acr & 0x40) || !this.t1HasInterrupted);
        var t2=this.t2Running && !(this.acr & 0x20) && !!(this.ier & 0x20) && !this.t2HasInterrupted;
        return !!(t1||t2);
    };
    this.tick=function(cycles)
    {
        cycles=Math.floor(Number(cycles));
        if(!Number.isFinite(cycles) || cycles<=0) return;
        var cyclesOriginal=cycles;

        /*
         * T1 counter motion never stops.  "Running" means a T1CH load has
         * armed interrupt generation; mb-audit also relies on an otherwise
         * inactive/reset counter continuing to decrement for card detection.
         * A real 6522 has one $FFFF gap cycle after zero, hence N+2 between
         * reload events.
         */
        var toReload=this.t1Gap ? 1 : (this.t1Counter+2);
        if(cycles<toReload)
        {
            if(this.t1Gap)
            {
                /* integer cycles<1 cannot occur */
            }
            else if(cycles<=this.t1Counter)
                this.t1Counter=(this.t1Counter-cycles)&0xFFFF;
            else
            {
                this.t1Counter=0xFFFF;
                this.t1Gap=true;
            }
        }
        else
        {
            cycles-=toReload;
            this.t1Counter=this.t1Latch&0xFFFF;
            this.t1Gap=false;

            if(this.t1Running)
            {
                if(this.acr&0x40) setIFR(0x40);
                else if(!this.t1HasInterrupted)
                {
                    this.t1HasInterrupted=true;
                    setIFR(0x40);
                }
            }

            var period=(this.t1Latch&0xFFFF)+2;
            if(cycles>=period)
            {
                var reloads=Math.floor(cycles/period);
                if(reloads>0 && this.t1Running && (this.acr&0x40)) setIFR(0x40);
                cycles%=period;
            }

            if(cycles<=this.t1Latch)
                this.t1Counter=(this.t1Latch-cycles)&0xFFFF;
            else
            {
                this.t1Counter=0xFFFF;
                this.t1Gap=true;
            }
        }

        /*
         * T2's counter also moves while not interrupt-armed.  In PHI2 mode it
         * simply wraps through $FFFF after underflow; its interrupt is a
         * one-shot generated N+2 cycles after a T2CH load.
         */
        if(!(this.acr&0x20))
        {
            this.t2Counter=(this.t2Counter-cyclesOriginal)&0xFFFF;
            if(this.t2Running && !this.t2HasInterrupted)
            {
                var before2=this.t2Phase;
                this.t2Phase+=cyclesOriginal;
                if(before2<this.t2StartValue+2 && this.t2Phase>=this.t2StartValue+2)
                {
                    this.t2HasInterrupted=true;
                    setIFR(0x20);
                }
            }
        }
    };
    this.getState=function(){ return {ora:this.ora,orb:this.orb,ddra:this.ddra,ddrb:this.ddrb,paPins:this.paPins,pbPins:this.pbPins,t1Counter:this.t1Counter,t1Latch:this.t1Latch,t1Running:this.t1Running,t2Counter:this.t2Counter,t2Running:this.t2Running,sr:this.sr,acr:this.acr,pcr:this.pcr,ifr:this.peekRegister(0x0D),ier:this.peekRegister(0x0E),irq:this.irqLevel}; };
    this.reset();
}
MockingboardR6522.REG={ORB:0,ORA:1,DDRB:2,DDRA:3,T1CL:4,T1CH:5,T1LL:6,T1LH:7,T2CL:8,T2CH:9,SR:10,ACR:11,PCR:12,IFR:13,IER:14,ORA_NH:15};
MockingboardR6522.IFR={CA2:0x01,CA1:0x02,SR:0x04,CB2:0x08,CB1:0x10,T2:0x20,T1:0x40,IRQ:0x80};
MockingboardR6522.REG_NAMES=["ORB","ORA","DDRB","DDRA","T1CL","T1CH","T1LL","T1LH","T2CL","T2CH","SR","ACR","PCR","IFR","IER","ORA_NH"];

function MockingboardAYBus(renderer,options)
{
    options=options||{};
    var bus=this;
    var INACTIVE=0, READ=1, WRITE=2, LATCH=3, RESET=-1;
    this.name=options.name||"AY";
    this.renderer=renderer||null;
    this.onRegisterWrite=typeof(options.onRegisterWrite)==="function"?options.onRegisterWrite:null;
    this.onControlChange=typeof(options.onControlChange)==="function"?options.onControlChange:null;
    this.onReset=typeof(options.onReset)==="function"?options.onReset:null;
    this.regs=new Uint8Array(16);
    this.selectedRegister=0;
    this.addressValid=false;
    this.controlState=INACTIVE;
    this.resetAsserted=false;
    this.lastPortA=0xFF;
    this.lastPortB=0xFF;
    this.busDrive=null;

    function applyChannel(index)
    {
        if(!bus.renderer) return;
        var r7=bus.regs[7];
        var amp=bus.regs[8+index];
        if(typeof(bus.renderer.setMixer)==="function")
            bus.renderer.setMixer(index,(r7>>index)&1,(r7>>(index+3))&1,(amp>>4)&1);
        if(typeof(bus.renderer.setVolume)==="function")
            bus.renderer.setVolume(index,amp&0x0F);
    }
    function applyRegister(reg)
    {
        if(!bus.renderer) return;
        switch(reg)
        {
            case 0: case 1:
                if(typeof(bus.renderer.setTone)==="function") bus.renderer.setTone(0,((bus.regs[1]&0x0F)<<8)|bus.regs[0]);
                break;
            case 2: case 3:
                if(typeof(bus.renderer.setTone)==="function") bus.renderer.setTone(1,((bus.regs[3]&0x0F)<<8)|bus.regs[2]);
                break;
            case 4: case 5:
                if(typeof(bus.renderer.setTone)==="function") bus.renderer.setTone(2,((bus.regs[5]&0x0F)<<8)|bus.regs[4]);
                break;
            case 6:
                if(typeof(bus.renderer.setNoise)==="function") bus.renderer.setNoise(bus.regs[6]&0x1F);
                break;
            case 7:
                applyChannel(0); applyChannel(1); applyChannel(2);
                break;
            case 8: case 9: case 10:
                applyChannel(reg-8);
                break;
            case 11: case 12:
                if(typeof(bus.renderer.setEnvelope)==="function") bus.renderer.setEnvelope((bus.regs[12]<<8)|bus.regs[11]);
                break;
            case 13:
                if(typeof(bus.renderer.setEnvelopeShape)==="function") bus.renderer.setEnvelopeShape(bus.regs[13]&0x0F);
                break;
        }
    }
    function decodeControl(portB)
    {
        if((portB & 0x04)===0) return RESET;
        switch(portB & 0x03)
        {
            case 0:return INACTIVE;
            case 1:return READ;
            case 2:return WRITE;
            case 3:return LATCH;
        }
        return INACTIVE;
    }
    function latchAddress(value)
    {
        if(value & 0xF0)
        {
            bus.addressValid=false;
            return;
        }
        bus.selectedRegister=value & 0x0F;
        bus.addressValid=true;
    }

    this.reset=function(cycle)
    {
        this.regs.fill(0);
        this.selectedRegister=0;
        this.addressValid=false;
        this.controlState=INACTIVE;
        this.busDrive=null;
        for(var i=0;i<3;i++)
        {
            if(this.renderer && typeof(this.renderer.setTone)==="function") this.renderer.setTone(i,0);
            applyChannel(i);
        }
        if(this.renderer && typeof(this.renderer.setNoise)==="function") this.renderer.setNoise(0);
        if(this.renderer && typeof(this.renderer.setEnvelope)==="function") this.renderer.setEnvelope(0);
        if(this.renderer && typeof(this.renderer.setEnvelopeShape)==="function") this.renderer.setEnvelopeShape(0);
    };
    this.observeViaPins=function(portA,portB,cycle)
    {
        portA&=0xFF; portB&=0xFF;
        this.lastPortA=portA; this.lastPortB=portB;
        var next=decodeControl(portB);
        if(next===RESET)
        {
            if(!this.resetAsserted)
            {
                this.reset(cycle);
                if(this.onReset) this.onReset(cycle,this);
            }
            this.resetAsserted=true;
            this.controlState=RESET;
            this.busDrive=null;
            return null;
        }
        if(this.resetAsserted)
        {
            this.resetAsserted=false;
            this.controlState=INACTIVE;
        }
        var previous=this.controlState;
        if(previous===INACTIVE)
        {
            if(next===LATCH) latchAddress(portA);
            else if(next===WRITE && this.addressValid) this.writeRegister(this.selectedRegister,portA,cycle);
        }
        if(previous!==next && this.onControlChange) this.onControlChange(previous,next,cycle,this);
        this.controlState=next;
        this.busDrive=(next===READ && this.addressValid)?this.readRegister(this.selectedRegister):null;
        return this.busDrive;
    };
    this.getBusDrive=function()
    {
        if(this.controlState!==READ || !this.addressValid) return null;
        return this.readRegister(this.selectedRegister);
    };
    this.isDrivingBus=function(){ return this.getBusDrive()!==null; };
    this.readRegister=function(index){ index&=0x0F; return this.regs[index] & MockingboardAYBus.REG_MASK[index]; };
    this.writeRegister=function(index,value,cycle)
    {
        index&=0x0F; value&=MockingboardAYBus.REG_MASK[index];
        this.regs[index]=value;
        applyRegister(index);
        if(this.onRegisterWrite) this.onRegisterWrite(index,value,cycle,this);
        if(this.controlState===READ && this.addressValid && this.selectedRegister===index) this.busDrive=value;
        return value;
    };
    this.getRegisters=function(){ return new Uint8Array(this.regs); };
    this.getState=function(){ return {selectedRegister:this.selectedRegister,addressValid:this.addressValid,controlState:this.controlState,resetAsserted:this.resetAsserted,busDrive:this.getBusDrive(),lastPortA:this.lastPortA,lastPortB:this.lastPortB}; };
    this.reset(0);
}
MockingboardAYBus.REG_MASK=[0xFF,0x0F,0xFF,0x0F,0xFF,0x0F,0x1F,0xFF,0x1F,0x1F,0x1F,0xFF,0xFF,0x0F,0xFF,0xFF];
MockingboardAYBus.REG_NAMES=[
    "TONE_A_FINE","TONE_A_COARSE","TONE_B_FINE","TONE_B_COARSE",
    "TONE_C_FINE","TONE_C_COARSE","NOISE_PERIOD","MIXER",
    "AMP_A","AMP_B","AMP_C","ENV_FINE","ENV_COARSE","ENV_SHAPE"
];

function MockingboardHistory(bufferKB)
{
    const RECORD_BYTES=4;
    const CMD_RESET=0x80;
    const CMD_DELAY=0xFF;
    var capturing=false;
    var capacityKB=64;
    var buffer=new Uint8Array(64*1024);
    var head=0;
    var records=0;
    var wrapped=false;
    var baseTick=0;
    var lastTick=0;
    var stopTick=0;
    var baseRegisters=[new Uint8Array(14),new Uint8Array(14)];

    function normaliseKB(value)
    {
        value=Math.floor(Number(value));
        if(!Number.isFinite(value) || value<1) value=64;
        return Math.max(1,Math.min(1024,value));
    }
    function copyRegisters(source)
    {
        var out=[new Uint8Array(14),new Uint8Array(14)];
        for(var ay=0;ay<2;ay++)
        {
            var src=source && source[ay];
            for(var reg=0;reg<14;reg++) out[ay][reg]=src && src[reg]!==undefined ? Number(src[reg])&0xFF : 0;
        }
        return out;
    }
    function offsetFor(index){ return (head+index*RECORD_BYTES)%buffer.length; }
    function readRecord(index)
    {
        var p=offsetFor(index);
        return [buffer[p]|(buffer[p+1]<<8),buffer[p+2],buffer[p+3]];
    }
    function applyToBase(command,value)
    {
        if(command===CMD_DELAY) return;
        if((command&0xFE)===CMD_RESET)
        {
            baseRegisters[command&1].fill(0);
            return;
        }
        var ay=(command>>4)&1, reg=command&0x0F;
        if(reg<14) baseRegisters[ay][reg]=value&0xFF;
    }
    function dropOldest()
    {
        if(records<1) return;
        var r=readRecord(0);
        baseTick+=r[0];
        applyToBase(r[1],r[2]);
        head=(head+RECORD_BYTES)%buffer.length;
        records--;
        wrapped=true;
    }
    function push(delta,command,value)
    {
        if(records>=buffer.length/RECORD_BYTES) dropOldest();
        var p=offsetFor(records);
        buffer[p]=delta&0xFF;
        buffer[p+1]=(delta>>8)&0xFF;
        buffer[p+2]=command&0xFF;
        buffer[p+3]=value&0xFF;
        records++;
    }
    function pushTimed(command,value,tick)
    {
        if(!capturing) return false;
        tick=Math.floor(Number(tick));
        if(!Number.isFinite(tick)) tick=lastTick;
        var delta=tick>=lastTick ? tick-lastTick : 0;
        while(delta>0xFFFF)
        {
            push(0xFFFF,CMD_DELAY,0);
            delta-=0xFFFF;
        }
        push(delta,command,value);
        lastTick=tick;
        stopTick=tick;
        return true;
    }

    this.setCapacityKB=function(value)
    {
        if(capturing) return capacityKB;
        capacityKB=normaliseKB(value);
        buffer=new Uint8Array(capacityKB*1024);
        head=records=0;
        wrapped=false;
        return capacityKB;
    };
    this.start=function(tick,registers)
    {
        tick=Math.floor(Number(tick));
        if(!Number.isFinite(tick)) tick=0;
        head=records=0;
        wrapped=false;
        baseTick=lastTick=stopTick=tick;
        baseRegisters=copyRegisters(registers);
        capturing=true;
        return this.getState();
    };
    this.stop=function(tick)
    {
        if(tick!==undefined)
        {
            tick=Math.floor(Number(tick));
            if(Number.isFinite(tick)) stopTick=tick;
        }
        capturing=false;
        return this.getState();
    };
    this.recordWrite=function(ay,reg,value,tick)
    {
        ay=Number(ay)|0; reg=Number(reg)|0;
        if((ay!==0 && ay!==1) || reg<0 || reg>13) return false;
        return pushTimed((ay<<4)|reg,Number(value)&0xFF,tick);
    };
    this.recordReset=function(ay,tick)
    {
        ay=Number(ay)|0;
        if(ay!==0 && ay!==1) return false;
        return pushTimed(CMD_RESET|ay,0,tick);
    };
    this.isCapturing=function(){ return capturing; };
    this.getState=function()
    {
        return {
             capturing:capturing
            ,capacityKB:capacityKB
            ,capacityBytes:buffer.length
            ,records:records
            ,bytesUsed:records*RECORD_BYTES
            ,wrapped:wrapped
            ,baseTick:baseTick
            ,lastTick:lastTick
            ,stopTick:stopTick
        };
    };
    this.toJSON=function(meta)
    {
        meta=meta||{};
        var events=[];
        var pending=0;
        for(var i=0;i<records;i++)
        {
            var r=readRecord(i);
            pending+=r[0];
            if(r[1]===CMD_DELAY) continue;
            if((r[1]&0xFE)===CMD_RESET)
                events.push([pending,r[1]&1,-1,0]);
            else
                events.push([pending,(r[1]>>4)&1,r[1]&0x0F,r[2]]);
            pending=0;
        }
        return {
             format:"RetroAppleJS.MockingboardHistory"
            ,version:1
            ,encoding:"deltaCycles,ay,register,value; register -1 means AY reset"
            ,slot:meta.slot==null?null:Number(meta.slot)
            ,clockHz:Number(meta.clockHz)||0
            ,bufferKB:capacityKB
            ,baseTick:baseTick
            ,stopTick:meta.stopTick==null?stopTick:Number(meta.stopTick)
            ,wrapped:wrapped
            ,initialRegisters:{AY0:Array.from(baseRegisters[0]),AY1:Array.from(baseRegisters[1])}
            ,events:events
        };
    };

    this.setCapacityKB(bufferKB);
}
