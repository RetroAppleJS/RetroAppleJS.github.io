function COM()
{
  this.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
  this.getHexByte    = function(v) { return this.hextab[v>>4]+this.hextab[v&0xf] }
  this.HEX2RGB       = function(hex) { var n=parseInt(hex.slice(1),16); return [(n>>16)&0xFF,(n>>8)&0xFF,n&0xFF] }
  this.RGB2HEX       = function(dec) { return [this.getHexByte(dec[0]),this.getHexByte(dec[1]),this.getHexByte(dec[2])] }

  this.getHexWord = function(v)
  {
    return '' + this.hextab[v >> 12]
              + this.hextab[(v & 0x0f00)>>8]
              + this.hextab[(v & 0xf0)>>4]
              + this.hextab[v & 0x000f];
  }

  this.getHexMulti = function(v,m)
  {
    return ("0".repeat(m)+v.toString(16)).slice(-m).toUpperCase();
  }

  this.getBinMulti = function(v,m)
  {
    var s = "";
    var r = ("0".repeat(m)+v.toString(2)).slice(-m).toUpperCase();
    //for(var i=0;i<r.length;i++)
    //  s+= ("0000"+parseInt(r.charAt(i),16).toString(2)).slice(-4)
    //return s;
    return r;
  }

  this.base64ToArrayBuffer = function(base64)
  {
      try{ var binary_string = window.atob(base64); } catch(e) { return null }
      var len = binary_string.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
          bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes;
  }

  this.ArrayBufferTobase64 = function(buffer) 
  {
      //return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));

      var binary = '';
      var bytes = new Uint8Array( buffer );
      var len = buffer.byteLength;
      for (var i = 0; i < len; i++) {
          binary += String.fromCharCode( buffer[ i ] );
      }
      return window.btoa( binary );

  }

  this.base_convert = function (str, fromBase, toBase)
  {
    if(typeof(fromBase)=='object') { this.fromSymbols = fromBase[0] }
    if(typeof(toBase)  =='object') { this.toSymbols = toBase[0] }
    fromBase = this.fromSymbols.length; toBase = this.toSymbols.length;

    // PARSE INPUT DIGITS ARRAY
    for(var _a = [0], str = str.split(''); str.length > 0 && _a[_a.push(this.fromSymbols.indexOf(str.pop())) - 1] >= 0;);
    var _d = _a.shift() + _a[_a.length-1]>=0 ? _a : null; if (_d === null) return null;

    // BASE CONVERSION
    for (var _n = 0,_a = [],_p = [1]; _n < _d.length; _n++) { _a = add(_a, mul(_d[_n], _p, toBase), toBase); _p = mul(fromBase, _p, toBase) }

    // PARSE OUTPUT DIGITS ARRAY
    for (var _n = _a.length - 1, _o = ''; _n >= 0; _o += this.toSymbols[_a[_n--]]);
    return _o.length==0?this.toSymbols[0]:_o;
  }

  var add = function(x, y, base) {
      var _m = Math.max(x.length, y.length);
      for(var _c = 0,_n = 0,_r = [],_z; _n < _m || _c; _c = Math.floor(_z / base)) {
        var _z = _c + (_n < x.length ? x[_n] : 0) + (_n < y.length ? y[_n] : 0);
        var _n =  _r.push(_z % base);
      }
      return _r;
  }

  var mul = function(x, pow, base) {
      for(var _r = x < 0 ? null : []; x > 0; x = x >> 1) {
        if(x & 1) _r = add(_r, pow, base);
        pow = add(pow, pow, base);
      }
      return _r;
  }

  this.ltrim = function(s) { return s.replace(/^ */,"") }
  this.rtrim = function(s) { return s.replace(/ *$/,"") }
  this.trim  = function(s) { return this.rtrim(this.ltrim(s)) }

  /////// GUI FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////


  /////////////////////////////////////
  // WRITE VALUES TO ANY TAG ELEMENT //
  /////////////////////////////////////

  this.writeDisplay = function(n,v,f)
	{
		// n = el, v = value, f = extra HTML
		var obj,tagname,bAppend = typeof(f)!="undefined";
		if(document.getElementById) { obj=document.getElementById(n); tagname = obj.tagName.toUpperCase() }
		else if (document.all) { obj=document.all[n] }
		if(!obj) return;
    
		switch(tagname)
		{
			case "INPUT":
				switch(f)
				{
					case "beforebegin":obj.value += v; break; 				    // less common
					case "afterbegin": obj.value = v + obj.value; break;	// less common
					case "afterend":   obj.value = v + obj.value; break;
					case "beforeend":  obj.value += v; break;
					default:  		   obj.value = v;
				}
			break;
			default:
				if(bAppend) obj.insertAdjacentHTML(f,v);
				else obj.innerHTML=v;
		}
	}

  this.POPUP = {
    id:"",
    states:{},
    rules:{},
    el: function(id) { return document.getElementById(id) },
    addRule: function(id,function_obj) { this.rules[id] = function_obj },
    runRule: function(id) { this.id = id; this.rules[id](this) },
    update_state: function(id,el){ this.states[id] = el.hidden },
    on: function(id) { this.states[id] = this.el(id).hidden = false },
    off: function(id) { this.states[id] = this.el(id).hidden = true },
    toggle: function(id) { var e=this.el(id); this.states[id] = e.hidden = !e.hidden ;return e },
    toggle_class: function(el,class1,class2)
    {
      this.toggle(el.id);
      if(el.hidden) {el.classList.remove(class2);el.classList.add(class1)}
      else {el.classList.remove(class1);el.classList.add(class2)}
    }
  } 
 
  /*
  this.onPopup = function(id)
  { var e = document.getElementById(id); e.hidden = !e.hidden; return e }
*/
  /*
  this.onPopUpClass = function(id,class1,class2)
  {
    id.hidden = !id.hidden;
    if(id.hidden) {id.classList.remove(class2);id.classList.add(class1)} else {id.classList.remove(class1);id.classList.add(class2)}
  }
  */

  this.Download = function(fileName, data)
  {
    var ui8 = new Uint8Array(data.length);
    for(var i=0;i<data.length;i++)
      ui8[i] = data[i];
    var url, mimeType = 'application/octet-stream';
    var blob = new Blob([ui8], {type: mimeType});
    var url = window.URL.createObjectURL(blob);

    console.log("downloadURL('"+ul+"', '"+fileName+"')")
    downloadURL(url, fileName);
    setTimeout(function() {
      return window.URL.revokeObjectURL(url);
    }, 2000);
  }

  function downloadURL(data, fileName) {
    var a;
    a = document.createElement('a');
    a.href = data;
    a.download = fileName;
    document.body.appendChild(a);
    a.style = 'display: none';
    a.click();
    a.remove();
  };

  this.UploadData = new Array();
  this.Upload = function(elementId,callback)
  {
      this.UploadData = [];
      var file = document.getElementById(elementId).files[0];
      if (!file) return;
      oCOM.UploadName = file.name;

      this.fread = new FileReader();
      this.fread.readAsArrayBuffer(file);
      if(typeof(callback)!="function") callback = function() { alert("test") }; // override if needed
      else this.callback = callback;

      function handleEvent(obj)
      {
          return function(levent)
          {
            var data = new DataView(levent.target.result);
            var size = levent.target.result.byteLength;
            this.UploadData = Array(size);
            for (var i = 0; i < size; i++)
              obj.UploadData[i] = data.getUint8(i);
            obj.callback(obj.UploadData);
          }
      }
      this.fread.addEventListener('load',handleEvent(this));

  }

  this.SystemSelect = function(id,tab)
  {
    var def = _TABS[tab]["SYS"];
    var s = "<select onchange=\"document.getElementById('"+id+"').innerHTML=oCOM.onSystemSelect(this.value,'"+tab+"')\">";
    for(var i in _CFG_SYSCODE)
      s+= "<option value='"+i+"' "+(i==def?"selected":"")+">"+_CFG_SYSCODE[i].Model+"</option>";
    return(s+"</select>");
  }

  this.onSystemSelect = function(val,tab)
  {
    _TABS[tab].SYS = val;

    var s = "";
    for(var i in _CFG_SYSCODE[val])
    {
      if(i!="Model" && i!="ROMS")
      {
        if(_CFG_SYSCODE[val][i] && _CFG_SYSCODE[val][i].split(",").length>1)
        {
          this.onSysOptionSelect(i,tab,0);
          var name = tab+"_"+i
          s+="<div style=display:flex;>"
          +i+":"
          +"<button onclick=oCOM.onSysOptionSelect('"+i+"','"+tab+"',-1)><i class='fa fa-arrow-alt-circle-left'></i></button>"
          +"<input name='"+name+"' value='"+_CFG_SYSCODE[val][i].split(",")[0]+"' size=7>"  // TODO NAVIGATE THROUGH OPTIONS
          +"<button onclick=oCOM.onSysOptionSelect('"+i+"','"+tab+"',1)><i class='fa fa-arrow-alt-circle-right'></i></button>"
          +"</div>"
        }
        else
          s+= i+":"+_CFG_SYSCODE[val][i]+"<br>";
      }
    }
    return s;
  }

  this.onSysOptionSelect = function(option,tab,up_dn)
  {
    var sys = _TABS[tab]["SYS"];
    var arr = _CFG_SYSCODE[sys][option].split(",");
    var idx = 0;
    if(typeof(_TABS[tab][option])!="undefined")
    {
      for(var i=0;i<arr.length;i++)
        if(arr[i]==_TABS[tab][option]) idx=i;
      idx += up_dn;
      if(idx<0) idx=arr.length-1;
      if(idx==arr.length) idx=0;
    }
    _TABS[tab][option] = arr[idx];
    var name = tab+"_"+option;
    var el = document.getElementsByName(name);
    if(el.length>0)
      el[0].value = arr[idx];

    //var el = el[0];
    //el.value = arr[idx]
    //.val.value = arr[idx];
    //alert("_TABS['"+tab+"']['"+option+"'] = '"+arr[idx]+"'");
  }

    /////////////////////
    // URL PARSER      //
    /////////////////////

  this.URL =
  {
    url:"",
    uri:{},
    hash:"",
    merge: function (_uri1,_uri2)
    {
      var _o = new Array();
      for(_i in _uri1)
        _o[_i] = _uri1[_i];
      for(_i in _uri2)
        _o[_i] = _uri2[_i]; 
      return _o[_i];
    },
    addURI: function (_uri2)
    {
      for(_i in _uri2)
        if(_uri2[_i])
          this.uri[_i] = _uri2[_i]; // add or override
        else
          delete this.uri[_i];
    },
    getURI: function ()
    {
      var _str = ""
      for(_i in this.uri)
      {
        if(this.uri[_i])
          _str += (_str?"&":"?") + _i + "=" + this.uri[_i];
      }
      return _str;
    },
    parse: function (_url)
    {
      var _ppos = _url.lastIndexOf("#");
      if(_ppos>0) { _url = _url.substring(0,_ppos); this.hash = _url.hash }
      var _urlarr = _url?_url.split("?"):new Array("","");
      var _urlargs = _urlarr[1]?_urlarr[1].split("&"):new Array(_urlarr[0],"");
      this.url = _urlarr[0];
  
      this.uri = {};
      for(var _i=0;_i<_urlargs.length;_i++)
      {
        if(!(_urlargs[_i]===undefined))
        {
          var a = _urlargs[_i].split("=");
          this.uri[ a[0] ] = a[1];
        }
      }
    }
  }



    /////////////////////
    // EVENT SEQUENCER //
    /////////////////////

    this.addToEventStack = function(event,func)
    {
      console.log("addToEventStack("+event+" "+func.name+")");
      if(o_event==null) var o_event = {};
      o_event[event] = window[event];
      if (typeof window[event] != "function") window[event] = func;
      else { window[event] = function() { if (o_event[event]) o_event[event](); func() } };
    }

    
    /////////////////////////////////
    // DASHBOARD REFRESH SEQUENCER //
    /////////////////////////////////

    // array of functions is called at the pace of EMU_DashboardRefresh_s = Dashboard updates per second   
    this.RefreshEvent_arr = {};
    this.bRefreshEvent = false;

    this.addRefreshEvent = function(func,name,active)
    {
      console.log("addRefreshEvent("+name+")");
      this.RefreshEvent_arr[ name ] = {"func":func,"active":active}
      this.checkActiveEvents();
    }

    this.toggleRefreshEvent = function(name)
    {
      this.RefreshEvent_arr[ name ].active = !this.RefreshEvent_arr[ name ].active;
      this.checkActiveEvents();
      return this.RefreshEvent_arr[ name ].active;
    }

    this.checkActiveEvents = function()
    {
      var bActive = false;
      for(var _o in this.RefreshEvent_arr)
        if(this.RefreshEvent_arr[_o].active) bActive = true;
      this.bRefreshEvent = bActive;
    }
}

