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
const P_I = 0x04;
const P_Z = 0x02;
const P_C = 0x01;
const P_1 = 0x20;

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

function runDecimalImmediate(opcode,a,operand,carryIn)
{
    const {cpu} = harness([
        0xF8,                   // SED
        0xA9,a & 0xFF,          // LDA #a
        carryIn ? 0x38 : 0x18,  // SEC / CLC
        opcode,operand & 0xFF,  // ADC/SBC #operand
        0xEA                    // NOP
    ]);

    executeInstruction(cpu); // SED
    executeInstruction(cpu); // LDA
    executeInstruction(cpu); // SEC/CLC
    return executeInstruction(cpu);
}

function bcdValues()
{
    const values = [];
    for(let tens=0;tens<10;tens++)
        for(let ones=0;ones<10;ones++)
            values.push((tens << 4) | ones);
    return values;
}

function bcdToInt(v)
{
    return ((v >>> 4) * 10) + (v & 0x0F);
}

function intToBcd(v)
{
    v = ((v % 100) + 100) % 100;
    return ((Math.floor(v / 10) << 4) | (v % 10)) & 0xFF;
}

// Independent NMOS reference model for valid packed-BCD operands.
// Result/C come from decimal arithmetic. Z comes from the raw binary sum.
// N/V come from the NMOS pre-high-adjust intermediate after the low digit
// has been decimal-corrected, which is the non-CMOS behavior we protect.
function referenceDecimalAdc(a,b,carryIn)
{
    const binary = a + b + carryIn;

    let low = (a & 0x0F) + (b & 0x0F) + carryIn;
    if(low >= 0x0A)
        low = ((low + 0x06) & 0x0F) + 0x10;

    const preHighAdjust = (a & 0xF0) + (b & 0xF0) + low;
    const decimal = bcdToInt(a) + bcdToInt(b) + carryIn;
    const result = intToBcd(decimal);

    let p = P_1 | P_I | P_D;
    if(preHighAdjust & 0x80) p |= P_N;
    if((~(a ^ b) & (a ^ preHighAdjust) & 0x80) !== 0) p |= P_V;
    if((binary & 0xFF) === 0) p |= P_Z;
    if(decimal >= 100) p |= P_C;

    return {a:result,p};
}

// For NMOS SBC, N/V/Z are those of the unadjusted binary subtraction while
// result/C follow decimal subtraction. This deliberately does not reproduce
// the emulator's nibble-by-nibble implementation.
function referenceDecimalSbc(a,b,carryIn)
{
    const borrowIn = carryIn ? 0 : 1;
    const binaryWide = a - b - borrowIn;
    const binary = binaryWide & 0xFF;
    const decimal = bcdToInt(a) - bcdToInt(b) - borrowIn;
    const result = intToBcd(decimal);

    let p = P_1 | P_I | P_D;
    if(binary & 0x80) p |= P_N;
    if(((a ^ b) & (a ^ binary) & 0x80) !== 0) p |= P_V;
    if(binary === 0) p |= P_Z;
    if(decimal >= 0) p |= P_C;

    return {a:result,p};
}

