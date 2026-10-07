# Dialect selection, ACME directives and basic macros

This patch targets RetroAppleJS commit `24299eea2d071ad4c147d9cfc32c8950f5087c27`.
It extends the existing 6502 assembler without replacing its multi-dialect parser.

## Selecting a dialect

In the assembler settings, the COMPILER toolbox now has a Dialect selector.

| Selection | Behavior |
|---|---|
| Multi-dialect | Default. Accept the currently supported syntax from every dialect. |
| RetroAppleJS, ca65, Merlin, S-C, ACME | Check each recognized directive against its declared compatibility. |

These modes cover the syntax implemented by this core. Selecting a dialect does not implement every feature of the corresponding standalone assembler.

The core API accepts `new ASM({dialect:"ACME"})`; names are case insensitive.
Use `asm.setDialect("multi")` to switch back. Unknown names produce an error.

In every mode, `*` denotes the current program counter. The legacy `*$10` zero-page prefix now produces a migration diagnostic.

## Selecting direct address sizes

The same policy applies in every dialect mode, including direct indexed operands:

| Literal format | Zero page | Absolute (16-bit) |
|---|---|---|
| Hexadecimal (`$`) | 1–2 digits | 3–4 digits |
| Binary (`%`) | 1–8 digits | 9–16 digits |
| Decimal | Value 0–255 | Value 256–65535 |
| Octal (`&`) | Value 0–255 | Value 256–65535 |

For example, `lda $FF` uses zero page; `lda $00FF` uses absolute. `lda %1` uses zero page; `lda %000000001` uses absolute. Octal leading zeros do not affect size: `lda &000001` uses zero page. This last rule intentionally differs from native ACME's padded-octal size hint.

Symbols and compound expressions select the smallest available mode by their resolved value. Immediate, branch and indirect operands retain their required modes; JSR/JMP remain absolute. Short literals fall back to absolute when an instruction has no zero-page mode. A wide literal requiring an unavailable absolute indexed mode produces an error. Direct addresses outside 0–65535 and hex/binary literals exceeding their supported widths also produce errors.

At a value position, `&377` means octal 255. Between values, `&` remains bitwise AND, including compact current-PC expressions such as `*&255`. `%` similarly distinguishes binary literals from modulo.

## Preserving source clues in listings

The `asm` column continues to describe the compatible dialects of the directive's syntax.
It is not replaced with the selected dialect and does not assert that an entire source file came from one assembler.

ACME directives receive `["ACME"]` in `row.asm`. Shared assignment/origin syntax has the relevant additional compatibility tags.
The original ACME directive spelling is retained in the instruction column.

The existing print preset is unchanged:

```text
{adr:0,code:6,lin:15,num:{col:25,dig:6},lbl:32,ins:40,opr:45,asm:61,com:70}
```

That layout gives the asm field nine columns. Long compatibility lists use the existing clipping behavior; their complete values remain in `row.asm` in JSON. Move `com` farther right if you want a wider asm field.

## ACME syntax implemented in this stage

| Feature | Accepted syntax |
|---|---|
| Origin | `*=$0800`, `* = $0800` |
| Scalar constants | `NAME=$12`, `NAME = expression` |
| Bytes | `!byte`, `!by`, `!8`, `!08` |
| Little-endian words | `!word`, `!wo`, `!16`, `!le16` |
| Big-endian words | `!be16` |
| Strings and byte values | `!text`, `!tx`, `!raw` |
| Hexadecimal byte pairs | `!hex` |
| Fill | `!fill count[, value]`, `!fi`; default value is zero |
| Alignment | `!align mask, equality[, fill]`; default fill is $EA |
| CPU declaration | `!cpu 6502` |
| Macro definition | `!macro name [.parameter, ...] { ... }` |
| Macro call | `+name [expression, ...]` |

Data statements resolve forward symbols, validate integer ranges and reject empty operands.
Constants in ACME mode, and shared `=` constants in multi mode, preserve signed and wide integer values rather than masking them before range validation.
For `!align`, padding ends when `PC & mask == equality`.
Within one data statement, `*` denotes that statement's starting address.

String escapes include `\\0`, `\\t`, `\\n`, `\\r`, `\\xHH`, escaped quotes and escaped backslashes, following ACME 0.97 conventions.

Example:

```asm
* = $0800
VALUE = $1234
    !byte <VALUE, >VALUE
    !word VALUE
    !text "HELLO", 0
    !fill 2, $FF
    !align $0F, 0
    rts
```

## Character conversion is independent of dialect

The Characters selector applies to implicit strings and character literals.
Numeric byte and word operands are never converted.

| Selection | Conversion |
|---|---|
| Source / existing behavior | Retain existing syntax-specific behavior and the Quote legacy option. ACME literals use raw bytes. |
| ASCII | Emit ASCII codes without forcing bit 7. |
| Apple II+ normal screen text | Fold a–z to A–Z and emit normal display codes for the original 64-character glyph set. |

For example, with Apple II+ normal screen text selected:

```asm
    lda #'a'          ; immediate $C1
    !text "Az"        ; bytes $C1 $DA
    !byte $41, $C1    ; unchanged numeric bytes
```

The Apple II+ option targets screen glyphs, not a general text-stream format.
Characters without a glyph, including implicit control characters, produce a diagnostic.
Use an explicit numeric control byte such as `!text "READY", $0D` when the receiving routine expects carriage return.

