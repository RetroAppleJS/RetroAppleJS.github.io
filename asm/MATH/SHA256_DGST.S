; =====================================================================
; SHA256_DGST - SHA-256 preparation stage for Apple II+
; ASM_core.js compatible, load address $6000
;
; Run under DOS 3.3:
;
;       BRUN SHA256_DGST
;
; Then paste 0..55 bytes as hexadecimal at the HEX> prompt.
; Spaces are optional. An empty line represents the empty message.
;
; This version validates the input, builds one correctly padded 64-byte
; SHA-256 block, expands the 64-word schedule, executes all 64 compression
; rounds, and prints the final 256-bit digest.
; =====================================================================

                .ORG $6000

HOME            = $FC58
GETLN           = $FD6A
COUT            = $FDED
CROUT           = $FD8E
PRBYTE          = $FDDA

DOS_WARM        = $03D0
MONITOR         = $FF69

GETLN_BUFFER    = $0200
PROMPT          = $33
STR_PTR         = $06

MAX_INPUT       = 55
BLOCK_SIZE      = 64

; =====================================================================
; ENTRY
; =====================================================================

START
                CLD

                LDA STR_PTR
                STA SAVED_STR_PTR
                LDA STR_PTR+1
                STA SAVED_STR_PTR+1
                LDA PROMPT
                STA SAVED_PROMPT

                JSR SAVE_CALLER_PAGE2

                LDA #<TITLE_TEXT
                STA STR_PTR
                LDA #>TITLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

READ_AGAIN
                JSR CLEAR_SHA_BLOCK

                LDA #$BE
                STA PROMPT

                LDA #<HEX_TEXT
                STA STR_PTR
                LDA #>HEX_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JSR GETLN
                STX LINE_LENGTH

                JSR PARSE_HEX_LINE
                BCC INPUT_VALID

                LDA #<ERROR_TEXT
                STA STR_PTR
                LDA #>ERROR_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JMP READ_AGAIN

INPUT_VALID
                JSR BUILD_PADDED_BLOCK
                JSR SHA256_INIT

                JSR PRINT_METADATA
                JSR PRINT_MESSAGE
                JSR PRINT_PADDED_BLOCK
                JSR PRINT_INITIAL_STATE

                JSR SHA256_COMPRESS
                JSR PRINT_DIGEST

                LDA SAVED_PROMPT
                STA PROMPT
                LDA SAVED_STR_PTR
                STA STR_PTR

                JMP EXIT_PROGRAM

                ; Keep all following routine addresses unchanged from the
                ; previous build. These bytes are never executed.
                NOP
                NOP
                NOP
                NOP

; =====================================================================
; INPUT AND PADDING
; =====================================================================

CLEAR_SHA_BLOCK
                LDX #$00
                LDA #$00

CLEAR_BLOCK_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #BLOCK_SIZE
                BNE CLEAR_BLOCK_LOOP

                STA INPUT_LENGTH
                STA HEX_DIGIT_COUNT
                STA HEX_ACCUMULATOR
                RTS

PARSE_HEX_LINE
                CLD
                LDY #$00

PARSE_LOOP
                CPY LINE_LENGTH
                BEQ PARSE_END

                LDA GETLN_BUFFER,Y
                AND #$7F
                CMP #$20
                BEQ PARSE_NEXT

                JSR HEX_TO_NIBBLE
                BCC PARSE_ERROR
                STA TEMP_NIBBLE

                LDA HEX_DIGIT_COUNT
                BNE PARSE_LOW_NIBBLE

                LDA TEMP_NIBBLE
                STA HEX_ACCUMULATOR
                LDA #$01
                STA HEX_DIGIT_COUNT
                JMP PARSE_NEXT

PARSE_LOW_NIBBLE
                LDA INPUT_LENGTH
                CMP #MAX_INPUT
                BCS PARSE_ERROR

                LDA HEX_ACCUMULATOR
                ASL
                ASL
                ASL
                ASL
                ORA TEMP_NIBBLE

                LDX INPUT_LENGTH
                STA SHA_BLOCK,X
                INC INPUT_LENGTH

                LDA #$00
                STA HEX_DIGIT_COUNT
                STA HEX_ACCUMULATOR

