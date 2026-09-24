'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scenarioSource = fs.readFileSync(path.join(__dirname,'..','res','DBG_steptrace_scenario.js'),'utf8');
const testbenchCss = fs.readFileSync(path.join(__dirname,'..','res','DBG_testbench.css'),'utf8');

test('scenario UI is attached to STEP TRACE rather than Debugger Tools', () => {
  assert.doesNotMatch(scenarioSource,/b\.closest\('\.toolbox'\)/);
  assert.doesNotMatch(scenarioSource,/t\.parentNode\.appendChild\(q\)/);
  assert.match(scenarioSource,/cpuDbg_popup/);
  assert.match(scenarioSource,/cpuDbg_scenario/);
  assert.match(scenarioSource,/DBG_steptraceScenarioPopup/);
});

test('scenario companion starts hidden and exposes open close toggle controls', () => {
  assert.match(scenarioSource,/p\.hidden=true/);
  assert.match(scenarioSource,/open:function\(\)/);
  assert.match(scenarioSource,/close:function\(\)/);
  assert.match(scenarioSource,/toggle:function\(\)/);
});

test('scenario companion prefers the right side and falls back to the left', () => {
  assert.match(scenarioSource,/left=r\.right\+gap/);
  assert.match(scenarioSource,/left=Math\.max\(4,r\.left-pw-gap\)/);
  assert.match(scenarioSource,/p\.style\.top=Math\.round/);
});

test('shared TEST BENCH CSS also styles renamed STEP TRACE editor controls', () => {
  assert.match(testbenchCss,/#DBG_testScript,\s*\n#DBG_steptraceScript/);
  assert.match(testbenchCss,/#DBG_testConsole\.VanillaTerm,\s*\n#DBG_steptraceConsole\.VanillaTerm/);
  assert.match(testbenchCss,/#DBG_testRamAddress,\s*\n#DBG_steptraceRamAddress/);
});
