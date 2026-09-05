; =============================================================================
; 6502 FUNCTIONAL TEST - Apple II+ safe-loader / ASM_core.js edition V2
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
;   - ALIGN -> explicit one-byte padding at the fixed alignment site.
;   - DATA/BSS/CODE/NOOPT selectors omitted; explicit ORG directives remain.
;   - END start -> .END.
;   - Current-PC trap operands -> explicit self-loop labels.
;   - No emitted instruction/data directive depends on current-PC `*`.
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
 ; To run load intel hex image with a load command, than alter PC to 400 hex
 ; (code_segment) and enter a go command.
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
        TRAP0001 JMP TRAP0001 ;failed anyway
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
        TRAP0002 JMP TRAP0002 ;failed anyway

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
        TRAP0003 JMP TRAP0003 ;failed anyway
psb_test
        bne psb_back
        TRAP0004 JMP TRAP0004 ;failed anyway
psb_fwok

 ;initialize BSS segment

 ;retain status of interrupt flag

 ;generate checksum for RAM integrity test
            lda test_case ;previous test
            cmp #0
        TRAP0005 BNE TRAP0005 ;failed not equal (non zero)
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
range_adr   = range_op+1 ;modifiable relative address
        beq range_op+64 ;+64 if called without modification
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
        TRAP0006 JMP TRAP0006 ;failed anyway
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
        TRAP0007 BNE TRAP0007 ;failed not equal (non zero)
            lda #2 ;*** next tests' number
            sta test_case
 ;check_ram       ;uncomment to find altered RAM after each test

 ;partial test BNE & CMP, CPX, CPY immediate
        cpy #1 ;testing BNE true
        bne test_bne
        TRAP0008 JMP TRAP0008 ;failed anyway
test_bne
        lda #0
        cmp #0 ;test compare immediate
        TRAP0009 BNE TRAP0009 ;failed not equal (non zero)
        TRAP0010 BCC TRAP0010 ;failed carry clear
        TRAP0011 BMI TRAP0011 ;failed minus (bit 7 set)
        cmp #1
        TRAP0012 BEQ TRAP0012 ;failed equal (zero)
        TRAP0013 BCS TRAP0013 ;failed carry set
        TRAP0014 BPL TRAP0014 ;failed plus (bit 7 clear)
        tax
        cpx #0 ;test compare x immediate
        TRAP0015 BNE TRAP0015 ;failed not equal (non zero)
        TRAP0016 BCC TRAP0016 ;failed carry clear
        TRAP0017 BMI TRAP0017 ;failed minus (bit 7 set)
        cpx #1
        TRAP0018 BEQ TRAP0018 ;failed equal (zero)
        TRAP0019 BCS TRAP0019 ;failed carry set
        TRAP0020 BPL TRAP0020 ;failed plus (bit 7 clear)
        tay
        cpy #0 ;test compare y immediate
        TRAP0021 BNE TRAP0021 ;failed not equal (non zero)
        TRAP0022 BCC TRAP0022 ;failed carry clear
        TRAP0023 BMI TRAP0023 ;failed minus (bit 7 set)
        cpy #1
        TRAP0024 BEQ TRAP0024 ;failed equal (zero)
        TRAP0025 BCS TRAP0025 ;failed carry set
        TRAP0026 BPL TRAP0026 ;failed plus (bit 7 clear)
            lda test_case ;previous test
            cmp #2
        TRAP0027 BNE TRAP0027 ;failed not equal (non zero)
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
        TRAP0028 BNE TRAP0028 ;failed not equal (non zero)
        tsx
        txa ;overwrite accu
        cmp #$fd ;sp decremented?
        TRAP0029 BNE TRAP0029 ;failed not equal (non zero)
        pla
        cmp #$aa ;successful retreived from stack?
        TRAP0030 BNE TRAP0030 ;failed not equal (non zero)
        pla
        cmp #$55
        TRAP0031 BNE TRAP0031 ;failed not equal (non zero)
        cmp $1ff ;remains on stack?
        TRAP0032 BNE TRAP0032 ;failed not equal (non zero)
        tsx
        cpx #$ff ;sp incremented?
        TRAP0033 BNE TRAP0033 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #3
        TRAP0034 BNE TRAP0034 ;failed not equal (non zero)
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
        TRAP0035 JMP TRAP0035 ;failed anyway
br1     bvs br2
        TRAP0036 JMP TRAP0036 ;failed anyway
br2     bcs br3
        TRAP0037 JMP TRAP0037 ;failed anyway
br3     beq br4
        TRAP0038 JMP TRAP0038 ;failed anyway
nbr1
        TRAP0039 JMP TRAP0039 ;failed anyway
nbr2
        TRAP0040 JMP TRAP0040 ;failed anyway
nbr3
        TRAP0041 JMP TRAP0041 ;failed anyway
nbr4
        TRAP0042 JMP TRAP0042 ;failed anyway
br4     php
        tsx
        cpx #$fe ;sp after php?
        TRAP0043 BNE TRAP0043 ;failed not equal (non zero)
        pla
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0044 BNE TRAP0044 ;failed not equal (non zero)
        tsx
        cpx #$ff ;sp after php?
        TRAP0045 BNE TRAP0045 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bmi nbr11 ;branches should not be taken
        bvs nbr12
        bcs nbr13
        beq nbr14
        bpl br11 ;branches should be taken
        TRAP0046 JMP TRAP0046 ;failed anyway
br11    bvc br12
        TRAP0047 JMP TRAP0047 ;failed anyway
br12    bcc br13
        TRAP0048 JMP TRAP0048 ;failed anyway
br13    bne br14
        TRAP0049 JMP TRAP0049 ;failed anyway
nbr11
        TRAP0050 JMP TRAP0050 ;failed anyway
nbr12
        TRAP0051 JMP TRAP0051 ;failed anyway
nbr13
        TRAP0052 JMP TRAP0052 ;failed anyway
nbr14
        TRAP0053 JMP TRAP0053 ;failed anyway
br14    php
        pla
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0054 BNE TRAP0054 ;failed not equal (non zero)
 ;crosscheck flags
            lda #zero ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brzs1
        beq brzs2
brzs1
        TRAP0055 JMP TRAP0055 ;failed anyway
brzs2   bcs brzs3
        bcc brzs4
brzs3
        TRAP0056 JMP TRAP0056 ;failed anyway
brzs4   bmi brzs5
        bpl brzs6
brzs5
        TRAP0057 JMP TRAP0057 ;failed anyway
brzs6   bvs brzs7
        bvc brzs8
brzs7
        TRAP0058 JMP TRAP0058 ;failed anyway
brzs8
            lda #carry ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brcs1
        bne brcs2
brcs1
        TRAP0059 JMP TRAP0059 ;failed anyway
brcs2   bcc brcs3
        bcs brcs4
brcs3
        TRAP0060 JMP TRAP0060 ;failed anyway
brcs4   bmi brcs5
        bpl brcs6
brcs5
        TRAP0061 JMP TRAP0061 ;failed anyway
brcs6   bvs brcs7
        bvc brcs8
brcs7
        TRAP0062 JMP TRAP0062 ;failed anyway

brcs8
            lda #minus ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brmi1
        bne brmi2
brmi1
        TRAP0063 JMP TRAP0063 ;failed anyway
brmi2   bcs brmi3
        bcc brmi4
brmi3
        TRAP0064 JMP TRAP0064 ;failed anyway
brmi4   bpl brmi5
        bmi brmi6
brmi5
        TRAP0065 JMP TRAP0065 ;failed anyway
brmi6   bvs brmi7
        bvc brmi8
brmi7
        TRAP0066 JMP TRAP0066 ;failed anyway
brmi8
            lda #overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brvs1
        bne brvs2
brvs1
        TRAP0067 JMP TRAP0067 ;failed anyway
brvs2   bcs brvs3
        bcc brvs4
brvs3
        TRAP0068 JMP TRAP0068 ;failed anyway
brvs4   bmi brvs5
        bpl brvs6
brvs5
        TRAP0069 JMP TRAP0069 ;failed anyway
brvs6   bvc brvs7
        bvs brvs8
brvs7
        TRAP0070 JMP TRAP0070 ;failed anyway
brvs8
            lda #$ff-zero ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        beq brzc1
        bne brzc2
brzc1
        TRAP0071 JMP TRAP0071 ;failed anyway
brzc2   bcc brzc3
        bcs brzc4
brzc3
        TRAP0072 JMP TRAP0072 ;failed anyway
brzc4   bpl brzc5
        bmi brzc6
brzc5
        TRAP0073 JMP TRAP0073 ;failed anyway
brzc6   bvc brzc7
        bvs brzc8
brzc7
        TRAP0074 JMP TRAP0074 ;failed anyway
brzc8
            lda #$ff-carry ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brcc1
        beq brcc2
brcc1
        TRAP0075 JMP TRAP0075 ;failed anyway
brcc2   bcs brcc3
        bcc brcc4
brcc3
        TRAP0076 JMP TRAP0076 ;failed anyway
brcc4   bpl brcc5
        bmi brcc6
brcc5
        TRAP0077 JMP TRAP0077 ;failed anyway
brcc6   bvc brcc7
        bvs brcc8
brcc7
        TRAP0078 JMP TRAP0078 ;failed anyway
brcc8
            lda #$ff-minus ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brpl1
        beq brpl2
brpl1
        TRAP0079 JMP TRAP0079 ;failed anyway
brpl2   bcc brpl3
        bcs brpl4
brpl3
        TRAP0080 JMP TRAP0080 ;failed anyway
brpl4   bmi brpl5
        bpl brpl6
brpl5
        TRAP0081 JMP TRAP0081 ;failed anyway
brpl6   bvc brpl7
        bvs brpl8
brpl7
        TRAP0082 JMP TRAP0082 ;failed anyway
brpl8
            lda #$ff-overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        bne brvc1
        beq brvc2
brvc1
        TRAP0083 JMP TRAP0083 ;failed anyway
brvc2   bcc brvc3
        bcs brvc4
brvc3
        TRAP0084 JMP TRAP0084 ;failed anyway
brvc4   bpl brvc5
        bmi brvc6
brvc5
        TRAP0085 JMP TRAP0085 ;failed anyway
brvc6   bvs brvc7
        bvc brvc8
brvc7
        TRAP0086 JMP TRAP0086 ;failed anyway
