; =============================================================================
; GPT16_V6_11_CHAT.S
; =============================================================================
; CHAT overlay extracted from last-running V6.09 diagnostic build.
; Load at $6000. Requires resident GPT16_V6_10_KERNEL.S and initialized
; shared RAM/state/DOS workspaces at the fixed addresses below.
; =============================================================================

; =============================================================================
; MONITOR / APPLE II
; =============================================================================

KBD             EQU     $C000
KBDSTRB         EQU     $C010
SHIFT_WIRE      EQU     $C063
C8_RELEASE      EQU     $CFFF

M_COUT          EQU     $FDED
M_RDKEY         EQU     $FD0C

; Temporary zero-page pointer used only by startup diagnostics.
MSG_ZPL         EQU     $F0
MSG_ZPH         EQU     $F1
FM_ZPL          EQU     $F2
FM_ZPH          EQU     $F3

APPLE_CH        EQU     $24
APPLE_CV        EQU     $25

KEY_BS          EQU     $08
KEY_LEFT        EQU     $08             ; Apple II left-arrow / CTRL-H
KEY_CR          EQU     $0D
KEY_ESC         EQU     $1B
KEY_RIGHT       EQU     $15             ; Apple II right-arrow / CTRL-U
KEY_DEL         EQU     $7F


; =============================================================================
; APPLESOFT AMPERSAND INTERFACE
; =============================================================================

APPLESOFT_AMP   EQU     $03F5           ; three-byte JMP vector used by &
AS_CHRGET       EQU     $00B1
AS_CHRGOT       EQU     $00B7
AS_TXTPTR_LO    EQU     $B8
AS_TXTPTR_HI    EQU     $B9
AS_TOKEN_NAMES  EQU     $D0D0           ; high-bit-terminated token names

; =============================================================================
; DOS 3.3 FILE MANAGER
; =============================================================================

DOS_WARM        EQU     $03D0
DOS_FM          EQU     $03D6
DOS_LOC_FPL     EQU     $03DC

FM_OPEN         EQU     $01
FM_CLOSE        EQU     $02
FM_READ         EQU     $03
FM_WRITE        EQU     $04
FM_DELETE       EQU     $05
FM_POSITION     EQU     $0A
FM_ONE_BYTE     EQU     $01
FM_END_DATA     EQU     $05
FM_FILE_NOT_FOUND EQU   $06

DOS_TEXT_TYPE   EQU     $00
MAX_FILENAME    EQU     $1E             ; 30
LOAD_LIMIT_HI   EQU     $0D             ; $0DAC = 3500 UTF-16 units
LOAD_LIMIT_LO   EQU     $AC
AUTO_LOAD_MAX   EQU     $04
A2_CAPTURE_MAX  EQU     $40             ; 64-byte candidate control line

FILE_TARGET_AUX EQU     $00
FILE_TARGET_SAVE EQU    $01
FILE_ENCODING_DOS EQU   $00             ; high-bit 7-bit DOS text
FILE_ENCODING_HISTORY EQU $01             ; DOS-safe escaped UTF-16
LOAD_ENCODING_DOS EQU   $00
LOAD_ENCODING_HISTORY EQU $01

; =============================================================================
; SERIAL PRO / 6551
; =============================================================================

SP_RDRF         EQU     $08
SP_TDRE         EQU     $10

SP_COMMAND_INIT EQU     $0B
SP_CONTROL_INIT EQU     $1E

; GPT16 transport-neutral control-plane handshake (G16/1).
G16_SOH         EQU     $01
G16_ETX         EQU     $03
G16_FRAME_MAX   EQU     $C0             ; 192 bytes between SOH/ETX
G16_ATTEMPTS    EQU     $04             ; original + three retries
G16_READY_WINDOWS EQU   $06             ; ~15 s with current software timeout
G16_WAIT_BUDGET EQU     $0C             ; bounded WAIT extension

G16_TYPE_UNKNOWN EQU    $00
G16_TYPE_ACK     EQU     $01
G16_TYPE_WAIT    EQU     $02
G16_TYPE_READY   EQU     $03
G16_TYPE_NAK     EQU     $04
G16_TYPE_FAIL    EQU     $05

; Local diagnostics. Gateway FAIL/NAK frames remain protocol-level outcomes;
; these byte codes only explain why this client refused to enter data mode.
G16_ERR_NONE     EQU     $00
G16_ERR_TIMEOUT  EQU     $01
G16_ERR_FRAME    EQU     $02
G16_ERR_NAK      EQU     $03
G16_ERR_REMOTE   EQU     $04
G16_ERR_READY_TO EQU     $05
G16_ERR_PROFILE  EQU     $06
G16_ERR_UNEXPECTED EQU   $07

G16_VG1_REQUEST EQU     $7F
G16_DG_FORBID   EQU     $F3             ; all bits except VG1=$04 / GRID=$08

; =============================================================================
; VIDEOTERM
; =============================================================================

VIDEX_RAM0      EQU     $CC00
VIDEX_RAM1      EQU     $CD00

SCREEN_COLS     EQU     $50             ; 80
SCREEN_ROWS     EQU     $18             ; 24
USER_PROMPT_CHAR EQU     $5B             ; '[' distinct from Applesoft direct-mode ]
VRAM_MASK_HI    EQU     $07             ; $0000-$07FF

CRTC_START_HI   EQU     $0C
CRTC_START_LO   EQU     $0D
CRTC_CURSOR_HI  EQU     $0E
CRTC_CURSOR_LO  EQU     $0F

SPACE_GLYPH     EQU     $20

; =============================================================================
; TABLE SIZES
; =============================================================================

BMP_COUNT       EQU     $10
SUP_COUNT       EQU     $07

; =============================================================================
; ENTRY

; Resident kernel ABI addresses
KAPI_BOOT                          EQU     $4000
KAPI_DETECT_CARDS                  EQU     $4003
KAPI_PATCH_SERIAL_SLOT             EQU     $4006
KAPI_ENGAGE_VIDEX                  EQU     $4009
KAPI_G16_NEGOTIATE                 EQU     $400C
KAPI_G16_SHOW_ERROR                EQU     $400F
KAPI_SERIAL_INIT                   EQU     $4012
KAPI_SERIAL_TX_BYTE                EQU     $4015
KAPI_SEND_UTF16_ASCII              EQU     $4018
KAPI_SERIAL_RX_BLOCK               EQU     $401B
KAPI_SERIAL_RX_NEXT                EQU     $401E
KAPI_GET_KEY                       EQU     $4021
KAPI_GET_KEY_WAIT                  EQU     $4024
KAPI_SCREEN_INIT                   EQU     $4027
KAPI_WRITE_GLYPH                   EQU     $402A
KAPI_NEWLINE                       EQU     $402D
KAPI_SCREEN_BACKSPACE              EQU     $4030
KAPI_SET_HW_CURSOR                 EQU     $4033
KAPI_WRITE_CELL_TEMP_RAW           EQU     $4036
KAPI_READ_CELL_TEMP_RAW            EQU     $4039
KAPI_INC_TEMP_ADDR                 EQU     $403C
KAPI_VIDEX_CRTC_WRITE              EQU     $403F
KAPI_IMPORT_VIDEX_FIRMWARE         EQU     $4042
KAPI_PRINT_SCREEN_STRING           EQU     $4045
KAPI_PRINT_HEX_BYTE                EQU     $4048
KAPI_DOS_INIT                      EQU     $404B
KAPI_FM_CREATE_AUX                 EQU     $404E
KAPI_FM_CREATE_SAVE                EQU     $4051
KAPI_FM_OPEN_AUX_EXIST             EQU     $4054
KAPI_FM_OPEN_SAVE_EXIST            EQU     $4057
KAPI_FM_CLOSE_AUX                  EQU     $405A
KAPI_FM_CLOSE_SAVE                 EQU     $405D
KAPI_FM_POSITION_SAVE              EQU     $4060
KAPI_FM_READ_AUX                   EQU     $4063
KAPI_FM_WRITE_RAW                  EQU     $4066
KAPI_FM_WRITE_SAVE_RAW             EQU     $4069
KAPI_FM_EOF_CLOSE_AUX              EQU     $406C
KAPI_FM_EOF_CLOSE_SAVE             EQU     $406F
KAPI_FILE_ENCODE_ASCII_A           EQU     $4072
KAPI_FILE_ENCODE_CP                EQU     $4075
KAPI_FILE_ENCODE_SURROGATE         EQU     $4078

; Fixed shared-memory addresses
INPUT_BUF                          EQU     $8400
AUX_LINE_BUF                       EQU     $8400
A2_BUF                             EQU     $8400
GPT_CTRL_NAME                      EQU     $8440
GPT_FILE_NAME                      EQU     $845E
PENDING_NAME                       EQU     $847C
G16_FRAME_BUF                      EQU     $8400
PAGE_SCRATCH                       EQU     $8600
MENU_ROW_SAVE                      EQU     $882D
NAME_INPUT                         EQU     $887D
SP_SLOT                            EQU     $8C00
VT_SLOT                            EQU     $8C01
SP_COUNT                           EQU     $8C02
VT_COUNT                           EQU     $8C03
SCAN_SLOT                          EQU     $8C04
CRC_LO                             EQU     $8C05
CRC_HI                             EQU     $8C06
SAVE_ZP_LO                         EQU     $8C07
SAVE_ZP_HI                         EQU     $8C08
INPUT_COUNT_LO                     EQU     $8C09
INPUT_COUNT_HI                     EQU     $8C0A
LAST_CR                            EQU     $8C0B
START_HINT_ACTIVE                  EQU     $8C0C
AMP_HINT_ACTIVE                    EQU     $8C0D
KEY_TEMP                           EQU     $8C0E
TX_TEMP                            EQU     $8C0F
SHIFT_TEMP                         EQU     $8C10
CP_LO                              EQU     $8C11
CP_HI                              EQU     $8C12
HS_LO                              EQU     $8C13
HS_HI                              EQU     $8C14
LS_LO                              EQU     $8C15
LS_HI                              EQU     $8C16
BANK_TEMP                          EQU     $8C17
DELTA_TEMP                         EQU     $8C18
SYNC_TEMP                          EQU     $8C19
VSTART_LO                          EQU     $8C1A
VSTART_HI                          EQU     $8C1B
CURSOR_LO                          EQU     $8C1C
CURSOR_HI                          EQU     $8C1D
TMP_LO                             EQU     $8C1E
TMP_HI                             EQU     $8C1F
COLUMN                             EQU     $8C20
ROW                                EQU     $8C21
SAVE_FM_ZP_LO                      EQU     $8C22
SAVE_FM_ZP_HI                      EQU     $8C23
DOS_AVAILABLE                      EQU     $8C24
DOS_VOLUME                         EQU     $8C25
DOS_DRIVE                          EQU     $8C26
DOS_SLOT                           EQU     $8C27
DOS_LAST_RC                        EQU     $8C28
SAVE_ACTIVE                        EQU     $8C29
SAVE_CONFIGURED                    EQU     $8C2A
SAVE_NAME_LEN                      EQU     $8C2B
AUX_OPEN                           EQU     $8C2C
GPT_FILE_ACTIVE                    EQU     $8C2D
GPT_FILE_NAME_LEN                  EQU     $8C2E
G16_NEGOTIATED                     EQU     $8C2F
GPT_BRIEFED                        EQU     $8C30
RX_SILENT                          EQU     $8C31
G16_ERROR                          EQU     $8C32
G16_RETRIES_LEFT                   EQU     $8C33
G16_READY_LEFT                     EQU     $8C34
G16_WAIT_LEFT                      EQU     $8C35
G16_TIMEOUT_PASS                   EQU     $8C36
G16_FRAME_LEN                      EQU     $8C37
G16_BODY_LEN                       EQU     $8C38
G16_PARSE_INDEX                    EQU     $8C39
G16_RX_TEMP                        EQU     $8C3A
G16_CRC_LO                         EQU     $8C3B
G16_CRC_HI                         EQU     $8C3C
G16_RXCRC_LO                       EQU     $8C3D
G16_RXCRC_HI                       EQU     $8C3E
G16_NUM_TEMP                       EQU     $8C3F
G16_DEC_TEMP                       EQU     $8C40
G16_EFFECTIVE_VG1                  EQU     $8C41
G16_EFFECTIVE_COLS                 EQU     $8C42
G16_EFFECTIVE_ROWS                 EQU     $8C43
G16_DG                             EQU     $8C44
FILE_TARGET                        EQU     $8C45
FILE_ENCODING                      EQU     $8C46
ENC_LAST_CR                        EQU     $8C47
LOAD_ENCODING                      EQU     $8C49
LOAD_PREFETCH_COUNT                EQU     $8C4A
LOAD_PREFETCH_INDEX                EQU     $8C4B
LOAD_PREFETCH                      EQU     $8C4C
LOAD_LAST_CR                       EQU     $8C4F
ESC_DIGITS                         EQU     $8C50
HEX_TEMP                           EQU     $8C51
PAGE_CUR_LO                        EQU     $8C52
PAGE_CUR_HI                        EQU     $8C53
PAGE_LAST_LO                       EQU     $8C54
PAGE_LAST_HI                       EQU     $8C55
PAGE_TARGET_LO                     EQU     $8C56
PAGE_TARGET_HI                     EQU     $8C57
PAGE_SCAN_ROW                      EQU     $8C58
PAGE_SCAN_COL                      EQU     $8C59
PAGE_LAST_CR                       EQU     $8C5A
PAGE_EVENT                         EQU     $8C5B
AUTO_ACTION_BUDGET                 EQU     $8C5C
PENDING_LOAD                       EQU     $8C5D
PENDING_NAME_LEN                   EQU     $8C5E
GPT_CTRL_STATE                     EQU     $8C5F
GPT_CTRL_COMMAND_CODE              EQU     $8C60
GPT_CTRL_NAME_LEN                  EQU     $8C61
A2_CAPTURE                         EQU     $8C62
A2_LEN                             EQU     $8C63
A2_BODY_END                        EQU     $8C64
A2_PENDING_LO                      EQU     $8C65
A2_PENDING_HI                      EQU     $8C66
AMP_INSTALLED                      EQU     $8C67
AMP_ENTRY_P                        EQU     $8C68
AMP_ENTRY_A                        EQU     $8C69
AMP_ENTRY_X                        EQU     $8C6A
AMP_ENTRY_Y                        EQU     $8C6B
AMP_SAVE_ZP_LO                     EQU     $8C6C
AMP_SAVE_ZP_HI                     EQU     $8C6D
AMP_SAVE_FM_LO                     EQU     $8C6E
AMP_SAVE_FM_HI                     EQU     $8C6F
AMP_SCAN_INDEX                     EQU     $8C70
AMP_TOKEN_INDEX                    EQU     $8C71
AMP_TOKEN_BYTE                     EQU     $8C72
AMP_RX_MODE                        EQU     $8C73
AMP_PENDING_CR                     EQU     $8C74
AMP_OLD_VECTOR                     EQU     $8C75
NAME_DEFAULT                       EQU     $8C78
NAME_LEN                           EQU     $8C79
OVERLAY_PREFIX_LEN                 EQU     $8C7A
LABEL_PTR_LO                       EQU     $8C7B
LABEL_PTR_HI                       EQU     $8C7C
MENU_ROW_LO                        EQU     $8C7D
MENU_ROW_HI                        EQU     $8C7E
LOOP_INDEX                         EQU     $8C7F
INPUT_INDEX_LO                     EQU     $8C80
INPUT_INDEX_HI                     EQU     $8C81
SAVE_POS_LO                        EQU     $8C82
SAVE_POS_HI                        EQU     $8C83
AUX_LINE_LEN                       EQU     $8C84
LOAD_COUNT_LO                      EQU     $8C85
LOAD_COUNT_HI                      EQU     $8C86
FILE_CHAR                          EQU     $8C87
AUX_WORK                           EQU     $9000
AUX_TS                             EQU     $902D
AUX_DATA                           EQU     $912D
SAVE_NAME                          EQU     $922D
AUX_NAME                           EQU     $924B
SAVE_WORK                          EQU     $9269
SAVE_TS                            EQU     $9296
SAVE_DATA                          EQU     $9396

; =============================================================================
; OVERLAY ABI -- every overlay loaded at $6000 begins with these entry vectors
; =============================================================================

        ORG     $6000

OVL_INIT
        JMP     START
OVL_RUN
        JMP     MAIN_INPUT
OVL_RX_SOH
        JMP     CHAT_OVL_UNSUPPORTED
OVL_RESUME
        JMP     MAIN_INPUT
OVL_SHUTDOWN
        JMP     CHAT_OVL_RETURN
OVL_EVENT
        JMP     CHAT_OVL_RETURN

CHAT_OVL_UNSUPPORTED
        SEC
        RTS

CHAT_OVL_RETURN
        RTS

; Fixed signature in reserved overlay-ABI padding.
CHAT_OVL_MAGIC
        HEX     473136430101            ; "G16C", overlay ABI 1.1

        .ASSERT * <= $6040, error, "Overlay ABI exceeds reserved $6000-$603F"
        .RES    $6040-*

; =============================================================================
; CHAT OVERLAY IMPLEMENTATION
; =============================================================================


START
        CLD

        ; Preserve the four zero-page bytes borrowed by the application's
        ; string printer and DOS File Manager parameter-list pointer.
        LDA     MSG_ZPL
        STA     SAVE_ZP_LO
        LDA     MSG_ZPH
        STA     SAVE_ZP_HI
        LDA     FM_ZPL
        STA     SAVE_FM_ZP_LO
        LDA     FM_ZPH
        STA     SAVE_FM_ZP_HI

        JSR     KAPI_DETECT_CARDS
        BCS     START_CARDS_OK
        JMP     START_ABORT
