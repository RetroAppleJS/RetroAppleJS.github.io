; LAST BUILD 11-MAR-2025
ORG $6000

; check: http://simoneparisotto.com/math/misc/qrcode/qrcode.pdf


; Galois Fields support addition, subtraction, multiplication, and division
; but the rules for doing so are very different from those for ordinary integers.
; Understanding these rules is fundamental for understanding the algorithms involved in
; Reed-Solomon codes.
; A Reed-Solomon code (as usually applied over 8-bit bytes) is based on discrete polynomials
; over two different Galois Fields: GF(2) and GF(256). One of these polynomials is used to
; generate GF(256) from GF(2); the other is used to generate the parity symbols of a message
; block. Decoding the received message involves solving the roots of this polynomial in a
; particular way.
; GF(2) is simply a binary digit. GF(256) is derived from it by grouping eight GF(2) fields
; together - which is of course convenient to do on a byte-oriented CPU like the 6502.
; The trick is that there are two different representations of a GF(256) value, one most suited
; to multiplication, and one most suited to addition. We convert between the two by computing
; what amounts to the discrete logarithm and discrete exponent. If you've studied cryptography
; to any extent, at least one of those terms should be familiar. To make this efficient, we
; can build a pair of lookup tables, and this doesn't take very much memory.
; Addition in GF(2) and GF(256) is straightforward - it is the exclusive-OR function.
; The 6502 has this operation natively. This also means that subtraction is identical to addition.
; To multiply in GF(256), we first check whether either operand is zero - if so, the result
; is also zero. Otherwise, we look up the discrete logarithm of each operand, add them modulo
; 255 (avoiding zero), and then take the discrete exponent. The following code should suffice:

; This presupposes we have filled 256-entry logTable and expTable with appropriate values;
; it is possible to precompute these and stick them in ROM, or to generate them dynamically
; in RAM. Doing so requires repeatedly evaluating the generator polynomial of GF(256) over
; GF(2), which requires some explanation. In effect we are computing successive powers of 2,
; modulo the generator polynomial, using GF arithmetic - and this generates a repeating
; sequence of length 255 within GF(256).
; There are several generator polynomials which satisfy this property, but Reed-Solomon
; coders usually take the numerically smallest one, which is often quoted in the literature
; as X^8 + X^4 + X^3 + X + 1. But X is 2 in this context - since the base Galois Field involved
; is GF(2) - and it is convenient to write this as the 9-bit value $11B. Obtaining the next
; power of two is then as simple as multiplying by two (ie. shifting left one place), then
; if the most significant bit of the result matches the most-significant bit of the polynomial,
; subtract the polynomial. Note that the usual sense of "greater" or "lesser" doesn't apply
; here, since we are in a modular number system. And the 6502 makes this operation easy for us,
; even though it briefly involves a 9-bit value:

M.PRBYTE  EQU $FDDA   ; print hex byte
M.OUTSP   EQU $DB57   ; space
M.COUT    EQU $FDED   ; print char
M.KPRESS  EQU $FD35   ; key press
M.CRDO    EQU $DAFB   ; line feed

;M.PRBYTE  EQU $7200   ; print hex byte
;M.OUTSP   EQU $7200   ; space
;M.COUT    EQU $7200   ; print char
;M.KPRESS  EQU $7200   ; key press
;M.CRDO    EQU $7200   ; line feed



	JSR GF_INI     ; GENERATE LOOKUP TABLES FOR GALOIS FIELD 
	LDX #<LOGTAB
	LDY #>LOGTAB
	JSR GF_DSP     ; DISPLAY LOOKUP TABLE OF LOGARITHMS
	JSR M.KPRESS
	JSR M.CRDO
	LDX #<EXPTAB
	LDY #>EXPTAB
	JSR GF_DSP     ; DISPLAY LOOKUP TABLE OF EXPONENTS


; On entry, X and Y contain the values to multiply.
; On exit, A contains the result.  X is clobbered.
GF_MUL  TXA
        BEQ GFM1        ; if X = zero, the result is zero
        TYA
        BEQ GFM1        ; if Y = zero, the result is zero
        LDA LOGTAB,Y    ; neither argument is zero
        CLC
        SBC #$01        ; DEC A
        CLC
        ADC LOGTAB,X
        ADC #$00        ; modulo 255, avoiding zero
        TAX
        LDA EXPTAB,X
GFM1    RTS


; This method of taking the remainder of a division by the generator polynomial works because
; a polynomial over GF(2) can have coefficients only of 0 or 1, so we only have a binary
; decision as to whether to keep or subtract, and don't need to worry about multiplying the
; generator polynomial by anything. But when we start dealing with polynomials over GF(256),
; that convenience goes away, as the coefficients can take many values. When calculating by
; hand, we can use a form of long division, but the notation quickly gets confusing due to the
; need to refer to the discrete logarithm tables every time we switch between multiplying
; (to match the values of the leftmost digits) and subtracting.
; But this is a good time to establish the correct method of dividing two values in GF(256).
; In effect, we do this by multiplying the dividend by the reciprocal of the divisor, a process
; which leaves no remainder. We can use the logarithm table to discover the reciprocal, by
; observing that we only need to negate the logarithm, and then adjust the resulting table
; index for the wrap-around of the exponentiation sequence. It probably helps to observe that
; the reciprocal of zero is undefined (we can take it as zero) and the reciprocal of 
; 1 (== a^0) is also 1 (== a^-0). But the reciprocal of 2 (== a^1) is a^-1 which is also a^254,
; to be found at offset 255 in the exponent table. Generally, for values other than 0 and 1,
; subtracting the logarithm from 256 will give the correct logarithm of the reciprocal, to
; which the multiplication method seen above can be applied.


