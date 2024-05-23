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

var oEMUI = new EMUI();

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
_o.CPU_ClockTicks = _o.CPU_ClocksTicks_s / _o.EMU_Updates_s     // CPU clockTicks per Interval
oEMU.stats.EMU_DashboardRefresh_cy = Math.round(_o.EMU_Updates_s / _o.EMU_DashboardRefresh_s) // Dashboard refreshes per Cycle
oEMU.component.CPU["dutycycle_time"] = 0;
oEMU.component.CPU["dutycycle_idx"] = 0;

console.log("CPU clock : "+_o.CPU_ClockTicks+" ticks in "+_o.EMU_IntervalTime_ms/1000+" s = "+(1000*_o.CPU_ClockTicks/_o.EMU_IntervalTime_ms)+" ticks/s")
//oCOM = new COM();

var appleIntervalHandle,apple2plus,KeyboardFocus,keys;

function EMU_init()
{
    document.getElementById("LEDS").innerHTML =
     '<div class="appdskLED" id="LED1" style=""></div>'
     +'<div class="appdskLED" id="LED2" style=""></div>'

    // LOAD ANY CONFIGURATION VIA URI
    oCOM.URL.parse(document.location.toString());

    var def_sys = _TABS.tab1.DEF_SYS;
    //var bBoot = false;

    for(var uri in oCOM.URL.uri)
    {
        switch(uri)
        {
            case "sys":
                for(var i in oEMU.system) oEMU.system[i]["active"] = false;
                oEMU.system[oCOM.URL.uri[uri]] = {active:true};
                for(var i in _TABS) _TABS[i].DEF_SYS = oCOM.URL.uri[uri];
            break;
            case "gpu":
                // TODO initialise GPU algorithm instead of CPU
            break;
            case "mute":
            case "boot":    // boot must force mute since audioworklet does not cold-start (security)

                try
                {
                    oEMU.system[uri] = oCOM.URL.uri[uri]!="0" && oCOM.URL.uri[uri]!="false";

                    // TODO: check why this fails on older browsers
                    //oEMUI.muteBtn({id:'mutebutton',class1:'fa-volume-up',class2:'fa-volume-mute',override:oEMU.system[uri]==false}).muteAct();
                    //oCOM.POPUP.html("boot+mute OK");
    
                    var db = oCOM.base64ToArrayBuffer(disk2DOS);
                    const infla = new pako.Inflate();
                    infla.push(db);            
                    var dd = infla.result;

                    //oCOM.POPUP.html("boot 1.0 success: "+dd.length);

                    if(typeof(dd)!="undefined")
                        _o["D1_buffer"] = dd;
                }
                catch({ name, message })
                {
                    //oCOM.POPUP.html("boot 1.0 failed: "+name+" "+message);
                }

            break;
            case "D1":
                var dsk = oCOM.URL.uri["D1"];
                if(typeof(dsk)!="undefined" && dsk.length!=0)
                {
                    var db = oCOM.base64ToArrayBuffer(dsk);
                    if(db!=null)
                    {
                        const inflator = new pako.Inflate();
                        inflator.push(db);
                        var dd = inflator.result;
                        if(typeof(dd)!="undefined")
                        {
                            _o["D1_buffer"] = dd;
                            oCOM.POPUP.set_class(document.getElementById("restartbutton"),"appbut","appbut_flash",false);
                        }
                    }
                }
            break;
            case "D1_DIR":
                var dir_filename = oCOM.URL.uri["D1_DIR"];
                if(typeof(dir_filename)!="undefined" && dir_filename!=0)
                {
                    var dir = "https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/"
                    dir += dir_filename;
            
                    oCOM.GetHTTP(dir,"arraybuffer",
                    function()
                    {
                        var arraybuffer = this.response;
                        if(arraybuffer.byteLength<100)
                        {
                            var enc = new TextDecoder("utf-8");
                            console.warn("ERROR LOADING DISK: "+enc.decode(ui8));
                        }
                        else
                        {
                            //alert("async call succeeded "+ oCOM.URL.uri["boot"] + "*");
                            // async call to load disk into buffer mem and restart if boot
                            try{
                                _o["D1_buffer"] = new Uint8Array(arraybuffer);

                                    const deflator = new pako.Deflate( { level: 9} );
                                    deflator.push(new Uint8Array(arraybuffer), true);
                                    var b64 = btoa(deflator.result);

                                //var b64 = oCOM.ArrayBufferTobase64(arraybuffer);
                                //alert(b64.length/1024)

                                //oCOM.POPUP.html( oCOM.DumpBase64(b64,1024,"<br>") );

                                oCOM.POPUP.set_class(document.getElementById("restartbutton"),"appbut","appbut_flash",false);
                                if(oCOM.URL.uri["boot"])
                                {
                                    var vidContext = document.getElementById('applescreen');

                                    if(typeof(apple2plus)!="object") apple2plus     = new Apple2Plus(vidContext); // allow instantiating other systems
                                    apple2plus.restart();
                                }
                                //oCOM.POPUP.html("async call 1.0 succeeded, boot="+ oCOM.URL.uri["boot"]);
                            }
                            catch({ name, message })
                            {
                                //oCOM.POPUP.html("restart 1.0 failed: "+name+" "+message);
                            }
                        }
                    })
                }
            break;
        }
    }
        
    console.log(JSON.stringify(oEMU,null,"  "));

    // INITIALISE APPLE II+ EMULATOR
    var vidContext = document.getElementById('applescreen');
    if(typeof(apple2plus)!="object")
        apple2plus     = new Apple2Plus(vidContext); // allow instantiating other systems

    // overload restart initialisers (like loading disk)
    /*
    apple2plus.onrestart = function()
    {        
        try
        {               
            oCOM.POPUP.set_class(document.getElementById("restartbutton"),"appbut_flash","appbut",false);
            if(_o.D1_buffer===undefined) return;        
            loadDisk_fromBuffer(_o.D1_buffer,"D1");
            delete _o.D1_buffer;
        }
        catch(e)
        {
            alert("error in apple2plus.onrestart() "+e);
        }
    }
    */
    

    if(_o.D1_buffer===undefined); 
    else
    {
        loadDisk_fromBuffer(_o.D1_buffer,"D1");
        delete _o.D1_buffer;
        //oCOM.POPUP.html("loadDisk success");
    }


    apple2plus.restart(); // restart the AppleII+
    appleIntervalHandle = window.setInterval(apple2plus.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);

    var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{reset:function(){},DSK_led:null,active:false},"AppleDisk");
    keys = oCOM.default(oEMU.component.Keyboard,{KbdHover:function(){},cycle:function(){},keystroke:function(){}},"A2Pkeys");

    var s = disk2.active ? "apple2plus.DiskObj().GUI_update();":"" 
    keys.KbdHTML({id:"kbd",path:"res/"
                ,kbd_events:"onmousemove=keys.KbdHover(event);"+s+" onmouseout=keys.KbdHover(event)"
                ,key_events:"onclick=keys.keystroke(event)"});

    // OVERRIDE SEVERAL OBJECTS TO INTERACT WITH SPECIFIC GUI OBJECTS
    apple2plus.CPU_monitoring = function()  // override
    {
        document.getElementById("cpu_pct").value = Math.round(oEMU.component.CPU.dutycycle_time / oEMU.stats.EMU_DashboardRefresh_cy / _o.EMU_IntervalTime_ms *100) + "%"
    }

    disk2.dN_speed_update = function(pct)  // override
    {
        //var dsk = oEMU.component.IO.AppleDisk;
        var cent = 1200 * Math.log2(pct/100);
        this.dNd.detune = cent;
        //console.log("pct="+pct+" cent="+cent);
    }

    disk2.GUI_update = function(o)  // override
    {
        if(this.DSK_led.length) this.DSK_led = [document.getElementById("dskLED_D1"),document.getElementById("dskLED_D2")]
        if(_o.EMU_keyb_active) { this.DSK_led[0].style.visibility="hidden"; this.DSK_led[1].style.visibility="hidden"; return }  // hide drive LED when shadowed by pop-up keyboard
        if(o[this.drv].motor==1) { this.DSK_led[this.drv].style.visibility = "visible"; }
        else this.DSK_led[this.drv].style.visibility = "hidden";
    }
    
    // overrides function that defines conditions for having an active emulator keyboard
    // (should stop capture emulator keyboard events when focused on tabs other than the emulator)
    oEMU.component.Keyboard.isActive = function(bool)  // override
    {
        if(bool===undefined) return document.getElementById("tab1").checked;
        else var b = bool;
        return b;
    }

    disk2.DSK_led[0] = document.getElementById("dskLED_D1");        // required for GUI_update
    disk2.DSK_led[1] = document.getElementById("dskLED_D2");

    oCOM.addRefreshEvent(apple2plus.CPU_monitoring,"CPU_monitoring",false);
    oCOM.addRefreshEvent(apple2plus.MEM_monitoring,"MEM_monitoring",false);
    oCOM.addRefreshEvent(apple2plus.DSK_monitoring,"DSK_monitoring",true);
    //oCOM.addRefreshEvent(apple2plus.SND_monitoring,"SND_monitoring",false);

    var bBOOTmon = false;
    if(bBOOTmon)
    {
        document.getElementById("COM_popup").hidden = false;    // show COM popup
        document.getElementById("settings").hidden = false;     // show settings tab
        oCOM.POPUP.toggle_class(document.getElementById('MEM_monitoring'),'fa-stop-circle','fa-sync-alt'); // activate monitoring
        oCOM.toggleRefreshEvent('MEM_monitoring');  // immediately refresh memory map
    }

    //oCOM.POPUP.html(JSON.stringify(oEMU,null," "));

    /*
    // LOAD DISK IMAGE VIA URI PARAMETER (if any)
    var dir_filename = oCOM.URL.uri["D1_DIR"];
    if(typeof(dir_filename)!="undefined" && dir_filename!=0)
    {
        var dir = "https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/"
        dir += dir_filename;

        oCOM.GetHTTP(dir,"arraybuffer",
        function()
        {
            var arraybuffer = this.response;
            var ui8 = new Uint8Array(arraybuffer);
            if(arraybuffer.byteLength<100)
            {
                var enc = new TextDecoder("utf-8");
                console.warn("ERROR LOADING DISK: "+enc.decode(ui8));
            }
            else loadDisk_fromBuffer(ui8,"D1");
        })
    }
    */
}


