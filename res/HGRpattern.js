function PATTERN(idx,x,y)
{
    this.color_arr = [];
    this.bmapx = 28;   // grid width
    this.bmapy = 12;   // grid height

    function ltrim(s) { return s.replace(/^ */,"") }
    function rtrim(s) { return s.replace(/ *$/,"") }
    function trim(s)  { return rtrim(ltrim(s)) }

    function editable_map(x,y)
    {
      if(x<0) return [false,0];
      return custom_bmap[x%this.bmapx][y%this.bmapy];
    }

    
    this.exclude = function(idx,arr)
    {
      var arr = [4,6,8,9,12,13,14,16,17,18,19,21,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,44,45,46,47,48,49,50,51,52,54,56,57,59,64,65,66,67,68,69
        ,70,71,72,73,74,75,76,77,78,79,82,83,84,86,88,89,92,93,97,98,99,100,101,102,103,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,124,126,129,132,133,134,135,136,137,138,139
      
      ]

      // exclude white with black mixed with color
      // exclude where upper & lower nibble correspond with lower & upper

      for(var i=0;i<arr.length;i++)
        if(idx>=arr[i]) idx++;
      return idx;
    }

    this.calculate = function(idx,x,y)
    {
        var p = idx;
        //var p = this.exclude(idx);
        
        var ba = [0,1,3];
        if((y&1)==0)
          return [0,(p&15)&(1<<(x%4))?1:0,(ba[(p>>8)&3]&1)*128];
        else 
         return [0,((p>>4)&15)&(1<<(x%4))?1:0,(ba[(p>>8)&3]&2)*64];
    }
    
  /*  
    this.calculate = function(idx,x,y)
    {
      // output = [color_index, pixel_decision, high_bit ]

      // TODO RETURN ALL COMBINATIONS OF 8 visible bits and 2 invisible
      var p = idx&(1<<10);
      var ba = [0,1,3];
      var bp = [p&15,ba[(p>>8)&3]&1,(p>>4)&15,ba[(p>>8)&3]&2];

      switch(idx)
      {
        case 0:  return  [0,editable_map(x,y)[0],editable_map(x,y)[1]];
        //case 1:  return  [0,eval(custom_fmla[0]),eval(custom_fmla[1])];
        //case 2:  return  [0,false,0];               // black 1 
        case 1:  return  [0,(x+1)%2==0,0];            // green 
        case 2:  return  [0,x%2==0,0];                // purple
        case 3:  return  [0,true,0];                  // white 1  
        case 4:  return  [0,false,128];               // black 2
        case 5:  return  [0,(x+1)%2==0,128];         // orange
        case 6:  return  [0,x%2==0,128];              // blue
        case 7:  return  [0,true,128];                // white2 2

        case 10: return  [0 ,(x+1)%2==0 && y%2==0,0];  // dark green 
        case 11: return  [0 ,x%2==0 && y%2==0,0];      // dark purple       
        case 12: return  [0 ,(x+1)%2==0 && y%2==0,128];// dark orange
        case 13: return  [0 ,x%2==0 && y%2==0,128];    // dark blue
        case 14: return  [0 ,(x+1)%2==0 || y%2==0,0];  // dark green 
        case 15: return  [0 ,x%2==0 || y%2==0,0];      // dark purple    
        case 16: return  [0 ,(x+1)%2==0 || y%2==0,128];// dark orange
        case 17: return  [0 ,x%2==0 || y%2==0,128];    // dark blue
        case 18: return  [0 ,y%2==0,0];
        case 19: return  [0 ,(!(x&1)==0 && y%3==0) || (!(x&1)==0 && y%3==1) || (1 && y%3==2),y%3!=1?128:0 ];

        case 20: return  [0 ,(x+1)%2==0 && y%2==0 || x%2==0 && y%2!=0,0];
        case 21: return  [0 ,(x+1)%2==0,y%2!=0?128:0];
        case 22: return  [0 ,(x+1)%2==0 && y%2==0 || x%2==0 && y%2!=0,y%2!=0?128:0];
        case 23: return  [0 ,x%2==0 && y%2==0 || (x+1)%2==0 && y%2!=0,y%2!=0?128:0];
        case 24: return  [9 ,x%2==0,y%2!=0?128:0];
        case 25: return  [0 ,(x+1)%2==0 && y%2==0 || x%2==0 && y%2!=0,128];
        case 26: return  [0 ,(y&1)==0 && (x&3)==0 || (y&1)==1 && (x&3)==2 ,0];
        case 27: return  [0 ,(y&1)==0 && (x&3)==1 || (y&1)==1 && (x&3)==3 ,0];
        case 28: return  [0 ,(y&1)==0 && (x&3)==0 || (y&1)==1 && (x&3)==2 ,128];
        case 29: return  [0 ,(y&1)==0 && (x&3)==1 || (y&1)==1 && (x&3)==3 ,128];          

        case 30: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x+1)%2==0) || y%2!=0 && (x+1)%2!=0,0]; 
        case 31: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x+1)%2==0) || y%2!=0 && x%2!=0,y%2!=0?128:0];   
        case 32: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x+1)%2==0) || y%2!=0 && (x+1)%2!=0,y%2!=0?128:0]; 
        case 33: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x)%2==0)   || y%2!=0 && x%2!=0,y%2!=0?128:0];  
        case 34: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x)%2==0)   || y%2!=0 && (x+1)%2!=0,y%2!=0?128:0]; 
        case 35: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x+1)%2==0) || y%2!=0 && (x+1)%2!=0,128];  
        case 36: return  [0 ,y%2==0 && ( (x>>1)%2!=0 || (x+1)%2==0) || y%2!=0 && x%2!=0,y%2==0?128:0];
        case 37: return  [0 ,(x%2==0 || (x+1)%4==0) && y%2==0 || (x%2==0 || (x+2)%4==0) && y%2!=0,y%2==0?128:0 ];
        case 38: return  [0 ,(x>>1)%2==0 && y%2==0 ,0 ];

        case 40: return  [0, (x%2==0 || (x+1)%4==0) && y%2==0 || (x%2==0 || (x+3)%4==0) && y%2!=0,0 ];
        case 41: return  [0, ((x+1)%2==0 || (x+2)%4==0) && y%2==0 || ((x+1)%2==0 || (x+4)%4==0) && y%2!=0,0 ];
        case 42: return  [0, ((x+1)%2==0 || (x+2)%4==0) && y%2==0 || ((x+1)%2==0 || (x+4)%4==0) && y%2!=0,y%2==0?128:0 ];
        case 43: return  [0, (x%2==0 || (x+1)%4==0) && y%2==0 || (x%2==0 || (x+3)%4==0) && y%2!=0,y%2==0?128:0 ];
        case 44: return  [0 ,y%2==0 && (x>>1)%2!=0 || y%2!=0,0];

        case 50: return  [0 ,(y&1)==0 && (x&3)==1 || (y&1)==1 && (x&3)==3 ,(y&1)<<7];
        case 51: return  [0 ,(y&1)==0 && (x&3)==0 || (y&1)==1 && (x&3)==2 ,(y&1)<<7];
        case 52: return  [0 ,(y&1)==0 && ((x+1)&3)==0,0];
        case 53: return  [0 ,(y&1)==0 && (x&3)==0,0];
        case 54: return  [0 ,(y&1)==0 && ((x+1)&3)==0,128];
        case 55: return  [0 ,(y&1)==0 && (x&3)==0,128];

        case "": return  [0,true,0];
        default: return  [null,false,0];  
      }
  }
  */

  this.colorIDX = {}

  this.color = function(patternID,colorFN)
  {
    this.colorIDX = {};
    var m = 1;
    var col_m = 255 * m * m * this.bmapx * this.bmapy;
    var max_sum = [col_m,col_m,col_m];
    var col_sum = [0,0,0];

      // color sampler
      for(var y=0;y<this.bmapy*m;y++)
      {
        for(var x=0;x<this.bmapx*m;x++)
        {
          var left = this.calculate(patternID,x-1,y)[1];
          var me = this.calculate(patternID,x,y)[1];
          var right = this.calculate(patternID,x+1,y)[1];
          var b7 = this.calculate(patternID,x,y)[2];
          var col = colorFN(x, y, left, me, right, b7);
          col_sum = [ col_sum[0] + parseInt(col.substring(1,3),16)
                    , col_sum[1] + parseInt(col.substring(3,5),16)
                    , col_sum[2] + parseInt(col.substring(5,7),16)];

          //if(y==0 && x==0) document.write(col+"<br>")
          this.colorIDX[col] = true;
        }
      }
      // calculate color average
      return [col_sum[0]/max_sum[0]*255, col_sum[1]/max_sum[1]*255, col_sum[2]/max_sum[2]*255 ];
  }

  this.parse = function()
  {
    // PARSE PATTERN FUNCTION - CASE BY CASE
    var formula_list = String(this.calculate).split("return");
    var formula_ref = {};
    for(var i=1;i<formula_list.length;i++)
    {
      var casenr = formula_list[i-1].split("case")[1];
      var triple = trim( formula_list[i].substring(0,formula_list[i].indexOf(";")) );
      var arr = triple.split(/([()])/);
      var levels = []; c =0;
      for(var l=0;l<arr.length;l++)
        {levels.push(c==0?arr[l].replace(/,/g,",,,,,"):arr[l]) ; c+=(arr[l]=='('?1:0) + (arr[l]==')'?-1:0);   }
      
      if(typeof(casenr)=="string" && casenr.indexOf(":")>0 && triple.charAt(0)=="[")
      {
        casenr = Number(casenr.substring(0,casenr.indexOf(":")));
        var fml = levels.join("").split(",,,,,")
        formula_ref[casenr] = [ fml[1] , fml[2].substring(0,fml[2].lastIndexOf("]")) ];  // TODO fix EOL sign !
      }
    }
    return formula_ref
  }

  this.pixel = function(x,y,patternID,rbyt)
  {
      var wbyt = rbyt | (1 << x%7);                     // OR current bit with pixel bit
      if(rbyt ==0 && rbyt&8 != this.calculate(patternID,x,y)[2])
        wbyt |= this.calculate(patternID,x,y)[2];    // OR high bit
      else
      {
        wbyt |= this.calculate(patternID,x,y)[2];
        //document.getElementById("debug").innerHTML += "CONFLICT "+PRINTByte(rbyt)+" >> "+PRINTByte(wbyt)
      }  // TODO resolve Hi-Byte conflict !!

      if(this.calculate(patternID,x,y)[1]) return wbyt;
      return rbyt;
  }
}