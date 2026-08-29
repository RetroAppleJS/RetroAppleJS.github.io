; =============================================================================
; GPT16_VIDEX_NORMAL_V5_7.S
; =============================================================================
;
; RetroAppleJS ASM_core.js / NMOS 6502
; Load address : $6000
; Call from    : Applesoft BASIC with CALL 24576
;
; V5.7 self-contained printable GPT file-control protocol
; -------------------------------------------------------
;   * GPT emits printable, line-oriented control tokens:
;         [[A2:C:FILENAME]]   create/capture DOS text file
;         [[A2:E]]            end/close captured file
;         [[A2:S:FILENAME]]   start chat-history save (name optional)
;         [[A2:L:FILENAME]]   load file back to GPT
;   * The 6502 now recognizes these tokens directly.  A JavaScript-side token
;     translator may still convert them to the older U+001B protocol, but V5.7
;     no longer depends on that translation being installed or active.
;   * Token recognition is line-oriented.  An ordinary response line beginning
;     with '[' is buffered until CR/LF; if it is not a valid A2 token, the line
;     is replayed unchanged through the normal display/history/file path.
;   * For robustness, an accidental extra type suffix such as
;         [[A2:C:HW:BAS]]
;     is accepted as create file HW; the suffix is ignored.  The documented form
;     remains [[A2:C:HW]].
;   * The older raw U+001B C/S/L/E protocol remains accepted for compatibility.
;   * RUN/BRUN/EXEC/CALL are allowed as text inside a captured CMD file. GPT must
;     not execute or claim to execute them immediately on the user's behalf.
;
; V5.3 history / prompt / commit correction
; -----------------------------------------
;   * SAVE history is DOS/TYPE-safe high-bit text. Unicode not directly printable
;     through VideoTerm firmware is stored losslessly as ASCII UTF-16 escapes:
;         U+2500 -> \u2500
;         U+1F600 -> \uD83D\uDE00
;     Literal backslash is stored as \\.
;   * A three-byte $81,$82,$83 no-op magic identifies escaped history to LOAD.
;     VideoTerm firmware ignores those bytes when a DOS TYPE command prints them.
;   * CMD/GPT-created EXEC files remain DOS high-bit 7-bit ASCII + CR.
;   * One common raw DOS byte writer remains shared by both encoding strategies.
;   * Manual LOAD is a local SPACE-paged viewer for both escaped history and
;     ordinary DOS text/CMD files; only history-magic files decode Unicode escapes.
;   * Prompt requests now allow 512 ASCII characters using a 16-bit count/index.
;   * After each submitted prompt, SAVE is closed/reopened and POSITIONed to the
;     maintained byte offset. This commits the previous reply + current request
;     while GPT is processing the newly submitted request.
;
; V5.1 DOS correction retained
; ----------------------------
;   * DOS File Manager OPEN with X=0 creates a missing file but returns
;     RC=$06 by design. Treat that specific create-result as success.
;   * Fixes CMD and SAVE creating catalog entries then aborting empty.
;
; V5 additions
; ------------
;   * ESC opens a transient one-line 80-column command menu:
;       [U]P [D]OWN [C]MD [S]AVE [L]OAD [Q]UIT
;   * UP/DOWN are reserved for later page navigation.
;   * CMD creates a DOS 3.3 sequential text file and accepts line-by-line text.
;   * SAVE records requests/replies to a DOS-safe escaped-Unicode history file.
;   * LOAD locally displays escaped history or ordinary DOS text with pagination.
;   * GPT receives a hidden startup briefing describing the terminal/file policy.
;   * GPT may request file create/save/load operations through printable A2
;     control lines parsed directly by the application.  Raw U+001B controls are
;     also retained for compatibility. The application never executes files on
;     GPT's behalf.
;   * Prompt text is buffered locally and sent atomically on RETURN, so opening
;     the ESC menu never leaves a partial request pending inside SPGPT.
;
; V4 features retained
; --------------------
;   * 7-row ChatGPT/OpenAI splash banner from asm/TEXT/CHATGPT_LOGO_151.S.
;   * User prompt is ] with no following space.
;   * GPT responses start directly on the next line; no GPT16> label.
;
; Changes from V1
; ---------------
;   * Serial Pro slot is auto-detected by CRC16 over $Cn00-$CnFF.
;   * VideoTerm firmware is auto-detected by CRC16 over $Cn00-$CnFF.
;   * If detection is missing/ambiguous, the user is asked for the slot.
;   * VideoTerm firmware 2.4 is treated hardware-faithfully as slot-3-only.
;   * VideoTerm is explicitly entered through its slot ROM, equivalent to the
;     first output after PR#3: it installs KSW/CSW and initializes the board.
;   * Keyboard input is polled directly from the Apple II latch.
;   * CTRL-A toggles the real VideoTerm upper/lower-case flag.
;   * A-Z case conversion is application-owned; digits/punctuation remain
;     literal ASCII, so 0 and @ are not repurposed by VideoTerm KEYSTAT.
;   * The logical Apple-II Shift wire at $C063 is sampled before KBDSTRB.
;   * Serial Pro I/O and VideoTerm device-select addresses are patched from the
;     discovered slots instead of being hard-coded to slots 2 and 3.
;
; Conversation UI
; ---------------
;       [7-row ChatGPT / OpenAI banner]
;       ]user request
;       GPT response
;       ]next request
;       ...
;
; Exit
; ----
;   Press ESC and then Q. ESC is not transmitted to GPT.
;   Any key other than Q after ESC cancels the exit attempt and is processed
;   normally as part of the current request.
;
; IMPORTANT ABOUT PASTEBOARD CASE
; -------------------------------
; The current A2KBD:text destination converts semantic a-z to the uppercase
; Apple II+ keyboard codes before they reach the keyboard latch.  This assembly
; cannot reconstruct case information that has already been discarded there.
;
; Once lower-case mode has been enabled with CTRL-A, this GPT routine converts
; queued A-Z keys to lower case itself, using the logical Shift wire to retain
; an explicitly shifted capital.
;
; Preserving arbitrary mixed-case pasteboard text without CTRL-A requires a
; separate semantic-input change in the emulator/pipeline layer.
;
; Card identification
; -------------------
; CRC implementation is the same CRC16 used by COM.crc16():
;
;       init = $FFFF
;       reflected polynomial = $A001
;
; Serial Pro v2.0 slot-page CRCs:
;       slot 1  $065B
;       slot 2  $A11D
;       slot 3  $03DE
;       slot 4  $AF92
;       slot 5  $0D51
;       slot 6  $AA17
;       slot 7  $08D4
;
; VideoTerm firmware 2.4 slot-page CRC:
;       $8E97
;
; The VideoTerm 2.4 firmware itself is slot-3-specific.  Its own errata removes
; slot independence.  A CRC hit outside slot 3 is therefore reported rather
; than silently treated as a movable 80-column card.
;
; Protocol
; --------
; User keyboard characters are transmitted to GPT16 as UTF-16LE:
;
;       "A"       -> $41 $00
;       "a"       -> $61 $00
;       RETURN    -> $0D $00
;
; GPT16 replies are received as UTF-16LE and transcoded through the exact
; VIDEX:NORMAL Unicode reverse mapping. V5.7 recognizes printable [[A2:...]]
; control lines directly on the 6502. A Serial Pro peer that translates those
; tokens to the older U+001B protocol remains fully compatible.
;
; =============================================================================

        ORG     $6000

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
KEY_CR          EQU     $0D
KEY_ESC         EQU     $1B
KEY_DEL         EQU     $7F

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

