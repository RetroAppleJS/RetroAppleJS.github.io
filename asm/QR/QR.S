; LAST BUILD 11-MAR-2025
ORG $4000

BT_AD1      = $06
BT_AD2      = $07
BT_IN1      = $08   ; Index1
;BT_IN2     = $09   ; Index2
TEMPL       = $1D
TEMPH       = $1E

MON.COUT    = $FDED   ; print char
MON.CROUT   = $FD8E;  ; print CR
MON.PRBYTE  = $FDDA   ; print hex byte
MON.CRDO    = $DAFB   ; line feed
MON.OUTSP   = $DB57   ; Space
MON.STROUT  = $DB3A   ; Print string pointed to by Y,A. The string must end with a zero or a quote.
MON.KPRESS  = $FD35
MON.REGDSP  = $FAD7   ; Register dump

        JMP PRTLBL

;*** MAIN LOOP ***
M_INIT  LDA #$28
        STA TYPNUM
        LDA #$03
        STA ERRCOR

MAIN    JSR GETBT      ; get blocktable
        JSR BLTAB_D    ; dump blocktable
        JSR LSPUSH
        JSR MAIN_D     ; dump main variables
        RTS
;******************


LSPUSH  LDA #<LISTBUF
        STA *TEMPL
        LDA #>LISTBUF
        STA *TEMPH

        LDY #$00
        LDA BT_BUF
        BEQ LSP.01      ; skip if first element of BT_BUF = 0
        ASL A           ; multiply by 2
        STA LSTLN1     ; paste length
        STA LISTLN

LSP.00  LDA BT_BUF+1
        STA (TEMPL),Y
        INY
        LDA BT_BUF+2
        STA (TEMPL),Y
        INY
        CPY LISTLN
        BNE LSP.00

LSP.01  LDA BT_BUF+3
        ASL A         ; multiply by 2
        CLC
        STA LSTLN2
        ADC LSTLN1     ; add previous length
        STA LISTLN     ; paste length

LSP.02  LDA BT_BUF+4
        STA (TEMPL),Y
        INY
        LDA BT_BUF+5
        STA (TEMPL),Y
        INY
        CPY LISTLN
        BNE LSP.02
        RTS


;*** BLOCKTABLE LOOKUP WITH Y=Typemumber (1-40), A=ErrorCorrection (0)M - (1)L - (2)H - (3)Q
GETBT   LDY TYPNUM          ; load typenumber
        DEY                 ; minus 1
        TYA
        ASL A
        ASL A               ; multiply by 4
        CLC
        ADC ERRCOR          ; plus error correction
        STA *BT_IN1         ; = index for blocktable lookup

BTINIT  LDA #$00
        LDY #$FF            ; BLOCKTABLE LOOKUP WITH index *BT_IN1
        STY I1_LST
BT.00   INY
        CPY #00
        BNE BT.01
        JSR BTREAD
        STA BT_BUF
        INY
        JSR BTREAD
        STA BT_BUF+3
        INY
BT.01   JSR BTREAD
        STA BT_BUF+2,Y
        SEC
        SBC #$01
        STA BT_BUF-1,Y
        CPY #$03
        BNE BT.00
        RTS

BTREAD  LDA *BT_IN1          ; load index1
        CMP I1_LST           ; read value in blocktable where A=index1 Y=index2
        BEQ BT.02            ; skip if index1 remained unchanged
        STA I1_LST           ; save last used index1
        JSR BTCALC           ; calculate block table address from A=index1
BT.02   CLC
        LDA (BT_AD1),Y       ; load indexed array element (with carry)
        RTS

