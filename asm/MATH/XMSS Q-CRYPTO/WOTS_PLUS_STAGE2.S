; =====================================================================
; WOTS_PLUS_STAGE2 - complete WOTS+ sign and public-key operations
; Apple II+ / 6502, ASM_core.js compatible
;
; Load address: $6000
;
; This standalone module embeds XMSS_HASH, WOTS+ Stage 1, and adds:
;
;   WOTS_BASE_W
;       Converts a 32-byte digest to 64 base-16 digits.
;
;   WOTS_CHECKSUM
;       Appends the RFC 8391 three-digit checksum (len=67).
;
;   WOTS_GEN_SK_ELEMENT
;       Derives sk[i] = PRF(SK_SEED, toByte(i,32)).
;
;   WOTS_CHAIN
;       Implements the randomized WOTS+ chain for w=16.
;
;   WOTS_SIGN
;       Emits 67 signature elements (2144 bytes).
;
;   WOTS_GEN_PK
;       Emits 67 uncompressed public-key elements.
;
;   WOTS_PK_FROM_SIG
;       Recovers the same public-key elements from a signature.
;
; Embedded XMSS hash primitives:
;
;   XMSS_F
;       SHA256(toByte(0,32) || XMSS_KEY || XMSS_M32)
;
;   XMSS_H
;       SHA256(toByte(1,32) || XMSS_KEY || XMSS_M64)
;
;   XMSS_H_MSG / XMSS_HMSG
;       One-shot SHA256(toByte(2,32) || XMSS_HMSG_KEY || message)
;
;   XMSS_H_MSG_BEGIN / XMSS_H_MSG_UPDATE / XMSS_H_MSG_FINAL
;       Streaming H_msg interface for messages larger than one 16-bit
;       source chunk.
;
;   XMSS_PRF
;       SHA256(toByte(3,32) || XMSS_KEY || XMSS_M32)
;
;   XMSS_PRF_ADRS
;       SHA256(toByte(3,32) || XMSS_KEY || XMSS_ADRS)
;
; The implementation targets n=32, as used by XMSS-SHA2_10_256.
; All externally serialized XMSS fields are big-endian byte strings.
;
; BRUN WOTS_PLUS_STAGE2 runs deterministic built-in tests and returns to DOS.
;
; Public fixed buffers:
;
;   XMSS_KEY          32 bytes
;   XMSS_M32          32 bytes
;   XMSS_M64          64 bytes
;   XMSS_HMSG_KEY     96 bytes: R || ROOT || toByte(index,32)
;   XMSS_MSG_PTR       2 bytes
;   XMSS_MSG_COUNT     2 bytes, little-endian byte count
;   XMSS_RESULT       32 bytes
;   XMSS_ADRS         32 bytes
;   XMSS_VALUE32       4-byte big-endian setter input
;   XMSS_VALUE64       8-byte big-endian tree-address setter input
;
; SHA256_UPDATE and SHA256_UPDATE_BYTE remain public for callers that
; need to stream messages larger than 65535 bytes in several chunks.
; =====================================================================

                .ORG $6000

HOME            = $FC58
COUT            = $FDED
CROUT           = $FD8E
PRBYTE          = $FDDA

DOS_WARM        = $03D0
MONITOR         = $FF69

PROMPT          = $33
STR_PTR         = $06
SHA_SRC_PTR     = $08
WOTS_SRC_PTR    = $0A
WOTS_DST_PTR    = $0C

BLOCK_SIZE      = 64
XMSS_N          = 32

; =====================================================================
; SELF-TEST ENTRY
; =====================================================================

START
                CLD
                JSR SAVE_ENVIRONMENT
                JSR HOME

                LDA #<TITLE_TEXT
                STA STR_PTR
                LDA #>TITLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JSR INIT_TEST_DATA
                JSR TEST_ADRS_TYPE_CLEAR
                JSR TEST_ADRS_OTS
                JSR TEST_XMSS_F
                JSR TEST_XMSS_H
                JSR TEST_XMSS_PRF_ADRS
                JSR TEST_XMSS_H_MSG

                JSR INIT_WOTS_TEST_DATA
                JSR TEST_WOTS_DIGITS
                JSR TEST_WOTS_SK_ELEMENT
                JSR TEST_WOTS_CHAIN_ZERO
                JSR TEST_WOTS_CHAIN_ONE
                JSR TEST_WOTS_SIGN_ONE
                JSR TEST_WOTS_RECOVER_ONE

                LDA #<DONE_TEXT
                STA STR_PTR
                LDA #>DONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JMP EXIT_PROGRAM

; =====================================================================
; XMSS DOMAIN-SEPARATED HASH FUNCTIONS
; =====================================================================

; Input A selects the RFC 8391 function family:
;   0 = F, 1 = H, 2 = H_msg, 3 = PRF.
; It initializes SHA-256 and absorbs toByte(A,32).

XMSS_BEGIN_HASH
                STA XMSS_DOMAIN_ID
                JSR SHA256_INIT

                LDX #$00
                LDA #$00

XMSS_CLEAR_DOMAIN_LOOP
                STA XMSS_DOMAIN,X
                INX
                CPX #32
                BNE XMSS_CLEAR_DOMAIN_LOOP

                LDA XMSS_DOMAIN_ID
                STA XMSS_DOMAIN+31

                LDA #<XMSS_DOMAIN
                STA SHA_SRC_PTR
                LDA #>XMSS_DOMAIN
                STA SHA_SRC_PTR+1
                LDA #32
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_UPDATE_KEY32
                LDA #<XMSS_KEY
                STA SHA_SRC_PTR
                LDA #>XMSS_KEY
                STA SHA_SRC_PTR+1
                LDA #32
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_UPDATE_M32
                LDA #<XMSS_M32
                STA SHA_SRC_PTR
                LDA #>XMSS_M32
                STA SHA_SRC_PTR+1
                LDA #32
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_UPDATE_ADRS32
                LDA #<XMSS_ADRS
                STA SHA_SRC_PTR
                LDA #>XMSS_ADRS
                STA SHA_SRC_PTR+1
                LDA #32
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_UPDATE_M64
                LDA #<XMSS_M64
                STA SHA_SRC_PTR
                LDA #>XMSS_M64
                STA SHA_SRC_PTR+1
                LDA #64
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_UPDATE_HMSG_KEY96
                LDA #<XMSS_HMSG_KEY
                STA SHA_SRC_PTR
                LDA #>XMSS_HMSG_KEY
                STA SHA_SRC_PTR+1
                LDA #96
                STA SHA_SRC_COUNT_LO
                LDA #$00
                STA SHA_SRC_COUNT_HI
                JSR SHA256_UPDATE
                RTS

XMSS_COPY_DIGEST
                LDX #$00

XMSS_COPY_DIGEST_LOOP
                LDA SHA_DIGEST,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE XMSS_COPY_DIGEST_LOOP
                RTS

XMSS_F
                LDA #$00
                JSR XMSS_BEGIN_HASH
                JSR XMSS_UPDATE_KEY32
                JSR XMSS_UPDATE_M32
                JSR SHA256_FINAL
                JSR XMSS_COPY_DIGEST
                RTS

XMSS_H
                LDA #$01
                JSR XMSS_BEGIN_HASH
                JSR XMSS_UPDATE_KEY32
                JSR XMSS_UPDATE_M64
                JSR SHA256_FINAL
                JSR XMSS_COPY_DIGEST
                RTS

XMSS_PRF
                LDA #$03
                JSR XMSS_BEGIN_HASH
                JSR XMSS_UPDATE_KEY32
                JSR XMSS_UPDATE_M32
                JSR SHA256_FINAL
                JSR XMSS_COPY_DIGEST
                RTS

XMSS_PRF_ADRS
                LDA #$03
                JSR XMSS_BEGIN_HASH
                JSR XMSS_UPDATE_KEY32
                JSR XMSS_UPDATE_ADRS32
                JSR SHA256_FINAL
                JSR XMSS_COPY_DIGEST
                RTS

