;license:BSD-3-Clause
;LZ data compressor for Apple II
;Peter Ferrie (peter.ferrie@gmail.com)
;assemble using ACME
!cpu 65c02
!to "lzpackd",plain
*=$800

                manparm = $0
                dosbuf  = $2
                tmpdst  = $4
                scratch = $f6
                address = $f8
                size    = $fa
                src     = $fc
                dst     = $fe
                dosbase = $3d2
                fileman = $3d6
                getparm = $3dc

start

                ;find a free DOS buffer

                ldy #0
                sty dosbuf
                lda dosbase
                sta dosbuf+1
-               lda (dosbuf), y
                tax
                iny
                lda (dosbuf), y
                stx dosbuf
                sta dosbuf+1
                ldy #36
                lda (dosbuf)
                bne -

                ;get file manager parameter list

                jsr getparm
                sty manparm
                sta manparm+1

                ;get pointer to pointers

                pha
                clc
                tya
                adc #12
                sta dst
                pla
                adc #0
                sta dst+1

                ldy #8
                txa
                sta (manparm), y
                sta open_file+6
                adc #30
                sta src
                iny
                lda dosbuf+1
                sta (manparm), y
                sta open_file+5
                adc #0
                sta src+1

                ;copy DOS buffer pointers to file manager parameter list

                ldy #5
-               lda (src), y
                sta (dst), y
                dey
                bpl -

                ;empty filename buffer

                ldy #29
                lda #$a0
-               sta (dosbuf), y
                dey
                bne -

                ;set input name

                lda #$cc
                sta (dosbuf), y
                iny
                lda #$da
                sta (dosbuf), y
                iny
                lda #$c9
                sta (dosbuf), y

                ;open source file
                ;read address and length

                ldx #1
                jsr open_file

                ;set destination pointer
                ;read entire file

                ldy #6
                lda size
                sta (manparm), y
                iny
                lda size+1
                sta (manparm), y
                iny
                lda #end&255
                sta (manparm), y
                sta src
                adc size
                sta tmpdst
                sta dst
                iny
                lda #(end>>8)&255
                sta (manparm), y
                sta src+1
                adc size+1
                sta tmpdst+1
                sta dst+1
                jsr op_close

                inc size+1
                jsr pack

                ;set compressed length

                clc     ;it's one byte larger than the real size
                lda dst
                sbc tmpdst
                sta size
                lda dst+1
                sbc tmpdst+1
                sta size+1

                ;set output name

                ldy #2
                lda #$cf
                sta (dosbuf), y
                dec addr_len+3
                inc addr_len+9

                ;open destination file
                ;write address and length

                jsr open_file

                ;write entire file

                lda size
                ldx size+1
                dec
                bne +
                dex
+               ldy #6
                sta (manparm), y
                iny
                txa
                sta (manparm), y
                iny
                lda tmpdst
                sta (manparm), y
                iny
                lda tmpdst+1
                sta (manparm), y
op_close        ldx #1
                jsr fileman

                ;close file

                ldy #0
                jsr set_ops1
                !by 2
                rts

                bestlen = $e8
                bestsrc = $ea
                tmplen  = $ec
                tmpcsrc = $ee
                tmposrc = $f0
                srccpy  = $f2
                bits    = $f4
                tag     = $f5
                tagptr  = $f6

pack            lda src
                sta srccpy
                lda src+1
                sta srccpy+1
                jsr copy_lit
                beq +           ;exit if only one byte
                jsr init_tag
                inc bits
                stz tag
pack_loop       lda size+1
                bne pack_more
                lda size
                beq +           ;exit if no more bytes
                cmp #5
                bcs pack_more   ;continue while at least 5 bytes left
-               jsr pack_lit    ;just store remaining bytes
                bne -
+               ldx #29         ;prepare tail
-               jsr set_bit     ;29 bits of 1s for a delta
                dex
                bne -
                ldx bits
                inx
-               jsr clear_bit   ;zero the rest of the byte and flush it
                dex
                bne -
get_src         lda (src)
                inc src
                bne +
                inc src+1
+               rts
pack_more       lda srccpy      ;use copy of original source for search
                sta tmposrc
                lda srccpy+1
                sta tmposrc+1
                stz bestlen     ;zero best length
                stz bestlen+1
zero_match      stz tmplen      ;zero current length
                stz tmplen+1
                lda src         ;use copy of current source for search
                sta tmpcsrc
                lda src+1
                sta tmpcsrc+1
