; =====================================================================
; XMSS_ABI_DUMP - friendly display of the fixed XMSS RAM ABI
; Apple II+ / 6502, ASM_core.js compatible
;
; BRUN entry: $4000
;
; Reads only:
;   $8B00-$8CFF  complete XMSS ABI v2 state image
;
; It does not modify the ABI page.
; =====================================================================

                .ORG $4000

HOME            = $FC58
COUT            = $FDED
CROUT           = $FD8E
PRBYTE          = $FDDA

DOS_WARM        = $03D0
MONITOR         = $FF69

PROMPT          = $33
STR_PTR         = $06
DATA_PTR        = $08

XMSS_KEY_MAGIC          = $8B00
XMSS_KEY_PARAM_ID       = $8B04
XMSS_KEY_ABI_VERSION    = $8B08
XMSS_KEY_FLAGS          = $8B09
XMSS_KEY_MASTER_SK_SEED = $8B10
XMSS_KEY_SK_PRF         = $8B30
XMSS_KEY_PUB_SEED       = $8B50
XMSS_KEY_ROOT           = $8B70
XMSS_IDX                = $8CF0
XMSS_IDX_0              = $8CF0
XMSS_IDX_1              = $8CF1
XMSS_IDX_2              = $8CF2
XMSS_IDX_3              = $8CF3
XMSS_KEY_READY          = $01
XMSS_AUTH_READY         = $02
XMSS_AUTH_PATH_ABI      = $8B90
XMSS_AUTH_IDX           = $8CD0

IDX_STATE_USABLE        = $00
IDX_STATE_EXHAUSTED     = $01
IDX_STATE_INVALID       = $02

START
                CLD
                JSR SAVE_ENVIRONMENT
                JSR HOME

                LDA #<TITLE_TEXT
                STA STR_PTR
                LDA #>TITLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JSR PRINT_MAGIC
                JSR PRINT_PARAMETER
                JSR PRINT_VERSION
                JSR PRINT_FLAGS
                JSR CROUT

                LDA #<MASTER_SEED_TEXT
                STA STR_PTR
                LDA #>MASTER_SEED_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_MASTER_SK_SEED
                STA DATA_PTR
                LDA #>XMSS_KEY_MASTER_SK_SEED
                STA DATA_PTR+1
                JSR PRINT_32_BYTES

                LDA #<SK_PRF_TEXT
                STA STR_PTR
                LDA #>SK_PRF_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_SK_PRF
                STA DATA_PTR
                LDA #>XMSS_KEY_SK_PRF
                STA DATA_PTR+1
                JSR PRINT_32_BYTES

                LDA #<PUB_SEED_TEXT
                STA STR_PTR
                LDA #>PUB_SEED_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_PUB_SEED
                STA DATA_PTR
                LDA #>XMSS_KEY_PUB_SEED
                STA DATA_PTR+1
                JSR PRINT_32_BYTES

                LDA #<ROOT_TEXT
                STA STR_PTR
                LDA #>ROOT_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_ROOT
                STA DATA_PTR
                LDA #>XMSS_KEY_ROOT
                STA DATA_PTR+1
                JSR PRINT_32_BYTES

                JSR CROUT
                LDA #<AUTH_IDX_TEXT
                STA STR_PTR
                LDA #>AUTH_IDX_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_AUTH_IDX
                STA DATA_PTR
                LDA #>XMSS_AUTH_IDX
                STA DATA_PTR+1
                JSR PRINT_4_BYTES
                JSR CROUT

                LDA #<AUTH_PATH_TEXT
                STA STR_PTR
                LDA #>AUTH_PATH_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_AUTH_PATH_ABI

                JSR CROUT
                JSR PRINT_IDX_SECTION

                LDA #<DONE_TEXT
                STA STR_PTR
                LDA #>DONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JMP EXIT_PROGRAM

