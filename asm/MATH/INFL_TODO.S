
;Source: inflate.asx
;    1                           ; compile instruction
;    2                           ; xasm inflate.asx -l inflate.txt
;    3                           
;    4                           
;    5                           
;    6 =     6000                INFLAT                  equ $6000
;    7 =     6300                INFL_D                  equ $6300
;    8 =     00F0                INF_ZP                  equ $f0
;    9                           
;   10                           
;   11                           
;   12                           
;   13                           ; inflate - uncompress data stored in the DEFLATE format
;   14                           ; by Piotr Fusik <fox@scene.pl>
;   15                           ; Last modified: 2017-11-07
;   16                           
;   17                           ; Compile with xasm (http://xasm.atari.org/), for example:
;   18                           ; xasm inflate.asx /l /d:inflate=$b700 /d:INFL_D=$b900 /d:INF_ZP=$f0
;   19                           ; inflate is 508 bytes of code and constants
;   20                           ; INFL_D is 765 bytes of uninitialized data
;   21                           ; INF_ZP is 10 bytes on page zero
;   22                           
;   23                           
;   24                           ; Pointer to compressed data
;   25 =     00F0                IN_PTR     equ	INF_ZP    ; 2 bytes
;   26                           
;   27                           ; Pointer to uncompressed data
;   28 =     00F2                OP_PTR     equ	INF_ZP+2  ; 2 bytes
;   29                           
;   30                           ; Local variables
;   31                           
;   32 =     00F4                GB_BUF     equ	INF_ZP+4  ; 1 byte
;   33                           
;   34 =     00F5                GB_BAS     equ	INF_ZP+5  ; 1 byte
;   35 =     00F5                IST_PC     equ	INF_ZP+5  ; 1 byte
;   36                           
;   37 =     00F6                ICO_SP     equ	INF_ZP+6  ; 2 bytes
;   38 =     00F6                IDY_SY     equ	INF_ZP+6  ; 1 byte
;   39 =     00F7                IDY_LL     equ	INF_ZP+7  ; 1 byte
;   40 =     00F7                IDY_TC     equ	INF_ZP+7  ; 1 byte
;   41                           
;   42 =     00F8                ICO_LM     equ	INF_ZP+8  ; 1 byte
;   43 =     00F8                IDY_AC     equ	INF_ZP+8  ; 1 byte
;   44                           
;   45 =     00F9                IDY_PC     equ	INF_ZP+9  ; 1 byte
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
;   68                           ; Uncompress DEFLATE stream starting from the address stored in IN_PTR
;   69                           ; to the memory starting from the address stored in OP_PTR
;   70 FFFF> 6000-61FB>          	org	INFLAT
;   71 6000 A0 00 84 F4          	mvy	#0	GB_BUF
;   72 6004                      inflate_blockLoop
;   73                           ; Get a bit of EOF and two bits of block type
;   74                           ;	ldy	#0
;   75 6004 84 F5                	sty	GB_BAS
;   76 6006 A9 84                	lda	#GET_3_BITS
;   77 6008 20 A2 61             	jsr	getBits
;   78 600B 4A                   	lsr	@
;   79 600C 08                   	php
;   80 600D D0 1D                	bne	inflateCompressed
;   81                           
;   82                           ; Copy uncompressed block
;   83                           ;	ldy	#0
;   84 600F 84 F4                	sty	GB_BUF  ; ignore bits until byte boundary
;   85 6011 20 AB 61             	jsr	getWord        ; skip the length we don't need
;   86 6014 20 AB 61             	jsr	getWord        ; get the one's complement length
;   87 6017 85 F5                	sta	IST_PC
;   88                           ;	jmp	inflateStored_firstByte
;   89 6019 B0 06                	bcs	inflateStored_firstByte
;   90 601B                      inflateStored_copyByte
;   91 601B 20 AF 61             	jsr	getByte
;   92 601E 20 D1 61             	jsr	storeByte
;   93 6021                      inflateStored_firstByte
;   94 6021 E8                   	inx
;   95 6022 D0 F7                	bne	inflateStored_copyByte
;   96 6024 E6 F5                	inc	IST_PC
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
;  153 6055 86 F6                	stx	IDY_SY
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
;  176 6072 A6 F6                	ldx	IDY_SY
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
;  188 6083 E4 F9                	cpx	IDY_PC
;  189 6085 90 06                	bcc	inflateDynamic_storeControl
;  190                           ; the code lengths we skip here were zero-initialized
;  191                           ; in inflateCompressed_setControlCodeLength
;  192 6087 D0 02 A2 20          	sne:ldx	#LENGTH_SYMBOLS
;  193 608B 09 10                	ora	#DISTANCE_TREE
;  194 608D                      inflateDynamic_storeControl
;  195 608D 9D 00 64 E8          	sta	controlSymbolCodeLength,x+
;  196 6091 E4 F8                	cpx	IDY_AC
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
;  214 60A5 84 F5                	sty	GB_BAS
;  215 60A7 C9 09                	cmp	#9
;  216 60A9 90 14                	bcc	inflateCodes_setSequenceLength
;  217 60AB 98                   	tya
;  218                           ;	lda	#0
;  219 60AC E0 1D                	cpx	#1+28
;  220 60AE B0 0F                	bcs	inflateCodes_setSequenceLength
;  221 60B0 CA                   	dex
;  222 60B1 8A                   	txa
;  223 60B2 4A                   	lsr	@
;  224 60B3 66 F5                	ror	GB_BAS
;  225 60B5 E6 F5                	inc	GB_BAS
;  226 60B7 4A                   	lsr	@
;  227 60B8 26 F5                	rol	GB_BAS
;  228 60BA 20 98 61             	jsr	getAMinus1BitsMax8
;  229                           ;	sec
;  230 60BD 69 00                	adc	#0
;  231 60BF                      inflateCodes_setSequenceLength
;  232 60BF 85 F8                	sta	ICO_LM
;  233 60C1 A2 10                	ldx	#DISTANCE_TREE
;  234 60C3 20 68 61             	jsr	fetchCode
;  235 60C6 C9 04                	cmp	#4
;  236 60C8 90 06                	bcc	inflateCodes_setOffsetLowByte
;  237 60CA E6 F5                	inc	GB_BAS
;  238 60CC 4A                   	lsr	@
;  239 60CD 20 98 61             	jsr	getAMinus1BitsMax8
;  240 60D0                      inflateCodes_setOffsetLowByte
;  241 60D0 49 FF                	eor	#$ff
;  242 60D2 85 F6                	sta	ICO_SP
;  243 60D4 A5 F5                	lda	GB_BAS
;  244 60D6 E0 0A                	cpx	#10
;  245 60D8 90 07                	bcc	inflateCodes_setOffsetHighByte
;  246 60DA BD D2 61             	lda	getNPlus1Bits_mask-10,x
;  247 60DD 20 A2 61             	jsr	getBits
;  248 60E0 18                   	clc
;  249 60E1                      inflateCodes_setOffsetHighByte
;  250 60E1 49 FF                	eor	#$ff
;  251                           ;	clc
;  252 60E3 65 F3                	adc	OP_PTR+1
;  253 60E5 85 F7                	sta	ICO_SP+1
;  254 60E7 20 CB 61             	jsr	copyByte
;  255 60EA 20 CB 61             	jsr	copyByte
;  256 60ED                      inflateCodes_copyByte
;  257 60ED 20 CB 61             	jsr	copyByte
;  258 60F0 C6 F8                	dec	ICO_LM
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
;  275 6101 95 F6                	sta	IDY_TC-1,x
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
;  288 6114 E4 F7                	cpx	IDY_TC
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
;  388 6198 26 F5                	rol	GB_BAS
;  389 619A AA                   	tax
;  390 619B C9 09                	cmp	#9
;  391 619D B0 10                	bcs	getByte
;  392 619F BD DA 61             	lda	getNPlus1Bits_mask-2,x
;  393 61A2                      getBits
;  394 61A2 20 B1 61             	jsr	getBits_loop
;  395 61A5                      getBits_normalizeLoop
;  396 61A5 46 F5                	lsr	GB_BAS
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
;  416 61B8 46 F4                	lsr	GB_BUF
;  417 61BA D0 0E                	bne	getBit_return
;  418 61BC 48                   	pha
;  419                           ;	ldy	#0
;  420 61BD B1 F0                	lda	(IN_PTR),y
;  421 61BF E6 F0 D0 02 E6 F1    	inw	IN_PTR
;  422 61C5 38                   	sec
;  423 61C6 6A                   	ror	@
;  424 61C7 85 F4                	sta	GB_BUF
;  425 61C9 68                   	pla
;  426 61CA                      getBit_return
;  427 61CA 60                   	rts
;  428                           
;  429                           ; Copy a previously written byte
;  430 61CB                      copyByte
;  431 61CB A4 F2                	ldy	OP_PTR
;  432 61CD B1 F6                	lda	(ICO_SP),y
;  433 61CF A0 00                	ldy	#0
;  434                           ; Write a byte
;  435 61D1                      storeByte
;  436                           ;	ldy	#0
;  437 61D1 91 F2                	sta	(OP_PTR),y
;  438 61D3 E6 F2                	inc	OP_PTR
;  439 61D5 D0 04                	bne	storeByte_return
;  440 61D7 E6 F3                	inc	OP_PTR+1
;  441 61D9 E6 F7                	inc	ICO_SP+1
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
;  456 61FC                      	org	INFL_D
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





6000:A0 00 84 F4
6004:84 F5
6006:A9 84
6008:20 A2 61
600B:4A
600C:08
600D:D0 1D
600F:84 F4
6011:20 AB 61
6014:20 AB 61
6017:85 F5
6019:B0 06
601B:20 AF 61
601E:20 D1 61
6021:E8
6022:D0 F7
6024:E6 F5
6026:D0 F3
6028:28
6029:90 D9
602B:60
602C:49 02
602E:AA
602F:F0 05
6031:A9 04
6033:C0 90
6035:2A
6036:99 00 63
6039:F0 0A
603B:A9 15
603D:C0 20
603F:B0 04
6041:C0 18
6043:69 F2
6045:C0 3E
6047:B0 03 99 00 64
604C:C8
604D:D0 DF
604F:AA
6050:D0 44
6052:20 F6 60
6055:86 F6
6057:08
6058:20 66 61
605B:10 13
605D:AA
605E:20 A2 61
6061:E0 84
6063:90 06
6065:F0 02 69 07
6069:84 F7
606B:A8
606C:A5 F7
606E:C8 C8
6070:C8
6071:28
6072:A6 F6
6074:90 0D
6076:9D 00 63 E8
607A:E0 01
607C:88
607D:D0 F5
607F:85 F7
6081:F0 D2
6083:E4 F9
6085:90 06
6087:D0 02 A2 20
608B:09 10
608D:9D 00 64 E8
6091:E4 F8
6093:90 E7
6095:88
6096:20 18 61
6099:F0 03
609B:20 D1 61
609E:20 66 61
60A1:90 F8
60A3:F0 83
60A5:84 F5
60A7:C9 09
60A9:90 14
60AB:98
60AC:E0 1D
60AE:B0 0F
60B0:CA
60B1:8A
60B2:4A
60B3:66 F5
60B5:E6 F5
60B7:4A
60B8:26 F5
60BA:20 98 61
60BD:69 00
60BF:85 F8
60C1:A2 10
60C3:20 68 61
60C6:C9 04
60C8:90 06
60CA:E6 F5
60CC:4A
60CD:20 98 61
60D0:49 FF
60D2:85 F6
60D4:A5 F5
60D6:E0 0A
60D8:90 07
60DA:BD D2 61
60DD:20 A2 61
60E0:18
60E1:49 FF
60E3:65 F3
60E5:85 F7
60E7:20 CB 61
60EA:20 CB 61
60ED:20 CB 61
60F0:C6 F8
60F2:D0 F9
60F4:F0 A8
60F6:A2 03
60F8:BD F5 61
60FB:20 A2 61
60FE:7D F8 61
6101:95 F6
6103:CA
6104:D0 F2
6106:A9 84
6108:20 A2 61
610B:BC E3 61
610E:99 00 63
6111:A0 00
6113:E8
6114:E4 F7
6116:90 EE
6118:98
6119:99 3E 64 C8 D0 FA
611F:BE 00 63
6122:FE 3E 64
6125:D0 03 8E BE 64
612A:C0 3E
612C:B0 06
612E:BE 00 64
6131:FE 5E 64
6134:C8
6135:D0 E8
6137:A2 C0
6139:9D BE 63
613C:18 7D 7E 63
6140:E8
6141:D0 F6
6143:98
6144:BE 00 63
6147:BC 7E 64 FE 7E 64
614D:99 BF 64
6150:A8
6151:C0 3E
6153:B0 0D
6155:BE 00 64
6158:BC 9E 64 FE 9E 64
615E:99 BF 65
6161:A8
6162:C8
6163:D0 DE
6165:60
6166:A2 00
6168:98
6169:20 B8 61
616C:2A
616D:E8
616E:B0 14
6170:EC BE 64
6173:F0 0D
6175:38 FD 3E 64
6179:B0 0D
617B:7D 7E 64
617E:AA
617F:BD BF 64
6182:18
6183:60
6184:FD 3E 64
6187:38
6188:FD 5E 64
618B:B0 DC
618D:7D 9E 64
6190:AA
6191:BD BF 65
6194:29 1F
6196:AA
6197:60
6198:26 F5
619A:AA
619B:C9 09
619D:B0 10
619F:BD DA 61
61A2:20 B1 61
61A5:46 F5
61A7:6A
61A8:90 FB
61AA:60
61AB:20 AF 61
61AE:AA
61AF:A9 80
61B1:20 B8 61
61B4:6A
61B5:90 FA
61B7:60
61B8:46 F4
61BA:D0 0E
61BC:48
61BD:B1 F0
61BF:E6 F0 D0 02 E6 F1
61C5:38
61C6:6A
61C7:85 F4
61C9:68
61CA:60
61CB:A4 F2
61CD:B1 F6
61CF:A0 00
61D1:91 F2
61D3:E6 F2
61D5:D0 04
61D7:E6 F3
61D9:E6 F7
61DB:60
61DC:81 82 84 88
61E0:90 A0 C0
61E3:82 84 C0 00 08 07
61E9:09 06 0A 05 0B 04
61EF:0C 03 0D 02 0E 01
61F5:0F
61F6:88 90 90
61F9:03 20 00




6000-   A0 00       LDY   #$00          
6002-   84 F4       STY   $F4           
6004-   84 F5       STY   $F5           
6006-   A9 84       LDA   #$84          
6008-   20 A2 61    JSR   $61A2         
600B-   4A          LSR                 
600C-   08          PHP                 
600D-   D0 1D       BNE   $602C         
600F-   84 F4       STY   $F4           
6011-   20 AB 61    JSR   $61AB         
6014-   20 AB 61    JSR   $61AB         
6017-   85 F5       STA   $F5           
6019-   B0 06       BCS   $6021         
601B-   20 AF 61    JSR   $61AF         
601E-   20 D1 61    JSR   $61D1         
6021-   E8          INX                 
6022-   D0 F7       BNE   $601B         
6024-   E6 F5       INC   $F5           
6026-   D0 F3       BNE   $601B         
6028-   28          PLP                                
6029-   90 D9       BCC   $6004         
602B-   60          RTS                 
602C-   49 02       EOR   #$02          
602E-   AA          TAX                 
602F-   F0 05       BEQ   $6036         
6031-   A9 04       LDA   #$04          
6033-   C0 90       CPY   #$90          
6035-   2A          ROL                 
6036-   99 00 63    STA   $6300,Y       
6039-   F0 0A       BEQ   $6045         
603B-   A9 15       LDA   #$15          
603D-   C0 20       CPY   #$20          
603F-   B0 04       BCS   $6045         
6041-   C0 18       CPY   #$18          
6043-   69 F2       ADC   #$F2          
6045-   C0 3E       CPY   #$3E          
6047-   B0 03       BCS   $604C         
6049-   99 00 64    STA   $6400,Y       
604C-   C8          INY                 
604D-   D0 DF       BNE   $602E                                           
604F-   AA          TAX                 
6050-   D0 44       BNE   $6096         
6052-   20 F6 60    JSR   $60F6         
6055-   86 F6       STX   $F6           
6057-   08          PHP                 
6058-   20 66 61    JSR   $6166         
605B-   10 13       BPL   $6070         
605D-   AA          TAX                 
605E-   20 A2 61    JSR   $61A2         
6061-   E0 84       CPX   #$84          
6063-   90 06       BCC   $606B         
6065-   F0 02       BEQ   $6069         
6067-   69 07       ADC   #$07          
6069-   84 F7       STY   $F7           
606B-   A8          TAY                 
606C-   A5 F7       LDA   $F7           
606E-   C8          INY                 
606F-   C8          INY                 
6070-   C8          INY                 
6071-   28          PLP                                        
6072-   A6 F6       LDX   $F6           
6074-   90 0D       BCC   $6083         
6076-   9D 00 63    STA   $6300,X       
6079-   E8          INX                 
607A-   E0 01       CPX   #$01          
607C-   88          DEY                 
607D-   D0 F5       BNE   $6074         
607F-   85 F7       STA   $F7           
6081-   F0 D2       BEQ   $6055         
6083-   E4 F9       CPX   $F9           
6085-   90 06       BCC   $608D         
6087-   D0 02       BNE   $608B         
6089-   A2 20       LDX   #$20          
608B-   09 10       ORA   #$10          
608D-   9D 00 64    STA   $6400,X       
6090-   E8          INX                 
6091-   E4 F8       CPX   $F8           
6093-   90 E7       BCC   $607C         
6095-   88          DEY                 
6096-   20 18 61    JSR   $6118                                 
6099-   F0 03       BEQ   $609E         
609B-   20 D1 61    JSR   $61D1         
609E-   20 66 61    JSR   $6166         
60A1-   90 F8       BCC   $609B         
60A3-   F0 83       BEQ   $6028         
60A5-   84 F5       STY   $F5           
60A7-   C9 09       CMP   #$09          
60A9-   90 14       BCC   $60BF         
60AB-   98          TYA                 
60AC-   E0 1D       CPX   #$1D          
60AE-   B0 0F       BCS   $60BF         
60B0-   CA          DEX                 
60B1-   8A          TXA                 
60B2-   4A          LSR                 
60B3-   66 F5       ROR   $F5           
60B5-   E6 F5       INC   $F5           
60B7-   4A          LSR                 
60B8-   26 F5       ROL   $F5           
60BA-   20 98 61    JSR   $6198         
60BD-   69 00       ADC   #$00          
60BD-   69 00       ADC   #$00                             
60BF-   85 F8       STA   $F8           
60C1-   A2 10       LDX   #$10          
60C3-   20 68 61    JSR   $6168         
60C6-   C9 04       CMP   #$04          
60C8-   90 06       BCC   $60D0         
60CA-   E6 F5       INC   $F5           
60CC-   4A          LSR                 
60CD-   20 98 61    JSR   $6198         
60D0-   49 FF       EOR   #$FF          
60D2-   85 F6       STA   $F6           
60D4-   A5 F5       LDA   $F5           
60D6-   E0 0A       CPX   #$0A          
60D8-   90 07       BCC   $60E1         
60DA-   BD D2 61    LDA   $61D2,X       
60DD-   20 A2 61    JSR   $61A2         
60E0-   18          CLC                 
60E1-   49 FF       EOR   #$FF          
60E3-   65 F3       ADC   $F3           
60E5-   85 F7       STA   $F7           
60E7-   20 CB 61    JSR   $61CB         
60E7-   20 CB 61    JSR   $61CB                                    
60EA-   20 CB 61    JSR   $61CB         
60ED-   20 CB 61    JSR   $61CB         
60F0-   C6 F8       DEC   $F8           
60F2-   D0 F9       BNE   $60ED         
60F4-   F0 A8       BEQ   $609E         
60F6-   A2 03       LDX   #$03          
60F8-   BD F5 61    LDA   $61F5,X       
60FB-   20 A2 61    JSR   $61A2         
60FE-   7D F8 61    ADC   $61F8,X       
6101-   95 F6       STA   $F6,X         
6103-   CA          DEX                 
6104-   D0 F2       BNE   $60F8         
6106-   A9 84       LDA   #$84          
6108-   20 A2 61    JSR   $61A2         
610B-   BC E3 61    LDY   $61E3,X       
610E-   99 00 63    STA   $6300,Y       
6111-   A0 00       LDY   #$00          
6113-   E8          INX                 
6114-   E4 F7       CPX   $F7           
6116-   90 EE       BCC   $6106                                   
6118-   98          TYA                 
6119-   99 3E 64    STA   $643E,Y       
611C-   C8          INY                 
611D-   D0 FA       BNE   $6119         
611F-   BE 00 63    LDX   $6300,Y       
6122-   FE 3E 64    INC   $643E,X       
6125-   D0 03       BNE   $612A         
6127-   8E BE 64    STX   $64BE         
612A-   C0 3E       CPY   #$3E          
612C-   B0 06       BCS   $6134         
612E-   BE 00 64    LDX   $6400,Y       
6131-   FE 5E 64    INC   $645E,X       
6134-   C8          INY                 
6135-   D0 E8       BNE   $611F         
6137-   A2 C0       LDX   #$C0          
6139-   9D BE 63    STA   $63BE,X       
613C-   18          CLC                 
613D-   7D 7E 63    ADC   $637E,X       
6140-   E8          INX                 
6141-   D0 F6       BNE   $6139                                    
6143-   98          TYA                 
6144-   BE 00 63    LDX   $6300,Y       
6147-   BC 7E 64    LDY   $647E,X       
614A-   FE 7E 64    INC   $647E,X       
614D-   99 BF 64    STA   $64BF,Y       
6150-   A8          TAY                 
6151-   C0 3E       CPY   #$3E          
6153-   B0 0D       BCS   $6162         
6155-   BE 00 64    LDX   $6400,Y       
6158-   BC 9E 64    LDY   $649E,X       
615B-   FE 9E 64    INC   $649E,X       
615E-   99 BF 65    STA   $65BF,Y       
6161-   A8          TAY                 
6162-   C8          INY                 
6163-   D0 DE       BNE   $6143         
6165-   60          RTS                 
6166-   A2 00       LDX   #$00          
6168-   98          TYA                 
6169-   20 B8 61    JSR   $61B8         
616C-   2A          ROL                 
616D-   E8          INX                 
616E-   B0 14       BCS   $6184         
6170-   EC BE 64    CPX   $64BE         
6173-   F0 0D       BEQ   $6182         
6175-   38          SEC                 
6176-   FD 3E 64    SBC   $643E,X       
6179-   B0 0D       BCS   $6188         
617B-   7D 7E 64    ADC   $647E,X       
617E-   AA          TAX                 
617F-   BD BF 64    LDA   $64BF,X       
6182-   18          CLC                 
6183-   60          RTS                 
6184-   FD 3E 64    SBC   $643E,X       
6187-   38          SEC                 
6188-   FD 5E 64    SBC   $645E,X       
618B-   B0 DC       BCS   $6169         
618D-   7D 9E 64    ADC   $649E,X       
6190-   AA          TAX                 
6191-   BD BF 65    LDA   $65BF,X       
6194-   29 1F       AND   #$1F                 
6196-   AA          TAX                 
6197-   60          RTS                 
6198-   26 F5       ROL   $F5           
619A-   AA          TAX                 
619B-   C9 09       CMP   #$09          
619D-   B0 10       BCS   $61AF         
619F-   BD DA 61    LDA   $61DA,X       
61A2-   20 B1 61    JSR   $61B1         
61A5-   46 F5       LSR   $F5           
61A7-   6A          ROR                 
61A8-   90 FB       BCC   $61A5         
61AA-   60          RTS                 
61AB-   20 AF 61    JSR   $61AF         
61AE-   AA          TAX                 
61AF-   A9 80       LDA   #$80          
61B1-   20 B8 61    JSR   $61B8         
61B4-   6A          ROR                 
61B5-   90 FA       BCC   $61B1         
61B7-   60          RTS                                        
61B8-   46 F4       LSR   $F4           
61BA-   D0 0E       BNE   $61CA         
61BC-   48          PHA                 
61BD-   B1 F0       LDA   ($F0),Y       
61BF-   E6 F0       INC   $F0           
61C1-   D0 02       BNE   $61C5         
61C3-   E6 F1       INC   $F1           
61C5-   38          SEC                 
61C6-   6A          ROR                 
61C7-   85 F4       STA   $F4           
61C9-   68          PLA                 
61CA-   60          RTS                 
61CB-   A4 F2       LDY   $F2           
61CD-   B1 F6       LDA   ($F6),Y       
61CF-   A0 00       LDY   #$00          
61D1-   91 F2       STA   ($F2),Y       
61D3-   E6 F2       INC   $F2           
61D5-   D0 04       BNE   $61DB         
61D7-   E6 F3       INC   $F3           
61D9-   E6 F7       INC   $F7           
61D9-   E6 F7       INC   $F7                                      
61DB-   60          RTS                 
61DC-   81 82       STA   ($82,X)       
61DE-   84 88       STY   $88           
61E0-   90 A0       BCC   $6182         
61E2-   C0 82       CPY   #$82          
61E4-   84 C0       STY   $C0           
61E6-   00          BRK                 
61E7-   08          PHP                 
61E8-   07          ???                 
61E9-   09 06       ORA   #$06          
61EB-   0A          ASL                 
61EC-   05 0B       ORA   $0B           
61EE-   04          ???                 
61EF-   0C          ???                 
61F0-   03          ???                 
61F1-   0D 02 0E    ORA   $0E02         
61F4-   01 0F       ORA   ($0F,X)       
61F6-   88          DEY                 
61F7-   90 90       BCC   $6189         
61F9-   03          ???                                                   
61FA-   20 00






