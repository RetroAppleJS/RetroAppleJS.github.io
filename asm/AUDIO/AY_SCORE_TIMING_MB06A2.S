; AY_SCORE_TIMING_MB06A2.S — Phase 1.5A.6 / MB-06A.2 v0.1
; NMOS 6502 / Apple II or II+ / Mockingboard in physical PR#4.
; Internal RetroAppleJS SlotN=5 (host motherboard occupies SlotN=0).
;
; CALL 24576 ($6000) = run all: E1 dry/HGR, E1 AY/HGR, E1 AY/NOP
; CALL 24579 ($6003) = dry E1 decode + HGR, no score writes
; CALL 24582 ($6006) = timed E1 score + HGR
; CALL 24585 ($6009) = timed E1 score + NOP foreground
; CALL 24588 ($600C) = emergency IRQ hook removal (best effort)
; CALL 24591 ($600F) = LONG score (128 events) / HGR: >2 Timer2 wraps, >256 E1 bytes
; CALL 24594 ($6012) = FULL AY0 R0-R13 register dispatch / HGR
;
; E1 tokens: bounded ULEB128 delta cycles (up to 4 bytes), AY0 R0-R13, value.
; Mode 5 exercises all 14 AY0 musical registers with validated masks and R13 retrigger.
; Modes 1-4 retain byte-identical MB06A1 fixtures and registered event sequences.
; Diagnostics relocated to $8000-$92FF so the larger assembly fits $6000-$6EFF.
; Deltas must be multiples of 1024 cycles, encoded as unsigned LEB128.
; Time is extended to 16 bits in 256-cycle units (16,777,216-cycle span).
; Timer2 high-byte wraps are counted from adjacent T1 IRQ observations.
; IMPORTANT: no <=65536-cycle TIMER2 sampling gap is allowed.
; Modes 1-3 use original 64-event/232-byte MB05 fixture (48 IRQs).
; Mode 4 appends its second 64-event pass after a 65536-cycle delay:
; total 128 events, 465 bytes, 159 IRQs, and >2 Timer2 wraps.
; Timer 1 period 1024 cycles. This remains a test, not a generic player.
;
; Uses 6522 T1 free-run: latch $03FE gives 1024-cycle IRQ period (N+2).
; One handler may dispatch multiple zero-delta events within one tick.
; Timestamp differences are measured through Mockingboard history.
;
; Dedicated session required: code at $6000, HGR page 1 used for writes.
; 16-bit Timer2 IRQ samples in $8000-$8FFF, decoder spans $9000-$92FF.
; Mode 5 samples form 256-entry rings (IRQ/event indices wrap).
; 16-bit samples use coherent high/low/high retries to avoid rollover skew.
; SNAP_RETRIES at $6F1E and result record byte 12 count retries.
; 16-bit samples allow >255-cycle interrupt service measurements.
; 24-byte results at $6F40/$6F58/$6F70/$6F88/$6FA0; scratch $6F00-$6F2B.
; Long-mode samples are $8200/$8600/$8A00/$8E00, decoder at $9100.
; E1 input is a build-validated embedded score; NOT untrusted external bytes.
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
NOW_LO    = $6F03
DUE_LO    = $6F04
STREAM_LO = $6F05
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
SNAP_HI   = $6F1C
SNAP_LO   = $6F1D
SNAP_RETRIES = $6F1E
NOW_HI    = $6F20  ; Timer2 65536-cycle wrap epoch
NOW_PREV  = $6F21  ; preceding Timer2 high-byte complement
DUE_HI    = $6F22  ; absolute due time in 256-cycle units, high byte
STREAM_HI = $6F23  ; E1 byte offset high
EVENT_HI  = $6F24
IRQ_HI    = $6F25
DELTA_LO  = $6F26  ; ULEB delta /256 low
DELTA_HI  = $6F27  ; ULEB delta /256 high
DELTA_TMP = $6F28
SCORE_LEN_LO = $6F29
SCORE_LEN_HI = $6F2A
TARGET_EVENTS = $6F2B
RESULTS   = $6F40
REG_SCORE_BYTES = 658 ; patched by fixture generator
REG_SCORE_EVENTS = 179 ; patched by fixture generator

