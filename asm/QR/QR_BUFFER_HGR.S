ORG   $6000

; ------------------------------------------------------------
; Enable HGR mixed mode, page 1
;
; HGR page 1 graphics memory: $2000-$3FFF
; Mixed-mode text area:       bottom four text rows on page 1
; ------------------------------------------------------------


; Test example
JSR   $F3E2

; Set buffer 0, coordinate (12,34):
              LDX   #$80+12
              LDY   #34
              JSR   QR_PUT

; Clear buffer 1, coordinate (12,34):
              LDX   #12
              LDY   #$80+34
              JSR   QR_PUT

; Read buffer 1, coordinate (12,34):
              LDX   #12
              LDY   #$80+34
              JSR   QR_GET

; Render buffer 0:
              LDA   #0
              JSR   QR_RENDER
              RTS




;*******************************************************************************
; Apple II+ QR bit buffers and HGR mixed-mode renderer
;
; 6502 / Apple II+ compatible: no 65C02 instructions.
;
; Logical canvas : 80 x 80 bits
; Physical output: 160 x 160 HGR pixels, centered at X = 60
; Module size    : 2 x 2 physical pixels
; HGR page       : page 1 ($2000-$3FFF), mixed mode
;
; Register encoding
; -----------------
; X bits 0-6 : logical X coordinate (0..79)
; X bit 7    : value for QR_PUT (0=clear, 1=set)
; Y bits 0-6 : logical Y coordinate (0..79)
; Y bit 7    : buffer selector (0=QRBUF0, 1=QRBUF1)
;
; QR_ADDR output
; --------------
; QRPTRL/QRPTRH : address of containing buffer byte
; A             : bit mask
; C             : original X bit 7
; Y             : 0, ready for (QRPTRL),Y
; X             : destroyed
;
; QR_GET output
; -------------
; A = 0 or 1
; C = 0 or 1
;
; QR_RENDER input
; ---------------
; A = 0 for QRBUF0, 1 for QRBUF1
;
; The zero-page locations below must be changed if they conflict with the
; surrounding program, DOS, ProDOS, Applesoft, or monitor workspace.
;*******************************************************************************


; Apple II soft switches
TXTCLR        EQU   $C050
MIXSET        EQU   $C053
TXTPAGE1      EQU   $C054
HIRES         EQU   $C057

; Two 1 KB-aligned buffer slots. Only the first 800 bytes of each are used.
; Alignment wastes 224 bytes per slot but makes buffer selection very fast.
QRBUF0        EQU   $7000
QRBUF1        EQU   $7400
QRBUFSIZE     EQU   $0320

; Zero-page workspace
QRPTRL        EQU   $06
QRPTRH        EQU   $07
HGRPTRL       EQU   $08
HGRPTRH       EQU   $09
QRXARG        EQU   $0A
QRYARG        EQU   $0B
QRMASK        EQU   $0C
QRXBYTE       EQU   $0D
QRMASK0       EQU   $0E
QRMASK1       EQU   $0F
QRPIXEL       EQU   $10
QRSCREENY     EQU   $11
QRBUFSEL      EQU   $12
QRLOOPX       EQU   $13
QRLOOPY       EQU   $14

;*******************************************************************************
; QR_INIT_HGR
; Select HGR page 1 in mixed mode.
;*******************************************************************************
QR_INIT_HGR
              BIT   HIRES
              BIT   TXTPAGE1
              BIT   MIXSET
              BIT   TXTCLR
              RTS

;*******************************************************************************
; QR_CLEAR_HGR
; Clears the complete HGR page 1. This also establishes HGR phase bit 7 as zero.
; Destroys A, X, Y and HGRPTRL/HGRPTRH.
;*******************************************************************************
QR_CLEAR_HGR
              LDA   #$00
              STA   HGRPTRL
              LDA   #$20
              STA   HGRPTRH
              LDY   #$00

QR_CH_PAGE
              LDA   #$00
QR_CH_BYTE
              STA   (HGRPTRL),Y
              INY
              BNE   QR_CH_BYTE
              INC   HGRPTRH
              LDX   HGRPTRH
              CPX   #$40
              BNE   QR_CH_PAGE
              RTS

;*******************************************************************************
; QR_ADDR
; Converts encoded X/Y into a byte address and mask.
;
; Row address comes from QRROWL/QRROWH. Since QRBUF1 is exactly $0400 above
; QRBUF0, Y bit 7 selects it by adding 4 to the row high byte.
;*******************************************************************************
QR_ADDR
              STX   QRXARG
              STY   QRYARG

              TYA
              AND   #$7F
              TAX
              LDA   QRROWL,X
              STA   QRPTRL
              LDA   QRROWH,X
              BIT   QRYARG
              BPL   QR_AD_BUF0
              CLC
              ADC   #$04
