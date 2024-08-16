;*************************************
;*                                   *
;*       VIDEOTERM   INTERFACE       *
;*        FIRMWARE    V. 2.4         *
;*                                   *
;*  WRITTEN BY DARRELL ALDRICH       *
;*      (C)  1981  VIDEX             * 
;*                                   *                
;*************************************
;*
;* ZERO PAGE EQUATES
;*
CH     EQU    $24
CV     EQU    $25
BASL   EQU    $28
XSAVE  EQU    $35
CSWL   EQU    $36
CSWH   EQU    $37
KSWL   EQU    $38
KSWH   EQU    $39
RNDL   EQU    $4E
RNDH   EQU    $4F
;*
;*    TEMPORARIES
;*
CRFLAG  EQU   $478
ASAV1   EQU   $4F8
XSAV1   EQU   $578
TEMPX   EQU   $5F8
OLDCHA  EQU   $678
NO      EQU   $6F8
MSLOT   EQU   $778
;*
;*    MISC   EQUATES
;*
IN      EQU   $200
IORTS   EQU   $FFCB
;*
;* SLOT N   PERMANENTS *
;*
BASEL   EQU    $47B         ;SCREEN BASE ADDRESS LOW
BASEH   EQU    $4FB         ;SCREEN BASE ADDRESS HIGH
CHORZ   EQU    $57B         ;CURSOR HORIZONTAL POSITION
CVERT   EQU    $5FB         ;CURSOR VERTICAL POSITION
BYTE    EQU    $67B         ;I/O BYTE FOR PASCAL ENTRIES
START   EQU    $6FB         ;SCREEN START ADDRESS
POFF    EQU    $77B         ;POWER OFF AND LEAD IN COUNTER
;*
;* BO,B1 IS GO TO XY LEAD IN COUNTER
;* B2    IS CONTROL Z LEADIN COUNTER
;* B3-B7 IS POWER OFF FLAG
;*
FLAGS   EQU   $7F8          ;VIDEO SET UP FLAGS
;*
;* B0  ALTERNATE CHARACTER SET  1=ON  0=OFF
;* B1
;* B2
;* B3
;* B4  ROWS OF CHARACTERS
;* B5
;* B6  LOWER / UPPER CASE CONVERSION FLAG  1=ON  0=OFF
;* B7  GETLN FLAG  1=INPUT CAME FROM GETLN ROUTINE
;*
;*
;* IO DEVICES
;*
KBD    EQU  $C000
KBDSTR EQU  $C010
SPKR   EQU  $C030
DEV0   EQU  $C0B0
DEV1   EQU  $C0B1
DISP0  EQU  $CC00
DISP1  EQU  $CD00
;*
       ORG  $C800

;*
;*
;* SET UP CRTC AND CLEAR SCREEN
;*
;*
SETUP  LDA  POFF            ; GET POWER OFF FLAG
       AND  #$F8            ; STRIP OFF LEAD IN COUNTERS
       CMP  #$30            ; HAS POWER BEEN TURNED OFF?
       BEQ  SETEXI          ; RETURN IF NOT 
RESTAR LDA  #$30
       STA  POFF            ; SET DEFAULTS FOR FLAGS
       STA  FLAGS
       LDA  #$00
       STA  START
       JSR  CLRSCR
       LDX  #$00
LOOP   TXA
       STA  DEV0            ; FOR THE CRTC ADDRESS
       LDA  TABLE,X         ; GET PARAMETER
       STA  DEV1            ; STORE INTO CRTC
       INX
       CPX  #$10
       BNE  LOOP            ; CONTINUE LOOP UNTIL DONE
SETEXI STA  $C059
       RTS
;*
;*
EXIT   LDA  FLAGS
       AND  #$08
       BEQ  NORMOU
       JSR  $FE93
       JSR  $FC22
       JSR  $FE89
NORMOU PLA
       TAY
       PLA
       TAX
       PLA
       RTS
;*
;*
;* GET CHARACTER FROM KEYBOARD
;*
RDKEY  JSR  CSRMOV          ; POSITION CURSOR
KEYIN  INC  RNDL            ; UPDATE BASIC RANDOM
       BNE  KEYIN2
       INC  RNDH
