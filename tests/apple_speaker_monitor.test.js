const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadSpeaker() {
    let nowMs = 0;
    const elements = new Map();

    class FakeClassList {
        constructor() { this.names = new Set(); }
        add(name) { this.names.add(name); }
        remove(name) { this.names.delete(name); }
        contains(name) { return this.names.has(name); }
    }

    class FakeAudioContext {
        constructor(opts) {
            this.state = 'running';
            this.currentTime = 0;
            this.sampleRate = 48000;
            this.requestedSampleRate = opts.sampleRate;
            this.destination = {};
        }
        createGain() {
            return { gain:{value:0}, connect(){} };
        }
        createBuffer(channels, length, sampleRate) {
            const data = new Float32Array(length);
            return {
                duration:length/sampleRate,
                getChannelData(){ return data; }
            };
        }
        createBufferSource() {
            return {
                buffer:null,
                playbackRate:{value:1},
                connect(){},
                disconnect(){},
                start(){},
                stop(){},
                onended:null
            };
        }
        async resume() { this.state = 'running'; }
        async suspend() { this.state = 'suspended'; }
    }

    const refresh = {};
    const oCOM = {
        RefreshEvent_arr:refresh,
        addRefreshEvent(func,name,active) {
            refresh[name] = {func,active:!!active};
        },
        enableRefreshEvent(name,active) {
            if(!refresh[name]) return false;
            refresh[name].active = !!active;
            return refresh[name].active;
        },
        toggleRefreshEvent(name) {
            if(!refresh[name]) return false;
            refresh[name].active = !refresh[name].active;
            return refresh[name].active;
        }
    };

    const document = {
        getElementById(id) { return elements.get(id) || null; }
    };

    let cpuTicks = 0;
    const io = { getClockTicks(){ return cpuTicks; } };

    const context = {
        console,
        _o:{
            CPU_ClocksTicks_s:1021800,
            CPU_TargetTicks_s:1021800,
            EMU_Updates_s:60,
            EMU_DashboardRefresh_s:2
        },
        oCOM,
        document,
        performance:{ now(){ return nowMs; } },
        AudioContext:FakeAudioContext,
        apple2plus:{ hwObj(){ return {io}; } },
        oApple2Video:{ frameTiming:'timer' }
    };
    context.globalThis = context;

    const source = fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_speaker.js'),'utf8');
    vm.createContext(context);
    vm.runInContext(source,context,{filename:'EMU_DEVICE_speaker.js'});

    return {
        speaker:new context.AppleSpeaker(),
        context,
        elements,
        refresh,
        setNow(value){ nowMs = value; },
        setCpuTicks(value){ cpuTicks = value; },
        makeElement(id) {
            const el = {id,textContent:'',classList:new FakeClassList()};
            elements.set(id,el);
            return el;
        }
    };
}

test('speaker exposes its monitor through the standard device controls popup', () => {
    const env = loadSpeaker();
    assert.equal(typeof env.speaker.ctrl_dlg,'function');

    const html = env.speaker.ctrl_dlg();

    assert.match(html,/A2SPK_monitoring/);
    assert.match(html,/speaker_frame_fps/);
    assert.match(html,/speaker_sample_delta/);
    assert.match(html,/speaker_queue_lead/);
    assert.match(html,/Reset/);
    assert.ok(env.refresh.A2SPK_monitoring);
    assert.equal(env.refresh.A2SPK_monitoring.active,false);
});

test('speaker diagnostics distinguish missing and excess samples at frame boundaries', async () => {
    const env = loadSpeaker();
    const speaker = env.speaker;
    await speaker.init('audio_ctx');
    await speaker.init('audio_on');

    const expected = speaker.getDiagnostics().expectedSamples;

    for(let i=0;i<expected-3;i++)
        speaker.tick((i+1)*speaker.tickCycle);
    env.setNow(16.7);
    speaker.cycle();

    let d = speaker.getDiagnostics();
    assert.equal(d.lastMissingSamples,3);
    assert.equal(d.lastExcessSamples,0);
    assert.equal(d.lastSampleDelta,-3);
    assert.equal(d.cumulativeMissingSamples,3);

    for(let i=0;i<expected+2;i++)
        speaker.tick((i+1)*speaker.tickCycle);
    env.setNow(33.4);
    speaker.cycle();

    d = speaker.getDiagnostics();
    assert.equal(d.lastMissingSamples,0);
    assert.equal(d.lastExcessSamples,2);
    assert.equal(d.lastSampleDelta,2);
    assert.equal(d.cumulativeExcessSamples,2);
    assert.equal(d.sampleOverrunFrames,1);
});

test('speaker diagnostics retain scheduler lateness and queue headroom', async () => {
    const env = loadSpeaker();
    const speaker = env.speaker;
    await speaker.init('audio_ctx');
    await speaker.init('audio_on');

    speaker.audio.currentTime = 0.050;
    env.setNow(20);
    speaker.cycle();

    const d = speaker.getDiagnostics();
    assert.equal(d.underruns,1);
    assert.ok(d.lastLate_ms >= 24.9 && d.lastLate_ms <= 25.1);
    assert.ok(d.queueLeadMin_ms <= -24.9);
    assert.equal(d.audioContextSampleRate,48000);
    assert.equal(d.contextState,'running');
});

test('speaker monitor uses dashboard sync and computes measured frame and CPU pace', async () => {
    const env = loadSpeaker();
    const speaker = env.speaker;
    await speaker.init('audio_ctx');
    await speaker.init('audio_on');
    speaker.ctrl_dlg();

    assert.equal(speaker.toggleMonitoring(true),true);
    assert.equal(env.refresh.A2SPK_monitoring.active,true);

    env.setNow(0);
    env.setCpuTicks(0);
    speaker.monitoring();

    for(const t of [16.7,33.4,50.1,66.8,83.5])
    {
        env.setNow(t);
        speaker.cycle();
    }

    env.setNow(500);
    env.setCpuTicks(510900);
    speaker.monitoring();

    const d = speaker.getDiagnostics();
    assert.ok(d.measuredFrameRate > 9.9 && d.measuredFrameRate < 10.1);
    assert.ok(d.cpuPacePercent > 99.9 && d.cpuPacePercent < 100.1);
});

test('speaker diagnostic reset clears accumulated faults but keeps geometry', async () => {
    const env = loadSpeaker();
    const speaker = env.speaker;
    await speaker.init('audio_ctx');
    await speaker.init('audio_on');

    speaker.audio.currentTime = 0.050;
    speaker.cycle();
    const expected = speaker.getDiagnostics().expectedSamples;
    for(let i=0;i<expected+1;i++)
        speaker.tick((i+1)*speaker.tickCycle);
    speaker.cycle();

    speaker.resetDiagnostics();
    const d = speaker.getDiagnostics();

    assert.equal(d.underruns,0);
    assert.equal(d.cumulativeMissingSamples,0);
    assert.equal(d.cumulativeExcessSamples,0);
    assert.equal(d.sampleOverrunFrames,0);
    assert.equal(d.expectedSamples,expected);
});
