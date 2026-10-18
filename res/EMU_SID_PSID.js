// Browser-side PSID v1/v2 loader and foreground playback UI (Phase 2B.2).
// Pure JS, no Node, no C64 emulator, no audio synthesizer. The bundled player
// bytes are compiled from asm/AUDIO/SID_PHASE2B1_PLAYER.S; tests verify parity.
// Original PSID executable and $D400 register writes are never modified.
var SIDPSID=(function(){
    "use strict";
    var STAGE_MIN=0x2000,STAGE_END=0x9000,STUB=0x1C00,RUNTIME=0x9000;
    var DESC=0x9400,ZP_BACKUP=0x9500,ACTIVE=0x929B;
    var PLAYER_STUB_HEX="4C00904C03904C06904C0990";
    var PLAYER_RUNTIME_HEX="4C0C904C7C924C0C904CFA900878A9008D9A928D9B92AD0094C953D02AAD0194C932D023AD0294C942D01CAD0394C931D015AD08940D0994F00D20FE909010A9028D9A924CE990A9018D9A924CE9908A1869828D42921869018D4692201491204691900B202091A9038D9A924CE990209191A900A2009D0000E8D0FAAD0A948DB490AD0B948DB590AD0C948DC990AD0D948DCA90AD0F94F00DA9868D9C92A9428D9D924CB090A9D48D9C92A94F8D9D92AD0E9420FFFF78A9018D9B92AD10C0202A9220499220699220FFFFAD00C030062055924CC590AD10C0207C92202091202C91A9008D9B922860A200BD8B92F008098020EDFDE8D0F32860AD9A9260A210BD80C0C953F00B8A186910AAE08090F038601860A200BD00009D0095E8D0F760A200BD00959D0000E8D0F760A200BD3A919D001CE8E00CD0F5604C00904C03904C06904C0990AD049485F0AD059485F1AD089485F4AD099485F5A9008DA2928DA392A000B1F0186DA2928DA2929003EEA392E6F0D002E6F1201D92D0E7ADA292CD1094D00AADA392CD1194D00218603860AD049485F0AD059485F1AD069485F2AD079485F3AD089485F4AD099485F5A5F3C5F19050D008A5F2C5F09048F04518A5F065F485F0A5F165F585F118A5F265F485F2A5F365F585F3A5F0D002C6F1C6F0A5F2D002C6F3C6F2A000B1F091F2A5F0D002C6F1C6F0A5F2D002C6F3C6F2201D92D0E760A000B1F091F2E6F0D002E6F1E6F2D002E6F3201D92D0EB60A5F4D002C6F5C6F4A5F405F560A91E2041922045928D9E92A91F2041922045928D9F92608DC2C060ADC3C060AD9E928DA092AD9F928DA19218ADA0926D9C928DA092ADA1926D9D928DA19260202A9238AD9E92EDA092AD9F92EDA19230EE60A9008D04D48D0BD48D12D48D18D46053494420324231204552524F520D0000000000000000000000";
    function fromHex(s){
        var b=new Uint8Array(s.length/2);
        for(var i=0;i<b.length;i++)b[i]=parseInt(s.substr(i*2,2),16);
        return b;
    }
    var stub=fromHex(PLAYER_STUB_HEX),runtime=fromHex(PLAYER_RUNTIME_HEX);
    function fail(code,message){var e=new Error(message);e.code=code;throw e;}
    function hex(n){return "$"+(n>>>0).toString(16).toUpperCase().padStart(4,"0");}
    function integer(x,label){
        if(typeof x==="number"&&Number.isInteger(x))return x;
        if(typeof x!=="string")fail("BAD_ARGUMENT",label+" must be an integer");
        var s=x.trim(),base=s.charAt(0)==="$"?16:/^0x/i.test(s)?16:10;
        var body=s.charAt(0)==="$"?s.slice(1):/^0x/i.test(s)?s.slice(2):s;
        if(!body||!(base===16?/^[0-9a-f]+$/i:/^\d+$/).test(body))
            fail("BAD_ARGUMENT","Invalid "+label+": "+s);
        var n=parseInt(body,base);
        if(!Number.isSafeInteger(n))fail("BAD_ARGUMENT","Invalid "+label);
        return n;
    }
    function asBytes(value){
        if(value instanceof Uint8Array)return new Uint8Array(value);
        if(value instanceof ArrayBuffer)return new Uint8Array(value);
        if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength).slice();
        fail("NOT_BINARY","Expected a PSID byte array");
    }
    function inspect(input,options){
        options=options||{};
        var data=asBytes(input);
        if(data.length<0x76)fail("TRUNCATED_HEADER","PSID header is truncated");
        function word(i){return (data[i]<<8)|data[i+1];}
        var signature=String.fromCharCode(data[0],data[1],data[2],data[3]);
        if(signature==="RSID")fail("RSID_UNSUPPORTED","RSID requires the C64 environment");
        if(signature!=="PSID")fail("NOT_PSID","Not a PSID file");
        var version=word(4),offset=word(6);
        if(version!==1&&version!==2)
            fail("PSID_VERSION","Only PSID v1 and v2 are supported");
        if(offset<(version===1?0x76:0x7C)||offset>=data.length)
            fail("DATA_OFFSET","Invalid PSID data offset");
        var songs=word(14),defaultSong=word(16);
        if(songs<1||songs>256||defaultSong<1||defaultSong>songs)
            fail("BAD_SONGS","Invalid PSID subtune count or default");
        var subtune=options.subtune===undefined?defaultSong:integer(options.subtune,"subtune");
        if(subtune<1||subtune>songs)fail("SUBTUNE_RANGE","Subtune must be 1–"+songs);
        var speed=((data[18]*0x1000000)+(data[19]<<16)+(data[20]<<8)+data[21])>>>0;
        var speedIndex=version===1?((subtune-1)&31):Math.min(subtune-1,31);
        if((speed>>>speedIndex)&1)fail("CIA_TIMING","CIA-timed tunes are not supported");
        var flags=version===2?word(0x76):0;
        if(flags&1)fail("MUS_UNSUPPORTED","MUS player format is not supported");
        if(flags&2)fail("PLAYSID_UNSUPPORTED","PlaySID-specific samples are not supported");
        if(version===2&&(data[0x7A]||data[0x7B]))
            fail("MULTISID","Multiple SID chips are not supported");
        var clockBits=(flags>>2)&3,modelBits=(flags>>4)&3;
        var hz=options.videoHz===undefined?(clockBits===2?60:50):integer(options.videoHz,"videoHz");
        if(hz!==50&&hz!==60)fail("FRAME_RATE","Only 50 or 60 Hz VBI timing is supported");
        if((clockBits===1&&hz!==50)||(clockBits===2&&hz!==60))
            fail("CLOCK_MISMATCH","Frame rate conflicts with PSID clock flags");
        var payloadOffset=offset,load=word(8);
        if(!load){
            if(offset+2>data.length)fail("TRUNCATED_PRG","Missing embedded PRG load address");
            load=data[offset]|(data[offset+1]<<8);
            payloadOffset+=2;
        }
        var length=data.length-payloadOffset,end=load+length;
        if(length<1)fail("EMPTY_PAYLOAD","Empty PSID executable payload");
        if(load<0x0C00||end>0xC000)
            fail("EXECUTION_RANGE","Executable must fit RAM $0C00–$BFFF");
        if(load<0x9600&&end>0x9000)
            fail("PLAYER_COLLISION","Executable overlaps reserved $9000–$95FF");
        var init=word(10)||load,play=word(12);
        if(!play)fail("IRQ_PLAY_UNSUPPORTED","PLAY=$0000 requires a C64 IRQ");
        if(init<load||init>=end||play<load||play>=end)
            fail("ENTRYPOINT_RANGE","INIT/PLAY must reside in executable payload");
        function stringAt(at){
            var out="";
            for(var i=at;i<at+32;i++){if(!data[i])break;out+=String.fromCharCode(data[i]);}
            return out.trim();
        }
        return {version:version,headerSize:offset,payloadOffset:payloadOffset,
            fileLength:data.length,loadAddress:load,executableEnd:end,
            payloadLength:length,initAddress:init,playAddress:play,
            songs:songs,defaultSong:defaultSong,selectedSong:subtune,
            speed:speed,flags:flags,rateHz:hz,
            preferredSIDModel:modelBits===1?6581:modelBits===2?8580:null,
            title:stringAt(0x16),author:stringAt(0x36),released:stringAt(0x56)};
    }
    function prepare(input,options){
        options=options||{};
        var bytes=asBytes(input);
        var stage=integer(options.stage===undefined?0x6000:options.stage,"stage");
        if(bytes.length>STAGE_END-STAGE_MIN||stage<STAGE_MIN||
           stage+bytes.length>STAGE_END)
            fail("STAGING_RANGE","The complete PSID must fit $2000–$8FFF (28 KiB)");
        var info=inspect(bytes,options);
        var desc=new Uint8Array(18);
        desc.set([0x53,0x32,0x42,0x31],0);
        function putWord(i,value){desc[i]=value&255;desc[i+1]=(value>>>8)&255;}
        putWord(4,stage+info.payloadOffset);
        putWord(6,info.loadAddress);
        putWord(8,info.payloadLength);
        putWord(10,info.initAddress);
        putWord(12,info.playAddress);
        desc[14]=info.selectedSong-1;desc[15]=info.rateHz===60?1:0;
        var sum=0;
        for(var i=info.payloadOffset;i<bytes.length;i++)sum=(sum+bytes[i])&0xFFFF;
        putWord(16,sum);
        return Object.assign({},info,{stage:stage,payloadAddress:stage+info.payloadOffset,
            checksum:sum,descriptor:desc,bytes:bytes});
    }
    function playerImage(){return {bootstrap:stub.slice(),runtime:runtime.slice()};}
    function installedActive(hw){
        if(!hw||typeof hw.safe_read!=="function")return false;
        // Avoid false positives when arbitrary RAM happens to have $01 at ACTIVE.
        return hw.safe_read(RUNTIME)===0x4C&&hw.safe_read(RUNTIME+1)===0x0C&&
            hw.safe_read(RUNTIME+2)===0x90&&hw.safe_read(ACTIVE)===1;
    }
    function install(hw,source,options){
        if(!hw||typeof hw.safe_flashdump!=="function"||
           typeof hw.load_ram64k!=="function")
            fail("NO_RAM_API","Apple II RAM snapshot/load APIs are unavailable");
        if(installedActive(hw))
            fail("ALREADY_PLAYING","Stop the currently playing PSID before loading another");
        // Validate everything BEFORE mutating live RAM.
        var image=prepare(source,options);
        var snapshot=hw.safe_flashdump();
        if(!snapshot||snapshot.length<0xC000)
            fail("NO_RAM_API","Unable to read physical main RAM");
        var next=new Uint8Array(0x10000);
        next.set(snapshot.subarray(0,0xC000),0);
        next.set(image.bytes,image.stage);
        next.set(stub,STUB);
        next.set(runtime,RUNTIME);
        next.set(image.descriptor,DESC);
        hw.load_ram64k(next); // Atomic from the caller's JS event; preserves all other RAM.
        return image;
    }
    function sendKeys(card,chars){
        var hw=card&&typeof apple2plus!=="undefined"&&apple2plus&&
            typeof apple2plus.hwObj==="function"?apple2plus.hwObj():null;
        var io=hw&&hw.io;
        if(!io||typeof io.pipeSend!=="function")
            fail("NO_KEYBOARD","Apple II keyboard pipe router is unavailable");
        if(io.pipeSend("0:PASTEBO:text","0:A2KBD:text",
                      {mime:"text/plain",data:chars})===false)
            fail("NO_KEYBOARD","Failed to send text to Apple II keyboard");
    }
    var current=null; // one browser panel, associated with the selected card
    function element(tag,attrs,parent){
        var node=document.createElement(tag),k;
        for(k in attrs)if(Object.prototype.hasOwnProperty.call(attrs,k)){
            if(k==="text")node.textContent=attrs[k];
            else node.setAttribute(k,attrs[k]);
        }
        if(parent)parent.appendChild(node);
        return node;
    }
    function setStatus(panel,message,isError){
        panel.status.textContent=message;
        panel.status.style.color=isError?"#ff9b9b":"#c9d5e7";
    }
    function close(card){
        if(!current||card&&current.card!==card)return;
        if(current.timer)clearInterval(current.timer);
        if(current.root&&current.root.parentNode)current.root.parentNode.removeChild(current.root);
        current=null;
    }
    function refresh(panel){
        if(!panel.card.state.active){close(panel.card);return;}
        var hw=typeof apple2plus!=="undefined"&&apple2plus&&
            typeof apple2plus.hwObj==="function"?apple2plus.hwObj():null;
        if(!hw)return;
        var running=installedActive(hw);
        if(running)panel.seenRunning=true;
        if(panel.issued&&panel.seenRunning&&!running){
            panel.issued=false;panel.seenRunning=false;
            setStatus(panel,"Playback finished. Select Play to restart.",false);
        }
        panel.stop.disabled=!running;
        panel.play.disabled=!panel.bytes||running||panel.issued;
        panel.load.disabled=running;
    }
    function open(card){
        if(typeof document==="undefined"||!document.body)return false;
        if(current&&current.card===card){close(card);return false;}
        close();
        var root=element("section",{role:"dialog","aria-label":"SID PSID player"},document.body);
        root.style.cssText="position:fixed;right:16px;top:95px;z-index:99999;"+
           "background:#212936;color:#f5f5f5;width:360px;max-width:calc(100vw - 32px);"+
           "box-sizing:border-box;border:1px solid #77899d;border-radius:7px;"+
           "padding:12px;font:12px Arial,sans-serif;box-shadow:0 5px 24px #0009;";
        var heading=element("div",{text:"SID · PSID v1/v2 player"},root);
        heading.style.cssText="font-weight:bold;font-size:14px;margin-bottom:10px;";
        var dismiss=element("button",{type:"button",text:"×","aria-label":"Close PSID player"},root);
        dismiss.style.cssText="position:absolute;right:10px;top:8px;cursor:pointer;";
        dismiss.onclick=function(){close(card);};
        var hint=element("p",{text:"Use a disposable TEXT-mode Apple II session at the Applesoft prompt. Playing may overwrite BASIC workspace."},root);
        hint.style.cssText="font-size:11px;line-height:1.4;";
        var selectRow=element("div",{},root);
        selectRow.style.cssText="display:flex;align-items:center;gap:8px;margin:8px 0;";
        var fileLabel=element("label",{text:"Select .sid"},selectRow);
        var fileInput=element("input",{type:"file",accept:".sid,application/octet-stream"},selectRow);
        fileInput.style.cssText="max-width:240px;font-size:11px;";
        var name=element("div",{text:"No file loaded"},root);
        name.style.cssText="word-break:break-word;margin:7px 0;";
        var fields=element("div",{},root);
        fields.style.cssText="display:flex;align-items:center;gap:10px;margin:9px 0;";
        var stageLabel=element("label",{text:"Stage $"},fields);
        var stage=element("input",{type:"text",value:"6000","aria-label":"PSID staging address"},stageLabel);
        stage.style.cssText="width:58px;font:12px monospace;";
        var songLabel=element("label",{text:"Subtune "},fields);
        var song=element("select",{"aria-label":"PSID subtune"},songLabel);
        song.style.cssText="min-width:54px;";
        var buttons=element("div",{},root);
        buttons.style.cssText="display:flex;gap:8px;margin:10px 0;";
        var play=element("button",{type:"button",text:"▶ Play"},buttons);
        var stop=element("button",{type:"button",text:"■ Stop"},buttons);
        play.disabled=true;stop.disabled=true;
        var metadata=element("div",{text:"Select a PSID v1/v2 file to inspect its compatibility."},root);
        metadata.style.cssText="font:11px/1.4 monospace;white-space:pre-wrap;margin:9px 0;";
        var status=element("div",{role:"status",text:"Ready for file selection."},root);
        status.style.cssText="border-top:1px solid #526174;padding-top:7px;"+
            "line-height:1.35;min-height:28px;color:#c9d5e7";
        var panel={card:card,root:root,status:status,file:fileInput,load:fileInput,
            stage:stage,song:song,play:play,stop:stop,bytes:null,
            issued:false,seenRunning:false,sequence:0,timer:null};
        current=panel;
        fileInput.onchange=async function(){
            var file=this.files&&this.files[0],serial=++panel.sequence;
            if(!file)return;
            try{
                if(file.size>STAGE_END-STAGE_MIN)
                    fail("STAGING_RANGE","PSID file exceeds the 28 KiB staging window");
                var raw=new Uint8Array(await file.arrayBuffer());
                if(current!==panel||serial!==panel.sequence||!card.state.active)return;
                var meta=inspect(raw);
                panel.bytes=raw; panel.issued=false;panel.seenRunning=false;
                name.textContent=(meta.title||file.name)+" — "+file.name;
                stage.value=raw.length<=0x3000?"6000":"2000";
                song.textContent="";
                for(var i=1;i<=meta.songs;i++){
                    var option=element("option",{value:String(i),text:String(i)},song);
                    if(i===meta.defaultSong)option.selected=true;
                }
                metadata.textContent="PSID v"+meta.version+" · "+meta.songs+" subtune(s)"+
                    "\nLoad "+hex(meta.loadAddress)+" · INIT "+hex(meta.initAddress)+
                    " · PLAY "+hex(meta.playAddress)+
                    "\n"+meta.rateHz+" Hz VBI · "+meta.payloadLength+" payload bytes";
                setStatus(panel,"Compatible header. Select Play from the Applesoft prompt.",false);
            }catch(err){
                panel.bytes=null;name.textContent=file.name;
                metadata.textContent="";
                setStatus(panel,(err.code?err.code+": ":"")+err.message,true);
            }finally{if(current===panel)refresh(panel);}
        };
        play.onclick=function(){
            if(!panel.bytes)return;
            try{
                if(panel.issued||installedActive(apple2plus.hwObj()))
                    fail("ALREADY_PLAYING","Stop the current PSID before reloading");
                var options={stage:integer("$"+stage.value.replace(/^\$/,""),"stage"),
                    subtune:integer(song.value,"subtune")};
                // Preflight and RAM replacement are synchronous to this user event.
                var image=install(apple2plus.hwObj(),panel.bytes,options);
                card.setEnabled(true);card.setSnoopEnabled(true);
                card.setClock(image.rateHz===60?1022727:985248);
                if(image.preferredSIDModel)card.setModel(image.preferredSIDModel);
                if(typeof EMU_audio_event_unlock==="function")EMU_audio_event_unlock();
                sendKeys(card,"CALL 7168\n");
                panel.issued=true;panel.seenRunning=false;
                setStatus(panel,"CALL 7168 sent to the Apple II keyboard. "+
                    "Playback begins when Applesoft accepts the command.",false);
            }catch(err){
                setStatus(panel,(err.code?err.code+": ":"")+err.message,true);
            }
            refresh(panel);
        };
        stop.onclick=function(){
            try{
                sendKeys(card," ");
                setStatus(panel,"Stop key sent. The player will restore Apple II zero page.",false);
            }catch(err){setStatus(panel,err.message,true);}
            refresh(panel);
        };
        panel.timer=setInterval(function(){if(current===panel)refresh(panel);},300);
        refresh(panel);
        return true;
    }
    return {inspect:inspect,prepare:prepare,install:install,playerImage:playerImage,
        installedActive:installedActive,open:open,dispose:close,
        STAGE_MIN:STAGE_MIN,STAGE_END:STAGE_END,TRAMP:STUB,RUNTIME:RUNTIME,
        DESCRIPTOR:DESC,ZP_BACKUP:ZP_BACKUP};
})();
