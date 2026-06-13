//     ██████ ██████  ██    ██      ██████  ███████  ██████  ██████  
//    ██      ██   ██ ██    ██     ██       ██      ██  ████      ██ 
//    ██      ██████  ██    ██     ███████  ███████ ██ ██ ██  █████  
//    ██      ██      ██    ██     ██    ██      ██ ████  ██ ██      
//     ██████ ██       ██████       ██████  ███████  ██████  ███████
//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_cpu6502.js


if (typeof oEMU === "undefined") var oEMU = {"component":{"CPU":{"6502":new Cpu6502()}}};
else oEMU.component.CPU["6502"] = new Cpu6502();

function Cpu6502(hwobj)
{
    var self = this;

    const bDebug_boot = true;        // debug CPU boot
    //const BOOTsiz = 1024;
    const BOOTsiz = 131072;
    //const BOOTsiz = 524288;
    //const BOOTsiz = 1048576;

    const BOOT_RECORD_BYTES = 10;
    const BOOT_GROUP_MARKER_ADR = 0xFFFF;

    var BOOTlog_adr = new Uint16Array(BOOTsiz);     // starting PC of each executed instruction, or $FFFF for a compressed group marker
    var BOOTlog_cpu = new BigUint64Array(BOOTsiz);  // opcode/op1/op2 + A/X/Y/P/SP, or group/repeat payload for marker rows
    var BOOTcnt = 0;

    const memberTable = [
        {"group":1,"step":0,"pc":"$FD1B","count":19747,"bytes":"E6 4E","instruction":"INC RNDL"},
        {"group":1,"step":1,"pc":"$FD1D","count":19747,"bytes":"D0 02","instruction":"BNE KEYIN2"},
        {"group":1,"step":2,"pc":"$FD21","count":19746,"bytes":"2C 00 C0","instruction":"BIT KBD"},
        {"group":1,"step":3,"pc":"$FD24","count":19746,"bytes":"10 F5","instruction":"BPL KEYIN"},
        {"group":2,"step":0,"pc":"$FCAA","count":17058,"bytes":"E9 01","instruction":"SBC #$01"},
        {"group":2,"step":1,"pc":"$FCAC","count":17058,"bytes":"D0 FC","instruction":"BNE WAIT3"}, 
        {"group":3,"step":0,"pc":"$FCA0","count":960,"bytes":"91 28","instruction":"STA (BASL),Y"},
        {"group":3,"step":1,"pc":"$FCA2","count":960,"bytes":"C8","instruction":"INY"},
        {"group":3,"step":2,"pc":"$FCA3","count":960,"bytes":"C4 21","instruction":"CPY WNDWDTH"},
        {"group":3,"step":3,"pc":"$FCA5","count":960,"bytes":"90 F9","instruction":"BCC CLREO2"},
        {"group":4,"step":0,"pc":"$F181","count":184,"bytes":"E6 51","instruction":"INC $51"},
        {"group":4,"step":1,"pc":"$F183","count":184,"bytes":"B1 50","instruction":"LDA ($50),Y"},
        {"group":4,"step":2,"pc":"$F185","count":184,"bytes":"49 FF","instruction":"EOR #$FF"},
        {"group":4,"step":3,"pc":"$F187","count":184,"bytes":"91 50","instruction":"STA ($50),Y"},
        {"group":4,"step":4,"pc":"$F189","count":184,"bytes":"D1 50","instruction":"CMP ($50),Y"},
        {"group":4,"step":5,"pc":"$F18B","count":184,"bytes":"D0 08","instruction":"BNE $F195"},
        {"group":4,"step":6,"pc":"$F18D","count":183,"bytes":"49 FF","instruction":"EOR #$FF"},
        {"group":4,"step":7,"pc":"$F18F","count":183,"bytes":"91 50","instruction":"STA ($50),Y"},
        {"group":4,"step":8,"pc":"$F191","count":183,"bytes":"D1 50","instruction":"CMP ($50),Y"},
        {"group":4,"step":9,"pc":"$F193","count":183,"bytes":"F0 EC","instruction":"BEQ $F181"},
        {"group":5,"step":0,"pc":"$F152","count":28,"bytes":"BD 0A F1","instruction":"LDA $F10A,X"},
        {"group":5,"step":1,"pc":"$F155","count":28,"bytes":"95 B0","instruction":"STA $B0,X"},
        {"group":5,"step":2,"pc":"$F157","count":28,"bytes":"86 F1","instruction":"STX $F1"},
        {"group":5,"step":3,"pc":"$F159","count":28,"bytes":"CA","instruction":"DEX"},
        {"group":5,"step":4,"pc":"$F15A","count":28,"bytes":"D0 F6","instruction":"BNE $F152"},
        {"group":6,"step":0,"pc":"$FB65","count":8,"bytes":"B9 08 FB","instruction":"LDA $FB08,Y"},
        {"group":6,"step":1,"pc":"$FB68","count":8,"bytes":"99 0E 04","instruction":"STA $040E,Y"},
        {"group":6,"step":2,"pc":"$FB6B","count":8,"bytes":"88","instruction":"DEY"},
        {"group":6,"step":3,"pc":"$FB6C","count":8,"bytes":"D0 F7","instruction":"BNE STITLE"},
        {"group":7,"step":0,"pc":"$FACE","count":0,"bytes":"88","instruction":"DEY"},
        {"group":7,"step":1,"pc":"$FACF","count":0,"bytes":"88","instruction":"DEY"},
        {"group":7,"step":2,"pc":"$FAD0","count":0,"bytes":"10 F5","instruction":"BPL NXTBYT"},
        {"group":7,"step":3,"pc":"$FAC7","count":0,"bytes":"B1 00","instruction":"LDA (LOC0),Y"},
        {"group":7,"step":4,"pc":"$FAC9","count":0,"bytes":"D9 01 FB","instruction":"CMP $FB01,Y"},
        {"group":7,"step":5,"pc":"$FACC","count":0,"bytes":"D0 EC","instruction":"BNE SLOOP"},

        {"group":8,"step":0,"pc":"$FCAE","count":17058,"bytes":"68","instruction":"PLA"},
        {"group":8,"step":1,"pc":"$FCAF","count":17058,"bytes":"E9 01","instruction":"SBC #$01"},  
        {"group":8,"step":2,"pc":"$FCB1","count":17058,"bytes":"D0 F6","instruction":"BNE WAIT2"},
        {"group":8,"step":3,"pc":"$FCA9","count":17058,"bytes":"48","instruction":"PHA"}   
        
        /*
        {"group":9,"step":0,"pc":"$C65E","count":17058,"bytes":"BD 8C C0","instruction":"LDA $C08C,X"},
        {"group":9,"step":1,"pc":"$C661","count":17058,"bytes":"10 FB","instruction":"BPL $C65E"},  
        {"group":9,"step":2,"pc":"$C663","count":17058,"bytes":"49 D5","instruction":"EOR #$D5"},
        {"group":9,"step":3,"pc":"$C665","count":17058,"bytes":"D0 F7","instruction":"BNE $C65E"},  
        */
    ];

    const memberExcl = memberTable.map(function (m) { return parseInt(m.pc.substring(1), 16) & 0xffff; });
    const BOOTlog_exclude = new Set(memberExcl); // retained for quick inspection/debugging; compression uses BOOTgroup_lookup
    const BOOTgroup_lookup = buildBootGroupLookup(memberTable);
    const BOOTgroup_sequences = buildBootGroupSequences(memberTable);

    var BOOTgroup_id = 0;
    var BOOTgroup_next_step = 0;
    var BOOTgroup_count = 0;
    var BOOTgroup_record = -1;
    var BOOTgroup_pending = [];
    this.BOOTparam = function()
    {
        return {"bDebug_boot":bDebug_boot }  
    }

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

    // Precomputed N/Z status bits for set_nz().  This keeps the hot flag
    // update compact without adding extra helper calls inside opcode cases.
    const nz_flags = new Uint8Array(256);
    for (var i = 0; i < 256; i++) nz_flags[i] = (i & P_N) | (i == 0 ? P_Z : 0);

    // Instruction length by opcode (including 65c02 extended instructions).
    // (2 bits per instruction)
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

    // Cycle count by opcode (not including some caveats, added inline)
    // (3 bits per instruction)
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

    // (3 bytes + 4 bits)
    // imp,rel,abs,zpg,ind,zpx,abx,aby,imm,inx,iny,acc

    const opctab= [
        ['BRK','imp'], ['ORA','inx'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ORA','zpg'], ['ASL','zpg'], ['???','imp'],
        ['PHP','imp'], ['ORA','imm'], ['ASL','acc'], ['???','imp'],
        ['???','imp'], ['ORA','abs'], ['ASL','abs'], ['???','imp'],
        ['BPL','rel'], ['ORA','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ORA','zpx'], ['ASL','zpx'], ['???','imp'],
        ['CLC','imp'], ['ORA','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ORA','abx'], ['ASL','abx'], ['???','imp'],
        ['JSR','abs'], ['AND','inx'], ['???','imp'], ['???','imp'],
        ['BIT','zpg'], ['AND','zpg'], ['ROL','zpg'], ['???','imp'],
        ['PLP','imp'], ['AND','imm'], ['ROL','acc'], ['???','imp'],
        ['BIT','abs'], ['AND','abs'], ['ROL','abs'], ['???','imp'],
        ['BMI','rel'], ['AND','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['AND','zpx'], ['ROL','zpx'], ['???','imp'],
        ['SEC','imp'], ['AND','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['AND','abx'], ['ROL','abx'], ['???','imp'],
        ['RTI','imp'], ['EOR','inx'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['EOR','zpg'], ['LSR','zpg'], ['???','imp'],
        ['PHA','imp'], ['EOR','imm'], ['LSR','acc'], ['???','imp'],
        ['JMP','abs'], ['EOR','abs'], ['LSR','abs'], ['???','imp'],
        ['BVC','rel'], ['EOR','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['EOR','zpx'], ['LSR','zpx'], ['???','imp'],
        ['CLI','imp'], ['EOR','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['EOR','abx'], ['LSR','abx'], ['???','imp'],
        ['RTS','imp'], ['ADC','inx'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ADC','zpg'], ['ROR','zpg'], ['???','imp'],
        ['PLA','imp'], ['ADC','imm'], ['ROR','acc'], ['???','imp'],
        ['JMP','ind'], ['ADC','abs'], ['ROR','abs'], ['???','imp'],
        ['BVS','rel'], ['ADC','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ADC','zpx'], ['ROR','zpx'], ['???','imp'],
        ['SEI','imp'], ['ADC','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['ADC','abx'], ['ROR','abx'], ['???','imp'],
        ['???','imp'], ['STA','inx'], ['???','imp'], ['???','imp'],
        ['STY','zpg'], ['STA','zpg'], ['STX','zpg'], ['???','imp'],
        ['DEY','imp'], ['???','imp'], ['TXA','imp'], ['???','imp'],
        ['STY','abs'], ['STA','abs'], ['STX','abs'], ['???','imp'],
        ['BCC','rel'], ['STA','iny'], ['???','imp'], ['???','imp'],
        ['STY','zpx'], ['STA','zpx'], ['STX','zpy'], ['???','imp'],
        ['TYA','imp'], ['STA','aby'], ['TXS','imp'], ['???','imp'],
        ['???','imp'], ['STA','abx'], ['???','imp'], ['???','imp'],
        ['LDY','imm'], ['LDA','inx'], ['LDX','imm'], ['???','imp'],
        ['LDY','zpg'], ['LDA','zpg'], ['LDX','zpg'], ['???','imp'],
        ['TAY','imp'], ['LDA','imm'], ['TAX','imp'], ['???','imp'],
        ['LDY','abs'], ['LDA','abs'], ['LDX','abs'], ['???','imp'],
        ['BCS','rel'], ['LDA','iny'], ['???','imp'], ['???','imp'],
        ['LDY','zpx'], ['LDA','zpx'], ['LDX','zpy'], ['???','imp'],
        ['CLV','imp'], ['LDA','aby'], ['TSX','imp'], ['???','imp'],
        ['LDY','abx'], ['LDA','abx'], ['LDX','aby'], ['???','imp'],
        ['CPY','imm'], ['CMP','inx'], ['???','imp'], ['???','imp'],
        ['CPY','zpg'], ['CMP','zpg'], ['DEC','zpg'], ['???','imp'],
        ['INY','imp'], ['CMP','imm'], ['DEX','imp'], ['???','imp'],
        ['CPY','abs'], ['CMP','abs'], ['DEC','abs'], ['???','imp'],
        ['BNE','rel'], ['CMP','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['CMP','zpx'], ['DEC','zpx'], ['???','imp'],
        ['CLD','imp'], ['CMP','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['CMP','abx'], ['DEC','abx'], ['???','imp'],
        ['CPX','imm'], ['SBC','inx'], ['???','imp'], ['???','imp'],
        ['CPX','zpg'], ['SBC','zpg'], ['INC','zpg'], ['???','imp'],
        ['INX','imp'], ['SBC','imm'], ['NOP','imp'], ['???','imp'],
        ['CPX','abs'], ['SBC','abs'], ['INC','abs'], ['???','imp'],
        ['BEQ','rel'], ['SBC','iny'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['SBC','zpx'], ['INC','zpx'], ['???','imp'],
        ['SED','imp'], ['SBC','aby'], ['???','imp'], ['???','imp'],
        ['???','imp'], ['SBC','abx'], ['INC','abx'], ['???','imp']
    ];

//   ██████ ██████  ██    ██      ██████  ██████  ██████  ███████ 
//  ██      ██   ██ ██    ██     ██      ██    ██ ██   ██ ██      
//  ██      ██████  ██    ██     ██      ██    ██ ██████  █████   
//  ██      ██      ██    ██     ██      ██    ██ ██   ██ ██      
//   ██████ ██       ██████       ██████  ██████  ██   ██ ███████ 


    function readByte(addr)         
    { 
        const adr = addr & 0xffff;
        const line = hw.lineDecode(adr);
        return hw.RD[line](adr) & 0xff;
    }

    function writeByte(addr, d8)
    {
        const adr = addr & 0xffff;
        const line = hw.lineDecode(adr);
        const d = d8 & 0xff;
        hw.WR[line](adr,d);
    }

    function readWord(addr)         { return readByte(addr) | (readByte(addr + 1) << 8) }
    function readWordZp(addr)       { addr &= 0xff; return readByte(addr) | (readByte((addr + 1) & 0xff) << 8) }

    // Boot log record payload, stored little-endian when exported:
    //   PClo PChi OPC OP1 OP2 A X Y P SP
    // BOOTlog_adr stores PClo/PChi, BOOTlog_cpu stores the remaining 8 bytes.
    // The register values are the pre-execution CPU state for the fetched instruction.
    function buildBootGroupLookup(table)
    {
        var lookup = Object.create(null);
        for (var i = 0; i < table.length; i++) {
            var m = table[i];
            var pcNum = parseInt(m.pc.substring(1), 16) & 0xffff;
            lookup[pcNum] = { group:m.group | 0, step:m.step | 0, pc:pcNum };
        }
        return lookup;
    }

    function buildBootGroupSequences(table)
    {
        var groups = Object.create(null);
        for (var i = 0; i < table.length; i++) {
            var m = table[i];
            var g = m.group | 0;
            if (!groups[g]) groups[g] = [];
            groups[g].push({ step:m.step | 0, pc:parseInt(m.pc.substring(1), 16) & 0xffff });
        }

        Object.keys(groups).forEach(function (g) {
            groups[g].sort(function (a, b) { return a.step - b.step; });
        });

        return groups;
    }

    function resetBootGroupState()
    {
        BOOTgroup_id = 0;
        BOOTgroup_next_step = 0;
        BOOTgroup_count = 0;
        BOOTgroup_record = -1;
        BOOTgroup_pending = [];
    }

    function emitBootPacked(adr, packed)
    {
        if (!bDebug_boot || BOOTcnt >= BOOTsiz) return false;

        BOOTlog_adr[BOOTcnt] = adr & 0xffff;
        BOOTlog_cpu[BOOTcnt] = packed;
        BOOTcnt++;

        if (BOOTcnt == BOOTsiz)
        {
            //alert("cpu log ended");
            //console.log("BOOTlog = " + self.getBootLogBase64());
        }

        return true;
    }

    function emitOrUpdateBootGroupMarker()
    {
        if (BOOTgroup_count <= 0) return;

        if (BOOTgroup_record < 0)
        {
            if (BOOTcnt >= BOOTsiz) return;
            BOOTgroup_record = BOOTcnt;
            BOOTlog_adr[BOOTcnt] = BOOT_GROUP_MARKER_ADR;
            BOOTlog_cpu[BOOTcnt] = packGroupState(BOOTgroup_id, BOOTgroup_count);
            BOOTcnt++;

            if (BOOTcnt == BOOTsiz)
            {
                alert("cpu log ended");
                console.log("BOOTlog = " + self.getBootLogBase64());
            }
        }
        else BOOTlog_cpu[BOOTgroup_record] = packGroupState(BOOTgroup_id, BOOTgroup_count);
    }

    function flushBootGroupPending()
    {
        for (var i = 0; i < BOOTgroup_pending.length; i++)
            emitBootPacked(BOOTgroup_pending[i].adr, BOOTgroup_pending[i].packed);

        resetBootGroupState();
    }

    function startBootGroup(member, boot_pc, packed)
    {
        var seq = BOOTgroup_sequences[member.group];
        if (!seq || !seq.length || member.step !== 0) return false;

        BOOTgroup_id = member.group;
        BOOTgroup_next_step = 1 % seq.length;
        BOOTgroup_count = 0;
        BOOTgroup_record = -1;
        BOOTgroup_pending = [{ adr:boot_pc, packed:packed }];

        if (seq.length == 1)
        {
            BOOTgroup_count = 1;
            BOOTgroup_pending = [];
            emitOrUpdateBootGroupMarker();
        }

        return true;
    }

    function logBootInstruction(boot_pc, opcode, operand)
    {
        if (!bDebug_boot || BOOTcnt >= BOOTsiz) return;

        var packed = packBootState(opcode, operand);
        var member = BOOTgroup_lookup[boot_pc & 0xffff];

        if (!member)
        {
            flushBootGroupPending();
            emitBootPacked(boot_pc, packed);
            return;
        }

        if (!BOOTgroup_id)
        {
            if (!startBootGroup(member, boot_pc, packed)) emitBootPacked(boot_pc, packed);
            return;
        }

        var seq = BOOTgroup_sequences[BOOTgroup_id];
        var seqLen = seq ? seq.length : 0;

        if (member.group === BOOTgroup_id && member.step === BOOTgroup_next_step && seqLen > 0)
        {
            BOOTgroup_pending.push({ adr:boot_pc, packed:packed });
            BOOTgroup_next_step = (BOOTgroup_next_step + 1) % seqLen;

            if (BOOTgroup_next_step === 0)
            {
                BOOTgroup_count++;
                BOOTgroup_pending = [];
                emitOrUpdateBootGroupMarker();
            }
            return;
        }

        // Sequence broke.  Completed repetitions stay compressed;
        // any incomplete tail is written back as normal raw records so it is not lost.
        flushBootGroupPending();

        if (!startBootGroup(member, boot_pc, packed)) emitBootPacked(boot_pc, packed);
    }

    function packBootState(opcode, operand)
    {
        return  BigInt(opcode & 0xff) |
               (BigInt(operand & 0xffff) << 8n) |
               (BigInt(a & 0xff)       << 24n) |
               (BigInt(x & 0xff)       << 32n) |
               (BigInt(y & 0xff)       << 40n) |
               (BigInt(p & 0xff)       << 48n) |
               (BigInt(sp & 0xff)      << 56n);
    }

    function packGroupState(group, repeatCount)
    {
        return BigInt(group & 0xffff) |
               (BigInt(repeatCount >>> 0) << 16n);
    }


    // NMOS 6502 JMP ($xxFF) wraps the high-byte read inside the same page.
    function readWordBug(addr)      { return readByte(addr) | (readByte((addr & 0xff00) | ((addr + 1) & 0xff)) << 8) }

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

        if (bDebug_boot)
        {
            BOOTcnt = 0;
            resetBootGroupState();
        }
    }

    this.cycle = function()
    {
        var     opcode;
        var     operand;
        var     addr;
        var     d8;

        if (cycle_delay > 0) { cycle_delay--; return }

        // interrupt handling
        if (hw.nmi_signal || (hw.irq_signal && (p & P_I) == 0))
        {
            push(pc >> 8); push(pc & 0xff); push(p);
            p |= P_I;
            pc = readWord(hw.nmi_signal ? NMI_VECTOR : IRQ_VECTOR);
            cycle_delay = 6;
            return;
        }

        // Fetch opcode and increment program counter
        var instr_pc = pc;          // PC of the opcode byte
        operand = 0;                // important for 1-byte opcodes

        opcode = readByte(pc);
        pc = (pc + 1) & 0xffff;

        // Look up number of cycles
        var base_cycles = cycle_count[opcode];
        cycle_delay = base_cycles - 1;
        if (base_cycles == 0) console.warn("opcode %s cycle_count is zero!", opcode.toString(16));

        // Fetch operand
        switch (instrlen[opcode])
        {
            case 2:
                operand = readByte(pc);
                pc = (pc + 1) & 0xffff;
                break;

            case 3:
                operand = readWord(pc);
                pc = (pc + 2) & 0xffff;
                break;
        }

        logBootInstruction(instr_pc & 0xffff, opcode, operand);


        // Execute!
        switch (opcode) {
        case 0x00:   push(pc >> 8);  push(pc & 0xff);  push(p | P_B);  p |= P_I;  pc = readWord(IRQ_VECTOR);  break; // BRK
        case 0x01:   addr = ind_x(operand);  operand = readByte(addr);  or_instr(operand);  break; // ORA (ind,X)
        case 0x04:   unofficial(opcode,pc); break; // NOP zeropage / DOP / SKB (unofficial opcode, but 100% harmless)
        case 0x05:   operand = readByte(operand);  or_instr(operand);  break; // ORA zero page
        case 0x06:   d8 = readByte(operand);  d8 = asl_instr(d8);  writeByte(operand, d8);  break; // ASL zero page
        case 0x07:   d8 = readByte(operand);  d8 = asl_instr(d8);  writeByte(operand, d8);  or_instr(d8);  unofficial(opcode,pc); break; // SLO zero page (unofficial opcode)
        case 0x08:   push(p | P_B);  break; // PHP
        case 0x09:   or_instr(operand);  break; // ORA imm
        case 0x0a:   a = asl_instr(a);  break; // ASL A
        case 0x0d:   operand = readByte(operand);  or_instr(operand);  break; // ORA absolute
        case 0x0e:   d8 = readByte(operand);  d8 = asl_instr(d8);  writeByte(operand, d8);  break; // ASL absolute
        case 0x10:   if ((p & P_N) == 0) branch_instr(operand);  break; // BPL
        case 0x11:   addr = ind_y(operand);  operand = readByte(addr);  or_instr(operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // ORA (ind),Y
        case 0x15:   operand = readByte((operand + x) & 0xff);  or_instr(operand);  break; // ORA zero,X
        case 0x16:   addr = (operand + x) & 0xff;  d8 = readByte(addr);  d8 = asl_instr(d8);  writeByte(addr, d8);  break; // ASL zero,X
        case 0x18:   p &= ~P_C;  break; // CLC
        case 0x19:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  or_instr(operand);  break; // ORA absolute,Y
        case 0x1d:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  or_instr(operand);  break; // ORA absolute,X
        case 0x1e:       // ASL absolute,X
            addr = (operand + x) & 0xffff;
            d8 = readByte(addr);
            d8 = asl_instr(d8);
            writeByte(addr, d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        case 0x20:   pc--;  push(pc >> 8);  push(pc & 0xff);  pc = operand;  break; // JSR absolute
        case 0x21:   addr = ind_x(operand);  operand = readByte(addr);  and_instr(operand);  break; // AND (ind,X)
        case 0x24:   operand = readByte(operand);  bit_instr(operand);  break; // BIT zero page
        case 0x25:   operand = readByte(operand);  and_instr(operand);  break; // AND zero page
        case 0x26:   d8 = readByte(operand);  d8 = rol_instr(d8);  writeByte(operand, d8);  break; // ROL zero page
        case 0x28:   p = (pull() & ~P_B) | P_1;  break; // PLP
        case 0x29:   and_instr(operand);  break; // AND imm
        case 0x2a:   a = rol_instr(a);  break; // ROL A
        case 0x2c:   operand = readByte(operand);  bit_instr(operand);  break; // BIT absolute
        case 0x2d:   operand = readByte(operand);  and_instr(operand);  break; // AND absolute
        case 0x2e:   d8 = readByte(operand);  d8 = rol_instr(d8);  writeByte(operand, d8);  break; // ROL absolute
        case 0x30:   if ((p & P_N) != 0) branch_instr(operand);  break; // BMI
        case 0x31:   addr = ind_y(operand);  operand = readByte(addr);  and_instr(operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // AND (ind),Y
        case 0x35:   operand = readByte((operand + x) & 0xff);  and_instr(operand);  break; // AND zero, X
        case 0x36:   addr = (operand + x) & 0xff;  d8 = readByte(addr);  d8 = rol_instr(d8);  writeByte(addr, d8);  break; // ROL zero, X
        case 0x38:   p |= P_C;  break; // SEC
        case 0x39:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  and_instr(operand);  break; // AND absolute, Y
        case 0x3d:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  and_instr(operand);  break; // AND absolute, X
        case 0x3e:       // ROL absolute, X
            addr = (operand + x) & 0xffff;
            d8 = readByte(addr);
            d8 = rol_instr(d8);
            writeByte(addr, d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        case 0x40:   p = (pull() & ~P_B) | P_1;  pc = pull();  pc |= pull() << 8;  break; // RTI
        case 0x41:   addr = ind_x(operand);  operand = readByte(addr);  eor_instr(operand);  break; // EOR (ind, X)
        case 0x45:   operand = readByte(operand);  eor_instr(operand);  break; // EOR zero page
        case 0x46:   d8 = readByte(operand);  d8 = lsr_instr(d8);  writeByte(operand, d8);  break; // LSR zero page
        case 0x48:   push(a);  break; // PHA
        case 0x49:   eor_instr(operand);  break; // EOR imm
        case 0x4a:   a = lsr_instr(a);  break; // LSR A
        case 0x4c:   pc = operand;  break; // JMP absolute
        case 0x4d:   operand = readByte(operand);  eor_instr(operand);  break; // EOR absolute
        case 0x4e:   d8 = readByte(operand);  d8 = lsr_instr(d8);  writeByte(operand, d8);  break; // LSR absolute
        case 0x50:   if ((p & P_V) == 0) branch_instr(operand);  break; // BVC
        case 0x51:   addr = ind_y(operand);  operand = readByte(addr);  eor_instr(operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // EOR (indirect), Y
        case 0x55:   operand = readByte((operand + x) & 0xff);  eor_instr(operand);  break; // EOR zero, X
        case 0x56:   addr = (operand + x) & 0xff;  d8 = readByte(addr);  d8 = lsr_instr(d8);  writeByte(addr, d8);  break; // LSR zero, X
        case 0x58:   p &= ~P_I;  break; // CLI
        case 0x59:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  eor_instr(operand);  break; // EOR absolute,Y
        case 0x5d:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  eor_instr(operand);  break; // EOR absolute,X
        case 0x5e:       // LSR absolute,X
            addr = (operand + x) & 0xffff;
            d8 = readByte(addr);
            d8 = lsr_instr(d8);
            writeByte(addr, d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        case 0x60:   pc = pull();  pc |= pull() << 8;  pc++;  break; // RTS
        case 0x61:   addr = ind_x(operand);  operand = readByte(addr);  adc_instr(operand);  break; // ADC (ind,X)
        case 0x65:   operand = readByte(operand);  adc_instr(operand);  break; // ADC zero page
        case 0x66:   d8 = readByte(operand);  d8 = ror_instr(d8);  writeByte(operand, d8);  break; // ROR zero page
        case 0x68:   a = pull();  set_nz(a);  break; // PLA
        case 0x69:   adc_instr(operand);  break; // ADC imm
        case 0x6a:   a = ror_instr(a);  break; // ROR A
        case 0x6c:   pc = readWordBug(operand);  break; // JMP (ind)
        case 0x6d:   operand = readByte(operand);  adc_instr(operand);  break; // ADC absolute
        case 0x6e:   d8 = readByte(operand);  d8 = ror_instr(d8);  writeByte(operand, d8);  break; // ROR absolute
        case 0x70:   if ((p & P_V) != 0) branch_instr(operand);  break; // BVS
        case 0x71:   addr = ind_y(operand);  operand = readByte(addr);  adc_instr(operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // ADC (indirect),Y
        case 0x75:   operand = readByte((operand + x) & 0xff);  adc_instr(operand);  break; // ADC zero, X
        case 0x76:   addr = (operand + x) & 0xff;  d8 = readByte(addr);  d8 = ror_instr(d8);  writeByte(addr, d8);  break; // ROR zero, X
        case 0x78:   p |= P_I;  break; // SEI
        case 0x79:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  adc_instr(operand);  break; // ADC absolute,Y
        case 0x7d:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  adc_instr(operand);  break; // ADC absolute,X
        case 0x7e:       // ROR absolute,X
            addr = (operand + x) & 0xffff;
            d8 = readByte(addr);
            d8 = ror_instr(d8);
            writeByte(addr, d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        case 0x80:   unofficial(opcode,pc); break; // NOP imm / SKB / DOP
        case 0x81:   addr = ind_x(operand);  writeByte(addr, a);  break; // STA (ind, X)
        case 0x82:   unofficial(opcode,pc); break; // NOP imm / SKB / DOP
        case 0x84:   writeByte(operand, y);  break; // STY zero page
        case 0x85:   writeByte(operand, a);  break; // STA zero page
        case 0x86:   writeByte(operand, x);  break; // STX zero page
        case 0x88:   y = --y & 0xff;  set_nz(y);  break; // DEY
        case 0x89:   unofficial(opcode,pc); break; // NOP imm / SKB / DOP on NMOS 6502
        case 0x8a:   a = x;  set_nz(a);  break; // TXA
        case 0x8c:   writeByte(operand, y);  break; // STY absolute
        case 0x8d:   writeByte(operand, a);  break; // STA absolute
        case 0x8e:   writeByte(operand, x);  break; // STX absolute
        case 0x90:   if ((p & P_C) == 0) branch_instr(operand);  break; // BCC
        case 0x91:   addr = ind_y(operand);  writeByte(addr, a);  break; // STA (ind),Y
        case 0x94:   writeByte((operand + x) & 0xff, y);  break; // STY zero, X
        case 0x95:   writeByte((operand + x) & 0xff, a);  break; // STA zero, X
        case 0x96:   writeByte((operand + y) & 0xff, x);  break; // STX zero, Y
        case 0x98:   a = y;  set_nz(a);  break; // TYA
        case 0x99:   writeByte(operand + y, a);  break; // STA absolute, Y
        case 0x9a:   sp = x;  break; // TXS
        case 0x9d:   writeByte(operand + x, a);  break; // STA absolute, X
        case 0xa0:   y = operand;  set_nz(y);  break; // LDY imm
        case 0xa1:   addr = ind_x(operand);  operand = readByte(addr);  a = operand;  set_nz(a);  break; // LDA (ind, X)
        case 0xa2:   x = operand;  set_nz(x);  break; // LDX imm
        case 0xa4:   y = readByte(operand);  set_nz(y);  break; // LDY zero page
        case 0xa5:   a = readByte(operand);  set_nz(a);  break; // LDA zero page
        case 0xa6:   x = readByte(operand);  set_nz(x);  break; // LDX zero page
        case 0xa8:   y = a;  set_nz(y);  break; // TAY
        case 0xa9:   a = operand;  set_nz(a);  break; // LDA imm
        case 0xaa:   x = a;  set_nz(x);  break; // TAX
        case 0xac:   y = readByte(operand);  set_nz(y);  break; // LDY absolute
        case 0xad:   a = readByte(operand);  set_nz(a);  break; // LDA absolute
        case 0xae:   x = readByte(operand);  set_nz(x);  break; // LDX absolute
        case 0xb0:   if ((p & P_C) != 0) branch_instr(operand);  break; // BCS
        case 0xb1:   addr = ind_y(operand);  a = readByte(addr);  set_nz(a);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // LDA (ind),Y
        case 0xb4:   y = readByte((operand + x) & 0xff);  set_nz(y);  break; // LDY zero,X
        case 0xb5:   a = readByte((operand + x) & 0xff);  set_nz(a);  break; // LDA zero,X
        case 0xb6:   x = readByte((operand + y) & 0xff);  set_nz(x);  break; // LDX zero,Y
        case 0xb8:   p &= ~P_V;  break; // CLV
        case 0xb9:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  a = readByte(addr);  set_nz(a);  break; // LDA absolute, Y
        case 0xba:   x = sp;  set_nz(x);  break; // TSX
        case 0xbc:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  y = readByte(addr);  set_nz(y);  break; // LDY absolute, X
        case 0xbd:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  a = readByte(addr);  set_nz(a);  break; // LDA absolute, X
        case 0xbe:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  x = readByte(addr);  set_nz(x);  break; // LDX absolute, Y
        case 0xc0:   cmp_instr(y, operand);  break; // CPY imm
        case 0xc1:   addr = ind_x(operand);  operand = readByte(addr);  cmp_instr(a, operand);  break; // CMP (ind, X)
        case 0xc2:   unofficial(opcode,pc); break; // NOP imm / SKB / DOP
        case 0xc4:   operand = readByte(operand);  cmp_instr(y, operand);  break; // CPY zero
        case 0xc5:   operand = readByte(operand);  cmp_instr(a, operand);  break; // CMP zero
        case 0xc6:   d8 = (readByte(operand) - 1) & 0xff;  writeByte(operand, d8);  set_nz(d8);  break; // DEC zero
        case 0xc8:   y = ++y & 0xff;  set_nz(y);  break; // INY
        case 0xc9:   cmp_instr(a, operand);  break; // CMP imm
        case 0xca:   x = --x & 0xff;  set_nz(x);  break; // DEX
        case 0xcc:   operand = readByte(operand);  cmp_instr(y, operand);  break; // CPY absolute
        case 0xcd:   operand = readByte(operand);  cmp_instr(a, operand);  break; // CMP absolute
        case 0xce:   d8 = (readByte(operand) - 1) & 0xff;  writeByte(operand, d8);  set_nz(d8);  break; // DEC absolute
        case 0xd0:   if ((p & P_Z) == 0) branch_instr(operand);  break; // BNE
        case 0xd1:   addr = ind_y(operand);  operand = readByte(addr);  cmp_instr(a, operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // CMP (ind),Y
        case 0xd5:   operand = readByte((operand + x) & 0xff);  cmp_instr(a, operand);  break; // CMP zero,X
        case 0xd6:   addr = (operand + x) & 0xff;  d8 = (readByte(addr) - 1) & 0xff;  writeByte(addr, d8);  set_nz(d8);  break; // DEC zero,X
        case 0xd8:   p &= ~P_D;  break; // CLD
        case 0xd9:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  cmp_instr(a, operand);  break; // CMP absolute,Y
        case 0xdd:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  cmp_instr(a, operand);  break; // CMP absolute,X
        case 0xde:       // DEC absolute,X
            addr = (operand + x) & 0xffff;
            d8 = (readByte(addr) - 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        case 0xe0:   cmp_instr(x, operand);  break; // CPX imm
        case 0xe1:   addr = ind_x(operand);  operand = readByte(addr);  sbc_instr(operand);  break; // SBC (ind,X)
        case 0xe2:   unofficial(opcode,pc); break; // NOP imm / SKB / DOP
        case 0xe4:   operand = readByte(operand);  cmp_instr(x, operand);  break; // CPX zero
        case 0xe5:   operand = readByte(operand);  sbc_instr(operand);  break; // SBC zero
        case 0xe6:   d8 = (readByte(operand) + 1) & 0xff;  writeByte(operand, d8);  set_nz(d8);  break; // INC zero
        case 0xe8:   x = ++x & 0xff;  set_nz(x);  break; // INX
        case 0xe9:   sbc_instr(operand);  break; // SBC imm
        case 0xea:   break; // NOP
        case 0xec:   operand = readByte(operand);  cmp_instr(x, operand);  break; // CPX absolute
        case 0xed:   operand = readByte(operand);  sbc_instr(operand);  break; // SBC absolute
        case 0xee:   d8 = (readByte(operand) + 1) & 0xff;  writeByte(operand, d8);  set_nz(d8);  break; // INC absolute
        case 0xf0:   if ((p & P_Z) != 0) branch_instr(operand);  break; // BEQ
        case 0xf1:   addr = ind_y(operand);  operand = readByte(addr);  sbc_instr(operand);  if (((addr - y) ^ addr) & 0xff00) cycle_delay++;  break; // SBC (ind),Y
        case 0xf5:   operand = readByte((operand + x) & 0xff);  sbc_instr(operand);  break; // SBC zero,X
        case 0xf6:   addr = (operand + x) & 0xff;  d8 = (readByte(addr) + 1) & 0xff;  writeByte(addr, d8);  set_nz(d8);  break; // INC zero,X
        case 0xf8:   p |= P_D;  break; // SED
        case 0xf9:   addr = operand + y;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  sbc_instr(operand);  break; // SBC absolute,Y
        case 0xfd:   addr = operand + x;  if ((operand ^ addr) & 0xff00) cycle_delay++;  operand = readByte(addr);  sbc_instr(operand);  break; // SBC absolute,X
        case 0xfe:       // INC absolute,X
            addr = (operand + x) & 0xffff;
            d8 = (readByte(addr) + 1) & 0xff;
            writeByte(addr, d8);
            set_nz(d8);
            cycle_delay++; // absolute,X read-modify-write is 7 cycles
            break;
        default:  console.warn("Cpu6502:cycle: undefined opcode: 0x%s pc=$%s",opcode.toString(16), pc.toString(16).toUpperCase());
        }

        //https://www.nesdev.org/wiki/CPU_unofficial_opcodes
        function unofficial(opcode,pc) { console.warn("Cpu6502:cycle: unofficial opcode: 0x%s pc=$%s",opcode.toString(16), pc.toString(16).toUpperCase()); }

    }


    //     ___                                  __        
    //   .'   `.                               |  ]       
    //  /  .-.  \ _ .--.   .---.   .--.    .--.| | .---.  
    //  | |   | |[ '/'`\ \/ /'`\]/ .'`\ \/ /'`\' |/ /__\\ 
    //  \  `-'  / | \__/ || \__. | \__. || \__/  || \__., 
    //   `.___.'  | ;.__/ '.___.' '.__.'  '.__.;__]'.__.' 
    //           [__|                                     
    //  ██   ██ ███████ ██      ██████  ███████ ██████  ███████ 
    //  ██   ██ ██      ██      ██   ██ ██      ██   ██ ██      
    //  ███████ █████   ██      ██████  █████   ██████  ███████ 
    //  ██   ██ ██      ██      ██      ██      ██   ██      ██ 
    //  ██   ██ ███████ ███████ ██      ███████ ██   ██ ███████ 


    function ind_x(operand) { return readWordZp(operand + x); }
    function ind_y(operand) { return (readWordZp(operand) + y) & 0xffff; }
    function set_flag(flag, cond) { p = (cond != 0) ? p | flag : p & ~flag; }
    function set_nz(d8) { p = (p & ~(P_N | P_Z)) | nz_flags[d8 & 0xff]; }
    function asl_instr(d8) 
    {
        set_flag(P_C, d8 & 0x80);
        d8 = (d8 << 1) & 0xff;
        set_nz(d8);
        return d8;
    }

    function lsr_instr(d8)
    {
        set_flag(P_C, d8 & 0x01);   //[flag,cond] //  p = ((d8 & 0x01) != 0) ? (p | P_C) : (p & ~P_C);
        d8 >>= 1;
        set_nz(d8);
        return d8;
    }

    function rol_instr(d8) 
    {
        var old_c = ((p & P_C) != 0) ? 0x01 :0x00;
        set_flag(P_C, d8 & 0x80);
        d8 = ((d8 << 1) | old_c) & 0xff;
        set_nz(d8);
        return d8;
    }

    function ror_instr(d8) 
    {
        var old_c = ((p & P_C) != 0) ? 0x80 :0x00;
        set_flag(P_C, d8 & 0x01);
        d8 = (d8 >> 1) | old_c;
        set_nz(d8);
        return d8;
    }

    function or_instr(d8)  { a |= d8; set_nz(a); }
    function and_instr(d8) { a &= d8; set_nz(a); }
    function eor_instr(d8) { a ^= d8; set_nz(a); }

    function adc_instr(d8) {
        var result;

        if ((p & P_D) != 0)           // Decimal mode
        {
            result = (a & 0x0f) + (d8 & 0x0f) + ((p & P_C) ? 1 : 0);
            if (result > 0x09) result += 0x06;
            result += (a & 0xf0) + (d8 & 0xf0);
            if ((result & 0xfff0) > 0x90) result += 0x60;
            cycle_delay++;
        }
        else result = a + d8 + ((p & P_C) ? 1 : 0);

        set_flag(P_C, result & 0xff00);
        set_flag(P_V, ((d8 ^ a) & 0x80) == 0 && ((result ^ a) & 0x80) != 0);
        a = result & 0xff;
        set_nz(a);
    }

    function sbc_instr(d8) 
    {
        var result;
        if ((p & P_D) != 0)        // Decimal mode
        {
            result = (a & 0x0f) - (d8 & 0x0f) - ((p & P_C) ? 0 : 1);
            if ((result & 0x10) != 0)  result -= 0x06;
            result += (a & 0xf0) - (d8 & 0xf0);
            if ((result & 0x100) != 0) result -= 0x60;
            cycle_delay++;
        }
        else result = a - d8 - ((p & P_C) ? 0 : 1);

        set_flag(P_C, (result & 0xff00) == 0);
        set_flag(P_V, ((d8 ^ a) & 0x80) != 0 && ((result ^ a) & 0x80) != 0);
        a = result & 0xff;
        set_nz(a);
    }

    function cmp_instr(left, right) 
    {
        var result = left - right;
        set_flag(P_C, (result & 0xff00) == 0);
        set_nz(result);
    }

    function bit_instr(d8) { set_flag(P_N, d8 & 0x80); set_flag(P_V, d8 & 0x40); set_flag(P_Z, (d8 & a) == 0); }

    function branch_instr(operand)
    {
        var old_pc = pc;
        pc = operand >= 0x80 ? (pc + operand - 0x100) & 0xffff : (pc + operand) & 0xffff;
        cycle_delay++; // branch taken
        if ((old_pc ^ pc) & 0xff00) cycle_delay++; // branch crossed a page
    }

    function push(d8) { writeByte(STACK_ADDR + sp, d8); sp = (sp - 1) & 0xff; }
    function pull() { sp = (sp + 1) & 0xff; return readByte(STACK_ADDR + sp); }

//    ______                                            _    _                   
//  .' ____ \                                          / |_ (_)                  
//  | (___ \_|__   _  _ .--.   _ .--.    .--.   _ .--.`| |-'__   _ .--.   .--./) 
//   _.____`.[  | | |[ '/'`\ \[ '/'`\ \/ .'`\ \[ `/'`\]| | [  | [ `.-. | / /'`\; 
//  | \____) || \_/ |,| \__/ | | \__/ || \__. | | |    | |, | |  | | | | \ \._// 
//   \______.''.__.'_/| ;.__/  | ;.__/  '.__.' [___]   \__/[___][___||__].',__`  
//                   [__|     [__|                                      ( ( __)) 
//  ███████ ██    ██ ███    ██  ██████ ████████ ██  ██████  ███    ██ ███████ 
//  ██      ██    ██ ████   ██ ██         ██    ██ ██    ██ ████   ██ ██      
//  █████   ██    ██ ██ ██  ██ ██         ██    ██ ██    ██ ██ ██  ██ ███████ 
//  ██      ██    ██ ██  ██ ██ ██         ██    ██ ██    ██ ██  ██ ██      ██ 
//  ██       ██████  ██   ████  ██████    ██    ██  ██████  ██   ████ ███████ 

    this.load = function(s) 
    {
        var l = s.split(',');
        a =  parseInt(l[0], 16) & 0xff;
        x =  parseInt(l[1], 16) & 0xff;
        y =  parseInt(l[2], 16) & 0xff;
        sp = parseInt(l[3], 16) & 0xff;
        p =  (parseInt(l[4], 16) & ~P_B) | P_1;
        pc = parseInt(l[5], 16) & 0xffff;
    }

    this.save = function()
    {
        return a.toString(16) + ',' +
               x.toString(16) + ',' +
               y.toString(16) + ',' +
               sp.toString(16)+ ',' +
               p.toString(16) + ',' +
               pc.toString(16);
    }

    this.watch = function()     {  return {"a":a,"x":x,"y":y,"sp":sp,"p":p,"pc":pc,"cycle_delay":cycle_delay} }
    this.getConfig = function() { return { "instrlen":instrlen,"cycle_count":cycle_count,"opctab":opctab } }

    /*
    this.getBootLog = function()
    {
        var rows = [];

        for (var i = 0; i < BOOTcnt; i++)
        {
            var packed = BOOTlog_opc[i] >>> 0;
            var opc = packed & 0xff;
            var len = instrlen[opc] || 1;

            var bytes = [opc];
            if (len > 1) bytes[1] = (packed >>> 8) & 0xff;
            if (len > 2) bytes[2] = (packed >>> 16) & 0xff;

            rows[i] = {
                "idx": i,
                "adr": BOOTlog_adr[i],
                "opc": opc,
                "len": len,
                "bytes": bytes
            };
        }

        return rows;
    }
    */

    this.getBootLog = function()
    {
        flushBootGroupPending();

        var rows = [];

        for (var i = 0; i < BOOTcnt; i++)
        {
            var packed = BOOTlog_cpu[i];
            var opc = Number(packed & 0xffn);
            var len = instrlen[opc] || 1;

            var bytes = [opc];
            if (len > 1) bytes[1] = Number((packed >> 8n) & 0xffn);
            if (len > 2) bytes[2] = Number((packed >> 16n) & 0xffn);

            rows[i] = {
                "idx": i,
                "adr": BOOTlog_adr[i],
                "opc": opc,
                "len": len,
                "bytes": bytes,
                "a":  Number((packed >> 24n) & 0xffn),
                "x":  Number((packed >> 32n) & 0xffn),
                "y":  Number((packed >> 40n) & 0xffn),
                "p":  Number((packed >> 48n) & 0xffn),
                "sp": Number((packed >> 56n) & 0xffn)
            };
        }

        return rows;
    }

    this.getBootLogFilters = function()
    {
        return memberTable;
    }

    this.getBootLogBase64 = function()
    {
        flushBootGroupPending();

        var bytes = new Uint8Array(BOOTcnt * BOOT_RECORD_BYTES);

        for (var i = 0, o = 0; i < BOOTcnt; i++, o += BOOT_RECORD_BYTES)
        {
            var adr = BOOTlog_adr[i] & 0xffff;
            var packed = BOOTlog_cpu[i];

            bytes[o    ] = adr & 0xff;
            bytes[o + 1] = adr >> 8;
            bytes[o + 2] = Number( packed        & 0xffn);  // opcode
            bytes[o + 3] = Number((packed >> 8n)  & 0xffn);  // op1
            bytes[o + 4] = Number((packed >> 16n) & 0xffn);  // op2
            bytes[o + 5] = Number((packed >> 24n) & 0xffn);  // A
            bytes[o + 6] = Number((packed >> 32n) & 0xffn);  // X
            bytes[o + 7] = Number((packed >> 40n) & 0xffn);  // Y
            bytes[o + 8] = Number((packed >> 48n) & 0xffn);  // P
            bytes[o + 9] = Number((packed >> 56n) & 0xffn);  // SP
        }

        return u8ToBase64(bytes);
    };

    // Backward-compatible export for the old 5-byte disassembler input:
    //   PClo PChi OPC OP1 OP2
    this.getBootLogBase64_legacy = function()
    {
        flushBootGroupPending();

        var bytes = new Uint8Array(BOOTcnt * 5);

        for (var i = 0, o = 0; i < BOOTcnt; i++, o += 5)
        {
            var adr = BOOTlog_adr[i] & 0xffff;
            var packed = BOOTlog_cpu[i];

            bytes[o    ] = adr & 0xff;
            bytes[o + 1] = adr >> 8;
            bytes[o + 2] = Number( packed        & 0xffn);
            bytes[o + 3] = Number((packed >> 8n)  & 0xffn);
            bytes[o + 4] = Number((packed >> 16n) & 0xffn);
        }

        return u8ToBase64(bytes);
    };

    function u8ToBase64(bytes)
    {
        var s = "";
        for (var i = 0; i < bytes.length; i++)
            s += String.fromCharCode(bytes[i]);
        return btoa(s);
    }

    this.clearBootLog = function()
    {
        BOOTcnt = 0;
        resetBootGroupState();
    }

}