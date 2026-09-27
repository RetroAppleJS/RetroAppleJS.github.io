'use strict';
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOrThrow(source, from, to, label) {
  if (!source.includes(from)) throw new Error('Could not find ' + label);
  return source.replace(from, to);
}

let index = read('index.html');
if (!index.includes('src="res/COM_A2P_LAYOUT.js"')) {
  index = replaceOrThrow(
    index,
    '    <script type="text/javascript" src="res/COM_MAIN.js"></script>\n',
    '    <script type="text/javascript" src="res/COM_MAIN.js"></script>\n' +
    '    <script type="text/javascript" src="res/COM_A2P_LAYOUT.js"></script>\n' +
    '    <script type="text/javascript" src="res/COM_LAYOUT_CONFIG.js"></script>\n',
    'COM_MAIN.js script include'
  );
}
write('index.html', index);

const core = read('res/COM_MAIN_core.js');
write('res/COM_MAIN.js', core);
fs.rmSync('res/COM_MAIN_core.js', { force: true });

let layoutTest = read('tests/apple2_html_layout.test.js');
if (!layoutTest.includes('layoutConfigSource')) {
  layoutTest = replaceOrThrow(
    layoutTest,
    "const emuMainSource=fs.readFileSync(path.join(repoRoot,'res','EMU_apple2main.js'),'utf8');\nconst compositorSource=fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');",
    "const emuMainSource=fs.readFileSync(path.join(repoRoot,'res','EMU_apple2main.js'),'utf8');\nconst layoutConfigSource=fs.readFileSync(path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js'),'utf8');\nconst compositorSource=fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');",
    'layout test source declarations'
  );
}
layoutTest = layoutTest.replace(
  "test('EMU_apple2main owns composer layout data and compositor has no JSON HTTP loader', () => {",
  "test('COM_LAYOUT_CONFIG owns composer layout data and compositor has no JSON HTTP loader', () => {"
);
layoutTest = layoutTest.replace(
  "  assert.match(emuMainSource,/\\bvar\\s+composer\\s*=/);\n",
  "  assert.match(layoutConfigSource,/\\bvar\\s+composer\\s*=/);\n" +
  "  assert.match(layoutConfigSource,/A2P_FULL_DISKII_LED\\.png/);\n" +
  "  assert.doesNotMatch(emuMainSource,/\\bvar\\s+composer\\s*=/);\n" +
  "  assert.doesNotMatch(emuMainSource,/A2P_FULL_DISKII_LED\\.png/);\n"
);
write('tests/apple2_html_layout.test.js', layoutTest);

let ownershipTest = read('tests/script_include_ownership.test.js');
if (!ownershipTest.includes('COM_MAIN_core.js should be removed')) {
  ownershipTest = ownershipTest.replace(
    "test('COM_MAIN.js is the core implementation, not a script bootstrapper', () => {\n",
    "test('COM_MAIN.js is the core implementation, not a script bootstrapper', () => {\n" +
    "  assert.equal(fs.existsSync(path.join(repoRoot, 'res', 'COM_MAIN_core.js')), false, 'COM_MAIN_core.js should be removed');\n"
  );
}
write('tests/script_include_ownership.test.js', ownershipTest);
