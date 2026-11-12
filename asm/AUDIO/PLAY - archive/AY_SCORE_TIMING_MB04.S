; AY_SCORE_TIMING_MB04.S — Phase 1.5A.3 / MB-04 v0.1
; Apple II+/6502 + Mockingboard in physical slot 4 (internal SlotN=5).
;
; RUN ALL         CALL 24576  ($6000)
; COUNT IRQ/HGR   CALL 24579  ($6003)
; AY IRQ/HGR      CALL 24582  ($6006)
; AY IRQ/NOP      CALL 24585  ($6009)
; EMERGENCY STOP  CALL 24588  ($600C)
;
; Each phase is bounded: 64 VIA1 Timer1 IRQs, period 768 CPU cycles.
; IRQ handler always acknowledges only VIA1 T1, chains unrelated IRQs,
; preserves X/Y and restores interrupted A via Monitor's $45 scratch.
; Apple II Monitor IRQ dispatcher itself modifies ZP $45. Therefore this
; diagnostic NEVER returns to BASIC with IRQs active; it runs foreground
; exclusively in RAM until cleanup. Do not use another IRQ sound player.
;
; T1 period = latch + 2 = $02FE + 2 = 768 emulated 6502 cycles.
; T2 runs free for the phase; elapsed uses 65535-counter, <65536 cycles.
; Raw T1 low-byte entry samples at $6E00/$6E40/$6E80 (64 each).
; Raw T1 low-byte exit samples at $6C00/$6C40/$6C80 (64 each).
; Result records at $6F10/$6F20/$6F30; see docs and BASIC loader.
; T1 samples + Mockingboard R8 history characterize interrupt jitter.
;
*=$6000
MB_ORB   = $C400
MB_ORA   = $C401
MB_DDRB  = $C402
MB_DDRA  = $C403
MB_T1CL  = $C404
MB_T1CH  = $C405
MB_T2CL  = $C408
MB_T2CH  = $C409
MB_ACR   = $C40B
MB_IFR   = $C40D
MB_IER   = $C40E
IRQ_SOFT = $03FE
MON_A    = $0045
MODE     = $6F02
IRQ_N    = $6F03
VOLUME   = $6F04
HGR_LO   = $6F05
HGR_HI   = $6F06
OLD_IRQL = $6F07
OLD_IRQH = $6F08
OLD_A45  = $6F09
ACTIVE   = $6F0A
T2_LO    = $6F0B
T2_HI    = $6F0C
OFFS     = $6F0D
RES_BASE = $6F10
END_A    = $6C00
END_B    = $6C40
END_C    = $6C80
LAT_A    = $6E00
LAT_B    = $6E40
LAT_C    = $6E80

ENTRY_ALL JMP RUN_ALL       ; $6000
ENTRY_A   JMP COUNT_HGR     ; $6003
ENTRY_B   JMP VOLUME_HGR    ; $6006
ENTRY_C   JMP VOLUME_NOP    ; $6009
ENTRY_STOP JMP STOP_CALL    ; $600C

RUN_ALL  JSR COUNT_HGR
         JSR VOLUME_HGR
         JSR VOLUME_NOP
         RTS
COUNT_HGR
         LDA #$01
         STA MODE
         JMP PHASE_RUN
VOLUME_HGR
         LDA #$02
         STA MODE
         JMP PHASE_RUN
VOLUME_NOP
         LDA #$03
         STA MODE
         JMP PHASE_RUN

; Caller status stays on stack until restored by PLP.
PHASE_RUN
         PHP
         SEI
         LDA #$00
         STA IRQ_N
         STA HGR_LO
         STA HGR_HI
         STA VOLUME
         LDA MON_A
         STA OLD_A45
         LDA IRQ_SOFT
         STA OLD_IRQL
         LDA IRQ_SOFT+1
         STA OLD_IRQH
         LDA #<IRQ_SERVICE
         STA IRQ_SOFT
         LDA #>IRQ_SERVICE
         STA IRQ_SOFT+1
         LDA #$A4
         STA ACTIVE

; Exclusive VIA1 programming: no other Mockingboard/T1 owner.
         LDA #$40
         STA MB_IER             ; disable T1 IRQ, preserve other IER bits
         LDA #$FF
         STA MB_DDRA
         LDA #$07
         STA MB_DDRB
         LDA #$04
         STA MB_ORB             ; /RESET inactive
         LDA #$07
         STA MB_ORA             ; R7 mixer
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$3F
         STA MB_ORA             ; mute tone/noise (DAC still controlled)
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$08
         STA MB_ORA             ; select R8
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$00
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB

; ACR bit6=1 Timer1 free-run (preserve unrelated ACR control bits? NO:
; dedicated diagnostic takes full VIA1 ACR ownership, document this).
         LDA #$40
         STA MB_ACR
; T2 free-running elapsed clock; its IRQ stays disabled in normal setup.
         LDA #$20
         STA MB_IER
         LDA #$FF
         STA MB_T2CL
         STA MB_T2CH
; T1 periodic 768 cycles ($02FE+2).
         LDA #$FE
         STA MB_T1CL
         LDA #$02
         STA MB_T1CH
         LDA #$C0
         STA MB_IER             ; enable bit6

; HGR modes produce real writes to memory $2000-$3FFF while IRQ operates.
; NOP mode offers a regular-instruction foreground jitter reference.
         LDX #$00
         LDA #$20
         STA HGR_READ+2
         STA HGR_WRITE+2
         CLI
         LDA MODE
         CMP #$03
         BEQ FG_NOP
         JMP FG_HGR

