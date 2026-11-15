const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

function build(t, html, files = {})
{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "retroapple-inline-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const script = path.join(root, ".github/scripts/inline.cjs");
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "../.github/scripts/inline.cjs"), script);
    fs.writeFileSync(path.join(root, "index.html"), html + "\n<!--" + "padding".repeat(200) + "-->");
    for (const [name, contents] of Object.entries(files))
    {
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    }
    const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return fs.readFileSync(path.join(root, "dist/RetroAppleJS.html"), "utf8");
}

test("excluded scripts cannot join surrounding fragments into a script tag", t =>
{
    const output = build(t, '<scr<script src="ExcludeFromDistro.js"></script>ipt>alert(1)</script>');
    assert.ok(!output.includes("<script>alert(1)</script>"));
    assert.ok(!output.includes('src="ExcludeFromDistro.js"'));
});

test("excluded stylesheets cannot join surrounding fragments into a script tag", t =>
{
    const output = build(t, '<scr<link rel="stylesheet" href="ExcludeFromDistro.css">ipt>alert(1)</script>');
    assert.ok(!output.includes("<script>alert(1)</script>"));
});

test("local includes retain script order, attributes and stylesheet content", t =>
{
    const output = build(t,
        '<link rel="stylesheet" href="res/main.css">\n<script defer src="res/one.js" id="one"></script>\n<script src="res/two.js"></script>',
        { "res/main.css": "body { color: blue; }", "res/one.js": 'var first = 1;', "res/two.js": 'var second = first + 1;' });
    assert.ok(output.includes("<style>\nbody { color: blue; }\n</style>"));
    assert.ok(output.includes('<script defer id="one">\nvar first = 1;\n</script>'));
    assert.ok(output.indexOf("var first = 1;") < output.indexOf("var second = first + 1;"));
    assert.ok(!output.includes('src="res/'));
});

test("remote and inline scripts are preserved without reading remote files", t =>
{
    const tags = '<script src="https://example.test/main.js"></script>\n<script src="//example.test/other.js"></script>\n<script src="data:text/javascript,void(0)"></script>\n<script>var inline = true;</script>';
    assert.ok(build(t, tags).startsWith(tags));
});

test("exclusions do not read missing assets and do not skip adjacent includes", t =>
{
    const output = build(t,
        '<script src="ExcludeFromDistro.js"></script><script src="res/one.js"></script><script src="res/ExcludeFromDistro.js"></script><script src="res/two.js"></script>',
        { "res/one.js": "var one = 1;", "res/two.js": "var two = 2;" });
    assert.ok(output.includes("var one = 1;"));
    assert.ok(output.includes("var two = 2;"));
    assert.ok(!output.includes('src="'));
});

test("step-trace scenario stylesheet is a static app include and bundled inline", t =>
{
    const root = path.resolve(__dirname, "..");
    const cssFile = "res/DBG_steptrace_scenario_layout.css";
    const scriptFile = "res/DBG_steptrace_scenario_layout.js";
    const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const css = fs.readFileSync(path.join(root, cssFile), "utf8");
    const js = fs.readFileSync(path.join(root, scriptFile), "utf8");
    const cssInclude = '<link rel="stylesheet" href="' + cssFile + '">';
    const scriptInclude = '<script type="text/javascript" src="' + scriptFile + '"></script>';

    assert.equal(index.split(cssInclude).length, 2, "the CSS must be included exactly once in index.html");
    assert.equal(index.split(scriptInclude).length, 2, "the JavaScript must be included exactly once in index.html");
    assert.doesNotMatch(js, /\bloadStyle\s*\(|\bcreateElement\s*\(\s*['"]link['"]\s*\)/,
        "built-in CSS must not be injected by JavaScript");

    const output = build(t, cssInclude + "\n" + scriptInclude,
        { [cssFile]: css, [scriptFile]: js });
    assert.ok(output.includes("<style>\n" + css + "\n</style>"), "the standalone must inline the stylesheet");
    assert.ok(output.includes(js), "the standalone must inline the debugger layout script");
    assert.ok(!output.includes(cssInclude), "the standalone must not fetch the CSS separately");
    assert.ok(!output.includes(scriptInclude), "the standalone must not fetch the layout script separately");
});
