****************************************
*
* Bouncing Balls in Hires
* 6502 Assembly for the Apple II
*
* Stephen A. Edwards
*
****************************************

	org $8000

; Numeric constants

NBALLS 	equ 30		; Number of balls to bounce

COLUMNS	equ 40		; Number of columns/bytes per row

WHITE	equ $7F		; White hires byte

RKEY	equ $D2		; Code for when "R" is pressed

RWALL	equ $f700
LWALL	equ $0400
BOTTOM	equ $B700
BOTTOM2	equ $6E00	; Bottom * 2, for bouncing

; Addresses

BALL	equ $6		; Current ball number
GBASL	equ $26		; Graphics base address
GBASH	equ $27
HCOLOR1	equ $1c		; Color value
HGRX	equ $e0		; two-byte value
HGRY	equ $e2

HGR1SCRN equ $2000	; Start of hires page 1

KBD	equ $c000	; key code when MSB set
KBDSTRB	equ $c010	; clear keyboard buffer
TXTCLR	equ $c050	; graphics mode
TXTSET	equ $c051	; text mode
LOWSCR	equ $c054	; page 1
HIRES	equ $c057	; hires mode

balls	jsr hclear

; Draw the boundary

	lda #WHITE
	ldy #0
	jsr hline	; White line on the top row
	ldy #191
	jsr hline	; White line on the bottom row
	lda #%00000011
	ldy #0
	jsr vline	; White line on the left column
	lda #%01100000
	ldy #COLUMNS-1
	jsr vline	; White line on the right column

; Initialize the ball positions and speeds

; Zero the first four tables

	ldx #NBALLS * 4 - 1
	lda #0
init0	sta BALLXL,x
	dex
	bpl init0

; Initialize non-zero entries

	ldx #NBALLS-1
	ldy #1
initl	tya		; Linear feedback shift register
	lsr
	bcc skip
	eor #$c0
skip	tay
	and #$1F
	adc #1
	sta BALLXH,x
	sta BALLDX,x
	tya
	lsr
	adc #10
	sta BALLYH,x
	dex
	bpl initl

; Draw each ball

drawall	lda #NBALLS-1
	sta BALL
da1	jsr xorball
	dec BALL
	bpl da1

update	lda #NBALLS-1
	sta BALL
uploop	jsr xorball	; erase the ball in its current position
	ldx BALL

; Update horizontal position

	lda BALLXL,x
	clc
	adc BALLDX,x
	bpl noxunderflow

	adc #56		; Correct for underflow; carry is clear
	sta BALLXL,x
	dec BALLXH,x
	bne xdone	; Hit the left wall?
	beq bouncex	; Yes: bounce

noxunderflow
	sta BALLXL,x
	sec
	sbc #56
	bcc xdone	; No overflow?

	sta BALLXL,x
	inc BALLXH,x
	ldy BALLXH,x
	cpy #COLUMNS-2	; Hit the right wall?
	bne xdone
bouncex
	sec
	lda #0
	sbc BALLDX,x
	sta BALLDX,x
xdone

; Update the ball's vertical position

; Apply gravity

  	inc BALLDYH,x

; Update position

 	clc
	lda BALLYL,x
	adc BALLDYL,x
	sta BALLYL,x
	lda BALLYH,x
	adc BALLDYH,x
	sta BALLYH,x

	cmp #>BOTTOM
	bcc nobounce

; BALLY = 2 * bottom - BALLY

	sec
	lda #<BOTTOM2
	sbc BALLYL,x
	sta BALLYL,x
	lda #>BOTTOM2
	sbc BALLYH,x
	sta BALLYH,x

	sec
	lda #0
	sbc BALLDYL,x
	sta BALLDYL,x
	lda #0
	sbc BALLDYH,x
	sta BALLDYH,x
nobounce
	jsr xorball 	; draw the ball in its new position

	dec BALL
	bpl uploop

	bit KBD		; Key pressed?
	bmi pressed
	jmp update	; No, update everything

pressed	lda KBD
	cmp #RKEY	; Was R pressed?
	bne quit
	bit KBDSTRB	; Clear the key
	jmp balls	; Restart

quit
	bit KBDSTRB	; Clear the key
	bit TXTSET	; Switch to text mode
	rts

; Draw a horizontal line
; A = color byte to repeat, e.g., $7F
; Y = row (0-191) ($FF on exit)
;
; Uses GBASL, GBASH

hline	pha
	lda LKLO,y
	sta GBASL
	lda LKHI,y
	sta GBASH
	ldy #COLUMNS-1	; Width of screen in bytes
	pla
hl1	sta (GBASL),y
	dey
	bpl hl1
	rts

; Draw a vertical line on all but the topmost and bottommost rows
; A = byte to write in each position
; Y = column
;
; Uses GBASL, GBASH, HCOLOR1

vline	sta HCOLOR1
	ldx #190	; Start at second-to-last row
vl1	lda LKLO,x	; Get the row address
	sta GBASL
	lda LKHI,x
	sta GBASH
	lda HCOLOR1
	sta (GBASL),y	; Write the color byte
	dex 		; Previous row
	bne vl1
	rts

; Clear and switch to hires page 1
; Uses GBASL and GBASH