brvc8
            lda test_case ;previous test
            cmp #4
        TRAP0087 BNE TRAP0087 ;failed not equal (non zero)
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
        TRAP0088 BNE TRAP0088 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0089 BNE TRAP0089 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #0 ;test result
        TRAP0090 BNE TRAP0090 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0091 BNE TRAP0091 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pha
            php ;save flags
            cmp #$ff ;test result
        TRAP0092 BNE TRAP0092 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0093 BNE TRAP0093 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #1 ;test result
        TRAP0094 BNE TRAP0094 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0095 BNE TRAP0095 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pha
            php ;save flags
            cmp #0 ;test result
        TRAP0096 BNE TRAP0096 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0097 BNE TRAP0097 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pha
            php ;save flags
            cmp #$ff ;test result
        TRAP0098 BNE TRAP0098 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0099 BNE TRAP0099 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pla
            php ;save flags
            cmp #$ff ;test result
        TRAP0100 BNE TRAP0100 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0101 BNE TRAP0101 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pla
            php ;save flags
            cmp #0 ;test result
        TRAP0102 BNE TRAP0102 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0103 BNE TRAP0103 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$fe ;precharge accu
            plp
        pla
            php ;save flags
            cmp #1 ;test result
        TRAP0104 BNE TRAP0104 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero-minus|fao)&m8 ;expected flags + always on bits
        TRAP0105 BNE TRAP0105 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #0 ;precharge accu
            plp
        pla
            php ;save flags
            cmp #$ff ;test result
        TRAP0106 BNE TRAP0106 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0107 BNE TRAP0107 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        pla
            php ;save flags
            cmp #0 ;test result
        TRAP0108 BNE TRAP0108 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0109 BNE TRAP0109 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$fe ;precharge accu
            plp
        pla
            php ;save flags
            cmp #1 ;test result
        TRAP0110 BNE TRAP0110 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0111 BNE TRAP0111 ;failed not equal (non zero)
            plp ;restore status
        cpx #$55 ;x & y unchanged?
        TRAP0112 BNE TRAP0112 ;failed not equal (non zero)
        cpy #$aa
        TRAP0113 BNE TRAP0113 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #5
        TRAP0114 BNE TRAP0114 ;failed not equal (non zero)
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
        TRAP0115 BNE TRAP0115 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0116 BNE TRAP0116 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$c3 ;precharge accu
            plp
        eor #$c3
            php ;save flags
            cmp #0 ;test result
        TRAP0117 BNE TRAP0117 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        TRAP0118 BNE TRAP0118 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #6
        TRAP0119 BNE TRAP0119 ;failed not equal (non zero)
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
        TRAP0120 BNE TRAP0120 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0121 BNE TRAP0121 ;failed not equal (non zero)
            plp ;restore status
        cpx #$24
        TRAP0122 BNE TRAP0122 ;failed not equal (non zero)
        cpy #$42
        TRAP0123 BNE TRAP0123 ;failed not equal (non zero)
        ldx #$db
        ldy #$bd
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$e7 ;precharge accu
            plp
        nop
            php ;save flags
            cmp #$e7 ;test result
        TRAP0124 BNE TRAP0124 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0125 BNE TRAP0125 ;failed not equal (non zero)
            plp ;restore status
        cpx #$db
        TRAP0126 BNE TRAP0126 ;failed not equal (non zero)
        cpy #$bd
        TRAP0127 BNE TRAP0127 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #7
        TRAP0128 BNE TRAP0128 ;failed not equal (non zero)
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
        TRAP0129 BNE TRAP0129 ;failed not equal (non zero)
        inx
        inx
far_ret
        TRAP0130 BEQ TRAP0130 ;failed equal (zero)
        TRAP0131 BPL TRAP0131 ;failed plus (bit 7 clear)
        TRAP0132 BCC TRAP0132 ;failed carry clear
        TRAP0133 BVC TRAP0133 ;failed overflow clear
        cmp #('F'^$aa) ;returned registers OK?
        TRAP0134 BNE TRAP0134 ;failed not equal (non zero)
        cpx #('A'+1)
        TRAP0135 BNE TRAP0135 ;failed not equal (non zero)
        cpy #('R'-3)
        TRAP0136 BNE TRAP0136 ;failed not equal (non zero)
        dex
        iny
        iny
        iny
        eor #$aa ;N=0, V=1, Z=0, C=1
        jmp test_near
        nop
        nop
        TRAP0137 BNE TRAP0137 ;failed not equal (non zero)
        inx
        inx
test_near
        TRAP0138 BEQ TRAP0138 ;failed equal (zero)
        TRAP0139 BMI TRAP0139 ;failed minus (bit 7 set)
        TRAP0140 BCC TRAP0140 ;failed carry clear
        TRAP0141 BVC TRAP0141 ;failed overflow clear
        cmp #'F' ;passed registers OK?
        TRAP0142 BNE TRAP0142 ;failed not equal (non zero)
        cpx #'A'
        TRAP0143 BNE TRAP0143 ;failed not equal (non zero)
        cpy #'R'
        TRAP0144 BNE TRAP0144 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #8
        TRAP0145 BNE TRAP0145 ;failed not equal (non zero)
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
        TRAP0146 BNE TRAP0146 ;failed not equal (non zero)
        dey
        dey
ind_ret
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        TRAP0147 BEQ TRAP0147 ;failed equal (zero)
        TRAP0148 BPL TRAP0148 ;failed plus (bit 7 clear)
        TRAP0149 BCC TRAP0149 ;failed carry clear
        TRAP0150 BVC TRAP0150 ;failed overflow clear
        cmp #('I'^$aa) ;returned registers OK?
        TRAP0151 BNE TRAP0151 ;failed not equal (non zero)
        cpx #('N'+1)
        TRAP0152 BNE TRAP0152 ;failed not equal (non zero)
        cpy #('D'-6)
        TRAP0153 BNE TRAP0153 ;failed not equal (non zero)
        tsx ;SP check
        cpx #$ff
        TRAP0154 BNE TRAP0154 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #9
        TRAP0155 BNE TRAP0155 ;failed not equal (non zero)
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
        jsr_call JSR test_jsr