PARSE_NEXT
                INY
                JMP PARSE_LOOP

PARSE_END
                LDA HEX_DIGIT_COUNT
                BNE PARSE_ERROR
                CLC
                RTS

PARSE_ERROR
                SEC
                RTS

HEX_TO_NIBBLE
                CMP #$30
                BCC HEX_INVALID
                CMP #$3A
                BCC HEX_DECIMAL

                CMP #$61
                BCC HEX_UPPER
                CMP #$67
                BCS HEX_UPPER
                AND #$DF

HEX_UPPER
                CMP #$41
                BCC HEX_INVALID
                CMP #$47
                BCS HEX_INVALID
                SEC
                SBC #$37
                SEC
                RTS

HEX_DECIMAL
                SEC
                SBC #$30
                SEC
                RTS

HEX_INVALID
                CLC
                RTS

BUILD_PADDED_BLOCK
                CLD

                LDX INPUT_LENGTH
                LDA #$00

CLEAR_BLOCK_TAIL
                STA SHA_BLOCK,X
                INX
                CPX #BLOCK_SIZE
                BNE CLEAR_BLOCK_TAIL

                LDX INPUT_LENGTH
                LDA #$80
                STA SHA_BLOCK,X

                LDA INPUT_LENGTH
                STA BIT_LENGTH_LO
                LDA #$00
                STA BIT_LENGTH_HI

                ASL BIT_LENGTH_LO
                ROL BIT_LENGTH_HI
                ASL BIT_LENGTH_LO
                ROL BIT_LENGTH_HI
                ASL BIT_LENGTH_LO
                ROL BIT_LENGTH_HI

                LDA BIT_LENGTH_HI
                STA SHA_BLOCK+62
                LDA BIT_LENGTH_LO
                STA SHA_BLOCK+63
                RTS

SHA256_INIT
                CLD
                LDX #$00

SHA256_INIT_LOOP
                LDA SHA_INITIAL_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE SHA256_INIT_LOOP
                RTS

; =====================================================================
; SHA-256 COMPRESSION - ONE 512-BIT BLOCK
;
; Internal word representation is little-endian:
;   byte 0 = least significant byte
;   byte 3 = most significant byte
;
; SHA_BLOCK remains in SHA-256 external byte order. LOAD_SCHEDULE
; reverses each group of four input bytes into W_SCHEDULE.
; =====================================================================

SHA256_COMPRESS
                CLD
                JSR LOAD_SCHEDULE
                JSR EXPAND_SCHEDULE

                LDX #$00

COPY_STATE_TO_WORK
                LDA SHA_STATE,X
                STA WORK_STATE,X
                INX
                CPX #32
                BNE COPY_STATE_TO_WORK

                LDX #$00

SHA256_ROUND_LOOP
                LDY #$03

COPY_E_TO_FUNC
                LDA WORK_E,Y
                STA FUNC_INPUT,Y
                DEY
                BPL COPY_E_TO_FUNC

                JSR BIG_SIGMA1
                JSR COMPUTE_CH

                LDY #$03

COPY_H_TO_T1
                LDA WORK_H,Y
                STA T1_WORD,Y
                DEY
                BPL COPY_H_TO_T1

                JSR ADD_FUNC_TO_T1
                JSR ADD_CH_TO_T1

                CLC
                LDA T1_WORD
                ADC SHA256_K,X
                STA T1_WORD
                LDA T1_WORD+1
                ADC SHA256_K+1,X
                STA T1_WORD+1
                LDA T1_WORD+2
                ADC SHA256_K+2,X
                STA T1_WORD+2
                LDA T1_WORD+3
                ADC SHA256_K+3,X
                STA T1_WORD+3

                CLC
                LDA T1_WORD
                ADC W_SCHEDULE,X
                STA T1_WORD
                LDA T1_WORD+1
                ADC W_SCHEDULE+1,X
                STA T1_WORD+1
                LDA T1_WORD+2
                ADC W_SCHEDULE+2,X
                STA T1_WORD+2
                LDA T1_WORD+3
                ADC W_SCHEDULE+3,X
                STA T1_WORD+3

                LDY #$03

