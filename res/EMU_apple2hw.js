//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2hw.js   (Apple II Hardware)

// HARDWARE IS ACCESSING:
// 1) RAM & VIDEO RAM
// 2) I/O (--> relative address starting from $C000)
// 3) ROM (--> relative address starting from $D000)

// Reserved read result: the addressed device does not drive any data bits.
// Ordinary callbacks still return bytes; partial drivers return {value,mask}.
Apple2Hw.FLOATING_BUS = -1;

function Apple2Hw(vid,keys)
{
    var hw = this;

    const bDebug_mon = false;      // debug RAM Write monitor
    this.bClear_mon  = true;        // clear the grid after each display cycle
    
    this.lineDecode = function(addr) {return addr >> 12; };

    this.RD = [];
    this.WR = [];
    this.bRO = false;                   // Read-Only flag across the entire hardware (allowing safe read operations)
    this.default_map = null;
    this.FLOATING_BUS = Apple2Hw.FLOATING_BUS;

    var video = vid;                        
    this.io = new Apple2IO(video,hw);   // HARDWARE OBJECT OWNS IO (always call 'io' methods via hardware)
    this.children   = {}                // TODO: deprecate ?

    var RAM_SIZE =  0xc000,
    LORES_ADDR =    0x0400,
    LORES_SIZE =    0x0800, // both pages
    HIRES_ADDR =    0x2000,
    HIRES_SIZE =    0x4000, // both pages
    IO_ADDR =       0xc000,
    IO_SIZE =       0x0800,
    ROM_ADDR =      0xd000,
    ROM_SIZE =      0x4000;

    /////////////////////////////////////////////////////////////////
    var ram = new Uint8Array(RAM_SIZE);      // HARDWARE RAM SPACE //
    /////////////////////////////////////////////////////////////////

    /*
     * NTSC Apple II/II+ video scanner, independent of canvas redraws.
     * The field origin is the start of horizontal blanking on line zero.
     * hcycle 0..24 is HBL; 25..64 fetches columns 0..39. Video RAM is
     * fetched in the phase preceding the CPU access, including during blanking.
     */
    const VIDEO_LINE_CYCLES = 65;
    const VIDEO_FRAME_CYCLES = 65*262;
    var cpuTicks = 0;
    var videoTicks = 0;
    var videoClockScale = 1;
    var scaleCpuEpoch = 0;
    var scaleVideoEpoch = 0;
    var busMonitoring = false;
    var lastBusAccess = null;
    var rasterCapture = null;
    var videoMode = {
         "gfx":!!(video.state && video.state.gfx)
        ,"mix":!!(video.state && video.state.mix)
        ,"page2":!!(video.state && video.state.page2)
        ,"hires":!!(video.state && video.state.hires)
    };

    this.setVideoMode = function(name,flag)
    {
        var setters = {"gfx":"setGfx","mix":"setMix","page2":"setPage2","hires":"setHires"};
        var setter = setters[name];
        if(!setter) return;
        videoMode[name] = !!flag;
        if(typeof(video[setter])==="function") video[setter](!!flag);
    };

    this.getVideoMode = function() { return Object.assign({},videoMode); };

    this.getCpuTicks = function() { return cpuTicks; };
    this.getVideoTicks = function() { return videoTicks; };

    this.setVideoClockScale = function(scale)
    {
        scale = Number(scale);
        scale = Number.isFinite(scale) && scale>0 ? scale : 1;
        if(scale!==videoClockScale)
        {
            scaleCpuEpoch = cpuTicks;
            scaleVideoEpoch = videoTicks;
            videoClockScale = scale;
        }
        return videoClockScale;
    };

    // Called once per completed CPU tick by Apple2IO, never by the renderer.
    this.tick = function()
    {
        cpuTicks++;
        // Multiplication from an epoch avoids accumulating fractional rounding
        // errors across ticks/batches (six ticks at 1/3 must be exactly two).
        videoTicks = scaleVideoEpoch+(cpuTicks-scaleCpuEpoch)*videoClockScale;
        if(rasterCapture) rasterCapture.advanceTo(videoTicks,false);
    };

    function effectiveVideoTick(cycleOffset)
    {
        return scaleVideoEpoch+(cpuTicks-scaleCpuEpoch+(Number(cycleOffset) || 0))*videoClockScale;
    }

    this.getVideoPosition = function(cycleOffset)
    {
        var tick = effectiveVideoTick(cycleOffset);
        return videoPositionAt(tick);
    };

    function videoPositionAt(tick)
    {
        var phase = ((Math.floor(tick)%VIDEO_FRAME_CYCLES)+VIDEO_FRAME_CYCLES)%VIDEO_FRAME_CYCLES;
        var line = Math.floor(phase/VIDEO_LINE_CYCLES);
        var hcycle = phase%VIDEO_LINE_CYCLES;
        var hblank = hcycle<25;
        var vblank = line>=192;
        return {
             "videoTick":tick,"frameCycle":phase,"line":line,"hcycle":hcycle
            ,"hblank":hblank,"vblank":vblank
            ,"byteColumn":hblank ? -1 : hcycle-25
            ,"x":hblank || vblank ? -1 : (hcycle-25)*7
            ,"y":vblank ? -1 : line
        };
    }

    this.getScannerState = function(cycleOffset)
    {
        var state = this.getVideoPosition(cycleOffset);
        return scannerStateAt(state);
    };

    function scannerStateAt(state)
    {
        var hClock = (state.hcycle+40)%65;
        state.hState = (0x18+hClock-(hClock>=41 ? 1 : 0)) & 0x3F;
        // The NTSC V counter presets after line 255, giving $FA..$FF.
        state.vState = (0x100+state.line-(state.line>=256 ? 262 : 0)) & 0x1FF;
        return state;
    }

    function scannerAddress(state)
    {
        var h = state.hState;
        var v = state.vState;
        // Motherboard latches belong to the bus; the renderer mirrors them.
        var mode = videoMode;
        var hires = !!mode.gfx && !!mode.hires;
        if(mode.mix && (v & 0xA0)===0xA0) hires = false;

        // The address adder wires V3/V4 to weights 5/10; carry is discarded.
        // A0..A2 = H0..H2; A3..A6 = the four-bit sum; A7..A9 = V0..V2.
        var rowGroup = (v>>6)&3;
        var low = (h&7) | (((13+(h>>3)+rowGroup*5)&15)<<3);
        var row = (v&0x38)<<4;
        if(hires)
            return (mode.page2 ? 0x4000 : 0x2000) | ((v&7)<<10) | row | low;

        // On II/II+ the text scanner also selects A12 during HBL (not //e).
        return (mode.page2 ? 0x0800 : 0x0400) | row | low | (state.hblank ? 0x1000 : 0);
    }

    this.getScannerAddress = function(cycleOffset)
    {
        return scannerAddress(this.getScannerState(cycleOffset));
    };

    this.peekFloatingBus = function(cycleOffset)
    {
        // Physical motherboard RAM, not the CPU RD map or a slot-card overlay.
        return ram[this.getScannerAddress(cycleOffset)];
    };
    this.getFloatingBus = this.peekFloatingBus;

    this.setVideoRasterCapture = function(enabled)
    {
        rasterCapture=null;
        if(enabled)
            rasterCapture=new Apple2RasterCapture(function(tick,line,col)
            {
                // Visible-row permutation only: the capture excludes blanking.
                // Avoid allocating scanner/state objects in the per-fetch path.
                var graphics=videoMode.gfx && !(videoMode.mix && line>=160);
                var hires=graphics && videoMode.hires;
                var row=((line&0x38)<<4)+Math.floor(line/64)*40+col;
                var address=hires ? (videoMode.page2?0x4000:0x2000)+(line&7)*1024+row
                    : (videoMode.page2?0x800:0x400)+row;
                return ram[address] | ((graphics ? (hires?2:1) : 0)<<8);
            },function(frame){video.completeRasterFrame(frame);},videoTicks);
        return !!rasterCapture;
    };
    this.getVideoRasterStats=function(){return rasterCapture ? rasterCapture.stats() : null;};
    function captureBeforeAccess(offset)
    {
        if(rasterCapture && !hw.bRO) rasterCapture.advanceTo(effectiveVideoTick(offset));
    }

    this.setBusMonitoring = function(enabled)
    {
        busMonitoring = !!enabled;
        lastBusAccess = null;
        return busMonitoring;
    };

    this.getLastBusAccess = function()
    {
        return lastBusAccess ? Object.assign({},lastBusAccess) : null;
    };

    function noteBusAccess(addr,rw,offset,result,mask,state,scanAddr,floating)
    {
        if(!busMonitoring || hw.bRO) return;
        state = state || hw.getScannerState(offset);
        scanAddr = scanAddr===undefined ? scannerAddress(state) : scanAddr;
        lastBusAccess = {
             "cpuTick":cpuTicks,"effectiveCpuTick":cpuTicks+offset
            ,"effectiveTick":state.videoTick,"cycleOffset":offset
            ,"address":addr,"rw":rw,"line":state.line,"hcycle":state.hcycle
            ,"frameCycle":state.frameCycle,"hState":state.hState,"vState":state.vState
            ,"scannerAddress":scanAddr
            ,"floatingValue":floating===undefined ? ram[scanAddr] : floating
            ,"mask":mask,"driven":mask!==0,"result":result
        };
    }

    function resolveBusRead(addr,data,offset,state,scanAddr,floating)
    {
        offset = Number(offset) || 0;
        var mask = data===hw.FLOATING_BUS ? 0
            : data && typeof(data)==="object" ? data.mask & 0xFF : 0xFF;
        var value = data && typeof(data)==="object" ? data.value : data;
        if(mask!==0xFF && floating===undefined)
        {
            state = hw.getScannerState(offset);
            scanAddr = scannerAddress(state);
            floating = ram[scanAddr];
        }
        var result = ((value & mask) | ((floating || 0) & (mask^0xFF))) & 0xFF;
        noteBusAccess(addr,"R",offset,result,mask,state,scanAddr,floating);
        return result;
    }

    this.readIO = function(addr,cycleOffset)
    {
        captureBeforeAccess(cycleOffset);
        // Capture BEFORE dispatch: this cycle's video fetch precedes any
        // mode-changing CPU soft switch accessed during the CPU phase.
        var state = this.getScannerState(cycleOffset);
        var scanAddr = scannerAddress(state);
        var floating = ram[scanAddr];
        var data = this.io.read(addr-IO_ADDR,cycleOffset);
        return resolveBusRead(addr,data,cycleOffset,state,scanAddr,floating);
    };

    this.read = function(addr,cycleOffset)
    {
        captureBeforeAccess(cycleOffset);
        addr &= 0xFFFF;
        var line = this.lineDecode(addr);
        var fn = this.RD[line];
        var data = fn(addr,cycleOffset);
        // The default I/O callback already resolves and records the bus read;
        // mapped RAM/ROM/card callbacks retain their existing byte interface.
        if(line===0xC && this.default_map && fn===this.default_map.RD[line]) return data;
        return resolveBusRead(addr,data,cycleOffset);
    };

    this.write = function(addr,d8,cycleOffset)
    {
        captureBeforeAccess(cycleOffset);
        addr &= 0xFFFF;
        d8 &= 0xFF;
        var offset = Number(cycleOffset) || 0;
        // Snapshot preceding the write, for the same phase reason as readIO.
        noteBusAccess(addr,"W",offset,d8,0xFF);
        return this.WR[this.lineDecode(addr)](addr,d8,offset);
    };

    /*
     * Shared Apple II IRQ line.
     *
     * IRQ-capable peripherals drive a common active-low line in real hardware.
     * Keep named logical sources here so one device cannot accidentally clear
     * another device's still-active request.  Cpu6502 already treats any
     * non-zero irq_signal as asserted.
     */
    this.irq_signal = 0;
    this.irq_sources = Object.create(null);

    this.setIRQSource = function(source,active)
    {
        source = String(source || "unknown");

        if(active)
            this.irq_sources[source] = true;
        else
            delete this.irq_sources[source];

        this.irq_signal = Object.keys(this.irq_sources).length ? 1 : 0;
        return this.irq_signal;
    };

    this.clearIRQSources = function()
    {
        this.irq_sources = Object.create(null);
        this.irq_signal = 0;
    };

    this.nmi_signal = 0;

    this.mem_mon = {};
    this.mem_mon_trigger = {};
    this.bMEM_monitoring = false;
    

    this.reset = function()
    {
        this.clearIRQSources();
        videoMode.gfx = videoMode.mix = videoMode.page2 = videoMode.hires = false;
        lastBusAccess = null;
        if(rasterCapture) this.setVideoRasterCapture(true);
        hw.io.reset();
    }

    this.restart = function()
    {
        this.clearIRQSources();
        cpuTicks = videoTicks = 0;
        videoClockScale = 1;
        scaleCpuEpoch = scaleVideoEpoch = 0;
        if(rasterCapture) this.setVideoRasterCapture(true);
        lastBusAccess = null;
        for (var i = 0; i < RAM_SIZE; i++)
            ram[i] = Math.floor(Math.random() * 256.0);
        this.mount();       // mount hardware callbacks
        hw.io.restart();    // mount peripheral callbacks
    };

    function abs2IO(addr) { return addr - 0xC000 };
    this.IO2abs = function(io_addr) { return addr + 0xC000 };

    this.build_mount = function()
    {
        return {
            "RD":
            [
                function(addr) { return ram[addr]; },                   // $0000 - $0FFF
                function(addr) { return ram[addr]; },                   // $1000 - $1FFF
                function(addr) { return ram[addr]; },                   // $2000 - $2FFF
                function(addr) { return ram[addr]; },                   // $3000 - $3FFF
                function(addr) { return ram[addr]; },                   // $4000 - $4FFF
                function(addr) { return ram[addr]; },                   // $5000 - $5FFF
                function(addr) { return ram[addr]; },                   // $6000 - $6FFF
                function(addr) { return ram[addr]; },                   // $7000 - $7FFF
                function(addr) { return ram[addr]; },                   // $8000 - $8FFF
                function(addr) { return ram[addr]; },                   // $9000 - $9FFF
                function(addr) { return ram[addr]; },                   // $A000 - $AFFF
                function(addr) { return ram[addr]; },                   // $B000 - $BFFF
                function(addr,offset) { return hw.readIO(addr,offset); }, // $C000 - $CFFF

                // Default ROM, not RAMCARD.
                function(addr) { return apple2Rom[addr - ROM_ADDR]; },  // $D000 - $DFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; },  // $E000 - $EFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; }   // $F000 - $FFFF
            ],

            "WR":
            [
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $0000 - $0FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $1000 - $1FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $2000 - $2FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $3000 - $3FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $4000 - $4FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $5000 - $5FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $6000 - $6FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $7000 - $7FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $8000 - $8FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $9000 - $9FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $A000 - $AFFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $B000 - $BFFF
                function(addr,d8,offset) { hw.io.write(abs2IO(addr),d8,offset); },   // $C000 - $CFFF

                // Default ROM write: no-op.
                function(addr,d8) {},                                               // $D000 - $DFFF
                function(addr,d8) {},                                               // $E000 - $EFFF
                function(addr,d8) {}                                                // $F000 - $FFFF
            ]
        };
    };

    this.safe_flashdump = function() { return new Uint8Array(ram); }
    this.safe_videodump = function() { return ram.slice(0,0x6000); } // 0xC100


    /*
     * Import a flat 64 KiB runner image into real Apple II main RAM.
     *
     * Apple2Hw owns 48 KiB at $0000-$BFFF.  $C000-$CFFF is I/O/slot space
     * and $D000-$FFFF is ROM/language-card mapped space, so a flat 64 KiB
     * image must not be written through the CPU bus.  We deliberately copy
     * only the physical main-RAM portion.  video.vidram is a subarray of ram,
     * therefore text/lores/hires memory is updated by the same copy.
     */
    this.load_ram64k = function(bytes)
    {
        if(!(bytes instanceof Uint8Array))
            throw new TypeError("64K RAM image must be a Uint8Array");
        if(bytes.length != 0x10000)
            throw new RangeError("64K RAM image must contain exactly 65536 bytes");

        ram.set(bytes.subarray(0,RAM_SIZE),0);
        this.mem_mon = {};
        this.mem_mon_trigger = {};

        return {
             "sourceBytes":bytes.length
            ,"loadedBytes":RAM_SIZE
            ,"from":0x0000
            ,"to":RAM_SIZE-1
            ,"ignoredFrom":RAM_SIZE
            ,"ignoredTo":0xFFFF
        };
    }

    /*
     * Safe CPU-bus read.
     *
     * This reads the currently mapped CPU address space through the active
     * RD[line] callback table, but temporarily raises the hardware read-only
     * flag so soft-switches and memory-mapped I/O callbacks can return status
     * without mutating emulator state.
     */
    this.safe_read = function(addr)
    {
        addr = addr & 0xFFFF;

        var old_bRO = this.bRO;
        this.bRO = true;

        try
        {
            var d8 = typeof(this.RD[this.lineDecode(addr)])==="function" ? this.read(addr) : 0x00;

            return (d8 == null ? 0x00 : d8) & 0xFF;
        }
        finally { this.bRO = old_bRO; }
    };

    /*
     * Safe CPU-bus memory dump.
     *
     * from/to are inclusive CPU addresses.  This scans the current mapped
     * address space, including ROM, slot ROM, RAM-card mapping, etc.
     */
    this.safe_dump = function(from,to)
    {
        from = from == null ? 0x0000 : (from & 0xFFFF);
        to   = to   == null ? 0xFFFF : (to   & 0xFFFF);

        var len = ((to - from) & 0xFFFF) + 1;
        var out = new Uint8Array(len);
        var old_bRO = this.bRO;

        this.bRO = true;

        try
        {
            for(var i=0;i<len;i++)
            {
                var addr = (from + i) & 0xFFFF;
                var d8 = typeof(this.RD[this.lineDecode(addr)])==="function" ? this.read(addr) : 0x00;
                out[i] = (d8 == null ? 0x00 : d8) & 0xFF;
            }
        }
        finally { this.bRO = old_bRO; }

        return out;
    };

    this.mount = function()
    {
        this.default_map = this.build_mount();  // initialise the default memory mapping
        this.RD = this.default_map.RD.slice(0); // slice(0) creates working copies
        this.WR = this.default_map.WR.slice(0); // Do not assign the same array object!
    };

    this.cycle = function()
    {
        //hw.io.cycle();
    }

    this.mem_layout = {
        "0000-00FF":["#D0D0D0","ZERO-PAGE","ZP"]
       ,"0100-01FF":["#D0D0D0","STACK","ST"]
       ,"0200-02FF":["#00D000","GETLN buffer","BU"]
       ,"0300-03FF":["#00D000","VECTORS","VC"]
       ,"0400-07FF":["#D000D0","TXT1/LORES1","T1"]
       ,"0800-0BFF":["#D000D0","TXT2/LORES2","T2"]
       ,"0C00-1FFF":["#00D000","APPLESOFT PRG","AP"]
       ,"2000-3FFF":["#0000D0","HIRES1","H1"]
       ,"4000-5FFF":["#0000D0","HIRES2","H2"]
       ,"6000-BFFF":["rgba(0,0,0,0.1)","FREE","F"]
       ,"C000-C07F":["#D0D000","I/O","IB"]
       ,"C080-C0FF":["#D0D000","SLOT I/O","IO"]
       ,"C100-C1FF":["#D0D000","SLOT 1 ROM","S1"]
       ,"C200-C2FF":["#D0D000","SLOT 2 ROM","S2"]
       ,"C300-C3FF":["#D0D000","SLOT 3 ROM","S3"]
       ,"C400-C4FF":["#D0D000","SLOT 4 ROM","S4"]
       ,"C500-C5FF":["#D0D000","SLOT 5 ROM","S5"]
       ,"C600-C6FF":["#D0D000","SLOT 6 ROM","S6"]
       ,"C700-C7FF":["#D0D000","SLOT 7 ROM","S7"]
       ,"C800-CFFF":["#D0D000","SLOT ROM ext","SR"]
       ,"D000-FFFF":["#D00000","MONITOR ROM","AR"]       
    }

    this.mark_MEM_monitoring = function(addr)
    {
        /*
         * The refresh event is the UI's source of truth.  Avoid collecting
         * write-page evidence while that event is disabled; enable_MEM_monitoring()
         * remains available to non-UI callers.
         */
        var refreshEvent = typeof(oCOM)!="undefined"
           && oCOM.RefreshEvent_arr
                ? oCOM.RefreshEvent_arr.MEM_monitoring
                : null;

        if(!this.bMEM_monitoring
            && (!refreshEvent || refreshEvent.active!==true))
            return;

        this.mem_mon[ addr>>oMEMGRID.mem_gran ] = true;     // update memory monitoring grid 
    }

    this.reset_MEM_monitoring = function()
    {
        this.mem_mon = {};
        this.mem_mon_trigger = {};
        oMEMGRID.paint_grid(this.mem_layout);
    }

    this.enable_MEM_monitoring = function(b)
    {
        this.bMEM_monitoring = b;
        if(b) this.reset_MEM_monitoring();
    }

    this.MEM_monitoring = function()
    {
        if(Object.keys(hw.mem_mon).length>0)    // is there anything to display?
        {
            if(bDebug_mon) console.log("MEM_monitoring -> mem_layout:"+JSON.stringify(hw.mem_mon));
            oMEMGRID.paint_grid(hw.mem_layout);
            oMEMGRID.update_grid(hw.mem_mon);
            if(hw.bClear_mon) hw.mem_mon = {};    // CLEAR THE GRID AFTER EACH DISPLAY
        }
        hw.mem_mon_trigger = {};    // reset monitoring triggers
    }

    // Link memory to Video
    //video.vidram = ram.slice(0,0x6000);
    video.vidram = ram.subarray(0, 0x6000);
}
