# Vertical blank render lock

Apply this follow-up after the Vaporlock scanner/floating-bus patch. It uses
the live JavaScript CPU and shared beam clock; the WASM accelerator remains
outside scope.

## SYSTEM control

In SYSTEM tab 1.1, click the displayed FPS value to enable vertical blank
lock. A lock pictogram replaces the value and the FPS slider is disabled.
Click the lock to restore the previous timer FPS and enable the slider.
Keyboard focus plus Enter or Space performs the same toggle. The CPU speed
setting is preserved. Timer mode remains the default.

Locking sets the SYSTEM processing cadence to 60 slices per second at the
nominal 1,021,800 Hz clock. These slices run the emulator; they do not decide
which screen image to display. A frame becomes eligible for display when
the emulated beam enters vertical blank at field cycle 12,480. Fields repeat
every 17,030 cycles (262 lines of 65 cycles).

## Capture and presentation

A redraw of current RAM and the final graphics switch at vertical blank
would lose mode changes within the field. The capture therefore records
the physical RAM byte and effective text/lores/hires mode for each of the
40 visible fetches on each of 192 scanlines. A CPU access first captures the
beam fetch at its effective bus cycle, then applies its memory or switch
side effect. The following fetch sees the new value or mode.

Each completed frame contains immutable byte and mode planes. Partial
fields after enabling capture or resetting are discarded. Safe debugger
reads do not advance capture. Machine reset also discards any retained
frame awaiting browser presentation.

| MUX device | Locked presentation |
| --- | --- |
| Canvas | Shared raster pixel calculation into one ImageData submission |
| GPU | Dedicated GPU.js graphical kernel using captured planes |
| Wave | Captured text/lores and the existing waveform/YIQ path for hires |
| Three.js | Captured GPU output uploaded to its screen texture, bypassing timer texture throttling |

The browser presents the latest completed field on its next animation
frame. If emulation completes multiple fields before browser refresh,
earlier completed fields are coalesced. Lock follows emulated VBL; it cannot
force the physical display refresh rate. A paused CPU retains the last
completed image. Renderer selection can present that same captured frame.
Unlock restores the current motherboard modes and resumes normal redraws.

Capture resolves mode changes at a seven-pixel byte fetch, rather than at
every composite-video subcycle. It preserves the horizontal text/hires
windows produced by Elliott's 65-cycle loop within that timing model.

## STEP TRACE display scenario

Keep the existing instruction-level Vaporlock scenario for scanner and
bus assertions. Add this presentation check after those assertions:

1. Select a MUX device and set timer FPS to a recognizable value, such as 37.
2. Click the FPS value. Verify the lock pictogram and disabled slider.
3. Load the WINDOWTOGGLE program and run its setup, then its repeating
   65-cycle text/hires loop. Resume execution long enough to complete a
   whole field. Verify horizontal text/hires windows rather than a screen
   rendered entirely in the loop's last mode.
4. Pause execution. Safe memory inspection must preserve the displayed
   completed frame. Single instruction steps update capture, with screen
   presentation occurring only after a whole visible field reaches VBL.
5. Repeat the display check with Canvas, GPU, Wave and Three.js. The Wave
   hires region retains its waveform filtering; Three.js retains its scene.
6. Reset while a frame is awaiting presentation. No pre-reset frame may be
   submitted after reset. Resume to obtain a newly completed field.
7. Click the lock. Verify that the slider is enabled, 37 FPS returns, and
   normal timer redraws resume without changing the CPU speed setting.

Automated regression coverage:

```sh
node --test tests/apple2_vaporlock_bus.test.js tests/video_vblank_lock.test.js
```

The display tests execute the actual Canvas, GPU, Wave and Three.js producer
paths with the bundled GPU.js CPU backend, plus its real static WebGL array
upload class for timer/lock transitions. They run an Elliott-style 65-cycle
CPU loop and check its mode strips on all 192 visible lines. They do not
boot the complete attached WINDOWTOGGLE binary or exercise a native WebGL
context/Three.js scene; the browser scenario above covers that final check.

Patch verification: all 28 focused bus/display tests passed. The full
JavaScript suite ran 440 tests: 412 passed and 28 failed, with exactly the
same failing test names as the pre-patch baseline. All changed JavaScript
files passed syntax checks.