COPY_A_TO_FUNC
                LDA WORK_A,Y
                STA FUNC_INPUT,Y
                DEY
                BPL COPY_A_TO_FUNC

                JSR BIG_SIGMA0
                JSR COMPUTE_MAJ

                LDY #$03

COPY_FUNC_TO_T2
                LDA FUNC_OUTPUT,Y
                STA T2_WORD,Y
                DEY
                BPL COPY_FUNC_TO_T2

                JSR ADD_MAJ_TO_T2

                LDY #$03

COPY_D_TO_NEW_E
                LDA WORK_D,Y
                STA NEW_E_WORD,Y
                DEY
                BPL COPY_D_TO_NEW_E

                JSR ADD_T1_TO_NEW_E
                JSR ADD_T2_TO_T1

                LDY #$00

ROTATE_WORK_STATE
                LDA WORK_G,Y
                STA WORK_H,Y
                LDA WORK_F,Y
                STA WORK_G,Y
                LDA WORK_E,Y
                STA WORK_F,Y
                LDA NEW_E_WORD,Y
                STA WORK_E,Y
                LDA WORK_C,Y
                STA WORK_D,Y
                LDA WORK_B,Y
                STA WORK_C,Y
                LDA WORK_A,Y
                STA WORK_B,Y
                LDA T1_WORD,Y
                STA WORK_A,Y
                INY
                CPY #$04
                BNE ROTATE_WORK_STATE

                TXA
                CLC
                ADC #$04
                TAX
                BEQ SHA256_ROUNDS_DONE
                JMP SHA256_ROUND_LOOP

SHA256_ROUNDS_DONE
                LDX #$00

ADD_WORK_TO_STATE
                CLC
                LDA SHA_STATE,X
                ADC WORK_STATE,X
                STA SHA_STATE,X
                LDA SHA_STATE+1,X
                ADC WORK_STATE+1,X
                STA SHA_STATE+1,X
                LDA SHA_STATE+2,X
                ADC WORK_STATE+2,X
                STA SHA_STATE+2,X
                LDA SHA_STATE+3,X
                ADC WORK_STATE+3,X
                STA SHA_STATE+3,X

                TXA
                CLC
                ADC #$04
                TAX
                CPX #$20
                BNE ADD_WORK_TO_STATE
                RTS

; ---------------------------------------------------------------------
; LOAD_SCHEDULE
;
; W[0..15] = sixteen big-endian words from SHA_BLOCK, converted to
; little-endian storage.
; ---------------------------------------------------------------------

LOAD_SCHEDULE
                LDX #$00

LOAD_SCHEDULE_LOOP
                LDA SHA_BLOCK+3,X
                STA W_SCHEDULE,X
                LDA SHA_BLOCK+2,X
                STA W_SCHEDULE+1,X
                LDA SHA_BLOCK+1,X
                STA W_SCHEDULE+2,X
                LDA SHA_BLOCK,X
                STA W_SCHEDULE+3,X

                TXA
                CLC
                ADC #$04
                TAX
                CPX #$40
                BNE LOAD_SCHEDULE_LOOP
                RTS

; ---------------------------------------------------------------------
; EXPAND_SCHEDULE
;
; For t = 16..63:
;   W[t] = sigma1(W[t-2]) + W[t-7]
;        + sigma0(W[t-15]) + W[t-16]  mod 2^32
;
; X is the byte offset t*4. The negative label offsets are safe because
; expansion starts at byte offset 64.
; ---------------------------------------------------------------------

EXPAND_SCHEDULE
                LDX #$40

