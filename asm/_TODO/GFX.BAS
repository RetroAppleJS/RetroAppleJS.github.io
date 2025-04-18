NEW

10 HGR : REM POKE-16302,0
12 H=20
15 TVERT = 100 :POKE 24577,H
20 GOTO 23
21 POKE 24576, PS
22 CALL 24582
23 PS = TVERT
25 POKE 24576,PS
30 CALL 24582
40 FOR DE=1 TO 1: NEXT DE
50 PRINT TVERT
60 TVERT = INT(TVERT + RND(1)*4-1.5) : REM TVERT = PDL(1)
70 IF TVERT>183 THEN TVERT = 183
80 IF TVERT<0 THEN TVERT = 0
110 GOTO 21

CALL -151

6000: 00 00 00 00 00 00 20 43
6008: 60 20 0D 60 60 AC 00 60
6010: 20 2C 60 A2 00 A1 1C 51
6018: 1A 91 1A E6 1C C8 CE 04
6020: 60 D0 F2 EE 00 60 CE 02
6028: 60 D0 E2 60 B9 5E 60 18
6030: 6D 01 60 85 1A B9 1E 61
6038: 85 1B AD 05 60 8D 04 60
6040: A0 00 60 A9 DE 85 1C A9
6048: 61 85 1D A9 08 8D 02 60
6050: A9 09 8D 01 60 A9 03 8D
6058: 04 60 8D 05 60 60 00 00
6060: 00 00 00 00 00 00 80 80
6068: 80 80 80 80 80 80 00 00
6070: 00 00 00 00 00 00 80 80
6078: 80 80 80 80 80 80 00 00
6080: 00 00 00 00 00 00 80 80
6088: 80 80 80 80 80 80 00 00
6090: 00 00 00 00 00 00 80 80
6098: 80 80 80 80 80 80 28 28
60A0: 28 28 28 28 28 28 A8 A8
60A8: A8 A8 A8 A8 A8 A8 28 28
60B0: 28 28 28 28 28 28 A8 A8
60B8: A8 A8 A8 A8 A8 A8 28 28
60C0: 28 28 28 28 28 28 A8 A8
60C8: A8 A8 A8 A8 A8 A8 28 28
60D0: 28 28 28 28 28 28 A8 A8
60D8: A8 A8 A8 A8 A8 A8 50 50
60E0: 50 50 50 50 50 50 D0 D0
60E8: D0 D0 D0 D0 D0 D0 50 50
60F0: 50 50 50 50 50 50 D0 D0
60F8: D0 D0 D0 D0 D0 D0 50 50
6100: 50 50 50 50 50 50 D0 D0
6108: D0 D0 D0 D0 D0 D0 50 50
6110: 50 50 50 50 50 50 D0 D0
6118: D0 D0 D0 D0 D0 D0 20 24
6120: 28 2C 30 34 38 3C 20 24
6128: 28 2C 30 34 38 3C 21 25
6130: 29 2D 31 35 39 3D 21 25
6138: 29 2D 31 35 39 3D 22 26
6140: 2A 2E 32 36 3A 3E 22 26
6148: 2A 2E 32 36 3A 3E 23 27
6150: 2B 2F 33 37 3B 3F 23 27
6158: 2B 2F 33 37 3B 3F 20 24
6160: 28 2C 30 34 38 3C 20 24
6168: 28 2C 30 34 38 3C 21 25
6170: 29 2D 31 35 39 3D 21 25
6178: 29 2D 31 35 39 3D 22 26
6180: 2A 2E 32 36 3A 3E 22 26
6188: 2A 2E 32 36 3A 3E 23 27
6190: 2B 2F 33 37 3B 3F 23 27
6198: 2B 2F 33 37 3B 3F 20 24
61A0: 28 2C 30 34 38 3C 20 24
61A8: 28 2C 30 34 38 3C 21 25
61B0: 29 2D 31 35 39 3D 21 25
61B8: 29 2D 31 35 39 3D 22 26
61C0: 2A 2E 32 36 3A 3E 22 26
61C8: 2A 2E 32 36 3A 3E 23 27
61D0: 2B 2F 33 37 3B 3F 23 27
61D8: 2B 2F 33 37 3B 3F 80 00
61E0: 00 82 00 00 82 00 00 8A
61E8: 00 00 AA D5 80 AA 95 82
61F0: AA D5 8A A8 D5 AA

E003G

------


