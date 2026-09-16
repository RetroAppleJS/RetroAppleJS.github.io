; =============================================================================
; GPT16_RAM_BACKEND_LC16K.S
;
; Classic 16 KiB Apple II Language Card backend for GPT16 RAM API V1.2.
;
; Logical bank 0:
;   $0000-$0FFF -> LC bank 2 at $D000-$DFFF
;   $1000-$1FFF -> LC bank 1 at $D000-$DFFF
;   $2000-$3FFF -> common LC RAM at $E000-$FFFF
;
; Postcondition for every public backend call:
;   - Apple ROM visible at $D000-$FFFF
;   - LC RAM write-protected
;   - bank 2 selected for the next LC access
;
; This canonical postcondition is deliberate.  A classic Apple II/II+ LC does
; not expose enough status to reconstruct an arbitrary pre-call mapping.
; GPT16 therefore owns the LC mapping while this backend is installed.
; =============================================================================

LC_RD2_WP               EQU     $C080 ; RAM read, bank2, write protected
LC_ROM2_WE              EQU     $C081 ; ROM read, bank2; two reads enable write
LC_ROM2_WP              EQU     $C082 ; ROM read, bank2, write protected
LC_RD1_WP               EQU     $C088 ; RAM read, bank1, write protected
LC_ROM1_WE              EQU     $C089 ; ROM read, bank1; two reads enable write

; ---------------------------------------------------------------------------
; RAM_LOAD_OVERLAY implementation prefix.
; It lives in otherwise-unused state-page tail so the complete LC driver
; remains below DOS at $9000 while preserving the fixed $8E00 backend ABI.
; ---------------------------------------------------------------------------

        ORG     $8CA0

RLC_LOAD
        STA     RAM_ZP_DESC_LO
        STX     RAM_ZP_DESC_HI

        LDY     #RAM_OVL_FLAGS
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RLC_LOAD_UNSUP_LOCAL

        ; LC16K exposes exactly one logical bank: bank 0.
        LDY     #RAM_OVL_BANK_LO
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RLC_LOAD_BANK_LOCAL
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RLC_LOAD_BANK_LOCAL

        ; Copy OFF/DST/LEN from overlay descriptor into ordinary XFER descriptor.
        LDY     #RAM_OVL_OFF_LO
        LDX     #$00
RLC_LOAD_COPY_DESC
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER,X
        INY
        INX
        CPX     #$06
        BNE     RLC_LOAD_COPY_DESC
        LDA     #$00
        STA     RAM_INT_XFER+RAM_XFER_FLAGS
        STA     RAM_INT_XFER+RAM_XFER_RESERVED

        ; Destination must start at/above $6000.
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_HI
        CMP     #$60
        BCC     RLC_LOAD_BAD_LOCAL

        ; Destination+length must end at/below $8400.
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_LO
        CLC
        ADC     RAM_INT_XFER+RAM_XFER_LEN_LO
        STA     RAM_ZP_DESC_LO
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_HI
        ADC     RAM_INT_XFER+RAM_XFER_LEN_HI
        CMP     #$84
        BCC     RLC_LOAD_GO_LOCAL
        BNE     RLC_LOAD_BAD_LOCAL
        LDA     RAM_ZP_DESC_LO
        BNE     RLC_LOAD_BAD_LOCAL

RLC_LOAD_GO_LOCAL
        JMP     RLC_LOAD_GO
RLC_LOAD_UNSUP_LOCAL
        JMP     RLC_LOAD_UNSUP
RLC_LOAD_BANK_LOCAL
        JMP     RLC_LOAD_BANK
RLC_LOAD_BAD_LOCAL
        JMP     RLC_LOAD_BAD

RLC_LOAD_PREFIX_END
        .ASSERT RLC_LOAD_PREFIX_END <= $8D00, error, "LC16K overlay-loader prefix exceeds $8CA0-$8CFF"

; ---------------------------------------------------------------------------
; Compact helpers in the free tail after the card-neutral API core.
; ---------------------------------------------------------------------------

        ORG     $8D80

RLC_ROM_CHECK
        LDA     $D000
        CMP     RAM_LC_ROM_D0
        BNE     RLC_ROM_BAD
        LDA     $E000
        CMP     RAM_LC_ROM_E0
        BNE     RLC_ROM_BAD
        LDA     $FDED
        CMP     RAM_LC_ROM_FD
        BNE     RLC_ROM_BAD
        CLC
        RTS