; =============================================================================
; VIDEOTERM
; =============================================================================

VIDEX_RAM0      EQU     $CC00
VIDEX_RAM1      EQU     $CD00

SCREEN_COLS     EQU     $50             ; 80
SCREEN_ROWS     EQU     $18             ; 24
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

        JSR     DETECT_CARDS
        BCS     START_CARDS_OK
        JMP     START_ABORT
START_CARDS_OK

        JSR     PATCH_SERIAL_SLOT
        JSR     PATCH_VIDEX_SLOT
        JSR     ENGAGE_VIDEX

        JSR     SERIAL_INIT
        JSR     DOS_INIT
        JSR     SCREEN_INIT
        JSR     PRINT_CHATGPT_LOGO

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI
        STA     LAST_CR
        STA     SAVE_ACTIVE
        STA     SAVE_POS_LO
        STA     SAVE_POS_HI
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
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
        STA     LOAD_SURROGATE
        STA     LOAD_LAST_CR
        STA     ESC_DIGITS
        STA     HEX_TEMP
        STA     A2_CAPTURE
        STA     A2_LEN
        STA     A2_BODY_END
        STA     A2_PENDING_LO
        STA     A2_PENDING_HI

        ; Send the application/file-policy briefing as a normal GPT16 request,
        ; but suppress its acknowledgement from the VideoTerm display.
        JSR     SEND_GPT_BRIEFING
        LDA     #$01
        STA     RX_SILENT
        JSR     RECEIVE_GPT16
        LDA     #$00
        STA     RX_SILENT

        JSR     PRINT_USER_PROMPT

MAIN_INPUT
        JSR     GET_KEY

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
        JSR     WRITE_GLYPH
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
        JSR     SCREEN_BACKSPACE
        JMP     MAIN_INPUT

; -----------------------------------------------------------------------------
; Submit one locally buffered request.
; -----------------------------------------------------------------------------

SUBMIT_LINE
        LDA     INPUT_COUNT_LO
        ORA     INPUT_COUNT_HI
        BNE     SUBMIT_NONEMPTY

        JSR     NEWLINE
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

SUBMIT_NONEMPTY
        ; Submit first so GPT can work while DOS commits the previous reply and
        ; this request.
        JSR     SEND_INPUT_BUFFER
        JSR     HISTORY_WRITE_USER_BUFFER
        JSR     HISTORY_COMMIT_REOPEN

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI

        JSR     NEWLINE

        LDA     #AUTO_LOAD_MAX
        STA     AUTO_ACTION_BUDGET

        JSR     RECEIVE_GPT16
        JSR     HANDLE_PENDING_LOADS

        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

SEND_INPUT_BUFFER
        LDA     #$00
        STA     INPUT_INDEX_LO
        STA     INPUT_INDEX_HI

SEND_INPUT_LOOP
        LDA     INPUT_INDEX_HI
        CMP     INPUT_COUNT_HI
        BNE     SEND_INPUT_HAVE
        LDA     INPUT_INDEX_LO
        CMP     INPUT_COUNT_LO
        BEQ     SEND_INPUT_END

SEND_INPUT_HAVE
        LDX     INPUT_INDEX_LO
        LDA     INPUT_INDEX_HI
        BEQ     SEND_INPUT_PAGE0
        LDA     INPUT_BUF+$100,X
        JMP     SEND_INPUT_CHAR
SEND_INPUT_PAGE0
        LDA     INPUT_BUF,X
SEND_INPUT_CHAR
        JSR     SEND_UTF16_ASCII

        INC     INPUT_INDEX_LO
        BNE     SEND_INPUT_LOOP
        INC     INPUT_INDEX_HI
        JMP     SEND_INPUT_LOOP

SEND_INPUT_END
        LDA     #KEY_CR
        JSR     SEND_UTF16_ASCII
        RTS

; =============================================================================
; ESC MENU / FILE UI
; =============================================================================

MENU_ENTER
        JSR     MENU_SAVE_ROW
        JSR     MENU_DRAW

MENU_WAIT
        JSR     GET_KEY_WAIT
        JSR     ASCII_TO_UPPER

        CMP     #KEY_ESC
        BEQ     MENU_CANCEL
        CMP     #'U'
        BEQ     MENU_WAIT               ; reserved: page up
        CMP     #'D'
        BEQ     MENU_WAIT               ; reserved: page down
        CMP     #'C'
        BNE     MENU_NOT_C
        JMP     MENU_CMD
MENU_NOT_C
        CMP     #'S'
        BNE     MENU_NOT_S
        JMP     MENU_SAVE
MENU_NOT_S
        CMP     #'L'
        BNE     MENU_NOT_L
        JMP     MENU_LOAD
MENU_NOT_L
        CMP     #'Q'
        BNE     MENU_WAIT
        JMP     MENU_QUIT

MENU_CANCEL
        JSR     MENU_RESTORE_ROW
        JSR     SET_HW_CURSOR
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
        JSR     FM_CREATE_AUX
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

MENU_SAVE
        LDX     #<TXT_SAVE_FILE
        LDY     #>TXT_SAVE_FILE
        LDA     #$01
        STA     NAME_DEFAULT
        JSR     MENU_FILENAME_INPUT
        BCS     MENU_SAVE_NAME_OK
        JMP     MENU_REDRAW
