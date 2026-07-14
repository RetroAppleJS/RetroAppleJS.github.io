;*****************************************************************************
;* Apple II+ QR generator - Step 0: text editor and mode recommendation       *
;*                                                                            *
;* HGR page 1 remains visible in mixed mode.  The bottom four text rows are   *
;* used as follows:                                                           *
;*   row 20 : [E]DIT [W]IPE [C]ODE [ESC]       0000.0 N                       *
;*   rows 21-23 : 120-character viewport into the 1024-byte text buffer       *
;*                                                                            *
;* The text buffer occupies all of text page 2 ($0800-$0BFF).                 *
;* The display must stay on PAGE1; PAGE2 is used only as ordinary RAM.        *
;*                                                                            *
;* Four-byte reusable buffer descriptor:                                      *
;*   $0C00/$0C01  BUF_LEN   complete bytes in use (0..1024)                   *
;*   $0C02        BUF_BITS  valid MSB-first bits in the following byte        *
;*                         (0..7; always 0 while editing raw text)            *
;*   $0C03        BUF_MODE  current buffer representation: $01/$02/$04        *
;*   $0C04        REC_MODE  recommended mode while the buffer contains raw text *
;*   $0C05        BUF_STATE $00=raw editable text, $80=packed encoded data   *
;*                                                                           *
;* Editor keys:                                                              *
;*   printable character : insert at cursor                                  *
;*   left/right arrows   : move cursor ($08/$15)                             *
;*   Ctrl-D              : delete character under cursor ($04)               *
;*   Delete              : delete character before cursor ($7F), if present  *
;*   Escape              : return to menu                                    *
;* Menu keys: E=edit raw text, W=wipe, C=pack using recommended mode         *
;*                                                                           *
;* The three display rows form one contiguous 120-character viewport.        *
;* No CR byte is inserted when text wraps from one display row to the next.  *
;*****************************************************************************

;*** APPLE II ROM CALLS ***
M.KPRESS       EQU   $FD35       ; wait for key; returned byte has bit 7 set
M.HGR          EQU   $F3E2       ; clear/select HGR page 1 in mixed mode

;*** VIDEO SOFT SWITCHES ***
SW.GRAPHICS    EQU   $C050
SW.MIXED       EQU   $C053
SW.PAGE1       EQU   $C054
SW.HIRES       EQU   $C057
SW.SPEAKER     EQU   $C030

;*** MIXED-MODE TEXT ROWS ON TEXT PAGE 1 ***
MENUROW        EQU   $0650       ; text row 20
EDITROW0       EQU   $06D0       ; text row 21
EDITROW1       EQU   $0750       ; text row 22
EDITROW2       EQU   $07D0       ; text row 23

;*** PAGE-2 TEXT RAM USED AS THE QR DATA BUFFER ***
TEXTBUF        EQU   $0800
TEXTEND        EQU   $0C00       ; first byte after the 1024-byte buffer

;*** REUSABLE FOUR-BYTE BUFFER DESCRIPTOR ***
BUF_LENL       EQU   $0C00
BUF_LENH       EQU   $0C01
BUF_BITS       EQU   $0C02
BUF_MODE       EQU   $0C03       ; actual representation of TEXTBUF
REC_MODE       EQU   $0C04       ; best single QR mode for raw text
BUF_STATE      EQU   $0C05       ; $00 raw/editable, $80 encoded/locked

STATE_RAW      EQU   $00
STATE_CODED    EQU   $80

MODE_NUM       EQU   $01         ; QR mode indicator 0001
MODE_ALNUM     EQU   $02         ; QR mode indicator 0010
MODE_BYTE      EQU   $04         ; QR mode indicator 0100

;*** EDITOR STATE ***
CURSORL        EQU   $0C06       ; insertion cursor: 0..BUF_LEN
CURSORH        EQU   $0C07
VIEWL          EQU   $0C08       ; first visible buffer byte; multiple of 40
VIEWH          EQU   $0C09
KEYSAVE        EQU   $0C0A
VISIBLE        EQU   $0C0B       ; source characters remaining in viewport
DIGIT          EQU   $0C0C

;*** ZERO-PAGE WORKSPACE ***
PTR0L          EQU   $06
PTR0H          EQU   $07
PTR1L          EQU   $08
PTR1H          EQU   $09
COUNTL         EQU   $0A
COUNTH         EQU   $0B
OFFL           EQU   $0C
OFFH           EQU   $0D
TEMP0          EQU   $0E
TEMP1          EQU   $0F
VALUELO        EQU   $10
VALUEHI        EQU   $11
OUTACC         EQU   $12
OUTBITS        EQU   $13
BITLEN         EQU   $14
SAVELO         EQU   $15
SAVEHI         EQU   $16
CLASS          EQU   $17

               ORG   $6000

