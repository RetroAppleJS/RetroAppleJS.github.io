'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {scheduler}=require('./helpers/mockingboard_scheduler');

for(const backend of ['js','wasm']) {
    for(const fps of [10,60,100])test(backend+': idle mounted card sustains nominal CPU at '+fps+' fps',async()=>{
        const h=await scheduler(backend,fps);
        for(let frame=0;frame<fps*2;frame++)h.frame();
        assert.equal(h.io.getClockTicks(),2043600,'two seconds of nominal CPU must execute');
        const stats=h.sink.getStats();
        assert.equal(stats.framesScheduled,88200,'both seconds of PCM must be presented');
        assert.ok(stats.queuedLead_ms<=stats.highWater_ms+.001);
        assert.ok(stats.underruns<=1,'the selected cadence must not starve every audio slice');
        h.close();
    });
    for(const state of ['suspended','interrupted','closed'])test(backend+': '+state+' audio cannot throttle CPU or accumulate PCM',async()=>{
        const h=await scheduler(backend,10);
        // Do not emit statechange: polling must also detect a stopped context.
        h.sink.audio.state=state;
        for(let frame=0;frame<20;frame++)h.frame();
        assert.equal(h.io.getClockTicks(),2043600);
        assert.equal(h.card.getAudioStats().queuedFrames,0);
        assert.equal(h.card.getAYDiagnostics().renderedFrames,88200,'logical AY phase continues silently');
        assert.equal(h.sink.getStats().framesScheduled,0);
        h.close();
    });
    test(backend+': browser interruption stops queued nodes and resumes with fresh PCM',async()=>{
        const h=await scheduler(backend,60);
        for(let frame=0;frame<6;frame++)h.frame();
        const scheduled=h.sink.getStats().framesScheduled;
        const sources=[...h.sink.audio.sources];
        h.sink.audio.setState('interrupted');
        assert.ok(sources.every(s=>s.stopped&&s.disconnected));
        for(let frame=0;frame<6;frame++)h.frame();
        assert.equal(h.io.getClockTicks(),204360);
        assert.equal(h.card.getAudioStats().queuedFrames,0);
        assert.equal(h.sink.getStats().framesScheduled,scheduled);
        h.sink.audio.setState('running');h.frame();
        // The fixed-point horizon floors 13/60 s to 216666666 ns:
        // 9554 cumulative samples minus 8820 before the resumed slice.
        assert.equal(h.sink.getStats().framesScheduled-scheduled,734);
        assert.equal(h.io.getClockTicks(),221390);
        h.close();
    });
}
