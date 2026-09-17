; =============================================================================
; SERIALPRO_TEST.S
; Standalone verification program for SERIALPRO.S / SERIALPRO_API.INC
; RetroAppleJS ASM_core.js / NMOS 6502
; Load address: $6000
; =============================================================================
;
; Phase 1 is deterministic and requires no card:
;   - binds the driver's low-level I/O seams to memory-backed mock routines
;   - sends/receives every byte $00..$FF unchanged
;   - verifies AGAIN, parity, framing, overrun, backend RX/TX/config errors,
;     and NOT_OPEN propagation
;
; Phase 2 is optional real hardware loopback:
;   - finds a Serial Pro v2.0
;   - user connects/enables TXD -> RXD loopback
;   - press L to transmit/receive all 256 byte values
;
; The test intentionally exercises only the public SP_* API calls.  The only
; internal dependency is MOCK_BIND, which patches the documented SP_IO_*_JMP
; test seams in SERIALPRO.S.
; =============================================================================

        ORG     $6000

TEST_ENTRY
        JMP     TEST_MAIN

        .IN     "SERIALPRO.S"

M_COUT                  EQU     $FDED
M_RDKEY                 EQU     $FD0C

KEY_ESC                 EQU     $1B

TEST_ERR_MISMATCH       EQU     $E0
TEST_ERR_TIMEOUT        EQU     $E1
TEST_ERR_UNEXPECTED     EQU     $E2

MOCK_OP_NONE            EQU     $00
MOCK_OP_READ_STATUS     EQU     $01
MOCK_OP_READ_DATA       EQU     $02
MOCK_OP_WRITE_DATA      EQU     $03
MOCK_OP_WRITE_STATUS    EQU     $04
MOCK_OP_WRITE_COMMAND   EQU     $05
MOCK_OP_WRITE_CONTROL   EQU     $06

TEST_FAILURES
        .BYTE   $00
TEST_LAST_ERROR
        .BYTE   $00
TEST_EXPECT
        .BYTE   $00
TEST_TIMEOUT_LO
        .BYTE   $00
TEST_TIMEOUT_HI
        .BYTE   $00
TEST_REAL_SLOT
        .BYTE   $00

MOCK_STATUS
        .BYTE   $00
MOCK_DATA
        .BYTE   $00
MOCK_COMMAND
        .BYTE   $00
MOCK_CONTROL
        .BYTE   $00
MOCK_STATUS_WRITE
        .BYTE   $00
MOCK_FAIL_OP
        .BYTE   MOCK_OP_NONE
MOCK_FAIL_CODE
        .BYTE   SP_ERR_IO
MOCK_PENDING
        .BYTE   $00

; =============================================================================
; MAIN
; =============================================================================

