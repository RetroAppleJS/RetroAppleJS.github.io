;===============================================================================
; DOS33_FM_PHASE6_BIDIRECTIONAL_COPY.S
; APPLE II / APPLE II+ - DUAL-PANE DOS 3.3 FILE MANAGER
; PHASE 6: BIDIRECTIONAL SELECTED-FILE COPY WITH CHUNK CRC16
;===============================================================================
;
; Phase 4 removes all preformatted sample file lists. During initialization,
; CATALOG is called once for each configured pane. It reads the DOS 3.3 VTOC
; and linked catalog sectors through DOS RWTS, then stores compact records
; directly in fixed left/right catalog buffers.
;
; CATALOG is not a menu command. It is an internal service intended for:
;
;   - program initialization;
;   - refreshing a pane after its slot or drive changes;
;   - future disk-change refresh operations.
;
; Input to CATALOG:
;
;   A = pane (PNLEFT or PNRIGHT)
;   X = slot number (1..7)
;   Y = drive number (1 or 2)
;
; The standard Disk II slot-ROM signature is checked before RWTS is called.
; A missing interface, missing drive/media, unreadable VTOC, invalid DOS 3.3
; VTOC, or unreadable catalog chain produces one synthetic pane entry:
;
;   [CONFIG SOURCE]
;
; Phase 5 can make that entry and DRV invoke the same configuration function
; with different parameters. The configuration dialog itself is not part of
; this phase.
;
; Catalog record layout, 33 bytes per absolute catalog entry:
;
;   +00  raw DOS type byte: bit 7 lock flag, bits 0..6 file type
;   +01  allocated sector count, low byte
;   +02  allocated sector count, high byte
;   +03  filename, 30 normal-ASCII characters padded with spaces
;
; Two 105-entry buffers occupy $4000-$4D88 and $4E00-$5B88. The program remains
; at $6000, so the catalog data cannot overlap the executable image.
;
; The TOC contains allocated sector count, not exact logical byte length. The
; status field therefore reports the complete 16-bit value as "NNNNN SEC".
;
; Pane scrolling, cross-pane boundary wrapping and the two 128-bit persistent
; selection maps continue to use absolute catalog indices.
;
; START initializes every mutable byte on every CALL. That remains useful,
; but it was not the cause of the SEL blockage.
;
; SEL is the first path that calls BLDSTAT/FMTSECT. The previous formatter
; used a compound indexed status-buffer operand. This version avoids that
; operand form by exposing separately named status fields.
;
; The decimal subtraction loop is also capped at ten attempts per digit. A
; valid decimal digit can require at most nine subtractions, so corrupted
; data or a bad divisor cannot trap the UI in this formatter.
;
; Phase 5 implements DRV as a reusable five-item header menu:
;
;   0 left slot, 1 left drive, 2 pane swap, 3 right slot, 4 right drive.
;
; OPENCFG accepts the initial item index in A. The main DRV command passes 0;
; Return on a left [CONFIG SOURCE] entry also passes 0, while Return on the
; right placeholder passes 3. Left/right arrows move through the five items.
; Space cycles a slot through 0..7 or a drive through 1..2 and immediately
; refreshes only that pane's catalog. Return on <-> swaps both pane sources,
; catalog buffers, cursor/scroll state and selection maps without disk I/O.
;
; Phase 5.1 gives each pane exactly 20 columns and removes the vertical
; divider. Catalog rows now occupy logical rows 2..19 (18 visible entries).
; Row 20 combines the menu with the former lower horizontal separator.
;
; CATALOG now stops immediately at the first never-used directory entry
; (entry T/S-list track byte $00). On a correctly formed DOS 3.3 disk this
; marks the end of the used catalog, so unread trailing catalog sectors are
; no longer fetched. PREPRW also preserves RWTS IOB bytes $0E..$10, because
; they describe the actual previous access and are updated by RWTS itself.
;
; Phase 6 activates CPY. Selected files are snapshotted first, then copied
; left-to-right and right-to-left. Successful source entries are deselected;
; failed entries remain selected after both catalogs are refreshed.
;
; Catalog records now include the first T/S-list track and sector. LDHEAD builds
; a reusable file-header buffer with type/lock, allocated sectors, filename,
; logical extent, binary load address/length where applicable, chunk length and
; CRC data. Source data is read by following T/S lists directly through RWTS.
;
; FILEBUF at $4000 holds one complete DOS 3.3 track (16 sectors / 4096 bytes).
; CRC-16/IBM ($A001, initial $FFFF) is calculated for each chunk and retained in
; a 35-entry CRC table in the current file-header buffer for future verification.
;
; Destination files are created and range-written through DOS File Manager
; ($03D6). Existing filenames are not overwritten. Partial files are closed and
; deleted after a write failure whenever DOS permits cleanup.
;
; Load at $6000 and execute CALL 24576.
; All labels are eight characters or shorter for ASM_core compatibility.
;===============================================================================

                ORG     $6000

;-------------------------------------------------------------------------------
; APPLE II HARDWARE AND KEY CODES
;-------------------------------------------------------------------------------

KBD             EQU     $C000          ; bit 7 set when a key is available
KBDSTRB         EQU     $C010          ; read to acknowledge the key
TXTSET          EQU     $C051          ; select text display
MIXCLR          EQU     $C052          ; disable mixed graphics/text
PAGE1           EQU     $C054          ; select text page 1
HOME            EQU     $FC58          ; monitor HOME routine

KEYLEFT         EQU     $88            ; previous/up
KEYRGHT         EQU     $95            ; next/down
KEYRET          EQU     $8D
KEYESC          EQU     $9B
KEYSPC          EQU     $A0

;-------------------------------------------------------------------------------
; SCREEN, PANE AND CAPACITY CONFIGURATION
;-------------------------------------------------------------------------------

ROWCOUNT        EQU     $18            ; 24 logical text rows
COLCOUNT        EQU     $28            ; 40 columns
PANETOP         EQU     $02            ; first pane screen row
VISROWS         EQU     $12            ; 18 visible rows: logical rows 2..19
LEFTEND         EQU     $14            ; left pane occupies columns 0..19
RGHTCOL         EQU     $14            ; right pane occupies columns 20..39
RGHTEND         EQU     $28            ; exclusive screen end at column 40
MENUROW         EQU     $14            ; row 20
STATROW         EQU     $17            ; row 23
MNUCOUNT        EQU     $06
PNLEFT          EQU     $01
PNRIGHT         EQU     $02
DRVMODE         EQU     $03
DRVCOUNT        EQU     $05
DRVLAST         EQU     $04
DRVSWAP         EQU     $02
SWPPAGES        EQU     $0F            ; 15 pages per catalog reservation
SCRUP           EQU     $00
SCRDOWN         EQU     $01
SELBYTS         EQU     $10            ; 16 bytes = 128 selection bits
SELLAST         EQU     $0F
CATCAP          EQU     $69            ; 105 active catalog entries maximum
RECSIZE         EQU     $23            ; 35 bytes, including first T/S pointer
LFTBUF          EQU     $2000          ; 105 records: $2000-$2E5A
RGTBUF          EQU     $3000          ; 105 records: $3000-$3E5A
FILEBUF         EQU     $4000          ; one-track chunk: $4000-$4FFF
DFWORK          EQU     $5000          ; destination File Manager work area
DFTSL           EQU     $5100          ; destination T/S-list buffer
DFDATA          EQU     $5200          ; destination data-sector buffer
SECBUF          EQU     $0800          ; raw RWTS sector buffer
GETFM           EQU     $03DC          ; locate DOS File Manager parameter list
FMGR            EQU     $03D6          ; execute DOS File Manager
GETIOB          EQU     $03E3          ; locate DOS RWTS IOB
RWTS            EQU     $03D9          ; execute RWTS
PSTAT           EQU     $48            ; RWTS uses Monitor status location
WORKLEN         EQU     $77            ; scalar bytes cleared by INITRAM
MEMPGLO         EQU     $20            ; external work pages start at $2000
MEMPGHI         EQU     $53            ; exclusive page after $52FF
CHUNKPG         EQU     $10            ; 16 sectors / 4096 bytes
CRCMAX          EQU     $23            ; maximum 35 chunks per disk
FHLAST          EQU     $7B            ; last file-header byte index
E_SAME          EQU     $80
E_EXIST         EQU     $81
E_BADHDR        EQU     $82
E_PSEUDO        EQU     $83
E_NOSEL         EQU     $84
E_TSL           EQU     $85

;===============================================================================
; PROGRAM ENTRY AND TOP-LEVEL MODE DISPATCH
;===============================================================================

START
                CLD                    ; never inherit decimal mode from a caller
                JSR     INITRAM        ; make every CALL a clean program start

                LDA     TXTSET
                LDA     MIXCLR
                LDA     PAGE1
                BIT     KBDSTRB
                JSR     HOME
                JSR     DRAWSC         ; draw frame while the drives are examined

                LDA     #$06           ; initial Phase 4 configuration: slot 6
                STA     LFTSLOT
                STA     RGTSLOT
                LDA     #$01
                STA     LFTDRV
                LDA     #$02
                STA     RGTDRV

                JSR     LOADLFT        ; CATALOG fills the left record buffer
                JSR     LOADRGT        ; CATALOG fills the right record buffer

                JSR     HDRDRAW        ; update slot, drive and volume indicators
                JSR     DRWLFT
                JSR     DRWRGT
                JSR     MNUDRAW
                JSR     MENUST

MAIN
                JSR     GETKEY
                STA     LASTKEY

                LDA     MODE
                BNE     MDNOTM
                JMP     MENKEY

MDNOTM
                CMP     #PNLEFT
                BNE     MDNOTL
                JMP     LFTKEY

MDNOTL
                CMP     #PNRIGHT
                BNE     MDNOTR
                JMP     RGTKEY

MDNOTR
                JMP     DRVKEY

;===============================================================================
; COMPLETE PER-RUN INITIALIZATION
;===============================================================================
;
; A normal BLOAD rewrites the program image, but CALLing the already-loaded
; binary again does not. More importantly, LFTBUF/RGTBUF live below the program
; and are never reloaded by BLOAD. INITRAM therefore clears:
;
;   - all scalar working variables from WORKBEG through WORKEND-1;
;   - both 16-byte persistent-selection maps;
;   - ROWBUF and STATBUF;
;   - the shared 256-byte sector buffer;
;   - both catalogs, FILEBUF and destination File Manager buffers;
;   - the Monitor status byte used by RWTS.
;
; Static lookup tables and screen strings are outside these ranges.
;
INITRAM
                LDA     #$00
                LDX     #$00

IRWORK
                STA     WORKBEG,X
                INX
                CPX     #WORKLEN
                BCC     IRWORK

                JSR     CLRSEL

                LDA     #$00
                LDX     #$13           ; ROWBUF: 20 bytes
IRROW
                STA     ROWBUF,X
                DEX
                BPL     IRROW

                LDX     #$27           ; STATBUF: 40 bytes
IRSTAT
                STA     STATBUF,X
                DEX
                BPL     IRSTAT

                LDY     #$00           ; shared RWTS sector buffer
IRSEC
                STA     SECBUF,Y
                INY
                BNE     IRSEC

                STA     PSTAT          ; do not inherit a stale RWTS status byte
                JSR     CLRMEMS
                RTS

; Clear all external work pages $2000-$52FF.
CLRMEMS
                LDA     #MEMPGLO
                STA     IRCSTORE+2

IRCPAGE
                LDY     #$00
                LDA     #$00

IRCSTORE
                STA     $2000,Y
                INY
                BNE     IRCSTORE

                INC     IRCSTORE+2
                LDA     IRCSTORE+2
                CMP     #MEMPGHI
                BCC     IRCPAGE
                RTS

;===============================================================================
; BLOCKING KEYBOARD READ
;===============================================================================

GETKEY
                LDA     KBD
                BPL     GETKEY
                BIT     KBDSTRB
                RTS

;===============================================================================
; MAIN-MENU NAVIGATION
;===============================================================================

MENKEY
                LDA     LASTKEY
                CMP     #KEYLEFT
                BNE     MKRGHT
                JSR     MNLEFT
                JMP     MAIN

MKRGHT
                CMP     #KEYRGHT
                BNE     MKENTER
                JSR     MNRGHT
                JMP     MAIN

MKENTER
                CMP     #KEYRET
                BNE     MKESC
                JMP     MNENTER

MKESC
                CMP     #KEYESC
                BNE     MKOTHER
                JSR     MNUDRAW
                JSR     MENUST

MKOTHER
                JMP     MAIN

MNLEFT
                LDA     MENUSEL
                BNE     MNLDOWN
                LDA     #$05
                STA     MENUSEL
                JMP     MNLSHOW

MNLDOWN
                DEC     MENUSEL

MNLSHOW
                JSR     MNUDRAW
                JMP     MENUST

MNRGHT
                INC     MENUSEL
                LDA     MENUSEL
                CMP     #MNUCOUNT
                BCC     MNRSAME
                LDA     #$00
                STA     MENUSEL

MNRSAME
                JSR     MNUDRAW
                JMP     MENUST

