# ACME source includes and C-style hexadecimal literals

ASM_core.js v0.6.14 adds `!source` and `0x` numbers after stage 2 and the
legacy zero-page fix. The default remains `multi`, and the CPU remains 6502.

## Trying mb-audit

1. Upload `mb-audit.a` as the main source using the source upload pictogram.
2. In the Tools include-file controls, upload `AppleDefs.a`,
   `MockingboardDefs.a`, `chip-6522.a`, `chip-ay8913.a`, `chip-sc01.a` and
   `chip-ssi263.a`. Keep their original names.
3. Select ACME as the dialect and Source / existing behavior as the character
   conversion for this source, then use the assemble/play button.

`!source` reads supplied include files; it does not automatically fetch files
from `/asm/AUDIO/mb-audit-main` or the browser's local filesystem.

All seven original source files now participate in assembly. On the unchanged
mb-audit source used for these patches, diagnostics decrease from 161 errors /
130 warnings to **58 errors / 20 warnings**. This is an intermediate result,
not a valid application binary. Conditional blocks, `!warn`/`!serious`, output
metadata (`!to`/`!sl`) and the source's 65C02/65816 sections still need handling.
Some remaining label and addressing diagnostics follow from those unsupported
sections. Block zones and advanced macro forms also remain deferred.

## Source includes

```javascript
var asm = new ASM({
    dialect: "ACME", // omit to keep multi-dialect mode
    sourceName: "mb-audit.a",
    includes: {
        "AppleDefs.a": appleDefsText,
        "MockingboardDefs.a": mockingboardDefsText
        // Supply the other four include files as well.
    }
});
var result = asm.assemble(mainSourceText);
```

`!source "filename"` inserts source at that point. Included constants, code and
macro definitions are available to subsequent statements. Zone and cheap-label
scopes continue across file boundaries. Repeated includes are expanded again.
Includes in basic macro bodies work with both inline and multiline definitions;
their dot-local labels remain private to each invocation.

Each include marker has `row.asm = ["ACME"]` and emits no bytes. Included rows
and diagnostics retain the included filename and original line number. Macro
expansions also retain their definition and call trace. The existing listing
columns and character conversion settings keep their behavior.

As in native ACME, nested paths resolve from the assembly root, rather than the
directory of the including file. In this browser API, the main source's logical
directory represents that root. With `sourceName:"project/main.a"`, a nested
`!source "defs.a"` first looks for `project/defs.a`. Map entries can alternatively
use plain filenames. Path separators and `.`/`..` segments are normalized.
Exact names take precedence at each path candidate; existing case-insensitive
fallback remains available. Distinct exact ACME keys such as `A.a` and `a.a`
remain distinct for cycle detection. The current UI retains its existing
case-insensitive include-name replacement behavior.

Map values may also be `{source:text, sourceName:"project/defs.a"}` objects.
An existing `includeResolver(filename, includingSourceName)` callback is tried
before map lookup and receives the decoded filename. It may return a source
string or the same object form; return null/undefined to use map lookup.
Use consistent source names when resolving aliases so cycle detection can
identify them.

Filenames require double quotes. Spaces, semicolons and ACME string escapes
are preserved/decoded independently of emitted-byte character conversion.
Missing files, include cycles and nesting beyond `maxIncludeDepth` produce
diagnostics. ACME library paths such as `<filename>` and binary imports remain
deferred. S-C `.IN` retains its existing behavior; explicit foreign dialects
reject `!source` without loading its content.

## Hexadecimal literals

`0x` numbers now work in expressions, constants, instructions and ACME data
directives, including mb-audit's `!text "...", 0xd`. Explicit numeric values
do not pass through character conversion.

Direct address sizing follows the existing hexadecimal digit policy:

| Operand | Addressing |
|---|---|
| `0xF`, `0x0F` | Zero page |
| `0x00F`, `0x000F` | Absolute |

More than four direct-address hex digits and addresses outside 0–65535 produce
errors. Immediate, branch and indirect operands retain their required modes;
symbols and compound expressions retain their existing value-based selection.
Native ACME requires the lowercase `x` prefix. ACME expressions enforce that;
generic expressions in multi mode additionally accept `0X`.

## Applying and checking

Apply after `RetroAppleJS-ACME-stage2.patch` and
`RetroAppleJS-legacy-zero-page-fix.patch`:

```sh
git apply --check RetroAppleJS-ACME-stage3.patch
git apply RetroAppleJS-ACME-stage3.patch
node --test
```

This patch changes the core, tests and documentation only. Its baseline is the
previously delivered patches; it has not been checked against a newer upstream
revision. Validation: 107 Node tests pass; 93 shared-syntax fixtures and 14
include fixtures match native ACME 0.97 for byte output or rejection. Those
comparisons cover nested root paths, filename escapes, case-sensitive file
identity, labels across includes and inline macro includes. Intentional legacy
syntax and address-width differences retain their dedicated regression tests.
