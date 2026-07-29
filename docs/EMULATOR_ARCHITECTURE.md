## Emulator Architecture
 
### Modular setup

    ┌─ VISUAL LAYER ──┐  ┌─── CPU ──────┐
    │    index.html   │──│EMU_cpu6502.js│
    └───────┬─────────┘  └─────┬────────┘
            │                  │
    ┌─── UI LAYER ────┐ ┌── HARDWARE ───┬───┐
    │EMU_apple2main.js│ │EMU_apple2hw.js│RAM│
    └─────────────────┘ └──────┬────────┴───┘
                               │                   ┌───────── DEVICES ────────────┐
                       ┌───── I/O ─────┐┌───┐      │EMU_DEVICE_keyboard.js        │
                       │EMU_apple2io.js││ROM│      │EMU_DEVICE_speaker.js         │
                       └───────┬───────┘└───┘      │EMU_DEVICE_gameport.js        │
                               │                   │EMU_DEVICE_video_MUX.js       │
                       ┌── PERIPHERALS ───────┐    │ │                            │
                       │    EMU_CARD_hostio.js┼────┤ │ │EMU_DEVICE_video_GPU.js   │
                       │   EMU_CARD_ramcard.js│    │ └─┤EMU_DEVICE_video_wave.js  │
                       │EMU_CARD_appledisk2.js│    │   │EMU_DEVICE_video_THREE.js │
                       │         ...          │    │   │EMU_DEVICE_video_canvas.js│
                       └──────────────────────┘    └──────────────────────────────┘


The emulator was made modular for extensibility.  Adding or tweaking virtual hardware features should be achieved with ease.
Therefore, an additional piece of codebase framework was developed to detect, classify, test, initialise and keep all the virtual hardware in check.  This framework is very similar to how OS kernels are built and assure a safe boot sequence regardless of any dysfunctioning virtual hardware components or peripherals.  While video is just one of the many hardware devices, this operating system can boot perfectly without the presence of any video devce, while the Apple II+ operating system does not make it to the blinking prompt without writing approximately in 1240 different RAM memory locations.  Memory mapped I/O including text output is mainly the reason why the Apple II+ needs a minimum of 2KBytes of RAM.

The kernel boot process 
- **inventorise eligible components**  All self-declared include files are classified and validated after which they are listed as eligible emulator components.  Only eligible components listed as such can activated into the current configuration, even if the current is loaded from a preset configuration, non-eligible components simply will never run.
- **initialise current configuration** (a datastructure that describes all the components currently in use, before this config is loaded, it is checked against the eligible components)  Components can be turned on and off, but they can only be turned on, if they are marked as eligible component.
- **preset configurations** called SYTEMS, presented as a dropdown menu. Each time a preset is selected, it overwrites the current configuration


