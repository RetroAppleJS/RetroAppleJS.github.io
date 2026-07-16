;===============================================================================
; APPLE DOS 3.3 SEQUENTIAL TXT-FILE WRTR
;===============================================================================
;
; Entry:
;     JSR ENTRY
;
; Parameters:
;
; PAR_FNAME
;     Byte 0      = filename length
;     Bytes 1..n  = filename characters
;
; PAR_TXT_START
;     Address of the first text byte.
;
; PAR_TXT_LEN
;     Number of text bytes to write.
;
; Requirements:
;     - Source lines end with carriage return, $0D.
;     - The final source byte must also be $0D.
;     - DOS 3.3 must already be active.
;
; Return:
;     Carry clear, A = $00:
;         DOS commands and text output were issued.
;
;     Carry set:
;         A = $01    Invalid filename length
;         A = $02    Text length is zero
;         A = $03    Final text byte is not carriage return
;         A = $04    Source address plus length exceeds $FFFF
;
;===============================================================================

                ORG     $6000

COUT            EQU     $FDED

CTRL_D          EQU     $04
CR              EQU     $0D

ERR_FNAME       EQU     $01
ERR_LEN         EQU     $02
ERR_FIN_CR      EQU     $03
ERR_WRAP        EQU     $04


;===============================================================================
; ENTRY AND PARETER BLOCK
;===============================================================================

ENTRY           JMP     START


; Pascal-style filename:
; first byte is the length, followed by the filename characters.

PAR_FNAME .BYTE  FNAME_END-FNAME_TXT
FNAME_TXT .TXT   "SOURCE"
FNAME_END
; Address of the source text appended after the writer code.

PAR_TXT_START  .WORD   TXT_DATA


; Number of source-text bytes.

PAR_TXT_LEN.   .WORD   TXT_END-TXT_DATA


;===============================================================================
; MAIN ROUTINE
;===============================================================================

START

; Validate filename length.
; DOS 3.3 filenames may contain at most 30 characters.

                LDA     PAR_FNAME
                BEQ     ERR_FNAME

                CMP     #31
                BCS     ERR_FNAME

; Reject an empty text buffer.

                LDA     PAR_TXT_LEN
                ORA     PAR_TXT_LEN+1
                BEQ     ERR_LEN

; Calculate:
;
;     final byte address = text start + text length - 1
;
; First calculate the exclusive end address.

                LDA     PAR_TXT_START
                CLC
                ADC     PAR_TXT_LEN
                STA     LAST_FETCH+1

                LDA     PAR_TXT_START+1
                ADC     PAR_TXT_LEN+1
                BCS     ERR_WRAP
                STA     LAST_FETCH+2


; Convert exclusive end address to final-byte address.

                LDA     LAST_FETCH+1
                BNE     LAST_ADR_L_OK

                DEC     LAST_FETCH+2

LAST_ADR_L_OK   DEC     LAST_FETCH+1


; Verify that the source ends with a carriage return.
; Either low-bit $0D or high-bit $8D is accepted.

LAST_FETCH      LDA     $FFFF
                AND     #$7F
                CMP     #CR
                BNE     ERR_FIN_CR


; Send:
;
;     OPEN filename

                LDX     #<CMD_OPEN
                LDY     #>CMD_OPEN
                JSR     SND_DOS_CMD


; Send:
;
;     WRT filename

                LDX     #<CMD_WRT
                LDY     #>CMD_WRT
                JSR     SND_DOS_CMD


; Initialise the self-modifying source pointer.

                LDA     PAR_TXT_START
                STA     DATA_FETCH+1

                LDA     PAR_TXT_START+1
                STA     DATA_FETCH+2


; Initialise the 16-bit remaining-byte counter.

                LDA     PAR_TXT_LEN
                STA     BYTES_LEFT

                LDA     PAR_TXT_LEN+1
                STA     BYTES_LEFT+1


; Copy the text buffer through COUT.
;
; While DOS WRT is active, characters sent through COUT are written
; to the currently open text file.

WRT_LOOP        LDA     BYTES_LEFT
                ORA     BYTES_LEFT+1
                BEQ     WRT_FIN

DATA_FETCH      LDA     $FFFF
                JSR     PUT_CHAR


; Advance the source pointer.

                INC     DATA_FETCH+1
                BNE     DATA_PTR_OK

                INC     DATA_FETCH+2

; Decrement the remaining-byte counter.

