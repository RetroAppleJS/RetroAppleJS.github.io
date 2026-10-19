# SID Phase 2C.1 — resident IRQ timer diagnostic

This phase implements the **timer and foreground/IRQ coexistence** foundation
only. It does **not** execute PSID music in an IRQ yet.

## Assembly-first workflow

Load `asm/AUDIO/SID_PHASE2C1_IRQ_TIMER.S` into the RetroAppleJS assembler,
choose the RetroAppleJS dialect, click Assemble, then use
Tools → to emulator → Paste.

The source has two `ORG` sections:
- `$1800+` native install/remove calls
- `$9300–$93F7` resident IRQ handler, counts and saved state

The code remains below the ProntoDOS `$9600` boundary. Run from a
**disposable emulator session** with a SID peripheral in slot **4**.
Do not run the older Phase 2B.2 resident player at the same time.

```basic
CALL 6144
```

Installs the 50 Hz timer IRQ, then returns to Applesoft. Foreground
software continues while resident RAM counter `$93F3/$93F4` increases
in the background. (Sample the counter from the Apple II Monitor with
`93F3.93F4`, then return to Applesoft.)

Use `CALL 6147` instead to start a 60 Hz timer.

```basic
CALL 6150
```

Disables the timer and restores the previously saved soft IRQ vector
at `$03FE–$03FF`, provided we still own it.

## Hardware register extension

All existing SID slot register **reads** remain identical. Timer controls
use formerly unused WRITE operations at SlotIO offsets $8–$B.

| Slot-4 address | Operation | Purpose |
|---|---|---|
| `$C0C8` | write | reload low byte |
| `$C0C9` | write | reload high byte |
| `$C0CA` | write | bit 0 enable/rearm; clear disables |
| `$C0CB` | write | bit 0 acknowledge pending SID IRQ |
| `$C0C2` | write $1D | select timer status (reserved indexed register) |
| `$C0C3` | read | when index=$1D: bit 0 pending, bit 1 enabled |

The timer counts **completed emulated CPU cycles** using the existing
`Apple2IO.tick` path. It does not depend on display FPS, RAF, WebAudio,
or wall-clock timers. Periodic deadlines are absolute. When an IRQ remains
pending across several periods, it remains a single level-asserted request
and records the number of missed deadlines rather than generating a storm.

Only its own `SID_TIMER_<instance>` source is acknowledged or disabled,
so unrelated IRQ sources are preserved. Stop, reset and peripheral unmount
also release the source. PAL uses 20,436 cycles and NTSC uses 17,030 cycles
at the ordinary Apple II 1,021,800-Hz CPU clock.

## Resident-program design provenance and limits

The installer/uninstaller follows the pattern used by
`asm/GFX/SERIALPRO_RTC_CLOCK_RESIDENT_v3.S`:
- separate stable CALL entrypoints
- save an old ROM software vector before replacing it
- disable the requesting device before removing the vector
- identify and acknowledge only the device's interrupt
- preserve registers and return to interrupted software

**Important distinction:** the Serial Pro clock uses **NMI** at
`$03FB`. The SID diagnostic uses **IRQ**, which passes through the Apple II
Monitor ROM and its soft vector `$03FE`. The ROM saves A at zero-page
`$45` on entry. Therefore Phase 2C.1 is an IRQ-counter diagnostic,
not a claim of arbitrary foreground zero-page transparency. Phase 2C.2
will require dedicated music ZP state, shadowing, and stronger safety rules.

No NMI handler is installed; this also avoids interfering with the
existing resident Serial Pro RTC NMI service.

### Compatibility constraints

- Slot 4 is fixed for this diagnostic; later phases can use the mounted
  slot dynamically.
- Other interrupt owners are chained, not acknowledged by the SID handler.
- The timer uses the shared 6502 IRQ line and is masked while the CPU's
  Interrupt Disable (I) flag is set. A foreground program with `SEI`
  can suppress music interrupts; the next phase must specify a safe
  configuration and install lifecycle before guaranteeing background audio.
- Native handler uses the foreground hardware stack, briefly preserving X/Y.
- This test does not protect music code/data regions, because it runs no
  music yet. Standard programs may still write the same RAM as the
  diagnostic installer/resident code.

## Automated acceptance

`tests/sid_phase2c1.test.js` verifies exact cycle boundaries,
acknowledgement, deferred/missed cycles, IRQ source ownership, resets,
unmounting, compatibility with existing SID read registers, and 50/60 Hz
native handler execution while a foreground 6502 counter continues.

The dedicated SID GitHub Actions workflow assembles the real source with
`ASM_core.js`, runs the real `EMU_cpu6502.js` with Apple II Monitor ROM,
and publishes optional binary/Monitor-format listings. No Node setup
is required by an interactive RetroAppleJS user.
