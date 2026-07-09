# RetroAppleJS Debugger — User Guide

This guide gets you from source code to a working step-by-step debugger session as quickly as possible, and then explains the debugger features in more detail.

The fastest path is:

1. Open the **Assembler** tab.
2. Assemble the default `sample.S` source by clicking the blinking **play / assemble** button.
3. In the **Listing** pane header, at the far right, click **Send byte code to debugger**.
4. The app switches to the **Debugger** tab.
5. Click **Step one instruction forward** to start watching execution.

That is all you need for a first debugging session.

---

## 1. Quick Start: Debug `sample.S`

The Assembler tab already provides a sample source file. The quickest way to create a debugger session is to assemble that source and send the result directly to the debugger.

### Step-by-step

1. Go to the **Assembler** tab.
2. Leave the default `sample.S` source in place.
3. Click the blinking **play / assemble** button.
4. Check that the **Listing** pane is generated.
5. At the far right of the **Listing** pane header, click **Send byte code to debugger**.
6. The debugger opens automatically.
7. The **Listing** caret is positioned at the source-code origin address.
8. A debugger session named `sample.DEB` is prepared.
9. Click **Step one instruction forward**.

After the first step, the debugger starts showing:

- the current instruction,
- the CPU register state,
- a CPU trace log,
- the CPU Watch pane,
- and the current position in the listing.

---

## 2. What the Assembler Sends to the Debugger

The debugger needs executable bytes, a program counter location, and optional human-readable context. The Assembler handoff supplies all of this automatically.

      ┌────────────────────┐
      │  sample.S          │
      │  6502 source code  │
      └─────────┬──────────┘
                │ Assemble
                ▼
      ┌────────────────────┐
      │  Assembler output  │
      │                    │
      │  • byte code       │
      │  • origin address  │
      │  • listing         │
      │  • symbol table    │
      └─────────┬──────────┘
                │ Send byte code to debugger
                ▼
      ┌────────────────────┐
      │  sample.DEB        │
      │  debugger session  │
      │                    │
      │  • byte code       │
      │  • symbols         │
      │  • user settings   │
      └─────────┬──────────┘
                │ Open Debugger tab
                ▼
      ┌────────────────────┐
      │  Debugger          │
      │                    │
      │  • Listing caret   │
      │  • CPU Watch       │
      │  • CPU Trace       │
      │  • Step controls   │
      └────────────────────┘

The `.DEB` session is a practical debugger container. It holds the byte code, the symbol information supplied by the assembler, and the debugger settings as they are configured at that moment.

---

## 3. Byte Code + Symbols = Readable Debugging

The CPU only executes bytes. Symbols do not change execution. Symbols make execution understandable for humans.

                  CPU EXECUTES                         DEBUGGER EXPLAINS
      
      ┌─────────────────────────────┐       ┌─────────────────────────────┐
      │ Byte code                   │       │ Symbol table                 │
      │                             │       │                             │
      │ A9 00 8D 50 C0              │       │ TXTCLR = $C050              │
      │ 20 2F FB                    │       │ INIT   = $FB2F              │
      └──────────────┬──────────────┘       └──────────────┬──────────────┘
                     │                                     │
                     └──────────────┬──────────────────────┘
                                    ▼
      ┌────────────────────────────────────────────────────────────────────┐
      │ Human-readable trace/listing                                       │
      │                                                                    │
      │ $FB2F  INIT     LDA #$00                                           │
      │ $FB31           STA STATUS                                         │
      │ $FB33           LDA LORES                                          │
      │ $FB35           LDA TXTPAGE1                                       │
      └────────────────────────────────────────────────────────────────────┘

Without symbols, the debugger can still disassemble instructions, but it may only show raw addresses. With symbols, labels, constants, and comments can be used to make the trace and listing much easier to read.

---

## 4. The Debugger Data Sources

