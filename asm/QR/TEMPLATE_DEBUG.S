;*** TXT CALLS ***

BT_AD1    = $06
BT_AD2    = $07

*=$6000
        LDY #>STR.03
        LDA #<STR.03

; *** PRINT STRING WITH TEMPLATE FILL-INS ***
PRTSTR  STA *BT_AD1   ; Print String from A=lowbyte Y=highbyte, ending with 0
        STY *BT_AD2   ; Save REF
        LDY #$00      ; Once REF saved, reset Y (index) to zero
PR.01   LDA (BT_AD1),Y
        BEQ PR.02
        JSR PR.03     ; Detect template functions & print consecutive ASCII characters
        INY
        BNE PR.01
        INC BT_AD2
        BNE PR.01
        LDA *BT_AD1
PR.02   RTS

PR.03   CMP #$DB        ;'['=$5B??       ; Detect template start
        BNE PR.06
        TYA
        CLC
        ADC *BT_AD2
        STA *BT_AD2
        
        LDY #$01
        LDA (BT_AD1),Y  ; Get reference type
        CMP #$C4        ;'D'=$44?
        BNE PR.05

        INY             ; IT'S A DECIMAL TYPE
        LDA (BT_AD1),Y  ; Get reference address (LO)
        STA PR.04+1
        INY
        LDA (BT_AD1),Y  ; Get reference address (HI)
        STA PR.04+2
        INY
        STY *BT_AD2     ; PUT READ POINTER BEYOND "]"
        LDA #$00
PR.04   LDX $0000       ; GET NUMBER FROM REFERENCE
        JSR M.LINPRT    ; PRINT DECIMAL NUMBER
        RTS

PR.05   CMP #$A4        ;'$'=$24??
        BNE PR.07       ; UNEXPECTED TYPE ?

        STY *BT_AD2     ; IT'S A STRING TYPE
        LDY #$00
        INY             ; LO
        INY             ; HI
        INY             ; LO
        INY             ; HI
        INY             ; BEYOND "]"
        STY *BT_AD2

        ; TODO PRINT STRING FROM ARRAY
        RTS

PR.06   JSR M.COUC
PR.07   RTS


QR_VAR  HEX 0B0000 ; QR TYPE NUMBER (0-40) 

STR.03  ASC "TYPENUMBER: <- [D"         ; DECIMAL TYPE
        .BYTE <QR_VAR                   ; NUMBER REFERENCE
        .BYTE >QR_VAR
        ASC "] ->"
        HEX 0D

;6058: D4 D9 D0 C5 CE D5 CD 
;6060: C2 C5 D2 BA A0 BC AD A0 

;6068: DB C4 56 60 DD A0 AD BE 
;6070: 0D

M.LINPRT    RTS
M.COUC      RTS