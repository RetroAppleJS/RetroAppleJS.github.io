/*
 * ASM_core_v4.js
 * Clean 6502 assembler-analysis core for RetroAppleJS-style tooling.
 *
 * Goals:
 * - One ASM() container only.
 * - No DASM(), no mocha_test(), no browser DOM dependencies.
 * - Two-pass source analysis.
 * - Main public function: asm.tokenise(sourceText) -> JSON statement array.
 *
 * v4 architecture:
 * - Pragmas/directives keep their parser functions inside this.pragma entries.
 * - 6502 mnemonics keep their parser functions inside this.mnemonics entries.
 * - Metadata/unclassified statement handling is dispatched through this.metadata entries.
 * - This makes tokenisation/parsing consistently table-driven.
 */


function ASM(options) 
{
    options = options || {};

    var self = this;

    this.version = "4.0.0";
    this.maxNumBytes = options.maxNumBytes || 2;
    this.label_len = options.label_len || 64;
    this.pc = 0;
    this.symtab = {};
    this.symlink = {};
    this.code_pc = [];
    this.errors = [];
    this.warnings = [];
    this.passNo = 0;

    // Addressing mode order deliberately matches the original RetroAppleJS table.
    this.addrModeName = ["imp", "acc", "imm", "abs", "abx", "aby", "zpg", "zpx", "zpy", "ind", "inx", "iny", "rel"];
    this.addrModeLongName = {
        imp: "implicit",
        acc: "accumulator",
        imm: "immediate",
        abs: "absolute",
        abx: "absolute,x",
        aby: "absolute,y",
        zpg: "zero-page",
        zpx: "zero-page,x",
        zpy: "zero-page,y",
        ind: "indirect",
        inx: "(indirect,X)",
        iny: "(indirect),Y",
        rel: "relative"
    };
    this.steptab = [1, 1, 2, 3, 3, 3, 2, 2, 2, 3, 2, 2, 2];
    this.addrtab = { imp: 0, acc: 1, imm: 2, abs: 3, abx: 4, aby: 5, zpg: 6, zpx: 7, zpy: 8, ind: 9, inx: 10, iny: 11, rel: 12 };

    this.defaultAsmCompatibility = ["raJS", "ca65"];

    function mkInstruction(opcodes, asmList) {
        return {
            opcodes: opcodes,
            asm: asmList || self.defaultAsmCompatibility.slice(),
            parser: parseMnemonic
        };
    }

    function mkPragma(ref, asmList, parser) {
        return {
            ref: ref,
            asm: asmList || ["raJS"],
            parser: parser
        };
    }

    function mkMeta(asmList, parser) {
        return {
            asm: asmList || [],
            parser: parser
        };
    }

    // 6502 mnemonic table. Each entry is now a dataset object with opcodes + parser.
    // -1 means the addressing mode is invalid for that mnemonic.
    this.mnemonics = {
        ADC: mkInstruction([-1, -1, 0x69, 0x6d, 0x7d, 0x79, 0x65, 0x75, -1, -1, 0x61, 0x71, -1]),
        AND: mkInstruction([-1, -1, 0x29, 0x2d, 0x3d, 0x39, 0x25, 0x35, -1, -1, 0x21, 0x31, -1]),
        ASL: mkInstruction([-1, 0x0a, -1, 0x0e, 0x1e, -1, 0x06, 0x16, -1, -1, -1, -1, -1]),
        BCC: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x90]),
        BCS: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xb0]),
        BEQ: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xf0]),
        BIT: mkInstruction([-1, -1, -1, 0x2c, -1, -1, 0x24, -1, -1, -1, -1, -1, -1]),
        BMI: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x30]),
        BNE: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xd0]),
        BPL: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x10]),
        BRK: mkInstruction([0x00, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        BVC: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x50]),
        BVS: mkInstruction([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x70]),
        CLC: mkInstruction([0x18, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        CLD: mkInstruction([0xd8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        CLI: mkInstruction([0x58, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        CLV: mkInstruction([0xb8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        CMP: mkInstruction([-1, -1, 0xc9, 0xcd, 0xdd, 0xd9, 0xc5, 0xd5, -1, -1, 0xc1, 0xd1, -1]),
        CPX: mkInstruction([-1, -1, 0xe0, 0xec, -1, -1, 0xe4, -1, -1, -1, -1, -1, -1]),
        CPY: mkInstruction([-1, -1, 0xc0, 0xcc, -1, -1, 0xc4, -1, -1, -1, -1, -1, -1]),
        DEC: mkInstruction([-1, -1, -1, 0xce, 0xde, -1, 0xc6, 0xd6, -1, -1, -1, -1, -1]),
        DEX: mkInstruction([0xca, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        DEY: mkInstruction([0x88, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        EOR: mkInstruction([-1, -1, 0x49, 0x4d, 0x5d, 0x59, 0x45, 0x55, -1, -1, 0x41, 0x51, -1]),
        INC: mkInstruction([-1, -1, -1, 0xee, 0xfe, -1, 0xe6, 0xf6, -1, -1, -1, -1, -1]),
        INX: mkInstruction([0xe8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        INY: mkInstruction([0xc8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        JMP: mkInstruction([-1, -1, -1, 0x4c, -1, -1, -1, -1, -1, 0x6c, -1, -1, -1]),
        JSR: mkInstruction([-1, -1, -1, 0x20, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        LDA: mkInstruction([-1, -1, 0xa9, 0xad, 0xbd, 0xb9, 0xa5, 0xb5, -1, -1, 0xa1, 0xb1, -1]),
        LDX: mkInstruction([-1, -1, 0xa2, 0xae, -1, 0xbe, 0xa6, -1, 0xb6, -1, -1, -1, -1]),
        LDY: mkInstruction([-1, -1, 0xa0, 0xac, 0xbc, -1, 0xa4, 0xb4, -1, -1, -1, -1, -1]),
        LSR: mkInstruction([-1, 0x4a, -1, 0x4e, 0x5e, -1, 0x46, 0x56, -1, -1, -1, -1, -1]),
        NOP: mkInstruction([0xea, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        ORA: mkInstruction([-1, -1, 0x09, 0x0d, 0x1d, 0x19, 0x05, 0x15, -1, -1, 0x01, 0x11, -1]),
        PHA: mkInstruction([0x48, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        PHP: mkInstruction([0x08, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        PLA: mkInstruction([0x68, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        PLP: mkInstruction([0x28, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        ROL: mkInstruction([-1, 0x2a, -1, 0x2e, 0x3e, -1, 0x26, 0x36, -1, -1, -1, -1, -1]),
        ROR: mkInstruction([-1, 0x6a, -1, 0x6e, 0x7e, -1, 0x66, 0x76, -1, -1, -1, -1, -1]),
        RTI: mkInstruction([0x40, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        RTS: mkInstruction([0x60, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        SBC: mkInstruction([-1, -1, 0xe9, 0xed, 0xfd, 0xf9, 0xe5, 0xf5, -1, -1, 0xe1, 0xf1, -1]),
        SEC: mkInstruction([0x38, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        SED: mkInstruction([0xf8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        SEI: mkInstruction([0x78, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        STA: mkInstruction([-1, -1, -1, 0x8d, 0x9d, 0x99, 0x85, 0x95, -1, -1, 0x81, 0x91, -1]),
        STX: mkInstruction([-1, -1, -1, 0x8e, -1, -1, 0x86, -1, 0x96, -1, -1, -1, -1]),
        STY: mkInstruction([-1, -1, -1, 0x8c, -1, -1, 0x84, 0x94, -1, -1, -1, -1, -1]),
        TAX: mkInstruction([0xaa, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        TAY: mkInstruction([0xa8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        TSX: mkInstruction([0xba, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        TXA: mkInstruction([0x8a, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        TXS: mkInstruction([0x9a, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]),
        TYA: mkInstruction([0x98, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1])
    };

    // Pragmas/directives. Parser functions are intentionally in the dataset.
    this.pragma = {
        "ORG":   mkPragma("ORG",     ["raJS", "ca65"], parsePragmaORG),
        ".ORG":  mkPragma("ORG",     ["raJS", "ca65"], parsePragmaORG),
        "*=":    mkPragma("ORG",     ["raJS"], parsePragmaORG),
        "OBJ":   mkPragma("ORG",     ["raJS", "Merlin"], parsePragmaORG),
        ".OR":   mkPragma("ORG",     ["raJS", "S-C"], parsePragmaORG),

        "EQU":   mkPragma("EQU",     ["raJS", "ca65"], parsePragmaEQU),
        "=":     mkPragma("EQU",     ["raJS", "Merlin", "S-C"], parsePragmaEQU),
        ".EQ":   mkPragma("EQU",     ["raJS", "S-C"], parsePragmaEQU),

        ".BYTE": mkPragma("BYTE",    ["raJS", "ca65", "S-C"], parsePragmaData),
        "DFB":   mkPragma("BYTE",    ["raJS", "Merlin"], parsePragmaData),
        "DB":    mkPragma("BYTE",    ["raJS"], parsePragmaData),
        "HEX":   mkPragma("HEX",     ["raJS", "Merlin"], parsePragmaData),
        "BIN":   mkPragma("BIN",     ["raJS"], parsePragmaData),
        "ASC":   mkPragma("ASC",     ["raJS", "Merlin"], parsePragmaData),
        ".AT":   mkPragma("ASC",     ["raJS", "S-C"], parsePragmaData),

        ".WORD": mkPragma("WORD",    ["raJS", "ca65", "S-C"], parsePragmaData),
        "DA":    mkPragma("WORD",    ["raJS", "Merlin"], parsePragmaData),
        "DDB":   mkPragma("WORD_BE", ["raJS", "Merlin"], parsePragmaData),

        ".RES":  mkPragma("RES",     ["raJS", "ca65"], parsePragmaData),
        ".DS":   mkPragma("RES",     ["raJS", "Merlin"], parsePragmaData),

        ".END":  mkPragma("END",     ["raJS", "ca65", "S-C", "Merlin"], parsePragmaNoop),
        "DO":    mkPragma("COND",    ["raJS", "Merlin"], parsePragmaNoop),
        "ELSE":  mkPragma("COND",    ["raJS", "Merlin"], parsePragmaNoop),
        "FIN":   mkPragma("COND",    ["raJS", "Merlin"], parsePragmaNoop)
    };

    // Metadata / non-code classifications, also table-driven.
    this.metadata = {
        "LBL": mkMeta(["raJS", "ca65", "S-C", "Merlin"], parseMetadataLabel),
        "---": mkMeta([], parseMetadataUnknown)
    };

    this.reset = function () {
        this.pc = 0;
        this.symtab = {};
        this.symlink = {};
        this.code_pc = [];
        this.errors = [];
        this.warnings = [];
        this.passNo = 0;
        return this;
    };

    this.set_pc = function (value) {
        value = Number(value);
        if (isNaN(value)) value = 0;
        this.pc = value & 0xffff;
        return this.pc;
    };

    this.add_pc = function (delta) {
        delta = Number(delta);
        if (isNaN(delta)) delta = 0;
        return this.set_pc(this.pc + delta);
    };

    this.getHexByte = function (value) {
        value = Number(value) & 0xff;
        if (oCOM && typeof oCOM.getHexByte === "function") return oCOM.getHexByte(value);
        return ("0" + value.toString(16).toUpperCase()).slice(-2);
    };

    this.getHexWord = function (value) {
        value = Number(value) & 0xffff;
        if (oCOM && typeof oCOM.getHexWord === "function") return oCOM.getHexWord(value);
        return ("000" + value.toString(16).toUpperCase()).slice(-4);
    };

    this.pcHex = function (value) {
        return "0x" + this.getHexWord(value);
    };

    this.opcHex = function (value) {
        return "0x" + this.getHexByte(value);
    };

    this.valHex = function (value, bytes) {
        return bytes === 1 ? "0x" + this.getHexByte(value) : "0x" + this.getHexWord(value);
    };

    this.isMnemonic = function (token) {
        return !!this.mnemonicInfo(token);
    };

    this.isPragma = function (token) {
        return !!this.pragmaInfo(token);
    };

    this.mnemonicInfo = function (token) {
        return this.mnemonics[String(token || "").toUpperCase()] || null;
    };

    this.pragmaInfo = function (token) {
        return this.pragma[String(token || "").toUpperCase()] || null;
    };

    this.metadataInfo = function (tagName) {
        return this.metadata[String(tagName || "").toUpperCase()] || null;
    };

    this.getID = function (text) {
        text = String(text || "").trim();
        text = text.split("+")[0].split("-")[0];
        return text.substring(0, this.label_len);
    };

    this.splitSource = function (sourceText) {
        return String(sourceText == null ? "" : sourceText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    };

    this.stripRightComment = function (line) {
        var text = String(line || "").replace(/[“”]/g, "\"");
        var out = "";
        var quote = "";
        var escaped = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (escaped) { out += ch; escaped = false; continue; }
            if (ch === "\\") { out += ch; escaped = true; continue; }
            if (quote) {
                out += ch;
                if (ch === quote) quote = "";
                continue;
            }
            if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
            if (ch === ";") break;
            out += ch;
        }
        return out;
    };

    this.splitCSV = function (text) {
        text = String(text == null ? "" : text);
        if (oCOM && oCOM.CSVParser && typeof oCOM.CSVParser.parse === "function") {
            return oCOM.CSVParser.parse(text).filter(function (s) { return s != null && String(s).length > 0; });
        }
        var out = [];
        var cur = "";
        var quote = "";
        var escaped = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (escaped) { cur += ch; escaped = false; continue; }
            if (ch === "\\") { cur += ch; escaped = true; continue; }
            if (quote) {
                cur += ch;
                if (ch === quote) quote = "";
                continue;
            }
            if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
            if (ch === ",") { out.push(cur.trim()); cur = ""; continue; }
            cur += ch;
        }
        out.push(cur.trim());
        return out.filter(function (s) { return s.length > 0; });
    };

    this.statement_splitter = function (line) {
        var text = this.stripRightComment(line).trim();
        if (!text) return [];
        var sym = [];
        var token = "";
        var quote = "";
        var escaped = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (escaped) { token += ch; escaped = false; continue; }
            if (ch === "\\") { token += ch; escaped = true; continue; }
            if (quote) {
                token += ch;
                if (ch === quote) quote = "";
                continue;
            }
            if (ch === "'" || ch === '"') { quote = ch; token += ch; continue; }
            if (ch === " " || ch === "\t") {
                if (token) { sym.push(token); token = ""; }
                continue;
            }
            token += ch;
        }
        if (token) sym.push(token);
        return sym;
    };

    this.statement_tagger = function (sym) {
        sym = sym || [];
        var tag = [];
        if (sym.length === 0) return tag;

        var s0 = String(sym[0] || "").toUpperCase();
        var s1 = String(sym[1] || "").toUpperCase();

        if (this.isMnemonic(s0)) {
            tag[0] = "MNE";
            if (sym[1] != null) tag[1] = "OPR";
        } else if (this.isMnemonic(s1)) {
            tag[0] = "LBL";
            tag[1] = "MNE";
            if (sym[2] != null) tag[2] = "OPR";
        } else if (this.isPragma(s0)) {
            tag[0] = "PGM";
            if (sym[1] != null) tag[1] = "OPR";
        } else if (this.isPragma(s1)) {
            tag[0] = "LBL";
            tag[1] = "PGM";
            if (sym[2] != null) tag[2] = "OPR";
        } else if (sym.length === 1) {
            tag[0] = "LBL";
        } else {
            tag[0] = "---";
        }
        return tag;
    };

    this.getTokenByTag = function (sym, tag, wanted) {
        for (var i = 0; i < tag.length; i++) if (tag[i] === wanted) return sym[i];
        return undefined;
    };

    this.getTokenIndexByTag = function (tag, wanted) {
        for (var i = 0; i < tag.length; i++) if (tag[i] === wanted) return i;
        return -1;
    };

    this.getOperandToken = function (sym, tag) {
        var idx = this.getTokenIndexByTag(tag, "OPR");
        return idx >= 0 ? sym.slice(idx).join(" ") : undefined;
    };

    this.registerLabelLocation = function (row, passNo) {
        if (passNo !== 1 || row.tag[0] !== "LBL") return;
        var label = this.getID(row.sym[0]);
        if (!label) return;
        this.symtab[label] = this.pc;
        this.symlink[label] = { type: "loc", pc: this.pc };
    };

    this.registerLabelDefinition = function (row, passNo, value) {
        if (passNo !== 1 || row.tag[0] !== "LBL") return;
        var label = this.getID(row.sym[0]);
        if (!label) return;
        this.symtab[label] = value & 0xffff;
        this.symlink[label] = { type: "def", val: value & 0xffff };
    };

    this.cleanOperandValue = function (operand, mode) {
        var s = String(operand == null ? "" : operand).trim();
        var u = s.toUpperCase();
        if (mode === 2) return s.substring(1); // #value
        if (mode === 6 || mode === 7 || mode === 8) s = s.charAt(0) === "*" ? s.substring(1) : s;
        u = s.toUpperCase();
        if (mode === 7 || mode === 4) return s.substring(0, u.lastIndexOf(",X"));
        if (mode === 8 || mode === 5) return s.substring(0, u.lastIndexOf(",Y"));
        if (mode === 9) return s.substring(1, s.lastIndexOf(")"));
        if (mode === 10) return s.substring(1, u.lastIndexOf(",X)"));
        if (mode === 11) return s.substring(1, u.lastIndexOf("),Y"));
        return s;
    };

    this.operandByteSizeFromValue = function (value) {
        value = Number(value);
        if (isNaN(value)) return undefined;
        if (value < 0) value = ((~(-value) & 0xffff) + 1) & 0xffff;
        return value <= 0xff ? 1 : 2;
    };

    this.getNumber = function (text, symtab) {
        text = String(text == null ? "" : text).trim();
        symtab = symtab || this.symtab;
        if (!text) return { val: NaN, err: "empty number" };

        var hiLo = text.charAt(0);
        if (hiLo === ">" || hiLo === "<") {
            var inner = this.getExpression(text.substring(1), symtab);
            if (inner.err) return inner;
            var v = hiLo === ">" ? ((inner.val >> 8) & 0xff) : (inner.val & 0xff);
            return { val: v, bytes: 1, fmt: hiLo === ">" ? "HI" : "LO" };
        }

        if (/^\$[0-9a-f]+$/i.test(text)) {
            var hv = parseInt(text.substring(1), 16);
            return { val: hv, bytes: Math.max(1, Math.ceil((text.length - 1) / 2)), fmt: "HEX" };
        }
        if (/^%[01]+$/.test(text)) {
            var bv = parseInt(text.substring(1), 2);
            return { val: bv, bytes: Math.max(1, Math.ceil((text.length - 1) / 8)), fmt: "BIN" };
        }
        if (/^[+-]?[0-9]+$/.test(text)) {
            var dv = parseInt(text, 10);
            return { val: dv, bytes: this.operandByteSizeFromValue(dv), fmt: "DEC" };
        }
        if ((text.charAt(0) === '"' || text.charAt(0) === "'") && text.charAt(text.length - 1) === text.charAt(0)) {
            var body = text.substring(1, text.length - 1);
            if (body.length === 1) return { val: body.charCodeAt(0) | (text.charAt(0) === '"' ? 0x80 : 0), bytes: 1, fmt: "ASC" };
            return { val: body.split("").map(function (c) { return c.charCodeAt(0) | (text.charAt(0) === '"' ? 0x80 : 0); }), bytes: body.length, fmt: "ASC", type: "string" };
        }

        var id = this.getID(text);
        if (Object.prototype.hasOwnProperty.call(symtab, id)) {
            var sv = symtab[id];
            return { val: sv, bytes: this.operandByteSizeFromValue(sv), fmt: "ID" };
        }
        return { val: NaN, err: "identifier does not exist: " + text };
    };

    this.getExpression = function (text, symtab) {
        text = String(text == null ? "" : text).trim();
        symtab = symtab || this.symtab;
        if (!text) return { val: NaN, err: "empty expression" };

        // Single number/symbol/string fast path.
        if (/^(>|<)?(\$[0-9a-f]+|%[01]+|[+-]?[0-9]+|[A-Za-z_.$][A-Za-z0-9_.$-]*|"[^"]*"|'[^']*')$/i.test(text)) {
            return this.getNumber(text, symtab);
        }

        var unresolved = [];
        var js = text.replace(/\$[0-9a-f]+|%[01]+|[A-Za-z_.$][A-Za-z0-9_.$-]*/gi, function (tok) {
            if (tok.charAt(0) === "$") return "0x" + tok.substring(1);
            if (tok.charAt(0) === "%") return "0b" + tok.substring(1);
            var id = self.getID(tok);
            if (Object.prototype.hasOwnProperty.call(symtab, id)) return String(symtab[id]);
            if (/^(and|or|not)$/i.test(tok)) return tok;
            unresolved.push(tok);
            return "NaN";
        });
        if (unresolved.length) return { val: NaN, err: "unresolved identifier(s): " + unresolved.join(", ") };
        if (!/^[0-9a-fxobA-FXOB+\-*/%&|^~()<> \t.]+$/.test(js)) return { val: NaN, err: "unsafe expression: " + text };
        try {
            /* eslint no-new-func: 0 */
            var val;
            if (oCOM && typeof oCOM.MathParser === "function") {
                try { val = new oCOM.MathParser().parse(js); }
                catch (_ignore) { val = Function("return (" + js + ")")(); }
            } else {
                val = Function("return (" + js + ")")();
            }
            return { val: Number(val), bytes: this.operandByteSizeFromValue(Number(val)), fmt: "EXP" };
        } catch (err) {
            return { val: NaN, err: "expression error: " + err.message };
        }
    };

    this.isValidMode = function (entry, mode) {
        var opctab = entry && entry.opcodes ? entry.opcodes : entry;
        return !!opctab && mode >= 0 && mode < opctab.length && opctab[mode] >= 0;
    };

    this.inferAddressMode = function (mnemonic, operand) {
        var mne = String(mnemonic || "").toUpperCase();
        var entry = this.mnemonicInfo(mne);
        var opctab = entry && entry.opcodes;
        if (!opctab) return { mode: null, mod: undefined, bytes: 0, oby: undefined, opc: undefined, err: "unknown mnemonic" };

        if (operand === undefined || operand === null || String(operand).trim() === "") {
            if (this.isValidMode(entry, 0)) return this.modeInfo(0, opctab[0]);
            if (this.isValidMode(entry, 1)) return this.modeInfo(1, opctab[1]);
            return { mode: null, mod: undefined, bytes: 0, oby: undefined, opc: undefined, err: "missing operand" };
        }

        var addr = String(operand).trim();
        var upper = addr.toUpperCase();
        var mode = null;

        if (upper === "A" && this.isValidMode(entry, 1)) mode = 1;
        else if (addr.charAt(0) === "#") mode = 2;
        else if (addr.charAt(0) === "*") {
            if (upper.indexOf(",X") > 0) mode = 7;
            else if (upper.indexOf(",Y") > 0) mode = 8;
            else mode = 6;
        } else if (addr.charAt(0) === "(") {
            if (upper.indexOf(",X)") > 0 && upper.indexOf(",X)") === upper.length - 3) mode = 10;
            else if (upper.indexOf("),Y") > 0 && upper.indexOf("),Y") === upper.length - 3) mode = 11;
            else if (upper.indexOf(")") > 0) mode = 9;
        } else {
            if (upper.indexOf(",X") > 0) mode = 4;
            else if (upper.indexOf(",Y") > 0) mode = 5;
            else if (this.isValidMode(entry, 12)) mode = 12;
            else mode = 3;
        }

        if (mode == null) return { mode: null, mod: undefined, bytes: 0, oby: undefined, opc: undefined, err: "invalid addressing syntax" };
        if (!this.isValidMode(entry, mode)) return { mode: mode, mod: this.addrModeName[mode], bytes: this.steptab[mode], oby: Math.max(0, this.steptab[mode] - 1), opc: undefined, err: "invalid address mode for " + mne };
        return this.modeInfo(mode, opctab[mode]);
    };

    this.modeInfo = function (mode, opcode) {
        var bytes = this.steptab[mode] || 0;
        return { mode: mode, mod: this.addrModeName[mode], bytes: bytes, oby: Math.max(0, bytes - 1), opc: opcode };
    };

    this.byteCountForDataPragma = function (canonical, operandText, symtab) {
        operandText = String(operandText == null ? "" : operandText);
        var arr, n, i, e;
        switch (canonical) {
            case "BYTE":
                arr = this.splitCSV(operandText);
                n = 0;
                for (i = 0; i < arr.length; i++) n += this.byteCountForValue(arr[i], symtab, 1);
                return { bytes: n, oby: n };
            case "WORD":
            case "WORD_BE":
                arr = this.splitCSV(operandText);
                return { bytes: arr.length * 2, oby: 2 };
            case "HEX":
                n = operandText.replace(/[^A-Fa-f0-9]/g, "").length >> 1;
                return { bytes: n, oby: n };
            case "BIN":
                n = operandText.replace(/[^01]/g, "").length >> 3;
                return { bytes: n, oby: n };
            case "ASC":
                return { bytes: this.stringByteLength(operandText), oby: this.stringByteLength(operandText) };
            case "RES":
                arr = this.splitCSV(operandText);
                e = this.getExpression(arr[0] || "0", symtab);
                n = isNaN(e.val) ? 0 : Math.max(0, e.val | 0);
                return { bytes: n, oby: n };
            default:
                return { bytes: 0, oby: undefined };
        }
    };

    this.byteCountForValue = function (text, symtab, defaultBytes) {
        text = String(text == null ? "" : text).trim();
        if (!text) return 0;
        if ((text.charAt(0) === '"' || text.charAt(0) === "'") && text.charAt(text.length - 1) === text.charAt(0)) return text.length - 2;
        var e = this.getExpression(text, symtab);
        return e.bytes || defaultBytes || 1;
    };

    this.stringByteLength = function (text) {
        text = String(text == null ? "" : text).trim();
        if (!text) return 0;
        if ((text.charAt(0) === '"' || text.charAt(0) === "'") && text.charAt(text.length - 1) === text.charAt(0)) return text.length - 2;
        var m = text.match(/^[\-/]([^\-/]*)[\-/]?$/);
        if (m) return m[1].length;
        return text.length;
    };

    this.preparse = function (sourceText) {
        var lines = this.splitSource(sourceText);
        var statements = [];
        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];
            var statement = String(raw || "").trim();
            var sym = this.statement_splitter(raw);
            if (sym.length === 0) continue;
            var tag = this.statement_tagger(sym);
            statements.push({ line: i + 1, statement: statement, sym: sym, tag: tag });
        }
        return statements;
    };

    this.pass = function (statements, passNo) {
        var out = [];
        this.passNo = passNo;
        this.set_pc(0);
        if (passNo === 1) {
            this.symtab = {};
            this.symlink = {};
            this.code_pc = [];
        }

        for (var i = 0; i < statements.length; i++) {
            var base = statements[i];
            var row = {
                pc: this.pc,
                statement: base.statement,
                tag: base.tag.slice(),
                sym: base.sym.slice()
            };

            this.dispatchRow(row, passNo);
            if (passNo === 2) out.push(row);
        }
        return out;
    };

    this.dispatchRow = function (row, passNo) {
        var arg = { asm: this, row: row, passNo: passNo };

        if (row.tag.indexOf("PGM") >= 0) {
            var pgmIndex = this.getTokenIndexByTag(row.tag, "PGM");
            var pgm = row.sym[pgmIndex];
            var pinfo = this.pragmaInfo(pgm);
            if (!pinfo || typeof pinfo.parser !== "function") return parseMetadataUnknown.call(this.metadata["---"], arg);
            return pinfo.parser.call(pinfo, arg);
        }

        if (row.tag.indexOf("MNE") >= 0) {
            var mneIndex = this.getTokenIndexByTag(row.tag, "MNE");
            var mne = row.sym[mneIndex];
            var minfo = this.mnemonicInfo(mne);
            if (!minfo || typeof minfo.parser !== "function") return parseMetadataUnknown.call(this.metadata["---"], arg);
            return minfo.parser.call(minfo, arg);
        }

        var meta = this.metadataInfo(row.tag[0]);
        if (meta && typeof meta.parser === "function") return meta.parser.call(meta, arg);
        return parseMetadataUnknown.call(this.metadata["---"], arg);
    };

    this.tokenise = function (sourceText) {
        this.reset();
        var statements = this.preparse(sourceText);
        this.pass(statements, 1);
        var result = this.pass(statements, 2);
        result.symtab = Object.assign({}, this.symtab);
        result.errors = this.errors.slice();
        result.warnings = this.warnings.slice();
        return result;
    };

    // American spelling alias for callers that expect it.
    this.tokenize = this.tokenise;

    // Alias with assembler-like naming; it returns the same statement JSON for now.
    this.assemble = this.tokenise;

    //////////////////////////////
    // Dataset parser functions  //
    //////////////////////////////

    function parseMnemonic(arg) {
        var asm = arg.asm;
        var row = arg.row;
        var passNo = arg.passNo;
        var mneIndex = asm.getTokenIndexByTag(row.tag, "MNE");
        var oprIndex = asm.getTokenIndexByTag(row.tag, "OPR");
        var mnemonic = row.sym[mneIndex];
        var operand = oprIndex >= 0 ? row.sym.slice(oprIndex).join(" ") : undefined;
        var info = asm.inferAddressMode(mnemonic, operand);

        if (row.tag[0] === "LBL") asm.registerLabelLocation(row, passNo);

        row.asm = this.asm ? this.asm.slice() : asm.defaultAsmCompatibility.slice();
        if (info.mod) row.mod = info.mod;
        if (info.oby) row.oby = info.oby;
        if (info.opc !== undefined) row.opc = info.opc;
        if (info.err) row.err = info.err;

        // Optional resolved operand value; useful in pass 2 and harmless for JSON consumers.
        if (operand !== undefined && info.mode != null && info.mode > 1) {
            var expr = asm.cleanOperandValue(operand, info.mode);
            var e = asm.getExpression(expr, asm.symtab);
            if (!e.err && typeof e.val === "number" && !isNaN(e.val)) row.val = e.val & 0xffff;
            else if (e.err && !row.err) row.warn = e.err;
        }

        asm.add_pc(info.bytes || 0);
        return row;
    }

    function parsePragmaORG(arg) {
        var asm = arg.asm;
        var row = arg.row;
        var pgmIndex = asm.getTokenIndexByTag(row.tag, "PGM");
        var operands = row.sym.slice(pgmIndex + 1).join(" ");
        var org = asm.getExpression(operands, asm.symtab);
        row.asm = this.asm ? this.asm.slice() : ["raJS"];
        if (!org.err && typeof org.val === "number" && !isNaN(org.val)) {
            row.oby = org.bytes || 2;
            var val = org.val & 0xffff;
            row.val = val;
            asm.code_pc[0] = val;
            asm.set_pc(val);
        } else {
            row.err = org.err || "invalid ORG";
        }
        return row;
    }

    function parsePragmaEQU(arg) {
        var asm = arg.asm;
        var row = arg.row;
        var passNo = arg.passNo;
        var pgmIndex = asm.getTokenIndexByTag(row.tag, "PGM");
        var operands = row.sym.slice(pgmIndex + 1).join(" ");
        var eq = asm.getExpression(operands, asm.symtab);
        row.asm = this.asm ? this.asm.slice() : ["raJS"];
        if (!eq.err && typeof eq.val === "number" && !isNaN(eq.val)) {
            row.oby = eq.bytes || asm.operandByteSizeFromValue(eq.val);
            var val = eq.val & 0xffff;
            row.val = val;
            asm.registerLabelDefinition(row, passNo, val);
        } else {
            row.err = eq.err || "invalid EQU";
        }
        return row;
    }

    function parsePragmaData(arg) {
        var asm = arg.asm;
        var row = arg.row;
        var passNo = arg.passNo;
        var pgmIndex = asm.getTokenIndexByTag(row.tag, "PGM");
        var operands = row.sym.slice(pgmIndex + 1).join(" ");
        row.asm = this.asm ? this.asm.slice() : ["raJS"];

        if (row.tag[0] === "LBL") asm.registerLabelLocation(row, passNo);

        var bc = asm.byteCountForDataPragma(this.ref, operands, asm.symtab);
        if (bc.oby !== undefined) row.oby = bc.oby;
        asm.add_pc(bc.bytes || 0);
        return row;
    }

    function parsePragmaNoop(arg) {
        var row = arg.row;
        row.asm = this.asm ? this.asm.slice() : ["raJS"];
        return row;
    }

    function parseMetadataLabel(arg) {
        var asm = arg.asm;
        var row = arg.row;
        asm.registerLabelLocation(row, arg.passNo);
        row.asm = this.asm ? this.asm.slice() : ["raJS"];
        return row;
    }

    function parseMetadataUnknown(arg) {
        var row = arg.row;
        row.asm = this.asm ? this.asm.slice() : [];
        row.err = row.err || "unclassified statement";
        return row;
    }
}
