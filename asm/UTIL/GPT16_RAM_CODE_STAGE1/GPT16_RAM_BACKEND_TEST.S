; =============================================================================
; GPT16_RAM_API_V1_1.INC
; Card-neutral RAM expansion API - resident mini-kernel ABI
;
; IMPORTANT:
; V1 originally proposed RAM_API_BASE=$8C30.  That overlaps V6.10 persistent
; GPT16 state (GPT_BRIEFED and G16 variables).  V1.1 moves the RAM API into
; the currently unused $8D00-$8FFF region:
;
;   $8D00-$8DFF  card-neutral RAM API core
;   $8E00-$8F7F  selected hardware backend slot
;   $8F90-$8FFF  RAM driver state / descriptors
; =============================================================================

RAM_API_BASE            EQU     $8D00

RAM_INIT                EQU     $8D00
RAM_PRESENT             EQU     $8D03
RAM_SELECT_BANK         EQU     $8D06
RAM_READ_BLOCK          EQU     $8D09
RAM_WRITE_BLOCK         EQU     $8D0C
RAM_LOAD_OVERLAY        EQU     $8D0F

; Selected-backend fixed entry table.  The boot-time detector will eventually
; copy the chosen card driver into this page.
RAM_BACKEND_BASE        EQU     $8E00
RAM_BACKEND_PROBE       EQU     $8E00
RAM_BACKEND_SELECT      EQU     $8E03
RAM_BACKEND_READ        EQU     $8E06
RAM_BACKEND_WRITE       EQU     $8E09
RAM_BACKEND_LOAD        EQU     $8E0C

; Public return convention:
;   C=0 success
;   C=1 failure, A=RAM_E_*
;   A/X/Y caller-clobbered
;   stack depth unchanged
;   card/ROM mapping restored before return
;   API is not re-entrant

RAM_E_OK                EQU     $00
RAM_E_NO_DEVICE         EQU     $01
RAM_E_NOT_INIT          EQU     $02
RAM_E_BAD_BANK          EQU     $03
RAM_E_RANGE             EQU     $04
RAM_E_READ_ONLY         EQU     $05
RAM_E_VERIFY            EQU     $06
RAM_E_BACKEND           EQU     $07
RAM_E_BAD_OVERLAY       EQU     $08
RAM_E_BUSY              EQU     $09
RAM_E_UNSUPPORTED       EQU     $0A

RAM_BACKEND_NONE        EQU     $00
RAM_BACKEND_LC16K       EQU     $01
RAM_BACKEND_SATURN      EQU     $02
RAM_BACKEND_RAMWORKS    EQU     $03
RAM_BACKEND_RAMFACTOR   EQU     $04
RAM_BACKEND_TEST        EQU     $7E
RAM_BACKEND_GENERIC     EQU     $7F

RAM_CAP_BLOCK_IO        EQU     $01
RAM_CAP_DIRECT_MAP      EQU     $02
RAM_CAP_DIRECT_EXEC     EQU     $04
RAM_CAP_HIDES_ROM       EQU     $08
RAM_CAP_AUX_MEMORY      EQU     $10
RAM_CAP_FAST_COPY       EQU     $20

; Persistent RAM-driver state.  V6.10 shared GPT16 state currently ends at
; $8C87, so this page does not overlap it.
RAM_INFO_BASE           EQU     $8F90
RAM_INFO_BACKEND        EQU     $8F90
RAM_INFO_CAPS           EQU     $8F91
RAM_INFO_BANKS_LO       EQU     $8F92
RAM_INFO_BANKS_HI       EQU     $8F93
RAM_INFO_SEL_LO         EQU     $8F94
RAM_INFO_SEL_HI         EQU     $8F95
RAM_INFO_LAST_ERROR     EQU     $8F96
RAM_INFO_READY          EQU     $8F97
RAM_INFO_READY_VALUE    EQU     $A5

; Internal transfer descriptor used by RAM_LOAD_OVERLAY.
RAM_INT_XFER            EQU     $8FC0

; Test marker only; production code must not rely on it.
RAM_TEST_MARKER         EQU     $8FF0

; Public 8-byte block descriptor.
RAM_XFER_OFF_LO         EQU     $00
RAM_XFER_OFF_HI         EQU     $01
RAM_XFER_MAIN_LO        EQU     $02
RAM_XFER_MAIN_HI        EQU     $03
RAM_XFER_LEN_LO         EQU     $04
RAM_XFER_LEN_HI         EQU     $05
RAM_XFER_FLAGS          EQU     $06
RAM_XFER_RESERVED       EQU     $07
RAM_XFER_SIZE           EQU     $08

