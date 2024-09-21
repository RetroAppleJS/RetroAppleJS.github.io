;license:BSD-3-Clause
;LZ data decompressor for Apple II
;Peter Ferrie (peter.ferrie@gmail.com)
;assemble using ACME
!cpu 65c02
!to "lzupackd",plain
*=$800

                manparm = $0
                dosbuf  = $2
                tmpdst  = $4
                address = $f4
                size    = $f6
                scratch = $fa
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
                iny
                lda #(end>>8)&255
                jsr op_close

                ;set destination pointer

                lda #(end-1)&255
                sta src
                adc size
                sta tmpdst
                sta dst
                lda #((end-1)>>8)&255
                sta src+1
                adc size+1
                sta tmpdst+1
                sta dst+1

                inc size+1
                jsr unpack

                ;set decompressed length

                sec
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

                ldx #0
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
                ldx tmpdst+1
                inc
                bne +
                inx
+               sta (manparm), y
                iny
                txa
op_close        sta (manparm), y
                ldx #1
                jsr fileman

                ;close file

                ldy #0
                jsr set_ops1
                !by 2
                rts

                sizeh = $f9
                delta = $fa

unpack          lda #$80
-               tax
                jsr get_src
                inc dst
                bne +
                inc dst+1
+               sta (dst)
                txa
test_bit        jsr get_bit
                bcc -           ;loop until delta bit is seen
                jsr get_delta   ;get length
                tax             ;save bits for later
                lda delta
                adc #2          ;undo the -2 that was applied during compression
                tay
                lda delta+1
                adc #1
                bcs bit_ret     ;exit if overflow
                sta sizeh
                txa
                jsr get_delta   ;get high byte of position
                pha
                jsr get_src     ;get low byte of position
                sec
                lda dst
                sbc (src)
                tax             ;apply delta
                lda dst+1
                sbc delta
                sbc #$fe        ;undo the +2 that was applied during compression
                sta delta+1
                stx delta
-               inc delta       ;copy bytes
                bne +
                inc delta+1
+               lda (delta)
                inc dst
                bne +
                inc dst+1
+               sta (dst)
                dey
                bne -
                dec sizeh
                bne -
                pla
                bra test_bit
get_delta       ldx #1
                stx delta
                stz delta+1
-               jsr get_bit
                rol delta       ;rotate in new bit
                rol delta+1
                jsr get_bit
                bcs -           ;continue while more bits are seen
                rts
get_bit         asl
                bne bit_ret
                jsr get_src
                rol
bit_ret         rts
get_src         inc src
                bne +
                inc src+1
+               lda (src)
                rts

open_file       ldy #9
                jsr set_ops
                !by 0, 0, 4, 6, 1, 0, 0, 0, 0, 1
                jsr set_ops91
addr_len        !by 0, address, 0, 4, 0, 0, 0, 0, 2, 3
                rts

set_ops91       ldy #9
set_ops1        ldx #1
set_ops         pla
                sta dst
                pla
                sta dst+1
-               inc dst
                bne +
                inc dst+1
+               lda (dst)
                sta (manparm), y
                dey
                bpl -
                lda dst+1
                pha
                lda dst
                pha
                jmp fileman
end

                !raw "LZUPACKD by Peter Ferrie"
