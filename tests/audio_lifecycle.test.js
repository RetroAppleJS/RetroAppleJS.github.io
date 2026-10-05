'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function loadAudioLifecycle(options={})
{
    const main=fs.readFileSync(path.join(root,'res','EMU_apple2main.js'),'utf8');
    const start=main.indexOf('async function EMU_audio_prepare');
    const end=main.indexOf('function EMU_audio_event_unlock');
    assert.ok(start>=0 && end>start,'audio lifecycle functions must be present');

    const attachedCalls=[];
    const speaker={audio:{state:'running'},init:async()=>{}};
    const disk={audio:{state:'running'},init:async()=>{}};
    const attached={
        audioDevice:true,
        audio:options.attachedHasContext===false ? undefined : {state:'running'},
        init:async function(action)
        {
            attachedCalls.push(action);
            if(action==='audio_ctx' && !this.audio) this.audio={state:'running'};
        }
    };
    const context={
        _o:{EMU_audio:{prepared:!!options.prepared,unlocked:!!options.unlocked,trying:false}},
        oEMU:{component:{IO:{AppleSpeaker:speaker}}},
        oEMUI:{muteBtn:function(){}},
        EMU_diskIIObjects:function(){ return [disk]; },
        EMU_attachedAudioDevices:function(){ return [attached]; },
        console:console,
        Promise:Promise
    };
    vm.createContext(context);
    vm.runInContext(main.slice(start,end),context);
    return {context,attachedCalls,attached};
}

test('audio unlock initializes and enables attached audio-capable devices',async()=>{
    const h=loadAudioLifecycle();
    assert.equal(await h.context.EMU_audio_try_unlock(false),true);
    assert.deepEqual(h.attachedCalls,['audio_ctx','audio_on']);
});

test('already-unlocked global audio adopts a late attached audio device once',async()=>{
    const h=loadAudioLifecycle({prepared:true,unlocked:true,attachedHasContext:false});
    assert.equal(await h.context.EMU_audio_try_unlock(false),true);
    assert.deepEqual(h.attachedCalls,['audio_ctx','audio_on']);
    assert.equal(h.attached.audio.state,'running');

    assert.equal(await h.context.EMU_audio_try_unlock(false),true);
    assert.deepEqual(h.attachedCalls,['audio_ctx','audio_on']);
});
