; =============================================================================
; SERIALPRO_RTC_IRQ_TASKSWITCH_DEMO.S
; =============================================================================
;
; Purpose
; -------
; Minimal proof that a Serial Pro 6818 RTC interrupt can pre-empt an ordinary
; Applesoft/DOS foreground task and return cleanly with RTI.
;
; This deliberately contains:
;   - NO HGR
;   - NO mixed-mode window
;   - NO vector-font renderer
;   - NO keyboard polling
;   - NO clock display
;
; If this tiny resident service works while Applesoft remains usable, the core
; task-switching mechanism is proven independently of the HGR clock.
;
; Load address : $6000 / 24576
; Slot         : Serial Pro in slot 2
;
; Entry points
; ------------
;   CALL 24576  ($6000) install RTC 1 Hz IRQ service
;   CALL 24579  ($6003) uninstall and restore previous IRQ / RTC mode
;   CALL 24582  ($6006) clear diagnostic counters
;
; Diagnostic bytes are intentionally fixed immediately after the jump table:
;
;   $6009 / 24585  IRQ_TOTAL_LO   all user IRQ entries, low byte
;   $600A / 24586  IRQ_TOTAL_HI   all user IRQ entries, high byte
;   $600B / 24587  RTC_TOTAL_LO   accepted RTC update IRQs, low byte
;   $600C / 24588  RTC_TOTAL_HI   accepted RTC update IRQs, high byte
;   $600D / 24589  LAST_REG_C     most recently read 6818 Register C
;   $600E / 24590  CHAIN_TOTAL    non-RTC IRQs chained to prior handler
;   $600F / 24591  ACTIVE         $A5 while installed
;
; Suggested Applesoft test
; -------------------------
;   ]BLOAD IRQDEMO,A$6000
;   ]CALL 24576
;   ]PRINT PEEK(24585)+256*PEEK(24586),
;          PEEK(24587)+256*PEEK(24588),PEEK(24589),PEEK(24590)
;
; Repeat the PRINT a few seconds later.  Normally:
;   - IRQ_TOTAL and RTC_TOTAL both increase about once per second
;   - LAST_REG_C is 144 ($90 = IRQF | UF)
;   - CHAIN_TOTAL stays 0
;
; If the machine falls into the Monitor '*' prompt, inspect:
;
;   *6009.6014
;
; That range tells us whether an RTC IRQ was accepted or whether execution
; chained to the pre-existing IRQ vector.
;
; =============================================================================

            ORG     $6000

; Apple II Monitor IRQ interface.
ACC         EQU     $45
IRQLOC      EQU     $03FE

; Serial Pro slot-2 6818 ports.
; $C084 + $20 = $C0A4 address
; $C085 + $20 = $C0A5 data
SERIALOFF   EQU     $20
RTCADR      EQU     $C084
RTCDATA     EQU     $C085

RTC_UIE     EQU     $10
RTC_IRQF_UF EQU     $90

; -----------------------------------------------------------------------------
; Fixed jump table and diagnostics
; -----------------------------------------------------------------------------

START       JMP     INSTALL          ; $6000
REMOVE      JMP     UNINSTALL        ; $6003
CLEAR       JMP     CLEAR_STATS      ; $6006

IRQ_TOTAL_LO
            .BYTE   $00              ; $6009
IRQ_TOTAL_HI
            .BYTE   $00              ; $600A
RTC_TOTAL_LO
            .BYTE   $00              ; $600B
RTC_TOTAL_HI
            .BYTE   $00              ; $600C
LAST_REG_C
            .BYTE   $00              ; $600D
CHAIN_TOTAL
            .BYTE   $00              ; $600E
ACTIVE      .BYTE   $00              ; $600F

OLD_IRQ_LO  .BYTE   $00              ; $6010
OLD_IRQ_HI  .BYTE   $00              ; $6011
OLD_RTC_B   .BYTE   $00              ; $6012
OLD_P       .BYTE   $00              ; $6013
IRQ_ENTRY_A .BYTE   $00              ; $6014
CALL_P      .BYTE   $00              ; $6015

; =============================================================================
; Installer
; =============================================================================

INSTALL
            PHP
            PLA
            STA     CALL_P
            SEI

            LDA     ACTIVE
            CMP     #$A5
            BEQ     INSTALL_ALREADY

; Remember the interrupt state that existed before first installation.
            LDA     CALL_P
            STA     OLD_P

; Save the current Apple II Monitor user-IRQ vector.
            LDA     IRQLOC
            STA     OLD_IRQ_LO
            LDA     IRQLOC+1
            STA     OLD_IRQ_HI

; Save the current 6818 Register B.
            LDY     #SERIALOFF
            LDA     #$0B
            JSR     RTC_REG
            STA     OLD_RTC_B

; Discard stale RTC flags before installing our vector.
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

; Reset diagnostics for a clean experiment.
            JSR     CLEAR_STATS_BODY