MENU_SAVE_NAME_OK

        LDA     NAME_LEN
        BNE     MENU_SAVE_HAVE_NAME
        JSR     SET_DEFAULT_HISTORY_NAME
MENU_SAVE_HAVE_NAME
        JSR     COPY_INPUT_TO_SAVE_NAME
        JSR     SAVE_REOPEN_NEW
        BCC     MENU_SAVE_OK
        JSR     MENU_RESTORE_ROW
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

MENU_SAVE_OK
        JSR     MENU_RESTORE_ROW
        JSR     SET_HW_CURSOR
        JMP     MAIN_INPUT

MENU_LOAD
        LDX     #<TXT_LOAD_FILE
        LDY     #>TXT_LOAD_FILE
        LDA     #$00
        STA     NAME_DEFAULT
        JSR     MENU_FILENAME_INPUT
        BCS     MENU_LOAD_NAME_OK
        JMP     MENU_REDRAW
MENU_LOAD_NAME_OK

        JSR     COPY_INPUT_TO_AUX_NAME
        LDA     #$00
        STA     INPUT_COUNT_LO          ; LOAD becomes the next user request
        STA     INPUT_COUNT_HI
        JSR     MENU_RESTORE_ROW
        JSR     ENSURE_LINE_START
        ; Manual LOAD distinguishes saved chat history from ordinary DOS text.
        ; Escaped V5.3 history is rendered locally; ordinary text retains the
        ; existing behavior of becoming the next GPT request.
        JSR     LOAD_AUX_FROM_MENU
        BCC     MENU_LOAD_OK
        JSR     SHOW_DOS_ERROR_AND_PROMPT
        JMP     MAIN_INPUT

MENU_LOAD_OK
        LDA     LOAD_SENT_GPT
        BEQ     MENU_LOAD_VIEW_DONE

        JSR     HISTORY_COMMIT_REOPEN
        LDA     #AUTO_LOAD_MAX
        STA     AUTO_ACTION_BUDGET
        JSR     RECEIVE_GPT16
        JSR     HANDLE_PENDING_LOADS

MENU_LOAD_VIEW_DONE
        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
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
        JSR     SET_HW_CURSOR
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
        JSR     READ_CELL_TEMP_RAW
        STA     MENU_ROW_SAVE,Y
        JSR     INC_TEMP_ADDR
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        CPY     #SCREEN_COLS
        BNE     OVERLAY_STRING_LOOP
OVERLAY_STRING_DONE
        STY     OVERLAY_PREFIX_LEN
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

; X/Y label, NAME_DEFAULT indicates whether blank RETURN is accepted.
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
        JSR     OVERLAY_SET_INPUT_CURSOR

MENU_FILENAME_LOOP
        JSR     GET_KEY_WAIT
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
        LDA     NAME_DEFAULT
        BEQ     MENU_FILENAME_LOOP
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
        JSR     VIDEX_CRTC_WRITE
        LDX     TMP_LO
        LDA     #CRTC_CURSOR_LO
        JSR     VIDEX_CRTC_WRITE
        RTS

OVERLAY_WRITE_INPUT_CHAR
        STA     GLYPH_TEMP
        JSR     OVERLAY_INPUT_ADDR
        ; NAME_LEN already includes the new byte; address points one cell after it.
        JSR     DEC_TEMP_ADDR
        LDA     GLYPH_TEMP
        JSR     WRITE_CELL_TEMP_RAW
        JSR     OVERLAY_SET_INPUT_CURSOR
        RTS

OVERLAY_ERASE_INPUT_CHAR
        JSR     OVERLAY_INPUT_ADDR
        LDA     #SPACE_GLYPH
        JSR     WRITE_CELL_TEMP_RAW
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
        JSR     GET_KEY
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
        JSR     WRITE_GLYPH
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_BS
        LDA     AUX_LINE_LEN
        BEQ     CMD_EDITOR_LOOP
        DEC     AUX_LINE_LEN
        JSR     SCREEN_BACKSPACE
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_CR
        JSR     CMD_FLUSH_LINE_CR
        BCS     CMD_EDITOR_ERROR
        JSR     NEWLINE
        JSR     PRINT_CMD_PROMPT
        JMP     CMD_EDITOR_LOOP

CMD_EDITOR_EXIT
        LDA     AUX_LINE_LEN
        BEQ     CMD_EDITOR_CLOSE
        JSR     CMD_FLUSH_LINE_CR
        BCS     CMD_EDITOR_ERROR
CMD_EDITOR_CLOSE
        JSR     FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        RTS

CMD_EDITOR_ERROR
        LDA     DOS_LAST_RC
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
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
        JSR     FILE_ENCODE_ASCII_A
        BCS     CMD_FLUSH_FAIL
        INC     LOOP_INDEX
        JMP     CMD_FLUSH_LOOP
CMD_FLUSH_CR
        LDA     #KEY_CR
        JSR     FILE_ENCODE_ASCII_A
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
        JSR     PRINT_SCREEN_STRING
        RTS

; =============================================================================
; SAVE / HISTORY
; =============================================================================

SAVE_REOPEN_NEW
        LDA     SAVE_ACTIVE
        BEQ     SAVE_OPEN_NEW
        JSR     FM_EOF_CLOSE_SAVE
        BCS     SAVE_OPEN_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
SAVE_OPEN_NEW
        JSR     FM_CREATE_SAVE
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
        CLC
        RTS

SAVE_MAGIC_FAIL
        LDA     DOS_LAST_RC
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_SAVE
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        SEC
SAVE_OPEN_FAIL
        RTS

HISTORY_WRITE_MAGIC
        LDA     #$81                    ; ignored by VideoTerm VIDOUT
        JSR     FM_WRITE_RAW
        BCS     HISTORY_MAGIC_DONE
        LDA     #$82
        JSR     FM_WRITE_RAW
        BCS     HISTORY_MAGIC_DONE
        LDA     #$83
        JSR     FM_WRITE_RAW
HISTORY_MAGIC_DONE
        RTS

; A = one ASCII code point to append through the escaped-history encoder.
HISTORY_WRITE_ASCII
        STA     CP_LO
        LDA     #$00
        STA     CP_HI
        JMP     HISTORY_WRITE_CP

