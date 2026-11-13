'use strict';

/*
 * Regression tests for the compressed ?asm= import in index.html.
 * Run from the repository root: node --test tests/asm_url_import.test.cjs
 * Uses Node's zlib as a stand-in for browser pako.inflate; no npm dependencies.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { deflateSync, inflateSync } = require('node:zlib');
const { TextDecoder } = require('node:util');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const first = html.indexOf('            function ASM_importSourceFromURL()');
const last = html.indexOf('            function ASM_loadSourceText(name,text)', first);
assert.ok(first >= 0 && last > first, 'modern URL-import handler exists in index.html');
const handler = html.slice(first, last);
assert.ok(
  html.includes('            ASM_clearOutputs("Sample source loaded. Click assemble to generate output.","");\n            ASM_importSourceFromURL();'),
  'initializer invokes import after default editor state has been established'
);

function encodedSource(source) {
  return deflateSync(Buffer.from(source, 'utf8')).toString('base64');
}

function execute(search, hash = '', options = {}) {
  const loaded = [];
  const statuses = [];
  const location = { search, hash };
  const scope = {
    window: { location },
    URLSearchParams,
    Uint8Array,
    TextDecoder,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    pako: options.noInflator ? undefined : {
      inflate: (bytes) => new Uint8Array(inflateSync(Buffer.from(bytes)))
    },
    ASM_loadSourceText: (...args) => loaded.push(args),
    ASM_setStatus: (...args) => statuses.push(args)
  };
  const result = vm.runInNewContext(handler + '\nASM_importSourceFromURL()', scope);
  return { result, loaded, statuses, location };
}

test('ignores URLs without asm and leaves the source untouched', () => {
  const r = execute('?boot=1');
  assert.equal(r.result, false);
  assert.equal(r.loaded.length, 0);
  assert.equal(r.statuses.length, 0);
  assert.equal(r.location.hash, '');
});

test('imports a documented zlib/Deflate sample into the modern source editor', () => {
  const sample = 'ORG $6000\n  LDA #$01\n  RTS\n';
  const encoded = 'eJzzD3JXUDEzMDDgUlDwcXFUUFYxMAQyg0KCuQBKWwUj';
  assert.equal(encodedSource(sample), encoded);
  const r = execute('?asm=' + encoded);
  assert.equal(r.result, true);
  assert.equal(r.loaded[0][0], 'url-import.S');
  assert.equal(r.loaded[0][1], sample);
  assert.equal(r.location.hash, '#tab2');
  assert.equal(r.statuses.at(-1)[1], 'ok');
});

test('preserves UTF-8 accents, Unicode, and original line endings', () => {
  const sample = 'ORG $6000\r\n; Hello — Magyar: árvíztűrő tükörfúrógép\r\nRTS\r\n';
  const r = execute('?boot=1&asm=' + encodeURIComponent(encodedSource(sample)));
  assert.equal(r.result, true);
  assert.equal(r.loaded[0][1], sample);
});

test('accepts + unescaped in legacy links and URL-safe unpadded Base64', () => {
  let sample, encoded;
  for (let i = 0; i < 10000; i++) {
    sample = 'ORG $6000\n; sample ' + i + '\nRTS\n';
    encoded = encodedSource(sample);
    if (encoded.includes('+')) break;
  }
  assert.ok(encoded.includes('+'), 'fixture includes a literal +');
  const legacy = execute('?asm=' + encoded);
  assert.equal(legacy.result, true);
  assert.equal(legacy.loaded[0][1], sample);

  const urlSafe = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const modern = execute('?asm=' + urlSafe, '#tab3');
  assert.equal(modern.result, true);
  assert.equal(modern.loaded[0][1], sample);
  assert.equal(modern.location.hash, '#tab3', 'explicit hash is respected');
});

test('rejects invalid and empty payloads without replacing source', () => {
  for (const query of ['?asm=', '?asm=%25', '?asm=' + Buffer.from('not deflate').toString('base64')]) {
    const r = execute(query);
    assert.equal(r.result, false);
    assert.equal(r.loaded.length, 0);
    assert.equal(r.statuses.at(-1)[1], 'bad');
    assert.equal(r.location.hash, '');
  }
});

test('rejects an unavailable inflator and a source over 2 MiB', () => {
  const sample = encodedSource('RTS\n');
  const noInflator = execute('?asm=' + sample, '', { noInflator: true });
  assert.equal(noInflator.result, false);
  assert.equal(noInflator.loaded.length, 0);
  const tooLarge = execute('?asm=' + encodedSource('A'.repeat(2 * 1024 * 1024 + 1)));
  assert.equal(tooLarge.result, false);
  assert.equal(tooLarge.loaded.length, 0);
});