START_CARDS_OK

        JSR     KAPI_PATCH_SERIAL_SLOT
        JSR     KAPI_ENGAGE_VIDEX

        JSR     KAPI_SERIAL_INIT
        JSR     KAPI_DOS_INIT
        JSR     KAPI_SCREEN_INIT
        JSR     PRINT_CHATGPT_LOGO

        ; G16/1 negotiation is performed once per loaded binary.  The handshake
        ; uses INPUT_BUF as temporary receive storage, so it must complete before
        ; the user editor or A2 response parser can own that arena.
        LDA     G16_NEGOTIATED
        BNE     START_G16_DONE
        JSR     KAPI_G16_NEGOTIATE
        BCC     START_G16_OK
        JSR     KAPI_G16_SHOW_ERROR
        JMP     START_ABORT
START_G16_OK
        LDA     #$01
        STA     G16_NEGOTIATED
START_G16_DONE

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI
        STA     LAST_CR
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        STA     SAVE_NAME_LEN
        STA     SAVE_POS_LO
        STA     SAVE_POS_HI
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
        STA     GPT_FILE_NAME_LEN
        STA     GPT_CTRL_STATE
        STA     PENDING_LOAD
        STA     RX_SILENT
        STA     FILE_TARGET
        STA     FILE_ENCODING
        STA     ENC_LAST_CR
        STA     ENC_LAST_CR+1
        STA     LOAD_ENCODING
        STA     LOAD_PREFETCH_COUNT
        STA     LOAD_PREFETCH_INDEX
        STA     LOAD_LAST_CR
        STA     ESC_DIGITS
        STA     HEX_TEMP
        STA     A2_CAPTURE
        STA     A2_LEN
        STA     A2_BODY_END
        STA     A2_PENDING_LO
        STA     A2_PENDING_HI
        STA     START_HINT_ACTIVE
        STA     AMP_HINT_ACTIVE
        STA     AMP_RX_MODE
        STA     AMP_PENDING_CR

        ; The GPT application/file-policy briefing belongs to the lifetime of
        ; the loaded binary, not to every CALL. GPT_BRIEFED is deliberately
        ; absent from the START state-clear block above.
        LDA     GPT_BRIEFED
        BNE     START_GPT_BRIEF_DONE

        ; Send the briefing as a normal GPT16 request, but suppress its
        ; acknowledgement from the VideoTerm display.
        JSR     SEND_GPT_BRIEFING
        LDA     #$01
        STA     RX_SILENT
        JSR     RECEIVE_GPT16
        LDA     #$00
        STA     RX_SILENT
        LDA     #$01
        STA     GPT_BRIEFED

START_GPT_BRIEF_DONE
        JSR     PRINT_START_PROMPT

MAIN_INPUT
        JSR     KAPI_GET_KEY
        PHA
        JSR     CLEAR_START_HINT
        JSR     CLEAR_AMP_HINT
        PLA

PROCESS_KEY
        CMP     #KEY_ESC
        BNE     PROCESS_NOT_ESC
        JMP     MENU_ENTER

PROCESS_NOT_ESC
        CMP     #KEY_CR
        BNE     PROCESS_NOT_CR
        JMP     SUBMIT_LINE

PROCESS_NOT_CR
        CMP     #KEY_BS
        BEQ     EDIT_BACKSPACE

        CMP     #KEY_DEL
        BEQ     EDIT_BACKSPACE

        CMP     #$20
        BCC     MAIN_INPUT

        CMP     #$7F
        BCS     MAIN_INPUT

        STA     KEY_TEMP

        ; 16-bit count: $0200 means the 512-character buffer is full.
        LDA     INPUT_COUNT_HI
        CMP     #$02
        BCS     MAIN_INPUT

        LDX     INPUT_COUNT_LO
        LDA     INPUT_COUNT_HI
        BEQ     INPUT_STORE_PAGE0

        LDA     KEY_TEMP
        STA     INPUT_BUF+$100,X
        JMP     INPUT_STORE_ADVANCE

INPUT_STORE_PAGE0
        LDA     KEY_TEMP
        STA     INPUT_BUF,X

INPUT_STORE_ADVANCE
        INC     INPUT_COUNT_LO
        BNE     INPUT_STORE_ECHO
        INC     INPUT_COUNT_HI

INPUT_STORE_ECHO
        LDA     KEY_TEMP
        JSR     KAPI_WRITE_GLYPH
        JMP     MAIN_INPUT

START_ABORT
        JSR     RESTORE_APP_ZP
        RTS

RESTORE_APP_ZP
        LDA     SAVE_ZP_LO
        STA     MSG_ZPL
        LDA     SAVE_ZP_HI
        STA     MSG_ZPH
        LDA     SAVE_FM_ZP_LO
        STA     FM_ZPL
        LDA     SAVE_FM_ZP_HI
        STA     FM_ZPH
        RTS

; -----------------------------------------------------------------------------
; Backspace edits only the local, not-yet-submitted request buffer.
; -----------------------------------------------------------------------------

EDIT_BACKSPACE
        LDA     INPUT_COUNT_LO
        ORA     INPUT_COUNT_HI
        BEQ     MAIN_INPUT

        LDA     INPUT_COUNT_LO
        BNE     EDIT_BACKSPACE_LOW
        DEC     INPUT_COUNT_HI
        LDA     #$FF
        STA     INPUT_COUNT_LO
        JMP     EDIT_BACKSPACE_SCREEN

EDIT_BACKSPACE_LOW
        DEC     INPUT_COUNT_LO

EDIT_BACKSPACE_SCREEN
        JSR     KAPI_SCREEN_BACKSPACE
        JMP     MAIN_INPUT

; -----------------------------------------------------------------------------
; Submit one locally buffered request.
; -----------------------------------------------------------------------------

SUBMIT_LINE
        LDA     INPUT_COUNT_LO
        ORA     INPUT_COUNT_HI
        BNE     SUBMIT_NONEMPTY

        JSR     KAPI_NEWLINE
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

SUBMIT_NONEMPTY
        LDX     #<TXT_DIAG_T1
        LDY     #>TXT_DIAG_T1
        JSR     DIAG_MARK

        ; SAVE_CONFIGURED is the persistent policy; SAVE_ACTIVE is only the
        ; current DOS handle. NAVIGATE and completed turns deliberately leave
        ; the writer closed, so every new turn must reopen/position it first.
        JSR     HISTORY_OPEN_CONFIGURED

        ; Submit first so GPT can work while DOS commits the previous reply and
        ; this request.
        LDX     #<TXT_DIAG_T2
        LDY     #>TXT_DIAG_T2
        JSR     DIAG_MARK

        JSR     SEND_INPUT_BUFFER

        LDX     #<TXT_DIAG_T3
        LDY     #>TXT_DIAG_T3
        JSR     DIAG_MARK

        JSR     HISTORY_WRITE_USER_BUFFER
        JSR     HISTORY_COMMIT_REOPEN

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI

        JSR     KAPI_NEWLINE

        LDA     #AUTO_LOAD_MAX
        STA     AUTO_ACTION_BUDGET

        LDX     #<TXT_DIAG_T4
        LDY     #>TXT_DIAG_T4
        JSR     DIAG_MARK

        JSR     RECEIVE_GPT16
        JSR     HANDLE_PENDING_LOADS

        ; Flush the completed assistant reply and leave no DOS history file open
        ; while the user is idle. SAVE_POS remains on the payload EOF and the
        ; next SUBMIT_NONEMPTY reopens there.
        JSR     HISTORY_CLOSE_PRESERVE

        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

; Reset/read iterator shared by serial submit, history commit and input redraw.
INPUT_ITER_RESET
        LDA     #$00
        STA     INPUT_INDEX_LO
        STA     INPUT_INDEX_HI
        RTS

; C=1/A=next buffered ASCII character; C=0 at INPUT_COUNT.
INPUT_NEXT_CHAR
        LDA     INPUT_INDEX_HI
        CMP     INPUT_COUNT_HI
        BNE     INPUT_NEXT_HAVE
        LDA     INPUT_INDEX_LO
        CMP     INPUT_COUNT_LO
        BEQ     INPUT_NEXT_END
INPUT_NEXT_HAVE
        LDX     INPUT_INDEX_LO
        LDA     INPUT_INDEX_HI
        BEQ     INPUT_NEXT_PAGE0
        LDA     INPUT_BUF+$100,X
        JMP     INPUT_NEXT_GOT
INPUT_NEXT_PAGE0
        LDA     INPUT_BUF,X
INPUT_NEXT_GOT
        PHA
        INC     INPUT_INDEX_LO
        BNE     INPUT_NEXT_NO_CARRY
        INC     INPUT_INDEX_HI
INPUT_NEXT_NO_CARRY
        PLA
        SEC
        RTS
INPUT_NEXT_END
        CLC
        RTS

SEND_INPUT_BUFFER
        ; Reinforce the file-transfer contract on each request. GPT_BRIEFING may
        ; be many turns back in the remote context; this prefix prevents a request
        ; such as "write HELLO.CMD" from becoming ordinary reply text with no
        ; [[A2:C]] create control. It is wire-only, not local chat-history text.
        LDX     #<GPT_TURN_FILE_RULE
        LDY     #>GPT_TURN_FILE_RULE
        JSR     SEND_Z_UTF16

        JSR     INPUT_ITER_RESET
SEND_INPUT_LOOP
        JSR     INPUT_NEXT_CHAR
        BCC     SEND_INPUT_END
        JSR     KAPI_SEND_UTF16_ASCII
        JMP     SEND_INPUT_LOOP
SEND_INPUT_END
        LDA     #KEY_CR
        JSR     KAPI_SEND_UTF16_ASCII
        RTS

; =============================================================================
; ESC MENU / FILE UI
; =============================================================================

MENU_ENTER
        JSR     MENU_SAVE_ROW
        JSR     MENU_DRAW

MENU_WAIT
        JSR     KAPI_GET_KEY_WAIT
        JSR     ASCII_TO_UPPER

        CMP     #KEY_ESC
        BEQ     MENU_CANCEL
        CMP     #'N'
        BNE     MENU_NOT_N
        JMP     MENU_NAVIGATE
MENU_NOT_N
        CMP     #'&'
        BNE     MENU_NOT_AMP
        JMP     MENU_AMP
MENU_NOT_AMP
        CMP     #'H'
        BNE     MENU_NOT_H
        JMP     MENU_HISTORY
MENU_NOT_H
        CMP     #'C'
        BNE     MENU_NOT_C
        JMP     MENU_CMD
MENU_NOT_C
        CMP     #'Q'
        BNE     MENU_WAIT
        JMP     MENU_QUIT

MENU_CANCEL
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR
        JMP     MAIN_INPUT

; [N]AVIGATE pages through chat history in a fixed 23-row viewport.
; If history recording/configuration is currently off, first ask for an existing
; history filename and attach it at its current EOF so chat recording can continue
; safely after navigation returns.
MENU_NAVIGATE
        LDA     SAVE_CONFIGURED
        BNE     MENU_NAV_HAVE_HISTORY

        LDX     #<TXT_NAV_FILE
        LDY     #>TXT_NAV_FILE
        LDA     #$00
        STA     NAME_DEFAULT
        JSR     MENU_FILENAME_INPUT
        BCS     MENU_NAV_NAME_OK
        JMP     MENU_REDRAW

MENU_NAV_NAME_OK
        JSR     COPY_INPUT_TO_SAVE_NAME

        ; Remove the transient menu before attaching/scanning the selected history.
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR
        JSR     HISTORY_ATTACH_EXISTING
        BCC     MENU_NAV_READY
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

MENU_NAV_HAVE_HISTORY
        ; Remove the transient menu before switching into the history viewport.
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR

MENU_NAV_READY
        ; Commit a real DOS EOF before the history file is opened for reading.
        ; SAVE_POS remains on the byte that will overwrite this EOF later.
        JSR     HISTORY_CLOSE_PRESERVE
        BCC     MENU_NAV_CLOSE_OK
        JMP     PAGE_MODE_ABORT
MENU_NAV_CLOSE_OK

        JSR     PAGE_FIND_LAST
        BCC     MENU_NAV_FIND_OK
        JMP     PAGE_MODE_ABORT
MENU_NAV_FIND_OK

        LDA     PAGE_LAST_LO
        STA     PAGE_TARGET_LO
        LDA     PAGE_LAST_HI
        STA     PAGE_TARGET_HI
        JSR     PAGE_RENDER_TARGET
        BCS     PAGE_MODE_ABORT

PAGE_MODE_LOOP
        JSR     KAPI_GET_KEY_WAIT
        JSR     ASCII_TO_UPPER
        CMP     #KEY_ESC
        BNE     PAGE_MODE_NOT_EXIT
        JMP     PAGE_MODE_EXIT
PAGE_MODE_NOT_EXIT
        CMP     #KEY_LEFT
        BEQ     PAGE_MODE_UP
        CMP     #KEY_RIGHT
        BEQ     PAGE_MODE_DOWN
        CMP     #'W'
        BEQ     PAGE_MODE_WIPE
        JMP     PAGE_MODE_LOOP

PAGE_MODE_UP
        LDA     PAGE_TARGET_LO
        ORA     PAGE_TARGET_HI
        BEQ     PAGE_MODE_LOOP
        LDA     PAGE_TARGET_LO
        BNE     PAGE_MODE_UP_DEC_LO
        DEC     PAGE_TARGET_HI
PAGE_MODE_UP_DEC_LO
        DEC     PAGE_TARGET_LO
        JSR     PAGE_RENDER_TARGET
        BCS     PAGE_MODE_ABORT
        JMP     PAGE_MODE_LOOP

PAGE_MODE_DOWN
        LDA     PAGE_TARGET_HI
        CMP     PAGE_LAST_HI
        BNE     PAGE_MODE_DOWN_COMPARE_HI
        LDA     PAGE_TARGET_LO
        CMP     PAGE_LAST_LO
        BEQ     PAGE_MODE_LOOP
        JMP     PAGE_MODE_DOWN_INC
PAGE_MODE_DOWN_COMPARE_HI
        BCS     PAGE_MODE_LOOP
PAGE_MODE_DOWN_INC
        INC     PAGE_TARGET_LO
        BNE     PAGE_MODE_DOWN_RENDER
        INC     PAGE_TARGET_HI
PAGE_MODE_DOWN_RENDER
        JSR     PAGE_RENDER_TARGET
        BCS     PAGE_MODE_ABORT
        JMP     PAGE_MODE_LOOP

; W deliberately recreates the configured history in place, then leaves the
; navigator on its now-empty first page. SAVE is immediately closed again so the
; same history file can be reopened independently for AUX navigation reads.
PAGE_MODE_WIPE
        JSR     SAVE_REOPEN_NEW
        BCS     PAGE_MODE_ABORT
        JSR     HISTORY_CLOSE_PRESERVE
        BCS     PAGE_MODE_ABORT
        JSR     PAGE_FIND_LAST
        BCS     PAGE_MODE_ABORT
        LDA     PAGE_LAST_LO
        STA     PAGE_TARGET_LO
        LDA     PAGE_LAST_HI
        STA     PAGE_TARGET_HI
        JSR     PAGE_RENDER_TARGET
        BCS     PAGE_MODE_ABORT
        JMP     PAGE_MODE_LOOP

PAGE_MODE_ABORT
        ; A navigation I/O failure cannot reliably reconstruct the history tail.
        ; Return to a clean chat screen and preserve any unsent local input.
        ; History stays configured but closed; the next submitted turn performs
        ; the writer reopen/position itself.
        JSR     KAPI_SCREEN_INIT
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

PAGE_MODE_EXIT
        ; Returning to chat means returning to the newest history, not to the
        ; screen that happened to be visible before [N].  This is essential when
        ; [N] has just attached an existing CHAT HISTORY FILE.
        LDA     PAGE_LAST_LO
        STA     PAGE_TARGET_LO
        LDA     PAGE_LAST_HI
        STA     PAGE_TARGET_HI
        JSR     PAGE_RENDER_TARGET
        BCS     PAGE_MODE_ABORT

        ; PAGE_RENDER_TARGET reserves row 24 for the navigation legend.  In chat
        ; mode that row is usable again, so erase the legend before placing the
        ; live prompt at the end of the reconstructed history tail.
        JSR     PAGE_CLEAR_HELP
        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        JSR     INPUT_ITER_RESET
        JSR     SHOW_REPRINT_INPUT

        ; Keep the configured history closed while idle. The next submitted
        ; turn reopens it at SAVE_POS and overwrites the committed DOS EOF.
        JMP     MAIN_INPUT

MENU_CMD
        LDX     #<TXT_CMD_FILE
        LDY     #>TXT_CMD_FILE
        LDA     #$00
        STA     NAME_DEFAULT
        JSR     MENU_FILENAME_INPUT
        BCS     MENU_CMD_HAVE_NAME
        JMP     MENU_REDRAW
MENU_CMD_HAVE_NAME

        JSR     COPY_INPUT_TO_AUX_NAME
        JSR     KAPI_FM_CREATE_AUX
        BCC     MENU_CMD_OPENED
        JSR     MENU_RESTORE_ROW
        JSR     SHOW_DOS_ERROR_AND_PROMPT
        JMP     MAIN_INPUT

MENU_CMD_OPENED
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     INPUT_COUNT_LO          ; CMD replaces an unfinished chat line
        STA     INPUT_COUNT_HI
        JSR     MENU_RESTORE_ROW
        JSR     ENSURE_LINE_START
        JSR     CMD_EDITOR
        JMP     MAIN_INPUT

MENU_AMP
        LDA     AMP_INSTALLED
        BNE     MENU_AMP_ALREADY
        JSR     INSTALL_AMP_GPT
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR
        JSR     PRINT_AMP_HINT
        JMP     MAIN_INPUT
MENU_AMP_ALREADY
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR
        JMP     MAIN_INPUT

MENU_HISTORY
MENU_SAVE
        LDX     #<TXT_SAVE_FILE
        LDY     #>TXT_SAVE_FILE
        ; SAVE requester mode: pre-fill current/default name and permit an empty
        ; RETURN so the user can explicitly disable history saving.
        LDA     #$02
        STA     NAME_DEFAULT
        JSR     MENU_FILENAME_INPUT
        BCS     MENU_SAVE_NAME_OK
        JMP     MENU_REDRAW
MENU_SAVE_NAME_OK

        LDA     NAME_LEN
        BNE     MENU_SAVE_NONEMPTY

        ; Empty RETURN means "stop saving".  ESC never reaches this path and
        ; therefore leaves the existing configuration untouched.
        JSR     SAVE_STOP
        BCC     MENU_SAVE_OK
        JSR     MENU_RESTORE_ROW
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

