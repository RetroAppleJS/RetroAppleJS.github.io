const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadLiron()
{
    const context = vm.createContext({
        console,
        Uint8Array,
        Array,
        Number,
        String,
        Object,
        Math,
        RangeError,
        Error,
        Reflect
    });
    context.oEMU = {component:{IO:{}}};
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function fakeUniDisk(unit,filename)
{
    return {
        id:{
            DCODE:'UNIDISK35',
            description:'Apple UniDisk 3.5',
            deviceN:unit
        },
        getUnit(){ return unit; },
        getState(){
            return {
                unit,
                mediaLoaded:!!filename,
                mediaFilename:filename || ''
            };
        }
    };
}

test('Liron toolbox renders attached SmartPort devices as ordered vertical unit rows', () => {
    const context = loadLiron();
    const card = new context.AppleLiron();
    const unit1 = fakeUniDisk(1,'CardCat 1.94.po');
    const unit2 = fakeUniDisk(2,'TOOLS.po');
    card.devices = [unit1,unit2];

    assert.equal(typeof card.deviceToolSlotHTML,'function',
        'Liron must provide its own slot toolbox renderer');

    const html = card.deviceToolSlotHTML({
        slotN:6,
        slotID:'5',
        toolboxID:'device_tool_5',
        devices:card.devices
    });

    assert.match(html,/id="device_tool_5"/);
    assert.match(html,/data-smartport-unit="1"/);
    assert.match(html,/data-smartport-unit="2"/);
    assert.ok(html.indexOf('data-smartport-unit="1"') < html.indexOf('data-smartport-unit="2"'),
        'unit rows must be rendered vertically in SmartPort unit order');
    assert.match(html,/Unit 1/);
    assert.match(html,/Unit 2/);
    assert.match(html,/CardCat 1\.94\.po/);
    assert.match(html,/TOOLS\.po/);
    assert.match(html,/type="file"/);
    assert.match(html,/Load/);
    assert.match(html,/Eject/);
});
