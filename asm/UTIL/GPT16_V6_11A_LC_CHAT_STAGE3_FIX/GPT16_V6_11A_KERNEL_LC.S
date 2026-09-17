; =============================================================================
; GPT16_V6_11A_KERNEL_LC.S
; =============================================================================
; Resident kernel extracted from last-running V6.09 diagnostic build.
; Load at $4000. This file contains no CHAT or Kermit overlay.
; Shared RAM/DOS workspace addresses are fixed by GPT16_V6_10_ABI.INC.
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
; V6.11 CHAT overlay backing-store integration
; =============================================================================
CHAT_IMAGE_START        EQU     $6000
CHAT_IMAGE_LEN          EQU     $1D1A       ; CHAT_CODE_END=$7D1A
CHAT_LC_BANK            EQU     $0000
CHAT_LC_OFFSET          EQU     $2000       ; physical common LC $E000-$FFFF
CHAT_OVL_MAGIC_ADDR     EQU     $6015
CHAT_CACHE_FLAGS        EQU     RAM_LC_RESERVED
CHAT_CACHE_READY        EQU     $01
CHAT_CACHE_VERIFIED     EQU     $02
CHAT_CACHE_FROM_DISK    EQU     $04
DOS_BINARY_TYPE         EQU     $04

; GPT16 wrapper preserves RAM API private ZP $E8-$EF here.
; Validated LC prefix ends exactly at $8CF8.
GPT_RAM_ZP_SAVE         EQU     $8CF8

CHAT_OVL_INIT_ADDR      EQU     $6000
CHAT_OVL_RESUME_ADDR    EQU     $6009

; =============================================================================
; RESIDENT KERNEL ABI -- FIXED AFTER THIS PROTOTYPE
; =============================================================================

        ORG     $4000

KAPI_BOOT
        JMP     KERNEL_BOOT             ; validate/cache/load CHAT before OVL_INIT
KAPI_DETECT_CARDS
        JMP     DETECT_CARDS
KAPI_PATCH_SERIAL_SLOT
        JMP     PATCH_SERIAL_SLOT
KAPI_ENGAGE_VIDEX
        JMP     ENGAGE_VIDEX
KAPI_G16_NEGOTIATE
        JMP     G16_NEGOTIATE
KAPI_G16_SHOW_ERROR
        JMP     G16_SHOW_ERROR
KAPI_SERIAL_INIT
        JMP     SERIAL_INIT
KAPI_SERIAL_TX_BYTE
        JMP     SERIAL_TX_BYTE
KAPI_SEND_UTF16_ASCII
        JMP     SEND_UTF16_ASCII
KAPI_SERIAL_RX_BLOCK
        JMP     SERIAL_RX_BLOCK
KAPI_SERIAL_RX_NEXT
        JMP     SERIAL_RX_NEXT
KAPI_GET_KEY
        JMP     GET_KEY
KAPI_GET_KEY_WAIT
        JMP     GET_KEY_WAIT
KAPI_SCREEN_INIT
        JMP     SCREEN_INIT
KAPI_WRITE_GLYPH
        JMP     WRITE_GLYPH
KAPI_NEWLINE
        JMP     NEWLINE
KAPI_SCREEN_BACKSPACE
        JMP     SCREEN_BACKSPACE
KAPI_SET_HW_CURSOR
        JMP     SET_HW_CURSOR
KAPI_WRITE_CELL_TEMP_RAW
        JMP     WRITE_CELL_TEMP_RAW
KAPI_READ_CELL_TEMP_RAW
        JMP     READ_CELL_TEMP_RAW
KAPI_INC_TEMP_ADDR
        JMP     INC_TEMP_ADDR
KAPI_VIDEX_CRTC_WRITE
        JMP     VIDEX_CRTC_WRITE
KAPI_IMPORT_VIDEX_FIRMWARE
        JMP     IMPORT_VIDEX_FIRMWARE
KAPI_PRINT_SCREEN_STRING
        JMP     PRINT_SCREEN_STRING
KAPI_PRINT_HEX_BYTE
        JMP     PRINT_HEX_BYTE
KAPI_DOS_INIT
        JMP     DOS_INIT
KAPI_FM_CREATE_AUX
        JMP     FM_CREATE_AUX
KAPI_FM_CREATE_SAVE
        JMP     FM_CREATE_SAVE
KAPI_FM_OPEN_AUX_EXIST
        JMP     FM_OPEN_AUX_EXIST
KAPI_FM_OPEN_SAVE_EXIST
        JMP     FM_OPEN_SAVE_EXIST
KAPI_FM_CLOSE_AUX
        JMP     FM_CLOSE_AUX
KAPI_FM_CLOSE_SAVE
        JMP     FM_CLOSE_SAVE
KAPI_FM_POSITION_SAVE
        JMP     FM_POSITION_SAVE
KAPI_FM_READ_AUX
        JMP     FM_READ_AUX
KAPI_FM_WRITE_RAW
        JMP     FM_WRITE_RAW
KAPI_FM_WRITE_SAVE_RAW
        JMP     FM_WRITE_SAVE_RAW
KAPI_FM_EOF_CLOSE_AUX
        JMP     FM_EOF_CLOSE_AUX
KAPI_FM_EOF_CLOSE_SAVE
        JMP     FM_EOF_CLOSE_SAVE
KAPI_FILE_ENCODE_ASCII_A
        JMP     FILE_ENCODE_ASCII_A
KAPI_FILE_ENCODE_CP
        JMP     FILE_ENCODE_CP
KAPI_FILE_ENCODE_SURROGATE
        JMP     FILE_ENCODE_SURROGATE
KAPI_CHAT_CACHE_STORE
        JMP     CHAT_CACHE_STORE
KAPI_CHAT_RELOAD
        JMP     CHAT_RELOAD
KAPI_CHAT_DISK_BOOT
        JMP     CHAT_DISK_BOOT

KERNEL_ABI_MAJOR EQU     $01
KERNEL_ABI_MINOR EQU     $01

        .ASSERT * <= $4100, error, "Kernel ABI page exceeds $4000-$40FF"
        .RES    $4100-*

; =============================================================================
; RESIDENT KERNEL IMPLEMENTATION
; =============================================================================

PRINT_SCREEN_STRING
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
PRINT_SCREEN_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_SCREEN_DONE
        JSR     WRITE_GLYPH
        INY
        BNE     PRINT_SCREEN_LOOP
        INC     MSG_ZPH
        JMP     PRINT_SCREEN_LOOP
PRINT_SCREEN_DONE

PRINT_HEX_BYTE
        PHA
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        JSR     PRINT_HEX_NIBBLE
        PLA
        AND     #$0F
PRINT_HEX_NIBBLE
        CMP     #$0A
        BCC     PRINT_HEX_DIGIT
        CLC
        ADC     #$37
        JMP     WRITE_GLYPH
PRINT_HEX_DIGIT
        CLC
        ADC     #'0'
        JMP     WRITE_GLYPH


; =============================================================================

; -----------------------------------------------------------------------------
; Scan slots 1..7.
;
; Return:
;       C=1 cards usable
;       C=0 abort
; -----------------------------------------------------------------------------

DETECT_CARDS
        LDA     #$00
        STA     SP_SLOT
        STA     VT_SLOT
        STA     SP_COUNT
        STA     VT_COUNT

        LDA     #$01
        STA     SCAN_SLOT

DETECT_SLOT_LOOP
        JSR     CRC16_SLOT_PAGE

        ; ---- exact VideoTerm 2.4 slot page: CRC $8E97 -----------------------
        LDA     CRC_LO
        CMP     #$97
        BNE     DETECT_NOT_VIDEX

        LDA     CRC_HI
        CMP     #$8E
        BNE     DETECT_NOT_VIDEX

        INC     VT_COUNT
        LDA     SCAN_SLOT
        STA     VT_SLOT

DETECT_NOT_VIDEX
        ; ---- Serial Pro v2.0 CRC is slot-specific ---------------------------
        LDX     SCAN_SLOT
        DEX

        LDA     CRC_LO
        CMP     SP_CRC_LO,X
        BNE     DETECT_NOT_SERIAL

        LDA     CRC_HI
        CMP     SP_CRC_HI,X
        BNE     DETECT_NOT_SERIAL

        INC     SP_COUNT
        LDA     SCAN_SLOT
        STA     SP_SLOT

DETECT_NOT_SERIAL
        ; Slot-ROM access may have claimed $C800-$CFFF.
        LDA     C8_RELEASE

        INC     SCAN_SLOT
        LDA     SCAN_SLOT
        CMP     #$08
        BNE     DETECT_SLOT_LOOP

        ; Serial Pro: exact one-hit autodetect, otherwise ask.
        LDA     SP_COUNT
        CMP     #$01
        BEQ     DETECT_SERIAL_READY

        JSR     ASK_SERIAL_SLOT
        BCC     DETECT_FAIL

DETECT_SERIAL_READY
        ; VideoTerm: exact one-hit autodetect, otherwise ask.
        LDA     VT_COUNT
        CMP     #$01
        BEQ     DETECT_VIDEX_READY

        JSR     ASK_VIDEX_SLOT
        BCC     DETECT_FAIL

DETECT_VIDEX_READY
        ; Firmware 2.4 is explicitly slot-3-only.
        LDA     VT_SLOT
        CMP     #$03
        BEQ     DETECT_OK

        LDA     #<MSG_VIDEX_SLOT3
        LDY     #>MSG_VIDEX_SLOT3
        JSR     PRINT_MON_STRING
        JSR     MON_NEWLINE
        CLC
        RTS

DETECT_OK
        SEC
        RTS

DETECT_FAIL
        CLC
        RTS

; -----------------------------------------------------------------------------
; CRC16 over the current slot's $Cn00-$CnFF page.
; Same algorithm as COM.crc16():
;       CRC=$FFFF, reflected polynomial $A001.
; -----------------------------------------------------------------------------

CRC16_SLOT_PAGE
        ; Self-modify the high byte of LDA $C100,Y.
        LDA     SCAN_SLOT
        CLC
        ADC     #$C0
        STA     CRC_SLOT_READ+2

        LDA     #$FF
        STA     CRC_LO
        STA     CRC_HI

        LDY     #$00

CRC_BYTE_LOOP
CRC_SLOT_READ
        LDA     $C100,Y
        EOR     CRC_LO
        STA     CRC_LO

        LDX     #$08

CRC_BIT_LOOP
        LSR     CRC_HI
        ROR     CRC_LO
        BCC     CRC_NO_XOR

        LDA     CRC_LO
        EOR     #$01
        STA     CRC_LO

        LDA     CRC_HI
        EOR     #$A0
        STA     CRC_HI

CRC_NO_XOR
        DEX
        BNE     CRC_BIT_LOOP

        INY
        BNE     CRC_BYTE_LOOP
        RTS

; =============================================================================
; DETECTION FALLBACK UI
; =============================================================================

ASK_SERIAL_SLOT
        JSR     MON_NEWLINE

        LDA     #<MSG_SERIAL_SLOT
        LDY     #>MSG_SERIAL_SLOT
        JSR     PRINT_MON_STRING

        JSR     READ_SLOT_DIGIT
        BCC     ASK_SERIAL_FAIL

        STA     SP_SLOT
        SEC
        RTS

ASK_SERIAL_FAIL
        CLC
        RTS

ASK_VIDEX_SLOT
        JSR     MON_NEWLINE

        LDA     #<MSG_VIDEX_SLOT
        LDY     #>MSG_VIDEX_SLOT
        JSR     PRINT_MON_STRING

        JSR     READ_SLOT_DIGIT
        BCC     ASK_VIDEX_FAIL

        STA     VT_SLOT
        SEC
        RTS