HISTORY_WRITE_USER_BUFFER
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_USER_DONE
        LDA     #']'
        JSR     HISTORY_WRITE_ASCII
        LDA     #$00
        STA     INPUT_INDEX_LO
        STA     INPUT_INDEX_HI

HISTORY_USER_LOOP
        LDA     INPUT_INDEX_HI
        CMP     INPUT_COUNT_HI
        BNE     HISTORY_USER_HAVE
        LDA     INPUT_INDEX_LO
        CMP     INPUT_COUNT_LO
        BEQ     HISTORY_USER_CR

HISTORY_USER_HAVE
        LDX     INPUT_INDEX_LO
        LDA     INPUT_INDEX_HI
        BEQ     HISTORY_USER_PAGE0
        LDA     INPUT_BUF+$100,X
        JMP     HISTORY_USER_CHAR
HISTORY_USER_PAGE0
        LDA     INPUT_BUF,X
HISTORY_USER_CHAR
        JSR     HISTORY_WRITE_ASCII
        INC     INPUT_INDEX_LO
        BNE     HISTORY_USER_LOOP
        INC     INPUT_INDEX_HI
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
        BEQ     HISTORY_CP_DONE
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_HISTORY
        STA     FILE_ENCODING
        JSR     FILE_ENCODE_CP
        BCC     HISTORY_CP_DONE
        JMP     HISTORY_DISABLE
HISTORY_CP_DONE
        CLC
        RTS

; HS_HI:HS_LO / LS_HI:LS_LO = one supplementary Unicode scalar.
HISTORY_WRITE_SURROGATE
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_SURR_DONE
        LDA     #FILE_TARGET_SAVE
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_HISTORY
        STA     FILE_ENCODING
        JSR     FILE_ENCODE_SURROGATE
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
        JSR     FM_WRITE_SAVE_RAW
        BCS     HISTORY_COMMIT_FAIL

        ; Keep SAVE_POS at payload length, excluding the temporary EOF byte.
        LDA     SAVE_POS_LO
        BNE     HISTORY_COMMIT_DEC_LO
        DEC     SAVE_POS_HI
HISTORY_COMMIT_DEC_LO
        DEC     SAVE_POS_LO

        JSR     FM_CLOSE_SAVE
        BCS     HISTORY_COMMIT_FAIL
        JSR     FM_OPEN_SAVE_EXIST
        BCS     HISTORY_COMMIT_FAIL
        JSR     FM_POSITION_SAVE
        BCS     HISTORY_COMMIT_FAIL
HISTORY_COMMIT_DONE
        CLC
        RTS
HISTORY_COMMIT_FAIL
        JMP     HISTORY_DISABLE

HISTORY_DISABLE
        LDA     DOS_LAST_RC
        STA     DOS_ERROR_SAVE
        LDA     #$00
        STA     SAVE_ACTIVE
        JSR     FM_CLOSE_SAVE
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        SEC
        RTS

; =============================================================================
; LOAD TEXT FILE / CHAT HISTORY
; =============================================================================
;
; Files beginning $81,$82,$83 are V5.3 escaped UTF-16 history. Manual menu
; LOAD is a local paged viewer for both those history files and ordinary DOS
; text/CMD files. Only magic-tagged history interprets \uXXXX / \\ escapes;
; ordinary DOS text is rendered literally, so source code containing \uXXXX is
; shown exactly as written.
;
; GPT-requested ESC-L loads still use LOAD_AUX_AS_GPT_REQUEST directly, so the
; file-control protocol retains its original semantics.
;

; Manual ESC-menu LOAD. C=0 success, C=1 DOS error.
; This path is display-only; it never sends the selected file to GPT.
LOAD_AUX_FROM_MENU
        LDA     #$00
        STA     LOAD_SENT_GPT

        JSR     FM_OPEN_AUX_EXIST
        BCC     LOAD_MENU_OPENED
        SEC
        RTS

LOAD_MENU_OPENED
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     LOAD_COUNT_LO
        STA     LOAD_COUNT_HI
        STA     LOAD_LAST_CR

        JSR     LOAD_DETECT_ENCODING
        BCC     LOAD_MENU_ENCODING_READY
        LDA     DOS_LAST_RC
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_MENU_ENCODING_READY
        ; LOAD_NEXT_CODEPOINT already distinguishes the representations:
        ; history-magic files decode DOS-safe Unicode escapes, while ordinary
        ; DOS text returns each 7-bit character literally. The same viewer can
        ; therefore display both without ever reinterpreting CMD source text.
        JMP     LOAD_HISTORY_TO_SCREEN

; Display either decoded history or literal DOS text through the same
; VIDEX:NORMAL Unicode mapping used for live GPT replies. LOAD_NEXT_CODEPOINT
; performs history escape decoding only when the history magic was detected.
;
; The 24th physical row is reserved for the pager prompt. Content occupies
; rows 0..22; when more displayable content follows, SPACE clears the screen
; and continues with the next page.
LOAD_HISTORY_TO_SCREEN
        JSR     SCREEN_INIT
        LDA     #$00
        STA     LOAD_LAST_CR

LOAD_HISTORY_VIEW_LOOP
        JSR     LOAD_NEXT_CODEPOINT
        BCS     LOAD_HISTORY_VIEW_HAVE
        JMP     LOAD_HISTORY_VIEW_END

LOAD_HISTORY_VIEW_HAVE
        ; Saved CR/LF semantics mirror PROCESS_BMP_CODEPOINT without writing
        ; anything back into SAVE or a GPT-created capture file.
        LDA     CP_HI
        BNE     LOAD_HISTORY_VIEW_UNICODE
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     LOAD_HISTORY_VIEW_CR
        CMP     #$0A
        BEQ     LOAD_HISTORY_VIEW_LF