QR_AD_BUF0
              STA   QRPTRH

              LDA   QRXARG
              AND   #$7F
              LSR
              LSR
              LSR
              CLC
              ADC   QRPTRL
              STA   QRPTRL
              BCC   QR_AD_NOCARRY
              INC   QRPTRH
QR_AD_NOCARRY

              LDA   QRXARG
              AND   #$07
              TAX
              LDA   BITMASK,X
              STA   QRMASK

              LDA   QRXARG
              ASL                  ; C = original X bit 7
              LDA   QRMASK         ; LDA does not alter C
              LDY   #$00
              RTS

;*******************************************************************************
; QR_PUT
; X bit 7 clear: reset the selected bit.
; X bit 7 set  : set the selected bit.
; Y bit 7 selects QRBUF0/QRBUF1.
;*******************************************************************************
QR_PUT
              JSR   QR_ADDR
              STA   QRMASK
              BCC   QR_PUT_CLEAR

QR_PUT_SET
              LDA   (QRPTRL),Y
              ORA   QRMASK
              STA   (QRPTRL),Y
              RTS

QR_PUT_CLEAR
              LDA   QRMASK
              EOR   #$FF
              AND   (QRPTRL),Y
              STA   (QRPTRL),Y
              RTS

;*******************************************************************************
; QR_GET
; Reads one bit from either buffer.
; Returns A=0/C=0 or A=1/C=1.
; X bit 7 is ignored here; Y bit 7 still selects the buffer.
;*******************************************************************************
QR_GET
              JSR   QR_ADDR
              AND   (QRPTRL),Y
              BEQ   QR_GET_ZERO
              LDA   #$01
              SEC
              RTS

QR_GET_ZERO
              LDA   #$00
              CLC
              RTS

;*******************************************************************************
; QR_DRAW_MODULE
; Reads one logical bit and paints a 2 x 2 physical HGR patch.
;
; The X lookup tables provide:
;   - HGR byte offset within a scan line
;   - mask in that byte
;   - spill mask in the following byte
;
; Bit 7 of HGR memory is never changed, avoiding phase changes at byte edges.
;*******************************************************************************
QR_DRAW_MODULE
              JSR   QR_GET
              BEQ   QR_DM_BLACK
              LDA   #$FF
              BNE   QR_DM_COLOR
QR_DM_BLACK
              LDA   #$00
QR_DM_COLOR
              STA   QRPIXEL

              LDA   QRXARG
              AND   #$7F
              TAX
              LDA   XBYTE,X
              STA   QRXBYTE
              LDA   XMASK0,X
              STA   QRMASK0
              LDA   XMASK1,X
              STA   QRMASK1

              LDA   QRYARG
              AND   #$7F
              ASL
              STA   QRSCREENY
              TAX
              JSR   QR_HGR_PTR
              JSR   QR_PAINT_ROW

              LDX   QRSCREENY
              INX
              JSR   QR_HGR_PTR
              JSR   QR_PAINT_ROW
              RTS

;*******************************************************************************
; QR_HGR_PTR
; X = physical HGR Y coordinate (0..159).
; Returns HGRPTRL/HGRPTRH pointing to the start of that scan line.
; Preserves X.
;*******************************************************************************
QR_HGR_PTR
              LDA   YLOOKL,X
              STA   HGRPTRL
              LDA   YLOOKH,X
              STA   HGRPTRH
              RTS

;*******************************************************************************
; QR_PAINT_ROW
; Paints or clears the two horizontal pixels on one HGR scan line.
; QRPIXEL=0 clears them; QRPIXEL<>0 sets them.
; The second-byte operation is harmless when QRMASK1=0.
;*******************************************************************************
QR_PAINT_ROW
              LDY   QRXBYTE
              LDA   QRPIXEL
              BEQ   QR_PR_CLEAR

QR_PR_SET
              LDA   (HGRPTRL),Y
              ORA   QRMASK0
              STA   (HGRPTRL),Y
              INY
              LDA   (HGRPTRL),Y
              ORA   QRMASK1
              STA   (HGRPTRL),Y
              RTS

QR_PR_CLEAR
              LDA   QRMASK0
              EOR   #$FF
              AND   (HGRPTRL),Y
              STA   (HGRPTRL),Y
              INY
              LDA   QRMASK1
              EOR   #$FF
              AND   (HGRPTRL),Y
              STA   (HGRPTRL),Y
              RTS

;*******************************************************************************
; QR_RENDER
; Paints all 80 x 80 logical coordinates.
; Input A=0 selects QRBUF0; A=1 selects QRBUF1.
;*******************************************************************************
QR_RENDER
              AND   #$01
              BEQ   QR_RE_BUF0
              LDA   #$80
              BNE   QR_RE_SEL