ASK_VIDEX_FAIL
        CLC
        RTS

; Read one slot digit through the currently installed KSW.
; Digits are case-independent, and this also remains usable if VideoTerm was
; already active before CALL $6000.
;
; Return C=1/A=1..7, or repeat until valid.
READ_SLOT_DIGIT
READ_SLOT_WAIT
        JSR     M_RDKEY
        AND     #$7F

        CMP     #'1'
        BCC     READ_SLOT_WAIT

        CMP     #'8'
        BCS     READ_SLOT_WAIT

        PHA
        ORA     #$80
        JSR     M_COUT
        JSR     MON_NEWLINE
        PLA

        SEC
        SBC     #'0'
        SEC
        RTS

MON_NEWLINE
        LDA     #$8D
        JSR     M_COUT
        RTS

; A=low address, Y=high address of zero-terminated plain ASCII string.
PRINT_MON_STRING
        STA     MSG_ZPL
        STY     MSG_ZPH

        LDY     #$00

PRINT_MON_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_MON_DONE

        ORA     #$80
        JSR     M_COUT

        INY
        BNE     PRINT_MON_LOOP

PRINT_MON_DONE
        RTS

; =============================================================================
; PATCH DISCOVERED SLOT ADDRESSES
; =============================================================================

; -----------------------------------------------------------------------------
; Serial Pro:
; slot n device-select base = $C080 + n*$10
; ACIA DATA/STATUS/COMMAND/CONTROL = base+$08..+$0B.
; -----------------------------------------------------------------------------

PATCH_SERIAL_SLOT
        LDA     SP_SLOT
        ASL     A
        ASL     A
        ASL     A
        ASL     A

        CLC
        ADC     #$88
        STA     SP_DATA_RD+1
        STA     SP_DATA_WR+1

        CLC
        ADC     #$01
        STA     SP_STATUS_RD+1
        STA     SP_STATUS_WR+1

        CLC
        ADC     #$01
        STA     SP_COMMAND_WR+1

        CLC
        ADC     #$01
        STA     SP_CONTROL_WR+1
        RTS

; -----------------------------------------------------------------------------
; VideoTerm:
;   slot ROM = $Cn00
;   device select = $C080 + n*$10
;
; Firmware 2.4 will only pass validation in slot 3, but keeping these operands
; derived from VT_SLOT makes the raw hardware boundary explicit.
; -----------------------------------------------------------------------------

; VideoTerm firmware 2.4 is accepted only in slot 3.  All low-level
; VideoTerm operands below are therefore already the final $C300/$C0B0/$xx7B/
; $xxFB addresses and need no runtime patching.

; =============================================================================
; VIDEOTERM PR#/IN# ENGAGEMENT
; =============================================================================

ENGAGE_VIDEX
        ; VideoTerm installs its KSW/CSW.
        LDA     #$00

VT_INIT_CALL
        JSR     $C300

        ; If DOS 3.3 is resident, reconnect DOS around
        ; the newly installed VideoTerm I/O handlers.
        LDA     DOS_WARM
        CMP     #$4C
        BNE     ENGAGE_VIDEX_DONE

        JSR     $03EA           ; DOS 3.3 re-hook I/O

ENGAGE_VIDEX_DONE
        RTS

; =============================================================================
; GPT16 G16/1 CONTROL-PLANE NEGOTIATION
; =============================================================================
;
; Control frames are raw 7-bit ASCII and exist below the normal UTF-16LE GPT16
; text transport. A gateway must intercept them before its GPT text decoder.
;
;   SOH G16|1|0001|TYPE|PAYLOAD * HHHH ETX
;
; HHHH is CRC-16/CCITT-FALSE over the bytes after SOH through the byte before
; '*'.  Sequence 0001 is deliberately fixed because this binary negotiates only
; once; retries therefore remain idempotent by construction.
;
; V6.03 requests:
;   DP=G16D1;ROM=VN;BASE=CP437;VG1=7F;GRID=80x24;FALL=CELL1
;
; READY canonical order is intentionally fixed for a small 6502 parser:
;   G16|1|0001|READY|MODE=UTF16LE;DP=G16D1;ROM=VN;BASE=CP437;
;   VG1=HH;GRID=CCxRR;FALL=CELL1;DG=HH
; CC/RR are exactly two decimal digits in G16D1 v1.
;

G16_NEGOTIATE
        LDA     #G16_ERR_NONE
        STA     G16_ERROR
        LDA     #G16_ATTEMPTS
        STA     G16_RETRIES_LEFT

G16_NEGOTIATE_TRY
        JSR     G16_SEND_HELLO
        JSR     G16_WAIT_FRAME
        BCC     G16_NEGOTIATE_FIRST_OK
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_FIRST_OK
        JSR     G16_FRAME_TYPE
        CMP     #G16_TYPE_ACK
        BEQ     G16_NEGOTIATE_ACKED
        CMP     #G16_TYPE_NAK
        BEQ     G16_NEGOTIATE_NAK
        CMP     #G16_TYPE_FAIL
        BEQ     G16_NEGOTIATE_REMOTE_FAIL
        LDA     #G16_ERR_UNEXPECTED
        STA     G16_ERROR
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_NAK
        LDA     #G16_ERR_NAK
        STA     G16_ERROR
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_ACKED
        LDA     #G16_READY_WINDOWS
        STA     G16_READY_LEFT
        LDA     #G16_WAIT_BUDGET
        STA     G16_WAIT_LEFT

G16_NEGOTIATE_WAIT_RESULT
        JSR     G16_WAIT_FRAME
        BCC     G16_NEGOTIATE_RESULT_FRAME

        DEC     G16_READY_LEFT
        BNE     G16_NEGOTIATE_WAIT_RESULT
        LDA     #G16_ERR_READY_TO
        STA     G16_ERROR
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_RESULT_FRAME
        JSR     G16_FRAME_TYPE
        CMP     #G16_TYPE_READY
        BEQ     G16_NEGOTIATE_READY
        CMP     #G16_TYPE_WAIT
        BEQ     G16_NEGOTIATE_WAIT_EXTEND
        CMP     #G16_TYPE_ACK
        BEQ     G16_NEGOTIATE_WAIT_RESULT     ; harmless duplicate ACK
        CMP     #G16_TYPE_NAK
        BEQ     G16_NEGOTIATE_NAK
        CMP     #G16_TYPE_FAIL
        BEQ     G16_NEGOTIATE_REMOTE_FAIL
        LDA     #G16_ERR_UNEXPECTED
        STA     G16_ERROR
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_WAIT_EXTEND
        DEC     G16_WAIT_LEFT
        BEQ     G16_NEGOTIATE_WAIT_EXHAUSTED
        LDA     #G16_READY_WINDOWS
        STA     G16_READY_LEFT
        JMP     G16_NEGOTIATE_WAIT_RESULT

G16_NEGOTIATE_WAIT_EXHAUSTED
        LDA     #G16_ERR_READY_TO
        STA     G16_ERROR
        JMP     G16_NEGOTIATE_RETRY

G16_NEGOTIATE_READY
        JSR     G16_VALIDATE_READY
        BCS     G16_NEGOTIATE_PROFILE_FAIL
        CLC
        RTS

G16_NEGOTIATE_PROFILE_FAIL
        LDA     #G16_ERR_PROFILE
        STA     G16_ERROR
        SEC
        RTS

G16_NEGOTIATE_REMOTE_FAIL
        LDA     #G16_ERR_REMOTE
        STA     G16_ERROR
        SEC
        RTS

G16_NEGOTIATE_RETRY
        DEC     G16_RETRIES_LEFT
        BEQ     G16_NEGOTIATE_FAILED
        JMP     G16_NEGOTIATE_TRY

G16_NEGOTIATE_FAILED
        SEC
        RTS

; Send the fixed HELLO body and calculate its CRC while transmitting.
G16_SEND_HELLO
        LDA     #G16_SOH
        JSR     SERIAL_TX_BYTE
        JSR     G16_CRC_INIT

        LDA     #<G16_HELLO_BODY
        STA     MSG_ZPL
        LDA     #>G16_HELLO_BODY
        STA     MSG_ZPH
        LDY     #$00
G16_SEND_HELLO_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     G16_SEND_HELLO_CRC
        PHA
        JSR     G16_CRC_UPDATE
        PLA
        JSR     SERIAL_TX_BYTE
        INY
        BNE     G16_SEND_HELLO_LOOP
        INC     MSG_ZPH
        JMP     G16_SEND_HELLO_LOOP

G16_SEND_HELLO_CRC
        LDA     #'*'
        JSR     SERIAL_TX_BYTE
        LDA     G16_CRC_HI
        JSR     G16_SEND_HEX_BYTE
        LDA     G16_CRC_LO
        JSR     G16_SEND_HEX_BYTE
        LDA     #G16_ETX
        JMP     SERIAL_TX_BYTE

; Wait for one complete SOH..ETX frame. Random bytes before SOH are discarded;
; a second SOH inside a partial frame re-synchronizes at that byte.
; C=0 valid CRC frame in G16_FRAME_BUF, C=1 timeout/format/CRC failure.
G16_WAIT_FRAME
        LDA     #$00
        STA     G16_FRAME_LEN

G16_WAIT_SEEK_SOH
        JSR     G16_RX_BYTE_TIMEOUT
        BCS     G16_WAIT_HAVE_SEEK
        LDA     #G16_ERR_TIMEOUT
        STA     G16_ERROR
        SEC
        RTS
G16_WAIT_HAVE_SEEK
        CMP     #G16_SOH
        BNE     G16_WAIT_SEEK_SOH
        LDA     #$00
        STA     G16_FRAME_LEN

G16_WAIT_COLLECT
        JSR     G16_RX_BYTE_TIMEOUT
        BCS     G16_WAIT_HAVE_BYTE
        LDA     #G16_ERR_TIMEOUT
        STA     G16_ERROR
        SEC
        RTS

G16_WAIT_HAVE_BYTE
        CMP     #G16_SOH
        BEQ     G16_WAIT_RESTART
        CMP     #G16_ETX
        BEQ     G16_WAIT_COMPLETE
        STA     G16_RX_TEMP
        LDX     G16_FRAME_LEN
        CPX     #G16_FRAME_MAX
        BCC     G16_WAIT_STORE
        LDA     #G16_ERR_FRAME
        STA     G16_ERROR
        SEC
        RTS
G16_WAIT_STORE
        LDA     G16_RX_TEMP
        STA     G16_FRAME_BUF,X
        INC     G16_FRAME_LEN
        JMP     G16_WAIT_COLLECT

G16_WAIT_RESTART
        LDA     #$00
        STA     G16_FRAME_LEN
        JMP     G16_WAIT_COLLECT

G16_WAIT_COMPLETE
        JSR     G16_VALIDATE_FRAME
        BCC     G16_WAIT_VALID
        LDA     #G16_ERR_FRAME
        STA     G16_ERROR
        SEC
        RTS
G16_WAIT_VALID
        CLC
        RTS

; Software timeout used only during the control-plane handshake. Two passes of
; 255x255 status polls are intentionally generous on a ~1 MHz Apple II and do
; not depend on an emulator clock. C=1/A=byte; C=0 timeout.
G16_RX_BYTE_TIMEOUT
        LDA     #$02
        STA     G16_TIMEOUT_PASS
G16_RX_TIMEOUT_PASS
        LDY     #$FF
G16_RX_TIMEOUT_OUTER
        LDX     #$FF
G16_RX_TIMEOUT_INNER
        JSR     SP_READ_STATUS
        AND     #SP_RDRF
        BNE     G16_RX_TIMEOUT_GOT
        DEX
        BNE     G16_RX_TIMEOUT_INNER
        DEY
        BNE     G16_RX_TIMEOUT_OUTER
        DEC     G16_TIMEOUT_PASS
        BNE     G16_RX_TIMEOUT_PASS
        CLC
        RTS