; Install our user IRQ handler while CPU IRQs are masked.
            LDA     #<IRQ_HANDLER
            STA     IRQLOC
            LDA     #>IRQ_HANDLER
            STA     IRQLOC+1

; Enable 6818 update-ended interrupts while preserving all other mode bits.
            LDA     #$0B
            STA     RTCADR,Y
            LDA     OLD_RTC_B
            ORA     #RTC_UIE
            STA     RTCDATA,Y

            LDA     #$A5
            STA     ACTIVE

; The stock Apple II normally has no reason to keep IRQ enabled.  This experiment
; deliberately enables maskable IRQ so the Serial Pro can pre-empt Applesoft.
INSTALL_ALREADY
            CLI
            RTS

; =============================================================================
; Uninstall
; =============================================================================

UNINSTALL
            PHP
            PLA
            STA     CALL_P
            SEI

            LDA     ACTIVE
            CMP     #$A5
            BNE     UNINSTALL_NOT_ACTIVE

            LDY     #SERIALOFF

; Restore exact pre-install 6818 Register B.
            LDA     #$0B
            STA     RTCADR,Y
            LDA     OLD_RTC_B
            STA     RTCDATA,Y

; Acknowledge any pending RTC request before restoring the old vector.
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

            LDA     OLD_IRQ_LO
            STA     IRQLOC
            LDA     OLD_IRQ_HI
            STA     IRQLOC+1

            LDA     #$00
            STA     ACTIVE

; Restore only the pre-install IRQ-enable state; do not disturb other flags.
            LDA     OLD_P
            JMP     RESTORE_I

UNINSTALL_NOT_ACTIVE
            LDA     CALL_P
RESTORE_I
            AND     #$04
            BEQ     RESTORE_IRQ_ENABLED
            SEI
            RTS

RESTORE_IRQ_ENABLED
            CLI
            RTS

; =============================================================================
; Clear counters
; =============================================================================

CLEAR_STATS
            PHP
            SEI
            JSR     CLEAR_STATS_BODY
            PLP
            RTS

CLEAR_STATS_BODY
            LDA     #$00
            STA     IRQ_TOTAL_LO
            STA     IRQ_TOTAL_HI
            STA     RTC_TOTAL_LO
            STA     RTC_TOTAL_HI
            STA     CHAIN_TOTAL
            RTS

; =============================================================================
; IRQ handler
; =============================================================================
;
; Apple II+ Monitor IRQ entry does:
;
;       STA ACC
;       PLA
;       PHA
;       ASL A
;       ASL A
;       ASL A
;       BMI BREAK
;       JMP (IRQLOC)
;
; Therefore:
;   - original interrupted A is in ACC ($45)
;   - A on entry here is the Monitor's transformed status value
;   - PC/P are still on the hardware IRQ stack for RTI
;
; We save the transformed A separately so a non-RTC interrupt can be chained
; with the same register state the previous user handler would have received.
; -----------------------------------------------------------------------------

IRQ_HANDLER
            STA     IRQ_ENTRY_A

; Count every entry through the user IRQ vector.
            INC     IRQ_TOTAL_LO
            BNE     IRQ_COUNTED
            INC     IRQ_TOTAL_HI
IRQ_COUNTED

; Preserve foreground X/Y.  The original A remains safely in ACC.
            TXA
            PHA
            TYA
            PHA

; Read/acknowledge 6818 Register C.
            LDY     #SERIALOFF
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

; The update-ended interrupt we want is IRQF|UF = $90.
            AND     #RTC_IRQF_UF
            CMP     #RTC_IRQF_UF
            BNE     IRQ_NOT_RTC

            INC     RTC_TOTAL_LO
            BNE     IRQ_RTC_COUNTED
            INC     RTC_TOTAL_HI
IRQ_RTC_COUNTED

; Restore foreground registers and return directly to interrupted code.
            PLA
            TAY
            PLA
            TAX
            LDA     ACC
            RTI

IRQ_NOT_RTC
            INC     CHAIN_TOTAL

; Restore X/Y before handing the interrupt to the previous handler.
            PLA
            TAY
            PLA
            TAX

; A zero previous vector is safer to swallow than JMP ($0000) during this
; diagnostic experiment.
            LDA     OLD_IRQ_LO
            ORA     OLD_IRQ_HI
            BEQ     IRQ_NO_CHAIN

; Recreate the A value that the old handler would have seen from Monitor IRQ.
            LDA     IRQ_ENTRY_A
            JMP     (OLD_IRQ_LO)

IRQ_NO_CHAIN
            LDA     ACC
            RTI

; =============================================================================
; 6818 register helper
; =============================================================================
; A = register number, Y = SERIALOFF.
; Returns register value in A, preserves Y.

RTC_REG
            STA     RTCADR,Y
            LDA     RTCDATA,Y
            RTS