oCOM = new COM();

var oMEMGRID = new function()
{
  if(typeof(this.bDebug)=="undefined") this.bDebug = false;
  this.oCOM = new COM();

  const mem_gran = 8;  // block granularity in bits
  this.mem_gran = mem_gran;

  this.build_mem_map = function(layout)
  {
    for(var i in layout)
    {
      var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16),a[0].length];
      for(var addr=b[0],s="";addr<b[1];addr+=1<<mem_gran)
      { 
        this.mem_pg[addr>>mem_gran] = layout[i][2];
        if(this.bDebug) console.log("this.mem_pg["+(addr>>mem_gran)+"] = "+layout[i][2]);
        s += (addr>>mem_gran)+"="+layout[i][2]+" ";
      }
      //console.log(a[0]+"-"+a[1]+" ("+s+")");
    }
  }

  this.mem_pg = new Array(0x10000>>mem_gran);

  this.line = function(start,len,step,digits)
  {
    var end = start+len*step;
    for(var j=start,a=[],ii=0;j<end;j+=step) a[ii++] = this.oCOM.getHexMulti(j,digits);
    return a;
  }

  this.conf_grid = {id_prefix:"m",digits:4};
  this.build_grid = function(start,len,step,cnf)
  {
    if(cnf===undefined) var cnf = this.conf_grid;
    var s = "<table class=gtable style='display:inline-block;' id='gtable_"+cnf.id_prefix+"'>\n";
    var end = start+len*step;
    for(var i=start;i!=end;i+=step)
      s += "<tr><td>"+this.oCOM.getHexMulti(i,cnf.digits)+"</td>"
              +"<td id='"+cnf.id_prefix+this.line(i,16,256,cnf.digits).join("'></td><td id='"+cnf.id_prefix)+"'></td></tr>\n";
    return s+"</table>"
  }

  this.paint_grid = function(layout,cnf)
  {
    var fix = this.conf_grid.id_prefix;
    this.build_mem_map(layout);  // populate this.mem_pg array (not for display, but later lookup)

    // PREPARE DISPLAY DATA
    var blk_col = {}, blk_txt = {} //, c = ""
    for(var i in layout)
    {
      var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16),a[0].length];
      for(var j=b[0];j<b[1];j+=parseInt("0100",16)) // iterate through layout address range
      { //c += ("0000"+j.toString(16)).slice(-4).toUpperCase()+" "+blk[i][0]+"<br>";
        //var idx = ("0000"+j.toString(16)).slice(-4).toUpperCase();
        var idx = this.oCOM.getHexMulti(j,b[2]); // address index
        blk_col[idx] = layout[i][0];             // populate background colors (indexed by address)
        blk_txt[idx] = "$"+idx+" "+layout[i][1]; // populate popup texts (indexed by address)
        if(this.bDebug) console.log("blk_col["+idx+"] = "+layout[i][0]);
        if(this.bDebug) console.log("blk_txt["+idx+"] = $"+idx+" "+layout[i][1]);
      }
    }

    // PAINT GRID
    for(var i in layout)
    {
      var a = i.split("-");
      if(a.length==2)
      {
        var b = [parseInt(a[0],16),parseInt(a[1],16),a[0].length];
        for(var j=b[0];j<b[1];j+=parseInt("0100",16))
        {
          //var idx = ("000"+j.toString(16)).slice(-4).toUpperCase();
          var idx = this.oCOM.getHexMulti(j,b[2]);
          var el = document.getElementById(fix+idx);
          if(el!=null)
          {
            if(blk_col[idx].charAt(0)=="#" || blk_col[idx].substring(0,5)=="rgba(")
              el.style.backgroundColor = blk_col[idx];
            el.innerHTML = "<span class=gt>"+blk_txt[idx]+"</span>"
          }
        }
      }
    }
  }
}(COM)

function GRID()
{
  this.build_grid = function(start,len,step)
  {
    var output = "<table class=gtable>\n";
    var end = start+len*step;
    output+="<tr><td></td>"
    for(var i=start,s="";i!=end;i+=step)
    {
      output+=this.col_label(i,len,step)
      s += "<tr>"+this.row_label(i,len,step)+"<td id='m"+this.line(i,len,1).join("'></td><td id='m")+"'></td></tr>\n";
    }
    output+="</tr>\n"
    return output+s+"</table>";
  }

  this.col_label = function(i,len,step)
  {
    return "<td>"+(i/step)+"</td>";
  }

  this.row_label = function(i,len,step)
  {
    return "<td>"+(i/step)+"</td>";
  }

  this.line = function(start,len,step)
  {
    var end = start+len*step;
    for(var j=start,a=[],ii=0;j<end;j+=step) a[ii++] = j;
    return a;
  }
}