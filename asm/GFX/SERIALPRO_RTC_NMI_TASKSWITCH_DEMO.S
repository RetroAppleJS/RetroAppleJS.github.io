; =============================================================================
; SERIALPRO_RTC_NMI_TASKSWITCH_DEMO.S
; =============================================================================
;
; Minimal Apple II+ multitasking proof using the Serial Pro 6818 RTC via NMI.
;
; Why NMI?
; --------
; The Apple II+ Autostart Monitor hardware IRQ vector points to OLDRST, which
; enters the Monitor.  The hardware NMI vector, however, points directly to
; RAM $03FB.  We can therefore install a 3-byte JMP at $03FB and pre-empt
; Applesoft without passing through the Monitor IRQ entry.
;
; Requires an emulator build that routes the Serial Pro 6818 update-ended
; interrupt to NMI (matching the physical card's RTC->NMI switch).
;
; Load address : $6000 / 24576
; Slot         : Serial Pro in slot 2
;
; Entry points:
;   CALL 24576 ($6000) install
;   CALL 24579 ($6003) uninstall
;   CALL 24582 ($6006) clear counters
;
; Diagnostics:
;   $6009 / 24585  NMI_TOTAL_LO
;   $600A / 24586  NMI_TOTAL_HI
;   $600B / 24587  RTC_TOTAL_LO
;   $600C / 24588  RTC_TOTAL_HI
;   $600D / 24589  LAST_REG_C
;   $600E / 24590  UNEXPECTED
;   $600F / 24591  ACTIVE ($A5 installed)
;
; =============================================================================

            ORG     $6000

NMI_RAM     EQU     $03FB

SERIALOFF   EQU     $20
RTCADR      EQU     $C084
RTCDATA     EQU     $C085

RTC_UIE     EQU     $10
RTC_IRQF_UF EQU     $90

START       JMP     INSTALL
REMOVE      JMP     UNINSTALL
CLEAR       JMP     CLEAR_STATS

NMI_TOTAL_LO
            .BYTE   $00
NMI_TOTAL_HI
            .BYTE   $00
RTC_TOTAL_LO
            .BYTE   $00
RTC_TOTAL_HI
            .BYTE   $00
LAST_REG_C
            .BYTE   $00
UNEXPECTED  .BYTE   $00
ACTIVE      .BYTE   $00

OLD_NMI0    .BYTE   $00
OLD_NMI1    .BYTE   $00
OLD_NMI2    .BYTE   $00
OLD_RTC_B   .BYTE   $00
CALL_P      .BYTE   $00

; =============================================================================
; Install
; =============================================================================

INSTALL
            PHP
            PLA
            STA     CALL_P
            SEI
            CLD

            LDA     ACTIVE
            CMP     #$A5
            BEQ     INSTALL_DONE

; Save the three RAM bytes reached directly by hardware NMI.
            LDA     NMI_RAM
            STA     OLD_NMI0
            LDA     NMI_RAM+1
            STA     OLD_NMI1
            LDA     NMI_RAM+2
            STA     OLD_NMI2

; Save current RTC Register B.
            LDY     #SERIALOFF
            LDA     #$0B
            JSR     RTC_REG
            STA     OLD_RTC_B

; Clear stale RTC flags.
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

            JSR     CLEAR_STATS_BODY

; Hardware NMI vector $FFFA points directly to $03FB on the Apple II+.
; Put JMP NMI_HANDLER there.
            LDA     #$4C
            STA     NMI_RAM
            LDA     #<NMI_HANDLER
            STA     NMI_RAM+1
            LDA     #>NMI_HANDLER
            STA     NMI_RAM+2

; Enable update-ended interrupt generation.
            LDA     #$0B
            STA     RTCADR,Y
            LDA     OLD_RTC_B
            ORA     #RTC_UIE
            STA     RTCDATA,Y

            LDA     #$A5
            STA     ACTIVE

INSTALL_DONE
; Restore exactly the caller's interrupt-mask state. NMI does not depend on I.
            LDA     CALL_P
            AND     #$04
            BEQ     INSTALL_CLI
            SEI
            RTS
INSTALL_CLI
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
            CLD

            LDA     ACTIVE
            CMP     #$A5
            BNE     UNINSTALL_DONE

            LDY     #SERIALOFF

; Restore RTC Register B first, so no new update interrupt is generated.
            LDA     #$0B
            STA     RTCADR,Y
            LDA     OLD_RTC_B
            STA     RTCDATA,Y

; Acknowledge pending RTC flags.
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

; Restore original $03FB-$03FD contents.
            LDA     OLD_NMI0
            STA     NMI_RAM
            LDA     OLD_NMI1
            STA     NMI_RAM+1
            LDA     OLD_NMI2
            STA     NMI_RAM+2

            LDA     #$00
            STA     ACTIVE

UNINSTALL_DONE
            LDA     CALL_P
            AND     #$04
            BEQ     UNINSTALL_CLI
            SEI
            RTS
UNINSTALL_CLI
            CLI
            RTS

; =============================================================================
; Clear diagnostics
; =============================================================================

CLEAR_STATS
            PHP
            SEI
            JSR     CLEAR_STATS_BODY
            PLP
            RTS

CLEAR_STATS_BODY
            LDA     #$00
            STA     NMI_TOTAL_LO
            STA     NMI_TOTAL_HI
            STA     RTC_TOTAL_LO
            STA     RTC_TOTAL_HI
            STA     UNEXPECTED
            RTS

; =============================================================================
; NMI handler
; =============================================================================
;
; Unlike the Monitor IRQ path, the Apple II+ NMI vector lands directly at $03FB.
; A/X/Y therefore still contain the interrupted foreground values and must all
; be preserved here.
;
; RTI restores P and PC from the hardware NMI stack frame.
; -----------------------------------------------------------------------------

NMI_HANDLER
            PHA
            TXA
            PHA
            TYA
            PHA

            CLD

            INC     NMI_TOTAL_LO
            BNE     NMI_COUNTED
            INC     NMI_TOTAL_HI
NMI_COUNTED

            LDY     #SERIALOFF
            LDA     #$0C
            JSR     RTC_REG
            STA     LAST_REG_C

            AND     #RTC_IRQF_UF
            CMP     #RTC_IRQF_UF
            BNE     NMI_UNEXPECTED

            INC     RTC_TOTAL_LO
            BNE     NMI_DONE
            INC     RTC_TOTAL_HI
            JMP     NMI_DONE

NMI_UNEXPECTED
            INC     UNEXPECTED

NMI_DONE
            PLA
            TAY
            PLA
            TAX
            PLA
            RTI

; =============================================================================
; 6818 helper
; =============================================================================

RTC_REG
            STA     RTCADR,Y
            LDA     RTCDATA,Y
            RTS