; ****** CODE FOR XOR SHIP ******

ORG $6000
TVERT HEX 00
HORIZ HEX 00
DEPTH HEX 00
LNGH  HEX 00
SLNGH HEX 00
TEMP  HEX 00
HIRESL = $1A
HIRESH = $1B
SSHPL  = $1C
SSHPH  = $1D

START   JSR SSETUP
        JSR SXDRW
        RTS
SXDRW   LDY TVERT       ; PADDLE VALUE
        JSR GETADR
        LDX #$00        ;NEED 0 IN X REG. FOR INDEX
SXDRW2  LDA (SSHPL,X)   ;L0AD BYTE FROM SHAPE TABLE
        EOR (HIRESL),Y  ;EOR IT AGAINST SCREEN
        STA (HIRESL),Y  ;STORE RESULT ON SCREEN
        INC *SSHPL      ;NEXT BYTE IN SHAPE TABLE
        INY             ;NEXT SCREEN POSITION IN ROW
        DEC SLNGH       ;DECREMENT WIDTH
        BNE SXDRW2      ;FINISHED WITH ROW?
        INC TVERT       ;IF SO, INCREMENT TO NEXT Lit*
        DEC DEPTH       ;DECREMENT ROW
        BNE SXDRW       ;FINISHED ALL ROWS?
        RTS
GETADR  LDA YVERTL,Y
        CLC
        ADC HORIZ
        STA *HIRESL
        LDA YVERTH,Y
        STA *HIRESH
        LDA TEMP
        STA SLNGH
        LDY #$00
        RTS
SSETUP  LDA #<SHIP
        STA *SSHPL
        LDA #>SHIP
        STA *SSHPH
        LDA #$08
        STA DEPTH
        LDA #$09
        STA HORIZ
        LDA #$03
        STA SLNGH
        STA TEMP
        RTS

YVERTL  HEX 0000000000000000 ;L57
        HEX 8080808080808080 ;L58
        HEX 0000000000000000 ;L59
        HEX 8080808080808080 ;L60
        HEX 0000000000000000 ;L61
        HEX 8080808080808080 ;L62
        HEX 0000000000000000 ;L63
        HEX 8080808080808080 ;L64
        HEX 2828282828282828 ;L65
        HEX A8A8A8A8A8A8A8A8 ;L66
        HEX 2828282828282828 ;L67
        HEX A8A8A8A8A8A8A8A8 ;L68
        HEX 2828282828282828 ;L69
        HEX A8A8A8A8A8A8A8A8 ;L70
        HEX 2828282828282828 ;L71
        HEX A8A8A8A8A8A8A8A8 ;L72
        HEX 5050505050505050 ;L73
        HEX D0D0D0D0D0D0D0D0 ;L74
        HEX 5050505050505050 ;L75
        HEX D0D0D0D0D0D0D0D0 ;L76
        HEX 5050505050505050 ;L77
        HEX D0D0D0D0D0D0D0D0 ;L78
        HEX 5050505050505050 ;L79
        HEX D0D0D0D0D0D0D0D0 ;L80

YVERTH  HEX 2024282C3034383C ;L82
        HEX 2024282C3034383C ;L83
        HEX 2125292D3135393D ;L84
        HEX 2125292D3135393D ;L85
        HEX 22262A2E32363A3E ;L86
        HEX 22262A2E32363A3E ;L87
        HEX 23272B2F33373B3F ;L88
        HEX 23272B2F33373B3F ;L89
        HEX 2024282C3034383C ;L90
        HEX 2024282C3034383C ;L91
        HEX 2125292D3135393D ;L92
        HEX 2125292D3135393D ;L93
        HEX 22262A2E32363A3E ;L94
        HEX 22262A2E32363A3E ;L95
        HEX 23272B2F33373B3F ;L96
        HEX 23272B2F33373B3F ;L97
        HEX 2024282C3034383C ;L98
        HEX 2024282C3034383C ;L99
        HEX 2125292D3135393D ;L100
        HEX 2125292D3135393D ;L101
        HEX 22262A2E32363A3E ;L102
        HEX 22262A2E32363A3E ;L103
        HEX 23272B2F33373B3F ;L104
        HEX 23272B2F33373B3F ;L105

SHIP    HEX 8000008200008200 ;L106
        HEX 008A0000AAD580AA ;L107
        HEX 9582AAD58AA8D5AA ;L108

; ****** END CODE FOR XOR SHIP ******
