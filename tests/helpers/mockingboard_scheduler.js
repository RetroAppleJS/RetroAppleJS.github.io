'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
function load() {
    const ctx={console,Uint8Array,Float32Array,Float64Array,DataView,ArrayBuffer,WebAssembly,
        atob:s=>Buffer.from(s,'base64').toString('binary')};
    ctx.globalThis=ctx;vm.createContext(ctx);
    for(const file of ['ayumi.js','EMU_CHIP_AY_JS.js','EMU_CHIP_AY_WASM.js','EMU_CHIP_AY.js',
        'EMU_AUDIO_AY_STREAM.js','EMU_DEVICE_ay.js'])
        vm.runInContext(fs.readFileSync(path.join(root,'res',file),'utf8'),ctx,{filename:file});
    return ctx;
}

async function scheduler(backend,fps) {
    const ctx=load();let wall=0,hash=0;
    ctx._o={CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800,EMU_IntervalTime_ms:1000/fps,EMU_DashboardRefresh_s:2};
    ctx.oEMU={component:{IO:{ACTION_MAP:{RD:[],WR:[]}},CPU:{}},system:{}};
    ctx.oEMUI={};ctx._CFG_IOADDR={};ctx._CFG_IORANGES={};
    ctx.oCOM={default:o=>o,crc16:()=>++hash,getHexWord:n=>n.toString(16),addRefreshEvent(){},bRefreshEvent:false};
    ctx.TextEncoder=TextEncoder;ctx.performance={now:()=>wall*1000};
    ctx.Apple2VideoMUX=function(){this.setCanvas=()=>{};this.cycle=()=>{};};
    // CPU instructions and video pixels do not affect the audio admission policy.
    // Use the real SYSTEM loop, IO topology, AY synthesis and browser sink.
    ctx.Cpu6502=function(){this.cycle=()=>false;};
    ctx.AudioContext=class {
        constructor(){this.sampleRate=44100;this.state='running';this.currentTime=0;this.destination={};this.sources=[];this.listeners=[];}
        addEventListener(name,fn){if(name==='statechange')this.listeners.push(fn);}
        setState(state){this.state=state;for(const fn of this.listeners)fn();}
        createGain(){return {gain:{value:1},connect(){}};}
        createBuffer(ch,n,rate){const data=Array.from({length:ch},()=>new Float32Array(n));return {duration:n/rate,getChannelData:i=>data[i]};}
        createBufferSource(){const src={playbackRate:{value:1},connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(){}};this.sources.push(src);return src;}
        async resume(){this.setState('running');}
        async suspend(){this.setState('suspended');}
    };
    for(const file of ['EMU_DEVICE_mockingboard_audio.js','EMU_apple2io.js','EMU_CARD_mockingboard.js'])vm.runInContext(fs.readFileSync(root+'/res/'+file,'utf8'),ctx);
    ctx.Apple2Hw=function(){let ticks=0;const hw={tick(){ticks++;},getCpuTicks:()=>ticks,setIRQSource(){}};hw.io=new ctx.Apple2IO({},hw);return hw;};
    vm.runInContext(fs.readFileSync(root+'/res/EMU_apple2plus.js','utf8'),ctx);
    ctx.apple2plus=new ctx.Apple2Plus({});const io=ctx.apple2plus.hwObj().io;
    const card=new ctx.mockingboard();card.restart();await card.setAYBackend(backend);
    io.slots[4]={peripheral:card};io.provisionPeripheral(card,'A2P');
    const sink=card.devices.find(d=>d.id.DCODE==='MOCKAUDIO');await sink.init('audio_on');
    return {ctx,card,io,sink,frame(){
        wall+=1/fps;if(sink.audio.state==='running')sink.audio.currentTime+=1/fps;
        ctx.apple2plus.cycle(Math.round(ctx._o.CPU_TargetTicks_s/fps));
    },close(){io.detach(card);card.onUnmount();}};
}
module.exports={scheduler};
