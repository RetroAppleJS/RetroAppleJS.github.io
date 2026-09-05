; =============================================================================
; 6502 FUNCTIONAL TEST - Apple II+ safe-loader / ASM_core.js edition
; Original test: Klaus Dormann, version 04-dec-2017
; Generated from the uploaded AS65 source for RetroAppleJS ASM_core.js v0.6.8.
;
; Apple II+ safe-loader configuration:
;   ROM_vectors=0, load_data_direct=1, I_flag=3, zero_page=$80,
;   data_segment=$0300, code_segment=$0C00, disable_selfmod=0,
;   report=0, ram_top=-1, disable_decimal=0.
;
; Apple II+ loader-safety changes:
;   - Zero-page workspace moved from $0A-$59 to $80-$CF, avoiding the
;     Monitor workspace at $20-$4F.  Applesoft state is intentionally
;     sacrificed; do not expect to return safely to BASIC after the test.
;   - Data moved from $0200 to $0300, avoiding the Monitor input buffer.
;     The 106-byte data block ends at $0369, below page-3 vectors.
;   - Code moved from $0400 to $0C00, avoiding the active text screen.
;   - ROM_vectors=0: stock Apple II+ vectors $FFFA-$FFFF are ROM, so BRK
;     is emulated by the Klaus test and no vector bytes are emitted.
;
; Compatibility transformation:
;   - AS65 IF/ELSE/ENDIF resolved using the configuration above.
;   - AS65 macros expanded inline (including test_num sequencing).
;   - DB/DW/DS -> .BYTE/.WORD/.RES.
;   - HI/LO -> ASM_core unary >/< byte selectors.
;   - ALIGN -> .RES (*&1), preserving AS65 even-address alignment.
;   - DATA/BSS/CODE/NOOPT selectors omitted; explicit ORG directives remain.
;   - END start -> .END.
;   - Current-PC instruction operands such as JMP * / BNE * are rewritten
;     as JMP 0+* / BNE 0+* because a leading * is ASM_core zero-page force;
;     inside expressions, ASM_core.js v0.6.8 still evaluates * as current PC.
;
; No test logic or NMOS 6502 opcode sequence is intentionally changed.
; =============================================================================

;
; 6 5 0 2   F U N C T I O N A L   T E S T
;
; Copyright (C) 2012-2015  Klaus Dormann
;
; This program is free software: you can redistribute it and/or modify
; it under the terms of the GNU General Public License as published by
; the Free Software Foundation, either version 3 of the License, or
; (at your option) any later version.
;
; This program is distributed in the hope that it will be useful,
; but WITHOUT ANY WARRANTY; without even the implied warranty of
; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
; GNU General Public License for more details.
;
; You should have received a copy of the GNU General Public License
; along with this program.  If not, see <http://www.gnu.org/licenses/>.


; This program is designed to test all opcodes of a 6502 emulator using all
; addressing modes with focus on propper setting of the processor status
; register bits.
;
; version 04-dec-2017
; contact info at http://2m5.de or email K@2m5.de
;
; assembled with AS65 from http://www.kingswood-consulting.co.uk/assemblers/
; command line switches: -l -m -s2 -w -h0
;                         |  |  |   |  no page headers in listing
;                         |  |  |   wide listing (133 char/col)
;                         |  |  write intel hex file instead of binary
;                         |  expand macros in listing
;                         generate pass2 listing
;
; No IO - should be run from a monitor with access to registers.
; Apple II+ loader: enter Monitor with CALL -151, load the three emitted
; segments, then start at $0C00 (Monitor command: C00G).
; Loop on program counter determines error or successful completion of test.
; Check listing for relevant traps (jump/branch *).
; Please note that in early tests some instructions will have to be used before
; they are actually tested!
;
; RESET, NMI or IRQ should not occur and will be trapped if vectors are enabled.
; Tests documented behavior of the original NMOS 6502 only! No unofficial
; opcodes. Additional opcodes of newer versions of the CPU (65C02, 65816) will
; not be tested. Decimal ops will only be tested with valid BCD operands and
; N V Z flags will be ignored.
;
; Debugging hints:
;     Most of the code is written sequentially. if you hit a trap, check the
;   immediately preceeding code for the instruction to be tested. Results are
;   tested first, flags are checked second by pushing them onto the stack and
;   pulling them to the accumulator after the result was checked. The "real"
;   flags are no longer valid for the tested instruction at this time!
;     If the tested instruction was indexed, the relevant index (X or Y) must
;   also be checked. Opposed to the flags, X and Y registers are still valid.
;
; versions:
;   28-jul-2012  1st version distributed for testing
;   29-jul-2012  fixed references to location 0, now #0
;                added license - GPLv3
;   30-jul-2012  added configuration options
;   01-aug-2012  added trap macro to allow user to change error handling
;   01-dec-2012  fixed trap in branch field must be a branch
;   02-mar-2013  fixed PLA flags not tested
;   19-jul-2013  allowed ROM vectors to be loaded when load_data_direct = 0
;                added test sequence check to detect if tests jump their fence
;   23-jul-2013  added RAM integrity check option
;   16-aug-2013  added error report to standard output option
;   13-dec-2014  added binary/decimal opcode table switch test
;   14-dec-2014  improved relative address test
;   23-aug-2015  added option to disable self modifying tests
;   24-aug-2015  all self modifying immediate opcodes now execute in data RAM
;                added small branch offset pretest
;   21-oct-2015  added option to disable decimal mode ADC & SBC tests
;   04-dec-2017  fixed BRK only tested with interrupts enabled
;                added option to skip the remainder of a failing test
;                in report.i65


; C O N F I G U R A T I O N

;ROM_vectors writable (0=no, 1=yes)
;if ROM vectors can not be used interrupts will not be trapped
;as a consequence BRK can not be tested but will be emulated to test RTI
ROM_vectors = 0

;load_data_direct (0=move from code segment, 1=load directly)
;loading directly is preferred but may not be supported by your platform
;0 produces only consecutive object code, 1 is not suitable for a binary image
load_data_direct = 1

;I_flag behavior (0=force enabled, 1=force disabled, 2=prohibit change, 3=allow
;change) 2 requires extra code and is not recommended. SEI & CLI can only be
;tested if you allow changing the interrupt status (I_flag = 3)
I_flag = 3

;configure memory - try to stay away from memory used by the system
;zero_page memory start address, $50 (80) consecutive Bytes required
;                                add 2 if I_flag = 2
zero_page = $0080

;data_segment memory start address, $6A (106) consecutive Bytes required
data_segment = $0300

;code_segment memory start address, 13kB of consecutive space required
;                                   add 2.5 kB if I_flag = 2
code_segment = $0C00

;self modifying code may be disabled to allow running in ROM
;0=part of the code is self modifying and must reside in RAM
;1=tests disabled: branch range
disable_selfmod = 0

;report errors through I/O channel (0=use standard self trap loops, 1=include
;report.i65 as I/O channel, add 3.5 kB)
report = 0

;RAM integrity test option. Checks for undesired RAM writes.
;set lowest non RAM or RAM mirror address page (-1=disable, 0=64k, $40=16k)
;leave disabled if a monitor, OS or background interrupt is allowed to alter RAM
ram_top = -1

;disable test decimal mode ADC & SBC, 0=enable, 1=disable,
;2=disable including decimal flag in processor status
disable_decimal = 0

        ; [ASM_core] omitted AS65 NOOPT selector ;do not take shortcuts

;macros for error & success traps to allow user modification
;example:
;trap    macro
;        jsr my_error_handler
;        endm
;trap_eq macro
;        bne skip\?
;        trap           ;failed equal (zero)
;skip\?
;        endm
;
; my_error_handler should pop the calling address from the stack and report it.
; putting larger portions of code (more than 3 bytes) inside the trap macro
; may lead to branch range problems for some tests.
; please observe that during the test the stack gets invalidated
; therefore a RTS inside the success macro is not possible


carry   equ %00000001 ;flag bits in status
zero    equ %00000010
intdis  equ %00000100
decmode equ %00001000
break   equ %00010000
reserv  equ %00100000
overfl  equ %01000000
minus   equ %10000000

fc      equ carry
fz      equ zero
fzc     equ carry+zero
fv      equ overfl
fvz     equ overfl+zero
fn      equ minus
fnc     equ minus+carry
fnz     equ minus+zero
fnzc    equ minus+zero+carry
fnv     equ minus+overfl

fao     equ break+reserv ;bits always on after PHP, BRK
fai     equ fao+intdis ;+ forced interrupt disable
faod    equ fao+decmode ;+ ignore decimal
faid    equ fai+decmode ;+ ignore decimal
m8      equ $ff ;8 bit mask
m8i     equ $ff&~intdis ;8 bit mask - interrupt disable

;macros to allow masking of status bits.
;masking test of decimal bit
;masking of interrupt enable/disable on load and compare
;masking of always on bits after PHP or BRK (unused & break) on compare

;macros to set (register|memory|zeropage) & status










;macros to test (register|memory|zeropage) & status & (mask)










; RAM integrity test
;   verifies that none of the previous tests has altered RAM outside of the
;   designated write areas.
;   uses zpt word as indirect pointer, zpt+2 word as checksum


        ; [ASM_core] omitted AS65 DATA selector
        org zero_page
