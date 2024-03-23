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
        el.src = el.src 
        var start_time = Date.now();
        this._dither(el);
        var d = Date.now()-start_time;
        this.perf_disp = "Microtime: "+d+"ms Buffer:"+Math.pow(1<<this.opt.FP_bits,3)/1024+"KB";
    };

    /**
    * This does all the dirty things
    * */
    this._dither = function(el)
    {
        this.colorDistance = function(a,b)
        {
            var sq = Math.round(Math.sqrt( 
                (a[0] - b[0]) ** 2 
              + (a[1] - b[1]) ** 2 
              + (a[2] - b[2]) ** 2
          ));
            //console.log(a+" "+b+" "+sq)
            return sq
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
            return this.palette[ this.f_palette[idx] ]; 
        }

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
            var d = new Uint8ClampedArray(in_imgdata.data);
            var step = (step-1)*2+1;
            var ratio = ratio + 3;

            const m = Array(
                [  1,  9,  3, 11 ],
                [ 13,  5, 15,  7 ],
                [  4, 12,  2, 10 ],
                [ 16,  8, 14,  6 ]
            );
            var ml = m[0].length;

            var ms = 0;
            while (ml>>=1) ms++;   // number significant bits in column count
            
            for (var y=0;y<h;y+=step)
            {
                for (var x=0;x<w;x+=step)
                {
                    var i = (x + y*w) << ms;
                    var inc = m[x&3][y&3] * ratio;
                    const increment = (el) => el + inc;
                    var rgb = d.slice(i,i+3).map(increment);

                    if(this.opt.FP_enable)
                        var approx = this.approximateColor_fast(rgb,this.opt.palette);
                    else
                        var approx = this.approximateColor(rgb,this.opt.palette);

                    // Draw a block
                    this.image_block(d,approx,i,step);
                }
            }
            return this.image_out(d,in_imgdata)
        }

        /**
        * Perform an error diffusion dither on the image
        * */
        this.errorDiffusionDither = function(in_imgdata,w,h,step,ratio)
        {
            var d = new Uint8ClampedArray(in_imgdata.data);
            const m = new Uint8ClampedArray([7,3,5,1]);
            var ml = m.length;
            var q = new Array(3*ml);
            
            ms = 0;
            while (ml>>=1) ms++;   // multipication substitute by shift left 
            var ratio = 0.02 + ratio / 150;

            let $i = function(x,y)
            {
                var out = (x + y*w) << ms;
                return out;
            }

            for (var y=0;y<h;y += step)
            {
                for (var x=0;x<w;x += step)
                {
                    var i = $i(x,y);
                    var rgb = d.slice(i,i+3);
                    if(this.opt.FP_enable)
                        var approx = this.approximateColor_fast(rgb,this.opt.palette);
                    else
                        var approx = this.approximateColor(rgb,this.opt.palette);

                    // calculate the error
                    rgb.map((val,index) => 
                    {
                        var i = index<<2;
                        q[i]   = m[0] * (val - approx[index])*ratio
                        q[i+1] = m[1] * (val - approx[index])*ratio
                        q[i+2] = m[2] * (val - approx[index])*ratio
                        q[i+3] = m[3] * (val - approx[index])*ratio
                    });
                    //this.minmax(q);
                                     
                    // Diffuse the error
                    d[$i(x+step,y)] =  d[$i(x+step,y)] + q[0];
                    d[$i(x-step,y+1)] =  d[$i(x-1,y+step)] + q[1];
                    d[$i(x,y+step)] =  d[$i(x,y+step)] + q[2];
                    d[$i(x+step,y+step)] =  d[$i(x+1,y+step)] + q[3];

                    d[$i(x+step,y)+1] =  d[$i(x+step,y)+1] + q[4];
                    d[$i(x-step,y+step)+1] =  d[$i(x-step,y+step)+1] + q[5];
                    d[$i(x,y+step)+1] =  d[$i(x,y+step)+1] + q[6];
                    d[$i(x+step,y+step)+1] =  d[$i(x+step,y+step)+1] + q[7];

                    d[$i(x+step,y)+2] =  d[$i(x+step,y)+2] + q[8];
                    d[$i(x-step,y+step)+2] =  d[$i(x-step,y+step)+2] + q[9];
                    d[$i(x,y+step)+2] =  d[$i(x,y+step)+2] + q[10];
                    d[$i(x+step,y+step)+2] =  d[$i(x+step,y+step)+2] + q[11];

                    this.image_block(d,approx,i,step);
                }
            }
            //console.log(this.minmax_v[0]+" "+this.minmax_v[1])
            return this.image_out(d,in_imgdata)
        };

        this.image_block = function(d,approx,i,step)
        {
            for (var dx=(step*step)-1;dx>=0;dx--)
            {
                var di = i + ((dx + Math.floor(dx/step) *(w-step)) << 2);
                d[di]   = approx[0];
                d[di+1] = approx[1];
                d[di+2] = approx[2];
            }
        }

        this.image_out = function(img_d,img_i)  // overridable
        {
            var out_imgdata = ctx.createImageData(img_i);
            out_imgdata.data.set(img_d);
            return out_imgdata;
        }

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

        this.minmax_v = [0,0]
        this.minmax = function(arr)
        {
            for(var i=arr.length-1;i>=0;i--)
            {
                if(arr[i]>this.minmax_v[1]) this.minmax_v[1]=arr[i];
                if(arr[i]<this.minmax_v[0]) this.minmax_v[0]=arr[i];
            }
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
        
        // Put the picture in ctx
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