;=============================================================================
; PROGRAM ENTRY
;=============================================================================
QR.START       JSR   QR.INIT

QR.MENU        JSR   DRAW.MENU
               JSR   DRAW.VIEW

QM.KEY         JSR   M.KPRESS
               AND   #$7F
               CMP   #$1B               ; Escape: return to caller
               BEQ   QR.EXIT
               CMP   #"E"
               BNE   QM.NOTEDIT
               LDA   BUF_STATE
               BEQ   EDIT.START          ; packed data is not directly editable
               BIT   SW.SPEAKER
               JMP   QM.KEY
QM.NOTEDIT     CMP   #"W"
               BNE   QM.NOTWIPE
               JSR   BUFFER.WIPE
               JMP   QR.MENU
QM.NOTWIPE     CMP   #"C"
               BNE   QM.KEY
               JSR   BUFFER.CODE
               JMP   QR.MENU

QR.EXIT        RTS

;=============================================================================
; INITIALISATION
;=============================================================================
QR.INIT        JSR   M.HGR
               BIT   SW.PAGE1           ; PAGE2 must not be selected for video
               BIT   SW.GRAPHICS
               BIT   SW.MIXED
               BIT   SW.HIRES

               JMP   BUFFER.WIPE

;=============================================================================
; EDITOR LOOP
;=============================================================================
EDIT.START     JSR   VIEW.CURSOR
               JSR   EDIT.REFRESH

ED.KEY         JSR   M.KPRESS
               AND   #$7F
               CMP   #$1B               ; Escape: leave editor, keep contents
               BEQ   ED.ESC
               CMP   #$08               ; Apple II left arrow / Ctrl-H
               BEQ   ED.LEFT
               CMP   #$15               ; Apple II right arrow / Ctrl-U
               BEQ   ED.RIGHT
               CMP   #$04               ; Ctrl-D: delete under cursor
               BEQ   ED.DELETE
               CMP   #$7F               ; DEL: delete before cursor
               BEQ   ED.BACK
               CMP   #$0D               ; Return does not insert a CR
               BEQ   ED.KEY
               CMP   #$20               ; ignore other control codes
               BCC   ED.KEY
               CMP   #$7F
               BCS   ED.KEY

               JSR   BUF.INSERT          ; A = printable 7-bit ASCII
               BCC   ED.KEY              ; full buffer: character not inserted
               JSR   BUFFER.CHANGED
               JMP   ED.KEY

ED.LEFT        JSR   CURSOR.LEFT
               JSR   EDIT.REFRESH
               JMP   ED.KEY

ED.RIGHT       JSR   CURSOR.RIGHT
               JSR   EDIT.REFRESH
               JMP   ED.KEY

ED.DELETE      JSR   BUF.DELETE
               BCC   ED.KEY
               JSR   BUFFER.CHANGED
               JMP   ED.KEY

ED.BACK        JSR   BUF.BACKSPACE
               BCC   ED.KEY
               JSR   BUFFER.CHANGED
               JMP   ED.KEY

ED.ESC         JSR   DRAW.MENU
               JSR   DRAW.VIEW
               JMP   QR.MENU

BUFFER.CHANGED LDA   #STATE_RAW
               STA   BUF_STATE
               LDA   #$00               ; raw text always consists of whole bytes
               STA   BUF_BITS
               LDA   #MODE_BYTE         ; physical representation is still bytes
               STA   BUF_MODE
               JSR   MODE.SCAN           ; updates REC_MODE only
               JSR   VIEW.CURSOR
               JMP   EDIT.REFRESH

EDIT.REFRESH   JSR   DRAW.MENU
               JSR   DRAW.VIEW
               JMP   DRAW.CURSOR

;=============================================================================
; CURSOR MOVEMENT AND 120-CHARACTER VIEWPORT
;=============================================================================
CURSOR.LEFT    LDA   CURSORL
               ORA   CURSORH
               BEQ   CL.DONE
               LDA   CURSORL
               BNE   CL.DECLO
               DEC   CURSORH
CL.DECLO       DEC   CURSORL
               JSR   VIEW.CURSOR
CL.DONE        RTS