;break test interrupt save
irq_a   .RES  1 ;a register
irq_x   .RES  1 ;x register
zpt ;5 bytes store/modify test area
;add/subtract operand generation and result/flag prediction
adfc    .RES  1 ;carry flag before op
ad1     .RES  1 ;operand 1 - accumulator
ad2     .RES  1 ;operand 2 - memory / immediate
adrl    .RES  1 ;expected result bits 0-7
adrh    .RES  1 ;expected result bit 8 (carry)
adrf    .RES  1 ;expected flags NV0000ZC (only binary mode)
sb2     .RES  1 ;operand 2 complemented for subtract
zp_bss
zp1     .BYTE  $c3,$82,$41,0 ;test patterns for LDx BIT ROL ROR ASL LSR
zp7f    .BYTE  $7f ;test pattern for compare
;logical zeropage operands
zpOR    .BYTE  0,$1f,$71,$80 ;test pattern for OR
zpAN    .BYTE  $0f,$ff,$7f,$80 ;test pattern for AND
zpEO    .BYTE  $ff,$0f,$8f,$8f ;test pattern for EOR
;indirect addressing pointers
ind1    .WORD  abs1 ;indirect pointer to pattern in absolute memory
        .WORD  abs1+1
        .WORD  abs1+2
        .WORD  abs1+3
        .WORD  abs7f
inw1    .WORD  abs1-$f8 ;indirect pointer for wrap-test pattern
indt    .WORD  abst ;indirect pointer to store area in absolute memory
        .WORD  abst+1
        .WORD  abst+2
        .WORD  abst+3
inwt    .WORD  abst-$f8 ;indirect pointer for wrap-test store
indAN   .WORD  absAN ;indirect pointer to AND pattern in absolute memory
        .WORD  absAN+1
        .WORD  absAN+2
        .WORD  absAN+3
indEO   .WORD  absEO ;indirect pointer to EOR pattern in absolute memory
        .WORD  absEO+1
        .WORD  absEO+2
        .WORD  absEO+3
indOR   .WORD  absOR ;indirect pointer to OR pattern in absolute memory
        .WORD  absOR+1
        .WORD  absOR+2
        .WORD  absOR+3
;add/subtract indirect pointers
adi2    .WORD  ada2 ;indirect pointer to operand 2 in absolute memory
sbi2    .WORD  sba2 ;indirect pointer to complemented operand 2 (SBC)
adiy2   .WORD  ada2-$ff ;with offset for indirect indexed
sbiy2   .WORD  sba2-$ff
zp_bss_end

        org data_segment
test_case   .RES  1 ;current test number
ram_chksm   .RES  2 ;checksum for RAM integrity test
;add/subtract operand copy - abs tests write area
abst ;5 bytes store/modify test area
ada2    .RES  1 ;operand 2
sba2    .RES  1 ;operand 2 complemented for subtract
        .RES  3 ;fill remaining bytes
data_bss
ex_andi and #0 ;execute immediate opcodes
        rts
ex_eori eor #0 ;execute immediate opcodes
        rts
ex_orai ora #0 ;execute immediate opcodes
        rts
ex_adci adc #0 ;execute immediate opcodes
        rts
ex_sbci sbc #0 ;execute immediate opcodes
        rts
abs1    .BYTE  $c3,$82,$41,0 ;test patterns for LDx BIT ROL ROR ASL LSR
abs7f   .BYTE  $7f ;test pattern for compare
;loads
fLDx    .BYTE  fn,fn,0,fz ;expected flags for load
;shifts
rASL ;expected result ASL & ROL -carry
rROL    .BYTE  $86,$04,$82,0 ; "
rROLc   .BYTE  $87,$05,$83,1 ;expected result ROL +carry
rLSR ;expected result LSR & ROR -carry
rROR    .BYTE  $61,$41,$20,0 ; "
rRORc   .BYTE  $e1,$c1,$a0,$80 ;expected result ROR +carry
fASL ;expected flags for shifts
fROL    .BYTE  fnc,fc,fn,fz ;no carry in
fROLc   .BYTE  fnc,fc,fn,0 ;carry in
fLSR
fROR    .BYTE  fc,0,fc,fz ;no carry in
fRORc   .BYTE  fnc,fn,fnc,fn ;carry in
;increments (decrements)
rINC    .BYTE  $7f,$80,$ff,0,1 ;expected result for INC/DEC
fINC    .BYTE  0,fn,fn,fz,0 ;expected flags for INC/DEC
;logical memory operand
absOR   .BYTE  0,$1f,$71,$80 ;test pattern for OR
absAN   .BYTE  $0f,$ff,$7f,$80 ;test pattern for AND
absEO   .BYTE  $ff,$0f,$8f,$8f ;test pattern for EOR
;logical accu operand
absORa  .BYTE  0,$f1,$1f,0 ;test pattern for OR
absANa  .BYTE  $f0,$ff,$ff,$ff ;test pattern for AND
absEOa  .BYTE  $ff,$f0,$f0,$0f ;test pattern for EOR
;logical results
absrlo  .BYTE  0,$ff,$7f,$80
absflo  .BYTE  fz,fn,0,fn
data_bss_end


        ; [ASM_core] omitted AS65 CODE selector
        org code_segment
start   cld
        ldx #$ff
        txs
        lda #0 ;*** test 0 = initialize
        sta test_case
; test_num = 0        ; expanded at conversion time

;stop interrupts before initializing BSS

;initialize I/O for report channel

;pretest small branch offset
        ldx #5
        jmp psb_test
psb_bwok
        ldy #5
        bne psb_forw
        jmp 0+* ;failed anyway
        dey ;forward landing zone
        dey
        dey
        dey
        dey
psb_forw
        dey
        dey
        dey
        dey
        dey
        beq psb_fwok
        jmp 0+* ;failed anyway

        dex ;backward landing zone
        dex
        dex
        dex
        dex
psb_back
        dex
        dex
        dex
        dex
        dex
        beq psb_bwok
        jmp 0+* ;failed anyway
psb_test
        bne psb_back
        jmp 0+* ;failed anyway
psb_fwok

;initialize BSS segment

;retain status of interrupt flag

;generate checksum for RAM integrity test
            lda test_case ;previous test
            cmp #0
        bne 0+* ;failed not equal (non zero)
            lda #1 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

;testing relative addressing with BEQ
        ldy #$fe ;testing maximum range, not -1/-2 (invalid/self adr)
range_loop
        dey ;next relative address
        tya
        tax ;precharge count to end of loop
        bpl range_fw ;calculate relative address
        clc ;avoid branch self or to relative address of branch
        adc #2
        nop ;offset landing zone - tolerate +/-5 offset to branch
        nop
        nop
        nop
        nop
range_fw
        nop
        nop
        nop
        nop
        nop
        eor #$7f ;complement except sign
        sta range_adr ;load into test target
        lda #0 ;should set zero flag in status register
        jmp range_op

        dex ; offset landing zone - backward branch too far
        dex
        dex
        dex
        dex
        ;relative address target field with branch under test in the middle
        dex ;-128 - max backward
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-120
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-110
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-100
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-90
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-80
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-70
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-60
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-50
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-40
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-30
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-20
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-10
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;-3
range_op ;test target with zero flag=0, z=1 if previous dex
range_adr   = *+1 ;modifiable relative address
        beq 0+*+64 ;+64 if called without modification
        dex ;+0
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+10
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+20
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+30
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+40
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+50
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+60
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+70
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+80
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+90
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+100
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+110
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex
        dex ;+120
        dex
        dex
        dex
        dex
        dex
        dex
        nop ;offset landing zone - forward branch too far
        nop
        nop
        nop
        nop
        beq range_ok ;+127 - max forward
        jmp 0+* ;failed anyway
        nop ;offset landing zone - tolerate +/-5 offset to branch
        nop
        nop
        nop
        nop
range_ok
        nop
        nop
        nop
        nop
        nop
        cpy #0
        beq range_end
        jmp range_loop
range_end ;range test successful
            lda test_case ;previous test
            cmp #1
        bne 0+* ;failed not equal (non zero)
            lda #2 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

;partial test BNE & CMP, CPX, CPY immediate
        cpy #1 ;testing BNE true
        bne test_bne
        jmp 0+* ;failed anyway
test_bne
        lda #0
        cmp #0 ;test compare immediate
        bne 0+* ;failed not equal (non zero)
        bcc 0+* ;failed carry clear
        bmi 0+* ;failed minus (bit 7 set)
        cmp #1
        beq 0+* ;failed equal (zero)
        bcs 0+* ;failed carry set
        bpl 0+* ;failed plus (bit 7 clear)
        tax
        cpx #0 ;test compare x immediate
        bne 0+* ;failed not equal (non zero)
        bcc 0+* ;failed carry clear
        bmi 0+* ;failed minus (bit 7 set)
        cpx #1
        beq 0+* ;failed equal (zero)
        bcs 0+* ;failed carry set
        bpl 0+* ;failed plus (bit 7 clear)
        tay
        cpy #0 ;test compare y immediate
        bne 0+* ;failed not equal (non zero)
        bcc 0+* ;failed carry clear
        bmi 0+* ;failed minus (bit 7 set)
        cpy #1
        beq 0+* ;failed equal (zero)
        bcs 0+* ;failed carry set
        bpl 0+* ;failed plus (bit 7 clear)
            lda test_case ;previous test
            cmp #2
        bne 0+* ;failed not equal (non zero)
            lda #3 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test
;testing stack operations PHA PHP PLA PLP

        ldx #$ff ;initialize stack
        txs
        lda #$55
        pha
        lda #$aa
        pha
        cmp $1fe ;on stack ?
        bne 0+* ;failed not equal (non zero)
        tsx
        txa ;overwrite accu
        cmp #$fd ;sp decremented?
        bne 0+* ;failed not equal (non zero)
        pla
        cmp #$aa ;successful retreived from stack?
        bne 0+* ;failed not equal (non zero)
        pla
        cmp #$55
        bne 0+* ;failed not equal (non zero)
        cmp $1ff ;remains on stack?
        bne 0+* ;failed not equal (non zero)
        tsx
        cpx #$ff ;sp incremented?
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #3
        bne 0+* ;failed not equal (non zero)
            lda #4 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

