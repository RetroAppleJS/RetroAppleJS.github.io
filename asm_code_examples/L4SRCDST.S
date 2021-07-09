;LZ4 data decompressor for Apple II
;Peter Ferrie (peter.ferrie@gmail.com)
;src<dst

PAKSIZE	=	256
ORGSIZE = 512

;UNPACKER VARIABLES, NO NEED TO CHANGE THESE
SRC	  =	$06
DST	  =	$08
COUNT	=	$18
DELTA	=	$1A
TMPY	=	$1C


*=$800
        LDA	#>PAKOFF+1          ; + PACKSIZE (HI) - PACKED DATA OFFSET + PACKED DATA SIZE
        STA	SRC+1
        LDA	#<PAKOFF+0         ; + PACKSIZE (LO)
        STA	SRC

        LDA	#>ORGOFF+2         ; + ORGSIZE (HI) ORIGINAL UNPACKED DATA OFFSET + ORIGINAL UNPACKED SIZE
        STA	DST+1
        PHA
        LDA	#<ORGOFF+0         ; + ORGSIZE (LO)
        STA	DST

UNPACK  LDY	#$00   ;UNPACKER ENTRYPOINT

PTOKEN  JSR	GETSRC
      	PHA
      	LSR A
      	LSR A
      	LSR A
      	LSR A
      	BEQ	CMATCH
      	JSR	BCOUNT
      	TAX
      	JSR	DOCOPY
      	LDA	SRC
      	CMP	#<PAKOFF+1
      	LDA	SRC+1
      	SBC	#>PAKOFF+1
      	BCC	DONE

CMATCH  JSR	GETSRC
        STA	DELTA
        JSR	GETSRC
        STA	DELTA+1
        PLA
        AND	#$0F
        JSR	BCOUNT
        CLC
        ADC	#4
        TAX
        BCC	CM.1
        INC	COUNT+1
CM.1    LDA	SRC+1
        PHA
        LDA	SRC
        PHA
        CLC
        LDA	DST
        ADC	DELTA
        STA	SRC
        LDA	DST+1
        ADC	DELTA+1
        STA	SRC+1
        JSR	DOCOPY
        PLA
        STA	SRC
        PLA
        STA	SRC+1
        JMP	PTOKEN

DONE    PLA
        RTS

DOCOPY  JSR	GETPUT
	      DEX
        BNE	DOCOPY
        DEC	COUNT+1
        BNE	DOCOPY
        RTS

BCOUNT  LDX	#1
      	STX	COUNT+1
      	CMP	#$0F
      	BNE	BCT.2
BCT.0   STA	COUNT
      	JSR	GETSRC
      	TAX
      	CLC
      	ADC	COUNT
      	BCC	BCT.1
      	INC	COUNT+1
BCT.1	  INX
      	BEQ	BCT.0
BCT.2 	RTS

GETPUT  JSR	GETSRC

PUTDST  CPY	DST
      	BNE	PDST.0
      	DEC	DST+1
PDST.0  DEC	DST
      	STA	(DST),Y
      	RTS

GETSRC  LDA	SRC
      	BNE	GSRC.0
      	DEC	SRC+1
GSRC.0  DEC	SRC
      	LDA	(SRC),Y
      	RTS

PAKOFF  HEX 00        ;PLACE PACKED DATA HERE

ORGOFF  HEX 00
