# RetroAppleJS STEP TRACE — Real-Time Debugger Manual

> Applies to the current real-time STEP TRACE implementation including live CPU execution, mapped-bus disassembly, instruction-row navigation, Step Over/Out, temporary and conditional breakpoints, branch-line rendering, symbol loading, live registers, peripheral-ROM visibility, and optional closed-loop display suppression.

## 1. What STEP TRACE is

**STEP TRACE** is an attached debugger for the *live* Apple II runtime.

It does **not** run a second CPU or use a private copy of RAM. When STEP TRACE runs or steps code, it uses the real `apple2plus` CPU together with the currently mapped memory, peripherals, timers, Disk II controller, video timing, interrupts, and I/O.

This has several consequences:

- self-modifying code is visible;
- language-card and ROM mappings are respected;
- peripheral ROM can be traced;
- breakpoints stop on real instruction boundaries;
- Disk II and other devices continue receiving their normal emulated CPU/I/O timing while the debugger is running.

The only intentionally masked debugger-read range is **`$C000-$C0FF`**, because this page contains motherboard and slot soft-switch I/O rather than ordinary instruction ROM. The peripheral and expansion ROM range **`$C100-$CFFF`** remains available to STEP TRACE.

---

## 2. STEP TRACE window at a glance

The interface is organised approximately as follows:

```text
STEP TRACE  [Run/Pause] [Step] [Over] [Out]      [Boot log controls] [x]

NAV  ↑  ↓   PC $xxxx   [Loop display] [Track PC]   BREAK [$....] [speed]

IF   [conditional expression........................] [Arm] [Run→] [Clear]

LISTING Columns {adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}

[default] [wide] [compact]     SYMBOLS [load] [clear]  <status>

<20-row live disassembly listing>

A=.. X=.. Y=.. SP=.. SR=n.v.-.b.d.i.z.c.
```

The exact visual shape depends on browser, platform, font rendering, and the currently selected listing-column preset.

---

## 3. Step controls

| Control | Function | Keyboard |
|---|---|---|
| **Play / Pause** | Starts or pauses CPU execution in the currently selected STEP TRACE speed mode. The icon changes between play and pause. | — |
| **Step In** (`fa-sign-in-alt`) | Executes exactly one live instruction-boundary event and then refreshes the debugger. | **F11** |
| **Step Over** (`fa-paw`) | For ordinary instructions, behaves like Step In. For `JSR` and `BRK`, runs until the matching return boundary is reached. | **F10** |
| **Step Out** (`fa-sign-out-alt`) | Runs until the current routine returns, while tracking nested subroutine calls and interrupt nesting. | **Shift+F11** |
| **x** | Closes STEP TRACE. Debugger-owned runs and temporary execution traps are cleared so an invisible debugger cannot later stop the emulator. | — |

### Step In

Step In always performs a literal single instruction step. Even when closed-loop display suppression is enabled, a manually requested Step In remains visible.

### Step Over

Step Over treats:

- `JSR` as a call;
- `BRK` as a call-like boundary;
- all other opcodes as a normal single-step operation.

For a call-like instruction, STEP TRACE runs the live machine until the expected return PC is reached with the original stack pointer restored.

### Step Out

Step Out does not simply guess a return address from the current stack. Instead it follows live control flow and keeps separate nesting counts for:

- `JSR` / `RTS`;
- interrupt or `BRK` entry / `RTI`.

This prevents an interrupt occurring during Step Out from being mistaken for the requested subroutine return.

---

## 4. Execution speed

The speed selector offers:

| Mode | Behaviour |
|---|---|
| **1 IPS** | Approximately 1 instruction per second |
| **10 IPS** | Approximately 10 instructions per second |
| **100 IPS** | Executes in small live batches |
| **1000 IPS** | Executes in larger live batches |
| **Max (SYSTEM)** | Returns execution ownership to the normal emulator scheduler |

`IPS` means **instructions per second**.

The fixed 1/10/100/1000 IPS modes temporarily pause the normal SYSTEM CPU owner and execute the *same live CPU* through debugger-controlled instruction boundaries.

Internally, the higher fixed speeds use batching for performance:

