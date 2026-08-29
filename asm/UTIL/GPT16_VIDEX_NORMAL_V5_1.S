; =============================================================================
; GPT16_VIDEX_NORMAL_V5_1.S
; =============================================================================
;
; RetroAppleJS ASM_core.js / NMOS 6502
; Load address : $6000
; Call from    : Applesoft BASIC with CALL 24576
;
; V5.1 DOS correction
; -------------------
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
;   * SAVE records subsequent user requests and GPT replies to a DOS text file.
;   * LOAD reads a DOS text file and submits it to GPT as one request.
;   * GPT receives a hidden startup briefing describing the terminal/file policy.
;   * GPT may request file create/save/load operations through U+001B controls;
;     the application never executes files on GPT's behalf.
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
; VIDEX:NORMAL Unicode reverse mapping.
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
FM_ONE_BYTE     EQU     $01
FM_END_DATA     EQU     $05
FM_FILE_NOT_FOUND EQU   $06

DOS_TEXT_TYPE   EQU     $00
MAX_FILENAME    EQU     $1E             ; 30
LOAD_LIMIT_HI   EQU     $0D             ; $0DAC = 3500 chars
LOAD_LIMIT_LO   EQU     $AC
AUTO_LOAD_MAX   EQU     $04

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
        STA     INPUT_COUNT
        STA     LAST_CR
        STA     SAVE_ACTIVE
        STA     AUX_OPEN
        STA     GPT_FILE_ACTIVE
        STA     GPT_CTRL_STATE
        STA     PENDING_LOAD
        STA     RX_SILENT

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

        LDX     INPUT_COUNT
        CPX     #$FE
        BEQ     MAIN_INPUT

        STA     INPUT_BUF,X
        INC     INPUT_COUNT
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
        LDA     INPUT_COUNT
        BEQ     MAIN_INPUT

        DEC     INPUT_COUNT
        JSR     SCREEN_BACKSPACE
        JMP     MAIN_INPUT

; -----------------------------------------------------------------------------
; Submit one locally buffered request.
; -----------------------------------------------------------------------------

SUBMIT_LINE
        LDA     INPUT_COUNT
        BNE     SUBMIT_NONEMPTY

        JSR     NEWLINE
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

SUBMIT_NONEMPTY
        JSR     HISTORY_WRITE_USER_BUFFER
        JSR     SEND_INPUT_BUFFER

        LDA     #$00
        STA     INPUT_COUNT

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
        STA     LOOP_INDEX

SEND_INPUT_LOOP
        LDX     LOOP_INDEX
        CPX     INPUT_COUNT
        BEQ     SEND_INPUT_END

        LDA     INPUT_BUF,X
        JSR     SEND_UTF16_ASCII
        INC     LOOP_INDEX
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
        STA     INPUT_COUNT             ; CMD replaces an unfinished chat line
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
        STA     INPUT_COUNT             ; LOAD becomes the next user request
        JSR     MENU_RESTORE_ROW
        JSR     ENSURE_LINE_START
        JSR     LOAD_AUX_AS_GPT_REQUEST
        BCC     MENU_LOAD_OK
        JSR     SHOW_DOS_ERROR_AND_PROMPT
        JMP     MAIN_INPUT

MENU_LOAD_OK
        LDA     #AUTO_LOAD_MAX
        STA     AUTO_ACTION_BUDGET
        JSR     RECEIVE_GPT16
        JSR     HANDLE_PENDING_LOADS
        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

MENU_QUIT
        JSR     MENU_RESTORE_ROW
        JSR     CLOSE_ALL_FILES
        JSR     ENSURE_LINE_START
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
        LDA     #$00
        STA     LOOP_INDEX
CMD_FLUSH_LOOP
        LDX     LOOP_INDEX
        CPX     AUX_LINE_LEN
        BEQ     CMD_FLUSH_CR
        LDA     AUX_LINE_BUF,X
        JSR     FM_WRITE_AUX_TEXT
        BCS     CMD_FLUSH_FAIL
        INC     LOOP_INDEX
        JMP     CMD_FLUSH_LOOP