LOAD_HISTORY_VIEW_UNICODE
        LDA     #$00
        STA     LOAD_LAST_CR

        ; Decode a UTF-16 surrogate pair before mapping supplementary glyphs.
        LDA     CP_HI
        CMP     #$D8
        BCC     LOAD_HISTORY_VIEW_BMP
        CMP     #$DC
        BCS     LOAD_HISTORY_VIEW_BMP

        LDA     CP_LO
        STA     HS_LO
        LDA     CP_HI
        STA     HS_HI

        JSR     LOAD_NEXT_CODEPOINT
        BCC     LOAD_HISTORY_VIEW_END

        LDA     CP_HI
        CMP     #$DC
        BCC     LOAD_HISTORY_VIEW_BAD_SURR
        CMP     #$E0
        BCS     LOAD_HISTORY_VIEW_BAD_SURR

        LDA     CP_LO
        STA     LS_LO
        LDA     CP_HI
        STA     LS_HI
        JSR     MAP_SURROGATE
        BCC     LOAD_HISTORY_VIEW_LOOP
        JSR     HISTORY_VIEW_WRITE_GLYPH
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_BAD_SURR
        ; Malformed pairs are not expected from SAVE. Match the live terminal's
        ; unsupported-character policy by omitting them rather than inventing a
        ; replacement glyph.
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_BMP
        JSR     MAP_BMP
        BCC     LOAD_HISTORY_VIEW_LOOP
        JSR     HISTORY_VIEW_WRITE_GLYPH
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_CR
        JSR     HISTORY_VIEW_NEWLINE
        LDA     #$01
        STA     LOAD_LAST_CR
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_LF
        LDA     LOAD_LAST_CR
        BEQ     LOAD_HISTORY_VIEW_LF_ONLY
        LDA     #$00
        STA     LOAD_LAST_CR
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_LF_ONLY
        JSR     HISTORY_VIEW_NEWLINE
        LDA     #$00
        STA     LOAD_LAST_CR
        JMP     LOAD_HISTORY_VIEW_LOOP

LOAD_HISTORY_VIEW_END
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BEQ     LOAD_HISTORY_VIEW_CLOSE

        LDA     DOS_LAST_RC
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_HISTORY_VIEW_CLOSE
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        CLC
        RTS

; A=glyph. If the next visible character would enter the pager row, stop first.
HISTORY_VIEW_WRITE_GLYPH
        PHA
        JSR     HISTORY_VIEW_PAGE_CHECK
        PLA
        JSR     WRITE_GLYPH
        RTS

HISTORY_VIEW_NEWLINE
        JSR     HISTORY_VIEW_PAGE_CHECK
        JSR     NEWLINE
        RTS

; Row 23 is kept free for the pager.  We check only when another displayable
; item is about to be emitted, so an EOF exactly at a page boundary does not
; produce a spurious final "more" prompt.
HISTORY_VIEW_PAGE_CHECK
        LDA     ROW
        CMP     #$17                    ; physical row 23 of 0..23
        BCC     HISTORY_VIEW_PAGE_READY

        LDX     #<TXT_HISTORY_MORE
        LDY     #>TXT_HISTORY_MORE
        JSR     PRINT_SCREEN_STRING

HISTORY_VIEW_WAIT_SPACE
        JSR     GET_KEY_WAIT
        CMP     #' '
        BNE     HISTORY_VIEW_WAIT_SPACE

        JSR     SCREEN_INIT
HISTORY_VIEW_PAGE_READY
        RTS

LOAD_AUX_AS_GPT_REQUEST
        JSR     FM_OPEN_AUX_EXIST
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
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_ENCODING_READY
        ; Visible audit line for a menu/GPT requested file load.
        LDX     #<TXT_LOAD_AUDIT
        LDY     #>TXT_LOAD_AUDIT
        JSR     PRINT_SCREEN_STRING
        JSR     PRINT_NAME_INPUT_SCREEN
        JSR     NEWLINE

        ; Actual single GPT request begins with FILE <name>: then U+2028.
        LDX     #<TXT_FILE_HEADER
        LDY     #>TXT_FILE_HEADER
        JSR     SEND_Z_UTF16
        JSR     SEND_NAME_INPUT_UTF16
        LDA     #':'
        JSR     SEND_UTF16_ASCII
        JSR     SEND_LINE_SEPARATOR

        LDA     SAVE_ACTIVE
        BEQ     LOAD_HISTORY_HEADER_DONE
        LDA     #']'
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

        ; If SAVE is active, append the decoded scalar to the escaped history,
        ; never the source file's physical bytes.
        LDA     LOAD_SURROGATE
        BEQ     LOAD_HISTORY_BMP
        JSR     HISTORY_WRITE_SURROGATE
        JMP     LOAD_SEND_SCALAR
LOAD_HISTORY_BMP
        JSR     HISTORY_WRITE_CP

LOAD_SEND_SCALAR
        LDA     LOAD_SURROGATE
        BNE     LOAD_SEND_SURROGATE

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
        JSR     SERIAL_TX_BYTE
        LDA     CP_HI
        JSR     SERIAL_TX_BYTE
        JSR     INC_LOAD_COUNT
        JMP     LOAD_READ_LOOP

LOAD_SEND_SURROGATE
        LDA     #$00
        STA     LOAD_LAST_CR
        LDA     HS_LO
        JSR     SERIAL_TX_BYTE
        LDA     HS_HI
        JSR     SERIAL_TX_BYTE
        LDA     LS_LO
        JSR     SERIAL_TX_BYTE
        LDA     LS_HI
        JSR     SERIAL_TX_BYTE
        ; JavaScript counts the pair as two UTF-16 code units.
        JSR     INC_LOAD_COUNT
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
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        LDA     #$00
        STA     AUX_OPEN
        SEC
        RTS

LOAD_FINISH
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        LDA     #KEY_CR
        JSR     SEND_UTF16_ASCII
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

        JSR     FM_READ_AUX
        BCC     LOAD_DETECT_READ_END
        STA     LOAD_PREFETCH
        LDA     #$01
        STA     LOAD_PREFETCH_COUNT
        LDA     LOAD_PREFETCH
        CMP     #$81
        BNE     LOAD_DETECT_OK

        JSR     FM_READ_AUX
        BCC     LOAD_DETECT_READ_END
        STA     LOAD_PREFETCH+1
        LDA     #$02
        STA     LOAD_PREFETCH_COUNT
        LDA     LOAD_PREFETCH+1
        CMP     #$82
        BNE     LOAD_DETECT_OK

        JSR     FM_READ_AUX
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
        JMP     FM_READ_AUX

; Return one Unicode scalar from either source representation.
; C=1: CP_HI:CP_LO valid, or LOAD_SURROGATE=1 with HS/LS valid.
; C=0: EOF / real read error, DOS_LAST_RC identifies which.
LOAD_NEXT_CODEPOINT
        LDA     #$00
        STA     LOAD_SURROGATE
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
        JSR     SERIAL_TX_BYTE
        LDA     #$20
        JSR     SERIAL_TX_BYTE
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
        JSR     SEND_UTF16_ASCII
        RTS