CURSOR.RIGHT   LDA   CURSORH
               CMP   BUF_LENH
               BNE   CR.TEST
               LDA   CURSORL
               CMP   BUF_LENL
               BEQ   CR.DONE
CR.TEST        INC   CURSORL
               BNE   CR.VIEW
               INC   CURSORH
CR.VIEW        JSR   VIEW.CURSOR
CR.DONE        RTS

; Keep CURSOR in [VIEW, VIEW+119]. VIEW is always aligned to 40 bytes.
VIEW.CURSOR    LDA   CURSORH             ; cursor < view ?
               CMP   VIEWH
               BCC   VC.BACK
               BNE   VC.RIGHT
               LDA   CURSORL
               CMP   VIEWL
               BCC   VC.BACK

VC.RIGHT       CLC                       ; TEMP = VIEW + 120
               LDA   VIEWL
               ADC   #120
               STA   TEMP0
               LDA   VIEWH
               ADC   #$00
               STA   TEMP1

               LDA   CURSORH             ; cursor >= VIEW+120 ?
               CMP   TEMP1
               BCC   VC.DONE
               BNE   VC.FORWARD
               LDA   CURSORL
               CMP   TEMP0
               BCC   VC.DONE

VC.FORWARD     CLC                       ; move viewport down one text row
               LDA   VIEWL
               ADC   #40
               STA   VIEWL
               LDA   VIEWH
               ADC   #$00
               STA   VIEWH
               JMP   VIEW.CURSOR

VC.BACK        LDA   VIEWL               ; move viewport up one text row
               ORA   VIEWH
               BEQ   VC.DONE
               SEC
               LDA   VIEWL
               SBC   #40
               STA   VIEWL
               LDA   VIEWH
               SBC   #$00
               STA   VIEWH
               JMP   VIEW.CURSOR

VC.DONE        RTS

;=============================================================================
; INSERT A CHARACTER AT CURSOR
; Input : A = 7-bit printable ASCII
; Output: C=1 inserted, C=0 buffer already contains 1024 bytes
;=============================================================================
BUF.INSERT     STA   KEYSAVE

               LDA   BUF_LENH            ; full exactly at $0400 bytes
               CMP   #$04
               BCC   BI.ROOM
               JMP   BI.FULL

BI.ROOM        LDA   CURSORH             ; fast path when cursor == length
               CMP   BUF_LENH
               BNE   BI.SHIFT
               LDA   CURSORL
               CMP   BUF_LENL
               BEQ   BI.WRITE

; Shift [CURSOR..LEN-1] one byte toward higher addresses.
BI.SHIFT       SEC
               LDA   BUF_LENL            ; COUNT = LEN - CURSOR
               SBC   CURSORL
               STA   COUNTL
               LDA   BUF_LENH
               SBC   CURSORH
               STA   COUNTH

               SEC                       ; PTR0 = TEXTBUF + LEN - 1
               LDA   BUF_LENL
               SBC   #$01
               STA   OFFL
               LDA   BUF_LENH
               SBC   #$00
               STA   OFFH
               JSR   MAKE.PTR0

               LDA   BUF_LENL            ; PTR1 = TEXTBUF + LEN
               STA   OFFL
               LDA   BUF_LENH
               STA   OFFH
               JSR   MAKE.PTR1

BI.MOVE        LDX   #$00
               LDA   (PTR0L,X)
               STA   (PTR1L,X)

               LDA   PTR0L               ; --PTR0
               BNE   BI.P0LO
               DEC   PTR0H
BI.P0LO        DEC   PTR0L

               LDA   PTR1L               ; --PTR1
               BNE   BI.P1LO
               DEC   PTR1H
BI.P1LO        DEC   PTR1L

               JSR   COUNT.DEC
               LDA   COUNTL
               ORA   COUNTH
               BNE   BI.MOVE

BI.WRITE       LDA   CURSORL             ; PTR0 = TEXTBUF + CURSOR
               STA   OFFL
               LDA   CURSORH
               STA   OFFH
               JSR   MAKE.PTR0
               LDX   #$00
               LDA   KEYSAVE
               STA   (PTR0L,X)

               INC   BUF_LENL
               BNE   BI.CURSOR
               INC   BUF_LENH
BI.CURSOR      INC   CURSORL
               BNE   BI.OK
               INC   CURSORH
BI.OK          SEC
               RTS

BI.FULL        CLC
               RTS

