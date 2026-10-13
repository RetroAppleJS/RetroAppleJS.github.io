'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function sinkRig()
{
    let now=0;
    const buffers=[];
    class FakeAudioContext {
        constructor(){this.state='running';this.sampleRate=48000;this.currentTime=0;this.destination={};}
        createGain(){return {gain:{value:0},connect(){}};}
        createBuffer(channels,length,rate){
            const data=[new Float32Array(length),new Float32Array(length)];
            const b={duration:length/rate,getChannelData(i){return data[i];}};
            buffers.push(b);return b;
        }
        createBufferSource(){
            return {buffer:null,playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(){},onended:null};
        }
        async resume(){this.state='running';}
        async suspend(){this.state='suspended';}
    }
    const context=vm.createContext({_o:{CPU_TargetTicks_s:1021800,EMU_IntervalTime_ms:1000/60},
        AudioContext:FakeAudioContext,console});
    const src=fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_mockingboard_audio.js'),'utf8');
    vm.runInContext(src,context);
    const sink=new context.MockingboardAudio();
    let consumed=0;
    const owner={
        id:{PCODE:'MOCK'},setTimingRefreshCallback(){},setAudioConsumerActive(){},clearAudioQueue(){},
        advanceTo(){},getAudioBufferedSeconds(){return 0;},
        getAudioFramesAvailable(){return 220;},
        getAudioEpoch(){return 1;},getAudioFormat(){return {sampleRate:22050};},
        drainAudioFrames(n){
            const count=Math.min(n,220);
            consumed+=count;
            return {frames:count,left:new Float32Array(count),right:new Float32Array(count)};
        }
    };
    sink.bindHost(owner);
    sink.bindIO({getClockTicks(){return 17030;}});
    return {sink,buffers,owner,setNow(t){now=t;}};
}

test('Mockingboard audio telemetry retains active playback when counters reset',async()=>{
    const r=sinkRig();
    await r.sink.init('audio_on');
    r.sink.cycle();
    let d=r.sink.getStats();
    assert.ok(d.framesScheduled>0);
    assert.equal(d.outputSampleRate,48000);
    assert.equal(d.activeSources,1);
    assert.ok(d.queuedLead_ms>0);
    assert.ok(d.cycleCalls>0);
    assert.equal(typeof d.maxLead_ms,'number');
    assert.equal(typeof d.emptyFifoCycles,'number');

    const beforeSources=d.activeSources;
    r.sink.resetAudioTelemetry();
    d=r.sink.getStats();
    assert.equal(d.buffersScheduled,0);
    assert.equal(d.underruns,0);
    assert.equal(d.activeSources,beforeSources);
    assert.equal(d.playbackEnabled,true);
});

test('late Mockingboard WebAudio scheduling records last and worst lateness',async()=>{
    const r=sinkRig();
    await r.sink.init('audio_on');
    r.sink.cycle();
    r.sink.audio.currentTime=0.15;
    r.sink.cycle();
    const d=r.sink.getStats();
    assert.equal(d.underruns,1);
    assert.ok(d.lastLate_ms>0);
    assert.equal(d.lastLate_ms,d.worstLate_ms);
});

