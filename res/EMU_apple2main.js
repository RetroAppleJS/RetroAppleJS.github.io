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

function loadDisk()
{
    var file = document.getElementById('loadfile').files[0];
    if (!file) return;

    var fread = new FileReader();
    fread.readAsArrayBuffer(file);
    fread.onload = function(levent)
    {
        var data = new DataView(levent.target.result);
        var size = levent.target.result.byteLength;
        var bytes = Array(size);
        for (var i = 0; i < size; i++)
            bytes[i] = data.getUint8(i);

        //dumpdisk(bytes);

        if (size == 143360) bytes = apple2ConvertDskToNib(bytes);
        apple2plus.loadDisk(bytes);
    }
}

function dumpdisk(bytes)
{
    var s_arr = [];
    var TRACK_SIZE =    6656;
    for(var _t=0;_t<35;_t++)  // ITERATE THROUGH TRACKS
    {
        s_arr[s_arr.length] = "track $"+oCOM.getHexByte(_t);
        var SECTOR_SIZE = TRACK_SIZE / 16;
        for(var _s=0;_s<16;_s++)
        {
            s_arr[s_arr.length] = "sector $"+oCOM.getHexByte(_s)
            // ITERATE THROUGH SECTORS
            var s = "";
            for(var _offset=0;_offset<SECTOR_SIZE;_offset++)
            {
                var idx = _t * TRACK_SIZE + _s * SECTOR_SIZE + _offset;
                var n = bytes[idx]// ^ 255
                s += oCOM.getHexByte(n);
                if((idx%4)==3) s+= " ";
            }
            s_arr[s_arr.length] += s;
        }
    }
    return s_arr;
}

// Convert a DSK file to a NIB image.
//
function apple2ConvertDskToNib(dskBytes)
{
    var sixTwo = [
        0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
        0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
        0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
        0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
        0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
        0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
        0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
        0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff ];
    var secSkew = [ 0x0, 0x7, 0xe, 0x6, 0xd, 0x5, 0xc, 0x4, 0xb, 0x3, 0xa, 0x2, 0x9, 0x1, 0x8, 0xf ];
    var bytes = new Array(232960);
    var prenib = new Array(342);
    var offs;

    // Odd-even encoding for sector headers.
    function split_OddEven(b)
    {
        return [0xaa | (b >> 1),0xaa | b]
    }

    function join_OddEven(b1,b2)
    {
        return (((b1<<1)+1) & b2)
    }

    function addBytes(b_arr)
    {
        for(var i=0;i<b_arr.length;i++)
            bytes[offs++] = b_arr[i];
    }

    for (var track = 0; track < 35; track++) {
        offs = track * 6656;
        for (var sec = 0; sec < 16; sec++) {

            // 20 Sync bytes
            addBytes([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);

            // Addr field prologue
            addBytes([0xd5,0xaa,0x96]);

            addBytes(split_OddEven(254));                 // Volume
            addBytes(split_OddEven(track));               // Track
            addBytes(split_OddEven(sec));                 // Sector
            addBytes(split_OddEven(254 ^ track ^ sec));   // Checksum

            // Addr field epilogue
            addBytes([0xde,0xaa,0xeb]);

            // 20 Sync bytes
            addBytes([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);

            // Data field prologue
            addBytes([0xd5,0xaa,0xad]);

            // Start by prenibbilizing
            var doffs = secSkew[sec] * 256 + track * 4096;
            for (i = 0; i < 256; i++) {
                var d8 = dskBytes[doffs + i];
                prenib[i] = (d8 >> 2);

                if (i < 86)
                    prenib[256 + 85 - i] =
                        ((d8 & 0x02) >> 1) | ((d8 & 0x01) << 1);
                else if (i < 172)
                    prenib[256 + 171 - i] |=
                        (((d8 & 0x02) << 1) | ((d8 & 0x01) << 3));
                else
                    prenib[256 + 257 - i] |=
                        (((d8 & 0x02) << 3) | ((d8 & 0x01) << 5));

                if (i < 2)
                    prenib[257 - i] |=
                        (((d8 & 0x02) << 3) | ((d8 & 0x01) << 5));
            }

            // Encode nibbilized data.
            var prev = 0;
            for (i = 0; i < 86; i++) {
                addBytes([ sixTwo[prev ^ prenib[256 + 85 - i]] ]);
                prev = prenib[256 + 85 - i];
            }
            for (i = 0; i < 256; i++) {
                addBytes([ sixTwo[prev ^ prenib[i]] ]);
                prev = prenib[i];
            }
            addBytes([ sixTwo[prev] ]);

            // Data field epilogue
            addBytes([0xde,0xaa,0xeb]);
        }

        // fill out with sync bytes until end of track.
        var bytes2EOT = (track+1) * 6656 - offs;
        addBytes( [...new Array(bytes2EOT)].map(()=> 0xff) );
    }
    return bytes;
}

function apple2ConvertNibToDsk(nibBytes)
{
    alert("test")
}