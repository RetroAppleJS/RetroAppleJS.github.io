/*
	6502 JavaScript emulator
	by N. Landsteiner  2005, e-tradion.net / masswerk.at

	derived from the c source by

    Earle F. Philhower III, Commodore 64 Emulator v0.3, (C) 1993-4

    extended for exact cycle times [N. Landsteiner, 2005]

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    For the GNU General Public License see the Free Software Foundation,
    Inc., 675 Mass Ave, Cambridge, MA 02139, USA.

    Thanks to "chip" for a bugfix in function BranchRelAddr().

    fixed a bug regarding byte ranges in functions opDECR and opINCR -
    thanks to James Larson for reporting. (2008-09-05)

    fixed V-flag according to http://www.6502.org/tutorials/vflag.html (2016)
    reimplemented BCD arithmetics, also some more shared code for immediate
    addressing (2016)
*/

// global conf

var debug=false;
var externalLoop=true;
var stopOnIterrupt=true;

// constants

var ResetTo = 0xfffc;
var IrqTo   = 0xfffe;
var NMITo   = 0xfffa;

var fCAR = 1;
var fZER = 2;
var fINT = 4;
var fDEC = 8;
var fBKC = 16;
var fOVF = 64;
var fNEG = 128;

// regs & memory

var a, x, y, flags, sp, pc;
var RAM=[];
var memory=RAM; // pointer to RAM
var breakFlag=false;
var nopFlag=false;
var excycles, addcycles;

function ByteAt(addr) {
	return memory[addr] || 0;
}
function WordAt(addr) {
	return ByteAt(addr)+ByteAt(0xffff&(addr+1))*256;
}
//function ImmediateByte(pc) {
//	return ByteAt(pc);
//}
function ImmediateAddr() {
	return pc;
}
function ZeroPageAddr() {
	return ByteAt(pc);
}
function ZeroPageXAddr() {
	return 255&(x+ByteAt(pc));
}
function ZeroPageYAddr() {
	return 255&(y+ByteAt(pc));
}
function IndirectXAddr() {
	return WordAt(255&(ByteAt(pc)+x));
}
function IndirectYAddr() {
	if (addcycles) {
		var a1=WordAt(ByteAt(pc));
		var a2=(a1+y)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (WordAt(ByteAt(pc))+y)&0xffff;
	}
}
function AbsoluteAddr() {
	return WordAt(pc);
}
function AbsoluteXAddr() {
	if (addcycles) {
		var a1=WordAt(pc);
		var a2=(a1+x)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (WordAt(pc)+x)&0xffff;
	}
}
function AbsoluteYAddr() {
	if (addcycles) {
		var a1=WordAt(pc);
		var a2=(a1+y)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (WordAt(pc)+y)&0xffff;
	}
}
function BranchRelAddr() {
	excycles++;
	var addr=ByteAt(pc)
	pc++;
	addr= (addr&128)? pc-((addr^255)+1) : pc+addr;
	if ((pc&0xff00)!=(addr&0xff00)) excycles++;
	pc=addr&0xffff;
}

// stack

function stPush(z) {
	RAM[sp+256]=z&255;
	sp--;
	sp&=255;
}
function stPop() {
	sp++;
	sp&=255;
	return ByteAt(sp+256);
}
function stPushWord(z) {
	stPush((z>>8)&255);
	stPush(z&255);
}
function stPopWord() {
	var z=stPop();
	z +=256*stPop();
	return z;
}

// operations

