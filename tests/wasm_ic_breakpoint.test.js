'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const IC_MODULO = 0x1000000000000; // 2^48
const WASM_SOURCE = fs.readFileSync(
    path.join(__dirname, '..', 'res', 'EMU_WASMcpu6502.js'),
    'utf8'
);

function element(initial)
{
    return Object.assign({
        value:'', checked:false, disabled:false, hidden:false,
        textContent:'', innerHTML:'', className:'', title:'',
        style:{},
        getAttribute:function(){return null;},
        setAttribute:function(){},
        removeAttribute:function(){}
    }, initial || {});
}

function icHex(value)
{
    value=((Number(value)%IC_MODULO)+IC_MODULO)%IC_MODULO;
    return '$'+value.toString(16).toUpperCase().padStart(12,'0');
}

function createHarness(options)
{
    options=options||{};

    const elements=new Map();
    elements.set('wasm_status',element());
    elements.set('wasm_start',element({value:options.engage||''}));
    elements.set('wasm_stop',element({value:''}));
    // Keep a deliberately huge normal chunk. Tests that stop after two
    // instructions therefore exercise the breakpoint's final-chunk cap.
    elements.set('wasm_chunk',element({value:'50'}));
    elements.set('wasm_limit',element({value:'0'}));
    elements.set('wasm_break_ic',element());
    elements.set('wasm_break_ic_clear',element());
    elements.set('wasm_break_ic_state',element());
    elements.set('wasm_cur_ic',element());

    const document={
        activeElement:null,
        getElementById:function(id){return elements.get(id)||null;},
        body:{appendChild:function(){},removeChild:function(){}}
    };

    const ram=new Uint8Array(0x10000);
    ram.fill(0xEA); // 6502 NOP

    const cpuState={
        pc:options.pc===undefined?0x0200:options.pc,
        a:0,x:0,y:0,sp:0xFD,p:0x24,cycle_delay:0,
        ic:options.ic===undefined?0:options.ic
    };

    let executionTrap=null;
    const cpu={
        watch:function(){return Object.assign({},cpuState);},
        setState:function(state){Object.assign(cpuState,state);},
        setExecutionTrap:function(addr,callback)
        {
            executionTrap={address:addr&0xFFFF,callback:callback};
            return executionTrap.address;
        },
        clearExecutionTrap:function(){executionTrap=null;}
    };

    const hw={
        safe_flashdump:function(){return ram.slice(0,0xC000);},
        safe_dump:function(start,end){return ram.slice(start,end+1);},
        load_ram64k:function(bytes){ram.set(bytes.subarray(0,0x10000));},
        WR:new Array(256).fill(function(){}),
        lineDecode:function(addr){return (addr>>>8)&0xFF;}
    };

    const pauseStates=[];
    let popupCloseCount=0;
    const errors=[];

    const context={
        console:{
            log:console.log.bind(console),
            warn:console.warn.bind(console),
            error:function(){errors.push(Array.from(arguments).map(String).join(' '));}
        },
        WebAssembly:WebAssembly,
        Uint8Array:Uint8Array,
        ArrayBuffer:ArrayBuffer,
        atob:function(s){return Buffer.from(s,'base64').toString('binary');},
        btoa:function(s){return Buffer.from(s,'binary').toString('base64');},
        setTimeout:setTimeout,
        clearTimeout:clearTimeout,
        performance:performance,
        document:document,
        oEMUI:{pauseBtn:function(opts){pauseStates.push(!!opts.pause);}},
        oCOM:{POPUP:{set_state:function(){},off:function(){popupCloseCount++;}}},
        apple2plus:{
            cpuObj:function(){return cpu;},
            hwObj:function(){return hw;},
            vidObj:function(){return {getActiveRenderer:function(){return {redraw:function(){}};}};},
            CPU_pace_reset:function(){}
        }
    };

    vm.createContext(context);
    vm.runInContext(WASM_SOURCE,context,{filename:'res/EMU_WASMcpu6502.js'});

    return {
        api:context.oEMU.component.CPU.WASM6502,
        cpuState:cpuState,
        status:elements.get('wasm_status'),
        pauseStates:pauseStates,
        errors:errors,
        get executionTrap(){return executionTrap;},
        get popupCloseCount(){return popupCloseCount;}
    };
}