XMSS_H_MSG_BEGIN
                LDA #$02
                JSR XMSS_BEGIN_HASH
                JSR XMSS_UPDATE_HMSG_KEY96
                RTS

; SHA_SRC_PTR and SHA_SRC_COUNT_LO/HI describe one message chunk.
; Repeat this call as often as needed before XMSS_H_MSG_FINAL.

XMSS_H_MSG_UPDATE
                JSR SHA256_UPDATE
                RTS

XMSS_H_MSG_FINAL
                JSR SHA256_FINAL
                JSR XMSS_COPY_DIGEST
                RTS

; One-shot convenience interface using XMSS_MSG_PTR and XMSS_MSG_COUNT.

XMSS_H_MSG
XMSS_HMSG
                JSR XMSS_H_MSG_BEGIN

                LDA XMSS_MSG_PTR
                STA SHA_SRC_PTR
                LDA XMSS_MSG_PTR+1
                STA SHA_SRC_PTR+1
                LDA XMSS_MSG_COUNT
                STA SHA_SRC_COUNT_LO
                LDA XMSS_MSG_COUNT+1
                STA SHA_SRC_COUNT_HI
                JSR XMSS_H_MSG_UPDATE

                JSR XMSS_H_MSG_FINAL
                RTS

; =====================================================================
; 32-BYTE XMSS ADDRESS
;
; XMSS_ADRS is always serialized big-endian:
;
;   0..3    layer
;   4..11   tree
;   12..15  type
;   16..19  OTS / L-tree / padding
;   20..23  chain / tree height
;   24..27  hash / tree index
;   28..31  keyAndMask
;
; setType clears all four words following the type word, as required
; by RFC 8391.
; =====================================================================

XMSS_ADRS_CLEAR
                LDX #$00
                LDA #$00

XMSS_ADRS_CLEAR_LOOP
                STA XMSS_ADRS,X
                INX
                CPX #32
                BNE XMSS_ADRS_CLEAR_LOOP
                RTS

; A = type 0, 1 or 2. The full 32-bit type field is big-endian.

XMSS_ADRS_SET_TYPE
                PHA
                LDX #12
                LDA #$00

XMSS_ADRS_SET_TYPE_CLEAR_LOOP
                STA XMSS_ADRS,X
                INX
                CPX #32
                BNE XMSS_ADRS_SET_TYPE_CLEAR_LOOP

                PLA
                STA XMSS_ADRS+15
                RTS

XMSS_ADRS_SET_LAYER
                LDX #$00

XMSS_ADRS_SET_LAYER_LOOP
                LDA XMSS_VALUE32,X
                STA XMSS_ADRS,X
                INX
                CPX #$04
                BNE XMSS_ADRS_SET_LAYER_LOOP
                RTS

XMSS_ADRS_SET_TREE
                LDX #$00

XMSS_ADRS_SET_TREE_LOOP
                LDA XMSS_VALUE64,X
                STA XMSS_ADRS+4,X
                INX
                CPX #$08
                BNE XMSS_ADRS_SET_TREE_LOOP
                RTS

XMSS_ADRS_SET_OTS
XMSS_ADRS_SET_LTREE
                LDX #$00

XMSS_ADRS_SET_WORD4_LOOP
                LDA XMSS_VALUE32,X
                STA XMSS_ADRS+16,X
                INX
                CPX #$04
                BNE XMSS_ADRS_SET_WORD4_LOOP
                RTS

XMSS_ADRS_SET_CHAIN
XMSS_ADRS_SET_TREE_HEIGHT
                LDX #$00

XMSS_ADRS_SET_WORD5_LOOP
                LDA XMSS_VALUE32,X
                STA XMSS_ADRS+20,X
                INX
                CPX #$04
                BNE XMSS_ADRS_SET_WORD5_LOOP
                RTS

XMSS_ADRS_SET_HASH
XMSS_ADRS_SET_TREE_INDEX
                LDX #$00

XMSS_ADRS_SET_WORD6_LOOP
                LDA XMSS_VALUE32,X
                STA XMSS_ADRS+24,X
                INX
                CPX #$04
                BNE XMSS_ADRS_SET_WORD6_LOOP
                RTS

XMSS_ADRS_SET_KEY_MASK
                LDX #$00

XMSS_ADRS_SET_KEY_MASK_LOOP
                LDA XMSS_VALUE32,X
                STA XMSS_ADRS+28,X
                INX
                CPX #$04
                BNE XMSS_ADRS_SET_KEY_MASK_LOOP
                RTS

; Convenience helper for values 0..255:
; A becomes big-endian 00 00 00 A in XMSS_VALUE32.

XMSS_VALUE32_SET_A
                STA XMSS_VALUE32+3
                LDA #$00
                STA XMSS_VALUE32
                STA XMSS_VALUE32+1
                STA XMSS_VALUE32+2
                RTS


; =====================================================================
; WOTS+ STAGE 1, WOTSP-SHA2_256
;
; Fixed parameters:
;   n     = 32
;   w     = 16
;   len_1 = 64
;   len_2 = 3
;   len   = 67
;
; WOTS_BASE_W and WOTS_CHECKSUM implement the specialized w=16 form
; of RFC 8391 Algorithms 1 and 5. WOTS_CHAIN implements Algorithm 2.
; =====================================================================

WOTS_BASE_W
                LDX #$00
                LDY #$00

WOTS_BASE_W_LOOP
                LDA WOTS_MESSAGE,X
                PHA
                LSR
                LSR
                LSR
                LSR
                STA WOTS_DIGITS,Y
                INY

                PLA
                AND #$0F
                STA WOTS_DIGITS,Y
                INY

                INX
                CPX #32
                BNE WOTS_BASE_W_LOOP
                RTS

; Compute csum = sum(15 - digit[i]) for the 64 message digits.
; For len_2=3 and lg(w)=4, RFC 8391 shifts csum left four bits
; before converting it to two big-endian bytes and calling base_w.
; The three resulting base-16 digits are therefore the three low
; hexadecimal digits of the unshifted checksum.

WOTS_CHECKSUM
                LDA #$00
                STA WOTS_CSUM_LO
                STA WOTS_CSUM_HI

                LDX #$00

WOTS_CHECKSUM_LOOP
                LDA #$0F
                SEC
                SBC WOTS_DIGITS,X

                CLC
                ADC WOTS_CSUM_LO
                STA WOTS_CSUM_LO
                BCC WOTS_CHECKSUM_NO_CARRY
                INC WOTS_CSUM_HI

WOTS_CHECKSUM_NO_CARRY
                INX
                CPX #64
                BNE WOTS_CHECKSUM_LOOP

                LDA WOTS_CSUM_HI
                AND #$0F
                STA WOTS_DIGITS+64

                LDA WOTS_CSUM_LO
                LSR
                LSR
                LSR
                LSR
                STA WOTS_DIGITS+65

                LDA WOTS_CSUM_LO
                AND #$0F
                STA WOTS_DIGITS+66
                RTS

WOTS_PREPARE_DIGITS
                JSR WOTS_BASE_W
                JSR WOTS_CHECKSUM
                RTS

; Derive one private-key element using the optional deterministic
; generation method from RFC 8391 Section 3.1.7:
;
;   sk[i] = PRF(WOTS_SK_SEED, toByte(i,32))
;
; Input:
;   WOTS_SK_INDEX       one byte, valid for indices 0..66
;   WOTS_SK_SEED        32-byte secret seed
;
; Output:
;   WOTS_SK_ELEMENT     32 bytes

WOTS_GEN_SK_ELEMENT
                LDX #$00

WOTS_COPY_SK_SEED_LOOP
                LDA WOTS_SK_SEED,X
                STA XMSS_KEY,X
                LDA #$00
                STA XMSS_M32,X
                INX
                CPX #32
                BNE WOTS_COPY_SK_SEED_LOOP

                LDA WOTS_SK_INDEX
                STA XMSS_M32+31

                JSR XMSS_PRF

                LDX #$00

