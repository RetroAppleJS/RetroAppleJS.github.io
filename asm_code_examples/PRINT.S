*=$6000
M.PRHEX   = $FDE3   ; print right nibble (A)
M.PRBYTE  = $FDDA   ; print hex byte (A)
M.PRNTX   = $F944   ; print hex byte (X)
M.PRNTYX  = $F940   ; print hex word (Y=hi X=lo)
M.PRNTAX  = $F941   ; print hex word (A=hi X=lo)
M.PRDEC   = $ED24   ; print dec word (A=hi X=lo)
M.CRDO    = $DAFB   ; print line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.STROUT  = $DB3A   ; print string from address (Y=hi A=lo)
M.CBOT    = $FB2F   ; move cursor to bottom
M.UP      = $FC1A   ; move cursor one up
M.ADVANCE = $FBF4   ; move cursor right
M.BS      = $FC10   ; move cursor left
M.LF      = $FC66   ; move cursor down
M.CLREOL  = $FC9C   ; clear text-line from cursor to right
M.CLREOP  = $FC42   ; clear text from cursor to bottom
M.HOME    = $FC58   ; clear text (HOME)
M.KPRESS  = $FD35   ; wait for key press
M.RESTART = $E003   ; restart BASIC
M.PRNTAX  =  $F941   ; print hex word (A=hi X=lo)
MD1       =  $FBA4
ACL       =  $50
ACH       =  $51
XTNDL     =  $52
XTNDH     =  $53
AUXL      =  $54
AUXH      =  $55

S0.TA        = $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS


        LDA #$02
        JSR ISTROUT       ; PRINT INDEX-BASED STRING (A=INDEX)
        LDA #$02
        JSR M.PRBYTE      ; PRINT BYTE (A)
        JSR M.CRDO        ; PRINT LINEFEED

        LDY #>STR.00
        LDA #<STR.00
        JSR M.STROUT      ; PRINT POINTER-BASED STRING (Y=HI A=LO)

        LDA #$01
        JSR ISTROUT
        LDA #>ISTROUT
        LDX #<ISTROUT
        JSR M.PRNTAX      ; PRINT HEX WORD (A=HI X=LO)

        LDA #'>'
        JSR M.COUT        ; PRINT CHARACTER (A)

        LDA #>ISTROUT
        LDX #<ISTROUT
        JSR M.PRDEC       ; PRINT DEC WORD (A=HI X=LO)

        LDA #'>'
        JSR M.COUT
        LDA #'%'
        JSR M.COUT

        LDA #>ISTROUT
        JSR PRBITS
        LDX #<ISTROUT
        JSR PRBITS
        JSR M.CRDO

        JSR M.CRDO
        LDA #$03
        JSR ISTROUT


TST     LDA #$00        ; A = INDEX
TST.0   JSR FNTADR      ; calculate font address pointer (*S0.TX=lo *S0.TY=hi)
        JSR TXTFNT      ; display font in text format
        LDA #$04        
        JSR ISTROUT     ; display description
        LDA FNTD+2
        JSR M.PRBYTE    ; display ASCII value in HEX

        JSR M.KPRESS
        CMP #'X'
        BEQ TST.2       ; EXIT
        INC FNTD+2      ; Increment ASCII code
        JSR X4UP        ; move cursor 8x up
        JSR X4UP
        LDA FNTD+2
        AND #$7F        ; loop until ASCII F7 -> 00    
        BNE TST.0
        JMP TST.0
TST.2   RTS

FNTADR   STA FNTD+2     ; FONT INDEX
         STA *ACL
         LDA #$08
         STA *AUXL         

         LDA #>FIIca
         STA *XTNDH
         LDA #<FIIca
         STA *XTNDL

         LDA #$00
         STA *ACH
         STA *AUXH

         JSR MUL         ; ACX * AUX + XTND  =  XTND,AC

         LDY *ACH
         DEY
         STY *S0.TY      ; hi-bytes
         LDX *ACL
         STX *S0.TX      ; lo-bytes
         RTS

; ---  TEXT FONT PRINTING ---
TXTFNT  LDA #$FF
        STA FNTD        ;  Initialize Font Y-coordinate
FNT.01  JSR M.CRDO
        LDY FNTD
        JSR FNT.03
        STY FNTD
        JSR PRBPAT      ; Print bit pattern
        TYA
        AND #$07
        EOR #$07
        BNE FNT.01
        RTS
; ------------------

FNT.03  INY
        BNE FNT.05
        INC *S0.TY
FNT.05  LDA (S0.TX),Y   ; font data pointer
        RTS     

FNTD    HEX 000000

; *** MOVE CURSOR UP 4 LINNES
X4UP    JSR M.UP        ; move cursor four up
        JSR M.UP
        JSR M.UP
        JSR M.UP
        RTS 

