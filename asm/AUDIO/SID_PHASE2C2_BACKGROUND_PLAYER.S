; Phase 2C.2 — resident background PSID v1/v2 music on the Apple II 6502.
; The Phase 2B.2 native header interpreter remains authoritative. IRQ playback
; uses the Phase 2C.1 CPU-clock SID timer, NOT foreground polling.
; Native interactive start at CALL 7168. Raw PSID and 8-byte transfer record in RAM.
; The low stub can be overwritten by original C64 code; high runtime remains.
; DOS-safe: transient parser $1000, core $9000-$93FF, music ZP $9400,
; foreground ZP buffer $9500. $9400 is descriptor BEFORE INIT, then
; becomes the C64 music ZP shadow. Transfer record $9430 also becomes shadow.
; ProntoDOS $9600+ is never touched by our handler. Slot 4 is required.
; Original executable payload is copied, not relocated or translated.
; 6502 itself parses original PSID header, checks sizes, prompts for subtune.
; Host only transfers raw bytes and optional SIDF start/length record.
            ORG $1C00
PUBLIC      JMP $9000
PUB_STOP    JMP $9003
PUB_RESTART JMP $9006
PUB_STATUS  JMP $9009

            ORG $9000
START       JMP NATIVE_ENTRY
STOP        JMP BG_STOP
RESTART     JMP NATIVE_ENTRY
STATUS      JMP GET_STATUS

DESC        EQU $9400
RECORD      EQU $9430
SAVEZP      EQU $9500
SRCZ        EQU $F0
DSTZ        EQU $F2
LEFT        EQU $F4
PSTR        EQU $F6
READPTR     EQU $F8
KBD         EQU $C000
KBDSTRB     EQU $C010
SIDCTRL1    EQU $D404
SIDCTRL2    EQU $D40B
SIDCTRL3    EQU $D412
SIDVOL      EQU $D418

INSTALL
            PHP
            SEI
            LDA BG_ACTIVE
            BEQ INSTALL_FRESH
            ; Re-entering the bootstrap during active playback is unsafe.
            LDA #$04
            STA ERRORCD
            JMP INSTALL_REJECT
INSTALL_FRESH
            LDA #$00
            STA ERRORCD
            STA ACTIVE
            ; Descriptor magic "S2B1". Host builder already preflights file.
            LDA DESC
            CMP #$53
            BNE BAD_DESC
            LDA DESC+1
            CMP #$32
            BNE BAD_DESC
            LDA DESC+2
            CMP #$42
            BNE BAD_DESC
            LDA DESC+3
            CMP #$31
            BNE BAD_DESC
            LDA DESC+8
            ORA DESC+9
            BEQ BAD_DESC
            JSR FIND_SID
            BCC HAS_SID
            LDA #$02
            STA ERRORCD
            JMP BAD_START
BAD_DESC
            LDA #$01
            STA ERRORCD
            JMP BAD_START
HAS_SID
            ; Phase 2C.2 timer ABI currently supports SID in slot 4 only.
            CPX #$40
            BEQ SID_SLOT4_OK
            LDA #$02
            STA ERRORCD
            JMP BAD_START
SID_SLOT4_OK
            ; X = physical slot*16; change clock access operands once.
            TXA
            CLC
            ADC #$82
            STA CLOCKSEL+1
            CLC
            ADC #$01
            STA CLOCKDATA+1
            JSR CHECK_PAYLOAD
            BCC PAYLOAD_OK
            ; Incomplete or corrupted transfer: never copy executable code.
            LDA #$03
            STA ERRORCD
            JMP BAD_START
PAYLOAD_OK
            JSR COPY_EXEC
            ; C64 zero-page environment while native music runs.
            LDA #$00
            LDX #$00
CLEAR_C64_ZP
            STA $0000,X
            INX
            BNE CLEAR_C64_ZP
            LDA DESC+10
            STA INIT_CALL+1
            LDA DESC+11
            STA INIT_CALL+2
            LDA DESC+12
            STA IRQ_PLAY_CALL+1
            LDA DESC+13
            STA IRQ_PLAY_CALL+2
            LDA DESC+15
            BEQ PAL_MODE
            LDA #$86            ; 60 Hz: 17030 = $4286 ticks
            STA PERIODLO
            LDA #$42
            STA PERIODHI
            JMP INIT_SONG
PAL_MODE
            LDA #$D4            ; 50 Hz: 20436 = $4FD4 ticks
            STA PERIODLO
            LDA #$4F
            STA PERIODHI
INIT_SONG
            LDA DESC+14         ; zero-based subtune, original C64 INIT ABI
INIT_CALL
            JSR $FFFF
            ; Snapshot persistent music zero page into $9400 AFTER INIT.
            ; Descriptor and transfer record are no longer needed.
            LDX #$00
BG_SAVE_MUSIC_ZP
            LDA $0000,X
            STA MUSICZP,X
            INX
            BNE BG_SAVE_MUSIC_ZP
            JSR RESTORE_APPLE_ZP
            ; From here, the foreground zero page is live again.
            JSR BG_INSTALL
            LDA #$01
            STA ACTIVE
            ; Unmask IRQ after restoring the initial status frame. STOP
            ; restores the previous CPU interrupt-disable state.
            PLP
            CLI
            RTS

INSTALL_REJECT
            PLP
            RTS

BAD_START
            JSR RESTORE_APPLE_ZP
            LDX #$00
BAD_MSG_LOOP
            LDA ERROR_TEXT,X
            BEQ BAD_DONE
            ORA #$80
            JSR $FDED
            INX
            BNE BAD_MSG_LOOP
BAD_DONE
            PLP
            RTS
