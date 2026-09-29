'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');
const runtimePath = path.join(ROOT,'res','COM_A2P_LAYOUT.js');
delete require.cache[require.resolve(runtimePath)];
const runtime = require(runtimePath);

function loadProductionComposer()
{
    const source = fs.readFileSync(path.join(ROOT,'res','COM_LAYOUT_CONFIG.js'),'utf8');
    const sandbox = {};
    vm.runInNewContext(source+'\n;this.__composer=composer;',sandbox,{filename:'COM_LAYOUT_CONFIG.js'});
    return JSON.parse(JSON.stringify(sandbox.__composer));
}

function makeFakeDOM()
{
    const all=[];

    function makeNode(tag)
    {
        const attrs=Object.create(null);
        const node={
            tagName:String(tag || '').toUpperCase(),
            id:'',
            style:{},
            dataset:{},
            children:[],
            parentNode:null,
            firstChild:null,
            ownerDocument:null,
            innerHTML:'',
            hidden:false,
            appendChild(child)
            {
                child.parentNode=this;
                this.children.push(child);
                this.firstChild=this.children[0] || null;
                return child;
            },
            insertBefore(child,before)
            {
                child.parentNode=this;
                const index=before ? this.children.indexOf(before) : -1;
                if(index>=0) this.children.splice(index,0,child);
                else this.children.push(child);
                this.firstChild=this.children[0] || null;
                return child;
            },
            removeChild(child)
            {
                const index=this.children.indexOf(child);
                if(index>=0) this.children.splice(index,1);
                child.parentNode=null;
                this.firstChild=this.children[0] || null;
                return child;
            },
            setAttribute(name,value){ attrs[name]=String(value); },
            getAttribute(name){ return Object.prototype.hasOwnProperty.call(attrs,name) ? attrs[name] : null; },
            removeAttribute(name){ delete attrs[name]; }
        };
        all.push(node);
        return node;
    }

    const doc={
        readyState:'complete',
        defaultView:null,
        createElement(tag)
        {
            const node=makeNode(tag);
            node.ownerDocument=doc;
            return node;
        },
        getElementById(id){ return all.find(node=>node.id===id) || null; },
        querySelectorAll(){ return []; }
    };

    const tab=doc.createElement('div'); tab.id='tab1';
    const app=doc.createElement('div'); app.id='app';
    const rootWindow={document:doc,console:{error(){}}};
    doc.defaultView=rootWindow;
    return {rootWindow,doc,tab,app};
}

function isPresented(entry)
{
    return !!entry && entry.element &&
        entry.element.style.visibility!=='hidden' &&
        entry.element.style.opacity!=='0';
}

function modelVisibility(layout,addresses)
{
    const state={};
    for(const address of addresses)
        state[address]=layout.getLayer(address).model.visible;
    return state;
}

function assertSystemPresentationFollowsIntrinsicState(layout)
{
    const system=layout.find({slotN:0});
    assert.ok(system.length>=2,'production layout must retain at least Apple II body and monitor system layers');
    for(const entry of system)
        assert.equal(isPresented(entry),entry.model.visible,entry.address+' system presentation');
}

function extractAssignedFunction(source,marker)
{
    const markerIndex=source.indexOf(marker);
    assert.ok(markerIndex>=0,'missing function marker: '+marker);
    const functionIndex=source.indexOf('function',markerIndex);
    const open=source.indexOf('{',functionIndex);
    assert.ok(functionIndex>=0 && open>=0,'could not locate assigned function body for '+marker);

    let depth=0;
    let quote=null;
    let escaped=false;
    let lineComment=false;
    let blockComment=false;

    for(let i=open;i<source.length;i++)
    {
        const c=source[i];
        const next=source[i+1];

        if(lineComment)
        {
            if(c==='\n') lineComment=false;
            continue;
        }
        if(blockComment)
        {
            if(c==='*' && next==='/') { blockComment=false; i++; }
            continue;
        }
        if(quote)
        {
            if(escaped) { escaped=false; continue; }
            if(c==='\\') { escaped=true; continue; }
            if(c===quote) quote=null;
            continue;
        }
        if(c==='/' && next==='/') { lineComment=true; i++; continue; }
        if(c==='/' && next==='*') { blockComment=true; i++; continue; }
        if(c==='\'' || c==='"' || c==='`') { quote=c; continue; }
        if(c==='{') depth++;
        else if(c==='}')
        {
            depth--;
            if(depth===0)
                return source.slice(functionIndex,i+1);
        }
    }
    throw new Error('unterminated function body for '+marker);
}

