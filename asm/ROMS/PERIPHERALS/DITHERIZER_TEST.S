; ============================================================
; DITHERTIZER II PASSIVE DETECTION
;
; Input:
;       A = Apple slot number 1..7
;
; Output:
;       C = 1   probable Dithertizer II detected
;       A = slot number
;
;       C = 0   not detected
;       A = 0
;
; Uses:
;       X,Y
;       $06 = saved slot
;       $07 = number of successful signatures still required
;       $08 = restart count
;
; IMPORTANT:
;       Code must reside in RAM because the $C0n0 operands
;       are patched for the selected slot.
;
; Does NOT access $C0n8 and therefore does not initiate capture.
; ============================================================

ORG $6000

SLOTNO  = $06
PASSCNT = $07
ATTEMPT = $08


PROBE_DITHER

        STA SLOTNO

        CMP #$01
        BCC DITH_FAIL

        CMP #$08
        BCS DITH_FAIL

; ------------------------------------------------------------
; Compute slot-I/O base:
;
;   slot 1 -> $C090
;   slot 2 -> $C0A0
;       ...
;   slot 7 -> $C0F0
;
; low byte = $80 + slot * $10
; ------------------------------------------------------------

        ASL
        ASL
        ASL
        ASL
        ORA #$80

; Patch the low byte of every absolute LDA $C080 below.

        STA DITH_R0+1
        STA DITH_R1+1
        STA DITH_R2+1
        STA DITH_R3+1
        STA DITH_R4+1

; Require the signature twice to reduce accidental matches.

        LDA #$02
        STA PASSCNT

DITH_AGAIN

        JSR DITH_SYNC_SIGNATURE
        BCC DITH_FAIL

        DEC PASSCNT
        BNE DITH_AGAIN

        LDA SLOTNO
        SEC
        RTS


DITH_FAIL

        LDA #$00
        CLC
        RTS


; ============================================================
; Look for the sync pattern used by DSCAN 4.2.
;
; C=1 pattern found
; C=0 timeout/no match
; ============================================================

DITH_SYNC_SIGNATURE

        LDA #$08
        STA ATTEMPT


; ------------------------------------------------------------
; Restart if a pulse has the wrong width.
; ------------------------------------------------------------

DITH_RESTART

        LDA ATTEMPT
        BEQ DITH_SYNC_FAIL

        DEC ATTEMPT


; ------------------------------------------------------------
; 1. Wait for D7 LOW.
;
; The original driver:
;
;       LDA $C0F0
;       BMI ...
;
; so BPL means the software-visible sync state is LOW.
;
; Bounded here so an absent card cannot hang the scanner.
; ------------------------------------------------------------

        LDY #$08

DITH_WAIT_LOW_OUTER

        LDX #$00

DITH_WAIT_LOW

DITH_R0
        LDA $C080             ; patched to $C090..$C0F0

        BPL DITH_GOT_LOW

        DEX
        BNE DITH_WAIT_LOW

        DEY
        BNE DITH_WAIT_LOW_OUTER

        JMP DITH_SYNC_FAIL


; ------------------------------------------------------------
; 2. Confirm this is a LONG LOW interval.
;
; This intentionally closely follows DSCAN:
; require three more consecutive LOW samples.
; ------------------------------------------------------------

DITH_GOT_LOW

        LDX #$03

DITH_LONG_LOW

DITH_R1
        LDA $C080

        BMI DITH_RESTART      ; HIGH too soon -> wrong pulse

        DEX
        BNE DITH_LONG_LOW


; ------------------------------------------------------------
; 3. Wait for HIGH.
; ------------------------------------------------------------

        LDY #$08

DITH_WAIT_HIGH_OUTER

        LDX #$00

DITH_WAIT_HIGH

DITH_R2
        LDA $C080

        BMI DITH_GOT_HIGH

        DEX
        BNE DITH_WAIT_HIGH

        DEY
        BNE DITH_WAIT_HIGH_OUTER

        JMP DITH_SYNC_FAIL


; ------------------------------------------------------------
; 4. Once HIGH, wait for the next LOW transition.
;
; We deliberately give this a shorter timeout.
; ------------------------------------------------------------

DITH_GOT_HIGH

        LDX #$00

DITH_WAIT_NEXT_LOW

DITH_R3
        LDA $C080

        BPL DITH_SHORT_LOW

        DEX
        BNE DITH_WAIT_NEXT_LOW

        JMP DITH_RESTART


; ------------------------------------------------------------
; 5. The next LOW pulse must be SHORT.
;
; This is essentially the distinctive test in DSCAN:
;
;       DEX
;       BEQ restart
;       LDA $C0F0
;       BPL ...
;
; If D7 returns HIGH before X expires, accept it.
; ------------------------------------------------------------

DITH_SHORT_LOW

        LDX #$03

DITH_SHORT_TEST

        DEX
        BEQ DITH_RESTART

DITH_R4
        LDA $C080

        BPL DITH_SHORT_TEST


; HIGH returned quickly -> characteristic pulse found.

        SEC
        RTS


DITH_SYNC_FAIL

        CLC
        RTS