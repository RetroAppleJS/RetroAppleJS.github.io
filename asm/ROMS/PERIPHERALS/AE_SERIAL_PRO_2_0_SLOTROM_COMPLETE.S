; ============================================================================
; Applied Engineering Serial Pro v2.0 - Slot ROM ($Cn00-$CnFF)
; ============================================================================
;
; Authentic 256-byte slot-page image reconstructed from a physical Serial Pro
; v2.0 installed in slot 2.  The byte dump was dictated from the machine and
; independently checked against photographs of the monitor memory display.
;
; Reference image for SLOT=2:
;   CPU range : $C200-$C2FF
;   Size      : 256 bytes
;   SHA-1     : 31b21a88ae9db7e9bf5293f4b62c0c9265155454
;   SHA-256   : b0e70f7d06e0855f0a9250175065d8d50aaeb4c1a994a24aa3ea9f10c230ff88
;
; Annotation policy:
;   [MANUAL]  behavior/address explicitly documented by the Serial Pro manual.
;   [HOST]    behavior inferred from the separately reconstructed v2.0 host-ROM
;             image at $C800-$CFFF.
;   [INFER]   strong inference from local control flow / hardware semantics.
;   [OPEN]    byte-exact code whose purpose is not yet established.
;
; The manual documents slot-relative hardware registers as $C08x + $s0.
; This source therefore parameterizes SLOT.  SLOT=2 reproduces the photographed
; image exactly.  Other SLOT values are a logical reconstruction and should be
; verified against a dump of the card installed in another slot.
;
; A notable feature of the page is deliberate overlapping code/data:
;   - $Cs05 is both BASIC input entry and Pascal 1.0 ID byte $38 (SEC).
;   - $Cs07 is both BASIC output entry and Pascal 1.0 ID byte $18 (CLC).
;     The $18 byte is ALSO the displacement operand of the BCC at $Cs06.
;   - $Cs0B-$Cs10 are Pascal 1.1 metadata, not instructions.
;   - $Cs11 is executable control-panel code and simultaneously the required
;     non-zero Pascal 1.1 "control/interrupt unsupported" byte.
;
; ============================================================================

SLOT              EQU 2
SLOTROM           EQU $C000 + $100*SLOT
SLOT_HI           EQU $C0 + SLOT
SLOT_IO           EQU $10*SLOT

; ---------------------------------------------------------------------------
; Serial Pro slot-relative I/O registers [MANUAL]
; ---------------------------------------------------------------------------
RTCSEL            EQU $C084 + SLOT_IO    ; 6818 Clock/RAM address register
RTCDATA           EQU $C085 + SLOT_IO    ; 6818 Clock/RAM data register
BANKCLR           EQU $C086 + SLOT_IO    ; EPROM bank-register clear, write only
BANKREG           EQU $C087 + SLOT_IO    ; EPROM bank register, write only
ACIADATA          EQU $C088 + SLOT_IO    ; 6551 data register
ACIASTAT          EQU $C089 + SLOT_IO    ; 6551 status/reset register
ACIACMD           EQU $C08A + SLOT_IO    ; 6551 command register
ACIACTRL          EQU $C08B + SLOT_IO    ; 6551 control register

; ---------------------------------------------------------------------------
; Apple II / Serial Pro workspace used by this page
; ---------------------------------------------------------------------------
SLOTOFF           EQU $26               ; host firmware slot I/O offset ($s0)
CHARBUF           EQU $27               ; shared character / scratch byte
CSWL              EQU $36               ; Apple output vector low byte
CSWH              EQU $37               ; Apple output vector high byte
KSWL              EQU $38               ; Apple input vector low byte
KSWH              EQU $39               ; Apple input vector high byte
SLOTSAVE          EQU $07F8             ; host firmware saved slot-page high byte
XROMOFF           EQU $CFFF             ; Apple expansion-ROM release soft switch
MON_COUT          EQU $FDED             ; Apple Monitor character output

