function COM()
{
  // v1.06 - PANE namespace + floating find navigation focus fix
  /*
  this.debugMe = function()
  {
    var o = apple2plus.DiskObj();
    oCOM.Download('dump.nib',o.diskBytes[0])
  }
    */


  const hexLookupTable = new Array(256);
  for (let i = 0; i < 256; i++) {
    hexLookupTable[i] = i.toString(16).padStart(2, '0');
  }

  const hex2tab=[
    "00","01","02","03","04","05","06","07","08","09","0A","0B","0C","0D","0E","0F","10","11","12","13","14","15","16","17","18","19","1A","1B","1C","1D","1E","1F",
    "20","21","22","23","24","25","26","27","28","29","2A","2B","2C","2D","2E","2F","30","31","32","33","34","35","36","37","38","39","3A","3B","3C","3D","3E","3F",
    "40","41","42","43","44","45","46","47","48","49","4A","4B","4C","4D","4E","4F","50","51","52","53","54","55","56","57","58","59","5A","5B","5C","5D","5E","5F",
    "60","61","62","63","64","65","66","67","68","69","6A","6B","6C","6D","6E","6F","70","71","72","73","74","75","76","77","78","79","7A","7B","7C","7D","7E","7F",
    "80","81","82","83","84","85","86","87","88","89","8A","8B","8C","8D","8E","8F","90","91","92","93","94","95","96","97","98","99","9A","9B","9C","9D","9E","9F",
    "A0","A1","A2","A3","A4","A5","A6","A7","A8","A9","AA","AB","AC","AD","AE","AF","B0","B1","B2","B3","B4","B5","B6","B7","B8","B9","BA","BB","BC","BD","BE","BF",
    "C0","C1","C2","C3","C4","C5","C6","C7","C8","C9","CA","CB","CC","CD","CE","CF","D0","D1","D2","D3","D4","D5","D6","D7","D8","D9","DA","DB","DC","DD","DE","DF",
    "E0","E1","E2","E3","E4","E5","E6","E7","E8","E9","EA","EB","EC","ED","EE","EF","F0","F1","F2","F3","F4","F5","F6","F7","F8","F9","FA","FB","FC","FD","FE","FF"];
  
  this.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F']; // TODO: remove from entire codebase
  this.getHexByte    = function(v)   { return hex2tab[v&0xFF] }
  this.getHexWord    = function(v)   { return hex2tab[v>>8] + hex2tab[v&0xFF] }
  this.getHexMulti   = function(v,m) { return ("0".repeat(m)+v.toString(16)).slice(-m).toUpperCase() }
  this.getBinMulti   = function(v,m) { return ("0".repeat(m)+v.toString(2)).slice(-m).toUpperCase() }
  //this.getNumByteArr = function(v)   { let y= Math.floor(v/2**32); return [y,(y<<8),(y<<16),(y<<24), v,(v<<8),(v<<16),(v<<24)].map(z=> z>>>24) } // convert JS number to byte array
  this.getNumByteArr = function(v)   { let y= Math.floor(v/2**32); return [(v<<24),(v<<16),(v<<8),v,(y<<24),(y<<16),(y<<8),y].map(z=> z>>>24) } // convert JS number to byte array
  this.getByteArrNum = function(arr) { return arr.reduce((a,c,i)=> a+c*2**(56-i*8),0) } // convert byte array to JS number

  this.HEX2RGB       = function(hex)   { var n=parseInt(hex.slice(1),16); return [(n>>16)&0xFF,(n>>8)&0xFF,n&0xFF] }
  this.RGB2HEX       = function(color) { return [hex2tab[color[0]&0xFF],hex2tab[color[1]&0xFF],hex2tab[color[2]&0xFF]] }

  this.RGB2IDX       = function(color,sig_bits)
  {
      const msk = (1<<sig_bits)-1, scl = (8-sig_bits);
      return (((color[2]>>scl)&msk)<<sig_bits<<sig_bits) | (((color[1]>>scl)&msk)<<sig_bits) | ((color[0]>>scl)&msk)
  }

  this.IDX2RGB       = function(idx,sig_bits)
  {
      const msk = (1<<sig_bits)-1, scl = (8-sig_bits);
      return [(idx & msk)<<scl,((idx>>sig_bits) & msk)<<scl,((idx>>sig_bits>>sig_bits) & msk)<<scl];
  }

  this.expandRngExpr = function(spec, modifiers = {})
  {
    return this.expandRng(this.parseRngExpr(spec, modifiers));
  };

  this.parseRngExpr = function(spec, modifiers = {})
  {
    const locate = modifiers._locate_ || ["<sub>", "</sub>"];
    const vars = { ...modifiers };
    delete vars._locate_;

    const [rangePart, stepPart] = splitOutsideTags(spec, "/", locate);
    const [fromPart, toPart]    = splitOutsideTags(rangePart, "-", locate);
    const base = vars.base || 0;

    var ret = {};
    ret.from = parseRngToken(fromPart.trim(), vars, locate) - base;
    if (toPart == null) return ret;       // single value expression
    ret.to = parseRngToken(toPart.trim(), vars, locate) - base;
    if(stepPart != null) ret.step = parseRngToken(stepPart.trim(), vars, locate);
    return ret;
  };
                        
  this.expandRng = function(a, b, c)
  {
    let from, to, step;

    if (typeof a === "object" && a !== null) {
      from = a.from;
      to   = a.to;
      step = (a.step === undefined) ? 1 : a.step;
    } else {
      from = a;
      to   = b;
      step = (c === undefined) ? 1 : c;
    }

    if (!Number.isInteger(from) || !Number.isInteger(to) || !Number.isInteger(step) || step === 0) {
      throw new Error("expandRng expects integer from/to and a non-zero integer step");
    }

    if (from > to && step > 0) step = -step;
    if (from < to && step < 0) step = -step;

    const out = [];
    if (step > 0) {
      for (let n = from; n <= to; n += step) out.push(n);
    } else {
      for (let n = from; n >= to; n += step) out.push(n);
    }
    return out;
  };

  this.arrayRng = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  this.asHex = function(arr)
  {
    if (typeof arr === "number") arr = [arr];
    return arr.map(function(n) {
      return "0x" + n.toString(16).toUpperCase();
    });
  };

  function parseRngToken(token, vars = {}, locate = ["<sub>", "</sub>"])
  {
    let s = String(token).replace(/\s+/g, "");
    const isHex = s.startsWith("$");
    if (isHex) s = s.slice(1);

    const base = isHex ? 16 : 10;
    const [openTag, closeTag] = locate;
    const digitRe = isHex ? /[0-9A-Fa-f]/ : /[0-9]/;

    let skeleton = "";
    const terms = [];

    for (let i = 0; i < s.length;) {
      if (s.startsWith(openTag, i)) {
        const end = s.indexOf(closeTag, i + openTag.length);
        if (end < 0) throw new Error("Missing closing tag");

        const expr = s.slice(i + openTag.length, end).trim();
        if (!expr) throw new Error("Empty tagged expression");

        terms.push({ expr: expr, pos: skeleton.length });
        skeleton += "0";   // one digit slot placeholder
        i = end + closeTag.length;
        continue;
      }

      if (!digitRe.test(s[i])) {
        throw new Error("Invalid digit '" + s[i] + "' in token: " + token);
      }

      skeleton += s[i];
      i++;
    }

    if (!skeleton.length) throw new Error("Empty numeric token");

    const baseValue = parseInt(skeleton, base);
    let value = baseValue;

    for (let i = 0; i < terms.length; i++) {
      const digitsRight = skeleton.length - terms[i].pos - 1;
      value += evalExpr(terms[i].expr, vars) * (base ** digitsRight);
    }

    return value;
  }

  function evalExpr(expr, vars)
  {
    const jsExpr = expr.replace(/\$/g, "0x");
    const names = Object.keys(vars);
    const vals  = names.map(function(k) { return vars[k]; });

    const ret = Function(...names, `"use strict"; return (${jsExpr});`)(...vals);

    if (!Number.isFinite(ret) || !Number.isInteger(ret))
      throw new Error("Expression must evaluate to an integer: " + expr);

    return ret;
  }

  function splitOutsideTags(str, sep, locate)
  {
    const [openTag, closeTag] = locate;
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      if (str.startsWith(openTag, i)) {
        depth++;
        i += openTag.length - 1;
        continue;
      }
      if (depth > 0 && str.startsWith(closeTag, i)) {
        depth--;
        i += closeTag.length - 1;
        continue;
      }
      if (depth === 0 && str[i] === sep) {
        return [str.slice(0, i), str.slice(i + 1)];
      }
    }

    return [str, null];
  }

  this.base64ToArray = function(base64)
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
          binary += String.fromCharCode( bytes[ i ] );
      }
      return window.btoa( binary );
  }

  this.b64EncodeUnicode = function(str)
  {
    // first we use encodeURIComponent to get percent-encoded Unicode,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }))
  }

  this.b64DecodeUnicode = function(str)
  {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''))
  }

  this.Uint8ArrayFromBase64 = function(base64)
  {
    return Uint8Array.from(window.atob(base64), (v) => v.charCodeAt(0));
  }

  this.Uint8ArrayToBase64 = function(a)
  {
    // 1. Preprocess Uint8Array into String
    // (TODO: fix RAM usage from intermediate array creation)
    var a_s = Array.prototype.map.call(a, c => String.fromCharCode(c)).join(String());
    // 2. Call btoa()
    return btoa(a_s);
  }

  this.DumpBase64 = function(b64body,maxlen,lf)
  {
    var lf = lf===undefined ? "\n" : lf;
    var maxlen = maxlen===undefined ? 1024 : maxlen;
    var re = RegExp(".{1,"+maxlen+"}","g");
    return "var b64 ="+lf+" \""+b64body.match(re).join('"'+lf+'+"')+"\";"+lf
  }

  this.DumpTxt = function(txt,maxlen,lf)
  {
    var lf = lf===undefined ? "\n" : lf;
    var maxlen = maxlen===undefined ? 1024 : maxlen;
    var re = RegExp(".{1,"+maxlen+"}","g");
    return txt.match(re).join(lf);
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

    function add(x, y, base) {
        var _m = Math.max(x.length, y.length);
        for(var _c = 0,_n = 0,_r = [],_z; _n < _m || _c; _c = Math.floor(_z / base)) {
          var _z = _c + (_n < x.length ? x[_n] : 0) + (_n < y.length ? y[_n] : 0);
          var _n =  _r.push(_z % base);
        }
        return _r;
    }

    function mul (x, pow, base) {
        for(var _r = x < 0 ? null : []; x > 0; x = x >> 1) {
          if(x & 1) _r = add(_r, pow, base);
          pow = add(pow, pow, base);
        }
        return _r;
    }

    return _o.length==0?this.toSymbols[0]:_o;
  }

  this.symbols = 
  {
    32:function(){return this.base32hex},
    45:function(){return this["qr-alnum"]},
    58:function(){return this.Bitcoin},
    60:function(){return this.appleII},
  "low hex":   ["[0-9][a-f]"],															 // base 16
  "qr-alnum":  ["[0-9][A-Z] $%*+-./:"],                      // base 45
  "Bitcoin":   ["[1-9][A-H]JKLMN[P-Z][a-k][m-z]"],           // base 58
  "appleII":   ["[0-9][A-Z]![#-/][:-@]]^ "],                 // base 60
  "Base64":    ["[A-Z][a-z][0-9]+/"],												 // base 64
  "GUID64":    ["[A-Z][a-z][0-9]-_"]                        // base 64
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

  this.ltrim = function(s) { return s.replace(/^ */,"") }
  this.rtrim = function(s) { return s.replace(/ *$/,"") }
  this.trim  = function(s) { return this.rtrim(this.ltrim(s)) }
  this.stripHTML = function(s) { return s.replace(/(&nbsp;|<([^>]+)>)/ig,"") }
 
  this.padding = function(word_arr, padding_arr) 
  {
    let result = [], lim_word;
    for (let i = 0; i < word_arr.length; i++)
    {
      word_arr[i] = this.unescapeHTML(word_arr[i]);
      lim_word = word_arr[i].length > padding_arr[i] ? word_arr[i].substring(0, padding_arr[i]) : word_arr[i];  // Limit the word to its padding width if it exceeds the available space
      if (i > 0) result.push('&nbsp;'.repeat(Math.max(0, padding_arr[i-1] - result[result.length-1].length ))); // Calculate padding and ensure it's non-negative (no negative space)
      result.push(lim_word);                                                                                    // Add the word to the result array
    }
    return result.join('');                                                                                     // Join the array into a single string
  }

  /*
  //+ Carlos R. L. Rodrigues
  //@ http://jsfromhell.com/classes/math-parser [rev. #3]

  this.MathParser = function()
  {
      var o = this, p = o.operator = {};
      p["+"] = function(n, m){return n + m;}
      p["-"] = function(n, m){return n - m;}
      p["*"] = function(n, m){return n * m;}
      p["/"] = function(m, n){return n / m;}
      p["%"] = function(m, n){return n % m;}
      p["^"] = function(m, n){return Math.pow(n, m);}
      p["~"] = function(m, n){return Math.sqrt(n, m);}
      o.custom = {}
    p.f = function(s, n)
    {
          if(Math[s]) return Math[s](n);
          else if(o.custom[s]) return o.custom[s].apply(o, n);
          else throw new Error("Function \"" + s + "\" not defined.");
      }
    o.add = function(n, f){this.custom[n] = f;}
  }

  this.MathParser.prototype.eval = function(e, ig)
  {
      var v = [], p = [], i, _, a, c = 0, s = 0, x, t = !ig ? e.indexOf("^") : -1, d = null;
      var cp = e, e = e.split(""), n = "0123456789.", o = "+-/*^%~", f = this.operator;
      if(t + 1)
          do{
              for(a = "", _ = t - 1;  _ && o.indexOf(e[_]) < 0; a += e[_], e[_--] = ""); a += "^";
              for(_ = t + 1, i = e.length; _ < i && o.indexOf(e[_]) < 0; a += e[_], e[_++] = "");
              e = e.slice(0, t).concat((this.eval(a, 1) + "").split("")).concat(e.slice(t + 1));
          }
          while(t = cp.indexOf("^", ++t) + 1);
      for(i = 0, l = e.length; i < l; i++){
          if(o.indexOf(e[i]) > -1)
              e[i] == "-" && (s > 1 || d === null) && ++s, !s && d !== null && (p.push(e[i]), s = 2), "+-".indexOf(e[i]) < (d = null) && (c = 1);
          else if(a = n.indexOf(e[i]) + 1 ? e[i++] : "")
      {
              while(n.indexOf(e[i]) + 1) a += e[i++];
              v.push(d = (s & 1 ? -1 : 1) * a), c && v.push(f[p.pop()](v.pop(), v.pop())) && (c = 0), --i, s = 0;
          }
      }
      for(c = v[0], i = 0, l = p.length; l--; c = f[p[i]](c, v[++i]));
      return c;
  }

  this.MathParser.prototype.parse = function(e)
  {
    var p = [], f = [], ag, n, c, a, o = this, v = "0123456789.+-*"+"/^%~(, )";
    for(var x, i = 0, l = e.length; i < l; i++){
      if(v.indexOf(c = e.charAt(i)) < 0) { for(a = c; v.indexOf(c = e.charAt(++i)) < 0; a += c); f.push((--i, a)) }
      else if(!(c == "(" && p.push(i)) && c == ")")
      {
        if(a = e.slice(0, (n = p.pop()) - (x = v.indexOf(e.charAt(n - 1)) < 0 ? y = (c = f.pop()).length : 0)), x)
          for(var j = (ag = e.slice(n, ++i).split(",")).length; j--; ag[j] = o.eval(ag[j]));
        l = (e = a + (x ? o.operator.f(c, ag) : o.eval(e.slice(n, ++i))) + e.slice(i)).length, i -= i - n + c.length;
      }
    }
    return o.eval(e);
  }
  */


  this.MathParser = function()
  {
      p = this.operator = {};
      p["+"] = function(n, m){return n + m}
      p["-"] = function(n, m){return n - m}
      p["*"] = function(n, m){return n * m}
      p["/"] = function(m, n){return n / m}
      p["%"] = function(m, n){return n % m}
      p["^"] = function(m, n){return Math.pow(n, m)}
      p["~"] = function(m, n){return Math.sqrt(n, m)}
      p["&"] = function(m, n){return n & m}
      p["|"] = function(m, n){return n | m}
      p["x"] = function(m, n){return Number("0x"+m)}
      this.custom = {}
    p.f = function(s, n)
    {
      if(Math[s]) return Math[s](n);
      else if(this.custom[s]) return this.custom[s].apply(this, n);
      else throw new Error("Function \"" + s + "\" not defined.");
    }
    this.add = function(n, f){this.custom[n] = f;}

    this.eval = function(e, ig)
    {
      var v = [], p = [], i, _, a, c = 0, s = 0, x, t = !ig ? e.indexOf("^") : -1, d = null;
      var cp = e, e = e.split(""), n = "0123456789ABCDEF.", o = "+-/*^%~&|x", f = this.operator;
      if(t + 1)
        do
        {
          for(a = "", _ = t - 1;  _ && o.indexOf(e[_]) < 0; a += e[_], e[_--] = ""); a += "^";
          for(_ = t + 1, i = e.length; _ < i && o.indexOf(e[_]) < 0; a += e[_], e[_++] = "");
          e = e.slice(0, t).concat((this.eval(a, 1) + "").split("")).concat(e.slice(t + 1));
        }
        while(t = cp.indexOf("^", ++t) + 1);
      for(i = 0, l = e.length; i < l; i++)
      {
        if(o.indexOf(e[i]) > -1)
          e[i] == "-" && (s > 1 || d === null) && ++s, !s && d !== null && (p.push(e[i]), s = 2), "+-".indexOf(e[i]) < (d = null) && (c = 1);
        else if(a = n.indexOf(e[i]) + 1 ? e[i++] : "")
        {
          while(n.indexOf(e[i]) + 1) a += e[i++];
          v.push(d = (s & 1 ? -1 : 1) * a), c && v.push(f[p.pop()](v.pop(), v.pop())) && (c = 0), --i, s = 0;
        }
      }
      for(c = v[0], i = 0, l = p.length; l--; c = f[p[i]](c, v[++i]));
      return c;
    }

    this.parse = function(e)
    {
      var p = [], f = [], ag, n, c, a, o = this, v = "0123456789ABCDEF.+-*/^%~&|x(, )";
      for(var x, i = 0, l = e.length; i < l; i++)
      {
        if(v.indexOf(c = e.charAt(i)) < 0) { for(a = c; v.indexOf(c = e.charAt(++i)) < 0; a += c); f.push((--i, a)) }
        else if(!(c == "(" && p.push(i)) && c == ")")
        {
          if(a = e.slice(0, (n = p.pop()) - (x = v.indexOf(e.charAt(n - 1)) < 0 ? y = (c = f.pop()).length : 0)), x)
            for(var j = (ag = e.slice(n, ++i).split(",")).length; j--; ag[j] = this.eval(ag[j]));
          l = (e = a + (x ? o.operator.f(c, ag) : this.eval(e.slice(n, ++i))) + e.slice(i)).length, i -= i - n + c.length;
        }
      }
      return this.eval(e);
    }

    this.format = function(str,substitutes)
    {
      var pos = str.lastIndexOf(",");
      var out = str.substring(pos+1,str.length);
      var str2 = str.substring(0,pos);

      if(substitutes)
        for(var ii in substitutes)
          out = out.replace(RegExp(ii,"g"),substitutes[ii]);      // substitute all variables

      var arr = String(this.parse(out)).split();
      var i = -1;
      function callback(exp, p0, p1, p2, p3, p4)
      {
        if (exp=='%%') return '%';
        if (arr[++i]===undefined) return undefined;
        exp  = p2 ? parseInt(p2.substr(1)) : undefined;
        var base = p3 ? parseInt(p3.substr(1)) : undefined;
        var val;
        switch (p4)
        {
          case 's': val = arr[i]; break;
          case 'c': val = arr[i][0]; break;
          case 'f': val = parseFloat(arr[i]).toFixed(exp); break;
          case 'p': val = parseFloat(arr[i]).toPrecision(exp); break;
          case 'e': val = parseFloat(arr[i]).toExponential(exp); break;
          case 'x': val = parseInt(arr[i]).toString(base?base:16); break;
          case 'X': val = parseInt(arr[i]).toString(base?base:16).toUpperCase(); break;
          case 'd': val = parseFloat(parseInt(arr[i], base?base:10).toPrecision(exp)).toFixed(0); break;
        }
        val = typeof(val)=='object' ? JSON.stringify(val) : val.toString(base);
        var sz = parseInt(p1);                                          // padding size
        var ch = p1 && p1[0]=='0' ? '0' : ' ';                          // isnull? 
        while (val.length<sz) val = p0 !== undefined ? val+ch : ch+val; // isminus?
        return val;
      }
      var regex = /%(-)?(0?[0-9]+)?([.][0-9]+)?([#][0-9]+)?([scfpexXd%])/g;
      return str2.replace(regex, callback);
    }

  }

  // https://stackoverflow.com/questions/1293147/how-to-parse-csv-data
  this.CSVParser =
  {
    parse:
      function(csv)
      {
        var arr = csv.match( /\s*(\"[^"]*\"|'[^']*'|[^,]*)\s*(,|$)/g ).map( 
          function (csv)
          {
            let m;
            if (m = csv.match(/^\s*,?$/)) return null; // null value
            if (m = csv.match(/^\s*\"([^"]*)\"\s*,?$/)) return "\""+m[1]+"\""; // Double Quoted Text
            if (m = csv.match(/^\s*'([^']*)'\s*,?$/)) return "'"+m[1]+"'"; // Single Quoted Text
            if (m = csv.match(/^\s*(true|false)\s*,?$/)) return m[1] === "true"; // Boolean
            if (m = csv.match(/^\s*((?:\+|\-)?\d+)\s*,?$/)) return parseInt(m[1]); // Integer Number
            if (m = csv.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/)) return parseFloat(m[1]); // Floating Number
            if (m = csv.match(/^\s*(.*?)\s*,?$/)) return m[1]; // Unquoted Text
          }
        )
        if(arr[arr.length-1]==null) arr.pop();
        return arr;
      }
    ,
    stringify:
      function(table, replacer)
      {
          replacer = replacer || function(r, c, v) { return v; };
          var csv = '', c, cc, r, rr = table.length, cell;
          for (r = 0; r < rr; ++r)
          {
              if (r) csv += '\r\n';
              for (c = 0, cc = table[r].length; c < cc; ++c)
              {
                if (c) csv += ',';
                cell = replacer(r, c, table[r][c]);
                if (/[,\r\n"]/.test(cell))
                  cell = '"' + cell.replace(/"/g, '""') + '"';
                csv += (cell || 0 === cell) ? cell : '';
              }
          }
          return csv;
      }
  }

  this.escapeHTML = function(str) 
  {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("&lt;b&gt;", "<b>")
      .replaceAll("&lt;/b&gt;", "</b>")
      .replaceAll("&lt;u&gt;", "<u>")
      .replaceAll("&lt;/u&gt;", "</u>")
      .replaceAll("&lt;i&gt;", "<i>")
      .replaceAll("&lt;/i&gt;", "</i>")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
      .replaceAll("\n","<br>")
      .replaceAll(" ", "&nbsp;");
  }

  this.unescapeHTML = function(str)
  {
    return String(str)
    .replace(/&nbsp;/g, " ")
    .replace(/<br>/g,   "\n")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g,   ">")
    .replace(/&lt;/g,   "<")
    .replace(/&amp;/g,  "&");
  }
/*
  this.unescapeHTML = function(str)
  {
    return str
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, '\u00A0')
    .replace(/&amp;/g, '&');
  }
*/
  this.escapeREGEXP = function(str)
  {
    return str
    .replace(/([\.\^\$\*\+\-\?\(\)\[\]\{\}\\\|])/g, "\\$1")
  }

  this.uuid = function()  // UUID v4
  {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  this.default = function(src_obj,default_obj,message)  // create default object when main object is missing
  {
    try
    {
      var cn = this.default.caller.name;
      //if(cn!="EMU_init")
      //oCOM.POPUP.html("default["+cn+"] typeof(src_obj)="+typeof(src_obj)+" Object.keys(src_obj).length="+Object.keys(src_obj).length+" = "+(typeof(src_obj)=="undefined" || Object.keys(src_obj).length==0 ? "default override" : "main"));

      if(typeof(src_obj)=="undefined" || Object.keys(src_obj).length==0) { console.warn(cn+" : proceeding without "+message); return default_obj }
      return src_obj;
    }
    catch({ name, message })
    {
        //oCOM.POPUP.html("error in oCOM.default ["+cn+"]: "+name+" "+message);
    }
  }

 this.instance_of = function(V, F)
 {
    var O = F.prototype;
    V = V.__proto__;
    while (true)
    {
      if (V === null)
        return false;
      if (O === V)
        return true;
      V = V.__proto__;
    }
  }

  this.toASCIIarr = function(str){for(var a=[],i=0;i<str.length;i++)a.push(str.charCodeAt(i));return a;}  // convert string into array of ascii codes (numbers)

  this.crc16 = function(r){var crc=0xFFFF;var odd; for(var i=0;i<r.length;i++) { crc = crc ^ r[i]; for (var j = 0; j < 8; j++) { odd = crc & 0x0001; crc = crc >> 1; if (odd) { crc = crc ^ 0xA001 }}} return crc };
  this.crc32 = function(r){for(var a,o=[],c=0;c<256;c++){a=c;for(var f=0;f<8;f++)a=1&a?3988292384^a>>>1:a>>>1;o[c]=a}for(var n=-1,t=0;t<r.length;t++)n=n>>>8^o[255&(n^r[t])];return(-1^n)>>>0};

  // simpified (and faster) version of RingBuffer
  this.buffer = function(_capacity,_type)
  {
    switch(_type)
    {
      case 8: var _buffer = new Uint8Array(_capacity); break;
      case 16: var _buffer = new Uint16Array(_capacity); break;
      case 32: var _buffer = new Uint32Array(_capacity); break;
    }
    var _first = 0;
    var _length = 0;

    return {
      pop: function()
      {
        if (_length != _capacity || _length === 0) return 0;
        const index = _first + (_length - 1);
        const last = (index > (_capacity - 1)) ? index - _capacity : index;
        const value = _buffer[last];
        _buffer[last] = 0;
        _length--;
        return value;
      },
      delay: function(value)
      {
        if (--_first < 0) _first = _capacity - 1
        _buffer[_first] = value;
        return _length++;
      }
    }
  }

  // TODO: replace Ringbuffer >> buffer
  this.RingBuffer = function(_capacity)
  {
    /**
     * Constructs a RingBuffer with fixed maximum _capacity.
     * @param {Number} _capacity - maximum number of values in the buffer
     */

    var _buffer      = new Array(_capacity)

    return {
      /**
       * Empties the ring buffer.
       */

      _first:0,
      _length:0,

      debug: function()
      {
        return JSON.stringify( {"buffer":_buffer,"first":this._first,"length":this._length,"capacity":_capacity} )
      },

      clear: function() 
      {
        this._first = 0;
        this._length = 0;
      },
    
      /**
       * Returns the value at the back of the buffer.
       * @returns {any} - the back of the buffer, or `undefined` if empty
       */
      back: function()
      {
        if (this._length === 0) return undefined
        return _buffer[this._last()]
      },
    
      /**
       * Returns the value at the front of the buffer.
       * @returns {any} - the front of the buffer, or `undefined` if empty
       */
      front: function()
      {
        if (this._length === 0) return undefined
        return _buffer[this._first]
      },
    
      /**
       * Pushes a value onto the back of the buffer. If length === _capacity,
       * the value at the front of the buffer is discarded.
       * @param {any} value - value to push
       * @returns {Number} - the current length of the buffer
       */
      push: function(value)
      {
        if (this._length === _capacity) this.shift()
        this._length++;
        _buffer[this._last()] = value;
        return this._length
      },
    
      /**
       * Removes a value from the back of the buffer and returns it. The
       * newly empty buffer location is set to undefined to release any
       * object references.
       * @returns {any} the value removed from the back of the buffer
       * or `undefined` if empty.
       */
      pop: function()
      {
        if (this._length === 0) return undefined
        const value = _buffer[this._last()]
        _buffer[this._last()] = undefined // release reference on memory
        this._length--
        return value
      },
    
      slice: function(pos1,pos2)
      {

      },

      /**
       * Removes a value from the front of the buffer and returns it. The
       * newly empty buffer location is set to undefined to release any
       * object references.
       * @returns {any} the value removed from the front of the buffer
       * or `undefined` if empty.
       */
      shift: function()
      {
        if (this._length === 0) return undefined
        const value = _buffer[this._first]
        _buffer[this._first] = undefined // release reference on memory
        this._length--
        this._right()
        return value
      },
    
      /**
       * Pushes a value on the front of the buffer. If length === _capacity,
       * the value at the back is discarded.
       * @param {any} value - to push onto the front
       * @returns {Number} - the current length of the buffer
       */
      unshift: function(value)
      {
        if (this._length === _capacity) this.pop()
        this._left()
        this._length++
        _buffer[this._first] = value
        return this._length
      },
    
      // Calculates the index of the value at the back of the buffer.
      _last: function()
      {
        const index = this._first + (this._length - 1)
        return (index > (_capacity - 1)) ? index - _capacity : index
      },
    
      // moves the front of the buffer one step toward the back.
      _right: function()
      {
        if (++this._first > (this._capacity - 1)) this._first = 0
      },
    
      // moves the front of the buffer one step forward.
      _left: function()
      {
        if (--this._first < 0) this._first = _capacity - 1
      }
    }
  }

  this.FIFO = function(length)
  {
    var pointer = 0, buffer = []; 
  
    return {
      get  : function(key)
      {
        if (key < 0) return buffer[pointer+key];
        else if (key === false) return buffer[pointer - 1];
        else return buffer[key];
      },
      push : function(item)
      {
        buffer[pointer] = item;
        pointer = (pointer + 1) % length;
        return item;
      },
      prev : function()
      {
        var tmp_pointer = (pointer - 1) % length;
        if (buffer[tmp_pointer])
        {
          pointer = tmp_pointer;
          return buffer[pointer];
        }
      },
      next : function()
      {
        if (buffer[pointer])
        {
          pointer = (pointer + 1) % length;
          return buffer[pointer];
        }
      }
    };
  };

  this.cloneJSON = function(obj)
  {
      return JSON.parse(JSON.stringify(obj));
  }



//   ██████  ██    ██ ██     ███████ ██    ██ ███    ██  ██████ ████████ ██  ██████  ███    ██ ███████ 
//  ██       ██    ██ ██     ██      ██    ██ ████   ██ ██         ██    ██ ██    ██ ████   ██ ██      
//  ██   ███ ██    ██ ██     █████   ██    ██ ██ ██  ██ ██         ██    ██ ██    ██ ██ ██  ██ ███████ 
//  ██    ██ ██    ██ ██     ██      ██    ██ ██  ██ ██ ██         ██    ██ ██    ██ ██  ██ ██      ██ 
//   ██████   ██████  ██     ██       ██████  ██   ████  ██████    ██    ██  ██████  ██   ████ ███████ 

  /////////////////////////////////
  // FIXED-COLUMN TEXT RENDERER  //
  /////////////////////////////////

  this.parseColumnSpec = function(spec, defaults)
  {
    defaults = defaults || {};
    var out = {};

    function put(k, v)
    {
      v = Number(v);
      if (!Number.isFinite(v)) return;
      out[String(k)] = v | 0;
    }

    for (var k in defaults) put(k, defaults[k]);

    if (spec == null || spec === "") return out;

    if (typeof spec === "object")
    {
      for (var kk in spec) put(kk, spec[kk]);
      return out;
    }

    var text = String(spec).trim();
    if (!text) return out;

    try
    {
      var jsonish = text;
      // Accept both JSON and compact object notation like {adr:0,code:6,lbl:16}.
      if (jsonish.charAt(0) === "{" && jsonish.indexOf('"') < 0)
        jsonish = jsonish.replace(/([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/g, '"$1":');
      var obj = JSON.parse(jsonish);
      for (var j in obj) put(j, obj[j]);
      return out;
    }
    catch (_ignore) {}

    var re = /([A-Za-z_$][A-Za-z0-9_$-]*)\s*[:=]\s*(-?\d+)/g, m;
    while ((m = re.exec(text))) put(m[1], m[2]);
    return out;
  };

  this.textTableClip = function(text, width, ellipsis)
  {
    text = String(text == null ? "" : text);
    ellipsis = ellipsis || "…";
    if (width == null || !Number.isFinite(Number(width)) || Number(width) < 0) return text;
    width = Number(width) | 0;
    if (width === 0) return "";
    if (text.length <= width) return text;
    if (width <= ellipsis.length) return ellipsis.substring(0, width);
    return text.substring(0, width - ellipsis.length) + ellipsis;
  };

  this.renderTextTableRows = function(rows, columnSpec, options)
  {
    options = options || {};
    rows = rows || [];
    var ellipsis = options.ellipsis || "…";
    var trimRight = options.trimRight !== false;
    var singleColumnRaw = options.singleColumnRaw !== false;
    var defaults = options.defaults || {};
    var spec = this.parseColumnSpec(columnSpec, defaults);
    var order = (options.order || Object.keys(spec)).slice();

    // Keep only configured keys and sort them by their start column. Ties keep order[] priority.
    order = order.filter(function(k) { return spec[k] != null; });
    order.sort(function(a, b) {
      var d = spec[a] - spec[b];
      return d || ((options.order || []).indexOf(a) - (options.order || []).indexOf(b));
    });

    function rowToLine(row)
    {
      row = row || {};
      var nonEmpty = [];
      for (var i = 0; i < order.length; i++)
      {
        var key = order[i];
        var val = row[key];
        if (val != null && String(val) !== "") nonEmpty.push(key);
      }

      // UX rule for comment-only or otherwise single-field rows: print at column 0.
      if (singleColumnRaw && nonEmpty.length === 1)
        return String(row[nonEmpty[0]]);

      var line = "";
      for (var c = 0; c < order.length; c++)
      {
        var key = order[c];
        var text = row[key];
        if (text == null || String(text) === "") continue;
        var col = Number(spec[key]) | 0;
        var nextKey = null;
        for (var n = c + 1; n < order.length; n++)
        {
          if (spec[order[n]] > col) { nextKey = order[n]; break; }
        }
        var width = nextKey == null ? undefined : (Number(spec[nextKey]) - col);
        text = this.textTableClip(text, width, ellipsis);
        if (line.length < col) line = line + " ".repeat(col - line.length);
        if (line.length > col)
        {
          // Preserve an already-written overflowing field; move this field just after it.
          // Properly configured columns should not hit this path because clipping happens above.
          line += " ";
        }
        line += text;
      }
      return trimRight ? line.replace(/\s+$/, "") : line;
    }

    var out = [];
    for (var r = 0; r < rows.length; r++) out.push(rowToLine.call(this, rows[r]));
    return out;
  };

  this.renderTextTable = function(rows, columnSpec, options)
  {
    return this.renderTextTableRows(rows, columnSpec, options).join((options && options.lineBreak) || "\n");
  };


// Interactive JSON pretty printer, adapted from the JSON.prettify pattern used in AsciiCAD_CMD.js.
this.JSONprettify = function makeInteractiveJson(mountEl, boundaryStyles, indent)
{
    if (!mountEl) throw new Error("mountEl is required");
    indent = indent || 2;
    var jsonStr = mountEl.textContent;

    var styleMap = Array.isArray(boundaryStyles)
        ? Object.fromEntries(boundaryStyles)
        : (boundaryStyles || {});

    var openToKey = {};
    var closeToKey = {};
    Object.keys(styleMap).forEach(function (pairKey) {
        if (typeof pairKey !== "string" || pairKey.length !== 2) return;
        openToKey[pairKey.charAt(0)] = pairKey;
        closeToKey[pairKey.charAt(1)] = pairKey;
    });

    var pretty;
    try {
        pretty = prettyJsonAllman(JSON.parse(jsonStr), indent);
    } catch (e) {
        var fallback = document.createElement("pre");
        fallback.className = "json-view";
        fallback.textContent = jsonStr;
        mountEl.replaceChildren(fallback);
        return fallback;
    }

    var root = document.createElement("pre");
    root.className = "json-view";
    var stacks = {};
    var nextPairId = 1;
    var frag = document.createDocumentFragment();

    function appendText(text) {
        if (text) frag.appendChild(document.createTextNode(text));
    }

    function appendBoundarySpan(ch, pairKey, pairId) {
        var sp = document.createElement("span");
        sp.className = "json-boundary";
        sp.textContent = ch;
        sp.dataset.pair = String(pairId);
        if (styleMap[pairKey]) sp.setAttribute("style", styleMap[pairKey]);
        frag.appendChild(sp);
        return sp;
    }

    var i = 0;
    while (i < pretty.length) {
        var ch = pretty.charAt(i);

        if (openToKey[ch]) {
            var openPairKey = openToKey[ch];
            var pairId = nextPairId++;
            appendBoundarySpan(ch, openPairKey, pairId);
            if (!stacks[openPairKey]) stacks[openPairKey] = [];
            stacks[openPairKey].push(pairId);
            i++;
            continue;
        }

        if (closeToKey[ch]) {
            var closePairKey = closeToKey[ch];
            var stack = stacks[closePairKey];
            if (stack && stack.length) appendBoundarySpan(ch, closePairKey, stack.pop());
            else appendText(ch);
            i++;
            continue;
        }

        // Light token coloring on top of the boundary-pair highlighting.
        var rest = pretty.substring(i);
        var m;
        if ((m = rest.match(/^\s+|^[:,]/))) {
            appendText(m[0]);
            i += m[0].length;
            continue;
        }
        if ((m = rest.match(/^"(?:\\.|[^"\\])*"(?=\s*:)/))) {
            appendClassed(m[0], "json-key");
            i += m[0].length;
            continue;
        }
        if ((m = rest.match(/^"(?:\\.|[^"\\])*"/))) {
            appendClassed(m[0], "json-string");
            i += m[0].length;
            continue;
        }
        if ((m = rest.match(/^-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/))) {
            appendClassed(m[0], "json-number");
            i += m[0].length;
            continue;
        }
        if ((m = rest.match(/^(true|false)\b/))) {
            appendClassed(m[0], "json-boolean");
            i += m[0].length;
            continue;
        }
        if ((m = rest.match(/^null\b/))) {
            appendClassed(m[0], "json-null");
            i += m[0].length;
            continue;
        }

        appendText(ch);
        i++;
    }

    function appendClassed(text, className) {
        var sp = document.createElement("span");
        sp.className = className;
        sp.textContent = text;
        frag.appendChild(sp);
    }

    root.appendChild(frag);
    mountEl.replaceChildren(root);

    var activePair = null;
    function cssEscape(s) {
        if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(s));
        return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }
    function setActive(pairId) {
        if (activePair === pairId) return;
        clearActive();
        activePair = pairId;
        root.querySelectorAll('.json-boundary[data-pair="' + cssEscape(pairId) + '"]').forEach(function (el) {
            el.classList.add("active");
        });
    }
    function clearActive() {
        if (activePair == null) return;
        root.querySelectorAll('.json-boundary[data-pair="' + cssEscape(activePair) + '"]').forEach(function (el) {
            el.classList.remove("active");
        });
        activePair = null;
    }

    root.addEventListener("mousemove", function (e) {
        var b = e.target.closest(".json-boundary");
        if (!b || !root.contains(b)) { clearActive(); return; }
        setActive(b.dataset.pair);
    });
    root.addEventListener("mouseleave", clearActive);
    return root;
};

function prettyJsonAllman(value, indent) {
    indent = indent || 2;
    var obj = (typeof value === "string") ? JSON.parse(value) : value;
    var s = JSON.stringify(obj, null, indent);
    s = s.replace(/^(\s*)"([^"]+)"\s*:\s*([\{\[])([\}\]])?\s*(,?)\s*$/gm,
        function (_m, ws, key, open, maybeClose, comma) {
            // Keep empty arrays/objects compact: "tag": [] and "sym": {}.
            if (maybeClose) return ws + '"' + key + '": ' + open + maybeClose + comma;
            // For non-empty object/array values, keep the existing Allman-style key break.
            return ws + '"' + key + '":\n' + ws + open;
        }
    );
    return s;
}


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
    create: function(target_id) 
    { 
      var obj = Object.create(this);
      obj.target_id = target_id;
      obj.id="";
      obj.states={};
      obj.rules={};
      this.el(obj.target_id.dest).innerHTML = obj.target_html();
      return obj 
    },
    id:"",
    states:{},
    rules:{},
    target_id:{"html":"COM_popup","html_txt":"COM_popup_text","class":"appbut","float":false},
    target_html:function(){return "<div class=appbox id=\""+this.target_id.html+"\" style=\""+(this.target_id.float?"position: absolute; z-index: 3; left: 0px; top: 120px;":"")+"\" hidden=\"\"><div id=\""+this.target_id.html_txt+"\"></div></div>"},
    target_btn:function(arg){return "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+this.target_id.html+"');document.getElementById('"+this.target_id.html_txt+"').innerHTML='';"+(arg===undefined?"":arg.onclick)+"\" style=\"text-align:center;float:right;\">x</div>"},
    el: function(id) { return document.getElementById(id) },
    addRule: function(id,function_obj) { this.rules[id] = function_obj },
    runRule: function(id) { this.id = id; this.rules[id](this) },
    set_state: function(id,val){ this.states[id] = val },
    get_state: function(id){ return this.states[id]===undefined?this.el(id).classList.item(1):this.states[id]},
    update_state: function(id,el){ this.states[id] = el.hidden },
    on: function(id) { var el = this.el(id); this.states[id] = false; el.hidden = false; return el; },
    off: function(id) { var el = this.el(id); this.states[id] = true; el.hidden = true; return el; },
    toggle: function(id) { var el = this.el(id); el.hidden = !el.hidden; this.states[id] = el.hidden; return el; },
    title_body_html: function(title_html, body_html, body_id, body_class)
    {
        return ""
            +"<div class='com_popup_title'>"
                +title_html
            +"</div>"
            +"<div"
                +(body_id ? " id='"+body_id+"'" : "")
                +" class='"+(body_class || "com_popup_body com_scroll_xy")+"'"
            +">"
                +body_html
            +"</div>";
    },
    get_class: function(el,idx) { return el.classList.item(idx===undefined?0:idx) },
    set_class: function(el,class1,class2,bool)
    {
      el.hidden = bool;
      if(bool) {el.classList.replace(class2,class1);this.states[el.id]=class1}
      else {el.classList.replace(class1,class2);this.states[el.id]=class2}
      //if(bool) {el.classList.remove(class2);el.classList.add(class1);this.states[el.id]=class1}
      //else {el.classList.remove(class1);el.classList.add(class2);this.states[el.id]=class2}
    },
    toggle_class: function(el,class1,class2)
    {
      this.toggle(el.id);
      this.set_class(el,class1,class2,el.hidden);
    },
    wipe: function()
    {
       document.getElementById(this.target_id.html_txt).innerHTML = "";
    },
    html: function(html,ttl)
    {
      var e = oCOM.POPUP.toggle(this.target_id.html);
      if(e==null) return null;
      if(html==null) e.hidden = true;
      if(ttl) { setTimeout( COM_PopupHTML,ttl*1000 ); e.hidden = false };
      document.getElementById(this.target_id.html_txt).innerHTML += !e.hidden?(html+"<br>"):"";
    }
  }
 
  this.GetHTTP = function(url,responsetype,callback_function,arg)
  {
    // random value (workaround to avoid caching)
    var r = ""; //"?"+btoa(Math.round(Math.random(1)*6*6*6)+"").replace(new RegExp("=","g"),"");
    const xhttp = new XMLHttpRequest();
    xhttp.responseType = responsetype;    // check: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType
    xhttp["arg"] = arg;
    xhttp.onload = callback_function;
    xhttp.open("GET", url+r);
    xhttp.send();
  }

  this.Download = function(fileName, data)
  {
    if(data.length===undefined) return;

    var ui8 = new Uint8Array(data.length);
    for(var i=0;i<data.length;i++)
      ui8[i] = data[i];
    var url, mimeType = 'application/octet-stream';
    var blob = new Blob([ui8], {type: mimeType});
    var url = window.URL.createObjectURL(blob);

    console.log("downloadURL('"+url+"', '"+fileName+"')")
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
  


  this.roughSizeOfObject = function(object) 
  {
    const stack = [object];
    const seen  = new WeakSet();
    let bytes = 0;

    while (stack.length) 
    {
      const value = stack.pop();
      switch (typeof value) 
      {
        case 'boolean': bytes += 4; break;
        case 'string':  bytes += value.length * 2; break; // UTF-16 assumption
        case 'number':  bytes += 8; break;   // IEEE-754 double
        case 'bigint':  bytes += 8; break;   // very rough
        case 'symbol':
        case 'function':
        case 'undefined': break;
        case 'object':
            if (value === null) break;
            if (seen.has(value)) break;
            seen.add(value);
            bytes += 16;              // Count object overhead – completely engine-dependent

            // Handle Maps, Sets, etc.
            if (value instanceof Map)         { stack.push(...value.keys(), ...value.values()); break; }
            if (value instanceof Set)         { stack.push(...value.values()); break; }
            if (ArrayBuffer.isView(value))    { bytes += value.byteLength; break; }
            if (value instanceof ArrayBuffer) { bytes += value.byteLength; break; }

            // Walk own keys (including non-enumerable & symbols)
            for (const key of Reflect.ownKeys(value)) { bytes += key.toString().length * 2;  stack.push(value[key]);}
            break;
      }
    }
    return bytes;
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
    if(!this.RefreshEvent_arr[ name ]) console.log("addRefreshEvent("+name+")");
    else console.log("addRefreshEvent("+name+") -> already exists (no problem)");
    this.RefreshEvent_arr[ name ] = {"func":func,"active":active}
    this.checkActiveRefreshEvents();
  }

  this.toggleRefreshEvent = function(name)
  {
    if(!this.RefreshEvent_arr[name]) return false;
    this.RefreshEvent_arr[ name ].active = !this.RefreshEvent_arr[ name ].active;
    this.checkActiveRefreshEvents();
    return this.RefreshEvent_arr[ name ].active;
  }

  this.checkActiveRefreshEvents = function()
  {
    var bActive = false;      // if any of the events is active, keep bRefreshEvent = true 
    for(var _o in this.RefreshEvent_arr)
      if(this.RefreshEvent_arr[_o].active) bActive = true;
    this.bRefreshEvent = bActive;
  }

  this.enableRefreshEvent = function(name, active)
  {
    if(!this.RefreshEvent_arr[name]) return false;
    this.RefreshEvent_arr[name].active = !!active;
    this.checkActiveRefreshEvents();
    return this.RefreshEvent_arr[name].active;
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
    var table_id = cnf.table_id===undefined ? cnf.id_prefix : cnf.table_id;
    var s = "<table class=gtable style='display:inline-block;' id='gtable_"+table_id+"'>\n";
    var end = start+len*step;
    for(var i=start;i!=end;i+=step)
      s += "<tr><td>"+this.oCOM.getHexMulti(i,cnf.digits)+"</td>"
              +"<td id='"+cnf.id_prefix+this.line(i,16,256,cnf.digits).join("'></td><td id='"+cnf.id_prefix)+"'></td></tr>\n";
    return s+"</table>"
  }

  this.relabel_grid_rows = function(table_id, labels)
  {
    var tbl = document.getElementById("gtable_"+table_id);
    if(tbl==null) return;
    var rows = tbl.getElementsByTagName("tr");
    for(var i=0;i<rows.length && i<labels.length;i++)
      if(rows[i].cells.length>0)
        rows[i].cells[0].textContent = labels[i];
  }  

  this.paint_grid = function(layout,cnf)
  {
    var fix = this.conf_grid.id_prefix;
    if(cnf===undefined) cnf = this.conf_grid;
    fix = cnf.id_prefix;
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

  this.update_grid = function(mem_mon,cnf,bgcolor)
  {
    if(mem_mon===undefined || mem_mon==null) return;
    if(cnf===undefined) cnf = this.conf_grid;
    if(bgcolor===undefined) bgcolor = "#FFFFFF";

    var fix = cnf.id_prefix;
    var digits = cnf.digits===undefined ? this.conf_grid.digits : cnf.digits;

    for(var i in mem_mon)
    {
      if(!mem_mon[i]) continue;

      var addr = Number(i) << mem_gran;
      var idx = this.oCOM.getHexMulti(addr,digits);
      var el = document.getElementById(fix + idx);
      if(el!=null) el.style.backgroundColor = bgcolor;
    }
  }

}(COM)












//     _______                        
//    |_   __ \                       
//      | |__) |,--.   _ .--.  .---.  
//      |  ___/`'_\ : [ `.-. |/ /__\\ 
//     _| |_   // | |, | | | || \__., 
//    |_____|  \'-;__/[___||__]'.__.' 


function PANE()
{
    this.rootClass = "com-pane";
    this.titleClass = "com-pane-title";
    this.titleEqualizedClass = "com-pane-title-equalized";

    this.classHTML = function()
    {
        var seen = {};
        var out = [];
        for(var i = 0; i < arguments.length; i++)
        {
            var s = String(arguments[i] || "").trim();
            if(!s) continue;
            s.split(/\s+/).forEach(function(cls) {
                if(cls && !seen[cls]) { seen[cls] = true; out.push(cls); }
            });
        }
        return out.join(" ");
    };

    this.escapeHTML = function(s)
    {
        return String(s ?? "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;");
    };

    this.attrHTML = function(attr)
    {
        if(!attr) return "";
        if(typeof attr == "string") return " " + attr;

        var out = [];
        for(var k in attr)
        {
            if(attr[k] === false || attr[k] == null) continue;
            out.push(attr[k] === true ? k : k + '="' + this.escapeHTML(attr[k]) + '"');
        }
        return out.length ? " " + out.join(" ") : "";
    };

    this.styleHTML = function(style)
    {
        if(!style) return "";
        if(typeof style == "string") return style;
        var out = [];
        for(var k in style) if(style[k] != null) out.push(k + ":" + style[k]);
        return out.join(";");
    };

    this.searchBarHTML = function(cfg)
    {
        if(!cfg) return "";
        var opt = cfg.opt || [];

        return ''
            + '<span class="com-pane-searchbar">'
            + '<input type="text" class="com-pane-find" placeholder="Find">'
            + '<input type="text" class="com-pane-replace" placeholder="Replace">'
            + '<button type="button" data-pane-act="find-prev">Prev</button>'
            + '<button type="button" data-pane-act="find-next">Next</button>'
            + '<button type="button" data-pane-act="replace">Replace</button>'
            + (opt.indexOf("all") >= 0 ? '<button type="button" data-pane-act="replace-all">All</button>' : '')
            + (opt.indexOf("regexp") >= 0 ? '<label><input type="checkbox" class="com-pane-regexp">.*</label>' : '')
            + (opt.indexOf("case") >= 0 ? '<label><input type="checkbox" class="com-pane-case">Aa</label>' : '')
            + '</span>';
    };

    this.getHTML = function(txt, cfg)
    {
        cfg = cfg || {};
        var header = cfg.header || {};
        var body   = cfg.body || {};

        var btag = body.tag || "textarea";
        var content = body.content !== undefined ? body.content : txt;

        var sectionClass = this.classHTML(this.rootClass, cfg.class || "pane");
        var headerClass  = this.classHTML(this.titleClass, header.class || "pane-title");

        var infoHTML = "";
        if(header.infoHTML != null) {
            infoHTML = String(header.infoHTML);
        } else if(header.infoId || header.info != null) {
            infoHTML = '<span'
                + (header.infoId ? ' id="' + this.escapeHTML(header.infoId) + '"' : '')
                + '>'
                + this.escapeHTML(header.info || "")
                + '</span>';
        }

        return ''
            + '<section'
            + (cfg.id ? ' id="' + this.escapeHTML(cfg.id) + '"' : '')
            + ' class="' + this.escapeHTML(sectionClass) + '">'
            + '<div class="' + this.escapeHTML(headerClass) + '">'
            + (header.html || (
                '<strong>' + this.escapeHTML(header.title || "") + '</strong>'
                + this.searchBarHTML(header.searchBar)
                + infoHTML
            ))
            + '</div>'
            + '<' + btag
            + (body.id ? ' id="' + this.escapeHTML(body.id) + '"' : '')
            + (body.class ? ' class="' + this.escapeHTML(body.class) + '"' : '')
            + (body.style ? ' style="' + this.escapeHTML(this.styleHTML(body.style)) + '"' : '')
            + this.attrHTML(body.attr)
            + '>'
            + this.escapeHTML(content || "")
            + '</' + btag + '>'
            + '</section>';
    };

    /*
     * Visual-Studio-style Find / Replace for textarea panes.
     *
     * Usage:
     *   oPANE.bindFindReplace("sourcePane", {
     *       barWidth:"400px",
     *       debounce_ms:500,
     *       onChange:function(target){ ... }
     *   });
     *
     * Notes:
     *   - This replaces the older pane-searchbar/bindSearch UI.
     *   - The target textarea is wrapped in an overlay container so matches and
     *     persistent "find in selection" can remain visible while focus is in
     *     the Find input.
     *   - Regex replacement supports \n, \r, \t, \\, $&, $$, $1..$99.
     */
    this.findReplaceCSS = function()
    {
        return ''
        + '.com-pane-fr-wrap{position:relative;width:100%;height:100%;min-height:0;background:var(--panel2,#0b0f14);overflow:hidden;}'
        + '.com-pane-fr-wrap>textarea,.com-pane-fr-overlay{position:absolute;inset:0;width:100%;height:100%;margin:0;border:0;outline:0;'
            + 'padding:14px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;'
            + 'tab-size:4;white-space:pre;overflow:auto;}'
        + '.com-pane-fr-overlay{pointer-events:none;color:var(--text,#e6edf3);background:var(--panel2,#0b0f14);}'
        + '.com-pane-fr-wrap>textarea{resize:none;background:transparent!important;color:transparent!important;caret-color:var(--text,#e6edf3);}'
        + '.com-pane-fr-wrap>textarea::selection{background:rgba(197,139,27,.65);color:transparent;}'
        + '.com-pane-fr-selection{background:rgba(190,190,190,.35);}'
        + '.com-pane-fr-match{background:rgba(255,210,70,.28);}'
        + '.com-pane-fr-current{background:rgba(255,185,45,.85);color:#000;}'
        + '.com-pane-title{position:relative;}'
        + '.pane-title.com-pane-title-equalized{height:var(--com-pane-title-height,auto);min-height:var(--com-pane-title-height,auto);}'
        + '.com-pane-findreplace{z-index:2000;display:none;'        
            + 'grid-template-columns:auto minmax(150px,392px) auto auto auto auto auto;grid-template-rows:24px;'
            + 'align-items:center;gap:4px;padding:2px 4px;border:1px solid var(--com-pane-fr-border,#d2d2d2);'
            + 'border-radius:4px;background:var(--com-pane-fr-bg,#f3f3f3);box-shadow:0 2px 12px rgba(0,0,0,.18);'
            + 'color:var(--com-pane-fr-text,#5f5f5f);}'
        + '.com-pane-findreplace.com-pane-fr-inline{position:relative;top:auto;left:auto;right:auto;box-shadow:none;}'
        + '.com-pane-findreplace.com-pane-fr-overlay-expand.expanded{position:absolute;right:8px;top:2px;transform:none;box-shadow:0 2px 12px rgba(0,0,0,.35);}'
        + '.com-pane-findreplace.open{display:grid;}'
        + '.com-pane-findreplace.expanded{grid-template-rows:24px 24px;}'
        + '.com-pane-header-widget-host{display:flex;align-items:center;justify-content:flex-end;margin-left:auto;min-width:0;position:relative;}'
        + '.com-pane-header-widget{display:none;}'
        + '.com-pane-header-widget.active{display:flex;}'
        + '.com-pane-findreplace.com-pane-header-widget.active{display:grid;}'
        + '.com-pane-header-default-widget{align-items:center;gap:4px;}'
        + '.com-pane-header-default-widget .com-pane-fr-btn{display:inline-flex;}'
        + '.com-pane-fr-expander,.com-pane-fr-btn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 20px;'
            + 'width:20px;min-width:20px;height:20px;padding:0;margin:0;border:1px solid transparent;border-radius:3px;'
            + 'background:transparent;color:var(--com-pane-fr-muted,#9a9a9a);cursor:pointer;font:14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
            + 'text-align:center;vertical-align:middle;}'
        + '.com-pane-fr-expander{color:var(--com-pane-fr-expander,#333);}'
        + '.com-pane-fr-expander:hover,.com-pane-fr-expander.active,.com-pane-fr-btn.active{border-color:var(--com-pane-fr-active,#0078d4);background:var(--com-pane-fr-active-bg,#e9f4ff);color:var(--com-pane-fr-active-text,#111);}'
        + '.com-pane-fr-btn:hover{color:var(--com-pane-fr-hover-text,#555);background:var(--com-pane-fr-hover-bg,#ececec);}'
        + '.com-pane-fr-btn:disabled{opacity:.35;cursor:default;pointer-events:none;}'
        + '.com-pane-fr-expander .chev{display:inline-flex;align-items:center;justify-content:center;line-height:1;transform:rotate(0deg);}'
        + '.com-pane-findreplace.expanded .com-pane-fr-expander .chev{transform:rotate(90deg);}'
        + '.com-pane-fr-field{display:flex;height:20px;border-radius:3px;background:var(--com-pane-fr-field-bg,#fff);overflow:hidden;}'
        + '.com-pane-fr-field input{min-width:0;flex:1;padding:0 2px;border:0;outline:0;font:10px/1 sans-serif;overflow:hidden;color:var(--com-pane-fr-field-text,#5f5f5f);background:var(--com-pane-fr-field-bg,#fff);}'        
        + '.com-pane-fr-field-buttons{display:flex;height:100%;align-items:center;padding-right:8px;gap:2px;}'
        + '.com-pane-fr-under{display:inline-flex;align-items:center;justify-content:center;line-height:1;text-decoration:underline;text-underline-offset:3px;}'
        + '.com-pane-fr-results{font-size:10px;min-width:70px;white-space:nowrap;}'
        + '.com-pane-fr-nav,.com-pane-fr-close,.com-pane-fr-selection-btn{font-size:14px;}'
        + '.com-pane-fr-replace-spacer{grid-column:1;}'
        + '.com-pane-fr-replace-field{grid-column:2;grid-row:2;}'
        + '.com-pane-fr-actions{grid-column:3 / span 3;grid-row:2;display:flex;align-items:center;gap:10px;}'
        + '.com-pane-fr-floating{position:fixed;left:10px;top:10px;z-index:3000;display:none;align-items:center;gap:4px;'
            + 'padding:4px;border:1px solid var(--com-pane-fr-border,#d2d2d2);border-radius:6px;'
            + 'background:var(--com-pane-fr-bg,#f3f3f3);box-shadow:0 2px 12px rgba(0,0,0,.22);color:var(--com-pane-fr-text,#5f5f5f);}'
        + '.com-pane-fr-floating.open{display:flex;}'
        + '.com-pane-fr-floating .com-pane-fr-btn{flex:0 0 24px;width:24px;min-width:24px;height:24px;}'
        + '.com-pane-fr-hidden-row{display:none;}'
        + '.com-pane-findreplace.expanded .com-pane-fr-hidden-row{display:flex;}';
    };

    this.injectFindReplaceCSS = function()
    {
        if(document.getElementById("com_pane_findreplace_css")) return;
        var style = document.createElement("style");
        style.id = "com_pane_findreplace_css";
        style.textContent = this.findReplaceCSS();
        document.head.appendChild(style);
    };

    this.findReplaceHTML = function(id, cfg)
    {
        cfg = cfg || {};
        var w = cfg.barWidth || "400px";
        return ''
        + '<div id="' + this.escapeHTML(id) + '" style="width:' + this.escapeHTML(w) + '" class="com-pane-findreplace" aria-label="Find and replace">'
        +   '<button type="button" class="com-pane-fr-expander" data-fr-act="expand" title="Expand / collapse replace"><span class="chev">›</span></button>'
        +   '<div class="com-pane-fr-field">'
        +     '<input class="com-pane-fr-find" placeholder="Find" autocomplete="off" spellcheck="false">'
        +     '<span class="com-pane-fr-field-buttons">'
        +       '<button type="button" class="com-pane-fr-btn com-pane-fr-case active" title="Match case">Aa</button>'
        +       '<button type="button" class="com-pane-fr-btn com-pane-fr-word" title="Match whole word"><span class="com-pane-fr-under">ab</span></button>'
        +       '<button type="button" class="com-pane-fr-btn com-pane-fr-regex" title="Use regular expression">.*</button>'
        +     '</span>'
        +   '</div>'
        +   '<div class="com-pane-fr-results">No results</div>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-nav com-pane-fr-prev" title="Previous match">↑</button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-nav com-pane-fr-next" title="Next match">↓</button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-selection-btn" title="Find in selection">☰</button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-close" title="Close">×</button>'
        +   '<div class="com-pane-fr-replace-spacer com-pane-fr-hidden-row"></div>'
        +   '<div class="com-pane-fr-field com-pane-fr-replace-field com-pane-fr-hidden-row">'
        +     '<input class="com-pane-fr-replace" placeholder="Replace" autocomplete="off" spellcheck="false">'
        +     '<span class="com-pane-fr-field-buttons"><button type="button" class="com-pane-fr-btn com-pane-fr-preserve" title="Preserve case">AB</button></span>'
        +   '</div>'
        +   '<div class="com-pane-fr-actions com-pane-fr-hidden-row">'
        +     '<button type="button" class="com-pane-fr-btn com-pane-fr-replace-one" title="Replace selected match">c</button>'
        +     '<button type="button" class="com-pane-fr-btn com-pane-fr-replace-all" title="Replace all">ac</button>'
        +   '</div>'
        + '</div>';
    };

    this.findReplaceFloatingNavHTML = function(id)
    {
        return ''
        + '<div id="' + this.escapeHTML(id) + '" class="com-pane-fr-floating" aria-label="Find navigation">'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-nav com-pane-fr-float-prev" title="Previous match">↑</button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-nav com-pane-fr-float-next" title="Next match">↓</button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-float-top" title="Back to top"><i class="fa fa-angle-double-up"></i></button>'
        +   '<button type="button" class="com-pane-fr-btn com-pane-fr-close com-pane-fr-float-close" title="Close">×</button>'
        + '</div>';
    };

    this.bindFindReplace = function(target, cfg)
    {
        cfg = cfg || {};
        this.injectFindReplaceCSS();

        if(typeof target == "string") target = document.getElementById(target);
        if(!target || target.tagName.toUpperCase() != "TEXTAREA") return null;

        var uid = cfg.id || ("com_pane_findreplace_" + (target.id || Math.random().toString(36).slice(2)));
        var bar = document.getElementById(uid);

        if(!bar) {
            var mount = cfg.mount;
            if(typeof mount == "string") mount = document.getElementById(mount);
            if(mount) mount.insertAdjacentHTML("beforeend", this.findReplaceHTML(uid, cfg));
            else document.body.insertAdjacentHTML("beforeend", this.findReplaceHTML(uid, cfg));        
            bar = document.getElementById(uid);
        }

        if(cfg.inline !== false) bar.classList.add("com-pane-fr-inline");
        if(cfg.overlayExpand) bar.classList.add("com-pane-fr-overlay-expand");

        var floatingNav = null;
        if(cfg.floatingNav) {
            var floatingId = uid + "_floating";
            floatingNav = document.getElementById(floatingId);
            if(!floatingNav) {
                document.body.insertAdjacentHTML("beforeend", this.findReplaceFloatingNavHTML(floatingId));
                floatingNav = document.getElementById(floatingId);
            }
        }

        if(cfg.scheme) {
            for(var k in cfg.scheme) {
                bar.style.setProperty("--com-pane-fr-" + k, cfg.scheme[k]);
                if(floatingNav) floatingNav.style.setProperty("--com-pane-fr-" + k, cfg.scheme[k]);
            }
        }
        if(cfg.manager && typeof cfg.manager.add == "function")
            cfg.manager.add(uid, bar, false);

        var wrap = target.parentNode;
        var overlay;
        if(!wrap.classList || !wrap.classList.contains("com-pane-fr-wrap")) {
            wrap = document.createElement("div");
            wrap.className = "com-pane-fr-wrap";
            target.parentNode.insertBefore(wrap, target);
            overlay = document.createElement("pre");
            overlay.className = "com-pane-fr-overlay";
            overlay.setAttribute("aria-hidden", "true");
            wrap.appendChild(overlay);
            wrap.appendChild(target);
        } else {
            overlay = wrap.querySelector(".com-pane-fr-overlay");
        }

        var findInput    = bar.querySelector(".com-pane-fr-find");
        var replaceInput = bar.querySelector(".com-pane-fr-replace");
        var resultInfo   = bar.querySelector(".com-pane-fr-results");
        var prevBtn      = bar.querySelector(".com-pane-fr-prev");
        var nextBtn      = bar.querySelector(".com-pane-fr-next");
        var caseBtn      = bar.querySelector(".com-pane-fr-case");
        var wordBtn      = bar.querySelector(".com-pane-fr-word");
        var regexBtn     = bar.querySelector(".com-pane-fr-regex");
        var preserveBtn  = bar.querySelector(".com-pane-fr-preserve");
        var selectionBtn = bar.querySelector(".com-pane-fr-selection-btn");
        var floatPrevBtn = floatingNav ? floatingNav.querySelector(".com-pane-fr-float-prev") : null;
        var floatNextBtn = floatingNav ? floatingNav.querySelector(".com-pane-fr-float-next") : null;
        var floatTopBtn  = floatingNav ? floatingNav.querySelector(".com-pane-fr-float-top") : null;
        var floatCloseBtn = floatingNav ? floatingNav.querySelector(".com-pane-fr-float-close") : null;

        var state = {
            matches: [],
            current: -1,
            selectionRange: null,
            lastEditorSelection: null,
            timer: null,
            debounce_ms: cfg.debounce_ms == null ? 500 : cfg.debounce_ms
        };

        function esc(s) {
            return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        }

        function renderOverlay() {
            var text = target.value;
            var ranges = [];
            var visibleSelection = state.selectionRange || state.lastEditorSelection;
            if(visibleSelection && visibleSelection.end > visibleSelection.start)
                ranges.push({start:visibleSelection.start,end:visibleSelection.end,cls:"com-pane-fr-selection",priority:1});

            for(var i=0;i<state.matches.length;i++)
                ranges.push({start:state.matches[i].start,end:state.matches[i].end,cls:i==state.current?"com-pane-fr-current":"com-pane-fr-match",priority:i==state.current?3:2});

            ranges = ranges.filter(function(r){return r.end>r.start}).sort(function(a,b){return a.start-b.start || b.priority-a.priority});
            var out = "", pos = 0;
            for(var r=0;r<ranges.length;r++) {
                if(ranges[r].end <= pos) continue;
                var start = Math.max(ranges[r].start, pos);
                if(start > pos) out += esc(text.slice(pos,start));
                out += '<span class="'+ranges[r].cls+'">'+esc(text.slice(start,ranges[r].end))+'</span>';
                pos = ranges[r].end;
            }
            if(pos < text.length) out += esc(text.slice(pos));
            overlay.innerHTML = out || " ";
            syncOverlayScroll();
        }

        function syncOverlayScroll() {
            overlay.scrollTop = target.scrollTop;
            overlay.scrollLeft = target.scrollLeft;
        }

        function rememberEditorSelection() {
            if(target.selectionStart !== target.selectionEnd)
                state.lastEditorSelection = {start:target.selectionStart,end:target.selectionEnd};
            updateSelectionButtonState();
        }

        function hasUsableEditorSelection() {
            return !!(state.lastEditorSelection && state.lastEditorSelection.end > state.lastEditorSelection.start);
        }

        function updateSelectionButtonState() {
            var active = selectionBtn.classList.contains("active");
            selectionBtn.disabled = !active && !hasUsableEditorSelection();
        }

        function updateNavButtons() {
            var enabled = state.matches.length > 0;
            prevBtn.disabled = !enabled;
            nextBtn.disabled = !enabled;
            if(floatPrevBtn) floatPrevBtn.disabled = !enabled;
            if(floatNextBtn) floatNextBtn.disabled = !enabled;
        }

        function openSearch(expanded) {
            rememberEditorSelection();
            if(cfg.manager && typeof cfg.manager.activate == "function") cfg.manager.activate(uid);
            bar.classList.add("open");
            bar.classList.toggle("expanded", !!expanded);
            if(floatingNav) floatingNav.classList.add("open");
            setTimeout(function(){ findInput.focus(); findInput.select(); }, 0);
            scheduleFind();
        }

        function closeSearch() 
        {
            bar.classList.remove("open");
            bar.classList.remove("expanded");
            if(floatingNav) floatingNav.classList.remove("open");
            if(cfg.manager && typeof cfg.manager.activateDefault == "function") cfg.manager.activateDefault();
            target.focus();
        }

        function toggleSearch(expanded) {
            if(bar.classList.contains("open")) closeSearch();
            else openSearch(expanded);
        }        

        function escapeRegex(s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }

        function flags(global) {
            return (global ? "g" : "") + (caseBtn.classList.contains("active") ? "" : "i");
        }

        function buildRegex(global) {
            var q = findInput.value;
            if(!q) return null;
            if(!regexBtn.classList.contains("active")) q = escapeRegex(q);
            if(wordBtn.classList.contains("active")) q = "\\b(?:" + q + ")\\b";
            try { return new RegExp(q, flags(global)); }
            catch(e) { return null; }
        }

        function findScope() {
            var txt = target.value;
            if(selectionBtn.classList.contains("active") && state.selectionRange)
                return {text:txt.slice(state.selectionRange.start,state.selectionRange.end),offset:state.selectionRange.start};
            return {text:txt,offset:0};
        }

        function scheduleFind() {
            clearTimeout(state.timer);
            state.matches = [];
            state.current = -1;
            resultInfo.textContent = findInput.value ? "..." : "No results";
            updateNavButtons();
            renderOverlay();
            state.timer = setTimeout(function(){ updateMatches({selectFirst:true, keepFindFocus:true}); }, state.debounce_ms);
        }

        function updateMatches(options) {
            options = options || {};
            var re = buildRegex(true), scope = findScope();
            state.matches = [];
            state.current = -1;

            if(re) {
                var m;
                while((m = re.exec(scope.text)) !== null) {
                    state.matches.push({start:scope.offset + m.index,end:scope.offset + m.index + m[0].length,text:m[0]});
                    if(m[0].length === 0) re.lastIndex++;
                }
            }

            if(state.matches.length) state.current = 0;
            resultInfo.textContent = state.matches.length ? "1 of " + state.matches.length : "No results";
            updateNavButtons();

            if(state.matches.length && options.selectFirst) selectCurrent({keepFindFocus:!!options.keepFindFocus});
            else renderOverlay();
        }

        function scrollCurrentMatchIntoPage() {
            if(!cfg.pageScrollOnMatch) return;

            requestAnimationFrame(function() {
                var current = overlay ? overlay.querySelector(".com-pane-fr-current") : null;
                if(current && typeof current.getBoundingClientRect == "function") {
                    var rect = current.getBoundingClientRect();
                    var currentY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
                    var targetY = Math.max(0, currentY + rect.top - (cfg.pageScrollOffset == null ? 72 : cfg.pageScrollOffset));
                    try { window.scrollTo({ top: targetY, left: 0, behavior: cfg.pageScrollBehavior || "smooth" }); }
                    catch (_ignore) { window.scrollTo(0, targetY); }
                }
            });
        }

        function selectCurrent(mode) {
            if(state.current < 0 || !state.matches[state.current]) { renderOverlay(); return; }
            mode = mode || {};
            var m = state.matches[state.current];
            target.setSelectionRange(m.start, m.end);
            resultInfo.textContent = (state.current + 1) + " of " + state.matches.length;
            renderOverlay();
            scrollCurrentMatchIntoPage();
            if(mode.focusEditor) target.focus();
            else if(mode.keepFindFocus) findInput.focus();
        }

        function nextMatch(dir, selectMode) {
            clearTimeout(state.timer);
            if(!state.matches.length) { updateNavButtons(); renderOverlay(); return; }
            state.current = (state.current + dir + state.matches.length) % state.matches.length;
            selectCurrent(selectMode || {keepFindFocus:true});
        }

        function preserveCase(replacement, found) {
            if(!preserveBtn.classList.contains("active")) return replacement;
            if(found.toUpperCase() === found) return replacement.toUpperCase();
            if(found.toLowerCase() === found) return replacement.toLowerCase();
            if(found[0] && found[0].toUpperCase() === found[0])
                return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
            return replacement;
        }

        function regexReplacementText(template, found, groups) {
            if(!regexBtn.classList.contains("active")) return template;
            return String(template).replace(/\\(n|r|t|\\)|\$(\$|&|`|'|\d{1,2})/g, function(token, esc, dollar) {
                if(esc === "n") return "\n";
                if(esc === "r") return "\r";
                if(esc === "t") return "\t";
                if(esc === "\\") return "\\";
                if(dollar === "$") return "$";
                if(dollar === "&") return found;
                if(/^\d+$/.test(dollar)) return groups[Number(dollar)-1] || "";
                if(dollar === "`" || dollar === "'") return "";
                return token;
            });
        }

        function replacementForMatch(template, found, groups) {
            return preserveCase(regexReplacementText(template, found, groups || []), found);
        }

        function replaceCurrent() {
            clearTimeout(state.timer);
            if(state.current < 0 || !state.matches[state.current]) return;
            var m = state.matches[state.current];
            var singleRe = buildRegex(false);
            var singleMatch = singleRe ? singleRe.exec(m.text) : null;
            var groups = singleMatch ? Array.prototype.slice.call(singleMatch, 1) : [];
            var rep = replacementForMatch(replaceInput.value, m.text, groups);
            target.value = target.value.slice(0,m.start) + rep + target.value.slice(m.end);

            if(state.selectionRange && m.start >= state.selectionRange.start && m.end <= state.selectionRange.end) {
                state.selectionRange.end += rep.length - (m.end - m.start);
                state.lastEditorSelection = {start:state.selectionRange.start,end:state.selectionRange.end};
            }
            if(typeof cfg.onChange == "function") cfg.onChange(target);
            updateMatches({selectFirst:true, keepFindFocus:true});
        }

        function replaceAll() {
            clearTimeout(state.timer);
            var re = buildRegex(true);
            if(!re) return;
            var scope = findScope();
            var replaced = scope.text.replace(re, function() {
                var found = arguments[0];
                var groups = Array.prototype.slice.call(arguments, 1, -2);
                return replacementForMatch(replaceInput.value, found, groups);
            });
            target.value = target.value.slice(0,scope.offset) + replaced + target.value.slice(scope.offset + scope.text.length);
            if(state.selectionRange) {
                state.selectionRange.end = state.selectionRange.start + replaced.length;
                state.lastEditorSelection = {start:state.selectionRange.start,end:state.selectionRange.end};
            }
            if(typeof cfg.onChange == "function") cfg.onChange(target);
            updateMatches({selectFirst:true, keepFindFocus:true});
        }

        document.addEventListener("keydown", function(ev) {
            var mod = ev.ctrlKey || ev.metaKey;
            if((document.activeElement === target || document.activeElement === findInput || document.activeElement === replaceInput) && mod && ev.key.toLowerCase() === "f") {
                ev.preventDefault(); toggleSearch(false);
            }
            if((document.activeElement === target || document.activeElement === findInput || document.activeElement === replaceInput) && mod && ev.key.toLowerCase() === "h") {
                ev.preventDefault(); toggleSearch(true);
            }
            if(ev.key === "Escape" && bar.classList.contains("open")) {
                ev.preventDefault(); closeSearch();
            }
        });

        target.addEventListener("mousedown", function() {
            if(!selectionBtn.classList.contains("active")) {
                state.lastEditorSelection = null;
                renderOverlay();
                updateSelectionButtonState();
            }
        });

        ["mouseup","keyup","select"].forEach(function(name) {
            target.addEventListener(name, function(){ rememberEditorSelection(); renderOverlay(); });
        });

        target.addEventListener("input", function() {
            rememberEditorSelection();
            if(selectionBtn.classList.contains("active")) {
                selectionBtn.classList.remove("active");
                state.selectionRange = null;
            }
            if(typeof cfg.onChange == "function") cfg.onChange(target);
            scheduleFind();
        });

        target.addEventListener("scroll", syncOverlayScroll);
        findInput.addEventListener("input", scheduleFind);
        findInput.addEventListener("keydown", function(ev) {
            if(ev.key === "Enter") {
                ev.preventDefault();
                clearTimeout(state.timer);
                if(!state.matches.length) updateMatches({selectFirst:true, keepFindFocus:true});
                else nextMatch(ev.shiftKey ? -1 : 1);
            }
        });
        replaceInput.addEventListener("keydown", function(ev) {
            if(ev.key === "Enter") { ev.preventDefault(); replaceCurrent(); }
        });

        bar.querySelector('[data-fr-act="expand"]').onclick = function(){ bar.classList.toggle("expanded"); };
        prevBtn.onclick = function(){ nextMatch(-1); };
        nextBtn.onclick = function(){ nextMatch(1); };
        bar.querySelector(".com-pane-fr-replace-one").onclick = replaceCurrent;
        bar.querySelector(".com-pane-fr-replace-all").onclick = replaceAll;
        bar.querySelector(".com-pane-fr-close").onclick = closeSearch;
        if(floatPrevBtn) floatPrevBtn.onclick = function(ev){
            if(ev) ev.preventDefault();
            nextMatch(-1, {});
        };
        if(floatNextBtn) floatNextBtn.onclick = function(ev){
            if(ev) ev.preventDefault();
            nextMatch(1, {});
        };
        if(floatTopBtn) floatTopBtn.onclick = function(ev){
            if(ev) ev.preventDefault();
            try { window.scrollTo({ top: 0, left: 0, behavior: "smooth" }); }
            catch (_ignore) { window.scrollTo(0, 0); }
        };
        if(floatCloseBtn) floatCloseBtn.onclick = function(ev){
            if(ev) ev.preventDefault();
            closeSearch();
        };
        caseBtn.onclick = function(){ caseBtn.classList.toggle("active"); scheduleFind(); };
        wordBtn.onclick = function(){ wordBtn.classList.toggle("active"); scheduleFind(); };
        regexBtn.onclick = function(){ regexBtn.classList.toggle("active"); scheduleFind(); };
        preserveBtn.onclick = function(){ preserveBtn.classList.toggle("active"); };
        selectionBtn.onclick = function() {
            if(selectionBtn.disabled) return;
            if(selectionBtn.classList.contains("active")) {
                selectionBtn.classList.remove("active");
                state.selectionRange = null;
                scheduleFind();
                return;
            }
            if(!hasUsableEditorSelection()) return;
            state.selectionRange = {start:state.lastEditorSelection.start,end:state.lastEditorSelection.end};
            selectionBtn.classList.add("active");
            updateSelectionButtonState();
            scheduleFind();
            findInput.focus();
        };

        renderOverlay();
        updateSelectionButtonState();
        updateNavButtons();
        return { open:openSearch, close:closeSearch, toggle:toggleSearch, update:updateMatches, render:renderOverlay, floatingNav:floatingNav };
    };

    this.createPaneHeaderWidgetManager = function(host, cfg)
    {
        cfg = cfg || {};
        if(typeof host == "string") host = document.getElementById(host);
        if(!host) return null;

        host.classList.add("com-pane-header-widget-host");

        var widgets = {};
        var activeId = "";
        var defaultId = cfg.defaultId || "default";

        function setVisible(id)
        {
            activeId = id;
            for(var k in widgets) {
                if(widgets[k])
                    widgets[k].classList.toggle("active", k == id);
            }
            if(typeof cfg.onChange == "function") cfg.onChange(id);
        }

        function add(id, el, isDefault)
        {
            if(typeof el == "string") {
                host.insertAdjacentHTML("beforeend", el);
                el = host.lastElementChild;
            }
            if(!el) return null;

            el.classList.add("com-pane-header-widget");
            if(isDefault) {
                defaultId = id;
                el.classList.add("com-pane-header-default-widget");
            }
            widgets[id] = el;
            if(!el.parentNode) host.appendChild(el);

            /*
             * If a non-default widget is registered after the default widget
             * has already been activated, keep it hidden until activate(id)
             * is called.  This is the one-line header toggle contract:
             * exactly one registered widget is visible at a time.
             */
            el.classList.toggle("active", activeId == id);

            return el;
        }

        function activate(id)
        {
            if(!widgets[id]) return;
            setVisible(id);
        }

        function activateDefault()
        {
            if(widgets[defaultId]) setVisible(defaultId);
        }

        function current()
        {
            return activeId;
        }

        var api = {
            host:host,
            widgets:widgets,
            add:add,
            activate:activate,
            activateDefault:activateDefault,
            current:current
        };

        if(cfg.defaultHTML) add(defaultId, cfg.defaultHTML, true);
        activateDefault();
        return api;
    };

    this.equalizePaneHeaderHeights = function(selector)
    {
        selector = selector || ".com-pane-title";
        requestAnimationFrame(function() {
            var headers = Array.prototype.slice.call(document.querySelectorAll(selector));
            var h = 0;
            headers.forEach(function(el) {
                el.classList.remove("com-pane-title-equalized");
                el.style.removeProperty("height");
                h = Math.max(h, Math.ceil(el.getBoundingClientRect().height));
            });
            if(h <= 0) return;
            document.documentElement.style.setProperty("--com-pane-title-height", h + "px");
            headers.forEach(function(el) { el.classList.add("com-pane-title-equalized"); });
        });
    };


    this.bindSearch = function(wrapper, target, callback)
    {
      return this.bindFindReplace(target, { onChange:callback });
    };
}