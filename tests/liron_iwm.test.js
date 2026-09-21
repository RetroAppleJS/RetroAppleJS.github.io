'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_LIRON.js'),'utf8');
const context = { console:{ log(){}, warn(){}, error(){} } };
vm.createContext(context);
vm.runInContext(source,context);

function makeBus()
{
    return {
        resets:0,
        sense:0,
        readByte:0xA5,
        writes:[],
        protocolState:'WAIT_SYNC',
        reset(){ this.resets++; },
        readSense(){ return this.sense; },
        readData(){ return this.readByte; },
        writeData(value){
            value &= 0xFF;
            this.writes.push(value);
            if(value===0xC8) this.protocolState='RESPONSE_PENDING';
        },
        getState(){ return {protocolState:this.protocolState}; }
    };
}

function makeIWM()
{
    const bus = makeBus();
    const iwm = new context.LironIWM(bus);
    return {iwm,bus};
}

test('each IWM soft switch clears or sets one of the eight state bits', () => {
    const {iwm} = makeIWM();

    for(let bit=0;bit<8;bit++)
    {
        iwm.reset();
        iwm.read((bit << 1) | 1);
        assert.equal(iwm.getState().lines,1 << bit,'odd address must set bit '+bit);

        iwm.read(bit << 1);
        assert.equal(iwm.getState().lines,0,'even address must clear bit '+bit);
    }
});

test('reset clears state and mode and resets the SmartPort bus', () => {
    const {iwm,bus} = makeIWM();

    iwm.read(0x01);          // PHASE0 on
    iwm.write(0x0D,0x00);   // Q6 on
    iwm.write(0x0F,0x1B);   // Q7 on + MODE write (motor off)
    assert.notEqual(iwm.getState().lines,0);
    assert.equal(iwm.getState().mode,0x1B);

    const before = bus.resets;
    iwm.reset();

    const state = iwm.getState();
    assert.equal(state.lines,0);
    assert.equal(state.mode,0);
    assert.equal(state.readData,0xFF);
    assert.equal(state.writeData,0);
    assert.equal(state.writeReady,true);
    assert.equal(state.underrun,false);
    assert.equal(bus.resets,before+1);
});

test('Q6/Q7 select DATA, STATUS, HANDSHAKE and MODE/WRITE DATA', () => {
    const {iwm} = makeIWM();

    assert.equal(iwm.getState().selectedRegister,'ALLONES');

    iwm.read(0x09); // MOTOR on, Q6=0 Q7=0
    assert.equal(iwm.getState().selectedRegister,'DATA');

    iwm.read(0x0D); // Q6 on
    assert.equal(iwm.getState().selectedRegister,'STATUS');

    iwm.read(0x0C); // Q6 off
    iwm.read(0x0F); // Q7 on
    assert.equal(iwm.getState().selectedRegister,'HANDSHAKE');

    iwm.read(0x0D); // Q6 on while motor on
    assert.equal(iwm.getState().selectedRegister,'WRITEDATA');

    iwm.read(0x08); // MOTOR off
    assert.equal(iwm.getState().selectedRegister,'MODE');
});

test('idle DATA selection returns all ones and enabled DATA reads come from the bus', () => {
    const {iwm,bus} = makeIWM();

    assert.equal(iwm.read(0x00),0xFF); // even read, Q6=0 Q7=0, motor off

    bus.readByte = 0x5A;
    iwm.read(0x09);                    // MOTOR on
    assert.equal(iwm.read(0x00),0x5A); // even DATA read
});

test('STATUS contains SENSE, enable and low five mode bits', () => {
    const {iwm,bus} = makeIWM();

    // Enter MODE write state while motor is off.
    iwm.write(0x0D,0x00); // Q6 high
    iwm.write(0x0F,0x15); // Q7 high and write MODE

    // Select STATUS: Q7 low, Q6 high, then read through an unrelated even switch.
    iwm.read(0x0E);
    bus.sense = 1;
    assert.equal(iwm.read(0x00),0x95); // $80 SENSE + $15 mode

    // MOTOR/enable contributes status bit 5.
    iwm.read(0x09);
    assert.equal(iwm.read(0x00),0xB5);

    bus.sense = 0;
    assert.equal(iwm.read(0x00),0x35);
});