jsr_ret = jsr_call+2 ;last address of jsr = return address
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        TRAP0156 BEQ TRAP0156 ;failed equal (zero)
        TRAP0157 BPL TRAP0157 ;failed plus (bit 7 clear)
        TRAP0158 BCC TRAP0158 ;failed carry clear
        TRAP0159 BVC TRAP0159 ;failed overflow clear
        cmp #('J'^$aa) ;returned registers OK?
        TRAP0160 BNE TRAP0160 ;failed not equal (non zero)
        cpx #('S'+1)
        TRAP0161 BNE TRAP0161 ;failed not equal (non zero)
        cpy #('R'-6)
        TRAP0162 BNE TRAP0162 ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        TRAP0163 BNE TRAP0163 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #10
        TRAP0164 BNE TRAP0164 ;failed not equal (non zero)
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
        TRAP0165 BNE TRAP0165 ;failed not equal (non zero)
        cpx #'R'+1
        TRAP0166 BNE TRAP0166 ;failed not equal (non zero)
        cpy #'K'-6
        TRAP0167 BNE TRAP0167 ;failed not equal (non zero)
        pla ;returned flags OK (unchanged)?
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0168 BNE TRAP0168 ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        TRAP0169 BNE TRAP0169 ;failed not equal (non zero)
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
        TRAP0170 BNE TRAP0170 ;failed not equal (non zero)
        cpx #$ff-'R'+1
        TRAP0171 BNE TRAP0171 ;failed not equal (non zero)
        cpy #$ff-'K'-6
        TRAP0172 BNE TRAP0172 ;failed not equal (non zero)
        pla ;returned flags OK (unchanged)?
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0173 BNE TRAP0173 ;failed not equal (non zero)
        tsx ;sp?
        cpx #$ff
        TRAP0174 BNE TRAP0174 ;failed not equal (non zero)
            lda test_case ;previous test
            cmp #11
        TRAP0175 BNE TRAP0175 ;failed not equal (non zero)
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
        TRAP0176 BNE TRAP0176 ;failed not equal (non zero)
            plp ;restore status
        sec
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0177 BNE TRAP0177 ;failed not equal (non zero)
            plp ;restore status
        cli
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-intdis|fao)&m8 ;expected flags + always on bits
        TRAP0178 BNE TRAP0178 ;failed not equal (non zero)
            plp ;restore status
        sei
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0179 BNE TRAP0179 ;failed not equal (non zero)
            plp ;restore status
        cld
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-decmode|fao)&m8 ;expected flags + always on bits
        TRAP0180 BNE TRAP0180 ;failed not equal (non zero)
            plp ;restore status
        sed
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0181 BNE TRAP0181 ;failed not equal (non zero)
            plp ;restore status
        clv
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #($ff-overfl|fao)&m8 ;expected flags + always on bits
        TRAP0182 BNE TRAP0182 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0183 BNE TRAP0183 ;failed not equal (non zero)
            plp ;restore status
        sec
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(carry|fao)&m8 ;expected flags + always on bits
        TRAP0184 BNE TRAP0184 ;failed not equal (non zero)
            plp ;restore status
        clc
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0185 BNE TRAP0185 ;failed not equal (non zero)
            plp ;restore status
        sei
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(intdis|fao)&m8 ;expected flags + always on bits
        TRAP0186 BNE TRAP0186 ;failed not equal (non zero)
            plp ;restore status
        cli
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0187 BNE TRAP0187 ;failed not equal (non zero)
            plp ;restore status
        sed
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(decmode|fao)&m8 ;expected flags + always on bits
        TRAP0188 BNE TRAP0188 ;failed not equal (non zero)
            plp ;restore status
        cld
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0189 BNE TRAP0189 ;failed not equal (non zero)
            plp ;restore status
            lda #overfl ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(overfl|fao)&m8 ;expected flags + always on bits
        TRAP0190 BNE TRAP0190 ;failed not equal (non zero)
            plp ;restore status
        clv
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0191 BNE TRAP0191 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #12
        TRAP0192 BNE TRAP0192 ;failed not equal (non zero)
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
        TRAP0193 BNE TRAP0193 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0194 BNE TRAP0194 ;failed not equal (non zero)
            plp ;restore status
        inx ;00
            php ;save flags
            cpx #0 ;test result
        TRAP0195 BNE TRAP0195 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0196 BNE TRAP0196 ;failed not equal (non zero)
            plp ;restore status
        inx ;01
            php ;save flags
            cpx #1 ;test result
        TRAP0197 BNE TRAP0197 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0198 BNE TRAP0198 ;failed not equal (non zero)
            plp ;restore status
        dex ;00
            php ;save flags
            cpx #0 ;test result
        TRAP0199 BNE TRAP0199 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0200 BNE TRAP0200 ;failed not equal (non zero)
            plp ;restore status
        dex ;ff
            php ;save flags
            cpx #$ff ;test result
        TRAP0201 BNE TRAP0201 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0202 BNE TRAP0202 ;failed not equal (non zero)
            plp ;restore status
        dex ;fe
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        inx ;ff
            php ;save flags
            cpx #$ff ;test result
        TRAP0203 BNE TRAP0203 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0204 BNE TRAP0204 ;failed not equal (non zero)
            plp ;restore status
        inx ;00
            php ;save flags
            cpx #0 ;test result
        TRAP0205 BNE TRAP0205 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0206 BNE TRAP0206 ;failed not equal (non zero)
            plp ;restore status
        inx ;01
            php ;save flags
            cpx #1 ;test result
        TRAP0207 BNE TRAP0207 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0208 BNE TRAP0208 ;failed not equal (non zero)
            plp ;restore status
        dex ;00
            php ;save flags
            cpx #0 ;test result
        TRAP0209 BNE TRAP0209 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0210 BNE TRAP0210 ;failed not equal (non zero)
            plp ;restore status
        dex ;ff
            php ;save flags
            cpx #$ff ;test result
        TRAP0211 BNE TRAP0211 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0212 BNE TRAP0212 ;failed not equal (non zero)
            plp ;restore status

        ldy #$fe
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        iny ;ff
            php ;save flags
            cpy #$ff ;test result
        TRAP0213 BNE TRAP0213 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0214 BNE TRAP0214 ;failed not equal (non zero)
            plp ;restore status
        iny ;00
            php ;save flags
            cpy #0 ;test result
        TRAP0215 BNE TRAP0215 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0216 BNE TRAP0216 ;failed not equal (non zero)
            plp ;restore status
        iny ;01
            php ;save flags
            cpy #1 ;test result
        TRAP0217 BNE TRAP0217 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0218 BNE TRAP0218 ;failed not equal (non zero)
            plp ;restore status
        dey ;00
            php ;save flags
            cpy #0 ;test result
        TRAP0219 BNE TRAP0219 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0220 BNE TRAP0220 ;failed not equal (non zero)
            plp ;restore status
        dey ;ff
            php ;save flags
            cpy #$ff ;test result
        TRAP0221 BNE TRAP0221 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0222 BNE TRAP0222 ;failed not equal (non zero)
            plp ;restore status
        dey ;fe
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        iny ;ff
            php ;save flags
            cpy #$ff ;test result
        TRAP0223 BNE TRAP0223 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0+minus|fao)&m8 ;expected flags + always on bits
        TRAP0224 BNE TRAP0224 ;failed not equal (non zero)
            plp ;restore status
        iny ;00
            php ;save flags
            cpy #0 ;test result
        TRAP0225 BNE TRAP0225 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0226 BNE TRAP0226 ;failed not equal (non zero)
            plp ;restore status
        iny ;01
            php ;save flags
            cpy #1 ;test result
        TRAP0227 BNE TRAP0227 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0228 BNE TRAP0228 ;failed not equal (non zero)
            plp ;restore status
        dey ;00
            php ;save flags
            cpy #0 ;test result
        TRAP0229 BNE TRAP0229 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0230 BNE TRAP0230 ;failed not equal (non zero)
            plp ;restore status
        dey ;ff
            php ;save flags
            cpy #$ff ;test result
        TRAP0231 BNE TRAP0231 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0232 BNE TRAP0232 ;failed not equal (non zero)
            plp ;restore status

        ldx #$ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txa
            php ;save flags
            cmp #$ff ;test result
        TRAP0233 BNE TRAP0233 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0234 BNE TRAP0234 ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;00
        plp
        txa
            php ;save flags
            cmp #0 ;test result
        TRAP0235 BNE TRAP0235 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0236 BNE TRAP0236 ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;01
        plp
        txa
            php ;save flags
            cmp #1 ;test result
        TRAP0237 BNE TRAP0237 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0238 BNE TRAP0238 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txa
            php ;save flags
            cmp #1 ;test result
        TRAP0239 BNE TRAP0239 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0240 BNE TRAP0240 ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;00
        plp
        txa
            php ;save flags
            cmp #0 ;test result
        TRAP0241 BNE TRAP0241 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0242 BNE TRAP0242 ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;ff
        plp
        txa
            php ;save flags
            cmp #$ff ;test result
        TRAP0243 BNE TRAP0243 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0244 BNE TRAP0244 ;failed not equal (non zero)
            plp ;restore status

        ldy #$ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tya
            php ;save flags
            cmp #$ff ;test result
        TRAP0245 BNE TRAP0245 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0246 BNE TRAP0246 ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;00
        plp
        tya
            php ;save flags
            cmp #0 ;test result
        TRAP0247 BNE TRAP0247 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0248 BNE TRAP0248 ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;01
        plp
        tya
            php ;save flags
            cmp #1 ;test result
        TRAP0249 BNE TRAP0249 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0250 BNE TRAP0250 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tya
            php ;save flags
            cmp #1 ;test result
        TRAP0251 BNE TRAP0251 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0252 BNE TRAP0252 ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;00
        plp
        tya
            php ;save flags
            cmp #0 ;test result
        TRAP0253 BNE TRAP0253 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0254 BNE TRAP0254 ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;ff
        plp
        tya
            php ;save flags
            cmp #$ff ;test result
        TRAP0255 BNE TRAP0255 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0256 BNE TRAP0256 ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldx #$ff ;ff
        txa
        plp
        tay
            php ;save flags
            cpy #$ff ;test result
        TRAP0257 BNE TRAP0257 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0258 BNE TRAP0258 ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;00
        txa
        plp
        tay
            php ;save flags
            cpy #0 ;test result
        TRAP0259 BNE TRAP0259 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0260 BNE TRAP0260 ;failed not equal (non zero)
            plp ;restore status
        php
        inx ;01
        txa
        plp
        tay
            php ;save flags
            cpy #1 ;test result
        TRAP0261 BNE TRAP0261 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0262 BNE TRAP0262 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
        pha
        lda #0
        txa
        plp
        tay
            php ;save flags
            cpy #1 ;test result
        TRAP0263 BNE TRAP0263 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0264 BNE TRAP0264 ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;00
        txa
        plp
        tay
            php ;save flags
            cpy #0 ;test result
        TRAP0265 BNE TRAP0265 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0266 BNE TRAP0266 ;failed not equal (non zero)
            plp ;restore status
        php
        dex ;ff
        txa
        plp
        tay
            php ;save flags
            cpy #$ff ;test result
        TRAP0267 BNE TRAP0267 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0268 BNE TRAP0268 ;failed not equal (non zero)
            plp ;restore status


            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldy #$ff ;ff
        tya
        plp
        tax
            php ;save flags
            cpx #$ff ;test result
        TRAP0269 BNE TRAP0269 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0270 BNE TRAP0270 ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;00
        tya
        plp
        tax
            php ;save flags
            cpx #0 ;test result
        TRAP0271 BNE TRAP0271 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0272 BNE TRAP0272 ;failed not equal (non zero)
            plp ;restore status
        php
        iny ;01
        tya
        plp
        tax
            php ;save flags
            cpx #1 ;test result
        TRAP0273 BNE TRAP0273 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0274 BNE TRAP0274 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
        pha
        lda #0 ;preset status
        tya
        plp
        tax
            php ;save flags
            cpx #1 ;test result
        TRAP0275 BNE TRAP0275 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0276 BNE TRAP0276 ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;00
        tya
        plp
        tax
            php ;save flags
            cpx #0 ;test result
        TRAP0277 BNE TRAP0277 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0278 BNE TRAP0278 ;failed not equal (non zero)
            plp ;restore status
        php
        dey ;ff
        tya
        plp
        tax
            php ;save flags
            cpx #$ff ;test result
        TRAP0279 BNE TRAP0279 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0280 BNE TRAP0280 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #13
        TRAP0281 BNE TRAP0281 ;failed not equal (non zero)
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
        TRAP0282 BNE TRAP0282 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $101
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0283 BNE TRAP0283 ;failed not equal (non zero)
        dex ;00
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $100
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0284 BNE TRAP0284 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $100
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0285 BNE TRAP0285 ;failed not equal (non zero)
        dex ;ff
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        txs
        php
        lda $1ff
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP0286 BNE TRAP0286 ;failed not equal (non zero)
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
        TRAP0287 BNE TRAP0287 ;failed not equal (non zero)
        lda $101
            cmp #($ff-minus-zero|fao)&m8 ;expected flags + always on bits
        TRAP0288 BNE TRAP0288 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=ff
        cpx #0
        TRAP0289 BNE TRAP0289 ;failed not equal (non zero)
        lda $100
            cmp #($ff-minus|fao)&m8 ;expected flags + always on bits
        TRAP0290 BNE TRAP0290 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=fe
        cpx #$ff
        TRAP0291 BNE TRAP0291 ;failed not equal (non zero)
        lda $1ff
            cmp #($ff-zero|fao)&m8 ;expected flags + always on bits
        TRAP0292 BNE TRAP0292 ;failed not equal (non zero)

        ldx #1
        txs ;sp=01
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears Z, N
        php ;sp=00
        cpx #1
        TRAP0293 BNE TRAP0293 ;failed not equal (non zero)
        lda $101
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP0294 BNE TRAP0294 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=ff
        cpx #0
        TRAP0295 BNE TRAP0295 ;failed not equal (non zero)
        lda $100
            cmp #(zero|fao)&m8 ;expected flags + always on bits
        TRAP0296 BNE TRAP0296 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        tsx ;clears N, sets Z
        php ;sp=fe
        cpx #$ff
        TRAP0297 BNE TRAP0297 ;failed not equal (non zero)
        lda $1ff
            cmp #(minus|fao)&m8 ;expected flags + always on bits
        TRAP0298 BNE TRAP0298 ;failed not equal (non zero)
        pla ;sp=ff
            lda test_case ;previous test
            cmp #14
        TRAP0299 BNE TRAP0299 ;failed not equal (non zero)
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
        TRAP0300 BNE TRAP0300 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0301 BNE TRAP0301 ;failed not equal (non zero)
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
        TRAP0302 BNE TRAP0302 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0303 BNE TRAP0303 ;failed not equal (non zero)
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
        TRAP0304 BNE TRAP0304 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0305 BNE TRAP0305 ;failed not equal (non zero)
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
        TRAP0306 BNE TRAP0306 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0307 BNE TRAP0307 ;failed not equal (non zero)
        dey
        bpl tldx3

        ldy #3 ;testing store result
        ldx #0
tstx    lda zpt,y
        eor #$c3
        cmp zp1,y
        TRAP0308 BNE TRAP0308 ;failed not equal (non zero)
        stx zpt,y ;clear
        lda abst,y
        eor #$c3
        cmp abs1,y
        TRAP0309 BNE TRAP0309 ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstx
            lda test_case ;previous test
            cmp #15
        TRAP0310 BNE TRAP0310 ;failed not equal (non zero)
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
        TRAP0311 BNE TRAP0311 ;failed not equal (non zero)
        stx zpt,y ;clear
        lda abst,y
        cmp abs1,y
        TRAP0312 BNE TRAP0312 ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstx1
            lda test_case ;previous test
            cmp #16
        TRAP0313 BNE TRAP0313 ;failed not equal (non zero)
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
        TRAP0314 BNE TRAP0314 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0315 BNE TRAP0315 ;failed not equal (non zero)
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
        TRAP0316 BNE TRAP0316 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0317 BNE TRAP0317 ;failed not equal (non zero)
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
        TRAP0318 BNE TRAP0318 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0319 BNE TRAP0319 ;failed not equal (non zero)
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
        TRAP0320 BNE TRAP0320 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0321 BNE TRAP0321 ;failed not equal (non zero)
        dex
        bpl tldy3

        ldx #3 ;testing store result
        ldy #0