FG_NOP   NOP
         NOP
         NOP
         LDA IRQ_N
         CMP #$40
         BCC FG_NOP
         JMP PHASE_END

; Self-modified high byte keeps all HGR page1 (32 pages) available.
FG_HGR
HGR_READ LDA $2000,X
         EOR #$7F
HGR_WRITE STA $2000,X
         INC HGR_LO
         BNE FG_NO_CARRY
         INC HGR_HI
FG_NO_CARRY
         INX
         BNE FG_NO_PAGE
         INC HGR_READ+2
         INC HGR_WRITE+2
         LDA HGR_READ+2
         CMP #$40
         BNE FG_NO_PAGE
         LDA #$20
         STA HGR_READ+2
         STA HGR_WRITE+2
FG_NO_PAGE
         LDA IRQ_N
         CMP #$40
         BCC FG_HGR

PHASE_END
         SEI
; Disable just VIA T1 and clear its pending interrupt BEFORE unhooking.
         LDA #$40
         STA MB_IER
         LDA MB_T1CL
; T2 read low/high while still in exclusive test context.
         LDA MB_T2CL
         EOR #$FF
         STA T2_LO
         LDA MB_T2CH
         EOR #$FF
         STA T2_HI
         JSR STORE_RESULT
         JSR REMOVE_HOOK
         LDA #$00
         STA MB_ORA              ; R8 selected, final mute
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA OLD_A45
         STA MON_A
         PLP
         RTS

; Every result is a 16-byte record indexed by mode (A,B,C).
; +0 magic $A4, +1 mode, +2 IRQs, +3/4 HGR writes,
; +5/6 T2 elapsed, +7/8 T1 latch ($02FE), +9 error ($00).
STORE_RESULT
         LDX #$00
         LDA MODE
         CMP #$02
         BNE STORE_CHECK_C
         LDX #$10
STORE_CHECK_C
         CMP #$03
         BNE STORE_ITEMS
         LDX #$20
STORE_ITEMS
         LDA #$A4
         STA RES_BASE,X
         INX
         LDA MODE
         STA RES_BASE,X
         INX
         LDA IRQ_N
         STA RES_BASE,X
         INX
         LDA HGR_LO
         STA RES_BASE,X
         INX
         LDA HGR_HI
         STA RES_BASE,X
         INX
         LDA T2_LO
         STA RES_BASE,X
         INX
         LDA T2_HI
         STA RES_BASE,X
         INX
         LDA #$FE
         STA RES_BASE,X
         INX
         LDA #$02
         STA RES_BASE,X
         INX
         LDA #$00
         STA RES_BASE,X
         RTS

; Caller holds I=1. Do not restore the soft vector if another owner
; has replaced it since installation.
REMOVE_HOOK
         LDA ACTIVE
         CMP #$A4
         BNE REMOVE_DONE
         LDA IRQ_SOFT
         CMP #<IRQ_SERVICE
         BNE REMOVE_DONE
         LDA IRQ_SOFT+1
         CMP #>IRQ_SERVICE
         BNE REMOVE_DONE
         LDA OLD_IRQL
         STA IRQ_SOFT
         LDA OLD_IRQH
         STA IRQ_SOFT+1
         LDA #$00
         STA ACTIVE
REMOVE_DONE
         RTS

STOP_CALL
         PHP
         SEI
         LDA #$40
         STA MB_IER
         LDA MB_T1CL
         JSR REMOVE_HOOK
         LDA ACTIVE
         BNE STOP_SKIP
         LDA OLD_A45
         STA MON_A
STOP_SKIP
         PLP
         RTS

; --- IRQ service, called by Apple Monitor ROM soft vector ($03FE). ---
; Monitor has already pushed PC/P and saved interrupted A to $45.
; Save X/Y, check our IFR bit, acknowledge by reading T1CL, and sample
; timer phase. AY register R8 remains latched between interrupts.
IRQ_SERVICE
         TXA
         PHA
         TYA
         PHA
         LDA MB_IFR
         AND #$40
         BEQ FOREIGN_IRQ
         LDA MB_T1CL           ; ACK plus low-byte phase sample
         LDX IRQ_N
         LDY MODE
         CPY #$01
         BEQ STORE_LAT_A
         CPY #$02
         BEQ STORE_LAT_B
         STA LAT_C,X
         JMP LAT_STORED
STORE_LAT_A
         STA LAT_A,X
         JMP LAT_STORED
STORE_LAT_B
         STA LAT_B,X
LAT_STORED
         CPY #$01
         BEQ IRQ_COUNT_ONLY
         LDA VOLUME
         EOR #$0F
         STA VOLUME
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
IRQ_COUNT_ONLY
         INC IRQ_N
; Sample timer again near handler exit. (entry-exit) modulo 256 is the
; interior service cost; excludes ROM IRQ entry and RTI epilogue.
         LDA MB_T1CL
         LDX IRQ_N
         DEX
         LDY MODE
         CPY #$01
         BEQ STORE_END_A
         CPY #$02
         BEQ STORE_END_B
         STA END_C,X
         JMP END_STORED
STORE_END_A
         STA END_A,X
         JMP END_STORED
STORE_END_B
         STA END_B,X
END_STORED
         PLA
         TAY
         PLA
         TAX
         LDA MON_A
         RTI
FOREIGN_IRQ
         PLA
         TAY
         PLA
         TAX
         LDA MON_A
         JMP (OLD_IRQL)
