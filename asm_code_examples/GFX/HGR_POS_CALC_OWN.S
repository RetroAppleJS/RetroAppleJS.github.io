NEW

10 HGR : REM HGR2
20 HEX$ = "0123456789ABCDEF" : J = 0
30 FOR I = 0 TO 191 : REM 191
40 POKE 226,I : POKE 224,J : CALL 24576+13 : REM FETCH HGR ADDRESS
50 POKE PEEK(39)*256+PEEK(38),255     : REM WRITE AT HGR ADDRESS
55 IF I<10 THEN PRINT 0;
60 PRINT STR$(I)+" "; : CALL 24576 : PRINT "" :REM PRINT ADDRESS + SPC
90 NEXT I: TEXT : END

CALL-151

6000: A6 26 A4 27 20 40 F9 A9
6008: A0 20 F0 FD 60 A5 E2 A8
6010: 0A 0A 0A 0A 29 80 85 26
6018: 98 29 C0 4A AA 65 26 85
6020: 26 8A 4A 4A 65 26 85 26
6028: 98 85 27 0A 0A 0A 0A 26
6030: 27 98 29 30 4A 4A 4A 4A
6038: 65 E6 85 27 98 29 07 0A
6040: 0A 65 27 85 27 60

E003G
RUN



------------

; TODO: TRY TO REMOVE CLC, saving a few cycles ?

; CODE FOR HGR POSITION
*=$6000

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
        ASL A
        ASL A
        ASL A
        ASL A      ; multiplied by 16 generates 0-128 alternations
        AND #$80   ; filter out all other bits
        STA *GBASL

        TYA        ; we want to generate 0-40-80 by adding  0-32-64 with 0-8-16
        AND #$C0   ; generates 0-64-128
        LSR A      ; divided by 2 generates 0-32-64
        TAX
        ADC *GBASL
        STA *GBASL
        TXA
        LSR A
        LSR A      ; divided by 4 generates 0-8-16
        ADC *GBASL
        STA *GBASL

;---- CALCULATE HIGH BYTE FOR GFX POS ---

        TYA
        AND #$30
        LSR A
        LSR A
        LSR A
        LSR A     ; divided by 16 generates 0-1-2
        ;AND #$03
        ADC *HGR.PAGE
        STA *GBASH

        TYA
        AND #$07
        ASL A
        ASL A
        ADC *GBASH
        STA *GBASH
        RTS
