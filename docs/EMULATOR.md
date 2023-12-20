## EMULATOR User Instructions

<img src="../res/appleIIplus_bck_650.png?raw=true" width=39% align="left" />

While the end-user experience with this emulator hardly differs from the real hardware, there are some essential deviations, mostly to accomodate contemporary user expecations, like copy-paste.  There is no point in creating an emulator that is completely offline like it was mostly the case in it's pre-internet era.  This user manual is only discussing the usability deviations of the emulator compared to the bare metal.

For the last one, there is a huge body of 
[documentation](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Books/) available, and for more specific details on the global architecture of this very emulator, please check out the following document: [EMULATOR_ARCHITECTURE.md](EMULATOR_ARCHITECTURE.md)


__Most basic functions remain the same, but please mind the...__  

__Pasteboard feature__

__CPU speed settings__

__Disk feature__

__Screen settings__

**color mode**
<img src="../res/doc_emu_system_pane.png?raw=true" width=40% /> 


<br><br>

__Keyboard features__

<img src="../res/appleIIplus_kbd_650.png?raw=true" width=40% align="left"/>  

**physical keyboard** and **pop-up virtual keyboard** can be used interchangably.
**physical keyboard** activates when clicking inside the area of the emulated screen.
**virtual keyboard** activates when hovering over the area of the virtual keyboard.
**virtual keyboard** by default is configured for mouse-driven host computers where SHIFT, CTRL and REPT keys toggle on/off by means of 2 mouse clicks. 
**white power light** on virtual keyboard acts as a power button, which causes a cold-boot. (Instead of flip-switch located below the keyboard on a real Apple II) 
* **insert disk** icon allows loading any disk file found on the internet (.do, .dsk), after, perform a cold boot   
_note: mind that most Apple II disks do not self-boot, keeping a bootable disk image at hand reach is still required._  



__A handful extra functions make the experience complete__  
\* pasteboard: use the pasteboard to paste any text through the text prompt, just mind that a 1MHz computer takes this slowly.  
\* monitor: cycle color mode through apple color, black/white, green and amber  
\* pause: freeze/unfreeze CPU

__The 1MHz trick__  
JavaScript does not provide 1µs timing precision, but we have a workaround.  The setInterval() function located in EMU_apple2main.js, which drives the main loop of our emulator, starts a new sequence every 100ms.  Instead of cycling one time through the CPU emulator every 1µs, we cycle 100K times every 0.1s or 100ms.  By this trick, we achieve exactly the same performance as a real Apple II at 1MHz (100K cycles/0.1).  Just, all 100K cycles are far from equally spread accross this 100ms loop.  Most CPU's nowadays, effortlessly execute all 100K cycles in less than 5ms, which all sounds good, until one needs to emulate 'sound'. Below diagram explains the 1MHz trick visually :



          <div style=width:800px>
          
                                        :                   100ms                   :      
                                        ┌──────────────────────────────────────────┐┌─────...    ┐
      setInterval(appleInterval(),100)  │                                          ││            │
      (outer loop)                    ──┘                                          └┘            │
                                        :                                           :            │
                                        :                                           :            │                                        
                                        :<5ms                                       :<5ms        ├>  EMULATED
                                        :◄───►                                      :◄───►
                                        ┌┬┬┬┬┐                                      ┌┬┬┬┬┐       │   CLOCK
                                        ││││││                                      ││││││       │  
              apple2plus.cycle(10000) ──┘100K└──────────────────────────────────────┘100K└─...   │
              (inner loop)              :cycles                                     :cycles      ┘
                                        :                                           :
                                        : 1µs                                       :
                                        :/                                          :
                                        ┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐       ┐
              real Apple II at 1MHz   ──┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└...    ├>  HARDWARE
                                        :                 100K cycles               :            ┘   CLOCK
          </div>