; *** MULTIPLY 16x16 + 16 = 32
; AC * AUX + XTND  = XTND, AC
MUL         LDY     #$10            ;INDEX FOR 16 BITS
MUL2        LDA     *ACL            ;ACX * AUX + XTND
            LSR     A               ;  TO AC, XTND
            BCC     MUL4            ;IF NO CARRY,
            CLC                     ;  NO PARTIAL PROD.
            LDX     #$FE
MUL3        LDA     *XTNDL+2,X      ;ADD MPLCND (AUX)
            ADC     *AUXL+2,X       ; TO PARTIAL PROD
            STA     *XTNDL+2,X      ;    (XTND).
            INX
            BNE     MUL3
MUL4        LDX     #$03
MUL5        ROR     *ACL,X          ;(ORIGINAL SRC: DFB #$76, DFB #$50)
            DEX
            BPL     MUL5
            DEY
            BNE     MUL2
            RTS
;MUL6        LDA #$00  ; turn all fields to zero
;            LDY #$05
;MUL7        DEY
;            STA (ACL),Y
;            BNE MUL7
;            RTS
                        

; *** PRINT 8 BITS ***
; *** A = BYTE     ***
PRBITS  LDX #$08
        STA PRBD
PRB.0   ROL PRBD
        LDA #'0'
        ADC #$00
PRB.1   JSR M.COUT
        DEX
        BNE PRB.0
        RTS
PRBD    HEX 00

; *** PRINT 8 BIT PATTERN (REVERSE DIRECTION) ***
; *** A = BYTE     ***
PRBPAT  STA PBPD
        LDA #$08
        STA PBPD+1
PBP.0   ROR PBPD
PBP.1   LDA #$20        ; active bit
        BCS PBP.3
PBP.2   LDA #'L'        ; inactive bit
PBP.3   JSR M.COUT
        DEC PBPD+1
        BNE PBP.0
        RTS
PBPD    HEX 0008

; *** PRINT INDEX-BASED  STRING ***
; *** A = INDEX     (41 Bytes)  ***
ISTROUT TAX           ; INDEX-BASED STRING OUT A=INDEX
        LDY #>STR.00
        LDA #<STR.00
IST.00  STA *$AB
        DEY
        STY *$AC
        LDY #$FF
        CPX #$00
        BEQ IST.02
IST.01  JSR IST.03
        BNE IST.01     ; encounter zero value ?
        DEX
        BNE IST.01     ; encounter zero counter ?
IST.02  JSR IST.03
        BEQ IST.06     ; encounter zero value ?
        JSR M.COUT
        BCC IST.02     ; usually carry is clear (=unconditional jump)
IST.03  INY
        BNE IST.05
        INC *$AC
IST.05  LDA ($AB),Y
IST.06  RTS

; - - - - - - - - - - - - - - - - - - -

; STRING DATA
STR.00  HEX 8D
        ASC "POINTER-BASED PRINTING"
        HEX 8D
        ASC "& MULTILINE"
        HEX 8D8D00
STR.01  ASC "M.STROUT:$"
        HEX 00
STR.02  ASC "INDEX-BASED PRINTING A="
        HEX 00
STR.03  ASC "SCREEN FONT (X:EXIT)"
        HEX 00
STR.04  ASC " ASCII:$"
        HEX 00

; Apple IIc alternate - 128 characters
FIIca HEX   1008367F3F3F7E36 ;'@'^  $00
      HEX   1008364121214A36 ;'A'^
      HEX   000002060E1E3642 ;'B'^
      HEX   7F22140808142A7F ;'C'^
      HEX   004020110A040400 ;'D'^
      HEX   7F3F5F6C757B7B7F ;'E'^
      HEX   70607E3179303F02 ;'F'^
      HEX   00180700070C0870 ;'G'^
      HEX   0804027F02040800 ;'H'^
      HEX   000000000000002A ;'I'^
      HEX   08080808492A1C08 ;'J'^
      HEX   081C2A4908080808 ;'K'^
      HEX   7F00000000000000 ;'L'^
      HEX   40404044467F0604 ;'M'^
      HEX   3F3F3F3F3F3F3F3F ;'N'^
      HEX   13181C7E1C18106F ;'O'^
      HEX   640C1C3F1C0C047B ;'P'^  $10
      HEX   4048087F3E1C4840 ;'Q'^
      HEX   40481C3E7F084840 ;'R'^
      HEX   0000007F00000000 ;'S'^
      HEX   010101010101017F ;'T'^
      HEX   0810207F20100800 ;'U'^
      HEX   2A552A552A552A55 ;'V'^
      HEX   552A552A552A552A ;'W'^
      HEX   003E410101017F00 ;'X'^
      HEX   00003F4040407F00 ;'Y'^
      HEX   4040404040404040 ;'Z'^
      HEX   081C3E7F3E1C0800 ;'['^
      HEX   7F0000000000007F ;'\'^
      HEX   1414770077141400 ;']'^
      HEX   7F40404C4C40407F ;'^'^
      HEX   0101010101010101 ;'_'^
      HEX   0000000000000000 ;'     $20
      HEX   0808080808000800 ;'!
      HEX   1414140000000000 ;'"
      HEX   14143E143E141400 ;'#
      HEX   083C0A1C281E0800 ;'
      HEX   0626100804323000 ;'%
      HEX   040A0A042A122C00 ;'&
      HEX   0808080000000000 ;''
      HEX   0804020202040800 ;'(
      HEX   0810202020100800 ;')
      HEX   082A1C081C2A0800 ;'*
      HEX   0008083E08080000 ;'+
      HEX   0000000008080400 ;',
      HEX   0000003E00000000 ;'-
      HEX   0000000000000800 ;'.
      HEX   0020100804020000 ;'/
      HEX   1C22322A26221C00 ;'0    $30
      HEX   080C080808081C00 ;'1
      HEX   1C22201804023E00 ;'2
      HEX   3E20101820221C00 ;'3
      HEX   101814123E101000 ;'4
      HEX   3E021E2020221C00 ;'5
      HEX   3804021E22221C00 ;'6
      HEX   3E20100804040400 ;'7
      HEX   1C22221C22221C00 ;'8
      HEX   1C22223C20100E00 ;'9
      HEX   0000080008000000 ;':
      HEX   0000080008080400 ;';
      HEX   1008040204081000 ;'<
      HEX   00003E003E000000 ;'=
      HEX   0408102010080400 ;'>
      HEX   1C22100808000800 ;'?
      HEX   1C222A3A1A023C00 ;'@    $40
      HEX   081422223E222200 ;'A
      HEX   1E22221E22221E00 ;'B
      HEX   1C22020202221C00 ;'C
      HEX   1E22222222221E00 ;'D
      HEX   3E02021E02023E00 ;'E
      HEX   3E02021E02020200 ;'F
      HEX   3C02020232223C00 ;'G
      HEX   2222223E22222200 ;'H
      HEX   1C08080808081C00 ;'I
      HEX   2020202020221C00 ;'J
      HEX   22120A060A122200 ;'K
      HEX   0202020202023E00 ;'L
      HEX   22362A2A22222200 ;'M
      HEX   2222262A32222200 ;'N
      HEX   1C22222222221C00 ;'O
      HEX   1E22221E02020200 ;'P    $50
      HEX   1C2222222A122C00 ;'Q
      HEX   1E22221E0A122200 ;'R
      HEX   1C22021C20221C00 ;'S
      HEX   3E08080808080800 ;'T
      HEX   2222222222221C00 ;'U
      HEX   2222222222140800 ;'V
      HEX   2222222A2A362200 ;'W
      HEX   2222140814222200 ;'X
      HEX   2222140808080800 ;'Y
      HEX   3E20100804023E00 ;'Z
      HEX   3E06060606063E00 ;'[
      HEX   0002040810200000 ;'\
      HEX   3E30303030303E00 ;']
      HEX   0000081422000000 ;'^
      HEX   000000000000007F ;'_
      HEX   0408100000000000 ;'`    $60
      HEX   00001C203C223C00 ;'a
      HEX   02021E2222221E00 ;'b
      HEX   00003C0202023C00 ;'c
      HEX   20203C2222223C00 ;'d
      HEX   00001C223E023C00 ;'e
      HEX   1824041E04040400 ;'f
      HEX   00001C22223C201C ;'g
      HEX   02021E2222222200 ;'h
      HEX   08000C0808081C00 ;'i
      HEX   100018101010120C ;'j
      HEX   020222120E122200 ;'k
      HEX   0C08080808081C00 ;'l
      HEX   0000362A2A2A2200 ;'m
      HEX   00001E2222222200 ;'n
      HEX   00001C2222221C00 ;'o
      HEX   00001E22221E0202 ;'p    $70
      HEX   00003C22223C2020 ;'q
      HEX   00003A0602020200 ;'r
      HEX   00003C021C201E00 ;'s
      HEX   04041E0404241800 ;'t
      HEX   0000222222322C00 ;'u
      HEX   0000222222140800 ;'v
      HEX   000022222A2A3600 ;'w
      HEX   0000221408142200 ;'x
      HEX   00002222223C201C ;'y
      HEX   00003E1008043E00 ;'z
      HEX   380C0C060C0C3800 ;'{
      HEX   0808080808080808 ;'|
      HEX   0E18183018180E00 ;'}
      HEX   2C1A000000000000 ;'~
      HEX   002A142A142A0000 ;'*