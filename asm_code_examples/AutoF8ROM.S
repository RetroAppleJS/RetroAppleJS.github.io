********************************************************************************
* Apple II                                                                     *
* Monitor II                                                                   *
*                                                                              *
* Copyright 1978 by Apple Computer, Inc                                        *
* All Rights Reserved                                                          *
*                                                                              *
* Steve Wozniak                                                                *
********************************************************************************
* Modified Nov 1978                                                            *
* By John A                                                                    *
********************************************************************************
* This is a disassembly of the updated monitor ROM found in the Apple ][+.     *
* The labels and comments come from "Autostart ROM Listing" in the Apple II    *
* Reference Manual (starts page 136).  This is a fairly direct translation --  *
* operands are generally formatted as they appear in the original listing.     *
* Comments have been converted to mixed-case, but are otherwise unchanged.     *
********************************************************************************
* Project created by Andy McFadden, using 6502bench SourceGen v1.4.            *
* Last updated 2019/09/22                                                      *
********************************************************************************
IOADR       .eq     $c000  {const}
LOC0        .eq     $00
LOC1        .eq     $01
WNDLFT      .eq     $20
WNDWDTH     .eq     $21
WNDTOP      .eq     $22
WNDBTM      .eq     $23
CH          .eq     $24
CV          .eq     $25
GBASL       .eq     $26
GBASH       .eq     $27
BASL        .eq     $28
BASH        .eq     $29
BAS2L       .eq     $2a
BAS2H       .eq     $2b
COLOR       .eq     $30
MODE        .eq     $31
INVFLG      .eq     $32
PROMPT      .eq     $33
YSAV        .eq     $34
YSAV1       .eq     $35
CSWL        .eq     $36
KSWL        .eq     $38
PCL         .eq     $3a
PCH         .eq     $3b
A1L         .eq     $3c
A1H         .eq     $3d
A2L         .eq     $3e
A2H         .eq     $3f
A3L         .eq     $40
A3H         .eq     $41
A4L         .eq     $42
A4H         .eq     $43
A5L         .eq     $44
A5H         .eq     $45
ACC         .eq     $45             ;note overlap with A5H!
XREG        .eq     $46
YREG        .eq     $47
STATUS      .eq     $48
SPNT        .eq     $49
RNDL        .eq     $4e
RNDH        .eq     $4f
IN          .eq     $0200  {addr/256}
BRKV        .eq     $03f0  {addr/2} ;new vector for BRK
SOFTEV      .eq     $03f2  {addr/2} ;vector for warm start
PWREDUP     .eq     $03f4           ;this must = EOR #$A5 of SOFTEV+1
USRADR      .eq     $03f8  {addr/3}
NMI         .eq     $03fb  {addr/3}
IRQLOC      .eq     $03fe  {addr/2}
LINE1       .eq     $0400  {addr/40}
MSLOT       .eq     $07f8
KBD         .eq     $c000           ;R last key pressed + 128
KBDSTRB     .eq     $c010           ;RW keyboard strobe
TAPEOUT     .eq     $c020           ;RW toggle caseette tape output
SPKR        .eq     $c030           ;RW toggle speaker
TXTCLR      .eq     $c050           ;RW display graphics
TXTSET      .eq     $c051           ;RW display text
MIXSET      .eq     $c053           ;RW display split screen
TXTPAGE1    .eq     $c054           ;RW display page 1
LORES       .eq     $c056           ;RW display lo-res graphics
SETAN0      .eq     $c058           ;RW annunciator 0 off
SETAN1      .eq     $c05a           ;RW annunciator 1 off
CLRAN2      .eq     $c05d           ;RW annunciator 2 on
CLRAN3      .eq     $c05f           ;RW annunciator 3 on
TAPEIN      .eq     $c060
PADDL0      .eq     $c064           ;R analog input 0
PTRIG       .eq     $c070           ;RW analog input reset
CLRROM      .eq     $cfff           ;disable slot C8 ROM
BASIC       .eq     $e000
BASIC2      .eq     $e003

            .org    $f800
H2          .var    $2c    {addr/1}
V2          .var    $2d    {addr/1}
MASK        .var    $2e    {addr/1}

PLOT        lsr     A
            php
            jsr     GBASCALC
            plp
            lda     #$0f
            bcc     RTMASK
            adc     #$e0
RTMASK      sta     MASK
PLOT1       lda     (GBASL),y
            eor     COLOR
            and     MASK
            eor     (GBASL),y
            sta     (GBASL),y
            rts

HLINE       jsr     PLOT
HLINE1      cpy     H2
            bcs     RTS1
            iny
            jsr     PLOT1
            bcc     HLINE1
VLINEZ      adc     #$01
VLINE       pha
            jsr     PLOT
            pla
            cmp     V2
            bcc     VLINEZ
RTS1        rts

CLRSCR      ldy     #$2f
            bne     CLRSC2

CLRTOP      ldy     #$27
CLRSC2      sty     V2
            ldy     #$27
CLRSC3      lda     #$00
            sta     COLOR
            jsr     VLINE
            dey
            bpl     CLRSC3
            rts

GBASCALC    pha
            lsr     A
            and     #$03
            ora     #$04
            sta     GBASH
            pla
            and     #$18
            bcc     GBCALC
            adc     #$7f
GBCALC      sta     GBASL
            asl     A
            asl     A
            ora     GBASL
            sta     GBASL
            rts

NEXTCOL     lda     COLOR
            clc
            adc     #$03
SETCOL      and     #$0f
            sta     COLOR
            asl     A
            asl     A
            asl     A
            asl     A
            ora     COLOR
            sta     COLOR
            rts

SCRN        lsr     A
            php
            jsr     GBASCALC
            lda     (GBASL),y
            plp
SCRN2       bcc     RTMSKZ
            lsr     A
            lsr     A
            lsr     A
            lsr     A
RTMSKZ      and     #$0f
            rts

• Clear variables
LMNEM       .var    $2c    {addr/1}
RMNEM       .var    $2d    {addr/1}
FORMAT      .var    $2e    {addr/1}
LENGTH      .var    $2f    {addr/1}

INSDS1      ldx     PCL
            ldy     PCH
            jsr     PRYX2
            jsr     PRBLNK
            lda     (PCL,x)
            tay
            lsr     A
            bcc     IEVEN
            ror     A
            bcs     ERR
            cmp     #$a2
            beq     ERR
            and     #$87
IEVEN       lsr     A
            tax
            lda     FMT1,x
            jsr     SCRN2
            bne     GETFMT
ERR         ldy     #$80
            lda     #$00
GETFMT      tax
            lda     FMT2,x
            sta     FORMAT
            and     #$03
            sta     LENGTH
            tya
            and     #$8f
            tax
            tya
            ldy     #$03
            cpx     #$8a
            beq     MNNDX3
MNNDX1      lsr     A
            bcc     MNNDX3
            lsr     A
MNNDX2      lsr     A
            ora     #$20
            dey
            bne     MNNDX2
            iny
MNNDX3      dey
            bne     MNNDX1
            rts

            .fill   3,$ff

INSTDSP     jsr     INSDS1
            pha
PRNTOP      lda     (PCL),y
            jsr     PRBYTE
            ldx     #$01
PRNTBL      jsr     PRBL2
            cpy     LENGTH
            iny
            bcc     PRNTOP
            ldx     #$03
            cpy     #$04
            bcc     PRNTBL
            pla
            tay
            lda     MNEML,y
            sta     LMNEM
            lda     MNEMR,y
            sta     RMNEM
NXTCOL      lda     #$00
            ldy     #$05
PRMN2       asl     RMNEM
            rol     LMNEM
            rol     A
            dey
            bne     PRMN2
            adc     #$bf
            jsr     COUT
            dex
            bne     NXTCOL
            jsr     PRBLNK
            ldy     LENGTH
            ldx     #$06
PRADR1      cpx     #$03
            beq     PRADR5
PRADR2      asl     FORMAT
            bcc     PRADR3
            lda     CHAR1-1,x
            jsr     COUT
            lda     CHAR2-1,x
            beq     PRADR3
            jsr     COUT
PRADR3      dex
            bne     PRADR1
            rts

PRADR4      dey
            bmi     PRADR2
            jsr     PRBYTE
PRADR5      lda     FORMAT
            cmp     #$e8
            lda     (PCL),y
            bcc     PRADR4
RELADR      jsr     PCADJ3
            tax
            inx
            bne     PRNTYX
            iny
PRNTYX      tya
PRNTAX      jsr     PRBYTE
PRNTX       txa
            jmp     PRBYTE

PRBLNK      ldx     #$03
PRBL2       lda     #$a0
            jsr     COUT
            dex
            bne     PRBL2
            rts

PCADJ       sec
PCADJ2      lda     LENGTH
PCADJ3      ldy     PCH
            tax
            bpl     PCADJ4
            dey
PCADJ4      adc     PCL
            bcc     RTS2
            iny
RTS2        rts

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

IRQ         sta     ACC
            pla
            pha
            asl     A
            asl     A
            asl     A
            bmi     BREAK
            jmp     (IRQLOC)

BREAK       plp
            jsr     SAV1
            pla
            sta     PCL
            pla
            sta     PCH
            jmp     (BRKV)          ;BRKV written over by disk boot

OLDBRK      jsr     INSDS1
            jsr     RGDSP1
            jmp     MON

RESET       cld                     ;do this first this time
            jsr     SETNORM
            jsr     INIT
            jsr     SETVID
            jsr     SETKBD
            lda     SETAN0          ;AN0 = TTL hi
            lda     SETAN1          ;AN1 = TTL hi
            lda     CLRAN2          ;AN2 = TTL lo
            lda     CLRAN3          ;AN3 = TTL lo
            lda     CLRROM          ;turn off extension ROM
            bit     KBDSTRB         ;clear keyboard
            cld
            jsr     BELL            ;causes delay if key bounces
            lda     SOFTEV+1        ;is reset hi
            eor     #$a5            ;a funny complement of the
            cmp     PWREDUP         ;pwr up byte ???
            bne     PWRUP           ;no so pwrup
            lda     SOFTEV          ;yes see if cold start
            bne     NOFIX           ;has been done yet?
            lda     #$e0            ;??
            cmp     SOFTEV+1        ;??
            bne     NOFIX           ;yes so reenter system
FIXSEV      ldy     #$03            ;no so point at warm start
            sty     SOFTEV          ;for next reset
            jmp     BASIC           ;and do the cold start

NOFIX       jmp     (SOFTEV)        ;soft entry vector

; ********************
PWRUP       jsr     APPLEII
SETPG3      ldx     #$05            ;set page 3 vectors
LFAAB       lda     PWRCON-1,x      ;with cntrl B adrs
            sta     BRKV-1,x        ;of current BASIC
            dex
            bne     LFAAB
            lda     #$c8            ;load hi slot +1
            stx     LOC0            ;SETPG3 must return X=0
            sta     LOC1            ;set ptr H
SLOOP       ldy     #$07            ;Y is byte ptr
            dec     LOC1
            lda     LOC1
            cmp     #$c0            ;at last slot yet?
            beq     FIXSEV          ;yes and it cant be a disk
            sta     MSLOT
NXTBYT      lda     (LOC0),y        ;fetch a slot byte
            cmp     DISKID-1,y      ;is it a disk ??
            bne     SLOOP           ;no so next slot down
            dey
            dey                     ;yes so check next byte
            bpl     NXTBYT          ;until 4 checked
            jmp     (LOC0)

            nop
            nop
; REGDSP must ORG $FAD7
REGDSP      jsr     CROUT
RGDSP1      lda     #$45
            sta     A3L
            lda     #$00
            sta     A3H
            ldx     #$fb
RDSP1       lda     #$a0
            jsr     COUT
            lda     RTBL-251,x
            jsr     COUT
            lda     #$bd
            jsr     COUT
            lda     ACC+5,x         ;(this is DFB $B5,$4A in listing)
            jsr     PRBYTE
            inx
            bmi     RDSP1
            rts

PWRCON      .dd2    OLDBRK
            .bulk   $00,$e0,$45
DISKID      .bulk   $20,$ff,$00,$ff,$03,$ff,$3c
TITLE       .str    “APPLE ][”
XLTBL       .bulk   $c4,$c2,$c1,$ff,$c3,$ff,$ff,$ff
; must ORG $FB19
RTBL        .str    “AXYPS”

PREAD       lda     PTRIG
            ldy     #$00
            nop
            nop
PREAD2      lda     PADDL0,x
            bpl     RTS2D
            iny
            bne     PREAD2
            dey
RTS2D       rts

INIT        lda     #$00
            sta     STATUS
            lda     LORES
            lda     TXTPAGE1
SETTXT      lda     TXTSET
            lda     #$00
            beq     SETWND

SETGR       lda     TXTCLR
            lda     MIXSET
            jsr     CLRTOP
            lda     #$14
SETWND      sta     WNDTOP
            lda     #$00
            sta     WNDLFT
            lda     #$28
            sta     WNDWDTH
            lda     #$18
            sta     WNDBTM
            lda     #$17
TABV        sta     CV
            jmp     VTAB

APPLEII     jsr     HOME            ;clear the scrn
            ldy     #$08
STITLE      lda     TITLE-1,y       ;get a char
            sta     LINE1+14,y
            dey
            bne     STITLE
            rts

SETPWRC     lda     SOFTEV+1
            eor     #$a5
            sta     PWREDUP
            rts

VIDWAIT     cmp     #$8d            ;check for a pause only when I have a CR
            bne     NOWAIT          ;no so, do regular
            ldy     KBD             ;is key pressed?
            bpl     NOWAIT          ;no
            cpy     #$93            ;is it ctl S?
            bne     NOWAIT          ;no so ignore
            bit     KBDSTRB         ;clear strobe
KBDWAIT     ldy     KBD             ;wait till next key to resume
            bpl     KBDWAIT         ;wait for keypress
            cpy     #$83            ;is it control C ?
            beq     NOWAIT          ;yes so leave it
            bit     KBDSTRB         ;clr strobe
NOWAIT      jmp     VIDOUT          ;do as before

ESCOLD      sec                     ;insure carry set
            jmp     ESC1

ESCNOW      tay                     ;use char as index
            lda     XLTBL-201,y     ;xlate IJKM to CBAD
            jsr     ESCOLD          ;do this cursor motion
            jsr     RDKEY           ;and get next
ESCNEW      cmp     #$ce            ;is this an N ?
            bcs     ESCOLD          ;N or greater do it
            cmp     #$c9            ;less than I ?
            bcc     ESCOLD          ;yes so old way
            cmp     #$cc            ;is it a L ?
            beq     ESCOLD          ;do normal
            bne     ESCNOW          ;go do it

            .bulk   $ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea,$ea ;padding

; must ORG $FBC1
BASCALC     pha
            lsr     A
            and     #$03
            ora     #$04
            sta     BASH
            pla
            and     #$18
            bcc     BASCLC2
            adc     #$7f
BASCLC2     sta     BASL
            asl     A
            asl     A
            ora     BASL
            sta     BASL
            rts

BELL1       cmp     #$87
            bne     RTS2B
            lda     #$40
            jsr     WAIT
            ldy     #$c0
BELL2       lda     #$0c
            jsr     WAIT
            lda     SPKR
            dey
            bne     BELL2
RTS2B       rts

STORADV     ldy     CH
            sta     (BASL),y
ADVANCE     inc     CH
            lda     CH
            cmp     WNDWDTH
            bcs     CR
RTS3        rts

VIDOUT      cmp     #$a0
            bcs     STORADV
            tay
            bpl     STORADV
            cmp     #$8d
            beq     CR
            cmp     #$8a
            beq     LF
            cmp     #$88
            bne     BELL1
BS          dec     CH
            bpl     RTS3
            lda     WNDWDTH
            sta     CH
            dec     CH
UP          lda     WNDTOP
            cmp     CV
            bcs     RTS4
            dec     CV
VTAB        lda     CV
VTABZ       jsr     BASCALC
            adc     WNDLFT
            sta     BASL
RTS4        rts

ESC1        eor     #$c0            ;esc @ ?
            beq     HOME            ;if so do home and clear
            adc     #$fd            ;esc-A or B check
            bcc     ADVANCE         ;A, advance
            beq     BS              ;B, backspace
            adc     #$fd            ;esc-C or D check
            bcc     LF              ;C, down
            beq     UP              ;D, go up
            adc     #$fd            ;esc-E or F check
            bcc     CLREOL          ;E, clear to end of line
            bne     RTS4            ;else not F, return
CLREOP      ldy     CH              ;esc F is clr to end of page
            lda     CV
CLEOP1      pha
            jsr     VTABZ
            jsr     CLEOLZ
            ldy     #$00
            pla
            adc     #$00
            cmp     WNDBTM
            bcc     CLEOP1
            bcs     VTAB

HOME        lda     WNDTOP
            sta     CV
            ldy     #$00
            sty     CH
            beq     CLEOP1

CR          lda     #$00
            sta     CH
LF          inc     CV
            lda     CV
            cmp     WNDBTM
            bcc     VTABZ
            dec     CV
SCROLL      lda     WNDTOP
            pha
            jsr     VTABZ
SCRL1       lda     BASL
            sta     BAS2L
            lda     BASH
            sta     BAS2H
            ldy     WNDWDTH
            dey
            pla
            adc     #$01
            cmp     WNDBTM
            bcs     SCRL3
            pha
            jsr     VTABZ
SCRL2       lda     (BASL),y
            sta     (BAS2L),y
            dey
            bpl     SCRL2
            bmi     SCRL1

SCRL3       ldy     #$00
            jsr     CLEOLZ
            bcs     VTAB
CLREOL      ldy     CH
CLEOLZ      lda     #$a0
CLREOL2     sta     (BASL),y
            iny
            cpy     WNDWDTH
            bcc     CLREOL2
            rts

WAIT        sec
WAIT2       pha
WAIT3       sbc     #$01
            bne     WAIT3
            pla
            sbc     #$01
            bne     WAIT2
            rts

NXTA4       inc     A4L
            bne     NXTA1
            inc     A4H
NXTA1       lda     A1L
            cmp     A2L
            lda     A1H
            sbc     A2H
            inc     A1L
            bne     RTS4B
            inc     A1H
RTS4B       rts

HEADR       ldy     #$4b
            jsr     ZERDLY
            bne     HEADR
            adc     #$fe
            bcs     HEADR
            ldy     #$21
WRBIT       jsr     ZERDLY
            iny
            iny
ZERDLY      dey
            bne     ZERDLY
            bcc     WRTAPE
            ldy     #$32
ONEDLY      dey
            bne     ONEDLY
WRTAPE      ldy     TAPEOUT
            ldy     #$2c
            dex
            rts

RDBYTE      ldx     #$08
RDBYT2      pha
            jsr     RD2BIT
            pla
            rol     A
            ldy     #$3a
            dex
            bne     RDBYT2
            rts

• Clear variables
LASTIN      .var    $2f    {addr/1}

RD2BIT      jsr     RDBIT
RDBIT       dey
            lda     TAPEIN
            eor     LASTIN
            bpl     RDBIT
            eor     LASTIN
            sta     LASTIN
            cpy     #$80
            rts

RDKEY       ldy     CH
            lda     (BASL),y
            pha
            and     #$3f
            ora     #$40
            sta     (BASL),y
            pla
            jmp     (KSWL)

KEYIN       inc     RNDL
            bne     KEYIN2
            inc     RNDH
KEYIN2      bit     KBD             ;read keyboard
            bpl     KEYIN
            sta     (BASL),y
            lda     KBD
            bit     KBDSTRB
            rts

ESC         jsr     RDKEY
            jsr     ESCNEW
RDCHAR      jsr     RDKEY
            cmp     #$9b
            beq     ESC
            rts

NOTCR       lda     INVFLG
            pha
            lda     #$ff
            sta     INVFLG
            lda     IN,x
            jsr     COUT
            pla
            sta     INVFLG
            lda     IN,x
            cmp     #$88
            beq     BCKSPC
            cmp     #$98
            beq     CANCEL
            cpx     #$f8
            bcc     NOTCR1
            jsr     BELL
NOTCR1      inx
            bne     NXTCHAR
CANCEL      lda     #$dc
            jsr     COUT
GETLNZ      jsr     CROUT
GETLN       lda     PROMPT
            jsr     COUT
GETLN1      ldx     #$01
BCKSPC      txa
            beq     GETLNZ
            dex
NXTCHAR     jsr     RDCHAR
            cmp     #$95
            bne     CAPTST
            lda     (BASL),y
CAPTST      cmp     #$e0
            bcc     ADDINP
            and     #$df            ;shift to upper case
ADDINP      sta     IN,x
            cmp     #$8d
            bne     NOTCR
CROUT1      jsr     CLREOL
CROUT       lda     #$8d
            bne     COUT

PRA1        ldy     A1H
            ldx     A1L
PRYX2       jsr     CROUT
            jsr     PRNTYX
            ldy     #$00
            lda     #$ad
            jmp     COUT

XAMB        lda     A1L
            ora     #$07
            sta     A2L
            lda     A1H
            sta     A2H
MOD8CHK     lda     A1L
            and     #$07
            bne     DATAOUT
XAM         jsr     PRA1
DATAOUT     lda     #$a0
            jsr     COUT
            lda     (A1L),y
            jsr     PRBYTE
            jsr     NXTA1
            bcc     MOD8CHK
RTS4C       rts

XAMPM       lsr     A
            bcc     XAM
            lsr     A
            lsr     A
            lda     A2L
            bcc     ADD
            eor     #$ff
ADD         adc     A1L
            pha
            lda     #$bd
            jsr     COUT
            pla
PRBYTE      pha
            lsr     A
            lsr     A
            lsr     A
            lsr     A
            jsr     PRHEXZ
            pla
PRHEX       and     #$0f
PRHEXZ      ora     #$b0
            cmp     #$ba
            bcc     COUT
            adc     #$06
COUT        jmp     (CSWL)

COUT1       cmp     #$a0
            bcc     COUTZ
            and     INVFLG
COUTZ       sty     YSAV1
            pha
            jsr     VIDWAIT         ;go check for pause
            pla
            ldy     YSAV1
            rts

BL1         dec     YSAV
            beq     XAMB
BLANK       dex
            bne     SETMDZ
            cmp     #$ba
            bne     XAMPM
            sta     MODE
            lda     A2L
            sta     (A3L),y
            inc     A3L
            bne     RTS5
            inc     A3H
RTS5        rts

; check me
SETMODE     ldy     YSAV
            lda     IN-1,y
SETMDZ      sta     MODE
            rts

LT          ldx     #$01
LT2         lda     A2L,x
            sta     A4L,x
            sta     A5L,x
            dex
            bpl     LT2
            rts

MOVE        lda     (A1L),y
            sta     (A4L),y
            jsr     NXTA4
            bcc     MOVE
            rts

VFY         lda     (A1L),y
            cmp     (A4L),y
            beq     VFYOK
            jsr     PRA1
            lda     (A1L),y
            jsr     PRBYTE
            lda     #$a0
            jsr     COUT
            lda     #$a8
            jsr     COUT
            lda     (A4L),y
            jsr     PRBYTE
            lda     #$a9
            jsr     COUT
VFYOK       jsr     NXTA4
            bcc     VFY
            rts

LIST        jsr     A1PC
            lda     #$14
LIST2       pha
            jsr     INSTDSP
            jsr     PCADJ
            sta     PCL
            sty     PCH
            pla
            sec
            sbc     #$01
            bne     LIST2
            rts

A1PC        txa
            beq     A1PCRTS
A1PCLP      lda     A1L,x
            sta     PCL,x
            dex
            bpl     A1PCLP
A1PCRTS     rts

SETINV      ldy     #$3f
            bne     SETIFLG

SETNORM     ldy     #$ff
SETIFLG     sty     INVFLG
            rts

SETKBD      lda     #$00
INPORT      sta     A2L
INPRT       ldx     #KSWL
            ldy     #<KEYIN
            bne     IOPRT

SETVID      lda     #$00
OUTPORT     sta     A2L
OUTPRT      ldx     #CSWL
            ldy     #<COUT1
IOPRT       lda     A2L
            and     #$0f
            beq     IOPRT1
            ora     #>IOADR
            ldy     #$00
            beq     IOPRT2

IOPRT1      lda     #>COUT1
IOPRT2      sty     LOC0,x          ;$94,$00
            sta     LOC1,x          ;$95,$01
            rts

            nop
            nop
XBASIC      jmp     BASIC

BASCONT     jmp     BASIC2

GO          jsr     A1PC
            jsr     RESTORE
            jmp     (PCL)

REGZ        jmp     REGDSP

TRACE       rts                     ;TRACE is gone

            nop
STEPZ       rts                     ;STEP is gone

_REMOVED    nop
            nop
            nop
            nop
            nop
USR         jmp     USRADR

WRITE       lda     #$40
            jsr     HEADR
            ldy     #$27
WR1         ldx     #$00
            eor     (A1L,x)
            pha
            lda     (A1L,x)
            jsr     WRBYTE
            jsr     NXTA1
            ldy     #$1d
            pla
            bcc     WR1
            ldy     #$22
            jsr     WRBYTE
            beq     BELL
WRBYTE      ldx     #$10
WRBYT2      asl     A
            jsr     WRBIT
            bne     WRBYT2
            rts

• Clear variables
CHKSUM      .var    $2e    {addr/1}

CRMON       jsr     BL1
            pla
            pla
            bne     MONZ
READ        jsr     RD2BIT
            lda     #$16
            jsr     HEADR
            sta     CHKSUM
            jsr     RD2BIT
RD2         ldy     #$24
            jsr     RDBIT
            bcs     RD2
            jsr     RDBIT
            ldy     #$3b
RD3         jsr     RDBYTE
            sta     (A1L,x)
            eor     CHKSUM
            sta     CHKSUM
            jsr     NXTA1
            ldy     #$35
            bcc     RD3
            jsr     RDBYTE
            cmp     CHKSUM
            beq     BELL
PRERR       lda     #$c5
            jsr     COUT
            lda     #$d2
            jsr     COUT
            jsr     COUT
BELL        lda     #$87
            jmp     COUT

RESTORE     lda     STATUS
            pha
            lda     A5H
RESTR1      ldx     XREG
            ldy     YREG
            plp
            rts

SAVE        sta     A5H
SAV1        stx     XREG
            sty     YREG
            php
            pla
            sta     STATUS
            tsx
            stx     SPNT
            cld
            rts

OLDRST      jsr     SETNORM
            jsr     INIT
            jsr     SETVID
            jsr     SETKBD
MON         cld
            jsr     BELL
MONZ        lda     #$aa            ;CALL -151
            sta     PROMPT
            jsr     GETLNZ
            jsr     ZMODE
NXTITM      jsr     GETNUM
            sty     YSAV
            ldy     #$17
CHRSRCH     dey
            bmi     MON
            cmp     CHRTBL,y
            bne     CHRSRCH
            jsr     TOSUB
            ldy     YSAV
            jmp     NXTITM

DIG         ldx     #$03
            asl     A
            asl     A
            asl     A
            asl     A
NXTBIT      asl     A
            rol     A2L
            rol     A2H
            dex
            bpl     NXTBIT
NXTBAS      lda     MODE
            bne     NXTBS2
            lda     A2H,x
            sta     A1H,x
            sta     A3H,x
NXTBS2      inx
            beq     NXTBAS
            bne     NXTCHR

GETNUM      ldx     #$00
            stx     A2L
            stx     A2H
NXTCHR      lda     IN,y
            iny
            eor     #$b0
            cmp     #$0a
            bcc     DIG
            adc     #$88
            cmp     #$fa
            bcs     DIG
            rts

TOSUB       lda     #>GO
            pha
            lda     SUBTBL,y
            pha
            lda     MODE
ZMODE       ldy     #$00
            sty     MODE
            rts

CHRTBL      .dd1    $bc
            .dd1    $b2
            .dd1    $be
            .dd1    $b2             ;T cmd now like USR
            .dd1    $ef
            .dd1    $c4
            .dd1    $b2             ;S cmd now like USR
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
