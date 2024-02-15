//
// Copyright (c) 2021 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_A2Pkeys.js

// TODO: how handle shift + key (remember keyup & down state of each key ???)

if(oEMU===undefined) var oEMU =
    {"component":{"Keyboard":
        { keystroke:function(){alert("missing A2Pkeys -> keystroke()")}
         ,KbdHover:function(){COM_PopupHTML("missing A2Pkeys -> KbdHover()",3)}
         ,KbdHTML:function(){COM_PopupHTML("missing A2Pkeys -> KbdHTML()",3)}
        }
    }}
else oEMU.component.Keyboard = new A2Pkeys();

function A2Pkeys()
{
    //this.hw = hw;
    this.bDebug = false;
    this.o = typeof(_o)=="undefined"?
    {"EMU_keyb_timer":false
    ,"EMU_keyb_active":false
    ,EMU_kbd_id:"kbdimg"
    ,EMU_key_id:"keybox"
    ,kbd_events:"onmousemove=keys.KbdHover(event); onmouseout=keys.KbdHover(event)"
    ,key_events:"onclick=keys.keystroke(event)"
    ,"KBD_Xoff":-6
    ,"KBD_Yoff":-50   
    }:_o;
    this.o.kbd_map = new Array();
    // basic keystroke event handler without hardwired buttons
    // hardwiring should be done by letting hardware class override this method

    this.isActive = function(bool) { return bool } // always active by default

    this.cycle = function(systemObj,bEnable)
    {
        if(this.isActive()) window.onkeypress  = systemObj.keystroke;
        else window.onkeypress  = null;
    }

    this.keystroke = function(data)
    {
        if(this.isActive()==false) return; 
        var combo_keys = {16:"SHIFT",17:"CTRL",18:"ALT",20:"CAPSLCK",27:"ESC",91:"CMD"};
        this.debug(data);
        if(data.type=="keydown")
        {
            if(typeof(combo_keys[data.keyCode])=="string") { this.o.kbd_map[data.keyCode]=combo_keys[data.keyCode]; return; }
        }
        if(data.type=="keyup")
        {
            if(typeof(combo_keys[data.keyCode])=="string") { delete this.o.kbd_map[data.keyCode]; return; }
        }
        
        var s="";
        for(var i in combo_keys) s+= combo_keys[i];

        if(data.type!="click")           // real keyboard or pasteboard ?
        {
            var code = this.KeyCodeHandler(data);         
            if(data.keyCode == 32 && typeof(data.preventDefault)=="function")
                data.preventDefault();   // prevent space-bar from triggering page-down
        }
        else                             // virtual keyboard ?
            var code = this.KbdCodeHandler(data);

        if(typeof(code)=="number")       // ASCII keys ?
        {
            //try { this.hw.io.keypress(code) } catch(e) { alert("override A2Pkeys -> keystroke("+code+")") }
            try { oEMU.component.IO.keypress(code) } catch(e) { alert("override A2Pkeys -> keystroke("+code+")") }
            
        }
        else if (typeof(code)=="string") // HARD-WIRED keys ?
        {
            switch(code)
            {
                case "RESET":
                case "POWER":
                case "REPT":
                    alert("override A2Pkeys -> keystroke("+code+")"); break;
                default:
                    alert("override A2Pkeys -> keystroke("+code+")");
            }
        }
        else
            alert("no key (code="+code+")");
    }

    this.debug = function(data)
    {
        if(this.bDebug) 
        {
            document.getElementById("key_debug").value 
                = "data.charCode="+data.charCode
                +" data.keyCode="+data.keyCode
                +" o.kbd_map = "+JSON.stringify(this.o.kbd_map);
        }
    }

    this.KeyCodeHandler = function(data)
    {
        if (data.metaKey || data.altKey) return true;
        var code = data.charCode != 0 ? data.charCode : data.keyCode;

        this.debug(data);
        //alert(data.keyCode)
        if (data.charCode == 0 && data.keyCode == 192) // comma
            code = 0x23;

        if (data.charCode == 0 && data.keyCode == 221) // comma
            code = 0x24;    

        // left arrow
        if (data.charCode == 0 && data.keyCode == 37)
            code = 0x08;

        // right arrow
        if (data.charCode == 0 && data.keyCode == 39)
            code = 0x15;

        // Convert lower case to upper case
        if (code >= 0x61 && code <= 0x7a)
            code -= 0x20;

        // Apple control key on alpha characters
        if (data.ctrlKey && code >= 0x41 && code <= 0x5a)
            code -= 0x40;
            
        // Hi bit is always set
        code |= 0x80;
        return code;
    }

    this.KbdButtonLocator = function(data)
    {
        //alert(this.o.Yoffset)
        var pos = document.getElementById('kbdimg').offsetTop-503 // 503
        //var pos = document.getElementById('kbdimg').offsetTop-503+this.o.KBD_Yoff
        
        var w = 30;
        var xoff = 39;
        var yoff = 228;
        var x = data.pageX-775 + this.o.KBD_Xoff;
        var y = data.pageY-750 + (this.o.KBD_Yoff?this.o.KBD_Yoff:0) - pos ;
        var xc = 0;
        var yc = Math.floor(y/47.5)+5;
        y = Math.round(yc*47.5-212.5)+yoff;
        
        switch(yc)
        {
            case 0: xc = Math.floor(x/47+13.5); x = xc>0 ? xc*47+xoff : xoff                                ; break;
            case 1: xc = Math.floor(x/47+14.1); x = xc>0 ? xc*47+xoff-23 : xoff-23; w=xc>11?55:w            ; break;
            case 2: xc = Math.floor(x/47+13.8); x = xc>0 ? xc*47+xoff-11 : xoff-11                          ; break;
            case 3: xc = Math.floor(x/47+13.4); x = xc>0 ? xc*47+xoff+12 : xoff-10; w=xc<=0 || xc>10 ? 55:w ; break;
            case 4: xc = Math.floor(x/47+13.4); x = xc>0 ? xoff+106 : xoff-5  ; w=xc>0?360:30               ; break;
            case 5: xc = Math.floor(x/47+13.4); x = xc>0 ? xoff+106 : xoff-5  ; w=xc>0?360:30; yc--         ; break;
        }
        return {"x":x,"y":y,"xc":xc,"yc":yc,"w":w}
    }

    this.KbdCodeHandler = function(data)
    {
      var keymap = {0:[0xB1,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xB0,0xBA,0xAD,"RESET"],
                    1:[0x9B,0xD1,0xD7,0xC5,0xD2,0xD4,0xD9,0xD5,0xC9,0xCF,0xD0,"REPT",0x8D],
                    2:["CTRL",0xC1,0xD3,0xC4,0xC6,0xC7,0xC8,0xCA,0xCB,0xCC,0xBB,0x88,0x95],
                    3:["LSHIFT",0xDA,0xD8,0xC3,0xD6,0xC2,0xCE,0xCD,0xAC,0xAE,0xAF,"RSHIFT","RSHIFT"],
                    4:["POWER","",0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0,0xA0]
                    }
        var loc = this.KbdButtonLocator(data);
        return keymap[loc.yc][loc.xc];
    }

    this.KbdHover = function(event)
    {
        var loc = this.KbdButtonLocator(event);
        document.getElementById(this.o.EMU_key_id).style.width = loc.w+"px";

        switch(event.type)
        {
            case "mousemove":
                document.getElementById(this.o.EMU_kbd_id).style.opacity=1;
                document.getElementById(this.o.EMU_key_id).style.display="";
                document.getElementById(this.o.EMU_key_id).style.top = loc.y+"px";
                document.getElementById(this.o.EMU_key_id).style.left = loc.x+"px";
                this.o.EMU_keyb_active = true;
                this.o.EMU_keyb_timer = true;
            break;        
            case "mouseout":
                this.o.EMU_keyb_timer = false;
                setTimeout( this.KbdHover_out , 2000, this);
            break;
            //case "touchstart":
        }
        if(this.bDebug) 
            document.getElementById("key_debug").value 
                = "pageX="+event.pageX+" pageY="+event.pageY
                 +" loc.x="+loc.x+" loc.y="+loc.y;
    }

    this.KbdHover_out = function(t)
    {
        if(t.o.EMU_keyb_timer == true) return;
        document.getElementById(t.o.EMU_kbd_id).style.opacity=0;
        document.getElementById(t.o.EMU_key_id).style.display="none";
        t.o.EMU_keyb_active = false;
        t.o.EMU_keyb_timer  = false;
    }

    this.defaults = function(args,arr)
    {
        for(var i=0;i<arr.length;i++)
        {
            if(args[arr[i]])
                 this.o[arr[i]] = args[arr[i]];
        }  
    }

    this.KbdHTML = function(args)
    {
        this.defaults(args,["kbd_events","key_events","EMU_key_id","KBD_Yoff"]);

        var s = "<style>"
    +".appkbd"
    +"{"
        +"  background-image:url('"+args.path+"appleIIplus_kbd_650.png');"
        +"  width:650px;"
        +"  height:257px;"
        +"  background-size:650px 257px;"
        +"  top: 50%;"
        +"  left: 50%;"
        +"  margin-left: 105px;"
        +"  background-repeat:no-repeat;"
        +"  image-rendering:pixelated;"
        +"  opacity:0.5;"
    +"}"
    +""
    +".key {"
        +"position:relative;"
        +"display:inline-block;"
        +"width:30px;"
        +"height:30px;"
        +"background: rgba(255, 255, 255, 0.5);"
        +"border-radius: 3px;"
        +"}"
    +"</style>"
    +"<div class='appkbd' id='kbdimg' "+this.o.kbd_events+">"
    +"<div class='key'  id='keybox' "+this.o.key_events+"></div>"


//    <!--
//  <div class="key"  id="keybox"                                        onclick=apple2OnKeyHover(event)  onmousemove=apple2OnKeyHover(event) onmouseout=apple2OnKeyHover(event) onmouseover=apple2OnKeyHover(event)></div>
//
//    <div class="key"  id="key_rept"   style="visibility:hidden;"       onclick=apple2OnKeyHover(event)  onmousemove=apple2OnKeyHover(event) onmouseout=apple2OnKeyHover(event) onmouseover=apple2OnKeyHover(event)></div>
//    <div class="key"  id="key_ctrl"   style="visibility:hidden;"       onclick=apple2OnKeyHover(event) onmousemove=apple2OnKeyHover(event) onmouseout=apple2OnKeyHover(event) onmouseover=apple2OnKeyHover(event)></div>
//    <div class="key"  id="key_lshift" style="visibility:hidden;"       onclick=apple2OnKeyHover(event)  onmousemove=apple2OnKeyHover(event) onmouseout=apple2OnKeyHover(event) onmouseover=apple2OnKeyHover(event)></div>
//    <div class="key"  id="key_rshift" style="visibility:hidden;"       onclick=apple2OnKeyHover(event)  onmousemove=apple2OnKeyHover(event) onmouseout=apple2OnKeyHover(event) onmouseover=apple2OnKeyHover(event)></div>  
//    -->
  +"</div>"

    if(args.id && document.getElementById(args.id))
        document.getElementById(args.id).innerHTML = s;
    else
        document.write(s);

    }
}