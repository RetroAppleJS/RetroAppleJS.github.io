var YVERTL = "0000000000000000"
+"8080808080808080"
+"0000000000000000"
+"8080808080808080"
+"0000000000000000"
+"8080808080808080"
+"0000000000000000"
+"8080808080808080"
+"2828282828282828"
+"A8A8A8A8A8A8A8A8"
+"2828282828282828"
+"A8A8A8A8A8A8A8A8"
+"2828282828282828"
+"A8A8A8A8A8A8A8A8"
+"2828282828282828"
+"A8A8A8A8A8A8A8A8"
+"5050505050505050"
+"D0D0D0D0D0D0D0D0"
+"5050505050505050"
+"D0D0D0D0D0D0D0D0"
+"5050505050505050"
+"D0D0D0D0D0D0D0D0"
+"5050505050505050"
+"D0D0D0D0D0D0D0D0"





var YVERTH  ="2024282C3034383C"
           +"2024282C3034383C"
           +"2125292D3135393D"
           +"2125292D3135393D"
           +"22262A2E32363A3E"
           +"22262A2E32363A3E"
           +"23272B2F33373B3F"
           +"23272B2F33373B3F"
           +"2024282C3034383C"
           +"2024282C3034383C"
           +"2125292D3135393D"
           +"2125292D3135393D"
           +"22262A2E32363A3E"
           +"22262A2E32363A3E"
           +"23272B2F33373B3F"
           +"23272B2F33373B3F"
           +"2024282C3034383C"
           +"2024282C3034383C"
           +"2125292D3135393D"
           +"2125292D3135393D"
           +"22262A2E32363A3E"
           +"22262A2E32363A3E"
           +"23272B2F33373B3F"
           +"23272B2F33373B3F"


var YVERTL8 = "0080008000800080"
             +"28A828A828A828A8"
             +"50D050D050D050D0"

var YVERTH8  ="2024282C3034383C"
          +"2125292D3135393D"
          +"22262A2E32363A3E"
          +"23272B2F33373B3F"
          +"2024282C3034383C"
          +"2125292D3135393D"
          +"22262A2E32363A3E"
          +"23272B2F33373B3F"
          +"2024282C3034383C"
          +"2125292D3135393D"
          +"22262A2E32363A3E"
          +"23272B2F33373B3F"

var yl = new Array();
var cl = new Array();
var yh = new Array();
for(var i=0;i<YVERTL.length;i+=2)
{
   var i2 = i/2
   var YVL = YVERTL.substring(i,i+2)
   yl[i2] = parseInt( YVL,16);
   var c1 = Math.floor(i2/8)
   var c2 = c1%2 * 128
   var c3 = Math.floor(i2/64) * 40
   cl[i2] = c2 + c3 // calculated equivalent of yl

   var YVH = YVERTH.substring(i,i+2)
   yh[i2] = parseInt( YVH,16);

   //console.log((i2)+" "+yl[i2]+" "+cl[i2])
   yh[i2] = parseInt(YVERTH.substring(i,i+2),16);
   var c4 = 32 + (i2 & (16 + 32)) / 16
   var c5 = (i2 & (4+2+1))*4

   //console.log(i2+" "+yh[i2]+" "+(c4+"+"+c5)+"="+(c4+c5));

   console.log(i2+"\t"+YVH+YVL
                 +"\t("+yh[i2]+")\t"+(c4+"+"+c5)+"="+(c4+c5)
                 +"\t("+yl[i2]+")\t"+(c2+"+"+c3)+"="+(c2+c3))

}

/*
var yv2 = new Array();
for(var i=0;i<YVERTL8.length;i+=2)
{
   //for(var j=0;j<8;j++)  yv2[i*4+j] = parseInt( YVERTL8.substring(i,i+2),16)
   yv2[i/2] = parseInt( YVERTL8.substring(i,i+2),16)

   //console.log((i2)+" "+yv[i2]);
   //console.log(YVERTL.substring(i,i+2));
}


for(var i=0;i<yv.length;i++)
{
  console.log(i+" "+yv[i]+" "+yv2[i>>4])
}
*/
