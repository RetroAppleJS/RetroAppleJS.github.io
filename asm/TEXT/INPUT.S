ORG $6000
INVFLG      EQU     $32
IN          EQU     $0200
M.COUT      EQU     $FDED   ; print char
A1L         EQU    $3c
A1H         EQU     $3d
A2L         EQU     $3e
A2H         EQU    $3f
BELL        EQU     $FF3A
M.CRDO      EQU     $DAFB   ; line feed
PROMPT      EQU     $33
RDKEY       EQU     $FD0C
PICK        EQU     $95
BASL        EQU    $28
PRNTYX      EQU    $f940
M.PRBYTE    EQU    $FDDA   ; print hex byte
NXTA1       EQU    $FCBA
RDCHAR      EQU    $fd35
CLREOL      EQU    $fc3e

NOTCR LDA INVFLG
      PHA
      LDA    #$FF
      STA    INVFLG          ;echo user line
      LDA    IN,X            ;  non inverse
      JSR     M.COUT
      PLA
      STA     INVFLG
      LDA     IN,X
      CMP     #$88            ;check for edit keys
      BEQ     BCKSPC          ;  BS, ctrl-X
      CMP     #$98
      BEQ     CANCEL
      CPX     #$f8            ;margin?
      BCC     NOTCR1
      JSR     BELL            ;yes, sound bell
NOTCR1 INX                     ;advance input index
       BNE     NXTCHAR
CANCEL LDA     #$dc            ;backslash after cancelled lin
       JSR     M.COUT
GETLNZ JSR     M.CRDO           ;output CR
GETLN  LDA     PROMPT
       JSR     M.COUT            ;output prompt char
       LDX     #$01            ;init input index
BCKSPC TXA                     ;  will backspace to 0
       BEQ     GETLNZ
       DEX
NXTCHAR JSR     RDCHAR
        CMP     #PICK           ;use screen char
        BNE     CAPTST          ;  for ctrl-U
        LDA     (BASL),Y
CAPTST  CMP     #$e0
        BCC     ADDINP          ;convert to caps
        AND     #$df
ADDINP  STA     IN,X            ;add to input buf
        CMP     #$8d
        BNE     NOTCR
        JSR     CLREOL          ;clr to EOL if CR
CROUT   LDA     #$8d
        BNE     M.COUT
PRA1    LDY     A1H             ;print CR,A1 in hex
        LDX     A1L
PRYX2   JSR     M.CRDO
        JSR     PRNTYX
        LDY     #$00
        LDA     #$ad            ;print '-'
        JMP     M.COUT

XAM8    LDA     A1L
        ORA     #$07            ;set to finish at
        STA     A2L             ;  mod 8=7
        LDA     A1H
        STA     A2H
MOD8CHK LDA     A1L
        AND     #$07
        BNE     DATACUT
XAM     JSR     PRA1
DATACUT LDA     #$a0
        JSR     M.COUT            ;output blank
        LDA     (A1L),Y
        JSR     M.PRBYTE          ;output byte in hex
        JSR     NXTA1
        BCC     MOD8CHK         ;check if time to,
RTS4C   RTS              ;  print addr