RLC_ROM_BAD
        SEC
        RTS

RLC_ERR_BACKEND
        LDA     #RAM_E_BACKEND
        BNE     RLC_SETERR
RLC_ERR_BANK
        LDA     #RAM_E_BAD_BANK
        BNE     RLC_SETERR
RLC_ERR_RANGE
        LDA     #RAM_E_RANGE
        BNE     RLC_SETERR
RLC_ERR_UNSUP
        LDA     #RAM_E_UNSUPPORTED
RLC_SETERR
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

; Build the physical LC pointer in RAM_ZP_DESC.
; Return A=1 for Dx bank1, A=0 for Dx bank2 or common Ex/Fx RAM.
RLC_BUILD_PHYS
        LDA     RAM_ZP_EXP_LO
        STA     RAM_ZP_DESC_LO
        LDA     RAM_ZP_EXP_HI
        CMP     #$10
        BCC     RLC_PHYS_B2
        CMP     #$20
        BCC     RLC_PHYS_B1
        CLC
        ADC     #$C0
        STA     RAM_ZP_DESC_HI
        LDA     #$00
        RTS
RLC_PHYS_B1
        CLC
        ADC     #$C0
        STA     RAM_ZP_DESC_HI
        LDA     #$01
        RTS
RLC_PHYS_B2
        CLC
        ADC     #$D0
        STA     RAM_ZP_DESC_HI
        LDA     #$00
        RTS

RLC_ADVANCE
        INC     RAM_ZP_EXP_LO
        BNE     RLC_ADV_MAIN
        INC     RAM_ZP_EXP_HI
RLC_ADV_MAIN
        INC     RAM_ZP_MAIN_LO
        BNE     RLC_ADV_LEN
        INC     RAM_ZP_MAIN_HI
RLC_ADV_LEN
        LDA     RAM_ZP_LEN_LO
        BNE     RLC_DEC_LOW
        DEC     RAM_ZP_LEN_HI
RLC_DEC_LOW
        DEC     RAM_ZP_LEN_LO
        RTS

; Overlay-loader tail.  Kept here because only 22 bytes remain before $8E00.
RLC_LOAD_GO
        LDA     #<RAM_INT_XFER
        LDX     #>RAM_INT_XFER
        JMP     RLC_READ
RLC_LOAD_UNSUP
        JMP     RLC_ERR_UNSUP
RLC_LOAD_BANK
        JMP     RLC_ERR_BANK
RLC_LOAD_BAD
        LDA     #RAM_E_BAD_OVERLAY
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

RLC_HELPER_END
        .ASSERT RLC_HELPER_END <= $8E00, error, "LC16K helper block overlaps backend ABI"

; ---------------------------------------------------------------------------
; Existing fixed backend ABI.
; ---------------------------------------------------------------------------

        ORG     $8E00

RLC_ENTRY_PROBE
        JMP     RLC_PROBE
RLC_ENTRY_SELECT
        JMP     RLC_SELECT
RLC_ENTRY_READ
        JMP     RLC_READ
RLC_ENTRY_WRITE
        JMP     RLC_WRITE
RLC_ENTRY_LOAD
        JMP     RLC_LOAD

        ORG     $8E20

; ---------------------------------------------------------------------------
; Probe all 16 KiB without leaving modified bytes behind.
; Distinct $55/$AA values also detect an aliased Dx bank.
; ---------------------------------------------------------------------------

