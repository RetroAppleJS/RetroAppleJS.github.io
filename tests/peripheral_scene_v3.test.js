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
    const source=fs.readFileSync(path.join(ROOT,'res','COM_LAYOUT_CONFIG.js'),'utf8');
    const context={};
    vm.createContext(context);
    vm.runInContext(source+'\n;this.__composer=composer;',context,{filename:'COM_LAYOUT_CONFIG.js'});
    return JSON.parse(JSON.stringify(context.__composer));
}

function makeFakeDOM()
{
    const all=[];
    function makeNode(tag)
    {
        const attrs=Object.create(null);
        const node={
            tagName:String(tag||'').toUpperCase(),id:'',style:{},dataset:{},children:[],
            parentNode:null,firstChild:null,ownerDocument:null,innerHTML:'',hidden:false,
            appendChild(child){child.parentNode=this;this.children.push(child);this.firstChild=this.children[0]||null;return child;},
            insertBefore(child,before){child.parentNode=this;const i=before?this.children.indexOf(before):-1;if(i>=0)this.children.splice(i,0,child);else this.children.push(child);this.firstChild=this.children[0]||null;return child;},
            removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);child.parentNode=null;this.firstChild=this.children[0]||null;return child;},
            setAttribute(name,value){attrs[name]=String(value);},
            getAttribute(name){return Object.prototype.hasOwnProperty.call(attrs,name)?attrs[name]:null;},
            removeAttribute(name){delete attrs[name];}
        };
        all.push(node);return node;
    }
    const doc={
        readyState:'complete',defaultView:null,
        createElement(tag){const node=makeNode(tag);node.ownerDocument=doc;return node;},
        getElementById(id){return all.find(node=>node.id===id)||null;},
        querySelectorAll(){return [];}
    };
    const tab=doc.createElement('div');tab.id='tab1';
    const app=doc.createElement('div');app.id='app';
    const rootWindow={document:doc,console:{error(){}}};
    doc.defaultView=rootWindow;
    return {rootWindow,doc,tab,app};
}

function isPresented(entry)
{
    return !!entry && entry.element && entry.element.style.visibility!=='hidden' && entry.element.style.opacity!=='0';
}

function extractAssignedFunction(source,marker)
{
    const markerIndex=source.indexOf(marker);
    assert.ok(markerIndex>=0,'missing function marker: '+marker);
    const functionIndex=source.indexOf('function',markerIndex);
    const open=source.indexOf('{',functionIndex);
    assert.ok(functionIndex>=0 && open>=0,'could not locate assigned function body for '+marker);
    let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
    for(let i=open;i<source.length;i++)
    {
        const c=source[i],next=source[i+1];
        if(lineComment){if(c==='\n')lineComment=false;continue;}
        if(blockComment){if(c==='*'&&next==='/'){blockComment=false;i++;}continue;}
        if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote=null;continue;}
        if(c==='/'&&next==='/'){lineComment=true;i++;continue;}
        if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
        if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
        if(c==='{')depth++;
        else if(c==='}'&&--depth===0)return source.slice(functionIndex,i+1);
    }
    throw new Error('unterminated function body for '+marker);
}

