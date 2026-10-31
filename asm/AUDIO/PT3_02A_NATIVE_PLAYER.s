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
    sta STOP_MARK
    sta DONE_PLAYING
    sta LOOP
    jsr mockingboard_init
    jsr reset_ay_both
    jsr clear_ay_both
    jsr pt3_init_song
    jsr mockingboard_setup_interrupt
    cli
    jmp pt3_02a_foreground

pt3_02a_foreground:
    inc FG_COUNT
    inc FG_HGR
    jmp pt3_02a_foreground

pt3_02a_stop:
    sei
    jsr mockingboard_disable_interrupt
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
