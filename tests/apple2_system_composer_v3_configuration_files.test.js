'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const composerPath=path.join(__dirname,'..','tools','GUI_DEV','apple2-system-composer.html');
const html=fs.readFileSync(composerPath,'utf8');
const scriptStart=html.indexOf('<script>');
const scriptEnd=html.lastIndexOf('</script>');
assert.notEqual(scriptStart,-1,'Composer must contain an inline script');
assert.notEqual(scriptEnd,-1,'Composer inline script must be terminated');
const source=html.slice(scriptStart+'<script>'.length,scriptEnd);

function extractFunction(name)
{
    const marker=`function ${name}(`;
    const start=source.indexOf(marker);
    assert.notEqual(start,-1,`Composer must define ${name}()`);
    const paramsStart=source.indexOf('(',start);
    let paramsEnd=-1,depth=0,quote=null,escaped=false;
    for(let i=paramsStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='(')depth++;else if(ch===')'&&--depth===0){paramsEnd=i;break;}
    }
    assert.notEqual(paramsEnd,-1,`${name}() must have a complete parameter list`);
    const bodyStart=source.indexOf('{',paramsEnd+1);
    assert.notEqual(bodyStart,-1,`${name}() must have a body`);
    depth=0;quote=null;escaped=false;
    for(let i=bodyStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    }
    assert.fail(`Could not extract ${name}()`);
}

function extractStatement(pattern,label)
{
    const match=source.match(pattern);
    assert.ok(match,`Composer must define ${label}`);
    return match[0];
}

function plain(value){return JSON.parse(JSON.stringify(value));}

