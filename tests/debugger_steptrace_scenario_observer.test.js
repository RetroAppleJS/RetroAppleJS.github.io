'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,'..','res','DBG_steptrace_scenario_layout.js'),'utf8');

test('layout updates cannot observe their own style and visibility mutations', () => {
  assert.doesNotMatch(source,/new g\.MutationObserver\(apply\)/,
    'apply() must not be the callback of a persistent DOM observer');
  assert.doesNotMatch(source,/observe\(D\.body,\{attributes:true/,
    'the layout module must not observe body style/hidden/class attributes that it mutates itself');
});

test('layout remains event driven after removing the persistent observer', () => {
  assert.match(source,/addEventListener\('resize',apply\)/,
    'viewport changes must still re-apply layout');
});