MENU_SAVE_NONEMPTY
        ; Merely opening SAVE and accepting the already configured filename must
        ; not delete/recreate the history file.
        JSR     SAVE_NAME_INPUT_MATCHES_CONFIG
        BCS     MENU_SAVE_OK

        JSR     COPY_INPUT_TO_SAVE_NAME
        JSR     SAVE_REOPEN_NEW
        BCC     MENU_SAVE_OK
        JSR     MENU_RESTORE_ROW
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

MENU_SAVE_OK
        JSR     MENU_RESTORE_ROW
        JSR     KAPI_SET_HW_CURSOR
        JMP     MAIN_INPUT

MENU_QUIT
        JSR     MENU_RESTORE_ROW
        JSR     CLOSE_ALL_FILES
        JSR     ENSURE_LINE_START
        ; MENU_DRAW/filename overlays move the physical CRTC cursor without
        ; changing logical CURSOR/COLUMN.  ENSURE_LINE_START is intentionally
        ; a no-op when COLUMN is already zero, so always re-assert the logical
        ; cursor here before returning to BASIC.  SET_HW_CURSOR also refreshes
        ; Apple/VideoTerm firmware cursor variables through SYNC_VIDEX_FIRMWARE.
        JSR     KAPI_SET_HW_CURSOR
        JSR     RESTORE_APP_ZP
        RTS

MENU_REDRAW
        JSR     MENU_DRAW
        JMP     MENU_WAIT

ASCII_TO_UPPER
        CMP     #'a'
        BCC     ASCII_UPPER_DONE
        CMP     #$7B
        BCS     ASCII_UPPER_DONE
        AND     #$DF
ASCII_UPPER_DONE
        RTS

; Save the current physical VideoTerm row. Logical cursor state is untouched.
MENU_SAVE_ROW
        SEC
        LDA     CURSOR_LO
        SBC     COLUMN
        STA     MENU_ROW_LO
        LDA     CURSOR_HI
        SBC     #$00
        AND     #VRAM_MASK_HI
        STA     MENU_ROW_HI

        LDA     MENU_ROW_LO
        STA     TMP_LO
        LDA     MENU_ROW_HI
        STA     TMP_HI

        LDY     #$00
MENU_SAVE_LOOP
        JSR     KAPI_READ_CELL_TEMP_RAW
        STA     MENU_ROW_SAVE,Y
        JSR     KAPI_INC_TEMP_ADDR
        INY
        CPY     #SCREEN_COLS
        BNE     MENU_SAVE_LOOP
        RTS

MENU_RESTORE_ROW
        LDA     MENU_ROW_LO
        STA     TMP_LO
        LDA     MENU_ROW_HI
        STA     TMP_HI

        LDY     #$00
MENU_RESTORE_LOOP
        LDA     MENU_ROW_SAVE,Y
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        CPY     #SCREEN_COLS
        BNE     MENU_RESTORE_LOOP
        RTS

MENU_CLEAR_ROW
        LDA     MENU_ROW_LO
        STA     TMP_LO
        LDA     MENU_ROW_HI
        STA     TMP_HI
        LDY     #SCREEN_COLS
MENU_CLEAR_LOOP
        LDA     #SPACE_GLYPH
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        DEY
        BNE     MENU_CLEAR_LOOP
        RTS

MENU_DRAW
        JSR     MENU_CLEAR_ROW
        LDX     #<TXT_MENU
        LDY     #>TXT_MENU
        JSR     OVERLAY_WRITE_STRING
        RTS

; X/Y = zero-terminated ASCII string. Writes from overlay column zero and
; returns its length in OVERLAY_PREFIX_LEN.
OVERLAY_WRITE_STRING
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDA     MENU_ROW_LO
        STA     TMP_LO
        LDA     MENU_ROW_HI
        STA     TMP_HI
        LDY     #$00
OVERLAY_STRING_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     OVERLAY_STRING_DONE
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        CPY     #SCREEN_COLS
        BNE     OVERLAY_STRING_LOOP
OVERLAY_STRING_DONE
        STY     OVERLAY_PREFIX_LEN
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

; X/Y label. NAME_DEFAULT=$02 selects SAVE requester mode: pre-fill the
; configured/default history filename and allow an empty RETURN to disable SAVE.
; Return C=1 success, C=0 ESC/cancel. NAME_INPUT/NAME_LEN contain low-bit ASCII.
MENU_FILENAME_INPUT
        STX     LABEL_PTR_LO
        STY     LABEL_PTR_HI
        JSR     MENU_CLEAR_ROW
        LDX     LABEL_PTR_LO
        LDY     LABEL_PTR_HI
        JSR     OVERLAY_WRITE_STRING
        LDA     #$00
        STA     NAME_LEN

        LDA     NAME_DEFAULT
        CMP     #$02
        BNE     MENU_FILENAME_SET_CURSOR
        JSR     SET_SAVE_REQUEST_NAME
        JSR     OVERLAY_DRAW_NAME_INPUT
        JMP     MENU_FILENAME_LOOP

MENU_FILENAME_SET_CURSOR
        JSR     OVERLAY_SET_INPUT_CURSOR

MENU_FILENAME_LOOP
        JSR     KAPI_GET_KEY_WAIT
        CMP     #KEY_ESC
        BEQ     MENU_FILENAME_CANCEL
        CMP     #KEY_CR
        BEQ     MENU_FILENAME_RETURN
        CMP     #KEY_BS
        BEQ     MENU_FILENAME_BS
        CMP     #KEY_DEL
        BEQ     MENU_FILENAME_BS
        CMP     #$20
        BCC     MENU_FILENAME_LOOP
        CMP     #$7F
        BCS     MENU_FILENAME_LOOP

        JSR     ASCII_TO_UPPER
        LDX     NAME_LEN
        CPX     #MAX_FILENAME
        BCS     MENU_FILENAME_LOOP
        STA     NAME_INPUT,X
        INC     NAME_LEN
        JSR     OVERLAY_WRITE_INPUT_CHAR
        JMP     MENU_FILENAME_LOOP

MENU_FILENAME_BS
        LDA     NAME_LEN
        BEQ     MENU_FILENAME_LOOP
        DEC     NAME_LEN
        JSR     OVERLAY_ERASE_INPUT_CHAR
        JMP     MENU_FILENAME_LOOP

MENU_FILENAME_RETURN
        LDA     NAME_LEN
        BNE     MENU_FILENAME_SUCCESS
        ; Only SAVE requester mode accepts a deliberately empty filename.
        LDA     NAME_DEFAULT
        CMP     #$02
        BNE     MENU_FILENAME_LOOP
MENU_FILENAME_SUCCESS
        SEC
        RTS

MENU_FILENAME_CANCEL
        CLC
        RTS

OVERLAY_INPUT_ADDR
        LDA     MENU_ROW_LO
        CLC
        ADC     OVERLAY_PREFIX_LEN
        ADC     NAME_LEN
        STA     TMP_LO
        LDA     MENU_ROW_HI
        ADC     #$00
        AND     #VRAM_MASK_HI
        STA     TMP_HI
        RTS

OVERLAY_SET_INPUT_CURSOR
        JSR     OVERLAY_INPUT_ADDR
        LDX     TMP_HI
        LDA     #CRTC_CURSOR_HI
        JSR     KAPI_VIDEX_CRTC_WRITE
        LDX     TMP_LO
        LDA     #CRTC_CURSOR_LO
        JSR     KAPI_VIDEX_CRTC_WRITE
        RTS

; Draw the complete NAME_INPUT after a default-name prefill without moving the
; application's logical chat cursor.
OVERLAY_DRAW_NAME_INPUT
        ; WRITE_CELL_TEMP_RAW uses X internally for the VRAM byte offset, so X
        ; cannot also be the filename loop counter.  V5.91 did exactly that,
        ; which made the pre-filled SAVE name jump to unrelated screen cells.
        ; Keep the loop index in memory instead.
        LDA     MENU_ROW_LO
        CLC
        ADC     OVERLAY_PREFIX_LEN
        STA     TMP_LO
        LDA     MENU_ROW_HI
        ADC     #$00
        AND     #VRAM_MASK_HI
        STA     TMP_HI
        LDA     #$00
        STA     LOOP_INDEX
OVERLAY_DRAW_NAME_LOOP
        LDX     LOOP_INDEX
        CPX     NAME_LEN
        BEQ     OVERLAY_DRAW_NAME_DONE
        LDA     NAME_INPUT,X
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INC     LOOP_INDEX
        JMP     OVERLAY_DRAW_NAME_LOOP
OVERLAY_DRAW_NAME_DONE
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

OVERLAY_WRITE_INPUT_CHAR
        PHA
        JSR     OVERLAY_INPUT_ADDR
        ; NAME_LEN already includes the new byte; address points one cell after it.
        JSR     DEC_TEMP_ADDR
        PLA
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

OVERLAY_ERASE_INPUT_CHAR
        JSR     OVERLAY_INPUT_ADDR
        LDA     #SPACE_GLYPH
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

DEC_TEMP_ADDR
        LDA     TMP_LO
        BNE     DEC_TEMP_LOW
        LDA     #$FF
        STA     TMP_LO
        LDA     TMP_HI
        BNE     DEC_TEMP_HI
        LDA     #VRAM_MASK_HI
        STA     TMP_HI
        RTS
DEC_TEMP_HI
        DEC     TMP_HI
        RTS
DEC_TEMP_LOW
        DEC     TMP_LO
        RTS

; =============================================================================
; CMD TEXT-FILE EDITOR
; =============================================================================

CMD_EDITOR
        LDA     #$00
        STA     AUX_LINE_LEN
        JSR     PRINT_CMD_PROMPT

CMD_EDITOR_LOOP
        JSR     KAPI_GET_KEY
        CMP     #KEY_ESC
        BNE     CMD_NOT_ESC
        JMP     CMD_EDITOR_EXIT
CMD_NOT_ESC
        CMP     #KEY_CR
        BEQ     CMD_EDITOR_CR
        CMP     #KEY_BS
        BEQ     CMD_EDITOR_BS
        CMP     #KEY_DEL
        BEQ     CMD_EDITOR_BS
        CMP     #$20
        BCC     CMD_EDITOR_LOOP
        CMP     #$7F
        BCS     CMD_EDITOR_LOOP

        LDX     AUX_LINE_LEN
        CPX     #$FE
        BCS     CMD_EDITOR_LOOP
        STA     AUX_LINE_BUF,X
        INC     AUX_LINE_LEN
        JSR     KAPI_WRITE_GLYPH
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_BS
        LDA     AUX_LINE_LEN
        BEQ     CMD_EDITOR_LOOP
        DEC     AUX_LINE_LEN
        JSR     KAPI_SCREEN_BACKSPACE
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_CR
        JSR     CMD_FLUSH_LINE_CR
        BCS     CMD_EDITOR_ERROR
        JSR     KAPI_NEWLINE
        JSR     PRINT_CMD_PROMPT
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_EXIT
        LDA     AUX_LINE_LEN
        BEQ     CMD_EDITOR_CLOSE
        JSR     CMD_FLUSH_LINE_CR
        BCS     CMD_EDITOR_ERROR
CMD_EDITOR_CLOSE
        JSR     KAPI_FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        RTS

CMD_EDITOR_ERROR
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        JSR     SHOW_DOS_ERROR_AND_PROMPT
        RTS

CMD_FLUSH_LINE_CR
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        LDA     #$00
        STA     LOOP_INDEX
CMD_FLUSH_LOOP
        LDX     LOOP_INDEX
        CPX     AUX_LINE_LEN
        BEQ     CMD_FLUSH_CR
        LDA     AUX_LINE_BUF,X
        JSR     KAPI_FILE_ENCODE_ASCII_A
        BCS     CMD_FLUSH_FAIL
        INC     LOOP_INDEX
        JMP     CMD_FLUSH_LOOP
CMD_FLUSH_CR
        LDA     #KEY_CR
        JSR     KAPI_FILE_ENCODE_ASCII_A
        BCS     CMD_FLUSH_FAIL
        LDA     #$00
        STA     AUX_LINE_LEN
        CLC
        RTS
CMD_FLUSH_FAIL
        SEC
        RTS

PRINT_CMD_PROMPT
        LDX     #<TXT_CMD_PROMPT
        LDY     #>TXT_CMD_PROMPT
        JSR     KAPI_PRINT_SCREEN_STRING
        RTS

; =============================================================================
; SAVE / HISTORY
; =============================================================================

SAVE_REOPEN_NEW
        ; A new SAVE request replaces the previous persistent configuration.
        ; Only mark it configured again after the new file and history magic
        ; have been created successfully.
        LDA     #$00
        STA     SAVE_CONFIGURED
        LDA     SAVE_ACTIVE
        BEQ     SAVE_OPEN_NEW
        JSR     KAPI_FM_EOF_CLOSE_SAVE
        BCS     SAVE_OPEN_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
SAVE_OPEN_NEW
        JSR     KAPI_FM_CREATE_SAVE
        BCS     SAVE_OPEN_FAIL

        ; V5.3 history is DOS/TYPE-safe escaped UTF-16. The leading
        ; $81,$82,$83 bytes are harmless VideoTerm no-ops and identify the
        ; representation to LOAD without displaying a visible header.
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_HISTORY
        STA     FILE_ENCODING
        LDX     #FILE_TARGET_SAVE
        LDA     #$00
        STA     ENC_LAST_CR,X
        STA     SAVE_POS_LO
        STA     SAVE_POS_HI
        JSR     HISTORY_WRITE_MAGIC
        BCS     SAVE_MAGIC_FAIL

        LDA     #$01
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        CLC
        RTS

SAVE_MAGIC_FAIL
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_SAVE
        PLA
        STA     DOS_LAST_RC
        SEC
SAVE_OPEN_FAIL
        RTS

; Stop the persistent SAVE configuration without deleting the existing history.
; If the file is currently open, commit a DOS EOF and close it first.
SAVE_STOP
        JSR     HISTORY_CLOSE_PRESERVE
        BCS     SAVE_STOP_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        STA     SAVE_NAME_LEN
        STA     SAVE_POS_LO
        STA     SAVE_POS_HI
        CLC
        RTS
SAVE_STOP_FAIL
        SEC
        RTS

HISTORY_WRITE_MAGIC
        LDA     #$81                    ; ignored by VideoTerm VIDOUT
        JSR     KAPI_FM_WRITE_RAW
        BCS     HISTORY_MAGIC_DONE
        LDA     #$82
        JSR     KAPI_FM_WRITE_RAW
        BCS     HISTORY_MAGIC_DONE
        LDA     #$83
        JSR     KAPI_FM_WRITE_RAW
HISTORY_MAGIC_DONE
        RTS

; A = one ASCII code point to append through the escaped-history encoder.
HISTORY_WRITE_ASCII
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        JMP     HISTORY_WRITE_CP

HISTORY_WRITE_USER_BUFFER
        ; Never silently drop a turn merely because the configured writer is
        ; currently closed (normal after NAVIGATE and between completed turns).
        JSR     HISTORY_OPEN_CONFIGURED
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_USER_DONE
        LDA     #USER_PROMPT_CHAR
        JSR     HISTORY_WRITE_ASCII
        JSR     INPUT_ITER_RESET
HISTORY_USER_LOOP
        JSR     INPUT_NEXT_CHAR
        BCC     HISTORY_USER_CR
        JSR     HISTORY_WRITE_ASCII
        JMP     HISTORY_USER_LOOP
HISTORY_USER_CR
        LDA     #KEY_CR
        JSR     HISTORY_WRITE_ASCII
HISTORY_USER_DONE
        RTS

; CP_HI:CP_LO = one UTF-16 code unit. History chooses escaped UTF-16;
; the File Manager byte transport itself is shared with CMD/GPT-created files.
HISTORY_WRITE_CP
        LDA     SAVE_ACTIVE
        BNE     HISTORY_CP_ACTIVE
        JSR     HISTORY_OPEN_CONFIGURED
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_CP_DONE
HISTORY_CP_ACTIVE
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_HISTORY
        STA     FILE_ENCODING
        JSR     KAPI_FILE_ENCODE_CP
        BCC     HISTORY_CP_DONE
        JMP     HISTORY_DISABLE
HISTORY_CP_DONE
        CLC
        RTS

; HS_HI:HS_LO / LS_HI:LS_LO = one supplementary Unicode scalar.
HISTORY_WRITE_SURROGATE
        LDA     SAVE_ACTIVE
        BNE     HISTORY_SURR_ACTIVE
        JSR     HISTORY_OPEN_CONFIGURED
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_SURR_DONE
HISTORY_SURR_ACTIVE
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_HISTORY
        STA     FILE_ENCODING
        JSR     KAPI_FILE_ENCODE_SURROGATE
        BCC     HISTORY_SURR_DONE
        JMP     HISTORY_DISABLE
HISTORY_SURR_DONE
        CLC
        RTS

; Commit the previous reply + current prompt while GPT is thinking.
;
; Write a real DOS $00 EOF before CLOSE so the on-disk file is valid at every
; commit point.  SAVE_POS normally denotes the first free payload byte; the EOF
; write advances it once, so move it back before reopen/POSITION.  The next
; response byte overwrites that committed EOF.
HISTORY_COMMIT_REOPEN
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_COMMIT_DONE

        LDA     #$00
        JSR     KAPI_FM_WRITE_SAVE_RAW
        BCS     HISTORY_COMMIT_FAIL

        ; Keep SAVE_POS at payload length, excluding the temporary EOF byte.
        LDA     SAVE_POS_LO
        BNE     HISTORY_COMMIT_DEC_LO
        DEC     SAVE_POS_HI
HISTORY_COMMIT_DEC_LO
        DEC     SAVE_POS_LO

        JSR     KAPI_FM_CLOSE_SAVE
        BCS     HISTORY_COMMIT_FAIL
        JSR     KAPI_FM_OPEN_SAVE_EXIST
        BCS     HISTORY_COMMIT_FAIL
        JSR     KAPI_FM_POSITION_SAVE
        BCS     HISTORY_COMMIT_FAIL