KEYIN2 LDA  KBD             ; POLL KEYBOARD
       BPL  KEYIN           ; LOOP UNTIL KEY IS STRUCK
       JSR  KEYSTA
       BCC  KEYIN
NOKEY  BIT  KBDSTR          ; CLEAR KEYBOARD STROBE
       CLC
       RTS
;*
KEYSTA CMP  #$8B            ; CHECK FOR CONTROL K
       BNE  NOTK            ; SKIP IF NOT
       LDA  #$DB            ; SUBSTITUTE A RIGHT BRACKET
NOTK   CMP  #$81            ; CHECK FOR CONTROL A
       BNE  NTSHIF          ; SKIP IF NOT
       LDA  FLAGS
       EOR  #$40
       STA  FLAGS           ; TOGGLE UPR/LWR CASE FLAG
       BCS  NOKEY           ; GET NEXT KEY
NTSHIF PHA                  ; SAVE CHARACTER
       LDA  FLAGS
       ASL  A
       ASL  A               ; CHECK UPR/LWR CASE CONVERSION FLAG
       PLA                  ; RESTORE CHARACTER
       BCC  INDONE          ; DON'T CONVERT IF FLAG CLEAR
       CMP  #$80
       BCC  INDONE          ; DON'T CONVERT SPECIAL CHARACTERS
       BIT  $C063
       BMI  NOSHIF
       CMP  #"0"
       BEQ  ZERO
       CMP  #"@"
       BNE  NOTAT
       LDA  #"P"
NOTAT  CMP  #"["
       BCC  INDONE
       AND  #$CF
       BNE  INDONE
ZERO   LDA  #"J"
NOSHIF ORA  #$20
INDONE PHA                  ; DUPLICATE CHARACTER
       AND  #$7F8           ; STRIP OFF HIGH BIT
       STA  BYTE            ; SAVE FOR PASCAL
       PLA                  ; RECOVER FOR BASIC
       SEC
       RTS
;*
TABLE  HEX 7B505E291B081819
       HEX 0008E00800000000
;*
;*
;* SECONDARY BASIC OUTPUT ROUTINE
;*
;*
BASOU1 STA  BYTE            ; SAVE CHARACTER
       LDA  CV              ; PERFORM VTAB
       CMP  CVERT
       BEQ  CVOK
       STA  CVERT
       JSR  VTAB
CVOK   LDA  CH              ; PERFORM HTAB
       CMP  CHORZ
       BCC  PSCLOU
       STA  CHORZ
PSCLOU LDA  BYTE            ; GET CHARACTER
       JSR  OUTPU1          ; OUTPUT CHARACTER
CSRMOV LDA  #$0F            ; SET UP CRTC ADDRESS
       STA  DEV0            ; FOR CURSOR LOW ADDRESS
       LDA  CHORZ           ; CALCULATE ADDRESS
       CMP  #80
       BCS  RTS6
       ADC  BASEL
       STA  DEV1            ; SAVE ADDRESS
       LDA  #$0E            ; SET UP CRTC ADDRESS
       STA  DEV0            ; FOR CURSOR HIGH ADDRESS
       LDA  #$00            ; CALCULATE ADDRESS
       ADC  BASEH
       STA  DEV1            ; SAVE ADDRESS
RTS6   RTS
;*
;*
;* PERFORM ESCAPE FUNCTIONS
;*
ESC1   EOR  #$C0
       CMP  #$08
       BCS  RTS3
       TAY
       LDA  #>BELL
       PHA
       LDA  ESCTBL,Y
       PHA
       RTS
;*
       NOP
;*
CLREOL LDY  CHORZ           ; PUT CURSOR HORIZONTAL INTO Y
CLEOLZ LDA  #$A0            ; USE A SPACE
CLEOL2 JSR  CHRPUT          ; PUT CHARACTER ON SCREEN
       INY
       CPY  #80             ; CONTINUE UNTIL
       BCC  CLEOL2          ; Y >=80
       RTS
;*
LEADIN LDA  #$34            ; SET LEAD IN BIT
PSAVE  STA  POFF
RTS3   RTS
GOXY1  LDA  #$32            ; SET LEADIN COUNT TO 2
       BNE  PSAVE
;*       
BELL   LDY  #$C0            ; BEEP THE SPEAKER
BELL1  LDX  #$80
BELL2  DEX
       BNE  BELL2
       LDA  SPKR
       DEY
       BNE  BELL1
       RTS