function EMUI()
{
    this.cpuSld = function(el,id)
    {
      var max = el.max;
      var pct = 2*el.value/max;
      document.getElementById(id).innerHTML = Math.round(pct*10)*10+"%";
      _o.CPU_ClockTicks = Math.round( _o.CPU_ClocksTicks_s * pct / _o.EMU_Updates_s );
      window.clearInterval(appleIntervalHandle);
      appleIntervalHandle = window.setInterval(apple2plus.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);
      oEMU.component.IO.AppleDisk.dN_speed_update(pct*100);
      console.log("CPU clock : "+_o.CPU_ClockTicks+" ticks in "+_o.EMU_IntervalTime_ms/1000+" s = "+(1000*_o.CPU_ClockTicks/_o.EMU_IntervalTime_ms)+" ticks/s")
    }

    this.muteBtn = function(arg)
    {
        this.muteArg = arg;
        if((arg.disabled===undefined)==false)
            document.getElementById(arg.id).parentElement.disabled = !arg.disabled;

        if(arg.override===undefined || arg.override==null)
            oCOM.POPUP.toggle_class(document.getElementById(arg.id),arg.class1,arg.class2);
        else    // override = true = unmute
            oCOM.POPUP.set_class(document.getElementById(arg.id),arg.class1,arg.class2,arg.override)
        return this
    }

    this.muteAct = function(arg)
    {
        if(arg===undefined) arg = this.muteArg;
        var b = arg.override===undefined?
            (oCOM.POPUP.states[arg.id]==arg.class1):arg.override
        if(b)
        {
            oEMU.component.IO.AppleSpeaker.init("audio_ctx")
                .then(()=>{  oEMU.component.IO.AppleSpeaker.init("audio_on")  });  
            oEMU.component.IO.AppleDisk.init("audio_ctx")
                .then(()=>{  oEMU.component.IO.AppleDisk.init("audio_buffer") });
        }
        else
        {
            oEMU.component.IO.AppleSpeaker.init("audio_off").then(()=>{});
            oEMU.component.IO.AppleDisk.init("audio_off").then(()=>{});
        }
    }

    this.pauseBtn = function(arg)
    {
        var bPause = appleIntervalHandle != null;
        if (bPause) {
            oEMU.component.Keyboard.isActive(false);
            window.clearInterval(appleIntervalHandle); appleIntervalHandle = null;
            document.getElementById(arg.id).value = 'Pause ';
            document.getElementById(arg.id).innerHTML = '<i class="fa '+arg.class2+'"></i>';
        } else {
            oEMU.component.Keyboard.isActive(true);
            appleIntervalHandle = window.setInterval(apple2plus.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);
            document.getElementById(arg.id).value = 'Resume';
            document.getElementById(arg.id).innerHTML = '<i class="fa '+arg.class1+'"></i>';
        }

        var bMuted = oCOM.POPUP.get_state("mutebutton")=="fa-volume-mute";
        if (bPause) {
            // RUN->PAUSE: ONLY MUTE IF UNMUTED
            var o = oEMUI.muteBtn({id:'mutebutton',class1:'fa-volume-up',class2:'fa-volume-mute',override:!bMuted,disabled:false})
            if(!bMuted) o.muteAct();
        } else {
            // PAUSE->RUN: ALWAYS UNMUTE
            oEMUI.muteBtn({id:'mutebutton',class1:'fa-volume-up',class2:'fa-volume-mute',override:!bMuted,disabled:true})
                .muteAct();
        }
    }

    this.resetBtn = function() { apple2plus.reset() }
    this.restartBtn = function() { apple2plus.restart() }
}


function loadDisk_fromFile(file_obj,drv)
{
    var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{active:false},"AppleDisk");
    if(file_obj==null || disk2.active==false) {apple2plus.loadDisk([],drv); return}
    var file = file_obj.files[0];
    if (!file) return;

    oCOM.POPUP.set_class(document.getElementById("restartbutton"),"appbut","appbut_flash",false);
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
    try
    {
        var disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{active:false},"AppleDisk");
        if(disk2.active==false)
        { 
            oCOM.POPUP.html("disk2.active==false");
            return;
        }

        var bytes = Array.from(arr_buffer);
        if (bytes.length == 143360) bytes = disk2.convertDsk2Nib(bytes);
        apple2plus.loadDisk(bytes,"D1");
        highlight_appbut(document.getElementById("file_"+dsk),true);
        oCOM.POPUP.html("loadDisk_fromBuffer 1.0 success");
    }
    catch({ name, message })
    {
        oCOM.POPUP.html("loadDisk_fromBuffer 1.0 failed: "+name+" "+message);
    }
}

function ejectDisk(el,dsk)
{
  var fe = document.getElementById("file_"+dsk);
  fe.value = "";
  oCOM.POPUP.set_class(document.getElementById("restartbutton"),"appbut_flash","appbut",false);

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