- 1 IPS: 1 instruction per batch;
- 10 IPS: 1 instruction per batch;
- 100 IPS: 5 instructions per batch;
- 1000 IPS: 50 instructions per batch.

The debugger may return from a batch early when an important live boundary needs to be displayed, such as entering/leaving peripheral ROM, leaving a hidden loop, or hitting a breakpoint.

**Max (SYSTEM)** is different: the normal emulator scheduler owns execution and STEP TRACE samples that running CPU once per scheduler slice.

---

## 5. Navigation controls

The navigation row begins with:

```text
NAV  ↑  ↓   PC $xxxx
```

### `↑` and `↓`

A **short press** moves the listing exactly one decoded instruction row backward or forward.

A **press-and-hold for about 0.5 seconds** moves one full page.

Navigation is instruction-oriented, not byte-oriented.

Forward navigation follows the decoded instruction length. Backward navigation uses a previously proven instruction predecessor where possible. If no predecessor is known, the debugger tests the possible 1-, 2-, and 3-byte 6502 predecessors and accepts the result only if exactly one candidate is valid. If backward decoding is ambiguous, navigation stops rather than inventing an alignment.

### `PC $xxxx`

This is the **live program counter**.

The PC indicator continues to represent the executing CPU even when the listing itself has been unlocked for manual browsing.

---

## 6. Track-PC control

The Track-PC checkbox has been replaced by a compact icon.

| Icon | Meaning |
|---|---|
| `<i class="fa fa-lock"></i>` | **Track PC enabled** — default |
| `<i class="fa fa-lock-open"></i>` | **Track PC disabled** — manual listing view |

When tracking is enabled, the listing follows the live PC.

When tracking is disabled, the listing remains at the manually selected instruction area while execution may continue elsewhere. The live `PC $xxxx` indicator and CPU register state still update.

Manual navigation automatically unlocks the listing.

Useful keyboard controls:

- **F** — toggle Track PC;
- **Home** — enable Track PC and return the listing to the live execution position.

---

## 7. Closed-loop display control

The adjacent retweet icon controls whether repeated closed loops are visually traced:

```html
<i class="fa fa-retweet"></i>
```

It is **enabled by default**.

### Enabled

STEP TRACE displays its normal sequence of execution updates, including execution occurring repeatedly inside a loop.

### Disabled

The CPU still executes **every instruction and every cycle**. Nothing is skipped in emulation.

The difference is purely visual:

1. execution proceeds normally;
2. STEP TRACE dynamically recognises a closed loop when actual execution takes a backward relative branch or backward `JMP`;
3. after the loop is proven, repeated loop execution is no longer rendered;
4. the listing, displayed PC and live register row remain visually frozen during the hidden repetition;
5. when execution leaves the loop, STEP TRACE yields at the first live instruction boundary outside it and resumes normal display;
6. the same process is repeated when another closed loop is encountered.

The loop detector intentionally does **not** classify an arbitrary backward `RTS`, `RTI`, or return address as a loop.

Nested `JSR` / `RTS` activity reached from inside a recognised loop is considered part of that hidden loop iteration. An unproven escape or interrupt ends suppression rather than risk hiding unrelated code indefinitely.

### Important limitation

Exact closed-loop display suppression is available in the debugger-owned execution paths:

- 1 IPS;
- 10 IPS;
- 100 IPS;
- 1000 IPS;
- cooperative Step Over;
- cooperative Step Out.

In **Max (SYSTEM)** mode, STEP TRACE receives scheduler samples rather than every individual instruction boundary, so exact loop suppression is not applied there.

---

## 8. BREAK — temporary execution breakpoint

The `BREAK` field accepts a 16-bit hexadecimal address, for example:

```text
$C600
$FD1D
0800
```

The temporary breakpoint is a **one-shot live execution breakpoint**.

It uses the CPU's instruction-boundary execution trap, so the machine stops **before the target opcode is fetched or executed**.

### Quick ways to select a breakpoint address

- enter the address in the `BREAK` field;
- **single-click a visible listing row** to copy that instruction address into the breakpoint field;
- **double-click a listing row** to arm the address and immediately run to it.

### Breakpoint buttons

