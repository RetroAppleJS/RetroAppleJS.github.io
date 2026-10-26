; AY_SCORE_TIMING_MB05.S — Phase 1.5A.4 / MB-05 v0.1
; NMOS 6502 / Apple II or II+ / Mockingboard in physical PR#4.
; Internal RetroAppleJS SlotN=5 (host motherboard occupies SlotN=0).
;
; CALL 24576 ($6000) = run all: E1 dry/HGR, E1 AY/HGR, E1 AY/NOP
; CALL 24579 ($6003) = dry E1 decode + HGR, no score writes
; CALL 24582 ($6006) = timed E1 score + HGR
; CALL 24585 ($6009) = timed E1 score + NOP foreground
; CALL 24588 ($600C) = emergency IRQ hook removal (best effort)
;
; REAL E1 token layout: unsigned LEB128 deltaCycles, packed AY id, value.
; Deliberate MB-05 v0.1 SUBSET: 64 events, chip0 R8/R9 only; delta
; is zero OR one two-byte ULEB128 encoding of 1024,2048.
; Tick period 1024 cycles, so score deadlines must be on 1024-cycle grid.
; Overall score duration = 49,152 cycles (48 Timer 1 IRQs).
; Timer2 elapsed clock drives deadlines, so IRQ coalescing is detectable.
; Whole-256-cycle late events are counted (subtick jitter is in history).
; This is an actual event-driven decoder/scheduler; it is NOT yet an
; arbitrary-resolution E1 decoder, nor a full .aysb file player.
;
; Uses 6522 T1 free-run: latch $03FE gives 1024-cycle IRQ period (N+2).
; One handler may dispatch multiple zero-delta events within one tick.
; Timestamp differences are measured through Mockingboard history.
;
; Dedicated session required: code at $6000, HGR page 1 used for writes.
; 16-bit Timer2 IRQ samples: entry low $6800/$6880/$6900,
; entry high $6C00/$6C80/$6D00, exit low $6A00/$6A80/$6B00,
; exit high $6D80/$6E00/$6E80; decode spans $7000/$7040/$7080.
; 16-bit samples allow >255-cycle interrupt service measurements.
; 16-byte result records at $6F40/$6F50/$6F60; scratch at $6F00-$6F1F.
; Never execute another IRQ player simultaneously. Timer 1/2 existing
; counters are NOT preserved. Do not run outside a disposable session.
;
; Apple II Monitor IRQ dispatch saves interrupted A in zero page $45;
; it is restored on returning to BASIC, not on every foreground instruction.
;
*=$6000
MB_ORB    = $C400
MB_ORA    = $C401
MB_DDRB   = $C402
MB_DDRA   = $C403
MB_T1CL   = $C404
MB_T1CH   = $C405
MB_T2CL   = $C408
MB_T2CH   = $C409
MB_ACR    = $C40B
MB_IFR    = $C40D
MB_IER    = $C40E
IRQ_SOFT  = $03FE
MON_A     = $0045
MODE      = $6F00
IRQ_N     = $6F01
EVENT_N   = $6F02
NOW_HI    = $6F03
DUE_HI    = $6F04
STREAM_POS= $6F05
TOKEN_ID  = $6F06
TOKEN_VAL = $6F07
SELECTED  = $6F08
HGR_LO    = $6F09
HGR_HI    = $6F0A
LATE_N    = $6F0B
MAX_LATE  = $6F0C
DONE      = $6F0D
OLD_IRQL  = $6F0E
OLD_IRQH  = $6F0F
OLD_A45   = $6F10
ACTIVE    = $6F11
T2_LO     = $6F12
T2_HI     = $6F13
OLD_ACR   = $6F14
OLD_DDRA  = $6F15
OLD_DDRB  = $6F16
OLD_IER   = $6F17
DEC_START = $6F18
DEC_STOP  = $6F19
ERROR     = $6F1A
EVENT_TMP = $6F1B
RESULTS   = $6F40

ENTRY_ALL JMP RUN_ALL
ENTRY_A   JMP DRY_HGR
ENTRY_B   JMP SCORE_HGR
ENTRY_C   JMP SCORE_NOP
ENTRY_STOP JMP STOP_CALL

