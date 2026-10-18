'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../res/EMU_apple2main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Exercise the real EMUI slider code without booting the emulator.
function rig() {
    const start = source.indexOf('function EMUI()');
    const end = source.indexOf('function loadDisk_fromFile(', start);
    assert.ok(start >= 0 && end > start);

    const indicator = {
        id: 'slider_1v', innerHTML: '100%', title: '', attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        getAttribute(k) { return this.attrs[k]; }
    };
    const slider = {
        id: 'myRange', value: '100', min: 0, max: 400, step: 10,
        attrs: { 'data-speed-mode': 'pct400' },
        getAttribute(k) { return this.attrs[k]; },
        setAttribute(k, v) { this.attrs[k] = v; }
    };
    const elements = { slider_1v: indicator, myRange: slider };
    const ctx = { document: { getElementById(id) { return elements[id]; } } };
    vm.runInNewContext(source.slice(start, end) + '\nthis.ui = new EMUI();', ctx);
    const commits = [];
    ctx.ui.cpuSpd = value => commits.push(value);
    return { ui: ctx.ui, indicator, slider, commits };
}

test('drag events preview every 10% without committing CPU speed', () => {
    assert.match(html, /id="myRange"[\s\S]*?step="10"[\s\S]*?oninput="oEMUI\.cpuSldPreview\(this,'slider_1v'\)"[\s\S]*?onchange="oEMUI\.cpuSld\(this,'slider_1v'\)"/);
    assert.match(source, /"pct400":\{"min":0,"max":400,"step":10,/);

    const { ui, slider, indicator, commits } = rig();
    for (const pct of [110, 120, 130]) {
        slider.value = String(pct);
        ui.cpuSldPreview(slider, indicator.id);
        assert.equal(indicator.innerHTML, pct + '%');
        assert.match(indicator.title, new RegExp('CPU speed: ' + pct + '%'));
        assert.equal(indicator.attrs['aria-label'], indicator.title);
        assert.equal(commits.length, 0);
    }

    // onchange commits only the final position.
    ui.cpuSld(slider, indicator.id);
    assert.deepEqual(commits, [1.3]);
    assert.equal(indicator.innerHTML, '130%');
});

test('factor-mode previews preserve special icons and range switching', () => {
    const { ui, slider, indicator, commits } = rig();
    ui.cpuSldRange(indicator, slider.id);
    assert.equal(slider.getAttribute('data-speed-mode'), 'factor');
    assert.equal(indicator.innerHTML, 'x1');
    assert.deepEqual(commits, [1]);

    slider.value = '19';
    ui.cpuSldPreview(slider, indicator.id);
    assert.match(indicator.innerHTML, /^x72 <i class='fa fa-fighter-jet'/);
    assert.deepEqual(commits, [1]);

    slider.value = '0';
    ui.cpuSldPreview(slider, indicator.id);
    assert.match(indicator.innerHTML, /^x0 <i class='fa fa-bug'/);
    assert.deepEqual(commits, [1]);

    ui.cpuSld(slider, indicator.id);
    assert.deepEqual(commits, [1, 0]);
    ui.cpuSldRange(indicator, slider.id);
    assert.equal(slider.getAttribute('data-speed-mode'), 'pct400');
    assert.match(indicator.innerHTML, /^0% <i class='fa fa-bug'/);
});