CMD_FLUSH_CR
        LDA     #KEY_CR
        JSR     FM_WRITE_AUX_TEXT
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
        LDA     #$01
        STA     SAVE_ACTIVE
        CLC
        RTS
SAVE_OPEN_FAIL
        SEC
        RTS

HISTORY_WRITE_USER_BUFFER
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_USER_DONE
        LDA     #']'
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_1
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_1
        LDA     #$00
        STA     LOOP_INDEX
HISTORY_USER_LOOP
        LDX     LOOP_INDEX
        CPX     INPUT_COUNT
        BEQ     HISTORY_USER_CR
        LDA     INPUT_BUF,X
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_2
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_2
        INC     LOOP_INDEX
        JMP     HISTORY_USER_LOOP
HISTORY_USER_CR
        LDA     #KEY_CR
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_3
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_3
HISTORY_USER_DONE
        RTS

HISTORY_WRITE_CP
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_CP_DONE
        LDA     CP_HI
        BNE     HISTORY_CP_QMARK
        LDA     CP_LO
        CMP     #$20
        BCC     HISTORY_CP_CONTROL
        CMP     #$7F
        BCC     HISTORY_CP_ASCII
HISTORY_CP_QMARK
        LDA     #'?'
HISTORY_CP_ASCII
        STA     FILE_CHAR
        LDA     #$00
        STA     HIST_LAST_CR
        LDA     FILE_CHAR
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_4
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_4
        RTS
HISTORY_CP_CONTROL
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     HISTORY_CP_CR
        CMP     #$0A
        BEQ     HISTORY_CP_LF
        RTS
HISTORY_CP_CR
        LDA     #KEY_CR
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_5
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_5
        LDA     #$01
        STA     HIST_LAST_CR
        RTS
HISTORY_CP_LF
        LDA     HIST_LAST_CR
        BEQ     HISTORY_CP_LF_WRITE
        LDA     #$00
        STA     HIST_LAST_CR
        RTS
HISTORY_CP_LF_WRITE
        LDA     #KEY_CR
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_6
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_6
        RTS
HISTORY_CP_DONE
        RTS

HISTORY_WRITE_SURROGATE
        LDA     #$00
        STA     HIST_LAST_CR
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_SURR_DONE
        LDA     #'?'
        JSR     FM_WRITE_SAVE_TEXT
        BCC     HISTORY_WRITE_OK_7
        JMP     HISTORY_DISABLE
HISTORY_WRITE_OK_7
HISTORY_SURR_DONE
        RTS

HISTORY_DISABLE
        LDA     #$00
        STA     SAVE_ACTIVE
        RTS

; =============================================================================
; LOAD TEXT FILE -> GPT16 REQUEST
; =============================================================================

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
        JSR     FM_WRITE_SAVE_TEXT
        LDX     #<TXT_FILE_HEADER
        LDY     #>TXT_FILE_HEADER
        JSR     HISTORY_WRITE_Z
        JSR     HISTORY_WRITE_NAME_INPUT
        LDA     #':'
        JSR     FM_WRITE_SAVE_TEXT
        LDA     #KEY_CR
        JSR     FM_WRITE_SAVE_TEXT
LOAD_HISTORY_HEADER_DONE

LOAD_READ_LOOP
        JSR     LOAD_LIMIT_REACHED
        BCS     LOAD_FINISH
        JSR     FM_READ_AUX
        BCC     LOAD_READ_END
        AND     #$7F
        BEQ     LOAD_FINISH
        STA     FILE_CHAR

        LDA     SAVE_ACTIVE
        BEQ     LOAD_NO_HISTORY_CHAR
        LDA     FILE_CHAR
        JSR     FM_WRITE_SAVE_TEXT
