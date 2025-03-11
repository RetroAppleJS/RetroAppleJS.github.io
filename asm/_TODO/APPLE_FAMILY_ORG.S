; TODO:  FIX ASSEMBLER LABELS STARTING WITH LOWCASE

ORG $2000

;*********************************************
;*                                           *
;*  Apple II Family Identification Program   *
;*                                           *
;*               Version 2.2                 *
;*                                           *
;*               March, 1990                 *
;*                                           *
;*  Includes support for the Apple IIe Card  *
;*  for the Macintosh LC.                    *
;*                                           *
;*********************************************


;  First, some global equates for the routine:


IIplain    EQU $01          ;Apple II
IIplus     EQU $02          ;Apple II+
IIIem      EQU $03          ;Apple /// in emulation mode
IIe        EQU $04          ;Apple IIe
IIc        EQU $05          ;Apple IIc
IIeCard    EQU $06          ;Apple IIe Card for the Macintosh LC
safe       EQU $01          ;start of code relocated to zp
location   EQU $06          ;zero page location to use

test1      EQU $AA          ;test byte #1
test2      EQU $55          ;lsr of test1
test3      EQU $88          ;test byte #3
test4      EQU $EE          ;test byte #4

begpage1   EQU $400         ;beginning of text page 1
begpage2   EQU $800         ;beginning of text page 2
begsprse   EQU $C00         ;byte after text page 2

clr80col   EQU $C000        ;disable 80-column store
set80col   EQU $C001        ;enable 80-column store
rdmainram  EQU $C002        ;read main ram
rdcardram  EQU $C003        ;read aux ram
wrmainram  EQU $C004        ;write main ram
wrcardram  EQU $C005        ;write aux ram
rdramrd    EQU $C013        ;are we reading aux ram?
rdaltzp    EQU $C016        ;are we reading aux zero page?
rd80col    EQU $C018        ;are we using 80-columns?
rdtext     EQU $C01A        ;read if text is displayed
rdpage2    EQU $C01C        ;read if page 2 is displayed
txtclr     EQU $C050        ;switch in graphics
txtset     EQU $C051        ;switch in text
txtpage1   EQU $C054        ;switch in page 1
txtpage2   EQU $C055        ;switch in page 2
ramin      EQU $C080        ;read LC bank 2, write protected
romin      EQU $C081        ;read ROM, 2 reads write enable LC
lcbank1    EQU $C08B        ;LC bank 1 enable

lc1        EQU $E000        ;bytes to save for LC
lc2        EQU $D000        ;save/restore routine
lc3        EQU $D400
lc4        EQU $D800

idroutine  EQU $FE1F        ;IIgs id routine

;  Start by saving the STAte of the language card banks and
;  by switching in main ROM.

strt      PHP              ;save the processor STAte
          SEI              ;before disabling interrupts
          LDA lc1          ;save four bytes from
          STA save         ;ROM/RAM area for later
          LDA lc2          ;restoring of RAM/ROM
          STA save+1       ;to original condition
          LDA lc3
          STA save+2
          LDA lc4
          STA save+3
          LDA $C081        ;read ROM
          LDA $C081
          LDA #0           ;start by assuming unknown machine
          STA machine
          STA romlevel

IdStart   LDA location     ;save zero page locations
          STA save+4       ;for later restoration
          LDA location+1
          STA save+5
          LDA #$FB         ;all ID bytes are in page $FB
          STA location+1   ;save in zero page as high byte
          LDX #0           ;init pointer to STArt of ID table
loop      LDA IDTable,x    ;get the machine we are testing for
          STA machine      ;and save it
          LDA IDTable+1,x  ;get the ROM level we are testing for
          STA romlevel     ;and save it
          ORA machine      ;are both zero?
          BEQ matched      ;yes - at end of list - leave

loop2     INX              ;bump index to loc/byte pair to test
          INX
          LDA IDTable,x    ;get the byte that should be in ROM
          BEQ matched      ;if zero, we're at end of list
          STA location     ;save in zero page

          LDY #00          ;init index for indirect addressing
          LDA IDTable+1,x  ;get the byte that should be in ROM
          CMP (Location),y ;is it there?
          BEQ loop2        ;yes, so keep on looping

loop3     INX              ;we didn't match. Scoot to the end of the
          INX              ;line in the ID table so we can STArt
          LDA IDTable,x    ;checking for another machine
          BNE loop3
          INX              ;point to STArt of next line
          BNE loop         ;should always be taken

matched   NOP

