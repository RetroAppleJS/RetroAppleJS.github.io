'use strict';
// Regression tests: silent Mockingboard sink must be recoverable without page reload.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');

function unlockFixture(options={}) {
    const source=fs.readFileSync(path.join(root,'res/EMU_apple2main.js'),'utf8');
    const start=source.indexOf('async function EMU_audio_try_unlock(');
    const end=source.indexOf('function EMU_audio_event_unlock()',start);
    assert.ok(start>0&&end>start);
    const calls=[];
    const device={
        audio:{state:options.deviceState||'running'},
        stateEnabled:options.playbackEnabled!==false,
        getStats(){return {playbackEnabled:this.stateEnabled};},
        async init(op){
            calls.push('device:'+op);
            if(op==='audio_ctx'&&this.audio.state==='suspended')this.audio.state='running';
            if(op==='audio_on')this.stateEnabled=true;
        }
    };
    const speaker={
        audio:{state:options.speakerState||'running',async resume(){this.state='running';}},
        async init(op){calls.push('speaker:'+op);}
    };
    const context={
        _o:{EMU_audio:{unlocked:true,trying:false}},
        oEMU:{component:{IO:{AppleSpeaker:speaker}}},
        oEMUI:{muteBtn(){calls.push('muteBtn');}},
        EMU_attachedAudioDevices:()=>[device],
        EMU_diskIIObjects:()=>[],
        EMU_audio_prepare:async()=>{
            calls.push('prepare');
            await device.init('audio_ctx');
        },
        console
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start,end),context);
    return{context,device,speaker,calls,unlock:()=>context.EMU_audio_try_unlock()};
}

test('fast path keeps already running and enabled sinks intact',async()=>{
    const f=unlockFixture();
    assert.equal(await f.unlock(),true);
    assert.deepEqual(f.calls,[],'do not unnecessarily reset streaming audio');
});
test('suspended Mockingboard AudioContext triggers renewal of active playback',async()=>{
    const f=unlockFixture({deviceState:'suspended'});
    assert.equal(await f.unlock(),true);
    assert.ok(f.calls.includes('device:audio_on'));
    assert.equal(f.device.audio.state,'running');
    assert.equal(f.device.stateEnabled,true);
});
test('running AudioContext but disabled playback must not hit cached early return',async()=>{
    const f=unlockFixture({playbackEnabled:false});
    assert.equal(await f.unlock(),true);
    assert.ok(f.calls.includes('device:audio_on'));
    assert.equal(f.device.stateEnabled,true);
});
test('suspended main speaker must not falsely preserve global unlocked flag',async()=>{
    const f=unlockFixture({speakerState:'suspended'});
    assert.equal(await f.unlock(),true);
    assert.equal(f.speaker.audio.state,'running');
    assert.ok(f.calls.includes('speaker:audio_on'));
});

test('closed Mockingboard AudioContext is replaced with a new connected sink',async()=>{
    const source=fs.readFileSync(path.join(root,'res/EMU_DEVICE_mockingboard_audio.js'),'utf8');
    const creations=[];
    class FakeAudioContext {
        constructor(){this.state='running';this.currentTime=0;this.destination={};creations.push(this);}
        addEventListener(){}
        createGain(){return {gain:{value:0},connect(){}};}
        async resume(){this.state='running';}
    }
    const context={AudioContext:FakeAudioContext,console};
    vm.createContext(context);
    vm.runInContext(source,context);
    const device=new context.MockingboardAudio();
    await device.init('audio_ctx');
    const previous=device.audio;
    assert.equal(creations.length,1);
    previous.state='closed';
    await device.init('audio_ctx');
    assert.equal(creations.length,2);
    assert.notEqual(previous,device.audio);
    assert.equal(device.audio.state,'running');
});
