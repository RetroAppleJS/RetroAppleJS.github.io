; inflate - uncompress data stored in the DEFLATE format
; by Piotr Fusik <fox@scene.pl>
; Last modified: 2017-11-07
;
; ASM_core.js compatible port of the original XASM source.
; XASM pseudo-commands and pseudo-addressing modes have been expanded
; to ordinary NMOS 6502 instructions. Algorithm is otherwise unchanged.
;
; Memory layout corresponding to the user's requested $0800 load address:
inflate                         = $0800
inflate_data                    = $0A00
inflate_zp                      = $F0

; Pointer to compressed data
inputPointer                    = inflate_zp    ; 2 bytes

; Pointer to uncompressed data
outputPointer                   = inflate_zp+2  ; 2 bytes

; Local variables
getBit_buffer                   = inflate_zp+4  ; 1 byte

getBits_base                    = inflate_zp+5  ; 1 byte
inflateStored_pageCounter       = inflate_zp+5  ; 1 byte

inflateCodes_sourcePointer      = inflate_zp+6  ; 2 bytes
inflateDynamic_symbol           = inflate_zp+6  ; 1 byte
inflateDynamic_lastLength       = inflate_zp+7  ; 1 byte
inflateDynamic_tempCodes        = inflate_zp+7  ; 1 byte

inflateCodes_lengthMinus2       = inflate_zp+8  ; 1 byte
inflateDynamic_allCodes         = inflate_zp+8  ; 1 byte

inflateDynamic_primaryCodes     = inflate_zp+9  ; 1 byte

; Argument values for getBits
GET_1_BIT                       = $81
GET_2_BITS                      = $82
GET_3_BITS                      = $84
GET_4_BITS                      = $88
GET_5_BITS                      = $90
GET_6_BITS                      = $A0
GET_7_BITS                      = $C0

; Huffman trees
TREE_SIZE                       = 16
PRIMARY_TREE                    = 0
DISTANCE_TREE                   = TREE_SIZE

; Alphabet
LENGTH_SYMBOLS                  = 1+29+2
DISTANCE_SYMBOLS                = 30
CONTROL_SYMBOLS                 = LENGTH_SYMBOLS+DISTANCE_SYMBOLS

; Uncompress DEFLATE stream starting from the address stored in inputPointer
; to the memory starting from the address stored in outputPointer
        ORG     inflate

        LDY     #0              ; XASM: mvy #0,getBit_buffer
        STY     getBit_buffer
inflate_blockLoop
; Get a bit of EOF and two bits of block type
;       ldy     #0
        STY     getBits_base
        LDA     #GET_3_BITS
        JSR     getBits
        LSR     A
        PHP
        BNE     inflateCompressed

; Copy uncompressed block
;       ldy     #0
        STY     getBit_buffer  ; ignore bits until byte boundary
        JSR     getWord        ; skip the length we don't need
        JSR     getWord        ; get the one's complement length
        STA     inflateStored_pageCounter
;       jmp     inflateStored_firstByte
        BCS     inflateStored_firstByte
inflateStored_copyByte
        JSR     getByte
        JSR     storeByte
inflateStored_firstByte
        INX
        BNE     inflateStored_copyByte
        INC     inflateStored_pageCounter
        BNE     inflateStored_copyByte

inflate_nextBlock
        PLP
        BCC     inflate_blockLoop
        RTS

inflateCompressed
; A=1: fixed block, initialize with fixed codes
; A=2: dynamic block, start by clearing all code lengths
; A=3: invalid compressed data, not handled in this routine
        EOR     #2

;       ldy     #0
inflateCompressed_setCodeLengths
        TAX
        BEQ     inflateCompressed_setLiteralCodeLength
; fixed Huffman literal codes:
; :144 dta 8
; :112 dta 9
        LDA     #4
        CPY     #144
        ROL     A
inflateCompressed_setLiteralCodeLength
        STA     literalSymbolCodeLength,y
        BEQ     inflateCompressed_setControlCodeLength
; fixed Huffman control codes:
; :24  dta 7
; :6   dta 8
; :2   dta 8 ; meaningless codes
; :30  dta 5+DISTANCE_TREE
        LDA     #5+DISTANCE_TREE
        CPY     #LENGTH_SYMBOLS
        BCS     inflateCompressed_setControlCodeLength
        CPY     #24
        ADC     #2-DISTANCE_TREE
