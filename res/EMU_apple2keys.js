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
    var o = {"kbdimg":document.getElementById("kbdimg")
            ,"keybox":document.getElementById("keybox")
            ,"key_rept":document.getElementById("key_rept")
            ,"key_ctrl":document.getElementById("key_ctrl")
            ,"key_lshift":document.getElementById("key_lshift")
            ,"key_rshift":document.getElementById("key_rshift")
        };

    var sbtn = {"LSHIFT":[-625,-70],"RSHIFT":[-39,-70],"CTRL":[-624,-117],"REPT":[-118,-165]};
    var keymap = {0:[0xB1,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xB0,0xBA,0xAD,"RESET"],
                  1:[0x9B,0xD1,0xD7,0xC5,0xD2,0xD4,0xD9,0xD5,0xC9,0xCF,0xD0,"REPT",0x8D],
                  2:["CTRL",0xC1,0xD3,0xC4,0xC6,0xC7,0xC8,0xCA,0xCB,0xCC,0xBB,0x88,0x95],
                  3:["LSHIFT",0xDA,0xD8,0xC3,0xD6,0xC2,0xCE,0xCD,0xAC,0xAE,0xAF,"RSHIFT","RSHIFT"],
                  4:["POWER","",0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0]
                }

    var xoff = 39;
    var yoff = 228

    var x = event.pageX-775;
    var y = event.pageY-740-10;
    var yc = Math.floor(y/47.5)+5;
    var w = 30;
    switch(yc)
    {
        case 0: xc = Math.floor(x/47+13.5); x = xc>0 ? xc*47+xoff : xoff                                ; break;                 
        case 1: xc = Math.floor(x/47+14.1); x = xc>0 ? xc*47+xoff-23 : xoff-23; w=xc>11?55:w            ; break;
        case 2: xc = Math.floor(x/47+13.8); x = xc>0 ? xc*47+xoff-11 : xoff-11                          ; break;
        case 3: xc = Math.floor(x/47+13.4); x = xc>0 ? xc*47+xoff+12 : xoff-10; w=xc<=0 || xc>10 ? 55:w ; break;  
        case 4: xc = Math.floor(x/47+13.4); x = xc>0 ? xoff+106 : xoff-5  ; w=xc>0?360:30               ; break;
        case 5: xc = Math.floor(x/47+13.4); x = xc>0 ? xoff+106 : xoff-5  ; w=xc>0?360:30; yc--         ; break;                                ; break;
    }
    y = Math.round(yc*47.5-212.5)+yoff;
    o["keybox"].style.width = w+"px";

    switch(event.type)
    {
        case "mousemove":
            document.getElementById("keybox").style.top = y+"px";
            document.getElementById("keybox").style.left = x+"px";
            _o.EMU_keyb_timer = true;
        break;
        case "mouseover":
            o["kbdimg"].style.opacity=1;
            o["keybox"].style.display="";
            _o.EMU_keyb_timer = true;
        break;
        case "mouseout":
            _o.EMU_keyb_timer = false;
            setTimeout(apple2OnKeyHover_out, 2000);
        break;
        
        //case "touchstart":
            //alert(_o.EMU_keyb_timer+" "+t.style.opacity)
            //alert(event.type);
            //t.style.opacity=0;
        //break;

        case "mousedown":
            //beep();
            xc = xc<0?0:xc;
            if(typeof(keymap[yc][xc])=="number")
            {
                //alert("t")
                var event = {"charCode":false,"metaKey":false,"altKey":false,"keyCode":keymap[yc][xc]}
                apple2OnKeyPress(event);
            }
        break;
        
        case "click":
            //if(event.target.id != "keybox") return;
            alert(event.target.id)
            //if(o.EMU_keyb_timer == false) break;
            //alert(_o.EMU_keyb_timer+" "+t.style.opacity)
            //if(_o.EMU_keyb_timer == false) { _o.EMU_keyb_timer = true; break; }
            xc = xc<0?0:xc;
            if(typeof(keymap[yc][xc])=="number")
            {
                var event = {"charCode":false,"metaKey":false,"altKey":false,"keyCode":keymap[yc][xc]}
                apple2OnKeyPress(event);
                //o["key_rept"].style.visibility = "hidden";
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
                    case "REPT":
                        //beep();
                        alert("Instead of REPT, keep    key down >0.5s");
                        /*
                        beep();
                        o["key_rept"].style.top = y+"px";
                        o["key_rept"].style.left = (x-36)+"px";
                        //var visibility = document.getElementById("key_rept").style.visibility == "hidden";
                        //document.getElementById("key_rept").style.visibility = visibility?"visible":"hidden";
                        //alert(visibility.key_rept);
                        //o["key_rept"].style.visibility = o["key_rept"].style.visibility == "hidden"?"visible":"hidden";
                        o["key_rept"].style.visibility = "visible";
                        */
                       return true;
                    break;
                    //case "LSHIFT":

                    //break;
                    default:
                        alert("("+xc+","+yc+") ["+x+","+y+"] "+keymap[yc][xc]);
                }
            }
            else
                alert("("+xc+","+yc+") ["+x+","+y+"] "+keymap[yc][xc]);
        break;
        //default: alert(event.type)
    }
    document.getElementById("key_debug").value = "pageX="+event.pageX+" pageY="+event.pageY+" x="+x+" y="+y+" xc="+xc+" yc="+yc
}

function apple2OnKeyHover_out()
{
    if(_o.EMU_keyb_timer == true) return;

    var o = {"kbdimg":document.getElementById("kbdimg")
            ,"keybox":document.getElementById("keybox")
            ,"key_rept":document.getElementById("key_rept")
            ,"key_ctrl":document.getElementById("key_ctrl")
            ,"key_lshift":document.getElementById("key_lshift")
            ,"key_rshift":document.getElementById("key_rshift")
        };

    o["kbdimg"].style.opacity=0;
    o["keybox"].style.display="none";

    _o.EMU_keyb_timer = false;
}