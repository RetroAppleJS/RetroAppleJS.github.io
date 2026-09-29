'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');

function patch(rel,replacements)
{
    const file=path.join(root,rel);
    let source=fs.readFileSync(file,'utf8');
    for(const [before,after,label] of replacements)
    {
        const count=source.split(before).length-1;
        if(count!==1) throw new Error(`${rel}: expected one ${label}, found ${count}`);
        source=source.replace(before,after);
    }
    fs.writeFileSync(file,source);
}

patch('tests/appledisk2_layout_v2.test.js',[
    ["const configPath = path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js');","const configPath = path.join(repoRoot,'tests','fixtures','apple2_runtime_layout_v2.js');",'runtime fixture path'],
    ["test('production COM_LAYOUT_CONFIG.js is v2 and Disk II visuals live in the slot-qualified namespace',()=>{","test('runtime v2 fixture keeps Disk II visuals in the slot-qualified namespace',()=>{",'Disk II fixture test title']
]);

patch('tests/composer_v1_dataset_conversion.test.js',[
    ["const productionPath=path.join(root,'res','COM_LAYOUT_CONFIG.js');","const runtimeFixturePath=path.join(root,'tests','fixtures','apple2_runtime_layout_v2.js');",'runtime fixture path'],
    ["test('production Composer dataset preserves the v2 conversion metadata contract',()=>{\n    const production=loadComposer(productionPath);","test('runtime v2 fixture preserves the slot-qualified conversion metadata contract',()=>{\n    const production=loadComposer(runtimeFixturePath);",'runtime fixture test heading']
]);

patch('tests/peripheral_layout_context.test.js',[
    ["fs.readFileSync(path.join(ROOT,'res','COM_LAYOUT_CONFIG.js'),'utf8')","fs.readFileSync(path.join(ROOT,'tests','fixtures','apple2_runtime_layout_v2.js'),'utf8')",'runtime fixture loader']
]);

console.log('Task 5 runtime tests now use the isolated slot-qualified v2 fixture.');
