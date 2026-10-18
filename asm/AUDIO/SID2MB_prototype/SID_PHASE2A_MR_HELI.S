; =============================================================================
; SID PHASE 2A: Mr. Heli -- original PSID machine code on an Apple II
; Foreground player. No Mockingboard, SID-to-AY translation or patched SID stores.
;
; Original PSID: asm/AUDIO/SID2MB_native_MrHeli_prototype/Mr_Heli_original.sid
; Stage the UNMODIFIED complete 4,841-byte file at $6000-$72E8.
; Assemble this driver at $2000 (Apple II text mode only; no HGR page 1).
;
; CALL 8192 ($2000): start default subtune (5), wait for ANY KEY to stop.
; CALL 8195 ($2003): silence SID once playback has returned.
; CALL 8198 ($2006): restart foreground playback.
; CALL 8201 ($2009): return last error code in A.
;
; Errors: 0=none, 1=unexpected PSID header, 2=SID not found.
; SID slot auto-detection probes SlotIO base $C090..$C0F0.
; Emulator SID clock extension: slot data index $1E/$1F latches CPU ticks.
; CPU-clock deadline: exactly 20,436 Apple II ticks per PLAY (50 Hz).
;
; Original code is copied UNMODIFIED to $0CA0-$1F0A. INIT=$1EF3, PLAY=$0E34.
; Apple II zero page saved once at $5D00-$5DFF, restored before returning.
; Foreground operation disables maskable IRQs. It does not take over an IRQ
; vector or invoke Apple II ROM routines while C64 zero page is active.
; WARNING: $0CA0-$1F0A overwrites Applesoft workspace. Use a throwaway
; emulator snapshot, text mode, no disk/OS activity while playing.
; =============================================================================

            ORG $2000

START       JMP INSTALL
STOP        JMP SILENCE
RESTART     JMP INSTALL
STATUS      JMP GET_STATUS

OSZP        EQU $5D00
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
            JSR FIND_SID
            BCC HAS_CARD
            LDA #$02
            STA ERRORCD
            JMP BAD_START
HAS_CARD
            ; X was slot*16 from signature scan. Patch the two SlotIO
            ; operands to physical slot: $C082/$C083 + X, slots 1..7.
            TXA
            CLC
            ADC #$82
            STA CLOCKSEL+1
            CLC
            ADC #$01
            STA CLOCKDATA+1
            JSR VALIDATE_PSID
            BCC VALID_FILE
            LDA #$01
            STA ERRORCD
            JMP BAD_START
VALID_FILE
            JSR COPY_PSID
            JSR SAVE_APPLE_ZP
            LDX #$00
            TXA
CLEAR_C64_ZP
            STA $0000,X
            INX
            BNE CLEAR_C64_ZP

            ; Initialize selected default song 5 (zero-based subtune 4).
            LDA #$04
            JSR $1EF3
            SEI                     ; never allow Apple IRQ using C64 ZP
            LDA #$01
            STA ACTIVE
            LDA KBDSTRB             ; discard stale RUN / RETURN keypress
            JSR READ_CLOCK
            CLC
            LDA NOWLO
            ADC #$D4                ; 20436 = $4FD4 CPU ticks = 20ms
            STA DEADLINELO
            LDA NOWHI
            ADC #$4F
            STA DEADLINEHI

PLAY_LOOP
            JSR WAIT50              ; CPU-cycle absolute deadline
            JSR $0E34               ; original C64 PLAY ($D400 writes untouched)
            LDA KBD
            BMI END_KEY
            ; Advance *absolute* deadline: PLAY execution time does not
            ; accumulate as tempo error. Any overshoot is recovered by
            ; the next wait rather than adding another full delay.
            CLC
            LDA DEADLINELO
            ADC #$D4
            STA DEADLINELO
            LDA DEADLINEHI
            ADC #$4F
            STA DEADLINEHI
            JMP PLAY_LOOP
END_KEY
            LDA KBDSTRB

END_PLAY
            JSR SILENCE
            JSR RESTORE_APPLE_ZP
            LDA #$00
            STA ACTIVE
            PLP                     ; restore original interrupt state
            RTS

BAD_START
            LDX #$00
BAD_MESSAGE
            LDA ERROR_TEXT,X
            BEQ BAD_DONE
            TXA
            PHA
            LDA ERROR_TEXT,X
            ORA #$80
            JSR $FDED               ; Apple II monitor COUT
            PLA
            TAX
            INX
            BNE BAD_MESSAGE
BAD_DONE
            PLP
            RTS

GET_STATUS
            LDA ERRORCD
            RTS

; Scan seven 16-byte SlotIO windows; do not depend on preferred slot 4.
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

