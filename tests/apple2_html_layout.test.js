'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../res/COM_A2P_LAYOUT.js');

test('Apple II layout exposes an HTML composition builder', () => {
  assert.equal(typeof layout.buildDOMComposition, 'function');
});