| Button | Function |
|---|---|
| **Arm** | Arms the current breakpoint without starting execution |
| **Rearm** | Appears when an armed breakpoint's condition has been edited; explicitly installs the edited condition |
| **Run→** | Arms the breakpoint and continues execution |
| **Clear** | Removes the temporary execution breakpoint |

Keyboard:

- **F9** — arm the current breakpoint;
- **Shift+F9** — clear the breakpoint.

A breakpoint can interrupt:

- fixed-IPS execution;
- Max/SYSTEM execution;
- Step Over;
- Step Out.

Because it is evaluated on the live CPU instruction boundary, it cannot stop halfway through an instruction.

---

## 9. Conditional breakpoint — `IF`

The optional `IF` field adds a condition to the temporary execution breakpoint.

A blank `IF` field means an unconditional breakpoint.

Example:

```text
A==$10 && M[$4000]==$80
```

The condition is evaluated when the target breakpoint address is reached, **before that target instruction executes**.

If the condition is false:

- execution continues normally;
- the same breakpoint is rearmed;
- STEP TRACE waits for the next visit to the target address.

If the condition is true, STEP TRACE stops at that instruction boundary.

### Supported CPU registers

```text
A
X
Y
SP
P
PC
```

### Supported status flags

```text
N V B D I Z C
```

Each evaluates to `0` or `1`.

Examples:

```text
Z
!C
X!=0 && Z
```

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

Memory expressions use the same safe mapped-bus view as the debugger. Reads into the intentionally masked `$C000-$C0FF` soft-switch page are rejected.

### Number formats

```text
$FF
0xFF
255
```

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

Parentheses are supported.

Examples:

```text
A==$10
X!=0 && Z
M[$4000]==$80
MEM16[$24]==$0400
PC==$C600 && !C
(M[$20]&$80) && A>=16
```

Invalid conditions are rejected before arming. A runtime evaluation error stops visibly at the breakpoint rather than silently ignoring the problem.

---

## 10. Breakpoint and run status text

The live status area can append debugger state to the `PC $xxxx` display.

Typical examples:

```text
PC $C600  OVER→$1234
PC $C600  OUT J1 I0
PC $C600  BP→$FD1D
PC $C600  BP→$FD1D IF
PC $FD1D  BP@$FD1D
PC $FD1D  BP@$FD1D IF✓
PC $FD1D  BP!$FD1D
```

Common error/status messages include:

```text
BAD BP
BAD COND
COND ERR
```

---

## 11. LISTING column control

The listing format is controlled by a compact column specification such as:

```text
{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}
```

Each value is the character position at which that field begins.

Supported fields are:

| Field | Meaning |
|---|---|
| `adr` | 16-bit instruction address |
| `code` | opcode and operand bytes |
| `lin` | Unicode branch/jump guide lines |
| `lbl` | loaded source label at this instruction address |
| `ins` | instruction mnemonic |
| `opr` | operand |
| `com` | loaded instruction comment |

A field can effectively be omitted by leaving it out of the column specification.

### Presets

The buttons **default**, **wide**, and **compact** replace the current column definition with predefined layouts.

The compact preset omits some decorative/source-oriented fields so more assembly text fits into the small realtime window.

---

## 12. Unicode branch lines — `lin`

The realtime tracer reuses the assembler's branch-line renderer.

The `lin` column can therefore show Unicode control-flow guides using characters such as:

```text
│ ─ ┌ └ ▶
```

These guides are produced for supported relative branches and `JMP` control flow.

When several branches overlap, separate guide lanes are allocated.

A branch line is shown only when the relevant source and destination can be represented inside the current visible instruction window. A branch whose other endpoint lies outside the visible window may therefore have no complete guide.

The `lin` field owns its complete configured width up to the following column, so the rightmost `▶` arrowhead is not intentionally cropped.

---

## 13. SYMBOLS controls

The SYMBOLS area contains:

```text
SYMBOLS  [load] [clear]  <status>
```

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

The file chooser also accepts `.json`, `.symbols.json`, `.sym`, and `.txt`.

### `clear`

Removes the externally loaded symbol table and refreshes the live listing.

### Status

Examples:

