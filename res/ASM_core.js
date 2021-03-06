function ASM()
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

    this.writeDisplay = function(n,v,f) {
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

    this.updateScroll = function(el)
	{
		var element = document.getElementById(el);
		element.scrollTop = element.scrollHeight;
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