GET_STATUS
            LDA ERRORCD
            RTS

FIND_SID
            LDX #$10
FIND_NEXT
            LDA $C080,X
            CMP #$53
            BEQ FOUND_SID
            TXA
            CLC
            ADC #$10
            TAX
            CPX #$80
            BCC FIND_NEXT
            SEC
            RTS
FOUND_SID
            CLC
            RTS

SAVE_APPLE_ZP
            LDX #$00
SAVE_NEXT
            LDA $0000,X
            STA SAVEZP,X
            INX
            BNE SAVE_NEXT
            RTS
RESTORE_APPLE_ZP
            LDX #$00
RESTORE_NEXT
            LDA SAVEZP,X
            STA $0000,X
            INX
            BNE RESTORE_NEXT
            RTS
RESTORE_PUBLIC
            LDX #$00
RESTORE_PUBLIC_LOOP
            LDA PUBLIC_IMAGE,X
            STA $1C00,X
            INX
            CPX #$0C
            BNE RESTORE_PUBLIC_LOOP
            RTS
PUBLIC_IMAGE
            .BYTE $4C,$00,$90,$4C,$03,$90,$4C,$06,$90,$4C,$09,$90

; Compute a 16-bit additive checksum before installing executable code.
; The native front-end stores the expected checksum in descriptor bytes 16/17.
; It catches incomplete monitor transfers; it is not cryptographic.
CHECK_PAYLOAD
            LDA DESC+4
            STA SRCZ
            LDA DESC+5
            STA SRCZ+1
            LDA DESC+8
            STA LEFT
            LDA DESC+9
            STA LEFT+1
            LDA #$00
            STA SUMLO
            STA SUMHI
            LDY #$00
SUM_LOOP
            LDA (SRCZ),Y
            CLC
            ADC SUMLO
            STA SUMLO
            BCC SUM_NO_CARRY
            INC SUMHI
SUM_NO_CARRY
            INC SRCZ
            BNE SUM_SRC_OK
            INC SRCZ+1
SUM_SRC_OK
            JSR COUNT_DOWN
            BNE SUM_LOOP
            LDA SUMLO
            CMP DESC+16
            BNE BAD_PAYLOAD
            LDA SUMHI
            CMP DESC+17
            BNE BAD_PAYLOAD
            CLC
            RTS
BAD_PAYLOAD
            SEC
            RTS

; Copies executable payload from arbitrary staged address to the *original*
; absolute C64 load address. Use memmove direction so partial overlap is safe.
; Length is 1..28K; temporary ZP $F0-$F5 has already been backed up.
COPY_EXEC
            LDA DESC+4
            STA SRCZ
            LDA DESC+5
            STA SRCZ+1
            LDA DESC+6
            STA DSTZ
            LDA DESC+7
            STA DSTZ+1
            LDA DESC+8
            STA LEFT
            LDA DESC+9
            STA LEFT+1
            ; If dst > src, reverse copy is always safe, including overlap.
            LDA DSTZ+1
            CMP SRCZ+1
            BCC COPY_FWD
            BNE COPY_BACK
            LDA DSTZ
            CMP SRCZ
            BCC COPY_FWD
            BEQ COPY_DONE
COPY_BACK
            ; Advance both pointers to last byte (base+length-1).
            CLC
            LDA SRCZ
            ADC LEFT
            STA SRCZ
            LDA SRCZ+1
            ADC LEFT+1
            STA SRCZ+1
            CLC
            LDA DSTZ
            ADC LEFT
            STA DSTZ
            LDA DSTZ+1
            ADC LEFT+1
            STA DSTZ+1
            LDA SRCZ
            BNE BACK_SRC_DEC_LO
            DEC SRCZ+1
BACK_SRC_DEC_LO
            DEC SRCZ
            LDA DSTZ
            BNE BACK_DST_DEC_LO
            DEC DSTZ+1
BACK_DST_DEC_LO
            DEC DSTZ
            LDY #$00
BACK_LOOP
            LDA (SRCZ),Y
            STA (DSTZ),Y
            LDA SRCZ
            BNE BACK_SRC_NEXT
            DEC SRCZ+1
BACK_SRC_NEXT
            DEC SRCZ
            LDA DSTZ
            BNE BACK_DST_NEXT
            DEC DSTZ+1
BACK_DST_NEXT
            DEC DSTZ
            JSR COUNT_DOWN
            BNE BACK_LOOP
COPY_DONE
            RTS
COPY_FWD
            LDY #$00
FORWARD_LOOP
            LDA (SRCZ),Y
            STA (DSTZ),Y
            INC SRCZ
            BNE SRC_FORWARD_OK
            INC SRCZ+1
SRC_FORWARD_OK
            INC DSTZ
            BNE DST_FORWARD_OK
            INC DSTZ+1
DST_FORWARD_OK
            JSR COUNT_DOWN
            BNE FORWARD_LOOP
            RTS
COUNT_DOWN
            LDA LEFT
            BNE LEFT_LOW
            DEC LEFT+1
LEFT_LOW
            DEC LEFT
            LDA LEFT
            ORA LEFT+1
            RTS

READ_CLOCK
            LDA #$1E
            JSR SELECT_SID
            JSR READ_DATA
            STA NOWLO
            LDA #$1F
            JSR SELECT_SID
            JSR READ_DATA
            STA NOWHI
            RTS
SELECT_SID
CLOCKSEL
            STA $C0C2
            RTS
READ_DATA
CLOCKDATA
            LDA $C0C3
            RTS
ADVANCE_DEADLINE_INITIAL
            LDA NOWLO
            STA DEADLINELO
            LDA NOWHI
            STA DEADLINEHI
