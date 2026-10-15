'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'res/EMU_apple2io.js'),'utf8');
const css=fs.readFileSync(path.join(root,'res/COM_MAIN.css'),'utf8');
const markdown=fs.readFileSync(path.join(root,'docs/CONFIG.md'),'utf8');
const source=fs.readFileSync(path.join(root,'res/COM_CONFIG.js'),'utf8');
const config=vm.runInNewContext(source+
    '\n;({PSLOT:_CFG_PSLOT,SYSCODE:_CFG_SYSCODE,IORANGES:_CFG_IORANGES})');

function setup(options={})
{
    const cardMetadata=JSON.parse(JSON.stringify(config.PSLOT));
    if(options.range!==undefined) cardMetadata.DITHER2.SLOTrange=options.range;

    function Card()
    {
        this.id={PCODE:'DITHER2',icon:'fa fa-camera'};
    }
    function OtherCard()
    {
        this.id={PCODE:'DITHER',icon:'fa fa-camera'};
    }
    const emu={
        component:{IO:{Dithertizer2:new Card(),Dithertizer:new OtherCard()}},
        system:{IORANGES:{
            HostIO:'$C000-$C07F',SlotIO:'$C080-$C0FF',
            SlotROM:'$C100-$C7FF',HostROM:'$C800-$CFFF'
        }}
    };
    const elements={
        slotConfig_popup:{innerHTML:''},
        d_slot_peripheral_slots_PR_7:{style:''},
        d_slot_peripheral_slots_PR_6:{style:''}
    };
    const context=vm.createContext({
        oEMU:emu,oEMUI:{},
        oCOM:{
            URL:{uri:{}},
            trim:s=>String(s).trim(),
            escapeHTML:s=>String(s),
            parseRngExpr:()=>({from:0xC000,to:0xC07F}),
            crc16:()=>42,
            POPUP:{get_state:()=>true,toggle:()=>{}}
        },
        _CFG_PSLOT:cardMetadata,_CFG_SYSCODE:config.SYSCODE,
        _CFG_IORANGES:config.IORANGES,EMU_system_get:()=>'A2P',
        console:{assert(value,msg){assert.ok(value,msg)},warn(){},log(){},error(){}},
        document:{getElementById:id=>elements[id]},
        TextEncoder
    });
    vm.runInContext(code,context,{filename:'EMU_apple2io.js'});
    const io=new context.Apple2IO(null,null);
    io.slots=Array.from({length:9},(_,index)=>({
        slotTitle:index===0?'board':'PR#'+(index-1),
        lock:false
    }));
    io.slot_ctx.peripheral_slots={slots:io.slots};
    context.apple2plus={hwObj:()=>({io})};
    return {io,context,elements,metadata:cardMetadata};
}

