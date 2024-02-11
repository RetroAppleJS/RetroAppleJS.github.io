
               SAVE S.D000
               1010 *--------------------------------
               1020 *   APPLESOFT TOKENS
               1030 *--------------------------------
81-            1040 TOKEN.FOR        .EQ $81
83-            1050 TOKEN.DATA       .EQ $83
A1-            1060 TOKEN.POP        .EQ $A1
AB-            1070 TOKEN.GOTO       .EQ $AB
B0-            1080 TOKEN.GOSUB      .EQ $B0
B2-            1090 TOKEN.REM        .EQ $B2
BA-            1100 TOKEN.PRINT      .EQ $BA
C0-            1110 TOKEN.TAB        .EQ $C0
C1-            1120 TOKEN.TO         .EQ $C1
C2-            1130 TOKEN.FN         .EQ $C2
C3-            1140 TOKEN.SPC        .EQ $C3
C4-            1150 TOKEN.THEN       .EQ $C4
C5-            1160 TOKEN.AT         .EQ $C5
C6-            1170 TOKEN.NOT        .EQ $C6
C7-            1180 TOKEN.STEP       .EQ $C7
C8-            1190 TOKEN.PLUS       .EQ $C8
C9-            1200 TOKEN.MINUS      .EQ $C9
CF-            1210 TOKEN.GREATER    .EQ $CF
D0-            1220 TOKEN.EQUAL      .EQ $D0
D2-            1230 TOKEN.SGN        .EQ $D2
D7-            1240 TOKEN.SCRN       .EQ $D7
E8-            1250 TOKEN.LEFTSTR    .EQ $E8
               1260 *--------------------------------
               1270 *      BRANCH TABLE FOR TOKENS
               1280 *--------------------------------
               1290 TOKEN.ADDRESS.TABLE
D000- 6F D8    1300    .DA END-1        $80...128...END
D002- 65 D7    1310    .DA FOR-1        $81...129...FOR
D004- F8 DC    1320    .DA NEXT-1       $82...130...NEXT
D006- 94 D9    1330    .DA DATA-1       $83...131...DATA
D008- B1 DB    1340    .DA INPUT-1      $84...132...INPUT
D00A- 30 F3    1350    .DA DEL-1        $85...133...DEL
D00C- D8 DF    1360    .DA DIM-1        $86...134...DIM
D00E- E1 DB    1370    .DA READ-1       $87...135...READ
D010- 8F F3    1380    .DA GR-1         $88...136...GR
D012- 98 F3    1390    .DA TEXT-1       $89...137...TEXT
D014- E4 F1    1400    .DA PR.NUMBER-1  $8A...138...PR#
D016- DD F1    1410    .DA IN.NUMBER-1  $8B...139...IN#
D018- D4 F1    1420    .DA CALL-1       $8C...140...CALL
D01A- 24 F2    1430    .DA PLOT-1       $8D...141...PLOT
D01C- 31 F2    1440    .DA HLIN-1       $8E...142...HLIN
D01E- 40 F2    1450    .DA VLIN-1       $8F...143...VLIN
D020- D7 F3    1460    .DA HGR2-1       $90...144...HGR2
D022- E1 F3    1470    .DA HGR-1        $91...145...HGR
D024- E8 F6    1480    .DA HCOLOR-1     $92...146...HCOLOR=
D026- FD F6    1490    .DA HPLOT-1      $93...147...HPLOT
D028- 68 F7    1500    .DA DRAW-1       $94...148...DRAW
D02A- 6E F7    1510    .DA XDRAW-1      $95...149...XDRAW
D02C- E6 F7    1520    .DA HTAB-1       $96...150...HTAB
D02E- 57 FC    1530    .DA MON.HOME-1   $97...151...HOME
D030- 20 F7    1540    .DA ROT-1        $98...152...ROT=
D032- 26 F7    1550    .DA SCALE-1      $99...153...SCALE=
D034- 74 F7    1560    .DA SHLOAD-1     $9A...154...SHLOAD
D036- 6C F2    1570    .DA TRACE-1      $9B...155...TRACE
D038- 6E F2    1580    .DA NOTRACE-1    $9C...156...NOTRACE
D03A- 72 F2    1590    .DA NORMAL-1     $9D...157...NORMAL
D03C- 76 F2    1600    .DA INVERSE-1    $9E...158...INVERSE
D03E- 7F F2    1610    .DA FLASH-1      $9F...159...FLASH
D040- 4E F2    1620    .DA COLOR-1      $A0...160...COLOR=
D042- 6A D9    1630    .DA POP-1        $A1...161...POP
D044- 55 F2    1640    .DA VTAB-1       $A2...162...VTAB
D046- 85 F2    1650    .DA HIMEM-1      $A3...163...HIMEM:
D048- A5 F2    1660    .DA LOMEM-1      $A4...164...LOMEM:
D04A- CA F2    1670    .DA ONERR-1      $A5...165...ONERR
D04C- 17 F3    1680    .DA RESUME-1     $A6...166...RESUME
D04E- BB F3    1690    .DA RECALL-1     $A7...167...RECALL
D050- 9E F3    1700    .DA STORE-1      $A8...168...STORE
D052- 61 F2    1710    .DA SPEED-1      $A9...169...SPEED=
D054- 45 DA    1720    .DA LET-1        $AA...170...LET
D056- 3D D9    1730    .DA GOTO-1       $AB...171...GOTO
D058- 11 D9    1740    .DA RUN-1        $AC...172...RUN
D05A- C8 D9    1750    .DA IF-1         $AD...173...IF
D05C- 48 D8    1760    .DA RESTORE-1    $AE...174...RESTORE
D05E- F4 03    1770    .DA AMPERSAND.VECTOR-1 $AF...175...&
D060- 20 D9    1780    .DA GOSUB-1      $B0...176...GOSUB
D062- 6A D9    1790    .DA POP-1        $B1...177...RETURN
D064- DB D9    1800    .DA REM-1        $B2...178...REM
D066- 6D D8    1810    .DA STOP-1       $B3...179...STOP
D068- EB D9    1820    .DA ONGOTO-1     $B4...180...ON
D06A- 83 E7    1830    .DA WAIT-1       $B5...181...WAIT
D06C- C8 D8    1840    .DA LOAD-1       $B6...182...LOAD
D06E- AF D8    1850    .DA SAVE-1       $B7...183...SAVE
D070- 12 E3    1860    .DA DEF-1        $B8...184...DEF
D072- 7A E7    1870    .DA POKE-1       $B9...185...POKE
D074- D4 DA    1880    .DA PRINT-1      $BA...186...PRINT
D076- 95 D8    1890    .DA CONT-1       $BB...187...CONT
D078- A4 D6    1900    .DA LIST-1       $BC...188...LIST
D07A- 69 D6    1910    .DA CLEAR-1      $BD...189...CLEAR
D07C- 9F DB    1920    .DA GET-1        $BE...190...GET
D07E- 48 D6    1930    .DA NEW-1        $BF...191...NEW
               1940 *--------------------------------
               1950 UNFNC
D080- 90 EB    1960    .DA SGN          $D2...210...SGN
D082- 23 EC    1970    .DA INT          $D3...211...INT
D084- AF EB    1980    .DA ABS          $D4...212...ABS
D086- 0A 00    1990    .DA USR          $D5...213...USR
D088- DE E2    2000    .DA FRE          $D6...214...FRE
D08A- 12 D4    2010    .DA ERROR        $D7...215...SCRN(
D08C- CD DF    2020    .DA PDL          $D8...216...PDL
D08E- FF E2    2030    .DA POS          $D9...217...POS
D090- 8D EE    2040    .DA SQR          $DA...218...SQR
D092- AE EF    2050    .DA RND          $DB...219...RND
D094- 41 E9    2060    .DA LOG          $DC...220...LOG
D096- 09 EF    2070    .DA EXP          $DD...221...EXP
D098- EA EF    2080    .DA COS          $DE...222...COS
D09A- F1 EF    2090    .DA SIN          $DF...223...SIN
D09C- 3A F0    2100    .DA TAN          $E0...224...TAN
D09E- 9E F0    2110    .DA ATN          $E1...225...ATN
D0A0- 64 E7    2120    .DA PEEK         $E2...226...PEEK
D0A2- D6 E6    2130    .DA LEN          $E3...227...LEN
D0A4- C5 E3    2140    .DA STR          $E4...228...STR$
D0A6- 07 E7    2150    .DA VAL          $E5...229...VAL
D0A8- E5 E6    2160    .DA ASC          $E6...230...ASC
D0AA- 46 E6    2170    .DA CHRSTR       $E7...231...CHR$
D0AC- 5A E6    2180    .DA LEFTSTR      $E8...232...LEFT$
D0AE- 86 E6    2190    .DA RIGHTSTR     $E9...233...RIGHT$
D0B0- 91 E6    2200    .DA MIDSTR       $EA...234...MID$
               2210 *--------------------------------
               2220 *      MATH OPERATOR BRANCH TABLE
               2230 *
               2240 *      ONE-BYTE PRECEDENCE CODE
               2250 *      TWO-BYTE ADDRESS
               2260 *--------------------------------
46-            2270 P.OR   .EQ $46      "OR" IS LOWEST PRECEDENCE
50-            2280 P.AND  .EQ $50
64-            2290 P.REL  .EQ $64      RELATIONAL OPERATORS
79-            2300 P.ADD  .EQ $79      BINARY + AND -
7B-            2310 P.MUL  .EQ $7B      * AND /
7D-            2320 P.PWR  .EQ $7D      EXPONENTIATION
7F-            2330 P.NEQ  .EQ $7F      UNARY - AND COMPARISON =
               2340 *--------------------------------
               2350 MATHTBL
D0B2- 79 C0 E7 2360        .DA #P.ADD,FADDT-1  $C8...200...+
D0B5- 79 A9 E7 2370        .DA #P.ADD,FSUBT-1  $C9...201...-
D0B8- 7B 81 E9 2380        .DA #P.MUL,FMULTT-1 $CA...202...*
D0BB- 7B 68 EA 2390        .DA #P.MUL,FDIVT-1  $CB...203.../
D0BE- 7D 96 EE 2400        .DA #P.PWR,FPWRT-1  $CC...204...^
D0C1- 50 54 DF 2410        .DA #P.AND,AND-1    $CD...205...AND
D0C4- 46 4E DF 2420        .DA #P.OR,OR-1      $CE...206...OR
D0C7- 7F CF EE 2430 M.NEG  .DA #P.NEQ,NEGOP-1  $CF...207...>
D0CA- 7F 97 DE 2440 M.EQU  .DA #P.NEQ,EQUOP-1  $D0...208...=
D0CD- 64 64 DF 2450 M.REL  .DA #P.REL,RELOPS-1 $D1...209...<
               2460 *--------------------------------
               2470 *      TOKEN NAME TABLE
               2480 *--------------------------------
               2490 TOKEN.NAME.TABLE
D0D0- 45 4E C4 2500    .AT "END"        $80...128
D0D3- 46 4F D2 2510    .AT "FOR"        $81...129
D0D6- 4E 45 58
D0D9- D4       2520    .AT "NEXT"       $82...130
D0DA- 44 41 54
D0DD- C1       2530    .AT "DATA"       $83...131
D0DE- 49 4E 50
D0E1- 55 D4    2540    .AT "INPUT"      $84...132
D0E3- 44 45 CC 2550    .AT "DEL"        $85...133
D0E6- 44 49 CD 2560    .AT "DIM"        $86...134
D0E9- 52 45 41
D0EC- C4       2570    .AT "READ"       $87...135
D0ED- 47 D2    2580    .AT "GR"         $88...136
D0EF- 54 45 58
D0F2- D4       2590    .AT "TEXT"       $89...137
D0F3- 50 52 A3 2600    .AT "PR#"        $8A...138
D0F6- 49 4E A3 2610    .AT "IN#"        $8B...139
D0F9- 43 41 4C
D0FC- CC       2620    .AT "CALL"       $8C...140
D0FD- 50 4C 4F
D100- D4       2630    .AT "PLOT"       $8D...141
D101- 48 4C 49
D104- CE       2640    .AT "HLIN"       $8E...142
D105- 56 4C 49
D108- CE       2650    .AT "VLIN"       $8F...143
D109- 48 47 52
D10C- B2       2660    .AT "HGR2"       $90...144
D10D- 48 47 D2 2670    .AT "HGR"        $91...145
D110- 48 43 4F
D113- 4C 4F 52
D116- BD       2680    .AT "HCOLOR="    $92...146
D117- 48 50 4C
D11A- 4F D4    2690    .AT "HPLOT"      $93...147
D11C- 44 52 41
D11F- D7       2700    .AT "DRAW"       $94...148
D120- 58 44 52
D123- 41 D7    2710    .AT "XDRAW"      $95...149
D125- 48 54 41
D128- C2       2720    .AT "HTAB"       $96...150
D129- 48 4F 4D
D12C- C5       2730    .AT "HOME"       $97...151
D12D- 52 4F 54
D130- BD       2740    .AT "ROT="       $98...152
D131- 53 43 41
D134- 4C 45 BD 2750    .AT "SCALE="     $99...153
D137- 53 48 4C
D13A- 4F 41 C4 2760    .AT "SHLOAD"     $9A...154
D13D- 54 52 41
D140- 43 C5    2770    .AT "TRACE"      $9B...155
D142- 4E 4F 54
D145- 52 41 43
D148- C5       2780    .AT "NOTRACE"    $9C...156
D149- 4E 4F 52
D14C- 4D 41 CC 2790    .AT "NORMAL"     $9D...157
D14F- 49 4E 56
D152- 45 52 53
D155- C5       2800    .AT "INVERSE"    $9E...158
D156- 46 4C 41
D159- 53 C8    2810    .AT "FLASH"      $9F...159
D15B- 43 4F 4C
D15E- 4F 52 BD 2820    .AT "COLOR="     $A0...160
D161- 50 4F D0 2830    .AT "POP"        $A1...161
D164- 56 54 41
D167- C2       2840    .AT "VTAB"       $A2...162
D168- 48 49 4D
D16B- 45 4D BA 2850    .AT "HIMEM:"     $A3...163
D16E- 4C 4F 4D
D171- 45 4D BA 2860    .AT "LOMEM:"     $A4...164
D174- 4F 4E 45
D177- 52 D2    2870    .AT "ONERR"      $A5...165
D179- 52 45 53
D17C- 55 4D C5 2880    .AT "RESUME"     $A6...166
D17F- 52 45 43
D182- 41 4C CC 2890    .AT "RECALL"     $A7...167
D185- 53 54 4F
D188- 52 C5    2900    .AT "STORE"      $A8...168
D18A- 53 50 45
D18D- 45 44 BD 2910    .AT "SPEED="     $A9...169
D190- 4C 45 D4 2920    .AT "LET"        $AA...170
D193- 47 4F 54
D196- CF       2930    .AT "GOTO"       $AB...171
D197- 52 55 CE 2940    .AT "RUN"        $AC...172
D19A- 49 C6    2950    .AT "IF"         $AD...173
D19C- 52 45 53
D19F- 54 4F 52
D1A2- C5       2960    .AT "RESTORE"    $AE...174
D1A3- A6       2970    .AT "&"          $AF...175
D1A4- 47 4F 53
D1A7- 55 C2    2980    .AT "GOSUB"      $B0...176
D1A9- 52 45 54
D1AC- 55 52 CE 2990    .AT "RETURN"     $B1...177
D1AF- 52 45 CD 3000    .AT "REM"        $B2...178
D1B2- 53 54 4F
D1B5- D0       3010    .AT "STOP"       $B3...179
D1B6- 4F CE    3020    .AT "ON"         $B4...180
D1B8- 57 41 49
D1BB- D4       3030    .AT "WAIT"       $B5...181
D1BC- 4C 4F 41
D1BF- C4       3040    .AT "LOAD"       $B6...182
D1C0- 53 41 56
D1C3- C5       3050    .AT "SAVE"       $B7...183
D1C4- 44 45 C6 3060    .AT "DEF"        $B8...184
D1C7- 50 4F 4B
D1CA- C5       3070    .AT "POKE"       $B9...185
D1CB- 50 52 49
D1CE- 4E D4    3080    .AT "PRINT"      $BA...186
D1D0- 43 4F 4E
D1D3- D4       3090    .AT "CONT"       $BB...187
D1D4- 4C 49 53
D1D7- D4       3100    .AT "LIST"       $BC...188
D1D8- 43 4C 45
D1DB- 41 D2    3110    .AT "CLEAR"      $BD...189
D1DD- 47 45 D4 3120    .AT "GET"        $BE...190
D1E0- 4E 45 D7 3130    .AT "NEW"        $BF...191
D1E3- 54 41 42
D1E6- A8       3140    .AT "TAB("       $C0...192
D1E7- 54 CF    3150    .AT "TO"         $C1...193
D1E9- 46 CE    3160    .AT "FN"         $C2...194
D1EB- 53 50 43
D1EE- A8       3170    .AT "SPC("       $C3...195
D1EF- 54 48 45
D1F2- CE       3180    .AT "THEN"       $C4...196
D1F3- 41 D4    3190    .AT "AT"         $C5...197
D1F5- 4E 4F D4 3200    .AT "NOT"        $C6...198
D1F8- 53 54 45
D1FB- D0       3210    .AT "STEP"       $C7...199
D1FC- AB       3220    .AT "+"          $C8...200
D1FD- AD       3230    .AT "-"          $C9...201
D1FE- AA       3240    .AT "*"          $CA...202
D1FF- AF       3250    .AT "/"          $CB...203
D200- DE       3260    .AT "^"          $CC...204
D201- 41 4E C4 3270    .AT "AND"        $CD...205
D204- 4F D2    3280    .AT "OR"         $CE...206
D206- BE       3290    .AT ">"          $CF...207
D207- BD       3300    .AT "="          $D0...208
D208- BC       3310    .AT "<"          $D1...209
D209- 53 47 CE 3320    .AT "SGN"        $D2...210
D20C- 49 4E D4 3330    .AT "INT"        $D3...211
D20F- 41 42 D3 3340    .AT "ABS"        $D4...212
D212- 55 53 D2 3350    .AT "USR"        $D5...213
D215- 46 52 C5 3360    .AT "FRE"        $D6...214
D218- 53 43 52
D21B- 4E A8    3370    .AT "SCRN("      $D7...215
D21D- 50 44 CC 3380    .AT "PDL"        $D8...216
D220- 50 4F D3 3390    .AT "POS"        $D9...217
D223- 53 51 D2 3400    .AT "SQR"        $DA...218
D226- 52 4E C4 3410    .AT "RND"        $DB...219
D229- 4C 4F C7 3420    .AT "LOG"        $DC...220
D22C- 45 58 D0 3430    .AT "EXP"        $DD...221
D22F- 43 4F D3 3440    .AT "COS"        $DE...222
D232- 53 49 CE 3450    .AT "SIN"        $DF...223
D235- 54 41 CE 3460    .AT "TAN"        $E0...224
D238- 41 54 CE 3470    .AT "ATN"        $E1...225
D23B- 50 45 45
D23E- CB       3480    .AT "PEEK"       $E2...226
D23F- 4C 45 CE 3490    .AT "LEN"        $E3...227
D242- 53 54 52
D245- A4       3500    .AT "STR$"       $E4...228
D246- 56 41 CC 3510    .AT "VAL"        $E5...229
D249- 41 53 C3 3520    .AT "ASC"        $E6...230
D24C- 43 48 52
D24F- A4       3530    .AT "CHR$"       $E7...231
D250- 4C 45 46
D253- 54 A4    3540    .AT "LEFT$"      $E8...232
D255- 52 49 47
D258- 48 54 A4 3550    .AT "RIGHT$"     $E9...233
D25B- 4D 49 44
D25E- A4       3560    .AT "MID$"       $EA...234
D25F- 00       3570    .HS 00       END OF TOKEN NAME TABLE


               SAVE S.D260
               1010 *--------------------------------
               1020 *      ERROR MESSAGES
               1030 *--------------------------------
               1040 ERROR.MESSAGES
00-            1050 ERR.NOFOR      .EQ *-ERROR.MESSAGES
D260- 4E 45 58
D263- 54 20 57
D266- 49 54 48
D269- 4F 55 54
D26C- 20 46 4F
D26F- D2       1060                .AT /NEXT WITHOUT FOR/
10-            1070 ERR.SYNTAX     .EQ *-ERROR.MESSAGES
D270- 53 59 4E
D273- 54 41 D8 1080                .AT /SYNTAX/
16-            1090 ERR.NOGOSUB    .EQ *-ERROR.MESSAGES
D276- 52 45 54
D279- 55 52 4E
D27C- 20 57 49
D27F- 54 48 4F
D282- 55 54 20
D285- 47 4F 53
D288- 55 C2    1100                .AT /RETURN WITHOUT GOSUB/
2A-            1110 ERR.NODATA     .EQ *-ERROR.MESSAGES
D28A- 4F 55 54
D28D- 20 4F 46
D290- 20 44 41
D293- 54 C1    1120                .AT /OUT OF DATA/
35-            1130 ERR.ILLQTY     .EQ *-ERROR.MESSAGES
D295- 49 4C 4C
D298- 45 47 41
D29B- 4C 20 51
D29E- 55 41 4E
D2A1- 54 49 54
D2A4- D9       1140                .AT /ILLEGAL QUANTITY/
45-            1150 ERR.OVERFLOW   .EQ *-ERROR.MESSAGES
D2A5- 4F 56 45
D2A8- 52 46 4C
D2AB- 4F D7    1160                .AT /OVERFLOW/
4D-            1170 ERR.MEMFULL    .EQ *-ERROR.MESSAGES
D2AD- 4F 55 54
D2B0- 20 4F 46
D2B3- 20 4D 45
D2B6- 4D 4F 52
D2B9- D9       1180                .AT /OUT OF MEMORY/
5A-            1190 ERR.UNDEFSTAT  .EQ *-ERROR.MESSAGES
D2BA- 55 4E 44
D2BD- 45 46 27
D2C0- 44 20 53
D2C3- 54 41 54
D2C6- 45 4D 45
D2C9- 4E D4    1200                .AT /UNDEF'D STATEMENT/
6B-            1210 ERR.BADSUBS    .EQ *-ERROR.MESSAGES
D2CB- 42 41 44
D2CE- 20 53 55
D2D1- 42 53 43
D2D4- 52 49 50
D2D7- D4       1220                .AT /BAD SUBSCRIPT/
78-            1230 ERR.REDIMD     .EQ *-ERROR.MESSAGES
D2D8- 52 45 44
D2DB- 49 4D 27
D2DE- 44 20 41
D2E1- 52 52 41
D2E4- D9       1240                .AT /REDIM'D ARRAY/
85-            1250 ERR.ZERODIV    .EQ *-ERROR.MESSAGES
D2E5- 44 49 56
D2E8- 49 53 49
D2EB- 4F 4E 20
D2EE- 42 59 20
D2F1- 5A 45 52
D2F4- CF       1260                .AT /DIVISION BY ZERO/
95-            1270 ERR.ILLDIR     .EQ *-ERROR.MESSAGES
D2F5- 49 4C 4C
D2F8- 45 47 41
D2FB- 4C 20 44
D2FE- 49 52 45
D301- 43 D4    1280                .AT /ILLEGAL DIRECT/
A3-            1290 ERR.BADTYPE    .EQ *-ERROR.MESSAGES
D303- 54 59 50
D306- 45 20 4D
D309- 49 53 4D
D30C- 41 54 43
D30F- C8       1300                .AT /TYPE MISMATCH/
B0-            1310 ERR.STRLONG    .EQ *-ERROR.MESSAGES
D310- 53 54 52
D313- 49 4E 47
D316- 20 54 4F
D319- 4F 20 4C
D31C- 4F 4E C7 1320                .AT /STRING TOO LONG/
BF-            1330 ERR.FRMCPX     .EQ *-ERROR.MESSAGES
D31F- 46 4F 52
D322- 4D 55 4C
D325- 41 20 54
D328- 4F 4F 20
D32B- 43 4F 4D
D32E- 50 4C 45
D331- D8       1340                .AT /FORMULA TOO COMPLEX/
D2-            1350 ERR.CANTCONT   .EQ *-ERROR.MESSAGES
D332- 43 41 4E
D335- 27 54 20
D338- 43 4F 4E
D33B- 54 49 4E
D33E- 55 C5    1360                .AT /CAN'T CONTINUE/
E0-            1370 ERR.UNDEFFUNC  .EQ *-ERROR.MESSAGES
D340- 55 4E 44
D343- 45 46 27
D346- 44 20 46
D349- 55 4E 43
D34C- 54 49 4F
D34F- CE       1380                .AT /UNDEF'D FUNCTION/
               1390 *--------------------------------
D350- 20 45 52
D353- 52 4F 52 1400 QT.ERROR   .AS / ERROR/
D356- 07 00    1410            .HS 0700      BELL
D358- 20 49 4E
D35B- 20       1420 QT.IN      .AS / IN /
D35C- 00       1430            .HS 00
D35D- 0D       1440 QT.BREAK   .HS 0D
D35E- 42 52 45
D361- 41 4B    1450            .AS /BREAK/
D363- 07 00    1460            .HS 0700      BELL


               SAVE S.D365
               1010 *--------------------------------
               1020 *      CALLED BY "NEXT" AND "FOR" TO SCAN THROUGH
               1030 *      THE STACK FOR A FRAME WITH THE SAME VARIABLE.
               1040 *
               1050 *      (FORPNT) = ADDRESS OF VARIABLE IF "FOR" OR "NEXT"
               1060 *               = $XXFF IF CALLED FROM "RETURN"
               1070 *                 <<< BUG: SHOULD BE $FFXX >>>
               1080 *
               1090 *      RETURNS .NE. IF VARIABLE NOT FOUND,
               1100 *              (X) = STACK PNTR AFTER SKIPPING ALL FRAMES
               1110 *
               1120 *              .EQ. IF FOUND
               1130 *              (X) = STACK PNTR OF FRAME FOUND
               1140 *--------------------------------
               1150 GTFORPNT
D365- BA       1160        TSX
D366- E8       1170        INX
D367- E8       1180        INX
D368- E8       1190        INX
D369- E8       1200        INX
D36A- BD 01 01 1210 .1     LDA STACK+1,X     "FOR" FRAME HERE?
D36D- C9 81    1220        CMP #TOKEN.FOR
D36F- D0 21    1230        BNE .4            NO
D371- A5 86    1240        LDA FORPNT+1      YES -- "NEXT" WITH NO VARIABLE?
D373- D0 0A    1250        BNE .2            NO, VARIABLE SPECIFIED
D375- BD 02 01 1260        LDA STACK+2,X     YES, SO USE THIS FRAME
D378- 85 85    1270        STA FORPNT
D37A- BD 03 01 1280        LDA STACK+3,X
D37D- 85 86    1290        STA FORPNT+1
D37F- DD 03 01 1300 .2     CMP STACK+3,X     IS VARIABLE IN THIS FRAME?
D382- D0 07    1310        BNE .3            NO
D384- A5 85    1320        LDA FORPNT        LOOK AT 2ND BYTE TOO
D386- DD 02 01 1330        CMP STACK+2,X     SAME VARIABLE?
D389- F0 07    1340        BEQ .4            YES
D38B- 8A       1350 .3     TXA               NO, SO TRY NEXT FRAME (IF ANY)
D38C- 18       1360        CLC               18 BYTES PER FRAME
D38D- 69 12    1370        ADC #18
D38F- AA       1380        TAX
D390- D0 D8    1390        BNE .1       ...ALWAYS?
D392- 60       1400 .4     RTS
               1410 *--------------------------------
               1420 *      MOVE BLOCK OF MEMORY UP
               1430 *
               1440 *      ON ENTRY:
               1450 *          (Y,A) = (HIGHDS) = DESTINATION END+1
               1460 *          (LOWTR) = LOWEST ADDRESS OF SOURCE
               1470 *          (HIGHTR) = HIGHEST SOURCE ADDRESS+1
               1480 *--------------------------------
D393- 20 E3 D3 1490 BLTU   JSR REASON   BE SURE (Y,A) < FRETOP
D396- 85 6D    1500        STA STREND   NEW TOP OF ARRAY STORAGE
D398- 84 6E    1510        STY STREND+1
D39A- 38       1520 BLTU2  SEC
D39B- A5 96    1530        LDA HIGHTR   COMPUTE # OF BYTES TO BE MOVED
D39D- E5 9B    1540        SBC LOWTR         (FROM LOWTR THRU HIGHTR-1)
D39F- 85 5E    1550        STA INDEX    PARTIAL PAGE AMOUNT
D3A1- A8       1560        TAY
D3A2- A5 97    1570        LDA HIGHTR+1
D3A4- E5 9C    1580        SBC LOWTR+1
D3A6- AA       1590        TAX          # OF WHOLE PAGES IN X-REG
D3A7- E8       1600        INX
D3A8- 98       1610        TYA          # BYTES IN PARTIAL PAGE
D3A9- F0 23    1620        BEQ .4       NO PARTIAL PAGE
D3AB- A5 96    1630        LDA HIGHTR   BACK UP HIGHTR # BYTES IN PARTIAL PAGE
D3AD- 38       1640        SEC
D3AE- E5 5E    1650        SBC INDEX
D3B0- 85 96    1660        STA HIGHTR
D3B2- B0 03    1670        BCS .1
D3B4- C6 97    1680        DEC HIGHTR+1
D3B6- 38       1690        SEC
D3B7- A5 94    1700 .1     LDA HIGHDS   BACK UP HIGHDS # BYTES IN PARTIAL PAGE
D3B9- E5 5E    1710        SBC INDEX
D3BB- 85 94    1720        STA HIGHDS
D3BD- B0 08    1730        BCS .3
D3BF- C6 95    1740        DEC HIGHDS+1
D3C1- 90 04    1750        BCC .3       ...ALWAYS
D3C3- B1 96    1760 .2     LDA (HIGHTR),Y    MOVE THE BYTES
D3C5- 91 94    1770        STA (HIGHDS),Y
D3C7- 88       1780 .3     DEY
D3C8- D0 F9    1790        BNE .2       LOOP TO END OF THIS 256 BYTES
D3CA- B1 96    1800        LDA (HIGHTR),Y    MOVE ONE MORE BYTE
D3CC- 91 94    1810        STA (HIGHDS),Y
D3CE- C6 97    1820 .4     DEC HIGHTR+1      DOWN TO NEXT BLOCK OF 256
D3D0- C6 95    1830        DEC HIGHDS+1
D3D2- CA       1840        DEX          ANOTHER BLOCK OF 256 TO MOVE?
D3D3- D0 F2    1850        BNE .3       YES
D3D5- 60       1860        RTS          NO, FINISHED
               1870 *--------------------------------
               1880 *      CHECK IF ENOUGH ROOM LEFT ON STACK
               1890 *      FOR "FOR", "GOSUB", OR EXPRESSION EVALUATION
               1900 *--------------------------------
D3D6- 0A       1910 CHKMEM ASL
D3D7- 69 36    1920        ADC #54
D3D9- B0 35    1930        BCS MEMERR   ...MEM FULL ERR
D3DB- 85 5E    1940        STA INDEX
D3DD- BA       1950        TSX
D3DE- E4 5E    1960        CPX INDEX
D3E0- 90 2E    1970        BCC MEMERR   ...MEM FULL ERR
D3E2- 60       1980        RTS
               1990 *--------------------------------
               2000 *      CHECK IF ENOUGH ROOM BETWEEN ARRAYS AND STRINGS
               2010 *      (Y,A) = ADDR ARRAYS NEED TO GROW TO
               2020 *--------------------------------
D3E3- C4 70    2030 REASON CPY FRETOP+1      HIGH BYTE
D3E5- 90 28    2040        BCC .4       PLENTY OF ROOM
D3E7- D0 04    2050        BNE .1       NOT ENOUGH, TRY GARBAGE COLLECTION
D3E9- C5 6F    2060        CMP FRETOP   LOW BYTE
D3EB- 90 22    2070        BCC .4       ENOUGH ROOM
               2080 *--------------------------------
D3ED- 48       2090 .1     PHA          SAVE (Y,A), TEMP1, AND TEMP2
D3EE- A2 09    2100        LDX #FAC-TEMP1-1
D3F0- 98       2110        TYA
D3F1- 48       2120 .2     PHA
D3F2- B5 93    2130        LDA TEMP1,X
D3F4- CA       2140        DEX
D3F5- 10 FA    2150        BPL .2
D3F7- 20 84 E4 2160        JSR GARBAG   MAKE AS MUCH ROOM AS POSSIBLE
D3FA- A2 F7    2170        LDX #TEMP1-FAC+1  RESTORE TEMP1 AND TEMP2
D3FC- 68       2180 .3     PLA               AND (Y,A)
D3FD- 95 9D    2190        STA FAC,X
D3FF- E8       2200        INX
D400- 30 FA    2210        BMI .3
D402- 68       2220        PLA
D403- A8       2230        TAY
D404- 68       2240        PLA          DID WE FIND ENOUGH ROOM?
D405- C4 70    2250        CPY FRETOP+1 HIGH BYTE
D407- 90 06    2260        BCC .4       YES, AT LEAST A PAGE
D409- D0 05    2270        BNE MEMERR   NO, MEM FULL ERR
D40B- C5 6F    2280        CMP FRETOP   LOW BYTE
D40D- B0 01    2290        BCS MEMERR   NO, MEM FULL ERR
D40F- 60       2300 .4     RTS          YES, RETURN
               2310 *--------------------------------
D410- A2 4D    2320 MEMERR LDX #ERR.MEMFULL
               2330 *--------------------------------
               2340 *      HANDLE AN ERROR
               2350 *
               2360 *      (X)=OFFSET IN ERROR MESSAGE TABLE
               2370 *      (ERRFLG) > 128 IF "ON ERR" TURNED ON
               2380 *      (CURLIN+1) = $FF IF IN DIRECT MODE
               2390 *--------------------------------
D412- 24 D8    2400 ERROR  BIT ERRFLG   "ON ERR" TURNED ON?
D414- 10 03    2410        BPL .1       NO
D416- 4C E9 F2 2420        JMP HANDLERR YES
D419- 20 FB DA 2430 .1     JSR CRDO     PRINT <RETURN>
D41C- 20 5A DB 2440        JSR OUTQUES  PRINT "?"
D41F- BD 60 D2 2450 .2     LDA ERROR.MESSAGES,X
D422- 48       2460        PHA          PRINT MESSAGE
D423- 20 5C DB 2470        JSR OUTDO
D426- E8       2480        INX
D427- 68       2490        PLA
D428- 10 F5    2500        BPL .2
D42A- 20 83 D6 2510        JSR STKINI   FIX STACK, ET AL
D42D- A9 50    2520        LDA #QT.ERROR   PRINT " ERROR" AND BELL
D42F- A0 D3    2530        LDY /QT.ERROR
               2540 *--------------------------------
               2550 *      PRINT STRING AT (Y,A)
               2560 *      PRINT CURRENT LINE # UNLESS IN DIRECT MODE
               2570 *      FALL INTO WARM RESTART
               2580 *--------------------------------
               2590 PRINT.ERROR.LINNUM
D431- 20 3A DB 2600        JSR STROUT      PRINT STRING AT (Y,A)
D434- A4 76    2610        LDY CURLIN+1      RUNNING, OR DIRECT?
D436- C8       2620        INY
D437- F0 03    2630        BEQ RESTART       WAS $FF, SO DIRECT MODE
D439- 20 19 ED 2640        JSR INPRT         RUNNING, SO PRINT LINE NUMBER
               2650 *--------------------------------
               2660 *      WARM RESTART ENTRY
               2670 *
               2680 *      COME HERE FROM MONITOR BY CTL-C, 0G, 3D0G, OR E003G
               2690 *--------------------------------
               2700 RESTART
D43C- 20 FB DA 2710        JSR CRDO          PRINT <RETURN>
D43F- A2 DD    2720        LDX #']+$80       PROMPT CHARACTER
D441- 20 2E D5 2730        JSR INLIN2        READ A LINE
D444- 86 B8    2740        STX TXTPTR        SET UP CHRGET TO SCAN THE LINE
D446- 84 B9    2750        STY TXTPTR+1
D448- 46 D8    2760        LSR ERRFLG        CLEAR FLAG
D44A- 20 B1 00 2770        JSR CHRGET
D44D- AA       2780        TAX
D44E- F0 EC    2790        BEQ RESTART       EMPTY LINE
D450- A2 FF    2800        LDX #$FF     $FF IN HI-BYTE OF CURLIN MEANS
D452- 86 76    2810        STX CURLIN+1      WE ARE IN DIRECT MODE
D454- 90 06    2820        BCC NUMBERED.LINE CHRGET SAW DIGIT, NUMBERED LINE
D456- 20 59 D5 2830        JSR PARSE.INPUT.LINE    NO NUMBER, SO PARSE IT
D459- 4C 05 D8 2840        JMP TRACE.   AND TRY EXECUTING IT
               2850 *--------------------------------
               2860 *      HANDLE NUMBERED LINE
               2870 *--------------------------------
               2880 NUMBERED.LINE
D45C- A6 AF    2890        LDX PRGEND   SQUASH VARIABLE TABLE
D45E- 86 69    2900        STX VARTAB
D460- A6 B0    2910        LDX PRGEND+1
D462- 86 6A    2920        STX VARTAB+1
D464- 20 0C DA 2930        JSR LINGET              GET LINE #
D467- 20 59 D5 2940        JSR PARSE.INPUT.LINE    AND PARSE THE INPUT LINE
D46A- 84 0F    2950        STY EOL.PNTR     SAVE INDEX TO INPUT BUFFER
D46C- 20 1A D6 2960        JSR FNDLIN       IS THIS LINE # ALREADY IN PROGRAM?
D46F- 90 44    2970        BCC PUT.NEW.LINE NO
D471- A0 01    2980        LDY #1           YES, SO DELETE IT
D473- B1 9B    2990        LDA (LOWTR),Y    LOWTR POINTS AT LINE
D475- 85 5F    3000        STA INDEX+1      GET HIGH BYTE OF FORWARD PNTR
D477- A5 69    3010        LDA VARTAB
D479- 85 5E    3020        STA INDEX
D47B- A5 9C    3030        LDA LOWTR+1
D47D- 85 61    3040        STA DEST+1
D47F- A5 9B    3050        LDA LOWTR
D481- 88       3060        DEY
D482- F1 9B    3070        SBC (LOWTR),Y
D484- 18       3080        CLC
D485- 65 69    3090        ADC VARTAB
D487- 85 69    3100        STA VARTAB
D489- 85 60    3110        STA DEST
D48B- A5 6A    3120        LDA VARTAB+1
D48D- 69 FF    3130        ADC #$FF
D48F- 85 6A    3140        STA VARTAB+1
D491- E5 9C    3150        SBC LOWTR+1
D493- AA       3160        TAX
D494- 38       3170        SEC
D495- A5 9B    3180        LDA LOWTR
D497- E5 69    3190        SBC VARTAB
D499- A8       3200        TAY
D49A- B0 03    3210        BCS .1
D49C- E8       3220        INX
D49D- C6 61    3230        DEC DEST+1
D49F- 18       3240 .1     CLC
D4A0- 65 5E    3250        ADC INDEX
D4A2- 90 03    3260        BCC .2
D4A4- C6 5F    3270        DEC INDEX+1
D4A6- 18       3280        CLC
               3290 *--------------------------------
D4A7- B1 5E    3300 .2     LDA (INDEX),Y     MOVE HIGHER LINES OF PROGRAM
D4A9- 91 60    3310        STA (DEST),Y      DOWN OVER THE DELETED LINE.
D4AB- C8       3320        INY
D4AC- D0 F9    3330        BNE .2
D4AE- E6 5F    3340        INC INDEX+1
D4B0- E6 61    3350        INC DEST+1
D4B2- CA       3360        DEX
D4B3- D0 F2    3370        BNE .2
               3380 *--------------------------------
               3390 PUT.NEW.LINE
D4B5- AD 00 02 3400        LDA INPUT.BUFFER  ANY CHARACTERS AFTER LINE #?
D4B8- F0 38    3410        BEQ FIX.LINKS     NO, SO NOTHING TO INSERT.
D4BA- A5 73    3420        LDA MEMSIZ       YES, SO MAKE ROOM AND INSERT LINE
D4BC- A4 74    3430        LDY MEMSIZ+1     WIPE STRING AREA CLEAN
D4BE- 85 6F    3440        STA FRETOP
D4C0- 84 70    3450        STY FRETOP+1
D4C2- A5 69    3460        LDA VARTAB        SET UP BLTU SUBROUTINE
D4C4- 85 96    3470        STA HIGHTR        INSERT NEW LINE.
D4C6- 65 0F    3480        ADC EOL.PNTR
D4C8- 85 94    3490        STA HIGHDS
D4CA- A4 6A    3500        LDY VARTAB+1
D4CC- 84 97    3510        STY HIGHTR+1
D4CE- 90 01    3520        BCC .1
D4D0- C8       3530        INY
D4D1- 84 95    3540 .1     STY HIGHDS+1
D4D3- 20 93 D3 3550        JSR BLTU     MAKE ROOM FOR THE LINE
D4D6- A5 50    3560        LDA LINNUM   PUT LINE NUMBER IN LINE IMAGE
D4D8- A4 51    3570        LDY LINNUM+1
D4DA- 8D FE 01 3580        STA INPUT.BUFFER-2
D4DD- 8C FF 01 3590        STY INPUT.BUFFER-1
D4E0- A5 6D    3600        LDA STREND
D4E2- A4 6E    3610        LDY STREND+1
D4E4- 85 69    3620        STA VARTAB
D4E6- 84 6A    3630        STY VARTAB+1
D4E8- A4 0F    3640        LDY EOL.PNTR
               3650 *---COPY LINE INTO PROGRAM-------
D4EA- B9 FB 01 3660 .2     LDA INPUT.BUFFER-5,Y
D4ED- 88       3670        DEY
D4EE- 91 9B    3680        STA (LOWTR),Y
D4F0- D0 F8    3690        BNE .2
               3700 *--------------------------------
               3710 *      CLEAR ALL VARIABLES
               3720 *      RE-ESTABLISH ALL FORWARD LINKS
               3730 *--------------------------------
               3740 FIX.LINKS
D4F2- 20 65 D6 3750        JSR SETPTRS  CLEAR ALL VARIABLES
D4F5- A5 67    3760        LDA TXTTAB   POINT INDEX AT START OF PROGRAM
D4F7- A4 68    3770        LDY TXTTAB+1
D4F9- 85 5E    3780        STA INDEX
D4FB- 84 5F    3790        STY INDEX+1
D4FD- 18       3800        CLC
D4FE- A0 01    3810 .1     LDY #1            HI-BYTE OF NEXT FORWARD PNTR
D500- B1 5E    3820        LDA (INDEX),Y     END OF PROGRAM YET?
D502- D0 0B    3830        BNE .2            NO, KEEP GOING
D504- A5 69    3840        LDA VARTAB        YES
D506- 85 AF    3850        STA PRGEND
D508- A5 6A    3860        LDA VARTAB+1
D50A- 85 B0    3870        STA PRGEND+1
D50C- 4C 3C D4 3880        JMP RESTART
D50F- A0 04    3890 .2     LDY #4       FIND END OF THIS LINE
D511- C8       3900 .3     INY          (NOTE MAXIMUM LENGTH < 256)
D512- B1 5E    3910        LDA (INDEX),Y
D514- D0 FB    3920        BNE .3
D516- C8       3930        INY          COMPUTE ADDRESS OF NEXT LINE
D517- 98       3940        TYA
D518- 65 5E    3950        ADC INDEX
D51A- AA       3960        TAX
D51B- A0 00    3970        LDY #0       STORE FORWARD PNTR IN THIS LINE
D51D- 91 5E    3980        STA (INDEX),Y
D51F- A5 5F    3990        LDA INDEX+1
D521- 69 00    4000        ADC #0       (NOTE: THIS CLEARS CARRY)
D523- C8       4010        INY
D524- 91 5E    4020        STA (INDEX),Y
D526- 86 5E    4030        STX INDEX
D528- 85 5F    4040        STA INDEX+1
D52A- 90 D2    4050        BCC .1       ...ALWAYS
               4060 *--------------------------------



               SAVE S.D52C
               1010 *--------------------------------
               1020 *      READ A LINE, AND STRIP OFF SIGN BITS
               1030 *--------------------------------
D52C- A2 80    1040 INLIN  LDX #$80     NULL PROMPT
D52E- 86 33    1050 INLIN2 STX MON.PROMPT
D530- 20 6A FD 1060        JSR MON.GETLN
D533- E0 EF    1070        CPX #239     MAXIMUM LINE LENGTH
D535- 90 02    1080        BCC .1
D537- A2 EF    1090        LDX #239     TRUNCATE AT 239 CHARS
D539- A9 00    1100 .1     LDA #0       MARK END OF LINE WITH $00 BYTE
D53B- 9D 00 02 1110        STA INPUT.BUFFER,X
D53E- 8A       1120        TXA
D53F- F0 0B    1130        BEQ .3       NULL INPUT LINE
D541- BD FF 01 1140 .2     LDA INPUT.BUFFER-1,X   DROP SIGN BITS
D544- 29 7F    1150        AND #$7F
D546- 9D FF 01 1160        STA INPUT.BUFFER-1,X
D549- CA       1170        DEX
D54A- D0 F5    1180        BNE .2
D54C- A9 00    1190 .3     LDA #0       (Y,X) POINTS AT BUFFER-1
D54E- A2 FF    1200        LDX #INPUT.BUFFER-1
D550- A0 01    1210        LDY /INPUT.BUFFER-1
D552- 60       1220        RTS
               1230 *--------------------------------
D553- 20 0C FD 1240 INCHR  JSR MON.RDKEY    *** OUGHT TO BE "BIT $C010" ***
D556- 29 7F    1250        AND #$7F
D558- 60       1260        RTS
               1270 *--------------------------------
               1280 *      TOKENIZE THE INPUT LINE
               1290 *--------------------------------
               1300 PARSE.INPUT.LINE
D559- A6 B8    1310        LDX TXTPTR   INDEX INTO UNPARSED LINE
D55B- CA       1320        DEX          PREPARE FOR INX AT "PARSE"
D55C- A0 04    1330        LDY #4       INDEX TO PARSED OUTPUT LINE
D55E- 84 13    1340        STY DATAFLG  CLEAR SIGN-BIT OF DATAFLG
D560- 24 D6    1350        BIT LOCK     IS THIS PROGRAM LOCKED?
D562- 10 08    1360        BPL PARSE    NO, GO AHEAD AND PARSE THE LINE
D564- 68       1370        PLA          YES, IGNORE INPUT AND "RUN"
D565- 68       1380        PLA             THE PROGRAM
D566- 20 65 D6 1390        JSR SETPTRS  CLEAR ALL VARIABLES
D569- 4C D2 D7 1400        JMP NEWSTT   START RUNNING
               1410 *--------------------------------
D56C- E8       1420 PARSE  INX          NEXT INPUT CHARACTER
D56D- BD 00 02 1430 .1     LDA INPUT.BUFFER,X
D570- 24 13    1440        BIT DATAFLG       IN A "DATA" STATEMENT?
D572- 70 04    1450        BVS .2            YES (DATAFLG = $49)
D574- C9 20    1460        CMP #' '     IGNORE BLANKS
D576- F0 F4    1470        BEQ PARSE
D578- 85 0E    1480 .2     STA ENDCHR
D57A- C9 22    1490        CMP #'"      START OF QUOTATION?
D57C- F0 74    1500        BEQ .13
D57E- 70 4D    1510        BVS .9       BRANCH IF IN "DATA" STATEMENT
D580- C9 3F    1520        CMP #'?      SHORTHAND FOR "PRINT"?
D582- D0 04    1530        BNE .3       NO
D584- A9 BA    1540        LDA #TOKEN.PRINT  YES, REPLACE WITH "PRINT" TOKEN
D586- D0 45    1550        BNE .9       ...ALWAYS
D588- C9 30    1560 .3     CMP #'0      IS IT A DIGIT, COLON, OR SEMI-COLON?
D58A- 90 04    1570        BCC .4       NO, PUNCTUATION !"#$%&'()*+,-./
D58C- C9 3C    1580        CMP #';'+1
D58E- 90 3D    1590        BCC .9       YES, NOT A TOKEN
               1600 *--------------------------------
               1610 *      SEARCH TOKEN NAME TABLE FOR MATCH STARTING
               1620 *      WITH CURRENT CHAR FROM INPUT LINE
               1630 *--------------------------------
D590- 84 AD    1640 .4     STY STRNG2   SAVE INDEX TO OUTPUT LINE
D592- A9 D0    1650        LDA #TOKEN.NAME.TABLE-$100
D594- 85 9D    1660        STA FAC      MAKE PNTR FOR SEARCH
D596- A9 CF    1670        LDA /TOKEN.NAME.TABLE-$100
D598- 85 9E    1680        STA FAC+1
D59A- A0 00    1690        LDY #0       USE Y-REG WITH (FAC) TO ADDRESS TABLE
D59C- 84 0F    1700        STY TKN.CNTR     HOLDS CURRENT TOKEN-$80
D59E- 88       1710        DEY          PREPARE FOR "INY" A FEW LINES DOWN
D59F- 86 B8    1720        STX TXTPTR   SAVE POSITION IN INPUT LINE
D5A1- CA       1730        DEX          PREPARE FOR "INX" A FEW LINES DOWN
D5A2- C8       1740 .5     INY          ADVANCE POINTER TO TOKEN TABLE
D5A3- D0 02    1750        BNE .6       Y=Y+1 IS ENOUGH
D5A5- E6 9E    1760        INC FAC+1    ALSO NEED TO BUMP THE PAGE
D5A7- E8       1770 .6     INX          ADVANCE POINTER TO INPUT LINE
D5A8- BD 00 02 1780 .7     LDA INPUT.BUFFER,X   NEXT CHAR FROM INPUT LINE
D5AB- C9 20    1790        CMP #' '     THIS CHAR A BLANK?
D5AD- F0 F8    1800        BEQ .6       YES, IGNORE ALL BLANKS
D5AF- 38       1810        SEC          NO, COMPARE TO CHAR IN TABLE
D5B0- F1 9D    1820        SBC (FAC),Y  SAME AS NEXT CHAR OF TOKEN NAME?
D5B2- F0 EE    1830        BEQ .5       YES, CONTINUE MATCHING
D5B4- C9 80    1840        CMP #$80     MAYBE; WAS IT SAME EXCEPT FOR BIT 7?
D5B6- D0 41    1850        BNE .14      NO, SKIP TO NEXT TOKEN
D5B8- 05 0F    1860        ORA TKN.CNTR     YES, END OF TOKEN; GET TOKEN #
D5BA- C9 C5    1870        CMP #TOKEN.AT  DID WE MATCH "AT"?
D5BC- D0 0D    1880        BNE .8       NO, SO NO AMBIGUITY
D5BE- BD 01 02 1890        LDA INPUT.BUFFER+1,X  "AT" COULD BE "ATN" OR "A TO"
D5C1- C9 4E    1900        CMP #'N      "ATN" HAS PRECEDENCE OVER "AT"
D5C3- F0 34    1910        BEQ .14      IT IS "ATN", FIND IT THE HARD WAY
D5C5- C9 4F    1920        CMP #'O      "TO" HAS PRECEDENCE OVER "AT"
D5C7- F0 30    1930        BEQ .14      IT IS "A TO", FIN IT THE HARD WAY
D5C9- A9 C5    1940        LDA #TOKEN.AT     NOT "ATN" OR "A TO", SO USE "AT"
               1950 *--------------------------------
               1960 *      STORE CHARACTER OR TOKEN IN OUTPUT LINE
               1970 *--------------------------------
D5CB- A4 AD    1980 .8     LDY STRNG2   GET INDEX TO OUTPUT LINE IN Y-REG
D5CD- E8       1990 .9     INX          ADVANCE INPUT INDEX
D5CE- C8       2000        INY          ADVANCE OUTPUT INDEX
D5CF- 99 FB 01 2010        STA INPUT.BUFFER-5,Y   STORE CHAR OR TOKEN
D5D2- B9 FB 01 2020        LDA INPUT.BUFFER-5,Y   TEST FOR EOL OR EOS
D5D5- F0 39    2030        BEQ .17      END OF LINE
D5D7- 38       2040        SEC
D5D8- E9 3A    2050        SBC #':      END OF STATEMENT?
D5DA- F0 04    2060        BEQ .10      YES, CLEAR DATAFLG
D5DC- C9 49    2070        CMP #TOKEN.DATA-':'   "DATA" TOKEN?
D5DE- D0 02    2080        BNE .11      NO, LEAVE DATAFLG ALONE
D5E0- 85 13    2090 .10    STA DATAFLG  DATAFLG = 0 OR $83-$3A = $49
D5E2- 38       2100 .11    SEC          IS IT A "REM" TOKEN?
D5E3- E9 78    2110        SBC #TOKEN.REM-':'
D5E5- D0 86    2120        BNE .1       NO, CONTINUE PARSING LINE
D5E7- 85 0E    2130        STA ENDCHR   YES, CLEAR LITERAL FLAG
               2140 *--------------------------------
               2150 *      HANDLE LITERAL (BETWEEN QUOTES) OR REMARK,
               2160 *      BY COPYING CHARS UP TO ENDCHR.
               2170 *--------------------------------
D5E9- BD 00 02 2180 .12    LDA INPUT.BUFFER,X
D5EC- F0 DF    2190        BEQ .9       END OF LINE
D5EE- C5 0E    2200        CMP ENDCHR
D5F0- F0 DB    2210        BEQ .9       FOUND ENDCHR
D5F2- C8       2220 .13    INY          NEXT OUTPUT CHAR
D5F3- 99 FB 01 2230        STA INPUT.BUFFER-5,Y
D5F6- E8       2240        INX          NEXT INPUT CHAR
D5F7- D0 F0    2250        BNE .12      ...ALWAYS
               2260 *--------------------------------
               2270 *      ADVANCE POINTER TO NEXT TOKEN NAME
               2280 *--------------------------------
D5F9- A6 B8    2290 .14    LDX TXTPTR   GET POINTER TO INPUT LINE IN X-REG
D5FB- E6 0F    2300        INC TKN.CNTR     BUMP (TOKEN # - $80)
D5FD- B1 9D    2310 .15    LDA (FAC),Y  SCAN THROUGH TABLE FOR BIT7 = 1
D5FF- C8       2320        INY          NEXT TOKEN ONE BEYOND THAT
D600- D0 02    2330        BNE .16      ...USUALLY ENOUGH TO BUMP Y-REG
D602- E6 9E    2340        INC FAC+1    NEXT SET OF 256 TOKEN CHARS
D604- 0A       2350 .16    ASL          SEE IF SIGN BIT SET ON CHAR
D605- 90 F6    2360        BCC .15      NO, MORE IN THIS NAME
D607- B1 9D    2370        LDA (FAC),Y  YES, AT NEXT NAME.  END OF TABLE?
D609- D0 9D    2380        BNE .7       NO, NOT END OF TABLE
D60B- BD 00 02 2390        LDA INPUT.BUFFER,X   YES, SO NOT A KEYWORD
D60E- 10 BB    2400        BPL .8       ...ALWAYS, COPY CHAR AS IS
               2410 *---END OF LINE------------------
D610- 99 FD 01 2420 .17    STA INPUT.BUFFER-3,Y   STORE ANOTHER 00 ON END
D613- C6 B9    2430        DEC TXTPTR+1      SET TXTPTR = INPUT.BUFFER-1
D615- A9 FF    2440        LDA #INPUT.BUFFER-1
D617- 85 B8    2450        STA TXTPTR
D619- 60       2460        RTS
               2470 *--------------------------------
               2480 *      SEARCH FOR LINE
               2490 *
               2500 *      (LINNUM) = LINE # TO FIND
               2510 *      IF NOT FOUND:  CARRY = 0
               2520 *                     LOWTR POINTS AT NEXT LINE
               2530 *      IF FOUND:      CARRY = 1
               2540 *                     LOWTR POINTS AT LINE
               2550 *--------------------------------
D61A- A5 67    2560 FNDLIN LDA TXTTAB   SEARCH FROM BEGINNING OF PROGRAM
D61C- A6 68    2570        LDX TXTTAB+1
D61E- A0 01    2580 FL1    LDY #1       SEARCH FROM (X,A)
D620- 85 9B    2590        STA LOWTR
D622- 86 9C    2600        STX LOWTR+1
D624- B1 9B    2610        LDA (LOWTR),Y
D626- F0 1F    2620        BEQ .3       END OF PROGRAM, AND NOT FOUND
D628- C8       2630        INY
D629- C8       2640        INY
D62A- A5 51    2650        LDA LINNUM+1
D62C- D1 9B    2660        CMP (LOWTR),Y
D62E- 90 18    2670        BCC RTS.1    IF NOT FOUND
D630- F0 03    2680        BEQ .1
D632- 88       2690        DEY
D633- D0 09    2700        BNE .2
D635- A5 50    2710 .1     LDA LINNUM
D637- 88       2720        DEY
D638- D1 9B    2730        CMP (LOWTR),Y
D63A- 90 0C    2740        BCC RTS.1    PAST LINE, NOT FOUND
D63C- F0 0A    2750        BEQ RTS.1    IF FOUND
D63E- 88       2760 .2     DEY
D63F- B1 9B    2770        LDA (LOWTR),Y
D641- AA       2780        TAX
D642- 88       2790        DEY
D643- B1 9B    2800        LDA (LOWTR),Y
D645- B0 D7    2810        BCS FL1      ALWAYS
D647- 18       2820 .3     CLC          RETURN CARRY = 0
D648- 60       2830 RTS.1  RTS
               2840 *--------------------------------
               2850 *      "NEW" STATEMENT
               2860 *--------------------------------
D649- D0 FD    2870 NEW    BNE RTS.1    IGNORE IF MORE TO THE STATEMENT
D64B- A9 00    2880 SCRTCH LDA #0
D64D- 85 D6    2890        STA LOCK
D64F- A8       2900        TAY
D650- 91 67    2910        STA (TXTTAB),Y
D652- C8       2920        INY
D653- 91 67    2930        STA (TXTTAB),Y
D655- A5 67    2940        LDA TXTTAB
D657- 69 02    2950        ADC #2      (CARRY WASN'T CLEARED, SO "NEW" USUALLY
D659- 85 69    2960        STA VARTAB    ADDS 3, WHEREAS "FP" ADDS 2.)
D65B- 85 AF    2970        STA PRGEND
D65D- A5 68    2980        LDA TXTTAB+1
D65F- 69 00    2990        ADC #0
D661- 85 6A    3000        STA VARTAB+1
D663- 85 B0    3010        STA PRGEND+1
               3020 *--------------------------------
               3030 SETPTRS
D665- 20 97 D6 3040        JSR STXTPT   SET TXTPTR TO TXTTAB - 1
D668- A9 00    3050        LDA #0       (THIS COULD HAVE BEEN ".HS 2C")
               3060 *--------------------------------
               3070 *      "CLEAR" STATEMENT
               3080 *--------------------------------
D66A- D0 2A    3090 CLEAR  BNE RTS.2    IGNORE IF NOT AT END OF STATEMENT
D66C- A5 73    3100 CLEARC LDA MEMSIZ   CLEAR STRING AREA
D66E- A4 74    3110        LDY MEMSIZ+1
D670- 85 6F    3120        STA FRETOP
D672- 84 70    3130        STY FRETOP+1
D674- A5 69    3140        LDA VARTAB   CLEAR ARRAY AREA
D676- A4 6A    3150        LDY VARTAB+1
D678- 85 6B    3160        STA ARYTAB
D67A- 84 6C    3170        STY ARYTAB+1
D67C- 85 6D    3180        STA STREND   LOW END OF FREE SPACE
D67E- 84 6E    3190        STY STREND+1
D680- 20 49 D8 3200        JSR RESTORE  SET "DATA" POINTER TO BEGINNING
               3210 *--------------------------------
D683- A2 55    3220 STKINI LDX #TEMPST
D685- 86 52    3230        STX TEMPPT
D687- 68       3240        PLA          SAVE RETURN ADDRESS
D688- A8       3250        TAY
D689- 68       3260        PLA
D68A- A2 F8    3270        LDX #$F8     START STACK AT $F8,
D68C- 9A       3280        TXS            LEAVING ROOM FOR PARSING LINES
D68D- 48       3290        PHA          RESTORE RETURN ADDRESS
D68E- 98       3300        TYA
D68F- 48       3310        PHA
D690- A9 00    3320        LDA #0
D692- 85 7A    3330        STA OLDTEXT+1
D694- 85 14    3340        STA SUBFLG
D696- 60       3350 RTS.2  RTS
               3360 *--------------------------------
               3370 *      SET TXTPTR TO BEGINNING OF PROGRAM
               3380 *--------------------------------
D697- 18       3390 STXTPT CLC          TXTPTR = TXTTAB - 1
D698- A5 67    3400        LDA TXTTAB
D69A- 69 FF    3410        ADC #$FF
D69C- 85 B8    3420        STA TXTPTR
D69E- A5 68    3430        LDA TXTTAB+1
D6A0- 69 FF    3440        ADC #$FF
D6A2- 85 B9    3450        STA TXTPTR+1
D6A4- 60       3460        RTS
               3470 *--------------------------------
               3480 *      "LIST" STATEMENT
               3490 *--------------------------------
D6A5- 90 0A    3500 LIST   BCC .1       NO  LINE # SPECIFIED
D6A7- F0 08    3510        BEQ .1       ---DITTO---
D6A9- C9 C9    3520        CMP #TOKEN.MINUS  IF DASH OR COMMA, START AT LINE 0
D6AB- F0 04    3530        BEQ .1            IS IS A DASH
D6AD- C9 2C    3540        CMP #',           COMMA?
D6AF- D0 E5    3550        BNE RTS.2         NO, ERROR
D6B1- 20 0C DA 3560 .1     JSR LINGET   CONVERT LINE NUMBER IF ANY
D6B4- 20 1A D6 3570        JSR FNDLIN   POINT LOWTR TO 1ST LINE
D6B7- 20 B7 00 3580        JSR CHRGOT   RANGE SPECIFIED?
D6BA- F0 10    3590        BEQ .3       NO
D6BC- C9 C9    3600        CMP #TOKEN.MINUS
D6BE- F0 04    3610        BEQ .2
D6C0- C9 2C    3620        CMP #',
D6C2- D0 84    3630        BNE RTS.1
D6C4- 20 B1 00 3640 .2     JSR CHRGET   GET NEXT CHAR
D6C7- 20 0C DA 3650        JSR LINGET   CONVERT SECOND LINE #
D6CA- D0 CA    3660        BNE RTS.2    BRANCH IF SYNTAX ERR
D6CC- 68       3670 .3     PLA          POP RETURN ADRESS
D6CD- 68       3680        PLA          (GET BACK BY "JMP NEWSTT")
D6CE- A5 50    3690        LDA LINNUM   IF NO SECOND NUMBER, USE $FFFF
D6D0- 05 51    3700        ORA LINNUM+1
D6D2- D0 06    3710        BNE LIST.0       THERE WAS A SECOND NUMBER
D6D4- A9 FF    3720        LDA #$FF     MAX END RANGE
D6D6- 85 50    3730        STA LINNUM
D6D8- 85 51    3740        STA LINNUM+1
D6DA- A0 01    3750 LIST.0 LDY #1
D6DC- B1 9B    3760        LDA (LOWTR),Y  HIGH BYTE OF LINK
D6DE- F0 44    3770        BEQ LIST.3   END OF PROGRAM
D6E0- 20 58 D8 3780        JSR ISCNTC   CHECK IF CONTROL-C HAS BEEN TYPED
D6E3- 20 FB DA 3790        JSR CRDO     NO, PRINT <RETURN>
D6E6- C8       3800        INY
D6E7- B1 9B    3810        LDA (LOWTR),Y  GET LINE #, COMPARE WITH END RANGE
D6E9- AA       3820        TAX
D6EA- C8       3830        INY
D6EB- B1 9B    3840        LDA (LOWTR),Y
D6ED- C5 51    3850        CMP LINNUM+1
D6EF- D0 04    3860        BNE .5
D6F1- E4 50    3870        CPX LINNUM
D6F3- F0 02    3880        BEQ .6       ON LAST LINE OF RANGE
D6F5- B0 2D    3890 .5     BCS LIST.3   FINISHED THE RANGE
               3900 *---LIST ONE LINE----------------
D6F7- 84 85    3910 .6     STY FORPNT
D6F9- 20 24 ED 3920        JSR LINPRT   PRINT LINE # FROM X,A
D6FC- A9 20    3930        LDA #' '     PRINT SPACE AFTER LINE #
D6FE- A4 85    3940 LIST.1 LDY FORPNT
D700- 29 7F    3950        AND #$7F
D702- 20 5C DB 3960 LIST.2 JSR OUTDO
D705- A5 24    3970        LDA MON.CH   IF PAST COLUMN 33, START A NEW LINE
D707- C9 21    3980        CMP #33
D709- 90 07    3990        BCC .1       < 33
D70B- 20 FB DA 4000        JSR CRDO     PRINT <RETURN>
D70E- A9 05    4010        LDA #5        AND TAB OVER 5
D710- 85 24    4020        STA MON.CH
D712- C8       4030 .1     INY
D713- B1 9B    4040        LDA (LOWTR),Y
D715- D0 1D    4050        BNE LIST.4   NOT END OF LINE YET
D717- A8       4060        TAY          END OF LINE
D718- B1 9B    4070        LDA (LOWTR),Y     GET LINK TO NEXT LINE
D71A- AA       4080        TAX
D71B- C8       4090        INY
D71C- B1 9B    4100        LDA (LOWTR),Y
D71E- 86 9B    4110        STX LOWTR    POINT TO NEXT LINE
D720- 85 9C    4120        STA LOWTR+1
D722- D0 B6    4130        BNE LIST.0       BRANCH IF NOT END OF PROGRAM
D724- A9 0D    4140 LIST.3 LDA #$0D     PRINT <RETURN>
D726- 20 5C DB 4150        JSR OUTDO
D729- 4C D2 D7 4160        JMP NEWSTT   TO NEXT STATEMENT
               4170 *--------------------------------
D72C- C8       4180 GETCHR INY          PICK UP CHAR FROM TABLE
D72D- D0 02    4190        BNE .1
D72F- E6 9E    4200        INC FAC+1
D731- B1 9D    4210 .1     LDA (FAC),Y
D733- 60       4220        RTS
               4230 *--------------------------------
D734- 10 CC    4240 LIST.4 BPL LIST.2   BRANCH IF NOT A TOKEN
D736- 38       4250        SEC
D737- E9 7F    4260        SBC #$7F     CONVERT TOKEN TO INDEX
D739- AA       4270        TAX
D73A- 84 85    4280        STY FORPNT   SAVE LINE POINTER
D73C- A0 D0    4290        LDY #TOKEN.NAME.TABLE-$100
D73E- 84 9D    4300        STY FAC      POINT FAC TO TABLE
D740- A0 CF    4310        LDY /TOKEN.NAME.TABLE-$100
D742- 84 9E    4320        STY FAC+1
D744- A0 FF    4330        LDY #-1
D746- CA       4340 .1     DEX          SKIP KEYWORDS UNTIL REACH THIS ONE
D747- F0 07    4350        BEQ .3
D749- 20 2C D7 4360 .2     JSR GETCHR   BUMP Y, GET CHAR FROM TABLE
D74C- 10 FB    4370        BPL .2       NOT AT END OF KEYWORD YET
D74E- 30 F6    4380        BMI .1       END OF KEYWORD, ALWAYS BRANCHES
D750- A9 20    4390 .3     LDA #' '     FOUND THE RIGHT KEYWORD
D752- 20 5C DB 4400        JSR OUTDO    PRINT LEADING SPACE
D755- 20 2C D7 4410 .4     JSR GETCHR   PRINT THE KEYWORD
D758- 30 05    4420        BMI .5       LAST CHAR OF KEYWORD
D75A- 20 5C DB 4430        JSR OUTDO
D75D- D0 F6    4440        BNE .4       ...ALWAYS
D75F- 20 5C DB 4450 .5     JSR OUTDO    PRINT LAST CHAR OF KEYWORD
D762- A9 20    4460        LDA #' '     PRINT TRAILING SPACE
D764- D0 98    4470        BNE LIST.1   ...ALWAYS, BACK TO ACTUAL LINE


               SAVE S.D766
               1010 *--------------------------------
               1020 *      "FOR" STATEMENT
               1030 *
               1040 *    FOR PUSHES 18 BYTES ON THE STACK:
               1050 *    2 -- TXTPTR
               1060 *    2 -- LINE NUMBER
               1070 *    5 -- INITIAL (CURRENT)  FOR VARIABLE VALUE
               1080 *    1 -- STEP SIGN
               1090 *    5 -- STEP VALUE
               1100 *    2 -- ADDRESS OF FOR VARIABLE IN VARTAB
               1110 *    1 -- FOR TOKEN ($81)
               1120 *--------------------------------
D766- A9 80    1130 FOR    LDA #$80
D768- 85 14    1140        STA SUBFLG   SUBSCRIPTS NOT ALLOWED
D76A- 20 46 DA 1150        JSR LET      DO <VAR> = <EXP>, STORE ADDR IN FORPNT
D76D- 20 65 D3 1160        JSR GTFORPNT  IS THIS FOR VARIABLE ACTIVE?
D770- D0 05    1170        BNE .1       NO
D772- 8A       1180        TXA          YES, CANCEL IT AND ENCLOSED LOOPS
D773- 69 0F    1190        ADC #15      CARRY=1, THIS ADDS 16
D775- AA       1200        TAX          X WAS ALREADY S+2
D776- 9A       1210        TXS
D777- 68       1220 .1     PLA          POP RETURN ADDRESS TOO
D778- 68       1230        PLA
D779- A9 09    1240        LDA #9       BE CERTAIN ENOUGH ROOM IN STACK
D77B- 20 D6 D3 1250        JSR CHKMEM
D77E- 20 A3 D9 1260        JSR DATAN    SCAN AHEAD TO NEXT STATEMENT
D781- 18       1270        CLC          PUSH STATEMENT ADDRESS ON STACK
D782- 98       1280        TYA
D783- 65 B8    1290        ADC TXTPTR
D785- 48       1300        PHA
D786- A5 B9    1310        LDA TXTPTR+1
D788- 69 00    1320        ADC #0
D78A- 48       1330        PHA
D78B- A5 76    1340        LDA CURLIN+1 PUSH LINE NUMBER ON STACK
D78D- 48       1350        PHA
D78E- A5 75    1360        LDA CURLIN
D790- 48       1370        PHA
D791- A9 C1    1380        LDA #TOKEN.TO
D793- 20 C0 DE 1390        JSR SYNCHR   REQUIRE "TO"
D796- 20 6A DD 1400        JSR CHKNUM   <VAR> = <EXP> MUST BE NUMERIC
D799- 20 67 DD 1410        JSR FRMNUM   GET FINAL VALUE, MUST BE NUMERIC
D79C- A5 A2    1420        LDA FAC.SIGN   PUT SIGN INTO VALUE IN FAC
D79E- 09 7F    1430        ORA #$7F
D7A0- 25 9E    1440        AND FAC+1
D7A2- 85 9E    1450        STA FAC+1
D7A4- A9 AF    1460        LDA #STEP    SET UP FOR RETURN
D7A6- A0 D7    1470        LDY /STEP     TO STEP
D7A8- 85 5E    1480        STA INDEX
D7AA- 84 5F    1490        STY INDEX+1
D7AC- 4C 20 DE 1500        JMP FRM.STACK.3  RETURNS BY "JMP (INDEX)"
               1510 *--------------------------------
               1520 *      "STEP" PHRASE OF "FOR" STATEMENT
               1530 *--------------------------------
D7AF- A9 13    1540 STEP   LDA #CON.ONE     STEP DEFAULT=1
D7B1- A0 E9    1550        LDY /CON.ONE
D7B3- 20 F9 EA 1560        JSR LOAD.FAC.FROM.YA
D7B6- 20 B7 00 1570        JSR CHRGOT
D7B9- C9 C7    1580        CMP #TOKEN.STEP
D7BB- D0 06    1590        BNE .1       USE DEFAULT VALUE OF 1.0
D7BD- 20 B1 00 1600        JSR CHRGET   STEP SPECIFIED, GET IT
D7C0- 20 67 DD 1610        JSR FRMNUM
D7C3- 20 82 EB 1620 .1     JSR SIGN
D7C6- 20 15 DE 1630        JSR FRM.STACK.2
D7C9- A5 86    1640        LDA FORPNT+1
D7CB- 48       1650        PHA
D7CC- A5 85    1660        LDA FORPNT
D7CE- 48       1670        PHA
D7CF- A9 81    1680        LDA #TOKEN.FOR
D7D1- 48       1690        PHA
               1700 *--------------------------------
               1710 *      PERFORM NEXT STATEMENT
               1720 *--------------------------------
D7D2- BA       1730 NEWSTT TSX          REMEMBER THE STACK POSITION
D7D3- 86 F8    1740        STX REMSTK
D7D5- 20 58 D8 1750        JSR ISCNTC   SEE IF CONTROL-C HAS BEEN TYPED
D7D8- A5 B8    1760        LDA TXTPTR   NO, KEEP EXECUTING
D7DA- A4 B9    1770        LDY TXTPTR+1
D7DC- A6 76    1780        LDX CURLIN+1     =$FF IF IN DIRECT MODE
D7DE- E8       1790        INX               $FF TURNS INTO $00
D7DF- F0 04    1800        BEQ .1            IN DIRECT MODE
D7E1- 85 79    1810        STA OLDTEXT      IN RUNNING MODE
D7E3- 84 7A    1820        STY OLDTEXT+1
D7E5- A0 00    1830 .1     LDY #0
D7E7- B1 B8    1840        LDA (TXTPTR),Y    END OF LINE YET?
D7E9- D0 57    1850        BNE COLON.        NO
D7EB- A0 02    1860        LDY #2            YES, SEE IF END OF PROGRAM
D7ED- B1 B8    1870        LDA (TXTPTR),Y
D7EF- 18       1880        CLC
D7F0- F0 34    1890        BEQ GOEND         YES, END OF PROGRAM
D7F2- C8       1900        INY
D7F3- B1 B8    1910        LDA (TXTPTR),Y    GET LINE # OF NEXT LINE
D7F5- 85 75    1920        STA CURLIN
D7F7- C8       1930        INY
D7F8- B1 B8    1940        LDA (TXTPTR),Y
D7FA- 85 76    1950        STA CURLIN+1
D7FC- 98       1960        TYA               ADJUST TXTPTR TO START
D7FD- 65 B8    1970        ADC TXTPTR        OF NEW LINE
D7FF- 85 B8    1980        STA TXTPTR
D801- 90 02    1990        BCC .2
D803- E6 B9    2000        INC TXTPTR+1
               2010 .2
               2020 *--------------------------------
D805- 24 F2    2030 TRACE. BIT TRCFLG   IS TRACE ON?
D807- 10 14    2040        BPL .1       NO
D809- A6 76    2050        LDX CURLIN+1 YES, ARE WE RUNNING?
D80B- E8       2060        INX
D80C- F0 0F    2070        BEQ .1       NOT RUNNING, SO DON'T TRACE
D80E- A9 23    2080        LDA #'#'     PRINT "#"
D810- 20 5C DB 2090        JSR OUTDO
D813- A6 75    2100        LDX CURLIN
D815- A5 76    2110        LDA CURLIN+1
D817- 20 24 ED 2120        JSR LINPRT   PRINT LINE NUMBER
D81A- 20 57 DB 2130        JSR OUTSP    PRINT TRAILING SPACE
D81D- 20 B1 00 2140 .1     JSR CHRGET   GET FIRST CHR OF STATEMENT
D820- 20 28 D8 2150        JSR EXECUTE.STATEMENT    AND START PROCESSING
D823- 4C D2 D7 2160        JMP NEWSTT   BACK FOR MORE
               2170 *--------------------------------
D826- F0 62    2180 GOEND  BEQ END4
               2190 *--------------------------------
               2200 *      EXECUTE A STATEMENT
               2210 *
               2220 *      (A) IS FIRST CHAR OF STATEMENT
               2230 *      CARRY IS SET
               2240 *--------------------------------
               2250 EXECUTE.STATEMENT
D828- F0 2D    2260        BEQ RTS.3    END OF LINE, NULL STATEMENT
               2270 EXECUTE.STATEMENT.1
D82A- E9 80    2280        SBC #$80     FIRST CHAR A TOKEN?
D82C- 90 11    2290        BCC .1       NOT TOKEN, MUST BE "LET"
D82E- C9 40    2300        CMP #$40     STATEMENT-TYPE TOKEN?
D830- B0 14    2310        BCS SYNERR.1 NO, SYNTAX ERROR
D832- 0A       2320        ASL          DOUBLE TO GET INDEX
D833- A8       2330        TAY          INTO ADDRESS TABLE
D834- B9 01 D0 2340        LDA TOKEN.ADDRESS.TABLE+1,Y
D837- 48       2350        PHA          PUT ADDRESS ON STACK
D838- B9 00 D0 2360        LDA TOKEN.ADDRESS.TABLE,Y
D83B- 48       2370        PHA
D83C- 4C B1 00 2380        JMP CHRGET   GET NEXT CHR & RTS TO ROUTINE
               2390 *--------------------------------
D83F- 4C 46 DA 2400 .1     JMP LET      MUST BE <VAR> = <EXP>
               2410 *--------------------------------
D842- C9 3A    2420 COLON. CMP #':'
D844- F0 BF    2430        BEQ TRACE.
D846- 4C C9 DE 2440 SYNERR.1 JMP SYNERR
               2450 *--------------------------------
               2460 *      "RESTORE" STATEMENT
               2470 *--------------------------------
               2480 RESTORE
D849- 38       2490        SEC          SET DATPTR TO BEGINNING OF PROGRAM
D84A- A5 67    2500        LDA TXTTAB
D84C- E9 01    2510        SBC #1
D84E- A4 68    2520        LDY TXTTAB+1
D850- B0 01    2530        BCS SETDA
D852- 88       2540        DEY
               2550 *---SET DATPTR TO Y,A------------
D853- 85 7D    2560 SETDA  STA DATPTR
D855- 84 7E    2570        STY DATPTR+1
D857- 60       2580 RTS.3  RTS
               2590 *--------------------------------
               2600 *      SEE IF CONTROL-C TYPED
               2610 *--------------------------------
D858- AD 00 C0 2620 ISCNTC LDA KEYBOARD
D85B- C9 83    2630        CMP #$83
D85D- F0 01    2640        BEQ .1
D85F- 60       2650        RTS
D860- 20 53 D5 2660 .1     JSR INCHR    <<< SHOULD BE "BIT $C010" >>>
               2670 CONTROL.C.TYPED
D863- A2 FF    2680        LDX #$FF     CONTROL C ATTEMPTED
D865- 24 D8    2690        BIT ERRFLG   "ON ERR" ENABLED?
D867- 10 03    2700        BPL .2       NO
D869- 4C E9 F2 2710        JMP HANDLERR YES, RETURN ERR CODE = 255
D86C- C9 03    2720 .2     CMP #3       SINCE IT IS CTRL-C, SET Z AND C BITS
               2730 *--------------------------------
               2740 *      "STOP" STATEMENT
               2750 *--------------------------------
D86E- B0 01    2760 STOP   BCS END2     CARRY=1 TO FORCE PRINTING "BREAK AT.."
               2770 *--------------------------------
               2780 *      "END" STATEMENT
               2790 *--------------------------------
D870- 18       2800 END    CLC          CARRY=0 TO AVOID PRINTING MESSAGE
D871- D0 3C    2810 END2   BNE RTS.4    IF NOT END OF STATEMENT, DO NOTHING
D873- A5 B8    2820        LDA TXTPTR
D875- A4 B9    2830        LDY TXTPTR+1
D877- A6 76    2840        LDX CURLIN+1
D879- E8       2850        INX          RUNNING?
D87A- F0 0C    2860        BEQ .1       NO, DIRECT MODE
D87C- 85 79    2870        STA OLDTEXT
D87E- 84 7A    2880        STY OLDTEXT+1
D880- A5 75    2890        LDA CURLIN
D882- A4 76    2900        LDY CURLIN+1
D884- 85 77    2910        STA OLDLIN
D886- 84 78    2920        STY OLDLIN+1
D888- 68       2930 .1     PLA
D889- 68       2940        PLA
D88A- A9 5D    2950 END4   LDA #QT.BREAK      " BREAK" AND BELL
D88C- A0 D3    2960        LDY /QT.BREAK
D88E- 90 03    2970        BCC .1
D890- 4C 31 D4 2980        JMP PRINT.ERROR.LINNUM
D893- 4C 3C D4 2990 .1     JMP RESTART
               3000 *--------------------------------
               3010 *      "CONT" COMMAND
               3020 *--------------------------------
D896- D0 17    3030 CONT   BNE RTS.4    IF NOT END OF STATEMENT, DO NOTHING
D898- A2 D2    3040        LDX #ERR.CANTCONT
D89A- A4 7A    3050        LDY OLDTEXT+1     MEANINGFUL RE-ENTRY?
D89C- D0 03    3060        BNE .1            YES
D89E- 4C 12 D4 3070        JMP ERROR         NO
D8A1- A5 79    3080 .1     LDA OLDTEXT       RESTORE TXTPTR
D8A3- 85 B8    3090        STA TXTPTR
D8A5- 84 B9    3100        STY TXTPTR+1
D8A7- A5 77    3110        LDA OLDLIN        RESTORE LINE NUMBER
D8A9- A4 78    3120        LDY OLDLIN+1
D8AB- 85 75    3130        STA CURLIN
D8AD- 84 76    3140        STY CURLIN+1
D8AF- 60       3150 RTS.4  RTS
               3160 *--------------------------------
               3170 *      "SAVE" COMMAND
               3180 *      WRITES PROGRAM ON CASSETTE TAPE
               3190 *--------------------------------
D8B0- 38       3200 SAVE   SEC
D8B1- A5 AF    3210        LDA PRGEND   COMPUTE PROGRAM LENGTH
D8B3- E5 67    3220        SBC TXTTAB
D8B5- 85 50    3230        STA LINNUM
D8B7- A5 B0    3240        LDA PRGEND+1
D8B9- E5 68    3250        SBC TXTTAB+1
D8BB- 85 51    3260        STA LINNUM+1
D8BD- 20 F0 D8 3270        JSR VARTIO   SET UP TO WRITE 3 BYTE HEADER
D8C0- 20 CD FE 3280        JSR MON.WRITE     WRITE 'EM
D8C3- 20 01 D9 3290        JSR PROGIO   SET UP TO WRITE THE PROGRAM
D8C6- 4C CD FE 3300        JMP MON.WRITE     WRITE IT
               3310 *--------------------------------
               3320 *      "LOAD" COMMAND
               3330 *      READS A PROGRAM FROM CASSETTE TAPE
               3340 *--------------------------------
D8C9- 20 F0 D8 3350 LOAD   JSR VARTIO   SET UP TO READ 3 BYTE HEADER
D8CC- 20 FD FE 3360        JSR MON.READ      READ LENGTH, LOCK BYTE
D8CF- 18       3370        CLC
D8D0- A5 67    3380        LDA TXTTAB   COMPUTE END ADDRESS
D8D2- 65 50    3390        ADC LINNUM
D8D4- 85 69    3400        STA VARTAB
D8D6- A5 68    3410        LDA TXTTAB+1
D8D8- 65 51    3420        ADC LINNUM+1
D8DA- 85 6A    3430        STA VARTAB+1
D8DC- A5 52    3440        LDA TEMPPT   LOCK BYTE
D8DE- 85 D6    3450        STA LOCK
D8E0- 20 01 D9 3460        JSR PROGIO   SET UP TO READ PROGRAM
D8E3- 20 FD FE 3470        JSR MON.READ READ IT
D8E6- 24 D6    3480        BIT LOCK     IF LOCKED, START RUNNING NOW
D8E8- 10 03    3490        BPL .1       NOT LOCKED
D8EA- 4C 65 D6 3500        JMP SETPTRS  LOCKED, START RUNNING
D8ED- 4C F2 D4 3510 .1     JMP FIX.LINKS  JUST FIX FORWARD POINTERS
               3520 *--------------------------------
D8F0- A9 50    3530 VARTIO LDA #LINNUM  SET UP TO READ/WRITE 3 BYTE HEADER
D8F2- A0 00    3540        LDY #0
D8F4- 85 3C    3550        STA MON.A1L
D8F6- 84 3D    3560        STY MON.A1H
D8F8- A9 52    3570        LDA #TEMPPT
D8FA- 85 3E    3580        STA MON.A2L
D8FC- 84 3F    3590        STY MON.A2H
D8FE- 84 D6    3600        STY LOCK
D900- 60       3610        RTS
               3620 *--------------------------------
D901- A5 67    3630 PROGIO LDA TXTTAB   SET UP TO READ/WRITE PROGRAM
D903- A4 68    3640        LDY TXTTAB+1
D905- 85 3C    3650        STA MON.A1L
D907- 84 3D    3660        STY MON.A1H
D909- A5 69    3670        LDA VARTAB
D90B- A4 6A    3680        LDY VARTAB+1
D90D- 85 3E    3690        STA MON.A2L
D90F- 84 3F    3700        STY MON.A2H
D911- 60       3710        RTS
               3720 *--------------------------------


               SAVE S.D912
               1010 *--------------------------------
               1020 *      "RUN" COMMAND
               1030 *--------------------------------
D912- 08       1040 RUN    PHP          SAVE STATUS WHILE SUBTRACTING
D913- C6 76    1050        DEC CURLIN+1 IF WAS $FF (MEANING DIRECT MODE)
               1060 *                   MAKE IT "RUNNING MODE"
D915- 28       1070        PLP          GET STATUS AGAIN (FROM CHRGET)
D916- D0 03    1080        BNE .1       PROBABLY A LINE NUMBER
D918- 4C 65 D6 1090        JMP SETPTRS  START AT BEGINNING OF PROGRAM
D91B- 20 6C D6 1100 .1     JSR CLEARC   CLEAR VARIABLES
D91E- 4C 35 D9 1110        JMP GO.TO.LINE   JOIN GOSUB STATEMENT
               1120 *--------------------------------
               1130 *      "GOSUB" STATEMENT
               1140 *
               1150 *      LEAVES 7 BYTES ON STACK:
               1160 *      2 -- RETURN ADDRESS (NEWSTT)
               1170 *      2 -- TXTPTR
               1180 *      2 -- LINE #
               1190 *      1 -- GOSUB TOKEN ($B0)
               1200 *--------------------------------
D921- A9 03    1210 GOSUB  LDA #3       BE SURE ENOUGH ROOM ON STACK
D923- 20 D6 D3 1220        JSR CHKMEM
D926- A5 B9    1230        LDA TXTPTR+1
D928- 48       1240        PHA
D929- A5 B8    1250        LDA TXTPTR
D92B- 48       1260        PHA
D92C- A5 76    1270        LDA CURLIN+1
D92E- 48       1280        PHA
D92F- A5 75    1290        LDA CURLIN
D931- 48       1300        PHA
D932- A9 B0    1310        LDA #TOKEN.GOSUB
D934- 48       1320        PHA
               1330 GO.TO.LINE
D935- 20 B7 00 1340        JSR CHRGOT
D938- 20 3E D9 1350        JSR GOTO
D93B- 4C D2 D7 1360        JMP NEWSTT
               1370 *--------------------------------
               1380 *      "GOTO" STATEMENT
               1390 *      ALSO USED BY "RUN" AND "GOSUB"
               1400 *--------------------------------
D93E- 20 0C DA 1410 GOTO   JSR LINGET   GET GOTO LINE
D941- 20 A6 D9 1420        JSR REMN     POINT Y TO EOL
D944- A5 76    1430        LDA CURLIN+1  IS CURRENT PAGE < GOTO PAGE?
D946- C5 51    1440        CMP LINNUM+1
D948- B0 0B    1450        BCS .1       SEARCH FROM PROG START IF NOT
D94A- 98       1460        TYA          OTHERWISE SEARCH FROM NEXT LINE
D94B- 38       1470        SEC
D94C- 65 B8    1480        ADC TXTPTR
D94E- A6 B9    1490        LDX TXTPTR+1
D950- 90 07    1500        BCC .2
D952- E8       1510        INX
D953- B0 04    1520        BCS .2
D955- A5 67    1530 .1     LDA TXTTAB   GET PROGRAM BEGINNING
D957- A6 68    1540        LDX TXTTAB+1
D959- 20 1E D6 1550 .2     JSR FL1      SEARCH FOR GOTO LINE
D95C- 90 1E    1560        BCC UNDERR   ERROR IF NOT THERE
D95E- A5 9B    1570        LDA LOWTR    TXTPTR = START OF THE DESTINATION LINE
D960- E9 01    1580        SBC #1
D962- 85 B8    1590        STA TXTPTR
D964- A5 9C    1600        LDA LOWTR+1
D966- E9 00    1610        SBC #0
D968- 85 B9    1620        STA TXTPTR+1
D96A- 60       1630 RTS.5  RTS          RETURN TO NEWSTT OR GOSUB
               1640 *--------------------------------
               1650 *      "POP" AND "RETURN" STATEMENTS
               1660 *--------------------------------
D96B- D0 FD    1670 POP    BNE RTS.5
D96D- A9 FF    1680        LDA #$FF
D96F- 85 85    1690        STA FORPNT   <<< BUG: SHOULD BE FORPNT+1 >>>
               1700 *  <<< SEE "ALL ABOUT APPLESOFT", PAGES 100,101 >>>
D971- 20 65 D3 1710        JSR GTFORPNT  TO CANCEL FOR/NEXT IN SUB
D974- 9A       1720        TXS
D975- C9 B0    1730        CMP #TOKEN.GOSUB  LAST GOSUB FOUND?
D977- F0 0B    1740        BEQ RETURN
D979- A2 16    1750        LDX #ERR.NOGOSUB
D97B- 2C       1760        .HS 2C       FAKE: BIT xxxx skips ahead to JMP ERROR
D97C- A2 5A    1770 UNDERR LDX #ERR.UNDEFSTAT
D97E- 4C 12 D4 1780        JMP ERROR
               1790 *--------------------------------
D981- 4C C9 DE 1800 SYNERR.2 JMP SYNERR
               1810 *--------------------------------
D984- 68       1820 RETURN PLA          DISCARD GOSUB TOKEN
D985- 68       1830        PLA
D986- C0 42    1840        CPY #TOKEN.POP*2
D988- F0 3B    1850        BEQ PULL3    BRANCH IF A POP
D98A- 85 75    1860        STA CURLIN   PULL LINE #
D98C- 68       1870        PLA
D98D- 85 76    1880        STA CURLIN+1
D98F- 68       1890        PLA
D990- 85 B8    1900        STA TXTPTR   PULL TXTPTR
D992- 68       1910        PLA
D993- 85 B9    1920        STA TXTPTR+1
               1930 *--------------------------------
               1940 *      "DATA" STATEMENT
               1950 *      EXECUTED BY SKIPPING TO NEXT COLON OR EOL
               1960 *--------------------------------
D995- 20 A3 D9 1970 DATA   JSR DATAN    MOVE TO NEXT STATEMENT
               1980 *--------------------------------
               1990 *      ADD (Y) TO TXTPTR
               2000 *--------------------------------
D998- 98       2010 ADDON  TYA
D999- 18       2020        CLC
D99A- 65 B8    2030        ADC TXTPTR
D99C- 85 B8    2040        STA TXTPTR
D99E- 90 02    2050        BCC .1
D9A0- E6 B9    2060        INC TXTPTR+1
               2070 .1
D9A2- 60       2080 RTS.6  RTS
               2090 *--------------------------------
               2100 *      SCAN AHEAD TO NEXT ":" OR EOL
               2110 *--------------------------------
D9A3- A2 3A    2120 DATAN  LDX #':'     GET OFFSET IN Y TO EOL OR ":"
D9A5- 2C       2130        .HS 2C       FAKE
               2140 *--------------------------------
D9A6- A2 00    2150 REMN   LDX #0       TO EOL ONLY
D9A8- 86 0D    2160        STX CHARAC
D9AA- A0 00    2170        LDY #0
D9AC- 84 0E    2180        STY ENDCHR
D9AE- A5 0E    2190 .1     LDA ENDCHR   TRICK TO COUNT QUOTE PARITY
D9B0- A6 0D    2200        LDX CHARAC
D9B2- 85 0D    2210        STA CHARAC
D9B4- 86 0E    2220        STX ENDCHR
D9B6- B1 B8    2230 .2     LDA (TXTPTR),Y
D9B8- F0 E8    2240        BEQ RTS.6    END OF LINE
D9BA- C5 0E    2250        CMP ENDCHR
D9BC- F0 E4    2260        BEQ RTS.6    COLON IF LOOKING FOR COLONS
D9BE- C8       2270        INY
D9BF- C9 22    2280        CMP #'"'
D9C1- D0 F3    2290        BNE .2
D9C3- F0 E9    2300        BEQ .1       ...ALWAYS
               2310 *--------------------------------
D9C5- 68       2320 PULL3  PLA
D9C6- 68       2330        PLA
D9C7- 68       2340        PLA
D9C8- 60       2350        RTS
               2360 *--------------------------------
               2370 *      "IF" STATEMENT
               2380 *--------------------------------
D9C9- 20 7B DD 2390 IF     JSR FRMEVL
D9CC- 20 B7 00 2400        JSR CHRGOT
D9CF- C9 AB    2410        CMP #TOKEN.GOTO
D9D1- F0 05    2420        BEQ .1
D9D3- A9 C4    2430        LDA #TOKEN.THEN
D9D5- 20 C0 DE 2440        JSR SYNCHR
D9D8- A5 9D    2450 .1     LDA FAC      CONDITION TRUE OR FALSE?
D9DA- D0 05    2460        BNE IF.TRUE  BRANCH IF TRUE
               2470 *--------------------------------
               2480 *      "REM" STATEMENT, OR FALSE "IF" STATEMENT
               2490 *--------------------------------
D9DC- 20 A6 D9 2500 REM    JSR REMN     SKIP REST OF LINE
D9DF- F0 B7    2510        BEQ ADDON    ...ALWAYS
               2520 *--------------------------------
               2530 IF.TRUE
D9E1- 20 B7 00 2540        JSR CHRGOT   COMMAND OR NUMBER?
D9E4- B0 03    2550        BCS .1       COMMAND
D9E6- 4C 3E D9 2560        JMP GOTO     NUMBER
D9E9- 4C 28 D8 2570 .1     JMP EXECUTE.STATEMENT
               2580 *--------------------------------
               2590 *      "ON" STATEMENT
               2600 *
               2610 *      ON <EXP> GOTO <LIST>
               2620 *      ON <EXP> GOSUB <LIST>
               2630 *--------------------------------
D9EC- 20 F8 E6 2640 ONGOTO JSR GETBYT   EVALUATE <EXP>, AS BYTE IN FAC+4
D9EF- 48       2650        PHA          SAVE NEXT CHAR ON STACK
D9F0- C9 B0    2660        CMP #TOKEN.GOSUB
D9F2- F0 04    2670        BEQ ON.2
D9F4- C9 AB    2680 ON.1   CMP #TOKEN.GOTO
D9F6- D0 89    2690        BNE SYNERR.2
D9F8- C6 A1    2700 ON.2   DEC FAC+4    COUNTED TO RIGHT ONE YET?
D9FA- D0 04    2710        BNE .3       NO, KEEP LOOKING
D9FC- 68       2720        PLA          YES, RETRIEVE CMD
D9FD- 4C 2A D8 2730        JMP EXECUTE.STATEMENT.1   AND GO.
DA00- 20 B1 00 2740 .3     JSR CHRGET   PRIME CONVERT SUBROUTINE
DA03- 20 0C DA 2750        JSR LINGET   CONVERT LINE #
DA06- C9 2C    2760        CMP #','     TERMINATE WITH COMMA?
DA08- F0 EE    2770        BEQ ON.2     YES
DA0A- 68       2780        PLA          NO, END OF LIST, SO IGNORE
DA0B- 60       2790 RTS.7  RTS
               2800 *--------------------------------
               2810 *      CONVERT LINE NUMBER
               2820 *--------------------------------
DA0C- A2 00    2830 LINGET LDX #0       ASC # TO HEX ADDRESS
DA0E- 86 50    2840        STX LINNUM   IN LINNUM.
DA10- 86 51    2850        STX LINNUM+1
DA12- B0 F7    2860 .1     BCS RTS.7    NOT A DIGIT
DA14- E9 2F    2870        SBC #'0'-1   CONVERT DIGIT TO BINARY
DA16- 85 0D    2880        STA CHARAC   SAVE THE DIGIT
DA18- A5 51    2890        LDA LINNUM+1 CHECK RANGE
DA1A- 85 5E    2900        STA INDEX
DA1C- C9 19    2910        CMP /6400    LINE # TOO LARGE?
DA1E- B0 D4    2920        BCS ON.1     YES, > 63999, GO INDIRECTLY TO
               2930 *                   "SYNTAX ERROR".
               2940 *<<<<<DANGEROUS CODE>>>>>
               2950 *      NOTE THAT IF (A) = $AB ON THE LINE ABOVE,
               2960 *      ON.1 WILL COMPARE = AND CAUSE A CATASTROPHIC
               2970 *      JUMP TO $22D9 (FOR GOTO), OR OTHER LOCATIONS
               2980 *      FOR OTHER CALLS TO LINGET.
               2990 *
               3000 *      YOU CAN SEE THIS IS YOU FIRST PUT "BRK" IN $22D9,
               3010 *      THEN TYPE "GO TO 437761".
               3020 *
               3030 *      ANY VALUE FROM 437760 THROUGH 440319 WILL CAUSE
               3040 *      THE PROBLEM.  ($AB00 - $ABFF)
               3045 * See 437760 to 440319 on Wikipedia 100000 (number)
               3050 *<<<<<DANGEROUS CODE>>>>>
DA20- A5 50    3060        LDA LINNUM   MULTIPLY BY TEN
DA22- 0A       3070        ASL
DA23- 26 5E    3080        ROL INDEX
DA25- 0A       3090        ASL
DA26- 26 5E    3100        ROL INDEX
DA28- 65 50    3110        ADC LINNUM
DA2A- 85 50    3120        STA LINNUM
DA2C- A5 5E    3130        LDA INDEX
DA2E- 65 51    3140        ADC LINNUM+1
DA30- 85 51    3150        STA LINNUM+1
DA32- 06 50    3160        ASL LINNUM
DA34- 26 51    3170        ROL LINNUM+1
DA36- A5 50    3180        LDA LINNUM
DA38- 65 0D    3190        ADC CHARAC   ADD DIGIT
DA3A- 85 50    3200        STA LINNUM
DA3C- 90 02    3210        BCC .2
DA3E- E6 51    3220        INC LINNUM+1
DA40- 20 B1 00 3230 .2     JSR CHRGET   GET NEXT CHAR
DA43- 4C 12 DA 3240        JMP .1       MORE CONVERTING
               3250 *--------------------------------
               3260 *      "LET" STATEMENT
               3270 *
               3280 *      LET <VAR> = <EXP>
               3290 *      <VAR> = <EXP>
               3300 *--------------------------------
DA46- 20 E3 DF 3310 LET    JSR PTRGET   GET <VAR>
DA49- 85 85    3320        STA FORPNT
DA4B- 84 86    3330        STY FORPNT+1
DA4D- A9 D0    3340        LDA #TOKEN.EQUAL
DA4F- 20 C0 DE 3350        JSR SYNCHR
DA52- A5 12    3360        LDA VALTYP+1      SAVE VARIABLE TYPE
DA54- 48       3370        PHA
DA55- A5 11    3380        LDA VALTYP
DA57- 48       3390        PHA
DA58- 20 7B DD 3400        JSR FRMEVL   EVALUATE <EXP>
DA5B- 68       3410        PLA
DA5C- 2A       3420        ROL
DA5D- 20 6D DD 3430        JSR CHKVAL
DA60- D0 18    3440        BNE LET.STRING
DA62- 68       3450        PLA
               3460 *--------------------------------
DA63- 10 12    3470 LET2   BPL .1       REAL VARIABLE
DA65- 20 72 EB 3480        JSR ROUND.FAC     INTEGER VAR: ROUND TO 32 BITS
DA68- 20 0C E1 3490        JSR AYINT         TRUNCATE TO 16-BITS
DA6B- A0 00    3500        LDY #0
DA6D- A5 A0    3510        LDA FAC+3
DA6F- 91 85    3520        STA (FORPNT),Y
DA71- C8       3530        INY
DA72- A5 A1    3540        LDA FAC+4
DA74- 91 85    3550        STA (FORPNT),Y
DA76- 60       3560        RTS
               3570 *--------------------------------
               3580 *      REAL VARIABLE = EXPRESSION
               3590 *--------------------------------
DA77- 4C 27 EB 3600 .1     JMP SETFOR
               3610 *--------------------------------
               3620 LET.STRING
DA7A- 68       3630        PLA
               3640 *--------------------------------
               3650 *      INSTALL STRING, DESCRIPTOR ADDRESS IS AT FAC+3,4
               3660 *--------------------------------
DA7B- A0 02    3670 PUTSTR LDY #2       STRING DATA ALREADY IN STRING AREA?
DA7D- B1 A0    3680        LDA (FAC+3),Y      (STRING AREA IS BTWN FRETOP
DA7F- C5 70    3690        CMP FRETOP+1           HIMEM)
DA81- 90 17    3700        BCC .2       YES, DATA ALREADY UP THERE
DA83- D0 07    3710        BNE .1       NO
DA85- 88       3720        DEY          MAYBE, TEST LOW BYTE OF POINTER
DA86- B1 A0    3730        LDA (FAC+3),Y
DA88- C5 6F    3740        CMP FRETOP
DA8A- 90 0E    3750        BCC .2       YES, ALREADY THERE
DA8C- A4 A1    3760 .1     LDY FAC+4   NO. DESCRIPTOR ALREADY AMONG VARIABLES?
DA8E- C4 6A    3770        CPY VARTAB+1
DA90- 90 08    3780        BCC .2       NO
DA92- D0 0D    3790        BNE .3       YES
DA94- A5 A0    3800        LDA FAC+3    MAYBE, COMPARE LO-BYTE
DA96- C5 69    3810        CMP VARTAB
DA98- B0 07    3820        BCS .3       YES, DESCRIPTOR IS AMONG VARIABLES
DA9A- A5 A0    3830 .2     LDA FAC+3    EITHER STRING ALREADY ON TOP, OR
DA9C- A4 A1    3840        LDY FAC+4    DESCRIPTOR IS NOT A VARIABLE
DA9E- 4C B7 DA 3850        JMP .4       SO JUST STORE THE DESCRIPTOR
               3860 *--------------------------------
               3870 *      STRING NOT YET IN STRING AREA,
               3880 *      AND DESCRIPTOR IS A VARIABLE
               3890 *--------------------------------
DAA1- A0 00    3900 .3     LDY #0       POINT AT LENGTH IN DESCRIPTOR
DAA3- B1 A0    3910        LDA (FAC+3),Y GET LENGTH
DAA5- 20 D5 E3 3920        JSR STRINI   MAKE A STRING THAT LONG UP ABOVE
DAA8- A5 8C    3930        LDA DSCPTR   SET UP SOURCE PNTR FOR MONINS
DAAA- A4 8D    3940        LDY DSCPTR+1
DAAC- 85 AB    3950        STA STRNG1
DAAE- 84 AC    3960        STY STRNG1+1
DAB0- 20 D4 E5 3970        JSR MOVINS   MOVE STRING DATA TO NEW AREA
DAB3- A9 9D    3980        LDA #FAC     ADDRESS OF DESCRIPTOR IS IN FAC
DAB5- A0 00    3990        LDY /FAC
DAB7- 85 8C    4000 .4     STA DSCPTR
DAB9- 84 8D    4010        STY DSCPTR+1
DABB- 20 35 E6 4020        JSR FRETMS   DISCARD DESCRIPTOR IF 'TWAS TEMPORARY
DABE- A0 00    4030        LDY #0       COPY STRING DESCRIPTOR
DAC0- B1 8C    4040        LDA (DSCPTR),Y
DAC2- 91 85    4050        STA (FORPNT),Y
DAC4- C8       4060        INY
DAC5- B1 8C    4070        LDA (DSCPTR),Y
DAC7- 91 85    4080        STA (FORPNT),Y
DAC9- C8       4090        INY
DACA- B1 8C    4100        LDA (DSCPTR),Y
DACC- 91 85    4110        STA (FORPNT),Y
DACE- 60       4120        RTS


               SAVE S.DACF
               1010 *--------------------------------
               1020 PR.STRING
DACF- 20 3D DB 1030        JSR STRPRT
DAD2- 20 B7 00 1040        JSR CHRGOT
               1050 *--------------------------------
               1060 *      "PRINT" STATEMENT
               1070 *--------------------------------
DAD5- F0 24    1080 PRINT  BEQ CRDO     NO MORE LIST, PRINT <RETURN>
               1090 *--------------------------------
DAD7- F0 29    1100 PRINT2 BEQ RTS.8    NO MORE LIST, DON'T PRINT <RETURN>
DAD9- C9 C0    1110        CMP #TOKEN.TAB
DADB- F0 39    1120        BEQ PR.TAB.OR.SPC     C=1 FOR TAB(
DADD- C9 C3    1130        CMP #TOKEN.SPC
DADF- 18       1140        CLC
DAE0- F0 34    1150        BEQ PR.TAB.OR.SPC     C=0 FOR SPC(
DAE2- C9 2C    1160        CMP #','
DAE4- 18       1170        CLC               <<< NO PURPOSE TO THIS >>>
DAE5- F0 1C    1180        BEQ PR.COMMA
DAE7- C9 3B    1190        CMP #';'
DAE9- F0 44    1200        BEQ PR.NEXT.CHAR
DAEB- 20 7B DD 1210        JSR FRMEVL        EVALUATE EXPRESSION
DAEE- 24 11    1220        BIT VALTYP        STRING OR FP VALUE?
DAF0- 30 DD    1230        BMI PR.STRING     STRING
DAF2- 20 34 ED 1240        JSR FOUT          FP: CONVERT INTO BUFFER
DAF5- 20 E7 E3 1250        JSR STRLIT            MAKE BUFFER INTO STRING
DAF8- 4C CF DA 1260        JMP PR.STRING         PRINT THE STRING
               1270 *--------------------------------
DAFB- A9 0D    1280 CRDO   LDA #$0D     PRINT <RETURN>
DAFD- 20 5C DB 1290        JSR OUTDO
DB00- 49 FF    1300 NEGATE EOR #$FF     <<< WHY??? >>>
DB02- 60       1310 RTS.8  RTS
               1320 *--------------------------------
               1330 *      TAB TO NEXT COMMA COLUMN
               1340 *      <<< NOTE BUG IF WIDTH OF WINDOW LESS THAN 33 >>>
               1350 PR.COMMA
DB03- A5 24    1360        LDA MON.CH
DB05- C9 18    1370        CMP #24      <<< BUG:  IT SHOULD BE 32 >>>
DB07- 90 05    1380        BCC .1       NEXT COLUMN, SAME LINE
DB09- 20 FB DA 1390        JSR CRDO     FIRST COLUMN, NEXT LINT
DB0C- D0 21    1400        BNE PR.NEXT.CHAR  ...ALWAYS
DB0E- 69 10    1410 .1     ADC #16
DB10- 29 F0    1420        AND #$F0     ROUND TO 16 OR 32
DB12- 85 24    1430        STA MON.CH
DB14- 90 19    1440        BCC PR.NEXT.CHAR  ...ALWAYS
               1450 *--------------------------------
               1460 PR.TAB.OR.SPC
DB16- 08       1470        PHP          C=0 FOR SPC(, C=1 FOR TAB(
DB17- 20 F5 E6 1480        JSR GTBYTC   GET VALUE
DB1A- C9 29    1490        CMP #')'     TRAILING PARENTHESIS
DB1C- F0 03    1500        BEQ .1       GOOD
DB1E- 4C C9 DE 1510        JMP SYNERR   NO, SYNTAX ERROR
DB21- 28       1520 .1     PLP          TAB( OR SPC(
DB22- 90 07    1530        BCC .2       SPC(
DB24- CA       1540        DEX          TAB(
DB25- 8A       1550        TXA          CALCULATE SPACES NEEDED FOR TAB(
DB26- E5 24    1560        SBC MON.CH
DB28- 90 05    1570        BCC PR.NEXT.CHAR  ALREADY PAST THAT COLUMN
DB2A- AA       1580        TAX          NOW DO A SPC( TO THE SPECIFIED COLUMN
DB2B- E8       1590 .2     INX
DB2C- CA       1600 NXSPC  DEX
DB2D- D0 06    1610        BNE DOSPC    MORE SPACES TO PRINT
               1620 *--------------------------------
               1630 PR.NEXT.CHAR
DB2F- 20 B1 00 1640        JSR CHRGET
DB32- 4C D7 DA 1650        JMP PRINT2   CONTINUE PARSING PRINT LIST
               1660 *--------------------------------
DB35- 20 57 DB 1670 DOSPC  JSR OUTSP
DB38- D0 F2    1680        BNE NXSPC    ...ALWAYS
               1690 *--------------------------------
               1700 *      PRINT STRING AT (Y,A)
DB3A- 20 E7 E3 1710 STROUT JSR STRLIT   MAKE (Y,A) PRINTABLE
               1720 *--------------------------------
               1730 *      PRINT STRING AT (FACMO,FACLO)
               1740 *--------------------------------
DB3D- 20 00 E6 1750 STRPRT JSR FREFAC   GET ADDRESS INTO INDEX, (A)=LENGTH
DB40- AA       1760        TAX          USE X-REG FOR COUNTER
DB41- A0 00    1770        LDY #0       USE Y-REG FOR SCANNER
DB43- E8       1780        INX
DB44- CA       1790 .1     DEX
DB45- F0 BB    1800        BEQ RTS.8    FINISHED
DB47- B1 5E    1810        LDA (INDEX),Y     NEXT CHAR FROM STRING
DB49- 20 5C DB 1820        JSR OUTDO    PRINT THE CHAR
DB4C- C8       1830        INY
               1840 *                   <<< NEXT THREE LINES ARE USELESS >>>
DB4D- C9 0D    1850        CMP #$0D     WAS IT <RETURN>?
DB4F- D0 F3    1860        BNE .1       NO
DB51- 20 00 DB 1870        JSR NEGATE   EOR #$FF WOULD DO IT, BUT WHY?
               1880 *                   <<< ABOVE THREE LINES ARE USELESS >>>
DB54- 4C 44 DB 1890        JMP .1
               1900 *--------------------------------
DB57- A9 20    1910 OUTSP  LDA #' '     PRINT A SPACE
DB59- 2C       1920        .HS 2C       SKIP OVER NEXT LINE
DB5A- A9 3F    1930 OUTQUES LDA #'?'    PRINT QUESTION MARK
               1940 *--------------------------------
               1950 *      PRINT CHAR FROM (A)
               1960 *
               1970 *      NOTE: POKE 243,32 ($20 IN $F3) WILL CONVERT
               1980 *      OUTPUT TO LOWER CASE.  THIS CAN BE CANCELLED
               1990 *      BY NORMAL, INVERSE, OR FLASH OR POKE 243,0.
               2000 *--------------------------------
DB5C- 09 80    2010 OUTDO  ORA #$80     PRINT (A)
DB5E- C9 A0    2020        CMP #$A0     CONTROL CHR?
DB60- 90 02    2030        BCC .1       SKIP IF SO
DB62- 05 F3    2040        ORA FLASH.BIT   =$40 FOR FLASH, ELSE $00
DB64- 20 ED FD 2050 .1     JSR MON.COUT "AND"S WITH $3F (INVERSE), $7F (FLASH)
DB67- 29 7F    2060        AND #$7F
DB69- 48       2070        PHA
DB6A- A5 F1    2080        LDA SPEEDZ   COMPLEMENT OF SPEED #
DB6C- 20 A8 FC 2090        JSR MON.WAIT   SO SPEED=255 BECOMES (A)=1
DB6F- 68       2100        PLA
DB70- 60       2110        RTS
               2120 *--------------------------------
               2130 *      INPUT CONVERSION ERROR:  ILLEGAL CHARACTER
               2140 *      IN NUMERIC FIELD.  MUST DISTINGUISH
               2150 *      BETWEEN INPUT, READ, AND GET
               2160 *--------------------------------
               2170 INPUTERR
DB71- A5 15    2180        LDA INPUTFLG
DB73- F0 12    2190        BEQ RESPERR  TAKEN IF INPUT
DB75- 30 04    2200        BMI READERR  TAKEN IF READ
DB77- A0 FF    2210        LDY #$FF     FROM A GET
DB79- D0 04    2220        BNE ERLIN    ...ALWAYS
               2230 *--------------------------------
               2240 READERR
DB7B- A5 7B    2250        LDA DATLIN   TELL WHERE THE "DATA" IS, RATHER
DB7D- A4 7C    2260        LDY DATLIN+1    THAN THE "READ"
               2270 *--------------------------------
DB7F- 85 75    2280 ERLIN  STA CURLIN
DB81- 84 76    2290        STY CURLIN+1
DB83- 4C C9 DE 2300        JMP SYNERR
               2310 *--------------------------------
DB86- 68       2320 INPERR PLA
               2330 *--------------------------------
               2340 RESPERR
DB87- 24 D8    2350        BIT ERRFLG   "ON ERR" TURNED ON?
DB89- 10 05    2360        BPL .1       NO, GIVE REENTRY A TRY
DB8B- A2 FE    2370        LDX #254     ERROR CODE = 254
DB8D- 4C E9 F2 2380        JMP HANDLERR
DB90- A9 EF    2390 .1     LDA #ERR.REENTRY "?REENTER"
DB92- A0 DC    2400        LDY /ERR.REENTRY
DB94- 20 3A DB 2410        JSR STROUT
DB97- A5 79    2420        LDA OLDTEXT  RE-EXECUTE THE WHOLE INPUT STATEMENT
DB99- A4 7A    2430        LDY OLDTEXT+1
DB9B- 85 B8    2440        STA TXTPTR
DB9D- 84 B9    2450        STY TXTPTR+1
DB9F- 60       2460        RTS
               2470 *--------------------------------
               2480 *      "GET" STATEMENT
               2490 *--------------------------------
DBA0- 20 06 E3 2500 GET    JSR ERRDIR   ILLEGAL IF IN DIRECT MODE
DBA3- A2 01    2510        LDX #INPUT.BUFFER+1    SIMULATE INPUT
DBA5- A0 02    2520        LDY /INPUT.BUFFER+1
DBA7- A9 00    2530        LDA #0
DBA9- 8D 01 02 2540        STA INPUT.BUFFER+1
DBAC- A9 40    2550        LDA #$40     SET UP INPUTFLG
DBAE- 20 EB DB 2560        JSR PROCESS.INPUT.LIST  <<< CAN SAVE 1 BYTE HERE>>>
DBB1- 60       2570        RTS               <<<BY "JMP PROCESS.INPUT.LIST">>>
               2580 *--------------------------------
               2590 *      "INPUT" STATEMENT
               2600 *--------------------------------
DBB2- C9 22    2610 INPUT  CMP #'"'     CHECK FOR OPTIONAL PROMPT STRING
DBB4- D0 0E    2620        BNE .1       NO, PRINT "?" PROMPT
DBB6- 20 81 DE 2630        JSR STRTXT   MAKE A PRINTABLE STRING OUT OF IT
DBB9- A9 3B    2640        LDA #';'     MUST HAVE ; NOW
DBBB- 20 C0 DE 2650        JSR SYNCHR
DBBE- 20 3D DB 2660        JSR STRPRT   PRINT THE STRING
DBC1- 4C C7 DB 2670        JMP .2
DBC4- 20 5A DB 2680 .1     JSR OUTQUES  NO STRING, PRINT "?"
DBC7- 20 06 E3 2690 .2     JSR ERRDIR   ILLEGAL IF IN DIRECT MODE
DBCA- A9 2C    2700        LDA #','     PRIME THE BUFFER
DBCC- 8D FF 01 2710        STA INPUT.BUFFER-1
DBCF- 20 2C D5 2720        JSR INLIN
DBD2- AD 00 02 2730        LDA INPUT.BUFFER
DBD5- C9 03    2740        CMP #$03     CONTROL C?
DBD7- D0 10    2750        BNE INPUT.FLAG.ZERO   NO
DBD9- 4C 63 D8 2760        JMP CONTROL.C.TYPED
               2770 *--------------------------------
DBDC- 20 5A DB 2780 NXIN   JSR OUTQUES  PRINT "?"
DBDF- 4C 2C D5 2790        JMP INLIN
               2800 *--------------------------------
               2810 *      "READ" STATEMENT
               2820 *--------------------------------
DBE2- A6 7D    2830 READ   LDX DATPTR   Y,X POINTS AT NEXT DATA STATEMENT
DBE4- A4 7E    2840        LDY DATPTR+1
DBE6- A9 98    2850        LDA #$98     SET INPUTFLG = $98
DBE8- 2C       2860        .HS 2C       TRICK TO PROCESS.INPUT.LIST
               2870 *--------------------------------
               2880 INPUT.FLAG.ZERO
DBE9- A9 00    2890        LDA #0       SET INPUTFLG = $00
               2900 *--------------------------------
               2910 *      PROCESS INPUT LIST
               2920 *
               2930 *      (Y,X) IS ADDRESS OF INPUT DATA STRING
               2940 *      (A) = VALUE FOR INPUTFLG:  $00 FOR INPUT
               2950 *                                 $40 FOR GET
               2960 *                                 $98 FOR READ
               2970 *--------------------------------
               2980 PROCESS.INPUT.LIST
DBEB- 85 15    2990        STA INPUTFLG
DBED- 86 7F    3000        STX INPTR    ADDRESS OF INPUT STRING
DBEF- 84 80    3010        STY INPTR+1
               3020 *--------------------------------
               3030 PROCESS.INPUT.ITEM
DBF1- 20 E3 DF 3040        JSR PTRGET   GET ADDRESS OF VARIABLE
DBF4- 85 85    3050        STA FORPNT
DBF6- 84 86    3060        STY FORPNT+1
DBF8- A5 B8    3070        LDA TXTPTR   SAVE CURRENT TXTPTR,
DBFA- A4 B9    3080        LDY TXTPTR+1      WHICH POINTS INTO PROGRAM
DBFC- 85 87    3090        STA TXPSV
DBFE- 84 88    3100        STY TXPSV+1
DC00- A6 7F    3110        LDX INPTR    SET TXTPTR TO POINT AT INPUT BUFFER
DC02- A4 80    3120        LDY INPTR+1       OR "DATA" LINE
DC04- 86 B8    3130        STX TXTPTR
DC06- 84 B9    3140        STY TXTPTR+1
DC08- 20 B7 00 3150        JSR CHRGOT   GET CHAR AT PNTR
DC0B- D0 1E    3160        BNE INSTART  NOT END OF LINE OR COLON
DC0D- 24 15    3170        BIT INPUTFLG      DOING A "GET"?
DC0F- 50 0E    3180        BVC .1            NO
DC11- 20 0C FD 3190        JSR MON.RDKEY     YES, GET CHAR
DC14- 29 7F    3200        AND #$7F
DC16- 8D 00 02 3210        STA INPUT.BUFFER
DC19- A2 FF    3220        LDX #INPUT.BUFFER-1
DC1B- A0 01    3230        LDY /INPUT.BUFFER-1
DC1D- D0 08    3240        BNE .2       ...ALWAYS
               3250 *--------------------------------
DC1F- 30 7F    3260 .1     BMI FINDATA  DOING A "READ"
DC21- 20 5A DB 3270        JSR OUTQUES  DOING AN "INPUT", PRINT "?"
DC24- 20 DC DB 3280        JSR NXIN     PRINT ANOTHER "?", AND INPUT A LINE
DC27- 86 B8    3290 .2     STX TXTPTR
DC29- 84 B9    3300        STY TXTPTR+1
               3310 *--------------------------------
               3320 INSTART
DC2B- 20 B1 00 3330        JSR CHRGET   GET NEXT INPUT CHAR
DC2E- 24 11    3340        BIT VALTYP   STRING OR NUMERIC?
DC30- 10 31    3350        BPL .5       NUMERIC
DC32- 24 15    3360        BIT INPUTFLG STRING -- NOW WHAT INPUT TYPE?
DC34- 50 09    3370        BVC .1       NOT A "GET"
DC36- E8       3380        INX          "GET"
DC37- 86 B8    3390        STX TXTPTR
DC39- A9 00    3400        LDA #0
DC3B- 85 0D    3410        STA CHARAC   NO OTHER TERMINATORS THAN $00
DC3D- F0 0C    3420        BEQ .2       ...ALWAYS
               3430 *--------------------------------
DC3F- 85 0D    3440 .1     STA CHARAC
DC41- C9 22    3450        CMP #'"'     TERMINATE ON $00 OR QUOTE
DC43- F0 07    3460        BEQ .3
DC45- A9 3A    3470        LDA #':'     TERMINATE ON $00, COLON, OR COMMA
DC47- 85 0D    3480        STA CHARAC
DC49- A9 2C    3490        LDA #','
DC4B- 18       3500 .2     CLC
DC4C- 85 0E    3510 .3     STA ENDCHR
DC4E- A5 B8    3520        LDA TXTPTR
DC50- A4 B9    3530        LDY TXTPTR+1
DC52- 69 00    3540        ADC #0       SKIP OVER QUOTATION MARK, IF
DC54- 90 01    3550        BCC .4           THERE WAS ONE
DC56- C8       3560        INY
DC57- 20 ED E3 3570 .4     JSR STRLT2   BUILD STRING STARTING AT (Y,A)
               3580 *                TERMINATED BY $00, (CHARAC), OR (ENDCHR)
DC5A- 20 3D E7 3590        JSR POINT    SET TXTPTR TO POINT AT STRING
DC5D- 20 7B DA 3600        JSR PUTSTR   STORE STRING IN VARIABLE
DC60- 4C 72 DC 3610        JMP INPUT.MORE
               3620 *--------------------------------
DC63- 48       3630 .5     PHA
DC64- AD 00 02 3640        LDA INPUT.BUFFER  ANYTHING IN BUFFER?
DC67- F0 30    3650        BEQ INPFIN        NO, SEE IF READ OR INPUT
               3660 *--------------------------------
               3670 INPUT.DATA
DC69- 68       3680        PLA               "READ"
DC6A- 20 4A EC 3690        JSR FIN      GET FP NUMBER AT TXTPTR
DC6D- A5 12    3700        LDA VALTYP+1
DC6F- 20 63 DA 3710        JSR LET2     STORE RESULT IN VARIABLE
               3720 *--------------------------------
               3730 INPUT.MORE
DC72- 20 B7 00 3740        JSR CHRGOT
DC75- F0 07    3750        BEQ .1       END OF LINE OR COLON
DC77- C9 2C    3760        CMP #','     COMMA IN INPUT?
DC79- F0 03    3770        BEQ .1       YES
DC7B- 4C 71 DB 3780        JMP INPUTERR  NOTHING ELSE WILL DO
DC7E- A5 B8    3790 .1     LDA TXTPTR   SAVE POSITION IN INPUT BUFFER
DC80- A4 B9    3800        LDY TXTPTR+1
DC82- 85 7F    3810        STA INPTR
DC84- 84 80    3820        STY INPTR+1
DC86- A5 87    3830        LDA TXPSV    RESTORE PROGRAM POINTER
DC88- A4 88    3840        LDY TXPSV+1
DC8A- 85 B8    3850        STA TXTPTR
DC8C- 84 B9    3860        STY TXTPTR+1
DC8E- 20 B7 00 3870        JSR CHRGOT   NEXT CHAR FROM PROGRAM
DC91- F0 33    3880        BEQ INPDONE  END OF STATEMENT
DC93- 20 BE DE 3890        JSR CHKCOM   BETTER BE A COMMA THEN
DC96- 4C F1 DB 3900        JMP PROCESS.INPUT.ITEM
               3910 *--------------------------------
DC99- A5 15    3920 INPFIN LDA INPUTFLG      "INPUT" OR "READ"
DC9B- D0 CC    3930        BNE INPUT.DATA    "READ"
DC9D- 4C 86 DB 3940        JMP INPERR
               3950 *--------------------------------
               3960 FINDATA
DCA0- 20 A3 D9 3970        JSR DATAN    GET OFFSET TO NEXT COLON OR EOL
DCA3- C8       3980        INY          TO FIRST CHAR OF NEXT LINE
DCA4- AA       3990        TAX          WHICH:  EOL OR COLON?
DCA5- D0 12    4000        BNE .1       COLON
DCA7- A2 2A    4010        LDX #ERR.NODATA   EOL: MIGHT BE OUT OF DATA
DCA9- C8       4020        INY          CHECK HI-BYTE OF FORWARD PNTR
DCAA- B1 B8    4030        LDA (TXTPTR),Y  END OF PROGRAM?
DCAC- F0 5F    4040        BEQ GERR     YES, WE ARE OUT OF DATA
DCAE- C8       4050        INY          PICK UP THE LINE #
DCAF- B1 B8    4060        LDA (TXTPTR),Y
DCB1- 85 7B    4070        STA DATLIN
DCB3- C8       4080        INY
DCB4- B1 B8    4090        LDA (TXTPTR),Y
DCB6- C8       4100        INY          POINT AT FIRST TEXT CHAR IN LINE
DCB7- 85 7C    4110        STA DATLIN+1
DCB9- B1 B8    4120 .1     LDA (TXTPTR),Y  GET 1ST TOKEN OF STATEMENT
DCBB- AA       4130        TAX          SAVE TOKEN IN X-REG
DCBC- 20 98 D9 4140        JSR ADDON    ADD (Y) TO TXTPTR
DCBF- E0 83    4150        CPX #TOKEN.DATA   DID WE FIND A "DATA" STATEMENT?
DCC1- D0 DD    4160        BNE FINDATA       NOT YET
DCC3- 4C 2B DC 4170        JMP INSTART       YES, READ IT
               4180 *---NO MORE INPUT REQUESTED------
               4190 INPDONE
DCC6- A5 7F    4200        LDA INPTR    GET POINTER IN CASE IT WAS "READ"
DCC8- A4 80    4210        LDY INPTR+1
DCCA- A6 15    4220        LDX INPUTFLG      "READ" OR "INPUT"?
DCCC- 10 03    4230        BPL .1            "INPUT"
DCCE- 4C 53 D8 4240        JMP SETDA         "DATA", SO STORE (Y,X) AT DATPTR
DCD1- A0 00    4250 .1     LDY #0       "INPUT":  ANY MORE CHARS ON LINE?
DCD3- B1 7F    4260        LDA (INPTR),Y
DCD5- F0 07    4270        BEQ .2           NO, ALL IS WELL
DCD7- A9 DF    4280        LDA #ERR.EXTRA   YES, ERROR
DCD9- A0 DC    4290        LDY /ERR.EXTRA   "EXTRA IGNORED"
DCDB- 4C 3A DB 4300        JMP STROUT
DCDE- 60       4310 .2     RTS
               4320 *--------------------------------
               4330 ERR.EXTRA
DCDF- 3F 45 58
DCE2- 54 52 41
DCE5- 20 49 47
DCE8- 4E 4F 52
DCEB- 45 44    4340        .AS '?EXTRA IGNORED'
DCED- 0D 00    4350        .HS 0D00
               4360 ERR.REENTRY
DCEF- 3F 52 45
DCF2- 45 4E 54
DCF5- 45 52    4370        .AS '?REENTER'
DCF7- 0D 00    4380        .HS 0D00
               4390 *--------------------------------


               SAVE S.DCF9
               1010 *--------------------------------
               1020 *      "NEXT" STATEMENT
               1030 *--------------------------------
DCF9- D0 04    1040 NEXT   BNE NEXT.1   VARIABLE AFTER "NEXT"
DCFB- A0 00    1050        LDY #0       FLAG BY SETTING FORPNT+1 = 0
DCFD- F0 03    1060        BEQ NEXT.2  ...ALWAYS
               1070 *--------------------------------
DCFF- 20 E3 DF 1080 NEXT.1 JSR PTRGET   GET PNTR TO VARIABLE IN (Y,A)
DD02- 85 85    1090 NEXT.2 STA FORPNT
DD04- 84 86    1100        STY FORPNT+1
DD06- 20 65 D3 1110        JSR GTFORPNT  FIND FOR-FRAME FOR THIS VARIABLE
DD09- F0 04    1120        BEQ NEXT.3    FOUND IT
DD0B- A2 00    1130        LDX #ERR.NOFOR    NOT THERE, ABORT
DD0D- F0 69    1140 GERR   BEQ JERROR    ...ALWAYS
DD0F- 9A       1150 NEXT.3 TXS          SET STACK PTR TO POINT TO THIS FRAME,
DD10- E8       1160        INX              WHICH TRIMS OFF ANY INNER LOOPS
DD11- E8       1170        INX
DD12- E8       1180        INX
DD13- E8       1190        INX
DD14- 8A       1200        TXA          LOW BYTE OF ADRS OF STEP VALUE
DD15- E8       1210        INX
DD16- E8       1220        INX
DD17- E8       1230        INX
DD18- E8       1240        INX
DD19- E8       1250        INX
DD1A- E8       1260        INX
DD1B- 86 60    1270        STX DEST     LOW BYTE ADRS OF FOR VAR VALUE
DD1D- A0 01    1280        LDY /STACK   (Y,A) IS ADDRESS OF STEP VALUE
DD1F- 20 F9 EA 1290        JSR LOAD.FAC.FROM.YA   STEP TO FAC
DD22- BA       1300        TSX
DD23- BD 09 01 1310        LDA STACK+9,X
DD26- 85 A2    1320        STA FAC.SIGN
DD28- A5 85    1330        LDA FORPNT
DD2A- A4 86    1340        LDY FORPNT+1
DD2C- 20 BE E7 1350        JSR FADD     ADD TO FOR VALUE
DD2F- 20 27 EB 1360        JSR SETFOR   PUT NEW VALUE BACK
DD32- A0 01    1370        LDY /STACK   (Y,A) IS ADDRESS OF END VALUE
DD34- 20 B4 EB 1380        JSR FCOMP2   COMPARE TO END VALUE
DD37- BA       1390        TSX
DD38- 38       1400        SEC
DD39- FD 09 01 1410        SBC STACK+9,X   SIGN OF STEP
DD3C- F0 17    1420        BEQ .2       BRANCH IF FOR COMPLETE
DD3E- BD 0F 01 1430        LDA STACK+15,X  OTHERWISE SET UP
DD41- 85 75    1440        STA CURLIN    FOR LINE #
DD43- BD 10 01 1450        LDA STACK+16,X
DD46- 85 76    1460        STA CURLIN+1
DD48- BD 12 01 1470        LDA STACK+18,X   AND SET TXTPTR TO JUST
DD4B- 85 B8    1480        STA TXTPTR       AFTER FOR STATEMENT
DD4D- BD 11 01 1490        LDA STACK+17,X
DD50- 85 B9    1500        STA TXTPTR+1
DD52- 4C D2 D7 1510 .1     JMP NEWSTT
DD55- 8A       1520 .2     TXA          POP OFF FOR-FRAME, LOOP IS DONE
DD56- 69 11    1530        ADC #17      CARRY IS SET, SO ADDS 18
DD58- AA       1540        TAX
DD59- 9A       1550        TXS
DD5A- 20 B7 00 1560        JSR CHRGOT   CHAR AFTER VARIABLE
DD5D- C9 2C    1570        CMP #','     ANOTHER VARIABLE IN NEXT?
DD5F- D0 F1    1580        BNE .1       NO, GO TO NEXT STATEMENT
DD61- 20 B1 00 1590        JSR CHRGET   YES, PRIME FOR NEXT VARIABLE
DD64- 20 FF DC 1600        JSR NEXT.1   (DOES NOT RETURN)
               1610 *--------------------------------
               1620 *      EVALUATE EXPRESSION, MAKE SURE IT IS NUMERIC
               1630 *--------------------------------
DD67- 20 7B DD 1640 FRMNUM JSR FRMEVL
               1650 *--------------------------------
               1660 *      MAKE SURE (FAC) IS NUMERIC
               1670 *--------------------------------
DD6A- 18       1680 CHKNUM CLC
DD6B- 24       1690        .HS 24       DUMMY FOR SKIP
               1700 *--------------------------------
               1710 *      MAKE SURE (FAC) IS STRING
               1720 *--------------------------------
DD6C- 38       1730 CHKSTR SEC
               1740 *--------------------------------
               1750 *      MAKE SURE (FAC) IS CORRECT TYPE
               1760 *      IF C=0, TYPE MUST BE NUMERIC
               1770 *      IF C=1, TYPE MUST BE STRING
               1780 *--------------------------------
DD6D- 24 11    1790 CHKVAL BIT VALTYP   $00 IF NUMERIC, $FF IF STRING
DD6F- 30 03    1800        BMI .2       TYPE IS STRING
DD71- B0 03    1810        BCS .3       NOT STRING, BUT WE NEED STRING
DD73- 60       1820 .1     RTS          TYPE IS CORRECT
DD74- B0 FD    1830 .2     BCS .1       IS STRING AND WE WANTED STRING
DD76- A2 A3    1840 .3     LDX #ERR.BADTYPE  TYPE MISMATCH
DD78- 4C 12 D4 1850 JERROR JMP ERROR


               SAVE S.DEF9
               1010 *--------------------------------
               1020 *      "SCRN(" FUNCTION
               1030 *--------------------------------
DEF9- 20 B1 00 1040 SCREEN JSR CHRGET
DEFC- 20 EC F1 1050        JSR PLOTFNS  GET COLUMN AND ROW
DEFF- 8A       1060        TXA          ROW
DF00- A4 F0    1070        LDY FIRST    COLUMN
DF02- 20 71 F8 1080        JSR MON.SCRN GET 4-BIT COLOR THERE
DF05- A8       1090        TAY
DF06- 20 01 E3 1100        JSR SNGFLT   CONVERT (Y) TO REAL IN FAC
DF09- 4C B8 DE 1110        JMP CHKCLS   REQUIRE ")"
               1120 *--------------------------------
               1130 *      PROCESS UNARY OPERATORS (FUNCTIONS)
               1140 *--------------------------------
DF0C- C9 D7    1150 UNARY  CMP #TOKEN.SCRN     NOT UNARY, DO SPECIAL
DF0E- F0 E9    1160        BEQ SCREEN
DF10- 0A       1170        ASL          DOUBLE TOKEN TO GET INDEX
DF11- 48       1180        PHA
DF12- AA       1190        TAX
DF13- 20 B1 00 1200        JSR CHRGET
DF16- E0 CF    1210        CPX #TOKEN.LEFTSTR*2-1   LEFT$, RIGHT$, AND MID$
DF18- 90 20    1220        BCC .1       NOT ONE OF THE STRING FUNCTIONS
DF1A- 20 BB DE 1230        JSR CHKOPN   STRING FUNCTION, NEED "("
DF1D- 20 7B DD 1240        JSR FRMEVL   EVALUATE EXPRESSION FOR STRING
DF20- 20 BE DE 1250        JSR CHKCOM   REQUIRE A COMMA
DF23- 20 6C DD 1260        JSR CHKSTR   MAKE SURE EXPRESSION IS A STRING
DF26- 68       1270        PLA
DF27- AA       1280        TAX          RETRIEVE ROUTINE POINTER
DF28- A5 A1    1290        LDA VPNT+1   STACK ADDRESS OF STRING
DF2A- 48       1300        PHA
DF2B- A5 A0    1310        LDA VPNT
DF2D- 48       1320        PHA
DF2E- 8A       1330        TXA
DF2F- 48       1340        PHA          STACK DOUBLED TOKEN
DF30- 20 F8 E6 1350        JSR GETBYT   CONVERT NEXT EXPRESSION TO BYTE IN X-REG
DF33- 68       1360        PLA          GET DOUBLED TOKEN OFF STACK
DF34- A8       1370        TAY          USE AS INDEX TO BRANCH
DF35- 8A       1380        TXA          VALUE OF SECOND PARAMETER
DF36- 48       1390        PHA          PUSH 2ND PARAM
DF37- 4C 3F DF 1400        JMP .2       JOIN UNARY FUNCTIONS
DF3A- 20 B2 DE 1410 .1     JSR PARCHK   REQUIRE "(EXPRESSION)"
DF3D- 68       1420        PLA
DF3E- A8       1430        TAY          INDEX INTO FUNCTION ADDRESS TABLE
DF3F- B9 DC CF 1440 .2     LDA UNFNC-TOKEN.SGN-TOKEN.SGN+$100,Y
DF42- 85 91    1450        STA JMPADRS+1  PREPARE TO JSR TO ADDRESS
DF44- B9 DD CF 1460        LDA UNFNC-TOKEN.SGN-TOKEN.SGN+$101,Y
DF47- 85 92    1470        STA JMPADRS+2
DF49- 20 90 00 1480        JSR JMPADRS  DOES NOT RETURN FOR
               1490 *                   CHR$, LEFT$, RIGHT$, OR MID$
DF4C- 4C 6A DD 1500        JMP CHKNUM   REQUIRE NUMERIC RESULT
               1510 *--------------------------------
DF4F- A5 A5    1520 OR     LDA ARG      "OR" OPERATOR
DF51- 05 9D    1530        ORA FAC      IF RESULT NONZERO, IT IS TRUE
DF53- D0 0B    1540        BNE TRUE
               1550 *--------------------------------
DF55- A5 A5    1560 AND    LDA ARG      "AND" OPERATOR
DF57- F0 04    1570        BEQ FALSE    IF EITHER IS ZERO, RESULT IS FALSE
DF59- A5 9D    1580        LDA FAC
DF5B- D0 03    1590        BNE TRUE
               1600 *--------------------------------
DF5D- A0 00    1610 FALSE  LDY #0       RETURN FAC=0
DF5F- 2C       1620        .HS 2C       TRICK
               1630 *--------------------------------
DF60- A0 01    1640 TRUE   LDY #1       RETURN FAC=1
DF62- 4C 01 E3 1650        JMP SNGFLT
               1660 *--------------------------------
               1670 *      PERFORM RELATIONAL OPERATIONS
               1680 *--------------------------------
DF65- 20 6D DD 1690 RELOPS JSR CHKVAL   MAKE SURE FAC IS CORRECT TYPE
DF68- B0 13    1700        BCS STRCMP   TYPE MATCHES, BRANCH IF STRINGS
DF6A- A5 AA    1710        LDA ARG.SIGN   NUMERIC COMPARISON
DF6C- 09 7F    1720        ORA #$7F     RE-PACK VALUE IN ARG FOR FCOMP
DF6E- 25 A6    1730        AND ARG+1
DF70- 85 A6    1740        STA ARG+1
DF72- A9 A5    1750        LDA #ARG
DF74- A0 00    1760        LDY /ARG
DF76- 20 B2 EB 1770        JSR FCOMP    RETURN A-REG = -1,0,1
DF79- AA       1780        TAX           AS ARG <,=,> FAC
DF7A- 4C B0 DF 1790        JMP NUMCMP
               1800 *--------------------------------
               1810 *      STRING COMPARISON
               1820 *--------------------------------
DF7D- A9 00    1830 STRCMP LDA #0       SET RESULT TYPE TO NUMERIC
DF7F- 85 11    1840        STA VALTYP
DF81- C6 89    1850        DEC CPRTYP   MAKE CPRTYP 0000<=>0
DF83- 20 00 E6 1860        JSR FREFAC
DF86- 85 9D    1870        STA FAC      STRING LENGTH
DF88- 86 9E    1880        STX FAC+1
DF8A- 84 9F    1890        STY FAC+2
DF8C- A5 A8    1900        LDA ARG+3
DF8E- A4 A9    1910        LDY ARG+4
DF90- 20 04 E6 1920        JSR FRETMP
DF93- 86 A8    1930        STX ARG+3
DF95- 84 A9    1940        STY ARG+4
DF97- AA       1950        TAX          LEN (ARG) STRING
DF98- 38       1960        SEC
DF99- E5 9D    1970        SBC FAC      SET X TO SMALLER LEN
DF9B- F0 08    1980        BEQ .1
DF9D- A9 01    1990        LDA #1
DF9F- 90 04    2000        BCC .1
DFA1- A6 9D    2010        LDX FAC
DFA3- A9 FF    2020        LDA #$FF
DFA5- 85 A2    2030 .1     STA FAC.SIGN      FLAG WHICH SHORTER
DFA7- A0 FF    2040        LDY #$FF
DFA9- E8       2050        INX
               2060 STRCMP.1
DFAA- C8       2070        INY
DFAB- CA       2080        DEX
DFAC- D0 07    2090        BNE STRCMP.2      MORE CHARS IN BOTH STRINGS
DFAE- A6 A2    2100        LDX FAC.SIGN   IF = SO FAR, DECIDE BY LENGTH
               2110 *--------------------------------
DFB0- 30 0F    2120 NUMCMP BMI CMPDONE
DFB2- 18       2130        CLC
DFB3- 90 0C    2140        BCC CMPDONE  ...ALWAYS
               2150 *--------------------------------
               2160 STRCMP.2
DFB5- B1 A8    2170        LDA (ARG+3),Y
DFB7- D1 9E    2180        CMP (FAC+1),Y
DFB9- F0 EF    2190        BEQ STRCMP.1      SAME, KEEP COMPARING
DFBB- A2 FF    2200        LDX #$FF          IN CASE ARG GREATER
DFBD- B0 02    2210        BCS CMPDONE       IT IS
DFBF- A2 01    2220        LDX #1            FAC GREATER
               2230 *--------------------------------
               2240 CMPDONE
DFC1- E8       2250        INX          CONVERT FF,0,1 TO 0,1,2
DFC2- 8A       2260        TXA
DFC3- 2A       2270        ROL          AND TO 0,2,4 IF C=0, ELSE 1,2,5
DFC4- 25 16    2280        AND CPRMASK  00000<=>
DFC6- F0 02    2290        BEQ .1       IF NO MATCH: FALSE
DFC8- A9 01    2300        LDA #1       AT LEAST ONE MATCH: TRUE
DFCA- 4C 93 EB 2310 .1     JMP FLOAT
               2320 *--------------------------------
               2330 *      "PDL" FUNCTION
               2340 *      <<< NOTE: ARG<4 IS NOT CHECKED >>>
               2350 *--------------------------------
DFCD- 20 FB E6 2360 PDL    JSR CONINT       GET # IN X
DFD0- 20 1E FB 2370        JSR MON.PREAD    READ PADDLE
DFD3- 4C 01 E3 2380        JMP SNGFLT       FLOAT RESULT
               2390 *--------------------------------
               2400 *      "DIM" STATEMENT
               2410 *--------------------------------
DFD6- 20 BE DE 2420 NXDIM  JSR CHKCOM   SEPARATED BY COMMAS
DFD9- AA       2430 DIM    TAX          NON-ZERO, FLAGS PTRGET DIM CALLED
DFDA- 20 E8 DF 2440        JSR PTRGET2  ALLOCATE THE ARRAY
DFDD- 20 B7 00 2450        JSR CHRGOT   NEXT CHAR
DFE0- D0 F4    2460        BNE NXDIM    NOT END OF STATEMENT
DFE2- 60       2470        RTS




               SAVE S.DFE3
               1010 *--------------------------------
               1020 *      PTRGET -- GENERAL VARIABLE SCAN
               1030 *
               1040 *      SCANS VARIABLE NAME AT TXTPTR, AND SEARCHES THE
               1050 *      VARTAB AND ARYTAB FOR THE NAME.
               1060 *      IF NOT FOUND, CREATE VARIABLE OF APPROPRIATE TYPE.
               1070 *      RETURN WITH ADDRESS IN VARPNT AND Y,A
               1080 *
               1090 *      ACTUAL ACTIVITY CONTROLLED SOMEWHAT BY TWO FLAGS:
               1100 *          DIMFLG -- NONZERO IF CALLED FROM "DIM"
               1110 *                    ELSE = 0
               1120 *
               1130 *          SUBFLG -- = $00
               1140 *                    = $40 IF CALLED FROM "GETARYPT"
               1150 *                    = $80 IF CALLED FROM "DEF FN"
               1160 *                    = $C1-DA IF CALLED FROM "FN"
               1170 *--------------------------------
DFE3- A2 00    1180 PTRGET LDX #0
DFE5- 20 B7 00 1190        JSR CHRGOT   GET FIRST CHAR OF VARIABLE NAME
               1200 *--------------------------------
               1210 PTRGET2
DFE8- 86 10    1220        STX DIMFLG   X IS NONZERO IF FROM DIM
               1230 *--------------------------------
               1240 PTRGET3
DFEA- 85 81    1250        STA VARNAM
DFEC- 20 B7 00 1260        JSR CHRGOT
DFEF- 20 7D E0 1270        JSR ISLETC   IS IT A LETTER?
DFF2- B0 03    1280        BCS NAMOK    YES, OKAY SO FAR
DFF4- 4C C9 DE 1290 BADNAM JMP SYNERR   NO, SYNTAX ERROR
DFF7- A2 00    1300 NAMOK  LDX #0
DFF9- 86 11    1310        STX VALTYP
DFFB- 86 12    1320        STX VALTYP+1
DFFD- 4C 07 E0 1330        JMP PTRGET4  TO BRANCH ACROSS $E000 VECTORS
               1340 *--------------------------------
               1350 *      DOS AND MONITOR CALL BASIC AT $E000 AND $E003
               1360 *--------------------------------
E000- 4C 28 F1 1370        JMP COLD.START
E003- 4C 3C D4 1380        JMP RESTART
E006- 00       1390        BRK          <<< WASTED BYTE >>>
               1400 *--------------------------------
               1410 PTRGET4
E007- 20 B1 00 1420        JSR CHRGET   SECOND CHAR OF VARIABLE NAME
E00A- 90 05    1430        BCC .1       NUMERIC
E00C- 20 7D E0 1440        JSR ISLETC   LETTER?
E00F- 90 0B    1450        BCC .3       NO, END OF NAME
E011- AA       1460 .1     TAX          SAVE SECOND CHAR OF NAME IN X
E012- 20 B1 00 1470 .2     JSR CHRGET   SCAN TO END OF VARIABLE NAME
E015- 90 FB    1480        BCC .2       NUMERIC
E017- 20 7D E0 1490        JSR ISLETC
E01A- B0 F6    1500        BCS .2       ALPHA
E01C- C9 24    1510 .3     CMP #'$'     STRING?
E01E- D0 06    1520        BNE .4       NO
E020- A9 FF    1530        LDA #$FF
E022- 85 11    1540        STA VALTYP
E024- D0 10    1550        BNE .5       ...ALWAYS
E026- C9 25    1560 .4     CMP #'%'     INTEGER?
E028- D0 13    1570        BNE .6       NO
E02A- A5 14    1580        LDA SUBFLG   YES; INTEGER VARIABLE ALLOWED?
E02C- 30 C6    1590        BMI BADNAM   NO, SYNTAX ERROR
E02E- A9 80    1600        LDA #$80     YES
E030- 85 12    1610        STA VALTYP+1 FLAG INTEGER MODE
E032- 05 81    1620        ORA VARNAM
E034- 85 81    1630        STA VARNAM   SET SIGN BIT ON VARNAME
E036- 8A       1640 .5     TXA          SECOND CHAR OF NAME
E037- 09 80    1650        ORA #$80     SET SIGN
E039- AA       1660        TAX
E03A- 20 B1 00 1670        JSR CHRGET   GET TERMINATING CHAR
E03D- 86 82    1680 .6     STX VARNAM+1 STORE SECOND CHAR OF NAME
E03F- 38       1690        SEC
E040- 05 14    1700        ORA SUBFLG   $00 OR $40 IF SUBSCRIPTS OK, ELSE $80
E042- E9 28    1710        SBC #'('     IF SUBFLG=$00 AND CHAR="("...
E044- D0 03    1720        BNE .8       NOPE
E046- 4C 1E E1 1730 .7     JMP ARRAY    YES
E049- 24 14    1740 .8     BIT SUBFLG   CHECK TOP TWO BITS OF SUBFLG
E04B- 30 02    1750        BMI .9       $80
E04D- 70 F7    1760        BVS .7       $40, CALLED FROM GETARYPT
E04F- A9 00    1770 .9     LDA #0       CLEAR SUBFLG
E051- 85 14    1780        STA SUBFLG
E053- A5 69    1790        LDA VARTAB   START LOWTR AT SIMPLE VARIABLE TABLE
E055- A6 6A    1800        LDX VARTAB+1
E057- A0 00    1810        LDY #0
E059- 86 9C    1820 .10    STX LOWTR+1
E05B- 85 9B    1830 .11    STA LOWTR
E05D- E4 6C    1840        CPX ARYTAB+1  END OF SIMPLE VARIABLES?
E05F- D0 04    1850        BNE .12       NO, GO ON
E061- C5 6B    1860        CMP ARYTAB    YES; END OF ARRAYS?
E063- F0 22    1870        BEQ NAME.NOT.FOUND    YES, MAKE ONE
E065- A5 81    1880 .12    LDA VARNAM    SAME FIRST LETTER?
E067- D1 9B    1890        CMP (LOWTR),Y
E069- D0 08    1900        BNE .13       NOT SAME FIRST LETTER
E06B- A5 82    1910        LDA VARNAM+1  SAME SECOND LETTER?
E06D- C8       1920        INY
E06E- D1 9B    1930        CMP (LOWTR),Y
E070- F0 6C    1940        BEQ SET.VARPNT.AND.YA   YES, SAME VARIABLE NAME
E072- 88       1950        DEY           NO, BUMP TO NEXT NAME
E073- 18       1960 .13    CLC
E074- A5 9B    1970        LDA LOWTR
E076- 69 07    1980        ADC #7
E078- 90 E1    1990        BCC .11
E07A- E8       2000        INX
E07B- D0 DC    2010        BNE .10      ...ALWAYS
               2020 *--------------------------------
               2030 *      CHECK IF (A) IS ASCII LETTER A-Z
               2040 *
               2050 *      RETURN CARRY = 1 IF A-Z
               2060 *                   = 0 IF NOT
               2070 *
               2080 *      <<<NOTE FASTER AND SHORTER CODE:    >>>
               2090 *      <<<    CMP #'Z'+1  COMPARE HI END
               2100 *      <<<    BCS .1      ABOVE A-Z
               2110 *      <<<    CMP #'A'    COMPARE LO END
               2120 *      <<<    RTS         C=0 IF LO, C=1 IF A-Z
               2130 *      <<<.1  CLC         C=0 IF HI
               2140 *      <<<    RTS
               2150 *--------------------------------
E07D- C9 41    2160 ISLETC CMP #'A'     COMPARE LO END
E07F- 90 05    2170        BCC .1       C=0 IF LOW
E081- E9 5B    2180        SBC #'Z'+1   PREPARE HI END TEST
E083- 38       2190        SEC          TEST HI END, RESTORING (A)
E084- E9 A5    2200        SBC #-1-'Z'  C=0 IF LO, C=1 IF A-Z
E086- 60       2210 .1     RTS
               2220 *--------------------------------
               2230 *      VARIABLE NOT FOUND, SO MAKE ONE
               2240 *--------------------------------
               2250 NAME.NOT.FOUND
E087- 68       2260        PLA          LOOK AT RETURN ADDRESS ON STACK TO
E088- 48       2270        PHA          SEE IF CALLED FROM FRM.VARIABLE
E089- C9 D7    2280        CMP #FRM.VARIABLE.CALL
E08B- D0 0F    2290        BNE MAKE.NEW.VARIABLE   NO
E08D- BA       2300        TSX
E08E- BD 02 01 2310        LDA STACK+2,X
E091- C9 DE    2320        CMP /FRM.VARIABLE.CALL
E093- D0 07    2330        BNE MAKE.NEW.VARIABLE   NO
E095- A9 9A    2340        LDA #C.ZERO  YES, CALLED FROM FRM.VARIABLE
E097- A0 E0    2350        LDY /C.ZERO  POINT TO A CONSTANT ZERO
E099- 60       2360        RTS          NEW VARIABLE USED IN EXPRESSION = 0
               2370 *--------------------------------
E09A- 00 00    2380 C.ZERO .HS 0000     INTEGER OR REAL ZERO, OR NULL STRING
               2390 *--------------------------------
               2400 *      MAKE A NEW SIMPLE VARIABLE
               2410 *
               2420 *      MOVE ARRAYS UP 7 BYTES TO MAKE ROOM FOR NEW VARIABLE
               2430 *      ENTER 7-BYTE VARIABLE DATA IN THE HOLE
               2440 *--------------------------------
               2450 MAKE.NEW.VARIABLE
E09C- A5 6B    2460        LDA ARYTAB   SET UP CALL TO BLTU TO
E09E- A4 6C    2470        LDY ARYTAB+1    TO MOVE FROM ARYTAB THRU STREND-1
E0A0- 85 9B    2480        STA LOWTR       7 BYTES HIGHER
E0A2- 84 9C    2490        STY LOWTR+1
E0A4- A5 6D    2500        LDA STREND
E0A6- A4 6E    2510        LDY STREND+1
E0A8- 85 96    2520        STA HIGHTR
E0AA- 84 97    2530        STY HIGHTR+1
E0AC- 18       2540        CLC
E0AD- 69 07    2550        ADC #7
E0AF- 90 01    2560        BCC .1
E0B1- C8       2570        INY
E0B2- 85 94    2580 .1     STA ARYPNT
E0B4- 84 95    2590        STY ARYPNT+1
E0B6- 20 93 D3 2600        JSR BLTU     MOVE ARRAY BLOCK UP
E0B9- A5 94    2610        LDA ARYPNT   STORE NEW START OF ARRAYS
E0BB- A4 95    2620        LDY ARYPNT+1
E0BD- C8       2630        INY
E0BE- 85 6B    2640        STA ARYTAB
E0C0- 84 6C    2650        STY ARYTAB+1
E0C2- A0 00    2660        LDY #0
E0C4- A5 81    2670        LDA VARNAM   FIRST CHAR OF NAME
E0C6- 91 9B    2680        STA (LOWTR),Y
E0C8- C8       2690        INY
E0C9- A5 82    2700        LDA VARNAM+1 SECOND CHAR OF NAME
E0CB- 91 9B    2710        STA (LOWTR),Y
E0CD- A9 00    2720        LDA #0       SET FIVE-BYTE VALUE TO 0
E0CF- C8       2730        INY
E0D0- 91 9B    2740        STA (LOWTR),Y
E0D2- C8       2750        INY
E0D3- 91 9B    2760        STA (LOWTR),Y
E0D5- C8       2770        INY
E0D6- 91 9B    2780        STA (LOWTR),Y
E0D8- C8       2790        INY
E0D9- 91 9B    2800        STA (LOWTR),Y
E0DB- C8       2810        INY
E0DC- 91 9B    2820        STA (LOWTR),Y
               2830 *--------------------------------
               2840 *      PUT ADDRESS OF VALUE OF VARIABLE IN VARPNT AND Y,A
               2850 *--------------------------------
               2860 SET.VARPNT.AND.YA
E0DE- A5 9B    2870        LDA LOWTR    LOWTR POINTS AT NAME OF VARIABLE,
E0E0- 18       2880        CLC          SO ADD 2 TO GET TO VALUE
E0E1- 69 02    2890        ADC #2
E0E3- A4 9C    2900        LDY LOWTR+1
E0E5- 90 01    2910        BCC .1
E0E7- C8       2920        INY
E0E8- 85 83    2930 .1     STA VARPNT   ADDRESS IN VARPNT AND Y,A
E0EA- 84 84    2940        STY VARPNT+1
E0EC- 60       2950        RTS
               2960 *--------------------------------
               2970 *      COMPUTE ADDRESS OF FIRST VALUE IN ARRAY
               2980 *      ARYPNT = (LOWTR) + #DIMS*2 + 5
               2990 *--------------------------------
E0ED- A5 0F    3000 GETARY LDA NUMDIM   GET # OF DIMENSIONS
               3010 *--------------------------------
               3020 GETARY2
E0EF- 0A       3030        ASL          #DIMS*2 (SIZE OF EACH DIM IN 2 BYTES)
E0F0- 69 05    3040        ADC #5       + 5 (2 FOR NAME, 2 FOR OFFSET TO NEXT
               3050 *                   ARRAY, AND 1 FOR #DIMS
E0F2- 65 9B    3060        ADC LOWTR    ADDRESS OF TH IS ARRAY IN ARYTAB
E0F4- A4 9C    3070        LDY LOWTR+1
E0F6- 90 01    3080        BCC .1
E0F8- C8       3090        INY
E0F9- 85 94    3100 .1     STA ARYPNT   ADDRESS OF FIRST VALUE IN ARRAY
E0FB- 84 95    3110        STY ARYPNT+1
E0FD- 60       3120        RTS
               3130 *--------------------------------
E0FE- 90 80 00
E101- 00       3140 NEG32768 .HS 90800000 -32768.00049 IN FLOATING POINT
               3150 * <<<  MEANT TO BE -32768, WHICH WOULD BE 9080000000 >>>
               3160 * <<<  1 BYTE SHORT, SO PICKS UP $20 FROM NEXT INSTRUCTION
               3170 *--------------------------------
               3180 *      EVALUATE NUMERIC FORMULA AT TXTPTR
               3190 *      CONVERTING RESULT TO INTEGER 0 <= X <= 32767
               3200 *      IN FAC+3,4
               3210 *--------------------------------
E102- 20 B1 00 3220 MAKINT JSR CHRGET
E105- 20 67 DD 3230        JSR FRMNUM
               3240 *--------------------------------
               3250 *      CONVERT FAC TO INTEGER
               3260 *      MUST BE POSITIVE AND LESS THAN 32768
               3270 *--------------------------------
E108- A5 A2    3280 MKINT  LDA FAC.SIGN   ERROR IF -
E10A- 30 0D    3290        BMI MI1
               3300 *--------------------------------
               3310 *      CONVERT FAC TO INTEGER
               3320 *      MUST BE -32767 <= FAC <= 32767
               3330 *--------------------------------
E10C- A5 9D    3340 AYINT  LDA FAC      EXPONENT OF VALUE IN FAC
E10E- C9 90    3350        CMP #$90     ABS(VALUE) < 32768?
E110- 90 09    3360        BCC MI2      YES, OK FOR INTEGER
E112- A9 FE    3370        LDA #NEG32768  NO; NEXT FEW LINES ARE SUPPOSED TO
E114- A0 E0    3380        LDY /NEG32768  ALLOW -32768 ($8000), BUT DO NOT!
E116- 20 B2 EB 3390        JSR FCOMP    BECAUSE COMPARED TO -32768.00049
               3400 *      <<< BUG:  A=-32768.00049:A%=A IS ACCEPTED >>>
               3410 *      <<<       BUT PRINT A,A% SHOWS THAT       >>>
               3420 *      <<<       A=-32768.0005 (OK), A%=32767    >>>
               3430 *      <<<       WRONG! WRONG! WRONG!            >>>
               3440 *--------------------------------
E119- D0 7E    3450 MI1    BNE IQERR    ILLEGAL QUANTITY
E11B- 4C F2 EB 3460 MI2    JMP QINT     CONVERT TO INTEGER
               3470 *--------------------------------
               3480 *      LOCATE ARRAY ELEMENT OR CREATE AN ARRAY
               3490 *--------------------------------
E11E- A5 14    3500 ARRAY  LDA SUBFLG   SUBSCRIPTS GIVEN?
E120- D0 47    3510        BNE .2       NO
               3520 *--------------------------------
               3530 *      PARSE THE SUBSCRIPT LIST
               3540 *--------------------------------
E122- A5 10    3550        LDA DIMFLG   YES
E124- 05 12    3560        ORA VALTYP+1  SET HIGH BIT IF %
E126- 48       3570        PHA          SAVE VALTYP AND DIMFLG ON STACK
E127- A5 11    3580        LDA VALTYP
E129- 48       3590        PHA
E12A- A0 00    3600        LDY #0       COUNT # DIMENSIONS IN Y-REG
E12C- 98       3610 .1     TYA          SAVE #DIMS ON STACK
E12D- 48       3620        PHA
E12E- A5 82    3630        LDA VARNAM+1 SAVE VARIABLE NAME ON STACK
E130- 48       3640        PHA
E131- A5 81    3650        LDA VARNAM
E133- 48       3660        PHA
E134- 20 02 E1 3670        JSR MAKINT   EVALUATE SUBSCRIPT AS INTEGER
E137- 68       3680        PLA          RESTORE VARIABLE NAME
E138- 85 81    3690        STA VARNAM
E13A- 68       3700        PLA
E13B- 85 82    3710        STA VARNAM+1
E13D- 68       3720        PLA          RESTORE # DIMS TO Y-REG
E13E- A8       3730        TAY
E13F- BA       3740        TSX          COPY VALTYP AND DIMFLG ON STACK
E140- BD 02 01 3750        LDA STACK+2,X  TO LEAVE ROOM FOR THE SUBSCRIPT
E143- 48       3760        PHA
E144- BD 01 01 3770        LDA STACK+1,X
E147- 48       3780        PHA
E148- A5 A0    3790        LDA FAC+3    GET SUBSCRIPT VALUE AND PLACE IN THE
E14A- 9D 02 01 3800        STA STACK+2,X   STACK WHERE VALTYP & DIMFLG WERE
E14D- A5 A1    3810        LDA FAC+4
E14F- 9D 01 01 3820        STA STACK+1,X
E152- C8       3830        INY          COUNT THE SUBSCRIPT
E153- 20 B7 00 3840        JSR CHRGOT   NEXT CHAR
E156- C9 2C    3850        CMP #','
E158- F0 D2    3860        BEQ .1       COMMA, PARSE ANOTHER SUBSCRIPT
E15A- 84 0F    3870        STY NUMDIM   NO MORE SUBSCRIPTS, SAVE #
E15C- 20 B8 DE 3880        JSR CHKCLS   NOW NEED ")"
E15F- 68       3890        PLA          RESTORE VALTYPE AND DIMFLG
E160- 85 11    3900        STA VALTYP
E162- 68       3910        PLA
E163- 85 12    3920        STA VALTYP+1
E165- 29 7F    3930        AND #$7F         ISOLATE DIMFLG
E167- 85 10    3940        STA DIMFLG
               3950 *--------------------------------
               3960 *      SEARCH ARRAY TABLE FOR THIS ARRAY NAME
               3970 *--------------------------------
E169- A6 6B    3980 .2     LDX ARYTAB   (A,X) = START OF ARRAY TABLE
E16B- A5 6C    3990        LDA ARYTAB+1
E16D- 86 9B    4000 .3     STX LOWTR    USE LOWTR FOR RUNNING POINTER
E16F- 85 9C    4010        STA LOWTR+1
E171- C5 6E    4020        CMP STREND+1 DID WE REACH THE END OF ARRAYS YET?
E173- D0 04    4030        BNE .4       NO, KEEP SEARCHING
E175- E4 6D    4040        CPX STREND
E177- F0 3F    4050        BEQ MAKE.NEW.ARRAY  YES, THIS IS A NEW ARRAY NAME
E179- A0 00    4060 .4     LDY #0       POINT AT 1ST CHAR OF ARRAY NAME
E17B- B1 9B    4070        LDA (LOWTR),Y     GET 1ST CHAR OF NAME
E17D- C8       4080        INY          POINT AT 2ND CHAR
E17E- C5 81    4090        CMP VARNAM   1ST CHAR SAME?
E180- D0 06    4100        BNE .5       NO, MOVE TO NEXT ARRAY
E182- A5 82    4110        LDA VARNAM+1 YES, TRY 2ND CHAR
E184- D1 9B    4120        CMP (LOWTR),Y     SAME?
E186- F0 16    4130        BEQ USE.OLD.ARRAY YES, ARRAY FOUND
E188- C8       4140 .5     INY          POINT AT OFFSET TO NEXT ARRAY
E189- B1 9B    4150        LDA (LOWTR),Y     ADD OFFSET TO RUNNING POINTER
E18B- 18       4160        CLC
E18C- 65 9B    4170        ADC LOWTR
E18E- AA       4180        TAX
E18F- C8       4190        INY
E190- B1 9B    4200        LDA (LOWTR),Y
E192- 65 9C    4210        ADC LOWTR+1
E194- 90 D7    4220        BCC .3       ...ALWAYS
               4230 *--------------------------------
               4240 *      ERROR:  BAD SUBSCRIPTS
               4250 *--------------------------------
E196- A2 6B    4260 SUBERR LDX #ERR.BADSUBS
E198- 2C       4270        .HS 2C       TRICK TO SKIP NEXT LINE
               4280 *--------------------------------
               4290 *      ERROR:  ILLEGAL QUANTITY
               4300 *--------------------------------
E199- A2 35    4310 IQERR  LDX #ERR.ILLQTY
E19B- 4C 12 D4 4320 JER    JMP ERROR
               4330 *--------------------------------
               4340 *      FOUND THE ARRAY
               4350 *--------------------------------
               4360 USE.OLD.ARRAY
E19E- A2 78    4370        LDX #ERR.REDIMD   SET UP FOR REDIM'D ARRAY ERROR
E1A0- A5 10    4380        LDA DIMFLG        CALLED FROM "DIM" STATEMENT?
E1A2- D0 F7    4390        BNE JER           YES, ERROR
E1A4- A5 14    4400        LDA SUBFLG        NO, CHECK IF ANY SUBSCRIPTS
E1A6- F0 02    4410        BEQ .1            YES, NEED TO CHECK THE NUMBER
E1A8- 38       4420        SEC               NO, SIGNAL ARRAY FOUND
E1A9- 60       4430        RTS
               4440 *--------------------------------
E1AA- 20 ED E0 4450 .1     JSR GETARY     SET (ARYPNT) = ADDR OF FIRST ELEMENT
E1AD- A5 0F    4460        LDA NUMDIM        COMPARE NUMBER OF DIMENSIONS
E1AF- A0 04    4470        LDY #4
E1B1- D1 9B    4480        CMP (LOWTR),Y
E1B3- D0 E1    4490        BNE SUBERR        NOT SAME, SUBSCRIPT ERROR
E1B5- 4C 4B E2 4500        JMP FIND.ARRAY.ELEMENT
               4510 *--------------------------------



               SAVE S.E1B8
               1010 *--------------------------------
               1020 *      CREATE A NEW ARRAY, UNLESS CALLED FROM GETARYPT
               1030 *--------------------------------
               1040 MAKE.NEW.ARRAY
E1B8- A5 14    1050        LDA SUBFLG   CALLED FROM GETARYPT?
E1BA- F0 05    1060        BEQ .1       NO
E1BC- A2 2A    1070        LDX #ERR.NODATA   YES, GIVE "OUT OF DATA" ERROR
E1BE- 4C 12 D4 1080        JMP ERROR
E1C1- 20 ED E0 1090 .1     JSR GETARY   PUT ADDR OF 1ST ELEMENT IN ARYPNT
E1C4- 20 E3 D3 1100        JSR REASON   MAKE SURE ENOUGH MEMORY LEFT
               1110 *--------------------------------
               1120 *      <<< NEXT 3 LINES COULD BE WRITTEN:   >>>
               1130 *      LDY #0
               1140 *      STY STRNG2+1
               1150 *--------------------------------
E1C7- A9 00    1160        LDA #0       POINT Y-REG AT VARIABLE NAME SLOT
E1C9- A8       1170        TAY
E1CA- 85 AE    1180        STA STRNG2+1 START SIZE COMPUTATION
E1CC- A2 05    1190        LDX #5       ASSUME 5-BYTES PER ELEMENT
E1CE- A5 81    1200        LDA VARNAM   STUFF VARIABLE NAME IN ARRAY
E1D0- 91 9B    1210        STA (LOWTR),Y
E1D2- 10 01    1220        BPL .2       NOT INTEGER ARRAY
E1D4- CA       1230        DEX          INTEGER ARRAY, DECR. SIZE TO 4-BYTES
E1D5- C8       1240 .2     INY          POINT Y-REG AT NEXT CHAR OF NAME
E1D6- A5 82    1250        LDA VARNAM+1 REST OF ARRAY NAME
E1D8- 91 9B    1260        STA (LOWTR),Y
E1DA- 10 02    1270        BPL .3       REAL ARRAY, STICK WITH SIZE = 5 BYTES
E1DC- CA       1280        DEX          INTEGER OR STRING ARRAY, ADJUST SIZE
E1DD- CA       1290        DEX          TO INTEGER=3, STRING=2 BYTES
E1DE- 86 AD    1300 .3     STX STRNG2   STORE LOW-BYTE OF ARRAY ELEMENT SIZE
E1E0- A5 0F    1310        LDA NUMDIM   STORE NUMBER OF DIMENSIONS
E1E2- C8       1320        INY          IN 5TH BYTE OF ARRAY
E1E3- C8       1330        INY
E1E4- C8       1340        INY
E1E5- 91 9B    1350        STA (LOWTR),Y
E1E7- A2 0B    1360 .4     LDX #11      DEFAULT DIMENSION = 11 ELEMENTS
E1E9- A9 00    1370        LDA #0       FOR HI-BYTE OF DIMENSION IF DEFAULT
E1EB- 24 10    1380        BIT DIMFLG   DIMENSIONED ARRAY?
E1ED- 50 08    1390        BVC .5       NO, USE DEFAULT VALUE
E1EF- 68       1400        PLA          GET SPECIFIED DIM IN A,X
E1F0- 18       1410        CLC          # ELEMENTS IS 1 LARGER THAN
E1F1- 69 01    1420        ADC #1       DIMENSION VALUE
E1F3- AA       1430        TAX
E1F4- 68       1440        PLA
E1F5- 69 00    1450        ADC #0
E1F7- C8       1460 .5     INY          ADD THIS DIMENSION TO ARRAY DESCRIPTOR
E1F8- 91 9B    1470        STA (LOWTR),Y
E1FA- C8       1480        INY
E1FB- 8A       1490        TXA
E1FC- 91 9B    1500        STA (LOWTR),Y
E1FE- 20 AD E2 1510        JSR MULTIPLY.SUBSCRIPT     MULTIPLY THIS
               1520 *                   DIMENSION BY RUNNING SIZE
               1530 *                   ((LOWTR)) * (STRNG2) --> A,X
E201- 86 AD    1540        STX STRNG2   STORE RUNNING SIZE IN STRNG2
E203- 85 AE    1550        STA STRNG2+1
E205- A4 5E    1560        LDY INDEX    RETRIEVE Y SAVED BY MULTIPLY.SUBSCRIPT
E207- C6 0F    1570        DEC NUMDIM   COUNT DOWN # DIMS
E209- D0 DC    1580        BNE .4       LOOP TILL DONE
               1590 *--------------------------------
               1600 *      NOW A,X HAS TOTAL # BYTES OF ARRAY ELEMENTS
               1610 *--------------------------------
E20B- 65 95    1620        ADC ARYPNT+1 COMPUTE ADDRESS OF END OF THIS ARRAY
E20D- B0 5D    1630        BCS GME      ...TOO LARGE, ERROR
E20F- 85 95    1640        STA ARYPNT+1
E211- A8       1650        TAY
E212- 8A       1660        TXA
E213- 65 94    1670        ADC ARYPNT
E215- 90 03    1680        BCC .6
E217- C8       1690        INY
E218- F0 52    1700        BEQ GME      ...TOO LARGE, ERROR
E21A- 20 E3 D3 1710 .6     JSR REASON   MAKE SURE THERE IS ROOM UP TO Y,A
E21D- 85 6D    1720        STA STREND   THERE IS ROOM SO SAVE NEW END OF TABLE
E21F- 84 6E    1730        STY STREND+1      AND ZERO THE ARRAY
E221- A9 00    1740        LDA #0
E223- E6 AE    1750        INC STRNG2+1 PREPARE FOR FAST ZEROING LOOP
E225- A4 AD    1760        LDY STRNG2   # BYTES MOD 256
E227- F0 05    1770        BEQ .8       FULL PAGE
E229- 88       1780 .7     DEY          CLEAR PAGE FULL
E22A- 91 94    1790        STA (ARYPNT),Y
E22C- D0 FB    1800        BNE .7
E22E- C6 95    1810 .8     DEC ARYPNT+1 POINT TO NEXT PAGE
E230- C6 AE    1820        DEC STRNG2+1 COUNT THE PAGES
E232- D0 F5    1830        BNE .7       STILL MORE TO CLEAR
E234- E6 95    1840        INC ARYPNT+1 RECOVER LAST DEC, POINT AT 1ST ELEMENT
E236- 38       1850        SEC
E237- A5 6D    1860        LDA STREND   COMPUTE OFFSET TO END OF ARRAYS
E239- E5 9B    1870        SBC LOWTR    AND STORE IN ARRAY DESCRIPTOR
E23B- A0 02    1880        LDY #2
E23D- 91 9B    1890        STA (LOWTR),Y
E23F- A5 6E    1900        LDA STREND+1
E241- C8       1910        INY
E242- E5 9C    1920        SBC LOWTR+1
E244- 91 9B    1930        STA (LOWTR),Y
E246- A5 10    1940        LDA DIMFLG   WAS THIS CALLED FROM "DIM" STATEMENT?
E248- D0 62    1950        BNE RTS.9    YES, WE ARE FINISHED
E24A- C8       1960        INY          NO, NOW NEED TO FIND THE ELEMENT
               1970 *--------------------------------
               1980 *      FIND SPECIFIED ARRAY ELEMENT
               1990 *
               2000 *      (LOWTR),Y POINTS AT # OF DIMS IN ARRAY DESCRIPTOR
               2010 *      THE SUBSCRIPTS ARE ALL ON THE STACK AS INTEGERS
               2020 *--------------------------------
               2030 FIND.ARRAY.ELEMENT
E24B- B1 9B    2040        LDA (LOWTR),Y     GET # OF DIMENSIONS
E24D- 85 0F    2050        STA NUMDIM
E24F- A9 00    2060        LDA #0       ZERO SUBSCRIPT ACCUMULATOR
E251- 85 AD    2070        STA STRNG2
E253- 85 AE    2080 FAE.1  STA STRNG2+1
E255- C8       2090        INY
E256- 68       2100        PLA          PULL NEXT SUBSCRIPT FROM STACK
E257- AA       2110        TAX          SAVE IN FAC+3,4
E258- 85 A0    2120        STA FAC+3    AND COMPARE WITH DIMENSIONED SIZE
E25A- 68       2130        PLA
E25B- 85 A1    2140        STA FAC+4
E25D- D1 9B    2150        CMP (LOWTR),Y
E25F- 90 0E    2160        BCC FAE.2    SUBSCRIPT NOT TOO LARGE
E261- D0 06    2170        BNE GSE      SUBSCRIPT IS TOO LARGE
E263- C8       2180        INY          CHECK LOW-BYTE OF SUBSCRIPT
E264- 8A       2190        TXA
E265- D1 9B    2200        CMP (LOWTR),Y
E267- 90 07    2210        BCC FAE.3    NOT TOO LARGE
               2220 *--------------------------------
E269- 4C 96 E1 2230 GSE    JMP SUBERR   BAD SUBSCRIPTS ERROR
E26C- 4C 10 D4 2240 GME    JMP MEMERR   MEM FULL ERROR
               2250 *--------------------------------
E26F- C8       2260 FAE.2  INY          BUMP POINTER INTO DESCRIPTOR
E270- A5 AE    2270 FAE.3  LDA STRNG2+1 BYPASS MULTIPLICATION IF VALUE SO
E272- 05 AD    2280        ORA STRNG2   FAR = 0
E274- 18       2290        CLC
E275- F0 0A    2300        BEQ .1       IT IS ZERO SO FAR
E277- 20 AD E2 2310        JSR MULTIPLY.SUBSCRIPT     NOT ZERO, SO MULTIPLY
E27A- 8A       2320        TXA          ADD CURRENT SUBSCRIPT
E27B- 65 A0    2330        ADC FAC+3
E27D- AA       2340        TAX
E27E- 98       2350        TYA
E27F- A4 5E    2360        LDY INDEX    RETRIEVE Y SAVED BY MULTIPLY.SUBSCRIPT
E281- 65 A1    2370 .1     ADC FAC+4    FINISH ADDING CURRENT SUBSCRIPT
E283- 86 AD    2380        STX STRNG2   STORE ACCUMULATED OFFSET
E285- C6 0F    2390        DEC NUMDIM   LAST SUBSCRIPT YET?
E287- D0 CA    2400        BNE FAE.1    NO, LOOP TILL DONE
E289- 85 AE    2410        STA STRNG2+1 YES, NOW MULTIPLY BE ELEMENT SIZE
E28B- A2 05    2420        LDX #5       START WITH SIZE = 5
E28D- A5 81    2430        LDA VARNAM   DETERMINE VARIABLE TYPE
E28F- 10 01    2440        BPL .2       NOT INTEGER
E291- CA       2450        DEX          INTEGER, BACK DOWN SIZE TO 4 BYTES
E292- A5 82    2460 .2     LDA VARNAM+1 DISCRIMINATE BETWEEN REAL AND STR
E294- 10 02    2470        BPL .3       IT IS REAL
E296- CA       2480        DEX          SIZE = 3 IF STRING, =2 IF INTEGER
E297- CA       2490        DEX
E298- 86 64    2500 .3     STX RESULT+2 SET UP MULTIPLIER
E29A- A9 00    2510        LDA #0       HI-BYTE OF MULTIPLIER
E29C- 20 B6 E2 2520        JSR MULTIPLY.SUBS.1   (STRNG2) BY ELEMENT SIZE
E29F- 8A       2530        TXA          ADD ACCUMULATED OFFSET
E2A0- 65 94    2540        ADC ARYPNT   TO ADDRESS OF 1ST ELEMENT
E2A2- 85 83    2550        STA VARPNT   TO GET ADDRESS OF SPECIFIED ELEMENT
E2A4- 98       2560        TYA
E2A5- 65 95    2570        ADC ARYPNT+1
E2A7- 85 84    2580        STA VARPNT+1
E2A9- A8       2590        TAY          RETURN WITH ADDR IN VARPNT
E2AA- A5 83    2600        LDA VARPNT        AND IN Y,A
E2AC- 60       2610 RTS.9  RTS
               2620 *--------------------------------
               2630 *      MULTIPLY (STRNG2) BY ((LOWTR),Y)
               2640 *      LEAVING PRODUCT IN A,X.  (HI-BYTE ALSO IN Y.)
               2650 *      USED ONLY BY ARRAY SUBSCRIPT ROUTINES
               2660 *--------------------------------
E2AD- 84 5E    2670 MULTIPLY.SUBSCRIPT   STY INDEX    SAVE Y-REG
E2AF- B1 9B    2680        LDA (LOWTR),Y     GET MULTIPLIER
E2B1- 85 64    2690        STA RESULT+2      SAVE IN RESULT+2,3
E2B3- 88       2700        DEY
E2B4- B1 9B    2710        LDA (LOWTR),Y
               2720 *--------------------------------
               2730 MULTIPLY.SUBS.1
E2B6- 85 65    2740        STA RESULT+3      LOW BYTE OF MULTIPLIER
E2B8- A9 10    2750        LDA #16      MULTIPLY 16 BITS
E2BA- 85 99    2760        STA INDX
E2BC- A2 00    2770        LDX #0       PRODUCT = 0 INITIALLY
E2BE- A0 00    2780        LDY #0
E2C0- 8A       2790 .1     TXA          DOUBLE PRODUCT
E2C1- 0A       2800        ASL          LOW BYTE
E2C2- AA       2810        TAX
E2C3- 98       2820        TYA          HIGH BYTE
E2C4- 2A       2830        ROL          IF TOO LARGE, SET CARRY
E2C5- A8       2840        TAY
E2C6- B0 A4    2850        BCS GME      TOO LARGE, "MEM FULL ERROR"
E2C8- 06 AD    2860        ASL STRNG2   NEXT BIT OF MUTLPLICAND
E2CA- 26 AE    2870        ROL STRNG2+1      INTO CARRY
E2CC- 90 0B    2880        BCC .2       BIT=0, DON'T NEED TO ADD
E2CE- 18       2890        CLC          BIT=1, ADD INTO PARTIAL PRODUCT
E2CF- 8A       2900        TXA
E2D0- 65 64    2910        ADC RESULT+2
E2D2- AA       2920        TAX
E2D3- 98       2930        TYA
E2D4- 65 65    2940        ADC RESULT+3
E2D6- A8       2950        TAY
E2D7- B0 93    2960        BCS GME      TOO LARGE, "MEM FULL ERROR"
E2D9- C6 99    2970 .2     DEC INDX     16-BITS YET?
E2DB- D0 E3    2980        BNE .1       NO, KEEP SHUFFLING
E2DD- 60       2990        RTS          YES, PRODUCT IN Y,X AND A,X
               3000 *--------------------------------
               3010 *      "FRE" FUNCTION
               3020 *
               3030 *      COLLECTS GARBAGE AND RETURNS # BYTES OF MEMORY LEFT
               3040 *--------------------------------
E2DE- A5 11    3050 FRE    LDA VALTYP   LOOK AT VALUE OF ARGUMENT
E2E0- F0 03    3060        BEQ .1       =0 MEANS REAL, =$FF MEANS STRING
E2E2- 20 00 E6 3070        JSR FREFAC   STRING, SO SET IT FREE IS TEMP
E2E5- 20 84 E4 3080 .1     JSR GARBAG   COLLECT ALL THE GARBAGE IN SIGHT
E2E8- 38       3090        SEC          COMPUTE SPACE BETWEEN ARRAYS AND
E2E9- A5 6F    3100        LDA FRETOP   STRING TEMP AREA
E2EB- E5 6D    3110        SBC STREND
E2ED- A8       3120        TAY
E2EE- A5 70    3130        LDA FRETOP+1
E2F0- E5 6E    3140        SBC STREND+1 FREE SPACE IN Y,A
               3150 *      FALL INTO GIVAYF TO FLOAT THE VALUE
               3160 *      NOTE THAT VALUES OVER 32767 WILL RETURN AS NEGATIVE
               3170 *--------------------------------
               3180 *      FLOAT THE SIGNED INTEGER IN A,Y
               3190 *--------------------------------
E2F2- A2 00    3200 GIVAYF LDX #0       MARK FAC VALUE TYPE REAL
E2F4- 86 11    3210        STX VALTYP
E2F6- 85 9E    3220        STA FAC+1    SAVE VALUE FROM A,Y IN MANTISSA
E2F8- 84 9F    3230        STY FAC+2
E2FA- A2 90    3240        LDX #$90     SET EXPONENT TO 2^16
E2FC- 4C 9B EB 3250        JMP FLOAT.1  CONVERT TO SIGNED FP
               3260 *--------------------------------
               3270 *      "POS" FUNCTION
               3280 *
               3290 *      RETURNS CURRENT LINE POSITION FROM MON.CH
               3300 *--------------------------------
E2FF- A4 24    3310 POS    LDY MON.CH   GET A,Y = (MON.CH, GO TO GIVAYF
               3320 *--------------------------------
               3330 *      FLOAT (Y) INTO FAC, GIVING VALUE 0-255
               3340 *--------------------------------
E301- A9 00    3350 SNGFLT LDA #0       MSB = 0
E303- 38       3360        SEC          <<< NO PURPOSE WHATSOEVER >>>
E304- F0 EC    3370        BEQ GIVAYF   ...ALWAYS
               3380 *--------------------------------
               3390 *      CHECK FOR DIRECT OR RUNNING MODE
               3400 *      GIVING ERROR IF DIRECT MODE
               3410 *--------------------------------
E306- A6 76    3420 ERRDIR LDX CURLIN+1 =$FF IF DIRECT MODE
E308- E8       3430        INX          MAKES $FF INTO ZERO
E309- D0 A1    3440        BNE RTS.9    RETURN IF RUNNING MODE
E30B- A2 95    3450        LDX #ERR.ILLDIR   DIRECT MODE, GIVE ERROR
E30D- 2C       3460        .HS 2C       TRICK TO SKIP NEXT 2 BYTES
               3470 *--------------------------------
E30E- A2 E0    3480 UNDFNC LDX #ERR.UNDEFFUNC  UNDEFINDED FUNCTION ERROR
E310- 4C 12 D4 3490        JMP ERROR
               3500 *--------------------------------
               3510 *      "DEF" STATEMENT
               3520 *--------------------------------
E313- 20 41 E3 3530 DEF    JSR FNC.     PARSE "FN", FUNCTION NAME
E316- 20 06 E3 3540        JSR ERRDIR   ERROR IF IN DIRECT MODE
E319- 20 BB DE 3550        JSR CHKOPN   NEED "("
E31C- A9 80    3560        LDA #$80     FLAG PTRGET THAT CALLED FROM "DEF FN"
E31E- 85 14    3570        STA SUBFLG   ALLOW ONLY SIMPLE FP VARIABLE FOR ARG
E320- 20 E3 DF 3580        JSR PTRGET   GET PNTR TO ARGUMENT
E323- 20 6A DD 3590        JSR CHKNUM   MUST BE NUMERIC
E326- 20 B8 DE 3600        JSR CHKCLS   MUST HAVE ")" NOW
E329- A9 D0    3610        LDA #TOKEN.EQUAL  NOW NEED "="
E32B- 20 C0 DE 3620        JSR SYNCHR   OR ELSE SYNTAX ERROR
E32E- 48       3630        PHA          SAVE CHAR AFTER "="
E32F- A5 84    3640        LDA VARPNT+1 SAVE PNTR TO ARGUMENT
E331- 48       3650        PHA
E332- A5 83    3660        LDA VARPNT
E334- 48       3670        PHA
E335- A5 B9    3680        LDA TXTPTR+1 SAVE TXTPTR
E337- 48       3690        PHA
E338- A5 B8    3700        LDA TXTPTR
E33A- 48       3710        PHA
E33B- 20 95 D9 3720        JSR DATA     SCAN TO NEXT STATEMENT
E33E- 4C AF E3 3730        JMP FNCDATA  STORE ABOVE 5 BYTES IN "VALUE"
               3740 *--------------------------------
               3750 *      COMMON ROUTINE FOR "DEFFN" AND "FN", TO
               3760 *      PARSE "FN" AND THE FUNCTION NAME
               3770 *--------------------------------
E341- A9 C2    3780 FNC.   LDA #TOKEN.FN     MUST NOW SEE "FN" TOKEN
E343- 20 C0 DE 3790        JSR SYNCHR        OR ELSE SYNTAX ERROR
E346- 09 80    3800        ORA #$80     SET SIGN BIT ON 1ST CHAR OF NAME,
E348- 85 14    3810        STA SUBFLG   MAKING $C0 < SUBFLG < $DB
E34A- 20 EA DF 3820        JSR PTRGET3  WHICH TELLS PTRGET WHO CALLED
E34D- 85 8A    3830        STA FNCNAM   FOUND VALID FUNCTION NAME, SO
E34F- 84 8B    3840        STY FNCNAM+1      SAVE ADDRESS
E351- 4C 6A DD 3850        JMP CHKNUM   MUST BE NUMERIC
               3860 *--------------------------------
               3870 *      "FN" FUNCTION CALL
               3880 *--------------------------------
E354- 20 41 E3 3890 FUNCT  JSR FNC.     PARSE "FN", FUNCTION NAME
E357- A5 8B    3900        LDA FNCNAM+1 STACK FUNCTION ADDRESS
E359- 48       3910        PHA               IN CASE OF A NESTED FN CALL
E35A- A5 8A    3920        LDA FNCNAM
E35C- 48       3930        PHA
E35D- 20 B2 DE 3940        JSR PARCHK   MUST NOW HAVE "(EXPRESSION)"
E360- 20 6A DD 3950        JSR CHKNUM   MUST BE NUMERIC EXPRESSION
E363- 68       3960        PLA          GET FUNCTION ADDRESS BACK
E364- 85 8A    3970        STA FNCNAM
E366- 68       3980        PLA
E367- 85 8B    3990        STA FNCNAM+1
E369- A0 02    4000        LDY #2       POINT AT ADD OF ARGUMENT VARIABLE
E36B- B1 8A    4010        LDA (FNCNAM),Y
E36D- 85 83    4020        STA VARPNT
E36F- AA       4030        TAX
E370- C8       4040        INY
E371- B1 8A    4050        LDA (FNCNAM),Y
E373- F0 99    4060        BEQ UNDFNC   UNDEFINED FUNCTION
E375- 85 84    4070        STA VARPNT+1
E377- C8       4080        INY          Y=4 NOW
E378- B1 83    4090 .1     LDA (VARPNT),Y  SAVE OLD VALUE OF ARGUMENT VARIABLE
E37A- 48       4100        PHA             ON STACK, IN CASE ALSO USED AS
E37B- 88       4110        DEY             A NORMAL VARIABLE!
E37C- 10 FA    4120        BPL .1
E37E- A4 84    4130        LDY VARPNT+1 (Y,X)= ADDRESS, STORE FAC IN VARIABLE
E380- 20 2B EB 4140        JSR STORE.FAC.AT.YX.ROUNDED
E383- A5 B9    4150        LDA TXTPTR+1 REMEMBER TXTPTR AFTER FN CALL
E385- 48       4160        PHA
E386- A5 B8    4170        LDA TXTPTR
E388- 48       4180        PHA
E389- B1 8A    4190        LDA (FNCNAM),Y  Y=0 FROM MOVMF
E38B- 85 B8    4200        STA TXTPTR      POINT TO FUNCTION DEF'N
E38D- C8       4210        INY
E38E- B1 8A    4220        LDA (FNCNAM),Y
E390- 85 B9    4230        STA TXTPTR+1
E392- A5 84    4240        LDA VARPNT+1 SAVE ADDRESS OF ARGUMENT VARIABLE
E394- 48       4250        PHA
E395- A5 83    4260        LDA VARPNT
E397- 48       4270        PHA
E398- 20 67 DD 4280        JSR FRMNUM   EVALUATE THE FUNCTION EXPRESSION
E39B- 68       4290        PLA          GET ADDRESS OF ARGUMENT VARIABLE
E39C- 85 8A    4300        STA FNCNAM        AND SAVE IT
E39E- 68       4310        PLA
E39F- 85 8B    4320        STA FNCNAM+1
E3A1- 20 B7 00 4330        JSR CHRGOT   MUST BE AT ":" OR EOL
E3A4- F0 03    4340        BEQ .2       WE ARE
E3A6- 4C C9 DE 4350        JMP SYNERR   WE ARE NOT, SLYNTAX ERROR
E3A9- 68       4360 .2     PLA          RETRIEVE TXTPTR AFTER "FN" CALL
E3AA- 85 B8    4370        STA TXTPTR
E3AC- 68       4380        PLA
E3AD- 85 B9    4390        STA TXTPTR+1
               4400 *                   STACK NOW HAS 5-BYTE VALUE
               4410 *                   OF THE ARGUMENT VARIABLE,
               4420 *                   AND FNCNAM POINTS AT THE VARIABLE
               4430 *--------------------------------
               4440 *      STORE FIVE BYTES FROM STACK AT (FNCNAM)
               4450 *--------------------------------
               4460 FNCDATA
E3AF- A0 00    4470        LDY #0
E3B1- 68       4480        PLA
E3B2- 91 8A    4490        STA (FNCNAM),Y
E3B4- 68       4500        PLA
E3B5- C8       4510        INY
E3B6- 91 8A    4520        STA (FNCNAM),Y
E3B8- 68       4530        PLA
E3B9- C8       4540        INY
E3BA- 91 8A    4550        STA (FNCNAM),Y
E3BC- 68       4560        PLA
E3BD- C8       4570        INY
E3BE- 91 8A    4580        STA (FNCNAM),Y
E3C0- 68       4590        PLA
E3C1- C8       4600        INY
E3C2- 91 8A    4610        STA (FNCNAM),Y
E3C4- 60       4620        RTS


               SAVE S.E3C5
               1010 *--------------------------------
               1020 *      "STR$" FUNCTION
               1030 *--------------------------------
E3C5- 20 6A DD 1040 STR    JSR CHKNUM   EXPRESSION MUST BE NUMERIC
E3C8- A0 00    1050        LDY #0       START STRING AT STACK-1 ($00FF)
               1060 *                   SO STRLIT CAN DIFFRENTIATE STR$ CALLS
E3CA- 20 36 ED 1070        JSR FOUT.1   CONVERT FAC TO STRING
E3CD- 68       1080        PLA          POP RETURN OFF STACK
E3CE- 68       1090        PLA
E3CF- A9 FF    1100        LDA #STACK-1 POINT TO STACK-1
E3D1- A0 00    1110        LDY /STACK-1 (WHICH=0)
E3D3- F0 12    1120        BEQ STRLIT   ...ALWAYS, CREATE DESC & MOVE STRING
               1130 *--------------------------------
               1140 *      GET SPACE AND MAKE DESCRIPTOR FOR STRING WHOSE
               1150 *      ADDRESS IS IN FAC+3,4 AND WHOSE LENGTH IS IN A-REG
               1160 *--------------------------------
E3D5- A6 A0    1170 STRINI LDX FAC+3    Y,X = STRING ADDRESS
E3D7- A4 A1    1180        LDY FAC+4
E3D9- 86 8C    1190        STX DSCPTR
E3DB- 84 8D    1200        STY DSCPTR+1
               1210 *--------------------------------
               1220 *      GET SPACE AND MAKE DESCRIPTOR FOR STRING WHOSE
               1230 *      ADDRESS IS IN Y,X AND WHOSE LENGTH IS IN A-REG
               1240 *--------------------------------
E3DD- 20 52 E4 1250 STRSPA JSR GETSPA   A HOLDS LENGTH
E3E0- 86 9E    1260        STX FAC+1    SAVE DESCRIPTOR IN FAC
E3E2- 84 9F    1270        STY FAC+2    ---FAC--- --FAC+1-- --FAC+2--
E3E4- 85 9D    1280        STA FAC      <LENGTH>  <ADDR-LO> <ADDR-HI>
E3E6- 60       1290        RTS
               1300 *--------------------------------
               1310 *      BUILD A DESCRIPTOR FOR STRING STARTING AT Y,A
               1320 *      AND TERMINATED BY $00 OR QUOTATION MARK
               1330 *      RETURN WITH DESCRIPTOR IN A TEMPORARY
               1340 *      AND ADDRESS OF DESCRIPTOR IN FAC+3,4
               1350 *--------------------------------
E3E7- A2 22    1360 STRLIT LDX #'"'     SET UP LITERAL SCAN TO STOP ON
E3E9- 86 0D    1370        STX CHARAC   QUOTATION MARK OR $00
E3EB- 86 0E    1380        STX ENDCHR
               1390 *--------------------------------
               1400 *      BUILD A DESCRIPTOR FOR STRING STARTING AT Y,A
               1410 *      AND TERMINATED BY $00, (CHARAC), OR (ENDCHR)
               1420 *
               1430 *      RETURN WITH DESCRIPTOR IN A TEMPORARY
               1440 *      AND ADDRESS OF DESCRIPTOR IN FAC+3,4
               1450 *--------------------------------
E3ED- 85 AB    1460 STRLT2 STA STRNG1   SAVE ADDRESS OF STRING
E3EF- 84 AC    1470        STY STRNG1+1
E3F1- 85 9E    1480        STA FAC+1       ...AGAIN
E3F3- 84 9F    1490        STY FAC+2
E3F5- A0 FF    1500        LDY #$FF
E3F7- C8       1510 .1     INY          FIND END OF STRING
E3F8- B1 AB    1520        LDA (STRNG1),Y    NEXT STRING CHAR
E3FA- F0 0C    1530        BEQ .3            END OF STRING
E3FC- C5 0D    1540        CMP CHARAC        ALTERNATE TERMINATOR # 1?
E3FE- F0 04    1550        BEQ .2            YES
E400- C5 0E    1560        CMP ENDCHR        ALTERNATE TERMINATOR # 2?
E402- D0 F3    1570        BNE .1            NO, KEEP SCANNING
E404- C9 22    1580 .2     CMP #'"'     IS STRING ENDED WITH QUOTE MARK?
E406- F0 01    1590        BEQ .4       YES, C=1 TO INCLUDE " IN STRING
E408- 18       1600 .3     CLC
E409- 84 9D    1610 .4     STY FAC      SAVE LENGTH
E40B- 98       1620        TYA
E40C- 65 AB    1630        ADC STRNG1   COMPUTE ADDRESS OF END OF STRING
E40E- 85 AD    1640        STA STRNG2        (OF 00 BYTE, OR JUST AFTER ")
E410- A6 AC    1650        LDX STRNG1+1
E412- 90 01    1660        BCC .5
E414- E8       1670        INX
E415- 86 AE    1680 .5     STX STRNG2+1
E417- A5 AC    1690        LDA STRNG1+1 WHERE DOES THE STRING START?
E419- F0 04    1700        BEQ .6       PAGE 0, MUST BE FROM STR$ FUNCTION
E41B- C9 02    1710        CMP #2       PAGE 2?
E41D- D0 0B    1720        BNE PUTNEW   NO, NOT PAGE 0 OR 2
E41F- 98       1730 .6     TYA          LENGTH OF STRING
E420- 20 D5 E3 1740        JSR STRINI   MAKE SPACE FOR STRING
E423- A6 AB    1750        LDX STRNG1
E425- A4 AC    1760        LDY STRNG1+1
E427- 20 E2 E5 1770        JSR MOVSTR   MOVE IT IN
               1780 *--------------------------------
               1790 *      STORE DESCRIPTOR IN TEMPORARY DESCRIPTOR STACK
               1800 *
               1810 *      THE DESCRIPTOR IS NOW IN FAC, FAC+1, FAC+2
               1820 *      PUT ADDRESS OF TEMP DESCRIPTOR IN FAC+3,4
               1830 *--------------------------------
E42A- A6 52    1840 PUTNEW LDX TEMPPT   POINTER TO NEXT TEMP STRING SLOT
E42C- E0 5E    1850        CPX #TEMPST+9     MAX OF 3 TEMP STRINGS
E42E- D0 05    1860        BNE PUTEMP        ROOM FOR ANOTHER ONE
E430- A2 BF    1870        LDX #ERR.FRMCPX   TOO MANY, FORMULA TOO COMPLEX
E432- 4C 12 D4 1880 JERR   JMP ERROR
               1890 *--------------------------------
E435- A5 9D    1900 PUTEMP LDA FAC      COPY TEMP DESCRIPTOR INTO TEMP STACK
E437- 95 00    1910        STA 0,X
E439- A5 9E    1920        LDA FAC+1
E43B- 95 01    1930        STA 1,X
E43D- A5 9F    1940        LDA FAC+2
E43F- 95 02    1950        STA 2,X
E441- A0 00    1960        LDY #0
E443- 86 A0    1970        STX FAC+3    ADDRESS OF TEMP DESCRIPTOR
E445- 84 A1    1980        STY FAC+4    IN Y,X AND FAC+3,4
E447- 88       1990        DEY          Y=$FF
E448- 84 11    2000        STY VALTYP   FLAG (FAC ) AS STRING
E44A- 86 53    2010        STX LASTPT   INDEX OF LAST POINTER
E44C- E8       2020        INX          UPDATE FOR NEXT TEMP ENTRY
E44D- E8       2030        INX
E44E- E8       2040        INX
E44F- 86 52    2050        STX TEMPPT
E451- 60       2060        RTS
               2070 *--------------------------------
               2080 *      MAKE SPACE FOR STRING AT BOTTOM OF STRING SPACE
               2090 *      (A)=# BYTES SPACE TO MAKE
               2100 *
               2110 *      RETURN WITH (A) SAME,
               2120 *             AND Y,X = ADDRESS OF SPACE ALLOCATED
               2130 *--------------------------------
E452- 46 13    2140 GETSPA LSR GARFLG   CLEAR SIGNBIT OF FLAG
E454- 48       2150 .1     PHA          A HOLDS LENGTH
E455- 49 FF    2160        EOR #$FF     GET -LENGTH
E457- 38       2170        SEC
E458- 65 6F    2180        ADC FRETOP   COMPUTE STARTING ADDRESS OF SPACE
E45A- A4 70    2190        LDY FRETOP+1      FOR THE STRING
E45C- B0 01    2200        BCS .2
E45E- 88       2210        DEY
E45F- C4 6E    2220 .2     CPY STREND+1      SEE IF FITS IN REMAINING MEMORY
E461- 90 11    2230        BCC .4            NO, TRY GARBAGE
E463- D0 04    2240        BNE .3            YES, IT FITS
E465- C5 6D    2250        CMP STREND        HAVE TO CHECK LOWER BYTES
E467- 90 0B    2260        BCC .4            NOT ENUF ROOM YET
E469- 85 6F    2270 .3     STA FRETOP   THERE IS ROOM SO SAVE NEW FRETOP
E46B- 84 70    2280        STY FRETOP+1
E46D- 85 71    2290        STA FRESPC
E46F- 84 72    2300        STY FRESPC+1
E471- AA       2310        TAX          ADDR IN Y,X
E472- 68       2320        PLA          LENGTH IN A
E473- 60       2330        RTS
E474- A2 4D    2340 .4     LDX #ERR.MEMFULL
E476- A5 13    2350        LDA GARFLG   GARBAGE DONE YET?
E478- 30 B8    2360        BMI JERR     YES, MEMORY IS REALLY FULL
E47A- 20 84 E4 2370        JSR GARBAG   NO, TRY COLLECTING NOW
E47D- A9 80    2380        LDA #$80     FLAG THAT COLLECTED GARBAGE ALREADY
E47F- 85 13    2390        STA GARFLG
E481- 68       2400        PLA          GET STRING LENGTH AGAIN
E482- D0 D0    2410        BNE .1       ...ALWAYS
               2420 *--------------------------------
               2430 *      SHOVE ALL REFERENCED STRINGS AS HIGH AS POSSIBLE
               2440 *      IN MEMORY (AGAINST HIMEM), FREEING UP SPACE
               2450 *      BELOW STRING AREA DOWN TO STREND.
               2460 *--------------------------------
E484- A6 73    2470 GARBAG LDX MEMSIZ   COLLECT FROM TOP DOWN
E486- A5 74    2480        LDA MEMSIZ+1
               2490 FIND.HIGHEST.STRING
E488- 86 6F    2500        STX FRETOP   ONE PASS THROUGH ALL VARS
E48A- 85 70    2510        STA FRETOP+1   FOR EACH ACTIVE STRING!
E48C- A0 00    2520        LDY #0
E48E- 84 8B    2530        STY FNCNAM+1 FLAG IN CASE NO STRINGS TO COLLECT
E490- A5 6D    2540        LDA STREND
E492- A6 6E    2550        LDX STREND+1
E494- 85 9B    2560        STA LOWTR
E496- 86 9C    2570        STX LOWTR+1
               2580 *--------------------------------
               2590 *      START BY COLLECTING TEMPORARIES
               2600 *--------------------------------
E498- A9 55    2610        LDA #TEMPST
E49A- A2 00    2620        LDX /TEMPST
E49C- 85 5E    2630        STA INDEX
E49E- 86 5F    2640        STX INDEX+1
E4A0- C5 52    2650 .1     CMP TEMPPT   FINISHED WITH TEMPS YET?
E4A2- F0 05    2660        BEQ .2       YES, NOW DO SIMPLE VARIABLES
E4A4- 20 23 E5 2670        JSR CHECK.VARIABLE     DO A TEMP
E4A7- F0 F7    2680        BEQ .1       ...ALWAYS
               2690 *--------------------------------
               2700 *      NOW COLLECT SIMPLE VARIABLES
               2710 *--------------------------------
E4A9- A9 07    2720 .2     LDA #7       LENGTH OF EACH VARIABLE IS 7 BYTES
E4AB- 85 8F    2730        STA DSCLEN
E4AD- A5 69    2740        LDA VARTAB   START AT BEGINNING OF VARTAB
E4AF- A6 6A    2750        LDX VARTAB+1
E4B1- 85 5E    2760        STA INDEX
E4B3- 86 5F    2770        STX INDEX+1
E4B5- E4 6C    2780 .3     CPX ARYTAB+1   FINISHED WITH SIMPLE VARIABLES?
E4B7- D0 04    2790        BNE .4         NO
E4B9- C5 6B    2800        CMP ARYTAB     MAYBE, CHECK LO-BYTE
E4BB- F0 05    2810        BEQ .5         YES, NOW DO ARRAYS
E4BD- 20 19 E5 2820 .4     JSR CHECK.SIMPLE.VARIABLE
E4C0- F0 F3    2830        BEQ .3       ...ALWAYS
               2840 *--------------------------------
               2850 *      NOW COLLECT ARRAY VARIABLES
               2860 *--------------------------------
E4C2- 85 94    2870 .5     STA ARYPNT
E4C4- 86 95    2880        STX ARYPNT+1
E4C6- A9 03    2890        LDA #3       DESCRIPTORS IN ARRAYS ARE 3-BYTES EACH
E4C8- 85 8F    2900        STA DSCLEN
E4CA- A5 94    2910 .6     LDA ARYPNT   COMPARE TO END OF ARRAYS
E4CC- A6 95    2920        LDX ARYPNT+1
E4CE- E4 6E    2930 .7     CPX STREND+1 FINISHED WITH ARRAYS YET?
E4D0- D0 07    2940        BNE .8       NOT YET
E4D2- C5 6D    2950        CMP STREND   MAYBE, CHECK LO-BYTE
E4D4- D0 03    2960        BNE .8       NOT FINISHED YET
E4D6- 4C 62 E5 2970        JMP MOVE.HIGHEST.STRING.TO.TOP   FINISHED
E4D9- 85 5E    2980 .8     STA INDEX    SET UP PNTR TO START OF ARRAY
E4DB- 86 5F    2990        STX INDEX+1
E4DD- A0 00    3000        LDY #0       POINT AT NAME OF ARRAY
E4DF- B1 5E    3010        LDA (INDEX),Y
E4E1- AA       3020        TAX          1ST LETTER OF NAME IN X-REG
E4E2- C8       3030        INY
E4E3- B1 5E    3040        LDA (INDEX),Y
E4E5- 08       3050        PHP          STATUS FROM SECOND LETTER OF NAME
E4E6- C8       3060        INY
E4E7- B1 5E    3070        LDA (INDEX),Y     OFFSET TO NEXT ARRAY
E4E9- 65 94    3080        ADC ARYPNT        (CARRY ALWAYS CLEAR)
E4EB- 85 94    3090        STA ARYPNT        CALCULATE START OF NEXT ARRAY
E4ED- C8       3100        INY
E4EE- B1 5E    3110        LDA (INDEX),Y     HI-BYTE OF OFFSET
E4F0- 65 95    3120        ADC ARYPNT+1
E4F2- 85 95    3130        STA ARYPNT+1
E4F4- 28       3140        PLP               GET STATUS FROM 2ND CHAR OF NAME
E4F5- 10 D3    3150        BPL .6            NOT A STRING ARRAY
E4F7- 8A       3160        TXA               SET STATUS WITH 1ST CHAR OF NAME
E4F8- 30 D0    3170        BMI .6            NOT A STRING ARRAY
E4FA- C8       3180        INY
E4FB- B1 5E    3190        LDA (INDEX),Y     # OF DIMENSIONS FOR THIS ARRAY
E4FD- A0 00    3200        LDY #0
E4FF- 0A       3210        ASL          PREAMBLE SIZE = 2*#DIMS + 5
E500- 69 05    3220        ADC #5
E502- 65 5E    3230        ADC INDEX    MAKE INDEX POINT AT FIRST ELEMENT
E504- 85 5E    3240        STA INDEX         IN THE ARRAY
E506- 90 02    3250        BCC .9
E508- E6 5F    3260        INC INDEX+1
               3270 .9
E50A- A6 5F    3280        LDX INDEX+1   STEP THRU EACH STRING IN THIS ARRAY
E50C- E4 95    3290 .10    CPX ARYPNT+1  ARRAY DONE?
E50E- D0 04    3300        BNE .11       NO, PROCESS NEXT ELEMENT
E510- C5 94    3310        CMP ARYPNT    MAYBE, CHECK LO-BYTE
E512- F0 BA    3320        BEQ .7        YES, MOVE TO NEXT ARRAY
E514- 20 23 E5 3330 .11    JSR CHECK.VARIABLE     PROCESS THE ARRAY
E517- F0 F3    3340        BEQ .10      ...ALWAYS
               3350 *--------------------------------
               3360 *      PROCESS A SIMPLE VARIABLE
               3370 *--------------------------------
               3380 CHECK.SIMPLE.VARIABLE
E519- B1 5E    3390        LDA (INDEX),Y     LOOK AT 1ST CHAR OF NAME
E51B- 30 35    3400        BMI CHECK.BUMP    NOT A STRING VARIABLE
E51D- C8       3410        INY
E51E- B1 5E    3420        LDA (INDEX),Y     LOOK AT 2ND CHAR OF NAME
E520- 10 30    3430        BPL CHECK.BUMP    NOT A STRING VARIABLE
E522- C8       3440        INY
               3450 *--------------------------------
               3460 *      IF STRING IS NOT EMPTY, CHECK IF IT IS HIGHEST
               3470 *--------------------------------
               3480 CHECK.VARIABLE
E523- B1 5E    3490        LDA (INDEX),Y     GET LENGTH OF STRING
E525- F0 2B    3500        BEQ CHECK.BUMP    IGNORE STRING IF LENGTH IS ZERO
E527- C8       3510        INY
E528- B1 5E    3520        LDA (INDEX),Y     GET ADDRESS OF STRING
E52A- AA       3530        TAX
E52B- C8       3540        INY
E52C- B1 5E    3550        LDA (INDEX),Y
E52E- C5 70    3560        CMP FRETOP+1      CHECK IF ALREADY COLLECTED
E530- 90 06    3570        BCC .1            NO, BELOW FRETOP
E532- D0 1E    3580        BNE CHECK.BUMP    YES, ABOVE FRETOP
E534- E4 6F    3590        CPX FRETOP        MAYBE, CHECK LO-BYTE
E536- B0 1A    3600        BCS CHECK.BUMP    YES, ABOVE FRETOP
E538- C5 9C    3610 .1     CMP LOWTR+1       ABOVE HIGHEST STRING FOUND?
E53A- 90 16    3620        BCC CHECK.BUMP    NO, IGNORE FOR NOW
E53C- D0 04    3630        BNE .2            YES, THIS IS THE NEW HIGHEST
E53E- E4 9B    3640        CPX LOWTR         MAYBE, TRY LO-BYTE
E540- 90 10    3650        BCC CHECK.BUMP    NO, IGNORE FOR NOW
E542- 86 9B    3660 .2     STX LOWTR    MAKE THIS THE HIGHEST STRING
E544- 85 9C    3670        STA LOWTR+1
E546- A5 5E    3680        LDA INDEX    SAVE ADDRESS OF DESCRIPTOR TOO
E548- A6 5F    3690        LDX INDEX+1
E54A- 85 8A    3700        STA FNCNAM
E54C- 86 8B    3710        STX FNCNAM+1
E54E- A5 8F    3720        LDA DSCLEN
E550- 85 91    3730        STA LENGTH
               3740 *--------------------------------
               3750 *      ADD (DSCLEN) TO PNTR IN INDEX
               3760 *      RETURN WITH Y=0, PNTR ALSO IN X,A
               3770 *--------------------------------
               3780 CHECK.BUMP
E552- A5 8F    3790        LDA DSCLEN   BUMP TO NEXT VARIABLE
E554- 18       3800        CLC
E555- 65 5E    3810        ADC INDEX
E557- 85 5E    3820        STA INDEX
E559- 90 02    3830        BCC CHECK.EXIT
E55B- E6 5F    3840        INC INDEX+1
               3850 *--------------------------------
               3860 CHECK.EXIT
E55D- A6 5F    3870        LDX INDEX+1
E55F- A0 00    3880        LDY #0
E561- 60       3890        RTS
               3900 *--------------------------------
               3910 *      FOUND HIGHEST NON-EMPTY STRING, SO MOVE IT
               3920 *      TO TOP AND GO BACK FOR ANOTHER
               3930 *--------------------------------
               3940 MOVE.HIGHEST.STRING.TO.TOP
E562- A6 8B    3950        LDX FNCNAM+1 ANY STRING FOUND?
E564- F0 F7    3960        BEQ CHECK.EXIT    NO, RETURN
E566- A5 91    3970        LDA LENGTH   GET LENGTH OF VARIABLE ELEMENT
E568- 29 04    3980        AND #4       WAS 7 OR 3, MAKE 4 OR 0
E56A- 4A       3990        LSR          2 0R 0; IN SIMPLE VARIABLES,
E56B- A8       4000        TAY          NAME PRECEDES DESCRIPTOR
E56C- 85 91    4010        STA LENGTH   2 OR 0
E56E- B1 8A    4020        LDA (FNCNAM),Y    GET LENGTH FROM DESCRIPTOR
E570- 65 9B    4030        ADC LOWTR         CARRY ALREADY CLEARED BY LSR
E572- 85 96    4040        STA HIGHTR   STRING IS BTWN (LOWTR) AND (HIGHTR)
E574- A5 9C    4050        LDA LOWTR+1
E576- 69 00    4060        ADC #0
E578- 85 97    4070        STA HIGHTR+1
E57A- A5 6F    4080        LDA FRETOP   HIGH END DESTINATION
E57C- A6 70    4090        LDX FRETOP+1
E57E- 85 94    4100        STA HIGHDS
E580- 86 95    4110        STX HIGHDS+1
E582- 20 9A D3 4120        JSR BLTU2    MOVE STRING UP
E585- A4 91    4130        LDY LENGTH   FIX ITS DESCRIPTOR
E587- C8       4140        INY          POINT AT ADDRESS IN DESCRIPTOR
E588- A5 94    4150        LDA HIGHDS   STORE NEW ADDRESS
E58A- 91 8A    4160        STA (FNCNAM),Y
E58C- AA       4170        TAX
E58D- E6 95    4180        INC HIGHDS+1 CORRECT BLTU'S OVERSHOOT
E58F- A5 95    4190        LDA HIGHDS+1
E591- C8       4200        INY
E592- 91 8A    4210        STA (FNCNAM),Y
E594- 4C 88 E4 4220        JMP FIND.HIGHEST.STRING
               4230 *--------------------------------



               SAVE S.E597
               1010 *--------------------------------
               1020 *      CONCATENATE TWO STRINGS
               1030 *--------------------------------
E597- A5 A1    1040 CAT    LDA FAC+4    SAVE ADDRESS OF FIRST DESCRIPTOR
E599- 48       1050        PHA
E59A- A5 A0    1060        LDA FAC+3
E59C- 48       1070        PHA
E59D- 20 60 DE 1080        JSR FRM.ELEMENT   GET SECOND STRING ELEMENT
E5A0- 20 6C DD 1090        JSR CHKSTR        MUST BE A STRING
E5A3- 68       1100        PLA               RECOVER ADDRES OF 1ST DESCRIPTOR
E5A4- 85 AB    1110        STA STRNG1
E5A6- 68       1120        PLA
E5A7- 85 AC    1130        STA STRNG1+1
E5A9- A0 00    1140        LDY #0
E5AB- B1 AB    1150        LDA (STRNG1),Y   ADD LENGTHS, GET CONCATENATED SIZE
E5AD- 18       1160        CLC
E5AE- 71 A0    1170        ADC (FAC+3),Y
E5B0- 90 05    1180        BCC .1            OK IF < $100
E5B2- A2 B0    1190        LDX #ERR.STRLONG
E5B4- 4C 12 D4 1200        JMP ERROR
E5B7- 20 D5 E3 1210 .1     JSR STRINI   GET SPACE FOR CONCATENATED STRINGS
E5BA- 20 D4 E5 1220        JSR MOVINS   MOVE 1ST STRING
E5BD- A5 8C    1230        LDA DSCPTR
E5BF- A4 8D    1240        LDY DSCPTR+1
E5C1- 20 04 E6 1250        JSR FRETMP
E5C4- 20 E6 E5 1260        JSR MOVSTR.1 MOVE 2ND STRING
E5C7- A5 AB    1270        LDA STRNG1
E5C9- A4 AC    1280        LDY STRNG1+1
E5CB- 20 04 E6 1290        JSR FRETMP
E5CE- 20 2A E4 1300        JSR PUTNEW   SET UP DESCRIPTOR
E5D1- 4C 95 DD 1310        JMP FRMEVL.2 FINISH EXPRESSION
               1320 *--------------------------------
               1330 *      GET STRING DESCRIPTOR POINTED AT BY (STRNG1)
               1340 *      AND MOVE DESCRIBED STRING TO (FRESPC)
               1350 *--------------------------------
E5D4- A0 00    1360 MOVINS LDY #0
E5D6- B1 AB    1370        LDA (STRNG1),Y
E5D8- 48       1380        PHA          LENGTH
E5D9- C8       1390        INY
E5DA- B1 AB    1400        LDA (STRNG1),Y
E5DC- AA       1410        TAX          PUT STRING POINTER IN X,Y
E5DD- C8       1420        INY
E5DE- B1 AB    1430        LDA (STRNG1),Y
E5E0- A8       1440        TAY
E5E1- 68       1450        PLA          RETRIEVE LENGTH
               1460 *--------------------------------
               1470 *      MOVE STRING AT (Y,X) WITH LENGTH (A)
               1480 *      TO DESTINATION WHOSE ADDRESS IS IN FRESPC,FRESPC+1
               1490 *--------------------------------
E5E2- 86 5E    1500 MOVSTR STX INDEX    PUT POINTER IN INDEX
E5E4- 84 5F    1510        STY INDEX+1
               1520 MOVSTR.1
E5E6- A8       1530        TAY          LENGTH TO Y-REG
E5E7- F0 0A    1540        BEQ .2       IF LENGTH IS ZERO, FINISHED
E5E9- 48       1550        PHA          SAVE LENGTH ON STACK
E5EA- 88       1560 .1     DEY          MOVE BYTES FROM (INDEX) TO (FRESPC)
E5EB- B1 5E    1570        LDA (INDEX),Y
E5ED- 91 71    1580        STA (FRESPC),Y
E5EF- 98       1590        TYA          TEST IF ANY LEFT TO MOVE
E5F0- D0 F8    1600        BNE .1       YES, KEEP MOVING
E5F2- 68       1610        PLA          NO, FINISHED.  GET LENGTH
E5F3- 18       1620 .2     CLC          AND ADD TO FRESPC, SO
E5F4- 65 71    1630        ADC FRESPC   FRESPC POINTS TO NEXT HIGHER
E5F6- 85 71    1640        STA FRESPC   BYTE.  (USED BY CONCATENATION)
E5F8- 90 02    1650        BCC .3
E5FA- E6 72    1660        INC FRESPC+1
E5FC- 60       1670 .3     RTS
               1680 *--------------------------------
               1690 *      IF (FAC) IS A TEMPORARY STRING, RELEASE DESCRIPTOR
               1700 *--------------------------------
E5FD- 20 6C DD 1710 FRESTR JSR CHKSTR   LAST RESULT A STRING?
               1720 *--------------------------------
               1730 *      IF STRING DESCRIPTOR POINTED TO BY FAC+3,4 IS
               1740 *      A TEMPORARY STRING, RELEASE IT.
               1750 *--------------------------------
E600- A5 A0    1760 FREFAC LDA FAC+3    GET DESCRIPTOR POINTER
E602- A4 A1    1770        LDY FAC+4
               1780 *--------------------------------
               1790 *      IF STRING DESCRIPTOR WHOSE ADDRESS IS IN Y,A IS
               1800 *      A TEMPORARY STRING, RELEASE IT.
               1810 *--------------------------------
E604- 85 5E    1820 FRETMP STA INDEX    SAVE THE ADDRESS OF THE DESCRIPTOR
E606- 84 5F    1830        STY INDEX+1
E608- 20 35 E6 1840        JSR FRETMS   FREE DESCRIPTOR IF IT IS TEMPORARY
E60B- 08       1850        PHP          REMEMBER IF TEMP
E60C- A0 00    1860        LDY #0       POINT AT LENGTH OF STRING
E60E- B1 5E    1870        LDA (INDEX),Y
E610- 48       1880        PHA          SAVE LENGTH ON STACK
E611- C8       1890        INY
E612- B1 5E    1900        LDA (INDEX),Y
E614- AA       1910        TAX          GET ADDRESS OF STRING IN Y,X
E615- C8       1920        INY
E616- B1 5E    1930        LDA (INDEX),Y
E618- A8       1940        TAY
E619- 68       1950        PLA          LENGTH IN A
E61A- 28       1960        PLP          RETRIEVE STATUS, Z=1 IF TEMP
E61B- D0 13    1970        BNE .2       NOT A TEMPORARY STRING
E61D- C4 70    1980        CPY FRETOP+1      IS IT THE LOWEST STRING?
E61F- D0 0F    1990        BNE .2            NO
E621- E4 6F    2000        CPX FRETOP
E623- D0 0B    2010        BNE .2            NO
E625- 48       2020        PHA               YES, PUSH LENGTH AGAIN
E626- 18       2030        CLC               RECOVER THE SPACE USED BY
E627- 65 6F    2040        ADC FRETOP        THE STRING
E629- 85 6F    2050        STA FRETOP
E62B- 90 02    2060        BCC .1
E62D- E6 70    2070        INC FRETOP+1
E62F- 68       2080 .1     PLA          RETRIEVE LENGTH AGAIN
E630- 86 5E    2090 .2     STX INDEX    ADDRESS OF STRING IN Y,X
E632- 84 5F    2100        STY INDEX+1  LENGTH OF STRING IN A-REG
E634- 60       2110        RTS
               2120 *--------------------------------
               2130 *      RELEASE TEMPORARY DESCRIPTOR IF Y,A = LASTPT
               2140 *--------------------------------
E635- C4 54    2150 FRETMS CPY LASTPT+1      COMPARE Y,A TO LATEST TEMP
E637- D0 0C    2160        BNE .1            NOT SAME ONE, CANNOT RELEASE
E639- C5 53    2170        CMP LASTPT
E63B- D0 08    2180        BNE .1            NOT SAME ONE, CANNOT RELEASE
E63D- 85 52    2190        STA TEMPPT        UPDATE TEMPT FOR NEXT TEMP
E63F- E9 03    2200        SBC #3            BACK OFF LASTPT
E641- 85 53    2210        STA LASTPT
E643- A0 00    2220        LDY #0            NOW Y,A POINTS TO TOP TEMP
E645- 60       2230 .1     RTS          Z=0 IF NOT TEMP, Z=1 IF TEMP
               2240 *--------------------------------
               2250 *      "CHR$" FUNCTION
               2260 *--------------------------------
E646- 20 FB E6 2270 CHRSTR JSR CONINT   CONVERT ARGUMENT TO BYTE IN X
E649- 8A       2280        TXA
E64A- 48       2290        PHA          SAVE IT
E64B- A9 01    2300        LDA #1       GET SPACE FOR STRING OF LENGTH 1
E64D- 20 DD E3 2310        JSR STRSPA
E650- 68       2320        PLA          RECALL THE CHARACTER
E651- A0 00    2330        LDY #0       PUT IN STRING
E653- 91 9E    2340        STA (FAC+1),Y
E655- 68       2350        PLA          POP RETURN ADDRESS
E656- 68       2360        PLA
E657- 4C 2A E4 2370        JMP PUTNEW   MAKE IT A TEMPORARY STRING
               2380 *--------------------------------
               2390 *      "LEFT$" FUNCTION
               2400 *--------------------------------
               2410 LEFTSTR
E65A- 20 B9 E6 2420        JSR SUBSTRING.SETUP
E65D- D1 8C    2430        CMP (DSCPTR),Y    COMPARE 1ST PARAMETER TO LENGTH
E65F- 98       2440        TYA               Y=A=0
               2450 SUBSTRING.1
E660- 90 04    2460        BCC .1            1ST PARAMETER SMALLER, USE IT
E662- B1 8C    2470        LDA (DSCPTR),Y    1ST IS LONGER, USE STRING LENGTH
E664- AA       2480        TAX               IN X-REG
E665- 98       2490        TYA               Y=A=0 AGAIN
E666- 48       2500 .1     PHA               PUSH LEFT END OF SUBSTRING
               2510 SUBSTRING.2
E667- 8A       2520        TXA
               2530 SUBSTRING.3
E668- 48       2540        PHA               PUSH LENGTH OF SUBSTRING
E669- 20 DD E3 2550        JSR STRSPA        MAKE ROOM FOR STRING OF (A) BYTES
E66C- A5 8C    2560        LDA DSCPTR        RELEASE PARAMETER STRING IF TEMP
E66E- A4 8D    2570        LDY DSCPTR+1
E670- 20 04 E6 2580        JSR FRETMP
E673- 68       2590        PLA               GET LENGTH OF SUBSTRING
E674- A8       2600        TAY               IN Y-REG
E675- 68       2610        PLA               GET LEFT END OF SUBSTRING
E676- 18       2620        CLC               ADD TO POINTER TO STRING
E677- 65 5E    2630        ADC INDEX
E679- 85 5E    2640        STA INDEX
E67B- 90 02    2650        BCC .1
E67D- E6 5F    2660        INC INDEX+1
E67F- 98       2670 .1     TYA               LENGTH
E680- 20 E6 E5 2680        JSR MOVSTR.1      COPY STRING INTO SPACE
E683- 4C 2A E4 2690        JMP PUTNEW        ADD TO TEMPS
               2700 *--------------------------------
               2710 *      "RIGHT$" FUNCTION
               2720 *--------------------------------
               2730 RIGHTSTR
E686- 20 B9 E6 2740        JSR SUBSTRING.SETUP
E689- 18       2750        CLC          COMPUTE LENGTH-WIDTH OF SUBSTRING
E68A- F1 8C    2760        SBC (DSCPTR),Y    TO GET STARTING POINT IN STRING
E68C- 49 FF    2770        EOR #$FF
E68E- 4C 60 E6 2780        JMP SUBSTRING.1   JOIN LEFT$
               2790 *--------------------------------
               2800 *      "MID$" FUNCTION
               2810 *--------------------------------
E691- A9 FF    2820 MIDSTR LDA #$FF     FLAG WHETHER 2ND PARAMETER
E693- 85 A1    2830        STA FAC+4
E695- 20 B7 00 2840        JSR CHRGOT   SEE IF ")" YET
E698- C9 29    2850        CMP #')'
E69A- F0 06    2860        BEQ .1       YES, NO 2ND PARAMETER
E69C- 20 BE DE 2870        JSR CHKCOM   NO, MUST HAVE COMMA
E69F- 20 F8 E6 2880        JSR GETBYT   GET 2ND PARAM IN X-REG
E6A2- 20 B9 E6 2890 .1     JSR SUBSTRING.SETUP
E6A5- CA       2900        DEX          1ST PARAMETER - 1
E6A6- 8A       2910        TXA
E6A7- 48       2920        PHA
E6A8- 18       2930        CLC
E6A9- A2 00    2940        LDX #0
E6AB- F1 8C    2950        SBC (DSCPTR),Y
E6AD- B0 B8    2960        BCS SUBSTRING.2
E6AF- 49 FF    2970        EOR #$FF
E6B1- C5 A1    2980        CMP FAC+4    USE SMALLER OF TWO
E6B3- 90 B3    2990        BCC SUBSTRING.3
E6B5- A5 A1    3000        LDA FAC+4
E6B7- B0 AF    3010        BCS SUBSTRING.3   ...ALWAYS
               3020 *--------------------------------
               3030 *      COMMON SETUP ROUTINE FOR LEFT$, RIGHT$, MID$:
               3040 *      REQUIRE ")"; POP RETURN ADRS, GET DESCRIPTOR
               3050 *      ADDRESS, GET 1ST PARAMETER OF COMMAND
               3060 *--------------------------------
               3070 SUBSTRING.SETUP
E6B9- 20 B8 DE 3080        JSR CHKCLS   REQUIRE ")"
E6BC- 68       3090        PLA          SAVE RETURN ADDRESS
E6BD- A8       3100        TAY          IN Y-REG AND LENGTH
E6BE- 68       3110        PLA
E6BF- 85 91    3120        STA LENGTH
E6C1- 68       3130        PLA          POP PREVIOUS RETURN ADDRESS
E6C2- 68       3140        PLA           (FROM GOROUT).
E6C3- 68       3150        PLA          RETRIEVE 1ST PARAMETER
E6C4- AA       3160        TAX
E6C5- 68       3170        PLA          GET ADDRESS OF STRING DESCRIPTOR
E6C6- 85 8C    3180        STA DSCPTR
E6C8- 68       3190        PLA
E6C9- 85 8D    3200        STA DSCPTR+1
E6CB- A5 91    3210        LDA LENGTH   RESTORE RETURN ADDRESS
E6CD- 48       3220        PHA
E6CE- 98       3230        TYA
E6CF- 48       3240        PHA
E6D0- A0 00    3250        LDY #0
E6D2- 8A       3260        TXA          GET 1ST PARAMETER IN A-REG
E6D3- F0 1D    3270        BEQ GOIQ     ERROR IF 0
E6D5- 60       3280        RTS
               3290 *--------------------------------
               3300 *      "LEN" FUNCTION
               3310 *--------------------------------
E6D6- 20 DC E6 3320 LEN    JSR GETSTR   GET LENTGH IN Y-REG, MAKE FAC NUMERIC
E6D9- 4C 01 E3 3330        JMP SNGFLT   FLOAT Y-REG INTO FAC
               3340 *--------------------------------
               3350 *      IF LAST RESULT IS A TEMPORARY STRING, FREE IT
               3360 *      MAKE VALTYP NUMERIC, RETURN LENGTH IN Y-REG
               3370 *--------------------------------
E6DC- 20 FD E5 3380 GETSTR JSR FRESTR   IF LAST RESULT IS A STRING, FREE IT
E6DF- A2 00    3390        LDX #0       MAKE VALTYP NUMERIC
E6E1- 86 11    3400        STX VALTYP
E6E3- A8       3410        TAY          LENGTH OF STRING TO Y-REG
E6E4- 60       3420        RTS
               3430 *--------------------------------
               3440 *      "ASC" FUNCTION
               3450 *--------------------------------
E6E5- 20 DC E6 3460 ASC    JSR GETSTR   GET STRING, GET LENGTH IN Y-REG
E6E8- F0 08    3470        BEQ GOIQ     ERROR IF LENGTH 0
E6EA- A0 00    3480        LDY #0
E6EC- B1 5E    3490        LDA (INDEX),Y     GET 1ST CHAR OF STRING
E6EE- A8       3500        TAY
E6EF- 4C 01 E3 3510        JMP SNGFLT        FLOAT Y-REG INTO FAC
               3520 *--------------------------------
E6F2- 4C 99 E1 3530 GOIQ   JMP IQERR    ILLEGAL QUANTITY ERROR
               3540 *--------------------------------
               3550 *      SCAN TO NEXT CHARACTER AND CONVERT EXPRESSION
               3560 *      TO SINGLE BYTE IN X-REG
               3570 *--------------------------------
E6F5- 20 B1 00 3580 GTBYTC JSR CHRGET
               3590 *--------------------------------
               3600 *      EVALUATE EXPRESSION AT TXTPTR, AND
               3610 *      CONVERT IT TO SINGLE BYTE IN X-REG
               3620 *--------------------------------
E6F8- 20 67 DD 3630 GETBYT JSR FRMNUM
               3640 *--------------------------------
               3650 *      CONVERT (FAC) TO SINGLE BYTE INTEGER IN X-REG
               3660 *--------------------------------
E6FB- 20 08 E1 3670 CONINT JSR MKINT    CONVERT IF IN RANGE -32767 TO +32767
E6FE- A6 A0    3680        LDX FAC+3    HI-BYTE MUST BE ZERO
E700- D0 F0    3690        BNE GOIQ     VALUE > 255, ERROR
E702- A6 A1    3700        LDX FAC+4    VALUE IN X-REG
E704- 4C B7 00 3710        JMP CHRGOT   GET NEXT CHAR IN A-REG
               3720 *--------------------------------
               3730 *      "VAL" FUNCTION
               3740 *--------------------------------
E707- 20 DC E6 3750 VAL    JSR GETSTR   GET POINTER TO STRING IN INDEX
E70A- D0 03    3760        BNE .1       LENGTH NON-ZERO
E70C- 4C 4E E8 3770        JMP ZERO.FAC      RETURN 0 IF LENGTH=0
E70F- A6 B8    3780 .1     LDX TXTPTR   SAVE CURRENT TXTPTR
E711- A4 B9    3790        LDY TXTPTR+1
E713- 86 AD    3800        STX STRNG2
E715- 84 AE    3810        STY STRNG2+1
E717- A6 5E    3820        LDX INDEX
E719- 86 B8    3830        STX TXTPTR   POINT TXTPTR TO START OF STRING
E71B- 18       3840        CLC
E71C- 65 5E    3850        ADC INDEX    ADD LENGTH
E71E- 85 60    3860        STA DEST     POINT DEST TO END OF STRING + 1
E720- A6 5F    3870        LDX INDEX+1
E722- 86 B9    3880        STX TXTPTR+1
E724- 90 01    3890        BCC .2
E726- E8       3900        INX
E727- 86 61    3910 .2     STX DEST+1
E729- A0 00    3920        LDY #0       SAVE BYTE THAT FOLLOWS STRING
E72B- B1 60    3930        LDA (DEST),Y      ON STACK
E72D- 48       3940        PHA
E72E- A9 00    3950        LDA #0            AND STORE $00 IN ITS PLACE
E730- 91 60    3960        STA (DEST),Y
               3970 *  <<< THAT CAUSES A BUG IF HIMEM = $BFFF, >>>
               3980 *  <<< BECAUSE STORING $00 AT $C000 IS NO  >>>
               3990 *  <<< USE; $C000 WILL ALWAYS BE LAST CHAR >>>
               4000 *  <<< TYPED, SO FIN WON'T TERMINATE UNTIL >>>
               4010 *  <<< IT SEES A ZERO AT $C010!            >>>
E732- 20 B7 00 4020        JSR CHRGOT   PRIME THE PUMP
E735- 20 4A EC 4030        JSR FIN      EVALUATE STRING
E738- 68       4040        PLA          GET BYTE THAT SHOULD FOLLOW STRING
E739- A0 00    4050        LDY #0       AND PUT IT BACK
E73B- 91 60    4060        STA (DEST),Y
               4070 *                   RESTORE TXTPTR
               4080 *--------------------------------
               4090 *      COPY STRNG2 INTO TXTPTR
               4100 *--------------------------------
E73D- A6 AD    4110 POINT  LDX STRNG2
E73F- A4 AE    4120        LDY STRNG2+1
E741- 86 B8    4130        STX TXTPTR
E743- 84 B9    4140        STY TXTPTR+1
E745- 60       4150        RTS
               4160 *--------------------------------
               4170 *      EVALUATE "EXP1,EXP2"
               4180 *
               4190 *      CONVERT EXP1 TO 16-BIT NUMBER IN LINNUM
               4200 *      CONVERT EXP2 TO 8-BIT NUMBER IN X-REG
               4210 *--------------------------------
E746- 20 67 DD 4220 GTNUM  JSR FRMNUM
E749- 20 52 E7 4230        JSR GETADR
               4240 *--------------------------------
               4250 *      EVALUATE ",EXPRESSION"
               4260 *      CONVERT EXPRESSION TO SINGLE BYTE IN X-REG
               4270 *--------------------------------
               4280 COMBYTE
E74C- 20 BE DE 4290        JSR CHKCOM   MUST HAVE COMMA FIRST
E74F- 4C F8 E6 4300        JMP GETBYT   CONVERT EXPRESSION TO BYTE IN X-REG
               4310 *--------------------------------
               4320 *      CONVERT (FAC) TO A 16-BIT VALUE IN LINNUM
               4330 *--------------------------------
E752- A5 9D    4340 GETADR LDA FAC      FAC < 2^16?
E754- C9 91    4350        CMP #$91
E756- B0 9A    4360        BCS GOIQ     NO, ILLEGAL QUANTITY
E758- 20 F2 EB 4370        JSR QINT     CONVERT TO INTEGER
E75B- A5 A0    4380        LDA FAC+3    COPY IT INTO LINNUM
E75D- A4 A1    4390        LDY FAC+4
E75F- 84 50    4400        STY LINNUM    TO LINNUM
E761- 85 51    4410        STA LINNUM+1
E763- 60       4420        RTS
               4430 *--------------------------------
               4440 *      "PEEK" FUNCTION
               4450 *--------------------------------
E764- A5 50    4460 PEEK   LDA LINNUM   SAVE (LINNUM) ON STACK DURING PEEK
E766- 48       4470        PHA
E767- A5 51    4480        LDA LINNUM+1
E769- 48       4490        PHA
E76A- 20 52 E7 4500        JSR GETADR   GET ADDRESS PEEKING AT
E76D- A0 00    4510        LDY #0
E76F- B1 50    4520        LDA (LINNUM),Y    TAKE A QUICK LOOK
E771- A8       4530        TAY               VALUE IN Y-REG
E772- 68       4540        PLA          RESTORE LINNUM FROM STACK
E773- 85 51    4550        STA LINNUM+1
E775- 68       4560        PLA
E776- 85 50    4570        STA LINNUM
E778- 4C 01 E3 4580        JMP SNGFLT   FLOAT Y-REG INTO FAC
               4590 *--------------------------------
               4600 *      "POKE" STATEMENT
               4610 *--------------------------------
E77B- 20 46 E7 4620 POKE   JSR GTNUM    GET THE ADDRESS AND VALUE
E77E- 8A       4630        TXA               VALUE IN A,
E77F- A0 00    4640        LDY #0
E781- 91 50    4650        STA (LINNUM),Y    STORE IT AWAY,
E783- 60       4660        RTS               AND THAT'S ALL FOR TODAY
               4670 *--------------------------------
               4680 *      "WAIT" STATEMENT
               4690 *--------------------------------
E784- 20 46 E7 4700 WAIT   JSR GTNUM    GET ADDRESS IN LINNUM, MASK IN X
E787- 86 85    4710        STX FORPNT   SAVE MASK
E789- A2 00    4720        LDX #0
E78B- 20 B7 00 4730        JSR CHRGOT   ANOTHER PARAMETER?
E78E- F0 03    4740        BEQ .1       NO, USE $00 FOR EXCLUSIVE-OR
E790- 20 4C E7 4750        JSR COMBYTE  GET XOR-MASK
E793- 86 86    4760 .1     STX FORPNT+1 SAVE XOR-MASK HERE
E795- A0 00    4770        LDY #0
E797- B1 50    4780 .2     LDA (LINNUM),Y  GET BYTE AT ADDRESS
E799- 45 86    4790        EOR FORPNT+1    INVERT SPECIFIED BITS
E79B- 25 85    4800        AND FORPNT      SELECT SPECIFIED BITS
E79D- F0 F8    4810        BEQ .2          LOOP TILL NOT 0
E79F- 60       4820 RTS.10 RTS



               SAVE S.E7A0
               1010 *--------------------------------
               1020 *      ADD 0.5 TO FAC
               1030 *--------------------------------
E7A0- A9 64    1040 FADDH  LDA #CON.HALF     FAC+1/2 -> FAC
E7A2- A0 EE    1050        LDY /CON.HALF
E7A4- 4C BE E7 1060        JMP FADD
               1070 *--------------------------------
               1080 *      FAC = (Y,A) - FAC
               1090 *--------------------------------
E7A7- 20 E3 E9 1100 FSUB   JSR LOAD.ARG.FROM.YA
               1110 *--------------------------------
               1120 *      FAC = ARG - FAC
               1130 *--------------------------------
E7AA- A5 A2    1140 FSUBT  LDA FAC.SIGN   COMPLEMENT FAC AND ADD
E7AC- 49 FF    1150        EOR #$FF
E7AE- 85 A2    1160        STA FAC.SIGN
E7B0- 45 AA    1170        EOR ARG.SIGN   FIX SGNCPR TOO
E7B2- 85 AB    1180        STA SGNCPR
E7B4- A5 9D    1190        LDA FAC        MAKE STATUS SHOW FAC EXPONENT
E7B6- 4C C1 E7 1200        JMP FADDT      JOIN FADD
               1210 *--------------------------------
               1220 *      SHIFT SMALLER ARGUMENT MORE THAN 7 BITS
               1230 *--------------------------------
E7B9- 20 F0 E8 1240 FADD.1 JSR SHIFT.RIGHT   ALIGN RADIX BY SHIFTING
E7BC- 90 3C    1250        BCC FADD.3   ...ALWAYS
               1260 *--------------------------------
               1270 *      FAC = (Y,A) + FAC
               1280 *--------------------------------
E7BE- 20 E3 E9 1290 FADD   JSR LOAD.ARG.FROM.YA
               1300 *--------------------------------
               1310 *      FAC = ARG + FAC
               1320 *--------------------------------
E7C1- D0 03    1330 FADDT  BNE .1       FAC IS NON-ZERO
E7C3- 4C 53 EB 1340        JMP COPY.ARG.TO.FAC   FAC = 0 + ARG
E7C6- A6 AC    1350 .1     LDX FAC.EXTENSION
E7C8- 86 92    1360        STX ARG.EXTENSION
E7CA- A2 A5    1370        LDX #ARG     SET UP TO SHIFT ARG
E7CC- A5 A5    1380        LDA ARG      EXPONENT
               1390 *--------------------------------
E7CE- A8       1400 FADD.2 TAY
E7CF- F0 CE    1410        BEQ RTS.10   IF ARG=0, WE ARE FINISHED
E7D1- 38       1420        SEC
E7D2- E5 9D    1430        SBC FAC      GET DIFFNCE OF EXP
E7D4- F0 24    1440        BEQ FADD.3   GO ADD IF SAME EXP
E7D6- 90 12    1450        BCC .1       ARG HAS SMALLER EXPONENT
E7D8- 84 9D    1460        STY FAC      EXP HAS SMALLER EXPONENT
E7DA- A4 AA    1470        LDY ARG.SIGN
E7DC- 84 A2    1480        STY FAC.SIGN
E7DE- 49 FF    1490        EOR #$FF     COMPLEMENT SHIFT COUNT
E7E0- 69 00    1500        ADC #0       CARRY WAS SET
E7E2- A0 00    1510        LDY #0
E7E4- 84 92    1520        STY ARG.EXTENSION
E7E6- A2 9D    1530        LDX #FAC     SET UP TO SHIFT FAC
E7E8- D0 04    1540        BNE .2       ...ALWAYS
E7EA- A0 00    1550 .1     LDY #0
E7EC- 84 AC    1560        STY FAC.EXTENSION
E7EE- C9 F9    1570 .2     CMP #$F9     SHIFT MORE THAN 7 BITS?
E7F0- 30 C7    1580        BMI FADD.1      YES
E7F2- A8       1590        TAY          INDEX TO # OF SHIFTS
E7F3- A5 AC    1600        LDA FAC.EXTENSION
E7F5- 56 01    1610        LSR 1,X      START SHIFTING...
E7F7- 20 07 E9 1620        JSR SHIFT.RIGHT.4  ...COMPLETE SHIFTING
E7FA- 24 AB    1630 FADD.3 BIT SGNCPR   DO FAC AND ARG HAVE SAME SIGNS?
E7FC- 10 57    1640        BPL FADD.4   YES, ADD THE MANTISSAS
E7FE- A0 9D    1650        LDY #FAC     NO, SUBTRACT SMALLER FROM LARGER
E800- E0 A5    1660        CPX #ARG     WHICH WAS ADJUSTED?
E802- F0 02    1670        BEQ .1       IF ARG, DO FAC-ARG
E804- A0 A5    1680        LDY #ARG     IF FAC, DO ARG-FAC
E806- 38       1690 .1     SEC          SUBTRACT SMALLER FROM LARGER (WE HOPE)
E807- 49 FF    1700        EOR #$FF     (IF EXPONENTS WERE EQUAL, WE MIGHT BE
E809- 65 92    1710        ADC ARG.EXTENSION  SUBTRACTING LARGER FROM SMALLER)
E80B- 85 AC    1720        STA FAC.EXTENSION
E80D- B9 04 00 1730        LDA 4,Y
E810- F5 04    1740        SBC 4,X
E812- 85 A1    1750        STA FAC+4
E814- B9 03 00 1760        LDA 3,Y
E817- F5 03    1770        SBC 3,X
E819- 85 A0    1780        STA FAC+3
E81B- B9 02 00 1790        LDA 2,Y
E81E- F5 02    1800        SBC 2,X
E820- 85 9F    1810        STA FAC+2
E822- B9 01 00 1820        LDA 1,Y
E825- F5 01    1830        SBC 1,X
E827- 85 9E    1840        STA FAC+1
               1850 *--------------------------------
               1860 *      NORMALIZE VALUE IN FAC
               1870 *--------------------------------
               1880 NORMALIZE.FAC.1
E829- B0 03    1890        BCS NORMALIZE.FAC.2
E82B- 20 9E E8 1900        JSR COMPLEMENT.FAC
               1910 *--------------------------------
               1920 NORMALIZE.FAC.2
E82E- A0 00    1930        LDY #0       SHIFT UP SIGNIF DIGIT
E830- 98       1940        TYA          START A=0, COUNT SHIFTS IN A-REG
E831- 18       1950        CLC
E832- A6 9E    1960 .1     LDX FAC+1    LOOK AT MOST SIGNIFICANT BYTE
E834- D0 4A    1970        BNE NORMALIZE.FAC.4   SOME 1-BITS HERE
E836- A6 9F    1980        LDX FAC+2    HI-BYTE OF MANTISSA STILL ZERO,
E838- 86 9E    1990        STX FAC+1         SO DO A FAST 8-BIT SHUFFLE
E83A- A6 A0    2000        LDX FAC+3
E83C- 86 9F    2010        STX FAC+2
E83E- A6 A1    2020        LDX FAC+4
E840- 86 A0    2030        STX FAC+3
E842- A6 AC    2040        LDX FAC.EXTENSION
E844- 86 A1    2050        STX FAC+4
E846- 84 AC    2060        STY FAC.EXTENSION  ZERO EXTENSION BYTE
E848- 69 08    2070        ADC #8       BUMP SHIFT COUNT
E84A- C9 20    2080        CMP #32      DONE 4 TIMES YET?
E84C- D0 E4    2090        BNE .1       NO, STILL MIGHT BE SOME 1'S
               2100 *                   YES, VALUE OF FAC IS ZERO
               2110 *--------------------------------
               2120 *      SET FAC = 0
               2130 *      (ONLY NECESSARY TO ZERO EXPONENT AND SIGN CELLS)
               2140 *--------------------------------
               2150 ZERO.FAC
E84E- A9 00    2160        LDA #0
               2170 *--------------------------------
               2180 STA.IN.FAC.SIGN.AND.EXP
E850- 85 9D    2190        STA FAC
               2200 *--------------------------------
               2210 STA.IN.FAC.SIGN
E852- 85 A2    2220        STA FAC.SIGN
E854- 60       2230        RTS
               2240 *--------------------------------
               2250 *      ADD MANTISSAS OF FAC AND ARG INTO FAC
               2260 *--------------------------------
E855- 65 92    2270 FADD.4 ADC ARG.EXTENSION
E857- 85 AC    2280        STA FAC.EXTENSION
E859- A5 A1    2290        LDA FAC+4
E85B- 65 A9    2300        ADC ARG+4
E85D- 85 A1    2310        STA FAC+4
E85F- A5 A0    2320        LDA FAC+3
E861- 65 A8    2330        ADC ARG+3
E863- 85 A0    2340        STA FAC+3
E865- A5 9F    2350        LDA FAC+2
E867- 65 A7    2360        ADC ARG+2
E869- 85 9F    2370        STA FAC+2
E86B- A5 9E    2380        LDA FAC+1
E86D- 65 A6    2390        ADC ARG+1
E86F- 85 9E    2400        STA FAC+1
E871- 4C 8D E8 2410        JMP NORMALIZE.FAC.5
               2420 *--------------------------------
               2430 *      FINISH NORMALIZING FAC
               2440 *--------------------------------
               2450 NORMALIZE.FAC.3
E874- 69 01    2460        ADC #1       COUNT BITS SHIFTED
E876- 06 AC    2470        ASL FAC.EXTENSION
E878- 26 A1    2480        ROL FAC+4
E87A- 26 A0    2490        ROL FAC+3
E87C- 26 9F    2500        ROL FAC+2
E87E- 26 9E    2510        ROL FAC+1
               2520 *--------------------------------
               2530 NORMALIZE.FAC.4
E880- 10 F2    2540        BPL NORMALIZE.FAC.3    UNTIL TOP BIT = 1
E882- 38       2550        SEC
E883- E5 9D    2560        SBC FAC      ADJUST EXPONENT BY BITS SHIFTED
E885- B0 C7    2570        BCS ZERO.FAC UNDERFLOW, RETURN ZERO
E887- 49 FF    2580        EOR #$FF
E889- 69 01    2590        ADC #1       2'S COMPLEMENT
E88B- 85 9D    2600        STA FAC      CARRY=0 NOW
               2610 *--------------------------------
               2620 NORMALIZE.FAC.5
E88D- 90 0E    2630        BCC RTS.11   UNLESS MANTISSA CARRIED
               2640 *--------------------------------
               2650 NORMALIZE.FAC.6
E88F- E6 9D    2660        INC FAC      MANTISSA CARRIED, SO SHIFT RIGHT
E891- F0 42    2670        BEQ OVERFLOW      OVERFLOW IF EXPONENT TOO BIG
E893- 66 9E    2680        ROR FAC+1
E895- 66 9F    2690        ROR FAC+2
E897- 66 A0    2700        ROR FAC+3
E899- 66 A1    2710        ROR FAC+4
E89B- 66 AC    2720        ROR FAC.EXTENSION
E89D- 60       2730 RTS.11 RTS
               2740 *--------------------------------
               2750 *      2'S COMPLEMENT OF FAC
               2760 *--------------------------------
               2770 COMPLEMENT.FAC
E89E- A5 A2    2780        LDA FAC.SIGN
E8A0- 49 FF    2790        EOR #$FF
E8A2- 85 A2    2800        STA FAC.SIGN
               2810 *--------------------------------
               2820 *      2'S COMPLEMENT OF FAC MANTISSA ONLY
               2830 *--------------------------------
               2840 COMPLEMENT.FAC.MANTISSA
E8A4- A5 9E    2850        LDA FAC+1
E8A6- 49 FF    2860        EOR #$FF
E8A8- 85 9E    2870        STA FAC+1
E8AA- A5 9F    2880        LDA FAC+2
E8AC- 49 FF    2890        EOR #$FF
E8AE- 85 9F    2900        STA FAC+2
E8B0- A5 A0    2910        LDA FAC+3
E8B2- 49 FF    2920        EOR #$FF
E8B4- 85 A0    2930        STA FAC+3
E8B6- A5 A1    2940        LDA FAC+4
E8B8- 49 FF    2950        EOR #$FF
E8BA- 85 A1    2960        STA FAC+4
E8BC- A5 AC    2970        LDA FAC.EXTENSION
E8BE- 49 FF    2980        EOR #$FF
E8C0- 85 AC    2990        STA FAC.EXTENSION
E8C2- E6 AC    3000        INC FAC.EXTENSION START INCREMENTING MANTISSA
E8C4- D0 0E    3010        BNE RTS.12
               3020 *--------------------------------
               3030 *      INCREMENT FAC MANTISSA
               3040 *--------------------------------
               3050 INCREMENT.FAC.MANTISSA
E8C6- E6 A1    3060        INC FAC+4   ADD CARRY FROM EXTRA
E8C8- D0 0A    3070        BNE RTS.12
E8CA- E6 A0    3080        INC FAC+3
E8CC- D0 06    3090        BNE RTS.12
E8CE- E6 9F    3100        INC FAC+2
E8D0- D0 02    3110        BNE RTS.12
E8D2- E6 9E    3120        INC FAC+1
E8D4- 60       3130 RTS.12 RTS
               3140 *--------------------------------
               3150 OVERFLOW
E8D5- A2 45    3160        LDX #ERR.OVERFLOW
E8D7- 4C 12 D4 3170        JMP ERROR
               3180 *--------------------------------
               3190 *      SHIFT 1,X THRU 5,X RIGHT
               3200 *      (A) = NEGATIVE OF SHIFT COUNT
               3210 *      (X) = POINTER TO BYTES TO BE SHIFTED
               3220 *
               3230 *      RETURN WITH (Y)=0, CARRY=0, EXTENSION BITS IN A-REG
               3240 *--------------------------------
               3250 SHIFT.RIGHT.1
E8DA- A2 61    3260        LDX #RESULT-1     SHIFT RESULT RIGHT
               3270 SHIFT.RIGHT.2
E8DC- B4 04    3280        LDY 4,X           SHIFT 8 BITS RIGHT
E8DE- 84 AC    3290        STY FAC.EXTENSION
E8E0- B4 03    3300        LDY 3,X
E8E2- 94 04    3310        STY 4,X
E8E4- B4 02    3320        LDY 2,X
E8E6- 94 03    3330        STY 3,X
E8E8- B4 01    3340        LDY 1,X
E8EA- 94 02    3350        STY 2,X
E8EC- A4 A4    3360        LDY SHIFT.SIGN.EXT   $00 IF +, $FF IF -
E8EE- 94 01    3370        STY 1,X
               3380 *--------------------------------
               3390 *      MAIN ENTRY TO RIGHT SHIFT SUBROUTINE
               3400 *--------------------------------
               3410 SHIFT.RIGHT
E8F0- 69 08    3420        ADC #8
E8F2- 30 E8    3430        BMI SHIFT.RIGHT.2 STILL MORE THAN 8 BITS TO GO
E8F4- F0 E6    3440        BEQ SHIFT.RIGHT.2 EXACTLY 8 MORE BITS TO GO
E8F6- E9 08    3450        SBC #8            UNDO ADC ABOVE
E8F8- A8       3460        TAY               REMAINING SHIFT COUNT
E8F9- A5 AC    3470        LDA FAC.EXTENSION
E8FB- B0 14    3480        BCS SHIFT.RIGHT.5 FINISHED SHIFTING
               3490 SHIFT.RIGHT.3
E8FD- 16 01    3500 L      ASL 1,X           SIGN -> CARRY (SIGN EXTENSION)
E8FF- 90 02    3510        BCC .1            SIGN +
E901- F6 01    3520        INC 1,X           PUT SIGN IN LSB
E903- 76 01    3530 .1     ROR 1,X          RESTORE VALUE, SIGN STILL IN CARRY
E905- 76 01    3540        ROR 1,X           START RIGHT SHIFT, INSERTING SIGN
               3550 *--------------------------------
               3560 *      ENTER HERE FOR SHORT SHIFTS WITH NO SIGN EXTENSION
               3570 *--------------------------------
               3580 SHIFT.RIGHT.4
E907- 76 02    3590        ROR 2,X
E909- 76 03    3600        ROR 3,X
E90B- 76 04    3610        ROR 4,X
E90D- 6A       3620        ROR               EXTENSION
E90E- C8       3630        INY               COUNT THE SHIFT
E90F- D0 EC    3640        BNE SHIFT.RIGHT.3
               3650 SHIFT.RIGHT.5
E911- 18       3660        CLC               RETURN WITH CARRY CLEAR
E912- 60       3670        RTS
               3680 *--------------------------------




               SAVE S.E913
               1010 *--------------------------------
E913- 81 00 00
E916- 00 00    1020 CON.ONE .HS 8100000000
               1030 *--------------------------------
E918- 03       1040 POLY.LOG     .DA #3      # OF COEFFICIENTS - 1
E919- 7F 5E 56
E91C- CB 79    1050              .HS 7F5E56CB79 * X^7 +
E91E- 80 13 9B
E921- 0B 64    1060              .HS 80139B0B64 * X^5 +
E923- 80 76 38
E926- 93 16    1070              .HS 8076389316 * X^3 +
E928- 82 38 AA
E92B- 3B 20    1080              .HS 8238AA3B20 * X
               1090 *--------------------------------
E92D- 80 35 04
E930- F3 34    1100 CON.SQR.HALF .HS 803504F334
E932- 81 35 04
E935- F3 34    1110 CON.SQR.TWO  .HS 813504F334
E937- 80 80 00
E93A- 00 00    1120 CON.NEG.HALF .HS 8080000000
E93C- 80 31 72
E93F- 17 F8    1130 CON.LOG.TWO  .HS 80317217F8
               1140 *--------------------------------
               1150 *      "LOG" FUNCTION
               1160 *--------------------------------
E941- 20 82 EB 1170 LOG    JSR SIGN     GET -1,0,+1 IN A-REG FOR FAC
E944- F0 02    1180        BEQ GIQ      LOG (0) IS ILLEGAL
E946- 10 03    1190        BPL LOG.2    >0 IS OK
E948- 4C 99 E1 1200 GIQ    JMP IQERR    <= 0 IS NO GOOD
E94B- A5 9D    1210 LOG.2  LDA FAC      FIRST GET LOG BASE 2
E94D- E9 7F    1220        SBC #$7F     SAVE UNBIASED EXPONENT
E94F- 48       1230        PHA
E950- A9 80    1240        LDA #$80     NORMALIZE BETWEEN .5 AND 1
E952- 85 9D    1250        STA FAC
E954- A9 2D    1260        LDA #CON.SQR.HALF
E956- A0 E9    1270        LDY /CON.SQR.HALF
E958- 20 BE E7 1280        JSR FADD     COMPUTE VIA SERIES OF ODD
E95B- A9 32    1290        LDA #CON.SQR.TWO   POWERS OF
E95D- A0 E9    1300        LDY /CON.SQR.TWO   (SQR(2)X-1)/(SQR(2)X+1)
E95F- 20 66 EA 1310        JSR FDIV
E962- A9 13    1320        LDA #CON.ONE
E964- A0 E9    1330        LDY /CON.ONE
E966- 20 A7 E7 1340        JSR FSUB
E969- A9 18    1350        LDA #POLY.LOG
E96B- A0 E9    1360        LDY /POLY.LOG
E96D- 20 5C EF 1370        JSR POLYNOMIAL.ODD
E970- A9 37    1380        LDA #CON.NEG.HALF
E972- A0 E9    1390        LDY /CON.NEG.HALF
E974- 20 BE E7 1400        JSR FADD
E977- 68       1410        PLA
E978- 20 D5 EC 1420        JSR ADDACC   ADD ORIGINAL EXPONENT
E97B- A9 3C    1430        LDA #CON.LOG.TWO  MULTIPLY BY LOG(2) TO FORM
E97D- A0 E9    1440        LDY /CON.LOG.TWO  NATURAL LOG OF X
               1450 *--------------------------------
               1460 *      FAC = (Y,A) * FAC
               1470 *--------------------------------
E97F- 20 E3 E9 1480 FMULT  JSR LOAD.ARG.FROM.YA
               1490 *--------------------------------
               1500 *      FAC = ARG * FAC
               1510 *--------------------------------
E982- D0 03    1520 FMULTT BNE .1       FAC .NE. ZERO
E984- 4C E2 E9 1530        JMP RTS.13   FAC = 0 * ARG = 0
               1540 *  <<< WHY IS LINE ABOVE JUST "RTS"? >>>
               1550 *--------------------------------
               1560 *
               1570 *--------------------------------
E987- 20 0E EA 1580 .1     JSR ADD.EXPONENTS
E98A- A9 00    1590        LDA #0
E98C- 85 62    1600        STA RESULT   INIT PRODUCT = 0
E98E- 85 63    1610        STA RESULT+1
E990- 85 64    1620        STA RESULT+2
E992- 85 65    1630        STA RESULT+3
E994- A5 AC    1640        LDA FAC.EXTENSION
E996- 20 B0 E9 1650        JSR MULTIPLY.1
E999- A5 A1    1660        LDA FAC+4
E99B- 20 B0 E9 1670        JSR MULTIPLY.1
E99E- A5 A0    1680        LDA FAC+3
E9A0- 20 B0 E9 1690        JSR MULTIPLY.1
E9A3- A5 9F    1700        LDA FAC+2
E9A5- 20 B0 E9 1710        JSR MULTIPLY.1
E9A8- A5 9E    1720        LDA FAC+1
E9AA- 20 B5 E9 1730        JSR MULTIPLY.2
E9AD- 4C E6 EA 1740        JMP COPY.RESULT.INTO.FAC
               1750 *--------------------------------
               1760 *      MULTIPLY ARG BY (A) INTO RESULT
               1770 *--------------------------------
               1780 MULTIPLY.1
E9B0- D0 03    1790        BNE MULTIPLY.2    THIS BYTE NON-ZERO
E9B2- 4C DA E8 1800        JMP SHIFT.RIGHT.1 (A)=0, JUST SHIFT ARG RIGHT 8
               1810 *--------------------------------
               1820 MULTIPLY.2
E9B5- 4A       1830        LSR               SHIFT BIT INTO CARRY
E9B6- 09 80    1840        ORA #$80          SUPPLY SENTINEL BIT
E9B8- A8       1850 .1     TAY               REMAINING MULTIPLIER TO Y
E9B9- 90 19    1860        BCC .2            THIS MULTIPLIER BIT = 0
E9BB- 18       1870        CLC               = 1, SO ADD ARG TO RESULT
E9BC- A5 65    1880        LDA RESULT+3
E9BE- 65 A9    1890        ADC ARG+4
E9C0- 85 65    1900        STA RESULT+3
E9C2- A5 64    1910        LDA RESULT+2
E9C4- 65 A8    1920        ADC ARG+3
E9C6- 85 64    1930        STA RESULT+2
E9C8- A5 63    1940        LDA RESULT+1
E9CA- 65 A7    1950        ADC ARG+2
E9CC- 85 63    1960        STA RESULT+1
E9CE- A5 62    1970        LDA RESULT
E9D0- 65 A6    1980        ADC ARG+1
E9D2- 85 62    1990        STA RESULT
E9D4- 66 62    2000 .2     ROR RESULT        SHIFT RESULT RIGHT 1
E9D6- 66 63    2010        ROR RESULT+1
E9D8- 66 64    2020        ROR RESULT+2
E9DA- 66 65    2030        ROR RESULT+3
E9DC- 66 AC    2040        ROR FAC.EXTENSION
E9DE- 98       2050        TYA               REMAINING MULTIPLIER
E9DF- 4A       2060        LSR               LSB INTO CARRY
E9E0- D0 D6    2070        BNE .1            IF SENTINEL STILL HERE, MULTIPLY
E9E2- 60       2080 RTS.13 RTS               8 X 32 COMPLETED
               2090 *--------------------------------
               2100 *      UNPACK NUMBER AT (Y,A) INTO ARG
               2110 *--------------------------------
               2120 LOAD.ARG.FROM.YA
E9E3- 85 5E    2130        STA INDEX    USE INDEX FOR PNTR
E9E5- 84 5F    2140        STY INDEX+1
E9E7- A0 04    2150        LDY #4       FIVE BYTES TO MOVE
E9E9- B1 5E    2160        LDA (INDEX),Y
E9EB- 85 A9    2170        STA ARG+4
E9ED- 88       2180        DEY
E9EE- B1 5E    2190        LDA (INDEX),Y
E9F0- 85 A8    2200        STA ARG+3
E9F2- 88       2210        DEY
E9F3- B1 5E    2220        LDA (INDEX),Y
E9F5- 85 A7    2230        STA ARG+2
E9F7- 88       2240        DEY
E9F8- B1 5E    2250        LDA (INDEX),Y
E9FA- 85 AA    2260        STA ARG.SIGN
E9FC- 45 A2    2270        EOR FAC.SIGN SET COMBINED SIGN FOR MULT/DIV
E9FE- 85 AB    2280        STA SGNCPR
EA00- A5 AA    2290        LDA ARG.SIGN TURN ON NORMALIZED INVISIBLE BIT
EA02- 09 80    2300        ORA #$80     TO COMPLETE MANTISSA
EA04- 85 A6    2310        STA ARG+1
EA06- 88       2320        DEY
EA07- B1 5E    2330        LDA (INDEX),Y
EA09- 85 A5    2340        STA ARG      EXPONENT
EA0B- A5 9D    2350        LDA FAC      SET STATUS BITS ON FAC EXPONENT
EA0D- 60       2360        RTS
               2370 *--------------------------------
               2380 *      ADD EXPONENTS OF ARG AND FAC
               2390 *      (CALLED BY FMULT AND FDIV)
               2400 *
               2410 *      ALSO CHECK FOR OVERFLOW, AND SET RESULT SIGN
               2420 *--------------------------------
               2430 ADD.EXPONENTS
EA0E- A5 A5    2440        LDA ARG
               2450 *--------------------------------
               2460 ADD.EXPONENTS.1
EA10- F0 1F    2470        BEQ ZERO     IF ARG=0, RESULT IS ZERO
EA12- 18       2480        CLC
EA13- 65 9D    2490        ADC FAC
EA15- 90 04    2500        BCC .1       IN RANGE
EA17- 30 1D    2510        BMI JOV      OVERFLOW
EA19- 18       2520        CLC
EA1A- 2C       2530        .HS 2C       TRICK TO SKIP
EA1B- 10 14    2540 .1     BPL ZERO     OVERFLOW
EA1D- 69 80    2550        ADC #$80     RE-BIAS
EA1F- 85 9D    2560        STA FAC      RESULT
EA21- D0 03    2570        BNE .2
EA23- 4C 52 E8 2580        JMP STA.IN.FAC.SIGN  RESULT IS ZERO
               2590 *  <<< CRAZY TO JUMP WAY BACK THERE! >>>
               2600 *  <<< SAME IDENTICAL CODE IS BELOW! >>>
               2610 *  <<< INSTEAD OF BNE .2, JMP STA.IN.FAC.SIGN   >>>
               2620 *  <<< ONLY NEEDED BEQ .3            >>>
EA26- A5 AB    2630 .2     LDA SGNCPR   SET SIGN OF RESULT
EA28- 85 A2    2640 .3     STA FAC.SIGN
EA2A- 60       2650        RTS
               2660 *--------------------------------
               2670 * IF (FAC) IS POSITIVE, GIVE "OVERFLOW" ERROR
               2680 * IF (FAC) IS NEGATIVE, SET FAC=0, POP ONE RETURN, AND RTS
               2690 * CALLED FROM "EXP" FUNCTION
               2700 *--------------------------------
               2710 OUTOFRNG
EA2B- A5 A2    2720        LDA FAC.SIGN
EA2D- 49 FF    2730        EOR #$FF
EA2F- 30 05    2740        BMI JOV      ERROR IF POSITIVE #
               2750 *--------------------------------
               2760 *      POP RETURN ADDRESS AND SET FAC=0
               2770 *--------------------------------
EA31- 68       2780 ZERO   PLA
EA32- 68       2790        PLA
EA33- 4C 4E E8 2800        JMP ZERO.FAC
               2810 *--------------------------------
EA36- 4C D5 E8 2820 JOV    JMP OVERFLOW
               2830 *--------------------------------
               2840 *      MULTIPLY FAC BY 10
               2850 *--------------------------------
EA39- 20 63 EB 2860 MUL10  JSR COPY.FAC.TO.ARG.ROUNDED
EA3C- AA       2870        TAX          TEXT FAC EXPONENT
EA3D- F0 10    2880        BEQ .1       FINISHED IF FAC=0
EA3F- 18       2890        CLC
EA40- 69 02    2900        ADC #2       ADD 2 TO EXPONENT GIVES (FAC)*4
EA42- B0 F2    2910        BCS JOV      OVERFLOW
EA44- A2 00    2920        LDX #0
EA46- 86 AB    2930        STX SGNCPR
EA48- 20 CE E7 2940        JSR FADD.2   MAKES (FAC)*5
EA4B- E6 9D    2950        INC FAC      *2, MAKES (FAC)*10
EA4D- F0 E7    2960        BEQ JOV      OVERFLOW
EA4F- 60       2970 .1     RTS
               2980 *--------------------------------
EA50- 84 20 00
EA53- 00 00    2990 CON.TEN .HS 8420000000
               3000 *--------------------------------
               3010 *      DIVIDE FAC BY 10
               3020 *--------------------------------
EA55- 20 63 EB 3030 DIV10  JSR COPY.FAC.TO.ARG.ROUNDED
EA58- A9 50    3040        LDA #CON.TEN   SET UP TO PUT
EA5A- A0 EA    3050        LDY /CON.TEN   10 IN FAC
EA5C- A2 00    3060        LDX #0
               3070 *--------------------------------
               3080 *      FAC = ARG / (Y,A)
               3090 *--------------------------------
EA5E- 86 AB    3100 DIV    STX SGNCPR
EA60- 20 F9 EA 3110        JSR LOAD.FAC.FROM.YA
EA63- 4C 69 EA 3120        JMP FDIVT    DIVIDE ARG BY FAC
               3130 *--------------------------------
               3140 *      FAC = (Y,A) / FAC
               3150 *--------------------------------
EA66- 20 E3 E9 3160 FDIV   JSR LOAD.ARG.FROM.YA
               3170 *--------------------------------
               3180 *      FAC = ARG / FAC
               3190 *--------------------------------
EA69- F0 76    3200 FDIVT  BEQ .8       FAC = 0, DIVIDE BY ZERO ERROR
EA6B- 20 72 EB 3210        JSR ROUND.FAC
EA6E- A9 00    3220        LDA #0       NEGATE FAC EXPONENT, SO
EA70- 38       3230        SEC          ADD.EXPONENTS FORMS DIFFERENCE
EA71- E5 9D    3240        SBC FAC
EA73- 85 9D    3250        STA FAC
EA75- 20 0E EA 3260        JSR ADD.EXPONENTS
EA78- E6 9D    3270        INC FAC
EA7A- F0 BA    3280        BEQ JOV      OVERFLOW
EA7C- A2 FC    3290        LDX #-4      INDEX FOR RESULT
EA7E- A9 01    3300        LDA #1       SENTINEL
EA80- A4 A6    3310 .1     LDY ARG+1    SEE IF FAC CAN BE SUBTRACTED
EA82- C4 9E    3320        CPY FAC+1
EA84- D0 10    3330        BNE .2
EA86- A4 A7    3340        LDY ARG+2
EA88- C4 9F    3350        CPY FAC+2
EA8A- D0 0A    3360        BNE .2
EA8C- A4 A8    3370        LDY ARG+3
EA8E- C4 A0    3380        CPY FAC+3
EA90- D0 04    3390        BNE .2
EA92- A4 A9    3400        LDY ARG+4
EA94- C4 A1    3410        CPY FAC+4
EA96- 08       3420 .2     PHP          SAVE THE ANSWER, AND ALSO ROLL THE
EA97- 2A       3430        ROL          BIT INTO THE QUOTIENT, SENTINEL OUT
EA98- 90 09    3440        BCC .3       NO SENTINEL, STILL NOT 8 TRIPS
EA9A- E8       3450        INX          8 TRIPS, STORE BYTE OF QUOTIENT
EA9B- 95 65    3460        STA RESULT+3,X
EA9D- F0 32    3470        BEQ .6       32-BITS COMPLETED
EA9F- 10 34    3480        BPL .7       FINAL EXIT WHEN X=1
EAA1- A9 01    3490        LDA #1       RE-START SENTINEL
EAA3- 28       3500 .3     PLP          GET ANSWER, CAN FAC BE SUBTRACTED?
EAA4- B0 0E    3510        BCS .5       YES, DO IT
EAA6- 06 A9    3520 .4     ASL ARG+4    NO, SHIFT ARG LEFT
EAA8- 26 A8    3530        ROL ARG+3
EAAA- 26 A7    3540        ROL ARG+2
EAAC- 26 A6    3550        ROL ARG+1
EAAE- B0 E6    3560        BCS .2       ANOTHER TRIP
EAB0- 30 CE    3570        BMI .1       HAVE TO COMPARE FIRST
EAB2- 10 E2    3580        BPL .2       ...ALWAYS
EAB4- A8       3590 .5     TAY          SAVE QUOTIENT/SENTINEL BYTE
EAB5- A5 A9    3600        LDA ARG+4    SUBTRACT FAC FROM ARG ONCE
EAB7- E5 A1    3610        SBC FAC+4
EAB9- 85 A9    3620        STA ARG+4
EABB- A5 A8    3630        LDA ARG+3
EABD- E5 A0    3640        SBC FAC+3
EABF- 85 A8    3650        STA ARG+3
EAC1- A5 A7    3660        LDA ARG+2
EAC3- E5 9F    3670        SBC FAC+2
EAC5- 85 A7    3680        STA ARG+2
EAC7- A5 A6    3690        LDA ARG+1
EAC9- E5 9E    3700        SBC FAC+1
EACB- 85 A6    3710        STA ARG+1
EACD- 98       3720        TYA          RESTORE QUOTIENT/SENTINEL BYTE
EACE- 4C A6 EA 3730        JMP .4       GO TO SHIFT ARG AND CONTINUE
               3740 *--------------------------------
EAD1- A9 40    3750 .6     LDA #$40     DO A FEW EXTENSION BITS
EAD3- D0 CE    3760        BNE .3       ...ALWAYS
               3770 *--------------------------------
EAD5- 0A       3780 .7     ASL          LEFT JUSTIFY THE EXTENSION BITS WE DID
EAD6- 0A       3790        ASL
EAD7- 0A       3800        ASL
EAD8- 0A       3810        ASL
EAD9- 0A       3820        ASL
EADA- 0A       3830        ASL
EADB- 85 AC    3840        STA FAC.EXTENSION
EADD- 28       3850        PLP
EADE- 4C E6 EA 3860        JMP COPY.RESULT.INTO.FAC
               3870 *--------------------------------
EAE1- A2 85    3880 .8     LDX #ERR.ZERODIV
EAE3- 4C 12 D4 3890        JMP ERROR
               3900 *--------------------------------
               3910 *      COPY RESULT INTO FAC MANTISSA, AND NORMALIZE
               3920 *--------------------------------
               3930 COPY.RESULT.INTO.FAC
EAE6- A5 62    3940        LDA RESULT
EAE8- 85 9E    3950        STA FAC+1
EAEA- A5 63    3960        LDA RESULT+1
EAEC- 85 9F    3970        STA FAC+2
EAEE- A5 64    3980        LDA RESULT+2
EAF0- 85 A0    3990        STA FAC+3
EAF2- A5 65    4000        LDA RESULT+3
EAF4- 85 A1    4010        STA FAC+4
EAF6- 4C 2E E8 4020        JMP NORMALIZE.FAC.2
               4030 *--------------------------------
               4040 *      UNPACK (Y,A) INTO FAC
               4050 *--------------------------------
               4060 LOAD.FAC.FROM.YA
EAF9- 85 5E    4070        STA INDEX    USE INDEX FOR PNTR
EAFB- 84 5F    4080        STY INDEX+1
EAFD- A0 04    4090        LDY #4       PICK UP 5 BYTES
EAFF- B1 5E    4100        LDA (INDEX),Y
EB01- 85 A1    4110        STA FAC+4
EB03- 88       4120        DEY
EB04- B1 5E    4130        LDA (INDEX),Y
EB06- 85 A0    4140        STA FAC+3
EB08- 88       4150        DEY
EB09- B1 5E    4160        LDA (INDEX),Y
EB0B- 85 9F    4170        STA FAC+2
EB0D- 88       4180        DEY
EB0E- B1 5E    4190        LDA (INDEX),Y
EB10- 85 A2    4200        STA FAC.SIGN FIRST BIT IS SIGN
EB12- 09 80    4210        ORA #$80     SET NORMALIZED INVISIBLE BIT
EB14- 85 9E    4220        STA FAC+1
EB16- 88       4230        DEY
EB17- B1 5E    4240        LDA (INDEX),Y
EB19- 85 9D    4250        STA FAC      EXPONENT
EB1B- 84 AC    4260        STY FAC.EXTENSION  Y=0
EB1D- 60       4270        RTS
               4280 *--------------------------------
               4290 *      ROUND FAC, STORE IN TEMP2
               4300 *--------------------------------
               4310 STORE.FAC.IN.TEMP2.ROUNDED
EB1E- A2 98    4320        LDX #TEMP2   PACK FAC INTO TEMP2
EB20- 2C       4330        .HS 2C       TRICK TO BRANCH
               4340 *--------------------------------
               4350 *      ROUND FAC, STORE IN TEMP1
               4360 *--------------------------------
               4370 STORE.FAC.IN.TEMP1.ROUNDED
EB21- A2 93    4380        LDX #TEMP1   PACK FAC INTO TEMP1
EB23- A0 00    4390        LDY /TEMP1   HI-BYTE OF TEMP1 SAME AS TEMP2
EB25- F0 04    4400        BEQ STORE.FAC.AT.YX.ROUNDED    ...ALWAYS
               4410 *--------------------------------
               4420 *      ROUND FAC, AND STORE WHERE FORPNT POINTS
               4430 *--------------------------------
EB27- A6 85    4440 SETFOR LDX FORPNT
EB29- A4 86    4450        LDY FORPNT+1
               4460 *--------------------------------
               4470 *      ROUND FAC, AND STORE AT (Y,X)
               4480 *--------------------------------
               4490 STORE.FAC.AT.YX.ROUNDED
EB2B- 20 72 EB 4500        JSR ROUND.FAC    ROUND VALUE IN FAC USING EXTENSION
EB2E- 86 5E    4510        STX INDEX         USE INDEX FOR PNTR
EB30- 84 5F    4520        STY INDEX+1
EB32- A0 04    4530        LDY #4            STORING 5 PACKED BYTES
EB34- A5 A1    4540        LDA FAC+4
EB36- 91 5E    4550        STA (INDEX),Y
EB38- 88       4560        DEY
EB39- A5 A0    4570        LDA FAC+3
EB3B- 91 5E    4580        STA (INDEX),Y
EB3D- 88       4590        DEY
EB3E- A5 9F    4600        LDA FAC+2
EB40- 91 5E    4610        STA (INDEX),Y
EB42- 88       4620        DEY
EB43- A5 A2    4630        LDA FAC.SIGN      PACK SIGN IN TOP BIT OF MANTISSA
EB45- 09 7F    4640        ORA #$7F
EB47- 25 9E    4650        AND FAC+1
EB49- 91 5E    4660        STA (INDEX),Y
EB4B- 88       4670        DEY
EB4C- A5 9D    4680        LDA FAC           EXPONENT
EB4E- 91 5E    4690        STA (INDEX),Y
EB50- 84 AC    4700        STY FAC.EXTENSION ZERO THE EXTENSION
EB52- 60       4710        RTS
               4720 *--------------------------------
               4730 *      COPY ARG INTO FAC
               4740 *--------------------------------
               4750 COPY.ARG.TO.FAC
EB53- A5 AA    4760        LDA ARG.SIGN      COPY SIGN
EB55- 85 A2    4770 MFA    STA FAC.SIGN
EB57- A2 05    4780        LDX #5            MOVE 5 BYTES
EB59- B5 A4    4790 .1     LDA ARG-1,X
EB5B- 95 9C    4800        STA FAC-1,X
EB5D- CA       4810        DEX
EB5E- D0 F9    4820        BNE .1
EB60- 86 AC    4830        STX FAC.EXTENSION ZERO EXTENSION
EB62- 60       4840        RTS
               4850 *--------------------------------
               4860 *      ROUND FAC AND COPY TO ARG
               4870 *--------------------------------
               4880 COPY.FAC.TO.ARG.ROUNDED
EB63- 20 72 EB 4890        JSR ROUND.FAC     ROUND FAC USING EXTENSION
EB66- A2 06    4900 MAF    LDX #6            COPY 6 BYTES, INCLUDES SIGN
EB68- B5 9C    4910 .1     LDA FAC-1,X
EB6A- 95 A4    4920        STA ARG-1,X
EB6C- CA       4930        DEX
EB6D- D0 F9    4940        BNE .1
EB6F- 86 AC    4950        STX FAC.EXTENSION ZERO FAC EXTENSION
EB71- 60       4960 RTS.14 RTS



               SAVE S.EB72
               1010 *--------------------------------
               1020 *      ROUND FAC USING EXTENSION BYTE
               1030 *--------------------------------
               1040 ROUND.FAC
EB72- A5 9D    1050        LDA FAC
EB74- F0 FB    1060        BEQ RTS.14   FAC = 0, RETURN
EB76- 06 AC    1070        ASL FAC.EXTENSION  IS FAC.EXTENSION >= 128?
EB78- 90 F7    1080        BCC RTS.14         NO, FINISHED
               1090 *--------------------------------
               1100 *      INCREMENT MANTISSA AND RE-NORMALIZE IF CARRY
               1110 *--------------------------------
               1120 INCREMENT.MANTISSA
EB7A- 20 C6 E8 1130        JSR INCREMENT.FAC.MANTISSA  YES, INCREMENT FAC
EB7D- D0 F2    1140        BNE RTS.14         HIGH BYTE HAS BITS, FINISHED
EB7F- 4C 8F E8 1150        JMP NORMALIZE.FAC.6  HI-BYTE=0, SO SHIFT LEFT
               1160 *--------------------------------
               1170 *      TEST FAC FOR ZERO AND SIGN
               1180 *
               1190 *      FAC > 0, RETURN +1
               1200 *      FAC = 0, RETURN  0
               1210 *      FAC < 0, RETURN -1
               1220 *--------------------------------
EB82- A5 9D    1230 SIGN   LDA FAC      CHECK SIGN OF FAC AND
EB84- F0 09    1240        BEQ RTS.15   RETURN -1,0,1 IN A-REG
               1250 *--------------------------------
EB86- A5 A2    1260 SIGN1  LDA FAC.SIGN
               1270 *--------------------------------
EB88- 2A       1280 SIGN2  ROL          MSBIT TO CARRY
EB89- A9 FF    1290        LDA #$FF     -1
EB8B- B0 02    1300        BCS RTS.15   MSBIT = 1
EB8D- A9 01    1310        LDA #1       +1
EB8F- 60       1320 RTS.15 RTS
               1330 *--------------------------------
               1340 *      "SGN" FUNCTION
               1350 *--------------------------------
EB90- 20 82 EB 1360 SGN    JSR SIGN        CONVERT FAC TO -1,0,1
               1370 *--------------------------------
               1380 *      CONVERT (A) INTO FAC, AS SIGNED VALUE -128 TO +127
               1390 *--------------------------------
EB93- 85 9E    1400 FLOAT  STA FAC+1    PUT IN HIGH BYTE OF MANTISSA
EB95- A9 00    1410        LDA #0       CLEAR 2ND BYTE OF MANTISSA
EB97- 85 9F    1420        STA FAC+2
EB99- A2 88    1430        LDX #$88     USE EXPONENT 2^9
               1440 *--------------------------------
               1450 *      FLOAT UNSIGNED VALUE IN FAC+1,2
               1460 *      (X) = EXPONENT
               1470 *--------------------------------
               1480 FLOAT.1
EB9B- A5 9E    1490        LDA FAC+1    MSBIT=0, SET CARRY; =1, CLEAR CARRY
EB9D- 49 FF    1500        EOR #$FF
EB9F- 2A       1510        ROL
               1520 *--------------------------------
               1530 *      FLOAT UNSIGNED VALUE IN FAC+1,2
               1540 *      (X) = EXPONENT
               1550 *      C=0 TO MAKE VALUE NEGATIVE
               1560 *      C=1 TO MAKE VALUE POSITIVE
               1570 *--------------------------------
               1580 FLOAT.2
EBA0- A9 00    1590        LDA #0       CLEAR LOWER 16-BITS OF MANTISSA
EBA2- 85 A1    1600        STA FAC+4
EBA4- 85 A0    1610        STA FAC+3
EBA6- 86 9D    1620        STX FAC      STORE EXPONENT
EBA8- 85 AC    1630        STA FAC.EXTENSION CLEAR EXTENSION
EBAA- 85 A2    1640        STA FAC.SIGN      MAKE SIGN POSITIVE
EBAC- 4C 29 E8 1650        JMP NORMALIZE.FAC.1   IF C=0, WILL NEGATE FAC
               1660 *--------------------------------
               1670 *      "ABS" FUNCTION
               1680 *--------------------------------
EBAF- 46 A2    1690 ABS    LSR FAC.SIGN      CHANGE SIGN TO +
EBB1- 60       1700        RTS
               1710 *--------------------------------
               1720 *      COMPARE FAC WITH PACKED # AT (Y,A)
               1730 *      RETURN A=1,0,-1 AS (Y,A) IS <,=,> FAC
               1740 *--------------------------------
EBB2- 85 60    1750 FCOMP  STA DEST     USE DEST FOR PNTR
               1760 *--------------------------------
               1770 *      SPECIAL ENTRY FROM "NEXT" PROCESSOR
               1780 *      "DEST" ALREADY SET UP
               1790 *--------------------------------
EBB4- 84 61    1800 FCOMP2 STY DEST+1
EBB6- A0 00    1810        LDY #0       GET EXPONENT OF COMPARAND
EBB8- B1 60    1820        LDA (DEST),Y
EBBA- C8       1830        INY          POINT AT NEXT BYTE
EBBB- AA       1840        TAX          EXPONENT TO X-REG
EBBC- F0 C4    1850        BEQ SIGN     IF COMPARAND=0, "SIGN" COMPARES FAC
EBBE- B1 60    1860        LDA (DEST),Y GET HI-BYTE OF MANTISSA
EBC0- 45 A2    1870        EOR FAC.SIGN COMPARE WITH FAC SIGN
EBC2- 30 C2    1880        BMI SIGN1    DIFFERENT SIGNS, "SIGN" GIVES ANSWER
EBC4- E4 9D    1890        CPX FAC      SAME SIGN, SO COMPARE EXPONENTS
EBC6- D0 21    1900        BNE .1       DIFFERENT, SO SUFFICIENT TEST
EBC8- B1 60    1910        LDA (DEST),Y SAME EXPONENT, COMPARE MANTISSA
EBCA- 09 80    1920        ORA #$80     SET INVISIBLE NORMALIZED BIT
EBCC- C5 9E    1930        CMP FAC+1
EBCE- D0 19    1940        BNE .1       NOT SAME, SO SUFFICIENT
EBD0- C8       1950        INY          SAME, COMPARE MORE MANTISSA
EBD1- B1 60    1960        LDA (DEST),Y
EBD3- C5 9F    1970        CMP FAC+2
EBD5- D0 12    1980        BNE .1       NOT SAME, SO SUFFICIENT
EBD7- C8       1990        INY          SAME, COMPARE MORE MANTISSA
EBD8- B1 60    2000        LDA (DEST),Y
EBDA- C5 A0    2010        CMP FAC+3
EBDC- D0 0B    2020        BNE .1       NOT SAME, SO SUFFICIENT
EBDE- C8       2030        INY          SAME, COMPARE REST OF MANTISSA
EBDF- A9 7F    2040        LDA #$7F    ARTIFICIAL EXTENSION BYTE FOR COMPARAND
EBE1- C5 AC    2050        CMP FAC.EXTENSION
EBE3- B1 60    2060        LDA (DEST),Y
EBE5- E5 A1    2070        SBC FAC+4
EBE7- F0 28    2080        BEQ RTS.16   NUMBERS ARE EQUAL, RETURN (A)=0
EBE9- A5 A2    2090 .1     LDA FAC.SIGN NUMBERS ARE DIFFERENT
EBEB- 90 02    2100        BCC .2       FAC IS LARGER MAGNITUDE
EBED- 49 FF    2110        EOR #$FF     FAC IS SMALLER MAGNITUDE
               2120 * <<<  NOTE THAT ABOVE THREE LINES CAN BE SHORTENED: >>>
               2130 * <<<  .1  ROR              PUT CARRY INTO SIGN BIT  >>>
               2140 * <<<      EOR FAC.SIGN     TOGGLE WITH SIGN OF FAC  >>>
EBEF- 4C 88 EB 2150 .2     JMP SIGN2    CONVERT +1 OR -1
               2160 *--------------------------------
               2170 *      QUICK INTEGER FUNCTION
               2180 *
               2190 *      CONVERTS FP VALUE IN FAC TO INTEGER VALUE
               2200 *      IN FAC+1...FAC+4, BY SHIFTING RIGHT WITH SIGN
               2210 *      EXTENSION UNTIL FRACTIONAL BITS ARE OUT.
               2220 *
               2230 *      THIS SUBROUTINE ASSUMES THE EXPONENT < 32.
               2240 *--------------------------------
EBF2- A5 9D    2250 QINT   LDA FAC      LOOK AT FAC EXPONENT
EBF4- F0 4A    2260        BEQ QINT.3   FAC=0, SO FINISHED
EBF6- 38       2270        SEC          GET -(NUMBER OF FRACTIONAL BITS)
EBF7- E9 A0    2280        SBC #$A0          IN A-REG FOR SHIFT COUNT
EBF9- 24 A2    2290        BIT FAC.SIGN CHECK SIGN OF FAC
EBFB- 10 09    2300        BPL .1       POSITIVE, CONTINUE
EBFD- AA       2310        TAX          NEGATIVE, SO COMPLEMENT MANTISSA
EBFE- A9 FF    2320        LDA #$FF     AND SET SIGN EXTENSION FOR SHIFT
EC00- 85 A4    2330        STA SHIFT.SIGN.EXT
EC02- 20 A4 E8 2340        JSR COMPLEMENT.FAC.MANTISSA
EC05- 8A       2350        TXA          RESTORE BIT COUNT TO A-REG
EC06- A2 9D    2360 .1     LDX #FAC     POINT SHIFT SUBROUTINE AT FAC
EC08- C9 F9    2370        CMP #$F9     MORE THAN 7 BITS TO SHIFT?
EC0A- 10 06    2380        BPL QINT.2   NO, SHORT SHIFT
EC0C- 20 F0 E8 2390        JSR SHIFT.RIGHT   YES, USE GENERAL ROUTINE
EC0F- 84 A4    2400        STY SHIFT.SIGN.EXT    Y=0, CLEAR SIGN EXTENSION
EC11- 60       2410 RTS.16 RTS
               2420 *--------------------------------
EC12- A8       2430 QINT.2 TAY          SAVE SHIFT COUNT
EC13- A5 A2    2440        LDA FAC.SIGN      GET SIGN BIT
EC15- 29 80    2450        AND #$80
EC17- 46 9E    2460        LSR FAC+1         START RIGHT SHIFT
EC19- 05 9E    2470        ORA FAC+1         AND MERGE WITH SIGN
EC1B- 85 9E    2480        STA FAC+1
EC1D- 20 07 E9 2490        JSR SHIFT.RIGHT.4     JUMP INTO MIDDLE OF SHIFTER
EC20- 84 A4    2500        STY SHIFT.SIGN.EXT    Y=0, CLEAR SIGN EXTENSION
EC22- 60       2510        RTS
               2520 *--------------------------------
               2530 *      "INT" FUNCTION
               2540 *
               2550 *      USES QINT TO CONVERT (FAC) TO INTEGER FORM,
               2560 *      AND THEN REFLOATS THE INTEGER.
               2570 *      <<< A FASTER APPROACH WOULD SIMPLY CLEAR >>>
               2580 *      <<< THE FRACTIONAL BITS BY ZEROING THEM  >>>
               2590 *--------------------------------
EC23- A5 9D    2600 INT    LDA FAC      CHECK IF EXPONENT < 32
EC25- C9 A0    2610        CMP #$A0     BECAUSE IF > 31 THERE IS NO FRACTION
EC27- B0 20    2620        BCS RTS.17   NO FRACTION, WE ARE FINISHED
EC29- 20 F2 EB 2630        JSR QINT     USE GENERAL INTEGER CONVERSION
EC2C- 84 AC    2640        STY FAC.EXTENSION  Y=0, CLEAR EXTENSION
EC2E- A5 A2    2650        LDA FAC.SIGN      GET SIGN OF VALUE
EC30- 84 A2    2660        STY FAC.SIGN      Y=0, CLEAR SIGN
EC32- 49 80    2670        EOR #$80          TOGGLE ACTUAL SIGN
EC34- 2A       2680        ROL               AND SAVE IN CARRY
EC35- A9 A0    2690        LDA #$A0          SET EXPONENT TO 32
EC37- 85 9D    2700        STA FAC           BECAUSE 4-BYTE INTEGER NOW
EC39- A5 A1    2710        LDA FAC+4         SAVE LOW 8-BITS OF INTEGER FORM
EC3B- 85 0D    2720        STA CHARAC        FOR EXP AND POWER
EC3D- 4C 29 E8 2730        JMP NORMALIZE.FAC.1  NORMALIZE TO FINISH CONVERSION
               2740 *--------------------------------
EC40- 85 9E    2750 QINT.3 STA FAC+1    FAC=0, SO CLEAR ALL 4 BYTES FOR
EC42- 85 9F    2760        STA FAC+2    INTEGER VERSION
EC44- 85 A0    2770        STA FAC+3
EC46- 85 A1    2780        STA FAC+4
EC48- A8       2790        TAY          Y=0 TOO
EC49- 60       2800 RTS.17 RTS




               SAVE S.EC4A
               1010 *--------------------------------
               1020 *      CONVERT STRING TO FP VALUE IN FAC
               1030 *
               1040 *      STRING POINTED TO BY TXTPTR
               1050 *      FIRST CHAR ALREADY SCANNED BY CHRGET
               1060 *      (A) = FIRST CHAR, C=0 IF DIGIT.
               1070 *--------------------------------
EC4A- A0 00    1080 FIN    LDY #0       CLEAR WORKING AREA ($99...$A3)
EC4C- A2 0A    1090        LDX #10   TMPEXP, EXPON, DPFLG, EXPSGN, FAC, SERLEN
EC4E- 94 99    1100 .1     STY TMPEXP,X
EC50- CA       1110        DEX
EC51- 10 FB    1120        BPL .1
               1130 *--------------------------------
EC53- 90 0F    1140        BCC FIN.2    FIRST CHAR IS A DIGIT
EC55- C9 2D    1150        CMP #'-'     CHECK FOR LEADING SIGN
EC57- D0 04    1160        BNE .2       NOT MINUS
EC59- 86 A3    1170        STX SERLEN   MINUS, SET SERLEN = $FF FOR FLAG
EC5B- F0 04    1180        BEQ FIN.1    ...ALWAYS
EC5D- C9 2B    1190 .2     CMP #'+'     MIGHT BE PLUS
EC5F- D0 05    1200        BNE FIN.3    NOT PLUS EITHER, CHECK DECIMAL POINT
               1210 *--------------------------------
EC61- 20 B1 00 1220 FIN.1  JSR CHRGET   GET NEXT CHAR OF STRING
               1230 *--------------------------------
EC64- 90 5B    1240 FIN.2  BCC FIN.9    INSERT THIS DIGIT
               1250 *--------------------------------
EC66- C9 2E    1260 FIN.3  CMP #'.'     CHECK FOR DECIMAL POINT
EC68- F0 2E    1270        BEQ FIN.10   YES
EC6A- C9 45    1280        CMP #'E'     CHECK FOR EXPONENT PART
EC6C- D0 30    1290        BNE FIN.7    NO, END OF NUMBER
EC6E- 20 B1 00 1300        JSR CHRGET   YES, START CONVERTING EXPONENT
EC71- 90 17    1310        BCC FIN.5    EXPONENT DIGIT
EC73- C9 C9    1320        CMP #TOKEN.MINUS  NEGATIVE EXPONENT?
EC75- F0 0E    1330        BEQ .1            YES
EC77- C9 2D    1340        CMP #'-'          MIGHT NOT BE TOKENIZED YET
EC79- F0 0A    1350        BEQ .1            YES, IT IS NEGATIVE
EC7B- C9 C8    1360        CMP #TOKEN.PLUS   OPTIONAL "+"
EC7D- F0 08    1370        BEQ FIN.4         YES
EC7F- C9 2B    1380        CMP #'+'          MIGHT NOT BE TOKENIZED YET
EC81- F0 04    1390        BEQ FIN.4         YES, FOUND "+"
EC83- D0 07    1400        BNE FIN.6    ...ALWAYS, NUMBER COMPLETED
EC85- 66 9C    1410 .1     ROR EXPSGN   C=1, SET FLAG NEGATIVE
               1420 *--------------------------------
EC87- 20 B1 00 1430 FIN.4  JSR CHRGET   GET NEXT DIGIT OF EXPONENT
               1440 *--------------------------------
EC8A- 90 5C    1450 FIN.5  BCC GETEXP   CHAR IS A DIGIT OF EXPONENT
               1460 *--------------------------------
EC8C- 24 9C    1470 FIN.6  BIT EXPSGN   END OF NUMBER, CHECK EXP SIGN
EC8E- 10 0E    1480        BPL FIN.7    POSITIVE EXPONENT
EC90- A9 00    1490        LDA #0       NEGATIVE EXPONENT
EC92- 38       1500        SEC          MAKE 2'S COMPLEMENT OF EXPONENT
EC93- E5 9A    1510        SBC EXPON
EC95- 4C A0 EC 1520        JMP FIN.8
               1530 *--------------------------------
               1540 *      FOUND A DECIMAL POINT
               1550 *--------------------------------
EC98- 66 9B    1560 FIN.10 ROR DPFLG    C=1, SET DPFLG FOR DECIMAL POINT
EC9A- 24 9B    1570        BIT DPFLG    CHECK IF PREVIOUS DEC. PT.
EC9C- 50 C3    1580        BVC FIN.1    NO PREVIOUS DECIMAL POINT
               1590 *      A SECOND DECIMAL POINT IS TAKEN AS A TERMINATOR
               1600 *      TO THE NUMERIC STRING.
               1610 *      "A=11..22" WILL GIVE A SYNTAX ERROR, BECAUSE
               1620 *      IT IS TWO NUMBERS WITH NO OPERATOR BETWEEN.
               1630 *      "PRINT 11..22" GIVES NO ERROR, BECAUSE IT IS
               1640 *      JUST THE CONCATENATION OF TWO NUMBERS.
               1650 *--------------------------------
               1660 *      NUMBER TERMINATED, ADJUST EXPONENT NOW
               1670 *--------------------------------
EC9E- A5 9A    1680 FIN.7  LDA EXPON    E-VALUE
ECA0- 38       1690 FIN.8  SEC          MODIFY WITH COUNT OF DIGITS
ECA1- E5 99    1700        SBC TMPEXP        AFTER THE DECIMAL POINT
ECA3- 85 9A    1710        STA EXPON    COMPLETE CURRENT EXPONENT
ECA5- F0 12    1720        BEQ .15      NO ADJUST NEEDED IF EXP=0
ECA7- 10 09    1730        BPL .14      EXP>0, MULTIPLY BY TEN
ECA9- 20 55 EA 1740 .13    JSR DIV10    EXP<0, DIVIDE BY TEN
ECAC- E6 9A    1750        INC EXPON    UNTIL EXP=0
ECAE- D0 F9    1760        BNE .13
ECB0- F0 07    1770        BEQ .15      ...ALWAYS, WE ARE FINISHED
ECB2- 20 39 EA 1780 .14    JSR MUL10    EXP>0, MULTIPLY BKY TEN
ECB5- C6 9A    1790        DEC EXPON    UNTIL EXP=0
ECB7- D0 F9    1800        BNE .14
ECB9- A5 A3    1810 .15    LDA SERLEN   IS WHOLE NUMBER NEGATIVE?
ECBB- 30 01    1820        BMI .16      YES
ECBD- 60       1830        RTS          NO, RETURN, WHOLE JOB DONE!
ECBE- 4C D0 EE 1840 .16    JMP NEGOP    NEGATIVE NUMBER, SO NEGATE FAC
               1850 *--------------------------------
               1860 *      ACCUMULATE A DIGIT INTO FAC
               1870 *--------------------------------
ECC1- 48       1880 FIN.9  PHA          SAVE DIGIT
ECC2- 24 9B    1890        BIT DPFLG    SEEN A DECIMAL POINT YET?
ECC4- 10 02    1900        BPL .1       NO, STILL IN INTEGER PART
ECC6- E6 99    1910        INC TMPEXP   YES, COUNT THE FRACTIONAL DIGIT
ECC8- 20 39 EA 1920 .1     JSR MUL10    FAC = FAC * 10
ECCB- 68       1930        PLA          CURRENT DIGIT
ECCC- 38       1940        SEC          <<<SHORTER HERE TO JUST "AND #$0F">>>
ECCD- E9 30    1950        SBC #'0'     <<<TO CONVERT ASCII TO BINARY FORM>>>
ECCF- 20 D5 EC 1960        JSR ADDACC   ADD THE DIGIT
ECD2- 4C 61 EC 1970        JMP FIN.1    GO BACK FOR MORE
               1980 *--------------------------------
               1990 *      ADD (A) TO FAC
               2000 *--------------------------------
ECD5- 48       2010 ADDACC PHA          SAVE ADDEND
ECD6- 20 63 EB 2020        JSR COPY.FAC.TO.ARG.ROUNDED
ECD9- 68       2030        PLA          GET ADDEND AGAIN
ECDA- 20 93 EB 2040        JSR FLOAT    CONVERT TO FP VALUE IN FAC
ECDD- A5 AA    2050        LDA ARG.SIGN
ECDF- 45 A2    2060        EOR FAC.SIGN
ECE1- 85 AB    2070        STA SGNCPR
ECE3- A6 9D    2080        LDX FAC      TO SIGNAL IF FAC=0
ECE5- 4C C1 E7 2090        JMP FADDT    PERFORM THE ADDITION
               2100 *--------------------------------
               2110 *      ACCUMULATE DIGIT OF EXPONENT
               2120 *--------------------------------
ECE8- A5 9A    2130 GETEXP LDA EXPON    CHECK CURRENT VALUE
ECEA- C9 0A    2140        CMP #10      FOR MORE THAN 2 DIGITS
ECEC- 90 09    2150        BCC .1       NO, THIS IS 1ST OR 2ND DIGIT
ECEE- A9 64    2160        LDA #100     EXPONENT TOO BIG
ECF0- 24 9C    2170        BIT EXPSGN   UNLESS IT IS NEGATIVE
ECF2- 30 11    2180        BMI .2       LARGE NEGATIVE EXPONENT MAKES FAC=0
ECF4- 4C D5 E8 2190        JMP OVERFLOW LARGE POSITIVE EXPONENT IS ERROR
ECF7- 0A       2200 .1     ASL          EXPONENT TIMES 10
ECF8- 0A       2210        ASL
ECF9- 18       2220        CLC
ECFA- 65 9A    2230        ADC EXPON
ECFC- 0A       2240        ASL
ECFD- 18       2250        CLC          <<< ASL ALREADY DID THIS! >>>
ECFE- A0 00    2260        LDY #0       ADD THE NEW DIGIT
ED00- 71 B8    2270        ADC (TXTPTR),Y    BUT THIS IS IN ASCII,
ED02- 38       2280        SEC               SO ADJUST BACK TO BINARY
ED03- E9 30    2290        SBC #'0'
ED05- 85 9A    2300 .2     STA EXPON    NEW VALUE
ED07- 4C 87 EC 2310        JMP FIN.4    BACK FOR MORE
               2320 *--------------------------------




               SAVE S.ED0A
               1010 *--------------------------------
ED0A- 9B 3E BC
ED0D- 1F FD    1020 CON.99999999.9 .HS 9B3EBC1FFD  99,999,999.9
ED0F- 9E 6E 6B
ED12- 27 FD    1030 CON.999999999  .HS 9E6E6B27FD  999,999,999
ED14- 9E 6E 6B
ED17- 28 00    1040 CON.BILLION    .HS 9E6E6B2800  1,000,000,000
               1050 *--------------------------------
               1060 *      PRINT "IN <LINE #>"
               1070 *--------------------------------
ED19- A9 58    1080 INPRT  LDA #QT.IN    PRINT " IN "
ED1B- A0 D3    1090        LDY /QT.IN
ED1D- 20 31 ED 1100        JSR GO.STROUT
ED20- A5 76    1110        LDA CURLIN+1
ED22- A6 75    1120        LDX CURLIN
               1130 *--------------------------------
               1140 *      PRINT A,X AS DECIMAL INTEGER
               1150 *--------------------------------
ED24- 85 9E    1160 LINPRT STA FAC+1    PRINT A,X IN DECIMAL
ED26- 86 9F    1170        STX FAC+2
ED28- A2 90    1180        LDX #$90     EXPONENT = 2^16
ED2A- 38       1190        SEC          CONVERT UNSIGNED
ED2B- 20 A0 EB 1200        JSR FLOAT.2  CONVERT LINE # TO FP
               1210 *--------------------------------
               1220 *      CONVERT (FAC) TO STRING, AND PRINT IT
               1230 *--------------------------------
               1240 PRINT.FAC
ED2E- 20 34 ED 1250        JSR FOUT     CONVERT (FAC) TO STRING AT STACK
               1260 *--------------------------------
               1270 *      PRINT STRING STARTING AT Y,A
               1280 *--------------------------------
               1290 GO.STROUT
ED31- 4C 3A DB 1300        JMP STROUT    PRINT STRING AT A,Y
               1310 *--------------------------------
               1320 *      CONVERT (FAC) TO STRING STARTING AT STACK
               1330 *      RETURN WITH (Y,A) POINTING AT STRING
               1340 *--------------------------------
ED34- A0 01    1350 FOUT   LDY #1       NORMAL ENTRY PUTS STRING AT STACK...
               1360 *--------------------------------
               1370 *      "STR$" FUNCTION ENTERS HERE, WITH (Y)=0
               1380 *      SO THAT RESULT STRING STARTS AT STACK-1
               1390 *      (THIS IS USED AS A FLAG)
               1400 *--------------------------------
ED36- A9 2D    1410 FOUT.1 LDA #'-'     IN CASE VALUE NEGATIVE
ED38- 88       1420        DEY          BACK UP PNTR
ED39- 24 A2    1430        BIT FAC.SIGN
ED3B- 10 04    1440        BPL .1       VALUE IS +
ED3D- C8       1450        INY          VALUE IS -
ED3E- 99 FF 00 1460        STA STACK-1,Y     EMIT "-"
ED41- 85 A2    1470 .1     STA FAC.SIGN MAKE FAC.SIGN POSITIVE ($2D)
ED43- 84 AD    1480        STY STRNG2   SAVE STRING PNTR
ED45- C8       1490        INY
ED46- A9 30    1500        LDA #'0'     IN CASE (FAC)=0
ED48- A6 9D    1510        LDX FAC      NUMBER=0?
ED4A- D0 03    1520        BNE .2       NO, (FAC) NOT ZERO
ED4C- 4C 57 EE 1530        JMP FOUT.4   YES, FINISHED
               1540 *--------------------------------
ED4F- A9 00    1550 .2     LDA #0       STARTING VALUE FOR TMPEXP
ED51- E0 80    1560        CPX #$80     ANY INTEGER PART?
ED53- F0 02    1570        BEQ .3       NO, BTWN .5 AND .999999999
ED55- B0 09    1580        BCS .4       YES
               1590 *--------------------------------
ED57- A9 14    1600 .3     LDA #CON.BILLION  MULTIPLY BY 1E9
ED59- A0 ED    1610        LDY /CON.BILLION  TO GIVE ADJUSTMENT A HEAD START
ED5B- 20 7F E9 1620        JSR FMULT
ED5E- A9 F7    1630        LDA #-9           EXPONENT ADJUSTMENT
ED60- 85 99    1640 .4     STA TMPEXP        0 OR -9
               1650 *--------------------------------
               1660 *      ADJUST UNTIL 1E8 <= (FAC) <1E9
               1670 *--------------------------------
ED62- A9 0F    1680 .5     LDA #CON.999999999
ED64- A0 ED    1690        LDY /CON.999999999
ED66- 20 B2 EB 1700        JSR FCOMP    COMPARE TO 1E9-1
ED69- F0 1E    1710        BEQ .10      (FAC) = 1E9-1
ED6B- 10 12    1720        BPL .8       TOO LARGE, DIVIDE BY TEN
ED6D- A9 0A    1730 .6     LDA #CON.99999999.9   COMPARE TO 1E8-.1
ED6F- A0 ED    1740        LDY /CON.99999999.9
ED71- 20 B2 EB 1750        JSR FCOMP    COMPARE TO 1E8-.1
ED74- F0 02    1760        BEQ .7       (FAC) = 1E8-.1
ED76- 10 0E    1770        BPL .9       IN RANGE, ADJUSTMENT FINISHED
ED78- 20 39 EA 1780 .7     JSR MUL10    TOO SMALL, MULTIPLY BY TEN
ED7B- C6 99    1790        DEC TMPEXP   KEEP TRACK OF MULTIPLIES
ED7D- D0 EE    1800        BNE .6       ...ALWAYS
ED7F- 20 55 EA 1810 .8     JSR DIV10    TOO LARGE, DIVIDE BY TEN
ED82- E6 99    1820        INC TMPEXP   KEEP TRACK OF DIVISIONS
ED84- D0 DC    1830        BNE .5       ...ALWAYS
               1840 *--------------------------------
ED86- 20 A0 E7 1850 .9     JSR FADDH    ROUND ADJUSTED RESULT
ED89- 20 F2 EB 1860 .10    JSR QINT   CONVERT ADJUSTED VALUE TO 32-BIT INTEGER
               1870 *--------------------------------
               1880 *      FAC+1...FAC+4 IS NOW IN INTEGER FORM
               1890 *      WITH POWER OF TEN ADJUSTMENT IN TMPEXP
               1900 *
               1910 *      IF -10 < TMPEXP > 1, PRINT IN DECIMAL FORM
               1920 *      OTHERWISE, PRINT IN EXPONENTIAL FORM
               1930 *--------------------------------
ED8C- A2 01    1940 FOUT.2 LDX #1       ASSUME 1 DIGIT BEFORE "."
ED8E- A5 99    1950        LDA TMPEXP   CHECK RANGE
ED90- 18       1960        CLC
ED91- 69 0A    1970        ADC #10
ED93- 30 09    1980        BMI .1       < .01, USE EXPONENTIAL FORM
ED95- C9 0B    1990        CMP #11
ED97- B0 06    2000        BCS .2       >= 1E10, USE EXPONENTIAL FORM
ED99- 69 FF    2010        ADC #$FF     LESS 1 GIVES INDEX FOR "."
ED9B- AA       2020        TAX
ED9C- A9 02    2030        LDA #2       SET REMAINING EXPONENT = 0
ED9E- 38       2040 .1     SEC          COMPUTE REMAINING EXPONENT
ED9F- E9 02    2050 .2     SBC #2
EDA1- 85 9A    2060        STA EXPON    VALUE FOR "E+XX" OR "E-XX"
EDA3- 86 99    2070        STX TMPEXP   INDEX FOR DECIMAL POINT
EDA5- 8A       2080        TXA          SEE IF "." COMES FIRST
EDA6- F0 02    2090        BEQ .3       YES
EDA8- 10 13    2100        BPL .5       NO, LATER
EDAA- A4 AD    2110 .3     LDY STRNG2   GET INDEX INTO STRING BEING BUILT
EDAC- A9 2E    2120        LDA #'.'     STORE A DECIMAL POINT
EDAE- C8       2130        INY
EDAF- 99 FF 00 2140        STA STACK-1,Y
EDB2- 8A       2150        TXA          SEE IF NEED ".0"
EDB3- F0 06    2160        BEQ .4       NO
EDB5- A9 30    2170        LDA #'0'     YES, STORE "0"
EDB7- C8       2180        INY
EDB8- 99 FF 00 2190        STA STACK-1,Y
EDBB- 84 AD    2200 .4     STY STRNG2   SAVE OUTPUT INDEX AGAIN
               2210 *--------------------------------
               2220 *     NOW DIVIDE BY POWERS OF TEN TO GET SUCCESSIVE DIGITS
               2230 *--------------------------------
EDBD- A0 00    2240 .5     LDY #0       INDEX TO TABLE OF POWERS OF TEN
EDBF- A2 80    2250        LDX #$80    STARTING VALUE FOR DIGIT WITH DIRECTION
EDC1- A5 A1    2260 .6     LDA FAC+4    START BY ADDING -100000000 UNTIL
EDC3- 18       2270        CLC          OVERSHOOT.  THEN ADD +10000000,
EDC4- 79 6C EE 2280        ADC DECTBL+3,Y    THEN ADD -1000000, THEN ADD
EDC7- 85 A1    2290        STA FAC+4         +100000, AND SO ON.
EDC9- A5 A0    2300        LDA FAC+3    THE # OF TIMES EACH POWER IS ADDED
EDCB- 79 6B EE 2310        ADC DECTBL+2,Y   IS 1 MORE THAN CORRESPONDING DIGIT
EDCE- 85 A0    2320        STA FAC+3
EDD0- A5 9F    2330        LDA FAC+2
EDD2- 79 6A EE 2340        ADC DECTBL+1,Y
EDD5- 85 9F    2350        STA FAC+2
EDD7- A5 9E    2360        LDA FAC+1
EDD9- 79 69 EE 2370        ADC DECTBL,Y
EDDC- 85 9E    2380        STA FAC+1
EDDE- E8       2390        INX          COUNT THE ADD
EDDF- B0 04    2400        BCS .7       IF C=1 AND X NEGATIVE, KEEP ADDING
EDE1- 10 DE    2410        BPL .6       IF C=0 AND X POSITIVE, KEEP ADDING
EDE3- 30 02    2420        BMI .8       IF C=0 AND X NEGATIVE, WE OVERSHOT
EDE5- 30 DA    2430 .7     BMI .6       IF C=1 AND X POSITIVE, WE OVERSHOT
EDE7- 8A       2440 .8     TXA          OVERSHOT, SO MAKE X INTO A DIGIT
EDE8- 90 04    2450        BCC .9       HOW DEPENDS ON DIRECTION WE WERE GOING
EDEA- 49 FF    2460        EOR #$FF     DIGIT = 9-X
EDEC- 69 0A    2470        ADC #10
EDEE- 69 2F    2480 .9     ADC #'0'-1   MAKE DIGIT INTO ASCII
EDF0- C8       2490        INY          ADVANCE TO NEXT SMALLER POWER OF TEN
EDF1- C8       2500        INY
EDF2- C8       2510        INY
EDF3- C8       2520        INY
EDF4- 84 83    2530        STY VARPNT   SAVE PNTR TO POWERS
EDF6- A4 AD    2540        LDY STRNG2   GET OUTPUT PNTR
EDF8- C8       2550        INY          STORE THE DIGIT
EDF9- AA       2560        TAX          SAVE DIGIT, HI-BIT IS DIRECTION
EDFA- 29 7F    2570        AND #$7F     MAKE SURE $30...$39 FOR STRING
EDFC- 99 FF 00 2580        STA STACK-1,Y
EDFF- C6 99    2590        DEC TMPEXP   COUNT THE DIGIT
EE01- D0 06    2600        BNE .10      NOT TIME FOR "." YET
EE03- A9 2E    2610        LDA #'.'     TIME, SO STORE THE DECIMAL POINT
EE05- C8       2620        INY
EE06- 99 FF 00 2630        STA STACK-1,Y
EE09- 84 AD    2640 .10    STY STRNG2   SAVE OUTPUT PNTR AGAIN
EE0B- A4 83    2650        LDY VARPNT   GET PNTR TO POWERS
EE0D- 8A       2660        TXA          GET DIGIT WITH HI-BIT = DIRECTION
EE0E- 49 FF    2670        EOR #$FF     CHANGE DIRECTION
EE10- 29 80    2680        AND #$80     $00 IF ADDING, $80 IF SUBTRACTING
EE12- AA       2690        TAX
EE13- C0 24    2700        CPY #DECTBL.END-DECTBL
EE15- D0 AA    2710        BNE .6       NOT FINISHED YET
               2720 *--------------------------------
               2730 *      NINE DIGITS HAVE BEEN STORED IN STRING.  NOW LOOK
               2740 *      BACK AND LOP OFF TRAILING ZEROES AND A TRAILING
               2750 *      DECIMAL POINT.
               2760 *--------------------------------
EE17- A4 AD    2770 FOUT.3 LDY STRNG2   POINTS AT LAST STORED CHAR
EE19- B9 FF 00 2780 .1     LDA STACK-1,Y     SEE IF LOPPABLE
EE1C- 88       2790        DEY
EE1D- C9 30    2800        CMP #'0'     SUPPRESS TRAILING ZEROES
EE1F- F0 F8    2810        BEQ .1       YES, KEEP LOOPING
EE21- C9 2E    2820        CMP #'.'     SUPPRESS TRAILING DECIMAL POINT
EE23- F0 01    2830        BEQ .2       ".", SO WRITE OVER IT
EE25- C8       2840        INY          NOT ".", SO INCLUDE IN STRING AGAIN
EE26- A9 2B    2850 .2     LDA #'+'     PREPARE FOR POSITIVE EXPONENT "E+XX"
EE28- A6 9A    2860        LDX EXPON    SEE IF ANY E-VALUE
EE2A- F0 2E    2870        BEQ FOUT.5   NO, JUST MARK END OF STRING
EE2C- 10 08    2880        BPL .3       YES, AND IT IS POSITIVE
EE2E- A9 00    2890        LDA #0       YES, AND IT IS NEGATIVE
EE30- 38       2900        SEC          COMPLEMENT THE VALUE
EE31- E5 9A    2910        SBC EXPON
EE33- AA       2920        TAX          GET MAGNITUDE IN X
EE34- A9 2D    2930        LDA #'-'     E SIGN
EE36- 99 01 01 2940 .3     STA STACK+1,Y     STORE SIGN IN STRING
EE39- A9 45    2950        LDA #'E'          STORE "E" IN STRING BEFORE SIGN
EE3B- 99 00 01 2960        STA STACK,Y
EE3E- 8A       2970        TXA          EXPONENT MAGNITUDE IN A-REG
EE3F- A2 2F    2980        LDX #'0'-1   SEED FOR EXPONENT DIGIT
EE41- 38       2990        SEC          CONVERT TO DECIMAL
EE42- E8       3000 .4     INX          COUNT THE SUBTRACTION
EE43- E9 0A    3010        SBC #10      TEN'S DIGIT
EE45- B0 FB    3020        BCS .4       MORE TENS TO SUBTRACT
EE47- 69 3A    3030        ADC #'0'+10  CONVERT REMAINDER TO ONE'S DIGIT
EE49- 99 03 01 3040        STA STACK+3,Y     STORE ONE'S DIGIT
EE4C- 8A       3050        TXA
EE4D- 99 02 01 3060        STA STACK+2,Y     STORE TEN'S DIGIT
EE50- A9 00    3070        LDA #0       MARK END OF STRING WITH $00
EE52- 99 04 01 3080        STA STACK+4,Y
EE55- F0 08    3090        BEQ FOUT.6   ...ALWAYS
EE57- 99 FF 00 3100 FOUT.4 STA STACK-1,Y     STORE "0" IN ASCII
EE5A- A9 00    3110 FOUT.5 LDA #0       STORE $00 ON END OF STRING
EE5C- 99 00 01 3120        STA STACK,Y
EE5F- A9 00    3130 FOUT.6 LDA #STACK   POINT Y,A AT BEGINNING OF STRING
EE61- A0 01    3140        LDY /STACK   (STR$ STARTED STRING AT STACK-1, BUT
EE63- 60       3150        RTS          STR$ DOESN'T USE Y,A ANYWAY.)
               3160 *--------------------------------
EE64- 80 00 00
EE67- 00 00    3170 CON.HALF   .HS 8000000000  FP CONSTANT 0.5
               3180 *--------------------------------
               3190 *      POWERS OF 10 FROM 1E8 DOWN TO 1,
               3200 *      AS 32-BIT INTEGERS, WITH ALTERNATING SIGNS
               3210 *--------------------------------
EE69- FA 0A 1F
EE6C- 00       3220 DECTBL .HS FA0A1F00  -100000000
EE6D- 00 98 96
EE70- 80       3230        .HS 00989680  10000000
EE71- FF F0 BD
EE74- C0       3240        .HS FFF0BDC0  -1000000
EE75- 00 01 86
EE78- A0       3250        .HS 000186A0  100000
EE79- FF FF D8
EE7C- F0       3260        .HS FFFFD8F0  -10000
EE7D- 00 00 03
EE80- E8       3270        .HS 000003E8  1000
EE81- FF FF FF
EE84- 9C       3280        .HS FFFFFF9C  -100
EE85- 00 00 00
EE88- 0A       3290        .HS 0000000A  10
EE89- FF FF FF
EE8C- FF       3300        .HS FFFFFFFF  -1
               3310 DECTBL.END
               3320 *--------------------------------



               SAVE S.EE8D
               1010 *--------------------------------
               1020 *      "SQR" FUNCTION
               1030 *
               1040 *      <<< UNFORTUNATELY, RATHER THAN A NEWTON-RAPHSON >>>
               1050 *      <<< ITERATION, APPLESOFT USES EXPONENTIATION    >>>
               1060 *      <<< SQR(X) = X^.5                               >>>
               1070 *--------------------------------
EE8D- 20 63 EB 1080 SQR    JSR COPY.FAC.TO.ARG.ROUNDED
EE90- A9 64    1090        LDA #CON.HALF     SET UP POWER OF 0.5
EE92- A0 EE    1100        LDY /CON.HALF
EE94- 20 F9 EA 1110        JSR LOAD.FAC.FROM.YA
               1120 *--------------------------------
               1130 *      EXPONENTIATION OPERATION
               1140 *
               1150 *      ARG ^ FAC  =  EXP( LOG(ARG) * FAC )
               1160 *--------------------------------
EE97- F0 70    1170 FPWRT  BEQ EXP      IF FAC=0, ARG^FAC=EXP(0)
EE99- A5 A5    1180        LDA ARG      IF ARG=0, ARG^FAC=0
EE9B- D0 03    1190        BNE .1       NEITHER IS ZERO
EE9D- 4C 50 E8 1200        JMP STA.IN.FAC.SIGN.AND.EXP   SET FAC = 0
EEA0- A2 8A    1210 .1     LDX #TEMP3   SAVE FAC IN TEMP3
EEA2- A0 00    1220        LDY #0
EEA4- 20 2B EB 1230        JSR STORE.FAC.AT.YX.ROUNDED
EEA7- A5 AA    1240        LDA ARG.SIGN NORMALLY, ARG MUST BE POSITIVE
EEA9- 10 0F    1250        BPL .2       IT IS POSITIVE, SO ALL IS WELL
EEAB- 20 23 EC 1260        JSR INT      NEGATIVE, BUT OK IF INTEGRAL POWER
EEAE- A9 8A    1270        LDA #TEMP3   SEE IF INT(FAC)=FAC
EEB0- A0 00    1280        LDY #0
EEB2- 20 B2 EB 1290        JSR FCOMP    IS IT AN INTEGER POWER?
EEB5- D0 03    1300        BNE .2       NOT INTEGRAL,  WILL CAUSE ERROR LATER
EEB7- 98       1310        TYA          MAKE ARG SIGN + AS IT IS MOVED TO FAC
EEB8- A4 0D    1320        LDY CHARAC   INTEGRAL, SO ALLOW NEGATIVE ARG
EEBA- 20 55 EB 1330 .2     JSR MFA      MOVE ARGUMENT TO FAC
EEBD- 98       1340        TYA          SAVE FLAG FOR NEGATIVE ARG (0=+)
EEBE- 48       1350        PHA
EEBF- 20 41 E9 1360        JSR LOG      GET LOG(ARG)
EEC2- A9 8A    1370        LDA #TEMP3   MULTIPLY BY POWER
EEC4- A0 00    1380        LDY #0
EEC6- 20 7F E9 1390        JSR FMULT
EEC9- 20 09 EF 1400        JSR EXP      E ^ LOG(FAC)
EECC- 68       1410        PLA          GET FLAG FOR NEGATIVE ARG
EECD- 4A       1420        LSR          <<<LSR,BCC COULD BE MERELY BPL>>>
EECE- 90 0A    1430        BCC RTS.18   NOT NEGATIVE, FINISHED
               1440 *                   NEGATIVE ARG, SO NEGATE RESULT
               1450 *--------------------------------
               1460 *      NEGATE VALUE IN FAC
               1470 *--------------------------------
EED0- A5 9D    1480 NEGOP  LDA FAC      IF FAC=0, NO NEED TO COMPLEMENT
EED2- F0 06    1490        BEQ RTS.18   YES, FAC=0
EED4- A5 A2    1500        LDA FAC.SIGN NO, SO TOGGLE SIGN
EED6- 49 FF    1510        EOR #$FF
EED8- 85 A2    1520        STA FAC.SIGN
EEDA- 60       1530 RTS.18 RTS
               1540 *--------------------------------
EEDB- 81 38 AA
EEDE- 3B 29    1550 CON.LOG.E .HS 8138AA3B29  LOG(E) TO BASE 2
               1560 *--------------------------------
EEE0- 07       1570 POLY.EXP .DA #7          ( # OF TERMS IN POLYNOMIAL) - 1
EEE1- 71 34 58
EEE4- 3E 56    1580          .HS 7134583E56  (LOG(2)^7)/8!
EEE6- 74 16 7E
EEE9- B3 1B    1590          .HS 74167EB31B  (LOG(2)^6)/7!
EEEB- 77 2F EE
EEEE- E3 85    1600          .HS 772FEEE385  (LOG(2)^5)/6!
EEF0- 7A 1D 84
EEF3- 1C 2A    1610          .HS 7A1D841C2A  (LOG(2)^4)/5!
EEF5- 7C 63 59
EEF8- 58 0A    1620          .HS 7C6359580A  (LOG(2)^3)/4!
EEFA- 7E 75 FD
EEFD- E7 C6    1630          .HS 7E75FDE7C6  (LOG(2)^2)/3!
EEFF- 80 31 72
EF02- 18 10    1640          .HS 8031721810  LOG(2)/2!
EF04- 81 00 00
EF07- 00 00    1650          .HS 8100000000  1
               1660 *--------------------------------
               1670 *      "EXP" FUNCTION
               1680 *
               1690 *      FAC = E ^ FAC
               1700 *--------------------------------
EF09- A9 DB    1710 EXP    LDA #CON.LOG.E    CONVERT TO POWER OF TWO PROBLEM
EF0B- A0 EE    1720        LDY /CON.LOG.E    E^X = 2^(LOG2(E)*X)
EF0D- 20 7F E9 1730        JSR FMULT
EF10- A5 AC    1740        LDA FAC.EXTENSION NON-STANDARD ROUNDING HERE
EF12- 69 50    1750        ADC #$50          ROUND UP IF EXTENSION > $AF
EF14- 90 03    1760        BCC .1            NO, DON'T ROUND UP
EF16- 20 7A EB 1770        JSR INCREMENT.MANTISSA
EF19- 85 92    1780 .1     STA ARG.EXTENSION STRANGE VALUE
EF1B- 20 66 EB 1790        JSR MAF      COPY FAC INTO ARG
EF1E- A5 9D    1800        LDA FAC      MAXIMUM EXPONENT IS < 128
EF20- C9 88    1810        CMP #$88     WITHIN RANGE?
EF22- 90 03    1820        BCC .3       YES
EF24- 20 2B EA 1830 .2     JSR OUTOFRNG OVERFLOW IF +, RETURN 0.0 IF -
EF27- 20 23 EC 1840 .3     JSR INT      GET INT(FAC)
EF2A- A5 0D    1850        LDA CHARAC   THIS IS THE INETGRAL PART OF THE POWER
EF2C- 18       1860        CLC          ADD TO EXPONENT BIAS + 1
EF2D- 69 81    1870        ADC #$81
EF2F- F0 F3    1880        BEQ .2       OVERFLOW
EF31- 38       1890        SEC          BACK OFF TO NORMAL BIAS
EF32- E9 01    1900        SBC #1
EF34- 48       1910        PHA          SAVE EXPONENT
               1920 *--------------------------------
EF35- A2 05    1930        LDX #5       SWAP ARG AND FAC
EF37- B5 A5    1940 .4     LDA ARG,X    <<< WHY SWAP? IT IS DOING      >>>
EF39- B4 9D    1950        LDY FAC,X    <<< -(A-B) WHEN (B-A) IS THE   >>>
EF3B- 95 9D    1960        STA FAC,X    <<< SAME THING!                >>>
EF3D- 94 A5    1970        STY ARG,X
EF3F- CA       1980        DEX
EF40- 10 F5    1990        BPL .4
EF42- A5 92    2000        LDA ARG.EXTENSION
EF44- 85 AC    2010        STA FAC.EXTENSION
EF46- 20 AA E7 2020        JSR FSUBT    POWER-INT(POWER) --> FRACTIONAL PART
EF49- 20 D0 EE 2030        JSR NEGOP
EF4C- A9 E0    2040        LDA #POLY.EXP
EF4E- A0 EE    2050        LDY /POLY.EXP
EF50- 20 72 EF 2060        JSR POLYNOMIAL    COMPUTE F(X) ON FRACTIONAL PART
EF53- A9 00    2070        LDA #0
EF55- 85 AB    2080        STA SGNCPR
EF57- 68       2090        PLA          GET EXPONENT
EF58- 20 10 EA 2100        JSR ADD.EXPONENTS.1
EF5B- 60       2110        RTS          <<< WASTED BYTE HERE, COULD HAVE >>>
               2120 *                   <<< JUST USED "JMP ADD.EXPO..."  >>>
               2130 *--------------------------------
               2140 *      ODD POLYNOMIAL SUBROUTINE
               2150 *
               2160 *      F(X) = X * P(X^2)
               2170 *
               2180 *      WHERE:  X IS VALUE IN FAC
               2190 *              Y,A POINTS AT COEFFICIENT TABLE
               2200 *              FIRST BYTE OF COEFF. TABLE IS N
               2210 *              COEFFICIENTS FOLLOW, HIGHEST POWER FIRST
               2220 *
               2230 *      P(X^2) COMPUTED USING NORMAL POLYNOMIAL SUBROUTINE
               2240 *
               2250 *--------------------------------
               2260 POLYNOMIAL.ODD
EF5C- 85 AD    2270        STA SERPNT   SAVE ADDRESS OF COEFFICIENT TABLE
EF5E- 84 AE    2280        STY SERPNT+1
EF60- 20 21 EB 2290        JSR STORE.FAC.IN.TEMP1.ROUNDED
EF63- A9 93    2300        LDA #TEMP1   Y=0 ALREADY, SO Y,A POINTS AT TEMP1
EF65- 20 7F E9 2310        JSR FMULT    FORM X^2
EF68- 20 76 EF 2320        JSR SERMAIN  DO SERIES IN X^2
EF6B- A9 93    2330        LDA #TEMP1   GET X AGAIN
EF6D- A0 00    2340        LDY /TEMP1
EF6F- 4C 7F E9 2350        JMP FMULT    MULTIPLY X BY P(X^2) AND EXIT
               2360 *--------------------------------
               2370 *      NORMAL POLYNOMIAL SUBROUTINE
               2380 *
               2390 *      P(X) = C(0)*X^N + C(1)*X^(N-1) + ... + C(N)
               2400 *
               2410 *      WHERE:  X IS VALUE IN FAC
               2420 *              Y,A POINTS AT COEFFICIENT TABLE
               2430 *              FIRST BYTE OF COEFF. TABLE IS N
               2440 *              COEFFICIENTS FOLLOW, HIGHEST POWER FIRST
               2450 *
               2460 *--------------------------------
               2470 POLYNOMIAL
EF72- 85 AD    2480        STA SERPNT   POINTER TO COEFFICIENT TABLE
EF74- 84 AE    2490        STY SERPNT+1
               2500 *--------------------------------
               2510 SERMAIN
EF76- 20 1E EB 2520        JSR STORE.FAC.IN.TEMP2.ROUNDED
EF79- B1 AD    2530        LDA (SERPNT),Y    GET N
EF7B- 85 A3    2540        STA SERLEN        SAVE N
EF7D- A4 AD    2550        LDY SERPNT        BUMP PNTR TO HIGHEST COEFFICIENT
EF7F- C8       2560        INY               AND GET PNTR INTO Y,A
EF80- 98       2570        TYA
EF81- D0 02    2580        BNE .1
EF83- E6 AE    2590        INC SERPNT+1
EF85- 85 AD    2600 .1     STA SERPNT
EF87- A4 AE    2610        LDY SERPNT+1
EF89- 20 7F E9 2620 .2     JSR FMULT         ACCUMULATE SERIES TERMS
EF8C- A5 AD    2630        LDA SERPNT        BUMP PNTR TO NEXT COEFFICIENT
EF8E- A4 AE    2640        LDY SERPNT+1
EF90- 18       2650        CLC
EF91- 69 05    2660        ADC #5
EF93- 90 01    2670        BCC .3
EF95- C8       2680        INY
EF96- 85 AD    2690 .3     STA SERPNT
EF98- 84 AE    2700        STY SERPNT+1
EF9A- 20 BE E7 2710        JSR FADD          ADD NEXT COEFFICIENT
EF9D- A9 98    2720        LDA #TEMP2        POINT AT X AGAIN
EF9F- A0 00    2730        LDY #0
EFA1- C6 A3    2740        DEC SERLEN        IF SERIES NOT FINISHED,
EFA3- D0 E4    2750        BNE .2            THEN ADD ANOTHER TERM
EFA5- 60       2760 RTS.19 RTS               FINISHED
               2770 *--------------------------------
EFA6- 98 35 44
EFA9- 7A       2780 CON.RND.1 .HS 9835447A  <<< THESE ARE MISSING ONE BYTE >>>
EFAA- 68 28 B1
EFAD- 46       2790 CON.RND.2 .HS 6828B146  <<< FOR FP VALUES              >>>
               2800 *--------------------------------
               2810 *      "RND" FUNCTION
               2820 *--------------------------------
EFAE- 20 82 EB 2830 RND    JSR SIGN     REDUCE ARGUMENT TO -1, 0, OR +1
EFB1- AA       2840        TAX          SAVE ARGUMENT
EFB2- 30 18    2850        BMI .1       = -1, USE CURRENT ARGUMENT FOR SEED
EFB4- A9 C9    2860        LDA #RNDSEED USE CURRENT SEED
EFB6- A0 00    2870        LDY /RNDSEED
EFB8- 20 F9 EA 2880        JSR LOAD.FAC.FROM.YA
EFBB- 8A       2890        TXA          RECALL SIGN OF ARGUMENT
EFBC- F0 E7    2900        BEQ RTS.19   =0, RETURN SEED UNCHANGED
EFBE- A9 A6    2910        LDA #CON.RND.1  VERY POOR RND ALGORITHM
EFC0- A0 EF    2920        LDY /CON.RND.1
EFC2- 20 7F E9 2930        JSR FMULT
EFC5- A9 AA    2940        LDA #CON.RND.2  ALSO, CONSTANTS ARE TRUNCATED
EFC7- A0 EF    2950        LDY /CON.RND.2  <<<THIS DOES NOTHING, DUE TO >>>
               2960 *                      <<<SMALL EXPONENT            >>>
EFC9- 20 BE E7 2970        JSR FADD
EFCC- A6 A1    2980 .1     LDX FAC+4    SHUFFLE HI AND LO BYTES
EFCE- A5 9E    2990        LDA FAC+1    TO SUPPOSEDLY MAKE IT MORE RANDOM
EFD0- 85 A1    3000        STA FAC+4
EFD2- 86 9E    3010        STX FAC+1
EFD4- A9 00    3020        LDA #0       MAKE IT POSITIVE
EFD6- 85 A2    3030        STA FAC.SIGN
EFD8- A5 9D    3040        LDA FAC      A SOMEWHAT RANDOM EXTENSION
EFDA- 85 AC    3050        STA FAC.EXTENSION
EFDC- A9 80    3060        LDA #$80     EXPONENT TO MAKE VALUE < 1.0
EFDE- 85 9D    3070        STA FAC
EFE0- 20 2E E8 3080        JSR NORMALIZE.FAC.2
EFE3- A2 C9    3090        LDX #RNDSEED  MOVE FAC TO RND SEED
EFE5- A0 00    3100        LDY /RNDSEED
EFE7- 4C 2B EB 3110 GO.MOVMF JMP STORE.FAC.AT.YX.ROUNDED
               3120 *--------------------------------



               SAVE S.EFEA
               1010 *--------------------------------
               1020 *      "COS" FUNCTION
               1030 *--------------------------------
EFEA- A9 66    1040 COS    LDA #CON.PI.HALF     COS(X)=SIN(X + PI/2)
EFEC- A0 F0    1050        LDY /CON.PI.HALF
EFEE- 20 BE E7 1060        JSR FADD
               1070 *--------------------------------
               1080 *      "SIN" FUNCTION
               1090 *--------------------------------
EFF1- 20 63 EB 1100 SIN    JSR COPY.FAC.TO.ARG.ROUNDED
EFF4- A9 6B    1110        LDA #CON.PI.DOUB  REMOVE MULTIPLES OF 2*PI
EFF6- A0 F0    1120        LDY /CON.PI.DOUB  BY DIVIDING AND SAVING
EFF8- A6 AA    1130        LDX ARG.SIGN      THE FRACTIONAL PART
EFFA- 20 5E EA 1140        JSR DIV           USE SIGN OF ARGUMENT
EFFD- 20 63 EB 1150        JSR COPY.FAC.TO.ARG.ROUNDED
F000- 20 23 EC 1160        JSR INT      TAKE INTEGER PART
F003- A9 00    1170        LDA #0       <<< WASTED LINES, BECAUSE FSUBT >>>
F005- 85 AB    1180        STA SGNCPR   <<< CHANGES SGNCPR AGAIN        >>>
F007- 20 AA E7 1190        JSR FSUBT    SUBTRACT TO GET FRACTIONAL PART
               1200 *--------------------------------
               1210 *      (FAC) = ANGLE AS A FRACTION OF A FULL CIRCLE
               1220 *
               1230 *      NOW FOLD THE RANGE INTO A QUARTER CIRCLE
               1240 *
               1250 *      <<< THERE ARE MUCH SIMPLER WAYS TO DO THIS >>>
               1260 *--------------------------------
F00A- A9 70    1270        LDA #QUARTER      1/4 - FRACTION MAKES
F00C- A0 F0    1280        LDY /QUARTER      -3/4 <= FRACTION < 1/4
F00E- 20 A7 E7 1290        JSR FSUB
F011- A5 A2    1300        LDA FAC.SIGN      TEST SIGN OF RESULT
F013- 48       1310        PHA               SAVE SIGN FOR LATER UNFOLDING
F014- 10 0D    1320        BPL SIN.1         ALREADY 0...1/4
F016- 20 A0 E7 1330        JSR FADDH         ADD 1/2 TO SHIFT TO -1/4...1/2
F019- A5 A2    1340        LDA FAC.SIGN      TEST SIGN
F01B- 30 09    1350        BMI SIN.2         -1/4...0
               1360 *                        0...1/2
F01D- A5 16    1370        LDA SIGNFLG       SIGNFLG INITIALIZED = 0 IN "TAN"
F01F- 49 FF    1380        EOR #$FF          FUNCTION
F021- 85 16    1390        STA SIGNFLG      "TAN" IS ONLY USER OF SIGNFLG TOO
               1400 *--------------------------------
               1410 *      IF FALL THRU, RANGE IS 0...1/2
               1420 *      IF BRANCH HERE, RANGE IS 0...1/4
               1430 *--------------------------------
F023- 20 D0 EE 1440 SIN.1  JSR NEGOP
               1450 *--------------------------------
               1460 *      IF FALL THRU, RANGE IS -1/2...0
               1470 *      IF BRANCH HERE, RANGE IS -1/4...0
               1480 *--------------------------------
F026- A9 70    1490 SIN.2  LDA #QUARTER      ADD 1/4 TO SHIFT RANGE
F028- A0 F0    1500        LDY /QUARTER      TO -1/4...1/4
F02A- 20 BE E7 1510        JSR FADD
F02D- 68       1520        PLA               GET SAVED SIGN FROM ABOVE
F02E- 10 03    1530        BPL .1
F030- 20 D0 EE 1540        JSR NEGOP         MAKE RANGE 0...1/4
F033- A9 75    1550 .1     LDA #POLY.SIN     DO STANDARD SIN SERIES
F035- A0 F0    1560        LDY /POLY.SIN
F037- 4C 5C EF 1570        JMP POLYNOMIAL.ODD
               1580 *--------------------------------
               1590 *      "TAN" FUNCTION
               1600 *
               1610 *      COMPUTE TAN(X) = SIN(X) / COS(X)
               1620 *--------------------------------
F03A- 20 21 EB 1630 TAN    JSR STORE.FAC.IN.TEMP1.ROUNDED
F03D- A9 00    1640        LDA #0       SIGNFLG WILL BE TOGGLED IF 2ND OR 3RD
F03F- 85 16    1650        STA SIGNFLG  QUADRANT
F041- 20 F1 EF 1660        JSR SIN      GET SIN(X)
F044- A2 8A    1670        LDX #TEMP3   SAVE SIN(X) IN TEMP3
F046- A0 00    1680        LDY /TEMP3
F048- 20 E7 EF 1690        JSR GO.MOVMF <<<FUNNY WAY TO CALL MOVMF! >>>
F04B- A9 93    1700        LDA #TEMP1   RETRIEVE X
F04D- A0 00    1710        LDY /TEMP1
F04F- 20 F9 EA 1720        JSR LOAD.FAC.FROM.YA
F052- A9 00    1730        LDA #0       AND COMPUTE COS(X)
F054- 85 A2    1740        STA FAC.SIGN
F056- A5 16    1750        LDA SIGNFLG
F058- 20 62 F0 1760        JSR TAN.1    WEIRD & DANGEROUS WAY TO GET INTO SIN
F05B- A9 8A    1770        LDA #TEMP3   NOW FORM SIN/COS
F05D- A0 00    1780        LDY /TEMP3
F05F- 4C 66 EA 1790        JMP FDIV
               1800 *--------------------------------
F062- 48       1810 TAN.1  PHA          SHAME, SHAME!
F063- 4C 23 F0 1820        JMP SIN.1
               1830 *--------------------------------
F066- 81 49 0F
F069- DA A2    1840 CON.PI.HALF .HS 81490FDAA2
F06B- 83 49 0F
F06E- DA A2    1850 CON.PI.DOUB .HS 83490FDAA2
F070- 7F 00 00
F073- 00 00    1860 QUARTER     .HS 7F00000000
               1870 *--------------------------------
F075- 05       1880 POLY.SIN .DA #5     POWER OF POLYNOMIAL
F076- 84 E6 1A
F079- 2D 1B    1890          .HS 84E61A2D1B  (2PI)^11/11!
F07B- 86 28 07
F07E- FB F8    1900          .HS 862807FBF8  (2PI)^9/9!
F080- 87 99 68
F083- 89 01    1910          .HS 8799688901  (2PI)^7/7!
F085- 87 23 35
F088- DF E1    1920          .HS 872335DFE1  (2PI)^5/5!
F08A- 86 A5 5D
F08D- E7 28    1930          .HS 86A55DE728  (2PI)^3/3!
F08F- 83 49 0F
F092- DA A2    1940          .HS 83490FDAA2  2PI
               1950 *--------------------------------
               1960 *  <<< NEXT TEN BYTES ARE NEVER REFERENCED >>>
               1970 *--------------------------------
F094- A6 D3 C1
F097- C8 D4    1980          .HS A6D3C1C8D4  OR "&SAHT" IN ASCII [exclusive-or each byte with $87 ]
F099- C8 D5 C4                                                   [to get the string "!TFOSORCIM"  ]
F09C- CE CA    1990          .HS C8D5C4CECA  OR "HUDNJ" IN ASCII [which is "MICROSOFT!" backwards.]
               2000 *--------------------------------
               2010 *      "ATN" FUNCTION
               2020 *--------------------------------
F09E- A5 A2    2030 ATN    LDA FAC.SIGN      FOLD THE ARGUMENT RANGE FIRST
F0A0- 48       2040        PHA               SAVE SIGN FOR LATER UNFOLDING
F0A1- 10 03    2050        BPL .1            .GE. 0
F0A3- 20 D0 EE 2060        JSR NEGOP         .LT. 0, SO COMPLEMENT
F0A6- A5 9D    2070 .1     LDA FAC           IF .GE. 1, FORM RECIPROCAL
F0A8- 48       2080        PHA               SAVE FOR LATER UNFOLDING
F0A9- C9 81    2090        CMP #$81          (EXPONENT FOR .GE. 1
F0AB- 90 07    2100        BCC .2            X < 1
F0AD- A9 13    2110        LDA #CON.ONE      FORM 1/X
F0AF- A0 E9    2120        LDY /CON.ONE
F0B1- 20 66 EA 2130        JSR FDIV
               2140 *--------------------------------
               2150 *      0 <= X <= 1
               2160 *      0 <= ATN(X) <= PI/8
               2170 *--------------------------------
F0B4- A9 CE    2180 .2     LDA #POLY.ATN     COMPUTE POLYNOMIAL APPROXIMATION
F0B6- A0 F0    2190        LDY /POLY.ATN
F0B8- 20 5C EF 2200        JSR POLYNOMIAL.ODD
F0BB- 68       2210        PLA               START TO UNFOLD
F0BC- C9 81    2220        CMP #$81          WAS IT .GE. 1?
F0BE- 90 07    2230        BCC .3            NO
F0C0- A9 66    2240        LDA #CON.PI.HALF  YES, SUBTRACT FROM PI/2
F0C2- A0 F0    2250        LDY /CON.PI.HALF
F0C4- 20 A7 E7 2260        JSR FSUB
F0C7- 68       2270 .3     PLA               WAS IT NEGATIVE?
F0C8- 10 03    2280        BPL RTS.20        NO
F0CA- 4C D0 EE 2290        JMP NEGOP         YES, COMPLEMENT
F0CD- 60       2300 RTS.20 RTS
               2310 *--------------------------------
F0CE- 0B       2320 POLY.ATN .DA #11    POWER OF POLYNOMIAL
F0CF- 76 B3 83
F0D2- BD D3    2330          .HS 76B383BDD3
F0D4- 79 1E F4
F0D7- A6 F5    2340          .HS 791EF4A6F5
F0D9- 7B 83 FC
F0DC- B0 10    2350          .HS 7B83FCB010
F0DE- 7C 0C 1F
F0E1- 67 CA    2360          .HS 7C0C1F67CA
F0E3- 7C DE 53
F0E6- CB C1    2370          .HS 7CDE53CBC1
F0E8- 7D 14 64
F0EB- 70 4C    2380          .HS 7D1464704C
F0ED- 7D B7 EA
F0F0- 51 7A    2390          .HS 7DB7EA517A
F0F2- 7D 63 30
F0F5- 88 7E    2400          .HS 7D6330887E
F0F7- 7E 92 44
F0FA- 99 3A    2410          .HS 7E9244993A
F0FC- 7E 4C CC
F0FF- 91 C7    2420          .HS 7E4CCC91C7
F101- 7F AA AA
F104- AA 13    2430          .HS 7FAAAAAA13
F106- 81 00 00
F109- 00 00    2440          .HS 8100000000
               2450 *--------------------------------
               2460 *      GENERIC COPY OF CHRGET SUBROUTINE, WHICH
               2470 *      IS COPIED INTO $00B1...$00C8 DURING INITIALIZATION
               2480 *
               2490 *      CORNELIS BONGERS DESCRIBED SEVERAL IMPROVEMENTS
               2500 *      TO CHRGET IN MICRO MAGAZINE OR CALL A.P.P.L.E.
               2510 *      (I DON'T REMEMBER WHICH OR EXACTLY WHEN)
               2520 *--------------------------------
               2530 GENERIC.CHRGET
F10B- E6 B8    2540        INC TXTPTR
F10D- D0 02    2550        BNE .1
F10F- E6 B9    2560        INC TXTPTR+1
F111- AD 60 EA 2570 .1     LDA $EA60    <<< ACTUAL ADDRESS FILLED IN LATER >>>
F114- C9 3A    2580        CMP #':'     EOS, ALSO TOP OF NUMERIC RANGE
F116- B0 0A    2590        BCS .2       NOT NUMBER, MIGHT BE EOS
F118- C9 20    2600        CMP #' '     IGNORE BLANKS
F11A- F0 EF    2610        BEQ GENERIC.CHRGET
F11C- 38       2620        SEC          TEST FOR NUMERIC RANGE IN WAY THAT
F11D- E9 30    2630        SBC #'0'     CLEARS CARRY IF CHAR IS DIGIT
F11F- 38       2640        SEC          AND LEAVES CHAR IN A-REG
F120- E9 D0    2650        SBC #-'0'
F122- 60       2660 .2     RTS
               2670 *--------------------------------
               2680 *      INITIAL VALUE FOR RANDOM NUMBER, ALSO COPIED
               2690 *      IN ALONG WITH CHRGET, BUT ERRONEOUSLY:
               2700 *  <<< THE LAST BYTE IS NOT COPIED >>>
               2710 *--------------------------------
F123- 80 4F C7
F126- 52 58    2720        .HS 804FC75258  APPROX. = .811635157
               2730 GENERIC.END
               2740 *--------------------------------
               2750 COLD.START
F128- A2 FF    2760        LDX #$FF     SET DIRECT MODE FLAG
F12A- 86 76    2770        STX CURLIN+1
F12C- A2 FB    2780        LDX #$FB     SET STACK POINTER, LEAVING ROOM FOR
F12E- 9A       2790        TXS          LINE BUFFER DURING PARSING
F12F- A9 28    2800        LDA #COLD.START   SET RESTART TO COLD.START
F131- A0 F1    2810        LDY /COLD.START   UNTIL COLDSTART IS COMPLETED
F133- 85 01    2820        STA GOWARM+1
F135- 84 02    2830        STY GOWARM+2
F137- 85 04    2840        STA GOSTROUT+1    ALSO SECOND USER VECTOR...
F139- 84 05    2850        STY GOSTROUT+2  ..WE SIMPLY MUST FINISH COLD.START!
F13B- 20 73 F2 2860        JSR NORMAL        SET NORMAL DISPLAY MODE
F13E- A9 4C    2870        LDA #$4C          "JMP" OPCODE FOR 4 VECTORS
F140- 85 00    2880        STA GOWARM        WARM START
F142- 85 03    2890        STA GOSTROUT      ANYONE EVER USE THIS ONE?
F144- 85 90    2900        STA JMPADRS       USED BY FUNCTIONS (JSR JMPADRS)
F146- 85 0A    2910        STA USR           "USR" FUNCTION VECTOR
F148- A9 99    2920        LDA #IQERR        POINT "USR" TO ILLEGAL QUANTITY
F14A- A0 E1    2930        LDY /IQERR        ERROR, UNTIL USER SETS IT UP
F14C- 85 0B    2940        STA USR+1
F14E- 84 0C    2950        STY USR+2
               2960 *--------------------------------
               2970 *      MOVE GENERIC CHRGET AND RANDOM SEED INTO PLACE
               2980 *
               2990 *  <<< NOTE THAT LOOP VALUE IS WRONG!          >>>
               3000 *  <<< THE LAST BYTE OF THE RANDOM SEED IS NOT >>>
               3010 *  <<< COPIED INTO PAGE ZERO!                  >>>
               3020 *--------------------------------
F150- A2 1C    3030        LDX #GENERIC.END-GENERIC.CHRGET-1
F152- BD 0A F1 3040 .1     LDA GENERIC.CHRGET-1,X
F155- 95 B0    3050        STA CHRGET-1,X
F157- 86 F1    3060        STX SPEEDZ        ON LAST PASS STORES $01)
F159- CA       3070        DEX
F15A- D0 F6    3080        BNE .1
               3090 *--------------------------------
F15C- 86 F2    3100        STX TRCFLG        X=0, TURN OFF TRACING
F15E- 8A       3110        TXA               A=0
F15F- 85 A4    3120        STA SHIFT.SIGN.EXT
F161- 85 54    3130        STA LASTPT+1
F163- 48       3140        PHA               PUT $00 ON STACK (WHAT FOR?)
F164- A9 03    3150        LDA #3       SET LENGTH OF TEMP. STRING DESCRIPTORS
F166- 85 8F    3160        STA DSCLEN   FOR GARBAGE COLLECTION SUBROUTINE
F168- 20 FB DA 3170        JSR CRDO     PRINT <RETURN>
F16B- A9 01    3180        LDA #1       SET UP FAKE FORWARD LINK
F16D- 8D FD 01 3190        STA INPUT.BUFFER-3
F170- 8D FC 01 3200        STA INPUT.BUFFER-4
F173- A2 55    3210        LDX #TEMPST  INIT INDEX TO TEMP STRING DESCRIPTORS
F175- 86 52    3220        STX TEMPPT
               3230 *--------------------------------
               3240 *      FIND HIGH END OF RAM
               3250 *--------------------------------
F177- A9 00    3260        LDA #$0800   SET UP POINTER TO LOW END OF RAM
F179- A0 08    3270        LDY /$0800
F17B- 85 50    3280        STA LINNUM
F17D- 84 51    3290        STY LINNUM+1
F17F- A0 00    3300        LDY #0
F181- E6 51    3310 .2     INC LINNUM+1      TEST FIRST BYTE OF EACH PAGE
F183- B1 50    3320        LDA (LINNUM),Y    BY COMPLEMENTING IT AND WATCHING
F185- 49 FF    3330        EOR #$FF          IT CHANGE THE SAME WAY
F187- 91 50    3340        STA (LINNUM),Y
F189- D1 50    3350        CMP (LINNUM),Y    ROM OR EMPTY SOCKETS WON'T TRACK
F18B- D0 08    3360        BNE .3            NOT RAM HERE
F18D- 49 FF    3370        EOR #$FF          RESTORE ORIGINAL VALUE
F18F- 91 50    3380        STA (LINNUM),Y
F191- D1 50    3390        CMP (LINNUM),Y    DID IT TRACK AGAIN?
F193- F0 EC    3400        BEQ .2            YES, STILL IN RAM
F195- A4 50    3410 .3     LDY LINNUM        NO, END OF RAM
F197- A5 51    3420        LDA LINNUM+1
F199- 29 F0    3430        AND #$F0          FORCE A MULTIPLE OF 4096 BYTES
F19B- 84 73    3440        STY MEMSIZ  (BAD RAM MAY HAVE YIELDED NON-MULTIPLE)
F19D- 85 74    3450        STA MEMSIZ+1
F19F- 84 6F    3460        STY FRETOP        SET HIMEM AND BOTTOM OF STRINGS
F1A1- 85 70    3470        STA FRETOP+1
F1A3- A2 00    3480        LDX #$0800        SET PROGRAM POINTER TO $0800
F1A5- A0 08    3490        LDY /$0800
F1A7- 86 67    3500        STX TXTTAB
F1A9- 84 68    3510        STY TXTTAB+1
F1AB- A0 00    3520        LDY #0            TURN OFF SEMI-SECRET LOCK FLAG
F1AD- 84 D6    3530        STY LOCK
F1AF- 98       3540        TYA               A=0 TOO
F1B0- 91 67    3550        STA (TXTTAB),Y    FIRST BYTE IN PROGRAM SPACE = 0
F1B2- E6 67    3560        INC TXTTAB        ADVANCE PAST THE $00
F1B4- D0 02    3570        BNE .4
F1B6- E6 68    3580        INC TXTTAB+1
F1B8- A5 67    3590 .4     LDA TXTTAB
F1BA- A4 68    3600        LDY TXTTAB+1
F1BC- 20 E3 D3 3610        JSR REASON        SET REST OF POINTERS UP
F1BF- 20 4B D6 3620        JSR SCRTCH        MORE POINTERS
F1C2- A9 3A    3630        LDA #STROUT       PUT CORRECT ADDRESSES IN TWO
F1C4- A0 DB    3640        LDY /STROUT       USER VECTORS
F1C6- 85 04    3650        STA GOSTROUT+1
F1C8- 84 05    3660        STY GOSTROUT+2
F1CA- A9 3C    3670        LDA #RESTART
F1CC- A0 D4    3680        LDY /RESTART
F1CE- 85 01    3690        STA GOWARM+1
F1D0- 84 02    3700        STY GOWARM+2
F1D2- 6C 01 00 3710        JMP (GOWARM+1)    SILLY, WHY NOT JUST "JMP RESTART"
               3720 *--------------------------------




               SAVE S.F1D5
               1010 *--------------------------------
               1020 *      "CALL" STATEMENT
               1030 *
               1040 *      EFFECTIVELY PERFORMS A "JSR" TO THE SPECIFIED
               1050 *      ADDRESS, WITH THE FOLLOWING REGISTER CONTENTS:
               1060 *           (A,Y) = CALL ADDRESS
               1070 *           (X)   = $9D
               1080 *
               1090 *      THE CALLED ROUTINE CAN RETURN WITH "RTS",
               1100 *      AND APPLESOFT WILL CONTINUE WITH THE NEXT
               1110 *      STATEMENT.
               1120 *--------------------------------
F1D5- 20 67 DD 1130 CALL   JSR FRMNUM   EVALUATE EXPRESSION FOR CALL ADDRESS
F1D8- 20 52 E7 1140        JSR GETADR   CONVERT EXPRESSION TO 16-BIT INTEGER
F1DB- 6C 50 00 1150        JMP (LINNUM)     IN LINNUM, AND JUMP THERE.
               1160 *--------------------------------
               1170 *      "IN#" STATEMENT
               1180 *
               1190 *      NOTE:  NO CHECK FOR VALID SLOT #, AS LONG
               1200 *      AS VALUE IS < 256 IT IS ACCEPTED.
               1210 *      MONITOR MASKS VALUE TO 4 BITS (0-15).
               1220 *--------------------------------
               1230 IN.NUMBER
F1DE- 20 F8 E6 1240        JSR GETBYT   GET SLOT NUMBER IN X-REG
F1E1- 8A       1250        TXA          MONITOR WILL INSTALL IN VECTOR
F1E2- 4C 8B FE 1260        JMP MON.INPORT    AT $38,39.
               1270 *--------------------------------
               1280 *      "PR#" STATEMENT
               1290 *
               1300 *      NOTE:  NO CHECK FOR VALID SLOT #, AS LONG
               1310 *      AS VALUE IS < 256 IT IS ACCEPTED.
               1320 *      MONITOR MASKS VALUE TO 4 BITS (0-15).
               1330 *--------------------------------
               1340 PR.NUMBER
F1E5- 20 F8 E6 1350        JSR GETBYT   GET SLOT NUMBER IN X-REG
F1E8- 8A       1360        TXA          MONITOR WILL INSTALL IN VECTOR
F1E9- 4C 95 FE 1370        JMP MON.OUTPORT   AT $36,37
               1380 *--------------------------------
               1390 *      GET TWO VALUES < 48, WITH COMMA SEPARATOR
               1400 *
               1410 *      CALLED FOR "PLOT X,Y"
               1420 *             AND "HLIN A,B AT Y"
               1430 *             AND "VLIN A,B AT X"
               1440 *
               1450 *--------------------------------
               1460 PLOTFNS
F1EC- 20 F8 E6 1470        JSR GETBYT   GET FIRST VALUE IN X-REG
F1EF- E0 30    1480        CPX #48      MUST BE < 48
F1F1- B0 13    1490        BCS GOERR    TOO LARGE
F1F3- 86 F0    1500        STX FIRST    SAVE FIRST VALUE
F1F5- A9 2C    1510        LDA #','     MUST HAVE A COMMA
F1F7- 20 C0 DE 1520        JSR SYNCHR
F1FA- 20 F8 E6 1530        JSR GETBYT   GET SECOND VALUE IN X-REG
F1FD- E0 30    1540        CPX #48      MUST BE < 48
F1FF- B0 05    1550        BCS GOERR    TOO LARGE
F201- 86 2C    1560        STX MON.H2   SAVE SECOND VALUE
F203- 86 2D    1570        STX MON.V2
F205- 60       1580        RTS          SECOND VALUE STILL IN X-REG
               1590 *--------------------------------
F206- 4C 99 E1 1600 GOERR  JMP IQERR    ILLEGAL QUANTITY ERROR
               1610 *--------------------------------
               1620 *      GET "A,B AT C" VALUES FOR "HLIN" AND "VLIN"
               1630 *
               1640 *      PUT SMALLER OF (A,B) IN FIRST,
               1650 *      AND LARGER  OF (A,B) IN H2 AND V2.
               1660 *      RETURN WITH (X) = C-VALUE.
               1670 *--------------------------------
               1680 LINCOOR
F209- 20 EC F1 1690        JSR PLOTFNS  GET A,B VALUES
F20C- E4 F0    1700        CPX FIRST    IS A < B?
F20E- B0 08    1710        BCS .1       YES, IN RIGHT ORDER
F210- A5 F0    1720        LDA FIRST    NO, INTERCHANGE THEM
F212- 85 2C    1730        STA MON.H2
F214- 85 2D    1740        STA MON.V2
F216- 86 F0    1750        STX FIRST
F218- A9 C5    1760 .1     LDA #TOKEN.AT     MUST HAVE "AT" NEXT
F21A- 20 C0 DE 1770        JSR SYNCHR
F21D- 20 F8 E6 1780        JSR GETBYT   GET C-VALUE IN X-REG
F220- E0 30    1790        CPX #48      MUST BE < 48
F222- B0 E2    1800        BCS GOERR    TOO LARGE
F224- 60       1810        RTS          C-VALUE IN X-REG
               1820 *--------------------------------
               1830 *      "PLOT" STATEMENT
               1840 *--------------------------------
F225- 20 EC F1 1850 PLOT   JSR PLOTFNS  GET X,Y VALUES
F228- 8A       1860        TXA          Y-COORD TO A-REG FOR MONITOR
F229- A4 F0    1870        LDY FIRST    X-COORD TO Y-YEG FOR MONITOR
F22B- C0 28    1880        CPY #40      X-COORD MUST BE < 40
F22D- B0 D7    1890        BCS GOERR    X-COORD IS TOO LARGE
F22F- 4C 00 F8 1900        JMP MON.PLOT      PLOT!
               1910 *--------------------------------
               1920 *      "HLIN" STATEMENT
               1930 *--------------------------------
F232- 20 09 F2 1940 HLIN   JSR LINCOOR  GET "A,B AT C"
F235- 8A       1950        TXA          Y-COORD IN A-REG
F236- A4 2C    1960        LDY MON.H2   RIGHT END OF LINE
F238- C0 28    1970        CPY #40      MUST BE < 40
F23A- B0 CA    1980        BCS GOERR    TOO LARGE
F23C- A4 F0    1990        LDY FIRST    LEFT END OF LINE IN Y-REG
F23E- 4C 19 F8 2000        JMP MON.HLINE     LET MONITOR DRAW LINE
               2010 *--------------------------------
               2020 *      "VLIN" STATEMENT
               2030 *--------------------------------
F241- 20 09 F2 2040 VLIN  JSR LINCOOR   GET "A,B AT C"
F244- 8A       2050        TXA          X-COORD IN Y-REG
F245- A8       2060        TAY
F246- C0 28    2070        CPY #40      X-COORD MUST BE < 40
F248- B0 BC    2080        BCS GOERR    TOO LARGE
F24A- A5 F0    2090        LDA FIRST    TOP END OF LINE IN A-REG
F24C- 4C 28 F8 2100        JMP MON.VLINE     LET MONITOR DRAW LINE
               2110 *--------------------------------
               2120 *      "COLOR=" STATEMENT
               2130 *--------------------------------
F24F- 20 F8 E6 2140 COLOR  JSR GETBYT   GET COLOR VALUE IN X-REG
F252- 8A       2150        TXA
F253- 4C 64 F8 2160        JMP MON.SETCOL    LET MONITOR STORE COLOR
               2170 *--------------------------------
               2180 *      "VTAB" STATEMENT
               2190 *--------------------------------
F256- 20 F8 E6 2200 VTAB   JSR GETBYT   GET LINE # IN X-REG
F259- CA       2210        DEX          CONVERT TO ZERO BASE
F25A- 8A       2220        TXA
F25B- C9 18    2230        CMP #24      MUST BE 0-23
F25D- B0 A7    2240        BCS GOERR    TOO LARGE, OR WAS "VTAB 0"
F25F- 4C 5B FB 2250        JMP MON.TABV      LET MONITOR COMPUTE BASE
               2260 *--------------------------------
               2270 *      "SPEED=" STATEMENT
               2280 *--------------------------------
F262- 20 F8 E6 2290 SPEED  JSR GETBYT   GET SPEED SETTING IN X-REG
F265- 8A       2300        TXA          SPEEDZ = $100-SPEED
F266- 49 FF    2310        EOR #$FF     SO "SPEED=255" IS FASTEST
F268- AA       2320        TAX
F269- E8       2330        INX
F26A- 86 F1    2340        STX SPEEDZ
F26C- 60       2350        RTS
               2360 *--------------------------------
               2370 *      "TRACE" STATEMENT
               2380 *      SET SIGN BIT IN TRCFLG
               2390 *--------------------------------
F26D- 38       2400 TRACE SEC
F26E- 90       2410        .HS 90       FAKE BCC TO SKIP NEXT OPCODE
               2420 *--------------------------------
               2430 *      "NOTRACE" STATEMENT
               2440 *      CLEAR SIGN BIT IN TRCFLG
               2450 *--------------------------------
               2460 NOTRACE
F26F- 18       2470        CLC
F270- 66 F2    2480        ROR TRCFLG   SHIFT CARRY INTO TRCFLG
F272- 60       2490        RTS
               2500 *--------------------------------
               2510 *      "NORMAL" STATEMENT
               2520 *--------------------------------
F273- A9 FF    2530 NORMAL LDA #$FF     SET INVFLG = $FF
F275- D0 02    2540        BNE N.I.     AND FLASH.BIT = $00
               2550 *--------------------------------
               2560 *      "INVERSE" STATEMENT
               2570 *--------------------------------
               2580 INVERSE
F277- A9 3F    2590        LDA #$3F     SET INVFLG = $3F
F279- A2 00    2600 N.I.   LDX #0       AND FLASH.BIT = $00
F27B- 85 32    2610 N.I.F. STA MON.INVFLG
F27D- 86 F3    2620        STX FLASH.BIT
F27F- 60       2630        RTS
               2640 *--------------------------------
               2650 *      "FLASH" STATEMENT
               2660 *--------------------------------
F280- A9 7F    2670 FLASH  LDA #$7F     SET INVFLG = $7F
F282- A2 40    2680        LDX #$40     AND FLASH.BIT = $40
F284- D0 F5    2690        BNE N.I.F.   ...ALWAYS
               2700 *--------------------------------
               2710 *      "HIMEM:" STATEMENT
               2720 *--------------------------------
F286- 20 67 DD 2730 HIMEM  JSR FRMNUM   GET VALUE SPECIFIED FOR HIMEM
F289- 20 52 E7 2740        JSR GETADR   AS 16-BIT INTEGER
F28C- A5 50    2750        LDA LINNUM   MUST BE ABOVE VARIABLES AND ARRAYS
F28E- C5 6D    2760        CMP STREND
F290- A5 51    2770        LDA LINNUM+1
F292- E5 6E    2780        SBC STREND+1
F294- B0 03    2790        BCS SETHI    IT IS ABOVE THEM
F296- 4C 10 D4 2800 JMM    JMP MEMERR   NOT ENOUGH MEMORY
F299- A5 50    2810 SETHI  LDA LINNUM   STORE NEW HIMEM: VALUE
F29B- 85 73    2820        STA MEMSIZ
F29D- 85 6F    2830        STA FRETOP   <<<NOTE THAT "HIMEM:" DOES NOT>>>
F29F- A5 51    2840        LDA LINNUM+1 <<<CLEAR STRING VARIABLES.    >>>
F2A1- 85 74    2850        STA MEMSIZ+1 <<<THIS COULD BE DISASTROUS.  >>>
F2A3- 85 70    2860        STA FRETOP+1
F2A5- 60       2870        RTS
               2880 *--------------------------------
               2890 *      "LOMEM:" STATEMENT
               2900 *--------------------------------
F2A6- 20 67 DD 2910 LOMEM  JSR FRMNUM   GET VALUE SPECIFIED FOR LOMEM
F2A9- 20 52 E7 2920        JSR GETADR   AS 16-BIT INTEGER IN LINNUM
F2AC- A5 50    2930        LDA LINNUM   MUST BE BELOW HIMEM
F2AE- C5 73    2940        CMP MEMSIZ
F2B0- A5 51    2950        LDA LINNUM+1
F2B2- E5 74    2960        SBC MEMSIZ+1
F2B4- B0 E0    2970        BCS JMM      ABOVE HIMEM, MEMORY ERROR
F2B6- A5 50    2980        LDA LINNUM   MUST BE ABOVE PROGRAM
F2B8- C5 69    2990        CMP VARTAB
F2BA- A5 51    3000        LDA LINNUM+1
F2BC- E5 6A    3010        SBC VARTAB+1
F2BE- 90 D6    3020        BCC JMM      NOT ABOVE PROGRAM, ERROR
F2C0- A5 50    3030        LDA LINNUM   STORE NEW LOMEM VALUE
F2C2- 85 69    3040        STA VARTAB
F2C4- A5 51    3050        LDA LINNUM+1
F2C6- 85 6A    3060        STA VARTAB+1
F2C8- 4C 6C D6 3070        JMP CLEARC   LOMEM CLEARS VARIABLES AND ARRAYS
               3080 *--------------------------------
               3090 *      "ON ERR GO TO" STATEMENT
               3100 *--------------------------------
F2CB- A9 AB    3110 ONERR  LDA #TOKEN.GOTO   MUST BE "GOTO" NEXT
F2CD- 20 C0 DE 3120        JSR SYNCHR
F2D0- A5 B8    3130        LDA TXTPTR   SAVE TXTPTR FOR HANDLERR
F2D2- 85 F4    3140        STA TXTPSV
F2D4- A5 B9    3150        LDA TXTPTR+1
F2D6- 85 F5    3160        STA TXTPSV+1
F2D8- 38       3170        SEC          SET SIGN BIT OF ERRFLG
F2D9- 66 D8    3180        ROR ERRFLG
F2DB- A5 75    3190        LDA CURLIN   SAVE LINE # OF CURRENT LINE
F2DD- 85 F6    3200        STA CURLSV
F2DF- A5 76    3210        LDA CURLIN+1
F2E1- 85 F7    3220        STA CURLSV+1
F2E3- 20 A6 D9 3230        JSR REMN     IGNORE REST OF LINE <<<WHY?>>>
F2E6- 4C 98 D9 3240        JMP ADDON    CONTINUE PROGRAM
               3250 *--------------------------------
               3260 *      ROUTINE TO HANDLE ERRORS IF ONERR GOTO ACTIVE
               3270 *--------------------------------
               3280 HANDLERR
F2E9- 86 DE    3290        STX ERRNUM   SAVE ERROR CODE NUMBER
F2EB- A6 F8    3300        LDX REMSTK   GET STACK PNTR SAVED AT NEWSTT
F2ED- 86 DF    3310        STX ERRSTK   REMEMBER IT
               3320 *                   <<<COULD ALSO HAVE DONE TXS  >>>
               3330 *                   <<<HERE; SEE ONERR CORRECTION>>>
               3340 *                   <<<IN APPLESOFT MANUAL.      >>>
F2EF- A5 75    3350        LDA CURLIN   GET LINE # OF OFFENDING STATEMENT
F2F1- 85 DA    3360        STA ERRLIN   SO USER CAN SEE IT IF DESIRED
F2F3- A5 76    3370        LDA CURLIN+1
F2F5- 85 DB    3380        STA ERRLIN+1
F2F7- A5 79    3390        LDA OLDTEXT  ALSO THE POSITION IN THE LINE
F2F9- 85 DC    3400        STA ERRPOS   IN CASE USER WANTS TO "RESUME"
F2FB- A5 7A    3410        LDA OLDTEXT+1
F2FD- 85 DD    3420        STA ERRPOS+1
F2FF- A5 F4    3430        LDA TXTPSV   SET UP TXTPTR TO READ TARGET LINE #
F301- 85 B8    3440        STA TXTPTR   IN "ON ERR GO TO XXXX"
F303- A5 F5    3450        LDA TXTPSV+1
F305- 85 B9    3460        STA TXTPTR+1
F307- A5 F6    3470        LDA CURLSV
F309- 85 75    3480        STA CURLIN   LINE # OF "ON ERR" STATEMENT
F30B- A5 F7    3490        LDA CURLSV+1
F30D- 85 76    3500        STA CURLIN+1
F30F- 20 B7 00 3510        JSR CHRGOT   START CONVERSION
F312- 20 3E D9 3520        JSR GOTO     GOTO SPECIFIED ONERR LINE
F315- 4C D2 D7 3530        JMP NEWSTT
               3540 *--------------------------------
               3550 *      "RESUME" STATEMENT
               3560 *--------------------------------
F318- A5 DA    3570 RESUME LDA ERRLIN   RESTORE LINE # AND TXTPTR
F31A- 85 75    3580        STA CURLIN   TO RE-TRY OFFENDING LINE
F31C- A5 DB    3590        LDA ERRLIN+1
F31E- 85 76    3600        STA CURLIN+1
F320- A5 DC    3610        LDA ERRPOS
F322- 85 B8    3620        STA TXTPTR
F324- A5 DD    3630        LDA ERRPOS+1
F326- 85 B9    3640        STA TXTPTR+1
               3650 *  <<< ONERR CORRECTION IN MANUAL IS EASILY >>>
               3660 *  <<< BY "CALL -3288", WHICH IS $F328 HERE >>>
F328- A6 DF    3670        LDX ERRSTK   RETRIEVE STACK PNTR AS IT WAS
F32A- 9A       3680        TXS          BEFORE STATEMENT SCANNED
F32B- 4C D2 D7 3690        JMP NEWSTT   DO STATEMENT AGAIN
               3700 *--------------------------------
F32E- 4C C9 DE 3710 JSYN   JMP SYNERR
               3720 *--------------------------------
               3730 *      "DEL" STATEMENT
               3740 *--------------------------------
F331- B0 FB    3750 DEL    BCS JSYN     ERROR IF # NOT SPECIFIED
F333- A6 AF    3760        LDX PRGEND
F335- 86 69    3770        STX VARTAB
F337- A6 B0    3780        LDX PRGEND+1
F339- 86 6A    3790        STX VARTAB+1
F33B- 20 0C DA 3800        JSR LINGET   GET BEGINNING OF RANGE
F33E- 20 1A D6 3810        JSR FNDLIN   FIND THIS LINE OR NEXT
F341- A5 9B    3820        LDA LOWTR    UPPER PORTION OF PROGRAM WILL
F343- 85 60    3830        STA DEST     BE MOVED DOWN TO HERE
F345- A5 9C    3840        LDA LOWTR+1
F347- 85 61    3850        STA DEST+1
F349- A9 2C    3860        LDA #','     MUST HAVE A COMMA NEXT
F34B- 20 C0 DE 3870        JSR SYNCHR
F34E- 20 0C DA 3880        JSR LINGET   GET END RANGE
               3890 *                   (DOES NOTHING IF END RANGE
               3900 *                   IS NOT SPECIFIED)
F351- E6 50    3910        INC LINNUM   POINT ONE PAST IT
F353- D0 02    3920        BNE .1
F355- E6 51    3930        INC LINNUM+1
F357- 20 1A D6 3940 .1     JSR FNDLIN   FIND START LINE AFTER SPECIFIED LINE
F35A- A5 9B    3950        LDA LOWTR    WHICH IS BEGINNING OF PORTION
F35C- C5 60    3960        CMP DEST     TO BE MOVED DOWN
F35E- A5 9C    3970        LDA LOWTR+1  IT MUST BE ABOVE THE TARGET
F360- E5 61    3980        SBC DEST+1
F362- B0 01    3990        BCS .2       IT IS OKAY
F364- 60       4000        RTS          NOTHING TO DELETE
F365- A0 00    4010 .2     LDY #0       MOVE UPPER PORTION DOWN NOW
F367- B1 9B    4020 .3     LDA (LOWTR),Y     SOURCE . . .
F369- 91 60    4030        STA (DEST),Y      ...TO DESTINATION
F36B- E6 9B    4040        INC LOWTR         BUMP SOURCE PNTR
F36D- D0 02    4050        BNE .4
F36F- E6 9C    4060        INC LOWTR+1
F371- E6 60    4070 .4     INC DEST          BUMP DESTINATION PNTR
F373- D0 02    4080        BNE .5
F375- E6 61    4090        INC DEST+1
F377- A5 69    4100 .5     LDA VARTAB        REACHED END OF PROGRAM YET?
F379- C5 9B    4110        CMP LOWTR
F37B- A5 6A    4120        LDA VARTAB+1
F37D- E5 9C    4130        SBC LOWTR+1
F37F- B0 E6    4140        BCS .3            NO, KEEP MOVING
F381- A6 61    4150        LDX DEST+1        STORE NEW END OF PROGRAM
F383- A4 60    4160        LDY DEST          MUST SUBTRACT 1 FIRST
F385- D0 01    4170        BNE .6
F387- CA       4180        DEX
F388- 88       4190 .6     DEY
F389- 86 6A    4200        STX VARTAB+1
F38B- 84 69    4210        STY VARTAB
F38D- 4C F2 D4 4220        JMP FIX.LINKS  RESET LINKS AFTER A DELETE
               4230 *--------------------------------
               4240 *      "GR" STATEMENT
               4250 *--------------------------------
F390- AD 56 C0 4260 GR     LDA SW.LORES
F393- AD 53 C0 4270        LDA SW.MIXSET
F396- 4C 40 FB 4280        JMP MON.SETGR
               4290 *--------------------------------
               4300 *      "TEXT" STATEMENT
               4310 *--------------------------------
F399- AD 54 C0 4320 TEXT   LDA SW.LOWSCR     JMP $FB36 WOULD HAVE
F39C- 4C 39 FB 4330        JMP MON.SETTXT    DONE BOTH OF THESE
               4340 * <<<       BETTER CODE WOULD BE:   >>>
               4350 * <<<  LDA SW.MIXSET                >>>
               4360 * <<<  JMP $FB33                    >>>
               4370 *--------------------------------
               4380 *      "STORE" STATEMENT
               4390 *--------------------------------
F39F- 20 D9 F7 4400 STORE  JSR GETARYPT GET ADDRESS OF ARRAY TO BE SAVED
F3A2- A0 03    4410        LDY #3       FORWARD OFFSET - 1 IS SIZE OF
F3A4- B1 9B    4420        LDA (LOWTR),Y     THIS ARRAY
F3A6- AA       4430        TAX
F3A7- 88       4440        DEY
F3A8- B1 9B    4450        LDA (LOWTR),Y
F3AA- E9 01    4460        SBC #1
F3AC- B0 01    4470        BCS .1
F3AE- CA       4480        DEX
F3AF- 85 50    4490 .1     STA LINNUM
F3B1- 86 51    4500        STX LINNUM+1
F3B3- 20 CD FE 4510        JSR MON.WRITE
F3B6- 20 BC F7 4520        JSR TAPEPNT
F3B9- 4C CD FE 4530        JMP MON.WRITE
               4540 *--------------------------------
               4550 *      "RECALL" STATEMENT
               4560 *--------------------------------
F3BC- 20 D9 F7 4570 RECALL JSR GETARYPT   FIND ARRAY IN MEMORY
F3BF- 20 FD FE 4580        JSR MON.READ      READ HEADER
F3C2- A0 02    4590        LDY #2         MAKE SURE THE NEW DATA FITS
F3C4- B1 9B    4600        LDA (LOWTR),Y
F3C6- C5 50    4610        CMP LINNUM
F3C8- C8       4620        INY
F3C9- B1 9B    4630        LDA (LOWTR),Y
F3CB- E5 51    4640        SBC LINNUM+1
F3CD- B0 03    4650        BCS .1         IT FITS
F3CF- 4C 10 D4 4660        JMP MEMERR     DOESN'T FIT
F3D2- 20 BC F7 4670 .1     JSR TAPEPNT    READ THE DATA
F3D5- 4C FD FE 4680        JMP MON.READ




               SAVE S.F3D8
               1010 *--------------------------------
               1020 *      "HGR" AND "HGR2" STATEMENTS
               1030 *--------------------------------
F3D8- 2C 55 C0 1040 HGR2   BIT SW.HISCR      SELECT PAGE 2 ($4000-5FFF)
F3DB- 2C 52 C0 1050        BIT SW.MIXCLR     DEFAULT TO FULL SCREEN
F3DE- A9 40    1060        LDA /$4000        SET STARTING PAGE FOR HIRES
F3E0- D0 08    1070        BNE SETHPG        ...ALWAYS
F3E2- A9 20    1080 HGR    LDA /$2000        SET STARTING PAGE FOR HIRES
F3E4- 2C 54 C0 1090        BIT SW.LOWSCR     SELECT PAGE 1 ($2000-3FFF)
F3E7- 2C 53 C0 1100        BIT SW.MIXSET     DEFAULT TO MIXED SCREEN
F3EA- 85 E6    1110 SETHPG STA HGR.PAGE          BASE PAGE OF HIRES BUFFER
F3EC- AD 57 C0 1120        LDA SW.HIRES      TURN ON HIRES
F3EF- AD 50 C0 1130        LDA SW.TXTCLR     TURN ON GRAPHICS
               1140 *--------------------------------
               1150 *      CLEAR SCREEN
               1160 *--------------------------------
F3F2- A9 00    1170 HCLR   LDA #0            SET FOR BLACK BACKGROUND
F3F4- 85 1C    1180        STA HGR.BITS
               1190 *--------------------------------
               1200 *      FILL SCREEN WITH (HGR.BITS)
               1210 *--------------------------------
F3F6- A5 E6    1220 BKGND  LDA HGR.PAGE     PUT BUFFER ADDRESS IN HGR.SHAPE
F3F8- 85 1B    1230        STA HGR.SHAPE+1
F3FA- A0 00    1240        LDY #0
F3FC- 84 1A    1250        STY HGR.SHAPE
F3FE- A5 1C    1260 .1     LDA HGR.BITS  COLOR BYTE
F400- 91 1A    1270        STA (HGR.SHAPE),Y  CLEAR HIRES TO HGR.BITS
F402- 20 7E F4 1280        JSR COLOR.SHIFT   CORRECT FOR COLOR SHIFT
F405- C8       1290        INY          (SLOWS CLEAR BY FACTOR OF 2)
F406- D0 F6    1300        BNE .1
F408- E6 1B    1310        INC HGR.SHAPE+1
F40A- A5 1B    1320        LDA HGR.SHAPE+1
F40C- 29 1F    1330        AND #$1F     DONE?  ($40 OR$60)
F40E- D0 EE    1340        BNE .1       NO
F410- 60       1350        RTS          YES, RETURN
               1360 *--------------------------------
               1370 *      SET THE HIRES CURSOR POSITION
               1380 *
               1390 *      (Y,X) = HORIZONTAL COORDINATE  (0-279)
               1400 *      (A)   = VERTICAL COORDINATE    (0-191)
               1410 *--------------------------------
F411- 85 E2    1420 HPOSN  STA HGR.Y       SAVE Y- AND X-POSITIONS
F413- 86 E0    1430        STX HGR.X
F415- 84 E1    1440        STY HGR.X+1
F417- 48       1450        PHA          Y-POS ALSO ON STACK
F418- 29 C0    1460        AND #$C0     CALCULATE BASE ADDRESS FOR Y-POS
F41A- 85 26    1470        STA MON.GBASL     FOR Y=ABCDEFGH
F41C- 4A       1480        LSR               GBASL=ABAB0000
F41D- 4A       1490        LSR
F41E- 05 26    1500        ORA MON.GBASL
F420- 85 26    1510        STA MON.GBASL
F422- 68       1520        PLA                (A)      (GBASH)   (GBASL)
F423- 85 27    1530        STA MON.GBASH  ?-ABCDEFGH  ABCDEFGH  ABAB0000
F425- 0A       1540        ASL            A-BCDEFGH0  ABCDEFGH  ABAB0000
F426- 0A       1550        ASL            B-CDEFGH00  ABCDEFGH  ABAB0000
F427- 0A       1560        ASL            C-DEFGH000  ABCDEFGH  ABAB0000
F428- 26 27    1570        ROL MON.GBASH  A-DEFGH000  BCDEFGHC  ABAB0000
F42A- 0A       1580        ASL            D-EFGH0000  BCDEFGHC  ABAB0000
F42B- 26 27    1590        ROL MON.GBASH  B-EFGH0000  CDEFGHCD  ABAB0000
F42D- 0A       1600        ASL            E-FGH00000  CDEFGHCD  ABAB0000
F42E- 66 26    1610        ROR MON.GBASL  0-FGH00000  CDEFGHCD  EABAB000
F430- A5 27    1620        LDA MON.GBASH  0-CDEFGHCD  CDEFGHCD  EABAB000
F432- 29 1F    1630        AND #$1F       0-000FGHCD  CDEFGHCD  EABAB000
F434- 05 E6    1640        ORA HGR.PAGE   0-PPPFGHCD  CDEFGHCD  EABAB000
F436- 85 27    1650        STA MON.GBASH  0-PPPFGHCD  PPPFGHCD  EABAB000
F438- 8A       1660        TXA          DIVIDE X-POS BY 7 FOR INDEX FROM BASE
F439- C0 00    1670        CPY #0       IS X-POS < 256?
F43B- F0 05    1680        BEQ .2       YES
F43D- A0 23    1690        LDY #35      NO: 256/7 = 36 REM 4
               1700 *                   CARRY=1, SO ADC #4 IS TOO LARGE;
               1710 *                   HOWEVER, ADC #4 CLEARS CARRY
               1720 *                   WHICH MAKES SBC #7 ONLY -6
               1730 *                   BALANCING IT OUT.
F43F- 69 04    1740        ADC #4       FOLLOWING INY MAKES Y=36
F441- C8       1750 .1     INY
F442- E9 07    1760 .2     SBC #7
F444- B0 FB    1770        BCS .1
F446- 84 E5    1780        STY HGR.HORIZ     HORIZONTAL INDEX
F448- AA       1790        TAX          USE REMAINDER-7 TO LOOK UP THE
F449- BD B9 F4 1800        LDA MSKTBL-$100+7,X  BIT MASK
F44C- 85 30    1810        STA MON.HMASK
F44E- 98       1820        TYA          QUOTIENT GIVES BYTE INDEX
F44F- 4A       1830        LSR          ODD OR EVEN COLUMN?
F450- A5 E4    1840        LDA HGR.COLOR  IF ON ODD BYTE (CARRY SET)
F452- 85 1C    1850        STA HGR.BITS  THEN ROTATE BITS
F454- B0 28    1860        BCS COLOR.SHIFT   ODD COLUMN
F456- 60       1870        RTS          EVEN COLUMN
               1880 *--------------------------------
               1890 *      PLOT A DOT
               1900 *
               1910 *      (Y,X) = HORIZONTAL POSITION
               1920 *      (A)   = VERTICAL POSITION
               1930 *--------------------------------
F457- 20 11 F4 1940 HPLOT0 JSR HPOSN
F45A- A5 1C    1950        LDA HGR.BITS      CALCULATE BIT POSN IN GBAS,
F45C- 51 26    1960        EOR (MON.GBASL),Y HGR.HORIZ, AND HMASK FROM
F45E- 25 30    1970        AND MON.HMASK     Y-COOR IN A-REG,
F460- 51 26    1980        EOR (MON.GBASL),Y X-COOR IN X,Y REGS.
F462- 91 26    1990        STA (MON.GBASL),Y FOR ANY 1-BITS, SUBSTITUTE
F464- 60       2000        RTS               CORRESPONDING BIT OF HGR.BITS
               2010 *--------------------------------
               2020 *      MOVE LEFT OR RIGHT ONE PIXEL
               2030 *
               2040 *      IF STATUS IS +, MOVE RIGHT; IF -, MOVE LEFT
               2050 *      IF ALREADY AT LEFT OR RIGHT EDGE, WRAP AROUND
               2060 *
               2070 *      REMEMBER BITS IN HI-RES BYTE ARE BACKWARDS ORDER:
               2080 *          BYTE N   BYTE N+1
               2090 *        S7654321   SEDCBA98
               2100 *--------------------------------
               2110 MOVE.LEFT.OR.RIGHT
F465- 10 23    2120        BPL MOVE.RIGHT  + MOVE RIGHT, - MOVE LEFT
F467- A5 30    2130        LDA MON.HMASK     MOVE LEFT ONE PIXEL
F469- 4A       2140        LSR          SHIFT MASK RIGHT, MOVES DOT LEFT
F46A- B0 05    2150        BCS LR.2     ...DOT MOVED TO NEXT BYTE
F46C- 49 C0    2160        EOR #$C0     MOVE SIGN BIT BACK WHERE IT WAS
F46E- 85 30    2170 LR.1   STA MON.HMASK     NEW MASK VALUE
F470- 60       2180        RTS
F471- 88       2190 LR.2   DEY          MOVED TO NEXT BYTE, SO DECR INDEX
F472- 10 02    2200        BPL LR.3     STILL NOT PAST EDGE
F474- A0 27    2210        LDY #39      OFF LEFT EDGE, SO WRAP AROUND SCREEN
F476- A9 C0    2220 LR.3   LDA #$C0     NEW HMASK, RIGHTMOST BIT ON SCREEN
F478- 85 30    2230 LR.4   STA MON.HMASK     NEW MASK AND INDEX
F47A- 84 E5    2240        STY HGR.HORIZ
F47C- A5 1C    2250        LDA HGR.BITS       ALSO NEED TO ROTATE COLOR
               2260 *--------------------------------
               2270 COLOR.SHIFT
F47E- 0A       2280        ASL          ROTATE LOW-ORDER 7 BITS
F47F- C9 C0    2290        CMP #$C0      OF HGR.BITS ONE BIT POSN.
F481- 10 06    2300        BPL .1
F483- A5 1C    2310        LDA HGR.BITS
F485- 49 7F    2320        EOR #$7F
F487- 85 1C    2330        STA HGR.BITS
F489- 60       2340 .1     RTS
               2350 *--------------------------------
               2360 *      MOVE RIGHT ONE PIXEL
               2370 *      IF ALREADY AT RIGHT EDGE, WRAP AROUND
               2380 *--------------------------------
               2390 MOVE.RIGHT
F48A- A5 30    2400        LDA MON.HMASK
F48C- 0A       2410        ASL          SHIFTING BYTE LEFT MOVES PIXEL RIGHT
F48D- 49 80    2420        EOR #$80
               2430 *          ORIGINAL:  C0 A0 90 88 84 82 81
               2440 *          SHIFTED:   80 40 20 10 08 02 01
               2450 *          EOR #$80:  00 C0 A0 90 88 84 82
F48F- 30 DD    2460        BMI LR.1     FINISHED
F491- A9 81    2470        LDA #$81     NEW MASK VALUE
F493- C8       2480        INY          MOVE TO NEXT BYTE RIGHT
F494- C0 28    2490        CPY #40      UNLESS THAT IS TOO FAR
F496- 90 E0    2500        BCC LR.4     NOT TOO FAR
F498- A0 00    2510        LDY #0       TOO FAR, SO WRAP AROUND
F49A- B0 DC    2520        BCS LR.4     ...ALWAYS
               2530 *--------------------------------



               SAVE S.F49C
               1010 *--------------------------------
               1020 *      "XDRAW" ONE BIT
               1030 *--------------------------------
F49C- 18       1040 LRUDX1 CLC          C=0 MEANS NO 90 DEGREE ROTATION
F49D- A5 D1    1050 LRUDX2 LDA HGR.DX+1      C=1 MEANS ROTATE 90 DEGREES
F49F- 29 04    1060        AND #4       IF BIT2=0 THEN DON'T PLOT
F4A1- F0 25    1070        BEQ LRUD4    YES, DO NOT PLOT
F4A3- A9 7F    1080        LDA #$7F     NO, LOOK AT WHAT IS ALREADY THERE
F4A5- 25 30    1090        AND MON.HMASK
F4A7- 31 26    1100        AND (MON.GBASL),Y  SCREEN BIT = 1?
F4A9- D0 19    1110        BNE LRUD3          YES, GO CLEAR IT
F4AB- E6 EA    1120        INC HGR.COLLISIONS       NO, COUNT THE COLLISION
F4AD- A9 7F    1130        LDA #$7F           AND TURN THE BIT ON
F4AF- 25 30    1140        AND MON.HMASK
F4B1- 10 11    1150        BPL LRUD3    ...ALWAYS
               1160 *--------------------------------
               1170 *      "DRAW" ONE BIT
               1180 *--------------------------------
F4B3- 18       1190 LRUD1  CLC          C=0 MEANS NO 90 DEGREE ROTATION
F4B4- A5 D1    1200 LRUD2  LDA HGR.DX+1      C=1 MEANS ROTATE
F4B6- 29 04    1210        AND #4       IF BIT2=0 THEN DO NOT PLOT
F4B8- F0 0E    1220        BEQ LRUD4    DO NOT PLOT
F4BA- B1 26    1230        LDA (MON.GBASL),Y
F4BC- 45 1C    1240        EOR HGR.BITS      1'S WHERE ANY BITS NOT IN COLOR
F4BE- 25 30    1250        AND MON.HMASK    LOOK AT JUST THIS BIT POSITION
F4C0- D0 02    1260        BNE LRUD3        THE BIT WAS ZERO, SO PLOT IT
F4C2- E6 EA    1270        INC HGR.COLLISIONS  BIT IS ALREADY 1; COUNT COLLSN
               1280 *--------------------------------
               1290 *      TOGGLE BIT ON SCREEN WITH (A)
               1300 *--------------------------------
F4C4- 51 26    1310 LRUD3  EOR (MON.GBASL),Y
F4C6- 91 26    1320        STA (MON.GBASL),Y
               1330 *--------------------------------
               1340 *      DETERMINE WHERE NEXT POINT WILL BE, AND MOVE THERE
               1350 *      C=0 IF NO 90 DEGREE ROTATION
               1360 *      C=1 ROTATES 90 DEGREES
               1370 *--------------------------------
F4C8- A5 D1    1380 LRUD4  LDA HGR.DX+1      CALCULATE THE DIRECTION TO MOVE
F4CA- 65 D3    1390        ADC HGR.QUADRANT
F4CC- 29 03    1400        AND #3       WRAP AROUND THE CIRCLE
F4CD-          1410 CON.03 .EQ *-1  (( A CONSTANT ))
               1420 *
               1430 *                   00 -- UP
               1440 *                   01 -- DOWN
               1450 *                   10 -- RIGHT
               1460 *                   11 -- LEFT
               1470 *
F4CE- C9 02    1480        CMP #2       C=0 IF 0 OR 1, C=1 IF 2 OR 3
F4D0- 6A       1490        ROR          PUT C INTO SIGN, ODD/EVEN INTO C
F4D1- B0 92    1500        BCS MOVE.LEFT.OR.RIGHT
               1510 *--------------------------------
               1520 MOVE.UP.OR.DOWN
F4D3- 30 30    1530        BMI MOVE.DOWN     SIGN FOR UP/DOWN SELECT.
               1540 *--------------------------------
               1550 *      MOVE UP ONE PIXEL
               1560 *      IF ALREADY AT TOP, GO TO BOTTOM
               1570 *
               1580 *      REMEMBER:  Y-COORD   GBASH     GBASL
               1590 *                ABCDEFGH  PPPFGHCD  EABAB000
               1600 *--------------------------------
F4D5- 18       1610        CLC          MOVE UP
F4D6- A5 27    1620        LDA MON.GBASH    CALC. BASE ADDRESS OF PREV. LINE
F4D8- 2C B9 F5 1630        BIT CON.1C       LOOK AT BITS 000FGH00 IN GBASH
F4DB- D0 22    1640        BNE .5           SIMPLE, JUST FGH=FGH-1
               1650 *                   GBASH=PPP000CD, GBASL=EABAB000
F4DD- 06 26    1660        ASL MON.GBASL   WHAT IS "E"?
F4DF- B0 1A    1670        BCS .3          E=1, THEN EFGH=EFGH-1
F4E1- 2C CD F4 1680        BIT CON.03   LOOK AT 000000CD IN GBASH
F4E4- F0 05    1690        BEQ .1       Y-POS IS AB000000 FORM
F4E6- 69 1F    1700        ADC #$1F     CD <> 0, SO CDEFGH=CDEFGH-1
F4E8- 38       1710        SEC
F4E9- B0 12    1720        BCS .4       ...ALWAYS
F4EB- 69 23    1730 .1     ADC #$23     ENOUGH TO MAKE GBASH=PPP11111 LATER
F4ED- 48       1740        PHA          SAVE FOR LATER
F4EE- A5 26    1750        LDA MON.GBASL  GBASL IS NOW ABAB0000 (AB=00,01,10)
F4F0- 69 B0    1760        ADC #$B0         0000+1011=1011 AND CARRY CLEAR
               1770 *                    OR 0101+1011=0000 AND CARRY SET
               1780 *                    OR 1010+1011=0101 AND CARRY SET
F4F2- B0 02    1790        BCS .2       NO WRAP-AROUND NEEDED
F4F4- 69 F0    1800        ADC #$F0     CHANGE 1011 TO 1010 (WRAP-AROUND)
F4F6- 85 26    1810 .2     STA MON.GBASL   FORM IS NOW STILL ABAB0000
F4F8- 68       1820        PLA          PARTIALLY MODIFIED GBASH
F4F9- B0 02    1830        BCS .4       ...ALWAYS
F4FB- 69 1F    1840 .3     ADC #$1F
F4FD- 66 26    1850 .4     ROR MON.GBASL    SHIFT IN E, TO GET EABAB000 FORM
F4FF- 69 FC    1860 .5     ADC #$FC     FINISH GBASH MODS
F501- 85 27    1870 UD.1   STA MON.GBASH
F503- 60       1880        RTS
               1890 *--------------------------------
F504- 18       1900        CLC          <<<NEVER USED>>>
               1910 *--------------------------------
               1920 *      MOVE DOWN ONE PIXEL
               1930 *      IF ALREADY AT BOTTOM, GO TO TOP
               1940 *
               1950 *      REMEMBER:  Y-COORD   GBASH     GBASL
               1960 *                ABCDEFGH  PPPFGHCD  EABAB000
               1970 *--------------------------------
               1980 MOVE.DOWN
F505- A5 27    1990        LDA MON.GBASH     TRY IT FIRST, BY FGH=FGH+1
F507- 69 04    2000        ADC #4            GBASH = PPPFGHCD
F508-          2010 CON.04 .EQ *-1   (( CONSTANT ))
F509- 2C B9 F5 2020        BIT CON.1C        IS FGH FIELD NOW ZERO?
F50C- D0 F3    2030        BNE UD.1          NO, SO WE ARE FINISHED
               2040 *                        YES, RIPPLE THE CARRY AS HIGH
               2050 *                        AS NECESSARY
F50E- 06 26    2060        ASL MON.GBASL     LOOK AT "E" BIT
F510- 90 18    2070        BCC .2            NOW ZERO; MAKE IT 1 AND LEAVE
F512- 69 E0    2080        ADC #$E0     CARRY = 1, SO ADDS $E1
F514- 18       2090        CLC          IS "CD" NOT ZERO?
F515- 2C 08 F5 2100        BIT CON.04   TESTS BIT 2 FOR CARRY OUT OF "CD"
F518- F0 12    2110        BEQ .3       NO CARRY, FINISHED
               2120 *                   INCREMENT "AB" THEN
               2130 *                   0000 --> 0101
               2140 *                   0101 --> 1010
               2150 *                   1010 --> WRAP AROUND TO LINE 0
F51A- A5 26    2160        LDA MON.GBASL     0000  0101  1010
F51C- 69 50    2170        ADC #$50          0101  1010  1111
F51E- 49 F0    2180        EOR #$F0          1010  0101  0000
F520- F0 02    2190        BEQ .1
F522- 49 F0    2200        EOR #$F0          0101  1010
F524- 85 26    2210 .1     STA MON.GBASL     NEW ABAB0000
F526- A5 E6    2220        LDA HGR.PAGE     WRAP AROUND TO LINE ZERO OF GROUP
F528- 90 02    2230        BCC .3            ...ALWAYS
F52A- 69 E0    2240 .2     ADC #$E0
F52C- 66 26    2250 .3     ROR MON.GBASL
F52E- 90 D1    2260        BCC UD.1     ...ALWAYS
               2270 *--------------------------------
               2280 *      HLINRL IS NEVER CALLED BY APPLESOFT
               2290 *
               2300 *      ENTER WITH:  (A,X) = DX FROM CURRENT POINT
               2310 *                   (Y)   = DY FROM CURRENT POINT
               2320 *--------------------------------
F530- 48       2330 HLINRL PHA          SAVE (A)
F531- A9 00    2340        LDA #0       CLEAR CURRENT POINT SO HGLIN WILL
F533- 85 E0    2350        STA HGR.X      ACT RELATIVELY
F535- 85 E1    2360        STA HGR.X+1
F537- 85 E2    2370        STA HGR.Y
F539- 68       2380        PLA          RESTORE (A)
               2390 *--------------------------------
               2400 *      DRAW LINE FROM LAST PLOTTED POINT TO (A,X),(Y)
               2410 *
               2420 *      ENTER WITH:  (A,X) = X OF TARGET POINT
               2430 *                   (Y)   = Y OF TARGET POINT
               2440 *--------------------------------
F53A- 48       2450 HGLIN  PHA          COMPUTE DX = X- X0
F53B- 38       2460        SEC
F53C- E5 E0    2470        SBC HGR.X
F53E- 48       2480        PHA
F53F- 8A       2490        TXA
F540- E5 E1    2500        SBC HGR.X+1
F542- 85 D3    2510        STA HGR.QUADRANT SAVE DX SIGN (+ = RIGHT, - = LEFT)
F544- B0 0A    2520        BCS .1       NOW FIND ABS (DX)
F546- 68       2530        PLA          FORMS 2'S COMPLEMENT
F547- 49 FF    2540        EOR #$FF
F549- 69 01    2550        ADC #1
F54B- 48       2560        PHA
F54C- A9 00    2570        LDA #0
F54E- E5 D3    2580        SBC HGR.QUADRANT
F550- 85 D1    2590 .1     STA HGR.DX+1
F552- 85 D5    2600        STA HGR.E+1       INIT HGR.E TO ABS(X-X0)
F554- 68       2610        PLA
F555- 85 D0    2620        STA HGR.DX
F557- 85 D4    2630        STA HGR.E
F559- 68       2640        PLA
F55A- 85 E0    2650        STA HGR.X      TARGET X POINT
F55C- 86 E1    2660        STX HGR.X+1
F55E- 98       2670        TYA          TARGET Y POINT
F55F- 18       2680        CLC          COMPUTE DY = Y-HGR.Y
F560- E5 E2    2690        SBC HGR.Y       AND SAVE -ABS(Y-HGR.Y)-1 IN HGR.DY
F562- 90 04    2700        BCC .2       (SO + MEANS UP, - MEANS DOWN)
F564- 49 FF    2710        EOR #$FF     2'S COMPLEMENT OF DY
F566- 69 FE    2720        ADC #$FE
F568- 85 D2    2730 .2     STA HGR.DY
F56A- 84 E2    2740        STY HGR.Y       TARGET Y POINT
F56C- 66 D3    2750        ROR HGR.QUADRANT    SHIFT Y-DIRECTION INTO QUADRANT
F56E- 38       2760        SEC          COUNT = DX -(-DY) = # OF DOTS NEEDED
F56F- E5 D0    2770        SBC HGR.DX
F571- AA       2780        TAX          COUNTL IS IN X-REG
F572- A9 FF    2790        LDA #$FF
F574- E5 D1    2800        SBC HGR.DX+1
F576- 85 1D    2810        STA HGR.COUNT
F578- A4 E5    2820        LDY HGR.HORIZ     HORIZONTAL INDEX
F57A- B0 05    2830        BCS MOVEX2   ...ALWAYS
               2840 *--------------------------------
               2850 *      MOVE LEFT OR RIGHT ONE PIXEL
               2860 *      (A) BIT 6 HAS DIRECTION
               2870 *--------------------------------
F57C- 0A       2880 MOVEX  ASL          PUT BIT 6 INTO SIGN POSITION
F57D- 20 65 F4 2890        JSR MOVE.LEFT.OR.RIGHT
F580- 38       2900        SEC
               2910 *--------------------------------
               2920 *      DRAW LINE NOW
               2930 *--------------------------------
F581- A5 D4    2940 MOVEX2 LDA HGR.E       CARRY IS SET
F583- 65 D2    2950        ADC HGR.DY       E = E-DELTY
F585- 85 D4    2960        STA HGR.E       NOTE: DY IS (-DELTA Y)-1
F587- A5 D5    2970        LDA HGR.E+1       CARRY CLR IF HGR.E GOES NEGATIVE
F589- E9 00    2980        SBC #0
F58B- 85 D5    2990 .1     STA HGR.E+1
F58D- B1 26    3000        LDA (MON.GBASL),Y
F58F- 45 1C    3010        EOR HGR.BITS  PLOT A DOT
F591- 25 30    3020        AND MON.HMASK
F593- 51 26    3030        EOR (MON.GBASL),Y
F595- 91 26    3040        STA (MON.GBASL),Y
F597- E8       3050        INX          FINISHED ALL THE DOTS?
F598- D0 04    3060        BNE .2       NO
F59A- E6 1D    3070        INC HGR.COUNT   TEST REST OF COUNT
F59C- F0 62    3080        BEQ RTS.22   YES, FINISHED.
F59E- A5 D3    3090 .2     LDA HGR.QUADRANT    TEST DIRECTION
F5A0- B0 DA    3100        BCS MOVEX    NEXT MOVE IS IN THE X DIRECTION
F5A2- 20 D3 F4 3110        JSR MOVE.UP.OR.DOWN    IF CLR, NEG, MOVE
F5A5- 18       3120        CLC          E = E+DX
F5A6- A5 D4    3130        LDA HGR.E
F5A8- 65 D0    3140        ADC HGR.DX
F5AA- 85 D4    3150        STA HGR.E
F5AC- A5 D5    3160        LDA HGR.E+1
F5AE- 65 D1    3170        ADC HGR.DX+1
F5B0- 50 D9    3180        BVC .1       ...ALWAYS
               3190 *--------------------------------
F5B2- 81 82 84
F5B5- 88 90 A0
F5B8- C0       3200 MSKTBL .HS 8182848890A0C0
               3210 *--------------------------------
F5B9- 1C       3220 CON.1C .HS 1C       MASK FOR "FGH" BITS
               3230 *--------------------------------





               SAVE S.F5BA
               1010 *--------------------------------
               1020 *      TABLE OF COS(90*X/16 DEGREES)*$100 - 1
               1030 *      WITH ONE BYTE PRECISION, X=0 TO 16:
               1040 *--------------------------------
               1050 COSINE.TABLE
F5BA- FF FE FA
F5BD- F4 EC E1
F5C0- D4 C5    1060        .HS FFFEFAF4ECE1D4C5
F5C2- B4 A1 8D
F5C5- 78 61 49
F5C8- 31 18    1070        .HS B4A18D7861493118
F5CA- FF       1080        .HS FF
               1090 *--------------------------------
               1100 *    HFIND -- CALCULATES CURRENT POSITION OF HI-RES CURSOR
               1110 *      (NOT CALLED BY ANY APPLESOFT ROUTINE)
               1120 *
               1130 *      CALCULATE Y-COORD FROM GBASL,H
               1140 *            AND X-COORD FROM HORIZ AND HMASK
               1150 *--------------------------------
F5CB- A5 26    1160 HFIND  LDA MON.GBASL     GBASL = EABAB000
F5CD- 0A       1170        ASL               E INTO CARRY
F5CE- A5 27    1180        LDA MON.GBASH     GBASH = PPPFGHCD
F5D0- 29 03    1190        AND #3            000000CD
F5D2- 2A       1200        ROL               00000CDE
F5D3- 05 26    1210        ORA MON.GBASL     EABABCDE
F5D5- 0A       1220        ASL               ABABCDE0
F5D6- 0A       1230        ASL               BABCDE00
F5D7- 0A       1240        ASL               ABCDE000
F5D8- 85 E2    1250        STA HGR.Y         ALL BUT FGH
F5DA- A5 27    1260        LDA MON.GBASH     PPPFGHCD
F5DC- 4A       1270        LSR               0PPPFGHC
F5DD- 4A       1280        LSR               00PPPFGH
F5DE- 29 07    1290        AND #7            00000FGH
F5E0- 05 E2    1300        ORA HGR.Y         ABCDEFGH
F5E2- 85 E2    1310        STA HGR.Y    THAT TAKES CARE OF Y-COORDINATE!
F5E4- A5 E5    1320        LDA HGR.HORIZ     X = 7*HORIZ + BIT POS. IN HMASK
F5E6- 0A       1330        ASL               MULTIPLY BY 7
F5E7- 65 E5    1340        ADC HGR.HORIZ     3* SO FAR
F5E9- 0A       1350        ASL               6*
F5EA- AA       1360        TAX               SINCE 7* MIGHT NOT FIT IN 1 BYTE,
               1370 *                        WAIT TILL LATER FOR LAST ADD
F5EB- CA       1380        DEX
F5EC- A5 30    1390        LDA MON.HMASK     NOW FIND BIT POSITION IN HMASK
F5EE- 29 7F    1400        AND #$7F          ONLY LOOK AT LOW SEVEN
F5F0- E8       1410 .1     INX               COUNT A SHIFT
F5F1- 4A       1420        LSR
F5F2- D0 FC    1430        BNE .1            STILL IN THERE
F5F4- 85 E1    1440        STA HGR.X+1       ZERO TO HI-BYTE
F5F6- 8A       1450        TXA               6*HORIZ+LOG2(HMASK)
F5F7- 18       1460        CLC               ADD HORIZ ONE MORE TIME
F5F8- 65 E5    1470        ADC HGR.HORIZ     7*HORIZ+LOG2(HMASK)
F5FA- 90 02    1480        BCC .2            UPPER BYTE = 0
F5FC- E6 E1    1490        INC HGR.X+1       UPPER BYTE = 1
F5FE- 85 E0    1500 .2     STA HGR.X         STORE LOWER BYTE
F600- 60       1510 RTS.22 RTS
               1520 *--------------------------------
               1530 *      DRAW A SHAPE
               1540 *
               1550 *      (Y,X) = SHAPE STARTING ADDRESS
               1560 *      (A)   = ROTATION (0-3F)
               1570 *--------------------------------
               1580 *      APPLESOFT DOES NOT CALL DRAW0
               1590 *--------------------------------
F601- 86 1A    1600 DRAW0  STX HGR.SHAPE   SAVE SHAPE ADDRESS
F603- 84 1B    1610        STY HGR.SHAPE+1
               1620 *--------------------------------
               1630 *      APPLESOFT ENTERS HERE
               1640 *--------------------------------
F605- AA       1650 DRAW1  TAX          SAVE ROTATION (0-$3F)
F606- 4A       1660        LSR          DIVIDE ROTATION BY 16 TO GET
F607- 4A       1670        LSR          QUADRANT (0=UP, 1=RT, 2=DWN, 3=LFT)
F608- 4A       1680        LSR
F609- 4A       1690        LSR
F60A- 85 D3    1700        STA HGR.QUADRANT
F60C- 8A       1710        TXA          USE LOW 4 BITS OF ROTATION TO INDEX
F60D- 29 0F    1720        AND #$0F     THE TRIG TABLE
F60F- AA       1730        TAX
F610- BC BA F5 1740        LDY COSINE.TABLE,X  SAVE COSINE IN HGR.DX
F613- 84 D0    1750        STY HGR.DX
F615- 49 0F    1760        EOR #$F             AND SINE IN DY
F617- AA       1770        TAX
F618- BC BB F5 1780        LDY COSINE.TABLE+1,X
F61B- C8       1790        INY
F61C- 84 D2    1800        STY HGR.DY
F61E- A4 E5    1810        LDY HGR.HORIZ   INDEX FROM GBASL,H TO BYTE WE'RE IN
F620- A2 00    1820        LDX #0
F622- 86 EA    1830        STX HGR.COLLISIONS      CLEAR COLLISION COUNTER
F624- A1 1A    1840        LDA (HGR.SHAPE,X)    GET FIRST BYTE OF SHAPE DEFN
F626- 85 D1    1850 .1     STA HGR.DX+1      KEEP SHAPE BYTE IN HGR.DX+1
F628- A2 80    1860        LDX #$80     INITIAL VALUES FOR FRACTIONAL VECTORS
F62A- 86 D4    1870        STX HGR.E       .5 IN COSINE COMPONENT
F62C- 86 D5    1880        STX HGR.E+1       .5 IN SINE COMPONENT
F62E- A6 E7    1890        LDX HGR.SCALE   SCALE FACTOR
F630- A5 D4    1900 .2     LDA HGR.E       ADD COSINE VALUE TO X-VALUE
F632- 38       1910        SEC          IF >= 1, THEN DRAW
F633- 65 D0    1920        ADC HGR.DX
F635- 85 D4    1930        STA HGR.E       ONLY SAVE FRACTIONAL PART
F637- 90 04    1940        BCC .3       NO INTEGRAL PART
F639- 20 B3 F4 1950        JSR LRUD1    TIME TO PLOT COSINE COMPONENT
F63C- 18       1960        CLC
F63D- A5 D5    1970 .3     LDA HGR.E+1       ADD SINE VALUE TO Y-VALUE
F63F- 65 D2    1980        ADC HGR.DY       IF >= 1, THEN DRAW
F641- 85 D5    1990        STA HGR.E+1       ONLY SAVE FRACTIONAL PART
F643- 90 03    2000        BCC .4       NO INTEGRAL PART
F645- 20 B4 F4 2010        JSR LRUD2    TIME TO PLOT SINE COMPONENT
F648- CA       2020 .4     DEX          LOOP ON SCALE FACTOR.
F649- D0 E5    2030        BNE .2       STILL ON SAME SHAPE ITEM
F64B- A5 D1    2040        LDA HGR.DX+1      GET NEXT SHAPE ITEM
F64D- 4A       2050        LSR          NEXT 3 BIT VECTOR
F64E- 4A       2060        LSR
F64F- 4A       2070        LSR
F650- D0 D4    2080        BNE .1       MORE IN THIS SHAPE BYTE
F652- E6 1A    2090        INC HGR.SHAPE   GO TO NEXT SHAPE BYTE
F654- D0 02    2100        BNE .5
F656- E6 1B    2110        INC HGR.SHAPE+1
F658- A1 1A    2120 .5     LDA (HGR.SHAPE,X)  NEXT BYTE OF SHAPE DEFINITION
F65A- D0 CA    2130        BNE .1          PROCESS IF NOT ZERO
F65C- 60       2140        RTS             FINISHED
               2150 *--------------------------------
               2160 *      XDRAW A SHAPE (SAME AS DRAW, EXCEPT TOGGLES SCREEN)
               2170 *
               2180 *      (Y,X) = SHAPE STARTING ADDRESS
               2190 *      (A)   = ROTATION (0-3F)
               2200 *--------------------------------
               2210 *      APPLESOFT DOES NOT CALL XDRAW0
               2220 *--------------------------------
F65D- 86 1A    2230 XDRAW0 STX HGR.SHAPE   SAVE SHAPE ADDRESS
F65F- 84 1B    2240        STY HGR.SHAPE+1
               2250 *--------------------------------
               2260 *      APPLESOFT ENTERS HERE
               2270 *--------------------------------
F661- AA       2280 XDRAW1 TAX          SAVE ROTATION (0-$3F)
F662- 4A       2290        LSR          DIVIDE ROTATION BY 16 TO GET
F663- 4A       2300        LSR          QUADRANT (0=UP, 1=RT, 2=DWN, 3=LFT)
F664- 4A       2310        LSR
F665- 4A       2320        LSR
F666- 85 D3    2330        STA HGR.QUADRANT
F668- 8A       2340        TXA          USE LOW 4 BITS OF ROTATION TO INDEX
F669- 29 0F    2350        AND #$0F     THE TRIG TABLE
F66B- AA       2360        TAX
F66C- BC BA F5 2370        LDY COSINE.TABLE,X  SAVE COSINE IN HGR.DX
F66F- 84 D0    2380        STY HGR.DX
F671- 49 0F    2390        EOR #$F             AND SINE IN DY
F673- AA       2400        TAX
F674- BC BB F5 2410        LDY COSINE.TABLE+1,X
F677- C8       2420        INY
F678- 84 D2    2430        STY HGR.DY
F67A- A4 E5    2440        LDY HGR.HORIZ   INDEX FROM GBASL,H TO BYTE WE'RE IN
F67C- A2 00    2450        LDX #0
F67E- 86 EA    2460        STX HGR.COLLISIONS      CLEAR COLLISION COUNTER
F680- A1 1A    2470        LDA (HGR.SHAPE,X)    GET FIRST BYTE OF SHAPE DEFN
F682- 85 D1    2480 .1     STA HGR.DX+1      KEEP SHAPE BYTE IN HGR.DX+1
F684- A2 80    2490        LDX #$80     INITIAL VALUES FOR FRACTIONAL VECTORS
F686- 86 D4    2500        STX HGR.E       .5 IN COSINE COMPONENT
F688- 86 D5    2510        STX HGR.E+1       .5 IN SINE COMPONENT
F68A- A6 E7    2520        LDX HGR.SCALE   SCALE FACTOR
F68C- A5 D4    2530 .2     LDA HGR.E       ADD COSINE VALUE TO X-VALUE
F68E- 38       2540        SEC          IF >= 1, THEN DRAW
F68F- 65 D0    2550        ADC HGR.DX
F691- 85 D4    2560        STA HGR.E       ONLY SAVE FRACTIONAL PART
F693- 90 04    2570        BCC .3       NO INTEGRAL PART
F695- 20 9C F4 2580        JSR LRUDX1   TIME TO PLOT COSINE COMPONENT
F698- 18       2590        CLC
F699- A5 D5    2600 .3     LDA HGR.E+1       ADD SINE VALUE TO Y-VALUE
F69B- 65 D2    2610        ADC HGR.DY       IF >= 1, THEN DRAW
F69D- 85 D5    2620        STA HGR.E+1       ONLY SAVE FRACTIONAL PART
F69F- 90 03    2630        BCC .4       NO INTEGRAL PART
F6A1- 20 9D F4 2640        JSR LRUDX2   TIME TO PLOT SINE COMPONENT
F6A4- CA       2650 .4     DEX          LOOP ON SCALE FACTOR.
F6A5- D0 E5    2660        BNE .2       STILL ON SAME SHAPE ITEM
F6A7- A5 D1    2670        LDA HGR.DX+1      GET NEXT SHAPE ITEM
F6A9- 4A       2680        LSR          NEXT 3 BIT VECTOR
F6AA- 4A       2690        LSR
F6AB- 4A       2700        LSR
F6AC- D0 D4    2710        BNE .1       MORE IN THIS SHAPE BYTE
F6AE- E6 1A    2720        INC HGR.SHAPE   GO TO NEXT SHAPE BYTE
F6B0- D0 02    2730        BNE .5
F6B2- E6 1B    2740        INC HGR.SHAPE+1
F6B4- A1 1A    2750 .5     LDA (HGR.SHAPE,X)  NEXT BYTE OF SHAPE DEFINITION
F6B6- D0 CA    2760        BNE .1          PROCESS IF NOT ZERO
F6B8- 60       2770        RTS             FINISHED
               2780 *--------------------------------
               2790 *      GET HI-RES PLOTTING COORDINATES (0-279,0-191) FROM
               2800 *      TXTPTR.  LEAVE REGISTERS SET UP FOR HPOSN:
               2810 *          (Y,X)=X-COORD
               2820 *          (A)  =Y-COORD
               2830 *--------------------------------
F6B9- 20 67 DD 2840 HFNS   JSR FRMNUM   EVALUATE EXPRESSION, MUST BE NUMERIC
F6BC- 20 52 E7 2850        JSR GETADR   CONVERT TO 2-BYTE INTEGER IN LINNUM
F6BF- A4 51    2860        LDY LINNUM+1  GET HORIZ COOR IN X,Y
F6C1- A6 50    2870        LDX LINNUM
F6C3- C0 01    2880        CPY /280     MAKE SURE IT IS < 280
F6C5- 90 06    2890        BCC .1       IN RANGE
F6C7- D0 1D    2900        BNE GGERR
F6C9- E0 18    2910        CPX #280
F6CB- B0 19    2920        BCS GGERR
F6CD- 8A       2930 .1     TXA          SAVE HORIZ COOR ON STACK
F6CE- 48       2940        PHA
F6CF- 98       2950        TYA
F6D0- 48       2960        PHA
F6D1- A9 2C    2970        LDA #','     REQUIRE A COMMA
F6D3- 20 C0 DE 2980        JSR SYNCHR
F6D6- 20 F8 E6 2990        JSR GETBYT   EVAL EXP TO SINGLE BYTE IN X-REG
F6D9- E0 C0    3000        CPX #192     CHECK FOR RANGE
F6DB- B0 09    3010        BCS GGERR    TOO BIG
F6DD- 86 9D    3020        STX FAC      SAVE Y-COORD
F6DF- 68       3030        PLA          RETRIEVE HORIZONTAL COORDINATE
F6E0- A8       3040        TAY
F6E1- 68       3050        PLA
F6E2- AA       3060        TAX
F6E3- A5 9D    3070        LDA FAC      AND VERTICAL COORDINATE
F6E5- 60       3080        RTS
               3090 *--------------------------------
F6E6- 4C 06 F2 3100 GGERR  JMP GOERR    ILLEGAL QUANTITY ERROR
               3110 *--------------------------------
               3120 *      "HCOLOR=" STATEMENT
               3130 *--------------------------------
F6E9- 20 F8 E6 3140 HCOLOR JSR GETBYT   EVAL EXP TO SINGLE BYTE IN X
F6EC- E0 08    3150        CPX #8       VALUE MUST BE 0-7
F6EE- B0 F6    3160        BCS GGERR    TOO BIG
F6F0- BD F6 F6 3170        LDA COLORTBL,X    GET COLOR PATTERN
F6F3- 85 E4    3180        STA HGR.COLOR
F6F5- 60       3190 RTS.23 RTS
               3200 *--------------------------------
F6F6- 00 2A 55
F6F9- 7F 80 AA
F6FC- D5 FF    3210 COLORTBL .HS 002A557F80AAD5FF
               3220 *--------------------------------
               3230 *      "HPLOT" STATEMENT
               3240 *
               3250 *      HPLOT X,Y
               3260 *      HPLOT TO X,Y
               3270 *      HPLOT X1,Y1 TO X2,Y2
               3280 *--------------------------------
F6FE- C9 C1    3290 HPLOT  CMP #TOKEN.TO     "PLOT TO" FORM?
F700- F0 0D    3300        BEQ .2            YES, START FROM CURRENT LOCATION
F702- 20 B9 F6 3310        JSR HFNS          NO, GET STARTING POINT OF LINE
F705- 20 57 F4 3320        JSR HPLOT0   PLOT THE POINT, AND SET UP FOR
               3330 *                   DRAWING A LINE FROM THAT POINT
F708- 20 B7 00 3340 .1     JSR CHRGOT   CHARACTER AT END OF EXPRESSION
F70B- C9 C1    3350        CMP #TOKEN.TO     IS A LINE SPECIFIED?
F70D- D0 E6    3360        BNE RTS.23        NO, EXIT
F70F- 20 C0 DE 3370 .2     JSR SYNCHR        YES. ADV. TXTPTR (WHY NOT CHRGET)
F712- 20 B9 F6 3380        JSR HFNS     GET COORDINATES OF LINE END
F715- 84 9D    3390        STY DSCTMP   SET UP FOR LINE
F717- A8       3400        TAY
F718- 8A       3410        TXA
F719- A6 9D    3420        LDX DSCTMP
F71B- 20 3A F5 3430        JSR HGLIN    PLOT LINE
F71E- 4C 08 F7 3440        JMP .1       LOOP TILL NO MORE "TO" PHRASES
               3450 *--------------------------------
               3460 *      "ROT=" STATEMENT
               3470 *--------------------------------
F721- 20 F8 E6 3480 ROT    JSR GETBYT   EVAL EXP TO A BYTE IN X-REG
F724- 86 F9    3490        STX HGR.ROTATION
F726- 60       3500        RTS
               3510 *--------------------------------
               3520 *      "SCALE=" STATEMENT
               3530 *--------------------------------
F727- 20 F8 E6 3540 SCALE  JSR GETBYT   EVAL EXP TO A BYTE IN X-REG
F72A- 86 E7    3550        STX HGR.SCALE
F72C- 60       3560        RTS
               3570 *--------------------------------
               3580 *      SET UP FOR DRAW AND XDRAW
               3590 *--------------------------------
F72D- 20 F8 E6 3600 DRWPNT JSR GETBYT   GET SHAPE NUMBER IN X-REG
F730- A5 E8    3610        LDA HGR.SHAPE.PNTR SEARCH FOR THAT SHAPE
F732- 85 1A    3620        STA HGR.SHAPE   SET UP PNTR TO BEGINNING OF TABLE
F734- A5 E9    3630        LDA HGR.SHAPE.PNTR+1
F736- 85 1B    3640        STA HGR.SHAPE+1
F738- 8A       3650        TXA
F739- A2 00    3660        LDX #0
F73B- C1 1A    3670        CMP (HGR.SHAPE,X)  COMPARE TO # OF SHAPES IN TABLE
F73D- F0 02    3680        BEQ .1       LAST SHAPE IN TABLE
F73F- B0 A5    3690        BCS GGERR    SHAPE # TOO LARGE
F741- 0A       3700 .1     ASL          DOUBLE SHAPE# TO MAKE AN INDEX
F742- 90 03    3710        BCC .2          ADD 256 IF SHAPE # > 127
F744- E6 1B    3720        INC HGR.SHAPE+1
F746- 18       3730        CLC
F747- A8       3740 .2     TAY          USE INDEX TO LOOK UP OFFSET FOR SHAPE
F748- B1 1A    3750        LDA (HGR.SHAPE),Y    IN OFFSET TABLE
F74A- 65 1A    3760        ADC HGR.SHAPE
F74C- AA       3770        TAX
F74D- C8       3780        INY
F74E- B1 1A    3790        LDA (HGR.SHAPE),Y
F750- 65 E9    3800        ADC HGR.SHAPE.PNTR+1
F752- 85 1B    3810        STA HGR.SHAPE+1   SAVE ADDRESS OF SHAPE
F754- 86 1A    3820        STX HGR.SHAPE
F756- 20 B7 00 3830        JSR CHRGOT   IS THERE ANY "AT" PHRASE?
F759- C9 C5    3840        CMP #TOKEN.AT
F75B- D0 09    3850        BNE .3       NO, DRAW RIGHT WHERE WE ARE
F75D- 20 C0 DE 3860        JSR SYNCHR   SCAN OVER "AT"
F760- 20 B9 F6 3870        JSR HFNS     GET X- AND Y-COORDS TO START DRAWING AT
F763- 20 11 F4 3880        JSR HPOSN    SET UP CURSOR THERE
F766- A5 F9    3890 .3     LDA HGR.ROTATION     ROTATION VALUE
F768- 60       3900        RTS
               3910 *--------------------------------
               3920 *      "DRAW" STATEMENT
               3930 *--------------------------------
F769- 20 2D F7 3940 DRAW   JSR DRWPNT
F76C- 4C 05 F6 3950        JMP DRAW1
               3960 *--------------------------------
               3970 *      "XDRAW" STATEMENT
               3980 *--------------------------------
F76F- 20 2D F7 3990 XDRAW  JSR DRWPNT
F772- 4C 61 F6 4000        JMP XDRAW1
               4010 *--------------------------------
               4020 *      "SHLOAD" STATEMENT
               4030 *
               4040 *      READS A SHAPE TABLE FROM CASSETTE TAPE
               4050 *      TO A POSITION JUST BELOW HIMEM.
               4060 *      HIMEM IS THEN MOVED TO JUST BELOW THE TABLE
               4070 *--------------------------------
F775- A9 00    4080 SHLOAD LDA /LINNUM  SET UP TO READ TWO BYTES
F777- 85 3D    4090        STA MON.A1H  INTO LINNUM,LINNUM+1
F779- 85 3F    4100        STA MON.A2H
F77B- A0 50    4110        LDY #LINNUM
F77D- 84 3C    4120        STY MON.A1L
F77F- C8       4130        INY          LINNUM+1
F780- 84 3E    4140        STY MON.A2L
F782- 20 FD FE 4150        JSR MON.READ READ TAPE
F785- 18       4160        CLC          SETUP TO READ (LINNUM) BYTES
F786- A5 73    4170        LDA MEMSIZ   ENDING AT HIMEM-1
F788- AA       4180        TAX
F789- CA       4190        DEX          FORMING HIMEM-1
F78A- 86 3E    4200        STX MON.A2L
F78C- E5 50    4210        SBC LINNUM   FORMING HIMEM-(LINNUM)
F78E- 48       4220        PHA
F78F- A5 74    4230        LDA MEMSIZ+1
F791- A8       4240        TAY
F792- E8       4250        INX          SEE IF HIMEM LOW-BYTE WAS ZERO
F793- D0 01    4260        BNE .1       NO
F795- 88       4270        DEY          YES, HAVE TO DECREMENT HIGH BYTE
F796- 84 3F    4280 .1     STY MON.A2H
F798- E5 51    4290        SBC LINNUM+1
F79A- C5 6E    4300        CMP STREND+1 RUNNING INTO VARIABLES?
F79C- 90 02    4310        BCC .2       YES, OUT OF MEMORY
F79E- D0 03    4320        BNE .3       NO, STILL ROOM
F7A0- 4C 10 D4 4330 .2     JMP MEMERR   MEM FULL ERR
F7A3- 85 74    4340 .3     STA MEMSIZ+1
F7A5- 85 70    4350        STA FRETOP+1 CLEAR STRING SPACE
F7A7- 85 3D    4360        STA MON.A1H  (BUT NAMES ARE STILL IN VARTBL!)
F7A9- 85 E9    4370        STA HGR.SHAPE.PNTR+1
F7AB- 68       4380        PLA
F7AC- 85 E8    4390        STA HGR.SHAPE.PNTR
F7AE- 85 73    4400        STA MEMSIZ
F7B0- 85 6F    4410        STA FRETOP
F7B2- 85 3C    4420        STA MON.A1L
F7B4- 20 FA FC 4430        JSR MON.RD2BIT   READ TO TAPE TRANSITIONS
F7B7- A9 03    4440        LDA #3       SHORT DELAY FOR INTERMEDIATE HEADER
F7B9- 4C 02 FF 4450        JMP MON.READ2    READ SHAPES
               4460 *--------------------------------
               4470 *      CALLED FROM STORE AND RECALL
               4480 *--------------------------------
               4490 TAPEPNT
F7BC- 18       4500        CLC
F7BD- A5 9B    4510        LDA LOWTR
F7BF- 65 50    4520        ADC LINNUM
F7C1- 85 3E    4530        STA MON.A2L
F7C3- A5 9C    4540        LDA LOWTR+1
F7C5- 65 51    4550        ADC LINNUM+1
F7C7- 85 3F    4560        STA MON.A2H
F7C9- A0 04    4570        LDY #4
F7CB- B1 9B    4580        LDA (LOWTR),Y
F7CD- 20 EF E0 4590        JSR GETARY2
F7D0- A5 94    4600        LDA HIGHDS
F7D2- 85 3C    4610        STA MON.A1L
F7D4- A5 95    4620        LDA HIGHDS+1
F7D6- 85 3D    4630        STA MON.A1H
F7D8- 60       4640        RTS
               4650 *--------------------------------
               4660 *      CALLED FROM STORE AND RECALL
               4670 *--------------------------------
               4680 GETARYPT
F7D9- A9 40    4681        LDA #$40
F7DB- 85 14    4690        STA SUBFLG
F7DD- 20 E3 DF 4700        JSR PTRGET
F7E0- A9 00    4710        LDA #0
F7E2- 85 14    4720        STA SUBFLG
F7E4- 4C F0 D8 4730        JMP VARTIO
               4740 *--------------------------------
               4750 *      "HTAB" STATEMENT
               4760 *
               4770 *      NOTE THAT IF WNDLEFT IS NOT 0, HTAB CAN PRINT
               4780 *      OUTSIDE THE SCREEN (EG., IN THE PROGRAM)
               4790 *--------------------------------
F7E7- 20 F8 E6 4800 HTAB   JSR GETBYT
F7EA- CA       4810        DEX
F7EB- 8A       4820        TXA
F7EC- C9 28    4830 .1     CMP #40
F7EE- 90 0A    4840        BCC .2
F7F0- E9 28    4850        SBC #40
F7F2- 48       4860        PHA
F7F3- 20 FB DA 4870        JSR CRDO
F7F6- 68       4880        PLA
F7F7- 4C EC F7 4890        JMP .1
F7FA- 85 24    4900 .2     STA MON.CH
F7FC- 60       4910        RTS
               4920 *--------------------------------
F7FD- CB D2 D7 4930        .AS -/KRW/   SOMEONE'S INITIALS?


	 
SYMBOL TABLE
    EBAF- ABS
    EA0E- ADD.EXPONENTS
    EA10- ADD.EXPONENTS.1
          .01=EA1B  .02=EA26  .03=EA28
    ECD5- ADDACC
    D998- ADDON
          .01=D9A2
    03F5- AMPERSAND.VECTOR
    DF55- AND
      A5- ARG
      92- ARG.EXTENSION
      AA- ARG.SIGN
    E11E- ARRAY
          .01=E12C  .02=E169  .03=E16D  .04=E179  .05=E188
      94- ARYPNT
      6B- ARYTAB
    E6E5- ASC
    F09E- ATN
          .01=F0A6  .02=F0B4  .03=F0C7
    E10C- AYINT
    DFF4- BADNAM
    F3F6- BKGND
          .01=F3FE
    D393- BLTU
    D39A- BLTU2
          .01=D3B7  .02=D3C3  .03=D3C7  .04=D3CE
    E09A- C.ZERO
    F1D5- CALL
    E597- CAT
          .01=E5B7
      0D- CHARAC
    E552- CHECK.BUMP
    E55D- CHECK.EXIT
    E519- CHECK.SIMPLE.VARIABLE
    E523- CHECK.VARIABLE
          .01=E538  .02=E542
    DEB8- CHKCLS
    DEBE- CHKCOM
    D3D6- CHKMEM
    DD6A- CHKNUM
    DEBB- CHKOPN
    DD6C- CHKSTR
    DD6D- CHKVAL
          .01=DD73  .02=DD74  .03=DD76
      B1- CHRGET
      B7- CHRGOT
    E646- CHRSTR
    D66A- CLEAR
    D66C- CLEARC
    DFC1- CMPDONE
          .01=DFCA
    F128- COLD.START
          .01=F152  .02=F181  .03=F195  .04=F1B8
    D842- COLON.
    F24F- COLOR
    F47E- COLOR.SHIFT
          .01=F489
    F6F6- COLORTBL
    E74C- COMBYTE
    E89E- COMPLEMENT.FAC
    E8A4- COMPLEMENT.FAC.MANTISSA
    F4CD- CON.03
    F508- CON.04
          .01=F524  .02=F52A  .03=F52C
    F5B9- CON.1C
    ED0A- CON.99999999.9
    ED0F- CON.999999999
    ED14- CON.BILLION
    EE64- CON.HALF
    EEDB- CON.LOG.E
    E93C- CON.LOG.TWO
    E937- CON.NEG.HALF
    E913- CON.ONE
    F06B- CON.PI.DOUB
    F066- CON.PI.HALF
    EFA6- CON.RND.1
    EFAA- CON.RND.2
    E92D- CON.SQR.HALF
    E932- CON.SQR.TWO
    EA50- CON.TEN
    E6FB- CONINT
    D896- CONT
          .01=D8A1
    D863- CONTROL.C.TYPED
          .02=D86C
    EB53- COPY.ARG.TO.FAC
    EB63- COPY.FAC.TO.ARG.ROUNDED
    EAE6- COPY.RESULT.INTO.FAC
    EFEA- COS
    F5BA- COSINE.TABLE
      16- CPRMASK
      89- CPRTYP
    DAFB- CRDO
      75- CURLIN
      F6- CURLSV
    D995- DATA
      13- DATAFLG
    D9A3- DATAN
      7B- DATLIN
      7D- DATPTR
    EE69- DECTBL
    EE8D- DECTBL.END
    E313- DEF
    F331- DEL
          .01=F357  .02=F365  .03=F367  .04=F371  .05=F377  .06=F388
      60- DEST
    DFD9- DIM
      10- DIMFLG
    EA5E- DIV
    EA55- DIV10
    DB35- DOSPC
      9B- DPFLG
    F769- DRAW
    F601- DRAW0
    F605- DRAW1
          .01=F626  .02=F630  .03=F63D  .04=F648  .05=F658
    F72D- DRWPNT
          .01=F741  .02=F747  .03=F766
      8F- DSCLEN
      8C- DSCPTR
      9D- DSCTMP
    D870- END
    D871- END2
          .01=D888
    D88A- END4
          .01=D893
      0E- ENDCHR
      0F- EOL.PNTR
    DED0- EQUL
    DE98- EQUOP
          .01=DE9F
    DB7F- ERLIN
      6B- ERR.BADSUBS
      A3- ERR.BADTYPE
      D2- ERR.CANTCONT
    DCDF- ERR.EXTRA
      BF- ERR.FRMCPX
      95- ERR.ILLDIR
      35- ERR.ILLQTY
      4D- ERR.MEMFULL
      2A- ERR.NODATA
      00- ERR.NOFOR
      16- ERR.NOGOSUB
      45- ERR.OVERFLOW
      78- ERR.REDIMD
    DCEF- ERR.REENTRY
      B0- ERR.STRLONG
      10- ERR.SYNTAX
      E0- ERR.UNDEFFUNC
      5A- ERR.UNDEFSTAT
      85- ERR.ZERODIV
    E306- ERRDIR
      D8- ERRFLG
      DA- ERRLIN
      DE- ERRNUM
    D412- ERROR
          .01=D419  .02=D41F
    D260- ERROR.MESSAGES
      DC- ERRPOS
      DF- ERRSTK
    D828- EXECUTE.STATEMENT
    D82A- EXECUTE.STATEMENT.1
          .01=D83F
    DE5D- EXIT
    EF09- EXP
          .01=EF19  .02=EF24  .03=EF27  .04=EF37
      9A- EXPON
      9C- EXPSGN
      9D- FAC
      AC- FAC.EXTENSION
      A2- FAC.SIGN
    E7BE- FADD
    E7B9- FADD.1
    E7CE- FADD.2
          .01=E7EA  .02=E7EE
    E7FA- FADD.3
          .01=E806
    E855- FADD.4
    E7A0- FADDH
    E7C1- FADDT
          .01=E7C6
    E253- FAE.1
    E26F- FAE.2
    E270- FAE.3
          .01=E281  .02=E292  .03=E298
    DF5D- FALSE
    EBB2- FCOMP
    EBB4- FCOMP2
          .01=EBE9  .02=EBEF
    EA66- FDIV
    EA69- FDIVT
          .01=EA80  .02=EA96  .03=EAA3  .04=EAA6  .05=EAB4  .06=EAD1  .07=EAD5
          .08=EAE1
    EC4A- FIN
          .01=EC4E  .02=EC5D
    EC61- FIN.1
    EC98- FIN.10
    EC64- FIN.2
    EC66- FIN.3
          .01=EC85
    EC87- FIN.4
    EC8A- FIN.5
    EC8C- FIN.6
    EC9E- FIN.7
    ECA0- FIN.8
          .13=ECA9  .14=ECB2  .15=ECB9  .16=ECBE
    ECC1- FIN.9
          .01=ECC8
    E24B- FIND.ARRAY.ELEMENT
    E488- FIND.HIGHEST.STRING
          .01=E4A0  .02=E4A9  .03=E4B5  .04=E4BD  .05=E4C2  .06=E4CA  .07=E4CE
          .08=E4D9  .09=E50A  .10=E50C  .11=E514
    DCA0- FINDATA
          .01=DCB9
      F0- FIRST
    D4F2- FIX.LINKS
          .01=D4FE  .02=D50F  .03=D511
    D61E- FL1
          .01=D635  .02=D63E  .03=D647
    F280- FLASH
      F3- FLASH.BIT
    EB93- FLOAT
    EB9B- FLOAT.1
    EBA0- FLOAT.2
    E97F- FMULT
    E982- FMULTT
          .01=E987
    DEA4- FN.
    E341- FNC.
    E3AF- FNCDATA
      8A- FNCNAM
    D61A- FNDLIN
    D766- FOR
          .01=D777
      85- FORPNT
    ED34- FOUT
    ED36- FOUT.1
          .01=ED41  .02=ED4F  .03=ED57  .04=ED60  .05=ED62  .06=ED6D  .07=ED78
          .08=ED7F  .09=ED86  .10=ED89
    ED8C- FOUT.2
          .01=ED9E  .02=ED9F  .03=EDAA  .04=EDBB  .05=EDBD  .06=EDC1  .07=EDE5
          .08=EDE7  .09=EDEE  .10=EE09
    EE17- FOUT.3
          .01=EE19  .02=EE26  .03=EE36  .04=EE42
    EE57- FOUT.4
    EE5A- FOUT.5
    EE5F- FOUT.6
    EE97- FPWRT
          .01=EEA0  .02=EEBA
    E2DE- FRE
          .01=E2E5
    E600- FREFAC
      71- FRESPC
    E5FD- FRESTR
    E604- FRETMP
          .01=E62F  .02=E630
    E635- FRETMS
          .01=E645
      6F- FRETOP
    DE60- FRM.ELEMENT
          .01=DE64  .02=DE69  .03=DE6C
    DE3A- FRM.PERFORM.1
          .01=DE41
    DE43- FRM.PERFORM.2
    DDCD- FRM.PRECEDENCE.TEST
    DDFD- FRM.RECURSE
    DDE4- FRM.RELATIONAL
          .01=DDEE
    DE10- FRM.STACK.1
    DE15- FRM.STACK.2
    DE20- FRM.STACK.3
    DED5- FRM.VARIABLE
    DED7- FRM.VARIABLE.CALL
          .01=DEE5  .02=DEF6
    DD7B- FRMEVL
          .01=DD81
    DD86- FRMEVL.1
    DD95- FRMEVL.2
          .01=DD98  .02=DDB4  .03=DDC5
    DD67- FRMNUM
    E7A7- FSUB
    E7AA- FSUBT
    E354- FUNCT
          .01=E378  .02=E3A9
    E484- GARBAG
      13- GARFLG
    F10B- GENERIC.CHRGET
          .01=F111  .02=F122
    F128- GENERIC.END
    DD0D- GERR
    DBA0- GET
    E752- GETADR
    E0ED- GETARY
    E0EF- GETARY2
          .01=E0F9
    F7D9- GETARYPT
    E6F8- GETBYT
    D72C- GETCHR
          .01=D731
    ECE8- GETEXP
          .01=ECF7  .02=ED05
    E452- GETSPA
          .01=E454  .02=E45F  .03=E469  .04=E474
    E6DC- GETSTR
    F6E6- GGERR
    E948- GIQ
    E2F2- GIVAYF
    E26C- GME
    EFE7- GO.MOVMF
    ED31- GO.STROUT
    D935- GO.TO.LINE
    D826- GOEND
    F206- GOERR
    DE38- GOEX
    E6F2- GOIQ
      03- GOSTROUT
    D921- GOSUB
    D93E- GOTO
          .01=D955  .02=D959
      00- GOWARM
    F390- GR
    E269- GSE
    E6F5- GTBYTC
    D365- GTFORPNT
          .01=D36A  .02=D37F  .03=D38B  .04=D392
    E746- GTNUM
    F2E9- HANDLERR
    F3F2- HCLR
    F6E9- HCOLOR
    F5CB- HFIND
          .01=F5F0  .02=F5FE
    F6B9- HFNS
          .01=F6CD
    F53A- HGLIN
          .01=F550  .02=F568
    F3E2- HGR
      1C- HGR.BITS
      EA- HGR.COLLISIONS
      E4- HGR.COLOR
      1D- HGR.COUNT
      D0- HGR.DX
      D2- HGR.DY
      D4- HGR.E
      E5- HGR.HORIZ
      E6- HGR.PAGE
      D3- HGR.QUADRANT
      F9- HGR.ROTATION
      E7- HGR.SCALE
      1A- HGR.SHAPE
      E8- HGR.SHAPE.PNTR
      E0- HGR.X
      E2- HGR.Y
    F3D8- HGR2
      94- HIGHDS
      96- HIGHTR
    F286- HIMEM
    F232- HLIN
    F530- HLINRL
    F6FE- HPLOT
          .01=F708  .02=F70F
    F457- HPLOT0
    F411- HPOSN
          .01=F441  .02=F442
    F7E7- HTAB
          .01=F7EC  .02=F7FA
    D9C9- IF
          .01=D9D8
    D9E1- IF.TRUE
          .01=D9E9
    F1DE- IN.NUMBER
    D553- INCHR
    E8C6- INCREMENT.FAC.MANTISSA
    EB7A- INCREMENT.MANTISSA
      5E- INDEX
      99- INDX
    D52C- INLIN
    D52E- INLIN2
          .01=D539  .02=D541  .03=D54C
    DCC6- INPDONE
          .01=DCD1  .02=DCDE
    DB86- INPERR
    DC99- INPFIN
    ED19- INPRT
      7F- INPTR
    DBB2- INPUT
          .01=DBC4  .02=DBC7
    0200- INPUT.BUFFER
    DC69- INPUT.DATA
    DBE9- INPUT.FLAG.ZERO
    DC72- INPUT.MORE
          .01=DC7E
    DB71- INPUTERR
      15- INPUTFLG
    DC2B- INSTART
          .01=DC3F  .02=DC4B  .03=DC4C  .04=DC57  .05=DC63
    EC23- INT
    F277- INVERSE
    E199- IQERR
    D858- ISCNTC
          .01=D860
    E07D- ISLETC
          .01=E086
    E19B- JER
    E432- JERR
    DD78- JERROR
    F296- JMM
      90- JMPADRS
    EA36- JOV
    F32E- JSYN
    C000- KEYBOARD
    E8FD- L
          .01=E903
      87- LASTOP
      53- LASTPT
    E65A- LEFTSTR
    E6D6- LEN
      91- LENGTH
    DA46- LET
    DA7A- LET.STRING
    DA63- LET2
          .01=DA77
    F209- LINCOOR
          .01=F218
    DA0C- LINGET
          .01=DA12  .02=DA40
      50- LINNUM
    ED24- LINPRT
    D6A5- LIST
          .01=D6B1  .02=D6C4  .03=D6CC
    D6DA- LIST.0
          .05=D6F5  .06=D6F7
    D6FE- LIST.1
    D702- LIST.2
          .01=D712
    D724- LIST.3
    D734- LIST.4
          .01=D746  .02=D749  .03=D750  .04=D755  .05=D75F
    D8C9- LOAD
          .01=D8ED
    E9E3- LOAD.ARG.FROM.YA
    EAF9- LOAD.FAC.FROM.YA
      D6- LOCK
    E941- LOG
    E94B- LOG.2
    F2A6- LOMEM
      9B- LOWTR
    F46E- LR.1
    F471- LR.2
    F476- LR.3
    F478- LR.4
    F4B3- LRUD1
    F4B4- LRUD2
    F4C4- LRUD3
    F4C8- LRUD4
    F49C- LRUDX1
    F49D- LRUDX2
    D0CA- M.EQU
    D0C7- M.NEG
    D0CD- M.REL
    EB66- MAF
          .01=EB68
    E1B8- MAKE.NEW.ARRAY
          .01=E1C1  .02=E1D5  .03=E1DE  .04=E1E7  .05=E1F7  .06=E21A  .07=E229
          .08=E22E
    E09C- MAKE.NEW.VARIABLE
          .01=E0B2
    E102- MAKINT
    D0B2- MATHTBL
    D410- MEMERR
      73- MEMSIZ
    EB55- MFA
          .01=EB59
    E119- MI1
    E11B- MI2
    E691- MIDSTR
          .01=E6A2
    DECE- MIN
    E108- MKINT
      3D- MON.A1H
      3C- MON.A1L
      3F- MON.A2H
      3E- MON.A2L
      24- MON.CH
    FDED- MON.COUT
      27- MON.GBASH
      26- MON.GBASL
    FD6A- MON.GETLN
      2C- MON.H2
    F819- MON.HLINE
      30- MON.HMASK
    FC58- MON.HOME
    FE8B- MON.INPORT
      32- MON.INVFLG
    FE95- MON.OUTPORT
    F800- MON.PLOT
    FB1E- MON.PREAD
      33- MON.PROMPT
    FCFA- MON.RD2BIT
    FD0C- MON.RDKEY
    FEFD- MON.READ
    FF02- MON.READ2
    F871- MON.SCRN
    F864- MON.SETCOL
    FB40- MON.SETGR
    FB39- MON.SETTXT
    FB5B- MON.TABV
      2D- MON.V2
    F828- MON.VLINE
    FCA8- MON.WAIT
    FECD- MON.WRITE
    F505- MOVE.DOWN
    E562- MOVE.HIGHEST.STRING.TO.TOP
    F465- MOVE.LEFT.OR.RIGHT
    F48A- MOVE.RIGHT
    F4D3- MOVE.UP.OR.DOWN
          .01=F4EB  .02=F4F6  .03=F4FB  .04=F4FD  .05=F4FF
    F57C- MOVEX
    F581- MOVEX2
          .01=F58B  .02=F59E
    E5D4- MOVINS
    E5E2- MOVSTR
    E5E6- MOVSTR.1
          .01=E5EA  .02=E5F3  .03=E5FC
    F5B2- MSKTBL
    EA39- MUL10
          .01=EA4F
    E9B0- MULTIPLY.1
    E9B5- MULTIPLY.2
          .01=E9B8  .02=E9D4
    E2B6- MULTIPLY.SUBS.1
          .01=E2C0  .02=E2D9
    E2AD- MULTIPLY.SUBSCRIPT
    F279- N.I.
    F27B- N.I.F.
    E087- NAME.NOT.FOUND
    DFF7- NAMOK
    E0FE- NEG32768
    DB00- NEGATE
    EED0- NEGOP
    D649- NEW
    D7D2- NEWSTT
          .01=D7E5  .02=D805
    DCF9- NEXT
    DCFF- NEXT.1
    DD02- NEXT.2
    DD0F- NEXT.3
          .01=DD52  .02=DD55
    F273- NORMAL
    E829- NORMALIZE.FAC.1
    E82E- NORMALIZE.FAC.2
          .01=E832
    E874- NORMALIZE.FAC.3
    E880- NORMALIZE.FAC.4
    E88D- NORMALIZE.FAC.5
    E88F- NORMALIZE.FAC.6
    DE90- NOT.
    DE35- NOTMATH
    F26F- NOTRACE
    D45C- NUMBERED.LINE
          .01=D49F  .02=D4A7
    DFB0- NUMCMP
      0F- NUMDIM
    DFD6- NXDIM
    DBDC- NXIN
    DDD6- NXOP
    DB2C- NXSPC
      77- OLDLIN
      79- OLDTEXT
    D9F4- ON.1
    D9F8- ON.2
          .03=DA00
    F2CB- ONERR
    D9EC- ONGOTO
    DF4F- OR
    DB5C- OUTDO
          .01=DB64
    EA2B- OUTOFRNG
    DB5A- OUTQUES
    DB57- OUTSP
    E8D5- OVERFLOW
      79- P.ADD
      50- P.AND
      7B- P.MUL
      7F- P.NEQ
      46- P.OR
      7D- P.PWR
      64- P.REL
    DEB2- PARCHK
    D56C- PARSE
          .01=D56D  .02=D578  .03=D588  .04=D590  .05=D5A2  .06=D5A7  .07=D5A8
          .08=D5CB  .09=D5CD  .10=D5E0  .11=D5E2  .12=D5E9  .13=D5F2  .14=D5F9
          .15=D5FD  .16=D604  .17=D610
    D559- PARSE.INPUT.LINE
    DFCD- PDL
    E764- PEEK
    F225- PLOT
    F1EC- PLOTFNS
    E73D- POINT
    E77B- POKE
    F0CE- POLY.ATN
    EEE0- POLY.EXP
    E918- POLY.LOG
    F075- POLY.SIN
    EF72- POLYNOMIAL
    EF5C- POLYNOMIAL.ODD
    D96B- POP
    E2FF- POS
    DB03- PR.COMMA
          .01=DB0E
    DB2F- PR.NEXT.CHAR
    F1E5- PR.NUMBER
    DACF- PR.STRING
    DB16- PR.TAB.OR.SPC
          .01=DB21  .02=DB2B
    DDF6- PREFNC
      AF- PRGEND
    DAD5- PRINT
    D431- PRINT.ERROR.LINNUM
    ED2E- PRINT.FAC
    DAD7- PRINT2
    DBF1- PROCESS.INPUT.ITEM
          .01=DC1F  .02=DC27
    DBEB- PROCESS.INPUT.LIST
    D901- PROGIO
    DFE3- PTRGET
    DFE8- PTRGET2
    DFEA- PTRGET3
    E007- PTRGET4
          .01=E011  .02=E012  .03=E01C  .04=E026  .05=E036  .06=E03D  .07=E046
          .08=E049  .09=E04F  .10=E059  .11=E05B  .12=E065  .13=E073
    D9C5- PULL3
    D4B5- PUT.NEW.LINE
          .01=D4D1  .02=D4EA
    E435- PUTEMP
    E42A- PUTNEW
    DA7B- PUTSTR
          .01=DA8C  .02=DA9A  .03=DAA1  .04=DAB7
    EBF2- QINT
          .01=EC06
    EC12- QINT.2
    EC40- QINT.3
    D35D- QT.BREAK
    D350- QT.ERROR
    D358- QT.IN
    F070- QUARTER
    DBE2- READ
    DB7B- READERR
    D3E3- REASON
          .01=D3ED  .02=D3F1  .03=D3FC  .04=D40F
    F3BC- RECALL
          .01=F3D2
    DF65- RELOPS
    D9DC- REM
    D9A6- REMN
          .01=D9AE  .02=D9B6
      F8- REMSTK
    DB87- RESPERR
          .01=DB90
    D43C- RESTART
    D849- RESTORE
      62- RESULT
    F318- RESUME
    D984- RETURN
    E686- RIGHTSTR
    EFAE- RND
          .01=EFCC
      C9- RNDSEED
    F721- ROT
    EB72- ROUND.FAC
    D648- RTS.1
    E79F- RTS.10
    E89D- RTS.11
    E8D4- RTS.12
    E9E2- RTS.13
    EB71- RTS.14
    EB8F- RTS.15
    EC11- RTS.16
    EC49- RTS.17
    EEDA- RTS.18
    EFA5- RTS.19
    D696- RTS.2
    F0CD- RTS.20
    F600- RTS.22
    F6F5- RTS.23
    D857- RTS.3
    D8AF- RTS.4
    D96A- RTS.5
    D9A2- RTS.6
    DA0B- RTS.7
    DB02- RTS.8
    E2AC- RTS.9
    D912- RUN
          .01=D91B
    D8B0- SAVE
    DDD7- SAVOP
    F727- SCALE
    DEF9- SCREEN
    D64B- SCRTCH
      A3- SERLEN
    EF76- SERMAIN
          .01=EF85  .02=EF89  .03=EF96
      AD- SERPNT
    E0DE- SET.VARPNT.AND.YA
          .01=E0E8
    D853- SETDA
    EB27- SETFOR
    F299- SETHI
    F3EA- SETHPG
    D665- SETPTRS
    EB90- SGN
    DEAB- SGN.
      AB- SGNCPR
    E8F0- SHIFT.RIGHT
    E8DA- SHIFT.RIGHT.1
    E8DC- SHIFT.RIGHT.2
    E8FD- SHIFT.RIGHT.3
    E907- SHIFT.RIGHT.4
    E911- SHIFT.RIGHT.5
      A4- SHIFT.SIGN.EXT
    F775- SHLOAD
          .01=F796  .02=F7A0  .03=F7A3
    EB82- SIGN
    EB86- SIGN1
    EB88- SIGN2
      16- SIGNFLG
    EFF1- SIN
    F023- SIN.1
    F026- SIN.2
          .01=F033
    E301- SNGFLT
    DE0D- SNTXERR
    F262- SPEED
      F1- SPEEDZ
    EE8D- SQR
    E852- STA.IN.FAC.SIGN
    E850- STA.IN.FAC.SIGN.AND.EXP
    0100- STACK
    D7AF- STEP
          .01=D7C3
    D683- STKINI
    D86E- STOP
    F39F- STORE
          .01=F3AF
    EB2B- STORE.FAC.AT.YX.ROUNDED
    EB21- STORE.FAC.IN.TEMP1.ROUNDED
    EB1E- STORE.FAC.IN.TEMP2.ROUNDED
    E3C5- STR
    DF7D- STRCMP
          .01=DFA5
    DFAA- STRCMP.1
    DFB5- STRCMP.2
      6D- STREND
    E3D5- STRINI
    E3E7- STRLIT
    E3ED- STRLT2
          .01=E3F7  .02=E404  .03=E408  .04=E409  .05=E415  .06=E41F
      AB- STRNG1
      AD- STRNG2
    DB3A- STROUT
    DB3D- STRPRT
          .01=DB44
    E3DD- STRSPA
    DE81- STRTXT
          .01=DE8A
    D697- STXTPT
    E196- SUBERR
      14- SUBFLG
    E660- SUBSTRING.1
          .01=E666
    E667- SUBSTRING.2
    E668- SUBSTRING.3
          .01=E67F
    E6B9- SUBSTRING.SETUP
    C057- SW.HIRES
    C055- SW.HISCR
    C056- SW.LORES
    C054- SW.LOWSCR
    C052- SW.MIXCLR
    C053- SW.MIXSET
    C050- SW.TXTCLR
    DEC0- SYNCHR
    DEC9- SYNERR
    D846- SYNERR.1
    D981- SYNERR.2
    F03A- TAN
    F062- TAN.1
    F7BC- TAPEPNT
      93- TEMP1
      98- TEMP2
      8A- TEMP3
      52- TEMPPT
      55- TEMPST
    F399- TEXT
      0F- TKN.CNTR
      99- TMPEXP
    D000- TOKEN.ADDRESS.TABLE
      C5- TOKEN.AT
      83- TOKEN.DATA
      D0- TOKEN.EQUAL
      C2- TOKEN.FN
      81- TOKEN.FOR
      B0- TOKEN.GOSUB
      AB- TOKEN.GOTO
      CF- TOKEN.GREATER
      E8- TOKEN.LEFTSTR
      C9- TOKEN.MINUS
    D0D0- TOKEN.NAME.TABLE
      C6- TOKEN.NOT
      C8- TOKEN.PLUS
      A1- TOKEN.POP
      BA- TOKEN.PRINT
      B2- TOKEN.REM
      D7- TOKEN.SCRN
      D2- TOKEN.SGN
      C3- TOKEN.SPC
      C7- TOKEN.STEP
      C0- TOKEN.TAB
      C4- TOKEN.THEN
      C1- TOKEN.TO
    F26D- TRACE
    D805- TRACE.
          .00=D81D
      F2- TRCFLG
    DF60- TRUE
      87- TXPSV
      F4- TXTPSV
      B8- TXTPTR
      67- TXTTAB
    F501- UD.1
    DF0C- UNARY
          .01=DF3A  .02=DF3F
    D97C- UNDERR
    E30E- UNDFNC
    D080- UNFNC
    E19E- USE.OLD.ARRAY
          .01=E1AA
      0A- USR
    E707- VAL
          .01=E70F  .02=E727
      11- VALTYP
      81- VARNAM
      83- VARPNT
      69- VARTAB
    D8F0- VARTIO
    F241- VLIN
      A0- VPNT
    F256- VTAB
    E784- WAIT
          .01=E793  .02=E797
    F76F- XDRAW
    F65D- XDRAW0
    F661- XDRAW1
          .01=F682  .02=F68C  .03=F699  .04=F6A4  .05=F6B4
    EA31- ZERO
    E84E- ZERO.FAC
