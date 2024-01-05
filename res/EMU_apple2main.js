// 2022 adaptations by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// Thanks to Thomas Skibo - Copyright (c) 2014.
// apple2main.js 

// TODO FVD select here which system to run (Apple2plus - Apple2e - Apple2c ??) 
// TODO FVD transform this into OOP

//   ________                       __          _                   
//  |_   __  |                     [  |        / |_                 
//    | |_ \_| _ .--..--.  __   _   | |  ,--. `| |-' .--.   _ .--.  
//    |  _| _ [ `.-. .-. |[  | | |  | | `'_\ : | | / .'`\ \[ `/'`\] 
//   _| |__/ | | | | | | | | \_/ |, | | // | |,| |,| \__. | | |     
//  |________|[___||__||__]'.__.'_/[___]\'-;__/\__/ '.__.' [___]    
//   __        _          __              _                  _      
//  [  |  _   (_)        [  |  _         / |_               / |_    
//   | | / ]  __   .---.  | | / ]  .--. `| |-',--.   _ .--.`| |-'   
//   | '' <  [  | / /'`\] | '' <  ( (`\] | | `'_\ : [ `/'`\]| |     
//   | |`\ \  | | | \__.  | |`\ \  `'.'. | |,// | |, | |    | |,    
//  [__|  \_][___]'.___.'[__|  \_][\__) )\__/\'-;__/[___]   \__/ 

oCOM.addToEventStack("onload",EMU_init); // EMULATOR KICKSTART

// global data initializations
const _o = {"tools":{}
        ,"sys":{}
        ,"EMU_keyb_timer":false
        ,"EMU_keyb_active":false
        ,"EMU_kbd_id":"kbdimg"
        ,"EMU_key_id":"keybox"
        ,"KBD_Xoff":-6
        ,"KBD_Yoff":0       
        ,"EMU_Updates_s":10                 // Emulator intervals per second 
        ,"EMU_DashboardRefresh_s":2         // Dashboard updates per second      
        ,"CPU_ClocksTicks_s":1000000        // CPU clocksTicks per second
    };

var oEMU =
{
     "system":{}
    ,"component":
    {
         "CPU":{}
        ,"Video":{}
        ,"Keyboard":{}
        ,"RAM":{}
        ,"ROM":{}
        ,"Speaker":{}
        ,"IO":{}
    }
    ,"stats":{}
}

_o.EMU_IntervalTime_ms = 1000/_o.EMU_Updates_s                  // Emulator Intervals per milisecond
_o.CPU_ClockTicks = _o.CPU_ClocksTicks_s / _o.EMU_Updates_s     // CPU clockTicks per Cycle
oEMU.stats.EMU_DashboardRefresh_cy = Math.round(_o.EMU_Updates_s / _o.EMU_DashboardRefresh_s) // Dashboard refreshes per Cycle
oEMU.CPU_dutycycle_time = oEMU.CPU_dutycycle_idx = 0;

console.log("CPU clock : "+_o.CPU_ClockTicks+" ticks in "+_o.EMU_IntervalTime_ms/1000+" s = "+(1000*_o.CPU_ClockTicks/_o.EMU_IntervalTime_ms)+" ticks/s")
//oCOM = new COM();

var appleIntervalHandle,vidContext,apple2plus,bKeyboardFocus;


function EMU_init()
{
    console.log(JSON.stringify(oEMU,null,"  "));

    // INITIALISE EMULATOR
    appleIntervalHandle = window.setInterval(appleInterval,_o.EMU_IntervalTime_ms);
    vidContext          = document.getElementById('applescreen').getContext("2d");
    apple2plus          = new Apple2Plus(vidContext); // allow instantiating other systems

    oCOM.addRefreshEvent(apple2plus.CPU_monitoring,"CPU_monitoring",false);
    oCOM.addRefreshEvent(apple2plus.MEM_monitoring,"MEM_monitoring",false);
    
    var bBOOTmon = false;
    if(bBOOTmon)
    {
        document.getElementById("COM_popup").hidden = false;    // show COM popup
        document.getElementById("settings").hidden = false;     // show settings tab
        oCOM.onPopUpClass(document.getElementById('MEM_monitoring'),'fa-stop-circle','fa-sync-alt'); // activate monitoring
        oCOM.toggleRefreshEvent('MEM_monitoring');  // immediately refresh memory map
    }

}

function attachKeyboard(bEnable)
{
    if(bEnable) window.onkeypress  = apple2plus.keystroke;
    else window.onkeypress  = null;
}

// TODO rename to sreenIntervalFunc
function appleInterval()
{
    apple2plus.cycle(_o.CPU_ClockTicks);
    // TODO: SET KEYBOARDFOCUS STATE ONLY ON TAB CHANGE EVENT
    bKeyboardFocus = document.getElementById("tab1").checked;
    attachKeyboard(bKeyboardFocus);
}

function resetButton() {
    apple2plus.reset();
}

function restartButton() {
    apple2plus.restart();
}

function pauseButton()
{
    if (appleIntervalHandle != null) {
        attachKeyboard(false);
        window.clearInterval(appleIntervalHandle);
        appleIntervalHandle = null;
        document.getElementById('pausebutton').value = 'Resume';
        document.getElementById('pausebutton').innerHTML = '<i class="fa fa-play"></i>';
    } else {
        attachKeyboard(true);
        appleIntervalHandle = window.setInterval("appleInterval()",
        _o.EMU_IntervalTime_ms);
        document.getElementById('pausebutton').value = 'Pause ';
        document.getElementById('pausebutton').innerHTML = '<i class="fa fa-pause"></i>';
    }
}

function loadDisk(drv)
{
    var file = document.getElementById('loadfile_'+drv).files[0];
    if (!file) return;

    switch(drv)
    {
        case "D1":
            var fread1 = new FileReader();
            fread1.readAsArrayBuffer(file);
            fread1.onload = function(levent)
            {
                var data = new DataView(levent.target.result);
                var size = levent.target.result.byteLength;
                var bytes = Array(size);
                for (var i = 0; i < size; i++)
                    bytes[i] = data.getUint8(i);
        
                //dumpdisk(bytes);
        
                if (size == 143360) bytes = apple2plus.DiskObj("D1").convertDsk2Nib(bytes);
                apple2plus.loadDisk(bytes,"D1");
            }            
        break;
        case "D2":
            var fread2 = new FileReader();
            fread2.readAsArrayBuffer(file);
            fread2.onload = function(levent)
            {
                var data = new DataView(levent.target.result);
                var size = levent.target.result.byteLength;
                var bytes = Array(size);
                for (var i = 0; i < size; i++)
                    bytes[i] = data.getUint8(i);
        
                //dumpdisk(bytes);
        
                if (size == 143360) bytes = apple2plus.DiskObj("D2").convertDsk2Nib(bytes);
                apple2plus.loadDisk(bytes,"D2");
            }            
        break; 
    }
}