G16_RX_TIMEOUT_GOT
        JSR     SP_READ_DATA
        SEC
        RTS

; Validate trailing *HHHH and CCITT-FALSE CRC. G16_BODY_LEN excludes the '*'.
G16_VALIDATE_FRAME
        LDA     G16_FRAME_LEN
        CMP     #$06                    ; at least one body byte + *HHHH
        BCS     G16_VALIDATE_LEN_OK
        SEC
        RTS
G16_VALIDATE_LEN_OK
        SEC
        SBC     #$05
        STA     G16_BODY_LEN
        TAX
        LDA     G16_FRAME_BUF,X
        CMP     #'*'
        BEQ     G16_VALIDATE_STAR_OK
        SEC
        RTS
G16_VALIDATE_STAR_OK
        JSR     G16_CRC_INIT
        LDY     #$00
G16_VALIDATE_CRC_LOOP
        CPY     G16_BODY_LEN
        BEQ     G16_VALIDATE_CRC_TEXT
        LDA     G16_FRAME_BUF,Y
        JSR     G16_CRC_UPDATE
        INY
        JMP     G16_VALIDATE_CRC_LOOP

G16_VALIDATE_CRC_TEXT
        LDX     G16_BODY_LEN
        INX
        LDA     G16_FRAME_BUF,X
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_VALIDATE_HI1_OK
        SEC
        RTS
G16_VALIDATE_HI1_OK
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        STA     G16_RXCRC_HI
        INX
        LDA     G16_FRAME_BUF,X
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_VALIDATE_HI2_OK
        SEC
        RTS
G16_VALIDATE_HI2_OK
        ORA     G16_RXCRC_HI
        STA     G16_RXCRC_HI
        INX
        LDA     G16_FRAME_BUF,X
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_VALIDATE_LO1_OK
        SEC
        RTS
G16_VALIDATE_LO1_OK
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        STA     G16_RXCRC_LO
        INX
        LDA     G16_FRAME_BUF,X
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_VALIDATE_LO2_OK
        SEC
        RTS
G16_VALIDATE_LO2_OK
        ORA     G16_RXCRC_LO
        STA     G16_RXCRC_LO

        LDA     G16_RXCRC_HI
        CMP     G16_CRC_HI
        BNE     G16_VALIDATE_BAD
        LDA     G16_RXCRC_LO
        CMP     G16_CRC_LO
        BNE     G16_VALIDATE_BAD
        CLC
        RTS
G16_VALIDATE_BAD
        SEC
        RTS

; CRC-16/CCITT-FALSE: poly $1021, init $FFFF, non-reflected, xorout $0000.
; A = next byte. Clobbers X/A, preserves Y.
G16_CRC_INIT
        LDA     #$FF
        STA     G16_CRC_LO
        STA     G16_CRC_HI
        RTS

G16_CRC_UPDATE
        EOR     G16_CRC_HI
        STA     G16_CRC_HI
        LDX     #$08
G16_CRC_BIT
        ASL     G16_CRC_LO
        ROL     G16_CRC_HI
        BCC     G16_CRC_NO_POLY
        LDA     G16_CRC_LO
        EOR     #$21
        STA     G16_CRC_LO
        LDA     G16_CRC_HI
        EOR     #$10
        STA     G16_CRC_HI
G16_CRC_NO_POLY
        DEX
        BNE     G16_CRC_BIT
        RTS

G16_SEND_HEX_BYTE
        PHA
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        JSR     G16_NIBBLE_ASCII
        JSR     SERIAL_TX_BYTE
        PLA
        AND     #$0F
        JSR     G16_NIBBLE_ASCII
        JMP     SERIAL_TX_BYTE

G16_NIBBLE_ASCII
        CMP     #$0A
        BCC     G16_NIBBLE_DIGIT
        CLC
        ADC     #$37                    ; 10 -> 'A'
        RTS
G16_NIBBLE_DIGIT
        CLC
        ADC     #'0'
        RTS

; A=ASCII hex digit. C=0/A=0..15 if valid, C=1 otherwise.
G16_HEX_TO_NIBBLE
        CMP     #'0'
        BCC     G16_HEX_BAD
        CMP     #':'
        BCC     G16_HEX_DECIMAL
        CMP     #'A'
        BCC     G16_HEX_BAD
        CMP     #'G'
        BCS     G16_HEX_BAD
        SEC
        SBC     #$37                    ; 'A' -> 10
        CLC
        RTS
G16_HEX_DECIMAL
        SEC
        SBC     #'0'
        CLC
        RTS
G16_HEX_BAD
        SEC
        RTS

; Classify a CRC-valid frame. Prefix matches intentionally require sequence 0001.
G16_FRAME_TYPE
        LDX     #<G16_ACK_BODY
        LDY     #>G16_ACK_BODY
        JSR     G16_MATCH_EXACT
        BCS     G16_TYPE_NOT_ACK
        LDA     #G16_TYPE_ACK
        RTS
G16_TYPE_NOT_ACK
        LDX     #<G16_WAIT_PREFIX
        LDY     #>G16_WAIT_PREFIX
        JSR     G16_MATCH_PREFIX
        BCS     G16_TYPE_NOT_WAIT
        LDA     #G16_TYPE_WAIT
        RTS
G16_TYPE_NOT_WAIT
        LDX     #<G16_READY_PREFIX
        LDY     #>G16_READY_PREFIX
        JSR     G16_MATCH_PREFIX
        BCS     G16_TYPE_NOT_READY
        LDA     #G16_TYPE_READY
        RTS
G16_TYPE_NOT_READY
        LDX     #<G16_NAK_PREFIX
        LDY     #>G16_NAK_PREFIX
        JSR     G16_MATCH_PREFIX
        BCS     G16_TYPE_NOT_NAK
        LDA     #G16_TYPE_NAK
        RTS
G16_TYPE_NOT_NAK
        LDX     #<G16_FAIL_PREFIX
        LDY     #>G16_FAIL_PREFIX
        JSR     G16_MATCH_PREFIX
        BCS     G16_TYPE_UNKNOWN_RETURN
        LDA     #G16_TYPE_FAIL
        RTS
G16_TYPE_UNKNOWN_RETURN
        LDA     #G16_TYPE_UNKNOWN
        RTS

G16_MATCH_PREFIX
        LDA     #$00
        STA     G16_PARSE_INDEX
        JMP     G16_EXPECT_Z

G16_MATCH_EXACT
        JSR     G16_MATCH_PREFIX
        BCS     G16_MATCH_EXACT_BAD
        LDA     G16_PARSE_INDEX
        CMP     G16_BODY_LEN
        BNE     G16_MATCH_EXACT_BAD
        CLC
        RTS
G16_MATCH_EXACT_BAD
        SEC
        RTS

; Compare a zero-terminated literal at X/Y against G16_FRAME_BUF starting at
; G16_PARSE_INDEX, advancing the index on success.
G16_EXPECT_Z
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
G16_EXPECT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     G16_EXPECT_OK
        LDX     G16_PARSE_INDEX
        CPX     G16_BODY_LEN
        BCS     G16_EXPECT_BAD
        CMP     G16_FRAME_BUF,X
        BNE     G16_EXPECT_BAD
        INC     G16_PARSE_INDEX
        INY
        BNE     G16_EXPECT_LOOP
        INC     MSG_ZPH
        JMP     G16_EXPECT_LOOP
G16_EXPECT_OK
        CLC
        RTS
G16_EXPECT_BAD
        SEC
        RTS

G16_PARSE_CHAR
        LDX     G16_PARSE_INDEX
        CPX     G16_BODY_LEN
        BCC     G16_PARSE_CHAR_OK
        SEC
        RTS
G16_PARSE_CHAR_OK
        LDA     G16_FRAME_BUF,X
        INC     G16_PARSE_INDEX
        CLC
        RTS

G16_PARSE_HEX_BYTE
        JSR     G16_PARSE_CHAR
        BCC     G16_PARSE_HEX_1
        SEC
        RTS
G16_PARSE_HEX_1
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_PARSE_HEX_1_OK
        SEC
        RTS
G16_PARSE_HEX_1_OK
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        STA     G16_NUM_TEMP
        JSR     G16_PARSE_CHAR
        BCC     G16_PARSE_HEX_2
        SEC
        RTS
G16_PARSE_HEX_2
        JSR     G16_HEX_TO_NIBBLE
        BCC     G16_PARSE_HEX_2_OK
        SEC
        RTS
G16_PARSE_HEX_2_OK
        ORA     G16_NUM_TEMP
        CLC
        RTS

; Parse exactly two decimal digits, returning A=00..99.
G16_PARSE_DEC2
        JSR     G16_PARSE_CHAR
        BCC     G16_PARSE_DEC2_1
        SEC
        RTS
G16_PARSE_DEC2_1
        CMP     #'0'
        BCC     G16_PARSE_DEC2_BAD
        CMP     #':'
        BCS     G16_PARSE_DEC2_BAD
        SEC
        SBC     #'0'
        STA     G16_NUM_TEMP
        ASL     A                       ; 2*n
        STA     G16_DEC_TEMP
        ASL     A                       ; 4*n
        ASL     A                       ; 8*n
        CLC
        ADC     G16_DEC_TEMP            ; 10*n
        STA     G16_DEC_TEMP
        JSR     G16_PARSE_CHAR
        BCC     G16_PARSE_DEC2_2
        SEC
        RTS
G16_PARSE_DEC2_2
        CMP     #'0'
        BCC     G16_PARSE_DEC2_BAD
        CMP     #':'
        BCS     G16_PARSE_DEC2_BAD
        SEC
        SBC     #'0'
        CLC
        ADC     G16_DEC_TEMP
        CLC
        RTS
G16_PARSE_DEC2_BAD
        SEC
        RTS

; Validate exact semantic fields and downward-only capabilities.
G16_VALIDATE_READY
        LDA     #$00
        STA     G16_PARSE_INDEX
        LDX     #<G16_READY_HEAD
        LDY     #>G16_READY_HEAD
        JSR     G16_EXPECT_Z
        BCC     G16_READY_HEAD_OK
        JMP     G16_READY_BAD
G16_READY_HEAD_OK
        JSR     G16_PARSE_HEX_BYTE
        BCC     G16_READY_VG1_PARSED
        JMP     G16_READY_BAD
G16_READY_VG1_PARSED
        STA     G16_EFFECTIVE_VG1
        AND     #$80
        BEQ     G16_READY_VG1_VALID
        JMP     G16_READY_BAD
G16_READY_VG1_VALID
        LDX     #<G16_READY_GRID
        LDY     #>G16_READY_GRID
        JSR     G16_EXPECT_Z
        BCC     G16_READY_GRID_OK
        JMP     G16_READY_BAD
G16_READY_GRID_OK
        JSR     G16_PARSE_DEC2
        BCC     G16_READY_COLS_PARSED
        JMP     G16_READY_BAD
G16_READY_COLS_PARSED
        STA     G16_EFFECTIVE_COLS
        BNE     G16_READY_COLS_NONZERO
        JMP     G16_READY_BAD
G16_READY_COLS_NONZERO
        CMP     #$51
        BCC     G16_READY_COLS_OK
        JMP     G16_READY_BAD
G16_READY_COLS_OK
        LDX     #<G16_READY_X
        LDY     #>G16_READY_X
        JSR     G16_EXPECT_Z
        BCC     G16_READY_X_OK
        JMP     G16_READY_BAD