;=============================================================================
; DELETE CHARACTER UNDER CURSOR
; Output: C=1 deleted, C=0 cursor was already at end
;=============================================================================
BUF.DELETE     LDA   CURSORH
               CMP   BUF_LENH
               BNE   BD.HAVE
               LDA   CURSORL
               CMP   BUF_LENL
               BEQ   BD.NONE

BD.HAVE        SEC                       ; COUNT = LEN - CURSOR - 1
               LDA   BUF_LENL
               SBC   CURSORL
               STA   COUNTL
               LDA   BUF_LENH
               SBC   CURSORH
               STA   COUNTH
               JSR   COUNT.DEC

               LDA   COUNTL
               ORA   COUNTH
               BEQ   BD.SHRINK

               CLC                       ; PTR0 = TEXTBUF + CURSOR + 1
               LDA   CURSORL
               ADC   #$01
               STA   OFFL
               LDA   CURSORH
               ADC   #$00
               STA   OFFH
               JSR   MAKE.PTR0

               LDA   CURSORL             ; PTR1 = TEXTBUF + CURSOR
               STA   OFFL
               LDA   CURSORH
               STA   OFFH
               JSR   MAKE.PTR1

BD.MOVE        LDX   #$00
               LDA   (PTR0L,X)
               STA   (PTR1L,X)
               JSR   PTR0.INC
               JSR   PTR1.INC
               JSR   COUNT.DEC
               LDA   COUNTL
               ORA   COUNTH
               BNE   BD.MOVE

BD.SHRINK      JSR   LENGTH.DEC

               LDA   BUF_LENL            ; clear newly unused final byte
               STA   OFFL
               LDA   BUF_LENH
               STA   OFFH
               JSR   MAKE.PTR0
               LDA   #$00
               LDX   #$00
               STA   (PTR0L,X)
               SEC
               RTS

BD.NONE        CLC
               RTS

; Delete the character immediately before CURSOR.
BUF.BACKSPACE  LDA   CURSORL
               ORA   CURSORH
               BEQ   BB.NONE
               JSR   CURSOR.LEFT
               JSR   BUF.DELETE
               RTS
BB.NONE        CLC
               RTS

;=============================================================================
; WIPE THE COMPLETE PAGE-2 BUFFER AND RESET THE EDITOR/DESCRIPTOR
;=============================================================================
BUFFER.WIPE    LDA   #$00
               LDX   #$00
BW.CLEAR       STA   TEXTBUF+$000,X
               STA   TEXTBUF+$100,X
               STA   TEXTBUF+$200,X
               STA   TEXTBUF+$300,X
               INX
               BNE   BW.CLEAR

               STA   BUF_LENL
               STA   BUF_LENH
               STA   BUF_BITS
               STA   CURSORL
               STA   CURSORH
               STA   VIEWL
               STA   VIEWH
               STA   BUF_STATE
               LDA   #MODE_BYTE         ; raw input is stored as bytes
               STA   BUF_MODE
               LDA   #MODE_NUM          ; empty input is compatible with Numeric
               STA   REC_MODE
               RTS

;=============================================================================
; PACK THE RAW TEXT BUFFER IN PLACE USING REC_MODE
;
; After packing:
;   BUF_LEN  = number of complete output bytes
;   BUF_BITS = valid MSB-first bits in the following partial byte (0..7)
;   BUF_MODE = actual encoding mode used
;   BUF_STATE= STATE_CODED
;
; Numeric:      groups of 3/2/1 digits -> 10/7/4 bits
; Alphanumeric: groups of 2/1 chars    -> 11/6 bits
; Byte:         no data conversion is needed
;=============================================================================
BUFFER.CODE    LDA   BUF_STATE
               BNE   BC.DONE            ; do not encode packed data twice
               JSR   MODE.SCAN
               LDA   REC_MODE
               CMP   #MODE_NUM
               BNE   BC.NOTNUM
               JSR   ENCODE.NUMERIC
               LDA   #MODE_NUM
               BNE   BC.MARK
BC.NOTNUM      CMP   #MODE_ALNUM
               BNE   BC.BYTE
               JSR   ENCODE.ALNUM
               LDA   #MODE_ALNUM
               BNE   BC.MARK
BC.BYTE        LDA   #$00               ; byte mode already has whole bytes
               STA   BUF_BITS
               LDA   #MODE_BYTE
BC.MARK        STA   BUF_MODE
               LDA   #STATE_CODED
               STA   BUF_STATE
               LDA   #$00
               STA   CURSORL
               STA   CURSORH
               STA   VIEWL
               STA   VIEWH
BC.DONE        RTS