HISTORY_COMMIT_DONE
        CLC
        RTS
HISTORY_COMMIT_FAIL
        JMP     HISTORY_DISABLE

; Close a configured SAVE file while keeping SAVE_POS on the byte that will
; overwrite the committed DOS $00 EOF when &GPT later appends another turn.
HISTORY_CLOSE_PRESERVE
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_CLOSE_PRESERVE_DONE
        LDA     #$00
        JSR     KAPI_FM_WRITE_SAVE_RAW
        BCS     HISTORY_CLOSE_PRESERVE_FAIL
        LDA     SAVE_POS_LO
        BNE     HISTORY_CLOSE_PRESERVE_DEC_LO
        DEC     SAVE_POS_HI
HISTORY_CLOSE_PRESERVE_DEC_LO
        DEC     SAVE_POS_LO
        JSR     KAPI_FM_CLOSE_SAVE
        BCS     HISTORY_CLOSE_PRESERVE_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
HISTORY_CLOSE_PRESERVE_DONE
        CLC
        RTS
HISTORY_CLOSE_PRESERVE_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        JSR     KAPI_FM_CLOSE_SAVE
        SEC
        RTS

HISTORY_DISABLE
        LDA     DOS_LAST_RC
        PHA
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        JSR     KAPI_FM_CLOSE_SAVE
        PLA
        STA     DOS_LAST_RC
        SEC
        RTS


; Attach an existing history filename without recreating it. Scan raw DOS bytes
; only to find the existing EOF position; this is the byte offset at which future
; history data must resume. LOAD_COUNT_* are idle here and serve as a 16-bit count.
; C=0 attached/configured, C=1 DOS error.
HISTORY_ATTACH_EXISTING
        JSR     COPY_SAVE_TO_AUX_NAME
        JSR     KAPI_FM_OPEN_AUX_EXIST
        BCC     HISTORY_ATTACH_OPENED
        JMP     HISTORY_ATTACH_FAIL

HISTORY_ATTACH_OPENED
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     LOAD_COUNT_LO
        STA     LOAD_COUNT_HI

HISTORY_ATTACH_SCAN
        JSR     KAPI_FM_READ_AUX
        BCC     HISTORY_ATTACH_READ_END
        CMP     #$00                    ; explicit DOS text EOF byte
        BEQ     HISTORY_ATTACH_HAVE_POS
        INC     LOAD_COUNT_LO
        BNE     HISTORY_ATTACH_SCAN
        INC     LOAD_COUNT_HI
        JMP     HISTORY_ATTACH_SCAN

HISTORY_ATTACH_READ_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA            ; physical EOF without an explicit $00
        BNE     HISTORY_ATTACH_CLOSE_ERROR

HISTORY_ATTACH_HAVE_POS
        LDA     LOAD_COUNT_LO
        STA     SAVE_POS_LO
        LDA     LOAD_COUNT_HI
        STA     SAVE_POS_HI
        JSR     KAPI_FM_CLOSE_AUX
        BCS     HISTORY_ATTACH_FAIL_CLOSED
        LDA     #$00
        STA     AUX_OPEN
        LDA     #$01
        STA     SAVE_CONFIGURED
        LDA     #$00
        STA     SAVE_ACTIVE
        CLC
        RTS

HISTORY_ATTACH_CLOSE_ERROR
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
HISTORY_ATTACH_FAIL_CLOSED
        LDA     #$00
        STA     AUX_OPEN
HISTORY_ATTACH_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        STA     SAVE_NAME_LEN
        SEC
        RTS

; =============================================================================
; LOAD / HISTORY DECODING
; =============================================================================
;
; Files beginning $81,$82,$83 are V5.3 escaped UTF-16 history. The former manual
; [R]EAD SPACE-paged viewer is removed. These decoding routines remain shared by
; [N]AVIGATE and GPT-requested file loads.
;

; =============================================================================
; ACTIVE CHAT-HISTORY PAGE NAVIGATION
; =============================================================================
;
; Page navigation deliberately reopens and scans the history from byte zero for
; each requested page.  This keeps the on-disk format unchanged and avoids a
; RAM-resident index. A page contains 23 display rows; physical row 24 is
; reserved for navigation help. Page boundaries are computed
; from the same Unicode->VIDEX mapping and 80-column wrapping rules as display.
;

; Open the configured SAVE filename through the auxiliary read buffers.
PAGE_OPEN_HISTORY
        JSR     COPY_SAVE_TO_AUX_NAME
        JSR     KAPI_FM_OPEN_AUX_EXIST
        BCC     PAGE_OPEN_HISTORY_OK
        SEC
        RTS
PAGE_OPEN_HISTORY_OK
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     LOAD_COUNT_LO
        STA     LOAD_COUNT_HI
        STA     LOAD_LAST_CR
        STA     PAGE_LAST_CR
        JSR     LOAD_DETECT_ENCODING
        BCC     PAGE_OPEN_ENCODING_OK
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS
PAGE_OPEN_ENCODING_OK
        CLC
        RTS

PAGE_CLOSE_HISTORY
        JSR     KAPI_FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        RTS

PAGE_CLOSE_HISTORY_ERROR
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

; Find the zero-based index of the newest non-spurious 23-row page.
PAGE_FIND_LAST
        JSR     PAGE_OPEN_HISTORY
        BCC     PAGE_FIND_OPENED
        SEC
        RTS
PAGE_FIND_OPENED
        JSR     PAGE_RESET_SCAN

PAGE_FIND_LOOP
        JSR     PAGE_NEXT_VISIBLE
        BCC     PAGE_FIND_END
        STA     PAGE_EVENT
        JSR     PAGE_SCAN_BOUNDARY
        LDA     PAGE_EVENT
        JSR     PAGE_SCAN_ADVANCE
        JMP     PAGE_FIND_LOOP

PAGE_FIND_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BNE     PAGE_FIND_ERROR
        LDA     PAGE_CUR_LO
        STA     PAGE_LAST_LO
        LDA     PAGE_CUR_HI
        STA     PAGE_LAST_HI
        JSR     PAGE_CLOSE_HISTORY
        CLC
        RTS
PAGE_FIND_ERROR
        JMP     PAGE_CLOSE_HISTORY_ERROR

; Render PAGE_TARGET_* by rescanning from the start.  Earlier pages update only
; the simulated row/column; the target page is emitted into a freshly cleared
; VideoTerm display using the normal raw glyph/newline routines.
PAGE_RENDER_TARGET
        JSR     PAGE_OPEN_HISTORY
        BCC     PAGE_RENDER_OPENED
        SEC
        RTS
PAGE_RENDER_OPENED
        JSR     KAPI_SCREEN_INIT
        JSR     PAGE_RESET_SCAN

PAGE_RENDER_LOOP
        JSR     PAGE_NEXT_VISIBLE
        BCC     PAGE_RENDER_END
        STA     PAGE_EVENT
        JSR     PAGE_SCAN_BOUNDARY

        ; current page < target: skip this visible event.
        LDA     PAGE_CUR_HI
        CMP     PAGE_TARGET_HI
        BCC     PAGE_RENDER_SKIP
        BNE     PAGE_RENDER_AFTER_TARGET
        LDA     PAGE_CUR_LO
        CMP     PAGE_TARGET_LO
        BCC     PAGE_RENDER_SKIP
        BNE     PAGE_RENDER_AFTER_TARGET

        ; current page == target: display the event.
        LDA     PAGE_EVENT
        BEQ     PAGE_RENDER_NEWLINE
        JSR     KAPI_WRITE_GLYPH
        JMP     PAGE_RENDER_ADVANCE
PAGE_RENDER_NEWLINE
        JSR     KAPI_NEWLINE
PAGE_RENDER_ADVANCE
        LDA     PAGE_EVENT
        JSR     PAGE_SCAN_ADVANCE
        JMP     PAGE_RENDER_LOOP

PAGE_RENDER_SKIP
        LDA     PAGE_EVENT
        JSR     PAGE_SCAN_ADVANCE
        JMP     PAGE_RENDER_LOOP

PAGE_RENDER_AFTER_TARGET
        JSR     PAGE_CLOSE_HISTORY
        JMP     PAGE_RENDER_SUCCESS

PAGE_RENDER_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BNE     PAGE_RENDER_ERROR
        JSR     PAGE_CLOSE_HISTORY
PAGE_RENDER_SUCCESS
        JSR     PAGE_DRAW_HELP
        CLC
        RTS
PAGE_RENDER_ERROR
        JMP     PAGE_CLOSE_HISTORY_ERROR

; Physical row 23 (the 24th line) never belongs to history content. Draw the
; navigation legend there with raw VRAM writes so the 23-row page model is not
; disturbed. SCREEN_INIT used by PAGE_RENDER_TARGET guarantees VSTART=$0000.
PAGE_DRAW_HELP
        LDA     #$30                    ; 23 * 80 = $0730
        STA     TMP_LO
        LDA     #$07
        STA     TMP_HI
        LDX     #<TXT_NAV_HELP
        LDY     #>TXT_NAV_HELP
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
PAGE_DRAW_HELP_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PAGE_DRAW_HELP_DONE
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        BNE     PAGE_DRAW_HELP_LOOP
        INC     MSG_ZPH
        JMP     PAGE_DRAW_HELP_LOOP
PAGE_DRAW_HELP_DONE
        ; Keep the blinking hardware cursor out of the history text.
        LDX     #$07
        LDA     #CRTC_CURSOR_HI
        JSR     KAPI_VIDEX_CRTC_WRITE
        LDX     #$7F
        LDA     #CRTC_CURSOR_LO
        JSR     KAPI_VIDEX_CRTC_WRITE
        RTS

; Erase the fixed row-24 navigation legend without disturbing ROW/COLUMN.
; PAGE_RENDER_TARGET always SCREEN_INITs first, therefore physical row 23 is
; $0730 in the active VideoTerm display map.
PAGE_CLEAR_HELP
        LDA     #$30
        STA     TMP_LO
        LDA     #$07
        STA     TMP_HI
        LDY     #SCREEN_COLS
PAGE_CLEAR_HELP_LOOP
        LDA     #SPACE_GLYPH
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        DEY
        BNE     PAGE_CLEAR_HELP_LOOP
        JSR     KAPI_SET_HW_CURSOR
        RTS

PAGE_RESET_SCAN
        LDA     #$00
        STA     PAGE_CUR_LO
        STA     PAGE_CUR_HI
        STA     PAGE_SCAN_ROW
        STA     PAGE_SCAN_COL
        STA     PAGE_LAST_CR
        RTS

; Before another visible event is emitted, row 23 begins the next page.  This
; 'check before emit' rule avoids manufacturing an empty final page when EOF is
; reached exactly at a page boundary.
PAGE_SCAN_BOUNDARY
        LDA     PAGE_SCAN_ROW
        CMP     #$17                    ; rows 0..22 belong to one page
        BCC     PAGE_SCAN_BOUNDARY_DONE
        LDA     #$00
        STA     PAGE_SCAN_ROW
        STA     PAGE_SCAN_COL
        INC     PAGE_CUR_LO
        BNE     PAGE_SCAN_BOUNDARY_DONE
        INC     PAGE_CUR_HI
PAGE_SCAN_BOUNDARY_DONE
        RTS

; A=0 newline event, otherwise one mapped VIDEX glyph.
PAGE_SCAN_ADVANCE
        CMP     #$00
        BEQ     PAGE_SCAN_ADVANCE_NL
        INC     PAGE_SCAN_COL
        LDA     PAGE_SCAN_COL
        CMP     #SCREEN_COLS
        BCC     PAGE_SCAN_ADVANCE_DONE
        LDA     #$00
        STA     PAGE_SCAN_COL
        INC     PAGE_SCAN_ROW
PAGE_SCAN_ADVANCE_DONE
        RTS
PAGE_SCAN_ADVANCE_NL
        LDA     #$00
        STA     PAGE_SCAN_COL
        INC     PAGE_SCAN_ROW
        RTS

; Return the next *visible* history event.
; C=1: A=0 newline or A=VIDEX glyph.  C=0: EOF/read error in DOS_LAST_RC.
PAGE_NEXT_VISIBLE
PAGE_NEXT_VISIBLE_LOOP
        JSR     LOAD_NEXT_CODEPOINT
        BCC     PAGE_NEXT_VISIBLE_DONE

        LDA     CP_HI
        BNE     PAGE_NEXT_VISIBLE_UNICODE
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     PAGE_NEXT_VISIBLE_CR
        CMP     #$0A
        BEQ     PAGE_NEXT_VISIBLE_LF

PAGE_NEXT_VISIBLE_UNICODE
        LDA     #$00
        STA     PAGE_LAST_CR

        ; Decode a UTF-16 surrogate pair before mapping supplementary glyphs.
        LDA     CP_HI
        CMP     #$D8
        BCC     PAGE_NEXT_VISIBLE_BMP
        CMP     #$DC
        BCS     PAGE_NEXT_VISIBLE_BMP
        LDA     CP_LO
        STA     HS_LO
        LDA     CP_HI
        STA     HS_HI
        JSR     LOAD_NEXT_CODEPOINT
        BCC     PAGE_NEXT_VISIBLE_DONE
        LDA     CP_HI
        CMP     #$DC
        BCC     PAGE_NEXT_VISIBLE_LOOP
        CMP     #$E0
        BCS     PAGE_NEXT_VISIBLE_LOOP
        LDA     CP_LO
        STA     LS_LO
        LDA     CP_HI
        STA     LS_HI
        JSR     MAP_SURROGATE
        BCC     PAGE_NEXT_VISIBLE_LOOP
        SEC
        RTS

PAGE_NEXT_VISIBLE_BMP
        JSR     MAP_BMP
        BCC     PAGE_NEXT_VISIBLE_LOOP
        SEC
        RTS

PAGE_NEXT_VISIBLE_CR
        LDA     #$01
        STA     PAGE_LAST_CR
        LDA     #$00
        SEC
        RTS

PAGE_NEXT_VISIBLE_LF
        LDA     PAGE_LAST_CR
        BEQ     PAGE_NEXT_VISIBLE_LF_ONLY
        LDA     #$00
        STA     PAGE_LAST_CR
        JMP     PAGE_NEXT_VISIBLE_LOOP
PAGE_NEXT_VISIBLE_LF_ONLY
        LDA     #$00
        STA     PAGE_LAST_CR
        LDA     #$00
        SEC
        RTS

PAGE_NEXT_VISIBLE_DONE
        CLC
        RTS

LOAD_AUX_AS_GPT_REQUEST
        JSR     KAPI_FM_OPEN_AUX_EXIST
        BCC     LOAD_OPENED
        SEC
        RTS

LOAD_OPENED
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     LOAD_COUNT_LO
        STA     LOAD_COUNT_HI
        STA     LOAD_LAST_CR

        JSR     LOAD_DETECT_ENCODING
        BCC     LOAD_ENCODING_READY
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_ENCODING_READY
        ; Visible audit line for a menu/GPT requested file load.
        LDX     #<TXT_LOAD_AUDIT
        LDY     #>TXT_LOAD_AUDIT
        JSR     KAPI_PRINT_SCREEN_STRING
        JSR     PRINT_NAME_INPUT_SCREEN
        JSR     KAPI_NEWLINE

        ; Actual single GPT request begins with FILE <name>: then U+2028.
        LDX     #<TXT_FILE_HEADER
        LDY     #>TXT_FILE_HEADER
        JSR     SEND_Z_UTF16
        JSR     SEND_NAME_INPUT_UTF16
        LDA     #':'
        JSR     KAPI_SEND_UTF16_ASCII
        JSR     SEND_LINE_SEPARATOR

        LDA     SAVE_ACTIVE
        BEQ     LOAD_HISTORY_HEADER_DONE
        LDA     #USER_PROMPT_CHAR
        JSR     HISTORY_WRITE_ASCII
        LDX     #<TXT_FILE_HEADER
        LDY     #>TXT_FILE_HEADER
        JSR     HISTORY_WRITE_Z
        JSR     HISTORY_WRITE_NAME_INPUT
        LDA     #':'
        JSR     HISTORY_WRITE_ASCII
        LDA     #KEY_CR
        JSR     HISTORY_WRITE_ASCII
LOAD_HISTORY_HEADER_DONE

LOAD_READ_LOOP
        JSR     LOAD_LIMIT_REACHED
        BCC     LOAD_LIMIT_CONTINUE
        JMP     LOAD_FINISH
LOAD_LIMIT_CONTINUE

        JSR     LOAD_NEXT_CODEPOINT
        BCS     LOAD_HAVE_CODEPOINT
        JMP     LOAD_READ_END
LOAD_HAVE_CODEPOINT

        ; LOAD_NEXT_CODEPOINT returns one UTF-16 code unit at a time.  That is
        ; exactly what both history re-encoding and the UTF-16LE wire require.
        JSR     HISTORY_WRITE_CP

        LDA     CP_HI
        BNE     LOAD_SEND_BMP
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     LOAD_SEND_CR
        CMP     #$0A
        BEQ     LOAD_SEND_LF

LOAD_SEND_BMP
        LDA     #$00
        STA     LOAD_LAST_CR
        LDA     CP_LO
        JSR     KAPI_SERIAL_TX_BYTE
        LDA     CP_HI
        JSR     KAPI_SERIAL_TX_BYTE
        JSR     INC_LOAD_COUNT
        JMP     LOAD_READ_LOOP

LOAD_SEND_CR
        JSR     SEND_LINE_SEPARATOR
        LDA     #$01
        STA     LOAD_LAST_CR
        JSR     INC_LOAD_COUNT
        JMP     LOAD_READ_LOOP

LOAD_SEND_LF
        LDA     LOAD_LAST_CR
        BEQ     LOAD_SEND_LF_ONLY
        LDA     #$00
        STA     LOAD_LAST_CR
        JMP     LOAD_READ_LOOP
LOAD_SEND_LF_ONLY
        JSR     SEND_LINE_SEPARATOR
        JSR     INC_LOAD_COUNT
        JMP     LOAD_READ_LOOP