MNENTER
                LDA     MENUSEL
                BNE     MNENOT0
                JMP     ENTSEL         ; item 0 = selection/navigation mode

MNENOT0
                CMP     #$01
                BNE     MNENOT1
                JMP     ENTDRV         ; item 1 = slot/drive configuration

MNENOT1
                CMP     #$02
                BNE     MNENOT2
                JMP     ENTCPY         ; item 2 = bidirectional selected-file copy

MNENOT2
                CMP     #$05
                BNE     MNELATE
                JMP     QUIT           ; item 5 = return to BASIC

MNELATE
                JSR     NIMPST         ; items 3 and 4 remain later-phase commands
                JMP     MAIN

; SEL starts at the first buffered entry of the left catalog. Its scrolling
; window returns to the top; CATALOG-loaded data remains unchanged.
ENTSEL
                JSR     NORMENU

                LDA     LFTCNT         ; CATALOG should always provide >=1 entry
                BNE     ESHAVE
                JSR     LOADLFT        ; defensive recovery from damaged state

ESHAVE
                LDA     #$00
                STA     LEFTCUR
                STA     LFTTOP
                JSR     DRWLFT
                LDA     #PNLEFT
                STA     MODE
                JSR     HILLFT
                JSR     LFTSTAT
                JMP     MAIN

; The regular DRV command always opens at the left slot item.
ENTDRV
                JSR     NORMENU
                LDA     #$00
                JSR     OPENCFG
                JMP     MAIN

ENTCPY
                JSR     NORMENU
                JSR     CPYALL
                LDA     #$00
                STA     MODE
                LDA     #$02
                STA     MENUSEL
                JSR     MNUDRAW
                JMP     MAIN

QUIT
                JSR     HOME
                RTS

;===============================================================================
; SLOT/DRIVE CONFIGURATION HEADER MENU
;===============================================================================
;
; OPENCFG is the reusable entry point requested for Phase 5.
;
; Input:
;   A = initial menu item index:
;       0 left slot, 1 left drive, 2 <->, 3 right slot, 4 right drive
;
; The caller is responsible for normalizing the previous cursor/menu highlight.
;
OPENCFG
                CMP     #DRVCOUNT
                BCC     OCFGOOD
                LDA     #$00
OCFGOOD
                STA     DRVSEL
                LDA     #DRVMODE
                STA     MODE
                JSR     DRVSHOW
                JMP     DRVSTAT

DRVKEY
                LDA     LASTKEY
                CMP     #KEYESC
                BNE     DKLEFT
                JSR     DRVEXIT
                JMP     MAIN

DKLEFT
                CMP     #KEYLEFT
                BNE     DKRIGHT
                JSR     DRVLEFT
                JMP     MAIN

DKRIGHT
                CMP     #KEYRGHT
                BNE     DKSPACE
                JSR     DRVRGHT
                JMP     MAIN

DKSPACE
                CMP     #KEYSPC
                BNE     DKRET
                JSR     DRVSPACE
                JMP     MAIN

DKRET
                CMP     #KEYRET
                BNE     DKOTHER
                JSR     DRVRET

DKOTHER
                JMP     MAIN

DRVLEFT
                LDA     DRVSEL
                BNE     DLVDEC
                LDA     #DRVLAST
                STA     DRVSEL
                JMP     DRVSHOW
DLVDEC
                DEC     DRVSEL
                JMP     DRVSHOW

DRVRGHT
                INC     DRVSEL
                LDA     DRVSEL
                CMP     #DRVCOUNT
                BCC     DRVSHOW
                LDA     #$00
                STA     DRVSEL

; Redraw the complete header in normal video, then invert only the active item.
DRVSHOW
                JSR     HDRDRAW
                LDX     DRVSEL
                LDA     DRVEND,X
                TAY
                LDA     DRVST,X
                TAX
                LDA     #$00           ; header is logical screen row 0
                JMP     INVROW

DRVSTAT
                LDA     #<DRVHELP
                STA     PRLOAD+1
                LDA     #>DRVHELP
                STA     PRLOAD+2
                LDA     #STATROW
                JMP     PUTROW

DRVEXIT
                JSR     HDRDRAW        ; remove the header highlight
                LDA     #$00
                STA     MODE
                LDA     #$01           ; return main-menu focus to DRV
                STA     MENUSEL
                JSR     MNUDRAW
                JMP     MENUST

; Space cycles only slot/drive values. The <-> item responds to Return instead.
DRVSPACE
                LDA     DRVSEL
                BNE     DSPNOT0

; Left slot: S0..S7.
                LDA     LFTSLOT
                CLC
                ADC     #$01
                AND     #$07
                STA     LFTSLOT
                JSR     DRVSHOW        ; expose the chosen value before disk access
                JSR     LOADLFT
                JSR     DRWLFT
                JMP     DRVSHOW

DSPNOT0
                CMP     #$01
                BNE     DSPNOT1

; Left drive: D1 <-> D2.
                LDA     LFTDRV
                EOR     #$03
                STA     LFTDRV
                JSR     DRVSHOW
                JSR     LOADLFT
                JSR     DRWLFT
                JMP     DRVSHOW

DSPNOT1
                CMP     #$03
                BNE     DSPNOT3

; Right slot: S0..S7.
                LDA     RGTSLOT
                CLC
                ADC     #$01
                AND     #$07
                STA     RGTSLOT
                JSR     DRVSHOW
                JSR     LOADRGT
                JSR     DRWRGT
                JMP     DRVSHOW

DSPNOT3
                CMP     #$04
                BNE     DSPDONE

; Right drive: D1 <-> D2.
                LDA     RGTDRV
                EOR     #$03
                STA     RGTDRV
                JSR     DRVSHOW
                JSR     LOADRGT
                JSR     DRWRGT
                JMP     DRVSHOW

DSPDONE
                RTS

; Return swaps panes only while <-> is selected.
DRVRET
                LDA     DRVSEL
                CMP     #DRVSWAP
                BNE     DRVRTS
                JSR     SWAPPAN
                JMP     DRVSHOW
DRVRTS
                RTS

; Swap all pane-owned scalar state, selection bits and catalog data in RAM.
; No CATALOG/RWTS call is made.
SWAPPAN
                LDA     LFTSLOT
                PHA
                LDA     RGTSLOT
                STA     LFTSLOT
                PLA
                STA     RGTSLOT

                LDA     LFTDRV
                PHA
                LDA     RGTDRV
                STA     LFTDRV
                PLA
                STA     RGTDRV

                LDA     LFTVOL
                PHA
                LDA     RGTVOL
                STA     LFTVOL
                PLA
                STA     RGTVOL

                LDA     LFTOK
                PHA
                LDA     RGTOK
                STA     LFTOK
                PLA
                STA     RGTOK

                LDA     LFTCNT
                PHA
                LDA     RGTCNT
                STA     LFTCNT
                PLA
                STA     RGTCNT

                LDA     LEFTCUR
                PHA
                LDA     RGHTCUR
                STA     LEFTCUR
                PLA
                STA     RGHTCUR

                LDA     LFTTOP
                PHA
                LDA     RGHTTOP
                STA     LFTTOP
                PLA
                STA     RGHTTOP

                JSR     SWPSELS
                JSR     SWPBUFS
                JSR     DRWLFT
                JMP     DRWRGT

SWPSELS
                LDX     #SELLAST
SPSLOOP
                LDA     LFTSEL,X
                PHA
                LDA     RGTSEL,X
                STA     LFTSEL,X
                PLA
                STA     RGTSEL,X
                DEX
                BPL     SPSLOOP
                RTS

; Swap fifteen complete pages: $2000-$2EFF with $3000-$3EFF.
SWPBUFS
                LDA     #>LFTBUF
                STA     SWPLD+2
                STA     SWPLST+2
                LDA     #>RGTBUF
                STA     SWPRD+2
                STA     SWPRST+2
                LDA     #SWPPAGES
                STA     SWPPAGE

SWPAGLP
                LDY     #$00

SWPBYT
SWPLD
                LDA     $2000,Y
                STA     SWPTMP
SWPRD
                LDA     $3000,Y
SWPLST
                STA     $2000,Y
                LDA     SWPTMP
SWPRST
                STA     $3000,Y
                INY
                BNE     SWPBYT

                INC     SWPLD+2
                INC     SWPLST+2
                INC     SWPRD+2
                INC     SWPRST+2
                DEC     SWPPAGE
                BNE     SWPAGLP
                RTS

; Build row 0 from the current source configuration. Volume fields are updated
; separately from the five selectable configuration items.
HDRDRAW
                LDA     LFTSLOT
                ORA     #$30
                STA     HDRLSNO
                LDA     LFTDRV
                ORA     #$30
                STA     HDRLDNO
                LDA     RGTSLOT
                ORA     #$30
                STA     HDRRSNO
                LDA     RGTDRV
                ORA     #$30
                STA     HDRRDNO

                LDA     LFTOK
                BEQ     HDLNOV
                LDA     LFTVOL
                LDX     #$07
                JSR     PUTVOL3
                JMP     HDRIGHT
HDLNOV
                LDX     #$07
                JSR     NOVOL3

HDRIGHT
                LDA     RGTOK
                BEQ     HDRNOV
                LDA     RGTVOL
                LDX     #$24
                JSR     PUTVOL3
                JMP     HDRPUT
HDRNOV
                LDX     #$24
                JSR     NOVOL3

HDRPUT
                LDA     #<HDRBUF
                STA     PRLOAD+1
                LDA     #>HDRBUF
                STA     PRLOAD+2
                LDA     #$00
                JMP     PUTROW

NOVOL3
                LDA     #$2D
                STA     HDRBUF,X
                INX
                STA     HDRBUF,X
                INX
                STA     HDRBUF,X
                RTS

; Format an 8-bit volume as three zero-padded decimal digits.
; Input A=volume, X=first destination column in HDRBUF.
PUTVOL3
                STA     VWORK
                STX     VOLOFF
                LDA     #$00
                STA     VDIG

PVHUND
                LDA     VWORK
                CMP     #$64
                BCC     PVHOUT
                SEC
                SBC     #$64
                STA     VWORK
                INC     VDIG
                JMP     PVHUND

PVHOUT
                LDX     VOLOFF
                LDA     VDIG
                ORA     #$30
                STA     HDRBUF,X
                INC     VOLOFF
                LDA     #$00
                STA     VDIG

PVTENS
                LDA     VWORK
                CMP     #$0A
                BCC     PVTOUT
                SEC
                SBC     #$0A
                STA     VWORK
                INC     VDIG
                JMP     PVTENS

PVTOUT
                LDX     VOLOFF
                LDA     VDIG
                ORA     #$30
                STA     HDRBUF,X
                INX
                LDA     VWORK
                ORA     #$30
                STA     HDRBUF,X
                RTS

;===============================================================================
; BIDIRECTIONAL SELECTED-FILE COPY
;===============================================================================

CPYALL
                LDA     LFTSLOT
                CMP     RGTSLOT
                BNE     CPYDIFF
                LDA     LFTDRV
                CMP     RGTDRV
                BNE     CPYDIFF
                LDA     #E_SAME
                STA     CPERR
                JMP     SHOWERR

CPYDIFF
                JSR     SNAPSEL
                LDA     CPTOTAL
                BNE     CPYHAVE
                LDA     #E_NOSEL
                STA     CPERR
                JMP     SHOWERR

CPYHAVE
                LDA     LFTCNT
                STA     CPLCNT
                LDA     RGTCNT
                STA     CPRCNT
                LDA     #$00
                STA     CPDONE
                STA     CPFAIL

                LDA     #PNLEFT
                STA     CPSPANE
                LDA     #PNRIGHT
                STA     CPDPANE
                LDA     CPLCNT
                STA     CPLIMIT
                JSR     CPYDIR

                LDA     #PNRIGHT
                STA     CPSPANE
                LDA     #PNLEFT
                STA     CPDPANE
                LDA     CPRCNT
                STA     CPLIMIT
                JSR     CPYDIR

                JSR     LOADLFT
                JSR     LOADRGT
                JSR     KEEPSEL
                JSR     HDRDRAW
                JSR     DRWLFT
                JSR     DRWRGT
                JMP     SUMSTAT

SNAPSEL
                LDA     #$00
                STA     CPTOTAL
                LDX     #SELLAST
SNAPLOOP
                LDA     LFTSEL,X
                STA     CPLSEL,X
                LDA     RGTSEL,X
                STA     CPRSEL,X
                DEX
                BPL     SNAPLOOP
                LDX     #$00
SNAPCNT
                LDA     CPLSEL,X
                JSR     CNTBITS
                LDA     CPRSEL,X
                JSR     CNTBITS
                INX
                CPX     #SELBYTS
                BCC     SNAPCNT
                RTS

CNTBITS
                LDY     #$08
CBITLOOP
                LSR     A
                BCC     CBITNEXT
                INC     CPTOTAL
CBITNEXT
                DEY
                BNE     CBITLOOP
                RTS

KEEPSEL
                LDX     #SELLAST
KEEPLOOP
                LDA     CPLSEL,X
                STA     LFTSEL,X
                LDA     CPRSEL,X
                STA     RGTSEL,X
                DEX
                BPL     KEEPLOOP
                RTS

