'use strict';

/**
 * Exercise the real ConfigFile_updater.html generation callback, not a
 * hand-maintained approximation of one table. A valid PSLOT table alone is
 * insufficient: the 2026-10 regression added "undefined" after every field
 * in PSLOT, KEYFONT, CHROMA, and TFUNCTION.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const updater = fs.readFileSync(path.join(root, 'tools/ConfigFile_updater.html'), 'utf8');
const markdown = fs.readFileSync(path.join(root, 'docs/CONFIG.md'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'res/COM_CONFIG.js'), 'utf8');

function regenerate()
{
    const processStart = updater.indexOf('function PROCESS()');
    const processEnd = updater.indexOf('function ltrim(s)', processStart);
    assert.ok(processStart >= 0 && processEnd > processStart, 'generator PROCESS() is present');

    const marker = 'GetHTTP(rawDocsURL+"CONFIG.md",';
    const first = updater.indexOf(marker);
    const second = updater.indexOf(marker, first + marker.length);
    assert.ok(first >= 0 && second > first, 'two CONFIG.md callbacks are present');

    const callback = updater.slice(second, processStart);
    const output = {innerHTML: ''};
    const context = vm.createContext({
        rawDocsURL: 'docs/',
        document: {
            getElementById(id)
            {
                assert.equal(id, 'dest', 'CONFIG generator must write into dest');
                return output;
            }
        },
        GetHTTP(url, fn)
        {
            assert.equal(url, 'docs/CONFIG.md');
            fn.call({responseText: markdown, responseURL: url});
        }
    });

    // The real generator's trim() and PROCESS.process_table() implementations
    // are used together with its actual table-processing callback.
    vm.runInContext(updater.slice(processStart, processEnd) +
        '\nfunction trim(s) { return String(s).trim(); }\n' +
        'var oPROCESS = new PROCESS();\n' + callback, context,
        {filename: 'ConfigFile_updater.html'});

    return output.innerHTML;
}

test('complete CONFIG updater output is valid executable JavaScript', () =>
{
    const generated = regenerate();
    assert.doesNotMatch(generated, /"undefined(?=[ ,}])/,
        'table-field hooks must never append undefined');
    assert.doesNotThrow(() => new vm.Script(generated, {filename:'COM_CONFIG.js'}));

    const values = vm.runInNewContext(generated +
        '\n;({systems:_CFG_SYSCODE, rom:_CFG_ROMRANGES, io:_CFG_IORANGES,' +
        'addresses:_CFG_IOADDR, peripherals:_CFG_PSLOT, fonts:_CFG_KEYFONT,' +
        'chroma:_CFG_CHROMA, tabs:_TABS, transforms:_CFG_TFUNCTION})');

    assert.ok(values.systems.A2P);
    assert.ok(values.io['A2,A2P,A2PE,A2JP,A2B']);
    assert.ok(values.peripherals.DISKII);
    assert.ok(values.peripherals.MOCK);
    assert.ok(values.tabs.tab1);
    assert.ok(values.transforms['.eq']);
    assert.equal(values.peripherals.DISKII.SLOTrange, '1,2,3,4,5,6*,7');

    // Historical generated tables remain intentionally retired.
    assert.doesNotMatch(generated, /\bconst _CFG_(?:PCODE|SLOT)\s*=/);
});

test('checked-in COM_CONFIG.js has the exact freshly regenerated prefix', () =>
{
    const generated = regenerate();
    const docsStart = compiled.indexOf('var _DOCS = new Array();');
    assert.ok(docsStart > 0, 'compiled help content should be retained');
    assert.equal(compiled.slice(0, docsStart), generated,
        'regenerate COM_CONFIG.js from tools/ConfigFile_updater.html and docs/CONFIG.md');
    assert.doesNotThrow(() => new vm.Script(compiled, {filename:'COM_CONFIG.js'}));
    assert.match(compiled.slice(docsStart), /_DOCS\[/, 'compiled help text stays present');
});

test('removed config tables are not referenced by generator', () =>
{
    assert.doesNotMatch(markdown, /\[(?:PCODE|SLOT#)\]/);
    assert.doesNotMatch(updater, /process_table\(\s*\[\s*"\[(?:PCODE|SLOT#)\]"/);
    assert.match(updater, /oPROCESS\.insertDATA\s*=\s*function\(\)\s*\{\s*return\s+["']{2}\s*;\s*\}/);
});
