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
