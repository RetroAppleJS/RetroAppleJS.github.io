; =============================================================================
; SERIALPRO.S
; Reusable Applied Engineering Serial Pro / 6551 byte-stream driver
; RetroAppleJS ASM_core.js / NMOS 6502
; =============================================================================
;
; This module intentionally contains no Kermit, terminal, DOS, ProDOS, UTF or
; line-discipline logic.  It exposes a raw 8-bit byte stream only.
;
; The code is position independent except for ordinary absolute references made
; by the assembler.  It contains no ORG; the caller chooses its load address.
;
; Testability
; -----------
; Six three-byte low-level JMP trampolines isolate hardware register access.
; Production SP_OPEN binds them to the real 6551 accessors.  A unit test may
; patch the two operand bytes at SP_IO_*_JMP+1/+2 to mock routines.  These
; SP_IO_*_JMP labels are test seams, not part of the stable SP_API jump table.
; =============================================================================

        .IN     "SERIALPRO_API.INC"

SP_C8_RELEASE           EQU     $CFFF

; =============================================================================
; STABLE PUBLIC JUMP TABLE
; =============================================================================

SP_API
SP_API_FIND
        JMP     SP_FIND
SP_API_PROBE
        JMP     SP_PROBE
SP_API_OPEN
        JMP     SP_OPEN
SP_API_CLOSE
        JMP     SP_CLOSE
SP_API_RX_POLL
        JMP     SP_RX_POLL
SP_API_RX_BYTE
        JMP     SP_RX_BYTE
SP_API_TX_READY
        JMP     SP_TX_READY
SP_API_TX_BYTE
        JMP     SP_TX_BYTE
SP_API_RX_FLUSH
        JMP     SP_RX_FLUSH
SP_API_STATUS
        JMP     SP_STATUS
SP_API_GET_SLOT
        JMP     SP_GET_SLOT
SP_API_RESET
        JMP     SP_RESET

; =============================================================================
; DRIVER STATE
; =============================================================================

SP_SLOT_ACTIVE
        .BYTE   $00
SP_WORK_SLOT
        .BYTE   $00
SP_CONFIG_CONTROL
        .BYTE   SP_CTRL_9600_8N1
SP_CONFIG_COMMAND
        .BYTE   SP_CMD_POLLED
SP_LAST_STATUS
        .BYTE   $00
SP_TX_TEMP
        .BYTE   $00
SP_CRC_LO
        .BYTE   $00
SP_CRC_HI
        .BYTE   $00

; Serial Pro v2.0 slot-ROM CRC16 values for slots 1..7.  These are the same
; slot-specific fingerprints used by the existing RetroAppleJS GPT16 detector.
SP_SERIAL_CRC_LO
        HEX     5B1DDE925117D4
SP_SERIAL_CRC_HI
        HEX     06A103AF0DAA08

; =============================================================================
; DISCOVERY
; =============================================================================

; Find the first Serial Pro v2.0 in slots 1..7.
; OUT: C=0/A=slot, C=1/A=SP_ERR_NOT_FOUND.
SP_FIND
        LDA     #$01
        STA     SP_WORK_SLOT
SP_FIND_LOOP
        LDA     SP_WORK_SLOT
        JSR     SP_PROBE
        BCC     SP_FIND_OK
        INC     SP_WORK_SLOT
        LDA     SP_WORK_SLOT
        CMP     #$08
        BCC     SP_FIND_LOOP
        LDA     #SP_ERR_NOT_FOUND
        SEC
        RTS
SP_FIND_OK
        CLC
        RTS

; Probe one explicit slot by CRC16 of $Cn00-$CnFF.
; IN:  A=1..7
; OUT: C=0/A=slot; C=1/A=SP_ERR_BAD_SLOT or SP_ERR_NOT_FOUND.
SP_PROBE
        CMP     #$01
        BCC     SP_PROBE_BAD_SLOT
        CMP     #$08
        BCS     SP_PROBE_BAD_SLOT
        STA     SP_WORK_SLOT

        JSR     SP_CRC_SLOT_PAGE

        ; Slot-ROM access may have claimed $C800-$CFFF.
        LDA     SP_C8_RELEASE

        LDX     SP_WORK_SLOT
        DEX
        LDA     SP_CRC_LO
        CMP     SP_SERIAL_CRC_LO,X
        BNE     SP_PROBE_NOT_FOUND
        LDA     SP_CRC_HI
        CMP     SP_SERIAL_CRC_HI,X
        BNE     SP_PROBE_NOT_FOUND

        LDA     SP_WORK_SLOT
        CLC
        RTS

