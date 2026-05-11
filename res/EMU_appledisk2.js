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
    var bDebug   = false;
    var bDebug_N = false;   // debug disk noise only 

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
            ,"stats":{"motor":0}
            ,"LED":false
        },{
             "track":0
            ,"phase":0
            ,"data_latch":0
            ,"motor":0
            ,"q6":0
            ,"q7":0
            ,"offset":0
            ,"stats":{"motor":0}
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
    }

    this.getDataObj = function() { return this.state.hw }

    this.GUI_update = function() {}   // overridable function to update drive status (LED)
    
    this.update_logs = function(name) {}   // overridable function
    

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
            // Stepper motor on.
            if ((addr & 1) != 0) {
                var p = ((addr >> 1) & 3); // phase we're turning on.

                if (((this.state.hw[deviceN].phase + 1) & 3) == p) {
                    // Ascending order, track arm moves inward.
                    this.state.hw[deviceN].phase = p;
                    this.update_logs("phase");
                    if ((this.state.hw[deviceN].phase & 1) == 0)
                    {
                        var oldTrack = this.state.hw[deviceN].track;
                        if (++this.state.hw[deviceN].track >= 35)
                        {
                            this.state.hw[deviceN].track = 35; // CLICK! CLICK! CLICK!
                            this.dN_update("CLICK_OUT");
                            this.traceArmStep(deviceN, "CLICK_OUT", oldTrack, this.state.hw[deviceN].track);
                        }
                        else
                        {
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
                        if (--this.state.hw[deviceN].track < 0)
                        {
                            this.state.hw[deviceN].track = 0; // CLICK! CLICK! CLICK!
                            this.dN_update("CLICK_IN");
                            this.traceArmStep(deviceN, "CLICK_IN", oldTrack, this.state.hw[deviceN].track);
                        }
                        else
                        {
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

                if (this.state.hw[deviceN].q7)
                {
                    // Write to disk.
                    this.state.diskData[deviceN][loc] = this.state.hw[deviceN].data_latch;
                    this.traceDataByte("WRITE", deviceN, loc, this.state.hw[deviceN].data_latch);
                    return this.state.hw[deviceN].data_latch;
                }
                else
                {
                    // Read from disk.
                    var d8 = this.state.diskData[deviceN][loc];
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

    this.setDiskData = function(imageBytes, deviceID)
    {
        if (imageBytes === undefined || deviceID === undefined) return;

        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID, "DISKII");
        var info = this.detectDiskImageType(imageBytes);
        console.log("DISK info = "+JSON.stringify(info));
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
                // Detection is possible here, but actual WOZ loading needs a parser.
                // For simple, unprotected 5.25" disks this could later become:
                // nibBytes = this.convertWoz2Nib(imageBytes);
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
        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID,"DISKII");
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
        const deviceN = apple2plus.hwObj().io.deviceID2N(deviceID,"DISKII");
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
/*
        if(track==0 && sec==0)
        {
            for(var i=0;i<256;i+=16)
            {
                if (bDebug) console.log("dskBytes["+i+"] = "
                     +oCOM.getHexByte(dskBytes[i])    + " " +oCOM.getHexByte(dskBytes[i+1])+" "  +oCOM.getHexByte(dskBytes[i+2]) + " "  +oCOM.getHexByte(dskBytes[i+3])
                + " "+oCOM.getHexByte(dskBytes[i+4])  + " " +oCOM.getHexByte(dskBytes[i+5])+" "  +oCOM.getHexByte(dskBytes[i+6]) + " "  +oCOM.getHexByte(dskBytes[i+7])
                + " "+oCOM.getHexByte(dskBytes[i+8])  + " " +oCOM.getHexByte(dskBytes[i+9])+" " +oCOM.getHexByte(dskBytes[i+10]) + " " +oCOM.getHexByte(dskBytes[i+11])
                + " "+oCOM.getHexByte(dskBytes[i+12]) + " " +oCOM.getHexByte(dskBytes[i+13])+" "+oCOM.getHexByte(dskBytes[i+14]) + " " +oCOM.getHexByte(dskBytes[i+15])
                );
            }

        }
*/

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

        /*
        if(track==0 && sec==0)
        {
            for(var i=0;i<256;i+=16)
            {
                if(bDebug) console.log("postnib["+i+"] = "
                    +oCOM.getHexByte(postnib[i])    + " " +oCOM.getHexByte(postnib[i+1])+" "  +oCOM.getHexByte(postnib[i+2]) + " "  +oCOM.getHexByte(postnib[i+3])
                + " "+oCOM.getHexByte(postnib[i+4])  + " " +oCOM.getHexByte(postnib[i+5])+" "  +oCOM.getHexByte(postnib[i+6]) + " "  +oCOM.getHexByte(postnib[i+7])
                + " "+oCOM.getHexByte(postnib[i+8])  + " " +oCOM.getHexByte(postnib[i+9])+" " +oCOM.getHexByte(postnib[i+10]) + " " +oCOM.getHexByte(postnib[i+11])
                + " "+oCOM.getHexByte(postnib[i+12]) + " " +oCOM.getHexByte(postnib[i+13])+" "+oCOM.getHexByte(postnib[i+14]) + " " +oCOM.getHexByte(postnib[i+15])
                );
            }
        }
        */

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

                if (val < 0)
                {
                    console.error(
                        "NIB2DSK DATA ERROR:"
                        + " $T" + oCOM.getHexByte(trk)
                        + " $S" + oCOM.getHexByte(sec)
                        + " invalid GCR byte " + oCOM.getHexByte(gcrByte)
                        + " at data offset " + j
                    );
                    return null;
                }

                var decoded = val ^ prev;

                if (j < 86)
                {
                    // First 86 encoded bytes are prenib[341] down to prenib[256].
                    prenib[341 - j] = decoded;
                    prev = decoded;
                }
                else if (j < 342)
                {
                    // Remaining 256 encoded bytes are prenib[0] through prenib[255].
                    prenib[j - 86] = decoded;
                    prev = decoded;
                }
                else
                {
                    // Final byte is checksum. It should decode to zero.
                    if (decoded != 0)
                    {
                        console.warn(
                            "NIB2DSK CHECKSUM WARNING:"
                            + " $T" + oCOM.getHexByte(trk)
                            + " $S" + oCOM.getHexByte(sec)
                            + " checksum decoded as " + oCOM.getHexByte(decoded)
                        );
                    }
                }
            }

            var sectorBytes = new Array(256);
            for (var i = 0; i < 256; i++)
                sectorBytes[i] = (prenib[i] << 2) & 0xfc;

            // Rebuild the low 2 bits from prenib[256..341].
            for (var j = 0; j < 86; j++)
            {
                var p = prenib[341 - j];

                // bytes 172..255
                if (j + 172 < 256)
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


    this.detectDiskImageType = function(imageBytes)
    {
        if (!imageBytes) return { type:"unknown", confidence:0, reason:"no data" };

        const DSK_SIZE = 143360;   // 35 * 16 * 256
        const NIB_SIZE = 232960;   // 35 * 6656
        const TRACKS = 35;
        const SECTORS = 16;
        const SECTOR_SIZE = 256;
        const TRACK_SIZE_DSK = SECTORS * SECTOR_SIZE;
        const TRACK_SIZE_NIB = 6656;

        function b(off)
        {
            return imageBytes[off] & 0xff;
        }

        function validTrack(t)
        {
            return t >= 0 && t < TRACKS;
        }

        function validSector(s)
        {
            return s >= 0 && s < SECTORS;
        }

        function isWoz()
        {
            if (imageBytes.length < 12) return false;

            // "WOZ1" or "WOZ2", followed by FF 0A 0D 0A.
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
                if (b(i) == b0 && b(i + 1) == b1 && b(i + 2) == b2)
                    return true;

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

                if (hasAddressPrologue && hasDataPrologue)
                    goodTracks++;
            }

            // Be tolerant: some tracks may be damaged, oddly aligned, or non-standard.
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
            for (var raw = 0; raw < 16; raw++)
                out[raw2file[raw]] = raw;
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

        function scoreDOS33(raw2file)
        {
            var score = 0;

            // DOS 3.3 VTOC is physical track 17, sector 0.
            var catTrack  = byteAtPhysicalSector(17, 0, 1, raw2file);
            var catSector = byteAtPhysicalSector(17, 0, 2, raw2file);
            var dosRel    = byteAtPhysicalSector(17, 0, 3, raw2file);

            if (!validTrack(catTrack) || !validSector(catSector))
                return 0;

            if (catTrack == 17) score += 2;
            else score += 1;

            if (dosRel >= 1 && dosRel <= 3)
                score += 1;

            // Follow a few catalog sectors. This helps distinguish DOS-order
            // from ProDOS-order because sectors after 15 are not at the same offsets.
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

                if (nextTrack == 0 && nextSector == 0)
                {
                    score += 2;
                    break;
                }

                if (validTrack(nextTrack) && validSector(nextSector))
                    score += 2;
                else
                {
                    score -= 2;
                    break;
                }

                t = nextTrack;
                s = nextSector;
            }

            return score;
        }

        function scoreProDOS(raw2file)
        {
            var score = 0;

            // ProDOS volume directory normally starts at block 2.
            // First directory entry starts at byte 4 of the block.
            var storageAndNameLen = byteAtProDOSBlock(2, 4, raw2file);
            var storageType = storageAndNameLen >> 4;
            var nameLen = storageAndNameLen & 0x0f;

            if (storageType == 0x0f && nameLen >= 1 && nameLen <= 15)
                score += 4;
            else
                return 0;

            // Volume name should be mostly printable Apple II / ProDOS filename chars.
            var printable = 0;
            for (var i = 0; i < nameLen; i++)
            {
                var c = byteAtProDOSBlock(2, 5 + i, raw2file);
                if ((c >= 0x41 && c <= 0x5a) || // A-Z
                    (c >= 0x30 && c <= 0x39) || // 0-9
                    c == 0x2e)                 // .
                    printable++;
            }

            if (printable == nameLen)
                score += 2;

            // Directory header values commonly found in ProDOS volume directory.
            var entryLength = byteAtProDOSBlock(2, 0x23, raw2file);
            var entriesPerBlock = byteAtProDOSBlock(2, 0x24, raw2file);

            if (entryLength >= 0x27 && entryLength <= 0x40)
                score += 1;

            if (entriesPerBlock >= 10 && entriesPerBlock <= 13)
                score += 1;

            return score;
        }

        if (isWoz())
            return { type:"woz", confidence:1.0, reason:"WOZ magic header" };

        if (looksLikeNib())
            return { type:"nib", confidence:0.95, reason:"NIB size and sector prologues" };

        if (imageBytes.length == DSK_SIZE)
        {
            var dskScore = scoreDOS33(raw2dos) + scoreProDOS(raw2dos);
            var poScore  = scoreDOS33(raw2prodos) + scoreProDOS(raw2prodos);

            if (poScore >= dskScore + 3)
                return { type:"po", confidence:0.85, reason:"ProDOS-order structures score higher", dskScore:dskScore, poScore:poScore };

            if (dskScore >= poScore + 3)
                return { type:"dsk", confidence:0.85, reason:"DOS-order structures score higher", dskScore:dskScore, poScore:poScore };

            // 140 KB flat images have no magic header, so this can happen.
            return { type:"dsk", confidence:0.50, ambiguous:true, reason:"140 KB flat image; sector order not proven", dskScore:dskScore, poScore:poScore };
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
   {src:"UklGRtYbAABXQVZFZm10IBAAAAADAAEAIlYAAIhYAQAEACAAZmFjdAQAAAC4BgAAUEVBSxAAAAABAAAAxQPRZQCsEz9ZAwAAZGF0YeAaAAAAAKS6AADMOgAAALsAADA7AADruwDAzrwAwK68AICMvACAETwAAG88AECLPAAAOzwAgNE8AMBcPQBwmD0AEL09AOCwPQCAQj0AAMw7AKAGvQCAf70AoAu9AAB4OwBAWD0AkLI9APC0PQAApT0AID09AECYPAAAfzwAgDk8AMDgPAAADz0AAOM8AECPPAAAHrsAAHe8AICDvAAAHrsAACM8AMCiPABAvjwAgLc8AEC3PAAA0DwAwMw8AADkPAAA8DwAANU8AED0PADA4TwAwOw8AEDWPACAkzwAAHk8AAAYPACAEjwAAFs8AMCZPAAAvzwAwMk8AMDBPABAqzwAQJU8AIB1PAAAcTwAQIQ8AACXPADApjwAAKI8AMCcPACAhzwAgIM8AICJPAAAlTwAwL08AADyPACAAz0AoAE9AIAEPQCA8DwAQOk8AMD3PABA4zwAgMg8AECzPABAtDwAQKg8AACfPACAXzwAQIc8AMCoPADArDwAAL88AEDcPAAAzjwAAMU8AECfPABAkzwAAKo8AECcPAAAuzwAwOI8AEDDPADAmjwAAKM8AIDAPADAtDwAAI88AEDLPACAUTwAgIA8AAB/PAAAvjwAQII8AICWPAAAIjwAAAe9AEDRvQAAx70AQKu9AMA5vgAwdb4AUIm+AOBzvgBIQ74AICK+AAAZvgBA770AgNe9AOCMvQBgCD0AoI09AGAdPQAABLsAoAA9AFCUPQCA4T0AEBk+ACC2PQAg8z0AODA+AGSDPgBwZz4A7Iw+AACMPgDA5zwAAIA9ABDEPQBgMj4AWGI+AKBjPgDQGz4AsOo9AEAdPQAABbwAgIk9ABCwPQAAojwAUMO9AMBvvQBgAr4A6Bm+ANCuvQBQ9b0A4DC+ALBwvgDIlr4ACGy+AFhtvgAEkL4ABIC+AKg/vgAoTL4AkB2+AMhAvgCAPr4AABu+AODCvQBAwrwAAAq7ABCbPQDQuz0AMBM+AGDSPQDgBT4AkDM+AAhePgDQOz4AMHY+ACiOPgBoSj4ACEU+AGyoPgDMtT4AzLA+AOSVPgAINj4A8Bg+AAD1PQCAZT0AgL28ACDHPQBgND0AgCE8AMCHvQBwl70AgI69AOBnvQAwnr0AkKS9AAC2PADgL70AULu9AMDXvQCArb0AmC++AGAGvgAwm70AQPq9AMB2vQCAtr0AuEe+ABDuvQCAO7wAwPo8AMC2PQAQgD0AICk9ALCWPQDAtT0AeCo+AEAvPgDgeT4ArJo+AOhqPgAAfj4AeFQ+APgHPgAQ9T0AMCw+AGC/PQAAtD0AgOs8AMAOvQCAkbwAINm9ADD6vQDArr0AQLy9ALg7vgBgDD0AoCC9AJASvgCQyb0AcF2+AFA2vgCwCb4AIL+9AMDEPACAGzwAkJW9ACA2vQBYE74AkIu9AGA/PQAAMD0AALO7AGB8PQAAp7wAABI9AACIOgCgdz0AuBg+AKDZPQDAXz4AcOw9AFBAPgC4Zj4AQEM+AOBzPQCoHD4AECg+ANhOPgBYOj4AYGI9AICYPADQlb0AAMc7AICYvAAAqrsAoFY9AED1vQBQer4AQDS+AEALvgAAy70AoNG9AHDOvQAQrb0AMI29AOghvgCIA74AUOe9ANAovgDg6r0AMJi9AKD/PQCgDD4AYBa9AADPPAAA2j0AwDw9ALDEPQCQ3j0A4Jg9AFg9PgAg7z0AaBY+AHiIPgAAQz4AqAA+AGhpPgDwXj4AcCA+AGA9PgBIBD4AQCk+AADWPQCQ9z0A+C0+AECIPAAgcb0AAFa8AKBDvQAQ670A0MW9AKDHvQAIeb4AiJG+AMBsvQDQQL4AoHa+ABDuvQBYSr4A2HK+AMDhvQBQhL0AAPO8AIDAPACgDL4A8LO9AGBFPQAAHj0A8Nm9APDMPQBAmD0A4CG9AKBXPQDkhD4AmGo+APA+PgD0gj4AUEU+ALyEPgA4Sz4AIJE+AAiYPgCQjj4AkOs9AMCxPQCoQT4A3Ik+AGDmPQDgDj4A8PE9AGBEvQAAqrwAgFM8APCTvQAAn70AgFE9AJCjvQAQ1r0AwLG8ABDivQAIB74A0Aa+AOCNvgDoW74A6Hi+ALSEvgDgZr4ACHu+AFysvgAogL4AQFW+AKDnvQAAHj0AQN28AECPvABg9z0AQLw9AJDRPQDoOD4AEL49ABDIPQBA+z0AMKM9AHCnPQCYaz4AILg9AMDsPQDwVj4AOCM+AAhWPgB0iz4AYNs9AAAjPQDgET4AoDs9AND7PQBQFD4AAH89AAA8vADA0bwAgFI8AAA5PAAAyTsAYBY9AOAwvQDYY74AAPm9AACDvQCIFb4AiAC+AGgCvgBADb4AEJ69AACYvAAAvrsAoIU9AAC0uwD4A74AAEe9AHCnPQAQlj0AoEA9AMDMPACAYj0AIHU9AMDdPQDElD4AiF4+ALCcPQBArj0AYOA9ABAHPgCYNz4A6Aw+AEDwPAAQib0AQIQ8AKCNPQCAbjwAgJ28ANDgvQBoDb4AAJG8AABcPACAmLwA4Jo9AAAkvQCoFr4AEP+9ALAXvgBoGb4AwPy8AAAIvQDgjb0AANo8AADMugDw1b0AIIO9AHgHvgBAWL0AUOU9AMDWPACALD0AAIw6AID/vAAAwrsA8Kg9AFgHPgDgfz4AAH4+AJhjPgCAdD4AoEs+AIhzPgAEhD4ANIM+AJyKPgAYiz4AcP09AGBcvQAAZL0AEI29AEBYvgDwgb0AAD+9AKgovgDYPb4AuCC+AMhgvgAwT74AKDG+AAAwvgBQNb4AiC++AChBvgAwlr4AID++AMBYvgD4Mr4AcOC9AGA6vQAQ370AIAm+ABCDvQAQy70AwIq8AHDsPQCAzz0AGBw+APyEPgCIPj4AwCQ+AHhmPgBoRD4AuGY+ALSVPgBgvT4AdKo+AJhdPgCAhT4ASCI+AODJPQCgIz4AuC4+AMCiPQAIUT4AoBM9AMALPQBIHT4AAFu9AMAkvgCARb4A+Cy+ADgtvgDQo70AuAq+AOAsvgDYjr4ArJu+ADBuvgCYdr4AHI2+APAGvgDAgr0AqI6+AByIvgBA670AqD6+ALBrvgAgrL0AABA8AABIPAAAwD0AiGk+AMhRPgBgcT4A9KA+ANC2PgBAvz4A2L0+ABitPgA8sT4AHJk+AFiAPgAYiz4A8JA+ADS+PgA4oz4A9Ig+ADSLPgBQID4AwJM9AMC5PQAAoDsAqBS+ACBWvgBEkL4AxIi+ANS1vgDgo74ArIu+AAjEvgC4xL4Afg6/AKABvwBs3r4A3Mq+AMCmvgCIp74A2HO+AKhQvgBA5b0AMMW9AAD7vAAA/jsAACi8ALCTPQAoED4AeGU+ADStPgBcrz4A6I4+ACzGPgD4xj4AcJ0+ABz7PgB0sz4AgMg+AHoDPwCcvT4AHOc+APSzPgCglz4A0IU+ALALPgBgVz4AVLU+ALgYPgCILD4AuFc+AJCPvQAA2TwAAOk7ADgavgDQF74AFLy+AOi4vgDgmL4A6Ne+AJTHvgDA274AYNi+AHTVvgCk/b4AtNu+AAiuvgCAxr4AHJC+AAC9vQDAMr4A0N+9AGAivQCgmL0AwKG8AEC6PABoJz4AIFo+AEBxPgBAkD0AiDk+AAykPgAgiD4ACMU+ANztPgAwoT4AQJQ+AESxPgBgXT4ALKE+AByaPgAYej4AKF0+APhcPgCgEj0AgJ08AIBiPQDw970ACA6+AIAFvQBw1L0AFIK+AIyuvgB07r4AIMi+AASbvgDYib4A/IO+AJCVvgAcnb4ASGu+ALBgvgCoL74AEJm9AODlPQAAgzwAwO28AFDTPQBgDD0AaBQ+AFCMPgCQMD4AKDk+AMCiPgAQgT4A0Gc+ALCtPgBwrD4AyJg+ANStPgDocT4AwJo+AOCvPgA4tT4AtJA+ABCEPgCUoz4A4NA9AIDVvACASD0AoG69ABArvgCYBr4A4Lm9AEhTvgDwyb4A2JW+AFhavgDgrr4AALC+AKhTvgBYzb4AUIC+APhMvgBUkb4AmCm+APhAvgCso74AOKC+AEANvgCQ670AwFu9AIAjPACAkDwAAPm8ALDOPQDYez4AUFQ+ALC5PQB4iz4ASJs+AEyvPgBE/j4AiNA+AMzMPgB4zj4AzJ8+AJBiPgBkjj4AEI4+ANghPgAAiDwA4L69AACUvQAw8b0AsBi+AOgVvgC4Kb4AAEK+AGCavgDQer4AwLG+AEiqvgAgxb0AyFS+ALCDvgAoWr4AMHi+AHBLvgDoXL4AYDa+ANCLvQAAAjsA8Au+ACAPvQBgNL0AAHu9AKB+PgDg7D0AgG4+ANiZPgCgcT0AqJA+ADCdPgDwOT4AzPs+APjjPgC8xT4ACMM+ABhkPgCE0D4AmOM+AKCCPgAEiT4AKBk+AMDOPACgAD4AcLq9ANCLvQCACLwATIu+ACA6vgDgYr4AmMe+ABBqvgAQsL4AIMC+ALyBvgA4zr4AzIe+AIBavgBA9L4AcJ2+ABg7vgB0j74AAJw6AAB4vABAxbwAgJk9AIDmvQCgWL0AAFS8AABIvQAQKT4ACCc+AIAmPgAkmT4AEBY+AEhTPgBstz4AqMQ+ABj2PgCsEz8AQOU+AKSRPgA4Ij4AICk+AMyKPgAwZj4AEEA+AAAjPgCQrj0AwN+8AACrOwCgub0AgPy9AEAdvgBocr4ANIe+APjBvgC4s74AAI2+AJCjvgCEmL4AmFC+ADylvgBIXr4AiE2+ABiDvgAg9r0AgBS+ABCqvQCAtrwAMP29ACA/vQAA4jwAEIm9AADXPQAoET4AkAA+AOhhPgBAGD4AKDY+AGSnPgAgbT4AQMM9AJgrPgBoFj4AcEk+AABePgCQKD4AiF4+AFguPgC4Dj4AEA8+AIAGvACANDwA0KQ9AICYvAAgJz0AgAo8AFCuvQCgKb0AqB6+ADhEvgBgVr0AQOG9AMAGvgBQv70AAEe+ADhuvgAwlr4AQFe+ACCPvQCQ/L0AIFq9AEAhvQBgur0AwIo9ABDrPQBAdD4ABJk+APBTPgAUlj4A4HI+AMAmPgA0gz4AcGk+ACDbPQBA6T0A4Io9AFAHPgAgzD0AgHC8AGCFPQDwqj0AiAQ+AJC3PQAAwz0AYEk9AGA/vQAgIz0AcDI+AHCcPQCgZb0AMN+9AMDrvQDQr70AiF2+AABdvAAAeTwA2Gi+AEhovgA8gr4A6G++ANDivQDwT74AQM+9AHCOvQAgqr4AIOy9ABCbvQAAjjwA6Dc+ABCEPQCAbT4AgG4+AOgGPgBAaj4AOG4+ACAdPgBIQj4ABJM+AHyBPgBQqz0AMPk9ALAdPgAAhrsAAGi6AKBsvQCAPL0AgHK8ACgSvgCQrr0AAPu8AFCrvQDAfb0AALC9ACCivQDA/TwA4D69AMAmvQCwgr0AgD+9AMCEPQCwAL4A4LO9AIDIvAAAV7wAAL67APggvgAgGL4AgEc8AABGvAAAIrsAIKE9ABC6vQCQyL0AYAg9ACCvPQBYDj4AYN49AECuPQAgEz4AkKU9AChOPgCgQz4AYB09APDIPQCAhT0AUJk9AMhOPgCoJj4AgIu8AAAIOgBAVb0AKIq+AOAzvgAgaL0AmCS+ALDdvQDw9b0A8Cq+APA7vgAQRr4AALq7AIBbPQAgHj0AoMY9AIAAPQCAaL0AwIC8AGBivQCAKL0A8LI9AKDhPQAQpz0AUJo9AJCbPQCAabwAULs9AEguPgCwTD4A8JE+ALBePgCwGD4AAHi6AMCMvQBAjDwAAEa8AABSPQDg7T0AcN09AChQPgBAUD4AwNo9AKAUPgAA0D0AQIc8ADAGPgDgPj0A4Ac9ALCcvQDYTb4AiDe+AFBJvgCAML4AqAK+AFBLvgDwOL4AqA2+AHCPvgCQWL4AKDa+AIAFvgCAgLwAYK89AAAyPQBASD0AWAs+AMgNPgBgOT4AbJM+ANCPPgBwWj4ASGc+ACAmPgCw3D0AcNs9ACAGPQCAaTwAoGg9AKAjPQDAXD0AULA9AOBrPQAA2TsAgOA8AIARPAAA4DwAwI48AGCUvQAAkb0AcKW9AHgnvgDIC74AcHu+AOBuvgAAD74AwDW+AOg7vgCAZL4AoKC+AAiQvgDIbb4AIH6+AAATvgBA2b0AEIy9ACA3vQDAkb0AwIC9ANCLPQDYCT4AfII+AJCVPgDYRz4A2A4+AHAEPgAAdD0A4A0+AFApPgCgPD4AKKA+AHCrPgBktz4A6HU+AICCPgBIhz4AwFo+AJAzPgAslD4AQD0+AIBKPQBABT0AgHS9AMDvvAAABL0A8I29AMCwvQBw2b0AyAq+AJAQvgAYO74AwPW9AOCZvQAwA74AUCC+ADhKvgBshr4ADIK+AKCLvgCohL4AMDm+AHAHvgDwtL0AsM69AGDKvQAAb70AAF47AOAvPQCAvj0A8F0+AMg+PgCA+D0AUCI+ANgyPgAoYT4AJIc+AOCbPgBMmD4AGIg+AAD/PQB4ED4A4A0+AFC6PQAQ4z0A8IA9AHADPgAgCz0A4Hu9ACAFvgAYDb4AUBS+AHDuvQCww70AED2+ALg8vgDoAL4AUMq9AEBSvQAAVr0AoEC9AMCdvACwEL4AGBy+AKCTvQDgR70AAKC7AABMPQBgJL0AYAK9AOAMvQCQkb0AwNE8ALAIPgDwnj0AAPw8AKgQPgA4Pz4AkBQ+ANhJPgDQYz4AYNo9AKANPgCwMz4AwPA9AKDIPQAAcD0AYBA9ADClPQAApDoAQMq8AAAePQDgXL0AgBu+AGBCvQAAM70AQDC9AOCMPQBAcL0A2AG+AJC9vQCQcL4AKEe+ABgzvgAgZb4AsPa9AKgEvgAYNr4A0Bi+AAC+vQDgx70AMKm9ALCxvQCAIb0AsOG9AAAGvgDAjLwAAFC8AAAYOgBw1T0AAHI9AJCMPQAgCD4AgM49AHBqPgCADT4A8Ao+ADBDPgDw5D0A8Nk9ALAAPgCgxz0AQDE9ACA8PQDAm7wAgIG9AMDSPACAyD0A8I49AADfPACAKz4AwMA9AIB5vAAoEj4A8Nw9AOB4PQBgfj0AQC09AIA2vAAAgLgAAC47AEBYvQCAhLwAoCe9AJApvgAwIb4AKHG+AOgXvgAARj0AIAc9ADChPQCACj0AgHA8AMBAPQCQpr0AABi9AMDcPQCAlj0AoKg9AACavADABL4AgEi9AEB3vQDANb0AQN88AHCAvQAAgrwAYCu9AKAEvQCgCT4AUJo9AOBRPQAgAj4A0Iu9AFC/vQAQ7j0AQH09AAAgvQDgZb0AgJ28AAB+uwAAijsAYKw9AAgUPgDgSD0AoGc9AAC3vABwob0AQH89AKAXvQAAE74AcIO9AEApvQDA7r0A0Je9AJDfvQCAML4AoJW9AJCpvQDgaL0AALO9AAAovQAAKDoAOBC+AADPvQDAkjwAwJQ8AIC1vAAAP7wA4EG+AKCrvQDwzz0AQBe9AIAEPAB8hD4AmDQ+ANC5PQA4jT4AQM08AACAvQAQ5j0A0Ms9AEC5PQDYBz4AiEI+AGD1PQAAWDwAAJm7ACB7PgD4GT4AgAA+ADCAPgCA4TwAACs+ALgLPgCAATwAQIe8AICRPQAA/7wAQNS9AABBPQBQRL4AAFm+ANAtvgAskb4AAEq+AEDGvAAAUr4A8Ii+AEAbvgAAWr4A8Nm9AMCSvQAAgD0AQOQ9AMBMPQDA1DwAAEo9AEAYPQDAYL0AAIE9AOAzPQCAqz0A2EY+AFBkPgCA9jwA4A49AHCmPQBgp70AAOU8AOAGPgDQrD0AEAw+AIANPgBgvb0AABu8AIAjPQAAcDwArIQ+ALDHPQAQxL0AILw9APgkvgBQfr4AwJ08AAB4vACAob0AMOK9ANAWvgDIXr4AeDy+AMgCvgBwM74AIDe+APAPvgAggr0AANC8ACB3vQCANrwAAFo7AAD/vABAET0AAAk+AJC0PQDQvT0AEEs+AFDXPQD4Cj4AXJM+AKhvPgCQDT4A4JE9ACACPQBAUD0AgBY+AKgLPgCgmj0AAAc8AIBNvQDAED0AgJA8ALCovQDAgzwAoA69ABBkvgDgVb0AQAa9ABgUvgAQZ74AKHu+AGgjvgBwEr4A+ES+AOgJvgC4Eb4APIi+AMCjvQAAvLwAYIK9AMC5PADAyjwA8BC+AKCpvQAAsDoAwC+9AIDsPQBYFT4AsAE+AAgNPgAQCT4AkLk9AOgVPgBYbj4AgGY+ABycPgCYlT4ANIk+AJB5PgBIXj4A8OM9AFAgPgC4LT4AANA6AEB+PQCAETwAQMC9AAC3vAAA0TsAOBm+AIg4vgAAYb4AgDS+ABACvgAIZb4A0Kq9AHgYvgCcs74A0K69AMBuPQDAtL0AACE8AIAvPABgY70AoP+9ACDtvQBAkjwAgE08AIDcPACQrT0AwAw9AGAdPQBQWz4AQEo+AKBXPgAIQT4AeDA+AKBiPgDgVz4AEKY+ALBfPgC4bz4AGHQ+AGAmPgCYID4A4N89AEDiPADABb0AIIq9APA1vgAQrL0AQNy9AFAWvgCYDb4AQJO+ANSZvgCcjL4AZJK+AMBnvgDQKL4AsP+9ABCmvQCAPb0A4Dq9AEDCvQCQcb4AOCm+AAB7vABwo70AcKu9AICCvQDgi70AMKC9ACAVPQBAhT0AQPs8AJAQPgDA5T0AICw9AOh+PgAcqT4AOGE+AAi9PgBkqT4A+DA+AKyAPgBspz4ASGo+AKhsPgAgPD4A8L09ACBiPQDAhTwA4HU9AOAdPQAAgzsAOA++AAhbvgA4A74AsKK9ALBBvgDgHr4AwBK+AKB1vgDwZr4AWCC+AHhHvgBIkr4AQGW+ABDJvQBgOb4ASCS+AIA9PQDIHb4AWFi+AGA+vQDADj0AgG89AADoPQBASz0AQLC8AMCNPQBYUT4AsMY9APggPgCgqT4AAMw9AKApPQB4ej4A9Ic+ANC0PQDgUj4A2A4+AECrPQAglj0AcIs9AOBwPQDA2zwAgEY9ABDHvQBAbj0AEKA9AMC/vABguT0AgK08AHDKvQCwpb0AAPA5AODJPQAA6rwAMC6+AKAlvgDwq70AcNG9AIABvAAAFT0A4EG9AEDcPAAAXjwAgK+8ACBHPQCgzD0AoAU+AODxPQBAMD0AgAQ9AECkvAAALrsAgDe8AACwPABANj0AYBY9AECDPADAPL0AANQ6AACNOwAAwLsAQOO8AICNvAAAsLkAAF68AIBlvAAAwLsAAE67TElTVEoAAABJTkZPSU5BTQgAAABTcGludXAAAElQUkQSAAAAQXBwbGVJSSBFbXVsYXRvcgAASUFSVBQAAABGcmVkZHkgVmFuZHJpZXNzY2hlAGlkMyBUAAAASUQzAwAAAAAASlRJVDIAAAAHAAAAU3BpbnVwVEFMQgAAABEAAABBcHBsZUlJIEVtdWxhdG9yVFBFMQAAABQAAABGcmVkZHkgVmFuZHJpZXNzY2hl"}
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
+"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"

        },

        "disks/BLANK_DOS.DSK":
        {
            encoding:"zlib-base64",
            data:"eNr..."
        },

        "disks/BLANK_PRONTODOS.dsk":
        {
            encoding:"zlib-base64",
            data:"eNr..."
        },

        "disks/ProDOS 8.dsk":
        {
            encoding:"zlib-base64",
            data:"eNr..."
        }
    };

    this.GitHubDirCache = {};

    this.getSoftwareCatRows = function(arg)
    {
        function GH_listDir(arg, callback)
        {
            // owner, repo, path, ref
            arg.ref = arg.ref || "main";
            arg.path = arg.path || "";
            var url = "https://api.github.com/repos/" + arg.owner + "/" + arg.repo + "/contents/" + arg.path + "?ref=" + encodeURIComponent(arg.ref);

            if(apple2plus.DiskObj().GitHubDirCache[url]===undefined)
            {
                // READ GITHUB REPO
                oCOM.GetHTTP(url, "text", function()
                {
                    if(this.status != 200)
                    {
                        callback({
                            status: this.status,
                            message: this.responseText || this.response
                        });
                        return;
                    }

                    var json = JSON.parse(this.responseText || this.response);

                    var list = json.map(function(e)
                    {
                        return {
                            name: e.name,
                            path: e.path,
                            type: e.type,              // "file" or "dir"
                            size: e.size,
                            download_url: e.download_url,
                            html_url: e.html_url
                        };
                    });

                    // add response to cache
                    apple2plus.DiskObj().GitHubDirCache[url] = {"list":list,"arg":arg};
                    callback(null, list, arg);
                });
            }
            else
            {
                // use cached responses
                var cache = apple2plus.DiskObj().GitHubDirCache[url]
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

            oCOM.GetHTTP(full_path, "arraybuffer",
                function()
                {
                    try
                    {
                        if(this.status && this.status != 200)
                        {
                            console.warn(
                                "ERROR LOADING DISK: HTTP "
                                + this.status + " " + full_path
                            );
                            return;
                        }

                        var arraybuffer = this.response;
                        var ui8 = new Uint8Array(arraybuffer);

                        if(arraybuffer.byteLength < 100)
                        {
                            var enc = new TextDecoder("utf-8");
                            console.warn("ERROR LOADING DISK: " + enc.decode(ui8));
                            return;
                        }

                        var bytes = Array.from(ui8);

                        // .dsk/.do/.po are 143360-byte logical disk images.
                        // Convert to Disk II nibble stream before mounting.
                        if(bytes.length == 143360)
                            bytes = disk2.convertDsk2Nib(bytes);

                        // .nib images should already be 232960 bytes.
                        if(bytes.length != 232960)
                        {
                            console.warn(
                                "ERROR LOADING DISK: unsupported image size "
                                + bytes.length
                                + " bytes for " + arg.path
                            );
                            return;
                        }

                        apple2plus.loadDisk(bytes, drv);

                        var fileName = arg.name || (arg.path || "").split("/").pop() || "disk image";
                        disk2.setDriveCatalogFile(drv, fileName);

                        if(typeof highlight_appbut == "function")
                        {
                            var file_id = "file_" + arg.path
                                .replace(/[^A-Za-z0-9_\-]/g, "_");

                            var el = document.getElementById(file_id);
                            if(el) highlight_appbut(el, true);
                        }

                        console.log(
                            "Loaded disk "
                            + arg.path
                            + " into " + drv
                            + " (" + bytes.length + " bytes)"
                        );
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

