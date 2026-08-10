; ============================================================================
; PRONTO_SCROLL V0.23
; Apple II / II+ + DOS 3.3 / ProntoDOS resident text scrollback experiment
;
; BRUN load address: $8000
;
; USER INTERFACE
;   Normal Apple II editing is unchanged.
;   In persistent ESC cursor mode:
;       I at row 0    enter scrollback (one line older)
;       M at row 23   Monitor scrolls down; disappearing row 0 is captured
;
;   While viewing scrollback:
;       I       one line older
;       M       one line newer
;       ESC     restore the live screen and exit
;       M at the newest historical position also returns to live screen
;
; MEMORY RESERVED
;   $0800-$0BE7   25 x 40-byte off-screen circular store (TEXT page 2 RAM)
;   $0BE8-$0BEE   Resident state variables
;   $0BEE-$0BFF   Unused
;   $0C01-...     Applesoft program text (relocated from $0801)
;   $8000-...     resident patch code
;
; TEXT page 1 itself is the 24-line viewport.  While browsing, each ring slot
; temporarily holds the live row displaced from the opposite edge.  I and M
; are exact inverse rotations, so no second 960-byte live-screen copy is needed.
; Applesoft HIMEM is therefore lowered only to $8000 to protect resident code.
;
; IMPORTANT V0.23 LIMITATIONS
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
BASICWARM       = $E003         ; Applesoft warm restart vector

; ============================================================================
; Resident state
;
; Fixed addresses in the unused tail of TEXT page 2.
; INSTALL clears $0800-$0BFF, so these bytes need no emitted DB storage.
; ============================================================================

NEXTSLOT        = $0BE8         ; 0..24, next history slot to overwrite
VALIDLINES      = $0BE9         ; 0..25
ESCMODE         = $0BEA         ; ESC flag normally; ring-slot cursor in BROWSE
VIEWDEPTH       = $0BEB         ; 0=live, 1..VALIDLINES=scrollback depth
SAVEX           = $0BEC
SAVEY           = $0BED
TEMP            = $0BEE         ; shared output/input character scratch byte

KEYIN           = $FD1B         ; Monitor KEYIN; requires RDKEY entry context
COUT1           = $FDF0         ; true 40-column screen output (does not use CSW)
KBD             = $C000         ; keyboard data / strobe high bit
KBDSTRB         = $C010         ; clear keyboard strobe

; ----------------------------------------------------------------------------
; Reserved memory
; ----------------------------------------------------------------------------

HISTORY         = $0800
BASICSTART      = $0C01
BASICHIMEM      = $8000

HISTLINES       = 25
SCREENLINES     = 24
LINELEN         = 40

; ============================================================================
; INSTALL
; ============================================================================

INSTALL:
                ; ------------------------------------------------------------
                ; Clear TEXT page 2 ($0800-$0BFF).
                ;
                ; This clears all 25 x 40-byte history slots ($0800-$0BE7)
                ; and the resident state at $0BE8-$0BEE in one compact loop.
                ; A remains zero afterwards and is reused by the installer.
                ; ------------------------------------------------------------

                LDA #$00
                TAX
CLEARPAGE2:
                STA $0800,X
                STA $0900,X
                STA $0A00,X
                STA $0B00,X
                INX
                BNE CLEARPAGE2

                ; ------------------------------------------------------------
                ; Reserve TEXT page 2 by moving an EMPTY Applesoft program to
                ; $0C01.  Applesoft NEW uses VARTAB = TXTTAB + 3, therefore
                ; an empty program beginning at $0C01 has VARTAB/PRGEND=$0C04.
                ;
                ; V0.2.1 intentionally discards any BASIC program resident
                ; before BRUN.
                ; ------------------------------------------------------------

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

                ; Protect this resident patch from Applesoft.
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

                ; DOSHOOK has now accepted SCIN/SCROUT as the underlying
                ; devices and restored DOS/ProntoDOS's own interceptors.
                ;
                ; Do NOT call DOSWARM here: DOSWARM invokes INITIOHK again.
                ; For this resident installer we already performed that work.
                ; Start Applesoft with a clean stack and its documented warm
                ; restart entry instead.
                LDX #$F8
                TXS
                JMP BASICWARM

; ============================================================================
; SCROUT
;
; DOS/ProntoDOS calls this as its underlying output routine.
; When a full-screen operation is about to scroll row 0 off TEXT page 1,
; copy that 40-byte row into the 25-line circular history buffer, then pass
; the original character to COUT1.
; ============================================================================

