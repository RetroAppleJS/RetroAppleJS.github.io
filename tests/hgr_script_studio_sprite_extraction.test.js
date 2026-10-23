// HGR Script Studio: extraction and reinsertion of reusable pixel/phase sprite rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../tools/HGR_SCRIPT_STUDIO.html'), 'utf8');

function sourceBetween(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Missing source section: ' + start);
  return html.slice(a, b);
}

function makeSpriteContext() {
  const W = 280, H = 192;
  const at = (x, y) => ((y & 7) << 10) | ((y & 56) << 4) | ((y >> 6) * 40) | (x / 7 | 0);
  const ctx = {
    W, H, at,
    state: { bytes: new Uint8Array(8192) },
    valid: (x, y) => x >= 0 && y >= 0 && x < W && y < H,
    integer: Math.round
  };
  vm.createContext(ctx);
  vm.runInContext(sourceBetween('function captureSpriteRows(', 'function pasteRegion('), ctx);
  return ctx;
}

test('extracted rows preserve bit and byte phase and redraw in native HGR order', () => {
  const ctx = makeSpriteContext();
  const { bytes } = ctx.state;
  const x = 10, y = 30, w = 19, h = 6;
  for (let j = 0; j < h; j++)
    for (let group = 0; group < 40; group++) {
      const phase = (group + j) & 1;
      bytes[ctx.at(group * 7, y + j)] = ((group * 17 + j * 11) & 0x7f) | (phase << 7);
    }
  const rows = ctx.captureSpriteRows(x, y, w, h);
  assert.equal(rows.length, h);
  assert.ok(rows.every(row => row.length === w && /^[0123]+$/.test(row)));
  assert.match(rows.join(''), /[23]/);
  assert.match(rows.join(''), /[01]/);

  bytes.fill(0);
  ctx.drawSpriteRows(rows, x, y);
  assert.equal(ctx.captureSpriteRows(x, y, w, h).join('|'), rows.join('|'));

  // Offset by 7 logical pixels to retain the same phase group alignment.
  bytes.fill(0);
  ctx.drawSpriteRows(rows, x + 7, y);
  assert.equal(ctx.captureSpriteRows(x + 7, y, w, h).join('|'), rows.join('|'));
});

test('opaque black, transparent black and dot transparency behave differently', () => {
  const ctx = makeSpriteContext(), { bytes } = ctx.state;
  const p = x => (bytes[ctx.at(x, 40)] >> (x % 7)) & 1;
  bytes.fill(0x7f); // all pixels on (phase 0)
  ctx.drawSpriteRows(['0.1'], 21, 40, false);
  assert.equal(p(21), 0, 'opaque black clears a lit pixel');
  assert.equal(p(22), 1, 'dot leaves the destination unchanged');
  assert.equal(p(23), 1, 'one sets a pixel');

  bytes.fill(0x7f);
  ctx.drawSpriteRows(['0.1'], 21, 40, true);
  assert.equal(p(21), 1, 'transparent black must not erase the background');
  assert.equal(p(22), 1);
  assert.equal(p(23), 1);
});

test('drawing clips to the edge and validates all data before mutation', () => {
  const ctx = makeSpriteContext();
  ctx.drawSpriteRows(['1.3', '203'], 279, 191);
  assert.equal(ctx.captureSpriteRows(279, 191, 1, 1)[0], '1');
  const before = ctx.state.bytes.slice();
  assert.throws(() => ctx.drawSpriteRows(['10', '000'], 0, 0), /expected nonempty equal-width/);
  assert.throws(() => ctx.drawSpriteRows(['1<2'], 0, 0), /expected nonempty equal-width/);
  assert.deepEqual(ctx.state.bytes, before);
  assert.throws(() => ctx.captureSpriteRows(279, 191, 2, 2), /rectangle must fit/);
});

test('generated JavaScript is executable and has editable sprite positions', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(sourceBetween('function spriteSource(', 'function insertSelectedSprite('), context);
  const rows = ['0110', '1331', '0220'];
  const source = context.spriteSource(rows, 'sprite1', 31, 58);
  assert.match(source, /const sprite1 = \[/);
  assert.match(source, /hgr\.drawSprite\(sprite1, 31, 58\)/);
  const canvasCalls = [];
  vm.runInNewContext(source, {hgr: {drawSprite: (...args) => canvasCalls.push(args)}});
  assert.deepEqual(Array.from(canvasCalls[0][0]), rows);
  assert.deepEqual(canvasCalls[0].slice(1), [31, 58]);
  assert.ok(html.includes('id="extractSpriteBtn"'));
});