tsty    lda zpt,x
        eor #$c3
        cmp zp1,x
        TRAP0322 BNE TRAP0322 ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        eor #$c3
        cmp abs1,x
        TRAP0323 BNE TRAP0323 ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tsty
            lda test_case ;previous test
            cmp #17
        TRAP0324 BNE TRAP0324 ;failed not equal (non zero)
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
        TRAP0325 BNE TRAP0325 ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        cmp abs1,x
        TRAP0326 BNE TRAP0326 ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tsty1
            lda test_case ;previous test
            cmp #18
        TRAP0327 BNE TRAP0327 ;failed not equal (non zero)
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
        TRAP0328 BNE TRAP0328 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0329 BNE TRAP0329 ;failed not equal (non zero)
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
        TRAP0330 BNE TRAP0330 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0331 BNE TRAP0331 ;failed not equal (non zero)
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
        TRAP0332 BNE TRAP0332 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0333 BNE TRAP0333 ;failed not equal (non zero)
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
        TRAP0334 BNE TRAP0334 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0335 BNE TRAP0335 ;failed not equal (non zero)

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
        TRAP0336 BNE TRAP0336 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0337 BNE TRAP0337 ;failed not equal (non zero)
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
        TRAP0338 BNE TRAP0338 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0339 BNE TRAP0339 ;failed not equal (non zero)
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
        TRAP0340 BNE TRAP0340 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0341 BNE TRAP0341 ;failed not equal (non zero)
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
        TRAP0342 BNE TRAP0342 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0343 BNE TRAP0343 ;failed not equal (non zero)

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
        TRAP0344 BNE TRAP0344 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0345 BNE TRAP0345 ;failed not equal (non zero)
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
        TRAP0346 BNE TRAP0346 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0347 BNE TRAP0347 ;failed not equal (non zero)
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
        TRAP0348 BNE TRAP0348 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0349 BNE TRAP0349 ;failed not equal (non zero)
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
        TRAP0350 BNE TRAP0350 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0351 BNE TRAP0351 ;failed not equal (non zero)

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
        TRAP0352 BNE TRAP0352 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0353 BNE TRAP0353 ;failed not equal (non zero)
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
        TRAP0354 BNE TRAP0354 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0355 BNE TRAP0355 ;failed not equal (non zero)
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
        TRAP0356 BNE TRAP0356 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0357 BNE TRAP0357 ;failed not equal (non zero)
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
        TRAP0358 BNE TRAP0358 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0359 BNE TRAP0359 ;failed not equal (non zero)

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$c3
        php
        cpx abs1 ;test result
        TRAP0360 BNE TRAP0360 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0361 BNE TRAP0361 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$82
        php
        cpx abs1+1 ;test result
        TRAP0362 BNE TRAP0362 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0363 BNE TRAP0363 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$41
        php
        cpx abs1+2 ;test result
        TRAP0364 BNE TRAP0364 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0365 BNE TRAP0365 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #0
        php
        cpx abs1+3 ;test result
        TRAP0366 BNE TRAP0366 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0367 BNE TRAP0367 ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$c3
        php
        cpx abs1 ;test result
        TRAP0368 BNE TRAP0368 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0369 BNE TRAP0369 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$82
        php
        cpx abs1+1 ;test result
        TRAP0370 BNE TRAP0370 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0371 BNE TRAP0371 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #$41
        php
        cpx abs1+2 ;test result
        TRAP0372 BNE TRAP0372 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0373 BNE TRAP0373 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldx #0
        php
        cpx abs1+3 ;test result
        TRAP0374 BNE TRAP0374 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0375 BNE TRAP0375 ;failed not equal (non zero)

        ldx #0
        lda zpt
        eor #$c3
        cmp zp1
        TRAP0376 BNE TRAP0376 ;failed not equal (non zero)
        stx zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        TRAP0377 BNE TRAP0377 ;failed not equal (non zero)
        stx abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        TRAP0378 BNE TRAP0378 ;failed not equal (non zero)
        stx zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        TRAP0379 BNE TRAP0379 ;failed not equal (non zero)
        stx abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        TRAP0380 BNE TRAP0380 ;failed not equal (non zero)
        stx zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        TRAP0381 BNE TRAP0381 ;failed not equal (non zero)
        stx abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        TRAP0382 BNE TRAP0382 ;failed not equal (non zero)
        stx zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        TRAP0383 BNE TRAP0383 ;failed not equal (non zero)
        stx abst+3 ;clear
            lda test_case ;previous test
            cmp #19
        TRAP0384 BNE TRAP0384 ;failed not equal (non zero)
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
        TRAP0385 BNE TRAP0385 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0386 BNE TRAP0386 ;failed not equal (non zero)
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
        TRAP0387 BNE TRAP0387 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0388 BNE TRAP0388 ;failed not equal (non zero)
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
        TRAP0389 BNE TRAP0389 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0390 BNE TRAP0390 ;failed not equal (non zero)
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
        TRAP0391 BNE TRAP0391 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0392 BNE TRAP0392 ;failed not equal (non zero)

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
        TRAP0393 BNE TRAP0393 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0394 BNE TRAP0394 ;failed not equal (non zero)
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
        TRAP0395 BNE TRAP0395 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0396 BNE TRAP0396 ;failed not equal (non zero)
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
        TRAP0397 BNE TRAP0397 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0398 BNE TRAP0398 ;failed not equal (non zero)
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
        TRAP0399 BNE TRAP0399 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0400 BNE TRAP0400 ;failed not equal (non zero)

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
        TRAP0401 BNE TRAP0401 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0402 BNE TRAP0402 ;failed not equal (non zero)
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
        TRAP0403 BNE TRAP0403 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0404 BNE TRAP0404 ;failed not equal (non zero)
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
        TRAP0405 BNE TRAP0405 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0406 BNE TRAP0406 ;failed not equal (non zero)
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
        TRAP0407 BNE TRAP0407 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0408 BNE TRAP0408 ;failed not equal (non zero)

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
        TRAP0409 BNE TRAP0409 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0410 BNE TRAP0410 ;failed not equal (non zero)
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
        TRAP0411 BNE TRAP0411 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0412 BNE TRAP0412 ;failed not equal (non zero)
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
        TRAP0413 BNE TRAP0413 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0414 BNE TRAP0414 ;failed not equal (non zero)
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
        TRAP0415 BNE TRAP0415 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0416 BNE TRAP0416 ;failed not equal (non zero)


            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$c3
        php
        cpy abs1 ;test result
        TRAP0417 BNE TRAP0417 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0418 BNE TRAP0418 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$82
        php
        cpy abs1+1 ;test result
        TRAP0419 BNE TRAP0419 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0420 BNE TRAP0420 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$41
        php
        cpy abs1+2 ;test result
        TRAP0421 BNE TRAP0421 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0422 BNE TRAP0422 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #0
        php
        cpy abs1+3 ;test result
        TRAP0423 BNE TRAP0423 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0424 BNE TRAP0424 ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$c3
        php
        cpy abs1 ;test result
        TRAP0425 BNE TRAP0425 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0426 BNE TRAP0426 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$82
        php
        cpy abs1+1 ;test result
        TRAP0427 BNE TRAP0427 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0428 BNE TRAP0428 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #$41
        php
        cpy abs1+2 ;test result
        TRAP0429 BNE TRAP0429 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0430 BNE TRAP0430 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        ldy #0
        php
        cpy abs1+3 ;test result
        TRAP0431 BNE TRAP0431 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0432 BNE TRAP0432 ;failed not equal (non zero)

        ldy #0
        lda zpt
        eor #$c3
        cmp zp1
        TRAP0433 BNE TRAP0433 ;failed not equal (non zero)
        sty zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        TRAP0434 BNE TRAP0434 ;failed not equal (non zero)
        sty abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        TRAP0435 BNE TRAP0435 ;failed not equal (non zero)
        sty zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        TRAP0436 BNE TRAP0436 ;failed not equal (non zero)
        sty abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        TRAP0437 BNE TRAP0437 ;failed not equal (non zero)
        sty zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        TRAP0438 BNE TRAP0438 ;failed not equal (non zero)
        sty abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        TRAP0439 BNE TRAP0439 ;failed not equal (non zero)
        sty zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        TRAP0440 BNE TRAP0440 ;failed not equal (non zero)
        sty abst+3 ;clear
            lda test_case ;previous test
            cmp #20
        TRAP0441 BNE TRAP0441 ;failed not equal (non zero)
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
        TRAP0442 BNE TRAP0442 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0443 BNE TRAP0443 ;failed not equal (non zero)
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
        TRAP0444 BNE TRAP0444 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0445 BNE TRAP0445 ;failed not equal (non zero)
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
        TRAP0446 BNE TRAP0446 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0447 BNE TRAP0447 ;failed not equal (non zero)
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
        TRAP0448 BNE TRAP0448 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,x ;test flags
        TRAP0449 BNE TRAP0449 ;failed not equal (non zero)
        dex
        bpl tldax3

        ldx #3 ;testing store result
        ldy #0
tstax   lda zpt,x
        eor #$c3
        cmp zp1,x
        TRAP0450 BNE TRAP0450 ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        eor #$c3
        cmp abs1,x
        TRAP0451 BNE TRAP0451 ;failed not equal (non zero)
        txa
        sta abst,x ;clear
        dex
        bpl tstax
            lda test_case ;previous test
            cmp #21
        TRAP0452 BNE TRAP0452 ;failed not equal (non zero)
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
        TRAP0453 BNE TRAP0453 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0454 BNE TRAP0454 ;failed not equal (non zero)
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
        TRAP0455 BNE TRAP0455 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0456 BNE TRAP0456 ;failed not equal (non zero)
        dey
        bpl tlday1

        ldy #3 ;testing store result
        ldx #0
tstay   lda abst,y
        eor #$c3
        cmp abs1,y
        TRAP0457 BNE TRAP0457 ;failed not equal (non zero)
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
        TRAP0458 BNE TRAP0458 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0459 BNE TRAP0459 ;failed not equal (non zero)
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
        TRAP0460 BNE TRAP0460 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0461 BNE TRAP0461 ;failed not equal (non zero)
        dey
        bpl tlday3

        ldy #3 ;testing store result
        ldx #0
tstay1  lda abst,y
        eor #$c3
        cmp abs1,y
        TRAP0462 BNE TRAP0462 ;failed not equal (non zero)
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
        TRAP0463 BNE TRAP0463 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0464 BNE TRAP0464 ;failed not equal (non zero)
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
        TRAP0465 BNE TRAP0465 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx,y ;test flags
        TRAP0466 BNE TRAP0466 ;failed not equal (non zero)
        dex
        dex
        dey
        bpl tldax5

        ldy #3 ;testing store result
        ldx #0
