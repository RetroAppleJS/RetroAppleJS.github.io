;*-------------------------------
;* DecPrint - 6502 print 16 bits
;*
;* by Mike B (barrym95838) 7/7/2017
;*
;* Disassembly, comments, and
;* optimization by John Brooks 7/8/2017
;*-------------------------------

*=$6000
M.COUT     = $FDED   ; print char
M.PRBYTE   = $FDDA   ; print hex byte
LINPRT     = $ED24   ; print dec word (A=hi X=lo)

START     JMP RUN_ME
HEXNUM    HEX 0564        ; INPUT HEX NUMBER

RUN_ME    LDA HEXNUM      ; Hi-Byte
          JSR M.PRBYTE
          LDA HEXNUM+1    ; Lo-Byte
          JSR M.PRBYTE
          LDA #$BD      ; '='
          JSR M.COUT

          LDA HEXNUM
          LDX HEXNUM+1
          JSR LINPRT
          RTS
