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
; =============================================================================
; GPT16_RAM_CORE_V1_2.S
; Card-neutral resident RAM API core.
; =============================================================================

        ORG     $8D00

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

RAM_CORE_END
        .ASSERT RAM_CORE_END <= $8D80, error, "RAM API core exceeds $8D00-$8D7F"
; =============================================================================
; GPT16_RAM_LC16K_TEST.S
;
; Standalone destructive-safe test for the real 16 KiB Language Card backend.
; The test preserves and restores every LC byte it modifies.
;
; Assemble the combined source and CALL 4096 ($1000).
; =============================================================================

M_COUT                  EQU     $FDED
TEST_DST                EQU     $7000

        ORG     $1000

LC_TEST_START
        ; Establish the same canonical ROM-visible state required from backend.
        BIT     $C082
        LDA     $D000
        STA     TEST_ROM_D0
        LDA     $E000
        STA     TEST_ROM_E0
        LDA     $FDED
        STA     TEST_ROM_FD

        LDX     #<MSG_START
        LDY     #>MSG_START
        JSR     PRINT_Z

        JSR     RAM_INIT
        BCC     TEST_INIT_RC_OK
        CMP     #RAM_E_NO_DEVICE
        BNE     TEST_INIT_NOT_NODEV
        JMP     TEST_NO_LC
TEST_INIT_NOT_NODEV
        JMP     TEST_FAIL_INIT
TEST_INIT_RC_OK
        CMP     #RAM_BACKEND_LC16K
        BEQ     TEST_INIT_ID_OK
        JMP     TEST_FAIL_INIT
TEST_INIT_ID_OK
        JSR     TEST_ROM_CHECK
        BCC     TEST_INIT_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_INIT_ROM_OK

        JSR     RAM_PRESENT
        BCC     TEST_PRESENT_OK
        JMP     TEST_FAIL_PRESENT
TEST_PRESENT_OK
        CMP     #RAM_BACKEND_LC16K
        BEQ     TEST_PRESENT_ID_OK
        JMP     TEST_FAIL_PRESENT
TEST_PRESENT_ID_OK
        JSR     TEST_ROM_CHECK
        BCC     TEST_PRESENT_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_PRESENT_ROM_OK

        ; Bank 0 succeeds.
        LDA     #$00
        LDX     #$00
        JSR     RAM_SELECT_BANK
        BCC     TEST_BANK0_OK
        JMP     TEST_FAIL_BANK
TEST_BANK0_OK
        JSR     TEST_ROM_CHECK
        BCC     TEST_BANK0_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_BANK0_ROM_OK

        ; Bank 1 must be rejected on a 16 KiB LC backend.
        LDA     #$01
        LDX     #$00
        JSR     RAM_SELECT_BANK
        BCS     TEST_BANK1_REJECTED
        JMP     TEST_FAIL_BANK
TEST_BANK1_REJECTED
        CMP     #RAM_E_BAD_BANK
        BEQ     TEST_BANK1_CODE_OK
        JMP     TEST_FAIL_BANK
TEST_BANK1_CODE_OK
        JSR     TEST_ROM_CHECK
        BCC     TEST_BANK_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_BANK_ROM_OK

        ; Test the bank2 Dx -> bank1 Dx logical boundary ($0FF8 + 32).
        LDA     #$F8
        LDX     #$0F
        JSR     TEST_BLOCK_CASE
        BCC     TEST_BOUNDARY1_OK
        JMP     TEST_FAIL_BOUNDARY1
TEST_BOUNDARY1_OK

        ; Test the bank1 Dx -> common Ex logical boundary ($1FF8 + 32).
        LDA     #$F8
        LDX     #$1F
        JSR     TEST_BLOCK_CASE
        BCC     TEST_BOUNDARY2_OK
        JMP     TEST_FAIL_BOUNDARY2
TEST_BOUNDARY2_OK

        ; A transfer crossing logical $4000 must be rejected.
        LDA     #<RANGE_DESC
        LDX     #>RANGE_DESC
        JSR     RAM_READ_BLOCK
        BCS     TEST_RANGE_REJECTED
        JMP     TEST_FAIL_RANGE
TEST_RANGE_REJECTED
        CMP     #RAM_E_RANGE
        BEQ     TEST_RANGE_CODE_OK
        JMP     TEST_FAIL_RANGE