The debugger can be started from different data sources.

                               ┌────────────────────┐
                               │  Debugger session  │
                               │  .DEB              │
                               └─────────┬──────────┘
                                         │
                                         ▼
      ┌──────────────┐      ┌────────────────────┐      ┌────────────────────┐
      │ Assembler    │─────▶│ Byte code          │─────▶│ Emulated memory     │
      │ output       │      │ loaded at origin   │      │ 64K address space   │
      └──────────────┘      └────────────────────┘      └─────────┬──────────┘
                                                                  │
      ┌──────────────┐      ┌────────────────────┐                │
      │ Symbol file  │─────▶│ Labels, constants, │────────────────┘
      │ .symbols.json│      │ comments           │
      └──────────────┘      └────────────────────┘
                                                                  │
      ┌──────────────┐      ┌────────────────────┐                │
      │ MemCap       │─────▶│ Full memory image   │────────────────┘
      │ capture      │      │ copied from emulator│
      └──────────────┘      └────────────────────┘
                                                                  ▼
                                                         ┌────────────────────┐
                                                         │ CPU step / trace   │
                                                         │ CPU Watch          │
                                                         │ Listing caret      │
                                                         └────────────────────┘

### Main sources

| Source | What it provides | Typical use |
|---|---|---|
| Assembler handoff | Byte code, origin, symbols, listing context | Fastest way to debug your own assembler source |
| `.DEB` session | Byte code, symbols, debugger settings | Reload or share a prepared debug session |
| MemCap | Full 64K memory capture from the emulator | Debug existing memory state or ROM activity |
| `.symbols.json` | Labels, constants, comments | Make memory dumps and ROM traces readable |

---

## 5. The Debugger Screen

The debugger is centered around three ideas:

1. **Where am I?**  
   The Listing caret and Program Counter show the next instruction.

2. **What just happened?**  
   The CPU Trace shows executed instructions step by step.

3. **What changed?**  
   The CPU Watch shows registers and flags, highlighting values that changed.

Typical panes:

      ┌──────────────────────┬──────────────────────┬──────────────────────┐
      │ Listing              │ CPU Trace            │ CPU Watch            │
      │                      │                      │                      │
      │ Source/disassembly   │ Executed steps       │ Registers + flags    │
      │ caret at current PC  │ one line per step    │ changed values boxed │
      └──────────────────────┴──────────────────────┴──────────────────────┘

---

## 6. CPU Watch

The CPU Watch pane shows the state of the 6502 CPU.

### Registers

| Register | Meaning |
|---|---|
| `PC` | Program Counter: address of the next instruction |
| `A` | Accumulator |
| `X` | X register |
| `Y` | Y register |
| `SR` | Status Register |
| `SP` | Stack Pointer |

### Status flags

The `SR` register contains eight flags, shown from bit 7 to bit 0:

| Flag | Meaning |
|---|---|
| `N` | Negative |
| `V` | Overflow |
| `-` | Unused / ignored bit |
| `B` | Break |
| `D` | Decimal mode |
| `I` | Interrupt disable |
| `Z` | Zero |
| `C` | Carry |

Changed values are visually emphasized. For example, after stepping an instruction, the changed register or flag may be shown with a box.

      ┌───────┐┌────┐
      │PC:F802││A:00│ X:00 Y:00 SR:24 SP:FF
      └───────┘└────┘
      
       N:0 V:0 -:1 B:0 D:0 I:1 Z:0 C:0

The exact layout may vary, but the goal is always the same: quickly show what changed after the last step.

---

## 7. CPU Trace

The CPU Trace is a chronological log of executed instructions.

Each line typically combines:

- the program counter,
- opcode bytes,
- disassembled instruction,
- operands,
- and sometimes register context.

A trace line is useful when you want to understand execution flow:

      $F800  4A        PLOT     LSR A
      $F801  08                 PHP
      $F802  20 70 F8           JSR GBASCALC
      $F805  28                 PLP

When symbols are available, labels such as `PLOT` or `GBASCALC` can appear instead of anonymous addresses.

---

## 8. Listing Caret and Origin

When byte code is sent from the Assembler to the Debugger, the debugger uses the source origin address to place the Listing caret.

For example:

      ORG $6000

means that the first assembled byte belongs at `$6000`.

The debugger then:

1. loads the byte code at the origin address,
2. sets the initial Listing caret to that address,
3. prepares the CPU/session state,
4. waits for you to step forward.

If the caret or trace starts at the wrong place, first check that the assembled source has the expected `ORG` value.

---

## 9. Stepping Through Code

Use **Step one instruction forward** to execute exactly one instruction.

After every step, check:

- the Listing caret,
- the CPU Trace,
- the CPU Watch,
- memory effects if the instruction stores data,
- and flags such as `Z`, `N`, or `C`.

A typical debugging rhythm is:

      Step → read trace → inspect register changes → compare with source → step again

This is especially useful for learning or verifying low-level 6502 behavior, because every instruction changes the machine state in a visible way.