WOTS_COPY_SK_RESULT_LOOP
                LDA XMSS_RESULT,X
                STA WOTS_SK_ELEMENT,X
                INX
                CPX #32
                BNE WOTS_COPY_SK_RESULT_LOOP
                RTS

; Randomized WOTS+ chaining function.
;
; Input:
;   WOTS_CHAIN_INPUT    32-byte starting value X
;   WOTS_CHAIN_START    start index i, 0..15
;   WOTS_CHAIN_STEPS    number of steps s, 0..15
;   WOTS_PUB_SEED       public 32-byte SEED
;   XMSS_ADRS           OTS address with layer/tree/type/OTS/chain set
;
; Output:
;   WOTS_CHAIN_OUTPUT   resulting 32-byte value
;   Carry clear         success
;   Carry set           invalid because i+s > 15
;
; The routine only changes the hash-address and keyAndMask words of
; XMSS_ADRS, as required for an OTS chain.

WOTS_CHAIN
                CLD

                LDA WOTS_CHAIN_START
                CMP #16
                BCC WOTS_CHAIN_START_OK
                JMP WOTS_CHAIN_INVALID

WOTS_CHAIN_START_OK
                LDA WOTS_CHAIN_STEPS
                CMP #16
                BCC WOTS_CHAIN_STEPS_OK
                JMP WOTS_CHAIN_INVALID

WOTS_CHAIN_STEPS_OK
                CLC
                ADC WOTS_CHAIN_START
                CMP #16
                BCC WOTS_CHAIN_RANGE_OK
                JMP WOTS_CHAIN_INVALID

WOTS_CHAIN_RANGE_OK
                LDX #$00

WOTS_CHAIN_COPY_INPUT_LOOP
                LDA WOTS_CHAIN_INPUT,X
                STA WOTS_CHAIN_OUTPUT,X
                INX
                CPX #32
                BNE WOTS_CHAIN_COPY_INPUT_LOOP

                LDA WOTS_CHAIN_START
                STA WOTS_CHAIN_POSITION

                LDA WOTS_CHAIN_STEPS
                STA WOTS_CHAIN_REMAINING
                BEQ WOTS_CHAIN_SUCCESS

WOTS_CHAIN_STEP
                LDA WOTS_CHAIN_POSITION
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_HASH

                JSR WOTS_COPY_PUB_SEED_TO_KEY

                LDA #$00
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS

                LDX #$00

WOTS_SAVE_CHAIN_KEY_LOOP
                LDA XMSS_RESULT,X
                STA WOTS_CHAIN_KEY,X
                INX
                CPX #32
                BNE WOTS_SAVE_CHAIN_KEY_LOOP

                LDA #$01
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS

                LDX #$00

WOTS_SAVE_MASK_LOOP
                LDA XMSS_RESULT,X
                STA WOTS_CHAIN_MASK,X
                INX
                CPX #32
                BNE WOTS_SAVE_MASK_LOOP

                LDX #$00

WOTS_PREPARE_F_LOOP
                LDA WOTS_CHAIN_KEY,X
                STA XMSS_KEY,X

                LDA WOTS_CHAIN_OUTPUT,X
                EOR WOTS_CHAIN_MASK,X
                STA XMSS_M32,X

                INX
                CPX #32
                BNE WOTS_PREPARE_F_LOOP

                JSR XMSS_F

                LDX #$00

WOTS_COPY_CHAIN_RESULT_LOOP
                LDA XMSS_RESULT,X
                STA WOTS_CHAIN_OUTPUT,X
                INX
                CPX #32
                BNE WOTS_COPY_CHAIN_RESULT_LOOP

                INC WOTS_CHAIN_POSITION
                DEC WOTS_CHAIN_REMAINING
                BNE WOTS_CHAIN_STEP

WOTS_CHAIN_SUCCESS
                CLC
                RTS

WOTS_CHAIN_INVALID
                SEC
                RTS

WOTS_COPY_PUB_SEED_TO_KEY
                LDX #$00

WOTS_COPY_PUB_SEED_LOOP
                LDA WOTS_PUB_SEED,X
                STA XMSS_KEY,X
                INX
                CPX #32
                BNE WOTS_COPY_PUB_SEED_LOOP
                RTS

; =====================================================================
; WOTS+ STAGE 2
;
; Complete 67-element WOTS+ operations for WOTSP-SHA2_256:
;
;   WOTS_SIGN
;       Creates a 2144-byte signature at WOTS_SIGNATURE_PTR.
;
;   WOTS_GEN_PK
;       Creates 67 uncompressed public-key elements at
;       WOTS_PUBLIC_KEY_PTR.
;
;   WOTS_PK_FROM_SIG
;       Reconstructs the same 67 public-key elements from a signature.
;
; The caller must configure XMSS_ADRS as an OTS address containing the
; correct layer, tree and OTS index. These routines set the chain field;
; WOTS_CHAIN sets the hash and keyAndMask fields.
;
; Public pointers are ordinary little-endian 16-bit addresses. Two
; zero-page pointers are used internally and restored by the BRUN shell.
; =====================================================================

WOTS_USE_INTERNAL_BUFFERS
                LDA #<WOTS_SIGNATURE
                STA WOTS_SIGNATURE_PTR
                LDA #>WOTS_SIGNATURE
                STA WOTS_SIGNATURE_PTR+1

                LDA #<WOTS_PUBLIC_KEY
                STA WOTS_PUBLIC_KEY_PTR
                LDA #>WOTS_PUBLIC_KEY
                STA WOTS_PUBLIC_KEY_PTR+1
                RTS

WOTS_LOAD_SIGNATURE_SOURCE
                LDA WOTS_SIGNATURE_PTR
                STA WOTS_SRC_PTR
                LDA WOTS_SIGNATURE_PTR+1
                STA WOTS_SRC_PTR+1
                RTS

WOTS_LOAD_SIGNATURE_DEST
                LDA WOTS_SIGNATURE_PTR
                STA WOTS_DST_PTR
                LDA WOTS_SIGNATURE_PTR+1
                STA WOTS_DST_PTR+1
                RTS

WOTS_LOAD_PUBLIC_KEY_DEST
                LDA WOTS_PUBLIC_KEY_PTR
                STA WOTS_DST_PTR
                LDA WOTS_PUBLIC_KEY_PTR+1
                STA WOTS_DST_PTR+1
                RTS

WOTS_ADVANCE_SOURCE_32
                CLC
                LDA WOTS_SRC_PTR
                ADC #32
                STA WOTS_SRC_PTR
                BCC WOTS_ADVANCE_SOURCE_DONE
                INC WOTS_SRC_PTR+1

WOTS_ADVANCE_SOURCE_DONE
                RTS

WOTS_ADVANCE_DEST_32
                CLC
                LDA WOTS_DST_PTR
                ADC #32
                STA WOTS_DST_PTR
                BCC WOTS_ADVANCE_DEST_DONE
                INC WOTS_DST_PTR+1

WOTS_ADVANCE_DEST_DONE
                RTS

WOTS_COPY_SK_TO_CHAIN_INPUT
                LDX #$00

WOTS_COPY_SK_TO_CHAIN_LOOP
                LDA WOTS_SK_ELEMENT,X
                STA WOTS_CHAIN_INPUT,X
                INX
                CPX #32
                BNE WOTS_COPY_SK_TO_CHAIN_LOOP
                RTS

WOTS_COPY_SOURCE_TO_CHAIN_INPUT
                LDY #$00

WOTS_COPY_SOURCE_TO_CHAIN_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA WOTS_CHAIN_INPUT,Y
                INY
                CPY #32
                BNE WOTS_COPY_SOURCE_TO_CHAIN_LOOP
                RTS

WOTS_COPY_CHAIN_OUTPUT_TO_DEST
                LDY #$00