SCROUT:
                STA TEMP
                TXA
                PHA
                TYA
                PHA

                JSR CHECK_FULL_WINDOW
                BNE SC_PASS

                LDA CV
                CMP #23
                BNE SC_PASS

                ; Is this character about to make COUT1 scroll?
                LDA TEMP
                AND #$7F

                CMP #$0D                ; CR on bottom row scrolls
                BEQ SC_SAVE
                CMP #$0A                ; LF on bottom row scrolls
                BEQ SC_SAVE
                CMP #$20
                BCC SC_PASS              ; other controls do not wrap

                LDA CH
                CMP #39                 ; printable in last column wraps + scrolls
                BNE SC_PASS

SC_SAVE:
                JSR SAVE_TOP_HISTORY

SC_PASS:
                PLA
                TAY
                PLA
                TAX
                LDA TEMP
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
                STA TEMP

                ; A newly typed ESC starts/refreshes persistent ESC mode.
                LDA TEMP
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
                LDA TEMP
                AND #$7F

                CMP #$49        ; I = cursor up
                BEQ SI_ESC_I

                CMP #$4A        ; J = cursor left
                BEQ SI_RETURN

                CMP #$4B        ; K = cursor right
                BEQ SI_RETURN

                CMP #$4D        ; M = cursor down
                BEQ SI_ESC_M

                LDA #$00
                STA ESCMODE
                JMP SI_RETURN

SI_ESC_I:
                ; The Monitor's UP routine clamps at WNDTOP.  Therefore an I
                ; received at row 0 will NOT scroll by itself; this is our
                ; deliberate scrollback boundary action.
                LDA CV
                BNE SI_RETURN

                JSR CHECK_FULL_WINDOW
                BNE SI_RETURN

                LDA VALIDLINES
                BEQ SI_RETURN

                JSR BROWSE

                ; Viewer consumed navigation locally.  Return ESC so the
                ; Monitor exits its persistent I/J/K/M escape loop.
                LDA #$00
                STA ESCMODE
                LDA #$9B
                STA TEMP
                JMP SI_RETURN

SI_ESC_M:
                ; Apple II+ ESC-M eventually executes the Monitor LF routine.
                ; At row 23 LF calls SCROLL DIRECTLY, bypassing CSW/COUT and
                ; therefore bypassing SCROUT.  Save row 0 here BEFORE returning
                ; M to the Monitor, which will then perform the real scroll.
                LDA CV
                CMP #23
                BNE SI_RETURN

                JSR CHECK_FULL_WINDOW
                BNE SI_RETURN

                JSR SAVE_TOP_HISTORY

SI_RETURN:
                LDX SAVEX
                LDY SAVEY
                LDA TEMP
                RTS

; ============================================================================
; CHECK_FULL_WINDOW
;
; Returns Z=1 (A=0) only for the supported 40x24 window:
;   WNDLFT=0, WNDTOP=0, WNDWDTH=40, WNDBTM=24
; Otherwise returns Z=0 (A nonzero).
; ============================================================================

CHECK_FULL_WINDOW:
                LDA WNDLFT
                BNE CFW_DONE
                LDA WNDTOP
                BNE CFW_DONE
                LDA WNDWDTH
                CMP #40
                BNE CFW_DONE
                LDA WNDBTM
                CMP #24                 ; Z=1 only on the supported window
CFW_DONE:
                RTS

; ============================================================================
; SAVE_TOP_HISTORY
;
; Save visible page-1 row 0 ($0400-$0427) into the next 40-byte slot of
; TEXT page 2's circular history.  Used by BOTH:
;   - SCROUT when ordinary character output is about to scroll, and
;   - SCIN when ESC-M at row 23 will make the Monitor scroll directly.
;
; X and Y are scratch.  Callers that need them preserved already save them.
; ============================================================================

SAVE_TOP_HISTORY:
                LDX NEXTSLOT
                LDA HISTLO,X
                STA STH_DST+1
                LDA HISTHI,X
                STA STH_DST+2

                LDY #39
STH_COPY:
                LDA $0400,Y
STH_DST:
                STA $FFFF,Y
                DEY
                BPL STH_COPY

                LDA VALIDLINES
                CMP #HISTLINES
                BCS STH_COUNTOK
                INC VALIDLINES
STH_COUNTOK:
                INC NEXTSLOT
                LDA NEXTSLOT
                CMP #HISTLINES
                BCC STH_DONE
                LDA #$00
                STA NEXTSLOT
STH_DONE:
                RTS

; ============================================================================
; BROWSE / VIEW_OLDER / VIEW_NEWER
;
; No live-screen backup is used.  The 25-line ring and the 24 visible rows form
; one reversible 49-line window.  Each older step rotates one history slot into
; row 0 while rotating row 23 back into that same slot.  VIEW_NEWER performs
; the exact inverse rotation.
; ============================================================================

