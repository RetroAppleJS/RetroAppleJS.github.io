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

    const HGR_WIDTH=280;
    const HGR_HEIGHT=192;
    const HGR_BYTES_PER_LINE=40;
    const APPLE_FRAME_CYCLES=17030;

    this.id={"PCODE":"DITHER","icon":"fa fa-camera"};
    this.state={
         "active":true
        ,"threshold":0
        ,"captureEnabled":false
        ,"page2":false
    };

    /*
     * Peripheral-control values are intentionally UI-local in this stage.
     * They mirror selected ConvertHGR controls but do not yet alter the
     * Dithertizer camera/capture pipeline.
     */
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

    function syncD7(ticks)
    {
        var phase=((Number(ticks)||0)%APPLE_FRAME_CYCLES+APPLE_FRAME_CYCLES)%APPLE_FRAME_CYCLES;

        /*
         * DSCAN 4.2 does not poll a BUSY bit.  It measures D7 pulse widths:
         * first a sustained low interval, then high, then a short low pulse.
         * This deterministic emulated waveform preserves that software-visible
         * contract without tying the card to requestAnimationFrame/host time.
         */
        if(phase < 64) return 0x00;
        if(phase < 96) return 0x80;
        if(phase < 102) return 0x00;
        return 0x80;
    }

    function sourceFrame()
    {
        if(!cameraSource || typeof(cameraSource.getLumaFrame)!=="function")
            return new Uint8Array(HGR_WIDTH*HGR_HEIGHT);

        var frame=cameraSource.getLumaFrame(HGR_WIDTH,HGR_HEIGHT);
        if(frame instanceof ArrayBuffer) frame=new Uint8Array(frame);
        else if(typeof(ArrayBuffer)!=="undefined" && typeof(ArrayBuffer.isView)==="function" && ArrayBuffer.isView(frame))
            frame=new Uint8Array(frame.buffer,frame.byteOffset,frame.byteLength);

        if(!frame || typeof(frame.length)!=="number" || frame.length < HGR_WIDTH*HGR_HEIGHT)
            throw new Error("Dithertizer camera source must provide at least 280x192 luminance bytes");

        return frame;
    }

    this.setCameraSource=function(source)
    {
        if(source!==null && source!==undefined && typeof(source.getLumaFrame)!=="function")
            throw new TypeError("Dithertizer camera source must expose getLumaFrame(width,height)");

        cameraSource=source || null;
        return cameraSource;
    };

    this.getCameraSource=function()
    {
        return cameraSource;
    };

    this.readVideoSync=function(ctx)
    {
        return syncD7(clockTicks(ctx));
    };

    this.stopCapture=function()
    {
        card.state.captureEnabled=false;
    };

    this.startCapture=function(ctx)
    {
        card.state.captureEnabled=true;
        card.state.page2=currentPage2(ctx);

        var hw=resolveHardware(ctx);
        if(!hw) return false;

        var frame=sourceFrame();
        var threshold=card.state.threshold & 0xFF;
        var pageBase=card.state.page2 ? 0x4000 : 0x2000;

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
        return "<option value=\""+value+"\""
            +(String(value)===String(current) ? " selected" : "")
            +">"+label+"</option>";
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
        if(typeof(document)==="undefined" || !document || typeof(document.getElementById)!==="function")
            return;

        var el=document.getElementById(controlID+"_"+setting+"_value");
        if(!el) return;

        var suffix=(setting==="luma" || setting==="shift" || setting==="gamma") ? "%" : "";
        el.textContent=String(value)+suffix;
    }

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
                return true;

            case "preset":
                allowed=["atkinson","floyd","pattern","diag","none"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.preset=String(value);
                return true;

            case "error":
                allowed=["accumulate","average"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.error=String(value);
                return true;

            case "filter":
                allowed=["box","gaussian","hamming","blackman","bilinear"];
                if(allowed.indexOf(String(value))<0) return false;
                uiState.filter=String(value);
                return true;

            case "offset":
                value=uiNumber(value,0,16);
                if(value===null) return false;
                uiState.offset=value;
                uiReadout(controlID,"offset",value);
                return true;

            case "luma":
                value=uiNumber(value,0,500);
                if(value===null) return false;
                uiState.luma=value;
                uiReadout(controlID,"luma",value);
                return true;

            case "shift":
                value=uiNumber(value,0,100);
                if(value===null) return false;
                uiState.shift=value;
                uiReadout(controlID,"shift",value);
                return true;

            case "gamma":
                value=uiNumber(value,0,500);
                if(value===null) return false;
                uiState.gamma=value;
                uiReadout(controlID,"gamma",value);
                return true;
        }

        return false;
    };

    this.deviceToolFlag=function(controlID,setting,enabled)
    {
        setting=String(setting || "");
        if(setting!=="perceptual" && setting!=="greyscale" && setting!=="histogram")
            return false;

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

        var modeOptions=""
            +uiOption("diffusion","Error diffusion",uiState.mode)
            +uiOption("order1","Order1",uiState.mode)
            +uiOption("order2","Order2",uiState.mode)
            +uiOption("order3","Order3",uiState.mode)
            +uiOption("order4","Order4",uiState.mode);

        var presetOptions=""
            +uiOption("atkinson","Atkinson",uiState.preset)
            +uiOption("floyd","Floyd-Stein",uiState.preset)
            +uiOption("pattern","Pattern",uiState.preset)
            +uiOption("diag","Diag",uiState.preset)
            +uiOption("none","None",uiState.preset);

        var errorOptions=""
            +uiOption("accumulate","Accumulate",uiState.error)
            +uiOption("average","Average",uiState.error);

        var filterOptions=""
            +uiOption("box","Box",uiState.filter)
            +uiOption("gaussian","Gaussian",uiState.filter)
            +uiOption("hamming","Hamming",uiState.filter)
            +uiOption("blackman","Blackman",uiState.filter)
            +uiOption("bilinear","Bilinear",uiState.filter);

        var perceptualChecked=uiState.perceptual ? " checked" : "";
        var greyscaleChecked=uiState.greyscale ? " checked" : "";
        var histogramChecked=uiState.histogram ? " checked" : "";

        var rowStyle="height:21px;display:flex;align-items:center;gap:4px;";
        var headStyle="display:inline-block;width:28px;";
        var selectStyle="height:19px;font:11px monospace;padding:0px 1px;";
        var sliderStyle="width:68px;height:15px;padding:0;margin:0;";
        var valueStyle="display:inline-block;width:30px;font:10px monospace;text-align:right;";

        return ""
            +"<div class=toolbox id=\""+toolboxID+"\" hidden>"
            +" <div class=appbox style=\"box-sizing:border-box;text-align:left;height:76px;padding:3px 6px;display:flex;flex-direction:column;gap:2px;font-size:11px;white-space:nowrap;\">"

            +"  <div data-dither-row=\"DTH\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">DTH</b>"
            +"   <span>MODE</span>"
            +"   <select id=\""+controlID+"_mode\" title=\"Dithering mode\" onchange=\""+call+".deviceToolSetting('"+controlID+"','mode',this.value)\" style=\""+selectStyle+"\">"+modeOptions+"</select>"
            +"   <select id=\""+controlID+"_preset\" title=\"Error-diffusion preset\" onchange=\""+call+".deviceToolSetting('"+controlID+"','preset',this.value)\" style=\""+selectStyle+"\">"+presetOptions+"</select>"
            +"   <span>ERR</span>"
            +"   <select id=\""+controlID+"_error\" title=\"Incoming error handling\" onchange=\""+call+".deviceToolSetting('"+controlID+"','error',this.value)\" style=\""+selectStyle+"\">"+errorOptions+"</select>"
            +"   <span>OFFSET</span>"
            +"   <input id=\""+controlID+"_offset\" type=\"range\" min=\"0\" max=\"16\" step=\"1\" value=\""+uiState.offset+"\" title=\"Ordered offset\" oninput=\""+call+".deviceToolSetting('"+controlID+"','offset',this.value)\" style=\""+sliderStyle+"\">"
            +"   <span id=\""+controlID+"_offset_value\" style=\""+valueStyle+"\">"+uiState.offset+"</span>"
            +"  </div>"

            +"  <div data-dither-row=\"COL\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">COL</b>"
            +"   <label title=\"Use perceptual RGB colour matching\" style=\"display:flex;align-items:center;gap:2px;\">"
            +"    <input id=\""+controlID+"_perceptual\" type=\"checkbox\""+perceptualChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','perceptual',this.checked)\">Perceptual RGB"
            +"   </label>"
            +"   <span>LUMA</span>"
            +"   <input id=\""+controlID+"_luma\" type=\"range\" min=\"0\" max=\"500\" step=\"1\" value=\""+uiState.luma+"\" title=\"Luma emphasis\" oninput=\""+call+".deviceToolSetting('"+controlID+"','luma',this.value)\" style=\""+sliderStyle+"\">"
            +"   <span id=\""+controlID+"_luma_value\" style=\""+valueStyle+"\">"+uiState.luma+"%</span>"
            +"   <span>SHIFT</span>"
            +"   <input id=\""+controlID+"_shift\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\""+uiState.shift+"\" title=\"Maximum colour shift\" oninput=\""+call+".deviceToolSetting('"+controlID+"','shift',this.value)\" style=\""+sliderStyle+"\">"
            +"   <span id=\""+controlID+"_shift_value\" style=\""+valueStyle+"\">"+uiState.shift+"%</span>"
            +"  </div>"

            +"  <div data-dither-row=\"IMG\" style=\""+rowStyle+"\">"
            +"   <b style=\""+headStyle+"\">IMG</b>"
            +"   <label style=\"display:flex;align-items:center;gap:2px;\"><input id=\""+controlID+"_greyscale\" type=\"checkbox\""+greyscaleChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','greyscale',this.checked)\">Greyscale</label>"
            +"   <label style=\"display:flex;align-items:center;gap:2px;\"><input id=\""+controlID+"_histogram\" type=\"checkbox\""+histogramChecked+" onchange=\""+call+".deviceToolFlag('"+controlID+"','histogram',this.checked)\">Stretch histo</label>"
            +"   <span>GAMMA</span>"
            +"   <input id=\""+controlID+"_gamma\" type=\"range\" min=\"0\" max=\"500\" step=\"1\" value=\""+uiState.gamma+"\" title=\"Gamma\" oninput=\""+call+".deviceToolSetting('"+controlID+"','gamma',this.value)\" style=\""+sliderStyle+"\">"
            +"   <span id=\""+controlID+"_gamma_value\" style=\""+valueStyle+"\">"+uiState.gamma+"%</span>"
            +"   <span>FILTER</span>"
            +"   <select id=\""+controlID+"_filter\" title=\"Scaling filter\" onchange=\""+call+".deviceToolSetting('"+controlID+"','filter',this.value)\" style=\""+selectStyle+"\">"+filterOptions+"</select>"
            +"  </div>"

            +" </div>"
            +"</div>";
    };

    this.action={
        "SlotIO":{
             "RD":{"callback":function(addr,ctx){return card.readSlotIO(addr,ctx);}}
            ,"WR":{"callback":function(addr,d8,ctx){return card.writeSlotIO(addr,d8,ctx);}}
        }
    };

    this.reset=function()
    {
        card.state.threshold=0;
        card.state.captureEnabled=false;
        card.state.page2=false;
    };

    this.restart=this.reset;
}


// Discovery container. Apple2IO creates/mounts the live peripheral instance.
if(typeof(oEMU)==="undefined")
    var oEMU={"component":{"IO":{}}};
else
{
    if(!oEMU.component) oEMU.component={};
    if(!oEMU.component.IO) oEMU.component.IO={};
}
oEMU.component.IO.DithertizerII=new DithertizerII();
