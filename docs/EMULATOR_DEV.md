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
          "color": monoChromes[chrome_mode]?monoChromes[chrome_mode]:"#000000"
         ,"name": monoChrome_names[chrome_mode]
        };
    }
```

