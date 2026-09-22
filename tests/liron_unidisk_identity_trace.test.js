'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const mainSource=fs.readFileSync('res/EMU_apple2main.js','utf8');

function extractFunction(source,name)
{
  const start=source.indexOf('function '+name+'(');
  if(start<0) return null;
  const open=source.indexOf('{',start);
  let depth=0;
  for(let i=open;i<source.length;i++)
  {
    if(source[i]==='{') depth++;
    else if(source[i]==='}' && --depth===0) return source.slice(start,i+1);
  }
  return null;
}

test('successful UniDisk mount logs router-vs-Liron unit identity and media state',()=>{
  const logs=[];
  const state={mediaLoaded:false,mediaFilename:''};
  const target={
    id:{DCODE:'UNIDISK'},
    loadImage(bytes,metadata){state.mediaLoaded=true;state.mediaFilename=metadata.filename;return bytes.length;},
    getState(){return {...state};}
  };
  const bus={getDevice(unit){return unit===1?target:null;}};
  const liron={id:{PCODE:'LIRON'},devices:[target],getBus(){return bus;}};
  const context={
    Uint8Array,Number,String,Array,Object,
    console:{log(...args){logs.push(args);},warn(){},error(){}},
    apple2plus:{hwObj(){return {io:{SLOT2obj(slotN){return slotN===6?liron:null;}}};}},
    EMU_unidisk35Device(slotN,unit){return slotN===6&&unit===1?target:null;},
    EMU_smartportDevice(){return null;},
    EMU_slotPeripheral(){return null;}
  };
  vm.createContext(context);
  const mountSource=extractFunction(mainSource,'EMU_mountDiskImage');
  assert.ok(mountSource,'EMU_mountDiskImage must exist');
  vm.runInContext(mountSource,context,{filename:'EMU_mountDiskImage.js'});

  assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),6,'UNIDISK','trace.po',1),true);
  const entry=logs.find(args=>args[0]==='UniDisk 3.5 identity trace');
  assert.ok(entry,'identity trace must be logged after a successful UniDisk mount');
  const details=entry[1];
  assert.equal(details.slotN,6);
  assert.equal(details.unit,1);
  assert.equal(details.sameObject,true);
  assert.equal(details.routerDevice,target);
  assert.equal(details.lironUnitDevice,target);
  assert.equal(details.routerState.mediaLoaded,true);
  assert.equal(details.routerState.mediaFilename,'trace.po');
  assert.equal(details.lironUnitState.mediaLoaded,true);
  assert.equal(details.lironUnitState.mediaFilename,'trace.po');
});