tstay2  lda abst,y
        eor #$c3
        cmp abs1,y
        TRAP0467 BNE TRAP0467 ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay2
            lda test_case ;previous test
            cmp #22
        TRAP0468 BNE TRAP0468 ;failed not equal (non zero)
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
        TRAP0469 BNE TRAP0469 ;failed not equal (non zero)
        sty zpt,x ;clear
        lda abst,x
        cmp abs1,x
        TRAP0470 BNE TRAP0470 ;failed not equal (non zero)
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
        TRAP0471 BNE TRAP0471 ;failed not equal (non zero)
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
        TRAP0472 BNE TRAP0472 ;failed not equal (non zero)
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
        TRAP0473 BNE TRAP0473 ;failed not equal (non zero)
        txa
        sta abst,y ;clear
        dey
        bpl tstay6
            lda test_case ;previous test
            cmp #23
        TRAP0474 BNE TRAP0474 ;failed not equal (non zero)
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
        TRAP0475 BNE TRAP0475 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0476 BNE TRAP0476 ;failed not equal (non zero)
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
        TRAP0477 BNE TRAP0477 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0478 BNE TRAP0478 ;failed not equal (non zero)
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
        TRAP0479 BNE TRAP0479 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0480 BNE TRAP0480 ;failed not equal (non zero)
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
        TRAP0481 BNE TRAP0481 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0482 BNE TRAP0482 ;failed not equal (non zero)
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
        TRAP0483 BNE TRAP0483 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0484 BNE TRAP0484 ;failed not equal (non zero)
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
        TRAP0485 BNE TRAP0485 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0486 BNE TRAP0486 ;failed not equal (non zero)
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
        TRAP0487 BNE TRAP0487 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0488 BNE TRAP0488 ;failed not equal (non zero)
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
        TRAP0489 BNE TRAP0489 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0490 BNE TRAP0490 ;failed not equal (non zero)
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
        TRAP0491 BNE TRAP0491 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0492 BNE TRAP0492 ;failed not equal (non zero)
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
        TRAP0493 BNE TRAP0493 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0494 BNE TRAP0494 ;failed not equal (non zero)
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
        TRAP0495 BNE TRAP0495 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0496 BNE TRAP0496 ;failed not equal (non zero)
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
        TRAP0497 BNE TRAP0497 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0498 BNE TRAP0498 ;failed not equal (non zero)
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
        TRAP0499 BNE TRAP0499 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0500 BNE TRAP0500 ;failed not equal (non zero)
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
        TRAP0501 BNE TRAP0501 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0502 BNE TRAP0502 ;failed not equal (non zero)
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
        TRAP0503 BNE TRAP0503 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0504 BNE TRAP0504 ;failed not equal (non zero)
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
        TRAP0505 BNE TRAP0505 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0506 BNE TRAP0506 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$c3
        php
        cmp abs1 ;test result
        TRAP0507 BNE TRAP0507 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0508 BNE TRAP0508 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$82
        php
        cmp abs1+1 ;test result
        TRAP0509 BNE TRAP0509 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0510 BNE TRAP0510 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$41
        php
        cmp abs1+2 ;test result
        TRAP0511 BNE TRAP0511 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0512 BNE TRAP0512 ;failed not equal (non zero)
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #0
        php
        cmp abs1+3 ;test result
        TRAP0513 BNE TRAP0513 ;failed not equal (non zero)
        pla ;load status
            eor #0|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0514 BNE TRAP0514 ;failed not equal (non zero)

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$c3
        php
        cmp abs1 ;test result
        TRAP0515 BNE TRAP0515 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx ;test flags
        TRAP0516 BNE TRAP0516 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$82
        php
        cmp abs1+1 ;test result
        TRAP0517 BNE TRAP0517 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+1 ;test flags
        TRAP0518 BNE TRAP0518 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #$41
        php
        cmp abs1+2 ;test result
        TRAP0519 BNE TRAP0519 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+2 ;test flags
        TRAP0520 BNE TRAP0520 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        lda #0
        php
        cmp abs1+3 ;test result
        TRAP0521 BNE TRAP0521 ;failed not equal (non zero)
        pla ;load status
            eor #<~fnz|fao ;invert expected flags + always on bits
        cmp fLDx+3 ;test flags
        TRAP0522 BNE TRAP0522 ;failed not equal (non zero)

        ldx #0
        lda zpt
        eor #$c3
        cmp zp1
        TRAP0523 BNE TRAP0523 ;failed not equal (non zero)
        stx zpt ;clear
        lda abst
        eor #$c3
        cmp abs1
        TRAP0524 BNE TRAP0524 ;failed not equal (non zero)
        stx abst ;clear
        lda zpt+1
        eor #$c3
        cmp zp1+1
        TRAP0525 BNE TRAP0525 ;failed not equal (non zero)
        stx zpt+1 ;clear
        lda abst+1
        eor #$c3
        cmp abs1+1
        TRAP0526 BNE TRAP0526 ;failed not equal (non zero)
        stx abst+1 ;clear
        lda zpt+2
        eor #$c3
        cmp zp1+2
        TRAP0527 BNE TRAP0527 ;failed not equal (non zero)
        stx zpt+2 ;clear
        lda abst+2
        eor #$c3
        cmp abs1+2
        TRAP0528 BNE TRAP0528 ;failed not equal (non zero)
        stx abst+2 ;clear
        lda zpt+3
        eor #$c3
        cmp zp1+3
        TRAP0529 BNE TRAP0529 ;failed not equal (non zero)
        stx zpt+3 ;clear
        lda abst+3
        eor #$c3
        cmp abs1+3
        TRAP0530 BNE TRAP0530 ;failed not equal (non zero)
        stx abst+3 ;clear
            lda test_case ;previous test
            cmp #24
        TRAP0531 BNE TRAP0531 ;failed not equal (non zero)
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
        TRAP0532 BNE TRAP0532 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        TRAP0533 BNE TRAP0533 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        TRAP0534 BNE TRAP0534 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fv|fao)&m8 ;expected flags + always on bits
        TRAP0535 BNE TRAP0535 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        TRAP0536 BNE TRAP0536 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnz|fao)&m8 ;expected flags + always on bits
        TRAP0537 BNE TRAP0537 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        TRAP0538 BNE TRAP0538 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnv|fao)&m8 ;expected flags + always on bits
        TRAP0539 BNE TRAP0539 ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit zp1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        TRAP0540 BNE TRAP0540 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnv|fao)&m8 ;expected flags + always on bits
        TRAP0541 BNE TRAP0541 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        TRAP0542 BNE TRAP0542 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0543 BNE TRAP0543 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        TRAP0544 BNE TRAP0544 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fv|fao)&m8 ;expected flags + always on bits
        TRAP0545 BNE TRAP0545 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit zp1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        TRAP0546 BNE TRAP0546 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fz|fao)&m8 ;expected flags + always on bits
        TRAP0547 BNE TRAP0547 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit abs1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        TRAP0548 BNE TRAP0548 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fz|fao)&m8 ;expected flags + always on bits
        TRAP0549 BNE TRAP0549 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        TRAP0550 BNE TRAP0550 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fv|fao)&m8 ;expected flags + always on bits
        TRAP0551 BNE TRAP0551 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        TRAP0552 BNE TRAP0552 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnz|fao)&m8 ;expected flags + always on bits
        TRAP0553 BNE TRAP0553 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        TRAP0554 BNE TRAP0554 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fnv|fao)&m8 ;expected flags + always on bits
        TRAP0555 BNE TRAP0555 ;failed not equal (non zero)
            plp ;restore status

            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$ff ;precharge accu
            plp
        bit abs1+3 ;00 - should set Z / clear  NV
            php ;save flags
            cmp #$ff ;test result
        TRAP0556 BNE TRAP0556 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnv|fao)&m8 ;expected flags + always on bits
        TRAP0557 BNE TRAP0557 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+2 ;41 - should set V (M6) / clear NZ
            php ;save flags
            cmp #1 ;test result
        TRAP0558 BNE TRAP0558 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0559 BNE TRAP0559 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1+1 ;82 - should set N (M7) & Z / clear V
            php ;save flags
            cmp #1 ;test result
        TRAP0560 BNE TRAP0560 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fv|fao)&m8 ;expected flags + always on bits
        TRAP0561 BNE TRAP0561 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #1 ;precharge accu
            plp
        bit abs1 ;c3 - should set N (M7) & V (M6) / clear Z
            php ;save flags
            cmp #1 ;test result
        TRAP0562 BNE TRAP0562 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fz|fao)&m8 ;expected flags + always on bits
        TRAP0563 BNE TRAP0563 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #25
        TRAP0564 BNE TRAP0564 ;failed not equal (non zero)
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
        TRAP0565 BNE TRAP0565 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0566 BNE TRAP0566 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0567 BNE TRAP0567 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0568 BNE TRAP0568 ;failed not equal (non zero)
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
        TRAP0569 BNE TRAP0569 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0570 BNE TRAP0570 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx zp7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0571 BNE TRAP0571 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0572 BNE TRAP0572 ;failed not equal (non zero)
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
        TRAP0573 BNE TRAP0573 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0574 BNE TRAP0574 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0575 BNE TRAP0575 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0576 BNE TRAP0576 ;failed not equal (non zero)
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
        TRAP0577 BNE TRAP0577 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0578 BNE TRAP0578 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx abs7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0579 BNE TRAP0579 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0580 BNE TRAP0580 ;failed not equal (non zero)
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
        TRAP0581 BNE TRAP0581 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0582 BNE TRAP0582 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0583 BNE TRAP0583 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0584 BNE TRAP0584 ;failed not equal (non zero)
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
        TRAP0585 BNE TRAP0585 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0586 BNE TRAP0586 ;failed not equal (non zero)
            plp ;restore status
        dex
        cpx #$7f
            php ;save flags
            cpx #$7e ;test result
        TRAP0587 BNE TRAP0587 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0588 BNE TRAP0588 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #26
        TRAP0589 BNE TRAP0589 ;failed not equal (non zero)
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
        TRAP0590 BNE TRAP0590 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0591 BNE TRAP0591 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0592 BNE TRAP0592 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0593 BNE TRAP0593 ;failed not equal (non zero)
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
        TRAP0594 BNE TRAP0594 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0595 BNE TRAP0595 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy zp7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0596 BNE TRAP0596 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0597 BNE TRAP0597 ;failed not equal (non zero)
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
        TRAP0598 BNE TRAP0598 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0599 BNE TRAP0599 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0600 BNE TRAP0600 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0601 BNE TRAP0601 ;failed not equal (non zero)
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
        TRAP0602 BNE TRAP0602 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0603 BNE TRAP0603 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy abs7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0604 BNE TRAP0604 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0605 BNE TRAP0605 ;failed not equal (non zero)
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
        TRAP0606 BNE TRAP0606 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0607 BNE TRAP0607 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0608 BNE TRAP0608 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0609 BNE TRAP0609 ;failed not equal (non zero)
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
        TRAP0610 BNE TRAP0610 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save status
            pla ;use stack to retrieve status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0611 BNE TRAP0611 ;failed not equal (non zero)
            plp ;restore status
        dey
        cpy #$7f
            php ;save flags
            cpy #$7e ;test result
        TRAP0612 BNE TRAP0612 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0613 BNE TRAP0613 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #27
        TRAP0614 BNE TRAP0614 ;failed not equal (non zero)
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
        TRAP0615 BNE TRAP0615 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0616 BNE TRAP0616 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0617 BNE TRAP0617 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0618 BNE TRAP0618 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0619 BNE TRAP0619 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0620 BNE TRAP0620 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$80 ;test result
        TRAP0621 BNE TRAP0621 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0622 BNE TRAP0622 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0623 BNE TRAP0623 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0624 BNE TRAP0624 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0625 BNE TRAP0625 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0626 BNE TRAP0626 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$80 ;test result
        TRAP0627 BNE TRAP0627 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0628 BNE TRAP0628 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0629 BNE TRAP0629 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0630 BNE TRAP0630 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0631 BNE TRAP0631 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0632 BNE TRAP0632 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$80 ;test result
        TRAP0633 BNE TRAP0633 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0634 BNE TRAP0634 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0635 BNE TRAP0635 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0636 BNE TRAP0636 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0637 BNE TRAP0637 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0638 BNE TRAP0638 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$80 ;test result
        TRAP0639 BNE TRAP0639 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0640 BNE TRAP0640 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0641 BNE TRAP0641 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0642 BNE TRAP0642 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0643 BNE TRAP0643 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0644 BNE TRAP0644 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$80 ;test result
        TRAP0645 BNE TRAP0645 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0646 BNE TRAP0646 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7f ;test result
        TRAP0647 BNE TRAP0647 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0648 BNE TRAP0648 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp #$7f
            php ;save flags
            cmp #$7e ;test result
        TRAP0649 BNE TRAP0649 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0650 BNE TRAP0650 ;failed not equal (non zero)
            plp ;restore status

        ldx #4 ;with indexing by X
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$80 ;test result
        TRAP0651 BNE TRAP0651 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0652 BNE TRAP0652 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7f ;test result
        TRAP0653 BNE TRAP0653 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0654 BNE TRAP0654 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7e ;test result
        TRAP0655 BNE TRAP0655 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0656 BNE TRAP0656 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$80 ;test result
        TRAP0657 BNE TRAP0657 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0658 BNE TRAP0658 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7f ;test result
        TRAP0659 BNE TRAP0659 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0660 BNE TRAP0660 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp zp1,x
            php ;save flags
            cmp #$7e ;test result
        TRAP0661 BNE TRAP0661 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0662 BNE TRAP0662 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$80 ;test result
        TRAP0663 BNE TRAP0663 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0664 BNE TRAP0664 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7f ;test result
        TRAP0665 BNE TRAP0665 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0666 BNE TRAP0666 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7e ;test result
        TRAP0667 BNE TRAP0667 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0668 BNE TRAP0668 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$80 ;test result
        TRAP0669 BNE TRAP0669 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0670 BNE TRAP0670 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7f ;test result
        TRAP0671 BNE TRAP0671 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0672 BNE TRAP0672 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,x
            php ;save flags
            cmp #$7e ;test result
        TRAP0673 BNE TRAP0673 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0674 BNE TRAP0674 ;failed not equal (non zero)
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
        TRAP0675 BNE TRAP0675 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0676 BNE TRAP0676 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7f ;test result
        TRAP0677 BNE TRAP0677 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0678 BNE TRAP0678 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7e ;test result
        TRAP0679 BNE TRAP0679 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0680 BNE TRAP0680 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$80 ;test result
        TRAP0681 BNE TRAP0681 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0682 BNE TRAP0682 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7f ;test result
        TRAP0683 BNE TRAP0683 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0684 BNE TRAP0684 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp abs1,y
            php ;save flags
            cmp #$7e ;test result
        TRAP0685 BNE TRAP0685 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0686 BNE TRAP0686 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$80 ;test result
        TRAP0687 BNE TRAP0687 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0688 BNE TRAP0688 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7f ;test result
        TRAP0689 BNE TRAP0689 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0690 BNE TRAP0690 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7e ;test result
        TRAP0691 BNE TRAP0691 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0692 BNE TRAP0692 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$80 ;test result
        TRAP0693 BNE TRAP0693 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0694 BNE TRAP0694 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7f ;test result
        TRAP0695 BNE TRAP0695 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0696 BNE TRAP0696 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1,x)
            php ;save flags
            cmp #$7e ;test result
        TRAP0697 BNE TRAP0697 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0698 BNE TRAP0698 ;failed not equal (non zero)
            plp ;restore status

            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$80 ;test result
        TRAP0699 BNE TRAP0699 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fc|fao)&m8 ;expected flags + always on bits
        TRAP0700 BNE TRAP0700 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7f ;test result
        TRAP0701 BNE TRAP0701 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fzc|fao)&m8 ;expected flags + always on bits
        TRAP0702 BNE TRAP0702 ;failed not equal (non zero)
            plp ;restore status
            lda #0 ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7e ;test result
        TRAP0703 BNE TRAP0703 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(fn|fao)&m8 ;expected flags + always on bits
        TRAP0704 BNE TRAP0704 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$80 ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$80 ;test result
        TRAP0705 BNE TRAP0705 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fnz|fao)&m8 ;expected flags + always on bits
        TRAP0706 BNE TRAP0706 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7f ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7f ;test result
        TRAP0707 BNE TRAP0707 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fn|fao)&m8 ;expected flags + always on bits
        TRAP0708 BNE TRAP0708 ;failed not equal (non zero)
            plp ;restore status
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            lda #$7e ;precharge accu
            plp
        cmp (ind1),y
            php ;save flags
            cmp #$7e ;test result
        TRAP0709 BNE TRAP0709 ;failed not equal (non zero)
            pla ;load status
            pha
            cmp #(~fzc|fao)&m8 ;expected flags + always on bits
        TRAP0710 BNE TRAP0710 ;failed not equal (non zero)
            plp ;restore status
            lda test_case ;previous test
            cmp #28
        TRAP0711 BNE TRAP0711 ;failed not equal (non zero)
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
        TRAP0712 BNE TRAP0712 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0713 BNE TRAP0713 ;failed not equal (non zero)
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
        TRAP0714 BNE TRAP0714 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0715 BNE TRAP0715 ;failed not equal (non zero)
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
        TRAP0716 BNE TRAP0716 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0717 BNE TRAP0717 ;failed not equal (non zero)
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
        TRAP0718 BNE TRAP0718 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0719 BNE TRAP0719 ;failed not equal (non zero)
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
        TRAP0720 BNE TRAP0720 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0721 BNE TRAP0721 ;failed not equal (non zero)
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
        TRAP0722 BNE TRAP0722 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0723 BNE TRAP0723 ;failed not equal (non zero)
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
        TRAP0724 BNE TRAP0724 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0725 BNE TRAP0725 ;failed not equal (non zero)
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
        TRAP0726 BNE TRAP0726 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0727 BNE TRAP0727 ;failed not equal (non zero)
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
        TRAP0728 BNE TRAP0728 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0729 BNE TRAP0729 ;failed not equal (non zero)
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
        TRAP0730 BNE TRAP0730 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0731 BNE TRAP0731 ;failed not equal (non zero)
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
        TRAP0732 BNE TRAP0732 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0733 BNE TRAP0733 ;failed not equal (non zero)
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
        TRAP0734 BNE TRAP0734 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0735 BNE TRAP0735 ;failed not equal (non zero)
        dex
        bpl trorc1
            lda test_case ;previous test
            cmp #29
        TRAP0736 BNE TRAP0736 ;failed not equal (non zero)
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
        TRAP0737 BNE TRAP0737 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0738 BNE TRAP0738 ;failed not equal (non zero)
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
        TRAP0739 BNE TRAP0739 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0740 BNE TRAP0740 ;failed not equal (non zero)
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
        TRAP0741 BNE TRAP0741 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0742 BNE TRAP0742 ;failed not equal (non zero)
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
        TRAP0743 BNE TRAP0743 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0744 BNE TRAP0744 ;failed not equal (non zero)
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
        TRAP0745 BNE TRAP0745 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0746 BNE TRAP0746 ;failed not equal (non zero)
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
        TRAP0747 BNE TRAP0747 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0748 BNE TRAP0748 ;failed not equal (non zero)
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
        TRAP0749 BNE TRAP0749 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0750 BNE TRAP0750 ;failed not equal (non zero)
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
        TRAP0751 BNE TRAP0751 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0752 BNE TRAP0752 ;failed not equal (non zero)
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
        TRAP0753 BNE TRAP0753 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0754 BNE TRAP0754 ;failed not equal (non zero)
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
        TRAP0755 BNE TRAP0755 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0756 BNE TRAP0756 ;failed not equal (non zero)
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
        TRAP0757 BNE TRAP0757 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0758 BNE TRAP0758 ;failed not equal (non zero)
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
        TRAP0759 BNE TRAP0759 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0760 BNE TRAP0760 ;failed not equal (non zero)
        dex
        bpl trorc3
            lda test_case ;previous test
            cmp #30
        TRAP0761 BNE TRAP0761 ;failed not equal (non zero)
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
        TRAP0762 BNE TRAP0762 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0763 BNE TRAP0763 ;failed not equal (non zero)
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
        TRAP0764 BNE TRAP0764 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0765 BNE TRAP0765 ;failed not equal (non zero)
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
        TRAP0766 BNE TRAP0766 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0767 BNE TRAP0767 ;failed not equal (non zero)
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
        TRAP0768 BNE TRAP0768 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0769 BNE TRAP0769 ;failed not equal (non zero)
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
        TRAP0770 BNE TRAP0770 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0771 BNE TRAP0771 ;failed not equal (non zero)
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
        TRAP0772 BNE TRAP0772 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0773 BNE TRAP0773 ;failed not equal (non zero)
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
        TRAP0774 BNE TRAP0774 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0775 BNE TRAP0775 ;failed not equal (non zero)
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
        TRAP0776 BNE TRAP0776 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0777 BNE TRAP0777 ;failed not equal (non zero)
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
        TRAP0778 BNE TRAP0778 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0779 BNE TRAP0779 ;failed not equal (non zero)
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
        TRAP0780 BNE TRAP0780 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0781 BNE TRAP0781 ;failed not equal (non zero)
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
        TRAP0782 BNE TRAP0782 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0783 BNE TRAP0783 ;failed not equal (non zero)
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
        TRAP0784 BNE TRAP0784 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0785 BNE TRAP0785 ;failed not equal (non zero)
        dex
        bpl trorc5
            lda test_case ;previous test
            cmp #31
        TRAP0786 BNE TRAP0786 ;failed not equal (non zero)
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
        TRAP0787 BNE TRAP0787 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0788 BNE TRAP0788 ;failed not equal (non zero)
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
        TRAP0789 BNE TRAP0789 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0790 BNE TRAP0790 ;failed not equal (non zero)
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
        TRAP0791 BNE TRAP0791 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0792 BNE TRAP0792 ;failed not equal (non zero)
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
        TRAP0793 BNE TRAP0793 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0794 BNE TRAP0794 ;failed not equal (non zero)
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
        TRAP0795 BNE TRAP0795 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0796 BNE TRAP0796 ;failed not equal (non zero)
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
        TRAP0797 BNE TRAP0797 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0798 BNE TRAP0798 ;failed not equal (non zero)
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
        TRAP0799 BNE TRAP0799 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0800 BNE TRAP0800 ;failed not equal (non zero)
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
        TRAP0801 BNE TRAP0801 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0802 BNE TRAP0802 ;failed not equal (non zero)
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
        TRAP0803 BNE TRAP0803 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0804 BNE TRAP0804 ;failed not equal (non zero)
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
        TRAP0805 BNE TRAP0805 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0806 BNE TRAP0806 ;failed not equal (non zero)
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
        TRAP0807 BNE TRAP0807 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0808 BNE TRAP0808 ;failed not equal (non zero)
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
        TRAP0809 BNE TRAP0809 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0810 BNE TRAP0810 ;failed not equal (non zero)
        dex
        bpl trorc7
            lda test_case ;previous test
            cmp #32
        TRAP0811 BNE TRAP0811 ;failed not equal (non zero)
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
        TRAP0812 BNE TRAP0812 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0813 BNE TRAP0813 ;failed not equal (non zero)
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
        TRAP0814 BNE TRAP0814 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fASL,x ;test flags
        TRAP0815 BNE TRAP0815 ;failed not equal (non zero)
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
        TRAP0816 BNE TRAP0816 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0817 BNE TRAP0817 ;failed not equal (non zero)
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
        TRAP0818 BNE TRAP0818 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fLSR,x ;test flags
        TRAP0819 BNE TRAP0819 ;failed not equal (non zero)
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
        TRAP0820 BNE TRAP0820 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0821 BNE TRAP0821 ;failed not equal (non zero)
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
        TRAP0822 BNE TRAP0822 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROL,x ;test flags
        TRAP0823 BNE TRAP0823 ;failed not equal (non zero)
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
        TRAP0824 BNE TRAP0824 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0825 BNE TRAP0825 ;failed not equal (non zero)
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
        TRAP0826 BNE TRAP0826 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROLc,x ;test flags
        TRAP0827 BNE TRAP0827 ;failed not equal (non zero)
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
        TRAP0828 BNE TRAP0828 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0829 BNE TRAP0829 ;failed not equal (non zero)
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
        TRAP0830 BNE TRAP0830 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fROR,x ;test flags
        TRAP0831 BNE TRAP0831 ;failed not equal (non zero)
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
        TRAP0832 BNE TRAP0832 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0833 BNE TRAP0833 ;failed not equal (non zero)
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
        TRAP0834 BNE TRAP0834 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnzc|fao ;invert expected flags + always on bits
            cmp fRORc,x ;test flags
        TRAP0835 BNE TRAP0835 ;failed not equal (non zero)
        dex
        bpl trorc9
            lda test_case ;previous test
            cmp #33
        TRAP0836 BNE TRAP0836 ;failed not equal (non zero)
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
        TRAP0837 BNE TRAP0837 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0838 BNE TRAP0838 ;failed not equal (non zero)
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
        TRAP0839 BNE TRAP0839 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0840 BNE TRAP0840 ;failed not equal (non zero)
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
        TRAP0841 BNE TRAP0841 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0842 BNE TRAP0842 ;failed not equal (non zero)
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
        TRAP0843 BNE TRAP0843 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0844 BNE TRAP0844 ;failed not equal (non zero)
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
        TRAP0845 BNE TRAP0845 ;failed not equal (non zero)
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
        TRAP0846 BNE TRAP0846 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0847 BNE TRAP0847 ;failed not equal (non zero)
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
        TRAP0848 BNE TRAP0848 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0849 BNE TRAP0849 ;failed not equal (non zero)
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
        TRAP0850 BNE TRAP0850 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0851 BNE TRAP0851 ;failed not equal (non zero)
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
        TRAP0852 BNE TRAP0852 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0853 BNE TRAP0853 ;failed not equal (non zero)
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
        TRAP0854 BNE TRAP0854 ;failed not equal (non zero)
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
        TRAP0855 BNE TRAP0855 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0856 BNE TRAP0856 ;failed not equal (non zero)
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
        TRAP0857 BNE TRAP0857 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0858 BNE TRAP0858 ;failed not equal (non zero)
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
        TRAP0859 BNE TRAP0859 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0860 BNE TRAP0860 ;failed not equal (non zero)
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
        TRAP0861 BNE TRAP0861 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0862 BNE TRAP0862 ;failed not equal (non zero)
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
        TRAP0863 BNE TRAP0863 ;failed not equal (non zero)
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
        TRAP0864 BNE TRAP0864 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0865 BNE TRAP0865 ;failed not equal (non zero)
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
        TRAP0866 BNE TRAP0866 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0867 BNE TRAP0867 ;failed not equal (non zero)
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
        TRAP0868 BNE TRAP0868 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0869 BNE TRAP0869 ;failed not equal (non zero)
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
        TRAP0870 BNE TRAP0870 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp fINC,x ;test flags
        TRAP0871 BNE TRAP0871 ;failed not equal (non zero)
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
        TRAP0872 BNE TRAP0872 ;failed not equal (non zero)
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
        TRAP0873 BNE TRAP0873 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0874 BNE TRAP0874 ;failed not equal (non zero)
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
        TRAP0875 BNE TRAP0875 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0876 BNE TRAP0876 ;failed not equal (non zero)
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
        TRAP0877 BNE TRAP0877 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0878 BNE TRAP0878 ;failed not equal (non zero)
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
        TRAP0879 BNE TRAP0879 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0880 BNE TRAP0880 ;failed not equal (non zero)
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
        TRAP0881 BNE TRAP0881 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0882 BNE TRAP0882 ;failed not equal (non zero)
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
        TRAP0883 BNE TRAP0883 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0884 BNE TRAP0884 ;failed not equal (non zero)
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
        TRAP0885 BNE TRAP0885 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0886 BNE TRAP0886 ;failed not equal (non zero)
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
        TRAP0887 BNE TRAP0887 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0888 BNE TRAP0888 ;failed not equal (non zero)
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
        TRAP0889 BNE TRAP0889 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0890 BNE TRAP0890 ;failed not equal (non zero)
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
        TRAP0891 BNE TRAP0891 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0892 BNE TRAP0892 ;failed not equal (non zero)
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
        TRAP0893 BNE TRAP0893 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0894 BNE TRAP0894 ;failed not equal (non zero)
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
        TRAP0895 BNE TRAP0895 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0896 BNE TRAP0896 ;failed not equal (non zero)
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
        TRAP0897 BNE TRAP0897 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0898 BNE TRAP0898 ;failed not equal (non zero)
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
        TRAP0899 BNE TRAP0899 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0900 BNE TRAP0900 ;failed not equal (non zero)
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
        TRAP0901 BNE TRAP0901 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0902 BNE TRAP0902 ;failed not equal (non zero)
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
        TRAP0903 BNE TRAP0903 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0904 BNE TRAP0904 ;failed not equal (non zero)
        dey
        bpl tand15
            lda test_case ;previous test
            cmp #38
        TRAP0905 BNE TRAP0905 ;failed not equal (non zero)
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
        TRAP0906 BNE TRAP0906 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0907 BNE TRAP0907 ;failed not equal (non zero)
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
        TRAP0908 BNE TRAP0908 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0909 BNE TRAP0909 ;failed not equal (non zero)
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
        TRAP0910 BNE TRAP0910 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0911 BNE TRAP0911 ;failed not equal (non zero)
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
        TRAP0912 BNE TRAP0912 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0913 BNE TRAP0913 ;failed not equal (non zero)
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
        TRAP0914 BNE TRAP0914 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0915 BNE TRAP0915 ;failed not equal (non zero)
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
        TRAP0916 BNE TRAP0916 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0917 BNE TRAP0917 ;failed not equal (non zero)
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
        TRAP0918 BNE TRAP0918 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0919 BNE TRAP0919 ;failed not equal (non zero)
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
        TRAP0920 BNE TRAP0920 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0921 BNE TRAP0921 ;failed not equal (non zero)
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
        TRAP0922 BNE TRAP0922 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0923 BNE TRAP0923 ;failed not equal (non zero)
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
        TRAP0924 BNE TRAP0924 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0925 BNE TRAP0925 ;failed not equal (non zero)
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
        TRAP0926 BNE TRAP0926 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0927 BNE TRAP0927 ;failed not equal (non zero)
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
        TRAP0928 BNE TRAP0928 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0929 BNE TRAP0929 ;failed not equal (non zero)
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
        TRAP0930 BNE TRAP0930 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0931 BNE TRAP0931 ;failed not equal (non zero)
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
        TRAP0932 BNE TRAP0932 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0933 BNE TRAP0933 ;failed not equal (non zero)
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
        TRAP0934 BNE TRAP0934 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0935 BNE TRAP0935 ;failed not equal (non zero)
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
        TRAP0936 BNE TRAP0936 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0937 BNE TRAP0937 ;failed not equal (non zero)
        dey
        bpl teor15
            lda test_case ;previous test
            cmp #39
        TRAP0938 BNE TRAP0938 ;failed not equal (non zero)
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
        TRAP0939 BNE TRAP0939 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0940 BNE TRAP0940 ;failed not equal (non zero)
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
        TRAP0941 BNE TRAP0941 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0942 BNE TRAP0942 ;failed not equal (non zero)
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
        TRAP0943 BNE TRAP0943 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0944 BNE TRAP0944 ;failed not equal (non zero)
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
        TRAP0945 BNE TRAP0945 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0946 BNE TRAP0946 ;failed not equal (non zero)
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
        TRAP0947 BNE TRAP0947 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0948 BNE TRAP0948 ;failed not equal (non zero)
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
        TRAP0949 BNE TRAP0949 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0950 BNE TRAP0950 ;failed not equal (non zero)
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
        TRAP0951 BNE TRAP0951 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0952 BNE TRAP0952 ;failed not equal (non zero)
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
        TRAP0953 BNE TRAP0953 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0954 BNE TRAP0954 ;failed not equal (non zero)
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
        TRAP0955 BNE TRAP0955 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0956 BNE TRAP0956 ;failed not equal (non zero)
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
        TRAP0957 BNE TRAP0957 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,x ;test flags
        TRAP0958 BNE TRAP0958 ;failed not equal (non zero)
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
        TRAP0959 BNE TRAP0959 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0960 BNE TRAP0960 ;failed not equal (non zero)
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
        TRAP0961 BNE TRAP0961 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0962 BNE TRAP0962 ;failed not equal (non zero)
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
        TRAP0963 BNE TRAP0963 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0964 BNE TRAP0964 ;failed not equal (non zero)
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
        TRAP0965 BNE TRAP0965 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0966 BNE TRAP0966 ;failed not equal (non zero)
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
        TRAP0967 BNE TRAP0967 ;failed not equal (non zero)
            pla ;load status
            eor #0|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0968 BNE TRAP0968 ;failed not equal (non zero)
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
        TRAP0969 BNE TRAP0969 ;failed not equal (non zero)
            pla ;load status
            eor #$ff-fnz|fao ;invert expected flags + always on bits
            cmp absflo,y ;test flags
        TRAP0970 BNE TRAP0970 ;failed not equal (non zero)
        dey
        bpl tora15
        cli
            lda test_case ;previous test
            cmp #40
        TRAP0971 BNE TRAP0971 ;failed not equal (non zero)
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
        TRAP0972 BNE TRAP0972 ;failed not equal (non zero)
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
        TRAP0973 BNE TRAP0973 ;failed not equal (non zero)
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
        TRAP0974 BNE TRAP0974 ;failed not equal (non zero)
        clc
        sed
        php
        lda #$55
        adc #$55
        cmp #$10
        TRAP0975 BNE TRAP0975 ;failed not equal (non zero)
        cld
        plp
        lda #$55
        adc #$55
        cmp #$10
        TRAP0976 BNE TRAP0976 ;failed not equal (non zero)
        plp
        lda #$55
        adc #$55
        cmp #$aa
        TRAP0977 BNE TRAP0977 ;failed not equal (non zero)
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
        TRAP0978 BNE TRAP0978 ;failed not equal (non zero)
        rti