; ---------------------------------------------------------------------------
; Entry points in the separately reconstructed v2.0 host-ROM view [HOST]
; ---------------------------------------------------------------------------
HOST_BASE_INIT    EQU $C819
HOST_STATUS       EQU $C824
HOST_READ         EQU $C8C0
HOST_WRITE        EQU $C8CA
HOST_HOOK_IO      EQU $C8D9
HOST_CTL_DISPATCH EQU $CA91
HOST_CMD09        EQU $CAAE
HOST_INSTALL_CSW  EQU $CD50
HOST_RESTORE_VEC  EQU $CD65
HOST_TABLE_CEF7   EQU $CEF7

; ---------------------------------------------------------------------------
; Public/overlapping slot-page addresses [MANUAL]
; ---------------------------------------------------------------------------
BASIC_OUTPUT      EQU SLOTROM+$07        ; byte $18; enters in middle of BCC operand
PASCAL10_READ_ID  EQU SLOTROM+$05        ; required byte $38
PASCAL10_WRITE_ID EQU SLOTROM+$07        ; required byte $18
P11_CONTROL_FLAG  EQU SLOTROM+$11        ; must be non-zero; also CONTROL_PANEL
CLOCK_IMAGE_CALL  EQU SLOTROM+$A9        ; documented clock-image update entry
FIRMWARE_REV_ADDR EQU SLOTROM+$FF        ; BCD firmware revision

        ORG SLOTROM

; ============================================================================
; $Cs00-$Cs10 - BASIC entry veneer + Pascal identification/dispatch metadata
; ============================================================================

BASIC_INIT                                  ; $Cs00 [MANUAL] PR#/IN# initialization
        BIT $FF58                           ; ROM-dependent flag probe also used in host firmware
        BVS BASIC_IO_BRIDGE                 ; V=1: preserve incoming C and enter common bridge

BASIC_INPUT                                 ; $Cs05 [MANUAL], and Pascal 1.0 ID byte $38
        SEC                                 ; $38: intentional opcode/signature dual use
        BCC CTL_BANK02                      ; normally not taken after SEC; operand is $18
                                            ; $Cs07 lies inside this instruction's operand.
                                            ; Entering at $Cs07 executes that $18 as CLC.
        CLV                                 ; $Cs08: V=0 identifies ordinary BASIC I/O path
        BVC BASIC_IO_BRIDGE                 ; unconditional after CLV

; $Cs0B-$Cs10 are data. Pascal 1.1 uses offsets from $Cs00, not direct calls.
P11_SIGNATURE
        HEX 01                              ; $Cs0B [MANUAL] Pascal 1.1 serial signature byte 1
        HEX 31                              ; $Cs0C [MANUAL] Pascal 1.1 serial signature byte 2
P11_INIT_OFFSET
        HEX 2E                              ; $Cs0D -> $Cs2E PASCAL11_INIT
P11_READ_OFFSET
        HEX 34                              ; $Cs0E -> $Cs34 PASCAL11_READ
P11_WRITE_OFFSET
        HEX 3A                              ; $Cs0F -> $Cs3A PASCAL11_WRITE
P11_STATUS_OFFSET
        HEX 40                              ; $Cs10 -> $Cs40 PASCAL11_STATUS

; ============================================================================
; $Cs11-$Cs45 - control-panel path, bank dispatchers and Pascal 1.1 stubs
; ============================================================================

CONTROL_PANEL                               ; $Cs11 [MANUAL] direct control-panel access
                                            ; Opcode $20 is also the required non-zero P11 flag.
        JSR SLOT_CONTEXT                    ; establish slot/bank context
        JMP HOST_CMD09                      ; [HOST] X=$09 -> BankCall/control operation $09

BANK_VIEW_WAIT                              ; $Cs17 [OPEN]
        JSR SLOT_CONTEXT
BANK_VIEW_WAIT_LOOP
        JMP BANK_VIEW_WAIT_LOOP             ; authentic static self-loop at $Cs1A
                                            ; Likely meaningful only with a bank/view transition;
                                            ; preserved exactly, no behavior invented here.

