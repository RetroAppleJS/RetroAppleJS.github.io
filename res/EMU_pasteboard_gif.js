/*
 * PASTEBOARD GIF — renderer-independent Apple II graphics recorder.
 *
 * Captures compact visible video RAM for TEXT, GR, HGR and mixed displays,
 * on either page. Explicit raw graphics-page snapshots remain supported.
 * Frame payloads are raw or zero-run-length encoded XOR deltas. GIF pixels,
 * LZW and a downloadable Blob are created only on explicit export.
 * No browser canvas and no additional timer/Worker are required.
 */
(function(root,factory) {
    "use strict";
    var api=factory();
    if(typeof module==="object" && module.exports)module.exports=api;
    if(root)root.EMU_PASTEBOARD_GIF=api;
})(typeof window!=="undefined" ? window : (typeof globalThis!=="undefined" ? globalThis : null),function() {
    "use strict";

    var WIDTH=280, HEIGHT=192, MAX_FRAMES=2000, MAX_STORAGE=16*1024*1024;
    var MODES={
        TEXT:{base:0x0400,size:0x0400,visible:960,text:true},
        TEXT2:{base:0x0800,size:0x0400,visible:960,text:true},
        GR:{base:0x0400,size:0x0400,visible:960,hires:false},
        GR2:{base:0x0800,size:0x0400,visible:960,hires:false},
        GRMIX:{base:0x0400,size:0x0400,visible:960,hires:false,mix:true},
        GR2MIX:{base:0x0800,size:0x0400,visible:960,hires:false,mix:true},
        HGR:{base:0x2000,size:0x2000,visible:7680,hires:true},
        HGR2:{base:0x4000,size:0x2000,visible:7680,hires:true},
        // 160 visible HGR scanlines plus four text rows (6400 + 160 bytes).
        HGRMIX:{base:0x2000,size:0x2000,visible:6560,hires:true,mix:true,textBase:0x0400},
        HGR2MIX:{base:0x4000,size:0x2000,visible:6560,hires:true,mix:true,textBase:0x0800}
    };
    // The base RGB triples used by the emulator Canvas video INTCols table.
    // The HGR phase/neighbor index is computed with its hgr_PixelColor formula.
    var COLORS=[
        [0x00,0x00,0x00],[0x90,0x17,0x40],[0x40,0x2c,0xa5],[0xd0,0x43,0xe5],
        [0x00,0x69,0x40],[0x80,0x80,0x80],[0x2f,0x95,0xe5],[0xbf,0xab,0xff],
        [0x40,0x54,0x00],[0xd0,0x6a,0x1a],[0x80,0x80,0x80],[0xff,0x96,0xbf],
        [0x2f,0xbc,0x1a],[0xbf,0xd3,0x5a],[0x6f,0xe8,0xbf],[0xff,0xff,0xff]
    ];
    var PALETTE=new Uint8Array(COLORS.flat());

    function modeInfo(mode) {
        var id=String(mode || "").toUpperCase();
        if(!Object.prototype.hasOwnProperty.call(MODES,id))
            throw new RangeError("Unknown Apple II video mode: "+id);
        return {id:id,...MODES[id]};
    }

    function textRowOffset(row) {
        return ((row&7)<<7)+((row&0x18)*5);
    }
    function hiresRowOffset(y) {
        return ((y&7)<<10)+((y&0x38)<<4)+((y&0xc0)>>1)+((y&0xc0)>>3);
    }

    function visibleBytes(mode,page,textPage) {
        var spec=modeInfo(mode);
        if(!(page instanceof Uint8Array) || page.length<spec.size)
            throw new RangeError(spec.id+" requires a "+spec.size+"-byte RAM page.");
        if(spec.textBase && (!(textPage instanceof Uint8Array) || textPage.length<1024))
            throw new RangeError(spec.id+" requires a separate 1024-byte text page.");
        var output=new Uint8Array(spec.visible);
        var rows=spec.hires?(spec.mix?160:192):24;
        for(var row=0;row<rows;row++) {
            var offset=spec.hires?hiresRowOffset(row):textRowOffset(row);
            output.set(page.subarray(offset,offset+40),row*40);
        }
        if(spec.textBase) {
            for(var textRow=20;textRow<24;textRow++) {
                var offset=textRowOffset(textRow);
                output.set(textPage.subarray(offset,offset+40),6400+(textRow-20)*40);
            }
        }
        return output;
    }

    function same(a,b) {
        if(!a || !b || a.length!==b.length)return false;
        for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;
        return true;
    }

    // The high-bit tokens represent consecutive XOR zero bytes; the low-bit
    // tokens represent up to 128 nonzero literal bytes. Both are bounded.
    function zeroRLE(bytes) {
        var out=[];
        for(var i=0;i<bytes.length;) {
            var length=1;
            if(bytes[i]===0) {
                while(length<128 && i+length<bytes.length && bytes[i+length]===0)
                    length++;
                out.push(0x80|(length-1));
            } else {
                while(length<128 && i+length<bytes.length && bytes[i+length]!==0)
                    length++;
                out.push(length-1);
                for(var j=0;j<length;j++)out.push(bytes[i+j]);
            }
            i+=length;
        }
        return Uint8Array.from(out);
    }
    function decodeZeroRLE(encoded,length) {
        var out=new Uint8Array(length),src=0,dst=0;
        while(src<encoded.length) {
            var token=encoded[src++],n=(token&0x7f)+1;
            if(dst+n>length)throw new Error("Corrupt RLE: output exceeds frame.");
            if((token&0x80)===0) {
                if(src+n>encoded.length)throw new Error("Corrupt RLE: short literal.");
                out.set(encoded.subarray(src,src+n),dst);
                src+=n;
            }
            dst+=n;
        }
        if(dst!==length)throw new Error("Corrupt RLE: incomplete frame.");
        return out;
    }
    function deltaEncode(bytes,prior) {
        var x=new Uint8Array(bytes.length);
        for(var i=0;i<bytes.length;i++)x[i]=bytes[i]^(prior?prior[i]:0);
        var packed=zeroRLE(x);
        return packed.length<bytes.length
            ? {encoding:"xrle",data:packed}
            : {encoding:"raw",data:bytes.slice()};
    }

    // Mirrors EMU_DEVICE_video_canvas.js text_Draw and hgr_PixelColor.
    // The ROM is borrowed from the live video MUX; no canvas is sampled.
    function drawTextRow(pixels,row,bytes,offset,style) {
        var rom=style && style.font;
        if(!rom || !ArrayBuffer.isView(rom) || rom.BYTES_PER_ELEMENT!==1)
            throw new Error("Text GIF export needs the active Apple II character ROM.");
        var jplus=style.romKey==="A2_JP",flash=!!style.flashOn;
        for(var col=0;col<40;col++) {
            var code=bytes[offset+col],index;
            if(jplus) {
                var mapped=code;
                if(mapped>=0x40 && mapped<0x80)mapped&=0x3f;
                index=style.annunciator2!==false?(mapped|0x80):mapped;
            } else index=(code&0x3f)^0x20;
            for(var yy=0;yy<8;yy++) {
                var bits=rom[index*8+yy]||0;
                if((code&0xc0)===0 || ((code&0xc0)===0x40 && flash))
                    bits^=0xff;
                var base=(row*8+yy)*WIDTH+col*7;
                for(var xx=0;xx<7;xx++)
                    pixels[base+xx]=(bits&(1<<(jplus?6-xx:xx)))?15:0;
            }
        }
    }

    function render(mode,bytes,style) {
        var spec=modeInfo(mode);
        if(bytes.length!==spec.visible)
            throw new RangeError("Incorrect visible byte count for "+spec.id);
        var pixels=new Uint8Array(WIDTH*HEIGHT);
        if(spec.text) {
            for(var textRow=0;textRow<24;textRow++)
                drawTextRow(pixels,textRow,bytes,textRow*40,style);
            return pixels;
        }
        if(!spec.hires) {
            for(var row=0;row<(spec.mix?20:24);row++) {
                for(var col=0;col<40;col++) {
                    var value=bytes[row*40+col];
                    for(var half=0;half<2;half++) {
                        var color=half ? value>>4 : value&15;
                        for(var yy=0;yy<4;yy++) {
                            var begin=(row*8+half*4+yy)*WIDTH+col*7;
                            pixels.fill(color,begin,begin+7);
                        }
                    }
                }
            }
        } else {
            // The same HGR phase-and-neighbor calculation as the canvas
            // renderer, with 280 indexed pixels rather than a 560px canvas.
            for(var y=0;y<(spec.mix?160:HEIGHT);y++) {
                var off=y*40,dst=y*WIDTH;
                for(var x=0;x<WIDTH;x++) {
                    var col=(x/7)|0,bit=x%7,value=bytes[off+col];
                    var m=(value>>bit)&1;
                    var l=bit ? (value>>(bit-1))&1 :
                        (col ? (bytes[off+col-1]>>6)&1 : 0);
                    var r=bit<6 ? (value>>(bit+1))&1 :
                        (col<39 ? bytes[off+col+1]&1 : 0);
                    var b=(x<<4)|(l<<3)|(((m<<2)|(m<<1))&4)|
                        (((r<<1)|(r>>1))&2)|((value&128)>>7);
                    // Canvas hgr_PixelColor produces six color IDs (0..5).
                    // Their RGB entries in the shared 16-color INTCols table
                    // are 0,3,6,9,12,15 -- not 0,1,2,3,4,5.
                    // In particular, HGR 5 is white, not lores grey.
                    var hgrColor=(0xf4e0f8d0>>>b&1)|
                        (0x08200820>>>(b-1)&2)|
                        (0xf0d0f4c0>>>(b-2)&4);
                    pixels[dst+x]=hgrColor*3;
                }
            }
        }
        if(spec.mix) {
            for(var row=20;row<24;row++) {
                var offset=spec.hires ? 6400+(row-20)*40 : row*40;
                drawTextRow(pixels,row,bytes,offset,style);
            }
        }
        return pixels;
    }

    function gifLZW(pixels) {
        var clear=16,stop=17,next=18,bits=5;
        var dict=new Map(),out=[],bitStore=0,bitCount=0;
        function emit(code) {
            bitStore|=code<<bitCount;
            bitCount+=bits;
            while(bitCount>=8) {
                out.push(bitStore&255);
                bitStore>>>=8;
                bitCount-=8;
            }
        }
        emit(clear);
        if(pixels.length) {
            var prefix=pixels[0];
            for(var i=1;i<pixels.length;i++) {
                var key=(prefix<<4)|pixels[i];
                if(dict.has(key)) {
                    prefix=dict.get(key);
                    continue;
                }
                emit(prefix);
                if(next<4096) {
                    dict.set(key,next++);
                    // GIF decoders are one dictionary insertion behind
                    // the encoder at the point where a code is emitted.
                    if(next>(1<<bits) && bits<12)bits++;
                } else {
                    emit(clear);
                    dict.clear();
                    next=18;
                    bits=5;
                }
                prefix=pixels[i];
            }
            emit(prefix);
        }
        emit(stop);
        if(bitCount>0)out.push(bitStore&255);
        return Uint8Array.from(out);
    }

    function encodeGif(frames,options) {
        if(!frames.length)throw new Error("No graphics frames have been captured.");
        options=options||{};
        var animated=options.animated!==false;
        var loop=options.loop===undefined ? 0 : options.loop;
        if(!Number.isInteger(loop)||loop<0||loop>65535)
            throw new RangeError("GIF loop count must be 0–65535.");
        var lastDelay=options.lastDelayMs===undefined?100:options.lastDelayMs;
        if(!Number.isFinite(lastDelay)||lastDelay<20||lastDelay>655350)
            throw new RangeError("lastDelayMs must be 20–655350.");
        var fixedDelay=options.frameDelayMs;
        if(fixedDelay!==undefined &&
           (!Number.isFinite(fixedDelay)||fixedDelay<20||fixedDelay>655350))
            throw new RangeError("frameDelayMs must be 20–655350.");
        var out=[];
        function u16(n){out.push(n&255,(n>>8)&255);}
        function chars(s){for(var i=0;i<s.length;i++)out.push(s.charCodeAt(i));}
        chars("GIF89a");
        u16(WIDTH);u16(HEIGHT);
        out.push(0xf3,0,0); // 16 global RGB palette entries
        for(var p=0;p<PALETTE.length;p++)out.push(PALETTE[p]);
        if(animated) {
            out.push(0x21,0xff,11);
            chars("NETSCAPE2.0");
            out.push(3,1,loop&255,loop>>8,0);
        }
        for(var fi=0;fi<frames.length;fi++) {
            var current=frames[fi],next=frames[fi+1];
            var delay=fixedDelay===undefined
                ? (next ? next.timestamp-current.timestamp : lastDelay)
                : fixedDelay;
            var cs=Math.min(65535,Math.max(2,Math.round(Math.max(20,delay)/10)));
            out.push(0x21,0xf9,4,4);
            u16(cs);out.push(0,0); // disposal=1, no transparency
            out.push(0x2c);
            u16(0);u16(0);u16(WIDTH);u16(HEIGHT);
            out.push(0,4); // no local palette; min LZW code size 4
            var lzw=gifLZW(render(current.mode,current.bytes,current.style));
            for(var start=0;start<lzw.length;start+=255) {
                var end=Math.min(lzw.length,start+255);
                out.push(end-start);
                for(var j=start;j<end;j++)out.push(lzw[j]);
            }
            out.push(0); // end of image sub-blocks
        }
        out.push(0x3b);
        return Uint8Array.from(out);
    }

    function Recorder(options) {
        options=options||{};
        var now=typeof options.now==="function"?options.now:Date.now;
        var frames=[],stored=0,lastRaw=null,lastMode=null,lastStyleKey=null;
        function last(){return frames.length?frames[frames.length-1]:null;}
        this.clear=function() {
            frames=[];stored=0;lastRaw=null;lastMode=null;lastStyleKey=null;
            return true;
        };
        this.status=function() {
            return {
                frames:frames.length,storedBytes:stored,
                maxFrames:MAX_FRAMES,maxBytes:MAX_STORAGE,
                lastMode:lastMode,
                lastTimestamp:last()?last().timestamp:null
            };
        };
        this.changed=function(mode,bytes,style) {
            var spec=modeInfo(mode);
            if(!(bytes instanceof Uint8Array)||bytes.length!==spec.visible)
                throw new RangeError("Invalid compact graphics frame for "+spec.id);
            return lastMode!==spec.id || !same(lastRaw,bytes) ||
                lastStyleKey!==(style && style.key || null);
        };
        this.capture=function(mode,bytes,options) {
            options=options||{};
            var spec=modeInfo(mode);
            if(!(bytes instanceof Uint8Array)||bytes.length!==spec.visible)
                throw new RangeError("Invalid compact graphics frame for "+spec.id);
            var changed=this.changed(spec.id,bytes,options.style);
            if(options.changedOnly!==false && !changed)
                return {captured:false,changed:false,frames:frames.length,
                    storedBytes:stored,mode:spec.id};
            if(frames.length>=MAX_FRAMES)
                throw new RangeError("Graphics recording exceeded "+MAX_FRAMES+" frames.");
            var prior=lastMode===spec.id?lastRaw:null;
            var enc=deltaEncode(bytes,prior);
            if(stored+enc.data.length>MAX_STORAGE)
                throw new RangeError("Graphics recording exceeded 16 MiB compressed storage.");
            var stamp=options.timestampMs===undefined?now():options.timestampMs;
            if(!Number.isFinite(stamp)||stamp<0)
                throw new RangeError("Invalid frame timestamp.");
            stamp=Math.max(last()?last().timestamp:0,stamp);
            frames.push({mode:spec.id,encoding:enc.encoding,
                data:enc.data,timestamp:stamp,style:options.style||null});
            stored+=enc.data.length;
            lastRaw=bytes.slice(); lastMode=spec.id;
            lastStyleKey=options.style && options.style.key || null;
            return {captured:true,changed:changed,frames:frames.length,
                storedBytes:stored,mode:spec.id,encoding:enc.encoding};
        };
        function selectedFrames(animated,index) {
            if(!frames.length)throw new Error("No graphics frames captured.");
            var lo=0,hi=frames.length;
            if(!animated) {
                var n=index===undefined||index==="last"?frames.length-1:index;
                if(!Number.isInteger(n)||n<0||n>=frames.length)
                    throw new RangeError("GIF frame index out of range.");
                hi=n+1;
            }
            var previous=null,previousMode=null,selected=[];
            for(var i=0;i<hi;i++) {
                var frame=frames[i],base=previousMode===frame.mode?previous:null,raw;
                if(frame.encoding==="raw")raw=frame.data.slice();
                else if(frame.encoding==="xrle") {
                    var delta=decodeZeroRLE(frame.data,MODES[frame.mode].visible);
                    raw=new Uint8Array(delta.length);
                    for(var j=0;j<raw.length;j++)
                        raw[j]=delta[j]^(base?base[j]:0);
                } else throw new Error("Unknown graphics frame encoding.");
                if(animated || i===hi-1)
                    selected.push({mode:frame.mode,bytes:raw,timestamp:frame.timestamp,
                        style:frame.style});
                previous=raw;previousMode=frame.mode;
            }
            return selected;
        }
        this.gif=function(options) {
            options=options||{};
            var animated=options.animated!==false;
            var list=selectedFrames(animated,options.index);
            var bytes=encodeGif(list,{
                animated:animated,loop:options.loop,
                frameDelayMs:options.frameDelayMs,
                lastDelayMs:options.lastDelayMs
            });
            return {bytes:bytes,frameCount:list.length,
                width:WIDTH,height:HEIGHT,mime:"image/gif"};
        };
    }
    return {
        Recorder:Recorder,visibleBytes:visibleBytes,render:render,
        gifLZW:gifLZW,encodeGif:encodeGif,zeroRLE:zeroRLE,
        decodeZeroRLE:decodeZeroRLE,modes:Object.freeze(MODES),
        width:WIDTH,height:HEIGHT
    };
});
