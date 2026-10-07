# ACME conditionals, messages and mb-audit assembly

ASM_core.js v0.6.15 extends stage 3 with basic conditional blocks, assembly
messages and output metadata. The default remains multi-dialect mode; only the
6502 instruction set is enabled. No index.html changes are included.

## Conditional blocks

Both inline and multiline `!if expression { ... } else { ... }` are supported,
including nested blocks and location labels on `!if` headers. The `else`
keyword follows the closing brace on the same source line, as in native ACME.
Conditions use integer values known at their source position. Forward values,
including constants depending on later labels, produce a diagnostic.

```asm
FLAG = 1
!if FLAG {
    COUNT = 7
} else {
    COUNT = 2
}
!fill COUNT, 0
```

Inactive statements emit no bytes, define no symbols and produce no operand,
CPU or encoding diagnostics. Skipped globals, zones, locals and anonymous labels
do not change the active label scopes. Their rows remain visible in the listing
and carry `acmeInactive:true` in JSON. Conditional control rows carry the ACME
compatibility tag; the existing listing column preset is unchanged.

ACME high/low-byte selectors now bind after arithmetic and shifts, but before
comparisons and bitwise operations. Thus `>.label != >*` compares two high bytes
correctly, and `>$1200+256` remains `$13`. Native ACME's adjacent `><` inequality
spelling is also accepted. Legacy S-C whole-expression byte selectors retain
their existing rules.

This stage does not implement `!ifdef`/`!ifndef`, `elif`/`else if`, conditional
blocks inside macros, or includes and macro definitions/calls inside conditional
blocks. Selected uses produce explicit diagnostics. Skipped includes are never
resolved, and skipped macro calls do not consume expansion limits. Keep source
includes and basic macros outside conditional blocks for now, as mb-audit does.
General colon-separated statement sequences, loops and block zones remain
deferred. Existing non-ACME conditional syntax retains its prior behavior.

## Messages and output metadata

`!warn` records a warning and `!serious` records an error when the statement is
active. Arguments are comma-separated strings or integer expressions; strings
and character arguments use source codes independently of byte conversion.
Messages are evaluated once in the final pass. This avoids repeating a warning
for every layout pass.

```asm
!warn "padding = ", * - start
!if >start != >* { !serious "branch crosses a page" }
```

`!to "name", plain` and `!sl "name.labels"` emit no bytes and retain their
requests in the returned object's `outputMetadata`:

```javascript
result.outputMetadata.output       // {fileName:"mb-audit", format:"plain"}
result.outputMetadata.symbolListFile // "mb-audit.labels"
```

Repeated requests warn and retain the first filename. These directives do not
write browser files or trigger downloads; use the existing output controls.
Other output formats remain deferred. Metadata resets between assemblies.

## Building mb-audit with a 6502-only assembler

The unchanged source now reaches **18 errors / 7 warnings** in either multi or
ACME mode. Its remaining errors originate in active 65C02/65816 sections, with
some label errors following from those unsupported instructions.

The separate optional `mb-audit-6502-assembler-compat.patch` adapts only
`asm/AUDIO/mb-audit-main/mb-audit.a` and `chip-6522.a`. It emits nine foreign
instructions as explicit byte data and replaces the five foreign CPU
declarations with `!cpu 6502`. Labels and symbolic operands are preserved;
BRA's relative displacement is computed from its target and PC. The original
runtime CPU-detection guards remain intact.

This source adaptation preserves the original executable byte stream. It does
not translate foreign instructions into 6502 instructions or enable additional
CPUs in the assembler. With both patches applied, the seven-file source builds
with **zero errors and one intentional padding warning**, producing **18,918
bytes at $2000**, byte-for-byte identical to the original native ACME 0.97 build.
The program has been assembled and compared, not run in the emulator.

## Applying and checking

The core patch is incremental against the delivered stage 3 patch, including
the earlier legacy zero-page fix. Its baseline has not been checked against a
newer upstream revision. The source patch targets the original mb-audit files
used throughout these compatibility checks.

```sh
git apply --check RetroAppleJS-ACME-stage4.patch
git apply RetroAppleJS-ACME-stage4.patch

# Optional: make mb-audit build through the 6502-only core.
git apply --check mb-audit-6502-assembler-compat.patch
git apply mb-audit-6502-assembler-compat.patch
node --test
```

Reload `mb-audit.a` and the modified `chip-6522.a` in the browser; supply all six
include files using tab 2.2's include-file controls. Choose Source / existing
behavior for this source's character conversion, then assemble. The source
adaptation works in both the default multi mode and explicit ACME mode.

Validation: 134 Node tests pass; 93 existing shared-syntax, 14 include and 132
conditional/expression/message/metadata fixtures match native ACME 0.97 for byte
output or rejection. The 132 new fixtures are checked in both modes. The actual
adapted mb-audit files also match every byte of the native original in both modes.
Additional regression checks cover legacy ELSE/ASCII, S-C numeric labels,
inactive scope isolation, deferred syntax and character conversion.
