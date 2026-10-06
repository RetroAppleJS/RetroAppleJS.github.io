'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function machine()
{
    const ram=new Uint8Array(65536).fill(0xEA),elements={},alerts=[],downloads=[];
    const ctx={console,btoa:s=>Buffer.from(s,'binary').toString('base64'),Blob,
        oEMU:{component:{CPU:{}}},oCOM:{getHexWord:n=>n.toString(16).toUpperCase().padStart(4,'0'),POPUP:{set_state(){}}},
        alert:s=>alerts.push(s),URL:{createObjectURL:b=>{downloads.push(b);return 'blob:test';},revokeObjectURL(){}},
        document:{activeElement:null,getElementById:id=>elements[id]||null,
            createElement:()=>({style:{},click(){}}),body:{appendChild(){},removeChild(){}}}};
    vm.createContext(ctx);
    for(const name of ['EMU_cpu6502.js','EMU_apple2debug.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',name),'utf8'),ctx,{filename:name});
    const cpu=new ctx.Cpu6502({read:a=>ram[a],write:(a,v)=>ram[a]=v}),dbg=ctx.oEMU.component.CPU.Apple2Debug;
    ctx.apple2plus={cpuObj:()=>cpu};cpu.setState({pc:0x6000,ic:0});
    function element(value='')
    {
        const classes=new Set();
        return {value,style:{},disabled:false,title:'',focus(){},select(){},
            classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)}};
    }
    for(const id of ['cpuDbg_bootStart','cpuDbg_bootStop','cpuDbg_bootTrigger','cpuDbg_bootDownload','cpuDbg_bootDownloadIcon'])elements[id]=element();
    function step(){const before=cpu.watch().ic;do{cpu.cycle();}while(cpu.watch().ic===before);}
    function arm(start,stop){elements.cpuDbg_bootStart.value=start;elements.cpuDbg_bootStop.value=stop;dbg.toggleBootLogTrigger(elements.cpuDbg_bootTrigger);}
    return {ctx,cpu,dbg,ram,elements,alerts,downloads,step,arm};
}
test('PC start and INS stop use the NAV boundary count without truncating to 16 bits',()=>{
    const h=machine();h.cpu.setState({pc:0x6000,ic:0x2C36E40});h.arm('PC $6001','INS $2C36E43');
    h.step();assert.equal(h.cpu.BOOTparam().count,0);h.step();h.step();h.step();
    assert.deepEqual(Array.from(h.cpu.getBootLog(),r=>r.adr),[0x6001,0x6002]);
    assert.equal(h.cpu.BOOTparam().complete,true);
});
test('INS start and PC stop can be independently selected',()=>{
    const h=machine();h.arm('INS $2','PC $6004');for(let i=0;i<5;i++)h.step();
    assert.deepEqual(Array.from(h.cpu.getBootLog(),r=>r.adr),[0x6002,0x6003]);
});
test('unprefixed hex values retain PC semantics and stop is exclusive',()=>{
    const h=machine();h.arm('$6001','$6003');for(let i=0;i<4;i++)h.step();
    assert.deepEqual(Array.from(h.cpu.getBootLog(),r=>r.adr),[0x6001,0x6002]);
});
test('both blank conditions capture immediately and stop at buffer capacity',()=>{
    const h=machine();h.arm('','');const capacity=h.cpu.BOOTparam().capacity;
    for(let i=0;i<capacity+1;i++){h.cpu.setState({pc:0x6000,cycle_delay:0});h.step();}
    assert.equal(h.cpu.BOOTparam().count,capacity);assert.equal(h.cpu.BOOTparam().logging,false);
    assert.equal(h.cpu.BOOTparam().complete,true);
});
test('12-digit INS values survive normalization, input synchronization and disabling',()=>{
    const h=machine();h.arm('ins $123456789ABC','INS $FFFFFFFFFFFF');
    assert.equal(h.alerts.length,0);assert.equal(h.cpu.BOOTparam().triggerAddress,0x123456789ABC);
    assert.equal(h.elements.cpuDbg_bootStart.value,'INS $123456789ABC');
    h.dbg.toggleBootLogTrigger(h.elements.cpuDbg_bootTrigger);
    assert.equal(h.cpu.BOOTparam().triggerAddress,0x123456789ABC);
});
test('invalid prefixes and out-of-range counters do not arm or overwrite a capture',()=>{
    for(const value of ['INS $1000000000000','PC $10000','FOO $6000','INS -1','INS $1junk']){
        const h=machine();h.arm(value,'');assert.equal(h.cpu.BOOTparam().bDebug_boot,false,value);assert.equal(h.alerts.length,1,value);
    }
});
test('reset re-arms an INS capture against the reset instruction count',()=>{
    const h=machine();h.ram[0xFFFC]=0;h.ram[0xFFFD]=0x60;h.arm('INS $1','INS $3');
    for(let i=0;i<4;i++)h.step();h.cpu.reset();for(let i=0;i<4;i++)h.step();
    assert.deepEqual(Array.from(h.cpu.getBootLog(),r=>r.adr),[0x6001,0x6002]);
});
test('empty and armed downloads are disabled, capture blinks, completion is steady',()=>{
    const h=machine(),button=h.elements.cpuDbg_bootDownload,icon=h.elements.cpuDbg_bootDownloadIcon;
    h.dbg.setBootLogAddresses();assert.equal(button.disabled,true);h.arm('INS $1','INS $2');assert.equal(button.disabled,true);
    h.step();h.step();h.dbg.syncBootLogControls();assert.equal(button.disabled,true);assert.equal(icon.classList.contains('blink'),true);
    h.step();h.dbg.syncBootLogControls();assert.equal(button.disabled,false);assert.equal(icon.classList.contains('blink'),false);
});
test('download is guarded while empty or capturing and releases data after handing off the file',async()=>{
    const h=machine();h.dbg.downloadBootLog();assert.equal(h.downloads.length,0);h.arm('','INS $1');
    h.step();h.dbg.downloadBootLog();assert.equal(h.downloads.length,0);h.step();h.dbg.downloadBootLog();
    assert.equal(h.downloads.length,1);assert.equal(h.cpu.BOOTparam().count,0);assert.equal(h.cpu.BOOTparam().bDebug_boot,false);
    assert.equal(h.elements.cpuDbg_bootDownload.disabled,true);assert.equal(h.cpu.getBootLogBase64(),'');
    const bytes=Buffer.from(await h.downloads[0].text(),'base64');
    assert.equal(bytes.length,10);assert.equal(bytes.readUInt16LE(0),0x6000);assert.equal(bytes[2],0xEA);
    h.dbg.downloadBootLog();assert.equal(h.downloads.length,1);
    h.arm('','INS $4');h.step();assert.equal(h.cpu.BOOTparam().count,1,'new capture allocates a usable buffer');
});
test('INS zero matches after the 48-bit counter wraps',()=>{
    const h=machine();h.cpu.setState({ic:0xFFFFFFFFFFFF});h.arm('INS $0','INS $1');
    h.step();h.step();h.step();assert.deepEqual(Array.from(h.cpu.getBootLog(),r=>r.adr),[0x6001]);
});
test('legacy numeric CPU trigger APIs retain the PC default',()=>{
    const h=machine();h.cpu.setBootLogTrigger(0x6001,true);h.step();h.step();
    assert.equal(h.cpu.BOOTparam().count,1);assert.equal(h.cpu.BOOTparam().triggerType,'PC');
    h.cpu.armBootLogTrigger(0x6003);h.step();h.step();assert.equal(h.cpu.getBootLog()[0].adr,0x6003);
});
test('manual disabling flushes a pending compressed instruction and enables download',()=>{
    const h=machine(),entry=h.cpu.getBootLogFilters()[0];h.cpu.setState({pc:parseInt(entry.pc.slice(1),16)});
    h.arm('','');h.step();h.dbg.toggleBootLogTrigger(h.elements.cpuDbg_bootTrigger);
    assert.equal(h.cpu.BOOTparam().count,1);assert.equal(h.elements.cpuDbg_bootDownload.disabled,false);
    assert.equal(h.elements.cpuDbg_bootDownloadIcon.classList.contains('blink'),false);
});
test('capture ending inside a compression group flushes its incomplete tail',()=>{
    const h=machine(),entry=h.cpu.getBootLogFilters()[0];h.cpu.setState({pc:parseInt(entry.pc.slice(1),16),ic:0});
    h.arm('','INS $1');h.step();h.step();
    assert.equal(h.cpu.BOOTparam().complete,true);assert.equal(h.cpu.BOOTparam().count,1);
});
