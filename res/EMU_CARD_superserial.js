const assert = require('assert');
const ROM = new Uint8Array(0x800);
for(let i=0;i<ROM.length;i++) ROM[i]=i&0xff;
var irq = {};
var fakeHw = {
  irq_signal:0,
  setIRQ(source, asserted) { if(asserted) irq[source]=1; else delete irq[source]; this.irq_signal=Object.keys(irq).length?1:0; }
};
var apple2plus = { hwObj(){ return fakeHw; } };
var oEMU = {component:{IO:{}}};

// -----------------------------------------------------------------------------
// Apple II Super Serial Card (SSC)
// -----------------------------------------------------------------------------
// The 341-0065-A image above is a 2 KiB ROM.  Its first seven pages are the
// shared $C800-$CEFF expansion ROM and its last page is the slot ROM ($Cn00).
// The same final physical page is consequently also visible at $CF00-$CFFF
// while the card owns the C8 expansion-ROM window.

if(typeof(oEMU)==="undefined") var oEMU = {"component":{"IO":{}}};
if(!oEMU.component) oEMU.component = {};
if(!oEMU.component.IO) oEMU.component.IO = {};
oEMU.component.IO.SuperSerial = new SuperSerialCard();

function SuperSerialCard()
{
    var card = this;

    this.id = {
         "PCODE":"SSC"
        ,"icon":"fa fa-terminal"
        ,"description":"Apple II Super Serial Card"
    };

    /*
     * Software-visible card state.
     *
     * DIP values use the electrical sense seen by the firmware: an ON switch
     * reads as zero.  $E0 / $0A corresponds to the conventional communications
     * setup: 9600 baud, 8 data bits, no parity, one stop bit, no automatic LF.
     */
    this.state = {
         "active":true
        ,"dip1":0xE0
        ,"dip2":0x0A
        ,"irqEnabled":true
        ,"command":0x00
        ,"control":0x00
        ,"rxData":0x00
        ,"rxFull":false
        ,"rxErrors":0x00
        ,"irqPending":false
        ,"modem":{"cts":true,"dsr":true,"dcd":true}
        ,"rxCount":0
        ,"txCount":0
    };

    this.action = {
        "SlotIO": {
            "RD":{"callback":function(addr,ctx) { return card.readIO(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx) { return card.writeIO(addr,d8,ctx); }}
        },
        "SlotROM": {
            "RD":{"callback":function(addr,ctx) { return card.readSlotROM(addr,ctx); }}
        },
        "HostROM": {
            "RD":{"callback":function(addr,ctx) { return card.readHostROM(addr,ctx); }}
        }
    };

    var rxQueue = [];
    var txQueue = [];
    var transmitHandler = null;

    function mountedHw()
    {
        if(typeof(apple2plus)!="object" || !apple2plus || typeof(apple2plus.hwObj)!="function")
            return null;
        return apple2plus.hwObj();
    }

    function irqSource()
    {
        return "SSC:" + (card.mount && card.mount.hash!==undefined ? card.mount.hash : "unmounted");
    }

    function receiverIRQEnabled()
    {
        // 6551 command: DTR must be asserted and bit 1=0 enables receiver IRQ.
        return card.state.irqEnabled &&
               (card.state.command & 0x01)!==0 &&
               (card.state.command & 0x02)===0;
    }

    function updateIRQ(asserted)
    {
        card.state.irqPending = !!asserted;

        var hw = mountedHw();
        if(!hw) return;

        if(typeof(hw.setIRQ)=="function")
            hw.setIRQ(irqSource(),card.state.irqPending);
        else
            hw.irq_signal = card.state.irqPending ? 1 : 0;
    }

    function primeReceiver()
    {
        if(card.state.rxFull || rxQueue.length===0) return;

        card.state.rxData = rxQueue.shift() & 0xFF;
        card.state.rxFull = true;
        card.state.rxCount++;

        if(receiverIRQEnabled()) updateIRQ(true);
    }

    function statusByte()
    {
        var v = 0x10;                 // TDRE: transmit data register empty

        if(card.state.irqPending) v |= 0x80;
        if(!card.state.modem.dsr) v |= 0x40; // modem inputs are active low
        if(!card.state.modem.dcd) v |= 0x20;
        if(card.state.rxFull)      v |= 0x08;
        v |= card.state.rxErrors & 0x07;

        return v & 0xFF;
    }

    function readData()
    {
        var v = card.state.rxData & 0xFF;

        if(card.state.rxFull)
        {
            card.state.rxFull = false;
            card.state.rxErrors = 0;
            updateIRQ(false);
            primeReceiver();
        }

        return v;
    }

    function readStatus()
    {
        var v = statusByte();

        // A 6551 status read clears the interrupt request latch.  RDRF itself
        // remains set until the receive data register is read.
        if(card.state.irqPending) updateIRQ(false);
        return v;
    }

    function programmedReset()
    {
        /*
         * The 6551 programmed reset does not alter the control register.
         * It clears the low command bits and pending receive/error state.
         */
        card.state.command &= 0xE0;
        card.state.rxErrors = 0;
        updateIRQ(false);
    }

    this.readIO = function(addr,ctx)
    {
        var reg = addr & 0x0F;

        switch(reg)
        {
            case 0x01: return card.state.dip1 & 0xFF;
            case 0x02:
                // DIPSW2 bit 0 is the live CTS input, active low.
                return ((card.state.dip2 & 0xFE) | (card.state.modem.cts ? 0 : 1)) & 0xFF;
            case 0x08: return readData();
            case 0x09: return readStatus();
            case 0x0A: return card.state.command & 0xFF;
            case 0x0B: return card.state.control & 0xFF;
        }

        return 0x00;
    };

    this.writeIO = function(addr,d8,ctx)
    {
        var reg = addr & 0x0F;
        d8 &= 0xFF;

        switch(reg)
        {
            case 0x08:
                txQueue.push(d8);
                card.state.txCount++;
                if(typeof(transmitHandler)=="function") transmitHandler(d8,card);
                break;

            case 0x09:
                programmedReset();
                break;

            case 0x0A:
                card.state.command = d8;
                if(card.state.rxFull && receiverIRQEnabled()) updateIRQ(true);
                else if(!receiverIRQEnabled()) updateIRQ(false);
                break;

            case 0x0B:
                card.state.control = d8;
                break;
        }

        return 0x00;
    };

    this.readSlotROM = function(addr,ctx)
    {
        /*
         * Merely inspecting memory must not latch a C8 ROM.  A real CPU access
         * to $Cn00 does select this card's shared expansion-ROM window.
         */
        if(!(ctx && ctx.bRO===true) && ctx && ctx.io && typeof(ctx.io.claimHostROM)=="function")
            ctx.io.claimHostROM(card);

        return ROM[0x700 + (addr & 0xFF)];
    };

    this.readHostROM = function(addr,ctx)
    {
        var rel;

        if(ctx && Number.isFinite(ctx.rel_addr))
            rel = ctx.rel_addr;
        else if(ctx && Number.isFinite(ctx.line))
            rel = ctx.line + (addr & 0xFF);
        else
            rel = (card.action.HostROM.base || 0x800) + (addr & 0xFF);

        return ROM[(rel - (card.action.HostROM.base || 0x800)) & 0x7FF];
    };

    // Host -> Apple II.  Data may be a byte, string, array, or Uint8Array.
    this.inject = function(data)
    {
        var bytes = [];

        if(typeof(data)=="number")
            bytes.push(data & 0xFF);
        else if(typeof(data)=="string")
        {
            for(var i=0;i<data.length;i++) bytes.push(data.charCodeAt(i) & 0xFF);
        }
        else if(data && typeof(data.length)=="number")
        {
            for(var j=0;j<data.length;j++) bytes.push(Number(data[j]) & 0xFF);
        }

        for(var n=0;n<bytes.length;n++) rxQueue.push(bytes[n]);
        primeReceiver();
        return bytes.length;
    };

    // Apple II -> host.
    this.drainTx = function()
    {
        var out = new Uint8Array(txQueue);
        txQueue.length = 0;
        return out;
    };

    this.peekTx = function()
    {
        return new Uint8Array(txQueue);
    };

    this.setTransmitHandler = function(fn)
    {
        transmitHandler = typeof(fn)=="function" ? fn : null;
        return transmitHandler;
    };

    this.setModemLines = function(lines)
    {
        lines = lines || {};
        if(lines.cts!==undefined) card.state.modem.cts = !!lines.cts;
        if(lines.dsr!==undefined) card.state.modem.dsr = !!lines.dsr;
        if(lines.dcd!==undefined) card.state.modem.dcd = !!lines.dcd;
        return Object.assign({},card.state.modem);
    };

    this.setDIP = function(block,value)
    {
        value = Number(value) & 0xFF;
        if(Number(block)===1) card.state.dip1 = value;
        if(Number(block)===2) card.state.dip2 = value;
    };

    this.getBaudRate = function()
    {
        // Internal-clock baud table for the 6551 control register low nibble.
        var baud = [0,50,75,109.92,134.58,150,300,600,1200,1800,2400,3600,4800,7200,9600,19200];
        return baud[card.state.control & 0x0F] || 0;
    };

    this.getRegisters = function()
    {
        return {
             "status":statusByte()
            ,"command":card.state.command & 0xFF
            ,"control":card.state.control & 0xFF
            ,"baud":card.getBaudRate()
            ,"rxQueued":rxQueue.length + (card.state.rxFull ? 1 : 0)
            ,"txQueued":txQueue.length
        };
    };

    this.reset = function()
    {
        rxQueue.length = 0;
        txQueue.length = 0;
        card.state.command = 0x00;
        card.state.control = 0x00;
        card.state.rxData = 0x00;
        card.state.rxFull = false;
        card.state.rxErrors = 0x00;
        card.state.rxCount = 0;
        card.state.txCount = 0;
        updateIRQ(false);
    };

    this.restart = this.reset;

    // Called by Apple2IO when a live card is removed.
    this.release = function()
    {
        updateIRQ(false);
    };
}

const s = oEMU.component.IO.SuperSerial;
s.mount = {hash:123,slotN:3,ranges:{HostROM:{from:0x800,to:0xfff}}};
s.action.HostROM.base=0x800;

let claimed = null;
const ctx = {bRO:false, io:{claimHostROM(o){claimed=o;}}, rel_addr:0x800, line:0x800};
assert.strictEqual(s.readSlotROM(0,ctx), ROM[0x700]);
assert.strictEqual(claimed,s);
assert.strictEqual(s.readHostROM(0,{rel_addr:0x800}),ROM[0]);
assert.strictEqual(s.readHostROM(0xff,{rel_addr:0xeff}),ROM[0x6ff]);
assert.strictEqual(s.readHostROM(0,{rel_addr:0xf00}),ROM[0x700]);
assert.strictEqual(s.readHostROM(0xff,{rel_addr:0xfff}),ROM[0x7ff]);

assert.strictEqual(s.readIO(1),0xe0);
assert.strictEqual(s.readIO(2),0x0a);
s.writeIO(0x0b,0x18);
s.writeIO(0x0a,0x09);
assert.strictEqual(s.getRegisters().control,0x18);
assert.strictEqual(s.getRegisters().command,0x09);
assert.strictEqual(s.getBaudRate(),1200);

assert.strictEqual(s.inject('AB'),2);
let st=s.readIO(9);
assert.ok(st & 0x80,'IRQ bit');
assert.ok(st & 0x08,'RDRF');
assert.ok(st & 0x10,'TDRE');
assert.strictEqual(fakeHw.irq_signal,0,'status read clears IRQ');
assert.strictEqual(s.readIO(8),'A'.charCodeAt(0));
assert.strictEqual(fakeHw.irq_signal,1,'next queued byte reasserts IRQ');
assert.strictEqual(s.readIO(8),'B'.charCodeAt(0));
assert.strictEqual(s.getRegisters().rxQueued,0);

s.writeIO(8,0x41);
s.writeIO(8,0x42);
assert.deepStrictEqual(Array.from(s.drainTx()),[0x41,0x42]);

s.writeIO(0x0b,0x1e);
s.writeIO(0x0a,0xff);
s.writeIO(0x09,0x00);
assert.strictEqual(s.readIO(0x0b),0x1e,'programmed reset preserves control');
assert.strictEqual(s.readIO(0x0a),0xe0,'programmed reset clears low command bits');

console.log('SSC core tests: OK');
