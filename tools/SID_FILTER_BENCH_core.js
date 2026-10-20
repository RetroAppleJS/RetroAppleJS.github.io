/*
 * SID Filter Lab Phase 4D.0 — deterministic, untimed diagnostic sweeps.
 * Does not change the production synthesizer or the established Bench v3.
 * All levels are measured from the actual PCM output, not hardware reference.
 */
(function(root,factory){
    var api=factory();
    if(typeof module==="object"&&module.exports)module.exports=api;
    else root.SIDFilterBench=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
var RATE=22050,SECONDS=.5,LENGTH=11025,SETTLE=2205;
var CLOCKS={PAL:985248,NTSC:1022727};
var CUTOFFS=[0,64,128,256,384,512,768,1024,1280,1536,1792,2047];
var RESONANCES=[0,4,8,12,15];
var MODES={off:0,lp:0x10,bp:0x20,hp:0x40,
             "lp+bp":0x30,"bp+hp":0x60,"lp+hp":0x50,"all":0x70};
var SCHEMA="retroapplejs.sid.filter-lab.v1";
function check(ok,msg){if(!ok)throw new Error(msg);}
function frequency(hz,clock){
    return Math.max(1,Math.min(65535,Math.round(hz*16777216/clock)));
}
function pcmStats(pcm){
    var s=0,q=0,peak=0,clipped=0;
    for(var i=SETTLE;i<pcm.length;i++){
        var x=pcm[i];check(Number.isFinite(x),"Non-finite filter output");
        s+=x;q+=x*x;peak=Math.max(peak,Math.abs(x));
        if(Math.abs(x)>=1)clipped++;
    }
    var n=pcm.length-SETTLE,mean=s/n;
    return {rms:Math.sqrt(q/n),acRms:Math.sqrt(Math.max(0,q/n-mean*mean)),
        peak:peak,dc:mean,clippedSamples:clipped};
}
function checksum(pcm){
    var dv=new DataView(new ArrayBuffer(4)),h=2166136261;
    for(var i=0;i<pcm.length;i++){
        dv.setFloat32(0,pcm[i],true);
        for(var j=0;j<4;j++)h=Math.imul(h^dv.getUint8(j),16777619)>>>0;
    }
    return ("00000000"+h.toString(16)).slice(-8);
}
function capture(SIDAudio,options){
    options=options||{};
    check(typeof SIDAudio==="function","SIDAudio constructor required");
    var model=Number(options.model||6581),clockName=options.clock||"PAL";
    var clock=CLOCKS[clockName],toneHz=Number(options.toneHz||880);
    var cutoff=options.cutoff===undefined?1024:Number(options.cutoff);
    var resonance=options.resonance===undefined?8:Number(options.resonance);
    var mode=options.mode||"lp",route=options.route!==false;
    var voice=options.voice===undefined?0:Number(options.voice);
    var voice3Off=!!options.voice3Off;
    check(model===6581||model===8580,"Unknown SID model");
    check(!!clock,"Unknown SID clock");
    check(toneHz>=90&&toneHz<=5000&&Number.isFinite(toneHz),"Tone out of range");
    check(Number.isInteger(cutoff)&&cutoff>=0&&cutoff<=2047,"Cutoff out of range");
    check(Number.isInteger(resonance)&&resonance>=0&&resonance<=15,"Resonance out of range");
    check(Object.prototype.hasOwnProperty.call(MODES,mode),"Unknown filter mode");
    check(voice===0||voice===2,"Supported stimulus voice is 1 or 3");
    var d=new SIDAudio(),base=voice*7;
    d.setModel(model);d.setClock(clock);
    var inc=frequency(toneHz,clock);
    // Sawtooth gated at fastest attack, decay 0, sustain 15.
    // Record an entire settled steady-state window, not just one FFT bin.
    d.writeRegister(base,inc&255);d.writeRegister(base+1,inc>>>8);
    d.writeRegister(base+5,0x00);d.writeRegister(base+6,0xf0);
    d.writeRegister(base+4,0x21);
    d.writeRegister(0x15,cutoff&7);
    d.writeRegister(0x16,cutoff>>>3);
    d.writeRegister(0x17,(resonance<<4)|(route?(1<<voice):0));
    d.writeRegister(0x18,(voice3Off?0x80:0)|MODES[mode]|0x0f);
    var pcm=d.renderOffline(LENGTH);
    check(pcm&&pcm.length===LENGTH,"Incorrect PCM sample count");
    var stats=pcmStats(pcm),engine=d.getAudioStats();
    check(engine.dropped===0&&engine.underruns===0&&engine.clockRewinds===0,
        "Unexpected offline audio-scheduler event");
    return {model:model,clock:clockName,sampleRate:RATE,toneHz:toneHz,
        cutoff:cutoff,resonance:resonance,mode:mode,route:route,
        voice:voice,voice3Off:voice3Off,samples:LENGTH,
        analysis:stats,hash:checksum(pcm)};
}
function diagnostics(SIDAudio,options){
    options=options||{};
    var base={model:options.model||6581,clock:options.clock||"PAL",
        toneHz:options.toneHz||880,cutoff:1024,resonance:8};
    function run(x){return capture(SIDAudio,Object.assign({},base,x));}
    var direct=run({route:false,mode:"off"});
    var filtered=run({route:true,mode:"lp"});
    var offRoute=run({route:true,mode:"off"});
    var directV3=run({voice:2,route:false,mode:"off"});
    var mutedV3=run({voice:2,route:false,mode:"off",voice3Off:true});
    var filteredV3=run({voice:2,route:true,mode:"lp"});
    var filteredV3Off=run({voice:2,route:true,mode:"lp",voice3Off:true});
    var r0=run({route:true,mode:"lp",resonance:0});
    var r15=run({route:true,mode:"lp",resonance:15});
    return {model:base.model,clock:base.clock,toneHz:base.toneHz,
        direct:direct,filtered:filtered,filteredWithModeOff:offRoute,
        directVoice3:directV3,directVoice3Off:mutedV3,
        filteredVoice3:filteredV3,filteredVoice3Off:filteredV3Off,
        resonance0:r0,resonance15:r15,
        observations:{
            filterPathDisabledWhenNoMode:offRoute.analysis.acRms<1e-10,
            voice3OffMutesDirect:mutedV3.analysis.acRms<1e-10,
            voice3OffCurrentlyMutesFiltered:filteredV3Off.analysis.acRms<1e-10,
            resonanceCurrentlyInert:r0.hash===r15.hash
        }};
}
function gainDb(level,reference){
    return reference>1e-12 ? 20*Math.log10(Math.max(level,1e-12)/reference):null;
}
function survey(SIDAudio,options){
    options=options||{};
    var mode=options.mode||"lp",clock=options.clock||"PAL";
    var toneHz=Number(options.toneHz||880);
    check(Object.prototype.hasOwnProperty.call(MODES,mode)&&mode!=="off",
        "Select an active filter mode");
    var models=[],points=[];
    for(var model of [6581,8580]){
        var bypass=capture(SIDAudio,{model:model,clock:clock,toneHz:toneHz,mode:"off",route:false,
            cutoff:1024,resonance:0});
        models.push({model:model,bypass:bypass.analysis.acRms,bypassHash:bypass.hash});
        for(var resonance of RESONANCES){
            for(var cutoff of CUTOFFS){
                var x=capture(SIDAudio,{model:model,clock:clock,toneHz:toneHz,
                    mode:mode,cutoff:cutoff,resonance:resonance,route:true});
                points.push({model:model,resonance:resonance,cutoff:cutoff,
                    acRms:x.analysis.acRms,
                    gainDb:gainDb(x.analysis.acRms,bypass.analysis.acRms),
                    peak:x.analysis.peak,dc:x.analysis.dc,
                    clippedSamples:x.analysis.clippedSamples,hash:x.hash});
            }
        }
    }
    return {schema:SCHEMA,clock:clock,mode:mode,toneHz:toneHz,
        sampleRate:RATE,samplesPerCapture:LENGTH,settleSamples:SETTLE,
        cutoffs:CUTOFFS.slice(),resonances:RESONANCES.slice(),models:models,
        points:points,interpretation:"Relative PCM output levels from the present production filter; not calibrated SID hardware data"};
}
return {SCHEMA:SCHEMA,RATE:RATE,LENGTH:LENGTH,SETTLE:SETTLE,
    CLOCKS:CLOCKS,CUTOFFS:CUTOFFS,RESONANCES:RESONANCES,MODES:MODES,
    capture:capture,diagnostics:diagnostics,survey:survey,
    pcmStats:pcmStats,checksum:checksum,gainDb:gainDb};
});
