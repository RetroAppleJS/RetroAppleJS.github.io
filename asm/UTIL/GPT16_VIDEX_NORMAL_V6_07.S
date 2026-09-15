; =============================================================================
; GPT16_VIDEX_NORMAL_V6_07.S
; =============================================================================
;
; RetroAppleJS ASM_core.js / NMOS 6502
; Load address : $6000
; Call from    : Applesoft BASIC with CALL 24576
;
; V6.07 minimal KRM_ENABLED diagnostic
; ----------------------------------------
;   * Adds local VideoTerm-only Kermit diagnostics; no diagnostic bytes are
;     emitted onto the Serial Pro link, so GPT16/G16/Kermit framing is untouched.
;   * Logs KRM_ENABLED after startup enables KFS1, immediately before each SOH
;     dispatch in RECEIVE_GPT16, and after KRM_RX_AFTER_MARK returns.
;   * Compact events are:
;       [KDBG S K=hh]  startup
;       [KDBG B K=hh]  blocking-path SOH dispatch
;       [KDBG N K=hh]  nonblocking-path SOH dispatch
;       [KDBG O K=hh]  KRM_RX_AFTER_MARK returned success (C=0)
;       [KDBG E K=hh]  KRM_RX_AFTER_MARK returned error   (C=1)
;   * All V6.06 Kermit parsing and G16 behavior remain otherwise unchanged.
;
; V6.06 Kermit non-empty packet receive fix
; -------------------------------------------
;   * Fixes KRM_RX_AFTER_MARK for F/D/G and every other Kermit packet carrying
;     DATA. G16_RX_BYTE_TIMEOUT uses X/Y as polling scratch, so the former
;     X-register payload index was destroyed by every received data byte.
;   * KRM_DATA_INDEX is now memory-backed and X is reloaded only after each
;     timed serial read. Zero-data S packets therefore behave exactly as before,
;     while non-empty F/D/G packets are parsed deterministically.
;   * G16 negotiation, Kermit framing/checksum/sequence semantics, DOS encoding,
;     and the V6.05 G16-before-Kermit demultiplexing behavior are unchanged.
;
; V6.05 G16/Kermit demultiplexing hardening
; -----------------------------------------
;   * Preserves the V6.03 G16 HELLO/ACK/READY exchange byte-for-byte.
;   * KFS1 is explicitly disabled until G16 negotiation has completed.
;   * RECEIVE_GPT16 will only interpret SOH as Kermit after KRM_ENABLED=1.
;   * This prevents the Apple-II side from allowing Kermit state to exist before
;     the negotiated GPT16 data phase.
;
; V6.04 Kermit file-service layer
; ---------------------------------
;   * Preserves the V6.03 G16/1 display negotiation byte-for-byte.
;   * Replaces the model-facing [[A2:...]] and raw-C0 file-control paths with
;     KFS1, a compact classic-Kermit short-packet service on the raw Serial Pro
;     link. GPT sees gateway write_file/read_file tools, not transport syntax.
;   * Gateway-to-Apple writes use S/F/D/Z/B. read_file sends a Kermit generic G
;     packet containing R<filename>; the Apple II ACKs G, becomes the sender,
;     and returns the requested file with ordinary S/F/D/Z/B packets.
;   * Type-1 Kermit checksum, modulo-64 sequence numbers, duplicate detection,
;     bounded retransmission and 80-byte data packets are implemented on 6502.
;   * Writes reuse DOS AUX creation plus FILE_ENCODE_ASCII_A. Reads reuse
;     FM_OPEN_AUX_EXIST, LOAD_DETECT_ENCODING and LOAD_NEXT_CODEPOINT, retaining
;     the established DOS high-bit and escaped-history decoding behavior.
;   * Kermit packets are consumed before UTF-16LE reply decoding. After a file
;     tool transaction RECEIVE_GPT16 waits for the model continuation and then
;     resumes normal bounded reply termination.
;   * No startup briefing or per-turn A2 policy string is sent, reclaiming both
;     wire traffic and PAGE_SCRATCH space. Local [H]/[N]/[C] DOS UI is unchanged.
;
; V6.03 transport-neutral GPT16 display negotiation
; ---------------------------------------------------
;   * Before the first GPT16 request, the Apple II performs a raw 7-bit ASCII
;     G16/1 control-plane handshake over the Serial Pro byte stream. Normal chat
;     traffic remains UTF-16LE only after READY. No browser/emulator behavior is
;     assumed by this client.
;   * HELLO advertises the exact G16D1 display contract for VIDEX:NORMAL:
;       DP=G16D1;ROM=VN;BASE=CP437;VG1=7F;GRID=80x24;FALL=CELL1
;   * READY is accepted only when ROM=VN, BASE=CP437 and FALL=CELL1 remain exact.
;     VG1 may only lose bits and GRID may only shrink. DG may contain only $04
;     (VG1 downgraded) and/or $08 (GRID downgraded), and must agree with the
;     effective values returned by the gateway.
;   * Frames use SOH ... "*" CRC16 ETX. The handshake CRC is CRC-16/CCITT-FALSE
;     (poly $1021, init $FFFF), intentionally distinct from the reflected $A001
;     CRC used locally for Apple II card identification.
;   * HELLO is retried up to four times. ACK, WAIT, READY, NAK and FAIL are
;     recognized. WAIT extends the bounded READY wait. Malformed/CRC-failed
;     frames are retried; semantic READY conflicts and remote FAIL are fatal.
;   * The handshake receive buffer reuses INPUT_BUF only before user input begins.
;     G16_NEGOTIATED persists across CALL / bare-&GPT re-entry.
;   * The display-specific "PREFER ASCII/VIDEX NORMAL" briefing text is removed:
;     display repertoire is a negotiated gateway capability. V6.05 retains the
;     temporary A2 file-control protocol with the KFS1 Kermit service.
;
; V6.02 GPT-created file reliability / visible DOS errors
; ---------------------------------------------------------
;   * GPT file-control policy is reinforced on EVERY user turn, not only in the
;     one-time startup briefing. A request to create/write/save a DOS file or
;     CMD script must use [[A2:C:NAME]] / file body / [[A2:E]], with both
;     control lines starting at column zero.
;   * The per-turn rule is transmitted only to GPT. It is neither displayed nor
;     recorded as part of the user's CHAT-HISTORY text.
;   * Startup briefing now marks GPT-created file controls as mandatory actions.
;   * GPT-created-file OPEN/CLOSE failures are no longer silent: the DOS return
;     code is printed locally, distinguishing disk failure from missing controls.
;
; V6.01 persistent-history reopen/flush fix
; -------------------------------------------
;   * A configured CHAT-HISTORY filename now persists independently of whether
;     its DOS File Manager writer is currently open. The main chat path explicitly
;     reopens/positions the writer at SAVE_POS at the start of every submitted turn.
;   * The history encoders themselves also lazily reopen a configured-but-closed
;     writer, so SAVE_ACTIVE=0 can no longer silently discard a user/reply byte stream.
;   * A completed turn is committed and closed again after RECEIVE_GPT16 and all
;     pending LOAD actions. This guarantees the assistant reply is flushed to disk
;     while the application is idle, rather than remaining only in SAVE_DATA RAM.
;   * ESC from [N]AVIGATE deliberately leaves SAVE inactive. The next submitted
;     chat turn performs the reopen at the known EOF, eliminating the fragile
;     immediate AUX-reader -> SAVE-writer transition that could silently leave
;     history configured but inactive.
;
; V6.00 &GPT dispatch / NAVIGATE return-to-chat fix
; ---------------------------------------------------
;   * Quoted/argument &GPT once again returns directly to Applesoft after the
;     inline GPT reply. V5.98's bare-&GPT launcher label was placed immediately
;     after the inline path, so that path accidentally fell through into START.
;     An explicit JMP AMP_GPT_RETURN now separates the two behaviors.
;   * Bare &GPT still launches the full-screen application.
;   * ESC from [N]AVIGATE no longer restores the pre-navigation screen snapshot.
;     Instead it re-renders the newest 23-row history page, removes the navigation
;     legend, appends the live '[' prompt (and any unsent input), then reopens the
;     same history at EOF for continued recording. This makes a history loaded by
;     [N] become the visible chat context when returning from navigation.
;   * The packed VideoTerm snapshot/save/restore routines are now dead by design
;     and are removed. The shared briefing/menu scratch arena is reduced from
;     $0700 to $0600 bytes, recovering both code and LOMEM headroom.
;
; V5.99 NAVIGATE screen-restore safety fix
; -------------------------------------------
;   * The packed 1792-byte VideoTerm snapshot is no longer aliased with the
;     AUX DOS File Manager work/T-S/data buffers. The V5.98 runtime redirection
;     proved unsafe in real DOS navigation and could overwrite the first $22D
;     bytes of the saved screen, producing corrupted rows after ESC.
;   * AUX and SAVE now have physically independent DOS File Manager buffers.
;     MENU_ROW_SAVE and NAME_INPUT still safely reuse snapshot bytes only while
;     no live navigation snapshot exists.
;   * Removes PAGE_MODE_ACTIVE and its buffer-routing branch; NAVIGATE no longer
;     depends on mutable mode state to protect the screen image.
;   * Restores VideoTerm RAM before reopening history for append, so no DOS call
;     is allowed between the final navigation read and screen restoration.
;   * Adds a build-time guard that the LOMEM image remains below DOS 3.3 $9600.
;
; V5.98 navigation / prompt / bare &GPT refinement
; -------------------------------------------------
;   * Main-app user prompt is now '[' so it is visually distinct from Applesoft's
;     native ']' prompt. History request markers and local LOAD audit lines follow it.
;   * Bare &GPT (no prompt argument) re-enters the full application; &GPT <prompt>
;     retains the resident one-line command behavior.
;   * ESC menu [P]AGE UP/DOWN is renamed [N]AVIGATE. If no history is configured,
;     [N] asks for CHAT HISTORY FILE:, attaches the existing file at its EOF, and
;     opens the newest 23-row page. Left/right arrows page, ESC returns to chat,
;     and W wipes/reinitializes the attached history. Row 24 is reserved for help.
;   * Removes the former [R]EAD SPACE-paged local text-file viewer and its code.
;
; V5.97 one-time GPT briefing / PAGE arena overlay
; --------------------------------------------------
;   * GPT_BRIEFING is stored at the start of PAGE_SCREEN_SAVE during initial
;     program load. After the startup handshake, that memory is released for
;     PAGE/menu/filename scratch use (V5.99 moves AUX DOS buffers out permanently).
;   * GPT_BRIEFED persists across CALL re-entry and prevents the startup
;     briefing from being sent again until the binary itself is reloaded.
;   * .ASSERT protected the original 1792-byte PAGE arena from briefing overflow.
;     V6.00 later removes screen snapshots and reduces the arena to $0600.
;
; V5.96 size-first classic refactor
; ----------------------------------
;   * VideoTerm 2.4 is validated as slot-3-only, so its hardware/workspace
;     operands remain fixed at their native slot-3 addresses; the former
;     PATCH_VIDEX_SLOT self-modifier is removed.
;   * The 512-byte prompt buffer is now a lifetime-based scratch arena for the
;     CMD line editor and GPT response parser/name buffers.
;   * The complete 2 KiB PAGE screen is packed at 7 bits/cell into 1792 bytes.
;     V5.96 originally also overlaid AUX File Manager buffers in this arena;
;     V5.99 keeps DOS buffers independent and retains only the safe filename/menu overlay.
;   * Repeated 512-byte input traversal is factored through INPUT_NEXT_CHAR.
;   * Removes obsolete LOAD_SENT_GPT and LOAD_SURROGATE state/branches. Escaped
;     UTF-16 history already returns surrogate code units one at a time.
;   * Startup GPT policy text is compacted without changing the file protocol.
;
; V5.95 history page navigation / menu refinement
; -------------------------------------------------
;   * ESC menu is now:
;       [N]AVIGATE  [&]GPT [H]ISTORY [C]MD [Q]UIT
;   * [N] commits the active history file, preserves the complete live 2 KiB
;     VideoTerm screen and cursor state, then opens the configured history at
;     its newest page.  Left/right arrows move one 23-row page backward/forward;
;     ESC restores the exact live chat screen and reopens history for append.
;   * [&] installs the resident Applesoft &GPT hook.  On first installation a
;     non-destructive one-shot hint appears beside the cursor and is erased by
;     the next keystroke.
;   * [H] is the SAVE history configuration. The former [R] local LOAD/read
;     viewer is removed in V5.98.
;
; V5.94 &GPT line-boundary fix
; --------------------------------
;   * Applesoft has already advanced to the next display line when its '&' hook
;     is called.  V5.93 emitted another VideoTerm CR, leaving a blank row before
;     every GPT answer.  V5.94 imports the current firmware cursor directly and
;     starts the reply there.
;   * GPT serial replies normally carry a final CR.  Applesoft itself advances
;     once more when the ampersand statement returns, so rendering that terminal
;     CR caused a second blank row before the next ']' prompt.  During &GPT only,
;     CR is now held pending: an internal CR is materialized when more reply text
;     follows, while the terminal trailing CR is discarded.  Applesoft therefore
;     supplies the one and only final newline before its prompt.
;   * Expected direct-mode layout is exactly:
;         ]&GPT "SAY HI"
;         HI
;         ]
;
; V5.93 &GPT VideoTerm workspace fix
; --------------------------------------
;   * Fixes the remaining &GPT placement bug where GPT replies were rendered on
;     the top display row instead of below the Applesoft &GPT command.
;   * VideoTerm 2.4 keeps slot-local workspace in TWO low-byte families:
;         $xx78 + slot : BASEL, CHORZ
;         $xxF8 + slot : BASEH, CVERT, START, FLAGS
;     V5.92 incorrectly patched every workspace operand with $78+slot.  In slot
;     3 this turned $04FB/$05FB/$06FB/$07FB into $047B/$057B/$067B/$077B,
;     corrupting the imported row/base state used by the resident &GPT bridge.
;   * PATCH_VIDEX_SLOT now patches each workspace family separately.  &GPT can
;     therefore emit a real VideoTerm CR after the Applesoft command, import the
;     correct current row, render the GPT reply there, and return with the cursor
;     synchronized at the start of the following line for Applesoft's ] prompt.
;   * Retains the V5.92 SAVE requester fix, so the default is rendered exactly as:
;         SAVE FILE:CHAT-HISTORY<cursor>
;
; V5.9 SAVE / GPT-created CMD / Applesoft &GPT bridge
; ----------------------------------------------------
;   * Default history filename is CHAT-HISTORY.
;   * When GPT finishes a captured DOS/CMD file, the terminal reports the exact
;     filename as [RUN IN APPLESOFT: "EXEC FILENAME"].
;   * ESC menu adds [&]. Selecting it installs an Applesoft ampersand hook at
;     $03F5.  &GPT <prompt> then uses the same Serial Pro GPT session and the
;     currently configured SAVE history file after the main app has returned.
;     The previous $03F5 JMP vector is preserved and chained for non-GPT uses.
;   * Applesoft removes spaces while tokenizing unquoted direct commands.
;     &GPT accepts that compact form; &GPT "prompt with spaces" preserves text
;     exactly and is the preferred form when whitespace matters.
;
; V5.8 banner / startup hint
; --------------------------
;   * Replaces the compressed 7-row 80-column ChatGPT banner with the new logo.
;     It uses the same four-literal / recursive-pair nibble compression scheme.
;   * The first user prompt shows a non-destructive quick hint to the right of
;     the cursor: "[<cursor> [ESC] = menu".  The cursor remains immediately after
;     "[", and the hint disappears as soon as the first key is pressed.
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
;   * CMD creates a DOS 3.3 sequential text file and accepts line-by-line text.
;   * SAVE records requests/replies to a DOS-safe escaped-Unicode history file.
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
;   * 7-row compressed ChatGPT/OpenAI splash banner.
;   * User prompt was ] with no following space (changed to [ in V5.98).
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
;   * Serial Pro I/O is patched from the discovered slot. VideoTerm 2.4 is
;     validated as slot-3-only and therefore uses fixed slot-3 operands.
;
; Conversation UI
; ---------------
;       [7-row ChatGPT / OpenAI banner]
;       [<cursor> [ESC] = menu     (startup hint; first key clears it)
;       [user request
;       GPT response
;       [next request
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
; Before normal UTF-16LE traffic, V6.03 negotiates a transport-neutral G16D1
; display profile with the gateway using raw 7-bit ASCII control frames:
;
;       DP=G16D1;ROM=VN;BASE=CP437;VG1=7F;GRID=80x24;FALL=CELL1
;
; ROM, BASE and FALL are exact semantic commitments. VG1 is intersected downward
; and GRID may shrink; READY must report those reductions through DG=$04/$08.
; After READY, GPT16 replies are received as UTF-16LE and transcoded through the
; exact VIDEX:NORMAL Unicode reverse mapping. KFS1 Kermit packets share the raw
; serial link but are consumed before UTF-16LE decoding.
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

; KFS1 classic Kermit short-packet subset, active only after G16 READY.
KRM_MARK        EQU     $01
KRM_EOL         EQU     $0D
KRM_MAX_DATA    EQU     $50             ; 80 text bytes per D packet
KRM_MAX_RETRY   EQU     $05
KRM_TYPE_S      EQU     'S'
KRM_TYPE_F      EQU     'F'
KRM_TYPE_D      EQU     'D'
KRM_TYPE_Z      EQU     'Z'
KRM_TYPE_B      EQU     'B'
KRM_TYPE_Y      EQU     'Y'
KRM_TYPE_N      EQU     'N'
KRM_TYPE_E      EQU     'E'
KRM_TYPE_G      EQU     'G'             ; KFS1 generic request
KRM_CMD_READ    EQU     'R'
KRM_IDLE        EQU     $00
KRM_RECV_FILE   EQU     $01

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
        JSR     ENGAGE_VIDEX

        JSR     SERIAL_INIT
        JSR     DOS_INIT
        JSR     SCREEN_INIT
        JSR     PRINT_CHATGPT_LOGO

        ; G16/1 negotiation is performed once per loaded binary.  Kermit is not
        ; allowed to own SOH until READY has completed.
        LDA     #$00
        STA     KRM_ENABLED
        LDA     G16_NEGOTIATED
        BNE     START_G16_DONE
        JSR     G16_NEGOTIATE
        BCC     START_G16_OK
        JSR     G16_SHOW_ERROR
        JMP     START_ABORT
START_G16_OK
        LDA     #$01
        STA     G16_NEGOTIATED
START_G16_DONE
        LDA     #$01
        STA     KRM_ENABLED
        LDA     #'S'
        JSR     KRM_DEBUG_EVENT

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
        STA     KRM_STATE
        STA     KRM_RX_EXPECT
        STA     KRM_RX_LAST
        STA     KRM_DATA_INDEX
        STA     KRM_TX_SEQ
        STA     KRM_TX_DATA_LEN
        STA     KRM_TX_LAST_CR
        STA     START_HINT_ACTIVE
        STA     AMP_HINT_ACTIVE
        STA     AMP_RX_MODE
        STA     AMP_PENDING_CR

        ; G16 now carries display/session semantics and KFS1 carries file
        ; semantics. No model-visible bootstrap request is required.

        JSR     PRINT_START_PROMPT

MAIN_INPUT
        JSR     GET_KEY
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
        ; SAVE_CONFIGURED is the persistent policy; SAVE_ACTIVE is only the
        ; current DOS handle. NAVIGATE and completed turns deliberately leave
        ; the writer closed, so every new turn must reopen/position it first.
        JSR     HISTORY_OPEN_CONFIGURED

        ; Submit first so GPT can work while DOS commits the previous reply and
        ; this request.
        JSR     SEND_INPUT_BUFFER
        JSR     HISTORY_WRITE_USER_BUFFER
        JSR     HISTORY_COMMIT_REOPEN

        LDA     #$00
        STA     INPUT_COUNT_LO
        STA     INPUT_COUNT_HI

        JSR     NEWLINE

        JSR     RECEIVE_GPT16

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
        ; Send only the user's request. File operations are gateway tools carried
        ; through Kermit and never model-generated terminal control text.
        JSR     INPUT_ITER_RESET
SEND_INPUT_LOOP
        JSR     INPUT_NEXT_CHAR
        BCC     SEND_INPUT_END
        JSR     SEND_UTF16_ASCII
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
        JSR     SET_HW_CURSOR
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
        JSR     SET_HW_CURSOR
        JSR     HISTORY_ATTACH_EXISTING
        BCC     MENU_NAV_READY
        JSR     SHOW_DOS_ERROR_KEEP_INPUT
        JMP     MAIN_INPUT

MENU_NAV_HAVE_HISTORY
        ; Remove the transient menu before switching into the history viewport.
        JSR     MENU_RESTORE_ROW
        JSR     SET_HW_CURSOR

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
        JSR     GET_KEY_WAIT
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
        JSR     SCREEN_INIT
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

MENU_AMP
        LDA     AMP_INSTALLED
        BNE     MENU_AMP_ALREADY
        JSR     INSTALL_AMP_GPT
        JSR     MENU_RESTORE_ROW
        JSR     SET_HW_CURSOR
        JSR     PRINT_AMP_HINT
        JMP     MAIN_INPUT
MENU_AMP_ALREADY
        JSR     MENU_RESTORE_ROW
        JSR     SET_HW_CURSOR
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
        JSR     SET_HW_CURSOR
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
        JSR     VIDEX_CRTC_WRITE
        LDX     TMP_LO
        LDA     #CRTC_CURSOR_LO
        JSR     VIDEX_CRTC_WRITE
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
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
        PHA
        JSR     FM_CLOSE_AUX
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
        ; A new SAVE request replaces the previous persistent configuration.
        ; Only mark it configured again after the new file and history magic
        ; have been created successfully.
        LDA     #$00
        STA     SAVE_CONFIGURED
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
        STA     SAVE_CONFIGURED
        CLC
        RTS

SAVE_MAGIC_FAIL
        LDA     DOS_LAST_RC
        PHA
        JSR     FM_CLOSE_SAVE
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
        JSR     FILE_ENCODE_CP
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

; Close a configured SAVE file while keeping SAVE_POS on the byte that will
; overwrite the committed DOS $00 EOF when &GPT later appends another turn.
HISTORY_CLOSE_PRESERVE
        LDA     SAVE_ACTIVE
        BEQ     HISTORY_CLOSE_PRESERVE_DONE
        LDA     #$00
        JSR     FM_WRITE_SAVE_RAW
        BCS     HISTORY_CLOSE_PRESERVE_FAIL
        LDA     SAVE_POS_LO
        BNE     HISTORY_CLOSE_PRESERVE_DEC_LO
        DEC     SAVE_POS_HI
HISTORY_CLOSE_PRESERVE_DEC_LO
        DEC     SAVE_POS_LO
        JSR     FM_CLOSE_SAVE
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
        JSR     FM_CLOSE_SAVE
        SEC
        RTS

HISTORY_DISABLE
        LDA     DOS_LAST_RC
        PHA
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
        JSR     FM_CLOSE_SAVE
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
        JSR     FM_OPEN_AUX_EXIST
        BCC     HISTORY_ATTACH_OPENED
        JMP     HISTORY_ATTACH_FAIL

HISTORY_ATTACH_OPENED
        LDA     #$01
        STA     AUX_OPEN
        LDA     #$00
        STA     LOAD_COUNT_LO
        STA     LOAD_COUNT_HI

HISTORY_ATTACH_SCAN
        JSR     FM_READ_AUX
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
        JSR     FM_CLOSE_AUX
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
        JSR     FM_CLOSE_AUX
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
        JSR     FM_OPEN_AUX_EXIST
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
        JSR     FM_CLOSE_AUX
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
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        RTS

PAGE_CLOSE_HISTORY_ERROR
        LDA     DOS_LAST_RC
        PHA
        JSR     FM_CLOSE_AUX
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
        JSR     SCREEN_INIT
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
        JSR     WRITE_GLYPH
        JMP     PAGE_RENDER_ADVANCE
PAGE_RENDER_NEWLINE
        JSR     NEWLINE
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        BNE     PAGE_DRAW_HELP_LOOP
        INC     MSG_ZPH
        JMP     PAGE_DRAW_HELP_LOOP
PAGE_DRAW_HELP_DONE
        ; Keep the blinking hardware cursor out of the history text.
        LDX     #$07
        LDA     #CRTC_CURSOR_HI
        JSR     VIDEX_CRTC_WRITE
        LDX     #$7F
        LDA     #CRTC_CURSOR_LO
        JSR     VIDEX_CRTC_WRITE
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
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        DEY
        BNE     PAGE_CLEAR_HELP_LOOP
        JSR     SET_HW_CURSOR
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

; =============================================================================
; KFS1 KERMIT FILE SERVICE
; =============================================================================
;
; Classic short packet:
;       SOH LEN SEQ TYPE DATA CHECK CR
;
; LEN, SEQ and CHECK use tochar(x)=x+$20. LEN counts SEQ+TYPE+DATA+CHECK.
; CHECK is Kermit's type-1 checksum. DATA is limited to 80 bytes in KFS1.
;

KRM_SUM_ADD
        CLC
        ADC     KRM_SUM
        STA     KRM_SUM
        RTS

KRM_SUM_FINISH
        LDA     KRM_SUM
        AND     #$C0
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        CLC
        ADC     KRM_SUM
        AND     #$3F
        CLC
        ADC     #$20
        RTS

; SOH is already consumed. C=0 valid packet, C=1 timeout/format/checksum error.
KRM_RX_AFTER_MARK
        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        STA     KRM_LEN_CHAR
        SEC
        SBC     #$20
        CMP     #$03
        BCC     KRM_RX_BAD
        CMP     #$54                    ; max LEN = 80+3 = $53
        BCS     KRM_RX_BAD
        STA     KRM_RX_LEN
        LDA     #$00
        STA     KRM_SUM
        LDA     KRM_LEN_CHAR
        JSR     KRM_SUM_ADD

        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        STA     KRM_SEQ_CHAR
        JSR     KRM_SUM_ADD
        LDA     KRM_SEQ_CHAR
        SEC
        SBC     #$20
        AND     #$3F
        STA     KRM_RX_SEQ

        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        STA     KRM_RX_TYPE
        JSR     KRM_SUM_ADD

        LDA     KRM_RX_LEN
        SEC
        SBC     #$03
        STA     KRM_RX_DATA_LEN
        LDA     #$00
        STA     KRM_DATA_INDEX
KRM_RX_DATA_LOOP
        LDA     KRM_DATA_INDEX
        CMP     KRM_RX_DATA_LEN
        BEQ     KRM_RX_CHECK

        ; G16_RX_BYTE_TIMEOUT deliberately uses X/Y as polling scratch.
        ; Keep the persistent payload index in memory and reload X only after
        ; the byte has arrived.
        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        LDX     KRM_DATA_INDEX
        STA     KRM_BUF,X
        JSR     KRM_SUM_ADD
        INC     KRM_DATA_INDEX
        JMP     KRM_RX_DATA_LOOP

KRM_RX_CHECK
        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        STA     KRM_RX_CHECKSUM
        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_RX_BAD
        CMP     #KRM_EOL
        BNE     KRM_RX_BAD
        JSR     KRM_SUM_FINISH
        CMP     KRM_RX_CHECKSUM
        BNE     KRM_RX_BAD
        CLC
        RTS
KRM_RX_BAD
        SEC
        RTS

; Blocking packet receive used while Apple II is the Kermit sender.
KRM_WAIT_PACKET
KRM_WAIT_MARK
        JSR     G16_RX_BYTE_TIMEOUT
        BCC     KRM_WAIT_BAD
        CMP     #KRM_MARK
        BNE     KRM_WAIT_MARK
        JMP     KRM_RX_AFTER_MARK
KRM_WAIT_BAD
        SEC
        RTS

; Emit KRM_TX_SEQ/KRM_TX_TYPE/KRM_TX_DATA_LEN/KRM_BUF.
KRM_SEND_PACKET
        LDA     #KRM_MARK
        JSR     SERIAL_TX_BYTE
        LDA     #$00
        STA     KRM_SUM

        LDA     KRM_TX_DATA_LEN
        CLC
        ADC     #$03
        STA     KRM_TX_LEN
        CLC
        ADC     #$20
        PHA
        JSR     KRM_SUM_ADD
        PLA
        JSR     SERIAL_TX_BYTE

        LDA     KRM_TX_SEQ
        AND     #$3F
        CLC
        ADC     #$20
        PHA
        JSR     KRM_SUM_ADD
        PLA
        JSR     SERIAL_TX_BYTE

        LDA     KRM_TX_TYPE
        PHA
        JSR     KRM_SUM_ADD
        PLA
        JSR     SERIAL_TX_BYTE

        LDY     #$00
KRM_TX_DATA_LOOP
        CPY     KRM_TX_DATA_LEN
        BEQ     KRM_TX_CHECK
        LDA     KRM_BUF,Y
        PHA
        JSR     KRM_SUM_ADD
        PLA
        JSR     SERIAL_TX_BYTE
        INY
        JMP     KRM_TX_DATA_LOOP
KRM_TX_CHECK
        JSR     KRM_SUM_FINISH
        JSR     SERIAL_TX_BYTE
        LDA     #KRM_EOL
        JMP     SERIAL_TX_BYTE

; A=sequence, X=Y/N/E; empty DATA.
KRM_SEND_EMPTY
        STA     KRM_TX_SEQ
        STX     KRM_TX_TYPE
        LDA     #$00
        STA     KRM_TX_DATA_LEN
        JMP     KRM_SEND_PACKET
KRM_SEND_ACK
        LDX     #KRM_TYPE_Y
        JMP     KRM_SEND_EMPTY
KRM_SEND_NAK
        LDX     #KRM_TYPE_N
        JMP     KRM_SEND_EMPTY
KRM_SEND_ERROR
        LDX     #KRM_TYPE_E
        JMP     KRM_SEND_EMPTY

KRM_ACCEPT_RX
        LDA     KRM_RX_SEQ
        STA     KRM_RX_LAST
        CLC
        ADC     #$01
        AND     #$3F
        STA     KRM_RX_EXPECT
        LDA     KRM_RX_LAST
        JMP     KRM_SEND_ACK

; C=0 means new expected packet. C=1 means duplicate/out-of-order was handled.
KRM_CHECK_RX_SEQ
        LDA     KRM_RX_SEQ
        CMP     KRM_RX_EXPECT
        BEQ     KRM_SEQ_NEW
        CMP     KRM_RX_LAST
        BNE     KRM_SEQ_BAD
        LDA     KRM_RX_SEQ              ; lost ACK: acknowledge, do not execute twice
        JSR     KRM_SEND_ACK
        SEC
        RTS
KRM_SEQ_BAD
        LDA     KRM_RX_SEQ
        JSR     KRM_SEND_NAK
        SEC
        RTS
KRM_SEQ_NEW
        CLC
        RTS

KRM_HANDLE_PACKET
        LDA     KRM_RX_TYPE
        CMP     #KRM_TYPE_S
        BNE     KRM_DISPATCH_NOT_S
        JMP     KRM_HANDLE_S
KRM_DISPATCH_NOT_S
        CMP     #KRM_TYPE_G
        BNE     KRM_DISPATCH_NOT_G
        JMP     KRM_HANDLE_G
KRM_DISPATCH_NOT_G
        CMP     #KRM_TYPE_F
        BNE     KRM_DISPATCH_NOT_F
        JMP     KRM_HANDLE_F
KRM_DISPATCH_NOT_F
        CMP     #KRM_TYPE_D
        BNE     KRM_DISPATCH_NOT_D
        JMP     KRM_HANDLE_D
KRM_DISPATCH_NOT_D
        CMP     #KRM_TYPE_Z
        BNE     KRM_DISPATCH_NOT_Z
        JMP     KRM_HANDLE_Z
KRM_DISPATCH_NOT_Z
        CMP     #KRM_TYPE_B
        BNE     KRM_DISPATCH_UNKNOWN
        JMP     KRM_HANDLE_B
KRM_DISPATCH_UNKNOWN
        LDA     KRM_RX_SEQ
        JMP     KRM_SEND_NAK

; S begins gateway->Apple write transaction.
KRM_HANDLE_S
        LDA     KRM_STATE
        CMP     #KRM_RECV_FILE
        BNE     KRM_S_NEW
        LDA     KRM_RX_SEQ
        CMP     KRM_RX_LAST
        BNE     KRM_S_NEW
        JMP     KRM_SEND_ACK
KRM_S_NEW
        LDA     AUX_OPEN
        BEQ     KRM_S_READY
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
KRM_S_READY
        LDA     #KRM_RECV_FILE
        STA     KRM_STATE
        LDA     KRM_RX_SEQ
        STA     KRM_RX_LAST
        CLC
        ADC     #$01
        AND     #$3F
        STA     KRM_RX_EXPECT
        LDA     KRM_RX_SEQ
        JMP     KRM_SEND_ACK

; F creates/replaces named DOS text file.
KRM_HANDLE_F
        LDA     KRM_STATE
        CMP     #KRM_RECV_FILE
        BEQ     KRM_F_STATE_OK
        JMP     KRM_BAD_STATE
KRM_F_STATE_OK
        JSR     KRM_CHECK_RX_SEQ
        BCC     KRM_F_SEQ_OK
        RTS
KRM_F_SEQ_OK
        LDA     KRM_RX_DATA_LEN
        BNE     KRM_F_LEN_NONZERO
        JMP     KRM_BAD_STATE
KRM_F_LEN_NONZERO
        CMP     #$1F                    ; MAX_FILENAME+1
        BCC     KRM_F_LEN_OK
        JMP     KRM_BAD_STATE
KRM_F_LEN_OK
        STA     NAME_LEN
        LDX     #$00
KRM_F_NAME_LOOP
        CPX     NAME_LEN
        BEQ     KRM_F_NAME_DONE
        LDA     KRM_BUF,X
        CMP     #$20
        BCS     KRM_F_NAME_LOW_OK
        JMP     KRM_BAD_STATE
KRM_F_NAME_LOW_OK
        CMP     #$7F
        BCC     KRM_F_NAME_HIGH_OK
        JMP     KRM_BAD_STATE
KRM_F_NAME_HIGH_OK
        JSR     ASCII_TO_UPPER
        STA     NAME_INPUT,X
        INX
        JMP     KRM_F_NAME_LOOP
KRM_F_NAME_DONE
        JSR     COPY_INPUT_TO_AUX_NAME
        JSR     FM_CREATE_AUX
        BCC     KRM_F_CREATE_OK
        JMP     KRM_DOS_ERROR
KRM_F_CREATE_OK
        LDA     #$01
        STA     AUX_OPEN
        LDX     #FILE_TARGET_AUX
        LDA     #$00
        STA     ENC_LAST_CR,X
        JMP     KRM_ACCEPT_RX

; D uses the existing DOS encoder: high bit, CR/LF collapse, unsupported -> '?'.
KRM_HANDLE_D
        LDA     KRM_STATE
        CMP     #KRM_RECV_FILE
        BEQ     KRM_D_STATE_OK
        JMP     KRM_BAD_STATE
KRM_D_STATE_OK
        JSR     KRM_CHECK_RX_SEQ
        BCS     KRM_HANDLE_DONE
        LDA     AUX_OPEN
        BEQ     KRM_BAD_STATE
        LDA     #FILE_TARGET_AUX
        STA     FILE_TARGET
        LDA     #FILE_ENCODING_DOS
        STA     FILE_ENCODING
        LDX     #$00
KRM_D_WRITE_LOOP
        CPX     KRM_RX_DATA_LEN
        BEQ     KRM_D_WRITE_DONE
        LDA     KRM_BUF,X
        TXA
        PHA
        LDA     KRM_BUF,X
        JSR     FILE_ENCODE_ASCII_A
        PLA
        TAX
        BCS     KRM_DOS_ERROR
        INX
        JMP     KRM_D_WRITE_LOOP
KRM_D_WRITE_DONE
        JMP     KRM_ACCEPT_RX

KRM_HANDLE_Z
        LDA     KRM_STATE
        CMP     #KRM_RECV_FILE
        BEQ     KRM_Z_STATE_OK
        JMP     KRM_BAD_STATE
KRM_Z_STATE_OK
        JSR     KRM_CHECK_RX_SEQ
        BCS     KRM_HANDLE_DONE
        LDA     AUX_OPEN
        BEQ     KRM_BAD_STATE
        JSR     FM_EOF_CLOSE_AUX
        BCS     KRM_DOS_ERROR
        LDA     #$00
        STA     AUX_OPEN
        JMP     KRM_ACCEPT_RX

KRM_HANDLE_B
        LDA     KRM_STATE
        CMP     #KRM_RECV_FILE
        BEQ     KRM_B_STATE_OK
        ; A lost ACK may cause the gateway to retransmit the already accepted B
        ; after KRM_STATE returned to idle. ACK that duplicate idempotently.
        LDA     KRM_RX_SEQ
        CMP     KRM_RX_LAST
        BNE     KRM_B_BAD
        JMP     KRM_SEND_ACK
KRM_B_BAD
        JMP     KRM_BAD_STATE
KRM_B_STATE_OK
        JSR     KRM_CHECK_RX_SEQ
        BCC     KRM_B_SEQ_OK
        RTS
KRM_B_SEQ_OK
        JSR     KRM_ACCEPT_RX
        LDA     #KRM_IDLE
        STA     KRM_STATE
KRM_HANDLE_DONE
        RTS

KRM_BAD_STATE
        LDA     KRM_RX_SEQ
        JMP     KRM_SEND_NAK

KRM_DOS_ERROR
        LDA     AUX_OPEN
        BEQ     KRM_DOS_ERROR_SEND
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
KRM_DOS_ERROR_SEND
        LDA     #KRM_IDLE
        STA     KRM_STATE
        LDA     KRM_RX_SEQ
        JMP     KRM_SEND_ERROR

; G DATA='R'+filename requests Apple->gateway read_file.
KRM_HANDLE_G
        LDA     KRM_RX_DATA_LEN
        CMP     #$02
        BCC     KRM_G_BAD
        LDA     KRM_BUF
        CMP     #KRM_CMD_READ
        BNE     KRM_G_BAD
        LDA     KRM_RX_DATA_LEN
        SEC
        SBC     #$01
        BEQ     KRM_G_BAD
        CMP     #$1F
        BCS     KRM_G_BAD
        STA     NAME_LEN
        LDX     #$00
KRM_G_NAME_LOOP
        CPX     NAME_LEN
        BEQ     KRM_G_NAME_DONE
        LDA     KRM_BUF+1,X
        CMP     #$20
        BCC     KRM_G_BAD
        CMP     #$7F
        BCS     KRM_G_BAD
        JSR     ASCII_TO_UPPER
        STA     NAME_INPUT,X
        INX
        JMP     KRM_G_NAME_LOOP
KRM_G_NAME_DONE
        JSR     COPY_INPUT_TO_AUX_NAME
        LDA     KRM_RX_SEQ
        JSR     KRM_SEND_ACK
        JSR     KRM_SEND_AUX_FILE
        RTS
KRM_G_BAD
        LDA     KRM_RX_SEQ
        JMP     KRM_SEND_NAK

; Reliable Apple sender. Retries exactly the same sequence and payload.
KRM_SEND_WAIT_ACK
        LDA     #KRM_MAX_RETRY
        STA     KRM_RETRY
KRM_SEND_RETRY
        JSR     KRM_SEND_PACKET
        JSR     KRM_WAIT_PACKET
        BCS     KRM_SEND_RETRY_FAIL
        LDA     KRM_RX_TYPE
        CMP     #KRM_TYPE_E
        BEQ     KRM_SEND_FATAL
        CMP     #KRM_TYPE_Y
        BNE     KRM_SEND_RETRY_FAIL
        LDA     KRM_RX_SEQ
        CMP     KRM_TX_SEQ
        BNE     KRM_SEND_RETRY_FAIL
        INC     KRM_TX_SEQ
        LDA     KRM_TX_SEQ
        AND     #$3F
        STA     KRM_TX_SEQ
        CLC
        RTS
KRM_SEND_RETRY_FAIL
        DEC     KRM_RETRY
        BNE     KRM_SEND_RETRY
KRM_SEND_FATAL
        SEC
        RTS

KRM_SEND_DATA
        LDA     #KRM_TYPE_D
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_WAIT_ACK
        BCS     KRM_SEND_DATA_DONE
        LDA     #$00
        STA     KRM_TX_DATA_LEN
KRM_SEND_DATA_DONE
        RTS

; Existing LOAD decoder strips DOS high bits and expands escaped history.
KRM_SEND_AUX_FILE
        JSR     FM_OPEN_AUX_EXIST
        BCC     KRM_FILE_OPEN
        JMP     KRM_FILE_ERROR
KRM_FILE_OPEN
        LDA     #$01
        STA     AUX_OPEN
        JSR     LOAD_DETECT_ENCODING
        BCC     KRM_FILE_ENCODING
        JMP     KRM_FILE_CLOSE_ERROR
KRM_FILE_ENCODING
        LDA     #$00
        STA     KRM_TX_SEQ
        STA     KRM_TX_DATA_LEN
        STA     KRM_TX_LAST_CR

        LDA     #KRM_TYPE_S
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_WAIT_ACK
        BCC     KRM_FILE_S_OK
        JMP     KRM_FILE_CLOSE_ERROR
KRM_FILE_S_OK

        LDX     #$00
KRM_FILE_NAME_LOOP
        CPX     NAME_LEN
        BEQ     KRM_FILE_NAME_READY
        LDA     NAME_INPUT,X
        STA     KRM_BUF,X
        INX
        JMP     KRM_FILE_NAME_LOOP
KRM_FILE_NAME_READY
        STX     KRM_TX_DATA_LEN
        LDA     #KRM_TYPE_F
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_WAIT_ACK
        BCC     KRM_FILE_F_OK
        JMP     KRM_FILE_CLOSE_ERROR
KRM_FILE_F_OK
        LDA     #$00
        STA     KRM_TX_DATA_LEN

KRM_FILE_READ_LOOP
        JSR     LOAD_NEXT_CODEPOINT
        BCS     KRM_FILE_HAVE_CP
        LDA     DOS_LAST_RC
        CMP     #FM_END_DATA
        BEQ     KRM_FILE_FLUSH
        JMP     KRM_FILE_CLOSE_ERROR

KRM_FILE_HAVE_CP
        LDA     CP_HI
        BNE     KRM_FILE_QMARK
        LDA     CP_LO
        CMP     #KEY_CR
        BEQ     KRM_FILE_CR
        CMP     #$0A
        BEQ     KRM_FILE_LF
        CMP     #$20
        BCC     KRM_FILE_QMARK
        CMP     #$7F
        BCS     KRM_FILE_QMARK
        LDA     #$00
        STA     KRM_TX_LAST_CR
        LDA     CP_LO
        JMP     KRM_FILE_PUT
KRM_FILE_CR
        LDA     #$01
        STA     KRM_TX_LAST_CR
        LDA     #$0A
        JMP     KRM_FILE_PUT
KRM_FILE_LF
        LDA     KRM_TX_LAST_CR
        BEQ     KRM_FILE_LF_ONLY
        LDA     #$00
        STA     KRM_TX_LAST_CR
        JMP     KRM_FILE_READ_LOOP
KRM_FILE_LF_ONLY
        LDA     #$0A
        JMP     KRM_FILE_PUT
KRM_FILE_QMARK
        LDA     #$00
        STA     KRM_TX_LAST_CR
        LDA     #'?'
KRM_FILE_PUT
        LDY     KRM_TX_DATA_LEN
        STA     KRM_BUF,Y
        INY
        STY     KRM_TX_DATA_LEN
        CPY     #KRM_MAX_DATA
        BCC     KRM_FILE_READ_LOOP
        JSR     KRM_SEND_DATA
        BCS     KRM_FILE_CLOSE_ERROR
        JMP     KRM_FILE_READ_LOOP

KRM_FILE_FLUSH
        LDA     KRM_TX_DATA_LEN
        BEQ     KRM_FILE_Z
        JSR     KRM_SEND_DATA
        BCS     KRM_FILE_CLOSE_ERROR
KRM_FILE_Z
        LDA     #$00
        STA     KRM_TX_DATA_LEN
        LDA     #KRM_TYPE_Z
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_WAIT_ACK
        BCS     KRM_FILE_CLOSE_ERROR
        LDA     #KRM_TYPE_B
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_WAIT_ACK
        BCS     KRM_FILE_CLOSE_ERROR
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
        CLC
        RTS

KRM_FILE_CLOSE_ERROR
        LDA     DOS_LAST_RC
        PHA
        LDA     AUX_OPEN
        BEQ     KRM_FILE_RESTORE_ERROR
        JSR     FM_CLOSE_AUX
        LDA     #$00
        STA     AUX_OPEN
KRM_FILE_RESTORE_ERROR
        PLA
        STA     DOS_LAST_RC
KRM_FILE_ERROR
        ; G has already been ACKed, so send E as sender sequence zero.
        LDA     #$00
        STA     KRM_TX_SEQ
        STA     KRM_TX_DATA_LEN
        LDA     #KRM_TYPE_E
        STA     KRM_TX_TYPE
        JSR     KRM_SEND_PACKET
        SEC
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
        JSR     INPUT_ITER_RESET
SHOW_REPRINT_INPUT
        JSR     INPUT_NEXT_CHAR
        BCC     SHOW_KEEP_DONE
        JSR     WRITE_GLYPH
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
        LDA     AUX_OPEN
        BEQ     CLOSE_NO_AUX
        JSR     FM_EOF_CLOSE_AUX
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
        JSR     IMPORT_VIDEX_FIRMWARE
        JSR     SET_HW_CURSOR

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

        JSR     RECEIVE_GPT16

        LDA     #$00
        STA     AMP_RX_MODE
        STA     AMP_PENDING_CR

        ; Do NOT ENSURE_LINE_START here.  Leave the raw/firmware cursor at the
        ; end of the final GPT text.  Applesoft's normal statement-completion CR
        ; moves to the next row and prints its ']' Applesoft prompt there.

        ; Returning to Applesoft with a SAVE file left open would make subsequent
        ; DOS command use unnecessarily fragile. Commit EOF and keep its offset.
        JSR     HISTORY_CLOSE_PRESERVE
        JSR     SET_HW_CURSOR

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
        JSR     FM_OPEN_SAVE_EXIST
        BCS     AMP_OPEN_SAVE_FAIL
        JSR     FM_POSITION_SAVE
        BCS     AMP_OPEN_SAVE_FAIL_CLOSE
        LDA     #$01
        STA     SAVE_ACTIVE
AMP_OPEN_SAVE_DONE
        RTS
AMP_OPEN_SAVE_FAIL_CLOSE
        JSR     FM_CLOSE_SAVE
AMP_OPEN_SAVE_FAIL
        LDA     #$00
        STA     SAVE_ACTIVE
        STA     SAVE_CONFIGURED
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
        JSR     ENSURE_LINE_START
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

; -----------------------------------------------------------------------------
; V6.07 local-only Kermit diagnostic.
; A = event letter.  Deliberately writes only to VideoTerm; it never transmits
; serial bytes and therefore cannot perturb GPT16/G16/Kermit wire state.
; -----------------------------------------------------------------------------
KRM_DEBUG_EVENT
        PHA
        JSR     ENSURE_LINE_START
        LDX     #<TXT_KDBG_PREFIX
        LDY     #>TXT_KDBG_PREFIX
        JSR     PRINT_SCREEN_STRING
        PLA
        JSR     WRITE_GLYPH
        LDX     #<TXT_KDBG_VALUE
        LDY     #>TXT_KDBG_VALUE
        JSR     PRINT_SCREEN_STRING
        LDA     KRM_ENABLED
        JSR     PRINT_HEX_BYTE
        LDA     #']'
        JSR     WRITE_GLYPH
        JSR     NEWLINE
        RTS

; =============================================================================
; ROLLING GPT16 RESPONSE RECEIVER
; =============================================================================

RECEIVE_GPT16
        LDA     #$00
        STA     LAST_CR
        STA     AMP_PENDING_CR

; First raw byte blocks because the model/gateway may still be working.
RECEIVE_WAIT_RAW
        JSR     SERIAL_RX_BLOCK
RECEIVE_HAVE_RAW
        CMP     #KRM_MARK
        BNE     RECEIVE_UTF16_LOW
        LDA     #'B'
        JSR     KRM_DEBUG_EVENT
        LDA     KRM_ENABLED
        BNE     RECEIVE_HAVE_KRM_MARK
        LDA     #KRM_MARK
        JMP     RECEIVE_UTF16_LOW
RECEIVE_HAVE_KRM_MARK
        JSR     KRM_RX_AFTER_MARK
        BCC     RECEIVE_KRM_BLOCK_OK
        LDA     #'E'
        JSR     KRM_DEBUG_EVENT
        JMP     RECEIVE_WAIT_RAW
RECEIVE_KRM_BLOCK_OK
        LDA     #'O'
        JSR     KRM_DEBUG_EVENT
        JSR     KRM_HANDLE_PACKET
        ; A file tool causes a second model generation after Kermit completes.
        ; Wait without the ordinary short end-of-reply idle window.
        JMP     RECEIVE_WAIT_RAW

RECEIVE_UTF16_LOW
        STA     CP_LO
        JSR     SERIAL_RX_BLOCK
        STA     CP_HI

RECEIVE_CODE_UNIT
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
        JSR     HISTORY_WRITE_SURROGATE
        JSR     MAP_SURROGATE
        BCC     RECEIVE_NEXT
        JSR     WRITE_GLYPH
        JMP     RECEIVE_NEXT

RECEIVE_BMP
        JSR     PROCESS_BMP_CODEPOINT

RECEIVE_NEXT
        JSR     SERIAL_RX_NEXT
        BCC     RECEIVE_DONE
        CMP     #KRM_MARK
        BNE     RECEIVE_UTF16_LOW
        LDA     #'N'
        JSR     KRM_DEBUG_EVENT
        LDA     KRM_ENABLED
        BNE     RECEIVE_NEXT_KRM_MARK
        LDA     #KRM_MARK
        JMP     RECEIVE_UTF16_LOW
RECEIVE_NEXT_KRM_MARK
        JSR     KRM_RX_AFTER_MARK
        BCC     RECEIVE_KRM_NEXT_OK
        LDA     #'E'
        JSR     KRM_DEBUG_EVENT
        JMP     RECEIVE_NEXT
RECEIVE_KRM_NEXT_OK
        LDA     #'O'
        JSR     KRM_DEBUG_EVENT
        JSR     KRM_HANDLE_PACKET
        JMP     RECEIVE_WAIT_RAW

RECEIVE_DONE
        RTS

; File service bytes never reach this path; only decoded GPT16 text does.
PROCESS_BMP_CODEPOINT
        LDA     AMP_RX_MODE
        BEQ     PROCESS_NO_AMP_PENDING
        LDA     AMP_PENDING_CR
        BEQ     PROCESS_NO_AMP_PENDING
        LDA     CP_HI
        BNE     PROCESS_FLUSH_AMP_CR
        LDA     CP_LO
        CMP     #$0A
        BEQ     PROCESS_NO_AMP_PENDING
PROCESS_FLUSH_AMP_CR
        JSR     NEWLINE
        LDA     #$00
        STA     AMP_PENDING_CR
PROCESS_NO_AMP_PENDING

PROCESS_NORMAL
        JSR     HISTORY_WRITE_CP
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
        LDA     AMP_RX_MODE
        BEQ     PROCESS_CR_NORMAL
        LDA     #$01
        STA     AMP_PENDING_CR
        STA     LAST_CR
        RTS
PROCESS_CR_NORMAL
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
        JSR     WRITE_GLYPH
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
        JSR     INC_TEMP_ADDR           ; hint starts one cell right of cursor

        LDX     #<TXT_START_HINT
        LDY     #>TXT_START_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00

PRINT_START_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_START_HINT_DONE
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        BNE     PRINT_START_HINT_LOOP
        INC     MSG_ZPH
        JMP     PRINT_START_HINT_LOOP

PRINT_START_HINT_DONE
        JSR     SET_HW_CURSOR
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
        JSR     INC_TEMP_ADDR

        LDX     #<TXT_START_HINT
        LDY     #>TXT_START_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00

CLEAR_START_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     CLEAR_START_HINT_RESTORE
        LDA     #SPACE_GLYPH
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        BNE     CLEAR_START_HINT_LOOP
        INC     MSG_ZPH
        JMP     CLEAR_START_HINT_LOOP

CLEAR_START_HINT_RESTORE
        JSR     SET_HW_CURSOR

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
        JSR     INC_TEMP_ADDR
        LDX     #<TXT_AMP_HINT
        LDY     #>TXT_AMP_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
PRINT_AMP_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     PRINT_AMP_HINT_DONE
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        BNE     PRINT_AMP_HINT_LOOP
        INC     MSG_ZPH
        JMP     PRINT_AMP_HINT_LOOP
PRINT_AMP_HINT_DONE
        JSR     SET_HW_CURSOR
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
        JSR     INC_TEMP_ADDR
        LDX     #<TXT_AMP_HINT
        LDY     #>TXT_AMP_HINT
        STX     MSG_ZPL
        STY     MSG_ZPH
        LDY     #$00
CLEAR_AMP_HINT_LOOP
        LDA     (MSG_ZPL),Y
        BEQ     CLEAR_AMP_HINT_RESTORE
        LDA     #SPACE_GLYPH
        JSR     WRITE_CELL_TEMP_RAW
        JSR     INC_TEMP_ADDR
        INY
        BNE     CLEAR_AMP_HINT_LOOP
        INC     MSG_ZPH
        JMP     CLEAR_AMP_HINT_LOOP
CLEAR_AMP_HINT_RESTORE
        JSR     SET_HW_CURSOR
CLEAR_AMP_HINT_DONE
        RTS

PRINT_USER_PROMPT
        LDA     #USER_PROMPT_CHAR
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
; VIDEX:NORMAL UNICODE TABLES
; =============================================================================

BMP_LOW
        HEX     8875761477020C1C7418003410242C3C

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
TXT_KDBG_PREFIX
        ASC     "[KDBG "
        HEX     00
TXT_KDBG_VALUE
        ASC     " K="
        HEX     00

TXT_G16_ERROR
        ASC     "GPT16 NEGOTIATION FAILED $"
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

START_HINT_ACTIVE
        HEX     00
AMP_HINT_ACTIVE
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

BANK_TEMP
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

SAVE_ACTIVE
        HEX     00
SAVE_CONFIGURED
        HEX     00
SAVE_NAME_LEN
        HEX     00
AUX_OPEN
        HEX     00

; Persists across CALL re-entry. Reloading the binary initializes it to zero.
; Do not add G16_NEGOTIATED to the START state-clear block.
G16_NEGOTIATED
        HEX     00

; G16/1 handshake scratch/state. The receive bytes themselves overlay INPUT_BUF
; only before normal editing begins.
G16_ERROR
        HEX     00
G16_RETRIES_LEFT
        HEX     00
G16_READY_LEFT
        HEX     00
G16_WAIT_LEFT
        HEX     00
G16_TIMEOUT_PASS
        HEX     00
G16_FRAME_LEN
        HEX     00
G16_BODY_LEN
        HEX     00
G16_PARSE_INDEX
        HEX     00
G16_RX_TEMP
        HEX     00
G16_CRC_LO
        HEX     00
G16_CRC_HI
        HEX     00
G16_RXCRC_LO
        HEX     00
G16_RXCRC_HI
        HEX     00
G16_NUM_TEMP
        HEX     00
G16_DEC_TEMP
        HEX     00
G16_EFFECTIVE_VG1
        HEX     00
G16_EFFECTIVE_COLS
        HEX     00
G16_EFFECTIVE_ROWS
        HEX     00
G16_DG
        HEX     00

; KFS1 is a data-phase service only. It remains disabled until G16 READY.
KRM_ENABLED
        HEX     00

; KFS1 state. The payload buffer overlays INPUT_BUF while the editor is idle.
KRM_STATE
        HEX     00
KRM_RX_EXPECT
        HEX     00
KRM_RX_LAST
        HEX     00
KRM_RX_LEN
        HEX     00
KRM_RX_SEQ
        HEX     00
KRM_RX_TYPE
        HEX     00
KRM_RX_DATA_LEN
        HEX     00
KRM_DATA_INDEX
        HEX     00
KRM_RX_CHECKSUM
        HEX     00
KRM_LEN_CHAR
        HEX     00
KRM_SEQ_CHAR
        HEX     00
KRM_SUM
        HEX     00
KRM_TX_SEQ
        HEX     00
KRM_TX_TYPE
        HEX     00
KRM_TX_LEN
        HEX     00
KRM_TX_DATA_LEN
        HEX     00
KRM_TX_LAST_CR
        HEX     00
KRM_RETRY
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
LOAD_LAST_CR
        HEX     00
ESC_DIGITS
        HEX     00
HEX_TEMP
        HEX     00

; V5.95 active-history page navigator state.
PAGE_CUR_LO
        HEX     00
PAGE_CUR_HI
        HEX     00
PAGE_LAST_LO
        HEX     00
PAGE_LAST_HI
        HEX     00
PAGE_TARGET_LO
        HEX     00
PAGE_TARGET_HI
        HEX     00
PAGE_SCAN_ROW
        HEX     00
PAGE_SCAN_COL
        HEX     00
PAGE_LAST_CR
        HEX     00
PAGE_EVENT
        HEX     00

; Applesoft &GPT hook state. AMP_INSTALLED is intentionally not reset by START:
; once installed, a later CALL back into the main app must not save its own JMP
; as the predecessor vector.
AMP_INSTALLED
        HEX     00
AMP_ENTRY_P
        HEX     00
AMP_ENTRY_A
        HEX     00
AMP_ENTRY_X
        HEX     00
AMP_ENTRY_Y
        HEX     00
AMP_SAVE_ZP_LO
        HEX     00
AMP_SAVE_ZP_HI
        HEX     00
AMP_SAVE_FM_LO
        HEX     00
AMP_SAVE_FM_HI
        HEX     00
AMP_SCAN_INDEX
        HEX     00
AMP_TOKEN_INDEX
        HEX     00
AMP_TOKEN_BYTE
        HEX     00
; V5.94 resident response framing.  AMP_RX_MODE affects only RECEIVE_GPT16 while
; executing &GPT; AMP_PENDING_CR defers a possible terminal CR.
AMP_RX_MODE
        HEX     00
AMP_PENDING_CR
        HEX     00
AMP_OLD_VECTOR
        HEX     60EAEA                  ; overwritten with previous $03F5 JMP

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

; Prompt-buffer overlays. G16 owns this only during startup; KFS1 owns it only
; after submission while the line editor is idle.
AUX_LINE_BUF    EQU     INPUT_BUF
G16_FRAME_BUF   EQU     INPUT_BUF       ; startup-only, max G16_FRAME_MAX bytes
KRM_BUF         EQU     INPUT_BUF       ; KFS1 payload/name buffer, max 80 bytes

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

; Transient menu/name scratch only. 80-byte MENU_ROW_SAVE begins at +$022D
; and 30-byte NAME_INPUT follows at +$027D; $02A0 bytes covers both.
PAGE_SCRATCH_SIZE EQU    $02A0
PAGE_SCRATCH
        .RES    PAGE_SCRATCH_SIZE
MENU_ROW_SAVE   EQU     PAGE_SCRATCH+$022D
NAME_INPUT      EQU     PAGE_SCRATCH+$027D

; AUX DOS buffers are physically independent from the transient PAGE scratch.
; This keeps history scans isolated from menu/name scratch and the SAVE writer.
AUX_WORK
        .RES    $002D
AUX_TS
        .RES    $0100
AUX_DATA
        .RES    $0100

; Persistent DOS high-bit/padded names cannot share transient PAGE scratch.
SAVE_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000
AUX_NAME
        HEX     00000000000000000000000000000000
        HEX     0000000000000000000000000000

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
PROGRAM_END
        .ASSERT PROGRAM_END <= $9600, error, "GPT16 LOMEM image exceeds DOS 3.3 $9600 boundary"

; =============================================================================
; END
; =============================================================================
