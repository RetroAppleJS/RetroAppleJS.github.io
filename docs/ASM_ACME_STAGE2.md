# ACME unary expressions and label scopes

ASM_core.js v0.6.12 extends the stage 1 implementation while keeping the CPU
limited to 6502 and the default dialect set to `multi`.

## Expressions

Unary `!` is ACME's bitwise complement, available in ACME and multi mode:

```asm
MASK = !$20
and #!($20)       ; 29 DF
!byte MASK & 255  ; DF
```

It does not mean Boolean negation. `!=` remains inequality. Complemented
constants retain their signed value until the emitting directive validates it.

## Local labels

`!zone name`, `!zn name` and unnamed `!zone` each start a fresh dot-local and
anonymous-label scope. Reusing a zone title creates a new scope. Global labels
do not end the dot-local scope.

```asm
!zone code
.loop nop
first bne .loop
second bne .loop
!zone data
.loop !byte 0      ; independent of code's .loop
```

Cheap labels start with `@`. A global location label starts a new cheap-local
scope; global assignments and zone changes do not. Cheap locals also work before
the first global label. Named local constants accept compact assignments.

```asm
first bne @done
@done rts
second bne @done
@done rts          ; belongs to second
```

Anonymous labels use a sequence of identical signs. `+` references the next `+`
definition and `-` references the most recent `-` definition. `++`, `+++`, `--`
and longer spellings have independent sequences: `++` does not skip two `+`
definitions. Backward labels on an instruction's own line are already visible
to that instruction. Arithmetic negation and negative numeric literals retain
their meaning; parenthesize backward references when composing expressions.

```asm
- nop
  bne -
  bne ++
+ nop
++ rts
```

Duplicate named locals in the same scope and missing directional anonymous
targets produce diagnostics. Listings and diagnostic statements retain the
original spelling. `sym` and `symtab` use generated names to isolate local scopes;
unresolved-symbol messages use the source spelling. Zone directives have an
`ACME` compatibility tag in the existing listing `asm` column.

In multi mode, dot locals become zone-scoped after a zone declaration. Without
one, the existing dot-name behavior remains. S-C numeric locals retain their
existing rules in multi and S-C modes; explicit ACME mode rejects their
definitions. Existing macro-private dot locals remain independent of caller
zones. Other basic macro limitations from stage 1 still apply.

## Source controls

Source and include file pickers now accept `.a` and `.A`. The source header's
upload pictogram opens a hidden file input and sits immediately before download.
The native requester control and its filename label are not displayed. The
existing editable source filename remains available.

The byte-encoding start address and range sit with byte-output controls in Tools
(tab 2.2). The scroll button sits directly below the source catalog's cat button.
It still byte-encodes source text; the play button assembles instructions.

## Remaining mb-audit requirements

This stage does not assemble the complete application. `!source`, conditional
assembly, `!warn`/`!serious`, output-file metadata (`!to`/`!sl`), C-style `0x`
numeric literals, and the upstream 65C02/65816 sections still need handling.
Block zones and advanced macro local-label forms remain deferred.

The unchanged entry file's diagnostics fall from 375 errors / 342 warnings to
161 errors / 130 warnings with the six include files supplied. Since `!source`
is still unsupported, those include files are not expanded yet. These counts
measure progress, not a valid binary.

## Applying and checking

Apply `RetroAppleJS-ACME-stage2.patch` after stage 1, against upstream commit
`4597e4540ed188310e04e5e8b14ceed58e336c9b`:

```sh
git apply --check RetroAppleJS-ACME-stage2.patch
git apply RetroAppleJS-ACME-stage2.patch
node --test
```

Validation: 82 Node tests pass, and 85 shared-syntax fixtures match native ACME
0.97 for successful byte output or rejection. Intentional legacy identifier
extensions and the existing octal-width policy are outside that comparison.
