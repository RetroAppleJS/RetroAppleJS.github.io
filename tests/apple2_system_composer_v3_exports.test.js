'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const repoRoot = path.join(__dirname,'..');
const composerPath = path.join(repoRoot,'tools','GUI_DEV','apple2-system-composer.html');
const migrationFixturePath = path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js');
const runtimePath = path.join(repoRoot,'res','COM_A2P_LAYOUT.js');
const html = fs.readFileSync(composerPath,'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
assert.notEqual(scriptStart,-1,'Composer must contain an inline script');
assert.notEqual(scriptEnd,-1,'Composer inline script must be terminated');
const source = html.slice(scriptStart + '<script>'.length,scriptEnd);
const runtimeSource = fs.readFileSync(runtimePath,'utf8');

function extractStatement(pattern,label)
{
    const match = source.match(pattern);
    assert.ok(match,`Composer must define ${label}`);
    return match[0];
}

function extractFunction(name)
{
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.notEqual(start,-1,`Composer must define ${name}()`);
    const paramsStart = source.indexOf('(',start);
    let paramsEnd=-1,parenDepth=0,quote=null,escaped=false;
    for(let i=paramsStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote)
        {
            if(escaped) escaped=false;
            else if(ch==='\\') escaped=true;
            else if(ch===quote) quote=null;
            continue;
        }
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='(') parenDepth++;
        else if(ch===')' && --parenDepth===0){paramsEnd=i;break;}
    }
    assert.notEqual(paramsEnd,-1,`${name}() must have a complete parameter list`);
    const bodyStart=source.indexOf('{',paramsEnd+1);
    assert.notEqual(bodyStart,-1,`${name}() must have a function body`);
    let depth=0;quote=null;escaped=false;
    for(let i=bodyStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote)
        {
            if(escaped) escaped=false;
            else if(ch==='\\') escaped=true;
            else if(ch===quote) quote=null;
            continue;
        }
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='{') depth++;
        else if(ch==='}' && --depth===0) return source.slice(start,i+1);
    }
    assert.fail(`Could not extract ${name}()`);
}

function plain(value){ return JSON.parse(JSON.stringify(value)); }

function loadMigrationFixture()
{
    const context={};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(migrationFixturePath,'utf8'),context,{filename:'COM_LAYOUT_CONFIG.js'});
    return plain(context.composer);
}