TEST_MAIN
        LDA     #$00
        STA     TEST_FAILURES
        JSR     TEST_NL
        LDX     #<TXT_TITLE
        LDY     #>TXT_TITLE
        JSR     TEST_PRINT
        JSR     TEST_NL

        JSR     MOCK_BIND

        LDX     #<TXT_MOCK_256
        LDY     #>TXT_MOCK_256
        JSR     TEST_PRINT
        JSR     TEST_MOCK_256
        JSR     TEST_REPORT

        LDX     #<TXT_AGAIN
        LDY     #>TXT_AGAIN
        JSR     TEST_PRINT
        JSR     TEST_RX_AGAIN
        JSR     TEST_REPORT

        LDX     #<TXT_PARITY
        LDY     #>TXT_PARITY
        JSR     TEST_PRINT
        JSR     TEST_RX_PARITY
        JSR     TEST_REPORT

        LDX     #<TXT_FRAMING
        LDY     #>TXT_FRAMING
        JSR     TEST_PRINT
        JSR     TEST_RX_FRAMING
        JSR     TEST_REPORT

        LDX     #<TXT_OVERRUN
        LDY     #>TXT_OVERRUN
        JSR     TEST_PRINT
        JSR     TEST_RX_OVERRUN
        JSR     TEST_REPORT

        LDX     #<TXT_RX_BACKEND
        LDY     #>TXT_RX_BACKEND
        JSR     TEST_PRINT
        JSR     TEST_RX_BACKEND_ERROR
        JSR     TEST_REPORT

        LDX     #<TXT_DATA_BACKEND
        LDY     #>TXT_DATA_BACKEND
        JSR     TEST_PRINT
        JSR     TEST_DATA_BACKEND_ERROR
        JSR     TEST_REPORT

        LDX     #<TXT_TX_BACKEND
        LDY     #>TXT_TX_BACKEND
        JSR     TEST_PRINT
        JSR     TEST_TX_BACKEND_ERROR
        JSR     TEST_REPORT

        LDX     #<TXT_RESET_BACKEND
        LDY     #>TXT_RESET_BACKEND
        JSR     TEST_PRINT
        JSR     TEST_RESET_BACKEND_ERROR
        JSR     TEST_REPORT

        LDX     #<TXT_NOT_OPEN
        LDY     #>TXT_NOT_OPEN
        JSR     TEST_PRINT
        JSR     TEST_NOT_OPEN
        JSR     TEST_REPORT

        LDA     TEST_FAILURES
        BNE     TEST_MOCK_SUMMARY_FAIL
        LDX     #<TXT_MOCK_ALL_PASS
        LDY     #>TXT_MOCK_ALL_PASS
        JSR     TEST_PRINT
        JSR     TEST_NL
        JMP     TEST_REAL_DISCOVER
TEST_MOCK_SUMMARY_FAIL
        LDX     #<TXT_MOCK_FAILS
        LDY     #>TXT_MOCK_FAILS
        JSR     TEST_PRINT
        LDA     TEST_FAILURES
        JSR     TEST_HEX
        JSR     TEST_NL

; =============================================================================
; OPTIONAL REAL LOOPBACK
; =============================================================================

TEST_REAL_DISCOVER
        JSR     SP_FIND
        BCC     TEST_REAL_FOUND
        LDX     #<TXT_REAL_NO_CARD
        LDY     #>TXT_REAL_NO_CARD
        JSR     TEST_PRINT
        JSR     TEST_NL
        JMP     TEST_DONE

TEST_REAL_FOUND
        STA     TEST_REAL_SLOT
        LDX     #<TXT_REAL_FOUND
        LDY     #>TXT_REAL_FOUND
        JSR     TEST_PRINT
        LDA     TEST_REAL_SLOT
        ORA     #'0'
        JSR     TEST_PUTC
        JSR     TEST_NL
        LDX     #<TXT_REAL_PROMPT
        LDY     #>TXT_REAL_PROMPT
        JSR     TEST_PRINT
        JSR     TEST_NL

TEST_REAL_KEY
        JSR     M_RDKEY
        AND     #$7F
        CMP     #KEY_ESC
        BEQ     TEST_DONE
        CMP     #'L'
        BEQ     TEST_REAL_RUN
        CMP     #'l'
        BNE     TEST_REAL_KEY

TEST_REAL_RUN
        LDA     TEST_REAL_SLOT
        LDX     #SP_CTRL_9600_8N1
        LDY     #SP_CMD_POLLED
        JSR     SP_OPEN
        BCC     TEST_REAL_OPEN_OK
        STA     TEST_LAST_ERROR
        LDX     #<TXT_REAL_OPEN_FAIL
        LDY     #>TXT_REAL_OPEN_FAIL
        JSR     TEST_PRINT
        LDA     TEST_LAST_ERROR
        JSR     TEST_HEX
        JSR     TEST_NL
        JMP     TEST_DONE

TEST_REAL_OPEN_OK
        JSR     SP_RX_FLUSH
        BCC     TEST_REAL_FLUSH_OK
        STA     TEST_LAST_ERROR
        LDX     #<TXT_REAL_FLUSH_FAIL
        LDY     #>TXT_REAL_FLUSH_FAIL
        JSR     TEST_PRINT
        LDA     TEST_LAST_ERROR
        JSR     TEST_HEX
        JSR     TEST_NL
        JSR     SP_CLOSE
        JMP     TEST_DONE

