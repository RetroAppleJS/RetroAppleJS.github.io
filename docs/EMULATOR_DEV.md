## EMULATOR developers instructions

**color mode**

When the palette button is clicked, the following function is called 

[index.html](/index.html)
```javascript
var datastructure = apple2plus.monitor(this.name) // this.name = integer number cyling between 0-3
```

[EMU_apple2plus.js](/res/EMU_apple2plus.js)
```javascript
this.monitor = function(type) {
      return video.setMonitor(type);
}
```
[EMU_apple2video.js](/res/EMU_apple2video.js)
```javascript
this.setMonitor = function(mode) {
    chrome_mode = mode & 3;
    this.redraw();
    return {
         "color": _CFG_CHROMA[chrome_mode].COL_num?_CFG_CHROMA[chrome_mode].COL_num:"#000000"
        ,"name": _CFG_CHROMA[chrome_mode].COL_name
    };
}
```

Config file is generated from following markdown file: [CONFIG.md](/docs/CONFIG.md)

[COM_CONFIG.js](/res/COM_CONFIG.js)
```javascript
const _CFG_CHROMA = {
 0:{"COL_num":"" ,"COL_name":"FULL-COLOR"}
,1:{"COL_num":"#FFFFFF" ,"COL_name":"B&W"}
,2:{"COL_num":"#A0FFF0" ,"COL_name":"GREEN"}
,3:{"COL_num":"#FCE7A1" ,"COL_name":"AMBER"}
}
```

The physical screen output color is calculated here:

[EMU_apple2video.js](/res/EMU_apple2video.js)
```javascript
this.hgr_PixelColor = function(x, y, l, m, r, b7) 
{
  const chr = 0;
  const b   = x<<4 | l<<3 | (m<<2 | m<<1)&4 | (r<<1 | r>>1)&2 | b7>>7;
  const col =  0xF4E0F8D0>>>b &1 | 0x08200820>>>b-1 &2 | 0xF0D0F4C0>>>b-2 &4;
  const ofs = (col<<4)+(col<<5) | chr<<2;
  const a   = INTCols.slice(ofs,ofs+3);
  return "#"+RGB2HEX(a).join("");
}
```
