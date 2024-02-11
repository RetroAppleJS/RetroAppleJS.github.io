CALL-151
6000: 08 20 ED FD 8A 20 ED FD
6008: 98 20 ED FD 68 20 ED FD
6010: 60
0300: 20 B7 00 C9 2C F0 11 AD
0308: 7D 03 48 AD 7A 03 AE 7B
0310: 03 AC 7C 03 28 6C 7E 03
0318: 20 B1 00 C9 41 F0 0F C9
0320: 58 F0 13 C9 59 F0 17 C9
0328: 50 F0 1B 4C C9 DE 20 6A
0330: 03 8E 7A 03 50 CA 20 6A
0338: 03 8E 7B 03 50 C2 20 6A
0340: 03 8E 7C 03 50 BA 20 B1
0348: 00 C9 43 F0 0B 20 75 03
0350: 20 6D 03 8E 7D 03 50 A8
0358: 20 72 03 20 67 DD 20 52
0360: E7 8C 7E 03 8D 7F 03 4C
0368: 00 03 20 72 03 20 F8 E6
0370: B8 60 20 B1 00 A9 D0 4C
0378: C0 DE 00 00 00 04 00
E003G

CALL768,PC=24576,A=193,X=216,Y=217,P=48



;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

;SAVE S.CALL.UTIL
;CALL 768{,pc=word,a=byte,x=byte,y=byte,p=byte}

;Working example
;10 CALL 768,PC=24576,A=193,X=216,Y=217,P=48 : REM $30 = 00110000 (P: BIT 4 & 5 ALWAYS 1)
;output: AXY0(inverted)


*=$6000
        PHP         ;Push Processor Status on Stack
        JSR $FDED
        TXA
        JSR $FDED
        TYA
        JSR $FDED
        PLA         ;Pull Accumulator from Stack
        JSR $FDED
        RTS

*=$300
EQ.TOK = $D0      ;Applesoft '=' token

CHRGET = $B1      ;-$C8 advance TXTPTR & fetch chr
CHRGOT = $B7      ;just fetch chr

FRMNUM = $DD67    ;evaluate FP expression (FAC)
SYNCHR = $DEC0    ;require chr in Acc syntax @ TXTPTR
SYNERR = $DEC9    ;syntax error
GETBYT = $E6F8    ;evaluate 8 bits @ TXTPTR (X-reg)
GETADR = $E752    ;convert FAC to 16 bits in Acc & Y-reg (hi/lo)

;--------------------------------

CALL.UTIL

       JSR CHRGOT   ;get chr after call adr expression
       CMP #','     ;comma indicates more stuff follows
       BEQ L1       ;=>go continue parsing


;       LDA P.SAV    ;TEST !
;       JSR $FDDA    ; PRINT HEX VALUE
;       JSR $FD8E    ; Carriage return
;       LDA P.SAV
;       PHA          ; Push Accumulator on Stack
;       PLP          ; Pull Processor Status from Stack
;       PHP          ; Push Processor Status on Stack
;       PLA          ; Pull Accumulator from Stack
;       JSR $FDDA    ; PRINT HEX VALUE
;       JSR $FD8E    ; Carriage return


       LDA P.SAV    ;load registers
       PHA          ;Push Accumulator on Stack
       LDA ACC.SAV
       LDX X.SAV
       LDY Y.SAV
       PLP          ;Pull Processor Status from Stack
       JMP (PC.SAV) ;go 4 it!

; we got something to parse

L1     JSR CHRGET   ;get chr after comma
       CMP #'A'     ;(as in 'Acc')
       BEQ L2       ;=>go get '=' & byte for Acc
       CMP #'X'     ;(as in 'X-reg')
       BEQ L3       ;=>go get '=' & byte for X-reg
       CMP #'Y'     ;(as in 'Y-reg')
       BEQ L4       ;=>go get '=' & byte for Y-reg
       CMP #'P'     ;(as in P-reg or Program Counter)
       BEQ L5       ;=>go get '=' or 'C='...
       JMP SYNERR   ;razz

; pickup Acc byte

L2     JSR L7       ;require '=' (@ next) & fetch byte exp
       STX ACC.SAV  ;stuff it
       BVC CALL.UTIL ;...always

; pickup X-reg byte

L3     JSR L7       ;require '=' (@ next) & fetch byte exp
       STX X.SAV    ;stuff it
       BVC CALL.UTIL ;...always

; pickup Y-reg byte

L4     JSR L7       ;require '=' (@ next) & fetch byte exp
       STX Y.SAV    ;stuff it
       BVC CALL.UTIL ;...always

; Finish parsing 'P=' or 'PC='

L5     JSR CHRGET   ;advance to next chr position & fetch it
       CMP #'C'     ;(as in 'Program Counter')
       BEQ L6       ;=>go get '=' & 16 bits for PC

; pickup P-reg byte

       JSR L10      ;require '=' @ current chr position
       JSR L8       ;fetch byte expression
       STX P.SAV    ;stuff it
       BVC CALL.UTIL ;...always

; pickup PC word

L6     JSR L9       ;require '=' @ next chr position
       JSR FRMNUM   ;fletch FP expression
       JSR GETADR   ;convert FP expression to Acc & Y-reg (hi/lo)
       STY PC.SAV   ;stuff 'em
       STA PC.SAV+1
       JMP CALL.UTIL ;no flag known...

L7     JSR L9       ;require '=' @ next chr position

L8     JSR GETBYT   ;fetch byte expression (2 X-reg)
       CLV          ;to force branch
       RTS

L9     JSR CHRGET   ;1st advance to next chr position

L10    LDA #EQ.TOK  ;require '=' before register expressions
       JMP SYNCHR   ;(SYNTAX ERROR IF '=' NOT FOUND)

;--------------------------------

ACC.SAV    HEX 00
X.SAV      HEX 00
Y.SAV      HEX 00
P.SAV      HEX 04
PC.SAV     HEX 00 00

;--------------------------------
