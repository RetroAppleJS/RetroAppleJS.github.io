var oASM = new ASM();
oASM.getHexByte = getHexByte;
oASM.ByteAt = function ByteAt(addr) { return this.srcfield_bin}
oASM.sym_search = function sym_search(op,adm) { return }
oASM.srcfield_bin = new Uint8Array(); 


var TFUNCTION_str = "";
for(var i in _CFG_TFUNCTION)
{
  TFUNCTION_str += "<option value='"+i+"'>"+i+"</option>";
}

var sTools = "<button onclick=\"javascript:onSrcMargin('+',document.forms.ass.srcfield)\"><i class='fa fa-indent'></i> Margin+</button>\n"
  +"<button onclick=\"javascript:onSrcMargin('-',document.forms.ass.srcfield)\"><i class='fa fa-outdent'></i> Margin-</button>\n"
  +"<button onclick=\"javascript:onSrcComment('2Space',document.forms.ass.srcfield)\">Comment last 2-space indent</button>\n"

  +"<select onchange=\"var c=this.value.ltrim().rtrim();document.getElementById('TFUNCTION_in').value=_CFG_TFUNCTION[c]['REGXEP_INPUT'];document.getElementById('TFUNCTION_out').value=_CFG_TFUNCTION[c]['REGEXP_OUTPUT']\">"
  +TFUNCTION_str
  +"</select>"
  +"<input id=TFUNCTION_in style='width:80px'></input>"
  +"<input id=TFUNCTION_out style='width:80px'></input>" 
  +"<button onclick=\"javascript:onSrcTransform('transform',document.forms.ass.srcfield)\">Transform</button>\n"
  +"<button onclick=\"javascript:onSrcTransform('undo',document.forms.ass.srcfield)\">Undo</button>\n"

  +"<br>"
  +"add address lines <input type=\"checkbox\" id=\"showADR\" checked class=\"formField\">"
  +"RAM symbols <input type=\"checkbox\" id=\"showDBG_RAM\" class=\"formField\">"
  +"ROM symbols <input type=\"checkbox\" id=\"showDBG_ROM\" class=\"formField\">"

function onToolBox(el) {
  var e = document.getElementById(el);
  e.hidden = !e.hidden;
}

function onSrcMargin(dir, obj) {
  getSrc(obj, true)
  switch (dir) {
    case '+':
      for (var i = 0; i < codesrc.length; i++) {
        var buf = codesrc_buf[i].charAt(codesrc_buf[i].length - 1)
        codesrc[i] = buf + codesrc[i];
        codesrc_buf[i] = codesrc_buf[i].substring(0, codesrc_buf[i].length - 1)
      }
      obj.value = codesrc.join("\n");
      break;
    case '-':
      for (var i = 0; i < codesrc.length; i++) {
        codesrc_buf[i] = (codesrc_buf[i] == null ? "" : codesrc_buf[i]) + codesrc[i].charAt(0);
        codesrc[i] = codesrc[i].substring(1, codesrc[i].length)
      }
      obj.value = codesrc.join("\n");
      break;
  }
}

String.prototype.ltrim = function() {
  return this.replace(/^\s+/, "");
}
String.prototype.rtrim = function() {
  return this.replace(/\s+$/, "");
}

function space_segment(str) {
  var arr = str.split(" ");
  for (var i = 0, r = 0; r < arr.length - 1; i++) {
    arr[i] = arr[r++];
    if (arr[r - 1].indexOf("'") == (arr[r - 1].length - 1) && arr[r].indexOf("'") == 0)
      arr[i] += " " + arr[r++];
    if (arr[r] == "") arr[i] += " ";
    while (arr[r] == "") {
      r++
    }
  }
  arr[i] = arr[r];
  arr.length = !arr[i] ? i : i + 1;
  return arr;
}

function lim3(str) {
  return str ? str.substring(0, 3) : "";
}

