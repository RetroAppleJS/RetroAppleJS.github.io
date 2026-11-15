# RetroAppleJS Coding Style Guide

This document defines the basic coding conventions for contributing to RetroAppleJS. The main goals are readability, predictable structure, easy debugging, and compatibility with the existing vanilla JavaScript codebase.

## 1. File Loading

All first-party JavaScript and CSS required by the **emulator, assembler, debugger, and built-in UI** must be declared explicitly as static `<script src="...">` and `<link rel="stylesheet" href="...">` includes in `index.html`. This includes code and styles for optional built-in features: an optional UI may be initialized on demand, but its application files are still included statically.

**Do not dynamically load any integral project code or styles.** In particular, do not create script or stylesheet elements at runtime, use dynamic `import()`, or retrieve bundled JavaScript/CSS through `fetch()` or XHR. A built-in module must not load other built-in modules or styles behind the scenes. The explicit declarations in `index.html` are also what the standalone `dist/RetroAppleJS.html` builder uses to inline local code and CSS.

```html
<link rel="stylesheet" href="res/DBG_steptrace_scenario_layout.css">
<script src="res/DBG_steptrace_scenario.js"></script>
<script src="res/DBG_steptrace_scenario_layout.js"></script>
```

The loading order in `index.html` must reflect dependencies between modules. Avoid hidden dependencies on files loaded indirectly by another module. JSON configuration belonging to the application should be declared in an appropriate static JavaScript source file rather than fetched as another application include.

**User-loaded code is a separate, ephemeral mechanism.** Users may upload their own source code or programs and run scripts inside the application through its dedicated user-facing tools. Such user-supplied content is runtime input, not part of the application's integral codebase: do not add it to `index.html`, bundle it into the standalone distribution, or treat its dynamic execution as an exception permitting the dynamic loading of built-in project modules. 

---

## 2. Object Containers

Major subsystems should normally be grouped inside a clearly named object container.

```javascript
var DISKII =
{
    drive: 0,
    motorOn: false,
    phase: 0,

    reset: function()
    {
        this.drive = 0;
        this.motorOn = false;
        this.phase = 0;
    },

    selectDrive: function(drive)
    {
        this.drive = drive;
    }
};
```

Use the following order inside an object:

1. constants and configuration
2. state/properties
3. initialization methods
4. public methods
5. helper/internal methods

Keep related state and behaviour together rather than spreading one subsystem over unrelated global functions.

Do not create classes merely for stylistic reasons. Prefer the existing object-container style unless inheritance or independent object instances are genuinely required.

---

## 3. Naming

Use descriptive names.

```javascript
diskImage
cycleCount
selectedDrive
updateDisplay()
readSector()
```

Avoid unnecessary abbreviations except for well-established Apple II terminology such as:

```text
CPU
RAM
ROM
DOS
ProDOS
I/O
DISKII
```

Constants should use uppercase names where practical:

```javascript
var SECTOR_SIZE = 256;
var TRACK_COUNT = 35;
```

Boolean variables should clearly describe a state:

```javascript
motorOn
isRunning
writeProtected
debugEnabled
```

---

## 4. Functions

A function should have one clear responsibility.

Prefer:

```javascript
function loadDisk(data)
{
    parseDisk(data);
    updateDiskUI();
}
```

over large functions that mix parsing, emulation, UI handling, logging, and file operations.

If the same algorithm appears more than once, consider extracting it into a reusable function.

---

## 5. Global Namespace

Avoid adding unnecessary global variables.

Subsystem state should belong to its object container:

```javascript
var VIDEO =
{
    mode: 0,
    page: 1,
    mixed: false
};
```

instead of:

```javascript
var videoMode;
var videoPage;
var videoMixed;
```

Existing public globals used by the emulator may remain global when changing them would unnecessarily complicate the architecture.

---

## 6. UI and Emulator Logic

Keep emulator logic separate from UI logic whenever practical.

Prefer:

```javascript
DISKII.insert(image);
UI.updateDriveStatus();
```

rather than making `DISKII` directly manipulate unrelated DOM elements.

UI event handlers should normally call subsystem methods rather than contain emulator logic themselves.

---

## 7. DOM Access

Reuse DOM references where an element is accessed repeatedly.

```javascript
var element = document.getElementById("diskStatus");
```

Avoid repeatedly searching the DOM inside high-frequency emulator or rendering loops.

Do not place expensive DOM operations in CPU-cycle or timing-critical code.

---

## 8. Formatting

Use four spaces for indentation.

Opening braces are placed on the next line:

```javascript
if (motorOn)
{
    rotateDisk();
}
else
{
    stopDisk();
}
```

The same style applies to functions, loops, objects, and conditionals.

Use semicolons consistently.

Keep lines reasonably short and expressions readable.

---

## 9. Comments

Comments should explain **why**, not merely repeat what the code already says.

Good:

```javascript
// DOS 3.3 expects the controller ROM at the slot-specific $Cn00 address.
```

Avoid:

```javascript
// Set drive to 1.
drive = 1;
```

Hardware-specific behaviour, undocumented Apple II behaviour, timing assumptions, and compatibility workarounds should be documented particularly carefully.

---

## 10. Hardware Emulation

When implementing Apple II hardware:

- prefer behaviour documented by original manuals, ROMs, schematics, or measured hardware;
- preserve cycle-sensitive behaviour where relevant;
- document intentional deviations or approximations;
- avoid introducing browser/UI assumptions into hardware emulation code;
- use hexadecimal notation for addresses and hardware values where this improves clarity.

```javascript
var SLOT_ROM = 0xC600;
var IO_BASE  = 0xC0E0;
```

---

## 11. Compatibility

RetroAppleJS should remain based on standard browser technologies whenever practical.

Prefer:

- vanilla JavaScript;
- standard HTML;
- standard CSS;
- browser-native APIs.

Avoid introducing frameworks or external dependencies for functionality that can reasonably be implemented within the existing codebase.

---

## 12. Changes and Refactoring

Keep contributions focused.

Do not combine an unrelated architectural refactor with a small bug fix.

When refactoring:

- preserve existing behaviour;
- deduplicate repeated code;
- reuse existing buffers and utilities where appropriate;
- avoid changing public interfaces unnecessarily;
- test affected peripherals and emulator paths.

New code should fit the existing architecture rather than creating a second competing coding pattern.

---

## Guiding Principle

RetroAppleJS emulates comparatively simple historical hardware, and its source should remain understandable in the same spirit.

Prefer:

**clear code over clever code, explicit behaviour over hidden behaviour, and small reusable components over unnecessary abstraction.**