;* STORE CHARACTER ON SCREEN AND ADVANCE CURSOR
;*
STOADV LDY  CHORZ
       CPY  #80
       BCC  NOT81
       PHA
       JSR  CRLF
       PLA
NOT81  LDA  CHORZ
       JSR  CHRPUT          ; PLACE CHARACTER ON SCREEN
ADVANC INC  CHORZ           ; INCREMENT CURSOR HORIZONTAL INDEX
       BIT  CRFLAG
       BPL  RTS8
       LDA  CHORZ
       CMP  #80
       BCS  CRLF
RTS8   RTS
;*
;* CLEAR END OF PAGE
;*
CLREOP LDY  CHORZ           ; GET CURSOR HORIZONTAL INTO Y
       LDA  CVERT           ; GET CURSOR VERTICAL INTO A
CLEOP1 PHA                  ; SAVE CURRENT LINE ON STACK
       JSR  VTABZ           ; CALCULATE BASE ADDRESS
       JSR  CLEOLZ          ; CLEAR TO END OF LINE, SET CARRY
       LDY  #$00            ; CLEAR FROM HORIZONTAL INDEX 0
       PLA
       ADC  #$00            ; INCREMENT CURRENT LINE (C=1)
       CMP  #24             ; DONE TO BOTTOM OF WINDOW?
       BCC CLEOP1           ; IF NOT KEEP CLEARING LINES
       BCS JVTAB            ; VERTICAL TAB TO CURSOR POSITION
;*
;*
;* CLEAR SCREEN
;*
CLRSCR JSR  HOME            ; HOME CURSOR
       TYA 
       BEQ  CLEOP1          ; CLEAR TO END OF PAGE
;*
;* HOME CURSOR
;*
HOME   LDA  #$00            ; SET CURSOR POSITION TO 0,0
       STA  CHORZ
       STA  CVERT
       TAY
       BEQ  JVTAB           ; VERTICAL TAB TO CURSOR POSITION
;*
BS     DEC  CHORZ           ; DECREMENT CURSOR HORIZONTAL INDEX
       BPL  RTS3            ; IF POS, OK. ELSE MOVE UP
       LDA  #79             ; SET CURSOR HORIZONTAL TO
       STA  CHORZ           ; RIGHTMOST SCREEN POSITION
;*
;* MOVE CURSOR UP
;*
UP     LDA  CVERT           ; GET CURSOR VERTICAL INDEX
       BEQ  RTS3            ; IF TOP LINE THEN RETURN
       DEC  CVERT           ; DECREMENT CURSOR VERTICAL INDEX
JVTAB  JMP  VTAB            ; VERTICAL TAB TO CURSOR POSITION
;*
;*
NOTGXY LDA  #$30            ; CLEAR LEAD IN BITS
       STA  POFF
       PLA
       ORA  #$80
       CMP  #"1"
       BNE  NOT0
       LDA  #$08
       STA  $C058
       BNE  FLGSET
;*
NOT1   CMP  #"2"
       BNE  NOT2
LOLITE LDA  #$FE
FLGCLR AND  FLAGS
FLGSAV STA  FLAGS
       RTS
;*
;*
;* PASCAL OUTPUT ENTRY POINT
;*
;*
PSOUT  STA  BYTE
       LSR  CRFLAG
       JMP  PSCLOU                 ; JUMP FOR PASCAL ENTRY

;*
;*
;* CR LF ROUTINE
;*
CRLF   JSR  CR
LF     INC  CVERT                  ; INCREMENT CURSOR VERTICAL
       LDA  CVERT
       CMP  #24                    ; OFF SCREEN
       BCC  VTABZ                  ; IF NOT MOVE CURSOR
       DEC  CVERT                  ; IF SO DECREMENT CURSOR VERTICAL
