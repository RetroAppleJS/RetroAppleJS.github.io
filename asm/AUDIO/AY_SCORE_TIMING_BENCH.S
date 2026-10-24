; AY_SCORE_TIMING_BENCH.S -- Phase 1.5A.2, v0.1
; RetroAppleJS Apple II / NMOS 6502 / Mockingboard slot 4 (AY 1)
;
; Assembly source of truth.  ORG $6000, three callable entry points.
;   CALL 24576   ($6000) : MB-01 -- full R8 select + data write, 64 times
;   CALL 24579   ($6003) : MB-02 -- retain R8 selection, 64 updates
;   CALL 24582   ($6006) : MB-03 -- E1 varuint token parser + R8 updates, 32 tokens
;
; Result memory reserved at $6F00..$6F09 (does not ship in image):
;   $6F00 = $A5 when complete; $6F01 = test ID (1,2,3)
;   $6F02 = number of AY R8 updates (64 or 32)
;   $6F03..04 = total T1 elapsed low/high, including measurement scaffolding
;   $6F05..06 = empty-path T1 elapsed low/high (calibration)
;   $6F07..08 = difference in cycles low/high, total minus baseline
;   $6F09 = error (0=OK; 1=bad E1 register ID)
;
; Timing uses VIA timer 1 as a 16-bit down-counter, starting at $FFFF.
; The timer read itself incurs CPU cycles; a matching empty-path measurement
; subtracts the fixed scaffolding.  Individual cycles can differ by one
; due to timer reload/read edge semantics.  Execute one run on an otherwise
; idle machine; the test takes ownership of VIA 1 T1, ACR and its T1 IRQ.
; It does NOT install an IRQ handler or preserve any running timer program.
; Do not use concurrently with a production Mockingboard music player.
;
; All Apple II bus addresses below match MOCKINGBOARD_SLOT4.symbols.json.
;
*=$6000

MB1_ORB   = $C400
MB1_ORA   = $C401
MB1_DDRB  = $C402
MB1_DDRA  = $C403
MB1_T1CL  = $C404
MB1_T1CH  = $C405
MB1_ACR   = $C40B
MB1_IER   = $C40E

RES_MAGIC = $6F00
RES_MODE  = $6F01
RES_N     = $6F02
RES_TOTAL = $6F03
RES_THI   = $6F04
RES_BASE  = $6F05
RES_BHI   = $6F06
RES_NET   = $6F07
RES_NHI   = $6F08
RES_ERR   = $6F09

ENTRY01  JMP BENCH01      ; $6000 / CALL 24576
ENTRY02  JMP BENCH02      ; $6003 / CALL 24579
ENTRY03  JMP BENCH03      ; $6006 / CALL 24582

BENCH01  LDA #$01
         STA RES_MODE
         LDA #$40
         STA RES_N
         JSR COMMON_SETUP
         JSR CALIBRATE
         JSR TIMER_ARM
         JSR FULL_BODY
         JSR TIMER_SNAPSHOT
         JSR FINISH
         RTS

BENCH02  LDA #$02
         STA RES_MODE
         LDA #$40
         STA RES_N
         JSR COMMON_SETUP
         JSR SELECT_R8
         JSR CALIBRATE
         JSR TIMER_ARM
         JSR FAST_BODY
         JSR TIMER_SNAPSHOT
         JSR FINISH
         RTS

BENCH03  LDA #$03
         STA RES_MODE
         LDA #$20
         STA RES_N
         JSR COMMON_SETUP
         JSR SELECT_R8
         JSR CALIBRATE
         JSR TIMER_ARM
         JSR E1_BODY
         JSR TIMER_SNAPSHOT
         JSR FINISH
         RTS

; Prepares the sound chip before any timing is measured.
; Mixer $3F disables tone and noise; R8 volume DAC remains operative.
; DDRB $07 drives PB0/1/2, with /RESET high ($04) throughout.
COMMON_SETUP
         LDA #$00
         STA RES_MAGIC
         STA RES_ERR
         LDA #$FF
         STA MB1_DDRA
         LDA #$07
         STA MB1_DDRB
         LDA #$04
         STA MB1_ORB
         LDA #$07
         STA MB1_ORA
         LDA #$07
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         LDA #$3F
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         JSR SELECT_R8
         LDA #$00
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         ; Only the T1 interrupt bit is disabled (IER bit6, bit7 clear).
         LDA #$40
         STA MB1_IER
         ; ACR $00 = T1 one-shot, PB7 disabled; safe for <65536 cycles.
         LDA #$00
         STA MB1_ACR
         RTS

