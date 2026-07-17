;===============================================================================
; &TSAVE - DOS 3.3 DIRECT-MODE TEXT SAVE COMMAND
;===============================================================================
;
; Installation address:
;
;       $0300
;
; Install from Applesoft:
;
;       CALL 768
;
; Then use directly from the prompt:
;
;       &TSAVE SOURCE.S,A$615D,L$70
;
; Decimal values are also accepted:
;
;       &TSAVE SOURCE.S,A24925,L112
;
; Optional DOS parameters are inherited from BSAVE:
;
;       &TSAVE SOURCE.S,A$615D,L$70,D2
;       &TSAVE SOURCE.S,A$615D,L$70,S6,D1,V254
;
; Operation
; ---------
; DOS performs all command parsing before entering TSAVE:
;
;       filename  -> PRIMFNBF
;       A value   -> ADRPRSD
;       L value   -> LENPRSD
;       S value   -> SLOTPRSD
;       D value   -> DRVPRSD
;       V value   -> VOLPRSD
;
; TSAVE then:
;
;   1. verifies that A and L were supplied;
;   2. rejects an address range that wraps beyond $FFFF;
;   3. opens a DOS text file;
;   4. reads exactly L bytes beginning at A;
;   5. sets bit 7 on every character;
;   6. appends a $00 DOS text end marker;
;   7. closes and verifies the file.
;
; Input character format
; ----------------------
; The memory buffer may contain either:
;
;       7-bit ASCII:             "A" = $41, CR = $0D
;       Apple high-bit ASCII:    "A" = $C1, CR = $8D
;
; ORA #$80 converts low-bit ASCII and leaves high-bit ASCII unchanged.
;
; Limitations inherited from DOS 3.3
; ----------------------------------
;   - L must be from 1 through $7FFF.
;   - A may be from $0000 through $FFFF.
;   - A + L must not wrap beyond $FFFF.
;   - The external VERIFY command is replaced by &TSAVE.
;   - DOS's internal verify routine remains available and is used by TSAVE.
;
; Memory limitation
; -----------------
; Do not save a range overlapping $0300-$03CE. TSAVE modifies its embedded
; source pointer and byte counter while running.
;
; Compatibility
; -------------
; This code uses the standard DOS 3.3 memory layout and entry points.
; The installer accepts either the original VERIFY name or an already
; installed &TSAVE name.
;
; Assembler restrictions
; ----------------------
;   - No labels end in a colon.
;   - All labels are eight characters or fewer.
;
;===============================================================================

                ORG     $0300


;===============================================================================
; DOS 3.3 COMMAND TABLE LOCATIONS
;===============================================================================

; VERIFY occupies six bytes at the end of the DOS command-name table.
; It is replaced in place by the six-character command name "&TSAVE".

CMDNAME         EQU     $A902

; Final command-handler vector in CMDTBL.
; DOS stores handler-address-minus-one because handlers are entered using RTS.

CMDVEC          EQU     $9D54

; Two command-attribute bytes belonging to VERIFY.

CMDATTR         EQU     $A93F


;===============================================================================
; DOS 3.3 PARSED COMMAND VALUES
;===============================================================================

CUMOPT          EQU     $AA65           ; Bits representing parsed options

LENPRSD         EQU     $AA6C           ; Parsed L value, little endian
ADRPRSD         EQU     $AA72           ; Parsed A value, little endian


;===============================================================================
; DOS FILE MANAGER PARAMETER FIELDS
;===============================================================================

OPCODE          EQU     $B5BB           ; File Manager operation
SUBCODE         EQU     $B5BC           ; File Manager sub-operation
ONEBYTE         EQU     $B5C3           ; One-byte input/output field


;===============================================================================
; DOS 3.3 INTERNAL ENTRY POINTS
;===============================================================================

OPNCKT          EQU     $A3D5           ; Open file and check requested type
FMDRIVE         EQU     $A6A8           ; Call the DOS File Manager
CMDCLOS         EQU     $A2EA           ; DOS CLOSE command handler
CMDVRFY         EQU     $A27D           ; Internal VERIFY handler
SYNTERR         EQU     $A6C4           ; DOS syntax-error handler
RNGERR          EQU     $A0C9           ; DOS range-error handler


;===============================================================================
; INSTALL
;===============================================================================
;
; Entry:
;
;       CALL 768
;
; Return:
;
;       Carry clear, A = $00
;           Installation completed.
;
;       Carry set, A = $01
;           The expected VERIFY or &TSAVE command-table signature was not found.
;
; The external VERIFY command is replaced. A DOS reboot restores the original
; command table.
;
;===============================================================================

INSTALL         LDA     CMDNAME          ; Original name must begin with "V".
                CMP     #$56
                BEQ     CHKOLD

                CMP     #$26             ; Or it may already begin with "&".
                BNE     INSTBAD

                LDA     CMDNAME+5        ; Installed name ends in high-bit "E".
                CMP     #$C5
                BNE     INSTBAD
                JMP     PATCH

CHKOLD          LDA     CMDNAME+5        ; VERIFY ends in high-bit "Y".
                CMP     #$D9
                BNE     INSTBAD


;-------------------------------------------------------------------------------
; Give the command the same attributes as BSAVE.
;
; Attribute word = $7921, stored little endian:
;
;       filename applicable
;       new file may be created
;       legal in direct mode
;       V, D, S, L and A options accepted
;
;-------------------------------------------------------------------------------

PATCH           LDA     #$21
                STA     CMDATTR

                LDA     #$79
                STA     CMDATTR+1


