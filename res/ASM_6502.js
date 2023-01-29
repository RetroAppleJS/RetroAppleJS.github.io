// 2022 adaptations by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// Thanks to n. landsteiner, mass:werk / electronic tradion 2005; e-tradion.net
// ASM_6502.js



var oASM = new ASM();
oASM.init();



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

// FVD
var macrotab = {
	"HEX": true,
	"BIN": true,
	"ASC": true
}
var dbgsym = {}




// globals

var codesrc, srcl, srcc, pc, listing;
var codesrc_buf = new Array();
var code_pc = new Array();


// functions

//   █████  ███████ ███████ ███████ ███    ███ ██████  ██      ███████ ██████  
//  ██   ██ ██      ██      ██      ████  ████ ██   ██ ██      ██      ██   ██ 
//  ███████ ███████ ███████ █████   ██ ████ ██ ██████  ██      █████   ██████  
//  ██   ██      ██      ██ ██      ██  ██  ██ ██   ██ ██      ██      ██   ██ 
//  ██   ██ ███████ ███████ ███████ ██      ██ ██████  ███████ ███████ ██   ██ 

function assemble()
{

	code_pc = new Array();
	oASM.symtab = {};
	oASM.symlink = {};
	var crlf = "<br>"

	listing = document.forms.ass.listing;
	var showADR = document.ass.showADR.checked;
	var showDBG = {"RAM":document.ass.showDBG_RAM.checked == true,"ROM":document.ass.showDBG_ROM.checked == true}


	//var codefield = document.forms.ass.codefield;
	var codefield = document.getElementById('codefield');

	getSrc(document.forms.ass.srcfield);
	codefield.innerHTML = ' '+crlf;
	//listing.value = 'starting assembly\npass 1\n';
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
				listing.value += ds.listing;		// add debug symbols
				for(var i=0;i<ds.stream.length;i+=2)
				oASM.write_code(parseInt(ds.stream.charAt(i)+ds.stream.charAt(i+1),16));
			}
			c = '';
			var n = 0;
			var l = oASM.get_code_len();
			for (var i = 0; i < l; i++)
			{
				var new_pc = code_pc[i];
				if (new_pc > 0) pc = new_pc + l - i - 1
				if (((n > 0) && (n % 8 == 0)) || new_pc > 0)
				{
					c += (i == 0 ? '' : crlf)
					+ (showADR == 1 && (l - i - 1) >= 0 ? (getHexWord(pc - l + i + 1) + ': ') : '');
					n = 0;
				}
				c += getHexByte(oASM.read_code(i)) + ' ';
				n++;
			}
			codefield.innerHTML = c;
			listing.value += '\ndone.';
		}
	}
	if ((pass1) && (pass2))
	{
		//alert('6502 Assembler:\ndone.');
	}
	else
	{
		listing.value += '\nfailed.\n';
		alert('6502 Assembler:\nfailed (see listing).');
	}
}

function displayError(er)
{
	listing.value += '\n' + er + '\n';
	return false;
}

/////////////////////////////////////////
// GetSrc()                            //
// Slice ASM source into lines         //
// & Remove all comments               //
/////////////////////////////////////////

function getSrc(formfield, bComments)
{
	if (formfield.value.indexOf('\r\n') >= 0)
	{
		codesrc = formfield.value.split('\r\n');
	}
	else if (formfield.value.indexOf('\r') >= 0)
	{
		codesrc = formfield.value.split('\r');
	}
	else
	{
		codesrc = formfield.value.split('\n');
	}
	//FVD remove all comments
	if (!bComments)
	{
		for (var i = 0; i < codesrc.length; i++)
			codesrc[i] = codesrc[i].split(";")[0]
	}
}


function getChar()
{
	if (srcl >= codesrc.length) return 'EOF';
	if (srcc >= codesrc[srcl].length)
	{
		srcc = 0;
		srcl++;
		return '\n';
	}
	else
	{
		var c = codesrc[srcl].charAt(srcc);
		srcc++;
		return c //.toUpperCase();
	}
}






