//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY AUTHOR AND CONTRIBUTORS ``AS IS'' AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL AUTHOR OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.
//

// apple2keys.js

function apple2OnKeyPress(event) {
    if (event.metaKey || event.altKey)
      return true;

    var code = event.charCode != 0 ? event.charCode : event.keyCode;
    //console.log("apple2OnKeyPress: code=0x%s", code.toString(16));
    //alert("apple2OnKeyPress: code=0x"+code.toString(16))

    // left arrow
    if (event.charCode == 0 && event.keyCode == 37)
        code = 0x08;

    // right arrow
    if (event.charCode == 0 && event.keyCode == 39)
        code = 0x15;

    // Convert lower case to upper case
    if (code >= 0x61 && code <= 0x7a)
        code -= 0x20;

    // Apple control key on alpha characters
    if (event.ctrlKey && code >= 0x41 && code <= 0x5a)
        code -= 0x40;
        
    // Hi bit is always set
    code |= 0x80;
    apple2plus.keypress(code);

    return false;
}

function apple2OnKeyHover(event)
{
    var t = document.getElementById("keyimg");
    var u = document.getElementById("keybox");

    var x = event.pageX-775;
    var y = event.pageY-740;
    var xc = Math.floor(x/47)+14;
    var yc = Math.floor(y/47.5)+5;

    var w = 30;
    var sbtn = {"LSHIFT":[-625,-70],"RSHIFT":[-39,-70],"CTRL":[-624,-117],"REPT":[-118,-165]};
    var keymap = {0:[0xB1,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xB0,0xBA,0xAD,"RESET"],
                  1:[0x9B,0xD1,0xD7,0xC5,0xD2,0xD4,0xD9,0xD5,0xC9,0xCF,0xD0,"REPT",0x8D],
                  2:["CTRL",0xC1,0xD3,0xC4,0xC6,0xC7,0xC8,0xCA,0xCB,0xCC,0xBB,0x88,0x95],
                  3:["LSHIFT",0xDA,0xD8,0xC3,0xD6,0xC2,0xCE,0xCD,0xAC,0xAE,0xAF,"RSHIFT","RSHIFT"],
                  4:["POWER","",0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0]
                }

    switch(yc)
    {
        case 0: x = xc>0 ? (xc-1)*47-567 : -47-567; break;
        case 1: x = xc>0 ? (xc-1)*47-588 : -47-588; w=xc>11?55:w; break;
        case 2: x = xc>0 ? (xc-1)*47-577 : -47-577; break;
        case 3: x = xc>0 ? xc*47-603 : -47-603+25; w=xc<=0 || xc>10 ? 55:w; break;
        case 5: yc--;
        case 4: x = xc==0 ? -620 : -603+25+69; w=xc==0?30:360; break;
    }
    y = Math.round(yc*47.5+25-237.5);
    u.style.width = w+"px";

    switch(event.type)
    {
        case "mousemove":
            document.getElementById("keybox").style.top = y+"px";
            document.getElementById("keybox").style.left = x+"px";
            _o.EMU_keyb_timer = true;
        break;
        case "mouseover":
            t.style.opacity=1;
            u.style.display="";
            _o.EMU_keyb_timer = true;
        break;
        case "mouseout":
            _o.EMU_keyb_timer = false;
            //setTimeout(apple2OnKeyHover_out, 2000);
        break;
        case "click":
            if(typeof(keymap[yc][xc])=="number")
            {
                var event = {"charCode":false,"metaKey":false,"altKey":false,"keyCode":keymap[yc][xc]}
                apple2OnKeyPress(event);
            }
            else if(typeof(keymap[yc][xc])=="string")
            {
                switch(keymap[yc][xc])
                {
                    case "RESET":
                        resetButton();
                    break;
                    case "POWER":
                        restartButton();
                    break;
                    default:
                        alert("("+xc+","+yc+") ["+x+","+y+"] "+keymap[yc][xc]);
                }
            }
            else
                alert("("+xc+","+yc+") ["+x+","+y+"] "+keymap[yc][xc]);
        break;
        default:
            alert(event.type)
    }
}

function apple2OnKeyHover_out()
{
    if(_o.EMU_keyb_timer == true) return;

    var t = document.getElementById("keyimg");
    var u = document.getElementById("keybox");

    t.style.opacity=0;
    u.style.display="none";

    _o.EMU_keyb_timer = false;
}