TEST_REAL_FLUSH_OK
        LDX     #<TXT_REAL_256
        LDY     #>TXT_REAL_256
        JSR     TEST_PRINT
        JSR     TEST_REAL_256
        JSR     TEST_REPORT
        JSR     SP_CLOSE

; =============================================================================
; END
; =============================================================================

TEST_DONE
        JSR     TEST_NL
        LDX     #<TXT_DONE
        LDY     #>TXT_DONE
        JSR     TEST_PRINT
        JSR     TEST_NL
        RTS

; =============================================================================
; MOCK TESTS
; =============================================================================

; All 256 byte values are sent through SP_TX_BYTE, captured unchanged by the
; mock write-data backend, then read back through SP_RX_POLL.
TEST_MOCK_256
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$18                    ; TDRE | RDRF
        STA     MOCK_STATUS
        LDA     #$00
        STA     TEST_EXPECT
TEST_MOCK_256_LOOP
        LDA     TEST_EXPECT
        JSR     SP_TX_BYTE
        BCS     TEST_MOCK_256_FAIL
        JSR     SP_RX_POLL
        BCS     TEST_MOCK_256_FAIL
        CMP     TEST_EXPECT
        BNE     TEST_MOCK_256_MISMATCH
        INC     TEST_EXPECT
        BNE     TEST_MOCK_256_LOOP
        LDA     #SP_OK
        CLC
        RTS
TEST_MOCK_256_MISMATCH
        LDA     #TEST_ERR_MISMATCH
TEST_MOCK_256_FAIL
        SEC
        RTS

TEST_RX_AGAIN
        JSR     MOCK_CLEAR_FAILURE
        LDA     #SP_ST_TDRE
        STA     MOCK_STATUS
        JSR     SP_RX_POLL
        BCS     TEST_RX_AGAIN_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_AGAIN_HAVE_ERROR
        CMP     #SP_ERR_AGAIN
        BEQ     TEST_RX_AGAIN_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_AGAIN_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_RX_PARITY
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$19                    ; TDRE | RDRF | PARITY
        STA     MOCK_STATUS
        JSR     SP_RX_POLL
        BCS     TEST_RX_PARITY_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_PARITY_HAVE_ERROR
        CMP     #SP_ERR_PARITY
        BEQ     TEST_RX_PARITY_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_PARITY_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_RX_FRAMING
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$1A                    ; TDRE | RDRF | FRAMING
        STA     MOCK_STATUS
        JSR     SP_RX_POLL
        BCS     TEST_RX_FRAMING_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_FRAMING_HAVE_ERROR
        CMP     #SP_ERR_FRAMING
        BEQ     TEST_RX_FRAMING_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_FRAMING_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_RX_OVERRUN
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$1C                    ; TDRE | RDRF | OVERRUN
        STA     MOCK_STATUS
        JSR     SP_RX_POLL
        BCS     TEST_RX_OVERRUN_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_OVERRUN_HAVE_ERROR
        CMP     #SP_ERR_OVERRUN
        BEQ     TEST_RX_OVERRUN_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_OVERRUN_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_RX_BACKEND_ERROR
        JSR     MOCK_CLEAR_FAILURE
        LDA     #MOCK_OP_READ_STATUS
        STA     MOCK_FAIL_OP
        LDA     #SP_ERR_IO
        STA     MOCK_FAIL_CODE
        JSR     SP_RX_POLL
        JSR     MOCK_CLEAR_FAILURE_KEEP_FLAGS
        BCS     TEST_RX_BACKEND_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_BACKEND_HAVE_ERROR
        CMP     #SP_ERR_IO
        BEQ     TEST_RX_BACKEND_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RX_BACKEND_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_DATA_BACKEND_ERROR
        JSR     MOCK_CLEAR_FAILURE
        LDA     #SP_ST_RDRF
        STA     MOCK_STATUS
        LDA     #MOCK_OP_READ_DATA
        STA     MOCK_FAIL_OP
        LDA     #SP_ERR_IO
        STA     MOCK_FAIL_CODE
        JSR     SP_RX_POLL
        JSR     MOCK_CLEAR_FAILURE_KEEP_FLAGS
        BCS     TEST_DATA_BACKEND_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_DATA_BACKEND_HAVE_ERROR
        CMP     #SP_ERR_IO
        BEQ     TEST_DATA_BACKEND_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_DATA_BACKEND_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_TX_BACKEND_ERROR
        JSR     MOCK_CLEAR_FAILURE
        LDA     #SP_ST_TDRE
        STA     MOCK_STATUS
        LDA     #MOCK_OP_WRITE_DATA
        STA     MOCK_FAIL_OP
        LDA     #SP_ERR_TX
        STA     MOCK_FAIL_CODE
        LDA     #$55
        JSR     SP_TX_BYTE
        JSR     MOCK_CLEAR_FAILURE_KEEP_FLAGS
        BCS     TEST_TX_BACKEND_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_TX_BACKEND_HAVE_ERROR
        CMP     #SP_ERR_TX
        BEQ     TEST_TX_BACKEND_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_TX_BACKEND_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_RESET_BACKEND_ERROR
        JSR     MOCK_CLEAR_FAILURE
        LDA     #MOCK_OP_WRITE_COMMAND
        STA     MOCK_FAIL_OP
        LDA     #SP_ERR_CONFIG
        STA     MOCK_FAIL_CODE
        JSR     SP_RESET
        JSR     MOCK_CLEAR_FAILURE_KEEP_FLAGS
        BCS     TEST_RESET_BACKEND_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RESET_BACKEND_HAVE_ERROR
        CMP     #SP_ERR_CONFIG
        BEQ     TEST_RESET_BACKEND_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_RESET_BACKEND_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_NOT_OPEN
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$00
        STA     SP_SLOT_ACTIVE
        JSR     SP_RX_POLL
        PHP
        STA     TEST_LAST_ERROR
        LDA     #$01
        STA     SP_SLOT_ACTIVE
        LDA     TEST_LAST_ERROR
        PLP
        BCS     TEST_NOT_OPEN_HAVE_ERROR
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_NOT_OPEN_HAVE_ERROR
        CMP     #SP_ERR_NOT_OPEN
        BEQ     TEST_NOT_OPEN_OK
        JMP     TEST_EXPECTED_ERROR_BAD
