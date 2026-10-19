# SID Phase 2C.2 — One-BLOAD native background PSID player

The complete **6502 assembly** program is authored in
`asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S`. The browser copies original
PSID bytes but **never parses or plays the music**. The SID card's CPU-clock
IRQ continues calling the original C64 music PLAY routine while compatible
foreground Apple II software runs.

## Install using ONE BLOAD (no Language Card)

The build creates **one contiguous binary**, starting at **$8000**,
containing both the native interactive parser and resident playback/IRQ
routines. Any gaps between the assembly ORGs are included as zero-filled
padding. The binary file does not need multiple memory transfers.

The GitHub Actions SID-native workflow publishes:
- `SID_Phase2C2_player.bin`: raw 6502 image for disk import tools that
  accept an explicit $8000 load address.
- `SID_Phase2C2_DOS33_file_content.bin`: **DOS 3.3 binary file contents**,
  beginning with the four-byte little-endian load-address/length header,
  followed by the same player image. Import as DOS binary type **B** when
  the importer expects full DOS file contents. Do **not** prepend this
  header twice if a disk tool constructs it automatically.
- `SID_Phase2C2_player_monitor.txt`: one continuous monitor-memory listing.
- `SID_Phase2C2_manifest.json`: exact load extent and callable decimal
  entry addresses derived **from the assembled symbols**.

After placing the program on your ProntoDOS/DOS-compatible disk as a
**binary file named SIDPLAYER**, boot the Apple II and enter:

```text
BLOAD SIDPLAYER
```

This loads the entire player, starting at $8000, in one operation.
The header carries its original loading address. You can also assemble
the original `.S` directly in RetroAppleJS and paste the address-tagged
byte code; disk/BLOAD is a convenience, **not** a build dependency.

The program requires **ordinary Apple II+ RAM**, no 16K Language Card.
This layout assumes ProntoDOS and other reserved memory begin at $9600,
and that no foreground program occupies the player's $8000–$95FF area.

## PSID transfer and initial playback

Mount SID in **slot 4** with audio enabled. The raw file transfer window
automatically recognises the installed player via `S2C2` at $8FF0 and
limits raw files to **8 KiB**, with staging entirely within **$6000–$7FFF**.
This prevents the file upload from overwriting the resident interpreter.
Other, older SID loaders retain their previous transfer-size rules.

Upload the original PSID file at $6000. It remains unchanged. The native
assembly asks for its start address and subtune, checks PSID v1/v2 header,
file length, speed flags, original load address, INIT/PLAY and executable
destination, and launches IRQ-driven music. All original 6502 code remains
unmodified; its executable must fit below $8000 without colliding with
allocated foreground RAM. The eight-byte `SIDF` transfer record is
initially kept at $9430, and becomes part of the music-ZP shadow after
successful INIT.

**The first-load entrypoint is at $8000:**

```basic
CALL 32768
```

The command will return to Applesoft after INIT while original PLAY
continues under the hardware timer's 50/60 Hz IRQ.

## STOP, replay and subtune selection

The program has no special $1C00 jump table. **Use the exact decimal
addresses from `SID_Phase2C2_manifest.json`** for the installed binary:

| Manifest key | Native call |
|---|---|
| `startCall` | First-time interactive PSID loader at $8000 |
| `stopCall` | Silence SID, stop timer and restore previous IRQ owner |
| `replayCall` | Restart current subtune via original INIT |
| `nextSubtuneCall` | Select the following subtune (wrap after last) and restart |

The latter three call addresses are derived from assembler labels and
should **not** be assumed to equal old Phase 2C.2 numeric constants
(`36867`, etc.).

The native player saves original INIT and PLAY addresses, selected
subtune, song count and speed bitmap in resident memory. Therefore STOP
followed by REPLAY does **not** need the raw transfer record or reassembled
player. NEXT SUBTUNE also uses resident metadata and refuses tunes marked
CIA-timed (unsupported); it is not a request to parse the raw header on
every music interrupt.

To choose a wholly different PSID, stop playback, upload another raw
file, and use the interactive first-load entry. Because the descriptor at
$9400 has been reused for the music ZP shadow, the full native player
should be freshly BLOADed before loading a different tune. This does not
require a new assembler run.

## RAM map

| Addresses | Occupant |
|---|---|
| $6000–$7FFF | Raw PSID staging (8 KiB maximum) |
| $8000–$8FFF | Permanent native parser and single-image loader marker |
| $9000–$93FF | Permanent playback, IRQ and control routines |
| $9400–$94FF | Persistent C64 music-ZP shadow (initially descriptor/transfer record) |
| $9500–$95FF | Foreground ZP backup |
| $9600 and above | ProntoDOS, untouched by the player |

The player image occupies a **contiguous physical range** from $8000 to
the final assembled resident byte below $9400; code gaps in the single
BLOAD image are harmless padding. Both runtime context pages ($9400,
$9500) are RAM working buffers and are **not** part of the disk binary.

An original tune's load region must fit below $8000, so that it cannot
overwrite the parser or resident IRQ engine. A tune can still overlap
Applesoft, DOS buffers below $8000, or raw PSID staging; such collisions
are outside the player guarantees.

## IRQ timing and limits

The music service uses the proven CPU-clock SID timer, not display
FPS, video VBLANK polling or browser audio callbacks. On each IRQ it
acknowledges its own SID timer source, saves X/Y, saves 256 bytes of Apple II
foreground zero page, swaps in 256 bytes of music zero page, executes the
original PLAY, swaps the contexts back, restores CPU registers and RTI.
It chains foreign IRQs to the previous soft vector.

This is **experimental coexistence**, not arbitrary memory virtualisation:
- Apple's Monitor IRQ path writes interrupted A to foreground ZP $45
  before the soft IRQ handler gains control.
- Music must use balanced 6502 stack operations and must not overwrite
  foreground applications' RAM, the player's $8000–$95FF allocation,
  or interrupts and hardware owned by DOS.
- Music/foreground zero-page switching has substantial CPU overhead;
  measure missed IRQ deadlines and foreground throughput under 60 Hz.
- The first implementation requires slot 4, and PSID songs dependent on
  CIA timing or other unsupported C64 hardware are rejected.

The automated CI tests exercise native PSID v1/v2, repeated INIT/PLAY,
STOP, replay, subtune selection, memory boundaries, one-image binary
headers, and foreground program execution. Browser audio acceptance is
still required for new tune families.
