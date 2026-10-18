# SID Phase 2B.2 — Interactive PSID v1/v2 loading and playback

Phase 2B.2 adds a **browser-only** PSID selector to the SID card's existing
**Peripheral Controls** toolbox. No Node.js, terminal, external service,
C64 emulator or pre-rendering is required. The selected .sid file is read
locally by the browser; RetroAppleJS executes the original 6502 music code
and observes its unmodified $D400–$D41F SID register writes.

## User guide

1. Start a **disposable** Apple II/II+ emulator session in **TEXT** mode,
   with the JavaScript 6502, CPU speed 100%, and the **Applesoft BASIC prompt**
   visible. Do not run DOS/ProDOS, games, interrupt-dependent programs, or
   unsaved BASIC code alongside the foreground player. A PSID's absolute
   memory references may overwrite BASIC workspace and other RAM.
2. Mount **MOS 6581/8580 SID** (PCODE `SID`) through the Slot Manager,
   preferably in slot 4. Enable the emulator's main sound control and
   ensure `SIDAUDIO` is attached.
3. Open **Tools → Peripheral controls → SID**. Click **PSID** beside
   **Telemetry**, then select a local `.sid` file.
4. The window displays detected PSID version, song count, executable
   address, INIT/PLAY, clock rate, and payload size.
5. Optionally choose a **subtune** and the **staging address** (hex without
   the dollar sign, default `6000` or `2000` for larger songs).
   Only the entire file's staging origin changes; the native executable's
   original C64 absolute load address remains unmodified.
6. Click **Play** from the Applesoft prompt. RetroAppleJS installs the file,
   player and descriptor directly in Apple II RAM, then sends
   `CALL 7168` plus RETURN through the **existing Apple II keyboard
   text pipe**. The Apple II's *own CPU* runs the resident foreground player.
   It does **not** force the CPU PC to a new value or reset the system.
7. Click **Stop** (or press any key on the emulator keyboard) to end
   playback. The player silences SID and restores its saved Apple II zero
   page. Click Play again to reinstall the original source file and restart.

**Important:** The Play button sends a BASIC command. It does not detect
whether Applesoft is waiting at its prompt; issuing it during another
running program may type characters into that program instead. The
interface reports that the command was sent, not that playback is proven
audible. Similarly, Stop sends an ordinary keyboard character; it does not
interrupt and forcibly terminate native CPU execution.

The browser uses the SID peripheral's existing controls for chip model,
clock, volume and native $D400 writes. When Play is requested, it enables
native interception, sets PAL (50 Hz) or NTSC (60 Hz) SID clock as indicated
by the compatible PSID's metadata, and honours an explicit 6581/8580
model preference. Where the header has no model preference, the user's
selected model remains unchanged.

## Supported and rejected formats

Browser preflight mirrors **Phase 2B.1**:

- Accept PSID **v1 or v2**, fixed or embedded little-endian PRG load address,
  one SID, explicit INIT/PLAY within a RAM-resident payload, selected VBI
  subtune at 50 or 60 Hz.
- Reject RSID, PSID v3/v4, MUS, PlaySID-specific samples, CIA-timed subtunes,
  multi-SID tunes, PLAY=$0000 IRQ-vector drivers, unsafe declared executable
  addresses, and oversized/out-of-window complete files.
- The file may be staged anywhere from **$2000 through $8FFF** provided the
  whole file fits, including its PSID header. Maximum is **28 KiB total**.
- Original executable destination may lie in **$0C00–$BFFF** but cannot
  overlap the resident **$9000–$95FF** work area. Mr. Heli's original
  $0CA0–$1F0A code overlaps the $1C00 entry stub, which the player
  restores after returning.
- Successful header preflight does **not** guarantee arbitrary C64 tunes
  work: undocumented opcodes, C64 ROM/6510/VIC/CIA dependencies and
  out-of-payload RAM assumptions remain unsupported.

## Memory and implementation

| Address | What occupies it |
|---|---|
| $1C00–$1C0B | Compiled public Phase 2B.1 entry stub |
| $2000–$8FFF | Variable complete PSID file staging (28 KiB window) |
| $9000–$92A3 | Exact compiled Phase 2B.1 676-byte foreground runtime |
| $9400–$9411 | 18-byte playback descriptor |
| $9500–$95FF | Original Apple II zero page backup |

The new `res/EMU_SID_PSID.js` supplies a dependency-free browser parser,
descriptor generator, RAM installer and user interface. The native player
binary is compiled from `asm/AUDIO/SID_PHASE2B1_PLAYER.S` and
embedded in this browser module as byte arrays: the tests check that
**all 688 bytes match** the existing assembly output. No runtime assembler,
external fetch, dynamic compilation or WebAudio replacement is involved.

Before modifying RAM, the browser parses and validates the whole file and
staging footprint. It refuses to overwrite RAM while the installed foreground
player's ACTIVE byte is asserted. It obtains a physical RAM snapshot with
`hw.safe_flashdump()`, applies staged PSID, entry stub, runtime and descriptor
to a copy, and loads the result through `hw.load_ram64k()`. The normal
video RAM shares the same physical RAM buffer, and unrelated bytes are
preserved. The existing native checksum verifies the staged payload again
**inside the 6502** before copying its original code into place.

The JS module retains an in-memory copy of the selected file, so replay is
possible even when the previous native copy overwrote its original staging
area. No file contents leave the browser.

## Tests and future work

`tests/sid_phase2b2.test.js` runs in the repository's dedicated GitHub
Actions SID-native workflow alongside Phase 2A, Phase 2B.1 and SID peripheral
regressions. It covers v1/v2 original Mr. Heli metadata, identical payload,
byte-exact embedded player image, atomic RAM installation, rejection without
RAM mutation, staging limits and **actual RetroAppleJS 6502 execution of both
formats** with identical native SID register writes, 50 Hz timing, zero-page
restoration and mute-on-exit. The user does not need a local test tool.

Interactive browser listening and keyboard focus still deserve a smoke test
on target browsers. This is foreground playback, not an IRQ/background player.
That separate scheduling work belongs to Phase 2C.
