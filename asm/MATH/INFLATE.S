* = 0800

INF_ZP = $F0
IN_PTR = INF_ZP ;inflate_zp    ?
OP_PTR = $F2 ;outputPointer ?
GB_BUF = $F4 ;getBit_buffer
GB_BAS = $F5 ;getBits_base
IST_PC = $F6 ;inflateStored_pageCounter
ICO_SP = $F7 ;inflateCodes_sourcePointer

GET_1B = $81
GET_2B = $82
GET_3B = $84
GET_4B = $88
GET_5B = $90
GET_6B = $a0
GET_7B = $c0

.BYTE $FF
.BYTE $FF
.BYTE $00
.BYTE $B7
.BYTE $FB
.BYTE $BB
LDY #$00 ;getBit_buffer
STY $F4
STY $F5
LDA #GET_3B
JSR $B8A2 ;getBits
LSR A
PHP
BNE $0832 ;inflateCompressed
LDY #$00
STY GB_BAS
JSR $B8AB
081A   20 AB B8   JSR $B8AB
081D   85 F5      STA $F5
081F   B0 06      BCS $0827
0821   20 AF B8   JSR $B8AF
0824   20 D1 B8   JSR $B8D1
0827   E8         INX
0828   D0 F7      BNE $0821
082A   E6 F5      INC $F5
082C   D0 F3      BNE $0821
082E   28         PLP
082F   90 D9      BCC $080A
0831   60         RTS
0832   49 02      EOR #$02
0834   AA         TAX
0835   F0 05      BEQ $083C
0837   A9 04      LDA #$04
0839   C0 90      CPY #$90
083B   2A         ROL A
083C   99 00 B9   STA $B900,Y
083F   F0 0A      BEQ $084B
0841   A9 15      LDA #$15
0843   C0 20      CPY #$20
0845   B0 04      BCS $084B
0847   C0 18      CPY #$18
0849   69 F2      ADC #$F2
084B   C0 3E      CPY #$3E
084D   B0 03      BCS $0852
084F   99 00 BA   STA $BA00,Y
0852   C8         INY
0853   D0 DF      BNE $0834
0855   AA         TAX
0856   D0 44      BNE $089C
0858   20 F6 B7   JSR $B7F6
085B   86 F6      STX $F6
085D   08         PHP
085E   20 66 B8   JSR $B866
0861   10 13      BPL $0876
0863   AA         TAX
0864   20 A2 B8   JSR $B8A2
0867   E0 84      CPX #$84
0869   90 06      BCC $0871
086B   F0 02      BEQ $086F
086D   69 07      ADC #$07
086F   84 F7      STY $F7
0871   A8         TAY
0872   A5 F7      LDA $F7
0874   C8         INY
0875   C8         INY
0876   C8         INY
0877   28         PLP
0878   A6 F6      LDX $F6
087A   90 0D      BCC $0889
087C   9D 00 B9   STA $B900,X
087F   E8         INX
0880   E0 01      CPX #$01
0882   88         DEY
0883   D0 F5      BNE $087A
0885   85 F7      STA $F7
0887   F0 D2      BEQ $085B
0889   E4 F9      CPX $F9
088B   90 06      BCC $0893
088D   D0 02      BNE $0891
088F   A2 20      LDX #$20
0891   09 10      ORA #$10
0893   9D 00 BA   STA $BA00,X
0896   E8         INX
0897   E4 F8      CPX $F8
0899   90 E7      BCC $0882
089B   88         DEY
089C   20 18 B8   JSR $B818
089F   F0 03      BEQ $08A4
08A1   20 D1 B8   JSR $B8D1
08A4   20 66 B8   JSR $B866
08A7   90 F8      BCC $08A1
08A9   F0 83      BEQ $082E
08AB   84 F5      STY $F5
08AD   C9 09      CMP #$09
08AF   90 14      BCC $08C5
08B1   98         TYA
08B2   E0 1D      CPX #$1D
08B4   B0 0F      BCS $08C5
08B6   CA         DEX
08B7   8A         TXA
08B8   4A         LSR A
08B9   66 F5      ROR $F5
08BB   E6 F5      INC $F5
08BD   4A         LSR A
08BE   26 F5      ROL $F5
08C0   20 98 B8   JSR $B898
08C3   69 00      ADC #$00
08C5   85 F8      STA $F8
08C7   A2 10      LDX #$10
08C9   20 68 B8   JSR $B868
08CC   C9 04      CMP #$04
08CE   90 06      BCC $08D6
08D0   E6 F5      INC $F5
08D2   4A         LSR A
08D3   20 98 B8   JSR $B898
08D6   49 FF      EOR #$FF
08D8   85 F6      STA $F6
08DA   A5 F5      LDA $F5
08DC   E0 0A      CPX #$0A
08DE   90 07      BCC $08E7
08E0   BD D2 B8   LDA $B8D2,X
08E3   20 A2 B8   JSR $B8A2
08E6   18         CLC
08E7   49 FF      EOR #$FF
08E9   65 F3      ADC $F3
08EB   85 F7      STA $F7
08ED   20 CB B8   JSR $B8CB
08F0   20 CB B8   JSR $B8CB
08F3   20 CB B8   JSR $B8CB
08F6   C6 F8      DEC $F8
08F8   D0 F9      BNE $08F3
08FA   F0 A8      BEQ $08A4
08FC   A2 03      LDX #$03
08FE   BD F5 B8   LDA $B8F5,X
0901   20 A2 B8   JSR $B8A2
0904   7D F8 B8   ADC $B8F8,X
0907   95 F6      STA $F6,X
0909   CA         DEX
090A   D0 F2      BNE $08FE
090C   A9 84      LDA #$84
090E   20 A2 B8   JSR $B8A2
0911   BC E3 B8   LDY $B8E3,X
0914   99 00 B9   STA $B900,Y
0917   A0 00      LDY #$00
0919   E8         INX
091A   E4 F7      CPX $F7
091C   90 EE      BCC $090C
091E   98         TYA
091F   99 3E BA   STA $BA3E,Y
0922   C8         INY
0923   D0 FA      BNE $091F
0925   BE 00 B9   LDX $B900,Y
0928   FE 3E BA   INC $BA3E,X
092B   D0 03      BNE $0930
092D   8E BE BA   STX $BABE
0930   C0 3E      CPY #$3E
0932   B0 06      BCS $093A
0934   BE 00 BA   LDX $BA00,Y
0937   FE 5E BA   INC $BA5E,X
093A   C8         INY
093B   D0 E8      BNE $0925
093D   A2 C0      LDX #$C0
093F   9D BE B9   STA $B9BE,X
0942   18         CLC
0943   7D 7E B9   ADC $B97E,X
0946   E8         INX
0947   D0 F6      BNE $093F
0949   98         TYA
094A   BE 00 B9   LDX $B900,Y
094D   BC 7E BA   LDY $BA7E,X
0950   FE 7E BA   INC $BA7E,X
0953   99 BF BA   STA $BABF,Y
0956   A8         TAY
0957   C0 3E      CPY #$3E
0959   B0 0D      BCS $0968
095B   BE 00 BA   LDX $BA00,Y
095E   BC 9E BA   LDY $BA9E,X
0961   FE 9E BA   INC $BA9E,X
0964   99 BF BB   STA $BBBF,Y
0967   A8         TAY
0968   C8         INY
0969   D0 DE      BNE $0949
096B   60         RTS
096C   A2 00      LDX #$00
096E   98         TYA
096F   20 B8 B8   JSR $B8B8
0972   2A         ROL A
0973   E8         INX
0974   B0 14      BCS $098A
0976   EC BE BA   CPX $BABE
0979   F0 0D      BEQ $0988
097B   38         SEC
097C   FD 3E BA   SBC $BA3E,X
097F   B0 0D      BCS $098E
0981   7D 7E BA   ADC $BA7E,X
0984   AA         TAX
0985   BD BF BA   LDA $BABF,X
0988   18         CLC
0989   60         RTS
098A   FD 3E BA   SBC $BA3E,X
098D   38         SEC
098E   FD 5E BA   SBC $BA5E,X
0991   B0 DC      BCS $096F
0993   7D 9E BA   ADC $BA9E,X
0996   AA         TAX
0997   BD BF BB   LDA $BBBF,X
099A   29 1F      AND #$1F
099C   AA         TAX
099D   60         RTS
099E   26 F5      ROL $F5
09A0   AA         TAX
09A1   C9 09      CMP #$09
09A3   B0 10      BCS $09B5
09A5   BD DA B8   LDA $B8DA,X
09A8   20 B1 B8   JSR $B8B1
09AB   46 F5      LSR $F5
09AD   6A         ROR A
09AE   90 FB      BCC $09AB
09B0   60         RTS
09B1   20 AF B8   JSR $B8AF
09B4   AA         TAX
09B5   A9 80      LDA #$80
09B7   20 B8 B8   JSR $B8B8
09BA   6A         ROR A
09BB   90 FA      BCC $09B7
09BD   60         RTS
09BE   46 F4      LSR $F4
09C0   D0 0E      BNE $09D0
09C2   48         PHA
09C3   B1 F0      LDA ($F0),Y
09C5   E6 F0      INC $F0
09C7   D0 02      BNE $09CB
09C9   E6 F1      INC $F1
09CB   38         SEC
09CC   6A         ROR A
09CD   85 F4      STA $F4
09CF   68         PLA
09D0   60         RTS
09D1   A4 F2      LDY $F2
09D3   B1 F6      LDA ($F6),Y
09D5   A0 00      LDY #$00
09D7   91 F2      STA ($F2),Y
09D9   E6 F2      INC $F2
09DB   D0 04      BNE $09E1
09DD   E6 F3      INC $F3
09DF   E6 F7      INC $F7
09E1   60         RTS
09E2   81 82      STA ($82,X)
09E4   84 88      STY $88
09E6   90 A0      BCC $0988
09E8   C0 82      CPY #$82
09EA   84 C0      STY $C0
09EC   00         BRK
09ED   08         PHP
09EE   07         ???
09EF   09 06      ORA #$06
09F1   0A         ASL A
09F2   05 0B      ORA $0B
09F4   04         ???
09F5   0C         ???
09F6   03         ???
09F7   0D 02 0E   ORA $0E02
09FA   01 0F      ORA ($0F,X)
09FC   88         DEY
09FD   90 90      BCC $098F
09FF   03         ???
0A00   20 00 00   JSR $0000
0A03              .END