```text
none
307 sym / 453 com
error
```

The tooltip gives more detail, including file name and counts.

---

## 14. What loaded symbols affect

### `lbl`

A label located exactly at an instruction address is displayed in the `lbl` column.

### `opr`

Loaded labels and EQU symbols can replace numeric operands in applicable addressing modes.

For example:

```text
LDA $C08C,X
```

may become symbol-aware if `$C08C` has a known symbol.

Operand lookup can also use the assembler's currently available symbol mapping when present.

### `com`

Instruction comments from the exported symbol file can populate the `com` field.

For comments exported together with opcode bytes, STEP TRACE checks those bytes against the currently mapped live memory before displaying the comment. This prevents a stale source comment from remaining attached after self-modifying code changes the instruction.

---

## 15. Simple text symbol maps

In addition to the canonical assembler JSON export, STEP TRACE accepts simple text maps such as:

```text
START=$0800
LOOP EQU $0812
$C600 DISK_BOOT
RESET $FFFC
```

These maps primarily provide symbol names and addresses. The canonical JSON export is preferred when labels, EQU symbols, and source comments should all be retained.

---

## 16. Live listing interaction

### Current instruction

The row corresponding to the current PC is emphasised.

### Breakpoint row

An armed or hit breakpoint row receives a compact visual marker at the left edge.

### Mouse

- **single click on a row** — copy that row's address to the BREAK field;
- **double click on a row** — Run to here;
- **mouse wheel** — move one instruction row;
- **Shift + wheel** — move approximately one page.

### Touch

Dragging vertically over the listing navigates by decoded instruction rows.

### Manual browsing

As soon as you navigate manually, Track PC is disabled. The listing viewport remains at the selected code while the live CPU may continue running.

The bytes in a manually parked view remain live: they are revalidated against currently mapped memory, so self-modifying code or a mapping change can alter the displayed instruction without forcing the viewport back to the PC.

---

## 17. Keyboard shortcuts

| Key | Action |
|---|---|
| **↑** | Previous instruction row |
| **↓** | Next instruction row |
| **Page Up** | Previous page |
| **Page Down** | Next page |
| **Home** | Re-enable Track PC and return to the live execution area |
| **F** | Toggle Track PC |
| **F9** | Arm temporary breakpoint |
| **Shift+F9** | Clear temporary breakpoint |
| **F10** | Step Over |
| **F11** | Step In |
| **Shift+F11** | Step Out |

The listing receives keyboard commands after it has focus. Clicking/tapping the listing gives it focus.

---

## 18. CPU register display

Below the listing, STEP TRACE shows the current processor registers:

```text
A=01 X=01 Y=00 SP=FF SR=ₙ0ᵥ0₋1ᵦ0_d0ᵢ1_z0_c0
```

Displayed registers:

- accumulator `A`;
- index register `X`;
- index register `Y`;
- stack pointer `SP`;
- status register `SR`.

`PC` is deliberately not repeated because the current program counter is already displayed in the navigation/status row.

### Status-register flags

The status display follows the 6502 flag order:

```text
N V - B D I Z C
```

where:

- `N` — Negative;
- `V` — Overflow;
- `-` — unused/reserved status bit representation;
- `B` — Break;
- `D` — Decimal;
- `I` — Interrupt Disable;
- `Z` — Zero;
- `C` — Carry.

Each flag is followed by its current bit value.

The register row is updated from the live CPU state even when the PC itself has not changed.

---

## 19. Boot-log controls

The right side of the top row contains the boot-log controls.

### Coffee icon

The coffee icon enables or disables boot logging.

Its opacity and tooltip indicate the current state, which may include:

```text
disabled
armed
logging
buffer full
complete
```

### Start address

The first `$....` field sets an optional boot-log start address.

- blank: begin logging immediately;
- address: arm logging until that execution address is reached.

### Stop address

The second `$....` field sets an optional stop address.

- blank: continue until the boot-log buffer is full;
- address: stop before that execution address.

### Download icon

Downloads the boot log as a text file.

A generated name is used, for example:

```text
apple2_bootlog_2026-09-11T21-45-00-000Z.txt
```

---

## 20. Peripheral ROM tracing

