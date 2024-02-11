*=$300
A1L      =     $3C        ;MOVE source start
A1H      =     $3D
PTR      =     $3C        ;Ptr for fixing links
A2L      =     $3E        ;MOVE source end
A2H      =     $3F
DIFF     =     $40        ;Offset for move (at A3L,A3H)
A4L      =     $42        ;MOVE dest start
A4H      =     $43
LINNUM   =     $50        ;GETADR puts address here
TXTTAB   =     $67        ;Ptr to prog start
VARTAB   =     $69        ;Ptr to vars start
HIGHDS   =     $94        ;BLTUC dest end
HIGHTR   =     $96        ;BLTUC source end
LOWTR    =     $9B        ;BLTUC source start
PRGEND   =     $AF        ;Ptr to prog end
TXTPTR   =     $B8        ;Ptr to token being interpreted
BLTUC    =     $D39A      ;Block move up
CLEARC   =     $D66C      ;CLEAR statement
NEWSTT   =     $D7D2      ;Execute next statement
FRMNUM   =     $DD67      ;Eval numeric expr
CHKCOM   =     $DEBE      ;Parse comma
GETADR   =     $E752      ;Convert FAC to address
MOVE     =     $FE2C      ;Block move down
         JSR   CHKCOM     ;Check for comma
         JSR   FRMNUM     ;Parse number
         JSR   GETADR     ;Convert to addr in LINNUM
         LDA   *LINNUM     ;DIFF = how far to move
         SEC
         SBC   *TXTTAB
         STA   *DIFF
         LDA   *LINNUM+1
         SBC   *TXTTAB+1
         STA   *DIFF+1
         ORA   *DIFF       ;DIFF=0?
         BEQ   DONE1      ;If so, nothing to do
         BCS   UP         ;If moving up, use BLTUC
         LDA   *TXTTAB     ;Else moving down--set up MOVE
         STA   *A1L
         LDA   *TXTTAB+1
         STA   *A1H
         LDA   *PRGEND     ;Moves 1 byte too many, but who cares?
         STA   *A2L
         LDA   *PRGEND+1
         STA   *A2H
         LDA   *LINNUM
         STA   *A4L
         LDA   *LINNUM+1
         STA   *A4H
         LDY   #0
         JSR   MOVE       ;Move (returns Y unchanged)
         TYA
         BEQ   FIXLNK     ;(Always taken)
DONE1    BEQ   DONE       ;(Because DONE is too far to reach from above)
UP       LDA   *TXTTAB     ;Moving up--set up BLTUC
         STA   *LOWTR
         LDA   *TXTTAB+1
         STA   *LOWTR+1
         LDA   *PRGEND
         STA   *HIGHTR
         CLC
         ADC   *DIFF
         STA   *HIGHDS
         LDA   *PRGEND+1
         STA   *HIGHTR+1
         ADC   *DIFF+1
         STA   *HIGHDS+1
         JSR   BLTUC      ;Move (returns Y=0)
FIXLNK   LDA   *LINNUM     ;Fix line links
         STA   *PTR        ;LINNUM points to 1st link
         LDA   *LINNUM+1
         STA   *PTR+1
         INY              ;Now Y=1
FIX1     LDA   (PTR),Y    ;Is link hi byte 0?
         BEQ   FIXPTRS    ;If so, all links fixed
         DEY
         LDA   (PTR),Y    ;Add DIFF to link
         CLC
         ADC   *DIFF
         STA   (PTR),Y
         TAX
         INY
         LDA   (PTR),Y
         ADC   *DIFF+1
         STA   (PTR),Y
         STA   *PTR+1      ;Point at next link
         STX   *PTR
         TYA
         BNE   FIX1       ;(Always taken)
FIXPTRS  LDA   *LINNUM+1   ;Fix prog & var pointers
         STA   *TXTTAB+1   ;LINNUM -> TXTTAB
         LDA   *LINNUM
         STA   *TXTTAB
         BNE   DLO
         DEC   *LINNUM+1
DLO      DEC   *LINNUM     ;Go back a byte
         DEY
         TYA
         STA   (LINNUM),Y ;Zero out byte before prog
         LDA   *PRGEND     ;PRGEND+DIFF -> PRGEND & VARTAB
         CLC
         ADC   *DIFF
         STA   *PRGEND
         STA   *VARTAB
         LDA   *PRGEND+1
         ADC   *DIFF+1
         STA   *PRGEND+1
         STA   *VARTAB+1
         LDA   *TXTPTR     ;TXTPTR+DIFF -> TXTPTR
         CLC
         ADC   *DIFF
         STA   *TXTPTR
         LDA   *TXTPTR+1
         ADC   *DIFF+1
         STA   *TXTPTR+1
DONE     JSR   CLEARC     ;Clear vars & stack
         JMP   NEWSTT     ;Continue program at new loc
