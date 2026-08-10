; ============================================================================
; PRONTO_SCROLL V0.2.1
; Apple II / II+ + DOS 3.3 / ProntoDOS resident text scrollback experiment
;
; BRUN load address: $8000
;
; USER INTERFACE
;   Normal Apple II editing is unchanged.
;   When the cursor is already on row 0:
;       ESC I   enter scrollback (one line older)
;
;   While viewing scrollback:
;       I       one line older
;       M       one line newer
;       ESC     return immediately to the live screen
;       M at the newest historical position also returns to live screen
;
; MEMORY RESERVED
;   $0800-$0BE7   25 x 40-byte history ring (TEXT page 2 RAM)
;   $0BE8-$0BFF   unused
;   $0C01-...     Applesoft program text (relocated from $0801)
;   $7C00-$7FBF   24 x 40-byte live-screen backup (linear)
;   $8000-...     resident patch code
;
; Applesoft HIMEM is lowered to $7C00 to protect backup + resident code.
;
; IMPORTANT V0.2.1 LIMITATIONS
;   - Run from the Applesoft immediate prompt; installation deliberately NEWs
;     the in-memory BASIC program by relocating TXTTAB to $0C01.
;   - 40-column, full-screen TEXT page 1 only.
;   - Keyboard and screen are the underlying devices; IN#/PR# are not preserved.
;   - Do not increase MAXFILES enough to move DOS buffers down into $8000+.
;   - FP/INT, a BASIC cold start, or software that rewrites DOS I/O hooks can
;     invalidate the installation.
; ============================================================================

                ORG $8000

; ----------------------------------------------------------------------------
; Apple II monitor / Applesoft zero-page variables
; ----------------------------------------------------------------------------

WNDLFT          = $20
WNDWDTH         = $21
WNDTOP          = $22
WNDBTM          = $23
CH              = $24
CV              = $25

CSWL            = $36
CSWH            = $37
KSWL            = $38
KSWH            = $39

TXTTAB          = $67           ; Applesoft program start pointer
VARTAB          = $69           ; simple-variable table start
ARYTAB          = $6B           ; array table start
STREND          = $6D           ; end of arrays
FRETOP          = $6F           ; top of string space
MEMSIZ          = $73           ; Applesoft HIMEM / highest usable byte + 1
CURLIN          = $75           ; current BASIC line; high byte $FF = direct mode
DATPTR          = $7D           ; DATA pointer
PRGEND          = $AF           ; program-end pointer
LOCK            = $D6           ; Applesoft program protection flag
ERRFLG          = $D8           ; ONERR/error state

; ----------------------------------------------------------------------------
; DOS / Monitor entry points
; ----------------------------------------------------------------------------

DOSWARM         = $03D0         ; DOS-compatible warm start vector
DOSHOOK         = $03EA         ; DOS INITIOHK vector

KEYIN           = $FD1B         ; Monitor KEYIN; requires RDKEY entry context
COUT1           = $FDF0         ; true 40-column screen output (does not use CSW)
KBD             = $C000         ; keyboard data / strobe high bit
KBDSTRB         = $C010         ; clear keyboard strobe

; ----------------------------------------------------------------------------
; Reserved memory
; ----------------------------------------------------------------------------

HISTORY         = $0800
BASICSTART      = $0C01
LIVEBACK        = $7C00
BASICHIMEM      = $7C00

HISTLINES       = 25
SCREENLINES     = 24
LINELEN         = 40

; ============================================================================
; INSTALL
; ============================================================================

