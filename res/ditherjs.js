var DitherJS = function DitherJS(opt)
{
    this.init = function(opt)
    {
        if(this.opt===undefined || this.opt.FP_bits!=opt.FP_bits)
            delete this.f_palette;

        this.opt = opt || {};

        this.opt.step = opt.step || 1; // works better with 1,3,5,7
        this.opt.className = opt.className || 'dither';
        this.opt.algorithm = opt.algorithm || 'ordered';
        this.opt.palette = opt.palette || [
            [0,0,0],
            [255,0,255],
            [0,255,255],
            [255,255,255]
        ];
        this.palette = this.opt.palette;
    }

    this.init(opt);
    this.perf_disp = "";

    /**
     * Reload src image and put draw into it
     * */
    this._refreshDither = function(el)
    {
        // Reload src
        el.src = el.src //+ '?' + Math.random();
        //el.onload = function() { 

            var start_time = Date.now();
            this._dither(el);
            var d = Date.now()-start_time;
            this.perf_disp = "Microtime: "+d+"ms Buffer:"+Math.pow(1<<this.opt.FP_bits,3)/1024+"KB";

        //}
    };

    
    /**
    * This does all the dirty things
    * */
    this._dither = function(el)
    {
        /**
        * Return a distance of two colors ina three dimensional space
        * @param array
        * @param array
        * @return number
        * */
        this.colorDistance = function(a,b)
        {
            return Math.sqrt( 
                  (a[0] - b[0]) ** 2 
                + (a[1] - b[1]) ** 2 
                + (a[2] - b[2]) ** 2
            );  
        };

        this.approximateColor = function(color,palette,min)     // RECUSIVE TREE SEARCH
        {
            if(min===undefined) min = palette[0];
            var m = this.colorDistance(color,min) <= this.colorDistance(color,palette[1]) ? min : palette[1];
            return palette.length == 2 ? m:this.approximateColor(color,palette.slice(1),m);
        }
        
        this.approximateColor_fast = function(color)            // FAST LOOKUP
        {
            var idx = this.RGB2IDX(color,this.opt.FP_bits);
            var out = this.palette[ this.f_palette[idx] ]; 
            return out;
        }


        /**
        * Threshold function
        * */
        var threshold = function(value) {
            var result = value < 127 ? 0 : 255;
            return result;            
        };

        /**
        * Given an image element substitute it with a canvas
        * and return the context
        * @param node - the image element
        * @return context - drawing context
        * */
        this.getContext = function(el)
        {
            var canvas = document.createElement('canvas');
            // this can influence the quality of the acquistion
            canvas.height = el.clientHeight;
            canvas.width = el.clientWidth;
            el.parentNode.replaceChild(canvas,el);

            // Inherit classes
            canvas.className = el.className;
            canvas.className = canvas.className.replace(this.opt.className,' ');
            // Inherit Styles

            // Turn it off
            //canvas.style.visibility = "hidden";

            // Get the context
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            return ctx;    
        }

        
        /**
        * Perform an ordered dither on the image
        * */
        this.orderedDither = function(in_imgdata,w,h,step,ratio)
        {
            var out_imgdata = ctx.createImageData(in_imgdata);
            var d = new Uint8ClampedArray(in_imgdata.data);
            var step = (step-1)*2+1;
            var ratio = ratio + 3;

            var m = new Array(
                [  1,  9,  3, 11 ],
                [ 13,  5, 15,  7 ],
                [  4, 12,  2, 10 ],
                [ 16,  8, 14,  6 ]
            );

            var ms = 0;
            var i = m[0].length;
            while (i >>= 1) ms++;

            for (var y=0;y<h;y+=step)
            {
                for (var x=0;x<w;x+=step)
                {
                    var i = (x << ms) + (y*w << ms);
                    var inc = m[x&3][y&3] * ratio;
                    const increment = (el) => el + inc;
                    var rgb = d.slice(i,i+3).map(increment);

                    
                    if(this.opt.FP_enable)
                        var approx = this.approximateColor_fast(rgb,this.opt.palette);
                    else
                        var approx = this.approximateColor(rgb,this.opt.palette);

                    // Draw a block
                    var st = step<<2;
                    //console.log(i)
                    for (var dx=0;dx<st;dx+=4){
                        for (var dy=0;dy<st;dy+=4)
                        {
                            var di = i + dx + w * dy;

                            // Draw pixel
                            d[di++] = approx[0];
                            d[di++] = approx[1];
                            d[di]   = approx[2];
                        }
                    }
                }
            }
            out_imgdata.data.set(d);
            return out_imgdata;
        };  

        /**
        * Perform an error diffusion dither on the image
        * */
        this.errorDiffusionDither = function(in_imgdata,w,h,step,ratio)
        {
            // Create a new empty image
            var out_imgdata = ctx.createImageData(in_imgdata);
            var d = new Uint8ClampedArray(in_imgdata.data);
            var out = new Uint8ClampedArray(in_imgdata.data);
            // Step
            //var step = this.opt.step;
            // Ratio >=1
            //var ratio = this.opt.ratio?this.opt.ratio:1/16;
            var ratio = 0.02 + ratio / 150;

            for (var y=0;y<h;y += step)
            {
                for (var x=0;x<w;x += step)
                {
                    var i = (4*x) + (4*y*w);
                    
                    var $i = function(x,y) {
                        return (4*x) + (4*y*w);
                    };

                    // Define bytes
                    var r = i;
                    var g = i+1;
                    var b = i+2;
                    //var a = i+3;

                    var color = new Array(d[r],d[g],d[b]);
                    if(this.opt.FP_enable)
                        var approx = this.approximateColor_fast(color,this.opt.palette);
                    else
                        var approx = this.approximateColor(color,this.opt.palette);

                    var q = [];
                    q[r] = d[r] - approx[0];
                    q[g] = d[g] - approx[1];
                    q[b] = d[b] - approx[2];
                                     
                    // Diffuse the error
                    d[$i(x+step,y)] =  d[$i(x+step,y)] + 7 * ratio * q[r];
                    d[$i(x-step,y+1)] =  d[$i(x-1,y+step)] + 3 * ratio * q[r];
                    d[$i(x,y+step)] =  d[$i(x,y+step)] + 5 * ratio * q[r];
                    d[$i(x+step,y+step)] =  d[$i(x+1,y+step)] + 1 * ratio * q[r];

                    d[$i(x+step,y)+1] =  d[$i(x+step,y)+1] + 7 * ratio * q[g];
                    d[$i(x-step,y+step)+1] =  d[$i(x-step,y+step)+1] + 3 * ratio * q[g];
                    d[$i(x,y+step)+1] =  d[$i(x,y+step)+1] + 5 * ratio * q[g];
                    d[$i(x+step,y+step)+1] =  d[$i(x+step,y+step)+1] + 1 * ratio * q[g];

                    d[$i(x+step,y)+2] =  d[$i(x+step,y)+2] + 7 * ratio * q[b];
                    d[$i(x-step,y+step)+2] =  d[$i(x-step,y+step)+2] + 3 * ratio * q[b];
                    d[$i(x,y+step)+2] =  d[$i(x,y+step)+2] + 5 * ratio * q[b];
                    d[$i(x+step,y+step)+2] =  d[$i(x+step,y+step)+2] + 1 * ratio * q[b];

                    // Color
                    var tr = approx[0];
                    var tg = approx[1];
                    var tb = approx[2];

                    // Draw a block
                    for (var dx=0;dx<step;dx++)
                    {
                        for (var dy=0;dy<step;dy++)
                        {
                            var di = i + (4 * dx) + (4 * w * dy);
                            //out.push(approx[0],approx[1],approx[3]);
                            // Draw pixel
                            out[di] = tr;
                            out[di+1] = tg;
                            out[di+2] = tb;
                        }
                    }
                }
            }
            out_imgdata.data.set(out);
            return out_imgdata;
        };

        this.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
        this.getHexByte    = function(v) { return this.hextab[v>>4]+this.hextab[v&0xf] }
        this.HEX2RGB       = function(hex) { var n=parseInt(hex.slice(1),16); return [(n>>16)&0xFF,(n>>8)&0xFF,n&0xFF] }
        this.RGB2HEX       = function(color) { return [this.getHexByte(color[0]),this.getHexByte(color[1]),this.getHexByte(color[2])] }
        this.RGB2IDX       = function(color,sig_bits)
        {
            const msk = (1<<sig_bits)-1, scl = (8-sig_bits);
            return (((color[2]>>scl)&msk)<<sig_bits<<sig_bits) | (((color[1]>>scl)&msk)<<sig_bits) | ((color[0]>>scl)&msk)
        }  
        this.IDX2RGB       = function(idx,sig_bits)
        {
            const msk = (1<<sig_bits)-1, scl = (8-sig_bits);
            return [(idx & msk)<<scl,((idx>>sig_bits) & msk)<<scl,((idx>>sig_bits>>sig_bits) & msk)<<scl];
        }

        //************************
        // Main Dithering function
        //************************

        // BUILD FAST PALETTE
        this.fast_palette = function()
        {
            if(this.f_palette===undefined)
            {
                const FPbits = this.opt.FP_bits;

                console.log("3D matrix size = "+Math.pow(1<<FPbits,3)+" ("+Math.pow(1<<FPbits,3)/1024+"KB)" )
                const lku_prec = 1<<FPbits;
                this.palette_idx = new Array(this.palette.length);
                for(var i=this.palette.length-1;i>=0;i--) this.palette_idx[ this.RGB2HEX(this.palette[i]).join("") ] = i;
                this.f_palette = new Uint8ClampedArray( lku_prec * lku_prec * lku_prec );
                for(var i=this.f_palette.length-1;i>=0;i--)
                {
                    var approx = this.approximateColor(this.IDX2RGB(i,FPbits),this.palette);
                    this.f_palette[i] = this.palette_idx[oCOM.RGB2HEX(approx).join("")];
                }
            }
        }

        this.fast_palette();

        // Take image size
        var h = el.clientHeight;
        var w = el.clientWidth;
        var ctx = this.getContext(el);
        
        // Put the picture in
        ctx.drawImage(el,0,0,w,h);
        
        // Pick image data
        var in_image = ctx.getImageData(0,0,w,h);
        var ditherCtx = this;

        var step = this.opt.step===undefined?1:this.opt.step;
        var ratio = this.opt.ratio===undefined?7:this.opt.ratio;
        switch(this.opt.algorithm)
        {
            case 'errorDiffusion':  var out_image = ditherCtx.errorDiffusionDither(in_image,w,h,step,ratio); break;
            case 'ordered':         var out_image = ditherCtx.orderedDither(in_image,w,h,step,ratio); break;
            default: new Error('Not a valid algorithm');
        }

        // Put image data
        ctx.putImageData(out_image,0,0);
    }
};