STEP TRACE uses the currently mapped CPU bus for disassembly.

Debugger-visible areas include:

```text
$0000-$BFFF
$C100-$CFFF
$D000-$FFFF
```

The debugger intentionally masks:

```text
$C000-$C0FF
```

because this is the Apple II soft-switch / slot-I/O page.

This means code in slot ROM and expansion ROM is traceable. For example, when a Disk II controller ROM is mapped into a slot page, execution through that ROM can be shown in the realtime listing.

At fixed 1/10/100/1000 IPS speeds, high-speed batches yield when execution crosses into or out of the `$C100-$CFFF` peripheral/expansion-ROM region. This makes short ROM excursions visible even when 1000 IPS would otherwise execute dozens of instructions between screen updates.

In **Max (SYSTEM)** mode, the debugger still reads this address space correctly, but an extremely brief ROM excursion can occur between two scheduler samples.

---

## 21. Self-modifying code and memory remapping

The live disassembler maintains a 64K address-indexed decode cache, but cached instructions are validated against the bytes currently visible on the mapped CPU bus.

If an instruction changes:

- the stale decode is discarded;
- a predecessor relationship based on the old instruction length is invalidated;
- the instruction is redisassembled from the new bytes.

This allows STEP TRACE to cope with:

- self-modifying RAM;
- language-card mapping changes;
- ROM/expansion mapping changes;
- code copied or patched at runtime.

The debugger does not depend on a static memory dump.

---

## 22. Instruction-boundary model

The realtime debugger treats the live CPU's current PC as a trusted instruction boundary.

Forward decoding is deterministic.

Backward decoding is inherently ambiguous on the 6502 because instructions have variable lengths. STEP TRACE therefore avoids guessing:

1. use a predecessor boundary learned from actual sequential execution if available;
2. otherwise inspect possible 1-, 2-, and 3-byte predecessors;
3. accept the result only when exactly one candidate ends at the current address.

This is why upward manual navigation may occasionally stop even though lower addresses exist: stopping is safer than silently switching to a false instruction alignment.

---

## 23. Temporary breakpoint semantics in detail

A temporary breakpoint is installed through the live CPU execution trap.

The trap is evaluated only at a clean instruction boundary, before opcode fetch and instruction execution.

Therefore a hit leaves the target opcode unexecuted.

For a conditional breakpoint:

1. the target address is reached;
2. the condition is evaluated against the live CPU/mapped memory;
3. if false, the one-shot trap is immediately reinstalled and the instruction executes normally;
4. if true, execution ownership is stopped and the debugger remains at that boundary.

This is fundamentally different from periodically sampling the PC and hoping to notice a target address.

---

## 24. Track PC versus manual view

Track PC controls **where the listing viewport follows**; it does not control execution.

### Track locked

```html
<i class="fa fa-lock"></i>
```

The viewport follows the executing PC.

### Track unlocked

```html
<i class="fa fa-lock-open"></i>
```

The viewport stays where you browse manually.

Meanwhile:

- the CPU can continue running;
- the `PC $xxxx` indicator remains live;
- the register row remains live;
- bytes in the manual listing remain mapped-memory aware.

This is useful when you want to inspect nearby code without stopping the machine.

---

## 25. Suggested debugging workflows

### Inspect a routine instruction by instruction

1. select **1 IPS** or pause execution;
2. keep Track PC locked;
3. use **F11** for Step In;
4. use **F10** for calls you do not want to enter;
5. use **Shift+F11** to leave the current routine.

### Let a delay loop finish without watching every iteration

1. choose a fixed IPS mode;
2. click the **retweet** icon to disable loop-step display;
3. continue execution;
4. the live CPU runs every loop instruction;
5. STEP TRACE resumes visual updates at the loop exit.

### Run to an address

1. enter the address in `BREAK`, or click its listing row;
2. press **Run→**.

Alternatively, double-click the target listing row.

### Stop only when a register has a value

```text
BREAK $C600
IF    A==$10
```

Press **Run→**.

### Stop when memory changes to a particular value

```text
BREAK $1234
IF    M[$4000]==$80
```

### Trace Disk II ROM