;*
       LDA  START                  ; INCREMENT THE START ADDRESS
       ADC  #$04                   ; BY ONE LINE
       AND  #$7F8
       STA  START
       JSR  BASCL1                 ; CALCULATE THE START ADDRESS
       LDA  #$0D                   ; SET UP CRTC ADDRESS
       STA  DEV0                   ; FOR START LOW ADDRESS
       LDA  BASEL                  ; GET START LOW
       STA  DEV1                   ; SAVE START LOW
       LDA  #$0C                   ; SET UP CRTC ADDRESS
       STA  DEV0                   ; FOR START HIGH ADDRESS
       LDA  BASEH                  ; GET START HIGH
       STA  DEV1                   ; SAVE START HIGH
       LDA  #23                    ; PUT WINDOW BOTTOM-1 INTO A
       JSR  VTABZ                  ; CALCULATE BASE ADDRESS
       LDA  #$00
       JSR  CLEOLZ                 ; CLEAR BOTTOM LINE
       BCS  JVTAB                  ; MOVE CURSOR BRACKET
;*
NOT2   CMP  #"3"
       BNE  JSTOAD
HILITE CMP  #$01
FLGSET ORA  FLAGS
       BNE  FLGSAV
;*
;*
;* BASIC INITIAL I/O ENTRY POINT
;*
;*
;*
NOT0   CMP  #"0"
       BNE  NOT1
       JMP  RESTAR
;*
JSTOAD JMP  STOADV
;*
VTAB   LDA  CVERT                  ; GET CURSOR VERTICAL
VTABZ  STA  ASAV1                  ; MULTIPLY A BY 5
       ASL  A
       ASL  A
       ADC  ASAV1
       ADC  START                  ; ADD START
BASCL1 PHA                         ; SAVE A0
       LSR  A
       LSR  A
       LSR  A
       LSR  A
       STA  BASEH
       PLA    
       ASL  A
       ASL  A
       ASL  A
       ASL  A
       STA  BASEL
RTS2   RTS
;*
;*
VIDOUT CMP  #$0D
       BNE  VDOUT1
CR     LDA  #$00
       STA  CHORZ
       RTS
VDOUT1 ORA  #$80                   ; SET HIGH BIT
       CMP  #$A0
       BCS  JSTOAD                 ; IF NOT CONTROL PRINT IT
       CMP  #$87
       BCC  RTS4                   ; CTRL @ - F
       TAY
       LDA  #>BELL
       PHA
       LDA  CTLTBL-$87,Y
       PHA
RTS4   RTS
;*
CTLTBL  .BYTE  BELL-1       ; here is where the assembler is leaving pass1
        .BYTE  BS-1
        .BYTE  RTS3-1
        .BYTE  LF-1
        .BYTE  CLREOP-1
        .BYTE  CLRSCR-1
        .BYTE  CRLF-1
        .BYTE  LOLITE-1
        .BYTE  HILITE-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  RTS3-1
        .BYTE  HOME-1
        .BYTE  LEADIN-1
        .BYTE  RTS3-1
        .BYTE  ADVANC-1
        .BYTE  CLREOL-1
        .BYTE  GOXY1-1
        .BYTE  UP-1
;*
;* CALCULATE SCREEN ADDRESS AND SWITCH IN CORRECT PAGE
;*
;*
PSNCAL CLC
       TYA
       ADC  BASEL
       PHA
       LDA  #$00
       ADC  BASEH
       PHA    
       ASL  A
       AND  #$0C                   ; USE BIT O AND 1 FOR PAGING
       TAX
       LDA  DEV0,X                ; SET CORRECT SCREEN PAGE
       PLA    
       LSR  A
       PLA    
       TAX
       RTS
;*
;*
;* PUT A CHARACTER AT CVERT, CHORZ
;*
;*
CHRPUT ASL  A
       PHA                   ; SAVE SHIFTED CHARACTER
       LDA  FLAGS           ; GET CHARACTER SET FLAGS
       LSR  A               ; SHIFT IT INTO CARRY
       PLA                   ; RECOVER SHIFTED CHARACTER
       ROR  A               ; ROTATE CARRY INTO CHARACTER
       PHA                   ; SAVE CHARACTER
       JSR  PSNCAL          ; SET UP SCREEN ADDRESS
       PLA                   ; RECOVER CHARACTER
       BCS  WRITE1          ; SELECT MEMORY RANGE
       STA  DISP0,X         ; STORE CHARACTER ON SCREEN
       BCC  WSKIP           ; SKIP
