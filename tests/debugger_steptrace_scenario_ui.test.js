'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scenarioSource = fs.readFileSync(path.join(__dirname,'..','res','DBG_steptrace_scenario.js'),'utf8');
const testbenchCss = fs.readFileSync(path.join(__dirname,'..','res','DBG_testbench.css'),'utf8');
const layoutJsPath = path.join(__dirname,'..','res','DBG_steptrace_scenario_layout.js');
const layoutCssPath = path.join(__dirname,'..','res','DBG_steptrace_scenario_layout.css');
const layoutSource = fs.existsSync(layoutJsPath) ? fs.readFileSync(layoutJsPath,'utf8') : '';
const layoutCss = fs.existsSync(layoutCssPath) ? fs.readFileSync(layoutCssPath,'utf8') : '';

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

test('fixed scenario companion is mounted in viewport coordinate space', () => {
  assert.match(scenarioSource,/var host=D\.body\|\|E\('feature_box'\)/);
  assert.match(scenarioSource,/host\.appendChild\(p\)/);
  assert.doesNotMatch(scenarioSource,/\(E\('feature_box'\)\|\|D\.body\)\.appendChild\(p\)/);
});

test('layout companion derives its gap from SYSTEM to SLOTS spacing', () => {
  assert.match(layoutSource,/function toolboxReferenceGap\(\)/);
  assert.match(layoutSource,/E\('tab1\.1'\)/);
  assert.match(layoutSource,/boxes\[1\]\.getBoundingClientRect\(\)\.left-boxes\[0\]\.getBoundingClientRect\(\)\.right/);
  assert.match(layoutSource,/var gap=toolboxReferenceGap\(\)/);
});

test('STEP TRACE is widened only enough to preserve the old scenario horizontal offset', () => {
  assert.match(layoutSource,/function normalizeTraceWidth\(gap\)/);
  assert.match(layoutSource,/Math\.max\(0,8-gap\)/);
  assert.match(layoutSource,/cpuDbg_popup/);
});

test('layout companion prefers the right side, falls back left, and uses a narrower preferred width', () => {
  assert.match(layoutSource,/var preferred=460/);
  assert.match(layoutSource,/left=r\.right\+gap/);
  assert.match(layoutSource,/left=Math\.max\(gap,r\.left-pw-gap\)/);
  assert.match(layoutSource,/p\.style\.top=Math\.round/);
});

test('STEP TRACE scenario is scoped to emulator tab 1.1', () => {
  assert.match(layoutSource,/oCOM\.POPUP\.addScope\(['"]DBG_steptraceScenarioPopup['"],['"]tab1\.1['"]\)/);
});

test('shared TEST BENCH CSS also styles renamed STEP TRACE editor controls', () => {
  assert.match(testbenchCss,/#DBG_testScript,\s*\n#DBG_steptraceScript/);
  assert.match(testbenchCss,/#DBG_testConsole\.VanillaTerm,\s*\n#DBG_steptraceConsole\.VanillaTerm/);
  assert.match(testbenchCss,/#DBG_testRamAddress,\s*\n#DBG_steptraceRamAddress/);
});

test('scenario title matches toolbox title weight and scenario body uses STEP TRACE listing scale', () => {
  assert.match(layoutCss,/\.DBG_steptraceScenarioPopup \.DBG_testbenchTitle\s*\{[^}]*font-weight:\s*400/s);
  assert.match(layoutCss,/#DBG_steptraceScript\s*\{[^}]*font:\s*9px\/12px/s);
  assert.match(layoutCss,/#DBG_steptraceConsole \.container\s*\{[^}]*font:\s*9px\/12px/s);
});
