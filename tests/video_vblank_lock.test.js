'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function run(ctx,file){vm.runInContext(fs.readFileSync(path.join(ROOT,'res',file),'utf8'),ctx,{filename:file});}
function machine()
{
    const frames=[],video={state:{gfx:false,mix:false,page2:false,hires:false},write(){},reset(){},cycle(){},
        setGfx(v){this.state.gfx=v;},setMix(v){this.state.mix=v;},setPage2(v){this.state.page2=v;},setHires(v){this.state.hires=v;},
        completeRasterFrame(f){frames.push(f);}};
    const ctx={console:{log(){},warn(){},error(){}},performance,TextEncoder,
        oEMU:{system:{},component:{IO:{ACTION_MAP:{RD:[],WR:[]}},CPU:{}}},oEMUI:{},_CFG_IOADDR:{},_CFG_IORANGES:{},
        _o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800,EMU_Updates_s:10},
        oCOM:{crc16(){return 1;},trim(s){return s.trim();},getHexWord(v){return v.toString(16);},default(o){return o;},bRefreshEvent:false},
        apple2Rom:new Uint8Array(0x3000),Apple2VideoMUX:function(){return video;}};
    vm.createContext(ctx);
    for(const f of ['EMU_VIDEO_raster.js','EMU_apple2io.js','EMU_apple2hw.js','EMU_cpu6502.js','EMU_CARD_hostio.js',
        'EMU_DEVICE_gameport.js','EMU_DEVICE_keyboard.js','EMU_DEVICE_speaker.js','EMU_apple2plus.js'])run(ctx,f);
    const system=new ctx.Apple2Plus({});ctx.apple2plus=system;
    const hw=system.hwObj();hw.mount();hw.io.provisionPeripheral(new ctx.AppleBoard(),'A2P');
    for(let a=0x400;a<0xC00;a++)hw.WR[0](a,0xC1);
    for(let a=0x2000;a<0x6000;a++)hw.WR[a>>12](a,0x55);
    return {ctx,system,hw,frames};
}
test('beam mode changes preserve the old fetch then select the next byte; frames seal on VBL only',()=>{
    const h=machine();h.hw.setVideoRasterCapture(true);
    h.hw.read(0xC050,30);h.hw.read(0xC057,31);
    h.hw.read(0xC020,12479);assert.equal(h.frames.length,0);
    h.hw.read(0xC020,12480);assert.equal(h.frames.length,1);
    const f=h.frames[0];assert.equal(f.endTick,12480);
    assert.deepEqual(Array.from(f.modes.slice(0,8)),[0,0,0,0,0,0,1,2]);
    assert.equal(f.bytes[5],0xC1);assert.equal(f.bytes[7],0x55);
    const old=Array.from(f.bytes);h.hw.write(0x2000,0xFF,17030);
    assert.deepEqual(Array.from(f.bytes),old,'completed planes stay immutable');
});
test('a RAM write after the beam fetch changes the following scanline, not the captured byte',()=>{
    const h=machine();h.hw.setVideoRasterCapture(true);
    h.hw.write(0x400,0xC2,25);h.hw.read(0xC020,12480);
    assert.equal(h.frames[0].bytes[0],0xC1);assert.equal(h.frames[0].bytes[40],0xC2);
});
test('capture handles several fields per slice and discards an incomplete first field',()=>{
    const h=machine();for(let i=0;i<100;i++)h.hw.io.tick();
    h.hw.setVideoRasterCapture(true);h.hw.read(0xC020,12480-100);
    assert.equal(h.frames.length,0);
    h.hw.read(0xC020,3*17030-100);assert.equal(h.frames.length,2);
    assert.equal(h.frames[0].endTick,29510);assert.equal(h.frames[1].endTick,46540);
    assert.notEqual(h.frames[0].bytes,h.frames[1].bytes);
});
test('safe observation and an execution trap do not advance the raster cursor',()=>{
    const h=machine();h.hw.setVideoRasterCapture(true);h.hw.read(0xC020,3);
    const before=h.hw.getVideoRasterStats();h.hw.safe_read(0xC055);h.hw.peekFloatingBus();
    assert.deepEqual(h.hw.getVideoRasterStats(),before);
    h.system.cpuObj().setState({pc:0x6000});h.system.cpuObj().setExecutionTrap(0x6000);
    assert.equal(h.system.stepLiveInstruction().ticks,0);assert.deepEqual(h.hw.getVideoRasterStats(),before);
});
test('Elliott-style 65-cycle loop retains horizontal text/hires windows on every scanline',()=>{
    const h=machine(), bytes=[];
    for(let col=0;col<14;col++)bytes.push(0xCD,col%2===0?0x50:0x51,0xC0);
    bytes.push(0xEA,0xAD,0,0xC0,0x10,0xD0);
    bytes.forEach((v,i)=>h.hw.WR[0](0x31A+i,v));
    h.hw.setVideoMode('gfx',true);h.hw.setVideoMode('hires',true);
    for(let i=0;i<23;i++)h.hw.io.tick();
    h.hw.setVideoRasterCapture(true);h.system.cpuObj().setState({pc:0x31A,p:0x24});
    h.system.runLiveCpuTicks(17030);
    assert.equal(h.frames.length,1);
    for(let y=0;y<192;y++)
    {
        assert.equal(h.frames[0].modes[y*40+6],0,'text strip line '+y);
        assert.equal(h.frames[0].modes[y*40+10],2,'hires strip line '+y);
    }
});
test('GPU raster kernel uses captured text/lores/hires samples independently of final mode',()=>{
    const h=machine(), bytes=new Uint8Array(7680),modes=new Uint8Array(7680),rom=new Uint8Array(512).fill(127),pal=new Uint8Array(256);
    pal.fill(255,240,243);bytes[0]=0xC1;bytes[1]=15;modes[1]=1;modes[2]=2;
    function pixel(x){let color;h.ctx.Apple2RasterKernel.call({thread:{x,y:191},constants:{scale:1},color(...c){color=c;}},bytes,modes,rom,pal,0,0);return color;}
    assert.deepEqual(pixel(0),[255/256,255/256,255/256,1]);assert.deepEqual(pixel(7),pixel(0));
    assert.deepEqual(pixel(14),[0,0,0,1]);
});

