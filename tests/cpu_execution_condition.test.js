'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cpuSource = fs.readFileSync(path.join(__dirname,'..','res','EMU_cpu6502.js'),'utf8');
const debugSource = fs.readFileSync(path.join(__dirname,'..','res','EMU_apple2debug.js'),'utf8');
const cpuContext = { console:{ log(){}, warn(){}, error(){} } };
vm.createContext(cpuContext);
vm.runInContext(cpuSource,cpuContext);

function harness(program)
{
    const mem = new Uint8Array(0x10000);
    mem.set(program || [0xEA,0xEA,0xEA,0xEA],0x0200);
    mem[0xFFFC] = 0x00;
    mem[0xFFFD] = 0x02;

    const hw = { irq_signal:0, nmi_signal:0 };
    hw.lineDecode = addr => (addr >>> 8) & 0xFF;
    hw.RD = new Array(256);
    hw.WR = new Array(256);
    for(let i=0;i<256;i++)
    {
        hw.RD[i] = addr => mem[addr & 0xFFFF];
        hw.WR[i] = (addr,value) => { mem[addr & 0xFFFF] = value & 0xFF; };
    }

    const cpu = new cpuContext.Cpu6502(hw);
    cpu.reset();
    return {cpu,mem};
}

function drain(cpu)
{
    while(cpu.watch().cycle_delay > 0) cpu.cycle();
}

test('persistent condition stops before matching opcode', () => {
    const {cpu} = harness();
    let checks = 0;
    assert.equal(cpu.setExecutionCondition(state => { checks++; return state.pc === 0x0201; }), true);

    assert.equal(cpu.cycle(), undefined);
    drain(cpu);
    assert.equal(cpu.watch().pc,0x0201);
    assert.equal(cpu.cycle(), true);
    assert.equal(cpu.watch().pc,0x0201);
    assert.ok(checks >= 2);

    assert.equal(cpu.cycle(), undefined);
    assert.equal(cpu.watch().pc,0x0202);
});

test('clearing a numeric trap does not disarm STEP TRACE condition', () => {
    const {cpu} = harness();
    cpu.setExecutionCondition(state => state.pc === 0x0201);
    cpu.setExecutionTrap(0x0300,() => true);
    cpu.clearExecutionTrap();
    assert.equal(cpu.hasExecutionCondition(),true);

    cpu.cycle();
    drain(cpu);
    assert.equal(cpu.cycle(),true);
    assert.equal(cpu.watch().pc,0x0201);
});

test('numeric trap and persistent condition coexist independently', () => {
    const {cpu} = harness();
    let numericHit = false;
    cpu.setExecutionTrap(0x0202,() => { numericHit = true; return true; });
    cpu.setExecutionCondition(state => state.pc === 0x0201);

    cpu.cycle();
    drain(cpu);
    assert.equal(cpu.cycle(),true);
    assert.equal(cpu.watch().pc,0x0201);

    cpu.cycle();
    drain(cpu);
    assert.equal(cpu.cycle(),true);
    assert.equal(numericHit,true);
    assert.equal(cpu.watch().pc,0x0202);
});

test('address-gated condition is checked only at the gated PC and remains armed after false', () => {
    const {cpu} = harness([0x4C,0x00,0x02]); // JMP $0200
    let checks = 0;
    assert.equal(cpu.setExecutionCondition(() => ++checks >= 2,0x0200),true);

    assert.equal(cpu.cycle(),undefined); // first gated check is false; JMP executes
    drain(cpu);
    assert.equal(cpu.watch().pc,0x0200);
    assert.equal(cpu.cycle(),true);      // second gated check stops before JMP
    assert.equal(checks,2);
    assert.equal(cpu.watch().pc,0x0200);
});

function fakeElement(initial)
{
    return Object.assign({
        value:'', textContent:'', disabled:false, title:'', style:{},
        setAttribute(){}, classList:{toggle(){}}
    },initial || {});
}