; Public 12-byte overlay descriptor.
RAM_OVL_BANK_LO         EQU     $00
RAM_OVL_BANK_HI         EQU     $01
RAM_OVL_OFF_LO          EQU     $02
RAM_OVL_OFF_HI          EQU     $03
RAM_OVL_DST_LO          EQU     $04
RAM_OVL_DST_HI          EQU     $05
RAM_OVL_LEN_LO          EQU     $06
RAM_OVL_LEN_HI          EQU     $07
RAM_OVL_CRC_LO          EQU     $08
RAM_OVL_CRC_HI          EQU     $09
RAM_OVL_FLAGS           EQU     $0A
RAM_OVL_RESERVED        EQU     $0B
RAM_OVL_SIZE            EQU     $0C

RAM_OVL_F_VERIFY_CRC    EQU     $01

RAM_OVERLAY_MIN         EQU     $6000
RAM_OVERLAY_END         EQU     $8400
RAM_LOGICAL_BANK_SIZE   EQU     $4000

; Private zero-page scratch reserved for the RAM driver.
; GPT16 V6.10 currently uses $F0-$F3 for MSG/FM pointers; this intentionally
; stays below that range.
RAM_ZP_DESC_LO          EQU     $E8
RAM_ZP_DESC_HI          EQU     $E9
RAM_ZP_EXP_LO           EQU     $EA
RAM_ZP_EXP_HI           EQU     $EB
RAM_ZP_MAIN_LO          EQU     $EC
RAM_ZP_MAIN_HI          EQU     $ED
RAM_ZP_LEN_LO           EQU     $EE
RAM_ZP_LEN_HI           EQU     $EF

; =============================================================================
; GPT16_RAM_BACKEND_TEST.S
; Deterministic one-bank backend for validating the card-neutral API.
;
; This is NOT a hardware driver.  It exposes ordinary main RAM $2000-$5FFF as
; one fake 16 KiB expansion bank so the API, block copy and overlay loader can
; be proven before touching Language Card / Saturn / RamWorks hardware.
; =============================================================================

TEST_RAM_BASE           EQU     $2000
TEST_RAM_END            EQU     $6000

        ORG     $8E00

RBE_ENTRY_PROBE
        JMP     RBT_PROBE
RBE_ENTRY_SELECT
        JMP     RBT_SELECT
RBE_ENTRY_READ
        JMP     RBT_READ
RBE_ENTRY_WRITE
        JMP     RBT_WRITE
RBE_ENTRY_LOAD
        JMP     RBT_LOAD

        ORG     $8E20

RBT_PROBE
        LDA     #RAM_CAP_BLOCK_IO
        STA     RAM_INFO_CAPS
        LDA     #$01
        STA     RAM_INFO_BANKS_LO
        LDA     #$00
        STA     RAM_INFO_BANKS_HI
        STA     RAM_INFO_SEL_LO
        STA     RAM_INFO_SEL_HI
        LDA     #RAM_BACKEND_TEST
        CLC
        RTS

; Input A=bank low, X=bank high.
RBT_SELECT
        CPX     #$00
        BNE     RBT_BAD_BANK
        CMP     #$00
        BNE     RBT_BAD_BANK
        STA     RAM_INFO_SEL_LO
        STX     RAM_INFO_SEL_HI
        CLC
        RTS
RBT_BAD_BANK
        LDA     #RAM_E_BAD_BANK
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

; Input A/X -> 8-byte RAM_XFER descriptor.
RBT_READ
        JSR     RBT_PREP_XFER
        BCS     RBT_RETURN
        JSR     RBT_COPY_EXP_TO_MAIN
        CLC
RBT_RETURN
        RTS

RBT_WRITE
        JSR     RBT_PREP_XFER
        BCS     RBT_RETURN
        JSR     RBT_COPY_MAIN_TO_EXP
        CLC
        RTS

; Validate and unpack a block descriptor.
RBT_PREP_XFER
        STA     RAM_ZP_DESC_LO
        STX     RAM_ZP_DESC_HI

        LDY     #RAM_XFER_FLAGS
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RBT_UNSUPPORTED

        LDY     #RAM_XFER_OFF_LO
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_ZP_EXP_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        CMP     #$40
        BCS     RBT_RANGE
        CLC
        ADC     #>TEST_RAM_BASE
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

        ; physical fake-bank pointer + length must be <= $6000
        LDA     RAM_ZP_EXP_LO
        CLC
        ADC     RAM_ZP_LEN_LO
        STA     RAM_INFO_LAST_ERROR      ; temporary low end
        LDA     RAM_ZP_EXP_HI
        ADC     RAM_ZP_LEN_HI
        CMP     #>TEST_RAM_END
        BCC     RBT_PREP_OK
        BNE     RBT_RANGE
        LDA     RAM_INFO_LAST_ERROR
        BNE     RBT_RANGE
