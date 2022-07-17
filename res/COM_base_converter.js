var oBASE = new function BASE() {

  this.convert = function (str, fromBase, toBASE)
  {
    if(typeof(fromBase)=='object') { this.fromSymbols = fromBase[0] } else this.fromSymbols = this.getsymbols(fromBase);
    if(typeof(toBASE)  =='object') { this.toSymbols = toBASE[0] } else this.toSymbols = this.getsymbols(toBASE);
    fromBase = this.fromSymbols.length; toBASE = this.toSymbols.length;

    // PARSE INPUT DIGITS ARRAY
    for(var _a = [0], str = str.split(''); str.length > 0 && _a[_a.push(this.fromSymbols.indexOf(str.pop())) - 1] >= 0;);
    var _d = _a.shift() + _a[_a.length-1]>=0 ? _a : null; if (_d === null) return null;

    // BASE CONVERSION
    for (var _n = 0,_a = [],_p = [1]; _n < _d.length; _n++) { _a = add(_a, mul(_d[_n], _p, toBASE), toBASE); _p = mul(fromBase, _p, toBASE) }

    // PARSE OUTPUT DIGITS ARRAY
    for (var _n = _a.length - 1, _o = ''; _n >= 0; _o += this.toSymbols[_a[_n--]]);
    return _o.length==0?this.toSymbols[0]:_o;
  }

  this.symbols = {
      32:function(){return this.base32hex},
      36:["[0-9][A-Z]"],
      45:function(){return this["qr-alnum"]},
      58:function(){return this.Bitcoin},
      60:function(){return this.appleII},
      64:function(){return this["RFC 1421"]},
      85:function(){return this["RFC 1924"]},
      91:["[A-Z][a-z][0-9]!#$%&()*+,./:;<=>?@[]^_`{|}~\""],
      92:["[A-Z][a-z][0-9]![#-/][:-@][]^_`[{-~]"],
      94:["[!-~]"],
  "low hex":   ["[0-9][a-f]"],															 // base 16
  "geohash":   ["[0-9][b-h]jkmn[p-z]"],                      // base 32
  "RFC 4648":  ["[A-Z][2-7]"],                               // base 32
  "base32hex": ["[0-9][A-V]"],                               // base 32
  "qr-alnum":  ["[0-9][A-Z] $%*+-./:"],                      // base 45
  "Bitcoin":   ["[1-9][A-H]JKLMN[P-Z][a-k][m-z]"],           // base 58
  "appleII":   ["[0-9][A-Z]![#-/][:-@]]^ "],                 // base 60
  "Base64":    ["[A-Z][a-z][0-9]+/"],												 // base 64
  "RFC 1421":  ["[A-Z][a-z][0-9]+/"],												 // base 64
  "GUID64":    ["[A-Z][a-z][0-9]-_"],                        // base 64
  "RFC 1924":  ["[0-9][A-Z][a-z]!#$%&()*+-;<=>?@^_`{|}~"],   // base 85
  "JS-safe":   ["[0-9][A-Z][a-z]![#-/][:-@]\x5b\x5d[^-`][{-~]"]                  // base 92
  }

  this.getsymbols = function(base) {
    if(typeof(base)=="undefined") return "";
    if(typeof(this.symbols[base])=="undefined")
      this.symbols[base] = base<95?
        (this.rng(base<64?"[0-9][A-Z][a-z]+":"[A-Z][a-z][0-9][!-/][:-@][[-`][{-~]").substring(0,base))
      :(this.symbols[base] = base<216?
        this.rng("[\x20-\x7e]\x80[\x82-\x8c]\x8e[\x91-\x9c]\x9e\x9f[\xa1-\xac][\xae-\xff]").substring(0,base)
        :this.rng("[\x00-\xff]").substring(256-base,256));
    if(typeof(this.symbols[base])=="function")  this.symbols[base] = this.symbols[base]();             // process references
    if(typeof(this.symbols[base])=="object")    this.symbols[base] = this.rng(this.symbols[base][0]);  // process range_replace
    return this.symbols[base];
  }

  this.rng = function(recipe) {
    var _a = recipe.match(/\[.-.\]/); if(_a==null) return recipe; else { _a=[_a[0].charCodeAt(1),_a[0].charCodeAt(3)];
    return this.rng(recipe.replace(RegExp("\\[(\\x"+("0"+_a[0].toString(16)).slice(-2)+"-\\x"+_a[1].toString(16)+")\\]","g"),
    String.fromCharCode(..." ".repeat(_a[1]-_a[0]+1).split("").map((_e,_i)=>_i+_a[0])) )) }
  }

  this.check = function(str) {
    var _a = this.allsymbols(), _o = [], _r = 0;
    for(var _i in _a) {
      var _sym = this.getsymbols(_a[_i]);
      for(var _n=str.length-1;_n>=0 && _sym.indexOf(str.charAt(_n))>=0;_n--);
      if(_n<0) { _r+=this.getsymbols(_o[_r-1])==_sym?-1:0; _o[_r++] = _a[_i] }
    }
    return _o;
  }

  this.allsymbols = function() {
     var _a={}; for(var _o in this.symbols) _a[_o] = this.getsymbols(_o).length; 	// built-in symbols
     for(_o=2;_o<=95;_o++) _a[_o] = this.getsymbols(_o).length; _a[256]=256;     	// symbol range 2-95 + 256 (96-255 is similar)
     var _a = Object.keys(_a).sort(function(a,b){return _a[a]-_a[b]});   					// sort merged list
     return _a;
  }

  this.selftest = function() {
    var _s = "", _a = this.allsymbols();
    for(var _i in _a) {                                                         // iterate number systems
      var _o = {fromBase:10, toBASE:_a[_i]}, _r = this.convert("",10,_o.toBASE);
      _s += "\r\n\oBASE.convert(n,'"+_o.fromBase+"','"+_o.toBASE+"') ["+this.fromSymbols+"] ["+this.toSymbols+"]\r\n";
      for(var _n=0;_n<(this.fromSymbols.length+2);_n++) {                       // iterate numbers
        var _r = this.convert(String(_n),_o.fromBase,_o.toBASE);
        _s += _n+(String(_n)==this.convert(_r,_o.toBASE,_o.fromBase)?">":"?")+"["+_r+"] ";
      }
    }
    return _s;
  }

  var add = function(x, y, base) {
      var _m = Math.max(x.length, y.length);
      for(var _c = 0,_n = 0,_r = [],_z; _n < _m || _c; _c = Math.floor(_z / base)) {
        var _z = _c + (_n < x.length ? x[_n] : 0) + (_n < y.length ? y[_n] : 0);
        var _n =  _r.push(_z % base);
      }
      //console.log("x:"+x+" y:"+y+" base:"+base+" _r:"+_r);
      return _r;
  }

  var mul = function(x, pow, base) {
      for(var _r = x < 0 ? null : []; x > 0; x = x >> 1) {
        if(x & 1) _r = add(_r, pow, base);
        pow = add(pow, pow, base);
      }
      //console.log("x:"+x+" pow:"+pow+" base:"+base+" _r:"+_r);
      return _r;
  }
}()