ADVANCE_DEADLINE
            CLC
            LDA DEADLINELO
            ADC PERIODLO
            STA DEADLINELO
            LDA DEADLINEHI
            ADC PERIODHI
            STA DEADLINEHI
            RTS
WAIT_DEADLINE
            JSR READ_CLOCK
            SEC
            LDA NOWLO
            SBC DEADLINELO
            LDA NOWHI
            SBC DEADLINEHI
            BMI WAIT_DEADLINE
            RTS

SILENCE
            LDA #$00
            STA SIDCTRL1
            STA SIDCTRL2
            STA SIDCTRL3
            STA SIDVOL
            RTS
ERROR_TEXT
            .BYTE $53,$49,$44,$20,$32,$42,$31,$20,$45,$52,$52,$4F,$52,$0D,$00
ERRORCD     .BYTE $00
ACTIVE      .BYTE $00
PERIODLO    .BYTE $00
PERIODHI    .BYTE $00
NOWLO       .BYTE $00
NOWHI       .BYTE $00
DEADLINELO  .BYTE $00
DEADLINEHI  .BYTE $00
SUMLO       .BYTE $00
SUMHI       .BYTE $00


; ------------------ Phase 2C.2 background IRQ engine ----------------------
; Descriptor ($9400) and host record ($9430) become MUSICZP after INIT.
; Interrupt contexts: $9400 C64 ZP, $9500 foreground ZP (scratch each IRQ).
; Monitor ROM saves interrupted A into $45 BEFORE soft IRQ vector dispatch.
; Therefore full transparency of foreground $45 cannot be promised.
IRQLOC       EQU $03FE
SID_INDEX    EQU $C0C2
SID_DATA     EQU $C0C3
TMR_LOW      EQU $C0C8
TMR_HIGH     EQU $C0C9
TMR_CTRL     EQU $C0CA
TMR_ACK      EQU $C0CB
MUSICZP      EQU $9400
IRQ_HANDLER_ADDR EQU $9300
            ORG $9300
IRQ_HANDLER
            TXA
            PHA
            TYA
            PHA
            ; Preserve SID register selector across status polling.
            LDA SID_INDEX
            STA IRQ_INDEX_SAVED
            LDA #$1D
            STA SID_INDEX
            LDA SID_DATA
            AND #$01
            BEQ IRQ_FOREIGN
            LDA #$01
            STA TMR_ACK
            LDA IRQ_INDEX_SAVED
            STA SID_INDEX
            LDA $45             ; original interrupted A, saved by Monitor
            STA IRQ_SAVED_A
            ; All 256 foreground ZP bytes saved before restoring music ZP.
            LDX #$00
IRQ_SWAP_IN
            LDA $0000,X
            STA SAVEZP,X
            LDA MUSICZP,X
            STA $0000,X
            INX
            BNE IRQ_SWAP_IN
IRQ_PLAY_CALL
            JSR $FFFF           ; original, unmodified C64 PSID PLAY routine
            ; Persist the music ZP and restore foreground ZP before RTI.
            LDX #$00
IRQ_SWAP_OUT
            LDA $0000,X
            STA MUSICZP,X
            LDA SAVEZP,X
            STA $0000,X
            INX
            BNE IRQ_SWAP_OUT
            INC BG_IRQ_LO
            BNE IRQ_RESTORE_CPU
            INC BG_IRQ_HI
IRQ_RESTORE_CPU
            PLA
            TAY
            PLA
            TAX
            LDA IRQ_SAVED_A
            RTI
IRQ_FOREIGN
            LDA IRQ_INDEX_SAVED
            STA SID_INDEX
            PLA
            TAY
            PLA
            TAX
            LDA $45
            JMP (BG_OLD_IRQ)

; Install/stop run in foreground before and after the music IRQ context.
BG_INSTALL
            LDA IRQLOC
            STA BG_OLD_IRQ
            LDA IRQLOC+1
            STA BG_OLD_IRQ+1
            ; INSTALL entered with PHP; SEI. Capture its saved I bit.
            TSX
            LDA $0103,X        ; saved P below JSR return address
            AND #$04
            STA BG_OLD_I
            LDA #$00
            STA BG_IRQ_LO
            STA BG_IRQ_HI
            STA TMR_CTRL
            LDA PERIODLO
            STA TMR_LOW
            LDA PERIODHI
            STA TMR_HIGH
            LDA #<IRQ_HANDLER
            STA IRQLOC
            LDA #>IRQ_HANDLER
            STA IRQLOC+1
            LDA #$01
            STA BG_ACTIVE
            STA TMR_CTRL
            RTS

BG_STOP
            PHP
            SEI
            LDA #$00
            STA TMR_CTRL
            LDA BG_ACTIVE
            BEQ BG_STOP_IDLE
            LDA IRQLOC
            CMP #<IRQ_HANDLER
            BNE BG_STOP_IDLE
            LDA IRQLOC+1
            CMP #>IRQ_HANDLER
            BNE BG_STOP_IDLE
            LDA BG_OLD_IRQ
            STA IRQLOC
            LDA BG_OLD_IRQ+1
            STA IRQLOC+1
            LDA #$00
            STA BG_ACTIVE
            STA ACTIVE
            JSR SILENCE
            JSR RESTORE_PUBLIC
            ; Preserve previous IRQ mask, as in the resident RTC example.
            LDA BG_OLD_I
            BEQ BG_STOP_CLI
            PLP
            SEI
            RTS
BG_STOP_CLI
            PLP
            CLI
            RTS
BG_STOP_IDLE
            PLP
            RTS

