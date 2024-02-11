;*************************************
;***     APPLE DISK II PROM        ***
;*** GCR=GROUP CODE RECORDING DUMP ***
;***       FREDDY VANDRIESSCHE     ***
;***     MIT LICENSE APPLICABLE    ***
;*************************************

*=$6000
M.PRBYTE    EQU    $FDDA   ; print hex byte
M.COUT      EQU    $FDED   ; print char
M.KPRESS    EQU    $FD35   ; key press

; vvvv   APPLE DISK II PROM CODE SNIPPET  vvvv

        LDX   #$20
        LDY   #$00
        LDX   #$03
L01     STX   *$3C          ; Store X in DOS register
        TXA
        ASL   A		    ; *2
        BIT   *$3C          ; AND ACC with DOS register 
        BEQ   L03	    ; JUMP IF ZERO 
        ORA   *$3C          ; OR ACC with DOS register >> put back in ACC
        EOR   #$FF          ; %11111111 invert all ACC bits 
        AND   #$7E          ; %01111110 remove first & last bit of ACC
L02     BCS   L03
        LSR   A             ; /2
        BNE   L02
        TYA 
        STA   $0356,X       ; Write to plain memory 

        JSR   DUMP  

        INY  
L03     INX   
        BPL   L01
        RTS

; ^^^^   APPLE DISK II PROM CODE SNIPPET  ^^^^


DUMP    STA   *$3D	; SAVE LOOKUP INDEX
        STY   *$3F      ; SAVE Y
        CLC
        TXA
        ADC   #$56
        STA   *$3E
        LDA   #$03
        ADC   #$00
        JSR   M.PRBYTE  ; PRINT ADDRESS
        LDA   *$3E
        JSR   M.PRBYTE
        LDA   #':'+128
        JSR   M.COUT
        LDA   *$3D
        JSR   M.PRBYTE	; PRINT LOOKUP INDEX
        LDA   #'>'+128
        JSR   M.COUT
        LDA   *$3E
        CLC
        ADC   #$2A
        STA   *$3E
        JSR   M.PRBYTE	; PRINT ADDRESS OFFSET (HEX)
        LDA   #' '+128
        JSR   M.COUT
        LDA   *$3E   	; PRINT ADDRESS OFFSET (BIN)
        JSR   PRBITS
        LDA   #' '+128
        JSR   M.COUT
        JSR   M.KPRESS
        LDY   *$3F      ; RECALL Y
        RTS

PRBITS  PHA
        SEC             ;PRINT BINARY NUMBER
        ROL A           ;shift the msb out into carry while shifting in an extra index bit
PB.0    PHA             ;save the value on stack
        LDA #$58        ;character value of '0'+128 divided by 2
        ROL A
        JSR M.COUT      ;print character on screen
        PLA             ;restore value
        ASL A           ;shift msb out into carry
        BNE PB.0        ;if msb was the extra index bit, a is now zero, otherwise continue loop
        PLA
        RTS             ;by this way all 8 bits of a are processed even if a=0