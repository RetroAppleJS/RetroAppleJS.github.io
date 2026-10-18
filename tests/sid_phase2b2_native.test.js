'use strict';
// Real RetroAppleJS NMOS 6502 test of authoritative Phase 2B.2 assembly.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const build=require('../tools/SID_Phase2B2_build.js');
const original=fs.readFileSync(path.join(ROOT,'asm/AUDIO/SID2MB_prototype/Mr_Heli_original.sid'));
function psidV1(){
    const b=Buffer.concat([original.subarray(0,0x76),original.subarray(0x7C)]);
    b.writeUInt16BE(1,4);b.writeUInt16BE(0x76,6);
    return b;
}
function simulate(file,{stage=0x6000,subtune='3',record=true,slot=4,frames=12}={}){
    const code=build.assemble(),mem=new Uint8Array(65536);
    mem.set(code.bootstrap,0x1C00);
    mem.set(code.runtime,0x9000);
    mem.set(file,stage);
    if(record)mem.set([0x53,0x49,0x44,0x46,stage&255,stage>>>8,
                       file.length&255,file.length>>>8],0x9E00);
    const originalZP=Uint8Array.from({length:256},(_,i)=>(i*73+11)&255);
    mem.set(originalZP,0);
    // JSR from BASIC with $FF00-1 as synthetic return-to-BASIC address.
    mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
    let tick=0,slotIndex=0,latched=0,done=false,keys=0,queries=0,executed=false;
    const writes=[],calls=[],playTicks=[],ioBase=0xC080+slot*16;
    const inputs=record?['',subtune]:[stage.toString(16).toUpperCase(),
                                     file.length.toString(16).toUpperCase(),subtune];
    const context=vm.createContext({console,Uint8Array,Float32Array,Math,Number,
        oEMU:{component:{CPU:{}}}});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),context);
    const cpu=new context.Cpu6502({
      irq_signal:0,nmi_signal:0,lineDecode:a=>a>>12,
      read(addr){
        if(addr===ioBase)return 0x53;
        if(addr>=0xC090&&addr<=0xC0F0&&(addr&15)===0)return 0xFF;
        if(addr===ioBase+3){
          if(slotIndex===0x1E){latched=tick&65535;return latched&255;}
          if(slotIndex===0x1F)return latched>>>8;
          return 0xFF;
        }
        if(addr===0xFD6A){
          const line=inputs[queries++];
          if(line===undefined)throw Error('Unexpected GETLN prompt #'+queries);
          for(let i=0;i<line.length;i++)mem[0x0200+i]=line.charCodeAt(i)|0x80;
          mem[0x0200+line.length]=0x8D;
          return 0x60;
        }
        if(addr===0xFDED||addr===0xFD8E)return 0x60;
        if(addr===0xC000)return ++keys>=frames?0x80:0;
        if(addr===0xC010)return 0;
        if(addr>=0xD000)return 0xEA;
        return mem[addr&65535];
      },
      write(addr,v){
        if(addr===ioBase+2){slotIndex=v&31;return;}
        if(addr>=0xD400&&addr<=0xD41F)writes.push([addr,v&255]);
        else if(addr<0xC000)mem[addr]=v&255;
      }
    });
    cpu.reset();
    cpu.setState({pc:0x1C00,sp:0xFD,p:0x20,a:0,x:0,y:0});
    cpu.setExecutionTrap(0xFF00,()=>{done=true;return true;});
    let priorPlay=false;
    while(!done&&tick<3500000){
      const pc=cpu.watch().pc;
      if(pc===0x1EF3)executed=true;
      const isPlay=pc===0x0E34;
      if(isPlay&&!priorPlay)playTicks.push(tick);
      priorPlay=isPlay;
      cpu.cycle();tick++;
    }
    assert.ok(done,'6502 did not return from native front-end: $'+cpu.watch().pc.toString(16));
    return {code,mem,originalZP,writes,playTicks,queries,executed,tick};
}
test('native Phase 2B.2 compiles as 6502, with protected runtime outside raw PSID window',()=>{
    const p=build.assemble();
    assert.equal(p.bootstrap.length,12);
    assert.ok(p.runtime.length>676&&p.runtime.length<0xD00);
    assert.ok(p.highEnd<=0x9D00);
    assert.equal(p.symbols.PUBLIC,0x1C00);
    assert.ok(p.symbols.NATIVE_ENTRY>=0x900C&&p.symbols.NATIVE_ENTRY<p.highEnd); // in resident runtime
});
test('native v1 and v2 headers, chosen subtune and real INIT/PLAY produce identical SID writes',()=>{
    const a=simulate(psidV1(),{stage:0x6000,subtune:'3'});
    const b=simulate(original,{stage:0x7D00,subtune:'3'});
    for(const r of [a,b]){
        assert.ok(r.executed,'original INIT not executed');
        assert.equal(r.queries,2,'start address and subtune prompts expected');
        assert.equal(r.playTicks.length,12);
        assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.originalZP));
        assert.equal(r.mem[0x1C00],0x4C,'rebuild overwritten public stub');
        assert.equal(r.writes.at(-1)[0],0xD418);
        assert.equal(r.writes.at(-1)[1],0);
        assert.ok(r.playTicks.slice(1).every((t,i)=>t-r.playTicks[i]>20300&&
                    t-r.playTicks[i]<20570));
    }
    assert.deepEqual(a.writes,b.writes);
});
test('native player accepts manually loaded file with start and length typed on Apple II',()=>{
    const r=simulate(original,{record:false,stage:0x6000,subtune:'5'});
    assert.equal(r.queries,3);
    assert.ok(r.executed);
    assert.equal(r.playTicks.length,12);
});

test('native parser rejects CIA subtunes without executing INIT or writing SID registers',()=>{
    const cia=Buffer.from(original);
    // Selected subtune 3: speed bitmap bit 2 requests CIA rather than VBI.
    cia.writeUInt32BE(1<<2,18);
    const r=simulate(cia,{stage:0x6000,subtune:'3'});
    assert.equal(r.queries,2);
    assert.equal(r.executed,false);
    assert.equal(r.playTicks.length,0);
    assert.equal(r.writes.length,0);
    assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.originalZP));
});
test('native parser rejects invalid signature before any music execution',()=>{
    const invalid=Buffer.from(original);
    invalid.write('NOT!',0,'ascii');
    const r=simulate(invalid,{stage:0x6000});
    assert.equal(r.queries,1);
    assert.equal(r.executed,false);
    assert.equal(r.writes.length,0);
    assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.originalZP));
});
test('native parser rejects executable in the resident player workspace',()=>{
    const unsafe=Buffer.from(original);
    unsafe.writeUInt16BE(0x9000,8);
    const r=simulate(unsafe,{stage:0x6000,subtune:'5'});
    assert.equal(r.executed,false);
    assert.equal(r.writes.length,0);
    assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.originalZP));
});
