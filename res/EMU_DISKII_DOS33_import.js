/*
 * DOS 3.3 host-file importer for the Disk II controller.
 * Pure conversion routines: the controller commits the returned .dsk atomically.
 * .dsk bytes use DOS physical-sector ordering as returned by convertNib2Dsk().
 */
(function(root) {
"use strict";
var SIZE=143360, TRACKS=35, SECTORS=16, SECTOR_SIZE=256;
function check(c,msg) { if(!c) throw Error(msg); }
function hex(n) {return "$"+(n>>>0).toString(16).toUpperCase().padStart(4,"0");}
function address(raw) {
    var s=String(raw==null?"":raw).trim();
    check(/^(?:\$[0-9a-f]{1,4}|0x[0-9a-f]{1,4}|[0-9]{1,5})$/i.test(s),
        "Load address must be $0000–$FFFF (or a decimal address).");
    var n=s[0]==="$"?parseInt(s.slice(1),16):/^0x/i.test(s)?parseInt(s.slice(2),16):Number(s);
    check(n>=0 && n<=0xffff,"Load address outside $0000–$FFFF.");
    return n;
}
function filename(raw) {
    var base=String(raw || "").split(/[\\/]/).pop();
    base=base.toUpperCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
    base=base.replace(/[^A-Z0-9 ._\-]/g,"_").replace(/^\s+|\s+$/g,"");
    check(base.length>0 && base.length<=30,"DOS filename must contain 1–30 characters.");
    check(/[A-Z]/.test(base.charAt(0)),"DOS filename must start with a letter.");
    return base;
}
function textBytes(source,preset) {
    // Apple DOS text requires bit 7 set and CR ($8D), never UTF-8 on disk.
    var preserve=/^A2e_/i.test(String(preset||""));
    var uk=/^A2e_UK$/i.test(String(preset||""));
    var out=[],unmapped=0;
    var str=String(source).replace(/^\uFEFF/,"").replace(/\r\n?|\n/g,"\n");
    for(var c of str) {
        if(c==="\n") {out.push(0x8d);continue;}
        if(c==="\t") {out.push(0xa0);continue;}
        if(uk && c==="£") {out.push(0xa3);continue;}
        var replacements={"ß":"SS","Æ":"AE","æ":"ae","Œ":"OE","œ":"oe",
            "Ø":"O","ø":"o","Ł":"L","ł":"l","Đ":"D","đ":"d",
            "“":"\"","”":"\"","‘":"'","’":"'","—":"-","–":"-","…":"..."};
        var normalized=(replacements[c] || c).normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
        if(!preserve) normalized=normalized.toUpperCase();
        for(var p of normalized) {
            var cp=p.codePointAt(0);
            if(cp<0x20 || cp>0x7e) {out.push(0xbf);unmapped++;}
            else out.push(cp|0x80);
        }
    }
    out.push(0); // DOS sequential text EOF marker
    return {bytes:Uint8Array.from(out),unmapped:unmapped};
}
function prepare(input) {
    var kind=String(input.kind||"").toUpperCase();
    var bytes=input.bytes instanceof Uint8Array?input.bytes:new Uint8Array(input.bytes||[]);
    var name=filename(input.name);
    var payload,unmapped=0,start=null;
    if(kind==="B") {
        start=address(input.address);
        check(bytes.length<=65535,"Binary file exceeds the DOS 3.3 16-bit length limit.");
        check(start+bytes.length<=0x10000,
            "Binary would exceed $FFFF: "+hex(start)+" + "+bytes.length+" bytes.");
        payload=new Uint8Array(bytes.length+4);
        payload[0]=start&255;payload[1]=start>>8;
        payload[2]=bytes.length&255;payload[3]=bytes.length>>8;
        payload.set(bytes,4);
    } else if(kind==="T") {
        var transcoded=textBytes(input.text||"",input.preset||"A2_US");
        payload=transcoded.bytes;unmapped=transcoded.unmapped;
    } else throw Error("Unsupported import type: "+kind);
    return {kind:kind,name:name,bytes:payload,loadAddress:start,unmapped:unmapped};
}
function write(dsk,file) {
    check(dsk && dsk.length===SIZE,"Import requires a 35-track DOS-order 140 KB disk image.");
    check(file && (file.kind==="B" || file.kind==="T"),"Only binary and text DOS files are supported.");
    var image=Uint8Array.from(dsk), vtocOff=17*4096, vtoc=image.subarray(vtocOff,vtocOff+256);
    check(vtoc[3]===3 && vtoc[0x34]===35 && vtoc[0x35]===16 &&
        vtoc[0x36]===0 && vtoc[0x37]===1,
        "Disk is not a recognized DOS 3.3 35-track/16-sector volume.");
    function valid(t,s){return t>=0 && t<35 && s>=0 && s<16;}
    // DOS image offsets are physically skewed; the catalog and T/S pointers
    // contain physical sector numbers, unlike positions in a .dsk byte array.
    // This must agree with AppleDisk2.SECTION_ORDER_DOS33.
    var physicalToDOS=[0x0,0x7,0xe,0x6,0xd,0x5,0xc,0x4,0xb,0x3,0xa,0x2,0x9,0x1,0x8,0xf];
    function off(t,s){return t*4096+physicalToDOS[s]*256;}
    var ct=vtoc[1],cs=vtoc[2],seen={},target=-1;
    check(valid(ct,cs) && ct!==0,"Invalid DOS catalog pointer.");
    for(var count=0;ct!==0 && count<32;count++){
        check(valid(ct,cs) && ct===17,"Unexpected or corrupt DOS catalog chain.");
        var key=ct+":"+cs;check(!seen[key],"Cyclic DOS catalog chain.");seen[key]=true;
        var p=off(ct,cs), sec=image.subarray(p,p+256);
        for(var i=0;i<7;i++) {
            var e=p+0x0b+i*0x23,t=image[e],s=image[e+1];
            if(t===0 || t===0xff){if(target<0)target=e;continue;}
            check(valid(t,s),"Corrupt DOS catalog T/S entry.");
            var existing="";
            for(var j=0;j<30;j++) existing+=String.fromCharCode(image[e+3+j]&0x7f);
            check(existing.trim()!==file.name,"A file named "+file.name+" already exists (no overwrite).");
        }
        ct=sec[1];cs=sec[2];
    }
    check(ct===0,"DOS catalog chain exceeds safety limit.");
    check(target>=0,"DOS catalog is full.");
    var numData=Math.max(1,Math.ceil(file.bytes.length/256));
    var numLists=Math.ceil(numData/122);
    var need=numData+numLists, available=[];
    for(var t=3;t<TRACKS;t++) {
        if(t===17)continue; // keep VTOC and directory track untouched
        for(var s=SECTORS-1;s>=0;s--) {
            var bitmap=0x38+t*4+(s>>3),mask=0x80>>(s&7);
            if(vtoc[bitmap]&mask)available.push([t,s]);
        }
    }
    check(available.length>=need,"Not enough free DOS 3.3 sectors (need "+
        need+", available "+available.length+").");
    var claimed=available.slice(0,need), lists=claimed.slice(0,numLists),
        blocks=claimed.slice(numLists);
    claimed.forEach(function(ts) {
        var bitmap=vtocOff+0x38+ts[0]*4+(ts[1]>>3);
        image[bitmap]&=~(0x80>>(ts[1]&7));
        image.fill(0,off(ts[0],ts[1]),off(ts[0],ts[1])+256);
    });
    for(var d=0;d<numData;d++){
        image.set(file.bytes.subarray(d*256,(d+1)*256),off(blocks[d][0],blocks[d][1]));
    }
    for(var l=0;l<numLists;l++){
        var at=off(lists[l][0],lists[l][1]);
        if(l+1<numLists) {image[at+1]=lists[l+1][0];image[at+2]=lists[l+1][1];}
        image[at+5]=(l*122)&255;image[at+6]=(l*122)>>8;
        for(var n=0;n<122 && l*122+n<numData;n++){
            var ts=blocks[l*122+n];
            image[at+0x0c+n*2]=ts[0];
            image[at+0x0d+n*2]=ts[1];
        }
    }
    image[target]=lists[0][0];image[target+1]=lists[0][1];
    image[target+2]={T:0,B:4}[file.kind];
    for(var k=0;k<30;k++) image[target+3+k]=(k<file.name.length?
        file.name.charCodeAt(k):32)|0x80;
    image[target+0x21]=need&255;image[target+0x22]=(need>>8)&255;
    return {image:image,name:file.name,kind:file.kind,sectors:need,
        bytes:file.bytes.length,loadAddress:file.loadAddress,unmapped:file.unmapped};
}
var api={parseAddress:address,dosName:filename,encodeText:textBytes,
    prepare:prepare,insert:write};
root.DiskIIDOS33Import=api;
if(typeof module!=="undefined" && module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