function hex2(v)
{
    return '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2,'0');
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

test('NMOS decimal SBC preserves binary-derived N/Z flags and 2-cycle immediate timing', () => {
    // Matching NMOS-vs-CMOS decimal subtraction probe:
    //   SED
    //   LDA #$00
    //   SEC
    //   SBC #$50
    //   CLD
    //   BMI nmos6502
    //
    // Decimal result is $50 with a borrow (C=0), but the unadjusted binary
    // result is $B0. NMOS 6502 therefore leaves N=1 from the binary result,
    // while a 65C02 derives N from the corrected BCD result $50 and gets N=0.
    const {cpu} = harness([
        0xF8,             // $0200 SED
        0xA9,0x00,        // $0201 LDA #$00
        0x38,             // $0203 SEC
        0xE9,0x50,        // $0204 SBC #$50
        0xD8,             // $0206 CLD
        0x30,0x02,        // $0207 BMI $020B -- NMOS path
        0xA9,0xC0,        // $0209 65C02 path marker
        0xA9,0x65,        // $020B NMOS 6502 path marker
        0xEA              // $020D NOP
    ]);

    executeInstruction(cpu); // SED
    executeInstruction(cpu); // LDA #$00
    executeInstruction(cpu); // SEC
    const afterSbc = executeInstruction(cpu); // SBC #$50

    assert.equal(afterSbc.a,0x50,'BCD $00 - $50 must produce A=$50 with borrow');
    assert.equal(afterSbc.p,0xAC,'NMOS status after decimal SBC should be N=1 V=0 D=1 Z=0 C=0');
    assert.equal(afterSbc.p & (P_N|P_V|P_D|P_Z|P_C),P_N|P_D);
    assert.equal(afterSbc.cycle_delay,1,'NMOS decimal SBC #imm remains a 2-cycle instruction');

    const afterCld = executeInstruction(cpu); // CLD
    assert.equal(afterCld.p,0xA4,'CLD clears only D; N=1 Z=0 C=0 must survive for the detector');

    const afterBmi = executeInstruction(cpu); // BMI $020B
    assert.equal(afterBmi.pc,0x020B,'BMI must take the NMOS 6502 path because N is set');

    executeInstruction(cpu); // LDA #$65 marker
    assert.equal(cpu.watch().a,0x65,'NMOS 6502 SBC path marker should execute');
});

test('NMOS decimal ADC edge vectors preserve pre-correction flags and decimal carry', () => {
    const vectors = [
        {
            name:'Z follows wrapped binary sum even when corrected BCD result is non-zero',
            a:0x70, operand:0x90, carryIn:0,
            result:0x60, p:0x2F
        },
        {
            name:'decimal carry and signed overflow set even though binary sum has no carry out',
            a:0x50, operand:0x50, carryIn:0,
            result:0x00, p:0xED
        },
        {
            name:'N remains set from the pre-correction high nibble when corrected result is zero',
            a:0x99, operand:0x01, carryIn:0,
            result:0x00, p:0xAD
        },
        {
            name:'opposite binary signs keep V clear across a decimal carry',
            a:0x90, operand:0x10, carryIn:0,
            result:0x00, p:0xAD
        }
    ];

    for(const v of vectors)
    {
        const state = runDecimalImmediate(0x69,v.a,v.operand,v.carryIn);
        assert.equal(state.a,v.result,`${v.name}: accumulator`);
        assert.equal(state.p,v.p,`${v.name}: processor flags`);
        assert.equal(state.cycle_delay,1,`${v.name}: NMOS ADC #imm must remain 2 cycles`);
    }
});

test('NMOS decimal SBC edge vectors preserve binary flags and inverse-borrow carry', () => {
    const vectors = [
        {
            name:'Z remains clear when BCD correction turns a non-zero binary difference into zero',
            a:0x10, operand:0x09, carryIn:0,
            result:0x00, p:0x2D
        },
        {
            name:'borrow clears C and wraps the decimal result',
            a:0x00, operand:0x01, carryIn:1,
            result:0x99, p:0xAC
        },
        {
            name:'N follows binary difference even when corrected BCD result is positive',
            a:0x00, operand:0x50, carryIn:1,
            result:0x50, p:0xAC
        },
        {
            name:'positive-direction signed overflow sets V without borrow',
            a:0x80, operand:0x01, carryIn:1,
            result:0x79, p:0x6D
        },
        {
            name:'negative-direction signed overflow sets V while decimal borrow clears C',
            a:0x00, operand:0x80, carryIn:1,
            result:0x20, p:0xEC
        }
    ];

    for(const v of vectors)
    {
        const state = runDecimalImmediate(0xE9,v.a,v.operand,v.carryIn);
        assert.equal(state.a,v.result,`${v.name}: accumulator`);
        assert.equal(state.p,v.p,`${v.name}: processor flags`);
        assert.equal(state.cycle_delay,1,`${v.name}: NMOS SBC #imm must remain 2 cycles`);
    }
});

test('exhaustive NMOS decimal ADC covers every valid BCD pair and both carry-in states', () => {
    const values = bcdValues();
    const {cpu,mem} = harness([0x69,0x00,0xEA]); // ADC #operand
    let cases = 0;

    for(const a of values)
    {
        for(const b of values)
        {
            for(let carryIn=0;carryIn<=1;carryIn++)
            {
                mem[0x0201] = b;
                cpu.setState({
                    a,
                    p:P_1 | P_I | P_D | (carryIn ? P_C : 0),
                    pc:0x0200,
                    cycle_delay:0
                });

                const actual = executeInstruction(cpu);
                const expected = referenceDecimalAdc(a,b,carryIn);
                const label = `ADC A=${hex2(a)} M=${hex2(b)} C=${carryIn}`;

                assert.equal(actual.a,expected.a,`${label}: accumulator`);
                assert.equal(actual.p,expected.p,`${label}: N/V/Z/C flags`);
                assert.equal(actual.cycle_delay,1,`${label}: immediate timing must be 2 cycles`);
                cases++;
            }
        }
    }

    assert.equal(cases,20000,'100 x 100 BCD pairs x 2 carry-in states');
});

test('exhaustive NMOS decimal SBC covers every valid BCD pair and both carry-in states', () => {
    const values = bcdValues();
    const {cpu,mem} = harness([0xE9,0x00,0xEA]); // SBC #operand
    let cases = 0;

    for(const a of values)
    {
        for(const b of values)
        {
            for(let carryIn=0;carryIn<=1;carryIn++)
            {
                mem[0x0201] = b;
                cpu.setState({
                    a,
                    p:P_1 | P_I | P_D | (carryIn ? P_C : 0),
                    pc:0x0200,
                    cycle_delay:0
                });

                const actual = executeInstruction(cpu);
                const expected = referenceDecimalSbc(a,b,carryIn);
                const label = `SBC A=${hex2(a)} M=${hex2(b)} C=${carryIn}`;

                assert.equal(actual.a,expected.a,`${label}: accumulator`);
                assert.equal(actual.p,expected.p,`${label}: N/V/Z/C flags`);
                assert.equal(actual.cycle_delay,1,`${label}: immediate timing must be 2 cycles`);
                cases++;
            }
        }
    }

    assert.equal(cases,20000,'100 x 100 BCD pairs x 2 carry-in states');
});
