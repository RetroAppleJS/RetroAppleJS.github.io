//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2disk2.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"AppleDisk":new AppleDisk2()}}}  // AppleDisk = IO card, AppleDisk2 = drive #1

function AppleDisk2(driveNr)
{

    var MOTOR_OFF =     0x08,
        MOTOR_ON =      0x09,
        DRV0EN =        0x0a,
        DRV1EN =        0x0b,
        Q6L =           0x0c,
        Q6H =           0x0d,
        Q7L =           0x0e,
        Q7H =           0x0f;
    var TRACK_SIZE =    6656;

    var track = 20, phase = 0, data_latch = 0;
    var motor = 0, drv1 = 0, q6 = 0, q7 = 0;
    var offset = 0;

    this.diskBytes = null;      // disk content
    this.driveNr = driveNr===undefined?"D1":driveNr;
    this.bHidden = false;

    this.reset = function() {
        phase = 0;
        motor = 0;
        drv1 = 0;
        offset = 0;
        q6 = 0;
        q7 = 0;
    }

    this.update = function(drv1)    // private function
    {
        if(_o.EMU_keyb_active) return;  // don't update drive LED when shadowed by pop-up keyboard
        if(motor==1) { document.getElementById("dskLED"+(drv1+1)).style.visibility = "visible"; }
        else document.getElementById("dskLED"+(drv1+1)).style.visibility = "hidden";
    }
    

//  ██████  ███████  █████  ██████  
//  ██   ██ ██      ██   ██ ██   ██ 
//  ██████  █████   ███████ ██   ██ 
//  ██   ██ ██      ██   ██ ██   ██ 
//  ██   ██ ███████ ██   ██ ██████  

    this.read = function(addr) {
        //console.log("AppleDisk2: read %s", addr.toString(16));

        if (addr < 0x08) {
            // Stepper motor on.
            if ((addr & 1) != 0) {
                var p = ((addr >> 1) & 3); // phase we're turning on.

                if (((phase + 1) & 3) == p) {
                    // Ascending order, track arm moves inward.
                    phase = p;
                    if ((phase & 1) == 0) {
                        if (++track >= 35)
                            track = 35;
                    }
                }
                else if (((phase - 1) & 3) == p) {
                    // Descending order, track arm moves outward.
                    phase = p;
                    if ((phase & 1) == 0) {
                        if (--track < 0)
                            track = 0; // CLICK! CLICK! CLICK!
                    }
                }
            }
        }
        else {
            switch (addr) {
            case MOTOR_OFF:
                motor = 0;
                this.update(drv1);
                break;
            case MOTOR_ON:
                motor = 1;
                this.update(drv1)
                break;
            case DRV0EN:
                drv1 = 0;
                break;
            case DRV1EN:
                drv1 = 1;
                break;
            case Q6L:
                q6 = 0;
                // Strobe Data Latch for I/O
                if (!this.diskBytes || !motor || drv1)
                    return 0xff;
                else {
                    if (++offset == TRACK_SIZE)
                        offset = 0;
                    if (q7) {
                        // Write to disk.  Sortof works!
                        this.diskBytes[track * TRACK_SIZE + offset] =
                            data_latch;
                        return data_latch; // ???
                    }
                    else
                        // Read from disk.
                        return this.diskBytes[track * TRACK_SIZE + offset];
                }
                // NOTREACHED
            case Q6H:
                // Load data latch.  Also sense write-protect but defaults
                // to zero below anyway.
                q6 = 1;
                break;
            case Q7L:
                // Prepare latch for input.
                q7 = 0;
                break;
            case Q7H:
                // Prepare latch for output.
                q7 = 1;
                break;
            }
        }

        return 0x00;
    } // read


//  ██     ██ ██████  ██ ████████ ███████ 
//  ██     ██ ██   ██ ██    ██    ██      
//  ██  █  ██ ██████  ██    ██    █████   
//  ██ ███ ██ ██   ██ ██    ██    ██      
//   ███ ███  ██   ██ ██    ██    ███████ 


    this.write = function(addr, d8) {
        // console.log("AppleDisk2: write %s %s", addr.toString(16),
        //            d8.toString(16));
        if (addr == Q6H)
            data_latch = d8;
    }

//  ██████  ███████ ██   ██     ██████      ███    ██ ██ ██████  
//  ██   ██ ██      ██  ██           ██     ████   ██ ██ ██   ██ 
//  ██   ██ ███████ █████        █████      ██ ██  ██ ██ ██████  
//  ██   ██      ██ ██  ██      ██          ██  ██ ██ ██ ██   ██ 
//  ██████  ███████ ██   ██     ███████     ██   ████ ██ ██████  

    this.convertDsk2Nib = function(dskBytes)
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
        function split_OddEven(b) { return [0xaa | (b >> 1),0xaa | b] }
        function join_OddEven(b1,b2) { return (((b1<<1)+1) & b2) }
        function addBytes(b_arr) { for(var i=0;i<b_arr.length;i++) bytes[offs++] = b_arr[i] }
  
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
                addBytes([ sixTwo[prev] ]); // add one byte
  
                // Data field epilogue
                addBytes([0xde,0xaa,0xeb]);
            }
  
            // fill out with sync bytes until end of track.
            var bytes2EOT = (track+1) * 6656 - offs;
            addBytes( [...new Array(bytes2EOT)].map(()=> 0xff) );
        }
        return bytes;
    }    
}
