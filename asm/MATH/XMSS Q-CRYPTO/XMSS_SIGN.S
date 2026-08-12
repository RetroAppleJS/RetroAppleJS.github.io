; =====================================================================
; XMSS_TREEHASH1024_O - full height-10 XMSS tree generator
; Apple II+ / 6502, ASM_core.js compatible
;
; Load address: A$4000 L$3C20
; Exit address: $533B
; The assembled image must remain below XMSS_WASM_PROGRESS at $7FFF.
;
; This standalone module embeds XMSS_HASH and WOTS+ Stages 1-2, and adds:
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
; BRUN XMSS_TREEHASH1024 builds a deterministic 1024-leaf development tree.
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

                .ORG $4000

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

; Reserved host-visible progress byte for the WASM runner.
; The program image remains below this address and ProntoDOS starts at $9000.
; Values $00..$FF represent 0..100% of a full 1024-leaf build.
XMSS_WASM_PROGRESS = $7FFF

; ---------------------------------------------------------------------
; Fixed XMSS key/signing-state handoff ABI.
;
; These addresses deliberately live outside the assembled program image.
; A separately BRUN signature generator may therefore use the same fixed
; addresses without depending on this program's internal symbol layout.
;
; Immutable key record: $8C00..$8C8F
; Dedicated mutable idx: $8CF0..$8CF3 (big-endian, RFC serialization)
;
; $8C00..$8C03  magic "XMSS"
; $8C04..$8C07  RFC 8391 parameter identifier $00000001
; $8C08          local ABI version ($01)
; $8C09          flags; bit 0 = complete/ready
; $8C0A..$8C0F  reserved, zero
; $8C10..$8C2F  MASTER_SK_SEED / S
; $8C30..$8C4F  SK_PRF
; $8C50..$8C6F  PUB_SEED
; $8C70..$8C8F  ROOT
;
; idx is intentionally not part of the immutable key record.  A future
; persistence helper can save/restore the key and idx as separate objects.
; ---------------------------------------------------------------------

XMSS_KEY_BASE           = $8C00
XMSS_KEY_MAGIC          = $8C00
XMSS_KEY_OID            = $8C04
XMSS_KEY_ABI_VERSION    = $8C08
XMSS_KEY_FLAGS          = $8C09
XMSS_KEY_RESERVED       = $8C0A
XMSS_KEY_MASTER_SK_SEED = $8C10
XMSS_KEY_SK_PRF         = $8C30
XMSS_KEY_PUB_SEED       = $8C50
XMSS_KEY_ROOT           = $8C70
XMSS_KEY_END            = $8C90
XMSS_KEY_READY          = $01

XMSS_IDX                = $8CF0
XMSS_IDX_0              = $8CF0
XMSS_IDX_1              = $8CF1
XMSS_IDX_2              = $8CF2
XMSS_IDX_3              = $8CF3

; ---------------------------------------------------------------------
; Fixed serialized XMSS-SHA2_10_256 signature output.
;
; RFC 8391 signature layout:
;   idx       4 bytes
;   R        32 bytes
;   WOTS+  2144 bytes
;   auth    320 bytes
;          ----
;          2500 bytes = $09C4
;
; This lives immediately below the fixed $8C00 key ABI page.  WOTS_SIGN
; is pointed directly at XMSS_SIGNATURE_WOTS so its 2144-byte result does
; not need to be copied after generation.
; ---------------------------------------------------------------------

XMSS_SIGNATURE_BASE      = $8200
XMSS_SIGNATURE_IDX       = $8200
XMSS_SIGNATURE_R         = $8204
XMSS_SIGNATURE_WOTS      = $8224
XMSS_SIGNATURE_AUTH      = $8A84
XMSS_SIGNATURE_END       = $8BC4
XMSS_SIGNATURE_LEN_LO    = $C4
XMSS_SIGNATURE_LEN_HI    = $09

XMSS_SIGN_OK             = $00
XMSS_SIGN_ERR_MAGIC      = $01
XMSS_SIGN_ERR_OID        = $02
XMSS_SIGN_ERR_VERSION    = $03
XMSS_SIGN_ERR_NOT_READY  = $04
XMSS_SIGN_ERR_EXHAUSTED  = $05
XMSS_SIGN_ERR_TREEHASH   = $06
XMSS_SIGN_ERR_ROOT       = $07
XMSS_SIGN_ERR_WOTS       = $08

; =====================================================================
; XMSS SIGNATURE GENERATOR ENTRY
;
; Standalone signer consuming only the fixed RAM handoff ABI at $8C00
; and the dedicated mutable idx at $8CF0.  It does not regenerate or
; modify immutable key material.
;
; START / BRUN development shell:
;   signs the embedded three-byte message "abc".
;
; Public compute entry:
;   XMSS_SIGN_API is fixed at $4006 and jumps to XMSS_SIGN_RUN.
;   Caller supplies XMSS_MSG_PTR and XMSS_MSG_COUNT.
;
; Output:
;   $8200..$8BC3 = 2500-byte RFC 8391 XMSS signature
;   carry clear  = success
;   carry set    = failure, XMSS_SIGN_STATUS contains error code
;
; Stateful rule:
;   the current idx is copied to XMSS_SIGN_IDX and incremented in the
;   fixed ABI BEFORE TreeHash/WOTS signing begins.  A later disk helper
;   must persist the updated $8CF0 state at the marked commit hook before
;   a signature is externally released.
;
; Authentication-path note:
;   this first separated signer recomputes the height-10 tree to obtain
;   AUTH[idx].  That is correct but intentionally expensive.  A later
;   traversal/disk layer can replace only that part without changing the
;   fixed key ABI or serialized signature layout.
; =====================================================================

START
                JMP XMSS_SIGN_START

; Fixed WASM handback address.  The comparator stops before this opcode.
XMSS_SIGN_WASM_ESCAPE
                JMP XMSS_SIGN_REPORT

; Stable compute-only API jump entry.
XMSS_SIGN_API
                JMP XMSS_SIGN_RUN

XMSS_SIGN_START
                CLD
                JSR SAVE_ENVIRONMENT
                JSR HOME

                LDA #<XMSS_SIGN_TITLE_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_TITLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                ; Development shell message = "abc".  External callers use
                ; XMSS_SIGN_API and provide their own pointer/count.
                LDA #<XMSS_SIGN_TEST_MESSAGE
                STA XMSS_MSG_PTR
                LDA #>XMSS_SIGN_TEST_MESSAGE
                STA XMSS_MSG_PTR+1
                LDA #XMSS_SIGN_TEST_MESSAGE_LENGTH
                STA XMSS_MSG_COUNT
                LDA #$00
                STA XMSS_MSG_COUNT+1

                LDA #<XMSS_SIGN_BEGIN_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_BEGIN_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JSR XMSS_SIGN_RUN
                JMP XMSS_SIGN_WASM_ESCAPE

; ---------------------------------------------------------------------
; XMSS_SIGN_RUN
;
; Inputs:
;   fixed key ABI       $8C00..$8C8F
;   mutable idx         $8CF0..$8CF3, big-endian
;   XMSS_MSG_PTR        message pointer
;   XMSS_MSG_COUNT      16-bit little-endian message length
;
; Output:
;   fixed signature     $8200..$8BC3
;   XMSS_SIGN_STATUS    zero on success
;   carry clear         success
;   carry set           failure
;
; The fixed idx is consumed as soon as validation succeeds.  Therefore a
; later failure skips one WOTS leaf rather than risking one-time-key reuse.
; ---------------------------------------------------------------------

XMSS_SIGN_RUN
                CLD
                LDA #XMSS_SIGN_OK
                STA XMSS_SIGN_STATUS
                LDA #$00
                STA XMSS_FAST_MODE
                STA XMSS_WASM_PROGRESS

                JSR XMSS_SIGN_VALIDATE_ABI
                BCC XMSS_SIGN_ABI_OK
                RTS

XMSS_SIGN_ABI_OK
                JSR XMSS_SIGN_RESERVE_INDEX

                ; -----------------------------------------------------------------
                ; FUTURE PERSISTENCE COMMIT HOOK
                ;
                ; $8CF0 now contains idx+1 and XMSS_SIGN_IDX contains the idx being
                ; signed.  The future DOS state helper must durably save $8CF0 here
                ; before the resulting signature may be released.
                ; -----------------------------------------------------------------

                JSR XMSS_SIGN_LOAD_TREE_KEY

                ; Recompute AUTH[idx] with the existing optimized real TreeHash.
                ; This is the only deliberately expensive part of the first signer.
                LDA #$00
                STA XMSS_TREE_START_LO
                STA XMSS_TREE_START_HI
                LDA #10
                STA XMSS_TREE_HEIGHT_TARGET
                LDA #$01
                STA XMSS_TREE_LEAF_MODE
                STA XMSS_TREE_CAPTURE_AUTH
                LDA XMSS_SIGN_IDX+3
                STA XMSS_TREE_TARGET_LO
                LDA XMSS_SIGN_IDX+2
                STA XMSS_TREE_TARGET_HI

                JSR XMSS_ADRS_CLEAR
                LDA #$01
                STA XMSS_FAST_MODE
                JSR XMSS_FAST_PRECOMPUTE_TREE_STATES
                JSR XMSS_TREEHASH
                BCC XMSS_SIGN_TREE_OK

                LDA #XMSS_SIGN_ERR_TREEHASH
                JMP XMSS_SIGN_FAIL

XMSS_SIGN_TREE_OK
                JSR XMSS_SIGN_COMPARE_ROOT
                BCC XMSS_SIGN_ROOT_OK
                LDA #XMSS_SIGN_ERR_ROOT
                JMP XMSS_SIGN_FAIL

XMSS_SIGN_ROOT_OK
                ; Compute R = PRF(SK_PRF, toByte(idx,32)).
                JSR XMSS_SIGN_COMPUTE_R

                ; Compute M' = H_msg(R || ROOT || toByte(idx,32), message).
                JSR XMSS_SIGN_BUILD_HMSG_KEY
                JSR XMSS_H_MSG

                ; WOTS+ signs M'.  Preserve the digest before deriving S_ots,
                ; because the derivation uses XMSS_RESULT as its PRF result.
                LDX #$00
XMSS_SIGN_COPY_DIGEST
                LDA XMSS_RESULT,X
                STA WOTS_MESSAGE,X
                INX
                CPX #32
                BNE XMSS_SIGN_COPY_DIGEST

                ; Derive S_ots for the reserved leaf.  With FAST_MODE still set,
                ; this also installs the per-leaf cached WOTS PRF state.
                LDA XMSS_SIGN_IDX+3
                STA XMSS_TREE_LEAF_INDEX_LO
                LDA XMSS_SIGN_IDX+2
                STA XMSS_TREE_LEAF_INDEX_HI
                JSR XMSS_DERIVE_WOTS_SEED

                ; Install OTS address = idx.
                JSR XMSS_ADRS_CLEAR
                LDA #$00
                JSR XMSS_ADRS_SET_TYPE
                JSR XMSS_VALUE32_SET_LEAF_INDEX
                JSR XMSS_ADRS_SET_OTS

                ; Write the WOTS signature directly into its final serialized
                ; position at $8224; no 2144-byte post-copy is required.
                LDA #<XMSS_SIGNATURE_WOTS
                STA WOTS_SIGNATURE_PTR
                LDA #>XMSS_SIGNATURE_WOTS
                STA WOTS_SIGNATURE_PTR+1
                JSR WOTS_SIGN
                BCC XMSS_SIGN_WOTS_OK

                LDA #XMSS_SIGN_ERR_WOTS
                JMP XMSS_SIGN_FAIL

XMSS_SIGN_WOTS_OK
                ; Copy the already-captured 320-byte auth path into the final
                ; signature image: 256 bytes followed by 64 bytes.
                LDX #$00
