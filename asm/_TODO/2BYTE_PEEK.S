
; TODO:  ADD EXAMPLE CODE

CALL-151
000A: 4C 00 03
0300: 20 6A
0300: DD AD 51 00 48 AD 50 00
0308: 48 20 52 E7 A0 01
0300: B1 50 AA 88 B1 50 A8 68
0308: 8D 50 00 68 8D 51 00 8A
0310: 4C F2 E2
E003G


;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

LINNUM   =     $50        ;Result_from_GETADR
CHKNUM   =     $DD6A      ;Make_sure_expr_is_number
GIVAYF   =     $E2F2      ;Float_signed_int_in_A,Y
GETADR   =     $E752      ;Convert_number_to_int
PRBYTE   =     $FDDA


ORG $300
JSR   CHKNUM     ;TYPE_MISMATCH_if_not_number
LDA   *LINNUM+1   ;Preserve_LINNUM
JSR   PRBYTE
LDA   *LINNUM
JSR   PRBYTE
RTS


JSR   CHKNUM     ;TYPE_MISMATCH_if_not_number
LDA   LINNUM+1   ;Preserve_LINNUM
PHA
LDA   LINNUM
PHA
JSR   GETADR     ;Convert_num_to_int
LDY   #1         ;Get_value_from_mem_into_X,Y
LDA   (LINNUM),Y
TAX
DEY
LDA   (LINNUM),Y
TAY
PLA              ;Restore_saved_LINNUM
STA   LINNUM
PLA
STA   LINNUM+1
TXA
JMP   GIVAYF     ;Float_result


ORG $0A
;SET_VECTOR_FOR_USR
HEX 4C0003 ;JMP_$300
