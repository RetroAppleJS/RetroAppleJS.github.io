; SID Phase 2B.1 — configurable native PSID foreground player
; LOAD AT $1C00, native C64 music payload must reside $2000-$8FFF.
; Parameterized at build/load time by tools/SID_Phase2B1_build.js.
; Original C64 code remains byte-for-byte unchanged.
; Zero page backup $9000-$90FF. Text mode, disposable session only.
            ORG $1C00
START       JMP INSTALL
STOP        JMP SILENCE
STATUS      JMP GET_STATUS
OSZP        EQU $9000
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
            JSR FIND_SID
            BCC HAS_CARD
            LDA #$02
            STA ERRORCD
            PLP
            RTS
HAS_CARD
            TXA
            CLC
            ADC #$82
            STA CLOCKSEL+1
            CLC
            ADC #$01
            STA CLOCKDATA+1
            JSR SAVE_ZP
            LDX #$00
            TXA
CLEAR_ZP
            STA $0000,X
            INX
            BNE CLEAR_ZP
SONG_SELECT
            LDA #$00
            LDX #$00
            LDY #$00
            JSR INIT_CALL
            SEI
            LDA KBDSTRB
            JSR READ_CLOCK
            CLC
            LDA NOWLO
            ADC PERIODLO
            STA DEADLINELO
            LDA NOWHI
            ADC PERIODHI
            STA DEADLINEHI
PLAY_LOOP
            JSR WAIT_DEADLINE
            JSR PLAY_CALL
            LDA KBD
            BMI END_KEY
            CLC
            LDA DEADLINELO
            ADC PERIODLO
            STA DEADLINELO
            LDA DEADLINEHI
            ADC PERIODHI
            STA DEADLINEHI
            JMP PLAY_LOOP
END_KEY
            LDA KBDSTRB
            JSR SILENCE
            JSR RESTORE_ZP
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
            BEQ FOUND
            TXA
            CLC
            ADC #$10
            TAX
            CPX #$80
            BCC FIND_NEXT
            SEC
            RTS
FOUND
            CLC
            RTS
SAVE_ZP
            LDX #$00
SAVE_LOOP
            LDA $0000,X
            STA OSZP,X
            INX
            BNE SAVE_LOOP
            RTS
RESTORE_ZP
            LDX #$00
RESTORE_LOOP
            LDA OSZP,X
            STA $0000,X
            INX
            BNE RESTORE_LOOP
            RTS
SILENCE
            LDA #$00
            STA SIDCTRL1
            STA SIDCTRL2
            STA SIDCTRL3
            STA SIDVOL
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
WAIT_DEADLINE
            JSR READ_CLOCK
            SEC
            LDA NOWLO
            SBC DEADLINELO
            LDA NOWHI
            SBC DEADLINEHI
            BMI WAIT_DEADLINE
            RTS
INIT_CALL
            JSR $2000
            RTS
PLAY_CALL
            JSR $2000
            RTS
PERIODLO    .BYTE $D4
PERIODHI    .BYTE $4F
NOWLO       .BYTE $00
NOWHI       .BYTE $00
DEADLINELO  .BYTE $00
DEADLINEHI  .BYTE $00
ERRORCD     .BYTE $00
            .END