CTL_BANK0A                                  ; $Cs1D [HOST] request Host CtlDispatch path $0A
        CLC
        BCC CTL_FLAGS_READY                 ; unconditional; bypass SEC so C remains clear

CTL_BANK02                                  ; $Cs20 [HOST] request Host CtlDispatch path $02
        SEC
CTL_FLAGS_READY
        CLV                                 ; V=0 lets Host CtlDispatch choose by carry
CTL_DISPATCH_COMMON
        STA CHARBUF                         ; save caller A before slot-context setup
        TYA
        PHA
        TXA
        PHA
        JSR SLOT_CONTEXT
        JMP HOST_CTL_DISPATCH               ; [HOST] C=1 -> $02, C=0 -> $0A

PASCAL11_INIT                               ; $Cs2E [MANUAL] P11 initialization entry
        JSR SLOT_CONTEXT
        JMP HOST_BASE_INIT                  ; [HOST] BaseInit; returns X=$00

PASCAL11_READ                               ; $Cs34 [MANUAL] P11 read entry
        JSR SLOT_CONTEXT
        JMP HOST_READ                       ; [HOST] ReadEntry

PASCAL11_WRITE                              ; $Cs3A [MANUAL] P11 write entry
        JSR SLOT_CONTEXT
        JMP HOST_WRITE                      ; [HOST] write path beginning at $C8CA

PASCAL11_STATUS                             ; $Cs40 [MANUAL] P11 status entry
        JSR SLOT_CONTEXT
        JMP HOST_STATUS                     ; [HOST] status path at $C824

; ============================================================================
; $Cs46-$Cs67 - common slot-context setup and BASIC I/O bridge
; ============================================================================

SLOT_CONTEXT                                ; $Cs46: shared entry before jumping into HostROM
        PHP                                 ; preserve caller flags: carry/overflow encode requests
        SEI                                 ; make ROM/bank transition atomic
        STA XROMOFF                         ; release Apple $C800-$CFFF expansion-ROM selection
        STA BANKCLR                         ; [MANUAL] clear Serial Pro EPROM bank register
        LDX RTCDATA                         ; authentic read; X is overwritten immediately below
                                            ; [INFER] therefore likely latch/side-effect/timing use.
        LDX #SLOT_HI                        ; slot 2 image: #$C2
        LDY #SLOT_IO                        ; slot 2 image: #$20
        STX SLOTSAVE                        ; make slot-page high byte available to HostROM
        STY SLOTOFF                         ; make $s0 I/O offset available to HostROM
        PLP                                 ; restore request flags after setup
        RTS

BASIC_IO_BRIDGE                             ; $Cs5C: common BASIC init/input/output bridge
        STA CHARBUF                         ; output char / caller A is retained for HostROM
        TYA
        PHA                                 ; preserve original BASIC Y on stack
        TXA
        PHA                                 ; preserve original BASIC X on stack
        JSR SLOT_CONTEXT
        JMP HOST_HOOK_IO                    ; [HOST] V/C select setup/input/output behavior
                                            ; BASIC input arrives with V=0,C=1.
                                            ; BASIC output enters at $Cs07 (CLC): V=0,C=0.

; ============================================================================
; $Cs68-$Cs8F - temporary Apple I/O-vector bridge + direct RTC/ACIA helpers
; ============================================================================

DISPLAY_BUFFERED_CHAR                       ; $Cs68 [HOST/INFER]
        LDX #$03
SAVE_APPLE_VECTORS
        LDA CSWL,X                          ; push $39,$38,$37,$36 so restore pops in natural order
        PHA
        DEX
        BPL SAVE_APPLE_VECTORS
        JSR HOST_INSTALL_CSW                ; [HOST] install output vector from per-slot state
        LDA CHARBUF
        PHA                                 ; preserve original character byte
        ORA #$80                            ; Apple display convention: set high bit
        JSR MON_COUT                        ; display through Apple Monitor output
        PLA
        STA CHARBUF
        JSR SLOT_CONTEXT
        JMP HOST_RESTORE_VEC                ; [HOST] restore CSW/KSW bytes from stack