SP_PROBE_BAD_SLOT
        LDA     #SP_ERR_BAD_SLOT
        SEC
        RTS

SP_PROBE_NOT_FOUND
        LDA     #SP_ERR_NOT_FOUND
        SEC
        RTS

; Reflected CRC16, init $FFFF, polynomial $A001, over one 256-byte slot page.
SP_CRC_SLOT_PAGE
        LDA     SP_WORK_SLOT
        CLC
        ADC     #$C0
        STA     SP_CRC_ROM_READ+2

        LDA     #$FF
        STA     SP_CRC_LO
        STA     SP_CRC_HI
        LDY     #$00

SP_CRC_BYTE_LOOP
SP_CRC_ROM_READ
        LDA     $C100,Y
        EOR     SP_CRC_LO
        STA     SP_CRC_LO
        LDX     #$08
SP_CRC_BIT_LOOP
        LSR     SP_CRC_HI
        ROR     SP_CRC_LO
        BCC     SP_CRC_NO_XOR
        LDA     SP_CRC_LO
        EOR     #$01
        STA     SP_CRC_LO
        LDA     SP_CRC_HI
        EOR     #$A0
        STA     SP_CRC_HI
SP_CRC_NO_XOR
        DEX
        BNE     SP_CRC_BIT_LOOP
        INY
        BNE     SP_CRC_BYTE_LOOP
        RTS

; =============================================================================
; LIFECYCLE
; =============================================================================

; A=0 autodetect, A=1..7 explicit; X=control, Y=command.
SP_OPEN
        STX     SP_CONFIG_CONTROL
        STY     SP_CONFIG_COMMAND
        CMP     #$00
        BNE     SP_OPEN_EXPLICIT

        JSR     SP_FIND
        BCS     SP_OPEN_FAIL
        JMP     SP_OPEN_HAVE_SLOT

SP_OPEN_EXPLICIT
        JSR     SP_PROBE
        BCS     SP_OPEN_FAIL

SP_OPEN_HAVE_SLOT
        STA     SP_SLOT_ACTIVE
        JSR     SP_PATCH_SLOT
        JSR     SP_BIND_HARDWARE
        JSR     SP_RESET
        BCS     SP_OPEN_RESET_FAIL
        LDA     SP_SLOT_ACTIVE
        CLC
        RTS

SP_OPEN_RESET_FAIL
        PHA
        LDA     #$00
        STA     SP_SLOT_ACTIVE
        PLA
        SEC
SP_OPEN_FAIL
        RTS

; Idempotent close.  If open, deassert the 6551 command register and forget
; the active slot.  A backend failure is returned after state is closed.
SP_CLOSE
        LDA     SP_SLOT_ACTIVE
        BEQ     SP_CLOSE_OK
        LDA     #$00
        JSR     SP_IO_WRITE_COMMAND
        BCC     SP_CLOSE_CLEAR
        STA     SP_TX_TEMP              ; temporary error save
        LDA     #$00
        STA     SP_SLOT_ACTIVE
        LDA     SP_TX_TEMP
        SEC
        RTS
SP_CLOSE_CLEAR
        LDA     #$00
        STA     SP_SLOT_ACTIVE
SP_CLOSE_OK
        LDA     #SP_OK
        CLC
        RTS

; Reset/configure the active 6551 using the values supplied to SP_OPEN.
SP_RESET
        JSR     SP_REQUIRE_OPEN
        BCS     SP_RESET_FAIL

        LDA     #$00
        JSR     SP_IO_WRITE_STATUS
        BCS     SP_RESET_FAIL
        LDA     SP_CONFIG_COMMAND
        JSR     SP_IO_WRITE_COMMAND
        BCS     SP_RESET_FAIL
        LDA     SP_CONFIG_CONTROL
        JSR     SP_IO_WRITE_CONTROL
        BCS     SP_RESET_FAIL
        LDA     #SP_OK
        CLC
SP_RESET_FAIL
        RTS

; =============================================================================
; RAW BYTE STREAM
; =============================================================================

