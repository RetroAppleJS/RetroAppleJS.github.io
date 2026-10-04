'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Mockingboard dependencies are statically loaded in safe order',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ay='<script type="text/javascript" src="res/ayumi.js"></script>';
  const audio='<script type="text/javascript" src="res/EMU_DEVICE_mockingboard_audio.js"></script>';
  const card='<script type="text/javascript" src="res/EMU_CARD_mockingboard.js"></script>';
  assert.ok(html.includes(ay),'ayumi.js must be enabled');
  assert.ok(html.includes(audio),'MockingboardAudio device must be statically included');
  assert.ok(html.indexOf(ay)<html.indexOf(card),'ayumi must load before card');
  assert.ok(html.indexOf(audio)<html.indexOf(card),'audio device must load before card');
});

test('Mockingboard config uses SlotROM and keeps physical slots 1-7',()=>{
  const text=fs.readFileSync(path.join(root,'res','COM_CONFIG.js'),'utf8');
  const m=text.match(/"MOCK"\s*:\s*\{[^}]+\}/); assert.ok(m,'MOCK config entry'); const s=m[0];
  assert.match(s,/"HostIO"\s*:\s*""/); assert.match(s,/"SlotIO"\s*:\s*""/); assert.match(s,/"SlotROM"\s*:\s*"X"/); assert.match(s,/"HostROM"\s*:\s*""/); assert.match(s,/"SLOTrange"\s*:\s*"1,2,3,4,5,6,7"/);
});

test('global sound toggle discovers attached audio-capable devices generically',()=>{
  const main=fs.readFileSync(path.join(root,'res','EMU_apple2main.js'),'utf8');
  const device=fs.readFileSync(path.join(root,'res','EMU_DEVICE_mockingboard_audio.js'),'utf8');
  assert.match(device,/this\.audioDevice\s*=\s*true/);
  assert.match(main,/function\s+EMU_attachedAudioDevices\s*\(/);
  assert.match(main,/io\.attachments/);
  assert.match(main,/device\.audioDevice\s*===\s*true/);
  assert.match(main,/EMU_attachedAudioDevices\(\)/);
  assert.match(main,/audioDevice\.init\("audio_ctx"\)/);
  assert.match(main,/audioDevice\.init\("audio_on"\)/);
  assert.match(main,/audioDevice\.init\("audio_off"\)/);
});