WOTS_COPY_CHAIN_TO_DEST_LOOP
                LDA WOTS_CHAIN_OUTPUT,Y
                STA (WOTS_DST_PTR),Y
                INY
                CPY #32
                BNE WOTS_COPY_CHAIN_TO_DEST_LOOP
                RTS

; Validate WOTS_ELEMENT_INDEX and install it into both the deterministic
; private-key index and the ADRS chain word.

WOTS_SET_ELEMENT_ADDRESS
                LDA WOTS_ELEMENT_INDEX
                CMP #67
                BCC WOTS_ELEMENT_ADDRESS_OK
                SEC
                RTS

WOTS_ELEMENT_ADDRESS_OK
                STA WOTS_SK_INDEX
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_CHAIN
                CLC
                RTS

; Sign one element selected by WOTS_ELEMENT_INDEX. WOTS_DIGITS must
; already contain the 67 prepared message/checksum digits.

WOTS_SIGN_ONE
                JSR WOTS_SET_ELEMENT_ADDRESS
                BCS WOTS_SIGN_ONE_INVALID

                JSR WOTS_GEN_SK_ELEMENT
                JSR WOTS_COPY_SK_TO_CHAIN_INPUT

                LDA #$00
                STA WOTS_CHAIN_START

                LDX WOTS_ELEMENT_INDEX
                LDA WOTS_DIGITS,X
                STA WOTS_CHAIN_STEPS
                JMP WOTS_CHAIN

WOTS_SIGN_ONE_INVALID
                SEC
                RTS

; Generate one complete public-key chain endpoint.

WOTS_GEN_PK_ONE
                JSR WOTS_SET_ELEMENT_ADDRESS
                BCS WOTS_GEN_PK_ONE_INVALID

                JSR WOTS_GEN_SK_ELEMENT
                JSR WOTS_COPY_SK_TO_CHAIN_INPUT

                LDA #$00
                STA WOTS_CHAIN_START
                LDA #15
                STA WOTS_CHAIN_STEPS
                JMP WOTS_CHAIN

WOTS_GEN_PK_ONE_INVALID
                SEC
                RTS

; Recover one public-key element from WOTS_CHAIN_INPUT, which must hold
; the corresponding 32-byte signature element.

WOTS_PK_FROM_SIG_ONE
                JSR WOTS_SET_ELEMENT_ADDRESS
                BCS WOTS_PK_FROM_SIG_ONE_INVALID

                LDX WOTS_ELEMENT_INDEX
                LDA WOTS_DIGITS,X
                STA WOTS_CHAIN_START

                LDA #15
                SEC
                SBC WOTS_DIGITS,X
                STA WOTS_CHAIN_STEPS
                JMP WOTS_CHAIN

WOTS_PK_FROM_SIG_ONE_INVALID
                SEC
                RTS

; Create all 67 signature elements at WOTS_SIGNATURE_PTR.
;
; Output:
;   Carry clear = success
;   Carry set   = internal range failure

WOTS_SIGN
                CLD
                JSR WOTS_PREPARE_DIGITS
                JSR WOTS_LOAD_SIGNATURE_DEST

                LDA #$00
                STA WOTS_ELEMENT_INDEX

WOTS_SIGN_LOOP
                JSR WOTS_SIGN_ONE
                BCS WOTS_SIGN_FAILED

                JSR WOTS_COPY_CHAIN_OUTPUT_TO_DEST
                JSR WOTS_ADVANCE_DEST_32

                INC WOTS_ELEMENT_INDEX
                LDA WOTS_ELEMENT_INDEX
                CMP #67
                BNE WOTS_SIGN_LOOP

                CLC
                RTS

WOTS_SIGN_FAILED
                SEC
                RTS

; Generate all 67 uncompressed public-key elements at
; WOTS_PUBLIC_KEY_PTR.

WOTS_GEN_PK
                CLD
                JSR WOTS_LOAD_PUBLIC_KEY_DEST

                LDA #$00
                STA WOTS_ELEMENT_INDEX

WOTS_GEN_PK_LOOP
                JSR WOTS_GEN_PK_ONE
                BCS WOTS_GEN_PK_FAILED

                JSR WOTS_COPY_CHAIN_OUTPUT_TO_DEST
                JSR WOTS_ADVANCE_DEST_32

                INC WOTS_ELEMENT_INDEX
                LDA WOTS_ELEMENT_INDEX
                CMP #67
                BNE WOTS_GEN_PK_LOOP

                CLC
                RTS

WOTS_GEN_PK_FAILED
                SEC
                RTS

; Recover all 67 public-key elements from WOTS_SIGNATURE_PTR and write
; them to WOTS_PUBLIC_KEY_PTR.

WOTS_PK_FROM_SIG
                CLD
                JSR WOTS_PREPARE_DIGITS
                JSR WOTS_LOAD_SIGNATURE_SOURCE
                JSR WOTS_LOAD_PUBLIC_KEY_DEST

                LDA #$00
                STA WOTS_ELEMENT_INDEX

WOTS_PK_FROM_SIG_LOOP
                JSR WOTS_COPY_SOURCE_TO_CHAIN_INPUT
                JSR WOTS_PK_FROM_SIG_ONE
                BCS WOTS_PK_FROM_SIG_FAILED

                JSR WOTS_COPY_CHAIN_OUTPUT_TO_DEST
                JSR WOTS_ADVANCE_SOURCE_32
                JSR WOTS_ADVANCE_DEST_32

                INC WOTS_ELEMENT_INDEX
                LDA WOTS_ELEMENT_INDEX
                CMP #67
                BNE WOTS_PK_FROM_SIG_LOOP

                CLC
                RTS

WOTS_PK_FROM_SIG_FAILED
                SEC
                RTS

; =====================================================================
; WOTS+ BUILT-IN TESTS
; =====================================================================

INIT_WOTS_TEST_DATA
                LDX #$00

INIT_WOTS_MESSAGE_LOOP
                TXA
                STA WOTS_MESSAGE,X

                CLC
                ADC #$40
                STA WOTS_PUB_SEED,X

                TXA
                CLC
                ADC #$80
                STA WOTS_SK_SEED,X

                TXA
                CLC
                ADC #$A0
                STA WOTS_CHAIN_INPUT,X

                INX
                CPX #32
                BNE INIT_WOTS_MESSAGE_LOOP

                LDA #$05
                STA WOTS_SK_INDEX

                LDA #$00
                STA WOTS_CHAIN_START
                STA WOTS_CHAIN_STEPS

                JSR BUILD_WOTS_TEST_ADRS
                RTS

BUILD_WOTS_TEST_ADRS
                JSR XMSS_ADRS_CLEAR
                LDA #$00
                JSR XMSS_ADRS_SET_TYPE

                LDA #$02
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_OTS

                LDA #$03
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_CHAIN
                RTS

TEST_WOTS_DIGITS
                JSR WOTS_PREPARE_DIGITS

                LDA #<TEST_WOTS_DIGITS_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_DIGITS_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_WOTS_DIGITS
                STA STR_PTR
                LDA #>EXPECTED_WOTS_DIGITS
                STA STR_PTR+1
                JSR COMPARE_WOTS_DIGITS
                JSR PRINT_STATUS
                RTS

TEST_WOTS_SK_ELEMENT
                JSR WOTS_GEN_SK_ELEMENT

                LDA #<TEST_WOTS_SK_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_SK_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_WOTS_SK5
                STA STR_PTR
                LDA #>EXPECTED_WOTS_SK5
                STA STR_PTR+1
                JSR COMPARE_WOTS_SK_ELEMENT
                JSR PRINT_STATUS
                RTS

