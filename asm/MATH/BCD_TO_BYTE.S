M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.KPRESS  = $FD35   ; key press

S0.TA        = $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS

*=$6000
        LDA #$04
        STA *S0.TX
        LDA #$00        ; INPUT STRING
        STA *S0.TA
        STA LEN.01
        LDX #$00
CIN.1   JSR M.KPRESS
        CMP #$8D        ; '<enter>'
        BEQ MAIN
        INC LEN.01
        LDX *S0.TA
        STA STR.01,X
        INC *S0.TA
        BEQ MAIN
        JSR M.COUT
        JMP CIN.1
        RTS

MAIN    JSR M.CRDO
        LDX #$00
MAI.0   LDA STR.01,X
        CPX LEN.01
        BEQ MAI.1       ;leave if length reached
        JSR DENUM       ;TEST NUMERIC RANGE
        BCS MAI.1       ;leave if out of range
        JSR ENNUM
        JSR M.PRBYTE


        DEC *S0.TX     ; CYCLE COUNTER
        BNE ENU.0
        CMP #$01


        LDA #$03
        STA *S0.TX
ENU.0   LDA *S0.TX
        JSR M.PRBYTE
        JSR M.OUTSP

        INX
        BNE MAI.0
MAI.1   RTS

DENUM   CMP #'0'      ; *** DETECT NUMERIC RANGE ***
        BCC DE.3
        CMP #'9'+1
        BCS DE.3
        RTS          ; *** IN RANGE ***
DE.3    SEC          ; *** OUT OF RANGE ***
        RTS

ENNUM   SEC          ; *** ENCODE NUMERIC RANGE ***
        SBC #$B0
        RTS

CYCL.0  HEX 00
LEN.01  HEX 00
STR.01  HEX 00
