'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

function fakeRoot()
{
    const byId=new Map();

    class Element {
        constructor(tag,doc){
            this.tagName=tag;
            this.ownerDocument=doc;
            this.style={};
            this.dataset={};
            this.children=[];
            this.parentNode=null;
            this._id='';
            this.src='';
            this.alt='';
            this.draggable=false;
            this.offsetHeight=1;
        }
        set id(value){ this._id=String(value); if(this._id) byId.set(this._id,this); }
        get id(){ return this._id; }
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; }
        insertBefore(child,before){
            child.parentNode=this;
            const i=this.children.indexOf(before);
            if(i<0)this.children.push(child); else this.children.splice(i,0,child);
            return child;
        }
        removeChild(child){
            const i=this.children.indexOf(child);
            if(i>=0)this.children.splice(i,1);
            child.parentNode=null;
            if(child.id)byId.delete(child.id);
            return child;
        }
        get firstChild(){ return this.children[0]||null; }
    }

    const root={console,composer:{
        version:3,
        canvas:{width:1144,height:1144},
        layers:[{
            id:'DISKII.D1.LED',
            labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'LED'},
            file:'led.png',x:0,y:0,visible:false
        }],
        assets:{}
    }};
    const doc={
        readyState:'loading',
        defaultView:root,
        createElement(tag){ return new Element(tag,doc); },
        getElementById(id){ return byId.get(id)||null; }
    };
    root.document=doc;
    root.requestAnimationFrame=fn=>{ fn(); return 1; };
    root.setTimeout=setTimeout;
    root.clearTimeout=clearTimeout;
    root.setInterval=setInterval;
    root.clearInterval=clearInterval;
    root.addEventListener=()=>{};

    const tab=new Element('div',doc); tab.id='tab1'; byId.set('tab1',tab);
    const app=new Element('div',doc); app.id='app'; byId.set('app',app);
    return root;
}

function newLayout(root)
{
    const exported=require(path.join(__dirname,'../res/COM_A2P_LAYOUT.js'));
    return new exported.LAYOUT(root);
}

test('runtime visibility uses the new intrinsic state before peripheral presentation filtering', async()=>{
    const root=fakeRoot();
    const layout=newLayout(root);
    assert.equal(await layout.install(root),true);
    layout.setPeripheralContext(7,'DISKII');

    const entry=layout.getLayer('A2P.SCENE.DISKII.D1.LED');
    assert.ok(entry);
    assert.equal(entry.element.style.visibility,'hidden');

    assert.equal(layout.visibleAt(7,'DISKII.D1.LED',true),true);
    assert.equal(entry.model.visible,true);
    assert.equal(entry.element.style.visibility,'visible');
    assert.equal(entry.element.style.opacity,'1');

    assert.equal(layout.visibleAt(7,'DISKII.D1.LED',false),false);
    assert.equal(entry.model.visible,false);
    assert.equal(entry.element.style.visibility,'hidden');
    assert.equal(entry.element.style.opacity,'0');
});

test('pending LED visibility applied before layout installation uses the requested state', async()=>{
    const root=fakeRoot();
    const layout=newLayout(root);
    layout.setPeripheralContext(7,'DISKII');

    assert.equal(layout.visibleAt(7,'DISKII.D1.LED',true),true);
    assert.equal(await layout.install(root),true);

    const entry=layout.getLayer('A2P.SCENE.DISKII.D1.LED');
    assert.ok(entry);
    assert.equal(entry.model.visible,true);
    assert.equal(entry.element.style.visibility,'visible');
});
