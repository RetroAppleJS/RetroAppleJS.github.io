'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function rig(fps,quantum=10218){
    let cpuTicks=0,videoCalls=0,fullCycles=0,cpuCycleCount=0;
    const realtimeCalls=[];
    const sandbox=vm.createContext({
        console,Math,Number,
        performance:{now(){return 0}},
        _o:{EMU_IntervalTime_ms:1000/fps,CPU_ClocksTicks_s:1021800,
            CPU_TargetTicks_s:1021800},
        oCOM:{default:x=>x,bRefreshEvent:false},
        oEMU:{system:{A2P:{}},component:{CPU:{Apple2Debug:null}},stats:{}},
        Apple2Video:class{
            constructor(){this.initGPU=function(){};}
            cycle(){videoCalls++;}
        },
        Apple2Hw:class{
            constructor(){
                this.io={
                    getClockTicks(){return cpuTicks},
                    tick(){cpuTicks++},
                    getRealtimeAudioQuantumTicks(){return quantum},
                    serviceRealtimeAudio(){realtimeCalls.push(cpuTicks)},
                    limitCpuSliceTicks(n){return n},
                    cycle(){fullCycles++}
                };
            }
            setVideoClockScale(){}
        },
        Cpu6502:class{cycle(){cpuCycleCount++;return false}}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res/EMU_apple2plus.js'),'utf8'),sandbox);
    const machine=new sandbox.Apple2Plus({});
    function run(){
        const ticksPerFrame=Math.round(1021800/fps);
        for(let frame=0;frame<fps;frame++){
            const result=machine.runLiveCpuTicks(ticksPerFrame,{
                deadline:1000000,videoScale:1,presentAudio:true});
            assert.equal(result.completedTicks,ticksPerFrame);
        }
        return {realtimeCalls,cpuTicks,videoCalls,fullCycles,cpuCycleCount};
    }
    return {run};
}

test('10 FPS CPU batch services realtime SID audio ten times before display processing',()=>{
    const r=rig(10).run();
    assert.equal(r.cpuTicks,1021800);
    assert.equal(r.cpuCycleCount,1021800);
    assert.equal(r.videoCalls,10);
    assert.equal(r.fullCycles,10);
    assert.equal(r.realtimeCalls.length,100);
    assert.deepEqual(r.realtimeCalls.slice(0,10),
        [10218,20436,30654,40872,51090,61308,71526,81744,91962,102180]);
    assert.equal(r.realtimeCalls.at(-1),1021800);
});

test('VBLANK calls realtime service without altering display or CPU tick cadence',()=>{
    const r=rig(60).run();
    assert.equal(r.cpuTicks,1021800);
    assert.equal(r.videoCalls,60);
    assert.equal(r.fullCycles,60);
    assert.equal(r.realtimeCalls.length,60);
    assert.ok(r.realtimeCalls.every((x,i)=>x>i*17030 && x<=(i+1)*17030));
});

test('unattached realtime audio has zero callback overhead and preserves CPU pacing',()=>{
    const r=rig(10,0).run();
    assert.equal(r.cpuTicks,1021800);
    assert.equal(r.realtimeCalls.length,0);
    assert.equal(r.fullCycles,10);
});