DATA_PTR_OK     LDA     BYTES_LEFT
                BNE     DECREMENT_L

                DEC     BYTES_LEFT+1

DECREMENT_L     DEC     BYTES_LEFT
                JMP     WRT_LOOP


; The source buffer ends with CR, so DOS is already at the beginning
; of a new line. Do not send another CR before Control-D CLOSE,
; because that would add an extra blank line to the file.

WRT_FIN
                LDX     #<CMD_CLOSE
                LDY     #>CMD_CLOSE
                JSR     SND_DOS_CMD_AT_BOL

                LDA     #$00
                CLC
                RTS


;===============================================================================
; LOCAL VALIDATION ERRS
;===============================================================================

ERR_FNAME       LDA     #ERR_FNAME
                SEC
                RTS

ERR_LEN         LDA     #ERR_LEN
                SEC
                RTS

ERR_FIN_CR      LDA     #ERR_FIN_CR
                SEC
                RTS

ERR_WRAP        LDA     #ERR_WRAP
                SEC
                RTS


;===============================================================================
; SND_DOS_CMD
;===============================================================================
;
; Input:
;     X = low byte of command-string address
;     Y = high byte of command-string address
;
; Sends:
;     CR
;     Control-D
;     command text
;     filename
;     CR
;
;===============================================================================

SND_DOS_CMD     STX     CMD_FETCH+1
                STY     CMD_FETCH+2

                LDA     #CR
                JSR     PUT_CHAR

                JMP     SND_DOS_CMD_BODY


;===============================================================================
; SND_DOS_CMD_AT_BOL
;===============================================================================
;
; Sends a DOS command without a leading CR.
; This may only be used when output is already at the beginning of a line.
;
;===============================================================================

SND_DOS_CMD_AT_BOL
                STX     CMD_FETCH+1
                STY     CMD_FETCH+2


SND_DOS_CMD_BODY
                LDA     #CTRL_D
                JSR     PUT_CHAR


; Send the zero-terminated DOS command prefix.

                LDY     #$00

CMD_CHR

CMD_FETCH
                LDA     $FFFF,Y
                BEQ     CMD_PFIX_DONE

                JSR     PUT_CHAR

                INY
                BNE     CMD_CHR


CMD_PFIX_DONE

; Append the filename.

                LDX     #$00

FNAME_CHR
                CPX     PAR_FNAME
                BEQ     DOS_CMD_FIN

                LDA     FNAME_TXT,X
                JSR     PUT_CHAR

                INX
                BNE     FNAME_CHR


; Complete the DOS command with carriage return.

DOS_CMD_FIN
                LDA     #CR
                JSR     PUT_CHAR

                RTS


;===============================================================================
; PUT_CHAR
;===============================================================================
;
; Input:
;     A = ASCII or Apple high-bit ASCII character
;
; Sets bit 7 and sends the character through COUT.
;
; COUT must be used instead of COUT1 because DOS installs itself in the
; character-output vector used by COUT.
;
; X and Y are preserved.
;
;===============================================================================

PUT_CHAR        STA     SAV_CHR

                TXA
                PHA

                TYA
                PHA

                LDA     SAV_CHR
                ORA     #$80
                JSR     COUT

                PLA
                TAY

                PLA
                TAX

                RTS


;===============================================================================
; WORKING STORAGE
;===============================================================================

SAV_CHR         .BYTE   $00
BYTES_LEFT      .WORD   $0000

;===============================================================================
; DOS CMD STRINGS
;===============================================================================

CMD_OPEN        .TXT   "OPEN "
                .BYTE   $00

CMD_WRT         .TXT   "WRT "
                .BYTE   $00

CMD_CLOSE       .TXT   "CLOSE "
                .BYTE   $00


;===============================================================================
; APPENDED SOURCE-TXT BUFFER
;===============================================================================
;
; The browser-generated version will replace this sample with the current
; contents of the Source pane.
;
; Each line ends in $0D. The complete buffer also ends in $0D.
;
;===============================================================================

TXT_DATA        .TXT   "; SAMPLE APPLE II ASSEMBLY SOURCE"
                .BYTE   CR

                .TXT   "        ORG $8000"
                .BYTE   CR

                .TXT   "START   LDA #$C8"
                .BYTE   CR

                .TXT   "        JSR $FDED"
                .BYTE   CR

                .TXT   "        RTS"
                .BYTE   CR

TXT_END