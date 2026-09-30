'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function loadCard()
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={console,Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RegExp};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return sandbox.__ctor;
}

function render(card)
{
    return card.deviceToolSlotHTML({toolboxID:'device_tool_S7',slotID:'S7',slotN:8});
}

test('Dithertizer controls render exactly three compact DTH/COL/IMG rows',()=>{
    const DithertizerII=loadCard();
    const card=new DithertizerII();
    const html=render(card);

    assert.equal((html.match(/data-dither-row=/g)||[]).length,3);
    assert.match(html,/data-dither-row="DTH"/);
    assert.match(html,/data-dither-row="COL"/);
    assert.match(html,/data-dither-row="IMG"/);
    assert.match(html,/>DTH<\/b>/);
    assert.match(html,/>COL<\/b>/);
    assert.match(html,/>IMG<\/b>/);
});

test('DTH row exposes approved ConvertHGR mode, preset, incoming-error and offset controls',()=>{
    const DithertizerII=loadCard();
    const html=render(new DithertizerII());

    for(const label of ['Error diffusion','Order1','Order2','Order3','Order4','Atkinson','Floyd-Stein','Pattern','Diag','None','Accumulate','Average'])
        assert.ok(html.includes('>'+label+'</option>'),'missing '+label);

    assert.match(html,/id="dither_ctrl_S7_mode"/);
    assert.match(html,/id="dither_ctrl_S7_preset"/);
    assert.match(html,/id="dither_ctrl_S7_error"/);
    assert.match(html,/id="dither_ctrl_S7_offset"[^>]*type="range"[^>]*min="0"[^>]*max="16"/);
    assert.match(html,/id="dither_ctrl_S7_offset_value"[^>]*>0</);
});

test('COL and IMG rows expose the approved checkbox, slider and filter controls',()=>{
    const DithertizerII=loadCard();
    const html=render(new DithertizerII());

    for(const id of ['perceptual','greyscale','histogram'])
        assert.match(html,new RegExp('id="dither_ctrl_S7_'+id+'"[^>]*type="checkbox"'));

    assert.match(html,/id="dither_ctrl_S7_luma"[^>]*type="range"[^>]*min="0"[^>]*max="500"[^>]*value="80"/);
    assert.match(html,/id="dither_ctrl_S7_shift"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*value="1"/);
    assert.match(html,/id="dither_ctrl_S7_gamma"[^>]*type="range"[^>]*min="0"[^>]*max="500"[^>]*value="130"/);

    for(const label of ['Box','Gaussian','Hamming','Blackman','Bilinear'])
        assert.ok(html.includes('>'+label+'</option>'),'missing '+label);
});

test('UI values are local card state and re-render without changing Dithertizer capture state',()=>{
    const DithertizerII=loadCard();
    const card=new DithertizerII();
    const before={threshold:card.state.threshold,captureEnabled:card.state.captureEnabled,page2:card.state.page2};

    card.deviceToolSetting('dither_ctrl_S7','mode','order4');
    card.deviceToolSetting('dither_ctrl_S7','preset','floyd');
    card.deviceToolSetting('dither_ctrl_S7','error','average');
    card.deviceToolSetting('dither_ctrl_S7','offset',11);
    card.deviceToolSetting('dither_ctrl_S7','luma',125);
    card.deviceToolSetting('dither_ctrl_S7','shift',17);
    card.deviceToolSetting('dither_ctrl_S7','gamma',145);
    card.deviceToolSetting('dither_ctrl_S7','filter','hamming');
    card.deviceToolFlag('dither_ctrl_S7','perceptual',true);
    card.deviceToolFlag('dither_ctrl_S7','greyscale',true);
    card.deviceToolFlag('dither_ctrl_S7','histogram',true);

    const html=render(card);
    assert.match(html,/value="order4" selected>Order4</);
    assert.match(html,/value="floyd" selected>Floyd-Stein</);
    assert.match(html,/value="average" selected>Average</);
    assert.match(html,/id="dither_ctrl_S7_offset"[^>]*value="11"/);
    assert.match(html,/id="dither_ctrl_S7_luma"[^>]*value="125"/);
    assert.match(html,/id="dither_ctrl_S7_shift"[^>]*value="17"/);
    assert.match(html,/id="dither_ctrl_S7_gamma"[^>]*value="145"/);
    assert.match(html,/value="hamming" selected>Hamming</);
    assert.match(html,/id="dither_ctrl_S7_perceptual"[^>]*checked/);
    assert.match(html,/id="dither_ctrl_S7_greyscale"[^>]*checked/);
    assert.match(html,/id="dither_ctrl_S7_histogram"[^>]*checked/);

    assert.deepEqual({threshold:card.state.threshold,captureEnabled:card.state.captureEnabled,page2:card.state.page2},before);
});

test('all approved controls remain enabled in this UI-only stage',()=>{
    const DithertizerII=loadCard();
    const html=render(new DithertizerII());
    assert.equal(/\sdisabled(?:\s|>|=)/.test(html),false);
});
