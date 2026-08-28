; ChatGPT / OpenAI 80-column banner - 7 lines
; RetroAppleJS ASM_core.js compatible NMOS 6502 source
;
; Compressed image: exactly 7 rows x 80 columns = 560 characters.
; Total assembled size: 151 bytes
;   decoder :  32 bytes
;   table   :  16 bytes
;   data    : 103 bytes
;
; No CR bytes are stored. Start at column 0 on an active 80-column
; display; normal 80-column wrapping advances to the next row.
;
; Token literals:
;   0 = "8"     ($B8)
;   1 = space   ($A0)
;   2 = "o"     ($EF)
;   3 = "."     ($AE)
;
; Recursive pair tokens:
;   4 = 00       "88"
;   5 = 11       "  "
;   6 = 40       "888"
;   7 = 65       "888  "
;   8 = 55       "    "
;   9 = 12       " o"
;   A = 17       " 888  "
;   B = 14       " 88"
;   C = 23       "o."
;   D = 57       "  888  "
;   E = 24       "o88"
;   F = 69       "888 o"
;
; TABLE combines literals and grammar rules. Literal Apple II display
; characters have bit 7 set; grammar bytes are below $80. TOKEN can
; therefore distinguish them with BPL.
;
; DATA is stored backwards. X counts from $66 (102) down to zero,
; causing LDA DATA,X to read the packed stream in forward order.
;
; COUT is the Apple II firmware character-output entry point.
; The output routine must preserve X.
;
; Entry point: $6000

COUT        EQU     $FDED

            ORG     $6000

START       LDX     #$66            ; 103 bytes: index 102..0

NEXT        LDA     DATA,X
            JSR     PAIR
            DEX
            BPL     NEXT
            RTS

; Expand two 4-bit tokens held in A: high nibble first, then low.
PAIR        PHA
            LSR     A
            LSR     A
            LSR     A
            LSR     A
            JSR     TOKEN
            PLA
            AND     #$0F

; Expand token A recursively. Literal table values are negative
; ($80..$FF), pair-rule values are positive ($00..$7F).
TOKEN       TAY
            LDA     TABLE,Y
            BPL     PAIR
            JMP     COUT

; 0..3 = literal high-bit Apple II characters.
; 4..F = recursive pair definitions.
TABLE       HEX     B8A0EFAE001140655512171423572469

; 103 compressed bytes, intentionally stored backwards.
DATA        HEX     8D2DE697E7D74294886222B4D5A896E2
            HEX     355EA4A694428909326333968D6AA177
            HEX     3E61BA873B4363320CA328B6B616A728
            HEX     74A80552B363B2A4F7814AB44C5B6C84
            HEX     BD1016C0B9205A425F029F8A882AF059
            HEX     1002C30B0303F144C546C526538A88CD
            HEX     3E812F3C030359

            .END