inflateCompressed_setControlCodeLength
        CPY     #CONTROL_SYMBOLS
        BCS     inflateCompressed_skipControlStore ; XASM: scs:sta
        STA     controlSymbolCodeLength,y
inflateCompressed_skipControlStore
        INY
        BNE     inflateCompressed_setCodeLengths

        TAX
        BNE     inflateCodes

; Decompress a block reading Huffman trees first

; Build the tree for temporary codes
        JSR     buildTempHuffmanTree

; Use temporary codes to get lengths of literal/length and distance codes
;       ldx     #0
;       sec
inflateDynamic_decodeLength
; C=1: literal codes
; C=0: control codes
        STX     inflateDynamic_symbol
        PHP
; Fetch a temporary code
        JSR     fetchPrimaryCode
; Temporary code 0..15: put this length
        BPL     inflateDynamic_verbatimLength
; Temporary code 16: repeat last length 3 + getBits(2) times
; Temporary code 17: put zero length 3 + getBits(3) times
; Temporary code 18: put zero length 11 + getBits(7) times
        TAX
        JSR     getBits
        CPX     #GET_3_BITS
        BCC     inflateDynamic_repeatLast
        BEQ     inflateDynamic_skipAdd7          ; XASM: seq:adc #7
        ADC     #7
inflateDynamic_skipAdd7
;       ldy     #0
        STY     inflateDynamic_lastLength
inflateDynamic_repeatLast
        TAY
        LDA     inflateDynamic_lastLength
        INY                                         ; XASM: iny:iny
        INY
inflateDynamic_verbatimLength
        INY
        PLP
        LDX     inflateDynamic_symbol
inflateDynamic_storeLength
        BCC     inflateDynamic_controlSymbolCodeLength
        STA     literalSymbolCodeLength,x           ; XASM: ...,x+
        INX
        CPX     #1
inflateDynamic_storeNext
        DEY
        BNE     inflateDynamic_storeLength
        STA     inflateDynamic_lastLength
;       jmp     inflateDynamic_decodeLength
        BEQ     inflateDynamic_decodeLength
inflateDynamic_controlSymbolCodeLength
        CPX     inflateDynamic_primaryCodes
        BCC     inflateDynamic_storeControl
; the code lengths we skip here were zero-initialized
; in inflateCompressed_setControlCodeLength
        BNE     inflateDynamic_skipResetControlIndex ; XASM: sne:ldx
        LDX     #LENGTH_SYMBOLS
inflateDynamic_skipResetControlIndex
        ORA     #DISTANCE_TREE
inflateDynamic_storeControl
        STA     controlSymbolCodeLength,x            ; XASM: ...,x+
        INX
        CPX     inflateDynamic_allCodes
        BCC     inflateDynamic_storeNext
        DEY
;       ldy     #0

; Decompress a block
inflateCodes
        JSR     buildHuffmanTree
;       jmp     inflateCodes_loop
        BEQ     inflateCodes_loop
inflateCodes_literal
        JSR     storeByte
inflateCodes_loop
        JSR     fetchPrimaryCode
        BCC     inflateCodes_literal
        BEQ     inflate_nextBlock
; Copy sequence from look-behind buffer
;       ldy     #0
        STY     getBits_base
        CMP     #9
        BCC     inflateCodes_setSequenceLength
        TYA
;       lda     #0
        CPX     #1+28
        BCS     inflateCodes_setSequenceLength
        DEX
        TXA
        LSR     A
        ROR     getBits_base
        INC     getBits_base
        LSR     A
        ROL     getBits_base
        JSR     getAMinus1BitsMax8
;       sec
        ADC     #0
inflateCodes_setSequenceLength
        STA     inflateCodes_lengthMinus2
        LDX     #DISTANCE_TREE
        JSR     fetchCode
        CMP     #4
        BCC     inflateCodes_setOffsetLowByte
        INC     getBits_base
        LSR     A
        JSR     getAMinus1BitsMax8
inflateCodes_setOffsetLowByte
        EOR     #$FF
        STA     inflateCodes_sourcePointer
        LDA     getBits_base
        CPX     #10
        BCC     inflateCodes_setOffsetHighByte
        LDA     getNPlus1Bits_mask-10,x
        JSR     getBits
        CLC
