; http://tass64.sourceforge.net (assembler manual)
;https://6502disassembly.com/a2-rom/AutoF8ROM.html

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
BAS2L       EQU     $2A
BAS2H       EQU     $2B
COLOR       EQU     $30
MODE        EQU     $31
INVFLG      EQU     $32
PROMPT      EQU     $33
YSAV        EQU     $34
YSAV1       EQU     $35
CSWL        EQU     $36
KSWL        EQU     $38
PCL         EQU     $3A
PCH         EQU     $3B
A1L         EQU     $3C
A1H         EQU     $3D
A2L         EQU     $3E
A2H         EQU     $3F
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
RNDL        EQU     $4E
RNDH        EQU     $4F
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
H2          EQU     $2C    
V2          EQU     $2D    
MASK        EQU     $2E 

            ORG    $F800
   

PLOT        LSR     A
            PHP
            JSR     GBASCALC
            PLP
            LDA     #$0F
            BCC     RTMASK
            ADC     #$E0
RTMASK      STA     *MASK
PLOT1       LDA     (GBASL),Y
            EOR     *COLOR
            AND     *MASK
            EOR     (GBASL),Y
            STA     (GBASL),Y
            RTS
;OK
HLINE       JSR     PLOT
HLINE1      CPY     *H2
            BCS     RTS1
            INY
            JSR     PLOT1
            BCC     HLINE1
VLINEZ      ADC     #$01
VLINE       PHA
            JSR     PLOT
            PLA
            CMP     *V2
            BCC     VLINEZ
RTS1        RTS
;OK
CLRSCR      LDY     #$2F
            BNE     CLRSC2

CLRTOP      LDY     #$27
CLRSC2      STY     *V2
            LDY     #$27
CLRSC3      LDA     #$00
            STA     *COLOR
            JSR     VLINE
            DEY
            BPL     CLRSC3
            RTS
;OK
GBASCALC    PHA
            LSR     A
            AND     #$03
            ORA     #$04
            STA     *GBASH
            PLA
            AND     #$18
            BCC     GBCALC
            ADC     #$7F
GBCALC      STA     *GBASL
            ASL     A
            ASL     A
            ORA     *GBASL
            STA     *GBASL
            RTS
;OK F85E
NEXTCOL     LDA     *COLOR
            CLC
            ADC     #$03
SETCOL      AND     #$0F
            STA     *COLOR
            ASL     A
            ASL     A
            ASL     A
            ASL     A
            ORA     *COLOR
            STA     *COLOR
            RTS
;OK F871
SCRN        LSR     A
            PHP
            JSR     GBASCALC
            LDA     (GBASL),Y
            PLP
SCRN2       BCC     RTMSKZ
            LSR     A
            LSR     A
            LSR     A
            LSR     A
RTMSKZ      AND     #$0F
            RTS
;OK F882
;• Clear variables
LMNEM       EQU    $2C    
RMNEM       EQU    $2D    
FORMAT      EQU    $2E    
LENGTH      EQU    $2F    

INSDS1      LDX     *PCL
            LDY     *PCH
            JSR     PRYX2
            JSR     PRBLNK
            LDA     (PCL,X)
            TAY
            LSR     A
            BCC     IEVEN
            ROR     A
            BCS     ERR
            CMP     #$A2
            BEQ     ERR
            AND     #$87
IEVEN       LSR     A
            TAX
            LDA     FMT1,X
            JSR     SCRN2
            BNE     GETFMT
ERR         LDY     #$80
            LDA     #$00
GETFMT      TAX
            LDA     FMT2,X
            STA     *FORMAT
            AND     #$03
            STA     *LENGTH
            TYA
            AND     #$8F
            TAX
            TYA
            LDY     #$03
            CPX     #$8A
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
;OK F8CD
            HEX   FFFFFF

INSTDSP     JSR     INSDS1
            PHA
PRNTOP      LDA     (PCL),Y
            JSR     PRBYTE
            LDX     #$01
PRNTBL      JSR     PRBL2
            CPY     *LENGTH
            INY
            BCC     PRNTOP
            LDX     #$03
            CPY     #$04
            BCC     PRNTBL
            PLA
            TAY
            LDA     MNEML,Y
            STA     *LMNEM
            LDA     MNEMR,Y
            STA     *RMNEM
NXTCOL      LDA     #$00
            LDY     #$05
