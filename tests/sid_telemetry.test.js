'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function rig(){
    let now=1000,tick=0,download=null;
    const dom={};
    function node(id){
        return {id,hidden:true,style:{},parentNode:null,innerHTML:'',
            appendChild(child){child.parentNode=this;dom[child.id]=child;}};
    }
    const body=node('body');
    const document={body,createElement(){return node('')},
        getElementById(id){return dom[id]||null}};
    class FakeAudioContext{
        constructor(){this.currentTime=1;this.state='running';this.sampleRate=48000;
            this.destination={};}
        createGain(){return {gain:{value:1},connect(){}};}
        createBuffer(channels,length,rate){
            return {duration:length/rate,
                getChannelData(){return new Float32Array(length)}};
        }
        createBufferSource(){
            return {buffer:null,connect(){},disconnect(){},stop(){},
                start(){}};
        }
        resume(){this.state='running';return Promise.resolve();}
        suspend(){this.state='suspended';return Promise.resolve();}
        close(){this.state='closed';return Promise.resolve();}
    }
    const oCOM={
        RefreshEvent_arr:{},
        addRefreshEvent(fn,key,active){this.RefreshEvent_arr[key]={fn,active};},
        toggleRefreshEvent(key){const e=this.RefreshEvent_arr[key];
            return (e.active=!e.active);},
        Download(filename,bytes){download={filename,bytes};},
        POPUP:{
            toggle(id){const elem=document.getElementById(id);elem.hidden=!elem.hidden;},
            title_body_html(title,content){return title+content;}
        }
    };
    const sandbox=vm.createContext({
        console,Math,Date,Number,Float32Array,Uint8Array,TextEncoder,
        performance:{now(){return now}},AudioContext:FakeAudioContext,
        document,oCOM,oEMU:{component:{IO:{}}},
        _o:{CPU_ClocksTicks_s:1021800},
        oApple2Video:{frameTiming:'vblank'}
    });
    for(const name of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',name),'utf8'),
            sandbox,{filename:name});
    const card=new sandbox.SIDCard(),device=new sandbox.SIDAudio();
    card.mount={hash:54,slotN:5}; // physical slot 4, internal +1
    card.devices=[device];
    device.bindHost(card);
    const io={getClockTicks(){return tick},refreshDeviceHooks(){}};
    device.bindIO(io);card.reset();
    return {card,device,oCOM,dom,now(ms){now=ms},tick(value){tick=value},
        download(){return download},audio(){return device.audio}};
}
function writeBurst(r,start,count=12){
    for(let i=0;i<count;i++){
        const tick=start+i*16;
        r.tick(tick);
        assert.equal(r.card.observeBusWrite(0xD404,i&1,{cpuTick:tick}),true);
    }
}
test('SID native writes are grouped by emulated CPU-clock bursts, without implying PLAY calls',()=>{
    const r=rig();
    for(let n=0;n<7;n++)writeBurst(r,n*20436);
    const t=r.card.getAudioTelemetry();
    assert.equal(t.sid.nativeWrites,84);
    assert.equal(t.bursts.count,7);
    assert.equal(t.bursts.measuredPeriods,6);
    assert.equal(t.bursts.estimatedHz,50);
    assert.equal(t.bursts.lastTicks,20436);
    assert.equal(t.bursts.minTicks,20436);
    assert.equal(t.bursts.maxTicks,20436);
    assert.equal(t.bursts.shortPeriods,0);
    assert.equal(t.bursts.longPeriods,0);
    assert.equal(t.bursts.maxWrites,12);
    assert.deepEqual(Array.from(r.device.getRegisters()).length,32);
    assert.equal(t.sid.voices.length,3);

    // A skipped write burst may reflect a missed PLAY or simply a silent frame.
    writeBurst(r,8*20436);
    const gap=r.card.getAudioTelemetry().bursts;
    assert.equal(gap.longPeriods,1,'long register-write gap must be visible');
    assert.ok(gap.maxTicks>28000);
    assert.equal(r.card.getStatistics().snoopWrites,96);
});
test('SID telemetry snapshots are passive and reset never changes SID state or PCM queue',async()=>{
    const r=rig(),d=r.device;
    await d.init('audio_on');
    d.writeRegister(0x05,0x00);
    d.writeRegister(0x06,0xF9);
    d.writeRegister(0x04,0x11);
    r.tick(40000);
    d.advanceTo(40000);
    const before=d.getAudioStats(),regs=Array.from(d.getRegisters());
    const env=Array.from(d.getEnvelopeLevels());
    const a=r.card.getAudioTelemetry(),b=r.card.getAudioTelemetry();
    assert.equal(a.audio.produced,b.audio.produced);
    assert.deepEqual(Array.from(d.getRegisters()),regs);
    assert.deepEqual(Array.from(d.getEnvelopeLevels()),env);
    assert.equal(d.getAudioStats().queued,before.queued);

    // Reset is exclusively statistical; sound keeps its original queue and phase.
    r.card.resetAudioTelemetry();
    assert.equal(d.getAudioStats().queued,before.queued);
    assert.equal(d.getAudioStats().produced,0);
    assert.deepEqual(Array.from(d.getRegisters()),regs);
    assert.deepEqual(Array.from(d.getEnvelopeLevels()),env);

    // Deliberately move audio clock past the previously scheduled horizon.
    d.cycle();
    const audio=r.audio();
    audio.currentTime=1.45;
    r.tick(70000);
    d.cycle();
    const stats=r.card.getAudioTelemetry().audio;
    assert.ok(stats.underruns>0,'late Web Audio delivery should count an underrun');
    assert.ok(stats.lastLateMs>0,'report size of last missed deadline');
    assert.ok(stats.worstLateMs>=stats.lastLateMs);
    assert.equal(stats.contextState,'running');
    assert.equal(stats.outputSampleRate,48000);
    assert.ok(stats.activeSources>=1);
    assert.ok(stats.scheduledLeadMs>0);
    assert.ok(stats.minPreScheduleLeadMs<0,
        'pre-service lead must show the missed deadline before recovery');
    assert.equal(r.card.downloadAudioTelemetry(),true);
    const exported=JSON.parse(Buffer.from(r.download().bytes).toString('utf8'));
    assert.ok(exported.audioEvents.some(e=>e.type==='underrun'));
    assert.ok(exported.audioEvents.every(e=>typeof e.cpuTick==='number'));
    await d.init('audio_off');
});
test('SID wall-time pace, compact popup, manual live refresh and JSON export',()=>{
    const r=rig();
    writeBurst(r,100);
    r.now(1000);
    r.card.getAudioTelemetry();
    writeBurst(r,1021800+100);
    r.now(2000);
    const t=r.card.getAudioTelemetry();
    assert.ok(Math.abs(t.rates.cpuPacePercent-100)<0.05);
    assert.ok(t.rates.nativeWritesPerSecond>0);
    assert.equal(t.cpu.timingMode,'vblank');

    assert.equal(r.card.openAudioTelemetry(),true);
    const popup=r.dom['sid_audio_54_popup'];
    assert.ok(popup&&!popup.hidden,'telemetry popup should open');
    assert.match(popup.innerHTML,/SID LIVE AUDIO TELEMETRY/);
    assert.match(popup.innerHTML,/BURST INTERVAL/);
    assert.match(popup.innerHTML,/BROWSER LEAD/);
    assert.match(popup.innerHTML,/JSON/);
    const event=r.oCOM.RefreshEvent_arr['sid_audio_54_refresh'];
    assert.ok(event&&!event.active,'live refresh is disabled by default');
    assert.match(popup.innerHTML,/width:47%;padding:2px/);
    assert.match(popup.innerHTML,/text-align:left;overflow-wrap:anywhere/);
    assert.equal(popup.style.cssText.includes('width:560px'),true);
    assert.equal(popup.style.cssText.includes('height:410px'),true);
    assert.match(popup.innerHTML,/sid_audio_54_sync_label/);
    assert.equal(r.card.toggleAudioTelemetrySync(),true);
    assert.equal(event.active,true,'Start explicitly enables live refresh');
    for(let i=0;i<130;i++){r.now(2500+500*i);r.card.audioTelemetryRefresh();}
    assert.equal(r.card.getAudioTelemetryHistory().length,120,
        'only the latest 60 seconds of half-second snapshots are retained');
    assert.equal(r.card.downloadAudioTelemetry(),true);
    const exported=r.download();
    assert.match(exported.filename,/SID_slot4_audio_telemetry\.json$/);
    const data=JSON.parse(Buffer.from(exported.bytes).toString('utf8'));
    assert.equal(data.format,'RetroAppleJS.SIDAudioTelemetry');
    assert.equal(data.version,1);
    assert.equal(data.history.length,120);
    assert.equal(data.latest.sid.model,6581);
    assert.equal(data.latest.bursts.count,2);
    assert.equal(data.latest.audio.sampleRate,22050);

    assert.equal(r.card.openAudioTelemetry(),false,'second click closes popup');
    assert.equal(popup.hidden,true);
    assert.equal(event.active,false,'close must stop the refresh event');
    assert.equal(r.card.openAudioTelemetry(),true,'can be reopened');
    assert.equal(event.active,false,'reopening must start paused');
    assert.equal(r.card.toggleAudioTelemetrySync(),true);
    popup.hidden=true;
    assert.equal(r.card.audioTelemetryRefresh(),false,
        'closing with popup X must also stop the refresh callback');
    assert.equal(event.active,false);
});

test('SID toolbox uses three compact logical rows',()=>{
    const r=rig();
    const html=r.card.deviceToolSlotHTML({toolboxID:'device_tool_4',slotID:4});
    assert.equal((html.match(/class='sid-toolbox-row'/g)||[]).length,3);
    assert.match(html,/width:340px;height:80px/);
    assert.match(html,/Native \$D400 writes/);
    assert.match(html,/Telemetry/);
});
