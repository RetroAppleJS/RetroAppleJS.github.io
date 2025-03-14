;LICENSE:BSD-3-CLAUSE
;LZ DATA DECOMPRESSOR FOR APPLE II
;PETER FERRIE (PETER.FERRIE@GMAIL.COM)
;ASSEMBLE USING ACME
;CPU 65C02
;TO "LZUPACKD",PLAIN

ORG $800

                MANPARM EQU $0
                DOSBUF  EQU $2
                TMPDST  EQU $4
                ADDRESS EQU $F4
                SIZE    EQU $F6
                SCRATCH EQU $FA
                SRC     EQU $FC
                DST     EQU $FE
                DOSBASE EQU $03D2
                FILEMAN EQU $03D6
                GETPARM EQU $03DC

START

                ;FIND A FREE DOS BUFFER

                LDY #0
                STY DOSBUF
                LDA DOSBASE
                STA DOSBUF+1
L1              LDA (DOSBUF),Y
                TAX
                INY
                LDA (DOSBUF),Y
                STX DOSBUF
                STA DOSBUF+1
                LDY #36
                ;LDA (DOSBUF)
                JSR SUBST1

                ;GET FILE MANAGER PARAMETER LIST

                JSR GETPARM
                STY MANPARM
                STA MANPARM+1

                ;GET POINTER TO POINTERS

                PHA
                CLC
                TYA
                ADC #12
                STA DST
                PLA
                ADC #0
                STA DST+1

                LDY #8
                TXA
                STA (MANPARM),Y
                STA OPEN_FILE+6
                ADC #30
                STA SRC
                INY
                LDA DOSBUF+1
                STA (MANPARM),Y
                STA OPEN_FILE+5
                ADC #0
                STA SRC+1

                ;COPY DOS BUFFER POINTERS TO FILE MANAGER PARAMETER LIST

                LDY #5
L2              LDA (SRC),Y
                STA (DST),Y
                DEY
                BPL L2

                ;EMPTY FILENAME BUFFER

                LDY #29
                LDA #$A0
L3              STA (DOSBUF),Y
                DEY
                BNE L3

                ;SET INPUT NAME

                LDA #$CC
                STA (DOSBUF),Y
                INY
                LDA #$DA
                STA (DOSBUF),Y
                INY
                LDA #$C9
                STA (DOSBUF),Y

                ;OPEN SOURCE FILE
                ;READ ADDRESS AND LENGTH

                LDX #1
                JSR OPEN_FILE

                ;READ ENTIRE FILE

                LDY #6
                LDA SIZE
                STA (MANPARM),Y
                INY
                LDA SIZE+1
                STA (MANPARM),Y
                INY
                LDA #END&255
                STA (MANPARM),Y
                INY
                LDA #(END>>8)&255
                JSR OP_CLOSE

                ;SET DESTINATION POINTER

                LDA #(END-1)&255
                STA SRC
                ADC SIZE
                STA TMPDST
                STA DST
                LDA #((END-1)>>8)&255
                STA SRC+1
                ADC SIZE+1
                STA TMPDST+1
                STA DST+1

                INC SIZE+1
                JSR UNPACK

                ;SET DECOMPRESSED LENGTH

                SEC
                LDA DST
                SBC TMPDST
                STA SIZE
                LDA DST+1
                SBC TMPDST+1
                STA SIZE+1

                ;SET OUTPUT NAME

                LDY #2
                LDA #$CF
                STA (DOSBUF),Y
                DEC ADDR_LEN+3
                INC ADDR_LEN+9

                ;OPEN DESTINATION FILE
                ;WRITE ADDRESS AND LENGTH

                LDX #0
                JSR OPEN_FILE

                ;WRITE ENTIRE FILE

                LDA SIZE
                LDX SIZE+1
                DEC A
                BNE L4
                DEX
