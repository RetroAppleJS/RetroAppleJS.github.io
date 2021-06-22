// 6502 emulator - gui functions

// conf & globals

var runThrou=false;
var runStep, totalSteps;
var maxRun=255;
var simCycleDelay=40;
var loaded=false;
var dispmem = "";
var dispwatch = "";
var mem_checksum = [];
var pstruct = {};
var watch_data = {};

// lookup tables

var hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
var opctab= [
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

addrtab= {
	acc:'A',
	abs:'abs',
	abx:'abs,X',
	aby:'abs,Y',
	imm:'#',
	imp:'impl',
	ind:'ind',
	inx:'X,ind',
	iny:'ind,Y',
	rel:'rel',
	zpg:'zpg',
	zpx:'zpg,X',
	zpy:'zpg,Y'
};

// constructor mods (ie4 fix)

var IE4_keyref;
var IE4_keycoderef;

function IE4_makeKeyref() {
	IE4_keyref= new Array();
	IE4_keycoderef= new Array();
	var hex= new Array('A','B','C','D','E','F');
	for (var i=0; i<=15; i++) {
		var high=(i<10)? i:hex[i-10];
		for (var k=0; k<=15; k++) {
			var low=(k<10)? k:hex[k-10];
			var cc=i*16+k;
			if (cc>=32) {
				var cs=unescape("%"+high+low);
				IE4_keyref[cc]=cs;
				IE4_keycoderef[cs]=cc;
			}
		}
	}
}

function _ie4_strfrchr(cc) {
	return (cc!=null)? IE4_keyref[cc] : '';
}

function _ie4_strchcdat(n) {
	cs=this.charAt(n);
	return (IE4_keycoderef[cs])? IE4_keycoderef[cs] : 0;
}

if (!String.fromCharCode) {
	IE4_makeKeyref();
	String.fromCharCode=_ie4_strfrchr;
}
if (!String.prototype.charCodeAt) {
	if (!IE4_keycoderef) IE4_makeKeyref();
	String.prototype.charCodeAt=_ie4_strchcdat;
}

// functions

function getReg(r) {
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

function setReg(r,v) {
	switch (r) {
		case 'PC' : pc=v; break;
		case 'AC' : a=v; break;
		case 'XR' : x=v; break;
		case 'YR' : y=v; break;
		case 'SR' : flags=v; break;
		case 'SP' : sp=v; break;
		default : ;
	}
}
function setRegister(r) {
	var prstr= (r=='PC')? getHexWord(pc) : getHexByte(getReg(r));
	var v=prompt('Please enter a hex value for '+r+':', prstr);
	v=parseInt(v,16);
	if (isNaN(v)) return;
	v=Math.abs(Math.floor(v));
	if (r=='SR') v|=32;
	if (r=='PC') v&=0xffff
	else v&=255;
	setReg(r,v);
	updateReg(r);
	if (r=='PC') disassemble();
}

function setWatchByte(r) {
	pstruct = readWatchAddresses();
	prstr = typeof(pstruct[r])!="undefined"?pstruct[r]:"0000"
	var v=prompt('Please enter watch address for '+r+':', prstr);
	if(v==null) return
	if(v=="") delete pstruct[r]; else pstruct[r] = v;
	writeWatchAddresses(pstruct);
	updateWatch(r);
}

function setwatchBit(r) {
	pstruct= readWatchAddresses();
	prstr = typeof(pstruct[r])=="string"?pstruct[r]:"0000."+r
	var v=prompt('Please enter watch address for bit '+r+':', prstr);
	if(v==null) return
	if(v=="") delete pstruct[r]; else pstruct[r] = v;
	writeWatchAddresses(pstruct);
}

function readWatchAddresses() {
	var wp=document.getElementById('watchparam').value;
	// TODO user generic function for that
	var nwp = new Array();
	if(typeof(wp)=="string") eval("nwp="+(wp==""?"{}":wp));
	return nwp;
}

function writeWatchAddresses(p)
{
	var _a  = new Array();
	for(var _i in p)
		if(p[_i]!="" && p[_i]!="null") _a[_a.length] = "'"+_i+"':'"+p[_i]+"'";

  // TODO user generic function for that like writeDisplay !!!
	document.getElementById('watchparam').value = "{"+_a.join(",")+"}";
}

function watchHexBitAddress(v) {
	return "0000.0"  // TODO: get this from structure in watchparam
	//return ''+hextab[Math.floor(v/16)]+hextab[v&0x0f];
}

function flipSRBit(b) {
	if (b==5) return;
	flags^=(1<<b);
	updateReg('SR');
}

function resetProcessor() {
	resetCPU();
	updateReg();
	updateWatch();
	disassemble();
}

function inialize() {
	window.status='initializing ...';
	resetProcessor();
	loaded=true;
	window.status='ready.';
}

function updateReg(r) {
	if (r==null) {
		updateReg('PC');
		updateReg('AC');
		updateReg('XR');
		updateReg('YR');
		updateReg('SR');
		updateReg('SP');
		writeDisplay('dispCycles', 'total cycles: '+processorCycles+" <small>("+processorCycles/1000+"ms)<small>");
		return;
	}
	var obj;
	if (r=='PC') {
		writeDisplay('dispPC',getHexWord(pc));
	}
	else {
		writeDisplay('disp'+r,''+getHexByte(getReg(r)));
	}
	if (r=='SR') {
		for (var i=0; i<8; i++) {
			var b=((flags&(1<<i))>0)? 1:0;
			writeDisplay('dispSR'+i,b);
		}
	}
}

function report_watch(obj)
{
	// TODO DETECT WATCH OPTIONS: WATCH LABELS, GENERIC ADDRESSES, ZERO-PAGE, ROM ADDRESSES
	try { var instr = opctab[ parseInt(obj.ins,16) ][0] }
	catch(e){  alert("not found "+obj.ins+" "+parseInt(obj.ins,16)) ; var instr = "" }

	var allow_instr = "LDA LDX LDY STA STX STY INC CMP CPX CPY";
	if(allow_instr.indexOf(instr)<0) return;

	var bBase = typeof(obj.base_adr)=="number"
	var ads = "$"+(obj.adr<256?getHexByte(obj.adr):getHexWord(obj.adr));

  dispwatch = obj.type+" - "
	+sym_search(ads,obj.type)
	+" = "+getHexByte(obj.val)+"h "
	+(bBase?("("+obj.base_adr.toString(16).toUpperCase()+"h)"):"")
	+"<br>"

	//alert( parseInt(obj.ins,16)+" "+opctab[ parseInt(obj.ins,16) ][0] )

  writeDisplay('watchdisp',dispwatch,"beforeend");
	updateScroll('watchdisp');
}

function updateWatch(r) {

	if (r==null) {
		pstruct = readWatchAddresses();
		updateWatch('AD');
		updateWatch('R1');
		updateWatch('R2');
		updateWatch('R3');
		updateWatch('R4');
		updateWatch('R5');
		updateWatch('R6');
		updateWatch('0');
		updateWatch('1');
		updateWatch('2');
		updateWatch('3');
		updateWatch('4');
		updateWatch('5');
		updateWatch('6');
		updateWatch('7');
		return;
	}

   // get address
	 var adr = pstruct[r]
	 if(typeof(adr)=="undefined" || adr==null) return;

	 var badr = adr.toString().split(".");
	 var v = badr[0];

	 var m=parseInt(v,16);
	 if (isNaN(m)) {
		 alert('Sorry:\n"'+v+'" is not a valid hex number!');
	 }
	 else {
		 //m=Math.abs(Math.floor(m))&0xfff0;
		 //var s='';
		 //var b=getHexWord(m);
		 var bi = 1<<badr[1];
		 var by = ByteAt(m);
 	 	 var hby = typeof(badr[1])=="undefined"? getHexByte(by) : ((by & bi)>0 ? 1:0);

		 writeDisplay('disp'+r, hby);
	 }
// getMem
	 //writeDisplay('disp'+r, getHexWord(pc));
}

function writeDisplay(n,v,f) {
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
				case "beforebegin":obj.value += v; break; 						// less common
				case "afterbegin": obj.value = v + obj.value; break;	// less common
				case "afterend":   obj.value = v + obj.value; break;
				case "beforeend":  obj.value += v; break;
				default:  				 obj.value = v;
			}
		break;
		default:
			if(bAppend) obj.insertAdjacentHTML(f,v);
			else obj.innerHTML=v;
	}
}

function getHexByte(v) {
	return ''+hextab[Math.floor(v/16)]+hextab[v&0x0f];
}

function getHexWord(v) {
	return ''+hextab[Math.floor(v/0x1000)]+hextab[Math.floor((v&0x0f00)/256)]+hextab[Math.floor((v&0xf0)/16)]+hextab[v&0x000f];
}