function loadConfigurationFileCore()
{
    const context=vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
    context.__state={
        layers:[
            {id:'SYSTEM.MONITOR',visible:true},
            {id:'LIRON.UNIDISK.1.BODY',visible:true},
            {id:'LIRON.HD20.2.BODY',visible:false}
        ],
        configurations:[],
        activeConfigurationId:null
    };
    const core=[
        "'use strict';",
        extractStatement(/const\s+CONFIGURATION_FILE_TYPE\s*=\s*['\"][^'\"]+['\"]\s*,\s*CONFIGURATION_FILE_VERSION\s*=\s*\d+\s*;/,'standalone configuration file constants'),
        'const state=globalThis.__state;',
        extractFunction('validateConfigurations'),
        extractFunction('getActiveConfiguration'),
        extractFunction('makeConfigurationId'),
        extractFunction('serializeStandaloneConfiguration'),
        extractFunction('validateStandaloneConfiguration'),
        extractFunction('importStandaloneConfiguration'),
        extractFunction('duplicateConfiguration'),
        'globalThis.__api={state,serializeStandaloneConfiguration,validateStandaloneConfiguration,importStandaloneConfiguration,duplicateConfiguration};'
    ].join('\n');
    vm.runInContext(core,context,{filename:'apple2-system-composer-v3-configuration-files.js'});
    return context.__api;
}

function standalone(overrides={})
{
    return Object.assign({
        type:'apple2-system-composer-configuration',
        version:1,
        id:'liron-hd20-two-unidisk',
        title:'HD20 + 2 UniDisk',
        visible:['SYSTEM.MONITOR','LIRON.UNIDISK.1.BODY','LIRON.HD20.2.BODY']
    },overrides);
}

test('configuration toolbar exposes import, export and duplicate controls plus a hidden JSON input',()=>{
    for(const id of ['importConfigurationBtn','exportConfigurationBtn','duplicateConfigurationBtn','configurationInput'])
        assert.match(html,new RegExp(`id=["']${id}["']`),`missing ${id}`);
    assert.match(html,/configurationInput[^>]+type=["']file["'][^>]+accept=["'][^"']*\.json/i);
});

test('standalone export contains only the independent configuration-file contract',()=>{
    const api=loadConfigurationFileCore();
    api.state.configurations=[{id:'liron-hd20-two-unidisk',title:'HD20 + 2 UniDisk',visible:['SYSTEM.MONITOR','LIRON.UNIDISK.1.BODY']}];
    api.state.activeConfigurationId='liron-hd20-two-unidisk';
    const exported=plain(api.serializeStandaloneConfiguration());
    assert.deepEqual(exported,{
        type:'apple2-system-composer-configuration',version:1,id:'liron-hd20-two-unidisk',title:'HD20 + 2 UniDisk',visible:['SYSTEM.MONITOR','LIRON.UNIDISK.1.BODY']
    });
    assert.equal('layers' in exported,false);
    assert.equal('assets' in exported,false);
    assert.equal('slotN' in exported,false);
});

test('standalone import validates type, version, title, visible IDs and duplicate visible references atomically',()=>{
    const api=loadConfigurationFileCore();
    assert.throws(()=>api.validateStandaloneConfiguration(standalone({type:'wrong'})),/configuration.*type/i);
    assert.throws(()=>api.validateStandaloneConfiguration(standalone({version:2})),/unsupported.*configuration.*version/i);
    assert.throws(()=>api.validateStandaloneConfiguration(standalone({title:'   '})),/title.*non-empty/i);
    assert.throws(()=>api.validateStandaloneConfiguration(standalone({visible:['SYSTEM.MONITOR','MISSING.BODY']})),/unknown semantic ID MISSING\.BODY/i);
    assert.throws(()=>api.validateStandaloneConfiguration(standalone({visible:['SYSTEM.MONITOR','SYSTEM.MONITOR']})),/duplicate visible semantic ID SYSTEM\.MONITOR/i);
    assert.deepEqual(plain(api.state.configurations),[],'invalid imports must not mutate configuration state');
});

test('import adds and selects a validated configuration and collision-suffixes an existing ID',()=>{
    const api=loadConfigurationFileCore();
    api.state.configurations=[{id:'liron-hd20-two-unidisk',title:'Existing',visible:['SYSTEM.MONITOR']}];
    const imported=api.importStandaloneConfiguration(standalone());
    assert.equal(imported.id,'liron-hd20-two-unidisk-2');
    assert.equal(imported.title,'HD20 + 2 UniDisk');
    assert.deepEqual(plain(imported.visible),['SYSTEM.MONITOR','LIRON.UNIDISK.1.BODY','LIRON.HD20.2.BODY']);
    assert.equal(api.state.activeConfigurationId,imported.id);
    assert.equal(api.state.configurations.length,2);
});

test('duplicate clones active visibility into an independently editable selected configuration',()=>{
    const api=loadConfigurationFileCore();
    api.state.configurations=[{id:'hd20',title:'HD20',visible:['SYSTEM.MONITOR','LIRON.HD20.2.BODY']}];
    api.state.activeConfigurationId='hd20';
    const duplicate=api.duplicateConfiguration();
    assert.equal(duplicate.id,'hd20-copy');
    assert.equal(duplicate.title,'HD20 copy');
    assert.deepEqual(plain(duplicate.visible),['SYSTEM.MONITOR','LIRON.HD20.2.BODY']);
    assert.notEqual(duplicate.visible,api.state.configurations[0].visible);
    duplicate.visible.push('LIRON.UNIDISK.1.BODY');
    assert.deepEqual(plain(api.state.configurations[0].visible),['SYSTEM.MONITOR','LIRON.HD20.2.BODY']);
    assert.equal(api.state.activeConfigurationId,duplicate.id);
});

test('UI wiring records import and duplicate through the normal authoring history path and exports config.json',()=>{
    assert.match(source,/\$\('duplicateConfigurationBtn'\)\.addEventListener\('click',[\s\S]*?commitAuthoringMutation\(\(\)=>duplicateConfiguration\(\)\)/);
    assert.match(source,/configurationInput\.addEventListener\('change',[\s\S]*?commitAuthoringMutation\(\(\)=>importStandaloneConfiguration\(raw\)\)/);
    assert.match(source,/\$\('exportConfigurationBtn'\)\.addEventListener\('click',[\s\S]*?serializeStandaloneConfiguration\(active\)/);
    assert.match(source,/\.config\.json/);
});
