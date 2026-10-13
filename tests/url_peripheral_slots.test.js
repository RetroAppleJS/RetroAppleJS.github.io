'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname,'../res/EMU_apple2io.js'),'utf8');
const context = vm.createContext({
    oEMU:{component:{IO:{}},system:{}},
    oEMUI:{},
    console
});
vm.runInContext(code,context,{filename:'EMU_apple2io.js'});

function setup(raw,options={})
{
    // Apple2IO reserves index 0 for the motherboard; physical slot N is N+1.
    const slotR = {
        slotMap:{0:['A2BO'],1:['MS16K'],7:['DISKII']},
        slotFit:{
            1:['MS16K','SATURN','LEGEND'],
            2:['MOCK','SPC','DISKII'],
            3:['MOCK','SPC','DISKII'],
            4:['VIDEX','MOCK','SPC','DISKII'],
            5:['MOCK','SPC','DISKII'],
            6:['LIRON','MOCK','DISKII'],
            7:['DISKII','MOCK','SPC'],
            8:['DISKII','MOCK','SPC']
        }
    };
    const codes=['A2BO','MS16K','SATURN','LEGEND','MOCK','SPC','LIRON','DISKII','VIDEX'];
    const catalog=Object.fromEntries(codes.map(code=>[code,{NAME:code}]));
    const discovered=Object.fromEntries(codes.map(code=>[code,{PCODE:code}]));
    Object.assign(discovered,options.discovered || {});
    const physicalSlots=options.physicalSlots || [0,1,2,3,4,5,6,7];
    const result=context.EMU_applyURLSlotOverrides(slotR,raw,catalog,physicalSlots,discovered);
    return {
        map:JSON.parse(JSON.stringify(slotR.slotMap)),
        result:JSON.parse(JSON.stringify(result))
    };
}

test('no slots argument preserves COM_CONFIG defaults',()=>{
    const {map,result}=setup(undefined);
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'7':['DISKII']});
    assert.deepEqual(result.applied,[]);
});

test('multiple URL assignments mount existing PCODEs at their physical slots',()=>{
    const {map,result}=setup('2:SPC,4:MOCK,5:LIRON,6:DISKII');
    assert.deepEqual(map,{
        '0':['A2BO'],'1':['MS16K'],'3':['SPC'],'5':['MOCK'],
        '6':['LIRON'],'7':['DISKII']
    });
    assert.equal(result.warnings.length,0);
    assert.deepEqual(result.applied.map(item=>item.slot),[2,4,5,6]);
});

test('relocating default Disk II to slot 5 removes its slot 6 default',()=>{
    const {map}=setup('5:DISKII');
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'6':['DISKII']});
});

test('URL assignment takes precedence over the default Disk II in slot 6',()=>{
    const {map,result}=setup('6:MOCK');
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'7':['MOCK']});
    assert.deepEqual(result.applied,[{slot:6,PCODE:'MOCK'}]);
    assert.equal(result.warnings.length,0);
});

test('NONE leaves a slot empty without affecting other defaults',()=>{
    const {map,result}=setup('6:none,4:mock');
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'5':['MOCK']});
    assert.equal(result.warnings.length,0);
});

test('slot zero can replace default MS16K card with a compatible RAM card',()=>{
    const {map}=setup('0:saturn');
    assert.deepEqual(map,{'0':['A2BO'],'1':['SATURN'],'7':['DISKII']});
});

test('incompatible or unknown cards do not displace defaults',()=>{
    const {map,result}=setup('4:VIDEX,5:UNSUPPORTED,6:ZANY,7:INVALID');
    // VIDEX only supports physical slot 3 in the real _CFG_PSLOT; the fixture
    // here also declares slot 3 (index 4), not physical slot 4 (index 5).
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'7':['DISKII']});
    assert.equal(result.warnings.length,4);
});

test('rejects unavailable physical slots and invalid assignments',()=>{
    const {map,result}=setup('8:MOCK,2=SPC,7:MOCK,4:MOCK',{
        physicalSlots:[0,1,2,3,4,5,6]
    });
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'5':['MOCK'],'7':['DISKII']});
    assert.equal(result.warnings.length,3);
});

test('keeps first valid assignment when slot is mentioned twice',()=>{
    const {map,result}=setup('4:MOCK,4:SPC');
    assert.deepEqual(map['5'],['MOCK']);
    assert.equal(result.warnings.length,1);
});

test('explicitly requesting the same card in multiple slots is permitted',()=>{
    const {map}=setup('2:MOCK,4:MOCK');
    assert.deepEqual(map['3'],['MOCK']);
    assert.deepEqual(map['5'],['MOCK']);
});

test('refuses a fixed-slot peripheral',()=>{
    const {map,result}=setup('2:MOCK',{discovered:{MOCK:{PCODE:'MOCK',slotLock:true}}});
    assert.equal(map['3'],undefined);
    assert.match(result.warnings[0],/fixed slot/);
});

test('startup integration applies URL overrides after COM_CONFIG default map construction',()=>{
    assert.ok(code.includes('oCOM.URL.uri.slots'));
    const indexOfMap=code.indexOf('var slotR = {};');
    const indexOfApply=code.indexOf('var urlSlotResult = EMU_applyURLSlotOverrides(',indexOfMap);
    const indexOfMount=code.indexOf('this.mount(cinfo,pinfo,slotN,slotR.slotFit[slotN])');
    assert.ok(indexOfMap>=0 && indexOfApply>indexOfMap);
    assert.ok(indexOfMount>=0,'Apple2IO.restart() retains normal mount() logic');
    assert.ok(code.includes('urlSlotAssignment[assignment.slot+1] = assignment.PCODE'));
    assert.ok(code.includes('o.pObj.mount.source = "URL"'));
    assert.ok(code.includes('slotObj.peripheral?.mount?.source == "URL"'));
});

test('invalid URL override never removes a COM_CONFIG prefilled card',()=>{
    const {map,result}=setup('6:VIDEX');
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'7':['DISKII']});
    assert.equal(result.applied.length,0);
    assert.equal(result.warnings.length,1);
});

test('empty explicit URL assignment does not alter COM_CONFIG defaults',()=>{
    const {map,result}=setup('');
    assert.deepEqual(map,{'0':['A2BO'],'1':['MS16K'],'7':['DISKII']});
    assert.equal(result.applied.length,0);
});
