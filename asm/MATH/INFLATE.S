; https://github.com/pfusik/zlib6502/blob/master/inflate.asx

INFLAT = $6000
INFL_D = $6200
INF_ZP  = $00F0



IN_PTR = INF_ZP     ;inflate_zp    ?

OP_PTR = INF_ZP+2   ;outputPointer ?
GB_BUF = INF_ZP+4   ;getBit_buffer
GB_BAS = INF_ZP+5   ;getBits_base
IST_PC = INF_ZP+5   ;inflateStored_pageCounter
ICO_SP = INF_ZP+6   ;inflateCodes_sourcePointer
IDY_SY = INF_ZP+6   ;inflateDynamic_symbol
IDY_LL = INF_ZP+7   ;inflateDynamic_lastLength 
IDY_TC = INF_ZP+7   ;inflateDynamic_tempCodes

ICO_LM = INF_ZP+8   ;inflateCodes_lengthMinus2
IDY_AC = INF_ZP+8   ;inflateDynamic_allCodes 
IDY_PC = INF_ZP+9   ;inflateDynamic_primaryCodes 

GET_1B = $81
GET_2B = $82
GET_3B = $84
GET_4B = $88
GET_5B = $90
GET_6B = $a0
GET_7B = $c0

; Huffman trees
S_TREE = 16
P_TREE = 0
D_TREE = S_TREE

; Alphabet
L_SYM = 1+29+2
D_SYM = 30
C_SYM = L_SYM+D_SYM

ORG INFLAT

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





