;===============================================================================
; TEXT SAVE THROUGH BSAVE ...,T
; DOS 3.3 / ProntoDOS compatible range writer
;===============================================================================
;
; Load at $0300 and install once after every DOS boot:
;
;       CALL 768
;
; Save a DOS text file:
;
;       BSAVE SOURCE,A$615D,L$70,T
;
; Ordinary BSAVE remains binary:
;
;       BSAVE OBJECT,A$6000,L$100
;
; The earlier &TSAVE version replaced the last DOS command entry.  Standard
; DOS uses that entry for VERIFY, while ProntoDOS uses it for TYPE.  This
; version does not alter the command-name or command-handler entry for either
; command.
;
; Instead it extends BSAVE:
;
;   - the global DOS option letter B is changed to T;
;   - T becomes a flag that requires no numeric value;
;   - BSAVE is allowed to accept this flag;
;   - the current BSAVE handler vector is saved and chained when T is absent;
;   - when T is present, the source is converted and written as DOS text.
;
; IMPORTANT:
;
;   1. The standard DOS B option is unavailable until the next DOS boot.
;   2. $0200-$02FF is used as a staging buffer after command parsing.
;   3. $0300-$03CF contains this resident extension.
;   4. Do not save a source range overlapping either area.
;
; CALL 768 is idempotent while this copy remains resident.
;
; Input bytes may be ordinary 7-bit ASCII or Apple high-bit ASCII.  ORA #$80
; converts 7-bit bytes and leaves already converted bytes unchanged.
;
; All labels are eight characters or fewer and do not end in a colon.
;
;===============================================================================

                ORG     $0300


;-------------------------------------------------------------------------------
; DOS command and option tables
;-------------------------------------------------------------------------------

BSVEC           EQU     $9D4E           ; current BSAVE handler minus one
BSATTR          EQU     $A939           ; BSAVE attribute word
OPTBCHR         EQU     $A946           ; global B option character
OPTBISS         EQU     $A950           ; global B option-issued value


;-------------------------------------------------------------------------------
; DOS parsed-command values
;-------------------------------------------------------------------------------

CUMOPT          EQU     $AA65
LENPRSD         EQU     $AA6C
RECPRSD         EQU     $AA6E
ADRPRSD         EQU     $AA72
MONPRSD         EQU     $AA74

; BSAVE does not accept R, so the parsed R field is free after parsing.

BYLEFT          EQU     RECPRSD


;-------------------------------------------------------------------------------
; DOS input buffer and File Manager fields
;-------------------------------------------------------------------------------

BUF200          EQU     $0200
OPCODE          EQU     $B5BB
SUBCODE         EQU     $B5BC
LEN2RW          EQU     $B5C1
CURIO           EQU     $B5C3


;-------------------------------------------------------------------------------
; DOS entry points
;-------------------------------------------------------------------------------

OPNCKT          EQU     $A3D5
FMDRIVE         EQU     $A6A8
CMDCLOS         EQU     $A2EA
SYNTERR         EQU     $A6C4


;===============================================================================
; INSTALL
;===============================================================================

INSTALL         LDA     OLDHI+1          ; already installed?
                BNE     PATCH

                LDA     BSVEC            ; preserve current BSAVE handler
                STA     OLDLO+1
                LDA     BSVEC+1
                STA     OLDHI+1

PATCH           LDA     #$D4             ; high-bit ASCII T
                STA     OPTBCHR

                LDA     #$81             ; no-value flag, MONPRSD bit 0
                STA     OPTBISS

                LDA     BSATTR+1         ; permit flag-style options
                ORA     #$80
                STA     BSATTR+1

                LDA     #<DSVEC
                STA     BSVEC
                LDA     #>DSVEC
                STA     BSVEC+1
                RTS

DSVEC           EQU     DISPATCH-1


;===============================================================================
; BSAVE DISPATCHER
;===============================================================================
;
; T is recorded in MONPRSD bit 0.  C, I and O use bits 6, 5 and 4, so they do
; not collide with the private T flag.
;===============================================================================

DISPATCH        LDA     MONPRSD
                AND     #$01
                BNE     TSAVE

; Stack-jump to the BSAVE handler that was active when INSTALL ran.  The saved
; bytes already contain handler-address-minus-one, exactly as required by RTS.

OLDHI           LDA     #$00
                PHA
OLDLO           LDA     #$00
                PHA
                RTS


;===============================================================================
; TEXT RANGE SAVE
;===============================================================================

TSAVE           LDA     CUMOPT            ; A and L are mandatory
                AND     #$09
                CMP     #$09
                BEQ     PARMOK
                JMP     SYNTERR


; Preserve the source address and byte count.
;
; The caller must ensure that A+L does not wrap beyond $FFFF.  Omitting a second
; range check keeps the complete resident extension below DOS's $03D0 vectors.

PARMOK          LDA     ADRPRSD
                STA     GETBYTE+1
                LDA     ADRPRSD+1
                STA     GETBYTE+2

                LDA     LENPRSD
                STA     BYLEFT
                LDA     LENPRSD+1
                STA     BYLEFT+1


; Open/create a sequential DOS text file.  Clearing LENPRSD prevents DOS from
; interpreting the source length as a random-access text record length.

                LDA     #$00
                STA     LENPRSD
                STA     LENPRSD+1
                JSR     OPNCKT


; Prepare File Manager WRITE RANGE.

                LDA     #$04
                STA     OPCODE
                LSR
                STA     SUBCODE


;===============================================================================
; BUILD AND WRITE BLOCKS
;===============================================================================
;
; Non-final blocks contain 254 converted source bytes.  The final block contains
; 1-254 converted bytes followed by one $00 DOS text terminator.
;===============================================================================

CHUNK           LDX     #$00

GETBYTE         LDA     $FFFF
                ORA     #$80
                STA     BUF200,X

                INC     GETBYTE+1
                BNE     PTRNEXT
                INC     GETBYTE+2

PTRNEXT         LDA     BYLEFT
                BNE     DECLOW
                DEC     BYLEFT+1
DECLOW          DEC     BYLEFT

                LDA     BYLEFT
                ORA     BYLEFT+1
                BEQ     FINAL

                INX
                CPX     #$FE
                BNE     GETBYTE
                JMP     WRITE


; Append the DOS text terminator.  X then becomes the total range length.

FINAL           INX
                LDA     #$00
                STA     BUF200,X
                INX


; File Manager WRITE RANGE expects LEN2RW = length minus one and CURIO = source.

WRITE           TXA
                SEC
                SBC     #$01
                STA     LEN2RW

                LDA     #$00
                STA     LEN2RW+1
                STA     CURIO
                LDA     #>BUF200
                STA     CURIO+1

                JSR     FMDRIVE

                LDA     BYLEFT
                ORA     BYLEFT+1
                BNE     CHUNK


; Restore the DOS input buffer and tail-call CLOSE.  CLOSE returns through DOS's
; normal command-completion stack.

                LDA     #$8D
                STA     BUF200
                JMP     CMDCLOS