test('SYSTEM FPS label locks/unlocks, preserves timer FPS and CPU target, and disables the slider',()=>{
    const label={setAttribute(k,v){this[k]=v;}},slider={value:37,disabled:false};let timer=1,stops=0;
    const ctx={console,TextEncoder,document:{getElementById(id){return id==='fpsRange'?slider:id==='slider_fps_v'?label:null;}},
        window:{setInterval(){return ++timer;},clearInterval(){stops++;}},
        oCOM:{addToEventStack(){},default(o){return o;}},
        oApple2Video:{frameTiming:'timer',setFrameTiming(m){this.frameTiming=m;}}};
    vm.createContext(ctx);run(ctx,'EMU_apple2main.js');
    vm.runInContext('apple2plus={cycle(){},CPU_pace_reset(){}}; appleIntervalHandle=1; oEMUI.fpsSpd(37);',ctx);
    const target=vm.runInContext('_o.CPU_TargetTicks_s',ctx);
    assert.equal(ctx.oEMUI.toggleFrameTiming(),true);assert.equal(slider.disabled,true);assert.match(label.innerHTML,/fa-lock/);
    assert.equal(vm.runInContext('_o.EMU_Updates_s',ctx),60);assert.equal(vm.runInContext('_o.CPU_TargetTicks_s',ctx),target);
    ctx.oEMUI.fpsSld({value:99},'slider_fps_v');assert.match(label.innerHTML,/fa-lock/);
    assert.equal(ctx.oEMUI.toggleFrameTiming(),false);assert.equal(slider.disabled,false);assert.equal(slider.value,37);assert.equal(label.innerHTML,'37fps');
    assert.equal(vm.runInContext('_o.CPU_TargetTicks_s',ctx),target);assert.ok(stops>=3);
});

