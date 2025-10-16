; ------------------------------------------------------------
; AES-128 (ECB, 1 block) — 6502 Proof of Concept
; Key expansion + encrypt + decrypt
; ------------------------------------------------------------

                .ORG $6000

JMP START

; ------------------------------------------------------------
; ZP SCRATCH (keep these in zero page for speed)
; ------------------------------------------------------------
WPL             .RES 1      ; write ptr lo (keyexp)
WPH             .RES 1      ; write ptr hi
PRL             .RES 1      ; prev word ptr lo (wp-4)
PRH             .RES 1      ; prev word ptr hi
M4L             .RES 1      ; minus 16 ptr lo (wp-16)
M4H             .RES 1      ; minus 16 ptr hi
RPL             .RES 1      ; roundkey ptr lo (addkey)
RPH             .RES 1      ; roundkey ptr hi

CNTW            .RES 1      ; word counter (40)
JIDX            .RES 1      ; i mod 4
RCIX            .RES 1      ; rcon index 0..9

TMPA            .RES 1
TMPB            .RES 1
TMPC            .RES 1
TMPD            .RES 1

T0              .RES 1
T1              .RES 1
T2              .RES 1
T3              .RES 1
BT_AD1          EQU $06
BT_AD2          EQU $07

//$EB,$EC,$ED,$EE,$EF

; 16-byte temp for ShiftRows
STMP            .RES 16

; ------------------------------------------------------------
; DEMO ENTRY
; ------------------------------------------------------------
START 
                ; Copy PLAINT into STATE
                LDY #$00
ST_CPY          LDA PLAINT,Y
                STA STATE,Y
                INY
                CPY #$10
                BNE ST_CPY

                ; Expand KEY -> RK
                JSR KEYEXP

                ; Encrypt STATE
                JSR ENCRYP

                ; (At this point STATE should equal CIPH for test vector.)

                ; Decrypt back to plaintext
                ;JSR DECRYP
                ;LDA #<STATE            ; LO
                ;LDY #>STATE            ; HI
                ;JSR PRTSTR
                RTS                 ; End demo (replace as needed)

; ------------------------------------------------------------
; ENCRYPT ONE 16-BYTE BLOCK (STATE) WITH EXPANDED KEYS (RK)
; ------------------------------------------------------------
ENCRYP 
                ; Round 0: AddRoundKey with RK+0
                LDA #<RK
                STA RPL
                LDA #>RK
                STA RPH
                JSR ADDKEY

                ; Rounds 1..9
                LDX #$01
EN_RND          ; SubBytes
                JSR SUBBYT
                ; ShiftRows
                JSR SHFROW
                ; MixColumns
                JSR MIXCOL
                ; AddRoundKey with RK + (round*16)
                CLC
                LDA RPL
                ADC #$10
                STA RPL
                BCC EN_AK1
                INC RPH
EN_AK1          JSR ADDKEY

                INX
                CPX #$0A
                BNE EN_RND

                ; Final round: SubBytes, ShiftRows, AddRoundKey (no Mix)
                JSR SUBBYT
                JSR SHFROW
                CLC
                LDA RPL
                ADC #$10
                STA RPL
                BCC EN_AK2
                INC RPH
EN_AK2          JSR ADDKEY
                RTS

; ------------------------------------------------------------
; DECRYPT ONE 16-BYTE BLOCK (STATE) WITH EXPANDED KEYS (RK)
; ------------------------------------------------------------
DECRYP 
                ; Start at last round key: RK + 10*16 = RK + $A0
                LDA #<RK
                CLC
                ADC #$A0
                STA RPL
                LDA #>RK
                ADC #$00
                STA RPH

                ; Round 0 (inverse order): AddRoundKey
                JSR ADDKEY

                ; Rounds 1..9: InvShiftRows, InvSubBytes, AddRoundKey(prev), InvMixColumns
                LDX #$09
DE_RND 
                JSR ISHROW
                JSR INVSUB
                ; step key ptr backward by 16
                SEC
                LDA RPL
                SBC #$10
                STA RPL
                LDA RPH
                SBC #$00
                STA RPH
                JSR ADDKEY
                JSR INVMIX

                DEX
                BNE DE_RND

                ; Final: InvShiftRows, InvSubBytes, AddRoundKey with RK (round 0)
                JSR ISHROW
                JSR INVSUB
                ; move to round 0 key (already at RK)
                JSR ADDKEY
                RTS