async function waitFor(predicate,message,timeoutMs)
{
    const deadline=Date.now()+(timeoutMs||4000);
    while(Date.now()<deadline)
    {
        if(predicate()) return;
        await new Promise(function(resolve){setTimeout(resolve,5);});
    }
    assert.fail(message);
}

test('IC breakpoint lands exactly just before 48-bit wrap, inside a large WASM chunk', async function()
{
    const h=createHarness({ic:IC_MODULO-3,pc:0x0200});
    h.api.open();

    assert.equal(h.api.setInstructionBreakpoint(icHex(IC_MODULO-1)),IC_MODULO-1);
    h.api.play();

    await waitFor(
        function(){return h.cpuState.ic===IC_MODULO-1 && h.api.getState().breakArmed===false;},
        'WASM did not stop at the pre-wrap IC breakpoint'
    );

    assert.equal(h.api.getState().instructions,2,'final 50M chunk must be capped to two instructions');
    assert.equal(h.cpuState.pc,0x0202,'handoff PC must be the next opcode after exactly two NOPs');
    assert.equal(h.pauseStates.at(-1),true,'IC breakpoint handoff must leave JavaScript paused');
    assert.equal(h.popupCloseCount,0,'breakpoint handoff must keep the WASM panel open');
    assert.match(h.status.textContent,/JavaScript CPU remains paused/);
});

test('IC breakpoint lands exactly on a low target just after 48-bit wrap', async function()
{
    // IC has already wrapped. A low absolute target that is still numerically
    // ahead must behave exactly like any other target and must not be confused
    // with a stale pre-wrap count.
    const h=createHarness({ic:1,pc:0x0300});
    h.api.open();

    assert.equal(h.api.setInstructionBreakpoint('$000000000003'),3);
    h.api.play();

    await waitFor(
        function(){return h.cpuState.ic===3 && h.api.getState().breakArmed===false;},
        'WASM did not stop at the post-wrap IC breakpoint'
    );

    assert.equal(h.api.getState().instructions,2);
    assert.equal(h.cpuState.pc,0x0302);
    assert.equal(h.pauseStates.at(-1),true);
});

test('ordinary numerically-behind IC target remains rejected instead of meaning next wrap', function()
{
    const h=createHarness({ic:IC_MODULO-2});
    h.api.open();

    assert.equal(h.api.setInstructionBreakpoint('$000000000002'),false);
    assert.equal(h.api.getState().breakArmed,false);
    assert.equal(h.api.getState().breakIC,null);
    assert.match(h.status.textContent,/already passed current IC/);
});

test('breakpoint passed during JavaScript-to-WASM handoff is detected across 48-bit rollover', async function()
{
    const armIC=IC_MODULO-8;
    const target=IC_MODULO-4;
    const h=createHarness({ic:armIC,pc:0x0200,engage:'0300'});
    h.api.open();

    assert.equal(h.api.setInstructionBreakpoint(icHex(target)),target);
    h.api.play();

    assert.equal(h.api.getState().phase,'armed');
    assert.equal(h.api.getState().breakArmIC,armIC);
    assert.ok(h.executionTrap,'Engage address should arm a JavaScript execution trap');
    assert.equal(h.executionTrap.address,0x0300);

    // Simulate JavaScript running four instructions to the target, then seven
    // more instructions through $FFFFFFFFFFFF -> $000000000000 before the
    // Engage PC is reached. Numerically the handoff IC is now lower than the
    // target, so only arm-IC + modular-distance tracking can detect the pass.
    h.cpuState.ic=3;
    h.cpuState.pc=0x0300;
    assert.equal(h.executionTrap.callback(h.cpuState),true);

    await waitFor(
        function(){return /already passed/.test(h.status.textContent);},
        'handoff did not reject the IC breakpoint passed across rollover'
    );

    assert.equal(h.api.getState().instructions,0,'WASM must not execute after detecting a passed target');
    assert.equal(h.cpuState.ic,3,'failed handoff must not alter the live JavaScript IC');
    assert.match(h.status.textContent,/Break IC \$FFFFFFFFFFFC already passed/);
    assert.ok(h.errors.some(function(line){return /already passed/.test(line);}),
        'handoff failure should be surfaced through the accelerator error path');
});