function rendererHarness()
{
    const images=[], callbacks=[];
    function canvas(){const c={style:{},width:560,height:384};c.getContext=function(type){if(type!=='2d')return null;return {
        canvas:c,createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
        getImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
        putImageData(image){images.push(image);},fillRect(){},clearRect(){}};};return c;}
    const ctx={console,performance,setTimeout,clearTimeout,
        oEMU:{component:{Video:{}}},_o:{CPU_ClocksTicks_s:1021800,EMU_vid_mode:'canvas'},
        _CFG_CHROMA:[{COL_num:null,COL_name:'Color'}],
        Apple2CharROM_get(){return new Uint8Array(512).fill(127);},
        document:{createElement(){return canvas();},getElementById(){return null;}},
        requestAnimationFrame(fn){callbacks.push(fn);}};
    ctx.window=ctx;ctx.self=ctx;vm.createContext(ctx);run(ctx,'gpu-browser.min.js');
    const RealGPU=ctx.GPU;
    const GPU=function(options){return new RealGPU(Object.assign({},options,{mode:'cpu'}));};
    ctx.window=Object.assign({},ctx,{GPU:{GPU:GPU}});
    run(ctx,'EMU_VIDEO_raster.js');run(ctx,'EMU_DEVICE_video_GPU.js');ctx.Apple2VideoGPU=ctx.Apple2Video;
    run(ctx,'EMU_DEVICE_video_wave.js');ctx.Apple2VideoWave=ctx.Apple2Video;
    run(ctx,'EMU_DEVICE_video_THREE.js');run(ctx,'EMU_DEVICE_video_canvas.js');ctx.Apple2VideoCanvas=ctx.Apple2Video;
    run(ctx,'EMU_DEVICE_video_MUX.js');
    return {ctx,images,callbacks,canvas};
}
function sampleFrame()
{
    const bytes=new Uint8Array(7680).fill(0xC1),modes=new Uint8Array(7680);
    for(let y=0;y<192;y++) for(let c=0;c<40;c++) if(c>=4 && c<8){modes[y*40+c]=2;bytes[y*40+c]=0;}
    return {bytes,modes,endTick:12480,flash:false};
}
test('actual Canvas and GPU drivers present captured strips; bundled GPU.js compiles the raster kernel',()=>{
    const h=rendererHarness(),frame=sampleFrame();
    const c=new h.ctx.Apple2VideoCanvas(h.canvas().getContext('2d'));c.frameTiming='vblank';
    c.presentRasterFrame(frame,{chrome:0});
    const data=h.images.at(-1).data;assert.equal(data[0],255);assert.equal(data[4*56],0);
    const gpu=new h.ctx.Apple2VideoGPU(h.canvas());gpu.reset();gpu.frameTiming='vblank';
    gpu.hw={safe_videodump(){throw Error('locked GPU must not sample live RAM');}};
    gpu.presentRasterFrame(frame,{chrome:0});
    const pixels=gpu.rasterKernel.getPixels(true);assert.equal(pixels[0],254);assert.equal(pixels[4*56],0);
    h.callbacks.splice(0).forEach(fn=>fn(100)); // old timer RAF must not overwrite raster output
});
test('actual Wave driver compiles and presents captured text and wave/YIQ hires without live RAM',()=>{
    const h=rendererHarness(),wave=new h.ctx.Apple2VideoWave(h.canvas());wave.reset();wave.frameTiming='vblank';
    wave.hw={safe_videodump(){throw Error('locked wave must not sample live RAM');}};
    wave.presentRasterFrame(sampleFrame(),{chrome:0});
    const pixels=wave.mixedWaveKernel.getPixels(true);assert.equal(pixels[0],254);assert.equal(pixels[4*112],0);
});
test('Three.js producer receives raster planes and uploads texture without the timer throttle',()=>{
    const h=rendererHarness(),three=new h.ctx.Apple2VideoTHREE(h.canvas());
    assert.equal(three.ensure2DRenderer(),true);three.video2D.reset();three.frameTiming='vblank';three.sync2DLinks();
    three.screenTexture={needsUpdate:false};let copies=0;three.updateTextureCanvas=function(){copies++;};
    three.presentRasterFrame(sampleFrame(),{chrome:0});
    assert.equal(three.video2D.frameTiming,'vblank');assert.equal(three.screenTexture.needsUpdate,true);assert.equal(copies,1);
    three.frameTiming='timer';three.sync2DLinks();assert.equal(three.video2D.frameTiming,'timer');
});
test('MUX coalesces complete frames and suppresses timer/mode redraws until unlock',()=>{
    const h=rendererHarness(),mux=new h.ctx.Apple2VideoMUX(h.canvas());let renders=0,cycles=0,redraws=0,enabled=null;
    mux.active={presentRasterFrame(frame){renders++;this.frame=frame;},cycle(){cycles++;},redraw(){redraws++;},setGfx(){}};
    mux.ensureActive=function(){return true;};mux.hw={setVideoRasterCapture(e){enabled=e;}};
    mux.setFrameTiming('vblank');assert.equal(enabled,true);
    mux.setGfx(true);mux.cycle(17030);mux.redraw();assert.equal(cycles,0);assert.equal(redraws,0);
    const first=sampleFrame(),last=sampleFrame();mux.completeRasterFrame(first);mux.completeRasterFrame(last);
    assert.equal(h.callbacks.length,1);h.callbacks.shift()(100);assert.equal(renders,1);assert.equal(mux.active.frame,last);
    mux.setFrameTiming('timer');assert.equal(enabled,false);mux.cycle(1);assert.equal(cycles,1);assert.ok(redraws>0);
});