function loadExportCore()
{
    const context=vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
    context.__state={layers:[],configurations:[],activeConfigurationId:null,assets:new Map()};
    const core=[
        "'use strict';",
        extractStatement(/const\s+CANVAS_W\s*=\s*1144\s*,\s*CANVAS_H\s*=\s*1144\s*,\s*LAYOUT_VERSION\s*=\s*\d+\s*;/,'Composer canvas/version constants'),
        extractStatement(/const\s+DEFAULT_SHADOW\s*=\s*Object\.freeze\([^;]+\);/,'DEFAULT_SHADOW'),
        extractFunction('validateShadow'),
        extractFunction('validateAssets'),
        extractFunction('validateSemanticId'),
        extractFunction('validateLabels'),
        extractFunction('validateConfigurations'),
        extractFunction('normalizeComposerDocument'),
        extractFunction('validateLayout'),
        'const state=globalThis.__state;',
        extractFunction('serializeLayer'),
        extractFunction('serializeLayout'),
        extractFunction('findCachedAsset'),
        extractFunction('serializeEmbeddedLayout'),
        extractFunction('getActiveConfiguration'),
        extractFunction('isLayerVisibleInActiveView'),
        'globalThis.__api={state,normalizeComposerDocument,validateLayout,serializeLayout,serializeEmbeddedLayout,isLayerVisibleInActiveView};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'composer-v3-final-export-core.js'});
    return context.__api;
}

const expectedIds=[
    'SYSTEM.MONITOR','SYSTEM.TAPE','DISKII.D2.LED','DISKII.D1.LED',
    'DISKII.D2.LID','DISKII.D1.LID','DISKII.D2.BODY','DISKII.D1.BODY',
    'DISKII.GAP','LIRON.HD20.1.BODY','LIRON.UNIDISK.1.BODY',
    'LIRON.UNIDISK.2.BODY','LIRON.HD20.2.BODY','SYSTEM.CHASSIS'
];

test('slot-agnostic 14-layer migration fixture normalizes to stable Composer v3 authoring data',()=>{
    const api=loadExportCore();
    const input=loadMigrationFixture();
    const output=plain(api.validateLayout(input));

    assert.equal(output.version,3);
    assert.deepEqual(output.layers.map(layer=>layer.id),expectedIds);
    assert.deepEqual(output.configurations,[]);

    assert.equal(output.layers.length,input.layers.length);
    for(let i=0;i<input.layers.length;i++)
    {
        const before=input.layers[i],after=output.layers[i];
        assert.equal(Object.hasOwn(after,'slotN'),false,after.id+' must remain slot-agnostic');
        assert.equal(Object.hasOwn(after.labels,'UNIT'),false,after.id+' must not serialize UNIT');
        const expectedLabels={};
        for(const [key,value] of Object.entries(before.labels||{})) if(key.toUpperCase()!=='UNIT') expectedLabels[key.toUpperCase()]=value;
        assert.deepEqual(after.labels,expectedLabels,after.id+' metadata');
        assert.equal(after.file,before.file,after.id+' filename');
        assert.equal(after.x,before.x,after.id+' x');
        assert.equal(after.y,before.y,after.id+' y');
        assert.equal(after.visible,before.visible,after.id+' base visibility');
        assert.deepEqual(after.shadow,before.shadow,after.id+' shadow');
    }
});

test('embedded v3 export deduplicates referenced assets by filename and keeps configurations',()=>{
    const api=loadExportCore();
    const normalized=plain(api.validateLayout(loadMigrationFixture()));
    api.state.layers=normalized.layers;
    api.state.configurations=[];
    const uniqueFiles=[...new Set(normalized.layers.map(layer=>layer.file))];
    for(const file of uniqueFiles) api.state.assets.set(file,{file,dataUrl:'data:image/png;base64,'+Buffer.from(file).toString('base64')});

    const embedded=plain(api.serializeEmbeddedLayout());
    assert.equal(embedded.version,3);
    assert.deepEqual(embedded.configurations,[]);
    assert.deepEqual(Object.keys(embedded.assets).sort(),uniqueFiles.slice().sort());
    assert.equal(Object.keys(embedded.assets).length,uniqueFiles.length);
});

test('JavaScript export uses var composer = and the embedded v3 serializer',()=>{
    const exportSource=extractFunction('exportJS');
    assert.match(exportSource,/var composer =/);
    assert.match(exportSource,/serializeEmbeddedLayout\s*\(/);
    assert.match(exportSource,/COM_LAYOUT_CONFIG\.js/);
});

test('active configuration changes PNG visibility without rewriting serialized base visibility',()=>{
    const api=loadExportCore();
    const layer={id:'A',labels:{ROLE:'BODY'},file:'a.png',x:1,y:2,visible:true,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75}};
    api.state.layers=[layer];
    api.state.configurations=[{id:'hide-a',title:'Hide A',visible:[]}];
    api.state.activeConfigurationId='hide-a';

    assert.equal(api.isLayerVisibleInActiveView(layer),false,'active named configuration must control displayed/PNG visibility');
    assert.equal(plain(api.serializeLayout()).layers[0].visible,true,'serialized layer keeps Base visibility');
    assert.match(extractFunction('drawLayer'),/isLayerVisibleInActiveView/,'PNG composition path must use active-view visibility');
    assert.match(extractFunction('buildExportCanvas'),/drawLayer/,'PNG export canvas must render through the active-view draw path');
});

test('Composer v3 authoring has no runtime-address controls/helpers while runtime v2 remains slot-qualified',()=>{
    for(const helper of ['validateSlotN','layoutAddress','runtimeAddressForLayer','addressInUse'])
        assert.doesNotMatch(source,new RegExp('function\\s+'+helper+'\\s*\\('),helper+' must not exist in Composer v3');
    assert.doesNotMatch(html,/id="slotNInput"/);
    assert.doesNotMatch(html,/id="runtimeAddressInput"/);

    assert.match(runtimeSource,/visibleAt\s*=\s*function\s*\(slotN\s*,\s*id\s*,\s*state\s*\)/,'runtime must retain mounted-slot visibility API');
    assert.match(runtimeSource,/address\s*=\s*function\s*\(slotN\s*,\s*id\s*\)/,'runtime must retain slot-qualified address API');
    assert.match(runtimeSource,/return\s+"A2P\."\s*\+\s*slotN\s*\+\s*"\."\s*\+\s*id\s*;/,'runtime address format must stay slot-qualified');
});