RUN_ALL  JSR DRY_HGR
         JSR SCORE_HGR
         JSR SCORE_NOP
         RTS
DRY_HGR
         LDA #$01
         STA MODE
         JMP PHASE_RUN
SCORE_HGR
         LDA #$02
         STA MODE
         JMP PHASE_RUN
SCORE_NOP
         LDA #$03
         STA MODE
         JMP PHASE_RUN

PHASE_RUN
         PHP
         SEI
         LDA #$00
         STA IRQ_N
         STA EVENT_N
         STA NOW_HI
         STA DUE_HI
         STA STREAM_POS
         STA HGR_LO
         STA HGR_HI
         STA LATE_N
         STA MAX_LATE
         STA DONE
         STA ERROR
         STA T2_LO
         STA T2_HI
         LDA MB_IER
         STA OLD_IER
         AND #$60
         BEQ NO_TIMER_OWNER
         LDA #$04
         STA ERROR
         JMP ABORT_EARLY
NO_TIMER_OWNER
         LDA MON_A
         STA OLD_A45
         LDA MB_ACR
         STA OLD_ACR
         LDA MB_DDRA
         STA OLD_DDRA
         LDA MB_DDRB
         STA OLD_DDRB
         LDA IRQ_SOFT
         STA OLD_IRQL
         LDA IRQ_SOFT+1
         STA OLD_IRQH
         LDA #<IRQ_SERVICE
         STA IRQ_SOFT
         LDA #>IRQ_SERVICE
         STA IRQ_SOFT+1
         LDA #$A5
         STA ACTIVE

; AY initialization is outside elapsed/IRQ measurements.
         LDA #$FF
         STA MB_DDRA
         LDA #$07
         STA MB_DDRB
         LDA #$04
         STA MB_ORB
         LDA #$07
         STA MB_ORA
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$3F
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$08
         STA MB_ORA
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$08
         STA SELECTED
         LDA #$00
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB

; Pre-decode first token (due at tick 1 = 1024 CPU cycles).
         JSR NEXT_TOKEN
         LDA ERROR
         BEQ INSTALL_TIMER
         JMP PHASE_END
INSTALL_TIMER
         LDA #$40
         STA MB_ACR            ; free-running T1
         LDA #$20
         STA MB_IER            ; disable T2 IRQ
         LDA #$FF
         STA MB_T2CL
         STA MB_T2CH
         LDA #$FE
         STA MB_T1CL
         LDA #$03
         STA MB_T1CH
         LDA #$C0
         STA MB_IER            ; enable T1 IRQ
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
         LDA DONE
         BEQ FG_NOP
         JMP PHASE_END

FG_HGR
HGR_READ LDA $2000,X
         EOR #$7F
HGR_WRITE STA $2000,X
         INC HGR_LO
         BNE HGR_NO_CARRY
         INC HGR_HI
HGR_NO_CARRY
         INX
         BNE HGR_NO_PAGE
         INC HGR_READ+2
         INC HGR_WRITE+2
         LDA HGR_READ+2
         CMP #$40
         BNE HGR_NO_PAGE
         LDA #$20
         STA HGR_READ+2
         STA HGR_WRITE+2
HGR_NO_PAGE
         LDA DONE
         BEQ FG_HGR

PHASE_END
         SEI
         LDA #$40
         STA MB_IER            ; mask T1
         LDA MB_T1CL           ; acknowledge any pending T1
         LDA MB_T2CL
         EOR #$FF
         STA T2_LO
         LDA MB_T2CH
         EOR #$FF
         STA T2_HI
         JSR REMOVE_HOOK
; Mute BOTH AY amplitude registers before releasing VIA port ownership.
         LDA #$08
         STA MB_ORA
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
         LDA #$09
         STA MB_ORA
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
         LDA OLD_ACR
         STA MB_ACR
         LDA OLD_DDRA
         STA MB_DDRA
         LDA OLD_DDRB
         STA MB_DDRB
; The physical ORA/ORB output latches cannot be safely restored without
; risking unintended AY transactions; user must own this VIA exclusively.
         JSR STORE_RESULT
         LDA OLD_A45
         STA MON_A
         PLP
         RTS