test('STEP TRACE BREAK IF uses a one-click Arm/Disarm toggle and can re-arm after editing', () => {
    let installed = null;
    const cpu = {
        watch(){ return {pc:0xC661,a:0,x:0,y:0,sp:0xFD,p:0x24,cycle_delay:0}; },
        setExecutionCondition(callback,address){ installed={callback,address}; return true; },
        clearExecutionCondition(callback){
            if(!installed || (callback && installed.callback!==callback)) return false;
            installed=null; return true;
        }
    };
    const hw = { safe_read(){ return 0; } };
    const elements = {
        cpuDbg_breakCond:fakeElement({value:'PC==$C65E'}),
        cpuDbg_breakArm:fakeElement({textContent:'Arm'})
    };
    const ctx = {
        console,
        oEMU:{component:{CPU:{}}},
        apple2plus:{cpuObj(){return cpu;},hwObj(){return hw;}},
        document:{activeElement:null,getElementById(id){return elements[id] || null;}},
        window:{setTimeout(){},clearTimeout(){}},
        oCOM:{getHexWord(v){return (v&0xFFFF).toString(16).toUpperCase().padStart(4,'0');}}
    };
    vm.createContext(ctx);
    vm.runInContext(debugSource,ctx);

    const dbg = ctx.oEMU.component.CPU.Apple2Debug;

    // oninput keeps the editor model current before the user clicks Arm.
    assert.equal(dbg.setBreakpointCondition(elements.cpuDbg_breakCond.value),'PC==$C65E');
    assert.equal(elements.cpuDbg_breakArm.textContent,'Arm');

    // One click arms; there is no intermediate Rearm state.
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),'PC==$C65E');
    assert.ok(installed);
    assert.equal(installed.address,0xC65E);
    assert.equal(elements.cpuDbg_breakArm.textContent,'Disarm');
    assert.equal(dbg.liveState().conditionalBreakpoint.armed,true);

    // Editing an armed condition immediately disarms the old predicate.
    elements.cpuDbg_breakCond.value = 'PC==$C665';
    assert.equal(dbg.setBreakpointCondition(elements.cpuDbg_breakCond.value),'PC==$C665');
    assert.equal(installed,null);
    assert.equal(elements.cpuDbg_breakArm.textContent,'Arm');
    assert.equal(dbg.liveState().conditionalBreakpoint.armed,false);

    // One click arms the edited condition; another disarms it; another re-arms.
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),'PC==$C665');
    assert.equal(installed.address,0xC665);
    assert.equal(elements.cpuDbg_breakArm.textContent,'Disarm');
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),true);
    assert.equal(installed,null);
    assert.equal(elements.cpuDbg_breakArm.textContent,'Arm');
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),'PC==$C665');
    assert.equal(installed.address,0xC665);
    assert.equal(elements.cpuDbg_breakArm.textContent,'Disarm');

    assert.match(debugSource,/oninput='oEMU\.component\.CPU\.Apple2Debug\.setBreakpointCondition\(this\.value\)'/);
    assert.doesNotMatch(debugSource,/id='cpuDbg_breakClear'/);
});


