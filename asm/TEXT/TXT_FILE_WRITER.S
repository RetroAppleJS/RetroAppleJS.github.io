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

EC_FNAM         EQU     $01
EC_LEN          EQU     $02
EC_FINCR        EQU     $03
EC_WRAP         EQU     $04


;===============================================================================
; ENTRY AND PARETER BLOCK
;===============================================================================

ENTRY           JMP     START


; Pascal-style filename:
; first byte is the length, followed by the filename characters.

PAR_FNAME .BYTE  FNAME_END-FNAME_TXT
FNAME_TXT ASC   "SOURCE"
FNAME_END
; Address of the source text appended after the writer code.

PAR_TXT_START  .WORD   TXT_DATA


; Number of source-text bytes.

PAR_TXT_LEN.   .WORD   TXT_END-TXT_DATA


;===============================================================================
; MAIN ROUTINE
;===============================================================================

START           LDA     PAR_FNAME.    ; Validate filename length.
                BNE     FN_OK1
                JMP     BAD_FNAM

FN_OK1          CMP     #31
                BCC     FN_OK2
                JMP     BAD_FNAM

FN_OK2          LDA     PAR_TXT_LEN.   ; Reject an empty text buffer.
                ORA     PAR_TXT_LEN+1
                BNE     LEN_OK
                JMP     BAD_LEN

LEN_OK          LDA     PAR_TXT_START      ; Final byte address = text start + text length - 1
                CLC
                ADC     PAR_TXT_LEN
                STA     LAST_FETCH+1

                LDA     PAR_TXT_START+1    
                ADC     PAR_TXT_LEN+1
                BCC     WRAP_OK           ; First calculate the exclusive end address.
                JMP     BAD_WRAP

WRAP_OK         STA     LAST_FETCH+2
                LDA     LAST_FETCH+1      ; Convert exclusive end address to final-byte address.
                BNE     LAST_ADR_L_OK
                DEC     LAST_FETCH+2
LAST_ADR_L_OK   DEC     LAST_FETCH+1

LAST_FETCH      LDA     $FFFF        ; Verify that the source ends with a carriage return.
                AND     #$7F
                CMP     #CR
                BEQ     FINCR_OK     ; Either low-bit $0D or high-bit $8D is accepted.
                JMP     BAD_FIN

FINCR_OK        LDX     #<CMD_OPEN   ;     OPEN filename
                LDY     #>CMD_OPEN
                JSR     SND_DOS_CMD

                LDX     #<CMD_WRT     ;     WRT filename
                LDY     #>CMD_WRT
                JSR     SND_DOS_CMD

                LDA     PAR_TXT_START   ; Initialise the self-modifying source pointer.
                STA     DATA_FETCH+1
                LDA     PAR_TXT_START+1
                STA     DATA_FETCH+2

                LDA     PAR_TXT_LEN     ; Initialise the 16-bit remaining-byte counter.
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
                INC     DATA_FETCH+1    ; Advance the source pointer.
                BNE     DATA_PTR_OK
                INC     DATA_FETCH+2

DATA_PTR_OK     LDA     BYTES_LEFT    ; Decrement the remaining-byte counter.
                BNE     DECREMENT_L
                DEC     BYTES_LEFT+1

DECREMENT_L     DEC     BYTES_LEFT
                JMP     WRT_LOOP

WRT_FIN         LDX     #<CMD_CLOSE          ; The source buffer ends with CR, so DOS is already at the beginning
                LDY     #>CMD_CLOSE          ; of a new line. Do not send another CR before Control-D CLOSE,
                JSR     SND_DOS_CMD_AT_BOL   ; because that would add an extra blank line to the file.
                LDA     #$00
                CLC
                RTS

;===============================================================================
; LOCAL VALIDATION ERRS
;===============================================================================

BAD_FNAM        LDA     #EC_FNAM
                SEC
                RTS
BAD_LEN         LDA     #EC_LEN
                SEC
                RTS
BAD_FIN         LDA     #EC_FINCR
                SEC
                RTS
BAD_WRAP        LDA     #EC_WRAP
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
                LDY     #$00      ; Send the zero-terminated DOS command prefix.

CMD_FETCH       LDA     $FFFF,Y
                BEQ     CMD_PFIX_DONE
                JSR     PUT_CHAR

                INY
                BNE     CMD_FETCH

CMD_PFIX_DONE   LDX     #$00     ; Append the filename.

FNAME_CHR       CPX     PAR_FNAME
                BEQ     DOS_CMD_FIN

                LDA     FNAME_TXT,X
                JSR     PUT_CHAR

                INX
                BNE     FNAME_CHR

DOS_CMD_FIN     LDA     #CR; Complete the DOS command with carriage return.
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

CMD_OPEN        ASC   "OPEN "
                .BYTE   $00

CMD_WRT         ASC   "WRT "
                .BYTE   $00

CMD_CLOSE       ASC   "CLOSE "
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

TXT_DATA        ASC   "       ; SAMPLE APPLE II ASSEMBLY SOURCE"
                .BYTE   CR

                ASC   "        ORG $8000"
                .BYTE   CR

                ASC   "START   LDA #$C8"
                .BYTE   CR

                ASC   "        JSR $FDED"
                .BYTE   CR

                ASC   "        RTS"
                .BYTE   CR

TXT_END