G16_READY_X_OK
        JSR     G16_PARSE_DEC2
        BCC     G16_READY_ROWS_PARSED
        JMP     G16_READY_BAD
G16_READY_ROWS_PARSED
        STA     G16_EFFECTIVE_ROWS
        BEQ     G16_READY_BAD
        CMP     #$19
        BCC     G16_READY_ROWS_OK
        JMP     G16_READY_BAD
G16_READY_ROWS_OK
        LDX     #<G16_READY_TAIL
        LDY     #>G16_READY_TAIL
        JSR     G16_EXPECT_Z
        BCC     G16_READY_TAIL_OK
        JMP     G16_READY_BAD
G16_READY_TAIL_OK
        JSR     G16_PARSE_HEX_BYTE
        BCC     G16_READY_DG_PARSED
        JMP     G16_READY_BAD
G16_READY_DG_PARSED
        STA     G16_DG
        AND     #G16_DG_FORBID          ; only $04/$08 may be set
        BEQ     G16_READY_DG_VALID
        JMP     G16_READY_BAD
G16_READY_DG_VALID
        LDA     G16_PARSE_INDEX
        CMP     G16_BODY_LEN
        BEQ     G16_READY_AT_END
        JMP     G16_READY_BAD

; DG bit 2 must exactly describe whether VG1 was reduced from requested $7F.
G16_READY_AT_END
        LDA     G16_EFFECTIVE_VG1
        CMP     #G16_VG1_REQUEST
        BEQ     G16_READY_VG1_FULL
        LDA     G16_DG
        AND     #$04
        BNE     G16_READY_GRID_CHECK
        JMP     G16_READY_BAD
G16_READY_VG1_FULL
        LDA     G16_DG
        AND     #$04
        BEQ     G16_READY_GRID_CHECK
        JMP     G16_READY_BAD

; DG bit 3 must exactly describe whether either GRID dimension was reduced.
G16_READY_GRID_CHECK
        LDA     G16_EFFECTIVE_COLS
        CMP     #SCREEN_COLS
        BNE     G16_READY_GRID_REDUCED
        LDA     G16_EFFECTIVE_ROWS
        CMP     #SCREEN_ROWS
        BNE     G16_READY_GRID_REDUCED
        LDA     G16_DG
        AND     #$08
        BEQ     G16_READY_GOOD
        JMP     G16_READY_BAD
G16_READY_GRID_REDUCED
        LDA     G16_DG
        AND     #$08
        BNE     G16_READY_GOOD
        JMP     G16_READY_BAD

G16_READY_GOOD
        CLC
        RTS
G16_READY_BAD
        SEC
        RTS

G16_SHOW_ERROR
        ; Kernel-local equivalent of ENSURE_LINE_START.  The resident kernel
        ; must not call back into whichever overlay currently occupies $6000.
        LDA     COLUMN
        BEQ     G16_SHOW_ERROR_LINE_OK
        JSR     NEWLINE
G16_SHOW_ERROR_LINE_OK
        LDX     #<TXT_G16_ERROR
        LDY     #>TXT_G16_ERROR
        JSR     PRINT_SCREEN_STRING
        LDA     G16_ERROR
        JSR     PRINT_HEX_BYTE
        JSR     NEWLINE
        RTS

; =============================================================================
; SERIAL PRO / 6551
; =============================================================================

SERIAL_INIT
        LDA     #$00
        JSR     SP_WRITE_STATUS

        LDA     #SP_COMMAND_INIT
        JSR     SP_WRITE_COMMAND

        LDA     #SP_CONTROL_INIT
        JSR     SP_WRITE_CONTROL
        RTS

; ---- dynamically patched hardware wrappers ----------------------------------

SP_READ_STATUS
SP_STATUS_RD
        LDA     $C0A9
        RTS

SP_READ_DATA
SP_DATA_RD
        LDA     $C0A8
        RTS

SP_WRITE_DATA
SP_DATA_WR
        STA     $C0A8
        RTS

SP_WRITE_STATUS
SP_STATUS_WR
        STA     $C0A9
        RTS

SP_WRITE_COMMAND
SP_COMMAND_WR
        STA     $C0AA
        RTS

SP_WRITE_CONTROL
SP_CONTROL_WR
        STA     $C0AB
        RTS

; A = one 8-bit serial byte.
SERIAL_TX_BYTE
        STA     TX_TEMP

SERIAL_TX_WAIT
        JSR     SP_READ_STATUS
        AND     #SP_TDRE
        BEQ     SERIAL_TX_WAIT

        LDA     TX_TEMP
        JSR     SP_WRITE_DATA
        RTS

; A = 7-bit ASCII/control character, transmit as UTF-16LE.
SEND_UTF16_ASCII
        PHA
        JSR     SERIAL_TX_BYTE

        LDA     #$00
        JSR     SERIAL_TX_BYTE

        PLA
        RTS

SERIAL_RX_BLOCK
SERIAL_RX_BLOCK_WAIT
        JSR     SP_READ_STATUS
        AND     #SP_RDRF
        BEQ     SERIAL_RX_BLOCK_WAIT

        JSR     SP_READ_DATA
        RTS

; Once the API response has started, the complete reply has already been queued
; to SPSERIAL.  A bounded idle wait separates the next request from this reply.
SERIAL_RX_NEXT
        LDY     #$10

SERIAL_RX_NEXT_OUTER
        LDX     #$FF

SERIAL_RX_NEXT_INNER
        JSR     SP_READ_STATUS
        AND     #SP_RDRF
        BNE     SERIAL_RX_NEXT_GOT

        DEX
        BNE     SERIAL_RX_NEXT_INNER

        DEY
        BNE     SERIAL_RX_NEXT_OUTER

        CLC
        RTS

SERIAL_RX_NEXT_GOT
        JSR     SP_READ_DATA
        SEC
        RTS

; =============================================================================
; KEYBOARD
; =============================================================================
;
; The GPT terminal reads the Apple II keyboard latch directly.
;
; Why not call Monitor RDKEY/KSW here?
; ------------------------------------
; VideoTerm's KSW handler is a BASIC/GETLN interface.  It interprets caller
; register state and also applies the historical Shift-wire punctuation
; transformations.  That is correct for the resident line editor, but it is
; not the semantic contract wanted by this GPT prompt.
;
; This application instead:
;   1. positions the real CRTC cursor at our current raw-VRAM cursor,
;   2. waits for one Apple keyboard latch value,
;   3. samples $C063 BEFORE clearing the keyboard strobe,
;   4. consumes CTRL-A locally by toggling VideoTerm FLAGS bit 6,
;   5. applies lower-case conversion only to A-Z,
;   6. leaves digits and punctuation literally unchanged.
;
; The result is ordinary 7-bit ASCII suitable for UTF-16LE transmission.
;
GET_KEY
        JSR     SET_HW_CURSOR

GET_KEY_WAIT
        LDA     KBD
        BPL     GET_KEY_WAIT

        STA     KEY_TEMP

        ; The emulator keeps the Apple-II logical Shift state attached to the
        ; latched key.  VideoTerm convention: bit 7 low = Shift held,
        ; bit 7 high = Shift released.
        LDA     SHIFT_WIRE
        STA     SHIFT_TEMP

        ; Clear the keyboard latch only after capturing the Shift state.
        BIT     KBDSTRB

        LDA     KEY_TEMP
        AND     #$7F

        ; CTRL-A is the VideoTerm upper/lower-case toggle and is swallowed.
        CMP     #$01
        BEQ     GET_KEY_TOGGLE_CASE

        ; Only alphabetic keys participate in case conversion.
        CMP     #'A'
        BCC     GET_KEY_DONE

        CMP     #$5B                    ; one past 'Z'
        BCS     GET_KEY_DONE

        STA     KEY_TEMP

        JSR     VIDEX_READ_FLAGS
        AND     #$40
        BEQ     GET_KEY_RETURN_TEMP     ; VideoTerm upper-case mode

        ; In lower-case mode, a logically shifted Apple key stays upper-case.
        LDA     SHIFT_TEMP
        BPL     GET_KEY_RETURN_TEMP     ; bit 7 low = Shift held

        ; Unshifted A-Z becomes true ASCII lower case.
        LDA     KEY_TEMP
        ORA     #$20
        RTS

GET_KEY_RETURN_TEMP
        LDA     KEY_TEMP

GET_KEY_DONE
        RTS

GET_KEY_TOGGLE_CASE
        JSR     VIDEX_TOGGLE_CASE
        JMP     GET_KEY_WAIT

; -----------------------------------------------------------------------------
; VideoTerm FLAGS ($7F8 + slot), bit 6 = lower/upper conversion mode.
; Firmware 2.4 is slot-3-only, so these operands are fixed at $xxFB.
; -----------------------------------------------------------------------------

VIDEX_READ_FLAGS
VT_FLAGS_RD
        LDA     $07FB
        RTS

VIDEX_TOGGLE_CASE
        JSR     VIDEX_READ_FLAGS
        EOR     #$40
VT_FLAGS_WR
        STA     $07FB
        RTS


; =============================================================================
; DOS 3.3 FILE MANAGER
; =============================================================================
;
; Interface documented in Beneath Apple DOS: $03DC locates the 18-byte File
; Manager parameter list and $03D6 executes OPEN/CLOSE/READ/WRITE/DELETE.
; V5 supplies its own work/T/S/data buffers, one persistent set for SAVE and one
; auxiliary set for CMD/LOAD/GPT-created files.
;

DOS_INIT
        LDA     #$00
        STA     DOS_AVAILABLE
        LDA     DOS_WARM
        CMP     #$4C
        BNE     DOS_INIT_DONE
        JSR     DOS_LOC_FPL
        STY     FM_ZPL
        STA     FM_ZPH

        ; Preserve DOS's current volume/drive/slot defaults.
        LDY     #$04
        LDA     (FM_ZPL),Y
        STA     DOS_VOLUME
        INY
        LDA     (FM_ZPL),Y
        STA     DOS_DRIVE
        INY
        LDA     (FM_ZPL),Y
        STA     DOS_SLOT

        LDA     DOS_DRIVE
        BNE     DOS_DRIVE_OK
        LDA     #$01
        STA     DOS_DRIVE
DOS_DRIVE_OK
        LDA     DOS_SLOT
        CMP     #$01
        BCC     DOS_SLOT_DEFAULT
        CMP     #$08
        BCC     DOS_SLOT_OK
DOS_SLOT_DEFAULT
        LDA     #$06
        STA     DOS_SLOT
DOS_SLOT_OK
        LDA     #$01
        STA     DOS_AVAILABLE
DOS_INIT_DONE
        RTS

FM_REQUIRE_DOS
        LDA     DOS_AVAILABLE
        BNE     FM_HAVE_DOS
        LDA     #$FF
        STA     DOS_LAST_RC
        SEC
        RTS
FM_HAVE_DOS
        CLC
        RTS

FM_SET_LOCATION
        LDY     #$04
        LDA     DOS_VOLUME
        STA     (FM_ZPL),Y
        INY
        LDA     DOS_DRIVE
        STA     (FM_ZPL),Y
        INY
        LDA     DOS_SLOT
        STA     (FM_ZPL),Y
        RTS

FM_USE_AUX
        ; AUX and SAVE use independent File Manager buffers. The PAGE scratch arena
        ; is reserved for the one-time briefing plus transient menu/name input.
        JSR     FM_SET_LOCATION
        LDY     #$0C
        LDA     #<AUX_WORK
        STA     (FM_ZPL),Y
        INY
        LDA     #>AUX_WORK
        STA     (FM_ZPL),Y
        INY
        LDA     #<AUX_TS
        STA     (FM_ZPL),Y
        INY
        LDA     #>AUX_TS
        STA     (FM_ZPL),Y
        INY
        LDA     #<AUX_DATA
        STA     (FM_ZPL),Y
        INY
        LDA     #>AUX_DATA
        STA     (FM_ZPL),Y
        RTS

