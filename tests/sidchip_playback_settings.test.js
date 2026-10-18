'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const lib=fs.readFileSync(path.join(__dirname,'../res/jsSID.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../tools/SIDchipJS.html'),'utf8');

function tinyPSID(useCIA=false) {
    const file=Buffer.alloc(0x80);
    file.write('PSID',0,4,'ascii');
    file.writeUInt16BE(2,4);
    file.writeUInt16BE(0x7c,6);
    file.writeUInt16BE(0x1000,0x0a); // INIT
    file.writeUInt16BE(0x1001,0x0c); // PLAY
    file.writeUInt16BE(1,0x0e); // subtunes
    file.writeUInt16BE(1,0x10); // start song
    if(useCIA)file[0x15]=1; // subtune 0 CIA bit
    file.writeUInt16LE(0x1000,0x7c); // load address
    file[0x7e]=file[0x7f]=0x60; // RTS at both entrypoints
    return file.toString('base64');
}
function rig(acceptRequested=true) {
    const contexts=[];
    class FakeAudioContext {
        constructor(options) {
            this.sampleRate=acceptRequested ? (options?.sampleRate||48000) : 48000;
            this.state='running';
            this.destination={};this.closed=false;
            contexts.push(this);
        }
        createScriptProcessor(frames) {
            return {frames,connect(){},disconnect(){},onaudioprocess:null};
        }
        close(){this.closed=true;return Promise.resolve();}
    }
    const sandbox=vm.createContext({
        console:{log(){}},Math,Number,Date,Uint8Array,Float32Array,
        AudioContext:FakeAudioContext,
        window:{atob(data){return Buffer.from(data,'base64').toString('latin1');}},
        performance:{now(){return 1000}}
    });
    vm.runInContext(lib,sandbox,{filename:'jsSID.js'});
    return {create(frames,options){return new sandbox.jsSID(frames,0.0005,options);},
        contexts};
}

test('PAL and NTSC VBI play cadence is correct at both output rates',()=>{
    const r=rig();
    for(const standard of ['PAL','NTSC']){
        for(const rate of [44100,22050]){
            const p=r.create(rate===22050?8192:16384,
                {videoStandard:standard,sampleRate:rate});
            p.loadinit_b64(tinyPSID(),0);
            const state=p.getLiveTelemetryState();
            assert.equal(state.initialized,true);
            assert.equal(state.videoStandard,standard);
            assert.equal(state.clockHz,standard==='PAL'?985248:1022727);
            assert.equal(state.frameRate,standard==='PAL'?50:60);
            assert.ok(Math.abs(state.playCallHz-state.frameRate)<0.01);
            assert.equal(state.audio.sampleRate,rate);
            assert.equal(state.audio.requestedSampleRate,rate);
            assert.equal(state.audio.outputSampleRate,rate);
            p.destroy();
            assert.equal(r.contexts.at(-1).closed,true);
        }
    }
});
test('CIA timer clock follows PAL or NTSC selection',()=>{
    const r=rig();
    const rates=[];
    for(const standard of ['PAL','NTSC']){
        const p=r.create(8192,{videoStandard:standard,sampleRate:22050});
        p.loadinit_b64(tinyPSID(true),0);
        const state=p.getLiveTelemetryState();
        rates.push(state.playCallHz);
        assert.ok(Math.abs(state.playCallHz-state.clockHz/0x4024)<0.01);
        p.destroy();
    }
    assert.ok(rates[1]>rates[0],'NTSC CIA playback uses the faster SID clock');
});
test('when browser rejects requested sample rate, actual output rate is reported',()=>{
    const r=rig(false);
    const p=r.create(8192,{videoStandard:'NTSC',sampleRate:22050});
    const state=p.getLiveTelemetryState();
    assert.equal(state.audio.requestedSampleRate,22050);
    assert.equal(state.audio.sampleRate,48000);
    assert.equal(state.audio.outputSampleRate,48000);
    p.destroy();
});
test('SIDchipJS exposes both selectors and restarts at the same subtune',()=>{
    assert.match(html,/id="sidVideoStandard"/);
    assert.match(html,/value="PAL"/);
    assert.match(html,/value="NTSC"/);
    assert.match(html,/id="sidOutputRate"/);
    assert.match(html,/value="44100"/);
    assert.match(html,/value="22050"/);
    assert.match(html,/function applySIDPlaybackSettings\(\)/);
    assert.match(html,/var wasPlaying=SIDplayer.getLiveTelemetryState\(\).playing/);
    assert.match(html,/if\(autoplay\)SIDplayer.loadstart_b64\(b64,st\)/);
    assert.match(html,/else SIDplayer.loadinit_b64\(b64,st\)/);
    assert.match(html,/settings.sampleRate===22050\?8192:16384/);
});