INSTALL:
                ; ------------------------------------------------------------
                ; Reset resident state.
                ; ------------------------------------------------------------

                LDA #$00
                STA NEXTSLOT
                STA VALIDLINES
                STA ESCMODE
                STA VIEWDEPTH

                ; ------------------------------------------------------------
                ; Reserve TEXT page 2 by moving an EMPTY Applesoft program to
                ; $0C01.  Applesoft NEW uses VARTAB = TXTTAB + 3, therefore
                ; an empty program beginning at $0C01 has VARTAB/PRGEND=$0C04.
                ;
                ; V0.2.1 intentionally discards any BASIC program resident
                ; before BRUN.
                ; ------------------------------------------------------------

                LDA #$00
                STA $0C00       ; byte immediately before TXTTAB
                STA $0C01       ; empty-program link low
                STA $0C02       ; empty-program link high
                STA $0C03       ; unused gap before VARTAB; keep deterministic

                LDA #<BASICSTART
                STA TXTTAB
                LDA #>BASICSTART
                STA TXTTAB+1

                ; Applesoft NEW normally leaves VARTAB/PRGEND at TXTTAB+3.
                LDA #<$0C04
                STA VARTAB
                STA ARYTAB
                STA STREND
                STA PRGEND
                LDA #>$0C04
                STA VARTAB+1
                STA ARYTAB+1
                STA STREND+1
                STA PRGEND+1

                ; RESTORE on an empty program conceptually points DATA at TXTTAB.
                LDA #<BASICSTART
                STA DATPTR
                LDA #>BASICSTART
                STA DATPTR+1

                ; Make the eventual Applesoft warm restart unambiguously direct.
                LDA #$FF
                STA CURLIN+1
                LDA #$00
                STA LOCK
                STA ERRFLG

                ; Protect LIVEBACK and this resident patch from Applesoft.
                LDA #<BASICHIMEM
                STA FRETOP
                STA MEMSIZ
                LDA #>BASICHIMEM
                STA FRETOP+1
                STA MEMSIZ+1

                ; ------------------------------------------------------------
                ; Install BOTH true I/O handlers in one DOS INITIOHK call.
                ; DOS/ProntoDOS will save SCIN/SCROUT as the true devices and
                ; put its own command interceptors back into KSW/CSW.
                ; ------------------------------------------------------------

                LDA #<SCROUT
                STA CSWL
                LDA #>SCROUT
                STA CSWH

                LDA #<SCIN
                STA KSWL
                LDA #>SCIN
                STA KSWH

                JSR DOSHOOK

                ; We are deliberately abandoning BRUN's synthetic return path.
                ; Do not carry BRUN/DOS parser stack frames into Applesoft.
                ; Start with a clean high stack, then let DOSWARM reset its
                ; command/I/O state and dispatch to the active BASIC warm start.
                LDX #$F8
                TXS
                JMP DOSWARM

; ============================================================================
; SCROUT
;
; DOS/ProntoDOS calls this as its underlying output routine.
; When a full-screen operation is about to scroll row 0 off TEXT page 1,
; copy that 40-byte row into the 25-line circular history buffer, then pass
; the original character to COUT1.
; ============================================================================

SCROUT:
                STA OUTCHAR
                PHP
                TXA
                PHA
                TYA
                PHA

                ; Only support the normal 40 x 24 full-screen text window.
                LDA WNDLFT
                BEQ SC_W1
                JMP SC_PASS
SC_W1:
                LDA WNDTOP
                BEQ SC_W2
                JMP SC_PASS
SC_W2:
                LDA WNDWDTH
                CMP #40
                BEQ SC_W3
                JMP SC_PASS
SC_W3:
                LDA WNDBTM
                CMP #24
                BEQ SC_W4
                JMP SC_PASS
SC_W4:
                LDA CV
                CMP #23
                BEQ SC_CHECKCHAR
                JMP SC_PASS

SC_CHECKCHAR:
                LDA OUTCHAR
                AND #$7F

                CMP #$0D        ; CR on bottom row scrolls
                BEQ SC_SAVE

                CMP #$0A        ; LF on bottom row scrolls
                BEQ SC_SAVE

                CMP #$20        ; other control character
                BCS SC_PRINTABLE
                JMP SC_PASS

SC_PRINTABLE:
                LDA CH
                CMP #39         ; printable in last column wraps + scrolls
                BEQ SC_SAVE
                JMP SC_PASS