L4              LDY #6
                STA (MANPARM),Y
                INY
                TXA
                STA (MANPARM),Y
                INY
                LDA TMPDST
                LDX TMPDST+1
                INC A
                BNE L5
                INX
L5              STA (MANPARM),Y
                INY
                TXA
OP_CLOSE        STA (MANPARM),Y
                LDX #1
                JSR FILEMAN

                ;CLOSE FILE

                LDY #0
                JSR SET_OPS1
                HEX 02
                RTS

                SIZEH EQU $F9
                DELTA EQU $FA

UNPACK          LDA #$80
L6              TAX
                JSR GET_SRC
                INC DST
                BNE L7
                INC DST+1
L7              STA (DST)
                TXA
TEST_BIT        JSR GET_BIT
                BCC L6          ;LOOP UNTIL DELTA BIT IS SEEN
                JSR GET_DELTA   ;GET LENGTH
                TAX             ;SAVE BITS FOR LATER
                LDA DELTA
                ADC #2          ;UNDO THE -2 THAT WAS APPLIED DURING COMPRESSION
                TAY
                LDA DELTA+1
                ADC #1
                BCS BIT_RET     ;EXIT IF OVERFLOW
                STA SIZEH
                TXA
                JSR GET_DELTA   ;GET HIGH BYTE OF POSITION
                PHA
                JSR GET_SRC     ;GET LOW BYTE OF POSITION
                SEC
                LDA DST
                SBC (SRC)
                TAX             ;APPLY DELTA
                LDA DST+1
                SBC DELTA
                SBC #$FE        ;UNDO THE +2 THAT WAS APPLIED DURING COMPRESSION
                STA DELTA+1
                STX DELTA
L8               INC DELTA       ;COPY BYTES
                BNE L9
                INC DELTA+1
L9              ;LDA (DELTA)
                JSR SUBST2
                INC DST
                BNE L10
                INC DST+1
L10             STA (DST)
                DEY
                BNE L8
                DEC SIZEH
                BNE L8
                PLA
                JMP TEST_BIT
GET_DELTA       LDX #1
                STX DELTA
                PHA
                LDA #$0
                STA DELTA+1
                PLA
L11             JSR GET_BIT
                ROL DELTA       ;ROTATE IN NEW BIT
                ROL DELTA+1
                JSR GET_BIT
                BCS L11         ;CONTINUE WHILE MORE BITS ARE SEEN
                RTS
GET_BIT         ASL A
                BNE BIT_RET
                JSR GET_SRC
                ROL A
BIT_RET         RTS
GET_SRC         INC SRC
                BNE L12
                INC SRC+1
L12             ;LDA (SRC)
                JSR SUBST3
                RTS

OPEN_FILE       LDY #9
                JSR SET_OPS
                HEX 00000406010000000001
                JSR SET_OPS91
ADDR_LEN        HEX 00
                .BYTE ADDRESS
                HEX 0004000000000203
                RTS

SET_OPS91       LDY #9
SET_OPS1        LDX #1
SET_OPS         PLA
                STA DST
                PLA
                STA DST+1
L13             INC DST
                BNE L14
                INC DST+1
L14             ;LDA (DST)
                JSR SUBST4
                STA (MANPARM),Y
                DEY
                BPL L13
                LDA DST+1
                PHA
                LDA DST
                PHA
                JMP FILEMAN

SUBST1          TYA
                PHA
                LDY #$00
                LDA (DOSBUF),Y
                PHA
                TAY
                PLA
                RTS

SUBST2          TYA
                PHA
                LDY #$00
                LDA (DELTA),Y
                PHA
                TAY
                PLA
                RTS               

SUBST3          TYA
                PHA
                LDY #$00
                LDA (SRC),Y
                PHA
                TAY
                PLA
                RTS

SUBST4          TYA
                PHA
                LDY #$00
                LDA (DST),Y
                PHA
                TAY
                PLA
                RTS

END
                ASC "LZUPACKD BY PETER FERRIE"

