; =============================================================================
; GPT16_VIDEX_NORMAL_V2.S
; =============================================================================
;
; RetroAppleJS ASM_core.js / NMOS 6502
; Load address : $6000
; Call from    : Applesoft BASIC with CALL 24576
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
;       > user request
;       GPT16> GPT response
;       > next request
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

APPLE_CH        EQU     $24
APPLE_CV        EQU     $25

KEY_BS          EQU     $08
KEY_CR          EQU     $0D
KEY_ESC         EQU     $1B
KEY_DEL         EQU     $7F

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

        ; Preserve ZP bytes temporarily borrowed by startup message printing.
        LDA     MSG_ZPL
        STA     SAVE_ZP_LO
        LDA     MSG_ZPH
        STA     SAVE_ZP_HI

        JSR     DETECT_CARDS
        BCC     START_ABORT

        JSR     PATCH_SERIAL_SLOT
        JSR     PATCH_VIDEX_SLOT

        ; VideoTerm slot-ROM initial entry installs KSW + CSW and performs the
        ; board setup.  This is the operational equivalent of engaging PR#3.
        JSR     ENGAGE_VIDEX

        ; Restore the temporary startup print pointer before entering the live
        ; session; Applesoft owns the surrounding machine state.
        LDA     SAVE_ZP_LO
        STA     MSG_ZPL
        LDA     SAVE_ZP_HI
        STA     MSG_ZPH

        JSR     SERIAL_INIT
        JSR     SCREEN_INIT

        LDA     #$00
        STA     INPUT_COUNT
        STA     LAST_CR

        JSR     PRINT_USER_PROMPT

MAIN_INPUT
        JSR     GET_KEY

PROCESS_KEY
        CMP     #KEY_ESC
        BEQ     EXIT_ARM

        CMP     #KEY_CR
        BEQ     SUBMIT_LINE

        CMP     #KEY_BS
        BEQ     EDIT_BACKSPACE

        CMP     #KEY_DEL
        BEQ     EDIT_BACKSPACE

        CMP     #$20
        BCC     MAIN_INPUT

        CMP     #$7F
        BCS     MAIN_INPUT

        LDX     INPUT_COUNT
        CPX     #$FF
        BEQ     MAIN_INPUT

        STA     KEY_TEMP
        JSR     SEND_UTF16_ASCII

        INC     INPUT_COUNT

        LDA     KEY_TEMP
        JSR     WRITE_GLYPH
        JMP     MAIN_INPUT

START_ABORT
        LDA     SAVE_ZP_LO
        STA     MSG_ZPL
        LDA     SAVE_ZP_HI
        STA     MSG_ZPH
        RTS

; -----------------------------------------------------------------------------
; ESC then Q exits. Any other second key continues normally.
; -----------------------------------------------------------------------------

EXIT_ARM
        JSR     GET_KEY

        CMP     #'Q'
        BEQ     EXIT_SESSION

        CMP     #'q'
        BEQ     EXIT_SESSION

        JMP     PROCESS_KEY

EXIT_SESSION
        JSR     CANCEL_REMOTE_INPUT
        JSR     ENSURE_LINE_START
        RTS

; -----------------------------------------------------------------------------
; Backspace edits both SPGPT's current line and the local VideoTerm echo.
; -----------------------------------------------------------------------------

EDIT_BACKSPACE
        LDA     INPUT_COUNT
        BEQ     MAIN_INPUT

        DEC     INPUT_COUNT

        LDA     #KEY_BS
        JSR     SEND_UTF16_ASCII

        JSR     SCREEN_BACKSPACE
        JMP     MAIN_INPUT

; -----------------------------------------------------------------------------
; Submit one request.
; -----------------------------------------------------------------------------

SUBMIT_LINE
        LDA     INPUT_COUNT
        BNE     SUBMIT_NONEMPTY

        JSR     NEWLINE
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

SUBMIT_NONEMPTY
        LDA     #KEY_CR
        JSR     SEND_UTF16_ASCII

        LDA     #$00
        STA     INPUT_COUNT

        JSR     NEWLINE
        JSR     PRINT_GPT_PROMPT

        JSR     RECEIVE_GPT16

        JSR     ENSURE_LINE_START
        JSR     PRINT_USER_PROMPT
        JMP     MAIN_INPUT

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

        JSR     MAP_SURROGATE
        BCC     RECEIVE_NEXT

        JSR     WRITE_GLYPH
        JMP     RECEIVE_NEXT

RECEIVE_BMP
        JSR     PROCESS_BMP_CODEPOINT

RECEIVE_NEXT
        JSR     SERIAL_RX_NEXT
        BCC     RECEIVE_DONE

        STA     CP_LO

        JSR     SERIAL_RX_BLOCK
        STA     CP_HI

        JMP     RECEIVE_CODE_UNIT

RECEIVE_DONE
        RTS

; -----------------------------------------------------------------------------
; CR/LF are terminal semantics, not glyph $0D/$0A.
; Visible U+240D/U+240A remain ordinary mapped glyphs.
; -----------------------------------------------------------------------------

PROCESS_BMP_CODEPOINT
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
; PROMPTS
; =============================================================================

PRINT_USER_PROMPT
        LDA     #'>'
        JSR     WRITE_GLYPH

        LDA     #' '
        JSR     WRITE_GLYPH
        RTS

PRINT_GPT_PROMPT
        LDA     #'G'
        JSR     WRITE_GLYPH

        LDA     #'P'
        JSR     WRITE_GLYPH

        LDA     #'T'
        JSR     WRITE_GLYPH

        LDA     #'1'
        JSR     WRITE_GLYPH

        LDA     #'6'
        JSR     WRITE_GLYPH

        LDA     #'>'
        JSR     WRITE_GLYPH

        LDA     #' '
        JSR     WRITE_GLYPH
        RTS

ENSURE_LINE_START
        LDA     COLUMN
        BEQ     ENSURE_LINE_DONE

        JSR     NEWLINE

ENSURE_LINE_DONE
        RTS

; =============================================================================
; CANCEL PARTIAL GPT INPUT ON ESC,Q
; =============================================================================

CANCEL_REMOTE_INPUT
        LDX     INPUT_COUNT
        BEQ     CANCEL_REMOTE_DONE

CANCEL_REMOTE_LOOP
        LDA     #KEY_BS
        JSR     SEND_UTF16_ASCII

        DEX
        BNE     CANCEL_REMOTE_LOOP

CANCEL_REMOTE_DONE
        LDA     #$00
        STA     INPUT_COUNT
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
; END
; =============================================================================
