'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),build=require('../tools/SID_Phase2B2_build.js');
function realRom(){
  const c=vm.createContext({console,Uint8Array,oEMU:{component:{ROM:{}}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_apple2roms.js'),'utf8'),c);
  return vm.runInContext('apple2Rom',c);
}
function cpuCode(){const c=vm.createContext({console,Uint8Array,Math,Number,oEMU:{component:{CPU:{}}}});vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),c);return c.Cpu6502;}
test('native Phase 2B.2 title reaches physical text screen through real Apple II monitor ROM',()=>{
 const rom=realRom(),code=build.assemble(),mem=new Uint8Array(0x10000);
 assert.equal(rom.length,0x3000);
 mem.set(code.bootstrap,0x1C00);mem.set(code.runtime,0x9000);
 mem.set([0x53,0x49,0x44,0x46,0x00,0x60,0xE9,0x12],0x9E00);
 // Apple II monitor output: CSWL -> COUT1; KSWL -> KEYIN.
 mem[0x36]=0xF0;mem[0x37]=0xFD;
 mem[0x38]=0x1B;mem[0x39]=0xFD;
 mem[0x20]=0;mem[0x21]=40;mem[0x22]=0;mem[0x23]=24;
 mem[0x24]=0;mem[0x25]=0;
 mem[0x28]=0x00;mem[0x29]=0x04;mem[0x32]=0xFF;
 mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
 let cout=0,getln=false,trace=[],output=[];
 const Cpu=cpuCode();
 const cpu=new Cpu({
  irq_signal:0,nmi_signal:0,lineDecode:a=>a>>12,
  read(addr){return addr>=0xD000?rom[addr-0xD000]:addr===0xC000?0:mem[addr];},
  write(addr,value){if(addr<0xC000)mem[addr]=value&255;}
 });
 cpu.reset();cpu.setState({pc:0x1C00,sp:0xFD,p:0x20,a:0,x:0,y:0});
 for(let i=0;i<100000;i++){
    const pc=cpu.watch().pc;
    if(trace.length<50&&pc>=0x92A0&&pc<0x92D0)trace.push(pc.toString(16));
    if(pc===0xFDED){cout++;if(output.length<110)output.push(String.fromCharCode(cpu.watch().a&127));}
    if(pc===0xFD6A){getln=true;break;}
    cpu.cycle();
 }
 const chars=Array.from(mem.subarray(0x400,0x800),b=>String.fromCharCode(b&0x7f)).join('');
 assert.ok(getln,'Expected to reach Apple II monitor GETLN; cout '+cout+' PC $'+cpu.watch().pc.toString(16)+' trace '+trace.join(' '));
 assert.ok(chars.includes('SID PLAYER'),'Title absent from physical text page; COUT calls '+cout+' screen '+JSON.stringify(chars.slice(0,160))+' trace '+trace.join(' ')+' output '+JSON.stringify(output.join(''))+' vectors '+Array.from(mem.subarray(0x36,0x3A)).join(','));
});
