'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const composerPath = path.join(__dirname,'..','tools','GUI_DEV','apple2-system-composer.html');
const html = fs.readFileSync(composerPath,'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
assert.notEqual(scriptStart,-1,'Composer must contain an inline script');
assert.notEqual(scriptEnd,-1,'Composer inline script must be terminated');
const source = html.slice(scriptStart + '<script>'.length,scriptEnd);

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
    let paramsEnd = -1;
    let parenDepth = 0;
    let quote = null;
    let escaped = false;
    for(let i=paramsStart;i<source.length;i++)
    {
        const ch = source[i];
        if(quote)
        {
            if(escaped) escaped = false;
            else if(ch==='\\') escaped = true;
            else if(ch===quote) quote = null;
            continue;
        }
        if(ch==='"' || ch==="'" || ch==='`') { quote=ch; continue; }
        if(ch==='(') parenDepth++;
        else if(ch===')')
        {
            parenDepth--;
            if(parenDepth===0) { paramsEnd=i; break; }
        }
    }
    assert.notEqual(paramsEnd,-1,`${name}() must have a complete parameter list`);

    const bodyStart = source.indexOf('{',paramsEnd+1);
    assert.notEqual(bodyStart,-1,`${name}() must have a function body`);

    let depth = 0;
    quote = null;
    escaped = false;
    for(let i=bodyStart;i<source.length;i++)
    {
        const ch = source[i];
        if(quote)
        {
            if(escaped) escaped = false;
            else if(ch==='\\') escaped = true;
            else if(ch===quote) quote = null;
            continue;
        }
        if(ch==='"' || ch==="'" || ch==='`') { quote=ch; continue; }
        if(ch==='{') depth++;
        else if(ch==='}')
        {
            depth--;
            if(depth===0) return source.slice(start,i+1);
        }
    }
    assert.fail(`Could not extract ${name}()`);
}

function plain(value)
{
    return JSON.parse(JSON.stringify(value));
}

function loadCore()
{
    const context = vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
    context.__state = {layers:[],configurations:[]};
    const core = [
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
        'globalThis.__api={normalizeComposerDocument,validateLayout,validateSemanticId,validateLabels,serializeLayer,serializeLayout,state};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-core.js'});
    return context.__api;
}

function loadAuthoringCore()
{
    const context = vm.createContext({console,Object,Array,Number,String,Boolean,Math,JSON,Error});
    const core = [
        "'use strict';",
        extractFunction('validateSemanticId'),
        extractFunction('canonicalSuggestionSegment'),
        extractFunction('suggestSemanticId'),
        extractFunction('syncSuggestedSemanticId'),
        extractFunction('setLayerSemanticId'),
        extractFunction('setLayerLabel'),
        extractFunction('resetSemanticIdToSuggested'),
        extractFunction('serializeLayer'),
        'globalThis.__api={suggestSemanticId,syncSuggestedSemanticId,setLayerSemanticId,setLayerLabel,resetSemanticIdToSuggested,serializeLayer};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-authoring-core.js'});
    return context.__api;
}

function loadConfigurationCore()
{
    const context = vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
    context.__state = {layers:[],configurations:[],activeConfigurationId:null};
    const core = [
        "'use strict';",
        extractFunction('validateSemanticId'),
        'const state=globalThis.__state;',
        extractFunction('semanticIdInUse'),
        extractFunction('validateConfigurations'),
        extractFunction('getActiveConfiguration'),
        extractFunction('isLayerVisibleInActiveView'),
        extractFunction('setLayerVisibleInActiveView'),
        extractFunction('makeConfigurationId'),
        extractFunction('visibleIdsForActiveView'),
        extractFunction('createConfiguration'),
        extractFunction('renameConfiguration'),
        extractFunction('deleteConfiguration'),
        extractFunction('selectConfiguration'),
        extractFunction('replaceSemanticIdInConfigurations'),
        extractFunction('renameLayerSemanticId'),
        'globalThis.__api={state,validateConfigurations,getActiveConfiguration,isLayerVisibleInActiveView,setLayerVisibleInActiveView,createConfiguration,renameConfiguration,deleteConfiguration,selectConfiguration,replaceSemanticIdInConfigurations,renameLayerSemanticId};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-config-core.js'});
    return context.__api;
}

function loadConfigurationValidationCore()
{
    const context = vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
    const core = [
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
        'globalThis.__api={validateConfigurations,validateLayout};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-config-validation.js'});
    return context.__api;
}