XMSS_SIGN_COPY_AUTH_0_255
                LDA XMSS_AUTH_PATH,X
                STA XMSS_SIGNATURE_AUTH,X
                INX
                BNE XMSS_SIGN_COPY_AUTH_0_255

                LDX #$00
XMSS_SIGN_COPY_AUTH_256_319
                LDA XMSS_AUTH_PATH+256,X
                STA XMSS_SIGNATURE_AUTH+256,X
                INX
                CPX #64
                BNE XMSS_SIGN_COPY_AUTH_256_319

                LDA #$00
                STA XMSS_FAST_MODE
                LDA #$FF
                STA XMSS_WASM_PROGRESS
                LDA #XMSS_SIGN_OK
                STA XMSS_SIGN_STATUS
                CLC
                RTS

XMSS_SIGN_FAIL
                STA XMSS_SIGN_STATUS
                LDA #$00
                STA XMSS_FAST_MODE
                SEC
                RTS

; ---------------------------------------------------------------------
; Validate the fixed RAM key ABI and check idx < 1024.
; ---------------------------------------------------------------------

XMSS_SIGN_VALIDATE_ABI
                LDA XMSS_KEY_MAGIC
                CMP #$58
                BNE XMSS_SIGN_BAD_MAGIC
                LDA XMSS_KEY_MAGIC+1
                CMP #$4D
                BNE XMSS_SIGN_BAD_MAGIC
                LDA XMSS_KEY_MAGIC+2
                CMP #$53
                BNE XMSS_SIGN_BAD_MAGIC
                LDA XMSS_KEY_MAGIC+3
                CMP #$53
                BNE XMSS_SIGN_BAD_MAGIC

                LDA XMSS_KEY_OID
                ORA XMSS_KEY_OID+1
                ORA XMSS_KEY_OID+2
                BNE XMSS_SIGN_BAD_OID
                LDA XMSS_KEY_OID+3
                CMP #$01
                BNE XMSS_SIGN_BAD_OID

                LDA XMSS_KEY_ABI_VERSION
                CMP #$01
                BNE XMSS_SIGN_BAD_VERSION

                LDA XMSS_KEY_FLAGS
                AND #XMSS_KEY_READY
                BEQ XMSS_SIGN_NOT_READY

                ; Height 10 => valid idx = $00000000..$000003FF.
                LDA XMSS_IDX_0
                ORA XMSS_IDX_1
                BNE XMSS_SIGN_EXHAUSTED
                LDA XMSS_IDX_2
                CMP #$04
                BCS XMSS_SIGN_EXHAUSTED

                CLC
                RTS

XMSS_SIGN_BAD_MAGIC
                LDA #XMSS_SIGN_ERR_MAGIC
                JMP XMSS_SIGN_VALIDATE_FAIL

XMSS_SIGN_BAD_OID
                LDA #XMSS_SIGN_ERR_OID
                JMP XMSS_SIGN_VALIDATE_FAIL

XMSS_SIGN_BAD_VERSION
                LDA #XMSS_SIGN_ERR_VERSION
                JMP XMSS_SIGN_VALIDATE_FAIL

XMSS_SIGN_NOT_READY
                LDA #XMSS_SIGN_ERR_NOT_READY
                JMP XMSS_SIGN_VALIDATE_FAIL

XMSS_SIGN_EXHAUSTED
                LDA #XMSS_SIGN_ERR_EXHAUSTED

XMSS_SIGN_VALIDATE_FAIL
                STA XMSS_SIGN_STATUS
                SEC
                RTS

; ---------------------------------------------------------------------
; Reserve the current leaf.
;
; Copy the current four-byte big-endian idx both to local signer state and
; to the serialized signature, then increment the persistent ABI idx.
; ---------------------------------------------------------------------

XMSS_SIGN_RESERVE_INDEX
                LDX #$00
XMSS_SIGN_RESERVE_COPY
                LDA XMSS_IDX,X
                STA XMSS_SIGN_IDX,X
                STA XMSS_SIGNATURE_IDX,X
                INX
                CPX #$04
                BNE XMSS_SIGN_RESERVE_COPY

                INC XMSS_IDX_3
                BNE XMSS_SIGN_RESERVE_DONE
                INC XMSS_IDX_2
                BNE XMSS_SIGN_RESERVE_DONE
                INC XMSS_IDX_1
                BNE XMSS_SIGN_RESERVE_DONE
                INC XMSS_IDX_0

XMSS_SIGN_RESERVE_DONE
                RTS

; ---------------------------------------------------------------------
; Load immutable tree material from the fixed ABI into the existing
; cryptographic work buffers.
; ---------------------------------------------------------------------

XMSS_SIGN_LOAD_TREE_KEY
                LDX #$00
XMSS_SIGN_LOAD_TREE_KEY_LOOP
                LDA XMSS_KEY_MASTER_SK_SEED,X
                STA XMSS_MASTER_SK_SEED,X
                LDA XMSS_KEY_PUB_SEED,X
                STA WOTS_PUB_SEED,X
                INX
                CPX #32
                BNE XMSS_SIGN_LOAD_TREE_KEY_LOOP
                RTS

; ---------------------------------------------------------------------
; Compare recomputed root with the immutable root stored in the key ABI.
; ---------------------------------------------------------------------

XMSS_SIGN_COMPARE_ROOT
                LDX #$00
XMSS_SIGN_COMPARE_ROOT_LOOP
                LDA XMSS_TREE_ROOT,X
                CMP XMSS_KEY_ROOT,X
                BNE XMSS_SIGN_COMPARE_ROOT_FAIL
                INX
                CPX #32
                BNE XMSS_SIGN_COMPARE_ROOT_LOOP
                CLC
                RTS

XMSS_SIGN_COMPARE_ROOT_FAIL
                SEC
                RTS

; ---------------------------------------------------------------------
; R = PRF(SK_PRF, toByte(idx,32)).
; Also store R directly in the serialized signature at $8204.
; ---------------------------------------------------------------------

XMSS_SIGN_COMPUTE_R
                LDX #$00
XMSS_SIGN_R_PREP_LOOP
                LDA XMSS_KEY_SK_PRF,X
                STA XMSS_KEY,X
                LDA #$00
                STA XMSS_M32,X
                INX
                CPX #32
                BNE XMSS_SIGN_R_PREP_LOOP

                LDX #$00
XMSS_SIGN_R_INDEX_LOOP
                LDA XMSS_SIGN_IDX,X
                STA XMSS_M32+28,X
                INX
                CPX #$04
                BNE XMSS_SIGN_R_INDEX_LOOP

                JSR XMSS_PRF

                LDX #$00
XMSS_SIGN_R_COPY_LOOP
                LDA XMSS_RESULT,X
                STA XMSS_SIGNATURE_R,X
                INX
                CPX #32
                BNE XMSS_SIGN_R_COPY_LOOP
                RTS

; ---------------------------------------------------------------------
; Build the 96-byte H_msg key:
;   R || ROOT || toByte(idx,32)
; ---------------------------------------------------------------------

XMSS_SIGN_BUILD_HMSG_KEY
                LDX #$00
XMSS_SIGN_HMSG_COPY_R_ROOT
                LDA XMSS_SIGNATURE_R,X
                STA XMSS_HMSG_KEY,X
                LDA XMSS_KEY_ROOT,X
                STA XMSS_HMSG_KEY+32,X
                LDA #$00
                STA XMSS_HMSG_KEY+64,X
                INX
                CPX #32
                BNE XMSS_SIGN_HMSG_COPY_R_ROOT

                LDX #$00
XMSS_SIGN_HMSG_COPY_INDEX
                LDA XMSS_SIGN_IDX,X
                STA XMSS_HMSG_KEY+92,X
                INX
                CPX #$04
                BNE XMSS_SIGN_HMSG_COPY_INDEX
                RTS

; ---------------------------------------------------------------------
; Development/report shell.  No signature bytes are printed in full; the
; 2500-byte result remains at $8200 for monitor/emulator inspection.
; ---------------------------------------------------------------------

XMSS_SIGN_REPORT
                CLD
                LDA XMSS_SIGN_STATUS
                BEQ XMSS_SIGN_REPORT_OK

                LDA #<XMSS_SIGN_FAIL_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_FAIL_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDA XMSS_SIGN_STATUS
                JSR PRBYTE
                JSR CROUT
                JMP EXIT_PROGRAM

XMSS_SIGN_REPORT_OK
                LDA #<XMSS_SIGN_DONE_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_DONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                LDA #<XMSS_SIGN_IDX_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_IDX_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDX #$00
XMSS_SIGN_REPORT_IDX_LOOP
                LDA XMSS_SIGN_IDX,X
                JSR PRBYTE
                INX
                CPX #$04
                BNE XMSS_SIGN_REPORT_IDX_LOOP
                JSR CROUT

                LDA #<XMSS_SIGN_R_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_R_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDX #$00
XMSS_SIGN_REPORT_R_COPY
                LDA XMSS_SIGNATURE_R,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE XMSS_SIGN_REPORT_R_COPY
                JSR PRINT_RESULT

                LDA #<XMSS_SIGN_NEXT_IDX_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_NEXT_IDX_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                LDX #$00
XMSS_SIGN_REPORT_NEXT_IDX_LOOP
                LDA XMSS_IDX,X
                JSR PRBYTE
                INX
                CPX #$04
                BNE XMSS_SIGN_REPORT_NEXT_IDX_LOOP
                JSR CROUT

                LDA #<XMSS_SIGN_LOCATION_TEXT
                STA STR_PTR
                LDA #>XMSS_SIGN_LOCATION_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JMP EXIT_PROGRAM

XMSS_SIGN_TITLE_TEXT
                .BYTE "XMSS SIGN / SHA2-10-256",13
                .BYTE "FIXED KEY ABI $8C00 / IDX $8CF0",13
                .BYTE "SIGNATURE $8200-$8BC3",13
                .BYTE "WASM STOP/ESCAPE: $4003",13,13,0

XMSS_SIGN_BEGIN_TEXT
                .BYTE "SIGNING MESSAGE ABC...",13
                .BYTE "RECOMPUTING AUTH PATH",13
                .BYTE "ENGAGE WASM ACCELERATOR NOW",13,0

XMSS_SIGN_FAIL_TEXT
                .BYTE 13,"XMSS SIGN FAILED, STATUS $",0

XMSS_SIGN_DONE_TEXT
                .BYTE 13,"XMSS SIGNATURE COMPLETE",13,0

XMSS_SIGN_IDX_TEXT
                .BYTE "SIGNED IDX $",0

XMSS_SIGN_R_TEXT
                .BYTE "R:",13,0

XMSS_SIGN_NEXT_IDX_TEXT
                .BYTE "NEXT IDX $",0

XMSS_SIGN_LOCATION_TEXT
                .BYTE "2500 BYTES AT $8200-$8BC3",13,0

XMSS_SIGN_TEST_MESSAGE
                .BYTE $61,$62,$63
XMSS_SIGN_TEST_MESSAGE_END
XMSS_SIGN_TEST_MESSAGE_LENGTH = XMSS_SIGN_TEST_MESSAGE_END-XMSS_SIGN_TEST_MESSAGE


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

; ---------------------------------------------------------------------
; Fixed-size SHA-256 paths for the XMSS hot functions.
;
; F / PRF / PRF_ADRS always hash exactly 96 bytes:
;     toByte(domain,32) || KEY || M32/ADRS
; so the second SHA block is always:
;     32 data bytes || $80 || 29 zero bytes || $03,$00
;
; H always hashes exactly 128 bytes and therefore uses a fixed third
; padding block ending in the bit length $0400.
;
; These paths bypass SHA256_UPDATE, byte counters, buffer bookkeeping and
; generic SHA256_FINAL.  H_msg remains on the streaming interface because
; its message length is intentionally variable.
; ---------------------------------------------------------------------