; Initialise the common source pointer, source count, and bit writer.
ENCODE.INIT    LDA   #<TEXTBUF
               STA   PTR0L
               STA   PTR1L
               LDA   #>TEXTBUF
               STA   PTR0H
               STA   PTR1H
               LDA   BUF_LENL
               STA   COUNTL
               LDA   BUF_LENH
               STA   COUNTH
               LDA   #$00
               STA   BUF_LENL
               STA   BUF_LENH
               STA   BUF_BITS
               STA   OUTACC
               STA   OUTBITS
               RTS

; Finalise a partially filled output byte by moving its valid bits to bits 7..0.
ENCODE.FINISH  LDA   OUTBITS
               STA   BUF_BITS
               BEQ   EF.DONE
               STA   TEMP0
               LDA   #$08
               SEC
               SBC   TEMP0
               TAX
               LDA   OUTACC
EF.SHIFT       ASL
               DEX
               BNE   EF.SHIFT
               LDX   #$00
               STA   (PTR1L,X)
EF.DONE        RTS

;=============================================================================
; NUMERIC PACKER
;=============================================================================
ENCODE.NUMERIC JSR   ENCODE.INIT
EN.LOOP        LDA   COUNTH
               BNE   EN.THREE
               LDA   COUNTL
               CMP   #$03
               BCS   EN.THREE
               CMP   #$02
               BEQ   EN.TWO
               CMP   #$01
               BEQ   EN.ONE
               JMP   ENCODE.FINISH

EN.THREE       JSR   VALUE.ZERO
               JSR   NUM.GETDIGIT
               JSR   NUM.GETDIGIT
               JSR   NUM.GETDIGIT
               LDA   #10
               JSR   WRITE.VALUE
               JMP   EN.LOOP

EN.TWO         JSR   VALUE.ZERO
               JSR   NUM.GETDIGIT
               JSR   NUM.GETDIGIT
               LDA   #7
               JSR   WRITE.VALUE
               JMP   EN.LOOP

EN.ONE         JSR   VALUE.ZERO
               JSR   NUM.GETDIGIT
               LDA   #4
               JSR   WRITE.VALUE
               JMP   EN.LOOP

VALUE.ZERO     LDA   #$00
               STA   VALUELO
               STA   VALUEHI
               RTS

; Read one ASCII digit, consume it, and perform VALUE = VALUE*10 + digit.
NUM.GETDIGIT   LDX   #$00
               LDA   (PTR0L,X)
               SEC
               SBC   #"0"
               JSR   VALUE.MUL10.ADD
               JSR   PTR0.INC
               JSR   COUNT.DEC
               RTS

VALUE.MUL10.ADD
               STA   TEMP0              ; digit
               LDA   VALUELO
               STA   SAVELO             ; preserve VALUE*2 for the +2 component
               LDA   VALUEHI
               STA   SAVEHI
               ASL   SAVELO
               ROL   SAVEHI
               ASL   VALUELO             ; *2
               ROL   VALUEHI
               ASL   VALUELO             ; *4
               ROL   VALUEHI
               ASL   VALUELO             ; *8
               ROL   VALUEHI
               CLC                       ; *8 + *2 = *10
               LDA   VALUELO
               ADC   SAVELO
               STA   VALUELO
               LDA   VALUEHI
               ADC   SAVEHI
               STA   VALUEHI
               CLC
               LDA   VALUELO
               ADC   TEMP0
               STA   VALUELO
               BCC   VM.DONE
               INC   VALUEHI
VM.DONE        RTS

;=============================================================================
; ALPHANUMERIC PACKER
;=============================================================================
ENCODE.ALNUM   JSR   ENCODE.INIT
EA.LOOP        LDA   COUNTH
               BNE   EA.PAIR
               LDA   COUNTL
               CMP   #$02
               BCS   EA.PAIR
               CMP   #$01
               BEQ   EA.SINGLE
               JMP   ENCODE.FINISH

EA.PAIR        JSR   ALNUM.GETVALUE      ; A = first value
               STA   TEMP0
               JSR   ALNUM.GETVALUE      ; A = second value
               STA   TEMP1
               JSR   ALNUM.MUL45.ADD
               LDA   #11
               JSR   WRITE.VALUE
               JMP   EA.LOOP

EA.SINGLE      JSR   ALNUM.GETVALUE
               STA   VALUELO
               LDA   #$00
               STA   VALUEHI
               LDA   #6
               JSR   WRITE.VALUE
               JMP   EA.LOOP