; This is deliberately NOT a generic PSID validation.
; Only accept the exact known load/init/play footprint of Mr. Heli.
VALIDATE_PSID
            LDA $6000
            CMP #$50                ; P
            BNE PSID_BAD
            LDA $6001
            CMP #$53                ; S
            BNE PSID_BAD
            LDA $6002
            CMP #$49                ; I
            BNE PSID_BAD
            LDA $6003
            CMP #$44                ; D
            BNE PSID_BAD
            LDA $6006
            BNE PSID_BAD
            LDA $6007
            CMP #$7C                ; data offset
            BNE PSID_BAD
            LDA $6008
            ORA $6009               ; embedded little-endian PRG load address
            BNE PSID_BAD
            LDA $600A
            CMP #$1E
            BNE PSID_BAD
            LDA $600B
            CMP #$F3
            BNE PSID_BAD
            LDA $600C
            CMP #$0E
            BNE PSID_BAD
            LDA $600D
            CMP #$34
            BNE PSID_BAD
            LDA $607C
            CMP #$A0
            BNE PSID_BAD
            LDA $607D
            CMP #$0C
            BNE PSID_BAD
            LDA $607E
            BNE PSID_BAD             ; Mr. Heli payload starts $00,$A9
            LDA $607F
            CMP #$A9
            BNE PSID_BAD
            ; Match "Mr. Heli" so another PSID cannot overwrite unrelated RAM.
            LDA $6016
            CMP #$4D
            BNE PSID_BAD
            LDA $6017
            CMP #$72
            BNE PSID_BAD
            LDA $6018
            CMP #$2E
            BNE PSID_BAD
            LDA $601A
            CMP #$48
            BNE PSID_BAD
            ; Reject partial/corrupted copies of the staged PSID body.
            JSR CHECK_PSID_SUM
            RTS
PSID_BAD
            SEC
            RTS

; 16-bit additive checksum of all 4715 payload bytes, reference $3B46.
; Not a cryptographic signature; catches common incomplete/corrupt transfers.
CHECK_PSID_SUM
            LDA #$00
            STA SUMLO
            STA SUMHI
            LDA #$7E
            STA SUMSRC+1
            LDA #$60
            STA SUMSRC+2
            LDY #$12
SUM_PAGE
            LDX #$00
SUMSRC
            LDA $607E,X
            CLC
            ADC SUMLO
            STA SUMLO
            BCC SUM_NOCARRY
            INC SUMHI
SUM_NOCARRY
            INX
            BNE SUMSRC
            INC SUMSRC+2
            DEY
            BNE SUM_PAGE

            LDX #$00
SUM_TAIL
            LDA $727E,X
            CLC
            ADC SUMLO
            STA SUMLO
            BCC SUM_T_NOCARRY
            INC SUMHI
SUM_T_NOCARRY
            INX
            CPX #$6B
            BNE SUM_TAIL
            LDA SUMLO
            CMP #$46
            BNE BAD_SUM
            LDA SUMHI
            CMP #$3B
            BNE BAD_SUM
            CLC
            RTS
BAD_SUM
            SEC
            RTS

; Copy the original 0x126B-byte payload from $607E into its native $0CA0.
; First 0x1200 bytes: 18 full pages; then $6B bytes at $727E -> $1EA0.
; Self-modified copy operands are inside the resident driver, not the song.
COPY_PSID
            LDA #$7E
            STA COPYSRC+1
            LDA #$60
            STA COPYSRC+2
            LDA #$A0
            STA COPYDST+1
            LDA #$0C
            STA COPYDST+2
            LDY #$12
COPY_PAGE
            LDX #$00
COPYSRC
            LDA $607E,X
COPYDST
            STA $0CA0,X
            INX
            BNE COPYSRC
            INC COPYSRC+2
            INC COPYDST+2
            DEY
            BNE COPY_PAGE

            LDX #$00
COPY_TAIL
            LDA $727E,X
            STA $1EA0,X
            INX
            CPX #$6B
            BNE COPY_TAIL
            RTS

SAVE_APPLE_ZP
            LDX #$00
SAVE_NEXT
            LDA $0000,X
            STA OSZP,X
            INX
            BNE SAVE_NEXT
            RTS

RESTORE_APPLE_ZP
            LDX #$00
RESTORE_NEXT
            LDA OSZP,X
            STA $0000,X
            INX
            BNE RESTORE_NEXT
            RTS

SILENCE
            LDA #$00
            STA SIDCTRL1
            STA SIDCTRL2
            STA SIDCTRL3
            STA SIDVOL
            RTS

; Emulator-only SID slot clock extension (not physical MOS 6581):
; SlotIO index=$1E reads a latched CPU tick LOW; $1F reads that same
; snapshot HIGH. 16-bit wrap is safe for a 20,436-cycle period.
; No audio/SID waveform state is affected by clock-register reads.
READ_CLOCK
            LDA #$1E
CLOCKSEL
            STA $C0C2
CLOCKDATA
            LDA $C0C3
            STA NOWLO
            LDA #$1F
            STA CLOCKSEL
            LDA CLOCKDATA
            STA NOWHI
            RTS

; Signed modulo-16-bit delta: while (now - deadline) < 0, wait.
; Each loop takes only a few dozen 6502 cycles. The host $1E/$1F
; register pair prevents PLAY routine cost from shifting the next beat.
WAIT50
            JSR READ_CLOCK
            SEC
            LDA NOWLO
            SBC DEADLINELO
            LDA NOWHI
            SBC DEADLINEHI
            BMI WAIT50
            RTS

ERROR_TEXT
            .BYTE $53,$49,$44,$20,$32,$41,$20,$45,$52,$52,$4F,$52,$0D,$00

ERRORCD     .BYTE $00
ACTIVE      .BYTE $00
SUMLO       .BYTE $00
SUMHI       .BYTE $00
NOWLO       .BYTE $00
NOWHI       .BYTE $00
DEADLINELO  .BYTE $00
DEADLINEHI  .BYTE $00

            .END
