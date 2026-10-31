; PT3-02A: native 6502 driver + independent foreground.
; Source: Weaver pt3_lib v0.5 (pinned by tools/PT3_02A_build.sh).
; Physical PR#4: VIA0 $C400 / VIA1 $C480.
; Entry addresses: $6000 start; $6003 stop; $6006 foreground.
; The test owns IRQ and ZP $60-$7F exclusively (II+/IIe only).
;
; This wrapper is new; the decoder, IRQ handler, Mockingboard driver remain
; upstream originals and are brought into the build at a pinned commit.

.setcpu "6502"
.include "zp.inc"

PT3_LOC = $8000
PT3_DISABLE_SWITCHABLE_FREQ_CONVERSION = 1

.segment "CODE"
    jmp pt3_02a_start
    jmp pt3_02a_stop
    jmp pt3_02a_foreground

OLD_IRQ_LO = $7004
OLD_IRQ_HI = $7005
FG_COUNT   = $7000
FG_COUNT_HI = $7001
FG_POS      = $7002
FG_HGR     = $2000
STOP_MARK  = $7006

pt3_02a_start:
    sei
    lda $03fe
    sta OLD_IRQ_LO
    lda $03ff
    sta OLD_IRQ_HI
    lda #$00
    sta FG_COUNT
    sta FG_COUNT_HI
    sta FG_POS
    sta STOP_MARK
    sta DONE_PLAYING
    jsr mockingboard_init
    jsr reset_ay_both
    jsr clear_ay_both
    jsr pt3_init_song
    jsr pt3_02b_calibrate_tone_table
    ; Use original 12-second fixture for this nonlooping smoke test.
    lda #$00
    sta LOOP
    ; Foreground must be visible in the actual emulator, not just RAM.
    jsr pt3_02a_hgr_init
    jsr mockingboard_setup_interrupt
    cli
    jmp pt3_02a_foreground

pt3_02a_foreground:
    ; Work between interrupts is fully independent of the 50Hz music IRQ.
    inc FG_COUNT
    bne pt3_02a_foreground
    inc FG_COUNT_HI
    lda FG_COUNT_HI
    and #$1f                 ; ~10-15 visible marker steps per second
    bne pt3_02a_foreground
    jsr pt3_02a_move_marker
    jmp pt3_02a_foreground

pt3_02a_hgr_init:
    ; Soft switches: graphics, full screen, page 1, high resolution.
    bit $c050
    bit $c052
    bit $c054
    bit $c057
    ; Clear HGR1 ($2000-$3FFF) before enabling the timer.
    lda #$00
    ldy #$20
pt3_02a_clear_page:
    sty pt3_02a_clear_byte+2
    ldx #$00
pt3_02a_clear_loop:
pt3_02a_clear_byte:
    sta $2000,x
    inx
    bne pt3_02a_clear_loop
    iny
    cpy #$40
    bne pt3_02a_clear_page
    ; Top status bar makes the foreground mode visually identifiable.
    lda #$7f
    ldx #$00
pt3_02a_banner:
    sta $2000,x
    inx
    cpx #40
    bne pt3_02a_banner
    rts

pt3_02a_move_marker:
    ; 16 high-resolution scanlines at y=80..95. Each byte = 7 pixels.
    ldx FG_POS
    lda #$00
    jsr pt3_02a_marker_rows
    inx
    cpx #40
    bcc pt3_02a_next_position
    ldx #$00
pt3_02a_next_position:
    stx FG_POS
    lda #$7f
    jsr pt3_02a_marker_rows
    rts

pt3_02a_marker_rows:
    ; True Apple II HGR scanline interleave: successive row bases are
    ; $2128/$2528/.../$3D28 then $21A8/$25A8/.../$3DA8.
    sta $2128,x
    sta $2528,x
    sta $2928,x
    sta $2d28,x
    sta $3128,x
    sta $3528,x
    sta $3928,x
    sta $3d28,x
    sta $21a8,x
    sta $25a8,x
    sta $29a8,x
    sta $2da8,x
    sta $31a8,x
    sta $35a8,x
    sta $39a8,x
    sta $3da8,x
    rts

pt3_02a_stop:
    sei
    ; Pinned Jan-2024 upstream has no disable helper; mask owned T1 here.
    lda #$7f
    sta MOCK_6522_IER
    lda MOCK_6522_T1CL          ; acknowledge any pending T1
    lda OLD_IRQ_LO
    sta $03fe
    lda OLD_IRQ_HI
    sta $03ff
    jsr clear_ay_both
    lda #$a5
    sta STOP_MARK
    cli
pt3_02a_halted:
    jmp pt3_02a_halted

; PT3-02B calibrated pitch for Spectrumizer's PT3 tone-table #1 only.
; Standard native pt3_lib converts tracker periods by 9/16 (~1.77MHz
; to 1MHz). ST table #1 is based on a 2MHz reference instead, making
; table-1 notes flat when sent through that path. Keep the upstream
; 9/16 converter unchanged, but provide compensated raw periods here.
; Exact target AY period = round(1021800 / (16 * equal-tempered frequency)).
; Upstream uses floor(raw * 9 / 16), so raw = ceil(target * 16 / 9).
; Index 0 is MIDI C1 (24), 36 is MIDI C4 (60), 48 is C5 (72).
pt3_02b_calibrate_tone_table:
    lda PT3_LOC+PT3_HEADER_FREQUENCY
    cmp #$01
    bne pt3_02b_calibrate_done
    ldy #95
pt3_02b_calibrate_loop:
    lda pt3_02b_tone_table_lo,y
    sta NoteTable_low,y
    lda pt3_02b_tone_table_hi,y
    sta NoteTable_high,y
    dey
    bpl pt3_02b_calibrate_loop
pt3_02b_calibrate_done:
    rts

pt3_02b_tone_table_lo:
    .byte $90,$CD,$16,$68,$C4,$29,$98,$0D,$8B,$10,$9D,$2F
    .byte $C8,$68,$0B,$B4,$62,$14,$CB,$88,$46,$09,$CF,$98
    .byte $64,$34,$06,$DB,$B0,$8B,$66,$44,$24,$04,$E8,$CD
    .byte $B2,$99,$82,$6D,$59,$46,$34,$22,$12,$02,$F4,$E6
    .byte $D9,$CD,$C2,$B8,$AD,$A2,$99,$90,$89,$82,$79,$74
    .byte $6D,$68,$60,$5B,$56,$52,$4D,$49,$44,$40,$3D,$39
    .byte $38,$34,$30,$2F,$2B,$29,$28,$24,$22,$20,$1F,$1D
    .byte $1B,$19,$19,$18,$16,$14,$14,$12,$12,$10,$10,$0F
pt3_02b_tone_table_hi:
    .byte $0D,$0C,$0C,$0B,$0A,$0A,$09,$09,$08,$08,$07,$07
    .byte $06,$06,$06,$05,$05,$05,$04,$04,$04,$04,$03,$03
    .byte $03,$03,$03,$02,$02,$02,$02,$02,$02,$02,$01,$01
    .byte $01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00
    .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
    .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
    .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
    .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00

; Upstream dependency order is intentionally identical to pt3_test.s.
.include "pt3_lib_core.s"
.include "pt3_lib_init.s"
.include "pt3_lib_mockingboard_setup.s"
.include "interrupt_handler.s"