FM_USE_SAVE
        JSR     FM_SET_LOCATION
        LDY     #$0C
        LDA     #<SAVE_WORK
        STA     (FM_ZPL),Y
        INY
        LDA     #>SAVE_WORK
        STA     (FM_ZPL),Y
        INY
        LDA     #<SAVE_TS
        STA     (FM_ZPL),Y
        INY
        LDA     #>SAVE_TS
        STA     (FM_ZPL),Y
        INY
        LDA     #<SAVE_DATA
        STA     (FM_ZPL),Y
        INY
        LDA     #>SAVE_DATA
        STA     (FM_ZPL),Y
        RTS

FM_NAME_AUX
        LDY     #$08
        LDA     #<AUX_NAME
        STA     (FM_ZPL),Y
        INY
        LDA     #>AUX_NAME
        STA     (FM_ZPL),Y
        RTS

FM_NAME_SAVE
        LDY     #$08
        LDA     #<SAVE_NAME
        STA     (FM_ZPL),Y
        INY
        LDA     #>SAVE_NAME
        STA     (FM_ZPL),Y
        RTS

FM_CALL_X0
        LDY     FM_ZPL
        LDA     FM_ZPH
        LDX     #$00
        JSR     DOS_FM
        JMP     FM_READ_RC

FM_CALL_XFF
        LDY     FM_ZPL
        LDA     FM_ZPH
        LDX     #$FF
        JSR     DOS_FM
FM_READ_RC
        LDY     #$0A
        LDA     (FM_ZPL),Y
        STA     DOS_LAST_RC
        BEQ     FM_RC_OK
        SEC
        RTS
FM_RC_OK
        CLC
        RTS

FM_PREP_OPEN
        LDY     #$00
        LDA     #FM_OPEN
        STA     (FM_ZPL),Y
        INY
        LDA     #$00
        STA     (FM_ZPL),Y
        INY
        STA     (FM_ZPL),Y             ; record length = 0
        INY
        STA     (FM_ZPL),Y
        LDY     #$07
        LDA     #DOS_TEXT_TYPE
        STA     (FM_ZPL),Y
        RTS

FM_DELETE_AUX
        JSR     FM_REQUIRE_DOS
        BCS     FM_DELETE_AUX_DONE
        JSR     FM_USE_AUX
        JSR     FM_NAME_AUX
        LDY     #$00
        LDA     #FM_DELETE
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
        BCC     FM_DELETE_AUX_DONE
        LDA     DOS_LAST_RC
        CMP     #FM_FILE_NOT_FOUND
        BEQ     FM_DELETE_AUX_NOT_FOUND
        SEC
        RTS
FM_DELETE_AUX_NOT_FOUND
        CLC
FM_DELETE_AUX_DONE
        RTS

FM_DELETE_SAVE
        JSR     FM_REQUIRE_DOS
        BCS     FM_DELETE_SAVE_DONE
        JSR     FM_USE_SAVE
        JSR     FM_NAME_SAVE
        LDY     #$00
        LDA     #FM_DELETE
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
        BCC     FM_DELETE_SAVE_DONE
        LDA     DOS_LAST_RC
        CMP     #FM_FILE_NOT_FOUND
        BEQ     FM_DELETE_SAVE_NOT_FOUND
        SEC
        RTS
FM_DELETE_SAVE_NOT_FOUND
        CLC
FM_DELETE_SAVE_DONE
        RTS

; OPEN with X=0 has a DOS 3.3 peculiarity:
; if the requested file does not exist, DOS allocates/creates the file but
; deliberately returns RC=$06 (FILE NOT FOUND) with carry set.  That RC means
; "created because X=0", not failure.  Normalize only that result to success.
;
; This is why the original V5 left newly-created CMD/SAVE files empty: the
; catalog entry had already been allocated, but V5 treated the expected $06
; as fatal and returned to the menu before the first WRITE.
FM_OPEN_CREATE_RESULT
        BCC     FM_OPEN_CREATE_OK
        LDA     DOS_LAST_RC
        CMP     #FM_FILE_NOT_FOUND
        BNE     FM_OPEN_CREATE_FAIL
FM_OPEN_CREATE_OK
        LDA     #$00
        STA     DOS_LAST_RC
        CLC
FM_OPEN_CREATE_FAIL
        RTS

FM_CREATE_AUX
        JSR     FM_DELETE_AUX
        BCS     FM_CREATE_AUX_FAIL
        JSR     FM_USE_AUX
        JSR     FM_NAME_AUX
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_X0
        JSR     FM_OPEN_CREATE_RESULT
        BCS     FM_CREATE_AUX_FAIL
        JMP     FM_POSITION_AUX_ZERO
FM_CREATE_AUX_FAIL
        RTS

FM_CREATE_SAVE
        JSR     FM_DELETE_SAVE
        BCS     FM_CREATE_SAVE_FAIL
        JSR     FM_USE_SAVE
        JSR     FM_NAME_SAVE
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_X0
        JSR     FM_OPEN_CREATE_RESULT
        BCS     FM_CREATE_SAVE_FAIL
        JMP     FM_POSITION_SAVE_ZERO
FM_CREATE_SAVE_FAIL
        RTS

FM_OPEN_AUX_EXIST
        JSR     FM_REQUIRE_DOS
        BCS     FM_OPEN_AUX_DONE
        JSR     FM_USE_AUX
        JSR     FM_NAME_AUX
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_XFF
        BCS     FM_OPEN_AUX_DONE
        JSR     FM_POSITION_AUX_ZERO
FM_OPEN_AUX_DONE
        RTS

FM_OPEN_SAVE_EXIST
        JSR     FM_REQUIRE_DOS
        BCS     FM_OPEN_SAVE_DONE
        JSR     FM_USE_SAVE
        JSR     FM_NAME_SAVE
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_XFF
FM_OPEN_SAVE_DONE
        RTS

; DOS File Manager requires a POSITION after every OPEN before READ/WRITE.
FM_POSITION_AUX_ZERO
        JSR     FM_REQUIRE_DOS
        BCS     FM_POSITION_AUX_DONE
        JSR     FM_USE_AUX
        LDY     #$00
        LDA     #FM_POSITION
        STA     (FM_ZPL),Y
        LDY     #$02
        LDA     #$00
        STA     (FM_ZPL),Y              ; record = 0
        INY
        STA     (FM_ZPL),Y
        INY
        STA     (FM_ZPL),Y              ; absolute byte offset = 0
        INY
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
FM_POSITION_AUX_DONE
        RTS

FM_POSITION_SAVE_ZERO
        LDA     #$00
        STA     SAVE_POS_LO
        STA     SAVE_POS_HI
        ; fall through

FM_POSITION_SAVE
        JSR     FM_REQUIRE_DOS
        BCS     FM_POSITION_SAVE_DONE
        JSR     FM_USE_SAVE
        LDY     #$00
        LDA     #FM_POSITION
        STA     (FM_ZPL),Y
        LDY     #$02
        LDA     #$00
        STA     (FM_ZPL),Y              ; record = 0
        INY
        STA     (FM_ZPL),Y
        INY
        LDA     SAVE_POS_LO
        STA     (FM_ZPL),Y              ; absolute byte offset low
        INY
        LDA     SAVE_POS_HI
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
FM_POSITION_SAVE_DONE
        RTS

FM_CLOSE_AUX
        JSR     FM_REQUIRE_DOS
        BCS     FM_CLOSE_AUX_DONE
        JSR     FM_USE_AUX
        LDY     #$00
        LDA     #FM_CLOSE
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
FM_CLOSE_AUX_DONE
        RTS

FM_CLOSE_SAVE
        JSR     FM_REQUIRE_DOS
        BCS     FM_CLOSE_SAVE_DONE
        JSR     FM_USE_SAVE
        LDY     #$00
        LDA     #FM_CLOSE
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
FM_CLOSE_SAVE_DONE
        RTS

; A = exact file byte; FILE_TARGET selects AUX or SAVE.
; This is the only File Manager WRITE implementation used by V5.3 encoders.
FM_WRITE_RAW
        STA     FILE_CHAR
        JSR     FM_REQUIRE_DOS
        BCS     FM_WRITE_RAW_DONE
        LDA     FILE_TARGET
        CMP     #FILE_TARGET_SAVE
        BEQ     FM_WRITE_RAW_SAVE
        JSR     FM_USE_AUX
        JMP     FM_WRITE_RAW_PREP
FM_WRITE_RAW_SAVE
        JSR     FM_USE_SAVE
FM_WRITE_RAW_PREP
        LDY     #$00
        LDA     #FM_WRITE
        STA     (FM_ZPL),Y
        INY
        LDA     #FM_ONE_BYTE
        STA     (FM_ZPL),Y
        LDY     #$08
        LDA     FILE_CHAR
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
        BCS     FM_WRITE_RAW_DONE

        LDA     FILE_TARGET
        CMP     #FILE_TARGET_SAVE
        BNE     FM_WRITE_RAW_OK
        INC     SAVE_POS_LO
        BNE     FM_WRITE_RAW_OK
        INC     SAVE_POS_HI

FM_WRITE_RAW_OK
        CLC
FM_WRITE_RAW_DONE
        RTS

; Small compatibility wrappers keep the call sites readable while all bytes
; still pass through FM_WRITE_RAW.
FM_WRITE_AUX_RAW
        PHA
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        PLA
        JMP     FM_WRITE_RAW

FM_WRITE_SAVE_RAW
        PHA
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        PLA
        JMP     FM_WRITE_RAW

; =============================================================================
; FILE CHARACTER ENCODING
; =============================================================================
;
; Input scalar:
;       BMP          CP_HI:CP_LO
;       supplementary HS_HI:HS_LO + LS_HI:LS_LO
;
; Selection:
;       FILE_TARGET   AUX/SAVE File Manager buffer set
;       FILE_ENCODING DOS high-bit ASCII or DOS-safe escaped UTF-16
;
; The encoding layer emits physical bytes only through FM_WRITE_RAW.
;

; A = one 7-bit source character. FILE_TARGET/FILE_ENCODING are already set.
FILE_ENCODE_ASCII_A
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        JMP     FILE_ENCODE_CP

FILE_ENCODE_CP
        ; Normalize CR/LF once per target so CRLF is stored as one DOS CR.
        LDA     CP_HI
        BNE     FILE_ENCODE_NOT_NL
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     FILE_ENCODE_CR
        CMP     #$0A
        BEQ     FILE_ENCODE_LF

FILE_ENCODE_NOT_NL
        LDX     FILE_TARGET
        LDA     #$00
        STA     ENC_LAST_CR,X
        LDA     FILE_ENCODING
        CMP     #FILE_ENCODING_HISTORY
        BEQ     FILE_ENCODE_HISTORY_CP
        JMP     FILE_ENCODE_DOS_CP

FILE_ENCODE_CR
        LDX     FILE_TARGET
        LDA     #$01
        STA     ENC_LAST_CR,X
        JMP     FILE_ENCODE_NEWLINE

FILE_ENCODE_LF
        LDX     FILE_TARGET
        LDA     ENC_LAST_CR,X
        BEQ     FILE_ENCODE_LF_ONLY
        LDA     #$00
        STA     ENC_LAST_CR,X
        CLC
        RTS
FILE_ENCODE_LF_ONLY

FILE_ENCODE_NEWLINE
        LDA     #KEY_CR
        ORA     #$80
        JMP     FM_WRITE_RAW