LOAD_NO_HISTORY_CHAR

        LDA     FILE_CHAR
        CMP     #KEY_CR
        BEQ     LOAD_SEND_LINESEP
        CMP     #$0A
        BEQ     LOAD_SEND_LINESEP
        CMP     #$20
        BCC     LOAD_COUNT_ONLY
        CMP     #$7F
        BCS     LOAD_COUNT_ONLY
        JSR     SEND_UTF16_ASCII
        JMP     LOAD_COUNT_ONLY
LOAD_SEND_LINESEP
        JSR     SEND_LINE_SEPARATOR
LOAD_COUNT_ONLY
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
        LDA     #$00
        STA     GPT_FILE_LAST_CR
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
        LDA     CP_HI
        BNE     GPT_FILE_QMARK
        LDA     CP_LO
        CMP     #$20
        BCC     GPT_FILE_CONTROL
        CMP     #$7F
        BCC     GPT_FILE_ASCII
GPT_FILE_QMARK
        LDA     #'?'
GPT_FILE_ASCII
        STA     FILE_CHAR
        LDA     #$00
        STA     GPT_FILE_LAST_CR
        LDA     FILE_CHAR
        JSR     FM_WRITE_AUX_TEXT
        RTS
GPT_FILE_CONTROL
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     GPT_FILE_CR
        CMP     #$0A
        BEQ     GPT_FILE_LF
        RTS
GPT_FILE_CR
        LDA     #KEY_CR
        JSR     FM_WRITE_AUX_TEXT
        LDA     #$01
        STA     GPT_FILE_LAST_CR
        RTS
GPT_FILE_LF
        LDA     GPT_FILE_LAST_CR
        BEQ     GPT_FILE_LF_WRITE
        LDA     #$00
        STA     GPT_FILE_LAST_CR
        RTS
GPT_FILE_LF_WRITE
        LDA     #KEY_CR
        JSR     FM_WRITE_AUX_TEXT
GPT_FILE_WRITE_DONE
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
        STA     LOOP_INDEX
SHOW_REPRINT_INPUT
        LDX     LOOP_INDEX
        CPX     INPUT_COUNT
        BEQ     SHOW_KEEP_DONE
        LDA     INPUT_BUF,X
        JSR     WRITE_GLYPH
        INC     LOOP_INDEX
        JMP     SHOW_REPRINT_INPUT
SHOW_KEEP_DONE
        RTS

SHOW_DOS_ERROR_AND_PROMPT
        LDA     #$00
        STA     INPUT_COUNT
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
        ; Calling the slot-ROM initial entry causes firmware 2.4 to install:
        ;       KSW -> VideoTerm input handler
        ;       CSW -> VideoTerm output handler
        ; and to run SETUP. A NUL is harmless as the initial output character.
        LDA     #$00

VT_INIT_CALL
        JSR     $C300
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
        STA     HIST_LAST_CR
        STA     GPT_CTRL_STATE

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
        LDA     GPT_FILE_ACTIVE
        BEQ     RECEIVE_SURR_DISPLAY
        LDA     #$00
        STA     GPT_FILE_LAST_CR
        LDA     #'?'
        JSR     FM_WRITE_AUX_TEXT
RECEIVE_SURR_DISPLAY
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
        JSR     GPT_CLOSE_CAPTURE_FILE
RECEIVE_DONE_RETURN
        RTS

; -----------------------------------------------------------------------------
; CR/LF are terminal semantics, not glyph $0D/$0A.
; U+001B starts the V5 GPT file-control protocol.
; -----------------------------------------------------------------------------

PROCESS_BMP_CODEPOINT
        ; Existing control sequence in progress.
        LDA     GPT_CTRL_STATE
        BEQ     PROCESS_CHECK_ESC
        JSR     GPT_CONTROL_CHAR
        BCS     PROCESS_BMP_DONE
        ; C=0 means the current code point follows a completed control and must
        ; be processed normally.

PROCESS_CHECK_ESC
        LDA     CP_HI
        BNE     PROCESS_NORMAL
        LDA     CP_LO
        CMP     #KEY_ESC
        BNE     PROCESS_NORMAL
        JSR     GPT_CONTROL_START
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
        JMP     FM_OPEN_CREATE_RESULT
