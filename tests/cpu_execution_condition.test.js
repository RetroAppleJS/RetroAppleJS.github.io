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


test('STEP TRACE NAV shows the 48-bit instruction counter next to PC', () => {
    assert.match(debugSource,/INS \$\"\+instructionCounterText\(\)/);
    assert.match(debugSource,/padStart\(12,\"0\"\)\.slice\(-12\)/);
});