test('Peripheral controls switches DISKII -> LIRON -> DISKII presentation without mutating intrinsic device topology state',async()=>{
    const dom=makeFakeDOM();
    dom.rootWindow.composer=loadProductionComposer();
    const layout=new runtime.LAYOUT(dom.rootWindow);
    await layout.install(dom.rootWindow);

    assert.equal(typeof layout.setPeripheralContext,'function','layout must expose a Peripheral-controls context switch');

    layout.visibleAt(7,'DISKII.D1.BODY',true);
    layout.visibleAt(7,'DISKII.D2.BODY',false);
    layout.visibleAt(7,'DISKII.D1.LED',true);
    layout.visibleAt(7,'DISKII.D1.LID',false);

    layout.visibleAt(6,'LIRON.UNIDISK.1.BODY',true);
    layout.visibleAt(6,'LIRON.UNIDISK.2.BODY',true);
    layout.visibleAt(6,'LIRON.HD20.1.BODY',false);
    layout.visibleAt(6,'LIRON.HD20.2.BODY',true);

    const tracked=[
        'A2P.7.DISKII.D1.BODY',
        'A2P.7.DISKII.D2.BODY',
        'A2P.7.DISKII.D1.LED',
        'A2P.7.DISKII.D1.LID',
        'A2P.6.LIRON.UNIDISK.1.BODY',
        'A2P.6.LIRON.UNIDISK.2.BODY',
        'A2P.6.LIRON.HD20.1.BODY',
        'A2P.6.LIRON.HD20.2.BODY'
    ];
    const intrinsicBefore=modelVisibility(layout,tracked);

    layout.setPeripheralContext(7,'DISKII');
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.BODY')),true);
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D2.BODY')),false);
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.LED')),true);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.UNIDISK.1.BODY')),false);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.UNIDISK.2.BODY')),false);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.HD20.2.BODY')),false);
    assertSystemPresentationFollowsIntrinsicState(layout);

    layout.setPeripheralContext(6,'LIRON');
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.BODY')),false);
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.LED')),false);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.UNIDISK.1.BODY')),true);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.UNIDISK.2.BODY')),true);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.HD20.1.BODY')),false);
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.HD20.2.BODY')),true);
    assertSystemPresentationFollowsIntrinsicState(layout);

    assert.deepEqual(modelVisibility(layout,tracked),intrinsicBefore,'context switch must not rewrite attachment/topology visibility state');

    layout.setPeripheralContext(7,'DISKII');
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.BODY')),true,'Disk II state must be restored when returning to its controls');
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D2.BODY')),false,'detached D2 must stay detached after round trip');
    assert.equal(isPresented(layout.getLayer('A2P.7.DISKII.D1.LED')),true,'D1 LED state must survive context round trip');
    assert.equal(isPresented(layout.getLayer('A2P.6.LIRON.UNIDISK.1.BODY')),false);
    assert.deepEqual(modelVisibility(layout,tracked),intrinsicBefore);
});

test('Peripheral-controls slot selection forwards the selected mounted peripheral to the layout context without changing device arrays',()=>{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_apple2io.js'),'utf8');
    const refreshSource=extractAssignedFunction(source,'this.refreshDeviceToolboxes = function');

    const attrs=Object.create(null);
    const box={
        innerHTML:'',
        getAttribute(name){ return name==='data-topology' ? 'stable' : null; },
        setAttribute(){}
    };
    const btn={
        innerHTML:'',
        getAttribute(name){ return Object.prototype.hasOwnProperty.call(attrs,name) ? attrs[name] : null; },
        setAttribute(name,value){ attrs[name]=String(value); }
    };
    const document={
        getElementById(id){ return id==='device_toolbox_body' ? box : id==='devices' ? btn : null; }
    };

    const layoutCalls=[];
    const layout={
        setPeripheralContext(slotN,pcode)
        {
            layoutCalls.push({slotN:Number(slotN),pcode:String(pcode || '')});
            return true;
        }
    };

    const diskiiDevices=[{id:{DCODE:'D1'}}];
    const lironDevices=[
        {id:{DCODE:'UNIDISK'}},
        {id:{DCODE:'UNIDISK'}},
        {id:{DCODE:'HD20'}}
    ];
    const diskii={id:{PCODE:'DISKII'},mount:{slotN:7},devices:diskiiDevices};
    const liron={id:{PCODE:'LIRON'},mount:{slotN:6},devices:lironDevices};
    const shown=[];

    const io={
        deviceSlots(){ return [6,5]; },
        deviceTopologySig(){ return 'stable'; },
        deviceToolSlotHTML(){ return ''; },
        showDeviceTool(slot){ shown.push(slot); },
        deviceLabel(slot){ return String(slot)+'▹'; },
        SLOT2obj(slotN){ return Number(slotN)===7 ? diskii : Number(slotN)===6 ? liron : null; }
    };

    const sandbox={
        document,
        oLAYOUT:layout,
        window:{oLAYOUT:layout},
        slotID2n(slot){ return Number(slot)+1; },
        peripheralPCODE(peripheral){ return peripheral && peripheral.id ? peripheral.id.PCODE : ''; },
        console
    };
    const refresh=vm.runInNewContext('('+refreshSource+')',sandbox,{filename:'refreshDeviceToolboxes.js'});

    refresh.call(io,{id:'devices',default_slot:6});
    refresh.call(io,{id:'devices',default_slot:5});

    assert.deepEqual(shown,[6,5],'Peripheral controls must actually switch tool context');
    assert.deepEqual(layoutCalls,[
        {slotN:7,pcode:'DISKII'},
        {slotN:6,pcode:'LIRON'}
    ],'the same control switch must drive the visual layout context');
    assert.strictEqual(diskii.devices,diskiiDevices,'Disk II attachment array must not be replaced by navigation');
    assert.strictEqual(liron.devices,lironDevices,'LIRON topology array must not be replaced by navigation');
    assert.equal(diskii.devices.length,1);
    assert.equal(liron.devices.length,3);
});