TEST_RANGE_CODE_OK
        JSR     TEST_ROM_CHECK
        BCC     TEST_RANGE_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_RANGE_ROM_OK

        ; Test actual overlay storage in the common $E000-$FFFF LC region.
        JSR     TEST_OVERLAY_CASE
        BCC     TEST_OVERLAY_OK
        JMP     TEST_FAIL_OVERLAY
TEST_OVERLAY_OK

        JSR     TEST_ROM_CHECK
        BCC     TEST_FINAL_ROM_OK
        JMP     TEST_FAIL_ROM
TEST_FINAL_ROM_OK

        LDX     #<MSG_PASS
        LDY     #>MSG_PASS
        JSR     PRINT_Z
        RTS

; ---------------------------------------------------------------------------
; 32-byte read/write/read/compare case.
; Input A/X = logical LC offset.
; Always attempts to restore the original bytes after the first successful save.
; ---------------------------------------------------------------------------

TEST_BLOCK_CASE
        STA     CASE_DESC+RAM_XFER_OFF_LO
        STX     CASE_DESC+RAM_XFER_OFF_HI
        LDA     #$00
        STA     CASE_FAILED

        ; Save original LC bytes.
        LDA     #<CASE_SAVE
        LDX     #>CASE_SAVE
        JSR     CASE_SET_MAIN
        LDA     #<CASE_DESC
        LDX     #>CASE_DESC
        JSR     RAM_READ_BLOCK
        BCC     CASE_SAVE_READ_OK
        JMP     CASE_FAIL_BEFORE_WRITE
CASE_SAVE_READ_OK
        JSR     TEST_ROM_CHECK
        BCC     CASE_SAVE_ROM_OK
        JMP     CASE_FAIL_BEFORE_WRITE
CASE_SAVE_ROM_OK

        ; Write pattern.
        LDA     #<TEST_PATTERN32
        LDX     #>TEST_PATTERN32
        JSR     CASE_SET_MAIN
        LDA     #<CASE_DESC
        LDX     #>CASE_DESC
        JSR     RAM_WRITE_BLOCK
        BCC     CASE_WRITE_OK
        LDA     #$01
        STA     CASE_FAILED
        JMP     CASE_RESTORE
CASE_WRITE_OK
        JSR     TEST_ROM_CHECK
        BCC     CASE_READBACK
        LDA     #$01
        STA     CASE_FAILED
        JMP     CASE_RESTORE

CASE_READBACK
        LDA     #<CASE_READ
        LDX     #>CASE_READ
        JSR     CASE_SET_MAIN
        LDA     #<CASE_DESC
        LDX     #>CASE_DESC
        JSR     RAM_READ_BLOCK
        BCC     CASE_READ_OK
        LDA     #$01
        STA     CASE_FAILED
        JMP     CASE_RESTORE
CASE_READ_OK
        JSR     TEST_ROM_CHECK
        BCC     CASE_COMPARE
        LDA     #$01
        STA     CASE_FAILED
        JMP     CASE_RESTORE

CASE_COMPARE
        LDX     #$00
CASE_COMPARE_LOOP
        LDA     CASE_READ,X
        CMP     TEST_PATTERN32,X
        BEQ     CASE_COMPARE_NEXT
        LDA     #$01
        STA     CASE_FAILED
        JMP     CASE_RESTORE
CASE_COMPARE_NEXT
        INX
        CPX     #$20
        BNE     CASE_COMPARE_LOOP

CASE_RESTORE
        ; Restore original 32 bytes regardless of test result.
        LDA     #<CASE_SAVE
        LDX     #>CASE_SAVE
        JSR     CASE_SET_MAIN
        LDA     #<CASE_DESC
        LDX     #>CASE_DESC
        JSR     RAM_WRITE_BLOCK
        BCS     CASE_RESTORE_FAILED
        JSR     TEST_ROM_CHECK
        BCS     CASE_RESTORE_FAILED
        LDA     CASE_FAILED
        BEQ     CASE_SUCCESS
        SEC
        RTS
CASE_SUCCESS
        CLC
        RTS
CASE_RESTORE_FAILED
        SEC
        RTS

CASE_FAIL_BEFORE_WRITE
        SEC
        RTS

