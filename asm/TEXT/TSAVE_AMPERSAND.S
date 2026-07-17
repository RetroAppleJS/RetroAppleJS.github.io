;===============================================================================
; &TSAVE - DOS 3.3 DIRECT-MODE TEXT SAVE COMMAND
; Block/range-write version
;===============================================================================
;
; Origin:
;
;       $0300
;
; Install:
;
;       CALL 768
;
; Use:
;
;       &TSAVE SOURCE,A$615D,L$70
;
; DOS performs the filename and A/L/S/D/V parsing before entering TSAVE.
;
; This compact version occupies $0300-$03CF.  DOS page-three vectors begin
; at $03D0.
;
; The command replaces the external VERIFY command with &TSAVE.
;
; Staging-buffer restrictions:
;
;   - $0200-$02FF is used as a temporary conversion buffer.
;   - $0300-$03CF contains this command.
;   - Do not use a source range overlapping either area.
;
; Input bytes may be 7-bit ASCII or Apple high-bit ASCII.  ORA #$80 converts
; 7-bit ASCII and leaves already converted bytes unchanged.
;
;===============================================================================

                ORG     $0300


;-------------------------------------------------------------------------------
; DOS 3.3 command tables
;-------------------------------------------------------------------------------

CMDNAME         EQU     $A902           ; VERIFY name: 6 bytes
CMDVEC          EQU     $9D54           ; VERIFY handler vector
CMDATTR         EQU     $A93F           ; VERIFY attributes


;-------------------------------------------------------------------------------
; DOS parsed-command values
;-------------------------------------------------------------------------------

CUMOPT          EQU     $AA65
LENPRSD         EQU     $AA6C
RECPRSD         EQU     $AA6E
ADRPRSD         EQU     $AA72

; TSAVE does not permit an R parameter, so the parsed R field can be reused as
; a private remaining-byte counter after parsing is complete.

BYLEFT          EQU     RECPRSD


;-------------------------------------------------------------------------------
; DOS input buffer and File Manager parameter fields
;-------------------------------------------------------------------------------

BUF200          EQU     $0200           ; staging buffer after parsing

OPCODE          EQU     $B5BB           ; File Manager opcode
SUBCODE         EQU     $B5BC           ; File Manager subcode
LEN2RW          EQU     $B5C1           ; range length / length-minus-one
CURIO           EQU     $B5C3           ; current range-buffer address


;-------------------------------------------------------------------------------
; DOS 3.3 entry points
;-------------------------------------------------------------------------------

OPNCKT          EQU     $A3D5           ; open file and check type
FMDRIVE         EQU     $A6A8           ; File Manager driver
CMDCLOS         EQU     $A2EA           ; CLOSE command handler
SYNTERR         EQU     $A6C4           ; DOS syntax error
RNGERR          EQU     $A0C9           ; DOS range error


;===============================================================================
; INSTALL
;===============================================================================
;
; The installer is deliberately compact so the complete extension fits below
; the DOS vector table at $03D0.
;
; It:
;
;   1. assigns BSAVE-compatible attributes to the command;
;   2. redirects VERIFY's command vector to TSAVE;
;   3. replaces the command name VERIFY with &TSAVE.
;
; Repeating CALL 768 is harmless.
;
;===============================================================================

INSTALL         LDA     #$21
                STA     CMDATTR

                LDA     #$79
                STA     CMDATTR+1

                LDA     #<TSVEC
                STA     CMDVEC

                LDA     #>TSVEC
                STA     CMDVEC+1

                LDX     #5

PNLOOP          LDA     NEWNAME,X
                STA     CMDNAME,X
                DEX
                BPL     PNLOOP

                RTS


NEWNAME         .BYTE   $26,$54,$53,$41,$56,$C5

; DOS stores command-handler addresses minus one.

TSVEC           EQU     TSAVE-1


;===============================================================================
; TSAVE
;===============================================================================

TSAVE           LDA     CUMOPT

; A and L are both mandatory.

                AND     #$09
                CMP     #$09
                BEQ     PARMOK

                JMP     SYNTERR


