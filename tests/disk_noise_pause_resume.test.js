// Regression tests for Run/Pause and the Disk II noise loop.
// Run: node --test tests/disk_noise_pause_resume.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(file, globals)
{
    const source = fs.readFileSync(path.join(__dirname, "../res", file), "utf8");
    const context = vm.createContext(globals);
    vm.runInContext(source, context, {filename:file});
    return context;
}

test("Disk II noise goes silent on Pause and returns only with an active motor", async () =>
{
    class FakeAudioContext
    {
        constructor()
        {
            this.state = "running";
            this.currentTime = 0;
            this.destination = {};
            this.sources = [];
        }

        createGain()
        {
            return {gain:{value:0},connect(){return this;}};
        }

        createBufferSource()
        {
            const source = {
                loop:false,
                detune:{value:0},
                started:false,
                stopped:false,
                connect(){return this;},
                start(){this.started=true;},
                stop(){this.stopped=true;}
            };
            this.sources.push(source);
            return source;
        }

        async resume(){this.state = "running";}
        async suspend(){this.state = "suspended";}
    }

    const ctx = loadScript("EMU_CARD_appledisk2.js", {
        console,
        setTimeout,
        clearTimeout,
        AudioContext:FakeAudioContext
    });
    const disk = new ctx.AppleDisk2();
    // Avoid decoding bundled WAVs: the test checks sound-source lifecycle.
    disk.s_load_all = async samples => Object.keys(samples).map(
        name => ({name, audio:{testBuffer:true}})
    );

    const hw = disk.getState();
    hw.drv = 0;
    hw.drive_enable = 1;
    hw.hw[0].motor = 1;
    await disk.init("audio_ctx");
    await disk.init("audio_buffer");
    await disk.init("audio_on");

    assert.equal(disk.audio.sources.length,1);
    assert.equal(disk.audio.sources[0].loop,true);
    assert.equal(disk.audio.sources[0].started,true);

    const volume = disk.dN_volume_gain();
    assert.ok(volume > 0);
    disk.dN_setEmulatorPaused(true);
    assert.equal(disk.gain.gain.value,0);
    assert.equal(disk.dNd.volumePct,75);

    await disk.init("audio_off");
    assert.equal(disk.audio.state,"suspended");
    assert.equal(disk.audio.sources[0].stopped,true);
    assert.equal(hw.drive_enable,1);  // Pause must not switch the physical motor off.
    assert.equal(hw.hw[0].motor,1);

    disk.dN_setEmulatorPaused(false);
    await disk.init("audio_ctx");
    await disk.init("audio_buffer");
    await disk.init("audio_on");
    assert.equal(disk.gain.gain.value,volume);
    assert.equal(disk.audio.state,"running");
    assert.equal(disk.audio.sources.length,2);
    assert.equal(disk.audio.sources[1].loop,true);

    // Repeated enable/unmute must not create duplicate overlapping loops.
    await disk.init("audio_on");
    assert.equal(disk.audio.sources.length,2);

    // If the motor was switched off while audio was muted, it stays silent.
    await disk.init("audio_off");
    hw.drive_enable = 0;
    hw.hw[0].motor = 0;
    await disk.init("audio_ctx");
    await disk.init("audio_buffer");
    await disk.init("audio_on");
    assert.equal(disk.audio.sources.length,2);

    // A different attached drive with an active motor may restore noise.
    hw.drv = 1;
    hw.drive_enable = 1;
    hw.hw[1].motor = 1;
    await disk.init("audio_on");
    assert.equal(disk.audio.sources.length,3);
});

test("UI Pause mutes sound, Resume restores the previous user preference", async () =>
{
    const elements = {
        pausebutton:{id:"pausebutton",value:"",innerHTML:""},
        mutebutton:{id:"mutebutton",parentElement:{disabled:false},hidden:false}
    };
    const states = {mutebutton:"fa-volume-up"};
    const gate = [];
    const soundActions = [];
    const popup = {
        states,
        get_state(id){return states[id];},
        set_class(el,first,second,enabled)
        {
            states[el.id] = enabled ? first : second;
            el.hidden = enabled;
        }
    };
    const fakeDisk = {
        id:{PCODE:"DISKII"},
        dN_setEmulatorPaused(paused){gate.push(paused);}
    };
    const ctx = loadScript("EMU_apple2main.js", {
        console,
        oCOM:{addToEventStack(){},POPUP:popup},
        document:{getElementById(id){return elements[id];}},
        window:{clearInterval(){}}
    });
    ctx.apple2plus = {
        hwObj(){return {io:{slots:[{}],SLOT2obj(){return fakeDisk;}}};},
        CPU_pace_reset(){}
    };
    ctx.keys = {isActive(){}};
    ctx.oEMUI.cpuPaceIndicator = () => {};
    ctx.oEMUI.muteAct = function(){soundActions.push(this.muteArg.override);};
    ctx.EMU_systemSchedulerReset = () => {};
    ctx.EMU_systemSchedulerStart = () => 42;

    const arg = {id:"pausebutton",class1:"fa-play",class2:"fa-pause"};
    ctx.appleIntervalHandle = 42;
    ctx.oEMUI.pauseBtn({...arg,pause:true});
    assert.equal(ctx.appleIntervalHandle,null);
    assert.equal(states.mutebutton,"fa-volume-mute");
    assert.deepEqual(soundActions,[false]);
    assert.deepEqual(gate,[true]);
    assert.equal(elements.mutebutton.parentElement.disabled,true);
    assert.equal(await ctx.EMU_audio_try_unlock(),false);

    ctx.oEMUI.pauseBtn({...arg,pause:false});
    assert.equal(ctx.appleIntervalHandle,42);
    assert.equal(states.mutebutton,"fa-volume-up");
    assert.deepEqual(soundActions,[false,true]);
    assert.deepEqual(gate,[true,false]);
    assert.equal(elements.mutebutton.parentElement.disabled,false);

    // If sound was muted before Pause, Resume must not unmute it.
    states.mutebutton = "fa-volume-mute";
    ctx.oEMUI.pauseBtn({...arg,pause:true});
    ctx.oEMUI.pauseBtn({...arg,pause:false});
    assert.equal(states.mutebutton,"fa-volume-mute");
    assert.deepEqual(soundActions,[false,true]);
    assert.deepEqual(gate,[true,false,true,false]);
});
