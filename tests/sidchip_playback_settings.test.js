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


test('changing selectors restarts the same subtune and preserves pause state',()=>{
    const scripts=Array.from(html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g),m=>m[1]);
    const inline=scripts.at(-1);
    assert.ok(inline && inline.includes('function applySIDPlaybackSettings'));
    const elements={
        sidVideoStandard:{value:'PAL'},
        sidOutputRate:{value:'44100'},
        setvol:{value:'100'},
        sidRateStatus:{textContent:''},
        sidPauseButton:{textContent:'Pause'}
    };
    const players=[];
    class FakeSID {
        constructor(frames,noise,options){
            this.frames=frames;this.options=options;this.playing=false;
            this.model=8580;players.push(this);
        }
        setloadcallback(cb){this.loadCallback=cb;}
        setstartcallback(cb){this.startCallback=cb;}
        loadstart_b64(data,tune){
            this.tune=tune;this.loadCallback();this.playing=true;
            this.startCallback();
        }
        loadinit_b64(data,tune){
            this.tune=tune;this.loadCallback();this.playing=false;
        }
        getLiveTelemetryState(){
            return {playing:this.playing,videoStandard:this.options.videoStandard,
                audio:{sampleRate:this.options.sampleRate,
                    requestedSampleRate:this.options.sampleRate}};
        }
        destroy(){this.destroyed=true;}
        setmodel(model){this.model=model;}
        setvolume(value){this.volume=value;}
        getsubtunes(){return 5;}
        getmodel(){return this.model;}
        getprefmodel(){return 6581;}
        gettitle(){return 'Test';}
        getauthor(){return 'Test';}
        getinfo(){return '';}
        getplaytime(){return 0;}
        pause(){this.playing=false;}
        playcont(){this.playing=true;}
    }
    const sandbox=vm.createContext({
        jsSID:FakeSID,document:{
            getElementById(id){return elements[id]||(elements[id]={textContent:''});}
        },oCOM:{writeText(target,value){target.textContent=String(value);}},
        sidLiveTelemetry:{attach(){},reset(){}},sidAnalysisSchedule(){},
        setInterval(){return 1;},alert(){},window:{}
    });
    vm.runInContext(inline,sandbox,{filename:'SIDchipJS inline script'});
    sandbox.init();
    assert.equal(players[0].options.videoStandard,'PAL');
    assert.equal(players[0].options.sampleRate,44100);
    assert.equal(players[0].frames,16384);
    sandbox.st=4;
    sandbox.sidVideoStandard='unused'; // the DOM selector is authoritative
    elements.sidVideoStandard.value='NTSC';
    elements.sidOutputRate.value='22050';
    sandbox.applySIDPlaybackSettings();
    assert.equal(players[0].destroyed,true);
    assert.equal(players[1].options.videoStandard,'NTSC');
    assert.equal(players[1].options.sampleRate,22050);
    assert.equal(players[1].frames,8192);
    assert.equal(players[1].tune,4);
    assert.equal(players[1].playing,true);
    sandbox.toggleSIDPause();
    elements.sidVideoStandard.value='PAL';
    sandbox.applySIDPlaybackSettings();
    assert.equal(players[2].tune,4);
    assert.equal(players[2].playing,false);
    assert.equal(elements.sidPauseButton.textContent,'Continue');
});