test('HANDSHAKE reports ready, no-underrun and ones in bits 5..0', () => {
    const {iwm} = makeIWM();

    iwm.setWriteReady(true);
    iwm.setUnderrun(false);
    iwm.read(0x0C); // Q6 low
    iwm.read(0x0F); // Q7 high
    assert.equal(iwm.read(0x00),0xFF);

    iwm.setWriteReady(false);
    assert.equal(iwm.read(0x00),0x7F);

    iwm.setUnderrun(true);
    assert.equal(iwm.read(0x00),0x3F);
});

test('final SmartPort write drains on handshake poll and clears underrun bit 6', () => {
    const {iwm,bus} = makeIWM();

    // Select WRITE DATA: motor on, Q6=1, Q7=1.
    iwm.read(0x09);
    iwm.read(0x0D);
    iwm.read(0x0F);

    bus.protocolState='RECEIVE_COMMAND';
    iwm.write(0x0D,0xAA);
    assert.equal(iwm.getState().writeReady,false,'new write must occupy the IWM write buffer');
    assert.equal(iwm.read(0x0C),0xFF,'intermediate byte drain becomes ready without underrun');
    assert.equal(iwm.getState().writeReady,true);
    assert.equal(iwm.getState().underrun,false);

    // Re-enter WRITE DATA and transmit the packet-end byte. The fake bus now
    // reports RESPONSE_PENDING, matching the state reached by the real bus
    // after accepting the complete command packet.
    iwm.read(0x0D);
    iwm.write(0x0D,0xC8);
    assert.equal(bus.protocolState,'RESPONSE_PENDING');
    assert.equal(iwm.getState().writeReady,false);
    assert.equal(iwm.getState().underrun,false);

    // This is the authentic ROM's LDA $C08C,X at $C92C: Q6 goes low with Q7
    // high, selecting HANDSHAKE. Bit 6 must clear once the final byte drains.
    const handshake=iwm.read(0x0C);
    assert.equal(handshake & 0x80,0x80,'write buffer must become ready');
    assert.equal(handshake & 0x40,0x00,'final-byte drain must signal underrun/write complete');
    assert.equal(iwm.getState().underrun,true);
});

test('WRITE BLOCK command and DATA packet ACK states also signal final-byte drain', () => {
    for(const terminalState of ['WRITE_COMMAND_ACK','WRITE_DATA_ACK'])
    {
        const {iwm,bus} = makeIWM();

        // Select WRITE DATA and queue the final packet byte.
        iwm.read(0x09);
        iwm.read(0x0D);
        iwm.read(0x0F);
        iwm.write(0x0D,0xC8);

        // The real SmartPortBus enters these states after the WRITE command
        // packet and its following DATA packet respectively.
        bus.protocolState=terminalState;

        const handshake=iwm.read(0x0C);
        assert.equal(handshake & 0x80,0x80,terminalState+' must leave the transmit buffer ready');
        assert.equal(handshake & 0x40,0x00,terminalState+' must signal final-byte drain/write complete');
        assert.equal(iwm.getState().underrun,true,terminalState+' must latch the IWM underrun indication');
    }
});

test('odd Q6/Q7 writes target MODE with motor off and DATA with motor on', () => {
    const {iwm,bus} = makeIWM();

    iwm.write(0x0D,0xAA); // Q6 high, Q7 still low: no register write
    assert.equal(iwm.getState().mode,0);
    assert.equal(iwm.getState().writeData,0);

    iwm.write(0x0F,0x1F); // Q7 high, motor off => MODE
    assert.equal(iwm.getState().mode,0x1F);
    assert.equal(iwm.getState().writeData,0);
    assert.deepEqual(bus.writes,[]);

    iwm.write(0x09,0x00); // MOTOR on; Q6=Q7=1 => DATA
    assert.equal(iwm.getState().writeData,0x00);
    assert.deepEqual(bus.writes,[0x00]);

    iwm.write(0x0D,0xA6); // Q6 high again; Q7 high, motor on => DATA
    assert.equal(iwm.getState().writeData,0xA6);
    assert.deepEqual(bus.writes,[0x00,0xA6]);

    iwm.write(0x0E,0xCC); // even address clears Q7; must not write DATA
    assert.equal(iwm.getState().writeData,0xA6);
    assert.deepEqual(bus.writes,[0x00,0xA6]);
});

test('register addresses are normalized to their low nibble', () => {
    const {iwm} = makeIWM();

    iwm.read(0x101);
    assert.equal(iwm.getState().lines,0x01);
    iwm.read(0x120);
    assert.equal(iwm.getState().lines,0x00);
});