SEND_Z_UTF16
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
SEND_Z_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     SEND_Z_DONE
        JSR     SEND_UTF16_ASCII
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
        JSR     SEND_UTF16_ASCII
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
        ; Bare [[A2:S]] selects CHAT_HISTORY through existing default logic.
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
        JSR     FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
GPT_CREATE_OPEN
        JSR     FM_CREATE_AUX
        BCS     GPT_EXEC_DONE
        LDA     #$01
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
        LDX     #FILE_TARGET_AUX
        LDA     #$00
        STA     ENC_LAST_CR,X
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
        JSR     FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     GPT_FILE_ACTIVE
        STA     AUX_OPEN
GPT_CLOSE_DONE
        RTS

GPT_FILE_WRITE_CP
        LDA     GPT_FILE_ACTIVE
        BEQ     GPT_FILE_WRITE_DONE
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        JSR     FILE_ENCODE_CP
GPT_FILE_WRITE_DONE
        RTS

GPT_FILE_WRITE_SURROGATE
        LDA     GPT_FILE_ACTIVE
        BEQ     GPT_FILE_SURR_DONE
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        JSR     FILE_ENCODE_SURROGATE
GPT_FILE_SURR_DONE
        RTS

; =============================================================================
; SCREEN STRING / DOS STATUS HELPERS
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
        RTS

PRINT_NAME_INPUT_SCREEN
        LDA     #$00
        STA     LOOP_INDEX
PRINT_NAME_SCREEN_LOOP
        LDX     LOOP_INDEX
        CPX     NAME_LEN
        BEQ     PRINT_NAME_SCREEN_DONE
        LDA     NAME_INPUT,X
        JSR     WRITE_GLYPH
        INC     LOOP_INDEX
        JMP     PRINT_NAME_SCREEN_LOOP
PRINT_NAME_SCREEN_DONE
        RTS

SHOW_DOS_ERROR_KEEP_INPUT
        JSR     ENSURE_LINE_START
        JSR     SHOW_DOS_ERROR_NO_PROMPT
        JSR     PRINT_USER_PROMPT
        LDA     #$00
        STA     INPUT_INDEX_LO
        STA     INPUT_INDEX_HI
SHOW_REPRINT_INPUT
        LDA     INPUT_INDEX_HI
        CMP     INPUT_COUNT_HI
        BNE     SHOW_REPRINT_HAVE
        LDA     INPUT_INDEX_LO
        CMP     INPUT_COUNT_LO
        BEQ     SHOW_KEEP_DONE
SHOW_REPRINT_HAVE
        LDX     INPUT_INDEX_LO
        LDA     INPUT_INDEX_HI
        BEQ     SHOW_REPRINT_PAGE0
        LDA     INPUT_BUF+$100,X
        JMP     SHOW_REPRINT_CHAR
SHOW_REPRINT_PAGE0
        LDA     INPUT_BUF,X
SHOW_REPRINT_CHAR
        JSR     WRITE_GLYPH
        INC     INPUT_INDEX_LO
        BNE     SHOW_REPRINT_INPUT
        INC     INPUT_INDEX_HI
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
        JSR     PRINT_SCREEN_STRING
        LDA     DOS_LAST_RC
        JSR     PRINT_HEX_BYTE
        JSR     NEWLINE
        RTS

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

CLOSE_ALL_FILES
        LDA     GPT_FILE_ACTIVE
        BEQ     CLOSE_NO_GPT_FILE
        JSR     GPT_CLOSE_CAPTURE_FILE
CLOSE_NO_GPT_FILE
        LDA     AUX_OPEN
        BEQ     CLOSE_NO_AUX
        JSR     FM_EOF_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
CLOSE_NO_AUX
        LDA     SAVE_ACTIVE
        BEQ     CLOSE_ALL_DONE
        JSR     FM_EOF_CLOSE_SAVE
        LDA     #$00
        STA     SAVE_ACTIVE
CLOSE_ALL_DONE
        RTS

; =============================================================================
; CARD DISCOVERY
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

PATCH_VIDEX_SLOT
        ; $Cn00 slot-ROM high byte.
        LDA     VT_SLOT
        CLC
        ADC     #$C0
        STA     VT_CLAIM_RD+2
        STA     VT_INIT_CALL+2

        ; device-select base low byte.
        LDA     VT_SLOT
        ASL     A
        ASL     A
        ASL     A
        ASL     A
        CLC
        ADC     #$80

        STA     VT_BANK_RD+1
        STA     VT_REG_WR+1

        CLC
        ADC     #$01
        STA     VT_DATA_WR+1

        ; Firmware slot-local permanent workspace = xx78 + slot.
        LDA     VT_SLOT
        CLC
        ADC     #$78

        STA     VT_BASEL_ST+1
        STA     VT_BASEH_ST+1
        STA     VT_CHORZ_ST+1
        STA     VT_CVERT_ST+1
        STA     VT_START_ST+1
        STA     VT_FLAGS_RD+1
        STA     VT_FLAGS_WR+1
        RTS

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
; The low-byte operands are patched from VT_SLOT during startup.
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
; ROLLING GPT16 RESPONSE RECEIVER
; =============================================================================

RECEIVE_GPT16
        LDA     #$00
        STA     LAST_CR
        STA     GPT_CTRL_STATE
        STA     A2_CAPTURE
        STA     A2_LEN

        JSR     SERIAL_RX_BLOCK
        STA     CP_LO
        JSR     SERIAL_RX_BLOCK
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
        JSR     SERIAL_RX_BLOCK
        STA     LS_LO
        JSR     SERIAL_RX_BLOCK
        STA     LS_HI

        LDA     RX_SILENT
        BNE     RECEIVE_NEXT

        JSR     HISTORY_WRITE_SURROGATE
        JSR     GPT_FILE_WRITE_SURROGATE
        JSR     MAP_SURROGATE
        BCC     RECEIVE_NEXT
        JSR     WRITE_GLYPH
        JMP     RECEIVE_NEXT

RECEIVE_BMP
        LDA     RX_SILENT
        BNE     RECEIVE_NEXT
        JSR     PROCESS_BMP_CODEPOINT

RECEIVE_NEXT
        JSR     SERIAL_RX_NEXT
        BCC     RECEIVE_DONE
        STA     CP_LO
        JSR     SERIAL_RX_BLOCK
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
        JSR     WRITE_GLYPH