RLC_PROBE
        PHP
        SEI

        ; Establish canonical ROM-visible state and save ROM signature.
        BIT     LC_ROM2_WP
        LDA     $D000
        STA     RAM_LC_ROM_D0
        LDA     $E000
        STA     RAM_LC_ROM_E0
        LDA     $FDED
        STA     RAM_LC_ROM_FD

        ; Save one byte from each physical LC region.
        BIT     LC_RD2_WP
        LDA     $D000
        STA     RAM_LC_SAVE_B2
        LDA     $E000
        STA     RAM_LC_SAVE_HI
        BIT     LC_RD1_WP
        LDA     $D000
        STA     RAM_LC_SAVE_B1
        BIT     LC_ROM2_WP

        ; Write test patterns while ROM remains readable.
        BIT     LC_ROM2_WE
        BIT     LC_ROM2_WE
        LDA     #$55
        STA     $D000
        LDA     #$A5
        STA     $E000

        BIT     LC_ROM1_WE
        BIT     LC_ROM1_WE
        LDA     #$AA
        STA     $D000

        LDA     #$00
        STA     RAM_LC_PROBE_OK

        ; Verify bank2 Dx + common high RAM.
        BIT     LC_RD2_WP
        LDA     $D000
        CMP     #$55
        BNE     RLC_PROBE_RESTORE
        LDA     $E000
        CMP     #$A5
        BNE     RLC_PROBE_RESTORE

        ; Verify bank1 Dx independently.
        BIT     LC_RD1_WP
        LDA     $D000
        CMP     #$AA
        BNE     RLC_PROBE_RESTORE

        LDA     #$A5
        STA     RAM_LC_PROBE_OK

RLC_PROBE_RESTORE
        ; Restore all probe bytes even on failed detection.
        BIT     LC_ROM2_WE
        BIT     LC_ROM2_WE
        LDA     RAM_LC_SAVE_B2
        STA     $D000
        LDA     RAM_LC_SAVE_HI
        STA     $E000

        BIT     LC_ROM1_WE
        BIT     LC_ROM1_WE
        LDA     RAM_LC_SAVE_B1
        STA     $D000

        ; Verify that the original LC bytes really came back.
        BIT     LC_RD2_WP
        LDA     $D000
        CMP     RAM_LC_SAVE_B2
        BNE     RLC_PROBE_RESTORE_BAD
        LDA     $E000
        CMP     RAM_LC_SAVE_HI
        BNE     RLC_PROBE_RESTORE_BAD

        BIT     LC_RD1_WP
        LDA     $D000
        CMP     RAM_LC_SAVE_B1
        BNE     RLC_PROBE_RESTORE_BAD

        ; Canonical return mapping and explicit ROM visibility check.
        BIT     LC_ROM2_WP
        JSR     RLC_ROM_CHECK
        BCS     RLC_PROBE_ROM_BAD
        PLP

        LDA     RAM_LC_PROBE_OK
        BEQ     RLC_NO_DEVICE

        LDA     #$09                    ; BLOCK_IO | HIDES_ROM
        STA     RAM_INFO_CAPS
        LDA     #$01
        STA     RAM_INFO_BANKS_LO
        LDA     #$00
        STA     RAM_INFO_BANKS_HI
        STA     RAM_INFO_SEL_LO
        STA     RAM_INFO_SEL_HI

        LDA     #RAM_BACKEND_LC16K
        CLC
        RTS

RLC_PROBE_RESTORE_BAD
        BIT     LC_ROM2_WP
        JSR     RLC_ROM_CHECK
RLC_PROBE_ROM_BAD
        PLP
        JMP     RLC_ERR_BACKEND

RLC_NO_DEVICE
        LDA     #RAM_E_NO_DEVICE
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

; ---------------------------------------------------------------------------
; One logical bank only.
; ---------------------------------------------------------------------------

RLC_SELECT
        CPX     #$00
        BNE     RLC_SELECT_BAD
        CMP     #$00
        BNE     RLC_SELECT_BAD

        ; Bank 0 is already the recorded selection after RAM_INIT.
        ; Selection itself must also leave the ROM mapping canonical.
        BIT     LC_ROM2_WP
        JSR     RLC_ROM_CHECK
        BCS     RLC_SELECT_ROM_BAD
        CLC
        RTS

RLC_SELECT_BAD
        JMP     RLC_ERR_BANK
RLC_SELECT_ROM_BAD
        JMP     RLC_ERR_BACKEND

; ---------------------------------------------------------------------------
; Decode and validate an 8-byte transfer descriptor.
; ---------------------------------------------------------------------------