;  Here we check the 16-bit ID routine at idroutine ($FE1F).  If it
;  returns with carry clear, we call it again in 16-bit
;  mode to provide more information on the machine.

idIIgs    SEC              ;set the carry bit
          JSR idroutine    ;Apple IIgs ID Routine
          BCC idIIgs2      ;it's a IIgs or equivalent
          JMP IIgsOut      ;nope, go check memory
idIIgs2   LDA machine      ;get the value for machine
          ORA #$80         ;and set the high bit
          STA machine      ;put it back
          CLC              ;get ready to switch into native mode
          HEX FB           ;XCE
          PHP              ;save the processor STAtus
          HEX C2 30        ;rep #$30         ;sets 16-bit registers

          JSR idroutine    ;call the ID routine again
          STA IIgsA        ;16-bit store!
          STX IIgsX        ;16-bit store!
          STY IIgsY        ;16-bit store!
          PLP              ;restores 8-bit registers
          HEX FB           ;XCE switches back to whatever it was before

          LDY IIgsY        ;get the ROM vers number (starts at 0)
          CPY #$02         ;is it ROM 01 or 00?
          BCS idIIgs3      ;if not, don't increment
          INY              ;bump it up for romlevel
idIIgs3   STY romlevel     ;and put it there
          CPY #$01         ;is it the first ROM?
          BNE IIgsOut      ;no, go on with things
          LDA IIgsY+1      ;check the other byte too
          BNE IIgsOut      ;nope, it's a IIgs successor
          LDA #$7F         ;fix faulty ROM 00 on the IIgs
          STA IIgsA
IIgsOut   NOP

******************************************
* This part of the code checks for the   *
* memory configuration of the machine.   *
* If it's a IIgs, we've already stored   *
* the total memory from above.  If it's  *
* a IIc or a IIe Card, we know it's      *
* 128K; if it's a ][+, we know it's at   *
* least 48K and maybe 64K.  We won't     *
* check for less than 48K, since that's  *
* a really rare circumstance.            *
******************************************

exit      LDA machine      ;get the machine kind
          bmi exit128      ;it's a 16-bit machine (has 128K)
          CMP #IIc         ;is it a IIc?
          BEQ exit128      ;yup, it's got 128K
          CMP #IIeCard     ;is it a IIe Card?
          BEQ exit128      ;yes, it's got 128K
          CMP #IIe         ;is it a IIe?
          BNE contexit     ;yes, go muck with aux memory
          jmp muckaux
contexit  CMP #IIIem       ;is it a /// in emulation?
          BNE exitII       ;nope, it's a ][ or ][+
          LDA #48          ;/// emulation has 48K
          jmp exita
exit128    LDA #128         ;128K
exita      STA memory
exit1      LDA lc1          ;time to restore the LC
CMP save         ;if all 4 bytes are the same
BNE exit2        ;then LC was never on so
LDA lc2          ;do nothing
CMP save+1
BNE exit2
LDA lc3
CMP save+2
BNE exit2
LDA lc4
CMP save+3
BEQ exit6
exit2      LDA $C088        ;no match! so turn first LC
LDA lc1          ;bank on and check
CMP save
BEQ exit3
LDA $C080
jmp exit6
exit3      LDA lc2
CMP save+1       ;if all locations check
BEQ exit4        ;then do more more else
LDA $C080        ;turn on bank 2
jmp exit6
exit4      LDA lc3          ;check SECond byte in bank 1
CMP save+2
BEQ exit5
LDA $C080        ;select bank 2
jmp exit6
exit5      LDA lc4          ;check third byte in bank 1
CMP save+3
BEQ exit6
LDA $C080        ;select bank 2
exit6      PLP              ;restore interrupt STAtus
LDA save+4       ;put zero page back
STA location
LDA save+5       ;like we found it
STA location+1
rts              ;and go home.

exitII     LDA lcbank1      ;force in language card
LDA lcbank1      ;bank 1
LDX lc2          ;save the byte there
LDA #test1       ;use this as a test byte
STA lc2
eor lc2          ;if the same, should return zero
BNE noLC
lsr lc2          ;check twice just to be sure
LDA #test2       ;this is the shifted value
eor lc2          ;here's the SECond check
BNE noLC
STX lc2          ;put it back!
LDA #64          ;there's 64K here
jmp exita
noLC       LDA #48          ;no restore - no LC!
jmp exita        ;and get out of here

