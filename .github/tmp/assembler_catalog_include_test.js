const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('            function ASM_loadCatalogSource(arg)');
const end = html.indexOf('            function ASM_sourceCatalogOpen()', start);
if (start < 0 || end < 0) throw new Error('ASM_loadCatalogSource block not found');
const source = html.slice(start, end);

function makeHarness(options = {}) {
  const calls = {
    source: [],
    include: [],
    close: [],
    status: []
  };

  const sandbox = {
    console: { warn() {}, log() {}, error() {} },
    ASM_OfflineSources: {},
    ASM_loadSourceText(name, text) { calls.source.push({name, text}); },
    ASM_addIncludeText(name, text, sourceName) {
      calls.include.push({name, text, sourceName});
      return {name, replaced:false};
    },
    ASM_clearOutputs() {},
    ASM_setStatus(text, kind) { calls.status.push({text, kind}); },
    oCOM: {
      CATALOG: {
        githubRawURL(arg) { return 'RAW:' + arg.path; },
        close(id) { calls.close.push(id); },
        isOffline() { return !!options.offline; },
        offlineData(_store, _arg, _url, _type) {
          return options.offlineText == null ? null : options.offlineText;
        }
      },
      GetHTTP(_url, _type, ok) {
        ok.call({status:200, responseText:options.onlineText || 'ONLINE'});
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return {sandbox, calls};
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testOnlineIncLoadsIncludeChip() {
  const {sandbox, calls} = makeHarness({onlineText:'INC TEXT'});
  sandbox.ASM_loadCatalogSource({
    name:'SERIALPRO_API.INC',
    path:'asm/UTIL/SERIALPRO_API_v1/SERIALPRO_API.INC',
    download_url:'https://example/SERIALPRO_API.INC'
  });

  assert(calls.include.length === 1, '.INC should be routed to ASM_addIncludeText');
  assert(calls.source.length === 0, '.INC must not replace the main source');
  assert(calls.include[0].name === 'SERIALPRO_API.INC', 'include lookup name should be basename');
  assert(calls.include[0].text === 'INC TEXT', 'include text should be preserved');
  assert(
    calls.include[0].sourceName === 'asm/UTIL/SERIALPRO_API_v1/SERIALPRO_API.INC',
    'catalog path should be preserved as sourceName'
  );
  assert(calls.close.length === 1 && calls.close[0] === 'sourceCat', 'catalog should close after include load');
}

function testOnlineSourceKeepsExistingBehavior() {
  const {sandbox, calls} = makeHarness({onlineText:'SOURCE TEXT'});
  sandbox.ASM_loadCatalogSource({
    name:'SERIALPRO.S',
    path:'asm/UTIL/SERIALPRO_API_v1/SERIALPRO.S',
    download_url:'https://example/SERIALPRO.S'
  });

  assert(calls.source.length === 1, '.S should still load into the main source pane');
  assert(calls.include.length === 0, '.S should not become an include chip');
  assert(calls.source[0].name === 'SERIALPRO.S', 'source basename should be preserved');
  assert(calls.source[0].text === 'SOURCE TEXT', 'source text should be preserved');
}

function testOfflineIncUsesSameIncludePath() {
  const {sandbox, calls} = makeHarness({offline:true, offlineText:'OFFLINE INC'});
  sandbox.ASM_loadCatalogSource({
    name:'SERIALPRO_API.INC',
    path:'asm/UTIL/SERIALPRO_API_v1/SERIALPRO_API.INC',
    download_url:'https://example/SERIALPRO_API.INC'
  });

  assert(calls.include.length === 1, 'offline .INC should be routed to ASM_addIncludeText');
  assert(calls.source.length === 0, 'offline .INC must not replace the main source');
  assert(calls.include[0].text === 'OFFLINE INC', 'offline include text should be preserved');
  assert(
    calls.include[0].sourceName === 'asm/UTIL/SERIALPRO_API_v1/SERIALPRO_API.INC',
    'offline catalog path should be preserved as sourceName'
  );
}

const tests = [
  testOnlineIncLoadsIncludeChip,
  testOnlineSourceKeepsExistingBehavior,
  testOfflineIncUsesSameIncludePath
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log('PASS', test.name);
  } catch (err) {
    failed++;
    console.error('FAIL', test.name + ':', err.message);
  }
}
if (failed) process.exit(1);