FILE_ENCODE_DOS_CP
        LDA     CP_HI
        BNE     FILE_ENCODE_DOS_QMARK
        LDA     CP_LO
        CMP     #$20
        BCC     FILE_ENCODE_DOS_IGNORE
        CMP     #$7F
        BCC     FILE_ENCODE_DOS_ASCII
FILE_ENCODE_DOS_QMARK
        LDA     #'?'
FILE_ENCODE_DOS_ASCII
        ORA     #$80
        JMP     FM_WRITE_RAW
FILE_ENCODE_DOS_IGNORE
        CLC
        RTS

; Escaped history:
;   printable ASCII except backslash -> high-bit DOS text
;   backslash                         -> \\
;   all other UTF-16 units           -> \uXXXX
FILE_ENCODE_HISTORY_CP
        LDA     CP_HI
        BNE     FILE_HISTORY_ESCAPE
        LDA     CP_LO
        CMP     #$20
        BCC     FILE_HISTORY_ESCAPE
        CMP     #$7F
        BCS     FILE_HISTORY_ESCAPE
        CMP     #$5C
        BEQ     FILE_HISTORY_BACKSLASH
        ORA     #$80
        JMP     FM_WRITE_RAW

FILE_HISTORY_BACKSLASH
        LDA     #$DC
        JSR     FM_WRITE_RAW
        BCS     FILE_HISTORY_DONE
        LDA     #$DC
        JMP     FM_WRITE_RAW

FILE_HISTORY_ESCAPE
        LDA     #$DC                    ; '\'
        JSR     FM_WRITE_RAW
        BCS     FILE_HISTORY_DONE
        LDA     #$F5                    ; 'u'
        JSR     FM_WRITE_RAW
        BCS     FILE_HISTORY_DONE
        LDA     CP_HI
        JSR     FILE_WRITE_HEX_BYTE
        BCS     FILE_HISTORY_DONE
        LDA     CP_LO
        JMP     FILE_WRITE_HEX_BYTE
FILE_HISTORY_DONE
        RTS

FILE_WRITE_HEX_BYTE
        PHA
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        JSR     FILE_WRITE_HEX_NIBBLE
        BCS     FILE_HEX_BYTE_FAIL
        PLA
        AND     #$0F
        JMP     FILE_WRITE_HEX_NIBBLE
FILE_HEX_BYTE_FAIL
        PLA
        SEC
        RTS

FILE_WRITE_HEX_NIBBLE
        AND     #$0F
        CMP     #$0A
        BCC     FILE_HEX_DIGIT
        CLC
        ADC     #$37
        JMP     FILE_HEX_WRITE
FILE_HEX_DIGIT
        CLC
        ADC     #'0'
FILE_HEX_WRITE
        ORA     #$80
        JMP     FM_WRITE_RAW

FILE_ENCODE_SURROGATE
        LDX     FILE_TARGET
        LDA     #$00
        STA     ENC_LAST_CR,X
        LDA     FILE_ENCODING
        CMP     #FILE_ENCODING_HISTORY
        BEQ     FILE_SURR_HISTORY
        LDA     #'?'
        ORA     #$80
        JMP     FM_WRITE_RAW

FILE_SURR_HISTORY
        ; Preserve a supplementary scalar as its native UTF-16 surrogate pair.
        LDA     HS_LO
        STA     CP_LO
        LDA     HS_HI
        STA     CP_HI
        JSR     FILE_HISTORY_ESCAPE
        BCS     FILE_SURR_DONE

        LDA     LS_LO
        STA     CP_LO
        LDA     LS_HI
        STA     CP_HI
        JMP     FILE_HISTORY_ESCAPE
FILE_SURR_DONE
        RTS

FM_READ_AUX
        JSR     FM_REQUIRE_DOS
        BCS     FM_READ_AUX_END
        JSR     FM_USE_AUX
        LDY     #$00
        LDA     #FM_READ
        STA     (FM_ZPL),Y
        INY
        LDA     #FM_ONE_BYTE
        STA     (FM_ZPL),Y
        JSR     FM_CALL_XFF
        BCS     FM_READ_AUX_ERROR
        LDY     #$08
        LDA     (FM_ZPL),Y
        SEC
        RTS
FM_READ_AUX_ERROR
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BEQ     FM_READ_AUX_END
FM_READ_AUX_END
        CLC
        RTS

FM_EOF_CLOSE_AUX
        LDA     #$00
        JSR     FM_WRITE_AUX_RAW
        BCC     FM_EOF_AUX_CLOSE_OK
        LDA     DOS_LAST_RC
        PHA
        JSR     FM_CLOSE_AUX
        PLA
        STA     DOS_LAST_RC
        SEC
        RTS
FM_EOF_AUX_CLOSE_OK
        JMP     FM_CLOSE_AUX

FM_EOF_CLOSE_SAVE
        LDA     #$00
        JSR     FM_WRITE_SAVE_RAW
        BCC     FM_EOF_SAVE_CLOSE_OK
        LDA     DOS_LAST_RC
        PHA
        JSR     FM_CLOSE_SAVE
        PLA
        STA     DOS_LAST_RC
        SEC
        RTS
FM_EOF_SAVE_CLOSE_OK
        JMP     FM_CLOSE_SAVE


; =============================================================================
; VIDEOTERM LOW-LEVEL HARDWARE
; =============================================================================

; Read slot ROM once to claim the VideoTerm expansion window.
VIDEX_CLAIM
VT_CLAIM_RD
        LDA     $C300
        RTS

; A=bank 0..3.
VIDEX_SELECT_BANK
        STA     BANK_TEMP
        JSR     VIDEX_CLAIM

        LDA     BANK_TEMP
        ASL     A
        ASL     A
        TAX

VT_BANK_RD
        LDA     $C0B0,X
        RTS

; A=CRTC register, X=data.
VIDEX_CRTC_WRITE
        PHA
        JSR     VIDEX_CLAIM
        PLA
VT_REG_WR
        STA     $C0B0
        TXA
VT_DATA_WR
        STA     $C0B1
        RTS

; =============================================================================
; VIDEX RAW CHARACTER-CELL OUTPUT
; =============================================================================

SCREEN_INIT
        LDA     #$00
        STA     VSTART_LO
        STA     VSTART_HI
        STA     CURSOR_LO
        STA     CURSOR_HI
        STA     COLUMN
        STA     ROW

        JSR     CLEAR_ALL_VRAM
        JSR     SET_DISPLAY_START
        JSR     SET_HW_CURSOR
        RTS

CLEAR_ALL_VRAM
        LDA     #$00
        STA     BANK_TEMP

CLEAR_BANK_LOOP
        LDA     BANK_TEMP
        JSR     VIDEX_SELECT_BANK

        LDX     #$00
        LDA     #SPACE_GLYPH

CLEAR_BANK_BYTES
        STA     VIDEX_RAM0,X
        STA     VIDEX_RAM1,X

        INX
        BNE     CLEAR_BANK_BYTES

        INC     BANK_TEMP
        LDA     BANK_TEMP
        CMP     #$04
        BNE     CLEAR_BANK_LOOP
        RTS

WRITE_GLYPH
        JSR     WRITE_CELL_CURSOR_RAW
        JSR     ADVANCE_CURSOR
        RTS

; A=glyph; current CURSOR address.
WRITE_CELL_CURSOR_RAW
        PHA
        LDA     CURSOR_HI
        LSR     A
        AND     #$03
        JSR     VIDEX_SELECT_BANK
        LDX     CURSOR_LO
        LDA     CURSOR_HI
        AND     #$01
        BNE     WRITE_CURSOR_PAGE1
        PLA
        STA     VIDEX_RAM0,X
        RTS
WRITE_CURSOR_PAGE1
        PLA
        STA     VIDEX_RAM1,X
        RTS

; A=glyph; TMP_HI:TMP_LO physical address.
WRITE_CELL_TEMP_RAW
        PHA
        LDA     TMP_HI
        LSR     A
        AND     #$03
        JSR     VIDEX_SELECT_BANK
        LDX     TMP_LO
        LDA     TMP_HI
        AND     #$01
        BNE     WRITE_TEMP_PAGE1
        PLA
        STA     VIDEX_RAM0,X
        RTS
WRITE_TEMP_PAGE1
        PLA
        STA     VIDEX_RAM1,X
        RTS

; A = raw glyph from TMP_HI:TMP_LO physical address.
READ_CELL_TEMP_RAW
        LDA     TMP_HI
        LSR     A
        AND     #$03
        JSR     VIDEX_SELECT_BANK
        LDX     TMP_LO
        LDA     TMP_HI
        AND     #$01
        BNE     READ_TEMP_PAGE1
        LDA     VIDEX_RAM0,X
        RTS
READ_TEMP_PAGE1
        LDA     VIDEX_RAM1,X
        RTS

ADVANCE_CURSOR
        INC     CURSOR_LO
        BNE     ADVANCE_NO_HI

        INC     CURSOR_HI
        LDA     CURSOR_HI
        AND     #VRAM_MASK_HI
        STA     CURSOR_HI

ADVANCE_NO_HI
        INC     COLUMN

        LDA     COLUMN
        CMP     #SCREEN_COLS
        BCC     ADVANCE_UPDATE

        LDA     #$00
        STA     COLUMN

        INC     ROW

        LDA     ROW
        CMP     #SCREEN_ROWS
        BCC     ADVANCE_UPDATE

        JSR     SCROLL_ONE_ROW
        RTS

ADVANCE_UPDATE
        JSR     SET_HW_CURSOR
        RTS

NEWLINE
        LDA     #SCREEN_COLS
        SEC
        SBC     COLUMN
        STA     DELTA_TEMP

        CLC
        LDA     CURSOR_LO
        ADC     DELTA_TEMP
        STA     CURSOR_LO

        LDA     CURSOR_HI
        ADC     #$00
        AND     #VRAM_MASK_HI
        STA     CURSOR_HI

        LDA     #$00
        STA     COLUMN

        INC     ROW

        LDA     ROW
        CMP     #SCREEN_ROWS
        BCC     NEWLINE_UPDATE

        JSR     SCROLL_ONE_ROW
        RTS

NEWLINE_UPDATE
        JSR     SET_HW_CURSOR
        RTS

SCROLL_ONE_ROW
        CLC
        LDA     VSTART_LO
        ADC     #SCREEN_COLS
        STA     VSTART_LO

        LDA     VSTART_HI
        ADC     #$00
        AND     #VRAM_MASK_HI
        STA     VSTART_HI

        LDA     #$17
        STA     ROW

        LDA     #$00
        STA     COLUMN

        LDA     CURSOR_LO
        STA     TMP_LO
        LDA     CURSOR_HI
        STA     TMP_HI

        LDY     #SCREEN_COLS

SCROLL_CLEAR_BOTTOM
        LDA     #SPACE_GLYPH
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR

        DEY
        BNE     SCROLL_CLEAR_BOTTOM

        JSR     SET_DISPLAY_START
        JSR     SET_HW_CURSOR
        RTS

INC_TEMP_ADDR
        INC     TMP_LO
        BNE     INC_TEMP_DONE

        INC     TMP_HI
        LDA     TMP_HI
        AND     #VRAM_MASK_HI
        STA     TMP_HI

INC_TEMP_DONE
        RTS

SCREEN_BACKSPACE
        LDA     COLUMN
        BNE     BACKSPACE_SAME_ROW

        LDA     ROW
        BEQ     BACKSPACE_DONE

        DEC     ROW
        LDA     #$4F
        STA     COLUMN
        JMP     BACKSPACE_DEC_ADDR

BACKSPACE_SAME_ROW
        DEC     COLUMN

