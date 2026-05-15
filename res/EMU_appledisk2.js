// 2022 Adaptation by Freddy Vandriessche, from Thomas Skibo.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2disk2.js

// Add object to device registry
if(oEMU===undefined) var oEMU = {"component":{"IO":{"AppleDisk":new AppleDisk2()}}}  // AppleDisk = IO card, AppleDisk2 = drive #1
else oEMU.component.IO.AppleDisk = new AppleDisk2();

// TODO: ADD A LOGGING FUNCTION THAT ONLY TRACKS INFORMATIONS THAT CHANGE!

function AppleDisk2()
{
    var bDebug   = true;
    var bDebug_N = true;   // debug disk noise only 

    this.id = {"PCODE":"DISKII", "icon":"fa fa-save"};
    this.state = 
    {
        "active":true
        ,"drive_enable":0
        ,"drv":0
        ,"DSK_led" :[]
        ,"DSK_lid":[]
        ,"diskData":[null,null]
        ,"hw":[{
             "track":0
            ,"phase":0
            ,"data_latch":0
            ,"motor":0
            ,"q6":0
            ,"q7":0
            ,"offset":0
            ,"stats":{
                "motor":0
                ,"track":0
                ,"read":0
                ,"write":0
                ,"motorOffTimer":null
            }
            ,"LED":false
        },{
             "track":0
            ,"phase":0
            ,"data_latch":0
            ,"motor":0
            ,"q6":0
            ,"q7":0
            ,"offset":0
            ,"stats":{
                "motor":0
                ,"track":0
                ,"read":0
                ,"write":0
                ,"motorOffTimer":null
            }
            ,"LED":false
        }]
    };

    // relative peripheral addresses
    const MOTOR_OFF =   0x08,
        MOTOR_ON =      0x09,
        DRV0EN =        0x0a,
        DRV1EN =        0x0b,
        Q6L =           0x0c,
        Q6H =           0x0d,
        Q7L =           0x0e,
        Q7H =           0x0f;
    const TRACK_SIZE =  6656;


    this.applyDriveEnable = function(reason)
    {
        var deviceN = this.state.drv;
        var enabled = this.state.drive_enable ? 1 : 0;

        for (var i = 0; i < this.state.hw.length; i++)
        {
            var oldMotor = this.state.hw[i].motor;
            var newMotor = (enabled && i == deviceN) ? 1 : 0;
            this.state.hw[i].motor = newMotor;
            if (oldMotor != newMotor)
            {
                this.traceChange(
                    newMotor ? "MOTOR_ON" : "MOTOR_OFF",
                    i,
                    "motor",
                    oldMotor,
                    newMotor,
                    {"reason":reason}
                );

                if (newMotor) this.cancelTrackStatsFlush(i);
                else this.scheduleTrackStatsFlush(i, "SPINDOWN", 1000);
            }
        }
    };

    this.init = async function(action)
    {
        switch(action)
        {
            case "audio_ctx":
                if(this.audio===undefined)
                {
                    this.audio = new AudioContext({ latencyHint: 'interactive', sampleRate: this.sampleRate },"apple_disk2");
                    this.gain  =  this.audio.createGain();
                    this.gain.gain.value = 0.1;
                    //this.audio.audioWorklet.addModule(s_worklet_js); // Load an this.audio worklet
                } else this.audio.resume();
                this.dNd.enable = true;
            break;
            case "audio_buffer":
                for(var sample in dN_samples) // check if any data is already loaded -> if so, skip!
                    if( typeof(dN_samples[sample].audio) != "undefined") return;

                this.s_load_all(dN_samples).then((response) => 
                { 
                    var i = 0;
                    for(var name in dN_samples)
                    {
                        dN_samples[name].audio = response[i++];
                        dN_samples[name].audio.sampleRate = this.sampleRate;
                        delete dN_samples[sample].src;    // free .wav file memory space (keep audio)
                    }
                });
            break;
            case "audio_off":
                this.dNd.enable = false;
                if(this.audio===undefined) return;
                //try{ this.gain.disconnect(this.audio.destination) } catch(e) { console.warn("this.gain.disconnect(this.audio.destination)") }
                for(var name in this.AUD_buffer)
                    if(this.AUD_buffer[name].loop) try{ this.AUD_buffer[name].disconnect(this.gain) } catch(e) { console.warn("this.AUD_buffer['"+name+"'].disconnect(this.gain)") }
  
                this.audio.suspend();
            break;
        }
    }

    // Do not reset hw[n].track here.
    // A CPU reset does not mechanically move the Disk II head.
    this.reset = function() 
    {
        this.state.drive_enable = 0;
        this.state.hw[0].phase = 0;
        this.state.hw[0].motor = 0;
        this.state.hw[0].q6 = 0;
        this.state.hw[0].q7 = 0;
        this.state.hw[0].offset = 0;

        this.state.hw[1].phase = 0;
        this.state.hw[1].motor = 0;
        this.state.hw[1].q6 = 0;
        this.state.hw[1].q7 = 0;
        this.state.hw[1].offset = 0;

        this.state.drv = 0;
        this.cancelTrackStatsFlush(0);
        this.cancelTrackStatsFlush(1);
    }

    this.getDataObj = function() { return this.state.hw }

    this.GUI_update = function() {}   // overridable function to update drive status (LED)
    
    this.update_logs = function(name) {}   // overridable function
    
    this.flushTrackStats = function(deviceN, reason)
    {
        if (!bDebug) return;
        if (deviceN === undefined) deviceN = this.state.drv;

        var hw = this.state.hw[deviceN];
        if (!hw || !hw.stats) return;

        var stats = hw.stats;
        var track = stats.track;

        // Avoid noisy empty messages.
        if ((stats.read || 0) == 0 && (stats.write || 0) == 0)
            return;

        console.log(
            "AppleDisk2: D%d track %d - bytes R/W %d / %d %s",
            deviceN + 1,
            track,
            stats.read || 0,
            stats.write || 0,
            reason ? "("+reason+")":""
        );

        stats.read = 0;
        stats.write = 0;
        stats.track = hw.track;
    };


    this.scheduleTrackStatsFlush = function(deviceN, reason, delay)
    {
        if (deviceN === undefined) deviceN = this.state.drv;
        if (delay === undefined) delay = 1000;

        var hw = this.state.hw[deviceN];
        if (!hw || !hw.stats) return;

        var stats = hw.stats;
        var disk2 = this;

        if (stats.motorOffTimer)
            clearTimeout(stats.motorOffTimer);

        stats.motorOffTimer = setTimeout(function()
        {
            stats.motorOffTimer = null;

            // Only flush if this drive is still spun down.
            // If motor came back on, MOTOR_ON should already have cancelled this timer,
            // but this extra guard makes it robust.
            if (disk2.state.hw[deviceN].motor == 0)
                disk2.flushTrackStats(deviceN);

        }, delay);
    };

    this.cancelTrackStatsFlush = function(deviceN)
    {
        if (deviceN === undefined) deviceN = this.state.drv;

        var hw = this.state.hw[deviceN];
        if (!hw || !hw.stats) return;

        if (hw.stats.motorOffTimer)
        {
            clearTimeout(hw.stats.motorOffTimer);
            hw.stats.motorOffTimer = null;
        }
    };

    //  ██████  ███████  █████  ██████  
    //  ██   ██ ██      ██   ██ ██   ██ 
    //  ██████  █████   ███████ ██   ██ 
    //  ██   ██ ██      ██   ██ ██   ██ 
    //  ██   ██ ███████ ██   ██ ██████  

    this.readROM = function(addr)
    {
        if(this.state.diskData[this.state.drv])        // if disk data is loaded on the selected drive
                    return this.ROM[addr];    // return content of disk ROM addres
        return null;
    }

    this.read = function(addr) 
    {
        //console.log("AppleDisk2: read %s", addr.toString(16));
        const deviceN = this.state.drv
        if (addr < 0x08) 
        {
            if ((addr & 1) != 0)           // Stepper motor on
            {
                var p = ((addr >> 1) & 3); // phase we're turning on.

                if (((this.state.hw[deviceN].phase + 1) & 3) == p) 
                {
                    this.state.hw[deviceN].phase = p;     // Ascending order, track arm moves inward.
                    this.update_logs("phase");
                    if ((this.state.hw[deviceN].phase & 1) == 0)
                    {
                        var oldTrack = this.state.hw[deviceN].track;
                        this.flushTrackStats(deviceN);
                        if (++this.state.hw[deviceN].track >= 35)
                        {
                            this.state.hw[deviceN].track = 35; // CLICK! CLICK! CLICK!
                            this.dN_update("CLICK_OUT");
                            this.traceArmStep(deviceN, "CLICK_OUT", oldTrack, this.state.hw[deviceN].track);
                        }
                        else
                        {
                            this.state.hw[deviceN].stats.track = this.state.hw[deviceN].track;
                            this.dN_update("ARM_OUT");
                            this.traceArmStep(deviceN, "ARM_OUT", oldTrack, this.state.hw[deviceN].track);
                        }
                    }
                }
                else if (((this.state.hw[deviceN].phase - 1) & 3) == p) 
                {
                    // Descending order, track arm moves outward.
                    this.state.hw[deviceN].phase = p;
                    if ((this.state.hw[deviceN].phase & 1) == 0)
                    {
                        var oldTrack = this.state.hw[deviceN].track;
                        this.flushTrackStats(deviceN);
                        if (--this.state.hw[deviceN].track < 0)
                        {
                            this.state.hw[deviceN].track = 0; // CLICK! CLICK! CLICK!
                            this.state.hw[deviceN].stats.track = this.state.hw[deviceN].track;
                            this.dN_update("CLICK_IN");
                            this.traceArmStep(deviceN, "CLICK_IN", oldTrack, this.state.hw[deviceN].track);
                        }
                        else
                        {
                            this.state.hw[deviceN].stats.track = this.state.hw[deviceN].track;
                            this.dN_update("ARM_IN");
                            this.traceArmStep(deviceN, "ARM_IN", oldTrack, this.state.hw[deviceN].track);
                        }
                    }
                }
            }
        }
        else {
            switch (addr) {
            case MOTOR_ON:
                this.state.drive_enable = 1;
                this.applyDriveEnable("MOTOR_ON");
                this.dN_update("MOTOR_ON");
                break;
            case MOTOR_OFF:
                this.state.drive_enable = 0;
                this.applyDriveEnable("MOTOR_OFF");
                this.dN_update("MOTOR_OFF");
                break;              
            case DRV0EN:
                var oldDrv = this.state.drv;
                this.traceFlush("DRV0EN");
                this.state.drv = 0;
                this.traceChange("DRV0EN", 0, "drv", oldDrv, 0);
                this.applyDriveEnable("DRV0EN");
                this.update_logs("D1");
                break;
            case DRV1EN:
                var oldDrv = this.state.drv;
                this.traceFlush("DRV1EN");
                this.state.drv = 1;
                this.traceChange("DRV1EN", 1, "drv", oldDrv, 1);
                this.applyDriveEnable("DRV1EN");
                this.update_logs("D2");
                break;
            case Q6L:
                var oldQ6 = this.state.hw[deviceN].q6;
                this.state.hw[deviceN].q6 = 0;

                if (oldQ6 != 0)
                    this.traceChange("Q6L_STROBE_DATA_LATCH", deviceN, "q6", oldQ6, 0);

                // Strobe Data Latch for I/O
                if (!this.state.diskData[deviceN])
                {
                    this.traceUnavailable(deviceN, "diskData=null");
                    return 0xff;
                }

                if (!this.state.hw[deviceN].motor)
                {
                    this.traceUnavailable(deviceN, "motor=0");
                    return 0xff;
                }

                this.trace.lastUnavailable = "";

                if (++this.state.hw[deviceN].offset == TRACK_SIZE)
                    this.state.hw[deviceN].offset = 0;

                var loc = this.state.hw[deviceN].track * TRACK_SIZE + this.state.hw[deviceN].offset;

                var stats = this.state.hw[deviceN].stats;
                if (stats) stats.track = this.state.hw[deviceN].track;

                if (this.state.hw[deviceN].q7)
                {
                    // Write to disk.
                    this.state.diskData[deviceN][loc] = this.state.hw[deviceN].data_latch;
                    if (this.state.hw[deviceN].stats) this.state.hw[deviceN].stats.write++;
                    this.traceDataByte("WRITE", deviceN, loc, this.state.hw[deviceN].data_latch);
                    return this.state.hw[deviceN].data_latch;
                }
                else
                {
                    // Read from disk.
                    var d8 = this.state.diskData[deviceN][loc];
                    if (this.state.hw[deviceN].stats) this.state.hw[deviceN].stats.read++;
                    this.traceDataByte("READ", deviceN, loc, d8);
                    return d8;
                }
                // NOTREACHED
            case Q6H:
                // Load data latch. Also sense write-protect.
                var oldQ6 = this.state.hw[deviceN].q6;
                this.state.hw[deviceN].q6 = 1;
                if (oldQ6 != 1) this.traceChange("Q6H_LOAD_DATA_LATCH_OR_SENSE_WRITE_PROTECT", deviceN, "q6", oldQ6, 1);
                break;
            case Q7L:
                // Prepare latch for input.
                var oldQ7 = this.state.hw[deviceN].q7;
                this.state.hw[deviceN].q7 = 0;
                this.traceChange("Q7L_PREPARE_LATCH_INPUT", deviceN, "q7", oldQ7, 0);
                this.update_logs("q7");
                break;
            case Q7H:
                // Prepare latch for output.
                var oldQ7 = this.state.hw[deviceN].q7;
                this.state.hw[deviceN].q7 = 1;
                this.traceChange("Q7H_PREPARE_LATCH_OUTPUT", deviceN, "q7", oldQ7, 1);
                this.update_logs("q7");
                break;
            default:
                //if(bDebug) console.log("unknown "+oCOM.getHexByte(addr))
            }
        }

        return 0x00;
    } // read


    //  ██     ██ ██████  ██ ████████ ███████ 
    //  ██     ██ ██   ██ ██    ██    ██      
    //  ██  █  ██ ██████  ██    ██    █████   
    //  ██ ███ ██ ██   ██ ██    ██    ██      
    //   ███ ███  ██   ██ ██    ██    ███████ 


    this.write = function(addr, d8)
    {
        if (addr == Q6H) 
        {
            // Do not trace every data_latch mutation here.
            // Actual disk writes are summarized by WRITE_DATA_BLOCK in Q6L.
            this.state.hw[this.state.drv].data_latch = d8;
        }
    }


    //Apple DOS 3.3.dsk
    //setDiskData: .DSK LEN:143360 CRC32: E766F072
    //setDiskData: .NIB LEN:232960 CRC32: 435A9A45

    this.setDiskData = function(imageBytes, deviceID, filepath)
    {
        if (imageBytes === undefined || deviceID === undefined) return;

        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID, "DISKII");
        var info = this.detectDiskImageType(imageBytes, filepath);

        console.log("DISK info = " + JSON.stringify(info));

        var nibBytes;

        switch (info.type)
        {
            case "nib":
                nibBytes = imageBytes;
                break;

            case "po":
                nibBytes = this.convertPo2Nib(imageBytes);
                break;

            case "dsk":
                nibBytes = this.convertDsk2Nib(imageBytes);
                break;

            case "woz":
                throw new Error("WOZ detected, but convertWoz2Nib() is not implemented yet");

            default:
                throw new Error("Unsupported or unknown disk image type: " + info.reason);
        }

        this.state.diskData[deviceN] = nibBytes;

        this.traceLog("setDiskData",
        {
            drv: deviceN,
            img_type: info.type,
            img_confidence: info.confidence,
            img_reason: info.reason,
            img_len: imageBytes.length,
            img_crc32: oCOM.crc32(imageBytes).toString(16).toUpperCase(),
            nib_len: nibBytes.length,
            nib_crc32: oCOM.crc32(nibBytes).toString(16).toUpperCase()
        });
    }

    this.getDiskData = function(deviceID)
    {
        if(deviceID===undefined) return;
        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID, "DISKII");
        this.traceFlush("getDiskData");
        var nibBytes = this.state.diskData[deviceN];
        var dskBytes = this.convertNib2Dsk(nibBytes);
        this.traceLog("getDiskData", {
            drv: deviceN,
            nib_len: nibBytes.length,
            nib_crc32: oCOM.crc32(nibBytes).toString(16).toUpperCase(),
            dsk_len: dskBytes.length,
            dsk_crc32: oCOM.crc32(dskBytes).toString(16).toUpperCase()
        });

        return dskBytes;
    }

    this.isDiskData = function(deviceID)
    {
        if(deviceID===undefined) return;
        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID, "DISKII");
        return this.state.diskData[deviceN]!=null;
    }


    //  ██████  ███████ ██   ██     ██████      ███    ██ ██ ██████  
    //  ██   ██ ██      ██  ██           ██     ████   ██ ██ ██   ██ 
    //  ██   ██ ███████ █████        █████      ██ ██  ██ ██ ██████  
    //  ██   ██      ██ ██  ██      ██          ██  ██ ██ ██ ██   ██ 
    //  ██████  ███████ ██   ██     ███████     ██   ████ ██ ██████  

    var log = new Array();

    this.convertDsk2Nib = function(dskBytes)
    {
        //alert("CRC32: "+oCOM.crc32(oCOM.UploadData).toString(16).toUpperCase());
        //CRC32: E766F072
        

        // GCR LOOKUP TABLE (Group Code Recording) - 64 bitcodes starting with bit1 = 1 and 7 other bits never counting > 2 subsequent zeroes
        var sixTwo = [  
            0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
            0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
            0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
            0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
            0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
            0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
            0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
            0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff ];
        
        var bytes = new Array(232960);
        var offs;

        // odd-even encoding for sector headers.
        function split_OddEven(b) { return [0b10101010 | (b >> 1),0b10101010 | b] }    // odd bits to nibble0, even bits to nibble1
        function addBytes(b_arr) { for(var i=0;i<b_arr.length;i++) bytes[offs++] = b_arr[i] }

        for (var track = 0; track < 35; track++)
        {
            offs = track * 6656;
            for (var sec = 0; sec < 16; sec++)
            {
                // Gap 1 (which serve as buffer to avoid overlap with the end of the previous sector)
                addBytes([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);

                // Addr field prologue (uniquely marks the beginning of a sector & address field)
                addBytes([0xd5,0xaa,0x96]);   // 0xd5 and 0xaa are not in the GRC lookup table

                // ADDRESS FIELD
                addBytes(split_OddEven(0xFE));                // Volume
                addBytes(split_OddEven(track));               // Track
                addBytes(split_OddEven(sec));                 // Sector
                addBytes(split_OddEven(0xFE ^ track ^ sec));  // Checksum

                // Addr field epilogue (uniquely marks the end of the address field)
                addBytes([0xde,0xaa,0xeb]);  // 0xaa is not in the GRC lookup table

                //prenib Gap 2 (provides time to DOS routine to decode the address field)
                addBytes([0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]);

                // Data field prologue (uniquely marks the beginning of a data field))
                addBytes([0xd5,0xaa,0xad]);  // 0xd5 and 0xaa are not in the GRC lookup table

                // 1 - Start by prenibbilizing (256 DSK bytes >> create NIB of 342 bytes)
                var o = prenibble(track,sec,dskBytes);
                prenib = o.data;

                if(o.log!=null && track==0) log[log.length] = o.log;

                // 2 - Encode 342 nibbilized bytes of data.
                var prev = 0;   // reset data-field checksum chain for each sector
                for (var ni = -86; ni < 256; ni++)
                {
                    var i = ni <0 ? 255-ni : ni;  // i:  341-256 & 0-255
                    var b = sixTwo[prev ^ prenib[i]];
                    addBytes([ b ]);
                    prev = prenib[i];
                }
                addBytes([ sixTwo[prev] ]); // add the last remaining byte

                // 3 - ENTIRE BYTE NIBBLE
                addBytes([0xde,0xaa,0xeb]);                  // Data field epilogue
            }

            // Gap 3 (fill out with sync bytes until end of track, minimum 14 bytes, allowing enough time for DOS to process the data
            var bytes2EOT = (track+1) * 26 * 256 - offs;
            addBytes( [...new Array(bytes2EOT)].map(()=> 0xff) );
        }

        if(log.length>0)
        {
            document.getElementById("output").innerHTML = "<div style='font-family:Courier;font-size:8px;overflow:scroll;height:600px;float:left;'>"+log.join("<br>")+"</div>"
        }

        //CRC32: 435A9A45
        return bytes;
    }    


    function prenibble(track,sec,dskBytes)
    {
        var bDebug = false;

        if(prenib===undefined) var prenib = new Array(256 + 86);
        var secSkew = [ 0x0, 0x7, 0xE, 0x6, 0xD, 0x5, 0xC, 0x4, 0xB, 0x3, 0xA, 0x2, 0x9, 0x1, 0x8, 0xF ];
        var doffs = (secSkew[sec] << 8) + (track << 12);
        var prenib_fml = new Array();
        var z = 0;

        // CALCULATE v1
        var prenib0 = new Array(342)
        for(var i = 0; i < 256; i++)
        {
            var d8 = dskBytes[doffs + i];
            prenib0[i] = (d8 >> 2);
            if      (i < 86)    prenib0[256 + 85  - i] =     ((d8 & 0x02) >> 1) | ((d8 & 0x01) << 1);
            else if (i < 172)   prenib0[256 + 171 - i] |=    ((d8 & 0x02) << 1) | ((d8 & 0x01) << 3);
            else                prenib0[256 + 257 - i] |=    ((d8 & 0x02) << 3) | ((d8 & 0x01) << 5);
            if      (i < 2)     prenib0[256 + 1   - i] |=    ((d8 & 0x02) << 3) | ((d8 & 0x01) << 5);
        }

        var postnib = new Array(256)

        // CALCULATE v3
        for (var i = 0; i < (256+86); i++) // write one entire block
        {
            var ii = i<256 ? i : 256+85-i
            var d = dskBytes[doffs+ii];
            if(i<256) prenib[i] = d>>2
            else      prenib[i] = 
                (ii<84?mb(dskBytes[doffs+ii+172],0,5):0)  // 84 = 256-172
            | (ii<84?mb(dskBytes[doffs+ii+172],1,4):0)  // Zero-out serpentine tail 
            | mb(dskBytes[doffs+ii+86],0,3)
            | mb(dskBytes[doffs+ii+86],1,2)
            | mb(dskBytes[doffs+ii],0,1)
            | mb(dskBytes[doffs+ii],1,0)
        }

        // REVERSE CALCULATE v3
        for (var i = 0; i < (256+86); i++) // write one entire block
        { 
            if(i<256) postnib[i] |= prenib[i] << 2
            else
            {
            // prenib is 342 long
            var p = prenib[597-i]  // 341->256

            postnib[i+172-256]   // 170-255
                    |=  mb(p,5,0)
                    |   mb(p,4,1);
            postnib[i+86-256]    // 86-171  
                    |=  mb(p,3,0)
                    |   mb(p,2,1);
            postnib[i-256]       // 0-85
                |=  mb(p,1,0)
                |   mb(p,0,1)    
            }
        }

        function mb(val,src_bit,dst_bit) { return (val&(1<<src_bit))<<dst_bit>>src_bit; }

        function mbit2(db,idx,src_bit,dst_bit)
        {
            var v = db.ii + idx
            var val = db.prenib[v];
            if(v<256) var d = (val&(1<<src_bit))<<dst_bit>>src_bit;
            else var d = 0;

            return  d;
        }

        if(bDebug)
        {
            // DISPLAY
            var s = new Array();
            for (var i = 0; i < (256+86+z); i++) // read one entire block
            {
                var db = {"dskBytes":dskBytes,"doffs":doffs,"ii":(i<256 ? i : 256+85+z-i),"i":i,"z":z,"prenib":prenib,"prenib0":prenib0,"postnib":postnib}
                prenib_fml[db.i] = dsp_fml(db);
            }

            s[s.length] = "<big>TRACK $"+oCOM.getHexByte(track)+" SECTOR $"+oCOM.getHexByte(sec)+"</big><br>";
            for (var i = 0; i < prenib_fml.length; i++)
            {
                s[s.length] = prenib_fml[i]+"<br>"
            }
        }

        return {"data":prenib,"log":s===undefined?null:s.join("")};
    }


    //    ██████   ██████      ██████      ███    ██ ██ ██████  
    //    ██   ██ ██    ██          ██     ████   ██ ██ ██   ██ 
    //    ██████  ██    ██      █████      ██ ██  ██ ██ ██████  
    //    ██      ██    ██     ██          ██  ██ ██ ██ ██   ██ 
    //    ██       ██████      ███████     ██   ████ ██ ██████  

    this.convertPo2Nib = function(poBytes)
    {
        const TRACKS = 35;
        const SECTORS = 16;
        const SECTOR_SIZE = 256;
        const DSK_SIZE = TRACKS * SECTORS * SECTOR_SIZE; // 143360

        if (!poBytes || poBytes.length < DSK_SIZE)
            throw new Error("Invalid .po image: expected at least " + DSK_SIZE + " bytes");

        // physical/raw sector -> sector position in file
        const raw2dos = [
            0x0, 0x7, 0xE, 0x6,
            0xD, 0x5, 0xC, 0x4,
            0xB, 0x3, 0xA, 0x2,
            0x9, 0x1, 0x8, 0xF
        ];

        const raw2prodos = [
            0x0, 0x8, 0x1, 0x9,
            0x2, 0xA, 0x3, 0xB,
            0x4, 0xC, 0x5, 0xD,
            0x6, 0xE, 0x7, 0xF
        ];

        // Reorder ProDOS-order sector image into DOS-order sector image,
        // then let the existing DOS-order nibblizer do the rest.
        var dskBytes = new Array(DSK_SIZE);

        for (var track = 0; track < TRACKS; track++)
        {
            var trackBase = track * SECTORS * SECTOR_SIZE;

            for (var rawSec = 0; rawSec < SECTORS; rawSec++)
            {
                var poOff  = trackBase + raw2prodos[rawSec] * SECTOR_SIZE;
                var dskOff = trackBase + raw2dos[rawSec]    * SECTOR_SIZE;

                for (var i = 0; i < SECTOR_SIZE; i++)
                    dskBytes[dskOff + i] = poBytes[poOff + i] & 0xff;
            }
        }

        return this.convertDsk2Nib(dskBytes);
    }


    //  ███    ██ ██ ██████      ██████      ██████  ███████ ██   ██ 
    //  ████   ██ ██ ██   ██          ██     ██   ██ ██      ██  ██  
    //  ██ ██  ██ ██ ██████       █████      ██   ██ ███████ █████   
    //  ██  ██ ██ ██ ██   ██     ██          ██   ██      ██ ██  ██  
    //  ██   ████ ██ ██████      ███████     ██████  ███████ ██   ██ 

    this.convertNib2Dsk = function(nibBytes)
    {
        var TRACKS = 35;
        var SECTORS = 16;
        var SECTOR_SIZE = 256;
        var DSK_TRACK_SIZE = SECTORS * SECTOR_SIZE;   // 4096
        var NIB_TRACK_SIZE = 6656;
        var DSK_SIZE = TRACKS * DSK_TRACK_SIZE;       // 143360
        var NIB_SIZE = TRACKS * NIB_TRACK_SIZE;       // 232960

        if (!nibBytes || nibBytes.length < NIB_SIZE)
            throw new Error("Invalid .nib image: expected at least " + NIB_SIZE + " bytes");

        var dskBytes = new Array(DSK_SIZE);
        for (var i = 0; i < DSK_SIZE; i++) dskBytes[i] = 0;

        // DOS 3.3 physical-sector -> DOS .dsk sector order.
        // This must match convertDsk2Nib/prenibble().
        var secSkew = [
            0x0, 0x7, 0xE, 0x6,
            0xD, 0x5, 0xC, 0x4,
            0xB, 0x3, 0xA, 0x2,
            0x9, 0x1, 0x8, 0xF
        ];

        var sixTwo = [
            0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
            0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
            0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
            0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
            0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
            0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
            0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
            0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff
        ];

        var sixTwoLookup = new Array(256);
        for (var i = 0; i < 256; i++) sixTwoLookup[i] = -1;
        for (var i = 0; i < sixTwo.length; i++) sixTwoLookup[sixTwo[i]] = i;

        function joinOddEven(b1, b2) { return (((b1 << 1) | 1) & b2) & 0xff; }

        function match3(trackBase, pos, b0, b1, b2)
        {
            return ((nibBytes[trackBase + ((pos + 0) % NIB_TRACK_SIZE)] & 0xff) == b0
                && (nibBytes[trackBase + ((pos + 1) % NIB_TRACK_SIZE)] & 0xff) == b1
                && (nibBytes[trackBase + ((pos + 2) % NIB_TRACK_SIZE)] & 0xff) == b2);
        }

        function find3(trackBase, startPos, maxDistance, b0, b1, b2)
        {
            for (var n = 0; n < maxDistance; n++)
            {
                var pos = startPos + n;
                if (match3(trackBase, pos, b0, b1, b2)) return pos;
            }
            return -1;
        }

        function trackByte(trackBase, pos) { return nibBytes[trackBase + (pos % NIB_TRACK_SIZE)] & 0xff; }

        function decodeSectorData(trackBase, dataStart, trk, sec)
        {
            var prenib = new Array(342);
            var prev = 0;

            // 342 data nibbles + 1 checksum nibble.
            for (var j = 0; j < 343; j++)
            {
                var gcrByte = trackByte(trackBase, dataStart + j);
                var val = sixTwoLookup[gcrByte];
                if (val < 0) console.error("NIB2DSK DATA ERROR:" + " $T" + oCOM.getHexByte(trk) + " $S" + oCOM.getHexByte(sec) + " invalid GCR byte " + oCOM.getHexByte(gcrByte) + " at data offset " + j); return null;
                var decoded = val ^ prev;
                if (j < 86) { prenib[341 - j] = decoded; prev = decoded; }                   // First 86 encoded bytes are prenib[341] down to prenib[256].
                else if (j < 342) { prenib[j - 86] = decoded; prev = decoded; }              // Remaining 256 encoded bytes are prenib[0] through prenib[255].
                else if (decoded != 0) { console.warn("NIB2DSK CHECKSUM WARNING:" + " $T" + oCOM.getHexByte(trk) + " $S" + oCOM.getHexByte(sec) + " checksum decoded as " + oCOM.getHexByte(decoded));}                     // Final byte is checksum. It should decode to zero.
            }

            var sectorBytes = new Array(256);
            for (var i = 0; i < 256; i++) sectorBytes[i] = (prenib[i] << 2) & 0xfc;

            // Rebuild the low 2 bits from prenib[256..341].
            for (var j = 0; j < 86; j++)
            {
                var p = prenib[341 - j];

                if (j + 172 < 256)            // bytes 172..255
                {
                    sectorBytes[j + 172] |=
                        ((p & 0x20) >> 5) |   // p bit 5 -> data bit 0
                        ((p & 0x10) >> 3);    // p bit 4 -> data bit 1
                }

                // bytes 86..171
                sectorBytes[j + 86] |=
                    ((p & 0x08) >> 3) |       // p bit 3 -> data bit 0
                    ((p & 0x04) >> 1);        // p bit 2 -> data bit 1

                // bytes 0..85
                sectorBytes[j] |=
                    ((p & 0x02) >> 1) |       // p bit 1 -> data bit 0
                    ((p & 0x01) << 1);        // p bit 0 -> data bit 1
            }

            return sectorBytes;
        }

        var seen = {};
        var sectorsFound = 0;

        for (var fileTrack = 0; fileTrack < TRACKS; fileTrack++)
        {
            var trackBase = fileTrack * NIB_TRACK_SIZE;

            for (var pos = 0; pos < NIB_TRACK_SIZE - 16; pos++)
            {
                // Address field prologue: D5 AA 96
                if (!match3(trackBase, pos, 0xd5, 0xaa, 0x96)) continue;
                var p = pos + 3;
                var vol = joinOddEven(trackByte(trackBase, p + 0), trackByte(trackBase, p + 1));
                var trk = joinOddEven(trackByte(trackBase, p + 2), trackByte(trackBase, p + 3));
                var sec = joinOddEven(trackByte(trackBase, p + 4), trackByte(trackBase, p + 5));
                var chk = joinOddEven(trackByte(trackBase, p + 6), trackByte(trackBase, p + 7));
                if (trk < 0 || trk >= TRACKS || sec < 0 || sec >= SECTORS) continue;

                if (((vol ^ trk ^ sec) & 0xff) != chk)
                    console.warn("NIB2DSK ADDRESS CHECKSUM WARNING: file track " + fileTrack + " header T" + trk + " S" + sec);

                // Data field prologue: D5 AA AD
                // Search ahead far enough to skip address epilogue and gap 2.
                var dataPrologue = find3(trackBase, p + 8, 256, 0xd5, 0xaa, 0xad);
                if (dataPrologue < 0)
                {
                    console.error("NIB2DSK ERROR: missing data prologue for $T" + oCOM.getHexByte(trk) + " $S" + oCOM.getHexByte(sec));
                    continue;
                }

                var key = trk + ":" + sec;
                if (seen[key]) continue;
                var sectorBytes = decodeSectorData(trackBase, dataPrologue + 3, trk, sec);
                if (sectorBytes == null) continue;
                seen[key] = true;
                sectorsFound++;

                // Write to DOS .dsk order, not physical-sector order.
                var dskSector = secSkew[sec];
                var dskOffset = (trk * DSK_TRACK_SIZE) + (dskSector * SECTOR_SIZE);

                for (var i = 0; i < SECTOR_SIZE; i++)
                    dskBytes[dskOffset + i] = sectorBytes[i];

                // Skip past this data field.
                pos = dataPrologue + 3 + 343;
            }
        }

        if (sectorsFound != TRACKS * SECTORS)
            console.warn("NIB2DSK WARNING: decoded " + sectorsFound + " of " + (TRACKS * SECTORS) + " sectors");

        return dskBytes;
    }

    //    ███    ██ ██ ██████      ██████      ██████   ██████  
    //    ████   ██ ██ ██   ██          ██     ██   ██ ██    ██ 
    //    ██ ██  ██ ██ ██████       █████      ██████  ██    ██ 
    //    ██  ██ ██ ██ ██   ██     ██          ██      ██    ██ 
    //    ██   ████ ██ ██████      ███████     ██       ██████ 

    this.convertNib2Po = function(nibBytes)
    {
        const TRACKS = 35;
        const SECTORS = 16;
        const SECTOR_SIZE = 256;
        const TRACK_SIZE = SECTORS * SECTOR_SIZE; // 4096
        const PO_SIZE = TRACKS * TRACK_SIZE;      // 143360

        // First decode to DOS-order .dsk using existing, tested logic.
        var dskBytes = this.convertNib2Dsk(nibBytes);

        var poBytes = new Array(PO_SIZE);
        for (var i = 0; i < PO_SIZE; i++) poBytes[i] = 0;

        // physical/raw sector -> sector position in DOS .dsk file
        var raw2dos = [
            0x0, 0x7, 0xE, 0x6,
            0xD, 0x5, 0xC, 0x4,
            0xB, 0x3, 0xA, 0x2,
            0x9, 0x1, 0x8, 0xF
        ];

        // physical/raw sector -> sector position in ProDOS .po file
        var raw2prodos = [
            0x0, 0x8, 0x1, 0x9,
            0x2, 0xA, 0x3, 0xB,
            0x4, 0xC, 0x5, 0xD,
            0x6, 0xE, 0x7, 0xF
        ];

        for (var track = 0; track < TRACKS; track++)
        {
            var trackBase = track * TRACK_SIZE;

            for (var rawSec = 0; rawSec < SECTORS; rawSec++)
            {
                var dskOff = trackBase + raw2dos[rawSec]    * SECTOR_SIZE;
                var poOff  = trackBase + raw2prodos[rawSec] * SECTOR_SIZE;

                for (var i = 0; i < SECTOR_SIZE; i++)
                    poBytes[poOff + i] = dskBytes[dskOff + i] & 0xff;
            }
        }

        return poBytes;
    }

    //    ██████  ██ ███████ ██   ██     ████████ ██    ██ ██████  ███████ 
    //    ██   ██ ██ ██      ██  ██         ██     ██  ██  ██   ██ ██      
    //    ██   ██ ██ ███████ █████          ██      ████   ██████  █████   
    //    ██   ██ ██      ██ ██  ██         ██       ██    ██      ██      
    //    ██████  ██ ███████ ██   ██        ██       ██    ██      ███████ 


this.detectDiskImageType = function(imageBytes, filepath)
{
    if (!imageBytes)
        return { type:"unknown", confidence:0, reason:"no data" };

    const DSK_SIZE = 143360;   // 35 * 16 * 256
    const NIB_SIZE = 232960;   // 35 * 6656
    const TRACKS = 35;
    const SECTORS = 16;
    const SECTOR_SIZE = 256;
    const TRACK_SIZE_DSK = SECTORS * SECTOR_SIZE;
    const TRACK_SIZE_NIB = 6656;
    const PRODOS_TOTAL_BLOCKS_525 = 280;

    filepath = filepath || "";
    var ext = "";
    var m = filepath.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (m) ext = m[1];

    function b(off) { return imageBytes[off] & 0xff; }
    function validTrack(t) { return t >= 0 && t < TRACKS; }
    function validSector(s) { return s >= 0 && s < SECTORS;}

    function isWoz()
    {
        if (imageBytes.length < 12) return false;

        return imageBytes[0] == 0x57 && // W
               imageBytes[1] == 0x4f && // O
               imageBytes[2] == 0x5a && // Z
              (imageBytes[3] == 0x31 || imageBytes[3] == 0x32) &&
               imageBytes[4] == 0xff &&
               imageBytes[5] == 0x0a &&
               imageBytes[6] == 0x0d &&
               imageBytes[7] == 0x0a;
    }

    function findSeq(start, end, b0, b1, b2)
    {
        for (var i = start; i <= end - 3; i++)
            if (b(i) == b0 && b(i + 1) == b1 && b(i + 2) == b2) return true;
        return false;
    }

    function looksLikeNib()
    {
        if (imageBytes.length != NIB_SIZE) return false;
        var goodTracks = 0;
        for (var track = 0; track < TRACKS; track++)
        {
            var base = track * TRACK_SIZE_NIB;
            var end = base + TRACK_SIZE_NIB;
            var hasAddressPrologue = findSeq(base, end, 0xd5, 0xaa, 0x96);
            var hasDataPrologue    = findSeq(base, end, 0xd5, 0xaa, 0xad);
            if (hasAddressPrologue && hasDataPrologue) goodTracks++;
        }

        return goodTracks >= 20;
    }

    const raw2dos = [
        0x0, 0x7, 0xE, 0x6,
        0xD, 0x5, 0xC, 0x4,
        0xB, 0x3, 0xA, 0x2,
        0x9, 0x1, 0x8, 0xF
    ];

    const raw2prodos = [
        0x0, 0x8, 0x1, 0x9,
        0x2, 0xA, 0x3, 0xB,
        0x4, 0xC, 0x5, 0xD,
        0x6, 0xE, 0x7, 0xF
    ];

    function invertMap(raw2file)
    {
        var out = new Array(16);
        for (var raw = 0; raw < 16; raw++) out[raw2file[raw]] = raw;
        return out;
    }

    const prodosPos2Raw = invertMap(raw2prodos);

    function byteAtPhysicalSector(track, rawSector, index, raw2file)
    {
        var fileSector = raw2file[rawSector];
        return b(track * TRACK_SIZE_DSK + fileSector * SECTOR_SIZE + index);
    }

    function byteAtProDOSBlock(block, index, raw2file)
    {
        var logicalSector = block * 2 + Math.floor(index / SECTOR_SIZE);
        var track = Math.floor(logicalSector / SECTORS);
        var prodosSectorPosition = logicalSector & 0x0f;
        var rawSector = prodosPos2Raw[prodosSectorPosition];
        var fileSector = raw2file[rawSector];
        return b(track * TRACK_SIZE_DSK + fileSector * SECTOR_SIZE + (index & 0xff));
    }

    function wordAtProDOSBlock(block, index, raw2file)
    {
        return byteAtProDOSBlock(block, index, raw2file)
             | (byteAtProDOSBlock(block, index + 1, raw2file) << 8);
    }

    function scoreDOS33(raw2file)
    {
        var score = 0;   // DOS 3.3 VTOC is normally physical track 17, sector 0.
        var catTrack  = byteAtPhysicalSector(17, 0, 1, raw2file);
        var catSector = byteAtPhysicalSector(17, 0, 2, raw2file);
        var dosRel    = byteAtPhysicalSector(17, 0, 3, raw2file);
        if (!validTrack(catTrack) || !validSector(catSector)) return 0;
        if (catTrack == 17) score += 3; else score += 1;
        if (dosRel >= 1 && dosRel <= 3) score += 1;
        var t = catTrack;
        var s = catSector;
        var seen = {};

        for (var i = 0; i < 16; i++)
        {
            if (!validTrack(t) || !validSector(s)) break;
            var key = t + ":" + s;
            if (seen[key]) break;
            seen[key] = true;
            var nextTrack  = byteAtPhysicalSector(t, s, 1, raw2file);
            var nextSector = byteAtPhysicalSector(t, s, 2, raw2file);
            if (nextTrack == 0 && nextSector == 0) { score += 2; break; }
            if (validTrack(nextTrack) && validSector(nextSector)) score += 2; else { score -= 2; break; }
            t = nextTrack;
            s = nextSector;
        }

        return score;
    }

    function validProDOSNameChar(c, first)
    {
        if (first) return c >= 0x41 && c <= 0x5a;   // A-Z
        return (c >= 0x41 && c <= 0x5a) ||          // A-Z
               (c >= 0x30 && c <= 0x39) ||          // 0-9
                c == 0x2e;                          // .
    }

    function scoreProDOS(raw2file)
    {
        var score = 0;
        var reasons = [];
        var criticalFail = false;

        // ProDOS volume directory normally starts at block 2.
        // A real volume directory block has:
        //   +0: previous block pointer, usually 0
        //   +2: next block pointer, often 3 for an empty 140 KB volume
        //   +4: volume directory header entry, storage type F
        var prevBlock = wordAtProDOSBlock(2, 0x00, raw2file);
        var nextBlock = wordAtProDOSBlock(2, 0x02, raw2file);

        if (prevBlock == 0) { score += 4; reasons.push("prevBlock=0"); }
        else { score -= 4; criticalFail = true; reasons.push("bad prevBlock=" + prevBlock); }

        if (nextBlock == 0 || (nextBlock >= 3 && nextBlock < PRODOS_TOTAL_BLOCKS_525))
             { score += 2; reasons.push("nextBlock plausible=" + nextBlock); }
        else { score -= 4; criticalFail = true; reasons.push("bad nextBlock=" + nextBlock); }

        var storageAndNameLen = byteAtProDOSBlock(2, 0x04, raw2file);
        var storageType = storageAndNameLen >> 4;
        var nameLen = storageAndNameLen & 0x0f;

        if (storageType == 0x0f && nameLen >= 1 && nameLen <= 15)
            { score += 4; reasons.push("volume header storage=F nameLen=" + nameLen);}
        else { return { score:score - 8, strong:false, reasons:reasons.concat(["bad volume header byte=" + storageAndNameLen])}; }

        var validName = true;
        var name = "";

        for (var i = 0; i < nameLen; i++)
        {
            var c = byteAtProDOSBlock(2, 0x05 + i, raw2file);
            name += String.fromCharCode(c);
            if (!validProDOSNameChar(c, i == 0)) validName = false;
        }

        if (validName) { score += 5; reasons.push("valid volume name=" + name); }
        else { score -= 5; criticalFail = true; reasons.push("invalid volume name"); }

        // Unused filename bytes in a ProDOS volume directory header are normally zero.
        var zeroNamePadding = true;
        for (var p = 0x05 + nameLen; p < 0x14; p++)
            if (byteAtProDOSBlock(2, p, raw2file) != 0) { zeroNamePadding = false; break; };

        if (zeroNamePadding) { score += 3; reasons.push("name padding zero"); }
        else { score -= 2; criticalFail = true; reasons.push("name padding nonzero"); }

        // These are strong ProDOS volume-directory-header fields.
        // For a normal 5.25" ProDOS volume:
        //   entry length      = $27
        //   entries per block = 13
        //   total blocks      = 280
        var entryLength = byteAtProDOSBlock(2, 0x23, raw2file);
        var entriesPerBlock = byteAtProDOSBlock(2, 0x24, raw2file);
        var fileCount = wordAtProDOSBlock(2, 0x25, raw2file);
        var bitmapBlock = wordAtProDOSBlock(2, 0x27, raw2file);
        var totalBlocks = wordAtProDOSBlock(2, 0x29, raw2file);

        if (entryLength == 0x27) { score += 4; reasons.push("entryLength=0x27"); }
        else { score -= 3; criticalFail = true; reasons.push("bad entryLength=" + entryLength); }
        if (entriesPerBlock == 0x0d) { score += 4; reasons.push("entriesPerBlock=13"); }
        else { score -= 3; criticalFail = true; reasons.push("bad entriesPerBlock=" + entriesPerBlock); }
        if (fileCount <= entriesPerBlock * PRODOS_TOTAL_BLOCKS_525)
            { score += 1; reasons.push("fileCount plausible=" + fileCount); }
        else { score -= 1; criticalFail = true; reasons.push("bad fileCount=" + fileCount); }
        if (bitmapBlock >= 3 && bitmapBlock < PRODOS_TOTAL_BLOCKS_525)
            { score += 3; reasons.push("bitmapBlock plausible=" + bitmapBlock); }
        else { score -= 3; criticalFail = true; reasons.push("bad bitmapBlock=" + bitmapBlock); }
        if (totalBlocks == PRODOS_TOTAL_BLOCKS_525) { score += 5; reasons.push("totalBlocks=280"); }
        else if (totalBlocks > 0 && totalBlocks <= PRODOS_TOTAL_BLOCKS_525) { score += 1; reasons.push("totalBlocks plausible=" + totalBlocks); }
        else { score -= 5; criticalFail = true; reasons.push("bad totalBlocks=" + totalBlocks); }

        // Optional but helpful: the bitmap block should not be all zero.
        if (bitmapBlock >= 0 && bitmapBlock < PRODOS_TOTAL_BLOCKS_525)
        {
            var nonzero = 0, ff = 0;
            for (var bi = 0; bi < 40; bi++)
            {
                var bv = byteAtProDOSBlock(bitmapBlock, bi, raw2file);
                if (bv != 0) nonzero++;
                if (bv == 0xff) ff++;
            }

            if (nonzero > 0 && ff > 0) { score += 2; reasons.push("bitmap block plausible"); }
            else if (nonzero > 0) { score += 1; reasons.push("bitmap block nonzero"); }
            else { score -= 2; criticalFail = true; reasons.push("bitmap block empty"); }
        }
        return { score:score, strong:(!criticalFail && score >= 20), reasons:reasons };
    }

    if (isWoz()) return { type:"woz", confidence:1.0, reason:"WOZ magic header" };

    if (looksLikeNib()) return { type:"nib", confidence:0.95, reason:"NIB size and sector prologues" };

    if (imageBytes.length == DSK_SIZE)
    {
        var dosAsDos = scoreDOS33(raw2dos);
        var dosAsPo  = scoreDOS33(raw2prodos);
        var prodosAsDos = scoreProDOS(raw2dos);
        var prodosAsPo  = scoreProDOS(raw2prodos);
        var dskScore = dosAsDos + prodosAsDos.score;
        var poScore  = dosAsPo  + prodosAsPo.score;

        // Strong ProDOS-order detection.
        // Do not let a weak accidental F? byte classify a protected game as .po.
        if (prodosAsPo.strong && poScore >= dskScore + 8)
        {
            return {
                type:"po",
                confidence:0.97,
                reason:"strong ProDOS-order volume directory",
                dskScore:dskScore,
                poScore:poScore,
                prodosAsPo:prodosAsPo
            };
        }

        // Strong DOS-order filesystem detection.
        if (dosAsDos >= 5 && dskScore >= poScore + 4)
        {
            return {
                type:"dsk",
                confidence:0.90,
                reason:"DOS-order VTOC/catalog structures score higher",
                dskScore:dskScore,
                poScore:poScore,
                dosAsDos:dosAsDos,
                prodosAsDos:prodosAsDos
            };
        }

        // Extension is now only a tie-breaker for weak/ambiguous flat images.
        // It must not override a strong ProDOS result above.
        if (ext == "po" && prodosAsPo.score >= 12)
        {
            return {
                type:"po",
                confidence:0.75,
                reason:"weak ProDOS evidence plus .po filename hint",
                dskScore:dskScore,
                poScore:poScore,
                prodosAsPo:prodosAsPo
            };
        }

        var extBias = 0;
        if (ext == "po") extBias = 4;
        else if (ext == "dsk" || ext == "do") extBias = -2;
        var poScoreFinal = poScore + Math.max(0, extBias);
        var dskScoreFinal = dskScore + Math.max(0, -extBias);


        // Safe default for 143360-byte flat images:
        // most protected/game .dsk images do not have a normal DOS catalog,
        // and accidental ProDOS-looking bytes should not trigger .po conversion.
        return {
            type:"dsk",
            confidence:0.60,
            ambiguous:true,
            reason:"140 KB flat image; no strong ProDOS volume header found; defaulting to DOS-order .dsk",
            dskScore:dskScore,
            poScore:poScore,
            dskScoreFinal:dskScoreFinal,
            poScoreFinal:poScoreFinal,
            ext:ext,
            extBias:extBias,
            prodosAsPo:prodosAsPo
        };
    }

    return { type:"unknown", confidence:0, reason:"unknown size or unsupported format" };
}


    //  ██████  ██ ███████ ██   ██     ███    ██  ██████  ██ ███████ ███████ 
    //  ██   ██ ██ ██      ██  ██      ████   ██ ██    ██ ██ ██      ██      
    //  ██   ██ ██ ███████ █████       ██ ██  ██ ██    ██ ██ ███████ █████   
    //  ██   ██ ██      ██ ██  ██      ██  ██ ██ ██    ██ ██      ██ ██      
    //  ██████  ██ ███████ ██   ██     ██   ████  ██████  ██ ███████ ███████ 

    this.dNd = {enable:false,motor:"OFF",status:"",detune:0,rept:0,motorOffTimer:null,last:{}};  // disk Noise data
    this.AUD_buffer={};

    this.s_load_all = async function(samplesDS)
    {
        const audioBuffers = [];
        for(const path in samplesDS)
        {
            await this.s_getFile("data:@file/wav;base64,"+samplesDS[path].src)
                .then((f)=>{ audioBuffers.push(f) })
        }
        return audioBuffers;
    }

    this.s_getFile = async function(samplePath)
    {
      const response    = await fetch(samplePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audio.decodeAudioData(arrayBuffer);
      return audioBuffer;
    }

    this.dN_update = function(status)
    {
        this.dNd.state = status;
        this.dNd.bRep   = this.dNd.last.state==status;

        this.dN_launcher();
        set_action(this.dNd);

        //if(this.dNd.motor != this.dNd.last.motor) console.log(this.dNd.motor);
        this.dNd.last = {}; this.dNd.last = {...this.dNd};
    }

    this.dN_launcher = function(active)
    {
        var o = this.dNd;
        var l = o.last;

        if(o.enable==true)
        {
            // Schedule spindown for every MOTOR_OFF while spin noise is logically ON.
            // This must happen before shortswipe/click/longswipe branches can return.
            if(o.state=="MOTOR_OFF" && o.motor=="ON")
            {
                if(o.motorOffTimer) clearTimeout(o.motorOffTimer);
                o.motorOffTimer = setTimeout(this.dN_spindown, 1000, this);
            }
            // Cancel pending spindown when motor is turned back on.
            if(o.state=="MOTOR_ON" && o.motorOffTimer) { clearTimeout(o.motorOffTimer); o.motorOffTimer = null; }
            if(l.state=="MOTOR_ON" && o.motor=="OFF") { o.motor="ON"; return this.dN_play("DiskII_spin"); }
            if(o.state=="CLICK_IN" || o.state=="CLICK_OUT") return this.dN_play("DiskII_click");
            if((l.state=="ARM_OUT" || l.state=="ARM_IN")==true && o.bRep==false && l.bRep==true && l.rept<10) return this.dN_play("DiskII_shortswipe");
            if((o.state=="ARM_OUT" || o.state=="ARM_IN")==true && o.rept==10) return this.dN_play("DiskII_longswipe");
            if(l.state=="MOTOR_OFF" && o.state=="SPINDOWN") { this.dN_stop("DiskII_spin"); return this.dN_play("DiskII_spindown"); }
            if((o.motor=="OFF" && (o.state=="MOTOR_ON" || l.state===undefined)) || (l.state=="SPINDOWN" && o.state=="MOTOR_ON") || (o.motor=="OFF" && l.enable==false && o.enable==true))
                { o.motor="ON"; return this.dN_play("DiskII_spin");}

            return null;
        }
    }

    var set_action = function(o) { if(o.bRep) o.rept++; else o.rept = 0; }

    this.dN_spindown = function(t)
    {
        if(bDebug_N) console.log("TIMER EXP ("+t.dNd.motor+") - "+t.dNd.state);
        if(t.dNd.state=="MOTOR_OFF")
        {
            t.dNd.motor="OFF";
            if(bDebug_N) console.log("dN_spindown: dNd.motor="+t.dNd.motor);
            t.dN_update("SPINDOWN");
        }
    }

    this.dN_speed_update = function(pct) {}      // overridable function - tune disk noise to CPU clock 

    this.dN_play = function(name)
    {
        if(this.audio===undefined || name==null) return;
        if(bDebug_N) { console.log("play('"+name+"')") }
        this.AUD_buffer[name]               = this.audio.createBufferSource();  // create buffers
        this.AUD_buffer[name].buffer        = dN_samples[name].audio;           // fill buffers
        this.AUD_buffer[name].connect(this.gain).connect(this.audio.destination); // connect buffers -> gain -> destination (patch cables)
        this.AUD_buffer[name].loop          = dN_samples[name].loop;    // configure loop parameter
        this.AUD_buffer[name].detune.value  = this.dNd.detune;          // tune according to CPU clock
        this.AUD_buffer[name].start(this.audio.currentTime);
    }

    this.dN_stop = function(name)
    {
      if(name==null) return;
      if(bDebug_N) { console.log("stop('"+name+"')") }
      this.AUD_buffer[name].loop = false;
      this.AUD_buffer[name].stop();
    }


   // 32bit float WAV files converted to base64

   var dN_samples =
   {
   "DiskII_spinup":
   {src:"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"}
   ,"DiskII_spin":
   {loop:true,src:"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D8073Z6SvKHivz2JnSo+1Lc2Pij+bT7LBnM+n9QgPraIAT73JAI+JMs3PgfOkD5dEHA+EFYMPuNaUT4h5Os938g7PYY7ij1lhmg9x6x5vLzQlr0qrKK9DtxHvsAOJb70ofi9eO8NvhIyGr5zE/295rzfvWujMb5TyY6+lHeEvlbtX75tGlS+vOAZvv0ME77mGAa+pssBvpfvHb5kFsW92oqMPFUjkT0+/N098/VWPWrFozxu81o9tIL6PWnbBz7JG+s9TwSbPfBXjz1VJyY+92tiPuW3lD7h+qw+MRVnPiGgWT50/Ik+G+IjPiTgeT64cU4+3SZIPeNTyT0ZETo9iIhoPKAIhz03OmY8ycmUvL9tprrwwJC9ofHKvHyuhL1gNDm+gYRGviTenL4+vVW+/4w5vs79cr7nVf29KzIVvh3pd75mmAC+lWMePB7ueL0LgXu9qVHGvcR4er2LFk26lmFgO0lhnT1/1oY99De9PY/RDz4E68c99z8MPhvwRT6IpwU+bB/tPQqlQT6TdSc+DGoKPmoRET6VN2E9X8h2PLZ39zxUaJE9y5hgPPn8D70K4309BMk4vbJwxb1MpIC99erxvcMNFr5/kEa+nrEyvgGzSL7APRy+HbYbvhbTUr62QzW+/8pEvnKIab4yrQ2+KZypvaUCzL0M8NO9AKAKvoomF7542m+9NzpnPUrdaruhASc9fY+UPUKRlj3Cfas9om2YPd31dj2qK7A91+rnPROiJT0K8W89GOU8PSOj5z2i8gE+Ij5oPQw6AD70YGk+CO1hPo1xrz2Obh45VWZLvWonrb2YzSI9+Eb3PVy+oz3NToM9PBIavUfUwr0cl3q98WmdvFecqLwaS7K7k34lPHDRZ713XvQ8jrLHPEJ33jxcxAE+oXpjPcNEc71Z3Iq9mhciPSH7ATwzw8Q9ZX8KPih55DwbC588VNi7PeX/DD39yA+9v/u3PYziAD1NMFY9sNvoPSlxZz2xMIS8xPOCvN7XxL13fVO+VB3PvdOsyL2Nbdi95jvLvUb3s73bN1W8k6bPvVdGAL74O1C9FQMIvVduA7xMSVNUjAAAAElORk9JTkFNVgAAAEhhcmRlciwgQmV0dGVyLCBGYXN0ZXIsIFN0cm9uZ2VyIHwgRGFmdCBQdW5rIHwgUG9tcGxhbW9vc2Vfdm9jYWxzXyhTcGxpdF9ieV9MQUxBTC5BSSkASVNGVCIAAABMYXZmNTkuMjcuMTAwIChsaWJzbmRmaWxlLTEuMC4zMSkAaWQzIIwAAABJRDMDAAAAAAEBVElUMgAAAFYAAABIYXJkZXIsIEJldHRlciwgRmFzdGVyLCBTdHJvbmdlciB8IERhZnQgUHVuayB8IFBvbXBsYW1vb3NlX3ZvY2Fsc18oU3BsaXRfYnlfTEFMQUwuQUkpVFhYWAAAABcAAABTb2Z0d2FyZQBMYXZmNTkuMjcuMTAwAA=="}
   ,"DiskII_spindown":
   {src:"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feg6UFkjOvkhsjr8XXk60xDZOLGYEDoAIA244oX/ORKSG7nCqge55qs/Op5lsjn4z6o5FbFfOkoybzpZ1Wc6oUlnOp6pcTo+JVU6icqkOVgDaToWYJk6/IB4OrjebDoJwpU6zV6pOtD2sjpo3Kw6r6ywOktgrjojrq86ZPyuOkBgrzqjCK86sI2vOgumrjpLJLA6CtitOqs0sTp4a6w6CDmzOv42qTo8jbk60hGUOi/+UDom8nk6o4NbOnWGeTrQpU861Aa+OuRYizrdu1I6fkF7OtllWTrj+Xo6kMFROkPZxzomBnI69Il+OUjNfDqquFE6J0qWOoj7ujpn1qY6QCi2OoIOqToW7rQ6ws+pOlBttDrcLKo6ziK0Omhwqjo+3bM6tb+qOux8szp+OKs6buOyOpr8qzqZ57E6kkOtOrQ0sDqZo686YIOsOlkmtzoGvEE6H1ylOhWwrzot1bc6ykxZOkCbkTpW+Lw6PlmmOg5stTp74ao6uhayOuqmrTrrhq86s1uwOoQCrDpXxLY6pDuVOiUrRTp06tA6zc9WOtaAijqqh7k64MCqOgavsDq4QLA6uC2rOuyZuDp6UJM6PZNROrSMwDqnaaU6DcK1Oj6oqjrQZrI6SButOqd7sDoUq646FjCvOoa/rzq+Sq46GnuwOgq1rToU7rA6/mGtOtYjsTrgRq06ACexOuxYrTqNArE68oytOsjBsDqs1606ym+wOlwurjrOFrA6b4euOp+/rzoC2646IHGvOjojrzoYMK86alyvOir/rjrwhK86/N6uOgWdrzqVzq46TqavOr/Lrjpyo686gNOuOp+XrzqO4q46JYavOrD1rjoTcq86DQqvOv5drzpdHa862UuvOgUurzrpPK86FjuvOssxrzo+RK86kCqvOqRJrzrdJq86zUuvOhEmrzpuS686aCevOlBJrzocKq86M0avOnotrzq5Qq868DCvOl8/rzoYNK86eTyvOrE2rzozOq86ojivOpg4rzrrOa86nDevOqA6rzolN6864TqvOhE3rzrROq86PjevOo86rzqON686NjqvOuo3rzrbOa86QTivOoo5rzqLOK86STmvOsM4rzoaOa866TivOvw4rzr/OK867DivOgo5rzrlOK86DTmvOuU4rzoMOa866DivOgg5rzrsOK86BDmvOvA4rzoAOa869DivOv04rzr2OK86+zivOvg4rzr6OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvk4rzr5OK86+TivOvg4rzr6OK86+DivOvo4rzr3OK86+zivOvc4rzr7OK869jivOvw4rzr2OK86/DivOvY4rzr8OK869jivOvs4rzr3OK86+jivOvk4rzr4OK86+zivOvU4rzr/OK868jivOgI5rzruOK86BjmvOuo4rzoKOa865zivOg05rzrkOK86DjmvOuQ4rzoOOa865TivOgs5rzrqOK86BTmvOvE4rzr7OK86/DivOu84rzoKOa864DivOho5rzrQOK86KzmvOr84rzo7Oa86sDivOkk5rzqkOK86UjmvOp44rzpVOa86nzivOlA5rzqpOK86QjmvOrs4rzorOa861jivOgs5rzr7OK864zivOic5rzqyOK86WzmvOns4rzqWOa86PDivOto5rzrzN686KDqvOp03rzqHOq86MjevOgA7rzqmNq86qzuvOso1rzrmPK86njOvOqZCrzqeCK86+UCtOtk0qzoTRKk6QTynOhhLpTqrQqM6aFKhOg5JnzqZWZ06rk+bOndgmTq1Vpc62GaVOkxekzqWbJE6lmaPOpZxjTqnb4s6ynWJOoR5hzo4eYU6GISDOgN8gTpsHn860fx6Ohw1dzqNAXM6ZktvOi4HazpAYGc60w5jOntyXzqzGVs64oBXOv8oUzpOik86wz1LOtWNRzrGWEM634o/OmR6OzpNgTc6fqIzOotxLzpW0Cs6oFwnOpgCJDovRB86WTccOmsqFzokbBQ6/xEPOhyeDDr3/QY6DMoEOl/j/TnQ2Pk57eHtOfIB6jl7Ad450wLaOTZUzjmtvck5cxO/OZKpuDlsIbI5IDk8OeJOmTnwBJ05GveMORCrizmy63s5z012OTABXTm2EVY55ek8OTvlODkUT7A4FMgLObReBTkSnt84uVXJOJp0oDir34k4oQ5BOKXGFThGDHs3HagMNkxJU1SMAAAASU5GT0lOQU1WAAAASGFyZGVyLCBCZXR0ZXIsIEZhc3RlciwgU3Ryb25nZXIgfCBEYWZ0IFB1bmsgfCBQb21wbGFtb29zZV92b2NhbHNfKFNwbGl0X2J5X0xBTEFMLkFJKQBJU0ZUIgAAAExhdmY1OS4yNy4xMDAgKGxpYnNuZGZpbGUtMS4wLjMxKQBpZDMgjAAAAElEMwMAAAAAAQFUSVQyAAAAVgAAAEhhcmRlciwgQmV0dGVyLCBGYXN0ZXIsIFN0cm9uZ2VyIHwgRGFmdCBQdW5rIHwgUG9tcGxhbW9vc2Vfdm9jYWxzXyhTcGxpdF9ieV9MQUxBTC5BSSlUWFhYAAAAFwAAAFNvZnR3YXJlAExhdmY1OS4yNy4xMDAA"}
   ,"DiskII_click":
   {src:"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"}
   ,"DiskII_shortswipe":
   {src:"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Tr3mLUU6cl+pPCZCZT2P5Yk9AfDaPCJQJT0rdN88KqWRPS7hfT34OLQ6WNeqPE+ugjwnPmW9PflPvU/KK71cP7m9zf+gvVUJ372SFV29AlZAORuuFL0Heue8YutOvQgYQb39uti9KyrFveXLIr0T7ai9gTCNvfgkA71rIv+8hAmAvZGhrrwtl3c8EwanvL4T0D3PPzs+hi6jPQFUmT0+z/Y5G7t8Pa4N0D1Ayh29y0wzPPJtsDzPOY+7FhbtvCTWM71pYS89NBOJPGh+L72T1Iw9i3VXuhZrRTwwPrI9MFvbvcbsa71okwa78F/jvVTuI71TSPW8CRGovevj5zrm+Zy94jj1vU5ear00F4W9Gf7ZvO2uCT0R+yc8kwbyvK+GCj15NIi6s3UDPUdOkD1ufdU9H7IPPqh/pz2dklU9CCsSPYrmGT3r3nE9jP/6PcYv9z2bAa49wow7PepK9jyLSdk8tRz6vIBX8TvbtSI9o5noO3iNwjz8mQe8x48IvQ8Eqrw0+UW8iCu2vPO2wLypQge9e58KPV2tfbzCpn69bTtJPOA5yryZeCa9WbEyvTj4FjwOjvq8NZ3CvGEPHjxkQ3+9GpqVvXZU2jnYnjs881NlPHT33DwVmGG823lRPd+NST2QyQc98q/cPK1RVT0VLBI+k/aiPckqiDw1+zE9oNDlvA7e/rwKNBQ90WjSvMvYdLtukxQ9QQngvLeZKDuUic27qFuAvS1q+LzWn+S8T1qQvbVC6LySuea7lMJjvXd+J73ZXQy9l6c3vUz9Hr3jcEq8ltmSO5mpZ7xlW/28K1O7vGT1LL3JBW688cYZPAoFlrzM1vg8+aqDPNybHLzJOQE9JPz/PIWhijybezQ9tPD2PP42HT0e9109NaekPExY7jzwtsM80B2GPCJEYzyryl48S5WaPF0HrDwKWNw7yxTYOzjPljqUWFC8MDVAvM28ZbyH49i6dRUuvDAJprzgQqe8rgpVvEDnX7yNUzW8b97tu/x+h7zJJ1C8Kn8+vCEFJrwCctS7KoSEu1J/U7swmUa7cLmPN8jLeTrwrsq4tK3WOLr/KjqcQfW4gcNLN0xJU1SMAAAASU5GT0lOQU1WAAAASGFyZGVyLCBCZXR0ZXIsIEZhc3RlciwgU3Ryb25nZXIgfCBEYWZ0IFB1bmsgfCBQb21wbGFtb29zZV92b2NhbHNfKFNwbGl0X2J5X0xBTEFMLkFJKQBJU0ZUIgAAAExhdmY1OS4yNy4xMDAgKGxpYnNuZGZpbGUtMS4wLjMxKQBpZDMgjAAAAElEMwMAAAAAAQFUSVQyAAAAVgAAAEhhcmRlciwgQmV0dGVyLCBGYXN0ZXIsIFN0cm9uZ2VyIHwgRGFmdCBQdW5rIHwgUG9tcGxhbW9vc2Vfdm9jYWxzXyhTcGxpdF9ieV9MQUxBTC5BSSlUWFhYAAAAFwAAAFNvZnR3YXJlAExhdmY1OS4yNy4xMDAA"}
   ,"DiskII_longswipe":
   {src:"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"}
   }

   this.ROM = new Uint8Array([ // P5A
    0xA2, 0x20, 0xA0, 0x00, 0xA2, 0x03, 0x86, 0x3C,
    0x8A, 0x0A, 0x24, 0x3C, 0xF0, 0x10, 0x05, 0x3C,
    0x49, 0xFF, 0x29, 0x7E, 0xB0, 0x08, 0x4A, 0xD0,
    0xFB, 0x98, 0x9D, 0x56, 0x03, 0xC8, 0xE8, 0x10,
    0xE5, 0x20, 0x58, 0xFF, 0xBA, 0xBD, 0x00, 0x01,
    0x0A, 0x0A, 0x0A, 0x0A, 0x85, 0x2B, 0xAA, 0xBD,
    0x8E, 0xC0, 0xBD, 0x8C, 0xC0, 0xBD, 0x8A, 0xC0,
    0xBD, 0x89, 0xC0, 0xA0, 0x50, 0xBD, 0x80, 0xC0,
    0x98, 0x29, 0x03, 0x0A, 0x05, 0x2B, 0xAA, 0xBD,
    0x81, 0xC0, 0xA9, 0x56, 0x20, 0xA8, 0xFC, 0x88,
    0x10, 0xEB, 0x85, 0x26, 0x85, 0x3D, 0x85, 0x41,
    0xA9, 0x08, 0x85, 0x27, 0x18, 0x08, 0xBD, 0x8C,
    0xC0, 0x10, 0xFB, 0x49, 0xD5, 0xD0, 0xF7, 0xBD,
    0x8C, 0xC0, 0x10, 0xFB, 0xC9, 0xAA, 0xD0, 0xF3,
    0xEA, 0xBD, 0x8C, 0xC0, 0x10, 0xFB, 0xC9, 0x96,
    0xF0, 0x09, 0x28, 0x90, 0xDF, 0x49, 0xAD, 0xF0,
    0x25, 0xD0, 0xD9, 0xA0, 0x03, 0x85, 0x40, 0xBD,
    0x8C, 0xC0, 0x10, 0xFB, 0x2A, 0x85, 0x3C, 0xBD,
    0x8C, 0xC0, 0x10, 0xFB, 0x25, 0x3C, 0x88, 0xD0,
    0xEC, 0x28, 0xC5, 0x3D, 0xD0, 0xBE, 0xA5, 0x40,
    0xC5, 0x41, 0xD0, 0xB8, 0xB0, 0xB7, 0xA0, 0x56,
    0x84, 0x3C, 0xBC, 0x8C, 0xC0, 0x10, 0xFB, 0x59,
    0xD6, 0x02, 0xA4, 0x3C, 0x88, 0x99, 0x00, 0x03,
    0xD0, 0xEE, 0x84, 0x3C, 0xBC, 0x8C, 0xC0, 0x10,
    0xFB, 0x59, 0xD6, 0x02, 0xA4, 0x3C, 0x91, 0x26,
    0xC8, 0xD0, 0xEF, 0xBC, 0x8C, 0xC0, 0x10, 0xFB,
    0x59, 0xD6, 0x02, 0xD0, 0x87, 0xA0, 0x00, 0xA2,
    0x56, 0xCA, 0x30, 0xFB, 0xB1, 0x26, 0x5E, 0x00,
    0x03, 0x2A, 0x5E, 0x00, 0x03, 0x2A, 0x91, 0x26,
    0xC8, 0xD0, 0xEE, 0xE6, 0x27, 0xE6, 0x3D, 0xA5,
    0x3D, 0xCD, 0x00, 0x08, 0xA6, 0x2B, 0x90, 0xDB,
    0x4C, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);


    //    ██████  ██ ███████ ██   ██ ██ ██     ████████ ██████   █████   ██████ ███████ 
    //    ██   ██ ██ ██      ██  ██  ██ ██        ██    ██   ██ ██   ██ ██      ██      
    //    ██   ██ ██ ███████ █████   ██ ██        ██    ██████  ███████ ██      █████   
    //    ██   ██ ██      ██ ██  ██  ██ ██        ██    ██   ██ ██   ██ ██      ██      
    //    ██████  ██ ███████ ██   ██ ██ ██        ██    ██   ██ ██   ██  ██████ ███████ 

    // -----------------------------------------------------------------------------
    // DISKII TRACE
    // Minimal semantic trace: log only meaningful state changes and aggregated data.
    // -----------------------------------------------------------------------------

    this.trace = 
    {
        enabled: false,
        echo: true,
        maxEvents: 1000,
        maxBytes: 24,
        seq: 0,
        events: [],
        pendingArm: null,
        pendingData: null,
        lastUnavailable: ""
    }

    this.traceEnable = function(enabled, clear)
    {
        this.trace.enabled = !!enabled;
        if (clear) this.traceClear();
    }

    this.traceClear = function()
    {
        this.trace.seq = 0;
        this.trace.events = [];
        this.trace.pendingArm = null;
        this.trace.pendingData = null;
        this.trace.lastUnavailable = "";
    }

    this.traceFlush = function(reason)
    {
        this.traceFlushData(reason);
        this.traceFlushArm(reason);
    }

    this.traceHexByte = function(v)
    {
        if (typeof oCOM != "undefined" && oCOM.getHexByte)
            return oCOM.getHexByte(v & 0xff);

        var s = (v & 0xff).toString(16).toUpperCase();
        return "$" + ("00" + s).slice(-2);
    }

    this.traceHexWord = function(v)
    {
        var s = (v & 0xffff).toString(16).toUpperCase();
        return "$" + ("0000" + s).slice(-4);
    }

    this.traceBytes = function(bytes)
    {
        var s = [];
        for (var i = 0; i < bytes.length; i++)
            s[s.length] = this.traceHexByte(bytes[i]);

        return s.join(" ");
    }

    this.traceNibKind = function(bytes)
    {
        if (bytes.length >= 3)
        {
            if (bytes[0] == 0xd5 && bytes[1] == 0xaa && bytes[2] == 0x96) return "ADDR_FIELD_PROLOGUE";
            if (bytes[0] == 0xd5 && bytes[1] == 0xaa && bytes[2] == 0xad) return "DATA_FIELD_PROLOGUE";
            if (bytes[0] == 0xde && bytes[1] == 0xaa) return "FIELD_EPILOGUE";
        }

        var sync = bytes.length > 0;
        for (var i = 0; i < bytes.length; i++)
            if (bytes[i] != 0xff) sync = false;

        return sync ? "GAP_SYNC" : "NIB_STREAM";
    }

    this.traceLog = function(eventName, data)
    {
        if (!this.trace.enabled) return;

        data = data || {};
        var deviceN = data.drv;
        if (deviceN === undefined) deviceN = this.state.drv;
        var hw = this.state.hw[deviceN] || {};

        var e = {
            seq: ++this.trace.seq,
            event: eventName,
            time: (typeof performance != "undefined") ? Math.round(performance.now() * 1000) / 1000 : Date.now(),
            drv: deviceN,
            track: hw.track,
            phase: hw.phase,
            offset: hw.offset,
            motor: hw.motor,
            q6: hw.q6,
            q7: hw.q7
        };

        for (var k in data) e[k] = data[k];

        this.trace.events[this.trace.events.length] = e;
        if (this.trace.events.length > this.trace.maxEvents) this.trace.events.shift();
        if (this.trace.echo && typeof console != "undefined") console.log(this.traceFormat(e));
    }

    this.traceFormat = function(e)
    {
        var d = "D" + (e.drv + 1);

        if (e.event == "Q6L_NO_DATA")
        {
            return "DISKII " + e.event
                + " D" + (e.drv + 1)
                + " reason " + e.reason
                + " returned " + e.returned;
        }

        if (e.event == "READ_DATA_BLOCK" || e.event == "WRITE_DATA_BLOCK")
        {
            return "DISKII " + e.event
                + " " + d
                + " T" + this.traceHexByte(e.blockTrack)
                + " pos " + this.traceHexWord(e.startOffset)
                + "-" + this.traceHexWord(e.endOffset)
                + " len " + e.count
                + " " + e.kind
                + " bytes [" + e.bytesHex + (e.truncated ? " ..." : "") + "]";
        }

        if (e.event == "ARM_IN" || e.event == "ARM_OUT" || e.event == "CLICK_IN" || e.event == "CLICK_OUT")
        {
            return "DISKII " + e.event
                + " " + d
                + " track " + e.fromTrack + "->" + e.toTrack
                + " steps " + e.steps
                + (e.clicks ? " clicks " + e.clicks : "");
        }

        if (e.field !== undefined)
        {
            return "DISKII " + e.event
                + " " + d
                + " " + e.field + " " + e.from + "->" + e.to;
        }

        return "DISKII " + e.event + " " + d;
    }

    this.traceChange = function(eventName, deviceN, field, from, to, extra)
    {
        if (!this.trace.enabled) return;
        if (from === to) return;

        if (field == "motor" || field == "drv" || field == "q7")
            this.traceFlush(field);

        var data = extra || {};
        data.drv = deviceN;
        data.field = field;
        data.from = from;
        data.to = to;

        this.traceLog(eventName, data);
    }

    this.traceArmStep = function(deviceN, eventName, fromTrack, toTrack)
    {
        if (!this.trace.enabled) return;

        this.traceFlushData("arm");

        var dir =
            eventName == "ARM_OUT" || eventName == "CLICK_OUT"
            ? "OUT"
            : "IN";

        var click = eventName == "CLICK_OUT" || eventName == "CLICK_IN";

        var p = this.trace.pendingArm;

        if (!p || p.drv != deviceN || p.dir != dir)
        {
            this.traceFlushArm("arm-direction");

            p = {
                drv: deviceN,
                dir: dir,
                event: click ? eventName : "ARM_" + dir,
                fromTrack: fromTrack,
                toTrack: fromTrack,
                steps: 0,
                clicks: 0
            };

            this.trace.pendingArm = p;
        }

        p.toTrack = toTrack;
        p.steps++;

        if (click)
        {
            p.event = eventName;
            p.clicks++;
        }
    }

    this.traceFlushArm = function(reason)
    {
        if (!this.trace.enabled) return;

        var p = this.trace.pendingArm;
        if (!p) return;

        this.trace.pendingArm = null;

        this.traceLog(p.event, {
            drv: p.drv,
            fromTrack: p.fromTrack,
            toTrack: p.toTrack,
            steps: p.steps,
            clicks: p.clicks,
            reason: reason
        });
    }

    this.traceDataByte = function(mode, deviceN, loc, d8)
    {
        if (!this.trace.enabled) return;

        var blockTrack = Math.floor(loc / TRACK_SIZE);
        var offset = loc % TRACK_SIZE;

        var p = this.trace.pendingData;

        var wrappedTrack = p && p.endOffset == TRACK_SIZE - 1 && offset == 0;

        var contiguous =
            p
            && !wrappedTrack
            && p.mode == mode
            && p.drv == deviceN
            && p.blockTrack == blockTrack
            && ((p.endOffset + 1) % TRACK_SIZE) == offset;

        if (!contiguous)
        {
            this.traceFlushData("data-boundary");

            p = {
                mode: mode,
                drv: deviceN,
                blockTrack: blockTrack,
                startLoc: loc,
                endLoc: loc,
                startOffset: offset,
                endOffset: offset,
                count: 0,
                bytes: []
            };

            this.trace.pendingData = p;
        }

        p.endLoc = loc;
        p.endOffset = offset;
        p.count++;

        if (p.bytes.length < this.trace.maxBytes)
            p.bytes[p.bytes.length] = d8 & 0xff;
    }

    this.traceFlushData = function(reason)
    {
        if (!this.trace.enabled) return;

        var p = this.trace.pendingData;
        if (!p) return;

        this.trace.pendingData = null;
        this.traceLog(p.mode == "WRITE" ? "WRITE_DATA_BLOCK" : "READ_DATA_BLOCK", {
            drv: p.drv,
            blockTrack: p.blockTrack,
            startLoc: p.startLoc,
            endLoc: p.endLoc,
            startOffset: p.startOffset,
            endOffset: p.endOffset,
            count: p.count,
            bytes: p.bytes,
            bytesHex: this.traceBytes(p.bytes),
            truncated: p.count > p.bytes.length,
            kind: this.traceNibKind(p.bytes),
            reason: reason
        });
    }

    this.traceUnavailable = function(deviceN, reason)
    {
        if (!this.trace.enabled) return;

        var key = deviceN + ":" + reason;
        if (this.trace.lastUnavailable == key) return;

        this.trace.lastUnavailable = key;
        this.traceFlush("unavailable");

        this.traceLog("Q6L_NO_DATA", {
            drv: deviceN,
            reason: reason,
            returned: this.traceHexByte(0xff)
        });
    }

    this.diskMenu_detail = function(arg)
    {
        switch(arg.id)
        {
            case "softwareCat":
                var popup_id = arg.id + "_popup";
                if(document.getElementById(arg.id).innerHTML=="")   // first time. (class='appbox com_popup_frame' is the bug)
                {
                    document.getElementById(arg.id).innerHTML =
                    "<div  id='"+popup_id+"' hidden='' class='appbox com_popup_frame' style='position:absolute;left:800px;width:450px;height:450px;text-align:left;padding:0px;margin:0px'></div>";
                }
                oCOM.POPUP.toggle(popup_id);

                arg.owner = "RetroAppleJS";
                arg.repo  = "RetroAppleJS.github.io";
                arg.basepath = "disks";
                arg.path  = "disks";
                arg.ref   = "main";

                this.getSoftwareCatRows(arg);
            break;

            case "surfaceMap":
                var popup_id = arg.id + "_popup";
                if(document.getElementById(arg.id).innerHTML=="")   // first time. (class='appbox com_popup_frame' is the bug)
                {
                    document.getElementById(arg.id).innerHTML =
                        "<div  id='"+popup_id+"' hidden='' class='appbox com_popup_frame' style='position:absolute;left:800px;width:450px;height:450px;text-align:left;padding:0px;margin:0px'>"
                        +this.surfaceMap_html(popup_id)
                        +"</div>";
                }
                oCOM.POPUP.toggle(popup_id);                         // Open/close through the requested popup mechanism.
                this.surfaceMap_update(popup_id);                    // Do one immediate draw so the popup is not empty before the next 2 Hz refresh.            }
            break;
        }
    }


    this.GitHubDirOffline =
    {
        "https://api.github.com/repos/RetroAppleJS/RetroAppleJS.github.io/contents/disks?ref=main":
        {
            list:
            [
                {
                    name:"Apple DOS 3.3.dsk",
                    path:"disks/Apple DOS 3.3.dsk",
                    type:"file",
                    size:143360,
                    download_url:"https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/Apple%20DOS%203.3.dsk",
                    html_url:"https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/disks/Apple%20DOS%203.3.dsk"
                },
                {
                    name:"BLANK_DOS.DSK",
                    path:"disks/BLANK_DOS.DSK",
                    type:"file",
                    size:143360,
                    download_url:"https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/BLANK_DOS.DSK",
                    html_url:"https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/disks/BLANK_DOS.DSK"
                },
                {
                    name:"BLANK_PRONTODOS.dsk",
                    path:"disks/BLANK_PRONTODOS.dsk",
                    type:"file",
                    size:143360,
                    download_url:"https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/BLANK_PRONTODOS.dsk",
                    html_url:"https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/disks/BLANK_PRONTODOS.dsk"
                },
                {
                    name:"ProDOS 8.dsk",
                    path:"disks/ProDOS 8.dsk",
                    type:"file",
                    size:143360,
                    download_url:"https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/ProDOS%208.dsk",
                    html_url:"https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/disks/ProDOS%208.dsk"
                }
            ],
            arg:
            {
                id:"softwareCat",
                owner:"RetroAppleJS",
                repo:"RetroAppleJS.github.io",
                basepath:"disks",
                path:"disks",
                ref:"main"
            }
        }
    };

    this.OfflineDisks =
    {
        "disks/Apple DOS 3.3.dsk":
        { 
            encoding:"zlib-base64",
            data:"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" 
        },

        "disks/BLANK_DOS.DSK":
        { 
            encoding:"zlib-base64",
            data:"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"
        },

        "disks/BLANK_PRONTODOS.dsk":
        { 
            encoding:"zlib-base64",
            data:"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"
        },

        "disks/ProDOS 8.dsk":
        { 
            encoding:"zlib-base64",
            data:"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"
        }

    };

    this.GitHubDirCache = {};

    this.getSoftwareCatRows = function(arg)
    {

        function GH_listDir(arg, callback)
        {
            arg.ref = arg.ref || "main";
            arg.path = arg.path || "";

            var disk2 = apple2plus.DiskObj();
            var url = disk2.githubContentsURL(arg);

            function useOfflineDir(reason)
            {
                // Important: do not let offline data masquerade as GitHub cache.
                // Keep this empty so a later online attempt really performs HTTP again.
                disk2.GitHubDirCache = {};

                var offline = disk2.getOfflineDir(url);

                if(offline != null)
                {
                    console.warn("Using offline GitHub directory fallback: " + reason);
                    callback(null, offline.list, offline.arg);
                    return true;
                }

                return false;
            }

            // If the browser already knows we are offline, do not use stale cache.
            if(disk2.isLikelyOffline())
            {
                if(useOfflineDir("navigator.onLine=false"))
                    return;
            }

            if(disk2.GitHubDirCache[url] === undefined)
            {
                oCOM.GetHTTP(url, "text", function()
                {
                    if(this.status != 200)
                    {
                        if(useOfflineDir("HTTP " + this.status))
                            return;

                        callback({
                            status:this.status,
                            message:this.responseText || this.response
                        });
                        return;
                    }

                    try
                    {
                        var json = JSON.parse(this.responseText || this.response);

                        var list = json.map(function(e)
                        {
                            return {
                                name:e.name,
                                path:e.path,
                                type:e.type,
                                size:e.size,
                                download_url:e.download_url,
                                html_url:e.html_url
                            };
                        });

                        // Only real online GitHub data goes into the cache.
                        disk2.GitHubDirCache[url] = {
                            list:list,
                            arg:disk2.cloneJSON(arg)
                        };

                        callback(null, list, arg);
                    }
                    catch(e)
                    {
                        if(useOfflineDir("JSON parse failed: " + e.message))
                            return;

                        callback({
                            status:this.status,
                            message:e.message
                        });
                    }
                });
            }
            else
            {
                var cache = disk2.GitHubDirCache[url];
                callback(null, cache.list, cache.arg);
            }
        }

        // MAIN DATA CALL
        GH_listDir(
            arg,
            function(err, list, arg)             // CALLBACK FUNCTION
            {
                if(err) { console.warn("GitHub directory listing failed", err); return; }
                var dirs  = list.filter(function(e) { return e.type == "dir";  });
                var files = list.filter(function(e) { return e.type == "file"; });
                var rows = [];

                for(var i=0;i<dirs.length;i++)
                {
                    rows.push({
                        name: dirs[i].name,
                        path: dirs[i].path,
                        size: dirs[i].size,
                        type: dirs[i].type
                    });
                }

                for(var i=0;i<files.length;i++)
                {
                    rows.push({
                        name: files[i].name,
                        path: files[i].path,
                        size: files[i].size,
                        type: files[i].type
                    });
                }

                function clone(obj) {
                    if (null == obj || "object" != typeof obj) return obj;
                    var copy = obj.constructor();
                    for (var attr in obj) {
                        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
                    }
                    return copy;
                }

                var arg_cpy = clone(arg);

                var bParentDir = arg.path != arg.basepath;

                var parentpath = arg.path.split("/");
                delete parentpath[parentpath.length-1];
                arg_cpy.path = parentpath.join("/");
                arg_cpy.path = arg_cpy.path.substring(0,arg_cpy.path.length-1);

                var parentDir = ["<div title='"+JSON.stringify(arg_cpy)+"' style=cursor:pointer onclick='apple2plus.DiskObj().getSoftwareCatRows("+JSON.stringify(arg_cpy)+")'>","</div>"];
                    
                // TABLE HEAD
                var head = "" 
                    //+ parentDir[0]+"<i class=\"fa fa-arrow-alt-circle-up\"></i>"+parentDir[0];
                    +(bParentDir?"<div class=appbut style=width:25px title='"+JSON.stringify(arg_cpy)+"' style=cursor:pointer onclick='apple2plus.DiskObj().getSoftwareCatRows("+JSON.stringify(arg_cpy)+")'>"
                    +"<i class=\"fa fa-arrow-alt-circle-up\"></i></div>":"")
                    +'<div style="margin-top:6px;">'
                    + '<table style="width:100%;border-collapse:collapse;font-size:11px;">'
                    + '<tr>'
                    + '<th style="text-align:left;padding:2px 4px;">Name</th>'
                    + '<th style="text-align:left;padding:2px 4px;">Size</th>'
                    //+ '<th style="text-align:left;padding:2px 4px;">Type</th>'
                    //+ '<th style="text-align:left;padding:2px 4px;">Path</th>'
                    + '</tr>';

                // TABLE BODY
                for(var i=0;i<rows.length;i++)
                {
                    var bDir = rows[i].type=="dir";
                    var arg_cpy = clone(arg);
                    arg_cpy.path = arg_cpy.path+"/"+rows[i].name;

                    // LINK TO A SUBDIREcTORY
                    var icon = bDir?"<i class=\"fa fa-folder\"></i> ":"<i class=\"fa fa-cloud-upload-alt\"></i>";
                    var cmd  = bDir
                        ?"apple2plus.DiskObj().getSoftwareCatRows("+JSON.stringify(arg_cpy)+")"     // FOLDER CLICK
                        :"apple2plus.DiskObj().getFile("+JSON.stringify(arg_cpy)+")";               // FILE CLICK
                    var subDir = ["<div title='"+JSON.stringify(arg_cpy)+"' style=cursor:pointer onclick='"+cmd+"'>"+icon,"</div>"];
                    
                    //console.log("subDir="+subDir[0]);
                    
                    head += '<tr>'
                    + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+subDir[0]+oCOM.escapeHTML(rows[i].name)+subDir[1]+'</td>'
                    + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].size)+'</td>'
                    //+ '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].type)+'</td>'
                    //+ '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].path)+'</td>'
                    + '</tr>';
                }
                head += '</table></div>';

                var popup_id = arg.id + "_popup";
                var body_id  = arg.id + "_body";

                var closeBtn = "<div class=\"appbut\" "
                        +"onclick=\"oCOM.POPUP.toggle('"+popup_id+"');event.stopPropagation();\" "
                        +"style=\"text-align:center;float:right;\">x</div>";

                document.getElementById(popup_id).innerHTML =
                    oCOM.POPUP.title_body_html("<span>SOFTWARE CATALOG</span>" + closeBtn, head, body_id, "com_popup_body com_scroll_xy");
            }
        );
    }


    this.getFile = function(arg)
    {
        try
        {
            var disk2 = oCOM.default(
                oEMU.component.IO.AppleDisk,
                {state:{active:false}},
                "AppleDisk"
            );

            if(disk2.state.active == false)
                return;

            arg.ref = arg.ref || "main";

            // Default to D1, but allow catalog entries to pass arg.drv = "D2" or 2 later.
            // if D1 is occupied, switch to D2, if D2 is occupied, switch to D1
            var drv = (this.isDiskData("D1") && !this.isDiskData("D2") || arg.drv == "D2" ? "D2" : "D1");


            // TODO: CONVERT SLT,DRV string to SLOT_I,DRV_I and backwards
            //if(typeof drv == "number") drv = "D" + drv;

            // Only disk images should be mounted here.
            var ext = (arg.path || "").split(".").pop().toLowerCase();
            if(ext != "dsk" && ext != "do" && ext != "po" && ext != "nib")
            {
                console.warn("Not a disk image: " + arg.path);
                return;
            }

            // Build raw GitHub URL.
            // Important: encode each path segment separately so spaces become %20,
            // but slashes remain real path separators.
            var raw_path = arg.path
                .split("/")
                .map(function(p) { return encodeURIComponent(p); })
                .join("/");

            var full_path =
                "https://raw.githubusercontent.com/"
                + arg.owner + "/"
                + arg.repo + "/"
                + encodeURIComponent(arg.ref) + "/"
                + raw_path;


            function mountDiskBytes(bytes, source)
            {
                // Let the image detector decide dsk/po/nib instead of relying on extension.
                var info = disk2.detectDiskImageType(bytes);
                var nibBytes;

                switch(info.type)
                {
                    case "nib":
                        nibBytes = bytes;
                        break;

                    case "po":
                        nibBytes = disk2.convertPo2Nib(bytes);
                        break;

                    case "dsk":
                        nibBytes = disk2.convertDsk2Nib(bytes);
                        break;

                    case "woz":
                        throw new Error("WOZ detected, but convertWoz2Nib() is not implemented yet");

                    default:
                        throw new Error("Unsupported or unknown disk image type: " + info.reason);
                }

                if(nibBytes.length != 232960)
                {
                    throw new Error(
                        "unsupported mounted image size "
                        + nibBytes.length
                        + " bytes for " + arg.path
                    );
                }

                apple2plus.loadDisk(nibBytes, drv);

                var fileName = arg.name || (arg.path || "").split("/").pop() || "disk image";
                disk2.setDriveCatalogFile(drv, fileName);

                if(typeof highlight_appbut == "function")
                {
                    var file_id = "file_" + arg.path.replace(/[^A-Za-z0-9_\-]/g, "_");
                    var el = document.getElementById(file_id);
                    if(el) highlight_appbut(el, true);
                }

                console.log(
                    "Loaded disk "
                    + arg.path
                    + " into " + drv
                    + " (" + nibBytes.length + " bytes, source=" + source + ", type=" + info.type + ")"
                );
            }

            function loadOfflineDisk(reason)
            {
                try
                {
                    // Again: do not cache offline fallback as GitHub data.
                    disk2.GitHubDirCache = {};

                    var bytes = disk2.getOfflineDiskBytes(arg, full_path);

                    if(bytes == null)
                    {
                        console.warn("No offline disk available for " + arg.path + " after " + reason);
                        return false;
                    }

                    console.warn("Using offline disk fallback for " + arg.path + ": " + reason);
                    mountDiskBytes(bytes, "offline");
                    return true;
                }
                catch(e)
                {
                    oCOM.POPUP.html("offline getFile failed: " + e.name + " " + e.message);
                    return true;
                }
            }

            // Fast path when the browser knows it is offline.
            if(disk2.isLikelyOffline())
            {
                if(loadOfflineDisk("navigator.onLine=false"))
                    return;
            }

            oCOM.GetHTTP(full_path, "arraybuffer",
                function()
                {
                    try
                    {
                        if(this.status && this.status != 200)
                        {
                            if(loadOfflineDisk("HTTP " + this.status))
                                return;

                            console.warn(
                                "ERROR LOADING DISK: HTTP "
                                + this.status + " " + full_path
                            );
                            return;
                        }

                        var arraybuffer = this.response;

                        if(!arraybuffer || arraybuffer.byteLength === undefined)
                        {
                            if(loadOfflineDisk("empty HTTP response"))
                                return;

                            console.warn("ERROR LOADING DISK: empty response " + full_path);
                            return;
                        }

                        var ui8 = new Uint8Array(arraybuffer);

                        if(arraybuffer.byteLength < 100)
                        {
                            var enc = new TextDecoder("utf-8");
                            var msg = enc.decode(ui8);

                            if(loadOfflineDisk("short HTTP response: " + msg))
                                return;

                            console.warn("ERROR LOADING DISK: " + msg);
                            return;
                        }

                        mountDiskBytes(Array.from(ui8), "github");
                    }
                    catch({ name, message })
                    {
                        oCOM.POPUP.html(
                            "getFile load failed: "
                            + name + " " + message
                        );
                    }
                }
            );


        }
        catch({ name, message })
        {
            oCOM.POPUP.html("getFile 1.0 failed: " + name + " " + message);
        }
    }



    this.cloneJSON = function(obj)
    {
        return JSON.parse(JSON.stringify(obj));
    }

    this.githubContentsURL = function(arg)
    {
        arg.ref = arg.ref || "main";
        arg.path = arg.path || "";

        return "https://api.github.com/repos/"
            + arg.owner + "/"
            + arg.repo + "/contents/"
            + arg.path
            + "?ref=" + encodeURIComponent(arg.ref);
    }

    this.githubRawURL = function(arg)
    {
        arg.ref = arg.ref || "main";

        var raw_path = arg.path
            .split("/")
            .map(function(p) { return encodeURIComponent(p); })
            .join("/");

        return "https://raw.githubusercontent.com/"
            + arg.owner + "/"
            + arg.repo + "/"
            + encodeURIComponent(arg.ref) + "/"
            + raw_path;
    }

    this.isLikelyOffline = function()
    {
        return (typeof navigator != "undefined" && navigator.onLine === false);
    }

    this.getOfflineDir = function(url)
    {
        var disk2 = apple2plus.DiskObj();
        var entry = disk2.GitHubDirOffline[url];

        if(entry === undefined)
            return null;

        return {
            list: disk2.cloneJSON(entry.list),
            arg:  disk2.cloneJSON(entry.arg)
        };
    }



    this.base64ToUint8Array = function(b64)
    {
        var bin = atob(b64);
        var out = new Uint8Array(bin.length);

        for(var i = 0; i < bin.length; i++)
            out[i] = bin.charCodeAt(i) & 0xff;

        return out;
    }

    this.getOfflineDiskBytes = function(arg, full_path)
    {
        var disk2 = apple2plus.DiskObj();

        var rec =
            disk2.OfflineDisks[arg.path] ||
            disk2.OfflineDisks[arg.name] ||
            disk2.OfflineDisks[full_path];

        if(rec === undefined)
            return null;

        if(typeof rec == "string")
        {
            rec = {
                encoding:"zlib-base64",
                data:rec
            };
        }

        var bytes = disk2.base64ToUint8Array(rec.data);

        if(rec.encoding == "zlib-base64")
        {
            if(typeof pako == "undefined" || typeof pako.inflate != "function")
                throw new Error("Offline disk is zlib-base64, but pako.inflate is not available");

            bytes = pako.inflate(bytes);
        }
        else if(rec.encoding == "base64")
        {
            // already decoded above
        }
        else
        {
            throw new Error("Unsupported offline disk encoding: " + rec.encoding);
        }

        return Array.from(bytes);
    }



    this.base64ToUint8Array = function(b64)
    {
        var bin = atob(b64);
        var out = new Uint8Array(bin.length);

        for(var i = 0; i < bin.length; i++)
            out[i] = bin.charCodeAt(i) & 0xff;

        return out;
    }

    this.getOfflineDiskBytes = function(arg, full_path)
    {
        var disk2 = apple2plus.DiskObj();

        var rec =
            disk2.OfflineDisks[arg.path] ||
            disk2.OfflineDisks[arg.name] ||
            disk2.OfflineDisks[full_path];

        if(rec === undefined)
            return null;

        if(typeof rec == "string")
        {
            rec = {
                encoding:"zlib-base64",
                data:rec
            };
        }

        var bytes = disk2.base64ToUint8Array(rec.data);

        if(rec.encoding == "zlib-base64")
        {
            if(typeof pako == "undefined" || typeof pako.inflate != "function")
                throw new Error("Offline disk is zlib-base64, but pako.inflate is not available");

            bytes = pako.inflate(bytes);
        }
        else if(rec.encoding == "base64")
        {
            // already decoded above
        }
        else
        {
            throw new Error("Unsupported offline disk encoding: " + rec.encoding);
        }

        return Array.from(bytes);
    }




    this.diskInputEl = function(drv)
    {
        if(typeof drv == "number") drv = "D" + drv;
        return document.getElementById("file_" + drv);
    }

    this.diskButtonEl = function(drv)
    {
        if(typeof drv == "number") drv = "D" + drv;

        var btn = document.getElementById("but_" + drv);
        if(btn != null) return btn;

        var form = document.getElementById("f_" + drv);
        if(form == null) return null;

        return form.querySelector("input[type=button]");
    }

    

    

    this.driveButtonHover = function(btn, hover)
    {
        if(btn == null) return;
        btn.value = hover ? " Eject " : (btn.dataset.empty || btn.value || "Drive");
    }


    this.diskMiddleEl = function(drv)
    {
        if(typeof drv == "number") drv = "D" + drv;
        return document.getElementById("f_" + drv);
    }

    this.diskFileInputHTML = function(drv)
    {
        if(typeof drv == "number") drv = "D" + drv;
        return "        <input type=\"file\" name=\"" + drv + "\" id=\"file_" + drv + "\" style=\"display:inline-block\" onchange=\"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,'" + drv + "')\">"
    }

    this.diskCatalogLabelHTML = function(drv, fileName)
    {
        if(typeof drv == "number") drv = "D" + drv;

        var safeName = oCOM.escapeHTML(fileName || "disk image");

        return "<button disabled style=\"padding:1px 5px 1px 5px;opacity:0.5\">Choose File</button>"
            +"<div class=\"fileBox\" "
            + " id=\"file_" + drv + "\""
            + " title=\"" + safeName + "\">"
            +safeName
            +"</div>"
    }

    this.setDriveCatalogFile = function(drv, fileName)
    {
        try
        {
            if(typeof drv == "number") drv = "D" + drv;

            var el = this.diskMiddleEl(drv);
            if(el == null) return;

            el.innerHTML = this.diskCatalogLabelHTML(drv, fileName);

            var btn = document.getElementById("but_" + drv);
            if(btn != null)
            {
                btn.value = btn.dataset.empty || drv;
                btn.title = drv + " loaded: " + (fileName || "disk image");
            }
        }
        catch({ name, message })
        {
            console.warn("setDriveCatalogFile failed: " + name + " " + message);
        }
    }
    

    this.restoreDriveFileInput = function(drv)
    {
        try
        {
            if(typeof drv == "number") drv = "D" + drv;

            var el = this.diskMiddleEl(drv);
            if(el == null) return;

            el.innerHTML = this.diskFileInputHTML(drv);

            var btn = document.getElementById("but_" + drv);
            if(btn != null)
            {
                btn.value = btn.dataset.empty || drv;
                btn.title = drv + ": no disk";
            }
        }
        catch({ name, message })
        {
            console.warn("restoreDriveFileInput failed: " + name + " " + message);
        }
    }
    

    //    ███████ ██    ██ ██████  ███████  █████   ██████ ███████     ███    ███  █████  ██████  
    //    ██      ██    ██ ██   ██ ██      ██   ██ ██      ██          ████  ████ ██   ██ ██   ██ 
    //    ███████ ██    ██ ██████  █████   ███████ ██      █████       ██ ████ ██ ███████ ██████  
    //         ██ ██    ██ ██   ██ ██      ██   ██ ██      ██          ██  ██  ██ ██   ██ ██      
    //    ███████  ██████  ██   ██ ██      ██   ██  ██████ ███████     ██      ██ ██   ██ ██    
    // SURFACE MAP

    this.surfaceMap_palette = null;
    this.surfaceMap_headCell = [null,null];

    this.surfaceMap_build_palette = function()
    {
        if(this.surfaceMap_palette != null) return this.surfaceMap_palette;
        var col_arr = ["#2D788E","#2CA984","#7DD552","#FDEA27"];
        var pal = Array(101);
        for(var i=0;i<100;i++)
        {
            var rng = 100/(col_arr.length-1);
            var sec_idx = Math.floor(i/rng);
            var sec_pct = Math.round(Math.floor(i%rng)*100/rng);
            var rgb_rng = [ oCOM.HEX2RGB(col_arr[sec_idx]) , oCOM.HEX2RGB(col_arr[sec_idx+1]) ];
            pal[i] = "#"+oCOM.RGB2HEX(interpolate_arr(rgb_rng[0],rgb_rng[1],sec_pct)).join("");
        }

        pal[0] = "#000000";
        pal[100] = col_arr[col_arr.length-1];

        this.surfaceMap_palette = pal;
        return pal;

        function interpolate_arr(a,b,pct)
        {
            for(var i=0,out = [];i<a.length;i++)  out[i] = Math.round(a[i] + (b[i]-a[i]) * pct / 100);
            return out;
        }
    };

    this.surfaceMap_grid_html = function(drv)
    {
        var d = drv + 1, s = [];
        s.push("<div style=\"display:inline-block;vertical-align:top;margin-right:14px\">");
        s.push("<div style=\"font-weight:bold;text-align:center;margin-bottom:4px\">D"+d+"</div>");
        s.push("<table id=\"surfaceMap_table_D"+d+"\" style=\"border-collapse:collapse;font-family:Courier;font-size:9px\">");

        for(var track=0; track<35; track++)
        {
            s.push("<tr>");
            s.push("<td style=\"padding-right:4px;color:#aaa;text-align:right\">T"+track+"</td>");
            for(var sector=0; sector<16; sector++)
            {
                s.push("<td id=\"surfaceMap_D"+d+"_"+track+"_"+sector+"\""
                    +" style=\"width:10px;height:10px;border:1px solid #333;background-color:#111\""
                    +" title=\"D"+d+" T"+track+" S"+sector+"\"></td>");
            }
            s.push("</tr>");
        }
        s.push("</table>");
        s.push("<div id=\"surfaceMap_status_D"+d+"\" style=\"text-align:center;color:#aaa;margin-top:4px\">no disk</div>");
        s.push("</div>");
        return s.join("");
    }

    this.surfaceMap_html = function(popup_id)
    {
        var closeBtn = "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+popup_id+"');\" "
        +"style=\"width:25px;text-align:center;\">x</div>";

        var ret = "<div>"
        + "  <div style=\"display:flex;align-items:center;gap:6px;white-space:nowrap;min-width:0px;\">"
        + "      <button class=\"appbut\" style=\"text-align:center;\" title=\"Disk surface map sync\">"
        + "          <i class=\"fa fa-sync-alt\" id=\"surfaceMap_monitoring\" "
        + "onclick=\"oCOM.POPUP.set_class(this,'fa-stop-circle','fa-sync-alt',oCOM.POPUP.get_class(this,1)!='fa-stop-circle')\""       
        +           "\">"
        + "         </i>"
        + "      </button>"
        + "      <div style=\"padding:5px 5px;flex:1;\"><b>Disk surface map</b></div>"
        +        closeBtn
        + "  </div>"
        + "  <div id=\"surfaceMap_body\" style=\"margin-left:48px;white-space:nowrap\">"
        +      this.surfaceMap_grid_html(0)
        +      this.surfaceMap_grid_html(1)
        + "  </div>"
        + "</div>";

        return ret;
    }

    this.surfaceMap_update = function(popup_id)
    {
        var pal = this.surfaceMap_build_palette();

        for(var deviceN=0; deviceN<2; deviceN++)
        {
            var deviceID = apple2plus.hwObj().io.deviceN2ID(deviceN,"DISKII");

            var status = document.getElementById("surfaceMap_status_"+deviceID);
            if(this.state.diskData[deviceN] == null)
            {
                if(status) status.innerHTML = "no disk";
                this.surfaceMap_clear_drive(deviceN);
                continue;
            }

            var dskBytes = null;
            try { dskBytes = this.convertNib2Dsk(this.state.diskData[deviceN]); }
            catch(e)
            {
                if(status) status.innerHTML = "decode error";
                continue;
            }

            if(status) status.innerHTML = dskBytes.length+" bytes";
            for(var track=0; track<35; track++)
            {
                for(var sector=0; sector<16; sector++)
                {
                    var offs = (track << 12) + (sector << 8), nz = 0, sum = 0;
                    for(var i=0; i<256; i++)
                    {
                        var b = dskBytes[offs+i] & 0xff; sum += b;
                        if(b != 0) nz++;
                    }

                    // Sector “density”: black for empty/zero-like sectors, bright for sectors with many non-zero bytes.
                    var pct = Math.round(nz * 100 / 256);
                    var el = document.getElementById("surfaceMap_"+deviceID+"_"+track+"_"+sector);

                    if(el)
                    {
                        el.style.backgroundColor = pal[pct];
                        el.title =
                            deviceID
                            +" T"+track
                            +" S"+sector
                            +" $"+oCOM.getHexMulti(offs,5)
                            +" nonzero="+nz+"/256"
                            +" avg="+Math.round(sum/256);
                        el.style.outline = "";
                    }
                }
            }

            this.surfaceMap_mark_head(deviceN);
        }
    };

    this.surfaceMap_clear_drive = function(deviceN)
    {
        const deviceID = apple2plus.hwObj().io.deviceN2ID(deviceN,"DISKII");

        for(var track=0; track<35; track++)
        {
            for(var sector=0; sector<16; sector++)
            {
                var el = document.getElementById("surfaceMap_"+deviceID+"_"+track+"_"+sector);
                if(el)
                {
                    el.style.backgroundColor = "#111";
                    el.style.outline = "";
                    el.title = deviceID+" T"+track+" S"+sector+" - no disk";
                }
            }
        }
    };

    this.surfaceMap_mark_head = function(deviceN)
    {
        const deviceID = apple2plus.hwObj().io.deviceN2ID(deviceN,"DISKII");
        if(this.surfaceMap_headCell[deviceN] != null)
        {
            var old = document.getElementById(this.surfaceMap_headCell[deviceN]);
            if(old) old.style.outline = "";
        }
        var hw = this.state.hw[deviceN]; if(!hw) return;
        var track = Math.max(0,Math.min(34,hw.track));
        var sector = Math.max(0,Math.min(15,Math.floor(hw.offset / (6656/16))));
        var id = "surfaceMap_"+deviceID+"_"+track+"_"+sector;
        var el = document.getElementById(id);
        if(el) el.style.outline = "2px solid #fff";
        this.surfaceMap_headCell[deviceN] = id;
    };

}

