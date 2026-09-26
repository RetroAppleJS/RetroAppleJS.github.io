const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');

function parseRngExpr(expr,opts)
{
    opts=opts||{};
    const n=Number(opts.n||0);
    const base=Number(opts.base||0);
    const normalized=String(expr)
        .replace(/<sub>8\+n<\/sub>/g,(8+n).toString(16).toUpperCase())
        .replace(/<sub>n<\/sub>/g,n.toString(16).toUpperCase());
    const parts=normalized.split('-');
    function hex(s){ return parseInt(s.replace(/^\$/,''),16)-base; }
    return {from:hex(parts[0]),to:hex(parts[1]||parts[0])};
}

function loadDefaultBoot()
{
    const sandbox={
        console:{log(){},warn(){},error(){},assert(){},group(){},groupEnd(){}},
        TextEncoder,
        _DOCS:{},
        oEMUI:{slotConfig(){},slotsRender(){},deviceBtn(){}},
        oEMU:{component:{IO:{}},system:{A2P:{active:true}}},
        EMU_system_get(){ return 'A2P'; },
        oCOM:{
            trim(v){ return String(v).trim(); },
            parseRngExpr,
            crc16(){ return 0x4A4D; },
            getHexWord(v){ return (Number(v)&0xFFFF).toString(16).toUpperCase().padStart(4,'0'); }
        }
    };
    vm.createContext(sandbox);

    for(const file of ['res/COM_CONFIG.js','res/EMU_CARD_applemouse.js','res/EMU_apple2io.js'])
        vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});

    const io=vm.runInContext('new Apple2IO(null,null)',sandbox);
    io.restart();
    return {sandbox,io};
}

test('browser boot loads AppleMouse before Apple2IO',()=>
{
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const mouse=html.indexOf('res/EMU_CARD_applemouse.js');
    const io=html.indexOf('res/EMU_apple2io.js');
    assert.notEqual(mouse,-1,'index.html must load the AppleMouse card');
    assert.ok(mouse<io,'AppleMouse discovery must be registered before Apple2IO boots');
});

test('default Apple II Plus boot mounts AppleMouse in physical slot 4',()=>
{
    const {io}=loadDefaultBoot();
    const internalSlot=5; // RetroAppleJS internal slot index = physical slot + 1.
    const card=io.SLOT2obj(internalSlot);

    assert.ok(card,'slot 4 must contain a mounted peripheral');
    assert.equal(io.slot2ID(internalSlot),4);
    assert.equal(card.id.PCODE,'AMOUSE');
    assert.equal(card.mount.slotN,internalSlot);
    assert.equal(typeof card.action.SlotIO.RD.callback,'function');
    assert.equal(typeof card.action.SlotROM.RD.callback,'function');
    assert.equal(card.getROM().length,0x800);
});