WRITE1 STA  DISP1,X
WSKIP  RTS                  ; RECOVER X REGISTER
;*
;*
;* GENERAL OUTPUT ROUTINE
;*
;*
OUTPU1 PHA                  ; SAVE CHARACTER
       LDA  #$F7
       JSR  FLGCLR
       STA  $C059
       LDA  POFF
       AND  #$07            ; CHECK FOR LEAD IN
       BNE  LEAD            ; BRANCH FOR LEAD IN
       PLA                  ; RECOVER CHARACTER
       JMP  VIDOUT          ; OUTPUT CHARACTER
;*
LEAD   AND  #$04            ; CHECK FOR GO TO XY
       BEQ  GOXY3           ; IF NOT SKIP
       JMP  NOTGXY
GOXY3  PLA                  ; RECOVER CHARACTER
       SEC
       SBC  #$20            ; SUBTRACT 32
GOTOXY AND  #$7F            ; STRIP OFF UNNEEDED BITS
       PHA                  ; SAVE A
       DEC  POFF            ; DECREMENT LEAD IN COUNTER
       LDA  POFF
       AND  #$03            ; GET COUNT
       BNE  GOXY2           ; SKIP IF COUNT NOT ZERO
       PLA                  ; RECOVER A0
       CMP  #24             ; IF A > WINDOW BOTTOM
       BCS  BADY            ; THEN DON'T MOVE CURSOR VERTICAL
       STA  CVERT
BADY   LDA  TEMPX           ; GET CURSOR HORIZONTAL PARAMETER
       CMP  #80             ; IF A > 80 THEN
       BCS  BADX            ; DON'T MOVE CURSOR HORIZONTAL
       STA  CHORZ
BADX   JMP  VTAB            ; VERTICAL TAB TO CURSOR POSITION
GOXY2  PLA                  ; RECOVER A
       STA  TEMPX            ; SAVE CURSOR HORIZONTAL PARAMETER
       RTS
;*
;*
;* STOP LIST ROUTINE
;*
;*
STPLST LDA  KBD
       CMP  #$93
       BNE  STPDON
       BIT  KBDSTR
STRLOO LDA  KBD
       BPL  STRLOO
       CMP  #$83
       BEQ  STPDON
       BIT  KBDSTR
STPDON RTS
;*
ESCNOW TAY
       LDA  XLTBL-$C9,Y
       JSR  ESC1
ESCNEW JSR  RDKEY
       CMP  #$CE 
       BCS  ESC2
       CMP  #$C9
       BCC  ESC2
       CMP  #$CC
       BNE  ESCNOW
ESC2   JMP  ESC1
       NOP
;*
;*
;*
;*
;*
;* BASIC INITIAL I/O ENTRY POINT
;*
;*
       BIT  IORTS           ; SET VFLAG ON INITIAL ENTRY
       BVS  ENTR 
INFAKE SEC                  ; FAKE INPUT ENTRY C=0
       HEX  90
OUENTR CLC                  ; OUTPUT ENTRY C=1
       CLV
       BVC  ENTR
       HEX 0182
       .BYTE INIT 
       .BYTE READ
       .BYTE WRITE
       .BYTE STATUS
;*
INIT   JMP  SETUP
;*
READ   JSR  RDKEY
       AND  #$7F
       LDX  #$00
       RTS
;*
WRITE  JSR  PSOUT
       LDX  #$00
       RTS
;*
STATUS CMP  #$00
       BEQ  STEXIT
       LDA  KBD
       ASL  A
       BCC  STEXIT
       JSR  KEYSTA
STEXIT LDX #$00
       RTS
;*
;* BASIC INPUT ENTRY POINT
;*
INENTR STA  (BASL),Y               ; REPLACE FLASHING
       SEC
       CLV
ENTR   STA  $CFFF                  ; TURN OFF CO-RESIDENT MEMORY
;*
;*
;*
;* SAVE REGISTERS, SET UP NO AND CONTINUE
;*
;*
WHERE  PHA                          ; SAVE REGISTERS ON STACK
       STA  XSAVE
       TXA
       PHA    
       TYA
       PHA    
       LDA  XSAVE                  ; SAVE CHARACTER
       STX  XSAVE                  ; SAVE INPUT BUFFER INDEX
       LDX  #$C3
       STX  CRFLAG
       PHA    
       BVC  IO                     ; GO TO IO IF NOT INITIAL ENTRY
