
    //   ██████  ██    ██ ██     ███████ ██    ██ ███    ██  ██████ ████████ ██  ██████  ███    ██ ███████ 
    //  ██       ██    ██ ██     ██      ██    ██ ████   ██ ██         ██    ██ ██    ██ ████   ██ ██      
    //  ██   ███ ██    ██ ██     █████   ██    ██ ██ ██  ██ ██         ██    ██ ██    ██ ██ ██  ██ ███████ 
    //  ██    ██ ██    ██ ██     ██      ██    ██ ██  ██ ██ ██         ██    ██ ██    ██ ██  ██ ██      ██ 
    //   ██████   ██████  ██     ██       ██████  ██   ████  ██████    ██    ██  ██████  ██   ████ ███████ 
    /////////////////////////////////////////////////////////
    
    var _T = function _T(idx,mod)
    {
        this.t = {
            get _language(){ return "NL" }
            ,"title":document.title
            ,"menu_convert":""
            ,"menu_info":"Info/Contact"
            ,"intro":""
            ,"version":(typeof(CONF_version)=="undefined"?"":("Version "+CONF_version))
            ,"built":(typeof(CONF_builddate)=="undefined"?"":("Built "+CONF_builddate))
            ,get _(){return this}
        }
        if(idx.length>0 && typeof(this.t[idx])=="undefined") { alert(idx); return "<font color=red>"+idx+"</font>" }
        switch(mod)
        {
            case "cap": return this.t[idx].charAt(0).toUpperCase()+this.t[idx].substring(1,this.t[idx].length);
            case "inv": { var j = {}; for(var i in t) { j[ t[i] ] = i }; return j } // inverse associative
            default: return this.t[idx];
        }
    }
    function _D(idx) { if(typeof(_T(idx)=="string")) document.write(_T(idx)) }
    function _TITLE() {
        var hight_pct = 8;
        var css = "html {height:100%;font-family:'Arial'} body {background-color:#808080;height:100%;margin:0px;padding:0px;} .no_margins { margin:0px 0px 0px; padding:0px 0px 0px 0px; border:0px solid; }"
        +"#texturespace {background: #f7f7f7 url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEEAYAAAD5YUI9AAAACXBIWXMAAA4mAAAOJgGi7yX8AAAARElEQVQIHWPYyrxTed9eg3UQWkQHQgtaQGg5JgaohAdUoglC8z+A0mFQBYIpUIEXULoOQgvIQRXIBUElMqASShBaWQwApNg4NPAzQGwAAAAASUVORK5CYII=') repeat center top;font: 62.5%/1 sans-serif;height: 100%;width: 100%;}"
        +"#carvetext {color: transparent;background: #f7f7f7;font: 62.5%/1 sans-serif;stroke: 2px rgba(0,0,0,0.2);background-color: rgba(140,140,140,1);-webkit-background-clip: text;text-shadow: rgba(255,255,255,0.5) 0 5px 6px, rgba(255,255,255,0.2) 1px 3px 3px;transition: text-shadow .1s ease-out, background-color .2s ease-out;}"
        +"#carvetext:hover {color: transparent;background-color: rgba(82,96,117,0.5);-webkit-background-clip: text;text-shadow: rgba(255,255,255,0.5) 0 5px 6px;}"
        +"#carvetext:focus {outline: none;}.slider_main {position: relative;height: 100%;}"
        +".slider_overlay {position: absolute;bottom: 0;left: 0;right: 0;background-color: #F0F0F0;overflow: hidden;width: 100%;height: 85%;transition: .5s ease;}"
        //+".slider_main:hover "
        +".slider_overlay {height: 100%;}"
        +"#topmenu{width:100%;background-color:#f0f0f0}"
        +"ul#minitabs{list-style:none;margin:0;padding:3px 0 0 0;border-left:1px solid #ccc;border-right:1px solid #ccc;border-top:1px solid #ccc;border-bottom:1px solid #ccc;font-weight:700;text-align:left;white-space:nowrap}ul#minitabs li{display:inline;margin:0 3px}ul#minitabs a{text-decoration:none;color:#999}ul#minitabs a#current{border-color:#f60;color:#06f}ul#minitabs a:hover{border-color:#f60;color:#666}"
    
        return "<style>"+css+".slider_overlay{height: "+(100-hight_pct)+"%}</style>"
        +"<div id=texturespace style='height:100%;width:100%'><center><div id='carvetext'>"
        +"<div style='font-size:5em'>"+(typeof(_T("title"))=="string"?_T("title"):"")+"</div>"
        +"<div style='font-size:1em'>"+(typeof(_T("version"))=="string"?_T("version"):"")
        +" &nbsp; "+(typeof(_T("built"))=="string"?_T("built"):"")+"</div>"
        +"</div></center></div>"
    }
 