function FlagsNZ(z) {
	flags &=~(fZER+fNEG);
	if (z==0) {
		flags|=fZER;
	}
	else {
		flags |=z&128;
	}
}
function opORA(x) {
	a|=ByteAt(x());
	FlagsNZ(a);
}
function opASL(x) {
	var addr = x();
	var tbyte = ByteAt(addr);
	flags &=~(fCAR+fNEG+fZER);
	if (tbyte&128) flags |= fCAR;
	if (tbyte=(tbyte<<1)&255) {    // FVD corrected overflow with tbyte=(tbyte<<1)
		flags |=tbyte&128;
	}
	else {
		flags |=fZER;
	}
	RAM[addr] = tbyte
}
function opLSR(x) {
	var addr=x();
	var tbyte=ByteAt(addr);
	flags &=~(fCAR+fNEG+fZER);
	flags |=tbyte&1;
	if (tbyte=tbyte>>1) {}
	else {
		flags |=fZER;
	}
	RAM[addr]=tbyte;
}
function opBCL(x) {
	if (flags&x) {
		pc++;
	}
	else {
		BranchRelAddr();
	}
}
function opBST(x) {
	if (flags&x) {
		BranchRelAddr();
	}
	else {
		pc++;
	}
}
function opCLR(x) {
	flags &=~x;
}
function opSET(x) {
	flags |= x;
}
function opAND(x) {
	a &= ByteAt(x());
	FlagsNZ(a);
}
function opBIT(x) {
	var tbyte=ByteAt(x());
	flags &=~(fZER+fNEG+fOVF);
	if ((a&tbyte)==0) flags |=fZER;
	flags |=tbyte&(128+64);
}
function opROL(x) {
	var addr=x();
	var tbyte=ByteAt(addr);
	if (flags&fCAR) {
		if (tbyte&128) {}
		else {
			flags &=~fCAR;
		}
		tbyte=(tbyte<<1)|1;
	}
	else {
		if (tbyte&128) flags|=fCAR;
		tbyte=tbyte<<1;
	}
	FlagsNZ(tbyte);
	RAM[addr]=tbyte;
}
function opEOR(x) {
	a^=ByteAt(x());
	FlagsNZ(a);
}
function opADC(x) {
	var data=ByteAt(x());
	if (flags&fDEC) {
		var h, c=0,
			l=(a&15)+(data&15)+((flags&fCAR)?1:0),
			h1=(a>>4)&15,
			h2=(data>>4)&15,
			s1=(h1&8)? h1-16:h1,
			s2=(h2&8)? h2-16:h2,
			s=s1+s2;
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		if (l>9) {
			l=(l+6)&15;
			c=1;
		}
		h=h1+h2+c;
		if (h>9) {
			h=(h+6)&15;
			flags|=fCAR;
		}
		a=(h<<4)|l;
		if (a==0) {
			flags|=fZER;
		}
		else if (a&128) {
			flags|=fNEG;
		}
		if (s<-8 || s>7) flags|=fOVF;
	}
	else {
		var r = data+a+((flags&fCAR)?1:0);
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		if (r>255) {
			flags|=fCAR;
			r &=255;
		}
		if (r==0) {
			flags|=fZER;
		}
		else {
			flags|=r&128;
		}
		if ((a^r)&(data^r)&128) flags|=fOVF;
		a=r;
	}
}
function opROR(x) {
	var addr=x();
	var tbyte=ByteAt(addr);
	if (flags&fCAR){
		if (tbyte&1) {}
		else flags&=~fCAR;
		tbyte=(tbyte>>1)|128;
	}
	else{
		if (tbyte&1) flags|=fCAR;
		tbyte=tbyte>>1;
	};
	FlagsNZ(tbyte);
	RAM[addr]=tbyte;
}
function opSTA(x) {
	RAM[x()]=a;
}
function opSTY(x) {
	RAM[x()]=y;
}
function opSTX(y) {
	RAM[y()]=x;
}
function opCPY(x) {
	var tbyte=ByteAt(x());
	flags &=~(fCAR+fZER+fNEG);
	if (y==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (y>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
}
function opCPX(y) {
	var tbyte=ByteAt(y());
	flags &=~(fCAR+fZER+fNEG);
	if (x==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (x>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
}
function opCMP(x) {
	var tbyte=ByteAt(x());
	flags &=~(fCAR+fZER+fNEG);
	if (a==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (a>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
}
function opSBC(x) {
	var data=ByteAt(x()), r=a-data-((flags&fCAR)?0:1), rb=r&255;
	if (flags&fDEC) {
		var h, c=0,
			l=(a&15)-(data&15)-((flags&fCAR)?1:0),
			h1=(a>>4)&15,
			h2=(data>>4)&15;
		flags &= ~(fCAR+fZER+fOVF+fNEG);
		if (l<0) {
			l+=10;
			c=1;
		}
		else if (l>9) {
			l=(l+6)&15;
		}
		h=h1-h2-c;
		if (h<0) {
			h+=10;
			flags|=fCAR;
		}
		else if (h>9) {
			h=(h+6)&15;
		}
		r=(h<<4)|l;
		if (r==0) {
			flags|=fZER+fCAR;
		}
		else {
			flags|=fCAR;
		}
		if (r&128) flags|=fNEG;
	}
	else {
		flags &= ~(fCAR+fZER+fOVF+fNEG);
		if (r==0) {
			flags |=fZER+fCAR;
		}
		else if (r>0) {
			flags |=fCAR;
		}
		flags|=r&128;
		r&=255;
	}
	if ((a^rb)&((255-data)^rb)&128) flags|=fOVF;
	a=r;
}
function opDECR(x) {
	var addr=x();
	var tbyte=(ByteAt(addr)-1)&255;
	flags &=~(fZER+fNEG);
	if (tbyte) {
		flags |=tbyte&128;
	}
	else {
		flags|=fZER;
	}
	RAM[addr]=tbyte;
}
function opINCR(x) {
	var addr=x();
	var tbyte=(ByteAt(addr)+1)&255;
	flags &=~(fZER+fNEG);
	if (tbyte) {
		flags |=tbyte&128;
	}
	else {
		flags|=fZER;
	}
	RAM[addr]=tbyte;
}
function opLDA(x) {
	a=ByteAt(x());
	FlagsNZ(a);
}
function opLDY(x) {
	y=ByteAt(x());
	FlagsNZ(y);
}
function opLDX(y) {
	x=ByteAt(y());
	FlagsNZ(x);
}


// instructions

/* original i00
function i00() {
	stPushWord(pc);
	flags |= fBKC;
	stPush(flags);
	flags &= ~fBKC;
	pc=WordAt(IrqTo);
	breakFlag=true;
}
*/
function i00() {
	flags |= fBKC;
	stPushWord(pc);
	stPush(flags);
	flags |= fINT;
	pc=WordAt(IrqTo);
	breakFlag=true;
}
function i01() { opORA(IndirectXAddr); pc++; }
function i05() { opORA(ZeroPageAddr); pc++; }
function i06() { opASL(ZeroPageAddr); pc++; }
function i08() { stPush(flags); }
function i09() { a |= ByteAt(pc); FlagsNZ(a); pc++; }
function i0a() {
	if (a&128) {
		flags |= fCAR;
	}
	else {
		flags &= ~fCAR;
	}
	a=a<<1;
	FlagsNZ(a);
	a&=255;
}
function i0d() { opORA(AbsoluteAddr); pc+=2; }
function i0e() { opASL(AbsoluteAddr); pc+=2; }
function i10() { opBCL(fNEG); }
function i11() { opORA(IndirectYAddr); pc++; }
function i15() { opORA(ZeroPageXAddr); pc++; }
function i16() { opASL(ZeroPageXAddr); pc++; }
function i18() { opCLR(fCAR); }
function i19() { opORA(AbsoluteYAddr); pc+=2; }
function i1d() { opORA(AbsoluteXAddr); pc+=2; }
function i1e() { opASL(AbsoluteXAddr); pc+=2; }
function i20() { stPushWord((pc+1)&0xffff); pc=WordAt(pc); }
function i21() { opAND(IndirectXAddr); pc++; }
function i24() { opBIT(ZeroPageAddr); pc++; }
function i25() { opAND(ZeroPageAddr); pc++; }
function i26() { opROL(ZeroPageAddr); pc++; }
function i28() { flags = stPop(); }
function i29() { a &= ByteAt(pc); FlagsNZ(a); pc++; }
function i2a() {
	if (flags&fCAR) {
		if ((a&128)==0) flags &=~fCAR;
		a=(a<<1)|1;
	}
	else {
		if(a&128) flags|=fCAR;
		a=a<<1;
	};
	FlagsNZ(a);
	a&=255;
}
function i2c() { opBIT(AbsoluteAddr); pc+=2; }
function i2d() { opAND(AbsoluteAddr); pc+=2; }
function i2e() { opROL(AbsoluteAddr); pc+=2; }
function i30() { opBST(fNEG); }
function i31() { opAND(IndirectYAddr); pc++; }
function i35() { opAND(ZeroPageXAddr); pc++; }
function i36() { opROL(ZeroPageXAddr); pc++; }
function i38() { opSET(fCAR); }
function i39() { opAND(AbsoluteYAddr); pc+=2; }
function i3d() { opAND(AbsoluteXAddr); pc+=2; }
function i3e() { opROL(AbsoluteXAddr); pc+=2; }
function i40() { flags=stPop(); pc=stPopWord(); }
function i41() { opEOR(IndirectXAddr); pc++; }
function i45() { opEOR(ZeroPageAddr); pc++; }
function i46() { opLSR(ZeroPageAddr); pc++; }
function i48() { stPush(a); }
function i49() { a ^= ByteAt(pc); FlagsNZ(a); pc++; }
function i4a() {
	flags &=~(fCAR+fNEG+fZER);
	if (a&1) flags |=fCAR;
	if (a=a>>1) {}
	else {
		flags |=fZER;
	}
	a&=255;
}
function i4c() { pc=WordAt(pc); }
function i4d() { opEOR(AbsoluteAddr); pc+=2; }
function i4e() { opLSR(AbsoluteAddr); pc+=2; }
function i50() { opBCL(fOVF); }
function i51() { opEOR(IndirectYAddr); pc++; }
function i55() { opEOR(ZeroPageXAddr); pc++; }
function i56() { opLSR(ZeroPageXAddr); pc++; }
function i58() { opCLR(fINT); }
function i59() { opEOR(AbsoluteYAddr); pc+=2; }
function i5d() { opEOR(AbsoluteXAddr); pc+=2; }
function i5e() { opLSR(AbsoluteXAddr); pc+=2; }
function i60() { pc=stPopWord(); pc++; }
function i61() { opADC(IndirectXAddr); pc++; }
function i65() { opADC(ZeroPageAddr); pc++; }
function i66() { opROR(ZeroPageAddr); pc++; }
function i68() { a=stPop(); FlagsNZ(a); }
function i69() { opADC(ImmediateAddr); pc++; }
function i6a() {
	if (flags&fCAR) {
		if ((a&1)==0) flags &=~fCAR;
		a=(a>>1)|128;
	}
	else {
		if(a&1) flags|=fCAR;
		a=a>>1;
	}
	FlagsNZ(a);
	a&=255;
}
function i6c() {
	var ta=WordAt(pc);
	pc=WordAt(ta);
}
function i6d() { opADC(AbsoluteAddr); pc+=2; }
function i6e() { opROR(AbsoluteAddr); pc+=2; }
function i70() { opBST(fOVF); }
function i71() { opADC(IndirectYAddr); pc++; }
function i75() { opADC(ZeroPageXAddr); pc++; }
function i76() { opROR(ZeroPageXAddr); pc++; }
function i78() { opSET(fINT); }
function i79() { opADC(AbsoluteYAddr); pc+=2; }
function i7d() { opADC(AbsoluteXAddr); pc+=2; }
function i7e() { opROR(AbsoluteXAddr); pc+=2; }
function i81() { opSTA(IndirectXAddr); pc++; }
function i84() { opSTY(ZeroPageAddr); pc++; }
function i85() { opSTA(ZeroPageAddr); pc++; }
function i86() { opSTX(ZeroPageAddr); pc++; }
function i88() { y--; y&=255; FlagsNZ(y); }
function i8a() { a=x; FlagsNZ(a); }
function i8c() { opSTY(AbsoluteAddr); pc+=2; }
function i8d() { opSTA(AbsoluteAddr); pc+=2; }
function i8e() { opSTX(AbsoluteAddr); pc+=2; }
function i90() { opBCL(fCAR); }
function i91() { opSTA(IndirectYAddr); pc++; }
function i94() { opSTY(ZeroPageXAddr); pc++; }
function i95() { opSTA(ZeroPageXAddr); pc++; }
function i96() { opSTX(ZeroPageYAddr); pc++; }
function i98() { a=y; FlagsNZ(a); }
function i99() { opSTA(AbsoluteYAddr); pc+=2; }
function i9a() { sp=x; }
function i9d() { opSTA(AbsoluteXAddr); pc+=2; }
function ia0() { y=ByteAt(pc); FlagsNZ(y); pc++; }
function ia1() { opLDA(IndirectXAddr); pc++; }
function ia2() { x=ByteAt(pc); FlagsNZ(x); pc++; }
function ia4() { opLDY(ZeroPageAddr); pc++; }
function ia5() { opLDA(ZeroPageAddr); pc++; }
function ia6() { opLDX(ZeroPageAddr); pc++; }
function ia8() { y=a; FlagsNZ(y); }
function ia9() { a=ByteAt(pc); FlagsNZ(a); pc++; }
function iaa() { x=a; FlagsNZ(x); }
function iac() { opLDY(AbsoluteAddr); pc+=2; }
function iad() { opLDA(AbsoluteAddr); pc+=2; }
function iae() { opLDX(AbsoluteAddr); pc+=2; }
function ib0() { opBST(fCAR); }
function ib1() { opLDA(IndirectYAddr); pc++; }
function ib4() { opLDY(ZeroPageXAddr); pc++; }
function ib5() { opLDA(ZeroPageXAddr); pc++; }
function ib6() { opLDX(ZeroPageYAddr); pc++; }
function ib8() { opCLR(fOVF); }
function ib9() { opLDA(AbsoluteYAddr); pc+=2; }
function iba() { x=sp; }
function ibc() { opLDY(AbsoluteXAddr); pc+=2; }
function ibd() { opLDA(AbsoluteXAddr); pc+=2; }
function ibe() { opLDX(AbsoluteYAddr); pc+=2; }
function ic0() { opCPY(ImmediateAddr); pc++; }
function ic1() { opCMP(IndirectXAddr); pc++; }
function ic4() { opCPY(ZeroPageAddr); pc++; }
function ic5() { opCMP(ZeroPageAddr); pc++; }
function ic6() { opDECR(ZeroPageAddr); pc++; }
function ic8() { y++; y&=255; FlagsNZ(y); }
function ic9() { opCMP(ImmediateAddr); pc++; }
function ica() { x--; x&=255; FlagsNZ(x); }
function icc() { opCPY(AbsoluteAddr); pc+=2; }
function icd() { opCMP(AbsoluteAddr); pc+=2; }
function ice() { opDECR(AbsoluteAddr); pc+=2; }
function id0() { opBCL(fZER); }
function id1() { opCMP(IndirectYAddr); pc++; }
function id5() { opCMP(ZeroPageXAddr); pc++; }
function id6() { opDECR(ZeroPageXAddr); pc++; }
function id8() { opCLR(fDEC); }
function id9() { opCMP(AbsoluteYAddr); pc+=2; }
function idd() { opCMP(AbsoluteXAddr); pc+=2; }
function ide() { opDECR(AbsoluteXAddr); pc+=2; }
function ie0() { opCPX(ImmediateAddr); pc++; }
function ie1() { opSBC(IndirectXAddr); pc++; }
function ie4() { opCPX(ZeroPageAddr); pc++; }
function ie5() { opSBC(ZeroPageAddr); pc++; }
function ie6() { opINCR(ZeroPageAddr); pc++; }
function ie8() { x++; x&=255; FlagsNZ(x); }
function ie9() { opSBC(ImmediateAddr); pc++; }
function iea() { nopFlag=true; }
function iec() { opCPX(AbsoluteAddr); pc+=2; }
function ied() { opSBC(AbsoluteAddr); pc+=2; }
function iee() { opINCR(AbsoluteAddr); pc+=2; }
function if0() { opBST(fZER); }
function if1() { opSBC(IndirectYAddr); pc++; }
function if5() { opSBC(ZeroPageXAddr); pc++; }
function if6() { opINCR(ZeroPageXAddr); pc++; }
function if8() { opSET(fDEC); }
function if9() { opSBC(AbsoluteYAddr); pc+=2; }
function ifd() { opSBC(AbsoluteXAddr); pc+=2; }
function ife() { opINCR(AbsoluteXAddr); pc+=2; }

function ini() {
	if (debug) alert('Not implemented');
	pc++;
}

// code pages

var instruct = [
	i00, i01, ini, ini, ini, i05, i06, ini,
	i08, i09, i0a, ini, ini, i0d, i0e, ini,
	i10, i11, ini, ini, ini, i15, i16, ini,
	i18, i19, ini, ini, ini, i1d, i1e, ini,
	i20, i21, ini, ini, i24, i25, i26, ini,
	i28, i29, i2a, ini, i2c, i2d, i2e, ini,
	i30, i31, ini, ini, ini, i35, i36, ini,
	i38, i39, ini, ini, ini, i3d, i3e, ini,
	i40, i41, ini, ini, ini, i45, i46, ini,
	i48, i49, i4a, ini, i4c, i4d, i4e, ini,
	i50, i51, ini, ini, ini, i55, i56, ini,
	i58, i59, ini, ini, ini, i5d, i5e, ini,
	i60, i61, ini, ini, ini, i65, i66, ini,
	i68, i69, i6a, ini, i6c, i6d, i6e, ini,
	i70, i71, ini, ini, ini, i75, i76, ini,
	i78, i79, ini, ini, ini, i7d, i7e, ini,
	ini, i81, ini, ini, i84, i85, i86, ini,
	i88, ini, i8a, ini, i8c, i8d, i8e, ini,
	i90, i91, ini, ini, i94, i95, i96, ini,
	i98, i99, i9a, ini, ini, i9d, ini, ini,
	ia0, ia1, ia2, ini, ia4, ia5, ia6, ini,
	ia8, ia9, iaa, ini, iac, iad, iae, ini,
	ib0, ib1, ini, ini, ib4, ib5, ib6, ini,
	ib8, ib9, iba, ini, ibc, ibd, ibe, ini,
	ic0, ic1, ini, ini, ic4, ic5, ic6, ini,
	ic8, ic9, ica, ini, icc, icd, ice, ini,
	id0, id1, ini, ini, ini, id5, id6, ini,
	id8, id9, ini, ini, ini, idd, ide, ini,
	ie0, ie1, ini, ini, ie4, ie5, ie6, ini,
	ie8, ie9, iea, ini, iec, ied, iee, ini,
	if0, if1, ini, ini, ini, if5, if6, ini,
	if8, if9, ini, ini, ini, ifd, ife, ini
];

var cycletime = [
	7, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 0, 4, 6, 0,  // 00
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 10
	6, 6, 0, 0, 3, 3, 5, 0, 4, 2, 2, 0, 4, 4, 6, 0,  // 20
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 30
	6, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 3, 4, 6, 0,  // 40
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 50
	6, 6, 0, 0, 0, 3, 5, 0, 4, 2, 2, 0, 5, 4, 6, 0,  // 60
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 70
	0, 6, 0, 0, 3, 3, 3, 0, 2, 0, 2, 0, 4, 4, 4, 0,  // 80
	2, 6, 0, 0, 4, 4, 4, 0, 2, 5, 2, 0, 0, 5, 0, 0,  // 90
	2, 6, 2, 0, 3, 3, 3, 0, 2, 2, 2, 0, 4, 4, 4, 0,  // A0
	2, 5, 0, 0, 4, 4, 4, 0, 2, 4, 2, 0, 4, 4, 4, 0,  // B0
	2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 3, 0,  // C0
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // D0
	2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 6, 0,  // E0
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0   // F0
];
var extracycles= [
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 00
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 10
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 20
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 30
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 40
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 50
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 60
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 70
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 80
	2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 90
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // A0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0,  // B0
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // C0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // D0
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // E0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0   // F0
];

// lookup tables for opBCD math.
// (unused legacy code, for external compatibilty only)
var bcd2dec= [
	  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,  // 0x00
	 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,  // 0x10
	 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,  // 0x20
	 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,  // 0x30
	 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,  // 0x40
	 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,  // 0x50
	 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,  // 0x60
	 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,  // 0x70
	 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,  // 0x80
	 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,100,101,102,103,104,105,  // 0x90
	100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,  // 0xA0
	110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,  // 0xB0
	120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,  // 0xC0
	130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,  // 0xD0
	140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,  // 0xE0
	150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165   // 0xF0
];
var dec2bcd= [
	0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,
	0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,
	0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,
	0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
	0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
	0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
	0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
	0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
	0x80,0x81,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
	0x90,0x91,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99
];


// main

var processorCycles;
var internalCycleDelay=0;

function processorLoop() {
	breakFlag=false;
	var instructCode =ByteAt(pc);
	pc++;
	pc &=0xffff;
	excycles =0;
	addcycles =extracycles[instructCode];
	instruct[instructCode]();
	processorCycles +=cycletime[instructCode]+excycles;
	pc &=0xffff;
	if (externalLoop==false) {
		if ((breakFlag) && (stopOnIterrupt)) return;
		setTimeout('processorLoop()',internalCycleDelay);
	}
}

function resetCPU() {
	pc=0;
	sp=255;
	a=x=y=0;
	flags=32;
	breakFlag=false;
	processorCycles=0;
}

function clearMemory() {
	RAM=[];
	memory=RAM;
}

resetCPU();

// end of 6502
