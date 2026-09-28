'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const lironSource = fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const hd20Source = fs.readFileSync('res/EMU_DEVICE_HD20.js','utf8');
const unidiskSource = fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const topologySource = fs.readFileSync('res/EMU_CARD_smartport_topology.js','utf8');
const loaderSource = fs.readFileSync('res/DBG_testbench.js','utf8');

function hd20Image(volumeName)
{
    const image = new Uint8Array(40960*512);
    image[0] = 0x11;
    image[image.length-1] = 0xEE;
    const name = String(volumeName || '').slice(0,15);
    const offset = 2*512+4;
    image[offset] = 0xF0 | name.length;
    for(let i=0;i<name.length;i++) image[offset+1+i] = name.charCodeAt(i)&0x7F;
    return image;
}

function unidiskImage()
{
    const image = new Uint8Array(1600*512);
    image[0] = 0x22;
    image[image.length-1] = 0xDD;
    return image;
}

function loadContext(extra={})
{
    const context = vm.createContext(Object.assign({
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RangeError,Error,Reflect,Function,
        EMU_deviceMediaRowHTML(){return '<row></row>';}
    },extra));

    context.oEMU = {component:{IO:{}}};
    vm.runInContext(unidiskSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(hd20Source,context,{filename:'EMU_DEVICE_HD20.js'});
    vm.runInContext(lironSource,context,{filename:'EMU_CARD_LIRON.js'});
    vm.runInContext(topologySource,context,{filename:'EMU_CARD_smartport_topology.js'});
    return context;
}

test('SmartPort detach media policy is loaded by the browser bootstrap', () => {
    assert.match(loaderSource,/EMU_CARD_smartport_topology\.js/,
        'the SmartPort topology policy should load with the other runtime topology policies');
});

test('HD20 releaseMedia frees the 20 MiB backing store instead of keeping a zeroed image allocated', () => {
    const context = loadContext();
    const hd = new context.HD20Device();

    assert.equal(typeof hd.releaseMedia,'function',
        'HD20Device must expose a media-release path for physical detach');

    hd.loadImage(hd20Image('BLANK92'),{filename:'BLANK92.po'});
    assert.equal(hd.getState().mediaLoaded,true);
    assert.equal(hd.getState().mediaBytes,20971520);
    assert.equal(hd.getState().mediaFilename,'BLANK92.po');
    assert.equal(hd.getSuggestedFilename(),'BLANK92.po');

    assert.equal(hd.releaseMedia(),true);

    const state = hd.getState();
    assert.equal(state.mediaLoaded,false);
    assert.equal(state.mediaBytes,0);
    assert.equal(state.mediaFilename,'');
    assert.equal(state.dirty,false);
    assert.equal(state.lastBlock,null);
    assert.equal(hd.getImage(),null,
        'detached HD20 media must not allocate or return a replacement 20 MiB image');
    assert.equal(hd.readBlock(2).error,0x27,
        'released HD20 media must no longer be readable');
});

test('detaching an HD20 SmartPort device releases its mounted media before leaving the Liron bus', () => {
    const context = loadContext();
    const card = new context.AppleLiron();
    const hd = new context.HD20Device();

    assert.equal(hd.bindHost(card),true);
    hd.loadImage(hd20Image('BLANK92'),{filename:'BLANK92.po'});
    assert.equal(card.getBus().getDevice(1),hd);
    assert.equal(hd.getState().mediaBytes,20971520);

    assert.equal(hd.unbindHost(card),true);

    assert.equal(card.getBus().getDevice(1),null);
    assert.equal(hd.getState().mediaLoaded,false);
    assert.equal(hd.getState().mediaBytes,0);
    assert.equal(hd.getImage(),null);
});

test('detaching a UniDisk SmartPort device ejects removable media as part of topology removal', () => {
    const context = loadContext();
    const card = new context.AppleLiron();
    const uni = new context.UniDisk35Device();

    assert.equal(uni.bindHost(card),true);
    uni.loadImage(unidiskImage(),{filename:'TOOLS.po'});
    assert.equal(card.getBus().getDevice(1),uni);
    assert.equal(uni.getState().mediaLoaded,true);
    assert.equal(uni.getState().mediaBytes,819200);

    assert.equal(uni.unbindHost(card),true);

    assert.equal(card.getBus().getDevice(1),null);
    assert.equal(uni.getState().mediaLoaded,false);
    assert.equal(uni.getState().mediaBytes,0);
    assert.equal(uni.getImage(),null);
});
