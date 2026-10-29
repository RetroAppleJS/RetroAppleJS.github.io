// Regression checks for Mockingboard's self-contained source-rate WAV recorder.
// Run: node --test tests/mockingboard_wav_capture.test.cjs
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../res/EMU_CARD_mockingboard.js'),'utf8');
const marker='\nfunction MockingboardWavCapture(sampleRate)';
const start=source.indexOf(marker);
assert.ok(start>0,'Expected independent WAV capture helper in card source');
const Capture=vm.runInNewContext(source.slice(start)+'\nMockingboardWavCapture', {
    Uint8Array,DataView,Number,Error,RangeError
});
function stereo(values){return Float32Array.from(values);}
function header(wav)
{
    const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
    const fourcc=(pos)=>String.fromCharCode(...wav.subarray(pos,pos+4));
    return {
        riff:fourcc(0),length:view.getUint32(4,true),wave:fourcc(8),fmt:fourcc(12),
        pcm:view.getUint16(20,true),channels:view.getUint16(22,true),
        rate:view.getUint32(24,true),byteRate:view.getUint32(28,true),
        align:view.getUint16(32,true),bits:view.getUint16(34,true),
        data:fourcc(36),frames:view.getUint32(40,true)
    };
}
test('duration is bounded to 1-60 seconds and frozen when armed',()=>{
    const rec=new Capture(22050);
    assert.equal(rec.getState().seconds,5);
    for(const n of [0,61,1.5,NaN])assert.throws(()=>rec.setSeconds(n));
    rec.setSeconds(1);
    assert.equal(rec.toggle(),'armed');
    assert.throws(()=>rec.setSeconds(2));
    assert.equal(rec.getState().allocatedBytes,0);
});
test('armed state ignores silence and sub-8-bit-output signals without allocating',()=>{
    const rec=new Capture(22050);
    rec.toggle();
    assert.equal(rec.appendFrames(stereo([0,0.0001,0.003]),stereo([0,0.0001,0.003]),3),false);
    assert.equal(rec.getState().state,'armed');
    assert.equal(rec.getState().allocatedBytes,0);
    assert.equal(rec.appendFrames(stereo([0.5]),stereo([0.5]),1),true);
    assert.equal(rec.getState().state,'recording');
    assert.equal(rec.getState().capturedFrames,1);
    assert.equal(rec.getState().allocatedBytes,5*22050);
});
test('records precise source-frame duration and ignores following frames',()=>{
    const rec=new Capture(22050);
    rec.setSeconds(1);rec.toggle();
    const samples=stereo(Array(25000).fill(0.25));
    assert.equal(rec.appendFrames(samples,samples,samples.length),true);
    assert.equal(rec.getState().state,'ready');
    assert.equal(rec.getState().capturedFrames,22050);
    assert.equal(rec.appendFrames(samples,samples,10),false);
    const wav=rec.makeWav(),h=header(wav);
    assert.deepEqual(h,{riff:'RIFF',length:22086,wave:'WAVE',fmt:'fmt ',
        pcm:1,channels:1,rate:22050,byteRate:22050,align:1,bits:8,
        data:'data',frames:22050});
    assert.equal(wav.length,44+22050);
    assert.equal(rec.toggle(),'ready','do not discard a completed capture without download');
    rec.release();
    assert.equal(rec.getState().allocatedBytes,0);
    assert.equal(rec.getState().capturedFrames,0);
});
test('signed floats become unsigned u8 mono after stereo mix and clipping',()=>{
    const rec=new Capture(3);rec.setSeconds(1);rec.toggle();
    assert.equal(rec.appendFrames(stereo([1,1,-2]),stereo([1,-1,-2]),3),true);
    const wav=rec.makeWav();
    assert.deepEqual(Array.from(wav.slice(44)),[255,128,0]);
});
test('cancel from armed or recording releases all samples; can rearm',()=>{
    const rec=new Capture(20);rec.setSeconds(2);
    assert.equal(rec.toggle(),'armed');assert.equal(rec.toggle(),'idle');
    assert.equal(rec.getState().allocatedBytes,0);
    assert.equal(rec.toggle(),'armed');
    rec.appendFrames(stereo([0.5]),stereo([0.5]),1);
    assert.equal(rec.getState().allocatedBytes,40);
    assert.equal(rec.toggle(),'idle');
    assert.equal(rec.getState().allocatedBytes,0);
    assert.equal(rec.toggle(),'armed');
});
test('capture hook is after speech mixing and before presentation FIFO',()=>{
    const mix=source.indexOf('voiceDevice.mixFrames(startTick,startPhase,frames,pcm,end)');
    const cap=source.indexOf('wavCapture.appendFrames(pcm.left,pcm.right,frames)');
    const fifo=source.indexOf('enqueueFrame(pcm.left[i],pcm.right[i])');
    assert.ok(mix>=0 && mix<cap && cap<fifo);
    assert.match(source,/if\(wavCapture\.isActive\(\) && wavCapture\.appendFrames/);
});
test('UI has 2 rows, record/duration/download, and no duplicated core status',()=>{
    assert.match(source,/data-mockingboard-row='1'/);
    assert.match(source,/data-mockingboard-row='2'/);
    for(const id of ['wav_record','wav_seconds','wav_download'])
        assert.match(source,new RegExp('historyID\\("'+id+'"\\)'));
    assert.doesNotMatch(source,/historyID\("backend_status"\)/);
    assert.doesNotMatch(source,/fa fa-coffee/);
    assert.match(source,/fa fa-music/);
    assert.match(source,/fa fa-download/);
});
test('reset, unmount and backend change cancel retained WAV buffers',()=>{
    assert.match(source,/this\.reset=function\(\)\s*\{\s*wavCapture\.release\(\)/);
    assert.match(source,/this\.onUnmount=function\(\)\s*\{\s*wavCapture\.release\(\)/);
    assert.match(source,/if\(history\.isCapturing\(\)\)history\.stop\(lastCpuTick\);\s*wavCapture\.release\(\)/);
});
