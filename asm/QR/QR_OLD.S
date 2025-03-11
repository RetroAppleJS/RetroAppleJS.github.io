; LAST BUILD 11-MAR-2025

ORG $4000

BT_AD1      EQU $06
BT_AD2      EQU $07
BT_IN1      EQU $08   ; Index1
BT_IN2      EQU $09   ; Index2
TEMP        EQU $1D
TEMPH       EQU $1E

MON.COUT    EQU $FDED   ; print char
MON.PRBYTE  EQU $FDDA   ; print hex byte
MON.CRDO    EQU $DAFB   ; line feed
MON.OUTSP   EQU $DB57   ; Space
MON.STROUT  EQU $DB3A   ; Print string pointed to by Y,A. The string must end with a zero or a quote.
MON.KPRESS  EQU $FD35

        LDA #$08
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

;*** MAIN LOOP ***
M_INIT  LDA #$27
        STA TYPNUM
        LDA #$03
        STA ERRCOR

MAIN    JSR GETBT      ; get blocktable
        JSR BLTAB_D    ; dump blocktable
        JSR LSPUSH
        JSR MAIN_D     ; dump main variables
        RTS
;******************

LSLEN   HEX 00
LSPUSH  LDA I2_ORG      ; calculate loop length from I2_ORG
        TAY
        LDA (BT_AD1),Y
        STA LSLEN       ; stored only for debugging
        RTS

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
        LDA LSLEN
        JSR MON.PRBYTE  ; Print byte
        JSR MON.OUTSP

        JSR REGLOAD
        RTS

;*** BLOCKTABLE LOOKUP WITH Y=Typemumber (1-40), A=ErrorCorrection (0)L - (1)M - (2)Q - (3)H
GETBT   LDY TYPNUM          ; load typenumber
        DEY                 ; minus 1
        TYA
        ASL A
        ASL A               ; multiply by 4
        CLC
        ADC ERRCOR          ; plus error correction
        STA *BT_IN1         ; = index for blocktable lookup

BTINIT  LDA #$00
        STA *BT_IN2
        LDY #$FF             ; BLOCKTABLE LOOKUP WITH index *BT_IN1
        STY I1_LST
        STY I2_ORG
        INY
        STY *BT_IN2

BTMAIN  LDA *BT_IN1          ; iterate through index2
        LDY *BT_IN2
        JSR BTREAD           ; lookup blocktable A=index1 Y=index2 until carry is set
        STA BT_BUF,Y         ; store A (result) in BT_BUF (not really necessary)
        INC *BT_IN2
        BVC BTMAIN           ; loop as long as overflow flag = 0
        RTS

BTREAD  CMP I1_LST           ; read value in blocktable where A=index1 Y=index2
        BEQ BT.01            ; skip if index1 remained unchanged
        STA I1_LST           ; save last used index1
        LDY #$FF
        STY I2_ORG           ; when index1 is not the same, reset index2 origin
        JSR BTCALC           ; calculate block table address from A=index1
BT.01   LDY *BT_IN2
        CLV                  ; clear overflow flag
        JMP BT.03
BT.02   INY                  ; set origin index2 when result <> 0 and Y<6 and origin = 0
BT.03   CLC
        LDA (BT_AD1),Y       ; load indexed array element (with carry)
        CPY BT_MAX
        BNE BT.04            ; skip if Y <= BT_MAX
        BIT OV_FLG           ; set overflow flag
        JMP BT.05
BT.04   CMP #$00
        BEQ BT.02            ; if A=0, loop back and increment Y
BT.05   STY *BT_IN2          ; store index2 in argument (remember for next call)
        LDY I2_ORG
        CPY #$FF             ; is index2 origin = FF ?
        BNE BT.06            ; skip if index2 origin = FF
        LDY *BT_IN2          ; reload index2 argument
        STY I2_ORG           ; store index2 origin when result <> 0 and Y<6 and origin = 0
BT.06   LDY *BT_IN2          ; Returns A = result, Y = index2 and overflow flag set if end of loop
        RTS


