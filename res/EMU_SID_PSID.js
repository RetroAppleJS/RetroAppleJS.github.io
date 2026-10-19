// Phase 2B.2 host utility — raw PSID file transfer ONLY.
// NO PSID parser, subtune menu, execution controls or bundled 6502 interpreter.
// Apple II native assembly (SID_PHASE2B2_NATIVE_PLAYER.S) owns all PSID logic.
var SIDPSID=(function(){
    "use strict";
    var MIN=0x2000,END=0x9000,RECORD=0x9430,current=null;
    function fail(message){throw new Error(message);}
    function number(value){
        if(typeof value==="number"&&Number.isInteger(value))return value;
        var s=String(value).trim();
        if(s[0]==="$")s=s.slice(1);
        if(s.slice(0,2).toLowerCase()==="0x")s=s.slice(2);
        if(!/^[0-9a-f]{1,4}$/i.test(s))fail("Enter a hexadecimal staging address");
        return parseInt(s,16);
    }
    function plan(bytes,start){
        var address=number(start);
        var length=bytes&&bytes.length;
        if(!Number.isSafeInteger(length)||length<1)fail("File is empty");
        if(length>END-MIN)fail("File exceeds 28 KiB staging capacity");
        if(address<MIN||address>=END||address+length>END)
            fail("PSID does not fit at the selected Apple II RAM address");
        return {start:address,length:length,end:address+length-1};
    }
    function transfer(hw,raw,start){
        if(!hw||typeof hw.safe_flashdump!=="function"||
           typeof hw.load_ram64k!=="function")fail("Apple II RAM loader unavailable");
        var bytes=raw instanceof Uint8Array?raw:new Uint8Array(raw);
        var info=plan(bytes,start);
        var old=hw.safe_flashdump();
        if(!old||old.length<0xC000)fail("Cannot snapshot Apple II memory");
        // Copy all main RAM, then only replace the chosen staged range and
        // an eight-byte transfer record. No changes to music or native player.
        var ram=new Uint8Array(0x10000);
        ram.set(old.subarray(0,0xC000));
        ram.set(bytes,info.start);
        ram.set([0x53,0x49,0x44,0x46,
            info.start&255,info.start>>>8,
            info.length&255,info.length>>>8],RECORD);
        hw.load_ram64k(ram);
        return info;
    }
    function el(tag,props,parent){
        var e=document.createElement(tag);
        Object.keys(props||{}).forEach(function(k){
            if(k==="text")e.textContent=props[k];
            else e.setAttribute(k,props[k]);
        });
        if(parent)parent.appendChild(e);
        return e;
    }
    function close(card){
        if(!current||card&&current.card!==card)return;
        if(current.root.parentNode)current.root.parentNode.removeChild(current.root);
        current=null;
    }
    function open(card){
        if(typeof document==="undefined"||!document.body)return false;
        if(current&&current.card===card){close(card);return false;}
        close();
        var root=el("section",{role:"dialog","aria-label":"PSID raw file transfer"},document.body);
        root.style.cssText="position:fixed;right:16px;top:95px;z-index:99999;"+
            "width:350px;max-width:calc(100vw - 32px);padding:12px;"+
            "background:#212936;color:white;border:1px solid #77899d;"+
            "border-radius:7px;box-sizing:border-box;font:12px Arial,sans-serif;";
        var title=el("strong",{text:"PSID file → Apple II RAM"},root);
        var dismiss=el("button",{type:"button",text:"×","aria-label":"Close file transfer"},root);
        dismiss.style.cssText="float:right;";
        dismiss.onclick=function(){close(card);};
        var info=el("p",{text:"Transfer the original file unchanged. The native 6502 player parses its header and asks for the subtune."},root);
        info.style.cssText="line-height:1.4;";
        var file=el("input",{type:"file",accept:".sid,application/octet-stream"},root);
        var section=el("div",{},root);section.style.margin="10px 0";
        var label=el("label",{text:"RAM start ($HEX): "},section);
        var address=el("input",{type:"text",value:"6000","aria-label":"PSID RAM start address"},label);
        address.style.cssText="width:70px;font:12px monospace;";
        var details=el("div",{text:"Select a file to see its size and destination."},root);
        details.style.cssText="line-height:1.6;white-space:pre-wrap;margin:8px 0;";
        var upload=el("button",{type:"button",text:"Transfer to RAM"},root);
        upload.disabled=true;
        var status=el("div",{role:"status",text:"Ready."},root);
        status.style.cssText="margin-top:8px;line-height:1.4;";
        var panel={card:card,root:root,bytes:null,name:""};
        current=panel;
        function update(){
            if(!panel.bytes||!card.state.active){upload.disabled=true;return;}
            try{
                var spec=plan(panel.bytes,address.value);
                details.textContent=panel.name+" · "+spec.length+" bytes"+
                    "\n$"+spec.start.toString(16).toUpperCase().padStart(4,"0")+
                    "–$"+spec.end.toString(16).toUpperCase().padStart(4,"0");
                upload.disabled=false;
                status.textContent="Fits entirely in the 28 KiB staging window.";
            }catch(error){details.textContent=error.message;upload.disabled=true;}
        }
        file.onchange=async function(){
            var selected=this.files&&this.files[0];
            if(!selected)return;
            try{
                if(selected.size>END-MIN)fail("File exceeds 28 KiB capacity");
                var bytes=new Uint8Array(await selected.arrayBuffer());
                if(current!==panel||!card.state.active)return;
                panel.bytes=bytes;panel.name=selected.name;
                if(bytes.length>END-0x6000)address.value="2000";
                update();
            }catch(error){panel.bytes=null;upload.disabled=true;status.textContent=error.message;}
        };
        address.oninput=update;
        upload.onclick=function(){
            try{
                var hw=typeof apple2plus!=="undefined"&&apple2plus&&
                    typeof apple2plus.hwObj==="function"?apple2plus.hwObj():null;
                var copied=transfer(hw,panel.bytes,address.value);
                status.textContent="Transferred "+copied.length+" bytes at $"+
                    copied.start.toString(16).toUpperCase().padStart(4,"0")+
                    ". Start the native player with CALL 7168.";
            }catch(error){status.textContent="Transfer failed: "+error.message;}
        };
        return true;
    }
    return {plan:plan,transfer:transfer,open:open,dispose:close,
        STAGE_MIN:MIN,STAGE_END:END,TRANSFER_RECORD:RECORD};
})();