SELECT_R8
         LDA #$08
         STA MB1_ORA
         LDA #$07
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         RTS

; Calibrate a JSR/RTS-only empty benchmark path.
CALIBRATE
         JSR TIMER_ARM
         JSR EMPTY_BODY
         JSR TIMER_SNAPSHOT
         LDA SNAP_LO
         STA RES_BASE
         LDA SNAP_HI
         STA RES_BHI
         RTS

; Starting T1 with high-byte write loads and starts count $FFFF.
TIMER_ARM
         LDA #$FF
         STA MB1_T1CL
         STA MB1_T1CH
         RTS

; Reading T1CL latches T1CH on 6522-compatible implementations.
; Complement the remaining downcount to obtain approximate elapsed cycles.
TIMER_SNAPSHOT
         LDA MB1_T1CL
         EOR #$FF
         STA SNAP_LO
         LDA MB1_T1CH
         EOR #$FF
         STA SNAP_HI
         RTS

EMPTY_BODY
         RTS
; Keep FULL_LOOP entirely inside one 256-byte page: no hidden
; page-crossing branch penalty in the per-write cost measurement.
PAD_FULL HEX EAEAEA

; MB-01: 64 full writes, every iteration reselects AY R8.
; Bus transaction itself: 36 cycles, plus 6 alternating-volume cycles.
; Loop control DEX+BNE: 5 cycles (4 final), excluding setup/RTS.
FULL_BODY
         LDX #$40
         LDY #$0F
FULL_LOOP
         LDA #$08
         STA MB1_ORA
         LDA #$07
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         TYA
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         TYA
         EOR #$0F
         TAY
         DEX
         BNE FULL_LOOP
         RTS

; MB-02: R8 was latched before timing.  64 writes without relatching.
; Per iteration TYA+STA+LDA+STA+LDA+STA = 18 cycles,
; plus six cycles for alternating volume and five for loop control,
; giving 29 cycles/iteration excluding setup (last branch one shorter).
FAST_BODY
         LDX #$40
         LDY #$0F
FAST_LOOP
         TYA
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         TYA
         EOR #$0F
         TAY
         DEX
         BNE FAST_LOOP
         RTS

; MB-03: parsable subset of E1 payload tokens, not a timed E1 player.
; E1 token layout from AY_SCORE_ENCODING_BENCH v0.1.1:
;       unsigned 7-bit varuint(delta cycles), packed(chip*16+reg), value
; This samples 32 short 1- or 2-byte varuint deltas in E1_BYTES below.
; DELTA IS PARSED BUT NOT APPLIED as a delay; R8 is preselected, and
; only packed ID $08 (AY 1, R8) is accepted.  This benchmarks decoder
; and bus work, not a general E1 scheduling engine.  No IRQ is installed.
E1_BODY
         LDY #$00
         LDX #$20
E1_LOOP
         LDA E1_BYTES,Y
         BPL E1_NEXT
E1_MORE
         INY
         LDA E1_BYTES,Y
         BMI E1_MORE
E1_NEXT
         INY
E1_ID
         LDA E1_BYTES,Y
         CMP #$08
         BNE E1_BAD
         INY
         LDA E1_BYTES,Y
         INY
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         DEX
         BNE E1_LOOP
         RTS
E1_BAD   LDA #$01
         STA RES_ERR
         RTS

; Store the raw/corrected measurements, then mute R8.
FINISH
         LDA SNAP_LO
         STA RES_TOTAL
         SEC
         SBC RES_BASE
         STA RES_NET
         LDA SNAP_HI
         STA RES_THI
         SBC RES_BHI
         STA RES_NHI
         ; Allow only completed records to have magic marker $A5.
         LDA #$A5
         STA RES_MAGIC
         JSR SELECT_R8
         LDA #$00
         STA MB1_ORA
         LDA #$06
         STA MB1_ORB
         LDA #$04
         STA MB1_ORB
         RTS

SNAP_LO  HEX 00
SNAP_HI  HEX 00

; 32 events, first (delta=0,id=$08,value=$0F); then 31 events
; with delta=200 encoded as $C8,$01 and alternating R8 values.
; This is an actual E1 payload *subset*, without its 36-byte AYSB header.
E1_BYTES
         HEX 00080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800C8
         HEX 01080FC8010800C801080FC8010800
