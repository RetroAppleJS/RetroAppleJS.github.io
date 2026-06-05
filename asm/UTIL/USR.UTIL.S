; LAST BUILD 5-JUN-2026

CALL-151
000A: 4C 00 03
0300: 20 06 E3 20 6C DD 20 3D
0308: DB A9 80 85 33 20 6A FD
0310: 8A 48 20 39 D5 68 48 20
0318: DD E3 A0 02 A2 00 68 20
0320: E2 E5 68 68 4C 2A E4
E003G

100 P$ = "Yes, Master?"
110 A$ = USR (P$)
120  PRINT "You typed "; A$

;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

PROMPT   =     $33        ;Prompt char for GETLN
IN       =     $200       ;Buffer for GETLN
GDBUFS   =     $D539      ;Mask off hi bits of input
STRPRT   =     $DB3D      ;Print string in FAC
CHKSTR   =     $DD6C      ;TYPE MISMATCH if not string
ERRDIR   =     $E306      ;ILLEGAL DIRECT if not running
STRSPA   =     $E3DD      ;Get space for new str
PUTNEW   =     $E42A      ;Make temp str descript
MOVSTR   =     $E5E2      ;Move data to str space
GETLN    =     $FD6A      ;Read line of input


ORG $0A
HEX 4C 00 03     ;SET_VECTOR_FOR_USR

ORG $300
JSR   ERRDIR     ;Err if prog not running
JSR   CHKSTR
JSR   STRPRT     ;Print arg
LDA   #$80       ;No prompt
STA   *PROMPT
JSR   GETLN      ;Get input
TXA              ;Save its length
PHA
JSR   GDBUFS     ;Chop off hi bits
PLA              ;Get saved len

PHA
JSR   STRSPA     ;Get space for str
LDY   #>IN
LDX   #<IN
PLA
JSR   MOVSTR     ;Move input to string space
PLA              ;Must pop 1 return addr
PLA              ; before returning a string
JMP   PUTNEW     ;Return new temp descriptor

;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -



               PROMPT    EQU  $33             ;Prompt char for GETLN
               IN        EQU  $200            ;Buffer for GETLN
               GDBUFS    EQU  $D539           ;Mask off hi bits of input
               STRPRT    EQU  $DB3D           ;Print string in FAC
               CHKSTR    EQU  $DD6C           ;TYPE MISMATCH if not string
               ERRDIR    EQU  $E306           ;ILLEGAL DIRECT if not running
               STRSPA    EQU  $E3DD           ;Get space for new str
               PUTNEW    EQU  $E42A           ;Make temp str descript
               MOVSTR    EQU  $E5E2           ;Move data to str space
               GETLN     EQU  $FD6A           ;Read line of input


                         ORG  $0A
000a: 4c 00 03           HEX  4C 00 03        ;SET_VECTOR_FOR_USR

                         ORG  $300
0300: 20 06 e3           JSR  ERRDIR          ;Err if prog not running
0303: 20 6c dd           JSR  CHKSTR
0306: 20 3d db           JSR  STRPRT          ;Print arg
0309: a9 80              LDA  #$80            ;No prompt
030b: 85 33              STA  *PROMPT
030d: 20 6a fd           JSR  GETLN           ;Get input
0310: 8a                 TXA                  ;Save its length
0311: 48                 PHA
0312: 20 39 d5           JSR  GDBUFS          ;Chop off hi bits
0315: 68                 PLA                  ;Get saved len

0316: 48                 PHA
0317: 20 dd e3           JSR  STRSPA          ;Get space for str
031a: a0 02              LDY  #>IN
031c: a2 00              LDX  #<IN
031e: 68                 PLA
031f: 20 e2 e5           JSR  MOVSTR          ;Move input to string space
0322: 68                 PLA                  ;Must pop 1 return addr
0323: 68                 PLA                  ; before returning a string
0324: 4c 2a e4           JMP  PUTNEW          ;Return new temp descriptor