EXPAND_SCHEDULE_LOOP
                LDA W_SCHEDULE-8,X
                STA FUNC_INPUT
                LDA W_SCHEDULE-7,X
                STA FUNC_INPUT+1
                LDA W_SCHEDULE-6,X
                STA FUNC_INPUT+2
                LDA W_SCHEDULE-5,X
                STA FUNC_INPUT+3
                JSR SMALL_SIGMA1

                LDA W_SCHEDULE-64,X
                STA SUM_WORD
                LDA W_SCHEDULE-63,X
                STA SUM_WORD+1
                LDA W_SCHEDULE-62,X
                STA SUM_WORD+2
                LDA W_SCHEDULE-61,X
                STA SUM_WORD+3

                CLC
                LDA SUM_WORD
                ADC W_SCHEDULE-28,X
                STA SUM_WORD
                LDA SUM_WORD+1
                ADC W_SCHEDULE-27,X
                STA SUM_WORD+1
                LDA SUM_WORD+2
                ADC W_SCHEDULE-26,X
                STA SUM_WORD+2
                LDA SUM_WORD+3
                ADC W_SCHEDULE-25,X
                STA SUM_WORD+3

                JSR ADD_FUNC_TO_SUM

                LDA W_SCHEDULE-60,X
                STA FUNC_INPUT
                LDA W_SCHEDULE-59,X
                STA FUNC_INPUT+1
                LDA W_SCHEDULE-58,X
                STA FUNC_INPUT+2
                LDA W_SCHEDULE-57,X
                STA FUNC_INPUT+3
                JSR SMALL_SIGMA0
                JSR ADD_FUNC_TO_SUM

                LDA SUM_WORD
                STA W_SCHEDULE,X
                LDA SUM_WORD+1
                STA W_SCHEDULE+1,X
                LDA SUM_WORD+2
                STA W_SCHEDULE+2,X
                LDA SUM_WORD+3
                STA W_SCHEDULE+3,X

                TXA
                CLC
                ADC #$04
                TAX
                BEQ EXPAND_SCHEDULE_DONE
                JMP EXPAND_SCHEDULE_LOOP

EXPAND_SCHEDULE_DONE
                RTS

; =====================================================================
; SHA-256 WORD FUNCTIONS
; =====================================================================

BIG_SIGMA0
                JSR COPY_FUNC_TO_ROT
                LDA #$02
                JSR ROTR_ROT_WORD
                JSR COPY_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$0D
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$16
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT
                RTS

BIG_SIGMA1
                JSR COPY_FUNC_TO_ROT
                LDA #$06
                JSR ROTR_ROT_WORD
                JSR COPY_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$0B
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$19
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT
                RTS

SMALL_SIGMA0
                JSR COPY_FUNC_TO_ROT
                LDA #$07
                JSR ROTR_ROT_WORD
                JSR COPY_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$12
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$03
                JSR SHR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT
                RTS

SMALL_SIGMA1
                JSR COPY_FUNC_TO_ROT
                LDA #$11
                JSR ROTR_ROT_WORD
                JSR COPY_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$13
                JSR ROTR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT

                JSR COPY_FUNC_TO_ROT
                LDA #$0A
                JSR SHR_ROT_WORD
                JSR XOR_ROT_TO_OUTPUT
                RTS

COPY_FUNC_TO_ROT
                LDY #$03

COPY_FUNC_TO_ROT_LOOP
                LDA FUNC_INPUT,Y
                STA ROT_WORD,Y
                DEY
                BPL COPY_FUNC_TO_ROT_LOOP
                RTS

COPY_ROT_TO_OUTPUT
                LDY #$03

COPY_ROT_TO_OUTPUT_LOOP
                LDA ROT_WORD,Y
                STA FUNC_OUTPUT,Y
                DEY
                BPL COPY_ROT_TO_OUTPUT_LOOP
                RTS

XOR_ROT_TO_OUTPUT
                LDY #$03

XOR_ROT_TO_OUTPUT_LOOP
                LDA FUNC_OUTPUT,Y
                EOR ROT_WORD,Y
                STA FUNC_OUTPUT,Y
                DEY
                BPL XOR_ROT_TO_OUTPUT_LOOP
                RTS

