*=$6000

M.PRBYTE  EQU $FDDA   ; print hex byte
M.OUTSP   EQU $DB57   ; space
M.COUT    EQU $FDED   ; print char
M.KPRESS  EQU $FD35   ; key press
M.CRDO    EQU $DAFB   ; line feed

LDX #$00
LDY #$00
JSR P256
RTS


; PRINT 256 BYTES

P256    STX GD_3+1	; read high byte in X
        STY GD_3+2	; read low byte in Y
	    LDX #$00		; reset counter
P256_1  TXA
        AND #$0F	; test if divisable by 16
        BNE P256_2
	    JSR M.CRDO	; CR
P256_2  LDA $0000,X	; load byte
	    JSR M.PRBYTE	; print byte
	    INX
	    BNE P256_1		; <255 ?
	    RTS