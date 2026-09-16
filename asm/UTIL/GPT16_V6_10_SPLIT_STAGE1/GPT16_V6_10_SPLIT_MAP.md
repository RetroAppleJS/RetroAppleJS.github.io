# GPT16 V6.10 phase/overlay split — Stage 1

Baseline: `GPT16_VIDEX_NORMAL_V6_09_DIAG.S` (last known-running version).

This stage deliberately does **not** add Kermit. It first proves that the known-good
V6.09 application survives the memory/address split.

## Memory map

| Range | Size | Purpose | Current use |
|---|---:|---|---:|
| `$4000-$40FF` | 256 B | Fixed resident-kernel ABI | through `$407A` |
| `$4100-$5FFF` | 7936 B | Resident kernel implementation/literals | ends `$4F27` |
| `$6000-$603F` | 64 B | Fixed overlay ABI | 6 entry vectors + stubs |
| `$6040-$83FF` | 9152 B | Overlay implementation | CHAT ends `$7D1A` |
| `$8400-$85FF` | 512 B | INPUT/G16/A2 shared buffer | full reservation |
| `$8600-$8BFF` | 1536 B | PAGE/menu/name scratch | full reservation |
| `$8C00-$8FFF` | 1024 B | Persistent/shared state | ends `$8C88` |
| `$9000-$95FF` | 1536 B | DOS File Manager workspace | ends `$9496` |
| `$9600+` | — | DOS 3.3 resident area | untouched |

### Slack deliberately retained

- Resident kernel slack: `$4F27-$5FFF` = 4313 bytes.
- CHAT overlay slack: `$7D1A-$83FF` = 1766 bytes.
- State slack: `$8C88-$8FFF` = 888 bytes.
- DOS tail slack: `$9496-$95FF` = 362 bytes.

## Fixed entry points

Kernel:

- `$4000` `KAPI_BOOT` -> overlay `$6000`
- `$4003-$4078` stable service JMP vectors

Overlay:

- `$6000` `OVL_INIT`
- `$6003` `OVL_RUN`
- `$6006` `OVL_RX_SOH`
- `$6009` `OVL_RESUME`
- `$600C` `OVL_SHUTDOWN`
- `$600F` `OVL_EVENT`

The CHAT implementation begins at `$6040`.

## What was moved into the resident kernel

- Serial Pro card detection and slot patching
- Serial Pro / 6551 byte driver
- VideoTerm card engagement and low-level screen primitives
- G16 negotiation
- Keyboard hardware input
- DOS 3.3 File Manager primitives
- DOS file encoders
- resident screen/string helpers required by the above

The CHAT overlay retains:

- input/editor loop
- menu and navigation
- history management
- A2 legacy file-control parser
- GPT16 normal UTF-16LE response processing
- Unicode-to-VideoTerm mapping
- splash/logo and user-facing text
- Applesoft `&GPT` integration
- GPT briefing / per-turn A2 policy strings

## First test

Assemble and load the **combined validation image**:

`GPT16_V6_10_SPLIT_LAYOUT.S`

Load at `$4000` and call:

`CALL 16384`

Expected behavior should match V6.09_DIAG:

1. normal startup/logo;
2. G16 HELLO/ACK/READY;
3. gateway reports `FILES=NONE`;
4. startup briefing returns `READY`;
5. prompt submission reaches `[T1] [T2] [T3] [T4]`;
6. existing A2 file creation remains functional.

Do not test Kermit yet. The transfer overlay is intentionally only a stub.

## Static checks performed

- Kernel end: `$4F27` (< `$6000`)
- CHAT end: `$7D1A` (< `$8400`)
- Shared state end: `$8C88` (< `$9000`)
- DOS workspace end: `$9496` (< `$9600`)
- 575 relative branches in the combined source checked; all are within -128..+127.
- Kernel, CHAT, and XFER-stub source partitions have no known cross-partition
  relative branches.
- The only resident-kernel callback into CHAT (`G16_SHOW_ERROR ->
  ENSURE_LINE_START`) was removed and replaced with a kernel-local equivalent.

These are static source/layout checks, not a claim that ASM_core.js has assembled
or executed the new files yet.