CPYDIR
                LDA     #$00
                STA     CPINDEX
CPYDLOOP
                LDA     CPINDEX
                CMP     CPLIMIT
                BCC     CPYDCONT
                RTS
CPYDCONT
                JSR     TSTCPBIT
                BEQ     CPYDNEXT
                JSR     COPYONE
                BCS     CPYDERR
                JSR     CLEARCP
                INC     CPDONE
                JSR     REDRAWS
                JSR     SHOWPROG
                JMP     CPYDNEXT
CPYDERR
                INC     CPFAIL
                JSR     SHOWERR
CPYDNEXT
                INC     CPINDEX
                JMP     CPYDLOOP

TSTCPBIT
                LDA     CPINDEX
                JSR     BITADDR
                LDA     CPSPANE
                CMP     #PNLEFT
                BNE     TSTCRGT
                LDA     CPLSEL,X
                AND     SELMASK
                RTS
TSTCRGT
                LDA     CPRSEL,X
                AND     SELMASK
                RTS

CLEARCP
                LDA     CPINDEX
                JSR     BITADDR
                LDA     SELMASK
                EOR     #$FF
                STA     CLRMASK
                LDA     CPSPANE
                CMP     #PNLEFT
                BNE     CLRRBIT
                LDA     CPLSEL,X
                AND     CLRMASK
                STA     CPLSEL,X
                LDA     LFTSEL,X
                AND     CLRMASK
                STA     LFTSEL,X
                RTS
CLRRBIT
                LDA     CPRSEL,X
                AND     CLRMASK
                STA     CPRSEL,X
                LDA     RGTSEL,X
                AND     CLRMASK
                STA     RGTSEL,X
                RTS

REDRAWS
                LDA     CPSPANE
                CMP     #PNLEFT
                BNE     REDRRGHT
                JMP     DRWLFT
REDRRGHT
                JMP     DRWRGT

COPYONE
                JSR     LDHEAD
                BCC     COHEADOK
                RTS
COHEADOK
                LDA     FHRAW
                AND     #$7F
                CMP     #$7E
                BCC     COREAL
                LDA     #E_PSEUDO
                STA     CPERR
                SEC
                RTS
COREAL
                JSR     DSTOPEN
                BCC     COOPEN
                RTS
COOPEN
                JSR     RSTREAD
COCHUNK
                LDA     FHREM0
                ORA     FHREM1
                ORA     FHREM2
                BEQ     COCLOSE
                JSR     LDCHUNK
                BCS     COABORT
                JSR     FMWRIT
                BCS     COABORT
                JMP     COCHUNK
COCLOSE
                JSR     FMCLOSE
                BCS     COABORT2
                LDA     FHRAW
                BPL     COSUCC
                JSR     FMLOCK
COSUCC
                CLC
                RTS
COABORT
                JSR     ABORTDS
                SEC
                RTS
COABORT2
                JSR     FMDELETE
                SEC
                RTS

;===============================================================================
; FILE-HEADER BUFFER
;===============================================================================

LDHEAD
                JSR     CLRHEAD
                LDA     CPINDEX
                LDX     CPSPANE
                JSR     SETRECP
                LDY     #$00
                JSR     RECREAD
                STA     FHRAW
                INY
                JSR     RECREAD
                STA     FHSECLO
                INY
                JSR     RECREAD
                STA     FHSECHI
                LDX     #$00
LDHNAM
                TXA
                CLC
                ADC     #$03
                TAY
                JSR     RECREAD
                STA     FHNAME,X
                INX
                CPX     #$1E
                BCC     LDHNAM
                LDY     #$21
                JSR     RECREAD
                STA     FHTSLT
                INY
                JSR     RECREAD
                STA     FHTSLS
                JSR     SETCPDEV
                LDA     FHRAW
                AND     #$7F
                CMP     #$7E
                BCC     LDHREAL
                LDA     #E_PSEUDO
                STA     CPERR
                SEC
                RTS
LDHREAL
                JSR     SCANFILE
                BCC     LDHSCAN
                RTS
LDHSCAN
                LDA     #$00
                STA     FHTOT0
                LDA     FHLOGLO
                STA     FHTOT1
                LDA     FHLOGHI
                STA     FHTOT2
                LDA     FHLOGLO
                ORA     FHLOGHI
                BEQ     LDHREADY
                JSR     RSTREAD
                LDA     #>FILEBUF
                STA     CHKPTRH
                JSR     PREPRW
                JSR     RDNEXT
                BCC     LDHPARSE
                RTS
LDHPARSE
                JSR     PARSHDR
                BCC     LDHREADY
                RTS
LDHREADY
                LDA     FHTOT0
                STA     FHREM0
                LDA     FHTOT1
                STA     FHREM1
                LDA     FHTOT2
                STA     FHREM2
                JSR     RSTREAD
                CLC
                RTS

CLRHEAD
                LDX     #FHLAST
                LDA     #$00
CLRHLOOP
                STA     FHBEG,X
                DEX
                BPL     CLRHLOOP
                RTS

SETCPDEV
                LDA     CPSPANE
                CMP     #PNLEFT
                BNE     SCPRIGHT
                LDA     LFTSLOT
                STA     CATSLOT
                LDA     LFTDRV
                STA     CATDRV
                LDA     RGTSLOT
                STA     DSTSLOT
                LDA     RGTDRV
                STA     DSTDRV
                RTS
SCPRIGHT
                LDA     RGTSLOT
                STA     CATSLOT
                LDA     RGTDRV
                STA     CATDRV
                LDA     LFTSLOT
                STA     DSTSLOT
                LDA     LFTDRV
                STA     DSTDRV
                RTS

SCANFILE
                LDA     #$00
                STA     MAXLO
                STA     MAXHI
                STA     TSLGUARD
                LDA     FHTSLT
                STA     TSLTRK
                LDA     FHTSLS
                STA     TSLSEC
                JSR     PREPRW
SFNEXTLS
                LDA     TSLTRK
                BNE     SFREAD
                LDA     MAXLO
                STA     FHLOGLO
                LDA     MAXHI
                STA     FHLOGHI
                CLC
                RTS
SFREAD
                INC     TSLGUARD
                LDA     TSLGUARD
                CMP     #$09
                BCC     SFGUARD
                LDA     #E_TSL
                STA     CPERR
                SEC
                RTS
SFGUARD
                LDA     TSLTRK
                LDX     TSLSEC
                JSR     READSEC
                BCC     SFSECTOR
                STA     CPERR
                SEC
                RTS
SFSECTOR
                LDA     SECBUF+$05
                STA     BASELO
                LDA     SECBUF+$06
                STA     BASEHI
                LDA     #$00
                STA     TSLIDX
SFPAIR
                LDA     TSLIDX
                ASL     A
                CLC
                ADC     #$0C
                TAY
                LDA     SECBUF,Y
                INY
                ORA     SECBUF,Y
                BEQ     SFPNEXT
                LDA     BASELO
                CLC
                ADC     TSLIDX
                ADC     #$01
                STA     CANDLO
                LDA     BASEHI
                ADC     #$00
                STA     CANDHI
                LDA     CANDHI
                CMP     MAXHI
                BCC     SFPNEXT
                BNE     SFSETMAX
                LDA     CANDLO
                CMP     MAXLO
                BCC     SFPNEXT
                BEQ     SFPNEXT
SFSETMAX
                LDA     CANDLO
                STA     MAXLO
                LDA     CANDHI
                STA     MAXHI
SFPNEXT
                INC     TSLIDX
                LDA     TSLIDX
                CMP     #$7A
                BCC     SFPAIR
                LDA     SECBUF+$01
                STA     TSLTRK
                LDA     SECBUF+$02
                STA     TSLSEC
                JMP     SFNEXTLS

PARSHDR
                LDA     FHRAW
                AND     #$7F
                CMP     #$04
                BEQ     PHBIN
                CMP     #$01
                BEQ     PHBASIC
                CMP     #$02
                BEQ     PHBASIC
                CMP     #$10
                BEQ     PHREL
                CLC
                RTS
PHBIN
                LDA     FILEBUF
                STA     FHLOADL
                LDA     FILEBUF+$01
                STA     FHLOADH
                LDA     FILEBUF+$02
                STA     FHLENL
                LDA     FILEBUF+$03
                STA     FHLENH
                LDA     #$04
                JMP     MAKEEXCT
PHBASIC
                LDA     FILEBUF
                STA     FHLENL
                LDA     FILEBUF+$01
                STA     FHLENH
                LDA     #$02
                JMP     MAKEEXCT
PHREL
                LDA     FILEBUF
                STA     FHLOADL
                LDA     FILEBUF+$01
                STA     FHLOADH
                LDA     FILEBUF+$02
                STA     FHLENL
                LDA     FILEBUF+$03
                STA     FHLENH
                LDA     FILEBUF+$04
                STA     FHSRCL
                LDA     FILEBUF+$05
                STA     FHSRCH
                LDA     #$06
MAKEEXCT
                STA     EXADD
                LDA     FHLENL
                CLC
                ADC     EXADD
                STA     EXCT0
                LDA     FHLENH
                ADC     #$00
                STA     EXCT1
                LDA     #$00
                ADC     #$00
                STA     EXCT2
                LDA     EXCT2
                CMP     FHTOT2
                BCC     USEEXACT
                BNE     PHBAD
                LDA     EXCT1
                CMP     FHTOT1
                BCC     USEEXACT
                BNE     PHBAD
                LDA     EXCT0
                CMP     FHTOT0
                BCC     USEEXACT
                BEQ     USEEXACT
PHBAD
                LDA     #E_BADHDR
                STA     CPERR
                SEC
                RTS
USEEXACT
                LDA     EXCT0
                STA     FHTOT0
                LDA     EXCT1
                STA     FHTOT1
                LDA     EXCT2
                STA     FHTOT2
                CLC
                RTS

;===============================================================================
; RAW T/S-LIST CHUNK READER
;===============================================================================

RSTREAD
                LDA     FHTSLT
                STA     RDTSLT
                LDA     FHTSLS
                STA     RDTSLS
                LDA     #$00
                STA     RDPAIR
                STA     RDLOAD
                STA     RDNXTTR
                STA     RDNXTS
                RTS

LDCHUNK
                LDA     FHREM2
                BNE     LCDFULL
                LDA     FHREM1
                CMP     #$10
                BCS     LCDFULL
                STA     FHCHH
                LDA     FHREM0
                STA     FHCHL
                JMP     LCDLEN
LCDFULL
                LDA     #$00
                STA     FHCHL
                LDA     #$10
                STA     FHCHH
LCDLEN
                LDA     FHCHL
                ORA     FHCHH
                BNE     LCDHAVE
                CLC
                RTS
LCDHAVE
                LDA     FHCHH
                STA     SECTCNT
                LDA     FHCHL
                BEQ     LCDSCNT
                INC     SECTCNT
LCDSCNT
                LDA     #>FILEBUF
                STA     CHKPTRH
                JSR     PREPRW
LCDSECT
                LDA     SECTCNT
                BEQ     LCDSUB
                JSR     RDNEXT
                BCS     LCDFAIL
                INC     CHKPTRH
                DEC     SECTCNT
                JMP     LCDSECT
LCDSUB
                LDA     FHREM0
                SEC
                SBC     FHCHL
                STA     FHREM0
                LDA     FHREM1
                SBC     FHCHH
                STA     FHREM1
                LDA     FHREM2
                SBC     #$00
                STA     FHREM2
                JSR     CRCCHNK
                CLC
                RTS
LCDFAIL
                SEC
                RTS

RDNEXT
RDNTRY
                LDA     RDLOAD
                BNE     RDNPAIR
                JSR     RDLIST
                BCC     RDNPAIR
                RTS
RDNPAIR
                LDA     RDPAIR
                CMP     #$7A
                BCC     RDNGET
                LDA     RDNXTTR
                STA     RDTSLT
                LDA     RDNXTS
                STA     RDTSLS
                LDA     #$00
                STA     RDPAIR
                STA     RDLOAD
                JMP     RDNTRY
RDNGET
                LDA     RDPAIR
                ASL     A
                CLC
                ADC     #$0C
                TAY
                LDA     SECBUF,Y
                STA     DATATRK
                INY
                LDA     SECBUF,Y
                STA     DATASEC
                INC     RDPAIR
                LDA     DATATRK
                BNE     RDNDATA
                LDA     DATASEC
                BEQ     RDNZERO
                LDA     #E_TSL
                STA     CPERR
                SEC
                RTS
RDNDATA
                LDA     DATATRK
                LDX     DATASEC
                JSR     READPTR
                BCC     RDNOK
                STA     CPERR
                SEC
                RTS
RDNZERO
                LDA     CHKPTRH
                STA     RDNZSTA+2
                LDY     #$00
                LDA     #$00
RDNZSTA
                STA     $4000,Y
                INY
                BNE     RDNZSTA
RDNOK
                CLC
                RTS

RDLIST
                LDA     RDTSLT
                BNE     RDLREAD
                LDA     #E_TSL
                STA     CPERR
                SEC
                RTS