; Explicit fixed state block; verify assembled handler stays below it.
            ORG $93E0
BG_OLD_IRQ       .BYTE $00,$00
IRQ_INDEX_SAVED  .BYTE $00
IRQ_SAVED_A      .BYTE $00
BG_ACTIVE        .BYTE $00
BG_OLD_I         .BYTE $00
BG_IRQ_LO        .BYTE $00
BG_IRQ_HI        .BYTE $00

; ------------------ Phase 2B.2 transient native front end -------------
; This UI/parser lives at $1000, and is allowed to be overwritten by
; original C64 payload only AFTER it JMPs into high resident INSTALL.
; A second CALL after such a tune requires re-pasting the assembly image.
            ORG $1000
; The Apple II Monitor ROM handles text entry. All prompts run before
; CLEAR_C64_ZP; the full original Apple zero page has already been saved.
; This file is fully authoritative: the host never parses the PSID header.
NATIVE_ENTRY
            JSR SAVE_APPLE_ZP
            JSR NATIVE_SETUP
            BCC NATIVE_OK
            JSR RESTORE_APPLE_ZP
            RTS
NATIVE_OK   JMP INSTALL

NATIVE_SETUP
            LDA #<HELLO_TEXT
            LDX #>HELLO_TEXT
            JSR PRINT_AX
            ; Host record is optional: SIDF, start LE, complete file length LE.
            LDA #$00
            STA RECORD_OK
            LDA RECORD
            CMP #$53
            BNE ASK_START
            LDA RECORD+1
            CMP #$49
            BNE ASK_START
            LDA RECORD+2
            CMP #$44
            BNE ASK_START
            LDA RECORD+3
            CMP #$46
            BNE ASK_START
            LDA #$01
            STA RECORD_OK
ASK_START
            LDA #<START_TEXT
            LDX #>START_TEXT
            JSR PRINT_AX
            JSR READ_HEX
            BCC LONG_SKIP_1
            JMP INPUT_ERROR
LONG_SKIP_1
            LDA DIGITS
            BNE MANUAL_START
            LDA RECORD_OK
            BNE LONG_SKIP_2
            JMP INPUT_ERROR
LONG_SKIP_2
            LDA RECORD+4
            STA FILEBASE
            LDA RECORD+5
            STA FILEBASE+1
            JMP GET_FILE_LENGTH
MANUAL_START
            LDA VALUE16
            STA FILEBASE
            LDA VALUE16+1
            STA FILEBASE+1
GET_FILE_LENGTH
            LDA #$00
            STA RECORD_MATCH
            LDA RECORD_OK
            BEQ ASK_LENGTH
            LDA RECORD+4
            CMP FILEBASE
            BNE ASK_LENGTH
            LDA RECORD+5
            CMP FILEBASE+1
            BNE ASK_LENGTH
            LDA #$01
            STA RECORD_MATCH
            LDA RECORD+6
            STA FILELEN
            LDA RECORD+7
            STA FILELEN+1
            JMP CHECK_FILE
ASK_LENGTH
            LDA #<LENGTH_TEXT
            LDX #>LENGTH_TEXT
            JSR PRINT_AX
            JSR READ_HEX
            BCC LONG_SKIP_3
            JMP INPUT_ERROR
LONG_SKIP_3
            LDA DIGITS
            BNE LONG_SKIP_4
            JMP INPUT_ERROR
LONG_SKIP_4
            LDA VALUE16
            STA FILELEN
            LDA VALUE16+1
            STA FILELEN+1
CHECK_FILE
            ; Source range: $2000 <= start, end exclusive <= $9000.
            LDA FILEBASE+1
            CMP #$20
            BCS LONG_SKIP_5
            JMP INPUT_ERROR
LONG_SKIP_5
            CMP #$90
            BCC LONG_SKIP_6
            JMP INPUT_ERROR
LONG_SKIP_6
            LDA FILELEN+1
            BNE FILE_LENGTH_VALID
            LDA FILELEN
            CMP #$76
            BCS LONG_SKIP_7
            JMP INPUT_ERROR
LONG_SKIP_7
FILE_LENGTH_VALID
            CLC
            LDA FILEBASE
            ADC FILELEN
            STA FILEEND
            LDA FILEBASE+1
            ADC FILELEN+1
            STA FILEEND+1
            BCC LONG_SKIP_8
            JMP INPUT_ERROR
LONG_SKIP_8
            LDA FILEEND+1
            CMP #$90
            BCC FILE_RANGE_OK
            BEQ LONG_SKIP_9
            JMP INPUT_ERROR
LONG_SKIP_9
            LDA FILEEND
            BEQ LONG_SKIP_10
            JMP INPUT_ERROR
LONG_SKIP_10
FILE_RANGE_OK
            LDA FILEBASE
            STA SRCZ
            LDA FILEBASE+1
            STA SRCZ+1
            LDY #$00
            LDA (SRCZ),Y
            CMP #$50            ; P
            BEQ LONG_SKIP_11
            JMP INPUT_ERROR
LONG_SKIP_11
            INY
            LDA (SRCZ),Y
            CMP #$53            ; S
            BEQ LONG_SKIP_12
            JMP INPUT_ERROR
LONG_SKIP_12
            INY
            LDA (SRCZ),Y
            CMP #$49            ; I
            BEQ LONG_SKIP_13
            JMP INPUT_ERROR
LONG_SKIP_13
            INY
            LDA (SRCZ),Y
            CMP #$44            ; D
            BEQ LONG_SKIP_14 ; version, 16-bit big-endian at +4
            JMP INPUT_ERROR