ROTR_ROT_WORD
                STA SHIFT_COUNT

ROTR_ROT_LOOP
                LDA ROT_WORD
                LSR
                ROR ROT_WORD+3
                ROR ROT_WORD+2
                ROR ROT_WORD+1
                ROR ROT_WORD
                DEC SHIFT_COUNT
                BNE ROTR_ROT_LOOP
                RTS

SHR_ROT_WORD
                STA SHIFT_COUNT

SHR_ROT_LOOP
                LSR ROT_WORD+3
                ROR ROT_WORD+2
                ROR ROT_WORD+1
                ROR ROT_WORD
                DEC SHIFT_COUNT
                BNE SHR_ROT_LOOP
                RTS

COMPUTE_CH
                LDY #$00

COMPUTE_CH_LOOP
                LDA WORK_E,Y
                EOR #$FF
                AND WORK_G,Y
                STA BOOL_TEMP
                LDA WORK_E,Y
                AND WORK_F,Y
                EOR BOOL_TEMP
                STA CH_WORD,Y
                INY
                CPY #$04
                BNE COMPUTE_CH_LOOP
                RTS

COMPUTE_MAJ
                LDY #$00

COMPUTE_MAJ_LOOP
                LDA WORK_A,Y
                AND WORK_B,Y
                STA BOOL_TEMP
                LDA WORK_A,Y
                AND WORK_C,Y
                EOR BOOL_TEMP
                STA BOOL_TEMP
                LDA WORK_B,Y
                AND WORK_C,Y
                EOR BOOL_TEMP
                STA MAJ_WORD,Y
                INY
                CPY #$04
                BNE COMPUTE_MAJ_LOOP
                RTS

; =====================================================================
; MODULO-2^32 ADDITION HELPERS
;
; Each helper starts with CLC and propagates carry through four bytes.
; Carry leaving byte 3 is intentionally discarded.
; =====================================================================

ADD_FUNC_TO_SUM
                CLC
                LDA SUM_WORD
                ADC FUNC_OUTPUT
                STA SUM_WORD
                LDA SUM_WORD+1
                ADC FUNC_OUTPUT+1
                STA SUM_WORD+1
                LDA SUM_WORD+2
                ADC FUNC_OUTPUT+2
                STA SUM_WORD+2
                LDA SUM_WORD+3
                ADC FUNC_OUTPUT+3
                STA SUM_WORD+3
                RTS

ADD_FUNC_TO_T1
                CLC
                LDA T1_WORD
                ADC FUNC_OUTPUT
                STA T1_WORD
                LDA T1_WORD+1
                ADC FUNC_OUTPUT+1
                STA T1_WORD+1
                LDA T1_WORD+2
                ADC FUNC_OUTPUT+2
                STA T1_WORD+2
                LDA T1_WORD+3
                ADC FUNC_OUTPUT+3
                STA T1_WORD+3
                RTS

ADD_CH_TO_T1
                CLC
                LDA T1_WORD
                ADC CH_WORD
                STA T1_WORD
                LDA T1_WORD+1
                ADC CH_WORD+1
                STA T1_WORD+1
                LDA T1_WORD+2
                ADC CH_WORD+2
                STA T1_WORD+2
                LDA T1_WORD+3
                ADC CH_WORD+3
                STA T1_WORD+3
                RTS

ADD_MAJ_TO_T2
                CLC
                LDA T2_WORD
                ADC MAJ_WORD
                STA T2_WORD
                LDA T2_WORD+1
                ADC MAJ_WORD+1
                STA T2_WORD+1
                LDA T2_WORD+2
                ADC MAJ_WORD+2
                STA T2_WORD+2
                LDA T2_WORD+3
                ADC MAJ_WORD+3
                STA T2_WORD+3
                RTS