test('STEP TRACE uses parking icon instead of BP IF text when a conditional breakpoint hits', () => {
    assert.match(debugSource,/classList\.toggle\(\"fa-parking\",breakpointStop\)/);
    assert.match(debugSource,/conditionalBreakpoint\.hit = false;\n(?:\s*manualStepPause = false;\n)?\s*stopBoundaryAction\(\);/);
    assert.doesNotMatch(debugSource,/return \"  BP IF/);
});


test('STEP TRACE manual stepping uses pause-circle', () => {
    assert.match(debugSource,/var manualStepPause = false;/);
    assert.match(debugSource,/fa-pause-circle",running \|\| stepPause/);
    assert.match(debugSource,/this\.step = function\(\)[\s\S]*?manualStepPause = true;/);
    assert.match(debugSource,/this\.stepOver = function\(\)[\s\S]*?manualStepPause = true;/);
    assert.match(debugSource,/this\.stepOut = function\(\)[\s\S]*?manualStepPause = true;/);
});


test('STEP TRACE NAV exposes copyable PC/INS and keeps run status beside BREAK IF', () => {
    assert.match(debugSource,/INS \$\"\+instructionCounterText\(\)/);
    assert.match(debugSource,/padStart\(12,\"0\"\)\.slice\(-12\)/);
    assert.match(debugSource,/id='cpuDbg_navStatus' type='text' readonly/);
    assert.match(debugSource,/if\(el\.value!==navText\) el\.value = navText;/);

    const condPos = debugSource.indexOf("id='cpuDbg_breakCond'");
    const statusPos = debugSource.indexOf("id='cpuDbg_breakStatus'");
    const armPos = debugSource.indexOf("id='cpuDbg_breakArm'");
    assert.ok(condPos >= 0 && condPos < statusPos && statusPos < armPos);
    assert.ok(debugSource.includes('status.style.display = statusText ? "" : "none";'));
});



test('STEP TRACE closed-loop skipper bypasses fixed IPS delay after loop proof', () => {
    assert.match(debugSource,/var closedLoopSkipBatch = 1024;/);
    assert.match(debugSource,/executionBatch = skippingClosedLoop \? closedLoopSkipBatch : cfg\.batch/);
    assert.match(debugSource,/if\(closedLoopSkipperActive\(\)\)[\s\S]*?scheduleFixedRun\(0\);/);
    assert.match(debugSource,/if\(closedLoopSkipperActive\(\)\)[\s\S]*?scheduleBoundaryAction\(0\);/);
    assert.match(debugSource,/toggleClosedLoopSkip\(\)/);
    assert.match(debugSource,/"skipClosedLoops":!showLoopSteps/);
});

test('STEP TRACE BREAK IF accepts the 48-bit INS instruction counter', () => {
    let installed = null;
    const cpu = {
        watch(){ return {pc:0xC665,a:0,x:0,y:0,sp:0xFD,p:0x24,cycle_delay:0,ic:0x0000000D56FF}; },
        setExecutionCondition(callback,address){ installed={callback,address}; return true; },
        clearExecutionCondition(callback){
            if(!installed || (callback && installed.callback!==callback)) return false;
            installed=null; return true;
        }
    };
    const hw = { safe_read(){ return 0; } };
    const elements = {
        cpuDbg_breakCond:fakeElement({value:'INS==$0000000D5700'}),
        cpuDbg_breakArm:fakeElement({textContent:'Arm'}),
        cpuDbg_play:fakeElement()
    };
    const ctx = {
        console,
        oEMU:{component:{CPU:{}}},
        apple2plus:{cpuObj(){return cpu;},hwObj(){return hw;}},
        document:{activeElement:null,getElementById(id){return elements[id] || null;}},
        window:{setTimeout(){},clearTimeout(){}},
        oCOM:{getHexWord(v){return (v&0xFFFF).toString(16).toUpperCase().padStart(4,'0');}}
    };
    vm.createContext(ctx);
    vm.runInContext(debugSource,ctx);

    const dbg = ctx.oEMU.component.CPU.Apple2Debug;
    assert.equal(dbg.setBreakpointCondition(elements.cpuDbg_breakCond.value),'INS==$0000000D5700');
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),'INS==$0000000D5700');
    assert.ok(installed);
    assert.equal(installed.address,null);

    assert.equal(installed.callback({pc:0xC665,a:0,x:0,y:0,sp:0xFD,p:0x24,cycle_delay:0,ic:0x0000000D56FF}),false);
    assert.equal(dbg.liveState().conditionalBreakpoint.armed,true);

    assert.equal(installed.callback({pc:0xC665,a:0,x:0,y:0,sp:0xFD,p:0x24,cycle_delay:0,ic:0x0000000D5700}),true);
    assert.equal(dbg.liveState().conditionalBreakpoint.hit,true);
    assert.equal(dbg.liveState().conditionalBreakpoint.armed,false);
});

function stepTraceHarness(condition='PC==$0201')
{
    let installed = null;
    const cpu = {
        watch(){ return {pc:0x0201,a:0x11,x:0x22,y:0x33,sp:0xF8,p:0xA5,cycle_delay:0,ic:7}; },
        setExecutionCondition(callback,address){ installed={callback,address}; return true; },
        clearExecutionCondition(callback){
            if(!installed || (callback && installed.callback!==callback)) return false;
            installed=null; return true;
        }
    };
    const hw = {safe_read(){ return 0; }};
    const elements = {
        cpuDbg_breakCond:fakeElement({value:condition}),
        cpuDbg_breakArm:fakeElement({textContent:'Arm'}),
        cpuDbg_play:fakeElement()
    };
    const ctx = {
        console,
        oEMU:{component:{CPU:{}}},
        apple2plus:{cpuObj(){return cpu;},hwObj(){return hw;}},
        document:{activeElement:null,getElementById(id){return elements[id] || null;}},
        window:{setTimeout(){},clearTimeout(){},clearInterval(){}},
        oCOM:{getHexWord(v){return (v&0xFFFF).toString(16).toUpperCase().padStart(4,'0');}}
    };
    vm.createContext(ctx);
    vm.runInContext(debugSource,ctx);
    const dbg=ctx.oEMU.component.CPU.Apple2Debug;
    assert.equal(dbg.setBreakpointCondition(condition),condition);
    assert.equal(dbg.toggleConditionalBreakpointFromInput(),condition);
    return {dbg,cpu,elements,get installed(){return installed;}};
}

test('STEP TRACE RUN action executes synchronously at the matching boundary and continues', () => {
    const h=stepTraceHarness();
    let seen=null;
    assert.equal(h.dbg.setBreakpointActionHandler(bp => { seen=bp; }),true);
    const state={pc:0x0201,a:0x11,x:0x22,y:0x33,sp:0xF8,p:0xA5,ic:7};
    assert.equal(h.installed.callback(state),false);
    assert.deepEqual(JSON.parse(JSON.stringify(seen)),{
        A:0x11,X:0x22,Y:0x33,SP:0xF8,P:0xA5,PC:0x0201,INS:7,
        condition:'PC==$0201',hit:1
    });
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hit,false);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.armed,true);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hits,1);
});

test('STEP TRACE RUN action stays armed across repeated breakpoint matches', () => {
    const h=stepTraceHarness();
    let hits=0;
    h.dbg.setBreakpointActionHandler(() => { hits++; });
    const state={pc:0x0201,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1};
    assert.equal(h.installed.callback(state),false);
    assert.equal(h.installed.callback({...state,ic:2}),false);
    assert.equal(hits,2);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hits,2);
    assert.equal(h.dbg.breakpointActionState().active,true);
});

test('STEP TRACE RUN action can turn the current match into an ordinary halt', () => {
    const h=stepTraceHarness();
    h.dbg.setBreakpointActionHandler(() => ({halt:true}));
    assert.equal(h.installed.callback({pc:0x0201,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1}),true);
    assert.equal(h.dbg.breakpointActionState().active,false);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hit,true);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.armed,false);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hits,1);
});