LONG_SKIP_14
            LDY #$04
            LDA (SRCZ),Y
            BEQ LONG_SKIP_15
            JMP INPUT_ERROR
LONG_SKIP_15
            INY
            LDA (SRCZ),Y
            CMP #$01
            BEQ VERSION_OK
            CMP #$02
            BEQ LONG_SKIP_16
            JMP INPUT_ERROR
LONG_SKIP_16
VERSION_OK
            STA VERSION
            ; header data offset, 16-bit big-endian
            LDY #$06
            LDA (SRCZ),Y
            STA OFFSET+1
            INY
            LDA (SRCZ),Y
            STA OFFSET
            LDA OFFSET+1
            BNE MIN_HEADER_OK
            LDA OFFSET
            LDX VERSION
            CPX #$02
            BNE TEST_V1_HEADER
            CMP #$7C
            BCS LONG_SKIP_17
            JMP INPUT_ERROR
LONG_SKIP_17
            JMP MIN_HEADER_OK
TEST_V1_HEADER
            CMP #$76
            BCS LONG_SKIP_18
            JMP INPUT_ERROR
LONG_SKIP_18
MIN_HEADER_OK
            ; offset < file length, so payload can start inside the file
            LDA OFFSET+1
            CMP FILELEN+1
            BCC HEADER_END_OK
            BEQ LONG_SKIP_19
            JMP INPUT_ERROR
LONG_SKIP_19
            LDA OFFSET
            CMP FILELEN
            BCC LONG_SKIP_20
            JMP INPUT_ERROR
LONG_SKIP_20
HEADER_END_OK
            ; flags, clock and multiple SIDs (v2 only)
            LDA #$00
            STA FRAME60
            LDA VERSION
            CMP #$02
            BNE READ_SONGS
            LDY #$77
            LDA (SRCZ),Y
            TAX
            AND #$03
            BEQ LONG_SKIP_21 ; MUS or PlaySID-specific samples
            JMP INPUT_ERROR
LONG_SKIP_21
            TXA
            AND #$0C
            CMP #$08
            BNE TEST_MULTISID
            LDA #$01
            STA FRAME60
TEST_MULTISID
            LDY #$7A
            LDA (SRCZ),Y
            BEQ LONG_SKIP_22
            JMP INPUT_ERROR
LONG_SKIP_22
            INY
            LDA (SRCZ),Y
            BEQ LONG_SKIP_23
            JMP INPUT_ERROR
LONG_SKIP_23
READ_SONGS
            ; song count and default subtune are big-endian
            LDY #$0E
            LDA (SRCZ),Y
            STA SONGS+1
            INY
            LDA (SRCZ),Y
            STA SONGS
            INY
            LDA (SRCZ),Y
            STA DEFAULT_SONG+1
            INY
            LDA (SRCZ),Y
            STA DEFAULT_SONG
            ; accepted count 1..256, default within that count
            LDA SONGS+1
            CMP #$02
            BCC LONG_SKIP_24
            JMP INPUT_ERROR
LONG_SKIP_24
            BNE LONG_SKIP_25
            JMP INPUT_ERROR
LONG_SKIP_25
            CMP #$01
            BNE TEST_COUNT_LOW
            LDA SONGS
            BEQ LONG_SKIP_26
            JMP INPUT_ERROR
LONG_SKIP_26
TEST_COUNT_LOW
            LDA SONGS
            ORA SONGS+1
            BNE LONG_SKIP_27
            JMP INPUT_ERROR
LONG_SKIP_27
            LDA DEFAULT_SONG
            ORA DEFAULT_SONG+1
            BNE LONG_SKIP_28
            JMP INPUT_ERROR
LONG_SKIP_28
            LDA DEFAULT_SONG+1
            CMP SONGS+1
            BCC DEFAULT_OK
            BEQ LONG_SKIP_29
            JMP INPUT_ERROR
LONG_SKIP_29
            LDA DEFAULT_SONG
            CMP SONGS
            BCC DEFAULT_OK
            BEQ LONG_SKIP_30
            JMP INPUT_ERROR
LONG_SKIP_30
DEFAULT_OK
            LDA #<VERSION_TEXT
            LDX #>VERSION_TEXT
            JSR PRINT_AX
            LDA VERSION
            ORA #$B0
            JSR $FDED
            JSR NEWLINE
            LDA #<TITLE_TEXT
            LDX #>TITLE_TEXT
            JSR PRINT_AX
            LDY #$16
            LDX #$20
TITLE_LOOP
            LDA (SRCZ),Y
            BEQ TITLE_DONE
            ORA #$80
            JSR $FDED
            INY
            DEX
            BNE TITLE_LOOP
TITLE_DONE
            JSR NEWLINE
            LDA #<SONGS_TEXT
            LDX #>SONGS_TEXT
            JSR PRINT_AX
            LDA SONGS
            STA VALUE16
            LDA SONGS+1
            STA VALUE16+1
            JSR PRINT_DECIMAL
            JSR NEWLINE
            LDA #<DEFAULT_TEXT
            LDX #>DEFAULT_TEXT
            JSR PRINT_AX
            LDA DEFAULT_SONG
            STA VALUE16
            LDA DEFAULT_SONG+1
            STA VALUE16+1
            JSR PRINT_DECIMAL
            JSR NEWLINE
            LDA #<SELECT_TEXT
            LDX #>SELECT_TEXT
            JSR PRINT_AX
            JSR READ_DECIMAL
            BCC LONG_SKIP_31
            JMP INPUT_ERROR
LONG_SKIP_31
            LDA DIGITS
            BNE SELECTED_MANUALLY
            LDA DEFAULT_SONG
            STA SELECTED
            LDA DEFAULT_SONG+1
            STA SELECTED+1
            JMP CHECK_SELECTION