bin_rti_ret
        lda #$55
        adc #$55
        cmp #$aa
        TRAP0979 BNE TRAP0979 ;failed not equal (non zero)

        lda test_case
        cmp #43
        TRAP0980 BNE TRAP0980 ;failed not equal (non zero)
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
        TRAP0981 JMP TRAP0981 ;test passed, no errors
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
        TRAP0982 BNE TRAP0982 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0983 BNE TRAP0983 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2 ;perform subtract
        php
        cmp adrl ;check result
        TRAP0984 BNE TRAP0984 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0985 BNE TRAP0985 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC abs
        php ;save carry for subtract
        lda ad1
        adc ada2 ;perform add
        php
        cmp adrl ;check result
        TRAP0986 BNE TRAP0986 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0987 BNE TRAP0987 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2 ;perform subtract
        php
        cmp adrl ;check result
        TRAP0988 BNE TRAP0988 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0989 BNE TRAP0989 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC #
        php ;save carry for subtract
        lda ad2
        sta ex_adci+1 ;set ADC # operand
        lda ad1
        jsr ex_adci ;execute ADC # in RAM
        php
        cmp adrl ;check result
        TRAP0990 BNE TRAP0990 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0991 BNE TRAP0991 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda sb2
        sta ex_sbci+1 ;set SBC # operand
        lda ad1
        jsr ex_sbci ;execute SBC # in RAM
        php
        cmp adrl ;check result
        TRAP0992 BNE TRAP0992 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0993 BNE TRAP0993 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC zp,x
        php ;save carry for subtract
        lda ad1
        adc 0,x ;perform add
        php
        cmp adrl ;check result
        TRAP0994 BNE TRAP0994 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0995 BNE TRAP0995 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        TRAP0996 BNE TRAP0996 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0997 BNE TRAP0997 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC abs,x
        php ;save carry for subtract
        lda ad1
        adc ada2-ad2,x ;perform add
        php
        cmp adrl ;check result
        TRAP0998 BNE TRAP0998 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP0999 BNE TRAP0999 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        TRAP1000 BNE TRAP1000 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1001 BNE TRAP1001 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC abs,y
        php ;save carry for subtract
        lda ad1
        adc ada2-$ff,y ;perform add
        php
        cmp adrl ;check result
        TRAP1002 BNE TRAP1002 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1003 BNE TRAP1003 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-$ff,y ;perform subtract
        php
        cmp adrl ;check result
        TRAP1004 BNE TRAP1004 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1005 BNE TRAP1005 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC (zp,x)
        php ;save carry for subtract
        lda ad1
        adc (< adi2-ad2,x) ;perform add
        php
        cmp adrl ;check result
        TRAP1006 BNE TRAP1006 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1007 BNE TRAP1007 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (< sbi2-ad2,x) ;perform subtract
        php
        cmp adrl ;check result
        TRAP1008 BNE TRAP1008 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1009 BNE TRAP1009 ;failed not equal (non zero)
        plp
 ; decimal ADC / SBC (abs),y
        php ;save carry for subtract
        lda ad1
        adc (adiy2),y ;perform add
        php
        cmp adrl ;check result
        TRAP1010 BNE TRAP1010 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1011 BNE TRAP1011 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (sbiy2),y ;perform subtract
        php
        cmp adrl ;check result
        TRAP1012 BNE TRAP1012 ;failed not equal (non zero)
        pla ;check flags
        and #1 ;mask carry
        cmp adrh
        TRAP1013 BNE TRAP1013 ;failed not equal (non zero)
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
        TRAP1014 BNE TRAP1014 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1015 BNE TRAP1015 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2 ;perform subtract
        php
        cmp adrl ;check result
        TRAP1016 BNE TRAP1016 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1017 BNE TRAP1017 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC abs
        php ;save carry for subtract
        lda ad1
        adc ada2 ;perform add
        php
        cmp adrl ;check result
        TRAP1018 BNE TRAP1018 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1019 BNE TRAP1019 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2 ;perform subtract
        php
        cmp adrl ;check result
        TRAP1020 BNE TRAP1020 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1021 BNE TRAP1021 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC #
        php ;save carry for subtract
        lda ad2
        sta ex_adci+1 ;set ADC # operand
        lda ad1
        jsr ex_adci ;execute ADC # in RAM
        php
        cmp adrl ;check result
        TRAP1022 BNE TRAP1022 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1023 BNE TRAP1023 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda sb2
        sta ex_sbci+1 ;set SBC # operand
        lda ad1
        jsr ex_sbci ;execute SBC # in RAM
        php
        cmp adrl ;check result
        TRAP1024 BNE TRAP1024 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1025 BNE TRAP1025 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC zp,x
        php ;save carry for subtract
        lda ad1
        adc 0,x ;perform add
        php
        cmp adrl ;check result
        TRAP1026 BNE TRAP1026 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1027 BNE TRAP1027 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sb2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        TRAP1028 BNE TRAP1028 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1029 BNE TRAP1029 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC abs,x
        php ;save carry for subtract
        lda ad1
        adc ada2-ad2,x ;perform add
        php
        cmp adrl ;check result
        TRAP1030 BNE TRAP1030 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1031 BNE TRAP1031 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-ad2,x ;perform subtract
        php
        cmp adrl ;check result
        TRAP1032 BNE TRAP1032 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1033 BNE TRAP1033 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC abs,y
        php ;save carry for subtract
        lda ad1
        adc ada2-$ff,y ;perform add
        php
        cmp adrl ;check result
        TRAP1034 BNE TRAP1034 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1035 BNE TRAP1035 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc sba2-$ff,y ;perform subtract
        php
        cmp adrl ;check result
        TRAP1036 BNE TRAP1036 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1037 BNE TRAP1037 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC (zp,x)
        php ;save carry for subtract
        lda ad1
        adc (< adi2-ad2,x) ;perform add
        php
        cmp adrl ;check result
        TRAP1038 BNE TRAP1038 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1039 BNE TRAP1039 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (< sbi2-ad2,x) ;perform subtract
        php
        cmp adrl ;check result
        TRAP1040 BNE TRAP1040 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1041 BNE TRAP1041 ;failed not equal (non zero)
        plp
 ; binary ADC / SBC (abs),y
        php ;save carry for subtract
        lda ad1
        adc (adiy2),y ;perform add
        php
        cmp adrl ;check result
        TRAP1042 BNE TRAP1042 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1043 BNE TRAP1043 ;failed not equal (non zero)
        plp
        php ;save carry for next add
        lda ad1
        sbc (sbiy2),y ;perform subtract
        php
        cmp adrl ;check result
        TRAP1044 BNE TRAP1044 ;failed not equal (non zero)
        pla ;check flags
        and #$c3 ;mask NV----ZC
        cmp adrf
        TRAP1045 BNE TRAP1045 ;failed not equal (non zero)
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
        TRAP1046 BCS TRAP1046 ;failed carry set
        TRAP1047 BVS TRAP1047 ;failed overflow set
        TRAP1048 BMI TRAP1048 ;failed minus (bit 7 set)
        TRAP1049 BEQ TRAP1049 ;failed equal (zero)
        cmp #'F' ;registers loaded?
        TRAP1050 BNE TRAP1050 ;failed not equal (non zero)
        cpx #'A'
        TRAP1051 BNE TRAP1051 ;failed not equal (non zero)
        cpy #('R'-3)
        TRAP1052 BNE TRAP1052 ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx
        cpx #$fd ;check SP
        TRAP1053 BNE TRAP1053 ;failed not equal (non zero)
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
        .BYTE $00 ; AS65 ALIGN -> fixed one-byte pad