;testing branch decisions BPL BMI BVC BVS BCC BCS BNE BEQ
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bpl nbr1 ;branches should not be taken
        bvc nbr2
        bcc nbr3
        bne nbr4
        bmi br1 ;branches should be taken
        jmp 0+* ;failed anyway
br1     bvs br2
        jmp 0+* ;failed anyway
br2     bcs br3
        jmp 0+* ;failed anyway
br3     beq br4
        jmp 0+* ;failed anyway
nbr1
        jmp 0+* ;failed anyway
nbr2
        jmp 0+* ;failed anyway
nbr3
        jmp 0+* ;failed anyway
nbr4
        jmp 0+* ;failed anyway
br4     php
        tsx
        cpx #$fe ;sp after php?
        bne 0+* ;failed not equal (non zero)
        pla
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        tsx
        cpx #$ff ;sp after php?
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bmi nbr11 ;branches should not be taken
        bvs nbr12
        bcs nbr13
        beq nbr14
        bpl br11 ;branches should be taken
        jmp 0+* ;failed anyway
br11    bvc br12
        jmp 0+* ;failed anyway
br12    bcc br13
        jmp 0+* ;failed anyway
br13    bne br14
        jmp 0+* ;failed anyway
nbr11
        jmp 0+* ;failed anyway
nbr12
        jmp 0+* ;failed anyway
nbr13
        jmp 0+* ;failed anyway
nbr14
        jmp 0+* ;failed anyway
br14    php
        pla
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        ;crosscheck flags
            lda #zero ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brzs1
        beq brzs2
brzs1
        jmp 0+* ;failed anyway
brzs2   bcs brzs3
        bcc brzs4
brzs3
        jmp 0+* ;failed anyway
brzs4   bmi brzs5
        bpl brzs6
brzs5
        jmp 0+* ;failed anyway
brzs6   bvs brzs7
        bvc brzs8
brzs7
        jmp 0+* ;failed anyway
brzs8
            lda #carry ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brcs1
        bne brcs2
brcs1
        jmp 0+* ;failed anyway
brcs2   bcc brcs3
        bcs brcs4
brcs3
        jmp 0+* ;failed anyway
brcs4   bmi brcs5
        bpl brcs6
brcs5
        jmp 0+* ;failed anyway
brcs6   bvs brcs7
        bvc brcs8
brcs7
        jmp 0+* ;failed anyway

brcs8
            lda #minus ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brmi1
        bne brmi2
brmi1
        jmp 0+* ;failed anyway
brmi2   bcs brmi3
        bcc brmi4
brmi3
        jmp 0+* ;failed anyway
brmi4   bpl brmi5
        bmi brmi6
brmi5
        jmp 0+* ;failed anyway
brmi6   bvs brmi7
        bvc brmi8
brmi7
        jmp 0+* ;failed anyway
brmi8
            lda #overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brvs1
        bne brvs2
brvs1
        jmp 0+* ;failed anyway
brvs2   bcs brvs3
        bcc brvs4
brvs3
        jmp 0+* ;failed anyway
brvs4   bmi brvs5
        bpl brvs6
brvs5
        jmp 0+* ;failed anyway
brvs6   bvc brvs7
        bvs brvs8
brvs7
        jmp 0+* ;failed anyway
brvs8
            lda #$ff-zero ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brzc1
        bne brzc2
brzc1
        jmp 0+* ;failed anyway
brzc2   bcc brzc3
        bcs brzc4
brzc3
        jmp 0+* ;failed anyway
brzc4   bpl brzc5
        bmi brzc6
brzc5
        jmp 0+* ;failed anyway
brzc6   bvc brzc7
        bvs brzc8
brzc7
        jmp 0+* ;failed anyway
brzc8
            lda #$ff-carry ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brcc1
        beq brcc2
brcc1
        jmp 0+* ;failed anyway
brcc2   bcs brcc3
        bcc brcc4
brcc3
        jmp 0+* ;failed anyway
brcc4   bpl brcc5
        bmi brcc6
brcc5
        jmp 0+* ;failed anyway
brcc6   bvc brcc7
        bvs brcc8
brcc7
        jmp 0+* ;failed anyway
brcc8
            lda #$ff-minus ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brpl1
        beq brpl2
brpl1
        jmp 0+* ;failed anyway
brpl2   bcc brpl3
        bcs brpl4
brpl3
        jmp 0+* ;failed anyway
brpl4   bmi brpl5
        bpl brpl6
brpl5
        jmp 0+* ;failed anyway
brpl6   bvc brpl7
        bvs brpl8
brpl7
        jmp 0+* ;failed anyway
brpl8
            lda #$ff-overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brvc1
        beq brvc2
brvc1
        jmp 0+* ;failed anyway
brvc2   bcc brvc3
        bcs brvc4
brvc3
        jmp 0+* ;failed anyway
brvc4   bpl brvc5
        bmi brvc6
brvc5
        jmp 0+* ;failed anyway
brvc6   bvs brvc7
        bvc brvc8
brvc7
        jmp 0+* ;failed anyway
brvc8
            lda test_case ;previous test
            cmp #4
        bne 0+* ;failed not equal (non zero)
            lda #5 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; test PHA does not alter flags or accumulator but PLA does
        ldx #$55 ;x & y protected
        ldy #$aa
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pha
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pha
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pla
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pla
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$fe ;precharge accu
            plp
        pla
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pla
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pla
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$fe ;precharge accu
            plp
        pla
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cpx #$55 ;x & y unchanged?
        bne 0+* ;failed not equal (non zero)
        cpy #$aa
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #5
        bne 0+* ;failed not equal (non zero)
            lda #6 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; partial pretest EOR #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$3c ;precharge accu
            plp
        eor #$c3
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$c3 ;precharge accu
            plp
        eor #$c3
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #6
        bne 0+* ;failed not equal (non zero)
            lda #7 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; PC modifying instructions except branches (NOP, JMP, JSR, RTS, BRK, RTI)
; testing NOP
        ldx #$24
        ldy #$42
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$18 ;precharge accu
            plp
        nop
            php ;save flags
            cmp #$18 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cpx #$24
        bne 0+* ;failed not equal (non zero)
        cpy #$42
        bne 0+* ;failed not equal (non zero)
        ldx #$db
        ldy #$bd
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$e7 ;precharge accu
            plp
        nop
            php ;save flags
            cmp #$e7 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cpx #$db
        bne 0+* ;failed not equal (non zero)
        cpy #$bd
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #7
        bne 0+* ;failed not equal (non zero)
            lda #8 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; jump absolute
            lda #$0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #'F'
        ldx #'A'
        ldy #'R' ;N=0, V=0, Z=0, C=0
        jmp test_far
        nop
        nop
        bne 0+* ;failed not equal (non zero)
        inx
        inx
far_ret
        beq 0+* ;failed equal (zero)
        bpl 0+* ;failed plus (bit 7 clear)
        bcc 0+* ;failed carry clear
        bvc 0+* ;failed overflow clear
        cmp #('F'^$aa) ;returned registers OK?
        bne 0+* ;failed not equal (non zero)
        cpx #('A'+1)
        bne 0+* ;failed not equal (non zero)
        cpy #('R'-3)
        bne 0+* ;failed not equal (non zero)
        dex
        iny
        iny
        iny
        eor #$aa ;N=0, V=1, Z=0, C=1
        jmp test_near
        nop
        nop
        bne 0+* ;failed not equal (non zero)
        inx
        inx
test_near
        beq 0+* ;failed equal (zero)
        bmi 0+* ;failed minus (bit 7 set)
        bcc 0+* ;failed carry clear
        bvc 0+* ;failed overflow clear
        cmp #'F' ;passed registers OK?
        bne 0+* ;failed not equal (non zero)
        cpx #'A'
        bne 0+* ;failed not equal (non zero)
        cpy #'R'
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #8
        bne 0+* ;failed not equal (non zero)
            lda #9 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; jump indirect
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #'I'
        ldx #'N'
        ldy #'D' ;N=0, V=0, Z=0, C=0
        jmp (ptr_tst_ind)
        nop
        bne 0+* ;failed not equal (non zero)
        dey
        dey
ind_ret
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        beq 0+* ;failed equal (zero)
        bpl 0+* ;failed plus (bit 7 clear)
        bcc 0+* ;failed carry clear
        bvc 0+* ;failed overflow clear
        cmp #('I'^$aa) ;returned registers OK?
        bne 0+* ;failed not equal (non zero)
        cpx #('N'+1)
        bne 0+* ;failed not equal (non zero)
        cpy #('D'-6)
        bne 0+* ;failed not equal (non zero)
        tsx ;SP check
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #9
        bne 0+* ;failed not equal (non zero)
            lda #10 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; jump subroutine & return from subroutine
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #'J'
        ldx #'S'
        ldy #'R' ;N=0, V=0, Z=0, C=0
        jsr test_jsr
jsr_ret = *-1 ;last address of jsr = return address
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        beq 0+* ;failed equal (zero)
        bpl 0+* ;failed plus (bit 7 clear)
        bcc 0+* ;failed carry clear
        bvc 0+* ;failed overflow clear
        cmp #('J'^$aa) ;returned registers OK?
        bne 0+* ;failed not equal (non zero)
        cpx #('S'+1)
        bne 0+* ;failed not equal (non zero)
        cpy #('R'-6)
        bne 0+* ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #10
        bne 0+* ;failed not equal (non zero)
            lda #11 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; break & return from interrupt
        lda #> brk_ret0 ;emulated break
        pha
        lda #< brk_ret0
        pha
            lda #fao ;allow test to change I-flag (no mask)
        pha
            lda #intdis ;allow test to change I-flag (no mask)
        pha
        lda #'B'
        ldx #'R'
        ldy #'K'
        plp ;N=0, V=0, Z=0, C=0
        jmp irq_trap
        dey ;should not be executed
