// 2022 adaptations by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// Thanks to n. landsteiner, mass:werk / electronic tradion 2005; e-tradion.net
// ASM_6502.js


// TODO: FIX LDA #";"
// TODO: split GUI & business functions <> gui functions


// lookup tables

// mode 0:	OPC         ....	implied
// mode 1:	OPC A       ....	Accumulator
// mode 2:	OPC #BB     ....	immediate
// mode 3:	OPC HHLL    ....	absolute
// mode 4:	OPC HHLL,X  ....	absolute, X-indexed
// mode 5:	OPC HHLL,Y  ....	absolute, Y-indexed
// mode 6:	OPC *LL     ....	zeropage
// mode 7:	OPC *LL,X   ....	zeropage, X-indexed
// mode 8:	OPC *LL,Y   ....	zeropage, Y-indexed
// mode 9:	OPC (BB,X)  ....	X-indexed, indirect
// mode 10:	OPC (LL),Y  ....	indirect, Y-indexed
// mode 11:	OPC (HHLL)  ....	indirect
// mode 12:	OPC BB      ....	relative

var hextab = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
var instrtab = {
// mode    0   1     2     3     4     5     6     7   8   9    10    11  12
	ADC: [-1, -1, 0x69, 0x6d, 0x7d, 0x79, 0x65, 0x75, -1, -1, 0x61, 0x71, -1],
	AND: [-1, -1, 0x29, 0x2d, 0x3d, 0x39, 0x25, 0x35, -1, -1, 0x21, 0x31, -1],
	ASL: [-1, 0x0a, -1, 0x0e, 0x1e, -1, 0x06, 0x16, -1, -1, -1, -1, -1],
	BCC: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x90],
	BCS: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xb0],
	BEQ: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xf0],
	BIT: [-1, -1, -1, 0x2c, -1, -1, 0x24, -1, -1, -1, -1, -1, -1],
	BMI: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x30],
	BNE: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0xd0],
	BPL: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x10],
	BRK: [0x00, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	BVC: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x50],
	BVS: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0x70],
	CLC: [0x18, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	CLD: [0xd8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	CLI: [0x58, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	CLV: [0xb8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	CMP: [-1, -1, 0xc9, 0xcd, 0xdd, 0xd9, 0xc5, 0xd5, -1, -1, 0xc1, 0xd1, -1],
	CPX: [-1, -1, 0xe0, 0xec, -1, -1, 0xe4, -1, -1, -1, -1, -1, -1],
	CPY: [-1, -1, 0xc0, 0xcc, -1, -1, 0xc4, -1, -1, -1, -1, -1, -1],
	DEC: [-1, -1, -1, 0xce, 0xde, -1, 0xc6, 0xd6, -1, -1, -1, -1, -1],
	DEX: [0xca, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	DEY: [0x88, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	EOR: [-1, -1, 0x49, 0x4d, 0x5d, 0x59, 0x45, 0x55, -1, -1, 0x41, 0x51, -1],
	INC: [-1, -1, -1, 0xee, 0xfe, -1, 0xe6, 0xf6, -1, -1, -1, -1, -1],
	INX: [0xe8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	INY: [0xc8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	JMP: [-1, -1, -1, 0x4c, -1, -1, -1, -1, -1, 0x6c, -1, -1, -1],
	JSR: [-1, -1, -1, 0x20, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	LDA: [-1, -1, 0xa9, 0xad, 0xbd, 0xb9, 0xa5, 0xb5, -1, -1, 0xa1, 0xb1, -1],
	LDX: [-1, -1, 0xa2, 0xae, -1, 0xbe, 0xa6, -1, 0xb6, -1, -1, -1, -1],
	LDY: [-1, -1, 0xa0, 0xac, 0xbc, -1, 0xa4, 0xb4, -1, -1, -1, -1, -1],
	LSR: [-1, 0x4a, -1, 0x4e, 0x5e, -1, 0x46, 0x56, -1, -1, -1, -1, -1],
	NOP: [0xea, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	ORA: [-1, -1, 0x09, 0x0d, 0x1d, 0x19, 0x05, 0x15, -1, -1, 0x01, 0x11, -1],
	PHA: [0x48, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	PHP: [0x08, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	PLA: [0x68, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	PLP: [0x28, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	ROL: [-1, 0x2a, -1, 0x2e, 0x3e, -1, 0x26, 0x36, -1, -1, -1, -1, -1],
	ROR: [-1, 0x6a, -1, 0x6e, 0x7e, -1, 0x66, 0x76, -1, -1, -1, -1, -1],
	RTI: [0x40, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	RTS: [0x60, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	SBC: [-1, -1, 0xe9, 0xed, 0xfd, 0xf9, 0xe5, 0xf5, -1, -1, 0xe1, 0xf1, -1],
	SEC: [0x38, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	SED: [0xf8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	SEI: [0x78, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	STA: [-1, -1, -1, 0x8d, 0x9d, 0x99, 0x85, 0x95, -1, -1, 0x81, 0x91, -1],
	STX: [-1, -1, -1, 0x8e, -1, -1, 0x86, -1, 0x96, -1, -1, -1, -1],
	STY: [-1, -1, -1, 0x8c, -1, -1, 0x84, 0x94, -1, -1, -1, -1, -1],
	TAX: [0xaa, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	TAY: [0xa8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	TSX: [0xba, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	TXA: [0x8a, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	TXS: [0x9a, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
	TYA: [0x98, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
};

var steptab = [1, 1, 2, 3, 3, 3, 2, 2, 2, 3, 2, 2, 2];

var addrtab = {	// unused right now
	imp: 0,
	acc: 1,
	imm: 2,
	abs: 3,
	abx: 4,
	aby: 5,
	zpg: 6,
	zpx: 7,
	zpy: 8,
	ind: 9,
	inx: 10,
	iny: 11,
	rel: 12
};

var dbgsym = {}


// maxNumBytes = max number width in bytes (CPU-specific)
// mnemonics   = table with mnemonics (CPU-specific)
// pragma_sym  = pragma symbols (ASSMBLER-specific) 

var oASM = new ASM();
oASM.init({maxNumBytes:2});
oASM.mnemonics = instrtab;
oASM.pragma_sym = oASM.concat_json(oASM.pragma_sym,
{
	// in case CPU-specific pragmas are required
});


// globals

var srcl, srcc, pc, listing;
var codesrc_buf = new Array();  // TODO move codesrc_buf to oASM


// functions

//   █████  ███████ ███████ ███████ ███    ███ ██████  ██      ███████ ██████  
//  ██   ██ ██      ██      ██      ████  ████ ██   ██ ██      ██      ██   ██ 
//  ███████ ███████ ███████ █████   ██ ████ ██ ██████  ██      █████   ██████  
//  ██   ██      ██      ██ ██      ██  ██  ██ ██   ██ ██      ██      ██   ██ 
//  ██   ██ ███████ ███████ ███████ ██      ██ ██████  ███████ ███████ ██   ██ 

function assemble()
{

	oASM.code_pc = new Array();
	oASM.symtab = {};
	oASM.symlink = {};
	oASM.code_pc[0] = 0;	// default ORG
	var crlf = "<br>"

	listing = document.forms.ass.listing;
	var showADR = document.ass.showADR.checked;
	var showDBG = {"RAM":document.ass.showDBG_RAM.checked == true,"ROM":document.ass.showDBG_ROM.checked == true}
	var codefield = document.getElementById('codefield');
	oASM.codesrc = oASM.getSrc(document.forms.ass.srcfield,{"LComment":"*;","RComment":";"});
	codefield.innerHTML = ' '+crlf;

	var pass1 = false;
	var pass2 = false;
	oASM.clear_code();
	pass1 = doPass(1);
	if (pass1)
	{
		listing.value = '' //'pass 2';
		pass2 = doPass(2);
		if (pass2)
		{
			if(showDBG.RAM || showDBG.ROM)
			{
				var ds = debug_symbols(showDBG);
				listing.value += ds.listing;		// add debug symbols in listing
				for(var i=0;i<ds.stream.length;i+=2)
				oASM.write_code(parseInt(ds.stream.charAt(i)+ds.stream.charAt(i+1),16));
			}

			// byte stream listing

			c = '';
			var n = 0;
			var l = oASM.get_code_len();
			for (var i = 0; i < l; i++)
			{
				var new_pc = oASM.code_pc[i];				    // Get ORG value at this byte index
				if (new_pc >= 0) pc = new_pc + l - i - 1		// If ORG value exists, go to new program counter location if applicable 
				if (((n > 0) && (n % 8 == 0)) || new_pc >= 0)
				{
					c += (i == 0 ? '' : crlf)
					+ (showADR == 1 && (l - i - 1) >= 0 ? (oCOM.getHexWord(pc - l + i + 1) + ': ') : '');
					n = 0;
				}
				c += oCOM.getHexByte(oASM.read_code(i)) + ' ';
				n++;
			}
			codefield.innerHTML = c;
			listing.value += '\ndone.';
		}
	}
	else
	{
		listing.value += '\nfailed.\n';
		alert('6502 Assembler:\nfailed (see listing).');
	}

	oASM.pass = null;
}

function displayError(er)
{
	listing.value += '\n' + er + '\n';
	return false;
}

function getChar()
{
	if (srcl >= oASM.codesrc.length) return 'EOF';
	if (srcc >= oASM.codesrc[srcl].length)
	{
		srcc = 0;
		srcl++;
		return '\n';
	}
	else
	{
		var c = oASM.codesrc[srcl].charAt(srcc);
		srcc++;
		return c //.toUpperCase();
	}
}

function getSym()
{
	var c = getChar();
	if (c == 'EOF') return null;
	var sym = [''];
	var s = 0;		// string index
	var m = false;  // multi character
	var q = false;	// quote

	// TODO rule out semicolons located between single or double quotes
	// otherwise string values with semicolons get abruptly trucated

	while (
		//(c != ';') &&
	(c != '\n') && (c != 'EOF'))
	{
		if ((c == ' ' || c == '\t') && !q)
		{
			if(m)
			{
			sym[++s] = '';
			m = false;
			}
		}
		else if (c == "'" || c == "\"")
		{
			sym[s] += c;
			q = !q			// toggle quote
			m = false;
		}
		else
		{
			sym[s] += c;
			m = true;
		}
		c = getChar();
	}
	while ((sym.length) && (sym[sym.length - 1] == '')) sym.length--;
	return (c == 'EOF') ? null : sym;
}

function getAscii(n)
{
	return n.charCodeAt(0) + 128;
}

function getOffset(n)
{
	var a = n.lastIndexOf("+");
	var b = n.lastIndexOf("-");
	var c = a >= 0 && b < 0 ? a : b;
	var d = n.length - c - 1;
	if (c < 0 && d > 6) return 0;
	nn = n.slice(-d - 1);
	var nn = oASM.getNumber(nn);
	return nn.val == "NaN" ? 0 : nn.val;
}

function paddRight(s, l)
{
	if (s === undefined) s = '';
	while (s.length < l) s += ' ';
	return s;
}


// TODO replace DOPASS BY S_DOPASS and put the main loop in doPass
// if new s_dopass returns something, return should be taken over in main loop
// if new s_dopass hits a 'continue', it should return a special value that does continue in the main loop
//

///////////////////////////////////////////////////


//  ██████   ██████  ██████   █████  ███████ ███████ 
//  ██   ██ ██    ██ ██   ██ ██   ██ ██      ██      
//  ██   ██ ██    ██ ██████  ███████ ███████ ███████ 
//  ██   ██ ██    ██ ██      ██   ██      ██      ██ 
//  ██████   ██████  ██      ██   ██ ███████ ███████ 






function doPass(pass)
{
	var opspace = 13;

	srcl = srcc = pc = 0;
	var sym = getSym();
	listing.value = "";
	while (sym)
	{
		if(listing.value.length>0) listing.value += '\n';
		if (sym.length == 0)
		{
			listing.value += " ".repeat(10);  // 40 spaces = skip one listing line
			sym = getSym();
			continue;
		}

		pc &= 0xffff;
		var ofs = 0;
		var c1 = sym[0].charAt(0);
		var padd = 0;
		var lbl = null;

		// List PROGRAM COUNTER (PC)
		listing.value += oCOM.getHexWord(pc) + ' ';	
	
		var opc = sym[ofs];						// read next opcode
		var opctab = instrtab[opc];				// opcode lookup table
		var mactab = oASM.pragma_sym[opc];		// macro lookup table

		var bEncode = oASM.pragma_sym.DO.STACK===undefined ? true :  (oASM.pragma_sym.DO.STACK[0] == true || oASM.pragma_sym.DO.STACK.length == 0);

		// LABEL
		if (((c1 < 'A') || (c1 > 'Z')) && (c1 != '.') && (c1 != '*'))					
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else if (opctab == null && mactab == null && bEncode == true)			// no assembler mnemonic or pragma ==> probably a label
		{
			// label
			var lbl = oASM.getID(sym[0]).val;
			if (lbl == '')
			{
				displayError('syntax error:\ninvalid identifier: ' + sym[0]);
				return false;
			}
			// List LABEL
			listing.value += paddRight(lbl, oASM.label_len) + ' ';
			ofs++;

			if (pass == 1 && oASM.symtab[lbl] === undefined)	// REGISTER LABEL AS SYMBOL (can be overwritten later by pragma 'EQU' or '=')
			{
				var v = {"val":pc};
				oASM.symtab[lbl] = v.val;
				oASM.sym_link(
				{
					"type": "loc",
					"PC": pc,
					"val": pc,
					"sym": lbl,
					"sym0": sym[0]
				})
			}
			padd = oASM.label_len+1;
		}

		var opc = sym[ofs];						// read next opcode
		var opctab = instrtab[opc];				// opcode lookup table
		var mactab = oASM.pragma_sym[opc];		// macro lookup table

		// TODO will it ever reach to a condition like this ? sym.length < ofs 
		if (sym.length < ofs || (opctab == null && mactab == null))
		{
			// end of line
			sym = getSym();
			continue;
		}

		if (padd == 0) listing.value += '       ';
		padd = 0;
		if (((c1 < 'A') || (c1 > 'Z')) && (c1 != '.') && (c1 != '*'))
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else
		{
			if (opctab == null && mactab == null && lbl == null) { displayError('syntax error:\nopcode or macro expected'); return false }

			var addr = sym[ofs + 1];
			var mode = 0;  						// implied
			if(addr === undefined && mactab == null && opctab[0] >= 0)
			{
				if(pass == 2)
				{
					padd = 3;
					listing.value += listing_gen(mode,{"opcode":opc+' '.repeat(opspace-padd)+oCOM.getHexByte(opctab[0])})
					oASM.write_code( opctab[0] );
				}
				pc++;
			}
			else if(opctab != null && sym.length > ofs + 2)
			{
				displayError('syntax error:\ntoo many operands');
				return false;
			}
			else if(mactab != null)  // MACRO CODE
			{
				listing.value += sym[ofs]+" ";
				if(mactab.ref) mactab = oASM.pragma_sym[mactab.ref];
				if(mactab.parser)
				{
					oASM.pragma = mactab.parser;
					r = oASM.pragma({"sym":sym,"pass":pass,"ofs":ofs});		// PROCESS PRAGMA
					if(r==false) return false;
				}
				else
					r = oASM.parse_pragma(sym,pass,{"ofs":ofs});
			}
			else if(bEncode == true)
			{
				var a1 = addr===undefined ? "" : addr.charAt(0);
				var b1 = 0;
				var b2 = addr===undefined ? 0 : addr.length;

				if (addr == 'A' || addr===undefined && opctab[1]>=0)
				{
					mode = 1;					// accumulator
					if (pass == 2)
					{
						listing.value += cDO ? listing_gen(mode,{"opcode":opc}) : "<font color=grey>" + listing_gen(mode,{"opcode":opc}) + "<font>"
						padd = 4+1;
					}
				}
				else if (a1 == '#')
				{
					a2 = addr.charAt(1);
					b1 = 1;
					mode = 2;							// immediate
				}
				else if (a1 == '*')
				{
					var m = {7:addr.indexOf(",X"),8:addr.indexOf(",Y"),6:addr.length}
					if     (m[7] > 0)       mode = 7	// zeropage,X
					else if(m[8] > 0)       mode = 8	// zeropage,Y
					else                    mode = 6;	// zeropage
					b1 = 1;
					b2 = b3 = m[mode];
				}
				else if (a1 == '(')
				{
					var m = {10:addr.indexOf(",X)"),11:addr.indexOf("),Y"),9:addr.indexOf(")")}
					if     (m[10] > 0 && m[10] == addr.length - 3)  mode = 10;    // X-indexed, indirect ?
					else if(m[11] > 0 && m[11] == addr.length - 3)  mode = 11; 	  // Y-indexed, indirect ?
					else if(m[9] > 0)                               mode = 9;     // indirect ?
					else { displayError('syntax error:\ninvalid addressing mode'); return false }
					b1 = 1;
					b2 = b3 = m[mode];
				}
				else if (mactab != null && ((a1 >= '0' && a1 <= '9') || (a1 >= 'A' && a1 <= 'F')))
				{
					b1 = 1;
					mode = 13;
				}
				else
				{
					var m = {4:addr.indexOf(",X"),5:addr.indexOf(",Y"),3:addr.length,12:addr.length}
					if     (m[4] > 0)       mode = 4	// absolute,X
					else if(m[5] > 0)       mode = 5	// absolute,Y
					else if(opctab[12]<0)  mode = 3;	// absolute
					else if(opctab!=null)  mode = 12	// relative
					else { displayError('syntax error:\ninvalid addressing mode'); return false }
					b2 = b3 = m[mode];	// set boundaries for expression to extract
				}

				if (pass == 1) listing.value += opc+" "+addr

				if (pass == 2)
				{
					// encode OPCODE instruction
					var instr = opctab[mode];
					if (instr >= 0) oASM.write_code( instr );
					else return displayError('compile error:\ninvalid address mode for ' + opc);

					if (mode > 1)
					{
						// operand
						addr = addr.substring(b1, b2);
						var e = oASM.getExpression(addr);
						if(typeof(e.val)=="object")
						{
							e.val = e.val[1];
							e.warn = 'warning: one-character string expected';
						}

						this.listing_rewrite = true;
						if(this.listing_rewrite)
						{
							var lg = listing_gen(mode,{"opcode":opc,"val":e.val,"pc":pc})
							listing.value += lg;
							padd += lg.length;
						}
						else
						{
							listing.value += addr;
							padd += addr.length;
						}

						if (e.err) { return displayError(e.err) }
						oper = e.val;
						if(mode == 12)
						{
							oper = oper-((pc + 2) & 0xffff);
						}
						//var l = listing.value.length;
						//padd += (listing.value.length - l);
					}

					////////////////////////////
					// COMPILE TO OBJECT CODE //
					////////////////////////////
					
					listing.value += ' '.repeat(opspace-padd);

					listing.value += oCOM.getHexByte(instr);  	// add first byte to listing
					if (mode > 1)							// add following bytes
					{
						var op = oper & 0xff;
						oASM.write_code( op );
						listing.value += ' ' + oCOM.getHexByte(op);
						if (steptab[mode] > 2)
						{
							op = (Math.floor(oper / 256)) & 0xff;
							oASM.write_code( op );
							listing.value += ' ' + oCOM.getHexByte(op);
						}
					}
					if (e && e.warn) { listing.value += '\n' + e.warn  }
				}
				pc += steptab[mode];
			}
		}
		sym = getSym();
		//listing.value += '\n';
	}


	// GARBAGE COLLECT STACK REFERENCES AT THE END OF ASSEMBLY
	for(var o in oASM.pragma_sym)
	{
		if(typeof(oASM.pragma_sym[o].STACK)!="undefined")
		{
			// CHECK IF EMPTY ARRAY ==> SUBMIT ASSEMBLER WARNING
			if(oASM.pragma_sym[o].STACK.length>0)
				listing.value += '\n' + 'warning: '+o+' statement'+(oASM.pragma_sym[o].STACK.lengt>1?'':'s')+' not properly closed'

			// FORCE EMPTY ARRAY!!!!
			delete oASM.pragma_sym[o].STACK;
		}
	}
	


	return true;
}

function listing_gen(mode,a)
{
	switch(mode)
	{
		case -1: return a.val;					// PRAGMA
		case 0:	 return r(a,"OPC");				// implied
		case 1:	 return r(a,"OPC A");			// accumulator
		case 2:  return r(a,"OPC #$LL");		// immediate
		case 3:  return r(a,"OPC $HHLL");		// absolute
		case 4:  return r(a,"OPC $HHLL,X");		// absolute, X-indexed
		case 5:  return r(a,"OPC $HHLL,Y");		// absolute, Y-indexed
		case 6:  return r(a,"OPC *$LL");		// zeropage
		case 7:  return r(a,"OPC *$LL,X");		// zeropage, X-indexed
		case 8:  return r(a,"OPC *$LL,Y");		// zeropage, Y-indexed
		case 9:  return r(a,"OPC ($HHLL)");		// indirect
		case 10: return r(a,"OPC ($LL,X)");	// X-indexed, indirect
		case 11: return r(a,"OPC ($LL),Y");		// indirect, Y-indexed
		case 12: return r(a,"OPC $HHLL");		// relative (alt display method)
		//case 12: return r(a,"OPC $BB");		// relative
		case 13: return a.opcode+" "+a.val;
		/* PROCESS MACRO ARGUMENT ? */
	}
	function r(a,fmt)
	{
		if(fmt.match("BB")!=null)
		{
			var rel = a.val-((a.pc + 2) & 0xffff);
			if (rel > 127 || rel < -128) { displayError('error: branch target out of range') }
			fmt = fmt.replace("BB",oCOM.getHexByte((~rel&(1<<8)-1)+1));
		}
		fmt = fmt.replace("OPC",a.opcode);
		fmt = fmt.replace("LL",oCOM.getHexByte(a.val & 0xFF));
		fmt = fmt.replace("HH",oCOM.getHexByte(a.val >> 8));
		return fmt;
	}
}

function debug_symbols(showDBG)
{
	// TODO
	var s = "\n*** DEBUG SYMBOLS ***\n";
	function q(str) { return "\""+str+"\"" };
	var arr = [], alt = true, str = "";
	str += showDBG.ROM || showDBG.RAM ? "FAFF" : "";
	for (var i in oASM.symtab)
	{
		if(showDBG.RAM && oASM.symtab[i]<parseInt("C000",16)
			|| showDBG.ROM && oASM.symtab[i]>=parseInt("C000",16))
		{
			m = (i+" ".repeat(oASM.label_len-(i.length>oASM.label_len?oASM.label_len:i.length) )) + " = $" + getHexVar(oASM.symtab[i])
			if(alt) s += m+" ".repeat(m.length>17?1:17-m.length); else s += m+"\n";
			alt = !alt;

			// Encode 6 characters (label) to 4 Bytes (5.322 bits per character = 31.319 bits per 6 characters )
			var lbl = conv(i,{"dbg":false,"slen":6,"glen":3,"wlen":4,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF (base40)
			var adr = oCOM.getHexWord(oASM.symtab[i]);
			str += lbl + adr;
		}

  }
	str += showDBG.ROM || showDBG.RAM ? "FF" : "";  // STOP WITH HEX BYTE  = FF (=assumed - impossible - string)

	var json = "{"+arr.join(",")+"}"
  	oCOM.writeDisplay('watchparam',json);
	oCOM.writeDisplay('watchparam2',str);
	return {"listing":s,"json":json,"stream":str};
}

// [B786][A204][542F][7504][542F][72AC][AB06][4167][AB0C][BEE5][8F61][AA9A][8F54][AAE0][8F60][C024][B392][AD6C][542F][19EC][542F][72C][542F][1884][B11A][C784][542F][7296][542F][E741][542F][E742][542F][754][542F][E743][542F][E744][8F5D][97E0][8F5D][97E1][8F64][7317][8F52][4E6C][8F52][4DCC][8F69][B8ED][8F69][B8E9][8F52][C0BD][8F52][C0B9][8B89][E6C4][8B8B][E6C4][8BA3][B9C4][542F][9FD4][542F][E6C4][542F][1244][5308][E6C4]
function conv(inp,s)
{
	//inp = "......"  // dbg=debug, slen=string length, glen=block length(group), blen=word length, defc=default character
	inp = (inp+" ".repeat(s.slen)).substring(0,s.slen).toUpperCase().replace(new RegExp(`[^${s.c}]`,'g'),s.defc);
	if(s.dbg) document.write(inp+"<br>");
	for(var i=0, str="";i<inp.length;i+=s.glen)
	{
		var w = ("0".repeat(s.wlen)+oCOM.base_convert(inp.substring(i,i+s.glen),[s.c],["0123456789ABCDEF"])).slice(-s.wlen);
		if(s.dbg) document.write("oCOM.base_convert["+w+"]");
		str+=w;
	}
	return str;
}


//  ████████  █████  ██ ██      
//     ██    ██   ██ ██ ██      
//     ██    ███████ ██ ██      
//     ██    ██   ██ ██ ██      
//     ██    ██   ██ ██ ███████ 


function getHexVar(v)
{
	if (v < 256) return oCOM.getHexByte(v)
	return oCOM.getHexWord(v)
}