hclear	ldx #>HGR1SCRN	; $20, also the number of pages to clear
	stx GBASH
	lda #0		; Clear to black
	sta GBASL
	tay
hclr1	sta (GBASL),y
	iny
	bne hclr1	; Done with the page?
	inc GBASH
	dex
	bne hclr1	; Done with all pages?

	bit HIRES	; Switch to hires mode
	bit TXTCLR
	rts

; Draw or erase a ball
; BALL = ball number
; BALLYH+BALL = top row
; BALLXH+BALL = left column (byte offset)
; BALLXL+BALL = bits 4-6 select one of the 7 shifted versions
;
; Uses GBASL, GBASH, HGRY, HGRX
xorball
	ldy BALL
	lda BALLYH,y	; Get row
	sta HGRY
	lda BALLXH,y	; Get column
	sta HGRX
	lda BALLXL,y	; Get Shift (0,8,...,48)
	and #$38
	tax		; Offset into sprite table (pixel * 8)

xsplot	ldy HGRY	; Get the row address
	lda LKLO,y
	sta GBASL
	lda LKHI,y
	sta GBASH
	iny
	sty HGRY

	ldy HGRX	; XOR the two bytes onto the screen

; (GBASL, GBASH) = row address
; Y = byte offset into the row
; X = index into sprite tables

	lda (GBASL),y
	eor BALL0,x
	sta (GBASL),y
	iny
	lda (GBASL),y
	eor BALL1,x
	sta (GBASL),y
	inx

	txa
	and #7
	bne xsplot	; Stop at a multiple of 8 bytes
	rts


; Hires row address lookup tables, after Pelczarski, Graphically Speaking

LKHI	hex 2024282c3034383c2024282c3034383c
	hex 2125292d3135393d2125292d3135393d
	hex 22262a2e32363a3e22262a2e32363a3e
	hex 23272b2f33373b3f23272b2f33373b3f
	hex 2024282c3034383c2024282c3034383c
	hex 2125292d3135393d2125292d3135393d
	hex 22262a2e32363a3e22262a2e32363a3e
	hex 23272b2f33373b3f23272b2f33373b3f
	hex 2024282c3034383c2024282c3034383c
	hex 2125292d3135393d2125292d3135393d
	hex 22262a2e32363a3e22262a2e32363a3e
	hex 23272b2f33373b3f23272b2f33373b3f

LKLO	hex 00000000000000008080808080808080
	hex 00000000000000008080808080808080
	hex 00000000000000008080808080808080
	hex 00000000000000008080808080808080
	hex 2828282828282828a8a8a8a8a8a8a8a8
	hex 2828282828282828a8a8a8a8a8a8a8a8
	hex 2828282828282828a8a8a8a8a8a8a8a8
	hex 2828282828282828a8a8a8a8a8a8a8a8
	hex 5050505050505050d0d0d0d0d0d0d0d0
	hex 5050505050505050d0d0d0d0d0d0d0d0
	hex 5050505050505050d0d0d0d0d0d0d0d0
	hex 5050505050505050d0d0d0d0d0d0d0d0

; Eight bytes per sprite, first bytes

BALL0	db %00111100
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %00111100

	db %01111000
	db %01111110
	db %01111110
	db %01111110
	db %01111110
	db %01111110
	db %01111110
	db %01111000

	db %01110000
	db %01111100
	db %01111100
	db %01111100
	db %01111100
	db %01111100
	db %01111100
	db %01110000

	db %01100000
	db %01111000
	db %01111000
	db %01111000
	db %01111000
	db %01111000
	db %01111000
	db %01100000

	db %01000000
	db %01110000
	db %01110000
	db %01110000
	db %01110000
	db %01110000
	db %01110000
	db %01000000

	db %00000000
	db %01100000
	db %01100000
	db %01100000
	db %01100000
	db %01100000
	db %01100000
	db %00000000

	db %00000000
	db %01000000
	db %01000000
	db %01000000
	db %01000000
	db %01000000
	db %01000000
	db %00000000

; Second byte

BALL1	db %00000000
	db %00000001
	db %00000001
	db %00000001
	db %00000001
	db %00000001
	db %00000001
	db %00000000

	db %00000000
	db %00000011
	db %00000011
	db %00000011
	db %00000011
	db %00000011
	db %00000011
	db %00000000

	db %00000001
	db %00000111
	db %00000111
	db %00000111
	db %00000111
	db %00000111
	db %00000111
	db %00000001

	db %00000011
	db %00001111
	db %00001111
	db %00001111
	db %00001111
	db %00001111
	db %00001111
	db %00000011

	db %00000111
	db %00011111
	db %00011111
	db %00011111
	db %00011111
	db %00011111
	db %00011111
	db %00000111

	db %00001111
	db %00111111
	db %00111111
	db %00111111
	db %00111111
	db %00111111
	db %00111111
	db %00001111

	db %00011110
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %01111111
	db %00011110

; Position and velocity information for each ball

BALLXL	ds NBALLS	; 0,8,...,48 = horizontal shift
BALLYL	ds NBALLS
BALLDYL	ds NBALLS
BALLDYH ds NBALLS

BALLDX	ds NBALLS	; 8 = one pixel horizontal
BALLXH	ds NBALLS	; column/byte
BALLYH	ds NBALLS	; row