RTC_WRITE_STACKED                           ; $Cs84 [INFER] write stacked A to RTC/RAM register Y
        STY RTCSEL
        PLA
        STA RTCDATA
        RTS

ACIA_WRITE_DATA                             ; $Cs8C direct 6551 transmit/data write
        STA ACIADATA
        RTS

; ============================================================================
; $Cs90-$CsA8 - firmware-private use of 6818 RAM address $2A
; ============================================================================
;
; Appendix F documents firmware allocations at $29 and $2B-$2C but does not
; assign a public meaning to $2A.  These labels therefore describe operations,
; not a guessed higher-level purpose.
;

RTC_RAM2A_CLEAR                             ; $Cs90: write $00 to battery RAM $2A
        LDA #$00
        BEQ RTC_RAM2A_STORE                 ; unconditional

RTC_RAM2A_OR_TABLE                          ; $Cs94: seed RAM $2A, OR with HostROM table byte
        LDA #$2A
        STA RTCSEL
        STA RTCDATA                         ; first writes $2A into RAM[$2A]
        ORA HOST_TABLE_CEF7,Y               ; [HOST] table meaning not yet established
RTC_RAM2A_STORE
        LDY #$2A
        STY RTCSEL
        STA RTCDATA
        SEC
        RTS

; ============================================================================
; $CsA9-$CsC6 - documented clock-image update entry
; ============================================================================
;
; [MANUAL] Calling $CsA9 safely updates battery RAM $10-$19 with an image of
; clock registers $00-$09, avoiding the 6818 update-in-progress window.
;
; IMPORTANT OPEN ISSUE:
;   The photographed/dictated bytes below are certain, but their ordinary
;   static 6502 decode does NOT by itself explain the documented behavior:
;   the accesses at $CsB0/$CsB9/$CsBF are STA RTCDATA, and the BMI at $CsB3
;   follows LDY #$0A plus stores (which do not set N), making that branch
;   untaken under normal 6502 flag semantics.  Do not silently change these
;   STAs to LDAs: this source preserves the physical-card dump exactly.
;   The discrepancy is a useful target for later bank/hardware investigation.
;

CLOCK_IMAGE_UPDATE                          ; $CsA9 [MANUAL]
        LDX #$19
        LDY #$0A
CLOCK_IMAGE_STAGE_A
        STY RTCSEL
        STA RTCDATA
        BMI CLOCK_IMAGE_STAGE_A
        DEY
CLOCK_IMAGE_STAGE_B
        STY RTCSEL
        STA RTCDATA
        STX RTCSEL
        STA RTCDATA
        DEX
        DEY
        BPL CLOCK_IMAGE_STAGE_B
        RTS

; ============================================================================
; $CsC7-$CsFF - unresolved helper, fill, bank-$12 flag trampoline, signature
; ============================================================================

BANK02_CALL38                               ; $CsC7 [OPEN]
        JSR $0038                           ; literal call to zero-page $0038 (normally KSWL)
                                            ; unusual but photo-confirmed; purpose unresolved.
        PHA
        JSR SLOT_CONTEXT
        LDA #$02
        STA BANKREG                         ; [MANUAL] select EPROM bank value $02
        PLA
        RTS

UNUSED_FF
        .RES $22,$FF                        ; $CsD5-$CsF6: 34 bytes of erased/fill value

CTL_BANK12                                  ; $CsF7 [HOST]
        BIT CLOCK_IMAGE_RTS                 ; byte at $CsC6 is $60: bit 6 sets V=1
        JMP CTL_DISPATCH_COMMON             ; bypass CLV at $Cs21; Host CtlDispatch sees V=1
                                            ; [HOST] V=1 selects bank/control operation $12.

AE_SIGNATURE
        HEX C1C5                            ; $CsFD-$CsFE: high-bit ASCII "AE"
FIRMWARE_REVISION
        HEX 20                              ; $CsFF [MANUAL]: BCD $20 = firmware version 2.0

; Address-only alias used by CTL_BANK12.  It names the RTS byte at $CsC6.
CLOCK_IMAGE_RTS EQU SLOTROM+$C6

        .END