TEST_WOTS_CHAIN_ZERO
                JSR BUILD_WOTS_TEST_ADRS
                LDA #$00
                STA WOTS_CHAIN_START
                STA WOTS_CHAIN_STEPS
                JSR WOTS_CHAIN
                BCS TEST_WOTS_CHAIN_ZERO_FAIL

                LDA #<TEST_WOTS_CHAIN0_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_CHAIN0_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<WOTS_CHAIN_INPUT
                STA STR_PTR
                LDA #>WOTS_CHAIN_INPUT
                STA STR_PTR+1
                JSR COMPARE_WOTS_CHAIN_OUTPUT
                JSR PRINT_STATUS
                RTS

TEST_WOTS_CHAIN_ZERO_FAIL
                LDA #$00
                STA TEST_STATUS
                JSR PRINT_STATUS
                RTS

TEST_WOTS_CHAIN_ONE
                JSR BUILD_WOTS_TEST_ADRS
                LDA #$00
                STA WOTS_CHAIN_START
                LDA #$01
                STA WOTS_CHAIN_STEPS
                JSR WOTS_CHAIN
                BCS TEST_WOTS_CHAIN_ONE_FAIL

                LDA #<TEST_WOTS_CHAIN1_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_CHAIN1_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_WOTS_CHAIN1
                STA STR_PTR
                LDA #>EXPECTED_WOTS_CHAIN1
                STA STR_PTR+1
                JSR COMPARE_WOTS_CHAIN_OUTPUT
                JSR PRINT_STATUS
                RTS

TEST_WOTS_CHAIN_ONE_FAIL
                LDA #$00
                STA TEST_STATUS
                JSR PRINT_STATUS
                RTS

COMPARE_WOTS_DIGITS
                LDY #$00

COMPARE_WOTS_DIGITS_LOOP
                LDA WOTS_DIGITS,Y
                CMP (STR_PTR),Y
                BNE COMPARE_WOTS_FAIL
                INY
                CPY #67
                BNE COMPARE_WOTS_DIGITS_LOOP

                LDA #$01
                STA TEST_STATUS
                RTS

COMPARE_WOTS_SK_ELEMENT
                LDY #$00

COMPARE_WOTS_SK_LOOP
                LDA WOTS_SK_ELEMENT,Y
                CMP (STR_PTR),Y
                BNE COMPARE_WOTS_FAIL
                INY
                CPY #32
                BNE COMPARE_WOTS_SK_LOOP

                LDA #$01
                STA TEST_STATUS
                RTS

COMPARE_WOTS_CHAIN_OUTPUT
                LDY #$00

COMPARE_WOTS_CHAIN_LOOP
                LDA WOTS_CHAIN_OUTPUT,Y
                CMP (STR_PTR),Y
                BNE COMPARE_WOTS_FAIL
                INY
                CPY #32
                BNE COMPARE_WOTS_CHAIN_LOOP

                LDA #$01
                STA TEST_STATUS
                RTS

COMPARE_WOTS_FAIL
                LDA #$00
                STA TEST_STATUS
                RTS


; =====================================================================
; WOTS+ STAGE 2 QUICK SELF-TEST
;
; A full 67-element sign/generate/recover cycle is intentionally not
; run by BRUN because it requires thousands of SHA-256 evaluations on a
; 1 MHz machine. The built-in test exercises the exact per-element code:
;
;   digit[5] = 2
;   signature element = chain(sk[5], 0, 2)
;   recovered PK       = chain(signature, 2, 13)
;
; The full loops are validated by the companion machine-code tests.
; =====================================================================

TEST_WOTS_SIGN_ONE
                JSR WOTS_PREPARE_DIGITS
                JSR BUILD_WOTS_TEST_ADRS

                LDA #$05
                STA WOTS_ELEMENT_INDEX
                JSR WOTS_SIGN_ONE
                BCS TEST_WOTS_SIGN_ONE_FAIL

                LDX #$00

SAVE_TEST_SIGNATURE_LOOP
                LDA WOTS_CHAIN_OUTPUT,X
                STA WOTS_TEST_SIGNATURE_ELEMENT,X
                INX
                CPX #32
                BNE SAVE_TEST_SIGNATURE_LOOP

                LDA #<TEST_WOTS_SIGN_ONE_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_SIGN_ONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_WOTS_SIGNATURE5
                STA STR_PTR
                LDA #>EXPECTED_WOTS_SIGNATURE5
                STA STR_PTR+1
                JSR COMPARE_WOTS_CHAIN_OUTPUT
                JSR PRINT_STATUS
                RTS

TEST_WOTS_SIGN_ONE_FAIL
                LDA #$00
                STA TEST_STATUS
                JSR PRINT_STATUS
                RTS

TEST_WOTS_RECOVER_ONE
                JSR BUILD_WOTS_TEST_ADRS

                LDX #$00

LOAD_TEST_SIGNATURE_LOOP
                LDA WOTS_TEST_SIGNATURE_ELEMENT,X
                STA WOTS_CHAIN_INPUT,X
                INX
                CPX #32
                BNE LOAD_TEST_SIGNATURE_LOOP

                LDA #$05
                STA WOTS_ELEMENT_INDEX
                JSR WOTS_PK_FROM_SIG_ONE
                BCS TEST_WOTS_RECOVER_ONE_FAIL

                LDA #<TEST_WOTS_RECOVER_ONE_TEXT
                STA STR_PTR
                LDA #>TEST_WOTS_RECOVER_ONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_WOTS_PUBLIC_KEY5
                STA STR_PTR
                LDA #>EXPECTED_WOTS_PUBLIC_KEY5
                STA STR_PTR+1
                JSR COMPARE_WOTS_CHAIN_OUTPUT
                JSR PRINT_STATUS
                RTS

TEST_WOTS_RECOVER_ONE_FAIL
                LDA #$00
                STA TEST_STATUS
                JSR PRINT_STATUS
                RTS

; =====================================================================
; BUILT-IN TESTS
; =====================================================================

INIT_TEST_DATA
                LDX #$00

INIT_TEST_KEY_LOOP
                TXA
                STA XMSS_KEY,X
                CLC
                ADC #$20
                STA XMSS_M32,X
                INX
                CPX #32
                BNE INIT_TEST_KEY_LOOP

                LDX #$00

INIT_TEST_M64_LOOP
                TXA
                CLC
                ADC #$20
                STA XMSS_M64,X
                INX
                CPX #64
                BNE INIT_TEST_M64_LOOP

                LDX #$00

INIT_TEST_HMSG_KEY_LOOP
                TXA
                STA XMSS_HMSG_KEY,X
                INX
                CPX #96
                BNE INIT_TEST_HMSG_KEY_LOOP

                LDA #<TEST_MESSAGE
                STA XMSS_MSG_PTR
                LDA #>TEST_MESSAGE
                STA XMSS_MSG_PTR+1
                LDA #TEST_MESSAGE_LENGTH
                STA XMSS_MSG_COUNT
                LDA #$00
                STA XMSS_MSG_COUNT+1
                RTS

BUILD_TEST_OTS_ADRS
                JSR XMSS_ADRS_CLEAR
                LDA #$00
                JSR XMSS_ADRS_SET_TYPE

                LDA #$05
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_OTS

                LDA #$07
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_CHAIN

                LDA #$09
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_HASH

                LDA #$01
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                RTS

TEST_ADRS_TYPE_CLEAR
                JSR BUILD_TEST_OTS_ADRS
                LDA #$01
                JSR XMSS_ADRS_SET_TYPE

                LDA #<TEST_ADRS_CLEAR_TEXT
                STA STR_PTR
                LDA #>TEST_ADRS_CLEAR_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<EXPECTED_ADRS_TYPE1
                STA STR_PTR
                LDA #>EXPECTED_ADRS_TYPE1
                STA STR_PTR+1
                JSR COMPARE_ADRS
                JSR PRINT_STATUS
                RTS

TEST_ADRS_OTS
                JSR BUILD_TEST_OTS_ADRS

                LDA #<TEST_ADRS_TEXT
                STA STR_PTR
                LDA #>TEST_ADRS_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_ADRS

                LDA #<EXPECTED_ADRS_OTS
                STA STR_PTR
                LDA #>EXPECTED_ADRS_OTS
                STA STR_PTR+1
                JSR COMPARE_ADRS
                JSR PRINT_STATUS
                RTS

