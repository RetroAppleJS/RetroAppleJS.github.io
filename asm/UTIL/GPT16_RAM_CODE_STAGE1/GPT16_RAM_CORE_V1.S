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
; GPT16_RAM_CORE_V1.S
; Card-neutral resident RAM API core.
; Fits in the $8D00 page.  Hardware-specific code lives in $8E00-$8EFF.
; =============================================================================

        ORG     $8D00

; Fixed public ABI.  Do not move these six vectors after V1.1.
RAM_API_ENTRY_INIT
        JMP     RAM_INIT_IMPL
RAM_API_ENTRY_PRESENT
        JMP     RAM_PRESENT_IMPL
RAM_API_ENTRY_SELECT_BANK
        JMP     RAM_SELECT_IMPL
RAM_API_ENTRY_READ_BLOCK
        JMP     RAM_READ_IMPL
RAM_API_ENTRY_WRITE_BLOCK
        JMP     RAM_WRITE_IMPL
RAM_API_ENTRY_LOAD_OVERLAY
        JMP     RAM_LOAD_IMPL

        ORG     $8D20

RAM_INIT_IMPL
        LDA     #$00
        STA     RAM_INFO_READY
        STA     RAM_INFO_LAST_ERROR
        JSR     RAM_BACKEND_PROBE
        BCS     RAM_CORE_ERROR
        STA     RAM_INFO_BACKEND
        LDA     #RAM_INFO_READY_VALUE
        STA     RAM_INFO_READY
        LDA     RAM_INFO_BACKEND
        CLC
        RTS

RAM_PRESENT_IMPL
        LDA     RAM_INFO_READY
        CMP     #RAM_INFO_READY_VALUE
        BNE     RAM_NOT_INIT
        LDA     RAM_INFO_BACKEND
        CLC
        RTS

RAM_NOT_INIT
        LDA     #RAM_E_NOT_INIT
        SEC
        RTS

RAM_SELECT_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_SELECT

RAM_READ_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_READ

RAM_WRITE_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_WRITE

RAM_LOAD_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_LOAD

RAM_REQUIRE_READY
        PHA
        LDA     RAM_INFO_READY
        CMP     #RAM_INFO_READY_VALUE
        BEQ     RAM_READY_OK
        PLA
        LDA     #RAM_E_NOT_INIT
        SEC
        RTS
RAM_READY_OK
        PLA
        CLC
        RTS

RAM_CORE_ERROR
        STA     RAM_INFO_LAST_ERROR
        SEC
RAM_CORE_RETURN
        RTS