BROWSE:
                ; VIEWDEPTH is guaranteed to be zero whenever the live screen
                ; is active.  Start the slot cursor one past the newest line.
                LDA NEXTSLOT
                STA ESCMODE
                JSR VIEW_OLDER          ; caller already proved history exists

VB_WAIT:
                JSR RAWKEY
                AND #$7F

                CMP #$1B                ; ESC = restore live screen and exit
                BEQ VB_EXIT

                CMP #$49                ; I = one line older
                BEQ VB_OLDER

                CMP #$4D                ; M = one line newer
                BEQ VB_NEWER

                JMP VB_WAIT

VB_OLDER:
                LDA VIEWDEPTH
                CMP VALIDLINES
                BCS VB_WAIT             ; oldest retained line already visible
                JSR VIEW_OLDER
                JMP VB_WAIT

VB_NEWER:
                JSR VIEW_NEWER
                LDA VIEWDEPTH
                BNE VB_WAIT
                RTS                     ; live screen reached

VB_EXIT:
                ; BROWSE always has depth >= 1 here.
                JSR VIEW_NEWER
                LDA VIEWDEPTH
                BNE VB_EXIT
                RTS

; Select the next older physical ring slot, rotate it into row 0, and increase
; depth.  NEXTSLOT always points one slot beyond the newest retained line.
VIEW_OLDER:
                LDA ESCMODE
                BNE VO_NONZERO
                LDA #HISTLINES
VO_NONZERO:
                SEC
                SBC #$01
                STA ESCMODE
                JSR ROTATE_OLDER
                INC VIEWDEPTH
                RTS

; Reverse the current older rotation.  If history remains above the viewport,
; advance the reused ESCMODE slot cursor to the next shallower depth.
VIEW_NEWER:
                JSR ROTATE_NEWER
                DEC VIEWDEPTH
                BEQ VN_DONE

                INC ESCMODE
                LDA ESCMODE
                CMP #HISTLINES
                BCC VN_DONE
                LDA #$00
                STA ESCMODE
VN_DONE:
                RTS

; ---------------------------------------------------------------------------
; ROTATE_OLDER
;
; For every character column:
;   tmp <- ring slot
;   ring slot <- row 23
;   row 23 <- row 22 <- ... <- row 0
;   row 0 <- tmp
;
; Only one stack byte is used at a time; every column balances PHA/PLA.
; ---------------------------------------------------------------------------
ROTATE_OLDER:
                LDX ESCMODE
                LDA HISTLO,X
                STA RO_HREAD+1
                STA RO_HWRITE+1
                LDA HISTHI,X
                STA RO_HREAD+2
                STA RO_HWRITE+2

                LDY #39
RO_COLUMN:
RO_HREAD:
                LDA $FFFF,Y
                PHA                     ; one-byte cyclic-rotation scratch

                LDA $07D0,Y             ; visible row 23
RO_HWRITE:
                STA $FFFF,Y

                LDX #22
RO_ROW:
                LDA SCRLO,X
                STA RO_SRC+1
                LDA SCRHI,X
                STA RO_SRC+2
                LDA SCRLO+1,X
                STA RO_DST+1
                LDA SCRHI+1,X
                STA RO_DST+2
RO_SRC:
                LDA $FFFF,Y
RO_DST:
                STA $FFFF,Y
                DEX
                BPL RO_ROW

                PLA
                STA $0400,Y             ; visible row 0
                DEY
                BPL RO_COLUMN
                RTS

; Exact inverse of ROTATE_OLDER.
ROTATE_NEWER:
                LDX ESCMODE
                LDA HISTLO,X
                STA RN_HREAD+1
                STA RN_HWRITE+1
                LDA HISTHI,X
                STA RN_HREAD+2
                STA RN_HWRITE+2

                LDY #39
RN_COLUMN:
RN_HREAD:
                LDA $FFFF,Y
                PHA                     ; one-byte cyclic-rotation scratch

                LDA $0400,Y             ; visible row 0
RN_HWRITE:
                STA $FFFF,Y

                LDX #$00
RN_ROW:
                LDA SCRLO+1,X
                STA RN_SRC+1
                LDA SCRHI+1,X
                STA RN_SRC+2
                LDA SCRLO,X
                STA RN_DST+1
                LDA SCRHI,X
                STA RN_DST+2
RN_SRC:
                LDA $FFFF,Y
RN_DST:
                STA $FFFF,Y
                INX
                CPX #23
                BNE RN_ROW

                PLA
                STA $07D0,Y             ; visible row 23
                DEY
                BPL RN_COLUMN
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

; ============================================================================
; End PRONTO_SCROLL V0.23
; ============================================================================
                .END