SELECTED_MANUALLY
            LDA VALUE16
            STA SELECTED
            LDA VALUE16+1
            STA SELECTED+1
CHECK_SELECTION
            LDA SELECTED
            ORA SELECTED+1
            BNE LONG_SKIP_32
            JMP INPUT_ERROR
LONG_SKIP_32
            LDA SELECTED+1
            CMP SONGS+1
            BCC SONG_RANGE_OK
            BEQ LONG_SKIP_33
            JMP INPUT_ERROR
LONG_SKIP_33
            LDA SELECTED
            CMP SONGS
            BCC SONG_RANGE_OK
            BEQ LONG_SKIP_34
            JMP INPUT_ERROR
LONG_SKIP_34
SONG_RANGE_OK
            ; PSID speed bitmap, v1 wraps every 32 tunes, v2 extends bit31.
            LDA SELECTED
            SEC
            SBC #$01
            STA INDEX
            LDA VERSION
            CMP #$01
            BEQ MAP_SPEED
            LDA SELECTED+1
            BNE CLAMP_SPEED
            LDA INDEX
            CMP #$20
            BCC MAP_SPEED
CLAMP_SPEED
            LDA #$1F
            STA INDEX
MAP_SPEED
            LDA INDEX
            AND #$1F
            STA INDEX
            LSR
            LSR
            LSR
            STA BYTEINDEX
            LDA #$15
            SEC
            SBC BYTEINDEX
            TAY
            LDA (SRCZ),Y
            STA SPEEDBYTE
            LDA INDEX
            AND #$07
            TAX
            LDA #$01
SPEED_SHIFT
            CPX #$00
            BEQ SPEED_MASK
            ASL
            DEX
            JMP SPEED_SHIFT
SPEED_MASK
            AND SPEEDBYTE
            BEQ LONG_SKIP_35 ; Copy original header metadata into native descriptor.
            JMP CIA_ERROR
LONG_SKIP_35
            LDA #$53
            STA DESC
            LDA #$32
            STA DESC+1
            LDA #$42
            STA DESC+2
            LDA #$31
            STA DESC+3
            LDA FRAME60
            STA DESC+15
            LDA SELECTED
            SEC
            SBC #$01
            STA DESC+14
            ; source = staged base + original header payload offset
            CLC
            LDA FILEBASE
            ADC OFFSET
            STA DESC+4
            LDA FILEBASE+1
            ADC OFFSET+1
            STA DESC+5
            ; PSID original executable load address, big-endian
            LDY #$08
            LDA (SRCZ),Y
            STA DESC+7
            INY
            LDA (SRCZ),Y
            STA DESC+6
            LDA DESC+6
            ORA DESC+7
            BNE HAVE_LOAD
            ; Original load address stored as 2-byte LE PRG prefix.
            LDA #$02
            CLC
            ADC OFFSET
            STA OFFSET
            BCC OFFSET_BUMP_DONE
            INC OFFSET+1
OFFSET_BUMP_DONE
            LDY #$00
            LDA DESC+4
            STA DSTZ
            LDA DESC+5
            STA DSTZ+1
            LDA (DSTZ),Y
            STA DESC+6
            INY
            LDA (DSTZ),Y
            STA DESC+7
            CLC
            LDA DESC+4
            ADC #$02
            STA DESC+4
            BCC HAVE_LOAD
            INC DESC+5
HAVE_LOAD
            ; executable length = full file length - data offset
            SEC
            LDA FILELEN
            SBC OFFSET
            STA DESC+8
            LDA FILELEN+1
            SBC OFFSET+1
            STA DESC+9
            BCS LONG_SKIP_36
            JMP INPUT_ERROR
LONG_SKIP_36
            LDA DESC+8
            ORA DESC+9
            BNE LONG_SKIP_37 ; destination must be >= $0C00, end <= $C000
            JMP INPUT_ERROR
LONG_SKIP_37
            LDA DESC+7
            CMP #$0C
            BCS LONG_SKIP_38
            JMP INPUT_ERROR
LONG_SKIP_38
            CLC
            LDA DESC+6
            ADC DESC+8
            STA EXECEND
            LDA DESC+7
            ADC DESC+9
            STA EXECEND+1
            BCC LONG_SKIP_39
            JMP INPUT_ERROR
LONG_SKIP_39
            LDA EXECEND+1
            CMP #$C0
            BCC EXEC_RANGE_OK
            BEQ LONG_SKIP_40
            JMP INPUT_ERROR
LONG_SKIP_40
            LDA EXECEND
            BEQ LONG_SKIP_41
            JMP INPUT_ERROR
LONG_SKIP_41
EXEC_RANGE_OK
            ; DOS-safe mode: reject any target intersecting RAM $9000 or above.
; The range $9000-$95FF houses our engine; ProntoDOS starts at $9600.
            LDA EXECEND+1
            CMP #$90
            BCC READ_ENTRIES
            BEQ DOS_TOP_EQUAL
            JMP INPUT_ERROR
DOS_TOP_EQUAL
            LDA EXECEND
            BEQ READ_ENTRIES
            JMP INPUT_ERROR
READ_ENTRIES
            LDY #$0A
            LDA (SRCZ),Y
            STA DESC+11
            INY
            LDA (SRCZ),Y
            STA DESC+10
            LDA DESC+10
            ORA DESC+11
            BNE INIT_NONZERO
            LDA DESC+6
            STA DESC+10
            LDA DESC+7
            STA DESC+11
