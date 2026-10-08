# Port Script Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline.

**Goal:** Add the approved reusable console to the Serial Pro terminal.
**Architecture:** Independent buffered facade; worker RPC console; card-owned UI integration.
**Tech Stack:** Vanilla JavaScript, CSS, Web Workers, Node test runner, Playwright.
**Spec:** ../specs/2026-10-08-port-script-design.md

## Global Constraints
- Explicit includes in index.html; no new dependencies or UART timing changes.
- Facade buffer: 65536 bytes. Default wait timeout: 3000 ms.
- Stop terminates workers and cancels pending waits/subscriptions.

## Review Focus
- Device/card replacement must not reuse the previous endpoint.
- Synchronous reply during write must remain available to waitFor.
- Binary data and Apple high-bit ASCII must preserve all bits.
- Infinite loops and failed scripts must leave Run usable.
- Pending callbacks and timers must end at completion or Stop.

### Task 1: Buffered facade and SPSERIAL contract
**Files:** res/EMU_PORT_API.js, res/EMU_DEVICE_serialpro_line.js, tests/port_script.test.js
**Interfaces:** EMU_SCRIPT_PORT({write,subscribe,maxBuffer}) exposes write/read/available/flush/waitFor/onReceive/dispose.
- [x] Write tests for byte preservation, split matches, synchronous replies, timeout, abort, overflow and disposal; run and observe missing-feature failures.
- [x] Implement the facade and SerialProLine.getScriptAPI()/API; run the tests.

### Task 2: Worker console and split UI
**Files:** res/EMU_PORT_SCRIPT.js, res/EMU_PORT_SCRIPT.css, tests/port_script_browser.js
**Interfaces:** EMU_PORT_SCRIPT({container,lowerPane,port,api,storageKey}) exposes run/stop/clear/showAPI/destroy.
- [x] Add browser behavior checks for worker RPC, runaway Stop, callback cleanup, syntax/runtime errors, help, divider and persistence; run against missing component.
- [x] Implement the console, worker runtime and styles; run browser checks.

### Task 3: Serial Pro integration and delivery
**Files:** res/EMU_CARD_serialpro.js, index.html, docs/PORT_SCRIPT.md
- [x] Add real card/line tests and slot lifecycle browser checks before integration.
- [x] Attach the console above the existing terminal, route script TX display through the card and stop/dispose on relevant lifecycle events.
- [x] Run focused tests, archived upstream suite, syntax and patch application checks. Record pre-existing upstream failures separately.
- [x] Review the whole change and deliver the applicable patch.

Validation: see ../../PORT_SCRIPT_VALIDATION.md. Browser rendering could not run; DOM lifecycle and real worker execution were verified separately.
