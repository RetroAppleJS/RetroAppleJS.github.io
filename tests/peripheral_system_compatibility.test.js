'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');
const ioSource = fs.readFileSync(path.join(root,'res/EMU_apple2io.js'),'utf8');
const mainSource = fs.readFileSync(path.join(root,'res/EMU_apple2main.js'),'utf8');
const configSource = fs.readFileSync(path.join(root,'res/COM_CONFIG.js'),'utf8');
const configDoc = fs.readFileSync(path.join(root,'docs/CONFIG.md'),'utf8');
const updater = fs.readFileSync(path.join(root,'tools/ConfigFile_updater.html'),'utf8');
const config = vm.runInNewContext(configSource +
    '\n;({PSLOT:_CFG_PSLOT,SYSCODE:_CFG_SYSCODE,IORANGES:_CFG_IORANGES})');

function fixture(system='A2P', query='', dom=null)
{
    const warnings = [];
    const emu = {
        component:{IO:{}},
        system:{IORANGES:{
            HostIO:'$C000-$C07F',SlotIO:'$C080-$C0FF',
            SlotROM:'$C100-$C7FF',HostROM:'$C800-$CFFF'
        }}
    };
    const com = {
        URL:{uri:query ? {slots:query} : {}},
        trim:value=>String(value).trim(),
        parseRngExpr:()=>({from:0xC000,to:0xC07F}),
        crc16:()=>42
    };
    const context=vm.createContext({
        oEMU:emu,oEMUI:{},oCOM:com,
        _CFG_PSLOT:config.PSLOT,_CFG_SYSCODE:config.SYSCODE,
        _CFG_IORANGES:config.IORANGES,EMU_system_get:()=>system,
        console:{warn:value=>warnings.push(value),assert(){},log(){},error(){}},
        document:dom,
        TextEncoder
    });
    vm.runInContext(ioSource,context,{filename:'EMU_apple2io.js'});
    const io = new context.Apple2IO(null,null);
    return {io,context,emu,warnings};
}

function fakeCard(PCODE)
{
    return {PCODE,ctor:function Peripheral(){ this.id={PCODE}; }};
}

function documentFixture()
{
    const created = [];
    const body={children:[],appendChild(el){this.children.push(el);el.parent=this;}};
    const document={
        body,
        createElement(tag)
        {
            const el={
                tagName:tag,children:[],style:{},attributes:{},events:{},
                appendChild(child){this.children.push(child);child.parent=this;},
                setAttribute(key,value){this.attributes[key]=value;},
                addEventListener(key,fn){this.events[key]=fn;},
                remove(){this.removed=true;},
                showModal(){this.opened=true;},
                close(){if(this.events.close)this.events.close();},
                focus(){this.focused=true;}
            };
            created.push(el);
            return el;
        }
    };
    return {document,body,created};
}