inflateCodes_setOffsetHighByte
        EOR     #$FF
;       clc
        ADC     outputPointer+1
        STA     inflateCodes_sourcePointer+1
        JSR     copyByte
        JSR     copyByte
inflateCodes_copyByte
        JSR     copyByte
        DEC     inflateCodes_lengthMinus2
        BNE     inflateCodes_copyByte
;       jmp     inflateCodes_loop
        BEQ     inflateCodes_loop

; Get dynamic block header and use it to build the temporary tree
buildTempHuffmanTree
;       ldy     #0
; numberOfPrimaryCodes = 257 + getBits(5)
; numberOfDistanceCodes = 1 + getBits(5)
; numberOfTemporaryCodes = 4 + getBits(4)
        LDX     #3
inflateDynamic_getHeader
        LDA     inflateDynamic_headerBits-1,x
        JSR     getBits
;       sec
        ADC     inflateDynamic_headerBase-1,x
        STA     inflateDynamic_tempCodes-1,x
        DEX
        BNE     inflateDynamic_getHeader

; Get lengths of temporary codes in the order stored in inflateDynamic_tempSymbols
;       ldx     #0
inflateDynamic_getTempCodeLengths
        LDA     #GET_3_BITS
        JSR     getBits
        LDY     inflateDynamic_tempSymbols,x
        STA     literalSymbolCodeLength,y
        LDY     #0
        INX
        CPX     inflateDynamic_tempCodes
        BCC     inflateDynamic_getTempCodeLengths

; Build Huffman trees basing on code lengths (in bits)
; stored in the *SymbolCodeLength arrays
buildHuffmanTree
; Clear nBitCode_literalCount, nBitCode_controlCount
        TYA
;       lda     #0
buildHuffmanTree_clearCounts
        STA     nBitCode_clearFrom,y                ; XASM: sta:rne ...,y+
        INY
        BNE     buildHuffmanTree_clearCounts
; Count number of codes of each length
;       ldy     #0
buildHuffmanTree_countCodeLengths
        LDX     literalSymbolCodeLength,y
        INC     nBitCode_literalCount,x
        BNE     buildHuffmanTree_notAllLiterals     ; XASM: sne:stx
        STX     allLiteralsCodeLength
buildHuffmanTree_notAllLiterals
        CPY     #CONTROL_SYMBOLS
        BCS     buildHuffmanTree_noControlSymbol
        LDX     controlSymbolCodeLength,y
        INC     nBitCode_controlCount,x
buildHuffmanTree_noControlSymbol
        INY
        BNE     buildHuffmanTree_countCodeLengths
; Calculate offsets of symbols sorted by code length
;       lda     #0
        LDX     #-4*TREE_SIZE
buildHuffmanTree_calculateOffsets
        STA     nBitCode_literalOffset+4*TREE_SIZE-$100,x
        CLC                                         ; XASM: add
        ADC     nBitCode_literalCount+4*TREE_SIZE-$100,x
        INX
        BNE     buildHuffmanTree_calculateOffsets
; Put symbols in their place in the sorted array
;       ldy     #0
buildHuffmanTree_assignCode
        TYA
        LDX     literalSymbolCodeLength,y
        LDY     nBitCode_literalOffset,x            ; XASM: ldy:inc
        INC     nBitCode_literalOffset,x
        STA     codeToLiteralSymbol,y
        TAY
        CPY     #CONTROL_SYMBOLS
        BCS     buildHuffmanTree_noControlSymbol2
        LDX     controlSymbolCodeLength,y
        LDY     nBitCode_controlOffset,x            ; XASM: ldy:inc
        INC     nBitCode_controlOffset,x
        STA     codeToControlSymbol,y
        TAY
buildHuffmanTree_noControlSymbol2
        INY
        BNE     buildHuffmanTree_assignCode
        RTS

; Read Huffman code using the primary tree
fetchPrimaryCode
        LDX     #PRIMARY_TREE
; Read a code from input using the tree specified in X,
; return low byte of this code in A,
; return C flag reset for literal code, set for length code
fetchCode
;       ldy     #0
        TYA
fetchCode_nextBit
        JSR     getBit
        ROL     A
        INX
        BCS     fetchCode_ge256
