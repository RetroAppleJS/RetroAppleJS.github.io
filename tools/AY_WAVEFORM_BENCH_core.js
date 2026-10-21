/* RetroAppleJS · AY Waveform Laboratory 1.1 — isolated offline experiments. */
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AYWaveformBench = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  var SCHEMA = 'retroapplejs.ay.waveform-bench.v1.1';
  var RATE = 22050, TIMEBASE = 1000000000, BLOCK = 2048;
  var FIXTURES = [
    {id:'square',label:'Square / native tone',kind:'tone',description:'AY channel A, fixed 50% tone, R7=$3E'},
    {id:'saw-down',label:'Falling saw / envelope',kind:'saw',description:'Audio-rate envelope, shape $8; no tone/noise'},
    {id:'saw-up',label:'Rising saw / envelope',kind:'saw',description:'Audio-rate envelope, shape $C; no tone/noise'},
    {id:'triangle',label:'Triangle / envelope',kind:'triangle',description:'Alternating envelope, shape $A; no tone/noise'},
    {id:'buzzer',label:'Tone × envelope / buzzer',kind:'buzzer',description:'Tone gate multiplied by AY audio-rate envelope'},
    {id:'noise',label:'AY noise',kind:'noise',description:'Noise LFSR; no pitched oscillator'},
    {id:'tone-noise',label:'Square + noise',kind:'tone-noise',description:'AY tone and noise enabled on channel A'},
    {id:'detune',label:'Two detuned square oscillators',kind:'detune',description:'Two tone channels, A and B, on AY0'},
    {id:'two-chip',label:'Two-chip: square + envelope saw',kind:'two-chip',description:'AY0 tone, independent AY1 envelope saw'}
  ];
  function number(v,name,min,max) {
    if (!Number.isFinite(v) || v < min || v > max) throw new Error('Invalid '+name);
    return v;
  }
  function clamp(n,lo,hi) { return Math.max(lo,Math.min(hi,n)); }
  function nearestPeriod(clock,hz,divider,max) {
    number(clock,'clock',500000,1800000); number(hz,'frequency',1,18000);
    var ideal = clock / (divider*hz), period = clamp(Math.round(ideal),1,max);
    var actualHz = clock/(divider*period);
    return {period:period,actualHz:actualHz,requestedHz:hz,
      errorCents:1200*Math.log2(actualHz/hz),clamped:ideal<1||ideal>max};
  }
  function describe(fixture,hz,clock,ratio) {
    var kind = FIXTURES.find(function(x){return x.id===fixture;});
    if (!kind) throw new Error('Unknown fixture '+fixture);
    var divider = kind.kind==='saw'?256:kind.kind==='triangle'?512:16;
    if (kind.kind==='noise') return {period:null,actualHz:null,requestedHz:hz,errorCents:null,clamped:false};
    if(kind.kind==='two-chip') divider=16;
    var p=nearestPeriod(clock,hz,divider,divider===16?4095:65535);
    if(kind.kind==='buzzer') p.envelope=nearestPeriod(clock,clamp(hz*ratio,1,18000),256,65535);
    if(kind.kind==='two-chip') p.envelope=nearestPeriod(clock,hz,256,65535);
    if(kind.kind==='detune') p.secondary=nearestPeriod(clock,hz*Math.pow(2,12/1200),16,4095);
    return p;
  }
  function generate(options) {
    options=options||{};
    var fixture=options.fixture||'square',hz=number(Number(options.hz===undefined?110:options.hz),'Hz',10,8000);
    var clock=number(Number(options.clock===undefined?1021800:options.clock),'AY clock',500000,1800000);
    var duration=number(Number(options.duration===undefined?1:options.duration),'duration',0.1,3);
    var ratio=number(Number(options.ratio===undefined?1:options.ratio),'envelope ratio',0.125,8);
    var volume=Math.round(number(Number(options.volume===undefined?13:options.volume),'volume',0,15));
    var noisePeriod=Math.round(number(Number(options.noisePeriod===undefined?8:options.noisePeriod),'noise period',1,31));
    var desc=describe(fixture,hz,clock,ratio), f=FIXTURES.find(function(x){return x.id===fixture;});
    var events=[], seq=0;
    function write(chip,reg,value,seconds) {
      seconds=seconds||0;
      events.push({tick:Math.round(seconds*TIMEBASE),chip:chip,reg:reg,value:value&255,seq:seq++});
    }
    function period(chip,channel,p) {
      write(chip,channel*2,p&255);write(chip,channel*2+1,(p>>8)&15);
    }
    function envelope(chip,p,shape) {
      write(chip,11,p&255);write(chip,12,(p>>8)&255);write(chip,13,shape);
    }
    // Explicitly mute both chips. R13 is only written when the experiment uses an envelope.
    for(var c=0;c<2;c++) {write(c,7,63);write(c,8,0);write(c,9,0);write(c,10,0);}
    switch(fixture) {
      case 'square': period(0,0,desc.period);write(0,7,0x3e);write(0,8,volume);break;
      case 'saw-down': case 'saw-up': case 'triangle':
        envelope(0,desc.period,fixture==='saw-down'?0x8:fixture==='saw-up'?0xc:0xa);
        write(0,8,0x10);break;
      case 'buzzer':
        period(0,0,desc.period);envelope(0,desc.envelope.period,0x8);
        write(0,7,0x3e);write(0,8,0x10);break;
      case 'noise': write(0,6,noisePeriod);write(0,7,0x37);write(0,8,volume);break;
      case 'tone-noise':
        period(0,0,desc.period);write(0,6,noisePeriod);write(0,7,0x36);write(0,8,volume);break;
      case 'detune':
        period(0,0,desc.period);period(0,1,desc.secondary.period);
        write(0,7,0x3c);write(0,8,volume);write(0,9,Math.max(1,volume-3));break;
      case 'two-chip':
        period(0,0,desc.period);write(0,7,0x3e);write(0,8,volume);
        envelope(1,desc.envelope.period,0x8);write(1,8,0x10);break;
      default:throw new Error('Unknown fixture '+fixture);
    }
    // Stable order at identical timestamps matters, especially for R13 retriggers.
    events.sort(function(a,b){return a.tick-b.tick||a.seq-b.seq;});
    return {fixture:fixture,kind:f.kind,description:f.description,hz:hz,clock:clock,duration:duration,
      ratio:ratio,volume:volume,noisePeriod:noisePeriod,pitch:desc,events:events};
  }
  function pcmMetrics(samples, pitchHz) {
    var n=samples.length,sum=0,squares=0,peak=0,clipped=0;
    for(var i=0;i<n;i++){
      var x=samples[i];sum+=x;squares+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>1)clipped++;
    }
    var spectral=spectrum(samples,RATE,pitchHz);
    return {sampleCount:n,rms:Math.sqrt(squares/n),peak:peak,dc:sum/n,clippedSamples:clipped,
      dominantHz:spectral.dominantHz,fundamentalHz:spectral.fundamentalHz, fundamentalDb:spectral.fundamentalDb,
      harmonicDb:spectral.harmonicDb,thdPercent:spectral.thdPercent,aliasRisk:spectral.aliasRisk,
      centroidHz:spectral.centroidHz,
      spectral:spectral.bins};
  }
  function spectrum(samples,rate,expectedHz) {
    // Radix-2 FFT on a Hann-windowed central 2048-sample slice. No dependencies.
    var N=2048, start=Math.floor((samples.length-N)/2);
    if(start<0) throw new Error('Too few samples for FFT');
    var re=new Float64Array(N),im=new Float64Array(N);
    for(var i=0;i<N;i++){
      re[i]=samples[start+i]*(0.5-0.5*Math.cos(2*Math.PI*i/(N-1)));
    }
    for(var i=1,j=0;i<N;i++){
      var bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
      if(i<j){var tmp=re[i];re[i]=re[j];re[j]=tmp;}
    }
    for(var len=2;len<=N;len<<=1){
      var angle=-2*Math.PI/len,stepCos=Math.cos(angle),stepSin=Math.sin(angle);
      for(var startBin=0;startBin<N;startBin+=len){
        var cos=1,sin=0;
        for(var j=0;j<len/2;j++){
          var a=startBin+j,b=a+len/2;
          var tr=cos*re[b]-sin*im[b],ti=cos*im[b]+sin*re[b];
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          var nc=cos*stepCos-sin*stepSin;
          sin=sin*stepCos+cos*stepSin;cos=nc;
        }
      }
    }
    var bins=[],magTotal=0,moment=0,best=0,bestIndex=1,dft=[];
    for(var k=1;k<=N/2;k++){
      var v=Math.hypot(re[k],im[k]);dft.push(v);
      if(v>best){best=v;bestIndex=k;}
      magTotal+=v;moment+=v*k*rate/N;
      if(k%4===0)bins.push({hz:k*rate/N,db:20*Math.log10(Math.max(1e-9,v/N))});
    }
    var offset=0,j=bestIndex-1;
    if(j>0&&j<dft.length-1){
      var a=Math.log(Math.max(dft[j-1],1e-12)),b=Math.log(Math.max(dft[j],1e-12)),c=Math.log(Math.max(dft[j+1],1e-12));
      if(a-2*b+c!==0)offset=clamp(.5*(a-c)/(a-2*b+c),-0.5,0.5);
    }
    // Matched-frequency Hann projection resolves a target fundamental between FFT bins.
    // This is distinct from the strongest spectral peak (which may be a harmonic).
    var fundamentalHz=null,fundamentalDb=null,harmonicDb=[],thdPercent=null,aliasRisk=null;
    if(Number.isFinite(expectedHz)&&expectedHz>0&&expectedHz<rate/2){
      var hannPower=0;
      function projection(hz){
        var rr=0,ii=0;
        for(var q=0;q<N;q++){
          var window=0.5-0.5*Math.cos(2*Math.PI*q/(N-1));
          var phase=2*Math.PI*hz*q/rate;
          rr+=samples[start+q]*window*Math.cos(phase);
          ii-=samples[start+q]*window*Math.sin(phase);
        }
        return Math.hypot(rr,ii);
      }
      for(var q=0;q<N;q++)hannPower+=0.5-0.5*Math.cos(2*Math.PI*q/(N-1));
      var fundamentalPower=projection(expectedHz);
      fundamentalHz=expectedHz;
      fundamentalDb=20*Math.log10(Math.max(1e-12,2*fundamentalPower/hannPower));
      var harmonicSum=0;
      for(var h=1;h*expectedHz<rate/2&&h<=32;h++){
        var amplitude=2*projection(h*expectedHz)/hannPower;
        harmonicDb.push({harmonic:h,hz:h*expectedHz,db:20*Math.log10(Math.max(1e-12,amplitude))});
        if(h>1)harmonicSum+=amplitude*amplitude;
      }
      var fundamentalAmplitude=2*fundamentalPower/hannPower;
      thdPercent=fundamentalAmplitude>1e-8?100*Math.sqrt(harmonicSum)/fundamentalAmplitude:null;
      // Warning based on available harmonics and wave type, not proof of aliasing.
      aliasRisk=expectedHz*32>=rate/2?'High: 32nd harmonic exceeds Nyquist':
        expectedHz*8>=rate/2?'Moderate: 8th harmonic exceeds Nyquist':'Low at first 8 harmonics';
    }
    return {dominantHz:best>1e-9?(bestIndex+offset)*rate/N:0,
      fundamentalHz:fundamentalHz,fundamentalDb:fundamentalDb,harmonicDb:harmonicDb,
      thdPercent:thdPercent,aliasRisk:aliasRisk,
      centroidHz:magTotal?moment/magTotal:0,bins:bins};
  }
  async function render(coreAPI,options) {
    var spec=generate(options),backend=options&&options.backend||'js';
    if(!coreAPI||typeof coreAPI.create!=='function')throw new Error('AYCore missing');
    var engine=await coreAPI.create({backend:backend,chipCount:2,sampleRate:RATE,
      renderProfile:'economy',timebaseHz:TIMEBASE,maxFrames:BLOCK,maxEvents:1024});
    var floats=new Float32Array(Math.round(spec.duration*RATE));
    var temp={left:new Float32Array(BLOCK),right:new Float32Array(BLOCK)};
    var packed=new Uint8Array(1024*16),view=new DataView(packed.buffer);
    var n=0,event=0,clock=spec.clock,now=0, actualBackend=engine.backend;
    var start=typeof performance!=='undefined'?performance.now():Date.now();
    try {
      for(var c=0;c<2;c++){
        engine.configureChip(c,{model:'AY',clockHz:clock});
        // Identical to production stereo arrangement: AY0 left, AY1 right.
        // All three channels receive equal pan on their respective chip.
        engine.setMix(c,c===0?[.5,0,.5,0,.5,0]:[0,.5,0,.5,0,.5]);
      }
      while(n<floats.length){
        var nextFrames=Math.min(BLOCK,floats.length-n);
        var end=Math.ceil((n+nextFrames)*TIMEBASE/RATE),count=0;
        while(event<spec.events.length&&spec.events[event].tick<=end){
          var e=spec.events[event++];
          coreAPI.packEvent(view,count++,e.tick,e.chip,0,e.reg,e.value);
        }
        var produced=engine.renderUntil(end,{data:packed,count:count},temp);
        if(produced!==nextFrames)throw new Error('Unexpected AYCore sample count '+produced+' vs '+nextFrames);
        for(var i=0;i<produced;i++)floats[n+i]=(temp.left[i]+temp.right[i])*.5;
        n+=produced;now=end;
      }
    } finally {engine.destroy();}
    var endTime=typeof performance!=='undefined'?performance.now():Date.now();
    var pitch=spec.kind==='noise'?null:spec.pitch.actualHz;
    return {spec:spec,backend:actualBackend,renderMs:endTime-start,rate:RATE,pcm:floats,
      metrics:pcmMetrics(floats,pitch)};
  }
  function wav(pcm,rate) {
    var n=pcm.length,b=new ArrayBuffer(44+n*2),dv=new DataView(b);
    function four(off,s){for(var i=0;i<4;i++)dv.setUint8(off+i,s.charCodeAt(i));}
    four(0,'RIFF');dv.setUint32(4,36+n*2,true);four(8,'WAVE');four(12,'fmt ');
    dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
    dv.setUint32(24,rate,true);dv.setUint32(28,rate*2,true);
    dv.setUint16(32,2,true);dv.setUint16(34,16,true);four(36,'data');dv.setUint32(40,n*2,true);
    for(var j=0;j<n;j++){
      var x=clamp(pcm[j],-1,1);
      dv.setInt16(44+j*2,Math.round(x<0?x*32768:x*32767),true);
    }
    return b;
  }
  function report(result) {
    var m=result.metrics;
    return {schema:SCHEMA,createdAt:new Date().toISOString(),sampleRate:result.rate,
      renderProfile:'economy',backend:result.backend,renderMs:result.renderMs,
      spec:Object.assign({},result.spec,{events:result.spec.events.map(function(e){return {tick:e.tick,chip:e.chip,reg:e.reg,value:e.value};})}),
      metrics:{sampleCount:m.sampleCount,rms:m.rms,peak:m.peak,dc:m.dc,clippedSamples:m.clippedSamples,
        dominantHz:m.dominantHz,fundamentalHz:m.fundamentalHz,fundamentalDb:m.fundamentalDb,
        harmonicDb:m.harmonicDb,thdPercent:m.thdPercent,aliasRisk:m.aliasRisk,centroidHz:m.centroidHz}};
  }
  return {SCHEMA:SCHEMA,RATE:RATE,FIXTURES:FIXTURES,nearestPeriod:nearestPeriod,
    describe:describe,generate:generate,spectrum:spectrum,pcmMetrics:pcmMetrics,render:render,
    wav:wav,report:report};
});
