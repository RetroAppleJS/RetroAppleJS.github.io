//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2GPU.js

if(oEMU===undefined) var oEMU = {"component":{"Video":{"Apple2Video":new Apple2Video()}}}
else oEMU.component.Video.Apple2Video = new Apple2Video();

function Apple2Video(ctx)
{
    var gfx_mode;
    var mix_mode;
    var page2_mode;
    var hires_mode;
    var chrome_mode = 0;
    var flash_on = false;
    var flash_count = 0;
    var frame_count = 0;
    var frame_redraw = true;

    if(ctx) this.ctx = ctx;

    this.vidram = null; // apple2hw.js sets this to give me reference to ram

    // BYTE ARRAY SERIALISATION
    this.serial8 = new Uint8Array();
    this.config8_map = {};
    this.config8_idx = {};
    this.ser8_ref = function(name,arr) { this.setlen(name,null); this.serial8 = new Uint8Array([...this.serial8,...arr]) }
    this.ser8_val = function(name,val,modifier) { this.setlen(name,modifier); this.serial8 = new Uint8Array([...this.serial8,...[val&255]]) } 
    this.ser8_map = function() { return "const "+JSON.stringify(this.config8_map).replace(/"|\{|\}/g,"").replace(/:/g,"=")+";" }
    this.idx8 = function(name) { return this.config8_idx[name] }
    this.setlen = function(name,modifier)
    {
        if(modifier===undefined) var modifier = ["cfg[","]"];
        else if(modifier==null)  var modifier = ["",""];
        if(this.config8_map[name]===undefined)
        {
        this.config8_map[name] = modifier[0] + this.serial8.length + modifier[1];
        this.config8_idx[name] = this.serial8.length;
        }
    }

    this.reset = function()
    {
        gfx_mode    = false;
        mix_mode    = false;
        page2_mode  = false;
        hires_mode  = false;
        flash_on    = true;
        flash_count = 0;
        frame_count = 0;
        chrome_mode = 0;
        this.register_mode();

        // INSTANTIATE CREATE GPU & KERNEL + CONFIGURE DATA SERIALISATION
        const video = this;
        const vidContext = ctx;
        video.initGPU(
            { canvas:  vidContext, mode: 'gpu'}
            ,{ kernel: video.kProcess_v6, output: [vidContext.width,vidContext.height], graphical: true }
            ,{"CHROME_MODE":[video.getChromeMode(),"cfg[","]<<2"]
            ,"DIM_H":[vidContext.height>>1]
            ,"GFX_FLG":[video.register_mode()]
            ,"FLASH":[false]
            ,"PALETTE":[video.INTCols]});
            console.log( video.ser8_map() )

    }

    this.register_mode = function()
    {
      this.modes = {"gfx":gfx_mode,"mix":mix_mode,"page2":page2_mode,"hires":hires_mode,"chrome":chrome_mode};
      var ret = (gfx_mode?1:2) + (mix_mode?8:4) + (page2_mode?32:16) + (hires_mode?128:64);
      return ret;
    }

    this.cycle = function()
    {
      if (++flash_count > 250000)
      {
        flash_on = ! flash_on;
        flash_count = 0;
        this.reflash();
      }
      if (++frame_count > 200000)
      {
        if(frame_redraw==true)
        {
          frame_count = 0;
          this.redraw();
        }
      }
    }

    this.write    = function(addr, d8) { frame_redraw = true }
    this.setGfx   = function(flag) { if (gfx_mode != flag)   { gfx_mode = flag; frame_redraw = true } }
    this.setMix   = function(flag) { if (mix_mode != flag)   { mix_mode = flag; frame_redraw = true } }
    this.setPage2 = function(flag) { if (page2_mode != flag) { page2_mode = flag; frame_redraw = true } }
    this.setHires = function(flag) { if (hires_mode != flag) { hires_mode = flag; frame_redraw = true } }

    this.setMonitor = function(mode)
    {
      chrome_mode = mode & 3;
      frame_redraw = true;
      return  { "color": _CFG_CHROMA[chrome_mode].COL_num?_CFG_CHROMA[chrome_mode].COL_num:"#000000"
                ,"name": _CFG_CHROMA[chrome_mode].COL_name}
    }

    this.getloresCols = function() {
        return loresCols;
    }

    this.gethiresCols = function() {
        return hiresCols;
    }

    this.getChromeMode = function() {
        return chrome_mode;
    }

    this.setCol = function(idx,column,val) {
        return loresCols[idx][column] = val;
    }


    // Lores color to RGB table. (* Hires)
    var loresCols = [
    ["#000000","#000000","#000000","#000000","Black"]  // *
    ,["#901740","#4D4D4D","#304D48","#4C4631","Magenta"] 
    ,["#402CA5","#5B5B5B","#395B56","#5A5239","Dark Blue"] 
    ,["#D143E6","#A8A8A8","#69A89E","#A6986A","Purple"]  // *
    ,["#006940","#383838","#233835","#383324","Dark Green"] 
    ,["#808080","#808080","#508078","#7E7451","Grey 1"] 
    ,["#2F96E6","#8E8E8E","#598E85","#8C8059","Medium Blue"]  // *
    ,["#BFABFF","#CECECE","#81CEC2","#CBBA82","Light Blue"] 
    ,["#405400","#313131","#1F312E","#312D1F","Brown"] 
    ,["#D06B1A","#717171","#47716B","#706748","Orange"]  // *
    ,["#808080","#808080","#508078","#7E7451","Grey 2"] 
    ,["#FF96BF","#C7C7C7","#7DC7BB","#C4B47D","Pink"] 
    ,["#30BD1B","#575757","#375752","#564F37","Light Green"]  // *
    ,["#BFD35A","#A4A4A4","#67A49A","#A29568","Yellow"] 
    ,["#6FE8BF","#B2B2B2","#70B2A8","#B0A170","Aquamarine"] 
    ,["#FFFFFF","#FFFFFF","#A0FFF0","#FCE7A1","White"]  // *
    ];

    var hiresCols = [
     loresCols[0]
    ,loresCols[3]
    ,loresCols[6]
    ,loresCols[9]
    ,loresCols[12]
    ,loresCols[15]
    ];

    this.INTCols = new Uint8Array([
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

    this.hgr_PixelColor = function(x, y, left, me, right, b7) {
        var a0 = x & 0x01;

        // If pixel is set and either adjacent pixels are set, it's white.
        if (me != 0 && (left != 0 || right != 0))
            return loresCols[15][0];  // White
        // If pixel is set but no adjacent pixels are set, pick a color
        // based on column and b7.
        else if (me != 0) {
            if (b7 != 0) {
                if (a0 != 0) return loresCols[9][0]; // Orange
                else         return loresCols[6][0]; // Medium Blue
            } else {
                if (a0 != 0) return loresCols[12][0]; // Green
                else         return loresCols[3][0];  // Purple
            }
        }
        // If pixel is not set and both adjacent pixels are set, pick a
        // color based on column (of adjacent pixel) and b7 (of this byte).
        else if (left != 0 && right != 0) {
            if (b7 != 0) {
                if (a0 != 0) return loresCols[6][0]; // Medium Blue
                else         return loresCols[9][0]; // Orange
            } else {
                if (a0 != 0) return loresCols[3][0];  // Purple
                else         return loresCols[12][0]; // Green
            }
        }
        // Else it's black.
        else
           return loresCols[0][0];    // Black
    }



  this.initGPU = function(GPUarg,KERNELarg,config)
  { 
    // CONFIGURE DATA SERIALISATION
    for(var i in config)
    {
      if(config[i][0].constructor === Uint8Array) this.ser8_ref(i,config[i][0])
      else this.ser8_val(i,config[i][0],config[i][1]===undefined?undefined:[config[i][1],config[i][2]])
    }

    // INSTATIATE GPU CLASS & ATTACH TO WINDOW OBJECT
    try { var gpu = new window.GPU.GPU(GPUarg) } catch (e) { var gpu = new GPU(GPUarg) }

    // TRANSPILE CHOSEN KERNEL SCRIPT
    this.kernel = gpu.createKernel(KERNELarg.kernel,KERNELarg)
  }

  this.kernel = function() { alert.warn("initialise first with initGPU()") }

  // KERNEL v6
  this.kProcess_v6 =  function(mem,rom,cfg)
  { 
    const CHROME_MODE=cfg[0]<<2,DIM_H=cfg[1],GFX_FLG=cfg[2],FLASH=cfg[3],PALETTE=4

    const xp = (this.thread.x>>1);
    const yp = DIM_H-(this.thread.y>>1)-1;
    const x7 = xp+1+(xp+1+(xp+1>>3)>>3)>>3;    // equivalent to Math.floor(x/7)
    const m7 = xp-(x7<<3)+x7;                  // equivalent to xp%7
    const adr_ofs = yp<<4 & 0x380 | yp>>3 & 0x18 | yp>>1 & 0x60;

    const PAGE  = (GFX_FLG & 48) << 9;
    const MIX   = ((1^(yp+0x60>>8) & (GFX_FLG>>3)) | (GFX_FLG>>2)) & 1
    const HIRES = (GFX_FLG & GFX_FLG>>7 & MIX) & 1;
    const LORES = (GFX_FLG & GFX_FLG>>6 & MIX) & 1;

    var cp = PALETTE + CHROME_MODE;

    if(HIRES==1)
    {
      const adr  = PAGE + (yp<<10 & 0x1C00 | adr_ofs) + x7                // locate hardware address
      const b171 = (0x7F & mem[adr+1])<<8  | (0x7F & mem[adr])<<1 | (mem[adr-1]>>6 & 1);   // aggregate left - center - right byte
      const b3   = b171>>m7&7, d1 = 0b100100>>b3&1, d2 = 0b11001000>>b3&1;// 3-bits around (xp,yp) + decision logic
      const dl   = 1+((xp^b3)<<1&2|(xp^b3)&1^mem[adr]>>7)&(d1<<4)-d1      // main hi-res color decision logic (6 states 0-5 to multiply by 3)
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
      const adr   = (PAGE>>3) + adr_ofs + x7;                               // locate hardware address
      const d8    = mem[adr];                                               // read byte from memory
      const offs  = ((d8 & 0x3F) ^ 0x20) << 3;                              // character offset (not inversed or flashing)
      const cbyte = rom[ offs + (yp&7) ];                                   // read byte from character ROM
      const infl  = d8>>6 & 3;                                              // inv/flash modifier
      const rgb   = (cbyte>>m7&1) ^ (0b001>>infl&1) ^ (0b010>>infl&FLASH);  // color 1 or 0 with FLASH modifier
      cp += (rgb<<8) - (rgb<<4);                                            // color pointer
    }

    this.color(cfg[cp]/256,cfg[cp+1]/256,cfg[cp+2]/256);
  }

    // Redraw flashing characters only (including cursor).  Called every time flash_on toggles.
    this.reflash = function() { frame_redraw = true; this.redraw() }

    this.redraw = function()
    {
      this.serial8[ this.idx8("CHROME_MODE") ]  = chrome_mode;
      this.serial8[ this.idx8("GFX_FLG") ]      = this.register_mode();
      this.serial8[ this.idx8("FLASH") ]        = flash_on ? 1 : 0;
  
      // RUN THE KERNEL !
      window.requestAnimationFrame( function() { apple2plus.vidObj().kernel(apple2plus.hwObj().safe_flashdump(),apple2CharRom,apple2plus.vidObj().serial8)} );
      frame_redraw=false;  // OPEN ISSUE (ANDROID related) https://github.com/gpujs/gpu.js/issues/521
    }

  this.initGPU = function(GPUarg,KERNELarg,config)
  { 
    // CONFIGURE DATA SERIALISATION
    for(var i in config)
    {
      if(config[i][0].constructor === Uint8Array) this.ser8_ref(i,config[i][0])
      else this.ser8_val(i,config[i][0],config[i][1]===undefined?undefined:[config[i][1],config[i][2]])
    }

    // INSTATIATE GPU CLASS & ATTACH TO WINDOW OBJECT
    try { var gpu = new window.GPU.GPU(GPUarg) } catch (e) { var gpu = new GPU(GPUarg) }

    // TRANSPILE CHOSEN KERNEL SCRIPT
    this.kernel = gpu.createKernel(KERNELarg.kernel,KERNELarg)
  }

  this.kernel = function() { alert.warn("initialise first with initGPU()") }

  // KERNEL v6
  this.kProcess_v6 =  function(mem,rom,cfg)
  { 
    const CHROME_MODE=cfg[0]<<2,DIM_H=cfg[1],GFX_FLG=cfg[2],FLASH=cfg[3],PALETTE=4

    const xp = (this.thread.x>>1);
    const yp = DIM_H-(this.thread.y>>1)-1;
    const x7 = xp+1+(xp+1+(xp+1>>3)>>3)>>3;    // equivalent to Math.floor(x/7)
    const m7 = xp-(x7<<3)+x7;                  // equivalent to xp%7
    const adr_ofs = yp<<4 & 0x380 | yp>>3 & 0x18 | yp>>1 & 0x60;

    const PAGE  = (GFX_FLG & 48) << 9;
    const MIX   = ((1^(yp+0x60>>8) & (GFX_FLG>>3)) | (GFX_FLG>>2)) & 1
    const HIRES = (GFX_FLG & GFX_FLG>>7 & MIX) & 1;
    const LORES = (GFX_FLG & GFX_FLG>>6 & MIX) & 1;

    var cp = PALETTE + CHROME_MODE;

    if(HIRES==1)
    {
      const adr  = PAGE + (yp<<10 & 0x1C00 | adr_ofs) + x7                // locate hardware address
      const b171 = (0x7F & mem[adr+1])<<8  | (0x7F & mem[adr])<<1 | (mem[adr-1]>>6 & 1);   // aggregate left - center - right byte
      const b3   = b171>>m7&7, d1 = 0b100100>>b3&1, d2 = 0b11001000>>b3&1;// 3-bits around (xp,yp) + decision logic
      const dl   = 1+((xp^b3)<<1&2|(xp^b3)&1^mem[adr]>>7)&(d1<<4)-d1      // main hi-res color decision logic (6 states 0-5 to multiply by 3)
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
      const adr   = (PAGE>>3) + adr_ofs + x7;                               // locate hardware address
      const d8    = mem[adr];                                               // read byte from memory
      const offs  = ((d8 & 0x3F) ^ 0x20) << 3;                              // character offset (not inversed or flashing)
      const cbyte = rom[ offs + (yp&7) ];                                   // read byte from character ROM
      const infl  = d8>>6 & 3;                                              // inv/flash modifier
      const rgb   = (cbyte>>m7&1) ^ (0b001>>infl&1) ^ (0b010>>infl&FLASH);  // color 1 or 0 with FLASH modifier
      cp += (rgb<<8) - (rgb<<4);                                            // color pointer
    }

    this.color(cfg[cp]/256,cfg[cp+1]/256,cfg[cp+2]/256);
  }



}