; are all 256 literal codes of this length?
        CPX     allLiteralsCodeLength
        BEQ     fetchCode_allLiterals
; is it literal code of length X?
        SEC                                         ; XASM: sub
        SBC     nBitCode_literalCount,x
        BCS     fetchCode_notLiteral
; literal code
;       clc
        ADC     nBitCode_literalOffset,x
        TAX
        LDA     codeToLiteralSymbol,x
fetchCode_allLiterals
        CLC
        RTS
; code >= 256, must be control
fetchCode_ge256
;       sec
        SBC     nBitCode_literalCount,x
        SEC
; is it control code of length X?
fetchCode_notLiteral
;       sec
        SBC     nBitCode_controlCount,x
        BCS     fetchCode_nextBit
; control code
;       clc
        ADC     nBitCode_controlOffset,x
        TAX
        LDA     codeToControlSymbol,x
        AND     #$1F       ; make distance symbols zero-based
        TAX
;       sec
        RTS

; Read A minus 1 bits, but no more than 8
getAMinus1BitsMax8
        ROL     getBits_base
        TAX
        CMP     #9
        BCS     getByte
        LDA     getNPlus1Bits_mask-2,x
getBits
        JSR     getBits_loop
getBits_normalizeLoop
        LSR     getBits_base
        ROR     A
        BCC     getBits_normalizeLoop
        RTS

; Read 16 bits
getWord
        JSR     getByte
        TAX
; Read 8 bits
getByte
        LDA     #$80
getBits_loop
        JSR     getBit
        ROR     A
        BCC     getBits_loop
        RTS

; Read one bit, return in the C flag
getBit
        LSR     getBit_buffer
        BNE     getBit_return
        PHA
;       ldy     #0
        LDA     (inputPointer),y
        INC     inputPointer                       ; XASM: inw inputPointer
        BNE     getBit_inputPointerIncremented
        INC     inputPointer+1
getBit_inputPointerIncremented
        SEC
        ROR     A
        STA     getBit_buffer
        PLA
getBit_return
        RTS

; Copy a previously written byte
copyByte
        LDY     outputPointer
        LDA     (inflateCodes_sourcePointer),y
        LDY     #0
; Write a byte
storeByte
;       ldy     #0
        STA     (outputPointer),y
        INC     outputPointer
        BNE     storeByte_return
        INC     outputPointer+1
        INC     inflateCodes_sourcePointer+1
storeByte_return
        RTS

getNPlus1Bits_mask
        .BYTE   GET_1_BIT,GET_2_BITS,GET_3_BITS,GET_4_BITS,GET_5_BITS,GET_6_BITS,GET_7_BITS

inflateDynamic_tempSymbols
        .BYTE   GET_2_BITS,GET_3_BITS,GET_7_BITS,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15

inflateDynamic_headerBits
        .BYTE   GET_4_BITS,GET_5_BITS,GET_5_BITS
inflateDynamic_headerBase
        .BYTE   3,LENGTH_SYMBOLS,0

        ORG     inflate_data

; Data for building trees
literalSymbolCodeLength
        ORG     *+256
controlSymbolCodeLength
        ORG     *+CONTROL_SYMBOLS

; Huffman trees
nBitCode_clearFrom
nBitCode_literalCount
        ORG     *+2*TREE_SIZE
nBitCode_controlCount
        ORG     *+2*TREE_SIZE
nBitCode_literalOffset
        ORG     *+2*TREE_SIZE
nBitCode_controlOffset
        ORG     *+2*TREE_SIZE
allLiteralsCodeLength
        ORG     *+1

codeToLiteralSymbol
        ORG     *+256
codeToControlSymbol
        ORG     *+CONTROL_SYMBOLS