TEST_NOT_OPEN_OK
        LDA     #SP_OK
        CLC
        RTS

TEST_EXPECTED_ERROR_BAD
        LDA     #TEST_ERR_UNEXPECTED
        SEC
        RTS

; Preserve A and carry returned by the operation while clearing injection.
MOCK_CLEAR_FAILURE_KEEP_FLAGS
        PHP
        PHA
        LDA     #MOCK_OP_NONE
        STA     MOCK_FAIL_OP
        PLA
        PLP
        RTS

; =============================================================================
; REAL 256-BYTE LOOPBACK
; =============================================================================

TEST_REAL_256
        LDA     #$00
        STA     TEST_EXPECT
TEST_REAL_256_LOOP
        LDA     TEST_EXPECT
        JSR     SP_TX_BYTE
        BCS     TEST_REAL_256_FAIL

        LDA     #$00
        STA     TEST_TIMEOUT_LO
        LDA     #$10
        STA     TEST_TIMEOUT_HI
TEST_REAL_WAIT_RX
        JSR     SP_RX_POLL
        BCC     TEST_REAL_GOT_RX
        CMP     #SP_ERR_AGAIN
        BNE     TEST_REAL_256_FAIL
        DEC     TEST_TIMEOUT_LO
        BNE     TEST_REAL_WAIT_RX
        DEC     TEST_TIMEOUT_HI
        BNE     TEST_REAL_WAIT_RX
        LDA     #TEST_ERR_TIMEOUT
        SEC
        RTS

TEST_REAL_GOT_RX
        CMP     TEST_EXPECT
        BNE     TEST_REAL_MISMATCH
        INC     TEST_EXPECT
        BNE     TEST_REAL_256_LOOP
        LDA     #SP_OK
        CLC
        RTS
TEST_REAL_MISMATCH
        LDA     #TEST_ERR_MISMATCH
TEST_REAL_256_FAIL
        SEC
        RTS