TEST_XMSS_F
                JSR XMSS_F
                LDA #<TEST_F_TEXT
                STA STR_PTR
                LDA #>TEST_F_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_F
                STA STR_PTR
                LDA #>EXPECTED_F
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_H
                JSR XMSS_H
                LDA #<TEST_H_TEXT
                STA STR_PTR
                LDA #>TEST_H_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_H
                STA STR_PTR
                LDA #>EXPECTED_H
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_PRF_ADRS
                JSR BUILD_TEST_OTS_ADRS
                JSR XMSS_PRF_ADRS

                LDA #<TEST_PRF_TEXT
                STA STR_PTR
                LDA #>TEST_PRF_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_PRF_ADRS
                STA STR_PTR
                LDA #>EXPECTED_PRF_ADRS
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_H_MSG
                JSR XMSS_H_MSG
                LDA #<TEST_HMSG_TEXT
                STA STR_PTR
                LDA #>TEST_HMSG_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_HMSG
                STA STR_PTR
                LDA #>EXPECTED_HMSG
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

COMPARE_RESULT
                LDY #$00

COMPARE_RESULT_LOOP
                LDA XMSS_RESULT,Y
                CMP (STR_PTR),Y
                BNE COMPARE_FAIL
                INY
                CPY #32
                BNE COMPARE_RESULT_LOOP

                LDA #$01
                STA TEST_STATUS
                RTS

COMPARE_ADRS
                LDY #$00

COMPARE_ADRS_LOOP
                LDA XMSS_ADRS,Y
                CMP (STR_PTR),Y
                BNE COMPARE_FAIL
                INY
                CPY #32
                BNE COMPARE_ADRS_LOOP

                LDA #$01
                STA TEST_STATUS
                RTS

COMPARE_FAIL
                LDA #$00
                STA TEST_STATUS
                RTS

; =====================================================================
; SHA-256 STREAMING ENGINE
; =====================================================================

SHA256_INIT
                CLD

                LDX #$00

SHA256_INIT_STATE_LOOP
                LDA SHA_INITIAL_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE SHA256_INIT_STATE_LOOP

                LDA #$00
                STA SHA_BUF_USED
                STA SHA_PADDING_BLOCKS
                STA FINAL_REMAINDER

                LDX #$00

SHA256_INIT_COUNTER_LOOP
                STA SHA_BYTE_COUNT,X
                STA SHA_BIT_LENGTH,X
                INX
                CPX #$08
                BNE SHA256_INIT_COUNTER_LOOP

                LDX #$00

SHA256_INIT_BLOCK_COUNTER_LOOP
                STA SHA_DATA_BLOCKS,X
                STA SHA_TOTAL_BLOCKS,X
                INX
                CPX #$04
                BNE SHA256_INIT_BLOCK_COUNTER_LOOP

                LDX #$00

SHA256_INIT_BUFFER_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #BLOCK_SIZE
                BNE SHA256_INIT_BUFFER_LOOP
                RTS

; ---------------------------------------------------------------------
; SHA256_UPDATE
;
; Absorbs SHA_SRC_COUNT bytes from (SHA_SRC_PTR). The pointer and count
; are consumed. Calls may be repeated before SHA256_FINAL.
; ---------------------------------------------------------------------

SHA256_UPDATE
                CLD

SHA256_UPDATE_LOOP
                LDA SHA_SRC_COUNT_LO
                ORA SHA_SRC_COUNT_HI
                BEQ SHA256_UPDATE_DONE

                LDY #$00
                LDA (SHA_SRC_PTR),Y
                JSR SHA256_UPDATE_BYTE

                INC SHA_SRC_PTR
                BNE SHA256_UPDATE_PTR_OK
                INC SHA_SRC_PTR+1

SHA256_UPDATE_PTR_OK
                LDA SHA_SRC_COUNT_LO
                BNE SHA256_UPDATE_DEC_LOW
                DEC SHA_SRC_COUNT_HI

SHA256_UPDATE_DEC_LOW
                DEC SHA_SRC_COUNT_LO
                JMP SHA256_UPDATE_LOOP

SHA256_UPDATE_DONE
                RTS

; ---------------------------------------------------------------------
; SHA256_UPDATE_BYTE
;
; Absorbs one byte in A and increments the exact 64-bit byte counter.
; Complete data blocks are compressed immediately.
; ---------------------------------------------------------------------

SHA256_UPDATE_BYTE
                PHA
                LDX SHA_BUF_USED
                PLA
                STA SHA_BLOCK,X
                INC SHA_BUF_USED

                JSR INCREMENT_BYTE_COUNT

                LDA SHA_BUF_USED
                CMP #BLOCK_SIZE
                BNE SHA256_UPDATE_BYTE_DONE

                JSR SHA256_COMPRESS
                JSR INCREMENT_DATA_BLOCKS
                JSR INCREMENT_TOTAL_BLOCKS

                LDA #$00
                STA SHA_BUF_USED

SHA256_UPDATE_BYTE_DONE
                RTS

INCREMENT_BYTE_COUNT
                INC SHA_BYTE_COUNT
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+1
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+2
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+3
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+4
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+5
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+6
                BNE INCREMENT_BYTE_COUNT_DONE
                INC SHA_BYTE_COUNT+7

INCREMENT_BYTE_COUNT_DONE
                RTS

INCREMENT_DATA_BLOCKS
                INC SHA_DATA_BLOCKS
                BNE INCREMENT_DATA_BLOCKS_DONE
                INC SHA_DATA_BLOCKS+1
                BNE INCREMENT_DATA_BLOCKS_DONE
                INC SHA_DATA_BLOCKS+2
                BNE INCREMENT_DATA_BLOCKS_DONE
                INC SHA_DATA_BLOCKS+3

INCREMENT_DATA_BLOCKS_DONE
                RTS

INCREMENT_TOTAL_BLOCKS
                INC SHA_TOTAL_BLOCKS
                BNE INCREMENT_TOTAL_BLOCKS_DONE
                INC SHA_TOTAL_BLOCKS+1
                BNE INCREMENT_TOTAL_BLOCKS_DONE
                INC SHA_TOTAL_BLOCKS+2
                BNE INCREMENT_TOTAL_BLOCKS_DONE
                INC SHA_TOTAL_BLOCKS+3

INCREMENT_TOTAL_BLOCKS_DONE
                RTS

; ---------------------------------------------------------------------
; SHA256_FINAL
;
; Converts the 64-bit byte count into the required 64-bit bit count,
; adds padding, compresses one or two padding blocks, and exports the
; final digest. Padding bytes do not alter SHA_BYTE_COUNT.
; ---------------------------------------------------------------------

SHA256_FINAL
                CLD
                LDA SHA_BUF_USED
                STA FINAL_REMAINDER
                JSR COMPUTE_BIT_LENGTH

                LDX SHA_BUF_USED
                LDA #$80
                STA SHA_BLOCK,X
                INX

                CPX #57
                BCC SHA256_FINAL_ONE_BLOCK

; No room remains for the 8-byte length. Zero the rest, compress this
; padding block, then start a second all-zero block.

SHA256_FINAL_FIRST_PAD_CLEAR
                CPX #BLOCK_SIZE
                BEQ SHA256_FINAL_FIRST_PAD_READY
                LDA #$00
                STA SHA_BLOCK,X
                INX
                JMP SHA256_FINAL_FIRST_PAD_CLEAR

SHA256_FINAL_FIRST_PAD_READY
                JSR SHA256_COMPRESS
                INC SHA_PADDING_BLOCKS
                JSR INCREMENT_TOTAL_BLOCKS

                LDX #$00
                LDA #$00

