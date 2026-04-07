# `IO_map(model)` in `EMU_apple2io.js`

`IO_map(model)` is the function that turns a **human-readable Apple II I/O specification** into a **runtime dispatch table**. Its output is later stored in `ACTION_MAP`, and `Apple2IO.read()` / `Apple2IO.write()` use that map to decide whether a given I/O address should trigger a side-effect such as reading the keyboard strobe, toggling the speaker, or switching graphics modes.

In the default configuration of this repo at commit `7a067c8`, the active machine is `A2P` (Apple II Plus). In `_CFG_IORANGES`, `A2P` belongs to the second model group: `A2,A2P,A2PE,A2JP,A2B`. That is why, in practice, `IO_map("A2P")` selects the Apple II / Apple II Plus family behavior.

## Purpose

The function has two roles:

1. It builds a **descriptive table** of all known Apple-family I/O addresses.
2. It filters that table down to the **small subset of addresses that actually have implemented JavaScript callbacks** for the current machine model.

So the important distinction is:

- `IOMAP_TBL` = documentation/debug table
- `output` = executable lookup table returned to the emulator core

---

## 1. Input: the current model

The function is called as:

```js
var ACTION_MAP = IO_map(EMU_system_get());
```

So `model` is whatever `EMU_system_get()` returns. In the current setup, that is effectively `A2P`.

---

## 2. Family letters used inside the embedded I/O map

Inside `IO_map()`, the large `IOMAP` string uses family letters to say which machines support each I/O address.

The code comment defines them as:

- `O` = Apple II / Apple II Plus family
- `E` = Apple IIe family
- `C` = Apple IIc family
- `T` = Apple III family
- `G` = Apple IIgs family

A useful correction to the earlier notes: there is also a `T` family for Apple III, not only `O/E/C/G`.

---

## 3. The embedded `IOMAP` string

The function contains a very large multiline string named `IOMAP`. Each line is a fixed-width record describing one I/O location. The columns are parsed as:

- address
- symbolic name
- machine family letters
- access type
- description

Typical entries look like this conceptually:

```text
C000 KBD          OEC G  R   Last Key Pressed + 128
C010 KBDSTRB      OECTG WR   Keyboard Strobe
C030 SPKR         OECTG  R   Toggle Speaker
C050 TXTCLR       OECTG WR   Display Graphics
```

The content is clearly based on classic Apple I/O memory maps, and the code itself cites the same two reference pages:

- kreativekorp Apple II I/O memory page
- guidero Apple II I/O page notes

---

## 4. How `IOMAP_ID` is chosen

`IOMAP_ID` is not the index of a specific machine like `A2P` inside a flat list of machines. It is the index of the **matching machine group** inside `_CFG_IORANGES`.

The groups in `COM_CONFIG.js` are:

1. `A1`
2. `A2,A2P,A2PE,A2JP,A2B`
3. `A2E,A2Ee,A2eP`
4. `A2c,A2cM`
5. `A3,A3P,A3R`
6. `A2G3,A2GS`

For `A2P`, the matching group is the second one, so `IOMAP_ID` ends up as `1`.

So more precisely:

> `IOMAP_ID` identifies the matching `_CFG_IORANGES` **group**, not the individual model string itself.

---

## 5. How one `IOMAP` line is parsed

The parser walks through the multiline string one line at a time and extracts:

- `addr` = 4-hex-digit address like `C000`
- `addr_n` = numeric offset from `$C000`
- `name` = symbolic I/O name
- `family` = family mask string such as `OEC G`
- `act` = access flags like `R`, `WR`, `R7`, `V`
- `desc` = human description

A useful detail: if the address column is blank, the code reuses the previous address. That is why several symbolic meanings can share the same address, such as `C000 KBD`, `C000 80STOREOFF`, and `C000 KBDBUSA`.

The offset `addr_n` is computed like this:

```js
var addr_n = parseInt(addr,16)-0xC000;
```

So:

- `$C000` becomes `0x00`
- `$C010` becomes `0x10`
- `$C030` becomes `0x30`
- `$C050` becomes `0x50`

That matters because `Apple2IO.read()` and `write()` work with these `$C000`-relative offsets.

---

## 6. How the current model is matched against each line

For each parsed row, the code derives a per-family boolean map:

```js
var family_C = {
  1: family.charAt(0)=="O",
  2: family.charAt(1)=="E",
  3: family.charAt(2)=="C",
  4: family.charAt(3)=="T",
  5: family.charAt(4)=="G"
};
```

For `A2P`, `IOMAP_ID == 1`, so the parser only keeps rows where the `O` family applies.

This is the link between:

- `_CFG_IORANGES` group selection
- family letters in the `IOMAP` string
- implemented callbacks in `IOMAP_CALLS`

---

## 7. `IOMAP_TBL`: the descriptive table

For every parsed line, the code appends a row to `IOMAP_TBL`:

```js
IOMAP_TBL.push(["0x"+addr,name,iomap_str,act_name_str,desc])
```

So `IOMAP_TBL` is a **human-readable expansion** of the raw fixed-width `IOMAP` string. It is used for console logging and markdown-style debug output. It is not the structure that `read()` and `write()` consult at runtime.