;*
;*
;* BASIC INITIALIZE
;*
;*
       LDA  #<INENTR              ; SET UP INPUT AND OUTPUT HOOKS
       STA  KSWL
       STX  KSWH
       LDA  #<OUENTR
       STA  CSWL
       STX  CSWH
       JSR  SETUP                 ; SET UP CRTC
       CLC
;*
;*
IO     BCC  BASOUT
;*
;*
;* BASIC INPUT ROUTINE
;*
;*
BASINP PLA                         ; POP STACK
       LDY  XSAVE                  ; GET INPUT BUFFER INDEX
       BEQ  GETLN                  ; IF ZERO ASSUME GETLN
       DEY
       LDA  OLDCHA                 ; GET LAST CHARACTER FROM GETLN
       CMP  #$88                   ; IF 88 ASSUME GETLN
       BEQ  GETLN
       CMP  IN,Y
       BEQ  GETLN
       EOR  #$20
SKIP   CMP  IN,Y                   ; IF SAME AS CHARACTER IN INPUT
       BNE  NTGETL                ; BUFFER THEN ASSUME GETLN
       LDA  OLDCHA                 ; GET LAST CHARACTER FROM GETLN
       STA  IN,Y                   ; FIX INPUT BUFFER
       BCS  GETLN                  ; GO TO GETLN
ESC    JSR  ESCNEW                 ; PERFORM ESCAPE FUNCTION
GETLN  LDA  #$80                   ; SET GETLN FLAG
       JSR  FLGSET
       JSR  RDKEY                  ; GET CHARACTER FROM KEYBOARD
       CMP  #$98                   ; CHECK FOR ESCAPE
       BEQ  ESC
       CMP  #$80                   ; CHECK FOR CR
       BNE  NOTCR                  ; IF NOT SKIP
       PHA                         ; SAVE CHARACTER
       JSR   CLREOL                ; CLEAR TO END OF LINE
       PLA                         ; RECOVER CHARACTER
NOTCR  CMP  #$95                   ; CHECK FOR PICK
       BNE  NOTPIC                 ; IF NOT SKIP
CHRGET LDY  CHORZ                  ; GET CURSOR HORIZONTAL POSITION
       JSR  PSNCAL                 ; SET UP SCREEN ADDRESS
       BCS  READ1                  ; READ CHARACTER FROM SCREEN
       LDA  DISP0,X
       BCC  RSKIP
READ1  LDA  DISP1,X
RSKIP  ORA  #$80                   ; SET HIGH BIT
NOTPIC STA  OLDCHA                ; SAVE CHARACTER IN OLDCHAR
       BNE  DONE                   ; EXIT
NTGETL JSR  RDKEY                  ; GET CHARACTER FROM KEYBOARD
       LDY  #$00                   ; CLEAR OLDCHARACTER
       STY  OLDCHA
;*
DONE   TSX                         ; PUT CHARACTER INTO STACK
       INX
       INX
       INX
       STA  $100,X
OUTDO1 LDA  #$00                   ; SET CH = 00
OUTDON STA  CH
       LDA  CVERT                  ; SET CV = CVERT
       STA  CV
       JMP  EXIT
;*
;*
;* PRIMARY BASIC OUTPUT ROUTINE
;*
;*
BASOUT PLA                         ; RECOVER CHARACTER
       LDY  FLAGS                  ; CHECK GETLN FLAG
       BPL  BASOUT                 ; IF CLEAR THEN SKIP
       LDY  OLDCHA                 ; GET LAST CHARACTER FROM GETLN
       CPY  #$E0 
       BCC  BOUT 
       TYA
BOUT   JSR  BASOU1                ; OUTPUT CHARACTER
       JSR  STPLST
       LDA  #$7F                   ; CLEAR THE GETLN FLAG
       JSR  FLGCLR
       LDA  CHORZ                  ; GET CURSOR HORIZONTAL
       SBC  #$47
       BCC  OUTDO1
       ADC  #$1F
FIXCH  CLC
       BCC  OUTDON
;*
ESCTBL  .BYTE  CLRSCR-1
        .BYTE  ADVANC-1
        .BYTE  BS-1
        .BYTE  LF-1
        .BYTE  UP-1
        .BYTE  CLREOL-1
        .BYTE  CLREOP-1
        .BYTE  HOME-1
;*
XLTBL  HEX C4C2C1FFC3
;*
       NOP
;*
ROMSW  STA  $CFFF
       STA  $C300 
       RTS