//const e = require("express");

const { split } = require("lodash");
const { connectableObservableDescriptor } = require("rxjs/internal/observable/ConnectableObservable");

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
			if(sym[2]!=null) arr[2] = "OPR" 
				//arr[2] = sym[2]!="A" ? "VAL" : "ACC";	// LEAVE THAT TO MNEMONIC/PRAGMA TAGGER
		}
		else if(this.pragma_sym[sym[0]]!=null )
		{
			arr[0] = "PGM";
		}
		//else if(this.pragma_sym[sym[0]+" "+sym[1]] {}
		else if ( this.pragma_sym[" "+sym[1]]!=null) // check space separated pragmas
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
				}
				break;
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
				if(this.validate(str,"[A-Za-z0-9_.\-]+")) // IDENTIFIER
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
		var exp = str.split(new RegExp("[+\\-\\*^~]","g"));  // slice at math operators to dig out deeper numbers and symbols
		var r = "NaN";
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
			default:
				//if(str=="'%'")
				//	console.log("DEBUG THIS");
				var nexp = "",l=0;
				for(var i=0;i<exp.length;i++)
				{
					l+=exp[i].length+1;
					var oper = str.charAt(l-1);
					var e = this.getNumber(exp[i]);
					exp[i] = e.val;
					r.err += e.err+"|"
					nexp += exp[i]+oper;
				}

				var parser = new this.MathParser();
				console.log(str+" >> this.MathParser().parse('"+nexp+"') = "+parser.parse(nexp))
				var e = this.getNumber(parser.parse(nexp)+"")
				return {"val":e.val,"err":(!r.err && !e.err)?"":(r.err+"|"+e.err),"bytes":e.bytes};
		}	
	}

//+ Carlos R. L. Rodrigues
//@ http://jsfromhell.com/classes/math-parser [rev. #3]

this.MathParser = function()
{
    var o = this, p = o.operator = {};
    p["+"] = function(n, m){return n + m;}
    p["-"] = function(n, m){return n - m;}
    p["*"] = function(n, m){return n * m;}
    p["/"] = function(m, n){return n / m;}
    p["%"] = function(m, n){return n % m;}
    p["^"] = function(m, n){return Math.pow(n, m);}
    p["~"] = function(m, n){return Math.sqrt(n, m);}
    o.custom = {}
	p.f = function(s, n)
	{
        if(Math[s]) return Math[s](n);
        else if(o.custom[s]) return o.custom[s].apply(o, n);
        else throw new Error("Function \"" + s + "\" not defined.");
    }
	o.add = function(n, f){this.custom[n] = f;}
}

this.MathParser.prototype.eval = function(e, ig)
{
    var v = [], p = [], i, _, a, c = 0, s = 0, x, t = !ig ? e.indexOf("^") : -1, d = null;
    var cp = e, e = e.split(""), n = "0123456789.", o = "+-/*^%~", f = this.operator;
    if(t + 1)
        do{
            for(a = "", _ = t - 1;  _ && o.indexOf(e[_]) < 0; a += e[_], e[_--] = ""); a += "^";
            for(_ = t + 1, i = e.length; _ < i && o.indexOf(e[_]) < 0; a += e[_], e[_++] = "");
            e = e.slice(0, t).concat((this.eval(a, 1) + "").split("")).concat(e.slice(t + 1));
        }
        while(t = cp.indexOf("^", ++t) + 1);
    for(i = 0, l = e.length; i < l; i++){
        if(o.indexOf(e[i]) > -1)
            e[i] == "-" && (s > 1 || d === null) && ++s, !s && d !== null && (p.push(e[i]), s = 2), "+-".indexOf(e[i]) < (d = null) && (c = 1);
        else if(a = n.indexOf(e[i]) + 1 ? e[i++] : "")
		{
            while(n.indexOf(e[i]) + 1) a += e[i++];
            v.push(d = (s & 1 ? -1 : 1) * a), c && v.push(f[p.pop()](v.pop(), v.pop())) && (c = 0), --i, s = 0;
        }
    }
    for(c = v[0], i = 0, l = p.length; l--; c = f[p[i]](c, v[++i]));
    return c;
}

