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


function appURLParser()
{
    const source = fs.readFileSync(path.join(__dirname, "../res/COM_MAIN.js"), "utf8");
    const start = source.indexOf("  this.URL =\n  {");
    const end = source.indexOf("\n  /////////////////////\n  // EVENT SEQUENCER", start);
    assert.ok(start >= 0 && end > start, "COM.URL parser definition must exist");
    return new Function(source.slice(start, end) + "\nreturn this.URL;").call({});
}

test("COM.URL.parse exposes the entry-point filename independently of query and hash", () =>
{
    const parser = appURLParser();
    for(const [address, name] of [
        ["file:///project/index.html", "index.html"],
        ["file:///project/dist/RetroAppleJS.html?sys=A2JP#tab1", "RetroAppleJS.html"],
        ["https://example.org/RetroAppleJS.html?boot=true", "RetroAppleJS.html"],
        ["https://example.org/project/", ""]
    ])
    {
        parser.parse(address);
        assert.equal(parser.name, name, address);
        assert.equal(parser.url, address.split(/[?#]/)[0], "preserve the original URL field");
    }
});

test("assembler manual fixes only standalone image URLs, even before emulator initialization", () =>
{
    const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    const start = source.indexOf("            function ASM_loadManualPane()");
    const end = source.indexOf("            function ASM_registerPopupRules()", start);
    assert.ok(start >= 0 && end > start, "assembler manual loader must exist");

    const makeLoader = new Function("ASM_el", "ASM_manualDocHTML", "oCOM", "document",
        source.slice(start, end) + "\nreturn ASM_loadManualPane;");

    const docs = {
        ASSEMBLER: '<img src="res/MOS_6502AD_300.png"><a href="res/guide.html">Guide</a>',
        "6502": "<img alt='interrupts' src='res/mcs6502-interrupt-ops_340.png'>"
            + '<img src="res/mcs6502-jsr-rts-ops_340.png">'
            + '<img src="https://example.org/remote.png">'
    };

    function render(address)
    {
        const manual = {innerHTML:"", textContent:""};
        const oCOM = {URL:appURLParser()};
        const document = {location:{toString:() => address}};
        const loader = makeLoader(
            id => id === "ASM_manual" ? manual : null,
            key => docs[key] || "",
            oCOM, document);
        loader();
        return {html:manual.innerHTML, filename:oCOM.URL.name};
    }

    const normal = render("file:///project/index.html");
    assert.equal(normal.filename, "index.html");
    assert.match(normal.html, /src="res\/MOS_6502AD_300\.png"/);
    assert.match(normal.html, /src='res\/mcs6502-interrupt-ops_340\.png'/);

    const standalone = render("file:///project/dist/RetroAppleJS.html?sys=A2JP#tab2");
    assert.equal(standalone.filename, "RetroAppleJS.html");
    assert.match(standalone.html, /src="\.\.\/res\/MOS_6502AD_300\.png"/);
    assert.match(standalone.html, /src='\.\.\/res\/mcs6502-interrupt-ops_340\.png'/);
    assert.match(standalone.html, /src="\.\.\/res\/mcs6502-jsr-rts-ops_340\.png"/);
    assert.match(standalone.html, /href="res\/guide\.html"/, "do not rewrite links");
    assert.match(standalone.html, /src="https:\/\/example\.org\/remote\.png"/, "do not rewrite remote images");
    assert.doesNotMatch(standalone.html, /src=["']res\/(?:MOS_|mcs6502)/);

    const hosted = render("https://example.org/RetroAppleJS.html");
    assert.match(hosted.html, /src="\.\.\/res\/MOS_6502AD_300\.png"/);
}
