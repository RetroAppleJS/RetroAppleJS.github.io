const fs = require('fs');
const vm = require('vm');

function testUiState() {
  const html = fs.readFileSync('index.html','utf8');
  const begin = html.indexOf('/* ASM INCLUDE FILES BEGIN */');
  const end = html.indexOf('/* ASM INCLUDE FILES END */');
  if (begin < 0 || end < begin) throw new Error('include helper block not found');

  const declarations = `var ASM_includeFiles = []; var ASM_nextIncludeFileId = 1;\n`;
  const block = declarations + html.slice(begin, end);
  const sandbox = {
    console,
    ASM_el: () => null,
    ASM_clearOutputs: () => {},
    document: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(block, sandbox);

  let r = sandbox.ASM_addIncludeText('SERIALPRO_API.INC','ONE','SERIALPRO_API.INC');
  if (r.replaced || sandbox.ASM_includeFiles.length !== 1) throw new Error('first include add failed');

  r = sandbox.ASM_addIncludeText('serialpro_api.inc','TWO','serialpro_api.inc');
  if (!r.replaced || sandbox.ASM_includeFiles.length !== 1) throw new Error('case-insensitive replacement failed');
  if (sandbox.ASM_includeFiles[0].source !== 'TWO') throw new Error('replacement did not update source');

  sandbox.ASM_addIncludeText('KERMIT65_API.INC','THREE','KERMIT65_API.INC');
  if (sandbox.ASM_includeFiles.length !== 2) throw new Error('multiple include add failed');
  const map = sandbox.ASM_buildIncludeMap();
  if (Object.keys(map).length !== 2) throw new Error('include map size mismatch');

  const id = sandbox.ASM_includeFiles[0].id;
  if (!sandbox.ASM_removeIncludeFile(id) || sandbox.ASM_includeFiles.length !== 1)
    throw new Error('include removal failed');

  console.log('Include state logic: PASS');
}

function testRealIncludeResolution() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('res/ASM_core.js','utf8'), sandbox);
  if (typeof sandbox.ASM !== 'function') throw new Error('ASM constructor did not load');

  const mainName = 'asm/UTIL/SERIALPRO_API_v1/SERIALPRO.S';
  const incName = 'SERIALPRO_API.INC';
  const main = fs.readFileSync(mainName,'utf8');
  const incPath = 'asm/UTIL/SERIALPRO_API_v1/' + incName;
  const inc = fs.readFileSync(incPath,'utf8');
  const asm = new sandbox.ASM({
    sourceName: mainName,
    includes: { [incName]: { source: inc, sourceName: incPath } }
  });

  const expanded = asm.expandSCIncludes(main, mainName);
  const errors = expanded.filter(r => r.err).map(r => r.err);
  if (errors.length) throw new Error(errors.join('; '));
  if (!expanded.some(r => /SP_API_MAJOR/.test(r.source || '')))
    throw new Error('Serial Pro API include was not expanded');

  console.log('ASM_core real .IN resolution: PASS');
}

testUiState();
testRealIncludeResolution();