BACKSPACE_DEC_ADDR
        LDA     CURSOR_LO
        BNE     BACKSPACE_DEC_LOW

        LDA     #$FF
        STA     CURSOR_LO

        LDA     CURSOR_HI
        BNE     BACKSPACE_DEC_HI

        LDA     #VRAM_MASK_HI
        STA     CURSOR_HI
        JMP     BACKSPACE_BLANK

BACKSPACE_DEC_HI
        DEC     CURSOR_HI
        JMP     BACKSPACE_BLANK

BACKSPACE_DEC_LOW
        DEC     CURSOR_LO

BACKSPACE_BLANK
        LDA     #SPACE_GLYPH
        JSR     WRITE_CELL_CURSOR_RAW
        JSR     SET_HW_CURSOR

BACKSPACE_DONE
        RTS

; -----------------------------------------------------------------------------
; CRTC start/cursor.
; -----------------------------------------------------------------------------

SET_DISPLAY_START
        LDX     VSTART_HI
        LDA     #CRTC_START_HI
        JSR     VIDEX_CRTC_WRITE

        LDX     VSTART_LO
        LDA     #CRTC_START_LO
        JSR     VIDEX_CRTC_WRITE
        RTS

SET_HW_CURSOR
        LDX     CURSOR_HI
        LDA     #CRTC_CURSOR_HI
        JSR     VIDEX_CRTC_WRITE

        LDX     CURSOR_LO
        LDA     #CRTC_CURSOR_LO
        JSR     VIDEX_CRTC_WRITE

        JSR     SYNC_VIDEX_FIRMWARE
        RTS

; -----------------------------------------------------------------------------
; Import the cursor/display state after Applesoft has been running outside the
; main chat loop.  &GPT uses this before drawing its response with raw VRAM I/O.
; -----------------------------------------------------------------------------

IMPORT_VIDEX_FIRMWARE
        ; Read VideoTerm's own cursor mirrors rather than Applesoft's $24/$25.
        ; During ampersand dispatch Applesoft may transiently repurpose/update its
        ; standard cursor variables, while the VideoTerm workspace is the state
        ; that actually corresponds to the 80-column CRTC/VRAM display.
VT_CHORZ_LD
        LDA     $057B
        STA     COLUMN
VT_CVERT_LD
        LDA     $05FB
        STA     ROW

        ; VideoTerm BASEL/BASEH is the physical VRAM address of the current row.
        ; Use it both to reconstruct the cursor and to derive the visible CRTC
        ; start address.  This is more reliable than interpreting firmware START.
VT_BASEL_LD
        LDA     $047B
        STA     VSTART_LO
        CLC
        ADC     COLUMN
        STA     CURSOR_LO
VT_BASEH_LD
        LDA     $04FB
        AND     #VRAM_MASK_HI
        STA     VSTART_HI
        ADC     #$00
        AND     #VRAM_MASK_HI
        STA     CURSOR_HI

        ; current-row base = display-start + ROW*80 (modulo 2 KB).
        ; Therefore display-start = current-row base - ROW*80.
        LDX     ROW
IMPORT_VSTART_LOOP
        CPX     #$00
        BEQ     IMPORT_VSTART_DONE
        SEC
        LDA     VSTART_LO
        SBC     #SCREEN_COLS
        STA     VSTART_LO
        LDA     VSTART_HI
        SBC     #$00
        AND     #VRAM_MASK_HI
        STA     VSTART_HI
        DEX
        JMP     IMPORT_VSTART_LOOP
IMPORT_VSTART_DONE
        RTS

; -----------------------------------------------------------------------------
; Keep Applesoft/VideoTerm firmware cursor state synchronized with raw VRAM.
; Slot-3 firmware workspace: BASEL/CHORZ=$xx7B; BASEH/CVERT/START=$xxFB.
; -----------------------------------------------------------------------------

SYNC_VIDEX_FIRMWARE
        LDA     COLUMN
        STA     APPLE_CH

VT_CHORZ_ST
        STA     $057B

        LDA     ROW
        STA     APPLE_CV

VT_CVERT_ST
        STA     $05FB

        ; Current row physical base = cursor - column.
        SEC
        LDA     CURSOR_LO
        SBC     COLUMN

VT_BASEL_ST
        STA     $047B

        LDA     CURSOR_HI
        SBC     #$00
        AND     #VRAM_MASK_HI

VT_BASEH_ST
        STA     $04FB

        ; VideoTerm START = display start / 16.
        LDA     VSTART_HI
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        STA     SYNC_TEMP

        LDA     VSTART_LO
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        ORA     SYNC_TEMP
        AND     #$7F

VT_START_ST
        STA     $06FB
        RTS



; =============================================================================
; CHAT OVERLAY BACKING STORE
; =============================================================================
;
; Boot policy:
;   1. If a valid CHAT image is already resident at $6000, cache it in LC.
;   2. Reload it once from LC, validating the backing-store path.
;   3. If no resident CHAT exists, try a previous LC copy.
;   4. If LC is absent/stale/fails, load DOS binary file GPTCHAT.
;
; CHAT_RELOAD is the future XFER -> CHAT return path.  It never returns on
; success; it transfers control to OVL_RESUME after loading CHAT.

KERNEL_BOOT
        ; Preserve the caller's $F0-$F3 before any possible DOS fallback.
        JSR     GPT_BOOT_APP_ZP_SAVE

        LDA     #$00
        STA     CHAT_CACHE_FLAGS

        JSR     CHAT_OVERLAY_VALIDATE
        BCS     KBOOT_NO_RESIDENT

        ; Combined image already contains CHAT.  Cache it in LC, then reload
        ; it once immediately so the LC backing-store path is exercised.
        JSR     CHAT_CACHE_STORE
        BCS     KBOOT_LAUNCH_RESIDENT

        JSR     CHAT_LOAD_FROM_LC
        BCC     KBOOT_LAUNCH

        ; RAM_LOAD_OVERLAY may partially overwrite $6000 on failure.
        ; Recover from the disk overlay before executing uncertain bytes.
        JSR     CHAT_DISK_LOAD
        BCC     KBOOT_DISK_RECOVERED
        JMP     CHAT_BOOT_FATAL

KBOOT_NO_RESIDENT
        ; Future kernel-only boot: try a valid previous LC cache first.
        JSR     CHAT_LOAD_FROM_LC
        BCC     KBOOT_LAUNCH

        ; No usable LC copy: disk is authoritative.
        JSR     CHAT_DISK_LOAD
        BCC     KBOOT_DISK_RECOVERED
        JMP     CHAT_BOOT_FATAL

KBOOT_DISK_RECOVERED
        LDA     CHAT_CACHE_FLAGS
        ORA     #CHAT_CACHE_FROM_DISK
        STA     CHAT_CACHE_FLAGS

        ; Refresh LC if present.  Disk boot must still work without LC.
        JSR     CHAT_CACHE_STORE

KBOOT_LAUNCH
        JSR     GPT_BOOT_APP_ZP_RESTORE
        JMP     CHAT_OVL_INIT_ADDR

KBOOT_LAUNCH_RESIDENT
        JSR     GPT_BOOT_APP_ZP_RESTORE
        JMP     CHAT_OVL_INIT_ADDR

; ---------------------------------------------------------------------------
; Store currently resident CHAT in LC logical bank 0, offset $2000.
; $2000-$3D19 maps entirely into common LC RAM $E000-$FD19.
; ---------------------------------------------------------------------------
CHAT_CACHE_STORE
        JSR     CHAT_OVERLAY_VALIDATE
        BCS     CHAT_CACHE_FAIL

        JSR     GPT_RAM_ZP_SAVE_NOW
        JSR     RAM_INIT
        BCS     CHAT_CACHE_RAM_FAIL

        CMP     #RAM_BACKEND_LC16K
        BNE     CHAT_CACHE_NOT_LC

        LDA     #$00
        LDX     #$00
        JSR     RAM_SELECT_BANK
        BCS     CHAT_CACHE_RAM_FAIL

        LDA     #<CHAT_LC_STORE_DESC
        LDX     #>CHAT_LC_STORE_DESC
        JSR     RAM_WRITE_BLOCK
        BCS     CHAT_CACHE_RAM_FAIL

        PHP
        PHA
        JSR     GPT_RAM_ZP_RESTORE_NOW
        PLA
        PLP

        LDA     CHAT_CACHE_FLAGS
        ORA     #CHAT_CACHE_READY
        STA     CHAT_CACHE_FLAGS
        CLC
        RTS

CHAT_CACHE_NOT_LC
        LDA     #RAM_E_NO_DEVICE
        SEC
CHAT_CACHE_RAM_FAIL
        PHP
        PHA
        JSR     GPT_RAM_ZP_RESTORE_NOW
        PLA
        PLP
CHAT_CACHE_FAIL
        SEC
        RTS

; ---------------------------------------------------------------------------
; Load CHAT from LC, then validate its signature.
; On failure $6000-$7D19 must be considered potentially invalid.
; ---------------------------------------------------------------------------
CHAT_LOAD_FROM_LC
        JSR     GPT_RAM_ZP_SAVE_NOW
        JSR     RAM_INIT
        BCS     CHAT_LC_LOAD_FAIL

        CMP     #RAM_BACKEND_LC16K
        BNE     CHAT_LC_NOT_PRESENT

        LDA     #<CHAT_LC_LOAD_DESC
        LDX     #>CHAT_LC_LOAD_DESC
        JSR     RAM_LOAD_OVERLAY
        BCS     CHAT_LC_LOAD_FAIL

        PHP
        PHA
        JSR     GPT_RAM_ZP_RESTORE_NOW
        PLA
        PLP

        JSR     CHAT_OVERLAY_VALIDATE
        BCS     CHAT_LC_BAD_IMAGE

        LDA     CHAT_CACHE_FLAGS
        ORA     #(CHAT_CACHE_READY+CHAT_CACHE_VERIFIED)
        STA     CHAT_CACHE_FLAGS
        CLC
        RTS

CHAT_LC_NOT_PRESENT
        LDA     #RAM_E_NO_DEVICE
        SEC
CHAT_LC_LOAD_FAIL
        PHP
        PHA
        JSR     GPT_RAM_ZP_RESTORE_NOW
        PLA
        PLP
CHAT_LC_BAD_IMAGE
        SEC
        RTS

; ---------------------------------------------------------------------------
; Future transfer-overlay return path:
; LC first, DOS GPTCHAT fallback.
; ---------------------------------------------------------------------------
CHAT_RELOAD
        JSR     CHAT_LOAD_FROM_LC
        BCC     CHAT_RELOAD_GO

        JSR     CHAT_DISK_LOAD
        BCC     CHAT_RELOAD_DISK_OK
        JMP     CHAT_BOOT_FATAL

CHAT_RELOAD_DISK_OK
        JSR     CHAT_CACHE_STORE         ; refresh LC if available
CHAT_RELOAD_GO
        JMP     CHAT_OVL_RESUME_ADDR

; Diagnostic/fallback bootstrap.  CALLing KAPI_CHAT_DISK_BOOT forces disk.
CHAT_DISK_BOOT
        JSR     GPT_BOOT_APP_ZP_SAVE
        JSR     CHAT_DISK_LOAD
        BCC     CHAT_DISK_BOOT_OK
        JMP     CHAT_BOOT_FATAL

CHAT_DISK_BOOT_OK
        JSR     CHAT_CACHE_STORE
        JSR     GPT_BOOT_APP_ZP_RESTORE
        JMP     CHAT_OVL_INIT_ADDR

