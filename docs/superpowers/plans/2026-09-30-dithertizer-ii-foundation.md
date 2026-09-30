# Dithertizer II Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a software-compatible Computer Stations Dithertizer II slot peripheral foundation as `res/EMU_CARD_dithertizer.js` using canonical `PCODE:"DITHER"`.

**Architecture:** Model only the original DSCAN 4.2 software-visible contract: `$C0n0` latches the threshold on write and returns sync D7 on read while disabling capture; `$C0n8` enables capture. Capture is initially atomic and writes a thresholded 280x192 monochrome frame into the currently selected Apple II HGR page through the existing hardware write path.

**Tech Stack:** Browser JavaScript, RetroAppleJS SlotIO conventions, Node.js `node:test`/`vm` regression tests.

**Spec:** Conversation-derived DSCAN 4.2 reverse-engineering; no separate repository design spec.

## Global Constraints

- Canonical peripheral identity is `PCODE:"DITHER"`.
- No SlotROM, HostROM, IRQ, BUSY register, or private HGR page-select register.
- DSCAN page selection remains the Apple II `$C054/$C055` soft-switch state.
- Debugger/read-only SlotIO reads must not trigger or stop capture.
- Browser camera acquisition is outside this foundation; the card consumes an injected 280x192 luminance source.

## Review Focus

- HGR address interleave must produce 7,680 distinct visible-byte writes per frame.
- Page 1 and page 2 captures must land in `$2000` and `$4000` respectively.
- `$C0n0` read side effects must be suppressed under `ctx.bRO`.
- Sync D7 must provide the long-low/high/short-low/high sequence expected by DSCAN.
- Capture must use the normal hardware write path rather than modifying `vidram` directly.

---

### Task 1: Specify the DSCAN-visible card contract

**Files:**
- Create: `tests/dithertizer_foundation.test.js`

**Interfaces:**
- Consumes: `DithertizerII`, `action.SlotIO`, `readSlotIO`, `writeSlotIO`, `setCameraSource`.
- Produces: regression expectations for PCODE, threshold writes, sync reads, page selection and HGR writes.

- [ ] Write the failing Node tests before the production file exists.
- [ ] Run `node --test tests/dithertizer_foundation.test.js` and confirm failure because `res/EMU_CARD_dithertizer.js` is missing.

### Task 2: Implement the Dithertizer II card

**Files:**
- Create: `res/EMU_CARD_dithertizer.js`

**Interfaces:**
- Produces: `function DithertizerII()`, discovery instance `oEMU.component.IO.DithertizerII`, and `PCODE:"DITHER"` SlotIO callbacks.

- [ ] Implement `$C0n0` threshold/sync/stop semantics and `$C0n8` capture-start semantics.
- [ ] Implement 280x192 threshold capture with native Apple HGR addressing and page selection from video state.
- [ ] Use `ctx.hw.write`, `ctx.vid.hw.write`, or the existing Apple II hardware object fallback; never write `vidram` directly.
- [ ] Run `node --test tests/dithertizer_foundation.test.js` and require all tests to pass.

### Task 3: Review and publish

**Files:**
- Review: `res/EMU_CARD_dithertizer.js`
- Review: `tests/dithertizer_foundation.test.js`

- [ ] Compare the branch against `main` and verify no unrelated files changed.
- [ ] Open a pull request describing the DSCAN contract, atomic-capture scope, and deferred browser-camera/configuration integration.