PROCESS_BMP_DONE
        RTS

PROCESS_CR
        JSR     NEWLINE
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
        JSR     NEWLINE
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
        LDA     BMP_GLYPH,X
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
        LDX     #$66            ; 103 packed bytes: index 102..0

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
        STA     GLYPH_TEMP
        TXA
        PHA
        LDA     GLYPH_TEMP
        JSR     WRITE_GLYPH
        PLA
        TAX
        RTS

; 0..3 = literals: "8", space, "o", ".". 4..F = recursive pairs.
CHATGPT_LOGO_TABLE
        HEX     B8A0EFAE001140655512171423572469

; 103 compressed bytes, intentionally stored backwards.
CHATGPT_LOGO_DATA
        HEX     8D2DE697E7D74294886222B4D5A896E2
        HEX     355EA4A694428909326333968D6AA177
        HEX     3E61BA873B4363320CA328B6B616A728
        HEX     74A80552B363B2A4F7814AB44C5B6C84
        HEX     BD1016C0B9205A425F029F8A882AF059
        HEX     1002C30B0303F144C546C526538A88CD
        HEX     3E812F3C030359

; =============================================================================
; PROMPTS
; =============================================================================

PRINT_USER_PROMPT
        LDA     #']'
        JSR     WRITE_GLYPH
        RTS

ENSURE_LINE_START
        LDA     COLUMN
        BEQ     ENSURE_LINE_DONE

        JSR     NEWLINE

ENSURE_LINE_DONE
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
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_AUX
        LDA     DOS_ERROR_SAVE
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
        STA     DOS_ERROR_SAVE
        JSR     FM_CLOSE_SAVE
        LDA     DOS_ERROR_SAVE
        STA     DOS_LAST_RC
        SEC
        RTS
FM_EOF_SAVE_CLOSE_OK
        JMP     FM_CLOSE_SAVE

; =============================================================================
; DOS NAME HELPERS
; =============================================================================

SET_DEFAULT_HISTORY_NAME
        LDA     #$0C                    ; CHAT_HISTORY = 12 chars
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
        STA     CRTC_REG_TEMP
        STX     CRTC_DATA_TEMP

        JSR     VIDEX_CLAIM

        LDA     CRTC_REG_TEMP

VT_REG_WR
        STA     $C0B0

        LDA     CRTC_DATA_TEMP

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
        STA     GLYPH_TEMP

        LDA     CURSOR_HI
        LSR     A
        AND     #$03
        JSR     VIDEX_SELECT_BANK

        LDX     CURSOR_LO

        LDA     CURSOR_HI
        AND     #$01
        BNE     WRITE_CURSOR_PAGE1

        LDA     GLYPH_TEMP
        STA     VIDEX_RAM0,X
        RTS

WRITE_CURSOR_PAGE1
        LDA     GLYPH_TEMP
        STA     VIDEX_RAM1,X
        RTS

; A=glyph; TMP_HI:TMP_LO physical address.
WRITE_CELL_TEMP_RAW
        STA     GLYPH_TEMP

        LDA     TMP_HI
        LSR     A
        AND     #$03
        JSR     VIDEX_SELECT_BANK

        LDX     TMP_LO

        LDA     TMP_HI
        AND     #$01
        BNE     WRITE_TEMP_PAGE1

        LDA     GLYPH_TEMP
        STA     VIDEX_RAM0,X
        RTS

WRITE_TEMP_PAGE1
        LDA     GLYPH_TEMP
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
; Keep Applesoft/VideoTerm firmware cursor state synchronized with raw VRAM.
; These absolute low bytes are patched to $78+VT_SLOT at startup.
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
; VIDEX:NORMAL UNICODE TABLES
; =============================================================================

BMP_LOW
        HEX     8875761477020C1C7418003410242C3C

BMP_GLYPH
        HEX     071112131415161718191A1B1C1D1E1F

SUP_LOW
        HEX     020B0E2D303995

SUP_GLYPH
        HEX     0102030405067F

; =============================================================================
; CARD CRC TABLES
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
; V5 MENU / FILE STRINGS
; =============================================================================

TXT_MENU
        ASC     "[U]P [D]OWN [C]MD [S]AVE [L]OAD [Q]UIT"
        HEX     00
TXT_CMD_FILE
        ASC     "CMD FILE:"
        HEX     00
TXT_SAVE_FILE
        ASC     "SAVE FILE [CHAT_HISTORY]:"
        HEX     00
TXT_LOAD_FILE
        ASC     "LOAD FILE:"
        HEX     00
TXT_CMD_PROMPT
        ASC     "CMD>"
        HEX     00
TXT_DOS_ERROR
        ASC     "DOS ERROR $"
        HEX     00
TXT_LOAD_AUDIT
        ASC     "]LOAD "
        HEX     00
TXT_FILE_HEADER
        ASC     "FILE "
        HEX     00
TXT_HISTORY_MORE
        ASC     "[SPACE] MORE"
        HEX     00
DEFAULT_HISTORY_NAME
        ASC     "CHAT_HISTORY"

