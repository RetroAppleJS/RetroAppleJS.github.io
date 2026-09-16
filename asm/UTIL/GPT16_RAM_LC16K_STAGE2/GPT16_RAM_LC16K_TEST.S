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