RDLREAD
                LDA     RDTSLT
                LDX     RDTSLS
                JSR     READSEC
                BCC     RDLSAVE
                STA     CPERR
                SEC
                RTS
RDLSAVE
                LDA     SECBUF+$01
                STA     RDNXTTR
                LDA     SECBUF+$02
                STA     RDNXTS
                LDA     #$01
                STA     RDLOAD
                LDA     #$00
                STA     RDPAIR
                CLC
                RTS

READPTR
                STA     RDTRK
                STX     RDSEC
                LDY     #$04
                LDA     RDTRK
                JSR     IOBPUT
                INY
                LDA     RDSEC
                JSR     IOBPUT
                LDY     #$08
                LDA     #$00
                JSR     IOBPUT
                INY
                LDA     CHKPTRH
                JSR     IOBPUT
                LDY     #$0C
                LDA     #$01
                JSR     IOBPUT
                INY
                LDA     #$00
                JSR     IOBPUT
                LDY     IOBLO
                LDA     IOBHI
                JSR     RWTS
                PHP
                LDA     #$00
                STA     PSTAT
                PLP
                BCC     RDPCHK
                LDY     #$0D
                JSR     IOBGET
                BNE     RDPERR
                LDA     #$40
RDPERR
                SEC
                RTS
RDPCHK
                LDY     #$0D
                JSR     IOBGET
                BEQ     RDPOK
                SEC
                RTS
RDPOK
                CLC
                RTS

CRCCHNK
                LDA     #$FF
                STA     FHCRCLO
                STA     FHCRCHI
                LDA     FHCHL
                STA     CRCREML
                LDA     FHCHH
                STA     CRCREMH
                LDA     #>FILEBUF
                STA     CRCPTRH
                STA     CRCLOAD+2
                LDY     #$00
CRCBYTE
                LDA     CRCREML
                ORA     CRCREMH
                BEQ     CRCDONE
CRCLOAD
                LDA     $4000,Y
                EOR     FHCRCLO
                STA     FHCRCLO
                LDX     #$08
CRCBIT
                LDA     FHCRCLO
                AND     #$01
                STA     CRCFLAG
                LSR     FHCRCHI
                ROR     FHCRCLO
                LDA     CRCFLAG
                BEQ     CRCNEXT
                LDA     FHCRCLO
                EOR     #$01
                STA     FHCRCLO
                LDA     FHCRCHI
                EOR     #$A0
                STA     FHCRCHI
CRCNEXT
                DEX
                BNE     CRCBIT
                INY
                BNE     CRCDEC
                INC     CRCPTRH
                LDA     CRCPTRH
                STA     CRCLOAD+2
CRCDEC
                LDA     CRCREML
                BNE     CRCDECL
                DEC     CRCREMH
CRCDECL
                DEC     CRCREML
                JMP     CRCBYTE
CRCDONE
                LDA     FHCRCNT
                CMP     #CRCMAX
                BCS     CRCNOST
                ASL     A
                TAX
                LDA     FHCRCLO
                STA     FHCRCTB,X
                INX
                LDA     FHCRCHI
                STA     FHCRCTB,X
CRCNOST
                INC     FHCRCNT
                RTS

;===============================================================================
; DOS FILE MANAGER DESTINATION WRITER
;===============================================================================

DSTOPEN
                JSR     BLDFNAME
                JSR     CLRDFM
                JSR     FMPREP
                JSR     SETOPEN
                LDX     #$01
                JSR     FMCALL
                LDA     FMRC
                BEQ     DSOEXIST
                CMP     #$06
                BEQ     DSONEW
                STA     CPERR
                SEC
                RTS
DSOEXIST
                JSR     FMCLOSE
                LDA     #E_EXIST
                STA     CPERR
                SEC
                RTS
DSONEW
                JSR     CLRDFM
                JSR     SETOPEN
                LDX     #$00
                JSR     FMCALL
                LDA     FMRC
                BEQ     DSOOK
                CMP     #$06
                BEQ     DSOOK
                STA     CPERR
                SEC
                RTS
DSOOK
                LDA     #$01
                STA     FMFIRST
                CLC
                RTS

BLDFNAME
                LDX     #$00
BFNLOOP
                LDA     FHNAME,X
                ORA     #$80
                STA     FMNAME,X
                INX
                CPX     #$1E
                BCC     BFNLOOP
                RTS

CLRDFM
                LDA     #>DFWORK
                STA     CDFSTORE+2
                LDX     #$03
CDFPAGE
                LDY     #$00
                LDA     #$00
CDFSTORE
                STA     $5000,Y
                INY
                BNE     CDFSTORE
                INC     CDFSTORE+2
                DEX
                BNE     CDFPAGE
                RTS

FMPREP
                JSR     GETFM
                STY     FMLO
                STA     FMHI
                STY     FMREAD+1
                STY     FMWRITE+1
                STA     FMREAD+2
                STA     FMWRITE+2
                RTS
FMGET
FMREAD
                LDA     $FFFF,Y
                RTS
FMPUT
FMWRITE
                STA     $FFFF,Y
                RTS
FMCOM
                LDY     #$0C
                LDA     #<DFWORK
                JSR     FMPUT
                INY
                LDA     #>DFWORK
                JSR     FMPUT
                INY
                LDA     #<DFTSL
                JSR     FMPUT
                INY
                LDA     #>DFTSL
                JSR     FMPUT
                INY
                LDA     #<DFDATA
                JSR     FMPUT
                INY
                LDA     #>DFDATA
                JMP     FMPUT
SETOPEN
                LDY     #$00
                LDA     #$01
                JSR     FMPUT
                INY
                LDA     #$00
                JSR     FMPUT
                INY
                JSR     FMPUT
                INY
                JSR     FMPUT
                INY
                JSR     FMPUT
                INY
                LDA     DSTDRV
                JSR     FMPUT
                INY
                LDA     DSTSLOT
                JSR     FMPUT
                INY
                LDA     FHRAW
                AND     #$7F
                JSR     FMPUT
                INY
                LDA     #<FMNAME
                JSR     FMPUT
                INY
                LDA     #>FMNAME
                JSR     FMPUT
                INY
                LDA     #$00
                JSR     FMPUT
                JMP     FMCOM
FMCALL
                LDY     FMLO
                LDA     FMHI
                JSR     FMGR
                LDY     #$0A
                JSR     FMGET
                STA     FMRC
                BEQ     FMCOK
                SEC
                RTS
FMCOK
                CLC
                RTS
FMWRIT
                LDY     #$00
                LDA     #$04
                JSR     FMPUT
                INY
                LDA     FMFIRST
                BEQ     FMWNEXT
                LDA     #$04
                BNE     FMWSUB
FMWNEXT
                LDA     #$02
FMWSUB
                JSR     FMPUT
                LDY     #$02
                LDA     #$00
                JSR     FMPUT
                INY
                JSR     FMPUT
                INY
                JSR     FMPUT
                INY
                JSR     FMPUT
                LDA     FHCHL
                SEC
                SBC     #$01
                STA     WRLENL
                LDA     FHCHH
                SBC     #$00
                STA     WRLENH
                LDY     #$06
                LDA     WRLENL
                JSR     FMPUT
                INY
                LDA     WRLENH
                JSR     FMPUT
                INY
                LDA     #<FILEBUF
                JSR     FMPUT
                INY
                LDA     #>FILEBUF
                JSR     FMPUT
                INY
                LDA     #$00
                JSR     FMPUT
                JSR     FMCOM
                LDX     #$01
                JSR     FMCALL
                BCC     FMWOK
                LDA     FMRC
                STA     CPERR
                SEC
                RTS
FMWOK
                LDA     #$00
                STA     FMFIRST
                CLC
                RTS
FMCLOSE
                LDY     #$00
                LDA     #$02
                JSR     FMPUT
                LDY     #$0A
                LDA     #$00
                JSR     FMPUT
                JSR     FMCOM
                LDX     #$01
                JSR     FMCALL
                BCC     FMCLROK
                LDA     FMRC
                STA     CPERR
                SEC
                RTS
FMCLROK
                CLC
                RTS
FMLOCK
                LDY     #$00
                LDA     #$07
                JSR     FMPUT
                LDY     #$04
                LDA     #$00
                JSR     FMPUT
                INY
                LDA     DSTDRV
                JSR     FMPUT
                INY
                LDA     DSTSLOT
                JSR     FMPUT
                INY
                LDA     FHRAW
                AND     #$7F
                JSR     FMPUT
                INY
                LDA     #<FMNAME
                JSR     FMPUT
                INY
                LDA     #>FMNAME
                JSR     FMPUT
                LDY     #$0A
                LDA     #$00
                JSR     FMPUT
                JSR     FMCOM
                LDX     #$01
                JMP     FMCALL
ABORTDS
                JSR     FMCLOSE
                JMP     FMDELETE
FMDELETE
                JSR     FMPREP
                LDY     #$00
                LDA     #$05
                JSR     FMPUT
                LDY     #$04
                LDA     #$00
                JSR     FMPUT
                INY
                LDA     DSTDRV
                JSR     FMPUT
                INY
                LDA     DSTSLOT
                JSR     FMPUT
                LDY     #$08
                LDA     #<FMNAME
                JSR     FMPUT
                INY
                LDA     #>FMNAME
                JSR     FMPUT
                LDY     #$0A
                LDA     #$00
                JSR     FMPUT
                JSR     FMCOM
                LDX     #$01
                JMP     FMCALL

;===============================================================================
; COPY STATUS AND PROGRESS
;===============================================================================

SHOWPROG
                LDA     #$00
                STA     PNUMLO
                STA     PNUMHI
                LDX     CPDONE
SPMUL
                CPX     #$00
                BEQ     SPDIV
                LDA     PNUMLO
                CLC
                ADC     #$64
                STA     PNUMLO
                LDA     PNUMHI
                ADC     #$00
                STA     PNUMHI
                DEX
                JMP     SPMUL
SPDIV
                LDA     #$00
                STA     PCTVAL
SPDLOOP
                LDA     PNUMHI
                BNE     SPDSUB
                LDA     PNUMLO
                CMP     CPTOTAL
                BCC     SPDFMT
SPDSUB
                LDA     PNUMLO
                SEC
                SBC     CPTOTAL
                STA     PNUMLO
                LDA     PNUMHI
                SBC     #$00
                STA     PNUMHI
                INC     PCTVAL
                LDA     PCTVAL
                CMP     #$64
                BCC     SPDLOOP
SPDFMT
                LDA     PCTVAL
                LDX     #$00
                CMP     #$64
                BCC     SPFTEN
                SEC
                SBC     #$64
                LDX     #$01
SPFTEN
                STX     PROGHUN
                LDX     #$00
SPTLOOP
                CMP     #$0A
                BCC     SPFONE
                SEC
                SBC     #$0A
                INX
                JMP     SPTLOOP
SPFONE
                STX     PROGTEN
                STA     PROGONE
                LDA     PROGHUN
                ORA     #$30
                STA     PROGHUN
                LDA     PROGTEN
                ORA     #$30
                STA     PROGTEN
                LDA     PROGONE
                ORA     #$30
                STA     PROGONE
                LDA     #<PROGBUF
                STA     PRLOAD+1
                LDA     #>PROGBUF
                STA     PRLOAD+2
                LDA     #STATROW
                JMP     PUTROW
SUMSTAT
                LDA     CPFAIL
                BNE     SUMFAIL
                LDA     #<CPYDONE
                STA     PRLOAD+1
                LDA     #>CPYDONE
                STA     PRLOAD+2
                JMP     SUMPUT
SUMFAIL
                LDA     #<CPYPART
                STA     PRLOAD+1
                LDA     #>CPYPART
                STA     PRLOAD+2
SUMPUT
                LDA     #STATROW
                JMP     PUTROW
SHOWERR
                LDA     CPERR
                CMP     #E_SAME
                BNE     SENOT80
                LDA     #<ERRSAME
                STA     PRLOAD+1
                LDA     #>ERRSAME
                STA     PRLOAD+2
                JMP     SEPUT
SENOT80
                CMP     #E_EXIST
                BNE     SENOT81
                LDA     #<ERREXIST
                STA     PRLOAD+1
                LDA     #>ERREXIST
                STA     PRLOAD+2
                JMP     SEPUT
SENOT81
                CMP     #E_BADHDR
                BNE     SENOT82
                LDA     #<ERRHDR
                STA     PRLOAD+1
                LDA     #>ERRHDR
                STA     PRLOAD+2
                JMP     SEPUT
SENOT82
                CMP     #E_PSEUDO
                BNE     SENOT83
                LDA     #<ERRPSEUD
                STA     PRLOAD+1
                LDA     #>ERRPSEUD
                STA     PRLOAD+2
                JMP     SEPUT
SENOT83
                CMP     #E_NOSEL
                BNE     SENOT84
                LDA     #<ERRNOSEL
                STA     PRLOAD+1
                LDA     #>ERRNOSEL
                STA     PRLOAD+2
                JMP     SEPUT