ptr_tst_ind .WORD test_ind
ptr_ind_ret .WORD ind_ret
        TRAP1054 JMP TRAP1054 ;failed anyway
        dey
        dey
test_ind
        php ;either SP or Y count will fail, if we do not hit
        dey
        dey
        dey
        plp
        TRAP1055 BCS TRAP1055 ;failed carry set
        TRAP1056 BVS TRAP1056 ;failed overflow set
        TRAP1057 BMI TRAP1057 ;failed minus (bit 7 set)
        TRAP1058 BEQ TRAP1058 ;failed equal (zero)
        cmp #'I' ;registers loaded?
        TRAP1059 BNE TRAP1059 ;failed not equal (non zero)
        cpx #'N'
        TRAP1060 BNE TRAP1060 ;failed not equal (non zero)
        cpy #('D'-3)
        TRAP1061 BNE TRAP1061 ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx
        cpx #$fd ;check SP
        TRAP1062 BNE TRAP1062 ;failed not equal (non zero)
        pla ;restore x
        tax
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        pla ;restore a
        inx ;return registers with modifications
        eor #$aa ;N=1, V=1, Z=0, C=1
        jmp (ptr_ind_ret)
        TRAP1063 JMP TRAP1063 ;failed anyway
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
        TRAP1064 BCS TRAP1064 ;failed carry set
        TRAP1065 BVS TRAP1065 ;failed overflow set
        TRAP1066 BMI TRAP1066 ;failed minus (bit 7 set)
        TRAP1067 BEQ TRAP1067 ;failed equal (zero)
        cmp #'J' ;registers loaded?
        TRAP1068 BNE TRAP1068 ;failed not equal (non zero)
        cpx #'S'
        TRAP1069 BNE TRAP1069 ;failed not equal (non zero)
        cpy #('R'-3)
        TRAP1070 BNE TRAP1070 ;failed not equal (non zero)
        pha ;save a,x
        txa
        pha
        tsx ;sp -4? (return addr,a,x)
        cpx #$fb
        TRAP1071 BNE TRAP1071 ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(jsr_ret)
        TRAP1072 BNE TRAP1072 ;failed not equal (non zero)
        lda $1fe
        cmp #<(jsr_ret)
        TRAP1073 BNE TRAP1073 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
            pha ;use stack to load status
            plp
        pla ;pull x,a
        tax
        pla
        inx ;return registers with modifications
        eor #$aa ;N=1, V=1, Z=0, C=1
        rts
        TRAP1074 JMP TRAP1074 ;failed anyway
        jmp start ;catastrophic error - cannot continue

 ;trap in case of unexpected IRQ, NMI, BRK, RESET - BRK test target