this.MathParser.prototype.parse = function(e)
{
	var p = [], f = [], ag, n, c, a, o = this, v = "0123456789.+-*/^%~(, )";
	for(var x, i = 0, l = e.length; i < l; i++){
		if(v.indexOf(c = e.charAt(i)) < 0) { for(a = c; v.indexOf(c = e.charAt(++i)) < 0; a += c); f.push((--i, a)) }
		else if(!(c == "(" && p.push(i)) && c == ")")
		{
			if(a = e.slice(0, (n = p.pop()) - (x = v.indexOf(e.charAt(n - 1)) < 0 ? y = (c = f.pop()).length : 0)), x)
				for(var j = (ag = e.slice(n, ++i).split(",")).length; j--; ag[j] = o.eval(ag[j]));
			l = (e = a + (x ? o.operator.f(c, ag) : o.eval(e.slice(n, ++i))) + e.slice(i)).length, i -= i - n + c.length;
		}
	}
	return o.eval(e);
}



/*
	this.getString = function(n)
	{
		// extract string between quotes
		var p1 = n.indexOf("'")+1;
		var p2 = n.lastIndexOf("'");
		return {"val":n.substring(p1,p2)};
	}
*/

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
		if(oASM.symtab[n] === undefined) return {"val":"NaN","fmt":"ID","err":"compile error:\nidentifier does not exist"}

		var b = (Math.log10(Math.abs( oASM.symtab[n] ))/log2>>3)+1;
		return {"val":oASM.symtab[n],"fmt":"ID","bytes":b};
	}

	this.getSym = function()
	{
		var c = this.getChar();
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
			/*
			else if (c == "*" && this.peekChar() == "=")
			{
				this.srcc++;
				m = 0;
				sym[s] += "*=";
				s++;
				sym[s] += "";
			}
			*/
			else
			{
				m = 1;
				sym[s] += c;
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
			return c //.toUpperCase();
		}
	}

	this.peekChar = function()
	{
		return this.codesrc[this.srcl].charAt(this.srcc);
	}

	this.parse_pragma = function(sym,pass)
	{
		switch(sym[0])
		{
			case ".END":
				listing.value += sym[0];
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


				if(sym.length != 2) return
				if(pass==2)
				{
					code[code.length] = hi;
					listing.value += ' $' + getHexWord(v) + '            ' + getHexByte(lo) + ' ' + getHexByte(hi);
					return
				}
				listing.value += ' ' + sym[1];
				pc += 2;
				return {"val":true};
				break;
			case ".BYTE":
				break;
			case ".TEXT":
				break;
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

    this.updateScroll = function(el)
	{
		el.scrollTop = el.scrollHeight;
	}

	this.concat_json = function(json1,json2)
	{
		var json3 = json1;
		for(var i in json2) json3[i] = json2[i];
		return json3;
	}

	this.hextab = oCOM.hextab;
	this.getHexByte = oCOM.getHexByte;
	this.getHexWord = oCOM.getHexWord;
}

function DASM()
{
	
    //  ██████  ██ ███████  █████  ███████ ███████ ███████ ███    ███ ██████  ██      ███████ ██████  
    //  ██   ██ ██ ██      ██   ██ ██      ██      ██      ████  ████ ██   ██ ██      ██      ██   ██ 
    //  ██   ██ ██ ███████ ███████ ███████ ███████ █████   ██ ████ ██ ██████  ██      █████   ██████  
    //  ██   ██ ██      ██ ██   ██      ██      ██ ██      ██  ██  ██ ██   ██ ██      ██      ██   ██ 
    //  ██████  ██ ███████ ██   ██ ███████ ███████ ███████ ██      ██ ██████  ███████ ███████ ██   ██ 

    this.disassemble = function()
    {
	var instr=this.ByteAt(pc);
	var op1=this.getHexByte(this.ByteAt(pc+1));
	var op2=this.getHexByte(this.ByteAt(pc+2));
	var adr=getHexWord(pc);
	var ops=this.getHexByte(instr);
	var disas=opctab[instr][0];
	var adm=opctab[instr][1];
	if (op1==null) op1=0;
	if (op2==null) op2=0;
	switch (adm) {
		case 'imm' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;#$'+this.sym_search(op1,adm);
			break;
		case 'zpg' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+this.sym_search("$"+op1,adm);
			break;
		case 'acc' :
			ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;A';
			break;
		case 'abs' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+this.sym_search("$"+op2+op1,adm);
			break;
		case 'zpx' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+this.sym_search("$"+op1,adm)+',X';
			break;
		case 'zpy' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+this.sym_search("$"+op1,adm)+',Y';
			break;
		case 'abx' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+this.sym_search("$"+op2+op1,adm)+',X';
			break;
		case 'aby' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+this.sym_search("$"+op2+op1,adm)+',Y';
			break;
		case 'iny' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;('+this.sym_search("$"+op1,adm)+'),Y';
			break;
		case 'inx' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;('+this.sym_search("$"+op1,adm)+',X)';
			break;
		case 'rel' :
			var opv=this.ByteAt(pc+1);
			var targ=pc+2;
			if (opv&128) targ-=(opv^255)+1; else targ +=opv;
			targ&=0xffff;
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+this.sym_search("$"+getHexWord(targ),adm);
			break;
		case 'ind' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;('+this.sym_search("$"+op2+op1,adm)+')';
			break;
		default :
			ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        }
        var disp = '<div style="width:100px;float:left">'+adr+'&nbsp;'+ops+'</div>'+disas+"<br>"
        dispmem += disp

        this.writeShow('regdisp',adr,ops,disas);
        //this.writeDisplay('dispStep',dispmem);
        this.writeDisplay('dispStep',disp,"beforeend");
        this.updateScroll('dispStep');

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
		var bv = this.getReg("SR").toString(2);
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
		var a = ["N","V",".","B","D","I","Z","C"];
		var b = ["neg","over","&nbsp;","break","deci","interr","zero","carry"];
		var s = "<div class=regscroll_h id=rd><div class=regpar>";
		for(var i=0;i<8;i++)
			s += ("<div class=regbox>"
			+"<div class=regadr>"+b[i]+"</div>"
			+"<div class=regbyte"+(c[i].replace("R","_green").replace("W","_red"))+">"+bv2.charAt(i)+"</div>"
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
				s = "Add with carry"
				var opc ={"69":"imm","65":"zpg","75":"zpx","6D":"abs","7D":"abx","79":"aby","61":"inx","71":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> + "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" + C<sub>"+(this.getReg("SR")&1)+"</sub><br>"
			break;
			case "AND":
				s = "And"
				var opc ={"29":"imm","25":"zpg","35":"zpx","2D":"abs","3D":"abx","39":"aby","21":"inx","31":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> & "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
				s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "ASL":
				s = "Arithmetic Shift Left"
				var opc ={"0A":"acc","06":"zpg","16":"zpx","0E":"abs","1E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = << "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				this.AddressingModeTmpl(opc[ops[0]],nreg);
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>"
				var postfix = "<div>&#x2B05;</div>"+this.BitUnit( {"value":0,"class":"regbyte_green"} )+"<div><small>&nbsp;"+this.getHexByte(nreg["mem"])+"h</small></div>"
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":nreg["mem"].toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","W","","","","","","W"]})
			break;
			case "BCC":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Carry Clear<br>"
					s +="<div>carry-bit "+bv2.charAt(2)+" = 0 ? "
						+(bv2.charAt(2)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","R","","","","",""]})
			break;
			case "BCS":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Carry Set<br>"
					s +="<div>carry-bit "+bv2.charAt(2)+" = 1 ? "
						+(bv2.charAt(2)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","R","","","","",""]})
			break;
			case "BEQ":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Zero<br>"
					s +="<div>zero-bit "+bv2.charAt(6)+" = 1 ? "
						+(bv2.charAt(6)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","","","","","R",""]})
			break;
			case "BIT":
					s+= "Test Bits in Memory with Acc<br>"
					var opc ={"24":"zpg","2C":"abs"};
					var postfix = "&nbsp;<div>z=A<sub>"+nreg.AC+"h </sub>&<sub> "+this.getHexByte(this.ByteAt(parseInt(ops[1],16)))+"h</sub></div>"
				  s += this.BitGrid({"value":this.ByteAt(parseInt(ops[1],16)).toString(2),"postfix":postfix,"height":18,"rnames":[""],"rw":["R","R","","","","","",""]});
					s += this.StatusRegister({"rw":["W","W","","","","","W",""]})
			break;
			case "BMI":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Minus<br>"
					s +="<div>negative-bit "+bv2.charAt(0)+" = 1 ? "
						+(bv2.charAt(0)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["R","","","","","","",""]})
			break;
			case "BNE":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch if Not Equal<br>"
					s +="<div>zero-bit "+bv2.charAt(6)+" ≠ 1 ? "
						+(bv2.charAt(6)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","","","","","R",""]})
			break;
			case "BPL":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Minus<br>"
					s +="<div>negative-bit "+bv2.charAt(0)+" ≠ 1 ? "
						+(bv2.charAt(0)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["R","","","","","","",""]})
			break;
			case "BRK":
				s = "Force Break<br>"
				// TODO
				// interrupt,push PC+2, push SR
			break;
			case "BVC":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Overflow Clear<br>"
					s +="<div>overflow-bit "+bv2.charAt(7)+" = 0 ? "
						+(bv2.charAt(7)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","","","","","","R"]})
			break;
			case "BVS":
					var bv = this.getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Overflow Set<br>"
					s +="<div>overflow-bit "+bv2.charAt(7)+" = 1 ? "
						+(bv2.charAt(7)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += this.StatusRegister({"rw":["","","","","","","","R"]})
			break;
			case "CLC":
			s = "Clear carry flag<br>"
			s+= "C = 0"
			s+= this.StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "CLD":
			s = "Clear decimal flag<br>"
			s+= "D = 0"
			s+= this.StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "CLI":
			s = "Clear interrupt disable bit<br>"
			s+= "I = 0"
			s+= this.StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "CLV":
			s = "Clear overflow flag<br>"
			s+= "V = 0"
			s+= this.StatusRegister({"rw":["","W","","","","","",""]});
			break;
			case "CMP":
			s = "Compare"
			var opc ={"C9":"imm","C5":"zpg","D5":"zpx","CD":"abs","DD":"abx","D9":"aby","C1":"inx","D1":"iny"};
			s +=" - ["+opc[ops[0]]+"]<br>"
			s += "A<sub>"+nreg.AC+"h</sub> = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" ?<br>\r\n"
			s += this.StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "CPX":
			// TODO
			break;
			case "CMY":
			// TODO
			break;
			case "DEC":
				s = "Decrement"
				var opc ={"C6":"zpg","D6":"zpx","CE":"abs","DE":"abx"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"-1<br>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEX":
				s = "Decrement X Register<br>"
				s +="<div>X = "+nreg.YR+"h-1</div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEY":
				s = "Decrement Y Register<br>"
				s +="<div>Y = "+nreg.YR+"h-1</div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "EOR":
			s = "Exclusive-OR"
			var opc ={"49":"imm","45":"zpg","55":"zpx","4D":"abs","5D":"abx","59":"aby","41":"inx","51":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> ⊕ "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
			s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "INC":
				s = "Increment"
				var opc ={"E6":"zpg","F6":"zpx","EE":"abs","FE":"abx"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"+1<br>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INX":
				s = "Increment X Register<br>"
				s +="<div>X = "+nreg.XR+"h+1</div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INY":
				s = "Increment Y Register<br>"
				s +="<div>Y = "+nreg.YR+"h+1</div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "JMP":
				if(typeof(opc)=="undefined") s = "Jump"
				var opc ={"4C":"abs","6C":"ind"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "PC = "+this.AddressingModeTmpl(opc[ops[0]],nreg)//.split("<sub>#")[0]
			break;
			case "JSR":
				if(typeof(opc)=="undefined") s = "Jump Subroutine"
				var opc ={"20":"abs"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "PC = "+this.AddressingModeTmpl(opc[ops[0]],nreg).split("<sub>#")[0]
				   +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-2<br>"
			break;
			case "LDY":
				if(typeof(opc)=="undefined") var opc = {"title":"Load Y Register","reg":"YR","A0":"imm","A4":"zpg","B4":"zpx","AC":"abs","BC":"abx"};
			case "LDX":
				if(typeof(opc)=="undefined") var opc = {"title":"Load X Register","reg":"XR","A2":"imm","A6":"zpg","B6":"zpy","AE":"abs","BE":"aby"};
			case "LDA":
				if(typeof(opc)=="undefined") var opc = {"title":"Load Accumulator","reg":"AC","A9":"imm","A5":"zpg","B5":"zpx","AD":"abs","BD":"abx","B9":"aby","A1":"inx","B1":"iny"};
				s+=opc.title+" - ["+opc[ops[0]]+"]<br>"
				s += instr.slice(-1)+"<sub>"+this.getHexByte(this.getReg(opc.reg))+"h</sub> = "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "LSR":
				s = "Logical Shift Right"
				var opc ={"4A":"acc","46":"zpg","56":"zpx","4E":"abs","5E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = >> "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = this.BitUnit( {"value":0,"class":"regbyte_green"} )+"<div>&#x2B95;</div>"
				var postfix = "<div>&#x2B95;</div>"+this.BitUnit( {"value":this.getReg("AC")&1,"reg":"carry"} )
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "NOP":
				s = "No operation"
			break;
			case "ORA":
			s = "Exclusive-OR"
			var opc ={"09":"imm","05":"zpg","15":"zpx","0D":"abs","1D":"abx","19":"aby","01":"inx","11":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> | "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
			s += this.BitGrid({"value":this.getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			s += this.BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+this.getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "PHA":
			s = "Push Accumulator on Stack<br>"
			s += "[$1"+nreg.SP+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = A<sub>"+nreg.AC+"h</sub>"
				 +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>"
			break;
			case "PHP":
			s = "Push Processor Status on Stack<br>"
			s += "[$1"+nreg.SP+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = PS<sub>"+nreg.SR+"h</sub>"
				 +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>"
			break;
			case "PLA":
			s = "Pull Accumulator from Stack<br>"
			s += "SP = SP<sub>"+nreg.SP+"h</sub>+1"
			s += "&nbsp;A<sub>"+nreg.AC+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>"
			break;
			case "PLP":
			s = "Pull Processor Status from Stack<br>"
			s += "SP = SP<sub>"+nreg.SP+"h</sub>+1"
			s += "&nbsp;PS<sub>"+nreg.SR+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+this.getHexByte(this.ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>"
			s += this.StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "ROL":
				s = "Rotate Left"
				var opc ={"2A":"acc","26":"zpg","36":"zpx","2E":"abs","3E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = << "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>"
				var postfix = "<div>&#x2B05;</div>"+this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )
				s += this.BitGrid({"pretfix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","W","W","","","","",""]});
			break;
			case "ROR":
				s = "Rotate Right"
				var opc ={"6A":"acc","66":"zpg","76":"zpx","6E":"abs","7E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = >> "+this.AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B95;</div>"
				var postfix = "<div>&#x2B95;</div>"+this.BitUnit( {"value":this.getReg("SR")&1,"reg":"carry"} )
				s += this.BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":this.getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += this.StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "RTI":
			  s = "Return from Interrupt<br>"
				// TODO PULL SR ???
				s+= "PC = [$1"+this.getHexByte(this.getReg("SP")+1)+"]<sub>"+getHexWord(this.ByteAt(this.getReg("SP")+256+1)+this.ByteAt(this.getReg("SP")+256+2)*256+1)+"h</sub>"
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>"
				 s += this.StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "RTS":
			  s = "Return from subroutine<br>"
				s+= "PC = [$1"+this.getHexByte(this.getReg("SP")+1)+"]<sub>"+getHexWord(this.ByteAt(this.getReg("SP")+256+1)+this.ByteAt(this.getReg("SP")+256+2)*256+1)+"h</sub>"
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>"
			break;
			case "SBC":
			s = "Substract with borrow"
			var opc ={"E9":"imm","E5":"zpg","F5":"zpx","ED":"abs","FD":"abx","E9":"aby","E1":"inx","F1":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> - "+this.AddressingModeTmpl(opc[ops[0]],nreg)+" - C<sub>"+(this.getReg("SR")&1)+"</sub><br>"
			break;
			case "SEC":
			s = "Set carry flag<br>"
			s+= "C = 1"
			s+= this.StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "SED":
			s = "Set decimal flag<br>"
			s+= "D = 1"
			s += this.StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "SEI":
			s = "Set interrupt disable flag<br>"
			s+= "I = 1"
			s += this.StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "STA":
				s = "Store Accumulator"
				var opc ={"85":"zpg","95":"zpx","8D":"abs","9D":"abx","99":"aby","81":"inx","91":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += this.AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.AC+"h</sub><br>"
			break;
			case "STX":
				s = "Store X"
				var opc ={"86":"zpg","96":"zpy","8E":"abs"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += this.AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.XR+"h</sub><br>"
			break;
			case "STY":
				s = "Store Y"
				var opc ={"84":"zpg","94":"zpx","8C":"abs"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += this.AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.YR+"h</sub><br>"
			break;
			case "TAX":
				s = "Transfer Accumulator to X<br>"
				s +="<div>X = A<sub>"+nreg.AC+"h<sub></div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TAY":
				s = "Transfer Accumulator to Y<br>"
				s +="<div>Y = A<sub>"+nreg.AC+"h<sub></div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TSX":
			  s = "Transfer stack pointer to X"
				s +="<div>X = SP<sub>"+nreg.SP+"h<sub></div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TXA":
				s = "Transfer X to Accumulator<br>"
				s +="<div>A = X<sub>"+nreg.XR+"h<sub></div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TXS":
			  s = "Transfer X to stack pointer"
				s +="<div>SP = X<sub>"+nreg.XR+"h<sub></div>"
			break;
			case "TYA":
				s = "Transfer Y to Accumulator<br>"
				s +="<div>A = Y<sub>"+nreg.YR+"h<sub></div>"
				s += this.StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			default:
					s = "";
		}
		this.writeDisplay(dd,s);

		/*
		<button onclick='document.getElementById("rd").scrollLeft=2000;'>scroll</button>
		<div class="regscroll_h " id=rd>
			<div class=regpar>
				 <script>
				 for(var i=0;i<255;i++)
						document.write("<div class=regbox>"
						+"<div class=regadr>"+("000"+i.toString(16)).slice(-4).toUpperCase()+"</div>"
						+"<div class=regbyte>"+("0"+i.toString(16)).slice(-2).toUpperCase()+"</div>"
						+"</div>")
				 </script>
			 </div>
		 </div>
		 */
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

    this.AddressingModeTmpl = function(adr_mode,narr)
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
			report_watch({"type":adr_mode,"adr":adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "abs":
			adr = parseInt(narr.ops[2]+narr.ops[1],16)
			narr["mem"]=this.ByteAt( adr );
			s += "[$"+narr.ops[2]+narr.ops[1]+"]<sub>"+this.getHexByte(narr["mem"])+"h</sub>";
			report_watch({"type":adr_mode,"adr":adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "zpx":
			s += "$"+narr.ops[1]+",X";
			break;
			case "zpy":
			s += "$"+narr.ops[1]+",Y";
			break;
			case "abx":
			var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
			adr = base_adr+parseInt(narr.XR,16)+parseInt(narr.carry,16);
			narr["mem"]=this.ByteAt( adr );
			s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.XR+"+"+narr.carry+"] = "
			+adr.toString(16).toUpperCase()+"h"
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "aby":
			var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
			adr = base_adr+parseInt(narr.YR,16)+parseInt(narr.carry,16);
			narr["mem"]=this.ByteAt( adr );
			s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.YR+"+"+narr.carry+" = "
			+adr.toString(16).toUpperCase()+"h"
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "iny":
			var adr = parseInt(narr.ops[1],16);
			var rel = this.ByteAt(adr)+this.ByteAt(adr+1)*256
			narr["mem"]=this.ByteAt(rel + parseInt(narr.YR,16));
			s += "[$"+getHexWord(rel)+"+"+narr.YR+"h]<sub>"+this.getHexByte(narr["mem"])+"h</sub>";
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
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
		s+= cfg["prefix"]?cfg["prefix"]:""
		for(var i=0;i<8;i++)
			s+=this.BitUnit( {"value":bv2.charAt(i),"reg":b[i],"width":cfg.width,"height":cfg.height
				,"class":"regbyte"+(c[i].replace("R","_green").replace("W","_red")) }
			);
		s+= cfg["postfix"]?cfg["postfix"]:""
		s+= "</div></div>\r\n";
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
	/*
    this.writeDisplay = function(n,v,f){
		// n = el, v = value, f = extra HTML
		var obj,tagname,bAppend = typeof(f)!="undefined";
		if (document.getElementById) {
			obj=document.getElementById(n);
			tagname = obj.tagName.toUpperCase();
		}
		else if (document.all) {
			obj=document.all[n];
		}
		if(!obj) return;
		switch(tagname)
		{
			case "INPUT":
				switch(f)
				{
					case "beforebegin":obj.value += v; break; 				// less common
					case "afterbegin": obj.value = v + obj.value; break;	// less common
					case "afterend":   obj.value = v + obj.value; break;
					case "beforeend":  obj.value += v; break;
					default:  		   obj.value = v;
				}
			break;
			default:
				if(bAppend) obj.insertAdjacentHTML(f,v);
				else obj.innerHTML=v;
		}
	}
	*/

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