RBT_PREP_OK
        LDA     #RAM_E_OK
        STA     RAM_INFO_LAST_ERROR
        CLC
        RTS

RBT_RANGE
        LDA     #RAM_E_RANGE
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS
RBT_UNSUPPORTED
        LDA     #RAM_E_UNSUPPORTED
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS

RBT_COPY_EXP_TO_MAIN
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     RBT_COPY_DONE
        LDY     #$00
RBT_R_LOOP
        LDA     (RAM_ZP_EXP_LO),Y
        STA     (RAM_ZP_MAIN_LO),Y
        JSR     RBT_ADVANCE_PTRS
        JSR     RBT_DEC_LEN
        BNE     RBT_R_LOOP
RBT_COPY_DONE
        RTS

RBT_COPY_MAIN_TO_EXP
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     RBT_COPY_DONE
        LDY     #$00
RBT_W_LOOP
        LDA     (RAM_ZP_MAIN_LO),Y
        STA     (RAM_ZP_EXP_LO),Y
        JSR     RBT_ADVANCE_PTRS
        JSR     RBT_DEC_LEN
        BNE     RBT_W_LOOP
        RTS

RBT_ADVANCE_PTRS
        INC     RAM_ZP_EXP_LO
        BNE     RBT_ADV_MAIN
        INC     RAM_ZP_EXP_HI
RBT_ADV_MAIN
        INC     RAM_ZP_MAIN_LO
        BNE     RBT_ADV_DONE
        INC     RAM_ZP_MAIN_HI
RBT_ADV_DONE
        RTS

; Return Z=1 when length becomes zero, Z=0 otherwise.
RBT_DEC_LEN
        LDA     RAM_ZP_LEN_LO
        BNE     RBT_DEC_LOW
        LDA     RAM_ZP_LEN_HI
        BEQ     RBT_DEC_ZERO
        DEC     RAM_ZP_LEN_HI
RBT_DEC_LOW
        DEC     RAM_ZP_LEN_LO
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        RTS
RBT_DEC_ZERO
        LDA     #$00
        RTS

; Input A/X -> 12-byte RAM_OVL descriptor.
; V1 prototype intentionally rejects CRC verification; the flag is reserved.
RBT_LOAD
        STA     RAM_ZP_DESC_LO
        STX     RAM_ZP_DESC_HI

        LDY     #RAM_OVL_FLAGS
        LDA     (RAM_ZP_DESC_LO),Y
        BNE     RBT_UNSUPPORTED

        ; Test backend has only logical bank 0.
        LDY     #RAM_OVL_BANK_LO
        LDA     (RAM_ZP_DESC_LO),Y
        BEQ     RBT_LOAD_BANK_LO_OK
        JMP     RBT_BAD_BANK
RBT_LOAD_BANK_LO_OK
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        BEQ     RBT_LOAD_BANK_OK
        JMP     RBT_BAD_BANK
RBT_LOAD_BANK_OK

        ; Build ordinary transfer descriptor at $8F20.
        LDY     #RAM_OVL_OFF_LO
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_OFF_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_OFF_HI
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_MAIN_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_MAIN_HI
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_LEN_LO
        INY
        LDA     (RAM_ZP_DESC_LO),Y
        STA     RAM_INT_XFER+RAM_XFER_LEN_HI
        LDA     #$00
        STA     RAM_INT_XFER+RAM_XFER_FLAGS
        STA     RAM_INT_XFER+RAM_XFER_RESERVED

        ; Destination must begin at/above $6000.
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_HI
        CMP     #>RAM_OVERLAY_MIN
        BCC     RBT_BAD_OVERLAY

        ; destination + length must be <= $8400
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_LO
        CLC
        ADC     RAM_INT_XFER+RAM_XFER_LEN_LO
        STA     RAM_INFO_LAST_ERROR      ; temporary end low
        LDA     RAM_INT_XFER+RAM_XFER_MAIN_HI
        ADC     RAM_INT_XFER+RAM_XFER_LEN_HI
        CMP     #>RAM_OVERLAY_END
        BCC     RBT_LOAD_COPY
        BNE     RBT_BAD_OVERLAY
        LDA     RAM_INFO_LAST_ERROR
        BNE     RBT_BAD_OVERLAY

RBT_LOAD_COPY
        LDA     #<RAM_INT_XFER
        LDX     #>RAM_INT_XFER
        JMP     RBT_READ

RBT_BAD_OVERLAY
        LDA     #RAM_E_BAD_OVERLAY
        STA     RAM_INFO_LAST_ERROR
        SEC
        RTS
