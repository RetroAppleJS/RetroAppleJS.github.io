; ============================================================================
; SID PHASE 2C.1 — CPU-timed IRQ diagnostic (Apple II / II+; SLOT 4)
; ============================================================================
; Assembly is the single source of truth. This intentionally DOES NOT run
; PSID INIT/PLAY; it proves a background timer/IRQ with foreground execution.
;
; CALL 6144 : Start 50 Hz (20,436 CPU ticks), return to Applesoft
; CALL 6147 : Start 60 Hz (17,030 CPU ticks), return to Applesoft
; CALL 6150 : Stop timer and restore previous soft IRQ vector
;
; Monitor IRQ entry at $FA40 stores A in $45 before reaching ($03FE).
; This unavoidable Monitor zero-page side effect makes 2C.1 a diagnostic,
; NOT general-purpose zero-page-transparent background playback yet.
; Installer at $1800, IRQ handler at $9300, state in $93F0-$93F7.
; No writes to ProntoDOS RAM $9600+; don't remount/replace card while active.
; Slot 4 timer writes: $C0C8 low, $C0C9 high, $C0CA enable,
; $C0CB ACK. Status: select $1D at $C0C2, read $C0C3.
; Original SID index/data reads and writes remain intact.
; ============================================================================
            ORG $1800
PUBLIC      JMP INSTALL_PAL
PUB_NTSC    JMP INSTALL_NTSC
PUB_STOP    JMP STOP_TIMER

IRQLOC      EQU $03FE
SID_INDEX   EQU $C0C2
SID_DATA    EQU $C0C3
TMR_LOW     EQU $C0C8
TMR_HIGH    EQU $C0C9
TMR_CTRL    EQU $C0CA
TMR_ACK     EQU $C0CB
IRQ_ENTRY   EQU $9300
PREV_IRQ    EQU $93F0
SELECT_SAVE EQU $93F2
IRQCOUNT    EQU $93F3
ACTIVE      EQU $93F5
PERIOD_LO   EQU $93F6
PERIOD_HI   EQU $93F7
PRIOR_I     EQU $93F8

INSTALL_PAL
            LDA #$D4     ; $4FD4 = 20436 Apple II CPU ticks
            STA PERIOD_LO
            LDA #$4F
            STA PERIOD_HI
            JMP INSTALL
INSTALL_NTSC
            LDA #$86     ; $4286 = 17030 Apple II CPU ticks
            STA PERIOD_LO
            LDA #$42
            STA PERIOD_HI
INSTALL
            PHP
            SEI
            LDA ACTIVE
            BNE ALREADY_INSTALLED
            ; Preserve the previous IRQ mask: installing the service must
            ; explicitly enable maskable IRQ even after a ROM reset with I=1.
            PLA
            PHA
            AND #$04
            STA PRIOR_I
            ; Keep previous handler for foreign IRQ sources.
            LDA IRQLOC
            STA PREV_IRQ
            LDA IRQLOC+1
            STA PREV_IRQ+1
            LDA #<IRQ_ENTRY
            STA IRQLOC
            LDA #>IRQ_ENTRY
            STA IRQLOC+1
            LDA #$00
            STA IRQCOUNT
            STA IRQCOUNT+1
            LDA #$01
            STA ACTIVE
            ; Set timer reload while disabled.
            LDA #$00
            STA TMR_CTRL
            LDA PERIOD_LO
            STA TMR_LOW
            LDA PERIOD_HI
            STA TMR_HIGH
            LDA #$01
            STA TMR_CTRL
ALREADY_INSTALLED
            PLP
            CLI
            RTS

STOP_TIMER
            PHP
            SEI
            LDA #$00
            STA TMR_CTRL
            LDA ACTIVE
            BEQ STOP_DONE
            ; Do not dismantle a handler installed later by another owner.
            LDA IRQLOC
            CMP #<IRQ_ENTRY
            BNE STOP_DONE
            LDA IRQLOC+1
            CMP #>IRQ_ENTRY
            BNE STOP_DONE
            LDA PREV_IRQ
            STA IRQLOC
            LDA PREV_IRQ+1
            STA IRQLOC+1
            LDA #$00
            STA ACTIVE
            LDA PRIOR_I
            BEQ RESTORE_UNMASKED
            PLP
            SEI
            RTS
RESTORE_UNMASKED
            PLP
            CLI
            RTS
STOP_DONE   PLP
            RTS

            ORG $9300
; The Apple II ROM has already pushed PC/P and stored interrupted A at $45.
; This handler preserves X/Y on the current stack, uses only private state,
; acknowledges ONLY the SID timer, then resumes with RTI. Non-SID IRQs
; chain to the previous ROM-soft-vector owner.
IRQ_HANDLER
            TXA
            PHA
            TYA
            PHA
            LDA SID_INDEX
            STA SELECT_SAVE
            LDA #$1D
            STA SID_INDEX
            LDA SID_DATA
            AND #$01
            BEQ NOT_OUR_IRQ
            LDA #$01
            STA TMR_ACK
            LDA SELECT_SAVE
            STA SID_INDEX
            INC IRQCOUNT
            BNE IRQ_DONE
            INC IRQCOUNT+1
IRQ_DONE
            PLA
            TAY
            PLA
            TAX
            LDA $45
            RTI
NOT_OUR_IRQ
            LDA SELECT_SAVE
            STA SID_INDEX
            PLA
            TAY
            PLA
            TAX
            LDA $45
            JMP (PREV_IRQ)

            ORG $93F0
IRQ_STATE
            .BYTE $00,$00    ; PREV_IRQ
            .BYTE $00        ; SELECT_SAVE
            .BYTE $00,$00    ; IRQCOUNT
            .BYTE $00        ; ACTIVE
            .BYTE $D4,$4F    ; PERIOD_LO/HIGH PAL default
            .BYTE $00        ; PRIOR_I: original CPU interrupt-mask bit
            .END
