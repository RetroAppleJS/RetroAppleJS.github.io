/*
 * ASM_core_v6_3.js
 * Build filename: ASM_core_v6_3.js
 * Clean 6502 assembler-analysis core for RetroAppleJS-style tooling.
 *
 * Goals:
 * - One ASM() container only.
 * - No DASM(), no mocha_test(), no browser DOM dependencies.
 * - Two-pass source analysis.
 * - Main public function: asm.tokenise(sourceText) -> JSON statement array.
 *
 * v6.3 architecture:
 * - Pragmas/directives keep their parser functions inside this.pragma entries.
 * - 6502 mnemonics keep their parser functions inside this.mnemonics entries.
 * - Metadata/unclassified statement handling is dispatched through this.metadata entries.
 * - This makes tokenisation/parsing consistently table-driven.
 * - Adds compile(tokenisedRows) to generate byte code, listing lines, and byte-code dump lines.
 */

"use strict";

function ASM(options) {
    options = options || {};

    var root = (typeof globalThis !== "undefined") ? globalThis : ((typeof window !== "undefined") ? window : this);
    var self = this;

    this.version = "0.6.3.1";
    this.maxNumBytes = options.maxNumBytes || 2;
    this.label_len = options.label_len || 8;
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
        if (root.oCOM && typeof root.oCOM.getHexByte === "function") return root.oCOM.getHexByte(value);
        return ("0" + value.toString(16).toUpperCase()).slice(-2);
    };

    this.getHexWord = function (value) {
        value = Number(value) & 0xffff;
        if (root.oCOM && typeof root.oCOM.getHexWord === "function") return root.oCOM.getHexWord(value);
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
        if (root.oCOM && root.oCOM.CSVParser && typeof root.oCOM.CSVParser.parse === "function") {
            return root.oCOM.CSVParser.parse(text).filter(function (s) { return s != null && String(s).length > 0; });
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

    this.parseExpressionAtom = function (text, symtab) {
        text = String(text == null ? "" : text);
        symtab = symtab || this.symtab;

        var leading = text.match(/^\s*/)[0].length;
        var rest = text.substring(leading);
        var m = rest.match(/^(\$[0-9a-f]+|%[01]+|[+-]?[0-9]+|[A-Za-z_.$][A-Za-z0-9_.$]*|"[^"]*"|'[^']*')/i);
        if (!m) return { val: NaN, err: "missing operand after high/low byte operator", consumed: leading };

        var token = m[1];
        var n = this.getNumber(token, symtab);
        n.consumed = leading + token.length;
        n.token = token;
        return n;
    };

    this.applyHiLoOperators = function (text, symtab, unresolved) {
        text = String(text == null ? "" : text);
        symtab = symtab || this.symtab;
        unresolved = unresolved || [];

        var out = "";
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (ch !== "<" && ch !== ">") { out += ch; continue; }

            // Treat < and > as high/low byte operators only when they are unary:
            // at the start of an expression, or immediately after another operator.
            var p = i - 1;
            while (p >= 0 && /\s/.test(text.charAt(p))) p--;
            var prev = p >= 0 ? text.charAt(p) : "";
            var unary = p < 0 || /[+\-*\/%%&|^~(,]/.test(prev);
            if (!unary) { out += ch; continue; }

            var j = i + 1;
            while (j < text.length && /\s/.test(text.charAt(j))) j++;
            var atom = this.parseExpressionAtom(text.substring(j), symtab);
            if (atom.err || typeof atom.val !== "number" || isNaN(atom.val)) {
                unresolved.push(atom.token || text.substring(j).split(/\s+/)[0] || ch);
                out += "NaN";
                i = j + Math.max(0, atom.consumed || 0) - 1;
                continue;
            }

            var v = ch === ">" ? ((atom.val >> 8) & 0xff) : (atom.val & 0xff);
            out += String(v);
            i = j + atom.consumed - 1;
        }
        return out;
    };

    this.getNumber = function (text, symtab) {
        text = String(text == null ? "" : text).trim();
        symtab = symtab || this.symtab;
        if (!text) return { val: NaN, err: "empty number" };

        var hiLo = text.charAt(0);
        if (hiLo === ">" || hiLo === "<") {
            var rest = text.substring(1);
            var atom = this.parseExpressionAtom(rest, symtab);
            if (atom.err) return atom;
            var v = hiLo === ">" ? ((atom.val >> 8) & 0xff) : (atom.val & 0xff);
            var tail = rest.substring(atom.consumed).trim();
            if (tail) return this.getExpression(String(v) + tail, symtab);
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

        // Single number/symbol/string fast path.  A minus sign is treated as
        // arithmetic, not as part of an identifier, so LABEL-1 parses as LABEL minus 1.
        if (/^(>|<)?(\$[0-9a-f]+|%[01]+|[+-]?[0-9]+|[A-Za-z_.$][A-Za-z0-9_.$]*|"[^"]*"|'[^']*')$/i.test(text)) {
            return this.getNumber(text, symtab);
        }

        var unresolved = [];
        text = this.applyHiLoOperators(text, symtab, unresolved);
        var js = text.replace(/\$[0-9a-f]+|%[01]+|[A-Za-z_.$][A-Za-z0-9_.$]*/gi, function (tok) {
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
            if (root.oCOM && typeof root.oCOM.MathParser === "function") {
                try { val = new root.oCOM.MathParser().parse(js); }
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
            var tag = sym.length ? this.statement_tagger(sym) : [];
            // v0.5 keeps one row per source line so the assembly listing can align 1:1 with the source pane.
            statements.push({ line: i + 1, source: raw, statement: statement, sym: sym, tag: tag });
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
                line: base.line,
                pc: this.pc,
                source: base.source,
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
        if (!row.tag || row.tag.length === 0) {
            row.asm = [];
            return row;
        }
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

    //////////////////////////////
    // v0.5 compiler functions   //
    //////////////////////////////

    this.cloneRows = function (rows) {
        return JSON.parse(JSON.stringify(rows || []));
    };

    this.buildSymbolTableFromRows = function (rows) {
        var symtab = {};
        rows = rows || [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            var tag = row.tag || [];
            var sym = row.sym || [];
            if (tag[0] !== "LBL" || !sym[0]) continue;
            var lbl = this.getID(sym[0]);
            if (!lbl) continue;

            if (tag[1] === "PGM") {
                var pgmIndex = this.getTokenIndexByTag(tag, "PGM");
                var pinfo = this.pragmaInfo(sym[pgmIndex]);
                if (pinfo && pinfo.ref === "EQU" && typeof row.val === "number") symtab[lbl] = row.val & 0xffff;
                else symtab[lbl] = row.pc & 0xffff;
            } else {
                symtab[lbl] = row.pc & 0xffff;
            }
        }
        return symtab;
    };

    this.compile = function (tokenisedRows) {
        var rows = this.cloneRows(tokenisedRows || []);
        var symtab = Object.assign({}, tokenisedRows && tokenisedRows.symtab ? tokenisedRows.symtab : {}, this.buildSymbolTableFromRows(rows));
        var byteRecords = [];
        var listingLines = [];
        var errors = [];
        var warnings = [];

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var bytes = this.compileRow(row, symtab);
            row.bytes = bytes;
            row.hex = this.bytesToHex(bytes);
            row.listing = this.formatListingLine(row, bytes);
            listingLines.push(row.listing);

            if (row.err) errors.push({ line: row.line, statement: row.statement, err: row.err });
            if (row.warn) warnings.push({ line: row.line, statement: row.statement, warn: row.warn });

            for (var j = 0; j < bytes.length; j++) {
                byteRecords.push({ pc: (row.pc + j) & 0xffff, val: bytes[j] & 0xff });
            }
        }

        var byteCodeLines = this.formatByteCodeLines(byteRecords, 8);
        return {
            rows: rows,
            symtab: symtab,
            bytes: byteRecords,
            byteCodeLines: byteCodeLines,
            byteCodeText: byteCodeLines.join("\n"),
            listingLines: listingLines,
            listingText: listingLines.join("\n"),
            errors: errors.concat((tokenisedRows && tokenisedRows.errors) || []),
            warnings: warnings.concat((tokenisedRows && tokenisedRows.warnings) || [])
        };
    };

    this.compileRow = function (row, symtab) {
        if (!row || !row.tag || row.tag.length === 0) return [];
        if (row.err) return [];
        if (row.tag.indexOf("MNE") >= 0) return this.compileMnemonicRow(row, symtab);
        if (row.tag.indexOf("PGM") >= 0) return this.compilePragmaRow(row, symtab);
        return [];
    };

    this.compileMnemonicRow = function (row, symtab) {
        var tag = row.tag || [];
        var sym = row.sym || [];
        var mneIndex = this.getTokenIndexByTag(tag, "MNE");
        var oprIndex = this.getTokenIndexByTag(tag, "OPR");
        var mnemonic = sym[mneIndex];
        var operand = oprIndex >= 0 ? sym.slice(oprIndex).join(" ") : undefined;
        var info = this.inferAddressMode(mnemonic, operand);
        var bytes = [];
        if (info.err || info.opc === undefined) {
            row.err = row.err || info.err || "cannot compile mnemonic";
            return bytes;
        }

        bytes.push(info.opc & 0xff);
        if (!info.oby) return bytes;

        var expr = this.cleanOperandValue(operand, info.mode);
        var e = this.getExpression(expr, symtab);
        if (e.err || typeof e.val !== "number" || isNaN(e.val)) {
            row.err = row.err || e.err || "cannot resolve operand: " + expr;
            return [];
        }

        var value = e.val & 0xffff;
        row.val = value;
        if (info.mode === this.addrtab.rel) {
            var rel = value - ((row.pc + 2) & 0xffff);
            if (rel < -128 || rel > 127) {
                row.err = row.err || "branch target out of range";
                return [];
            }
            bytes.push(rel & 0xff);
        } else if (info.oby === 1) {
            bytes.push(value & 0xff);
        } else if (info.oby === 2) {
            bytes.push(value & 0xff, (value >> 8) & 0xff);
        }
        return bytes;
    };

    this.compilePragmaRow = function (row, symtab) {
        var tag = row.tag || [];
        var sym = row.sym || [];
        var pgmIndex = this.getTokenIndexByTag(tag, "PGM");
        if (pgmIndex < 0) return [];
        var pgm = sym[pgmIndex];
        var pinfo = this.pragmaInfo(pgm);
        var ref = pinfo ? pinfo.ref : String(pgm || "").toUpperCase();
        var operands = sym.slice(pgmIndex + 1).join(" ");
        switch (ref) {
            case "BYTE": return this.compileByteData(operands, symtab);
            case "WORD": return this.compileWordData(operands, symtab, false);
            case "WORD_BE": return this.compileWordData(operands, symtab, true);
            case "HEX": return this.compileHexData(operands);
            case "BIN": return this.compileBinData(operands);
            case "ASC": return this.compileAsciiData(operands);
            case "RES": return this.compileReserveData(operands, symtab);
            case "ORG":
            case "EQU":
            case "END":
            case "COND":
            default:
                return [];
        }
    };

    this.compileByteData = function (operandText, symtab) {
        var arr = this.splitCSV(operandText);
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var b = this.valueToBytes(arr[i], symtab, 1);
            for (var j = 0; j < b.length; j++) out.push(b[j] & 0xff);
        }
        return out;
    };

    this.compileWordData = function (operandText, symtab, bigEndian) {
        var arr = this.splitCSV(operandText);
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var e = this.getExpression(String(arr[i]), symtab);
            var value = (!e.err && typeof e.val === "number") ? (e.val & 0xffff) : 0;
            if (bigEndian) out.push((value >> 8) & 0xff, value & 0xff);
            else out.push(value & 0xff, (value >> 8) & 0xff);
        }
        return out;
    };

    this.compileHexData = function (operandText) {
        var s = String(operandText || "").replace(/[^A-Fa-f0-9]/g, "");
        var out = [];
        for (var i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.substring(i, i + 2), 16) & 0xff);
        return out;
    };

    this.compileBinData = function (operandText) {
        var s = String(operandText || "").replace(/[^01]/g, "");
        var out = [];
        for (var i = 0; i + 7 < s.length; i += 8) out.push(parseInt(s.substring(i, i + 8), 2) & 0xff);
        return out;
    };

    this.compileAsciiData = function (operandText) {
        operandText = String(operandText == null ? "" : operandText).trim();
        var quoted = operandText.match(/^(["'])([\s\S]*)\1$/);
        var slash = operandText.match(/^[\-/]([\s\S]*)[\-/]?$/);
        var text = quoted ? quoted[2] : (slash ? slash[1] : operandText);
        var highBit = quoted && quoted[1] === '"';
        var out = [];
        for (var i = 0; i < text.length; i++) out.push((text.charCodeAt(i) | (highBit ? 0x80 : 0)) & 0xff);
        return out;
    };

    this.compileReserveData = function (operandText, symtab) {
        var arr = this.splitCSV(operandText);
        var lenExpr = this.getExpression(String(arr[0] || "0"), symtab);
        var fillExpr = this.getExpression(String(arr[1] || "0"), symtab);
        var len = (!lenExpr.err && typeof lenExpr.val === "number") ? Math.max(0, lenExpr.val | 0) : 0;
        var fill = (!fillExpr.err && typeof fillExpr.val === "number") ? fillExpr.val & 0xff : 0;
        var out = [];
        for (var i = 0; i < len; i++) out.push(fill);
        return out;
    };

    this.valueToBytes = function (text, symtab, defaultBytes) {
        text = String(text == null ? "" : text).trim();
        if (!text) return [];
        var e = this.getExpression(text, symtab);
        if (e.type === "string" && Array.isArray(e.val)) return e.val.map(function (v) { return v & 0xff; });
        if (e.err || typeof e.val !== "number" || isNaN(e.val)) return [0];
        var bytes = defaultBytes || e.bytes || 1;
        var value = e.val & 0xffff;
        var out = [];
        for (var i = 0; i < bytes; i++) out.push((value >> (8 * i)) & 0xff);
        return out;
    };

    this.bytesToHex = function (bytes) {
        bytes = bytes || [];
        var out = [];
        for (var i = 0; i < bytes.length; i++) out.push(this.getHexByte(bytes[i]));
        return out.join(" ");
    };

    this.splitStatementAndComment = function (line) {
        var text = String(line == null ? "" : line).replace(/[“”]/g, "\"");
        var body = "";
        var comment = "";
        var quote = "";
        var escaped = false;

        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (escaped) { body += ch; escaped = false; continue; }
            if (ch === "\\") { body += ch; escaped = true; continue; }
            if (quote) {
                body += ch;
                if (ch === quote) quote = "";
                continue;
            }
            if (ch === "'" || ch === "\"") { quote = ch; body += ch; continue; }
            if (ch === ";") { comment = text.substring(i).trimRight(); break; }
            body += ch;
        }

        return {
            body: body.trim(),
            comment: comment
        };
    };

    // v0.6 fixed listing columns, zero-based.  The short keys match the UI input.
    this.defaultListingColumns = { adr: 0, code: 6, lbl: 16, ins: 25, opr: 29, com: 46 };
    this.listingColumns = Object.assign({}, this.defaultListingColumns);
    this.listingLabelLen = options.listingLabelLen || 8;

    this.parseListingColumns = function (spec) {
        var defaults = this.defaultListingColumns || { adr: 0, code: 6, lbl: 16, ins: 25, opr: 29, com: 46 };
        var parsed = {};

        function put(k, v) {
            v = Number(v);
            if (!isFinite(v)) return;
            parsed[String(k)] = v | 0;
        }

        for (var d in defaults) put(d, defaults[d]);

        if (spec == null || spec === "") return parsed;
        if (typeof spec === "object") {
            for (var ok in spec) put(ok, spec[ok]);
        } else if (root.oCOM && typeof root.oCOM.parseColumnSpec === "function") {
            parsed = root.oCOM.parseColumnSpec(spec, defaults);
        } else {
            var text = String(spec);
            var re = /([A-Za-z_$][A-Za-z0-9_$-]*)\s*[:=]\s*(-?\d+)/g, m;
            while ((m = re.exec(text))) put(m[1], m[2]);
        }

        // Backward-friendly aliases, in case callers still use long names.
        if (parsed.address != null) parsed.adr = parsed.address;
        if (parsed.bytes != null) parsed.code = parsed.bytes;
        if (parsed.label != null) parsed.lbl = parsed.label;
        if (parsed.instruction != null) parsed.ins = parsed.instruction;
        if (parsed.operand != null) parsed.opr = parsed.operand;
        if (parsed.comment != null) parsed.com = parsed.comment;

        return {
            adr: Number(parsed.adr) | 0,
            code: Number(parsed.code) | 0,
            lbl: Number(parsed.lbl) | 0,
            ins: Number(parsed.ins) | 0,
            opr: Number(parsed.opr) | 0,
            com: Number(parsed.com) | 0
        };
    };

    this.setListingColumns = function (spec) {
        this.listingColumns = this.parseListingColumns(spec);
        return this.listingColumns;
    };

    this.cropListingField = function (text, width) {
        text = String(text == null ? "" : text);
        if (root.oCOM && typeof root.oCOM.textTableClip === "function") return root.oCOM.textTableClip(text, width, "…");
        if (width == null || !isFinite(Number(width)) || Number(width) < 0) return text;
        width = Number(width) | 0;
        if (width === 0) return "";
        if (text.length <= width) return text;
        return width === 1 ? "…" : text.substring(0, width - 1) + "…";
    };

    this.truncateListingLabel = function (label) {
        return this.cropListingField(label, this.listingLabelLen);
    };

    this.normaliseListingInstruction = function (row, token, isPragma) {
        token = String(token == null ? "" : token);
        if (!token) return "";
        if (isPragma) {
            var pinfo = this.pragmaInfo(token);
            if (pinfo && pinfo.ref) {
                switch (pinfo.ref) {
                    case "WORD_BE": return "DDB";
                    case "BYTE": return "BYTE";
                    case "WORD": return "WORD";
                    case "ORG": return "ORG";
                    case "EQU": return "EQU";
                    case "RES": return "RES";
                    case "END": return "END";
                    case "COND": return token.replace(/^\./, "").toUpperCase();
                    default: return String(pinfo.ref).replace(/^\./, "").toUpperCase();
                }
            }
            return token.replace(/^\./, "").toUpperCase();
        }
        return token.toUpperCase();
    };

    this.getListingParts = function (row, bytes) {
        row = row || {};
        bytes = bytes || [];
        var tag = row.tag || [];
        var sym = row.sym || [];
        var parts = { adr: "", code: "", lbl: "", ins: "", opr: "", com: "" };
        var split = this.splitStatementAndComment(row.source != null ? row.source : row.statement);
        parts.com = split.comment || "";

        if (bytes.length) {
            parts.adr = this.getHexWord(row.pc).toLowerCase() + ":";
            parts.code = this.bytesToHex(bytes).toLowerCase();
        }

        var lblIndex = this.getTokenIndexByTag(tag, "LBL");
        var mneIndex = this.getTokenIndexByTag(tag, "MNE");
        var pgmIndex = this.getTokenIndexByTag(tag, "PGM");
        var oprIndex = this.getTokenIndexByTag(tag, "OPR");

        if (lblIndex >= 0) parts.lbl = this.truncateListingLabel(sym[lblIndex]);
        if (mneIndex >= 0) parts.ins = this.normaliseListingInstruction(row, sym[mneIndex], false);
        else if (pgmIndex >= 0) parts.ins = this.normaliseListingInstruction(row, sym[pgmIndex], true);
        if (oprIndex >= 0) parts.opr = sym.slice(oprIndex).join(" ");

        return parts;
    };

    this.formatListingLine = function (row, bytes) {
        var parts = this.getListingParts(row, bytes || []);
        var columns = this.listingColumns || this.defaultListingColumns;
        var order = ["adr", "code", "lbl", "ins", "opr", "com"];

        if (root.oCOM && typeof root.oCOM.renderTextTableRows === "function") {
            return root.oCOM.renderTextTableRows([parts], columns, {
                order: order,
                defaults: this.defaultListingColumns,
                trimRight: true,
                singleColumnRaw: true,
                ellipsis: "…"
            })[0];
        }

        // Local fallback for non-browser/unit-test use without COM_MAIN.js.
        var line = "";
        var nonEmpty = order.filter(function (k) { return parts[k] != null && String(parts[k]) !== ""; });
        if (nonEmpty.length === 1) return String(parts[nonEmpty[0]]);
        for (var i = 0; i < order.length; i++) {
            var key = order[i];
            if (!parts[key]) continue;
            var col = columns[key] | 0;
            var width = undefined;
            for (var j = i + 1; j < order.length; j++) {
                if ((columns[order[j]] | 0) > col) { width = (columns[order[j]] | 0) - col; break; }
            }
            var text = this.cropListingField(parts[key], width);
            if (line.length < col) line = line.padEnd(col, " ");
            else if (line.length > col) line += " ";
            line += text;
        }
        return line.replace(/\s+$/, "");
    };

    if (options.listingColumns !== undefined) this.setListingColumns(options.listingColumns);

    this.formatByteCodeLines = function (byteRecords, maxPerLine) {
        byteRecords = byteRecords || [];
        maxPerLine = maxPerLine || 8;
        var lines = [];
        var curAddr = null;
        var curBytes = [];
        var lastAddr = null;

        function flush(asm) {
            if (curAddr === null || curBytes.length === 0) return;
            lines.push(asm.getHexWord(curAddr) + ": " + curBytes.map(function (b) { return asm.getHexByte(b); }).join(" "));
            curAddr = null;
            curBytes = [];
            lastAddr = null;
        }

        for (var i = 0; i < byteRecords.length; i++) {
            var rec = byteRecords[i];
            var addr = rec.pc & 0xffff;
            if (curAddr === null) curAddr = addr;
            if (lastAddr !== null && ((lastAddr + 1) & 0xffff) !== addr) flush(this);
            if (curBytes.length >= maxPerLine) flush(this);
            if (curAddr === null) curAddr = addr;
            curBytes.push(rec.val & 0xff);
            lastAddr = addr;
        }
        flush(this);
        return lines;
    };

    this.compileSource = function (sourceText) {
        return this.compile(this.tokenise(sourceText));
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

    // Alias with assembler-like naming; v0.5 returns the compiled assembly object.
    this.assemble = this.compileSource;

    // Backward-compatible alias for callers that only want analysis rows.
    this.analyse = this.tokenise;

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