This stage supplies the original Apple II+ normal-screen preset. Other machine ROMs, lowercase modifications, inverse/flashing text and alternate character sets can use separate conversion tables without changing dialect parsing.

API examples:

```javascript
var asm = new ASM({
    dialect: "multi",
    characterEncoding: "apple2plus"
});

var asciiAsm = new ASM({characterEncoding:"ascii"});

// A byte-source conversion table: -1 marks unsupported characters.
var characterMap = Array.from({length:256}, function(_, code) { return code; });
characterMap[65] = 0x91;
var customAsm = new ASM({characterMap:characterMap});
// Equivalent explicit selection:
// new ASM({characterEncoding:"custom", characterMap:characterMap});

asm.setCharacterEncoding("source");
```

The table maps source character byte values to emitted byte codes and must contain exactly 256 entries.
S-C `.AS` uses the selected conversion; `.AT` additionally retains its explicit last-character high-bit terminator.
Packed `ASC6` retains its existing explicit packing format.
Changing an encoding requires reassembly; it does not change how an emulated video ROM interprets numeric byte codes.

## Basic ACME macros

Macros are available in multi-dialect and explicit ACME mode. Named non-ACME modes reject them and do not emit instructions from their definition bodies.

```asm
!macro store .value, .address {
    lda #.value
    sta .address
}

* = $0800
    +store $41, $0400
```

This emits `A9 41 8D 00 04`. Definitions use global macro names and zero or more dot-local value parameters. Definitions must precede their calls, following native ACME. A macro may call another macro; that called macro must be defined by the time the outer call is expanded. Names are case sensitive. Different argument counts may overload the same name.

Arguments bind to values at the call's PC, rather than substituting the argument expression into every instruction. Thus an argument containing `*` keeps its call-site value throughout the expansion. Forward symbol arguments converge through the ordinary layout passes. Arguments from S-C source in multi mode retain the caller's numeric local-label scope.

Dot-local labels and constants inside the body have a separate namespace for each invocation, including nested calls. Strings and comments retain their text during identifier rewriting. Braces inside quoted strings, escaped quotes, character literals or comments do not close the macro block. Multiline blocks and single-statement inline bodies are supported. General colon-separated statement sequences remain deferred.

Definition and call rows carry `row.asm = ["ACME"]` and emit no bytes. Expanded instruction rows preserve their original spelling in `source`, `sourceSym` and printed listings; `sym` and `symtab` contain the internal names used for scope isolation. Expanded rows and diagnostics have a `macroTrace` array with each macro's name, definition location and call location. Parameter binding rows are marked `macroArgument: true`.

Malformed blocks, undefined calls, wrong argument counts, duplicate parameters and duplicate local definitions produce diagnostics. Duplicate-parameter rejection is intentionally stricter than native ACME 0.97, which permits some duplicate value parameters. Unsupported macro forms also produce diagnostics: reference arguments, global or cheap-local parameters, cheap-local/numeric/anonymous body labels, macro-local macro names, nested definitions and block directives inside macros.

Expansion limits prevent runaway recursion or repeated expansion. API options are `maxMacroDepth` (default 32, capped at 128), `maxMacroExpansions` (default 10,000) and `maxMacroExpandedLines` (default 100,000; includes generated bindings and body records). Exceeding a limit ends further expansion with a source diagnostic.

The test fixture contains all six 6502 macros from [Tom Charlesworth's mb-audit](https://github.com/tomcw/mb-audit/blob/3b6eb43fa3cb8a8825011171649621d664f717a5/mb-audit.a): the four `ENA_*` ROM/RAM switches and `ISR_ENTRY`/`ISR_EXIT`. Their output matches native ACME. This validates the macros, not assembly or execution of the complete application. The full source also requires ACME includes, zones, conditionals, other directives and a source variant restricted to 6502; upstream contains 65C02 and 65816 sections.

## Deferred syntax

Advanced macro forms described above, zones and general scoped/anonymous labels, block conditionals and loops, ACME includes/binary imports, output-file directives, conversion-table directives and pseudopc remain for later stages.
The full ACME expression grammar is also deferred: for example, ACME exponentiation `^` is rejected rather than interpreted as the legacy XOR operator.
No additional CPUs are enabled.

## Applying and checking

From the repository root:

```sh
git apply --check RetroAppleJS-ACME-stage1.patch
git apply RetroAppleJS-ACME-stage1.patch
node --test
```

Validation performed:

- 62 assembler tests, covering mixed/named modes, data syntax, diagnostics, print labels, character conversion, address sizing, current-PC expressions and macro expansion.
- 61 cases compared against a native ACME 0.97 build, checking byte output or error acceptance, including all six mb-audit macros. Padded octal's intentional policy difference and stricter duplicate-parameter validation are covered by the assembler tests instead.
- Identical default-mode output and diagnostics for DITHERIZER_TEST.S, KEYBOARD_TESTER.S and INFLATE_ASM_CORE.S.
- The larger 6502_TEST_APPLE2PLUS_SAFE.S corpus now assembles to 13,571 bytes without diagnostics. Setting the PC for each instruction fixes its 1,017 previous current-PC branch diagnostics. This check validates assembly only; the resulting program has not been executed.
- JavaScript syntax checks for the core and all eight executable inline scripts in index.html.
- Browser appearance has not been visually checked.

References: [ACME source and documentation](https://sourceforge.net/projects/acme-crossass/), [ACME 0.97 source mirror used for comparison](https://github.com/UffeJakobsen/acme).