function shadow()
{
    return {enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75};
}

function v3Layer(overrides={})
{
    return Object.assign({
        id:'LIRON.UNIDISK.1.BODY',
        labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'},
        file:'A2P_UNIDISK_left.png',
        x:170,
        y:460,
        visible:true,
        shadow:shadow()
    },overrides);
}

function v2Layer(overrides={})
{
    return Object.assign(v3Layer(),{
        slotN:6,
        labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}
    },overrides);
}

function v2Document(layers=[v2Layer()])
{
    return {
        version:2,
        canvas:{width:1144,height:1144},
        assets:{'A2P_UNIDISK_left.png':'data:image/png;base64,AAAA'},
        layers
    };
}

function v3Document(layers=[v3Layer()])
{
    return {version:3,canvas:{width:1144,height:1144},layers,configurations:[]};
}

test('Composer serialization writes slot-agnostic version 3 and never serializes UNIT',()=>{
    const api = loadCore();
    api.state.layers = [v3Layer({labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}})];
    api.state.configurations = [];
    const serialized = plain(api.serializeLayout());

    assert.equal(serialized.version,3);
    assert.equal('slotN' in serialized.layers[0],false);
    assert.equal(serialized.layers[0].labels.UNIT,undefined);
    assert.equal(serialized.layers[0].id,'LIRON.UNIDISK.1.BODY');
    assert.deepEqual(serialized.configurations,[]);
});