SC_SAVE:
                ; Destination = HISTORY + NEXTSLOT * 40.
                LDX NEXTSLOT
                LDA HISTLO,X
                STA SC_HISTDST+1
                LDA HISTHI,X
                STA SC_HISTDST+2

                LDY #39
SC_COPYTOP:
                LDA $0400,Y
SC_HISTDST:
                STA $FFFF,Y
                DEY
                BPL SC_COPYTOP

                ; valid line count saturates at 25.
                LDA VALIDLINES
                CMP #HISTLINES
                BCS SC_COUNTOK
                INC VALIDLINES
SC_COUNTOK:

                ; Advance circular write slot.
                INC NEXTSLOT
                LDA NEXTSLOT
                CMP #HISTLINES
                BCC SC_PASS
                LDA #$00
                STA NEXTSLOT

SC_PASS:
                PLA
                TAY
                PLA
                TAX
                PLP
                LDA OUTCHAR
                JMP COUT1

; ============================================================================
; SCIN
;
; DOS/ProntoDOS calls this as its underlying input routine.
;
; Apple II+ Autostart Monitor ESC cursor movement is persistent: after ESC,
; repeated I/J/K/M keys are fetched without another ESC.  ESCMODE therefore
; remains set while those four cursor-diamond keys are returned.
;
; When an I arrives while ESCMODE is active and CV is already row 0, the
; viewer opens.  On viewer exit we return ESC ($9B) to the Monitor so its
; internal persistent ESC loop terminates cleanly without moving the cursor.
; ============================================================================

SCIN:
                ; RDKEY enters the true input hook with:
                ;   A = character hidden by the flashing cursor
                ;   Y = CH (cursor column)
                ; KEYIN needs those values intact so it can restore the screen.
                STX SAVEX
                STY SAVEY

                JSR KEYIN
                STA INCHAR

                ; A newly typed ESC starts/refreshes persistent ESC mode.
                LDA INCHAR
                AND #$7F
                CMP #$1B
                BNE SI_NOT_ESC
                LDA #$01
                STA ESCMODE
                JMP SI_RETURN

SI_NOT_ESC:
                LDA ESCMODE
                BEQ SI_RETURN

                ; While the Apple II+ Monitor remains in its ESC cursor loop,
                ; I/J/K/M keep that mode alive.  Any other key terminates it.
                LDA INCHAR
                AND #$7F

                CMP #$49        ; I = cursor up
                BEQ SI_ESC_I

                CMP #$4A        ; J = cursor left
                BEQ SI_RETURN

                CMP #$4B        ; K = cursor right
                BEQ SI_RETURN

                CMP #$4D        ; M = cursor down
                BEQ SI_RETURN

                LDA #$00
                STA ESCMODE
                JMP SI_RETURN

SI_ESC_I:
                ; Keep ESCMODE set.  If I can still move the cursor upward,
                ; let the Monitor do its normal job.
                LDA CV
                BNE SI_RETURN

                ; Viewer assumes whole 40x24 page 1.
                LDA WNDLFT
                BNE SI_RETURN
                LDA WNDTOP
                BNE SI_RETURN
                LDA WNDWDTH
                CMP #40
                BNE SI_RETURN
                LDA WNDBTM
                CMP #24
                BNE SI_RETURN

                ; No line has scrolled off since installation yet.
                LDA VALIDLINES
                BEQ SI_RETURN

                JSR ENTER_VIEW

                ; The viewer consumed its own I/M/ESC navigation.  Feed a
                ; harmless ESC back to the Monitor so LFBA5 exits its persistent
                ; cursor loop instead of immediately asking for another I/J/K/M.
                LDA #$00
                STA ESCMODE
                LDA #$9B
                STA INCHAR

SI_RETURN:
                LDX SAVEX
                LDY SAVEY
                LDA INCHAR
                RTS