LOAD_READ_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BEQ     LOAD_FINISH
        LDA     DOS_LAST_RC
        PHA
        JSR     KAPI_FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_FINISH
        JSR     KAPI_FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        LDA     #KEY_CR
        JSR     KAPI_SEND_UTF16_ASCII
        CLC
        RTS

; Read the first three bytes once and recognize the invisible history magic.
; If the prefix differs, retain every byte for ordinary DOS-text decoding.
LOAD_DETECT_ENCODING
        LDA     #LOAD_ENCODING_DOS
        STA     LOAD_ENCODING
        LDA     #$00
        STA     LOAD_PREFETCH_COUNT
        STA     LOAD_PREFETCH_INDEX

        JSR     KAPI_FM_READ_AUX
        BCC     LOAD_DETECT_READ_END
        STA     LOAD_PREFETCH
        LDA     #$01
        STA     LOAD_PREFETCH_COUNT
        LDA     LOAD_PREFETCH
        CMP     #$81
        BNE     LOAD_DETECT_OK

        JSR     KAPI_FM_READ_AUX
        BCC     LOAD_DETECT_READ_END
        STA     LOAD_PREFETCH+1
        LDA     #$02
        STA     LOAD_PREFETCH_COUNT
        LDA     LOAD_PREFETCH+1
        CMP     #$82
        BNE     LOAD_DETECT_OK

        JSR     KAPI_FM_READ_AUX
        BCC     LOAD_DETECT_READ_END
        STA     LOAD_PREFETCH+2
        LDA     #$03
        STA     LOAD_PREFETCH_COUNT
        LDA     LOAD_PREFETCH+2
        CMP     #$83
        BNE     LOAD_DETECT_OK

        LDA     #LOAD_ENCODING_HISTORY
        STA     LOAD_ENCODING
        LDA     #$00
        STA     LOAD_PREFETCH_COUNT
        STA     LOAD_PREFETCH_INDEX
LOAD_DETECT_OK
        CLC
        RTS

LOAD_DETECT_READ_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BEQ     LOAD_DETECT_OK
        SEC
        RTS

; C=1/A=next physical byte.  Prefetched non-magic bytes are returned before
; resuming File Manager reads.
LOAD_GET_BYTE
        LDX     LOAD_PREFETCH_INDEX
        CPX     LOAD_PREFETCH_COUNT
        BCS     LOAD_GET_FILE
        LDA     LOAD_PREFETCH,X
        INC     LOAD_PREFETCH_INDEX
        SEC
        RTS
LOAD_GET_FILE
        JMP     KAPI_FM_READ_AUX

; Return one UTF-16 code unit from either source representation.
; C=1: CP_HI:CP_LO valid. Escaped surrogate pairs are returned as two units.
; C=0: EOF / real read error, DOS_LAST_RC identifies which.
LOAD_NEXT_CODEPOINT
        LDA     LOAD_ENCODING
        CMP     #LOAD_ENCODING_HISTORY
        BEQ     LOAD_NEXT_HISTORY

LOAD_NEXT_DOS
        JSR     LOAD_GET_BYTE
        BCC     LOAD_NEXT_DONE
        AND     #$7F
        BEQ     LOAD_NEXT_ZERO_EOF
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        SEC
LOAD_NEXT_DONE
        RTS

LOAD_NEXT_ZERO_EOF
        LDA     #FM_END_DATA
        STA     DOS_LAST_RC
        CLC
        RTS

LOAD_NEXT_HISTORY
        JSR     LOAD_GET_BYTE
        BCC     LOAD_NEXT_DONE
        BEQ     LOAD_NEXT_ZERO_EOF
        AND     #$7F
        CMP     #$5C                    ; backslash
        BEQ     LOAD_HISTORY_ESCAPE

        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        SEC
        RTS

LOAD_HISTORY_ESCAPE
        JSR     LOAD_GET_BYTE
        BCC     LOAD_HISTORY_INVALID
        AND     #$7F
        CMP     #$5C
        BEQ     LOAD_HISTORY_BACKSLASH
        CMP     #'u'
        BNE     LOAD_HISTORY_INVALID

        LDA     #$00
        STA     CP_LO
        STA     CP_HI
        LDA     #$04
        STA     ESC_DIGITS

LOAD_HISTORY_HEX_LOOP
        JSR     LOAD_GET_BYTE
        BCC     LOAD_HISTORY_INVALID
        AND     #$7F
        JSR     LOAD_HEX_NIBBLE
        BCC     LOAD_HISTORY_INVALID
        STA     HEX_TEMP

        ASL     CP_LO
        ROL     CP_HI
        ASL     CP_LO
        ROL     CP_HI
        ASL     CP_LO
        ROL     CP_HI
        ASL     CP_LO
        ROL     CP_HI

        LDA     CP_LO
        ORA     HEX_TEMP
        STA     CP_LO

        DEC     ESC_DIGITS
        BNE     LOAD_HISTORY_HEX_LOOP
        SEC
        RTS

LOAD_HISTORY_BACKSLASH
        LDA     #$5C
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        SEC
        RTS

LOAD_HISTORY_INVALID
        LDA     #'?'
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        SEC
        RTS

; A=ASCII hex digit. C=1/A=0..15 when valid, C=0 otherwise.
LOAD_HEX_NIBBLE
        CMP     #'0'
        BCC     LOAD_HEX_BAD
        CMP     #$3A
        BCC     LOAD_HEX_DEC
        CMP     #'A'
        BCC     LOAD_HEX_LOWER
        CMP     #$47
        BCC     LOAD_HEX_UPPER
LOAD_HEX_LOWER
        CMP     #'a'
        BCC     LOAD_HEX_BAD
        CMP     #$67
        BCS     LOAD_HEX_BAD
        SEC
        SBC     #$57
        SEC
        RTS
LOAD_HEX_UPPER
        SEC
        SBC     #$37
        SEC
        RTS
LOAD_HEX_DEC
        SEC
        SBC     #'0'
        SEC
        RTS
LOAD_HEX_BAD
        CLC
        RTS

LOAD_LIMIT_REACHED
        LDA     LOAD_COUNT_HI
        CMP     #LOAD_LIMIT_HI
        BCC     LOAD_LIMIT_NO
        BNE     LOAD_LIMIT_YES
        LDA     LOAD_COUNT_LO
        CMP     #LOAD_LIMIT_LO
        BCC     LOAD_LIMIT_NO
LOAD_LIMIT_YES
        SEC
        RTS
LOAD_LIMIT_NO
        CLC
        RTS

INC_LOAD_COUNT
        INC     LOAD_COUNT_LO
        BNE     INC_LOAD_DONE
        INC     LOAD_COUNT_HI
INC_LOAD_DONE
        RTS

SEND_LINE_SEPARATOR
        LDA     #$28                    ; U+2028 UTF-16LE low byte
        JSR     KAPI_SERIAL_TX_BYTE
        LDA     #$20
        JSR     KAPI_SERIAL_TX_BYTE
        RTS

HANDLE_PENDING_LOADS
HANDLE_PENDING_LOOP
        LDA     PENDING_LOAD
        BEQ     HANDLE_PENDING_DONE
        LDA     AUTO_ACTION_BUDGET
        BEQ     HANDLE_PENDING_DROP
        DEC     AUTO_ACTION_BUDGET
        LDA     #$00
        STA     PENDING_LOAD
        JSR     COPY_PENDING_TO_AUX_NAME
        JSR     COPY_PENDING_TO_NAME_INPUT
        JSR     ENSURE_LINE_START
        JSR     LOAD_AUX_AS_GPT_REQUEST
        BCS     HANDLE_PENDING_ERROR
        JSR     HISTORY_COMMIT_REOPEN
        JSR     RECEIVE_GPT16
        JMP     HANDLE_PENDING_LOOP
HANDLE_PENDING_DROP
        LDA     #$00
        STA     PENDING_LOAD
HANDLE_PENDING_DONE
        RTS
HANDLE_PENDING_ERROR
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        RTS

; =============================================================================
; GPT STARTUP BRIEFING AND GPT->APPLE FILE CONTROLS
; =============================================================================

SEND_GPT_BRIEFING
        LDX     #<GPT_BRIEFING
        LDY     #>GPT_BRIEFING
        JSR     SEND_Z_UTF16
        LDA     #KEY_CR
        JSR     KAPI_SEND_UTF16_ASCII
        RTS

SEND_Z_UTF16
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
SEND_Z_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     SEND_Z_DONE
        JSR     KAPI_SEND_UTF16_ASCII
        INY
        BNE     SEND_Z_LOOP
        INC     MSG_ZPH
        JMP     SEND_Z_LOOP
SEND_Z_DONE
        RTS

SEND_NAME_INPUT_UTF16
        LDA     #$00
        STA     LOOP_INDEX
SEND_NAME_UTF16_LOOP
        LDX     LOOP_INDEX
        CPX     NAME_LEN
        BEQ     SEND_NAME_UTF16_DONE
        LDA     NAME_INPUT,X
        JSR     KAPI_SEND_UTF16_ASCII
        INC     LOOP_INDEX
        JMP     SEND_NAME_UTF16_LOOP
SEND_NAME_UTF16_DONE
        RTS

; -----------------------------------------------------------------------------
; V5.7 printable [[A2:...]] control-line parser.
;
; Candidate lines are intercepted only when the first character is '[' at
; display column zero.  Until CR/LF arrives, bytes are buffered rather than
; displayed/written.  Valid tokens execute local file controls and disappear.
; Invalid candidates are replayed byte-for-byte through PROCESS_NORMAL.
;
; Accepted forms:
;       [[A2:C:FILENAME]]
;       [[A2:E]]
;       [[A2:S]]
;       [[A2:S:FILENAME]]
;       [[A2:L:FILENAME]]
;
; A trailing type hint after the filename is tolerated for model robustness:
;       [[A2:C:HW:BAS]]  -> create HW
; -----------------------------------------------------------------------------

A2_CAPTURE_START
        LDA     #$01
        STA     A2_CAPTURE
        LDA     #$01
        STA     A2_LEN
        LDA     #'['
        STA     A2_BUF
        RTS

; C=1 current CP consumed by the A2 candidate path.
; C=0 buffered candidate was ordinary text; caller must process current CP.
A2_CAPTURE_CHAR
        ; Preserve the current code point because an invalid candidate replay
        ; uses CP_LO/CP_HI internally.
        LDA     CP_LO
        STA     A2_PENDING_LO
        LDA     CP_HI
        STA     A2_PENDING_HI

        ; Non-ASCII cannot be part of a control token.
        LDA     CP_HI
        BNE     A2_CAPTURE_REPLAY_CURRENT

        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     A2_CAPTURE_EOL
        CMP     #$0A
        BEQ     A2_CAPTURE_EOL

        ; A2 tokens are printable ASCII only.
        CMP     #$20
        BCC     A2_CAPTURE_REPLAY_CURRENT
        CMP     #$7F
        BCS     A2_CAPTURE_REPLAY_CURRENT

        LDX     A2_LEN
        CPX     #A2_CAPTURE_MAX
        BCS     A2_CAPTURE_REPLAY_CURRENT
        STA     A2_BUF,X
        INC     A2_LEN
        SEC
        RTS

A2_CAPTURE_EOL
        JSR     A2_PARSE_BUFFER
        BCC     A2_CAPTURE_EOL_INVALID

        ; Valid control line: suppress its terminator as well.  Mark CR so a
        ; possible following LF is swallowed by normal CR/LF semantics.
        LDA     A2_PENDING_LO
        CMP     #KEY_CR
        BNE     A2_CAPTURE_VALID_LF
        LDA     #$01
        STA     LAST_CR
        JMP     A2_CAPTURE_VALID_DONE
A2_CAPTURE_VALID_LF
        LDA     #$00
        STA     LAST_CR
A2_CAPTURE_VALID_DONE
        LDA     #$00
        STA     A2_CAPTURE
        STA     A2_LEN
        SEC
        RTS

A2_CAPTURE_EOL_INVALID
        JSR     A2_FLUSH_BUFFER
        LDA     A2_PENDING_LO
        STA     CP_LO
        LDA     A2_PENDING_HI
        STA     CP_HI
        CLC
        RTS

A2_CAPTURE_REPLAY_CURRENT
        JSR     A2_FLUSH_BUFFER
        LDA     A2_PENDING_LO
        STA     CP_LO
        LDA     A2_PENDING_HI
        STA     CP_HI
        CLC
        RTS

; Replay a failed candidate through exactly the same normal response path.
A2_FLUSH_BUFFER
        LDA     #$00
        STA     A2_CAPTURE
        LDX     #$00
A2_FLUSH_LOOP
        CPX     A2_LEN
        BEQ     A2_FLUSH_DONE
        LDA     A2_BUF,X
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        TXA
        PHA
        JSR     PROCESS_NORMAL
        PLA
        TAX
        INX
        JMP     A2_FLUSH_LOOP
A2_FLUSH_DONE
        LDA     #$00
        STA     A2_LEN
        RTS

; Parse/execute A2_BUF[0..A2_LEN-1].
; C=1 valid token executed, C=0 ordinary/non-token line.
A2_PARSE_BUFFER
        LDX     A2_LEN
        CPX     #$08
        BCS     A2_PARSE_LEN_OK
        JMP     A2_PARSE_BAD
A2_PARSE_LEN_OK

        ; Closing brackets must terminate the candidate line.
        DEX
        LDA     A2_BUF,X
        CMP     #']'
        BEQ     A2_PARSE_LAST_OK
        JMP     A2_PARSE_BAD
A2_PARSE_LAST_OK
        DEX
        LDA     A2_BUF,X
        CMP     #']'
        BEQ     A2_PARSE_CLOSE_OK
        JMP     A2_PARSE_BAD
A2_PARSE_CLOSE_OK
        STX     A2_BODY_END

        LDA     A2_BUF
        CMP     #'['
        BEQ     A2_PARSE_P0_OK
        JMP     A2_PARSE_BAD
A2_PARSE_P0_OK
        LDA     A2_BUF+1
        CMP     #'['
        BEQ     A2_PARSE_P1_OK
        JMP     A2_PARSE_BAD
A2_PARSE_P1_OK
        LDA     A2_BUF+2
        JSR     ASCII_TO_UPPER
        CMP     #'A'
        BEQ     A2_PARSE_P2_OK
        JMP     A2_PARSE_BAD
A2_PARSE_P2_OK
        LDA     A2_BUF+3
        CMP     #'2'
        BEQ     A2_PARSE_P3_OK
        JMP     A2_PARSE_BAD
A2_PARSE_P3_OK
        LDA     A2_BUF+4
        CMP     #':'
        BEQ     A2_PARSE_PREFIX_OK
        JMP     A2_PARSE_BAD
A2_PARSE_PREFIX_OK

        LDA     A2_BUF+5
        JSR     ASCII_TO_UPPER
        STA     GPT_CTRL_COMMAND_CODE
        CMP     #'E'
        BEQ     A2_PARSE_END
        CMP     #'C'
        BEQ     A2_PARSE_NAMED
        CMP     #'S'
        BEQ     A2_PARSE_SAVE
        CMP     #'L'
        BEQ     A2_PARSE_NAMED
        JMP     A2_PARSE_BAD

A2_PARSE_END
        ; [[A2:E]] has no fields after command byte.
        LDA     A2_BODY_END
        CMP     #$06
        BEQ     A2_PARSE_END_OK
        JMP     A2_PARSE_BAD
A2_PARSE_END_OK
        JSR     GPT_CLOSE_CAPTURE_FILE
        SEC
        RTS

A2_PARSE_SAVE
        ; Bare [[A2:S]] selects CHAT-HISTORY through existing default logic.
        LDA     A2_BODY_END
        CMP     #$06
        BNE     A2_PARSE_NAMED
        LDA     #$00
        STA     GPT_CTRL_NAME_LEN
        JSR     GPT_EXEC_CONTROL
        SEC
        RTS

A2_PARSE_NAMED
        ; Named commands require ':' immediately after C/S/L.
        LDA     A2_BODY_END
        CMP     #$08
        BCS     A2_PARSE_NAMED_LEN_OK
        JMP     A2_PARSE_BAD
A2_PARSE_NAMED_LEN_OK
        LDA     A2_BUF+6
        CMP     #':'
        BEQ     A2_PARSE_COLON_OK
        JMP     A2_PARSE_BAD
A2_PARSE_COLON_OK

        LDA     #$00
        STA     GPT_CTRL_NAME_LEN
        LDY     #$07

A2_PARSE_NAME_LOOP
        CPY     A2_BODY_END
        BCS     A2_PARSE_NAME_DONE
        LDA     A2_BUF,Y

        ; A model may append :BAS/:TXT/etc.  The first colon after the actual
        ; filename starts an ignored hint rather than becoming part of the DOS
        ; filename.
        CMP     #':'
        BEQ     A2_PARSE_NAME_SKIP_SUFFIX

        CMP     #$20
        BCS     A2_PARSE_NAME_LOW_OK
        JMP     A2_PARSE_BAD
A2_PARSE_NAME_LOW_OK
        CMP     #$7F
        BCC     A2_PARSE_NAME_HIGH_OK
        JMP     A2_PARSE_BAD
A2_PARSE_NAME_HIGH_OK

        JSR     ASCII_TO_UPPER
        LDX     GPT_CTRL_NAME_LEN
        CPX     #MAX_FILENAME
        BCC     A2_PARSE_NAME_ROOM
        JMP     A2_PARSE_BAD
A2_PARSE_NAME_ROOM
        STA     GPT_CTRL_NAME,X
        INC     GPT_CTRL_NAME_LEN
        INY
        JMP     A2_PARSE_NAME_LOOP

A2_PARSE_NAME_SKIP_SUFFIX
        ; A suffix is tolerated only as ignored printable text up to the final ]].
        INY
A2_PARSE_SUFFIX_LOOP
        CPY     A2_BODY_END
        BCS     A2_PARSE_NAME_DONE
        LDA     A2_BUF,Y
        CMP     #$20
        BCS     A2_PARSE_SUFFIX_LOW_OK
        JMP     A2_PARSE_BAD
