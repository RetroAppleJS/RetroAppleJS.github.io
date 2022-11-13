// Created in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// 6502gui.js


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

var oDASM = new DASM();
oDASM.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
oDASM.getHexByte = function(v) { h=this.hextab[v>>4]+this.hextab[v&0xf]; return h}
oDASM.ByteAt = function ByteAt(addr) { return RAM[addr] }
//oDASM.sym_search = function sym_search(op,adm) { return }
oDASM.sym_search = sym_search;
//oDASM.srcfield_bin = new Uint8Array(); 

var asm = oASM; 

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
	var prstr= (r=='PC')? getHexWord(pc) : getHexByte(oDASM.getReg(r));
	var v=prompt('Please enter a hex value for '+r+':', prstr);
	v=parseInt(v,16);
	if (isNaN(v)) return;
	v=Math.abs(Math.floor(v));
	if (r=='SR') v|=32;
	if (r=='PC') v&=0xffff
	else v&=255;
	setReg(r,v);
	updateReg(r);
	if (r=='PC') oDASM.disassemble();
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

	// TODO user generic function for that like oDASM.writeDisplay !!!
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
	//console.log("resetProcessor oDASM.disassemble()")
	//oDASM.disassemble();
}

function DBG_init() {
	console.log('DBG initializing ...');
	resetProcessor();
	loaded=true;
	console.log('DBG ready.');
}

function updateReg(r) {
	if (r==null) {
		updateReg('PC');
		updateReg('AC');
		updateReg('XR');
		updateReg('YR');
		updateReg('SR');
		updateReg('SP');
		oDASM.writeDisplay('dispCycles', 'total cycles: '+processorCycles+" <small>("+processorCycles/1000+"ms)<small>");
		return;
	}
	var obj;
	if (r=='PC') {
		oDASM.writeDisplay('dispPC',getHexWord(pc));
	}
	else {
		oDASM.writeDisplay('disp'+r,''+getHexByte(oDASM.getReg(r)));
	}
	if (r=='SR') {
		for (var i=0; i<8; i++) {
			var b=((flags&(1<<i))>0)? 1:0;
			oDASM.writeDisplay('dispSR'+i,b);
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

	oDASM.writeDisplay('watchdisp',dispwatch,"beforeend");
	oDASM.updateScroll('watchdisp');
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

		 oDASM.writeDisplay('disp'+r, hby);
	 }
// getMem
	 //oDASM.writeDisplay('disp'+r, getHexWord(pc));
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

function loadMem()
{
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
	oDASM.disassemble();

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
	console.log('DBG loading data to '+getHexWord(addr)+' ...');
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
	console.log('DBG ready.');
}

function toggleASCII() {
	//var showASCII=document.forms.MemLoader.showASCII;
	var showASCII=document.getElementById('showASCII')
	showASCII.checked=(!showASCII.checked);
}

function loadRom(addr,data) {
	console.log('DBG loading data to '+getHexWord(addr)+' ...');
	var ofs=0;
	for (var i=0; i<data.length; i+=2) {
		RAM[addr++]=parseInt(data.charAt(i)+data.charAt(i+1),16);
	}
	console.log('DBG ready.');
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
		console.log('DBG loading data to '+getHexWord(addr)+' ...');
		for (var i=0; i<apple2Rom.length; i++)
			RAM[addr++]=0x60;
		console.log('DBG ready.');
		return;
	}

	if (confirm('Sure to load Apple II+ ROMs?\nMemory transfer could take some time ...'))
	{
		var addr = parseInt("D000",16);
		var data = apple2Rom;
		console.log('DBG loading data to '+getHexWord(addr)+' ...');
		for (var i=0; i<apple2Rom.length; i++)
		{
			//document.write((i%8==0?("<br>"+getHexWord(addr)+": "):" ")+getHexByte(apple2Rom[i]))
			RAM[addr++]=apple2Rom[i];
		}
		console.log('DBG ready.');
  }
	else alert('Canceled');
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
	oDASM.writeDisplay('dispStep',"");
	oDASM.writeDisplay('watchdisp',"");
}

function singleStep() {
	runThrou=false;
	simStep();
}

function simStep() {
	processorLoop();
	updateReg();
	updateWatch();
	console.log("DBG simStep oDASM.disassemble()")
	oDASM.disassemble();
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


addLoadEvent(DBG_init);
// eof
