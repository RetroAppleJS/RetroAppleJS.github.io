'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.join(__dirname,'..');
const runtimePath = path.join(repoRoot,'res','COM_A2P_LAYOUT.js');
const configPath = path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js');
const runtimeSource = fs.readFileSync(runtimePath,'utf8');

delete require.cache[require.resolve(runtimePath)];
const runtime = require(runtimePath);

function loadComposerConfig()
{
    const context = {};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(configPath,'utf8'),context,{filename:'COM_LAYOUT_CONFIG.js'});
    return JSON.parse(JSON.stringify(context.composer));
}

function makeDiskOwner(slotN)
{
    return {
        id:{PCODE:'DISKII'},
        mount:{slotN},
        deviceConfig:[
            {DCODE:'D1',description:'Disk II drive 1'},
            {DCODE:'D2',description:'Disk II drive 2'}
        ],
        devices:[
            {id:{DCODE:'D1'}},
            {id:{DCODE:'D2'}}
        ]
    };
}

function loadBrowserPolicy(owner)
{
    const io = {
        slots:new Array(8),
        SLOT2obj(slotIndex){ return slotIndex===owner.mount.slotN-1 ? owner : null; },
        attach(){ return true; },
        detach(){ return true; }
    };
    const rootWindow = {
        console:{error(){}},
        oEMU:{component:{IO:{AppleDisk2:owner}}},
        apple2plus:{hwObj(){ return {io}; }},
        addEventListener(){},
        setInterval(){ throw new Error('policy install unexpectedly fell back to polling'); },
        clearInterval(){}
    };
    const context = {
        window:rootWindow,
        console:rootWindow.console,
        setTimeout(fn){ fn(); },
        Number,
        Object,
        Array,
        String,
        Boolean,
        Math,
        Promise,
        Map
    };
    vm.createContext(context);
    vm.runInContext(runtimeSource,context,{filename:'COM_A2P_LAYOUT.js'});
    return {rootWindow,io};
}

test('production COM_LAYOUT_CONFIG.js is v2 and Disk II visuals live in the slot-qualified namespace',()=>{
    const composer = loadComposerConfig();
    assert.equal(composer.version,2);

    const diskLayers = composer.layers.filter(layer=>layer.labels && layer.labels.PCODE==='DISKII');
    assert.ok(diskLayers.length>=7,'expected the Disk II body/LED/lid/gap layers in the live dataset');
    for(const layer of diskLayers)
    {
        assert.equal(layer.slotN,7);
        assert.match(layer.id,/^DISKII\./);
        assert.doesNotMatch(layer.id,/^A2P\./);
    }
});

test('Disk II visual facade resolves semantic IDs through the mounted slot with visibleAt()',()=>{
    const rootWindow={oEMU:{component:{IO:{AppleDisk2:{mount:{slotN:6}}}}}};
    const layout=new runtime.LAYOUT(rootWindow);
    const calls=[];

    layout.visibleAt=function(slotN,id,state)
    {
        calls.push([slotN,id,state]);
        return !!state;
    };
    layout.visible=function(id)
    {
        throw new Error('legacy unqualified visible() call: '+id);
    };

    layout.A2P.DISKII.GAP(true);
    layout.A2P.DISKII.D1.BODY(true);
    layout.A2P.DISKII.D1.LED(true);
    layout.A2P.DISKII.D1.LID(false);
    layout.A2P.DISKII.D2.BODY(true);
    layout.A2P.DISKII.D2.LED(false);
    layout.A2P.DISKII.D2.LID(true);

    assert.deepEqual(calls,[
        [6,'DISKII.GAP',true],
        [6,'DISKII.D1.BODY',true],
        [6,'DISKII.D1.LED',true],
        [6,'DISKII.D1.LID',false],
        [6,'DISKII.D2.BODY',true],
        [6,'DISKII.D2.LED',false],
        [6,'DISKII.D2.LID',true]
    ]);
});

test('Disk II attachment policy stores slot-aware semantic targets and syncs them with visibleAt()',()=>{
    const owner=makeDiskOwner(7);
    const {rootWindow,io}=loadBrowserPolicy(owner);

    for(const info of owner.deviceConfig)
    {
        assert.ok(info.layout);
        for(const mode of ['attached','detached'])
        {
            for(const target of info.layout[mode])
            {
                assert.equal(target.slotN,7);
                assert.match(target.id,new RegExp('^DISKII\\.'+info.DCODE+'\\.'));
                assert.doesNotMatch(target.id,/^A2P\./);
            }
        }
    }

    const gapRule=owner.layoutRules.find(rule=>rule.id==='DISKII.GAP.BOTH_DRIVES');
    assert.ok(gapRule);
    const attachedGap=JSON.parse(JSON.stringify(gapRule.attached.map(target=>({slotN:target.slotN,id:target.id,visible:target.visible}))));
    const detachedGap=JSON.parse(JSON.stringify(gapRule.detached.map(target=>({slotN:target.slotN,id:target.id,visible:target.visible}))));
    assert.deepEqual(attachedGap,[{slotN:7,id:'DISKII.GAP',visible:true}]);
    assert.deepEqual(detachedGap,[{slotN:7,id:'DISKII.GAP',visible:false}]);

    const calls=[];
    rootWindow.oLAYOUT={
        visibleAt(slotN,id,state){ calls.push([slotN,id,state]); return true; },
        visible(id){ throw new Error('legacy unqualified visible() call: '+id); },
        visibleByFile(){ return false; }
    };

    assert.equal(io.syncDeviceLayout(owner),true);
    assert.deepEqual(calls,[
        [7,'DISKII.D1.BODY',true],
        [7,'DISKII.D1.LED',false],
        [7,'DISKII.D1.LID',false],
        [7,'DISKII.D2.BODY',true],
        [7,'DISKII.D2.LED',false],
        [7,'DISKII.D2.LID',false],
        [7,'DISKII.GAP',true]
    ]);
});

test('runtime call-site section contains no flat A2P.DISKII visual IDs outside the v1 compatibility normalizer',()=>{
    const runtimeCallsites=runtimeSource.slice(runtimeSource.indexOf('function LAYOUT(rootWindow)'));
    const legacyIds=runtimeCallsites.match(/A2P\.DISKII\.(?:D[12]\.(?:BODY|LED|LID)|GAP)/g) || [];
    assert.deepEqual(legacyIds,[]);
});
