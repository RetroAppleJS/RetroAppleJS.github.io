; ***************************************************
; *** AFTER ASSEMBLY AND DEPLOY, PLS TEST THE USR ***
; *** COMMAND WITH THE FOLLOWING BASIC CODE       ***
; ***************************************************

; 100 P$ = "Yes, Master?" : A$ = USR (P$) : PRINT "You typed ";A$


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
HEX 4C0003     ;SET_VECTOR_FOR_USR

*=$300
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
