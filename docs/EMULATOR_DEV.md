## EMULATOR developers instructions

**color mode**

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
function getPixelColor(x, y, left, me, right, b7) {
        var a0 = x & 0x01;

        if(_CFG_CHROMA[chrome_mode].COL_num)  // monochrome mode ?
        {
            if(me!=0) return _CFG_CHROMA[chrome_mode].COL_num; // Monochrome color
            else return loresCols[0][0];    // Black
        }

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
```