; Nonblocking receive.
; C=0/A=byte.  C=1/A=SP_ERR_AGAIN or a concrete receiver/backend error.
SP_RX_POLL
        JSR     SP_REQUIRE_OPEN
        BCS     SP_RX_POLL_DONE

        JSR     SP_IO_READ_STATUS
        BCS     SP_RX_POLL_DONE
        STA     SP_LAST_STATUS

        AND     #SP_ST_OVERRUN
        BNE     SP_RX_OVERRUN
        LDA     SP_LAST_STATUS
        AND     #SP_ST_FRAMING
        BNE     SP_RX_FRAMING
        LDA     SP_LAST_STATUS
        AND     #SP_ST_PARITY
        BNE     SP_RX_PARITY
        LDA     SP_LAST_STATUS
        AND     #SP_ST_RDRF
        BEQ     SP_RX_AGAIN

        JSR     SP_IO_READ_DATA
        BCS     SP_RX_POLL_DONE
        CLC
SP_RX_POLL_DONE
        RTS

SP_RX_OVERRUN
        LDA     #SP_ERR_OVERRUN
        SEC
        RTS
SP_RX_FRAMING
        LDA     #SP_ERR_FRAMING
        SEC
        RTS
SP_RX_PARITY
        LDA     #SP_ERR_PARITY
        SEC
        RTS
SP_RX_AGAIN
        LDA     #SP_ERR_AGAIN
        SEC
        RTS

; Blocking receive.  Only SP_ERR_AGAIN is retried; real errors return.
SP_RX_BYTE
SP_RX_BYTE_WAIT
        JSR     SP_RX_POLL
        BCC     SP_RX_BYTE_DONE
        CMP     #SP_ERR_AGAIN
        BEQ     SP_RX_BYTE_WAIT
        SEC
SP_RX_BYTE_DONE
        RTS

; C=0 when the transmitter data register is ready.
; C=1/A=SP_ERR_AGAIN when busy, or another backend/open error.
SP_TX_READY
        JSR     SP_REQUIRE_OPEN
        BCS     SP_TX_READY_DONE
        JSR     SP_IO_READ_STATUS
        BCS     SP_TX_READY_DONE
        AND     #SP_ST_TDRE
        BNE     SP_TX_READY_YES
        LDA     #SP_ERR_AGAIN
        SEC
        RTS
SP_TX_READY_YES
        LDA     #SP_OK
        CLC
SP_TX_READY_DONE
        RTS

; Blocking transmit of the exact 8-bit value supplied in A.
SP_TX_BYTE
        STA     SP_TX_TEMP
SP_TX_BYTE_WAIT
        JSR     SP_TX_READY
        BCC     SP_TX_BYTE_GO
        CMP     #SP_ERR_AGAIN
        BEQ     SP_TX_BYTE_WAIT
        SEC
        RTS
SP_TX_BYTE_GO
        LDA     SP_TX_TEMP
        JSR     SP_IO_WRITE_DATA
        BCS     SP_TX_BYTE_FAIL
        LDA     #SP_OK
        CLC
SP_TX_BYTE_FAIL
        RTS

; Drain bytes that are already waiting.  Receiver/backend errors are surfaced;
; SP_ERR_AGAIN means the queue is empty and therefore completes successfully.
SP_RX_FLUSH
SP_RX_FLUSH_LOOP
        JSR     SP_RX_POLL
        BCC     SP_RX_FLUSH_LOOP
        CMP     #SP_ERR_AGAIN
        BNE     SP_RX_FLUSH_FAIL
        LDA     #SP_OK
        CLC
SP_RX_FLUSH_FAIL
        RTS

; Return raw 6551 status in A.
SP_STATUS
        JSR     SP_REQUIRE_OPEN
        BCS     SP_STATUS_DONE
        JSR     SP_IO_READ_STATUS
SP_STATUS_DONE
        RTS

SP_GET_SLOT
        LDA     SP_SLOT_ACTIVE
        BEQ     SP_GET_SLOT_CLOSED
        CLC
        RTS
SP_GET_SLOT_CLOSED
        LDA     #SP_ERR_NOT_OPEN
        SEC
        RTS

SP_REQUIRE_OPEN
        LDA     SP_SLOT_ACTIVE
        BNE     SP_REQUIRE_OPEN_OK
        LDA     #SP_ERR_NOT_OPEN
        SEC
        RTS
