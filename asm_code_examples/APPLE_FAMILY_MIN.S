*=$6000

;*********************************************
;*                                           *
;*  Mini Apple II Family Identification      *
;*********************************************

M.COUT   = $FDED   ; print char
M.PRBYTE = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
S0.TA    = $18     ; ONLY USE IN FUNCTIONS with no SUBS

APID    LDA #$0F

        LDX $FBB3     ; LOAD SOURCE
        CPX #$38      ; Detect pattern (APPLE II)
        BNE AP.0
        AND #$01      ; Narrow down

AP.0    CPX #$EA      ; Detect pattern (APPLE II+)
        BNE AP.1
        AND #$02      ; Narrow down

AP.1    CPX #$06      ; Detect pattern (APPLE IIe / Apple IIc)
        BNE AP.2
        AND #$0D      ; Narrow down

AP.2    LDX $FBC0     ; LOAD SOURCE
        CPX #$EA      ; Detect pattern1 (rule out Apple IIe)
        BEQ AP.4
        CPX #$E0      ; Detect pattern2 (rule out Apple IIe enhanced)
        BNE AP.5
AP.4    AND #$06      ; Narrow down (if pattern1 or pattern2)

AP.5    CPX #$00      ; Detect pattern1 (IIc)
        BNE AP.6
        AND #$08      ; Narrow down

AP.6    JSR PBIN
        RTS

PBIN    PHA
        SEC            ;PRINT BINARY NUMBER
        ROL A          ;shift the msb out into carry while shifting in an extra index bit
PB.0    PHA            ;save the value on stack
        LDA #$58       ;character value of '0'+128 divided by 2
        ROL A
        JSR M.COUT     ;print character on screen
        PLA            ;restore value
        ASL A          ;shift msb out into carry
        BNE PB.0       ;if msb was the extra index bit, a is now zero, otherwise continue loop
        PLA
        RTS            ;by this way all 8 bits of a are processed even if a=0

        ;ASC "4:IIC 3:IIE 1:][+ 0:]["