BTCALC  SEC                  ; block table address calculator with A=index1, result in *BT_AD1 & *BT_AD2
        SBC #$80             ; 128
        BMI BT.07
        LDY #$03
        JMP BT.10
BT.07   LDA I1_LST
        SEC
        SBC #$56             ; 86
        BMI BT.08
        LDY #$02
        JMP BT.10
BT.08   LDA I1_LST
        SEC
        SBC #$2B             ; 43
        BMI BT.09
        LDY #$01
        JMP BT.10
BT.09   LDY #$00
BT.10   LDA I1_LST           ; calculate block table low byte address from A
        ASL A                ; multiply by 2
        STA *TEMP
        ASL A                ; multiply by 4
        CLC
        ADC *TEMP            ; = multiply by 6
        CLC
        ADC #<BT_TBL         ; low byte of BT_TBL address
        STA *BT_AD1          ; >> store low byte of BT_TBL address
        TYA
        ADC #>BT_TBL
        STA *BT_AD2          ; >> store high byte of BT_TBL address
        RTS


; *** QR PARAMETERS ***
TYPNUM  HEX 00               ; (1-40)
ERRCOR  HEX 00               ; (0)L - (1)M - (2)Q - (3)H
; *********************

; *** VARIABLES ***
I1_LST  HEX 00               ; last used index1
I2_ORG  HEX 00               ; origin of index2
BT_BUF  HEX 000000000000     ; index2 origin + result data buffer (4 arrays)
OV_FLG  HEX 40               ; triggers overflow flag = 1
BT_MAX  HEX 05               ; block table array length - 1
; *********************

; *** BLOCK TABLE DATA ***

;  IF LEN>0
;  first array =