ADD_T1_TO_NEW_E
                CLC
                LDA NEW_E_WORD
                ADC T1_WORD
                STA NEW_E_WORD
                LDA NEW_E_WORD+1
                ADC T1_WORD+1
                STA NEW_E_WORD+1
                LDA NEW_E_WORD+2
                ADC T1_WORD+2
                STA NEW_E_WORD+2
                LDA NEW_E_WORD+3
                ADC T1_WORD+3
                STA NEW_E_WORD+3
                RTS

ADD_T2_TO_T1
                CLC
                LDA T1_WORD
                ADC T2_WORD
                STA T1_WORD
                LDA T1_WORD+1
                ADC T2_WORD+1
                STA T1_WORD+1
                LDA T1_WORD+2
                ADC T2_WORD+2
                STA T1_WORD+2
                LDA T1_WORD+3
                ADC T2_WORD+3
                STA T1_WORD+3
                RTS

; =====================================================================
; OUTPUT
; =====================================================================

PRINT_METADATA
                JSR CROUT

                LDA #<METADATA_TEXT
                STA STR_PTR
                LDA #>METADATA_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA INPUT_LENGTH
                JSR PRBYTE
                JSR CROUT

                LDA #<BIT_COUNT_TEXT
                STA STR_PTR
                LDA #>BIT_COUNT_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #$00
                JSR PRBYTE
                LDA #$00
                JSR PRBYTE
                LDA BIT_LENGTH_HI
                JSR PRBYTE
                LDA BIT_LENGTH_LO
                JSR PRBYTE
                JSR CROUT

                LDA #<BLOCK_COUNT_TEXT
                STA STR_PTR
                LDA #>BLOCK_COUNT_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_MESSAGE
                JSR CROUT

                LDA #<MESSAGE_TEXT
                STA STR_PTR
                LDA #>MESSAGE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDX #$00

PRINT_MESSAGE_LOOP
                CPX INPUT_LENGTH
                BEQ PRINT_MESSAGE_DONE

                LDA SHA_BLOCK,X
                JSR PRBYTE
                LDA #$A0
                JSR COUT
                INX

                TXA
                AND #$07
                BNE PRINT_MESSAGE_LOOP
                JSR CROUT
                JMP PRINT_MESSAGE_LOOP

PRINT_MESSAGE_DONE
                JSR CROUT
                RTS

PRINT_PADDED_BLOCK
                JSR CROUT

                LDA #<PADDED_TEXT
                STA STR_PTR
                LDA #>PADDED_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDX #$00

PRINT_BLOCK_LOOP
                LDA SHA_BLOCK,X
                JSR PRBYTE
                LDA #$A0
                JSR COUT
                INX

                TXA
                AND #$07
                BNE PRINT_BLOCK_CONTINUE
                JSR CROUT

PRINT_BLOCK_CONTINUE
                CPX #BLOCK_SIZE
                BNE PRINT_BLOCK_LOOP
                RTS

PRINT_INITIAL_STATE
                JSR CROUT

                LDA #<STATE_TEXT
                STA STR_PTR
                LDA #>STATE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDX #$00

PRINT_STATE_WORD
                LDA SHA_STATE+3,X
                JSR PRBYTE
                LDA SHA_STATE+2,X
                JSR PRBYTE
                LDA SHA_STATE+1,X
                JSR PRBYTE
                LDA SHA_STATE,X
                JSR PRBYTE

                TXA
                CLC
                ADC #$04
                TAX

                CPX #$20
                BEQ PRINT_STATE_DONE
                CPX #$10
                BEQ PRINT_STATE_NEW_ROW

                LDA #$A0
                JSR COUT
                JMP PRINT_STATE_WORD

PRINT_STATE_NEW_ROW
                JSR CROUT
                JMP PRINT_STATE_WORD

PRINT_STATE_DONE
                JSR CROUT
                RTS


PRINT_DIGEST
                JSR CROUT

                LDA #<DIGEST_TEXT
                STA STR_PTR
                LDA #>DIGEST_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDX #$00