function onSrcComment(dir, obj) {
  getSrc(obj, true);
  switch (dir) {
    case '2Space':
      for (var i = 0; i < codesrc.length; i++) {
        // FVD splitting with RegExp

        var opc = codesrc[i].ltrim();
        //var part = opc.split(/([\s](?=[^\s]))(?=(?:[^'][^\s][^']))/g)
        var part = space_segment(opc);
        if (instrtab[lim3(part[0])] && part[2] != null) // first part = opcode ?
        {
          //alert(part[0] +" "+ instrtab[part[0]])
          var off = 0;
          var opc_test = lim3(part[off]);
          var idx_val = !instrtab[opc_test][0];
          var idx = idx_val ? (off + 1) : (off + 2)       //  0 or 1 operand ?
          var spc = part[idx - 1].slice(-1);
          part[idx] = ";" + part[idx];
          codesrc[i] = part.join(" ");
        } else if (instrtab[lim3(part[1])] && part[3] != null) // second part = opcode ?
        {
          //alert(part[1] +" "+ instrtab[part[1]])
          var off = 1;
          var opc_test = lim3(part[off]);
          var idx_val = !instrtab[opc_test][0];
          var idx = idx_val ? (off + 1) : (off + 2);     //  2 or 3 operand ?
          var spc = part[idx - 1].slice(-1);
          part[idx] = ";" + part[idx];
          codesrc[i] = part.join(" ");
        }

      }
      obj.value = codesrc.join("\n");
      break;
  }
}

function onSrcTransform(dir, obj)
{
  function upperCase(match) {
    var result = match.toUpperCase();
    return result;
  }

  if(dir=="transform")
  {
    getSrc(obj, true);
    var tin = document.getElementById("TFUNCTION_in").value;
    var tout = document.getElementById("TFUNCTION_out").value; 

    // FVD TODO STORE UNDO BUFFER !!!!
    try
    {
      var re = new RegExp(tin,"g");
      for (var i = 0; i < codesrc.length; i++)
      {
        //codesrc[i] = codesrc[i].replace(re,tout);
        //  ( [a-z][a-z][a-z] )
        // x => x[1].toUpperCase()
        //codesrc[i] = codesrc[i].replace(re,x => x.toUpperCase())
        //codesrc[i] = codesrc[i].replace(re,eval("x => 'EQU'"))
        //codesrc[i] = codesrc[i].replace(re,eval("x => x.toUpperCase()"))
        //console.log(tout.match(/^'/))
        codesrc[i] = (" "+codesrc[i]+" ").replace(re,eval("x => "+tout));
        codesrc[i] = codesrc[i].substring(1,codesrc[i].length-2)
      } 
      obj.value = codesrc.join("\n");
    }
    catch(e)
    {
      console.error(e);
    }
    console.log(dir);
    console.log(tin+" "+tout);

    //console.log(obj)
   
  }

}