BT_TBL  HEX 000000011A13 ;0 0000 - 1 - $01
        HEX 000000011A10 ;1 0006
        HEX 000000011A0D ;2 000c
        HEX 000000011A09 ;3 0012

        HEX 000000012C22 ;4 0018 - 2 - $02
        HEX 000000012C1C ;5 001e
        HEX 000000012C16 ;6 0024
        HEX 000000012C10 ;7 002a

        HEX 000000014637 ;8 0030 - 3 - $03
        HEX 00000001462C ;9 0036
        HEX 000000022311 ;a 003c
        HEX 00000002230D ;b 0042

        HEX 000000016450 ;c 0048 - 4 - $04
        HEX 000000023220 ;d 004e
        HEX 000000023218 ;e 0054
        HEX 000000041909 ;f 005a

        HEX 00000001866C ;10 0060 - 5 - $05
        HEX 00000002432B ;11 0066
        HEX 02210F022210 ;12 006c
        HEX 02210B02220C ;13 0072

        HEX 000000025644 ;14 0078 - 6 - $06
        HEX 000000042B1B ;15 007e
        HEX 000000042B13 ;16 0084
        HEX 000000042B0F ;17 008a

        HEX 00000002624E ;18 0090 - 7 - $07
        HEX 00000004311F ;19 0096
        HEX 02200E04210F ;1a 009c
        HEX 04270D01280E ;1b 00a2

        HEX 000000027961 ;1c 00a8 - 8 - $08
        HEX 023C26023D27 ;1d 00ae
        HEX 042812022913 ;1e 00b4
        HEX 04280E02290F ;1f 00ba

        HEX 000000029274 ;20 00c0 - 9 - $09
        HEX 033A24023B25 ;21 00c6
        HEX 042410042511 ;22 00cc
        HEX 04240C04250D ;23 00d2

        HEX 025644025745 ;24 00d8 - 10 - $0A
        HEX 04452B01462C ;25 00de
        HEX 062B13022C14 ;26 00e4
        HEX 062B0F022C10 ;27 00ea

        HEX 000000046551 ;28 00f0 - 11 - $0B
        HEX 015032045133 ;29 00f6
        HEX 043216043317 ;2a 00fc
        HEX 03240C08250D ;2b 0102

        HEX 02745C02755D ;2c 0108 - 12 - $0C
        HEX 063A24023B25 ;2d 010e
        HEX 042E14062F15 ;2e 0114
        HEX 072A0E042B0F ;2f 011a

        HEX 00000004856B ;30 0120 - 13 - $0D
        HEX 083B25013C26 ;31 0126
        HEX 082C14042D15 ;32 012c
        HEX 0C210B04220C ;33 0132

        HEX 039173019274 ;34 0138 - 14 - $0E
        HEX 044028054129 ;35 013e
        HEX 0B2410052511 ;36 0144
        HEX 0B240C05250D ;37 014a

        HEX 056D57016E58 ;38 0150 - 15 - $0F
        HEX 05412905422A ;39 0156
        HEX 053618073719 ;3a 015c
        HEX 0B240C07250D ;3b 0162

        HEX 057A62017B63 ;3c 0168 - 16 - $10
        HEX 07492D034A2E ;3d 016e
        HEX 0F2B13022C14 ;3e 0174
        HEX 032D0F0D2E10 ;3f 017a

        HEX 01876B05886C ;40 0180 - 17 - $11
        HEX 0A4A2E014B2F ;41 0186
        HEX 0132160F3317 ;42 018c
        HEX 022A0E112B0F ;43 0192

        HEX 059678019779 ;44 0198 - 18 - $12
        HEX 09452B04462C ;45 019e
        HEX 113216013317 ;46 01a4
        HEX 022A0E132B0F ;47 01aa

        HEX 038D71048E72 ;48 01b0 - 19 - $13
        HEX 03462C0B472D ;49 01b6
        HEX 112F15043016 ;4a 01bc
        HEX 09270D10280E ;4b 01c2

        HEX 03876B05886C ;4c 01c8 - 20 - $14
        HEX 0343290D442A ;4d 01ce
        HEX 0F3618053719 ;4e 01d4
        HEX 0F2B0F0A2C10 ;4f 01da

        HEX 049074049175 ;50 01e0 - 21 - $15
        HEX 00000011442A ;51 01e6
        HEX 113216063317 ;52 01ec
        HEX 132E10062F11 ;53 01f2

        HEX 028B6F078C70 ;54 01f8 - 22 - $16
        HEX 000000114A2E ;55 01fe
        HEX 073618103719 ;56 0204
        HEX 00000022250D ;57 020a

        HEX 04977905987A ;58 0210 - 23 - $17
        HEX 044B2F0E4C30 ;59 0216
        HEX 0B36180E3719 ;5a 021c
        HEX 102D0F0E2E10 ;5b 0222

        HEX 069375049476 ;5c 0228 - 24 - $18
        HEX 06492D0E4A2E ;5d 022e
        HEX 0B3618103719 ;5e 0234
        HEX 1E2E10022F11 ;5f 023a

        HEX 08846A04856B ;60 0240 - 25 - $19
        HEX 084B2F0D4C30 ;61 0246
        HEX 073618163719 ;62 024c
        HEX 162D0F0D2E10 ;63 0252

        HEX 0A8E72028F73 ;64 0258 - 26 - $1A
        HEX 134A2E044B2F ;65 025e
        HEX 1C3216063317 ;66 0264
        HEX 212E10042F11 ;67 026a

        HEX 08987A04997B ;68 0270 - 27 - $1B
        HEX 16492D034A2E ;69 0276
        HEX 0835171A3618 ;6a 027c
        HEX 0C2D0F1C2E10 ;6b 0282

        HEX 0393750A9476 ;6c 0288 - 28 - $1C
        HEX 03492D174A2E ;6d 028e
        HEX 0436181F3719 ;6e 0294
        HEX 0B2D0F1F2E10 ;6f 029a

        HEX 079274079375 ;70 02a0 - 29 - $1D
        HEX 15492D074A2E ;71 02a6
        HEX 013517253618 ;72 02ac
        HEX 132D0F1A2E10 ;73 02b2

        HEX 0591730A9274 ;74 02b8 - 30 - $1E
        HEX 134B2F0A4C30 ;75 02be
        HEX 0F3618193719 ;76 02c4
        HEX 172D0F192E10 ;77 02ca

        HEX 0D9173039274 ;78 02d0 - 31 - $1F
        HEX 024A2E1D4B2F ;79 02d6
        HEX 2A3618013719 ;7a 02dc
        HEX 172D0F1C2E10 ;7b 02e2

        HEX 000000119173 ;7c 02e8 - 32 - $20
        HEX 0A4A2E174B2F ;7d 02ee
        HEX 0A3618233719 ;7e 02f4
        HEX 132D0F232E10 ;7f 02fa

        HEX 119173019274 ;80 0300 - 33 - $21
        HEX 0E4A2E154B2F ;81 0306
        HEX 1D3618133719 ;82 030c
        HEX 0B2D0F2E2E10 ;83 0312

        HEX 0D9173069274 ;84 0318 - 34 - $22
        HEX 0E4A2E174B2F ;85 031e
        HEX 2C3618073719 ;86 0324
        HEX 3B2E10012F11 ;87 032a

        HEX 0C977907987A ;88 0330 - 35 - $23
        HEX 0C4B2F1A4C30 ;89 0336
        HEX 2736180E3719 ;8a 033c
        HEX 162D0F292E10 ;8b 0342

        HEX 0697790E987A ;8c 0348 - 36 - $24
        HEX 064B2F224C30 ;8d 034e
        HEX 2E36180A3719 ;8e 0354
        HEX 022D0F402E10 ;8f 035a

        HEX 11987A04997B ;90 0360 - 37 - $25
        HEX 1D4A2E0E4B2F ;91 0366
        HEX 3136180A3719 ;92 036c
        HEX 182D0F2E2E10 ;93 0372

        HEX 04987A12997B ;94 0378 - 38 - $26
        HEX 0D4A2E204B2F ;95 037e
        HEX 3036180E3719 ;96 0384
        HEX 2A2D0F202E10 ;97 038a

        HEX 149375049476 ;98 0390 - 39 - $27
        HEX 284B2F074C30 ;99 0396
        HEX 2B3618163719 ;9a 039c
        HEX 0A2D0F432E10 ;9b 03a2

        HEX 139476069577 ;9c 03a8 - 40 - $28
        HEX 124B2F1F4C30 ;9d 03ae
        HEX 223618223719 ;9e 03b4
        HEX 142D0F3D2E10 ;9f 03ba