find_match      lda (tmpcsrc)
                cmp (tmposrc)
                beq got_match
                jsr check_end
                bne find_match  ;search entire history for a match
                                ;it's slower but ratio is improved
check_match     ldx bestlen
                ldy bestlen+1
                bne +
                cpx #4
                bcc no_match    ;skip if best length was less than 4
+               jsr set_bit     ;prepare history type
                sec
                txa
                sbc #2          ;minimum decoded length is 2, so we can reduce by that much
                                ;this also saves us one bit if the length was x01b
                tax
                tya
                sbc #0
                sta tmplen
                jsr put_delta   ;encode the length
                sec
                lda size        ;adjust remaining size according to what was compressed
                sbc bestlen
                sta size
                lda size+1
                sbc bestlen+1
                sta size+1
                lda src
                sbc bestsrc     ;calculate the position
                pha
                lda src+1
                sbc bestsrc+1
                inc             ;add 2 because the high byte might be zero
                inc             ;and we can't encode such a value
                tax
                jsr put_delta   ;encode the high byte of the delta
                pla
                jsr set_dst     ;just store the low byte directly, because encoding a 16-bit value uses more bits
                                ;if all of the deltas are 8 bits large, then a smaller decoder could be used
                clc
                lda bestlen     ;adjust source according to what was compressed
                adc src
                sta src
                lda bestlen+1
                adc src+1
                sta src+1
                bra +
no_match        jsr pack_lit
+               jmp pack_loop
got_match       inc tmplen      ;increment match length while match is seen
                bne +
                inc tmplen+1
+               jsr check_end
                beq check_len   ;stop matching when end is reached
                inc tmpcsrc     ;increment pointer while match is seen
                bne +
                inc tmpcsrc+1
+               lda (tmpcsrc)   ;check for match
                cmp (tmposrc)
                beq got_match
check_len       sec
                lda tmposrc     ;rewind to search start
                sbc tmplen
                sta tmposrc
                lda tmposrc+1
                sbc tmplen+1
                sta tmposrc+1
                ldx tmplen      ;check if new length is at least as good as the previous one
                ldy tmplen+1    ;the closer we get to the current source, the fewer the bits we need to encode
                cpy bestlen
                bcc +
                cpx bestlen+1
                bcc +
                stx bestlen     ;update best length with better one
                sty bestlen+1
                lda tmposrc     ;update nearest match
                sta bestsrc
                lda tmposrc+1
                sta bestsrc+1
+               jsr check_end
                beq +
                jmp zero_match
+               jmp check_match
set_dst         sta (dst)
inc_dst         inc dst
                bne +
                inc dst+1
+               rts
pack_lit        jsr put_bit
copy_lit        jsr get_src
                jsr set_dst
                dec size
                bne +
                dec size+1
+               rts
clear_bit       clc
                !byte $24
set_bit         sec
put_bit         lda bits
                bne +
                lda tag         ;flush tag when full
                sta (tagptr)
init_tag        lda dst         ;remember future tag position
                sta tagptr
                lda dst+1
                sta tagptr+1
                jsr inc_dst
                lda #8          ;another 8 bits left
+               dec
                sta bits
                rol tag         ;rotate in new bit
                rts
check_end       inc tmposrc
                bne +
                inc tmposrc+1
+               lda tmposrc+1
                cmp src+1
                bne +
                lda tmposrc
                cmp src
+               rts
put_delta       ldy #16
-               txa
                asl
                tax
                rol tmplen      ;find (and discard) the first non-zero bit
                dey
                bcc -
-               txa
                asl
                tax
                rol tmplen
                jsr put_bit     ;encode the remaining bits
                dey
                beq clear_bit
                jsr set_bit
                bra -

open_file       ldy #9
                jsr set_ops
                !by 0, 0, 4, 6, 1, 0, 0, 0, 0, 1
                jsr set_ops91
addr_len        !by 0, address, 0, 4, 0, 0, 0, 0, 2, 3
                rts

set_ops91       ldy #9
set_ops1        ldx #1
set_ops         pla
                sta scratch
                pla
                sta scratch+1
-               inc scratch
                bne +
                inc scratch+1
+               lda (scratch)
                sta (manparm), y
                dey
                bpl -
                lda scratch+1
                pha
                lda scratch
                pha
                jmp fileman
end

                !raw "LZPACKD by Peter Ferrie"
