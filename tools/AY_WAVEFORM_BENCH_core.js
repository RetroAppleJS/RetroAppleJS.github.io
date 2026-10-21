/* RetroAppleJS · AY Waveform Laboratory 1.3 — isolated offline experiments. */
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AYWaveformBench = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  var SCHEMA = 'retroapplejs.ay.waveform-bench.v1.3';
  var RATE = 22050, TIMEBASE = 1000000000, BLOCK = 256;
  var FIXTURES = [
    {id:'square',label:'Square / native tone',kind:'tone',description:'AY channel A, fixed 50% tone, R7=$3E'},
    {id:'saw-down',label:'Falling saw / envelope',kind:'saw',description:'Audio-rate envelope, shape $8; no tone/noise'},
    {id:'saw-up',label:'Rising saw / envelope',kind:'saw',description:'Audio-rate envelope, shape $C; no tone/noise'},
    {id:'triangle',label:'Triangle / AY envelope $A (baseline)',kind:'triangle',description:'Alternating envelope shape $A; hardware baseline'},
    {id:'triangle-invert',label:'Triangle / AY envelope $E',kind:'triangle',description:'Inverted alternating envelope shape $E; compare DAC asymmetry'},
    {id:'triangle-dac-raw',label:'Triangle / software 32-step (raw register levels)',kind:'triangle-dac',description:'32 software-timed volume changes/cycle; raw linear register indices (NOT linear amplitude)'},
    {id:'triangle-dac',label:'Triangle / software 32-step (calibrated)',kind:'triangle-dac',description:'32 software-timed volume writes/cycle; inverse measured AY volume law'},
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
    if(kind.kind==='triangle-dac') return {period:null,actualHz:hz,requestedHz:hz,errorCents:0,clamped:false};
    if(kind.kind==='two-chip') divider=16;
    var p=nearestPeriod(clock,hz,divider,divider===16?4095:65535);
    if(kind.kind==='buzzer') p.envelope=nearestPeriod(clock,clamp(hz*ratio,1,18000),256,65535);
    if(kind.kind==='two-chip') p.envelope=nearestPeriod(clock,hz,256,65535);
    if(kind.kind==='detune') p.secondary=nearestPeriod(clock,hz*Math.pow(2,12/1200),16,4095);
    return p;
  }
  function kindSoftware(fixture){return fixture==='triangle-dac'||fixture==='triangle-dac-raw';}
  function generate(options) {
    options=options||{};
    var fixture=options.fixture||'square',hz=number(Number(options.hz===undefined?110:options.hz),'Hz',10,8000);
    var clock=number(Number(options.clock===undefined?1021800:options.clock),'AY clock',500000,1800000);
    var duration=number(Number(options.duration===undefined?1:options.duration),'duration',0.1,3);
    var ratio=number(Number(options.ratio===undefined?1:options.ratio),'envelope ratio',0.125,8);
    var volume=Math.round(number(Number(options.volume===undefined?13:options.volume),'volume',0,15));
    var noisePeriod=Math.round(number(Number(options.noisePeriod===undefined?8:options.noisePeriod),'noise period',1,31));
    var phaseOffset=number(Number(options.phaseOffset===undefined?0:options.phaseOffset),'phase offset',0,.875);
    // Software volume DAC fixtures are limited so event arrays stay bounded; the 6502 cost is reported separately.
    if((fixture==='triangle-dac'||fixture==='triangle-dac-raw') && hz*duration*32>48000)
      throw new Error('Software triangle would exceed 48,000 volume writes; shorten the capture or lower its pitch.');
    var reference=options.reference===undefined?'auto':String(options.reference);
    if(['auto','square','saw','triangle'].indexOf(reference)<0)throw new Error('Invalid ideal reference');
    var desc=describe(fixture,hz,clock,ratio), f=FIXTURES.find(function(x){return x.id===fixture;});
    var volumeCurve=options.volumeCurve;
    if(volumeCurve!==undefined && (!Array.isArray(volumeCurve)||volumeCurve.length!==16||volumeCurve.some(function(v){return !Number.isFinite(v)||v<0;})))
      throw new Error('Volume calibration must be an array of 16 nonnegative finite values');
    var calibrationSource=volumeCurve?'measured AYCore tone RMS':'nominal approximation';
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
      case 'saw-down': case 'saw-up': case 'triangle': case 'triangle-invert':
        envelope(0,desc.period,fixture==='saw-down'?0x8:fixture==='saw-up'?0xc:fixture==='triangle-invert'?0xe:0xa);
        write(0,8,0x10);break;
      case 'buzzer':
        period(0,0,desc.period);
        write(0,11,desc.envelope.period&255);write(0,12,(desc.envelope.period>>8)&255);
        write(0,7,0x3e);
        // Phase offset shifts the R13 envelope retrigger against the already-running tone.
        // Initially muted until trigger; the measurement window is central and excludes this transient.
        write(0,13,0x8,phaseOffset/desc.actualHz);
        write(0,8,0x10,phaseOffset/desc.actualHz);break;
      case 'triangle-dac': case 'triangle-dac-raw': {
        // Volume register updates (R8): this is a software DAC technique, NOT an AY envelope.
        // Use the empirical RMS-vs-volume curve to compensate for the AY logarithmic DAC.
        var curve=volumeCurve||Array.from({length:16},function(_,i){return i===0?0:Math.pow(2,(i-15)/2);});
        var ceiling=curve[volume],steps=32,cycles=Math.ceil(duration*hz);
        write(0,7,0x3f);
        for(var idx=0;idx<cycles*steps;idx++) {
          var phase=(idx%steps)/steps;
          var level01=1-Math.abs(2*phase-1); // low -> high -> low: symmetric triangle
          var value;
          if(fixture==='triangle-dac-raw') value=Math.round(volume*level01);
          else {
            var goal=level01*ceiling,bestDiff=Infinity;value=0;
            for(var v=0;v<=volume;v++){
              var diff=Math.abs(curve[v]-goal);
              if(diff<bestDiff){bestDiff=diff;value=v;}
            }
          }
          var t=idx/(steps*hz);
          if(t<duration)write(0,8,value,t);
        }
        break;
      }
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
      ratio:ratio,volume:volume,noisePeriod:noisePeriod,phaseOffset:phaseOffset,
      calibrationSource:(fixture==='triangle-dac'?calibrationSource:null),
      softwareVolumeWritesPerSecond:kindSoftware(fixture)?32*hz:0,
      referencePreference:reference,pitch:desc,events:events};
  }
  // Phase 1.2: ideal Fourier magnitudes, normalized so the fundamental is 1.0.
  // Magnitude-only spectra cannot distinguish upward from downward saw polarity.
  var IDEAL_REFERENCES=['square','saw','triangle'];
  var REFERENCE_FLOOR_DB=-48, MAX_HARMONICS=32, SCORE_SCALE_DB=12;
  function idealHarmonic(reference,harmonic) {
    if(IDEAL_REFERENCES.indexOf(reference)<0)throw new Error('Unknown ideal reference '+reference);
    if(reference==='saw')return 1/harmonic;
    if(harmonic%2===0)return 0;
    return reference==='triangle'?1/(harmonic*harmonic):1/harmonic;
  }
  function idealWaveform(reference,phase) {
    if(IDEAL_REFERENCES.indexOf(reference)<0)throw new Error('Unknown ideal reference '+reference);
    phase=((phase%1)+1)%1;
    if(reference==='square')return phase<.5?1:-1;
    if(reference==='saw')return 1-2*phase;
    return 1-4*Math.abs(phase-.5);
  }
  function referenceFor(fixture) {
    if(fixture==='square')return 'square';
    if(fixture==='saw-down'||fixture==='saw-up')return 'saw';
    if(fixture==='triangle'||fixture==='triangle-invert'||kindSoftware(fixture))return 'triangle';
    return null;
  }
  function comparisonPolicy(fixture,reference) {
    if(fixture==='noise')return {eligible:false,reason:'Broadband noise has no single pitched fundamental.'};
    if(fixture==='tone-noise')return {eligible:false,reason:'Tone plus broadband noise is not a single harmonic oscillator.'};
    if(fixture==='detune')return {eligible:false,reason:'Detuned oscillators have two independent fundamentals and beating.'};
    if(fixture==='two-chip')return {eligible:false,reason:'Two independent AY chips produce multiple oscillator components.'};
    if(fixture==='buzzer')return {eligible:false,reason:'Tone × envelope introduces modulation and sidebands; single-series THD is invalid.'};
    var nativeReference=referenceFor(fixture);
    if(!nativeReference)return {eligible:false,reason:'No defined single-oscillator reference.'};
    return {eligible:true,reference:reference==='auto'?nativeReference:reference,automaticReference:nativeReference};
  }
  function harmonicAnalysis(samples,rate,frequency) {
    // The FFT view remains 2,048 points; harmonic projections instead use up to
    // 8,192 centred samples to resolve low notes and limit adjacent-bin leakage.
    var length=Math.min(samples.length,8192);
    var start=Math.floor((samples.length-length)/2);
    if(length<2048)throw new Error('Insufficient samples for harmonic analysis');
    var data=new Float64Array(length),windowSum=0,mean=0,signalSquares=0;
    for(var i=0;i<length;i++)mean+=samples[start+i];
    mean/=length;
    for(var j=0;j<length;j++){
      var w=.5-.5*Math.cos(2*Math.PI*j/(length-1));
      var centered=samples[start+j]-mean;data[j]=centered*w;windowSum+=w;signalSquares+=centered*centered;
    }
    var harmonics=[],amplitudes=[],sum=0;
    for(var h=1;h<=MAX_HARMONICS&&h*frequency<rate/2;h++) {
      var a=2*Math.PI*h*frequency/rate, stepR=Math.cos(a),stepI=Math.sin(a),c=1,si=0,r=0,im=0;
      for(var k=0;k<length;k++){
        r+=data[k]*c;im-=data[k]*si;
        var nextC=c*stepR-si*stepI;
        si=si*stepR+c*stepI;c=nextC;
      }
      var amplitude=2*Math.hypot(r,im)/windowSum;
      amplitudes.push(amplitude);
      harmonics.push({harmonic:h,hz:h*frequency,db:20*Math.log10(Math.max(1e-12,amplitude))});
      if(h>1)sum+=amplitude*amplitude;
    }
    var fundamental=amplitudes[0]||0;
    return {amplitudes:amplitudes,harmonics:harmonics,fundamentalDb:harmonics[0]?harmonics[0].db:null,
      thdPercent:fundamental>1e-7?100*Math.sqrt(sum)/fundamental:null,
      windowSamples:length,windowSeconds:length/rate,rms:Math.sqrt(signalSquares/length)};
  }
  function scoreReference(analysis,reference) {
    var amplitudes=analysis.amplitudes,base=amplitudes[0],count=amplitudes.length;
    if(base<=Math.max(1e-7,analysis.rms*.05)||count<3)return null;
    var weightedError=0,weightTotal=0,dot=0,ma=0,mb=0,rows=[];
    for(var h=1;h<=count;h++){
      var measured=amplitudes[h-1]/base,ideal=idealHarmonic(reference,h);
      var measuredDb=Math.max(REFERENCE_FLOOR_DB,20*Math.log10(Math.max(1e-12,measured)));
      var idealDb=Math.max(REFERENCE_FLOOR_DB,20*Math.log10(Math.max(1e-12,ideal)));
      var weight=1/Math.sqrt(h),difference=measuredDb-idealDb;
      if(h>1){weightedError+=weight*difference*difference;weightTotal+=weight;}
      dot+=weight*measured*ideal;ma+=weight*measured*measured;mb+=weight*ideal*ideal;
      rows.push({harmonic:h,hz:analysis.harmonics[h-1].hz,measuredDb:measuredDb,idealDb:idealDb,
        deltaDb:difference});
    }
    var rmsDb=Math.sqrt(weightedError/weightTotal);
    return {reference:reference,harmonicCount:count,shapeErrorDb:rmsDb,
      shapeScore:100*Math.exp(-.5*Math.pow(rmsDb/SCORE_SCALE_DB,2)),
      cosineSimilarity:ma>0&&mb>0?100*dot/Math.sqrt(ma*mb):null,
      harmonics:rows};
  }
  function buildComparison(samples,rate,expectedHz,policy) {
    if(!policy.eligible)return {eligible:false,status:'not-applicable',reason:policy.reason,
      reference:null,shapeScore:null,shapeErrorDb:null,cosineSimilarity:null,
      matches:[],harmonics:[],analysisWindowSamples:0,frequencyBasisHz:expectedHz||null};
    if(!Number.isFinite(expectedHz)||expectedHz<=0||expectedHz>=rate/2)return {
      eligible:false,status:'not-applicable',reason:'No valid fundamental below the sampling Nyquist limit.',
      reference:null,shapeScore:null,shapeErrorDb:null,cosineSimilarity:null,matches:[],harmonics:[],
      analysisWindowSamples:0,frequencyBasisHz:expectedHz||null};
    var analysis=harmonicAnalysis(samples,rate,expectedHz);
    var matches=IDEAL_REFERENCES.map(function(ref){return scoreReference(analysis,ref);}).filter(Boolean);
    if(matches.length!==3)return {eligible:false,status:'unmeasurable',
      reason:'Expected fundamental is too weak relative to the signal for a reliable shape comparison.',reference:null,
      shapeScore:null,shapeErrorDb:null,cosineSimilarity:null,matches:[],harmonics:[],
      analysisWindowSamples:analysis.windowSamples,frequencyBasisHz:expectedHz};
    matches.sort(function(a,b){return b.shapeScore-a.shapeScore;});
    var chosen=matches.find(function(m){return m.reference===policy.reference;});
    return {eligible:true,status:'ok',reason:null,reference:policy.reference,
      automaticReference:policy.automaticReference,bestReference:matches[0].reference,
      shapeScore:chosen.shapeScore,shapeErrorDb:chosen.shapeErrorDb,
      cosineSimilarity:chosen.cosineSimilarity,
      harmonics:chosen.harmonics,matches:matches.map(function(m){return {
        reference:m.reference,shapeScore:m.shapeScore,shapeErrorDb:m.shapeErrorDb,
        cosineSimilarity:m.cosineSimilarity};}),
      harmonicCount:chosen.harmonicCount,analysisWindowSamples:analysis.windowSamples,
      analysisWindowSeconds:analysis.windowSeconds,frequencyBasisHz:expectedHz,
      scoreDefinition:'100*exp(-0.5*(weighted-log-RMS-dB/12)^2)',
      scoreFloorDb:REFERENCE_FLOOR_DB};
  }
  function pcmMetrics(samples,pitchHz,options) {
    options=options||{};
    var n=samples.length,sum=0,squares=0,peak=0,clipped=0;
    for(var i=0;i<n;i++){
      var x=samples[i];sum+=x;squares+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>1)clipped++;
    }
    // Old callers without fixture metadata retain a single-oscillator analysis.
    var policy=options.fixture?comparisonPolicy(options.fixture,options.reference||'auto'):
      {eligible:!!pitchHz,reference:options.reference&&options.reference!=='auto'?options.reference:'square',automaticReference:'square'};
    var spectral=spectrum(samples,RATE,pitchHz,policy);
    return {sampleCount:n,rms:Math.sqrt(squares/n),peak:peak,dc:sum/n,clippedSamples:clipped,
      dominantHz:spectral.dominantHz,fundamentalHz:spectral.fundamentalHz, fundamentalDb:spectral.fundamentalDb,
      harmonicDb:spectral.harmonicDb,thdPercent:spectral.thdPercent,aliasRisk:spectral.aliasRisk,
      centroidHz:spectral.centroidHz,comparison:spectral.comparison,fingerprint:spectral.fingerprint,
      spectral:spectral.bins};
  }
  function spectrum(samples,rate,expectedHz,policy) {
    // Radix-2 FFT on Hann-windowed central 2,048-sample slice for broadband view.
    var N=2048, start=Math.floor((samples.length-N)/2);
    if(start<0)throw new Error('Too few samples for FFT');
    var re=new Float64Array(N),im=new Float64Array(N);
    for(var i=0;i<N;i++)re[i]=samples[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));
    for(var i=1,j=0;i<N;i++){
      var bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
      if(i<j){var tmp=re[i];re[i]=re[j];re[j]=tmp;}
    }
    for(var len=2;len<=N;len<<=1){
      var angle=-2*Math.PI/len,stepCos=Math.cos(angle),stepSin=Math.sin(angle);
      for(var startBin=0;startBin<N;startBin+=len){
        var cos=1,sin=0;
        for(var u=0;u<len/2;u++){
          var a=startBin+u,b=a+len/2;
          var tr=cos*re[b]-sin*im[b],ti=cos*im[b]+sin*re[b];
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          var nc=cos*stepCos-sin*stepSin;
          sin=sin*stepCos+cos*stepSin;cos=nc;
        }
      }
    }
    var bins=[],magTotal=0,moment=0,best=0,bestIndex=1,dft=[],powerSum=0,logPowerSum=0,powerByBin=[],highPower=0;
    for(var k=1;k<=N/2;k++){
      var v=Math.hypot(re[k],im[k]);dft.push(v);
      if(v>best){best=v;bestIndex=k;}
      magTotal+=v;moment+=v*k*rate/N;
      var power=v*v;powerSum+=power;powerByBin.push(power);
      logPowerSum+=Math.log(Math.max(power,1e-24));
      if(k*rate/N>=2000) highPower+=power;
      if(k%4===0)bins.push({hz:k*rate/N,db:20*Math.log10(Math.max(1e-9,v/N))});
    }
    // Broadband descriptors are meaningful for noise and composite signals too.
    var rollPower=0,rolloffHz=0;
    for(var rp=0;rp<powerByBin.length;rp++){
      rollPower+=powerByBin[rp];
      if(rollPower>=powerSum*.85){rolloffHz=(rp+1)*rate/N;break;}
    }
    var peaks=[];
    for(var pk=1;pk<dft.length-1;pk++){
      if(dft[pk]>dft[pk-1]&&dft[pk]>=dft[pk+1]&&dft[pk]>best*.02)
        peaks.push({hz:(pk+1)*rate/N,relativeDb:20*Math.log10(dft[pk]/Math.max(best,1e-12))});
    }
    peaks.sort(function(a,b){return b.relativeDb-a.relativeDb;});peaks=peaks.slice(0,8);
    var fingerprint={spectralFlatness:powerSum>1e-16?Math.exp(logPowerSum/powerByBin.length)/(powerSum/powerByBin.length):null,
      rolloff85Hz:rolloffHz,highBandEnergyPercent:powerSum?100*highPower/powerSum:0,
      strongestPeaks:peaks,peakBinWidthHz:rate/N};
    var offset=0,j=bestIndex-1;
    if(j>0&&j<dft.length-1){
      var aa=Math.log(Math.max(dft[j-1],1e-12)),bb=Math.log(Math.max(dft[j],1e-12)),cc=Math.log(Math.max(dft[j+1],1e-12));
      if(aa-2*bb+cc!==0)offset=clamp(.5*(aa-cc)/(aa-2*bb+cc),-.5,.5);
    }
    if(!policy)policy={eligible:!!expectedHz,reference:'square',automaticReference:'square'};
    var comparison=buildComparison(samples,rate,expectedHz,policy);
    var single=policy.eligible&&comparison.status==='ok';
    var harmonics=[],fundamentalDb=null,thd=null,fundamentalHz=null;
    if(single){
      var measured=harmonicAnalysis(samples,rate,expectedHz);
      harmonics=measured.harmonics;fundamentalDb=measured.fundamentalDb;
      thd=measured.thdPercent;fundamentalHz=expectedHz;
    }
    // Heuristic only: infinitely sharp ideal waveforms can exceed Nyquist at any pitch.
    var risk=single?(expectedHz*MAX_HARMONICS>=rate/2?'High: 32nd harmonic exceeds Nyquist':
      expectedHz*8>=rate/2?'Moderate: 8th harmonic exceeds Nyquist':'Low at first 8 harmonics'):
      'N/A: broadband, multi-oscillator or modulation spectrum';
    return {dominantHz:best>1e-9?(bestIndex+offset)*rate/N:0,
      fundamentalHz:fundamentalHz,fundamentalDb:fundamentalDb,harmonicDb:harmonics,
      thdPercent:thd,aliasRisk:risk,comparison:comparison,fingerprint:fingerprint,
      centroidHz:magTotal?moment/magTotal:0,bins:bins};
  }
  var calibratedCurves=Object.create(null);
  async function calibrateVolumeCurve(coreAPI,options) {
    options=options||{};
    var backend=options.backend||'js',clock=options.clock||1021800,key=backend+':'+clock;
    if(!options.force&&calibratedCurves[key])return calibratedCurves[key].slice();
    var levels=[0];
    for(var v=1;v<=15;v++){
      // A tone, not a DC measurement, because the AYCore output can be AC coupled.
      var trial=await render(coreAPI,{fixture:'square',hz:220,clock:clock,volume:v,duration:.2,backend:backend});
      levels.push(trial.metrics.rms);
    }
    var max=levels[15];if(!(max>1e-6))throw new Error('AY volume calibration failed: silent output');
    for(var n=1;n<16;n++)levels[n]=Math.min(1,levels[n]/max);
    // Enforce monotonicity against small measurement noise.
    for(var m=1;m<16;m++)levels[m]=Math.max(levels[m],levels[m-1]);
    levels[15]=1;calibratedCurves[key]=levels.slice();return levels;
  }
  async function render(coreAPI,options) {
    options=options||{};
    var backend=options.backend||'js';
    if(options.fixture==='triangle-dac'&&!options.volumeCurve){
      options=Object.assign({},options,{volumeCurve:await calibrateVolumeCurve(coreAPI,options)});
    }
    var spec=generate(options);
    if(!coreAPI||typeof coreAPI.create!=='function')throw new Error('AYCore missing');
    var engine=await coreAPI.create({backend:backend,chipCount:2,sampleRate:RATE,
      renderProfile:'economy',timebaseHz:TIMEBASE,maxFrames:BLOCK,maxEvents:4096});
    var floats=new Float32Array(Math.round(spec.duration*RATE));
    var temp={left:new Float32Array(BLOCK),right:new Float32Array(BLOCK)};
    var packed=new Uint8Array(4096*16),view=new DataView(packed.buffer);
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
          if(count>=4096)throw new Error('AY event batch capacity exceeded');
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
    var interaction={mode:spec.fixture,phaseOffsetCycles:spec.phaseOffset,
      registerWrites:spec.events.length,softwareVolumeWritesPerSecond:spec.softwareVolumeWritesPerSecond,
      feasibility:spec.softwareVolumeWritesPerSecond>3000?'Experimental only: extreme Mockingboard register-write load':
        spec.softwareVolumeWritesPerSecond>500?'High Apple II CPU/VIA write load (unverified)':'No high-rate software volume writes'};
    if(spec.fixture==='buzzer'){
      interaction.toneHz=spec.pitch.actualHz;interaction.envelopeHz=spec.pitch.envelope.actualHz;
      interaction.relativeFrequencyHz=spec.pitch.envelope.actualHz-spec.pitch.actualHz;
      interaction.relativePhaseDriftCycles=interaction.relativeFrequencyHz*spec.duration;
    } else if(spec.fixture==='detune'){
      interaction.toneHz=spec.pitch.actualHz;interaction.secondaryHz=spec.pitch.secondary.actualHz;
      interaction.beatHz=Math.abs(interaction.secondaryHz-interaction.toneHz);
    }
    return {spec:spec,backend:actualBackend,renderMs:endTime-start,rate:RATE,pcm:floats,
      interaction:interaction,metrics:pcmMetrics(floats,pitch,{fixture:spec.fixture,reference:spec.referencePreference})};
  }
  function phaseSweepJobs(base) {
    base=base||{};
    var jobs=[];
    [55,110,220,440].forEach(function(hz){
      for(var i=0;i<8;i++)jobs.push(Object.assign({},base,{fixture:'buzzer',hz:hz,phaseOffset:i/8,duration:1,reference:'auto'}));
    });
    return jobs;
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
      interaction:result.interaction||null,
      metrics:{sampleCount:m.sampleCount,rms:m.rms,peak:m.peak,dc:m.dc,clippedSamples:m.clippedSamples,
        dominantHz:m.dominantHz,fundamentalHz:m.fundamentalHz,fundamentalDb:m.fundamentalDb,
        harmonicDb:m.harmonicDb,thdPercent:m.thdPercent,aliasRisk:m.aliasRisk,centroidHz:m.centroidHz,
        comparison:m.comparison,fingerprint:m.fingerprint}};
  }
  return {SCHEMA:SCHEMA,RATE:RATE,FIXTURES:FIXTURES,nearestPeriod:nearestPeriod,
    describe:describe,generate:generate,spectrum:spectrum,pcmMetrics:pcmMetrics,render:render,
    idealHarmonic:idealHarmonic,idealWaveform:idealWaveform,referenceFor:referenceFor,
    scoreReference:scoreReference,harmonicAnalysis:harmonicAnalysis,calibrateVolumeCurve:calibrateVolumeCurve,
    phaseSweepJobs:phaseSweepJobs,
    wav:wav,report:report};
});