XMSS_FAST_EXPORT_RESULT
                LDX #$00
                LDY #$00

XMSS_FAST_EXPORT_RESULT_LOOP
                LDA SHA_STATE+3,X
                STA SHA_DIGEST,Y
                STA XMSS_RESULT,Y
                INY
                LDA SHA_STATE+2,X
                STA SHA_DIGEST,Y
                STA XMSS_RESULT,Y
                INY
                LDA SHA_STATE+1,X
                STA SHA_DIGEST,Y
                STA XMSS_RESULT,Y
                INY
                LDA SHA_STATE,X
                STA SHA_DIGEST,Y
                STA XMSS_RESULT,Y
                INY
                TXA
                CLC
                ADC #$04
                TAX
                CPX #$20
                BNE XMSS_FAST_EXPORT_RESULT_LOOP
                RTS

; A = domain id.  Compress the first fixed 64-byte block
; toByte(domain,32) || XMSS_KEY directly from SHA_INITIAL_STATE.

XMSS_SHA_FIXED_BEGIN_KEY
                STA XMSS_DOMAIN_ID
                LDX #$00

XMSS_SHA_FIXED_INIT_STATE_LOOP
                LDA SHA_INITIAL_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE XMSS_SHA_FIXED_INIT_STATE_LOOP

                LDX #$00
                LDA #$00

XMSS_SHA_FIXED_CLEAR_DOMAIN_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #32
                BNE XMSS_SHA_FIXED_CLEAR_DOMAIN_LOOP

                LDA XMSS_DOMAIN_ID
                STA SHA_BLOCK+31

                LDX #$00

XMSS_SHA_FIXED_COPY_KEY_LOOP
                LDA XMSS_KEY,X
                STA SHA_BLOCK+32,X
                INX
                CPX #32
                BNE XMSS_SHA_FIXED_COPY_KEY_LOOP

                JSR SHA256_COMPRESS
                RTS

; SHA_SRC_PTR points at the variable 32-byte second-block payload.

XMSS_SHA96_FINAL_PTR
                LDY #$00

XMSS_SHA96_COPY_DATA_LOOP
                LDA (SHA_SRC_PTR),Y
                STA SHA_BLOCK,Y
                INY
                CPY #32
                BNE XMSS_SHA96_COPY_DATA_LOOP
                JMP XMSS_SHA96_PAD_COMPRESS

; First 32 bytes of SHA_BLOCK are already the final data payload.

XMSS_SHA96_PAD_COMPRESS
                LDA #$80
                STA SHA_BLOCK+32
                LDX #33
                LDA #$00

XMSS_SHA96_CLEAR_PAD_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #62
                BNE XMSS_SHA96_CLEAR_PAD_LOOP

                LDA #$03
                STA SHA_BLOCK+62
                LDA #$00
                STA SHA_BLOCK+63
                JSR SHA256_COMPRESS
                JSR XMSS_FAST_EXPORT_RESULT
                RTS

XMSS_SHA128_FINAL_M64
                LDX #$00

XMSS_SHA128_COPY_M64_LOOP
                LDA XMSS_M64,X
                STA SHA_BLOCK,X
                INX
                CPX #64
                BNE XMSS_SHA128_COPY_M64_LOOP

                JSR SHA256_COMPRESS

                LDA #$80
                STA SHA_BLOCK
                LDX #$01
                LDA #$00

XMSS_SHA128_CLEAR_PAD_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #62
                BNE XMSS_SHA128_CLEAR_PAD_LOOP

                LDA #$04
                STA SHA_BLOCK+62
                LDA #$00
                STA SHA_BLOCK+63
                JSR SHA256_COMPRESS
                JSR XMSS_FAST_EXPORT_RESULT
                RTS

XMSS_F
                LDA #$00
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDA #<XMSS_M32
                STA SHA_SRC_PTR
                LDA #>XMSS_M32
                STA SHA_SRC_PTR+1
                JMP XMSS_SHA96_FINAL_PTR

XMSS_H
                LDA #$01
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                JMP XMSS_SHA128_FINAL_M64

XMSS_PRF
                LDA #$03
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDA #<XMSS_M32
                STA SHA_SRC_PTR
                LDA #>XMSS_M32
                STA SHA_SRC_PTR+1
                JMP XMSS_SHA96_FINAL_PTR

XMSS_PRF_ADRS
                LDA #$03
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDA #<XMSS_ADRS
                STA SHA_SRC_PTR
                LDA #>XMSS_ADRS
                STA SHA_SRC_PTR+1
                JMP XMSS_SHA96_FINAL_PTR

; ---------------------------------------------------------------------
; Cached PRF first-block states used only while XMSS_FAST_MODE is set.
; The first block of these PRFs is constant over large parts of TreeHash:
;
;   PUB cache    = compress(IV, toByte(3,32) || PUB_SEED)
;   MASTER cache = compress(IV, toByte(3,32) || MASTER_SK_SEED)
;   WOTS cache   = compress(IV, toByte(3,32) || S_ots[current leaf])
;
; A cached PRF then needs only its final padded block, cutting those PRFs
; from two SHA-256 compressions to one.
; ---------------------------------------------------------------------

XMSS_FAST_PRECOMPUTE_TREE_STATES
                JSR WOTS_COPY_PUB_SEED_TO_KEY
                LDA #$03
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDX #$00

XMSS_FAST_SAVE_PUB_STATE_LOOP
                LDA SHA_STATE,X
                STA XMSS_FAST_PUB_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_SAVE_PUB_STATE_LOOP

                LDX #$00

XMSS_FAST_COPY_MASTER_KEY_LOOP
                LDA XMSS_MASTER_SK_SEED,X
                STA XMSS_KEY,X
                INX
                CPX #32
                BNE XMSS_FAST_COPY_MASTER_KEY_LOOP

                LDA #$03
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDX #$00

XMSS_FAST_SAVE_MASTER_STATE_LOOP
                LDA SHA_STATE,X
                STA XMSS_FAST_MASTER_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_SAVE_MASTER_STATE_LOOP
                RTS

XMSS_FAST_PRECOMPUTE_WOTS_STATE
                LDX #$00

XMSS_FAST_COPY_WOTS_KEY_LOOP
                LDA WOTS_SK_SEED,X
                STA XMSS_KEY,X
                INX
                CPX #32
                BNE XMSS_FAST_COPY_WOTS_KEY_LOOP

                LDA #$03
                JSR XMSS_SHA_FIXED_BEGIN_KEY
                LDX #$00

XMSS_FAST_SAVE_WOTS_STATE_LOOP
                LDA SHA_STATE,X
                STA XMSS_FAST_WOTS_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_SAVE_WOTS_STATE_LOOP
                RTS

XMSS_FAST_RESTORE_PUB_STATE
                LDX #$00
XMSS_FAST_RESTORE_PUB_LOOP
                LDA XMSS_FAST_PUB_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_RESTORE_PUB_LOOP
                RTS

XMSS_FAST_RESTORE_MASTER_STATE
                LDX #$00
XMSS_FAST_RESTORE_MASTER_LOOP
                LDA XMSS_FAST_MASTER_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_RESTORE_MASTER_LOOP
                RTS

XMSS_FAST_RESTORE_WOTS_STATE
                LDX #$00
XMSS_FAST_RESTORE_WOTS_LOOP
                LDA XMSS_FAST_WOTS_STATE,X
                STA SHA_STATE,X
                INX
                CPX #32
                BNE XMSS_FAST_RESTORE_WOTS_LOOP
                RTS

; Cached PUB_SEED PRF for WOTS+/RAND_HASH ADRS calls.
XMSS_PRF_ADRS_FAST
                JSR XMSS_FAST_RESTORE_PUB_STATE
                LDA #<XMSS_ADRS
                STA SHA_SRC_PTR
                LDA #>XMSS_ADRS
                STA SHA_SRC_PTR+1
                JMP XMSS_SHA96_FINAL_PTR

XMSS_PRF_ADRS_DISPATCH
                LDA XMSS_FAST_MODE
                BEQ XMSS_PRF_ADRS_DISPATCH_SLOW
                JMP XMSS_PRF_ADRS_FAST
XMSS_PRF_ADRS_DISPATCH_SLOW
                JSR WOTS_COPY_PUB_SEED_TO_KEY
                JMP XMSS_PRF_ADRS

; Cached MASTER seed PRF for S_ots[index].  The second block is
; toByte(index,32) followed by the fixed 96-byte-message padding.
XMSS_PRF_MASTER_LEAF_FAST
                JSR XMSS_FAST_RESTORE_MASTER_STATE
                LDX #$00
                LDA #$00
XMSS_FAST_MASTER_CLEAR_INDEX_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #30
                BNE XMSS_FAST_MASTER_CLEAR_INDEX_LOOP
                LDA XMSS_TREE_LEAF_INDEX_HI
                STA SHA_BLOCK+30
                LDA XMSS_TREE_LEAF_INDEX_LO
                STA SHA_BLOCK+31
                JMP XMSS_SHA96_PAD_COMPRESS

; Cached per-leaf S_ots PRF for WOTS secret element index 0..66.
XMSS_PRF_WOTS_INDEX_FAST
                JSR XMSS_FAST_RESTORE_WOTS_STATE
                LDX #$00
                LDA #$00
XMSS_FAST_WOTS_CLEAR_INDEX_LOOP
                STA SHA_BLOCK,X
                INX
                CPX #31
                BNE XMSS_FAST_WOTS_CLEAR_INDEX_LOOP
                LDA WOTS_SK_INDEX
                STA SHA_BLOCK+31
                JMP XMSS_SHA96_PAD_COMPRESS

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
                LDA XMSS_FAST_MODE
                BEQ WOTS_GEN_SK_ELEMENT_SLOW
                JSR XMSS_PRF_WOTS_INDEX_FAST
                JMP WOTS_COPY_SK_RESULT

WOTS_GEN_SK_ELEMENT_SLOW
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

WOTS_COPY_SK_RESULT
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

                LDA #$00
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS_DISPATCH

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
                JSR XMSS_PRF_ADRS_DISPATCH

                ; XMSS_RESULT is the bitmask.  Consume it directly instead of
                ; copying it to WOTS_CHAIN_MASK and reading it back again.
                LDX #$00

WOTS_PREPARE_F_LOOP
                LDA WOTS_CHAIN_KEY,X
                STA XMSS_KEY,X

                LDA XMSS_RESULT,X
                EOR WOTS_CHAIN_OUTPUT,X
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
; XMSS RANDOMIZED TREE HASH AND L-TREE
;
; RFC 8391 Algorithm 7:
;
;   KEY  = PRF(PUB_SEED, ADRS with keyAndMask = 0)
;   BM_0 = PRF(PUB_SEED, ADRS with keyAndMask = 1)
;   BM_1 = PRF(PUB_SEED, ADRS with keyAndMask = 2)
;   result = H(KEY, (LEFT XOR BM_0) || (RIGHT XOR BM_1))
;
; Input:
;   XMSS_RAND_LEFT      32-byte left node
;   XMSS_RAND_RIGHT     32-byte right node
;   WOTS_PUB_SEED       32-byte public seed
;   XMSS_ADRS           L-tree or hash-tree address
;
; Output:
;   XMSS_RAND_RESULT    32-byte randomized hash
;   XMSS_RESULT         same 32-byte value
;
; The caller selects ADRS type and the tree-specific fields. This routine
; only changes keyAndMask.
; =====================================================================

XMSS_RAND_HASH
                CLD

                LDA #$00
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS_DISPATCH

                LDX #$00