SENOT84
                CMP     #$04
                BNE     SENOT04
                LDA     #<ERRWPROT
                STA     PRLOAD+1
                LDA     #>ERRWPROT
                STA     PRLOAD+2
                JMP     SEPUT
SENOT04
                CMP     #$09
                BNE     SENOT09
                LDA     #<ERRFULL
                STA     PRLOAD+1
                LDA     #>ERRFULL
                STA     PRLOAD+2
                JMP     SEPUT
SENOT09
                CMP     #$0A
                BNE     SENOT0A
                LDA     #<ERRLOCK
                STA     PRLOAD+1
                LDA     #>ERRLOCK
                STA     PRLOAD+2
                JMP     SEPUT
SENOT0A
                CMP     #$06
                BNE     SENOT06
                LDA     #<ERRNFND
                STA     PRLOAD+1
                LDA     #>ERRNFND
                STA     PRLOAD+2
                JMP     SEPUT
SENOT06
                LDA     #<ERRIO
                STA     PRLOAD+1
                LDA     #>ERRIO
                STA     PRLOAD+2
SEPUT
                LDA     #STATROW
                JMP     PUTROW

;===============================================================================
; DOS 3.3 CATALOG LOADER
;===============================================================================
;
; LOADLFT/LOADRGT are the initialization entry points. Phase 5 can call the
; same wrappers after changing LFTSLOT/LFTDRV or RGTSLOT/RGTDRV.
;
LOADLFT
                LDA     #PNLEFT
                LDX     LFTSLOT
                LDY     LFTDRV
                JMP     CATALOG

LOADRGT
                LDA     #PNRIGHT
                LDX     RGTSLOT
                LDY     RGTDRV
                JMP     CATALOG

; Input A=pane, X=slot, Y=drive.
;
; The pane is reset before loading. Any failure is converted to one synthetic
; [CONFIG SOURCE] record so navigation always has at least one safe entry.
CATALOG
                STA     CATPANE
                STX     CATSLOT
                STY     CATDRV
                JSR     RSTPANE

                LDA     CATSLOT
                JSR     CHKSLOT
                BCC     CATROM
                LDA     #$08           ; interface initialization/signature error
                JMP     CATFAIL

CATROM
                JSR     PREPRW

                LDA     #$11           ; VTOC is track 17, sector 0
                LDX     #$00
                JSR     READSEC
                BCC     CATVTOC
                JMP     CATFAIL

CATVTOC
                LDA     SECBUF+$03
                CMP     #$03           ; DOS release byte must identify DOS 3.3
                BEQ     CATDOS3
                LDA     #$20           ; reuse mismatch class for non-DOS media
                JMP     CATFAIL

CATDOS3
                LDA     SECBUF+$06
                STA     CATVOL
                JSR     SETVOL

                LDA     SECBUF+$01      ; VTOC points to first catalog sector
                STA     CATTRK
                LDA     SECBUF+$02
                STA     CATSEC

CATNEXT
                LDA     CATTRK
                BNE     CATREAD
                JMP     CATDONE

CATREAD
                LDX     CATSEC
                JSR     READSEC
                BCC     CATSECT
                JMP     CATFAIL

CATSECT
                LDA     SECBUF+$01      ; save chain pointer before next read
                STA     NXTRK
                LDA     SECBUF+$02
                STA     NXTSEC
                LDA     #$00
                STA     ENTNUM

CATENT
                LDX     ENTNUM
                LDY     ENTOFS,X
                LDA     SECBUF,Y        ; first T/S-list track byte
                BEQ     CATDONE        ; first never-used entry ends the catalog
                CMP     #$FF
                BEQ     CATSKIP        ; $FF = deleted entry; later files may exist

                JSR     GETCNT
                CMP     #CATCAP
                BCS     CATDONE
                STA     CATIDX
                JSR     STOREN
                JSR     INCCNT

CATSKIP
                INC     ENTNUM
                LDA     ENTNUM
                CMP     #$07
                BCC     CATENT

                LDA     NXTRK
                STA     CATTRK
                LDA     NXTSEC
                STA     CATSEC
                JMP     CATNEXT

CATDONE
                JSR     GETCNT
                BNE     CATGOOD
                JSR     MKEMPTY        ; valid disk with no active file entries

CATGOOD
                LDA     #$00
                STA     CATERR
                CLC
                RTS

CATFAIL
                STA     CATERR
                JSR     MKCONFIG
                SEC
                RTS

; Reset one pane's count, scrolling state, cursor and selection map.
RSTPANE
                LDA     CATPANE
                CMP     #PNLEFT
                BNE     RSTPRGT

                LDA     #$00
                STA     LFTCNT
                STA     LEFTCUR
                STA     LFTTOP
                STA     LFTVOL
                STA     LFTOK
                LDX     #SELLAST
RSTLSEL
                STA     LFTSEL,X
                DEX
                BPL     RSTLSEL
                RTS

RSTPRGT
                LDA     #$00
                STA     RGTCNT
                STA     RGHTCUR
                STA     RGHTTOP
                STA     RGTVOL
                STA     RGTOK
                LDX     #SELLAST
RSTRSEL
                STA     RGTSEL,X
                DEX
                BPL     RSTRSEL
                RTS

GETCNT
                LDA     CATPANE
                CMP     #PNLEFT
                BNE     GETCRGT
                LDA     LFTCNT
                RTS
GETCRGT
                LDA     RGTCNT
                RTS

INCCNT
                LDA     CATPANE
                CMP     #PNLEFT
                BNE     INCCRGT
                INC     LFTCNT
                RTS
INCCRGT
                INC     RGTCNT
                RTS

SETVOL
                LDA     CATPANE
                CMP     #PNLEFT
                BNE     SETVRGT
                LDA     CATVOL
                STA     LFTVOL
                LDA     #$01
                STA     LFTOK
                RTS
SETVRGT
                LDA     CATVOL
                STA     RGTVOL
                LDA     #$01
                STA     RGTOK
                RTS

; Validate the standard Disk II interface signature used by the Monitor's own
; slot scan: Cn01=$20, Cn03=$00, Cn05=$03, Cn07=$3C.
CHKSLOT
                CMP     #$01
                BCC     CSLBAD
                CMP     #$08
                BCS     CSLBAD
                CLC
                ADC     #$C0
                STA     SROMRD+2

                LDX     #$00
CSLLOOP
                LDY     SIGOFS,X
SROMRD
                LDA     $C000,Y
                CMP     SIGVAL,X
                BNE     CSLBAD
                INX
                CPX     #$04
                BCC     CSLLOOP
                CLC
                RTS

CSLBAD
                SEC
                RTS

; Obtain DOS's existing RWTS IOB and initialize the fields that this program
; owns. The DCT pointer at offsets 6/7 is deliberately retained from DOS.
PREPRW
                JSR     GETIOB
                STY     IOBLO
                STA     IOBHI
                STY     IOBRD+1
                STY     IOBWR+1
                STA     IOBRD+2
                STA     IOBWR+2

                LDA     CATSLOT
                ASL     A
                ASL     A
                ASL     A
                ASL     A
                STA     CATS16

                LDY     #$00
                LDA     #$01
                JSR     IOBPUT         ; table type
                INY
                LDA     CATS16
                JSR     IOBPUT         ; slot * 16
                INY
                LDA     CATDRV
                JSR     IOBPUT
                INY
                LDA     #$00
                JSR     IOBPUT         ; expected volume: any

                LDY     #$08
                LDA     #<SECBUF
                JSR     IOBPUT
                INY
                LDA     #>SECBUF
                JSR     IOBPUT

                LDY     #$0B
                LDA     #$00
                JSR     IOBPUT         ; 0 means full 256-byte sector
                INY
                LDA     #$01
                JSR     IOBPUT         ; command 1 = READ
                INY
                LDA     #$00
                JSR     IOBPUT         ; clear return code

; IOB offsets $0E-$10 are input/output history fields:
; previous/current volume, slot and drive. DOS's shared IOB already owns the
; true values. Preserving them avoids unnecessary drive-change initialization.
                RTS

; Input A=track, X=sector. Output carry clear on success. On failure carry is
; set and A contains the RWTS return code when one is available.
READSEC
                STA     RDTRK
                STX     RDSEC

                LDY     #$04
                LDA     RDTRK
                JSR     IOBPUT
                INY
                LDA     RDSEC
                JSR     IOBPUT

                LDY     #$08
                LDA     #<SECBUF
                JSR     IOBPUT
                INY
                LDA     #>SECBUF
                JSR     IOBPUT

                LDY     #$0C
                LDA     #$01
                JSR     IOBPUT
                INY
                LDA     #$00
                JSR     IOBPUT

                LDY     IOBLO
                LDA     IOBHI
                JSR     RWTS
                PHP
                LDA     #$00
                STA     PSTAT          ; Beneath Apple DOS recommends clearing $48
                PLP
                BCC     RDCHK

                LDY     #$0D
                JSR     IOBGET
                BNE     RDERROR
                LDA     #$40           ; generic drive error if RWTS left zero
RDERROR
                SEC
                RTS

RDCHK
                LDY     #$0D
                JSR     IOBGET
                BEQ     RDOK
                SEC
                RTS
RDOK
                CLC
                RTS

IOBGET
IOBRD
                LDA     $FFFF,Y
                RTS

IOBPUT
IOBWR
                STA     $FFFF,Y
                RTS

; Store one active DOS catalog entry as a compact 35-byte record.
STOREN
                LDA     CATIDX
                LDX     CATPANE
                JSR     SETRECP

                LDX     ENTNUM
                LDA     ENTOFS,X
                STA     ENTOFF

                CLC
                ADC     #$02
                TAY
                LDA     SECBUF,Y
                LDY     #$00
                JSR     RECWRITE       ; raw type byte includes lock bit

                LDA     ENTOFF
                CLC
                ADC     #$21
                TAY
                LDA     SECBUF,Y
                LDY     #$01
                JSR     RECWRITE       ; allocated sectors low
                LDA     ENTOFF
                CLC
                ADC     #$22
                TAY
                LDA     SECBUF,Y
                LDY     #$02
                JSR     RECWRITE       ; allocated sectors high

                LDA     ENTOFF
                CLC
                ADC     #$03
                STA     CATNAME+1
                LDA     #>SECBUF
                STA     CATNAME+2

                LDX     #$00
STNLOOP
CATNAME
                LDA     $FFFF,X
                AND     #$7F           ; catalog names have their high bits set
                STA     CHARVAL
                TXA
                CLC
                ADC     #$03
                TAY
                LDA     CHARVAL
                JSR     RECWRITE
                INX
                CPX     #$1E           ; 30 filename characters
                BCC     STNLOOP
                LDX     ENTNUM
                LDY     ENTOFS,X
                LDA     SECBUF,Y
                LDY     #$21
                JSR     RECWRITE
                LDX     ENTNUM
                LDY     ENTOFS,X
                INY
                LDA     SECBUF,Y
                LDY     #$22
                JSR     RECWRITE
                RTS

; Synthetic entry used when the source cannot be catalogued.
MKCONFIG
                LDA     #$7F           ; pseudo type displayed as '?'
                STA     PSTYPE
                LDA     #<CFGNAME
                STA     PSLOAD+1
                LDA     #>CFGNAME
                STA     PSLOAD+2
                JMP     MKPSEUD

MKEMPTY
                LDA     #$7E           ; pseudo type displayed as '-'
                STA     PSTYPE
                LDA     #<EMPNAME
                STA     PSLOAD+1
                LDA     #>EMPNAME
                STA     PSLOAD+2

MKPSEUD
                LDA     #$00
                LDX     CATPANE
                JSR     SETRECP

                LDY     #$00
                LDA     PSTYPE
                JSR     RECWRITE
                INY
                LDA     #$00
                JSR     RECWRITE
                INY
                JSR     RECWRITE

                LDY     #$03
                LDA     #$20
PSFILL
                JSR     RECWRITE
                INY
                CPY     #RECSIZE
                BCC     PSFILL

                LDX     #$00
PSCOPY
PSLOAD
                LDA     $FFFF,X
                BEQ     PSDONE
                STA     CHARVAL
                TXA
                CLC
                ADC     #$03
                TAY
                LDA     CHARVAL
                JSR     RECWRITE
                INX
                CPX     #$1E
                BCC     PSCOPY

PSDONE
                LDA     CATPANE
                CMP     #PNLEFT
                BNE     PSRIGHT
                LDA     #$01
                STA     LFTCNT
                RTS
PSRIGHT
                LDA     #$01
                STA     RGTCNT
                RTS

; Convert absolute record index to a writable/readable address.
; offset = index*35 = index*32 + index + index + index.
SETRECP
                STA     RECIDX
                STX     RECPANE
                STA     PTRLO
                LDA     #$00
                STA     PTRHI
                LDY     #$05
RPSHIFT
                ASL     PTRLO
                ROL     PTRHI
                DEY
                BNE     RPSHIFT

                LDX     #$03
RPADD35
                LDA     PTRLO
                CLC
                ADC     RECIDX
                STA     PTRLO
                LDA     PTRHI
                ADC     #$00
                STA     PTRHI
                DEX
                BNE     RPADD35

                LDX     RECPANE
                CPX     #PNLEFT
                BNE     RPRIGHT
                LDA     PTRLO
                CLC
                ADC     #<LFTBUF
                STA     PTRLO
                LDA     PTRHI
                ADC     #>LFTBUF
                STA     PTRHI
                JMP     RPPATCH