test('MUX reset discards a retained frame even when its presentation is already queued',()=>{
    const h=rendererHarness(),mux=new h.ctx.Apple2VideoMUX(h.canvas());let renders=0;
    mux.active={presentRasterFrame(){renders++;}};mux.ensureActive=function(){return true;};
    mux.registerDevices=function(){};mux.setMode=function(){};mux.frameTiming='vblank';
    mux.completeRasterFrame(sampleFrame());mux.reset();h.callbacks.shift()(100);
    assert.equal(renders,0);assert.equal(mux.rasterFrame,null);
    mux.completeRasterFrame(sampleFrame());h.callbacks.shift()(101);assert.equal(renders,1);
});

test('Wave timer/lock/timer transitions retain GPU.js static array upload dimensions',()=>{
    const h=rendererHarness(),wave=new h.ctx.Apple2VideoWave(h.canvas());wave.reset();
    wave.hw={safe_videodump(){return new Uint8Array(0x6000);}};
    wave.setGfx(true);wave.setHires(true);wave.setMix(true);
    const calls=[],kernel=wave.mixedWaveKernel;
    wave.mixedWaveKernel=function(...args){calls.push(args);return kernel(...args);};
    wave.redraw();wave.frameTiming='vblank';wave.presentRasterFrame(sampleFrame(),{chrome:0});
    wave.frameTiming='timer';wave.redraw();assert.equal(calls.length,3);
    const GPU=require(path.join(ROOT,'res/gpu-browser.min.js'));
    const StaticArray=GPU.webGLKernelValueMaps.unsigned.static.Array;
    for(const index of [1,2,3,4,8,9])
    {
        // Normalize VM/Node realms while retaining the actual driver argument sizes.
        const values=calls.map(args=>Array.from(args[index]));
        const upload=new StaticArray(values[0],{name:'arg'+index,type:'Array',origin:'user',
            kernel:{validate:false,setUniform1i(){}},
            context:{activeTexture(){},bindTexture(){},pixelStorei(){},texImage2D(){}},
            onRequestContextHandle(){return 0;},onRequestTexture(){return {};},onRequestIndex(){return 0;}});
        for(const value of values.slice(1))assert.doesNotThrow(()=>upload.updateValue(value));
    }
});
