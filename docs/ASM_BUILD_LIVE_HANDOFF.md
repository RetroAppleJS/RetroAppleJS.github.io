# Neutral assembler-build handoff for live STEP TRACE

## Purpose

The Debugger TEST BENCH and STEP TRACE are separate execution realms. The Debugger owns isolated `DBG_RAM` and an isolated CPU; STEP TRACE runs the live `apple2plus` CPU, mapped RAM, ROM and peripherals. A live STEP TRACE scenario must never copy executable bytes or symbols from the Debugger realm.

The handoff therefore has three ownership layers:

```text
Assembler -> ASM_BUILD -> consumer-owned target state
                       |- Debugger realm
                       |- legacy emulator paste staging
                       `- EMU_ASM_BUILD -> live Apple II RAM -> STB
```

`ASM_BUILD` is the only neutral assembler artifact. `EMU_ASM_BUILD` is the only service allowed to establish live assembler provenance for STEP TRACE. STB imports symbols only from `EMU_ASM_BUILD`.

## ASM_BUILD

`ASM_BUILD.current()` returns the most recent immutable successful assembler snapshot or `null`. A build has this shape:

```js
{
  schema: "RetroAppleJS.AssemblerBuild",
  version: 1,
  id: "asm-build-17",
  generation: 17,
  inputRevision: 42,
  createdAt: 1790320000123,
  sourceName: "INFLATE_ASM_CORE.S",
  entry: 0x0800,
  byteCount: 512,
  segments: [
    { address: 0x0800, bytes: Uint8Array([...]) }
  ],
  symbols: [
    { key: "INFLATE", name: "inflate", value: 0x0800, kind: "unknown" }
  ]
}
```

Assembler extraction prefers the current `asmCompileResult.bytes` records because they already contain explicit CPU PCs. Contiguous PCs are grouped into a segment; an ORG discontinuity or backward PC starts another segment. For compatibility, extraction may fall back to `oASM.get_code_len()`, `oASM.read_code(i)` and `oASM.code_pc[i]`. `oASM.symtab` / compiled `symtab` is copied into canonical case-insensitive symbol records. Assembler-private `.SCLOCAL_*` identifiers are not exported.

Segments remain in assembler emission order. Overlap is legal; later segments override earlier bytes when a target creates its final address image. Published byte arrays and symbol records are defensive copies; mutations to `oASM`, an extraction spec or a value returned by `ASM_BUILD.current()` cannot mutate the stored build.

A failed assembly does not replace the previous successful build.

Events:

- `retroapple:asm-build-published` with `{build}`
- `retroapple:asm-build-cleared` with `{previous, reason}`

## Source freshness

Assembler input has a monotonically increasing `inputRevision`. A build is fresh only when `build.inputRevision === ASM_INPUT.revision`. Source/editor changes may make the current build stale without destroying it. Transfer actions call `ASM_BUILD.ensureFresh()`; a stale or missing build triggers assembly, and the target is unchanged if that assembly fails.

## Consumers

The existing actions remain semantically distinct:

- **to debugger** targets only the isolated debugger realm.
- **to emulator** remains legacy monitor/paste staging and does not establish live provenance.
- **load live** is the direct transactional path into the running Apple II and is the only path that supplies STB build symbols.

No consumer automatically updates another consumer.

## EMU_ASM_BUILD

Public v1 surface:

```js
EMU_ASM_BUILD.load(build)
EMU_ASM_BUILD.current()
EMU_ASM_BUILD.status()
EMU_ASM_BUILD.clear(reason)
```

A successful load creates:

```js
{
  schema: "RetroAppleJS.LiveAssemblerBuild",
  version: 1,
  buildId: "asm-build-17",
  generation: 17,
  inputRevision: 42,
  sourceName: "INFLATE_ASM_CORE.S",
  entry: 0x0800,
  loadedAt: 1790320012345,
  byteCount: 512,
  ranges: [{start:0x0800,end:0x09ff,length:512}],
  symbols: [...]
}
```

Events:

- `retroapple:emu-build-loaded` with `{build}`
- `retroapple:emu-build-cleared` with `{previous, reason}`

### Transactional v1 main-RAM loader

This first implementation supports live Apple II main RAM `$0000-$BFFF`. `$C000-$CFFF` is rejected as I/O/slot space, and `$D000-$FFFF` is rejected until the passive mapped-memory provider contract is implemented.

The loader never sources bytes from `DBG_RAM` or `TB`. It snapshots live main RAM, applies the final segment image in host memory, installs it through a side-effect-free main-RAM import path, verifies all target bytes, and only then commits live provenance and emits `retroapple:emu-build-loaded`.

If writing or verification fails, the loader restores the exact pre-load RAM snapshot and verifies rollback. A successful rollback preserves the previous live build. If rollback cannot be verified, live provenance is cleared, STB symbols are cleared, `status().state` becomes `"invalid"`, and `EMU_BUILD_PARTIAL_WRITE` is thrown.

The future mapped-memory extension follows the already-defined passive provider/active mapping contract: a live address is transaction-loadable only when RD and WR resolve to the same registered passive backing store and offset. `$C000-$CFFF` remains categorically non-transactional.

## RetroAppleBuildError

All `EMU_ASM_BUILD.load()` failures escape as `RetroAppleBuildError` with stable fields:

```js
{
  name: "RetroAppleBuildError",
  code: "EMU_BUILD_VERIFY_FAILED",
  phase: "verify",
  message: "...",
  context: {...},
  cause: Error|null,
  rollback: {...}|null,
  memoryState: "unchanged"|"restored"|"indeterminate",
  liveBuildState: "unchanged"|"cleared",
  machineState: "restored"|"paused"
}
```

If any error other than `EMU_BUILD_PARTIAL_WRITE` escapes, live RAM is guaranteed either not to have been modified or to have been restored and verified byte-for-byte to its immediate pre-load state.

## STB ownership

STB owns a local copy of the symbols from `EMU_ASM_BUILD.current()` and listens for live-build loaded/cleared events. Public additions:

```js
STB.buildInfo()
STB.syncBuild()
STB.sym(name[, fallback])
STB.symbol(name)
STB.symbols()
```

`breakIf()`, `assert()`, address parsing and RAM helpers resolve symbols through this same local table. STB never queries `TB`, `DBG_TESTBENCH`, `DBG_RAM` or `oASM.symtab`.

Numeric STEP TRACE scenarios work with no assembler build. Symbolic lookup with no live build throws `STB_NO_LIVE_BUILD`; an absent name in a loaded build throws `STB_UNKNOWN_SYMBOL` from `STB.sym()` unless a fallback was supplied.

## UI state

The Assembler receives an explicit **load live** action. UI status is derived from service state, never inferred by a DOM observer:

- no build loaded live;
- current live build;
- source changed since the loaded build;
- newer successful build available;
- invalid live provenance after an unrecoverable partial write.

STEP TRACE may show the current live build, but its core depends only on `EMU_ASM_BUILD`, not on assembler/editor state.

## INFLATE validation workflow

The intended live test becomes:

1. load `INFLATE_ASM_CORE.S` in Assembler;
2. assemble it;
3. choose **load live**;
4. open STEP TRACE / STEP TRACE SCENARIO;
5. run `INFLATE_ASM_CORE_testbench.js`.

The harness may inject vectors, guards, zero-page pointers and a trampoline into live RAM, but it must not copy program bytes from TEST BENCH or require `window.TB`.