muckaux    LDX rdtext       ;remember graphics in X
LDA rdpage2      ;remember current video display
asl A            ;in the carry bit
LDA #test3       ;another test character
bit rd80col      ;remember video mode in N
STA set80col     ;enable 80-column store
PHP              ;save N and C flags
STA txtpage2     ;set page two
STA txtset       ;set text
LDY begpage1     ;save first character
STA begpage1     ;and replace it with test character
LDA begpage1     ;get it back
STY begpage1     ;and put back what was there
plp
BCS muck2        ;stay in page 2
STA txtpage1     ;restore page 1
muck1      bmi muck2        ;stay in 80-columns
STA $c000        ;turn off 80-columns
muck2      tay              ;save returned character
txa              ;get graphics/text setting
bmi muck3
STA txtclr       ;turn graphics back on
muck3      CPY #test3       ;finally compare it
BNE nocard       ;no 80-column card!
LDA rdramrd      ;is aux memory being read?
bmi muck128      ;yup, there's 128K!
LDA rdaltzp      ;is aux zero page used?
bmi muck128      ;yup!
LDY #done-start
move       LDX STArt-1,y    ;swap SECtion of zero page
LDA |safe-1,y    ;code needing safe location during
STX safe-1,y     ;reading of aux mem
STA STArt-1,Y
dey
BNE move
jmp |safe        ;jump to safe ground
back       PHP              ;save STAtus
LDY #done-start  ;move zero page back
move2      LDA STArt-1,y
STA |safe-1,y
dey
BNE move2
pla
BCS noaux
isaux      JMP muck128      ;there is 128K

*  You can put your own routine at "noaux" if you wish to
*  distinguish between 64K without an 80-column card and
*  64K with an 80-column card.

noaux      anop
nocard     LDA #64          ;only 64K
jmp exita
muck128    JMP exit128      ;there's 128K

*  This is the routine run in the safe area not affected
*  by bank-switching the main and aux RAM.

start      LDA #test4       ;yet another test byte
STA wrcardram    ;write to aux while on main zero page
STA rdcardram    ;read aux ram as well
STA begpage2     ;check for sparse memory mapping
LDA begsprse     ;if sparse, these will be the same
CMP #test4       ;value since they're 1K apart
BNE auxmem       ;yup, there's 128K!
asl begsprse     ;may have been lucky so we'll
LDA begpage2     ;change the value and see what happens
CMP begsprse
BNE auxmem
sec              ;oops, no auxiliary memory
BCS goback
auxmem     CLC
goback     STA wrmainram    ;write main RAM
STA rdmainram    ;read main RAM
jmp back         ;continue with program in main mem
done       nop              ;end of relocated program marker


*  The storage locations for the returned machine ID:

machine    ds  1            ;the type of Apple II
romlevel   ds  1            ;which revision of the machine
memory     ds  1            ;how much memory (up to 128K)
IIgsA      ds  2            ;16-bit field
IIgsX      ds  2            ;16-bit field
IIgsY      ds  2            ;16-bit field
save       ds  6            ;six bytes for saved data

IDTable    dc  I1'1,1'      ;Apple ][
dc  H'B3 38 00'

dc  I1'2,1'      ;Apple ][+
dc  H'B3 EA 1E AD 00'

dc  I1'3,1'      ;Apple /// (emulation)
dc  H'B3 EA 1E 8A 00'

dc  I1'4,1'      ;Apple IIe (original)
dc  H'B3 06 C0 EA 00'

;  Note: You must check for the Apple IIe Card BEFORE you
;  check for the enhanced Apple IIe since the first
;  two identification bytes are the same.

dc  I1'6,1'      ;Apple IIe Card for the Macintosh LC (1st
release)
dc  H'B3 06 C0 E0 DD 02 BE 00 00'

dc  I1'4,2'      ;Apple IIe (enhanced)
dc  H'B3 06 C0 E0 00'

dc  I1'5,1'      ;Apple IIc (original)
dc  H'B3 06 C0 00 BF FF 00'

dc  I1'5,2'      ;Apple IIc (3.5 ROM)
dc  H'B3 06 C0 00 BF 00 00'

dc  I1'5,3'      ;Apple IIc (Mem. Exp)
dc  H'B3 06 C0 00 BF 03 00'

dc  I1'5,4'      ;Apple IIc (Rev. Mem. Exp.)
dc  H'B3 06 C0 00 BF 04 00'

dc  I1'5,5'      ;Apple IIc Plus
dc  H'B3 06 C0 00 BF 05 00'

dc  I1'0,0'      ;end of table