BTMUL   HEX 0000             ; result of A * 4 (LLHH)
BTCALC  LDA #$00             ; block table address calculator with A=index1, result in *BT_AD1 & *BT_AD2
        STA BTMUL+1
        LDA I1_LST           ; calculate block table low byte address from A
        ASL A                ; multiply by 2
        ROL BTMUL+1
        ASL A                ; multiply by 4
        STA BTMUL
        ROL BTMUL+1
        ADC #<BT_TBL         ; ADD address in BT_AD1 & BT_AD2 to BTMUL
        STA *BT_AD1          ; >> store low byte of BT_TBL address
        LDA BTMUL+1
        ADC #>BT_TBL
        STA *BT_AD2          ; >> store high byte of BT_TBL address
        RTS

; *** QR PARAMETERS ***
TYPNUM  HEX 00               ; (1-40)
ERRCOR  HEX 00               ; (0)M - (1)L - (2)H - (3)Q
QRMODE  HEX 00               ; (1)NUMBER - (2)ALPHA_NUM - (4)8-BIT_BYTE - (8)KANJI
TEXT    ASC "HERE COMES QR!"

; *********************

; *** VARIABLES ***
I1_LST  HEX 00               ; last used index1
I2_ORG  HEX 00               ; origin of index2
BT_BUF  HEX 000000000000     ; index2 origin + result data buffer (4 arrays)
OV_FLG  HEX 40               ; triggers overflow flag = 1
BT_MAX  HEX 03               ; block table array length - 1

; *********************