FM_CREATE_AUX_FAIL
        RTS

FM_CREATE_SAVE
        JSR     FM_DELETE_SAVE
        BCS     FM_CREATE_SAVE_FAIL
        JSR     FM_USE_SAVE
        JSR     FM_NAME_SAVE
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_X0
        JMP     FM_OPEN_CREATE_RESULT
FM_CREATE_SAVE_FAIL
        RTS

FM_OPEN_AUX_EXIST
        JSR     FM_REQUIRE_DOS
        BCS     FM_OPEN_AUX_DONE
        JSR     FM_USE_AUX
        JSR     FM_NAME_AUX
        JSR     FM_PREP_OPEN
        JSR     FM_CALL_XFF
FM_OPEN_AUX_DONE
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

; A = exact file byte.
FM_WRITE_AUX_RAW
        STA     FILE_CHAR
        JSR     FM_REQUIRE_DOS
        BCS     FM_WRITE_AUX_DONE
        JSR     FM_USE_AUX
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
FM_WRITE_AUX_DONE
        RTS

FM_WRITE_SAVE_RAW
        STA     FILE_CHAR
        JSR     FM_REQUIRE_DOS
        BCS     FM_WRITE_SAVE_DONE
        JSR     FM_USE_SAVE
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
FM_WRITE_SAVE_DONE
        RTS

; DOS 3.3 sequential text uses high-bit ASCII and a final zero byte.
FM_WRITE_AUX_TEXT
        ORA     #$80
        JMP     FM_WRITE_AUX_RAW

FM_WRITE_SAVE_TEXT
        ORA     #$80
        JMP     FM_WRITE_SAVE_RAW

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
        JSR     FM_WRITE_SAVE_TEXT
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
        JSR     FM_WRITE_SAVE_TEXT
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
DEFAULT_HISTORY_NAME
        ASC     "CHAT_HISTORY"

; The GPT peer treats CR/LF as request terminators, so V5 uses U+2028 inside a
; LOAD request to preserve file line boundaries while still sending one request.
GPT_BRIEFING
        ASC     "APPLE II GPT16 V5 POLICY. TERMINAL IS UTF-16LE. KEEP ANSWERS CONCISE. "
        ASC     "DISPLAY TEXT SHOULD USE ASCII OR UNICODE AVAILABLE IN VIDEX NORMAL WHEN POSSIBLE. "
        ASC     "DOS FILES YOU CREATE MUST USE 7-BIT ASCII CONTENT WITH CR LINE ENDINGS. "
        ASC     "YOU MAY REQUEST FILE OPERATIONS WITH ACTUAL U+001B CONTROL CHARACTERS: "
        ASC     "ESC C FILENAME CR THEN FILE TEXT THEN ESC E CR CREATES A DOS TEXT FILE; "
        ASC     "ESC S FILENAME CR STARTS CHAT HISTORY SAVE, EMPTY NAME MEANS CHAT_HISTORY; "
        ASC     "ESC L FILENAME CR LOADS THAT DOS TEXT FILE AS YOUR NEXT USER MESSAGE. "
        ASC     "LOADED FILE LINE BREAKS ARRIVE AS U+2028. FILENAMES ARE 1-30 DOS CHARACTERS. "
        ASC     "YOU MAY WRITE APPLESOFT OR ASSEMBLY TEXT FOR THE USER TO EXECUTE LATER, "
        ASC     "BUT NEVER REQUEST OR CLAIM TO RUN EXEC BRUN RUN CALL OR OTHER EXECUTION. "
        ASC     "YOU CANNOT EXECUTE FILES. AFTER THIS BRIEFING REPLY ONLY READY."
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

INPUT_COUNT
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
GPT_FILE_LAST_CR
        HEX     00
HIST_LAST_CR
        HEX     00
RX_SILENT
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
        HEX     0000000000000000000000000000
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