;-------------------------------------------------------------------------------
; Patch the command-handler table.
;
; DOS command-handler vectors contain the handler address minus one.
;-------------------------------------------------------------------------------

                LDA     #<TSVEC
                STA     CMDVEC

                LDA     #>TSVEC
                STA     CMDVEC+1


;-------------------------------------------------------------------------------
; Replace "VERIFY" with "&TSAVE".
;
; The final character has bit 7 set because DOS uses that bit to mark the end
; of a command-table entry.
;-------------------------------------------------------------------------------

                LDX     #5

PNLOOP          LDA     NEWNAME,X
                STA     CMDNAME,X
                DEX
                BPL     PNLOOP

                LDA     #$00
                CLC
                RTS


INSTBAD         LDA     #$01
                SEC
                RTS


NEWNAME         .BYTE   $26              ; &
                .BYTE   $54              ; T
                .BYTE   $53              ; S
                .BYTE   $41              ; A
                .BYTE   $56              ; V
                .BYTE   $C5              ; E with end-of-command bit


; DOS's handler table requires entry address minus one.

TSVEC           EQU     TSAVE-1


;===============================================================================
; TSAVE COMMAND HANDLER
;===============================================================================
;
; DOS has already parsed and validated the filename and all options before
; entering here.
;
;===============================================================================

TSAVE           LDA     CUMOPT

; Both A and L are mandatory:
;
;       bit 0 = A supplied
;       bit 3 = L supplied

                AND     #$09
                CMP     #$09
                BEQ     PARMOK

                JMP     SYNTERR


;===============================================================================
; VALIDATE ADDRESS RANGE
;===============================================================================
;
; Calculate:
;
;       ADRPRSD + LENPRSD
;
; A carry from the high-byte addition means the source range wraps from $FFFF
; into page zero. Reject that as a DOS range error.
;
; A range ending exactly at $10000 is also rejected. For example:
;
;       A$FF00,L$100
;
; The final byte would be $FFFF, but the exclusive end address is $10000 and
; sets carry. A later revision could explicitly permit that boundary case.
;
;===============================================================================

PARMOK          LDA     ADRPRSD
                CLC
                ADC     LENPRSD

                LDA     ADRPRSD+1
                ADC     LENPRSD+1
                BCC     NOWRAP

                JMP     RNGERR


;===============================================================================
; INITIALISE SOURCE POINTER AND COUNTER
;===============================================================================
;
; GETBYTE is a self-modifying absolute LDA instruction.
;
;===============================================================================

NOWRAP          LDA     ADRPRSD
                STA     GETBYTE+1

                LDA     ADRPRSD+1
                STA     GETBYTE+2


                LDA     LENPRSD
                STA     BYLEFT

                LDA     LENPRSD+1
                STA     BYLEFT+1


;===============================================================================
; OPEN AS A SEQUENTIAL TEXT FILE
;===============================================================================
;
; DOS's common OPEN handler interprets a nonzero L parameter as a random-access
; record length. Clear LENPRSD before OPEN so DOS defaults the record length
; to one byte.
;
; The original requested length is safely retained in BYLEFT.
;
;===============================================================================

                LDA     #$00
                STA     LENPRSD
                STA     LENPRSD+1


; File type zero is a DOS text file.

                LDA     #$00
                JSR     OPNCKT


;===============================================================================
; PREPARE FILE MANAGER FOR WRITE-ONE-BYTE
;===============================================================================
;
; OPCODE $04 = WRITE
; SUBCODE $02 = write one byte
;
; WRADRLEN in DOS itself uses this same File Manager operation.
;
;===============================================================================

                LDA     #$04
                STA     OPCODE

                LDA     #$02
                STA     SUBCODE


;===============================================================================
; WRITE SOURCE BYTES
;===============================================================================

WRLOOP          LDA     BYLEFT
                ORA     BYLEFT+1
                BEQ     WRDONE


; Read one byte from the self-modifying source address.

GETBYTE         LDA     $FFFF


; Convert ordinary ASCII to Apple high-bit ASCII.
;
; Already converted Apple characters remain unchanged.

                ORA     #$80
                STA     ONEBYTE

                JSR     FMDRIVE


; Advance the embedded 16-bit source address.

                INC     GETBYTE+1
                BNE     PTRDONE

                INC     GETBYTE+2


; Decrement the 16-bit remaining-byte count.

PTRDONE         LDA     BYLEFT
                BNE     DECLOW

                DEC     BYLEFT+1

DECLOW          DEC     BYLEFT
                JMP     WRLOOP


;===============================================================================
; APPEND DOS TEXT END MARKER
;===============================================================================
;
; DOS text reading treats $00 as end-of-data. Appending it ensures that
; overwriting an existing, longer text file does not expose stale trailing text.
;
; The $00 byte is not included in the user's L parameter.
;
;===============================================================================

WRDONE          LDA     #$00
                STA     ONEBYTE
                JSR     FMDRIVE


;===============================================================================
; CLOSE AND VERIFY
;===============================================================================
;
; CMDCLOS flushes the final data sector, updates the catalog entry and releases
; the active DOS file buffer.
;
; CMDVRFY remains available internally even though its external command name
; was replaced with &TSAVE.
;
; The final JMP ultimately returns through DOS's normal command-processing
; stack, back to the Applesoft prompt.
;
;===============================================================================

                JSR     CMDCLOS
                JMP     CMDVRFY


;===============================================================================
; LOCAL WORKING STORAGE
;===============================================================================

BYLEFT          .WORD   $0000