RPRIGHT
                LDA     PTRLO
                CLC
                ADC     #<RGTBUF
                STA     PTRLO
                LDA     PTRHI
                ADC     #>RGTBUF
                STA     PTRHI

RPPATCH
                LDA     PTRLO
                STA     RECREAD+1
                STA     RECWRITE+1
                LDA     PTRHI
                STA     RECREAD+2
                STA     RECWRITE+2
                RTS

RECREAD
                LDA     $FFFF,Y
                RTS

RECWRITE
                STA     $FFFF,Y
                RTS

;===============================================================================
; LEFT-PANE INPUT AND MOVEMENT
;===============================================================================

LFTKEY
                LDA     LASTKEY
                CMP     #KEYESC
                BNE     LKLEFT
                JMP     EXITPAN

LKLEFT
                CMP     #KEYLEFT
                BNE     LKRGHT
                JSR     LFTUP
                JMP     MAIN

LKRGHT
                CMP     #KEYRGHT
                BNE     LKENTER
                JSR     LFTDOWN
                JMP     MAIN

LKENTER
                CMP     #KEYRET
                BNE     LKSPACE
                JSR     LFTRET
                JMP     MAIN

LKSPACE
                CMP     #KEYSPC
                BNE     LKOTHER
                JSR     TOGLFT

LKOTHER
                JMP     MAIN

; Move to the preceding absolute catalog index. If the cursor is already at the
; true first entry, transfer to the final entry of the right catalog. Otherwise,
; scroll only when the new cursor would be above the current 18-row window.
LFTUP
                LDA     LEFTCUR
                BNE     LFUMOVE
                JMP     LUP2RGT

LFUMOVE
                JSR     NORLFT
                DEC     LEFTCUR
                LDA     LEFTCUR
                CMP     LFTTOP
                BCS     LFUNOSC
                LDA     #PNLEFT
                LDX     #SCRUP
                JSR     SCRLPAN

LFUNOSC
                JSR     HILLFT
                JMP     LFTSTAT

; Move to the following absolute index. The cursor may pass row 19 as long as
; another catalog item exists; SCRLPAN then advances the window by one row.
LFTDOWN
                LDA     LEFTCUR
                CLC
                ADC     #$01
                CMP     LFTCNT
                BCC     LFDMOVE
                JMP     LDN2RGT

LFDMOVE
                JSR     NORLFT
                INC     LEFTCUR
                LDA     LEFTCUR
                SEC
                SBC     LFTTOP
                CMP     #VISROWS
                BCC     LFDNOSC
                LDA     #PNLEFT
                LDX     #SCRDOWN
                JSR     SCRLPAN

LFDNOSC
                JSR     HILLFT
                JMP     LFTSTAT

TOGLFT
                LDA     LEFTCUR        ; absolute index 0..104
                JSR     BITADDR
                LDA     LFTSEL,X
                EOR     SELMASK
                STA     LFTSEL,X
                JMP     HILLFT

; Return on the synthetic left placeholder starts OPENCFG at item 0.
LFTRET
                LDA     LEFTCUR
                LDX     #PNLEFT
                JSR     ISCONFIG
                CMP     #$7F
                BNE     LFRETRTS
                JSR     NORLFT
                LDA     #$01
                STA     MENUSEL
                LDA     #$00
                JSR     OPENCFG
LFRETRTS
                RTS

;===============================================================================
; RIGHT-PANE INPUT AND MOVEMENT
;===============================================================================

RGTKEY
                LDA     LASTKEY
                CMP     #KEYESC
                BNE     RKLEFT
                JMP     EXITPAN

RKLEFT
                CMP     #KEYLEFT
                BNE     RKRGHT
                JSR     RGTUP
                JMP     MAIN

RKRGHT
                CMP     #KEYRGHT
                BNE     RKENTER
                JSR     RGTDOWN
                JMP     MAIN

RKENTER
                CMP     #KEYRET
                BNE     RKSPACE
                JSR     RGTRET
                JMP     MAIN

RKSPACE
                CMP     #KEYSPC
                BNE     RKOTHER
                JSR     TOGRGT

RKOTHER
                JMP     MAIN

RGTUP
                LDA     RGHTCUR
                BNE     RGUMOVE
                JMP     RUP2LFT

RGUMOVE
                JSR     NORRGT
                DEC     RGHTCUR
                LDA     RGHTCUR
                CMP     RGHTTOP
                BCS     RGUNOSC
                LDA     #PNRIGHT
                LDX     #SCRUP
                JSR     SCRLPAN

RGUNOSC
                JSR     HILRGT
                JMP     RGTSTAT

RGTDOWN
                LDA     RGHTCUR
                CLC
                ADC     #$01
                CMP     RGTCNT
                BCC     RGDMOVE
                JMP     RDN2LFT

RGDMOVE
                JSR     NORRGT
                INC     RGHTCUR
                LDA     RGHTCUR
                SEC
                SBC     RGHTTOP
                CMP     #VISROWS
                BCC     RGDNOSC
                LDA     #PNRIGHT
                LDX     #SCRDOWN
                JSR     SCRLPAN

RGDNOSC
                JSR     HILRGT
                JMP     RGTSTAT

TOGRGT
                LDA     RGHTCUR
                JSR     BITADDR
                LDA     RGTSEL,X
                EOR     SELMASK
                STA     RGTSEL,X
                JMP     HILRGT

; Return on the synthetic right placeholder starts OPENCFG at item 3.
RGTRET
                LDA     RGHTCUR
                LDX     #PNRIGHT
                JSR     ISCONFIG
                CMP     #$7F
                BNE     RGRETRTS
                JSR     NORRGT
                LDA     #$01
                STA     MENUSEL
                LDA     #$03
                JSR     OPENCFG
RGRETRTS
                RTS

; Test whether one buffered entry is the [CONFIG SOURCE] pseudo record.
; Input A=absolute index, X=pane. Output A=raw record type.
ISCONFIG
                JSR     SETRECP
                LDY     #$00
                JMP     RECREAD

;===============================================================================
; PANE TRANSFER AT TRUE CATALOG BOUNDARIES
;===============================================================================

; Above left top -> right catalog bottom.
LUP2RGT
                JSR     NORLFT
                JSR     SETRBOT
                LDA     #PNRIGHT
                STA     MODE
                JSR     DRWRGT
                JSR     HILRGT
                JMP     RGTSTAT

; Below left bottom -> right catalog top.
LDN2RGT
                JSR     NORLFT
                LDA     #$00
                STA     RGHTCUR
                STA     RGHTTOP
                LDA     #PNRIGHT
                STA     MODE
                JSR     DRWRGT
                JSR     HILRGT
                JMP     RGTSTAT

; Above right top -> left catalog bottom.
RUP2LFT
                JSR     NORRGT
                JSR     SETLBOT
                LDA     #PNLEFT
                STA     MODE
                JSR     DRWLFT
                JSR     HILLFT
                JMP     LFTSTAT

; Below right bottom -> left catalog top.
RDN2LFT
                JSR     NORRGT
                LDA     #$00
                STA     LEFTCUR
                STA     LFTTOP
                LDA     #PNLEFT
                STA     MODE
                JSR     DRWLFT
                JSR     HILLFT
                JMP     LFTSTAT

; Position the left cursor at the last entry and choose the final full window.
SETLBOT
                LDA     LFTCNT
                SEC
                SBC     #$01
                STA     LEFTCUR
                LDA     LFTCNT
                CMP     #VISROWS
                BCC     SLBSMAL
                SEC
                SBC     #VISROWS
                STA     LFTTOP
                RTS

SLBSMAL
                LDA     #$00
                STA     LFTTOP
                RTS

SETRBOT
                LDA     RGTCNT
                SEC
                SBC     #$01
                STA     RGHTCUR
                LDA     RGTCNT
                CMP     #VISROWS
                BCC     SRBSMAL
                SEC
                SBC     #VISROWS
                STA     RGHTTOP
                RTS

SRBSMAL
                LDA     #$00
                STA     RGHTTOP
                RTS

; Escape removes only the TYPE/LOCK cursor. Selected filenames remain inverse.
EXITPAN
                LDA     MODE
                CMP     #PNLEFT
                BNE     EXRIGHT
                JSR     NORLFT
                JMP     EXMENU

EXRIGHT
                JSR     NORRGT

EXMENU
                LDA     #$00
                STA     MODE
                JSR     MNUDRAW
                JSR     MENUST
                JMP     MAIN

;===============================================================================
; GENERAL PANE-SCROLL SUBROUTINE
;===============================================================================
;
; Input:
;   A = PNLEFT or PNRIGHT
;   X = SCRUP or SCRDOWN
;
; The caller guarantees that a scroll is valid. This routine changes only the
; chosen pane's top absolute index by one and redraws only rows 2..19 of that
; pane. The opposite 20-column pane remains untouched.
;
SCRLPAN
                STA     SCRPANE
                STX     SCRDIR
                CMP     #PNLEFT
                BNE     SCRRGHT

                LDA     SCRDIR
                BNE     SCRLDN
                DEC     LFTTOP
                JMP     DRWLFT

SCRLDN
                INC     LFTTOP
                JMP     DRWLFT

SCRRGHT
                LDA     SCRDIR
                BNE     SCRRDN
                DEC     RGHTTOP
                JMP     DRWRGT

SCRRDN
                INC     RGHTTOP
                JMP     DRWRGT

;===============================================================================
; DRAW OR REDRAW ONE 17-ROW PANE WINDOW
;===============================================================================
;
; Records are formatted only when they become visible. This eliminates the
; duplicated preformatted pane strings and full 40-byte status strings used by
; the Phase 3 test data.
;
DRWLFT
                LDA     #$00
                STA     DRAWIDX

DLLLOOP
                LDA     LFTTOP
                CLC
                ADC     DRAWIDX
                STA     DRAWABS
                CMP     LFTCNT
                BCC     DLLFILE
                LDA     #$00
                STA     DRAWFILE
                JSR     CLRROWB
                JMP     DLLPUT

DLLFILE
                LDA     #$01
                STA     DRAWFILE
                LDA     DRAWABS
                LDX     #PNLEFT
                JSR     FMTREC

DLLPUT
                LDA     #<ROWBUF
                STA     SPLOAD+1
                LDA     #>ROWBUF
                STA     SPLOAD+2
                LDA     #$00
                STA     SPANCOL
                LDA     #LEFTEND
                STA     SPANLEN
                LDA     DRAWIDX
                CLC
                ADC     #PANETOP
                JSR     PUTSPAN

                LDA     DRAWFILE
                BEQ     DLLNEXT
                LDA     DRAWABS
                JSR     ISLSEL
                BEQ     DLLNEXT
                LDA     DRAWIDX
                CLC
                ADC     #PANETOP
                LDX     #$02
                LDY     #LEFTEND
                JSR     INVROW

DLLNEXT
                INC     DRAWIDX
                LDA     DRAWIDX
                CMP     #VISROWS
                BCC     DLLLOOP
                RTS

DRWRGT
                LDA     #$00
                STA     DRAWIDX

DRRLOOP
                LDA     RGHTTOP
                CLC
                ADC     DRAWIDX
                STA     DRAWABS
                CMP     RGTCNT
                BCC     DRRFILE
                LDA     #$00
                STA     DRAWFILE
                JSR     CLRROWB
                JMP     DRRPUT

DRRFILE
                LDA     #$01
                STA     DRAWFILE
                LDA     DRAWABS
                LDX     #PNRIGHT
                JSR     FMTREC

DRRPUT
                LDA     #<ROWBUF
                STA     SPLOAD+1
                LDA     #>ROWBUF
                STA     SPLOAD+2
                LDA     #RGHTCOL
                STA     SPANCOL
                LDA     #$14
                STA     SPANLEN
                LDA     DRAWIDX
                CLC
                ADC     #PANETOP
                JSR     PUTSPAN

                LDA     DRAWFILE
                BEQ     DRRNEXT
                LDA     DRAWABS
                JSR     ISRSEL
                BEQ     DRRNEXT
                LDA     DRAWIDX
                CLC
                ADC     #PANETOP
                LDX     #$16
                LDY     #RGHTEND
                JSR     INVROW

DRRNEXT
                INC     DRAWIDX
                LDA     DRAWIDX
                CMP     #VISROWS
                BCC     DRRLOOP
                RTS

; Format one compact record into ROWBUF.
; Input A=absolute catalog index, X=pane.
FMTREC
                STA     FMTIDX
                STX     FMTPANE
                JSR     CLRROWB

                LDA     FMTIDX
                LDX     FMTPANE
                JSR     SETRECP

                LDY     #$00
                JSR     RECREAD
                STA     RAWTYPE
                AND     #$7F
                JSR     TYPECHR
                STA     ROWBUF

                LDA     RAWTYPE
                BMI     FMTLOCK
                LDA     #$20
                BNE     FMTLST