test('STEP TRACE RUN action exceptions fail safe to the same breakpoint halt', () => {
    const h=stepTraceHarness();
    h.dbg.setBreakpointActionHandler(() => { throw new Error('boom'); });
    assert.equal(h.installed.callback({pc:0x0201,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1}),true);
    assert.equal(h.dbg.breakpointActionState().active,false);
    assert.match(h.dbg.breakpointActionState().lastError,/boom/);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hit,true);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.armed,false);
});


test('STEP TRACE RUN action rejects async callbacks and halts safely', () => {
    const h=stepTraceHarness();
    h.dbg.setBreakpointActionHandler(() => Promise.resolve());
    assert.equal(h.installed.callback({pc:0x0201,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1}),true);
    assert.equal(h.dbg.breakpointActionState().active,false);
    assert.match(h.dbg.breakpointActionState().lastError,/Async breakpoint actions/);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hit,true);
});

test('STEP TRACE RUN action rejects re-entrant breakpoint dispatch and halts safely', () => {
    const h=stepTraceHarness();
    const state={pc:0x0201,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1};
    let calls=0;
    let nestedResult=null;
    h.dbg.setBreakpointActionHandler(() => {
        calls++;
        if(calls===1) nestedResult=h.installed.callback(state);
    });
    assert.equal(h.installed.callback(state),true);
    assert.equal(nestedResult,true);
    assert.equal(calls,1);
    assert.equal(h.dbg.breakpointActionState().active,false);
    assert.match(h.dbg.breakpointActionState().lastError,/Re-entrant/);
    assert.equal(h.dbg.liveState().conditionalBreakpoint.hit,true);
});

