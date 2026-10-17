; =============================================================================
; SID PHASE 1: NATIVE APPLE II SID DIAGNOSTIC + PSID-STYLE MINI MUSIC PLAYER
; Assembler: RetroAppleJS ASM_core, dialect raJS (also multi)
; Load address: $6000 (screen must not use HGR page 2 at $4000-$5FFF)
;
; CALL 24576 ($6000) = run five-second self-contained demo
; CALL 24579 ($6003) = initialize music player (PSID INIT)
; CALL 24582 ($6006) = advance one music tick (PSID PLAY, 50 Hz expected)
; CALL 24585 ($6009) = stop, silence SID
;
; Built for PCODE SID in preferred SLOT 5; $C0D0 must read 'S' ($53).
; Writes go DIRECTLY to C64-style $D400-$D418, no address translation.
; The demo uses CPU busy waiting for approximately 50 Hz: not a CIA/VIA IRQ.
; Host CPU ~1021800 Hz -> ~50 ticks/s. Never pretend cycle accuracy here.
;
; The INIT and PLAY entrypoints are standalone. They execute no delay loops,
; so the same code can be packed into an ordinary PSID (init=$6003, play=$6006)
; by tools/SID_Phase1_pack.js and compared in tools/SIDchipJS.html.
; =============================================================================

            ORG $6000

RUN         JMP DEMO
INIT        JMP MUSIC_INIT
PLAY        JMP MUSIC_PLAY
STOP        JMP MUSIC_STOP

SIDSIG      EQU $C0D0
SIDFREQ1    EQU $D400
SIDFREQ2    EQU $D407
SIDFREQ3    EQU $D40E
SIDCTRL1    EQU $D404
SIDCTRL2    EQU $D40B
SIDCTRL3    EQU $D412
SIDVOL      EQU $D418

DEMO
            LDA SIDSIG
            CMP #$53
            BNE NO_CARD
            JSR MUSIC_INIT
DEMO_LOOP
            JSR WAIT50
            JSR MUSIC_PLAY
            LDA PHASE
            CMP #$05
            BCC DEMO_LOOP
NO_CARD     RTS

; Entry INIT: A is PSID subtune index (ignored: this fixture has one subtune).
MUSIC_INIT
            LDA #$00
            STA PHASE
            STA FRAME
            LDX #$18
CLEAR_SID
            STA $D400,X
            DEX
            BPL CLEAR_SID
            JSR APPLY_PHASE
            RTS

; Entry PLAY: exactly one scheduled callback. No clock or ROM dependencies.
MUSIC_PLAY
            LDA PHASE
            CMP #$05
            BCS PLAY_EXIT
            INC FRAME
            LDA FRAME
            CMP #$32                 ; 50 ticks = ~1 second per phase
            BNE PLAY_EXIT
            LDA #$00
            STA FRAME
            INC PHASE
            JSR APPLY_PHASE
PLAY_EXIT   RTS

MUSIC_STOP
            LDA #$00
            STA SIDCTRL1
            STA SIDCTRL2
            STA SIDCTRL3
            STA SIDVOL
            RTS

; Stage 0: 440 Hz pulse/square
; Stage 1: triangle
; Stage 2: sawtooth
; Stage 3: noise percussion/timbre
; Stage 4: three-voice C major chord, all routed through low-pass filter
; Stage 5: stop with GATE off and master volume zero.
APPLY_PHASE
            JSR MUSIC_STOP
            LDA PHASE
            CMP #$05
            BCS PHASE_DONE
            CMP #$04
            BEQ CHORD
            CMP #$03
            BEQ NOISE_SOUND
            CMP #$02
            BEQ SAW_SOUND
            CMP #$01
            BEQ TRI_SOUND

PULSE_SOUND
            LDA #$45                 ; PAL SID word 440 Hz = $1D45
            STA SIDFREQ1
            LDA #$1D
            STA SIDFREQ1+1
            LDA #$00
            STA $D402
            LDA #$08
            STA $D403               ; PW = $800 (50%)
            LDA #$00
            STA $D405               ; fast attack, decay
            LDA #$F3
            STA $D406               ; sustain max, short release
            LDA #$0F
            STA SIDVOL
            LDA #$41                 ; pulse + gate
            STA SIDCTRL1
            RTS

TRI_SOUND
            LDA #$0C                 ; reduce master volume during this phase
            STA SIDVOL
            LDA #$11                 ; triangle + gate, retain frequency
            STA SIDCTRL1
            RTS

SAW_SOUND
            LDA #$0F
            STA SIDVOL
            LDA #$21                 ; sawtooth + gate
            STA SIDCTRL1
            RTS

NOISE_SOUND
            LDA #$0F
            STA SIDVOL
            LDA #$81                 ; noise + gate
            STA SIDCTRL1
            RTS

CHORD
            ; C4 261.63 Hz = $1167, E4 329.63 Hz = $15ED,
            ; G4 392 Hz = $1A13 at SID clock 985248 Hz.
            LDA #$67
            STA SIDFREQ1
            LDA #$11
            STA SIDFREQ1+1
            LDA #$ED
            STA SIDFREQ2
            LDA #$15
            STA SIDFREQ2+1
            LDA #$13
            STA SIDFREQ3
            LDA #$1A
            STA SIDFREQ3+1

            LDA #$00                 ; attack/decay fast
            STA $D405
            STA $D40C
            STA $D413
            LDA #$F3                 ; sustain max, short release
            STA $D406
            STA $D40D
            STA $D414
            LDA #$00
            STA $D410               ; voice 3 PW low = 0
            LDA #$08
            STA $D411               ; voice 3 PW high = $8 -> 50%

            LDA #$00
            STA $D415               ; cutoff low 3 bits
            LDA #$90
            STA $D416               ; medium/high filter cutoff
            LDA #$87
            STA $D417               ; resonance 8, route all 3 voices
            LDA #$1F
            STA SIDVOL               ; LP filter enabled + master volume 15

            LDA #$21
            STA SIDCTRL1             ; saw + gate
            LDA #$11
            STA SIDCTRL2             ; triangle + gate
            LDA #$41
            STA SIDCTRL3             ; pulse + gate
PHASE_DONE  RTS

; A simple CPU-only ~50 Hz polling delay. This is not an interrupt source.
; Inner DEY/BNE ~1250 cycles; outer loop x16 => ~20K CPU cycles.
; Use clock-tick instrumentation to quantify deviations.
WAIT50
            LDX #$10
WAIT_OUTER
            LDY #$FA
WAIT_INNER
            DEY
            BNE WAIT_INNER
            DEX
            BNE WAIT_OUTER
            RTS

PHASE       BYTE $00
FRAME       BYTE $00

            .END