LISTBUF HEX 00 00 00 00 00 00 00 00 00 00 ;5
        HEX 00 00 00 00 00 00 00 00 00 00 ;10
        HEX 00 00 00 00 00 00 00 00 00 00 ;15
        HEX 00 00 00 00 00 00 00 00 00 00 ;20
        HEX 00 00 00 00 00 00 00 00 00 00 ;25
        HEX 00 00 00 00 00 00 00 00 00 00 ;30
        HEX 00 00 00 00 00 00 00 00 00 00 ;35
        HEX 00 00 00 00 00 00 00 00 00 00 ;40
        HEX 00 00 00 00 00 00 00 00 00 00 ;40

; *** PRINT ADDRESS by Y,A ***
PRTADR  JSR MON.PRBYTE
        TYA
        JSR MON.PRBYTE
        RTS

; *** PRINT STRING from Y = INDEX ***
IS_PTR  HEX 0000             ; string pointer
ISTROUT LDY #<STR.00         ; init pointer
        STY *TEMP
        LDY #>STR.00
        STY *TEMPH
        LDY #$00
        TAX         ; X = array index
        BEQ IST.2
        DEY
IST.1   INY
        LDA (TEMP),Y
        BNE IST.1
        DEX
        BNE IST.1
        INY           ; Y = found starting index
IST.2   LDA (TEMP),Y  ; Print string until next zero
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
BTDEBUG LDA #$00
        STA *BT_IN2
        LDX #$FF

BTD.01  INX
        TXA
        STA *BT_IN1
        JSR BTINIT
        JSR BLTAB_D
        JSR MON.KPRESS          ; wait for keypress
        CPX #$9F
        BNE BTD.01
        RTS

BLTAB_D LDA *BT_IN1        ; print index1
        JSR MON.PRBYTE
        LDA #$AD           ; print hyphen
        JSR MON.COUT

        LDA I2_ORG         ; print origin index1
        JSR MON.PRBYTE
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
