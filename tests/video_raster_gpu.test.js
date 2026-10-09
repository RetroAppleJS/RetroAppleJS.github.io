'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {WebGLFunctionNode, WebGL2FunctionNode, FunctionBuilder} = require('../res/gpu-browser.min.js');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../res/EMU_VIDEO_raster.js'), 'utf8'), context);
const raster = context.Apple2RasterKernel;

// Exercise the actual bundled shader compiler, without requiring a WebGL device.
for (const Compiler of [WebGLFunctionNode, WebGL2FunctionNode])
{
    for (const scalarType of ['Number', 'Integer'])
    {
        test(`${Compiler.name} translates the raster kernel with ${scalarType} scalar arguments`, ()=>{
            const builder = FunctionBuilder.fromKernel({
                source:raster.toString(),
                output:[560,384],
                constants:{scale:2},
                kernelConstants:[{name:'scale',type:'Integer'}],
                argumentNames:['bytes','modes','rom','pal','chrome','flash'],
                kernelArguments:['Array','Array','Array','Array',scalarType,scalarType].map(type=>({type})),
                argumentBitRatios:[1,1,1,1,4,4], // Uint8Array inputs and scalar numbers
                precision:'unsigned',
                nativeFunctions:[], functions:[]
            }, Compiler);
            const shader = builder.getPrototypes('kernel').join('\n');
            assert.ok(shader.includes('color('));
        });
    }
}

function pixel(mode, byte, y, chrome, flash)
{
    const bytes = new Uint8Array(7680);
    const modes = new Uint8Array(7680);
    const rom = new Uint8Array(512);
    const palette = Uint8Array.from({length:256}, (_,i)=>i);
    const index = y*40;
    bytes[index] = byte;
    modes[index] = mode;
    rom[(((byte&63)^32)*8)+(y&7)] = 1;
    let color;
    raster.call({
        thread:{x:0,y:(191-y)*2}, constants:{scale:2},
        color(...rgba) { color = rgba; }
    }, bytes, modes, rom, palette, chrome, flash);
    return color;
}

function rgba(offset)
{
    return [offset/256, (offset+1)/256, (offset+2)/256, 1];
}

test('raster text pixels retain normal, inverse and flashing attributes', ()=>{
    assert.deepEqual(pixel(0,0xC1,0,0,0), rgba(240));
    assert.deepEqual(pixel(0,0x01,0,0,0), rgba(0));
    assert.deepEqual(pixel(0,0x41,0,0,0), rgba(240));
    assert.deepEqual(pixel(0,0x41,0,0,1), rgba(0));
});

test('raster lores pixels retain upper/lower nibbles and monitor palette offset', ()=>{
    assert.deepEqual(pixel(1,0xA5,0,0,0), rgba(80));
    assert.deepEqual(pixel(1,0xA5,4,3,0), rgba(172));
});

test('raster hires pixels retain black and white colors', ()=>{
    assert.deepEqual(pixel(2,0x00,0,0,0), rgba(0));
    assert.deepEqual(pixel(2,0x7F,0,0,0), rgba(240));
});
