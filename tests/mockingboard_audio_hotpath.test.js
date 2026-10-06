'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load,root}=require('./helpers/mockingboard_scheduler');

async function environment(backend) {
    const ctx=load(),counts={maps:0,positions:0};
    ctx._o={CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800};
    ctx.oEMU={component:{IO:{}}};
    let tick=0;const irq=[];
    const io={getClockTicks:()=>tick};
    ctx.apple2plus={hwObj:()=>({io,setIRQSource(source,active){if(active)irq.push(tick);}})};
    const Clock=ctx.AYSourceClock;
    ctx.AYSourceClock=function(...args){const clock=new Clock(...args),map=clock.map;clock.map=function(t){counts.maps++;return map(t);};return clock;};
    const facade=ctx.AYCore.facade;
    ctx.AYCore.facade=function(...args){const core=facade.apply(this,args),position=core.getPosition;core.getPosition=function(p){counts.positions++;return position(p);};return core;};
    for(const name of ['EMU_DEVICE_mockingboard_audio.js','EMU_CARD_mockingboard.js'])vm.runInContext(fs.readFileSync(root+'/res/'+name,'utf8'),ctx);
    const card=new ctx.mockingboard();card.restart();await card.setAYBackend(backend);
    const sink=new ctx.MockingboardAudio();sink.bindHost(card);sink.bindIO(io);
    return {ctx,card,sink,counts,irq,setTick(t){tick=t;}};
}

function write(card,reg,value,tick=0,index=0) {
    for(const [r,v] of [[2,7],[3,255],[0,4],[1,reg],[0,7],[0,4],[1,value],[0,6],[0,4]])card.writeSlotROM(index*128+r,v,{cpuTick:tick});
}

for(const backend of ['js','wasm']) {
    test(backend+': interrupt-driven clock keeps audio projection and position polling bounded',async()=>{
        const h=await environment(backend),c=h.card;
        write(c,0,100);write(c,7,56);write(c,8,15);
        c.writeSlotROM(11,64,{cpuTick:0});c.writeSlotROM(14,192,{cpuTick:0});
        c.writeSlotROM(4,997&255,{cpuTick:0});c.writeSlotROM(5,997>>8,{cpuTick:0});
        h.counts.maps=h.counts.positions=0;
        for(let t=1;t<=1021800;t++) {
            h.setTick(t);h.sink.tick();
            if(t%999===0)c.readSlotROM(4,{cpuTick:t});
        }
        assert.equal(h.irq.length,Math.floor(1021800/999));
        assert.ok(h.irq.every((t,i)=>t===(i+1)*999),'VIA IRQ remains exact to one CPU cycle');
        assert.equal(c.getAudioStats().producedFrames,22050);
        assert.ok(h.counts.maps<256,'source projections per second: '+h.counts.maps);
        assert.ok(h.counts.positions<512,'core position queries per second: '+h.counts.positions);
        c.onUnmount();
    });
    test(backend+': per-cycle orchestration matches block orchestration across writes and speed changes',async()=>{
        const fine=await environment(backend),coarse=await environment(backend);
        for(const h of [fine,coarse]) {
            for(const chip of [0,1]){write(h.card,0,100+chip*70,0,chip);write(h.card,7,56,0,chip);write(h.card,8,15,0,chip);}
            h.card.setAudioConsumerActive(true);
        }
        const actions=[[11111,0,13,10],[17389,1,8,9],[23456,0,13,10],[30000,1,0,140]];
        for(let t=1;t<=80000;t++) {
            fine.setTick(t);fine.card.advanceTo(t);
            if(t===21001 || t===51001) {
                coarse.setTick(t);coarse.card.advanceTo(t);
                const rate=t===21001?2043600:510900;
                fine.ctx._o.CPU_TargetTicks_s=coarse.ctx._o.CPU_TargetTicks_s=rate;
            }
            for(const [at,chip,reg,value] of actions)if(t===at) {
                coarse.setTick(t);write(fine.card,reg,value,t,chip);write(coarse.card,reg,value,t,chip);
                assert.equal(fine.card.getRegisters(chip)[reg],value);
            }
        }
        coarse.card.advanceTo(80000);
        const a=fine.card.drainAudioFrames(11025),b=coarse.card.drainAudioFrames(11025);
        assert.deepEqual(a.left,b.left);assert.deepEqual(a.right,b.right);
        assert.equal(fine.card.getAYDiagnostics().mappedHorizon,coarse.card.getAYDiagnostics().mappedHorizon);
        fine.card.onUnmount();coarse.card.onUnmount();
    });
}
