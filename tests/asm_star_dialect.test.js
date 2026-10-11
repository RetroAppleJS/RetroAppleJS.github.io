const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function loadASM() {
  const source = fs.readFileSync(path.join(__dirname, "../res/ASM_core.js"), "utf8");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "ASM_core.js" });
  return context.ASM;
}

function assemble(dialect, source) {
  const ASM = loadASM();
  return new ASM({ dialect }).assemble(source);
}

function bytesOf(result) {
  return Array.from(result.bytes, record => record.val);
}

function errorsOf(result) {
  return Array.from(result.errors);
}

test("multi falls back to RetroAppleJS forced zero page when ACME star syntax is invalid", () => {
  const result = assemble("multi", `
MASK        EQU $2E
            ORG $6000
            LDA *MASK
            STA * MASK
            LDA *MASK,X
            LDX *MASK,Y
            LDA *(MASK+1)
            .END
`);

  assert.deepEqual(errorsOf(result), []);
  assert.deepEqual(bytesOf(result), [0xA5, 0x2E, 0x85, 0x2E, 0xB5, 0x2E, 0xB6, 0x2E, 0xA5, 0x2F]);
});

test("multi keeps valid ACME current-PC star expressions ahead of raJS fallback", () => {
  const result = assemble("multi", `
            ORG $6000
            LDA *+3
            LDA * * 0
            BNE *
            .END
`);

  assert.deepEqual(errorsOf(result), []);
  assert.deepEqual(bytesOf(result), [0xAD, 0x03, 0x60, 0xA5, 0x00, 0xD0, 0xFE]);
});

test("explicit raJS keeps historical star forced zero-page syntax", () => {
  const result = assemble("raJS", `
MASK        EQU $2E
            ORG $6000
            LDA *MASK
            .END
`);

  assert.deepEqual(errorsOf(result), []);
  assert.deepEqual(bytesOf(result), [0xA5, 0x2E]);
});

test("explicit ACME does not fall back to raJS forced zero-page syntax", () => {
  const result = assemble("ACME", `
MASK = $2E
*= $6000
LDA *MASK
`);

  const errors = errorsOf(result);
  assert.equal(errors.length, 1);
  assert.match(errors[0].err, /unexpected token: MASK/);
});