ABORT_EARLY
         JSR STORE_RESULT
         PLP
         RTS

STORE_RESULT
         LDX #$00
         LDA MODE
         CMP #$02
         BNE STORE_CHECK3
         LDX #$10
STORE_CHECK3
         CMP #$03
         BNE STORE_WRITE
         LDX #$20
STORE_WRITE
         LDA #$A5
         STA RESULTS,X
         INX
         LDA MODE
         STA RESULTS,X
         INX
         LDA IRQ_N
         STA RESULTS,X
         INX
         LDA EVENT_N
         STA RESULTS,X
         INX
         LDA HGR_LO
         STA RESULTS,X
         INX
         LDA HGR_HI
         STA RESULTS,X
         INX
         LDA T2_LO
         STA RESULTS,X
         INX
         LDA T2_HI
         STA RESULTS,X
         INX
         LDA LATE_N
         STA RESULTS,X
         INX
         LDA MAX_LATE
         STA RESULTS,X
         INX
         LDA STREAM_POS
         STA RESULTS,X
         INX
         LDA ERROR
         STA RESULTS,X
         RTS

REMOVE_HOOK
         LDA ACTIVE
         CMP #$A5
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
         BNE STOP_NO_RESTORE
         LDA OLD_A45
         STA MON_A
STOP_NO_RESTORE
         PLP
         RTS

; ROM soft IRQ handler: ROM saves A at $45; preserve X/Y here.
IRQ_SERVICE
         TXA
         PHA
         TYA
         PHA
         LDA MB_IFR
         AND #$40
         BNE OWN_IRQ
         JMP FOREIGN_IRQ
OWN_IRQ
         LDA MB_T1CL          ; ACK T1 (only once per IRQ)
         LDA MB_T2CL          ; CPU-cycle-resolution sample, low
         LDX IRQ_N
         LDY MODE
         CPY #$01
         BEQ ENTRY_A_SAMPLE
         CPY #$02
         BEQ ENTRY_B_SAMPLE
         STA $6900,X
         JMP ENTRY_DONE
ENTRY_A_SAMPLE
         STA $6800,X
         JMP ENTRY_DONE
ENTRY_B_SAMPLE
         STA $6880,X
ENTRY_DONE
         LDA MB_T2CH          ; entry high, near entry low
         LDY MODE
         CPY #$01
         BEQ ENTRY_HA
         CPY #$02
         BEQ ENTRY_HB
         STA $6D00,X
         JMP ENTRY_HD
ENTRY_HA
         STA $6C00,X
         JMP ENTRY_HD
ENTRY_HB
         STA $6C80,X
ENTRY_HD
; Absolute score time from Timer 2, NOT merely number of IRQs serviced.
; Timer2 starts at $FFFF and decrements once per CPU cycle. Complement
; high byte yields elapsed 256-cycle units (up to 65535 cycles). If IRQs
; were temporarily masked/coalesced, the score clock catches up.
         EOR #$FF
         STA NOW_HI
         INC IRQ_N
         LDA IRQ_N
         CMP #$7F
         BCC SCHED_CHECK
         LDA #$02
         STA ERROR
         LDA #$01
         STA DONE
         JMP IRQ_EXIT_SAMPLE
SCHED_CHECK
         LDA NOW_HI
         CMP DUE_HI
         BCS EVENT_DUE
         JMP IRQ_EXIT_SAMPLE
EVENT_DUE
         LDA NOW_HI
         SEC
         SBC DUE_HI
         BEQ EVENT_ON_TIME
         STA EVENT_TMP
         INC LATE_N
         CMP MAX_LATE
         BCC EVENT_ON_TIME
         STA MAX_LATE
EVENT_ON_TIME
         LDA MODE
         CMP #$01
         BEQ EVENT_SKIP_AY
         LDA TOKEN_ID
         CMP SELECTED
         BEQ EVENT_SELECTED
         STA SELECTED
         STA MB_ORA
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
EVENT_SELECTED
         LDA TOKEN_VAL
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
EVENT_SKIP_AY
         INC EVENT_N
         LDA EVENT_N
         CMP #$40
         BNE EVENT_MORE
         LDA #$01
         STA DONE
         JMP IRQ_EXIT_SAMPLE