test('current v2 documents normalize to v3 without slotN or UNIT while preserving authoring data',()=>{
    const api = loadCore();
    const normalized = plain(api.normalizeComposerDocument(v2Document()));
    const layer = normalized.layers[0];

    assert.equal(normalized.version,3);
    assert.equal('slotN' in layer,false);
    assert.deepEqual(layer.labels,{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'});
    assert.equal(layer.id,'LIRON.UNIDISK.1.BODY');
    assert.equal(layer.file,'A2P_UNIDISK_left.png');
    assert.equal(layer.x,170);
    assert.equal(layer.y,460);
    assert.equal(layer.visible,true);
    assert.deepEqual(layer.shadow,shadow());
    assert.equal(normalized.assets['A2P_UNIDISK_left.png'],'data:image/png;base64,AAAA');
    assert.deepEqual(normalized.configurations,[]);
});

test('v3 semantic IDs are globally unique',()=>{
    const api = loadCore();
    assert.throws(()=>api.validateLayout(v3Document([
        v3Layer({file:'left.png'}),
        v3Layer({file:'right.png'})
    ])),/duplicate.*LIRON\.UNIDISK\.1\.BODY/i);
});

test('unsupported Composer document versions reject with an actionable error',()=>{
    const api = loadCore();
    assert.throws(()=>api.normalizeComposerDocument({version:99,canvas:{width:1144,height:1144},layers:[]}),/unsupported.*version/i);
});

test('v3 labels canonicalize keys, preserve values, and exclude UNIT',()=>{
    const api = loadCore();
    const result = plain(api.validateLayout(v3Document([
        v3Layer({labels:{pcode:'LIRON',dcode:'UNIDISK',role:'BODY',Side:'left'}})
    ])));
    assert.deepEqual(result.layers[0].labels,{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY',SIDE:'left'});

    assert.throws(()=>api.validateLayout(v3Document([
        v3Layer({labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}})
    ])),/UNIT/i);
});

test('newly imported images use explicit semantic metadata without slot assignment',()=>{
    const addLayer = extractFunction('addLayerFromAsset');
    assert.doesNotMatch(addLayer,/\bslotN\b/,'new image layers must not receive a slot namespace');
    assert.match(addLayer,/labels\s*:\s*\{\s*\}/,'new image layers must start with an empty labels object');
    assert.match(addLayer,/id\s*:\s*makeDefaultSemanticId\s*\(/,'new image layers must receive an explicit semantic id');

    const defaultId = extractFunction('makeDefaultSemanticId');
    assert.match(defaultId,/SYSTEM\./,'default semantic ids must live under the SYSTEM semantic namespace');
});

test('semantic ID suggestions use PCODE, DCODE and ROLE without slot context',()=>{
    const api = loadAuthoringCore();

    assert.equal(api.suggestSemanticId({labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'}}),'DISKII.D2.LED');
    assert.equal(api.suggestSemanticId({labels:{PCODE:'DISKII',ROLE:'GAP'}}),'DISKII.GAP');
    assert.equal(api.suggestSemanticId({labels:{ROLE:'MONITOR'}}),'SYSTEM.MONITOR');
});

test('manual semantic ID override survives label edits until reset to suggestion',()=>{
    const api = loadAuthoringCore();
    const l = v3Layer({idMode:'auto'});

    api.setLayerSemanticId(l,'LIRON.UNIDISK.1.FRONT');
    assert.equal(l.idMode,'custom');
    assert.equal(l.id,'LIRON.UNIDISK.1.FRONT');

    api.setLayerLabel(l,'ROLE','panel');
    assert.equal(l.labels.ROLE,'panel');
    assert.equal(l.id,'LIRON.UNIDISK.1.FRONT','custom id must not be overwritten by metadata edits');

    api.resetSemanticIdToSuggested(l);
    assert.equal(l.idMode,'auto');
    assert.equal(l.id,'LIRON.UNIDISK.PANEL');
});

test('Composer v3 serialization omits authoring idMode and runtime-only fields',()=>{
    const api = loadAuthoringCore();
    const out = plain(api.serializeLayer(v3Layer({idMode:'custom',slotN:6})));
    assert.equal(Object.hasOwn(out,'idMode'),false);
    assert.equal(Object.hasOwn(out,'slotN'),false);
    assert.equal(Object.hasOwn(out,'address'),false);
});

test('Composer selected-layer UI exposes semantic metadata but no slot or runtime address controls',()=>{
    assert.match(html,/id="semanticIdInput"/,'Semantic ID input must exist');
    assert.doesNotMatch(html,/id="slotNInput"/,'SlotN input must be removed');
    assert.doesNotMatch(html,/id="runtimeAddressInput"/,'Runtime address input must be removed');
    assert.match(html,/id="labelsEditor"/,'Metadata label editor must exist');
    assert.match(html,/id="addLabelBtn"/,'Add label control must exist');
    assert.match(html,/id="resetSuggestedIdBtn"/,'Reset-to-suggested control must exist');
});

test('Composer layer list and status display semantic IDs instead of runtime addresses',()=>{
    const refresh = extractFunction('refreshUI');
    assert.doesNotMatch(refresh,/runtimeAddressForLayer/,'runtime address helper must not drive Composer UI');
    assert.match(refresh,/l\.id/,'layer rows must display the semantic id');
    assert.match(refresh,/s\.id/,'selected-layer status must display the semantic id');
});

test('Base view uses layer.visible while named configurations use their explicit visible semantic IDs',()=>{
    const api = loadConfigurationCore();
    const a = v3Layer({id:'A',visible:true});
    const b = v3Layer({id:'B',visible:false});
    api.state.layers = [a,b];
    api.state.configurations = [{id:'only-b',title:'Only B',visible:['B']}];

    api.selectConfiguration(null);
    assert.equal(api.isLayerVisibleInActiveView(a),true);
    assert.equal(api.isLayerVisibleInActiveView(b),false);

    api.selectConfiguration('only-b');
    assert.equal(api.isLayerVisibleInActiveView(a),false);
    assert.equal(api.isLayerVisibleInActiveView(b),true);
    api.setLayerVisibleInActiveView(a,true);
    api.setLayerVisibleInActiveView(b,false);
    assert.deepEqual(plain(api.state.configurations[0].visible),['A']);
    assert.equal(a.visible,true,'named-view edits must not mutate base visibility');
    assert.equal(b.visible,false,'named-view edits must not mutate base visibility');
});

test('configuration CRUD validates titles, keeps IDs unique, and selection returns to Base after deleting the active configuration',()=>{
    const api = loadConfigurationCore();
    api.state.layers = [v3Layer({id:'A',visible:true}),v3Layer({id:'B',visible:false})];

    assert.throws(()=>api.createConfiguration('   '),/title/i);
    const first = api.createConfiguration('My View');
    const second = api.createConfiguration('My View');
    assert.notEqual(first.id,second.id,'configuration IDs must remain unique');
    assert.deepEqual(plain(first.visible),['A'],'a new configuration starts from the currently displayed Base visibility');

    api.selectConfiguration(first.id);
    api.renameConfiguration(first.id,'Renamed View');
    assert.equal(first.title,'Renamed View');
    assert.throws(()=>api.renameConfiguration(first.id,''),/title/i);
    assert.equal(first.title,'Renamed View','failed rename must leave the title unchanged');
    assert.throws(()=>api.selectConfiguration('missing'),/configuration/i);

    api.deleteConfiguration(first.id);
    assert.equal(api.state.activeConfigurationId,null);
    assert.equal(api.state.configurations.some(c=>c.id===first.id),false);
});

test('configuration validation rejects duplicate IDs, blank titles, and unknown layer references',()=>{
    const api = loadConfigurationValidationCore();
    const ids = new Set(['A','B']);

    assert.throws(()=>api.validateConfigurations([
        {id:'same',title:'One',visible:['A']},
        {id:'same',title:'Two',visible:['B']}
    ],ids),/duplicate.*configuration/i);
    assert.throws(()=>api.validateConfigurations([{id:'blank',title:'   ',visible:['A']}],ids),/title/i);
    assert.throws(()=>api.validateConfigurations([{id:'bad-ref',title:'Bad ref',visible:['MISSING']}],ids),/unknown.*MISSING/i);
});

test('semantic-ID rename updates every configuration reference atomically',()=>{
    const api = loadConfigurationCore();
    const a = v3Layer({id:'A',idMode:'custom'});
    const b = v3Layer({id:'B',idMode:'custom'});
    api.state.layers = [a,b];
    api.state.configurations = [
        {id:'one',title:'One',visible:['A']},
        {id:'two',title:'Two',visible:['B','A']}
    ];

    api.renameLayerSemanticId(a,'A.NEW');
    assert.equal(a.id,'A.NEW');
    assert.deepEqual(plain(api.state.configurations[0].visible),['A.NEW']);
    assert.deepEqual(plain(api.state.configurations[1].visible),['B','A.NEW']);

    const before = plain({layers:api.state.layers.map(l=>l.id),configurations:api.state.configurations});
    assert.throws(()=>api.renameLayerSemanticId(a,'B'),/already used/i);
    assert.deepEqual(plain({layers:api.state.layers.map(l=>l.id),configurations:api.state.configurations}),before,'duplicate rename must leave the document unchanged');
});

test('v3 validation and serialization preserve named configurations across reload',()=>{
    const validation = loadConfigurationValidationCore();
    const doc = v3Document([
        v3Layer({id:'A',file:'a.png'}),
        v3Layer({id:'B',file:'b.png',visible:false})
    ]);
    doc.configurations = [{id:'only-b',title:'Only B',visible:['B']}];
    const validated = plain(validation.validateLayout(doc));
    assert.deepEqual(validated.configurations,[{id:'only-b',title:'Only B',visible:['B']}]);

    const serialization = loadCore();
    serialization.state.layers = validated.layers;
    serialization.state.configurations = validated.configurations;
    const serialized = plain(serialization.serializeLayout());
    const reloaded = plain(validation.validateLayout(serialized));
    assert.deepEqual(reloaded.configurations,validated.configurations);
});

test('configuration selector UI exposes Base, add, rename and delete controls',()=>{
    assert.match(html,/id="configurationBar"/,'configuration strip must exist above the canvas');
    assert.match(html,/id="baseConfigurationBtn"/,'Base control must exist');
    assert.match(html,/id="addConfigurationBtn"/,'configuration add control must exist');
    assert.match(html,/id="renameConfigurationBtn"/,'configuration rename control must exist');
    assert.match(html,/id="deleteConfigurationBtn"/,'configuration delete control must exist');
});

test('active configuration visibility drives hit testing, rendering, layer checkboxes and PNG blocker detection',()=>{
    assert.match(extractFunction('hitTest'),/isLayerVisibleInActiveView/);
    assert.match(extractFunction('drawLayer'),/isLayerVisibleInActiveView/);
    assert.match(extractFunction('renderPreview'),/isLayerVisibleInActiveView/);
    assert.match(extractFunction('refreshUI'),/isLayerVisibleInActiveView/);
    assert.match(extractFunction('getExportBlockers'),/isLayerVisibleInActiveView/);
});


test('Composer toolbar exposes Undo and Redo controls for the history task',()=>{
    assert.match(html,/id=\"undoBtn\"/,'Undo button must exist');
    assert.match(html,/id=\"redoBtn\"/,'Redo button must exist');
    assert.match(html,/id=\"undoBtn\"[^>]*disabled/,'Undo stays disabled until history is available');
    assert.match(html,/id=\"redoBtn\"[^>]*disabled/,'Redo stays disabled until history is available');
});