; =============================================================================
; MOCK BACKEND BINDING
; =============================================================================

MOCK_BIND
        LDA     #<MOCK_READ_STATUS
        STA     SP_IO_READ_STATUS_JMP+1
        LDA     #>MOCK_READ_STATUS
        STA     SP_IO_READ_STATUS_JMP+2
        LDA     #<MOCK_READ_DATA
        STA     SP_IO_READ_DATA_JMP+1
        LDA     #>MOCK_READ_DATA
        STA     SP_IO_READ_DATA_JMP+2
        LDA     #<MOCK_WRITE_DATA
        STA     SP_IO_WRITE_DATA_JMP+1
        LDA     #>MOCK_WRITE_DATA
        STA     SP_IO_WRITE_DATA_JMP+2
        LDA     #<MOCK_WRITE_STATUS
        STA     SP_IO_WRITE_STATUS_JMP+1
        LDA     #>MOCK_WRITE_STATUS
        STA     SP_IO_WRITE_STATUS_JMP+2
        LDA     #<MOCK_WRITE_COMMAND
        STA     SP_IO_WRITE_COMMAND_JMP+1
        LDA     #>MOCK_WRITE_COMMAND
        STA     SP_IO_WRITE_COMMAND_JMP+2
        LDA     #<MOCK_WRITE_CONTROL
        STA     SP_IO_WRITE_CONTROL_JMP+1
        LDA     #>MOCK_WRITE_CONTROL
        STA     SP_IO_WRITE_CONTROL_JMP+2

        LDA     #$01                    ; logical open state for API tests
        STA     SP_SLOT_ACTIVE
        LDA     #SP_CTRL_9600_8N1
        STA     SP_CONFIG_CONTROL
        LDA     #SP_CMD_POLLED
        STA     SP_CONFIG_COMMAND
        JSR     MOCK_CLEAR_FAILURE
        LDA     #$18
        STA     MOCK_STATUS
        RTS

MOCK_CLEAR_FAILURE
        LDA     #MOCK_OP_NONE
        STA     MOCK_FAIL_OP
        LDA     #SP_ERR_IO
        STA     MOCK_FAIL_CODE
        RTS

MOCK_READ_STATUS
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_READ_STATUS
        BEQ     MOCK_FAIL
        LDA     MOCK_STATUS
        CLC
        RTS

MOCK_READ_DATA
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_READ_DATA
        BEQ     MOCK_FAIL
        LDA     MOCK_DATA
        CLC
        RTS

MOCK_WRITE_DATA
        STA     MOCK_PENDING
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_WRITE_DATA
        BEQ     MOCK_FAIL
        LDA     MOCK_PENDING
        STA     MOCK_DATA               ; loopback: TX byte becomes RX byte
        CLC
        RTS

MOCK_WRITE_STATUS
        STA     MOCK_PENDING
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_WRITE_STATUS
        BEQ     MOCK_FAIL
        LDA     MOCK_PENDING
        STA     MOCK_STATUS_WRITE
        CLC
        RTS

MOCK_WRITE_COMMAND
        STA     MOCK_PENDING
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_WRITE_COMMAND
        BEQ     MOCK_FAIL
        LDA     MOCK_PENDING
        STA     MOCK_COMMAND
        CLC
        RTS

MOCK_WRITE_CONTROL
        STA     MOCK_PENDING
        LDA     MOCK_FAIL_OP
        CMP     #MOCK_OP_WRITE_CONTROL
        BEQ     MOCK_FAIL
        LDA     MOCK_PENDING
        STA     MOCK_CONTROL
        CLC
        RTS

MOCK_FAIL
        LDA     MOCK_FAIL_CODE
        SEC
        RTS

; =============================================================================
; CONSOLE HELPERS
; =============================================================================

; X/Y = low/high address of zero-terminated low-bit ASCII string.
TEST_PRINT
        STX     TEST_PTR_LO
        STY     TEST_PTR_HI
        LDY     #$00
TEST_PRINT_LOOP
        LDA     (TEST_PTR_LO),Y
        BEQ     TEST_PRINT_DONE
        JSR     TEST_PUTC
        INY
        BNE     TEST_PRINT_LOOP
        INC     TEST_PTR_HI
        JMP     TEST_PRINT_LOOP
