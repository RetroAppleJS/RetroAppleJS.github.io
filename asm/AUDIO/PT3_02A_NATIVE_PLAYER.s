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
    ; Original diagnostic tune is ~3s long: enable PT3 repeat.
    lda #$01
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

; Upstream dependency order is intentionally identical to pt3_test.s.
.include "pt3_lib_core.s"
.include "pt3_lib_init.s"
.include "pt3_lib_mockingboard_setup.s"
.include "interrupt_handler.s"
