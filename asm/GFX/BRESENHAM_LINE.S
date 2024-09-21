*=$6000

; https://gist.github.com/petrihakkinen/cc07aa5d15baf157c668f3dcc582ecc2

M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.STROUT  = $DB3A   ; print string from address Y (high) and A (low)
S0.TX     = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY     = $1A     ; ONLY USE IN FUNCTIONS with no SUBS

		;*****************************************************************
		; init bresenham line 
		;*****************************************************************

IN_BRE
		; dx = abs(x2 - x1)
		; dy = abs(y2 - y1)
		; sx = x1 < x2 ? 1 : -1
		; sy = y1 < y2 ? 1 : -1
		; err = dx > dy ? dx : -dy
		; dx = dx * 2
		; dy = dy * 2

		; if y1 < y2:
		; 	sy = 1
		; 	dy = y2 - y1
		; else:
		; 	sy = -1
		; 	dy = y1 - y2

		LDX #$FF		; X = -1
		LDA BR_Y1
		SEC
		SBC BR_Y2	    ; A = y1 - y2
		BPL BR1
		LDX #$01		; X = 1
		JSR NEG			; A = y2 - y1
BR1		STA BR_DY
		STX BR_SY

		; if x1 < x2:
		; 	sx = 1
		; 	dx = x2 - x1
		; else:
		; 	sx = -1
		; 	dx = x1 - x2

		LDX #$FF		; X = -1
		LDA BR_X1
		SEC
		SBC BR_X2	    ; A = x1 - x2
		BPL BR2
		LDX #$01		; X = 1
		JSR NEG			; A = x2 - x1
BR2		STA BR_DX
		STX BR_SX

		; err = dx > dy ? dx : -dy
		;LDA BR_DX
		CMP BR_DY	; dx - dy > 0
		BEQ BR3
		BPL SKIPERR
BR3		LDA BR_DY
		JSR NEG
SKIPERR	STA BR_ERR

		; dx = dx * 2
		; dy = dy * 2

		ASL BR_DX
		ASL BR_DY
        JSR PRNT
		RTS             ; MAIN LOOP END







		;*****************************************************************
		; step along bresenham line
		;*****************************************************************

ST_BRE
		; err2 = err
		LDA BR_ERR
		PHA			; push err2

		; if err2 > -dx:
		;   err = err - dy
		;   x = x + sx

		CLC
		ADC BR_DX	; skip if err2 + dx <= 0
		BMI BR4
		BEQ BR4
		LDA BR_ERR
		SEC
		SBC BR_DY
		STA BR_ERR
		LDA BR_X1
		CLC
		ADC BR_SX
		STA BR_X1
BR4
		; if err2 < dy:
		;   err = err + dx
		;   y = y + sy

		PLA			; pop err2
		CMP BR_DY	; skip if err2 - dy >= 0
		BPL BR5
		LDA BR_ERR
		CLC
		ADC BR_DX
		STA BR_ERR
		LDA BR_Y1
		CLC
		ADC BR_SY
		STA BR_Y1
BR5		RTS  

		;*****************************************************************
		; negate accumulator
		;*****************************************************************

NEG		EOR #$FF
        CLC
        ADC #$01
        RTS


BR_X1   HEX 12
BR_Y1   HEX 34
BR_X2   HEX 56
BR_Y2   HEX 78

BR_DX   HEX 06
BR_DY   HEX 03
BR_SX   HEX 00
BR_SY   HEX 00
BR_ERR  HEX 00

;----------------------------------------------------------------------------



; *** PRINT STRING from A = INDEX ***
ISTROUT LDY #<STR.00    ; init pointer
        STY *S0.TX
        LDY #>STR.00    ; init pointer
        STY *S0.TY
        LDY #$00
        TAX             ; X = array index
        BEQ IST.2
        DEY
IST.1   INY
        LDA (S0.TX),Y
        BNE IST.1
        DEX
        BNE IST.1
        INY             ; Y = found starting index
IST.2   LDA (S0.TX),Y   ; Print string until next zero
        BEQ IST.3
        CLC
        ADC CH_IDX
        JSR M.COUT
        INY
        BNE IST.2
IST.3   RTS
IST.4   LDA CH_SET
        CMP #$01
        BNE IST.5
        LDA #$80
        STA CH_IDX
IST.5   RTS        

PRNT    LDA BR_X1
        JSR M.PRBYTE
        LDA #$00
        JSR ISTROUT
        LDA BR_Y1
        JSR M.PRBYTE
        JSR M.OUTSP
        
        LDA BR_X2
        JSR M.PRBYTE
        LDA #$00
        JSR ISTROUT
        LDA BR_Y2
        JSR M.PRBYTE  
        JSR M.OUTSP 

        LDA BR_DX
        JSR M.PRBYTE
        LDA #$00
        JSR ISTROUT
        LDA BR_DY
        JSR M.PRBYTE
        JSR M.OUTSP 

        LDA BR_SX
        JSR M.PRBYTE
        LDA #$00
        JSR ISTROUT
        LDA BR_SY
        JSR M.PRBYTE
        JSR M.OUTSP 
       

        RTS

STR.00  ASC ","             ;0
        HEX 00



CH_IDX  HEX 00
CH_SET  HEX 01          ; CHARACTESET 0=II+ 1=IIe