CASE_SET_MAIN
        STA     CASE_DESC+RAM_XFER_MAIN_LO
        STX     CASE_DESC+RAM_XFER_MAIN_HI
        RTS

; ---------------------------------------------------------------------------
; Overlay test.  Source LC bytes are preserved/restored.
; ---------------------------------------------------------------------------

TEST_OVERLAY_CASE
        LDA     #$00
        STA     OVERLAY_FAILED

        ; Preserve six bytes at logical $2100.
        LDA     #<OVL_SAVE_DESC
        LDX     #>OVL_SAVE_DESC
        JSR     RAM_READ_BLOCK
        BCS     OVL_FAIL_BEFORE_WRITE
        JSR     TEST_ROM_CHECK
        BCS     OVL_FAIL_BEFORE_WRITE

        ; Store six-byte executable image into LC.
        LDA     #<OVL_WRITE_DESC
        LDX     #>OVL_WRITE_DESC
        JSR     RAM_WRITE_BLOCK
        BCC     OVL_WRITE_OK
        LDA     #$01
        STA     OVERLAY_FAILED
        JMP     OVL_RESTORE
OVL_WRITE_OK
        JSR     TEST_ROM_CHECK
        BCC     OVL_DO_LOAD
        LDA     #$01
        STA     OVERLAY_FAILED
        JMP     OVL_RESTORE

OVL_DO_LOAD
        LDA     #$00
        STA     RAM_TEST_MARKER
        LDA     #<OVL_LOAD_DESC
        LDX     #>OVL_LOAD_DESC
        JSR     RAM_LOAD_OVERLAY
        BCC     OVL_LOAD_OK
        LDA     #$01
        STA     OVERLAY_FAILED
        JMP     OVL_RESTORE
OVL_LOAD_OK
        JSR     TEST_ROM_CHECK
        BCC     OVL_EXECUTE
        LDA     #$01
        STA     OVERLAY_FAILED
        JMP     OVL_RESTORE

OVL_EXECUTE
        JSR     $6000
        LDA     RAM_TEST_MARKER
        CMP     #$A5
        BEQ     OVL_RESTORE
        LDA     #$01
        STA     OVERLAY_FAILED

OVL_RESTORE
        LDA     #<OVL_RESTORE_DESC
        LDX     #>OVL_RESTORE_DESC
        JSR     RAM_WRITE_BLOCK
        BCS     OVL_RESTORE_FAILED
        JSR     TEST_ROM_CHECK
        BCS     OVL_RESTORE_FAILED
        LDA     OVERLAY_FAILED
        BEQ     OVL_SUCCESS
        SEC
        RTS
OVL_SUCCESS
        CLC
        RTS
OVL_RESTORE_FAILED
        SEC
        RTS

OVL_FAIL_BEFORE_WRITE
        SEC
        RTS

; ---------------------------------------------------------------------------
; Verify that an API call returned with the original system ROM visible.
; This routine intentionally does NOT touch any LC soft switch.
; ---------------------------------------------------------------------------

TEST_ROM_CHECK
        LDA     $D000
        CMP     TEST_ROM_D0
        BNE     TEST_ROM_BAD
        LDA     $E000
        CMP     TEST_ROM_E0
        BNE     TEST_ROM_BAD
        LDA     $FDED
        CMP     TEST_ROM_FD
        BNE     TEST_ROM_BAD
        CLC
        RTS
TEST_ROM_BAD
        SEC
        RTS

; ---------------------------------------------------------------------------
; Reporting
; ---------------------------------------------------------------------------

TEST_NO_LC
        BIT     $C082
        LDX     #<MSG_NO_LC
        LDY     #>MSG_NO_LC
        JSR     PRINT_Z
        RTS

TEST_FAIL_ROM
        ; We already detected the backend violation. Force ROM on only so that
        ; the failure can be reported safely.
        BIT     $C082
        LDX     #<MSG_F_ROM
        LDY     #>MSG_F_ROM
        JMP     TEST_PRINT_FAIL

TEST_FAIL_INIT
        LDX     #<MSG_F_INIT
        LDY     #>MSG_F_INIT
        JMP     TEST_PRINT_FAIL
TEST_FAIL_PRESENT
        LDX     #<MSG_F_PRESENT
        LDY     #>MSG_F_PRESENT
        JMP     TEST_PRINT_FAIL
