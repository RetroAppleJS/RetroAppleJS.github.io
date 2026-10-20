/*
 * Phase 4D.2a — spectral filter response measurements, NOT hardware calibration.
 * Uses the actual production SIDAudio renderer, a triangle oscillator, and
 * a matched bypass signal. The fundamental is extracted using a Hann-window
 * complex lock-in at the actual SID oscillator register frequency.
 * This does not step a chip per cycle or modify production DSP.
 */
(function(root,factory){
    var api=factory();
    if(typeof module==="object"&&module.exports)module.exports=api;
    else root.SIDFilterCalibration=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
var SCHEMA="retroapplejs.sid.filter-calibration.v1";
var SAMPLE_RATE=22050,SAMPLES=11025,SETTLE=2205;
var CLOCKS={PAL:985248,NTSC:1022727};
var FREQUENCIES=[110,220,440,880,1760,3520];
var CUTOFFS=[0,64,128,256,384,512,768,1024,1536,2047];
var RESONANCES=[0,8,15];
var MODES={lp:0x10,bp:0x20,hp:0x40};
function assert(ok,reason){if(!ok)throw Error(reason);}
function hzToRegister(hz,clock){
    return Math.max(1,Math.min(65535,Math.round(hz*16777216/clock)));
}
function validate(options){
    options=options||{};
    var clock=options.clock||"PAL",mode=options.mode||"lp";
    assert(Object.prototype.hasOwnProperty.call(CLOCKS,clock),"Unknown clock");
    assert(Object.prototype.hasOwnProperty.call(MODES,mode),"Select LP, BP or HP");
    return {clock:clock,mode:mode};
}
// The signal is intentionally TRIANGLE rather than sawtooth (reduced
// harmonic content). Its extracted fundamental is compared with the
// *same* oscillator routed directly, so wavetable/harmonic leakage
// does not get mistaken for a hardware filter transfer curve.
function render(SIDAudio,params,bypass){
    assert(typeof SIDAudio==="function","SIDAudio constructor required");
    assert(params.model===6581||params.model===8580,"Unknown model");
    assert(params.cutoff>=0&&params.cutoff<=2047&&Number.isInteger(params.cutoff),"Invalid cutoff");
    assert(params.resonance>=0&&params.resonance<=15&&Number.isInteger(params.resonance),"Invalid resonance");
    var cfg=validate(params),clock=CLOCKS[cfg.clock];
    assert(params.hz>=90&&params.hz<=4000&&Number.isFinite(params.hz),"Invalid tone");
    var reg=hzToRegister(params.hz,clock),actualHz=reg*clock/16777216;
    var d=new SIDAudio();d.setModel(params.model);d.setClock(clock);
    d.writeRegister(0,reg&255);d.writeRegister(1,reg>>>8);
    d.writeRegister(5,0);d.writeRegister(6,0xf0);
    d.writeRegister(4,0x11); // TRIANGLE + GATE
    d.writeRegister(0x15,params.cutoff&7);
    d.writeRegister(0x16,params.cutoff>>>3);
    d.writeRegister(0x17,(params.resonance<<4)|(bypass?0:1));
    d.writeRegister(0x18,(bypass?0:MODES[cfg.mode])|15);
    var pcm=d.renderOffline(SAMPLES);
    var audio=d.getAudioStats();
    assert(pcm.length===SAMPLES&&audio.dropped===0&&audio.underruns===0,
      "Offline SID rendering error");
    return {pcm:pcm,actualHz:actualHz,register:reg};
}
function project(pcm,frequency){
    assert(pcm&&pcm.length===SAMPLES,"Unexpected PCM length");
    var re=0,im=0,power=0,dc=0,peak=0,clipped=0,weightSum=0;
    var n=SAMPLES-SETTLE,omega=2*Math.PI*frequency/SAMPLE_RATE;
    for(var i=0;i<n;i++){
        var sample=pcm[i+SETTLE];
        assert(Number.isFinite(sample),"Nonfinite filter output");
        var w=.5*(1-Math.cos(2*Math.PI*i/(n-1))),angle=omega*(i+SETTLE);
        re+=w*sample*Math.cos(angle);im-=w*sample*Math.sin(angle);
        weightSum+=w;power+=sample*sample;dc+=sample;
        peak=Math.max(peak,Math.abs(sample));if(Math.abs(sample)>=1)clipped++;
    }
    return {re:2*re/weightSum,im:2*im/weightSum,
        fundamental:2*Math.hypot(re,im)/weightSum,
        rms:Math.sqrt(power/n),dc:dc/n,peak:peak,clippedSamples:clipped};
}
function referenceKey(p){return p.model+"/"+p.clock+"/"+p.hz;}
function measure(SIDAudio,params,cache){
    var config=validate(params);params=Object.assign({},params,config);
    cache=cache||Object.create(null);
    var key=referenceKey(params),bypass=cache[key];
    if(!bypass){
        var unfiltered=render(SIDAudio,params,true);
        bypass=project(unfiltered.pcm,unfiltered.actualHz);
        assert(bypass.fundamental>1e-6,"Bypass fundamental is too small");
        cache[key]=bypass;
    }
    var filtered=render(SIDAudio,params,false);
    var probe=project(filtered.pcm,filtered.actualHz);
    // Transfer ratio (filter / bypass) uses the same SID waveform and
    // phase origin. No arbitrary gain normalization across SID models.
    var den=bypass.re*bypass.re+bypass.im*bypass.im;
    var real=(probe.re*bypass.re+probe.im*bypass.im)/den;
    var imag=(probe.im*bypass.re-probe.re*bypass.im)/den;
    var magnitude=Math.hypot(real,imag);
    return {model:params.model,clock:params.clock,mode:params.mode,
        requestedHz:params.hz,actualHz:filtered.actualHz,register:filtered.register,
        cutoff:params.cutoff,resonance:params.resonance,
        gainDb:20*Math.log10(Math.max(magnitude,1e-12)),
        phaseDeg:Math.atan2(imag,real)*180/Math.PI,
        fundamental:probe.fundamental,bypassFundamental:bypass.fundamental,
        rms:probe.rms,dc:probe.dc,peak:probe.peak,
        clippedSamples:probe.clippedSamples};
}
function jobs(options){
    var cfg=validate(options),out=[];
    for(var model of [6581,8580])
      for(var hz of FREQUENCIES)
        for(var resonance of RESONANCES)
          for(var cutoff of CUTOFFS)
            out.push({model:model,hz:hz,resonance:resonance,
                cutoff:cutoff,mode:cfg.mode,clock:cfg.clock});
    return out;
}
function result(options,points){
    var cfg=validate(options);
    return {schema:SCHEMA,phase:"4D.2a",method:"triangle-oscillator-matched-bypass-hann-fundamental",
        clock:cfg.clock,mode:cfg.mode,sampleRate:SAMPLE_RATE,
        samplesPerCapture:SAMPLES,settleSamples:SETTLE,
        frequenciesHz:FREQUENCIES.slice(),cutoffs:CUTOFFS.slice(),
        resonances:RESONANCES.slice(),points:points,
        referenceStatus:"emulator measurement only; no external physical SID samples loaded",
        referenceSources:[
          {role:"published reSID model, not measured response overlay",
           url:"https://github.com/libsidplayfp/resid/blob/master/filter.cc"},
          {role:"reSIDfp circuit-model documentation, not physical data in this export",
           url:"https://sidplay-residfp.sourceforge.io/docs/classreSIDfp_1_1Filter6581.html"}
        ],
        limitations:"Extracted fundamental of triangle input, not a perfectly pure sine or physical-chip calibration. Sample rate 22050 Hz, Nyquist 11025 Hz. Test frequencies 110–3520 Hz."};
}
function survey(SIDAudio,options){
    var q=jobs(options),cache=Object.create(null),points=[];
    for(var i=0;i<q.length;i++)points.push(measure(SIDAudio,q[i],cache));
    return result(options,points);
}
return {SCHEMA:SCHEMA,SAMPLE_RATE:SAMPLE_RATE,SAMPLES:SAMPLES,SETTLE:SETTLE,
    CLOCKS:CLOCKS,FREQUENCIES:FREQUENCIES,CUTOFFS:CUTOFFS,
    RESONANCES:RESONANCES,MODES:MODES,hzToRegister:hzToRegister,
    render:render,project:project,measure:measure,
    jobs:jobs,result:result,survey:survey};
});