;Source: inflate.asx
;    1                           ; compile instruction
;    2                           ; xasm inflate.asx -l inflate.txt
;    3                           
;    4                           
;    5                           
;    6 =     6000                inflate                       equ $6000
;    7 =     6300                inflate_data                  equ $6300
;    8 =     00F0                inflate_zp                    equ $f0
;    9                           
;   10                           
;   11                           
;   12                           
;   13                           ; inflate - uncompress data stored in the DEFLATE format
;   14                           ; by Piotr Fusik <fox@scene.pl>
;   15                           ; Last modified: 2017-11-07
;   16                           
;   17                           ; Compile with xasm (http://xasm.atari.org/), for example:
;   18                           ; xasm inflate.asx /l /d:inflate=$b700 /d:inflate_data=$b900 /d:inflate_zp=$f0
;   19                           ; inflate is 508 bytes of code and constants
;   20                           ; inflate_data is 765 bytes of uninitialized data
;   21                           ; inflate_zp is 10 bytes on page zero
;   22                           
;   23                           
;   24                           ; Pointer to compressed data
;   25 =     00F0                IP_PTR                    equ	inflate_zp    ; 2 bytes
;   26                           
;   27                           ; Pointer to uncompressed data
;   28 =     00F2                outputPointer                   equ	inflate_zp+2  ; 2 bytes
;   29                           
;   30                           ; Local variables
;   31                           
;   32 =     00F4                getBit_buffer                   equ	inflate_zp+4  ; 1 byte
;   33                           
;   34 =     00F5                getBits_base                    equ	inflate_zp+5  ; 1 byte
;   35 =     00F5                inflateStored_pageCounter       equ	inflate_zp+5  ; 1 byte
;   36                           
;   37 =     00F6                inflateCodes_sourcePointer      equ	inflate_zp+6  ; 2 bytes
;   38 =     00F6                inflateDynamic_symbol           equ	inflate_zp+6  ; 1 byte
;   39 =     00F7                inflateDynamic_lastLength       equ	inflate_zp+7  ; 1 byte
;   40 =     00F7                inflateDynamic_tempCodes        equ	inflate_zp+7  ; 1 byte
;   41                           
;   42 =     00F8                inflateCodes_lengthMinus2       equ	inflate_zp+8  ; 1 byte
;   43 =     00F8                inflateDynamic_allCodes         equ	inflate_zp+8  ; 1 byte
;   44                           
;   45 =     00F9                inflateDynamic_primaryCodes     equ	inflate_zp+9  ; 1 byte
;   46                           
;   47                           
;   48                           ; Argument values for getBits
;   49 =     0081                GET_1_BIT                       equ	$81
;   50 =     0082                GET_2_BITS                      equ	$82
;   51 =     0084                GET_3_BITS                      equ	$84
;   52 =     0088                GET_4_BITS                      equ	$88
;   53 =     0090                GET_5_BITS                      equ	$90
;   54 =     00A0                GET_6_BITS                      equ	$a0
;   55 =     00C0                GET_7_BITS                      equ	$c0
;   56                           
;   57                           ; Huffman trees
;   58 =     0010                TREE_SIZE                       equ	16
;   59 =     0000                PRIMARY_TREE                    equ	0
;   60 =     0010                DISTANCE_TREE                   equ	TREE_SIZE
;   61                           
;   62                           ; Alphabet
;   63 =     0020                LENGTH_SYMBOLS                  equ	1+29+2
;   64 =     001E                DISTANCE_SYMBOLS                equ	30
;   65 =     003E                CONTROL_SYMBOLS                 equ	LENGTH_SYMBOLS+DISTANCE_SYMBOLS
;   66                           
;   67                           
;   68                           ; Uncompress DEFLATE stream starting from the address stored in IP_PTR
;   69                           ; to the memory starting from the address stored in outputPointer
;   70 FFFF> 6000-61FB>          	org	inflate
;   71 6000 A0 00 84 F4          	mvy	#0	getBit_buffer
;   72 6004                      inflate_blockLoop
;   73                           ; Get a bit of EOF and two bits of block type
;   74                           ;	ldy	#0
;   75 6004 84 F5                	sty	getBits_base
;   76 6006 A9 84                	lda	#GET_3_BITS
;   77 6008 20 A2 61             	jsr	getBits
;   78 600B 4A                   	lsr	@
;   79 600C 08                   	php
;   80 600D D0 1D                	bne	inflateCompressed
;   81                           
;   82                           ; Copy uncompressed block
;   83                           ;	ldy	#0
;   84 600F 84 F4                	sty	getBit_buffer  ; ignore bits until byte boundary
;   85 6011 20 AB 61             	jsr	getWord        ; skip the length we don't need
;   86 6014 20 AB 61             	jsr	getWord        ; get the one's complement length
;   87 6017 85 F5                	sta	inflateStored_pageCounter
;   88                           ;	jmp	inflateStored_firstByte
;   89 6019 B0 06                	bcs	inflateStored_firstByte
;   90 601B                      inflateStored_copyByte
;   91 601B 20 AF 61             	jsr	getByte
;   92 601E 20 D1 61             	jsr	storeByte
;   93 6021                      inflateStored_firstByte
;   94 6021 E8                   	inx
;   95 6022 D0 F7                	bne	inflateStored_copyByte
;   96 6024 E6 F5                	inc	inflateStored_pageCounter
;   97 6026 D0 F3                	bne	inflateStored_copyByte
;   98                           
;   99 6028                      inflate_nextBlock
;  100 6028 28                   	plp
;  101 6029 90 D9                	bcc	inflate_blockLoop
;  102 602B 60                   	rts
;  103                           
;  104 602C                      inflateCompressed
;  105                           ; A=1: fixed block, initialize with fixed codes
;  106                           ; A=2: dynamic block, start by clearing all code lengths
;  107                           ; A=3: invalid compressed data, not handled in this routine
;  108 602C 49 02                	eor	#2
;  109                           
;  110                           ;	ldy	#0
;  111 602E                      inflateCompressed_setCodeLengths
;  112 602E AA                   	tax
;  113 602F F0 05                	beq	inflateCompressed_setLiteralCodeLength
;  114                           ; fixed Huffman literal codes:
;  115                           ; :144 dta 8
;  116                           ; :112 dta 9
;  117 6031 A9 04                	lda	#4
;  118 6033 C0 90                	cpy	#144
;  119 6035 2A                   	rol	@
;  120 6036                      inflateCompressed_setLiteralCodeLength
;  121 6036 99 00 63             	sta	literalSymbolCodeLength,y
;  122 6039 F0 0A                	beq	inflateCompressed_setControlCodeLength
;  123                           ; fixed Huffman control codes:
;  124                           ; :24  dta 7
;  125                           ; :6   dta 8
;  126                           ; :2   dta 8 ; meaningless codes
;  127                           ; :30  dta 5+DISTANCE_TREE
;  128 603B A9 15                	lda	#5+DISTANCE_TREE
;  129 603D C0 20                	cpy	#LENGTH_SYMBOLS
;  130 603F B0 04                	bcs	inflateCompressed_setControlCodeLength
;  131 6041 C0 18                	cpy	#24
;  132 6043 69 F2                	adc	#2-DISTANCE_TREE
;  133 6045                      inflateCompressed_setControlCodeLength
;  134 6045 C0 3E                	cpy	#CONTROL_SYMBOLS
;  135 6047 B0 03 99 00 64       	scs:sta	controlSymbolCodeLength,y
;  136 604C C8                   	iny
;  137 604D D0 DF                	bne	inflateCompressed_setCodeLengths
;  138                           
;  139 604F AA                   	tax
;  140 6050 D0 44                	bne	inflateCodes
;  141                           
;  142                           ; Decompress a block reading Huffman trees first
;  143                           
;  144                           ; Build the tree for temporary codes
;  145 6052 20 F6 60             	jsr	buildTempHuffmanTree
;  146                           
;  147                           ; Use temporary codes to get lengths of literal/length and distance codes
;  148                           ;	ldx	#0
;  149                           ;	sec
;  150 6055                      inflateDynamic_decodeLength
;  151                           ; C=1: literal codes
;  152                           ; C=0: control codes
;  153 6055 86 F6                	stx	inflateDynamic_symbol
;  154 6057 08                   	php
;  155                           ; Fetch a temporary code
;  156 6058 20 66 61             	jsr	fetchPrimaryCode
;  157                           ; Temporary code 0..15: put this length
;  158 605B 10 13                	bpl	inflateDynamic_verbatimLength
;  159                           ; Temporary code 16: repeat last length 3 + getBits(2) times
;  160                           ; Temporary code 17: put zero length 3 + getBits(3) times
;  161                           ; Temporary code 18: put zero length 11 + getBits(7) times
;  162 605D AA                   	tax
;  163 605E 20 A2 61             	jsr	getBits
;  164 6061 E0 84                	cpx	#GET_3_BITS
;  165 6063 90 06                	bcc	inflateDynamic_repeatLast
;  166 6065 F0 02 69 07          	seq:adc	#7
;  167                           ;	ldy	#0
;  168 6069 84 F7                	sty	inflateDynamic_lastLength
;  169 606B                      inflateDynamic_repeatLast
;  170 606B A8                   	tay
;  171 606C A5 F7                	lda	inflateDynamic_lastLength
;  172 606E C8 C8                	iny:iny
;  173 6070                      inflateDynamic_verbatimLength
;  174 6070 C8                   	iny
;  175 6071 28                   	plp
;  176 6072 A6 F6                	ldx	inflateDynamic_symbol
;  177 6074                      inflateDynamic_storeLength
;  178 6074 90 0D                	bcc	inflateDynamic_controlSymbolCodeLength
;  179 6076 9D 00 63 E8          	sta	literalSymbolCodeLength,x+
;  180 607A E0 01                	cpx	#1
;  181 607C                      inflateDynamic_storeNext
;  182 607C 88                   	dey
;  183 607D D0 F5                	bne	inflateDynamic_storeLength
;  184 607F 85 F7                	sta	inflateDynamic_lastLength
;  185                           ;	jmp	inflateDynamic_decodeLength
;  186 6081 F0 D2                	beq	inflateDynamic_decodeLength
;  187 6083                      inflateDynamic_controlSymbolCodeLength
;  188 6083 E4 F9                	cpx	inflateDynamic_primaryCodes
;  189 6085 90 06                	bcc	inflateDynamic_storeControl
;  190                           ; the code lengths we skip here were zero-initialized
;  191                           ; in inflateCompressed_setControlCodeLength
;  192 6087 D0 02 A2 20          	sne:ldx	#LENGTH_SYMBOLS
;  193 608B 09 10                	ora	#DISTANCE_TREE
;  194 608D                      inflateDynamic_storeControl
;  195 608D 9D 00 64 E8          	sta	controlSymbolCodeLength,x+
;  196 6091 E4 F8                	cpx	inflateDynamic_allCodes
;  197 6093 90 E7                	bcc	inflateDynamic_storeNext
;  198 6095 88                   	dey
;  199                           ;	ldy	#0
;  200                           
;  201                           ; Decompress a block
;  202 6096                      inflateCodes
;  203 6096 20 18 61             	jsr	buildHuffmanTree
;  204                           ;	jmp	inflateCodes_loop
;  205 6099 F0 03                	beq	inflateCodes_loop
;  206 609B                      inflateCodes_literal
;  207 609B 20 D1 61             	jsr	storeByte
;  208 609E                      inflateCodes_loop
;  209 609E 20 66 61             	jsr	fetchPrimaryCode
;  210 60A1 90 F8                	bcc	inflateCodes_literal
;  211 60A3 F0 83                	beq	inflate_nextBlock
;  212                           ; Copy sequence from look-behind buffer
;  213                           ;	ldy	#0
;  214 60A5 84 F5                	sty	getBits_base
;  215 60A7 C9 09                	cmp	#9
;  216 60A9 90 14                	bcc	inflateCodes_setSequenceLength
;  217 60AB 98                   	tya
;  218                           ;	lda	#0
;  219 60AC E0 1D                	cpx	#1+28
;  220 60AE B0 0F                	bcs	inflateCodes_setSequenceLength
;  221 60B0 CA                   	dex
;  222 60B1 8A                   	txa
;  223 60B2 4A                   	lsr	@
;  224 60B3 66 F5                	ror	getBits_base
;  225 60B5 E6 F5                	inc	getBits_base
;  226 60B7 4A                   	lsr	@
;  227 60B8 26 F5                	rol	getBits_base
;  228 60BA 20 98 61             	jsr	getAMinus1BitsMax8
;  229                           ;	sec
;  230 60BD 69 00                	adc	#0
;  231 60BF                      inflateCodes_setSequenceLength
;  232 60BF 85 F8                	sta	inflateCodes_lengthMinus2
;  233 60C1 A2 10                	ldx	#DISTANCE_TREE
;  234 60C3 20 68 61             	jsr	fetchCode
;  235 60C6 C9 04                	cmp	#4
;  236 60C8 90 06                	bcc	inflateCodes_setOffsetLowByte
;  237 60CA E6 F5                	inc	getBits_base
;  238 60CC 4A                   	lsr	@
;  239 60CD 20 98 61             	jsr	getAMinus1BitsMax8
;  240 60D0                      inflateCodes_setOffsetLowByte
;  241 60D0 49 FF                	eor	#$ff
;  242 60D2 85 F6                	sta	inflateCodes_sourcePointer
;  243 60D4 A5 F5                	lda	getBits_base
;  244 60D6 E0 0A                	cpx	#10
;  245 60D8 90 07                	bcc	inflateCodes_setOffsetHighByte
;  246 60DA BD D2 61             	lda	getNPlus1Bits_mask-10,x
;  247 60DD 20 A2 61             	jsr	getBits
;  248 60E0 18                   	clc
;  249 60E1                      inflateCodes_setOffsetHighByte
;  250 60E1 49 FF                	eor	#$ff
;  251                           ;	clc
;  252 60E3 65 F3                	adc	outputPointer+1
;  253 60E5 85 F7                	sta	inflateCodes_sourcePointer+1
;  254 60E7 20 CB 61             	jsr	copyByte
;  255 60EA 20 CB 61             	jsr	copyByte
;  256 60ED                      inflateCodes_copyByte
;  257 60ED 20 CB 61             	jsr	copyByte
;  258 60F0 C6 F8                	dec	inflateCodes_lengthMinus2
;  259 60F2 D0 F9                	bne	inflateCodes_copyByte
;  260                           ;	jmp	inflateCodes_loop
;  261 60F4 F0 A8                	beq	inflateCodes_loop
;  262                           
;  263                           ; Get dynamic block header and use it to build the temporary tree
;  264 60F6                      buildTempHuffmanTree
;  265                           ;	ldy	#0
;  266                           ; numberOfPrimaryCodes = 257 + getBits(5)
;  267                           ; numberOfDistanceCodes = 1 + getBits(5)
;  268                           ; numberOfTemporaryCodes = 4 + getBits(4)
;  269 60F6 A2 03                	ldx	#3
;  270 60F8                      inflateDynamic_getHeader
;  271 60F8 BD F5 61             	lda	inflateDynamic_headerBits-1,x
;  272 60FB 20 A2 61             	jsr	getBits
;  273                           ;	sec
;  274 60FE 7D F8 61             	adc	inflateDynamic_headerBase-1,x
;  275 6101 95 F6                	sta	inflateDynamic_tempCodes-1,x
;  276 6103 CA                   	dex
;  277 6104 D0 F2                	bne	inflateDynamic_getHeader
;  278                           
;  279                           ; Get lengths of temporary codes in the order stored in inflateDynamic_tempSymbols
;  280                           ;	ldx	#0
;  281 6106                      inflateDynamic_getTempCodeLengths
;  282 6106 A9 84                	lda	#GET_3_BITS
;  283 6108 20 A2 61             	jsr	getBits
;  284 610B BC E3 61             	ldy	inflateDynamic_tempSymbols,x
;  285 610E 99 00 63             	sta	literalSymbolCodeLength,y
;  286 6111 A0 00                	ldy	#0
;  287 6113 E8                   	inx
;  288 6114 E4 F7                	cpx	inflateDynamic_tempCodes
;  289 6116 90 EE                	bcc	inflateDynamic_getTempCodeLengths
;  290                           
;  291                           ; Build Huffman trees basing on code lengths (in bits)
;  292                           ; stored in the *SymbolCodeLength arrays
;  293 6118                      buildHuffmanTree
;  294                           ; Clear nBitCode_literalCount, nBitCode_controlCount
;  295 6118 98                   	tya
;  296                           ;	lda	#0
;  297 6119 99 3E 64 C8 D0 FA    	sta:rne	nBitCode_clearFrom,y+
;  298                           ; Count number of codes of each length
;  299                           ;	ldy	#0
;  300 611F                      buildHuffmanTree_countCodeLengths
;  301 611F BE 00 63             	ldx	literalSymbolCodeLength,y
;  302 6122 FE 3E 64             	inc	nBitCode_literalCount,x
;  303 6125 D0 03 8E BE 64       	sne:stx	allLiteralsCodeLength
;  304 612A C0 3E                	cpy	#CONTROL_SYMBOLS
;  305 612C B0 06                	bcs	buildHuffmanTree_noControlSymbol
;  306 612E BE 00 64             	ldx	controlSymbolCodeLength,y
;  307 6131 FE 5E 64             	inc	nBitCode_controlCount,x
;  308 6134                      buildHuffmanTree_noControlSymbol
;  309 6134 C8                   	iny
;  310 6135 D0 E8                	bne	buildHuffmanTree_countCodeLengths
;  311                           ; Calculate offsets of symbols sorted by code length
;  312                           ;	lda	#0
;  313 6137 A2 C0                	ldx	#-4*TREE_SIZE
;  314 6139                      buildHuffmanTree_calculateOffsets
;  315 6139 9D BE 63             	sta	nBitCode_literalOffset+4*TREE_SIZE-$100,x
;  316 613C 18 7D 7E 63          	add	nBitCode_literalCount+4*TREE_SIZE-$100,x
;  317 6140 E8                   	inx
;  318 6141 D0 F6                	bne	buildHuffmanTree_calculateOffsets
;  319                           ; Put symbols in their place in the sorted array
;  320                           ;	ldy	#0
;  321 6143                      buildHuffmanTree_assignCode
;  322 6143 98                   	tya
;  323 6144 BE 00 63             	ldx	literalSymbolCodeLength,y
;  324 6147 BC 7E 64 FE 7E 64    	ldy:inc	nBitCode_literalOffset,x
;  325 614D 99 BF 64             	sta	codeToLiteralSymbol,y
;  326 6150 A8                   	tay
;  327 6151 C0 3E                	cpy	#CONTROL_SYMBOLS
;  328 6153 B0 0D                	bcs	buildHuffmanTree_noControlSymbol2
;  329 6155 BE 00 64             	ldx	controlSymbolCodeLength,y
;  330 6158 BC 9E 64 FE 9E 64    	ldy:inc	nBitCode_controlOffset,x
;  331 615E 99 BF 65             	sta	codeToControlSymbol,y
;  332 6161 A8                   	tay
;  333 6162                      buildHuffmanTree_noControlSymbol2
;  334 6162 C8                   	iny
;  335 6163 D0 DE                	bne	buildHuffmanTree_assignCode
;  336 6165 60                   	rts
;  337                           
;  338                           ; Read Huffman code using the primary tree
;  339 6166                      fetchPrimaryCode
;  340 6166 A2 00                	ldx	#PRIMARY_TREE
;  341                           ; Read a code from input using the tree specified in X,
;  342                           ; return low byte of this code in A,
;  343                           ; return C flag reset for literal code, set for length code
;  344 6168                      fetchCode
;  345                           ;	ldy	#0
;  346 6168 98                   	tya
;  347 6169                      fetchCode_nextBit
;  348 6169 20 B8 61             	jsr	getBit
;  349 616C 2A                   	rol	@
;  350 616D E8                   	inx
;  351 616E B0 14                	bcs	fetchCode_ge256
;  352                           ; are all 256 literal codes of this length?
;  353 6170 EC BE 64             	cpx	allLiteralsCodeLength
;  354 6173 F0 0D                	beq	fetchCode_allLiterals
;  355                           ; is it literal code of length X?
;  356 6175 38 FD 3E 64          	sub	nBitCode_literalCount,x
;  357 6179 B0 0D                	bcs	fetchCode_notLiteral
;  358                           ; literal code
;  359                           ;	clc
;  360 617B 7D 7E 64             	adc	nBitCode_literalOffset,x
;  361 617E AA                   	tax
;  362 617F BD BF 64             	lda	codeToLiteralSymbol,x
;  363 6182                      fetchCode_allLiterals
;  364 6182 18                   	clc
;  365 6183 60                   	rts
;  366                           ; code >= 256, must be control
;  367 6184                      fetchCode_ge256
;  368                           ;	sec
;  369 6184 FD 3E 64             	sbc	nBitCode_literalCount,x
;  370 6187 38                   	sec
;  371                           ; is it control code of length X?
;  372 6188                      fetchCode_notLiteral
;  373                           ;	sec
;  374 6188 FD 5E 64             	sbc	nBitCode_controlCount,x
;  375 618B B0 DC                	bcs	fetchCode_nextBit
;  376                           ; control code
;  377                           ;	clc
;  378 618D 7D 9E 64             	adc	nBitCode_controlOffset,x
;  379 6190 AA                   	tax
;  380 6191 BD BF 65             	lda	codeToControlSymbol,x
;  381 6194 29 1F                	and	#$1f	; make distance symbols zero-based
;  382 6196 AA                   	tax
;  383                           ;	sec
;  384 6197 60                   	rts
;  385                           
;  386                           ; Read A minus 1 bits, but no more than 8
;  387 6198                      getAMinus1BitsMax8
;  388 6198 26 F5                	rol	getBits_base
;  389 619A AA                   	tax
;  390 619B C9 09                	cmp	#9
;  391 619D B0 10                	bcs	getByte
;  392 619F BD DA 61             	lda	getNPlus1Bits_mask-2,x
;  393 61A2                      getBits
;  394 61A2 20 B1 61             	jsr	getBits_loop
;  395 61A5                      getBits_normalizeLoop
;  396 61A5 46 F5                	lsr	getBits_base
;  397 61A7 6A                   	ror	@
;  398 61A8 90 FB                	bcc	getBits_normalizeLoop
;  399 61AA 60                   	rts
;  400                           
;  401                           ; Read 16 bits
;  402 61AB                      getWord
;  403 61AB 20 AF 61             	jsr	getByte
;  404 61AE AA                   	tax
;  405                           ; Read 8 bits
;  406 61AF                      getByte
;  407 61AF A9 80                	lda	#$80
;  408 61B1                      getBits_loop
;  409 61B1 20 B8 61             	jsr	getBit
;  410 61B4 6A                   	ror	@
;  411 61B5 90 FA                	bcc	getBits_loop
;  412 61B7 60                   	rts
;  413                           
;  414                           ; Read one bit, return in the C flag
;  415 61B8                      getBit
;  416 61B8 46 F4                	lsr	getBit_buffer
;  417 61BA D0 0E                	bne	getBit_return
;  418 61BC 48                   	pha
;  419                           ;	ldy	#0
;  420 61BD B1 F0                	lda	(IP_PTR),y
;  421 61BF E6 F0 D0 02 E6 F1    	inw	IP_PTR
;  422 61C5 38                   	sec
;  423 61C6 6A                   	ror	@
;  424 61C7 85 F4                	sta	getBit_buffer
;  425 61C9 68                   	pla
;  426 61CA                      getBit_return
;  427 61CA 60                   	rts
;  428                           
;  429                           ; Copy a previously written byte
;  430 61CB                      copyByte
;  431 61CB A4 F2                	ldy	outputPointer
;  432 61CD B1 F6                	lda	(inflateCodes_sourcePointer),y
;  433 61CF A0 00                	ldy	#0
;  434                           ; Write a byte
;  435 61D1                      storeByte
;  436                           ;	ldy	#0
;  437 61D1 91 F2                	sta	(outputPointer),y
;  438 61D3 E6 F2                	inc	outputPointer
;  439 61D5 D0 04                	bne	storeByte_return
;  440 61D7 E6 F3                	inc	outputPointer+1
;  441 61D9 E6 F7                	inc	inflateCodes_sourcePointer+1
;  442 61DB                      storeByte_return
;  443 61DB 60                   	rts
;  444                           
;  445 61DC                      getNPlus1Bits_mask
;  446 61DC 81 82 84 88 90 A0 +  	dta	GET_1_BIT,GET_2_BITS,GET_3_BITS,GET_4_BITS,GET_5_BITS,GET_6_BITS,GET_7_BITS
;  447                           
;  448 61E3                      inflateDynamic_tempSymbols
;  449 61E3 82 84 C0 00 08 07 +  	dta	GET_2_BITS,GET_3_BITS,GET_7_BITS,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15
;  450                           
;  451 61F6                      inflateDynamic_headerBits
;  452 61F6 88 90 90             	dta	GET_4_BITS,GET_5_BITS,GET_5_BITS
;  453 61F9                      inflateDynamic_headerBase
;  454 61F9 03 20 00             	dta	3,LENGTH_SYMBOLS,0
;  455                           
;  456 61FC                      	org	inflate_data
;  457                           
;  458                           ; Data for building trees
;  459                           
;  460 6300                      literalSymbolCodeLength
;  461 6300                      	org	*+256
;  462 6400                      controlSymbolCodeLength
;  463 6400                      	org	*+CONTROL_SYMBOLS
;  464                           
;  465                           ; Huffman trees
;  466                           
;  467 643E                      nBitCode_clearFrom
;  468 643E                      nBitCode_literalCount
;  469 643E                      	org	*+2*TREE_SIZE
;  470 645E                      nBitCode_controlCount
;  471 645E                      	org	*+2*TREE_SIZE
;  472 647E                      nBitCode_literalOffset
;  473 647E                      	org	*+2*TREE_SIZE
;  474 649E                      nBitCode_controlOffset
;  475 649E                      	org	*+2*TREE_SIZE
;  476 64BE                      allLiteralsCodeLength
;  477 64BE                      	org	*+1
;  478                           
;  479 64BF                      codeToLiteralSymbol
;  480 64BF                      	org	*+256
;  481 65BF                      codeToControlSymbol
;  482 65BF                      	org	*+CONTROL_SYMBOLS
;  483                           
;  484 65FD                      	end