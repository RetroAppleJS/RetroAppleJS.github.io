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


*=$0A
HEX 4C 00 03     ;SET_VECTOR_FOR_USR

*=$300
JSR   ERRDIR     ;Err if prog not running
JSR   CHKSTR
JSR   STRPRT     ;Print arg
LDA   #$80       ;No prompt
;STA   *PROMPT
;JSR   GETLN      ;Get input
;TXA              ;Save its length
;PHA
;JSR   GDBUFS     ;Chop off hi bits
;PLA              ;Get saved len

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



1                             PROMPT   =     $33        ;Prompt char for GETLN
2                             IN       =     $200       ;Buffer for GETLN
3                             GDBUFS   =     $D539      ;Mask off hi bits of input
4                             STRPRT   =     $DB3D      ;Print string in FAC
5                             CHKSTR   =     $DD6C      ;TYPE MISMATCH if not string
6                             ERRDIR   =     $E306      ;ILLEGAL DIRECT if not running
7                             STRSPA   =     $E3DD      ;Get space for new str
8                             PUTNEW   =     $E42A      ;Make temp str descript
9                             MOVSTR   =     $E5E2      ;Move data to str space
10                            GETLN    =     $FD6A      ;Read line of input
11                            ORG   $300
0300: 20 06 E3  12            JSR   ERRDIR     ;Err if prog not running
0303: 20 6C DD  13            JSR   CHKSTR
0306: 20 3D DB  14            JSR   STRPRT     ;Print arg
0309: A9 80     15            LDA   #$80       ;No prompt
030B: 85 33     16            STA   PROMPT
030D: 20 6A FD  17            JSR   GETLN      ;Get input
0310: 8A        18            TXA              ;Save its length
0311: 48        19            PHA
0312: 20 39 D5  20            JSR   GDBUFS     ;Chop off hi bits
0315: 68        21            PLA              ;Get saved len
0316: 48        22            PHA
0317: 20 DD E3  23            JSR   STRSPA     ;Get space for str
031A: A0 02     24            LDY   #>IN
031C: A2 00     25            LDX   #<IN
031E: 68        26            PLA
031F: 20 E2 E5  27            JSR   MOVSTR     ;Move input to string space
0322: 68        28            PLA              ;Must pop 1 return addr
0323: 68        29            PLA              ; before returning a string
0324: 4C 2A E4  30            JMP   PUTNEW     ;Return new temp descriptor