; The GPT peer treats CR/LF as request terminators, so V5 uses U+2028 inside a
; LOAD request to preserve file line boundaries while still sending one request.
GPT_BRIEFING
        ASC     "APPLE II GPT16 V5.7 POLICY. A2CTRL=BRACKET1. TERMINAL IS UTF-16LE. KEEP ANSWERS CONCISE. "
        ASC     "DISPLAY TEXT SHOULD USE ASCII OR UNICODE AVAILABLE IN VIDEX NORMAL WHEN POSSIBLE. "
        ASC     "DOS FILES YOU CREATE MUST USE 7-BIT ASCII CONTENT WITH CR LINE ENDINGS. "
        ASC     "CHAT HISTORY SAVE FILES ARE DOS-SAFE HIGH-BIT TEXT WITH LOSSLESS UTF-16 ESCAPES. "
        ASC     "NON-ASCII IS STORED AS BACKSLASH-u-HEX AND LOAD DECODES IT TO UNICODE. "
        ASC     "LOAD ALSO ACCEPTS ORDINARY DOS HIGH-BIT ASCII TEXT. "
        ASC     "FILE CONTROL USES PRINTABLE WHOLE-LINE TOKENS PARSED DIRECTLY BY THE APPLE II. "
        ASC     "[[A2:C:FILENAME]] THEN FILE TEXT THEN [[A2:E]] CREATES AND CLOSES A DOS TEXT FILE. "
        ASC     "THERE IS NO FILE-TYPE FIELD: USE [[A2:C:HW]], NOT [[A2:C:HW:BAS]]. "
        ASC     "[[A2:S:FILENAME]] STARTS CHAT HISTORY SAVE; [[A2:S]] MEANS CHAT_HISTORY. "
        ASC     "[[A2:L:FILENAME]] LOADS A DOS ASCII OR GPT16 HISTORY FILE AS YOUR NEXT USER MESSAGE. "
        ASC     "PUT EACH A2 TOKEN ON ITS OWN LINE. NEVER EMIT RAW C0 CONTROL CHARACTERS. "
        ASC     "DO NOT PUT PROSE BETWEEN A CREATE TOKEN AND ITS FILE CONTENT UNLESS THE PROSE BELONGS IN THE FILE. "
        ASC     "LOADED FILE LINE BREAKS ARRIVE AS U+2028. FILENAMES ARE 1-30 DOS CHARACTERS. "
        ASC     "EXECUTION WORDS SUCH AS RUN BRUN EXEC AND CALL ARE ALLOWED AS LITERAL LINES INSIDE A FILE YOU CREATE. "
        ASC     "FOR EXAMPLE A CMD FILE MAY CONTAIN BASIC PROGRAM LINES FOLLOWED BY RUN SO EXEC OF THAT FILE RUNS IT LATER. "
        ASC     "DO NOT EXECUTE OR CLAIM TO EXECUTE SUCH COMMANDS IMMEDIATELY; ONLY WRITE THEM INTO THE REQUESTED FILE. "
        ASC     "AFTER THIS BRIEFING REPLY ONLY READY."
        HEX     00

; =============================================================================
; STATE
; =============================================================================

SP_SLOT
        HEX     00
VT_SLOT
        HEX     00

SP_COUNT
        HEX     00
VT_COUNT
        HEX     00

SCAN_SLOT
        HEX     00

CRC_LO
        HEX     00
CRC_HI
        HEX     00

SAVE_ZP_LO
        HEX     00
SAVE_ZP_HI
        HEX     00

INPUT_COUNT_LO
        HEX     00
INPUT_COUNT_HI
        HEX     00

LAST_CR
        HEX     00

KEY_TEMP
        HEX     00

TX_TEMP
        HEX     00

SHIFT_TEMP
        HEX     00

CP_LO
        HEX     00
CP_HI
        HEX     00

HS_LO
        HEX     00
HS_HI
        HEX     00

LS_LO
        HEX     00
LS_HI
        HEX     00

GLYPH_TEMP
        HEX     00

BANK_TEMP
        HEX     00

CRTC_REG_TEMP
        HEX     00

CRTC_DATA_TEMP
        HEX     00

DELTA_TEMP
        HEX     00

SYNC_TEMP
        HEX     00

VSTART_LO
        HEX     00
VSTART_HI
        HEX     00

CURSOR_LO
        HEX     00
CURSOR_HI
        HEX     00

TMP_LO
        HEX     00
TMP_HI
        HEX     00

COLUMN
        HEX     00

ROW
        HEX     00


; =============================================================================
; V5 STATE / BUFFERS
; =============================================================================

SAVE_FM_ZP_LO
        HEX     00
SAVE_FM_ZP_HI
        HEX     00

DOS_AVAILABLE
        HEX     00
DOS_VOLUME
        HEX     00
DOS_DRIVE
        HEX     01
DOS_SLOT
        HEX     06
DOS_LAST_RC
        HEX     00
DOS_ERROR_SAVE
        HEX     00

SAVE_ACTIVE
        HEX     00
AUX_OPEN
        HEX     00
GPT_FILE_ACTIVE
        HEX     00
RX_SILENT
        HEX     00

; Shared file-byte/encoding selector. ENC_LAST_CR is indexed by FILE_TARGET.
FILE_TARGET
        HEX     00
FILE_ENCODING
        HEX     00
ENC_LAST_CR
        HEX     0000

; LOAD source detection / viewer and escaped-history decoder state.
LOAD_ENCODING
        HEX     00
LOAD_PREFETCH_COUNT
        HEX     00
LOAD_PREFETCH_INDEX
        HEX     00
LOAD_PREFETCH
        HEX     000000
LOAD_SURROGATE
        HEX     00
LOAD_LAST_CR
        HEX     00
LOAD_SENT_GPT
        HEX     00
ESC_DIGITS
        HEX     00
HEX_TEMP
        HEX     00

AUTO_ACTION_BUDGET
        HEX     00
PENDING_LOAD
        HEX     00
PENDING_NAME_LEN
        HEX     00

GPT_CTRL_STATE
        HEX     00
GPT_CTRL_COMMAND_CODE
        HEX     00
GPT_CTRL_NAME_LEN
        HEX     00

; V5.7 printable A2 control candidate state.
A2_CAPTURE
        HEX     00
A2_LEN
        HEX     00
A2_BODY_END
        HEX     00
A2_PENDING_LO
        HEX     00
A2_PENDING_HI
        HEX     00
A2_BUF
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000

NAME_DEFAULT
        HEX     00
NAME_LEN
        HEX     00
OVERLAY_PREFIX_LEN
        HEX     00
LABEL_PTR_LO
        HEX     00
LABEL_PTR_HI
        HEX     00

MENU_ROW_LO
        HEX     00
MENU_ROW_HI
        HEX     00

LOOP_INDEX
        HEX     00
INPUT_INDEX_LO
        HEX     00
INPUT_INDEX_HI
        HEX     00
SAVE_POS_LO
        HEX     00
SAVE_POS_HI
        HEX     00
AUX_LINE_LEN
        HEX     00
LOAD_COUNT_LO
        HEX     00
LOAD_COUNT_HI
        HEX     00
FILE_CHAR
        HEX     00

INPUT_BUF
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
AUX_LINE_BUF
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
NAME_INPUT
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
SAVE_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
AUX_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
GPT_CTRL_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
PENDING_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
MENU_ROW_SAVE
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
SAVE_WORK
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000
SAVE_TS
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
SAVE_DATA
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
AUX_WORK
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000
AUX_TS
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
AUX_DATA
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000
        HEX     00000000000000000000000000000000

; =============================================================================
; END
; =============================================================================
