/*
 * INFLATE_ASM_CORE.S validation harness for Debugger TEST BENCH.
 *
 * Use this in Debugger tab 3 TEST BENCH after assembling/loading
 * INFLATE_ASM_CORE.S into debugger RAM and importing the assembler symbols.
 *
 * This is not the STEP TRACE breakpoint scenario. It uses TB.call() to invoke
 * inflate through the debugger trampoline, then verifies debugger RAM.
 * Expected final transcript: PASS 15/15 vectors, PASS 135/135 assertions.
 */
(function(){
  'use strict';

  const root=typeof window!=='undefined'?window:globalThis;

  const CFG={
    only:null,
    stopOnFailure:true,
    defaultInput:0x3000,
    defaultOutput:0x4000,
    scratchBytes:765,
    zpBytes:10,
    outputGuardBytes:16,
    inputGuardBytes:8,
    scratchGuardBytes:8,
    scratchFill:0xA5,
    outputFill:0xD3,
    inputGuardFill:0xC7,
    scratchGuardFill:0x5A,
    maxInstructions:1000000,
    timeoutMs:30000,
    trampoline:0x0200
  };

  const VECTORS=[
    {name:'stored_000',group:'STORED',hex:'010000FFFF',expectedBytes:0},
    {name:'stored_005',group:'STORED',hex:'010500FAFF48454C4C4F',expectedBytes:5},
    {name:'stored_255',group:'STORED',hex:'01FF0000FF135CA5EE3780C9125BA4ED367FC8115AA3EC357EC71059A2EB347DC60F58A1EA337CC50E57A0E9327BC40D569FE8317AC30C559EE73079C20B549DE62F78C10A539CE52E77C009529BE42D76BF08519AE32C75BE075099E22B74BD064F98E12A73BC054E97E02972BB044D96DF2871BA034C95DE2770B9024B94DD266FB8014A93DC256EB7004992DB246DB6FF4891DA236CB5FE4790D9226BB4FD468FD8216AB3FC458ED72069B2FB448DD61F68B1FA438CD51E67B0F9428BD41D66AFF8418AD31C65AEF74089D21B64ADF63F88D11A63ACF53E87D01962ABF43D86CF1861AAF33C85CE1760A9F23B84CD165FA8F13A83CC155EA7F03982CB145DA6EF3881',expectedBytes:255},
    {name:'stored_256',group:'STORED',hex:'010001FFFE135CA5EE3780C9125BA4ED367FC8115AA3EC357EC71059A2EB347DC60F58A1EA337CC50E57A0E9327BC40D569FE8317AC30C559EE73079C20B549DE62F78C10A539CE52E77C009529BE42D76BF08519AE32C75BE075099E22B74BD064F98E12A73BC054E97E02972BB044D96DF2871BA034C95DE2770B9024B94DD266FB8014A93DC256EB7004992DB246DB6FF4891DA236CB5FE4790D9226BB4FD468FD8216AB3FC458ED72069B2FB448DD61F68B1FA438CD51E67B0F9428BD41D66AFF8418AD31C65AEF74089D21B64ADF63F88D11A63ACF53E87D01962ABF43D86CF1861AAF33C85CE1760A9F23B84CD165FA8F13A83CC155EA7F03982CB145DA6EF3881CA',expectedBytes:256},
    {name:'stored_257',group:'STORED',hex:'010101FEFE135CA5EE3780C9125BA4ED367FC8115AA3EC357EC71059A2EB347DC60F58A1EA337CC50E57A0E9327BC40D569FE8317AC30C559EE73079C20B549DE62F78C10A539CE52E77C009529BE42D76BF08519AE32C75BE075099E22B74BD064F98E12A73BC054E97E02972BB044D96DF2871BA034C95DE2770B9024B94DD266FB8014A93DC256EB7004992DB246DB6FF4891DA236CB5FE4790D9226BB4FD468FD8216AB3FC458ED72069B2FB448DD61F68B1FA438CD51E67B0F9428BD41D66AFF8418AD31C65AEF74089D21B64ADF63F88D11A63ACF53E87D01962ABF43D86CF1861AAF33C85CE1760A9F23B84CD165FA8F13A83CC155EA7F03982CB145DA6EF3881CA13',expectedBytes:257},
    {name:'fixed_literal_ranges',group:'FIXED',hex:'636064AAEF9F30F1DF7FC72800',expectedBytes:11},
    {name:'fixed_overlap_d1_l3',group:'FIXED',hex:'73040200',expectedBytes:4},
    {name:'fixed_overlap_d1_l258',group:'FIXED',hex:'731CF90000',expectedBytes:259},
    {name:'fixed_all_length_ranges',group:'FIXED',hex:'F30102100003088002188003044002C80005A00234800E300026C002B0031C0037C003F0030280302002100F4800A4033200F980024039A002A03EA001A03DA003A03F180030F0601080C10F860018FA601880E10F460018F960E40300',expectedBytes:3387},
    {name:'fixed_all_distance_ranges',group:'FIXED',hex:'539DF43FE7A6DB6685DE5FE9571CD749777C4D3A6FB352ACF943EC29F3258275AF238E1ACDE7A97C167C4077167BC943BFDD1A5399F2EF786E539EF037EBBACB46B9EE1FA997ECD748B67D4E386BB55CA4F15DF409D345FC352FC30E1BCCE52A7F12B84F7B066BD17D9F9D6A9319726FB96F51ECFB9D71D569BD4CE7B7E40BB6ABC45B3EC69DB6582A54FF26F298F102DEAAE72107F56673943EF2DFA3398DB9E0AED7769589FFB26FB86E92EFF99976D961AD54FB97C473D62B449BDEC79C345B2C50FB2AFC88E13CEE8AA741FB7566B2153FF0DDA53E8531EFB6C756A5FE3F99D79C37C8767D4FB968B75AA2F553FC19CB65C20D6FA38E9B2CE4AB7E117A487F0E67D9E380BD5AD347BED747BED747BED71947BED747BED747BED747BED79946BED747BED747BED747BED79947BED747BED747BED747BED75946BED747BED747BED747BED75947BED747BED747BED747BED7D946BED747BED747BED747BED7D947BED747BED747BED747BED73946BED747BED747BED73947BED747BED747BED747BED7B946BED747BED747BED747BED7B947BED747BED747BED747BED77946BED747BED747BED747BED77947BED747BED747BED747BED7F946BED747BED747BED747BED7F947BED747BED747BED70546BED747BED747BED747BED70547BED747BED747BED747BED78546BED747BED747BED747BED78547BED747BED747BED747BED74546BED747BED747BED747BED74547BED747BED747BED747BED7C546BED747BED747BED747BED7C547BED747BED747BED747BED72546BED747BED747BED747BED72547BED747BED747BED747BED7A546BED747BED747BED747BED7A547BED747BED747BED747BED76546BED747BED747BED747BED76547BED747BED747BED747BED7E546BED747BED747BED747BED7E547BED747BED747BED71546BED747BED747BED7879DD78100088108888104900452401AC800B2811C201F280014074A00E5810A80EA811A80FA810600CD075A00B41FE800A0FB811E00FA1F1800C0F007460030FE81090098FE81190098FF810500B0FC075600C0FA1FD80000B6FF811D0060FF1F3800001CFF074E0000E7FF810B0080EBFF811B0080FBFF81070000CFFF075E0000BCFF1F00',expectedBytes:33426,input:0xB000,output:0x1000},
    {name:'fixed_output_page_cross',group:'POINTER BOUNDARIES',hex:'7374721EF9081B0200',expectedBytes:281,output:0x40F8},
    {name:'fixed_input_page_cross',group:'POINTER BOUNDARIES',hex:'6360646266616563E7E0E4E2E6E1E5E317101412161115139790949296919593A7541E00',expectedBytes:96,input:0x20FC},
    {name:'dynamic_lorem',group:'DYNAMIC',hex:'EDCBD10983301400C055DE00A593B884C4200F8C9124EEDF417AF77F5B1FB5453EF36D71F4AB8F98B9626F757DA2F47BD6B2EA7A47EC473E394BDE67D42BD737365114455114455114455114455114455114455114455114455114455114455114FF35FE00',expectedBytes:11400},
    {name:'dynamic_repeat_16_17_18',group:'DYNAMIC',hex:'1D4EC90D04310C6A8902DCD17641697494270FA48195E2D8315748581123255168E06C06DD1B81BB602C02788221916B1CE46CEC45EF85AE8D835EF59D33921D8315658775C312A5FB733D68EEF1F2D46A5E359933E78C155E6A7CF5F815E68DB3EF8DE67C',expectedBytes:200},
    {name:'multiblock_fixed_then_stored',group:'BLOCK CONTROL',hex:'72F2F177F636D405040600F9FF424C4F434B32',expectedBytes:13}
  ];

  function need(condition,message){if(!condition)throw new Error(message);}
  function hexBytes(text){
    text=String(text||'').replace(/[^0-9A-Fa-f]/g,'');
    need((text.length&1)===0,'Odd-length hex vector.');
    const out=new Uint8Array(text.length>>1);
    for(let i=0;i<out.length;i++)out[i]=parseInt(text.substr(i*2,2),16);
    return out;
  }
  function firstDifference(actual,expected){
    const n=Math.min(actual.length,expected.length);
    for(let i=0;i<n;i++)if(actual[i]!==expected[i])return i;
    return actual.length===expected.length?-1:n;
  }
  function selectVector(v){
    if(CFG.only==null)return true;
    const selected=Array.isArray(CFG.only)?CFG.only:[CFG.only];
    return selected.indexOf(v.name)>=0||selected.indexOf(v.group)>=0;
  }

  need(root.TB&&root.TB.ram&&root.TB.cpu&&typeof root.TB.call==='function','This script must be run in Debugger TEST BENCH.');
  const TB=root.TB;
  function say(){return TB.print.apply(TB,arguments);}
  function filled(address,length,value){
    const data=TB.ram.read(address,length);
    for(let i=0;i<data.length;i++)if(data[i]!== (value&0xFF))return false;
    return true;
  }
  function instructionCount(run){return Math.max(0,Number(run&&(run.instructions||run.instructionCount||run.ic)||0));}

  need(root.pako&&typeof root.pako.inflateRaw==='function','pako.inflateRaw() is not available.');
  ['inflate','inflate_data','inputPointer','outputPointer'].forEach(name=>need(TB.symbol(name),'Missing TEST BENCH symbol: '+name));

  const selected=VECTORS.filter(selectVector);
  need(selected.length>0,'No vectors selected.');

  const results=[];
  let currentGroup='';

  function prepareCase(v){
    const compressed=hexBytes(v.hex);
    const expected=root.pako.inflateRaw(compressed);
    need(expected instanceof Uint8Array,v.name+': pako.inflateRaw() did not return Uint8Array.');
    need(expected.length===v.expectedBytes,v.name+': reference length '+expected.length+' != manifest length '+v.expectedBytes+'.');

    const input=v.input==null?CFG.defaultInput:v.input;
    const output=v.output==null?CFG.defaultOutput:v.output;
    const scratch=TB.sym('inflate_data');
    const zp=TB.sym('inflate_zp',TB.sym('inputPointer'));

    TB.ram.fill(zp,CFG.zpBytes,CFG.scratchFill);
    TB.ram.fill(scratch,CFG.scratchBytes,CFG.scratchFill);
    TB.ram.fill(scratch+CFG.scratchBytes,CFG.scratchGuardBytes,CFG.scratchGuardFill);
    TB.ram.fill(input-CFG.inputGuardBytes,CFG.inputGuardBytes,CFG.inputGuardFill);
    TB.ram.fill(input+compressed.length,CFG.inputGuardBytes,CFG.inputGuardFill);
    TB.ram.load(input,compressed);
    TB.ram.fill(output-CFG.outputGuardBytes,CFG.outputGuardBytes+expected.length+CFG.outputGuardBytes,CFG.outputFill);
    TB.ram.write16('inputPointer',input);
    TB.ram.write16('outputPointer',output);

    return {vector:v,compressed,expected,input,output,scratch,assertions:0,failedAssertions:0};
  }

  function check(active,condition,description){
    active.assertions++;
    if(condition)say('PASS '+description);
    else{active.failedAssertions++;say('FAIL '+description);}
    return !!condition;
  }

  function runCase(v){
    const active=prepareCase(v);
    const run=TB.call('inflate',{
      trampoline:CFG.trampoline,
      maxInstructions:CFG.maxInstructions,
      timeoutMs:CFG.timeoutMs,
      detectPcLoops:false,
      inputPointerAddress:'inputPointer',
      outputPointerAddress:'outputPointer'
    });

    const inputPointer=TB.ram.read16('inputPointer');
    const outputPointer=TB.ram.read16('outputPointer');
    const actual=TB.ram.read(active.output,active.expected.length);
    const diff=firstDifference(actual,active.expected);

    check(active,inputPointer===((active.input+active.compressed.length)&0xFFFF),'input consumed');
    check(active,outputPointer===((active.output+active.expected.length)&0xFFFF),'output pointer');
    check(active,diff===-1,'exact output');
    check(active,filled(active.output-CFG.outputGuardBytes,CFG.outputGuardBytes,CFG.outputFill),'output guard before');
    check(active,filled(active.output+active.expected.length,CFG.outputGuardBytes,CFG.outputFill),'output guard after');
    check(active,filled(active.input-CFG.inputGuardBytes,CFG.inputGuardBytes,CFG.inputGuardFill),'input guard before');
    check(active,filled(active.input+active.compressed.length,CFG.inputGuardBytes,CFG.inputGuardFill),'input guard after');
    check(active,filled(active.scratch+CFG.scratchBytes,CFG.scratchGuardBytes,CFG.scratchGuardFill),'scratch guard after');
    check(active,run&&run.reason==='stop-pc'&&run.state&&run.state.sp===0xFF,'stack restored');

    if(diff>=0)say('    output diff +'+diff+' @ '+TB.hex((active.output+diff)&0xFFFF,4));
    if(!run||run.reason!=='stop-pc')say('    CPU: '+TB.cpu.describe(run||{}));

    const pass=active.failedAssertions===0;
    const instructions=instructionCount(run);
    const result={name:v.name,group:v.group,status:pass?'PASS':'FAIL',pass,assertions:active.assertions,failedAssertions:active.failedAssertions,input:active.input,output:active.output,compressedBytes:active.compressed.length,expectedBytes:active.expected.length,firstDifference:diff,instructions,run};
    results.push(result);
    say((pass?'PASS ':'FAIL ')+v.name+' — '+result.assertions+' assertions / '+instructions+' ins');
    return result;
  }

  function summary(){
    const passed=results.filter(r=>r.pass).length;
    const failed=results.length-passed;
    const notRun=selected.length-results.length;
    const assertions=results.reduce((sum,r)=>sum+r.assertions,0);
    const failedAssertions=results.reduce((sum,r)=>sum+r.failedAssertions,0);
    const instructions=results.reduce((sum,r)=>sum+r.instructions,0);
    say('-- SUMMARY --');
    say('PASS '+passed+'/'+results.length+(failed?' / FAIL '+failed:'')+(notRun?' / NOT RUN '+notRun:''));
    say('PASS '+(assertions-failedAssertions)+'/'+assertions+' assertions');
    say('Total executed 6502 instructions: '+instructions);
    if(failed)say('failed: '+results.filter(r=>!r.pass).map(r=>r.name).join(', '));
  }

  say('INFLATE_ASM_CORE.S — Debugger TEST BENCH raw DEFLATE validation');
  say('TB.call trampoline: '+TB.hex(CFG.trampoline,4)+' / vectors='+selected.length);
  root.INFLATE_DEBUGGER_TESTBENCH_RESULTS=results;
  root.INFLATE_DEBUGGER_TESTBENCH_CONFIG=CFG;
  root.INFLATE_DEBUGGER_TESTBENCH_VECTORS=VECTORS;

  for(let i=0;i<selected.length;i++){
    const v=selected[i];
    if(v.group!==currentGroup){currentGroup=v.group;say('-- '+currentGroup+' --');}
    const result=runCase(v);
    if(!result.pass&&CFG.stopOnFailure)break;
  }
  summary();
})();