XMSS_RAND_SAVE_KEY_LOOP
                LDA XMSS_RESULT,X
                STA XMSS_RAND_KEY,X
                INX
                CPX #32
                BNE XMSS_RAND_SAVE_KEY_LOOP

                LDA #$01
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS_DISPATCH

                LDX #$00

XMSS_RAND_MASK_LEFT_LOOP
                LDA XMSS_RAND_LEFT,X
                EOR XMSS_RESULT,X
                STA XMSS_M64,X
                INX
                CPX #32
                BNE XMSS_RAND_MASK_LEFT_LOOP

                LDA #$02
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_KEY_MASK
                JSR XMSS_PRF_ADRS_DISPATCH

                LDX #$00

XMSS_RAND_MASK_RIGHT_LOOP
                LDA XMSS_RAND_RIGHT,X
                EOR XMSS_RESULT,X
                STA XMSS_M64+32,X
                INX
                CPX #32
                BNE XMSS_RAND_MASK_RIGHT_LOOP

                LDX #$00

XMSS_RAND_RESTORE_KEY_LOOP
                LDA XMSS_RAND_KEY,X
                STA XMSS_KEY,X
                INX
                CPX #32
                BNE XMSS_RAND_RESTORE_KEY_LOOP

                JSR XMSS_H

                LDX #$00

XMSS_RAND_COPY_RESULT_LOOP
                LDA XMSS_RESULT,X
                STA XMSS_RAND_RESULT,X
                INX
                CPX #32
                BNE XMSS_RAND_COPY_RESULT_LOOP

                CLC
                RTS

; Point XMSS_LTREE_PTR at the WOTS+ public-key element array selected by
; WOTS_PUBLIC_KEY_PTR.

XMSS_LTREE_USE_WOTS_PUBLIC_KEY
                LDA WOTS_PUBLIC_KEY_PTR
                STA XMSS_LTREE_PTR
                LDA WOTS_PUBLIC_KEY_PTR+1
                STA XMSS_LTREE_PTR+1
                RTS

; RFC 8391 Algorithm 8 for the fixed WOTSP-SHA2_256 length of 67.
;
; Input:
;   WOTS_PUBLIC_KEY_PTR  points to 67 consecutive 32-byte PK elements
;   WOTS_PUB_SEED        public seed
;   XMSS_ADRS            type 1, with L-tree address already selected
;
; Output:
;   XMSS_LTREE_LEAF      32-byte compressed leaf
;   first 32 bytes at WOTS_PUBLIC_KEY_PTR also contain the leaf
;
; The public-key array is compressed in place.

XMSS_LTREE
                JSR XMSS_LTREE_USE_WOTS_PUBLIC_KEY
                LDA #67
                STA XMSS_LTREE_LEN
                JMP XMSS_LTREE_CORE

; General in-place L-tree compressor used by the self-test and by callers
; that need to validate smaller trees.
;
; Input:
;   XMSS_LTREE_PTR       points to XMSS_LTREE_LEN consecutive nodes
;   XMSS_LTREE_LEN       node count, 1..255
;   WOTS_PUB_SEED
;   XMSS_ADRS            configured L-tree address
;
; Output:
;   XMSS_LTREE_LEAF
;   first node at XMSS_LTREE_PTR
;   carry clear = success
;   carry set   = zero input length

XMSS_LTREE_CORE
                CLD

                LDA XMSS_LTREE_LEN
                BNE XMSS_LTREE_LENGTH_OK
                SEC
                RTS

XMSS_LTREE_LENGTH_OK
                LDA #$00
                STA XMSS_LTREE_HEIGHT
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_HEIGHT

XMSS_LTREE_LEVEL_LOOP
                LDA XMSS_LTREE_LEN
                CMP #$02
                BCC XMSS_LTREE_DONE

                LDA XMSS_LTREE_PTR
                STA WOTS_SRC_PTR
                STA WOTS_DST_PTR
                LDA XMSS_LTREE_PTR+1
                STA WOTS_SRC_PTR+1
                STA WOTS_DST_PTR+1

                LDA XMSS_LTREE_LEN
                LSR
                STA XMSS_LTREE_PAIR_COUNT

                LDA #$00
                STA XMSS_LTREE_PAIR_INDEX

XMSS_LTREE_PAIR_LOOP
                LDA XMSS_LTREE_PAIR_INDEX
                CMP XMSS_LTREE_PAIR_COUNT
                BEQ XMSS_LTREE_PAIRS_DONE

                JSR XMSS_LTREE_LOAD_LEFT
                JSR WOTS_ADVANCE_SOURCE_32
                JSR XMSS_LTREE_LOAD_RIGHT
                JSR WOTS_ADVANCE_SOURCE_32

                LDA XMSS_LTREE_PAIR_INDEX
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_INDEX

                JSR XMSS_RAND_HASH
                BCS XMSS_LTREE_FAIL

                JSR XMSS_LTREE_STORE_RESULT
                JSR WOTS_ADVANCE_DEST_32

                INC XMSS_LTREE_PAIR_INDEX
                JMP XMSS_LTREE_PAIR_LOOP

XMSS_LTREE_PAIRS_DONE
                LDA XMSS_LTREE_LEN
                AND #$01
                BEQ XMSS_LTREE_NO_ODD_NODE

                JSR XMSS_LTREE_COPY_ODD_NODE
                JSR WOTS_ADVANCE_DEST_32

XMSS_LTREE_NO_ODD_NODE
                LDA XMSS_LTREE_LEN
                CLC
                ADC #$01
                LSR
                STA XMSS_LTREE_LEN

                INC XMSS_LTREE_HEIGHT
                LDA XMSS_LTREE_HEIGHT
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_HEIGHT
                JMP XMSS_LTREE_LEVEL_LOOP

XMSS_LTREE_DONE
                LDA XMSS_LTREE_PTR
                STA WOTS_SRC_PTR
                LDA XMSS_LTREE_PTR+1
                STA WOTS_SRC_PTR+1

                LDY #$00

XMSS_LTREE_COPY_LEAF_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_LTREE_LEAF,Y
                INY
                CPY #32
                BNE XMSS_LTREE_COPY_LEAF_LOOP

                CLC
                RTS

XMSS_LTREE_FAIL
                SEC
                RTS

XMSS_LTREE_LOAD_LEFT
                LDY #$00

XMSS_LTREE_LOAD_LEFT_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_RAND_LEFT,Y
                INY
                CPY #32
                BNE XMSS_LTREE_LOAD_LEFT_LOOP
                RTS

XMSS_LTREE_LOAD_RIGHT
                LDY #$00

XMSS_LTREE_LOAD_RIGHT_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_RAND_RIGHT,Y
                INY
                CPY #32
                BNE XMSS_LTREE_LOAD_RIGHT_LOOP
                RTS

XMSS_LTREE_STORE_RESULT
                LDY #$00

XMSS_LTREE_STORE_RESULT_LOOP
                LDA XMSS_RAND_RESULT,Y
                STA (WOTS_DST_PTR),Y
                INY
                CPY #32
                BNE XMSS_LTREE_STORE_RESULT_LOOP
                RTS

; The odd node is copied upward unchanged, as required by Algorithm 8.

XMSS_LTREE_COPY_ODD_NODE
                LDY #$00

XMSS_LTREE_COPY_ODD_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA (WOTS_DST_PTR),Y
                INY
                CPY #32
                BNE XMSS_LTREE_COPY_ODD_LOOP
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
; XMSS RAND_HASH AND L-TREE QUICK SELF-TESTS
;
; The L-tree self-test uses three nodes. This exercises both randomized
; hashing and the RFC odd-node copy rule without running the full 67-node
; compression on a 1 MHz machine.
; =====================================================================

BUILD_LTREE_TEST_ADRS
                JSR XMSS_ADRS_CLEAR
                LDA #$01
                JSR XMSS_ADRS_SET_TYPE

                LDA #$05
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_LTREE

                LDA #$00
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_HEIGHT
                JSR XMSS_ADRS_SET_TREE_INDEX
                RTS

INIT_RAND_HASH_TEST_NODES
                LDX #$00

INIT_RAND_HASH_TEST_LOOP
                TXA
                STA XMSS_RAND_LEFT,X
                CLC
                ADC #$20
                STA XMSS_RAND_RIGHT,X
                INX
                CPX #32
                BNE INIT_RAND_HASH_TEST_LOOP
                RTS

TEST_XMSS_RAND_HASH
                JSR BUILD_LTREE_TEST_ADRS
                JSR INIT_RAND_HASH_TEST_NODES
                JSR XMSS_RAND_HASH

                LDA #<TEST_RAND_HASH_TEXT
                STA STR_PTR
                LDA #>TEST_RAND_HASH_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_RAND_HASH
                STA STR_PTR
                LDA #>EXPECTED_RAND_HASH
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

INIT_LTREE_TEST_NODES
                LDX #$00

INIT_LTREE_TEST_NODES_LOOP
                LDA LTREE_TEST_NODES_SOURCE,X
                STA LTREE_TEST_NODES,X
                INX
                CPX #96
                BNE INIT_LTREE_TEST_NODES_LOOP
                RTS

TEST_XMSS_LTREE_SMALL
                JSR INIT_LTREE_TEST_NODES
                JSR BUILD_LTREE_TEST_ADRS

                LDA #<LTREE_TEST_NODES
                STA XMSS_LTREE_PTR
                LDA #>LTREE_TEST_NODES
                STA XMSS_LTREE_PTR+1
                LDA #$03
                STA XMSS_LTREE_LEN

                JSR XMSS_LTREE_CORE
                BCS TEST_XMSS_LTREE_SMALL_FAIL

                LDX #$00

TEST_XMSS_LTREE_COPY_RESULT_LOOP
                LDA XMSS_LTREE_LEAF,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE TEST_XMSS_LTREE_COPY_RESULT_LOOP

                LDA #<TEST_LTREE_TEXT
                STA STR_PTR
                LDA #>TEST_LTREE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_LTREE3
                STA STR_PTR
                LDA #>EXPECTED_LTREE3
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_LTREE_SMALL_FAIL
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

; Rotate/shift optimization: consume whole bytes first, then perform only
; the remaining 0..7 bit operations.  SHA-256 uses constants up to 25, so
; this removes most of the one-bit loop iterations without changing results.

ROTR_ROT_WORD
                STA SHIFT_COUNT

ROTR_ROT_BYTE_CHECK
                LDA SHIFT_COUNT
                CMP #$08
                BCC ROTR_ROT_BIT_CHECK
                SEC
                SBC #$08
                STA SHIFT_COUNT

                LDA ROT_WORD
                PHA
                LDA ROT_WORD+1
                STA ROT_WORD
                LDA ROT_WORD+2
                STA ROT_WORD+1
                LDA ROT_WORD+3
                STA ROT_WORD+2
                PLA
                STA ROT_WORD+3
                JMP ROTR_ROT_BYTE_CHECK

ROTR_ROT_BIT_CHECK
                LDA SHIFT_COUNT
                BEQ ROTR_ROT_DONE

ROTR_ROT_LOOP
                LDA ROT_WORD
                LSR
                ROR ROT_WORD+3
                ROR ROT_WORD+2
                ROR ROT_WORD+1
                ROR ROT_WORD
                DEC SHIFT_COUNT
                BNE ROTR_ROT_LOOP

ROTR_ROT_DONE
                RTS

SHR_ROT_WORD
                STA SHIFT_COUNT

SHR_ROT_BYTE_CHECK
                LDA SHIFT_COUNT
                CMP #$08
                BCC SHR_ROT_BIT_CHECK
                SEC
                SBC #$08
                STA SHIFT_COUNT

                LDA ROT_WORD+1
                STA ROT_WORD
                LDA ROT_WORD+2
                STA ROT_WORD+1
                LDA ROT_WORD+3
                STA ROT_WORD+2
                LDA #$00
                STA ROT_WORD+3
                JMP SHR_ROT_BYTE_CHECK

