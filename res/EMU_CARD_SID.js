//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_CARD_SID.js
// Apple II peripheral: SID register bus decoding and slot-side configuration.
// ALL synthesis and audio output are implemented by EMU_DEVICE_SID_audio.js.
//

if(typeof oEMU==="undefined")var oEMU={component:{IO:{}}};
if(!oEMU.component)oEMU.component={IO:{}};
if(!oEMU.component.IO)oEMU.component.IO={};
oEMU.component.IO.sid=new SIDCard();

function SIDCard()
{
    var card=this,io=null;
    var enabled=true,snoop=true,regIndex=0,model=6581,clock=1022727,volume=100;
    var sniffedWrites=0,slotWrites=0;
    var lastWrite={address:0,value:0,tick:0};
    // Emulator-only read-only extension: selecting $1E and reading slot
    // data latches the low 16 bits of CPU ticks; selecting $1F reads its
    // high byte from the *same* snapshot. Does not alter SID chip registers.
    var clockLatch=0;
    // Emulator SID-card timer extension (not a MOS 6581/8580 register).
    // Indexed I/O: $1A reload low, $1B high, $1C enable, $1D IRQ/ACK.
    // The $1E/$1F clock-latch ABI and $00-$19 SID registers are untouched.
    var timerPeriod=20436,timerEnabled=false,timerPending=false;
    var timerDeadline=0,timerFired=0,timerMissed=0;
    var timerSource=null;
    function timerIRQ(active)
    {
        timerPending=!!active;
        card.state.irq=timerPending;
        var hw=io&&io.hostHardware;
        if(!hw && typeof apple2plus!=="undefined" && apple2plus &&
            typeof apple2plus.hwObj==="function")hw=apple2plus.hwObj();
        if(hw && typeof(hw.setIRQSource)==="function" && timerSource)
            hw.setIRQSource(timerSource,timerPending&&card.state.active);
    }
    function timerStop()
    {
        timerEnabled=false;timerIRQ(false);timerDeadline=0;
    }
    this.getTimerState=function()
    {
        return {period:timerPeriod,enabled:timerEnabled,pending:timerPending,
            deadline:timerDeadline,fired:timerFired,missed:timerMissed,
            source:timerSource};
    };
    // Called exactly once per completed emulated CPU tick, not per video frame.
    this.timerTick=function(now)
    {
        if(!timerEnabled || !card.state.active)return;
        now=Math.floor(Number(now));
        if(!Number.isFinite(now) || now<timerDeadline)return;
        var expired=Math.floor((now-timerDeadline)/timerPeriod)+1;
        timerDeadline+=expired*timerPeriod;
        timerMissed+=timerPending?expired:expired-1;
        if(!timerPending){timerFired++;timerIRQ(true);}
    };
    function timerStart(tick)
    {
        if(timerPeriod<1)return false;
        timerStop();
        timerEnabled=true;
        timerDeadline=Math.floor(Number(tick)||0)+timerPeriod;
        return true;
    }
    const BURST_GAP_TICKS=3500,TELEMETRY_HISTORY_LIMIT=120;
    var burstCount=0,lastWriteTick=null,lastBurstTick=null;
    var currentBurstWrites=0,maxBurstWrites=0,periodCount=0,periodSum=0;
    var lastPeriod=0,minPeriod=null,maxPeriod=0,shortPeriods=0,longPeriods=0;
    var telemetryBaseline=null,telemetryHistory=[],telemetryRates={};
    var telemetryLastTime=null,toolboxID=null;

    this.id={PCODE:"SID",icon:"fa fa-music"};
    this.state={active:true,irq:false};
    this.deviceConfig=[{
        DCODE:"SIDAUDIO",coID:"SIDAudio",hostPCODE:"SID",deviceN:1,
        singleton:true,icon:"fa fa-volume-up",
        description:"MOS 6581/8580 synthesis and audio output",
        autoAttach:true
    }];
    this.action={SlotIO:{
        RD:{callback:function(addr,ctx){return card.readSlotIO(addr,ctx);}},
        WR:{callback:function(addr,data,ctx){return card.writeSlotIO(addr,data,ctx);}}
    }};

    function audioDevice()
    {
        var devices=Array.isArray(card.devices)?card.devices:[];
        for(var i=0;i<devices.length;i++){
            var d=devices[i];
            if(d && d.id && d.id.DCODE==="SIDAUDIO")return d;
        }
        return null;
    }
    function timestamp(ctx)
    {
        if(ctx && Number.isFinite(Number(ctx.cpuTick)))return Math.floor(Number(ctx.cpuTick));
        if(io && typeof io.getClockTicks==="function"){
            var t=Number(io.getClockTicks());
            if(Number.isFinite(t))return Math.floor(t);
        }
        return 0;
    }
    function hex(n,digits){return (n>>>0).toString(16).toUpperCase().padStart(digits,"0");}
    this.getAudioDevice=audioDevice;
    this.getModel=function(){return model;};
    this.getClock=function(){return clock;};
    this.getVolume=function(){return volume;};
    this.isSnoopEnabled=function(){return enabled&&snoop&&this.state.active;};
    this.setModel=function(value)
    {
        value=Number(value);
        if(value!==6581 && value!==8580)throw new RangeError("SID model must be 6581 or 8580");
        model=value;
        var d=audioDevice();
        if(d && typeof d.setModel==="function")d.setModel(model);
        return model;
    };
    this.setClock=function(value)
    {
        value=Number(value);
        if(value!==985248 && value!==1022727)
            throw new RangeError("SID clock must be PAL 985248 or NTSC 1022727 Hz");
        clock=value;
        var d=audioDevice();
        if(d && typeof d.setClock==="function")d.setClock(clock);
        return clock;
    };
    this.setVolume=function(value)
    {
        value=Number(value);
        if(!Number.isInteger(value)||value<0||value>100)
            throw new RangeError("SID volume must be 0–100%");
        volume=value;
        var d=audioDevice();
        if(d && typeof d.setVolume==="function")d.setVolume(value);
        return volume;
    };
    this.setEnabled=function(value){enabled=!!value;return enabled;};
    this.setSnoopEnabled=function(value){snoop=!!value;return snoop;};
    this.getConfiguration=function()
    {
        return {model:model,clockHz:clock,volumePct:volume,
                enabled:enabled,snoop:snoop,
                registerIndex:regIndex,registers:audioDevice()?.getRegisters()||new Uint8Array(32)};
    };
    this.getStatistics=function()
    {
        return {snoopWrites:sniffedWrites,slotWrites:slotWrites,
                lastWrite:Object.assign({},lastWrite)};
    };
    function recordWriteBurst(tick)
    {
        // A "burst" is a cluster of native SID writes separated by no more
        // than 3500 emulated CPU ticks (~3.4 ms). It is an observation of bus
        // traffic, NOT proof of a PLAY routine call or its exact cadence.
        if(lastWriteTick===null || tick<lastWriteTick ||
           tick-lastWriteTick>BURST_GAP_TICKS){
            if(lastBurstTick!==null && tick>=lastBurstTick){
                var period=tick-lastBurstTick;
                lastPeriod=period;periodSum+=period;periodCount++;
                minPeriod=minPeriod===null?period:Math.min(minPeriod,period);
                maxPeriod=Math.max(maxPeriod,period);
                if(period<0.70*20436)shortPeriods++;
                if(period>1.40*20436)longPeriods++;
            }
            lastBurstTick=tick;
            currentBurstWrites=0;
            burstCount++;
        }
        currentBurstWrites++;
        maxBurstWrites=Math.max(maxBurstWrites,currentBurstWrites);
        lastWriteTick=tick;
    }
    function resetBurstStats()
    {
        burstCount=currentBurstWrites=maxBurstWrites=periodCount=periodSum=0;
        lastWriteTick=lastBurstTick=null;
        lastPeriod=maxPeriod=shortPeriods=longPeriods=0;minPeriod=null;
    }
    function writeToSID(reg,value,addr,ctx,snooped)
    {
        if(!enabled||!card.state.active||ctx?.bRO===true)return false;
        var d=audioDevice();
        if(!d)return false;
        var tick=timestamp(ctx);
        d.writeRegister(reg,value,tick);
        lastWrite={address:addr&0xFFFF,value:value&255,tick:tick};
        if(snooped){sniffedWrites++;recordWriteBurst(tick);}
        else slotWrites++;
        return true;
    }
    // Called by the Apple2Hw.write() bus observer after the ordinary
    // ROM/language-card write dispatch. Neither the SID card nor its child
    // overlays the Apple II $D000–$FFFF memory map.
    this.observeBusWrite=function(addr,data,ctx)
    {
        addr=Number(addr)&0xFFFF;
        if(!this.isSnoopEnabled() || addr<0xD400 || addr>0xD41F)return false;
        return writeToSID(addr&31,data,addr,ctx,true);
    };
    function status()
    {
        return (enabled?1:0)|(snoop?2:0)|(model===8580?4:0)|
               (audioDevice()?8:0);
    }
    this.readSlotIO=function(addr,ctx)
    {
        var r=Number(addr)&15,d=audioDevice();
        if(r===0)return 0x53;                 // SID signature
        if(r===1)return status();
        if(r===2)return regIndex;
        if(r===3){
            if(regIndex===0x1A)return timerPeriod&255;
            if(regIndex===0x1B)return (timerPeriod>>>8)&255;
            if(regIndex===0x1C)return timerEnabled?1:0;
            if(regIndex===0x1D)return (timerPending?1:0)|(timerEnabled?2:0);
            if(regIndex===0x1E){
                var sampled=timestamp(ctx)&0xFFFF;
                if(ctx?.bRO!==true)clockLatch=sampled;
                return sampled&0xFF;
            }
            if(regIndex===0x1F)return (clockLatch>>>8)&0xFF;
            return d?d.readRegister(regIndex,ctx?.bRO?undefined:timestamp(ctx)):0xFF;
        }
        if(r===4)return model===8580?1:0;
        if(r===5)return clock===1022727?1:0;
        if(r===6)return enabled?1:0;
        if(r===7)return snoop?1:0;
        if(r>=8 && r<=11)return d?d.readRegister(0x19+r-8,ctx?.bRO?undefined:timestamp(ctx)):0xFF;
        if(r===12)return lastWrite.address&31;
        if(r===13)return lastWrite.value;
        if(r===14)return sniffedWrites&255;
        if(r===15)return (sniffedWrites>>>8)&255;
        return 0xFF;
    };
    this.writeSlotIO=function(addr,data,ctx)
    {
        if(ctx?.bRO===true)return false;
        var r=Number(addr)&15,v=Number(data)&255;
        if(r===2){regIndex=v&31;return true;}
        if(r===3){
            if(regIndex===0x1A){if(!timerEnabled)timerPeriod=(timerPeriod&0xFF00)|v;return true;}
            if(regIndex===0x1B){if(!timerEnabled)timerPeriod=(timerPeriod&0x00FF)|(v<<8);return true;}
            if(regIndex===0x1C){
                if(v&1)timerStart(timestamp(ctx));
                else timerStop();
                return true;
            }
            if(regIndex===0x1D){if(v&1)timerIRQ(false);return true;}
            if(regIndex===0x1E||regIndex===0x1F)return true;
            return writeToSID(regIndex,v,0xD400+regIndex,ctx,false);
        }
        if(r===4){this.setModel((v&1)?8580:6581);return true;}
        if(r===5){this.setClock((v&1)?1022727:985248);return true;}
        if(r===6){this.setEnabled(!!(v&1));return true;}
        if(r===7){this.setSnoopEnabled(!!(v&1));return true;}
        return false;
    };

    function slotHash(){return Number(card.mount&&card.mount.hash)||0;}
    function telemetryID(key){return "sid_audio_"+slotHash()+"_"+key;}
    function eventName(){return telemetryID("refresh");}
    function getDeviceTelemetry()
    {
        var d=audioDevice();
        return d && typeof(d.getAudioStats)==="function"?d.getAudioStats():null;
    }
    function ensureTelemetryEvent()
    {
        if(typeof(oCOM)==="undefined" || !oCOM ||
           typeof(oCOM.addRefreshEvent)!=="function")return false;
        var key=eventName();
        if(!oCOM.RefreshEvent_arr || !oCOM.RefreshEvent_arr[key])
            oCOM.addRefreshEvent(function(){card.audioTelemetryRefresh();},key,false);
        return !!(oCOM.RefreshEvent_arr && oCOM.RefreshEvent_arr[key]);
    }
    function telemetryActive()
    {
        return !!(typeof(oCOM)!=="undefined" && oCOM.RefreshEvent_arr &&
            oCOM.RefreshEvent_arr[eventName()] &&
            oCOM.RefreshEvent_arr[eventName()].active);
    }
    function telemetryNumber(v,decimals,suffix)
    {
        return Number.isFinite(v)?v.toFixed(decimals)+(suffix||""):"—";
    }
    function telemetryText(name,value)
    {
        if(typeof(document)!=="object" || !document.getElementById)return;
        var target=document.getElementById(telemetryID(name));
        if(target)target.textContent=String(value);
    }
    function cpuClockRate()
    {
        if(typeof(_o)!=="undefined" && Number(_o.CPU_ClocksTicks_s)>0)
            return Number(_o.CPU_ClocksTicks_s);
        return 1021800;
    }
    this.getAudioTelemetry=function()
    {
        // Passive snapshot ONLY. It must not call advanceTo, read a live SID
        // register with timing side effects, or flush the browser PCM FIFO.
        var d=audioDevice(),pcm=getDeviceTelemetry();
        var cpuState=null;
        try{
            var cpu=typeof(apple2plus)!=="undefined" && apple2plus &&
                typeof(apple2plus.cpuObj)==="function"?apple2plus.cpuObj():null;
            if(cpu && typeof(cpu.watch)==="function"){
                var state=cpu.watch();
                cpuState={pc:state.pc,ic:state.ic,sp:state.sp};
            }
        }catch(e){}
        var tick=io&&typeof(io.getClockTicks)==="function" ?
            Number(io.getClockTicks()) : (pcm?pcm.cpuTick:0);
        if(!Number.isFinite(tick))tick=0;
        var now=typeof(performance)!=="undefined" &&
            performance && typeof(performance.now)==="function" ?
            performance.now() : Date.now();
        if(telemetryBaseline && now>telemetryBaseline.time &&
           tick>=telemetryBaseline.tick){
            var seconds=(now-telemetryBaseline.time)/1000;
            telemetryRates={
                cpuPacePercent:100*(tick-telemetryBaseline.tick)/
                    (cpuClockRate()*seconds),
                nativeWritesPerSecond:(sniffedWrites-telemetryBaseline.writes)/seconds,
                burstsPerSecond:(burstCount-telemetryBaseline.bursts)/seconds,
                producedPerSecond:pcm?
                    (pcm.produced-telemetryBaseline.produced)/seconds:0,
                scheduledPerSecond:pcm?
                    (pcm.scheduled-telemetryBaseline.scheduled)/seconds:0
            };
        }
        telemetryBaseline={time:now,tick:tick,writes:sniffedWrites,
            bursts:burstCount,produced:pcm?pcm.produced:0,
            scheduled:pcm?pcm.scheduled:0};
        var regs=d&&typeof d.getRegisters==="function"?d.getRegisters():null;
        var env=d&&typeof d.getEnvelopeLevels==="function"?d.getEnvelopeLevels():null;
        var voices=[];
        for(var v=0;v<3;v++){
            var control=regs?regs[7*v+4]:0;
            voices.push({voice:v+1,gate:!!(control&1),control:control,
                envelope:env?env[v]:null});
        }
        return {
            // mount.slotN is the emulator's +1 internal slot index.
            slot:card.mount&&Number.isInteger(Number(card.mount.slotN)) ?
                Math.max(0,Number(card.mount.slotN)-1):null,
            cpu:{tick:tick,clockHz:cpuClockRate(),state:cpuState,
                timingMode:typeof(oApple2Video)!=="undefined" && oApple2Video ?
                    oApple2Video.frameTiming:"unknown"},
            sid:{model:model,clockHz:clock,volumePct:volume,
                snooping:card.isSnoopEnabled(),voices:voices,
                nativeWrites:sniffedWrites,slotWrites:slotWrites,
                lastWrite:Object.assign({},lastWrite)},
            bursts:{count:burstCount,gapThresholdTicks:BURST_GAP_TICKS,
                currentWrites:currentBurstWrites,maxWrites:maxBurstWrites,
                measuredPeriods:periodCount,lastTicks:lastPeriod,
                minTicks:minPeriod,maxTicks:maxPeriod,
                meanTicks:periodCount?periodSum/periodCount:null,
                shortPeriods:shortPeriods,longPeriods:longPeriods,
                // These intervals describe SID write activity, not true
                // song PLAY frequency (silent frames can be omitted).
                estimatedHz:periodCount&&periodSum>0 ?
                    cpuClockRate()*periodCount/periodSum:null},
            audio:pcm,rates:Object.assign({},telemetryRates)
        };
    };
    this.resetAudioTelemetry=function()
    {
        // Never reset the actual SID chip, PCM source, or playback timeline.
        var d=audioDevice();
        if(d && typeof(d.resetAudioTelemetry)==="function")
            d.resetAudioTelemetry();
        resetBurstStats();
        telemetryBaseline=null;telemetryHistory=[];telemetryRates={};
        telemetryLastTime=null;
        return this.getAudioTelemetry();
    };
    this.getAudioTelemetryHistory=function(){return telemetryHistory.slice();};
    this.audioTelemetryRefresh=function()
    {
        if(typeof(document)!=="object" || !document.getElementById)return false;
        var popup=document.getElementById(telemetryID("popup"));
        if(!popup || popup.hidden){
            // Closing with the frame's X also stops the refresh loop.
            if(telemetryActive())oCOM.toggleRefreshEvent(eventName());
            return false;
        }
        var t=this.getAudioTelemetry(),p=t.audio||{},b=t.bursts;
        telemetryHistory.push({wallTime:Date.now(),...t});
        if(telemetryHistory.length>TELEMETRY_HISTORY_LIMIT)
            telemetryHistory.shift();
        var ms=function(ticks){return ticks===null?"—":
            telemetryNumber(1000*ticks/t.cpu.clockHz,2," ms");};
        telemetryText("model",t.sid.model+" / "+(t.sid.clockHz===985248?"PAL":"NTSC")+
            " / "+t.sid.clockHz+" Hz");
        telemetryText("context",(p.contextState||"unavailable")+
            " / "+(p.playbackEnabled?"ON":"off"));
        telemetryText("rates",(p.sampleRate||"—")+" / "+
            (p.outputSampleRate||"—")+" Hz");
        telemetryText("cpu",telemetryNumber(t.rates.cpuPacePercent,1,"%"));
        telemetryText("mode",t.cpu.timingMode||"unknown");
        telemetryText("pc",t.cpu.state && Number.isFinite(t.cpu.state.pc)?
            "$"+hex(t.cpu.state.pc&65535,4)+" / "+t.cpu.state.ic:"—");
        telemetryText("writes",t.sid.nativeWrites+" / "+
            telemetryNumber(t.rates.nativeWritesPerSecond,1," /s"));
        telemetryText("burst",b.count+" / "+
            telemetryNumber(t.rates.burstsPerSecond,1," /s"));
        telemetryText("interval",ms(b.lastTicks)+" / "+
            ms(b.minTicks)+" / "+ms(b.maxTicks));
        telemetryText("burst_warn",b.shortPeriods+" / "+b.longPeriods+
            " (under 14 / over 28 ms)");
        telemetryText("burst_size",b.currentWrites+" / "+b.maxWrites);
        telemetryText("envelopes",t.sid.voices.map(function(v){
            return "V"+v.voice+" "+(v.gate?"GATE":"off")+" / "+
                (v.envelope===null?"—":v.envelope);
        }).join(" · "));
        telemetryText("producer",p.produced+" / "+p.scheduled+" / "+p.dropped);
        telemetryText("pcm_rate",telemetryNumber(t.rates.producedPerSecond,0," /s")+
            " / "+telemetryNumber(t.rates.scheduledPerSecond,0," /s"));
        telemetryText("fifo",p.queued+" / "+p.capacityFrames+
            " ("+telemetryNumber(p.queuedMs,1," ms")+")");
        telemetryText("fifo_peak",p.maxQueueDepth+" / "+p.capacityFrames);
        telemetryText("lead",telemetryNumber(p.scheduledLeadMs,1," ms")+" / "+
            telemetryNumber(p.minLeadMs,1," ms")+" / "+
            telemetryNumber(p.maxLeadMs,1," ms"));
        telemetryText("prelead",telemetryNumber(p.preScheduleLeadMs,1," ms")+" / "+
            telemetryNumber(p.minPreScheduleLeadMs,1," ms"));
        telemetryText("clock",String(p.smallClockBacksteps||0)+" / "+
            String(p.clockRewinds||0)+" / "+
            String(p.maxClockBackstepTicks||0)+" ticks");
        telemetryText("discard",String(p.clearedSamples||0)+" / "+
            String(p.skippedSamples||0)+" / "+String(p.queueClears||0));
        telemetryText("events",String(p.recentAudioEvents||0));
        telemetryText("overflow",String(p.overflowIncidents||0)+" / "+
            String(p.dropped||0)+" frames / last @ "+
            (p.overflowLastCpuTick===null?"—":p.overflowLastCpuTick));
        telemetryText("service",String(p.realtimeServices||0)+" / "+
            String(p.cpuBudgetChecks||0)+" / "+String(p.cpuBudgetBlocked||0));
        telemetryText("underrun",(p.underruns||0)+" / "+
            telemetryNumber(p.lastLateMs,1," ms")+" / "+
            telemetryNumber(p.worstLateMs,1," ms"));
        telemetryText("sources",p.activeSources===undefined?"—":p.activeSources);
        telemetryText("last","$"+hex(t.sid.lastWrite.address,4)+
            "=$"+hex(t.sid.lastWrite.value,2)+" @ "+t.sid.lastWrite.tick);
        return t;
    };
    this.downloadAudioTelemetry=function()
    {
        if(typeof(oCOM)==="undefined" || typeof(oCOM.Download)!=="function" ||
           typeof(TextEncoder)==="undefined")return false;
        var snapshot=this.getAudioTelemetry();
        var data={format:"RetroAppleJS.SIDAudioTelemetry",version:1,
            slot:snapshot.slot,
            sampleRate:snapshot.audio?snapshot.audio.sampleRate:null,
            capturedAt:new Date().toISOString(),
            latest:snapshot,history:this.getAudioTelemetryHistory(),
            audioEvents:(function(){
                var d=audioDevice();
                return d&&typeof(d.getAudioEvents)==="function" ?
                    d.getAudioEvents():[];
            })()};
        oCOM.Download("SID_slot"+(data.slot===null?"x":data.slot)+
            "_audio_telemetry.json",
            new TextEncoder().encode(JSON.stringify(data,null,2)));
        return true;
    };
    this.toggleAudioTelemetrySync=function()
    {
        if(!ensureTelemetryEvent())return false;
        var active=oCOM.toggleRefreshEvent(eventName());
        var el=typeof(document)==="object"?
            document.getElementById(telemetryID("sync")):null;
        if(el){
            el.className=active?"fa fa-pause-circle":"fa fa-play-circle";
            el.title=active?"Pause SID live telemetry":"Start SID live telemetry";
        }
        var label=typeof(document)==="object"?
            document.getElementById(telemetryID("sync_label")):null;
        if(label)label.textContent=active?"Pause":"Start";
        if(active)this.audioTelemetryRefresh();
        return active;
    };
    // Position within the Tools popup host, aligned with the SID toolbox.
    // Use bounding rectangles so other floated toolboxes don't affect the
    // placement; place below the toolbox if there isn't room alongside it.
    function positionTelemetryPopup(popup,host)
    {
        var toolbox=toolboxID && document.getElementById(toolboxID);
        if(!toolbox || typeof toolbox.getBoundingClientRect!=="function" ||
           typeof host.getBoundingClientRect!=="function")return;
        var box=toolbox.getBoundingClientRect();
        var hostBox=host.getBoundingClientRect();
        var vw=typeof(window)==="object" && Number(window.innerWidth)>0?
            window.innerWidth:1200;
        var vh=typeof(window)==="object" && Number(window.innerHeight)>0?
            window.innerHeight:800;
        var panelWidth=Math.min(560,Math.max(0,vw-24));
        var panelHeight=Math.min(410,Math.max(0,vh-24));
        var left=box.right+8,top=box.top;
        if(left+panelWidth>vw-12){
            if(box.left-panelWidth-8>=12)left=box.left-panelWidth-8;
            else {
                left=Math.max(12,Math.min(box.left,vw-panelWidth-12));
                top=box.bottom+8;
            }
        }
        top=Math.max(12,Math.min(top,vh-panelHeight-12));
        popup.style.left=(left-hostBox.left+(host.scrollLeft||0))+"px";
        popup.style.top=(top-hostBox.top+(host.scrollTop||0))+"px";
    }
    this.openAudioTelemetry=function()
    {
        if(typeof(document)!=="object" || !document.createElement ||
           typeof(oCOM)==="undefined" || !oCOM.POPUP)return false;
        if(!ensureTelemetryEvent())return false;
        var id=telemetryID("popup");
        var host=document.getElementById("tab1.2")||document.body;
        var popup=document.getElementById(id);
        if(!popup){
            popup=document.createElement("div");
            popup.id=id;popup.hidden=true;
            popup.className="appbox com_popup_frame";
            popup.style.cssText="position:absolute;z-index:4;left:0;top:0;"+
                "width:560px;max-width:calc(100vw - 24px);"+
                "height:410px;max-height:calc(100vh - 24px);"+
                "text-align:left;padding:0;margin:0";
        }
        if(popup.parentNode!==host)host.appendChild(popup);
        if(!popup.hidden){
            this.closeAudioTelemetry();
            return false;
        }
        positionTelemetryPopup(popup,host);
        var access="apple2plus.hwObj().io.HASH2obj("+slotHash()+")";
        var sections=[
            ["model","SID MODEL / CLOCK"],["context","WEB AUDIO CONTEXT"],
            ["rates","SAMPLE RATE (PCM / OUTPUT)"],["cpu","CPU WALL PACE"],
            ["mode","VIDEO TIMING MODE"],["pc","CPU PC / INS"],
            ["writes","NATIVE SID WRITES / RATE"],
            ["burst","WRITE BURSTS / RATE (HEURISTIC)"],
            ["interval","BURST INTERVAL LAST / MIN / MAX"],
            ["burst_warn","BURST INTERVAL SHORT / LONG"],
            ["burst_size","WRITES IN BURST / PEAK"],
            ["envelopes","VOICE GATE / ENVELOPE (0–255)"],
            ["producer","PCM PRODUCED / SCHEDULED / DROPPED"],
            ["pcm_rate","PCM PRODUCE / SCHEDULE RATE"],
            ["fifo","PCM FIFO / CAPACITY"],["fifo_peak","PCM FIFO HIGH WATER"],
            ["lead","BROWSER LEAD NOW / MIN / MAX"],
            ["prelead","PRE-SERVICE LEAD LAST / MIN"],
            ["clock","CLOCK BACKSTEPS / REWINDS / MAX"],
            ["discard","PCM QUEUE-CLEARED / SKIPPED / EVENTS"],
            ["events","AUDIO EXCEPTION EVENTS (JSON)"],
            ["overflow","FIFO OVERFLOWS / DROPPED / LAST CPU TICK"],
            ["service","AUDIO SERVICE / CPU BUDGET / BLOCKED"],
            ["underrun","UNDERRUNS / LAST LATE / WORST LATE"],
            ["sources","ACTIVE BROWSER SOURCES"],
            ["last","LAST SID WRITE / CPU TICK"]
        ];
        var html="<div style='padding:5px 7px;font-family:monospace;font-size:12px;text-align:left'>"+
            "<div style='display:flex;gap:6px;margin-bottom:5px'>"+
            "<button class=appbut title='Pause or resume live SID telemetry' onclick='"+
                 access+"?.toggleAudioTelemetrySync()'>"+
            "<i id='"+telemetryID("sync")+"' class='fa fa-play-circle'></i> "+
            "<span id='"+telemetryID("sync_label")+"'>Start</span></button>"+
            "<button class=appbut title='Reset statistics without muting or resetting SID' onclick='"+
                 access+"?.resetAudioTelemetry();"+access+"?.audioTelemetryRefresh()'>"+
            "<i class='fa fa-undo'></i> Reset</button>"+
            "<button class=appbut title='Export SID telemetry (up to 60 s) as JSON' onclick='"+
                 access+"?.downloadAudioTelemetry()'>"+
            "<i class='fa fa-cloud-download-alt'></i> JSON</button></div>"+
            "<table style='width:100%;border-collapse:collapse;table-layout:fixed;text-align:left'>";
        for(var i=0;i<sections.length;i++)
            html+="<tr><td style='width:47%;padding:2px 7px 2px 0;vertical-align:top;text-align:left'>"+
                sections[i][1]+"</td><td style='padding:2px 0;vertical-align:top;text-align:left;overflow-wrap:anywhere' id='"+
                telemetryID(sections[i][0])+"'>—</td></tr>";
        html+="</table><div style='margin-top:6px;font:11px Arial'>"+
            "Write bursts are clusters separated by more than 3.4 ms of "+
            "emulated CPU time; they are <b>not</b> exact music PLAY calls. "+
            "CPU wall pace can reveal emulator stalls; lead, underruns and "+
            "queue flushes reveal browser audio starvation. JSON includes the "+
            "last 32 detailed audio exceptions. The 120 most "+
            "recent half-second snapshots can be exported as JSON."+
            "</div></div>";
        var close="<div class=appbut onclick=\""+access+
            "?.closeAudioTelemetry();event.stopPropagation()\" "+
            "style='text-align:center;float:right'>x</div>";
        popup.innerHTML=oCOM.POPUP.title_body_html(
            "SID LIVE AUDIO TELEMETRY"+close,html,
            telemetryID("body"),"com_popup_body com_scroll_xy");
        // A newly opened panel shows one snapshot but does not run live
        // sampling until the user explicitly presses Start.
        if(telemetryActive())oCOM.toggleRefreshEvent(eventName());
        oCOM.POPUP.toggle(id);
        this.audioTelemetryRefresh();
        return true;
    };
    this.closeAudioTelemetry=function()
    {
        var popup=typeof(document)==="object"?
            document.getElementById(telemetryID("popup")):null;
        if(!popup || popup.hidden)return false;
        oCOM.POPUP.toggle(telemetryID("popup"));
        if(telemetryActive())oCOM.toggleRefreshEvent(eventName());
        return true;
    };

    this.reset=function()
    {
        timerStop();timerPeriod=20436;timerFired=timerMissed=0;
        // Model, clock and user volume intentionally survive a soft reset.
        enabled=true;snoop=true;regIndex=0;sniffedWrites=slotWrites=0;
        lastWrite={address:0,value:0,tick:0};
        clockLatch=0;
        resetBurstStats();telemetryBaseline=null;telemetryRates={};
        telemetryHistory=[];
        var d=audioDevice();
        if(d&&typeof d.reset==="function")d.reset();
    };
    this.restart=function()
    {
        if(typeof apple2plus!=="undefined" && apple2plus &&
           typeof apple2plus.hwObj==="function"){
            var hw=apple2plus.hwObj();
            if(io && io!==hw.io && typeof io.unregisterPeripheralTick==="function")
                io.unregisterPeripheralTick(this);
            io=hw&&hw.io?hw.io:null;
            if(io && typeof io.registerPeripheralTick==="function")
                io.registerPeripheralTick(this,this.timerTick.bind(this));
            if(timerSource && hw && typeof hw.setIRQSource==="function")
                hw.setIRQSource(timerSource,false);
            timerSource="SID_TIMER_"+String(this.mount&&this.mount.hash||this.mount&&this.mount.slotN||"unmounted");
        }
        this.state.active=true;
        this.reset();
    };
    this.onUnmount=function()
    {
        if(typeof SIDPSID!=="undefined" && SIDPSID)SIDPSID.dispose(this);
        if(telemetryActive())oCOM.toggleRefreshEvent(eventName());
        timerStop();
        if(io && typeof io.unregisterPeripheralTick==="function")
            io.unregisterPeripheralTick(this);
        this.state.active=false;
        var d=audioDevice();
        if(d&&typeof d.onUnmount==="function")d.onUnmount();
    };
    this.openPSIDTransfer=function()
    {
        if(typeof SIDPSID==="undefined" || !SIDPSID) return false;
        return SIDPSID.open(this);
    };
    this.deviceToolSlotHTML=function(ctx)
    {
        ctx=ctx||{};
        toolboxID=ctx.toolboxID||"device_tool_"+ctx.slotID;
        var access="apple2plus.hwObj().io.HASH2obj("+Number(this.mount?.hash||0)+")";
        var selModel="<select title='SID model' aria-label='SID model' onchange='"+access+"?.setModel(Number(this.value))'>"+
            "<option value='6581'"+(model===6581?" selected":"")+">6581</option>"+
            "<option value='8580'"+(model===8580?" selected":"")+">8580</option></select>";
        var selClock="<select title='SID clock' aria-label='SID clock' onchange='"+access+"?.setClock(Number(this.value))'>"+
            "<option value='985248'"+(clock===985248?" selected":"")+">PAL 985248 Hz</option>"+
            "<option value='1022727'"+(clock===1022727?" selected":"")+">NTSC 1022727 Hz</option></select>";
        return "<div class='toolbox' id='"+toolboxID+"' hidden>"+
            "<div class='appbox' style='width:340px;height:80px;min-height:80px;"+
            "box-sizing:border-box;padding:3px 7px;display:flex;flex-direction:column;"+
            "justify-content:space-around;gap:1px;text-align:left'>"+
            "<div class='sid-toolbox-row' style='display:flex;gap:7px;align-items:center;white-space:nowrap'>"+
            "<label style='display:inline-flex;align-items:center;gap:3px;min-height:0'>SID "+selModel+"</label>"+
            "<label style='display:inline-flex;align-items:center;gap:3px;min-height:0'>Clock "+selClock+"</label></div>"+
            "<div class='sid-toolbox-row' style='display:flex;gap:7px;align-items:center;white-space:nowrap'>"+
            "<label style='display:inline-flex;align-items:center;min-height:0' title='Intercept CPU writes to $D400-$D41F'>"+
            "<input type='checkbox' "+(snoop?"checked ":"")+"onchange='"+access+"?.setSnoopEnabled(this.checked)'>Native $D400 writes</label>"+
            "<label style='display:inline-flex;align-items:center;gap:3px;min-height:0'>Volume "+
            "<input type='range' min='0' max='100' value='"+volume+"' "+
            "oninput='"+access+"?.setVolume(Number(this.value))' style='width:80px'></label></div>"+
            "<div class='sid-toolbox-row' style='display:flex;gap:7px;align-items:center;white-space:nowrap'>"+
            "<button class='appbut' title='SID live audio telemetry' aria-label='SID live audio telemetry' onclick='"+
            access+"?.openAudioTelemetry()'><i class='fa fa-chart-line'></i> Telemetry</button>"+
            "<button class='appbut' title='Raw PSID file transfer' aria-label='Open PSID file transfer' onclick='"+
            access+"?.openPSIDTransfer()'><i class='fa fa-folder-open'></i> PSID</button>"+
            "<span style='font:11px Arial;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis' title='Unchanged Apple II ROM and Language Card mapping'>"+
            "$D400–$D41F · "+(audioDevice()?"Audio attached":"Attach SIDAUDIO")+"</span>"+
            "</div></div></div>";
    };
}
