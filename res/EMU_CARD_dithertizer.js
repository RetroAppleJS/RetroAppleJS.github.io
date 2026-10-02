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
    var hostCameraEpoch=0;
    var hostCameraPending=false;
    var hostCameraFrame=new Uint8Array(280*192);
    var hostCameraControlID=null;
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

    this.id={"PCODE":"DITHER","icon":"fa fa-camera"};
    this.state={
         "active":true
        ,"threshold":0
        ,"captureEnabled":false
        ,"page2":false
    };

    // Host image adjustments only. The card itself remains a one-bit comparator;
    // DSCAN supplies four thresholds and merges the 2x2 Bayer phases (0 2 / 3 1).
    var uiState={"brightness":0,"contrast":100,"gamma":100};
    var lumaLookup=new Uint8Array(256);

    function updateLumaLookup()
    {
        var brightness=uiState.brightness*255/100;
        var contrast=uiState.contrast/100;
        var exponent=100/uiState.gamma;
        for(var i=0;i<256;i++)
        {
            var level=((i-127.5)*contrast+127.5+brightness)/255;
            level=Math.max(0,Math.min(1,level));
            lumaLookup[i]=Math.round(255*Math.pow(level,exponent));
        }
    }
    updateLumaLookup();

    function hgrLineAddress(pageBase,y)
    {
        return pageBase
            + ((y & 0x07) << 10)
            + ((y & 0x38) << 4)
            + ((y & 0xC0) >> 1)
            + ((y & 0xC0) >> 3);
    }

    function writableHardware(hw)
    {
        if(!hw) return null;

        if(Array.isArray(hw.WR) && typeof(hw.lineDecode)==="function")
        {
            return {
                write:function(addr,d8)
                {
                    var line=hw.lineDecode(addr);
                    var fn=hw.WR[line];
                    if(typeof(fn)!=="function") return false;
                    fn(addr,d8);
                    return true;
                }
            };
        }

        if(typeof(hw.write)==="function") return hw;
        return null;
    }

    function resolveHardware(ctx)
    {
        var hw=writableHardware(ctx && ctx.hw);
        if(hw) return hw;

        hw=writableHardware(ctx && ctx.vid && ctx.vid.hw);
        if(hw) return hw;

        if(typeof(apple2plus)!=="undefined" && apple2plus && typeof(apple2plus.hwObj)==="function")
            return writableHardware(apple2plus.hwObj());

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

        if(!frame || typeof(frame.length)!=="number" || frame.length < HGR_WIDTH*HGR_HEIGHT)
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
        if(source!==null && source!==undefined && typeof(source.getLumaFrame)!=="function")
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
                    if(lumaLookup[frame[row+x0+bit]&0xFF] >= threshold)
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

    function uiNumber(value,min,max)
    {
        value=Number(value);
        if(!Number.isFinite(value)) return null;
        return Math.max(min,Math.min(max,Math.round(value)));
    }

    function uiValue(setting,value)
    {
        return setting==="gamma" ? (value/100).toFixed(2) : String(value)+"%";
    }

    function uiReadout(controlID,setting,value)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!=="function") return;
        var el=document.getElementById(controlID+"_"+setting+"_value");
        if(el) el.textContent=uiValue(setting,value);
    }

    function captureHostCameraFrame(epoch)
    {
        if(!hostCameraStream || epoch!==hostCameraEpoch || !hostCameraVideo || !hostCameraContext)
            return false;

        var sourceW=Number(hostCameraVideo.videoWidth)|0;
        var sourceH=Number(hostCameraVideo.videoHeight)|0;
        if(sourceW<=0 || sourceH<=0) return false;

        // A 4:3 camera view fills the Apple display. HGR's 280 samples are
        // slightly narrower than square pixels, so crop before resampling.
        var cropW=Math.min(sourceW,sourceH*4/3);
        var cropH=Math.min(sourceH,sourceW*3/4);
        hostCameraContext.drawImage(hostCameraVideo,(sourceW-cropW)/2,(sourceH-cropH)/2,
            cropW,cropH,0,0,HGR_WIDTH,HGR_HEIGHT);
        var image=hostCameraContext.getImageData(0,0,HGR_WIDTH,HGR_HEIGHT);
        var rgba=image && image.data;
        if(!rgba || rgba.length < HGR_WIDTH*HGR_HEIGHT*4) return false;

        // Keep the full luminance range: no palette matching or host dithering.
        // Publish a complete raw frame; adjustments are applied at capture time.
        var next=new Uint8Array(HGR_WIDTH*HGR_HEIGHT);
        for(var p=0,s=0;p<next.length;p++,s+=4)
            next[p]=Math.round((299*rgba[s]+587*rgba[s+1]+114*rgba[s+2])/1000);
        hostCameraFrame=next;
        return true;
    }

    // Apple2IO calls mounted-peripheral cycle hooks once per processing frame.
    // The SYSTEM FPS slider owns that cadence; the camera has no private timer.
    this.cycle=function()
    {
        if(!hostCameraStream) return;
        try { captureHostCameraFrame(hostCameraEpoch); }
        catch(error)
        {
            if(typeof(console)!=="undefined" && console && typeof(console.warn)==="function")
                console.warn("Dithertizer camera frame failed",error);
        }
    };

    async function startHostCameraBridge(stream,epoch)
    {
        if(typeof(document)==="undefined" || !document || typeof(document.createElement)!=="function") return false;

        hostCameraVideo=document.createElement("video");
        hostCameraCanvas=document.createElement("canvas");
        if(!hostCameraVideo || !hostCameraCanvas || typeof(hostCameraCanvas.getContext)!=="function")
            throw new Error("Dithertizer host camera requires video/canvas support");

        hostCameraCanvas.width=HGR_WIDTH;
        hostCameraCanvas.height=HGR_HEIGHT;
        hostCameraContext=hostCameraCanvas.getContext("2d");
        if(!hostCameraContext || typeof(hostCameraContext.drawImage)!=="function" || typeof(hostCameraContext.getImageData)!=="function")
            throw new Error("Dithertizer host camera requires a 2D canvas context");

        hostCameraVideo.autoplay=true;
        hostCameraVideo.muted=true;
        hostCameraVideo.playsInline=true;
        hostCameraVideo.srcObject=stream;
        if(typeof(hostCameraVideo.play)==="function") await hostCameraVideo.play();
        if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;

        await captureHostCameraFrame(epoch);
        return true;
    }

    function stopHostCamera()
    {
        hostCameraEpoch++;
        hostCameraPending=false;

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
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!=="function") return;
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
        if(hostCameraStream || hostCameraPending)
        {
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
        if(typeof(navigator)==="undefined" || !navigator || !navigator.mediaDevices || typeof(navigator.mediaDevices.getUserMedia)!=="function")
        {
            updateCameraButton(controlID);
            return false;
        }
        var epoch=++hostCameraEpoch;
        hostCameraPending=true;
        try
        {
            var stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
            if(epoch!==hostCameraEpoch)
            {
                if(stream && typeof(stream.getTracks)==="function")
                    stream.getTracks().forEach(function(track){if(track && typeof(track.stop)==="function") track.stop();});
                return false;
            }
            hostCameraPending=false;
            hostCameraStream=stream;
            await startHostCameraBridge(stream,epoch);
            if(!hostCameraStream || hostCameraStream!==stream || epoch!==hostCameraEpoch) return false;
            updateCameraButton(controlID);
            return true;
        }
        catch(e)
        {
            if(epoch!==hostCameraEpoch) return false;
            stopHostCamera();
            updateCameraButton(controlID);
            return false;
        }
    };

    this.deviceToolSetting=function(controlID,setting,value)
    {
        var bounds={"brightness":[-100,100],"contrast":[0,200],"gamma":[10,500]};
        if(!Object.prototype.hasOwnProperty.call(bounds,setting)) return false;
        value=uiNumber(value,bounds[setting][0],bounds[setting][1]);
        if(value===null) return false;
        uiState[setting]=value;
        updateLumaLookup();
        uiReadout(String(controlID || ""),setting,value);
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
        var cameraActive=!!hostCameraStream;
        var rowStyle="height:21px;display:flex;align-items:center;gap:4px;";

        function slider(setting,label,min,max)
        {
            return "<label for=\""+controlID+"_"+setting+"\" style=\"width:70px;\">"+label+"</label>"
                +"<input id=\""+controlID+"_"+setting+"\" type=\"range\" min=\""+min+"\" max=\""+max+"\" step=\"1\" value=\""+uiState[setting]+"\" title=\""+label+"\" oninput=\""+call+".deviceToolSetting('"+controlID+"','"+setting+"',this.value)\" style=\"width:110px;height:15px;padding:0;margin:0;\">"
                +"<span id=\""+controlID+"_"+setting+"_value\" style=\"width:38px;font:10px monospace;text-align:right;\">"+uiValue(setting,uiState[setting])+"</span>";
        }

        return "<div class=toolbox id=\""+toolboxID+"\" hidden>"
            +"<div class=appbox style=\"box-sizing:border-box;text-align:left;height:76px;padding:3px 6px;display:flex;flex-direction:column;gap:2px;font-size:11px;white-space:nowrap;\">"
            +"<div data-dither-row=\"IMG\" style=\""+rowStyle+"\">"+slider("brightness","Brightness",-100,100)
            +"<button id=\""+controlID+"_camera\" class=\"appbut skinny\" type=\"button\" aria-pressed=\""+(cameraActive ? "true" : "false")+"\" title=\""+(cameraActive ? "Stop host camera" : "Start host camera")+"\" onclick=\""+call+".deviceToolCameraToggle('"+controlID+"')\" style=\"margin-left:auto;height:19px;padding:1px 5px;\"><i class=\"fa fa-camera\" style=\""+(cameraActive ? "color:#0a0;" : "")+"\"></i></button>"
            +"<span id=\""+controlID+"_camera_status\" style=\"width:20px;font-size:10px;text-align:center;color:#777;\">"+(cameraActive ? "ON" : "OFF")+"</span></div>"
            +"<div data-dither-row=\"CONTRAST\" style=\""+rowStyle+"\">"+slider("contrast","Contrast",0,200)+"</div>"
            +"<div data-dither-row=\"GAMMA\" style=\""+rowStyle+"\">"+slider("gamma","Gamma",10,500)+"</div>"
            +"</div></div>";
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