brk_ret0 ;address of break return
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        cmp #'B'^$aa ;returned registers OK?
        ;the IRQ vector was never executed if A & X stay unmodified
        bne 0+* ;failed not equal (non zero)
        cpx #'R'+1
        bne 0+* ;failed not equal (non zero)
        cpy #'K'-6
        bne 0+* ;failed not equal (non zero)
        pla ;returned flags OK (unchanged)?
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
        lda #> brk_ret1 ;emulated break
        pha
        lda #< brk_ret1
        pha
            lda #$ff ;allow test to change I-flag (no mask)
        pha ;set break & unused on stack
        pha ;actual flags
        lda #$ff-'B'
        ldx #$ff-'R'
        ldy #$ff-'K'
        plp ;N=1, V=1, Z=1, C=1
        jmp irq_trap
        dey ;should not be executed
brk_ret1 ;address of break return
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        cmp #($ff-'B')^$aa ;returned registers OK?
        ;the IRQ vector was never executed if A & X stay unmodified
        bne 0+* ;failed not equal (non zero)
        cpx #$ff-'R'+1
        bne 0+* ;failed not equal (non zero)
        cpy #$ff-'K'-6
        bne 0+* ;failed not equal (non zero)
        pla ;returned flags OK (unchanged)?
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #11
        bne 0+* ;failed not equal (non zero)
            lda #12 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; test set and clear flags CLC CLI CLD CLV SEC SEI SED
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        clc
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-carry|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sec
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cli
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-intdis|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sei
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cld
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-decmode|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sed
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        clv
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-overfl|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sec
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(carry|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        clc
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sei
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(intdis|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cli
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        sed
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(decmode|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        cld
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(overfl|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        clv
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #12
        bne 0+* ;failed not equal (non zero)
            lda #13 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test
; testing index register increment/decrement and transfer
; INX INY DEX DEY TAX TXA TAY TYA
        ldx #$fe
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inx ;ff
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        inx ;00
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        inx ;01
            php ;save flags
            cpx #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex ;00
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex ;ff
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex ;fe
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inx ;ff
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        inx ;00
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        inx ;01
            php ;save flags
            cpx #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex ;00
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex ;ff
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

        ldy #$fe
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        iny ;ff
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        iny ;00
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        iny ;01
            php ;save flags
            cpy #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey ;00
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey ;ff
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey ;fe
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        iny ;ff
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0+minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        iny ;00
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        iny ;01
            php ;save flags
            cpy #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey ;00
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey ;ff
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

        ldx #$ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txa
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;00
        plp
        txa
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;01
        plp
        txa
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txa
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;00
        plp
        txa
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;ff
        plp
        txa
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

        ldy #$ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tya
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;00
        plp
        tya
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;01
        plp
        tya
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tya
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;00
        plp
        tya
            php ;save flags
            cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;ff
        plp
        tya
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldx #$ff ;ff
        txa
        plp
        tay
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;00
        txa
        plp
        tay
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;01
        txa
        plp
        tay
            php ;save flags
            cpy #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
        pha
        lda #0
        txa
        plp
        tay
            php ;save flags
            cpy #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;00
        txa
        plp
        tay
            php ;save flags
            cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;ff
        txa
        plp
        tay
            php ;save flags
            cpy #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status


            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldy #$ff ;ff
        tya
        plp
        tax
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;00
        tya
        plp
        tax
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;01
        tya
        plp
        tax
            php ;save flags
            cpx #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
        pha
        lda #0 ;preset status
        tya
        plp
        tax
            php ;save flags
            cpx #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;00
        tya
        plp
        tax
            php ;save flags
            cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;ff
        tya
        plp
        tax
            php ;save flags
            cpx #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #13
        bne 0+* ;failed not equal (non zero)
            lda #14 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

;TSX sets NZ - TXS does not
;  This section also tests for proper stack wrap around.
        ldx #1 ;01
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $101
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $101
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        dex ;00
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $100
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $100
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        dex ;ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $1ff
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $1ff
            cmp #(0|fao)&m8 ;expected flags + always on bits

        ldx #1
        txs ;sp=01
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears Z, N
        php ;sp=00
        cpx #1
        bne 0+* ;failed not equal (non zero)
        lda $101
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=ff
        cpx #0
        bne 0+* ;failed not equal (non zero)
        lda $100
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=fe
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
        lda $1ff
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)

        ldx #1
        txs ;sp=01
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears Z, N
        php ;sp=00
        cpx #1
        bne 0+* ;failed not equal (non zero)
        lda $101
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=ff
        cpx #0
        bne 0+* ;failed not equal (non zero)
        lda $100
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=fe
        cpx #$ff
        bne 0+* ;failed not equal (non zero)
        lda $1ff
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        pla ;sp=ff
            lda test_case ;previous test
            cmp #14
        bne 0+* ;failed not equal (non zero)
            lda #15 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing index register load & store LDY LDX STY STX all addressing modes
; LDX / STX - zp,y / abs,y
        ldy #3
tldx
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1,y
        php ;test stores do not alter flags
        txa
        eor #$c3
        plp
        sta abst,y
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tldx

        ldy #3
tldx1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1,y
        php ;test stores do not alter flags
        txa
        eor #$c3
        plp
        sta abst,y
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tldx1

        ldy #3
tldx2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1,y
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt,y
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tldx2

        ldy #3
tldx3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1,y
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt,y
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tldx3

        ldy #3 ;testing store result
        ldx #0
tstx    lda zpt,y
        eor #$c3
        cmp zp1,y
        bne 0+* ;failed not equal (non zero)
        stx zpt,y ;clear
        lda abst,y
        eor #$c3
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstx
            lda test_case ;previous test
            cmp #15
        bne 0+* ;failed not equal (non zero)
            lda #16 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; indexed wraparound test (only zp should wrap)
        ldy #3+$fa
tldx4   ldx zp1-$fa&$ff,y ;wrap on indexed zp
        txa
        sta abst-$fa,y ;no STX abs,y!
        dey
        cpy #$fa
        bcs tldx4
        ldy #3+$fa
tldx5   ldx abs1-$fa,y ;no wrap on indexed abs
        stx zpt-$fa&$ff,y
        dey
        cpy #$fa
        bcs tldx5
        ldy #3 ;testing wraparound result
        ldx #0
tstx1   lda zpt,y
        cmp zp1,y
        bne 0+* ;failed not equal (non zero)
        stx zpt,y ;clear
        lda abst,y
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstx1
            lda test_case ;previous test
            cmp #16
        bne 0+* ;failed not equal (non zero)
            lda #17 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; LDY / STY - zp,x / abs,x
        ldx #3
tldy
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1,x
        php ;test stores do not alter flags
        tya
        eor #$c3
        plp
        sta abst,x
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldy

        ldx #3
tldy1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1,x
        php ;test stores do not alter flags
        tya
        eor #$c3
        plp
        sta abst,x
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldy1

        ldx #3
tldy2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1,x
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt,x
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldy2

        ldx #3
tldy3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1,x
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt,x
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldy3

        ldx #3 ;testing store result
        ldy #0
tsty    lda zpt,x
        eor #$c3
        cmp zp1,x
        bne 0+* ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        eor #$c3
        cmp abs1,x
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tsty
            lda test_case ;previous test
            cmp #17
        bne 0+* ;failed not equal (non zero)
            lda #18 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; indexed wraparound test (only zp should wrap)
        ldx #3+$fa
tldy4   ldy zp1-$fa&$ff,x ;wrap on indexed zp
        tya
        sta abst-$fa,x ;no STX abs,x!
        dex
        cpx #$fa
        bcs tldy4
        ldx #3+$fa
tldy5   ldy abs1-$fa,x ;no wrap on indexed abs
        sty zpt-$fa&$ff,x
        dex
        cpx #$fa
        bcs tldy5
        ldx #3 ;testing wraparound result
        ldy #0
tsty1   lda zpt,x
        cmp zp1,x
        bne 0+* ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        cmp abs1,x
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tsty1
            lda test_case ;previous test
            cmp #18
        bne 0+* ;failed not equal (non zero)
            lda #19 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; LDX / STX - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+1
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+2
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+2
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+3
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+3
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+1
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+2
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+2
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx zp1+3
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx abst+3
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+1
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+2
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+2
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+3
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+3
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+1
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+1
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+2
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+2
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx abs1+3
        php ;test stores do not alter flags
        txa
        eor #$c3
        tax
        plp
        stx zpt+3
        php ;flags after load/store sequence
        eor #$c3
        tax
        cpx zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$c3
        php
        cpx abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$82
        php
        cpx abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$41
        php
        cpx abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #0
        php
        cpx abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$c3
        php
        cpx abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$82
        php
        cpx abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$41
        php
        cpx abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #0
        php
        cpx abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

        ldx #0
        lda zpt
        eor #$c3
        cmp zp1
        bne 0+* ;failed not equal (non zero)
        stx zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        bne 0+* ;failed not equal (non zero)
        stx abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        bne 0+* ;failed not equal (non zero)
        stx zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        bne 0+* ;failed not equal (non zero)
        stx abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        bne 0+* ;failed not equal (non zero)
        stx zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        bne 0+* ;failed not equal (non zero)
        stx abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        bne 0+* ;failed not equal (non zero)
        stx zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        bne 0+* ;failed not equal (non zero)
        stx abst+3 ;clear
            lda test_case ;previous test
            cmp #19
        bne 0+* ;failed not equal (non zero)
            lda #20 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; LDY / STY - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+1
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+2
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+2
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+3
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+3
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+1
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+2
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+2
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy zp1+3
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty abst+3
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+1
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+2
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+2
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+3
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+3
        php ;flags after load/store sequence
        eor #$c3
        tay
        cpy zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt
        php ;flags after load/store sequence
        eor #$c3
        tay
        cmp zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+1
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+1
        php ;flags after load/store sequence
        eor #$c3
        tay
        cmp zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+2
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+2
        php ;flags after load/store sequence
        eor #$c3
        tay
        cmp zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy abs1+3
        php ;test stores do not alter flags
        tya
        eor #$c3
        tay
        plp
        sty zpt+3
        php ;flags after load/store sequence
        eor #$c3
        tay
        cmp zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)


            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$c3
        php
        cpy abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$82
        php
        cpy abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$41
        php
        cpy abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #0
        php
        cpy abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$c3
        php
        cpy abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$82
        php
        cpy abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$41
        php
        cpy abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #0
        php
        cpy abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

        ldy #0
        lda zpt
        eor #$c3
        cmp zp1
        bne 0+* ;failed not equal (non zero)
        sty zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        bne 0+* ;failed not equal (non zero)
        sty abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        bne 0+* ;failed not equal (non zero)
        sty zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        bne 0+* ;failed not equal (non zero)
        sty abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        bne 0+* ;failed not equal (non zero)
        sty zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        bne 0+* ;failed not equal (non zero)
        sty abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        bne 0+* ;failed not equal (non zero)
        sty zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        bne 0+* ;failed not equal (non zero)
        sty abst+3 ;clear
            lda test_case ;previous test
            cmp #20
        bne 0+* ;failed not equal (non zero)
            lda #21 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing load / store accumulator LDA / STA all addressing modes
; LDA / STA - zp,x / abs,x
        ldx #3
tldax
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1,x
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst,x
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldax

        ldx #3
tldax1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1,x
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst,x
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldax1

        ldx #3
tldax2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1,x
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt,x
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldax2

        ldx #3
tldax3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1,x
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt,x
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1,x ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tldax3

        ldx #3 ;testing store result
        ldy #0
tstax   lda zpt,x
        eor #$c3
        cmp zp1,x
        bne 0+* ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        eor #$c3
        cmp abs1,x
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tstax
            lda test_case ;previous test
            cmp #21
        bne 0+* ;failed not equal (non zero)
            lda #22 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; LDA / STA - (zp),y / abs,y / (zp,x)
        ldy #3
tlday
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda (ind1),y
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst,y
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tlday

        ldy #3
tlday1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda (ind1),y
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst,y
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tlday1

        ldy #3 ;testing store result
        ldx #0
tstay   lda abst,y
        eor #$c3
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay

        ldy #3
tlday2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1,y
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta (indt),y
        php ;flags after load/store sequence
        eor #$c3
        cmp (ind1),y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tlday2

        ldy #3
tlday3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1,y
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta (indt),y
        php ;flags after load/store sequence
        eor #$c3
        cmp (ind1),y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tlday3

        ldy #3 ;testing store result
        ldx #0
tstay1  lda abst,y
        eor #$c3
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay1

        ldx #6
        ldy #3
tldax4
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda (ind1,x)
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta (indt,x)
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tldax4

        ldx #6
        ldy #3
tldax5
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda (ind1,x)
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta (indt,x)
        php ;flags after load/store sequence
        eor #$c3
        cmp abs1,y ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tldax5

        ldy #3 ;testing store result
        ldx #0
tstay2  lda abst,y
        eor #$c3
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay2
            lda test_case ;previous test
            cmp #22
        bne 0+* ;failed not equal (non zero)
            lda #23 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; indexed wraparound test (only zp should wrap)
        ldx #3+$fa
tldax6  lda zp1-$fa&$ff,x ;wrap on indexed zp
        sta abst-$fa,x ;no STX abs,x!
        dex
        cpx #$fa
        bcs tldax6
        ldx #3+$fa
tldax7  lda abs1-$fa,x ;no wrap on indexed abs
        sta zpt-$fa&$ff,x
        dex
        cpx #$fa
        bcs tldax7

        ldx #3 ;testing wraparound result
        ldy #0
tstax1  lda zpt,x
        cmp zp1,x
        bne 0+* ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        cmp abs1,x
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tstax1

        ldy #3+$f8
        ldx #6+$f8
tlday4  lda (ind1-$f8&$ff,x) ;wrap on indexed zp indirect
        sta abst-$f8,y
        dex
        dex
        dey
        cpy #$f8
        bcs tlday4
        ldy #3 ;testing wraparound result
        ldx #0
tstay4  lda abst,y
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay4

        ldy #3+$f8
tlday5  lda abs1-$f8,y ;no wrap on indexed abs
        sta (inwt),y
        dey
        cpy #$f8
        bcs tlday5
        ldy #3 ;testing wraparound result
        ldx #0
tstay5  lda abst,y
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay5

        ldy #3+$f8
        ldx #6+$f8
tlday6  lda (inw1),y ;no wrap on zp indirect indexed
        sta (indt-$f8&$ff,x)
        dex
        dex
        dey
        cpy #$f8
        bcs tlday6
        ldy #3 ;testing wraparound result
        ldx #0
tstay6  lda abst,y
        cmp abs1,y
        bne 0+* ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay6
            lda test_case ;previous test
            cmp #23
        bne 0+* ;failed not equal (non zero)
            lda #24 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; LDA / STA - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst
        php ;flags after load/store sequence
        eor #$c3
        cmp #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+1
        php ;flags after load/store sequence
        eor #$c3
        cmp #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+2
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+2
        php ;flags after load/store sequence
        eor #$c3
        cmp #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+3
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+3
        php ;flags after load/store sequence
        eor #$c3
        cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst
        php ;flags after load/store sequence
        eor #$c3
        cmp #$c3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+1
        php ;flags after load/store sequence
        eor #$c3
        cmp #$82 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+2
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+2
        php ;flags after load/store sequence
        eor #$c3
        cmp #$41 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda zp1+3
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta abst+3
        php ;flags after load/store sequence
        eor #$c3
        cmp #0 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+1
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+2
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+2
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+3
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+3
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+1
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+1
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+2
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+2
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda abs1+3
        php ;test stores do not alter flags
        eor #$c3
        plp
        sta zpt+3
        php ;flags after load/store sequence
        eor #$c3
        cmp zp1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$c3
        php
        cmp abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$82
        php
        cmp abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$41
        php
        cmp abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #0
        php
        cmp abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$c3
        php
        cmp abs1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$82
        php
        cmp abs1+1 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$41
        php
        cmp abs1+2 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #0
        php
        cmp abs1+3 ;test result
        bne 0+* ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        bne 0+* ;failed not equal (non zero)

        ldx #0
        lda zpt
        eor #$c3
        cmp zp1
        bne 0+* ;failed not equal (non zero)
        stx zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        bne 0+* ;failed not equal (non zero)
        stx abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        bne 0+* ;failed not equal (non zero)
        stx zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        bne 0+* ;failed not equal (non zero)
        stx abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        bne 0+* ;failed not equal (non zero)
        stx zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        bne 0+* ;failed not equal (non zero)
        stx abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        bne 0+* ;failed not equal (non zero)
        stx zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        bne 0+* ;failed not equal (non zero)
        stx abst+3 ;clear
            lda test_case ;previous test
            cmp #24
        bne 0+* ;failed not equal (non zero)
            lda #25 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing bit test & compares BIT CPX CPY CMP all addressing modes
; BIT - zp / abs
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit zp1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit zp1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit abs1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit abs1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fv|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #25
        bne 0+* ;failed not equal (non zero)
            lda #26 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; CPX - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldx #$80 ;precharge index x
            plp
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save flags
            cpx #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #26
        bne 0+* ;failed not equal (non zero)
            lda #27 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; CPY - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            ldy #$80 ;precharge index y
            plp
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save flags
            cpy #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #27
        bne 0+* ;failed not equal (non zero)
            lda #28 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; CMP - zp / abs / #
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

        ldx #4 ;with indexing by X
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

        ldy #4 ;with indexing by Y
        ldx #8 ;with indexed indirect
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$80 ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7f ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7e ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #28
        bne 0+* ;failed not equal (non zero)
            lda #29 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing shifts - ASL LSR ROL ROR all addressing modes
; shifts - accumulator
        ldx #3
tasl
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        asl a
            php ;save flags
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl
        ldx #3
tasl1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        asl a
            php ;save flags
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl1

        ldx #3
tlsr
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        lsr a
            php ;save flags
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr
        ldx #3
tlsr1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        lsr a
            php ;save flags
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr1

        ldx #3
trol
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        rol a
            php ;save flags
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol
        ldx #3
trol1
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        rol a
            php ;save flags
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol1

        ldx #3
trolc
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        rol a
            php ;save flags
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc
        ldx #3
trolc1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        rol a
            php ;save flags
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc1

        ldx #3
tror
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        ror a
            php ;save flags
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror
        ldx #3
tror1
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        ror a
            php ;save flags
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror1

        ldx #3
trorc
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        ror a
            php ;save flags
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc
        ldx #3
trorc1
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;precharge accu
            plp
        ror a
            php ;save flags
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc1
            lda test_case ;previous test
            cmp #29
        bne 0+* ;failed not equal (non zero)
            lda #30 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; shifts - zeropage
        ldx #3
tasl2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        asl zpt
            php ;save flags
            lda zpt
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl2
        ldx #3
tasl3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        asl zpt
            php ;save flags
            lda zpt
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl3

        ldx #3
tlsr2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        lsr zpt
            php ;save flags
            lda zpt
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr2
        ldx #3
tlsr3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        lsr zpt
            php ;save flags
            lda zpt
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr3

        ldx #3
trol2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        rol zpt
            php ;save flags
            lda zpt
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol2
        ldx #3
trol3
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        rol zpt
            php ;save flags
            lda zpt
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol3

        ldx #3
trolc2
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        rol zpt
            php ;save flags
            lda zpt
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc2
        ldx #3
trolc3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        rol zpt
            php ;save flags
            lda zpt
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc3

        ldx #3
tror2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        ror zpt
            php ;save flags
            lda zpt
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror2
        ldx #3
tror3
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        ror zpt
            php ;save flags
            lda zpt
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror3

        ldx #3
trorc2
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        ror zpt
            php ;save flags
            lda zpt
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc2
        ldx #3
trorc3
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to zeropage
            sta zpt
            plp
        ror zpt
            php ;save flags
            lda zpt
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc3
            lda test_case ;previous test
            cmp #30
        bne 0+* ;failed not equal (non zero)
            lda #31 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; shifts - absolute
        ldx #3
tasl4
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        asl abst
            php ;save flags
            lda abst
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl4
        ldx #3
tasl5
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        asl abst
            php ;save flags
            lda abst
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl5

        ldx #3
tlsr4
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        lsr abst
            php ;save flags
            lda abst
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr4
        ldx #3
tlsr5
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        lsr abst
            php ;save flags
            lda abst
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr5

        ldx #3
trol4
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        rol abst
            php ;save flags
            lda abst
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol4
        ldx #3
trol5
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        rol abst
            php ;save flags
            lda abst
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol5

        ldx #3
trolc4
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        rol abst
            php ;save flags
            lda abst
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc4
        ldx #3
trolc5
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        rol abst
            php ;save flags
            lda abst
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc5

        ldx #3
tror4
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        ror abst
            php ;save flags
            lda abst
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror4
        ldx #3
tror5
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        ror abst
            php ;save flags
            lda abst
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror5

        ldx #3
trorc4
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        ror abst
            php ;save flags
            lda abst
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc4
        ldx #3
trorc5
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to memory
            sta abst
            plp
        ror abst
            php ;save flags
            lda abst
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc5
            lda test_case ;previous test
            cmp #31
        bne 0+* ;failed not equal (non zero)
            lda #32 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; shifts - zp indexed
        ldx #3
tasl6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        asl zpt,x
            php ;save flags
            lda zpt,x
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl6
        ldx #3
tasl7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        asl zpt,x
            php ;save flags
            lda zpt,x
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl7

        ldx #3
tlsr6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        lsr zpt,x
            php ;save flags
            lda zpt,x
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr6
        ldx #3
tlsr7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        lsr zpt,x
            php ;save flags
            lda zpt,x
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr7

        ldx #3
trol6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        rol zpt,x
            php ;save flags
            lda zpt,x
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol6
        ldx #3
trol7
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        rol zpt,x
            php ;save flags
            lda zpt,x
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol7

        ldx #3
trolc6
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        rol zpt,x
            php ;save flags
            lda zpt,x
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc6
        ldx #3
trolc7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        rol zpt,x
            php ;save flags
            lda zpt,x
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc7

        ldx #3
tror6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        ror zpt,x
            php ;save flags
            lda zpt,x
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror6
        ldx #3
tror7
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        ror zpt,x
            php ;save flags
            lda zpt,x
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror7

        ldx #3
trorc6
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        ror zpt,x
            php ;save flags
            lda zpt,x
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc6
        ldx #3
trorc7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed zeropage
            sta zpt,x
            plp
        ror zpt,x
            php ;save flags
            lda zpt,x
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc7
            lda test_case ;previous test
            cmp #32
        bne 0+* ;failed not equal (non zero)
            lda #33 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; shifts - abs indexed
        ldx #3
tasl8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        asl abst,x
            php ;save flags
            lda abst,x
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl8
        ldx #3
tasl9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        asl abst,x
            php ;save flags
            lda abst,x
            cmp rASL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tasl9

        ldx #3
tlsr8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        lsr abst,x
            php ;save flags
            lda abst,x
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr8
        ldx #3
tlsr9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        lsr abst,x
            php ;save flags
            lda abst,x
            cmp rLSR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tlsr9

        ldx #3
trol8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        rol abst,x
            php ;save flags
            lda abst,x
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol8
        ldx #3
trol9
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        rol abst,x
            php ;save flags
            lda abst,x
            cmp rROL,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trol9

        ldx #3
trolc8
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        rol abst,x
            php ;save flags
            lda abst,x
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc8
        ldx #3
trolc9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        rol abst,x
            php ;save flags
            lda abst,x
            cmp rROLc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trolc9

        ldx #3
tror8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        ror abst,x
            php ;save flags
            lda abst,x
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror8
        ldx #3
tror9
            lda #$ff-fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        ror abst,x
            php ;save flags
            lda abst,x
            cmp rROR,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tror9

        ldx #3
trorc8
            lda #fc ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        ror abst,x
            php ;save flags
            lda abst,x
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc8
        ldx #3
trorc9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda zp1,x ;load to indexed memory
            sta abst,x
            plp
        ror abst,x
            php ;save flags
            lda abst,x
            cmp rRORc,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl trorc9
            lda test_case ;previous test
            cmp #33
        bne 0+* ;failed not equal (non zero)
            lda #34 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing memory increment/decrement - INC DEC all addressing modes
; zeropage
        ldx #0
        lda #$7e
        sta zpt
tinc
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc zpt
            php ;save flags
            lda zpt
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        inx
        cpx #2
        bne tinc1
        lda #$fe
        sta zpt
tinc1   cpx #5
        bne tinc
        dex
        inc zpt
tdec
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec zpt
            php ;save flags
            lda zpt
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bmi tdec1
        cpx #1
        bne tdec
        lda #$81
        sta zpt
        bne tdec
tdec1
        ldx #0
        lda #$7e
        sta zpt
tinc10
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc zpt
            php ;save flags
            lda zpt
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        inx
        cpx #2
        bne tinc11
        lda #$fe
        sta zpt
tinc11  cpx #5
        bne tinc10
        dex
        inc zpt
tdec10
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec zpt
            php ;save flags
            lda zpt
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bmi tdec11
        cpx #1
        bne tdec10
        lda #$81
        sta zpt
        bne tdec10
tdec11
            lda test_case ;previous test
            cmp #34
        bne 0+* ;failed not equal (non zero)
            lda #35 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; absolute memory
        ldx #0
        lda #$7e
        sta abst
tinc2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc abst
            php ;save flags
            lda abst
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        inx
        cpx #2
        bne tinc3
        lda #$fe
        sta abst
tinc3   cpx #5
        bne tinc2
        dex
        inc abst
tdec2
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec abst
            php ;save flags
            lda abst
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bmi tdec3
        cpx #1
        bne tdec2
        lda #$81
        sta abst
        bne tdec2
tdec3
        ldx #0
        lda #$7e
        sta abst
tinc12
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc abst
            php ;save flags
            lda abst
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        inx
        cpx #2
        bne tinc13
        lda #$fe
        sta abst
tinc13   cpx #5
        bne tinc12
        dex
        inc abst
tdec12
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec abst
            php ;save flags
            lda abst
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bmi tdec13
        cpx #1
        bne tdec12
        lda #$81
        sta abst
        bne tdec12
tdec13
            lda test_case ;previous test
            cmp #35
        bne 0+* ;failed not equal (non zero)
            lda #36 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; zeropage indexed
        ldx #0
        lda #$7e
tinc4   sta zpt,x
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc zpt,x
            php ;save flags
            lda zpt,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda zpt,x
        inx
        cpx #2
        bne tinc5
        lda #$fe
tinc5   cpx #5
        bne tinc4
        dex
        lda #2
tdec4   sta zpt,x
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec zpt,x
            php ;save flags
            lda zpt,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda zpt,x
        dex
        bmi tdec5
        cpx #1
        bne tdec4
        lda #$81
        bne tdec4
tdec5
        ldx #0
        lda #$7e
tinc14  sta zpt,x
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc zpt,x
            php ;save flags
            lda zpt,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda zpt,x
        inx
        cpx #2
        bne tinc15
        lda #$fe
tinc15  cpx #5
        bne tinc14
        dex
        lda #2
tdec14  sta zpt,x
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec zpt,x
            php ;save flags
            lda zpt,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda zpt,x
        dex
        bmi tdec15
        cpx #1
        bne tdec14
        lda #$81
        bne tdec14
tdec15
            lda test_case ;previous test
            cmp #36
        bne 0+* ;failed not equal (non zero)
            lda #37 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; memory indexed
        ldx #0
        lda #$7e
tinc6   sta abst,x
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc abst,x
            php ;save flags
            lda abst,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda abst,x
        inx
        cpx #2
        bne tinc7
        lda #$fe
tinc7   cpx #5
        bne tinc6
        dex
        lda #2
tdec6   sta abst,x
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec abst,x
            php ;save flags
            lda abst,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda abst,x
        dex
        bmi tdec7
        cpx #1
        bne tdec6
        lda #$81
        bne tdec6
tdec7
        ldx #0
        lda #$7e
tinc16  sta abst,x
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inc abst,x
            php ;save flags
            lda abst,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda abst,x
        inx
        cpx #2
        bne tinc17
        lda #$fe
tinc17  cpx #5
        bne tinc16
        dex
        lda #2
tdec16  sta abst,x
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        dec abst,x
            php ;save flags
            lda abst,x
            cmp rINC,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        bne 0+* ;failed not equal (non zero)
        lda abst,x
        dex
        bmi tdec17
        cpx #1
        bne tdec16
        lda #$81
        bne tdec16
tdec17
            lda test_case ;previous test
            cmp #37
        bne 0+* ;failed not equal (non zero)
            lda #38 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; testing logical instructions - AND EOR ORA all addressing modes
; AND
        ldx #3 ;immediate
tand    lda zpAN,x
        sta ex_andi+1 ;set AND # operand
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        jsr ex_andi ;execute AND # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand
        ldx #3
tand1   lda zpAN,x
        sta ex_andi+1 ;set AND # operand
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        jsr ex_andi ;execute AND # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand1

        ldx #3 ;zp
tand2   lda zpAN,x
        sta zpt
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand2
        ldx #3
tand3   lda zpAN,x
        sta zpt
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand3

        ldx #3 ;abs
tand4   lda zpAN,x
        sta abst
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand4
        ldx #3
tand5   lda zpAN,x
        sta abst
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand6

        ldx #3 ;zp,x
tand6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and zpAN,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand6
        ldx #3
tand7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and zpAN,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand7

        ldx #3 ;abs,x
tand8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and absAN,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand8
        ldx #3
tand9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,x ;precharge accu
            plp
        and absAN,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tand9

        ldy #3 ;abs,y
tand10
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and absAN,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tand10
        ldy #3
tand11
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and absAN,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tand11

        ldx #6 ;(zp,x)
        ldy #3
tand12
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and (indAN,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tand12
        ldx #6
        ldy #3
tand13
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and (indAN,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tand13

        ldy #3 ;(zp),y
tand14
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and (indAN),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tand14
        ldy #3
tand15
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absANa,y ;precharge accu
            plp
        and (indAN),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tand15
            lda test_case ;previous test
            cmp #38
        bne 0+* ;failed not equal (non zero)
            lda #39 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; EOR
        ldx #3 ;immediate - self modifying code
teor    lda zpEO,x
        sta ex_eori+1 ;set EOR # operand
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        jsr ex_eori ;execute EOR # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor
        ldx #3
teor1   lda zpEO,x
        sta ex_eori+1 ;set EOR # operand
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        jsr ex_eori ;execute EOR # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor1

        ldx #3 ;zp
teor2    lda zpEO,x
        sta zpt
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor2
        ldx #3
teor3   lda zpEO,x
        sta zpt
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor3

        ldx #3 ;abs
teor4   lda zpEO,x
        sta abst
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor4
        ldx #3
teor5   lda zpEO,x
        sta abst
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor6

        ldx #3 ;zp,x
teor6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor zpEO,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor6
        ldx #3
teor7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor zpEO,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor7

        ldx #3 ;abs,x
teor8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor absEO,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor8
        ldx #3
teor9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,x ;precharge accu
            plp
        eor absEO,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl teor9

        ldy #3 ;abs,y
teor10
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor absEO,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl teor10
        ldy #3
teor11
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor absEO,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl teor11

        ldx #6 ;(zp,x)
        ldy #3
teor12
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor (indEO,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl teor12
        ldx #6
        ldy #3
teor13
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor (indEO,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl teor13

        ldy #3 ;(zp),y
teor14
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor (indEO),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl teor14
        ldy #3
teor15
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absEOa,y ;precharge accu
            plp
        eor (indEO),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl teor15
            lda test_case ;previous test
            cmp #39
        bne 0+* ;failed not equal (non zero)
            lda #40 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; OR
        ldx #3 ;immediate - self modifying code
tora    lda zpOR,x
        sta ex_orai+1 ;set ORA # operand
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        jsr ex_orai ;execute ORA # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora
        ldx #3
tora1   lda zpOR,x
        sta ex_orai+1 ;set ORA # operand
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        jsr ex_orai ;execute ORA # in RAM
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora1

        ldx #3 ;zp
tora2   lda zpOR,x
        sta zpt
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora2
        ldx #3
tora3   lda zpOR,x
        sta zpt
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora zpt
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora3

        ldx #3 ;abs
tora4   lda zpOR,x
        sta abst
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora4
        ldx #3
tora5   lda zpOR,x
        sta abst
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora abst
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora6

        ldx #3 ;zp,x
tora6
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora zpOR,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora6
        ldx #3
tora7
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora zpOR,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora7

        ldx #3 ;abs,x
tora8
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora absOR,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora8
        ldx #3
tora9
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,x ;precharge accu
            plp
        ora absOR,x
            php ;save flags
            cmp absrlo,x ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        bpl tora9

        ldy #3 ;abs,y
tora10
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora absOR,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tora10
        ldy #3
tora11
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora absOR,y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tora11

        ldx #6 ;(zp,x)
        ldy #3
tora12
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora (indOR,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tora12
        ldx #6
        ldy #3
tora13
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora (indOR,x)
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tora13

        ldy #3 ;(zp),y
tora14
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora (indOR),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tora14
        ldy #3
tora15
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda absORa,y ;precharge accu
            plp
        ora (indOR),y
            php ;save flags
            cmp absrlo,y ;test result
        bne 0+* ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        bne 0+* ;failed not equal (non zero)
        dey
        bpl tora15
        cli
            lda test_case ;previous test
            cmp #40
        bne 0+* ;failed not equal (non zero)
            lda #41 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; full binary add/subtract test
; iterates through all combinations of operands and carry input
; uses increments/decrements to predict result & result flags
        cld
        ldx #ad2 ;for indexed test
        ldy #$ff ;max range
        lda #0 ;start with adding zeroes & no carry
        sta adfc ;carry in - for diag
        sta ad1 ;operand 1 - accumulator
        sta ad2 ;operand 2 - memory or immediate
        sta ada2 ;non zp
        sta adrl ;expected result bits 0-7
        sta adrh ;expected result bit 8 (carry out)
        lda #$ff ;complemented operand 2 for subtract
        sta sb2
        sta sba2 ;non zp
        lda #2 ;expected Z-flag
        sta adrf
tadd    clc ;test with carry clear
        jsr chkadd
        inc adfc ;now with carry
        inc adrl ;result +1
        php ;save N & Z from low result
        php
        pla ;accu holds expected flags
        and #$82 ;mask N & Z
        plp
        bne tadd1
        inc adrh ;result bit 8 - carry
tadd1   ora adrh ;merge C to expected flags
        sta adrf ;save expected flags except overflow
        sec ;test with carry set
        jsr chkadd
        dec adfc ;same for operand +1 but no carry
        inc ad1
        bne tadd ;iterate op1
        lda #0 ;preset result to op2 when op1 = 0
        sta adrh
        inc ada2
        inc ad2
        php ;save NZ as operand 2 becomes the new result
        pla
        and #$82 ;mask N00000Z0
        sta adrf ;no need to check carry as we are adding to 0
        dec sb2 ;complement subtract operand 2
        dec sba2
        lda ad2
        sta adrl
        bne tadd ;iterate op2
            lda test_case ;previous test
            cmp #41
        bne 0+* ;failed not equal (non zero)
            lda #42 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; decimal add/subtract test
; *** WARNING - tests documented behavior only! ***
;   only valid BCD operands are tested, N V Z flags are ignored
; iterates through all valid combinations of operands and carry input
; uses increments/decrements to predict result & carry flag
        sed
        ldx #ad2 ;for indexed test
        ldy #$ff ;max range
        lda #$99 ;start with adding 99 to 99 with carry
        sta ad1 ;operand 1 - accumulator
        sta ad2 ;operand 2 - memory or immediate
        sta ada2 ;non zp
        sta adrl ;expected result bits 0-7
        lda #1 ;set carry in & out
        sta adfc ;carry in - for diag
        sta adrh ;expected result bit 8 (carry out)
        lda #0 ;complemented operand 2 for subtract
        sta sb2
        sta sba2 ;non zp
tdad    sec ;test with carry set
        jsr chkdad
        dec adfc ;now with carry clear
        lda adrl ;decimal adjust result
        bne tdad1 ;skip clear carry & preset result 99 (9A-1)
        dec adrh
        lda #$99
        sta adrl
        bne tdad3
tdad1   and #$f ;lower nibble mask
        bne tdad2 ;no decimal adjust needed
        dec adrl ;decimal adjust (?0-6)
        dec adrl
        dec adrl
        dec adrl
        dec adrl
        dec adrl
tdad2   dec adrl ;result -1
tdad3   clc ;test with carry clear
        jsr chkdad
        inc adfc ;same for operand -1 but with carry
        lda ad1 ;decimal adjust operand 1
        beq tdad5 ;iterate operand 2
        and #$f ;lower nibble mask
        bne tdad4 ;skip decimal adjust
        dec ad1 ;decimal adjust (?0-6)
        dec ad1
        dec ad1
        dec ad1
        dec ad1
        dec ad1
tdad4   dec ad1 ;operand 1 -1
        jmp tdad ;iterate op1

tdad5   lda #$99 ;precharge op1 max
        sta ad1
        lda ad2 ;decimal adjust operand 2
        beq tdad7 ;end of iteration
        and #$f ;lower nibble mask
        bne tdad6 ;skip decimal adjust
        dec ad2 ;decimal adjust (?0-6)
        dec ad2
        dec ad2
        dec ad2
        dec ad2
        dec ad2
        inc sb2 ;complemented decimal adjust for subtract (?9+6)
        inc sb2
        inc sb2
        inc sb2
        inc sb2
        inc sb2
tdad6   dec ad2 ;operand 2 -1
        inc sb2 ;complemented operand for subtract
        lda sb2
        sta sba2 ;copy as non zp operand
        lda ad2
        sta ada2 ;copy as non zp operand
        sta adrl ;new result since op1+carry=00+carry +op2=op2
        inc adrh ;result carry
        bne tdad ;iterate op2
tdad7
            lda test_case ;previous test
            cmp #42
        bne 0+* ;failed not equal (non zero)
            lda #43 ;*** next tests' number
            sta test_case
            ;check_ram       ;uncomment to find altered RAM after each test

; decimal/binary switch test
; tests CLD, SED, PLP, RTI to properly switch between decimal & binary opcode
;   tables
        clc
        cld
        php
        lda #$55
        adc #$55
        cmp #$aa
        bne 0+* ;failed not equal (non zero)
        clc
        sed
        php
        lda #$55
        adc #$55
        cmp #$10
        bne 0+* ;failed not equal (non zero)
        cld
        plp
        lda #$55
        adc #$55
        cmp #$10
        bne 0+* ;failed not equal (non zero)
        plp
        lda #$55
        adc #$55
        cmp #$aa
        bne 0+* ;failed not equal (non zero)
        clc
        lda #> bin_rti_ret ;emulated interrupt for rti
        pha
        lda #< bin_rti_ret
        pha
        php
        sed
        lda #> dec_rti_ret ;emulated interrupt for rti
        pha
        lda #< dec_rti_ret
        pha
        php
        cld
        rti
dec_rti_ret
        lda #$55
        adc #$55
        cmp #$10
        bne 0+* ;failed not equal (non zero)
        rti
bin_rti_ret
        lda #$55
        adc #$55
        cmp #$aa
        bne 0+* ;failed not equal (non zero)

        lda test_case
        cmp #43
        bne 0+* ;failed not equal (non zero)
        lda #$f0 ;mark opcode testing complete
        sta test_case

; final RAM integrity test
;   verifies that none of the previous tests has altered RAM outside of the
;   designated write areas.
            ;RAM check disabled - RAM size not set
; *** DEBUG INFO ***
; to debug checksum errors uncomment check_ram in the next_test macro to
; narrow down the responsible opcode.
; may give false errors when monitor, OS or other background activity is
; allowed during previous tests.


; S U C C E S S ************************************************
; -------------
        jmp 0+* ;test passed, no errors
; -------------
; S U C C E S S ************************************************
        jmp start ;run again

; core subroutine of the decimal add/subtract test
; *** WARNING - tests documented behavior only! ***
;   only valid BCD operands are tested, N V Z flags are ignored
; iterates through all valid combinations of operands and carry input
; uses increments/decrements to predict result & carry flag
chkdad
; decimal ADC / SBC zp
        php ;save carry for subtract
        lda ad1
        adc ad2 ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2 ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC abs
        php ;save carry for subtract
        lda ad1
        adc ada2 ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2 ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC #
        php ;save carry for subtract
        lda ad2
        sta ex_adci+1 ;set ADC # operand
        lda ad1
        jsr ex_adci ;execute ADC # in RAM
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda sb2
        sta ex_sbci+1 ;set SBC # operand
        lda ad1
        jsr ex_sbci ;execute SBC # in RAM
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC zp,x
        php ;save carry for subtract
        lda ad1
        adc 0,x ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC abs,x
        php ;save carry for subtract
        lda ad1
        adc ada2-ad2,x ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC abs,y
        php ;save carry for subtract
        lda ad1
        adc ada2-$ff,y ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-$ff,y ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC (zp,x)
        php ;save carry for subtract
        lda ad1
        adc (< adi2-ad2,x) ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (< sbi2-ad2,x) ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
; decimal ADC / SBC (abs),y
        php ;save carry for subtract
        lda ad1
        adc (adiy2),y ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (sbiy2),y ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        bne 0+* ;failed not equal (non zero)
        plp
        rts

; core subroutine of the full binary add/subtract test
; iterates through all combinations of operands and carry input
; uses increments/decrements to predict result & result flags
chkadd  lda adrf ;add V-flag if overflow
        and #$83 ;keep N-----ZC / clear V
        pha
        lda ad1 ;test sign unequal between operands
        eor ad2
        bmi ckad1 ;no overflow possible - operands have different sign
        lda ad1 ;test sign equal between operands and result
        eor adrl
        bpl ckad1 ;no overflow occured - operand and result have same sign
        pla
        ora #$40 ;set V
        pha
ckad1   pla
        sta adrf ;save expected flags
; binary ADC / SBC zp
        php ;save carry for subtract
        lda ad1
        adc ad2 ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2 ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC abs
        php ;save carry for subtract
        lda ad1
        adc ada2 ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2 ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC #
        php ;save carry for subtract
        lda ad2
        sta ex_adci+1 ;set ADC # operand
        lda ad1
        jsr ex_adci ;execute ADC # in RAM
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda sb2
        sta ex_sbci+1 ;set SBC # operand
        lda ad1
        jsr ex_sbci ;execute SBC # in RAM
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC zp,x
        php ;save carry for subtract
        lda ad1
        adc 0,x ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC abs,x
        php ;save carry for subtract
        lda ad1
        adc ada2-ad2,x ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC abs,y
        php ;save carry for subtract
        lda ad1
        adc ada2-$ff,y ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-$ff,y ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC (zp,x)
        php ;save carry for subtract
        lda ad1
        adc (< adi2-ad2,x) ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (< sbi2-ad2,x) ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
; binary ADC / SBC (abs),y
        php ;save carry for subtract
        lda ad1
        adc (adiy2),y ;perform add
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (sbiy2),y ;perform subtract
        php
        cmp adrl ;check result
        bne 0+* ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        bne 0+* ;failed not equal (non zero)
        plp
        rts

; target for the jump absolute test
        dey
        dey
test_far
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        bcs 0+* ;failed carry set
        bvs 0+* ;failed overflow set
        bmi 0+* ;failed minus (bit 7 set)
        beq 0+* ;failed equal (zero)
        cmp #'F' ;registers loaded?
        bne 0+* ;failed not equal (non zero)
        cpx #'A'
        bne 0+* ;failed not equal (non zero)
        cpy #('R'-3)
        bne 0+* ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx
        cpx #$fd ;check SP
        bne 0+* ;failed not equal (non zero)
        pla ;restore x
        tax
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        pla ;restore a
        inx ;return registers with modifications
        eor #$aa ;N=1, V=1, Z=0, C=1
        jmp far_ret

; target for the jump indirect test
        .RES (*&1) ; AS65 ALIGN -> even address
ptr_tst_ind .WORD test_ind
ptr_ind_ret .WORD ind_ret
        jmp 0+* ;failed anyway
        dey
        dey
test_ind
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        bcs 0+* ;failed carry set
        bvs 0+* ;failed overflow set
        bmi 0+* ;failed minus (bit 7 set)
        beq 0+* ;failed equal (zero)
        cmp #'I' ;registers loaded?
        bne 0+* ;failed not equal (non zero)
        cpx #'N'
        bne 0+* ;failed not equal (non zero)
        cpy #('D'-3)
        bne 0+* ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx
        cpx #$fd ;check SP
        bne 0+* ;failed not equal (non zero)
        pla ;restore x
        tax
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        pla ;restore a
        inx ;return registers with modifications
        eor #$aa ;N=1, V=1, Z=0, C=1
        jmp (ptr_ind_ret)
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue

; target for the jump subroutine test
        dey
        dey
test_jsr
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        bcs 0+* ;failed carry set
        bvs 0+* ;failed overflow set
        bmi 0+* ;failed minus (bit 7 set)
        beq 0+* ;failed equal (zero)
        cmp #'J' ;registers loaded?
        bne 0+* ;failed not equal (non zero)
        cpx #'S'
        bne 0+* ;failed not equal (non zero)
        cpy #('R'-3)
        bne 0+* ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx ;sp -4? (return addr,a,x)
        cpx #$fb
        bne 0+* ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(jsr_ret)
        bne 0+* ;failed not equal (non zero)
        lda $1fe
        cmp #<(jsr_ret)
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        pla ;pull x,a
        tax
        pla
        inx ;return registers with modifications
        eor #$aa ;N=1, V=1, Z=0, C=1
        rts
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue

;trap in case of unexpected IRQ, NMI, BRK, RESET - BRK test target
nmi_trap
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue
res_trap
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue

        dey
        dey
irq_trap ;BRK test or unextpected BRK or IRQ
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        ;next traps could be caused by unexpected BRK or IRQ
        ;check stack for BREAK and originating location
        ;possible jump/branch into weeds (uninitialized space)
        cmp #$ff-'B' ;BRK pass 2 registers loaded?
        beq break2
        cmp #'B' ;BRK pass 1 registers loaded?
        bne 0+* ;failed not equal (non zero)
        cpx #'R'
        bne 0+* ;failed not equal (non zero)
        cpy #'K'-3
        bne 0+* ;failed not equal (non zero)
        sta irq_a ;save registers during break test
        stx irq_x
        tsx ;test break on stack
        lda $102,x
            cmp #(0|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        pla
            cmp #(intdis|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        tsx
        cpx #$fc ;sp -3? (return addr, flags)
        bne 0+* ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(brk_ret0)
        bne 0+* ;failed not equal (non zero)
        lda $1fe
        cmp #<(brk_ret0)
        bne 0+* ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldx irq_x
        inx ;return registers with modifications
        lda irq_a
        eor #$aa
        plp ;N=1, V=1, Z=1, C=1 but original flags should be restored
        rti
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue

break2 ;BRK pass 2
        cpx #$ff-'R'
        bne 0+* ;failed not equal (non zero)
        cpy #$ff-'K'-3
        bne 0+* ;failed not equal (non zero)
        sta irq_a ;save registers during break test
        stx irq_x
        tsx ;test break on stack
        lda $102,x
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        pla
        ora #decmode ;ignore decmode cleared if 65c02
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        bne 0+* ;failed not equal (non zero)
        tsx
        cpx #$fc ;sp -3? (return addr, flags)
        bne 0+* ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(brk_ret1)
        bne 0+* ;failed not equal (non zero)
        lda $1fe
        cmp #<(brk_ret1)
        bne 0+* ;failed not equal (non zero)
            lda #intdis ;allow test to change I-flag (no mask)
        pha
        ldx irq_x
        inx ;return registers with modifications
        lda irq_a
        eor #$aa
        plp ;N=0, V=0, Z=0, C=0 but original flags should be restored
        rti
        jmp 0+* ;failed anyway
        jmp start ;catastrophic error - cannot continue


;copy of data to initialize BSS segment


        .END