EVENT_MORE
         LDA MB_T2CL
         STA DEC_START
         JSR NEXT_TOKEN
         LDA MB_T2CL
         STA DEC_STOP
         SEC
         LDA DEC_START
         SBC DEC_STOP
         LDX EVENT_N
         DEX
         LDY MODE
         CPY #$01
         BEQ DEC_A_SAMPLE
         CPY #$02
         BEQ DEC_B_SAMPLE
         STA $7080,X
         JMP DEC_DONE
DEC_A_SAMPLE
         STA $7000,X
         JMP DEC_DONE
DEC_B_SAMPLE
         STA $7040,X
DEC_DONE
         LDA ERROR
         BEQ COMPARE_NEXT_DUE
         LDA #$01
         STA DONE
         JMP IRQ_EXIT_SAMPLE
COMPARE_NEXT_DUE
         LDA NOW_HI
         CMP DUE_HI
         BCC IRQ_EXIT_SAMPLE
         JMP EVENT_DUE
IRQ_EXIT_SAMPLE
         LDA MB_T2CL
         LDX IRQ_N
         DEX
         LDY MODE
         CPY #$01
         BEQ EXIT_A_SAMPLE
         CPY #$02
         BEQ EXIT_B_SAMPLE
         STA $6B00,X
         JMP IRQ_RETURN
EXIT_A_SAMPLE
         STA $6A00,X
         JMP IRQ_RETURN
EXIT_B_SAMPLE
         STA $6A80,X
IRQ_RETURN
         LDA MB_T2CH
         LDX IRQ_N
         DEX
         LDY MODE
         CPY #$01
         BEQ EXIT_HA
         CPY #$02
         BEQ EXIT_HB
         STA $6E80,X
         JMP EXIT_HD
EXIT_HA
         STA $6D80,X
         JMP EXIT_HD
EXIT_HB
         STA $6E00,X
EXIT_HD
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

; READ NEXT E1 token. Strict subset ULEB128: 0 or $80,(2|4|6),
; representing delta 0/1024/2048 cycles. All are exact tick multiples.
; Text and binary score are derived from this literal HEX payload.
NEXT_TOKEN
         LDY STREAM_POS
         LDA E1_BYTES,Y
         BEQ DELTA_ZERO
         CMP #$80
         BEQ DELTA_VAR2
         JMP TOKEN_BAD
DELTA_VAR2
         INY
         LDA E1_BYTES,Y
         CMP #$08
         BEQ DELTA_OK
         CMP #$10
         BEQ DELTA_OK
         JMP TOKEN_BAD
DELTA_OK
         LSR
         CLC
         ADC DUE_HI
         STA DUE_HI
DELTA_ZERO
         INY
         LDA E1_BYTES,Y
         CMP #$08
         BEQ ID_OK
         CMP #$09
         BEQ ID_OK
         JMP TOKEN_BAD
ID_OK
         STA TOKEN_ID
         INY
         LDA E1_BYTES,Y
         CMP #$10
         BCC VALUE_OK
         JMP TOKEN_BAD
VALUE_OK
         STA TOKEN_VAL
         INY
         STY STREAM_POS
         RTS
TOKEN_BAD
         LDA #$03
         STA ERROR
         RTS

E1_BYTES
         HEX 8008080F000800801008098008090300
         HEX 09008008080F80080800000900800808
         HEX 0F000800801008098008090300090080
         HEX 08080F800808000009008008080F0008
         HEX 0080100809800809030009008008080F
         HEX 800808000009008008080F0008008010
         HEX 0809800809030009008008080F800808
         HEX 000009008008080F0008008010080980
         HEX 0809030009008008080F800808000009
         HEX 008008080F0008008010080980080903
         HEX 0009008008080F800808000009008008
         HEX 080F0008008010080980080903000900
         HEX 8008080F800808000009008008080F00
         HEX 08008010080980080903000900800808
         HEX 0F80080800000900
