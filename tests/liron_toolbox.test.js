const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadLiron(extra={})
{
    const context = vm.createContext(Object.assign({
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
    },extra));
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

test('Liron Unit 2 file chooser loads through the normal browser router with explicit unit', () => {
    const mountCalls=[];
    const refreshCalls=[];

    class FakeFileReader
    {
        readAsArrayBuffer(file)
        {
            this.onload({target:{result:file.bytes.buffer}});
        }
    }

    const context = loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            mountCalls.push({bytes:Array.from(bytes),slotN,deviceID,filename,unit});
            return true;
        },
        apple2plus:{
            hwObj(){
                return {io:{
                    slot2ID(slotN){return String(slotN-1);},
                    refreshDeviceToolboxes(arg){refreshCalls.push(arg);}
                }};
            }
        }
    });

    const card = new context.AppleLiron();
    card.mount={slotN:6};
    card.devices=[fakeUniDisk(1,''),fakeUniDisk(2,'')];

    assert.equal(typeof card.deviceToolLoadFile,'function',
        'Liron must provide deviceToolLoadFile for the per-unit file chooser');

    const html=card.deviceToolSlotHTML({
        slotN:6,
        slotID:'5',
        toolboxID:'device_tool_5',
        devices:card.devices
    });
    assert.match(html,/deviceToolLoadFile\(this,2\)/,
        'Unit 2 file input must be wired to the Unit 2 loader');

    const file={
        name:'TOOLS.po',
        size:819200,
        bytes:new Uint8Array(819200)
    };
    const input={files:[file],value:'chosen'};

    assert.equal(card.deviceToolLoadFile(input,2),true);
    assert.equal(mountCalls.length,1);
    assert.equal(mountCalls[0].slotN,6);
    assert.equal(mountCalls[0].deviceID,'UNIDISK35');
    assert.equal(mountCalls[0].filename,'TOOLS.po');
    assert.equal(mountCalls[0].unit,2,'browser router must receive the selected SmartPort unit');
    assert.equal(mountCalls[0].bytes.length,819200);
    assert.equal(input.value,'');
    assert.equal(refreshCalls.length,1,'toolbox should refresh after a successful mount');
});