; Read and consume one character, returning its QR alphanumeric value in A.
ALNUM.GETVALUE LDX   #$00
               LDA   (PTR0L,X)
               JSR   ALNUM.VALUE
               PHA
               JSR   PTR0.INC
               JSR   COUNT.DEC
               PLA
               RTS

; Input A = valid QR alphanumeric character. Output A = value 0..44.
ALNUM.VALUE    LDX   #$00
AV.LOOP        CMP   ALNUM.TABLE,X
               BEQ   AV.FOUND
               INX
               CPX   #45
               BNE   AV.LOOP
               LDX   #$00               ; defensive fallback; scan prevents this
AV.FOUND       TXA
               RTS

; Compute VALUE = TEMP0*45 + TEMP1.
ALNUM.MUL45.ADD
               LDA   TEMP0
               STA   VALUELO
               LDA   #$00
               STA   VALUEHI
               LDX   #$05               ; VALUE = x*32
AM.SHIFT32     ASL   VALUELO
               ROL   VALUEHI
               DEX
               BNE   AM.SHIFT32

               LDA   TEMP0              ; SAVE = x*8
               STA   SAVELO
               LDA   #$00
               STA   SAVEHI
               LDX   #$03
AM.SHIFT8      ASL   SAVELO
               ROL   SAVEHI
               DEX
               BNE   AM.SHIFT8
               JSR   VALUE.ADD.SAVE

               LDA   TEMP0              ; SAVE = x*4
               STA   SAVELO
               LDA   #$00
               STA   SAVEHI
               ASL   SAVELO
               ROL   SAVEHI
               ASL   SAVELO
               ROL   SAVEHI
               JSR   VALUE.ADD.SAVE

               LDA   TEMP0              ; +x
               STA   SAVELO
               LDA   #$00
               STA   SAVEHI
               JSR   VALUE.ADD.SAVE

               CLC                       ; + second character
               LDA   VALUELO
               ADC   TEMP1
               STA   VALUELO
               BCC   AM.DONE
               INC   VALUEHI
AM.DONE        RTS

VALUE.ADD.SAVE CLC
               LDA   VALUELO
               ADC   SAVELO
               STA   VALUELO
               LDA   VALUEHI
               ADC   SAVEHI
               STA   VALUEHI
               RTS

ALNUM.TABLE    ASC   "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

;=============================================================================
; COMMON MSB-FIRST BIT WRITER
; Input: VALUEHI:VALUELO right-aligned, A=number of bits (1..16)
;=============================================================================
WRITE.VALUE    STA   BITLEN
               LDA   #16
               SEC
               SBC   BITLEN
               TAX
               BEQ   WV.READY
WV.ALIGN       ASL   VALUELO
               ROL   VALUEHI
               DEX
               BNE   WV.ALIGN
WV.READY       ASL   VALUELO
               ROL   VALUEHI            ; C = next most-significant value bit
               JSR   WRITE.BIT
               DEC   BITLEN
               BNE   WV.READY
               RTS

; Append carry to the output stream. Complete bytes are written immediately.
WRITE.BIT      ROL   OUTACC
               INC   OUTBITS
               LDA   OUTBITS
               CMP   #$08
               BNE   WB.DONE
               LDX   #$00
               LDA   OUTACC
               STA   (PTR1L,X)
               JSR   PTR1.INC
               INC   BUF_LENL
               BNE   WB.RESET
               INC   BUF_LENH
WB.RESET       LDA   #$00
               STA   OUTACC
               STA   OUTBITS
WB.DONE        RTS

;=============================================================================
; CLASSIFY THE COMPLETE RAW TEXT BUFFER AFTER EACH MODIFICATION
;
; BUF_MODE remains MODE_BYTE while editing because the current representation
; is raw bytes. REC_MODE independently records the narrowest single QR mode:
; MODE_NUM, MODE_ALNUM, or MODE_BYTE.
;=============================================================================
MODE.SCAN      LDA   #MODE_NUM
               STA   REC_MODE
               LDA   #<TEXTBUF
               STA   PTR0L
               LDA   #>TEXTBUF
               STA   PTR0H
               LDA   BUF_LENL
               STA   COUNTL
               LDA   BUF_LENH
               STA   COUNTH

MS.LOOP        LDA   COUNTL
               ORA   COUNTH
               BEQ   MS.DONE
               LDX   #$00
               LDA   (PTR0L,X)
               JSR   CHAR.CLASS         ; A=0 numeric, 1 alnum, 2 byte
               CMP   #$02
               BEQ   MS.BYTE
               CMP   #$01
               BNE   MS.NEXT
               LDA   REC_MODE
               CMP   #MODE_NUM
               BNE   MS.NEXT
               LDA   #MODE_ALNUM
               STA   REC_MODE