SHR_ROT_BIT_CHECK
                LDA SHIFT_COUNT
                BEQ SHR_ROT_DONE

SHR_ROT_LOOP
                LSR ROT_WORD+3
                ROR ROT_WORD+2
                ROR ROT_WORD+1
                ROR ROT_WORD
                DEC SHIFT_COUNT
                BNE SHR_ROT_LOOP

SHR_ROT_DONE
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
                .BYTE "XMSS L-TREE / SHA2-256",13
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
                .BYTE "XMSS L-TREE SELF-TEST COMPLETE",13,0

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



TEST_RAND_HASH_TEXT
                .BYTE "XMSS RAND_HASH:",13,0

TEST_LTREE_TEXT
                .BYTE "XMSS L-TREE (3 NODES):",13,0

EXPECTED_RAND_HASH
                .BYTE $31,$A8,$6F,$D0,$64,$94,$3D,$EA,$0D,$29,$60,$43,$FC,$9A,$3F,$19
                .BYTE $4F,$EA,$C3,$81,$04,$BC,$ED,$5F,$B9,$62,$ED,$88,$0D,$38,$97,$BA

EXPECTED_LTREE3
                .BYTE $38,$7F,$07,$0C,$C3,$10,$C1,$AE,$7E,$65,$A3,$A4,$49,$5E,$91,$77
                .BYTE $78,$E0,$84,$75,$A8,$91,$D1,$77,$97,$15,$B8,$1A,$38,$90,$B9,$09

LTREE_TEST_NODES_SOURCE
                .BYTE $00,$01,$02,$03,$04,$05,$06,$07,$08,$09,$0A,$0B,$0C,$0D,$0E,$0F
                .BYTE $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$1A,$1B,$1C,$1D,$1E,$1F
                .BYTE $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$2A,$2B,$2C,$2D,$2E,$2F
                .BYTE $30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$3A,$3B,$3C,$3D,$3E,$3F
                .BYTE $40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$4A,$4B,$4C,$4D,$4E,$4F
                .BYTE $50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$5A,$5B,$5C,$5D,$5E,$5F


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



; XMSS randomized hash and L-tree workspace

XMSS_RAND_LEFT
                .RES 32

XMSS_RAND_RIGHT
                .RES 32

XMSS_RAND_KEY
                .RES 32

XMSS_RAND_RESULT
                .RES 32

XMSS_LTREE_PTR
                .BYTE <WOTS_PUBLIC_KEY,>WOTS_PUBLIC_KEY

XMSS_LTREE_LEN
                .BYTE $00

XMSS_LTREE_HEIGHT
                .BYTE $00

XMSS_LTREE_PAIR_COUNT
                .BYTE $00

XMSS_LTREE_PAIR_INDEX
                .BYTE $00

XMSS_LTREE_LEAF
                .RES 32

LTREE_TEST_NODES
                .RES 96

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

; Fast fixed-size SHA state caches.  These contain SHA-256 internal states
; after the first 64-byte PRF block and are valid only while XMSS_FAST_MODE
; is non-zero.
XMSS_FAST_MODE
                .BYTE $00
XMSS_FAST_PUB_STATE
                .RES 32
XMSS_FAST_MASTER_STATE
                .RES 32
XMSS_FAST_WOTS_STATE
                .RES 32

; =====================================================================
; XMSS TREEHASH, AUTHENTICATION PATH, AND REAL LEAF GENERATION
;
; RFC 8391 Algorithm 9 is implemented by XMSS_TREEHASH. The core uses
; a compact height-tagged stack and supports target heights 0 through 10.
;
; XMSS_TREE_LEAF_MODE:
;   0 = deterministic synthetic leaves for fast diagnostics
;   1 = real XMSS leaves: derive S_ots, WOTS_GEN_PK, then XMSS_LTREE
;
; XMSS_TREE_CAPTURE_AUTH:
;   0 = root only
;   non-zero = capture the authentication path for XMSS_TREE_TARGET
;
; For real XMSS leaves, XMSS_MASTER_SK_SEED is the master secret S from
; RFC 8391 section 4.1.11. XMSS_DERIVE_WOTS_SEED computes
;
;   S_ots[index] = PRF(S, toByte(index,32))
;
; and the existing WOTS+ key generator derives its 67 secret elements
; from this per-leaf S_ots value.
; =====================================================================

TREEHASH_START
                CLD
                JSR SAVE_ENVIRONMENT
                JSR HOME

                LDA #<TREEHASH_TITLE_TEXT
                STA STR_PTR
                LDA #>TREEHASH_TITLE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING

                JSR INIT_TREEHASH_TEST_DATA
                JSR TEST_XMSS_DERIVE_WOTS_SEED
                JSR TEST_XMSS_TREEHASH_SMALL
                JSR TEST_XMSS_AUTH_PATH
                JSR TEST_XMSS_ROOT_FROM_AUTH

                LDA #<TREEHASH_DONE_TEXT
                STA STR_PTR
                LDA #>TREEHASH_DONE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JMP EXIT_PROGRAM

; ---------------------------------------------------------------------
; Convert the current 16-bit leaf index to big-endian 00 00 HI LO.
; ---------------------------------------------------------------------

XMSS_VALUE32_SET_LEAF_INDEX
                LDA #$00
                STA XMSS_VALUE32
                STA XMSS_VALUE32+1
                LDA XMSS_TREE_LEAF_INDEX_HI
                STA XMSS_VALUE32+2
                LDA XMSS_TREE_LEAF_INDEX_LO
                STA XMSS_VALUE32+3
                RTS

XMSS_VALUE32_SET_NODE_INDEX
                LDA #$00
                STA XMSS_VALUE32
                STA XMSS_VALUE32+1
                LDA XMSS_TREE_NODE_INDEX_HI
                STA XMSS_VALUE32+2
                LDA XMSS_TREE_NODE_INDEX_LO
                STA XMSS_VALUE32+3
                RTS

; ---------------------------------------------------------------------
; Derive the WOTS+ seed for the current XMSS leaf.
;
; Input:
;   XMSS_MASTER_SK_SEED       32 bytes
;   XMSS_TREE_LEAF_INDEX      16-bit, little-endian variables
;
; Output:
;   WOTS_SK_SEED              32-byte S_ots value
; ---------------------------------------------------------------------

XMSS_DERIVE_WOTS_SEED
                CLD
                LDA XMSS_FAST_MODE
                BEQ XMSS_DERIVE_WOTS_SEED_SLOW

                JSR XMSS_PRF_MASTER_LEAF_FAST
                JMP XMSS_DERIVE_WOTS_SEED_COPY_FAST

XMSS_DERIVE_WOTS_SEED_SLOW
                LDX #$00

XMSS_DERIVE_COPY_MASTER_LOOP
                LDA XMSS_MASTER_SK_SEED,X
                STA XMSS_KEY,X
                LDA #$00
                STA XMSS_M32,X
                INX
                CPX #32
                BNE XMSS_DERIVE_COPY_MASTER_LOOP

                LDA XMSS_TREE_LEAF_INDEX_HI
                STA XMSS_M32+30
                LDA XMSS_TREE_LEAF_INDEX_LO
                STA XMSS_M32+31

                JSR XMSS_PRF

XMSS_DERIVE_WOTS_SEED_COPY_FAST
                LDX #$00

XMSS_DERIVE_COPY_RESULT_LOOP
                LDA XMSS_RESULT,X
                STA WOTS_SK_SEED,X
                INX
                CPX #32
                BNE XMSS_DERIVE_COPY_RESULT_LOOP

                LDA XMSS_FAST_MODE
                BEQ XMSS_DERIVE_WOTS_SEED_DONE
                JSR XMSS_FAST_PRECOMPUTE_WOTS_STATE

XMSS_DERIVE_WOTS_SEED_DONE
                CLC
                RTS

; ---------------------------------------------------------------------
; Generate one real XMSS leaf at XMSS_TREE_LEAF_INDEX.
;
; This is deliberately a slow reference implementation:
;   derive S_ots -> WOTS_GEN_PK -> L-tree -> 32-byte leaf.
;
; Output:
;   XMSS_TREE_NODE             32-byte leaf
;   carry clear                success
;   carry set                  WOTS/L-tree failure
; ---------------------------------------------------------------------

XMSS_GEN_LEAF
                JSR XMSS_DERIVE_WOTS_SEED
                JSR WOTS_USE_INTERNAL_BUFFERS

                LDA #$00
                JSR XMSS_ADRS_SET_TYPE
                JSR XMSS_VALUE32_SET_LEAF_INDEX
                JSR XMSS_ADRS_SET_OTS

                JSR WOTS_GEN_PK
                BCC XMSS_GEN_LEAF_WOTS_OK
                SEC
                RTS

XMSS_GEN_LEAF_WOTS_OK
                LDA #$01
                JSR XMSS_ADRS_SET_TYPE
                JSR XMSS_VALUE32_SET_LEAF_INDEX
                JSR XMSS_ADRS_SET_LTREE

                JSR XMSS_LTREE
                BCC XMSS_GEN_LEAF_LTREE_OK
                SEC
                RTS

XMSS_GEN_LEAF_LTREE_OK
                LDX #$00

XMSS_GEN_LEAF_COPY_LOOP
                LDA XMSS_LTREE_LEAF,X
                STA XMSS_TREE_NODE,X
                INX
                CPX #32
                BNE XMSS_GEN_LEAF_COPY_LOOP
                CLC
                RTS

; ---------------------------------------------------------------------
; Deterministic diagnostic leaf generator.
;
; For leaf index j, byte i is (j*32+i) modulo 256. This is not an XMSS
; cryptographic leaf and is used only to test TreeHash control flow.
; ---------------------------------------------------------------------

XMSS_GEN_SYNTHETIC_LEAF
                LDA XMSS_TREE_LEAF_INDEX_LO
                STA XMSS_TREE_TEMP_LO
                LDA #$00
                STA XMSS_TREE_TEMP_HI

                ASL XMSS_TREE_TEMP_LO
                ROL XMSS_TREE_TEMP_HI
                ASL XMSS_TREE_TEMP_LO
                ROL XMSS_TREE_TEMP_HI
                ASL XMSS_TREE_TEMP_LO
                ROL XMSS_TREE_TEMP_HI
                ASL XMSS_TREE_TEMP_LO
                ROL XMSS_TREE_TEMP_HI
                ASL XMSS_TREE_TEMP_LO
                ROL XMSS_TREE_TEMP_HI

                LDX #$00

XMSS_GEN_SYNTHETIC_LOOP
                TXA
                CLC
                ADC XMSS_TREE_TEMP_LO
                STA XMSS_TREE_NODE,X
                INX
                CPX #32
                BNE XMSS_GEN_SYNTHETIC_LOOP
                CLC
                RTS

XMSS_GENERATE_SELECTED_LEAF
                LDA XMSS_TREE_LEAF_MODE
                BEQ XMSS_GENERATE_SYNTHETIC
                JMP XMSS_GEN_LEAF

XMSS_GENERATE_SYNTHETIC
                JMP XMSS_GEN_SYNTHETIC_LEAF

; ---------------------------------------------------------------------
; TreeHash stack pointer helpers. A contains stack entry number 0..10.
; ---------------------------------------------------------------------

XMSS_STACK_CALC_PTR
                STA XMSS_TREE_PTR_TEMP
                LDA #$00
                STA XMSS_TREE_PTR_TEMP+1
                LDX #$05

