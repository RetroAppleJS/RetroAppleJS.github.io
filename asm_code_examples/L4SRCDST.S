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
        LDA	#>ORGOFF           ; + PACKSIZE (HI) - PACKED DATA OFFSET + PACKED DATA SIZE
        STA	*SRC+1
        LDA	#<ORGOFF           ; + PACKSIZE (LO)
        STA	*SRC

        LDA	#>ORGOFF+2         ; + ORGSIZE (HI) ORIGINAL UNPACKED DATA OFFSET + ORIGINAL UNPACKED SIZE
        STA	*DST+1
        PHA
        LDA	#<ORGOFF         ; + ORGSIZE (LO)
        STA	*DST

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
      	LDA	*SRC
      	CMP	#<PAKOFF+1
      	LDA	*SRC+1
      	SBC	#>PAKOFF+1
      	BCC	DONE

CMATCH  JSR	GETSRC
        STA	*DELTA
        JSR	GETSRC
        STA	*DELTA+1
        PLA
        AND	#$0F
        JSR	BCOUNT
        CLC
        ADC	#$04
        TAX
        BCC	CM.1
        INC	*COUNT+1
CM.1    LDA	*SRC+1
        PHA
        LDA	*SRC
        PHA
        CLC
        LDA	*DST
        ADC	*DELTA
        STA	*SRC
        LDA	*DST+1
        ADC	*DELTA+1
        STA	*SRC+1
        JSR	DOCOPY
        PLA
        STA	*SRC
        PLA
        STA	*SRC+1
        JMP	PTOKEN

DONE    PLA
        RTS

DOCOPY  JSR	GETPUT
	      DEX
        BNE	DOCOPY
        DEC	*COUNT+1
        BNE	DOCOPY
        RTS

BCOUNT  LDX	#$01
      	STX	*COUNT+1
      	CMP	#$0F
      	BNE	BCT.2
BCT.0   STA	*COUNT
      	JSR	GETSRC
      	TAX
      	CLC
      	ADC	*COUNT
      	BCC	BCT.1
      	INC	*COUNT+1
BCT.1	  INX
      	BEQ	BCT.0
BCT.2 	RTS

GETPUT  JSR	GETSRC

PUTDST  CPY	*DST
      	BNE	PDST.0
      	DEC	*DST+1
PDST.0  DEC	*DST
      	STA	(DST),Y
      	RTS

GETSRC  LDA	*SRC
      	BNE	GSRC.0
      	DEC	*SRC+1
GSRC.0  DEC	*SRC
      	LDA	(SRC),Y
      	RTS