; *** BLOCK TABLE DATA ***
BT_TBL  HEX 00011A13 ;0 0000 - 1 - $01
        HEX 00011A10 ;1 0004
        HEX 00011A0D ;2 0008
        HEX 00011A09 ;3 000C

        HEX 00012C22 ;4 0010 - 2 - $02
        HEX 00012C1C ;5 0014
        HEX 00012C16 ;6 0018
        HEX 00012C10 ;7 001C

        HEX 00014637 ;8 0020 - 3 - $03
        HEX 0001462C ;9 0024
        HEX 00022311 ;a 0028
        HEX 0002230D ;b 002C

        HEX 00016450 ;c 0030 - 4 - $04
        HEX 00023220 ;d 0034
        HEX 00023218 ;e 0038
        HEX 00041909 ;f 003C

        HEX 0001866C ;10 0040 - 5 - $05
        HEX 0002432B ;11 0044
        HEX 02022210 ;12 0048
        HEX 0202220C ;13 004C

        HEX 00025644 ;14 0050 - 6 - $06
        HEX 00042B1B ;15 0054
        HEX 00042B13 ;16 005
        HEX 00042B0F ;17 005

        HEX 0002624E ;18 0060 - 7 - $07
        HEX 0004311F ;19 0064
        HEX 0204210F ;1a 006
        HEX 0401280E ;1b 006

        HEX 00027961 ;1c 0070 - 8 - $08
        HEX 02023D27 ;1d 0074
        HEX 04022913 ;1e 007
        HEX 0402290F ;1f 007

        HEX 00029274 ;20 0080 - 9 - $09
        HEX 03023B25 ;21 0084
        HEX 04042511 ;22 008
        HEX 0404250D ;23 008

        HEX 02025745 ;24 0090 - 10 - $0A
        HEX 0401462C ;25 0094
        HEX 06022C14 ;26 009
        HEX 06022C10 ;27 009

        HEX 00046551 ;28 00A0 - 11 - $0B
        HEX 01045133 ;29 00A4
        HEX 04043317 ;2a 00A
        HEX 0308250D ;2b 01A

        HEX 0202755D ;2c 00B0 - 12 - $0C
        HEX 06023B25 ;2d 00B4
        HEX 04062F15 ;2e 00B8
        HEX 07042B0F ;2f 00BC

        HEX 0004856B ;30 00C0 - 13 - $0D
        HEX 08013C26 ;31 00C4
        HEX 08042D15 ;32 00C8
        HEX 0C04220C ;33 00C8

        HEX 03019274 ;34 00D0 - 14 - $0E
        HEX 04054129 ;35 00D4
        HEX 0B052511 ;36 00D8
        HEX 0B05250D ;37 00DC

        HEX 05016E58 ;38 00E0 - 15 - $0F
        HEX 0505422A ;39 00E4
        HEX 05073719 ;3a 00E8
        HEX 0B07250D ;3b 00EC

        HEX 05017B63 ;3c 00F0 - 16 - $10
        HEX 07034A2E ;3d 00F4
        HEX 0F022C14 ;3e 00F8
        HEX 030D2E10 ;3f 00FC

        HEX 0105886C ;40 0100 - 17 - $11
        HEX 0A014B2F ;41 0104
        HEX 010F3317 ;42 0108
        HEX 02112B0F ;43 010C

        HEX 05019779 ;44 0110 - 18 - $12
        HEX 0904462C ;45 0114
        HEX 11013317 ;46 0118
        HEX 02132B0F ;47 011C

        HEX 03048E72 ;48 0120 - 19 - $13
        HEX 030B472D ;49 0120
        HEX 11043016 ;4a 0120
        HEX 0910280E ;4b 0120

        HEX 0305886C ;4c 0130 - 20 - $14
        HEX 030D442A ;4d 0130
        HEX 0F053719 ;4e 0130
        HEX 0F0A2C10 ;4f 0130

        HEX 04049175 ;50 0140 - 21 - $15
        HEX 0011442A ;51 0140
        HEX 11063317 ;52 0140
        HEX 13062F11 ;53 0140

        HEX 02078C70 ;54 0150 - 22 - $16
        HEX 00114A2E ;55 0150
        HEX 07103719 ;56 0150
        HEX 0022250D ;57 0150

        HEX 0405987A ;58 0160 - 23 - $17
        HEX 040E4C30 ;59 0160
        HEX 0B0E3719 ;5a 0160
        HEX 100E2E10 ;5b 0160

        HEX 06049476 ;5c 0170 - 24 - $18
        HEX 060E4A2E ;5d 0170
        HEX 0B103719 ;5e 0170
        HEX 1E022F11 ;5f 0170

        HEX 0804856B ;60 0180 - 25 - $19
        HEX 080D4C30 ;61 0180
        HEX 07163719 ;62 0180
        HEX 160D2E10 ;63 0180

        HEX 0A028F73 ;64 0190 - 26 - $1A
        HEX 13044B2F ;65 0190
        HEX 1C063317 ;66 0190
        HEX 21042F11 ;67 0190

        HEX 0804997B ;68 01A0 - 27 - $1B
        HEX 16034A2E ;69 01A0
        HEX 081A3618 ;6a 01A0
        HEX 0C1C2E10 ;6b 01A0

        HEX 030A9476 ;6c 01B0 - 28 - $1C
        HEX 03174A2E ;6d 01B0
        HEX 041F3719 ;6e 01B0
        HEX 0B1F2E10 ;6f 01B0

        HEX 07079375 ;70 01C0 - 29 - $1D
        HEX 15074A2E ;71 01C0
        HEX 01253618 ;72 01C0
        HEX 131A2E10 ;73 01C0

        HEX 050A9274 ;74 01D0 - 30 - $1E
        HEX 130A4C30 ;75 01D0
        HEX 0F193719 ;76 01D0
        HEX 17192E10 ;77 01D0

        HEX 0D039274 ;78 01E0 - 31 - $1F
        HEX 021D4B2F ;79 01E0
        HEX 2A013719 ;7a 01E0
        HEX 171C2E10 ;7b 01E0

        HEX 00119173 ;7c 01F0 - 32 - $20
        HEX 0A174B2F ;7d 01F0
        HEX 0A233719 ;7e 01F0
        HEX 13232E10 ;7f 01F0

        HEX 11019274 ;80 0200 - 33 - $21
        HEX 0E154B2F ;81 0204
        HEX 1D133719 ;82 0208
        HEX 0B2E2E10 ;83 020C

        HEX 0D069274 ;84 0210 - 34 - $22
        HEX 0E174B2F ;85 0210
        HEX 2C073719 ;86 0210
        HEX 3B012F11 ;87 0210

        HEX 0C07987A ;88 0220 - 35 - $23
        HEX 0C1A4C30 ;89 0220
        HEX 270E3719 ;8a 0220
        HEX 16292E10 ;8b 0220

        HEX 060E987A ;8c 0230 - 36 - $24
        HEX 06224C30 ;8d 0230
        HEX 2E0A3719 ;8e 0230
        HEX 02402E10 ;8f 0230

        HEX 1104997B ;90 0240 - 37 - $25
        HEX 1D0E4B2F ;91 0240
        HEX 310A3719 ;92 0240
        HEX 182E2E10 ;93 0240

        HEX 0412997B ;94 0250 - 38 - $26
        HEX 0D204B2F ;95 0250
        HEX 300E3719 ;96 0250
        HEX 2A202E10 ;97 0250

        HEX 14049476 ;98 0260 - 39 - $27
        HEX 28074C30 ;99 0260
        HEX 2B163719 ;9a 0260
        HEX 0A432E10 ;9b 0260

        HEX 13069577 ;9c 0270 - 40 - $28
        HEX 121F4C30 ;9d 0270
        HEX 22223719 ;9e 0270
        HEX 143D2E10 ;9f 0270



