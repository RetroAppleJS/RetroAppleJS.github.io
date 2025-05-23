//
// Copyright (c) 2025 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_A2Pkeys.js

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
    this.bDebug = true;
    this.lastkey = 0x00;
    this.o = typeof(_o)=="undefined"?
    {"EMU_keyb_timer":false
    ,"EMU_keyb_active":false
    ,"EMU_keyb_el":null
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

    this.reset = function()
    {
        this.lastkey = 0x00;
        this.events_data.metabits = [0,0];  // trigger init of keyboard modifier states (capslock, shift, control...)
    }

    this.keystroke = function(data)
    {
        // pasteboard
        this.lastkey = data.keyCode | 0x80;
    }

    this.polling = function(key){ return key }    // override me if you need to take over the keyboard  
    this.stop_polling = function(){ this.polling = function(key){ return key } }    // override me if you need to take over the keyboard  
    this.strobe = function(){ this.lastkey &= 0x7f; return 0x00 } 

    this.KeyCodeHandler = function(arg,to)
    {
        var from = arg.type;
        var val  = arg.key;  if(val===undefined) return null;

        if(from=="keydown" && to=="A2_US"  // event -- _CFG_SYSCODE ==> keyfont
           || from=="click" && to=="A2_US")  // event -- _CFG_SYSCODE ==> keyfont
           {
            if(typeof(val)=="number") return val | 0x80;   // control characters are not translated

            if(arg.repeat==true) this.events_data.metabits[0] |= 0b100

            if(val.length==1 && (this.events_data.metabits[0] & this.events_data.metabitsEn["Control"])>0)
                return (val.codePointAt(0)-0x60) | 0x80;
            else if(val.length==1 && val.match(/[a-z]/))
                return (val.codePointAt(0)-0x20) | 0x80;
            else if(val.length==1 && val.match(/[A-Z1-9$*#!()'"%&-_ ]/))
                return val.codePointAt(0) | 0x80;
            else
            {
                switch(val)
                {
                    case "Enter":           return 0x0D | 0x80;
                    case "ArrowLeft":       return 0x08 | 0x80;
                    case "ArrowRight":      return 0x15 | 0x80;
                    case "Backspace":       return 0x08 | 0x80;
                    case "Dead":            return 0x5E | 0x80;
                    case "Escape":          return 0x1B | 0x80;
                    case "Reset":           apple2plus.reset(); return null;
                    case "POWER":           apple2plus.restart(); return null;
                    default: return null;     
                }
            }
        }
    }

    this.KbdCodeHandler = function(data)
    {
        console.warn("KbdCodeHandler() w/o implementation");
    }

    this.KbdHover = function(event)
    {
        //var loc = this.KbdButtonLocator(event);
        //document.getElementById(this.o.EMU_key_id).style.width = loc.w+"px";
        this.o.EMU_keyb_el = event.currentTarget;

        switch(event.type)
        {
            case "mousemove":
                this.o.EMU_keyb_el.style.opacity=1;
                this.o.EMU_keyb_active = true;
                this.o.EMU_keyb_timer  = true;
            break;        
            case "mouseout":
                this.o.EMU_keyb_timer = false;
                setTimeout( this.KbdHover_out , 2000, this);
            break;
            //case "touchstart":
            default:
                console.log("uncaptured event",event);
        }
    }

    this.KbdHover_out = function(t)
    {
        if(t.o.EMU_keyb_timer == true) return;
        t.o.EMU_keyb_el.style.opacity=0;
        t.o.EMU_keyb_active = false;
        t.o.EMU_keyb_timer  = false;
    }

    this.KbdHTML = function(args)
    {
        //this.defaults(args,["kbd_events","key_events","EMU_key_id","KBD_Yoff"]);

        var code = "";
        code += "<link rel='stylesheet' href='res/kb_new.css'>"
        code += "<style>"
        code += "@import url(https://fonts.googleapis.com/css?family=Fragment+Mono);"
        code += "#glyphScroller { opacity:1 }"
        code += "#keyboard .keycap .keylabel, #glyphScroller .keylabel { font-family: 'Fragment Mono'; font-weight: 400; }"
        code += "#keyboard .keycap .slightup, #glyphScroller .slightup { font-weight: 600; position: relative; top: -5px; }"
        code += "#keyboard .keycap .altfont, #glyphScroller .altfont { font-family: 'Arial'; position: relative; top: -3px; }"
        code += "</style>"

        code += "<div id=\"glyphScroller\" style=\"margin-left:50px;float:left;border:0px solid\" "
        +"onmousemove=oEMU.component.Keyboard.KbdHover(event) onmouseout=oEMU.component.Keyboard.KbdHover(event)>"
        code +="<div id=\"keyboard\" tabindex=\"0\" ui-keydown=\"{ left:'moveKeys(-moveStep,0,$event)',\n";
        code += "\t right:'moveKeys(moveStep,0,$event)',\n";
        code += "\t up:'moveKeys(0,-moveStep,$event)',\n";
        code += "\t down:'moveKeys(0,moveStep,$event)',\n";
        code += "\t 'shift-left':'sizeKeys(-sizeStep,0,$event)',\n";
        code += "\t 'shift-right':'sizeKeys(sizeStep,0,$event)',\n";
        code += "\t 'shift-up':'sizeKeys(0,-sizeStep,$event)',\n";
        code += "\t 'shift-down':'sizeKeys(0,sizeStep,$event)',\n";
        code += "\t 'pageup':'rotateKeys(-rotateStep,$event)',\n";
        code += "\t 'pagedown':'rotateKeys(rotateStep,$event)',\n";
        code += "\t 'ctrl-left':'moveCenterKeys(-moveStep,0,$event)',\n";
        code += "\t 'ctrl-right':'moveCenterKeys(moveStep,0,$event)',\n";
        code += "\t 'ctrl-up':'moveCenterKeys(0,-moveStep,$event)',\n";
        code += "\t 'ctrl-down':'moveCenterKeys(0,moveStep,$event)',\n";
        code += "\t delete:'deleteKeys()',\n";
        code += "\t insert:'addKey()',\n";
        code += "\t 74: 'prevKey($event)',\n";
        code += "\t 75: 'nextKey($event)',\n";
        code += "\t 'shift-74': 'prevKey($event)',\n";
        code += "\t 'shift-75': 'nextKey($event)',\n";
        code += "\t 113: 'focusEditor()',\n";
        code += "\t esc: 'unselectAll()',\n";
        code += "\t 'ctrl-65': 'selectAll($event)',\n";
        code += "\t 'ctrl-67 ctrl-45': 'copy($event)',\n";
        code += "\t 'ctrl-88 shift-46': 'cut($event)',\n";
        code += "\t 'ctrl-86 shift-45': 'paste($event)',\n";
        code += "\t 'ctrl-90' : 'undo()',\n";
        code += "\t 'ctrl-shift-90' : 'redo()',\n";
        code += "\t 'ctrl-89' : 'redo()' }\"  class=\"ng-binding\">\n";
        code += "\n";
        code += " <div id=\"keyboard-bg\" style=\"height:270px; width:729px; background-color:#F7EBD1;border-radius:6px 6px 12px 12px / 18px 18px 12px 12px; \">\n";
        code += "  \n";
        
        code +="<!-- ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:27px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:33px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:33px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"34D8\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">!</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">1</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:81px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:87px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:87px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"C598\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">\"</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">2</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:135px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:141px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:141px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"9558\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">#</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">3</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:189px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:195px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:195px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"671B\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">$</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">4</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:243px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:249px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:249px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"37DB\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">%</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">5</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:297px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:303px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:303px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"8434\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">&</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">6</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:351px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:357px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:357px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"965B\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">'</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">7</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:405px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:411px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:411px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"621E\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">(</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">8</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:459px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:465px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:465px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"32DE\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">)</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">9</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:513px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:519px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:519px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"54BF\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">0</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:567px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:573px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:573px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"C39E\">   <div class=\"keylabel keylabel1 textsize7\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">*</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">:</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:621px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:627px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:627px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"3DD1\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">=</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">-</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R1\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:675px;top:0px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:681px;top:4px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:681px;top:4px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BE4B\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">RESET</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:0px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:6px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:6px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"141D\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">ESC</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:54px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:60px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:60px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BC7E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">Q</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:108px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:114px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:114px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BEFE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">W</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:162px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:168px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:168px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B37E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">E</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:216px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:222px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:222px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BD3E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">R</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:270px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:276px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:276px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BFBE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">T</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:324px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:330px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:330px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"7A7F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">Y</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:378px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:384px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:384px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"7F7F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">U</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:432px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:438px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:438px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B67E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">I</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:486px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:492px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:492px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B4FE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">O</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:540px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:546px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:546px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"4C30\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">@</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">P</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:594px;top:54px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:600px;top:58px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:600px;top:58px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B63C\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">REPT</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R2\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:648px;top:54px;width:81px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:654px;top:58px;width:69px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:654px;top:58px;width:69px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"127D\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:63px; height:36px;\"> <div style=\"width:63px; max-width:63px; height:36px;\">RETURN</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:13.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:19.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:19.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"E568\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">CTRL</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:67.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:73.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:73.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"707F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">A</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:121.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:127.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:127.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"7DFF\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">S</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:175.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:181.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:181.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"73BF\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">D</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:229.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:235.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:235.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B23E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">F</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:283.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:289.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:289.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"26FC\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\"><div class=\"slightup\">BELL</div></div> </div>    <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">G</div> </div>   </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:337.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:343.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:343.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"76BF\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">H</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:391.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:397.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:397.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B73E\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">J</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:445.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:451.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:451.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"77FF\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">K</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:499.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:505.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:505.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B5BE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">L</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:553.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:559.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:559.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"935E\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">+</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">;</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:607.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:613.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:613.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"2C9E\">    <div class=\"keylabel keylabel4 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\"><div class=\"altfont\">←</div></div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R3\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:661.5px;top:108px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:667.5px;top:112px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:667.5px;top:112px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"ED1F\">    <div class=\"keylabel keylabel4 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\"><div class=\"altfont\">→</div></div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:13.5px;top:162px;width:81px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:19.5px;top:166px;width:69px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:19.5px;top:166px;width:69px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"E555\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:63px; height:36px;\"> <div style=\"width:63px; max-width:63px; height:36px;\">SHIFT</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:94.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:100.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:100.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"7B3F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">Z</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:148.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:154.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:154.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"BABE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">X</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:202.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:208.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:208.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"B1FE\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">C</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:256.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:262.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:262.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"7E3F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">V</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:310.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:316.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:316.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"713F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">B</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:364.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:370.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:370.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"E4B9\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">^</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">N</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:418.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:424.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:424.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"757F\">      <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">M</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:472.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:478.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:478.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"6062\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\"><</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">,</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:526.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:532.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:532.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"85E1\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">></div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">.</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:580.5px;top:162px;width:54px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:586.5px;top:166px;width:42px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:586.5px;top:166px;width:42px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"9C51\">   <div class=\"keylabel keylabel1 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">?</div> </div>     <div class=\"keylabel keylabel7 textsize6\" style=\"color:#fffffe; width:36px; height:36px;\"> <div style=\"width:36px; max-width:36px; height:36px;\">/</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA R4\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:634.5px;top:162px;width:81px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:640.5px;top:166px;width:69px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:640.5px;top:166px;width:69px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"E555\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#fffffe; width:63px; height:36px;\"> <div style=\"width:63px; max-width:63px; height:36px;\">SHIFT</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key CHICKLET\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:16.5px;top:219px;width:48px;height:48px;border-width:1px;border-radius:4px;background-color:#ffffff;\" class=\"keyborder\"></div> <div style=\"left:17.5px;top:220px;width:46px;height:44px;border:solid 1px rgba(0,0,0,0.1);background-color:#fffffe;border-radius:4px;\" class=\"keytop\"></div> <div style=\"left:17.5px;top:220px;width:46px;height:44px; padding: 4px;\" class=\"keylabels\" id=\"65F0\">    <div class=\"keylabel keylabel4 textsize2\" style=\"color:#080808; width:38px; height:36px;\"> <div style=\"width:38px; max-width:38px; height:36px;\">POWER</div> </div> </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() --><div class=\"key SA SPACE\"> <div class=\"keycap\" onmouseover=\"keycap_over(this)\" onmouseout=\"keycap_out(this)\" onclick=\"keycap_click(this)\"> <div style=\"left:148.5px;top:216px;width:432px;height:54px;border-width:1px;border-radius:5px;background-color:#8B7B65;\" class=\"keyborder\"></div> <div style=\"left:154.5px;top:220px;width:420px;height:42px;border:solid 1px rgba(0,0,0,0.1);background-color:#a89780;border-radius:5px;\" class=\"keytop\"></div> <div style=\"left:154.5px;top:220px;width:420px;height:42px; padding: 3px;\" class=\"keylabels\" id=\"FFFF\">   </div> </div></div>"
        code +="<!-- end ngRepeat: key in keys() -->"
        
        code += " </div>\n";
        code += " </div>\n";
        code += "</div>\n";

        if(args.id && document.getElementById(args.id))
            document.getElementById(args.id).innerHTML = code;
        else
            document.write(code);
    }

    this.metaConvert = function(arg,idx)
    {
        var En = arg.repeat ? "Repeat" : arg.key, ed = this.events_data;
        if(this.events_data.metabitsEn[En]===undefined) return ed.metabits[idx]  // didn't hit a meta key
        if(arg.getModifierState===undefined) return ed.metabits[idx] ^ ed.metabitsEn[En];
        return arg.getModifierState(arg.key) ? ed.metabits[idx] | ed.metabitsEn[En] : ed.metabits[idx] & (~ed.metabitsEn[En])
    }

    this.getKeyContent = function(el)
    {
        var s = new Array(); if(el === undefined) { console.warn("this.getKeyContent did not receive element") }
        for(const match of el.innerHTML.matchAll(/keylabel (keylabel[0-9]{1,2})/gm))                     // loop through all 'keylabel' (class names) in HTML
            s.push( oCOM.stripHTML(el.getElementsByClassName(match[1])[0].firstElementChild.innerHTML) ) // add enclosed HTML tag content
        return s.join("")  
    }

    this.getKeyHash16 = function(str)
    {
        var crc16 = oCOM.crc16( oCOM.toASCIIarr(str) );  // digest array of ascii codes (numbers)    
        return oCOM.getHexWord(crc16);
    }

    this.setKey = function(code,meta,idx)
    {
        this.events_data.metabits[idx] = (meta==null || meta===undefined)?0:meta;
        this.lastkey = (code==null || code===undefined)?this.lastkey:code;          // expose key code to emulator
        return {"code":code,"meta":meta}
    }

    this.events = function(arg)
    {
        if(this.events_data.metabits[0]==null && arg.getModifierState)     // init metabits (in case program starts while control is pressed or capslock active)
        {
            this.events_data.metabits[0] = 0;
            for(var en in this.events_data.metabitsEn) 
                if(arg.getModifierState(en)) this.events_data.metabits[0] |= this.events_data.metabitsEn[en];
        }
        var id_type = arg.srcElement.id+"_"+arg.type;
        switch(id_type)
        {
            case "applescreen_keydown":
                var d = {'key':arg.key,'meta':this.metaConvert(arg,0),'code':this.KeyCodeHandler(arg,"A2_US")}
                this.setKey(d.code,d.meta,0);
                if(this.bDebug) console.log((d.code!=null?"event":"METAevent")+"('"+id_type+"') = "+JSON.stringify({...d,'BINmeta':"0b"+oCOM.getBinMulti(d.meta,8),'HEXcode':"0x"+oCOM.getHexByte(d.code & (~0x80))}))
                arg.preventDefault();   // prevent browser side-effects while typing in window
                break;
            case "applescreen_keyup":
                var d = {'key':arg.key,'meta':this.metaConvert(arg,0),'code':this.KeyCodeHandler(arg,"A2_US")}
                this.setKey(null,d.meta,0);
                if(this.bDebug) console.log((d.code!=null?"event":"METAevent")+"('"+id_type+"') = "+JSON.stringify({...d,'BINmeta':"0b"+oCOM.getBinMulti(d.meta,8),'HEXcode':"0x"+oCOM.getHexByte(d.code & (~0x80))}))
                break;
            case "keycap_over":
                return function(t){ t.classList.replace("keycap","selected")  };
            case "keycap_out":
                return function(t){  t.classList.replace("selected","keycap") };   // deselect keycap
            case "keycap_click":
                return function(t)
                {
                    var _this  = oEMU.component.Keyboard;
                    var Hash16 = _this.getKeyHash16(_this.getKeyContent(t));
                    var lookup = _this.events_data.HTMLmap_A2_US[Hash16];
                    if(lookup===undefined) return console.warn("event "+id_type+" no mapping for "+_this.getKeyContent(t)+"("+Hash16+")")
                    var d = {'code':_this.KeyCodeHandler({"srcElement":{"id":"keycap"},"type":"click","key":lookup===undefined?"":lookup.val},"A2_US"),'meta':_this.metaConvert({"key":lookup.val},1),'Hash16':Hash16,'lookup':lookup}

                    // Shift-Control modifier
                    if((d.meta & _this.events_data.metabitsEn["Shift-Control"]) == _this.events_data.metabitsEn["Shift-Control"] && typeof(lookup["Shift-Control"])=="number" )
                        d.code =  _this.KeyCodeHandler({"srcElement":{"id":"keycap"},"type":"click","key":lookup["Shift-Control"]},"A2_US");
                    else
                    {
                        // Shift modifier
                        if((d.meta & _this.events_data.metabitsEn["Shift"]) == _this.events_data.metabitsEn["Shift"] && lookup["Shift"])
                            d.code =  _this.KeyCodeHandler({"srcElement":{"id":"keycap"},"type":"click","key":lookup["Shift"]},"A2_US");
                        // Control modifier
                        if((d.meta & _this.events_data.metabitsEn["Control"]) == _this.events_data.metabitsEn["Control"] && lookup["Control"] )
                            d.code =  _this.KeyCodeHandler({"srcElement":{"id":"keycap"},"type":"click","key":lookup["Control"]},"A2_US");
                    }
                    if(_this.events_data.postEvent.length>0)
                    {
                        for(var i=_this.events_data.postEvent.length-1;i>=0;i--)
                        {
                            var tt = _this.events_data.postEvent[i];
                            var h16 = _this.getKeyHash16(_this.getKeyContent(tt));
                            var lo = _this.events_data.HTMLmap_A2_US[h16];

                            // is meta button ?
                            // don't pop previous radio button if current is also radio button
                            if(_this.events_data.metabitsEn[lo.val]>0 && lookup.act != "radio")
                            {
                                d.meta &= ~(_this.events_data.metabitsEn[lo.val]); // pop out radio button
                                var opacity = "1";
                                var el_arr = document.querySelectorAll('#'+tt.lastElementChild.id);
                                for(var e=0; e<el_arr.length; e++) el_arr[e].parentNode.style.opacity = opacity;  // update all nodes with same id
                                _this.events_data.postEvent.splice(i,1);
                            }
                        }
                    }
                    if(lookup.act == "toggle") 
                    {
                        var opacity = _this.events_data.metabits[1] &  _this.events_data.metabitsEn[lookup.val] ?  "1" : "0.5";  // opacity according to toggle status
                        var el_arr = document.querySelectorAll('#'+t.lastElementChild.id);                // query all elements with same id
                        for(var e=0; e<el_arr.length; e++) el_arr[e].parentNode.style.opacity = opacity;  // update all nodes with same id
                    }
                    if(lookup.act == "radio")
                    { 
                        var opacity = _this.events_data.metabits[1] &  _this.events_data.metabitsEn[lookup.val] ?  "1" : "0.5";  // opacity according to toggle status
                        var el_arr = document.querySelectorAll('#'+t.lastElementChild.id);                // query all elements with same id
                        for(var e=0; e<el_arr.length; e++) el_arr[e].parentNode.style.opacity = opacity;  // update all nodes with same id
                        _this.events_data.postEvent.push(t);        // push in postevent queue for popping the radio button at next action
                    }
                    _this.setKey(d.code,d.meta,1);
                    if(_this.bDebug) console.log("event('"+id_type+"') = "+JSON.stringify({...d,'BINmeta':"0b"+oCOM.getBinMulti(d.meta,8),'HEXcode':"0x"+oCOM.getHexByte(d.code & (~0x80))}))              
                }
        }
    }

    this.events_data = 
    { 
         "postEvent": []
        ,"metabits": [0,0]
        ,"metabits_en":{"kbd":0b00000000,"vir":0b00000000}  // TODO USE ENUMERATION INSTEAD OF INDEXED
        ,"metabitsEn": {"Shift":0b00001,"CapsLock":0b00010,"Control":0b00100,"Shift-Control":0b00101,"Repeat":0b01000,"POWER":0b10000}
        ,"HTMLmap_A2_US":
        {
          "E568":{"val":"Control","act":"radio"}
         ,"127D":{"val":"Enter"}
         ,"141D":{"val":"Escape"}
         ,"B63C":{"val":"Repeat"}
         ,"2C9E":{"val":"ArrowLeft"}
         ,"ED1F":{"val":"ArrowRight"}
         ,"E555":{"val":"Shift","act":"radio"}
         ,"BE4B":{"val":"Reset"}
         ,"65F0":{"val":"POWER","act":"toggle"}
        
        ,"34D8":{"val":"1","Shift":"!"}
        ,"C598":{"val":"2","Shift":"\""}
        ,"9558":{"val":"3","Shift":"#"}
        ,"671B":{"val":"4","Shift":"$"}
        ,"37DB":{"val":"5","Shift":"%"}
        ,"8434":{"val":"6","Shift":"&"}
        ,"965B":{"val":"7","Shift":"'"}
        ,"621E":{"val":"8","Shift":"("}
        ,"32DE":{"val":"9","Shift":")"}
        ,"54BF":{"val":"0"}

        ,"BC7E":{"val":"Q","Control":0x11}
        ,"BEFE":{"val":"W","Control":0x17}
        ,"B37E":{"val":"E","Control":0x05}
        ,"BD3E":{"val":"R","Control":0x12}
        ,"BFBE":{"val":"T","Control":0x14}
        ,"7A7F":{"val":"Y","Control":0x19}
        ,"7F7F":{"val":"U","Control":0x15}
        ,"B67E":{"val":"I","Control":0x09}
        ,"B4FE":{"val":"O","Control":0x0F}
        ,"4C30":{"val":"P","Shift":"@","Control":0x10,"Shift-Control":0x00}
        ,"707F":{"val":"A","Control":0x01}
        ,"7DFF":{"val":"S","Control":0x13}
        ,"73BF":{"val":"D","Control":0x04}
        ,"B23E":{"val":"F","Control":0x06}
        ,"26FC":{"val":"G","Control":0x07}
        ,"76BF":{"val":"H","Control":0x08}
        ,"B73E":{"val":"J","Control":0x0A}
        ,"77FF":{"val":"K","Control":0x0B}
        ,"B5BE":{"val":"L","Control":0x0C}
        ,"7B3F":{"val":"Z","Control":0x1A}
        ,"BABE":{"val":"X","Control":0x18}
        ,"B1FE":{"val":"C","Control":0x03}
        ,"7E3F":{"val":"V","Control":0x16}
        ,"713F":{"val":"B","Control":0x02}
        ,"E4B9":{"val":"N","Shift":"^","Control":0x0E,"Shift-Control":0x1E}
        ,"757F":{"val":"M","Shift":"]","Control":0x0D}
 
        ,"935E":{"val":";","Shift":"+"}
        ,"6062":{"val":",","Shift":"<"}
        ,"85E1":{"val":".","Shift":">"}
        ,"9C51":{"val":"/","Shift":"?"}
        ,"C39E":{"val":":","Shift":"*"}
        ,"3DD1":{"val":"-","Shift":"="}
        ,"FFFF":{"val":" "}}
    }
    // https://retrocomputing.stackexchange.com/questions/12510/on-what-apple-ii-and-ii-keyboards-can-the-character-be-generated
    // http://absurdengineering.org/library/MASTER%20Tech%20Info%20Library/Apple%20II%20Hardware/Hardware%20Specifications/TIL01298%20-%20Apple%20II,%20II+,%20IIe,%20IIc%20-%20ASCII%20characters,%20values%20&%20keystrokes.pdf
}