; ============================================================================
; ENTER_VIEW
;
; The live page-1 screen is saved as 24 linear 40-byte rows at $7C00.
; VIEWDEPTH=1 means one line older than the live view.
;
; Viewer keys are read from RAWKEY ($C000/$C010), so they are consumed here
; and do not recurse through DOS/KSW or depend on Monitor RDKEY cursor state.
; ============================================================================

ENTER_VIEW:
                JSR SAVE_LIVE

                LDA #$01
                STA VIEWDEPTH
                JSR RENDER_VIEW

EV_WAIT:
                JSR RAWKEY
                AND #$7F

                CMP #$1B        ; ESC = immediate exit
                BEQ EV_EXIT

                CMP #$49        ; I = older / upward
                BEQ EV_OLDER

                CMP #$4D        ; M = newer / downward
                BEQ EV_NEWER

                JMP EV_WAIT     ; ignore all other keys in viewer

EV_OLDER:
                LDA VIEWDEPTH
                CMP VALIDLINES
                BCS EV_WAIT     ; already at oldest possible view
                INC VIEWDEPTH
                JSR RENDER_VIEW
                JMP EV_WAIT

EV_NEWER:
                LDA VIEWDEPTH
                CMP #$01
                BEQ EV_EXIT     ; next step down is the live screen
                DEC VIEWDEPTH
                JSR RENDER_VIEW
                JMP EV_WAIT

EV_EXIT:
                JSR RESTORE_LIVE
                RTS

; ============================================================================
; RAWKEY
;
; Raw keyboard read for the viewer.  Do NOT call Monitor KEYIN here: KEYIN is
; the tail of RDKEY and expects A/Y to describe the flashing cursor cell.
; ============================================================================

RAWKEY:
                LDA KBD
                BPL RAWKEY
                BIT KBDSTRB
                RTS

; ============================================================================
; SAVE_LIVE / RESTORE_LIVE
;
; Copy ONLY the 40 visible bytes of each text row.  Never copy all of
; $0400-$07FF: the 8-byte "screen holes" in each $80-byte block are used by
; DOS and other software.
; ============================================================================

SAVE_LIVE:
                LDX #$00
SL_ROW:
                LDA SCRLO,X
                STA CPYSRC+1
                LDA SCRHI,X
                STA CPYSRC+2

                LDA BAKLO,X
                STA CPYDST+1
                LDA BAKHI,X
                STA CPYDST+2

                JSR COPY40

                INX
                CPX #SCREENLINES
                BNE SL_ROW
                RTS

RESTORE_LIVE:
                LDX #$00
RL_ROW:
                LDA BAKLO,X
                STA CPYSRC+1
                LDA BAKHI,X
                STA CPYSRC+2

                LDA SCRLO,X
                STA CPYDST+1
                LDA SCRHI,X
                STA CPYDST+2

                JSR COPY40

                INX
                CPX #SCREENLINES
                BNE RL_ROW
                RTS

; ============================================================================
; RENDER_VIEW
;
; Conceptual text stream:
;
;       [VALIDLINES historical rows] [24 live rows]
;
; Live view begins at conceptual index VALIDLINES.
; A scrollback depth D begins at VALIDLINES-D.
;
; For each of the 24 destination rows:
;   - conceptual index < VALIDLINES  -> read from history ring
;   - otherwise                      -> read from saved live screen
; ============================================================================

RENDER_VIEW:
                LDA VALIDLINES
                SEC
                SBC VIEWDEPTH
                STA CURINDEX

                LDA #$00
                STA DESTROW

RV_ROW:
                LDA CURINDEX
                CMP VALIDLINES
                BCC RV_HISTORY

                ; ------------------------------------------------------------
                ; Source is one of the saved live rows.
                ; live_row = CURINDEX - VALIDLINES
                ; ------------------------------------------------------------
                SEC
                SBC VALIDLINES
                TAX

                LDA BAKLO,X
                STA CPYSRC+1
                LDA BAKHI,X
                STA CPYSRC+2
                JMP RV_DEST