LSTLN1 HEX 00
LSTLN2 HEX 00
LISTLN HEX 00
LISTBUF HEX 00000000000000000000000000000000 ;10
        HEX 00000000000000000000000000000000 ;20
        HEX 00000000000000000000000000000000 ;30
        HEX 00000000000000000000000000000000 ;40
        HEX 00000000000000000000000000000000 ;50
        HEX 00000000000000000000000000000000 ;60
        HEX 00000000000000000000000000000000 ;70
        HEX 00000000000000000000000000000000 ;80
        HEX 00000000000000000000000000000000 ;90
        HEX 00000000000000000000000000000000 ;A0
        HEX 00000000000000000000000000000000 ;B0

ORG $4500
MO_CNT  HEX 15
QR_BUF  HEX FF15FC
        HEX C10504
        HEX DDD1F4
        HEX DD05F4
        HEX DD25F4
        HEX C13904
        HEX FFD5FC
        HEX 00D000
        HEX F7D710
        HEX E03D08
        HEX EDD7FC
        HEX C83CC8
        HEX 13F530
        HEX 00C028
        HEX FFCFCC
        HEX C1E0CC
        HEX DDC7D8
        HEX DD2208
        HEX DDDEF4
        HEX C1EA28
        HEX FFD4CC

;*** PRINT LABELS ***
PRTLBL  LDA #$08
        JSR ISTROUT     ; Print string from A = index
        LDA #>M_INIT
        LDY #<M_INIT
        JSR PRTADR
        JSR MON.CRDO

        LDA #$00
        JSR ISTROUT     ; Print string from A = index
        LDA #>MAIN
        LDY #<MAIN
        JSR PRTADR
        JSR MON.CRDO

        LDA #$01
        JSR ISTROUT     ; Print string from A = index
        LDA #>GETBT
        LDY #<GETBT
        JSR PRTADR
        JSR MON.CRDO

        LDA #$02
        JSR ISTROUT     ; Print string from A = index
        LDA #>BLTAB_D
        LDY #<BLTAB_D
        JSR PRTADR
        JSR MON.CRDO

        LDA #$03
        JSR ISTROUT     ; Print string from A = index
        LDA #>LSPUSH
        LDY #<LSPUSH
        JSR PRTADR
        JSR MON.CRDO

        LDA #$07
        JSR ISTROUT     ; Print string from A = index
        LDA #>MAIN_D
        LDY #<MAIN_D
        JSR PRTADR
        JSR MON.CRDO

        LDA #$09
        JSR ISTROUT     ; Print string from A = index
        LDA #>BTDEBUG
        LDY #<BTDEBUG
        JSR PRTADR
        JSR MON.CRDO

        RTS