TEST_FAIL_BANK
        LDX     #<MSG_F_BANK
        LDY     #>MSG_F_BANK
        JMP     TEST_PRINT_FAIL
TEST_FAIL_BOUNDARY1
        LDX     #<MSG_F_B1
        LDY     #>MSG_F_B1
        JMP     TEST_PRINT_FAIL
TEST_FAIL_BOUNDARY2
        LDX     #<MSG_F_B2
        LDY     #>MSG_F_B2
        JMP     TEST_PRINT_FAIL
TEST_FAIL_RANGE
        LDX     #<MSG_F_RANGE
        LDY     #>MSG_F_RANGE
        JMP     TEST_PRINT_FAIL
TEST_FAIL_OVERLAY
        LDX     #<MSG_F_OVL
        LDY     #>MSG_F_OVL

TEST_PRINT_FAIL
        BIT     $C082
        JSR     PRINT_Z
        RTS

; X/Y -> zero-terminated ASCII string.  Monitor COUT expects high-bit text.
PRINT_Z
        STX     $F0
        STY     $F1
        LDY     #$00
PRINT_Z_LOOP
        LDA     ($F0),Y
        BEQ     PRINT_Z_DONE
        ORA     #$80
        JSR     M_COUT
        INY
        BNE     PRINT_Z_LOOP
        INC     $F1
        JMP     PRINT_Z_LOOP
PRINT_Z_DONE
        LDA     #$8D
        JSR     M_COUT
        RTS

; ---------------------------------------------------------------------------
; Test descriptors / buffers.
; ---------------------------------------------------------------------------

CASE_DESC
        HEX     00 00
        DA      CASE_SAVE
        HEX     20 00
        HEX     00 00

RANGE_DESC
        HEX     F8 3F
        DA      CASE_READ
        HEX     20 00
        HEX     00 00

OVL_SAVE_DESC
        HEX     00 21
        DA      OVL_SAVE
        HEX     06 00
        HEX     00 00

OVL_WRITE_DESC
        HEX     00 21
        DA      TEST_OVERLAY_IMAGE
        HEX     06 00
        HEX     00 00

OVL_RESTORE_DESC
        HEX     00 21
        DA      OVL_SAVE
        HEX     06 00
        HEX     00 00

OVL_LOAD_DESC
        HEX     00 00
        HEX     00 21
        HEX     00 60
        HEX     06 00
        HEX     00 00
        HEX     00 00

TEST_PATTERN32
        HEX     00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF
        HEX     F0 E1 D2 C3 B4 A5 96 87 78 69 5A 4B 3C 2D 1E 0F

; Raw code for destination $6000:
;   LDA #$A5
;   STA $8C9F
;   RTS
TEST_OVERLAY_IMAGE
        HEX     A9 A5 8D 9F 8C 60

CASE_SAVE
        HEX     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
        HEX     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
CASE_READ
        HEX     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
        HEX     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
OVL_SAVE
        HEX     00 00 00 00 00 00

CASE_FAILED
        HEX     00
OVERLAY_FAILED
        HEX     00
TEST_ROM_D0
        HEX     00
TEST_ROM_E0
        HEX     00
TEST_ROM_FD
        HEX     00

MSG_START
        ASC     "LC16K RAM API TEST"
        HEX     00
MSG_PASS
        ASC     "PASS: LC16K BANKS R/W ROM RESTORE OVERLAY EXEC"
        HEX     00
MSG_NO_LC
        ASC     "NO 16K LANGUAGE CARD DETECTED"
        HEX     00
MSG_F_INIT
        ASC     "FAIL LC INIT"
        HEX     00
MSG_F_PRESENT
        ASC     "FAIL LC PRESENT"
        HEX     00
MSG_F_BANK
        ASC     "FAIL LC BANK SELECT"
        HEX     00
MSG_F_B1
        ASC     "FAIL LC B2-B1 BOUNDARY"
        HEX     00
MSG_F_B2
        ASC     "FAIL LC B1-HIGH BOUNDARY"
        HEX     00
MSG_F_RANGE
        ASC     "FAIL LC RANGE CHECK"
        HEX     00
MSG_F_OVL
        ASC     "FAIL LC OVERLAY"
        HEX     00
MSG_F_ROM
        ASC     "FAIL LC ROM RESTORE"
        HEX     00
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