test('STEP TRACE exposes case-insensitive defensive lookup over its loaded labels and EQU symbols', () => {
    const h=stepTraceHarness();
    h.dbg.loadSymbolsText(JSON.stringify({format:'RetroAppleJS-ASM-symbols',symbols:[
        {type:'label',name:'inflate_test_loop',value:'$0D10'},
        {type:'equ',name:'inputPointer',value:'$00F0'}
    ]}),'inflate.symbols.json');
    assert.equal(h.dbg.resolveSymbol('INFLATE_TEST_LOOP'),0x0D10);
    assert.equal(h.dbg.resolveSymbol('inputpointer'),0x00F0);
    assert.equal(h.dbg.resolveSymbol('missing'),null);
    assert.deepEqual(JSON.parse(JSON.stringify(h.dbg.symbol('inputPointer'))),{name:'inputPointer',value:0x00F0,type:'equ'});
    const symbols=h.dbg.symbols();
    assert.equal(symbols.length,2);
    symbols[0].name='mutated';
    assert.equal(h.dbg.symbols().some(s => s.name==='mutated'),false);
});

test('STEP TRACE loaded symbol replacement is atomic and does not fall back to assembler symbols', () => {
    const h=stepTraceHarness();
    h.dbg.loadSymbolsText(JSON.stringify({symbols:[{type:'label',name:'FIRST',value:'$1234'}]}),'a.json');
    assert.equal(h.dbg.resolveSymbol('first'),0x1234);
    h.dbg.loadSymbolsText(JSON.stringify({symbols:[{type:'equ',name:'SECOND',value:'$2345'}]}),'b.json');
    assert.equal(h.dbg.resolveSymbol('first'),null);
    assert.equal(h.dbg.resolveSymbol('second'),0x2345);
});

test('STEP TRACE BREAK IF resolves loaded symbols from the same symbol table', () => {
    const h=stepTraceHarness();
    h.dbg.clearConditionalBreakpoint();
    h.dbg.loadSymbolsText(JSON.stringify({symbols:[
        {type:'label',name:'inflate_test_loop',value:'$0D10'},
        {type:'label',name:'inflate_test_done',value:'$0D13'}
    ]}),'inflate.json');
    const cond='PC==inflate_test_loop || PC==inflate_test_done';
    assert.equal(h.dbg.setBreakpointCondition(cond),cond);
    assert.equal(h.dbg.toggleConditionalBreakpointFromInput(),cond);
    assert.ok(h.installed);
    assert.equal(h.installed.address,null);
    assert.equal(h.installed.callback({pc:0x0D10,a:0,x:0,y:0,sp:0xff,p:0x20,ic:1}),true);
});


test('closing STEP TRACE clears any invisible breakpoint action handler', () => {
    const h=stepTraceHarness();
    h.dbg.setBreakpointActionHandler(() => {});
    assert.equal(h.dbg.breakpointActionState().active,true);
    h.dbg.close();
    assert.equal(h.dbg.breakpointActionState().active,false);
});