MS.NEXT        JSR   PTR0.INC
               JSR   COUNT.DEC
               JMP   MS.LOOP
MS.BYTE        LDA   #MODE_BYTE
               STA   REC_MODE
MS.DONE        RTS

; Return class 0=numeric, 1=alphanumeric, 2=byte for input character A.
CHAR.CLASS     CMP   #"0"
               BCC   CC.ALPHA
               CMP   #"9"+1
               BCC   CC.NUMERIC
CC.ALPHA       CMP   #"A"
               BCC   CC.SYMBOL
               CMP   #"Z"+1
               BCC   CC.ALNUM
CC.SYMBOL      LDX   #$08
CC.SLOOP       CMP   ALNUM.SYM,X
               BEQ   CC.ALNUM
               DEX
               BPL   CC.SLOOP
               LDA   #$02
               RTS
CC.NUMERIC     LDA   #$00
               RTS
CC.ALNUM       LDA   #$01
               RTS

ALNUM.SYM      ASC   " $%*+-./:"

;=============================================================================
; DRAW MENU ROW AND RIGHT-ALIGNED "BBBB.b M" STATUS
;
; Raw state:    M is REC_MODE, the recommended mode for the source text.
; Coded state:  M is BUF_MODE, the actual packed representation; column 38 is >.
;=============================================================================
DRAW.MENU      LDA   #$A0               ; normal screen-space
               LDX   #39
DM.CLEAR       STA   MENUROW,X
               DEX
               BPL   DM.CLEAR

               LDX   #$00
DM.TEXT        LDA   MENU.TEXT,X
               ORA   #$80
               STA   MENUROW,X
               INX
               CPX   #26
               BNE   DM.TEXT

               LDA   BUF_LENL
               STA   VALUELO
               LDA   BUF_LENH
               STA   VALUEHI
               LDX   #$00

DM.DIGIT       LDA   #"0"
               STA   DIGIT
DM.SUBTEST     LDA   VALUEHI
               CMP   DIVHIGH,X
               BCC   DM.STORE
               BNE   DM.SUBTRACT
               LDA   VALUELO
               CMP   DIVLOW,X
               BCC   DM.STORE

DM.SUBTRACT    SEC
               LDA   VALUELO
               SBC   DIVLOW,X
               STA   VALUELO
               LDA   VALUEHI
               SBC   DIVHIGH,X
               STA   VALUEHI
               INC   DIGIT
               JMP   DM.SUBTEST

DM.STORE       LDA   DIGIT
               ORA   #$80
               STA   MENUROW+32,X
               INX
               CPX   #$04
               BNE   DM.DIGIT

               LDA   #"."
               ORA   #$80
               STA   MENUROW+36
               LDA   BUF_BITS
               CLC
               ADC   #"0"
               ORA   #$80
               STA   MENUROW+37

               LDA   BUF_STATE
               BEQ   DM.RAW
               LDA   #">"
               BNE   DM.STATE
DM.RAW         LDA   #" "
DM.STATE       ORA   #$80
               STA   MENUROW+38

               LDA   BUF_STATE
               BEQ   DM.USE_REC
               LDA   BUF_MODE
               BNE   DM.SELECT
DM.USE_REC     LDA   REC_MODE
DM.SELECT      CMP   #MODE_NUM
               BEQ   DM.N
               CMP   #MODE_ALNUM
               BEQ   DM.A
               LDA   #"B"
               BNE   DM.MODE
DM.N           LDA   #"N"
               BNE   DM.MODE
DM.A           LDA   #"A"
DM.MODE        ORA   #$80
               STA   MENUROW+39
               RTS

MENU.TEXT      ASC   "[E]DIT [W]IPE [C]ODE [ESC]"
DIVLOW         HEX   E8640A01           ; 1000,100,10,1
DIVHIGH        HEX   03000000

;=============================================================================
; DRAW THE 120-CHARACTER VIEWPORT IN TEXT ROWS 21..23
;=============================================================================
DRAW.VIEW      LDA   BUF_STATE
               BNE   DV.ENCODED
               LDA   VIEWL              ; PTR0 = TEXTBUF + VIEW
               STA   PTR0L
               LDA   VIEWH
               CLC
               ADC   #>TEXTBUF
               STA   PTR0H

               SEC                       ; TEMP = LEN - VIEW
               LDA   BUF_LENL
               SBC   VIEWL
               STA   TEMP0
               LDA   BUF_LENH
               SBC   VIEWH
               STA   TEMP1
               BCC   DV.EMPTY

               LDA   TEMP1
               BNE   DV.CAP
               LDA   TEMP0
               CMP   #120
               BCS   DV.CAP
               STA   VISIBLE
               JMP   DV.ROWS