---

## 10. Debugging with MemCap

The Assembler handoff is the easiest path for your own source code. For emulator memory, ROMs, or already-running code, use **MemCap**.

### MemCap workflow

1. In the emulator, use **MemCap** to capture the full memory space.
2. Copy the memory capture.
3. Go to the Debugger tab.
4. Open the **Tools** section.
5. Paste the memory capture into the memory input area.
6. Load or paste a matching symbol file if available.
7. Set or verify the start address / Program Counter.
8. Start stepping.

      ┌──────────────────────┐
      │ Running emulator     │
      │ full 64K memory      │
      └──────────┬───────────┘
                 │ MemCap
                 ▼
      ┌──────────────────────┐
      │ Memory capture       │
      │ copied as text/data  │
      └──────────┬───────────┘
                 │ paste into Debugger Tools
                 ▼
      ┌──────────────────────┐       ┌──────────────────────────────┐
      │ Debugger memory      │◀──────│ Optional symbols              │
      │ reconstructed image  │       │ e.g. ROM labels/comments      │
      └──────────┬───────────┘       └──────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Step through memory  │
      │ with readable trace  │
      └──────────────────────┘

### Example symbol file

For the Apple II Monitor ROM, a matching symbol file can be loaded from:

      /asm/ROMS/APPLE/APPLE-2 MONITOR ROM.symbols.json

A memory capture gives the debugger the bytes. The symbol file gives those bytes names and comments.

---

## 11. Working with Symbol Files

A symbol file can provide:

- label names,
- named constants,
- comments,
- source hints,
- address annotations.

This is especially useful for ROM debugging, where the code already exists in memory and you want meaningful trace output.

Example idea:

      Without symbols:
      $FB2F  A9 00      LDA #$00
      $FB31  85 48      STA $48
      
      With symbols:
      $FB2F  INIT       LDA #$00
      $FB31             STA STATUS

The bytes are the same. The symbols make the code readable.

---

## 12. Debugger Sessions

A debugger session, such as `sample.DEB`, collects the state needed to continue or reproduce a debugging setup.

A session may include:

- byte code,
- origin/start address,
- symbol table data,
- current debugger settings,
- display preferences,
- and other state needed by the debugger.

The Assembler handoff prepares `sample.DEB` automatically when you send byte code to the debugger.

---

## 13. Memory Notes

The Apple II uses a 16-bit address space, so the debugger works with a 64K memory range:

      $0000 ─────────────────────────────────────────────── $FFFF

Important regions include:

| Range | Meaning |
|---|---|
| `$0000-$00FF` | Zero page |
| `$0100-$01FF` | 6502 hardware stack |
| `$0200-$03FF` | Common low-memory workspace / buffers |
| `$0400-$07FF` | Apple II text page 1 |
| `$C000-$C0FF` | Apple II soft switches / I/O area |
| `$D000-$FFFF` | ROM / high memory, depending on configuration |

Exact behavior depends on the current emulator configuration and memory mapping.

---

## 14. Troubleshooting

### The debugger opens, but stepping starts at the wrong address

Check:

- the assembler `ORG`,
- the origin address sent to the debugger,
- the current `PC`,
- and whether the Listing caret was moved manually.

### The trace shows raw addresses instead of labels

Load a matching symbol file, or use the Assembler handoff so the assembler can provide its symbol table automatically.

### The trace does not match the source

Check that:

- the byte code was assembled after the latest source edit,
- the byte code was sent again to the debugger,
- the memory dump matches the symbol file,
- and the Program Counter points into the loaded code.

### ROM symbols look wrong

Make sure the symbol file belongs to the exact ROM image or memory capture you are debugging.

### A memory capture does not step correctly

Check that:

- the full memory image was captured,
- it was pasted into the correct Debugger Tools field,
- the start address / PC is correct,
- and the memory image was applied before stepping.

---

## 15. Practical First Exercise

Use the default sample source.

1. Assemble `sample.S`.
2. Send byte code to debugger.
3. Click **Step one instruction forward**.
4. Watch `PC` advance.
5. Watch any changed register become highlighted.
6. Read the CPU Trace line.
7. Compare the trace with the Listing caret.
8. Repeat.

After a few steps, the relationship becomes clear:

      Source line  → assembled bytes → memory → CPU execution → trace + register changes

That is the core idea of the RetroAppleJS debugger.