A2_PARSE_SUFFIX_LOW_OK
        CMP     #$7F
        BCC     A2_PARSE_SUFFIX_HIGH_OK
        JMP     A2_PARSE_BAD
A2_PARSE_SUFFIX_HIGH_OK
        INY
        JMP     A2_PARSE_SUFFIX_LOOP

A2_PARSE_NAME_DONE
        LDA     GPT_CTRL_NAME_LEN
        BNE     A2_PARSE_EXEC
        LDA     GPT_CTRL_COMMAND_CODE
        CMP     #'S'
        BEQ     A2_PARSE_EXEC
        JMP     A2_PARSE_BAD
A2_PARSE_EXEC
        JSR     GPT_EXEC_CONTROL
        SEC
        RTS

A2_PARSE_BAD
        CLC
        RTS

GPT_CONTROL_START
        LDA     #$01
        STA     GPT_CTRL_STATE
        LDA     #$00
        STA     GPT_CTRL_NAME_LEN
        RTS

; Called only while GPT_CTRL_STATE != 0. C=1 means consumed as protocol.
GPT_CONTROL_CHAR
        LDA     GPT_CTRL_STATE
        CMP     #$01
        BEQ     GPT_CTRL_COMMAND
        CMP     #$02
        BEQ     GPT_CTRL_FILENAME
        CMP     #$03
        BNE     GPT_CTRL_BAD_STATE
        JMP     GPT_CTRL_DISCARD_EOL
GPT_CTRL_BAD_STATE
        SEC
        RTS

GPT_CTRL_COMMAND
        LDA     CP_HI
        BNE     GPT_CTRL_ABORT
        LDA     CP_LO
        JSR     ASCII_TO_UPPER
        CMP     #'C'
        BEQ     GPT_CTRL_SET_COMMAND
        CMP     #'S'
        BEQ     GPT_CTRL_SET_COMMAND
        CMP     #'L'
        BEQ     GPT_CTRL_SET_COMMAND
        CMP     #'E'
        BEQ     GPT_CTRL_SET_END
GPT_CTRL_ABORT
        LDA     #$00
        STA     GPT_CTRL_STATE
        SEC
        RTS
GPT_CTRL_SET_COMMAND
        STA     GPT_CTRL_COMMAND_CODE
        LDA     #$02
        STA     GPT_CTRL_STATE
        SEC
        RTS
GPT_CTRL_SET_END
        LDA     #'E'
        STA     GPT_CTRL_COMMAND_CODE
        LDA     #$03
        STA     GPT_CTRL_STATE
        JSR     GPT_CLOSE_CAPTURE_FILE
        SEC
        RTS

GPT_CTRL_FILENAME
        LDA     CP_HI
        BNE     GPT_CTRL_FILENAME_CONSUMED
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     GPT_CTRL_FILENAME_DONE
        CMP     #$0A
        BEQ     GPT_CTRL_FILENAME_DONE
        CMP     #$20
        BCC     GPT_CTRL_FILENAME_CONSUMED
        CMP     #$7F
        BCS     GPT_CTRL_FILENAME_CONSUMED
        JSR     ASCII_TO_UPPER
        LDX     GPT_CTRL_NAME_LEN
        CPX     #MAX_FILENAME
        BCS     GPT_CTRL_FILENAME_CONSUMED
        STA     GPT_CTRL_NAME,X
        INC     GPT_CTRL_NAME_LEN
GPT_CTRL_FILENAME_CONSUMED
        SEC
        RTS

GPT_CTRL_FILENAME_DONE
        JSR     GPT_EXEC_CONTROL
        LDA     #$03
        STA     GPT_CTRL_STATE
        SEC
        RTS

GPT_CTRL_DISCARD_EOL
        LDA     CP_HI
        BNE     GPT_CTRL_EOL_KEEP
        LDA     CP_LO
        CMP     #$0A
        BEQ     GPT_CTRL_EOL_CONSUMED
        CMP     #KEY_CR
        BEQ     GPT_CTRL_EOL_CONSUMED
GPT_CTRL_EOL_KEEP
        LDA     #$00
        STA     GPT_CTRL_STATE
        CLC                             ; reprocess as normal response char
        RTS
GPT_CTRL_EOL_CONSUMED
        LDA     #$00
        STA     GPT_CTRL_STATE
        SEC
        RTS

GPT_EXEC_CONTROL
        LDA     GPT_CTRL_COMMAND_CODE
        CMP     #'C'
        BEQ     GPT_EXEC_CREATE
        CMP     #'S'
        BEQ     GPT_EXEC_SAVE
        CMP     #'L'
        BEQ     GPT_EXEC_LOAD
        RTS

GPT_EXEC_CREATE
        LDA     GPT_CTRL_NAME_LEN
        BEQ     GPT_EXEC_DONE
        JSR     COPY_CTRL_TO_AUX_NAME
        LDA     AUX_OPEN
        BEQ     GPT_CREATE_OPEN
        JSR     KAPI_FM_EOF_CLOSE_AUX
        BCS     GPT_CREATE_DOS_ERROR
        LDA     #$00
        STA     AUX_OPEN
GPT_CREATE_OPEN
        JSR     KAPI_FM_CREATE_AUX
        BCS     GPT_CREATE_DOS_ERROR
        LDA     #$01
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
        JSR     SAVE_GPT_FILE_NAME
        LDX     #FILE_TARGET_AUX
        LDA     #$00
        STA     ENC_LAST_CR,X
        RTS
GPT_CREATE_DOS_ERROR
        LDA     #$00
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        RTS

GPT_EXEC_SAVE
        LDA     GPT_CTRL_NAME_LEN
        BNE     GPT_SAVE_NAME_READY
        JSR     SET_CTRL_DEFAULT_HISTORY_NAME
GPT_SAVE_NAME_READY
        JSR     COPY_CTRL_TO_SAVE_NAME
        JSR     SAVE_REOPEN_NEW
        RTS

GPT_EXEC_LOAD
        LDA     GPT_CTRL_NAME_LEN
        BEQ     GPT_EXEC_DONE
        JSR     COPY_CTRL_TO_PENDING_NAME
        LDA     #$01
        STA     PENDING_LOAD
GPT_EXEC_DONE
        RTS

GPT_CLOSE_CAPTURE_FILE
        LDA     GPT_FILE_ACTIVE
        BEQ     GPT_CLOSE_DONE
        JSR     KAPI_FM_EOF_CLOSE_AUX
        BCS     GPT_CLOSE_FAILED
        LDA     #$00
        STA     GPT_FILE_ACTIVE
        STA     AUX_OPEN
        JSR     REPORT_GPT_FILE_WRITTEN
GPT_CLOSE_DONE
        RTS

GPT_CLOSE_FAILED
        ; FM_EOF_CLOSE_AUX preserves the failing return code in DOS_LAST_RC.
        ; Surface it instead of making a real disk error look like missing A2.
        LDA     #$00
        STA     GPT_FILE_ACTIVE
        STA     AUX_OPEN
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        RTS

SAVE_GPT_FILE_NAME
        LDA     GPT_CTRL_NAME_LEN
        STA     GPT_FILE_NAME_LEN
        LDX     #$00
SAVE_GPT_FILE_NAME_LOOP
        CPX     GPT_CTRL_NAME_LEN
        BEQ     SAVE_GPT_FILE_NAME_DONE
        LDA     GPT_CTRL_NAME,X
        STA     GPT_FILE_NAME,X
        INX
        JMP     SAVE_GPT_FILE_NAME_LOOP
SAVE_GPT_FILE_NAME_DONE
        RTS

; Local status emitted only after a GPT-created text file has closed cleanly.
; It is also appended to an active chat-history SAVE file so LOAD reproduces the
; same useful completion notice.
REPORT_GPT_FILE_WRITTEN
        LDA     RX_SILENT
        BNE     REPORT_GPT_FILE_DONE
        JSR     ENSURE_LINE_START

        LDX     #<TXT_RUN_PREFIX
        LDY     #>TXT_RUN_PREFIX
        JSR     KAPI_PRINT_SCREEN_STRING
        LDA     #'"'
        JSR     KAPI_WRITE_GLYPH
        LDX     #<TXT_EXEC_PREFIX
        LDY     #>TXT_EXEC_PREFIX
        JSR     KAPI_PRINT_SCREEN_STRING
        LDX     #$00
REPORT_GPT_FILE_SCREEN_NAME
        CPX     GPT_FILE_NAME_LEN
        BEQ     REPORT_GPT_FILE_SCREEN_END
        LDA     GPT_FILE_NAME,X
        JSR     KAPI_WRITE_GLYPH
        INX
        JMP     REPORT_GPT_FILE_SCREEN_NAME
REPORT_GPT_FILE_SCREEN_END
        LDA     #'"'
        JSR     KAPI_WRITE_GLYPH
        LDA     #']'
        JSR     KAPI_WRITE_GLYPH
        JSR     KAPI_NEWLINE

        LDX     #<TXT_RUN_PREFIX
        LDY     #>TXT_RUN_PREFIX
        JSR     HISTORY_WRITE_Z
        LDA     #'"'
        JSR     HISTORY_WRITE_ASCII
        LDX     #<TXT_EXEC_PREFIX
        LDY     #>TXT_EXEC_PREFIX
        JSR     HISTORY_WRITE_Z
        LDX     #$00
REPORT_GPT_FILE_HISTORY_NAME
        CPX     GPT_FILE_NAME_LEN
        BEQ     REPORT_GPT_FILE_HISTORY_END
        LDA     GPT_FILE_NAME,X
        JSR     HISTORY_WRITE_ASCII
        INX
        JMP     REPORT_GPT_FILE_HISTORY_NAME
REPORT_GPT_FILE_HISTORY_END
        LDA     #'"'
        JSR     HISTORY_WRITE_ASCII
        LDA     #']'
        JSR     HISTORY_WRITE_ASCII
        LDA     #KEY_CR
        JSR     HISTORY_WRITE_ASCII
REPORT_GPT_FILE_DONE
        RTS

GPT_FILE_WRITE_CP
        LDA     GPT_FILE_ACTIVE
        BEQ     GPT_FILE_WRITE_DONE
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        JSR     KAPI_FILE_ENCODE_CP
GPT_FILE_WRITE_DONE
        RTS

GPT_FILE_WRITE_SURROGATE
        LDA     GPT_FILE_ACTIVE
        BEQ     GPT_FILE_SURR_DONE
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        JSR     KAPI_FILE_ENCODE_SURROGATE
GPT_FILE_SURR_DONE
        RTS

; =============================================================================
; SCREEN STRING / DOS STATUS HELPERS
; =============================================================================

; V6.09 diagnostic marker. X/Y point at a zero-terminated screen string.
; VideoTerm only: this routine never transmits a Serial Pro byte.
DIAG_MARK
        JSR     ENSURE_LINE_START
        JSR     KAPI_PRINT_SCREEN_STRING
        JSR     KAPI_NEWLINE
        RTS


        RTS

PRINT_NAME_INPUT_SCREEN
        LDA     #$00
        STA     LOOP_INDEX
PRINT_NAME_SCREEN_LOOP
        LDX     LOOP_INDEX
        CPX     NAME_LEN
        BEQ     PRINT_NAME_SCREEN_DONE
        LDA     NAME_INPUT,X
        JSR     KAPI_WRITE_GLYPH
        INC     LOOP_INDEX
        JMP     PRINT_NAME_SCREEN_LOOP
PRINT_NAME_SCREEN_DONE
        RTS

SHOW_DOS_ERROR_KEEP_INPUT
        JSR     ENSURE_LINE_START
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        JSR     PRINT_USER_PROMPT
        JSR     INPUT_ITER_RESET
SHOW_REPRINT_INPUT
        JSR     INPUT_NEXT_CHAR
        BCC     SHOW_KEEP_DONE
        JSR     KAPI_WRITE_GLYPH
        JMP     SHOW_REPRINT_INPUT
SHOW_KEEP_DONE
        RTS

SHOW_DOS_ERROR_AND_PROMPT
        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI
        JSR     ENSURE_LINE_START
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        JSR     PRINT_USER_PROMPT
        RTS

SHOW_DOS_ERROR_NO_PROMPT
        LDX     #<TXT_DOS_ERROR
        LDY     #>TXT_DOS_ERROR
        JSR     KAPI_PRINT_SCREEN_STRING
        LDA     DOS_LAST_RC
        JSR     KAPI_PRINT_HEX_BYTE
        JSR     KAPI_NEWLINE
        RTS


CLOSE_ALL_FILES
        LDA     GPT_FILE_ACTIVE
        BEQ     CLOSE_NO_GPT_FILE
        JSR     GPT_CLOSE_CAPTURE_FILE
CLOSE_NO_GPT_FILE
        LDA     AUX_OPEN
        BEQ     CLOSE_NO_AUX
        JSR     KAPI_FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
CLOSE_NO_AUX
        LDA     SAVE_ACTIVE
        BEQ     CLOSE_ALL_DONE
        JSR     HISTORY_CLOSE_PRESERVE
CLOSE_ALL_DONE
        RTS

; =============================================================================
; APPLESOFT &GPT RESIDENT BRIDGE
; =============================================================================
;
; Applesoft token $AF (&) dispatches through the three-byte JMP vector at $03F5.
; Selecting [&] from the menu preserves that JMP and installs AMP_GPT_HANDLER.
; Non-GPT uses are chained byte-for-byte to the previous vector, which is
; important because DOS/Applesoft may also rely on $03F5.
;
; Unquoted Applesoft source is tokenized before this hook is called; spaces are
; removed by Applesoft. V5.9 detokenizes keyword bytes, but cannot reconstruct
; discarded spaces. Quoted &GPT text is therefore the lossless form.
;

INSTALL_AMP_GPT
        LDA     AMP_INSTALLED
        BNE     INSTALL_AMP_DONE

        LDA     APPLESOFT_AMP
        STA     AMP_OLD_VECTOR
        LDA     APPLESOFT_AMP+1
        STA     AMP_OLD_VECTOR+1
        LDA     APPLESOFT_AMP+2
        STA     AMP_OLD_VECTOR+2

        LDA     #$4C                    ; JMP AMP_GPT_HANDLER
        STA     APPLESOFT_AMP
        LDA     #<AMP_GPT_HANDLER
        STA     APPLESOFT_AMP+1
        LDA     #>AMP_GPT_HANDLER
        STA     APPLESOFT_AMP+2
        LDA     #$01
        STA     AMP_INSTALLED
INSTALL_AMP_DONE
        RTS

AMP_GPT_HANDLER
        ; Preserve the exact Applesoft entry machine state before touching it.
        ; PHA does not alter flags, so PHP still captures the entry status.
        PHA
        PHP
        PLA
        STA     AMP_ENTRY_P
        PLA
        STA     AMP_ENTRY_A
        STX     AMP_ENTRY_X
        STY     AMP_ENTRY_Y
        CLD

        ; Preserve caller-owned scratch zero page.  The main application freely
        ; uses $F0-$F3 while the resident bridge is active.
        LDA     MSG_ZPL
        STA     AMP_SAVE_ZP_LO
        LDA     MSG_ZPH
        STA     AMP_SAVE_ZP_HI
        LDA     FM_ZPL
        STA     AMP_SAVE_FM_LO
        LDA     FM_ZPH
        STA     AMP_SAVE_FM_HI

        ; At command dispatch TXTPTR already points to the first byte after '&'.
        ; Use FM_ZP as a read-only cursor so a failed GPT match can chain with
        ; Applesoft's parser state untouched.
        LDA     AS_TXTPTR_LO
        STA     FM_ZPL
        LDA     AS_TXTPTR_HI
        STA     FM_ZPH
        LDY     #$00
        JSR     AMP_SKIP_SPACES

        LDA     (FM_ZPL),Y
        JSR     ASCII_TO_UPPER
        CMP     #'G'
        BNE     AMP_MATCH_FAIL
        INY
        LDA     (FM_ZPL),Y
        JSR     ASCII_TO_UPPER
        CMP     #'P'
        BNE     AMP_MATCH_FAIL
        INY
        LDA     (FM_ZPL),Y
        JSR     ASCII_TO_UPPER
        CMP     #'T'
        BEQ     AMP_MATCH_OK
AMP_MATCH_FAIL
        JMP     AMP_CHAIN_OLD
AMP_MATCH_OK
        INY

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI

        ; A quoted prompt survives Applesoft tokenization with spaces intact.
        LDA     (FM_ZPL),Y
        CMP     #'"'
        BNE     AMP_COPY_COMPACT
        INY
AMP_COPY_QUOTED_LOOP
        LDA     (FM_ZPL),Y
        BEQ     AMP_COPY_FINISH
        CMP     #'"'
        BEQ     AMP_COPY_QUOTED_END
        JSR     AMP_APPEND_CHAR
        INY
        BNE     AMP_COPY_QUOTED_LOOP
        JMP     AMP_COPY_FINISH
AMP_COPY_QUOTED_END
        INY
        JMP     AMP_SKIP_TO_STATEMENT_END

AMP_COPY_COMPACT
        LDA     (FM_ZPL),Y
        BEQ     AMP_COPY_FINISH
        CMP     #':'
        BEQ     AMP_COPY_FINISH
        CMP     #$80
        BCC     AMP_COPY_ASCII

        STY     AMP_SCAN_INDEX
        JSR     AMP_APPEND_TOKEN
        LDY     AMP_SCAN_INDEX
        INY
        BNE     AMP_COPY_COMPACT
        JMP     AMP_COPY_FINISH

AMP_COPY_ASCII
        JSR     AMP_APPEND_CHAR
        INY
        BNE     AMP_COPY_COMPACT

AMP_SKIP_TO_STATEMENT_END
        LDA     (FM_ZPL),Y
        BEQ     AMP_COPY_FINISH
        CMP     #':'
        BEQ     AMP_COPY_FINISH
        INY
        BNE     AMP_SKIP_TO_STATEMENT_END

AMP_COPY_FINISH
        ; Consume this &GPT clause by leaving Applesoft TXTPTR on its ':' or $00
        ; terminator.  This also permits a following colon-separated statement.
        TYA
        CLC
        ADC     FM_ZPL
        STA     AS_TXTPTR_LO
        LDA     FM_ZPH
        ADC     #$00
        STA     AS_TXTPTR_HI

        LDA     INPUT_COUNT_LO
        ORA     INPUT_COUNT_HI
        BNE     AMP_INLINE_GPT
        JMP     AMP_RUN_APP