PRINT_MAGIC
                LDA #<MAGIC_TEXT
                STA STR_PTR
                LDA #>MAGIC_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_MAGIC
                STA DATA_PTR
                LDA #>XMSS_KEY_MAGIC
                STA DATA_PTR+1
                JSR PRINT_4_BYTES

                LDA XMSS_KEY_MAGIC
                CMP #$58
                BNE PRINT_MAGIC_BAD
                LDA XMSS_KEY_MAGIC+1
                CMP #$4D
                BNE PRINT_MAGIC_BAD
                LDA XMSS_KEY_MAGIC+2
                CMP #$53
                BNE PRINT_MAGIC_BAD
                LDA XMSS_KEY_MAGIC+3
                CMP #$53
                BNE PRINT_MAGIC_BAD

                LDA #<MAGIC_OK_TEXT
                STA STR_PTR
                LDA #>MAGIC_OK_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_MAGIC_BAD
                LDA #<MAGIC_BAD_TEXT
                STA STR_PTR
                LDA #>MAGIC_BAD_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_PARAMETER
                LDA #<PARAM_ID_TEXT
                STA STR_PTR
                LDA #>PARAM_ID_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_KEY_PARAM_ID
                STA DATA_PTR
                LDA #>XMSS_KEY_PARAM_ID
                STA DATA_PTR+1
                JSR PRINT_4_BYTES
                JSR CROUT

                LDA XMSS_KEY_PARAM_ID
                ORA XMSS_KEY_PARAM_ID+1
                ORA XMSS_KEY_PARAM_ID+2
                BNE PRINT_PARAMETER_UNKNOWN
                LDA XMSS_KEY_PARAM_ID+3
                CMP #$01
                BNE PRINT_PARAMETER_UNKNOWN

                LDA #<PARAM_NAME_TEXT
                STA STR_PTR
                LDA #>PARAM_NAME_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_PARAMETER_UNKNOWN
                LDA #<PARAM_UNKNOWN_TEXT
                STA STR_PTR
                LDA #>PARAM_UNKNOWN_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_VERSION
                LDA #<VERSION_TEXT
                STA STR_PTR
                LDA #>VERSION_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA XMSS_KEY_ABI_VERSION
                JSR PRBYTE
                JSR CROUT
                RTS

PRINT_FLAGS
                LDA #<FLAGS_TEXT
                STA STR_PTR
                LDA #>FLAGS_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA XMSS_KEY_FLAGS
                JSR PRBYTE
                LDA XMSS_KEY_FLAGS
                AND #XMSS_KEY_READY
                BEQ PRINT_FLAGS_NOT_READY

                LDA #<READY_TEXT
                STA STR_PTR
                LDA #>READY_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA XMSS_KEY_FLAGS
                AND #XMSS_AUTH_READY
                BEQ PRINT_FLAGS_AUTH_STALE
                LDA #<AUTH_READY_TEXT
                STA STR_PTR
                LDA #>AUTH_READY_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_FLAGS_AUTH_STALE
                LDA #<AUTH_STALE_TEXT
                STA STR_PTR
                LDA #>AUTH_STALE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_FLAGS_NOT_READY
                LDA #<NOT_READY_TEXT
                STA STR_PTR
                LDA #>NOT_READY_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_4_BYTES
                LDY #$00
PRINT_4_BYTES_LOOP
                LDA (DATA_PTR),Y
                JSR PRBYTE
                INY
                CPY #$04
                BNE PRINT_4_BYTES_LOOP
                RTS

PRINT_32_BYTES
                LDY #$00
PRINT_32_BYTES_LOOP
                LDA (DATA_PTR),Y
                JSR PRBYTE
                INY
                CPY #$10
                BEQ PRINT_32_BYTES_NEW_ROW
                CPY #$20
                BEQ PRINT_32_BYTES_DONE
                TYA
                AND #$03
                BNE PRINT_32_BYTES_LOOP
                LDA #$A0
                JSR COUT
                JMP PRINT_32_BYTES_LOOP
PRINT_32_BYTES_NEW_ROW
                JSR CROUT
                JMP PRINT_32_BYTES_LOOP
PRINT_32_BYTES_DONE
                JSR CROUT
                RTS


; Print the bundled 10-node authentication path.
PRINT_AUTH_PATH_ABI
                LDA #<XMSS_AUTH_PATH_ABI
                STA DATA_PTR
                LDA #>XMSS_AUTH_PATH_ABI
                STA DATA_PTR+1
                LDA #$00
                STA AUTH_LEVEL

PRINT_AUTH_PATH_LEVEL
                LDY #$00
PRINT_AUTH_PATH_ROW1
                LDA (DATA_PTR),Y
                JSR PRBYTE
                INY
                CPY #$10
                BEQ PRINT_AUTH_PATH_ROW1_DONE
                TYA
                AND #$03
                BNE PRINT_AUTH_PATH_ROW1
                LDA #$A0
                JSR COUT
                JMP PRINT_AUTH_PATH_ROW1
PRINT_AUTH_PATH_ROW1_DONE
                JSR CROUT

PRINT_AUTH_PATH_ROW2
                LDA (DATA_PTR),Y
                JSR PRBYTE
                INY
                CPY #$20
                BEQ PRINT_AUTH_PATH_ROW2_DONE
                TYA
                AND #$03
                BNE PRINT_AUTH_PATH_ROW2
                LDA #$A0
                JSR COUT
                JMP PRINT_AUTH_PATH_ROW2