PRMN2       ASL     *RMNEM
            ROL     *LMNEM
            ROL     A
            DEY
            BNE     PRMN2
            ADC     #$BF
            JSR     COUT
            DEX
            BNE     NXTCOL
            JSR     PRBLNK
            LDY     *LENGTH
            LDX     #$06
PRADR1      CPX     #$03
            BEQ     PRADR5
PRADR2      ASL     *FORMAT
            BCC     PRADR3
            LDA     CHAR1-1,X
            JSR     COUT
            LDA     CHAR2-1,X
            BEQ     PRADR3
            JSR     COUT
PRADR3      DEX
            BNE     PRADR1
            RTS
; OK F92A
PRADR4      DEY
            BMI     PRADR2
            JSR     PRBYTE
PRADR5      LDA     *FORMAT
            CMP     #$E8
            LDA     (PCL),Y
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
PRBL2       LDA     #$A0
            JSR     COUT
            DEX
            BNE     PRBL2
            RTS
;OK F953
PCADJ       SEC
PCADJ2      LDA     *LENGTH
PCADJ3      LDY     *PCH
            TAX
            BPL     PCADJ4
            DEY
PCADJ4      ADC     *PCL
            BCC     RTS2
            INY
RTS2        RTS
;OK F962
FMT1       HEX  042054300D800490
           HEX  032254330D800490
           HEX  042054330D800490
           HEX  0420543B0D800490
           HEX  002244330DC84400
           HEX  112244330DC844A9
           HEX  012244330D800490
           HEX  012244330D800490
           HEX  2631879A
FMT2       HEX  002181820000594D
           HEX  9192864A859D
CHAR1      HEX  ACA9ACA3A8A4
CHAR2      HEX  D900D8A4A400
MNEML      HEX  1C8A1C235D8B1BA1
           HEX  9D8A1D239D8B1DA1
           HEX  002919AE69A81923
           HEX  24531B23245319A1
           HEX  001A5B5BA5692424
           HEX  AEAEA8AD29007C00
           HEX  159C6D9CA5692953
           HEX  84133411A56923A0
MNEMR      HEX  D8625A4826629488
           HEX  5444C8546844E894
           HEX  00B4088474B4286E
           HEX  74F4CC4A72F2A48A
           HEX  00AAA2A274747472
           HEX  4468B232B2002200
           HEX  1A1A2626727288C8
           HEX  C4CA26484444A2C8

IRQ         STA     *ACC
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
            STA     *PCL
            PLA
            STA     *PCH
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
            EOR     #$A5            ;a funny complement of THE
            CMP     PWREDUP         ;pwr up byte ???
            BNE     PWRUP           ;no so pwrup
            LDA     SOFTEV          ;yes SEE if cold start
            BNE     NOFIX           ;has been done yet?
            LDA     #$E0            ;??
            CMP     SOFTEV+1        ;??
            BNE     NOFIX           ;yes so reenter system
FIXSEV      LDY     #$03            ;no so point at warm start
            STY     SOFTEV          ;for next reset
            JMP     BASIC           ;and do THE cold start

NOFIX       JMP     (SOFTEV)        ;soft entry vector

; ********************
PWRUP       JSR     APPLEII
SETPG3      LDX     #$05            ;set page 3 vectors
LFAAB       LDA     PWRCON-1,X      ;with cntrl B adrs
            STA     BRKV-1,X        ;of current BASIC
            DEX
            BNE     LFAAB
            LDA     #$C8            ;load hi slot +1
            STX     *LOC0            ;SETPG3 must return X=0
            STA     *LOC1            ;set PTR H
SLOOP       LDY     #$07            ;Y is byte PTR
            DEC     *LOC1
            LDA     *LOC1
            CMP     #$C0            ;at last slot yet?
            BEQ     FIXSEV          ;yes AND it cant be a disk
            STA     MSLOT
NXTBYT      LDA     (*LOC0),Y        ;fetch a slot byte
            CMP     DISKID-1,Y      ;is it a disk ??
            BNE     SLOOP           ;no so next slot down
            DEY
            DEY                     ;yes so check next byte
            BPL     NXTBYT          ;until 4 checked
            JMP     (*LOC0)

            NOP
            NOP
; REGDSP must ORG $FAD7
REGDSP      JSR     CROUT
RGDSP1      LDA     #$45
            STA     *A3L
            LDA     #$00
            STA     *A3H
            LDX     #$FB
RDSP1       LDA     #$A0
            JSR     COUT
            LDA     RTBL-251,X
            JSR     COUT
            LDA     #$BD
            JSR     COUT
            LDA     *ACC+5,X         ;(this is DFB B5 4A in listing)
            JSR     PRBYTE
            INX
            BMI     RDSP1
            RTS
