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

function shadow(enabled=false)
{
    return {enabled,offsetX:0,offsetY:15,blur:12,opacity:0.75};
}

function makeLayer(id,file,visible,x)
{
    return {
        uid:`uid-${id}`,
        id,
        idMode:'custom',
        labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'},
        file,
        x,
        y:460,
        visible,
        shadow:shadow(true),
        image:{tag:file},
        width:291,
        height:188,
        resolved:true
    };
}

function loadUnloadCore()
{
    const revoked = [];
    const context = vm.createContext({
        console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error,
        URL:{revokeObjectURL:url=>revoked.push(url)}
    });
    context.__state = {layers:[],configurations:[],activeConfigurationId:null,assets:new Map()};
    context.__refreshCount = 0;
    context.__renderCount = 0;
    const core = [
        "'use strict';",
        extractStatement(/const\s+CANVAS_W\s*=\s*1144\s*,\s*CANVAS_H\s*=\s*1144\s*,\s*LAYOUT_VERSION\s*=\s*\d+\s*;/,'Composer canvas/version constants'),
        'const state=globalThis.__state;',
        'function refreshUI(){globalThis.__refreshCount++;}',
        'function renderPreview(){globalThis.__renderCount++;}',
        extractFunction('serializeLayer'),
        extractFunction('serializeLayout'),
        extractFunction('findCachedAsset'),
        extractFunction('getActiveConfiguration'),
        extractFunction('isLayerVisibleInActiveView'),
        extractFunction('getEmbeddedExportBlockers'),
        extractFunction('getExportBlockers'),
        extractFunction('unloadImages'),
        'globalThis.__api={state,serializeLayout,getEmbeddedExportBlockers,getExportBlockers,unloadImages};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-unload-core.js'});
    return {api:context.__api,revoked,context};
}

test('Composer exposes an Unload Images toolbar command wired to unloadImages()',()=>{
    assert.match(html,/id="unloadImagesBtn"[^>]*>Unload Images<\/button>/,'Unload Images toolbar button must exist');
    assert.match(source,/\$\('unloadImagesBtn'\)\.addEventListener\('click',\s*unloadImages\)/,'Unload Images button must invoke unloadImages()');
});

test('unloadImages releases image content while preserving the complete serializable design',()=>{
    const {api,revoked,context} = loadUnloadCore();
    const left = makeLayer('LIRON.UNIDISK.1.BODY','left.png',true,170);
    const right = makeLayer('LIRON.UNIDISK.2.BODY','right.png',false,463);
    api.state.layers = [left,right];
    api.state.configurations = [{id:'right-only',title:'Right only',visible:['LIRON.UNIDISK.2.BODY']}];
    api.state.activeConfigurationId = 'right-only';
    api.state.assets.set('left.png',{file:'left.png',objectUrl:'blob:left',dataUrl:'data:image/png;base64,AAAA',image:left.image,width:291,height:188});
    api.state.assets.set('right.png',{file:'right.png',objectUrl:'blob:right',dataUrl:'data:image/png;base64,BBBB',image:right.image,width:291,height:188});

    const before = plain(api.serializeLayout());
    api.unloadImages();
    const after = plain(api.serializeLayout());

    assert.deepEqual(after,before,'unloading image bytes must not mutate serializable authoring state');
    assert.deepEqual(revoked.sort(),['blob:left','blob:right']);
    assert.equal(api.state.assets.size,0);
    assert.equal(api.state.activeConfigurationId,'right-only','active simulation remains selected');
    for(const layer of api.state.layers)
    {
        assert.equal(layer.image,null);
        assert.equal(layer.width,0);
        assert.equal(layer.height,0);
        assert.equal(layer.resolved,false);
    }
    assert.equal(context.__refreshCount,1,'UI refreshes once after unloading');
    assert.equal(context.__renderCount,1,'canvas refreshes once after unloading');
});

test('unloaded images block embedded exports but layout-only JSON remains serializable',()=>{
    const {api} = loadUnloadCore();
    api.state.layers = [
        makeLayer('A','a.png',true,10),
        makeLayer('B','b.png',false,20)
    ];
    api.state.configurations = [];
    api.state.assets.set('a.png',{file:'a.png',dataUrl:'data:image/png;base64,AAAA'});
    api.state.assets.set('b.png',{file:'b.png',dataUrl:'data:image/png;base64,BBBB'});

    assert.deepEqual(plain(api.getEmbeddedExportBlockers()),[]);
    api.unloadImages();
    assert.deepEqual(plain(api.getEmbeddedExportBlockers()),['a.png','b.png']);
    const layout = plain(api.serializeLayout());
    assert.equal(layout.version,3);
    assert.deepEqual(layout.layers.map(layer=>layer.file),['a.png','b.png']);
});

test('PNG blockers after unload include only unresolved layers visible in the active view',()=>{
    const {api} = loadUnloadCore();
    api.state.layers = [
        makeLayer('A','a.png',true,10),
        makeLayer('B','b.png',false,20),
        makeLayer('C','c.png',false,30)
    ];
    api.state.configurations = [{id:'b-only',title:'B only',visible:['B']}];
    api.state.activeConfigurationId = 'b-only';
    api.state.assets.set('a.png',{file:'a.png',dataUrl:'data:image/png;base64,AAAA'});
    api.state.assets.set('b.png',{file:'b.png',dataUrl:'data:image/png;base64,BBBB'});
    api.state.assets.set('c.png',{file:'c.png',dataUrl:'data:image/png;base64,CCCC'});

    api.unloadImages();
    assert.deepEqual(plain(api.getExportBlockers()),['b.png']);
    api.state.activeConfigurationId = null;
    assert.deepEqual(plain(api.getExportBlockers()),['a.png']);
});

test('Unload Images is intentionally outside document undo history',()=>{
    const unload = extractFunction('unloadImages');
    assert.doesNotMatch(unload,/commitHistory|captureHistorySnapshot|undoStack|redoStack/,'unload must not create or retain a history snapshot');
});