INIT_NONZERO
            INY
            LDA (SRCZ),Y
            STA DESC+13
            INY
            LDA (SRCZ),Y
            STA DESC+12
            LDA DESC+12
            ORA DESC+13
            BNE LONG_SKIP_43
            JMP INPUT_ERROR
LONG_SKIP_43
            LDA DESC+10
            STA VALUE16
            LDA DESC+11
            STA VALUE16+1
            JSR CHECK_ENTRY
            BCC LONG_SKIP_44
            JMP INPUT_ERROR
LONG_SKIP_44
            LDA DESC+12
            STA VALUE16
            LDA DESC+13
            STA VALUE16+1
            JSR CHECK_ENTRY
            BCC LONG_SKIP_45 ; Descriptor checksum is computed by native 6502, not the host.
            JMP INPUT_ERROR
LONG_SKIP_45
            JSR CALC_PAYLOAD_SUM
            LDA SUMLO
            STA DESC+16
            LDA SUMHI
            STA DESC+17
            LDA #<READY_TEXT
            LDX #>READY_TEXT
            JSR PRINT_AX
            CLC
            RTS
CIA_ERROR
            LDA #<CIA_TEXT
            LDX #>CIA_TEXT
            JSR PRINT_AX
            SEC
            RTS
INPUT_ERROR
            LDA #<INVALID_TEXT
            LDX #>INVALID_TEXT
            JSR PRINT_AX
            SEC
            RTS

; Carry set if VALUE16 falls outside [original LOAD, executable END).
CHECK_ENTRY
            LDA VALUE16+1
            CMP DESC+7
            BCC ENTRY_BAD
            BNE CHECK_ENTRY_END
            LDA VALUE16
            CMP DESC+6
            BCC ENTRY_BAD
CHECK_ENTRY_END
            LDA VALUE16+1
            CMP EXECEND+1
            BCC ENTRY_GOOD
            BNE ENTRY_BAD
            LDA VALUE16
            CMP EXECEND
            BCS ENTRY_BAD
ENTRY_GOOD  CLC
            RTS
ENTRY_BAD   SEC
            RTS

; Monitor-compatible input, ASCII -> hex $0000-$FFFF. Empty accepted.
READ_HEX
            JSR $FD6A
            LDA #$00
            STA VALUE16
            STA VALUE16+1
            STA DIGITS
            LDY #$00
HEX_LOOP
            LDA $0200,Y
            AND #$7F
            CMP #$0D
            BEQ HEX_DONE
            CMP #$24             ; optional '
            BEQ HEX_SKIP
            CMP #$20
            BEQ HEX_SKIP
            JSR HEX_NIBBLE
            BCC HEX_BAD
            STA NIBBLE
            LDA DIGITS
            CMP #$04
            BCS HEX_BAD
            LDX #$04
HEX_SHIFT
            ASL VALUE16
            ROL VALUE16+1
            DEX
            BNE HEX_SHIFT
            LDA VALUE16
            ORA NIBBLE
            STA VALUE16
            INC DIGITS
HEX_SKIP
            INY
            CPY #$20
            BCC HEX_LOOP
HEX_BAD     SEC
            RTS
HEX_DONE    CLC
            RTS
HEX_NIBBLE
            CMP #$30
            BCC NIBBLE_BAD
            CMP #$3A
            BCC DIGIT_NIBBLE
            CMP #$41
            BCC NIBBLE_BAD
            CMP #$47
            BCS NIBBLE_BAD
            SEC
            SBC #$37
            SEC
            RTS
DIGIT_NIBBLE
            SEC
            SBC #$30
            SEC
            RTS
NIBBLE_BAD  CLC
            RTS

; Decimal subtune input. Only digits; max 3 (256 is the largest).
READ_DECIMAL
            JSR $FD6A
            LDA #$00
            STA VALUE16
            STA VALUE16+1
            STA DIGITS
            LDY #$00
DEC_LOOP
            LDA $0200,Y
            AND #$7F
            CMP #$0D
            BEQ DEC_DONE
            CMP #$30
            BCC DEC_BAD
            CMP #$3A
            BCS DEC_BAD
            SEC
            SBC #$30
            STA NIBBLE
            LDA DIGITS
            CMP #$03
            BCS DEC_BAD
            ; Multiply VALUE16 by 10 = 2x + 8x.
            ASL VALUE16
            ROL VALUE16+1
            LDA VALUE16
            STA TMP16
            LDA VALUE16+1
            STA TMP16+1
            LDX #$02
DEC_X4
            ASL VALUE16
            ROL VALUE16+1
            DEX
            BNE DEC_X4
            CLC
            LDA VALUE16
            ADC TMP16
            STA VALUE16
            LDA VALUE16+1
            ADC TMP16+1
            STA VALUE16+1
            CLC
            LDA VALUE16
            ADC NIBBLE
            STA VALUE16
            LDA VALUE16+1
            ADC #$00
            STA VALUE16+1
            INC DIGITS
            INY
            JMP DEC_LOOP
DEC_BAD     SEC
            RTS
DEC_DONE    CLC
            RTS

; Display unsigned decimal 0..256 from VALUE16.
PRINT_DECIMAL
            LDA VALUE16
            STA TMP16
            LDA VALUE16+1
            STA TMP16+1
            LDA #$00
            STA HUNDREDS
            STA TENS
DEC_HUND_LOOP
            LDA TMP16+1
            BNE SUB_HUNDRED
            LDA TMP16
            CMP #$64
            BCC DEC_TEN_LOOP
SUB_HUNDRED
            SEC
            LDA TMP16
            SBC #$64
            STA TMP16
            LDA TMP16+1
            SBC #$00
            STA TMP16+1
            INC HUNDREDS
            JMP DEC_HUND_LOOP