PRINT_DIGEST_WORD
                LDA SHA_STATE+3,X
                JSR PRBYTE
                LDA SHA_STATE+2,X
                JSR PRBYTE
                LDA SHA_STATE+1,X
                JSR PRBYTE
                LDA SHA_STATE,X
                JSR PRBYTE

                TXA
                CLC
                ADC #$04
                TAX

                CPX #$20
                BEQ PRINT_DIGEST_DONE
                CPX #$10
                BEQ PRINT_DIGEST_NEW_ROW

                LDA #$A0
                JSR COUT
                JMP PRINT_DIGEST_WORD

PRINT_DIGEST_NEW_ROW
                JSR CROUT
                JMP PRINT_DIGEST_WORD

PRINT_DIGEST_DONE
                JSR CROUT
                RTS

PRINT_STRING
                LDY #$00

PRINT_STRING_LOOP
                LDA (STR_PTR),Y
                BEQ PRINT_STRING_DONE
                ORA #$80
                JSR COUT
                INY
                BNE PRINT_STRING_LOOP

PRINT_STRING_DONE
                RTS

; =====================================================================
; TEXT AND DATA
; =====================================================================

TITLE_TEXT
                .BYTE "APPLE II+ SHA-256 PREP",13
                .BYTE "0-55 BYTES; HEX; SPACES OPTIONAL",13,13,0

HEX_TEXT
                .BYTE "HEX",0

ERROR_TEXT
                .BYTE "ERROR: HEX PAIRS, MAX 55 BYTES",13,0

METADATA_TEXT
                .BYTE "INPUT BYTES : ",0

BIT_COUNT_TEXT
                .BYTE "INPUT BITS  : ",0

BLOCK_COUNT_TEXT
                .BYTE "BLOCKS      : 01",13,0

MESSAGE_TEXT
                .BYTE "MESSAGE:",13,0

PADDED_TEXT
                .BYTE "PADDED BLOCK:",13,0

STATE_TEXT
                .BYTE "INITIAL SHA-256 STATE:",13,0

DIGEST_TEXT
                .BYTE "SHA-256 DIGEST:",13,0

SHA_INITIAL_STATE
                .BYTE $67,$E6,$09,$6A
                .BYTE $85,$AE,$67,$BB
                .BYTE $72,$F3,$6E,$3C
                .BYTE $3A,$F5,$4F,$A5
                .BYTE $7F,$52,$0E,$51
                .BYTE $8C,$68,$05,$9B
                .BYTE $AB,$D9,$83,$1F
                .BYTE $19,$CD,$E0,$5B

SHA256_K
                .BYTE $98,$2F,$8A,$42,$91,$44,$37,$71,$CF,$FB,$C0,$B5,$A5,$DB,$B5,$E9
                .BYTE $5B,$C2,$56,$39,$F1,$11,$F1,$59,$A4,$82,$3F,$92,$D5,$5E,$1C,$AB
                .BYTE $98,$AA,$07,$D8,$01,$5B,$83,$12,$BE,$85,$31,$24,$C3,$7D,$0C,$55
                .BYTE $74,$5D,$BE,$72,$FE,$B1,$DE,$80,$A7,$06,$DC,$9B,$74,$F1,$9B,$C1
                .BYTE $C1,$69,$9B,$E4,$86,$47,$BE,$EF,$C6,$9D,$C1,$0F,$CC,$A1,$0C,$24
                .BYTE $6F,$2C,$E9,$2D,$AA,$84,$74,$4A,$DC,$A9,$B0,$5C,$DA,$88,$F9,$76
                .BYTE $52,$51,$3E,$98,$6D,$C6,$31,$A8,$C8,$27,$03,$B0,$C7,$7F,$59,$BF
                .BYTE $F3,$0B,$E0,$C6,$47,$91,$A7,$D5,$51,$63,$CA,$06,$67,$29,$29,$14
                .BYTE $85,$0A,$B7,$27,$38,$21,$1B,$2E,$FC,$6D,$2C,$4D,$13,$0D,$38,$53
                .BYTE $54,$73,$0A,$65,$BB,$0A,$6A,$76,$2E,$C9,$C2,$81,$85,$2C,$72,$92
                .BYTE $A1,$E8,$BF,$A2,$4B,$66,$1A,$A8,$70,$8B,$4B,$C2,$A3,$51,$6C,$C7
                .BYTE $19,$E8,$92,$D1,$24,$06,$99,$D6,$85,$35,$0E,$F4,$70,$A0,$6A,$10
                .BYTE $16,$C1,$A4,$19,$08,$6C,$37,$1E,$4C,$77,$48,$27,$B5,$BC,$B0,$34
                .BYTE $B3,$0C,$1C,$39,$4A,$AA,$D8,$4E,$4F,$CA,$9C,$5B,$F3,$6F,$2E,$68
                .BYTE $EE,$82,$8F,$74,$6F,$63,$A5,$78,$14,$78,$C8,$84,$08,$02,$C7,$8C
                .BYTE $FA,$FF,$BE,$90,$EB,$6C,$50,$A4,$F7,$A3,$F9,$BE,$F2,$78,$71,$C6