function labelOf(html,pcode)
{
    // The label is a div and contains exactly the plus, icon and PCODE.
    const labels=[...html.matchAll(/<div class='appbut label[^']*'[^>]*>[\s\S]*?<\/div>/g)];
    return labels.map(match=>match[0]).find(tag=>tag.includes('&nbsp;'+pcode+'</div>'))||'';
}

test('DITHER2 default preferred marker lives in canonical source and compiled data',()=>{
    assert.equal(config.PSLOT.DITHER2.SLOTrange,'1,2,3,4,5,6,7$');
    assert.match(markdown,/\|\s*DITHER2\s*\|[^\n]*\b7\$\s*\|/);
    assert.match(markdown,/\\\$\s*=\s*preferred/);
});

test('$ declares compatible/preferred but does not install the peripheral',()=>{
    const {io}=setup();
    // The slot 7 card was not auto-created by the advisory '$' marker.
    assert.equal(io.slots[8].peripheral,undefined);
    // But it remains mountable through the central mount() path.
    const info=io.scanPeripheralContainers().DITHER2;
    const mounted=io.mount(config.PSLOT.DITHER2,info,8,['DITHER2']);
    assert.ok(mounted.pObj);
    assert.equal(mounted.pObj.id.PCODE,'DITHER2');
});

test('Add Peripheral in preferred slot reverses the entire DITHER2 label',()=>{
    const {io,elements}=setup();
    io.slotPicker_popup({hostId:'peripheral_slots'},'PR#7');
    const html=elements.slotConfig_popup.innerHTML;
    const dither2=labelOf(html,'DITHER2');
    const dither=labelOf(html,'DITHER');
    assert.match(dither2,/class='appbut label peripheral-preferred'/);
    assert.match(dither2,/title='[^']*preferred PR#7'/);
    assert.match(dither2,/fa fa-plus/);
    assert.match(dither2,/fa fa-camera/);
    assert.doesNotMatch(dither,/peripheral-preferred/);
    assert.match(css,/\.appbut\.label\.peripheral-preferred\s*\{[^}]*background:\s*#181818;[^}]*color:\s*#fff;/);
    assert.match(css,/\.appbut\.label\.peripheral-preferred \.appbut\.skinny\s*\{/);
});

test('Add Peripheral for other compatible slots uses ordinary label',()=>{
    const {io,elements}=setup();
    io.slotPicker_popup({hostId:'peripheral_slots'},'PR#6');
    const dither2=labelOf(elements.slotConfig_popup.innerHTML,'DITHER2');
    assert.ok(dither2);
    assert.doesNotMatch(dither2,/peripheral-preferred/);
    assert.doesNotMatch(dither2,/disabled/);
});

test('pre-install * and preferred $ create separate independent slot plans',()=>{
    // Run the actual slot-ref parser, extracted without modifying its source.
    const start=code.indexOf('function parseSlotRangeEntry(');
    const end=code.indexOf('this.slot2ID = function(',start);
    assert.ok(start>=0 && end>start);
    const parse=vm.runInNewContext('(function(){'+code.slice(start,end)+
        '\nreturn extract_slotRef;})()',{console});

    const preferredOnly=parse('1,2,3,4,5,6,7

test('a disabled card remains disabled even when its slot is preferred',()=>{
    const {io,elements}=setup();
    io.slots[8].peripheral={id:{PCODE:'OTHER'}};
    io.slotPicker_popup({hostId:'peripheral_slots'},'PR#7');
    assert.match(labelOf(elements.slotConfig_popup.innerHTML,'DITHER2'),
        /class='appbut label peripheral-preferred greyed'/);
});
,'DITHER2',{});
    assert.ok(preferredOnly.slotFit[8].includes('DITHER2'));
    assert.deepEqual(Object.keys(preferredOnly.slotMap),[]);
    assert.deepEqual(Array.from(preferredOnly.slotPreferred[8]),['DITHER2']);
    assert.equal(preferredOnly.slotPreferred[7],undefined);

    const preinstalled=parse('6*','DISKII',{});
    assert.deepEqual(Array.from(preinstalled.slotMap[7]),['DISKII']);
    assert.equal(preinstalled.slotPreferred[7],undefined);

    const combined=parse('6*$,7$*','MOCK',{});
    assert.deepEqual(Array.from(combined.slotMap[7]),['MOCK']);
    assert.deepEqual(Array.from(combined.slotMap[8]),['MOCK']);
    assert.deepEqual(Array.from(combined.slotPreferred[7]),['MOCK']);
    assert.deepEqual(Array.from(combined.slotPreferred[8]),['MOCK']);
});

test('a disabled card remains disabled even when its slot is preferred',()=>{
    const {io,elements}=setup();
    io.slots[8].peripheral={id:{PCODE:'OTHER'}};
    io.slotPicker_popup({hostId:'peripheral_slots'},'PR#7');
    assert.match(labelOf(elements.slotConfig_popup.innerHTML,'DITHER2'),
        /class='appbut label peripheral-preferred greyed'/);
});
