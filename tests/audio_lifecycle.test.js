'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function loadAudioLifecycle()
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
        audio:{state:'running'},
        init:async function(action){ attachedCalls.push(action); }
    };
    const context={
        _o:{EMU_audio:{prepared:false,unlocked:false,trying:false}},
        oEMU:{component:{IO:{AppleSpeaker:speaker}}},
        oEMUI:{muteBtn:function(){}},
        EMU_diskIIObjects:function(){ return [disk]; },
        EMU_attachedAudioDevices:function(){ return [attached]; },
        console:console,
        Promise:Promise
    };
    vm.createContext(context);
    vm.runInContext(main.slice(start,end),context);
    return {context,attachedCalls};
}

test('audio unlock initializes and enables attached audio-capable devices',async()=>{
    const h=loadAudioLifecycle();
    assert.equal(await h.context.EMU_audio_try_unlock(false),true);
    assert.deepEqual(h.attachedCalls,['audio_ctx','audio_on']);
});