;OK FAFD
PWRCON      .WORD   OLDBRK
           HEX  00E045
DISKID     HEX  20FF00FF03FF3C
TITLE      ASC   “APPLE ][”
XLTBL      HEX  C4C2C1FFC3FFFFFF
; must ORG $FB19
RTBL       ASC   “AXYPS”

PREAD       LDA     PTRIG
            LDY     #$00
            NOP
            NOP
PREAD2      LDA     PADDL0,X
            BPL     RTS2D
            INY
            BNE     PREAD2
            DEY
RTS2D       RTS
;OK FB2F
INIT        LDA     #$00
            STA     *STATUS
            LDA     LORES
            LDA     TXTPAGE1
SETTXT      LDA     TXTSET
            LDA     #$00
            BEQ     SETWND

SETGR       LDA     TXTCLR
            LDA     MIXSET
            JSR     CLRTOP
            LDA     #$14
SETWND      STA     *WNDTOP
            LDA     #$00
            STA     *WNDLFT
            LDA     #$28
            STA     *WNDWDTH
            LDA     #$18
            STA     *WNDBTM
            LDA     #$17
TABV        STA     *CV
            JMP     VTAB

APPLEII     JSR     HOME            ;clear THE scrn
            LDY     #$08
STITLE      LDA     TITLE-1,Y       ;get a char
            STA     LINE1+14,Y
            DEY
            BNE     STITLE
            RTS
;OK FB6F
SETPWRC     LDA     SOFTEV+1
            EOR     #$A5
            STA     PWREDUP
            RTS

VIDWAIT     CMP     #$8D            ;check for a pause only when I have a CR
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
            LDA     XLTBL-201,Y     ;xlate IJKM to CBAD
            JSR     ESCOLD          ;do this cursor motion
            JSR     RDKEY           ;and get next
ESCNEW      CMP     #$CE            ;is this an N ?
            BCS     ESCOLD          ;N or greater do it
            CMP     #$C9            ;less than I ?
            BCC     ESCOLD          ;yes so OLD way
            CMP     #$CC            ;is it a L ?
            BEQ     ESCOLD          ;do normal
            BNE     ESCNOW          ;go do it

           HEX  EAEAEAEAEAEAEAEAEAEAEAEAEAEA ;padding

; must ORG $FBC1
BASCALC     PHA
            LSR     A
            AND     #$03
            ORA     #$04
            STA     *BASH
            PLA
            AND     #$18
            BCC     BASCLC2
            ADC     #$7F
BASCLC2     STA     *BASL
            ASL     A
            ASL     A
            ORA     *BASL
            STA     *BASL
            RTS

BELL1       CMP     #$87
            BNE     RTS2B
            LDA     #$40
            JSR     WAIT
            LDY     #$C0
BELL2       LDA     #$0C
            JSR     WAIT
            LDA     SPKR
            DEY
            BNE     BELL2
RTS2B       RTS

STORADV     LDY     *CH
            STA     (BASL),Y
ADVANCE     INC     *CH
            LDA     *CH
            CMP     *WNDWDTH
            BCS     CR
RTS3        RTS
;OK FBFD
VIDOUT      CMP     #$A0
            BCS     STORADV
            TAY
            BPL     STORADV
            CMP     #$8D
            BEQ     CR
            CMP     #$8A
            BEQ     LF
            CMP     #$88
            BNE     BELL1
BS          DEC     *CH
            BPL     RTS3
            LDA     *WNDWDTH
            STA     *CH
            DEC     *CH
UP          LDA     *WNDTOP
            CMP     *CV
            BCS     RTS4
            DEC     *CV
VTAB        LDA     *CV
VTABZ       JSR     BASCALC
            ADC     *WNDLFT
            STA     *BASL
RTS4        RTS
;OK FC2C
ESC1        EOR     #$C0            ;esc @ ?
            BEQ     HOME            ;if so do home AND clear
            ADC     #$FD            ;esc-A or B check
            BCC     ADVANCE         ;A, advance
            BEQ     BS              ;B, backspace
            ADC     #$FD            ;esc-C or D check
            BCC     LF              ;C, down
            BEQ     UP              ;D, go up
            ADC     #$FD            ;esc-E or F check
            BCC     CLREOL          ;E, clear to END of line
            BNE     RTS4            ;else NOT F, return
CLREOP      LDY     *CH              ;esc F is CLR to END of page
            LDA     *CV
CLEOP1      PHA
            JSR     VTABZ
            JSR     CLEOLZ
            LDY     #$00
            PLA
            ADC     #$00
            CMP     *WNDBTM
            BCC     CLEOP1
            BCS     VTAB

HOME        LDA     *WNDTOP
            STA     *CV
            LDY     #$00
            STY     *CH
            BEQ     CLEOP1

CR          LDA     #$00
            STA     *CH
LF          INC     *CV
            LDA     *CV
            CMP     *WNDBTM
            BCC     VTABZ
            DEC     *CV
SCROLL      LDA     *WNDTOP
            PHA
            JSR     VTABZ
SCRL1       LDA     *BASL
            STA     *BAS2L
            LDA     *BASH
            STA     *BAS2H
            LDY     *WNDWDTH
            DEY
            PLA
            ADC     #$01
            CMP     *WNDBTM
            BCS     SCRL3
            PHA
            JSR     VTABZ
SCRL2       LDA     (BASL),Y
            STA     (BAS2L),Y
            DEY
            BPL     SCRL2
            BMI     SCRL1

SCRL3       LDY     #$00
            JSR     CLEOLZ
            BCS     VTAB
CLREOL      LDY     *CH
CLEOLZ      LDA     #$A0
CLREO2     STA     (BASL),Y
            INY
            CPY     *WNDWDTH
            BCC     CLREO2
            RTS

WAIT        SEC
WAIT2       PHA
WAIT3       SBC     #$01
            BNE     WAIT3
            PLA
            SBC     #$01
            BNE     WAIT2
            RTS
;OK FCB4
NXTA4       INC     *A4L
            BNE     NXTA1
            INC     *A4H
NXTA1       LDA     *A1L
            CMP     *A2L
            LDA     *A1H
            SBC     *A2H
            INC     *A1L
            BNE     RTS4B
            INC     *A1H
RTS4B       RTS

HEADR       LDY     #$4B
            JSR     ZERDLY
            BNE     HEADR
            ADC     #$FE
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
            LDY     #$2C
            DEX
            RTS
;OK FCEC
RDBYTE      LDX     #$08
RDBYT2      PHA
            JSR     RD2BIT
            PLA
            ROL     A
            LDY     #$3A
            DEX
            BNE     RDBYT2
            RTS

;* Clear variables
LASTIN      EQU   $2F    

RD2BIT      JSR     RDBIT
RDBIT       DEY
            LDA     TAPEIN
            EOR     *LASTIN
            BPL     RDBIT
            EOR     *LASTIN
            STA     *LASTIN
            CPY     #$80
            RTS

RDKEY       LDY     *CH
            LDA     (BASL),Y
            PHA
            AND     #$3F
            ORA     #$40
            STA     (BASL),Y
            PLA
            JMP     (KSWL)

KEYIN       INC     *RNDL
            BNE     KEYIN2
            INC     *RNDH
KEYIN2      BIT     KBD             ;read keyboard
            BPL     KEYIN
            STA     (BASL),Y
            LDA     KBD
            BIT     KBDSTRB
            RTS

ESC         JSR     RDKEY
            JSR     ESCNEW
RDCHAR      JSR     RDKEY
            CMP     #$9B
            BEQ     ESC
            RTS

NOTCR       LDA     *INVFLG
            PHA
            LDA     #$FF
            STA     *INVFLG
            LDA     IN,X
            JSR     COUT
            PLA
            STA     *INVFLG
            LDA     IN,X
            CMP     #$88
            BEQ     BCKSPC
            CMP     #$98
            BEQ     CANCEL
            CPX     #$F8
            BCC     NOTCR1
            JSR     BELL
NOTCR1      INX
            BNE     NXTCHAR
CANCEL      LDA     #$DC
            JSR     COUT
GETLNZ      JSR     CROUT
GETLN       LDA     *PROMPT
            JSR     COUT
GETLN1      LDX     #$01
BCKSPC      TXA
            BEQ     GETLNZ
            DEX
NXTCHAR     JSR     RDCHAR
            CMP     #$95
            BNE     CAPTST
            LDA     (BASL),Y
CAPTST      CMP     #$E0
            BCC     ADDINP
            AND     #$DF            ;shift to upper case
ADDINP      STA     IN,X
            CMP     #$8D
            BNE     NOTCR
CROUT1      JSR     CLREOL
CROUT       LDA     #$8D
            BNE     COUT

PRA1        LDY     *A1H
            LDX     *A1L
PRYX2       JSR     CROUT
            JSR     PRNTYX
            LDY     #$00
            LDA     #$AD
            JMP     COUT

XAMB        LDA     *A1L
            ORA     #$07
            STA     *A2L
            LDA     *A1H
            STA     *A2H
MOD8CHK     LDA     *A1L
            AND     #$07
            BNE     DATAOUT
XAM         JSR     PRA1
DATAOUT     LDA     #$A0
            JSR     COUT
            LDA     (A1L),Y
            JSR     PRBYTE
            JSR     NXTA1
            BCC     MOD8CHK
RTS4C       RTS

XAMPM       LSR     A
            BCC     XAM
            LSR     A
            LSR     A
            LDA     *A2L
            BCC     ADD
            EOR     #$FF
ADD         ADC     *A1L
            PHA
            LDA     #$BD
            JSR     COUT
            PLA
PRBYTE      PHA
            LSR     A
            LSR     A
            LSR     A
            LSR     A
            JSR     PRHEXZ
            PLA
PRHEX       AND     #$0F
PRHEXZ      ORA     #$B0
            CMP     #$BA
            BCC     COUT
            ADC     #$06
COUT        JMP     (CSWL)

COUT1       CMP     #$A0
            BCC     COUTZ
            AND     *INVFLG
COUTZ       STY     *YSAV1
            PHA
            JSR     VIDWAIT         ;go check for pause
            PLA
            LDY     *YSAV1
            RTS

BL1         DEC     *YSAV
            BEQ     XAMB
BLANK       DEX
            BNE     SETMDZ
            CMP     #$BA
            BNE     XAMPM
            STA     *MODE
            LDA     *A2L
            STA     (A3L),Y
            INC     *A3L
            BNE     RTS5
            INC     *A3H
RTS5        RTS

; check me
SETMODE     LDY     *YSAV
            LDA     IN-1,Y
SETMDZ      STA     *MODE
            RTS

LT          LDX     #$01
LT2         LDA     *A2L,X
            STA     *A4L,X
            STA     *A5L,X
            DEX
            BPL     LT2
            RTS

MOVE        LDA     (A1L),Y
            STA     (A4L),Y
            JSR     NXTA4
            BCC     MOVE
            RTS

VFY         LDA     (A1L),Y
            CMP     (A4L),Y
            BEQ     VFYOK
            JSR     PRA1
            LDA     (A1L),Y
            JSR     PRBYTE
            LDA     #$A0
            JSR     COUT
            LDA     #$A8
            JSR     COUT
            LDA     (A4L),Y
            JSR     PRBYTE
            LDA     #$A9
            JSR     COUT
VFYOK       JSR     NXTA4
            BCC     VFY
            RTS

LIST        JSR     A1PC
            LDA     #$14
LIST2       PHA
            JSR     INSTDSP
            JSR     PCADJ
            STA     *PCL
            STY     *PCH
            PLA
            SEC
            SBC     #$01
            BNE     LIST2
            RTS

A1PC        TXA
            BEQ     A1PCRTS
A1PCLP      LDA     *A1L,X
            STA     *PCL,X
            DEX
            BPL     A1PCLP
A1PCRTS     RTS

SETINV      LDY     #$3F
            BNE     SETIFLG

SETNORM     LDY     #$FF
SETIFLG     STY     *INVFLG
            RTS

SETKBD      LDA     #$00
INPORT      STA     *A2L
INPRT       LDX     #KSWL
            LDY     #<KEYIN
            BNE     IOPRT

SETVID      LDA     #$00
OUTPORT     STA     *A2L
OUTPRT      LDX     #CSWL
            LDY     #<COUT1
IOPRT       LDA     *A2L
            AND     #$0F
            BEQ     IOPRT1
            ORA     #>IOADR
            LDY     #$00
            BEQ     IOPRT2

IOPRT1      LDA     #>COUT1
IOPRT2      STY     *LOC0,X          ;94 00
            STA     *LOC1,X          ;95 01
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

REMOVED     NOP
            NOP
            NOP
            NOP
            NOP
USR         JMP     USRADR

WRITE       LDA     #$40
            JSR     HEADR
            LDY     #$27
WR1         LDX     #$00
            EOR     (A1L,X)
            PHA
            LDA     (A1L,X)
            JSR     WRBYTE
            JSR     NXTA1
            LDY     #$1D
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

;* Clear variables
CHKSUM      EQU   $2E    

CRMON       JSR     BL1
            PLA
            PLA
            BNE     MONZ
READ        JSR     RD2BIT
            LDA     #$16
            JSR     HEADR
            STA     *CHKSUM
            JSR     RD2BIT
RD2         LDY     #$24
            JSR     RDBIT
            BCS     RD2
            JSR     RDBIT
            LDY     #$3B
RD3         JSR     RDBYTE
            STA     (A1L,X)
            EOR     *CHKSUM
            STA     *CHKSUM
            JSR     NXTA1
            LDY     #$35
            BCC     RD3
            JSR     RDBYTE
            CMP     *CHKSUM
            BEQ     BELL
PRERR       LDA     #$C5
            JSR     COUT
            LDA     #$D2
            JSR     COUT
            JSR     COUT
BELL        LDA     #$87
            JMP     COUT

RESTORE     LDA     *STATUS
            PHA
            LDA     *A5H
RESTR1      LDX     *XREG
            LDY     *YREG
            PLP
            RTS
;OK FF4A
SAVE        STA     *A5H
SAV1        STX     *XREG
            STY     *YREG
            PHP
            PLA
            STA     *STATUS
            TSX
            STX     *SPNT
            CLD
            RTS

OLDRST      JSR     SETNORM
            JSR     INIT
            JSR     SETVID
            JSR     SETKBD
MON         CLD
            JSR     BELL
MONZ        LDA     #$AA            ;CALL -151
            STA     *PROMPT
            JSR     GETLNZ
            JSR     ZMODE
NXTITM      JSR     GETNUM
            STY     *YSAV
            LDY     #$17
CHRSRCH     DEY
            BMI     MON
            CMP     CHRTBL,Y
            BNE     CHRSRCH
            JSR     TOSUB
            LDY     *YSAV
            JMP     NXTITM

DIG         LDX     #$03
            ASL     A
            ASL     A
            ASL     A
            ASL     A
NXTBIT      ASL     A
            ROL     *A2L
            ROL     *A2H
            DEX
            BPL     NXTBIT
NXTBAS      LDA     *MODE
            BNE     NXTBS2
            LDA     *A2H,X
            STA     *A1H,X
            STA     *A3H,X
NXTBS2      INX
            BEQ     NXTBAS
            BNE     NXTCHR

GETNUM      LDX     #$00
            STX     *A2L
            STX     *A2H
NXTCHR      LDA     IN,Y
            INY
            EOR     #$B0
            CMP     #$0A
            BCC     DIG
            ADC     #$88
            CMP     #$FA
            BCS     DIG
            RTS

TOSUB       LDA     #>GO
            PHA
            LDA     SUBTBL,Y
            PHA
            LDA     *MODE
ZMODE       LDY     #$00
            STY     *MODE
            RTS

CHRTBL      .BYTE    $BC
            .BYTE    $B2
            .BYTE    $BE
            .BYTE    $B2             ;T CMD now like USR
            .BYTE    $EF
            .BYTE    $C4
            .BYTE    $B2             ;S CMD now like USR
            .BYTE    $A9
            .BYTE    $BB
            .BYTE    $A6
            .BYTE    $A4
            .BYTE    $06
            .BYTE    $95
            .BYTE    $07
            .BYTE    $02
            .BYTE    $05
            .BYTE    $F0
            .BYTE    $00
            .BYTE    $EB
            .BYTE    $93
            .BYTE    $A7
            .BYTE    $C6
            .BYTE    $99
SUBTBL      .BYTE    <BASCONT-1
            .BYTE    <USR-1
            .BYTE    <REGZ-1
            .BYTE    <TRACE-1
            .BYTE    <VFY-1
            .BYTE    <INPRT-1
            .BYTE    <REMOVED-1
            .BYTE    <OUTPRT-1
            .BYTE    <XBASIC-1
            .BYTE    <SETMODE-1
            .BYTE    <SETMODE-1
            .BYTE    <MOVE-1
            .BYTE    <LT-1
            .BYTE    <SETNORM-1
            .BYTE    <SETINV-1
            .BYTE    <LIST-1
            .BYTE    <WRITE-1
            .BYTE    <GO-1
            .BYTE    <READ-1
            .BYTE    <SETMODE-1
            .BYTE    <SETMODE-1
            .BYTE    <CRMON-1
            .BYTE    <BLANK-1
            .WORD    NMI
            .WORD    RESET
            .WORD    OLDRST
