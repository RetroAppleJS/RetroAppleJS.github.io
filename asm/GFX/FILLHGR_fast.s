*=$0800
       LDX #$00
       LDY #$20
Label0 STY LOOP2+1
       JSR Label1
       INY
       CPY #$3F
       BNE Label0

       RTS

Label1 TXA
       LDA #$FF
LOOP2  STA $2000,X
       INX
       BNE LOOP2
       RTS
.END