SP_REQUIRE_OPEN_OK
        CLC
        RTS

; =============================================================================
; SLOT PATCHING AND LOW-LEVEL BACKEND
; =============================================================================

; slot n device-select base = $C080 + n*$10
; ACIA DATA/STATUS/COMMAND/CONTROL = base+$08..+$0B.
SP_PATCH_SLOT
        LDA     SP_SLOT_ACTIVE
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        CLC
        ADC     #$88
        STA     SP_HW_DATA_RD+1
        STA     SP_HW_DATA_WR+1
        CLC
        ADC     #$01
        STA     SP_HW_STATUS_RD+1
        STA     SP_HW_STATUS_WR+1
        CLC
        ADC     #$01
        STA     SP_HW_COMMAND_WR+1
        CLC
        ADC     #$01
        STA     SP_HW_CONTROL_WR+1
        RTS

; Restore all low-level trampolines to the real hardware implementation.
SP_BIND_HARDWARE
        LDA     #<SP_HW_READ_STATUS
        STA     SP_IO_READ_STATUS_JMP+1
        LDA     #>SP_HW_READ_STATUS
        STA     SP_IO_READ_STATUS_JMP+2
        LDA     #<SP_HW_READ_DATA
        STA     SP_IO_READ_DATA_JMP+1
        LDA     #>SP_HW_READ_DATA
        STA     SP_IO_READ_DATA_JMP+2
        LDA     #<SP_HW_WRITE_DATA
        STA     SP_IO_WRITE_DATA_JMP+1
        LDA     #>SP_HW_WRITE_DATA
        STA     SP_IO_WRITE_DATA_JMP+2
        LDA     #<SP_HW_WRITE_STATUS
        STA     SP_IO_WRITE_STATUS_JMP+1
        LDA     #>SP_HW_WRITE_STATUS
        STA     SP_IO_WRITE_STATUS_JMP+2
        LDA     #<SP_HW_WRITE_COMMAND
        STA     SP_IO_WRITE_COMMAND_JMP+1
        LDA     #>SP_HW_WRITE_COMMAND
        STA     SP_IO_WRITE_COMMAND_JMP+2
        LDA     #<SP_HW_WRITE_CONTROL
        STA     SP_IO_WRITE_CONTROL_JMP+1
        LDA     #>SP_HW_WRITE_CONTROL
        STA     SP_IO_WRITE_CONTROL_JMP+2
        RTS

; Mockable low-level seams.  Contract for each target:
;   read  : C=0/A=value; C=1/A=SP_ERR_*
;   write : IN A=value; C=0 success; C=1/A=SP_ERR_*
SP_IO_READ_STATUS
SP_IO_READ_STATUS_JMP
        JMP     SP_HW_READ_STATUS
SP_IO_READ_DATA
SP_IO_READ_DATA_JMP
        JMP     SP_HW_READ_DATA
SP_IO_WRITE_DATA
SP_IO_WRITE_DATA_JMP
        JMP     SP_HW_WRITE_DATA
SP_IO_WRITE_STATUS
SP_IO_WRITE_STATUS_JMP
        JMP     SP_HW_WRITE_STATUS
SP_IO_WRITE_COMMAND
SP_IO_WRITE_COMMAND_JMP
        JMP     SP_HW_WRITE_COMMAND
SP_IO_WRITE_CONTROL
SP_IO_WRITE_CONTROL_JMP
        JMP     SP_HW_WRITE_CONTROL

; ---- dynamically patched 6551 accessors ------------------------------------

SP_HW_READ_STATUS
SP_HW_STATUS_RD
        LDA     $C0A9
        CLC
        RTS
SP_HW_READ_DATA
SP_HW_DATA_RD
        LDA     $C0A8
        CLC
        RTS
SP_HW_WRITE_DATA
SP_HW_DATA_WR
        STA     $C0A8
        CLC
        RTS
SP_HW_WRITE_STATUS
SP_HW_STATUS_WR
        STA     $C0A9
        CLC
        RTS
SP_HW_WRITE_COMMAND
SP_HW_COMMAND_WR
        STA     $C0AA
        CLC
        RTS
SP_HW_WRITE_CONTROL
SP_HW_CONTROL_WR
        STA     $C0AB
        CLC
        RTS
