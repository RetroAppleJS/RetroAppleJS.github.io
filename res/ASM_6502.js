// 6502 assembler
// n. landsteiner, mass:werk / electronic tradion 2005; e-tradion.net

// lookup tables

var hextab = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
var instrtab = {
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

var addrtab = {
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
	HEX: true,
	BIN: true,
	ASC: true
}
var dbgsym = {}


var pragma_dat = {}




// globals

var codesrc, code, srcl, srcc, pc, symtab, listing;
var codesrc_buf = new Array();
var code_pc = new Array();
var asm = {
	"pass": 0,
	"step": 0,
	"sym": [],
	"symlink_l": 0,
	"symlink":{}
};

// functions

function assemble_step()
{
	listing = document.forms.ass.listing;
	var showADR = document.ass.showADR.checked;
	var codefield = document.getElementById('codefield');
	//var codefield = document.forms.ass.codefield;
	getSrc(document.forms.ass.srcfield); // Slice ASM lines -> codesrc (array)
	var crlf = "<br>"

	if (asm.pass == 0 && asm.step == 0)
	{
		asm.symtab = {};
		asm.symlink = {};
		asm.symlink_l = 0;
		codefield.innerHTML = ' '+crlf;
		listing.value = '' //'starting assembly\npass 1\n';

		asm.code = [];
		// TODO : RE-WRITE DOPASS IN TAKING ONE STEP AT THE TIME !!  FVD

		asm.srcl = asm.srcc = asm.pc = 0;
		asm.sym = {};
	}

	asm.sym = s_getSym();
	asm.step = 1;
	listing.value += "asm.sym [" + asm.sym.join(" ") + "]\n"
}


//   ???????????????  ????????????????????? ????????????????????? ????????????????????? ?????????    ????????? ??????????????????  ??????      ????????????????????? ??????????????????  
//  ??????   ?????? ??????      ??????      ??????      ????????????  ???????????? ??????   ?????? ??????      ??????      ??????   ?????? 
//  ????????????????????? ????????????????????? ????????????????????? ???????????????   ?????? ???????????? ?????? ??????????????????  ??????      ???????????????   ??????????????????  
//  ??????   ??????      ??????      ?????? ??????      ??????  ??????  ?????? ??????   ?????? ??????      ??????      ??????   ?????? 
//  ??????   ?????? ????????????????????? ????????????????????? ????????????????????? ??????      ?????? ??????????????????  ????????????????????? ????????????????????? ??????   ?????? 

function assemble()
{
	code_pc = new Array();
	symtab = {};
	asm.symlink = {};
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
	code = [];
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
				listing.value += ds.listing;		// debug symbols
				for(var i=0;i<ds.stream.length;i+=2)
					code[code.length] = parseInt(ds.stream.charAt(i)+ds.stream.charAt(i+1),16);
			}
			c = '';
			var n = 0;
			for (var i = 0; i < code.length; i++)
			{
				var new_pc = code_pc[i];
				if (new_pc > 0) pc = new_pc + code.length - i - 1
				if (((n > 0) && (n % 8 == 0)) || new_pc > 0)
				{
					c += (i == 0 ? '' : crlf)
					+ (showADR == 1 && (code.length - i - 1) >= 0 ? (getHexWord(pc - code.length + i + 1) + ': ') : '');
					n = 0;
				}
				c += getHexByte(code[i]) + ' ';
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

function s_getChar()
{
	if (asm.srcl >= codesrc.length) return 'EOF';
	if (asm.srcc >= codesrc[asm.srcl].length)
	{
		asm.srcc = 0;
		asm.srcl++;
		return '\n';
	}
	else
	{
		var c = codesrc[asm.srcl].charAt(asm.srcc);
		asm.srcc++;
		return c //.toUpperCase();
	}
}

// TODO create s_getSym
function s_getSym()
{
	var c = s_getChar();
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
				m = 0;
				s++;
				sym[s] = '';
			}
			if (q == 1)
			{
				sym[s] += c;
			}
		}
		else if (c == '=')
		{
			if (m > 0) s++;
			sym[s] = c;
			m = 0;
			s++;
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
		c = s_getChar();
	}
	while ((sym.length) && (sym[sym.length - 1] == '')) sym.length--;
	return (c == 'EOF') ? null : sym;
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

function getNumber(n)
{
	var c = n.charAt(0);
	var sgn = (c == '-' ? -1 : 1);
	var r;
	if (c == '+' || c == '-') n = n.substring(1, n.length);
	if (n == null) r = 0;
	if (n.charAt(0) == '$')
	{
		for (var i = 1; i < n.length; i++)
		{
			var c = n.charAt(i);
			if ((c < 'A') && (c > 'Z') && (c < '0') && (c > '9')) return 'NaN';
		}
		r = sgn * parseInt(n.substring(1), 16);
	}
	else if (n.charAt(0) == '%')
	{
		for (var i = 1; i < n.length; i++)
		{
			var c = n.charAt(i);
			if ((c != '1') && (c != '0')) return 'NaN';
		}
		r = sgn * parseInt(n.substring(1), 2);
	}
	else if (n.charAt(0) == '0')
	{
		for (var i = 1; i < n.length; i++)
		{
			var c = n.charAt(i);
			if ((c < '0') && (c > '7')) return 'NaN';
		}
		r = sgn * parseInt(n, 8);
	}
	else
	{
		for (var i = 1; i < n.length; i++)
		{
			var c = n.charAt(i);
			if ((c < '0') && (c > '9')) return 'NaN';
		}
		r = sgn * parseInt(n, 10);
	}
	return (isNaN(r)) ? 'NaN' : r;
}

function getString(n)
{
	var p1 = n.indexOf("\"")+1;
	var p2 = n.lastIndexOf("\"")
	return n.substring(p1,p2);
}

function getAscii(n)
{
	return n.charCodeAt(0) + 128;
}

function getIdentifier(n)
{
	for (var i = 0; i < n.length; i++)
	{
		var c = n.charAt(i);
		if ((c < 'A') && (c > 'Z') && (c < '0') && (c > '9') && (c != '_')) return '';
	}
	n = n.split("+")[0].split("-")[0];  // FVD separate + and - postfixes from labels 
	if (n.length > 6)
	{
		n = n.substring(0, 6);
	}
	return n;
}

function getOffset(n)
{
	var a = n.lastIndexOf("+");
	var b = n.lastIndexOf("-");
	var c = a >= 0 && b < 0 ? a : b;
	var d = n.length - c - 1;
	if (c < 0 && d > 6) return 0;
	nn = n.slice(-d - 1);
	var nn = getNumber(nn);
	return nn == "NaN" ? 0 : nn;
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


//  ??????????????????   ??????????????????  ??????????????????   ???????????????  ????????????????????? ????????????????????? 
//  ??????   ?????? ??????    ?????? ??????   ?????? ??????   ?????? ??????      ??????      
//  ??????   ?????? ??????    ?????? ??????????????????  ????????????????????? ????????????????????? ????????????????????? 
//  ??????   ?????? ??????    ?????? ??????      ??????   ??????      ??????      ?????? 
//  ??????????????????   ??????????????????  ??????      ??????   ?????? ????????????????????? ????????????????????? 

function doPass(pass)
{
	srcl = srcc = pc = 0;
	var sym = getSym();
	while (sym)
	{
		if(listing.value.length>0) listing.value += '\n';
		if (sym.length == 0)
		{
			sym = getSym();
			continue;
		}
		//if(pass==1) {
		// parse pragma
		if (sym[0] != ".DEFINE")
		{
			if (pragma_dat[".DEFINE"] != null)
			{
				for (var i in sym)
				{
					var match = pragma_dat[".DEFINE"][sym]
					if (match != null)
						sym[i] = match;
				}
			}
		}
		//}

		pc &= 0xffff;
		var ofs = 0;
		var c1 = sym[0].charAt(0);
		var padd = 0;

		if (sym[0] == '*' || sym[0].toLowerCase() == 'org')
		{
			// set pc
			listing.value += sym[0];
			if ((sym.length == 2) && (sym[0].toLowerCase() == 'org'))
			{
				sym[2] = sym[1];
				sym[1] = '=';
			}
			if ((sym.length > 2) && (sym[1] == '='))
			{
				listing.value += ' = ';
				var a = getNumber(sym[2]);
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
				listing.value += '$' + getHexWord(a);
				code_pc[code.length] = a;
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
		listing.value += getHexWord(pc) + ' '; // FVD TODO: do not list PC with directives like 'equ'
		if (c1 == '.')
		{
			// pragma
			var pragma = sym[0];
			//listing.value+=pragma;
			if (pragma == '.END')
			{
				listing.value += pragma;
				return true;
			}
			else if ((pragma != '.WORD') &&
				(pragma != '.BYTE') &&
				(pragma != '.TEXT') &&
				(pragma != '.DEFINE') &&
				(pragma != '.IFDEF') &&
				(pragma != '.IFNDEF') &&
				(pragma != '.ENDIF')
			)
			{
				displayError('syntax error:\ninvalid pragma "' + pragma + '"');
				return false;
			}
			if (sym.length > 2)
			{
				if (pass == 1)
				{
					if (pragma == '.DEFINE')
					{
						if (typeof (pragma_dat[".DEFINE"]) == "undefined")
							pragma_dat[".DEFINE"] = {};
						pragma_dat[".DEFINE"][sym[1]] = sym.slice(2, sym.length).join(" ")
						//listing.value+=pragma_dat[".DEFINE"][sym[1]];
						sym = getSym();
						continue;
						// TODO look where getIdentifier() can be skipped !!
					}
				}
			}
			else if (sym.length == 2)
			{
				listing.value += pragma;
				if (pass == 2)
				{
					var v;
					if (sym[1] == '*')
					{
						v = pc;
					}
					else
					{
						v = sym[1];
						var v1 = v.charAt(0);
						var bt = 0;
						if ((v1 == '>') || (v1 == '<'))
						{
							bt = (v1 == '>') ? 1 : -1;
							v = v.substr(1);
							v1 = v.charAt(0);
						}
						if ((v1 == '$') || (v1 == '%') || ((v1 >= '0') && (v1 <= '9')))
						{
							// number
							v = getNumber(v);
							if (v == 'NaN')
							{
								displayError('syntax error:\ninvalid value');
								return false;
							}
						}
						else if(v1 == '"')
						{
							// string
							v = getString(v);
							listing.value += '  "'+v+'"';
							for(var i=0;i<v.length;i++)
							{
								code[code.length] = getAscii(v.charAt(i));
								// TODO add listing items per 3 bytes
							}

							//alert(v);
						}
						else
						{
							// identifier
							v = getIdentifier(v);
							if (v == '')
							{
								displayError('syntax error:\ninvalid identifier');
								return false;
							}
							else if (typeof symtab[v] == 'undefined')
							{
								displayError('compile error:\nundefined identifier: "' + v + '"');
								return false;
							}
							v = symtab[v];
						}
						if (bt < 0)
						{
							// lo-byte
							v &= 0xff;
						}
						else if (bt > 0)
						{
							// hi-byte
							v = Math.floor(v / 256) & 0xff;
						}
					}
					v &= 0xffff;
					var hi = Math.floor(v / 256) & 0xff;
					var lo = v & 0xff;
					code[code.length] = lo;
					if (pragma == '.WORD')
					{
						code[code.length] = hi;
						listing.value += ' $' + getHexWord(v) + '            ' + getHexByte(lo) + ' ' + getHexByte(hi);
					}
					else if (pragma == '.BYTE')
					{
						listing.value += ' $' + getHexByte(lo) + '              ' + getHexByte(lo);
					}
				}
				else
				{
					listing.value += ' ' + sym[1];
				}
				pc += (pragma == '.WORD') ? 2 : 0;
				pc += (pragma == '.BYTE') ? 1 : 0;
				pc += (pragma == '.TEXT') ? getString(sym[1]).length : 0;
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
		else if ((c1 < 'A') || (c1 > 'Z'))
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else if (instrtab[sym[0]] == null && macrotab[sym[0]] == null)
		{
			// identifier (e.g. GETADR)
			var l = getIdentifier(sym[0]);
			if (l == '')
			{
				displayError('syntax error:\ninvalid identifier: ' + sym[0]);
				return false;
			}
			listing.value += paddRight(l, 6) + ' ';
			ofs++;
			if ((sym.length > 1) && (sym[ofs] == '='))
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
				if (sym[2] == '*') v = pc;
				else v = getNumber(sym[2]);
				if (v == 'NaN')
				{
					displayError('syntax error:\nnumber expected');
					return false;
				}
				if (pass == 1)
				{
					symtab[l] = v;
					sym_link(
					{
						"type": "def",
						"PC": pc,
						"val": v,
						"sym": l,
						"sym0": sym[0]
					})
				}
				listing.value += getHexWord(v);
				sym = getSym();
				continue;
			}
			else
			{
				if (pass == 1 && sym[ofs].toLowerCase() == "equ") // FVD add EQU directive (TODO pass 2)
				{
					var v = getNumber(sym[ofs + 1]);
					if (v == 'NaN')
					{
						displayError('syntax error:\nnumber expected');
						return false;
					}
					symtab[l] = v;
					listing.value += " = " + getHexWord(v);
					sym = getSym();
					continue
				}
				if (pass == 1)
				{
					symtab[l] = pc; // assign program counter to label
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
					continue
				}
				padd = 7;
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
		if ((c1 < 'A') || (c1 > 'Z'))
		{
			listing.value += sym[0];
			displayError('syntax error:\ncharacter expected');
			return false;
		}
		else
		{
			// opcode
			var opc = sym[ofs];
			listing.value += opc + ' ';
			var opctab = instrtab[opc];
			//FVD
			var mactab = macrotab[opc];

			if (opctab == null && mactab == null)
			{
				displayError('syntax error:\nopcode or macro expected');
				return false;
			}
			var addr = sym[ofs + 1];
			var mode = 0;
			if (typeof addr == 'undefined')
			{
				// implied
				if (opctab[0] < 0)
				{
					displayError('syntax error:\nunexpected end of line');
					return false;
				}
				else if (pass == 2)
				{
					// compile
					listing.value += '            ' + getHexByte(opctab[0]);
					code[code.length] = opctab[0];
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
							code = code.concat(dat)
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
							code = code.concat(dat)
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
							code = code.concat(dat);
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
					if (pass == 2)
					{
						listing.value += 'A';
						padd = 1;
					}
					mode = 1;
				}
				else if (a1 == '#')
				{
					a2 = addr.charAt(1);
					if (pass == 2)
					{
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
					}
					b1 = 1;
					mode = 2;
				}
				else if (a1 == '*')
				{
					if (pass == 2)
					{
						listing.value += a1;
						padd = 1;
					}
					b1 = 1;
					mode = 6;
				}
				else if (a1 == '(')
				{
					if (pass == 2)
					{
						listing.value += a1;
						padd = 1;
					}
					b1 = 1;
					mode = 9;
				}
				else if (mactab != null && ((a1 >= '0' && a1 <= '9') || (a1 >= 'A' && a1 <= 'F')))
				{
					b1 = 1;
					mode = 13;
				}
				else
				{
					if (opctab != null) mode = (opctab[12] < 0) ? 3 : 12;
				}
				if (pass == 1) listing.value += addr;
				if (mode == 9)
				{
					var b3 = addr.indexOf(',X)');
					if ((b3 > 0) && (b3 == addr.length - 3))
					{
						mode += 1;
					}
					else
					{
						b3 = addr.indexOf('),Y');
						if ((b3 > 0) && (b3 == addr.length - 3))
						{
							mode += 2;
						}
						else
						{
							b3 = addr.indexOf(')');
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
					var instr = opctab[mode];
					if (instr < 0)
					{
						displayError('compile error:\ninvalid address mode for ' + opc);
						return false;
					}
					else
					{
						code[code.length] = instr;
					}
					if (mode > 1)
					{
						// operand
						addr = addr.substring(b1, b2);
						var bt = 0;
						var adp = addr.charAt(0); // address prefix
						var oper = 0;
						if ((adp == '>') || (adp == '<'))
						{
							bt = (adp == '>') ? 1 : -1;
							listing.value += adp;
							padd++;
							addr = addr.substr(1);
							adp = addr.charAt(0);
						}
						if ((adp == '$') || (adp == '%') || ((adp >= '0') && (adp <= '9')))
						{
							// number
							oper = getNumber(addr);
							if (oper == 'NaN')
							{
								displayError('syntax error:\nnumber expected');
								return false;
							}
							oper &= 0xffff;
							var s = (steptab[mode] > 2) ? '$' + getHexWord(oper) : '$' + getHexByte(oper);
							listing.value += s;
							padd += s.length;
						}
						else if (adp == '\'')
						{
							// ascii character
							a1 = addr.charAt(1);
							var num_offset = Number(getOffset(addr));

							listing.value += addr;
							oper = getAscii(a1) + num_offset;
							if (num_offset > 0) padd += String(num_offset).length + 1;
							var num_offset = 0;
							//  var s='$'+getHexByte(oper);
							//  listing.value+=s;
							//  padd+=s.length;
						}
						else
						{
							// label identifier for an address location
							var addr_offset = Number(getOffset(addr));
							// FVD getOffset  e.g.    TEMP = $6005 + $10
							addr = getIdentifier(addr); // FVD filter out label from address


							//addr_offset = addr_offset.substring(addr.length,addr_offset.length);
							//var ao1 = addr_offset.charAt(0);
							//if(ao1=='+' || ao1=='-') addr_offset = Number(addr_offset)
							//else addr_offset = 0;


							if (addr == '')
							{
								displayError('syntax error:\ninvalid identifier');
								return false;
							}
							else if (typeof symtab[addr] == 'undefined')
							{
								displayError('compile error:\nundefined identifier "' + addr + '"');
								return false;
							}
							oper = symtab[addr] + addr_offset;
							listing.value += addr;
							addr = '' + addr;
							padd += addr.length;
						}
						if (bt < 0)
						{
							// lo-byte
							oper &= 0xff;
						}
						else if (bt > 0)
						{
							// hi-byte
							oper = Math.floor(oper / 256) & 0xff;
						}
						if (mode == 12)
						{
							// rel
							oper = oper - ((pc + 2) & 0xffff);
							if ((oper > 127) || (oper < -128))
							{
								displayError('error: branch target out of range');
								return false;
							}
						}
						if ((mode == 4) || (mode == 7))
						{
							listing.value += ',X';
							padd += 2;
						}
						else if ((mode == 5) || (mode == 8))
						{
							listing.value += ',Y';
							padd += 2;
						}
						else if (mode == 9)
						{
							listing.value += ')';
							padd += 1;
						}
						else if (mode == 10)
						{
							listing.value += ',X)';
							padd += 3;
						}
						else if (mode == 11)
						{
							listing.value += '),Y';
							padd += 3;
						}
					}
					// compile

					//listing.value += "(" + mode + ")";

					for (var i = padd; i < 12; i++) listing.value += ' ';
					listing.value += getHexByte(instr);
					if (mode > 1)
					{
						var op = oper & 0xff;
						code[code.length] = op;
						listing.value += ' ' + getHexByte(op);
						if (steptab[mode] > 2)
						{
							op = (Math.floor(oper / 256)) & 0xff;
							code[code.length] = op;
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

function debug_symbols(showDBG)
{
	// TODO
	var s = "\n*** DEBUG SYMBOLS ***\n";
	function q(str) { return "\""+str+"\"" };
	var arr = [], alt = true, str = "";
	str += showDBG.ROM || showDBG.RAM ? "FAFF" : "";
	for (var i in symtab)
	{
		if(showDBG.RAM && symtab[i]<parseInt("C000",16)
			|| showDBG.ROM && symtab[i]>=parseInt("C000",16))
		{
			m = (i+" ".repeat(6-i.length)) + " = $" + getHexVar(symtab[i])
			if(alt) s += m+" ".repeat(m.length>17?1:17-m.length); else s += m+"\n";
			alt = !alt;

			var lbl = conv(i //"______"
			//.toUpperCase().replace(/Q/g,"O").replace(/0/g,"O").replace(/U/g,"V")
			//,{"dbg":true,"slen":6,"glen":6,"blen":4,"s.defc":".","c":"123456789ABCDEFGHIJKLMNOPRSTVWXYZ ."});
			,{"dbg":false,"slen":6,"glen":3,"wlen":4,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF
			var adr = getHexWord(symtab[i]);
			str += lbl + adr;
		}

  }
	str += showDBG.ROM || showDBG.RAM ? "FF" : "";  // STOP WITH HEX BYTE  = FF (=assumed - impossible - string)

	var json = "{"+arr.join(",")+"}"
  writeDisplay('watchparam',json);
	writeDisplay('watchparam2',str);
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
			if (typeof (asm.symlink[_obj.PC]) != "undefined") alert("double entry! ")// + JSON.stringify(_obj))
			key = _obj.PC;
			asm.symlink[key] = {
				"type": _obj.type,
				"sym": _obj.sym
			};
			break;
		case "def":
			key = _obj.val
			if (_obj.val < 256)
				asm.symlink[key] = {
					"type": "vdef",
					"sym": _obj.sym
				};
			else
				asm.symlink[key] = {
					"type": "ldef",
					"sym": _obj.sym
				};
			break;
		default:
			key = "i" + asm.symlink_l
			asm.symlink[key] = _obj;
			asm.symlink_l++;
	}
	if(_obj.call) asm.symlink[key].call = _obj.call;
}



//  ????????????????????????  ???????????????  ?????? ??????      
//     ??????    ??????   ?????? ?????? ??????      
//     ??????    ????????????????????? ?????? ??????      
//     ??????    ??????   ?????? ?????? ??????      
//     ??????    ??????   ?????? ?????? ????????????????????? 


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
