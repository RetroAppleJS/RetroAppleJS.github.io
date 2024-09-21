*=$6000 
;--------------------------------
;      READ DATE FROM CLOCK II
;
;    APPLE ASSEMBLY LINE
;      V2N6P19, MARS 1982
;
;--------------------------------
;      READ DATE FROM CLOCK II
;--------------------------------


SLOT = $50      ;SLOT#
 CLOCK = $C080
 ;--------------------------------
 READ   LDX #SLOT
        LDA #$10     ;HOLD CLOCK
        STA CLOCK+1,X
        LDY #0       ;BEGINNING OF MAP
 L1     LDA MAP,Y    ;NEXT BYTE FROM MAP
        BEQ L3       ;END OF MAP
        BMI L2       ;COPY CHAR
        STA CLOCK+2,X  ;SELECT REGISTER
        CMP #$25     ;IS IT HOURS: TENS?
        BNE L4       ;NO
        LDA CLOCK+2,X  ;YES
        AND #3       ;STRIP OFF FLAGS
        BNE L5
        LDA #$A0
        BNE L2       ;...ALWAYS
 L4     LDA CLOCK+2,X  ;READ REGISTER
 L5     ORA #$B0     ;CONVERT TO ASCII
 L2     STA BUFFER,Y
        INY
        BNE L1       ;...ALWAYS
 L3     LDA #0       ;RELEASE CLOCK
        STA CLOCK+1,X
        LDA $C000    ;KEYPRESS?
        BPL READ     ;NO, KEEP READING
        STA $C010    ;YES, CLEAR STROBE
        JMP $FD8E    ;LINEFEED & RETURN
 ;--------------------------------
 MAP    HEX 2A29AF2827AF2C2B
        HEX A0A02524BA2322BA
        HEX 212000
 ;--------------------------------
 BUFFER = $7D0