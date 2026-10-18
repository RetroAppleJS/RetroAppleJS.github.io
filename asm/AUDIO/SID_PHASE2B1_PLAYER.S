; Phase 2B.1 — generic foreground PSID execution on native Apple II 6502.
; Public CALL 7168 ($1C00), optional STOP 7171 / RESTART 7174 / STATUS 7177.
; The low stub can be overwritten by original C64 code; high runtime remains.
; Runtime $9000+, descriptor $9400, Apple ZP backup $9500-$95FF.
; Original executable payload is copied, not relocated or translated.
; Descriptor assembled by tools/SID_Phase2B1_build.js (not user-supplied
; unchecked arbitrary memory). Compatible VBI-driven PSID v1/v2 only.
            ORG $1C00
PUBLIC      JMP $9000
PUB_STOP    JMP $9003
PUB_RESTART JMP $9006
PUB_STATUS  JMP $9009

            ORG $9000
START       JMP INSTALL
STOP        JMP SILENCE
RESTART     JMP INSTALL
STATUS      JMP GET_STATUS

DESC        EQU $9400
SAVEZP      EQU $9500
SRCZ        EQU $F0
DSTZ        EQU $F2
LEFT        EQU $F4
KBD         EQU $C000
KBDSTRB     EQU $C010
SIDCTRL1    EQU $D404
SIDCTRL2    EQU $D40B
SIDCTRL3    EQU $D412
SIDVOL      EQU $D418

INSTALL
            PHP
            SEI
            LDA #$00
            STA ERRORCD
            STA ACTIVE
            ; Descriptor magic "S2B1". Host builder already preflights file.
            LDA DESC
            CMP #$53
            BNE BAD_DESC
            LDA DESC+1
            CMP #$32
            BNE BAD_DESC
            LDA DESC+2
            CMP #$42
            BNE BAD_DESC
            LDA DESC+3
            CMP #$31
            BNE BAD_DESC
            LDA DESC+8
            ORA DESC+9
            BEQ BAD_DESC
            JSR FIND_SID
            BCC HAS_SID
            LDA #$02
            STA ERRORCD
            JMP BAD_START
BAD_DESC
            LDA #$01
            STA ERRORCD
            JMP BAD_START
HAS_SID
            ; X = physical slot*16; change clock access operands once.
            TXA
            CLC
            ADC #$82
            STA CLOCKSEL+1
            CLC
            ADC #$01
            STA CLOCKDATA+1
            JSR SAVE_APPLE_ZP
            JSR COPY_EXEC
            ; C64 zero-page environment while native music runs.
            LDA #$00
            LDX #$00
CLEAR_C64_ZP
            STA $0000,X
            INX
            BNE CLEAR_C64_ZP
            LDA DESC+10
            STA INIT_CALL+1
            LDA DESC+11
            STA INIT_CALL+2
            LDA DESC+12
            STA PLAY_CALL+1
            LDA DESC+13
            STA PLAY_CALL+2
            LDA DESC+15
            BEQ PAL_MODE
            LDA #$86            ; 60 Hz: 17030 = $4286 ticks
            STA PERIODLO
            LDA #$42
            STA PERIODHI
            JMP INIT_SONG
PAL_MODE
            LDA #$D4            ; 50 Hz: 20436 = $4FD4 ticks
            STA PERIODLO
            LDA #$4F
            STA PERIODHI
INIT_SONG
            LDA DESC+14         ; subtune selector, zero-based
INIT_CALL
            JSR $FFFF
            SEI
            LDA #$01
            STA ACTIVE
            LDA KBDSTRB         ; discard key used to launch
            JSR READ_CLOCK
            JSR ADVANCE_DEADLINE_INITIAL
PLAY_LOOP
            JSR WAIT_DEADLINE
PLAY_CALL
            JSR $FFFF
            LDA KBD
            BMI END_KEY
            JSR ADVANCE_DEADLINE
            JMP PLAY_LOOP
END_KEY
            LDA KBDSTRB
            JSR SILENCE
            JSR RESTORE_APPLE_ZP
            JSR RESTORE_PUBLIC
            LDA #$00
            STA ACTIVE
            PLP
            RTS

BAD_START
            LDX #$00
BAD_MSG_LOOP
            LDA ERROR_TEXT,X
            BEQ BAD_DONE
            ORA #$80
            JSR $FDED
            INX
            BNE BAD_MSG_LOOP
BAD_DONE
            PLP
            RTS
GET_STATUS
            LDA ERRORCD
            RTS

FIND_SID
            LDX #$10
FIND_NEXT
            LDA $C080,X
            CMP #$53
            BEQ FOUND_SID
            TXA
            CLC
            ADC #$10
            TAX
            CPX #$80
            BCC FIND_NEXT
            SEC
            RTS
FOUND_SID
            CLC
            RTS

SAVE_APPLE_ZP
            LDX #$00
SAVE_NEXT
            LDA $0000,X
            STA SAVEZP,X
            INX
            BNE SAVE_NEXT
            RTS
