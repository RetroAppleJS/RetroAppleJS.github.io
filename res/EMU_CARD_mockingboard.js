if(oEMU===undefined) var oEMU = {"component":{"IO":{}}};
oEMU.component.IO.mockingboard = new mockingboard();

function mockingboard()
{
    this.id={"PCODE":"MOCK","icon":"fa fa-assistive-listening-systems"};
    this.state={"active":true};
}

function MockingboardR6522(options)
{
    options=options||{};
    var via=this;
    this.name=options.name||"6522";
    this.onPortAChange=typeof(options.onPortAChange)==="function"?options.onPortAChange:null;
    this.onPortBChange=typeof(options.onPortBChange)==="function"?options.onPortBChange:null;
    this.onIrqChange=typeof(options.onIrqChange)==="function"?options.onIrqChange:null;

    function updateIRQ()
    {
        var next=!!(via.ifr & via.ier & 0x7F);
        if(next===via.irqLevel) return;
        via.irqLevel=next;
        if(via.onIrqChange) via.onIrqChange(next,via);
    }
    function updatePins()
    {
        var oldA=via.paPins, oldB=via.pbPins;
        via.paPins=((via.ora & via.ddra) | (via.iraExternal & (~via.ddra & 0xFF))) & 0xFF;
        via.pbPins=((via.orb & via.ddrb) | (via.irbExternal & (~via.ddrb & 0xFF))) & 0xFF;
        if(oldA!==via.paPins && via.onPortAChange) via.onPortAChange(via.paPins,via);
        if(oldB!==via.pbPins && via.onPortBChange) via.onPortBChange(via.pbPins,via);
    }
    function visibleIFR(){ return (via.ifr & 0x7F) | ((via.ifr & via.ier & 0x7F)?0x80:0); }
    function clearIFR(mask){ via.ifr &= ~(mask & 0x7F); updateIRQ(); }
    function setIFR(mask){ via.ifr |= mask & 0x7F; updateIRQ(); }

    this.reset=function()
    {
        this.ora=this.orb=0;
        this.ddra=this.ddrb=0;
        this.iraExternal=this.irbExternal=0xFF;
        this.paPins=this.pbPins=0xFF;
        this.t1Counter=this.t1Latch=0xFFFF; this.t1Phase=0;
        this.t2Counter=0xFFFF; this.t2LatchLow=0xFF; this.t2StartValue=0xFFFF; this.t2Phase=0;
        this.t1Running=this.t2Running=false;
        this.t1HasInterrupted=this.t2HasInterrupted=false;
        this.sr=this.acr=this.pcr=this.ifr=this.ier=0;
        this.irqLevel=false;
        this.ca1=this.ca2=this.cb1=this.cb2=1;
    };
    this.peekRegister=function(reg)
    {
        switch(reg & 0x0F)
        {
            case 0x00:return this.pbPins;
            case 0x01:return this.paPins;
            case 0x02:return this.ddrb;
            case 0x03:return this.ddra;
            case 0x04:return this.t1Counter & 0xFF;
            case 0x05:return (this.t1Counter>>8)&0xFF;
            case 0x06:return this.t1Latch & 0xFF;
            case 0x07:return (this.t1Latch>>8)&0xFF;
            case 0x08:return this.t2Counter & 0xFF;
            case 0x09:return (this.t2Counter>>8)&0xFF;
            case 0x0A:return this.sr;
            case 0x0B:return this.acr;
            case 0x0C:return this.pcr;
            case 0x0D:return visibleIFR();
            case 0x0E:return (this.ier & 0x7F)|0x80;
            case 0x0F:return this.paPins;
        }
        return 0xFF;
    };
    this.readRegister=function(reg)
    {
        reg &= 0x0F;
        var value=this.peekRegister(reg);
        switch(reg)
        {
            case 0x00: clearIFR(0x18); break;
            case 0x01: clearIFR(0x03); break;
            case 0x04: clearIFR(0x40); break;
            case 0x08: clearIFR(0x20); break;
        }
        return value;
    };
    this.writeRegister=function(reg,value)
    {
        reg&=0x0F; value&=0xFF;
        switch(reg)
        {
            case 0x00:this.orb=value; clearIFR(0x18); updatePins(); break;
            case 0x01:this.ora=value; clearIFR(0x03); updatePins(); break;
            case 0x0F:this.ora=value; updatePins(); break;
            case 0x02:this.ddrb=value; updatePins(); break;
            case 0x03:this.ddra=value; updatePins(); break;
            case 0x04:this.t1Latch=(this.t1Latch & 0xFF00)|value; break;
            case 0x05:
                this.t1Latch=(value<<8)|(this.t1Latch & 0xFF);
                this.t1Counter=this.t1Latch; this.t1Phase=0; this.t1Running=true; this.t1HasInterrupted=false;
                clearIFR(0x40);
                break;
            case 0x06:this.t1Latch=(this.t1Latch & 0xFF00)|value; break;
            case 0x07:this.t1Latch=(value<<8)|(this.t1Latch & 0xFF); clearIFR(0x40); break;
            case 0x08:this.t2LatchLow=value; break;
            case 0x09:
                this.t2StartValue=(value<<8)|this.t2LatchLow;
                this.t2Counter=this.t2StartValue; this.t2Phase=0; this.t2Running=true; this.t2HasInterrupted=false;
                clearIFR(0x20);
                break;
            case 0x0A:this.sr=value; clearIFR(0x04); break;
            case 0x0B:this.acr=value; break;
            case 0x0C:this.pcr=value; break;
            case 0x0D:this.ifr &= ~(value & 0x7F); updateIRQ(); break;
            case 0x0E:
                if(value & 0x80) this.ier |= value & 0x7F;
                else this.ier &= ~(value & 0x7F);
                updateIRQ();
                break;
        }
    };
    this.setPortAInput=function(value,mask)
    {
        mask=mask===undefined?0xFF:(mask&0xFF); value&=0xFF;
        this.iraExternal=(this.iraExternal & (~mask & 0xFF)) | (value & mask);
        updatePins();
    };
    this.setPortBInput=function(value,mask)
    {
        mask=mask===undefined?0xFF:(mask&0xFF); value&=0xFF;
        this.irbExternal=(this.irbExternal & (~mask & 0xFF)) | (value & mask);
        updatePins();
    };
    this.setCA1=function(level){ level=level?1:0; var old=this.ca1; this.ca1=level; if(old!==level){ var rising=!!(this.pcr&0x01); if((rising&&level)||(!rising&&!level)) setIFR(0x02); } };
    this.setCA2=function(level){ level=level?1:0; var old=this.ca2; this.ca2=level; if(old!==level){ var rising=!!(this.pcr&0x04); if((rising&&level)||(!rising&&!level)) setIFR(0x01); } };
    this.setCB1=function(level){ level=level?1:0; var old=this.cb1; this.cb1=level; if(old!==level){ var rising=!!(this.pcr&0x10); if((rising&&level)||(!rising&&!level)) setIFR(0x10); } };
    this.setCB2=function(level){ level=level?1:0; var old=this.cb2; this.cb2=level; if(old!==level){ var rising=!!(this.pcr&0x40); if((rising&&level)||(!rising&&!level)) setIFR(0x08); } };
    this.needsRealtimeTick=function()
    {
        var t1=this.t1Running && !!(this.ier & 0x40) && ((this.acr & 0x40) || !this.t1HasInterrupted);
        var t2=this.t2Running && !(this.acr & 0x20) && !!(this.ier & 0x20) && !this.t2HasInterrupted;
        return !!(t1||t2);
    };
    this.tick=function(cycles)
    {
        cycles=Math.floor(Number(cycles));
        if(!Number.isFinite(cycles) || cycles<=0) return;

        if(this.t1Running)
        {
            var n1=this.t1Latch & 0xFFFF;
            if(this.acr & 0x40)
            {
                var p1=n1+2;
                var total1=this.t1Phase+cycles;
                if(total1>=p1) setIFR(0x40);
                this.t1Phase=total1 % p1;
                this.t1Counter=this.t1Phase<=n1 ? ((n1-this.t1Phase)&0xFFFF) : 0xFFFF;
            }
            else
            {
                var before1=this.t1Phase;
                this.t1Phase+=cycles;
                if(!this.t1HasInterrupted && before1<n1+2 && this.t1Phase>=n1+2)
                {
                    this.t1HasInterrupted=true;
                    setIFR(0x40);
                }
                this.t1Counter=(n1-(this.t1Phase % 0x10000)) & 0xFFFF;
            }
        }

        if(this.t2Running && !(this.acr & 0x20))
        {
            var n2=this.t2StartValue & 0xFFFF;
            var before2=this.t2Phase;
            this.t2Phase+=cycles;
            if(!this.t2HasInterrupted && before2<n2+2 && this.t2Phase>=n2+2)
            {
                this.t2HasInterrupted=true;
                setIFR(0x20);
            }
            this.t2Counter=(n2-(this.t2Phase % 0x10000)) & 0xFFFF;
        }
    };
    this.getState=function(){ return {ora:this.ora,orb:this.orb,ddra:this.ddra,ddrb:this.ddrb,paPins:this.paPins,pbPins:this.pbPins,ifr:this.peekRegister(0x0D),ier:this.peekRegister(0x0E),irq:this.irqLevel}; };
    this.reset();
}
MockingboardR6522.REG={ORB:0,ORA:1,DDRB:2,DDRA:3,T1CL:4,T1CH:5,T1LL:6,T1LH:7,T2CL:8,T2CH:9,SR:10,ACR:11,PCR:12,IFR:13,IER:14,ORA_NH:15};
MockingboardR6522.IFR={CA2:0x01,CA1:0x02,SR:0x04,CB2:0x08,CB1:0x10,T2:0x20,T1:0x40,IRQ:0x80};
MockingboardR6522.REG_NAMES=["ORB","ORA","DDRB","DDRA","T1CL","T1CH","T1LL","T1LH","T2CL","T2CH","SR","ACR","PCR","IFR","IER","ORA_NH"];