AMP_INLINE_GPT
        ; Applesoft has already accepted the direct command's RETURN before the
        ; ampersand hook runs, so VideoTerm is already positioned at the start of
        ; the line below the &GPT command.  V5.93 sent an additional COUT CR here,
        ; producing the blank row seen between command and reply.  Import the
        ; firmware position exactly as Applesoft left it; do not advance it.
        JSR     KAPI_IMPORT_VIDEX_FIRMWARE
        JSR     KAPI_SET_HW_CURSOR

        ; RESTORE_APP_ZP gave $F2/$F3 back to Applesoft on ESC-Q.  Reacquire
        ; DOS's File Manager parameter-list pointer *after* COUT, so no DOS
        ; output-side scratch work can invalidate the pointer used below.
        JSR     DOS_LOC_FPL
        STY     FM_ZPL
        STA     FM_ZPH

        JSR     AMP_OPEN_CONFIGURED_SAVE

        JSR     SEND_INPUT_BUFFER
        JSR     HISTORY_WRITE_USER_BUFFER
        JSR     HISTORY_COMMIT_REOPEN

        ; In resident &GPT mode, hold CR pending until another reply character
        ; proves it is an internal line break.  A trailing response CR is left
        ; unrendered because Applesoft supplies the newline when this hook returns.
        LDA     #$01
        STA     AMP_RX_MODE
        LDA     #$00
        STA     AMP_PENDING_CR

        LDA     #AUTO_LOAD_MAX
        STA     AUTO_ACTION_BUDGET
        JSR     RECEIVE_GPT16
        JSR     HANDLE_PENDING_LOADS

        LDA     #$00
        STA     AMP_RX_MODE
        STA     AMP_PENDING_CR

        ; Do NOT ENSURE_LINE_START here.  Leave the raw/firmware cursor at the
        ; end of the final GPT text.  Applesoft's normal statement-completion CR
        ; moves to the next row and prints its ']' Applesoft prompt there.

        ; Returning to Applesoft with a SAVE file left open would make subsequent
        ; DOS command use unnecessarily fragile. Commit EOF and keep its offset.
        JSR     HISTORY_CLOSE_PRESERVE
        JSR     KAPI_SET_HW_CURSOR

        ; Inline &GPT is complete.  Do not fall through into the bare-&GPT
        ; launcher below. Applesoft will perform its normal final CR and prompt.
        JMP     AMP_GPT_RETURN

; Bare &GPT is the resident launcher for the full-screen application. The hook's
; return address remains on the stack, so START's normal RTS returns directly to
; Applesoft after the user quits the app. Restore caller zero page before START
; captures it as the application's ownership baseline.
AMP_RUN_APP
        JSR     AMP_RESTORE_ZP
        JMP     START

AMP_GPT_RETURN
        JSR     AMP_RESTORE_ZP
        LDA     AMP_ENTRY_P
        PHA
        LDA     AMP_ENTRY_A
        LDX     AMP_ENTRY_X
        LDY     AMP_ENTRY_Y
        PLP
        RTS

AMP_CHAIN_OLD
        JSR     AMP_RESTORE_ZP
        LDA     AMP_ENTRY_P
        PHA
        LDA     AMP_ENTRY_A
        LDX     AMP_ENTRY_X
        LDY     AMP_ENTRY_Y
        PLP
        JMP     AMP_OLD_VECTOR

AMP_RESTORE_ZP
        LDA     AMP_SAVE_ZP_LO
        STA     MSG_ZPL
        LDA     AMP_SAVE_ZP_HI
        STA     MSG_ZPH
        LDA     AMP_SAVE_FM_LO
        STA     FM_ZPL
        LDA     AMP_SAVE_FM_HI
        STA     FM_ZPH
        RTS

AMP_SKIP_SPACES
        LDA     (FM_ZPL),Y
        CMP     #' '
        BNE     AMP_SKIP_SPACES_DONE
        INY
        BNE     AMP_SKIP_SPACES
AMP_SKIP_SPACES_DONE
        RTS

; Append A to the common 512-byte request buffer.
AMP_APPEND_CHAR
        PHA
        LDA     INPUT_COUNT_HI
        CMP     #$02
        BCS     AMP_APPEND_FULL
        LDX     INPUT_COUNT_LO
        LDA     INPUT_COUNT_HI
        BEQ     AMP_APPEND_PAGE0
        PLA
        STA     INPUT_BUF+$100,X
        JMP     AMP_APPEND_ADVANCE
AMP_APPEND_PAGE0
        PLA
        STA     INPUT_BUF,X
AMP_APPEND_ADVANCE
        INC     INPUT_COUNT_LO
        BNE     AMP_APPEND_DONE
        INC     INPUT_COUNT_HI
AMP_APPEND_DONE
        RTS
AMP_APPEND_FULL
        PLA
        RTS

; A = Applesoft token $80-$EA. Expand the ROM's high-bit-terminated token name
; table back into printable ASCII for GPT.
AMP_APPEND_TOKEN
        STA     AMP_TOKEN_BYTE
        SEC
        SBC     #$80
        STA     AMP_TOKEN_INDEX
        LDA     #<AS_TOKEN_NAMES
        STA     MSG_ZPL
        LDA     #>AS_TOKEN_NAMES
        STA     MSG_ZPH

AMP_TOKEN_SEEK
        LDA     AMP_TOKEN_INDEX
        BEQ     AMP_TOKEN_COPY
        LDY     #$00
AMP_TOKEN_SKIP_BYTES
        LDA     (MSG_ZPL),Y
        PHA
        JSR     AMP_TOKEN_PTR_INC
        PLA
        ASL     A
        BCC     AMP_TOKEN_SKIP_BYTES
        DEC     AMP_TOKEN_INDEX
        JMP     AMP_TOKEN_SEEK

AMP_TOKEN_COPY
        LDY     #$00
AMP_TOKEN_COPY_LOOP
        LDA     (MSG_ZPL),Y
        STA     AMP_TOKEN_BYTE
        AND     #$7F
        JSR     AMP_APPEND_CHAR
        JSR     AMP_TOKEN_PTR_INC
        LDA     AMP_TOKEN_BYTE
        ASL     A
        BCC     AMP_TOKEN_COPY_LOOP
        RTS

AMP_TOKEN_PTR_INC
        INC     MSG_ZPL
        BNE     AMP_TOKEN_PTR_DONE
        INC     MSG_ZPH
AMP_TOKEN_PTR_DONE
        RTS

; Open the configured history writer lazily at SAVE_POS. This routine is shared
; by the full-screen chat submit path and resident inline &GPT.
HISTORY_OPEN_CONFIGURED
AMP_OPEN_CONFIGURED_SAVE
        LDA     SAVE_CONFIGURED
        BEQ     AMP_OPEN_SAVE_DONE
        LDA     SAVE_ACTIVE
        BNE     AMP_OPEN_SAVE_DONE
        JSR     KAPI_FM_OPEN_SAVE_EXIST
        BCS     AMP_OPEN_SAVE_FAIL
        JSR     KAPI_FM_POSITION_SAVE
        BCS     AMP_OPEN_SAVE_FAIL_CLOSE
        LDA     #$01
        STA     SAVE_ACTIVE
AMP_OPEN_SAVE_DONE
        RTS
AMP_OPEN_SAVE_FAIL_CLOSE
        JSR     KAPI_FM_CLOSE_SAVE
AMP_OPEN_SAVE_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        RTS

; =============================================================================
; CARD DISCOVERY

; =============================================================================
; ROLLING GPT16 RESPONSE RECEIVER
; =============================================================================

RECEIVE_GPT16
        LDA     #$00
        STA     LAST_CR
        STA     GPT_CTRL_STATE
        STA     A2_CAPTURE
        STA     A2_LEN
        ; Each wire reply starts with no deferred ampersand line break.  This is
        ; harmless in the normal chat path where AMP_RX_MODE is zero.
        STA     AMP_PENDING_CR

        JSR     KAPI_SERIAL_RX_BLOCK
        STA     CP_LO
        JSR     KAPI_SERIAL_RX_BLOCK
        STA     CP_HI

RECEIVE_CODE_UNIT
        ; high surrogate $D800-$DBFF
        LDA     CP_HI
        CMP     #$D8
        BCC     RECEIVE_BMP
        CMP     #$DC
        BCS     RECEIVE_BMP

        LDA     CP_LO
        STA     HS_LO
        LDA     CP_HI
        STA     HS_HI
        JSR     KAPI_SERIAL_RX_BLOCK
        STA     LS_LO
        JSR     KAPI_SERIAL_RX_BLOCK
        STA     LS_HI

        LDA     RX_SILENT
        BNE     RECEIVE_NEXT

        JSR     HISTORY_WRITE_SURROGATE
        JSR     GPT_FILE_WRITE_SURROGATE
        JSR     MAP_SURROGATE
        BCC     RECEIVE_NEXT
        JSR     KAPI_WRITE_GLYPH
        JMP     RECEIVE_NEXT

RECEIVE_BMP
        LDA     RX_SILENT
        BNE     RECEIVE_NEXT
        JSR     PROCESS_BMP_CODEPOINT

RECEIVE_NEXT
        JSR     KAPI_SERIAL_RX_NEXT
        BCC     RECEIVE_DONE
        STA     CP_LO
        JSR     KAPI_SERIAL_RX_BLOCK
        STA     CP_HI
        JMP     RECEIVE_CODE_UNIT

RECEIVE_DONE
        LDA     RX_SILENT
        BNE     RECEIVE_DONE_RETURN

        ; A response normally ends in CR, but do not silently lose a partial
        ; bracket-candidate line if the serial response ends unexpectedly.
        LDA     A2_CAPTURE
        BEQ     RECEIVE_DONE_NO_A2
        JSR     A2_FLUSH_BUFFER
RECEIVE_DONE_NO_A2
        JSR     GPT_CLOSE_CAPTURE_FILE
RECEIVE_DONE_RETURN
        RTS

; -----------------------------------------------------------------------------
; CR/LF are terminal semantics, not glyph $0D/$0A.
; U+001B starts the V5 GPT file-control protocol.
; -----------------------------------------------------------------------------

PROCESS_BMP_CODEPOINT
        ; V5.94 &GPT trailing-CR suppression.  In ampersand mode a CR is not
        ; rendered immediately.  If another non-LF code unit follows, that proves
        ; the CR was an internal line break: realize one NEWLINE before processing
        ; the current unit.  If the serial reply simply ends, the pending CR is
        ; discarded and Applesoft supplies the final newline on return.
        LDA     AMP_RX_MODE
        BEQ     PROCESS_NO_AMP_PENDING
        LDA     AMP_PENDING_CR
        BEQ     PROCESS_NO_AMP_PENDING
        LDA     CP_HI
        BNE     PROCESS_FLUSH_AMP_CR
        LDA     CP_LO
        CMP     #$0A                    ; CRLF: let PROCESS_LF swallow LF; keep CR pending
        BEQ     PROCESS_NO_AMP_PENDING
PROCESS_FLUSH_AMP_CR
        JSR     KAPI_NEWLINE
        LDA     #$00
        STA     AMP_PENDING_CR
PROCESS_NO_AMP_PENDING

        ; Existing raw U+001B control sequence in progress.
        LDA     GPT_CTRL_STATE
        BEQ     PROCESS_CHECK_A2_ACTIVE
        JSR     GPT_CONTROL_CHAR
        BCS     PROCESS_BMP_DONE
        ; C=0 means the current code point follows a completed control and must
        ; be processed normally.

PROCESS_CHECK_A2_ACTIVE
        ; Printable V5.7 A2 token candidate in progress.  C=1 means this code
        ; point was consumed by the candidate parser.  C=0 means the candidate
        ; proved ordinary text and the current code point must be processed
        ; normally after the buffered prefix has been replayed.
        LDA     A2_CAPTURE
        BEQ     PROCESS_CHECK_ESC
        JSR     A2_CAPTURE_CHAR
        BCS     PROCESS_BMP_DONE
        JMP     PROCESS_NORMAL

PROCESS_CHECK_ESC
        LDA     CP_HI
        BNE     PROCESS_CHECK_A2_START
        LDA     CP_LO
        CMP     #KEY_ESC
        BNE     PROCESS_CHECK_A2_START
        JSR     GPT_CONTROL_START
        RTS

PROCESS_CHECK_A2_START
        ; Reserve [[A2:...]] only when it begins a physical response line.
        ; Other '[' characters pass through normally.  Candidate buffering lets
        ; malformed/non-protocol lines be replayed unchanged.
        LDA     CP_HI
        BNE     PROCESS_NORMAL
        LDA     CP_LO
        CMP     #'['
        BNE     PROCESS_NORMAL
        LDA     COLUMN
        BNE     PROCESS_NORMAL
        JSR     A2_CAPTURE_START
        RTS

PROCESS_NORMAL
        JSR     HISTORY_WRITE_CP
        JSR     GPT_FILE_WRITE_CP

        LDA     CP_HI
        BNE     PROCESS_NOT_NEWLINE
        LDA     CP_LO
        CMP     #$0D
        BEQ     PROCESS_CR
        CMP     #$0A
        BEQ     PROCESS_LF

PROCESS_NOT_NEWLINE
        LDA     #$00
        STA     LAST_CR
        JSR     MAP_BMP
        BCC     PROCESS_BMP_DONE
        JSR     KAPI_WRITE_GLYPH
PROCESS_BMP_DONE
        RTS

PROCESS_CR
        LDA     AMP_RX_MODE
        BEQ     PROCESS_CR_NORMAL
        ; Defer the physical newline until another reply character arrives.
        ; If this is the reply's terminal CR, it will never be materialized.
        LDA     #$01
        STA     AMP_PENDING_CR
        STA     LAST_CR
        RTS
PROCESS_CR_NORMAL
        JSR     KAPI_NEWLINE
        LDA     #$01
        STA     LAST_CR
        RTS

PROCESS_LF
        LDA     LAST_CR
        BEQ     PROCESS_LF_ONLY
        LDA     #$00
        STA     LAST_CR
        RTS
PROCESS_LF_ONLY
        JSR     KAPI_NEWLINE
        LDA     #$00
        STA     LAST_CR
        RTS

; =============================================================================
; UNICODE -> VIDEX:NORMAL
; =============================================================================
;
; Return:
;       C=1 A=glyph $00-$7F
;       C=0 unsupported
;
; =============================================================================

MAP_BMP
        ; U+0020..U+007E identity mapping.
        LDA     CP_HI
        BNE     MAP_BMP_NOT_ASCII

        LDA     CP_LO
        CMP     #$20
        BCC     MAP_BMP_FAIL

        CMP     #$7F
        BCS     MAP_BMP_FAIL

        SEC
        RTS

MAP_BMP_NOT_ASCII
        ; U+2408..U+240F -> visible glyphs $08..$0F.
        CMP     #$24
        BNE     MAP_BMP_SPECIAL

        LDA     CP_LO
        CMP     #$08
        BCC     MAP_BMP_SPECIAL

        CMP     #$10
        BCS     MAP_BMP_SPECIAL

        SEC
        RTS

MAP_BMP_SPECIAL
        LDA     CP_HI
        CMP     #$25
        BNE     MAP_BMP_FAIL

        LDX     #$00

MAP_BMP_TABLE_LOOP
        CPX     #BMP_COUNT
        BEQ     MAP_BMP_FAIL

        LDA     BMP_LOW,X
        CMP     CP_LO
        BEQ     MAP_BMP_TABLE_HIT

        INX
        JMP     MAP_BMP_TABLE_LOOP

MAP_BMP_TABLE_HIT
        TXA
        BEQ     MAP_BMP_GLYPH_07
        ORA     #$10
        SEC
        RTS
MAP_BMP_GLYPH_07
        LDA     #$07
        SEC
        RTS

MAP_BMP_FAIL
        CLC
        RTS

; -----------------------------------------------------------------------------
; Seven supplementary U+1FBxx glyphs used by VIDEX:NORMAL.
; high surrogate=$D83E, low surrogate=$DFxx.
; -----------------------------------------------------------------------------

MAP_SURROGATE
        LDA     HS_HI
        CMP     #$D8
        BNE     MAP_SURROGATE_FAIL

        LDA     HS_LO
        CMP     #$3E
        BNE     MAP_SURROGATE_FAIL

        LDA     LS_HI
        CMP     #$DF
        BNE     MAP_SURROGATE_FAIL

        LDX     #$00

MAP_SURROGATE_LOOP
        CPX     #SUP_COUNT
        BEQ     MAP_SURROGATE_FAIL

        LDA     SUP_LOW,X
        CMP     LS_LO
        BEQ     MAP_SURROGATE_HIT

        INX
        JMP     MAP_SURROGATE_LOOP

MAP_SURROGATE_HIT
        LDA     SUP_GLYPH,X
        SEC
        RTS

MAP_SURROGATE_FAIL
        CLC
        RTS

; =============================================================================
; CHATGPT / OPENAI 80-COLUMN BANNER
; =============================================================================
;
; Adapted from asm/TEXT/CHATGPT_LOGO_151.S.
; The compressed stream expands to exactly 7 rows x 80 columns. SCREEN_INIT
; leaves the raw VideoTerm cursor at row 0, column 0, so normal WRITE_GLYPH
; wrapping leaves the cursor at row 7, column 0 ready for the first prompt.
;
; CHATGPT_LOGO_TABLE uses high-bit Apple II characters as literal markers,
; exactly as the standalone 151-byte source does. CHATGPT_LOGO_WRITE strips
; bit 7 before sending the glyph through this program's raw VideoTerm writer.
; WRITE_GLYPH clobbers X, so preserve the compressed-stream index around it.

PRINT_CHATGPT_LOGO
        LDX     #$5C            ; 93 packed bytes: index 92..0

CHATGPT_LOGO_NEXT
        LDA     CHATGPT_LOGO_DATA,X
        JSR     CHATGPT_LOGO_PAIR
        DEX
        BPL     CHATGPT_LOGO_NEXT
        RTS

