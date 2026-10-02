'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function loadCard(){
    const sandbox={console,Uint8Array,ArrayBuffer};
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res/EMU_CARD_dithertizer.js'),'utf8'),sandbox);
    return new sandbox.DithertizerII();
}
function render(card){return card.deviceToolSlotHTML({toolboxID:'device_tool_S7',slotID:'S7',slotN:8});}
test('camera panel exposes only brightness, contrast and gamma with neutral defaults',()=>{
    const html=render(loadCard());
    assert.equal((html.match(/type="range"/g)||[]).length,3);
    assert.doesNotMatch(html,/<select|type="checkbox"/);
    for(const [name,value] of [['brightness',0],['contrast',100],['gamma',100]])
        assert.match(html,new RegExp('id="dither_ctrl_S7_'+name+'"[^>]*value="'+value+'"'));
    for(const label of ['Brightness','Contrast','Gamma']) assert.ok(html.includes(label));
    assert.match(html,/id="dither_ctrl_S7_camera"/);
});
test('adjustments re-render locally without changing threshold, capture or HGR page selection',()=>{
    const card=loadCard();
    card.writeSlotIO(0,128,{});
    const before=JSON.stringify(card.state);
    for(const [name,value] of [['brightness',25],['contrast',150],['gamma',200]])
        assert.equal(card.deviceToolSetting('dither_ctrl_S7',name,value),true);
    const html=render(card);
    for(const [name,value] of [['brightness',25],['contrast',150],['gamma',200]])
        assert.match(html,new RegExp('id="dither_ctrl_S7_'+name+'"[^>]*value="'+value+'"'));
    assert.equal(JSON.stringify(card.state),before);
});
