'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {scheduler}=require('./helpers/mockingboard_scheduler');

for(const backend of ['js','wasm'])for(const rate of [44100,48000])
    test(backend+': browser '+rate+' Hz preserves fixed 22050 Hz synthesis',async()=>{
        const h=await scheduler(backend,10,{contextSampleRate:rate});
        try {
            for(let i=0;i<20;i++)h.frame();
            assert.equal(h.io.getClockTicks(),2043600);
            assert.equal(h.sink.getStats().framesScheduled,44100,'two seconds at the synthesis rate');
            assert.equal(h.card.getAudioStats().capacityFrames,5513,'FIFO remains 250 ms');
            assert.ok(h.sink.audio.sources.every(s=>s.buffer.sampleRate===22050));
            assert.ok(h.sink.audio.sources.every(s=>s.playbackRate.value===1));
            assert.equal(h.card.getAudioFormat().sampleRate,22050);
            assert.equal(h.card.getAYDiagnostics().renderProfile,'economy');
            const epoch=h.card.getAudioEpoch();
            assert.throws(()=>h.card.setAudioSampleRate(48000),e=>e.code==='E_ARGUMENT');
            assert.equal(h.card.getAudioEpoch(),epoch,'incompatible rate requests leave phase intact');
            // Switching numerical backends keeps the same presentation rate/profile.
            await h.card.setAYBackend(backend==='js'?'wasm':'js');
            h.frame();
            assert.equal(h.card.getAudioFormat().sampleRate,22050);
            assert.equal(h.card.getAYDiagnostics().renderProfile,'economy');
        } finally {h.close();}
    });

for(const backend of ['js','wasm'])test(backend+': CPU speed changes duration without changing PCM rate',async()=>{
    const h=await scheduler(backend,10);
    try {
        for(let i=0;i<5;i++)h.frame();
        h.ctx._o.CPU_TargetTicks_s=2043600;
        for(let i=0;i<5;i++)h.frame();
        h.ctx._o.CPU_TargetTicks_s=510900;
        for(let i=0;i<10;i++)h.frame();
        assert.equal(h.io.getClockTicks(),2043600);
        assert.equal(h.sink.getStats().framesScheduled,44100);
        assert.equal(h.card.getAudioFormat().sampleRate,22050);
    } finally {h.close();}
});

function write(card,reg,value,tick) {
    for(const [r,v] of [[2,7],[3,255],[0,4],[1,reg],[0,7],[0,4],[1,value],[0,6],[0,4]])
        card.writeSlotROM(r,v,{cpuTick:tick});
}
for(const backend of ['js','wasm'])test(backend+': CPU-orchestrated notes last 0.1/0.2/0.4 s with identical pitch',async()=>{
    const recordings=[];
    for(const [target,offFrame,offSample] of [[1021800,2,4410],[2043600,1,2205],[510900,4,8820]]) {
        const h=await scheduler(backend,10);
        try {
            h.ctx._o.CPU_TargetTicks_s=target;
            write(h.card,0,100,0);write(h.card,7,0x3e,0);write(h.card,8,15,0);
            for(let frame=0;frame<5;frame++) {
                if(frame===offFrame)write(h.card,8,0,h.io.getClockTicks());
                h.frame();
            }
            const samples=Float32Array.from(h.sink.audio.sources.flatMap(s=>Array.from(s.buffer.getChannelData(0))));
            assert.equal(samples.length,11025);
            assert.ok(samples.slice(offSample-220,offSample).some(x=>Math.abs(x)>.05),'tone lasts until CPU write');
            assert.ok(samples.slice(offSample+1323).every(x=>Math.abs(x)<1e-7),'tone and filter tail finish after CPU write');
            let crossings=0;
            for(let i=442;i<1764;i++)if(samples[i-1]<=0&&samples[i]>0)crossings++;
            assert.ok(crossings>=37&&crossings<=40,'638.625 Hz stays fixed, got '+crossings+' periods in 60 ms');
            recordings.push(samples.slice(0,2205));
        } finally {h.close();}
    }
    assert.deepEqual(recordings[0],recordings[1]);
    assert.deepEqual(recordings[0],recordings[2]);
});
