; ============================================================
; APPLE II KEYBOARD ASCII TEST
;
; Load address: $6000
; Start with:   CALL 24576
;
; Example:
;   CTRL+M         RAW=$8D  ASCII=$0D  DEC=013
;   SHIFT+CTRL+M   RAW=$9D  ASCII=$1D  DEC=029
;
; ESC displays its code and then exits.
; ============================================================

ORG $6000

KBD         = $C000
KBDSTRB     = $C010

MON.COUT    = $FDED
MON.CROUT   = $FD8E
MON.PRBYTE  = $FDDA


START
        JSR MON.CROUT

        LDX #<TITLE
        LDY #>TITLE
        JSR PRINTZ

        JSR MON.CROUT


; ------------------------------------------------------------
; Wait until bit 7 of the keyboard latch is set.
; ------------------------------------------------------------

WAITKEY
        BIT KBD
        BPL WAITKEY

        LDA KBD
        STA RAWCODE

        AND #$7F
        STA ASCIICODE

        ; Reading $C010 clears the keyboard strobe without
        ; changing the accumulator.
        BIT KBDSTRB


; ------------------------------------------------------------
; Print raw keyboard latch value.
; ------------------------------------------------------------

        LDX #<RAWMSG
        LDY #>RAWMSG
        JSR PRINTZ

        LDA RAWCODE
        JSR MON.PRBYTE


; ------------------------------------------------------------
; Print decoded hexadecimal ASCII value.
; ------------------------------------------------------------

        LDX #<ASCIIMSG
        LDY #>ASCIIMSG
        JSR PRINTZ

        LDA ASCIICODE
        JSR MON.PRBYTE


; ------------------------------------------------------------
; Print decoded decimal ASCII value.
; ------------------------------------------------------------

        LDX #<DECMSG
        LDY #>DECMSG
        JSR PRINTZ

        JSR PRINTDEC

        JSR MON.CROUT


; ------------------------------------------------------------
; ESC exits after its value has been displayed.
; ------------------------------------------------------------

        LDA ASCIICODE
        CMP #$1B
        BNE WAITKEY

        RTS


; ============================================================
; PRINTZ
;
; X = low byte of zero-terminated string address
; Y = high byte of zero-terminated string address
;
; Strings are stored as normal 7-bit ASCII. Bit 7 is added
; before calling the Apple II monitor output routine.
; ============================================================

PRINTZ
        STX PZLOAD+1
        STY PZLOAD+2

        LDY #$00

PZLOOP
PZLOAD
        LDA $FFFF,Y
        BEQ PZDONE

        ORA #$80

        ; Preserve Y in case the monitor output routine changes it.
        STY PRINTINDEX
        JSR MON.COUT
        LDY PRINTINDEX

        INY
        BNE PZLOOP

PZDONE
        RTS


; ============================================================
; PRINTDEC
;
; Prints ASCIICODE as exactly three decimal digits.
; Valid input range for this program: 000 through 127.
; ============================================================

PRINTDEC
        LDA ASCIICODE
        LDX #$00

        ; Hundreds digit
        CMP #100
        BCC PDHUNDRED

        SBC #100
        INX

PDHUNDRED
        PHA

        TXA
        ORA #$B0
        JSR MON.COUT

        PLA
        LDX #$00

        ; Tens digit
PDTENSLOOP
        CMP #10
        BCC PDTENS

        SBC #10
        INX
        JMP PDTENSLOOP

PDTENS
        PHA

        TXA
        ORA #$B0
        JSR MON.COUT

        ; Units digit
        PLA
        ORA #$B0
        JSR MON.COUT

        RTS


; ============================================================
; DATA
; ============================================================

TITLE
        .BYTE "APPLE II KEYBOARD ASCII TEST - ESC EXITS",0

RAWMSG
        .BYTE "RAW=$",0

ASCIIMSG
        .BYTE "  ASCII=$",0

DECMSG
        .BYTE "  DEC=",0

RAWCODE
        .BYTE $00

ASCIICODE
        .BYTE $00

PRINTINDEX
        .BYTE $00