FMTLOCK
                LDA     #$2A
FMTLST
                STA     ROWBUF+1

                LDA     #$12           ; both filename fields are 18 columns
                STA     NAMEW

; Scan characters beyond the visible width. Any non-space means the visible
; form must end in two dots.
                CLC
                ADC     #$03
                TAY
                LDA     #$00
                STA     NAMELONG

FMTSCAN
                CPY     #RECSIZE
                BCS     FMTCLEN
                JSR     RECREAD
                CMP     #$20
                BEQ     FMTSNEXT
                LDA     #$01
                STA     NAMELONG
                JMP     FMTCLEN
FMTSNEXT
                INY
                JMP     FMTSCAN

FMTCLEN
                LDA     NAMEW
                LDX     NAMELONG
                BEQ     FMTCOPY
                SEC
                SBC     #$02
FMTCOPY
                STA     COPYLEN
                LDX     #$00

FMTNLOOP
                CPX     COPYLEN
                BCS     FMTDOTS
                TXA
                CLC
                ADC     #$03
                TAY
                JSR     RECREAD
                STA     ROWBUF+2,X
                INX
                JMP     FMTNLOOP

FMTDOTS
                LDA     NAMELONG
                BEQ     FMTDONE
                LDX     COPYLEN
                LDA     #$2E
                STA     ROWBUF+2,X
                INX
                STA     ROWBUF+2,X
FMTDONE
                RTS

CLRROWB
                LDX     #$13           ; clear all 20 bytes, index 19..0
                LDA     #$20
CRBLOOP
                STA     ROWBUF,X
                DEX
                BPL     CRBLOOP
                RTS

; Map DOS type bits to the one-character catalog representation.
TYPECHR
                CMP     #$00
                BEQ     TYPTEXT
                CMP     #$01
                BEQ     TYPINT
                CMP     #$02
                BEQ     TYPAPP
                CMP     #$04
                BEQ     TYPBIN
                CMP     #$08
                BEQ     TYPSRC
                CMP     #$10
                BEQ     TYPREL
                CMP     #$20
                BEQ     TYPAPP
                CMP     #$40
                BEQ     TYPBIN
                CMP     #$7E
                BEQ     TYPEMPT
                LDA     #$3F
                RTS
TYPTEXT
                LDA     #$54
                RTS
TYPINT
                LDA     #$49
                RTS
TYPAPP
                LDA     #$41
                RTS
TYPBIN
                LDA     #$42
                RTS
TYPSRC
                LDA     #$53
                RTS
TYPREL
                LDA     #$52
                RTS
TYPEMPT
                LDA     #$2D
                RTS

;===============================================================================
; 128-BIT SELECTION MAP HELPERS
;===============================================================================

BITADDR
                TAY                    ; preserve absolute catalog index
                AND     #$07
                TAX
                LDA     BITMASK,X
                STA     SELMASK
                TYA
                LSR     A
                LSR     A
                LSR     A              ; byte index = absolute index / 8
                TAX
                RTS

ISLSEL
                JSR     BITADDR
                LDA     LFTSEL,X
                AND     SELMASK
                RTS

ISRSEL
                JSR     BITADDR
                LDA     RGTSEL,X
                AND     SELMASK
                RTS

CLRSEL
                LDX     #SELLAST
                LDA     #$00

CLRLOOP
                STA     LFTSEL,X
                STA     RGTSEL,X
                DEX
                BPL     CLRLOOP
                RTS

;===============================================================================
; CURSOR AND PERSISTENT-SELECTION VIDEO HELPERS
;===============================================================================

; Compute current left visible screen row as LEFTCUR-LFTTOP+PANETOP.
HILLFT
                LDA     LEFTCUR
                SEC
                SBC     LFTTOP
                CLC
                ADC     #PANETOP
                LDX     #$00
                LDY     #$02
                JSR     INVROW
                JMP     PNTLFT

NORLFT
                LDA     LEFTCUR
                SEC
                SBC     LFTTOP
                CLC
                ADC     #PANETOP
                LDX     #$00
                LDY     #$02
                JSR     NORROW
                JMP     PNTLFT

PNTLFT
                LDA     LEFTCUR
                JSR     ISLSEL
                BEQ     PNLNORM

PNLINV
                LDA     LEFTCUR
                SEC
                SBC     LFTTOP
                CLC
                ADC     #PANETOP
                LDX     #$02
                LDY     #LEFTEND
                JMP     INVROW

PNLNORM
                LDA     LEFTCUR
                SEC
                SBC     LFTTOP
                CLC
                ADC     #PANETOP
                LDX     #$02
                LDY     #LEFTEND
                JMP     NORROW

HILRGT
                LDA     RGHTCUR
                SEC
                SBC     RGHTTOP
                CLC
                ADC     #PANETOP
                LDX     #RGHTCOL
                LDY     #$16
                JSR     INVROW
                JMP     PNTRGT

NORRGT
                LDA     RGHTCUR
                SEC
                SBC     RGHTTOP
                CLC
                ADC     #PANETOP
                LDX     #RGHTCOL
                LDY     #$16
                JSR     NORROW
                JMP     PNTRGT

PNTRGT
                LDA     RGHTCUR
                JSR     ISRSEL
                BEQ     PNRNORM

PNRINV
                LDA     RGHTCUR
                SEC
                SBC     RGHTTOP
                CLC
                ADC     #PANETOP
                LDX     #$16
                LDY     #RGHTEND
                JMP     INVROW

PNRNORM
                LDA     RGHTCUR
                SEC
                SBC     RGHTTOP
                CLC
                ADC     #PANETOP
                LDX     #$16
                LDY     #RGHTEND
                JMP     NORROW

;===============================================================================
; MENU AND STATUS-LINE RENDERING
;===============================================================================

MNUDRAW
                LDA     #<LINE20
                STA     PRLOAD+1
                LDA     #>LINE20
                STA     PRLOAD+2
                LDA     #MENUROW
                JSR     PUTROW

                LDX     MENUSEL
                LDA     MNEND,X
                TAY
                LDA     MNSTART,X
                TAX
                LDA     #MENUROW
                JMP     INVROW

NORMENU
                LDA     #<LINE20
                STA     PRLOAD+1
                LDA     #>LINE20
                STA     PRLOAD+2
                LDA     #MENUROW
                JMP     PUTROW

MENUST
                LDX     MENUSEL
                LDA     MSTLO,X
                STA     PRLOAD+1
                LDA     MSTHI,X
                STA     PRLOAD+2
                LDA     #STATROW
                JMP     PUTROW

NIMPST
                LDA     MENUSEL
                SEC
                SBC     #$03
                TAX
                LDA     NIMLO,X
                STA     PRLOAD+1
                LDA     NIMHI,X
                STA     PRLOAD+2
                LDA     #STATROW
                JMP     PUTROW

LFTSTAT
                LDA     LEFTCUR
                LDX     #PNLEFT
                JSR     BLDSTAT
                JMP     PUTSTAT

RGTSTAT
                LDA     RGHTCUR
                LDX     #PNRIGHT
                JSR     BLDSTAT

PUTSTAT
                LDA     #<STATBUF
                STA     PRLOAD+1
                LDA     #>STATBUF
                STA     PRLOAD+2
                LDA     #STATROW
                JMP     PUTROW

; Build 30 filename columns followed by a right-aligned 9-character sector field.
BLDSTAT
                STA     FMTIDX
                STX     FMTPANE

                LDX     #$27
                LDA     #$20
BSTCLEAR
                STA     STATBUF,X
                DEX
                BPL     BSTCLEAR

                LDA     FMTIDX
                LDX     FMTPANE
                JSR     SETRECP

                LDX     #$00
BSTNAME
                TXA
                CLC
                ADC     #$03
                TAY
                JSR     RECREAD
                STA     STATBUF,X
                INX
                CPX     #$1E
                BCC     BSTNAME

                LDY     #$01
                JSR     RECREAD
                STA     NUMLO
                INY
                JSR     RECREAD
                STA     NUMHI
                JMP     FMTSECT

; Convert the complete 16-bit allocated-sector count to five decimal positions.
; The last four field characters are always " SEC".
FMTSECT
                LDA     #$20
                LDX     #$04
FSCLEAR
                STA     STATNUM,X
                DEX
                BPL     FSCLEAR

                LDA     #$20
                STA     STATSP0
                LDA     #$53
                STA     STATLET
                LDA     #$45
                STA     STATE
                LDA     #$43
                STA     STATC

                LDA     #$00
                STA     DIGIDX
                STA     LEAD

FSDIGIT
                LDA     #$00
                STA     DIGVAL

FSSUB
                LDX     DIGIDX
                LDA     NUMHI
                CMP     DIVHI,X
                BCC     FSNOMOR
                BNE     FSDOSUB
                LDA     NUMLO
                CMP     DIVLO,X
                BCC     FSNOMOR

FSDOSUB
                LDA     NUMLO
                SEC
                SBC     DIVLO,X
                STA     NUMLO
                LDA     NUMHI
                SBC     DIVHI,X
                STA     NUMHI
                INC     DIGVAL
                LDA     DIGVAL
                CMP     #$0A
                BCC     FSSUB
                LDA     #$09
                STA     DIGVAL
                JMP     FSNOMOR

FSNOMOR
                LDA     DIGVAL
                BNE     FSEMIT
                LDA     LEAD
                BNE     FSZERO
                LDX     DIGIDX
                CPX     #$04
                BEQ     FSZERO
                LDA     #$20
                JMP     FSSTORE

FSZERO
                LDA     #$00
FSEMIT
                LDX     #$01
                STX     LEAD
                CLC
                ADC     #$30

FSSTORE
                LDX     DIGIDX
                STA     STATNUM,X
                INC     DIGIDX
                LDA     DIGIDX
                CMP     #$05
                BCC     FSDIGIT
                RTS

;===============================================================================
; FIXED-SCREEN AND GENERIC TEXT RENDERERS
;===============================================================================

DRAWSC
                LDX     #$00

DRROW
                LDA     ROWLO,X
                STA     STCHAR+1
                LDA     ROWHI,X
                STA     STCHAR+2
                LDA     TXLO,X
                STA     LDCHAR+1
                LDA     TXHI,X
                STA     LDCHAR+2
                LDY     #$00

DRCOL
LDCHAR
                LDA     $FFFF,Y
                ORA     #$80
STCHAR
                STA     $FFFF,Y
                INY
                CPY     #COLCOUNT
                BCC     DRCOL
                INX
                CPX     #ROWCOUNT
                BCC     DRROW
                RTS

; PUTROW copies one 40-character source line to logical screen row A.
PUTROW
                JSR     SETROW
                LDY     #$00

PRLOOP
PRLOAD
                LDA     $FFFF,Y
                ORA     #$80
PRSTORE
                STA     $FFFF,Y
                INY
                CPY     #COLCOUNT
                BCC     PRLOOP
                RTS

; PUTSPAN copies SPANLEN characters to logical row A, starting at SPANCOL.
; The caller patches SPLOAD to the source string before calling.
PUTSPAN
                JSR     SETSPAN
                LDY     #$00

SPLLOOP
SPLOAD
                LDA     $FFFF,Y
                ORA     #$80
SPSTORE
                STA     $FFFF,Y
                INY
                CPY     SPANLEN
                BCC     SPLLOOP
                RTS

SETSPAN
                TAX
                LDA     ROWLO,X
                CLC
                ADC     SPANCOL
                STA     SPSTORE+1
                LDA     ROWHI,X
                ADC     #$00
                STA     SPSTORE+2
                RTS

SETROW
                TAX
                LDA     ROWLO,X
                STA     PRSTORE+1
                STA     HMLOAD+1
                STA     HMSTORE+1
                LDA     ROWHI,X
                STA     PRSTORE+2
                STA     HMLOAD+2
                STA     HMSTORE+2
                RTS

; INVROW/NORROW input: A=row, X=first column, Y=exclusive end column.
INVROW
                STA     STYROW
                STX     STYCOL
                STY     STYEND
                LDA     #$00
                STA     STYMODE
                JMP     STYEXEC

NORROW
                STA     STYROW
                STX     STYCOL
                STY     STYEND
                LDA     #$01
                STA     STYMODE

STYEXEC
                LDA     STYROW
                JSR     SETROW
                LDY     STYCOL

STYLOOP
HMLOAD
                LDA     $FFFF,Y
                LDX     STYMODE
                BNE     STYNORM
                AND     #$3F
                JMP     STYSAVE

STYNORM
                ORA     #$80

STYSAVE
HMSTORE
                STA     $FFFF,Y
                INY
                CPY     STYEND
                BCC     STYLOOP
                RTS

;===============================================================================
; RUNTIME STATE
;===============================================================================

WORKBEG
MODE            .BYTE   $00
MENUSEL         .BYTE   $00
LEFTCUR         .BYTE   $00            ; absolute catalog index
RGHTCUR         .BYTE   $00
LFTTOP          .BYTE   $00            ; index shown on screen row 2
RGHTTOP         .BYTE   $00
LFTCNT          .BYTE   $00
RGTCNT          .BYTE   $00
LFTSLOT         .BYTE   $06
LFTDRV          .BYTE   $01
RGTSLOT         .BYTE   $06
RGTDRV          .BYTE   $02
LFTVOL          .BYTE   $00
RGTVOL          .BYTE   $00
LFTOK           .BYTE   $00
RGTOK           .BYTE   $00