PRINT_AUTH_PATH_ROW2_DONE
                LDA #$A0
                JSR COUT
                LDA #$CC
                JSR COUT
                LDA AUTH_LEVEL
                JSR PRBYTE
                JSR CROUT

                CLC
                LDA DATA_PTR
                ADC #32
                STA DATA_PTR
                BCC PRINT_AUTH_PATH_PTR_OK
                INC DATA_PTR+1
PRINT_AUTH_PATH_PTR_OK
                INC AUTH_LEVEL
                LDA AUTH_LEVEL
                CMP #10
                BNE PRINT_AUTH_PATH_LEVEL
                RTS

PRINT_IDX_SECTION
                JSR CHECK_IDX_STATE

                LDA #<IDX_HEX_TEXT
                STA STR_PTR
                LDA #>IDX_HEX_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA #<XMSS_IDX
                STA DATA_PTR
                LDA #>XMSS_IDX
                STA DATA_PTR+1
                JSR PRINT_4_BYTES
                JSR CROUT

                LDA #<NEXT_LEAF_TEXT
                STA STR_PTR
                LDA #>NEXT_LEAF_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA IDX_STATE
                CMP #IDX_STATE_INVALID
                BEQ PRINT_NEXT_INVALID
                LDA XMSS_IDX_3
                STA DEC_VALUE_LO
                LDA XMSS_IDX_2
                STA DEC_VALUE_HI
                JSR PRINT_U16_DEC
                JSR CROUT
                JMP PRINT_REMAINING

PRINT_NEXT_INVALID
                LDA #<INVALID_TEXT
                STA STR_PTR
                LDA #>INVALID_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

PRINT_REMAINING
                LDA #<REMAINING_TEXT
                STA STR_PTR
                LDA #>REMAINING_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA IDX_STATE
                BEQ PRINT_REMAINING_USABLE
                LDA #$00
                STA DEC_VALUE_LO
                STA DEC_VALUE_HI
                JSR PRINT_U16_DEC
                JSR CROUT
                JMP PRINT_STATE

PRINT_REMAINING_USABLE
                SEC
                LDA #$00
                SBC XMSS_IDX_3
                STA DEC_VALUE_LO
                LDA #$04
                SBC XMSS_IDX_2
                STA DEC_VALUE_HI
                JSR PRINT_U16_DEC
                JSR CROUT

PRINT_STATE
                LDA #<STATE_TEXT
                STA STR_PTR
                LDA #>STATE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA IDX_STATE
                BEQ PRINT_STATE_USABLE
                CMP #IDX_STATE_EXHAUSTED
                BEQ PRINT_STATE_EXHAUSTED
                LDA #<STATE_INVALID_TEXT
                STA STR_PTR
                LDA #>STATE_INVALID_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_STATE_USABLE
                LDA #<STATE_USABLE_TEXT
                STA STR_PTR
                LDA #>STATE_USABLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_STATE_EXHAUSTED
                LDA #<STATE_EXHAUSTED_TEXT
                STA STR_PTR
                LDA #>STATE_EXHAUSTED_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

CHECK_IDX_STATE
                LDA XMSS_IDX_0
                ORA XMSS_IDX_1
                BNE CHECK_IDX_INVALID
                LDA XMSS_IDX_2
                CMP #$04
                BCC CHECK_IDX_USABLE
                BNE CHECK_IDX_INVALID
                LDA XMSS_IDX_3
                BEQ CHECK_IDX_EXHAUSTED
CHECK_IDX_INVALID
                LDA #IDX_STATE_INVALID
                STA IDX_STATE
                RTS
CHECK_IDX_USABLE
                LDA #IDX_STATE_USABLE
                STA IDX_STATE
                RTS
CHECK_IDX_EXHAUSTED
                LDA #IDX_STATE_EXHAUSTED
                STA IDX_STATE
                RTS

PRINT_U16_DEC
                LDA #$00
                STA DEC_STARTED
                LDX #$00
PRINT_U16_DIVISOR
                LDA #$00
                STA DEC_DIGIT
PRINT_U16_SUBTRACT_LOOP
                LDA DEC_VALUE_HI
                CMP DEC_DIVISORS+1,X
                BCC PRINT_U16_DIGIT_READY
                BNE PRINT_U16_SUBTRACT
                LDA DEC_VALUE_LO
                CMP DEC_DIVISORS,X
                BCC PRINT_U16_DIGIT_READY
PRINT_U16_SUBTRACT
                SEC
                LDA DEC_VALUE_LO
                SBC DEC_DIVISORS,X
                STA DEC_VALUE_LO
                LDA DEC_VALUE_HI
                SBC DEC_DIVISORS+1,X
                STA DEC_VALUE_HI
                INC DEC_DIGIT
                JMP PRINT_U16_SUBTRACT_LOOP
