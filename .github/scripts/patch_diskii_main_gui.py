from pathlib import Path

path = Path('res/EMU_apple2main.js')
text = path.read_text()


def must_replace(src, old, new):
    if old not in src:
        raise SystemExit('Missing expected block:\n' + old[:600])
    return src.replace(old, new, 1)


old_gui = '''    disk2.GUI_update = function(cmd)  // override (called continuously from oCOM.addRefreshEvent(apple2plus.DSK_monitoring,"DSK_monitoring",true);)
    {
        // CATCH CHANGES ONLY
        var state = this.getState();
        if(this.Pstate 
            && this.Pstate[0].motor == state.hw[0].motor
            && this.Pstate[1].motor == state.hw[1].motor
            && this.Pstate[0].b_diskData == (state.diskData[0]!=null)
            && this.Pstate[1].b_diskData == (state.diskData[1]!=null
            //|| cmd == "kbd"
            )) return;
            
        if(state.DSK_led.length) state.DSK_led = [document.getElementById("dskLED_D1"),document.getElementById("dskLED_D2")]
        if(state.hw[state.drv].motor==1) { state.DSK_led[state.drv].style.visibility = "visible"; }
        else state.DSK_led[state.drv].style.visibility = "hidden";
        //if(_o.EMU_keyb_active) { state.DSK_led[0].style.visibility="hidden"; state.DSK_led[1].style.visibility="hidden"; return }  // hide drive LED when shadowed by pop-up keyboard (fixed by z-index)

        // LID
        if(state.diskData[0]==null) state.DSK_lid[0].style.visibility="hidden";
        else state.DSK_lid[0].style.visibility="visible";

        if(state.diskData[1]==null) state.DSK_lid[1].style.visibility="hidden";
        else state.DSK_lid[1].style.visibility="visible";

        this.Pstate = [{"motor":state.hw[0].motor,"b_diskData":state.diskData[0]!=null}
                    ,{"motor":state.hw[1].motor,"b_diskData":state.diskData[1]!=null}
                    ,{"keyb_active":_o.EMU_keyb_active}
                    ];
    }
'''

new_gui = '''    disk2.GUI_update = function(cmd)  // override (called continuously from oCOM.addRefreshEvent(apple2plus.DSK_monitoring,"DSK_monitoring",true);)
    {
        // CATCH CHANGES ONLY
        var state = this.getState();
        if(this.Pstate 
            && this.Pstate[0].motor == state.hw[0].motor
            && this.Pstate[1].motor == state.hw[1].motor
            && this.Pstate[0].b_diskData == (state.diskData[0]!=null)
            && this.Pstate[1].b_diskData == (state.diskData[1]!=null
            //|| cmd == "kbd"
            )) return;

        if(typeof this.syncDriveVisuals == "function")
            this.syncDriveVisuals();

        this.Pstate = [{"motor":state.hw[0].motor,"b_diskData":state.diskData[0]!=null}
                    ,{"motor":state.hw[1].motor,"b_diskData":state.diskData[1]!=null}
                    ,{"keyb_active":_o.EMU_keyb_active}
                    ];
    }
'''

if old_gui in text:
    text = must_replace(text, old_gui, new_gui)
elif 'DSK_led' in text or 'DSK_lid' in text:
    raise SystemExit('Legacy Disk II GUI references remain but expected GUI block was not found')

old_init = '''    disk2.getState().DSK_led[0] = document.getElementById("dskLED_D1");        // required for GUI_update
    disk2.getState().DSK_led[1] = document.getElementById("dskLED_D2");

    disk2.getState().DSK_lid[0] = document.getElementById("dskLID_D1");        // required for GUI_update
    disk2.getState().DSK_lid[1] = document.getElementById("dskLID_D2");

'''

if old_init in text:
    text = must_replace(text, old_init, '')
elif 'dskLED_D' in text or 'dskLID_D' in text:
    raise SystemExit('Legacy Disk II DOM handle initializers remain but expected init block was not found')

path.write_text(text)
