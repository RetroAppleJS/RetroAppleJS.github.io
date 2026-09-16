; =============================================================================
; GPT16_V6_10_XFER_STUB.S
; =============================================================================
; Placeholder transfer overlay.  It deliberately implements NO Kermit yet.
; It proves the fixed $6000 overlay ABI before protocol code is introduced.
; =============================================================================

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

        ORG     $6000

OVL_INIT
        JMP     XFER_INIT
OVL_RUN
        JMP     XFER_RUN
OVL_RX_SOH
        JMP     XFER_RX_SOH
OVL_RESUME
        JMP     XFER_RUN
OVL_SHUTDOWN
        JMP     XFER_SHUTDOWN
OVL_EVENT
        JMP     XFER_RUN

        .ASSERT * <= $6040, error, "XFER overlay ABI exceeds $6000-$603F"
        .RES    $6040-*

XFER_INIT
        CLC
        RTS

XFER_RUN
        CLC
        RTS

; No Kermit parser in the split baseline.  C=1 explicitly means unsupported.
XFER_RX_SOH
        SEC
        RTS

XFER_SHUTDOWN
        CLC
        RTS

XFER_CODE_END
        .ASSERT XFER_CODE_END <= $8400, error, "XFER overlay exceeds $6000-$83FF"
