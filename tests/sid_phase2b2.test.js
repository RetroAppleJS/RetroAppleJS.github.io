'use strict';
// Phase 2B.2 browser-side loader regression. Runs in CI; end users need no Node.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const build=require('../tools/SID_Phase2B1_build.js');
const original=fs.readFileSync(build.REFERENCE);

function contextWithLoader(extra={}){
    const context=vm.createContext({console,Uint8Array,ArrayBuffer,Number,Math,
        ...extra});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_SID_PSID.js'),'utf8'),
        context,{filename:'EMU_SID_PSID.js'});
    return context;
}
function v1MrHeli(){
    assert.equal(original.readUInt16BE(4),2);
    assert.equal(original.readUInt16BE(6),0x7C);
    const v1=Buffer.concat([original.subarray(0,0x76),original.subarray(0x7C)]);
    v1.writeUInt16BE(1,4);
    v1.writeUInt16BE(0x76,6);
    return v1;
}
function mockHardware(){
    const memory=new Uint8Array(0x10000);
    memory.fill(0x25,0xA000,0xB000);
    let loads=0;
    return {memory,
        safe_flashdump(){return memory.subarray(0,0xC000).slice();},
        safe_read(addr){return memory[addr];},
        load_ram64k(image){
            assert.equal(image.length,0x10000);
            memory.set(image.subarray(0,0xC000),0);loads++;
        },
        count(){return loads;}
    };
}
function synthetic(length,load=0x1000){
    const header=0x7C,bytes=Buffer.alloc(header+length,0xEA);
    bytes.write('PSID',0,'ascii');
    bytes.writeUInt16BE(2,4);bytes.writeUInt16BE(header,6);
    bytes.writeUInt16BE(load,8);bytes.writeUInt16BE(load,10);
    bytes.writeUInt16BE(load+6,12);bytes.writeUInt16BE(1,14);
    bytes.writeUInt16BE(1,16);bytes.writeUInt32BE(0,18);
    bytes.writeUInt16BE(4,0x76);bytes[0x7A]=bytes[0x7B]=0;
    // Both entrypoints are code, and are inside declared payload.
    Buffer.from([0xA9,0x0F,0x8D,0x18,0xD4,0x60,
                 0xA9,0x40,0x8D,0x04,0xD4,0x60]).copy(bytes,header);
    return bytes;
}

test('browser PSID parser v1/v2 preserve identical original Mr. Heli executable metadata',()=>{
    const loader=contextWithLoader().SIDPSID;
    const v1=v1MrHeli(),v2=original;
    const a=loader.inspect(v1),b=loader.inspect(v2);
    assert.equal(a.version,1);
    assert.equal(b.version,2);
    assert.equal(a.headerSize,0x76);
    assert.equal(b.headerSize,0x7C);
    for(const k of ['payloadLength','loadAddress','initAddress','playAddress',
                    'selectedSong','songs','rateHz'])
        assert.equal(a[k],b[k],k);
    assert.deepEqual(Array.from(v1.subarray(a.payloadOffset)),
                     Array.from(v2.subarray(b.payloadOffset)));
    assert.equal(a.selectedSong,5);
    assert.equal(a.rateHz,50);
    for(const [file,version] of [[v1,1],[v2,2]])
        for(const stage of [0x2000,0x6000,0x7D00]){
            const p=loader.prepare(file,{stage});
            assert.equal(p.version,version);
            assert.equal(p.stage,stage);
            assert.equal(p.descriptor[14],4);
            assert.equal(p.checksum,0x3B46);
            assert.equal(p.descriptor[4]|(p.descriptor[5]<<8),stage+p.payloadOffset);
        }
});