XMSS_STACK_SHIFT_LOOP
                ASL XMSS_TREE_PTR_TEMP
                ROL XMSS_TREE_PTR_TEMP+1
                DEX
                BNE XMSS_STACK_SHIFT_LOOP

                CLC
                LDA XMSS_TREE_PTR_TEMP
                ADC #<XMSS_TREE_STACK_NODES
                STA XMSS_TREE_PTR_TEMP
                LDA XMSS_TREE_PTR_TEMP+1
                ADC #>XMSS_TREE_STACK_NODES
                STA XMSS_TREE_PTR_TEMP+1
                RTS

XMSS_STACK_SET_SOURCE
                JSR XMSS_STACK_CALC_PTR
                LDA XMSS_TREE_PTR_TEMP
                STA WOTS_SRC_PTR
                LDA XMSS_TREE_PTR_TEMP+1
                STA WOTS_SRC_PTR+1
                RTS

XMSS_STACK_SET_DEST
                JSR XMSS_STACK_CALC_PTR
                LDA XMSS_TREE_PTR_TEMP
                STA WOTS_DST_PTR
                LDA XMSS_TREE_PTR_TEMP+1
                STA WOTS_DST_PTR+1
                RTS

XMSS_STACK_PUSH_NODE
                LDA XMSS_TREE_STACK_TOP
                JSR XMSS_STACK_SET_DEST
                LDY #$00

XMSS_STACK_PUSH_COPY_LOOP
                LDA XMSS_TREE_NODE,Y
                STA (WOTS_DST_PTR),Y
                INY
                CPY #32
                BNE XMSS_STACK_PUSH_COPY_LOOP

                LDX XMSS_TREE_STACK_TOP
                LDA XMSS_TREE_NODE_HEIGHT
                STA XMSS_TREE_STACK_HEIGHTS,X
                INC XMSS_TREE_STACK_TOP
                CLC
                RTS

XMSS_STACK_POP_LEFT
                LDA XMSS_TREE_STACK_TOP
                BEQ XMSS_STACK_POP_FAIL
                DEC XMSS_TREE_STACK_TOP
                LDA XMSS_TREE_STACK_TOP
                JSR XMSS_STACK_SET_SOURCE
                LDY #$00

XMSS_STACK_POP_COPY_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_RAND_LEFT,Y
                INY
                CPY #32
                BNE XMSS_STACK_POP_COPY_LOOP
                CLC
                RTS

XMSS_STACK_POP_FAIL
                SEC
                RTS

XMSS_COPY_NODE_TO_RIGHT
                LDX #$00

XMSS_COPY_NODE_TO_RIGHT_LOOP
                LDA XMSS_TREE_NODE,X
                STA XMSS_RAND_RIGHT,X
                INX
                CPX #32
                BNE XMSS_COPY_NODE_TO_RIGHT_LOOP
                RTS

XMSS_COPY_RAND_TO_NODE
                LDX #$00

XMSS_COPY_RAND_TO_NODE_LOOP
                LDA XMSS_RAND_RESULT,X
                STA XMSS_TREE_NODE,X
                INX
                CPX #32
                BNE XMSS_COPY_RAND_TO_NODE_LOOP
                RTS

; ---------------------------------------------------------------------
; Authentication-path pointer helper. A contains level 0..9.
; ---------------------------------------------------------------------

XMSS_AUTH_CALC_PTR
                STA XMSS_TREE_PTR_TEMP
                LDA #$00
                STA XMSS_TREE_PTR_TEMP+1
                LDX #$05

XMSS_AUTH_SHIFT_LOOP
                ASL XMSS_TREE_PTR_TEMP
                ROL XMSS_TREE_PTR_TEMP+1
                DEX
                BNE XMSS_AUTH_SHIFT_LOOP

                CLC
                LDA XMSS_TREE_PTR_TEMP
                ADC #<XMSS_AUTH_PATH
                STA XMSS_TREE_PTR_TEMP
                LDA XMSS_TREE_PTR_TEMP+1
                ADC #>XMSS_AUTH_PATH
                STA XMSS_TREE_PTR_TEMP+1
                RTS

XMSS_AUTH_SET_SOURCE
                JSR XMSS_AUTH_CALC_PTR
                LDA XMSS_TREE_PTR_TEMP
                STA WOTS_SRC_PTR
                LDA XMSS_TREE_PTR_TEMP+1
                STA WOTS_SRC_PTR+1
                RTS

XMSS_AUTH_SET_DEST
                JSR XMSS_AUTH_CALC_PTR
                LDA XMSS_TREE_PTR_TEMP
                STA WOTS_DST_PTR
                LDA XMSS_TREE_PTR_TEMP+1
                STA WOTS_DST_PTR+1
                RTS

; Capture XMSS_TREE_NODE when it is the sibling required at its height.

XMSS_TREE_CAPTURE_NODE
                LDA XMSS_TREE_CAPTURE_AUTH
                BNE XMSS_CAPTURE_ENABLED
                RTS

XMSS_CAPTURE_ENABLED
                LDA XMSS_TREE_NODE_HEIGHT
                CMP XMSS_TREE_HEIGHT_TARGET
                BCC XMSS_CAPTURE_HEIGHT_OK
                RTS

XMSS_CAPTURE_HEIGHT_OK
                LDA XMSS_TREE_TARGET_LO
                STA XMSS_TREE_TEMP_LO
                LDA XMSS_TREE_TARGET_HI
                STA XMSS_TREE_TEMP_HI
                LDX XMSS_TREE_NODE_HEIGHT

XMSS_CAPTURE_SHIFT_TARGET_LOOP
                CPX #$00
                BEQ XMSS_CAPTURE_TARGET_SHIFTED
                LSR XMSS_TREE_TEMP_HI
                ROR XMSS_TREE_TEMP_LO
                DEX
                JMP XMSS_CAPTURE_SHIFT_TARGET_LOOP

XMSS_CAPTURE_TARGET_SHIFTED
                LDA XMSS_TREE_TEMP_LO
                EOR #$01
                STA XMSS_TREE_TEMP_LO

                LDA XMSS_TREE_NODE_INDEX_HI
                CMP XMSS_TREE_TEMP_HI
                BNE XMSS_CAPTURE_NOT_MATCH
                LDA XMSS_TREE_NODE_INDEX_LO
                CMP XMSS_TREE_TEMP_LO
                BNE XMSS_CAPTURE_NOT_MATCH

                LDA XMSS_TREE_NODE_HEIGHT
                JSR XMSS_AUTH_SET_DEST
                LDY #$00

XMSS_CAPTURE_COPY_LOOP
                LDA XMSS_TREE_NODE,Y
                STA (WOTS_DST_PTR),Y
                INY
                CPY #32
                BNE XMSS_CAPTURE_COPY_LOOP

XMSS_CAPTURE_NOT_MATCH
                RTS

; ---------------------------------------------------------------------
; Validate start alignment and optional authentication target range.
; ---------------------------------------------------------------------

XMSS_TREE_VALIDATE
                LDA XMSS_TREE_HEIGHT_TARGET
                CMP #11
                BCC XMSS_TREE_HEIGHT_VALID
                SEC
                RTS

XMSS_TREE_HEIGHT_VALID
                LDA XMSS_TREE_START_LO
                STA XMSS_TREE_TEMP_LO
                LDA XMSS_TREE_START_HI
                STA XMSS_TREE_TEMP_HI
                LDX XMSS_TREE_HEIGHT_TARGET

XMSS_TREE_ALIGN_LOOP
                CPX #$00
                BEQ XMSS_TREE_ALIGNMENT_OK
                LDA XMSS_TREE_TEMP_LO
                AND #$01
                BNE XMSS_TREE_VALIDATE_FAIL
                LSR XMSS_TREE_TEMP_HI
                ROR XMSS_TREE_TEMP_LO
                DEX
                JMP XMSS_TREE_ALIGN_LOOP

XMSS_TREE_ALIGNMENT_OK
                LDA #$01
                STA XMSS_TREE_LEAF_COUNT_LO
                LDA #$00
                STA XMSS_TREE_LEAF_COUNT_HI
                LDX XMSS_TREE_HEIGHT_TARGET

XMSS_TREE_COUNT_LOOP
                CPX #$00
                BEQ XMSS_TREE_COUNT_READY
                ASL XMSS_TREE_LEAF_COUNT_LO
                ROL XMSS_TREE_LEAF_COUNT_HI
                DEX
                JMP XMSS_TREE_COUNT_LOOP

XMSS_TREE_COUNT_READY
                LDA XMSS_TREE_CAPTURE_AUTH
                BNE XMSS_TREE_VALIDATE_TARGET
                CLC
                RTS

XMSS_TREE_VALIDATE_TARGET
                LDA XMSS_TREE_TARGET_HI
                CMP XMSS_TREE_START_HI
                BCC XMSS_TREE_VALIDATE_FAIL
                BNE XMSS_TREE_TARGET_ABOVE_START
                LDA XMSS_TREE_TARGET_LO
                CMP XMSS_TREE_START_LO
                BCC XMSS_TREE_VALIDATE_FAIL

XMSS_TREE_TARGET_ABOVE_START
                CLC
                LDA XMSS_TREE_START_LO
                ADC XMSS_TREE_LEAF_COUNT_LO
                STA XMSS_TREE_END_LO
                LDA XMSS_TREE_START_HI
                ADC XMSS_TREE_LEAF_COUNT_HI
                STA XMSS_TREE_END_HI

                LDA XMSS_TREE_TARGET_HI
                CMP XMSS_TREE_END_HI
                BCC XMSS_TREE_TARGET_IN_RANGE
                BNE XMSS_TREE_VALIDATE_FAIL
                LDA XMSS_TREE_TARGET_LO
                CMP XMSS_TREE_END_LO
                BCC XMSS_TREE_TARGET_IN_RANGE

XMSS_TREE_VALIDATE_FAIL
                SEC
                RTS

XMSS_TREE_TARGET_IN_RANGE
                CLC
                RTS

; ---------------------------------------------------------------------
; RFC 8391 Algorithm 9, target heights 0..10.
;
; Inputs:
;   XMSS_TREE_START             16-bit start leaf
;   XMSS_TREE_HEIGHT_TARGET     target node height
;   XMSS_TREE_LEAF_MODE         synthetic or real
;   XMSS_TREE_CAPTURE_AUTH      capture flag
;   XMSS_TREE_TARGET            target leaf for auth path
;
; Output:
;   XMSS_TREE_ROOT              32-byte root
;   XMSS_AUTH_PATH              up to 10 nodes when capture enabled
;   carry clear                 success
;   carry set                   invalid parameters or leaf failure
; ---------------------------------------------------------------------

XMSS_TREEHASH
                CLD
                JSR XMSS_TREE_VALIDATE
                BCC XMSS_TREEHASH_VALID
                SEC
                RTS

XMSS_TREEHASH_VALID
                LDA #$00
                STA XMSS_TREE_STACK_TOP
                STA XMSS_TREE_OFFSET_LO
                STA XMSS_TREE_OFFSET_HI

XMSS_TREEHASH_LEAF_LOOP
                LDA XMSS_TREE_OFFSET_HI
                CMP XMSS_TREE_LEAF_COUNT_HI
                BNE XMSS_TREEHASH_HAVE_LEAF
                LDA XMSS_TREE_OFFSET_LO
                CMP XMSS_TREE_LEAF_COUNT_LO
                BNE XMSS_TREEHASH_HAVE_LEAF
                JMP XMSS_TREEHASH_FINISH

XMSS_TREEHASH_HAVE_LEAF
                CLC
                LDA XMSS_TREE_START_LO
                ADC XMSS_TREE_OFFSET_LO
                STA XMSS_TREE_LEAF_INDEX_LO
                LDA XMSS_TREE_START_HI
                ADC XMSS_TREE_OFFSET_HI
                STA XMSS_TREE_LEAF_INDEX_HI

                JSR XMSS_GENERATE_SELECTED_LEAF
                BCC XMSS_TREEHASH_LEAF_OK
                SEC
                RTS

