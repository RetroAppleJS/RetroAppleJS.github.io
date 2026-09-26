'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function write(root, rel, content, encoding) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, encoding);
}

test('branch preview builder emits one self-contained branch-named HTML file', () => {
  const repoRoot = path.join(__dirname, '..');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'retroapple-preview-'));

  write(fixture, 'index.html', '<!doctype html><html><head><link rel="stylesheet" href="res/test.css"></head><body><script src="res/bootstrap.js"></script></body></html>', 'utf8');
  write(fixture, 'res/test.css', 'body{background:#123}', 'utf8');
  write(fixture, 'res/bootstrap.js', "document.write('<script src=\"res/inner.js\"><\\/script>');", 'utf8');
  write(fixture, 'res/inner.js', 'window.INNER_PREVIEW_TEST=true;', 'utf8');

  const layout = {
    version: 1,
    canvas: { width: 1144, height: 1144 },
    layers: [
      { file: 'tiny.png', x: 0, y: 0, visible: true, shadow: { enabled: false, offsetX: 0, offsetY: 15, blur: 12, opacity: 0.75 } }
    ]
  };
  write(fixture, 'tools/GUI_DEV/assets/apple2-layout-6.json', JSON.stringify(layout), 'utf8');
  write(fixture, 'tools/GUI_DEV/assets/tiny.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));

  const builder = path.join(repoRoot, '.github', 'scripts', 'inline-preview.cjs');
  const run = spawnSync(process.execPath, [builder, '--root', fixture, '--branch', 'feature/foo'], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const previewPath = path.join(fixture, 'dist', 'RetroAppleJS-feature-foo.html');
  assert.equal(fs.existsSync(previewPath), true);
  assert.equal(fs.existsSync(path.join(fixture, 'dist', 'RetroAppleJS.html')), false);

  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /body\{background:#123\}/);
  assert.match(html, /window\.INNER_PREVIEW_TEST=true/);
  assert.doesNotMatch(html, /src=["']res\/(bootstrap|inner)\.js["']/);
  assert.doesNotMatch(html, /document\.write\(/);
  assert.match(html, /__RETROAPPLEJS_PREVIEW_ASSETS__/);
  assert.match(html, /tools\/GUI_DEV\/assets\/apple2-layout-6\.json/);
  assert.match(html, /data:image\/png;base64,/);
});
