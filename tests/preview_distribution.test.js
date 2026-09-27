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

test('branch preview inlines EMU-owned layout data and ignores legacy JSON transport', () => {
  const repoRoot = path.join(__dirname, '..');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'retroapple-preview-'));

  write(fixture, 'index.html', '<!doctype html><html><head><link rel="stylesheet" href="res/test.css"></head><body><script src="res/EMU_apple2main.js"></script><script src="res/bootstrap.js"></script></body></html>', 'utf8');
  write(fixture, 'res/test.css', 'body{background:#123}', 'utf8');
  const embeddedData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' + 'A'.repeat(1200);
  write(fixture, 'res/EMU_apple2main.js', `var A2P_LAYOUT_DATA={version:1,canvas:{width:1144,height:1144},layers:[{file:'tiny.png',x:0,y:0,visible:true,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}}],assets:{'tiny.png':'${embeddedData}'}};`, 'utf8');
  write(fixture, 'res/bootstrap.js', "document.write('<script src=\"res/inner.js\"><\\/script>');", 'utf8');
  write(fixture, 'res/inner.js', 'window.INNER_PREVIEW_TEST=true;', 'utf8');

  // A stale JSON export may still exist in the repository, but preview generation must not read it.
  write(fixture, 'tools/GUI_DEV/assets/apple2-layout-embedded_v2.json', JSON.stringify({marker:'DECOY_HTTP_LAYOUT'}), 'utf8');

  const builder = path.join(repoRoot, '.github', 'scripts', 'inline-preview.cjs');
  const run = spawnSync(process.execPath, [builder, '--root', fixture, '--branch', 'feature/foo'], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const previewPath = path.join(fixture, 'dist', 'RetroAppleJS-feature-foo.html');
  assert.equal(fs.existsSync(previewPath), true);
  assert.equal(fs.existsSync(path.join(fixture, 'dist', 'RetroAppleJS.html')), false);

  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /body\{background:#123\}/);
  assert.match(html, /window\.INNER_PREVIEW_TEST=true/);
  assert.match(html, /var A2P_LAYOUT_DATA=/);
  assert.match(html, /data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB/);
  assert.doesNotMatch(html, /src=["']res\/(EMU_apple2main|bootstrap|inner)\.js["']/);
  assert.doesNotMatch(html, /document\.write\(/);
  assert.doesNotMatch(html, /__RETROAPPLEJS_PREVIEW_ASSETS__/);
  assert.doesNotMatch(html, /DECOY_HTTP_LAYOUT/);
  assert.doesNotMatch(html, /apple2-layout-embedded_v2\.json/);
});