ENTRY_ALL JMP RUN_ALL
ENTRY_A   JMP DRY_HGR
ENTRY_B   JMP SCORE_HGR
ENTRY_C   JMP SCORE_NOP
ENTRY_STOP JMP STOP_CALL
ENTRY_LONG JMP LONG_HGR
ENTRY_REGS JMP REGS_HGR

RUN_ALL  JSR DRY_HGR
         JSR SCORE_HGR
         JSR SCORE_NOP
         JSR LONG_HGR
         JSR REGS_HGR
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
LONG_HGR
         LDA #$04
         STA MODE
         JMP PHASE_RUN
REGS_HGR
         LDA #$05
         STA MODE
         JMP PHASE_RUN

PHASE_RUN
         PHP
         SEI
         LDA #$00
         STA IRQ_N
         STA EVENT_N
         STA NOW_LO
         STA NOW_HI
         STA NOW_PREV
         STA DUE_LO
         STA DUE_HI
         STA STREAM_LO
         STA STREAM_HI
         STA EVENT_HI
         STA IRQ_HI
         STA DELTA_LO
         STA DELTA_HI
         STA SCORE_LEN_HI
         STA HGR_LO
         STA HGR_HI
         STA LATE_N
         STA MAX_LATE
         STA DONE
         STA ERROR
         STA T2_LO
         STA T2_HI
         STA SNAP_HI
         STA SNAP_LO
         STA SNAP_RETRIES
         LDA #<E1_BYTES
         STA BYTE_FETCH+1
         LDA #>E1_BYTES
         STA BYTE_FETCH+2
         LDA #232
         STA SCORE_LEN_LO
         LDA #<64
         STA TARGET_EVENTS
         LDA MODE
         CMP #$04
         BNE SHORT_SCORE
         LDA #209
         STA SCORE_LEN_LO
         LDA #1
         STA SCORE_LEN_HI
         LDA #<128
         STA TARGET_EVENTS
SHORT_SCORE
         LDA MODE
         CMP #$05
         BNE SCORE_CHOSEN
         LDA #<E1_REGS
         STA BYTE_FETCH+1
         LDA #>E1_REGS
         STA BYTE_FETCH+2
         LDA #<REG_SCORE_BYTES
         STA SCORE_LEN_LO
         LDA #>REG_SCORE_BYTES
         STA SCORE_LEN_HI
         LDA #REG_SCORE_EVENTS
         STA TARGET_EVENTS
SCORE_CHOSEN
         JSR PREP_SAMPLE_TARGETS
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

; Mode 5 explicitly clears channel C before starting the musical coverage score.
         LDA MODE
         CMP #$05
         BNE INIT_DONE
         LDA #$0A
         STA MB_ORA
         LDA #$07
         STA MB_ORB
         LDA #$04
         STA MB_ORB
         LDA #$0A
         STA SELECTED
         LDA #$00
         STA MB_ORA
         LDA #$06
         STA MB_ORB
         LDA #$04
         STA MB_ORB
INIT_DONE
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
         JSR READ_T2_COHERENT
         LDA SNAP_LO
         EOR #$FF
         STA T2_LO
         LDA SNAP_HI
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
; Mode 5 also mutes channel C on exit; it may have active envelope output.
         LDA MODE
         CMP #$05
         BNE MUTE_COMPLETE
         LDA #$0A
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
MUTE_COMPLETE
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
         LDX #$18
STORE_CHECK3
         CMP #$03
         BNE STORE_CHECK4
         LDX #$30
STORE_CHECK4
         CMP #$04
         BNE STORE_CHECK5
         LDX #$48
STORE_CHECK5
         CMP #$05
         BNE STORE_WRITE
         LDX #$60
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
         LDA STREAM_LO
         STA RESULTS,X
         INX
         LDA ERROR
         STA RESULTS,X
         INX
         LDA SNAP_RETRIES
         STA RESULTS,X
         INX
         LDA STREAM_HI
         STA RESULTS,X
         INX
         LDA NOW_LO
         STA RESULTS,X
         INX
         LDA NOW_HI
         STA RESULTS,X
         INX
         LDA EVENT_HI
         STA RESULTS,X
         INX
         LDA IRQ_HI
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