function sym_search(op,adm)
{
	// TODO SEARCH THROUGH watchparam
	var opd = parseInt(op.substring(1,op.length),16)
	switch(adm)
	{
		case "zpg":
		case "abs":
		case "rel":
		case "iny":
		case "inx":
			var adr = asm.symlink[opd];  // watch parameter translation
			if(typeof(adr)!="undefined") return adr+" <small>"+op+"h</small>"
			var adr = asm.symlink[opd-1];  // watch parameter translation of address - 1
			if(typeof(adr)!="undefined") return adr+"+1 <small>"+op+"h</small>"



			//alert("asm.symlink["+opd+"] = "+adr)
			// GET FROM FORM
						//  document.getElementById("watchparam2").value
						//  OR
						//  debug info in code

			//op = adr+" <small>"+op+"h</small>"
		break;
	}
	return op+"<small>["+adm+"]</small>";
}


// DISASEMBLE //////////////////////////////////////

function disassemble()
{
	var instr=ImmediateByte();
	var op1=getHexByte(ByteAt(pc+1));
	var op2=getHexByte(ByteAt(pc+2));
	var adr=getHexWord(pc);
	var ops=getHexByte(instr);
	var disas=opctab[instr][0];
	var adm=opctab[instr][1];
	if (op1==null) op1=0;
	if (op2==null) op2=0;
	switch (adm) {
		case 'imm' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;#$'+sym_search(op1,adm);
			break;
		case 'zpg' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+sym_search("$"+op1,adm);
			break;
		case 'acc' :
			ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;A';
			break;
		case 'abs' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+sym_search("$"+op2+op1,adm);
			break;
		case 'zpx' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+sym_search("$"+op1,adm)+',X';
			break;
		case 'zpy' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+sym_search("$"+op1,adm)+',Y';
			break;
		case 'abx' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+sym_search("$"+op2+op1,adm)+',X';
			break;
		case 'aby' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;'+sym_search("$"+op2+op1,adm)+',Y';
			break;
		case 'iny' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;('+sym_search("$"+op1,adm)+'),Y';
			break;
		case 'inx' :
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;('+sym_search("$"+op1,adm)+',X)';
			break;
		case 'rel' :
			var opv=ByteAt(pc+1);
			var targ=pc+2;
			if (opv&128) targ-=(opv^255)+1; else targ +=opv;
			targ&=0xffff;
			ops+='&nbsp;'+op1+'&nbsp;&nbsp;&nbsp;';
			disas+='&nbsp;'+sym_search("$"+getHexWord(targ),adm);
			break;
		case 'ind' :
			ops+='&nbsp;'+op1+'&nbsp;'+op2;
			disas+='&nbsp;('+sym_search("$"+op2+op1,adm)+')';
			break;
		default :
			ops+='&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
	}
	var disp = '<div style="width:100px;float:left">'+adr+'&nbsp;'+ops+'</div>'+disas+"<br>"
	dispmem += disp

	writeShow('regdisp',adr,ops,disas);
  //writeDisplay('dispStep',dispmem);
	writeDisplay('dispStep',disp,"beforeend");
	updateScroll('dispStep');

	function StatusRegister(cfg)
	{
	  var c = cfg.rw;
		var bv = getReg("SR").toString(2);
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

	function BitGrid(cfg)
	{
	  var c = cfg.rw;
		var bv = cfg["value"];
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7);
		var b = cfg["rnames"]==null || cfg["rnames"].length==0?["7","6","5","4","3","2","1","0"]:cfg["rnames"];
		var s = "<div class=regscroll_h id=rd style=height:"+cfg.height+"px><div class=regpar>\r\n";
		s+= cfg["prefix"]?cfg["prefix"]:""
		for(var i=0;i<8;i++)
			s+=BitUnit( {"value":bv2.charAt(i),"reg":b[i],"width":cfg.width,"height":cfg.height
				,"class":"regbyte"+(c[i].replace("R","_green").replace("W","_red")) }
			);
		s+= cfg["postfix"]?cfg["postfix"]:""
		s+= "</div></div>\r\n";
		return s;
	}

	function BitUnit(cfg)
	{
		return "<div class=regbox style=width:"+(cfg.width?cfg.width:15)+"px;height:"+(cfg.height?cfg.height:40)+"px>"
		+"<div class="+(cfg.class?cfg.class:"regbyte")+" style=width:"+(cfg.width?cfg.width:15)+"px>"+cfg.value+"</div>"
		+(cfg.reg?("<div class=regadr style=width:"+(cfg.width?cfg.width:15)+"px>"+cfg.reg+"</div>"):"")
		+"</div>\r\n"
	}

	function nameBit(hex,arr)
	{
		var nb = new Array();
		var bv = hex.toString(2);
		var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
		for(var i=0;i<arr.length;i++)
			nb[ arr[i] ] = bv2.charAt(i);
		return nb;
	}

	function AddressingModeTmpl(adr_mode,narr)
	{
		var s = "";
	  switch(adr_mode)
		{
			case "acc":
			s += "A<sub>"+narr.AC+"h</sub>";
			narr["mem"]=getReg("AC");
			break;
			case "imm":
			narr["mem"]=parseInt(narr.ops[1],16);
			s += "#"+narr.ops[1]+"h";
			break;
			case "zpg":
			var adr = parseInt(narr.ops[1],16);
			narr["mem"]=ByteAt( adr );
			s += "[$"+narr.ops[1]+"]<sub>"+getHexByte(narr["mem"])+"h</sub>";
			report_watch({"type":adr_mode,"adr":adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "abs":
			adr = parseInt(narr.ops[2]+narr.ops[1],16)
			narr["mem"]=ByteAt( adr );
			s += "[$"+narr.ops[2]+narr.ops[1]+"]<sub>"+getHexByte(narr["mem"])+"h</sub>";
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
			narr["mem"]=ByteAt( adr );
			s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.XR+"+"+narr.carry+"] = "
			+adr.toString(16).toUpperCase()+"h"
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "aby":
			var base_adr = parseInt(narr.ops[2]+narr.ops[1],16);
			adr = base_adr+parseInt(narr.YR,16)+parseInt(narr.carry,16);
			narr["mem"]=ByteAt( adr );
			s+="["+narr.ops[2]+narr.ops[1]+"+"+narr.YR+"+"+narr.carry+" = "
			+adr.toString(16).toUpperCase()+"h"
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "iny":
			var adr = parseInt(narr.ops[1],16);
			var rel = ByteAt(adr)+ByteAt(adr+1)*256
			narr["mem"]=ByteAt(rel + parseInt(narr.YR,16));
			s += "[$"+getHexWord(rel)+"+"+narr.YR+"h]<sub>"+getHexByte(narr["mem"])+"h</sub>";
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			case "inx":
			var adr = parseInt(narr.ops[1],16);
			var idx = parseInt(narr.XR,16);
			var rel = ByteAt(adr+idx)+ByteAt(adr+idx+1)*256
			narr["mem"]=ByteAt(rel);
			s += "[[$"+narr.ops[1]+"+"+idx+"]<sub>"+getHexWord(rel)+"h</sub>] = "+getHexByte(narr["mem"])+"h";
			report_watch({"type":adr_mode,"adr":adr,"base_adr":base_adr,"val":narr["mem"],"ins":narr.ops[0]});
			break;
			//case "rel":
			//break;
			case "ind":
			var adr = parseInt(narr.ops[2]+narr.ops[1],16);
			var rel = ByteAt(adr)+ByteAt(adr+1)*256;
			narr["mem"]=rel;
			s += "[$"+narr.ops[2]+narr.ops[1]+"]<sub>"+getHexWord(narr["mem"])+"h</sub>";
			break;
		}
		return s;
	}


	function writeShow(dd,a,o,d)
	{
		var s = "";
		var adm = ['imm','zpg','acc','abs','zpx','zpy','abx','aby','iny','inx','rel','ind'];
	  var b   = ["neg","over","&nbsp;","break","deci","interr","zero","carry"];
		var instr = d.substring(0,3);
		var oper  = d.substring(4,d.length);
		var ops = o.split("&nbsp;");
	  var nreg = Object.assign({},
			{"PC":getHexWord(getReg("PC")),"AC":getHexByte(getReg("AC")),"XR":getHexByte(getReg("XR")),"YR":getHexByte(getReg("YR")),"SR":getHexByte(getReg("SR")),"SP":getHexByte(getReg("SP"))},
			nameBit(getReg("SR"),["neg","over","&nbsp;","break","deci","interr","zero","carry"]),
			{"ops":ops});

	// https://www.key-shortcut.com/en/writing-systems/35-symbols/arrows

		switch(instr)
		{
			case "ADC":
				s = "Add with carry"
				var opc ={"69":"imm","65":"zpg","75":"zpx","6D":"abs","7D":"abx","79":"aby","61":"inx","71":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> + "+AddressingModeTmpl(opc[ops[0]],nreg)+" + C<sub>"+(getReg("SR")&1)+"</sub><br>"
			break;
			case "AND":
				s = "And"
				var opc ={"29":"imm","25":"zpg","35":"zpx","2D":"abs","3D":"abx","39":"aby","21":"inx","31":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += "A = A<sub>"+nreg.AC+"h</sub> & "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
				s += BitGrid({"value":getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
				s += BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "ASL":
				s = "Arithmetic Shift Left"
				var opc ={"0A":"acc","06":"zpg","16":"zpx","0E":"abs","1E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = << "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				AddressingModeTmpl(opc[ops[0]],nreg);
				var prefix = BitUnit( {"value":getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>"
				var postfix = "<div>&#x2B05;</div>"+BitUnit( {"value":0,"class":"regbyte_green"} )+"<div><small>&nbsp;"+getHexByte(nreg["mem"])+"h</small></div>"
				s += BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":nreg["mem"].toString(2),"rw":["","","","","","","",""]});
				s += StatusRegister({"rw":["W","W","","","","","","W"]})
			break;
			case "BCC":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Carry Clear<br>"
					s +="<div>carry-bit "+bv2.charAt(2)+" = 0 ? "
						+(bv2.charAt(2)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","R","","","","",""]})
			break;
			case "BCS":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Carry Set<br>"
					s +="<div>carry-bit "+bv2.charAt(2)+" = 1 ? "
						+(bv2.charAt(2)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","R","","","","",""]})
			break;
			case "BEQ":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Zero<br>"
					s +="<div>zero-bit "+bv2.charAt(6)+" = 1 ? "
						+(bv2.charAt(6)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","","","","","R",""]})
			break;
			case "BIT":
					s+= "Test Bits in Memory with Acc<br>"
					var opc ={"24":"zpg","2C":"abs"};
					var postfix = "&nbsp;<div>z=A<sub>"+nreg.AC+"h </sub>&<sub> "+getHexByte(ByteAt(parseInt(ops[1],16)))+"h</sub></div>"
				  s += BitGrid({"value":ByteAt(parseInt(ops[1],16)).toString(2),"postfix":postfix,"height":18,"rnames":[""],"rw":["R","R","","","","","",""]});
					s += StatusRegister({"rw":["W","W","","","","","W",""]})
			break;
			case "BMI":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Minus<br>"
					s +="<div>negative-bit "+bv2.charAt(0)+" = 1 ? "
						+(bv2.charAt(0)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["R","","","","","","",""]})
			break;
			case "BNE":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch if Not Equal<br>"
					s +="<div>zero-bit "+bv2.charAt(6)+" ≠ 1 ? "
						+(bv2.charAt(6)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","","","","","R",""]})
			break;
			case "BPL":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Result Minus<br>"
					s +="<div>negative-bit "+bv2.charAt(0)+" ≠ 1 ? "
						+(bv2.charAt(0)!="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["R","","","","","","",""]})
			break;
			case "BRK":
				s = "Force Break<br>"
				// TODO
				// interrupt,push PC+2, push SR
			break;
			case "BVC":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Overflow Clear<br>"
					s +="<div>overflow-bit "+bv2.charAt(7)+" = 0 ? "
						+(bv2.charAt(7)=="0" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","","","","","","R"]})
			break;
			case "BVS":
					var bv = getReg("SR").toString(2);
					var bv2 = ("0000000"+bv).substring(bv.length-1,bv.length+7)
					s = "Branch on Overflow Set<br>"
					s +="<div>overflow-bit "+bv2.charAt(7)+" = 1 ? "
						+(bv2.charAt(7)=="1" ? ("jump "+(129-(parseInt(ops[1],16)^127))):"CONTINUE")+"</div>"
					s += StatusRegister({"rw":["","","","","","","","R"]})
			break;
			case "CLC":
			s = "Clear carry flag<br>"
			s+= "C = 0"
			s+= StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "CLD":
			s = "Clear decimal flag<br>"
			s+= "D = 0"
			s+= StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "CLI":
			s = "Clear interrupt disable bit<br>"
			s+= "I = 0"
			s+= StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "CLV":
			s = "Clear overflow flag<br>"
			s+= "V = 0"
			s+= StatusRegister({"rw":["","W","","","","","",""]});
			break;
			case "CMP":
			s = "Compare"
			var opc ={"C9":"imm","C5":"zpg","D5":"zpx","CD":"abs","DD":"abx","D9":"aby","C1":"inx","D1":"iny"};
			s +=" - ["+opc[ops[0]]+"]<br>"
			s += "A<sub>"+nreg.AC+"h</sub> = "+AddressingModeTmpl(opc[ops[0]],nreg)+" ?<br>\r\n"
			s += StatusRegister({"rw":["W","","","","","","W","W"]});
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
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+AddressingModeTmpl(opc[ops[0]],nreg)+"-1<br>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEX":
				s = "Decrement X Register<br>"
				s +="<div>X = "+nreg.YR+"h-1</div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "DEY":
				s = "Decrement Y Register<br>"
				s +="<div>Y = "+nreg.YR+"h-1</div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "EOR":
			s = "Exclusive-OR"
			var opc ={"49":"imm","45":"zpg","55":"zpx","4D":"abs","5D":"abx","59":"aby","41":"inx","51":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> ⊕ "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
			s += BitGrid({"value":getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			s += BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "INC":
				s = "Increment"
				var opc ={"E6":"zpg","F6":"zpx","EE":"abs","FE":"abx"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "[$"+nreg.ops[2]+nreg.ops[1]+"] = "+AddressingModeTmpl(opc[ops[0]],nreg)+"+1<br>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INX":
				s = "Increment X Register<br>"
				s +="<div>X = "+nreg.XR+"h+1</div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "INY":
				s = "Increment Y Register<br>"
				s +="<div>Y = "+nreg.YR+"h+1</div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "JMP":
				if(typeof(opc)=="undefined") s = "Jump"
				var opc ={"4C":"abs","6C":"ind"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "PC = "+AddressingModeTmpl(opc[ops[0]],nreg)//.split("<sub>#")[0]
			break;
			case "JSR":
				if(typeof(opc)=="undefined") s = "Jump Subroutine"
				var opc ={"20":"abs"};
				s +=" - ["+opc[ops[0]]+"]<br>"
				s += "PC = "+AddressingModeTmpl(opc[ops[0]],nreg).split("<sub>#")[0]
				   +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-2<br>"
			break;
			case "LDY":
				if(typeof(opc)=="undefined") var opc = {"title":"Load Y Register","reg":"YR","A0":"imm","A4":"zpg","B4":"zpx","AC":"abs","BC":"abx"};
			case "LDX":
				if(typeof(opc)=="undefined") var opc = {"title":"Load X Register","reg":"XR","A2":"imm","A6":"zpg","B6":"zpy","AE":"abs","BE":"aby"};
			case "LDA":

// 621C (274)

				if(typeof(opc)=="undefined") var opc = {"title":"Load Accumulator","reg":"AC","A9":"imm","A5":"zpg","B5":"zpx","AD":"abs","BD":"abx","B9":"aby","A1":"inx","B1":"iny"};
				s+=opc.title+" - ["+opc[ops[0]]+"]<br>"
				s += instr.slice(-1)+"<sub>"+getHexByte(getReg(opc.reg))+"h</sub> = "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				s += StatusRegister({"rw":["W","","","","","","W",""]});
			break;
			case "LSR":
				s = "Logical Shift Right"
				var opc ={"4A":"acc","46":"zpg","56":"zpx","4E":"abs","5E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = >> "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = BitUnit( {"value":0,"class":"regbyte_green"} )+"<div>&#x2B95;</div>"
				var postfix = "<div>&#x2B95;</div>"+BitUnit( {"value":getReg("AC")&1,"reg":"carry"} )
				s += BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "NOP":
				s = "No operation"
			break;
			case "ORA":
			s = "Exclusive-OR"
			var opc ={"09":"imm","05":"zpg","15":"zpx","0D":"abs","1D":"abx","19":"aby","01":"inx","11":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> | "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>\r\n"
			s += BitGrid({"value":getReg("AC").toString(2),"postfix":"&nbsp;<small>"+nreg.AC+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			s += BitGrid({"value":nreg["mem"].toString(2),"postfix":"&nbsp;<small>"+getHexByte(nreg["mem"])+"h</small>","height":18,"rnames":[""],"rw":["","","","","","","",""]});
			break;
			case "PHA":
			s = "Push Accumulator on Stack<br>"
			s += "[$1"+nreg.SP+"]<sub>"+getHexByte(ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = A<sub>"+nreg.AC+"h</sub>"
				 +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>"
			break;
			case "PHP":
			s = "Push Processor Status on Stack<br>"
			s += "[$1"+nreg.SP+"]<sub>"+getHexByte(ByteAt(parseInt("1"+nreg.SP,16)))+"h</sub> = PS<sub>"+nreg.SR+"h</sub>"
				 +"&nbsp;SP = SP<sub>"+nreg.SP+"h</sub>-1<br>"
			break;
			case "PLA":
			s = "Pull Accumulator from Stack<br>"
			s += "SP = SP<sub>"+nreg.SP+"h</sub>+1"
			s += "&nbsp;A<sub>"+nreg.AC+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+getHexByte(ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>"
			break;
			case "PLP":
			s = "Pull Processor Status from Stack<br>"
			s += "SP = SP<sub>"+nreg.SP+"h</sub>+1"
			s += "&nbsp;PS<sub>"+nreg.SR+"h</sub> = [$"+(parseInt(nreg.SP,16)+256+1).toString(16).toUpperCase()+"]<sub>"+getHexByte(ByteAt(parseInt("1"+nreg.SP,16)+1))+"h</sub>"
			s += StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "ROL":
				s = "Rotate Left"
				var opc ={"2A":"acc","26":"zpg","36":"zpx","2E":"abs","3E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = << "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = BitUnit( {"value":getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B05;</div>"
				var postfix = "<div>&#x2B05;</div>"+BitUnit( {"value":getReg("SR")&1,"reg":"carry"} )
				s += BitGrid({"pretfix":prefix,"postfix":postfix,"height":18,"value":getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += StatusRegister({"rw":["W","W","W","","","","",""]});
			break;
			case "ROR":
				s = "Rotate Right"
				var opc ={"6A":"acc","66":"zpg","76":"zpx","6E":"abs","7E":"abx"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				//s += "A = >> "+AddressingModeTmpl(opc[ops[0]],nreg)+"<br>"
				var prefix = BitUnit( {"value":getReg("SR")&1,"reg":"carry"} )+"<div>&#x2B95;</div>"
				var postfix = "<div>&#x2B95;</div>"+BitUnit( {"value":getReg("SR")&1,"reg":"carry"} )
				s += BitGrid({"prefix":prefix,"postfix":postfix,"height":18,"value":getReg("AC").toString(2),"rw":["","","","","","","",""]});
				s += StatusRegister({"rw":["W","","","","","","W","W"]});
			break;
			case "RTI":
			  s = "Return from Interrupt<br>"
				// TODO PULL SR ???
				s+= "PC = [$1"+getHexByte(getReg("SP")+1)+"]<sub>"+getHexWord(ByteAt(getReg("SP")+256+1)+ByteAt(getReg("SP")+256+2)*256+1)+"h</sub>"
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>"
				 s += StatusRegister({"rw":["W","W","W","W","W","W","W","W"]});
			break;
			case "RTS":
			  s = "Return from subroutine<br>"
				s+= "PC = [$1"+getHexByte(getReg("SP")+1)+"]<sub>"+getHexWord(ByteAt(getReg("SP")+256+1)+ByteAt(getReg("SP")+256+2)*256+1)+"h</sub>"
				 +"<br>SP<sub>"+nreg.SP+"h</sub> = SP+2<br>"
			break;
			case "SBC":
			s = "Substract with borrow"
			var opc ={"E9":"imm","E5":"zpg","F5":"zpx","ED":"abs","FD":"abx","E9":"aby","E1":"inx","F1":"iny"};
			s+=" - ["+opc[ops[0]]+"]<br>"
			s += "A = A<sub>"+nreg.AC+"h</sub> - "+AddressingModeTmpl(opc[ops[0]],nreg)+" - C<sub>"+(getReg("SR")&1)+"</sub><br>"
			break;
			case "SEC":
			s = "Set carry flag<br>"
			s+= "C = 1"
			s+= StatusRegister({"rw":["","","","","","","","W"]});
			break;
			case "SED":
			s = "Set decimal flag<br>"
			s+= "D = 1"
			s += StatusRegister({"rw":["","","","","W","","",""]});
			break;
			case "SEI":
			s = "Set interrupt disable flag<br>"
			s+= "I = 1"
			s += StatusRegister({"rw":["","","","","","W","",""]});
			break;
			case "STA":
				s = "Store Accumulator"
				var opc ={"85":"zpg","95":"zpx","8D":"abs","9D":"abx","99":"aby","81":"inx","91":"iny"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.AC+"h</sub><br>"
			break;
			case "STX":
				s = "Store X"
				var opc ={"86":"zpg","96":"zpy","8E":"abs"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.XR+"h</sub><br>"
			break;
			case "STY":
				s = "Store Y"
				var opc ={"84":"zpg","94":"zpx","8C":"abs"};
				s+=" - ["+opc[ops[0]]+"]<br>"
				s += AddressingModeTmpl(opc[ops[0]],nreg)+" = A<sub>"+nreg.YR+"h</sub><br>"
			break;
			case "TAX":
				s = "Transfer Accumulator to X<br>"
				s +="<div>X = A<sub>"+nreg.AC+"h<sub></div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TAY":
				s = "Transfer Accumulator to Y<br>"
				s +="<div>Y = A<sub>"+nreg.AC+"h<sub></div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TSX":
			  s = "Transfer stack pointer to X"
				s +="<div>X = SP<sub>"+nreg.SP+"h<sub></div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TXA":
				s = "Transfer X to Accumulator<br>"
				s +="<div>A = X<sub>"+nreg.XR+"h<sub></div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			case "TXS":
			  s = "Transfer X to stack pointer"
				s +="<div>SP = X<sub>"+nreg.XR+"h<sub></div>"
			break;
			case "TYA":
				s = "Transfer Y to Accumulator<br>"
				s +="<div>A = Y<sub>"+nreg.YR+"h<sub></div>"
				s += StatusRegister({"rw":["W","","","","","","W",""]})
			break;
			default:
					s = "";
		}
		writeDisplay(dd,s);

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

// END - DISASSEMBLE /////////////////////////////////////////////////////

function memLookup() {
	var v=prompt('Please enter an address (0000-FFFF):');
	if (v==null) return;
	if (v=='') v=0;
	var m=parseInt(v,16);
	if (isNaN(m)) {
		alert('Sorry:\n"'+v+'" is not a valid hex number!');
	}
	else {
		m=Math.abs(Math.floor(m))&0xfff0;
		var s='';
		var b1=getHexWord(m);
		var b2=getHexWord(m+15);
		s+=b1+': ';
		for (var i=0; i<16; i++) {
			s+=getHexByte(ByteAt(m+i));
			if (i==7) {
				s+='\n'+getHexWord(m+8)+': ';
			}
			else if (i<15) {
				s+=' ';
			}
		}
		alert('Memory at '+b1+'-'+b2+':\n \n'+s);
	}
}

function showMem() {
	var showASCII=document.getElementById('showASCII').checked
	//var showASCII=document.MemLoader.showASCII.checked;
	var addr=parseInt(document.getElementById('memAddr').value,16)
	//var addr=parseInt(document.MemLoader.memAddr.value,16);
	if (isNaN(addr)) {
		alert('Sorry:\n"'+v+'" is not a valid hex number!');
	}
	else {
		addr=Math.abs(Math.floor(addr))&0xffff;
		var s='';
		var s2='';
		for (var k=0; k<8; k++) {
			for (var i=0; i<16; i++) {
				var da=addr+i;
				if (da>0xffff) {
					//document.MemLoader.mem.value=s+'\n';
					document.getElementById('mem').value=s+'\n';
					return
				}
				if (i%8==0) s+=':'+getHexWord(da)+'  ';
				var b=ByteAt(da);
				s+=getHexByte(b);
				if (showASCII) {
					s2+= ((b>=32) && (b<=126))? String.fromCharCode(b) : '.';
				}
				if ((i==7) || (i==15)) {
					if (showASCII) {
						s+='  ; '+s2
						s2='';
					}
					if ((k<7) || (i<15)) s+='\n';
				}
				else s+=' ';
			}
			addr+=16
		}
		//document.MemLoader.mem.value=s;
		document.getElementById('mem').value=s;
	}
}

function loadMem() {


	var addr = parseInt(document.getElementById('memAddr').value,16)
	//var addr=parseInt(document.MemLoader.memAddr.value,16);

	if (isNaN(addr)) {
		alert('Sorry:\n"'+v+'" is not a valid hex number!');
	}
	else {
		addr=Math.abs(Math.floor(addr))&0xffff;
		document.getElementById('mem').value = document.getElementById('mem').value.replace(/;/g,"").toUpperCase();
		var mem = document.getElementById('mem').value
		var mem_arr = mem.split(":");

		// LOAD INTO MEMORY LINE PER LINE
		for(var i=0;i<mem_arr.length;i++)
		{
			var p2 = mem_arr[i].slice(-4);
			var p1 = mem_arr[i].substring(0,mem_arr[i].length);  // FVD er stond mem_arr[i].length-4 ?
			if(p1.length>0) { loadData(addr,p1) }
			if(p2.indexOf(" ")<0)  addr=Math.abs(Math.floor(parseInt(p2,16)))&0xffff;
		}
		//loadData(addr,document.getElementById('mem').value)
		//loadData(addr,document.MemLoader.mem.value);
	}
	loadWatch();
	updateWatch();
}

// load symbols from RAM
function loadWatch()
{
	// asm.endsym_addr = last address of debug symbol space
	var bDebug = false;
	//var sym_string = document.getElementById("watchparam2").value
	asm.symlink = new Array();

	var maxwatch = 256 * 6;  // assume maximum 256 labels
	if(getHexByte(RAM[asm.endsym_addr])!="FF") return;
	for(var i=asm.endsym_addr-1;i>asm.endsym_addr-maxwatch;i-=6)
	{
		var w2 = getHexWord(RAM[i-1]*256+RAM[i]);        // ADDRESS
		if(w2=="FAFF") { i=0; continue; };
		var w1 = getHexWord(RAM[i-5]*256+RAM[i-4]) + getHexWord(RAM[i-3]*256+RAM[i-2]);
		var lbl = conv_bck(w1,{"dbg":false,"slen":6,"glen":3,"wlen":4,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF
		if(bDebug) document.write(lbl+"["+w1+"] $"+w2+"<br>");
		asm.symlink[parseInt(w2,16)] = lbl
	}
}


// SEARCH FOR DEBUG SIGNATURES
// LAST BYTE = FF
// BEFORE THAT: ONE BYTE PAIR
//     >< FAFF  stop if found the impossible symbol
// ADDITIONAL: SEARCH FOR DEBUGGER CODE BY 16-BIT CHECKSUM ?
///////////////////////////////////

function load_debug_signature(mem)
{
	var bDebug = false;
	var mem_arr = mem.replace(/ /g,"").split(":");
	var l = mem_arr.length;
	mem = l>1?"":mem.replace(/ /g,"");
	for(var i=1;i<l;i++)
		mem += mem_arr[i].substring(0,mem_arr[i].length-(i==l-1?0:4));

	if(bDebug) document.write(mem+"<br>");   // PRINT ALL

	mem += ""; Sig = mem.length;
	for(var i=mem.length;i>=0;i-=12)
	{
		var w2 = mem.substring(i-4,i);      // ADDRESS
		if(i==mem.length) { if (w2.slice(-2)!="FF") i=0; else {i-=2; w2 = mem.substring(i-4,i) } }
		else if(w2=="FAFF") {Sig=i-0; i=0; continue };
		var w1 = mem.substring(i-12,i-4);   // LABEL

		var lbl = conv_bck(w1,{"dbg":false,"slen":6,"glen":3,"wlen":4,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF
		if(bDebug) document.write(lbl+" $"+w2+"<br>");
	}
	if(bDebug) document.write("<br>"+Sig+"<br><hr><br>")

/*
	for(var i=Sig;i<mem.length-12;i+=12)
	{
		var w1 = mem.substring(i,i+8);      // LABEL
		var w2 = mem.substring(i+8,i+12);   // ADDRESS
		var lbl = conv_bck(w1,{"dbg":false,"slen":6,"glen":3,"blen":2,"defc":"_","c":"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .-_"}) // max = F9FF

		document.write(lbl+" $"+w2+"<br>");
	}
*/
}

// MOVE TO 6502gui.js !!!!!!!!!!!!
function load_adr(obj)
{
	var u = obj.innerHTML.substring(0,49);
	var v = obj.innerHTML.substring(49,obj.innerHTML.length);
	// LOAD OBJECT CODE INTO MEMORY
	var mem = document.getElementById('debugfield').innerHTML.replace(/<[^>]*>/g,'');
	load_debug_signature(mem);
	var m = mem.match(/[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][:]/)

	if(m==null) m = "6000";
	else m =(""+m).substring(0,4)
	if(v=="addr") v=m; else v=v.substring(1,v.length);
	var i = prompt("Please enter start address (HEX)", v);
	if(i==null) return;
	obj.innerHTML = u+"$"+i;
	//alert(i)
	document.getElementById("memAddr").value = i;

	// LOAD MEMORY
	document.getElementById('mem').value=mem;
	loadMem();
	//alert('Memory loaded.')

	// SET PROGRAM COUNTER
	document.getElementById('dispPC').innerHTML = i;
	v=parseInt(i,16);
	if (isNaN(v)) return;
	v=Math.abs(Math.floor(v));
	v&=0xffff
	setReg("PC",v);
	updateReg("PC");
	disassemble();

}

function conv_bck(inp,s)
{
	if(s.dbg) document.write("conv_bck:"+inp+"<br>");
	var l = s.c.length;
	for(var i=inp.length-s.wlen,str="";i>=0;i-=s.wlen)
	{
		var w = parseInt(inp.substring(i,i+s.wlen),16);
		str=oBASE.convert(inp.substring(i,i+s.wlen),["0123456789ABCDEF"],[s.c])+str;
		//for(var j=0;j<(s.glen);j++) { str = s.c.charAt(w % l) + str; w /= l; }
	}
	return str.replace(/^\s+|\s+$/g,'');
}


function loadData(addr,data) {
	window.status='loading data to '+getHexWord(addr)+' ...';
	var lc='';
	var ofs=0;
	var mode=1;
	data=data.toUpperCase();
	for (var i=0; i<data.length; i++) {
		var c=data.charAt(i);
		if (mode==2) { if ((c=='\r') || (c=='\n')) mode=1; }
		else if (((c>='0') && (c<='9')) || ((c>='A') && (c<='F'))) {
			if (mode==1) {
				if (lc) {
					RAM[addr++]=parseInt(lc+c,16);
					if (addr>0xffff) break;
					lc='';
				}
				else lc=c;
			}
		}
		else if (c==':') mode=0;
		else if (c==';') mode=2;
		else mode=1;
	}
	asm.endsym_addr = addr-1;  // last address of debug symbol space
	window.status='ready.';
}

function toggleASCII() {
	//var showASCII=document.forms.MemLoader.showASCII;
	var showASCII=document.getElementById('showASCII')
	showASCII.checked=(!showASCII.checked);
}

function loadRom(addr,data) {
	window.status='loading data to '+getHexWord(addr)+' ...';
	var ofs=0;
	for (var i=0; i<data.length; i+=2) {
		RAM[addr++]=parseInt(data.charAt(i)+data.charAt(i+1),16);
	}
	window.status='ready.';
}

function loadC64Roms() {
	if (confirm('Sure to load C64 ROMs?\nMemory transfer could take some time ...')) {
		if ((self.c64loader) && (self.c64loader.location)) {
			self.c64loader.location.href='c64ROMs/romloader.html';
		}
		else {
			alert('Sorry.\nIFRAME not found.');
		}
	}
}

function loadApple2PlusRoms(str) {
	if(str="DBG")
	{
		var addr = parseInt("D000",16);
		//var data = apple2Rom;
		window.status='loading data to '+getHexWord(addr)+' ...';
		for (var i=0; i<apple2Rom.length; i++)
			RAM[addr++]=0x60;
		window.status='ready.';
		return;
	}

	if (confirm('Sure to load Apple II+ ROMs?\nMemory transfer could take some time ...'))
	{
		var addr = parseInt("D000",16);
		var data = apple2Rom;
		window.status='loading data to '+getHexWord(addr)+' ...';
		for (var i=0; i<apple2Rom.length; i++)
		{
			//document.write((i%8==0?("<br>"+getHexWord(addr)+": "):" ")+getHexByte(apple2Rom[i]))
			RAM[addr++]=apple2Rom[i];
		}
		window.status='ready.';
  }
	else alert('Canceled');
}

function Apple2PlusZP() {

var crlf = "\r\n"
var s = "$00-$05 - ???"+crlf
+"$06-$09 - Free Space"+crlf
+"$0A-$0C - JMP to USR() User Function Routine"+crlf
+"$0D-$17 - ???"+crlf
+"$18     - First Data Track"+crlf
+"$19     - First Data Sector"+crlf
+"$1A-$1B - Shape Pointer for DRAW"+crlf
+"$1C     - Last COLOR Used"+crlf
+"$1D-$1E - Free Space"+crlf
+"$1F     - ???"+crlf
+"$20     - Left Margin (0 - 39/79, 0 is default)"+crlf
+"$21     - Width (1 - 40/80, 40 is default, 0 crashes Applesoft)"+crlf
+"$22     - Top Margin (0 - 23, 0 is default, 20 in graphics mode)"+crlf
+"$23     - Bottom Margin (0 - 23, 23 is default)"+crlf
+"$24     - Horizontal Cursor Position (0 - 39/79)"+crlf
+"$25     - Vertical Cursor Position (0 - 23)"+crlf
+"$26-$27 - Address of Byte Containing X,Y"+crlf
+"$28-$29 - Base Address of Text Cursor's Position"+crlf
+"$2A     - ???"+crlf
+"$2B     - Boot Slot * 16"+crlf
+"$2C     - Lo-Res HLIN/VLIN Endpoint"+crlf
+"$2D-$2F - ???"+crlf
+"$30     - COLOR Value * 17"+crlf
+"$31     - ???"+crlf
+"$32     - Text Mask ($FF = Normal, $7F = Inverse, $3F = Flashing)"+crlf
+"$33     - Prompt Character"+crlf
+"$34-$35 - ???"+crlf
+"$36-$37 - Address of Output Routine"+crlf
+"$38-$39 - Address of Input Routine"+crlf
+"$3A-$4F - ???"+crlf
+"$50-$51 - Result of the Conversion of the FAC to a 16-Bit Integer"+crlf
+"$52-$66 - ???"+crlf
+"$67-$68 - Address of Beginning of BASIC Program ($0801 is default)"+crlf
+"$69-$6A - Address of Beginning of BASIC Variables"+crlf
+"$6B-$6C - Address of Beginning of BASIC Arrays"+crlf
+"$6D-$6E - Address of End of BASIC Variables"+crlf
+"$6F-$70 - Address of End of String Data"+crlf
+"$71-$72 - Address to Move String To"+crlf
+"$73-$74 - Address of Beginning of String Data"+crlf
+"$75-$76 - Current Line Number Being Executed"+crlf
+"$77-$78 - Line Number Where END or STOP or BREAK Occurred"+crlf
+"$79-$7A - Address of Line Number Being Executed"+crlf
+"$7B-$7C - Current Address of DATA"+crlf
+"$7D-$7E - Next Address of DATA"+crlf
+"$7F-$80 - Address of Input or Data"+crlf
+"$81-$82 - Last Used Variable's Name"+crlf
+"$83-$84 - Last Used Variable's Address"+crlf
+"$85-$9A - ???"+crlf
+"$9B-$9C - Pointer for $D61A and $F7D9"+crlf
+"$9D-$A3 - Floating Point Accumulator (FAC)"+crlf
+"$A4     - ???"+crlf
+"$A5-$AB - Floating Point Argument Register (ARG)"+crlf
+"$AC-$AE - ???"+crlf
+"$AF-$B0 - Address of End of BASIC Program"+crlf
+"$B1-$B6 - Subroutine to Increase the String Data Pointer"+crlf
+"$B7-$BE - Subroutine to Return the Character Pointed to by the String Data Pointer"+crlf
+"$BF-$CD - ???"+crlf
+"$CE-$CF - Free Space"+crlf
+"$D0-$D3 - ???"+crlf
+"$D4     - Error Code Flag"+crlf
+"$D5-$D6 - ???"+crlf
+"$D7     - Free Space"+crlf
+"$D8     - Error Flag (Bit 7 Set if an Error Handler is Used)"+crlf
+"$D9     - ???"+crlf
+"$DA-$DB - Line Number Where Error Occurred"+crlf
+"$DC-$DD - ???"+crlf
+"$DE     - Error Code"+crlf
+"$DF     - ???"+crlf
+"$E0-$E1 - Horizontal Coordinate of HPLOT"+crlf
+"$E2     - Vertical Coordinate of HPLOT"+crlf
+"$E3     - Free Space"+crlf
+"$E4     - HCOLOR Value (0=0, 1=42, 2=85, 3=127, 4=128, 5=170, 6=213, 7=255)"+crlf
+"$E5     - ???"+crlf
+"$E6     - High Byte of Address of First Byte of Where HGR is Plotted"+crlf
+"$E7     - SCALE Value (0 = 256)"+crlf
+"$E8-$E9 - Address of Shape Table"+crlf
+"$EA     - DRAW/XDRAW Collision Count"+crlf
+"$EB-$EF - Free Space"+crlf
+"$F0     - ???"+crlf
+"$F1     - SPEED Value (Subtracted From 256)"+crlf
+"$F2     - ???"+crlf
+"$F3     - Text OR Mask for Flashing Text"+crlf
+"$F4-$F5 - Address of Error Handler (Line Number after ONERR GOTO)"+crlf
+"$F6-$F8 - ???"+crlf
+"$F9     - ROT Value"+crlf
+"$FA-$FE - Free Space"+crlf
+"$FF     - Used by Applesoft's STR$ Function"+crlf

alert(s)

}

function RAM_checksum()
{
	var chks = new Array(256);
	var idx = 0;
	for (var i=0; i<65536; i+=256)
	{

		var sum =       (!RAM[i+0]?0:RAM[i+0])+(!RAM[i+1]?0:RAM[i+1])+(!RAM[i+2]?0:RAM[i+2])+(!RAM[i+3]?0:RAM[i+3])+
										(!RAM[i+4]?0:RAM[i+4])+(!RAM[i+5]?0:RAM[i+5])+(!RAM[i+6]?0:RAM[i+6])+(!RAM[i+7]?0:RAM[i+7])+
								(!RAM[i+8]?0:RAM[i+8])+(!RAM[i+9]?0:RAM[i+9])+(!RAM[i+10]?0:RAM[i+10])+(!RAM[i+11]?0:RAM[i+11])+
						(!RAM[i+12]?0:RAM[i+12])+(!RAM[i+13]?0:RAM[i+13])+(!RAM[i+14]?0:RAM[i+14])+(!RAM[i+15]?0:RAM[i+15])+
						(!RAM[i+16]?0:RAM[i+16])+(!RAM[i+17]?0:RAM[i+17])+(!RAM[i+18]?0:RAM[i+18])+(!RAM[i+19]?0:RAM[i+19])+
						(!RAM[i+20]?0:RAM[i+20])+(!RAM[i+21]?0:RAM[i+21])+(!RAM[i+22]?0:RAM[i+22])+(!RAM[i+23]?0:RAM[i+23])+
						(!RAM[i+24]?0:RAM[i+24])+(!RAM[i+25]?0:RAM[i+25])+(!RAM[i+26]?0:RAM[i+26])+(!RAM[i+27]?0:RAM[i+27])+
						(!RAM[i+28]?0:RAM[i+28])+(!RAM[i+29]?0:RAM[i+29])+(!RAM[i+30]?0:RAM[i+30])+(!RAM[i+31]?0:RAM[i+31])+
						(!RAM[i+32]?0:RAM[i+32])+(!RAM[i+33]?0:RAM[i+33])+(!RAM[i+34]?0:RAM[i+34])+(!RAM[i+35]?0:RAM[i+35])+
						(!RAM[i+36]?0:RAM[i+36])+(!RAM[i+37]?0:RAM[i+37])+(!RAM[i+38]?0:RAM[i+38])+(!RAM[i+39]?0:RAM[i+39])+
						(!RAM[i+40]?0:RAM[i+40])+(!RAM[i+41]?0:RAM[i+41])+(!RAM[i+42]?0:RAM[i+42])+(!RAM[i+43]?0:RAM[i+43])+
						(!RAM[i+44]?0:RAM[i+44])+(!RAM[i+45]?0:RAM[i+45])+(!RAM[i+46]?0:RAM[i+46])+(!RAM[i+47]?0:RAM[i+47])+
						(!RAM[i+48]?0:RAM[i+48])+(!RAM[i+49]?0:RAM[i+49])+(!RAM[i+50]?0:RAM[i+50])+(!RAM[i+51]?0:RAM[i+51])+
						(!RAM[i+52]?0:RAM[i+52])+(!RAM[i+53]?0:RAM[i+53])+(!RAM[i+54]?0:RAM[i+54])+(!RAM[i+55]?0:RAM[i+55])+
						(!RAM[i+56]?0:RAM[i+56])+(!RAM[i+57]?0:RAM[i+57])+(!RAM[i+58]?0:RAM[i+58])+(!RAM[i+59]?0:RAM[i+59])+
						(!RAM[i+60]?0:RAM[i+60])+(!RAM[i+61]?0:RAM[i+61])+(!RAM[i+62]?0:RAM[i+62])+(!RAM[i+63]?0:RAM[i+63])+
						(!RAM[i+64]?0:RAM[i+64])+(!RAM[i+65]?0:RAM[i+65])+(!RAM[i+66]?0:RAM[i+66])+(!RAM[i+67]?0:RAM[i+67])+
						(!RAM[i+68]?0:RAM[i+68])+(!RAM[i+69]?0:RAM[i+69])+(!RAM[i+70]?0:RAM[i+70])+(!RAM[i+71]?0:RAM[i+71])+
						(!RAM[i+72]?0:RAM[i+72])+(!RAM[i+73]?0:RAM[i+73])+(!RAM[i+74]?0:RAM[i+74])+(!RAM[i+75]?0:RAM[i+75])+
						(!RAM[i+76]?0:RAM[i+76])+(!RAM[i+77]?0:RAM[i+77])+(!RAM[i+78]?0:RAM[i+78])+(!RAM[i+79]?0:RAM[i+79])+
						(!RAM[i+80]?0:RAM[i+80])+(!RAM[i+81]?0:RAM[i+81])+(!RAM[i+82]?0:RAM[i+82])+(!RAM[i+83]?0:RAM[i+83])+
						(!RAM[i+84]?0:RAM[i+84])+(!RAM[i+85]?0:RAM[i+85])+(!RAM[i+86]?0:RAM[i+86])+(!RAM[i+87]?0:RAM[i+87])+
						(!RAM[i+88]?0:RAM[i+88])+(!RAM[i+89]?0:RAM[i+89])+(!RAM[i+90]?0:RAM[i+90])+(!RAM[i+91]?0:RAM[i+91])+
						(!RAM[i+92]?0:RAM[i+92])+(!RAM[i+93]?0:RAM[i+93])+(!RAM[i+94]?0:RAM[i+94])+(!RAM[i+95]?0:RAM[i+95])+
						(!RAM[i+96]?0:RAM[i+96])+(!RAM[i+97]?0:RAM[i+97])+(!RAM[i+98]?0:RAM[i+98])+(!RAM[i+99]?0:RAM[i+99])+
		(!RAM[i+100]?0:RAM[i+100])+(!RAM[i+101]?0:RAM[i+101])+(!RAM[i+102]?0:RAM[i+102])+(!RAM[i+103]?0:RAM[i+103])+
		(!RAM[i+104]?0:RAM[i+104])+(!RAM[i+105]?0:RAM[i+105])+(!RAM[i+106]?0:RAM[i+106])+(!RAM[i+107]?0:RAM[i+107])+
		(!RAM[i+108]?0:RAM[i+108])+(!RAM[i+109]?0:RAM[i+109])+(!RAM[i+110]?0:RAM[i+110])+(!RAM[i+111]?0:RAM[i+111])+
		(!RAM[i+112]?0:RAM[i+112])+(!RAM[i+113]?0:RAM[i+113])+(!RAM[i+114]?0:RAM[i+114])+(!RAM[i+115]?0:RAM[i+115])+
		(!RAM[i+116]?0:RAM[i+116])+(!RAM[i+117]?0:RAM[i+117])+(!RAM[i+118]?0:RAM[i+118])+(!RAM[i+119]?0:RAM[i+119])+
		(!RAM[i+120]?0:RAM[i+120])+(!RAM[i+121]?0:RAM[i+121])+(!RAM[i+122]?0:RAM[i+122])+(!RAM[i+123]?0:RAM[i+123])+
		(!RAM[i+124]?0:RAM[i+124])+(!RAM[i+125]?0:RAM[i+125])+(!RAM[i+126]?0:RAM[i+126])+(!RAM[i+127]?0:RAM[i+127])+
		(!RAM[i+128]?0:RAM[i+128])+(!RAM[i+129]?0:RAM[i+129])+(!RAM[i+130]?0:RAM[i+130])+(!RAM[i+131]?0:RAM[i+131])+
		(!RAM[i+132]?0:RAM[i+132])+(!RAM[i+133]?0:RAM[i+133])+(!RAM[i+134]?0:RAM[i+134])+(!RAM[i+135]?0:RAM[i+135])+
		(!RAM[i+136]?0:RAM[i+136])+(!RAM[i+137]?0:RAM[i+137])+(!RAM[i+138]?0:RAM[i+138])+(!RAM[i+139]?0:RAM[i+139])+
		(!RAM[i+140]?0:RAM[i+140])+(!RAM[i+141]?0:RAM[i+141])+(!RAM[i+142]?0:RAM[i+142])+(!RAM[i+143]?0:RAM[i+143])+
		(!RAM[i+144]?0:RAM[i+144])+(!RAM[i+145]?0:RAM[i+145])+(!RAM[i+146]?0:RAM[i+146])+(!RAM[i+147]?0:RAM[i+147])+
		(!RAM[i+148]?0:RAM[i+148])+(!RAM[i+149]?0:RAM[i+149])+(!RAM[i+150]?0:RAM[i+150])+(!RAM[i+151]?0:RAM[i+151])+
		(!RAM[i+152]?0:RAM[i+152])+(!RAM[i+153]?0:RAM[i+153])+(!RAM[i+154]?0:RAM[i+154])+(!RAM[i+155]?0:RAM[i+155])+
		(!RAM[i+156]?0:RAM[i+156])+(!RAM[i+157]?0:RAM[i+157])+(!RAM[i+158]?0:RAM[i+158])+(!RAM[i+159]?0:RAM[i+159])+
		(!RAM[i+160]?0:RAM[i+160])+(!RAM[i+161]?0:RAM[i+161])+(!RAM[i+162]?0:RAM[i+162])+(!RAM[i+163]?0:RAM[i+163])+
		(!RAM[i+164]?0:RAM[i+164])+(!RAM[i+165]?0:RAM[i+165])+(!RAM[i+166]?0:RAM[i+166])+(!RAM[i+167]?0:RAM[i+167])+
		(!RAM[i+168]?0:RAM[i+168])+(!RAM[i+169]?0:RAM[i+169])+(!RAM[i+170]?0:RAM[i+170])+(!RAM[i+171]?0:RAM[i+171])+
		(!RAM[i+172]?0:RAM[i+172])+(!RAM[i+173]?0:RAM[i+173])+(!RAM[i+174]?0:RAM[i+174])+(!RAM[i+175]?0:RAM[i+175])+
		(!RAM[i+176]?0:RAM[i+176])+(!RAM[i+177]?0:RAM[i+177])+(!RAM[i+178]?0:RAM[i+178])+(!RAM[i+179]?0:RAM[i+179])+
		(!RAM[i+180]?0:RAM[i+180])+(!RAM[i+181]?0:RAM[i+181])+(!RAM[i+182]?0:RAM[i+182])+(!RAM[i+183]?0:RAM[i+183])+
		(!RAM[i+184]?0:RAM[i+184])+(!RAM[i+185]?0:RAM[i+185])+(!RAM[i+186]?0:RAM[i+186])+(!RAM[i+187]?0:RAM[i+187])+
		(!RAM[i+188]?0:RAM[i+188])+(!RAM[i+189]?0:RAM[i+189])+(!RAM[i+190]?0:RAM[i+190])+(!RAM[i+191]?0:RAM[i+191])+
		(!RAM[i+192]?0:RAM[i+192])+(!RAM[i+193]?0:RAM[i+193])+(!RAM[i+194]?0:RAM[i+194])+(!RAM[i+195]?0:RAM[i+195])+
		(!RAM[i+196]?0:RAM[i+196])+(!RAM[i+197]?0:RAM[i+197])+(!RAM[i+198]?0:RAM[i+198])+(!RAM[i+199]?0:RAM[i+199])+
		(!RAM[i+200]?0:RAM[i+200])+(!RAM[i+201]?0:RAM[i+201])+(!RAM[i+202]?0:RAM[i+202])+(!RAM[i+203]?0:RAM[i+203])+
		(!RAM[i+204]?0:RAM[i+204])+(!RAM[i+205]?0:RAM[i+205])+(!RAM[i+206]?0:RAM[i+206])+(!RAM[i+207]?0:RAM[i+207])+
		(!RAM[i+208]?0:RAM[i+208])+(!RAM[i+209]?0:RAM[i+209])+(!RAM[i+210]?0:RAM[i+210])+(!RAM[i+211]?0:RAM[i+211])+
		(!RAM[i+212]?0:RAM[i+212])+(!RAM[i+213]?0:RAM[i+213])+(!RAM[i+214]?0:RAM[i+214])+(!RAM[i+215]?0:RAM[i+215])+
		(!RAM[i+216]?0:RAM[i+216])+(!RAM[i+217]?0:RAM[i+217])+(!RAM[i+218]?0:RAM[i+218])+(!RAM[i+219]?0:RAM[i+219])+
		(!RAM[i+220]?0:RAM[i+220])+(!RAM[i+221]?0:RAM[i+221])+(!RAM[i+222]?0:RAM[i+222])+(!RAM[i+223]?0:RAM[i+223])+
		(!RAM[i+224]?0:RAM[i+224])+(!RAM[i+225]?0:RAM[i+225])+(!RAM[i+226]?0:RAM[i+226])+(!RAM[i+227]?0:RAM[i+227])+
		(!RAM[i+228]?0:RAM[i+228])+(!RAM[i+229]?0:RAM[i+229])+(!RAM[i+230]?0:RAM[i+230])+(!RAM[i+231]?0:RAM[i+231])+
		(!RAM[i+232]?0:RAM[i+232])+(!RAM[i+233]?0:RAM[i+233])+(!RAM[i+234]?0:RAM[i+234])+(!RAM[i+235]?0:RAM[i+235])+
		(!RAM[i+236]?0:RAM[i+236])+(!RAM[i+237]?0:RAM[i+237])+(!RAM[i+238]?0:RAM[i+238])+(!RAM[i+239]?0:RAM[i+239])+
		(!RAM[i+240]?0:RAM[i+240])+(!RAM[i+241]?0:RAM[i+241])+(!RAM[i+242]?0:RAM[i+242])+(!RAM[i+243]?0:RAM[i+243])+
		(!RAM[i+244]?0:RAM[i+244])+(!RAM[i+245]?0:RAM[i+245])+(!RAM[i+246]?0:RAM[i+246])+(!RAM[i+247]?0:RAM[i+247])+
		(!RAM[i+248]?0:RAM[i+248])+(!RAM[i+249]?0:RAM[i+249])+(!RAM[i+250]?0:RAM[i+250])+(!RAM[i+251]?0:RAM[i+251])+
		(!RAM[i+252]?0:RAM[i+252])+(!RAM[i+253]?0:RAM[i+253])+(!RAM[i+254]?0:RAM[i+254])+(!RAM[i+255]?0:RAM[i+255]);

		chks[idx++] = sum;
		//document.write("s="+sum+" ")
		//if(i%4==0) document.write("<br>")
		//document.write("(!RAM["+i+"]?0:RAM["+i+"])+");
	}
	alert(chks.join(" "))
	return chks;
}


function masterReset() {
	if (confirm('Reset all registers?')) resetProcessor();
}

function run() {
	if (confirm('Sure to start a continous run?\n(Stops on "BRK" or NOP"". Lengthy code will be prompted.)')) {
		runThrou=true;
		runStep=0;
		totalSteps=0;
		nopFlag=false;
		simStep();
	}
}

function debugReset()
{
	processorCycles = 0;
	dispwatch = "";
	updateReg();
	writeDisplay('dispStep',"");
	writeDisplay('watchdisp',"");
}

function singleStep() {
	runThrou=false;
	simStep();
}

function simStep() {
	processorLoop();
	updateReg();
	updateWatch();
	disassemble();
	// continous?
	if (runThrou) {
		runStep++;
		if(nopFlag)
		{
			alert('Virtual 6502: Interrupt\nHalted on "NOP".');
			return;
		}
		if (breakFlag) {
			alert('Virtual 6502: Interrupt\nHalted on "BRK".\nSee stack (0100-01FF) for details.');
			return;
		}
		if (runStep>maxRun) {
			totalSteps+=runStep;
			runStep=0;
			if (confirm('Virtual 6502: Lengthy code ('+totalSteps+' steps).\nContinue continous run?')==false) return;
		}
		setTimeout('simStep()',40);
	}
}


function DbgHelp()
{
return '  <p class=\"text\"> </p>\n'
+'\n'
+'      <h3>Instructions</h3>\n'
+'\n'
+'      <p class=\"text18\"> <br><b>The Display</b><br>\n'
+'      The display shows all (yes its all there is) registers of a 6502/6510 CPU:</p>\n'
+'      <table cellspacing=\"0\" cellpadding=\"3\" border=\"0\">\n'
+'      <tbody><tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">PC</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Program Counter</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">A</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Accumulator</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">X</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">X Register</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">Y</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Y Register</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">SR</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Status Register</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">SP</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Stack Pointer</td></tr>\n'
+'      </tbody></table>\n'
+'      <p class=\"text\">The status register (SR) holds the following flags (from bit 7 to 0):</p>\n'
+'      <table cellspacing=\"0\" cellpadding=\"3\" border=\"0\">\n'
+'      <tbody><tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">N</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Negative</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">V</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Overflow</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">–</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">ignored</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">B</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Break</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">D</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Decimal</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">I</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Interrupt (IRQ disable)</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">Z</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Zero</td></tr>\n'
+'      <tr><td class=\"text\">  </td><td class=\"text\" align=\"center\">C</td><td class=\"text\" nowrap=\"nowrap\">....</td><td class=\"text\">Carry</td></tr>\n'
+'      </tbody></table>\n'
+'      <p class=\"text18\">The line disassembler shows the current value of PC,\n'
+'      the content of the according memory address (the next instruction\n'
+'      followed by the operands, if any), and a disassembly of this\n'
+'      instruction.</p>\n'
+'      <p class=\"text18\">The cycle time display shows the ticks of exceeded CPU time (including extra cycles for branches page transitions).</p>\n'
+'\n'
+'      <p class=\"text18\"> <br><b>Setting the Registers</b><br>\n'
+'      Click a registers label to set its value.<br>\n'
+'      Click on a SR flag to flip its value.</p>\n'
+'\n'
+'      <p class=\"text18\"> <br><b>Memory</b><br>\n'
+'      The emulator implements 64 k of memory for the full 16 bit address range.<br>\n'
+'      The 6502\'s stack of 1 k range is located at 0100 to 01FF (hard wired).</p>\n'
+'\n'
+'      <p class=\"text18\"> <br><b>Accessing the Memory</b><br>\n'
+'      The button \"look up mem #\" offers a quick inspection of a 16 byte range around any address.<br>\n'
+'      You may enter any amount of hex code into the memory inspector\'s pane and load it to the specified start address.<br>Further\n'
+'       the memory inspector lets you inspect the memory in steps of 128 (0x80)\n'
+'       bytes (half page). You may alter the display\'s content and load it back\n'
+'       the emulator\'s memory. (Any figures prefixed by a colon \":\" are ignored\n'
+'       as line numbers.)<br>\n'
+'      The \"show ASCII\" option shows the according ASCII characters at the left\n'
+'       of each line (if applicable). Uncheck this when transfering memory to\n'
+'      the disassembler.<br>\n'
+'      Last there\'s an option to load the ROMs of the Commodore 64 (� CBM) to\n'
+'      the according addresses (A000-BFFF, D000-FFFF) – for all those who can\'t\n'
+'       help nostalgia. (Note: The emulator does not implement the C64\'s bank\n'
+'      switching feature.)</p>\n'
+'\n'
+'      <p class=\"text18\"> <br><b>About the Emulator</b><br>\n'
+'      The emulator is written in JavaScript and emulates a 65xx-family micro\n'
+'      processor unit that was the heart of so popular micro computers as the\n'
+'      Apple II (6502) or the Commedore 64 (6510). The most common types, the\n'
+'      6502 and 6510 processors, are basicly the same and share the same\n'
+'      instruction tables. (The 6510 varies from 6502 only in the\n'
+'      implementation of 6 I/O ports at addresses 0000 and 0001.)<br>\n'
+'      The emulator implements all legal instructions. Undefined opcodes are\n'
+'      ignored (treated as NOP, No OPeration, with cycle time 0) – no\n'
+'      pseudo-opcodes are implemented.<br>\n'
+'\n'
+'      <p class=\"text18\">The emulator\'s core is based on the 6510 emulation C\n'
+'      source by Earle F. Philhower III for his \"Commodore 64 Emulator\n'
+'      v0.3\" for Mac, � 1993-4, with some modification for exact cycle times.<br>\n'
+'       BCD arithmetics and V-flag behavior in 2016. Also, some more general,\n'
+'      shared code is used for some instructions in immediate addressing mode\n'
+'      (which were treated as special cases before in order to optimize\n'
+'      runtime).</p>\n'
+'\n'
+'      <p class=\"text18\">The 6502 CPU script and the underlying C source are free software and may be redistributed and/or modified\n'
+'      under the terms of the GNU General Public License as published by\n'
+'      the Free Software Foundation; either version 2 of the License, or\n'
+'      any later version.</p>\n'
+'\n'
}

onload=inialize;
// eof
// eof
