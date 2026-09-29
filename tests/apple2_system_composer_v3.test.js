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
