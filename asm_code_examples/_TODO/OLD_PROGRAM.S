*=$6000

    LDA #$00
    STA *$18
    LDA #$20
    STA *$19
    JMP $600B
    LDY #$00
L1  LDA ($18),Y
    AND #$7F
    STA ($18),Y
    INC *$18
    LDA *$18
    BNE L1
    INC *$19
    LDA *$19
    CMP #$40
    BNE L1

    LDA #$00
    STA *$18
    LDA #$20
    STA *$19
L2  LDA ($18),Y
    TAX
    INC $4000,X
    LDA $4000,X
    BNE L3
    INC $4100,X
L3  INC *$18
    LDA *$18
    BNE L2
    INC *$19
    LDA *$19
    CMP #$40
    BNE L2

    LDA #$00
    STA *$18
    LDA #$40
    STA *$19

    LDA #$00
    STA *$1A
    LDA #$41
    STA *$1B

    LDA #$00
    STA *$06
    LDA #$00
    STA *$07

    LDY #$00
L4  LDA *$06
    SEC
L5  SBC ($18),Y
    LDA *$07
    SBC ($1A),Y
    BCS L6
    LDA ($18),Y
    STA *$06
    LDA ($1A),Y
    STA *$07
L6  INC *$18
    INC *$1A
    LDA *$18
    BNE L4
    INC *$19
    INC *$1B
    LDA *$19
    CMP #$41
    BNE L4
    RTS
