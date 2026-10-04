// Completed NTSC beam frames. No browser timer or CPU runner is owned here.
function Apple2RasterCapture(fetch,present,startTick)
{
    var cursor=Math.ceil(startTick)-1, bytes=new Uint8Array(7680), modes=new Uint8Array(7680);
    var count=0, startFrame=Math.floor(startTick/17030), completed=0;
    this.advanceTo=function(tick,inclusive)
    {
        var end=inclusive===false ? Math.ceil(tick)-1 : Math.floor(tick);
        while(cursor<end)
        {
            var t=++cursor, phase=((t%17030)+17030)%17030;
            if(phase===0) { count=0; startFrame=Math.floor(t/17030); }
            if(phase===12480)
            {
                if(count===7680)
                {
                    present({bytes:bytes,modes:modes,endTick:t,frame:startFrame,sequence:++completed});
                    bytes=new Uint8Array(7680); modes=new Uint8Array(7680);
                }
                count=0;
            }
            var h=phase%65, y=Math.floor(phase/65);
            if(y<192 && h>=25)
            {
                var sample=fetch(t,y,h-25), i=y*40+h-25;
                bytes[i]=sample&255; modes[i]=sample>>8; count++;
            }
        }
    };
    this.stats=function(){return {capturedThrough:cursor,visibleSamples:count,completed:completed};};
}

// GPU.js graphical kernel: immutable per-beam byte/mode planes, never live RAM.
function Apple2RasterKernel(bytes,modes,rom,pal,chrome,flash)
{
    var xp=Math.floor(this.thread.x/this.constants.scale);
    var y=191-Math.floor(this.thread.y/this.constants.scale);
    var col=Math.floor(xp/7), bit=xp-col*7, i=y*40+col;
    var d=bytes[i], mode=modes[i], cp=chrome*4;
    if(mode===2)
    {
        var left=0, right=0;
        if(col>0 && modes[i-1]===2) left=bytes[i-1];
        if(col<39 && modes[i+1]===2) right=bytes[i+1];
        var bits=((right&127)<<8)|((d&127)<<1)|((left>>6)&1);
        var b3=(bits>>bit)&7, d1=(0b100100>>b3)&1, d2=(0b11001000>>b3)&1;
        var dl=(1+((((xp^b3)<<1)&2)|(((xp^b3)&1)^(d>>7))))&((d1<<4)-d1);
        cp+=((dl+(dl<<1))|((d2<<4)-d2))<<4;
    }
    else if(mode===1) cp+=((d>>((y>>2&1)*4))&15)<<4;
    else
    {
        var glyph=rom[(((d&63)^32)*8)+(y&7)], attr=d>>6;
        var on=((glyph>>bit)&1)^((1>>attr)&1)^((2>>attr)&flash);
        cp+=on*240;
    }
    this.color(pal[cp]/256,pal[cp+1]/256,pal[cp+2]/256,1);
}

function Apple2RasterCreateKernel(gpu,scale)
{
    return gpu.createKernel(Apple2RasterKernel,{output:[280*scale,192*scale],
        constants:{scale:scale},graphical:true});
}