function asmHelp() {

  return '<h3>Instructions</h3>' +
    '' +
    '      This is a simple 2 pass assembler for the 65xx microprocessor.  It is thought to accompany the emulator' +
    '' +
    '      <p class="text18">To get your source code compiled:</p>' +
    '' +
    '      <ol>' +
    '      <li class="text18">Enter your src in "source code" pane.</li>' +
    '      <li class="text18">Click the button "generate".</li>' +
    '      <li class="text18">Watch progress in "listing" pane.</li>' +
    '      <li class="text18">Copy code from "object code" pane.<br></li>' +
    '      </ol>' +
    '' +
    '      <h3>Syntax</h3>' +
    '      <p class="text">The assembler supports the following syntax:</p>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="2"><b>Opcodes and Addressing</b></td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="text">Opcodes are always 3 letter mnemonics followed by an (optional) operand/address:</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">OPC</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">implied</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC A</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">Accumulator</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC #BB</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">immediate</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC HHLL</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">absolute</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC HHLL,X</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">absolute, X-indexed</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC HHLL,Y</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">absolute, Y-indexed</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC *LL</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">zeropage</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC *LL,X</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">zeropage, X-indexed</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC *LL,Y</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">zeropage, Y-indexed</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC (BB,X)</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">X-indexed, indirect</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC (LL),Y</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">indirect, Y-indexed</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC (HHLL)</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">indirect</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">OPC BB</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">relative</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="text"> <br>' +
    '      Where HHLL is a 16bit word and LL or BB an' +
    '      8 bit byte, and A is literal "A".<br>' +
    '      There must not be any white space in' +
    '      any part of an instruction\'s address.<br> </td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="4"><b>Number Formats</b><br> </td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">$[0-9A-Fa-f]</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">hex</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">%[01]</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">binary</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">0[0-7]</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">octal</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">[0-9]</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">decimal</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap"><</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">LO-byte portion</td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">></td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text" nowrap="nowrap">HI-byte portion</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="4"> <br><b>Labels and Identifiers</b></td>' +
    '      </tr>' +
    '      <tr>' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="text18">' +
    '      Identifiers must begin with a letter [A-Z] and contain letters, digits,' +
    '      and the underscore [A-Z0-9_]. Only the first 6 characters are' +
    '      significant.<br><br>' +
    '      All identifiers, numbers, opcodes, and pragmas are case insensitive and' +
    '      translated to upper case. Identifiers must not be the same as valid' +
    '      opcodes.<br><br>' +
    '      The special identifier "*" refers to the program counter (PC).' +
    '      </td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="text18">' +
    '      Exampels:' +
    '      </td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">* = $C000<br>' +
    '                                          org $C000</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Set start address (PC) to C000.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">LABEL1 LDA #4</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Define LABEL1 with address of instruction LDA.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">BNE LABEL2</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Jump to address of label LABEL2.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">STORE = $0800</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Define STORE with value 0800.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">HERE = *</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Define HERE with current address (PC).</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">HERE2</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Define HERE2 with current address (PC).</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap"> </td>' +
    '      <td class="display2" nowrap="nowrap">LDA #<VAL1</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Load LO-byte of VAL1.</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="4"> <br><b>Pragmas</b></td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="text" colspan="3">Pragmas start with a dot (.) and must be the only expression in a line:</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">.BYTE BB</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Insert 8 bit byte at current address into code.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">.WORD HHLL</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Insert 16 bit word at current address into code.</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">.END</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">End of source, stop assembly. (optional)</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="4"> <br><b>Comments</b></td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="display2" nowrap="nowrap">; comment</td>' +
    '      <td class="text" nowrap="nowrap">....</td>' +
    '      <td class="text">Any sequence of characters after a semicolon util end of the line is ignored.</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="2"> <br><b>White Space</b></td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">  </td>' +
    '      <td class="text">The assembler does not rely on any special formatting with following exclusion:<br>' +
    '      There must be white space between a label and a opcode and the opcode' +
    '      and any operands. Only one instruction per line is permitted.</td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      <table cellspacing="0" cellpadding="3" border="0">' +
    '      <tbody><tr>' +
    '      <td class="text" colspan="4"><br><b>Code Example</b><br> </td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td class="text" nowrap="nowrap">   Src:</td>' +
    '      <td class="text" nowrap="nowrap"></td>' +
    '      <td class="text" nowrap="nowrap">Listing:</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td nowrap="nowrap"><xmp>' +
    '   *=$c000\r\n' +
    '          LDX #0\r\n' +
    '   Label1 TXA\r\n' +
    '          STA $0400,X\r\n' +
    '          LDA #1\r\n' +
    '          STA $D800,X\r\n' +
    '          INX\r\n' +
    '          BNE Label1\r\n' +
    '          RTS\r\n' +
    '   .END</xmp></td>' +
    '      <td class="text" nowrap="nowrap"></td>' +
    '      <td nowrap="nowrap"><xmp>' +
    '* = $C000\r\n' +
    'C000        LDX #$00        A2 00\r\n' +
    'C002 LABEL1 TXA             8A\r\n' +
    'C003        STA $0400,X     9D 00 04\r\n' +
    'C006        LDA #$01        A9 01\r\n' +
    'C008        STA $D800,X     9D 00 D8\r\n' +
    'C00B        INX             E8\r\n' +
    'C00C        BNE LABEL1      D0 F4\r\n' +
    'C00E        RTS             60\r\n' +
    'C00F .END\r\n</xmp></td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td colspan="3" class="text" nowrap="nowrap"><br>Object Code:</td>' +
    '      </tr>' +
    '      <tr valign="top">' +
    '      <td colspan="3" nowrap="nowrap"><xmp>' +
    '      A2 00 8A 9D 00 04 A9 01\r\n' +
    '      9D 00 D8 E8 D0 F4 60</xmp></td>' +
    '      </tr>' +
    '      </tbody></table>' +
    '      </td>' +
    '      </tr>' +
    '      </tbody></table>'
}