test('browser embedded player image agrees byte-for-byte with assembled Phase 2B.1',()=>{
    const image=contextWithLoader().SIDPSID.playerImage(),compiled=build.assemblePlayer();
    assert.deepEqual(Buffer.from(image.bootstrap),compiled.bootstrap);
    assert.deepEqual(Buffer.from(image.runtime),compiled.runtime);
    assert.equal(image.bootstrap.length,12);
    assert.equal(image.runtime.length,676);
});

test('browser loader copies original PSID and player atomically into actual RAM positions',()=>{
    const loader=contextWithLoader().SIDPSID,hw=mockHardware();
    const before=hw.memory.slice();
    const image=loader.install(hw,v1MrHeli(),{stage:0x7D00,subtune:3});
    assert.equal(hw.count(),1);
    assert.deepEqual(Array.from(hw.memory.subarray(0x7D00,0x7D00+image.bytes.length)),
                     Array.from(image.bytes));
    assert.deepEqual(Array.from(hw.memory.subarray(0x1C00,0x1C0C)),
                     Array.from(loader.playerImage().bootstrap));
    assert.deepEqual(Array.from(hw.memory.subarray(0x9000,0x92A4)),
                     Array.from(loader.playerImage().runtime));
    assert.deepEqual(Array.from(hw.memory.subarray(0x9400,0x9412)),
                     Array.from(image.descriptor));
    assert.equal(hw.memory[0x9450],before[0x9450]);
    assert.equal(hw.memory[0xA000],before[0xA000]);
    assert.equal(image.descriptor[14],2);
    const damaged=Buffer.from(original);damaged.write('RSID',0);
    assert.throws(()=>loader.install(hw,damaged,{stage:0x6000}),
                  e=>e.code==='RSID_UNSUPPORTED');
    assert.equal(hw.count(),1,'invalid input must not modify RAM');
    hw.memory[0x929B]=1;
    assert.throws(()=>loader.install(hw,original,{stage:0x6000}),
                  e=>e.code==='ALREADY_PLAYING');
    assert.equal(hw.count(),1);
});

test('browser preflight rejects invalid versions, CIA, multiple SIDs, and staging overflow',()=>{
    const loader=contextWithLoader().SIDPSID;
    const v3=Buffer.from(original);v3.writeUInt16BE(3,4);
    assert.throws(()=>loader.inspect(v3),e=>e.code==='PSID_VERSION');
    const cia=synthetic(300);cia.writeUInt32BE(1,18);
    assert.throws(()=>loader.inspect(cia),e=>e.code==='CIA_TIMING');
    const multi=synthetic(300);multi[0x7A]=0x42;
    assert.throws(()=>loader.inspect(multi),e=>e.code==='MULTISID');
    assert.throws(()=>loader.prepare(original,{stage:'$7E00'}),
                  e=>e.code==='STAGING_RANGE');
    assert.throws(()=>loader.prepare(original,{stage:'$6000',subtune:6}),
                  e=>e.code==='SUBTUNE_RANGE');
    const large=synthetic(28*1024-0x7C);
    assert.equal(loader.prepare(large,{stage:'$2000'}).bytes.length,28*1024);
    assert.throws(()=>loader.prepare(large,{stage:'$2001'}),
                  e=>e.code==='STAGING_RANGE');
});