That means:

> `IOMAP_TBL` is a descriptive/debug table, not the final fast runtime lookup. The real runtime lookup is the returned `output` object.

---

## 8. The commented-out bitmap variant

There is a commented alternative:

```js
// IOMAP_TBL.push(["0x"+addr,name,"0b"+oCOM.getBinMulti(iomap_bitmap,16),act_names,desc])
```

Yes, that version is appealing because it stores machine applicability as a bitmask rather than a long comma-separated string. That would be more compact and more suitable for fast testing.

But in the current code, it is only a commented-out alternative for how `IOMAP_TBL` could be displayed. It does **not** affect runtime dispatch today.

---

## 9. `IOMAP_CALLS`: the implemented side-effects

`IOMAP_CALLS` contains the actual JavaScript functions that perform side-effects. In this commit, only index `1` is defined, which corresponds to the Apple II / Apple II Plus family.

The implemented callbacks are:

- `KBD`
- `KBDSTRB`
- `SPKR`
- `TXTCLR`
- `TXTSET`
- `MIXCLR`
- `MIXSET`
- `TXTPAGE1`
- `TXTPAGE2`
- `LORES`
- `HIRES`

These callbacks call into `keys`, `snd`, and `vid`, for example:

- read keyboard state
- clear keyboard strobe
- toggle speaker
- switch text/graphics mode
- switch mixed/fullscreen mode
- switch page 1/page 2
- switch lores/hires mode

So:

> `IOMAP_CALLS` does not cover the whole Apple I/O map. It only contains the subset of addresses that this emulator currently implements for the selected family.

---

## 10. How the final `output` map is built

The function starts with:

```js
var output = {"WR":{},"RD":{},"RR":{},"SV":{},"VA":{}};
```

Then, for each parsed row, if both conditions are true:

1. the row applies to the current model family
2. a callback exists in `IOMAP_CALLS[IOMAP_ID][name]`

the callback is inserted into one or more sub-maps in `output`.

Conceptually, the output is meant to group handlers by access type:

- `WR` = write-triggered actions
- `RD` = read-triggered actions
- `RR` = double-read style entries
- `BT` = bit-status reads
- `RG` = byte register reads

For `A2P`, only `WR` and `RD` matter, because the implemented callbacks in `IOMAP_CALLS[1]` all belong to those categories.

---

## 11. What `IO_map("A2P")` actually returns in practice

For the Apple II Plus case, the returned map is effectively a small dispatch table like this:

### Read handlers

- `0x00` → `KBD`
- `0x10` → `KBDSTRB`
- `0x30` → `SPKR`

### Write handlers

- `0x10` → `KBDSTRB`
- `0x50` → `TXTCLR`
- `0x51` → `TXTSET`
- `0x52` → `MIXCLR`
- `0x53` → `MIXSET`
- `0x54` → `TXTPAGE1`
- `0x55` → `TXTPAGE2`
- `0x56` → `LORES`
- `0x57` → `HIRES`

So the final runtime lookup is small and focused, even though `IOMAP_TBL` lists a huge amount of Apple-family I/O metadata.

---

## 12. How `ACTION_MAP` is used later

After `IO_map(model)` returns, the result is stored in `ACTION_MAP`.

Later:

- `Apple2IO.read(addr)` checks `ACTION_MAP.RD[addr]`
- `Apple2IO.write(addr, d8)` checks `ACTION_MAP.WR[addr]`

If a handler is found, the corresponding function is executed immediately. This is how the emulator turns a read or write to an I/O address into a soft-switch action.

---

## Notes and caveats in the current implementation

### `IOMAP_TBL` is not the executable fast path

This is the biggest conceptual distinction. The function builds `IOMAP_TBL` mostly for display/debugging, but the actual emulator uses the returned `output` object.

### `RR` detection looks unfinished

The code checks:

```js
if(act.slice(1,2)=="RR")
```

That slice only returns one character, so it cannot equal `"RR"`. This suggests the intended “double-read” path is not fully wired in the current implementation.

### `output` is initialized with `SV` and `VA`, but later the code writes `BT` and `RG`

The initial object is:

```js
{"WR":{},"RD":{},"RR":{},"SV":{},"VA":{}}
```

but later the code uses `output.BT[...]` and `output.RG[...]`. That is inconsistent. It does not break the current `A2P` path because the Apple II Plus callbacks only use `WR` and `RD`, but it is still a sign that this part of the parser is unfinished or mid-refactor.

---

## Concise summary

`IO_map(model)` is a **parser + filter + dispatcher builder**:

1. It reads a big embedded Apple-family I/O specification.
2. It figures out which family group the current model belongs to.
3. It parses all I/O rows into a readable debug table.
4. It keeps only the rows relevant to the current model.
5. It keeps only the names that have real JavaScript callbacks in `IOMAP_CALLS`.
6. It returns a compact address-to-function map used by `Apple2IO.read()` and `write()`.

## Repo context

- Repo: `RetroAppleJS/RetroAppleJS.github.io`
- Commit: `7a067c8ca30d30a41ea2f8bb9205a172dabaa507`
- Main files discussed:
  - `res/EMU_apple2io.js`
  - `res/COM_CONFIG.js`
