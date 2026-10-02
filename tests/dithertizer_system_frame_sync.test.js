'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');

function harness()
{
    let draws=0,stopped=0,nextTimer=1,now=0;
    const intervals=new Map();
    const rgba=new Uint8ClampedArray(280*192*4).fill(255);
    const context={drawImage(){draws++;},getImageData(){return {data:rgba};}};
    const stream={getTracks(){return [{stop(){stopped++;}}];}};
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const document={getElementById(id){return id==='slider_fps_v' ? {} : null;},createElement(kind){
        if(kind==='video') return video;
        if(kind==='canvas') return {getContext(){return context;}};
        throw new Error(kind);
    }};
    const window={
        setInterval(fn,ms,...args){const id=nextTimer++;intervals.set(id,{fn,ms,args});return id;},
        clearInterval(id){intervals.delete(id);}
    };
    const sandbox={console:{log(){},warn(){},assert(){}},document,window,
        navigator:{mediaDevices:{async getUserMedia(){return stream;}}},
        performance:{now:()=>now},
        oCOM:{addToEventStack(){},default:obj=>obj,bRefreshEvent:false},
        setTimeout(){throw new Error('Camera must not create a separate timer');}
    };
    vm.createContext(sandbox);
    for(const name of ['EMU_apple2main.js','EMU_cpu6502.js','EMU_apple2io.js','EMU_CARD_dithertizer.js'])
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',name),'utf8'),sandbox,{filename:name});
    // Replace graphical/hardware construction only; keep production SYSTEM,
    // CPU, I/O processing loops and the Dithertizer camera implementation.
    sandbox.Apple2VideoMUX=function(){this.cycle=()=>{};};
    sandbox.Apple2Hw=function(vid){
        this.io=new sandbox.Apple2IO(vid,this);
        this.lineDecode=a=>a>>12;
        this.RD=Array(16).fill(()=>0xEA);
        this.WR=Array(16).fill(()=>{});
    };
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_apple2plus.js'),'utf8'),sandbox);
    vm.runInContext('apple2plus=new Apple2Plus({}); apple2plus.cpuObj().setState({pc:0x0800,sp:0xFF});',sandbox);
    const card=new sandbox.DithertizerII();
    const io=sandbox.apple2plus.hwObj().io;
    io.slots[8]={peripheral:card};
    sandbox.appleIntervalHandle=window.setInterval(sandbox.apple2plus.cycle,100,102180);
    function frames(count){
        for(let i=0;i<count;i++){
            const timer=[...intervals.values()][0];
            now+=timer.ms;
            timer.fn(...timer.args);
        }
    }
    return {sandbox,card,io,frames,intervals,get draws(){return draws;},get stopped(){return stopped;}};
}

test('SYSTEM FPS slider drives exactly one camera sample per processing frame at 10 then 50 fps',async()=>{
    const h=harness();
    assert.equal(await h.card.deviceToolCameraToggle('dither_ctrl_S7'),true);
    assert.equal(h.draws,1,'camera start seeds its initial frame');
    h.sandbox.oEMUI.fpsSld({value:10},'slider_fps_v');
    h.frames(10);
    assert.equal(h.draws,11,'ten processing frames collect ten camera frames');
    const firstSecondTicks=h.io.getClockTicks();
    h.sandbox.oEMUI.fpsSld({value:50},'slider_fps_v');
    assert.equal([...h.intervals.values()][0].ms,20);
    h.frames(50);
    assert.equal(h.draws,61,'FPS change applies through the existing SYSTEM scheduler');
    assert.equal(h.io.getClockTicks()-firstSecondTicks,firstSecondTicks,'FPS changes do not change CPU ticks per second');
    h.card.reset();
    h.frames(2);
    assert.equal(h.draws,61,'camera OFF prevents samples on subsequent SYSTEM frames');
    assert.equal(h.stopped,1);
});

test('no camera work occurs on CPU ticks or when the card is no longer mounted',async()=>{
    const h=harness();
    await h.card.deviceToolCameraToggle('dither_ctrl_S7');
    for(let i=0;i<1000;i++) h.io.tick(i);
    assert.equal(h.draws,1,'per-CPU-tick path must not sample the camera');
    h.io.cycle();
    assert.equal(h.draws,2,'I/O processing frame invokes the mounted card');
    h.io.slots[8]={};
    h.frames(3);
    assert.equal(h.draws,2,'unmounted cards receive no frame callbacks');
    h.card.reset();
});
