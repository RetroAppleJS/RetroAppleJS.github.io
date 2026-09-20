const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ioSource = fs.readFileSync('res/EMU_apple2io.js','utf8');
const lironSource = fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const unidiskSource = fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');

test('peripheral detail UI exposes add-device picker and clickable device labels', () => {
    assert.match(ioSource,/devicePicker_popup\s*=\s*function/,
        'Apple2IO must expose a device picker for the selected peripheral');
    assert.match(ioSource,/devicePicker_select\s*=\s*function/,
        'Apple2IO must expose device selection/attachment');
    assert.match(ioSource,/slotDeviceTable_html[\s\S]*fa fa-plus/,
        'the Device table must have the same plus pictogram used by SLOTS');
    assert.match(ioSource,/slotDeviceLabel_html[\s\S]*deviceConfig_detail/,
        'attached device labels must open the device detail popup');
});

test('device picker makes host context and availability state explicit', () => {
    assert.match(ioSource,/devicePickerAnchorID\s*\(/,
        'the plus button must have a stable picker anchor identity');
    assert.match(ioSource,/aria-label=['"]Attach device['"]/,
        'the plus pictogram needs an accessible attach-device label');
    assert.match(ioSource,/ADD DEVICE TO/,
        'the picker title must name the target peripheral');
    assert.match(ioSource,/Available/,
        'unattached compatible devices must be visibly marked Available');
    assert.match(ioSource,/Attached/,
        'already attached devices must have a visible Attached state');
});

test('available device row is the attach target and attach failures stay in the picker', () => {
    assert.match(ioSource,/device-picker-entry[\s\S]*devicePicker_select/,
        'the whole device choice row must invoke the generic attach flow');
    assert.match(ioSource,/devicePicker_message/,
        'attach errors need an in-picker status message instead of silent failure');
    assert.match(ioSource,/Could not attach device/,
        'the picker must explain a failed attach attempt');
    assert.match(ioSource,/this\.deviceConfig_close\(\);[\s\S]*this\.slotConfig_refresh\(slotN\)/,
        'successful attach must close the picker and refresh the still-open peripheral detail');
});

test('device detail popup supports metadata download, eject and close', () => {
    assert.match(ioSource,/deviceConfig_detail\s*=\s*function/);
    assert.match(ioSource,/deviceConfig_download\s*=\s*function/);
    assert.match(ioSource,/deviceConfig_eject\s*=\s*function/);
    assert.match(ioSource,/deviceConfig_popup/,
        'device details must use an independent popup so the peripheral popup remains visible');
    assert.match(ioSource,/fa fa-cloud-download-alt/,
        'device metadata download uses the established download pictogram');
    assert.match(ioSource,/fa fa-eject/,
        'device detach uses the established eject pictogram');
});

test('device metadata export is structured and excludes function-valued implementation state', () => {
    assert.match(ioSource,/deviceMetadata\s*=\s*function/,
        'Apple2IO must expose a structured metadata projection');
    assert.match(ioSource,/"hostPCODE"/);
    assert.match(ioSource,/"config"/);
    assert.match(ioSource,/"attachment"/);
    assert.match(ioSource,/"ports"/);
});

function loadLironPair()
{
    const context = vm.createContext({
        console:{log(){},warn(){},error(){}},
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
    context.oEMU={component:{IO:{}}};
    vm.runInContext(unidiskSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(lironSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('ejecting a UniDisk releases the Liron SmartPort host and permits reattachment', () => {
    const context=loadLironPair();
    const card=new context.AppleLiron();
    const first=new context.UniDisk35Device(card.deviceConfig[0]);

    assert.equal(first.bindHost(card),true);
    assert.equal(card.getUniDisk(),first);
    assert.equal(typeof first.unbindHost,'function');
    assert.equal(typeof card.detachUniDisk,'function');
    assert.equal(first.unbindHost(card),true);
    assert.equal(card.getUniDisk(),null);

    const second=new context.UniDisk35Device(card.deviceConfig[0]);
    assert.equal(second.bindHost(card),true,
        'a UI-detached UniDisk must leave the host reusable');
    assert.equal(card.getUniDisk(),second);
});
