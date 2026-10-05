const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '../..');
function load()
{
    const ctx = {
        console,
        Uint8Array,
        Float32Array,
        Float64Array,
        DataView,
        ArrayBuffer,
        WebAssembly,
        atob: s => Buffer.from(s, 'base64').toString('binary')
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    for (const f
             of ['ayumi.js', 'EMU_CHIP_AY_JS.js', 'EMU_CHIP_AY_WASM.js', 'EMU_CHIP_AY.js',
                 'EMU_AUDIO_AY_STREAM.js'])
    {
        const p = path.join(root, 'res', f);
        if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, {filename: f});
    }
    return ctx;
}
function batch(events)
{
    const data = new Uint8Array(events.length * 16), v = new DataView(data.buffer);
    events.forEach((e, i) => {
        const p = i * 16;
        v.setUint32(p, e[0] % 4294967296, true);
        v.setUint32(p + 4, Math.floor(e[0] / 4294967296), true);
        data[p + 8] = e[1];
        data[p + 9] = e[2];
        data[p + 10] = e[3] || 0;
        data[p + 11] = e[4] || 0;
    });
    return {data, count: events.length};
}
function out(n = 4096)
{
    return {left: new Float32Array(n), right: new Float32Array(n)};
}
function loadInto(ctx)
{
    for (const f
             of ['ayumi.js', 'EMU_CHIP_AY_JS.js', 'EMU_CHIP_AY_WASM.js', 'EMU_CHIP_AY.js',
                 'EMU_AUDIO_AY_STREAM.js'])
        vm.runInContext(fs.readFileSync(path.join(root, 'res', f), 'utf8'), ctx, {filename: f});
}
module.exports = {
    load,
    loadInto,
    batch,
    out,
    root
};
