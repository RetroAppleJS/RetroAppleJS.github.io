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
