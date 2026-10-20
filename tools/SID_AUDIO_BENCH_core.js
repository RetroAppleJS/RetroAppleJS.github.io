/*
 * RetroAppleJS SID Phase 4A: deterministic 22,050 Hz reference and performance
 * bench. NO production synthesizer changes; the original SIDAudio is supplied
 * as an injected constructor. This module works in browsers and Node.js.
 */
(function(root, factory) {
    var api=factory();
    if(typeof module==="object"&&module.exports)module.exports=api;
    else root.SIDAudioBench=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
    "use strict";
    var RATE=22050, FRAME_SECONDS=2, COUNT=RATE*FRAME_SECONDS;
    var CLOCKS={PAL:985248,NTSC:1022727};
    var FIXTURES=[
        {id:"triangle",label:"Triangle — 220 Hz",description:"One gated triangle voice at constant pitch"},
        {id:"saw",label:"Sawtooth — 220 Hz",description:"One gated sawtooth voice and its harmonics"},
        {id:"pulse",label:"Pulse — 220 Hz",description:"One gated 50% pulse waveform"},
        {id:"noise",label:"Noise",description:"Gated noise oscillator and its spectral distribution"},
        {id:"pwm",label:"Pulse-width modulation",description:"Original SID pulse-width register changes"},
        {id:"adsr",label:"ADSR and release",description:"GATE release at one second, fixed A/D/S/R"},
        {id:"ring",label:"Ring modulation",description:"Triangle voice with modulator oscillator"},
        {id:"sync",label:"Hard synchronization",description:"Sawtooth with preceding oscillator sync"},
        {id:"filter",label:"Filter cutoff sweep",description:"Low-pass filter sweep with resonance"},
        {id:"volume",label:"Master volume steps",description:"Discrete $D418 volume changes"}
    ];
    function finite(v){return typeof v==="number"&&Number.isFinite(v);}
    function fail(message){throw new Error(message);}
    function samples(seconds){return Math.round(seconds*RATE);}
    function frequency(hz,clock){
        return Math.max(1,Math.min(65535,Math.round(hz*16777216/clock)));
    }
    function createEvents(name,clock){
        if(!CLOCKS || !finite(clock) || clock<900000 || clock>1100000)
            fail("Invalid SID clock");
        if(!FIXTURES.some(function(f){return f.id===name;}))fail("Unknown fixture: "+name);
        var events=[],order=0;
        function write(at,reg,value){
            at=Math.round(at);
            if(!Number.isInteger(at)||at<0||at>=COUNT||reg<0||reg>31)
                fail("Invalid fixture register event");
            events.push({sample:at,reg:reg,value:value&255,order:order++,
                cpuTick:Math.round(at*clock/RATE)});
        }
        function word(at,reg,val){
            write(at,reg,val&255);write(at,reg+1,(val>>8)&255);
        }
        function voice(base,hz,ctrl,ad,sr){
            word(0,base,frequency(hz,clock));
            write(0,base+5,ad);write(0,base+6,sr);
            write(0,base+4,ctrl);
        }
        write(0,0x18,0x0f);
        var standard=0x11;
        if(name==="triangle")voice(0,220,standard,0x02,0xf0);
        if(name==="saw")voice(0,220,0x21,0x02,0xf0);
        if(name==="pulse"){
            write(0,2,0x00);write(0,3,0x08);
            voice(0,220,0x41,0x02,0xf0);
        }
        if(name==="noise")voice(0,440,0x81,0x02,0xf0);
        if(name==="pwm"){
            voice(0,220,0x41,0x02,0xf0);
            [0x200,0x500,0x800,0xb00,0x500,0x200,0x800,0xe00].forEach(function(p,i){
                var at=samples(i*0.25);
                write(at,2,p&255);write(at,3,(p>>8)&15);
            });
        }
        if(name==="adsr"){
            voice(0,330,0x21,0x78,0x86);
            write(samples(1),4,0x20);
        }
        if(name==="ring"||name==="sync"){
            // Voice 3 is the oscillator that modulates/synchronizes voice 1.
            // The modulating voice is muted only via voice routing and 3OFF,
            // leaving oscillator state active (as on the original SID).
            voice(14,165,0x21,0x02,0xf0);
            if(name==="ring")voice(0,220,0x15,0x02,0xf0);
            else voice(0,220,0x23,0x02,0xf0);
            write(0,0x18,0x8f);
        }
        if(name==="filter"){
            voice(0,220,0x21,0x02,0xf0);
            write(0,0x17,0x81); // route voice 1 through filter, resonance 8
            write(0,0x18,0x1f); // low-pass + full volume
            for(var i=0;i<8;i++){
                var cutoff=Math.round((i+1)*2047/8);
                write(samples(i*0.25),0x15,cutoff&7);
                write(samples(i*0.25),0x16,(cutoff>>3)&255);
            }
        }
        if(name==="volume"){
            voice(0,220,0x21,0x02,0xf0);
            for(var j=0;j<8;j++)write(samples(j*0.25),0x18,(j%4)*5);
        }
        events.sort(function(a,b){return a.sample-b.sample||a.order-b.order;});
        return events.map(function(e){return {sample:e.sample,reg:e.reg,value:e.value,cpuTick:e.cpuTick};});
    }
    function render(SIDAudio,settings){
        settings=settings||{};
        if(typeof SIDAudio!=="function")fail("SIDAudio constructor missing");
        var model=Number(settings.model||6581),clock=CLOCKS[settings.clock||"PAL"];
        if(model!==6581&&model!==8580)fail("Unknown SID model");
        if(!clock)fail("Unknown SID clock");
        var id=settings.fixture||"saw",events=createEvents(id,clock);
        var device=new SIDAudio();
        device.setModel(model);device.setClock(clock);
        var out=new Float32Array(COUNT),cursor=0,eventIndex=0;
        function appendUntil(target){
            while(cursor<target){
                var n=Math.min(target-cursor,8192);
                var block=device.renderOffline(n);
                if(!block||block.length!==n)fail("SID offline renderer returned wrong sample count");
                out.set(block,cursor);cursor+=n;
            }
        }
        for(;eventIndex<events.length;eventIndex++){
            var e=events[eventIndex];
            appendUntil(e.sample);
            // No timestamp here: renderer advances explicitly in sample order.
            // Passing tick to writeRegister would ALSO generate skipped samples
            // through advanceTo() and double-advance the oscillator.
            device.writeRegister(e.reg,e.value);
        }
        appendUntil(COUNT);
        return {pcm:out,events:events,model:model,clock:settings.clock||"PAL",
            fixture:id,sampleRate:RATE,sidClock:clock,quantization:"nearest output sample",
            stats:device.getAudioStats()};
    }
    function checksum(pcm){
        // FNV-1a over little-endian PCM float32 representations.
        var dv=new DataView(new ArrayBuffer(4)),h=2166136261;
        for(var i=0;i<pcm.length;i++){
            dv.setFloat32(0,pcm[i],true);
            for(var b=0;b<4;b++)h=Math.imul(h^dv.getUint8(b),16777619)>>>0;
        }
        return ("00000000"+h.toString(16)).slice(-8);
    }
    function fftFeatures(pcm){
        var N=2048;
        if(pcm.length<N)fail("Too few samples for spectrum");
        var re=new Float64Array(N),im=new Float64Array(N);
        var start=Math.max(0,Math.floor((pcm.length-N)/2));
        for(var i=0;i<N;i++){
            var w=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
            re[i]=pcm[start+i]*w;
        }
        // Deterministic in-place radix-2 FFT.
        var j=0;
        for(i=1,j=0;i<N;i++){
            for(var bit=N>>1;(j&bit)!==0;bit>>=1)j^=bit;
            j^=bit;
            if(i<j){
                var tmp=re[i];re[i]=re[j];re[j]=tmp;
            }
        }
        for(var len=2;len<=N;len*=2){
            var ang=-2*Math.PI/len,c=Math.cos(ang),s=Math.sin(ang);
            for(i=0;i<N;i+=len){
                var wr=1,wi=0;
                for(j=0;j<len/2;j++){
                    var k=i+j,kk=k+len/2;
                    var vr=re[kk]*wr-im[kk]*wi,vi=re[kk]*wi+im[kk]*wr;
                    re[kk]=re[k]-vr;im[kk]=im[k]-vi;
                    re[k]+=vr;im[k]+=vi;
                    var nextR=wr*c-wi*s;wi=wr*s+wi*c;wr=nextR;
                }
            }
        }
        var power=0,weighted=0,high=0,dominant=0,dominantIndex=0;
        var bins=[];
        for(i=1;i<N/2;i++){
            var p=re[i]*re[i]+im[i]*im[i],hz=i*RATE/N;
            power+=p;weighted+=hz*p;
            if(hz>=5000)high+=p;
            if(hz>=40 && p>dominant){dominant=p;dominantIndex=i;}
            bins.push([Math.round(hz),Math.sqrt(p)]);
        }
        return {fftSize:N,frequencyResolutionHz:RATE/N,
            dominantHz:Math.round(dominantIndex*RATE/N*100)/100,
            spectralCentroidHz:power?Math.round(weighted/power):0,
            energyAbove5kHzRatio:power?+(high/power).toFixed(6):0,
            spectrum:bins};
    }
    function analyze(pcm){
        if(!(pcm instanceof Float32Array)&&!ArrayBuffer.isView(pcm))
            fail("PCM must be a typed array");
        if(pcm.length<2048)fail("Need at least 2048 PCM samples");
        var sum=0,sq=0,peak=0,clipped=0;
        for(var i=0;i<pcm.length;i++){
            var v=pcm[i];if(!finite(v))fail("Nonfinite audio sample");
            sum+=v;sq+=v*v;peak=Math.max(peak,Math.abs(v));
            if(Math.abs(v)>=0.99999)clipped++;
        }
        var fft=fftFeatures(pcm);
        return {samples:pcm.length,sampleRate:RATE,seconds:pcm.length/RATE,
            dc:+(sum/pcm.length).toFixed(8),rms:+Math.sqrt(sq/pcm.length).toFixed(8),
            peak:+peak.toFixed(8),clippedSamples:clipped,fnvFloat32:checksum(pcm),
            dominantHz:fft.dominantHz,spectralCentroidHz:fft.spectralCentroidHz,
            energyAbove5kHzRatio:fft.energyAbove5kHzRatio,
            spectrum:fft.spectrum};
    }
    function bench(SIDAudio,settings,now){
        settings=settings||{};
        var reps=Number(settings.repetitions||5);
        if(!Number.isInteger(reps)||reps<1||reps>20)fail("Repetitions must be 1–20");
        now=now||function(){return performance.now();};
        if(typeof now!=="function")fail("Timer missing");
        render(SIDAudio,settings); // warm-up JIT; do not time
        var elapsed=[],first=null;
        for(var i=0;i<reps;i++){
            var start=now(),result=render(SIDAudio,settings);
            var ms=now()-start;
            if(!finite(ms)||ms<0)fail("Invalid performance clock");
            elapsed.push(ms);
            if(i===0)first=result;
            else if(checksum(result.pcm)!==checksum(first.pcm))
                fail("Nondeterministic PCM between repeated runs");
        }
        elapsed.sort(function(a,b){return a-b;});
        var median=elapsed[Math.floor(elapsed.length/2)];
        var m=analyze(first.pcm);
        return {fixture:first.fixture,model:first.model,sidClock:first.sidClock,
            clock:first.clock,sampleRate:RATE,events:first.events.length,
            eventSequence:first.events,analysis:m,
            performance:{repetitions:reps,elapsedMs:elapsed.map(function(t){return +t.toFixed(4);}),
                medianMs:+median.toFixed(4),
                generatedAudioSeconds:FRAME_SECONDS,
                renderToAudioRatio:median>0?+(FRAME_SECONDS*1000/median).toFixed(4):null,
                synthesisSamplesPerSecond:median>0?Math.round(COUNT*1000/median):null},
            rendererStats:{produced:first.stats.produced,offlineSamples:first.stats.offlineSamples,
                dropped:first.stats.dropped,underruns:first.stats.underruns,
                clockRewinds:first.stats.clockRewinds},
            pcm:first.pcm};
    }
    function wav(pcm){
        var length=pcm.length,buffer=new ArrayBuffer(44+length*2);
        var v=new DataView(buffer),p=0;
        function ascii(s){for(var i=0;i<s.length;i++)v.setUint8(p++,s.charCodeAt(i));}
        function u16(x){v.setUint16(p,x,true);p+=2;}
        function u32(x){v.setUint32(p,x,true);p+=4;}
        ascii("RIFF");u32(36+length*2);ascii("WAVEfmt ");u32(16);
        u16(1);u16(1);u32(RATE);u32(RATE*2);u16(2);u16(16);
        ascii("data");u32(length*2);
        for(var i=0;i<length;i++){
            var s=Math.max(-1,Math.min(1,pcm[i]));
            v.setInt16(p,s<0?Math.round(s*32768):Math.round(s*32767),true);p+=2;
        }
        return buffer;
    }
    function readWav(buffer){
        var dv=new DataView(buffer),length=dv.byteLength;
        function four(p){return String.fromCharCode(dv.getUint8(p),dv.getUint8(p+1),
                                        dv.getUint8(p+2),dv.getUint8(p+3));}
        if(length<44||four(0)!=="RIFF"||four(8)!=="WAVE")
            fail("Reference must be a WAV RIFF file");
        var fmt=null,data=null;
        for(var p=12;p+8<=length;){
            var name=four(p),size=dv.getUint32(p+4,true),start=p+8;
            if(start+size>length)fail("Malformed WAV chunk");
            if(name==="fmt "){
                if(size<16)fail("Invalid WAV fmt");
                fmt={type:dv.getUint16(start,true),channels:dv.getUint16(start+2,true),
                    rate:dv.getUint32(start+4,true),blockAlign:dv.getUint16(start+12,true),
                    bits:dv.getUint16(start+14,true)};
            }
            if(name==="data")data={start:start,bytes:size};
            p=start+size+(size&1);
        }
        if(!fmt||!data)fail("WAV fmt/data chunk missing");
        if(fmt.rate!==RATE)fail("Reference WAV must be 22050 Hz (convert offline first)");
        if(fmt.channels<1||fmt.channels>2)fail("Reference WAV must be mono or stereo");
        if(!((fmt.type===1&&fmt.bits===16)||(fmt.type===3&&fmt.bits===32)))
            fail("Reference WAV supports 16-bit PCM or 32-bit float");
        var sampleBytes=fmt.bits/8;
        if(fmt.blockAlign!==fmt.channels*sampleBytes ||
           data.bytes%fmt.blockAlign!==0)fail("Malformed WAV frame layout");
        var count=data.bytes/fmt.blockAlign;
        if(count<2048||count>RATE*60)fail("Reference duration must be 0.1–60 seconds");
        var pcm=new Float32Array(count);
        for(var i=0;i<count;i++){
            var value=0;
            for(var ch=0;ch<fmt.channels;ch++){
                var off=data.start+i*fmt.blockAlign+ch*sampleBytes;
                value+=(fmt.type===1?dv.getInt16(off,true)/32768:
                              dv.getFloat32(off,true))/fmt.channels;
            }
            pcm[i]=value;
        }
        return {pcm:pcm,sampleRate:RATE,channels:fmt.channels,originalFormat:fmt.type===1?"PCM16":"FLOAT32"};
    }
    function report(result){
        // JSON has scalar analysis and event timestamps, not huge PCM/spectra.
        var a=Object.assign({},result.analysis);delete a.spectrum;
        return {fixture:result.fixture,model:result.model,clock:result.clock,
            sidClock:result.sidClock,sampleRate:RATE,events:result.events,
            eventSequence:result.eventSequence,analysis:a,
            performance:result.performance,rendererStats:result.rendererStats};
    }
    return {RATE:RATE,COUNT:COUNT,CLOCKS:CLOCKS,FIXTURES:FIXTURES,
        createEvents:createEvents,render:render,analyze:analyze,bench:bench,
        checksum:checksum,wav:wav,readWav:readWav,report:report};
});