XMSS_TREEHASH_LEAF_OK
                LDA #$00
                STA XMSS_TREE_NODE_HEIGHT
                LDA XMSS_TREE_LEAF_INDEX_LO
                STA XMSS_TREE_NODE_INDEX_LO
                LDA XMSS_TREE_LEAF_INDEX_HI
                STA XMSS_TREE_NODE_INDEX_HI
                JSR XMSS_TREE_CAPTURE_NODE

XMSS_TREEHASH_COMBINE_LOOP
                LDA XMSS_TREE_STACK_TOP
                BEQ XMSS_TREEHASH_PUSH

                TAX
                DEX
                LDA XMSS_TREE_STACK_HEIGHTS,X
                CMP XMSS_TREE_NODE_HEIGHT
                BNE XMSS_TREEHASH_PUSH

                JSR XMSS_STACK_POP_LEFT
                BCC XMSS_TREEHASH_LEFT_READY
                SEC
                RTS

XMSS_TREEHASH_LEFT_READY
                JSR XMSS_COPY_NODE_TO_RIGHT

                LDA #$02
                JSR XMSS_ADRS_SET_TYPE

                LDA XMSS_TREE_NODE_HEIGHT
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_HEIGHT

                LSR XMSS_TREE_NODE_INDEX_HI
                ROR XMSS_TREE_NODE_INDEX_LO
                JSR XMSS_VALUE32_SET_NODE_INDEX
                JSR XMSS_ADRS_SET_TREE_INDEX

                JSR XMSS_RAND_HASH
                JSR XMSS_COPY_RAND_TO_NODE
                INC XMSS_TREE_NODE_HEIGHT
                JSR XMSS_TREE_CAPTURE_NODE
                JMP XMSS_TREEHASH_COMBINE_LOOP

XMSS_TREEHASH_PUSH
                JSR XMSS_STACK_PUSH_NODE

                INC XMSS_TREE_OFFSET_LO
                BNE XMSS_TREEHASH_OFFSET_READY
                INC XMSS_TREE_OFFSET_HI

XMSS_TREEHASH_OFFSET_READY
                JSR XMSS_TREEHASH_UPDATE_PROGRESS
                JMP XMSS_TREEHASH_LEAF_LOOP

; Export height-10 real-tree progress as a generic byte.  A full run has
; 1024 leaves, so every four completed leaves advance the 0..255 cell by
; one.  Saturation avoids wrapping $FF to $00 on the final $0400 offset.

XMSS_TREEHASH_UPDATE_PROGRESS
                LDA XMSS_TREE_HEIGHT_TARGET
                CMP #10
                BNE XMSS_TREEHASH_PROGRESS_DONE

                LDA XMSS_TREE_LEAF_MODE
                BEQ XMSS_TREEHASH_PROGRESS_DONE

                LDA XMSS_TREE_OFFSET_LO
                AND #$03
                BNE XMSS_TREEHASH_PROGRESS_DONE

                LDA XMSS_WASM_PROGRESS
                CMP #$FF
                BEQ XMSS_TREEHASH_PROGRESS_DONE
                INC XMSS_WASM_PROGRESS

XMSS_TREEHASH_PROGRESS_DONE
                RTS

XMSS_TREEHASH_FINISH
                LDA XMSS_TREE_STACK_TOP
                CMP #$01
                BEQ XMSS_TREEHASH_ONE_ROOT
                SEC
                RTS

XMSS_TREEHASH_ONE_ROOT
                LDA XMSS_TREE_STACK_HEIGHTS
                CMP XMSS_TREE_HEIGHT_TARGET
                BEQ XMSS_TREEHASH_ROOT_HEIGHT_OK
                SEC
                RTS

XMSS_TREEHASH_ROOT_HEIGHT_OK
                LDA #$00
                JSR XMSS_STACK_SET_SOURCE
                LDY #$00

XMSS_TREEHASH_COPY_ROOT_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_TREE_ROOT,Y
                INY
                CPY #32
                BNE XMSS_TREEHASH_COPY_ROOT_LOOP
                CLC
                RTS

; ---------------------------------------------------------------------
; Recompute a root from a leaf and authentication path (RFC Algorithm 13
; tree portion). WOTS public-key recovery and L-tree compression are
; intentionally separate and feed XMSS_AUTH_LEAF.
; ---------------------------------------------------------------------

XMSS_COMPUTE_ROOT_FROM_AUTH
                CLD
                LDX #$00

XMSS_AUTH_COPY_LEAF_LOOP
                LDA XMSS_AUTH_LEAF,X
                STA XMSS_TREE_NODE,X
                INX
                CPX #32
                BNE XMSS_AUTH_COPY_LEAF_LOOP

                LDA XMSS_TREE_TARGET_LO
                STA XMSS_TREE_NODE_INDEX_LO
                LDA XMSS_TREE_TARGET_HI
                STA XMSS_TREE_NODE_INDEX_HI
                LDA #$00
                STA XMSS_AUTH_LEVEL

XMSS_AUTH_ROOT_LOOP
                LDA XMSS_AUTH_LEVEL
                CMP XMSS_TREE_HEIGHT_TARGET
                BEQ XMSS_AUTH_ROOT_DONE

                LDA #$02
                JSR XMSS_ADRS_SET_TYPE

                LDA XMSS_AUTH_LEVEL
                JSR XMSS_VALUE32_SET_A
                JSR XMSS_ADRS_SET_TREE_HEIGHT

                LSR XMSS_TREE_NODE_INDEX_HI
                ROR XMSS_TREE_NODE_INDEX_LO
                JSR XMSS_VALUE32_SET_NODE_INDEX
                JSR XMSS_ADRS_SET_TREE_INDEX

                LDA XMSS_AUTH_LEVEL
                JSR XMSS_AUTH_SET_SOURCE

                LDA XMSS_TREE_TARGET_LO
                STA XMSS_TREE_TEMP_LO
                LDA XMSS_TREE_TARGET_HI
                STA XMSS_TREE_TEMP_HI
                LDX XMSS_AUTH_LEVEL

XMSS_AUTH_PARITY_SHIFT_LOOP
                CPX #$00
                BEQ XMSS_AUTH_PARITY_READY
                LSR XMSS_TREE_TEMP_HI
                ROR XMSS_TREE_TEMP_LO
                DEX
                JMP XMSS_AUTH_PARITY_SHIFT_LOOP

XMSS_AUTH_PARITY_READY
                LDA XMSS_TREE_TEMP_LO
                AND #$01
                BEQ XMSS_AUTH_NODE_IS_LEFT

; Target node is right: authentication node is left.
                LDY #$00

XMSS_AUTH_LOAD_LEFT_LOOP
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_RAND_LEFT,Y
                LDA XMSS_TREE_NODE,Y
                STA XMSS_RAND_RIGHT,Y
                INY
                CPY #32
                BNE XMSS_AUTH_LOAD_LEFT_LOOP
                JMP XMSS_AUTH_HASH_PAIR

; Target node is left: authentication node is right.
XMSS_AUTH_NODE_IS_LEFT
                LDY #$00

XMSS_AUTH_LOAD_RIGHT_LOOP
                LDA XMSS_TREE_NODE,Y
                STA XMSS_RAND_LEFT,Y
                LDA (WOTS_SRC_PTR),Y
                STA XMSS_RAND_RIGHT,Y
                INY
                CPY #32
                BNE XMSS_AUTH_LOAD_RIGHT_LOOP

XMSS_AUTH_HASH_PAIR
                JSR XMSS_RAND_HASH
                JSR XMSS_COPY_RAND_TO_NODE
                INC XMSS_AUTH_LEVEL
                JMP XMSS_AUTH_ROOT_LOOP

XMSS_AUTH_ROOT_DONE
                LDX #$00

XMSS_AUTH_COPY_ROOT_LOOP
                LDA XMSS_TREE_NODE,X
                STA XMSS_TREE_ROOT,X
                INX
                CPX #32
                BNE XMSS_AUTH_COPY_ROOT_LOOP
                CLC
                RTS

; =====================================================================
; TREEHASH SELF-TESTS
; =====================================================================

INIT_TREEHASH_TEST_DATA
                LDX #$00

INIT_TREEHASH_SEED_LOOP
                TXA
                CLC
                ADC #$40
                STA WOTS_PUB_SEED,X
                TXA
                CLC
                ADC #$80
                STA XMSS_MASTER_SK_SEED,X
                TXA
                CLC
                ADC #$A0
                STA XMSS_SK_PRF,X
                INX
                CPX #32
                BNE INIT_TREEHASH_SEED_LOOP

                JSR XMSS_ADRS_CLEAR
                RTS

TEST_XMSS_DERIVE_WOTS_SEED
                LDA #$05
                STA XMSS_TREE_LEAF_INDEX_LO
                LDA #$00
                STA XMSS_TREE_LEAF_INDEX_HI
                JSR XMSS_DERIVE_WOTS_SEED

                LDX #$00

TEST_DERIVE_COPY_RESULT_LOOP
                LDA WOTS_SK_SEED,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE TEST_DERIVE_COPY_RESULT_LOOP

                LDA #<TEST_DERIVE_TEXT
                STA STR_PTR
                LDA #>TEST_DERIVE_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT

                LDA #<EXPECTED_WOTS_SEED_5
                STA STR_PTR
                LDA #>EXPECTED_WOTS_SEED_5
                STA STR_PTR+1
                JSR COMPARE_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_TREEHASH_SMALL
                LDA #$00
                STA XMSS_TREE_START_LO
                STA XMSS_TREE_START_HI
                STA XMSS_TREE_LEAF_MODE
                LDA #$03
                STA XMSS_TREE_HEIGHT_TARGET
                LDA #$01
                STA XMSS_TREE_CAPTURE_AUTH
                LDA #$05
                STA XMSS_TREE_TARGET_LO
                LDA #$00
                STA XMSS_TREE_TARGET_HI

                JSR XMSS_ADRS_CLEAR
                JSR XMSS_TREEHASH
                BCC TEST_TREEHASH_COPY_RESULT
                LDA #$00
                STA TEST_STATUS
                JMP TEST_TREEHASH_PRINT_STATUS

TEST_TREEHASH_COPY_RESULT
                LDX #$00

TEST_TREEHASH_COPY_RESULT_LOOP
                LDA XMSS_TREE_ROOT,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE TEST_TREEHASH_COPY_RESULT_LOOP

                LDA #<EXPECTED_TREEHASH_ROOT
                STA STR_PTR
                LDA #>EXPECTED_TREEHASH_ROOT
                STA STR_PTR+1
                JSR COMPARE_RESULT

TEST_TREEHASH_PRINT_STATUS
                LDA #<TEST_TREEHASH_TEXT
                STA STR_PTR
                LDA #>TEST_TREEHASH_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT
                JSR PRINT_STATUS
                RTS

TEST_XMSS_AUTH_PATH
                LDX #$00

TEST_AUTH_COMPARE_LOOP
                LDA XMSS_AUTH_PATH,X
                CMP EXPECTED_AUTH_PATH,X
                BNE TEST_AUTH_COMPARE_FAIL
                INX
                CPX #96
                BNE TEST_AUTH_COMPARE_LOOP
                LDA #$01
                STA TEST_STATUS
                JMP TEST_AUTH_PRINT_STATUS

TEST_AUTH_COMPARE_FAIL
                LDA #$00
                STA TEST_STATUS

TEST_AUTH_PRINT_STATUS
                LDA #<TEST_AUTH_TEXT
                STA STR_PTR
                LDA #>TEST_AUTH_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_STATUS
                RTS

TEST_XMSS_ROOT_FROM_AUTH
                LDA #$05
                STA XMSS_TREE_LEAF_INDEX_LO
                LDA #$00
                STA XMSS_TREE_LEAF_INDEX_HI
                JSR XMSS_GEN_SYNTHETIC_LEAF

                LDX #$00