DV.CAP         LDA   #120
               STA   VISIBLE
               JMP   DV.ROWS
DV.EMPTY       LDA   #$00
               STA   VISIBLE

DV.ROWS        LDA   #<EDITROW0
               STA   PTR1L
               LDA   #>EDITROW0
               STA   PTR1H
               JSR   DRAW.ROW

               LDA   #<EDITROW1
               STA   PTR1L
               LDA   #>EDITROW1
               STA   PTR1H
               JSR   DRAW.ROW

               LDA   #<EDITROW2
               STA   PTR1L
               LDA   #>EDITROW2
               STA   PTR1H
               JMP   DRAW.ROW

DV.ENCODED     LDA   #$00
               STA   VISIBLE
               LDA   #<EDITROW0
               STA   PTR1L
               LDA   #>EDITROW0
               STA   PTR1H
               JSR   DRAW.ROW
               LDA   #<EDITROW1
               STA   PTR1L
               LDA   #>EDITROW1
               STA   PTR1H
               JSR   DRAW.ROW
               LDA   #<EDITROW2
               STA   PTR1L
               LDA   #>EDITROW2
               STA   PTR1H
               JSR   DRAW.ROW
               LDX   #$00
DV.MSG         LDA   CODED.MSG,X
               ORA   #$80
               STA   EDITROW0,X
               INX
               CPX   #34
               BNE   DV.MSG
               RTS

CODED.MSG      ASC   "ENCODED BUFFER - [W]IPE TO RESTART"

DRAW.ROW       LDX   #$00               ; required by (PTR0L,X)
               LDY   #$00
DR.LOOP        LDA   VISIBLE
               BEQ   DR.BLANK
               LDA   (PTR0L,X)
               ORA   #$80               ; convert 7-bit ASCII to normal video
               DEC   VISIBLE
               JSR   PTR0.INC
               JMP   DR.STORE
DR.BLANK       LDA   #$A0
DR.STORE       STA   (PTR1L),Y
               INY
               CPY   #40
               BNE   DR.LOOP
               RTS

; Draw an inverse character/space at CURSOR.
DRAW.CURSOR    SEC
               LDA   CURSORL
               SBC   VIEWL
               STA   TEMP0
               LDA   CURSORH
               SBC   VIEWH
               BNE   DC.DONE
               LDA   TEMP0
               CMP   #120
               BCS   DC.DONE
               CMP   #40
               BCC   DC.ROW0
               CMP   #80
               BCC   DC.ROW1
               SEC
               SBC   #80
               TAX
               LDA   EDITROW2,X
               AND   #$3F
               STA   EDITROW2,X
               RTS
DC.ROW1        SEC
               SBC   #40
               TAX
               LDA   EDITROW1,X
               AND   #$3F
               STA   EDITROW1,X
               RTS
DC.ROW0        TAX
               LDA   EDITROW0,X
               AND   #$3F
               STA   EDITROW0,X
DC.DONE        RTS

;=============================================================================
; SMALL 16-BIT AND POINTER HELPERS
;=============================================================================
MAKE.PTR0      LDA   OFFL
               STA   PTR0L
               LDA   OFFH
               CLC
               ADC   #>TEXTBUF
               STA   PTR0H
               RTS

MAKE.PTR1      LDA   OFFL
               STA   PTR1L
               LDA   OFFH
               CLC
               ADC   #>TEXTBUF
               STA   PTR1H
               RTS

PTR0.INC       INC   PTR0L
               BNE   P0I.DONE
               INC   PTR0H
P0I.DONE       RTS

PTR1.INC       INC   PTR1L
               BNE   P1I.DONE
               INC   PTR1H
P1I.DONE       RTS

COUNT.DEC      LDA   COUNTL
               BNE   CD.LO
               DEC   COUNTH
CD.LO          DEC   COUNTL
               RTS

LENGTH.DEC     LDA   BUF_LENL
               BNE   LD.LO
               DEC   BUF_LENH
LD.LO          DEC   BUF_LENL
               RTS

; End of QR_STEP0_EDITOR.S