function cardRig()
{
    let time=0;
    const nodes=new Map();
    function Element(){this.hidden=true;this.className='';this.style={};this.parentNode=null;this.innerHTML='';this.title='';}
    const doc={
        body:{appendChild(el){el.parentNode=this;nodes.set(el.id,el);}},
        getElementById(id){return nodes.get(id)||null;},
        createElement(){return new Element();}
    };
    const refresh={};
    const oCOM={
        RefreshEvent_arr:refresh,
        addRefreshEvent(fn,name,active){refresh[name]={func:fn,active};},
        toggleRefreshEvent(name){refresh[name].active=!refresh[name].active;return refresh[name].active;},
        POPUP:{
            toggle(id){doc.getElementById(id).hidden=!doc.getElementById(id).hidden;},
            title_body_html(title,body){return title+body;}
        }
    };
    class AYSourceClock{
        constructor(){this.rateNumerator=1021800;this.rateDenominator=1;}
        setRate(){}
        map(t){return Math.floor(t*1000000000/1021800);}
        saveState(){return {nominalHz:1021800,cpuOrigin:0};}
    }
    const fakeCore={
        backend:'js',
        destroy(){},getPosition(o){o.tick=0;o.samplePhase=0;o.renderedFrames=0;},
        renderUntil(){return 0;}
    };
    class AYChipDevice{
        bindCore(){}configure(){}setMix(){}writeNow(){}acceptWrite(){}acceptReset(){}
    }
    AYChipDevice.createCore=()=>fakeCore;
    const AYCore={
        configuration:x=>x,createJS:()=>fakeCore,
        error:(code,message)=>new Error(code+':'+message),
        packEvent(){},eventTick(){return 0;}
    };
    const context=vm.createContext({
        console,performance:{now:()=>time},document:doc,oCOM,
        oEMU:{component:{IO:{}}},_o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800},
        AYChipDevice,AYSourceClock,AYCore,
        window:{},setTimeout,clearTimeout
    });
    const src=fs.readFileSync(path.join(__dirname,'../res/EMU_CARD_mockingboard.js'),'utf8');
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_mockingboard_voice.js'),'utf8'),context);
    vm.runInContext(src,context);
    const card=context.oEMU.component.IO.mockingboard;
    card.mount={hash:42,slotN:4};
    card.devices=[{id:{DCODE:'MOCKAUDIO'},getStats(){return {
        contextState:'running',outputSampleRate:48000,queuedLead_ms:31,
        minLead_ms:12,maxLead_ms:50,underruns:0,framesScheduled:200,
        activeSources:1,cpuBudgetChecks:4,cpuBudgetBlocked:1
    };},resetAudioTelemetry(){}}];
    return {card,doc,refresh,setTime(x){time=x;}};
}

test('Mockingboard card offers two-column audio/voice controls and 500ms dashboard-sync toggle',()=>{
    const r=cardRig();
    const html=r.card.deviceToolSlotHTML({slotID:4,toolboxID:'device_tool_4'});
    assert.match(html,/openAudioTelemetry/);
    assert.equal(r.card.openAudioTelemetry(),true);
    const popup=r.doc.getElementById('MOCK_history_42_audio_popup');
    assert.ok(popup);
    assert.match(popup.style.cssText,/width:800px/);
    assert.match(popup.innerHTML,/mockingboard-control-columns/);
    assert.match(popup.innerHTML,/SSI-263 voice/);
    assert.match(popup.innerHTML,/PCM FIFO/);
    assert.match(popup.innerHTML,/CPU BUDGET BLOCK/);
    assert.equal(r.refresh.MOCK_history_42_audio_refresh.active,false);
    assert.equal(r.card.toggleAudioTelemetrySync(),true);
    assert.equal(r.refresh.MOCK_history_42_audio_refresh.active,true);
    const d=r.card.getAudioTelemetry();
    assert.equal(d.sampleRate,22050);
    assert.equal(d.sink.contextState,'running');
    assert.equal(d.pcm.capacityFrames,Math.ceil(22050*.25));
    assert.equal(r.card.toggleAudioTelemetrySync(),false);
    r.card.resetAudioTelemetry();
    assert.equal(r.card.peekAudioStats().overruns,0);
});

test('Mockingboard telemetry retains a bounded rolling history and reset clears it',()=>{
    const r=cardRig();
    r.card.deviceToolSlotHTML({slotID:4,toolboxID:'device_tool_4'});
    r.card.openAudioTelemetry();
    for(let i=1;i<=130;i++)
    {
        r.setTime(i*500);
        r.card.audioTelemetryRefresh();
    }
    const history=r.card.getAudioTelemetryHistory();
    assert.equal(history.length,120);
    assert.equal(history[0].sampleRate,22050);
    assert.equal(history.at(-1).sink.contextState,'running');
    r.card.resetAudioTelemetry();
    assert.equal(r.card.getAudioTelemetryHistory().length,0);
});