; ============================================================================
; ASM_core.js regression test harness
; ============================================================================
;
; Entry point:       test_start = $0D00
; Inflater:          inflate    = $0800
; Workspace:         $0A00-$0CFC
; Test result bytes: $7000-$7004
; Output buffer:     $7100
; Test vectors:      $1000+
;
; Results after the harness reaches test_done:
;   $7000 = number of tests passed (expected $03)
;   $7001 = stored-block test  ($01 PASS, $00 FAIL)
;   $7002 = fixed-Huffman test ($01 PASS, $00 FAIL)
;   $7003 = dynamic-Huffman test ($01 PASS, $00 FAIL)
;   $7004 = completion signature ($A5 all pass, $5A one or more failed)
;
; All vectors are RFC 1951 RAW DEFLATE streams: no zlib or gzip wrapper.
; The low three bits of the first compressed byte explicitly select:
;   stored  : $01 & 7 = 1 = BFINAL 1, BTYPE 00
;   fixed   : $73 & 7 = 3 = BFINAL 1, BTYPE 01
;   dynamic : $15 & 7 = 5 = BFINAL 1, BTYPE 10
;
; The vectors were generated independently with zlib raw-DEFLATE mode and
; verified by decoding them again with wbits=-15.
;

TEST_HARNESS                   = $0D00
TEST_RESULTS                   = $7000
TEST_OUTPUT                    = $7100

; Harness-private zero-page bytes.  These do not overlap inflate_zp ($F0-$F9).
testExpectedPointer            = $EA       ; 2 bytes
testExpectedLength             = $EC       ; 1 byte

STORED_EXPECTED_LEN            = 16
FIXED_EXPECTED_LEN             = 46
DYNAMIC_EXPECTED_LEN           = 67

        ORG     TEST_HARNESS

test_start
        CLD

; Clear result bytes.
        LDA     #0
        STA     TEST_RESULTS
        STA     TEST_RESULTS+1
        STA     TEST_RESULTS+2
        STA     TEST_RESULTS+3
        STA     TEST_RESULTS+4

; --------------------------------------------------------------------------
; Test 1: final STORED block (BTYPE=00)
; Expected text: "STORED BLOCK OK\n"
; --------------------------------------------------------------------------
        LDA     #<testStoredDeflate
        STA     inputPointer
        LDA     #>testStoredDeflate
        STA     inputPointer+1
        JSR     testResetOutputPointer
        JSR     inflate

        LDA     #<testStoredExpected
        STA     testExpectedPointer
        LDA     #>testStoredExpected
        STA     testExpectedPointer+1
        LDA     #STORED_EXPECTED_LEN
        STA     testExpectedLength
        JSR     testVerifyOutput
        STA     TEST_RESULTS+1

; --------------------------------------------------------------------------
; Test 2: final FIXED-HUFFMAN block (BTYPE=01)
; Expected text: "FIXED HUFFMAN BLOCK: ABCABCABCABCABCABCABCABC\n"
; --------------------------------------------------------------------------
        LDA     #<testFixedDeflate
        STA     inputPointer
        LDA     #>testFixedDeflate
        STA     inputPointer+1
        JSR     testResetOutputPointer
        JSR     inflate

        LDA     #<testFixedExpected
        STA     testExpectedPointer
        LDA     #>testFixedExpected
        STA     testExpectedPointer+1
        LDA     #FIXED_EXPECTED_LEN
        STA     testExpectedLength
        JSR     testVerifyOutput
        STA     TEST_RESULTS+2

; --------------------------------------------------------------------------
; Test 3: final DYNAMIC-HUFFMAN block (BTYPE=10)
; Expected text:
; "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu "
; --------------------------------------------------------------------------
        LDA     #<testDynamicDeflate
        STA     inputPointer
        LDA     #>testDynamicDeflate
        STA     inputPointer+1
        JSR     testResetOutputPointer
        JSR     inflate

        LDA     #<testDynamicExpected
        STA     testExpectedPointer
        LDA     #>testDynamicExpected
        STA     testExpectedPointer+1
        LDA     #DYNAMIC_EXPECTED_LEN
        STA     testExpectedLength
        JSR     testVerifyOutput
        STA     TEST_RESULTS+3

; Build a one-byte summary count.
        CLC
        LDA     TEST_RESULTS+1
        ADC     TEST_RESULTS+2
        ADC     TEST_RESULTS+3
        STA     TEST_RESULTS
        CMP     #3
        BNE     test_failed

        LDA     #$A5
        STA     TEST_RESULTS+4
        JMP     test_done

test_failed
        LDA     #$5A
        STA     TEST_RESULTS+4

test_done
; Stable stop point for emulator/debugger inspection.
        JMP     test_done

