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
    var r = ("0".repeat(m)+v.toString(16)).slice(-m).toUpperCase();
    for(var i=0;i<r.length;i++)
      s+= ("0000"+parseInt(r.charAt(i),16).toString(2)).slice(-4)
    return s;
  }

  this.writeDisplay = function(n,v,f)
	{
		// n = el, v = value, f = extra HTML
		var obj,tagname,bAppend = typeof(f)!="undefined";
		if (document.getElementById) { obj=document.getElementById(n); tagname = obj.tagName.toUpperCase() }
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
}


var oMEMGRID = new function()
{
  this.oCOM = new COM();

// FVD TODO move this piece to apple2plus.js
  this.mem_layout = {
        "0000-00FF":["#FFFFFF","ZERO-PAGE","ZP"]
       ,"0100-01FF":["#E0E0E0","STACK","ST"]
       ,"0200-02FF":["#00D000","GETLN buffer","BU"]
       ,"0300-03FF":["#00D000","VECTORS","VC"]
       ,"0400-07FF":["#DF48FF","TXT1/LORES1","T1"]
       ,"0800-0BFF":["#D040E0","TXT2/LORES2","T2"]
       ,"0C00-1FFF":["#00D000","APPLESOFT PRG","AP"]
       ,"2000-3FFF":["#0000FF","HIRES1","H1"]
       ,"4000-5FFF":["#0000E0","HIRES2","H2"]
       ,"6000-BFFF":["rgba(0,0,0,0.1)","FREE","F"]
       ,"C000-C07F":["#B0B000","I/O","IB"]
       ,"C080-C0FF":["#B0B000","SLOT I/O","IO"]
       ,"C100-C1FF":["#D0D000","SLOT 1 ROM","S1"]
       ,"C200-C2FF":["#D0D000","SLOT 2 ROM","S2"]
       ,"C300-C3FF":["#D0D000","SLOT 3 ROM","S3"]
       ,"C400-C4FF":["#D0D000","SLOT 4 ROM","S4"]
       ,"C500-C5FF":["#D0D000","SLOT 5 ROM","S5"]
       ,"C600-C6FF":["#D0D000","SLOT 6 ROM","S6"]
       ,"C700-C7FF":["#D0D000","SLOT 7 ROM","S7"]
       ,"C800-CFFF":["#F0F000","SLOT ROM ext","SR"]
       ,"D000-FFFF":["#D00000","MONITOR ROM","AR"]       
    }

  const mem_gran = 8;  // block granularity in bits

  this.build_mem_map = function()
  {
    for(var i in this.mem_layout)
    {
        var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16)];
        var s = ""
        for(var addr=b[0];addr<b[1];addr+=1<<mem_gran)
        { 
            this.mem_pg[addr>>mem_gran] = this.mem_layout[i][2];
            s += (addr>>mem_gran)+"="+this.mem_layout[i][2]+" ";
        }
        console.log(a[0]+"-"+a[1]+" ("+s+")");
    }
  }

  this.mem_pg = new Array(0x10000>>mem_gran);

  this.line = function(start,len,step)
  {
    var end = start+len*step;
    for(var j=start,a=[],ii=0;j<end;j+=step) a[ii++] = this.oCOM.getHexWord(j);
    return a;
  }

  this.build_grid = function(start,len,step)
  {
    var s = "<table class=gtable style='float:left'>\n";
    var end = start+len*step;
    for(var i=start;i!=end;i+=step)
      s += "<tr><td>"+this.oCOM.getHexWord(i)+"</td><td id='m"+this.line(i,16,256).join("'></td><td id='m")+"'></td></tr>\n";
    return s+"</table>"
  }

  this.paint_grid = function()
  {
    this.build_mem_map();

    // PREPARE ALL DATA
    var blk_col = {}, blk_txt = {} //, c = ""
    for(var i in this.mem_layout)
    {
      var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16)];
      for(var j=b[0];j<b[1];j+=parseInt("0100",16))
      { //c += ("0000"+j.toString(16)).slice(-4).toUpperCase()+" "+blk[i][0]+"<br>";
        var idx = ("0000"+j.toString(16)).slice(-4).toUpperCase();
        blk_col[idx] = this.mem_layout[i][0]; blk_txt[idx] = "$"+idx+" "+this.mem_layout[i][1];
      }
    }

    // PAINT GRID
    for(var i in this.mem_layout)
    {
      var a = i.split("-");
      if(a.length==2)
      {
        var b = [parseInt(a[0],16),parseInt(a[1],16)];
        for(var j=b[0];j<b[1];j+=parseInt("0100",16))
        {
          var idx = ("000"+j.toString(16)).slice(-4).toUpperCase();
          var el = document.getElementById("m"+idx);
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