DEC_TEN_LOOP
            LDA TMP16
            CMP #$0A
            BCC DEC_OUTPUT
            SEC
            SBC #$0A
            STA TMP16
            INC TENS
            JMP DEC_TEN_LOOP
DEC_OUTPUT
            LDA HUNDREDS
            BEQ NO_HUNDREDS
            ORA #$B0
            JSR $FDED
NO_HUNDREDS
            LDA HUNDREDS
            BNE SHOW_TENS
            LDA TENS
            BEQ SHOW_UNITS
SHOW_TENS
            LDA TENS
            ORA #$B0
            JSR $FDED
SHOW_UNITS
            LDA TMP16
            ORA #$B0
            JSR $FDED
            RTS

PRINT_AX
            STA PSTR
            STX PSTR+1
            LDY #$00
PRINT_LOOP
            LDA (PSTR),Y
            BEQ PRINT_DONE
            ORA #$80
            JSR $FDED
            INY
            BNE PRINT_LOOP
PRINT_DONE  RTS
NEWLINE
            JMP $FD8E

; Calculate 16-bit additive checksum over exact executable payload.
; Native INSTALL rechecks it immediately before the original copy.
CALC_PAYLOAD_SUM
            LDA DESC+4
            STA SRCZ
            LDA DESC+5
            STA SRCZ+1
            LDA DESC+8
            STA LEFT
            LDA DESC+9
            STA LEFT+1
            LDA #$00
            STA SUMLO
            STA SUMHI
            LDY #$00
CALC_LOOP
            LDA (SRCZ),Y
            CLC
            ADC SUMLO
            STA SUMLO
            BCC CALC_NO_CARRY
            INC SUMHI
CALC_NO_CARRY
            INC SRCZ
            BNE CALC_NEXT
            INC SRCZ+1
CALC_NEXT
            JSR COUNT_DOWN
            BNE CALC_LOOP
            RTS

; State is outside all relocated original music RAM.
FILEBASE    .BYTE $00,$00
FILELEN     .BYTE $00,$00
FILEEND     .BYTE $00,$00
OFFSET      .BYTE $00,$00
EXECEND     .BYTE $00,$00
SONGS       .BYTE $00,$00
DEFAULT_SONG .BYTE $00,$00
SELECTED    .BYTE $00,$00
VALUE16     .BYTE $00,$00
TMP16       .BYTE $00,$00
VERSION     .BYTE $00
FRAME60     .BYTE $00
RECORD_OK   .BYTE $00
RECORD_MATCH .BYTE $00
INDEX       .BYTE $00
BYTEINDEX   .BYTE $00
SPEEDBYTE   .BYTE $00
DIGITS      .BYTE $00
NIBBLE      .BYTE $00
HUNDREDS    .BYTE $00
TENS        .BYTE $00

HELLO_TEXT .BYTE $53,$49,$44,$20,$50,$4C,$41,$59,$45,$52,$20,$32,$42,$2E,$32,$20,$2D,$20,$4E,$41,$54,$49,$56,$45,$20,$50,$53,$49,$44,$20,$56,$31,$2F,$56,$32,$0D,$00
START_TEXT .BYTE $50,$53,$49,$44,$20,$53,$54,$41,$52,$54,$20,$28,$24,$48,$45,$58,$2C,$20,$45,$4E,$54,$45,$52,$3D,$54,$52,$41,$4E,$53,$46,$45,$52,$29,$3A,$20,$00
LENGTH_TEXT .BYTE $50,$53,$49,$44,$20,$46,$49,$4C,$45,$20,$4C,$45,$4E,$47,$54,$48,$20,$28,$24,$48,$45,$58,$29,$3A,$20,$00
VERSION_TEXT .BYTE $50,$53,$49,$44,$20,$56,$00
TITLE_TEXT .BYTE $54,$49,$54,$4C,$45,$3A,$20,$00
SONGS_TEXT .BYTE $53,$55,$42,$54,$55,$4E,$45,$53,$20,$41,$56,$41,$49,$4C,$41,$42,$4C,$45,$3A,$20,$00
DEFAULT_TEXT .BYTE $44,$45,$46,$41,$55,$4C,$54,$20,$53,$55,$42,$54,$55,$4E,$45,$3A,$20,$00
SELECT_TEXT .BYTE $53,$55,$42,$54,$55,$4E,$45,$20,$28,$44,$45,$43,$49,$4D,$41,$4C,$2C,$20,$45,$4E,$54,$45,$52,$3D,$44,$45,$46,$41,$55,$4C,$54,$29,$3A,$20,$00
READY_TEXT .BYTE $0D,$50,$4C,$41,$59,$49,$4E,$47,$20,$2D,$20,$50,$52,$45,$53,$53,$20,$41,$4E,$59,$20,$4B,$45,$59,$20,$54,$4F,$20,$53,$54,$4F,$50,$0D,$00
CIA_TEXT .BYTE $0D,$43,$49,$41,$20,$54,$49,$4D,$49,$4E,$47,$20,$49,$53,$20,$4E,$4F,$54,$20,$53,$55,$50,$50,$4F,$52,$54,$45,$44,$0D,$00
INVALID_TEXT .BYTE $0D,$49,$4E,$56,$41,$4C,$49,$44,$20,$4F,$52,$20,$55,$4E,$53,$55,$50,$50,$4F,$52,$54,$45,$44,$20,$50,$53,$49,$44,$20,$2F,$20,$4D,$45,$4D,$4F,$52,$59,$20,$52,$41,$4E,$47,$45,$0D,$00
            .END
