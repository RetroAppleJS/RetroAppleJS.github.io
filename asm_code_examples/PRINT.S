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
        LDA #$03
        JSR ISTROUT      

        ; A = INDEX
FNT.00 STA FNTD 
        LDY #>FONT
        LDA #<FONT

        STA *S0.TX
        DEY
        STY *S0.TY
        LDY #$FF
        STY FNTD

        LDA #' '
        STA PRBD
        LDA #$20  

        LDA #$00
        STA FNTD+1      

FNT.01  NOP
        LDY FNTD
        JSR FNT.03
        STY FNTD
        JSR PRBPAT 
        JSR M.CRDO

        TYA
        AND #$07
        EOR #$07
        BNE FNT.01

        LDA #$04        ; PRINT ASCII VALUE
        JSR ISTROUT
        LDA FNTD+1
        JSR M.PRBYTE
        LDA #'>'
        JSR M.COUT
        LDA #$00
        LDX FNTD+1
        JSR M.PRDEC
        JSR M.CRDO
        INC FNTD+1

        JSR M.KPRESS
        CMP #'X'
        BEQ FNT.07      ; EXIT
        JSR FNT.06      ; move cursor 2x4 up
        JSR FNT.06
        JSR M.UP

FNT.02  JMP FNT.01

FNT.03  INY
        BNE FNT.05
        INC *S0.TY
FNT.05  LDA (S0.TX),Y
        RTS
FNT.06  JSR M.UP        ; move cursor four up
        JSR M.UP
        JSR M.UP
        JSR M.UP
FNT.07  RTS
FNTD    HEX 0000


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

; *** PRINT 8 BIT PATTERN ***
; *** A = BYTE     ***

PRBPAT  STA PBPD
        LDA #$08
        STA PBPD+1
PBP.0   ROR PBPD
        LDA #$20
        BCS PBP.1
        LDA #' '
PBP.1   JSR M.COUT
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
STR.03  ASC "SCREEN FONT (X:EXIT ANY-KEY:NEXT)"
        HEX 8D00
STR.04  ASC "ASCII:$"
        HEX 00

; 128 characters - 
FONT  HEX   1008367F3F3F7E36 ;'@'^ 
      HEX   1008364121214A36 ;'A'^
      HEX   000002060E1E3642 ;'B'^
      HEX   7F22140808142A7F ;'C'^
      HEX   004020110A040400 ;'D'^
      HEX   7F3F5F6C757B7B7F ;'E'^
      HEX   70607E3179303F02 ;'F'^ ??
      HEX   00180700070C0870 ;'G'^
      HEX   0804027F02040800 ;'H'^
      HEX   000000000000002A ;'I'^
      HEX   08080808492A1C08 ;'J'^
      HEX   081C2A4908080808 ;'K'^
      HEX   7F00000000000000 ;'L'^
      HEX   40404044467F0604 ;'M'^
      HEX   3F3F3F3F3F3F3F3F ;'N'^
      HEX   13181C7E1C18106F ;'O'^
      HEX   640C1C3F1C0C047B ;'P'^
      HEX   4048087F3E1C4840 ;'Q'^
      HEX   40481C3E7E084840 ;'R'^  DEBUG!
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
      HEX   0000000000000000 ;'
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
      HEX   1C22322A26221C00 ;'0
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
      HEX   1C222A3A1A023C00 ;'@
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
      HEX   1E22221E02020200 ;'P
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
      HEX   0408100000000000 ;'`
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
      HEX   00001E22221E0202 ;'p
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