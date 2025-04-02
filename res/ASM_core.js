//const { split } = require("lodash");
//const { connectableObservableDescriptor } = require("rxjs/internal/observable/ConnectableObservable");

//BUG1: listing LDA (ADR),Y
//BUG2: listing LDA (ADR,X)
//BUG3: .WORD ==> asm listing must be little endian
//BUG4: STA (A1L,X) ==> asm listing (STA ($3C),Y

function ASM()
{

//   █████  ███████ ███████ ███████ ███    ███ ██████  ██      ███████ ██████  
//	██   ██ ██      ██      ██      ████  ████ ██   ██ ██      ██      ██   ██ 
//	███████ ███████ ███████ █████   ██ ████ ██ ██████  ██      █████   ██████
//	██   ██      ██      ██ ██      ██  ██  ██ ██   ██ ██      ██      ██   ██
//	██   ██ ███████ ███████ ███████ ██      ██ ██████  ███████ ███████ ██   ██


	const log2 = Math.log10(2);
	const label_len = 6;
	this.bDebug = false;
	this.pragma_sym = {};
	this.mnemonics  = {};

	this.crlf = "<br>";

	this.init = function(a)
	{
		if(a!=null)
		{
			if(a.label_len!=null) 		this.label_len	 = a.label_len;

			if(a.codefield_el!=null) 	this.codefield_el  = a.codefield_el; // el: binary pane
			if(a.srcfield_el!=null)
			{
				this.srcfield_el = a.srcfield_el;					// el: input pane
				this.codesrc = this.getSrc(this.srcfield_el,false); // Slice ASM lines -> codesrc (array)
				this.codefield_el.innerHTML = ' '+this.crlf;		// clear binary pane
			}
			if(a.listing_el!=null)
			{
				this.listing_el  = a.listing_el; // el: output pane
				this.listing_el.value = '';  // clear output pane
			}

		} 
		this.codedst    = new Uint8Array();
		this.codedst_len = 0;
		this.pass		= 0;
		this.step		= 0;
		this.sym		= [];
		this.symlink_l	= 0;
		this.symlink	= {};	// table of label values
		this.symtab		= {};	// table of labels
		this.code		= [];
		this.srcl		= 0;
		this.srcc		= 0;
		this.pc			= 0;
		this.code_pc    = new Array();
		this.label_len  = label_len;
		this.listing_rewrite = true;
		this.bDebug 	= false;
	}

	this.assemble_step = function(srcfield_el,listing_el,codefield_el)
	{
		if(this.pass==null)
			this.init({"srcfield_el":srcfield_el,"listing_el":listing_el,"codefield_el":codefield_el});
		
		var showADR = document.ass.showADR.checked;

		if (this.pass == 0 && this.step == 0)
			this.listing_el.value += 'pass 1\n';

		if (this.pass == 1 && this.step == 0)
			this.listing_el.value += 'pass 2\n';
	
		// skip empty lines
		do{ this.sym = this.getSym() } while(this.sym!=null && this.sym.length==0)

		this.step++;

		// detect end of pass 0
		if(this.sym==null && this.pass==0) { this.pass = 1; this.step = 0 }
	
		if(this.sym != null)
		{
			var s = "";
			var tag = this.statement_tagger(this.sym)
			if(tag[0]=="LBL")
			{
				this.symtab[this.sym[0]] = this.pc;
				//s+=" symtab[\""+this.sym[0]+"\"] = $"+this.getHexWord(this.pc)+"\n";
			}
			this.listing_el.value += "asm.sym ["+this.sym.join(" ")+"] ["+tag.join(" ")+"]\n"
								 +s
		}
		else
			this.listing_el.value += "asm.pass = ["+this.pass+"]\n"
	}

	this.statement_tagger = function(sym)
	{
		var arr = [];
		// first symbol can be only (mnemonic, pragma or label)
		if(this.mnemonics[sym[0]]!=null)
		{
			arr[0] = "MNE";
			if(sym[1]!=null)	arr[1] = "OPR";
				//arr[1] = sym[1]!="A" ? "VAL" : "ACC";   // LEAVE THAT TO MNEMONIC/PRAGMA TAGGER
		}
		else if (this.mnemonics[sym[1]]!=null) // check mnemonic preceeded by LBL
		{
			arr[0] = "LBL"; // TODO store label !!!!
			arr[1] = "MNE";
			if(sym[2]!=null) 	arr[2] = "OPR" 
				//arr[2] = sym[2]!="A" ? "VAL" : "ACC";	// LEAVE THAT TO MNEMONIC/PRAGMA TAGGER
		}
		else if(this.pragma_sym[sym[0]]!=null )
		{
			arr[0] = "PGM";
			if(sym[1]!=null) 	arr[1] = "OPR" 
		}
		else if ( this.pragma_sym[" "+sym[1]]!=null) // check space separated pragmas (example?)
		{
			//arr[0] = sym[0]=="*"?"PC":"LBL";  // LEAVE THAT TO MNEMONIC/PRAGMA TAGGER
			arr[0] = "LBL";
			arr[1] = "PGM";
			arr[2] = "OPR";
		}
		else if( this.pragma_sym[sym[1]]!=null ) // check pragma preceeded by LBL
		{
			arr[0] = "LBL";
			arr[1] = "PGM";
			if(sym[2]!=null) 	arr[2] = "OPR" 
		}
		else
			arr[0] = "---";

		return arr;
	}

	this.mnemonic_tagger = function(mne,opr)
	{
		if(opr=="A") return 1;
		if(opr.charAt(0)=="#") return 2;
		
	}

	// Slice ASM lines -> codesrc (array)
	this.getSrc = function(formfield, bComments)
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
		return codesrc;
	}

	this.mocha_test = function(_o)
	{
		// https://www.chaijs.com/api/assert/#method_deepequal
		Object.prototype.f = function (arr) { 
			var val = this,r = {},arr = arr===undefined?["val","fmt","bytes","err"]:arr;
			arr.forEach(function(v, i) { if(typeof(val[v])!="undefined") r[v] = val[v]});
			return r;
		}
		var _a = _o.chai.assert; // shortened assert expression

		describe("ASM",function()
		{
			describe("validate",function()
			{
				it('validates HEX numbers',function(){ _a.equal(oASM.validate("0123456789ABCDEF","[0-9A-Fa-f]+"),true,"HEX numbers") });
				it('matches BIN numbers',function(){ _a.equal(oASM.validate("10","[01]+"),true,"BIN numbers") });
				it('matches OCT numbers',function(){ _a.equal(oASM.validate("01234567","[0-7]+"),true,"OCT numbers") });
				it('matches DEC numbers',function(){ _a.equal(oASM.validate("0123456789","[0-9]+"),true,"DEC numbers") });
			});

			describe("getNumber",function()
			{
				it('parses HEX numbers',function()
				{
					_a.deepEqual(oASM.getNumber("$FF").f(), {"val":255,"fmt":"HEX","bytes":1},"edge case 1 byte HEX");
					_a.deepEqual(oASM.getNumber("$100").f(),{"val":256,"fmt":"HEX","bytes":2},"edge case 2 byte HEX");
					_a.deepEqual(oASM.getNumber("-$1").f(), {"val":255,"fmt":"HEX","bytes":1},"negative HEX");
					_a.equal(    oASM.getNumber("$-1").err,'number malformation','misplaced sign');
					_a.deepEqual(oASM.getNumber(">$FEFF").f(),{"val":254,"fmt":"HEX","bytes":1},"HEX high byte");
					_a.deepEqual(oASM.getNumber("<$FEFF").f(),{"val":255,"fmt":"HEX","bytes":1},"HEX low byte");
					_a.deepEqual(oASM.getNumber("$FEFFF").f(),{"val":1044479,"fmt":"HEX","bytes":3,"err":"number range error"},"HEX too large");
				});
				it('parses BIN numbers',function()
				{
					_a.deepEqual(oASM.getNumber("%11111111").f(), 	{"val":255,"fmt":"BIN","bytes":1},"edge case 1 byte BIN");
					_a.deepEqual(oASM.getNumber("%100000000").f(),	{"val":256,"fmt":"BIN","bytes":2},"edge case 2 byte BIN");
					_a.deepEqual(oASM.getNumber("-%1").f(), 		{"val":255,"fmt":"BIN","bytes":1},"negative BIN");
					_a.equal(oASM.getNumber("--%1").err,'number malformation',"double negative BIN");
					_a.deepEqual(oASM.getNumber("+%1").f(),       	{"val":1,"fmt":"BIN","bytes":1 },'plus sign ignored');
					_a.equal(    oASM.getNumber("%-1").err,'number malformation','misplaced sign');
				});
				it('parses OCT numbers',function()
				{
					_a.deepEqual(oASM.getNumber("0377").f(),  {"val":255,"fmt":"OCT","bytes":1},"edge case 1 byte OCT");
					_a.deepEqual(oASM.getNumber("0400").f(),  {"val":256,"fmt":"OCT","bytes":2},"edge case 2 byte OCT");
					_a.deepEqual(oASM.getNumber("-01").f(),   {"val":255,"fmt":"OCT","bytes":1},"negative OCT");
					_a.equal(    oASM.getNumber("0+1").err,'number malformation','misplaced sign');
				});
				it('parses DEC numbers',function()
				{
					_a.deepEqual(oASM.getNumber("255").f(), {"val":255,"fmt":"DEC","bytes":1},"edge case 1 byte DEC");
					_a.deepEqual(oASM.getNumber("256").f(),{"val":256,"fmt":"DEC","bytes":2},"edge case 2 byte DEC");
					_a.deepEqual(oASM.getNumber("-1").f(), {"val":255,"fmt":"DEC","bytes":1},"negative DEC");
					_a.deepEqual(oASM.getNumber("-128").f(), {"val":128,"fmt":"DEC","bytes":1},"negative 1 byte DEC");
					_a.deepEqual(oASM.getNumber("-129").f(), {"val":65407,"fmt":"DEC","bytes":2},"-129 negative 2 byte DEC");
					_a.deepEqual(oASM.getNumber("-256").f(), {"val":65280,"fmt":"DEC","bytes":2},"-256 negative 2 byte DEC");
					//65407
					_a.deepEqual(oASM.getNumber("-32768").f(), {"val":32768,"fmt":"DEC","bytes":2},"-32768 negative 2 byte DEC");
					_a.equal(oASM.getNumber("-32769").err, 'number range error',"negative 3 byte DEC");
					_a.deepEqual(oASM.getNumber(">256").f(),{"val":1,"fmt":"DEC","bytes":1},"DEC high byte");
					_a.deepEqual(oASM.getNumber("<256").f(),{"val":0,"fmt":"DEC","bytes":1},"DEC low byte = 0");
					_a.deepEqual(oASM.getNumber(">255").f(),{"val":0,"fmt":"DEC","bytes":1},"DEC high byte = undefined");
					_a.deepEqual(oASM.getNumber("0").f(),   {"val":0,"fmt":"DEC","bytes":1},"edge case 1 digit DEC");
					_a.deepEqual(oASM.getNumber(0).f(["val","err"]),{"val":"NaN","err":"number malformation"},"wrong input datatype");
				});
				it('parses ASCII encoding',function()
				{
					_a.deepEqual(oASM.getNumber('"A"').f(), 	{val:65,fmt:'ASC',bytes:1},"single char");
					_a.deepEqual(oASM.getNumber('"AB"').f(),	{val:16706,fmt:'ASC',bytes:2},"double char");
					_a.deepEqual(oASM.getNumber("\"\"'\"").f(),	{val:8743,fmt:'ASC',bytes:2},"double + single quote");
					_a.deepEqual(oASM.getNumber("\"'\"\"").f(),	{val:10018,fmt:'ASC',bytes:2},"single quote + double quote");
					_a.deepEqual(oASM.getNumber("\"'\"").f(),	{val:39,fmt:'ASC',bytes:1},"single quote");
					_a.deepEqual(oASM.getNumber("'\"''").f(),	{val:8743,fmt:'ASC',bytes:2},"double + single quote");
					_a.deepEqual(oASM.getNumber("''\"'").f(),	{val:10018,fmt:'ASC',bytes:2},"single quote + double quote");
					_a.deepEqual(oASM.getNumber("'\"'").f(),	{val:34,fmt:'ASC',bytes:1},"double quote");
					_a.deepEqual(oASM.getNumber("''").f(["val","err"]),{val:"NaN","err":"number malformation"},"empty");
					_a.deepEqual(oASM.getNumber("\"\"").f(["val","err"]),{val:"NaN","err":"number malformation"},"empty");
					_a.deepEqual(oASM.getNumber("").f(["val","err"]),{val:"NaN","err":"number malformation"},"empty");
					_a.deepEqual(oASM.getNumber().f(["val","err"]),{val:"NaN","err":"number malformation"},"empty");
					_a.deepEqual(oASM.getNumber("\"ABC\"").f(),	{val:4276803,"fmt":"ASC","bytes":3,"err":"number range error"},"ASCII too large");				
					_a.deepEqual(oASM.getNumber("\"A").f(["val"]),{val:"NaN"},"unclosed double quote" );
				});
				
				it('parses VARIABLES',function()
				{
					oASM.symtab={"VARIAB":10};
					_a.deepEqual(oASM.getNumber("VARIAB").f(),{val:10,fmt:'ID',bytes:1},"variable");
					_a.deepEqual(oASM.getNumber("VARIAA").f(["val","err"]),{val:"NaN",err:"compile error:\nidentifier does not exist"},"variable");
				});					

			})
			

		})
	}

	// Parse prefixed strings & return base10 equivalent
	this.getNumber = function(str)   
	{
		var r = "NaN", err = "number malformation", c = str==null || typeof(str)!="string"?["",""]:[str.charAt(0),str.substring(1)];
		Array.prototype.mr = function (m) {  return this[0].match(new RegExp(m))!=null || (this[0]=="0" && this[1]=="")? [m,this[1]] : this }
		c = c.mr("[1-9]");
		switch(c[0])
		{
			case ">":		// HI-BYTE
				r = this.getNumber(str.substring(1));
				r.val = (r.val >> 8) & 0xff; r.bytes = 1; 
				break;
			case "<":		// LO-BYTE
				r = this.getNumber(str.substring(1));
				r.val = r.val & 0xff; r.bytes = 1;
				break;			
			case "-":		// NEGATIVE
				if(str.split("-").length>2) { r.err = "number malformation"; break}
				r = this.getNumber(str.substring(1));
				r.bytes += r.val>(1<<r.bytes*8-1) && r.val<(1<<r.bytes*8) ? 1:0;
				r.val = (~r.val&(1<<(r.bytes*8))-1)+1;   // 2's complement !!
				break;
			case "+":		// POSITIVE
				r = this.getNumber(str.substring(1));
				break;					
			case "$":		// HEX
				if(this.validate(c[1],"[0-9A-Fa-f]+"))
					r =  {"val":parseInt(c[1],16),"fmt":"HEX","bytes":c[1].length+1>>1};
				break;
			case "%":		// BIN
				if(this.validate(c[1],"[01]+"))
					r =  {"val":parseInt(c[1],2),"fmt":"BIN","bytes":c[1].length+7>>3};
				break;
			case "0":		// OCT
				if(this.validate(c[1],"[0-7]+"))
				{
					var b = (Math.log10(Math.abs(parseInt(c[1],8)))/log2>>3)+1;
					r =  {"val":parseInt(c[1],8),"fmt":"OCT","bytes":b};
					break;
				} // decimal processing if octal processing fails
			case "[1-9]":	// DEC
				if (c[1]=="") r =  {"val":parseInt(c[0],16),"fmt":"DEC","bytes":1};
				if(this.validate(str,"[0-9]+"))
				{
					var b = (Math.log10(Math.abs(parseInt(str,10)))/log2>>3)+1;
					r =  {"val":parseInt(str,10),"fmt":"DEC","bytes":b};
				}
				break;
			case "\"":		// ASCII
				var p = c[1].lastIndexOf("\"");
			case "'":
				var p = p>=0?p:c[1].lastIndexOf("'");
				if(p<0) err = "open quote"
				var s = c[1].substring(0,p);
				if(s.length>0)
					for(var i=s.length-1,v=0;i>=0;i--)
						v += s.charCodeAt(s.length-1-i) << (8*i);
				r =  {"val":v,"fmt":"ASC","bytes":s.length};
				break;
			default:
				if(this.validate(str,"[A-Za-z0-9_.-]+")) // IDENTIFIER
				{
					r = this.getIdentifier(str);
					err = r.err;
				}
				// TODO DEBUG !!!
				if(str=="")
					r = {"val":0,"fmt":"DEC","bytes":1};
		}
		if(r.bytes>2) r.err = "number range error";
		var m = typeof(str)=="string"?str.match(/(["']).*(["'])/):null;
		if(m!=null && m.length!=3) err = "open quote"

		r = isNaN(r.val) ? {val:"NaN","str":str,"err":err} : r;
		r.hex = this.getHexWord(r.val);

		if(this.bDebug) console.log("getNumber("+str+") = "+JSON.stringify(r));
		return r;
	}

	this.validate = function(v,rule)
	{
		var m = typeof(v)=="string"?v.match(rule):null;
		if(m!=null && v.match(rule)[0].length==v.length) return true
		return false;
	}

	this.getOffset = function(n)   // TODO replace by getExpression ?
	{
		var a = n.lastIndexOf("+");
		var b = n.lastIndexOf("-");
		var c = a >= 0 && b < 0 ? a : b; // position of sign 
		var d = n.length - c - 1;		 // length of expression before the sign
		if (c < 0 && d > 6 || c < 0) return 0;	 
		nn = n.slice(-d - 1);
		var nn = this.getNumber(nn);
		return nn.val == "NaN" ? 0 : nn.val;
	}	

	this.getExpression = function(str)
	{
		if(typeof(str)==="number") str += "";

		var exp = str.split(new RegExp("[+\\-\\*^~\\&\\|]","g"));  // slice at math operators to dig out deeper numbers and symbols
		var r = "NaN", err = "expression malformation";
		var c = str==null || typeof(str)!="string"?["",""]:[str.charAt(0),str.substring(1)];
		switch(c[0])
		{
			case ">":		// HI-BYTE
				r = this.getExpression(str.substring(1));
				r.val = (r.val >> 8) & 0xff; r.bytes = 1; 
				return r;
			case "<":		// LO-BYTE
				r = this.getExpression(str.substring(1));
				r.val = r.val & 0xff; r.bytes = 1;
				return r;
			case "-":
				r = this.getExpression(str.substring(1));
				r.bytes += r.val>(1<<r.bytes*8-1) && r.val<(1<<r.bytes*8) ? 1:0;
				r.val = (~r.val&(1<<(r.bytes*8))-1)+1;   // 2's complement !!
				return r;
			case "'":
				r = oCOM.rtrim(str).substring(1,str.length-1);
				if((r.replace(/\\'/g,"").split("'").length-1)%2!=0) return {"val":false,"err":"inproperly closed quotes in expression"};
			case "\"":
				if(isNaN(r)) r = oCOM.rtrim(str).substring(1,str.length-1);
				if((r.replace(/\\"/g,"").split("\"").length-1)%2!=0) return {"val":false,"err":"inproperly closed quotes in expression"};
				//var e = this.getNumber(r);
				return {"val":r,"bytes":r.length,"type":"string"};
			default:
				//if(str=="'%'")
				//	console.log("DEBUG THIS");
				var nexp = "",l=0,err = "";
				for(var i=0;i<exp.length;i++)
				{
					l+=exp[i].length+1;
					var oper = str.charAt(l-1);
					var e = this.getNumber(exp[i]);
					exp[i] = e.val;
					err += e.err==undefined?"":(e.err+"|")
					nexp += exp[i]+oper;
				}
				if(err.length>0) return {"val":"NaN","err":err}

				var parser = new oCOM.MathParser();
				if(this.bDebug) console.log(str+" >> oCOM.MathParser().parse('"+nexp+"') = "+parser.parse(nexp))
				var e = this.getNumber(parser.parse(nexp)+"")

				r = {"val":e.val,"err":(!r.err && !e.err)?"":(r.err+"|"+e.err),"bytes":e.bytes};
				return r;
		}	
	}

	this.getID = function(n) // get rid of this function
	{
		if(typeof(n)!="string") return {val:"NaN",err:"number malformation"}
		if(this.validate(n,"[A-Za-z0-9_.]+")==false) return {"val":"NaN","fmt":"ID","err":"syntax error:\ninvalid identifier"}
		n = n.split("+")[0].split("-")[0];  // FVD separate + and - postfixes from labels ???
		n = n.substring(0, this.label_len);	// truncate identifier length
		return {"val":n};
	}

	this.getIdentifier = function(n)
	{
		if(typeof(n)!="string") return {val:"NaN",err:"number malformation"}
		if(this.validate(n,"[A-Za-z0-9_.]+")==false) return {"val":"NaN","fmt":"ID","err":"syntax error:\nmalformed identifier"}

		n = n.split("+")[0].split("-")[0];  // FVD separate + and - postfixes from labels ???
		n = n.substring(0, this.label_len);	// truncate identifier length
		if(oASM.symtab[n] === undefined) 
			return {"val":"NaN","fmt":"ID","err":"identifier '"+n+"' does not exist"}

		var b = (Math.log10(Math.abs( oASM.symtab[n] ))/log2>>3)+1;
		return {"val":oASM.symtab[n],"fmt":"ID","bytes":b};
	}

	this.getSym = function()
	{
		var c = this.getChar();
		if (c == 'EOF') return null;
		var sym = [''];
		var s = 0;		// string index
		var m = false;  // multi character
		var q = false;	// quote
		while ((c != ';') && (c != '\n') && (c != 'EOF'))
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
			c = this.getChar();
		}
		while ((sym.length) && (sym[sym.length - 1] == '')) sym.length--;
		return (c == 'EOF') ? null : sym;
	}


	this.getChar = function()
	{
		if (this.srcl >= this.codesrc.length) return 'EOF';
		if (this.srcc >= this.codesrc[this.srcl].length)
		{
			this.srcc = 0;
			this.srcl++;
			return '\n';
		}
		else
		{
			var c = this.peekChar();
			this.srcc++;
			return c
		}
	}
	

	this.peekChar = function()
	{
		return this.codesrc[this.srcl].charAt(this.srcc);
	}

	// A pragma is a directive that provides instructions
	// to the assembler on how to process code.

	this.parse_pragma = function(sym,pass,xarg)
	{
		function getByteArray(arg)
		{
			str = arg.replace(/[^A-Fa-f0-9]/g, "");
			if (str.length % 2 != 0) { displayError('format error:\nwrong or odd digits'); return false }
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

		var ofs = xarg===undefined || xarg.ofs===undefined ? 0 : xarg.ofs  
		switch(sym[ofs])
		{
			case "ORG":
			case "*=":
				var arr = sym.slice(ofs + 1, sym.length).join("").split(",");
				var dat = [];
				var e = this.getExpression(arr[0]);
				if(e.bytes!=2) e.err += "expression is not 2 bytes long "+(e.bytes==undefined?"":("("+e.bytes+")"))
				if (e.err) { displayError(e.err); return {"val":false}  }
				dat[0]     = (e.val & 0xFF)+"";	    // extract  lo byte
				dat[1] = (e.val >> 8 & 0xFF)+"";	// truncate hi byte

				oASM.code_pc[oASM.get_code_len()] = e.val & 0xFFFF;		//  register ORG as program counter change at byte index (for byte stream listing) 

				pc = e.val & 0xFFFF;
				listing.value += "$"+this.getHexWord(pc);
				return {"val":true}

			case "EQU":
			case "=":

// TODO OVERWRITE LABEL !!!

				var arr = sym.slice(ofs + 1, sym.length).join("").split(",");
	
				var dat = [];
				var e = this.getExpression(arr[0]);
				if(e.bytes>2) e.err += "expression exceeds 2 bytes "+(e.bytes==undefined?"":("("+e.bytes+")"))
				if (e.err) { displayError(e.err); return {"val":false}  }
				//dat[0]     = (e.val & 0xFF)+"";	    // extract  lo byte
				//dat[1] = (e.val >> 8 & 0xFF)+"";	// truncate hi byte

				if(pass==1)
				{
					var lbl = oASM.getID(sym[0]).val;
					oASM.symtab[lbl] = e.val;
					oASM.sym_link(
					{
						 "type": "def"
						,"PC": pc
						,"val": e.val
						,"sym": lbl
						,"sym0": sym[0]
					})
				}

				//oASM.concat_code(dat);
				listing.value += "$"+(e.bytes==1? this.getHexByte(e.val) : this.getHexWord(e.val) );
				return {"val":true}

			case "HEX":
				var arg = sym.slice(ofs + 1, sym.length).join(" ");
				var dat = getByteArray(arg);
				if (pass == 1) listing.value += arg.replace(/[^A-Fa-f0-9]/g, "");
				if (pass == 2)
				{
					oASM.concat_code(dat);
					listing.value += arg.replace(/[^A-Fa-f0-9]/g, "");
				}
				pc += dat.length;
				return {"val":true};

			case "BIN":
				var arg = sym.slice(ofs + 1, sym.length).join(" ");
				var dat = getBitArray(arg);
				if (pass == 1) listing.value += arg;
				if (pass == 2)
				{
					oASM.concat_code(dat);
					listing.value += arg;
				}
				pc += dat.length;
				return {"val":true};

			case "ASC":
				var str = sym.join(" ").split(/"|“|”/g)[1];
				eval("var arg=\"" + str + "\"");
				if (pass == 1) listing.value += "\"" + arg + "\"";
				var dat = [];
				for (var i = 0; i < arg.length; i++)
					dat[i] = getAscii(arg.charAt(i));
				if (pass == 2)
				{
					oASM.concat_code(dat);
					//listing.value += "\"" + arg + "\"";
					for (var i = 0; i < arg.length; i++)
						listing.value += this.getHexByte(dat[i]);
				}
				pc += dat.length;
				return {"val":true};			

			case ".ASCIIZ":
				// Define a string with a trailing zero.
				// https://cc65.github.io/doc/ca65.html#ss11.5
				return {"val":false};
			case ".END":
				//listing.value += sym[0];
				return {"val":true};

			case ".WORD":
				// process all other symbols !
				// expect ANY aritmetic expression 
				// from which the outcome is 2 bytes long
				// e.g. $FFFF
				// e.g. %01010
				// e.g. >ADR - generates only one byte !
				// e.g. *12
				// e.g. >$FFFF - generates only one byte !

				var arr = sym.slice(ofs + 1, sym.length).join("").split(",");
				if(pass==1) listing.value += arr.join(",");
				if(pass==2)
				{
					var dat = [];
					for(var i=0;i<arr.length;i++)
					{
						var e = this.getExpression(arr[i]);
						if(e.bytes!=2) e.err += "expression is not 2 bytes long "+(e.bytes==undefined?"":("("+e.bytes+")"))
						if (e.err) { displayError(e.err); return {"val":false}  }
						dat[i<<1]     = (e.val & 0xFF)+"";	    // extract  lo byte
						dat[(i<<1)+1] = (e.val >> 8 & 0xFF)+"";	// truncate hi byte
						arr[i] = this.getHexWord(e.val & 0xFFFF);
					}
					oASM.concat_code(dat);
					listing.value += arr.join(",");
				}
				pc += arr.length*2;

				return {"val":true}

			case ".BYTE":
				// Merlin: .BYTE=comma separated byte Array
				// numerical expressions trucated to byte size, strings split as array with byte size elements 
				//var arr = sym.slice(ofs + 1, sym.length).join("").split(",");
				var arr = oCOM.CSVParser.parse(  sym.slice(ofs + 1, sym.length).join("") );

				if(pass==1) listing.value += arr.join(",");
				if(pass==2)
				{
					var dat = [];
					for(var i=0;i<arr.length;i++)  // loop through CSV elements
					{
						var e = this.getExpression(arr[i]);
						if (e.err) { displayError(e.err); return {"val":false} }
						if(e.type=="string") 
						{
							var utf8Encode = new TextEncoder();
							var byte_arr = utf8Encode.encode(e.val);
						}
						else var byte_arr = this.getNumByteArr(e.val).slice(0,e.bytes);

						var k = dat.length;
						for(var j=0;j<byte_arr.length;j++)  // loop through element, with potentially larger byte size
							dat[k+j] = byte_arr[j];
					}

					for(var i=0;i<dat.length;i++)				// overwrite arr
						arr[i] = this.getHexByte(dat[i]);

					oASM.concat_code(dat);
					listing.value += arr.join(" ");
				}
				pc += arr.length;

				return {"val":true}

			case ".DS":
				// Merlin: .DS=Define Storage, reserves an uninitialised amount of bytes
				// e.g. Buffer .DS 256   ; Reserves 256 bytes of storage for 'Buffer'
				var arr = sym.slice(1).join("").split(",");

				var i = arr.length-1;
				var n = arr[i];
				var e = this.getExpression(n);

				if(pass==1)
				{
					if(isNaN(e.val))
					{
						displayError('label must be defined at this stage');  // since in pass1 we need to count the precise data length 
						return {"val":false}
					}
					arr[i] = e.val+"";
				}
				if(pass==2)
				{
					for(var i=0;i<arr.length;i++)
					{
						var e = this.getExpression(arr[i]);
						arr[i] = e.val+"";
						//if (e.err) { return displayError(e.err) }
						//	oper = e.val;
					}
					//alert(pass+".DS "+arr.join(","));
				}

				pc += arr.length;
				listing.value += arr.join(",");

				//oASM.getExpression(addr);
				return {"val":true}

			case ".AT":
				// https://www.sbprojects.net/sbasm/directives.php?directive=at
				
				var bNeg = false;
				if(sym[1].charAt(0)=="-") { sym[1] = sym[1].substring(1); bNeg = true }
				if(sym[1].charAt(0)=="/")
					var str = sym.join(" ").split("/")[1];
				else
					var str = sym.join(" ").split(/"|“|”/g)[1];

				eval("var arg=\"" + str + "\"");
				if (pass == 1) listing.value += "\"" + arg + "\"";
				for (var i = 0, dat = []; i < arg.length; i++)
					dat[i] = (i!=arg.length-1) != !bNeg ? getAscii(arg.charAt(i)) : getAscii(arg.charAt(i))-128;

				if (pass == 2)
				{
					oASM.concat_code(dat);
					for (var i = 0; i < arg.length; i++)
						listing.value += this.getHexByte(dat[i]);
				}
				pc += dat.length;
				return {"val":true};

			case ".DEFINE":
				if (sym.length >= 2 && pass==1)	// more than two operands
				{
					if (typeof (this.pragma_sym[".DEFINE"]) == "undefined")
						this.pragma_sym[".DEFINE"] = {};
					this.pragma_sym[".DEFINE"][sym[1]] = sym.slice(2, sym.length).join(" ");
					return {"val":true};
				}				
				break;
			case ".IFDEF":
				break;
			case ".IFNDEF":
				break;
			case ".ENDIF":
				break;
			case ".SYMBOLS":
				break;
			default:
				displayError('syntax error:\ninvalid pragma "' + sym[0] + '"');
				return;
		}
		return null;
	}

	this.sym_link = function(_obj)
	{
		// TODO: CHECK IF IT IS REALLY NECESSARY TO DISTINGUISH LOCATIONS FROM DEFINITIONS
		// 

		var key = ""
		switch (_obj.type)
		{
			case "loc":
				if (typeof (this.symlink[_obj.PC]) != "undefined") 
					console.warn("double entry! Label pointing to same address "+ JSON.stringify(_obj) + " ~ "+this.symlink[_obj.PC])
					key = _obj.PC;
					this.symlink[key] = {
					"type": _obj.type,
					"sym": _obj.sym
				};
				break;
			case "def":
				key = _obj.val

				for(o in oASM.symlink)							   // search through all symlinks
					if(oASM.symlink[o].sym == _obj.sym) 
						delete oASM.symlink[o];  				   // if duplicate found, delete the previous entry
																   // because: parser first believes it is a label, then realises it is a variable definition 

				if (_obj.val < 256)
					this.symlink[key] = {
						"type": "vdef",
						"sym": _obj.sym
					};
				else
					this.symlink[key] = {
						"type": "ldef",
						"sym": _obj.sym
					};
				break;
			default:
				key = "i" + this.symlink_l
				this.symlink[key] = _obj;
				globalThis.symlink_l++;
		}
		if(_obj.call) this.symlink[key].call = _obj.call;
	}


	this.read_code = function(idx)
	{
		return this.codedst[idx];
	}

	this.write_code = function(byte)
	{
		this.codedst[this.codedst_len] = byte;
		this.codedst_len++;
		if(this.bDebug) console.log("write_code("+this.getHexByte(byte)+")")
		if(byte==2)
			console.log("DEBUG")
	}

	this.concat_code = function(byte_array)
	{
		for(var i=0;i<byte_array.length;i++)
		{
			this.codedst[ this.codedst_len++ ] = byte_array[i];
		}

		if(this.bDebug)
		{
			for(var i=0,s="";i<byte_array.length;i++) s+= this.getHexByte(byte_array[i])
			console.log("write_code("+this.getHexByte(byte)+")")
		}
	}

	this.get_code_len = function()
	{
		return this.codedst_len;
	}

	this.clear_code = function()
	{
		this.codedst_len = 0;
		this.codedst = new Uint8Array(65536);	// 64K buffer
	}

	this.concat_json = function(json1,json2)
	{
		var json3 = json1;
		for(var i in json2) json3[i] = json2[i];
		return json3;
	}

    this.updateScroll = function(el)
	{
		el.scrollTop = el.scrollHeight;
	}

	this.hextab = oCOM.hextab;
	this.getHexByte = oCOM.getHexByte;
	this.getHexWord = oCOM.getHexWord;
	//this.getHexMulti = oCOM.getHexMulti;
	this.getNumByteArr = oCOM.getNumByteArr;
}

function DASM()
{
	
    //  ██████  ██ ███████  █████  ███████ ███████ ███████ ███    ███ ██████  ██      ███████ ██████  
    //  ██   ██ ██ ██      ██   ██ ██      ██      ██      ████  ████ ██   ██ ██      ██      ██   ██ 
    //  ██   ██ ██ ███████ ███████ ███████ ███████ █████   ██ ████ ██ ██████  ██      █████   ██████  
    //  ██   ██ ██      ██ ██   ██      ██      ██ ██      ██  ██  ██ ██   ██ ██      ██      ██   ██ 
    //  ██████  ██ ███████ ██   ██ ███████ ███████ ███████ ██      ██ ██████  ███████ ███████ ██   ██ 

    this.disassemble_GUI = function()
    {
		var ret = this.disassemble({"code_arr":[this.ByteAt(pc),this.ByteAt(pc+1),this.ByteAt(pc+2)],"pc":pc,"opctab":opctab})

        var disp = '<div style="width:100px;float:left">'+ret.adr_lst+'&nbsp;'+ret.opcode_lst+'</div>'+ret.mnemonic+"<br>"; // works with all fonts (proportional)
        //var disp = oCOM.padding([ret.adr_lst,ret.opcode_lst,ret.mnemonic],[5,10])+"<br>";  								// only works with monospaced fonts!   

        this.writeShow('regdisp',ret.adr_lst,ret.opcode_lst,ret.mnemonic);
        this.writeDisplay('dispStep',disp,"beforeend");
		this.updateScroll(document.getElementById('dispStep'));

		dispmem += disp
        var dispmem_arr = dispmem.split("<br>");
        if(dispmem_arr.length>5)
        {
			dispmem = dispmem_arr[1]+ "<br>"
					+ dispmem_arr[2]+ "<br>"
							+ dispmem_arr[3]+ "<br>"
							+ dispmem_arr[4]+ "<br>"
							+ dispmem_arr[5]
        }
    }

	this.disassemble = function(arg)
    {
		var ops=this.getHexByte(arg.code_arr[0]);							// instruction
		var op1=this.getHexByte(arg.code_arr[1]); if (op1==null) op1=0;	// operand 1
		var op2=this.getHexByte(arg.code_arr[2]); if (op2==null) op2=0;	// operand 2

		const mne   = arg.opctab[ arg.code_arr[0] ][0];						// mnemonic
		const adm   = arg.opctab[ arg.code_arr[0] ][1];						// addressing mode
		var expr = mne;

		switch (adm)
		{
			case 'imm' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;#$'+this.sym_search(op1,adm);
				break;
			case 'zpg' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;'+this.sym_search("$"+op1,adm);
				break;
			case 'acc' :
				ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;A';
				break;
			case 'abs' :
				ops+='&nbsp;'+op1+'&nbsp;'+op2;
				expr+='&nbsp;'+this.sym_search("$"+op2+op1,adm);
				break;
			case 'zpx' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;'+this.sym_search("$"+op1,adm)+',X';
				break;
			case 'zpy' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;'+this.sym_search("$"+op1,adm)+',Y';
				break;
			case 'abx' :
				ops+='&nbsp;'+op1+'&nbsp;'+op2;
				expr+='&nbsp;'+this.sym_search("$"+op2+op1,adm)+',X';
				break;
			case 'aby' :
				ops+='&nbsp;'+op1+'&nbsp;'+op2;
				expr+='&nbsp;'+this.sym_search("$"+op2+op1,adm)+',Y';
				break;
			case 'iny' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;('+this.sym_search("$"+op1,adm)+'),Y';
				break;
			case 'inx' :
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;('+this.sym_search("$"+op1,adm)+',X)';
				break;
			case 'rel' :
				var opv=arg.code_arr[1];
				var targ=pc+2;
				if (opv&128) targ-=(opv^255)+1; else targ +=opv;
				targ&=0xffff;
				ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
				expr+='&nbsp;'+this.sym_search("$"+getHexWord(targ),adm);
				break;
			case 'ind' :
				ops+='&nbsp;'+op1+'&nbsp;'+op2;
				expr+='&nbsp;('+this.sym_search("$"+op2+op1,adm)+')';
				break;
			default :
				ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
		}
		var ret = {"adr_lst":getHexWord(arg.pc),"opcode_lst":ops,"mnemonic":expr}
		return ret;
    }


    this.getReg = function(r) {
        switch (r) {
            case 'PC' : return pc;
            case 'AC' : return a;
            case 'XR' : return x;
            case 'YR' : return y;
            case 'SR' : return flags;
            case 'SP' : return sp;
            default : return '';
        }
    }

    this.StatusRegister = function(cfg)
	{
	  	var c = cfg.rw;
		if(c.join("")=="") return "";
		var bv = this.getReg("SR").toString(2);
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
		var a = ["N","V",".","B","D","I","Z","C"];
		var b = ["neg","over","&nbsp;","break","deci","interr","zero","carry"];
		var s = "<div class=regscroll_h id=rd><div class=regpar>";
		for(var i=0;i<8;i++)
			s += ("<div class=regbox>"
			+"<div class=regadr>"+b[i]+"</div>"
			+"<div class=regbyte"+(c[i].replace("R","_green").replace("W","_red").replace("B","_yellow"))+">"+bv2.charAt(i)+"</div>"
			+"</div>"
			);
		s+= "</div></div>";
		return s;
	}

	this.writeShow = function(dd,a,o,d)
	{
		var s = "";
		var adm = ['imm','zpg','acc','abs','zpx','zpy','abx','aby','iny','inx','rel','ind'];
	  var b   = ["neg","over","&nbsp;","break","deci","interr","zero","carry"];
		var instr = d.substring(0,3);
		var oper  = d.substring(4,d.length);
		var ops = o.split("&nbsp;");
	  var nreg = Object.assign({},
			{"PC":getHexWord(this.getReg("PC")),"AC":this.getHexByte(this.getReg("AC")),"XR":this.getHexByte(this.getReg("XR")),"YR":this.getHexByte(this.getReg("YR")),"SR":this.getHexByte(this.getReg("SR")),"SP":this.getHexByte(this.getReg("SP"))},
			this.nameBit(this.getReg("SR"),["neg","over","&nbsp;","break","deci","interr","zero","carry"]),
			{"ops":ops});

	// https://www.key-shortcut.com/en/writing-systems/35-symbols/arrows

		switch(instr)
		{
			case "ADC":
				s  = "Add with carry"
				var opc ={"69":"imm","65":"zpg","75":"zpx","6D":"abs","7D":"abx","79":"aby","61":"inx","71":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "A = A<sub>"+nreg.AC+"h</sub> + "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" + C<sub>"+(this.getReg("SR")&1)+"</sub><br>";
				s += this.StatusRegister({"rw":["W","W","","","","","W","R"]});
			break;
			case "AND":
				s  = "And"
				var opc ={"29":"imm","25":"zpg","35":"zpx","2D":"abs","3D":"abx","39":"aby","21":"inx","31":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> & "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
				s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				// TODO READ CARRY IF INDEXED !!!
			break;
			case "ASL":
				s  = "Arithmetic Shift Left"
				var opc ={"0A":"acc","06":"zpg","16":"zpx","0E":"abs","1E":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>"
				//s += "A = << "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				this.AddressingModeTmpl(opc[ops[0]],nreg);
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>"
				var postfix = "<div>&#x2B05;</div>"+this.BitUnit( {"value":0,"class":"regbyte_green"} )+"<div><small>&nbsp;"+this.getHexByte(nreg["mem"])+"h</small></div>"
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":nreg["mem"].toString(2),"rw":["","","","","","","",""]});
				var c = opc[ops[0]]=="abx" || opc[ops[0]]=="aby" ? "B":"W";
				s += this.StatusRegister({"rw":["W","W","","","","","",c]});
				// TODO SAME FOR ROL !!!
			break;
			case "BCC":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Carry Clear<br>";
				s += "<div>carry-bit "+bv2.charAt(2)+" = 0 ? "
					+(bv2.charAt(2)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","R","","","","",""]});
			break;
			case "BCS":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Carry Set<br>";
				s += "<div>carry-bit "+bv2.charAt(2)+" = 1 ? "
					+(bv2.charAt(2)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","R","","","","",""]});
			break;
			case "BEQ":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Result Zero<br>";
				s += "<div>zero-bit "+bv2.charAt(6)+" = 1 ? "
					+(bv2.charAt(6)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","","","","","R",""]});
			break;
			case "BIT":
				s += "Test Bits in Memory with Acc<br>";
				var opc ={"24":"zpg","2C":"abs"};
				var postfix = "&nbsp;<div>z=A<sub>"+nreg.AC+"h </sub>&<sub> "+this.getHexByte(this.ByteAt(parseInt(ops[1],16)))+"h</sub></div>";
				s += this.BitGrid({"value":this.ByteAt(parseInt(ops[1],16)).toString(2),"postfix":postfix,"height":18,"rnames":[""],"rw":["R","R","","","","","",""]});
				s += this.StatusRegister({"rw":["W","W","","","","","W",""]});
			break;
			case "BMI":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Result Minus<br>";
				s += "<div>negative-bit "+bv2.charAt(0)+" = 1 ? "
					+(bv2.charAt(0)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["R","","","","","","",""]});
			break;
			case "BNE":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s = "Branch if Not Equal<br>";
				s +="<div>zero-bit "+bv2.charAt(6)+" ≠ 1 ? "
					+(bv2.charAt(6)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","","","","","R",""]});
			break;
			case "BPL":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Result Minus<br>";
				s +="<div>negative-bit "+bv2.charAt(0)+" ≠ 1 ? "
					+(bv2.charAt(0)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["R","","","","","","",""]});
			break;
			case "BRK":
				s  = "Force Break<br>";
				// TODO
				// interrupt,push PC+2, push SR
			break;
			case "BVC":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Overflow Clear<br>";
				s += "<div>overflow-bit "+bv2.charAt(7)+" = 0 ? "
					+(bv2.charAt(7)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","","","","","","R"]});
			break;
			case "BVS":
				var bv = this.getReg("SR").toString(2);
				var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
				s  = "Branch on Overflow Set<br>";
				s +="<div>overflow-bit "+bv2.charAt(7)+" = 1 ? "
					+(bv2.charAt(7)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>";
				s += this.StatusRegister({"rw":["","","","","","","","R"]});
			break;
			case "CLC":
				s = "Clear carry flag<br>";
				s+= "C = 0";
				s+= this.StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "CLD":
				s = "Clear decimal flag<br>";
				s+= "D = 0";
				s+= this.StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "CLI":
				s = "Clear interrupt disable bit<br>";
				s+= "I = 0";
				s+= this.StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "CLV":
				s = "Clear overflow flag<br>";
				s+= "V = 0";
				s+= this.StatusRegister({"rw":["","W","","","","","",""]});
			break;
			case "CMP":
				s  = "Compare";
				var opc ={"C9":"imm","C5":"zpg","D5":"zpx","CD":"abs","DD":"abx","D9":"aby","C1":"inx","D1":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "A<sub>"+nreg.AC+"h</sub> = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" ?<br>\r\n";
				s += this.StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "CPX":
			// TODO
			break;
			case "CMY":
			// TODO
			break;
			case "DEC":
				s  = "Decrement";
				var opc ={"C6":"zpg","D6":"zpx","CE":"abs","DE":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"-1<br>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEX":
				s  = "Decrement X Register<br>";
				s += "<div>X = "+nreg.YR+"h-1</div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEY":
				s  = "Decrement Y Register<br>";
				s += "<div>Y = "+nreg.YR+"h-1</div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "EOR":
				s  = "Exclusive-OR";
				var opc ={"49":"imm","45":"zpg","55":"zpx","4D":"abs","5D":"abx","59":"aby","41":"inx","51":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> ⊕ "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
				s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "INC":
				s  = "Increment"
				var opc ={"E6":"zpg","F6":"zpx","EE":"abs","FE":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"+1<br>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INX":
				s  = "Increment X Register<br>";
				s += "<div>X = "+nreg.XR+"h+1</div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INY":
				s  = "Increment Y Register<br>";
				s += "<div>Y = "+nreg.YR+"h+1</div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "JMP":
				if(typeof(opc)=="undefined") s = "Jump";
				var opc ={"4C":"abs","6C":"ind"};
				s += " - ["+opc[ops[0]]+"]<br>"
				s += "PC = "+this.AddressingModeTmpl(opc[ops[0]],nreg)//.split("<sub>#")[0]
			break;
			case "JSR":
				if(typeof(opc)=="undefined") s = "Jump Subroutine";
				var opc ={"20":"abs"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "PC = "+this.AddressingModeTmpl(opc[ops[0]],nreg).split("<sub>#")[0]
				   +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-2<br>";
			break;
			case "LDY":
				if(typeof(opc)=="undefined") var opc = {"title":"Load Y Register","reg":"YR","A0":"imm","A4":"zpg","B4":"zpx","AC":"abs","BC":"abx"};
			case "LDX":
				if(typeof(opc)=="undefined") var opc = {"title":"Load X Register","reg":"XR","A2":"imm","A6":"zpg","B6":"zpy","AE":"abs","BE":"aby"};
			case "LDA":
				if(typeof(opc)=="undefined") var opc = {"title":"Load Accumulator","reg":"AC","A9":"imm","A5":"zpg","B5":"zpx","AD":"abs","BD":"abx","B9":"aby","A1":"inx","B1":"iny"};
				s += opc.title+" - ["+opc[ops[0]]+"]<br>";
				s += instr.slice(-1)+"<sub>"+this.getHexByte(this.getReg(opc.reg))+"h</sub> = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>";
				var c = opc[ops[0]]=="abx" || opc[ops[0]]=="aby" ? "R":""	// READS CARRY TO ADD TO X OR Y INDEX !!
				s += this.StatusRegister({"rw":["W","","","","","","W",c]});
			break;
			case "LSR":
				s  = "Logical Shift Right";
				var opc ={"4A":"acc","46":"zpg","56":"zpx","4E":"abs","5E":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>";
				//s += "A = >> "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				s += instr.slice(-1)+"<sub>"+this.getHexByte(this.getReg(opc.reg))+"h</sub> = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>";
				var prefix = this.BitUnit( {"value":0,"class":"regbyte_green"} )+"<div>&#x2B95;</div>";
				var postfix = "<div>&#x2B95;</div>"+this.BitUnit( {"value":this.getReg("AC")&1,"reg":"carry"} );
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				//s += this.StatusRegister({"rw":["W","","","","","","W","W"]});  // runs out of screen
			break;
			case "NOP":
				s  = "No operation";
			break;
			case "ORA":
				s  = "Exclusive-OR";
				var opc ={"09":"imm","05":"zpg","15":"zpx","0D":"abs","1D":"abx","19":"aby","01":"inx","11":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "A = A<sub>"+nreg.AC+"h</sub> | "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n";
				s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "PHA":
				s  = "Push Accumulator on Stack<br>";
				s += "[$1"+nreg.SP+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = A<sub>"+nreg.AC+"h</sub>";
				+"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>";
			break;
			case "PHP":
				s  = "Push Processor Status on Stack<br>";
				s += "[$1"+nreg.SP+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = PS<sub>"+nreg.SR+"h</sub>";
				+"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>";
			break;
			case "PLA":
				s  = "Pull Accumulator from Stack<br>";
				s += "SP = SP<sub>"+nreg.SP+"h</sub>+1";
				s += "&nbsp;A<sub>"+nreg.AC+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>";
			break;
			case "PLP":
				s  = "Pull Processor Status from Stack<br>";
				s += "SP = SP<sub>"+nreg.SP+"h</sub>+1";
				s += "&nbsp;PS<sub>"+nreg.SR+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>";
				s += this.StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "ROL":
				s  = "Rotate Left";
				var opc ={"2A":"acc","26":"zpg","36":"zpx","2E":"abs","3E":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>";
				//s += "A = << "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>";
				var postfix = "<div>&#x2B05;</div>"+this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} );
				s += this.BitGrid({"pretfix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","W","W","","","","",""]});
			break;
			case "ROR":
				s  = "Rotate Right";
				var opc ={"6A":"acc","66":"zpg","76":"zpx","6E":"abs","7E":"abx"};
				s += " - ["+opc[ops[0]]+"]<br>";
				//s += "A = >> "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B95;</div>";
				var postfix = "<div>&#x2B95;</div>"+this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} );
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "RTI":
			  	s  = "Return from Interrupt<br>";
				// TODO PULL SR ???
				s += "PC = [$1"+this.getHexByte(this.getReg("SP")+1)+"]<sub>"+getHexWord(this.ByteAt(this.getReg("SP")+256+1)+this.ByteAt(this.getReg("SP")+256+2)*256+1)+"h</sub>";
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>";
				s += this.StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "RTS":
			  	s  = "Return from subroutine<br>";
				s += "PC = [$1"+this.getHexByte(this.getReg("SP")+1)+"]<sub>"+getHexWord(this.ByteAt(this.getReg("SP")+256+1)+this.ByteAt(this.getReg("SP")+256+2)*256+1)+"h</sub>"
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>";
			break;
			case "SBC":
				s  = "Substract with borrow";
				var opc ={"E9":"imm","E5":"zpg","F5":"zpx","ED":"abs","FD":"abx","E9":"aby","E1":"inx","F1":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += "A = A<sub>"+nreg.AC+"h</sub> - "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" - C<sub>"+(this.getReg("SR")&1)+"</sub><br>";
			break;
			case "SEC":
				s = "Set carry flag<br>";
				s+= "C = 1";
				s+= this.StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "SED":
				s = "Set decimal flag<br>";
				s+= "D = 1";
				s += this.StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "SEI":
				s = "Set interrupt disable flag<br>";
				s+= "I = 1";
				s += this.StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "STA":
				s  = "Store Accumulator";
				var opc ={"85":"zpg","95":"zpx","8D":"abs","9D":"abx","99":"aby","81":"inx","91":"iny"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += this.AddressingModeTmpl(opc[ops[0]],nreg,"w",nreg.AC)+" = A<sub>"+nreg.AC+"h</sub><br>";
				var c = opc[ops[0]]=="abx" || opc[ops[0]]=="aby" ? "R" : "";
				s += this.StatusRegister({"rw":["","","","","","","",c]});
			break;
			case "STX":
				s  = "Store X"
				var opc ={"86":"zpg","96":"zpy","8E":"abs"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += this.AddressingModeTmpl(opc[ops[0]],nreg,"w",nreg.XR)+" = A<sub>"+nreg.XR+"h</sub><br>";
			break;
			case "STY":
				s  = "Store Y";
				var opc ={"84":"zpg","94":"zpx","8C":"abs"};
				s += " - ["+opc[ops[0]]+"]<br>";
				s += this.AddressingModeTmpl(opc[ops[0]],nreg,"w",nreg.YR)+" = A<sub>"+nreg.YR+"h</sub><br>";
			break;
			case "TAX":
				s  = "Transfer Accumulator to X<br>";
				s += "<div>X = A<sub>"+nreg.AC+"h<sub></div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "TAY":
				s  = "Transfer Accumulator to Y<br>";
				s += "<div>Y = A<sub>"+nreg.AC+"h<sub></div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "TSX":
			  	s  = "Transfer stack pointer to X";
				s += "<div>X = SP<sub>"+nreg.SP+"h<sub></div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "TXA":
				s  = "Transfer X to Accumulator<br>";
				s += "<div>A = X<sub>"+nreg.XR+"h<sub></div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "TXS":
				s  = "Transfer X to stack pointer";
				s += "<div>SP = X<sub>"+nreg.XR+"h<sub></div>";
			break;
			case "TYA":
				s  = "Transfer Y to Accumulator<br>";
				s += "<div>A = Y<sub>"+nreg.YR+"h<sub></div>";
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			default:
				s  = "";
		}
		this.writeDisplay(dd,s);
	}

    this.nameBit = function(hex,arr)
	{
		var nb = new Array();
		var bv = hex.toString(2);
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
		for(var i=0;i<arr.length;i++)
			nb[ arr[i] ] = bv2.charAt(i);
		return nb;
	}

    this.AddressingModeTmpl = function(adr_mode,narr,rw_mode,reg)
	{
		var s = "";
	  	switch(adr_mode)
		{
			case "acc":
				s += "A<sub>"+narr.AC+"h</sub>";
				narr["mem"]=this.getReg("AC");
			break;
			case "imm":
				narr["mem"]=parseInt(narr.ops[1],16);
				s += "#"+narr.ops[1]+"h";
			break;
			case "zpg":
				var adr = parseInt(narr.ops[1],16);
				narr["mem"]=this.ByteAt( adr );
				s += "[$"+narr.ops[1]+"]<sub>"+this.getHexByte(narr["mem"])+"h</sub>";
				report_watch({"type":adr_mode,"adr":adr,"val":(rw_mode=="w"?reg:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "abs":
				adr = parseInt(narr.ops[2]+narr.ops[1],16)
				narr["mem"]=this.ByteAt( adr );
				s += "[$"+narr.ops[2]+narr.ops[1]+"]<sub>"+this.getHexByte(narr["mem"])+"h</sub>";
				// TODO check effect of report_watch() 'reg' parameter
				report_watch({"type":adr_mode,"adr":adr,"val":(rw_mode=="w"?narr["AC"]:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "zpx":
				// operand is zeropage address; effective address is address incremented by X without carry ** 
				var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
				adr = base_adr+parseInt(narr.XR,16);
				s += "["+narr.ops[1]+"+"+narr.XR+"] = "+adr.toString(16).toUpperCase()+"h"
				narr["mem"]=this.ByteAt( adr );
				report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":(rw_mode=="w"?narr["AC"]:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "zpy":
				// operand is zeropage address; effective address is address incremented by Y without carry ** 
				var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
				adr = base_adr+parseInt(narr.YR,16);
				s += "["+narr.ops[1]+"+"+narr.YR+"] = "+adr.toString(16).toUpperCase()+"h"
				narr["mem"]=this.ByteAt( adr );
				report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":(rw_mode=="w"?narr["AC"]:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "abx":
				// operand is address; effective address is address incremented by X with carry **  
				var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
				adr = base_adr+parseInt(narr.XR,16)+parseInt(narr.carry,16);
				narr["mem"]=this.ByteAt( adr );
				s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.XR+"] = "+adr.toString(16).toUpperCase()+"h";
				report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":(rw_mode=="w"?narr["AC"]:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "aby":
				// operand is address; effective address is address incremented by Y with carry **  
				var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
				adr = base_adr+parseInt(narr.YR,16)+parseInt(narr.carry,16);
				narr["mem"]=this.ByteAt( adr );
				s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.YR+"] = "+adr.toString(16).toUpperCase()+"h";
				report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":(rw_mode=="w"?narr["AC"]:narr["mem"]),"ins":narr.ops[0]});
			break;
			case "iny":
				var adr = parseInt(narr.ops[1],16);
				var rel = this.ByteAt(adr)+this.ByteAt(adr+1)*256
				narr["mem"]=this.ByteAt(rel + parseInt(narr.YR,16));
				s += "[$"+getHexWord(rel)+"+"+narr.YR+"h]<sub>"+this.getHexByte(narr["mem"])+"h</sub>";
				if(rw_mode=="w")
					report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":this.getHexByte(narr["mem"]),"ins":narr.ops[0]});
			break;
			case "inx":
				var adr = parseInt(narr.ops[1],16);
				var idx = parseInt(narr.XR,16);
				var rel = this.ByteAt(adr+idx)+this.ByteAt(adr+idx+1)*256
				narr["mem"]=this.ByteAt(rel);
				s += "[[$"+narr.ops[1]+"+"+idx+"]<sub>"+getHexWord(rel)+"h</sub>] = "+this.getHexByte(narr["mem"])+"h";
				report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			//case "rel":
			//break;
			case "ind":
				var adr = parseInt(narr.ops[2]+narr.ops[1],16);
				var rel = this.ByteAt(adr)+this.ByteAt(adr+1)*256;
				narr["mem"]=rel;
				s += "[$"+narr.ops[2]+narr.ops[1]+"]<sub>"+getHexWord(narr["mem"])+"h</sub>";
			break;
		}
		return s;
	}

    this.BitGrid = function(cfg)
	{
		var c = cfg.rw;
		var bv = cfg["value"];
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
		var b = cfg["rnames"]==null || cfg["rnames"].length==0?["7","6","5","4","3","2","1","0"]:cfg["rnames"];
		var s = "<div class=regscroll_h id=rd style=height:"+cfg.height+"px><div class=regpar>\r\n";
		s += cfg["prefix"]?cfg["prefix"]:""
		for(var i=0;i<8;i++)
			s += this.BitUnit( {"value":bv2.charAt(i),"reg":b[i],"width":cfg.width,"height":cfg.height
				,"class":"regbyte"+(c[i].replace("R","_green").replace("W","_red")) }
			);
		s += cfg["postfix"]?cfg["postfix"]:""
		s += "</div></div>\r\n";
		return s;
	}

    this.BitUnit = function(cfg)
	{
		return "<div class=regbox style=width:"+(cfg.width?cfg.width:15)+"px;height:"+(cfg.height?cfg.height:40)+"px>"
		+"<div class="+(cfg.class?cfg.class:"regbyte")+" style=width:"+(cfg.width?cfg.width:15)+"px>"+cfg.value+"</div>"
		+(cfg.reg?("<div class=regadr style=width:"+(cfg.width?cfg.width:15)+"px>"+cfg.reg+"</div>"):"")
		+"</div>\r\n"
	}

	this.writeDisplay = oCOM.writeDisplay;

    this.updateScroll = function(el)
	{
		el.scrollTop = el.scrollHeight;
	}

    this.getHexByte = function(v)
    {
        console.log("getHexByte("+v+") requires an inheritant")
    }

    this.ByteAt = function(addr)
    {
        console.log("ByteAt("+addr+") requires an inheritant")
    }

    this.sym_search = function(op,adm)
    {
        console.log("sym_search("+op+","+adm+") requires an inheritant")
    }
}