SHA256_FINAL_CLEAR_SECOND_BLOCK
                STA SHA_BLOCK,X
                INX
                CPX #BLOCK_SIZE
                BNE SHA256_FINAL_CLEAR_SECOND_BLOCK
                JMP SHA256_FINAL_WRITE_LENGTH

; One final block is sufficient. Clear bytes through offset 55.

SHA256_FINAL_ONE_BLOCK
                CPX #56
                BCS SHA256_FINAL_WRITE_LENGTH

SHA256_FINAL_ONE_BLOCK_CLEAR
                LDA #$00
                STA SHA_BLOCK,X
                INX
                CPX #56
                BNE SHA256_FINAL_ONE_BLOCK_CLEAR

SHA256_FINAL_WRITE_LENGTH
                LDA SHA_BIT_LENGTH+7
                STA SHA_BLOCK+56
                LDA SHA_BIT_LENGTH+6
                STA SHA_BLOCK+57
                LDA SHA_BIT_LENGTH+5
                STA SHA_BLOCK+58
                LDA SHA_BIT_LENGTH+4
                STA SHA_BLOCK+59
                LDA SHA_BIT_LENGTH+3
                STA SHA_BLOCK+60
                LDA SHA_BIT_LENGTH+2
                STA SHA_BLOCK+61
                LDA SHA_BIT_LENGTH+1
                STA SHA_BLOCK+62
                LDA SHA_BIT_LENGTH
                STA SHA_BLOCK+63

                JSR SHA256_COMPRESS
                INC SHA_PADDING_BLOCKS
                JSR INCREMENT_TOTAL_BLOCKS

                LDA #$00
                STA SHA_BUF_USED

                JSR SHA256_EXPORT_DIGEST
                RTS

COMPUTE_BIT_LENGTH
                LDX #$00

COMPUTE_BIT_LENGTH_COPY
                LDA SHA_BYTE_COUNT,X
                STA SHA_BIT_LENGTH,X
                INX
                CPX #$08
                BNE COMPUTE_BIT_LENGTH_COPY

                LDX #$03

COMPUTE_BIT_LENGTH_SHIFT
                ASL SHA_BIT_LENGTH
                ROL SHA_BIT_LENGTH+1
                ROL SHA_BIT_LENGTH+2
                ROL SHA_BIT_LENGTH+3
                ROL SHA_BIT_LENGTH+4
                ROL SHA_BIT_LENGTH+5
                ROL SHA_BIT_LENGTH+6
                ROL SHA_BIT_LENGTH+7
                DEX
                BNE COMPUTE_BIT_LENGTH_SHIFT
                RTS

SHA256_EXPORT_DIGEST
                LDX #$00
                LDY #$00

SHA256_EXPORT_DIGEST_LOOP
                LDA SHA_STATE+3,X
                STA SHA_DIGEST,Y
                INY
                LDA SHA_STATE+2,X
                STA SHA_DIGEST,Y
                INY
                LDA SHA_STATE+1,X
                STA SHA_DIGEST,Y
                INY
                LDA SHA_STATE,X
                STA SHA_DIGEST,Y
                INY

                TXA
                CLC
                ADC #$04
                TAX
                CPX #$20
                BNE SHA256_EXPORT_DIGEST_LOOP
                RTS

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
; =====================================================================
; OUTPUT AND EXIT
; =====================================================================

PRINT_RESULT
                LDX #$00

PRINT_RESULT_LOOP
                LDA XMSS_RESULT,X
                JSR PRBYTE
                INX

                TXA
                AND #$03
                BNE PRINT_RESULT_NO_SPACE
                LDA #$A0
                JSR COUT

PRINT_RESULT_NO_SPACE
                CPX #$10
                BEQ PRINT_RESULT_NEW_ROW
                CPX #$20
                BNE PRINT_RESULT_LOOP
                JSR CROUT
                RTS

PRINT_RESULT_NEW_ROW
                JSR CROUT
                JMP PRINT_RESULT_LOOP

PRINT_ADRS
                LDX #$00

PRINT_ADRS_LOOP
                LDA XMSS_ADRS,X
                JSR PRBYTE
                INX

                TXA
                AND #$03
                BNE PRINT_ADRS_NO_SPACE
                LDA #$A0
                JSR COUT

PRINT_ADRS_NO_SPACE
                CPX #$10
                BEQ PRINT_ADRS_NEW_ROW
                CPX #$20
                BNE PRINT_ADRS_LOOP
                JSR CROUT
                RTS

PRINT_ADRS_NEW_ROW
                JSR CROUT
                JMP PRINT_ADRS_LOOP

PRINT_STATUS
                LDA TEST_STATUS
                BEQ PRINT_STATUS_FAIL

                LDA #<PASS_TEXT
                STA STR_PTR
                LDA #>PASS_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                RTS

PRINT_STATUS_FAIL
                LDA #<FAIL_TEXT
                STA STR_PTR
                LDA #>FAIL_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
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
                LDA SHA_SRC_PTR
                STA SAVED_SHA_SRC_PTR
                LDA SHA_SRC_PTR+1
                STA SAVED_SHA_SRC_PTR+1
                LDA WOTS_SRC_PTR
                STA SAVED_WOTS_SRC_PTR
                LDA WOTS_SRC_PTR+1
                STA SAVED_WOTS_SRC_PTR+1
                LDA WOTS_DST_PTR
                STA SAVED_WOTS_DST_PTR
                LDA WOTS_DST_PTR+1
                STA SAVED_WOTS_DST_PTR+1
                RTS

EXIT_PROGRAM
                LDA SAVED_PROMPT
                STA PROMPT
                LDA SAVED_STR_PTR
                STA STR_PTR
                LDA SAVED_STR_PTR+1
                STA STR_PTR+1
                LDA SAVED_SHA_SRC_PTR
                STA SHA_SRC_PTR
                LDA SAVED_SHA_SRC_PTR+1
                STA SHA_SRC_PTR+1
                LDA SAVED_WOTS_SRC_PTR
                STA WOTS_SRC_PTR
                LDA SAVED_WOTS_SRC_PTR+1
                STA WOTS_SRC_PTR+1
                LDA SAVED_WOTS_DST_PTR
                STA WOTS_DST_PTR
                LDA SAVED_WOTS_DST_PTR+1
                STA WOTS_DST_PTR+1

                CLD
                LDA DOS_WARM
                CMP #$4C
                BNE EXIT_TO_MONITOR
                JMP DOS_WARM

EXIT_TO_MONITOR
                JMP MONITOR

; =====================================================================
; TEXT AND DETERMINISTIC TEST VECTORS
; =====================================================================

TITLE_TEXT
                .BYTE "WOTS+ STAGE 2 / SHA2-256",13
                .BYTE "RFC 8391 / APPLE II+",13,13,0

TEST_ADRS_CLEAR_TEXT
                .BYTE "ADRS SETTYPE CLEAR: ",0

TEST_ADRS_TEXT
                .BYTE "ADRS OTS:",13,0

TEST_F_TEXT
                .BYTE "F:",13,0

TEST_H_TEXT
                .BYTE "H:",13,0

TEST_PRF_TEXT
                .BYTE "PRF(SEED,ADRS):",13,0

TEST_HMSG_TEXT
                .BYTE "H_MSG(KEY96,ABC):",13,0

PASS_TEXT
                .BYTE "PASS",13,13,0

FAIL_TEXT
                .BYTE "FAIL",13,13,0

DONE_TEXT
                .BYTE "WOTS+ STAGE 2 SELF-TEST COMPLETE",13,0

TEST_MESSAGE
                .BYTE $61,$62,$63
TEST_MESSAGE_END
TEST_MESSAGE_LENGTH = TEST_MESSAGE_END-TEST_MESSAGE

EXPECTED_ADRS_TYPE1
                .BYTE $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$01
                .BYTE $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00

EXPECTED_ADRS_OTS
                .BYTE $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
                .BYTE $00,$00,$00,$05,$00,$00,$00,$07,$00,$00,$00,$09,$00,$00,$00,$01