function nativePlayback(file,stage=0x6000,limit=10){
    const loader=contextWithLoader().SIDPSID;
    const mem=new Uint8Array(65536);
    const hw={
        safe_flashdump(){return mem.subarray(0,0xC000).slice();},
        safe_read(addr){return mem[addr];},
        load_ram64k(bytes){mem.set(bytes.subarray(0,0xC000),0);}
    };
    const image=loader.install(hw,file,{stage});
    const zp=Uint8Array.from({length:256},(_,i)=>(i*17+7)&255);
    mem.set(zp,0);
    mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
    let tick=0,slotIndex=0,latched=0,keys=0,done=false,copyChecked=false;
    const writes=[],frames=[];
    const context=vm.createContext({console,Uint8Array,Math,Number,
                                   oEMU:{component:{CPU:{}}}});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),
        context,{filename:'EMU_cpu6502.js'});
    const cpu=new context.Cpu6502({
        irq_signal:0,nmi_signal:0,
        read(addr){
            if(addr===0xC0C0)return 0x53; // physical SID in slot 4
            if(addr>=0xC090&&addr<=0xC0F0&&(addr&15)===0)return 0xFF;
            if(addr===0xC0C3){
                if(slotIndex===0x1E){latched=tick&65535;return latched&255;}
                if(slotIndex===0x1F)return latched>>>8;
                return 0xFF;
            }
            if(addr===0xC000)return ++keys>=limit?0x80:0;
            if(addr===0xC010)return 0;
            if(addr===0xFDED)return 0x60;
            if(addr>=0xD000)return 0xEA;
            return mem[addr&65535];
        },
        write(addr,val){
            if(addr===0xC0C2){slotIndex=val&31;return;}
            if(addr>=0xD400&&addr<=0xD41F)writes.push([addr,val&255]);
            else if(addr<0xC000)mem[addr]=val&255;
        },
        lineDecode:addr=>addr>>12
    });
    cpu.reset();
    cpu.setState({pc:0x1C00,sp:0xFD,p:0x20,a:0,x:0,y:0});
    cpu.setExecutionTrap(0xFF00,()=>{done=true;return true;});
    let atPlay=false;
    while(!done&&tick<2500000){
        const pc=cpu.watch().pc;
        if(!copyChecked&&pc===image.initAddress){
            copyChecked=true;
            assert.deepEqual(
                Array.from(mem.subarray(image.loadAddress,image.executableEnd)),
                Array.from(file.subarray(image.payloadOffset)));
        }
        let next=pc===image.playAddress;
        if(next&&!atPlay)frames.push(tick);
        atPlay=next;
        cpu.cycle();tick++;
    }
    assert.ok(done,'Native browser-loaded PSID did not return; PC='+cpu.watch().pc.toString(16));
    assert.ok(copyChecked,'Original executable not copied before native INIT');
    assert.equal(mem[0x929A],0);
    assert.equal(mem[0x929B],0);
    assert.deepEqual(Array.from(mem.subarray(0,256)),Array.from(zp));
    return {writes,frames,mem,tick};
}

test('native 6502 executes browser-loaded PSID v1/v2 with identical writes and timing',()=>{
    const first=nativePlayback(v1MrHeli(),0x2000);
    const second=nativePlayback(original,0x7D00);
    assert.deepEqual(first.writes,second.writes,
        'PSID container version/staging must never alter SID bus writes');
    assert.equal(first.frames.length,10);
    assert.equal(second.frames.length,10);
    for(const r of [first,second]){
        const intervals=r.frames.slice(1).map((t,i)=>t-r.frames[i]);
        assert.ok(intervals.every(d=>d>20300&&d<20570));
        assert.equal(r.mem[0x1C00],0x4C,'public entry stub restored');
        assert.equal(r.writes.at(-1)[0],0xD418);
        assert.equal(r.writes.at(-1)[1],0);
    }
});

test('SID card toolbox exposes browser PSID player without altering telemetry layout',()=>{
    const ctx=vm.createContext({console,Uint8Array,Math,Number,
        oEMU:{component:{IO:{}}}});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_CARD_SID.js'),'utf8'),ctx);
    const card=new ctx.SIDCard();
    card.mount={hash:4321};
    const html=card.deviceToolSlotHTML({slotID:4,toolboxID:'device_tool_4'});
    assert.match(html,/openPSIDPlayer/);
    assert.match(html,/Interactive PSID v1\/v2 player/);
    assert.match(html,/Telemetry/);
    assert.equal((html.match(/class='sid-toolbox-row'/g)||[]).length,3);
});

