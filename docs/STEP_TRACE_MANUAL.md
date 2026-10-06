# RetroAppleJS STEP TRACE — Real-Time Debugger Manual

> STEP TRACE is the attached real-time debugger for the live Apple II runtime. This manual describes live CPU execution, mapped-bus disassembly, instruction-row navigation, PC tracking, the 48-bit instruction counter, Step In/Over/Out, conditional breakpoints, branch-line rendering, symbol loading, live CPU registers, peripheral-ROM visibility, boot logging, optional closed-loop step skipping, and STEP TRACE SCENARIO for JavaScript actions at breakpoint boundaries.

For a first session, start with [opening the windows](#opening-step-trace-and-step-trace-scenario), then [Run and step controls](#3-run-and-step-controls) and [BREAK IF](#8-conditional-breakpoint--break-if). For automated checks and RAM injection, see [STEP TRACE SCENARIO](#23-step-trace-scenario).

## 1. What STEP TRACE is

**STEP TRACE** debugs the *real* Apple II runtime CPU. It does not run a second CPU and it does not use a private copy of RAM.

When STEP TRACE runs or steps code, it uses the live `apple2plus` CPU together with the currently mapped memory, peripherals, video timing, interrupts, Disk II controller, and I/O. Consequently:

- self-modifying code is visible;
- language-card and ROM mappings are respected;
- peripheral ROM can be traced;
- conditional breakpoints stop on real instruction boundaries;
- Disk II and other devices continue receiving normal emulated CPU/I/O timing while debugger-controlled execution is active.

Debugger reads deliberately mask **`$C000-$C0FF`**, because that page contains Apple II soft switches and slot I/O rather than ordinary instruction memory. The peripheral and expansion ROM window **`$C100-$CFFF`** remains visible to STEP TRACE.

### Opening STEP TRACE and STEP TRACE SCENARIO

The **CPU speed slidebar is tricky**: the same SYSTEM slider has three modes, and the debugger entry appears only at the zero endpoint. Click the **numeric speed label** beside the slider to cycle through these scales:

| SYSTEM CPU slider mode | Range | Purpose |
| --- | --- | --- |
| Default | **0→400%** | Normal speed control, in 20% steps. |
| Fine percentage scale | **0→100%** | Slower execution with 5% steps. |
| Factor scale | **x1→x72** | Faster JavaScript execution; x72 exposes the [WASM accelerator](WASM_ACCELERATOR.md). This scale also has a leftmost zero position. |

To open STEP TRACE:

1. Select the **Emulator** tab and locate **SYSTEM**.
2. Slide the **CPU speed to 0%**, all the way left, until the **bug icon** appears. In factor mode, the same zero endpoint may read `x0`.
3. Click the **bug icon itself** to open **STEP TRACE**. Clicking the number instead changes the slider's scale.
4. In the STEP TRACE top row, click the **`</>` code icon**, beside the main Run/Pause icon, to open the companion **STEP TRACE SCENARIO** window.

![SYSTEM CPU speed at 0%, exposing the bug icon used to open STEP TRACE](assets/STEP_TRACE_MANUAL-003.png)

*The bug icon is the debugger entrance. Moving the CPU slider to zero exposes it; clicking it opens the window.*

Setting the SYSTEM slider to zero stops normal SYSTEM execution. Once STEP TRACE is open, choose its own **1/10/100/1000 IPS** or **Max (SYSTEM)** mode and use its Run or step controls. The lower SYSTEM **fps** slider controls emulator processing frames, not the STEP TRACE instruction rate. Selecting zero does not reset the machine or change its RAM.

STEP TRACE belongs to the live **Emulator**. The separate **Debugger** tab offers a different debugging workspace; opening that tab is not how you open these live STEP TRACE windows.

---

## 2. STEP TRACE window at a glance

The following screenshot shows STEP TRACE on the left and STEP TRACE SCENARIO on the right:

![Live STEP TRACE listing and registers beside the STEP TRACE SCENARIO JavaScript editor, console, and RAM I/O controls](assets/STEP_TRACE_MANUAL-004.png)

| Area | What to use it for |
| --- | --- |
| STEP TRACE top row | Run/Pause, `</>` scenario access, Step In/Over/Out, boot-log capture and download, and close. |
| NAV | Browse instructions, copy the live PC/INS, toggle Track PC and the loop skipper, and select execution speed. |
| BREAK IF | Enter and arm the condition that stops execution or invokes a scenario callback. |
| LISTING / SYMBOLS | Configure listing columns and load source labels, EQU values, and comments. |
| Assembly listing and bottom register row | Read live instructions, branch guides, registers, and status flags. |
| SCENARIO header and JAVASCRIPT editor | Choose HALT/RUN action mode and define a persistent breakpoint callback. |
| SCENARIO console and RAM I/O | Read script output, inject bytes into live RAM, and inspect memory. |

In this screenshot, **SYMBOLS** reads `none`, **BREAK IF** is blank, and SCENARIO is in **HALT at breakpoint** mode. The visible script is therefore not yet registered as a RUN callback, and there is no armed condition to trigger it. The NAV PC/INS and bottom registers describe the live machine; they are not values controlled by the editor.

The exact visual appearance depends on browser and platform font rendering.

---

## 3. Run and step controls

| Control | Function | Keyboard |
|---|---|---|
| **Run / Pause / Breakpoint stop** | Starts or pauses CPU execution in the selected STEP TRACE speed mode. The same icon also indicates a conditional-breakpoint stop. | — |
| **`</>`** (`fa-code`) | Opens or hides STEP TRACE SCENARIO, beside the live trace window. Opening it does not arm a callback or start the CPU. | — |
| **Step In** (`fa-sign-in-alt`) | Executes one live instruction and refreshes the debugger. | **F11** |
| **Step Over** (`fa-paw`) | Steps over `JSR` and `BRK`; otherwise behaves like Step In. | **F10** |
| **Step Out** (`fa-sign-out-alt`) | Runs until the current routine returns, while tracking nested calls and interrupt nesting. | **Shift+F11** |
| **x** | Closes STEP TRACE and clears debugger-owned execution state. | — |

### Main execution pictogram

The first pictogram has three meaningful visual states:

| Pictogram | Meaning |
|---|---|
| `fa-play-circle` | ordinary idle/paused state |
| `fa-pause-circle` | continuous execution is running, **or** a manual Step In/Over/Out has just completed and the debugger is paused at the resulting boundary |
| `fa-parking` | execution stopped because the armed `BREAK IF` expression matched |

A successful breakpoint stop is therefore shown by the **parking** icon rather than by adding `BP IF` text to the NAV line.

### Step In

Step In executes exactly one live instruction. It is always shown literally, even when the closed-loop step skipper is enabled.

### Step Over

For an ordinary instruction, Step Over is equivalent to Step In.

For `JSR` or `BRK`, STEP TRACE temporarily runs the live CPU until the matching return boundary is reached. For a `JSR`, the expected return PC and original stack pointer are used to distinguish the intended return from unrelated control flow.

### Step Out

Step Out follows live execution until the current routine returns. It separately tracks:

- nested `JSR` / `RTS` depth;
- interrupt or `BRK` entry / `RTI` depth.

This prevents an interrupt occurring during Step Out from being mistaken for the requested routine return.

---

## 4. Execution speed

The speed selector offers:

| Mode | Behaviour |
|---|---|
| **1 IPS** | approximately 1 instruction per second |
| **10 IPS** | approximately 10 instructions per second |
| **100 IPS** | debugger-controlled execution in small live batches |
| **1000 IPS** | debugger-controlled execution in larger live batches |
| **Max (SYSTEM)** | execution belongs to the normal emulator scheduler |

`IPS` means **instructions per second**.

The fixed 1/10/100/1000 IPS modes pause the normal SYSTEM CPU owner and execute the *same live CPU* through debugger-controlled instruction boundaries.

Current batching is:

- 1 IPS: 1 instruction per batch;
- 10 IPS: 1 instruction per batch;
- 100 IPS: 5 instructions per batch;
- 1000 IPS: 50 instructions per batch.

A batch can return early at a debugger-significant boundary, for example when:

- execution enters or leaves peripheral/expansion ROM;
- a closed-loop skip reaches its exact exit boundary;
- an armed conditional breakpoint matches.

**Max (SYSTEM)** remains owned by the central emulator scheduler. STEP TRACE samples the running CPU for display, while the CPU's instruction-boundary breakpoint observer still operates at the CPU boundary itself.

---

## 5. NAV row: navigation, PC and instruction counter

The NAV row begins with:

```text
NAV  ↑  ↓   [PC $xxxx  INS $xxxxxxxxxxxx]
```

and is followed by the Track-PC icon, closed-loop-skipper icon, and speed selector. `PC` and `INS` are presented together in a **read-only input field**, so the live values can be selected and copied without making them editable. The NAV row is reserved for this copyable live CPU position; temporary run state and breakpoint diagnostics are shown beside `BREAK IF` instead.

### `↑` and `↓`

A **short press** moves the listing one decoded instruction row backward or forward.

A **press-and-hold for about 0.5 seconds** moves approximately one page.

Navigation is instruction-oriented, not byte-oriented.

Forward navigation follows each instruction's decoded length. Backward navigation first uses a previously proven predecessor boundary. If none is known, STEP TRACE tests possible 1-, 2-, and 3-byte 6502 predecessors and accepts the result only when exactly one candidate lands on the current address. If backward decoding is ambiguous, navigation stops instead of inventing an instruction alignment.

### `PC $xxxx`

`PC` is the live 16-bit program counter.

### `INS $xxxxxxxxxxxx`

`INS` is the CPU's **48-bit completed-opcode counter since reset**, displayed as 12 hexadecimal digits. For example:

```text
PC $C665  INS $0000000D5700
```

The counter is the same `ic` value exposed by `Cpu6502.watch()`. JavaScript can represent the complete 48-bit integer exactly.

At a clean instruction boundary, `INS` is the number of opcodes already completed. That makes the displayed value directly reusable in a breakpoint expression on a subsequent identical run:

```text
INS==$0000000D5700
```

The PC/INS read-only input remains live even when the listing viewport has been unlocked for manual browsing. Because it is a normal read-only input, either value—or the complete `PC … INS …` text—can be selected and copied.

---

## 6. Track PC

Track PC is controlled by a lock pictogram rather than a checkbox.

| Icon | Meaning |
|---|---|
| `<i class="fa fa-lock"></i>` | **Track PC enabled** — default |
| `<i class="fa fa-lock-open"></i>` | **Track PC disabled** — manual listing view |

When tracking is enabled, the listing follows the live PC.

When tracking is disabled, the listing remains at the manually selected code while the CPU may continue elsewhere. The live PC/INS indicator and CPU register row continue to update.

Manual navigation automatically unlocks the listing.

Keyboard controls:

- **F** — toggle Track PC;
- **Home** — enable Track PC and return the listing to the live execution area.

---

## 7. Closed-loop step skipper

The retweet pictogram controls the **closed-loop step skipper**:

```html
<i class="fa fa-retweet"></i>
```

The skipper is **disabled by default**. When disabled, every instruction follows the selected STEP TRACE IPS cadence.

### Enabled

The skipper changes execution pacing, not CPU semantics. STEP TRACE first observes normal live execution until a taken backward relative branch or backward `JMP` proves a closed loop. Once that loop is proven, subsequent instructions belonging to it execute immediately in bounded zero-delay batches rather than waiting for the selected IPS delay after every instruction.

The CPU still executes **every instruction and every cycle**. Mapped I/O, video timing, interrupts and conditional breakpoints therefore remain part of the real live execution path; only the wall-clock debugger pacing is accelerated while the proven loop is active.

For example, at **1 IPS**, a four-instruction loop does not consume four additional seconds after it has been proven. The loop instructions run consecutively in the background, and the next visible paced boundary is the exact instruction at which the loop exits. `INS` remains the architectural completed-opcode counter, so when the display updates it may jump by many instructions rather than by one.

The current logic is:

1. ordinary execution follows the selected IPS rate;
2. a taken backward branch or backward `JMP` proves a closed loop;
3. the proven loop then runs in cooperative batches with **no IPS waiting interval** between those batches;
4. intermediate loop instructions are not rendered;
5. at the exact first boundary outside the loop, PC, INS, listing position and registers are refreshed together;
6. normal selected-IPS pacing resumes from that visible exit boundary.

The skip batches are bounded and yield back to the browser between chunks. A genuinely endless keyboard or I/O wait loop therefore does not lock the UI; browser input can still arrive and allow the loop condition to change.

An arbitrary backward `RTS`, `RTI`, or return address is **not** treated as proof of a loop. Nested `JSR` / `RTS` activity entered from inside a proven loop remains eligible for skipping, while an uncertain escape or interrupt ends the proven-loop state rather than risk accelerating unrelated code.

A manually requested **Step In** always executes exactly one instruction and is never replaced by a loop skip. The skipper also applies to debugger-owned Step Over/Out runs once they encounter a proven loop.

### Max (SYSTEM)

The skipper is intended for debugger-owned paced execution:

- 1 IPS;
- 10 IPS;
- 100 IPS;
- 1000 IPS;
- cooperative Step Over;
- cooperative Step Out.

**Max (SYSTEM)** already runs under the emulator's normal scheduler and does not use the fixed-IPS closed-loop skipper.

---

## 8. Conditional breakpoint — `BREAK IF`

STEP TRACE has **one user-facing breakpoint mechanism**: `BREAK IF`.

There is no separate temporary address-breakpoint field and no separate `Run→` button. Address breakpoints are expressed naturally as conditions, and the normal Run/Pause control starts execution.

### Arm / Disarm model

Enter an expression and press **Arm once**. The same button changes to **Disarm**.

Arming does **not** start the CPU. Use the main Run/Pause control to continue execution.

If an armed expression is edited, STEP TRACE immediately disarms the old predicate. The button returns to **Arm**, and one click arms exactly the expression currently visible in the editor.

There is no `Rearm` state and there is no visible breakpoint `Clear` button.

In the normal **HALT at breakpoint** mode, a matching condition is one-shot/disarmed. The expression remains in the editor and can be armed again with one click. When STEP TRACE SCENARIO is armed in **RUN script at breakpoint** mode, the same `BREAK IF` condition remains active across successful callback returns so one persistent script can handle repeated matches.

### Address breakpoint

Use `PC` directly:

```text
PC==$C65E
```

`PC` is 16-bit. `$665E` and `$C65E` are therefore different addresses; if the listing shows `C65E:`, use `PC==$C65E`.

### Break on the instruction counter

`INS` is the same 48-bit completed-opcode count shown in NAV:

```text
INS==$0000000D5700
```

The full 12-digit hexadecimal counter can be selected and copied directly from the NAV read-only PC/INS input.

It can be combined with other terms:

```text
PC==$C65E && INS>=$0000000D5700
```

An INS-only condition is evaluated at every clean instruction boundary while armed. If the expression also contains a safe exact `PC==constant` term in an AND-only path, STEP TRACE can use the PC as an internal gate and evaluate the full expression only at that address.

### More examples

```text
PC==$C600 && A==$10
INS==$0000000D5700
PC==$C65E && INS>=$0000000D5700
M[$4000]==$80 && Z
X!=0 && !C
```

When the condition is false, execution continues and the condition remains armed. When it becomes true, STEP TRACE stops at the clean instruction boundary **before the next opcode at that boundary is fetched or executed**. The main execution pictogram becomes `fa-parking`.

### Buttons and keyboard

| Control | Function |
|---|---|
| **Arm** | compile and arm the expression without starting execution |
| **Disarm** | remove the active condition while retaining editor text |
| **F9** | toggle Arm / Disarm |
| **Shift+F9** | explicitly disarm the condition |

A blank expression cannot be armed. Invalid expressions are rejected. A runtime evaluation error stops visibly rather than silently ignoring the condition.

### Supported registers and counter

```text
A X Y SP P PC INS
```

Identifiers are case-insensitive.

### Supported status flags

```text
N V B D I Z C
```

Each flag evaluates to `0` or `1`.

### Memory expressions

Mapped 8-bit memory:

```text
M[$4000]
M8[$4000]
MEM[$4000]
MEM8[$4000]
```

Mapped 16-bit little-endian memory:

```text
M16[$24]
MEM16[$24]
```

Memory expressions use the debugger's mapped safe-read path. `$C000-$C0FF` is rejected because that range is deliberately masked from debugger reads.

### Number formats

```text
$FF
0xFF
255
$0000000D5700
```

The first two are hexadecimal; an unprefixed numeric literal is decimal. The 12-digit hexadecimal form is useful for `INS`.

### Operators

Comparison:

```text
=  ==  !=  <  <=  >  >=
```

Bitwise:

```text
&  |  ^
```

Logical:

```text
&&  ||  !
```

Parentheses are supported and recommended when an expression mixes several operator classes.

**48-bit counter note:** JavaScript bitwise operators are 32-bit. Equality and relational comparisons on `INS` use the full exact 48-bit value, but `INS & ...`, `INS | ...`, or `INS ^ ...` operate only on the low 32 bits. Use comparison operators for full-width instruction-counter conditions.

### Run/status and error diagnostics

Transient run state and textual breakpoint diagnostics are displayed **between the BREAK IF input and the Arm/Disarm button**. The condition input is flexible, so it automatically becomes narrower while a status message is present and expands again when the status clears.

For example, Step Over/Out can temporarily show:

```text
BREAK IF  [condition........]  OVER→$1234  [Disarm]
BREAK IF  [condition........]  OUT J1 I0    [Disarm]
```

Breakpoint errors use the same status position:

```text
BAD COND
COND ERR
BP!
BP unavailable
```

A **successful** `BREAK IF` hit does not add `BP IF` text. It is indicated by the main **parking** pictogram (`fa-parking`).

The condition can stop fixed-IPS execution, Max/SYSTEM execution, Step Over, or Step Out because the observer is evaluated by the live CPU at instruction boundaries.

---

## 9. LISTING column control

The listing format is controlled by a compact column specification such as:

```text
{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}
```

Each value is the character position at which the field begins.

Supported fields:

| Field | Meaning |
|---|---|
| `adr` | 16-bit instruction address |
| `code` | opcode and operand bytes |
| `lin` | Unicode branch/jump guide lines |
| `lbl` | source label at this instruction address |
| `ins` | instruction mnemonic |
| `opr` | operand |
| `com` | loaded instruction comment |

A field can be omitted by leaving it out of the column specification.

### Presets

The **default**, **wide**, and **compact** buttons replace the current column definition with predefined layouts.

The compact preset removes some source/decorative fields so more assembly text fits in the small realtime window.

### Unicode branch lines — `lin`

STEP TRACE reuses the assembler's branch-line renderer.

The `lin` column can therefore contain Unicode guides such as:

```text
│ ─ ┌ └ ▶
```

Guides are generated for supported relative branches and `JMP` control flow. Overlapping branches are allocated separate guide lanes.

A complete guide is drawn only when the relevant source and destination can be represented within the current visible instruction window. If one endpoint is outside the visible window, a complete connection may not be shown.

The `lin` field owns the complete interval up to the next configured column so the rightmost `▶` arrowhead is not intentionally cropped.

---

## 10. SYMBOLS controls

The SYMBOLS row contains:

```text
SYMBOLS  [load] [clear]  <status>
```

The `clear` here belongs to **symbol-table management**; it is unrelated to `BREAK IF`.

### `load`

Loads a symbol file for the realtime listing.

Preferred format:

```text
RetroAppleJS-ASM-symbols JSON
```

The loader recognises:

- `label` records;
- `equ` / symbol records;
- instruction comments.

The chooser accepts `.json`, `.symbols.json`, `.sym`, and `.txt`.

### `clear`

Removes all externally loaded symbol tables and refreshes the listing.

### Status

Examples:

```text
none
307 sym / 453 com
error
```

The tooltip lists every loaded file, its scope mode, and the total counts.

### Scope modes and multiple tables

`scopeMode` controls the meaning of a JSON table's `scope` ranges:

| `scopeMode` | Scope lookup | Names and comments |
| --- | --- | --- |
| omitted or `instruction-pc` | Address of the instruction being listed | Source labels/EQU names and instruction comments |
| `operand-address` | Address encoded in the operand, or resolved relative branch target | Operand names and comments attached to that address |

Missing `scope` means `$0000–$FFFF`. Explicit ranges are inclusive, with endpoints
between `$0000` and `$FFFF`. Existing JSON files and simple text maps retain
`instruction-pc` behavior. `scopeHex` is display metadata; `scope` controls lookup.

Tables in different modes coexist even when their numeric ranges are identical.
Disjoint tables in the same mode also coexist. If a newly loaded table overlaps
another table in its mode, the dialog identifies the mode and offers `override`,
`merge`, or cancellation. `override` removes the overlapping tables as whole
tables; `merge` retains both, with the newest matching name taking precedence
and matching comments retained in load order. Tables in the other mode are
unaffected. **clear** removes all externally loaded tables.

Programmatic callers can pass `"override"`, `"merge"`, or `"cancel"` as the
optional third argument to `Apple2Debug.loadSymbolsText(text, fileName, policy)`
to select overlap handling without a dialog.

PC-scoped names have priority over operand-scoped names. Operand comments are
collected independently, even when the source table supplies the operand name
or the hardware table supplies only a comment. Source comments appear first,
followed by operand comments separated with ` | `.

For a slot-4 Mockingboard, load
`asm/ROMS/PERIPHERALS/MOCKINGBOARD_SLOT4.symbols.json` alongside the program or
Monitor ROM symbol file. This table covers `$C400–$C40F` and `$C480–$C48F`:

```json
{
  "format": "RetroAppleJS-ASM-symbols",
  "version": 2,
  "scopeMode": "operand-address",
  "scope": [[50176, 50191], [50304, 50319]],
  "symbols": [
    {"name": "MB1_ORB", "type": "equ", "value": 50176},
    {"name": "COMMENT_MB1_ORB", "type": "comment", "targetType": "equ",
     "value": 50176, "comment": "Mockingboard VIA 1 Port B / AY1 control bus"}
  ]
}
```

Operand scope applies to `zpg`, `zpx`, `zpy`, `inx`, `iny`, `abs`, `abx`, `aby`,
`ind`, and `rel`. It does not translate immediate constants, implied operands,
or accumulator operands. Indexed and indirect modes use the encoded base or
pointer address, rather than dereferencing memory or adding the current X/Y
register. Hardware names require an exact address match; the existing source
symbol `+1` fallback remains available for PC tables.

The supplied comments describe registers. They do not decode the currently
latched AY register or the value written by each instruction.

---

## 11. Boot-log controls

The right side of the top row contains boot-log controls.

### Coffee icon

The coffee icon enables or disables boot logging.

Its opacity and tooltip indicate states such as:

```text
disabled
armed
logging
buffer full
complete
```

---

### Start condition

These two fields belong to **boot logging**, not BREAK IF. Capturing a log does not arm a breakpoint or start the CPU. Each field independently accepts `PC` or `INS` followed by a hexadecimal value. Values without a prefix, such as `$6000`, retain their PC meaning.

The first field sets an optional start condition.

- blank: logging can begin immediately;
- `PC $FD21`: logging waits until execution reaches that address;
- `INS $2C36E41`: logging waits for that completed-instruction count, using the same 48-bit counter shown in NAV.

The instruction at the start boundary is included. INS accepts up to 12 hexadecimal digits; PC accepts up to four. INS counts actual instructions, independently of compression in the capture buffer, and returns to zero on CPU reset.

### Stop condition

The second field sets an optional stop condition. Start and stop may use different prefixes, for example start `PC $FD21` and stop `INS $2C36E41`.

- blank: continue until the boot-log buffer is full;
- `PC $FF69`: stop before recording the instruction at that address;
- `INS $2C36E41`: stop before recording the instruction at that counter value.

Stopping logging or filling its buffer does not stop CPU execution. Capture and download are separate from the JavaScript scenario console.

### Download icon

The icon is disabled when the log is empty. During capture it blinks using the same animation as the assembler's Assemble icon, and downloading is disabled. Once capture finishes (or is manually disabled), a nonempty log enables a steady download icon. After the file is handed to the browser for download, capture is disabled, the bootlog buffers are released, and the icon returns to its disabled state. The conditions remain available for the next capture.

Downloads the current boot log as a `.txt` file containing **Base64-encoded activity records**, not a plain-text assembly listing. The generated timestamped file name looks like:

```text
apple2_bootlog_2026-09-12T18-30-00-000Z.txt
```

---

## 12. What loaded symbols affect

### `lbl`

A label whose address exactly matches an instruction appears in the `lbl` column.

### `opr`

Loaded labels and EQU symbols can replace numeric operands in applicable addressing modes.
Resolved operands show the symbol only, while retaining indexing and parentheses;
the numeric address is not repeated after the name. Unresolved operands keep
their normal hexadecimal form.

For example:

```text
LDA $C08C,X
```

can become symbol-aware when `$C08C` has a known symbol.

Operand lookup can also use the assembler's currently available symbol mapping when present.

### `com`

Instruction comments from an exported symbol file can populate the `com` field.

An operand-address table can also supply `comment` records, including
`targetType: "equ"`. For example, a source comment and hardware comment combine as:

```text
STA MB1_ORB    ; select sound chip | Mockingboard VIA 1 Port B / AY1 control bus
```

When an exported comment includes opcode bytes, STEP TRACE checks those bytes against the currently mapped live memory before showing the comment. This prevents stale source comments from remaining attached after self-modifying code changes an instruction.

---

## 13. Simple text symbol maps

Besides the canonical assembler JSON export, STEP TRACE accepts simple text maps such as:

```text
START=$0800
LOOP EQU $0812
$C600 DISK_BOOT
RESET $FFFC
```

Text maps primarily provide names and addresses. Use the canonical JSON export when labels, EQU symbols, and source comments all need to be retained.

---

## 14. Live listing interaction

### Current instruction

The row corresponding to the current PC is emphasised.

### Mouse

- **mouse wheel** — move one instruction row;
- **Shift + wheel** — move approximately one page.

### Touch

Vertical dragging over the listing navigates by decoded instruction rows.

### Manual browsing

Manual navigation disables Track PC. The viewport stays at the selected code while the live CPU may continue elsewhere.

The bytes in a manually parked view remain live and mapped-memory aware. Self-modifying code or a mapping change can therefore alter the displayed instruction without forcing the viewport back to the PC.

---

## 15. Keyboard shortcuts

| Key | Action |
|---|---|
| **↑** | previous instruction row |
| **↓** | next instruction row |
| **Page Up** | previous page |
| **Page Down** | next page |
| **Home** | re-enable Track PC and return to live execution |
| **F** | toggle Track PC |
| **F9** | toggle BREAK IF Arm / Disarm |
| **Shift+F9** | explicitly disarm BREAK IF |
| **F10** | Step Over |
| **F11** | Step In |
| **Shift+F11** | Step Out |

The listing receives these keyboard commands after it has focus. Clicking or tapping the listing gives it focus.

---

## 16. CPU register display

Below the listing, STEP TRACE shows the current processor registers:

```text
A=01 X=01 Y=00 SP=FF SR=ₙ0ᵥ0₋1ᵦ0_d0ᵢ1_z0_c0
```

Displayed values:

- accumulator `A`;
- index register `X`;
- index register `Y`;
- stack pointer `SP`;
- status register `SR`.

`PC` is deliberately omitted because it is already displayed in the NAV row. `INS` is likewise displayed in NAV rather than duplicated in the register row.

### Status-register flags

The status display follows 6502 flag order:

```text
N V - B D I Z C
```

where:

- `N` — Negative;
- `V` — Overflow;
- `-` — reserved/unused bit representation;
- `B` — Break;
- `D` — Decimal;
- `I` — Interrupt Disable;
- `Z` — Zero;
- `C` — Carry.

Each flag is followed by its current bit value.

The register row is refreshed from the live CPU state even if the PC itself has not changed.

---

## 17. Peripheral ROM tracing

STEP TRACE disassembles through the currently mapped CPU bus.

Debugger-visible address areas include:

```text
$0000-$BFFF
$C100-$CFFF
$D000-$FFFF
```

The intentionally masked range is:

```text
$C000-$C0FF
```

because it is the motherboard/slot soft-switch and I/O page.

Code in slot ROM and expansion ROM is therefore traceable. For example, Disk II firmware execution can appear in the realtime listing when that ROM is mapped into the CPU's slot-ROM window.

At fixed 1/10/100/1000 IPS speeds, high-speed batches yield when execution crosses into or out of `$C100-$CFFF`. This prevents a short ROM excursion from disappearing entirely inside a 5- or 50-instruction display batch.

In **Max (SYSTEM)** mode, the mapped ROM is still readable, but a very short excursion can occur between two display samples.

---

## 18. Self-modifying code and memory remapping

The live disassembler maintains a 64K address-indexed decode cache, but each cached instruction is validated against the bytes currently visible on the mapped CPU bus.

If an instruction changes:

- the stale decode is discarded;
- a predecessor relationship based on the old instruction length is invalidated;
- the instruction is redisassembled from the new bytes.

This supports:

- self-modifying RAM;
- language-card mapping changes;
- ROM/expansion mapping changes;
- code copied or patched at runtime.

STEP TRACE therefore does not depend on a static memory dump.

---

## 19. Instruction-boundary model

The realtime debugger treats the live CPU's current PC as a trusted instruction boundary.

Forward decoding is deterministic.

Backward decoding is inherently ambiguous on the 6502 because instructions have variable lengths. STEP TRACE therefore uses a conservative rule:

1. use a predecessor boundary learned from actual sequential execution when available;
2. otherwise test possible 1-, 2-, and 3-byte predecessors;
3. accept the result only when exactly one candidate ends at the current address.

Upward manual navigation can therefore stop even though lower addresses exist. That is intentional: stopping is safer than silently switching to a false instruction alignment.

---

## 20. Conditional-breakpoint semantics in detail

An armed `BREAK IF` predicate is checked only at a **clean instruction boundary**: the previous opcode has completed (`cycle_delay == 0`) and the next opcode has not yet been fetched.

### PC gating

When an AND-only expression contains an exact `PC==constant` term, STEP TRACE can use that address as an internal gate.

For example:

```text
PC==$C65E && A==$10
```

uses `$C65E` as the gate; the complete expression is evaluated only when that PC is reached.

The same applies to combinations such as:

```text
PC==$C65E && INS>=$0000000D5700
```

### Persistent conditions

A condition without a safe PC equality remains a persistent CPU-boundary condition and is evaluated at every clean instruction boundary while armed. Examples include:

```text
INS==$0000000D5700
M[$4000]==$80
X==0 && Z
```

### Hit behaviour

For each relevant boundary:

1. STEP TRACE evaluates the expression against live CPU state and mapped safe-read memory;
2. a false result leaves the condition armed and execution continues;
3. a true result is observed at the clean boundary **before the matching opcode executes**;
4. in ordinary **HALT at breakpoint** mode, the breakpoint becomes one-shot/disarmed and STEP TRACE stops at that boundary;
5. in **RUN script at breakpoint** mode, the registered scenario callback runs synchronously at that boundary; a successful return keeps the condition armed and lets the matching opcode execute next;
6. `haltAtBreakpoint()`, a callback exception, or callback re-entry converts that same match into the ordinary fail-safe halt;
7. an ordinary halt is shown by the parking icon.

The conditional observer is separate from the CPU's numeric execution trap used by other subsystems, so setting or clearing one cannot silently remove the other.

When BREAK IF is not armed, there is no active per-boundary breakpoint predicate from STEP TRACE.

---

## 21. Track PC versus manual view

Track PC controls the **listing viewport**, not CPU execution.

### Locked

```html
<i class="fa fa-lock"></i>
```

The listing follows the executing PC.

### Unlocked

```html
<i class="fa fa-lock-open"></i>
```

The listing remains where the user browses manually.

Meanwhile:

- the CPU can continue running;
- `PC $xxxx  INS $xxxxxxxxxxxx` remains live;
- the register row remains live;
- manually viewed bytes remain mapped-memory aware.

---

## 22. Suggested debugging workflows

### Inspect a routine instruction by instruction

1. choose **1 IPS** or pause execution;
2. keep Track PC locked;
3. use **F11** for Step In;
4. use **F10** for calls you do not want to enter;
5. use **Shift+F11** to leave the current routine.

### Skip through a repetitive delay or wait loop

1. choose a fixed IPS mode;
2. click the retweet icon to enable the closed-loop step skipper;
3. continue with the main Run control;
4. once a backward edge proves the loop, its instructions run without the selected IPS delay;
5. every CPU/I/O cycle still executes, and BREAK IF remains exact;
6. STEP TRACE refreshes PC, INS, registers and the listing at the exact loop exit, then resumes normal pacing.

### Break at an address

```text
PC==$C600
```

Press **Arm**, then use the main Run/Pause control.

### Break at an address only when a register has a value

```text
PC==$C600 && A==$10
```

Press **Arm**, then Run.

### Break at an exact instruction count

Select and copy the displayed NAV counter from the read-only PC/INS input, for example:

```text
INS $0000000D5700
```

and enter:

```text
INS==$0000000D5700
```

Press **Arm**, then Run. On an identical execution path, STEP TRACE stops at the clean boundary represented by that instruction count.

### Break no earlier than an instruction count, at a specific PC

```text
PC==$C65E && INS>=$0000000D5700
```

This uses the PC gate and the full 48-bit counter comparison together.

### Break when memory reaches a value

```text
M[$4000]==$80
```

This remains armed and is evaluated at every clean instruction boundary until it becomes true.

### Trace Disk II ROM

1. choose a fixed speed such as 100 or 1000 IPS;
2. keep Track PC enabled;
3. execute a DOS operation that enters Disk II firmware;
4. STEP TRACE yields at peripheral-ROM transitions so the ROM excursion becomes visible.

### Use source labels in the live trace

1. export symbols from the assembler;
2. select **SYMBOLS → load**;
3. choose the `.symbols.json` file;
4. use a listing layout containing `lbl`, `opr`, and optionally `com`.

### Run JavaScript at a breakpoint

Use the **`</>`** icon to open STEP TRACE SCENARIO, register a callback in **RUN script at breakpoint** mode, arm the desired **BREAK IF** condition, and start execution in STEP TRACE. The complete setup, helper API, and examples are described below.

---

## 23. STEP TRACE SCENARIO

STEP TRACE SCENARIO is a **breakpoint callback**, not a second CPU runner. The emulator remains the sole execution owner at the speed already selected in STEP TRACE. The existing `BREAK IF` expression remains the sole breakpoint engine.

The scenario window has two action modes:

| Control | Meaning |
|---|---|
| `<i class="fa fa-pause"></i>` **HALT at breakpoint** | Normal STEP TRACE behaviour: a matching `BREAK IF` stops before the matching opcode. This is the default. |
| `<i class="fa fa-sign-in-alt"></i>` **RUN script at breakpoint** | Evaluate the editor once, register its callback, run that callback synchronously at each matching boundary, then continue with the matching opcode unless the script requests a halt. |

Switching from HALT to RUN evaluates the editor **once**. The script must register exactly one persistent callback:

```js
onBreakpoint(function(bp) {
    // bp.A, bp.X, bp.Y, bp.SP, bp.P, bp.PC and bp.INS
    // describe the live clean instruction boundary.
});
```

Local variables captured by that callback persist across later breakpoint hits, so the script can keep its own test index or phase. Closing and reopening the scenario popup does not itself stop the registered callback; the mode is owned by the debugger rather than by popup visibility. Ctrl/Cmd+Enter while editing performs the same arm operation as selecting RUN; it does not start the emulator.

A successful callback return leaves the BREAK IF predicate active and execution continues through the matching opcode. To finish a scenario and remain stopped at the current match, call:

```js
haltAtBreakpoint();
```

A callback exception or re-entrant callback dispatch also fails safe to HALT at that same instruction boundary. Scenario callbacks are synchronous in this version; promises or asynchronous callbacks are not supported.

Scenario helpers read the **same symbol table loaded into STEP TRACE**. `sym(name)`, `symbol(name)`, `symbols()`, and symbolic identifiers used by `BREAK IF` therefore refer to one symbol universe. Use **SYMBOLS → load** before running a symbol-based scenario.

The scenario API is intentionally observational/manipulative rather than an execution scheduler. Useful helpers include `ram.read()`, `ram.write()`, `ram.read16()`, `ram.write16()`, `ram.fill()`, `cpu.state()`, `sym()`, `print()`, and `assert(boolean, description)`. The older scenario-owned `scenario()`, `cpu.start()`, `breakIf()`, `reset()`, and string-expression assertions are no longer part of this interface. Existing assembler **to emulator** and **to debugger** workflows remain separate and unchanged.

### Three controls cooperate

The word **RUN** in the scenario header means “run the callback when the breakpoint matches.” It does not start CPU execution. A working scenario needs all three of these controls:

| Control | Responsibility |
| --- | --- |
| **BREAK IF → Arm** in STEP TRACE | Choose and activate the matching instruction-boundary condition. |
| **SCENARIO → RUN script at breakpoint** | Evaluate the editor once and register its callback. |
| **STEP TRACE → Run** | Start the live CPU at the selected speed. |

If BREAK IF is not armed, the registered script receives no hits. If the CPU is paused, no new instructions advance. If the scenario remains in HALT mode, a match stops execution without calling the script.

The editor's top-level code runs once when arming. Only the function passed to `onBreakpoint()` runs on later matches. Put per-hit work inside that function and persistent counters outside it. Editing the text while RUN is active does **not** replace the registered callback: switch back to HALT, edit, then select RUN again. Ctrl/Cmd+Enter arms only while the scenario is not already in RUN mode.

### Window controls

| Control | What it does |
| --- | --- |
| **example** / lightbulb | Replace the editor text with the built-in three-hit example. It does not register the new text or start the CPU. |
| **HALT at breakpoint / RUN script at breakpoint** | Toggle between ordinary breakpoint halting and the registered JavaScript action. Switching back to HALT removes the callback but does not itself pause CPU execution or disarm BREAK IF. |
| **JAVASCRIPT** editor | Define the callback and persistent variables; Ctrl/Cmd+Enter performs the arm action when in HALT mode. |
| **CONSOLE / REPL** | Show `print()` output, PASS/FAIL messages, RAM dumps, and script errors. In the live scenario interface, console input directs you to the editor and HALT/RUN control; it is not a general JavaScript evaluator. |
| **clear** / trash icon | Clear console output. This does not clear RAM, BREAK IF, or the registered callback. |
| **RAM I/O** | Read or inject live mapped RAM using the fields and buttons described below. |
| **x** | Hide the scenario window. The registered callback remains active. Close STEP TRACE itself to clear its breakpoint action and condition. |

The screenshot retains labels such as **TB**, **RAM DBG_RAM**, **helpers TB.ram.***, and the old test-harness welcome text because the scenario window reuses that interface shell. For live scenarios, use **`ram`**, **`cpu`**, and **`STB`** as documented here. The legacy `TB` helpers belong to the separate test-bench workspace; its `DBG_RAM` is not the live Apple II RAM. A `ready` label or welcome message does not prove the callback and condition are armed.

### First working example: stop on the third hit

Choose an instruction address your program executes repeatedly. For example, if its loop reaches `$6000`, enter this condition in BREAK IF:

```text
PC==$6000
```

Paste this script into STEP TRACE SCENARIO:

```js
let matches = 0;

onBreakpoint(function(bp) {
    matches++;
    print('match', matches, 'PC', STB.hex(bp.PC, 4), 'INS', bp.INS);
    if (matches >= 3) haltAtBreakpoint();
});
```

1. Keep the CPU paused while setting up.
2. Select **RUN script at breakpoint** to register the script.
3. Click **Arm** beside BREAK IF.
4. Select a STEP TRACE speed and click its main **Run** control.
5. Read the console: the first two matches print a line and continue; the third prints a line and halts before the instruction at `$6000` executes.

Choose a PC your program actually reaches; opening SCENARIO does not load or jump to `$6000`. After the final halt, the callback is removed, the condition is disarmed, and STEP TRACE shows the parking icon. To repeat the example, register the editor again, arm BREAK IF again, and resume. Registering again recreates the `matches` variable.

The built-in example and screenshot use `hex(bp.PC,4)`. Use **`STB.hex(bp.PC,4)`** explicitly, as above: this revision does not expose a standalone scenario `hex` helper. Avoid using `STB.hex()` for the full 48-bit INS value, because it formats byte/word values; print `bp.INS` directly or use JavaScript `bp.INS.toString(16).toUpperCase().padStart(12, '0')`.

### Breakpoint context and CPU state

| Callback field | Meaning |
| --- | --- |
| `bp.A`, `bp.X`, `bp.Y`, `bp.SP`, `bp.P` | 8-bit registers at the matching boundary. |
| `bp.PC` | 16-bit address of the instruction about to execute. |
| `bp.INS` | Exact 48-bit count of completed instructions. |
| `bp.condition` | Text of the active BREAK IF condition. |
| `bp.hit` | Debugger hit count for the armed condition. Use your own closure counter if a scenario needs an independent test index. |

`cpu.state()` returns a fresh snapshot with lowercase fields: `pc`, `a`, `x`, `y`, `sp`, `p`, `cycle_delay`, and `ic`. The helper provides observation; it does not expose a CPU runner or register setter.

### Live RAM and symbol helpers

Helpers are available directly inside the editor and as properties of `STB` (also named `DBG_STEPTRACE_SCENARIO`). They read the live machine's current memory mapping.

| Helper | Result / use |
| --- | --- |
| `ram.read(address)` | Read one byte as a number. |
| `ram.read(address, length)` | Read a byte range as a `Uint8Array`; length `1` returns a number. |
| `ram.read16(address)` | Read a 16-bit little-endian value. |
| `ram.write(address, bytes)` / `ram.load(address, bytes)` | Write one byte or a sequence; return the number written. |
| `ram.write16(address, value)` | Write a 16-bit value, low byte first. |
| `ram.fill(address, length, value)` | Fill the specified range with a byte value. |
| `ram.dump(address, length, columns)` | Return a hexadecimal/ASCII dump; defaults to 16 bytes and 16 columns. Use `print()` to show it. |
| `sym(name[, fallback])` | Resolve a name from STEP TRACE's loaded symbols; throw for an unknown name unless a fallback was supplied. |
| `symbol(name)` | Return one symbol record, or `null`. |
| `symbols()` | Return the loaded symbol records. |
| `print(...)` | Append a line to the scenario console. |
| `assert(boolean, description)` | Print PASS or FAIL and return the boolean. A false result does **not** automatically halt execution. |
| `haltAtBreakpoint()` | Request a halt at the current matching boundary; valid only inside the registered callback. |

JavaScript uses normal number syntax: write `0x3000`, not `$3000`, as a numeric expression. RAM helpers also accept address strings such as `'$3000'`, `'0x3000'`, `'12288'`, `'inputPointer'`, or `'inputPointer+$02'`. Digits-only address strings are decimal. For symbolic strings, load the symbol export using STEP TRACE's **SYMBOLS → load** first.

Byte data can be a number, an array, a `Uint8Array`, or a text list such as `'00 01 A5 FF'`. Short unprefixed text tokens are interpreted as hexadecimal bytes: `'10'` is `$10`. Use numeric arrays when you want ordinary JavaScript decimal values, for example `[10, 20]`.

RAM helper reads reject `$C000–$C0FF` to avoid soft-switch side effects. Writes reject the broader **`$C000–$CFFF`** I/O/slot window. Writes elsewhere use the live write map and verify the value afterward; a write to protected ROM normally fails with **Write did not stick**. These helpers therefore work with an already writable mapped language-card bank, but they do not switch banks for you. A multi-byte operation can write earlier bytes before a later byte fails; it is not an atomic transaction.

### RAM I/O panel

The lower part of the scenario window offers a small manual memory tool:

1. Enter **address**, preferably with an explicit hex prefix such as `$3000` (or a loaded symbol).
2. To inspect memory, enter a decimal **length**, then click **read**. A hex/ASCII dump appears in the console.
3. To inject data, enter a byte list such as `00 01 02 03`, then click **inject**. The bytes are written sequentially from the address.

**Length applies to read. Inject writes the number of bytes in the data field**, irrespective of that length. Read prints the dump; it does not replace the injection text. These controls operate immediately, even when no callback is armed. Pause the live CPU before making manual memory changes when you need a reproducible state.

### Validate a result and stop on failure

For a program that publishes its result at `$3000`, choose a breakpoint at the instruction boundary after the result is ready, then register:

```js
onBreakpoint(function(bp) {
    const actual = ram.read(0x3000);
    print('result', actual, 'at', STB.hex(bp.PC, 4));
    if (!assert(actual === 0x42, 'result byte is $42')) {
        haltAtBreakpoint();
    }
});
```

This explicitly halts on a failed check. Passing checks continue and keep BREAK IF armed. To stop after every check, call `haltAtBreakpoint()` unconditionally at the end instead.

Use `assert()` with a JavaScript boolean, such as `actual === 0x42`; passing a BREAK IF expression string is an error. Callback exceptions halt at the matching boundary and report the error. Keep callbacks synchronous and short: do not use `async`, promises, timers, or CPU-driving loops to control subsequent execution. The ordinary emulator and STEP TRACE remain responsible for advancing the CPU.

### INFLATE repeated-validation example

`INFLATE_ASM_CORE.S` contains an explicit 6502 test loop:

```asm
inflate_test_loop
        JSR     inflate
inflate_test_done
        JMP     inflate_test_loop
```

A complete repeated test therefore uses the normal live machine rather than a JavaScript trampoline:

1. assemble `INFLATE_ASM_CORE.S` and put the assembled program into the Apple II with the normal emulator workflow;
2. load the assembler symbol export with **SYMBOLS → load**;
3. enter and arm:

   ```text
   PC==inflate_test_loop || PC==inflate_test_done
   ```

4. open STEP TRACE SCENARIO and place `INFLATE_ASM_CORE_testbench.js` in the editor;
5. select **RUN script at breakpoint**;
6. run the emulator normally at the desired STEP TRACE speed;
7. at `inflate_test_loop`, the callback injects the next compressed vector and pointer values;
8. the live 6502 executes `JSR inflate`;
9. at `inflate_test_done`, the callback checks output, pointers, guards and stack state;
10. the assembly `JMP` returns to `inflate_test_loop`, so the next vector is prepared;
11. after the final vector, the script calls `haltAtBreakpoint()` and STEP TRACE remains stopped.

The JavaScript script tracks progress and evidence; the 6502 program owns control flow and the emulator owns execution. No host-injected trampoline or separate CPU-driving loop is involved.

### Scenario troubleshooting

| Symptom | Check / action |
| --- | --- |
| Editor is visible but no output appears | Select RUN to register it, arm a nonblank BREAK IF condition, and start STEP TRACE execution. All three are required. |
| CPU stops on the first hit without running the script | SCENARIO is in HALT mode, or registration failed. Read the console and register a valid callback. |
| Edits have no effect | Return to HALT and register the revised editor text again. An already registered callback retains its original closure. |
| **exactly one onBreakpoint** | Register one function at editor top level; zero or multiple registrations are rejected. |
| **hex is not defined** | Use `STB.hex(value, 4)` in place of the unqualified `hex()` used by the built-in example. |
| **Unknown STEP TRACE symbol** | Load the matching assembler symbol export in STEP TRACE; the legacy test-bench symbol table is separate. |
| FAIL is printed but execution continues | `assert(false, ...)` reports failure. Call `haltAtBreakpoint()` explicitly if it should stop the CPU. |
| RAM write fails | Check the active map and permissions: I/O/slot writes are refused, and protected ROM is not writable. |
| Closing SCENARIO does not stop the script | Its x button hides the panel. Switch to HALT to remove the callback, or close STEP TRACE to clear the action and condition. |

---

## 24. Diagnostics available to developers

`Apple2Debug.liveState()` exposes debugger state including:

```text
pc
runMode
running
systemRunning
resumePct
followPC
showLoopSteps
skipClosedLoops
closedLoop
loopDisplayStats
viewTop
mappedBus
traceMaskedRange
tracePeripheralROM
pcInPeripheralROM
liveStepAPI
boundaryAction
conditionalBreakpoint
symbols
cacheHits
cacheMisses
domWrites
```

The `conditionalBreakpoint` diagnostic object contains:

```text
armed
hit
hits
checks
skips
condition
mode
address
editorCondition
lastResult
error
```

`mode` is `address` when a safe PC gate was extracted and `condition` for a persistent condition. `address` contains the gated PC or `null`.

The CPU instruction counter itself is available as `Cpu6502.watch().ic` and is displayed to the user as `INS`.

Closed-loop skipper statistics include:

```text
detected
hiddenInstructions
exits
```

These diagnostics are intended mainly for development and validation.

---

## 25. Current behavioural limits and deliberate safeguards

A few behaviours are intentionally conservative:

- `$C000-$C0FF` is masked from debugger reads so disassembly and breakpoint memory expressions do not probe soft-switch I/O.
- Exact peripheral-ROM transition rendering is guaranteed in debugger-owned fixed IPS modes; Max (SYSTEM) remains display-sampled.
- Exact closed-loop display suppression is a fixed-IPS / cooperative Over-Out feature, not a per-instruction display hook in Max (SYSTEM).
- Branch guides depend on the current visible listing window; a destination outside it may not receive a complete Unicode guide.
- Backward disassembly stops on unresolved ambiguity instead of inventing an instruction boundary.
- Source comments imported with opcode signatures disappear when the live bytes no longer match.
- Full-width `INS` comparisons are exact, but JavaScript bitwise operators are 32-bit; do not use bitwise operators to test the upper 16 bits of the 48-bit instruction counter.

These choices favour correctness of the live machine over making the debugger display appear artificially continuous.

---

## 26. Quick-reference card

| Control / gesture | Result |
|---|---|
| SYSTEM CPU slider → 0%, then bug icon | open live STEP TRACE; factor mode may display `x0` |
| Numeric SYSTEM speed label | cycle 0–400%, 0–100%, and x1–x72 slider modes |
| `</>` code icon | open/hide STEP TRACE SCENARIO |
| `fa-play-circle` | ordinary idle/paused state; click to run |
| `fa-pause-circle` | running, or paused immediately after manual Step In/Over/Out |
| `fa-parking` | stopped because BREAK IF matched |
| Step icon / F11 | Step In |
| Paw icon / F10 | Step Over |
| Exit icon / Shift+F11 | Step Out |
| `↑` / `↓` short press | previous / next instruction |
| `↑` / `↓` hold ~0.5 s | previous / next page |
| Mouse wheel | navigate one instruction row |
| Shift + wheel | navigate a page |
| Home | return to Track PC |
| F | toggle Track PC |
| `fa-lock` | Track PC enabled |
| `fa-lock-open` | Track PC disabled |
| `fa-retweet` bright | skipper enabled: accelerate proven loops without IPS delay and hide intermediate display |
| `fa-retweet` dim | skipper disabled: show and pace repeated loop instructions |
| read-only `PC $xxxx  INS $xxxxxxxxxxxx` input | live copyable CPU position/counter text |
| `PC $xxxx` | live 16-bit program counter |
| `INS $xxxxxxxxxxxx` | live 48-bit completed-opcode counter |
| BREAK IF status slot | transient Over/Out state and breakpoint diagnostics, between the expression and Arm/Disarm |
| BREAK IF | conditional breakpoint expression |
| Arm / F9 | arm the expression |
| Disarm / F9 | disarm the active expression |
| Shift+F9 | explicitly disarm BREAK IF |
| Main Run/Pause | start execution after arming, or pause execution |
| 1/10/100/1000 IPS | debugger-controlled live execution |
| Max (SYSTEM) | normal emulator scheduler |
| default/wide/compact | listing-column presets |
| SYMBOLS load | load labels/EQU/comments |
| SYMBOLS clear | remove loaded symbol table |
| Coffee icon | enable/disable boot log |
| Cloud-download icon | download boot log |
| SCENARIO HALT/RUN | remove/register the JavaScript breakpoint callback; does not start the CPU |
| Ctrl/Cmd+Enter in scenario editor | register editor text while in HALT mode |
| SCENARIO clear | clear console output only |
| SCENARIO RAM read / inject | inspect/inject live mapped RAM |
| SCENARIO x | hide the companion; registered callback stays active |
| x | close STEP TRACE |

---

## 27. Summary

STEP TRACE is a **live-system debugger**, not a detached disassembler.

Its central rules are:

- execute the real CPU;
- keep peripherals and timing alive;
- read the currently mapped bus;
- stop only on real instruction boundaries;
- expose both the live PC and an exact 48-bit completed-instruction counter;
- use one conditional breakpoint mechanism for address, register, flag, memory, and instruction-count conditions;
- avoid guessing backward instruction alignment;
- allow the user to follow execution or browse manually;
- preserve source-level conveniences such as symbols, comments, and branch lines without compromising live-memory correctness;
- make high-frequency loops easier to debug by optionally suppressing their *display*, never their execution.
