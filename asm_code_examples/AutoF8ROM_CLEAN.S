; http://tass64.sourceforge.net (assembler manual)
;.fill DIRECTIVE ???


;********************************************************************************
;* Apple II                                                                     *
;* Monitor II                                                                   *
;*                                                                              *
;* Copyright 1978 by Apple Computer, Inc                                        *
;* All Rights Reserved                                                          *
;*                                                                              *
;* Steve Wozniak                                                                *
;********************************************************************************
;* Modified Nov 1978                                                            *
;* By John A                                                                    *
;********************************************************************************
;* This is a disassembly of THE updated monitor ROM found in THE Apple ][+.     *
;* The labels AND comments come from "Autostart ROM Listing" in THE Apple II    *
;* Reference Manual (starts page 136).  This is a fairly direct translation --  *
;* operands ARE generally formatted as they appear in THE original listing.     *
;* Comments have been converted to mixed-case, but ARE otherwise unchanged.     *
;********************************************************************************
;* Project created by Andy McFadden, using 6502bench SourceGen v1.4.            *
;* Last updated 2019/09/22                                                      *
;********************************************************************************
IOADR       EQU     $c000  
LOC0        EQU     $00
LOC1        EQU     $01
WNDLFT      EQU     $20
WNDWDTH     EQU     $21
WNDTOP      EQU     $22
WNDBTM      EQU     $23
CH          EQU     $24
CV          EQU     $25
GBASL       EQU     $26
GBASH       EQU     $27
BASL        EQU     $28
BASH        EQU     $29
BAS2L       EQU     $2a
BAS2H       EQU     $2b
COLOR       EQU     $30
MODE        EQU     $31
INVFLG      EQU     $32
PROMPT      EQU     $33
YSAV        EQU     $34
YSAV1       EQU     $35
CSWL        EQU     $36
KSWL        EQU     $38
PCL         EQU     $3a
PCH         EQU     $3b
A1L         EQU     $3c
A1H         EQU     $3d
A2L         EQU     $3e
A2H         EQU     $3f
A3L         EQU     $40
A3H         EQU     $41
A4L         EQU     $42
A4H         EQU     $43
A5L         EQU     $44
A5H         EQU     $45
ACC         EQU     $45     ;note overlap with A5H!
XREG        EQU     $46
YREG        EQU     $47
STATUS      EQU     $48
SPNT        EQU     $49
RNDL        EQU     $4e
RNDH        EQU     $4f
IN          EQU     $0200  
BRKV        EQU     $03f0   ;new vector for BRK
SOFTEV      EQU     $03f2   ;vector for warm start
PWREDUP     EQU     $03f4   ;this must = EOR #$A5 of SOFTEV+1
USRADR      EQU     $03f8  
NMI         EQU     $03fb  
IRQLOC      EQU     $03fe  
LINE1       EQU     $0400  
MSLOT       EQU     $07f8
KBD         EQU     $c000           ;R last key pressed + 128
KBDSTRB     EQU     $c010           ;RW keyboard strobe
TAPEOUT     EQU     $c020           ;RW toggle caseette tape output
SPKR        EQU     $c030           ;RW toggle speaker
TXTCLR      EQU     $c050           ;RW display graphics
TXTSET      EQU     $c051           ;RW display text
MIXSET      EQU     $c053           ;RW display split screen
TXTPAGE1    EQU     $c054           ;RW display page 1
LORES       EQU     $c056           ;RW display lo-res graphics
SETAN0      EQU     $c058           ;RW annunciator 0 off
SETAN1      EQU     $c05a           ;RW annunciator 1 off
CLRAN2      EQU     $c05d           ;RW annunciator 2 on
CLRAN3      EQU     $c05f           ;RW annunciator 3 on
TAPEIN      EQU     $c060
PADDL0      EQU     $c064           ;R analog input 0
PTRIG       EQU     $c070           ;RW analog input reset
CLRROM      EQU     $cfff           ;disable slot C8 ROM
BASIC       EQU     $e000
BASIC2      EQU     $e003
H2          EQU     $2c    
V2          EQU     $2d    
MASK        EQU     $2e 

            ORG    $f800
   

PLOT        LSR     A
            PHP
            JSR     GBASCALC
            PLP
            LDA     #$0f
            BCC     RTMASK
            ADC     #$e0
RTMASK      STA     MASK
PLOT1       LDA     (GBASL),y
            EOR     COLOR
            AND     MASK
            EOR     (GBASL),y
            STA     (GBASL),y
            RTS

HLINE       JSR     PLOT
HLINE1      CPY     $2c
            BCS     RTS1
            INY
            JSR     PLOT1
            BCC     HLINE1
VLINEZ      ADC     #$01
VLINE       PHA
            JSR     PLOT
            PLA
            CMP     V2
            BCC     VLINEZ
RTS1        RTS

CLRSCR      LDY     #$2f
            BNE     CLRSC2

CLRTOP      LDY     #$27
CLRSC2      STY     V2
            LDY     #$27
CLRSC3      LDA     #$00
            STA     COLOR
            JSR     VLINE
            DEY
            BPL     CLRSC3
            RTS

GBASCALC    PHA
            LSR     A
            AND     #$03
            ORA     #$04
            STA     GBASH
            PLA
            AND     #$18
            BCC     GBCALC
            ADC     #$7f
GBCALC      STA     GBASL
            ASL     A
            ASL     A
            ORA     GBASL
            STA     GBASL
            RTS

NEXTCOL     LDA     COLOR
            CLC
            ADC     #$03
SETCOL      AND     #$0f
            STA     COLOR
            ASL     A
            ASL     A
            ASL     A
            ASL     A
            ORA     COLOR
            STA     COLOR
            RTS

SCRN        LSR     A
            PHP
            JSR     GBASCALC
            LDA     (GBASL),y
            PLP
SCRN2       BCC     RTMSKZ
            LSR     A
            LSR     A
            LSR     A
            LSR     A
RTMSKZ      AND     #$0f
            RTS

;• Clear variables
LMNEM       EQU    $2c    
RMNEM       EQU    $2d    
FORMAT      EQU    $2e    
LENGTH      EQU    $2f    

INSDS1      LDX     PCL
            LDY     PCH
            JSR     PRYX2
            JSR     PRBLNK
            LDA     (PCL,x)
            TAY
            LSR     A
            BCC     IEVEN
            ROR     A
            BCS     ERR
            CMP     #$a2
            BEQ     ERR
            AND     #$87
IEVEN       LSR     A
            TAX
            LDA     FMT1,x
            JSR     SCRN2
            BNE     GETFMT
ERR         LDY     #$80
            LDA     #$00
GETFMT      TAX
            LDA     FMT2,x
            STA     FORMAT
            AND     #$03
            STA     LENGTH
            TYA
            AND     #$8f
            TAX
            TYA
            LDY     #$03
            CPX     #$8a
            BEQ     MNNDX3
MNNDX1      LSR     A
            BCC     MNNDX3
            LSR     A
MNNDX2      LSR     A
            ORA     #$20
            DEY
            BNE     MNNDX2
            INY
MNNDX3      DEY
            BNE     MNNDX1
            RTS

            HEX   FF FF FF

INSTDSP     JSR     INSDS1
            PHA
PRNTOP      LDA     (PCL),y
            JSR     PRBYTE
            LDX     #$01
PRNTBL      JSR     PRBL2
            CPY     LENGTH
            INY
            BCC     PRNTOP
            LDX     #$03
            CPY     #$04
            BCC     PRNTBL
            PLA
            TAY
            LDA     MNEML,y
            STA     LMNEM
            LDA     MNEMR,y
            STA     RMNEM
NXTCOL      LDA     #$00
            LDY     #$05
PRMN2       ASL     RMNEM
            ROL     LMNEM
            ROL     A
            DEY
            BNE     PRMN2
            ADC     #$bf
            JSR     COUT
            DEX
            BNE     NXTCOL
            JSR     PRBLNK
            LDY     LENGTH
            LDX     #$06
PRADR1      CPX     #$03
            BEQ     PRADR5
PRADR2      ASL     FORMAT
            BCC     PRADR3
            LDA     CHAR1-1,x
            JSR     COUT
            LDA     CHAR2-1,x
            BEQ     PRADR3
            JSR     COUT
PRADR3      DEX
            BNE     PRADR1
            RTS

PRADR4      DEY
            BMI     PRADR2
            JSR     PRBYTE
PRADR5      LDA     FORMAT
            CMP     #$e8
            LDA     (PCL),y
            BCC     PRADR4
RELADR      JSR     PCADJ3
            TAX
            INX
            BNE     PRNTYX
            INY
PRNTYX      TYA
PRNTAX      JSR     PRBYTE
PRNTX       TXA
            JMP     PRBYTE

PRBLNK      LDX     #$03
PRBL2       LDA     #$a0
            JSR     COUT
            DEX
            BNE     PRBL2
            RTS

PCADJ       SEC
PCADJ2      LDA     LENGTH
PCADJ3      LDY     PCH
            TAX
            BPL     PCADJ4
            DEY
PCADJ4      ADC     PCL
            BCC     RTS2
            INY
RTS2        RTS

FMT1        .bulk   $04,$20,$54,$30,$0d,$80,$04,$90,$03,$22,$54,$33,$0d,$80,$04,$90
             +      $04,$20,$54,$33,$0d,$80,$04,$90,$04,$20,$54,$3b,$0d,$80,$04,$90
             +      $00,$22,$44,$33,$0d,$c8,$44,$00,$11,$22,$44,$33,$0d,$c8,$44,$a9
             +      $01,$22,$44,$33,$0d,$80,$04,$90,$01,$22,$44,$33,$0d,$80,$04,$90
             +      $26,$31,$87,$9a
FMT2        .bulk   $00,$21,$81,$82,$00,$00,$59,$4d,$91,$92,$86,$4a,$85,$9d
CHAR1       .bulk   $ac,$a9,$ac,$a3,$a8,$a4
CHAR2       .bulk   $d9,$00,$d8,$a4,$a4,$00
MNEML       .bulk   $1c,$8a,$1c,$23,$5d,$8b,$1b,$a1,$9d,$8a,$1d,$23,$9d,$8b,$1d,$a1
             +      $00,$29,$19,$ae,$69,$a8,$19,$23,$24,$53,$1b,$23,$24,$53,$19,$a1
             +      $00,$1a,$5b,$5b,$a5,$69,$24,$24,$ae,$ae,$a8,$ad,$29,$00,$7c,$00
             +      $15,$9c,$6d,$9c,$a5,$69,$29,$53,$84,$13,$34,$11,$a5,$69,$23,$a0
MNEMR       .bulk   $d8,$62,$5a,$48,$26,$62,$94,$88,$54,$44,$c8,$54,$68,$44,$e8,$94
             +      $00,$b4,$08,$84,$74,$b4,$28,$6e,$74,$f4,$cc,$4a,$72,$f2,$a4,$8a
             +      $00,$aa,$a2,$a2,$74,$74,$74,$72,$44,$68,$b2,$32,$b2,$00,$22,$00
             +      $1a,$1a,$26,$26,$72,$72,$88,$c8,$c4,$ca,$26,$48,$44,$44,$a2,$c8

IRQ         STA     ACC
            PLA
            PHA
            ASL     A
            ASL     A
            ASL     A
            BMI     BREAK
            JMP     (IRQLOC)

BREAK       PLP
            JSR     SAV1
            PLA
            STA     PCL
            PLA
            STA     PCH
            JMP     (BRKV)          ;BRKV written over by disk boot

OLDBRK      JSR     INSDS1
            JSR     RGDSP1
            JMP     MON

RESET       CLD                     ;do this first this time
            JSR     SETNORM
            JSR     INIT
            JSR     SETVID
            JSR     SETKBD
            LDA     SETAN0          ;AN0 = TTL hi
            LDA     SETAN1          ;AN1 = TTL hi
            LDA     CLRAN2          ;AN2 = TTL lo
            LDA     CLRAN3          ;AN3 = TTL lo
            LDA     CLRROM          ;turn off extension ROM
            BIT     KBDSTRB         ;clear keyboard
            CLD
            JSR     BELL            ;causes delay if key bounces
            LDA     SOFTEV+1        ;is reset hi
            EOR     #$a5            ;a funny complement of THE
            CMP     PWREDUP         ;pwr up byte ???
            BNE     PWRUP           ;no so pwrup
            LDA     SOFTEV          ;yes SEE if cold start
            BNE     NOFIX           ;has been done yet?
            LDA     #$e0            ;??
            CMP     SOFTEV+1        ;??
            BNE     NOFIX           ;yes so reenter system
FIXSEV      LDY     #$03            ;no so point at warm start
            STY     SOFTEV          ;for next reset
            JMP     BASIC           ;and do THE cold start

NOFIX       JMP     (SOFTEV)        ;soft entry vector

; ********************
PWRUP       JSR     APPLEII
SETPG3      LDX     #$05            ;set page 3 vectors
LFAAB       LDA     PWRCON-1,x      ;with cntrl B adrs
            STA     BRKV-1,x        ;of current BASIC
            DEX
            BNE     LFAAB
            LDA     #$c8            ;load hi slot +1
            STX     LOC0            ;SETPG3 must return X=0
            STA     LOC1            ;set PTR H
SLOOP       LDY     #$07            ;Y is byte PTR
            DEC     LOC1
            LDA     LOC1
            CMP     #$c0            ;at last slot yet?
            BEQ     FIXSEV          ;yes AND it cant be a disk
            STA     MSLOT
NXTBYT      LDA     (LOC0),y        ;fetch a slot byte
            CMP     DISKID-1,y      ;is it a disk ??
            BNE     SLOOP           ;no so next slot down
            DEY
            DEY                     ;yes so check next byte
            BPL     NXTBYT          ;until 4 checked
            JMP     (LOC0)

            NOP
            NOP
; REGDSP must ORG $FAD7
REGDSP      JSR     CROUT
RGDSP1      LDA     #$45
            STA     A3L
            LDA     #$00
            STA     A3H
            LDX     #$fb
RDSP1       LDA     #$a0
            JSR     COUT
            LDA     RTBL-251,x
            JSR     COUT
            LDA     #$bd
            JSR     COUT
            LDA     ACC+5,x         ;(this is DFB $B5,$4A in listing)
            JSR     PRBYTE
            INX
            BMI     RDSP1
            RTS

PWRCON      .dd2    OLDBRK
            .bulk   $00,$e0,$45
DISKID      .bulk   $20,$ff,$00,$ff,$03,$ff,$3c
TITLE       .str    “APPLE ][”
XLTBL       .bulk   $c4,$c2,$c1,$ff,$c3,$ff,$ff,$ff
; must ORG $FB19
RTBL        .str    “AXYPS”

PREAD       LDA     PTRIG
            LDY     #$00
            NOP
            NOP
PREAD2      LDA     PADDL0,x
            BPL     RTS2D
            INY
            BNE     PREAD2
            DEY
RTS2D       RTS

INIT        LDA     #$00
            STA     STATUS
            LDA     LORES
            LDA     TXTPAGE1
SETTXT      LDA     TXTSET
            LDA     #$00
            BEQ     SETWND

SETGR       LDA     TXTCLR
            LDA     MIXSET
            JSR     CLRTOP
            LDA     #$14
SETWND      STA     WNDTOP
            LDA     #$00
            STA     WNDLFT
            LDA     #$28
            STA     WNDWDTH
            LDA     #$18
            STA     WNDBTM
            LDA     #$17
TABV        STA     CV
            JMP     VTAB

APPLEII     JSR     HOME            ;clear THE scrn
            LDY     #$08
STITLE      LDA     TITLE-1,y       ;get a char
            STA     LINE1+14,y
            DEY
            BNE     STITLE
            RTS

SETPWRC     LDA     SOFTEV+1
            EOR     #$a5
            STA     PWREDUP
            RTS

VIDWAIT     CMP     #$8d            ;check for a pause only when I have a CR
            BNE     NOWAIT          ;no so, do regular
            LDY     KBD             ;is key pressed?
            BPL     NOWAIT          ;no
            CPY     #$93            ;is it CTL S?
            BNE     NOWAIT          ;no so ignore
            BIT     KBDSTRB         ;clear strobe
KBDWAIT     LDY     KBD             ;wait till next key to resume
            BPL     KBDWAIT         ;wait for keypress
            CPY     #$83            ;is it control C ?
            BEQ     NOWAIT          ;yes so leave it
            BIT     KBDSTRB         ;clr strobe
NOWAIT      JMP     VIDOUT          ;do as before

ESCOLD      SEC                     ;insure carry SET
            JMP     ESC1

ESCNOW      TAY                     ;use char as index
            LDA     XLTBL-201,y     ;xlate IJKM to CBAD
            JSR     ESCOLD          ;do this cursor motion
            JSR     RDKEY           ;and get next
ESCNEW      CMP     #$ce            ;is this an N ?
            BCS     ESCOLD          ;N or greater do it
            CMP     #$c9            ;less than I ?
            BCC     ESCOLD          ;yes so OLD way
            CMP     #$cc            ;is it a L ?
            BEQ     ESCOLD          ;do normal
            BNE     ESCNOW          ;go do it

            .bulk   $ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea ;padding

; must ORG $FBC1
BASCALC     PHA
            LSR     A
            AND     #$03
            ORA     #$04
            STA     BASH
            PLA
            AND     #$18
            BCC     BASCLC2
            ADC     #$7f
BASCLC2     STA     BASL
            ASL     A
            ASL     A
            ORA     BASL
            STA     BASL
            RTS

BELL1       CMP     #$87
            BNE     RTS2B
            LDA     #$40
            JSR     WAIT
            LDY     #$c0
BELL2       LDA     #$0c
            JSR     WAIT
            LDA     SPKR
            DEY
            BNE     BELL2
RTS2B       RTS

STORADV     LDY     CH
            STA     (BASL),y
ADVANCE     INC     CH
            LDA     CH
            CMP     WNDWDTH
            BCS     CR
RTS3        RTS

VIDOUT      CMP     #$a0
            BCS     STORADV
            TAY
            BPL     STORADV
            CMP     #$8d
            BEQ     CR
            CMP     #$8a
            BEQ     LF
            CMP     #$88
            BNE     BELL1
BS          DEC     CH
            BPL     RTS3
            LDA     WNDWDTH
            STA     CH
            DEC     CH
UP          LDA     WNDTOP
            CMP     CV
            BCS     RTS4
            DEC     CV
VTAB        LDA     CV
VTABZ       JSR     BASCALC
            ADC     WNDLFT
            STA     BASL
RTS4        RTS

ESC1        EOR     #$c0            ;esc @ ?
            BEQ     HOME            ;if so do home AND clear
            ADC     #$fd            ;esc-A or B check
            BCC     ADVANCE         ;A, advance
            BEQ     BS              ;B, backspace
            ADC     #$fd            ;esc-C or D check
            BCC     LF              ;C, down
            BEQ     UP              ;D, go up
            ADC     #$fd            ;esc-E or F check
            BCC     CLREOL          ;E, clear to END of line
            BNE     RTS4            ;else NOT F, return
CLREOP      LDY     CH              ;esc F is CLR to END of page
            LDA     CV
CLEOP1      PHA
            JSR     VTABZ
            JSR     CLEOLZ
            LDY     #$00
            PLA
            ADC     #$00
            CMP     WNDBTM
            BCC     CLEOP1
            BCS     VTAB

HOME        LDA     WNDTOP
            STA     CV
            LDY     #$00
            STY     CH
            BEQ     CLEOP1

CR          LDA     #$00
            STA     CH
LF          INC     CV
            LDA     CV
            CMP     WNDBTM
            BCC     VTABZ
            DEC     CV
SCROLL      LDA     WNDTOP
            PHA
            JSR     VTABZ
SCRL1       LDA     BASL
            STA     BAS2L
            LDA     BASH
            STA     BAS2H
            LDY     WNDWDTH
            DEY
            PLA
            ADC     #$01
            CMP     WNDBTM
            BCS     SCRL3
            PHA
            JSR     VTABZ
SCRL2       LDA     (BASL),y
            STA     (BAS2L),y
            DEY
            BPL     SCRL2
            BMI     SCRL1

SCRL3       LDY     #$00
            JSR     CLEOLZ
            BCS     VTAB
CLREOL      LDY     CH
CLEOLZ      LDA     #$a0
CLREOL2     STA     (BASL),y
            INY
            CPY     WNDWDTH
            BCC     CLREOL2
            RTS

WAIT        SEC
WAIT2       PHA
WAIT3       SBC     #$01
            BNE     WAIT3
            PLA
            SBC     #$01
            BNE     WAIT2
            RTS

NXTA4       INC     A4L
            BNE     NXTA1
            INC     A4H
NXTA1       LDA     A1L
            CMP     A2L
            LDA     A1H
            SBC     A2H
            INC     A1L
            BNE     RTS4B
            INC     A1H
RTS4B       RTS

HEADR       LDY     #$4b
            JSR     ZERDLY
            BNE     HEADR
            ADC     #$fe
            BCS     HEADR
            LDY     #$21
WRBIT       JSR     ZERDLY
            INY
            INY
ZERDLY      DEY
            BNE     ZERDLY
            BCC     WRTAPE
            LDY     #$32
ONEDLY      DEY
            BNE     ONEDLY
WRTAPE      LDY     TAPEOUT
            LDY     #$2c
            DEX
            RTS

RDBYTE      LDX     #$08
RDBYT2      PHA
            JSR     RD2BIT
            PLA
            ROL     A
            LDY     #$3a
            DEX
            BNE     RDBYT2
            RTS

• Clear variables
LASTIN      .var    $2f    

RD2BIT      JSR     RDBIT
RDBIT       DEY
            LDA     TAPEIN
            EOR     LASTIN
            BPL     RDBIT
            EOR     LASTIN
            STA     LASTIN
            CPY     #$80
            RTS

RDKEY       LDY     CH
            LDA     (BASL),y
            PHA
            AND     #$3f
            ORA     #$40
            STA     (BASL),y
            PLA
            JMP     (KSWL)

KEYIN       INC     RNDL
            BNE     KEYIN2
            INC     RNDH
KEYIN2      BIT     KBD             ;read keyboard
            BPL     KEYIN
            STA     (BASL),y
            LDA     KBD
            BIT     KBDSTRB
            RTS

ESC         JSR     RDKEY
            JSR     ESCNEW
RDCHAR      JSR     RDKEY
            CMP     #$9b
            BEQ     ESC
            RTS

NOTCR       LDA     INVFLG
            PHA
            LDA     #$ff
            STA     INVFLG
            LDA     IN,x
            JSR     COUT
            PLA
            STA     INVFLG
            LDA     IN,x
            CMP     #$88
            BEQ     BCKSPC
            CMP     #$98
            BEQ     CANCEL
            CPX     #$f8
            BCC     NOTCR1
            JSR     BELL
NOTCR1      INX
            BNE     NXTCHAR
CANCEL      LDA     #$dc
            JSR     COUT
GETLNZ      JSR     CROUT
GETLN       LDA     PROMPT
            JSR     COUT
GETLN1      LDX     #$01
BCKSPC      TXA
            BEQ     GETLNZ
            DEX
NXTCHAR     JSR     RDCHAR
            CMP     #$95
            BNE     CAPTST
            LDA     (BASL),y
CAPTST      CMP     #$e0
            BCC     ADDINP
            AND     #$df            ;shift to upper case
ADDINP      STA     IN,x
            CMP     #$8d
            BNE     NOTCR
CROUT1      JSR     CLREOL
CROUT       LDA     #$8d
            BNE     COUT

PRA1        LDY     A1H
            LDX     A1L
PRYX2       JSR     CROUT
            JSR     PRNTYX
            LDY     #$00
            LDA     #$ad
            JMP     COUT

XAMB        LDA     A1L
            ORA     #$07
            STA     A2L
            LDA     A1H
            STA     A2H
MOD8CHK     LDA     A1L
            AND     #$07
            BNE     DATAOUT
XAM         JSR     PRA1
DATAOUT     LDA     #$a0
            JSR     COUT
            LDA     (A1L),y
            JSR     PRBYTE
            JSR     NXTA1
            BCC     MOD8CHK
RTS4C       RTS

XAMPM       LSR     A
            BCC     XAM
            LSR     A
            LSR     A
            LDA     A2L
            BCC     ADD
            EOR     #$ff
ADD         ADC     A1L
            PHA
            LDA     #$bd
            JSR     COUT
            PLA
PRBYTE      PHA
            LSR     A
            LSR     A
            LSR     A
            LSR     A
            JSR     PRHEXZ
            PLA
PRHEX       AND     #$0f
PRHEXZ      ORA     #$b0
            CMP     #$ba
            BCC     COUT
            ADC     #$06
COUT        JMP     (CSWL)

COUT1       CMP     #$a0
            BCC     COUTZ
            AND     INVFLG
COUTZ       STY     YSAV1
            PHA
            JSR     VIDWAIT         ;go check for pause
            PLA
            LDY     YSAV1
            RTS

BL1         DEC     YSAV
            BEQ     XAMB
BLANK       DEX
            BNE     SETMDZ
            CMP     #$ba
            BNE     XAMPM
            STA     MODE
            LDA     A2L
            STA     (A3L),y
            INC     A3L
            BNE     RTS5
            INC     A3H
RTS5        RTS

; check me
SETMODE     LDY     YSAV
            LDA     IN-1,y
SETMDZ      STA     MODE
            RTS

LT          LDX     #$01
LT2         LDA     A2L,x
            STA     A4L,x
            STA     A5L,x
            DEX
            BPL     LT2
            RTS

MOVE        LDA     (A1L),y
            STA     (A4L),y
            JSR     NXTA4
            BCC     MOVE
            RTS

VFY         LDA     (A1L),y
            CMP     (A4L),y
            BEQ     VFYOK
            JSR     PRA1
            LDA     (A1L),y
            JSR     PRBYTE
            LDA     #$a0
            JSR     COUT
            LDA     #$a8
            JSR     COUT
            LDA     (A4L),y
            JSR     PRBYTE
            LDA     #$a9
            JSR     COUT
VFYOK       JSR     NXTA4
            BCC     VFY
            RTS

LIST        JSR     A1PC
            LDA     #$14
LIST2       PHA
            JSR     INSTDSP
            JSR     PCADJ
            STA     PCL
            STY     PCH
            PLA
            SEC
            SBC     #$01
            BNE     LIST2
            RTS

A1PC        TXA
            BEQ     A1PCRTS
A1PCLP      LDA     A1L,x
            STA     PCL,x
            DEX
            BPL     A1PCLP
A1PCRTS     RTS

SETINV      LDY     #$3f
            BNE     SETIFLG

SETNORM     LDY     #$ff
SETIFLG     STY     INVFLG
            RTS

SETKBD      LDA     #$00
INPORT      STA     A2L
INPRT       LDX     #KSWL
            LDY     #<KEYIN
            BNE     IOPRT

SETVID      LDA     #$00
OUTPORT     STA     A2L
OUTPRT      LDX     #CSWL
            LDY     #<COUT1
IOPRT       LDA     A2L
            AND     #$0f
            BEQ     IOPRT1
            ORA     #>IOADR
            LDY     #$00
            BEQ     IOPRT2

IOPRT1      LDA     #>COUT1
IOPRT2      STY     LOC0,x          ;$94,$00
            STA     LOC1,x          ;$95,$01
            RTS

            NOP
            NOP
XBASIC      JMP     BASIC

BASCONT     JMP     BASIC2

GO          JSR     A1PC
            JSR     RESTORE
            JMP     (PCL)

REGZ        JMP     REGDSP

TRACE       RTS                     ;TRACE is gone

            NOP
STEPZ       RTS                     ;STEP is gone

_REMOVED    NOP
            NOP
            NOP
            NOP
            NOP
USR         JMP     USRADR

WRITE       LDA     #$40
            JSR     HEADR
            LDY     #$27
WR1         LDX     #$00
            EOR     (A1L,x)
            PHA
            LDA     (A1L,x)
            JSR     WRBYTE
            JSR     NXTA1
            LDY     #$1d
            PLA
            BCC     WR1
            LDY     #$22
            JSR     WRBYTE
            BEQ     BELL
WRBYTE      LDX     #$10
WRBYT2      ASL     A
            JSR     WRBIT
            BNE     WRBYT2
            RTS

• Clear variables
CHKSUM      .var    $2e    

CRMON       JSR     BL1
            PLA
            PLA
            BNE     MONZ
READ        JSR     RD2BIT
            LDA     #$16
            JSR     HEADR
            STA     CHKSUM
            JSR     RD2BIT
RD2         LDY     #$24
            JSR     RDBIT
            BCS     RD2
            JSR     RDBIT
            LDY     #$3b
RD3         JSR     RDBYTE
            STA     (A1L,x)
            EOR     CHKSUM
            STA     CHKSUM
            JSR     NXTA1
            LDY     #$35
            BCC     RD3
            JSR     RDBYTE
            CMP     CHKSUM
            BEQ     BELL
PRERR       LDA     #$c5
            JSR     COUT
            LDA     #$d2
            JSR     COUT
            JSR     COUT
BELL        LDA     #$87
            JMP     COUT

RESTORE     LDA     STATUS
            PHA
            LDA     A5H
RESTR1      LDX     XREG
            LDY     YREG
            PLP
            RTS

SAVE        STA     A5H
SAV1        STX     XREG
            STY     YREG
            PHP
            PLA
            STA     STATUS
            TSX
            STX     SPNT
            CLD
            RTS

OLDRST      JSR     SETNORM
            JSR     INIT
            JSR     SETVID
            JSR     SETKBD
MON         CLD
            JSR     BELL
MONZ        LDA     #$aa            ;CALL -151
            STA     PROMPT
            JSR     GETLNZ
            JSR     ZMODE
NXTITM      JSR     GETNUM
            STY     YSAV
            LDY     #$17
CHRSRCH     DEY
            BMI     MON
            CMP     CHRTBL,y
            BNE     CHRSRCH
            JSR     TOSUB
            LDY     YSAV
            JMP     NXTITM

DIG         LDX     #$03
            ASL     A
            ASL     A
            ASL     A
            ASL     A
NXTBIT      ASL     A
            ROL     A2L
            ROL     A2H
            DEX
            BPL     NXTBIT
NXTBAS      LDA     MODE
            BNE     NXTBS2
            LDA     A2H,x
            STA     A1H,x
            STA     A3H,x
NXTBS2      INX
            BEQ     NXTBAS
            BNE     NXTCHR

GETNUM      LDX     #$00
            STX     A2L
            STX     A2H
NXTCHR      LDA     IN,y
            INY
            EOR     #$b0
            CMP     #$0a
            BCC     DIG
            ADC     #$88
            CMP     #$fa
            BCS     DIG
            RTS

TOSUB       LDA     #>GO
            PHA
            LDA     SUBTBL,y
            PHA
            LDA     MODE
ZMODE       LDY     #$00
            STY     MODE
            RTS

CHRTBL      .dd1    $bc
            .dd1    $b2
            .dd1    $be
            .dd1    $b2             ;T CMD now like USR
            .dd1    $ef
            .dd1    $c4
            .dd1    $b2             ;S CMD now like USR
            .dd1    $a9
            .dd1    $bb
            .dd1    $a6
            .dd1    $a4
            .dd1    $06
            .dd1    $95
            .dd1    $07
            .dd1    $02
            .dd1    $05
            .dd1    $f0
            .dd1    $00
            .dd1    $eb
            .dd1    $93
            .dd1    $a7
            .dd1    $c6
            .dd1    $99
SUBTBL      .dd1    <BASCONT-1
            .dd1    <USR-1
            .dd1    <REGZ-1
            .dd1    <TRACE-1
            .dd1    <VFY-1
            .dd1    <INPRT-1
            .dd1    <_REMOVED-1
            .dd1    <OUTPRT-1
            .dd1    <XBASIC-1
            .dd1    <SETMODE-1
            .dd1    <SETMODE-1
            .dd1    <MOVE-1
            .dd1    <LT-1
            .dd1    <SETNORM-1
            .dd1    <SETINV-1
            .dd1    <LIST-1
            .dd1    <WRITE-1
            .dd1    <GO-1
            .dd1    <READ-1
            .dd1    <SETMODE-1
            .dd1    <SETMODE-1
            .dd1    <CRMON-1
            .dd1    <BLANK-1
            .dd2    NMI
            .dd2    RESET
            .dd2    IRQ