RV_HISTORY:
                ; ------------------------------------------------------------
                ; Source is a history row.
                ; Before ring is full: physical_slot = conceptual_index.
                ; When full: NEXTSLOT is the oldest row, therefore
                ; physical_slot = (NEXTSLOT + conceptual_index) mod 25.
                ; ------------------------------------------------------------
                TAX
                LDA VALIDLINES
                CMP #HISTLINES
                BNE RV_HSLOT_READY

                TXA
                CLC
                ADC NEXTSLOT
                CMP #HISTLINES
                BCC RV_HSLOT_X
                SEC
                SBC #HISTLINES
RV_HSLOT_X:
                TAX

RV_HSLOT_READY:
                LDA HISTLO,X
                STA CPYSRC+1
                LDA HISTHI,X
                STA CPYSRC+2

RV_DEST:
                LDX DESTROW
                LDA SCRLO,X
                STA CPYDST+1
                LDA SCRHI,X
                STA CPYDST+2

                JSR COPY40

                INC CURINDEX
                INC DESTROW
                LDA DESTROW
                CMP #SCREENLINES
                BNE RV_ROW
                RTS

; ============================================================================
; COPY40
;
; Self-modifying 40-byte copy.  Callers patch CPYSRC and CPYDST operands.
; X is preserved; Y is scratch.
; ============================================================================

COPY40:
                LDY #39
CPY_LOOP:
CPYSRC:
                LDA $FFFF,Y
CPYDST:
                STA $FFFF,Y
                DEY
                BPL CPY_LOOP
                RTS

; ============================================================================
; Resident state
; ============================================================================

NEXTSLOT:       DB $00          ; 0..24, next history slot to overwrite
VALIDLINES:     DB $00          ; 0..25
ESCMODE:        DB $00          ; Apple II+ persistent ESC cursor mode active
VIEWDEPTH:      DB $00          ; 1..VALIDLINES while viewer is active
OUTCHAR:        DB $00
INCHAR:         DB $00
CURINDEX:       DB $00
DESTROW:        DB $00
SAVEX:          DB $00
SAVEY:          DB $00

; ============================================================================
; Address tables
; ============================================================================

; Apple II TEXT page-1 row starts.
SCRLO:
                DB $00,$80,$00,$80,$00,$80,$00,$80
                DB $28,$A8,$28,$A8,$28,$A8,$28,$A8
                DB $50,$D0,$50,$D0,$50,$D0,$50,$D0
SCRHI:
                DB $04,$04,$05,$05,$06,$06,$07,$07
                DB $04,$04,$05,$05,$06,$06,$07,$07
                DB $04,$04,$05,$05,$06,$06,$07,$07

; 25 linear history slots at $0800, stride 40.
HISTLO:
                DB $00,$28,$50,$78,$A0,$C8,$F0,$18
                DB $40,$68,$90,$B8,$E0,$08,$30,$58
                DB $80,$A8,$D0,$F8,$20,$48,$70,$98,$C0
HISTHI:
                DB $08,$08,$08,$08,$08,$08,$08,$09
                DB $09,$09,$09,$09,$09,$0A,$0A,$0A
                DB $0A,$0A,$0A,$0A,$0B,$0B,$0B,$0B,$0B

; 24 linear live-backup rows at $7C00, stride 40.
BAKLO:
                DB $00,$28,$50,$78,$A0,$C8,$F0,$18
                DB $40,$68,$90,$B8,$E0,$08,$30,$58
                DB $80,$A8,$D0,$F8,$20,$48,$70,$98
BAKHI:
                DB $7C,$7C,$7C,$7C,$7C,$7C,$7C,$7D
                DB $7D,$7D,$7D,$7D,$7D,$7E,$7E,$7E
                DB $7E,$7E,$7E,$7E,$7F,$7F,$7F,$7F

; ============================================================================
; End PRONTO_SCROLL V0.2.1
; ============================================================================

                .END