RLC_PREP_XFER
        STA     RAM_ZP_DESC_LO
        STX     RAM_ZP_DESC_HI

        LDY     #RAM_XFER_FLAGS
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RLC_PREP_UNSUP

        LDY     #RAM_XFER_OFF_LO
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_EXP_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        CMP     #$40
        BCS     RLC_PREP_RANGE
        STA     RAM_ZP_EXP_HI

        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_MAIN_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_MAIN_HI
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_LEN_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_LEN_HI

        ; logical OFF+LEN <= $4000
        LDA     RAM_ZP_EXP_LO
        CLC
        ADC     RAM_ZP_LEN_LO
        STA     RAM_ZP_DESC_LO
        LDA     RAM_ZP_EXP_HI
        ADC     RAM_ZP_LEN_HI
        CMP     #$40
        BCC     RLC_PREP_MAIN
        BNE     RLC_PREP_RANGE
        LDA     RAM_ZP_DESC_LO
        BNE     RLC_PREP_RANGE

RLC_PREP_MAIN
        ; LEN=0 is a successful no-op; no main-memory address is dereferenced.
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     RLC_PREP_OK

        ; Main side must end at/below $C000 because reads may hide ROM.
        LDA     RAM_ZP_MAIN_LO
        CLC
        ADC     RAM_ZP_LEN_LO
        STA     RAM_ZP_DESC_LO
        LDA     RAM_ZP_MAIN_HI
        ADC     RAM_ZP_LEN_HI
        CMP     #$C0
        BCC     RLC_PREP_OK
        BNE     RLC_PREP_RANGE
        LDA     RAM_ZP_DESC_LO
        BNE     RLC_PREP_RANGE

RLC_PREP_OK
        CLC
        RTS
RLC_PREP_RANGE
        JMP     RLC_ERR_RANGE
RLC_PREP_UNSUP
        JMP     RLC_ERR_UNSUP

; ---------------------------------------------------------------------------
; Expansion -> main RAM.
; Interrupts are disabled only while LC RAM can hide the ROM.
; ---------------------------------------------------------------------------

RLC_READ
        JSR     RLC_PREP_XFER
        BCS     RLC_IO_RETURN

        PHP
        SEI
        LDY     #$00

RLC_READ_LOOP
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     RLC_READ_DONE

        JSR     RLC_BUILD_PHYS
        CMP     #$01
        BEQ     RLC_READ_B1
        BIT     LC_RD2_WP
        JMP     RLC_READ_BYTE
RLC_READ_B1
        BIT     LC_RD1_WP

RLC_READ_BYTE
        LDA     (RAM_ZP_DESC_LO),Y
        STA     (RAM_ZP_MAIN_LO),Y
        JSR     RLC_ADVANCE
        JMP     RLC_READ_LOOP

RLC_READ_DONE
        JSR     RLC_IO_FINISH
        BCS     RLC_IO_POP_FAIL
        PLP
        CLC
        RTS

; ---------------------------------------------------------------------------
; Main RAM -> expansion.
; ROM remains selected while LC write-enable is active.
; ---------------------------------------------------------------------------

RLC_WRITE
        JSR     RLC_PREP_XFER
        BCS     RLC_IO_RETURN

        PHP
        SEI
        LDY     #$00

RLC_WRITE_LOOP
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     RLC_WRITE_DONE

        JSR     RLC_BUILD_PHYS
        CMP     #$01
        BEQ     RLC_WRITE_B1

        BIT     LC_ROM2_WE
        BIT     LC_ROM2_WE
        JMP     RLC_WRITE_BYTE

RLC_WRITE_B1
        BIT     LC_ROM1_WE
        BIT     LC_ROM1_WE

RLC_WRITE_BYTE
        LDA     (RAM_ZP_MAIN_LO),Y
        STA     (RAM_ZP_DESC_LO),Y
        JSR     RLC_ADVANCE
        JMP     RLC_WRITE_LOOP

RLC_WRITE_DONE
        JSR     RLC_IO_FINISH
        BCC     RLC_IO_POP_OK

RLC_IO_POP_FAIL
        PLP
        SEC
        RTS

RLC_IO_POP_OK
        PLP
        CLC
RLC_IO_RETURN
        RTS

; Every mapped I/O call returns with ROM visible and LC write-protected.
RLC_IO_FINISH
        BIT     LC_ROM2_WP
        JSR     RLC_ROM_CHECK
        BCC     RLC_IO_OK

        LDA     #RAM_E_BACKEND
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

RLC_IO_OK
        CLC
        RTS

RLC_BACKEND_END
        .ASSERT RLC_BACKEND_END <= $9000, error, "LC16K backend exceeds $8E20-$8FFF"