; Precompute diagnostic store destinations once, while interrupts are masked.
; This replaces five-way branches inside the high-frequency IRQ handler.
PREP_SAMPLE_TARGETS
         LDX MODE
         DEX
         LDA SAMPLE_PAGE_OFFSET,X
         CLC
         ADC #$80
         STA ENTRY_LOW_STORE+2
         ADC #$04
         STA ENTRY_HIGH_STORE+2
         ADC #$04
         STA EXIT_LOW_STORE+2
         ADC #$04
         STA EXIT_HIGH_STORE+2
         LDA SAMPLE_PAGE_LOW,X
         STA ENTRY_LOW_STORE+1
         STA ENTRY_HIGH_STORE+1
         STA EXIT_LOW_STORE+1
         STA EXIT_HIGH_STORE+1
         LDA DECODER_PAGE_HIGH,X
         STA DECODER_STORE+2
         LDA DECODER_PAGE_LOW,X
         STA DECODER_STORE+1
         RTS
SAMPLE_PAGE_OFFSET
         HEX 0000010203
SAMPLE_PAGE_LOW
         HEX 0080000000
DECODER_PAGE_HIGH
         HEX 9090909192
DECODER_PAGE_LOW
         HEX 0040800000

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
         JSR READ_T2_COHERENT
         LDA SNAP_LO          ; coherent IRQ entry timer sample low
         LDX IRQ_N
ENTRY_LOW_STORE STA $8000,X  ; destination patched once during PHASE_RUN
         LDA SNAP_HI
ENTRY_HIGH_STORE STA $8400,X ; same for 16-bit high byte
; Timer2 high byte complement gives low byte of elapsed /256.
; Each 65536-cycle wrap makes this byte decrease; extend via epoch.
; Must service T1 often enough that TWO Timer2 wraps cannot be missed.
         EOR #$FF
         PHA
         CMP NOW_PREV
         BCS CLOCK_CONTINUES
         INC NOW_HI
CLOCK_CONTINUES
         PLA
         STA NOW_LO
         STA NOW_PREV
         INC IRQ_N
         BNE IRQ_COUNT_OK
         INC IRQ_HI
IRQ_COUNT_OK
         LDA MODE
         CMP #$05
         BEQ REG_IRQ_LIMIT
         LDA IRQ_HI
         BEQ SCHED_CHECK
         JMP TOO_MANY_IRQS
REG_IRQ_LIMIT
         LDA IRQ_HI
         CMP #$10       ; mode 5: hard stop at 4096 service interrupts
         BCC SCHED_CHECK
TOO_MANY_IRQS
         LDA #$02
         STA ERROR
         LDA #$01
         STA DONE
         JMP IRQ_EXIT_SAMPLE
SCHED_CHECK
         LDA NOW_HI
         CMP DUE_HI
         BCC IRQ_NOT_DUE
         BNE EVENT_DUE
         LDA NOW_LO
         CMP DUE_LO
         BCS EVENT_DUE
IRQ_NOT_DUE
         JMP IRQ_EXIT_SAMPLE
EVENT_DUE
         LDA NOW_LO
         SEC
         SBC DUE_LO
         STA EVENT_TMP
         LDA NOW_HI
         SBC DUE_HI
         BNE EVENT_VERY_LATE
         LDA EVENT_TMP
         BEQ EVENT_ON_TIME
         JMP EVENT_LATE_COUNT
EVENT_VERY_LATE
         LDA #$FF
EVENT_LATE_COUNT
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
         BNE EVENT_COMPARE_N
         INC EVENT_HI
EVENT_COMPARE_N
         LDA EVENT_HI
         BNE EVENT_MORE
         LDA EVENT_N
         CMP TARGET_EVENTS
         BNE EVENT_MORE
; Verify entire expected embedded payload has been consumed exactly.
         LDA STREAM_HI
         CMP SCORE_LEN_HI
         BNE SCORE_LENGTH_BAD
         LDA STREAM_LO
         CMP SCORE_LEN_LO
         BEQ SCORE_LENGTH_OK
SCORE_LENGTH_BAD
         LDA #$03
         STA ERROR
