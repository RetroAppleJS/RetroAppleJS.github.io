const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadLiron(extra={})
{
    const context=vm.createContext(Object.assign({
        console,Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect
    },extra));
    context.oEMU={component:{IO:{}}};
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function disk(unit,filename,calls)
{
    return {
        id:{DCODE:'UNIDISK35',deviceN:unit,description:'Apple UniDisk 3.5'},
        getUnit(){return unit;},
        getState(){return {unit,mediaLoaded:!!filename,mediaFilename:filename||''};},
        ejectImage(){calls.push(unit);filename='';return true;}
    };
}

test('Liron eject targets only the selected SmartPort unit and refreshes the toolbox',()=>{
    const ejectCalls=[];
    const refreshCalls=[];
    const context=loadLiron({
        apple2plus:{hwObj(){return {io:{
            slot2ID(slotN){return String(slotN-1);},
            refreshDeviceToolboxes(arg){refreshCalls.push(arg);}
        }};}}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const unit1=disk(1,'CardCat 1.94.po',ejectCalls);
    const unit2=disk(2,'TOOLS.po',ejectCalls);
    card.devices=[unit1,unit2];

    assert.equal(typeof card.deviceToolEject,'function',
        'Liron must expose a per-unit deviceToolEject handler');

    const html=card.deviceToolSlotHTML({
        slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices
    });
    assert.match(html,/deviceToolEject\(2\)/,
        'loaded Unit 2 row must wire Eject to SmartPort unit 2');

    assert.equal(card.deviceToolEject(2),true);
    assert.deepEqual(ejectCalls,[2]);
    assert.equal(unit1.getState().mediaFilename,'CardCat 1.94.po',
        'ejecting Unit 2 must leave Unit 1 media mounted');
    assert.equal(unit2.getState().mediaLoaded,false);
    assert.equal(refreshCalls.length,1);
});