; Set inflater output pointer back to the common test buffer.
testResetOutputPointer
        LDA     #<TEST_OUTPUT
        STA     outputPointer
        LDA     #>TEST_OUTPUT
        STA     outputPointer+1
        RTS

; Verify both produced length and every output byte.
; Returns A=$01 on success, A=$00 on failure.
testVerifyOutput
; Because TEST_OUTPUT is page aligned and all expected vectors are <256 bytes,
; the expected end address is $71xx with low byte = testExpectedLength.
        LDA     outputPointer+1
        CMP     #>TEST_OUTPUT
        BNE     testVerifyFail
        LDA     outputPointer
        CMP     testExpectedLength
        BNE     testVerifyFail

        LDY     #0
testVerifyLoop
        LDA     TEST_OUTPUT,y
        CMP     (testExpectedPointer),y
        BNE     testVerifyFail
        INY
        CPY     testExpectedLength
        BNE     testVerifyLoop

        LDA     #1
        RTS

testVerifyFail
        LDA     #0
        RTS

; ============================================================================
; Known raw-DEFLATE vectors
; ============================================================================
        ORG     $1000

; Test 1 compressed length = 21 bytes.
; Raw DEFLATE, level 0 / stored block.
testStoredDeflate
        .BYTE   $01,$10,$00,$EF,$FF,$53,$54,$4F,$52,$45,$44,$20,$42,$4C,$4F,$43
        .BYTE   $4B,$20,$4F,$4B,$0A
testStoredDeflateEnd

; Test 1 expected output = 16 bytes: "STORED BLOCK OK\n"
testStoredExpected
        .BYTE   $53,$54,$4F,$52,$45,$44,$20,$42,$4C,$4F,$43,$4B,$20,$4F,$4B,$0A
testStoredExpectedEnd

; Test 2 compressed length = 28 bytes.
; Raw DEFLATE forced to fixed Huffman coding.
testFixedDeflate
        .BYTE   $73,$F3,$8C,$70,$75,$51,$F0,$08,$75,$73,$F3,$75,$F4,$53,$70,$F2
        .BYTE   $F1,$77,$F6,$B6,$52,$70,$74,$72,$C6,$8A,$B8,$00
testFixedDeflateEnd

; Test 2 expected output = 46 bytes:
; "FIXED HUFFMAN BLOCK: ABCABCABCABCABCABCABCABC\n"
testFixedExpected
        .BYTE   $46,$49,$58,$45,$44,$20,$48,$55,$46,$46,$4D,$41,$4E,$20,$42,$4C
        .BYTE   $4F,$43,$4B,$3A,$20,$41,$42,$43,$41,$42,$43,$41,$42,$43,$41,$42
        .BYTE   $43,$41,$42,$43,$41,$42,$43,$41,$42,$43,$41,$42,$43,$0A
testFixedExpectedEnd

; Test 3 compressed length = 54 bytes.
; Raw DEFLATE using a dynamic Huffman tree.
testDynamicDeflate
        .BYTE   $15,$89,$C1,$09,$00,$20,$0C,$C4,$56,$B9,$D5,$4E,$2C,$2A,$B6,$5A
        .BYTE   $50,$3F,$4E,$AF,$7D,$24,$04,$42,$F5,$4A,$24,$D9,$44,$A1,$19,$91
        .BYTE   $45,$7F,$8B,$AF,$A6,$73,$E0,$C6,$08,$76,$0D,$B7,$F9,$D5,$E9,$4E
        .BYTE   $28,$2D,$65,$C2,$0E,$1E
testDynamicDeflateEnd

; Test 3 expected output = 67 bytes:
; "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu "
testDynamicExpected
        .BYTE   $61,$6C,$70,$68,$61,$20,$62,$65,$74,$61,$20,$67,$61,$6D,$6D,$61
        .BYTE   $20,$64,$65,$6C,$74,$61,$20,$65,$70,$73,$69,$6C,$6F,$6E,$20,$7A
        .BYTE   $65,$74,$61,$20,$65,$74,$61,$20,$74,$68,$65,$74,$61,$20,$69,$6F
        .BYTE   $74,$61,$20,$6B,$61,$70,$70,$61,$20,$6C,$61,$6D,$62,$64,$61,$20
        .BYTE   $6D,$75,$20
testDynamicExpectedEnd

        .END