SCORE_LENGTH_OK
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
DECODER_STORE STA $9000,X
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
         BEQ COMPARE_LO
         JMP EVENT_DUE
COMPARE_LO
         LDA NOW_LO
         CMP DUE_LO
         BCC IRQ_EXIT_SAMPLE
         JMP EVENT_DUE
IRQ_EXIT_SAMPLE
         JSR READ_T2_COHERENT
         LDA SNAP_LO
         LDX IRQ_N
         DEX
EXIT_LOW_STORE STA $8800,X
         LDA SNAP_HI
EXIT_HIGH_STORE STA $8C00,X
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

; Read the 6522 Timer 2 counter as one coherent 16-bit snapshot.
; The counter keeps running: low-before-high can straddle a 256-cycle
; boundary. Read high/low/high, retry when high changed during sampling.
; Preserves X and Y; A and processor flags are scratch. Called only with
; IRQ masked (or from within the IRQ handler) to protect shared scratch.
READ_T2_COHERENT
         LDA MB_T2CH
         STA SNAP_HI
         LDA MB_T2CL
         STA SNAP_LO
         LDA MB_T2CH
         CMP SNAP_HI
         BEQ SNAP_OK
         INC SNAP_RETRIES
         JMP READ_T2_COHERENT
SNAP_OK  RTS

; Token byte reader uses a self-modifying absolute,X address base.
; STREAM_LO wraps at 256, increments STREAM_HI and base page.
; No zero-page pointer is borrowed from ROM/Applesoft. Input is bounded.
NEXT_BYTE
BYTE_FETCH LDA E1_BYTES,Y
         INY
         BNE BYTE_DONE
         INC STREAM_HI
         INC BYTE_FETCH+2
BYTE_DONE CMP #$00
         RTS

; E1 decoder: ULEB128 duration in cycles, 0..0xFFFF00,
; restricted to multiples of the 1024-cycle timer grid.
; One 0 byte means zero delta. A nonzero grid delta must begin $80.
; The next 1..3 ULEB bytes are converted directly to delta/256:
; byte2 bits 1..6 => units bits 0..5;
; byte3 bits 0..6 => units bits 6..12;
; byte4 bits 0..2 => units bits 13..15.
; This is an explicit subset of full ULEB: out-of-grid and overflow reject.
NEXT_TOKEN
         LDY STREAM_LO
         LDA #$00
         STA DELTA_LO
         STA DELTA_HI
         JSR NEXT_BYTE
         BNE TOKEN_NONZERO
         JMP TOKEN_READ_ID  ; zero delta leaves due clock unchanged
TOKEN_NONZERO
         CMP #$80
         BEQ TOKEN_FIRST_OK
         JMP TOKEN_BAD
TOKEN_FIRST_OK
         JSR NEXT_BYTE
         CMP #$08
         BEQ FAST_DELTA4
         CMP #$10
         BEQ FAST_DELTA8
         STA DELTA_TMP
         AND #$01
         BEQ TOKEN_SECOND_OK
         JMP TOKEN_BAD
TOKEN_SECOND_OK
         LDA DELTA_TMP
         AND #$7E
         LSR
         STA DELTA_LO
         LDA DELTA_TMP
         AND #$80
         BEQ DELTA_APPLY
         JSR NEXT_BYTE
         STA DELTA_TMP
         AND #$7F
         STA DELTA_HI
         ASL
         ASL
         ASL
         ASL
         ASL
         ASL
         ORA DELTA_LO
         STA DELTA_LO
         LDA DELTA_HI
         LSR
         LSR
         STA DELTA_HI
         LDA DELTA_TMP
         AND #$80
         BEQ DELTA_APPLY
         JSR NEXT_BYTE
         CMP #$08
         BCS TOKEN_BAD
         ASL
         ASL
         ASL
         ASL
         ASL
         ORA DELTA_HI
         STA DELTA_HI
         JMP DELTA_APPLY
FAST_DELTA4
         LDA #$04
         JMP FAST_APPLY
FAST_DELTA8
         LDA #$08