test('browser PSID panel uploads a local file and queues Play/Stop through the Apple II keyboard',async()=>{
    class Node {
        constructor(tag){
            this.tag=tag;this.children=[];this.parentNode=null;this.attrs={};
            this.style={};this._text='';this._value='';this.disabled=false;
        }
        setAttribute(key,value){this.attrs[key]=String(value);
            if(key==='value')this._value=String(value);}
        appendChild(child){this.children.push(child);child.parentNode=this;return child;}
        removeChild(child){const n=this.children.indexOf(child);
            if(n>=0)this.children.splice(n,1);child.parentNode=null;return child;}
        set textContent(v){this._text=String(v);this.children=[];}
        get textContent(){return this._text;}
        set value(v){this._value=String(v);}
        get value(){
            if(this.tag==='select'){
                const selected=this.children.find(x=>x.selected)||this.children[0];
                return selected?selected.value:'';
            }
            return this._value;
        }
    }
    const body=new Node('body'),timers=new Map(),pipe=[];
    let timerID=0,unlocked=0;
    const fakeDocument={body,createElement:tag=>new Node(tag)};
    const hw=mockHardware();
    const io={pipeSend(from,to,message){
        pipe.push({from,to,data:message.data});
        return true;
    }};
    hw.io=io;
    const card={state:{active:true},model:null,clock:null,enabled:false,snoop:false,
        setEnabled(v){this.enabled=v;},
        setSnoopEnabled(v){this.snoop=v;},
        setClock(v){this.clock=v;},
        setModel(v){this.model=v;}};
    const ctx=contextWithLoader({
        document:fakeDocument,apple2plus:{hwObj:()=>hw},
        setInterval:(fn)=>{const id=++timerID;timers.set(id,fn);return id;},
        clearInterval:id=>timers.delete(id),
        EMU_audio_event_unlock:()=>{unlocked++;}
    });
    const loader=ctx.SIDPSID;
    assert.equal(loader.open(card),true);
    function find(match,node=body){
        if(match(node))return node;
        for(const child of node.children){
            const got=find(match,child);if(got)return got;
        }
        return null;
    }
    const chooser=find(n=>n.tag==='input'&&n.attrs.type==='file');
    const play=find(n=>n.tag==='button'&&n.textContent==='▶ Play');
    const stop=find(n=>n.tag==='button'&&n.textContent==='■ Stop');
    const song=find(n=>n.tag==='select');
    const stage=find(n=>n.tag==='input'&&n.attrs['aria-label']==='PSID staging address');
    assert.ok(chooser&&play&&stop&&song&&stage);
    assert.equal(play.disabled,true);
    const file=v1MrHeli();
    chooser.files=[{name:'MrHeli_v1.sid',size:file.length,
        arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)}];
    await chooser.onchange();
    assert.equal(play.disabled,false);
    assert.equal(song.value,'5');
    assert.equal(stage.value,'6000');
    stage.value='2000'; // arbitrary non-default source origin
    play.onclick();
    assert.equal(hw.count(),1,'binary images loaded into physical RAM');
    assert.equal(hw.memory[0x2000],0x50,'complete staged PSID header remains in RAM');
    assert.equal(card.enabled,true);assert.equal(card.snoop,true);
    assert.equal(card.clock,985248);
    assert.equal(unlocked,1);
    assert.deepEqual(pipe,[{from:'0:PASTEBO:text',to:'0:A2KBD:text',data:'CALL 7168\n'}]);
    assert.equal(play.disabled,true,'prevent another load while command pending');
    hw.memory[0x929B]=1;
    for(const tick of timers.values())tick();
    assert.equal(stop.disabled,false);
    stop.onclick();
    assert.equal(pipe.at(-1).data,' ');
    hw.memory[0x929B]=0;
    for(const tick of timers.values())tick();
    assert.equal(play.disabled,false,'allow fresh play after native exit');
    loader.dispose(card);
    assert.equal(body.children.length,0);
    assert.equal(timers.size,0);
});