LASTKEY         .BYTE   $00
SCRPANE         .BYTE   $00
SCRDIR          .BYTE   $00
DRAWIDX         .BYTE   $00
DRAWABS         .BYTE   $00
DRAWFILE        .BYTE   $00
SPANCOL         .BYTE   $00
SPANLEN         .BYTE   $00
SELMASK         .BYTE   $00
STYROW          .BYTE   $00
STYCOL          .BYTE   $00
STYEND          .BYTE   $00
STYMODE         .BYTE   $00

CATPANE         .BYTE   $00
CATSLOT         .BYTE   $00
CATDRV          .BYTE   $00
CATS16          .BYTE   $00
CATVOL          .BYTE   $00
CATERR          .BYTE   $00
CATTRK          .BYTE   $00
CATSEC          .BYTE   $00
NXTRK           .BYTE   $00
NXTSEC          .BYTE   $00
ENTNUM          .BYTE   $00
ENTOFF          .BYTE   $00
CATIDX          .BYTE   $00
RDTRK           .BYTE   $00
RDSEC           .BYTE   $00
IOBLO           .BYTE   $00
IOBHI           .BYTE   $00

RECIDX          .BYTE   $00
RECPANE         .BYTE   $00
PTRLO           .BYTE   $00
PTRHI           .BYTE   $00
CHARVAL         .BYTE   $00
PSTYPE          .BYTE   $00
FMTIDX          .BYTE   $00
FMTPANE         .BYTE   $00
RAWTYPE         .BYTE   $00
NAMEW           .BYTE   $00
NAMELONG        .BYTE   $00
COPYLEN         .BYTE   $00
NUMLO           .BYTE   $00
NUMHI           .BYTE   $00
DIGIDX          .BYTE   $00
DIGVAL          .BYTE   $00
LEAD            .BYTE   $00
DRVSEL          .BYTE   $00
VOLOFF          .BYTE   $00
VWORK           .BYTE   $00
VDIG            .BYTE   $00
SWPPAGE         .BYTE   $00
SWPTMP          .BYTE   $00
CPSPANE         .BYTE   $00
CPDPANE         .BYTE   $00
CPINDEX         .BYTE   $00
CPLIMIT         .BYTE   $00
CPLCNT          .BYTE   $00
CPRCNT          .BYTE   $00
CPTOTAL         .BYTE   $00
CPDONE          .BYTE   $00
CPFAIL          .BYTE   $00
CPERR           .BYTE   $00
CLRMASK         .BYTE   $00
DSTSLOT         .BYTE   $00
DSTDRV          .BYTE   $00
TSLTRK          .BYTE   $00
TSLSEC          .BYTE   $00
TSLIDX          .BYTE   $00
TSLGUARD        .BYTE   $00
BASELO          .BYTE   $00
BASEHI          .BYTE   $00
MAXLO           .BYTE   $00
MAXHI           .BYTE   $00
CANDLO          .BYTE   $00
CANDHI          .BYTE   $00
RDTSLT          .BYTE   $00
RDTSLS          .BYTE   $00
RDNXTTR         .BYTE   $00
RDNXTS          .BYTE   $00
RDPAIR          .BYTE   $00
RDLOAD          .BYTE   $00
DATATRK         .BYTE   $00
DATASEC         .BYTE   $00
SECTCNT         .BYTE   $00
CHKPTRH         .BYTE   $00
CRCREML         .BYTE   $00
CRCREMH         .BYTE   $00
CRCPTRH         .BYTE   $00
CRCFLAG         .BYTE   $00
EXADD           .BYTE   $00
EXCT0           .BYTE   $00
EXCT1           .BYTE   $00
EXCT2           .BYTE   $00
FMLO            .BYTE   $00
FMHI            .BYTE   $00
FMRC            .BYTE   $00
FMFIRST         .BYTE   $00
WRLENL          .BYTE   $00
WRLENH          .BYTE   $00
PNUMLO          .BYTE   $00
PNUMHI          .BYTE   $00
PCTVAL          .BYTE   $00
WORKEND

LFTSEL          .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
RGTSEL          .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
CPLSEL          .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
CPRSEL          .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00

FHBEG
FHRAW           .BYTE   $00
FHSECLO         .BYTE   $00
FHSECHI         .BYTE   $00
FHTSLT          .BYTE   $00
FHTSLS          .BYTE   $00
FHLOADL         .BYTE   $00
FHLOADH         .BYTE   $00
FHLENL          .BYTE   $00
FHLENH          .BYTE   $00
FHSRCL          .BYTE   $00
FHSRCH          .BYTE   $00
FHLOGLO         .BYTE   $00
FHLOGHI         .BYTE   $00
FHTOT0          .BYTE   $00
FHTOT1          .BYTE   $00
FHTOT2          .BYTE   $00
FHREM0          .BYTE   $00
FHREM1          .BYTE   $00
FHREM2          .BYTE   $00
FHCHL           .BYTE   $00
FHCHH           .BYTE   $00
FHCRCLO         .BYTE   $00
FHCRCHI         .BYTE   $00
FHCRCNT         .BYTE   $00
FHNAME          .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20
FHCRCTB          .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00,$00,$00
                .BYTE   $00,$00,$00,$00,$00,$00
FHEND
FMNAME          .BYTE   $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
                .BYTE   $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
                .BYTE   $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
                .BYTE   $A0,$A0,$A0,$A0,$A0,$A0

ROWBUF          .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20

; Contiguous 40-byte status row:
;   0..29 filename, 30 separator, 31..35 decimal sectors, 36..39 " SEC".
STATBUF         .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20,$20,$20
                .BYTE   $20,$20,$20,$20,$20,$20
STATGAP         .BYTE   $20
STATNUM         .BYTE   $20,$20,$20,$20,$20
STATSP0         .BYTE   $20
STATLET         .BYTE   $53
STATE           .BYTE   $45
STATC           .BYTE   $43

BITMASK         .BYTE   $01,$02,$04,$08,$10,$20,$40,$80
DIVLO           .BYTE   $10,$E8,$64,$0A,$01
DIVHI           .BYTE   $27,$03,$00,$00,$00
ENTOFS          .BYTE   $0B,$2E,$51,$74,$97,$BA,$DD
SIGOFS          .BYTE   $01,$03,$05,$07
SIGVAL          .BYTE   $20,$00,$03,$3C

;===============================================================================
; APPLE II TEXT PAGE 1 ROW ADDRESS TABLE
;===============================================================================

ROWLO
                .BYTE   $00,$80,$00,$80,$00,$80,$00,$80
                .BYTE   $28,$A8,$28,$A8,$28,$A8,$28,$A8
                .BYTE   $50,$D0,$50,$D0,$50,$D0,$50,$D0

ROWHI
                .BYTE   $04,$04,$05,$05,$06,$06,$07,$07
                .BYTE   $04,$04,$05,$05,$06,$06,$07,$07
                .BYTE   $04,$04,$05,$05,$06,$06,$07,$07

;===============================================================================
; STATIC SCREEN ROW POINTERS
;===============================================================================

TXLO
                .BYTE   <LINE00,<LINE01,<LINE02,<LINE03
                .BYTE   <LINE04,<LINE05,<LINE06,<LINE07
                .BYTE   <LINE08,<LINE09,<LINE10,<LINE11
                .BYTE   <LINE12,<LINE13,<LINE14,<LINE15
                .BYTE   <LINE16,<LINE17,<LINE18,<LINE19
                .BYTE   <LINE20,<LINE21,<LINE22,<LINE23

TXHI
                .BYTE   >LINE00,>LINE01,>LINE02,>LINE03
                .BYTE   >LINE04,>LINE05,>LINE06,>LINE07
                .BYTE   >LINE08,>LINE09,>LINE10,>LINE11
                .BYTE   >LINE12,>LINE13,>LINE14,>LINE15
                .BYTE   >LINE16,>LINE17,>LINE18,>LINE19
                .BYTE   >LINE20,>LINE21,>LINE22,>LINE23

MNSTART
                .BYTE   $00,$05,$0A,$0F,$14,$19
MNEND
                .BYTE   $03,$08,$0D,$12,$17,$1C

; Header item ranges: Sx, Dx, <->, Sx, Dx.
DRVST
                .BYTE   $00,$03,$12,$1D,$20
DRVEND
                .BYTE   $02,$05,$15,$1F,$22

;===============================================================================
; MENU POINTER TABLES AND STATIC UI DATA
;===============================================================================

MSTLO
                .BYTE   <MST00,<MST01,<MST02,<MST03,<MST04,<MST05
MSTHI
                .BYTE   >MST00,>MST01,>MST02,>MST03,>MST04,>MST05

NIMLO
                .BYTE   <NIM00,<NIM01
NIMHI
                .BYTE   >NIM00,>NIM01

CFGNAME         ASC     "[CONFIG SOURCE]"
                .BYTE   $00
EMPNAME         ASC     "[EMPTY CATALOG]"
                .BYTE   $00

; Mutable 40-byte header buffer. Volume bytes are not selectable menu items.
HDRBUF          ASC     "S"
HDRLSNO         .BYTE   $30
                ASC     ",D"
HDRLDNO         .BYTE   $31
                ASC     " V"
HDRLV0          ASC     "---"
                ASC     "        "
HDRSWAP         ASC     "<->"
                ASC     "        S"
HDRRSNO         .BYTE   $30
                ASC     ",D"
HDRRDNO         .BYTE   $32
                ASC     " V"
HDRRV0          ASC     "---"
                ASC     " "

; Static screen rows. Rows 2..19 start blank and are provisioned from the
; two equal 20-column catalog buffers. Row 20 is both separator and menu.
LINE00          ASC     "S6,D1 V---        <->        S6,D2 V--- "
LINE01          ASC     "----------------------------------------"
LINE02          ASC     "                                        "
LINE03          ASC     "                                        "
LINE04          ASC     "                                        "
LINE05          ASC     "                                        "
LINE06          ASC     "                                        "
LINE07          ASC     "                                        "
LINE08          ASC     "                                        "
LINE09          ASC     "                                        "
LINE10          ASC     "                                        "
LINE11          ASC     "                                        "
LINE12          ASC     "                                        "
LINE13          ASC     "                                        "
LINE14          ASC     "                                        "
LINE15          ASC     "                                        "
LINE16          ASC     "                                        "
LINE17          ASC     "                                        "
LINE18          ASC     "                                        "
LINE19          ASC     "                                        "
LINE20          ASC     "SEL--DRV--CPY--MOV--DEL--[Q]------------"
LINE21          ASC     "LEFT/RIGHT: MOVE   SPACE: SELECT        "
LINE22          ASC     "AT WINDOW EDGE: SCROLL   ESC=MENU       "
LINE23          ASC     "                                        "

MST00           ASC     "SEL: SELECT FILES, START IN LEFT PANE   "
MST01           ASC     "DRV: CHANGE SLOT AND DRIVE SETTINGS     "
MST02           ASC     "CPY: COPY SELECTED FILES BOTH WAYS      "
MST03           ASC     "MOV: MOVE SELECTED FILES BOTH WAYS      "
MST04           ASC     "DEL: DELETE ALL SELECTED FILES          "
MST05           ASC     "[Q]: RETURN TO APPLESOFT BASIC          "

NIM00           ASC     "MOV IS RESERVED FOR A LATER PHASE       "
NIM01           ASC     "DEL IS RESERVED FOR A LATER PHASE       "

CPYDONE         ASC     "COPY COMPLETE                           "
CPYPART         ASC     "COPY ENDED; FAILED FILES STAY SELECTED  "
ERRSAME         ASC     "COPY ERROR: SOURCE AND DEST ARE SAME    "
ERREXIST        ASC     "COPY ERROR: DESTINATION FILE EXISTS     "
ERRHDR          ASC     "COPY ERROR: INVALID FILE HEADER OR T/S  "
ERRPSEUD        ASC     "COPY ERROR: CONFIG/EMPTY ENTRY NOT FILE "
ERRNOSEL        ASC     "COPY: NO FILES ARE SELECTED             "
ERRWPROT        ASC     "COPY ERROR: DESTINATION WRITE PROTECTED "
ERRFULL         ASC     "COPY ERROR: DESTINATION DISK FULL       "
ERRLOCK         ASC     "COPY ERROR: FILE IS LOCKED              "
ERRNFND         ASC     "COPY ERROR: SOURCE FILE NOT FOUND       "
ERRIO           ASC     "COPY ERROR: DISK OR FILE MANAGER I/O    "

PROGBUF         ASC     "PROGRESS: "
PROGHUN         .BYTE   $30
PROGTEN         .BYTE   $30
PROGONE         .BYTE   $30
                ASC     "% FILE COPIED              "

DRVHELP         ASC     "LEFT/RIGHT MOVE SPACE CYCLE RET SWAP ESC"

;===============================================================================
; END OF PHASE 4
;===============================================================================