QR_RE_BUF0
              LDA   #$00
QR_RE_SEL
              STA   QRBUFSEL

              LDA   #$00
              STA   QRLOOPY

QR_RE_ROW
              LDA   #$00
              STA   QRLOOPX

QR_RE_COL
              LDX   QRLOOPX
              LDA   QRLOOPY
              ORA   QRBUFSEL
              TAY
              JSR   QR_DRAW_MODULE

              INC   QRLOOPX
              LDA   QRLOOPX
              CMP   #80
              BNE   QR_RE_COL

              INC   QRLOOPY
              LDA   QRLOOPY
              CMP   #80
              BNE   QR_RE_ROW
              RTS

;*******************************************************************************
; Call examples
;
; Set buffer 0, coordinate (12,34):
;              LDX   #$80+12
;              LDY   #34
;              JSR   QR_PUT
;
; Clear buffer 1, coordinate (12,34):
;              LDX   #12
;              LDY   #$80+34
;              JSR   QR_PUT
;
; Read buffer 1, coordinate (12,34):
;              LDX   #12
;              LDY   #$80+34
;              JSR   QR_GET
;
; Render buffer 0:
;              LDA   #0
;              JSR   QR_RENDER
;*******************************************************************************

; Bit mask indexed by X & 7.
BITMASK    HEX   0102040810204080

; QRBUF0 + Y*10, low bytes, 80 entries.
QRROWL     HEX   000A141E28323C46505A646E78828C96
           HEX   A0AAB4BEC8D2DCE6F0FA040E18222C36
           HEX   404A545E68727C86909AA4AEB8C2CCD6
           HEX   E0EAF4FE08121C26303A444E58626C76
           HEX   808A949EA8B2BCC6D0DAE4EEF8020C16

; QRBUF0 + Y*10, high bytes, 80 entries.
QRROWH     HEX   70707070707070707070707070707070
           HEX   70707070707070707070717171717171
           HEX   71717171717171717171717171717171
           HEX   71717171727272727272727272727272
           HEX   72727272727272727272727272737373

; Centered 2-pixel modules: floor((60 + 2*X) / 7), 80 entries.
XBYTE      HEX   08080909090A0A0A0A0B0B0B0C0C0C0C
           HEX   0D0D0D0E0E0E0E0F0F0F101010101111
           HEX   11121212121313131414141415151516
           HEX   161616171717181818181919191A1A1A
           HEX   1A1B1B1B1C1C1C1C1D1D1D1E1E1E1E1F

; Low-seven-bit mask in the first HGR byte, 80 entries.
XMASK0     HEX   3040061860030C3040061860030C3040
           HEX   061860030C3040061860030C30400618
           HEX   60030C3040061860030C304006186003
           HEX   0C3040061860030C3040061860030C30
           HEX   40061860030C3040061860030C304006

; Spill mask in the next HGR byte, 80 entries.
XMASK1     HEX   00010000000000000100000000000001
           HEX   00000000000001000000000000010000
           HEX   00000000010000000000000100000000
           HEX   00000100000000000001000000000000
           HEX   01000000000000010000000000000100

; HGR page-1 scan-line addresses, low bytes, 192 entries.
YLOOKL     HEX   00000000000000008080808080808080
           HEX   00000000000000008080808080808080
           HEX   00000000000000008080808080808080
           HEX   00000000000000008080808080808080
           HEX   2828282828282828A8A8A8A8A8A8A8A8
           HEX   2828282828282828A8A8A8A8A8A8A8A8
           HEX   2828282828282828A8A8A8A8A8A8A8A8
           HEX   2828282828282828A8A8A8A8A8A8A8A8
           HEX   5050505050505050D0D0D0D0D0D0D0D0
           HEX   5050505050505050D0D0D0D0D0D0D0D0
           HEX   5050505050505050D0D0D0D0D0D0D0D0
           HEX   5050505050505050D0D0D0D0D0D0D0D0

; HGR page-1 scan-line addresses, high bytes, 192 entries.
YLOOKH     HEX   2024282C3034383C2024282C3034383C
           HEX   2125292D3135393D2125292D3135393D
           HEX   22262A2E32363A3E22262A2E32363A3E
           HEX   23272B2F33373B3F23272B2F33373B3F
           HEX   2024282C3034383C2024282C3034383C
           HEX   2125292D3135393D2125292D3135393D
           HEX   22262A2E32363A3E22262A2E32363A3E
           HEX   23272B2F33373B3F23272B2F33373B3F
           HEX   2024282C3034383C2024282C3034383C
           HEX   2125292D3135393D2125292D3135393D
           HEX   22262A2E32363A3E22262A2E32363A3E
           HEX   23272B2F33373B3F23272B2F33373B3F
