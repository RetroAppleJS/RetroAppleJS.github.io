'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function rig(){
    let now=1000,download=null;
    const elements={};
    function element(id){return elements[id]||(elements[id]={id,hidden:true,textContent:'',
        style:{},click(){},appendChild(){},removeChild(){}});}
    element('sidLivePanel');
    const document={getElementById:element,createElement(){return element('link')},
        body:element('body')};
    const sandbox=vm.createContext({console,Math,Number,Date,Uint8Array,
        Blob:class{constructor(data){this.data=data}},
        URL:{createObjectURL(){return 'blob:mock'},revokeObjectURL(){}},
        document,performance:{now(){return now}},setInterval(){return 1;},
        clearInterval(){},setTimeout(fn){fn()}});
    sandbox.window=sandbox;
    vm.runInContext(fs.readFileSync(path.join(root,'tools','SID_LiveTelemetry.js'),'utf8'),sandbox);
    const state={model:6581,clockHz:985248,volumePct:100,subtune:5,
        playtime:0,initialized:true,videoStandard:'PAL',frameRate:50,playCallHz:50,
        cpu:{tick:0,pc:8192,ic:0,sp:255},
        registers:Array(32).fill(0),envelopes:[2,3,4],
        audio:{sampleRate:48000,requestedSampleRate:48000,outputSampleRate:48000,
            contextState:'running',playbackEnabled:true,bufferFrames:16384,
            callbacks:2,produced:32768,lastCallbackMs:2,worstCallbackMs:3,
            lastGapMs:340,worstGapMs:350,callbackOverruns:0}};
    let observer=null,resets=0;
    const player={setLiveTelemetryObserver(fn){observer=fn},
        resetLiveTelemetryCounters(){resets++},
        getLiveTelemetryState(){return state}};
    const api=sandbox.sidLiveTelemetry;api.attach(player);
    return {api,state,elements,now(v){now=v},observer(){return observer},resets(){return resets}};
}
test('SIDchipJS panel uses emulator v1 telemetry envelope with explicit unavailable metrics',()=>{
    const r=rig();
    assert.equal(r.api.getHistory().length,0);
    r.api.togglePanel();
    assert.equal(r.elements.sidLivePanel.hidden,false);
    r.observer()(0xD404,0x11,100);
    r.observer()(0xD405,0xF0,120);
    r.observer()(0xD404,0x10,20436);
    const s=r.api.snapshot();
    assert.equal(s.sid.nativeWrites,3);
    assert.equal(s.bursts.count,2);
    assert.equal(s.bursts.lastTicks,20336);
    assert.equal(s.sid.voices[0].control,0); // reported current register, not write history
    assert.equal(s.audio.sampleRate,48000);
    assert.equal(s.audio.queued,null);
    assert.equal(s.audio.underruns,null);
    assert.equal(s.audio.callbackOverruns,0);
    assert.equal(s.source,'SIDchipJS');
    assert.equal(r.api.getHistory().length,1);
    r.api.toggleLive();
    assert.equal(r.elements.sidLiveToggle.textContent,'Pause');
    r.api.togglePanel();
    assert.equal(r.elements.sidLivePanel.hidden,true);
    assert.equal(r.elements.sidLiveToggle.textContent,'Start');
});
test('telemetry history is bounded and reset does not modify player state',()=>{
    const r=rig();
    r.api.togglePanel();
    for(let i=0;i<140;i++){r.now(1000+500*i);r.state.cpu.tick=i*10200;r.api.refresh();}
    assert.equal(r.api.getHistory().length,120);
    r.api.reset();
    assert.equal(r.state.cpu.tick,139*10200);
    assert.equal(r.resets(),1);
    assert.equal(r.api.getHistory().length,1); // reset paints a fresh snapshot
    assert.equal(r.api.snapshot().bursts.count,0);
});
test('SIDchipJS markup includes the live telemetry controls and bounded panel',()=>{
    const html=fs.readFileSync(path.join(root,'tools','SIDchipJS.html'),'utf8');
    assert.match(html,/SID LIVE AUDIO TELEMETRY/);
    assert.match(html,/src="SID_LiveTelemetry.js"/);
    assert.match(html,/width:560px/);
    assert.match(html,/height:410px/);
    assert.match(html,/overflow:auto/);
    assert.match(html,/sidLiveTelemetry\.attach\(SIDplayer\)/);
});
