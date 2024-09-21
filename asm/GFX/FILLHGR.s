*=$0800
       LDX #$00
       LDY #$40
Label0 STY Label2+2
       JSR Label1
       INY
       CPY #$21
       BNE Label0
       RTS
Label1 TXA
       LDA #$FF
Label2 STA $4000,X
       INX
       BNE Label1
       RTS
.END