; ------------------------------------------------------------
; KEY EXPANSION: KEY(16) -> RK(176)
; ------------------------------------------------------------
KEYEXP 
                ; Copy KEY -> RK (first 16 bytes)
                LDY #$00
KE_CP           LDA KEY,Y
                STA RK,Y
                INY
                CPY #$10
                BNE KE_CP

                ; Setup write ptr to RK+16
                LDA #<RK
                CLC
                ADC #$10
                STA WPL
                LDA #>RK
                ADC #$00
                STA WPH

                ; CNTW = 40 words to generate (4*10 rounds)
                LDA #$28
                STA CNTW
                LDA #$00
                STA JIDX
                STA RCIX

KE_LP 
                ; PR = WP - 4
                SEC
                LDA WPL
                SBC #$04
                STA PRL
                LDA WPH
                SBC #$00
                STA PRH
                ; M4 = WP - 16
                SEC
                LDA WPL
                SBC #$10
                STA M4L
                LDA WPH
                SBC #$00
                STA M4H

                ; Load prev word into T0..T3
                LDY #$00
                LDA (PRL),Y
                STA T0
                INY
                LDA (PRL),Y
                STA T1
                INY
                LDA (PRL),Y
                STA T2
                INY
                LDA (PRL),Y
                STA T3

                ; If JIDX==0, schedule core: rotword, subword, rcon
                LDA JIDX
                BNE KE_NC
                ; rotword: [T0 T1 T2 T3] -> [T1 T2 T3 T0]
                LDA T0
                STA TMPA
                LDA T1
                STA T0
                LDA T2
                STA T1
                LDA T3
                STA T2
                LDA TMPA
                STA T3
                ; subword
                LDX T0
                LDA SBOX,X
                STA T0
                LDX T1
                LDA SBOX,X
                STA T1
                LDX T2
                LDA SBOX,X
                STA T2
                LDX T3
                LDA SBOX,X
                STA T3
                ; rcon on T0
                LDY RCIX
                LDA RCON,Y
                EOR T0
                STA T0
                INC RCIX
KE_NC 
                ; Write word = (wp-16) XOR T*
                LDY #$00
                LDA (M4L),Y
                EOR T0
                STA (WPL),Y
                INY
                LDA (M4L),Y
                EOR T1
                STA (WPL),Y
                INY
                LDA (M4L),Y
                EOR T2
                STA (WPL),Y
                INY
                LDA (M4L),Y
                EOR T3
                STA (WPL),Y

                ; Advance WP += 4
                CLC
                LDA WPL
                ADC #$04
                STA WPL
                BCC KE_ADV
                INC WPH
KE_ADV 
                ; JIDX = (JIDX+1) & 3
                LDA JIDX
                CLC
                ADC #$01
                AND #$03
                STA JIDX

                ; CNTW--
                DEC CNTW
                BNE KE_LP
                RTS

; ------------------------------------------------------------
; ADDROUNDKEY: STATE ^= *(RPH:RPL)[0..15]
; ------------------------------------------------------------
ADDKEY 
                LDY #$00
AK_LP           LDA STATE,Y
                EOR (RPL),Y
                STA STATE,Y
                INY
                CPY #$10
                BNE AK_LP
                RTS

; ------------------------------------------------------------
; SUBBYTES: STATE[i] = SBOX[STATE[i]]
; ------------------------------------------------------------
SUBBYT 
                LDY #$00
SB_LP           LDA STATE,Y
                TAX
                LDA SBOX,X
                STA STATE,Y
                INY
                CPY #$10
                BNE SB_LP
                RTS

; ------------------------------------------------------------
; INVERSE SUBBYTES via search (no inv S-box table)
; A tiny but slow PoC approach to save space.
; ------------------------------------------------------------
INVSUB 
                LDY #$00
IV_LP           LDA STATE,Y
                STA TMPA           ; target value
                LDX #$00
