NEW

10 HGR : REM HGR2
20 HEX$ = "0123456789ABCDEF" : J = 0
30 FOR I = 0 TO 191
40 POKE 226,I : POKE 224,J : CALL 24576+13 : REM FETCH HGR ADDRESS
50 POKE PEEK(39)*256+PEEK(38),255          : REM WRITE AT HGR ADDRESS
60 CALL 24576                              : REM PRINT ADDRESS + SPC
90 NEXT I: END

CALL-151

6000: A6 26 A4 27 20 40 F9 A9
6008: A0 20 F0 FD 60 A5 E2 A8
6010: 29 C0 85 26 4A 4A 8D 1D
6018: 00 05 26 85 26 98 0A 0A
6020: 85 27 0A 0A 0A 66 26 A5
6028: 27 18 29 1C 85 27 98 4A
6030: 4A 4A 4A 18 29 03 65 E6
6038: 65 27 85 27 60

E003G
RUN



------------

; CODE FOR HGR POSITION
*=$6000

TEMP        = $1D
GBASL       = $26
GBASH       = $27
HGR.Y       = $E2
HGR.X       = $E0
HGR.PAGE    = $E6


PRTADR  LDX *GBASL
        LDY *GBASH
        JSR $F940       ; PRINT RESULT ADDRESS
        LDA #$A0
        JSR $FDF0       ; PRINT SPC
        ;JSR $FD67      ; PRINT LF
        RTS

START   LDA *HGR.Y       ; Y ORDINATE

;---- CALCULATE LOW BYTE FOR GFX POS ---

        TAY
        AND #$C0   ; generates 0-64-128
        STA *GBASL
        LSR A
        LSR A      ; divide by 16
        STA TEMP
        ;CLC
        ;AND #$30
        ORA *GBASL
        STA *GBASL

        TYA
        ASL A
        ASL A
        STA *GBASH
        ASL A
        ASL A
        ASL A
        ROR *GBASL

;---- CALCULATE HIGH BYTE FOR GFX POS ---

        LDA *GBASH
        CLC         ; still don't know why I have to clear the carry bit
        AND #$1C
        STA *GBASH

        TYA
        LSR A
        LSR A
        LSR A
        LSR A        ; divide by 16 generates 0-1-2
        CLC
        AND #$03
        ADC *HGR.PAGE
        ADC *GBASH
        STA *GBASH
        RTS