TEST_AUTH_LEAF_COPY_LOOP
                LDA XMSS_TREE_NODE,X
                STA XMSS_AUTH_LEAF,X
                INX
                CPX #32
                BNE TEST_AUTH_LEAF_COPY_LOOP

                JSR XMSS_ADRS_CLEAR
                JSR XMSS_COMPUTE_ROOT_FROM_AUTH

                LDX #$00

TEST_AUTH_ROOT_COPY_LOOP
                LDA XMSS_TREE_ROOT,X
                STA XMSS_RESULT,X
                INX
                CPX #32
                BNE TEST_AUTH_ROOT_COPY_LOOP

                LDA #<EXPECTED_TREEHASH_ROOT
                STA STR_PTR
                LDA #>EXPECTED_TREEHASH_ROOT
                STA STR_PTR+1
                JSR COMPARE_RESULT

                LDA #<TEST_ROOT_AUTH_TEXT
                STA STR_PTR
                LDA #>TEST_ROOT_AUTH_TEXT
                STA STR_PTR+1
                JSR PRINT_STRING
                JSR PRINT_RESULT
                JSR PRINT_STATUS
                RTS


; =====================================================================
; HEIGHT-10 / 1024-LEAF DEVELOPMENT VECTORS
; =====================================================================

TREEHASH1024_TITLE_TEXT
                .BYTE "XMSS TREEHASH 1024 / SHA2-256",13
                .BYTE "1024 REAL WOTS+/L-TREE LEAVES",13
                .BYTE "DEVELOPMENT SEEDS - NOT FOR SIGNING",13
                .BYTE "WASM STOP/ESCAPE: $4003",13
                .BYTE "WASM PROGRESS BYTE: $7FFF",13,13,0

TREEHASH1024_BEGIN_TEXT
                .BYTE "BUILDING HEIGHT-10 TREE...",13
                .BYTE "ENGAGE WASM ACCELERATOR NOW",13,0

TREEHASH1024_ROOT_TEXT
                .BYTE 13,"HEIGHT-10 ROOT:",13,0

TREEHASH1024_AUTH_CHECK_TEXT
                .BYTE "AUTH PATH FOR LEAF 0000: ",0

TREEHASH1024_AUTH_TEXT
                .BYTE 13,"AUTHENTICATION PATH (10 NODES):",13,0

TREEHASH1024_FAIL_TEXT
                .BYTE 13,"TREEHASH1024 FAILED",13,0

TREEHASH1024_DONE_TEXT
                .BYTE 13,"1024-LEAF TREE COMPLETE",13
                .BYTE "ROOT + AUTH PATH VALIDATED",13,0

EXPECTED_TREEHASH1024_ROOT
                .BYTE $DF,$BD,$CA,$EF,$D5,$C3,$7F,$A3,$63,$D2,$74,$E3,$69,$12,$1F,$E9
                .BYTE $52,$82,$2D,$80,$72,$DD,$AD,$7A,$D6,$A3,$6B,$63,$9A,$96,$DA,$87

EXPECTED_TREEHASH1024_AUTH
                .BYTE $67,$C8,$B3,$2B,$01,$02,$57,$23,$1C,$1D,$CE,$19,$06,$57,$67,$4C
                .BYTE $67,$EF,$6F,$45,$86,$98,$B3,$0E,$2B,$7C,$DC,$E8,$80,$90,$2B,$7C
                .BYTE $A3,$77,$92,$62,$A9,$65,$E3,$70,$3B,$7F,$E3,$C6,$2F,$D8,$84,$97
                .BYTE $43,$4B,$26,$8A,$53,$B9,$BF,$A6,$C3,$03,$B9,$7D,$96,$96,$44,$C1
                .BYTE $02,$3C,$0C,$C5,$43,$B6,$68,$BF,$32,$E6,$0C,$93,$43,$85,$06,$52
                .BYTE $5F,$D6,$4A,$00,$6F,$4A,$37,$8A,$9A,$91,$94,$15,$00,$59,$B6,$8A
                .BYTE $93,$83,$3F,$EC,$32,$37,$91,$25,$EC,$27,$61,$EE,$C0,$5B,$0B,$1F
                .BYTE $4F,$C2,$DD,$72,$5C,$CE,$02,$1E,$0F,$00,$9B,$26,$63,$4B,$48,$AD
                .BYTE $3F,$16,$8A,$C6,$1C,$7F,$16,$E9,$BE,$38,$14,$86,$E4,$71,$56,$D5
                .BYTE $59,$FD,$4B,$90,$96,$29,$48,$C3,$53,$17,$81,$BF,$AF,$7C,$0A,$94
                .BYTE $BC,$FF,$63,$47,$C4,$EC,$9F,$F5,$71,$BE,$AD,$B1,$E7,$5C,$87,$EC
                .BYTE $78,$B1,$20,$5F,$F7,$F3,$38,$7A,$E3,$28,$84,$AF,$25,$F6,$DE,$1A
                .BYTE $3E,$6D,$62,$CF,$0D,$28,$CE,$69,$44,$8C,$58,$75,$7D,$2C,$EF,$2E
                .BYTE $F0,$D8,$A9,$5A,$9C,$D4,$A1,$2E,$B8,$14,$6A,$D6,$49,$1C,$06,$E3
                .BYTE $6A,$4B,$24,$D3,$A8,$A1,$93,$CB,$AF,$71,$5F,$36,$A8,$6F,$4D,$23
                .BYTE $99,$91,$2F,$24,$A9,$38,$2A,$D9,$A7,$98,$C7,$74,$70,$9C,$26,$6D
                .BYTE $91,$A6,$43,$69,$56,$1E,$DB,$AD,$2E,$BF,$BD,$EB,$88,$DF,$F3,$CB
                .BYTE $D4,$1E,$97,$A8,$7B,$8F,$E1,$20,$BD,$34,$52,$70,$07,$69,$8E,$39
                .BYTE $EC,$C0,$12,$DF,$74,$B1,$C6,$DB,$0F,$27,$9D,$08,$03,$F7,$88,$EC
                .BYTE $52,$6F,$3E,$3E,$2D,$B7,$55,$9F,$51,$7B,$DD,$9A,$03,$4D,$21,$5E

; =====================================================================
; TREEHASH TEXT AND EXPECTED DEVELOPMENT VECTORS
; =====================================================================

TREEHASH_TITLE_TEXT
                .BYTE "XMSS TREEHASH / SHA2-256",13
                .BYTE "RFC 8391 / APPLE II+",13,13,0

TEST_DERIVE_TEXT
                .BYTE "WOTS SEED FOR LEAF 5:",13,0

TEST_TREEHASH_TEXT
                .BYTE "TREEHASH HEIGHT 3 ROOT:",13,0

TEST_AUTH_TEXT
                .BYTE "AUTH PATH FOR LEAF 5: ",0

TEST_ROOT_AUTH_TEXT
                .BYTE "ROOT FROM AUTH PATH:",13,0

TREEHASH_DONE_TEXT
                .BYTE 13,"XMSS TREEHASH SELF-TEST COMPLETE",13,0

EXPECTED_WOTS_SEED_5
                .BYTE $E7,$9D,$79,$A3,$1D,$A3,$38,$39
                .BYTE $EE,$6A,$BF,$37,$D6,$26,$0F,$A9
                .BYTE $2A,$A8,$97,$87,$78,$A1,$C4,$9E
                .BYTE $D0,$E6,$37,$6A,$90,$E4,$1C,$93

EXPECTED_TREEHASH_ROOT
                .BYTE $D4,$FB,$8A,$EA,$7C,$10,$0E,$6A
                .BYTE $5A,$F4,$9B,$15,$5C,$14,$28,$5C
                .BYTE $AD,$35,$FF,$6E,$D2,$CF,$E9,$94
                .BYTE $EA,$54,$E1,$12,$B3,$FE,$4F,$50

EXPECTED_AUTH_PATH
                .BYTE $80,$81,$82,$83,$84,$85,$86,$87
                .BYTE $88,$89,$8A,$8B,$8C,$8D,$8E,$8F
                .BYTE $90,$91,$92,$93,$94,$95,$96,$97
                .BYTE $98,$99,$9A,$9B,$9C,$9D,$9E,$9F
                .BYTE $5E,$33,$37,$EA,$3C,$88,$9A,$C1
                .BYTE $EC,$46,$6C,$4E,$1F,$95,$85,$F8
                .BYTE $73,$1D,$0B,$99,$11,$43,$D0,$0F
                .BYTE $DA,$C5,$CB,$4A,$4A,$DB,$F0,$D8
                .BYTE $01,$19,$14,$23,$15,$EE,$BA,$3E
                .BYTE $D1,$A7,$8D,$A8,$1B,$36,$47,$6E
                .BYTE $FA,$D9,$25,$A3,$31,$8F,$42,$5A
                .BYTE $D9,$1E,$D3,$F8,$CF,$ED,$53,$74

; =====================================================================
; SIGNER WORKSPACE
; =====================================================================

XMSS_SIGN_STATUS
                .BYTE $FF

; Index reserved for the in-progress signature.  This remains unchanged
; after the fixed ABI idx at $8CF0 is advanced.
XMSS_SIGN_IDX
                .RES 4

; =====================================================================
; TREEHASH PUBLIC PARAMETERS AND WORKSPACE
; =====================================================================

XMSS1024_STATUS
                .BYTE $FF

XMSS1024_PRINT_LEVEL
                .BYTE $00

XMSS_MASTER_SK_SEED
                .RES 32

; Signature-randomization secret.  It does not affect TreeHash, but key
; generation exports it so the later signature generator has the complete
; immutable private-key material available through the fixed RAM ABI.
XMSS_SK_PRF
                .RES 32

XMSS_TREE_START_LO
                .BYTE $00
XMSS_TREE_START_HI
                .BYTE $00
XMSS_TREE_HEIGHT_TARGET
                .BYTE $00
XMSS_TREE_LEAF_MODE
                .BYTE $00
XMSS_TREE_CAPTURE_AUTH
                .BYTE $00
XMSS_TREE_TARGET_LO
                .BYTE $00
XMSS_TREE_TARGET_HI
                .BYTE $00

XMSS_TREE_LEAF_COUNT_LO
                .BYTE $00
XMSS_TREE_LEAF_COUNT_HI
                .BYTE $00
XMSS_TREE_OFFSET_LO
                .BYTE $00
XMSS_TREE_OFFSET_HI
                .BYTE $00
XMSS_TREE_END_LO
                .BYTE $00
XMSS_TREE_END_HI
                .BYTE $00

XMSS_TREE_LEAF_INDEX_LO
                .BYTE $00
XMSS_TREE_LEAF_INDEX_HI
                .BYTE $00
XMSS_TREE_NODE_INDEX_LO
                .BYTE $00
XMSS_TREE_NODE_INDEX_HI
                .BYTE $00
XMSS_TREE_NODE_HEIGHT
                .BYTE $00
XMSS_TREE_STACK_TOP
                .BYTE $00
XMSS_AUTH_LEVEL
                .BYTE $00

XMSS_TREE_TEMP_LO
                .BYTE $00
XMSS_TREE_TEMP_HI
                .BYTE $00
XMSS_TREE_PTR_TEMP
                .BYTE $00,$00

XMSS_TREE_NODE
                .RES 32
XMSS_TREE_ROOT
                .RES 32
XMSS_AUTH_LEAF
                .RES 32
XMSS_AUTH_PATH
                .RES 320
XMSS_TREE_STACK_HEIGHTS
                .RES 11
XMSS_TREE_STACK_NODES
                .RES 352

TREEHASH_PROGRAM_END
                .END