1. select a fixed STEP TRACE speed such as 100 or 1000 IPS;
2. keep Track PC enabled;
3. execute a DOS command that enters the Disk II firmware;
4. STEP TRACE yields on transitions into the peripheral-ROM window so the ROM execution can become visible.

### Use source labels in the live trace

1. export symbols from the assembler;
2. press **SYMBOLS → load**;
3. select the `.symbols.json` file;
4. use a listing layout containing `lbl`, `opr`, and optionally `com`.

---

## 26. Diagnostics available to developers

`Apple2Debug.liveState()` exposes useful internal state, including:

```text
pc
runMode
running
systemRunning
resumePct
followPC
showLoopSteps
closedLoop
loopDisplayStats
viewTop
mappedBus
traceMaskedRange
tracePeripheralROM
pcInPeripheralROM
liveStepAPI
boundaryAction
breakpoint
symbols
cacheHits
cacheMisses
domWrites
```

The breakpoint diagnostic object additionally exposes values such as:

```text
target
address
armed
hit
hits
checks
skips
condition
editorCondition
lastResult
error
```

The loop-display statistics include counters for:

```text
detected
hiddenInstructions
exits
```

These diagnostics are primarily intended for development and validation rather than normal user operation.

---

## 27. Current behavioural limits

A few behaviours are intentionally conservative:

- `$C000-$C0FF` is masked from debugger reads to avoid probing soft-switch I/O while disassembling or evaluating breakpoint memory expressions.
- Exact peripheral-ROM transition rendering is guaranteed in the debugger-owned fixed IPS modes; Max (SYSTEM) remains scheduler-sampled.
- Exact closed-loop display suppression is also a debugger-owned fixed-IPS / cooperative Over-Out feature, not a per-instruction hook in Max (SYSTEM).
- Branch guides are based on the currently visible listing window; a control-flow destination outside the visible window may not receive a complete Unicode guide.
- Backward disassembly stops on unresolved ambiguity instead of inventing an instruction boundary.
- Source comments imported with opcode signatures are deliberately hidden after those live bytes no longer match.

These choices favour correctness of the live machine over making the debugger display appear artificially continuous.

---

## 28. Quick-reference card

| Control / gesture | Result |
|---|---|
| Play/Pause icon | Start or pause |
| Step icon / F11 | Step In |
| Paw icon / F10 | Step Over |
| Exit icon / Shift+F11 | Step Out |
| `↑` / `↓` short press | Previous / next instruction |
| `↑` / `↓` hold ~0.5 s | Previous / next page |
| Mouse wheel | Navigate one instruction row |
| Shift + wheel | Navigate a page |
| Home | Return to Track PC |
| F | Toggle Track PC |
| `fa-lock` | Track PC enabled |
| `fa-lock-open` | Track PC disabled |
| `fa-retweet` bright | Show closed-loop steps |
| `fa-retweet` dim | Hide repeated closed-loop display |
| Listing row click | Copy address to BREAK |
| Listing row double-click | Run to here |
| F9 | Arm temporary breakpoint |
| Shift+F9 | Clear temporary breakpoint |
| Arm | Install breakpoint without running |
| Run→ | Install breakpoint and continue |
| Clear | Remove temporary breakpoint |
| IF | Optional breakpoint condition |
| 1/10/100/1000 IPS | Debugger-controlled live execution |
| Max (SYSTEM) | Normal emulator scheduler |
| default/wide/compact | Listing column presets |
| SYMBOLS load | Load labels/EQU/comments |
| SYMBOLS clear | Remove loaded symbol table |
| Coffee icon | Enable/disable boot log |
| Cloud-download icon | Download boot log |
| x | Close STEP TRACE |

---

## 29. Summary

STEP TRACE is designed as a **live-system debugger**, not a detached disassembler.

Its central rules are:

- execute the real CPU;
- keep peripherals and timing alive;
- read the currently mapped bus;
- stop only on real instruction boundaries;
- avoid guessing backward instruction alignment;
- allow the user to follow execution or browse manually;
- preserve source-level conveniences such as symbols, comments, and branch lines without compromising live-memory correctness;
- make high-frequency loops easier to debug by optionally suppressing their *display*, never their execution.
