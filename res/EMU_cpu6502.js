// 2022 adaptations by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// Thanks to Thomas Skibo - Copyright (c) 2014.
// cpu6502.js

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"6502":new Cpu6502()}}}
else oEMU.component.CPU["6502"] = new Cpu6502();

function Cpu6502(hwobj)
{
    // 6502 reserved addresses.
    var STACK_ADDR =    0x0100
       ,NMI_VECTOR =    0xfffa
       ,RESET_VECTOR =  0xfffc
       ,IRQ_VECTOR =    0xfffe;

    // Processor status flags.
    var P_N =   0x80,
        P_V =   0x40,
        P_1 =   0x20,   // always set
        P_B =   0x10,
        P_D =   0x08,
        P_I =   0x04,
        P_Z =   0x02,
        P_C =   0x01;

    var hw = hwobj;
    var cycle_delay = 0;

    var  a  = 0x00
        ,x  = 0x00
        ,y  = 0x00
        ,sp = 0xFF;
    var p = P_I | P_1;
    var pc = RESET_VECTOR;

    
    var cnt = 0;
    var bBOOT = true;
    var RAMidx = {};
    

    function readByte(addr)
    {
        return hw.read(addr);
    }

    function writeByte(addr, d8)
    {
        hw.write(addr, d8);
        reset_debug(addr,d8);
    }

    function reset_debug(addr,d8)
    {
        /*
        var a = oCOM.getHexWord(addr);
        var d = oCOM.getHexByte(d8)
        RAMidx[a] = d;

        if(bBOOT == true && (a == "004E" || a == "004F"))
        { 
            bBOOT = false;
            var cnt = 0;
            for(var i in RAMidx)
                cnt++;
            console.log(cnt);
            console.log(JSON.stringify(RAMidx));
        }
        */

        
        //cnt++;
        //if(a != "004E" && a != "004F")
        //    console.log(cnt+" - hw.write("+oCOM.getHexWord(addr)+","+oCOM.getHexByte(d8)+")");
        
    }

    function readWord(addr) {
        var d16 = hw.read(addr);
        d16 |= hw.read(addr + 1) << 8;
        return d16;
    }

    function push(d8)
    {
        hw.write(STACK_ADDR + sp, d8);
        if (--sp < 0) sp = 0xff;
    }

    function pull()
    {
        if (++sp > 0xff) sp = 0;
        return hw.read(STACK_ADDR + sp);
    }

    function ind_x(operand) {
        var addr = readByte((operand + x) & 0xff);
        addr |= readByte((operand + x + 1) & 0xff) << 8;
        return addr;
    }

    function ind_y(operand) {
        var addr = readByte(operand);
        addr |= readByte((operand + 1) & 0xff) << 8;
        addr += y;
        return addr;
    }

    function set_flag(flag, cond) {
        p = (cond != 0) ? p | flag : p & ~flag;
    }

    function set_nz(d8)
    {
        //set_flag(P_N, d8 & 0x80);
        //set_flag(P_Z, d8 == 0);
        p = (d8&0x80)!=0 ? p|P_N : p & ~P_N;
        p =  d8==0       ? p|P_Z : p & ~P_Z;
    }

    function asl_instr(d8) {
        set_flag(P_C, d8 & 0x80);
        d8 = (d8 << 1) & 0xff;
        set_nz(d8);
        return d8;
    }

    function lsr_instr(d8) {
        set_flag(P_C, d8 & 0x01);   //[flag,cond] //  p = ((d8 & 0x01) != 0) ? (p | P_C) : (p & ~P_C);
        d8 >>= 1;
        set_nz(d8);
        return d8;
    }

    function rol_instr(d8) {
        var old_c = ((p & P_C) != 0) ? 0x01 :0x00;
        set_flag(P_C, d8 & 0x80);
        d8 = ((d8 << 1) | old_c) & 0xff;
        set_nz(d8);
        return d8;
    }

    function ror_instr(d8) {
        var old_c = ((p & P_C) != 0) ? 0x80 :0x00;
        set_flag(P_C, d8 & 0x01);
        d8 = (d8 >> 1) | old_c;
        set_nz(d8);
        return d8;
    }

    function or_instr(d8) {
        a |= d8;
        set_nz(a);
    }

    function and_instr(d8) {
        a &= d8;
        set_nz(a);
    }

    function eor_instr(d8) {
        a ^= d8;
        set_nz(a);
    }

    function adc_instr(d8) {
        var result;

        if ((p & P_D) != 0) {
            // Decimal mode.  Gack!
            result = (a & 0x0f) + (d8 & 0x0f) + ((p & P_C) ? 1 : 0);
            if (result > 0x09)
                result += 0x06;
            result += (a & 0xf0) + (d8 & 0xf0);
            if ((result & 0xfff0) > 0x90)
                result += 0x60;
            cycle_delay++;
        }
        else
            result = a + d8 + ((p & P_C) ? 1 : 0);

        set_flag(P_C, result & 0xff00);
        set_flag(P_V, ((d8 ^ a) & 0x80) == 0 &&
                 ((result ^ a) & 0x80) != 0);

        a = result & 0xff;
        set_nz(a);
    }

    function sbc_instr(d8) {
        var result;
        if ((p & P_D) != 0) {
            /* Decimal mode.  Gack! */
            result = (a & 0x0f) - (d8 & 0x0f) - ((p & P_C) ? 0 : 1);
            if ((result & 0x10) != 0)
                result -= 0x06;
            result += (a & 0xf0) - (d8 & 0xf0);
            if ((result & 0x100) != 0)
                result -= 0x60;
            cycle_delay++;
        }
        else
            result = a - d8 - ((p & P_C) ? 0 : 1);

        set_flag(P_C, (result & 0xff00) == 0);
        set_flag(P_V, ((d8 ^ a) & 0x80) != 0 &&
                 ((result ^ a) & 0x80) != 0);

        a = result & 0xff;
        set_nz(a);
    }

    function cmp_instr(left, right) {
        var result = left - right;
        set_flag(P_C, (result & 0xff00) == 0);
        set_nz(result);
    }

    function bit_instr(d8) {
        set_flag(P_N, d8 & 0x80);
        set_flag(P_V, d8 & 0x40);
        set_flag(P_Z, (d8 & a) == 0);
    }

    function branch_instr(operand) {
        if (operand >= 0x80)
            pc -= 0x100 - operand;
        else
            pc += operand;
        cycle_delay++; // branch take adds a cycle
    }

    // Instruction length by opcode (including 65c02 extended instructions).
    const instrlen = new Uint8Array([
        2, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,
        3, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,

        1, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,
        1, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,

        2, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,

        2, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 2, 1, 1, 3, 3, 3, 3,
        2, 2, 2, 1, 2, 2, 2, 2,  1, 3, 1, 1, 3, 3, 3, 3
    ]);

    // Cycle count by opcode (not including some caveats)
    const cycle_count = new Uint8Array([
        7, 6, 2, 0, 5, 3, 5, 5,  3, 2, 2, 0, 6, 4, 6, 2,
        2, 5, 5, 0, 5, 4, 6, 6,  2, 4, 2, 0, 6, 4, 6, 2,
        6, 6, 2, 0, 3, 3, 5, 5,  4, 2, 2, 0, 4, 4, 6, 2,
        2, 5, 5, 0, 4, 4, 6, 6,  2, 4, 2, 0, 4, 4, 6, 2,

        6, 6, 2, 0, 3, 3, 5, 5,  3, 2, 2, 0, 3, 4, 6, 2,
        2, 5, 5, 0, 4, 4, 6, 6,  2, 4, 3, 0, 0, 4, 6, 2,
        6, 6, 2, 0, 3, 3, 5, 5,  4, 2, 2, 0, 6, 4, 6, 2,
        2, 5, 5, 0, 4, 4, 6, 6,  2, 4, 4, 0, 6, 4, 6, 2,
        
        2, 6, 2, 0, 3, 3, 3, 3,  2, 2, 2, 0, 4, 4, 4, 2,
        2, 6, 5, 0, 4, 4, 4, 4,  2, 5, 2, 0, 4, 5, 5, 2,
        2, 6, 2, 0, 3, 3, 3, 3,  2, 2, 2, 0, 4, 4, 4, 2,
        2, 5, 5, 0, 4, 4, 4, 4,  2, 4, 2, 0, 4, 4, 4, 2,

        2, 6, 2, 0, 3, 3, 5, 5,  2, 2, 2, 3, 4, 4, 6, 2,
        2, 5, 5, 0, 4, 4, 6, 6,  2, 4, 3, 3, 0, 4, 6, 2,
        2, 6, 2, 0, 3, 3, 5, 5,  2, 2, 2, 0, 4, 4, 6, 2,
        2, 5, 5, 0, 4, 4, 6, 6,  2, 4, 4, 0, 0, 4, 6, 2
    ]);

    this.cycle = function()
    {
        var     opcode;
        var     operand;
        var     addr;
        var     d8;

        if (cycle_delay > 0) { cycle_delay--; return }

        // Handle interrupts.
        if (hw.nmi_signal || (hw.irq_signal && (p & P_I) == 0)) {
            // Interrupt!
            push(pc >> 8);
            push(pc & 0xff);
            push(p);
            p |= P_I;
            pc = readWord(hw.nmi_signal ? NMI_VECTOR : IRQ_VECTOR);
            cycle_delay = 6;
            return;
        }

        /* Fetch opcode. */
        opcode = hw.read(pc++);

//        console.log("cpu6502.cycle: pc=%s opcode=%s",
//                      (pc-1).toString(16), opcode.toString(16));
//        console.log("cpu6502.cycle: a=%s x=%s y=%s p=%s sp=%s",
//                      a.toString(16), x.toString(16), y.toString(16),
//                      p.toString(16), sp.toString(16));
        
        // debug
//        if (a < 0 || a > 0xff ||
//            x < 0 || x > 0xff ||
//            y < 0 || y > 0xff ||
//            sp < 0 || sp > 0xff ||
//            pc < 0 || pc > 0xffff)
//            console.err("cpu6502.cycle: bad register values!!");

        /* Look up number of cycles */
        cycle_delay = cycle_count[opcode] - 1;
        if (cycle_count[opcode] == 0) console.warn("opcode %s cycle_count is zero!", opcode.toString(16));

        /* Fetch operand. */
        switch (instrlen[opcode])
        {
        case 2:
            operand = readByte(pc);
            pc++;
            break;
        case 3:
            operand = readWord(pc);
            pc += 2;
            break;
        }

        // Execute!
        switch (opcode) {
        case 0x00:        /* BRK */
            push(pc >> 8);
            push(pc & 0xff);
            push(p | P_B);
            p |= P_I;
            pc = readWord(IRQ_VECTOR);
            break;
        case 0x01:        /* ORA (ind,X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            or_instr(operand);
            break;
        case 0x05:        /* ORA zero page */
            operand = readByte(operand);
            or_instr(operand);
            break;
        case 0x06:        /* ASL zero page */
            d8 = readByte(operand);
            d8 = asl_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x08:        /* PHP */
            push(p | P_B);
            break;
        case 0x09:        /* ORA imm */
            or_instr(operand);
            break;
        case 0x0a:        /* ASL A */
            a = asl_instr(a);
            break;
        case 0x0d:        /* ORA absolute */
            operand = readByte(operand);
            or_instr(operand);
            break;
        case 0x0e:        /* ASL absolute */
            d8 = readByte(operand);
            d8 = asl_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x10:        /* BPL */
            if ((p & P_N) == 0) branch_instr(operand);
            break;
        case 0x11:        /* ORA (ind),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            or_instr(operand);
            break;
        case 0x15:        /* ORA zero,X */
            operand = readByte((operand + x) & 0xff);
            or_instr(operand);
            break;
        case 0x16:        /* ASL zero,X */
            addr = (operand + x) & 0xff;
            d8 = readByte(addr);
            d8 = asl_instr(d8);
            writeByte(addr, d8);
            break;
        case 0x18:        /* CLC */
            p &= ~P_C;
            break;
        case 0x19:        /* ORA absolute,Y */
            operand = readByte(operand + y);
            or_instr(operand);
            break;
        case 0x1d:        /* ORA absolute,X */
            operand = readByte(operand + x);
            or_instr(operand);
            break;
        case 0x1e:        /* ASL absolute,X */
            d8 = readByte(operand + x);
            d8 = asl_instr(d8);
            writeByte(operand + x, d8);
            break;
        case 0x20:        /* JSR absolute */
            pc--;
            push(pc >> 8);
            push(pc & 0xff);
            pc = operand;
            break;
        case 0x21:        /* AND (ind,X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            and_instr(operand);
            break;
        case 0x24:        /* BIT zero page */
            operand = readByte(operand);
            bit_instr(operand);
            break;
        case 0x25:        /* AND zero page */
            operand = readByte(operand);
            and_instr(operand);
            break;
        case 0x26:        /* ROL zero page */
            d8 = readByte(operand);
            d8 = rol_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x28:        /* PLP */
            p = (pull() & ~P_B) | P_1;
            break;
        case 0x29:        /* AND imm */
            and_instr(operand);
            break;
        case 0x2a:        /* ROL A */
            a = rol_instr(a);
            break;
        case 0x2c:        /* BIT absolute */
            operand = readByte(operand);
            bit_instr(operand);
            break;
        case 0x2d:        /* AND absolute */
            operand = readByte(operand);
            and_instr(operand);
            break;
        case 0x2e:        /* ROL absolute */
            d8 = readByte(operand);
            d8 = rol_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x30:        /* BMI */
            if ((p & P_N) != 0) branch_instr(operand);
            break;
        case 0x31:        /* AND (ind),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            and_instr(operand);
            break;
        case 0x35:        /* AND zero, X */
            operand = readByte((operand + x) & 0xff);
            and_instr(operand);
            break;
        case 0x36:        /* ROL zero, X */
            addr = (operand + x) & 0xff;
            d8 = readByte(addr);
            d8 = rol_instr(d8);
            writeByte(addr, d8);
            break;
        case 0x38:        /* SEC */
            p |= P_C;
            break;
        case 0x39:        /* AND absolute, Y */
            operand = readByte(operand + y);
            and_instr(operand);
            break;
        case 0x3d:        /* AND absolute, X */
            operand = readByte(operand + x);
            and_instr(operand);
            break;
        case 0x3e:        /* ROL absolute, X */
            d8 = readByte(operand + x);
            d8 = rol_instr(d8);
            writeByte(operand + x, d8);
            break;
        case 0x40:        /* RTI */
            p = (pull() & ~P_B) | P_1;
            pc = pull();
            pc |= pull() << 8;
            break;
        case 0x41:        /* EOR (ind, X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            eor_instr(operand);        
            break;
        case 0x45:        /* EOR zero page */
            operand = readByte(operand);
            eor_instr(operand);        
            break;
        case 0x46:        /* LSR zero page */
            d8 = readByte(operand);
            d8 = lsr_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x48:        /* PHA */
            push(a);
            break;
        case 0x49:        /* EOR imm */
            eor_instr(operand);
            break;
        case 0x4a:        /* LSR A */
            a = lsr_instr(a);
            break;
        case 0x4c:        /* JMP absolute */
            pc = operand;
            break;
        case 0x4d:        /* EOR absolute */
            operand = readByte(operand);
            eor_instr(operand);
            break;
        case 0x4e:        /* LSR absolute */
            d8 = readByte(operand);
            d8 = lsr_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x50:        /* BVC */
            if ((p & P_V) == 0) branch_instr(operand);
            break;
        case 0x51:        /* EOR (indirect), Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            eor_instr(operand);
            break;
        case 0x55:        /* EOR zero, X */
            operand = readByte((operand + x) & 0xff);
            eor_instr(operand);
            break;
        case 0x56:        /* LSR zero, X */
            addr = (operand + x) & 0xff;
            d8 = readByte(addr);
            d8 = lsr_instr(d8);
            writeByte(addr, d8);
            break;
        case 0x58:        /* CLI */
            p &= ~P_I;
            break;
        case 0x59:        /* EOR absolute,Y */
            operand = readByte(operand + y);
            eor_instr(operand);
            break;
        case 0x5d:        /* EOR absolute,X */
            operand = readByte(operand + x);
            eor_instr(operand);
            break;
        case 0x5e:        /* LSR absolute,X */
            d8 = readByte(operand + x);
            d8 = lsr_instr(d8);
            writeByte(operand + x, d8);
            break;
        case 0x60:        /* RTS */
            pc = pull();
            pc |= pull() << 8;
            pc++;
            break;
        case 0x61:        /* ADC (ind,X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            adc_instr(operand);        
            break;
        case 0x65:        /* ADC zero page */
            operand = readByte(operand);
            adc_instr(operand);        
            break;
        case 0x66:        /* ROR zero page */
            d8 = readByte(operand);
            d8 = ror_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x68:        /* PLA */
            a = pull();
            set_nz(a);
            break;
        case 0x69:        /* ADC imm */
            adc_instr(operand);
            break;
        case 0x6a:        /* ROR A */
            a = ror_instr(a);
            break;
        case 0x6c:        /* JMP (ind) */
            pc = readWord(operand);
            break;
        case 0x6d:        /* ADC absolute */
            operand = readByte(operand);
            adc_instr(operand);
            break;
        case 0x6e:        /* ROR absolute */
            d8 = readByte(operand);
            d8 = ror_instr(d8);
            writeByte(operand, d8);
            break;
        case 0x70:        /* BVS */
            if ((p & P_V) != 0) branch_instr(operand);
            break;
        case 0x71:        /* ADC (indirect),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            adc_instr(operand);
            break;
        case 0x75:        /* ADC zero, X */
            operand = readByte((operand + x) & 0xff);
            adc_instr(operand);
            break;
        case 0x76:        /* ROR zero, X */
            addr = (operand + x) & 0xff;
            d8 = readByte(addr);
            d8 = ror_instr(d8);
            writeByte(addr, d8);
            break;
        case 0x78:        /* SEI */
            p |= P_I;
            break;
        case 0x79:        /* ADC absolute,Y */
            operand = readByte(operand + y);
            adc_instr(operand);
            break;
        case 0x7d:        /* ADC absolute,X */
            operand = readByte(operand + x);
            adc_instr(operand);
            break;
        case 0x7e:        /* ROR absolute,X */
            d8 = readByte(operand + x);
            d8 = ror_instr(d8);
            writeByte(operand + x, d8);
            break;
        case 0x81:        /* STA (ind, X) */
            addr = ind_x(operand);
            writeByte(addr, a);
            break;
        case 0x84:        /* STY zero page */
            writeByte(operand, y);
            break;
        case 0x85:        /* STA zero page */
            writeByte(operand, a);
            break;
        case 0x86:        /* STX zero page */
            writeByte(operand, x);
            break;
        case 0x88:        /* DEY */
            y = --y & 0xff;
            set_nz(y);
            break;
        case 0x8a:        /* TXA */
            a = x;
            set_nz(a);
            break;
        case 0x8c:        /* STY absolute */
            writeByte(operand, y);
            break;
        case 0x8d:        /* STA absolute */
            writeByte(operand, a);
            break;
        case 0x8e:        /* STX absolute */
            writeByte(operand, x);
            break;
        case 0x90:        /* BCC */
            if ((p & P_C) == 0) branch_instr(operand);
            break;
        case 0x91:        /* STA (ind),Y */
            addr = ind_y(operand);
            writeByte(addr, a);
            break;
        case 0x94:        /* STY zero, X */
            writeByte((operand + x) & 0xff, y);
            break;
        case 0x95:        /* STA zero, X */
            writeByte((operand + x) & 0xff, a);
            break;
        case 0x96:        /* STX zero, Y */
            writeByte((operand + y) & 0xff, x);
            break;
        case 0x98:        /* TYA */
            a = y;
            set_nz(a);
            break;
        case 0x99:        /* STA absolute, Y */
            writeByte(operand + y, a);
            break;
        case 0x9a:        /* TXS */
            sp = x;
            break;
        case 0x9d:        /* STA absolute, X */
            writeByte(operand + x, a);
            break;
        case 0xa0:        /* LDY imm */
            y = operand;
            set_nz(y);
            break;
        case 0xa1:        /* LDA (ind, X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            a = operand;
            set_nz(a);
            break;
        case 0xa2:        /* LDX imm */
            x = operand;
            set_nz(x);
            break;
        case 0xa4:        /* LDY zero page */
            y = readByte(operand);
            set_nz(y);
            break;
        case 0xa5:        /* LDA zero page */
            a = readByte(operand);
            set_nz(a);
            break;
        case 0xa6:        /* LDX zero page */
            x = readByte(operand);
            set_nz(x);
            break;
        case 0xa8:        /* TAY */
            y = a;
            set_nz(y);
            break;
        case 0xa9:        /* LDA imm */
            a = operand;
            set_nz(a);
            break;
        case 0xaa:        /* TAX */
            x = a;
            set_nz(x);
            break;
        case 0xac:        /* LDY absolute */
            y = readByte(operand);
            set_nz(y);
            break;
        case 0xad:        /* LDA absolute */
            a = readByte(operand);
            set_nz(a);
            break;
        case 0xae:        /* LDX absolute */
            x = readByte(operand);
            set_nz(x);
            break;
        case 0xb0:        /* BCS */
            if ((p & P_C) != 0) branch_instr(operand);
            break;
        case 0xb1:        /* LDA (ind),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            a = operand;
            set_nz(a);
            break;
        case 0xb4:        /* LDY zero,X */
            y = readByte((operand + x) & 0xff);
            set_nz(y);
            break;
        case 0xb5:        /* LDA zero,X */
            a = readByte((operand + x) & 0xff);
            set_nz(a);
            break;
        case 0xb6:        /* LDX zero,Y */
            x = readByte((operand + y) & 0xff);
            set_nz(x);
            break;
        case 0xb8:        /* CLV */
            p &= ~P_V;
            break;
        case 0xb9:        /* LDA absolute, Y */
            a = readByte(operand + y);
            set_nz(a);
            break;
        case 0xba:        /* TSX */
            x = sp;
            set_nz(x);
            break;
        case 0xbc:        /* LDY absolute, X */
            y = readByte(operand + x);
            set_nz(y);
            break;
        case 0xbd:        /* LDA absolute, X */
            a = readByte(operand + x);
            set_nz(a);
            break;
        case 0xbe:        /* LDX absolute, Y */
            x = readByte(operand + y);
            set_nz(x);
            break;
        case 0xc0:        /* CPY imm */
            cmp_instr(y, operand);
            break;
        case 0xc1:        /* CMP (ind, X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            cmp_instr(a, operand);
            break;
        case 0xc4:        /* CPY zero */
            operand = readByte(operand);
            cmp_instr(y, operand);        
            break;
        case 0xc5:        /* CMP zero */
            operand = readByte(operand);
            cmp_instr(a, operand);        
            break;
        case 0xc6:        /* DEC zero */
            d8 = (readByte(operand) - 1) & 0xff;
            writeByte(operand, d8);
            set_nz(d8);
            break;
        case 0xc8:        /* INY */
            y = ++y & 0xff;
            set_nz(y);
            break;
        case 0xc9:        /* CMP imm */
            cmp_instr(a, operand);
            break;
        case 0xca:        /* DEX */
            x = --x & 0xff;
            set_nz(x);
            break;
        case 0xcc:        /* CPY absolute */
            operand = readByte(operand);
            cmp_instr(y, operand);        
            break;
        case 0xcd:        /* CMP absolute */
            operand = readByte(operand);
            cmp_instr(a, operand);        
            break;
        case 0xce:        /* DEC absolute */
            d8 = (readByte(operand) - 1) & 0xff;
            writeByte(operand, d8);
            set_nz(d8);
            break;
        case 0xd0:        /* BNE */
            if ((p & P_Z) == 0) branch_instr(operand);
            break;
        case 0xd1:        /* CMP (ind),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            cmp_instr(a, operand);
            break;
        case 0xd5:        /* CMP zero,X */
            operand = readByte((operand + x) & 0xff);
            cmp_instr(a, operand);
            break;
        case 0xd6:        /* DEC zero,X */
            addr = (operand + x) & 0xff;
            d8 = (readByte(addr) - 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            break;
        case 0xd8:        /* CLD */
            p &= ~P_D;
            break;
        case 0xd9:        /* CMP absolute,Y */
            operand = readByte(operand + y);
            cmp_instr(a, operand);
            break;
        case 0xdd:        /* CMP absolute,X */
            operand = readByte(operand + x);
            cmp_instr(a, operand);
            break;
        case 0xde:        /* DEC absolute,X */
            addr = operand + x;
            d8 = (readByte(addr) - 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            break;
        case 0xe0:        /* CPX imm */
            cmp_instr(x, operand);
            break;
        case 0xe1:        /* SBC (ind,X) */
            addr = ind_x(operand);
            operand = readByte(addr);
            sbc_instr(operand);
            break;
        case 0xe4:        /* CPX zero */
            operand = readByte(operand);
            cmp_instr(x, operand);
            break;
        case 0xe5:        /* SBC zero */
            operand = readByte(operand);
            sbc_instr(operand);
            break;
        case 0xe6:        /* INC zero */
            d8 = (readByte(operand) + 1) & 0xff;
            writeByte(operand, d8);
            set_nz(d8);
            break;
        case 0xe8:        /* INX */
            x = ++x & 0xff;
            set_nz(x);
            break;
        case 0xe9:        /* SBC imm */
            sbc_instr(operand);
            break;
        case 0xea:        /* NOP */
            break;
        case 0xec:        /* CPX absolute */
            operand = readByte(operand);
            cmp_instr(x, operand);
            break;
        case 0xed:        /* SBC absolute */
            operand = readByte(operand);
            sbc_instr(operand);
            break;
        case 0xee:        /* INC absolute */
            d8 = (readByte(operand) + 1) & 0xff;
            writeByte(operand, d8);
            set_nz(d8);
            break;
        case 0xf0:        /* BEQ */
            if ((p & P_Z) != 0) branch_instr(operand);
            break;
        case 0xf1:        /* SBC (ind),Y */
            addr = ind_y(operand);
            operand = readByte(addr);
            sbc_instr(operand);
            break;
        case 0xf5:        /* SBC zero,X */
            operand = readByte((operand + x) & 0xff);
            sbc_instr(operand);
            break;
        case 0xf6:        /* INC zero,X */
            addr = (operand + x) & 0xff;
            d8 = (readByte(addr) + 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            break;
        case 0xf8:        /* SED */
            p |= P_D;
            break;
        case 0xf9:        /* SBC absolute,Y */
            operand = readByte(operand + y);
            sbc_instr(operand);
            break;
        case 0xfd:        /* SBC absolute,X */
            operand = readByte(operand + x);
            sbc_instr(operand);
            break;
        case 0xfe:        /* INC absolute,X */
            addr = operand + x;
            d8 = (readByte(addr) + 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            break;
//      default:
//            console.log("Cpu6502:cycle: undefined opcode: %s pc=%s",
//                        opcode.toString(16), pc.toString(16));
        }

    }

    // Note that ROM must be set up before calling this because
    // RESET vector must be in place.
    //
    this.reset = function()
    {
        a = 0x00;
        x = 0x00;
        y = 0x00;
        sp = 0xFF;
        p = P_I | P_1;
        pc = readWord(RESET_VECTOR);

        cycle_delay = 0;
    }

    this.save = function() {
        return a.toString(16) + ',' +
            x.toString(16) + ',' +
            y.toString(16) + ',' +
            sp.toString(16) + ',' +
            p.toString(16) + ',' +
            pc.toString(16);
    }

    this.load = function(s) {
        var l = s.split(',');

        a = parseInt(l[0], 16);
        x = parseInt(l[1], 16);
        y = parseInt(l[2], 16);
        sp = parseInt(l[3], 16);
        p = parseInt(l[4], 16);
        pc = parseInt(l[5], 16);
    }

    this.toString = function() {
        return 'PC=' + pc.toString(16) +
            ' A=' + a.toString(16) +
            ' X=' + x.toString(16) +
            ' Y=' + y.toString(16) +
            ' P=' + p.toString(16) +
            ' SP=' + sp.toString(16);
    }
}