; Expand two 4-bit tokens held in A: high nibble first, then low.
CHATGPT_LOGO_PAIR
        PHA
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        JSR     CHATGPT_LOGO_TOKEN
        PLA
        AND     #$0F

; Literal table values are negative ($80..$FF); pair rules are positive.
CHATGPT_LOGO_TOKEN
        TAY
        LDA     CHATGPT_LOGO_TABLE,Y
        BPL     CHATGPT_LOGO_PAIR
        JMP     CHATGPT_LOGO_WRITE

CHATGPT_LOGO_WRITE
        AND     #$7F
        TAY
        TXA
        PHA
        TYA
        JSR     KAPI_WRITE_GLYPH
        PLA
        TAX
        RTS

; 0..3 = literals: "8", space, "o", ".". 4..F = recursive pairs.
CHATGPT_LOGO_TABLE
        HEX     B8A0EFAE001155404451247576717972

; 93 compressed bytes, intentionally stored backwards.
CHATGPT_LOGO_DATA
        HEX     9B5CAF2BAEBB2528664388139CDC12A2
        HEX     355AB4BDA1215AF684389EDCEEABD31B
        HEX     E4698288E2F6D4D4BE61425B9C368828
        HEX     9EDAC941182398F3549C2688389EDA25
        HEX     202D9E661C02D25236A222220222B318
        HEX     F354F3329C665C233A66361266

; =============================================================================
; PROMPTS
; =============================================================================

; Draw the startup hint with a temporary VRAM pointer so the logical/hardware
; cursor stays immediately after "[".  On the first keypress, erase only these
; hint cells before processing that key.
PRINT_START_PROMPT
        JSR     PRINT_USER_PROMPT

        LDA     #$01
        STA     START_HINT_ACTIVE

        LDA     CURSOR_LO
        STA     TMP_LO
        LDA     CURSOR_HI
        STA     TMP_HI
        JSR     KAPI_INC_TEMP_ADDR           ; hint starts one cell right of cursor

        LDX     #<TXT_START_HINT
        LDY     #>TXT_START_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00

PRINT_START_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_START_HINT_DONE
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        BNE     PRINT_START_HINT_LOOP
        INC     MSG_ZPH
        JMP     PRINT_START_HINT_LOOP

PRINT_START_HINT_DONE
        JSR     KAPI_SET_HW_CURSOR
        RTS

CLEAR_START_HINT
        LDA     START_HINT_ACTIVE
        BEQ     CLEAR_START_HINT_DONE

        LDA     #$00
        STA     START_HINT_ACTIVE

        LDA     CURSOR_LO
        STA     TMP_LO
        LDA     CURSOR_HI
        STA     TMP_HI
        JSR     KAPI_INC_TEMP_ADDR

        LDX     #<TXT_START_HINT
        LDY     #>TXT_START_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00

CLEAR_START_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     CLEAR_START_HINT_RESTORE
        LDA     #SPACE_GLYPH
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        BNE     CLEAR_START_HINT_LOOP
        INC     MSG_ZPH
        JMP     CLEAR_START_HINT_LOOP

CLEAR_START_HINT_RESTORE
        JSR     KAPI_SET_HW_CURSOR

CLEAR_START_HINT_DONE
        RTS

; Non-destructive one-shot message after the Applesoft ampersand hook is first
; installed.  It uses the same cursor-adjacent technique as the startup hint.
PRINT_AMP_HINT
        LDA     #$01
        STA     AMP_HINT_ACTIVE
        LDA     CURSOR_LO
        STA     TMP_LO
        LDA     CURSOR_HI
        STA     TMP_HI
        JSR     KAPI_INC_TEMP_ADDR
        LDX     #<TXT_AMP_HINT
        LDY     #>TXT_AMP_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
PRINT_AMP_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_AMP_HINT_DONE
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        BNE     PRINT_AMP_HINT_LOOP
        INC     MSG_ZPH
        JMP     PRINT_AMP_HINT_LOOP
PRINT_AMP_HINT_DONE
        JSR     KAPI_SET_HW_CURSOR
        RTS

CLEAR_AMP_HINT
        LDA     AMP_HINT_ACTIVE
        BEQ     CLEAR_AMP_HINT_DONE
        LDA     #$00
        STA     AMP_HINT_ACTIVE
        LDA     CURSOR_LO
        STA     TMP_LO
        LDA     CURSOR_HI
        STA     TMP_HI
        JSR     KAPI_INC_TEMP_ADDR
        LDX     #<TXT_AMP_HINT
        LDY     #>TXT_AMP_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
CLEAR_AMP_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     CLEAR_AMP_HINT_RESTORE
        LDA     #SPACE_GLYPH
        JSR     KAPI_WRITE_CELL_TEMP_RAW
        JSR     KAPI_INC_TEMP_ADDR
        INY
        BNE     CLEAR_AMP_HINT_LOOP
        INC     MSG_ZPH
        JMP     CLEAR_AMP_HINT_LOOP
CLEAR_AMP_HINT_RESTORE
        JSR     KAPI_SET_HW_CURSOR
CLEAR_AMP_HINT_DONE
        RTS

PRINT_USER_PROMPT
        LDA     #USER_PROMPT_CHAR
        JSR     KAPI_WRITE_GLYPH
        RTS

ENSURE_LINE_START
        LDA     COLUMN
        BEQ     ENSURE_LINE_DONE

        JSR     KAPI_NEWLINE

ENSURE_LINE_DONE
        RTS


; =============================================================================
; DOS NAME HELPERS
; =============================================================================

; Populate NAME_INPUT for the SAVE requester.  Existing configuration wins;
; otherwise use the default CHAT-HISTORY string.
SET_SAVE_REQUEST_NAME
        LDA     SAVE_CONFIGURED
        BEQ     SET_SAVE_REQUEST_DEFAULT
        LDA     SAVE_NAME_LEN
        STA     NAME_LEN
        LDX     #$00
SET_SAVE_REQUEST_COPY
        CPX     NAME_LEN
        BEQ     SET_SAVE_REQUEST_DONE
        LDA     SAVE_NAME,X
        AND     #$7F
        STA     NAME_INPUT,X
        INX
        JMP     SET_SAVE_REQUEST_COPY
SET_SAVE_REQUEST_DONE
        RTS
SET_SAVE_REQUEST_DEFAULT
        JMP     SET_DEFAULT_HISTORY_NAME

; C=1 when NAME_INPUT exactly matches the currently configured SAVE filename.
SAVE_NAME_INPUT_MATCHES_CONFIG
        LDA     SAVE_CONFIGURED
        BEQ     SAVE_NAME_INPUT_DIFF
        LDA     NAME_LEN
        CMP     SAVE_NAME_LEN
        BNE     SAVE_NAME_INPUT_DIFF
        LDX     #$00
SAVE_NAME_INPUT_COMPARE
        CPX     NAME_LEN
        BEQ     SAVE_NAME_INPUT_SAME
        LDA     SAVE_NAME,X
        AND     #$7F
        CMP     NAME_INPUT,X
        BNE     SAVE_NAME_INPUT_DIFF
        INX
        JMP     SAVE_NAME_INPUT_COMPARE
SAVE_NAME_INPUT_SAME
        SEC
        RTS
SAVE_NAME_INPUT_DIFF
        CLC
        RTS

SET_DEFAULT_HISTORY_NAME
        LDA     #$0C                    ; CHAT-HISTORY = 12 chars
        STA     NAME_LEN
        LDX     #$0B
SET_DEFAULT_HISTORY_LOOP
        LDA     DEFAULT_HISTORY_NAME,X
        STA     NAME_INPUT,X
        DEX
        BPL     SET_DEFAULT_HISTORY_LOOP
        RTS

SET_CTRL_DEFAULT_HISTORY_NAME
        LDA     #$0C
        STA     GPT_CTRL_NAME_LEN
        LDX     #$0B
SET_CTRL_DEFAULT_LOOP
        LDA     DEFAULT_HISTORY_NAME,X
        STA     GPT_CTRL_NAME,X
        DEX
        BPL     SET_CTRL_DEFAULT_LOOP
        RTS

FILL_SAVE_NAME
        LDX     #$1D
        LDA     #$A0
FILL_SAVE_NAME_LOOP
        STA     SAVE_NAME,X
        DEX
        BPL     FILL_SAVE_NAME_LOOP
        RTS

FILL_AUX_NAME
        LDX     #$1D
        LDA     #$A0
FILL_AUX_NAME_LOOP
        STA     AUX_NAME,X
        DEX
        BPL     FILL_AUX_NAME_LOOP
        RTS

COPY_INPUT_TO_SAVE_NAME
        LDA     NAME_LEN
        STA     SAVE_NAME_LEN
        JSR     FILL_SAVE_NAME
        LDX     #$00
COPY_INPUT_SAVE_LOOP
        CPX     NAME_LEN
        BEQ     COPY_INPUT_SAVE_DONE
        LDA     NAME_INPUT,X
        ORA     #$80
        STA     SAVE_NAME,X
        INX
        JMP     COPY_INPUT_SAVE_LOOP
COPY_INPUT_SAVE_DONE
        RTS

; Copy the configured high-bit/padded SAVE filename verbatim to AUX so the
; page navigator can read the same file through the independent AUX buffers.
COPY_SAVE_TO_AUX_NAME
        LDX     #$00
COPY_SAVE_AUX_LOOP
        LDA     SAVE_NAME,X
        STA     AUX_NAME,X
        INX
        CPX     #MAX_FILENAME
        BNE     COPY_SAVE_AUX_LOOP
        RTS

COPY_INPUT_TO_AUX_NAME
        JSR     FILL_AUX_NAME
        LDX     #$00
COPY_INPUT_AUX_LOOP
        CPX     NAME_LEN
        BEQ     COPY_INPUT_AUX_DONE
        LDA     NAME_INPUT,X
        ORA     #$80
        STA     AUX_NAME,X
        INX
        JMP     COPY_INPUT_AUX_LOOP
COPY_INPUT_AUX_DONE
        RTS

COPY_CTRL_TO_AUX_NAME
        JSR     FILL_AUX_NAME
        LDX     #$00
COPY_CTRL_AUX_LOOP
        CPX     GPT_CTRL_NAME_LEN
        BEQ     COPY_CTRL_AUX_DONE
        LDA     GPT_CTRL_NAME,X
        ORA     #$80
        STA     AUX_NAME,X
        INX
        JMP     COPY_CTRL_AUX_LOOP
COPY_CTRL_AUX_DONE
        RTS

COPY_CTRL_TO_SAVE_NAME
        LDA     GPT_CTRL_NAME_LEN
        STA     SAVE_NAME_LEN
        JSR     FILL_SAVE_NAME
        LDX     #$00
COPY_CTRL_SAVE_LOOP
        CPX     GPT_CTRL_NAME_LEN
        BEQ     COPY_CTRL_SAVE_DONE
        LDA     GPT_CTRL_NAME,X
        ORA     #$80
        STA     SAVE_NAME,X
        INX
        JMP     COPY_CTRL_SAVE_LOOP
COPY_CTRL_SAVE_DONE
        RTS

COPY_CTRL_TO_PENDING_NAME
        LDA     GPT_CTRL_NAME_LEN
        STA     PENDING_NAME_LEN
        LDX     #$00
COPY_CTRL_PENDING_LOOP
        CPX     GPT_CTRL_NAME_LEN
        BEQ     COPY_CTRL_PENDING_DONE
        LDA     GPT_CTRL_NAME,X
        STA     PENDING_NAME,X
        INX
        JMP     COPY_CTRL_PENDING_LOOP
COPY_CTRL_PENDING_DONE
        RTS

COPY_PENDING_TO_AUX_NAME
        JSR     FILL_AUX_NAME
        LDX     #$00
COPY_PENDING_AUX_LOOP
        CPX     PENDING_NAME_LEN
        BEQ     COPY_PENDING_AUX_DONE
        LDA     PENDING_NAME,X
        ORA     #$80
        STA     AUX_NAME,X
        INX
        JMP     COPY_PENDING_AUX_LOOP
COPY_PENDING_AUX_DONE
        RTS

COPY_PENDING_TO_NAME_INPUT
        LDA     PENDING_NAME_LEN
        STA     NAME_LEN
        LDX     #$00
COPY_PENDING_INPUT_LOOP
        CPX     PENDING_NAME_LEN
        BEQ     COPY_PENDING_INPUT_DONE
        LDA     PENDING_NAME,X
        STA     NAME_INPUT,X
        INX
        JMP     COPY_PENDING_INPUT_LOOP
COPY_PENDING_INPUT_DONE
        RTS

HISTORY_WRITE_Z
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
HISTORY_Z_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     HISTORY_Z_DONE
        JSR     HISTORY_WRITE_ASCII
        INY
        BNE     HISTORY_Z_LOOP
        INC     MSG_ZPH
        JMP     HISTORY_Z_LOOP
HISTORY_Z_DONE
        RTS

HISTORY_WRITE_NAME_INPUT
        LDA     #$00
        STA     LOOP_INDEX
HISTORY_NAME_LOOP
        LDX     LOOP_INDEX
        CPX     NAME_LEN
        BEQ     HISTORY_NAME_DONE
        LDA     NAME_INPUT,X
        JSR     HISTORY_WRITE_ASCII
        INC     LOOP_INDEX
        JMP     HISTORY_NAME_LOOP
HISTORY_NAME_DONE
        RTS


; =============================================================================
; VIDEX:NORMAL UNICODE TABLES
; =============================================================================

BMP_LOW
        HEX     8875761477020C1C7418003410242C3C

SUP_LOW
        HEX     020B0E2D303995

SUP_GLYPH
        HEX     0102030405067F

; =============================================================================

; =============================================================================

TXT_START_HINT
        ASC     " [ESC] = menu"
        HEX     00
TXT_MENU
        ASC     "[N]AVIGATE  [&]GPT [H]ISTORY [C]MD [Q]UIT"
        HEX     00
TXT_AMP_HINT
        ASC     " Ampersand installed. &GPT opens app; &GPT "
        HEX     22
        ASC     "..."
        HEX     22
        ASC     " chats"
        HEX     00
TXT_CMD_FILE
        ASC     "CMD FILE:"
        HEX     00
TXT_SAVE_FILE
        ASC     "HISTORY FILE:"
        HEX     00
TXT_NAV_FILE
        ASC     "CHAT HISTORY FILE:"
        HEX     00
TXT_CMD_PROMPT
        ASC     "CMD>"
        HEX     00
TXT_DOS_ERROR
        ASC     "DOS ERROR $"
        HEX     00

TXT_LOAD_AUDIT
        ASC     "[LOAD "
        HEX     00
TXT_FILE_HEADER
        ASC     "FILE "
        HEX     00
TXT_RUN_PREFIX
        ASC     "[RUN IN APPLESOFT: "
        HEX     00
TXT_EXEC_PREFIX
        ASC     "EXEC "
        HEX     00
TXT_NAV_HELP
        ASC     "PAGE UP/DOWN: <- ->   BACK TO CHAT: <ESC>  WIPE: <W>"
        HEX     00
DEFAULT_HISTORY_NAME
        ASC     "CHAT-HISTORY"

; =============================================================================

TXT_DIAG_T1
        ASC     "[T1]"
        HEX     00
TXT_DIAG_T2
        ASC     "[T2]"
        HEX     00
TXT_DIAG_T3
        ASC     "[T3]"
        HEX     00
TXT_DIAG_T4
        ASC     "[T4]"
        HEX     00


; =============================================================================
; CHAT-OVERLAY GPT POLICY LITERALS
; =============================================================================
; These were stored inside PAGE_SCRATCH in V6.09.  In the split layout they
; are immutable CHAT-overlay literals; PAGE_SCRATCH is now pure shared RAM.
GPT_TURN_FILE_RULE
        ASC     "A2 FILE RULE: IF THIS REQUEST ASKS TO CREATE/WRITE/SAVE A DOS FILE OR CMD SCRIPT, USE WHOLE-LINE [[A2:C:NAME]], FILE BODY ONLY, THEN WHOLE-LINE [[A2:E]], CONTROLS AT COLUMN 0; DO NOT RETURN THAT FILE BODY AS CHAT. REQUEST: "
        HEX     00
GPT_TURN_FILE_RULE_END
GPT_BRIEFING
        ASC     "APPLE II GPT16 V6.03; UTF-16LE; BE CONCISE. "
        ASC     "DOS-CREATED FILE BODY=7-BIT ASCII+CR. HISTORY=HIGH-BIT DOS TEXT WITH LOSSLESS UTF-16 ESCAPES; LOAD DECODES HISTORY AND ACCEPTS DOS TEXT. "
        ASC     "WHOLE-LINE CONTROLS: [[A2:C:NAME]] CONTENT [[A2:E]] CREATE/CLOSE; [[A2:S:NAME]] SAVE HISTORY; [[A2:S]] USE CHAT-HISTORY; [[A2:L:NAME]] LOAD FILE AS NEXT USER MESSAGE. "
        ASC     "MANDATORY FILE ACTION: IF USER ASKS TO CREATE/WRITE/SAVE A DOS FILE OR CMD SCRIPT, USE C/E CONTROLS AND DO NOT RETURN THAT FILE BODY AS ORDINARY CHAT. CONTROLS START COLUMN 0. "
        ASC     "NO FILE-TYPE FIELD OR RAW C0. BETWEEN C/E OUTPUT FILE CONTENT ONLY. LOADED NEWLINES=U+2028; NAMES=1-30 DOS CHARS. "
        ASC     "RUN BRUN EXEC CALL MAY BE LITERAL FILE LINES; NEVER CLAIM EXECUTION. &GPT PROMPT IS CHAT; BARE &GPT OPENS APP. REPLY ONLY READY."
        HEX     00
GPT_BRIEFING_END

CHAT_CODE_END
        .ASSERT CHAT_CODE_END = $7D1A, error, "V6.11 CHAT overlay length changed"
        .ASSERT CHAT_CODE_END <= $8400, error, "CHAT overlay exceeds $6000-$83FF"
