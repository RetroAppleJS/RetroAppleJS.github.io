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
        ,"IO":{}
    }
    ,"stats":{}
}

_o.EMU_IntervalTime_ms = 1000/_o.EMU_Updates_s                  // Emulator Intervals per milisecond
_o.CPU_ClockTicks = _o.CPU_ClocksTicks_s / _o.EMU_Updates_s     // CPU clockTicks per Cycle
oEMU.stats.EMU_DashboardRefresh_cy = Math.round(_o.EMU_Updates_s / _o.EMU_DashboardRefresh_s) // Dashboard refreshes per Cycle
oEMU.component.CPU["dutycycle_time"] = 0;
oEMU.component.CPU["dutycycle_idx"] = 0;

console.log("CPU clock : "+_o.CPU_ClockTicks+" ticks in "+_o.EMU_IntervalTime_ms/1000+" s = "+(1000*_o.CPU_ClockTicks/_o.EMU_IntervalTime_ms)+" ticks/s")
//oCOM = new COM();

var appleIntervalHandle,vidContext,apple2plus,KeyboardFocus;


function EMU_init()
{
    // INITIALISE APPLE II+ EMULATOR
    vidContext          = document.getElementById('applescreen').getContext("2d");
    apple2plus          = new Apple2Plus(vidContext); // allow instantiating other systems
    appleIntervalHandle = window.setInterval(apple2plus.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);

    var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{reset:function(){},DSK_led:[],active:false},"AppleDisk");

    if(disk2.active) oEMU.component.Keyboard.KbdHTML({id:"kbd",path:"res/"
                ,kbd_events:"onmousemove=apple2plus.keysObj().KbdHover(event);apple2plus.DiskObj().hide('D1');apple2plus.DiskObj().hide('D2') onmouseout=apple2plus.keysObj().KbdHover(event)"
                ,key_events:"onclick=apple2plus.keysObj().keystroke(event)"});

    

    oCOM.addRefreshEvent(apple2plus.CPU_monitoring,"CPU_monitoring",false);
    oCOM.addRefreshEvent(apple2plus.MEM_monitoring,"MEM_monitoring",false);
    oCOM.addRefreshEvent(apple2plus.DSK_monitoring,"DSK_monitoring",true);
    //oCOM.addRefreshEvent(apple2plus.SND_monitoring,"SND_monitoring",false);

    disk2.DSK_led[0] = document.getElementById("dskLED_D1");
    disk2.DSK_led[1] = document.getElementById("dskLED_D2");

    disk2.update = function(o)
    {
        if(_o.EMU_keyb_active) return;  // don't update drive LED when shadowed by pop-up keyboard
        if(o[this.drv].motor==1) { this.DSK_led[this.drv].style.visibility = "visible"; }
        else this.DSK_led[this.drv].style.visibility = "hidden";
    }
    
    // overrides function that defines conditions for having an active emulator keyboard
    // (should stop capture emulator keyboard events when focused on tabs other than the emulator)
    oEMU.component.Keyboard.isActive = function(bool)
    {
        if(bool===undefined) return document.getElementById("tab1").checked;
        else var b = bool;
        return b;
    }

    var bBOOTmon = false;
    if(bBOOTmon)
    {
        document.getElementById("COM_popup").hidden = false;    // show COM popup
        document.getElementById("settings").hidden = false;     // show settings tab
        oCOM.POPUP.toggle_class(document.getElementById('MEM_monitoring'),'fa-stop-circle','fa-sync-alt'); // activate monitoring
        oCOM.toggleRefreshEvent('MEM_monitoring');  // immediately refresh memory map
    }

    //oCOM.POPUP.html(JSON.stringify(oEMU,null," "));
    console.log(JSON.stringify(oEMU,null,"  "));

    // LOAD DISK IMAGE VIA URI PARAMETER (if any)
    oCOM.URL.parse(document.location.toString());
    var dsk = oCOM.URL.uri["D1"];
    if(dsk===undefined || dsk.length==0) return null;

    var db = oCOM.base64ToArrayBuffer(dsk);
    if(db==null) return null;

    const inflator = new pako.Inflate();
    inflator.push(db);

    var dd = inflator.result;
    if(dd===undefined) return null;
    loadDisk_fromBuffer(dd,"D1");
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
        oEMU.component.Keyboard.isActive(false);
        window.clearInterval(appleIntervalHandle);
        appleIntervalHandle = null;
        document.getElementById('pausebutton').value = 'Resume';
        document.getElementById('pausebutton').innerHTML = '<i class="fa fa-play"></i>';
    } else {
        oEMU.component.Keyboard.isActive(true);
        appleIntervalHandle = window.setInterval(apple2plus.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);
        document.getElementById('pausebutton').value = 'Pause ';
        document.getElementById('pausebutton').innerHTML = '<i class="fa fa-pause"></i>';
    }
}

function loadDisk_fromFile(file_obj,drv)
{
    var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{active:false},"AppleDisk");

    if(file_obj==null || disk2.active==false) {apple2plus.loadDisk([],drv); return}
    var file = file_obj.files[0];
    if (!file) return;

    highlight_appbut(file_obj,true);

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
        
                if (size == 143360) bytes = disk2.convertDsk2Nib(bytes);
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
        
                if (size == 143360) bytes = disk2.convertDsk2Nib(bytes);
                apple2plus.loadDisk(bytes,"D2");
            }            
        break; 
    }
}

function loadDisk_fromBuffer(arr_buffer,dsk)
{
    var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{active:false},"AppleDisk");
    if(disk2.active==false) return;

    var bytes = Array.from(arr_buffer);
    if (bytes.length == 143360) bytes = disk2.convertDsk2Nib(bytes);
    apple2plus.loadDisk(bytes,"D1");
    highlight_appbut(document.getElementById("file_"+dsk),true);
}

function ejectDisk(el,dsk)
{
  var fe = document.getElementById("file_"+dsk);
  fe.value = "";

  var d = oCOM.URL.uri[dsk];
  if(d)
  {
    // URI is filled
    el.type='submit';
    el.submit();
  }
  else
  {
    highlight_appbut(el,false);
    el.type='button';
  }
}

function highlight_appbut(el,bool)
{
    el.parentElement.style.backgroundColor = bool?"rgb(255,255,255,0.95)":""
}