function getSym()
{
	var c = getChar();
	if (c == 'EOF') return null;
	var sym = [''];
	var s = 0;
	var m = 0;
	var q = 0;
	while ((c != ';') && (c != '\n') && (c != 'EOF'))
	{
		if ((c == ' ') || (c == '\t'))
		{
			if (m > 0)
			{
				m = 0; s++;
				sym[s] = '';
			}
			if (q == 1) sym[s] += c;
		}
		else if (c == '=')
		{
			if (m > 0) s++;
			sym[s] = c;
			m = 0; s++;
			sym[s] = '';
		}
		else if (c == "'")
		{
			sym[s] += c;
			q = q == 0 ? 1 : 0;
			m = 0;
		}
		else
		{
			m = 1;
			sym[s] += c;
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
	if (typeof s == 'undefined') s = '';
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
	srcl = srcc = pc = 0;
	var sym = getSym();
	listing.value = "";
	while (sym)
	{
		if(listing.value.length>0) listing.value += '\n';
		if (sym.length == 0)
		{
			sym = getSym();
			continue;
		}

		pc &= 0xffff;
		var ofs = 0;
		var c1 = sym[0].charAt(0);
		var padd = 0;

		// TODO FVD parse this as a PRAGMA !!!

		if (sym[0].toUpperCase() == 'ORG') sym = ["*","=",sym[1]]
		if (sym[0]+sym[1]        == '*=')
		{
			// TODO parse numeric expression (with labels)
			if ((sym.length > 2))
			{
				//listing.value += '*=';
				var a = oASM.getNumber(sym[2]).val;
				if (a == 'NaN')
				{
					displayError('syntax error:\nnumber expected');
					return false;
				}
				else if (sym.length > 3)
				{
					displayError('syntax error:\ntoo many arguments');
					return false;
				}
				listing.value += listing_gen(-1,{"val":"*= $"+getHexWord(a)})

				//listing.value += '$' + getHexWord(a);
				code_pc[oASM.get_code_len()] = a;
				pc = a;
			}
			else
			{
				displayError('syntax error:\nassignment expected');
				return false;
			}

			sym = getSym();
			continue;
		}

		// List PROGRAM COUNTER (PC)
		listing.value += getHexWord(pc) + ' '; // FVD TODO: do not list PC with directives like 'equ'

		if (c1 == '.')
		{
			var r = oASM.parse_pragma(sym,pass);
			if(r!=null) return r.val; else sym = getSym();

			var pragma = sym[0];

			/*
			if (sym.length > 2)	// more than two operands
			{
				if (pass == 1)
				{
					if (pragma == '.DEFINE')
					{
						if (typeof (oASM.pragma_sym[".DEFINE"]) == "undefined")
							oASM.pragma_sym[".DEFINE"] = {};
						oASM.pragma_sym[".DEFINE"][sym[1]] = sym.slice(2, sym.length).join(" ")
						//listing.value+=oASM.pragma_sym[".DEFINE"][sym[1]];
						sym = getSym();
						continue;
					}
				}
			}
			*/
			if (sym.length == 2)	// two operands
			{
				//listing.value += pragma;
				listing.value += listing_gen(-1,{"val":pragma})
				if (pass == 2)
				{

					
					var v = sym[1];
					//v = oASM.getNumber(v).val;
					
					
					var v1 = v.charAt(0);
					var bt = 0;
					if ((v1 == '>') || (v1 == '<'))
					{
						bt = (v1 == '>') ? 1 : -1;
						v = v.substring(1);
						v1 = v.charAt(0);
					}
					if ((v1 == '$') || (v1 == '%') || ((v1 >= '0') && (v1 <= '9')))
					{
						// number
						v = oASM.getNumber(v).val;
						if (v == 'NaN')
						{
							displayError('syntax error:\ninvalid value');
							return false;
						}
					}
					else if(v1 == '"')	// ASCII
					{
						// string
						v = oASM.getString(v).val;
						listing.value += '  "'+v+'"';
						for(var i=0;i<v.length;i++)
						{
							oASM.write_code( getAscii(v.charAt(i)) );
							// TODO add listing items per 3 bytes
						}
					}
					else
					{
						// identifier
						v = oASM.getID(v).val;
						if (v == '')
						{
							displayError('syntax error:\ninvalid identifier');
							return false;
						}
						else if (typeof oASM.symtab[v] == 'undefined')
						{
							displayError('compile error:\nundefined identifier: "' + v + '"');
							return false;
						}
						v = oASM.symtab[v];
					}
					



					if (bt < 0)
					{
						// lo-byte
						v &= 0xff;
					}
					else if (bt > 0)
					{
						// hi-byte
						//v = Math.floor(v / 256) & 0xff;
						v = (v >> 8) & 0xff;
					}
					
					v &= 0xffff;
					var hi = Math.floor(v / 256) & 0xff;
					var lo = v & 0xff;
					oASM.write_code( lo );


					//if (pragma == '.WORD')
					//{
					//	oASM.write_code( hi );
					//	listing.value += ' $' + getHexWord(v) + '            ' + getHexByte(lo) + ' ' + getHexByte(hi);
					//}
					//else
					if (pragma == '.BYTE')
					{
						listing.value += ' $' + getHexByte(lo) + '              ' + getHexByte(lo);
					}
				}
				else
				{
					listing.value += ' ' + sym[1];
				}
				//pc += (pragma == '.WORD') ? 2 : 0;
				pc += (pragma == '.BYTE') ? 1 : 0;
				pc += (pragma == '.TEXT') ? oASM.getString(sym[1]).val.length : 0;
				sym = getSym();
				continue;
			}
			else if (sym.length == 1)
			{
				displayError('syntax error:\nvalue expected');
				return false;
			}
			else
			{
				displayError('syntax error:\ntoo many arguments');
				return false;
			}
		}
		else if (((c1 < 'A') || (c1 > 'Z')) && (c1 != '.'))					
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else if (instrtab[sym[0]] == null && macrotab[sym[0]] == null)			// no assembler mnemonic or directive ? (probably a label)
		{
			// label
			var l = oASM.getID(sym[0]).val;
			if (l == '')
			{
				displayError('syntax error:\ninvalid identifier: ' + sym[0]);
				return false;
			}
			// List LABEL
			listing.value += paddRight(l, oASM.label_len) + ' ';
			ofs++;
			if ((sym.length > 1) && (sym[ofs] == '=' || sym[ofs] == 'EQU'))
			{
				ofs++;
				listing.value += '= ';
				if (sym.length < 3)
				{
					displayError('syntax error:\nunexpected end of line');
					return false;
				}
				else if (sym.length > 3)
				{
					displayError('syntax error:\ntoo many arguments');
					return false;
				}
				var v;
				if (sym[2] == '*') v = {"val":pc};
				else v = oASM.getNumber(sym[2]);
				if (v.val == 'NaN')
				{
					displayError('syntax error:\nnumber expected');
					return false;
				}
				if (pass == 1)
				{
					oASM.symtab[l] = v.val;
					sym_link(
					{
						"type": "def",
						"PC": pc,
						"val": v.val,
						"sym": l,
						"sym0": sym[0]
					})
				}
				//listing.value += getHexWord(v.val);
				listing.value += "$"+oCOM.getHexMulti(v.val,v.bytes*2);
				sym = getSym();
				continue;
			}
			else
			{
				if (pass == 1 && sym[ofs] && sym[ofs].toLowerCase() == "equ") // FVD add EQU directive (TODO pass 2)
				{
					var v = oASM.getNumber(sym[ofs + 1]);
					if (v.val == 'NaN')
					{
						displayError('syntax error:\nnumber expected');
						return false;
					}
					oASM.symtab[l] = v.val;
					listing.value += " = " + getHexWord(v.val);
					sym = getSym();
					continue
				}
				if (pass == 1)
				{
					oASM.symtab[l] = pc; // assign program counter to label
					sym_link(
					{
						"type": "loc",
						"sym": l,
						"PC": pc
					})
				}
				if (sym.length >= ofs + 1)
				{
					c1 = sym[ofs].charAt(0);
				}
				else
				{
					sym = getSym();
					continue;
				}
				padd = oASM.label_len+1;
			}
		}
		if (sym.length < ofs)
		{
			// end of line
			sym = getSym();
			continue;
		}
		if (padd == 0) listing.value += '       ';
		padd = 0;
		if (((c1 < 'A') || (c1 > 'Z')) && (c1 != '.'))
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else
		{
			// opcode
			var opc = sym[ofs];
			// SUBSTITUTED BY listing_gen()
			//listing.value += opc + ' ';
			
			var opctab = instrtab[opc];
			//FVD
			var mactab = macrotab[opc];

			if (opctab == null && mactab == null)
			{
				displayError('syntax error:\nopcode or macro expected');
				return false;
			}
			var addr = sym[ofs + 1];
			var mode = 0;  						// implied
			if (typeof addr == 'undefined')
			{
				if (opctab[0] < 0)
				{
					displayError('syntax error:\nunexpected end of line');
					return false;
				}
				else if (pass == 2)
				{
					// compile
					//listing.value += '            ' + getHexByte(opctab[0]);
					listing.value += listing_gen(mode,{"opcode":opc+'         '+getHexByte(opctab[0])})
					oASM.write_code( opctab[0] );
				}
				pc++;
			}
			//else if(addr=="'" || addr=="#'")
			//{
			//}
			else if (opctab != null && sym.length > ofs + 2)
			{
				displayError('syntax error:\ntoo many operands');
				return false;
			}
			else if (mactab != null) // MACRO CODE
			{
				function getByteArray(arg)
				{
					str = arg.replace(/[^A-Fa-f0-9]/g, "");
					if (arg != str || arg.length % 2 != 0)
					{
						displayError('format error:\nwrong or odd digits');
						return false;
					}
					for (var dat = []; dat.length < (arg.length / 2);)
					{
						dat[dat.length] = parseInt(arg.substring(dat.length * 2, dat.length * 2 + 2), 16);
					}
					return dat;
				}

				function getBitArray(arg)
				{
					str = arg.replace(/[^0-1]/g, "");
					if (arg != str || arg.length % 8 != 0)
					{
						displayError('format error:\nwrong or odd digits');
						return false;
					}
					for (var dat = []; dat.length < (arg.length / 8);)
					{
						dat[dat.length] = parseInt(arg.substring(dat.length * 8, dat.length * 8 + 8), 2);
					}
					return dat;
				}


				switch (opc)
				{
					case "HEX":
						var arg = sym.slice(ofs + 1, sym.length).join(" ")
						var dat = getByteArray(addr);
						if (pass == 1) listing.value += arg
						if (pass == 2)
						{
							oASM.concat_code(dat);
							listing.value += arg;
						}
						pc += dat.length;
						break;

					case "BIN":
						var arg = sym.slice(ofs + 1, sym.length).join(" ")
						var dat = getBitArray(addr);
						if (pass == 1) listing.value += arg
						if (pass == 2)
						{
							oASM.concat_code(dat);
							listing.value += arg;
						}
						pc += dat.length;
						break;

					case "ASC":
						var str = sym.join(" ").split("\"")[1];
						eval("var arg=\"" + str + "\"");
						if (pass == 1) listing.value += "\"" + arg + "\"";
						var dat = [];
						for (var i = 0; i < arg.length; i++)
							dat[i] = getAscii(arg.charAt(i));
						if (pass == 2)
						{
							oASM.concat_code(dat);
							listing.value += "\"" + arg + "\"";
						}
						pc += dat.length;
						break;
				}
			}
			else
			{
				var a1 = addr.charAt(0);
				var b1 = 0;
				var b2 = addr.length;
				if (addr == 'A')
				{
					mode = 1;					// Accumulator
					if (pass == 2)
					{
						listing.value += listing_gen(mode,{"opcode":opc})
						padd = 4+1;
						//listing.value += 'A';
						//padd = 1;
					}
				}
				else if (a1 == '#')
				{
					a2 = addr.charAt(1);
					if (pass == 2)
					{
						// SUBSTITUTED BY listing_gen()
						/*
						var a2 = addr.charAt(1);
						//if(a2=='\'') { listing.value+='#\''+addr.charAt(2)+'\'';padd=4; }
						if (a2 == '\'')
						{
							listing.value += '#';
							padd = 4;
						}
						else
						{
							listing.value += a1;
							padd = 1;
						}
						*/
					}
					b1 = 1;
					mode = 2;					// immediate
				}
				else if (a1 == '*')
				{
					// SUBSTITUTED BY listing_gen()
					/*
					if (pass == 2)
					{
						listing.value += a1;
						padd = 1;
					}
					*/
					b1 = 1;
					mode = 6;					// zeropage
				}
				else if (a1 == '(')
				{
					if (pass == 2)
					{
						listing.value += a1;
						padd = 1;
					}
					b1 = 1;
					mode = 9;					// X-indexed, indirect
				}
				else if (mactab != null && ((a1 >= '0' && a1 <= '9') || (a1 >= 'A' && a1 <= 'F')))
				{
					b1 = 1;
					mode = 13;
				}
				else
				{
					if (opctab != null) mode = (opctab[12] < 0) ? 3 : 12;		// absolute or relative
				}
				if (pass == 1) listing.value += addr;
				if (mode == 9)
				{													// X-indexed, indirect
					var b3 = addr.indexOf(',X)');					// end position of indirect address
					if ((b3 > 0) && (b3 == addr.length - 3))
					{
						mode += 1;									// indirect, Y-indexed
					}
					else
					{
						b3 = addr.indexOf('),Y');					
						if ((b3 > 0) && (b3 == addr.length - 3))
						{
							mode += 2;								// indirect
						}
						else
						{
							b3 = addr.indexOf(')');					// end position of indirect address
						}
					}
					if (b3 < 0)
					{
						displayError('syntax error:\ninvalid address');
						return false;
					}
					b2 = b3;
				}
				else if (mode == 13) //FVD
				{
					// PROCESS MACRO ARGUMENT ? (todo later)
				}
				else if (mode > 2)
				{
					var b3 = addr.indexOf(',X');
					if ((b3 > 0) && (b3 == addr.length - 2))
					{
						mode += 1;
					}
					else
					{
						b3 = addr.indexOf(',Y');
						if ((b3 > 0) && (b3 == addr.length - 2)) mode += 2;
					}
					if (b3 > 0) b2 = b3;
				}
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
						var l = listing.value.length;

						//listing.value += " ("+(a1+" "+a2+" "+oCOM.getHexMulti(e.val,e.bytes*2))+")"
						padd += (listing.value.length - l);
					}
					// compile

					//listing.value += "(" + mode + ")";

					for (var i = padd; i < 12; i++) listing.value += ' ';
					listing.value += getHexByte(instr);
					if (mode > 1)
					{
						var op = oper & 0xff;
						oASM.write_code( op );
						listing.value += ' ' + getHexByte(op);
						if (steptab[mode] > 2)
						{
							op = (Math.floor(oper / 256)) & 0xff;
							oASM.write_code( op );
							listing.value += ' ' + getHexByte(op);
						}
					}
				}
				pc += steptab[mode];
			}
		}
		sym = getSym();
		//listing.value += '\n';
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
		case 9:  return r(a,"OPC ($LL,X)");		// X-indexed, indirect
		case 10: return r(a,"OPC ($LL),Y");		// indirect, Y-indexed
		case 11: return r(a,"OPC ($HHLL)");		// indirect
		case 12: return r(a,"OPC $HHLL");		// relative (alt display method)
		//case 12: return r(a,"OPC $BB");		// relative
		case 13: /* PROCESS MACRO ARGUMENT ? */
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

			var lbl = conv(i //"______"
			//.toUpperCase().replace(/Q/g,"O").replace(/0/g,"O").replace(/U/g,"V")
			//,{"dbg":true,"slen":6,"glen":6,"blen":4,"s.defc":".","c":"123456789ABCDEFGHIJKLMNOPRSTVWXYZ ."});
			,{"dbg":false,"slen":6,"glen":3,"wlen":4,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF
			var adr = getHexWord(oASM.symtab[i]);
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
		//for(var j=0,n=0;j<s.glen;j++)
		//{
		//	var exp = s.glen-j-1;  var chr = s.c.indexOf(inp.charAt(i+j));
		//	var p = chr * Math.pow(s.c.length,exp); n+=p
		//	if(s.dbg) document.write(chr+" * Math.pow("+s.c.length+","+exp+") = "+p+" ("+getHexMulti(p,s.wlen)+")<br>")
		//}
		//if(s.dbg) document.write("$"+getHexMulti(n,s.wlen)+" "+n+" %"+getBinMulti(n,s.wlen) +"<br>")
		//var w = getHexMulti(n,s.wlen);

		var w = ("0".repeat(s.wlen)+oBASE.convert(inp.substring(i,i+s.glen),[s.c],["0123456789ABCDEF"])).slice(-s.wlen);
		if(s.dbg) document.write("oBASE["+w+"]");
		str+=w;
	}
	return str;
}

function sym_link(_obj)
{
	var key = ""
	switch (_obj.type)
	{
		case "loc":
			if (typeof (oASM.symlink[_obj.PC]) != "undefined") alert("double entry! "+ JSON.stringify(_obj))
			key = _obj.PC;
				oASM.symlink[key] = {
				"type": _obj.type,
				"sym": _obj.sym
			};
			break;
		case "def":
			key = _obj.val
			if (_obj.val < 256)
				oASM.symlink[key] = {
					"type": "vdef",
					"sym": _obj.sym
				};
			else
				oASM.symlink[key] = {
					"type": "ldef",
					"sym": _obj.sym
				};
			break;
		default:
			key = "i" + oASM.symlink_l
			oASM.symlink[key] = _obj;
			oASM.symlink_l++;
	}
	if(_obj.call) oASM.symlink[key].call = _obj.call;
}



//  ████████  █████  ██ ██      
//     ██    ██   ██ ██ ██      
//     ██    ███████ ██ ██      
//     ██    ██   ██ ██ ██      
//     ██    ██   ██ ██ ███████ 


/*
var JSON = function ()
{
	this.stringify = JSON_stringify;
}()

function JSON_stringify(_o)
{
	var s = "{";
	for (var i in _o) s += i + ":" + _o[i];
	return s;
}
*/

var hextab = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];


function getHexByte(v)
{
	return '' + hextab[Math.floor(v / 16)] + hextab[v & 0x0f];
}

function getHexWord(v)
{
	return '' + hextab[Math.floor(v / 0x1000)]
						+ hextab[Math.floor((v & 0x0f00) / 256)]
						+ hextab[Math.floor((v & 0xf0) / 16)]
						+ hextab[v & 0x000f];
}

function getHexMulti(v,m)
{
	return ("0".repeat(m)+v.toString(16)).slice(-m).toUpperCase();
}

function getBinMulti(v,m)
{
	var s = "";
	var r = ("0".repeat(m)+v.toString(16)).slice(-m).toUpperCase();
  for(var i=0;i<r.length;i++)
		s+= ("0000"+parseInt(r.charAt(i),16).toString(2)).slice(-4)
	return s;
}

function getHexVar(v)
{
	if (v < 256) return getHexByte(v)
	return getHexWord(v)
}

// constructor mods (IE4 fixes)

var IE4_keyref;
var IE4_keycoderef;

function IE4_makeKeyref()
{
	IE4_keyref = new Array();
	IE4_keycoderef = new Array();
	var hex = new Array('A', 'B', 'C', 'D', 'E', 'F');
	for (var i = 0; i <= 15; i++)
	{
		var high = (i < 10) ? i : hex[i - 10];
		for (var k = 0; k <= 15; k++)
		{
			var low = (k < 10) ? k : hex[k - 10];
			var cc = i * 16 + k;
			if (cc >= 32)
			{
				var cs = unescape('%' + high + low);
				IE4_keyref[cc] = cs;
				IE4_keycoderef[cs] = cc;
			}
		}
	}
}

function _ie4_strfrchr(cc)
{
	return (cc != null) ? IE4_keyref[cc] : '';
}

function _ie4_strchcdat(n)
{
	cs = this.charAt(n);
	return (IE4_keycoderef[cs]) ? IE4_keycoderef[cs] : 0;
}

if (!String.fromCharCode)
{
	IE4_makeKeyref();
	String.fromCharCode = _ie4_strfrchr;
}
if (!String.prototype.charCodeAt)
{
	if (!IE4_keycoderef) IE4_makeKeyref();
	String.prototype.charCodeAt = _ie4_strchcdat;
}