;-------------------------------------------------------------------------------
; Reject a source range whose exclusive end wraps beyond $FFFF.
;
; As in the previous version, a range ending exactly at $10000 is also rejected.
; DOS already restricts L to $0001-$7FFF.
;-------------------------------------------------------------------------------

PARMOK          LDA     ADRPRSD
                CLC
                ADC     LENPRSD

                LDA     ADRPRSD+1
                ADC     LENPRSD+1
                BCC     NOWRAP

                JMP     RNGERR


;-------------------------------------------------------------------------------
; Save the source address in the self-modifying LDA and preserve the parsed
; length in BYLEFT.
;-------------------------------------------------------------------------------

NOWRAP          LDA     ADRPRSD
                STA     GETBYTE+1

                LDA     ADRPRSD+1
                STA     GETBYTE+2

                LDA     LENPRSD
                STA     BYLEFT

                LDA     LENPRSD+1
                STA     BYLEFT+1


;-------------------------------------------------------------------------------
; Open a sequential text file.
;
; A nonzero LENPRSD would make DOS treat the text file as random-access, so
; clear the parsed length before calling the common OPEN handler.
;-------------------------------------------------------------------------------

                LDA     #0
                STA     LENPRSD
                STA     LENPRSD+1

                LDA     #0              ; DOS text-file type
                JSR     OPNCKT


;-------------------------------------------------------------------------------
; Prepare WRITE RANGE.
;
; OPCODE  $04 = WRITE
; SUBCODE $02 = WRITE RANGE
;
; For a write range DOS expects LEN2RW = number of bytes minus one.
;-------------------------------------------------------------------------------

                LDA     #4
                STA     OPCODE

                LDA     #2
                STA     SUBCODE


;===============================================================================
; CONVERT AND WRITE BLOCKS
;===============================================================================
;
; Each non-final block contains 254 converted source bytes.
;
; The final block contains:
;
;       1-254 converted source bytes
;       one terminating $00 byte
;
; Therefore every File Manager range is between 1 and 255 bytes.
;===============================================================================

CHUNK           LDX     #0


; Read and convert one source byte.

GETBYTE         LDA     $FFFF
                ORA     #$80
                STA     BUF200,X


; Advance the embedded source address.

                INC     GETBYTE+1
                BNE     PTRNEXT

                INC     GETBYTE+2


; Decrement the remaining-byte counter.

PTRNEXT         LDA     BYLEFT
                BNE     DECLOW

                DEC     BYLEFT+1

DECLOW          DEC     BYLEFT


; If no source bytes remain, append the DOS text terminator.

                LDA     BYLEFT
                ORA     BYLEFT+1
                BEQ     FINAL


; Otherwise continue until 254 data bytes have been staged.

                INX
                CPX     #$FE
                BNE     GETBYTE

                JMP     WRITE


; Append $00 after the final converted source byte.
;
; At entry X is the index of the final data byte.  After the two INX
; instructions, X equals the total number of bytes to write.

FINAL           INX
                LDA     #0
                STA     BUF200,X
                INX


;-------------------------------------------------------------------------------
; Write the staged range.
;
; X = total range length, from 1 through 255.
; DOS WRITE RANGE requires length minus one.
;-------------------------------------------------------------------------------

WRITE           TXA
                SEC
                SBC     #1
                STA     LEN2RW

                LDA     #0
                STA     LEN2RW+1

                LDA     #<BUF200
                STA     CURIO

                LDA     #>BUF200
                STA     CURIO+1

                JSR     FMDRIVE


; More source bytes remain: prepare another block.

                LDA     BYLEFT
                ORA     BYLEFT+1
                BNE     CHUNK


; BUF200 originally held the DOS command.  Restore its first byte to CR so
; DOS's normal AFTRCMD/FINSHCMD path sees a completed direct-mode command.

                LDA     #$8D
                STA     BUF200


; Tail-call CLOSE.  Its final RTS returns to DOS's normal command-completion
; path without adding another command-handler return address.

                JMP     CMDCLOS