LINE_LENGTH
                .BYTE $00

INPUT_LENGTH
                .BYTE $00

HEX_DIGIT_COUNT
                .BYTE $00

HEX_ACCUMULATOR
                .BYTE $00

TEMP_NIBBLE
                .BYTE $00

BIT_LENGTH_LO
                .BYTE $00

BIT_LENGTH_HI
                .BYTE $00

SAVED_PROMPT
                .BYTE $00

SAVED_STR_PTR
                .BYTE $00,$00

SHA_BLOCK
                .RES 64

SHA_STATE
                .RES 32


SHIFT_COUNT
                .BYTE $00

BOOL_TEMP
                .BYTE $00

FUNC_INPUT
                .RES 4

ROT_WORD
                .RES 4

FUNC_OUTPUT
                .RES 4

SUM_WORD
                .RES 4

CH_WORD
                .RES 4

MAJ_WORD
                .RES 4

T1_WORD
                .RES 4

T2_WORD
                .RES 4

NEW_E_WORD
                .RES 4

WORK_STATE
                .RES 32

WORK_A          = WORK_STATE
WORK_B          = WORK_STATE+4
WORK_C          = WORK_STATE+8
WORK_D          = WORK_STATE+12
WORK_E          = WORK_STATE+16
WORK_F          = WORK_STATE+20
WORK_G          = WORK_STATE+24
WORK_H          = WORK_STATE+28

W_SCHEDULE
                .RES 256

; =====================================================================
; CALLER ENVIRONMENT PRESERVATION AND EXIT
;
; DOS 3.3 BRUN starts a binary with JMP, not JSR. Consequently an RTS
; cannot return to DOS. GETLN also uses page $0200 as its line buffer,
; so the original contents are preserved and restored here.
; =====================================================================

SAVE_CALLER_PAGE2
                LDX #$00

SAVE_PAGE2_LOOP
                LDA GETLN_BUFFER,X
                STA SAVED_PAGE2,X
                INX
                BNE SAVE_PAGE2_LOOP

                JSR HOME
                RTS

EXIT_PROGRAM
                ; The low byte of STR_PTR and PROMPT were restored by the
                ; main exit path. Restore the high byte here before leaving.
                LDA SAVED_STR_PTR+1
                STA STR_PTR+1

                LDX #$00

RESTORE_PAGE2_LOOP
                LDA SAVED_PAGE2,X
                STA GETLN_BUFFER,X
                INX
                BNE RESTORE_PAGE2_LOOP

                CLD

                ; A normal DOS 3.3 installation exposes a three-byte JMP at
                ; $03D0. If it is present, warm-start DOS. Otherwise enter
                ; the Monitor directly, which guarantees a visible prompt.
                LDA DOS_WARM
                CMP #$4C
                BNE EXIT_TO_MONITOR
                JMP DOS_WARM

EXIT_TO_MONITOR
                JMP MONITOR

SAVED_PAGE2
                .RES 256

PROGRAM_END
                .END
