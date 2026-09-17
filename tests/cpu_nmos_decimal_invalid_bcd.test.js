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
const P_1 = 0x20;
const P_D = 0x08;
const P_I = 0x04;
const P_Z = 0x02;
const P_C = 0x01;
const P_BASE = P_1 | P_D | P_I;

function harness(opcode)
{
    const mem = new Uint8Array(0x10000);
    mem.set([opcode,0x00,0xEA],0x0200); // ADC/SBC #operand; NOP
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

function isValidBcdByte(v)
{
    return (v & 0x0F) <= 9 && ((v >>> 4) & 0x0F) <= 9;
}

function hex2(v)
{
    return '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2,'0');
}

// NMOS 6502 decimal ADC reference for every possible input byte, including
// invalid BCD digits A-F. This follows the transistor-era nibble correction:
// each nibble is corrected at most once; invalid digits are NOT first mapped
// into a decimal 0..99 value. N/V use the pre-high-adjust intermediate, Z the
// raw binary sum, and C the high-nibble decimal correction carry.
function referenceInvalidAdc(a,b,carryIn)
{
    const binary = (a + b + carryIn) & 0xFF;

    let low = (a & 0x0F) + (b & 0x0F) + carryIn;
    let carry = low > 9;
    if(carry)
        low = (low - 10) & 0x0F;

    let high = (a >>> 4) + (b >>> 4) + (carry ? 1 : 0);
    const nv = (high & 0x08) !== 0;
    carry = high > 9;
    if(carry)
        high = (high - 10) & 0x0F;

    const result = ((high << 4) | low) & 0xFF;
    let p = P_BASE;
    if(nv) p |= P_N;
    if(((a >= 0x80) !== nv) && ((b >= 0x80) !== nv)) p |= P_V;
    if(binary === 0) p |= P_Z;
    if(carry) p |= P_C;

    return {a:result,p};
}

// NMOS 6502 decimal SBC reference for every possible input byte. N/V/Z come
// from the unadjusted binary subtraction. Decimal correction is borrow-driven:
// a borrowed nibble gets +10 once, which is significant for invalid digits.
function referenceInvalidSbc(a,b,carryIn)
{
    const borrowIn = carryIn ? 0 : 1;
    const binary = (a - b - borrowIn) & 0xFF;
    const nv = (binary & 0x80) !== 0;

    let low = (a & 0x0F) - (b & 0x0F) - borrowIn;
    let borrow = low < 0;
    if(borrow)
        low = (low + 10) & 0x0F;
    else
        low &= 0x0F;

    let high = (a >>> 4) - (b >>> 4) - (borrow ? 1 : 0);
    borrow = high < 0;
    if(borrow)
        high = (high + 10) & 0x0F;
    else
        high &= 0x0F;

    const result = ((high << 4) | low) & 0xFF;
    let p = P_BASE;
    if(nv) p |= P_N;
    if(((a >= 0x80) !== nv) && ((b < 0x80) !== nv)) p |= P_V;
    if(binary === 0) p |= P_Z;
    if(!borrow) p |= P_C;

    return {a:result,p};
}

function failMismatch(op,a,b,carryIn,actual,expected)
{
    const actualCycles = (actual.cycle_delay | 0) + 1;
    assert.fail(
        `${op} A=${hex2(a)} M=${hex2(b)} C=${carryIn}: ` +
        `expected A=${hex2(expected.a)} P=${hex2(expected.p)} cycles=2, ` +
        `got A=${hex2(actual.a)} P=${hex2(actual.p)} cycles=${actualCycles}`
    );
}

function runInvalidSpace(opcode,op,reference)
{
    const {cpu,mem} = harness(opcode);
    let cases = 0;

    for(let a=0;a<=0xFF;a++)
    {
        const aValid = isValidBcdByte(a);
        for(let b=0;b<=0xFF;b++)
        {
            // Valid/valid pairs are covered exhaustively in the companion test.
            if(aValid && isValidBcdByte(b))
                continue;

            mem[0x0201] = b;
            for(let carryIn=0;carryIn<=1;carryIn++)
            {
                cpu.setState({
                    a,
                    p:P_BASE | (carryIn ? P_C : 0),
                    pc:0x0200,
                    cycle_delay:0
                });

                cpu.cycle();
                const actual = cpu.watch();
                const expected = reference(a,b,carryIn);

                if(actual.a !== expected.a ||
                   actual.p !== expected.p ||
                   actual.cycle_delay !== 1)
                    failMismatch(op,a,b,carryIn,actual,expected);

                cases++;
            }
        }
    }

    // 256^2 total byte pairs - 100^2 valid/valid pairs, times two carry states.
    assert.equal(cases,111072,'all pairs containing at least one invalid BCD byte, with C=0/1');
}

test('exhaustive NMOS decimal ADC covers every invalid BCD nibble and carry-in state', () => {
    runInvalidSpace(0x69,'ADC',referenceInvalidAdc);
});

test('exhaustive NMOS decimal SBC covers every invalid BCD nibble and carry-in state', () => {
    runInvalidSpace(0xE9,'SBC',referenceInvalidSbc);
});
