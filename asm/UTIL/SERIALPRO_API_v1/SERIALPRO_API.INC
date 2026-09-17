; =============================================================================
; SERIALPRO_API.INC
; Reusable Applied Engineering Serial Pro / 6551 byte-stream API
; RetroAppleJS ASM_core.js / NMOS 6502
; =============================================================================
;
; Public return convention
; ------------------------
;   C=0 : success
;   C=1 : failure / no data; A contains SP_ERR_*
;
; RX/TX is byte transparent.  The driver never changes bit 7, translates CR/LF,
; applies Apple text conventions, or performs protocol quoting.
;
; SP_OPEN calling convention
; --------------------------
;   A = slot (0 = autodetect, 1..7 = explicit)
;   X = 6551 control register value
;   Y = 6551 command register value
;   C=0/A=actual slot on success
;   C=1/A=SP_ERR_* on failure
;
; API jump table
; --------------
;   If SERIALPRO.S is included/linked, SP_API names the first JMP entry.
;   Call a fixed entry as: JSR SP_API+SP_API_TX_BYTE_OFF
; =============================================================================

SP_API_MAJOR             EQU     $01
SP_API_MINOR             EQU     $00

SP_API_FIND_OFF          EQU     $00
SP_API_PROBE_OFF         EQU     $03
SP_API_OPEN_OFF          EQU     $06
SP_API_CLOSE_OFF         EQU     $09
SP_API_RX_POLL_OFF       EQU     $0C
SP_API_RX_BYTE_OFF       EQU     $0F
SP_API_TX_READY_OFF      EQU     $12
SP_API_TX_BYTE_OFF       EQU     $15
SP_API_RX_FLUSH_OFF      EQU     $18
SP_API_STATUS_OFF        EQU     $1B
SP_API_GET_SLOT_OFF      EQU     $1E
SP_API_RESET_OFF         EQU     $21
SP_API_SIZE              EQU     $24

; Public error codes.
SP_OK                    EQU     $00
SP_ERR_AGAIN             EQU     $01     ; nonblocking operation not ready
SP_ERR_NOT_FOUND         EQU     $02
SP_ERR_BAD_SLOT          EQU     $03
SP_ERR_NOT_OPEN          EQU     $04
SP_ERR_OVERRUN           EQU     $05
SP_ERR_FRAMING           EQU     $06
SP_ERR_PARITY            EQU     $07
SP_ERR_TX                EQU     $08
SP_ERR_CONFIG            EQU     $09
SP_ERR_IO                EQU     $0A     ; generic backend/read failure

; 6551 status register bits.
SP_ST_PARITY             EQU     $01
SP_ST_FRAMING            EQU     $02
SP_ST_OVERRUN            EQU     $04
SP_ST_RDRF               EQU     $08
SP_ST_TDRE               EQU     $10
SP_ST_DCD                EQU     $20
SP_ST_DSR                EQU     $40
SP_ST_IRQ                EQU     $80

; Profile already used by the RetroAppleJS GPT16 Serial Pro transport.
; 9600 baud, 8 data bits, 1 stop bit; polled command profile.
SP_CTRL_9600_8N1         EQU     $1E
SP_CMD_POLLED            EQU     $0B