TEST_PRINT_DONE
        RTS

TEST_PUTC
        ORA     #$80
        JSR     M_COUT
        RTS

TEST_NL
        LDA     #$8D
        JSR     M_COUT
        RTS

TEST_REPORT
        STA     TEST_LAST_ERROR
        BCC     TEST_REPORT_PASS
        INC     TEST_FAILURES
        LDX     #<TXT_FAIL
        LDY     #>TXT_FAIL
        JSR     TEST_PRINT
        LDA     TEST_LAST_ERROR
        JSR     TEST_HEX
        JSR     TEST_NL
        RTS
TEST_REPORT_PASS
        LDX     #<TXT_PASS
        LDY     #>TXT_PASS
        JSR     TEST_PRINT
        JSR     TEST_NL
        RTS

TEST_HEX
        PHA
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        JSR     TEST_HEX_NIBBLE
        PLA
        AND     #$0F
TEST_HEX_NIBBLE
        CMP     #$0A
        BCC     TEST_HEX_DIGIT
        CLC
        ADC     #$37
        JMP     TEST_PUTC
TEST_HEX_DIGIT
        CLC
        ADC     #'0'
        JMP     TEST_PUTC

; Zero-page pointer reserved by this standalone test only.
TEST_PTR_LO             EQU     $F0
TEST_PTR_HI             EQU     $F1

; =============================================================================
; TEXT
; =============================================================================

TXT_TITLE
        ASC     'SERIAL PRO API TEST V1.0'
        .BYTE   $00
TXT_MOCK_256
        ASC     'MOCK 256-BYTE LOOPBACK .... '
        .BYTE   $00
TXT_AGAIN
        ASC     'RX EMPTY / AGAIN ........... '
        .BYTE   $00
TXT_PARITY
        ASC     'RX PARITY ERROR ............ '
        .BYTE   $00
TXT_FRAMING
        ASC     'RX FRAMING ERROR ........... '
        .BYTE   $00
TXT_OVERRUN
        ASC     'RX OVERRUN ERROR ........... '
        .BYTE   $00
TXT_RX_BACKEND
        ASC     'STATUS BACKEND ERROR ....... '
        .BYTE   $00
TXT_DATA_BACKEND
        ASC     'DATA BACKEND ERROR ......... '
        .BYTE   $00
TXT_TX_BACKEND
        ASC     'TX BACKEND ERROR ........... '
        .BYTE   $00
TXT_RESET_BACKEND
        ASC     'CONFIG BACKEND ERROR ....... '
        .BYTE   $00
TXT_NOT_OPEN
        ASC     'NOT-OPEN ERROR ............. '
        .BYTE   $00
TXT_PASS
        ASC     'PASS'
        .BYTE   $00
TXT_FAIL
        ASC     'FAIL $'
        .BYTE   $00
TXT_MOCK_ALL_PASS
        ASC     'MOCK SUITE: ALL PASS'
        .BYTE   $00
TXT_MOCK_FAILS
        ASC     'MOCK SUITE FAILURES: $'
        .BYTE   $00
TXT_REAL_NO_CARD
        ASC     'REAL LOOPBACK: SERIAL PRO NOT FOUND - SKIP'
        .BYTE   $00
TXT_REAL_FOUND
        ASC     'SERIAL PRO FOUND IN SLOT '
        .BYTE   $00
TXT_REAL_PROMPT
        ASC     'CONNECT/ENABLE TXD-RXD LOOPBACK; L=RUN ESC=SKIP'
        .BYTE   $00
TXT_REAL_OPEN_FAIL
        ASC     'REAL OPEN FAILED $'
        .BYTE   $00
TXT_REAL_FLUSH_FAIL
        ASC     'REAL RX FLUSH FAILED $'
        .BYTE   $00
TXT_REAL_256
        ASC     'REAL 256-BYTE LOOPBACK ..... '
        .BYTE   $00
TXT_DONE
        ASC     'TEST COMPLETE'
        .BYTE   $00