nmi_trap
        TRAP1075 JMP TRAP1075 ;failed anyway
        jmp start ;catastrophic error - cannot continue
res_trap
        TRAP1076 JMP TRAP1076 ;failed anyway
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
        TRAP1077 BNE TRAP1077 ;failed not equal (non zero)
        cpx #'R'
        TRAP1078 BNE TRAP1078 ;failed not equal (non zero)
        cpy #'K'-3
        TRAP1079 BNE TRAP1079 ;failed not equal (non zero)
        sta irq_a ;save registers during break test
        stx irq_x
        tsx ;test break on stack
        lda $102,x
            cmp #(0|fao)&m8 ;expected flags + always on bits
        TRAP1080 BNE TRAP1080 ;failed not equal (non zero)
        pla
            cmp #(intdis|fao)&m8 ;expected flags + always on bits
        TRAP1081 BNE TRAP1081 ;failed not equal (non zero)
        tsx
        cpx #$fc ;sp -3? (return addr, flags)
        TRAP1082 BNE TRAP1082 ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(brk_ret0)
        TRAP1083 BNE TRAP1083 ;failed not equal (non zero)
        lda $1fe
        cmp #<(brk_ret0)
        TRAP1084 BNE TRAP1084 ;failed not equal (non zero)
            lda #$ff ;allow test to change I-flag (no mask)
        pha
        ldx irq_x
        inx ;return registers with modifications
        lda irq_a
        eor #$aa
        plp ;N=1, V=1, Z=1, C=1 but original flags should be restored
        rti
        TRAP1085 JMP TRAP1085 ;failed anyway
        jmp start ;catastrophic error - cannot continue

break2 ;BRK pass 2
        cpx #$ff-'R'
        TRAP1086 BNE TRAP1086 ;failed not equal (non zero)
        cpy #$ff-'K'-3
        TRAP1087 BNE TRAP1087 ;failed not equal (non zero)
        sta irq_a ;save registers during break test
        stx irq_x
        tsx ;test break on stack
        lda $102,x
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP1088 BNE TRAP1088 ;failed not equal (non zero)
        pla
        ora #decmode ;ignore decmode cleared if 65c02
            cmp #($ff|fao)&m8 ;expected flags + always on bits
        TRAP1089 BNE TRAP1089 ;failed not equal (non zero)
        tsx
        cpx #$fc ;sp -3? (return addr, flags)
        TRAP1090 BNE TRAP1090 ;failed not equal (non zero)
        lda $1ff ;propper return on stack
        cmp #>(brk_ret1)
        TRAP1091 BNE TRAP1091 ;failed not equal (non zero)
        lda $1fe
        cmp #<(brk_ret1)
        TRAP1092 BNE TRAP1092 ;failed not equal (non zero)
            lda #intdis ;allow test to change I-flag (no mask)
        pha
        ldx irq_x
        inx ;return registers with modifications
        lda irq_a
        eor #$aa
        plp ;N=0, V=0, Z=0, C=0 but original flags should be restored
        rti
        TRAP1093 JMP TRAP1093 ;failed anyway
        jmp start ;catastrophic error - cannot continue


 ;copy of data to initialize BSS segment


        .END