IV_SR           LDA SBOX,X
                CMP TMPA
                BEQ IV_FD
                INX
                BNE IV_SR          ; will wrap only if no match (won't happen)
IV_FD           TXA                ; inverse byte
                STA STATE,Y
                INY
                CPY #$10
                BNE IV_LP
                RTS

; ------------------------------------------------------------
; SHIFTROWS (left shifts 0,1,2,3)
; ------------------------------------------------------------
SHFROW 
                ; Copy to STMP
                LDY #$00
SR_CP           LDA STATE,Y
                STA STMP,Y
                INY
                CPY #$10
                BNE SR_CP

                ; Row 0: 0,4,8,12 (no change)
                LDA STMP+0
                STA STATE+0
                LDA STMP+4
                STA STATE+4
                LDA STMP+8
                STA STATE+8
                LDA STMP+12
                STA STATE+12

                ; Row 1: 1,5,9,13 -> shift left 1
                LDA STMP+5
                STA STATE+1
                LDA STMP+9
                STA STATE+5
                LDA STMP+13
                STA STATE+9
                LDA STMP+1
                STA STATE+13

                ; Row 2: 2,6,10,14 -> shift left 2
                LDA STMP+10
                STA STATE+2
                LDA STMP+14
                STA STATE+6
                LDA STMP+2
                STA STATE+10
                LDA STMP+6
                STA STATE+14

                ; Row 3: 3,7,11,15 -> shift left 3 (right 1)
                LDA STMP+15
                STA STATE+3
                LDA STMP+3
                STA STATE+7
                LDA STMP+7
                STA STATE+11
                LDA STMP+11
                STA STATE+15
                RTS

; ------------------------------------------------------------
; INV SHIFTROWS (right shifts 0,1,2,3)
; ------------------------------------------------------------
ISHROW 
                ; Copy to STMP
                LDY #$00
IS_CP           LDA STATE,Y
                STA STMP,Y
                INY
                CPY #$10
                BNE IS_CP

                ; Row 0: unchanged
                LDA STMP+0
                STA STATE+0
                LDA STMP+4
                STA STATE+4
                LDA STMP+8
                STA STATE+8
                LDA STMP+12
                STA STATE+12

                ; Row 1: right 1 (left 3)
                LDA STMP+13
                STA STATE+1
                LDA STMP+1
                STA STATE+5
                LDA STMP+5
                STA STATE+9
                LDA STMP+9
                STA STATE+13

                ; Row 2: right 2
                LDA STMP+10
                STA STATE+2
                LDA STMP+14
                STA STATE+6
                LDA STMP+2
                STA STATE+10
                LDA STMP+6
                STA STATE+14

                ; Row 3: right 3 (left 1)
                LDA STMP+7
                STA STATE+3
                LDA STMP+11
                STA STATE+7
                LDA STMP+15
                STA STATE+11
                LDA STMP+3
                STA STATE+15
                RTS

; ------------------------------------------------------------
; MIXCOLUMNS (encryption)
; ------------------------------------------------------------
MIXCOL 
                LDY #$00           ; process columns 0,4,8,12
                ; Column 0
                JSR MIX1C
                ; Column 1
                LDY #$04
                JSR MIX1C
                ; Column 2
                LDY #$08
                JSR MIX1C
                ; Column 3
                LDY #$0C
                JSR MIX1C
                RTS

; mix one column at STATE+Y .. +Y+3
MIX1C 
                LDA STATE,Y        ; s0..s3 -> T0..T3
                STA T0
                INY
                LDA STATE,Y
                STA T1
                INY
                LDA STATE,Y
                STA T2
                INY
                LDA STATE,Y
                STA T3
                DEY
                DEY
                DEY                ; restore Y to start

                ; b0 = 2*s0 ^ 3*s1 ^ s2 ^ s3
                LDA T0
                JSR MUL2
                STA TMPA
                LDA T1
                JSR MUL3
                EOR TMPA
                EOR T2
                EOR T3
                STA STATE,Y        ; b0

                ; b1 = s0 ^ 2*s1 ^ 3*s2 ^ s3
                INY
                LDA T1
                JSR MUL2
                STA TMPA
                LDA T2
                JSR MUL3
                EOR TMPA
                EOR T0
                EOR T3
                STA STATE,Y

                ; b2 = s0 ^ s1 ^ 2*s2 ^ 3*s3
                INY
                LDA T2
                JSR MUL2
                STA TMPA
                LADA  LDA T3       ; (label to keep 6 chars — harmless)
                JSR MUL3
                EOR TMPA
                EOR T0
                EOR T1
                STA STATE,Y

                ; b3 = 3*s0 ^ s1 ^ s2 ^ 2*s3
                INY
                LDA T0
                JSR MUL3
                STA TMPA
                LDA T3
                JSR MUL2
                EOR TMPA
                EOR T1
                EOR T2
                STA STATE,Y

                RTS

; ------------------------------------------------------------
; INVERSE MIXCOLUMNS (decryption)
; ------------------------------------------------------------
INVMIX 
                LDY #$00
                JSR IMX1C
                LDY #$04
                JSR IMX1C
                LDY #$08
                JSR IMX1C
                LDY #$0C
                JSR IMX1C
                RTS

; inv mix one column
IMX1C 
                LDA STATE,Y
                STA T0
                INY
                LDA STATE,Y
                STA T1
                INY
                LDA STATE,Y
                STA T2
                INY
                LDA STATE,Y
                STA T3
                DEY
                DEY
                DEY

                ; b0 = 14*s0 ^ 11*s1 ^ 13*s2 ^ 9*s3
                LDA T0
                JSR MUL14
                STA TMPA
                LDA T1
                JSR MUL11
                EOR TMPA
                STA TMPA
                LDA T2
                JSR MUL13
                EOR TMPA
                STA TMPA
                LDA T3
                JSR MUL9
                EOR TMPA
                STA STATE,Y

                ; b1 = 9*s0 ^ 14*s1 ^ 11*s2 ^ 13*s3
                INY
                LDA T0
                JSR MUL9
                STA TMPA
                LADA2  LDA T1
                JSR MUL14
                EOR TMPA
                STA TMPA
                LDA T2
                JSR MUL11
                EOR TMPA
                STA TMPA
                LDA T3
                JSR MUL13
                EOR TMPA
                STA STATE,Y

                ; b2 = 13*s0 ^ 9*s1 ^ 14*s2 ^ 11*s3
                INY
                LDA T0
                JSR MUL13
                STA TMPA
                LDA T1
                JSR MUL9
                EOR TMPA
                STA TMPA
                LDA T2
                JSR MUL14
                EOR TMPA
                STA TMPA
                LDA T3
                JSR MUL11
                EOR TMPA
                STA STATE,Y

                ; b3 = 11*s0 ^ 13*s1 ^ 9*s2 ^ 14*s3
                INY
                LDA T0
                JSR MUL11
                STA TMPA
                LDA T1
                JSR MUL13
                EOR TMPA
                STA TMPA
                LDA T2
                JSR MUL9
                EOR TMPA
                STA TMPA
                LDA T3
                JSR MUL14
                EOR TMPA
                STA STATE,Y

                RTS

; ------------------------------------------------------------
; GF(2^8) HELPERS
; ------------------------------------------------------------
; xtime(a): A <- 2*A in GF, poly 0x1B
XT 
                ASL A
                BCC XT_OK
                EOR #$1B
XT_OK           RTS

; MUL2: 2*A
MUL2 
                JSR XT
                RTS

; MUL3: 3*A = 2*A ^ A
MUL3 
                STA TMPB
                JSR XT
                EOR TMPB
                RTS

; Precompute A2,A4,A8 by repeated xtime, then combine.
; MUL9 = 8*A ^ A
MUL9 
                STA TMPB          ; A
                JSR XT            ; 2A
                STA TMPA
                JSR XT            ; 4A
                STA TMPC
                JSR XT            ; 8A in A
                EOR TMPB
                RTS

; MUL11 = 8*A ^ 2*A ^ A
MUL11 
                STA TMPB          ; A
                JSR XT            ; 2A
                STA TMPA
                JSR XT            ; 4A
                STA TMPC
                JSR XT            ; 8A
                EOR TMPA
                EOR TMPB
                RTS

; MUL13 = 8*A ^ 4*A ^ A
MUL13 
                STA TMPB          ; A
                JSR XT            ; 2A
                STA TMPA
                JSR XT            ; 4A
                EOR TMPB          ; A now 4A ^ A
                STA TMPD
                JSR XT            ; 8A ^ 2A
                EOR TMPD          ; 8A ^ 2A ^ 4A ^ A
                EOR TMPA          ; remove 2A -> 8A ^ 4A ^ A
                RTS

; MUL14 = 8*A ^ 4*A ^ 2*A
MUL14 
                JSR XT            ; 2A
                STA TMPA
                JSR XT            ; 4A
                STA TMPC
                JSR XT            ; 8A
                EOR TMPC          ; 8A ^ 4A
                EOR TMPA          ; ^ 2A
                RTS

; *** PRINT STRING ***
PRTSTR  STA *BT_AD1   ; Print String from A=lowbyte Y=highbyte, ending with 0
        STY *BT_AD2
        LDY #$00
PR.01   LDA (BT_AD1),Y
        BEQ PR.02
        JSR $FDF0     ; Prints ASCII character & advance cursor
        INY
        BNE PR.01
        INC BT_AD2
        BNE PR.01
        LDA *BT_AD1
PR.02   RTS

; ------------------------------------------------------------
; DATA
; ------------------------------------------------------------

; AES S-box (256 bytes)
SBOX 
        .BYTE $63,$7C,$77,$7B,$F2,$6B,$6F,$C5,$30,$01,$67,$2B,$FE,$D7,$AB,$76
        .BYTE $CA,$82,$C9,$7D,$FA,$59,$47,$F0,$AD,$D4,$A2,$AF,$9C,$A4,$72,$C0
        .BYTE $B7,$FD,$93,$26,$36,$3F,$F7,$CC,$34,$A5,$E5,$F1,$71,$D8,$31,$15
        .BYTE $04,$C7,$23,$C3,$18,$96,$05,$9A,$07,$12,$80,$E2,$EB,$27,$B2,$75
        .BYTE $09,$83,$2C,$1A,$1B,$6E,$5A,$A0,$52,$3B,$D6,$B3,$29,$E3,$2F,$84
        .BYTE $53,$D1,$00,$ED,$20,$FC,$B1,$5B,$6A,$CB,$BE,$39,$4A,$4C,$58,$CF
        .BYTE $D0,$EF,$AA,$FB,$43,$4D,$33,$85,$45,$F9,$02,$7F,$50,$3C,$9F,$A8
        .BYTE $51,$A3,$40,$8F,$92,$9D,$38,$F5,$BC,$B6,$DA,$21,$10,$FF,$F3,$D2
        .BYTE $CD,$0C,$13,$EC,$5F,$97,$44,$17,$C4,$A7,$7E,$3D,$64,$5D,$19,$73
        .BYTE $60,$81,$4F,$DC,$22,$2A,$90,$88,$46,$EE,$B8,$14,$DE,$5E,$0B,$DB
        .BYTE $E0,$32,$3A,$0A,$49,$06,$24,$5C,$C2,$D3,$AC,$62,$91,$95,$E4,$79
        .BYTE $E7,$C8,$37,$6D,$8D,$D5,$4E,$A9,$6C,$56,$F4,$EA,$65,$7A,$AE,$08
        .BYTE $BA,$78,$25,$2E,$1C,$A6,$B4,$C6,$E8,$DD,$74,$1F,$4B,$BD,$8B,$8A
        .BYTE $70,$3E,$B5,$66,$48,$03,$F6,$0E,$61,$35,$57,$B9,$86,$C1,$1D,$9E
        .BYTE $E1,$F8,$98,$11,$69,$D9,$8E,$94,$9B,$1E,$87,$E9,$CE,$55,$28,$DF
        .BYTE $8C,$A1,$89,$0D,$BF,$E6,$42,$68,$41,$99,$2D,$0F,$B0,$54,$BB,$16

; Rcon (10 bytes)
RCON 
        .BYTE $01,$02,$04,$08,$10,$20,$40,$80,$1B,$36

; ------------------------------------------------------------
; BUFFERS
; ------------------------------------------------------------
STATE   .RES 16       ; in-place block buffer

KEY     .BYTE $00,$01,$02,$03,$04,$05,$06,$07,$08,$09,$0A,$0B,$0C,$0D,$0E,$0F
RK      .RES 176      ; expanded key (11 round keys)

; Test vectors (FIPS-197)
PLAINT  .BYTE $00,$11,$22,$33,$44,$55,$66,$77,$88,$99,$AA,$BB,$CC,$DD,$EE,$FF
CIPH    .BYTE $69,$C4,$E0,$D8,$6A,$7B,$04,$30,$D8,$CD,$B7,$80,$70,$B4,$C5,$5A
