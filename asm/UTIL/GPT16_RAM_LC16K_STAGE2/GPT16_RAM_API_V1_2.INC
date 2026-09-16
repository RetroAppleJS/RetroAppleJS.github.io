; =============================================================================
; GPT16_RAM_API_V1_2.INC
; Card-neutral RAM expansion API.
;
; Public API remains fixed at $8D00.
;
; Mapping postcondition:
; Backends that temporarily replace system ROM (notably LC16K) must return
; with system ROM visible and expansion RAM write-protected.  Classic Apple II
; Language Card state cannot be fully queried, so V1.2 defines this canonical
; return state instead of promising preservation of an unknown pre-call map.
; Hardware backend ABI remains fixed at $8E00.
;
; V1.2 internal-state placement:
;   $8C88-$8C9F  RAM API/backend state
;   $8CA0-$8CFF  available to compact backend helper code
;   $8D00-$8D7F  card-neutral API core
;   $8D80-$8DFF  backend helper code
;   $8E00-$8E0E  backend fixed JMP table
;   $8E20-$8FFF  backend implementation
;
; GPT16 V6.10 STATE_END is $8C80.  $8C80-$8C87 is left as a guard,
; and RAM state begins at $8C88, so validated CHAT/DOS state is untouched.
; =============================================================================

RAM_API_BASE            EQU     $8D00
RAM_INIT                EQU     $8D00
RAM_PRESENT             EQU     $8D03
RAM_SELECT_BANK         EQU     $8D06
RAM_READ_BLOCK          EQU     $8D09
RAM_WRITE_BLOCK         EQU     $8D0C
RAM_LOAD_OVERLAY        EQU     $8D0F

RAM_BACKEND_BASE        EQU     $8E00
RAM_BACKEND_PROBE       EQU     $8E00
RAM_BACKEND_SELECT      EQU     $8E03
RAM_BACKEND_READ        EQU     $8E06
RAM_BACKEND_WRITE       EQU     $8E09
RAM_BACKEND_LOAD        EQU     $8E0C

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

; ---------------------------------------------------------------------------
; RAM state.  These locations are not executable code.
; ---------------------------------------------------------------------------
RAM_INFO_BASE           EQU     $8C88
RAM_INFO_BACKEND        EQU     $8C88
RAM_INFO_CAPS           EQU     $8C89
RAM_INFO_BANKS_LO       EQU     $8C8A
RAM_INFO_BANKS_HI       EQU     $8C8B
RAM_INFO_SEL_LO         EQU     $8C8C
RAM_INFO_SEL_HI         EQU     $8C8D
RAM_INFO_LAST_ERROR     EQU     $8C8E
RAM_INFO_READY          EQU     $8C8F
RAM_INFO_READY_VALUE    EQU     $A5

RAM_INT_XFER            EQU     $8C90 ; 8 bytes: $8C98-$8C9F

; LC16K private persistent state.
RAM_LC_ROM_D0           EQU     $8C98
RAM_LC_ROM_E0           EQU     $8C99
RAM_LC_ROM_FD           EQU     $8C9A
RAM_LC_SAVE_B2          EQU     $8C9B
RAM_LC_SAVE_B1          EQU     $8C9C
RAM_LC_SAVE_HI          EQU     $8C9D
RAM_LC_PROBE_OK         EQU     $8C9E
RAM_LC_RESERVED         EQU     $8C9F

RAM_TEST_MARKER         EQU     $8C9F ; standalone tests only

; ---------------------------------------------------------------------------
; 8-byte block descriptor.
; ---------------------------------------------------------------------------
RAM_XFER_OFF_LO         EQU     $00
RAM_XFER_OFF_HI         EQU     $01
RAM_XFER_MAIN_LO        EQU     $02
RAM_XFER_MAIN_HI        EQU     $03
RAM_XFER_LEN_LO         EQU     $04
RAM_XFER_LEN_HI         EQU     $05
RAM_XFER_FLAGS          EQU     $06
RAM_XFER_RESERVED       EQU     $07
RAM_XFER_SIZE           EQU     $08

; ---------------------------------------------------------------------------
; 12-byte overlay descriptor.
; ---------------------------------------------------------------------------
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

; Private zero-page scratch.  GPT16 currently uses $F0-$F3 for MSG/FM
; pointers; the RAM layer stays below that area.
RAM_ZP_DESC_LO          EQU     $E8
RAM_ZP_DESC_HI          EQU     $E9
RAM_ZP_EXP_LO           EQU     $EA
RAM_ZP_EXP_HI           EQU     $EB
RAM_ZP_MAIN_LO          EQU     $EC
RAM_ZP_MAIN_HI          EQU     $ED
RAM_ZP_LEN_LO           EQU     $EE
RAM_ZP_LEN_HI           EQU     $EF
