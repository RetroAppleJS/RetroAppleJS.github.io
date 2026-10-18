// Live telemetry for tools/SIDchipJS.html.
// Same top-level format as EMU_CARD_SID, with tool-specific audio diagnostics.
(function(root){
    'use strict';
    var GAP_TICKS=3500, CLOCK=985248, VIDEO_HZ=50, HISTORY_LIMIT=120;
    var player=null,live=false,timer=null,history=[],baseline=null,rates={};
    var writes=0,bursts=0,currentWrites=0,maxWrites=0;
    var lastWriteTick=null,lastBurstTick=null,periodCount=0,periodSum=0;
    var lastPeriod=0,minPeriod=null,maxPeriod=0,shortPeriods=0,longPeriods=0;
    var lastWrite={address:0,value:0,tick:0}, lastSnapshot=null;
    function byId(id){return typeof document!=='undefined'?document.getElementById(id):null;}
    function now(){return typeof performance!=='undefined' && performance.now?performance.now():Date.now();}
    function number(value,precision,suffix) {
        return Number.isFinite(value)?value.toFixed(precision)+(suffix||''):'—';
    }
    function hex(value,digits){return (value>>>0).toString(16).toUpperCase().padStart(digits,'0');}
    function set(id,value){var el=byId('sidLive_'+id);if(el)el.textContent=String(value);}
    function observeWrite(address,value,tick) {
        if(!Number.isFinite(tick))return;
        // A native write burst is not necessarily a PSID PLAY invocation.
        if(lastWriteTick===null || tick<lastWriteTick || tick-lastWriteTick>GAP_TICKS){
            if(lastBurstTick!==null && tick>=lastBurstTick){
                var delta=tick-lastBurstTick;
                lastPeriod=delta;periodCount++;periodSum+=delta;
                minPeriod=minPeriod===null?delta:Math.min(minPeriod,delta);
                maxPeriod=Math.max(maxPeriod,delta);
                if(delta<0.70*CLOCK/VIDEO_HZ)shortPeriods++;
                if(delta>1.40*CLOCK/VIDEO_HZ)longPeriods++;
            }
            lastBurstTick=tick;currentWrites=0;bursts++;
        }
        lastWriteTick=tick;currentWrites++;maxWrites=Math.max(maxWrites,currentWrites);
        writes++;lastWrite={address:address,value:value,tick:tick};
    }
    function attach(p) {
        if(player && player!==p && player.setLiveTelemetryObserver)
            player.setLiveTelemetryObserver(null);
        player=p||null;
        if(player && player.setLiveTelemetryObserver){
            var state=player.getLiveTelemetryState();
            CLOCK=state.clockHz;
            VIDEO_HZ=state.frameRate;
            player.setLiveTelemetryObserver(observeWrite);
        }
    }
    function reset(){
        writes=bursts=currentWrites=maxWrites=periodCount=periodSum=0;
        lastWriteTick=lastBurstTick=null;lastPeriod=maxPeriod=shortPeriods=longPeriods=0;
        minPeriod=null;lastWrite={address:0,value:0,tick:0};
        history=[];baseline=null;rates={};lastSnapshot=null;
        if(player && player.resetLiveTelemetryCounters)player.resetLiveTelemetryCounters();
        refresh();
    }
    function snapshot(){
        if(!player || !player.getLiveTelemetryState)return null;
        var state=player.getLiveTelemetryState(), t=now(),audio=state.audio||{};
        CLOCK=state.clockHz;
        VIDEO_HZ=state.frameRate;
        var tick=state.cpu.tick;
        if(baseline && t>baseline.time && tick>=baseline.tick &&
            audio.produced>=baseline.produced && writes>=baseline.writes){
            var seconds=(t-baseline.time)/1000;
            rates={
                cpuPacePercent:100*(tick-baseline.tick)/(CLOCK*seconds),
                nativeWritesPerSecond:(writes-baseline.writes)/seconds,
                burstsPerSecond:(bursts-baseline.bursts)/seconds,
                producedPerSecond:(audio.produced-baseline.produced)/seconds,
                scheduledPerSecond:null
            };
        }
        baseline={time:t,tick:tick,writes:writes,bursts:bursts,produced:audio.produced};
        var voices=[];
        for(var i=0;i<3;i++){
            var ctrl=state.registers[i*7+4]||0;
            voices.push({voice:i+1,gate:!!(ctrl&1),control:ctrl,
                envelope:state.envelopes[i]});
        }
        var a={
            cpuTick:tick,produced:audio.produced,scheduled:null,dropped:null,
            queued:null,queuedMs:null,capacityFrames:null,maxQueueDepth:null,
            scheduledLeadMs:null,minLeadMs:null,maxLeadMs:null,
            underruns:null,lastLateMs:null,worstLateMs:null,activeSources:null,
            sampleRate:audio.sampleRate,requestedSampleRate:audio.requestedSampleRate,
            outputSampleRate:audio.outputSampleRate,
            contextState:audio.contextState,playbackEnabled:audio.playbackEnabled,
            // ScriptProcessor-specific: not equivalent to emulator underruns.
            callbackFrames:audio.bufferFrames,callbacks:audio.callbacks,
            lastCallbackMs:audio.lastCallbackMs,worstCallbackMs:audio.worstCallbackMs,
            lastCallbackGapMs:audio.lastGapMs,worstCallbackGapMs:audio.worstGapMs,
            callbackOverruns:audio.callbackOverruns
        };
        var result={
            slot:null,
            cpu:{tick:tick,clockHz:CLOCK,
                state:{pc:state.cpu.pc,ic:state.cpu.ic,sp:state.cpu.sp},
                timingMode:'PSID '+state.videoStandard+' / '+state.frameRate+' Hz'+
                    (state.initialized?' playback':' (not initialized)')},
            sid:{model:state.model,clockHz:state.clockHz,videoStandard:state.videoStandard,
                frameRate:state.frameRate,playCallHz:state.playCallHz,
                volumePct:state.volumePct,
                snooping:true,voices:voices,nativeWrites:writes,slotWrites:0,
                lastWrite:Object.assign({},lastWrite)},
            bursts:{count:bursts,gapThresholdTicks:GAP_TICKS,
                currentWrites:currentWrites,maxWrites:maxWrites,
                measuredPeriods:periodCount,lastTicks:lastPeriod,minTicks:minPeriod,
                maxTicks:maxPeriod,meanTicks:periodCount?periodSum/periodCount:null,
                shortPeriods:shortPeriods,longPeriods:longPeriods,
                estimatedHz:periodSum?CLOCK*periodCount/periodSum:null},
            audio:a,rates:Object.assign({},rates),
            source:'SIDchipJS',subtune:state.subtune,playtime:state.playtime
        };
        lastSnapshot=result;
        return result;
    }
    function refresh(){
        var s=snapshot();
        if(!s)return null;
        var a=s.audio,b=s.bursts,r=s.rates;
        history.push(Object.assign({wallTime:Date.now()},s));
        if(history.length>HISTORY_LIMIT)history.shift();
        function ms(ticks){return ticks===null?'—':number(ticks*1000/CLOCK,2,' ms');}
        set('model',s.sid.model+' / '+s.sid.videoStandard+' / '+s.sid.clockHz+' Hz');
        set('context',a.contextState+' / '+(a.playbackEnabled?'ON':'off'));
        set('rates',a.sampleRate+' / '+(a.outputSampleRate||'—')+
            ' Hz (requested '+(a.requestedSampleRate||'default')+')');
        set('cpu',number(r.cpuPacePercent,1,'%'));
        set('mode',s.cpu.timingMode+' / subtune '+s.subtune);
        set('pc','$'+hex(s.cpu.state.pc,4)+' / '+s.cpu.state.ic);
        set('writes',s.sid.nativeWrites+' / '+number(r.nativeWritesPerSecond,1,' /s'));
        set('burst',b.count+' / '+number(r.burstsPerSecond,1,' /s'));
        set('interval',ms(b.lastTicks)+' / '+ms(b.minTicks)+' / '+ms(b.maxTicks));
        set('burst_warn',b.shortPeriods+' / '+b.longPeriods+
            ' (under '+number(700/VIDEO_HZ,1,' ms')+' / over '+
            number(1400/VIDEO_HZ,1,' ms')+')');
        set('burst_size',b.currentWrites+' / '+b.maxWrites);
        set('envelopes',s.sid.voices.map(function(v){
            return 'V'+v.voice+' '+(v.gate?'GATE':'off')+' / '+v.envelope;
        }).join(' · '));
        set('producer',a.produced+' / — / —');
        set('pcm_rate',number(r.producedPerSecond,0,' /s')+' / —');
        set('fifo','— (ScriptProcessor)');
        set('fifo_peak','—');
        set('lead','— (ScriptProcessor)');
        set('underrun','— (callback overruns below)');
        set('sources','— (ScriptProcessor)');
        set('callback',a.callbacks+' / '+a.callbackFrames+' frames');
        set('callback_duration',number(a.lastCallbackMs,2,' ms')+' / '+
            number(a.worstCallbackMs,2,' ms'));
        set('callback_gap',number(a.lastCallbackGapMs,2,' ms')+' / '+
            number(a.worstCallbackGapMs,2,' ms'));
        set('overruns',a.callbackOverruns+' (callback compute time > block duration)');
        set('last','$'+hex(s.sid.lastWrite.address,4)+'=$'+
            hex(s.sid.lastWrite.value,2)+' @ '+s.sid.lastWrite.tick);
        return s;
    }
    function setLive(active){
        live=!!active;
        if(timer!==null){clearInterval(timer);timer=null;}
        if(live)timer=setInterval(function(){
            var panel=byId('sidLivePanel');
            if(!panel || panel.hidden){setLive(false);return;}
            refresh();
        },500);
        var label=byId('sidLiveToggle');
        if(label)label.textContent=live?'Pause':'Start';
    }
    function togglePanel(){
        var panel=byId('sidLivePanel');if(!panel)return;
        panel.hidden=!panel.hidden;
        if(panel.hidden)setLive(false);
        else refresh(); // initial passive snapshot, live remains off
    }
    function download(){
        var s=snapshot();
        if(!s)return false;
        var data={format:'RetroAppleJS.SIDAudioTelemetry',version:1,
            slot:null,sampleRate:s.audio.sampleRate,capturedAt:new Date().toISOString(),
            source:'SIDchipJS',videoStandard:s.sid.videoStandard,
            requestedSampleRate:s.audio.requestedSampleRate,
            latest:s,history:history.slice(),
            notes:'ScriptProcessor callback timing is not the emulator AudioBufferSource scheduling telemetry. Null means unavailable, not zero.'};
        var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
        var url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='SIDchipJS_audio_telemetry.json';
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(url);},1000);
        return true;
    }
    root.sidLiveTelemetry={attach:attach,reset:reset,snapshot:snapshot,
        refresh:refresh,togglePanel:togglePanel,toggleLive:function(){setLive(!live);},
        setLive:setLive,download:download,getHistory:function(){return history.slice();}};
})(typeof window!=='undefined'?window:globalThis);