test('production Composer v3 installs as a slot-agnostic runtime scene and honors LAYOUT metadata',async()=>{
    const composer=loadProductionComposer();
    assert.equal(composer.version,3,'production layout is the Composer v3 authoring document');

    const dom=makeFakeDOM();
    dom.rootWindow.composer=composer;
    const layout=new runtime.LAYOUT(dom.rootWindow);
    assert.equal(await layout.install(dom.rootWindow),true,'runtime must consume the production v3 layout directly');

    const standalone=layout.find({PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STANDALONE'});
    const stacked=layout.find({PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STACKED'});
    assert.equal(standalone.length,1);
    assert.equal(stacked.length,1);

    layout.visibleAt(6,standalone[0].id,true);
    layout.visibleAt(6,stacked[0].id,false);
    layout.setPeripheralContext(6,'LIRON');

    assert.equal(isPresented(standalone[0]),true,'sole HD20 uses the STANDALONE visual');
    assert.equal(isPresented(stacked[0]),false,'STACKED HD20 stays hidden without UniDisk devices');
    for(const entry of layout.find({PCODE:'DISKII'}))
        assert.equal(isPresented(entry),false,'Disk II scene must not bleed through the selected LIRON context');
});

test('Peripheral-controls navigation resynchronizes the selected peripheral before presenting its scene',()=>{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_apple2io.js'),'utf8');
    const refreshSource=extractAssignedFunction(source,'this.refreshDeviceToolboxes = function');

    const attrs=Object.create(null);
    const box={innerHTML:'',getAttribute(name){return name==='data-topology'?'stable':null;},setAttribute(){}};
    const btn={innerHTML:'',getAttribute(name){return Object.prototype.hasOwnProperty.call(attrs,name)?attrs[name]:null;},setAttribute(name,value){attrs[name]=String(value);}};
    const document={getElementById(id){return id==='device_toolbox_body'?box:id==='devices'?btn:null;}};
    const calls=[];
    const layout={setPeripheralContext(slotN,pcode){calls.push(['context',Number(slotN),String(pcode||'')]);return true;}};
    const diskii={id:{PCODE:'DISKII'},mount:{slotN:7},devices:[],syncLayoutVisuals(){calls.push(['visuals','DISKII']);return true;}};
    const liron={id:{PCODE:'LIRON'},mount:{slotN:6},devices:[{id:{DCODE:'HD20'}}],syncLayoutVisuals(){calls.push(['visuals','LIRON']);return true;}};
    const io={
        deviceSlots(){return [6,5];},deviceTopologySig(){return 'stable';},deviceToolSlotHTML(){return '';},
        showDeviceTool(){},deviceLabel(slot){return String(slot)+'▹';},
        SLOT2obj(slotN){return Number(slotN)===7?diskii:Number(slotN)===6?liron:null;},
        syncDeviceLayout(owner){calls.push(['topology',owner.id.PCODE]);return true;}
    };
    const sandbox={document,oLAYOUT:layout,window:{oLAYOUT:layout},slotID2n(slot){return Number(slot)+1;},peripheralPCODE(p){return p&&p.id?p.id.PCODE:'';},console};
    const refresh=vm.runInNewContext('('+refreshSource+')',sandbox,{filename:'refreshDeviceToolboxes.js'});

    refresh.call(io,{id:'devices',default_slot:5});

    assert.deepEqual(calls,[
        ['topology','LIRON'],
        ['visuals','LIRON'],
        ['context',6,'LIRON']
    ],'navigation must derive the scene from the selected live peripheral and its attached devices');
});

test('LIRON scene synchronization resolves STANDALONE and STACKED HD20 bodies from metadata, not hard-coded visual IDs',()=>{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_smartport_topology.js'),'utf8');
    const calls=[];
    const entries=[
        {id:'CUSTOM.HD20.STANDALONE',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STANDALONE'}},
        {id:'CUSTOM.HD20.STACKED',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STACKED'}},
        {id:'CUSTOM.UNIDISK.1',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'}},
        {id:'CUSTOM.UNIDISK.2',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'}}
    ];
    const fakeWindow={
        oLAYOUT:{
            find(query){return entries.filter(entry=>Object.keys(query).every(key=>entry.labels[key]===query[key]));},
            visibleAt(slotN,id,state){calls.push({slotN,id,state:!!state});return true;}
        },
        setInterval(){return null;},clearInterval(){},addEventListener(){}
    };
    const sandbox={window:fakeWindow,module:{exports:{}},exports:{},console};
    vm.runInNewContext(source,sandbox,{filename:'EMU_CARD_smartport_topology.js'});
    const api=sandbox.module.exports;
    const hd20={id:{DCODE:'HD20',deviceN:1},getUnit(){return 1;},attach:{hash:1}};
    const owner=api.decorateLironTopology({id:{PCODE:'LIRON'},mount:{slotN:6},devices:[hd20]});

    assert.equal(typeof owner.syncLayoutVisuals,'function','LIRON exposes a standard navigation-time scene sync hook');
    assert.deepEqual(calls.map(call=>[call.id,call.state]),[
        ['CUSTOM.UNIDISK.1',false],
        ['CUSTOM.UNIDISK.2',false],
        ['CUSTOM.HD20.STANDALONE',true],
        ['CUSTOM.HD20.STACKED',false]
    ]);
});

test('Disk II LED and lid status updates qualify the layout write with the live mounted slot',()=>{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_appledisk2.js'),'utf8');
    const ledSource=extractAssignedFunction(source,'this.setDriveLED = function');
    const lidSource=extractAssignedFunction(source,'this.setDriveLidClosed = function');
    const calls=[];
    const sandbox={
        driveLayout(deviceN){
            return {
                LED(on,slotN){calls.push(['LED',deviceN,on,slotN]);},
                LID(closed,slotN){calls.push(['LID',deviceN,closed,slotN]);}
            };
        }
    };
    const led=vm.runInNewContext('('+ledSource+')',sandbox,{filename:'setDriveLED.js'});
    const lid=vm.runInNewContext('('+lidSource+')',sandbox,{filename:'setDriveLidClosed.js'});
    const owner={mount:{slotN:7}};

    led.call(owner,0,true);
    lid.call(owner,1,true);

    assert.deepEqual(calls,[
        ['LED',0,true,7],
        ['LID',1,true,7]
    ]);
});
