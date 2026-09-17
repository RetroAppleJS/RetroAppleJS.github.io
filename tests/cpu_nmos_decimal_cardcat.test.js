'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cpuSource = fs.readFileSync(path.join(__dirname,'..','res','EMU_cpu6502.js'),'utf8');
const cpuContext = { console:{ log(){}, warn(){}, error(){} } };
vm.createContext(cpuContext);
vm.runInContext(cpuSource,cpuContext);

const P_N = 0x80;
const P_V = 0x40;
const P_D = 0x08;
const P_Z = 0x02;
const P_C = 0x01;

function harness(program)
{
    const mem = new Uint8Array(0x10000);
    mem.set(program,0x0200);
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

function executeInstruction(cpu)
{
    assert.equal(cpu.watch().cycle_delay,0,'instruction must start at a clean boundary');
    cpu.cycle();
    const executed = cpu.watch();
    while(cpu.watch().cycle_delay > 0) cpu.cycle();
    return executed;
}

test('Card Cat decimal probe identifies RetroAppleJS as an NMOS 6502', () => {
    // Card Cat CPU probe:
    //   SED
    //   LDA #$99
    //   CLC
    //   ADC #$01
    //   CLD
    //   BNE nmos6502
    //
    // On NMOS 6502, decimal ADC produces A=$00 but N/Z reflect the
    // pre-correction binary result $9A: N=1, Z=0. A 65C02 instead sets
    // N/Z from the corrected BCD result $00 and therefore does not branch.
    const {cpu} = harness([
        0xF8,             // $0200 SED
        0xA9,0x99,        // $0201 LDA #$99
        0x18,             // $0203 CLC
        0x69,0x01,        // $0204 ADC #$01
        0xD8,             // $0206 CLD
        0xD0,0x02,        // $0207 BNE $020B -- NMOS path
        0xA9,0xC0,        // $0209 65C02 path marker
        0xA9,0x65,        // $020B NMOS 6502 path marker
        0xEA              // $020D NOP
    ]);

    executeInstruction(cpu); // SED
    executeInstruction(cpu); // LDA #$99
    executeInstruction(cpu); // CLC
    const afterAdc = executeInstruction(cpu); // ADC #$01

    assert.equal(afterAdc.a,0x00,'BCD $99 + $01 must produce A=$00');
    assert.equal(afterAdc.p,0xAD,'NMOS status after decimal ADC should be N=1 V=0 D=1 Z=0 C=1');
    assert.equal(afterAdc.p & (P_N|P_V|P_D|P_Z|P_C),P_N|P_D|P_C);
    assert.equal(afterAdc.cycle_delay,1,'NMOS decimal ADC #imm remains a 2-cycle instruction');

    const afterCld = executeInstruction(cpu); // CLD
    assert.equal(afterCld.p,0xA5,'CLD clears only D; N=1 Z=0 C=1 must survive for the detector');

    const afterBne = executeInstruction(cpu); // BNE $020B
    assert.equal(afterBne.pc,0x020B,'BNE must take the NMOS 6502 path because Z is clear');

    executeInstruction(cpu); // LDA #$65 marker
    assert.equal(cpu.watch().a,0x65,'NMOS 6502 path marker should execute');
});