PAKOFF  HEX 04224D18   ; PACKED DATA
        HEX 6440A742
        HEX 030000F3
        HEX 39100836
        HEX 7F3F3F7E
        HEX 36100836
        HEX 4121214A
        HEX 36000002
        HEX 060E1E36
        HEX 427F2214
        HEX 0808142A
        HEX 7F004020
        HEX 110A0404
        HEX 007F3F5F
        HEX 6C757B7B
        HEX 7F70607E
        HEX 3179303F
        HEX 02001807
        HEX 00070C08
        HEX 70080402
        HEX 7F020408
        HEX 000100D0
        HEX 2A080808
        HEX 08492A1C
        HEX 08081C2A
        HEX 490C0013
        HEX 7F190093
        HEX 40404044
        HEX 467F0604
        HEX 3F0100F1
        HEX 1413181C
        HEX 7E1C1810
        HEX 6F640C1C
        HEX 3F1C0C04
        HEX 7B404808
        HEX 7F3E1C48
        HEX 4040481C
        HEX 3E7F0848
        HEX 40000000
        HEX 3B001201
        HEX 0100B27F
        HEX 0810207F
        HEX 20100800
        HEX 2A550200
        HEX 03070040
        HEX 2A003E41
        HEX 1F00A300
        HEX 00003F40
        HEX 40407F00
        HEX 40010072
        HEX 081C3E7F
        HEX 3E1C0845
        HEX 00F30400
        HEX 007F1414
        HEX 77007714
        HEX 14007F40
        HEX 404C4C40
        HEX 407F5800
        HEX 1401B900
        HEX 00AC0071
        HEX 08000800
        HEX 14141410
        HEX 00F01014
        HEX 143E143E
        HEX 14140008
        HEX 3C0A1C28
        HEX 1E080006
        HEX 26100804
        HEX 32300004
        HEX 0A0A042A
        HEX 122C3000
        HEX 02380030
        HEX 04020200
        HEX 01400810
        HEX 2020A000
        HEX 70082A1C
        HEX 081C2A08
        HEX 5100343E
        HEX 08085C00
        HEX 10040700
        HEX 253E0001
        HEX 00F00508
        HEX 00002010
        HEX 08040200
        HEX 001C2232
        HEX 2A26221C
        HEX 00080C81
        HEX 00F00F1C
        HEX 001C2220
        HEX 1804023E
        HEX 003E2010
        HEX 1820221C
        HEX 00101814
        HEX 123E1010
        HEX 003E021E
        HEX 20100070
        HEX 3804021E
        HEX 22221C20
        HEX 00800804
        HEX 0404001C
        HEX 22220300
        HEX 00080041
        HEX 3C20100E
        HEX 5C00039A
        HEX 00017800
        HEX 00660031
        HEX 0408107F
        HEX 00008100
        HEX 30040810
        HEX 3A004100
        HEX 1C2210F0
        HEX 00F0041C
        HEX 222A3A1A
        HEX 023C0008
        HEX 1422223E
        HEX 2222001E
        HEX 22220300
        HEX 80001C22
        HEX 02020222
        HEX 1C100010
        HEX 22100073
        HEX 3E02021E
        HEX 02023E08
        HEX 00B10200
        HEX 3C020202
        HEX 32223C00
        HEX 22370042
        HEX 22001C08
        HEX C0003120
        HEX 2020A800
        HEX 9122120A
        HEX 060A1222
        HEX 00020100
        HEX 603E0022
        HEX 362A2A28
        HEX 00502222
        HEX 262A3230
        HEX 00015800
        HEX 01600001
        HEX 50000010
        HEX 00005801
        HEX 00100000
        HEX 3800401C
        HEX 22021C48
        HEX 00223E08
        HEX 9A011322
        HEX 30000107
        HEX 00111410
        HEX 00302A2A
        HEX 36500010
        HEX 14BB0001
        HEX 08000028
        HEX 00011801
        HEX 00A80010
        HEX 06010030
        HEX 3E0000FE
        HEX 00502000
        HEX 003E3001
        HEX 00000201
        HEX 36081422
        HEX 8901127F
        HEX 1C01000B
        HEX 00911C20
        HEX 3C223C00
        HEX 02021EF0
        HEX 001100E2
        HEX 00903C00
        HEX 20203C22
        HEX 22223C20
        HEX 0090223E
        HEX 023C0018
        HEX 24041E78
        HEX 01120072
        HEX 01121C30
        HEX 00512200
        HEX 08000C00
        HEX 01F30210
        HEX 00181010
        HEX 10120C02
        HEX 0222120E
        HEX 1222000C
        HEX 18016000
        HEX 00362A2A
        HEX 2A7A0002
        HEX 30000140
        HEX 00102218
        HEX 00020201
        HEX 3000003C
        HEX 50005020
        HEX 00003A06
        HEX 10010080
        HEX 00501C20
        HEX 1E00046F
        HEX 00402418
        HEX 0000F200
        HEX 22322C08
        HEX 00211408
        HEX 0800302A
        HEX 2A360800
        HEX 1214D200
        HEX 11229000
        HEX F3020000
        HEX 3E100804
        HEX 3E00380C
        HEX 0C060C0C
        HEX 38000801
        HEX 00A40E18
        HEX 18301818
        HEX 0E002C1A
        HEX AA036014
        HEX 2A142A00
        HEX 00000000
        HEX 0018747C
        HEX CA

ORGOFF  HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
        HEX 0000000000000000