test('obsolete PCODE/SLOT metadata is removed from both master and generated config',()=>{
    assert.doesNotMatch(configDoc,/\[PCODE\]|\[SLOT#\]/);
    assert.doesNotMatch(configSource,/\bconst _CFG_PCODE\s*=|\bconst _CFG_SLOT\s*=/);
    assert.ok(configDoc.includes('|[PSLOT]'));
    assert.ok(config.PSLOT.MOCK.SYScode);
    assert.ok(config.PSLOT.MOCK.SLOTrange);
    assert.ok(config.PSLOT.MOCK.SlotROM);
});

test('config updater no longer requires missing legacy tables or their row injector',()=>{
    assert.doesNotMatch(updater,/process_table\(\["\[PCODE\]"|process_table\(\["\[SLOT#\]"/);
    assert.doesNotMatch(updater,/this\.LData\[FIELDdata\]/);
    assert.match(updater,/process_table\(\["\[PSLOT\]"/);
});

test('SYScode compatibility uses exact case-insensitive matches and legacy br tags',()=>{
    const {context}=fixture();
    const supports=context.EMU_peripheralSupportsSystem;
    assert.equal(supports(config.PSLOT.MOCK,'A2P'),true);
    assert.equal(supports(config.PSLOT.MOCK,'A2e'),true);
    assert.equal(supports(config.PSLOT.MOCK,'A2GS'),false);
    assert.equal(supports({SYScode:'A2,<br>A2P, A2e'},'A2P'),true);
    assert.equal(supports({SYScode:''},'A2P'),false);
    assert.equal(supports(null,'A2P'),false);
});

test('central mount rejects incompatible system without creating a card or mapping actions',()=>{
    const {io,warnings}=fixture('A2GS');
    let constructed=0;
    const noCard={
        PCODE:'MOCK',
        ctor:function Card(){ constructed++;this.id={PCODE:'MOCK'}; }
    };
    const result=io.mount(config.PSLOT.MOCK,noCard,5,['MOCK']);
    assert.equal(result.pObj,null);
    assert.equal(constructed,0);
    assert.equal(io.getMountWarnings().length,1);
    assert.match(io.getMountWarnings()[0],/MOCK.*slot 4.*A2GS.*A2,A2P,A2e/);
    assert.equal(warnings.length,1);
});

test('central mount also rejects incompatible slot even on supported system',()=>{
    const {io}=fixture('A2P');
    const result=io.mount(config.PSLOT.VIDEX,fakeCard('VIDEX'),6,['VIDEX']);
    assert.equal(result.pObj,null);
    assert.match(io.getMountWarnings()[0],/VIDEX.*slot 5.*incompatible slot/);
});

test('normal mount succeeds without legacy _CFG_PCODE or _CFG_SLOT',()=>{
    const {io}=fixture('A2P');
    const result=io.mount(config.PSLOT.MOCK,fakeCard('MOCK'),5,['MOCK']);
    assert.equal(result.pObj.id.PCODE,'MOCK');
    assert.equal(result.pObj.mount.slotN,5);
    assert.equal(io.getMountWarnings().length,0);
});

test('incompatible URL overrides are discarded before evicting configured cards',()=>{
    const {context,io}=fixture('A2GS');
    const map={slotMap:{7:['DISKII']},slotFit:{7:['DISKII','MOCK']}};
    const discovered={MOCK:{PCODE:'MOCK'},DISKII:{PCODE:'DISKII'}};
    const result=context.EMU_applyURLSlotOverrides(
        map,'6:MOCK',config.PSLOT,[1,2,3,4,5,6,7],discovered,'A2GS');
    assert.equal(result.applied.length,0);
    assert.deepEqual(JSON.parse(JSON.stringify(map.slotMap)),{7:['DISKII']});
    assert.equal(result.warnings.length,1);
    assert.match(result.warnings[0],/A2GS/);
    assert.equal(io.getMountWarnings().length,0);
});

test('multiple mount conflicts render one accessible dismissible dialog',()=>{
    const dom=documentFixture();
    const {io}=fixture('A2GS','',dom.document);
    io.mount(config.PSLOT.MOCK,fakeCard('MOCK'),5,['MOCK']);
    io.mount(config.PSLOT.DISKII,fakeCard('DISKII'),7,['DISKII']);
    // A second attempt to install the same incompatible card is only one warning.
    io.mount(config.PSLOT.MOCK,fakeCard('MOCK'),5,['MOCK']);
    assert.equal(io.getMountWarnings().length,2);
    assert.equal(io.showStartupMountWarnings(),true);
    assert.equal(dom.body.children.length,1);
    const dialog=dom.body.children[0];
    assert.equal(dialog.tagName,'dialog');
    assert.equal(dialog.opened,true);
    const list=dialog.children.find(el=>el.tagName==='ul');
    assert.equal(list.children.length,2);
    assert.match(list.children[0].textContent,/MOCK/);
    assert.match(list.children[1].textContent,/DISKII/);
    assert.equal(dialog.children[3].textContent,'Acknowledge');
    const cancel={preventDefault(){this.prevented=true;}};
    dialog.events.cancel(cancel);
    assert.equal(cancel.prevented,true);
    dialog.children[3].events.click();
    assert.equal(dialog.removed,true);
    assert.equal(io.showStartupMountWarnings(),false);
    assert.equal(dom.body.children.length,1); // removed DOM node remains in test fixture array
});

test('startup displays warnings after initial Apple II restart',()=>{
    const boot=mainSource.indexOf('apple2plus.restart(); // restart the AppleII+');
    const popup=mainSource.indexOf('io.showStartupMountWarnings()',boot);
    assert.ok(boot>=0 && popup>boot);
});
