// Host camera device shared by DITHER and DITHER2. Its video port publishes
// complete RGB24 frames; an owning card chooses the conversion and HGR format.
function DithertizerCameraDevice()
{
    var device=this;
    var owner=null;
    var stream=null;
    var video=null;
    var canvas=null;
    var context=null;
    var pending=null;
    var epoch=0;

    this.id={DCODE:"A2CAMERA",coID:"DithertizerCameraDevice",icon:"fa fa-camera"};
    this.ports={video:{
        mimeType:"video/x-raw;format=RGB24",
        read:function(options){return device.readFrame(options);}
    }};

    function releaseTracks(source)
    {
        if(!source || typeof(source.getTracks)!=="function") return;
        var tracks=source.getTracks();
        for(var i=0;i<tracks.length;i++)
            if(tracks[i] && typeof(tracks[i].stop)==="function") tracks[i].stop();
    }

    function releaseVideo(element)
    {
        if(!element) return;
        if(typeof(element.pause)==="function") element.pause();
        try { element.srcObject=null; } catch(e) {}
    }

    this.bindHost=function(host)
    {
        if(!host || !host.id || (host.id.PCODE!=="DITHER" && host.id.PCODE!=="DITHER2")) return false;
        if(owner && owner!==host) return false;
        owner=host;
        host.cameraDevice=device;
        return true;
    };

    this.unbindHost=function(host)
    {
        if(host && owner && owner!==host) return false;
        device.stop();
        if(owner && owner.cameraDevice===device) owner.cameraDevice=null;
        owner=null;
        return true;
    };

    this.isActive=function(){return !!stream;};
    this.isPending=function(){return !!pending;};

    this.start=function()
    {
        if(!owner) return Promise.resolve(false);
        if(stream) return Promise.resolve(true);
        if(pending) return pending;
        if(typeof(navigator)==="undefined" || !navigator || !navigator.mediaDevices ||
           typeof(navigator.mediaDevices.getUserMedia)!=="function") return Promise.resolve(false);

        var startEpoch=++epoch;
        pending=(async function()
        {
            var source=null,element=null;
            try
            {
                source=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
                if(startEpoch!==epoch || !owner)
                {
                    releaseTracks(source);
                    return false;
                }
                if(typeof(document)!=="undefined" && document && typeof(document.createElement)==="function")
                {
                    element=document.createElement("video");
                    canvas=document.createElement("canvas");
                    context=canvas && typeof(canvas.getContext)==="function" ? canvas.getContext("2d") : null;
                    if(element)
                    {
                        element.autoplay=true;
                        element.muted=true;
                        element.playsInline=true;
                        element.srcObject=source;
                        if(typeof(element.play)==="function") await element.play();
                    }
                }
                if(startEpoch!==epoch || !owner)
                {
                    releaseVideo(element);
                    releaseTracks(source);
                    return false;
                }
                video=element;
                stream=source;
                return true;
            }
            catch(error)
            {
                releaseVideo(element);
                releaseTracks(source);
                return false;
            }
            finally
            {
                if(startEpoch===epoch) pending=null;
            }
        })();
        return pending;
    };

    this.stop=function()
    {
        epoch++;
        pending=null;
        releaseVideo(video);
        video=null;
        canvas=null;
        context=null;
        releaseTracks(stream);
        stream=null;
    };
    this.reset=this.stop;

    this.readFrame=function(options)
    {
        if(!stream || !video || !canvas || !context) return null;
        var sourceW=Number(video.videoWidth)|0;
        var sourceH=Number(video.videoHeight)|0;
        if(sourceW<=0 || sourceH<=0) return null;
        options=options || {};
        var width=Number(options.width)|0 || sourceW;
        var height=Number(options.height)|0 || sourceH;
        if(width<=0 || height<=0) return null;
        if(canvas.width!==width) canvas.width=width;
        if(canvas.height!==height) canvas.height=height;
        context=canvas.getContext("2d");
        if(!context) return null;

        if(options.crop==="4:3")
        {
            var cropW=Math.min(sourceW,sourceH*4/3);
            var cropH=Math.min(sourceH,sourceW*3/4);
            context.drawImage(video,(sourceW-cropW)/2,(sourceH-cropH)/2,
                cropW,cropH,0,0,width,height);
        }
        else context.drawImage(video,0,0,sourceW,sourceH,0,0,width,height);

        var image=context.getImageData(0,0,width,height);
        var rgba=image && image.data;
        if(!rgba || rgba.length<width*height*4) return null;
        var rgb=new Uint8Array(width*height*3);
        for(var s=0,d=0;d<rgb.length;s+=4)
        {
            rgb[d++]=rgba[s];
            rgb[d++]=rgba[s+1];
            rgb[d++]=rgba[s+2];
        }
        return {mimeType:device.ports.video.mimeType,width:width,height:height,rgb:rgb};
    };
}