![plantuml](http://www.plantuml.com/plantuml/png/ZOunJyCm48Lt_ugdJ21rE0yPs48g445YwifYdAjguTYMVMaGYFzEI8iQcDZkdhxtz3L5J9PnyChwQ5y1L7V3w8t4ZC6u01zZUWwFvcXsDhiasB5qGJWVZR-whc0AjeJ9oG69iuizD17Iw0lZfaRSxmiBIDaOh2lyTtvoeO_JQKQh75_68ci75mBdHM9XsXM3Kt8HpsmyRbFoZAw34UYdX_S5klybM9_rw6AdMXncZbIhbqDlvgmXjTLm1HM_iVrHLUsIVT16VyvCVVw_UKt_QMXQTLJ3eHy7_mK0)

  
__Impossible sound emulation__  
However simple sound production was designed on the Apple II, since 1997, JavaScript maintained **1ms** as the **highest achievable timing accuracy**.  While the 6502 CPU was clocked at approximately 1MHz, we need a 1000-fold more accuracy than JavaScript can provide today.  JavaScript simply cannot implement any timer-driven sound above it's nyquist maximum of 500Hz, while a typical Apple II Beep sound is 1KHz.

W3C recently started to worry about this limitation by proposing a new spec called ["High Resolution Time"](https://w3c.github.io/hr-time/) or [hr-time](https://w3c.github.io/hr-time/), but because of alleged malicious capability like [CACHE-ATTACKS] and [SPECTRE], W3C recommends to purposefully mess-up it's timers accuracy by reducing resolution, adding jitter, or by any other means that probably never will provide us anything near to 1µs clock accuracy.

Since we may never reach this accuracy, we have to think about how hard we need 1µs clock accuracy for sound emulation after all.  We can toggle the Apple II speaker on and off by reading the $C030 address location as often as we want.  But, knowing that frequencies above 20000Hz remain inaudible, we should mind about toggling the speaker only 40000 times per second = once every 25µs.  The "coarsen time" add-on proposed by W3C will by default deliver 100µs accuracy, but by setting the flag crossOriginIsolatedCapability = true, it may deliver 5µs.

In conclusion, we only need a maximum of 25µs timer accuracy, which [hr-time](https://w3c.github.io/hr-time/) will likely provide, fingers crossed! 


## Appendix

### Memory map


          <div style=width:800px>
     FFFF ┌────────────────────────────────────┐                      ▲ 
          │  Autostart ROM                     │  2K                  │
          │                                    │                      │
     F800 ├────────────────────────────────────┤                      │  12K
          │                                    │                      │  ROM
          │                                    │                      │     
          │  Applesoft ROM                     │  10K                 │
          │                                    │                      │
          │                                    │                      ▼
     D000 ├────────────────────────────────────┤                        
          │  I/O ROM/RAM                       │  2K                  ▲
          │                                    │                      │
     C800 ├────────────────────────────────────┤                      │  4K
          │  I/O Ports                         │  2K                  │  I/O
          │                                    │                      ▼
     C000 ├────────────────────────────────────┤                      
          │                                    │                      ▲     
          │                                    │                      │
          │                                    │                      │     
          │  Free                              │  24K                 │
          │                                    │                      │
          │                                    │                      │
          │                                    │                      │
     6000 ├────────────────────────────────────┤                      │
          │                                    │                      │     
          │  Hi-Res 2                          │  8K                  │
          │                                    │                      │
          │                                    │                      │
     4000 ├────────────────────────────────────┤                      │  48K
          │                                    │                      │  RAM   
          │  Hi-Res 1                          │  8K                  │
          │                                    │                      │          
          │                                    │                      │
     2000 ├────────────────────────────────────┤                      │
          │                                    │                      │     
          │  Free                              │  5K                  │
          │                                    │                      │
     0C00 ├────────────────────────────────────┤                      │
          │  Text & Lo-res graphics 2          │  1K                  │
     0800 ├────────────────────────────────────┤                      │
          │  Text & Lo-res graphics 1          │  1K                  │
     0400 ├────────────────────────────────────┤                      │
          │  System RAM  (zero page, stack..)  │  1K                  │
     0000 └────────────────────────────────────┘                      ▼


### Hard-wired keyboard functions ###

<img src="../res/appleIIplus_kbd_650.png?raw=true" width=40% align="right"/> 

**CTRL** and **SHIFT** keys generate no codes by themselves, but only after the codes produced by other keys.

The **REPT** key is pressed alone produces a duplicate of the last code that was generated.
If you press and hold down the **REPT** key while you are holding down a character key, it will act as if you are pressing that key repeatedly at a rate of 10 pressess each second. This repetition will cease when you release either the character key or **REPT**.

The **POWER** light at the lower left-hand corner is an indicator lamp to show when the power to the Apple is on.
As the physical power switch is located below the keyboard, for convenience, we turned the **POWER** light into a cold boot button.

|    Keys and their associated ASCII codes    |
| --------------------------------- |

| Key   | Alone | CTRL | SHIFT | Both |   | Key    | Alone | CTRL | SHIFT | Both |
| :---: | ----- | ---- | ----- | ---- | - | :----: | ----- | ---- | ----- | ---- |
| space | $A0   | $A0  | $A0   | $A0  |   | RETURN | $8D   | $8D  | $8D   | $8D  |
| 0     | $B0   | $B0  | $B0   | $B0  |   | G      | $C7   | $87  | $C7   | $87  |    
| 1!    | $B1   | $B1  | $A1   | $A1  |   | H      | $C8   | $88  | $C8   | $88  |
| 2"    | $B2   | $B2  | $A2   | $A2  |   | I      | $C9   | $89  | $C9   | $89  |
| 3#    | $B3   | $B3  | $A3   | $A3  |   | J      | $CA   | $8A  | $CA   | $8A  |
| 4$    | $B4   | $B4  | $A4   | $A4  |   | K      | $CB   | $8B  | $CB   | $8B  |
| 5%    | $B5   | $B5  | $A5   | $A5  |   | L      | $CC   | $8C  | $CC   | $8C  |
| 6&    | $B6   | $B6  | $A6   | $A6  |   | M      | $CD   | $8D  | $DD   | $9D  |
| 7'    | $B7   | $B7  | $A7   | $A7  |   | N^     | $CE   | $8E  | $DE   | $9E  |
| 8(    | $B8   | $B8  | $A8   | $A8  |   | O      | $CF   | $8F  | $CF   | $8F  |
| 9)    | $B9   | $B9  | $A9   | $A9  |   | P@     | $D0   | $90  | $C0   | $80  |
| :*    | $BA   | $BA  | $AA   | $AA  |   | Q      | $D1   | $91  | $D1   | $91  |
| ;+    | $BB   | $BB  | $AB   | $AB  |   | R      | $D2   | $92  | $D2   | $92  |
| ,<    | $AC   | $AC  | $BC   | $BC  |   | S      | $D3   | $93  | $D3   | $93  |
| -=    | $AD   | $AD  | $BD   | $BD  |   | T      | $D4   | $94  | $D4   | $94  |
| .>    | $AE   | $AE  | $BE   | $BE  |   | U      | $D5   | $95  | $D5   | $95  |
| /?    | $AF   | $AF  | $BF   | $BF  |   | V      | $D6   | $96  | $D6   | $96  |
| A     | $C1   | $81  | $C1   | $81  |   | W      | $D7   | $97  | $D7   | $97  |
| B     | $C2   | $82  | $C2   | $82  |   | X      | $D8   | $98  | $D8   | $98  |
| C     | $C3   | $83  | $C3   | $83  |   | Y      | $D9   | $99  | $D9   | $99  |
| D     | $C4   | $84  | $C4   | $84  |   | Z      | $DA   | $9A  | $DA   | $9A  |
| E     | $C5   | $85  | $C5   | $85  |   | ->     | $88   | $88  | $88   | $88  |
| F     | $C6   | $86  | $C6   | $86  |   | <-     | $95   | $95  | $95   | $95  |
|       |       |      |       |      |   | ESC    | $9B   | $9B  | $9B   | $9B  |

### Firmware keyboard functions ###

**CTRL-S** triggers the **STOP-LIST** feature, which is pausing any screen text printing at every RETURN code. Screen printing resumes after pressing any key, unless **CTRL-C** is pressed, which breaks screen printing and goes back to the program that is sending output.

**CTRL-G** does not print any character, instead it produces a tone of 1000Hz in the speaker during 0.1s.

**CTRL-X** breaks an input line, forgets all what was typed and starts a new input line.

|    Escape codes    |
| ------------------ |

When pressing the **ESC** key, Apples firmware goes into _escape mode_. In this mode, 11 keys have separate meanings called _escape codes_.

**ESC A**
: moves cursor one space forward  
**ESC B**
: moves cursor one space back  
**ESC C**
: moves cursor one line down  
**ESC D**
: moves cursor one line up  
**ESC E**
: clear until end of line while screen text printing  
**ESC F**
: clear until end of screen while screen text printing  
**ESC @**
: home and clear - clears entire window and places cursor in upper left corner  
**ESC K**
: same as ESC A - move cursor one right  
**ESC J**
: same as ESC B - move cursor one left  
**ESC M**
: same as ESC C - move cursor one down  
**ESC I**
: same as ESC D - move cursor one up   
