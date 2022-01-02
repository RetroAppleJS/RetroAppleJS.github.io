function PALETTE()
{
    this.bDebug      = false;
    this.color_depth = 12;    // color depth
    this.dot_size    = 10;
    this.opat        = 0;     // pattern index offset
    this.sec_n       = [6,8]; // sections to show vs total sections
    this.canvas      = [];
    this.ctx         = [];
    this.hex_pal     = [];
    this.limit_dots  = {};
    this.mouseXY     = {"x":0,"y":0,"dx":0,"dy":0,"down":false};

    this.load        = function(p) { this.hex_pal = p }
    this.debug_data  = {};
    this.debug_save  = function(arg)
    { 
        for(var i in arg)
        {
            if(!this.debug_data[i]) this.debug_data[i] = [];
            this.debug_data[i][ this.debug_data[i].length ] = arg[i]; 
        }
    }; 
    this.clear_layer    = function(n) { this.ctx[n].clearRect(0, 0, this.canvas[n].width, this.canvas[n].height) }
    this.drawPixel      = function(context, x, y, color)
    {
        context.beginPath();
        context.fillStyle = color || '#000';
        context.fillRect(Math.round(x), Math.round(y), 1, 1);
        context.fill();
    }
    this.insert_canvas = function(arg)
    {
        var anchor = document.getElementById(arg.id);
        this.canvas = [ document.createElement('canvas'),document.createElement('canvas') ];

        this.canvas[0].id = "Mycanvas";
        this.canvas[0].width = arg.width;
        this.canvas[0].height = arg.height;
        this.canvas[0].style.zIndex = 0;
        this.canvas[0].style.position = "absolute";
        //this.canvas[0].style.top = "58px";
        anchor.appendChild(this.canvas[0]);

        this.canvas[1].id = "Mycanvas2";
        this.canvas[1].width = arg.width;
        this.canvas[1].height = arg.height;
        this.canvas[1].style.zIndex = 1;
        this.canvas[1].style.position = "absolute";
        this.canvas[1].style.cursor = "crosshair";
        //this.canvas[1].style.top = "58px";

        anchor.appendChild(this.canvas[1]);
      
        this.ctx    = [ this.canvas[0].getContext("2d"),this.canvas[1].getContext("2d")];
    }

    this.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
    this.getHexByte    = function(v) { return this.hextab[v>>4]+this.hextab[v&0xf] }
    this.HEX2RGB       = function(hex) { var n=parseInt(hex.slice(1),16); return [(n>>16)&0xFF,(n>>8)&0xFF,n&0xFF] }
    this.RGB2HEX       = function(dec) { return [this.getHexByte(dec[0]),this.getHexByte(dec[1]),this.getHexByte(dec[2])] }
    this.colorDistance = function(a,b) { return Math.sqrt(Math.pow(a[0]-b[0],2)+ Math.pow(a[1]-b[1],2)+Math.pow(a[2]-b[2],2)) }
    this.colorSaturation = function(a) {
        var avg = Math.round((a[0]+a[1]+a[2])/3);
        if(avg==0) return 0;
        return Math.round(100*this.colorDistance(a,[avg,avg,avg])/avg)
    }
    this.brightness = function(dec) { return Math.round( (0.299*dec[0]+0.587*dec[1]+0.114*dec[2])/255*100 ) }

    this.color_depth_transform = function(triple,bits)
    {
        p = Math.pow(2, bits[0]/3 );
        q = Math.pow(2, bits[1]/3 );
        var t = [Math.min(255,Math.round( Math.floor(triple[0]/(p/q))*(p-1)/(q-1) ))
                ,Math.min(255,Math.round( Math.floor(triple[1]/(p/q))*(p-1)/(q-1) ))
                ,Math.min(255,Math.round( Math.floor(triple[2]/(p/q))*(p-1)/(q-1) ))]
        return t;
    }
    
    this.calc_nearest = function(x,y,dec_cx)
    {
        if(dec_cx.join("")=="000") return;

        for(var i=0;i<this.dec_pal.length;i++)
        {
            var cd = [ this.colorDistance(dec_cx,this.dec_pal[i])                   // picked color  - palette color
                      ,this.colorDistance(this.dec_near_col[i],this.dec_pal[i]) ]   // closest match - palette color
            if( cd[0] <  cd[1] )
            {
                this.dec_near_col[i] = dec_cx; 
                this.dec_near_pos[i] = [[x,y]];
            }
            else if(cd[0] ==  cd[1])
            {
                this.dec_near_pos[i][ this.dec_near_pos[i].length ] = [x,y];
                return;
            }
        }
    }    

    this.get_nearest = function(dec_cx)
    {
        var dec_near_col=[-1,-1,-1], near_idx = "*";
        for(var i=0;i<this.dec_pal.length;i++)
        {
            if(oPATTERN.criteria[i]) continue;  // TODO EXTERNALISE THIS FUNCTION


            var cd = [ this.colorDistance(dec_cx,this.dec_pal[i])                   // picked color  - palette color
                      ,this.colorDistance(dec_near_col,this.dec_pal[i]) ]   // closest match - palette color
            if( cd[0]!=0 && cd[0] <  cd[1] )
            {
                dec_near_col = this.dec_pal[i];
                near_idx = i;
            }
        }
        return "idx:"+near_idx+" d:"+Math.round(this.colorDistance(dec_cx,this.dec_pal[near_idx]));
    } 

    this.draw_rainbow = function()
    {
        this.clear_layer(0);
        this.dec_pal      = [];
        this.dec_near_col = [];
        this.dec_near_pos = [];
        var width  = this.canvas[0].width;
        var height = this.canvas[0].height;

        // initialise color arrays
        for(var i=0;i<this.hex_pal.length;i++)
        {
            this.dec_pal[i]      = this.hex_pal[i]?this.HEX2RGB(this.hex_pal[i]):[0,0,0];
            this.dec_near_col[i] = [0,0,0];
            this.dec_near_pos[i] = [0,0];
        }

        for(var y=0;y<height;y++)
        {
            for(var x=0;x<width;x++)
            { 
                var dec_cx = this.sweep_section(x,y,width,height);
                //////////////////////////////////////////////////////
                dec_cx = this.color_depth_transform(dec_cx,[24,this.color_depth]);  // Color depth modifier
                //////////////////////////////////////////////////////
                var hex_cx = this.RGB2HEX(dec_cx);
                this.drawPixel(this.ctx[0], x, y, '#'+hex_cx.join(""));
                this.calc_nearest(x,y,dec_cx);
            }
        }

        // calculate center location of closest color
        for(var i=0;i<this.dec_near_col.length;i++)
        {
            if(this.dec_near_pos[i].length>1)
            {
                for(var j=0,avg = [0,0] ;j<this.dec_near_pos[i].length;j++)
                {   
                    avg[0] += this.dec_near_pos[i][j][0];
                    avg[1] += this.dec_near_pos[i][j][1];
                }
                this.dec_near_pos[i][0][0] = avg[0]/this.dec_near_pos[i].length;
                this.dec_near_pos[i][0][1] = avg[1]/this.dec_near_pos[i].length;
            }
        }
        bUpdate = true;     // allow new updates
    }

    this.draw_colormatches = function()
    {
        //this.clear_layer(1);
        var width  = this.canvas[0].width;
        var height = this.canvas[0].height;
    
        for(var p=0;p<this.dec_near_col.length;p++)
        {
            var cc = oPATTERN.criteria[p]                    // TODO INCOPORATE CHECK_CRITERIA2

            /*
            if(Object.keys(this.limit_dots).length>0
                && this.limit_dots[p]!=true) continue;      // RANGE SELECT CRITERIA
            if(_D.filterExcl && cc[0]) continue;            // PATTERN EXCLUSION CRITERIA
            */

            if(Object.keys(this.limit_dots).length>0
            && oPALETTE.limit_dots[p]!=true) continue;                 // RANGE SELECT CRITERIA
            if(Object.keys(this.limit_dots).length!=1 
            && _D.filterExcl && cc) continue;   // PATTERN EXCLUSION CRITERIA

            var x = this.dec_near_pos[p][0][0];
            var y = this.dec_near_pos[p][0][1];

            var hex_dx = this.RGB2HEX(this.dec_near_col[p]);
            var hex_cx = this.RGB2HEX(this.dec_pal[p]);
            
            var sec = this.define_section(x,y,width,height);

            // DRAW CIRCLE
            this.ctx[1].beginPath();
            this.ctx[1].arc(x, y, this.dot_size, -0.5*Math.PI, 1.5*Math.PI);
            this.ctx[1].lineWidth=1;
            this.ctx[1].strokeStyle = "#000000";
            this.ctx[1].stroke();
            this.ctx[1].fillStyle = '#'+hex_cx.join("")
            this.ctx[1].fill();

            /*
            this.ctx[1].beginPath();
            this.ctx[1].arc(x, y, this.dot_size, 0.5*Math.PI, 1.5*Math.PI);
            this.ctx[1].lineWidth=1;
            this.ctx[1].strokeStyle = "#000000";
            this.ctx[1].stroke();
            this.ctx[1].fillStyle = '#'+hex_dx.join("")
            this.ctx[1].fill();
            */

            // DRAW PATTERN INDEX NUMBER
            //this.ctx[1].fillStyle = sec.y==0?'#FFF':"#000"
            this.ctx[1].fillStyle = this.brightness(this.dec_near_col[p]) > 70 ?"#000":"#FFF"
            this.ctx[1].font = (this.dot_size*1.4)+"px Arial bold";
            this.ctx[1].textAlign = "center"; 
            this.ctx[1].textBaseline = "middle";
            this.ctx[1].fillText(this.brightness(this.dec_near_col[p]) , x, y);

            /*
            // DRAW COLOR VALUE
            this.ctx[1].fillStyle = sec.y==0?'#FFF':"#000"
            this.ctx[1].font = (this.dot_size)+"px Arial bold";
            this.ctx[1].textAlign = "center"; 
            this.ctx[1].textBaseline = "middle";
            this.ctx[1].fillText('#'+hex_cx.join("") , x, y+10);
            */
            
        }
    }

    this.define_section = function(x,y,width,height)
    {
        var fac_x = x/width;
        var fac_y = y/height;
        var sec   = Math.floor(fac_x*this.sec_n[0]);
        var sec_x = fac_x*this.sec_n[0]-sec;
        var sec_y = fac_y>0.5?1:0;
        var dec_y = fac_y*2>1?1:fac_y*2;
        var inc_y = fac_y*2-1;

        return {"x":sec_x,"y":sec_y,"n":sec_y?sec+this.sec_n[1]:sec,"inc_y":inc_y,"dec_y":dec_y};
    }

    this.sweep_section = function(x,y,width,height)
    {
        var section = this.define_section(x,y,width,height);
        var sec_x=section["x"],sec_y=section["y"],sec=section["n"],inc_y=section["inc_y"],dec_y=section["dec_y"]

        var toRad = function(angle) { return angle * (Math.PI / 180) }

        if(this.bDebug) this.debug_save({"x":x,"y":sec_x*(width/this.sec_n[0])});
        ////////////////////////////////////////////////////////////////
        if(sec & 1) sec_x += 0.22*Math.sin(toRad(180+180*sec_x));     //  Bend x
        else        sec_x += 0.22*Math.sin(toRad(180*sec_x));         //
        ////////////////////////////////////////////////////////////////
        if(this.bDebug) this.debug_save({"x":x,"y":sec_x*(width/this.sec_n[0])});

        return this.calc_section(sec,sec_x,inc_y,dec_y);
    }

    this.calc_section = function(sec,sec_x,inc_y,dec_y)
    {
        function r(v) { return Math.floor(v) }
        var drk = {  "up":r(sec_x*255*dec_y)
                    ,"dn":r(255*(1-sec_x)*dec_y)
                    ,"max":255*dec_y,"min":0
                    ,"uh0":r(sec_x*128*dec_y)
                    ,"uh1":r(256*sec_x*dec_y)
                    ,"dh0":r((128-sec_x*128)*dec_y)
                    ,"dh1":r((251-sec_x*128)*dec_y)
        }
        var lgt = {  "up":r(drk.up+(255-drk.up)*inc_y)
                    ,"dn":r(drk.dn+(255-drk.dn)*inc_y)
                    ,"max":r(drk.max+(255-drk.max)*inc_y)
                    ,"min":r(drk.min+(255-drk.min)*inc_y)
                    ,"uh0":r(drk.uh0+ inc_y*256 -inc_y*sec_x*128 )
                    ,"dh1":r(drk.dh1+ inc_y*sec_x*128)
        }
        
        switch(sec)
        {
            case 0: return [drk.up,drk.min,drk.max];
            case 1: return [drk.max,drk.min,drk.dn];
            case 2: return [drk.max,drk.up,drk.min];
            case 3: return [drk.dn,drk.max,drk.min];
            case 4: return [drk.min,drk.max,drk.up];
            case 5: return [drk.min,drk.dn,drk.max];
            case 6: return [drk.uh0,drk.uh0,drk.dh1];
            case 7: return [drk.dh0,drk.dh0,drk.uh1];

            case 8: return  [lgt.up,lgt.min,lgt.max];
            case 9: return  [lgt.max,lgt.min,lgt.dn];
            case 10: return [lgt.max,lgt.up,lgt.min];
            case 11: return [lgt.dn,lgt.max,lgt.min];
            case 12: return [lgt.min,lgt.max,lgt.up];
            case 13: return [lgt.min,lgt.dn,lgt.max];
            case 14: return [lgt.uh0,lgt.uh0,lgt.dh1];
            case 15: return [lgt.dn,lgt.dn,lgt.max];

            default: return [255,255,255]
        }
    }
}