; ---------------------------------------------------------------------------
; CHAT overlay signature in reserved ABI padding.
; ---------------------------------------------------------------------------
CHAT_OVERLAY_VALIDATE
        LDA     CHAT_OVL_MAGIC_ADDR+$00
        CMP     #$47                    ; G
        BNE     CHAT_OVERLAY_BAD
        LDA     CHAT_OVL_MAGIC_ADDR+$01
        CMP     #$31                    ; 1
        BNE     CHAT_OVERLAY_BAD
        LDA     CHAT_OVL_MAGIC_ADDR+$02
        CMP     #$36                    ; 6
        BNE     CHAT_OVERLAY_BAD
        LDA     CHAT_OVL_MAGIC_ADDR+$03
        CMP     #$43                    ; C
        BNE     CHAT_OVERLAY_BAD
        LDA     CHAT_OVL_MAGIC_ADDR+$04
        CMP     #$01
        BNE     CHAT_OVERLAY_BAD
        LDA     CHAT_OVL_MAGIC_ADDR+$05
        CMP     #$01
        BNE     CHAT_OVERLAY_BAD
        CLC
        RTS
CHAT_OVERLAY_BAD
        SEC
        RTS

; ---------------------------------------------------------------------------
; DOS fallback loader.
;
; GPTCHAT is a DOS 3.3 Binary file:
;   load address $6000
;   image length $1D1A
;
; The raw file begins with four bytes:
;   load address lo/hi, image length lo/hi
; followed by the binary image.
; ---------------------------------------------------------------------------
CHAT_DISK_LOAD
        JSR     GPT_RAM_ZP_SAVE_NOW

        ; CHAT_DISK_LOAD can run before CHAT START (KERNEL_BOOT or the forced
        ; KAPI_CHAT_DISK_BOOT entry).  START normally performs DOS_INIT, but a
        ; pre-START disk fallback cannot rely on that.  In particular, ESC-Q
        ; restores the caller's $F2/$F3, so the DOS File Manager parameter-list
        ; pointer must be reacquired before FM_OPEN_AUX_EXIST.
        JSR     DOS_INIT
        LDA     DOS_AVAILABLE
        BEQ     CHAT_DISK_FAIL_RESTORE

        JSR     CHAT_SET_DISK_NAME

        JSR     FM_OPEN_AUX_EXIST
        BCS     CHAT_DISK_FAIL_RESTORE

        ; OPEN reports actual existing file type in parameter-list byte 7.
        LDY     #$07
        LDA     (FM_ZPL),Y
        CMP     #DOS_BINARY_TYPE
        BNE     CHAT_DISK_FAIL_CLOSE

        ; Binary header: load address $6000.
        JSR     FM_READ_AUX
        BCC     CHAT_DISK_FAIL_CLOSE
        CMP     #<CHAT_IMAGE_START
        BNE     CHAT_DISK_FAIL_CLOSE

        JSR     FM_READ_AUX
        BCC     CHAT_DISK_FAIL_CLOSE
        CMP     #>CHAT_IMAGE_START
        BNE     CHAT_DISK_FAIL_CLOSE

        ; Binary header: exact image length $1D1A.
        JSR     FM_READ_AUX
        BCC     CHAT_DISK_FAIL_CLOSE
        CMP     #<CHAT_IMAGE_LEN
        BNE     CHAT_DISK_FAIL_CLOSE

        JSR     FM_READ_AUX
        BCC     CHAT_DISK_FAIL_CLOSE
        CMP     #>CHAT_IMAGE_LEN
        BNE     CHAT_DISK_FAIL_CLOSE

        LDA     #<CHAT_IMAGE_START
        STA     RAM_ZP_MAIN_LO
        LDA     #>CHAT_IMAGE_START
        STA     RAM_ZP_MAIN_HI
        LDA     #<CHAT_IMAGE_LEN
        STA     RAM_ZP_LEN_LO
        LDA     #>CHAT_IMAGE_LEN
        STA     RAM_ZP_LEN_HI

CHAT_DISK_READ_LOOP
        LDA     RAM_ZP_LEN_LO
        ORA     RAM_ZP_LEN_HI
        BEQ     CHAT_DISK_READ_DONE

        JSR     FM_READ_AUX
        BCC     CHAT_DISK_FAIL_CLOSE

        LDY     #$00
        STA     (RAM_ZP_MAIN_LO),Y

        INC     RAM_ZP_MAIN_LO
        BNE     CHAT_DISK_PTR_OK
        INC     RAM_ZP_MAIN_HI
CHAT_DISK_PTR_OK

        LDA     RAM_ZP_LEN_LO
        BNE     CHAT_DISK_DEC_LOW
        DEC     RAM_ZP_LEN_HI
CHAT_DISK_DEC_LOW
        DEC     RAM_ZP_LEN_LO
        JMP     CHAT_DISK_READ_LOOP

CHAT_DISK_READ_DONE
        JSR     FM_CLOSE_AUX
        BCS     CHAT_DISK_FAIL_RESTORE

        JSR     CHAT_OVERLAY_VALIDATE
        BCS     CHAT_DISK_FAIL_RESTORE

        JSR     GPT_RAM_ZP_RESTORE_NOW

        LDA     CHAT_CACHE_FLAGS
        ORA     #CHAT_CACHE_FROM_DISK
        STA     CHAT_CACHE_FLAGS
        CLC
        RTS

CHAT_DISK_FAIL_CLOSE
        JSR     FM_CLOSE_AUX
CHAT_DISK_FAIL_RESTORE
        JSR     GPT_RAM_ZP_RESTORE_NOW
        SEC
        RTS

; DOS File Manager wants a 30-byte high-bit padded filename.
CHAT_SET_DISK_NAME
        LDX     #$1D
        LDA     #$A0
CHAT_NAME_FILL
        STA     AUX_NAME,X
        DEX
        BPL     CHAT_NAME_FILL

        LDX     #$06
CHAT_NAME_COPY
        LDA     CHAT_DISK_NAME,X
        ORA     #$80
        STA     AUX_NAME,X
        DEX
        BPL     CHAT_NAME_COPY
        RTS

; Preserve caller zero page $F0-$F3 across any pre-START disk load.
GPT_BOOT_APP_ZP_SAVE
        LDA     MSG_ZPL
        STA     SAVE_ZP_LO
        LDA     MSG_ZPH
        STA     SAVE_ZP_HI
        LDA     FM_ZPL
        STA     SAVE_FM_ZP_LO
        LDA     FM_ZPH
        STA     SAVE_FM_ZP_HI
        RTS

GPT_BOOT_APP_ZP_RESTORE
        LDA     SAVE_ZP_LO
        STA     MSG_ZPL
        LDA     SAVE_ZP_HI
        STA     MSG_ZPH
        LDA     SAVE_FM_ZP_LO
        STA     FM_ZPL
        LDA     SAVE_FM_ZP_HI
        STA     FM_ZPH
        RTS

; Preserve Applesoft's $E8-$EF while the RAM API/backend uses it.
GPT_RAM_ZP_SAVE_NOW
        LDX     #$07
GPT_RAM_ZP_SAVE_LOOP
        LDA     $E8,X
        STA     GPT_RAM_ZP_SAVE,X
        DEX
        BPL     GPT_RAM_ZP_SAVE_LOOP
        RTS

GPT_RAM_ZP_RESTORE_NOW
        LDX     #$07
GPT_RAM_ZP_RESTORE_LOOP
        LDA     GPT_RAM_ZP_SAVE,X
        STA     $E8,X
        DEX
        BPL     GPT_RAM_ZP_RESTORE_LOOP
        RTS

CHAT_BOOT_FATAL
        JSR     GPT_BOOT_APP_ZP_RESTORE

        ; VideoTerm may not have been initialized yet; use Monitor COUT.
        LDX     #$00
CHAT_FATAL_LOOP
        LDA     CHAT_FATAL_TEXT,X
        BEQ     CHAT_FATAL_DONE
        ORA     #$80
        JSR     M_COUT
        INX
        BNE     CHAT_FATAL_LOOP
CHAT_FATAL_DONE
        LDA     #$8D
        JSR     M_COUT
        JSR     GPT_BOOT_APP_ZP_RESTORE
        RTS

CHAT_LC_STORE_DESC
        HEX     002000601A1D0000
CHAT_LC_LOAD_DESC
        HEX     0000002000601A1D00000000

CHAT_DISK_NAME
        ASC     "GPTCHAT"
        HEX     00
CHAT_FATAL_TEXT
        ASC     "GPTCHAT LOAD FAILED"
        HEX     00

        .ASSERT CHAT_IMAGE_START+CHAT_IMAGE_LEN = $7D1A, error, "CHAT image length changed"
        .ASSERT GPT_RAM_ZP_SAVE >= $8CF8, error, "RAM ZP save area moved"
        .ASSERT GPT_RAM_ZP_SAVE+$08 <= $8D00, error, "RAM ZP save collides with RAM API"

; =============================================================================
; RESIDENT KERNEL READ-ONLY DATA
; =============================================================================

; =============================================================================

SP_CRC_LO
        HEX     5B1DDE925117D4

SP_CRC_HI
        HEX     06A103AF0DAA08

; =============================================================================
; STARTUP MESSAGES
; =============================================================================

MSG_SERIAL_SLOT
        ASC     "SERIAL PRO SLOT (1-7)? "
        HEX     00

MSG_VIDEX_SLOT
        ASC     "VIDEX SLOT (1-7)? "
        HEX     00

MSG_VIDEX_SLOT3
        ASC     "VIDEX FIRMWARE 2.4 REQUIRES SLOT 3"
        HEX     00

; =============================================================================

; G16/1 immutable control-plane literals moved out of shared scratch.
; G16/1 immutable handshake literals. These are code/data, not PAGE scratch:
; the gateway may need them again only after a binary reload, while the receive
; buffer itself safely overlays INPUT_BUF during first-start negotiation.
G16_HELLO_BODY
        ASC     "G16|1|0001|HELLO|MODE=UTF16LE;DP=G16D1;ROM=VN;BASE=CP437;VG1=7F;GRID=80x24;FALL=CELL1"
        HEX     00
G16_ACK_BODY
        ASC     "G16|1|0001|ACK|FOR=HELLO"
        HEX     00
G16_WAIT_PREFIX
        ASC     "G16|1|0001|WAIT|"
        HEX     00
G16_READY_PREFIX
        ASC     "G16|1|0001|READY|"
        HEX     00
G16_NAK_PREFIX
        ASC     "G16|1|0001|NAK|"
        HEX     00
G16_FAIL_PREFIX
        ASC     "G16|1|0001|FAIL|"
        HEX     00

; Canonical READY parser fragments. ROM/BASE/FALL are exact; VG1/GRID values
; appear between these literals and are validated as downward-only capabilities.
G16_READY_HEAD
        ASC     "G16|1|0001|READY|MODE=UTF16LE;DP=G16D1;ROM=VN;BASE=CP437;VG1="
        HEX     00
G16_READY_GRID
        ASC     ";GRID="
        HEX     00
G16_READY_X
        ASC     "x"
        HEX     00
G16_READY_TAIL
        ASC     ";FALL=CELL1;DG="
        HEX     00


; G16 error text is resident because G16_SHOW_ERROR is resident.
        HEX     00

TXT_G16_ERROR
        ASC     "GPT16 NEGOTIATION FAILED $"
        HEX     00

KERNEL_CODE_END
        .ASSERT KERNEL_CODE_END <= $6000, error, "Resident kernel exceeds $4000-$5FFF"


; =============================================================================
; CARD-NEUTRAL RAM API + VALIDATED LC16K BACKEND
; =============================================================================
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

        .ASSERT RLC_LOAD_PREFIX_END <= GPT_RAM_ZP_SAVE, error, "LC prefix overlaps GPT RAM ZP save"
        .ASSERT RLC_BACKEND_END <= $9000, error, "LC backend overlaps DOS workspace"