PRINT_U16_DIGIT_READY
                LDA DEC_DIGIT
                BNE PRINT_U16_EMIT
                LDA DEC_STARTED
                BNE PRINT_U16_EMIT
                CPX #$08
                BNE PRINT_U16_NEXT
PRINT_U16_EMIT
                LDA #$01
                STA DEC_STARTED
                LDA DEC_DIGIT
                CLC
                ADC #$B0
                JSR COUT
PRINT_U16_NEXT
                INX
                INX
                CPX #$0A
                BNE PRINT_U16_DIVISOR
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

SAVE_ENVIRONMENT
                LDA PROMPT
                STA SAVED_PROMPT
                LDA STR_PTR
                STA SAVED_STR_PTR
                LDA STR_PTR+1
                STA SAVED_STR_PTR+1
                LDA DATA_PTR
                STA SAVED_DATA_PTR
                LDA DATA_PTR+1
                STA SAVED_DATA_PTR+1
                RTS

EXIT_PROGRAM
                LDA SAVED_PROMPT
                STA PROMPT
                LDA SAVED_STR_PTR
                STA STR_PTR
                LDA SAVED_STR_PTR+1
                STA STR_PTR+1
                LDA SAVED_DATA_PTR
                STA DATA_PTR
                LDA SAVED_DATA_PTR+1
                STA DATA_PTR+1
                CLD
                LDA DOS_WARM
                CMP #$4C
                BNE EXIT_TO_MONITOR
                JMP DOS_WARM
EXIT_TO_MONITOR
                JMP MONITOR

TITLE_TEXT
                .BYTE "XMSS KEY ABI DUMP",13
                .BYTE "BASE $8B00 / SIZE $0200",13,13,0
MAGIC_TEXT
                .BYTE "MAGIC HEX: $",0
MAGIC_OK_TEXT
                .BYTE "  XMSS",13,0
MAGIC_BAD_TEXT
                .BYTE "  INVALID",13,0
PARAM_ID_TEXT
                .BYTE "PARAM ID:  $",0
PARAM_NAME_TEXT
                .BYTE "PARAM: XMSS-SHA2_10_256",13,0
PARAM_UNKNOWN_TEXT
                .BYTE "PARAM: UNKNOWN",13,0
VERSION_TEXT
                .BYTE "ABI VERSION: $",0
FLAGS_TEXT
                .BYTE "FLAGS:       $",0
READY_TEXT
                .BYTE "  KEY READY",13,0

AUTH_READY_TEXT
                .BYTE "AUTH PATH:    READY",13,0

AUTH_STALE_TEXT
                .BYTE "AUTH PATH:    STALE",13,0
NOT_READY_TEXT
                .BYTE "  NOT READY",13,0
MASTER_SEED_TEXT
                .BYTE "MASTER SK SEED $8B10-$8B2F",13,0
SK_PRF_TEXT
                .BYTE "SK PRF         $8B30-$8B4F",13,0
PUB_SEED_TEXT
                .BYTE "PUB SEED       $8B50-$8B6F",13,0
ROOT_TEXT
                .BYTE "ROOT           $8B70-$8B8F",13,0

AUTH_IDX_TEXT
                .BYTE "AUTH IDX:    $",0

AUTH_PATH_TEXT
                .BYTE "AUTH PATH $8B90-$8CCF",13,0
IDX_HEX_TEXT
                .BYTE "IDX:        $",0
NEXT_LEAF_TEXT
                .BYTE "NEXT LEAF:   ",0
REMAINING_TEXT
                .BYTE "REMAINING:   ",0
STATE_TEXT
                .BYTE "STATE:       ",0
INVALID_TEXT
                .BYTE "INVALID",13,0
STATE_USABLE_TEXT
                .BYTE "USABLE",13,0
STATE_EXHAUSTED_TEXT
                .BYTE "EXHAUSTED",13,0
STATE_INVALID_TEXT
                .BYTE "INVALID",13,0
DONE_TEXT
                .BYTE 13,"ABI DUMP COMPLETE",13,0

AUTH_LEVEL
                .BYTE $00

IDX_STATE
                .BYTE $00
DEC_VALUE_LO
                .BYTE $00
DEC_VALUE_HI
                .BYTE $00
DEC_STARTED
                .BYTE $00
DEC_DIGIT
                .BYTE $00
DEC_DIVISORS
                .BYTE $10,$27,$E8,$03,$64,$00,$0A,$00,$01,$00
SAVED_PROMPT
                .BYTE $00
SAVED_STR_PTR
                .BYTE $00,$00
SAVED_DATA_PTR
                .BYTE $00,$00

PROGRAM_END
                .END
