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
    const bodyStart = source.indexOf('{',start);
    assert.notEqual(bodyStart,-1,`${name}() must have a function body`);

    let depth = 0;
    let quote = null;
    let escaped = false;
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
    context.__state = {layers:[]};
    const core = [
        "'use strict';",
        extractStatement(/const\s+CANVAS_W\s*=\s*1144\s*,\s*CANVAS_H\s*=\s*1144\s*,\s*LAYOUT_VERSION\s*=\s*\d+\s*;/,'Composer canvas/version constants'),
        extractStatement(/const\s+DEFAULT_SHADOW\s*=\s*Object\.freeze\([^;]+\);/,'DEFAULT_SHADOW'),
        extractFunction('validateShadow'),
        extractFunction('validateAssets'),
        extractFunction('validateSemanticId'),
        extractFunction('validateSlotN'),
        extractFunction('validateLabels'),
        extractFunction('layoutAddress'),
        extractFunction('validateLayout'),
        'const state=globalThis.__state;',
        extractFunction('serializeLayer'),
        extractFunction('serializeLayout'),
        'globalThis.__api={validateLayout,validateSemanticId,validateSlotN,validateLabels,layoutAddress,serializeLayer,serializeLayout,state};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-core.js'});
    return context.__api;
}

function shadow()
{
    return {enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75};
}

function layer(overrides={})
{
    return Object.assign({
        id:'DISKII.D2.LED',
        slotN:7,
        labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'},
        file:'A2P_DISKII_D2_LED.png',
        x:12,
        y:34,
        visible:false,
        shadow:shadow()
    },overrides);
}

function layout(layers)
{
    return {version:2,canvas:{width:1144,height:1144},layers};
}

test('Composer structured serialization is version 2 and carries id, slotN and labels',()=>{
    const api = loadCore();
    api.state.layers = [layer()];
    const result = plain(api.serializeLayout());

    assert.equal(result.version,2);
    assert.equal(result.layers[0].id,'DISKII.D2.LED');
    assert.equal(result.layers[0].slotN,7);
    assert.deepEqual(result.layers[0].labels,{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'});
});

test('Composer v2 validates slot 0 through slot 8 and allows the same semantic id in different slots',()=>{
    const api = loadCore();
    const result = plain(api.validateLayout(layout([
        layer({id:'SYSTEM.MONITOR',slotN:0,labels:{ROLE:'MONITOR'},file:'monitor.png'}),
        layer({slotN:7,file:'led-slot7.png'}),
        layer({slotN:8,file:'led-slot8.png'})
    ])));

    assert.deepEqual(result.layers.map(l=>l.slotN),[0,7,8]);
    assert.equal(api.layoutAddress(7,'DISKII.D2.LED'),'A2P.7.DISKII.D2.LED');
    assert.equal(api.layoutAddress(8,'DISKII.D2.LED'),'A2P.8.DISKII.D2.LED');
});

test('Composer v2 rejects duplicate qualified runtime addresses',()=>{
    const api = loadCore();
    assert.throws(()=>api.validateLayout(layout([
        layer({file:'one.png'}),
        layer({file:'two.png'})
    ])),/duplicate.*A2P\.7\.DISKII\.D2\.LED/i);
});

test('Composer v2 requires valid semantic ids and valid slot namespaces',()=>{
    const api = loadCore();

    for(const badId of ['', 'DISKII D2 LED', 'DISKII/D2/LED', 'DISKII:D2:LED'])
        assert.throws(()=>api.validateLayout(layout([layer({id:badId})])),/id/i,`id ${JSON.stringify(badId)} must be rejected`);

    for(const badSlot of [-1,9,1.5,'7',null])
        assert.throws(()=>api.validateLayout(layout([layer({slotN:badSlot})])),/slot/i,`slot ${JSON.stringify(badSlot)} must be rejected`);
});

test('Composer v2 canonicalizes label keys while preserving custom label values',()=>{
    const api = loadCore();
    const result = plain(api.validateLayout(layout([
        layer({labels:{pcode:'DISKII',dcode:'D2',role:'LED',Side:'right',Variant:'active'}})
    ])));

    assert.deepEqual(result.layers[0].labels,{
        PCODE:'DISKII',DCODE:'D2',ROLE:'LED',SIDE:'right',VARIANT:'active'
    });

    assert.throws(()=>api.validateLayout(layout([
        layer({labels:{pcode:'DISKII',PCODE:'OTHER'}})
    ])),/duplicate.*PCODE/i);
});

test('newly imported images start in the system namespace with explicit v2 metadata',()=>{
    const addLayer = extractFunction('addLayerFromAsset');
    assert.match(addLayer,/slotN\s*:\s*0/,'new image layers must start in slotN 0');
    assert.match(addLayer,/labels\s*:\s*\{\s*\}/,'new image layers must start with an empty labels object');
    assert.match(addLayer,/id\s*:\s*makeDefaultSemanticId\s*\(/,'new image layers must receive an explicit system-safe semantic id');

    const defaultId = extractFunction('makeDefaultSemanticId');
    assert.match(defaultId,/SYSTEM\./,'default semantic ids must live under the SYSTEM semantic namespace');
});