; On entry, X is dividend, Y is divisor;
; On exit, A is quotient.
GF_DIV  TXA
        BEQ GFD1
        CPY #$01
        BEQ GFD1
        TYA
        BEQ GFD1
        LDA LOGTAB,X     ; neither argument is zero and the divisor is not 1
        CLC
        SBC LOGTAB,Y
        ADC #$00
        TAX
        LDA EXPTAB,X
GFD1    RTS


; Generate logTable and expTable for GF(256) over $11D
; For consistency, both logarithm and exponent of zero are taken as zeroes; really this is 0 == a^(-inf).
; The real tables begin with entry 1 == a^0, both at index 1.
; http://forum.6502.org/viewtopic.php?f=2&t=6099&view=previous


GF_INI  LDA #$01
        LDX #$00
  
LOOP    JSR DB_EXP       ; D E B U G
        STA EXPTAB,X    ; store exponents
        TAY
        TXA
        JSR DB_LOG       ; D E B U G
        STA LOGTAB,Y    ; store logarithms
        TYA
        ASL A           ; calculate next exponent
        BCC L1
        EOR #$1D        ; and the next index (original src uses $1B)
L1      INX
        CPX #$FF
        BNE LOOP
        RTS

; Dump 256 bytes

GF_DSP  STX GD_3+1	; read high byte in X
        STY GD_3+2	; read low byte in Y
        LDX #$00	; reset counter
GD_1    TXA
        AND #$0F	; test if divisable by 16
        BNE GD_3
	JSR M.CRDO	; CR
GD_3    LDA $0000,X	; load byte
	JSR M.PRBYTE	; print byte
	INX
	BNE GD_1		; <255 ?
	RTS

;-------------------------------------------

TMP_A   EQU  $0D
TMP_X   EQU  $0E
TMP_Y   EQU  $0F
TMP_I   EQU  $10

DB_EXP  JSR SAVE
        LDA #"X"+128
        ;JSR M.COUT
        LDA EXPTAB,X
        STX *TMP_I
        JMP DL1

DB_LOG  JSR SAVE
        LDA #"L"+128
        ;JSR M.COUT
        LDA LOGTAB,Y
        STY *TMP_I
DL1     CMP *TMP_A
        BEQ DL2
        ;JSR M.PRBYTE    ; PRINT CHECK VALUE
        LDA #"<"+128
        JSR M.COUT
        LDA *TMP_A
        ;JSR M.PRBYTE    ; PRINT CALCULATED VALUE
        LDA #"."+128
        JSR M.COUT
        LDA *TMP_I
        ;JSR M.PRBYTE    ; PRINT INDEX
        ;JSR M.OUTSP     ; SPACE
        JSR M.KPRESS
        JSR LOAD
DL2     RTS

SAVE    STA *TMP_A
        STX *TMP_X
        STY *TMP_Y
        RTS

LOAD    LDA *TMP_A
        LDX *TMP_X
        LDY *TMP_Y
        RTS

;-------------------------------------------

ORG $7000
LOGTAB  HEX FF00011902321AC603DF33EE1B68C74B
        HEX 0464E00E348DEF811CC169F8C8084C71
        HEX 058A652FE1240F2135938EDAF0128245
        HEX 1DB5C27D6A27F9B9C99A09784DE472A6
        HEX 06BF8B6266DD30FDE29825B310912288
        HEX 36D094CE8F96DBBDF1D2135C83384640
        HEX 1E42B6A3C3487E6E6B3A2854FA85BA3D
        HEX CA5E9B9F0A15792B4ED4E5AC73F3A757
        HEX 0770C0F78C80630D674ADEED31C5FE18
        HEX E3A5997726B8B47C114492D92320892E
        HEX 373FD15B95BCCFCD908797B2DCFCBE61
        HEX F256D3AB142A5D9E843C3953476D41A2
        HEX 1F2D43D8B77BA476C41749EC7F0C6FF6
        HEX 6CA13B52299D55AAFB6086B1BBCC3E5A
        HEX CB595FB09CA9A0510BF516EB7A752CD7
        HEX 4FAED5E9E6E7ADE874D6F4EAA85058AF


ORG $7100
EXPTAB  HEX 01020408102040801D3A74E8CD871326
        HEX 4C982D5AB475EAC98F03060C183060C0
        HEX 9D274E9C254A94356AD4B577EEC19F23
        HEX 468C050A142850A05DBA69D2B96FDEA1
        HEX 5FBE61C2992F5EBC65CA890F1E3C78F0
        HEX FDE7D3BB6BD6B17FFEE1DFA35BB671E2
        HEX D9AF4386112244880D1A3468D0BD67CE
        HEX 811F3E7CF8EDC7933B76ECC5973366CC
        HEX 85172E5CB86DDAA94F9E214284152A54
        HEX A84D9A2952A455AA49923972E4D5B773
        HEX E6D1BF63C6913F7EFCE5D7B37BF6F1FF
        HEX E3DBAB4B963162C495376EDCA557AE41
        HEX 82193264C88D070E1C3870E0DDA753A6
        HEX 51A259B279F2F9EFC39B2B56AC458A09
        HEX 122448903D7AF4F5F7F3FBEBCB8B0B16
        HEX 2C58B07DFAE9CF831B366CD8AD478E00

ORG $7200
	RTS