RESTORE_APPLE_ZP
            LDX #$00
RESTORE_NEXT
            LDA SAVEZP,X
            STA $0000,X
            INX
            BNE RESTORE_NEXT
            RTS
RESTORE_PUBLIC
            LDX #$00
RESTORE_PUBLIC_LOOP
            LDA PUBLIC_IMAGE,X
            STA $1C00,X
            INX
            CPX #$0C
            BNE RESTORE_PUBLIC_LOOP
            RTS
PUBLIC_IMAGE
            .BYTE $4C,$00,$90,$4C,$03,$90,$4C,$06,$90,$4C,$09,$90

; Copies executable payload from arbitrary staged address to the *original*
; absolute C64 load address. Use memmove direction so partial overlap is safe.
; Length is 1..28K; temporary ZP $F0-$F5 has already been backed up.
COPY_EXEC
            LDA DESC+4
            STA SRCZ
            LDA DESC+5
            STA SRCZ+1
            LDA DESC+6
            STA DSTZ
            LDA DESC+7
            STA DSTZ+1
            LDA DESC+8
            STA LEFT
            LDA DESC+9
            STA LEFT+1
            ; If dst > src, reverse copy is always safe, including overlap.
            LDA DSTZ+1
            CMP SRCZ+1
            BCC COPY_FWD
            BNE COPY_BACK
            LDA DSTZ
            CMP SRCZ
            BCC COPY_FWD
            BEQ COPY_DONE
COPY_BACK
            ; Advance both pointers to last byte (base+length-1).
            CLC
            LDA SRCZ
            ADC LEFT
            STA SRCZ
            LDA SRCZ+1
            ADC LEFT+1
            STA SRCZ+1
            CLC
            LDA DSTZ
            ADC LEFT
            STA DSTZ
            LDA DSTZ+1
            ADC LEFT+1
            STA DSTZ+1
            LDA SRCZ
            BNE BACK_SRC_DEC_LO
            DEC SRCZ+1
BACK_SRC_DEC_LO
            DEC SRCZ
            LDA DSTZ
            BNE BACK_DST_DEC_LO
            DEC DSTZ+1
BACK_DST_DEC_LO
            DEC DSTZ
            LDY #$00
BACK_LOOP
            LDA (SRCZ),Y
            STA (DSTZ),Y
            LDA SRCZ
            BNE BACK_SRC_NEXT
            DEC SRCZ+1
BACK_SRC_NEXT
            DEC SRCZ
            LDA DSTZ
            BNE BACK_DST_NEXT
            DEC DSTZ+1
BACK_DST_NEXT
            DEC DSTZ
            JSR COUNT_DOWN
            BNE BACK_LOOP
COPY_DONE
            RTS
COPY_FWD
            LDY #$00
FORWARD_LOOP
            LDA (SRCZ),Y
            STA (DSTZ),Y
            INC SRCZ
            BNE SRC_FORWARD_OK
            INC SRCZ+1
SRC_FORWARD_OK
            INC DSTZ
            BNE DST_FORWARD_OK
            INC DSTZ+1
DST_FORWARD_OK
            JSR COUNT_DOWN
            BNE FORWARD_LOOP
            RTS
COUNT_DOWN
            LDA LEFT
            BNE LEFT_LOW
            DEC LEFT+1
LEFT_LOW
            DEC LEFT
            LDA LEFT
            ORA LEFT+1
            RTS

READ_CLOCK
            LDA #$1E
            JSR SELECT_SID
            JSR READ_DATA
            STA NOWLO
            LDA #$1F
            JSR SELECT_SID
            JSR READ_DATA
            STA NOWHI
            RTS
SELECT_SID
CLOCKSEL
            STA $C0C2
            RTS
READ_DATA
CLOCKDATA
            LDA $C0C3
            RTS
ADVANCE_DEADLINE_INITIAL
            LDA NOWLO
            STA DEADLINELO
            LDA NOWHI
            STA DEADLINEHI
ADVANCE_DEADLINE
            CLC
            LDA DEADLINELO
            ADC PERIODLO
            STA DEADLINELO
            LDA DEADLINEHI
            ADC PERIODHI
            STA DEADLINEHI
            RTS
WAIT_DEADLINE
            JSR READ_CLOCK
            SEC
            LDA NOWLO
            SBC DEADLINELO
            LDA NOWHI
            SBC DEADLINEHI
            BMI WAIT_DEADLINE
            RTS

SILENCE
            LDA #$00
            STA SIDCTRL1
            STA SIDCTRL2
            STA SIDCTRL3
            STA SIDVOL
            RTS
ERROR_TEXT
            .BYTE $53,$49,$44,$20,$32,$42,$31,$20,$45,$52,$52,$4F,$52,$0D,$00
ERRORCD     .BYTE $00
ACTIVE      .BYTE $00
PERIODLO    .BYTE $00
PERIODHI    .BYTE $00
NOWLO       .BYTE $00
NOWHI       .BYTE $00
DEADLINELO  .BYTE $00
DEADLINEHI  .BYTE $00
            .END
