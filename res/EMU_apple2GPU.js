//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2GPU.js

//oEMU.component.Video["A2P"] = {Apple2Video};
if(oEMU===undefined) var oEMU = {"component":{"Video":{"Apple2Video":new Apple2Video()}}}
else oEMU.component.Video.Apple2Video = new Apple2Video();

function Apple2Video(ctx)
{
    var gfx_mode;
    var mix_mode;
    var page2_mode;
    var hires_mode;
    var chrome_mode;
    var flash_on = true; // boolean toggled 6 hz or so.
    var flash_count = 0;
    var redraw = false;
    var fps    = 20;
    var dim    = [0,0];


    this.vidram = null; // apple2hw.js sets this to give me reference to ram

    this.reset = function() {
        gfx_mode = false;
        mix_mode = false;
        page2_mode = false;
        hires_mode = false;
        chrome_mode = 0;
        flash_on = true;
        flash_count = 0;

        frame_redraw = true;
        frame_count = 0;

        this.register_mode();

        vidContext          = document.getElementById('applescreen');
        kernel = gpu.createKernel(
            kProcess_v6,
             {
               //useLegacyEncoder: true,
               output: [560, 384],
               graphical: true
             }
           )
    }

    //GFX_HIRES/LORES GFX_PAGE1/2  << GFX_PAGE1/2 << GFX_MIX_ON/OFF << GFX_ON/OFF  (1/0)

    this.register_mode = function()
    {
        this.modes = {"gfx":gfx_mode,"mix":mix_mode,"page2":page2_mode,"hires":hires_mode,"chrome":chrome_mode};
        var ret = (gfx_mode?2:1) + (mix_mode?8:4) + (page2_mode?32:16) + (hires_mode?128:64);
        //alert(oCOM.getBinMulti(ret,8))
        return ret
    }

    // _o.CPU_ClockTicks = cycles per frame refresh
    this.cycle = function()
    {
        if (++flash_count > 250000)
        {
            flash_on = ! flash_on;
            flash_count = 0;
            this.redraw();
        }

        if(++frame_count > _o.CPU_ClockTicks && frame_redraw==true)
            this.redraw();  
    }

    this.setGfx = function(flag)
    {
        if (gfx_mode != flag) {
            gfx_mode = flag;
            frame_redraw = true;
        }
    }

    this.setMix = function(flag) {
        if (mix_mode != flag) {
            mix_mode = flag;
            frame_redraw = true;
        }
    }

    this.setPage2 = function(flag) {
        if (page2_mode != flag) {
            page2_mode = flag;
            frame_redraw = true;
        }
    }

    this.setHires = function(flag) {
        if (hires_mode != flag) {
            hires_mode = flag;
            frame_redraw = true;
        }
    }

    this.setMonitor = function(mode) {
        chrome_mode = mode & 3;
        frame_redraw = true;
        return {
             "color": _CFG_CHROMA[chrome_mode].COL_num?_CFG_CHROMA[chrome_mode].COL_num:"#000000"
            ,"name": _CFG_CHROMA[chrome_mode].COL_name
        };
    }

    this.getloresCols = function() {
        return loresCols;
    }

    this.gethiresCols = function() {
        return hiresCols;
    }

    this.setCol = function(idx,column,val) {
        return loresCols[idx][column] = val;
    }


    const INTCols = new Uint8Array([
        0X00,0X00,0X00,0X0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0  // Black
       ,0X90,0X17,0X40,0X0,0x4D,0x4D,0x4D,0x0,0x30,0x4D,0x48,0x0,0x4C,0x46,0x31,0x0  // Magenta
       ,0X40,0X2C,0XA5,0X0,0x5B,0x5B,0x5B,0x0,0x39,0x5B,0x56,0x0,0x5A,0x52,0x39,0x0  // Dark Blue
       ,0XD0,0X43,0XE5,0X0,0xA8,0xA8,0xA8,0x0,0x69,0xA8,0x9E,0x0,0xA6,0x98,0x6A,0x0  // Purple
       ,0X00,0X69,0X40,0X0,0x38,0x38,0x38,0x0,0x23,0x38,0x35,0x0,0x38,0x33,0x24,0x0  // Dark Green
       ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 1
       ,0X2F,0X95,0XE5,0X0,0x8E,0x8E,0x8E,0x0,0x59,0x8E,0x85,0x0,0x8C,0x80,0x59,0x0  // Medium Blue
       ,0XBF,0XAB,0XFF,0X0,0xCE,0xCE,0xCE,0x0,0x81,0xCE,0xC2,0x0,0xCB,0xBA,0x82,0x0  // Light Blue
       ,0X40,0X54,0X00,0X0,0x31,0x31,0x31,0x0,0x1F,0x31,0x2E,0x0,0x31,0x2D,0x1F,0x0  // Brown
       ,0XD0,0X6A,0X1A,0X0,0x71,0x71,0x71,0x0,0x47,0x71,0x6B,0x0,0x70,0x67,0x48,0x0  // Orange
       ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 2
       ,0XFF,0X96,0XBF,0X0,0xC7,0xC7,0xC7,0x0,0x7D,0xC7,0xBB,0x0,0xC4,0xB4,0x7D,0x0  // Pink
       ,0X2F,0XBC,0X1A,0X0,0x57,0x57,0x57,0x0,0x37,0x57,0x52,0x0,0x56,0x4F,0x37,0x0  // Light Green
       ,0XBF,0XD3,0X5A,0X0,0xA4,0xA4,0xA4,0x0,0x67,0xA4,0x9A,0x0,0xA2,0x95,0x68,0x0  // Yellow  
       ,0X6F,0XE8,0XBF,0X0,0xB2,0xB2,0xB2,0x0,0x70,0xB2,0xA8,0x0,0xB0,0xA1,0x70,0x0  // Aquamarine
       ,0XFF,0XFF,0XFF,0X0,0xFF,0xFF,0xFF,0x0,0xA0,0xFF,0xF0,0x0,0xFC,0xE7,0xA1,0x0  // White
       ]);

    function initGPU(arg)
    {
        try {
            return new window.GPU.GPU(arg);
        } catch (e) {
            return new GPU(arg);
        }
    }

    // Draw a text character from character ROM.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function text_Draw(col, row, d8)
    {

    }

    // Redraw a lores two pixel block.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function lores_Draw(col, row, d8) {
        
    }

    this.hgr_PixelColor = function(x, y, left, me, right, b7) {
        var a0 = x & 0x01;

        // If pixel is set and either adjacent pixels are set, it's white.
        if (me != 0 && (left != 0 || right != 0))
            return loresCols[15][0];  // White
        // If pixel is set but no adjacent pixels are set, pick a color
        // based on column and b7.
        else if (me != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    return loresCols[9][0]; // Orange
                else
                    return loresCols[6][0]; // Medium Blue
            } else {
                if (a0 != 0)
                    return loresCols[12][0]; // Green
                else
                    return loresCols[3][0]; // Purple
            }
        }
        // If pixel is not set and both adjacent pixels are set, pick a
        // color based on column (of adjacent pixel) and b7 (of this byte).
        else if (left != 0 && right != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    return loresCols[6][0]; // Medium Blue
                else
                    return loresCols[9][0]; // Orange
            } else {
                if (a0 != 0)
                    return loresCols[3][0]; // Purple
                else
                    return loresCols[12][0]; // Green
            }
        }
        // Else it's black.
        else
           return loresCols[0][0];    // Black
    }

    // Called if a write lands in any possible video RAM area.
    this.write = function(addr, d8)
    {
        if(this.ctx === undefined) return;

    } // write()

    // Redraw flashing characters only (including cursor).  Called every time flash_on toggles.
    this.reflash = function()
    {
        if(this.ctx === undefined) return;
    }

    // Redraw everything.  Called whenever the graphics modes change.
    this.redraw = function()
    {
        if(this.ctx === undefined) return;
        frame_redraw=false;
        this.register_mode();
        RAM = apple2plus.hwObj().safe_flashdump();
        window.requestAnimationFrame(doDraw);
    }

   

    this.config_meta = {}
    this.config8_data = new Uint8Array();
    this.config8_map = new Array();
    this.config8_idx = new Array();
    this.GPU_CFG = new Uint8Array();

    this.setlen = function(name,modifier)
    {
      if(modifier===undefined) var modifier = ["cfg[","]"]
      else if(modifier==null) var modifier = ["",""]
      if(this.config8_map[name]===undefined)
      {
        this.config8_map[name] = modifier[0] + this.config8_data.length + modifier[1];
        this.config8_idx[name] = this.config8_data.length;
        console.log("map["+name+"] = "+modifier[0]+this.config8_data.length+modifier[1]);
      }
    }

    this.add8_ref = function(name,arr)
    {
      this.setlen(name,null);
      this.config8_data = new Uint8Array([...this.config8_data,...arr]);
    }


    this.add8_val = function(name,val,modifier)
    {
      this.setlen(name,modifier);
      this.config8_data = new Uint8Array([...this.config8_data,...[val&255]]);
    } 
    this.idx8 = function(name)
    {
      return this.config8_idx[name];
    }

    this.gen8_config = function()
    {
      //var s = "const ";
      //for(var i in this.config8_map) s+=i+"="+this.config8_map[i]+",";
      //document.getElementById("menu").innerHTML += "<button onclick=copyTextToClipboard(\""+btoa(s.substring(0,s.length-1))+"\")>COPY CFG MAPPING CODE</button>";
      GPU_CFG = new Uint8Array(this.config8_data);
    }

    /*
    ,"cycle":function()
    {
      // blink cursor
      var args = {"cpu_chrono":performance.now()};
  
      oApple2Video.cycle_counter++;
      if(oApple2Video.cycle_counter==5)
      {
        oApple2Video.cycle_counter = 0;
        oApple2Video.GPU_CFG[ oApple2Video.idx8("FLASH") ] = oApple2Video.GPU_CFG[ oApple2Video.idx8("FLASH") ]==0 ? 1 : 0;
        window.requestAnimationFrame(oApple2Video.doDraw);
      }
    }
    */



    this.add8_val("CHROME_MODE",chrome_mode, ["cfg[","]<<2"]);
    this.add8_val("DIM_H", dim[1]>>1);
    this.add8_val("GFX_FLG",this.register_mode());
    this.add8_val("FLASH",flash_on?1:0);
    this.add8_ref("PALETTE",INTCols);
    this.gen8_config();

    if(ctx===undefined)
    { console.warn("running Apple2GPU.js without video context") }
    else 
    {
        this.ctx = ctx;
        dim = [ctx.canvas.width,ctx.canvas.height];
        console.log(dim)



           console.log("isGPUSupported = "+GPU.isGPUSupported);
           console.log("isKernelMapSupported = "+GPU.isKernelMapSupported);
           console.log("isOffscreenCanvasSupported = "+GPU.isOffscreenCanvasSupported);
           console.log("isWebGLSupported = "+GPU.isWebGLSupported);
           console.log("isWebGL2Supported = "+GPU.isWebGL2Supported);
           console.log("isHeadlessGLSupported = "+GPU.isHeadlessGLSupported);
           console.log("isCanvasSupported = "+GPU.isCanvasSupported);
           console.log("isGPUHTMLImageArraySupported = "+GPU.isGPUHTMLImageArraySupported);
           console.log("isSinglePrecisionSupported = "+GPU.isSinglePrecisionSupported);
    
           //window.requestAnimationFrame(apple2plus.video.doDraw);
       
       
           //appleIntervalHandle = window.setInterval(oApple2Video.cycle,_o.EMU_IntervalTime_ms,_o.CPU_ClockTicks);
       
   }

}


 // KERNEL v6
 const kProcess_v6 =  function(mem,rom,cfg)
 { 
     const CHROME_MODE=cfg[0]<<2,DIM_H=cfg[1],GFX_FLG=cfg[2],FLASH=cfg[3],PALETTE=4
 
     const xp  = (this.thread.x>>1);
     const yp  = DIM_H-(this.thread.y>>1)-1;
     const x7  = xp+1+(xp+1+(xp+1>>3)>>3)>>3;    // equivalent to Math.floor(x/7)
     const m7  = xp-(x7<<3)+x7;                  // equivalent to xp%7
     const adr_ofs = yp<<4 & 0x380 | yp>>3 & 0x18 | yp>>1 & 0x60;

     const PAGE  = (GFX_FLG & 48) << 9;
     const MIX   =  ((1^(yp+0x60>>8) & (GFX_FLG>>3)) | (GFX_FLG>>2)) & 1
     const HIRES =  (GFX_FLG & GFX_FLG>>7 & MIX) & 1;
     const LORES =  (GFX_FLG & GFX_FLG>>6 & MIX) & 1;

     var cp = PALETTE + CHROME_MODE;

     if(HIRES==1)
     {
     const adr = PAGE + (yp<<10 & 0x1C00 | adr_ofs) + x7                 // locate hardware address
     const b171 = (0x7F & mem[adr+1])<<8  | (0x7F & mem[adr])<<1 | (mem[adr-1]>>6 & 1);   // aggregate left - center - right byte
     const b3 = b171>>m7&7, d1 = 0b100100>>b3&1, d2 = 0b11001000>>b3&1;  // 3-bits around (xp,yp) + decision logic
     const dl = 1+((xp^b3)<<1&2|(xp^b3)&1^mem[adr]>>7)&(d1<<4)-d1        // main hi-res color decision logic (6 states 0-5 to multiply by 3)
     cp += (dl+(dl<<1) | (d2<<4)-d2)<<4;                                 // 3*dl | 15*d2 = color pointer (offset 16 positions per color)
     }
     else if(LORES==1)
     {
     const adr = (PAGE>>3) + adr_ofs + x7;                               // locate hardware address
     const d8 = mem[adr];                                                // read byte from memory
     const y4 = (yp>>2&1)<<2;                                            // hi/lo nibble filter
     cp += ((d8>>y4&15)<<4);                                             // color pointer
     }   
     else  // TEXT
     {
     const adr = (PAGE>>3) + adr_ofs + x7;                               // locate hardware address
     const d8 = mem[adr];                                                // read byte from memory
     const offs = ((d8 & 0x3F) ^ 0x20) << 3;                             // character offset (not inversed or flashing)
     const cbyte = rom[ offs + (yp&7)  ];                                // read byte from character ROM
     const infl = d8>>6 & 3;                                             // inv/flash modifier
     const rgb = (cbyte>>m7&1) ^ (0b001>>infl&1) ^ (0b010>>infl&FLASH);  // color 1 or 0 with FLASH modifier
     cp += (rgb<<8) - (rgb<<4);                                          // color pointer
     }

     this.color(cfg[cp]/256,cfg[cp+1]/256,cfg[cp+2]/256);
 }


 var kernel;
 var GPU_CFG,RAM,vidContext;

function initGPU(arg) {
	try {
		return new window.GPU.GPU(arg);
	} catch (e) {
		return new GPU(arg);
	}
}
const gpu = initGPU({
    canvas:  vidContext ,
    mode: 'gpu'
  });

const doDraw = () => 
{
  kernel(RAM,apple2CharRom,GPU_CFG);
};