FAST_APPLY
         CLC
         ADC DUE_LO
         STA DUE_LO
         LDA DUE_HI
         ADC #$00
         STA DUE_HI
         JMP TOKEN_READ_ID
DELTA_APPLY
         LDA DELTA_LO
         AND #$03
         BNE TOKEN_BAD
         CLC
         LDA DUE_LO
         ADC DELTA_LO
         STA DUE_LO
         LDA DUE_HI
         ADC DELTA_HI
         STA DUE_HI
         BCS TOKEN_BAD
TOKEN_READ_ID
         JSR NEXT_BYTE
         CMP #$0E       ; AY0 R0-R13 only (no R14/R15 I/O)
         BCS TOKEN_BAD
         STA TOKEN_ID
         JSR NEXT_BYTE
         STA TOKEN_VAL
         LDX TOKEN_ID
         AND INVALID_BITS,X   ; rejects high bits not implemented by AY register
         BNE TOKEN_BAD
         STY STREAM_LO
         RTS
TOKEN_BAD
         STY STREAM_LO
         LDA #$03
         STA ERROR
         RTS

; Invalid-bit masks for AY0 R0..R13; R7 bits 6-7 must stay zero.
INVALID_BITS
         HEX 00F000F000F0E0C0E0E0E00000F0

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

E1_SHORT_END
E1_LONG_TAIL
         HEX 808004080F0008008010080980080903
         HEX 0009008008080F800808000009008008
         HEX 080F0008008010080980080903000900
         HEX 8008080F800808000009008008080F00
         HEX 08008010080980080903000900800808
         HEX 0F800808000009008008080F00080080
         HEX 100809800809030009008008080F8008
         HEX 08000009008008080F00080080100809
         HEX 800809030009008008080F8008080000
         HEX 09008008080F00080080100809800809
         HEX 030009008008080F8008080000090080
         HEX 08080F00080080100809800809030009
         HEX 008008080F800808000009008008080F
         HEX 00080080100809800809030009008008
         HEX 080F80080800000900
E1_LONG_END

; E1 score for mode 5. Generated deterministically by build/generate_fixture.py.
E1_REGS
; BEGIN GENERATED R0-R13 SCORE
         HEX 80080738000800800800F40001008008
         HEX 0246000301800804E80005018008060B
         HEX 000A0080080B60000C0180080D0A0009
         HEX 0080080810000738804000F400010080
         HEX 080246000301800804E8000501800807
         HEX 3800081080080908000A0580080B4000
         HEX 0C0180080D0A00060780080730800807
         HEX 3880A006080000090080080A00800807
         HEX 3880900700D900010080080222000301
         HEX 8008048C000502800807380008108008
         HEX 0908000A0580080B48000C0180080D0A
         HEX 000608800807308008073880A0060800
         HEX 00090080080A008008073880900700C2
         HEX 00010080080246000301800804E80005
         HEX 018008073800081080080908000A0580
         HEX 080B50000C0180080D0A000609800807
         HEX 308008073880A006080000090080080A
         HEX 008008073880900700F4000100800802
         HEX 830003018008048C0005028008073800
         HEX 081080080908000A0580080B58000C01
         HEX 80080D0A000607800807308008073880
         HEX A006080000090080080A008008073880
         HEX 900700F4000100800802460003018008
         HEX 04E80005018008073800081080080908
         HEX 000A0580080B60000C0180080D0A0006
         HEX 08800807308008073880A00608000009
         HEX 0080080A008008073880900700D90001
         HEX 00800802220003018008048C00050280
         HEX 08073800081080080908000A0580080B
         HEX 68000C0180080D0A0006098008073080
         HEX 08073880A006080000090080080A0080
         HEX 08073880900700C20001008008024600
         HEX 0301800804E800050180080738000810
         HEX 80080908000A0580080B70000C018008
         HEX 0D0A000607800807308008073880A006
         HEX 080000090080080A0080080738809007
         HEX 00F4000100800802830003018008048C
         HEX 0005028008073800081080080908000A
         HEX 0580080B78000C0180080D0A00060880
         HEX 0807308008073880A006080000090080
         HEX 080A0080080738805008000009008008
         HEX 0A00
; END GENERATED R0-R13 SCORE
E1_REGS_END
