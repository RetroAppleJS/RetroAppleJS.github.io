//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_CARD_SID.js
// Apple II peripheral: SID register bus decoding and slot-side configuration.
// ALL synthesis and audio output are implemented by EMU_DEVICE_SID_audio.js.
//

if(typeof oEMU==="undefined")var oEMU={component:{IO:{}}};
if(!oEMU.component)oEMU.component={IO:{}};
if(!oEMU.component.IO)oEMU.component.IO={};
oEMU.component.IO.sid=new SIDCard();

function SIDCard()
{
    var card=this,io=null;
    var enabled=true,snoop=true,regIndex=0,model=6581,clock=985248,volume=100;
    var sniffedWrites=0,slotWrites=0;
    var lastWrite={address:0,value:0,tick:0};

    this.id={PCODE:"SID",icon:"fa fa-music"};
    this.state={active:true,irq:false};
    this.deviceConfig=[{
        DCODE:"SIDAUDIO",coID:"SIDAudio",hostPCODE:"SID",deviceN:1,
        singleton:true,icon:"fa fa-volume-up",
        description:"MOS 6581/8580 synthesis and audio output",
        autoAttach:true
    }];
    this.action={SlotIO:{
        RD:{callback:function(addr,ctx){return card.readSlotIO(addr,ctx);}},
        WR:{callback:function(addr,data,ctx){return card.writeSlotIO(addr,data,ctx);}}
    }};

    function audioDevice()
    {
        var devices=Array.isArray(card.devices)?card.devices:[];
        for(var i=0;i<devices.length;i++){
            var d=devices[i];
            if(d && d.id && d.id.DCODE==="SIDAUDIO")return d;
        }
        return null;
    }
    function timestamp(ctx)
    {
        if(ctx && Number.isFinite(Number(ctx.cpuTick)))return Math.floor(Number(ctx.cpuTick));
        if(io && typeof io.getClockTicks==="function"){
            var t=Number(io.getClockTicks());
            if(Number.isFinite(t))return Math.floor(t);
        }
        return 0;
    }
    function hex(n,digits){return (n>>>0).toString(16).toUpperCase().padStart(digits,"0");}
    this.getAudioDevice=audioDevice;
    this.getModel=function(){return model;};
    this.getClock=function(){return clock;};
    this.getVolume=function(){return volume;};
    this.isSnoopEnabled=function(){return enabled&&snoop&&this.state.active;};
    this.setModel=function(value)
    {
        value=Number(value);
        if(value!==6581 && value!==8580)throw new RangeError("SID model must be 6581 or 8580");
        model=value;
        var d=audioDevice();
        if(d && typeof d.setModel==="function")d.setModel(model);
        return model;
    };
    this.setClock=function(value)
    {
        value=Number(value);
        if(value!==985248 && value!==1022727)
            throw new RangeError("SID clock must be PAL 985248 or NTSC 1022727 Hz");
        clock=value;
        var d=audioDevice();
        if(d && typeof d.setClock==="function")d.setClock(clock);
        return clock;
    };
    this.setVolume=function(value)
    {
        value=Number(value);
        if(!Number.isInteger(value)||value<0||value>100)
            throw new RangeError("SID volume must be 0–100%");
        volume=value;
        var d=audioDevice();
        if(d && typeof d.setVolume==="function")d.setVolume(value);
        return volume;
    };
    this.setEnabled=function(value){enabled=!!value;return enabled;};
    this.setSnoopEnabled=function(value){snoop=!!value;return snoop;};
    this.getConfiguration=function()
    {
        return {model:model,clockHz:clock,volumePct:volume,
                enabled:enabled,snoop:snoop,
                registerIndex:regIndex,registers:audioDevice()?.getRegisters()||new Uint8Array(32)};
    };
    this.getStatistics=function()
    {
        return {snoopWrites:sniffedWrites,slotWrites:slotWrites,
                lastWrite:Object.assign({},lastWrite)};
    };
    function writeToSID(reg,value,addr,ctx,snooped)
    {
        if(!enabled||!card.state.active||ctx?.bRO===true)return false;
        var d=audioDevice();
        if(!d)return false;
        var tick=timestamp(ctx);
        d.writeRegister(reg,value,tick);
        lastWrite={address:addr&0xFFFF,value:value&255,tick:tick};
        if(snooped)sniffedWrites++;else slotWrites++;
        return true;
    }
    // Called by the Apple2Hw.write() bus observer after the ordinary
    // ROM/language-card write dispatch. Neither the SID card nor its child
    // overlays the Apple II $D000–$FFFF memory map.
    this.observeBusWrite=function(addr,data,ctx)
    {
        addr=Number(addr)&0xFFFF;
        if(!this.isSnoopEnabled() || addr<0xD400 || addr>0xD41F)return false;
        return writeToSID(addr&31,data,addr,ctx,true);
    };
    function status()
    {
        return (enabled?1:0)|(snoop?2:0)|(model===8580?4:0)|
               (audioDevice()?8:0);
    }
    this.readSlotIO=function(addr,ctx)
    {
        var r=Number(addr)&15,d=audioDevice();
        if(r===0)return 0x53;                 // SID signature
        if(r===1)return status();
        if(r===2)return regIndex;
        if(r===3)return d?d.readRegister(regIndex,ctx?.bRO?undefined:timestamp(ctx)):0xFF;
        if(r===4)return model===8580?1:0;
        if(r===5)return clock===1022727?1:0;
        if(r===6)return enabled?1:0;
        if(r===7)return snoop?1:0;
        if(r>=8 && r<=11)return d?d.readRegister(0x19+r-8,ctx?.bRO?undefined:timestamp(ctx)):0xFF;
        if(r===12)return lastWrite.address&31;
        if(r===13)return lastWrite.value;
        if(r===14)return sniffedWrites&255;
        if(r===15)return (sniffedWrites>>>8)&255;
        return 0xFF;
    };
    this.writeSlotIO=function(addr,data,ctx)
    {
        if(ctx?.bRO===true)return false;
        var r=Number(addr)&15,v=Number(data)&255;
        if(r===2){regIndex=v&31;return true;}
        if(r===3)return writeToSID(regIndex,v,0xD400+regIndex,ctx,false);
        if(r===4){this.setModel((v&1)?8580:6581);return true;}
        if(r===5){this.setClock((v&1)?1022727:985248);return true;}
        if(r===6){this.setEnabled(!!(v&1));return true;}
        if(r===7){this.setSnoopEnabled(!!(v&1));return true;}
        return false;
    };
    this.reset=function()
    {
        // Model, clock and user volume intentionally survive a soft reset.
        enabled=true;snoop=true;regIndex=0;sniffedWrites=slotWrites=0;
        lastWrite={address:0,value:0,tick:0};
        var d=audioDevice();
        if(d&&typeof d.reset==="function")d.reset();
    };
    this.restart=function()
    {
        if(typeof apple2plus!=="undefined" && apple2plus &&
           typeof apple2plus.hwObj==="function"){
            var hw=apple2plus.hwObj();
            io=hw&&hw.io?hw.io:null;
        }
        this.state.active=true;
        this.reset();
    };
    this.onUnmount=function()
    {
        this.state.active=false;
        var d=audioDevice();
        if(d&&typeof d.onUnmount==="function")d.onUnmount();
    };
    this.deviceToolSlotHTML=function(ctx)
    {
        ctx=ctx||{};
        var access="apple2plus.hwObj().io.HASH2obj("+Number(this.mount?.hash||0)+")";
        var selModel="<select title='SID model' aria-label='SID model' onchange='"+access+"?.setModel(Number(this.value))'>"+
            "<option value='6581'"+(model===6581?" selected":"")+">6581</option>"+
            "<option value='8580'"+(model===8580?" selected":"")+">8580</option></select>";
        var selClock="<select title='SID clock' aria-label='SID clock' onchange='"+access+"?.setClock(Number(this.value))'>"+
            "<option value='985248'"+(clock===985248?" selected":"")+">PAL 985248 Hz</option>"+
            "<option value='1022727'"+(clock===1022727?" selected":"")+">NTSC 1022727 Hz</option></select>";
        return "<div class='toolbox' id='"+(ctx.toolboxID||"device_tool_"+ctx.slotID)+"' hidden>"+
            "<div class='appbox' style='padding:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap'>"+
            "<label>SID "+selModel+"</label><label>Clock "+selClock+"</label>"+
            "<label title='Intercept CPU writes to $D400-$D41F'>"+
            "<input type='checkbox' "+(snoop?"checked ":"")+"onchange='"+access+"?.setSnoopEnabled(this.checked)'>Native $D400 writes</label>"+
            "<label>Volume <input type='range' min='0' max='100' value='"+volume+"' "+
            "oninput='"+access+"?.setVolume(Number(this.value))' style='width:80px'></label>"+
            "<span title='Unchanged Apple II ROM and Language Card mapping'>"+
            "$D400–$D41F · "+(audioDevice()?"Audio attached":"Attach SIDAUDIO")+"</span>"+
            "</div></div>";
    };
}