EXPECTED_F
                .BYTE $DC,$7A,$48,$01,$4F,$C1,$FA,$C8,$B5,$2A,$F3,$9B,$C7,$EA,$5C,$AF
                .BYTE $AF,$AB,$F8,$BB,$81,$FB,$8F,$88,$0F,$DF,$3B,$4A,$45,$66,$79,$5C

EXPECTED_H
                .BYTE $44,$44,$6E,$C9,$62,$4F,$65,$4B,$14,$92,$E0,$F5,$67,$26,$F5,$D0
                .BYTE $34,$90,$2E,$05,$F7,$BF,$82,$31,$A7,$15,$2A,$D5,$21,$58,$D3,$65

EXPECTED_PRF_ADRS
                .BYTE $56,$3A,$CE,$8D,$C3,$41,$7F,$2D,$ED,$7F,$4B,$EB,$0A,$02,$38,$74
                .BYTE $E6,$53,$FB,$A5,$C8,$0F,$A7,$36,$5C,$56,$7B,$A3,$A7,$7C,$9B,$52

EXPECTED_HMSG
                .BYTE $39,$18,$3A,$51,$AB,$7E,$A7,$0E,$D6,$08,$1B,$FD,$AA,$5B,$89,$09
                .BYTE $F2,$5D,$A0,$81,$82,$C3,$F2,$84,$D3,$3F,$15,$CD,$0E,$AD,$28,$D6


TEST_WOTS_DIGITS_TEXT
                .BYTE "WOTS BASE-W + CHECKSUM: ",0

TEST_WOTS_SK_TEXT
                .BYTE "WOTS SK ELEMENT 5: ",0

TEST_WOTS_CHAIN0_TEXT
                .BYTE "WOTS CHAIN 0 STEPS: ",0

TEST_WOTS_CHAIN1_TEXT
                .BYTE "WOTS CHAIN 1 STEP: ",0

TEST_WOTS_SIGN_ONE_TEXT
                .BYTE "WOTS SIGN ELEMENT 5: ",0

TEST_WOTS_RECOVER_ONE_TEXT
                .BYTE "WOTS RECOVER PK ELEMENT 5: ",0

EXPECTED_WOTS_DIGITS
                .BYTE $00,$00,$00,$01,$00,$02,$00,$03,$00,$04,$00,$05,$00,$06,$00,$07
                .BYTE $00,$08,$00,$09,$00,$0A,$00,$0B,$00,$0C,$00,$0D,$00,$0E,$00,$0F
                .BYTE $01,$00,$01,$01,$01,$02,$01,$03,$01,$04,$01,$05,$01,$06,$01,$07
                .BYTE $01,$08,$01,$09,$01,$0A,$01,$0B,$01,$0C,$01,$0D,$01,$0E,$01,$0F
                .BYTE $02,$0C,$00

EXPECTED_WOTS_SK5
                .BYTE $E7,$9D,$79,$A3,$1D,$A3,$38,$39,$EE,$6A,$BF,$37,$D6,$26,$0F,$A9
                .BYTE $2A,$A8,$97,$87,$78,$A1,$C4,$9E,$D0,$E6,$37,$6A,$90,$E4,$1C,$93

EXPECTED_WOTS_CHAIN1
                .BYTE $1B,$DF,$F6,$7C,$41,$AD,$39,$A2,$96,$8C,$8D,$12,$CE,$AE,$6A,$FB
                .BYTE $3A,$52,$DC,$30,$36,$84,$D0,$40,$9E,$60,$89,$36,$0D,$E3,$89,$AA

EXPECTED_WOTS_CHAIN15
                .BYTE $A8,$13,$55,$BF,$C1,$87,$66,$45,$08,$DD,$63,$B3,$A0,$E3,$B8,$34
                .BYTE $D0,$2C,$E6,$56,$A3,$E6,$61,$15,$DB,$94,$9B,$96,$99,$10,$CC,$F9

EXPECTED_WOTS_SIGNATURE5
                .BYTE $D2,$98,$D8,$94,$35,$B5,$F8,$D5,$46,$20,$72,$10,$8D,$B9,$2A,$B8
                .BYTE $1D,$7F,$3B,$99,$AF,$34,$7C,$51,$A0,$D7,$C2,$E3,$83,$3E,$BD,$A7

EXPECTED_WOTS_PUBLIC_KEY5
                .BYTE $D1,$87,$A4,$04,$FF,$6F,$A1,$26,$C4,$64,$C3,$3D,$C9,$07,$B4,$93
                .BYTE $E7,$51,$3A,$1A,$E1,$41,$8D,$08,$16,$20,$03,$67,$B1,$1F,$16,$F1


; =====================================================================
; SHA-256 CONSTANTS
; =====================================================================

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


; =====================================================================
; WORKSPACE
; =====================================================================

SHA_SRC_COUNT_LO
                .BYTE $00

SHA_SRC_COUNT_HI
                .BYTE $00

SHA_BUF_USED
                .BYTE $00

FINAL_REMAINDER
                .BYTE $00

SHA_PADDING_BLOCKS
                .BYTE $00

SHA_BYTE_COUNT
                .RES 8

SHA_BIT_LENGTH
                .RES 8

SHA_DATA_BLOCKS
                .RES 4

SHA_TOTAL_BLOCKS
                .RES 4

SHA_BLOCK
                .RES 64

SHA_STATE
                .RES 32

SHA_DIGEST
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

; XMSS public buffers

XMSS_DOMAIN_ID
                .BYTE $00

XMSS_DOMAIN
                .RES 32

XMSS_KEY
                .RES 32

XMSS_M32
                .RES 32

XMSS_M64
                .RES 64

XMSS_HMSG_KEY
                .RES 96

XMSS_MSG_PTR
                .BYTE $00,$00

XMSS_MSG_COUNT
                .BYTE $00,$00

XMSS_RESULT
                .RES 32

XMSS_ADRS
                .RES 32

XMSS_VALUE32
                .RES 4

XMSS_VALUE64
                .RES 8


; WOTS+ public buffers and workspace

WOTS_MESSAGE
                .RES 32

WOTS_DIGITS
                .RES 67

WOTS_CSUM_LO
                .BYTE $00

WOTS_CSUM_HI
                .BYTE $00

WOTS_SK_SEED
                .RES 32

WOTS_SK_INDEX
                .BYTE $00

WOTS_SK_ELEMENT
                .RES 32

WOTS_PUB_SEED
                .RES 32

WOTS_CHAIN_INPUT
                .RES 32

WOTS_CHAIN_OUTPUT
                .RES 32

WOTS_CHAIN_KEY
                .RES 32

WOTS_CHAIN_MASK
                .RES 32

WOTS_CHAIN_START
                .BYTE $00

WOTS_CHAIN_STEPS
                .BYTE $00

WOTS_CHAIN_POSITION
                .BYTE $00

WOTS_CHAIN_REMAINING
                .BYTE $00

WOTS_ELEMENT_INDEX
                .BYTE $00

WOTS_SIGNATURE_PTR
                .BYTE <WOTS_SIGNATURE,>WOTS_SIGNATURE

WOTS_PUBLIC_KEY_PTR
                .BYTE <WOTS_PUBLIC_KEY,>WOTS_PUBLIC_KEY

WOTS_TEST_SIGNATURE_ELEMENT
                .RES 32

; Default internal Stage 2 buffers. Callers may point the public pointer
; variables elsewhere before invoking the full routines.

WOTS_SIGNATURE
                .RES 2144

WOTS_PUBLIC_KEY
                .RES 2144


TEST_STATUS
                .BYTE $00

SAVED_PROMPT
                .BYTE $00

SAVED_STR_PTR
                .BYTE $00,$00

SAVED_SHA_SRC_PTR
                .BYTE $00,$00

SAVED_WOTS_SRC_PTR
                .BYTE $00,$00

SAVED_WOTS_DST_PTR
                .BYTE $00,$00

PROGRAM_END
                .END
