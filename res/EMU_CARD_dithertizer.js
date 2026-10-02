//
// EMU_CARD_dithertizer.js
//
// Computer Stations Dithertizer II video digitizer.
//
// The original DSCAN 4.2 driver uses only two slot-I/O addresses:
//   $C0n0 write : latch 8-bit threshold and disable capture
//   $C0n0 read  : read sync in D7 and disable capture
//   $C0n8 read  : enable capture
//
// DSCAN selects HGR page 1/2 through the normal Apple II $C054/$C055
// soft switches, so the card follows the current video page rather than
// maintaining a private page-select register.
//

function DithertizerII()
{
    var card=this;
    var cameraSource=null;
    var hostCameraStream=null;
    var hostCameraVideo=null;
    var hostCameraCanvas=null;
    var hostCameraContext=null;
    var hostCameraTimer=null;
    var hostCameraEpoch=0;
    var hostCameraFrame=new Uint8Array(280*192);
    var hostCameraAdapter=null;
    var hostCameraControlID=null;
    var convertHGRAdapterLoadPromise=null;
    var syncTraceEnabled=false;
    var syncTraceEntries=[];
    var syncTraceLastD7=null;
    var syncTraceLastTick=null;

    const HGR_WIDTH=280;
    const HGR_HEIGHT=192;
    const HGR_BYTES_PER_LINE=40;
    const APPLE_FRAME_CYCLES=17030;
    const DSCAN_TRACE_PC_MIN=0x1D23;
    const DSCAN_TRACE_PC_MAX=0x1D35;
    const SYNC_TRACE_LIMIT=512;
    const HOST_CAMERA_SEED=0x12345678;
    const PALETTE_LUMA=new Uint8Array([0,156,145,255,0,145,156,255]);

    this.id={"PCODE":"DITHER","icon":"fa fa-camera"};
    this.state={
         "active":true
        ,"threshold":0
        ,"captureEnabled":false
        ,"page2":false
    };

    var uiState={
         "mode":"diffusion"
        ,"preset":"atkinson"
        ,"error":"accumulate"
        ,"offset":0
        ,"perceptual":false
        ,"luma":80
        ,"shift":1
        ,"greyscale":false
        ,"histogram":false
        ,"gamma":130
        ,"filter":"bilinear"
        ,"rate":250
        ,"errorCoeffs":{"A":1,"B":2,"C":2,"D":2,"E":1,"F":1}
    };

    function hgrLineAddress(pageBase,y)
    {
        return pageBase
            + ((y & 0x07) << 10)
            + ((y & 0x38) << 4)
            + ((y & 0xC0) >> 1)
            + ((y & 0xC0) >> 3);
    }

    function resolveHardware(ctx)
    {
        if(ctx && ctx.hw && typeof(ctx.hw.write)==="function")
            return ctx.hw;

        if(ctx && ctx.vid && ctx.vid.hw && typeof(ctx.vid.hw.write)==="function")
            return ctx.vid.hw;

        if(typeof(apple2plus)!=="undefined" && apple2plus && typeof(apple2plus.hwObj)==="function")
        {
            var hw=apple2plus.hwObj();
            if(hw && typeof(hw.write)==="function") return hw;
        }

        return null;
    }

    function currentPage2(ctx)
    {
        if(ctx && ctx.vid && ctx.vid.state && typeof(ctx.vid.state.page2)==="boolean")
            return ctx.vid.state.page2;

        return false;
    }

    function clockTicks(ctx)
    {
        if(ctx && ctx.io && typeof(ctx.io.getClockTicks)==="function")
            return Number(ctx.io.getClockTicks()) || 0;

        if(typeof(oEMU)!=="undefined" && oEMU && oEMU.component && oEMU.component.IO &&
           oEMU.component.IO.self && typeof(oEMU.component.IO.self.getClockTicks)==="function")
            return Number(oEMU.component.IO.self.getClockTicks()) || 0;

        return 0;
    }

    function syncPhase(ticks)
    {
        return ((Number(ticks)||0)%APPLE_FRAME_CYCLES+APPLE_FRAME_CYCLES)%APPLE_FRAME_CYCLES;
    }

    function currentPC()
    {
        try
        {
            if(typeof(apple2plus)!=="undefined" && apple2plus && typeof(apple2plus.cpuObj)==="function")
            {
                var cpu=apple2plus.cpuObj();
                if(cpu && typeof(cpu.watch)==="function")
                {
                    var state=cpu.watch();
                    if(state && Number.isFinite(Number(state.pc))) return Number(state.pc)&0xFFFF;
                }
            }
        }
        catch(e){}
        return null;
    }

    function traceSyncD7(ticks,d8)
    {
        if(!syncTraceEnabled || syncTraceEntries.length>=SYNC_TRACE_LIMIT) return;

        var pc=currentPC();
        if(pc===null || pc<DSCAN_TRACE_PC_MIN || pc>DSCAN_TRACE_PC_MAX) return;

        var d7=(Number(d8)&0x80) ? 1 : 0;
        if(syncTraceLastD7!==null && d7===syncTraceLastD7) return;

        var now=Math.trunc(Number(ticks)||0);
        var entry={
             "index":syncTraceEntries.length
            ,"pc":pc
            ,"clockTicks":now
            ,"phase":syncPhase(now)
            ,"d7":d7
            ,"deltaTicks":syncTraceLastTick===null ? null : now-syncTraceLastTick
        };
        syncTraceEntries.push(entry);
        syncTraceLastD7=d7;
        syncTraceLastTick=now;

        if(typeof(console)!=="undefined" && console && typeof(console.log)==="function")
        {
            var pcHex=pc.toString(16).toUpperCase().padStart(4,"0");
            var width=entry.deltaTicks===null ? "start" : String(entry.deltaTicks)+" cycles";
            console.log("Dithertizer DSCAN sync transition #"+entry.index+
                " PC=$"+pcHex+" ticks="+entry.clockTicks+" phase="+entry.phase+
                " D7="+entry.d7+" width="+width);
        }
    }

    function syncD7(ticks)
    {
        var phase=syncPhase(ticks);
        if(phase < 64) return 0x00;
        if(phase < 96) return 0x80;
        if(phase < 103) return 0x00;
        return 0x80;
    }

    function normalizeSourceFrame(frame)
    {
        if(frame instanceof ArrayBuffer) frame=new Uint8Array(frame);
        else if(typeof(ArrayBuffer)!=="undefined" && typeof(ArrayBuffer.isView)==="function" && ArrayBuffer.isView(frame))
            frame=new Uint8Array(frame.buffer,frame.byteOffset,frame.byteLength);

        if(!frame || typeof(frame.length)!==="number" || frame.length < HGR_WIDTH*HGR_HEIGHT)
            throw new Error("Dithertizer camera source must provide at least 280x192 luminance bytes");

        return frame;
    }

    function sourceFrame()
    {
        if(cameraSource && typeof(cameraSource.getLumaFrame)==="function")
            return normalizeSourceFrame(cameraSource.getLumaFrame(HGR_WIDTH,HGR_HEIGHT));
        return hostCameraFrame;
    }

    this.setCameraSource=function(source)
    {
        if(source!==null && source!==undefined && typeof(source.getLumaFrame)!==="function")
            throw new TypeError("Dithertizer camera source must expose getLumaFrame(width,height)");

        cameraSource=source || null;
        return cameraSource;
    };

    this.getCameraSource=function(){return cameraSource;};

    this.setSyncTrace=function(enabled)
    {
        syncTraceEnabled=!!enabled;
        syncTraceEntries=[];
        syncTraceLastD7=null;
        syncTraceLastTick=null;
        if(syncTraceEnabled && typeof(console)!=="undefined" && console && typeof(console.info)==="function")
            console.info("Dithertizer DSCAN sync trace enabled for PC $1D23-$1D35");
        return syncTraceEnabled;
    };

    this.clearSyncTrace=function()
    {
        syncTraceEntries=[];
        syncTraceLastD7=null;
        syncTraceLastTick=null;
    };

    this.getSyncTrace=function(){return syncTraceEntries.slice();};
    this.dumpSyncTrace=function()
    {
        var out=card.getSyncTrace();
        if(typeof(console)!=="undefined" && console)
        {
            if(typeof(console.table)==="function") console.table(out);
            else if(typeof(console.log)==="function") console.log(out);
        }
        return out;
    };

    this.readVideoSync=function(ctx)
    {
        var ticks=clockTicks(ctx);
        var d8=syncD7(ticks);
        traceSyncD7(ticks,d8);
        return d8;
    };
    this.stopCapture=function(){card.state.captureEnabled=false;};

    this.startCapture=function(ctx)
    {
        card.state.captureEnabled=true;
        card.state.page2=currentPage2(ctx);

        var hw=resolveHardware(ctx);
        if(!hw) return false;

        var pageBase=card.state.page2 ? 0x4000 : 0x2000;

        if(!cameraSource && !hostCameraStream)
        {
            for(var fy=0;fy<HGR_HEIGHT;fy++)
            {
                var fline=hgrLineAddress(pageBase,fy);
                for(var fxb=0;fxb<HGR_BYTES_PER_LINE;fxb++)
                    hw.write(fline+fxb,((fxb+fy)&1) ? 0x7F : 0x00);
            }
            return true;
        }

        var frame=sourceFrame();
        var threshold=card.state.threshold & 0xFF;

        for(var y=0;y<HGR_HEIGHT;y++)
        {
            var line=hgrLineAddress(pageBase,y);
            var row=y*HGR_WIDTH;
            for(var xb=0;xb<HGR_BYTES_PER_LINE;xb++)
            {
                var d8=0;
                var x0=xb*7;
                for(var bit=0;bit<7;bit++)
                    if((frame[row+x0+bit]&0xFF) >= threshold)
                        d8 |= (1 << bit);
                hw.write(line+xb,d8&0x7F);
            }
        }
        return true;
    };

    this.readSlotIO=function(addr,ctx)
    {
        var reg=Number(addr)&0x0F;
        var safe=ctx && ctx.bRO===true;
        switch(reg)
        {
            case 0x00:
            {
                var d8=card.readVideoSync(ctx);
                if(!safe) card.stopCapture();
                return d8;
            }
            case 0x08:
                if(!safe) card.startCapture(ctx);
                return 0x00;
        }
        return 0x00;
    };

    this.writeSlotIO=function(addr,d8,ctx)
    {
        var reg=Number(addr)&0x0F;
        if(reg===0x00)
        {
            card.stopCapture();
            card.state.threshold=Number(d8)&0xFF;
        }
        return 0x00;
    };

    function uiOption(value,label,current)
    {
        return "<option value=\""+value+"\""+(String(value)===String(current) ? " selected" : "")+">"+label+"</option>";
    }

    function uiNumber(value,min,max)
    {
        value=Number(value);
        if(!Number.isFinite(value)) return null;
        value=Math.round(value);
        if(value<min) value=min;
        if(value>max) value=max;
        return value;
    }

    function uiReadout(controlID,setting,value)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!==="function") return;
        var el=document.getElementById(controlID+"_"+setting+"_value");
        if(!el) return;
        if(setting==="rate") el.textContent=(Number(value)/1000).toFixed(2)+"s";
        else
        {
            var suffix=(setting==="luma" || setting==="shift" || setting==="gamma") ? "%" : "";
            el.textContent=String(value)+suffix;
        }
    }

    function presetError(name)
    {
        var presets={
             "atkinson":{"A":1,"B":2,"C":2,"D":2,"E":1,"F":1}
            ,"floyd":{"A":3,"B":5,"C":1,"D":7,"E":0,"F":0}
            ,"pattern":{"A":0,"B":8,"C":0,"D":8,"E":0,"F":0}
            ,"diag":{"A":1,"B":3,"C":2,"D":3,"E":1,"F":1}
            ,"none":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}
        };
        return presets[name] || presets.atkinson;
    }

    function buildConvertHGRSettings()
    {
        var orderedMode=0,mapSize=2;
        if(uiState.mode==="order1"){orderedMode=1;mapSize=2;}
        else if(uiState.mode==="order2"){orderedMode=2;mapSize=2;}
        else if(uiState.mode==="order3"){orderedMode=1;mapSize=4;}
        else if(uiState.mode==="order4"){orderedMode=2;mapSize=4;}

        var e=uiState.errorCoeffs;
        return {
            image:{
                 greyscale:!!uiState.greyscale
                ,stretchHistogram:!!uiState.histogram
                ,gamma:Number(uiState.gamma)/100
                ,maxColorShift:Number(uiState.shift)
            },
            scaling:{
                 filter:uiState.filter
                ,fillMode:"default"
                ,horizontalNudge:0
                ,verticalNudge:0
                ,applePixelAspect:256/280
            },
            matching:{
                 perceptual:!!uiState.perceptual
                ,lumaEmphasis:Number(uiState.luma)/100
                ,perceptualR:0.30
                ,perceptualG:0.52
                ,perceptualB:0.18
            },
            dither:{
                 orderedMode:orderedMode
                ,mapSize:mapSize
                ,orderedOffset:Number(uiState.offset)
                ,accumulateErrors:uiState.error==="accumulate"
                ,error:{A:e.A,B:e.B,C:e.C,D:e.D,E:e.E,F:e.F}
            }
        };
    }

    function ensureConvertHGRAdapterCtor()
    {
        if(typeof(DithertizerConvertHGRAdapter)==="function")
            return Promise.resolve(DithertizerConvertHGRAdapter);
        if(convertHGRAdapterLoadPromise) return convertHGRAdapterLoadPromise;
        if(typeof(document)==="undefined" || !document || typeof(document.createElement)!==="function" ||
           !document.head || typeof(document.head.appendChild)!==="function")
            return Promise.resolve(null);

        convertHGRAdapterLoadPromise=new Promise(function(resolve,reject)
        {
            var script=document.createElement("script");
            script.type="text/javascript";
            script.src="res/EMU_DITHERTIZER_converthgr.js";
            script.onload=function()
            {
                if(typeof(DithertizerConvertHGRAdapter)==="function") resolve(DithertizerConvertHGRAdapter);
                else reject(new Error("ConvertHGR adapter did not register"));
            };
            script.onerror=function(){reject(new Error("Unable to load ConvertHGR adapter"));};
            document.head.appendChild(script);
        }).catch(function(error)
        {
            convertHGRAdapterLoadPromise=null;
            throw error;
        });
        return convertHGRAdapterLoadPromise;
    }

    function clearHostCameraTimer()
    {
        if(hostCameraTimer!==null && typeof(clearTimeout)==="function") clearTimeout(hostCameraTimer);
        hostCameraTimer=null;
    }

    async function captureHostCameraFrame(epoch)
    {
        if(!hostCameraStream || !hostCameraVideo || !hostCameraContext || !hostCameraCanvas || !hostCameraAdapter)
            return false;

        var sourceW=Number(hostCameraVideo.videoWidth)|0;
        var sourceH=Number(hostCameraVideo.videoHeight)|0;
        if(sourceW<=0 || sourceH<=0) return false;

        if(hostCameraCanvas.width!==sourceW) hostCameraCanvas.width=sourceW;
        if(hostCameraCanvas.height!==sourceH) hostCameraCanvas.height=sourceH;
        hostCameraContext=hostCameraCanvas.getContext("2d");
        if(!hostCameraContext) return false;

        hostCameraContext.drawImage(hostCameraVideo,0,0,sourceW,sourceH);
        var image=hostCameraContext.getImageData(0,0,sourceW,sourceH);
        var rgba=image && image.data;
        if(!rgba || rgba.length < sourceW*sourceH*4) return false;

        var rgb=new Uint8Array(sourceW*sourceH*3);
        for(var s=0,d=0;s<rgba.length;s+=4)
        {
            rgb[d++]=rgba[s];
            rgb[d++]=rgba[s+1];
            rgb[d++]=rgba[s+2];
        }

        hostCameraAdapter.configure(buildConvertHGRSettings());
        var result=await hostCameraAdapter.convert(rgb,sourceW,sourceH,HOST_CAMERA_SEED);
        if(!hostCameraStream || epoch!==hostCameraEpoch) return false;

        var palette=result && result.paletteIndex;
        if(!palette || palette.length!==HGR_WIDTH*HGR_HEIGHT)
            throw new Error("ConvertHGR did not return a 280x192 palette image");

        var next=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);
        for(var p=0;p<next.length;p++)
        {
            var index=palette[p]&0xFF;
            if(index>7) throw new Error("ConvertHGR palette index outside 0..7");
            next[p]=PALETTE_LUMA[index];
        }
        hostCameraFrame=next;
        return true;
    }

    function scheduleHostCameraFrame(epoch)
    {
        clearHostCameraTimer();
        if(!hostCameraStream || epoch!==hostCameraEpoch || typeof(setTimeout)!==="function") return;
        hostCameraTimer=setTimeout(function()
        {
            hostCameraTimer=null;
            if(!hostCameraStream || epoch!==hostCameraEpoch) return;
            Promise.resolve(captureHostCameraFrame(epoch)).catch(function(error)
            {
                if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                    console.warn("Dithertizer ConvertHGR camera frame failed",error);
            }).then(function()
            {
                if(hostCameraStream && epoch===hostCameraEpoch) scheduleHostCameraFrame(epoch);
            });
        },uiState.rate);
    }

    async function startHostCameraBridge(stream,epoch)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.createElement)!==="function") return false;

        var AdapterCtor=await ensureConvertHGRAdapterCtor();
        if(!AdapterCtor) return false;
        hostCameraAdapter=new AdapterCtor();
        await hostCameraAdapter.init();

        hostCameraVideo=document.createElement("video");
        hostCameraCanvas=document.createElement("canvas");
        if(!hostCameraVideo || !hostCameraCanvas || typeof(hostCameraCanvas.getContext)!==="function")
            throw new Error("Dithertizer host camera requires video/canvas support");

        hostCameraContext=hostCameraCanvas.getContext("2d");
        if(!hostCameraContext || typeof(hostCameraContext.drawImage)!==="function" || typeof(hostCameraContext.getImageData)!==="function")
            throw new Error("Dithertizer host camera requires a 2D canvas context");

        hostCameraVideo.autoplay=true;
        hostCameraVideo.muted=true;
        hostCameraVideo.playsInline=true;
        hostCameraVideo.srcObject=stream;
        if(typeof(hostCameraVideo.play)==="function") await hostCameraVideo.play();
        if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;

        await captureHostCameraFrame(epoch);
        scheduleHostCameraFrame(epoch);
        return true;
    }

    function stopHostCamera()
    {
        hostCameraEpoch++;
        clearHostCameraTimer();
        if(hostCameraAdapter && typeof(hostCameraAdapter.close)==="function") hostCameraAdapter.close();
        hostCameraAdapter=null;

        if(hostCameraVideo)
        {
            if(typeof(hostCameraVideo.pause)==="function") hostCameraVideo.pause();
            try { hostCameraVideo.srcObject=null; } catch(e) {}
        }
        hostCameraVideo=null;
        hostCameraCanvas=null;
        hostCameraContext=null;
        hostCameraFrame=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);

        if(hostCameraStream && typeof(hostCameraStream.getTracks)==="function")
        {
            var tracks=hostCameraStream.getTracks();
            for(var i=0;i<tracks.length;i++)
                if(tracks[i] && typeof(tracks[i].stop)==="function") tracks[i].stop();
        }
        hostCameraStream=null;
    }

    function updateCameraButton(controlID)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!==="function") return;
        var button=document.getElementById(controlID+"_camera");
        if(!button) return;
        var active=!!hostCameraStream;
        button.setAttribute("aria-pressed",active ? "true" : "false");
        button.title=active ? "Stop host camera" : "Start host camera";
        var icon=button.querySelector ? button.querySelector("i") : null;
        if(icon && icon.style) icon.style.color=active ? "#0a0" : "";
        var status=document.getElementById(controlID+"_camera_status");
        if(status) status.textContent=active ? "ON" : "OFF";
    }

    this.deviceToolCameraToggle=async function(controlID)
    {
        controlID=String(controlID || "");
        hostCameraControlID=controlID;
        if(hostCameraStream)
        {
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
        if(typeof(navigator)==="undefined" || !navigator || !navigator.mediaDevices || typeof(navigator.mediaDevices.getUserMedia)!==="function")
        {
            updateCameraButton(controlID);
            return false;
        }
        try
        {
            var stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
            hostCameraStream=stream;
            var epoch=++hostCameraEpoch;
            await startHostCameraBridge(stream,epoch);
            if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;
            updateCameraButton(controlID);
            return true;
        }
        catch(e)
        {
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
    };

    this.deviceToolSetting=function(controlID,setting,value)
    {
        controlID=String(controlID || "");
        setting=String(setting || "");
        var allowed;
        switch(setting)
        {
            case "mode":
                allowed=["diffusion","order1","order2","order3","order4"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.mode=String(value);
                if(uiState.mode==="order2" || uiState.mode==="order4")
                    uiState.errorCoeffs={"A":1,"B":2,"C":2,"D":2,"E":0,"F":0};
                return true;
            case "preset":
                allowed=["atkinson","floyd","pattern","diag","none"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.preset=String(value);uiState.errorCoeffs=presetError(uiState.preset);return true;
            case "error":
                allowed=["accumulate","average"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.error=String(value);return true;
            case "filter":
                allowed=["box","gaussian","hamming","blackman","bilinear"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.filter=String(value);return true;
            case "offset":
                value=uiNumber(value,0,16);if(value===null)return false;uiState.offset=value;uiReadout(controlID,"offset",value);return true;
            case "luma":
                value=uiNumber(value,0,500);if(value===null)return false;uiState.luma=value;uiReadout(controlID,"luma",value);return true;
            case "shift":
                value=uiNumber(value,0,100);if(value===null)return false;uiState.shift=value;uiReadout(controlID,"shift",value);return true;
            case "gamma":
                value=uiNumber(value,0,500);if(value===null)return false;uiState.gamma=value;uiReadout(controlID,"gamma",value);return true;
            case "rate":
                value=uiNumber(value,100,1000);if(value===null)return false;uiState.rate=value;uiReadout(controlID,"rate",value);return true;
        }
        return false;
    };

    this.deviceToolFlag=function(controlID,setting,enabled)
    {
        setting=String(setting || "");
        if(setting!=="perceptual" && setting!=="greyscale" && setting!=="histogram") return false;
        uiState[setting]=!!enabled;
        return true;
    };

    this.deviceToolSlotHTML=function(ctx)
    {
        ctx=ctx || {};
        var toolboxID=ctx.toolboxID || ("device_tool_"+ctx.slotID);
        var slotID=ctx.slotID==null ? "?" : String(ctx.slotID);
        var slotN=Number(ctx.slotN);
        var controlID="dither_ctrl_"+slotID;
        var call="apple2plus.hwObj().io.SLOT2obj("+slotN+")";

        var modeOptions=""+uiOption("diffusion","Error diffusion",uiState.mode)+uiOption("order1","Order1",uiState.mode)+uiOption("order2","Order2",uiState.mode)+uiOption("order3","Order3",uiState.mode)+uiOption("order4","Order4",uiState.mode);
        var presetOptions=""+uiOption("atkinson","Atkinson",uiState.preset)+uiOption("floyd","Floyd-Stein",uiState.preset)+uiOption("pattern","Pattern",uiState.preset)+uiOption("diag","Diag",uiState.preset)+uiOption("none","None",uiState.preset);
        var errorOptions=""+uiOption("accumulate","Accumulate",uiState.error)+uiOption("average","Average",uiState.error);
        var filterOptions=""+uiOption("box","Box",uiState.filter)+uiOption("gaussian","Gaussian",uiState.filter)+uiOption("hamming","Hamming",uiState.filter)+uiOption("blackman","Blackman",uiState.filter)+uiOption("bilinear","Bilinear",uiState.filter);

        var perceptualChecked=uiState.perceptual ? " checked" : "";
        var greyscaleChecked=uiState.greyscale ? " checked" : "";
        var histogramChecked=uiState.histogram ? " checked" : "";
        var cameraActive=!!hostCameraStream;
        var rowStyle="height:21px;display:flex;align-items:center;gap:4px;";
        var headStyle="display:inline-block;width:28px;";
        var selectStyle="height:19px;font:11px monospace;padding:0px 1px;";
        var sliderStyle="width:68px;height:15px;padding:0;margin:0;";
        var rateSliderStyle="width:50px;height:15px;padding:0;margin:0;";
        var valueStyle="display:inline-block;width:30px;font:10px monospace;text-align:right;";
        var rateValueStyle="display:inline-block;width:34px;font:10px monospace;text-align:right;";

        return ""
            +"<div class=toolbox id=\""+toolboxID+"\" hidden>"
            +" <div class=appbox style=\"box-sizing:border-box;text-align:left;height:76px;padding:3px 6px;display:flex;flex-direction:column;gap:2px;font-size:11px;white-space:nowrap;\">"
            +"  <div data-dither-row=\"DTH\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">DTH</b><span>MODE</span>"
            +"   <select id=\""+controlID+"_mode\" title=\"Dithering mode\" onchange=\""+call+".deviceToolSetting('"+controlID+"','mode',this.value)\" style=\""+selectStyle+"\">"+modeOptions+"</select>"
            +"   <select id=\""+controlID+"_preset\" title=\"Error-diffusion preset\" onchange=\""+call+".deviceToolSetting('"+controlID+"','preset',this.value)\" style=\""+selectStyle+"\">"+presetOptions+"</select>"
            +"   <span>ERR</span><select id=\""+controlID+"_error\" title=\"Incoming error handling\" onchange=\""+call+".deviceToolSetting('"+controlID+"','error',this.value)\" style=\""+selectStyle+"\">"+errorOptions+"</select>"
            +"   <span>OFFSET</span><input id=\""+controlID+"_offset\" type=\"range\" min=\"0\" max=\"16\" step=\"1\" value=\""+uiState.offset+"\" title=\"Ordered offset\" oninput=\""+call+".deviceToolSetting('"+controlID+"','offset',this.value)\" style=\""+sliderStyle+"\">"
            +"   <span id=\""+controlID+"_offset_value\" style=\""+valueStyle+"\">"+uiState.offset+"</span></div>"
            +"  <div data-dither-row=\"COL\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">COL</b><label title=\"Use perceptual RGB colour matching\" style=\"display:flex;align-items:center;gap:2px;\"><input id=\""+controlID+"_perceptual\" type=\"checkbox\""+perceptualChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','perceptual',this.checked)\">Perceptual RGB</label>"
            +"   <span>LUMA</span><input id=\""+controlID+"_luma\" type=\"range\" min=\"0\" max=\"500\" step=\"1\" value=\""+uiState.luma+"\" title=\"Luma emphasis\" oninput=\""+call+".deviceToolSetting('"+controlID+"','luma',this.value)\" style=\""+sliderStyle+"\"><span id=\""+controlID+"_luma_value\" style=\""+valueStyle+"\">"+uiState.luma+"%</span>"
            +"   <span>SHIFT</span><input id=\""+controlID+"_shift\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\""+uiState.shift+"\" title=\"Maximum colour shift\" oninput=\""+call+".deviceToolSetting('"+controlID+"','shift',this.value)\" style=\""+sliderStyle+"\"><span id=\""+controlID+"_shift_value\" style=\""+valueStyle+"\">"+uiState.shift+"%</span></div>"
            +"  <div data-dither-row=\"IMG\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">IMG</b><label style=\"display:flex;align-items:center;gap:2px;\"><input id=\""+controlID+"_greyscale\" type=\"checkbox\""+greyscaleChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','greyscale',this.checked)\">Greyscale</label>"
            +"   <label style=\"display:flex;align-items:center;gap:2px;\"><input id=\""+controlID+"_histogram\" type=\"checkbox\""+histogramChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','histogram',this.checked)\">Stretch histo</label>"
            +"   <span>GAMMA</span><input id=\""+controlID+"_gamma\" type=\"range\" min=\"0\" max=\"500\" step=\"1\" value=\""+uiState.gamma+"\" title=\"Gamma\" oninput=\""+call+".deviceToolSetting('"+controlID+"','gamma',this.value)\" style=\""+sliderStyle+"\"><span id=\""+controlID+"_gamma_value\" style=\""+valueStyle+"\">"+uiState.gamma+"%</span>"
            +"   <span>FILTER</span><select id=\""+controlID+"_filter\" title=\"Scaling filter\" onchange=\""+call+".deviceToolSetting('"+controlID+"','filter',this.value)\" style=\""+selectStyle+"\">"+filterOptions+"</select>"
            +"   <span>RATE</span><input id=\""+controlID+"_rate\" type=\"range\" min=\"100\" max=\"1000\" step=\"50\" value=\""+uiState.rate+"\" title=\"Camera conversion interval\" oninput=\""+call+".deviceToolSetting('"+controlID+"','rate',this.value)\" style=\""+rateSliderStyle+"\"><span id=\""+controlID+"_rate_value\" style=\""+rateValueStyle+"\">"+(uiState.rate/1000).toFixed(2)+"s</span>"
            +"   <button id=\""+controlID+"_camera\" class=\"appbut skinny\" type=\"button\" aria-pressed=\""+(cameraActive ? "true" : "false")+"\" title=\""+(cameraActive ? "Stop host camera" : "Start host camera")+"\" onclick=\""+call+".deviceToolCameraToggle('"+controlID+"')\" style=\"margin-left:auto;height:19px;padding:1px 5px;\"><i class=\"fa fa-camera\" style=\""+(cameraActive ? "color:#0a0;" : "")+"\"></i></button>"
            +"   <span id=\""+controlID+"_camera_status\" style=\"display:inline-block;width:20px;font-size:10px;text-align:center;color:#777;\">"+(cameraActive ? "ON" : "OFF")+"</span></div>"
            +" </div></div>";
    };

    this.action={"SlotIO":{"RD":{"callback":function(addr,ctx){return card.readSlotIO(addr,ctx);}},"WR":{"callback":function(addr,d8,ctx){return card.writeSlotIO(addr,d8,ctx);}}}};

    this.reset=function()
    {
        stopHostCamera();
        if(hostCameraControlID) updateCameraButton(hostCameraControlID);
        card.state.threshold=0;
        card.state.captureEnabled=false;
        card.state.page2=false;
    };
    this.restart=this.reset;
}

if(typeof(oEMU)==="undefined")
    var oEMU={"component":{"IO":{}}};
else
{
    if(!oEMU.component) oEMU.component={};
    if(!oEMU.component.IO) oEMU.component.IO={};
}
oEMU.component.IO.DithertizerII=new DithertizerII();