;**********************


;*** MAIN VARIABLES DUMP ***
MAIN_D  JSR REGSAVE

        LDA #>TYPNUM
        LDY #<TYPNUM
        JSR PRTADR
        LDA #$05
        JSR ISTROUT     ; Print string from A = index
        LDA TYPNUM
        JSR MON.PRBYTE  ; Print byte
        JSR MON.OUTSP

        LDA #>ERRCOR
        LDY #<ERRCOR
        JSR PRTADR
        LDA #$06
        JSR ISTROUT     ; Print string from A = index
        LDA ERRCOR
        JSR MON.PRBYTE  ; Print byte
        JSR MON.OUTSP

        LDA #$04
        JSR ISTROUT     ; Print string from A = index
        LDA LISTLN
        JSR MON.PRBYTE  ; Print byte
        JSR MON.OUTSP

        JSR REGLOAD
        RTS
;**********************

; *** PRINT ADDRESS by Y,A ***
PRTADR  JSR MON.PRBYTE
        TYA
        JSR MON.PRBYTE
        RTS

; *** PRINT STRING from Y = INDEX ***
ISTROUT LDY #<STR.00    ; init pointer
        STY *TEMPL
        LDY #>STR.00    ; init pointer
        STY *TEMPH
        LDY #$00
        TAX             ; X = array index
        BEQ IST.2
        DEY
IST.1   INY
        LDA (TEMPL),Y
        BNE IST.1
        DEX
        BNE IST.1
        INY             ; Y = found starting index
IST.2   LDA (TEMPL),Y   ; Print string until next zero
        BEQ IST.3
        JSR MON.COUT
        INY
        BNE IST.2
IST.3   RTS

; *** SAVE/LOAD REGISTERS ***
REG_BUF HEX 00000000  ; A X Y P
REGSAVE STA REG_BUF
        STX REG_BUF+1
        STY REG_BUF+2
        PHP
        PLA
        STA REG_BUF+3
        LDA REG_BUF
        RTS

REGLOAD LDA REG_BUF
        LDX REG_BUF+1
        LDY REG_BUF+2
        LDA REG_BUF+3
        PHA
        PLP
        RTS

; *** STRING DATA ***
STR.00  ASC "MAIN:"     ;0
        HEX 00
        ASC "GETBT:"    ;1
        HEX 00
        ASC "BLTAB_D:"  ;2
        HEX 00
        ASC "LSPUSH:"   ;3
        HEX 00
        ASC "L="        ;4
        HEX 00
        ASC ".TYP="     ;5
        HEX 00
        ASC ".COR="     ;6
        HEX 00
        ASC "MAIN_D:"   ;7
        HEX 00
        ASC "M_INIT:"   ;8
        HEX 00
        ASC "BTDEBUG:"  ;9
        HEX 00


; *** DEBUG ROUTINES ***
BTDEBUG LDX #$FF

BTD.01  INX
        TXA
        STA *BT_IN1
        JSR BTINIT
        JSR BLTAB_D
        JSR MON.KPRESS     ; wait for keypress
        CPX #$9F
        BNE BTD.01
        RTS

BLTAB_D LDA *BT_IN1        ; print index1
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDY *BT_AD1
        LDA *BT_AD2
        JSR PRTADR
        JSR MON.OUTSP      ; space

        LDA BT_BUF
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDA BT_BUF+1
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDA BT_BUF+2
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDA BT_BUF+3
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDA BT_BUF+4
        JSR MON.PRBYTE
        JSR MON.OUTSP      ; space

        LDA BT_BUF+5
        JSR MON.PRBYTE
        LDA #$8D           ; line feed
        JSR MON.COUT
        RTS


; *** END BTDEB ROUTINE ***
