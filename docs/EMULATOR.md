## EMULATOR Instructions

<img src="/res/appleIIplus_bck_650.png?raw=true" width=39% align="left" />
While the end-user experience with emulators hardly differ from the real hardware, there are some essential differences, mostly to our benefit, but there are some downsides too.<br><br>

__Most basic functions remain the same__  
\* the pop-up keyboard toggles SHIFT, CTRL and REPT, enabling key combinations  
\* warm boot: press the reset button on the pop-up keyboard  
\* cold boot: press the white power button on the pop-up keyboard (originally, this was a flip-switch below the keyboard)   
\* insert disk: load any disk file found on the internet (.do, .dsk), after, perform a cold boot   
_note: most Apple II disks do not boot, keeping a bootable disk image at hand reach is still required._  


<img src="../res/appleIIplus_kbd_650.png?raw=true" width=40%/> 

__A handful extra functions make the experience complete__  
\* pasteboard: use the pasteboard to paste any text through the text prompt, just mind that a 1MHz computer takes this slowly.  
\* monitor: cycle color mode through apple color, black/white, green and amber  
\* pause: freeze/unfreeze CPU

__The 1MHz trick__  
JavaScript does not provide 1µs timing precision, but we have a workaround.  The setInterval() function located in EMU_apple2main.js, which drives the main loop of our emulator, starts a new sequence every 10ms.  But instead of cycling one time through the CPU emulator every 1µs, we cycle 10000 times every 0.01s or 10000/0.01 = 1M cyles/sec.  By this trick, we achieve exactly the same performance as a real Apple II at 1MHz.  Just, all 10000 cycles are far from equally spread accross this 10ms loop.  Most CPU's nowadays, effortlessly execute all 10000 cycles in less than one millisecond, which all sounds good, until you want to emulate 'sound'. Below diagram explains the 1MHz trick visually :



          <div style=width:800px>
          
                                                                 10ms                         
                                        ┌────────────────────────────────────────────────────┐┌─────...  
      setInterval(appleInterval(),10)   │                                                    ││  
                                      ──┘                                                    └┘  
                                        :                                                     :
                                        :<1ms                                                 :<1ms
                                        ┌───┐                                                 ┌───┐ 
              apple2plus.cycle(10000) ──┘10K└─────────────────────────────────────────────────┘10K└─...
                                        :cycles                                               :cycles  
                                        :                                                     :
                                        :                                                     :
                                        ┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐
        real Apple II clock cylcles   ──┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└...
                                                              10K cycles             
                                         

          </div>

  
__Impossible sound emulation__  
However simple sound production was designed on the Apple II, since 1997, JavaScript maintained 1ms as the **highest achievable timing accuracy**, while the 6502 CPU was clocked at approximately 1MHz or 1/1000ms cycles.  In other words, a JavaScript cannot emulate any sound above it's nyquist frequency of 500Hz, while the most commonly used Apple II Beep sound is a 1KHz square wave.

W3C recently started to worry about this limitation by proposing a new spec called ["High Resolution Time"](https://w3c.github.io/hr-time/) or [hr-time](https://w3c.github.io/hr-time/), but because of alleged malicious capability like [CACHE-ATTACKS] and [SPECTRE], W3C recommends to purposefully mess-up it's timers accuracy by reducing resolution, adding jitter, or by any other piggish means that probably never will provide us anything near to 1µs clock accuracy.  Last time I turned my eyes the same way was the day after 9/11, when I discovered that my boss replaced metal knives in our company kitchen by plastic ones, anyway, nobody would have thought that an emulated Apple II from 1978 🦖, more than 4 decades later, becuase of it's 1MHz clock could be mean a cybersecurity hazard ?? 🤨

In the end, we actually do not need 1µs clock accuracy for sound emulation.  The Apple II speaker can be switched from 'off' to 'on' and back to 'off' by reading the $C030 address location twice in a row.  Knowing that frequencies above 20000Hz remain unhearable, we only should mind about toggling the speaker once every 1/4000s or 25 cycles at 1MHz.  In conclusion, we only need 25µs or 0.025ms timer accuracy, which in future may be achieved with High Resolution Time control logic, but since this spec showed up only very recently, we can only wait, hope, pray and see.


## Appendix

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

**CTRL-G** does not print any character, instead it produces a tone of 100Hz in the speaker during 0.1s.

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
