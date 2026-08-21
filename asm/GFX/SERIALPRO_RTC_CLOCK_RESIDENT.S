; =============================================================================
; Friend Bestie normalized vector font -> Apple II HGR filled-glyph renderer
; =============================================================================
;
; Target assembler : RetroAppleJS ASM_core.js / NMOS 6502
; Load address      : $6000
; HGR page          : page 1 ($2000-$3FFF), mixed mode
;
; RESIDENT ENTRY POINTS
; ---------------------
;   CALL 24576 ($6000)  install / redraw resident clock
;   CALL 24579 ($6003)  remove clock and restore prior IRQ/text window
;   CALL 24582 ($6006)  force a complete clock redraw
;
; The resident service uses the Apple II user IRQ vector at $03FE/$03FF and the
; Serial Pro 6818 update-ended interrupt (Register B UIE).  The Serial Pro must
; route its RTC interrupt to IRQ.  RetroAppleJS also needs 6818 IRQ generation
; enabled in EMU_CARD_serialpro.js for this resident service to tick there.
;
; FONT DATA FORMAT
; ----------------
; This renderer consumes the browser-generated normalized vector dataset:
;
;   VF_DATA + glyph offset:
;       byte    contour count
;       repeat:
;           byte    point count
;           byte    X0,Y0 ... Xn,Yn
;
; Every contour is implicitly closed. Coordinates are normalized 0..255.
; All contours for a glyph are intersected together on each scanline and the
; resulting X crossings are sorted and filled in pairs.  This is the even/odd
; fill rule, so counters/holes in A, B, D, O, P, Q, R, etc. remain transparent.
;
; PUBLIC API
; ----------
;
;   A       = low byte of character code (ASCII works for this A-Z dataset)
;   VF_X0L  = glyph left X, low byte
;   VF_X0H  = glyph left X, high byte (HGR X range is 0..279)
;   VF_Y0   = glyph top Y (0..191)
;   VF_X1   = requested glyph WIDTH  in pixels (1..255)
;   VF_Y1   = requested glyph HEIGHT in pixels (1..192)
;
;   JSR VF_DRAW
;
; The user's requested API is therefore position (X0,Y0), size (X1,Y1).
;
; Rendering is clipped to the 280x192 HGR viewport.  VF_DRAW clobbers A,X,Y.
;
; IMPLEMENTATION NOTES
; --------------------
; * Curve flattening and 0..255 normalization happen offline in the HTML tool.
; * Runtime scaling uses:
;
;       screenX = X0 + floor(normalizedX * X1 / 256)
;
; * Destination scanlines sample the normalized outline at pixel centres:
;
;       sourceY = floor((row*256 + 128) / Y1)
;
; * Edge intersection uses an unsigned 8x8 multiply plus 16/8 divide.
; * Horizontal spans are emitted byte-wise into HGR, rather than plotting each
;   pixel individually.
; * The intersection buffer has 128 entries.  The attached edited Friend Bestie
;   dataset's largest glyph has 75 contour vertices, so 128 entries is sufficient.
;
; =============================================================================

            ORG     $6000

; Apple II soft switches
GFXON       EQU     $C050
TXTON       EQU     $C051
FULLSCR     EQU     $C052
MIXED       EQU     $C053
PAGE1       EQU     $C054
HIRES       EQU     $C057

; Apple II Monitor text-window / IRQ state.
WNDLFT      EQU     $20
WNDWDTH     EQU     $21
WNDTOP      EQU     $22
WNDBTM      EQU     $23
CH          EQU     $24
CV          EQU     $25
ACC         EQU     $45          ; original accumulator saved by Monitor IRQ code
IRQLOC      EQU     $03FE        ; user IRQ vector, low/high
VTAB        EQU     $FC22
HOME        EQU     $FC58

; Serial Pro slot-2 6818 clock/RAM ports.
; Change SERIALOFF to $10..$70 for Apple slots 1..7.
SERIALOFF   EQU     $20
RTCADR      EQU     $C084
RTCDATA     EQU     $C085

FIELD_YEAR  EQU     $00
FIELD_MONTH EQU     $01
FIELD_DAY   EQU     $02
FIELD_DOW   EQU     $03
FIELD_AMPM  EQU     $04

; Zero-page pointers used by the renderer.  Applesoft/DOS may use these while
; the clock is resident, so the IRQ wrapper saves/restores all four bytes.
VF_DPL      EQU     $F0
VF_DPH      EQU     $F1
VF_HPL      EQU     $F2
VF_HPH      EQU     $F3

; =============================================================================
; USER-EDITABLE LAYOUT / SIZE SETTINGS
; =============================================================================
;
; All screen positions and visible object sizes used by the clock face are
; collected here.  Calendar X values are HGR pixels 0..279; Y values are
; scanlines 0..191.  Width/height values are pixels.
;
; IMPORTANT:
; The split-flap clip/clear geometry is now derived at runtime from the same
; Y/H constants used by the glyph renderers.  Moving MONTH_Y, for example,
; therefore cannot leave the old clipping window behind.
; -----------------------------------------------------------------------------

; ----- YEAR: 20YY -------------------------------------------------------------
YEAR_Y          EQU     $03          ; 3
YEAR_H          EQU     $19          ; 25
YEAR_C0_X       EQU     $5E          ; 94   fixed '2'
YEAR_C1_X       EQU     $74          ; 116  fixed '0'
YEAR_C2_X       EQU     $8B          ; 139  RTC year tens
YEAR_C3_X       EQU     $A2          ; 162  RTC year ones
YEAR_DIG_W      EQU     $11          ; normal digit width 17
YEAR_ONE_SHIFT  EQU     $02          ; shift narrow '1' right inside its cell
YEAR_ONE_W      EQU     $0B          ; narrow '1' width 11

; ----- MONTH: three characters ------------------------------------------------
MONTH_Y         EQU     $28          ; 40
MONTH_H         EQU     $1B          ; 27
MONTH_C0_X      EQU     $30          ; 48
MONTH_C0_W      EQU     $10          ; 13
MONTH_C1_X      EQU     $44          ; 68
MONTH_C1_W      EQU     $10          ; 13
MONTH_C2_X      EQU     $58          ; 88
MONTH_C2_W      EQU     $10          ; 16

; ----- DAY OF MONTH: two digits ----------------------------------------------
DAY_Y           EQU     $28          ; 40
DAY_H           EQU     $34          ; 52
DAY_C0_X        EQU     $95          ; 149
DAY_C0_W        EQU     $17          ; 23
DAY_C1_X        EQU     $B3          ; 179
DAY_C1_W        EQU     $17          ; 23

; ----- DAY OF WEEK: three characters -----------------------------------------
DOW_Y           EQU     $70          ; 112
DOW_H           EQU     $1B          ; 27
DOW_C0_X        EQU     $91          ; 145
DOW_C0_W        EQU     $0E          ; 14
DOW_C1_X        EQU     $A2          ; 162
DOW_C1_W        EQU     $0F          ; 15
DOW_C2_X        EQU     $B4          ; 180
DOW_C2_W        EQU     $0E          ; 14

; ----- AM / PM suffix ----------------------------------------------------------
AMPM_Y          EQU     $80          ; 128
AMPM_H          EQU     $0B          ; 11
AMPM_C0_X       EQU     $C4          ; 196  A or P
AMPM_C0_W       EQU     $07          ; 7
AMPM_C1_X       EQU     $CD          ; 205  M
AMPM_C1_W       EQU     $07          ; 7

; ----- Bottom-right branding --------------------------------------------------
; "SERIAL PRO" is rendered with the same Friend Bestie vector font and is then
; converted from white to Apple II HGR orange in-place.
;
; The current Friend Bestie dataset contains manual normalized-point edits.
; In particular, the 'I' contour is already narrowed and centered inside its
; normalized 0..255 cell, so no character-specific runtime scaling is needed.
;
; X=140 is an HGR-byte boundary (20*7).  The color rectangle extends through
; X=279, so all branding glyphs share the orange phase without touching the
; mixed-mode text rows below scanline 159.
INSCR_X0L       EQU     $8C          ; left X = 140
INSCR_X0H       EQU     $00
INSCR_Y         EQU     $8D          ; top Y = 141
INSCR_H         EQU     $10          ; glyph / color height = 16
INSCR_CHAR_W    EQU     $0D          ; normal glyph cell / width = 13
INSCR_GAP       EQU     $02          ; 2 pixels between character cells
INSCR_SPACE     EQU     $04          ; blank advance for spaces
INSCR_RECT_W    EQU     $8C          ; 140 pixels, X=140..279

; ----- Analog clock shared center/size box ------------------------------------
; Tickmarks and all three hands use these same parameters.
CLOCK_CFG_X0L   EQU     $46          ; center X = 70
CLOCK_CFG_X0H   EQU     $00
CLOCK_CFG_Y0    EQU     $73          ; center Y = 115; 90px box ends at HGR Y=159
CLOCK_CFG_W     EQU     $5A          ; total width  = 90
CLOCK_CFG_H     EQU     $5A          ; total height = 90

; Hand thickness is derived from direction / 2^shift.
CLOCK_MIN_WSHIFT  EQU   $04          ; minute hand: thinner
CLOCK_HOUR_WSHIFT EQU   $03          ; hour hand: thicker

; ----- Split-flap clear boxes --------------------------------------------------
; X boxes are deliberately a little wider than the live glyphs so character
; spacing can be adjusted without leaving stale pixels.
;
; IMPORTANT FOR MIXED MODE:
; Vertical clear/clip geometry is NOT a second set of coordinates. CAL_LOAD_GEOM
; takes the same moved-up Y/H constants used by the visible glyphs above:
;   YEAR  = Y  3..27
;   MONTH = Y 40..66
;   DAY   = Y 40..91
;   DOW   = Y112..138
;   AM/PM = Y128..138
; Therefore changing YEAR_Y, MONTH_Y, DAY_Y, DOW_Y or AMPM_Y automatically
; moves its split-flap clear box as well.
YEAR_FIELD_X0   EQU     $5A          ; 90
YEAR_FIELD_W    EQU     $5A          ; clears through X=179
MONTH_FIELD_X0  EQU     $2C          ; 44
MONTH_FIELD_W   EQU     $40          ; clears through X=107
DAY_FIELD_X0    EQU     $91          ; 145
DAY_FIELD_W     EQU     $3D          ; clears through X=205
DOW_FIELD_X0    EQU     $8D          ; 141
DOW_FIELD_W     EQU     $39          ; clears through X=197
AMPM_FIELD_X0   EQU     $C2          ; 194
AMPM_FIELD_W    EQU     $14          ; clears through X=213

; ----- Resident mixed-mode text window -----------------------------------------
; HGR mixed mode displays graphics on scanlines 0..159 and text rows 20..23.
; The installer programs the Monitor window variables so normal Applesoft/DOS
; COUT scrolling is confined to those four bottom rows.  The resident clock
; never writes to text page 1 after installation.
;
;       HGR:  Y=0..159
;       TEXT: rows 20..23
;
; Reserve the clock binary from Applesoft with HIMEM:24576 before loading it.
;
; -----------------------------------------------------------------------------
; RTC-driven split-flap calendar layout.
;
; Approximates the supplied 280x192 reference:
;       2021        at the top
;       AUG         upper-left
;       11          upper-right
;       TUE PM      lower-right
;
; The analog clock shares the same center/size coordinate box as its tick marks.
; Hour/minute hands are filled vector polygons and are refreshed whenever the
; RTC minute actually changes; the seconds hand is a lightweight XOR line updated
; once per second. Calendar fields are read live from the Serial Pro RTC.
;
; 0-9 and A-Z come directly from the supplied Friend Bestie vector dataset.
; No temporary digit font is needed: the year, day, month, weekday and PM
; suffix all use exactly the same VF_DRAW filled-vector renderer.
; -----------------------------------------------------------------------------

START       JMP     RESIDENT_INSTALL
REMOVE      JMP     RESIDENT_REMOVE
REFRESH     JMP     RESIDENT_REFRESH

; =============================================================================
; Resident installer / remover
; =============================================================================
;
; CALL $6000 installs the clock as a 1 Hz IRQ service and returns immediately
; to Applesoft/DOS.  The bottom four text rows remain a normal scrolling Monitor
; window.  CALL $6003 removes the service; CALL $6006 forces a full redraw.
;
; The Apple II Monitor saves the interrupted A register at ACC ($45) before
; jumping through IRQLOC ($03FE/$03FF).  The resident ISR therefore restores A
; from ACC, and explicitly saves/restores X, Y and renderer zero page $F0-$F3.
; -----------------------------------------------------------------------------

RESIDENT_INSTALL
            PHP
            PLA
            STA     RES_CALLP
            SEI
            CLD

            LDA     RES_ACTIVE
            BNE     RES_INSTALL_REDRAW

; Preserve caller/environment state only on the first installation.
            LDA     RES_CALLP
            STA     RES_OLDP

            LDA     IRQLOC
            STA     RES_OLDIRQ
            LDA     IRQLOC+1
            STA     RES_OLDIRQ+1

            LDA     WNDLFT
            STA     RES_OLD_WNDLFT
            LDA     WNDWDTH
            STA     RES_OLD_WNDWDTH
            LDA     WNDTOP
            STA     RES_OLD_WNDTOP
            LDA     WNDBTM
            STA     RES_OLD_WNDBTM
            LDA     CH
            STA     RES_OLD_CH
            LDA     CV
            STA     RES_OLD_CV

; Initial graphics construction occurs with IRQs disabled.  Protect $F0-$F3 so
; CALL returns transparently to Applesoft/DOS.
            JSR     RES_SAVE_ZP
            JSR     RES_DRAW_FULL
            JSR     RES_SETUP_WINDOW
            JSR     RES_RESTORE_ZP

; Save the existing RTC mode/interrupt-enable register before adding UIE.
            LDY     #SERIALOFF
            LDA     #$0B
            JSR     RTC_REG
            STA     RES_OLD_RTC_B

; Install the user IRQ vector before enabling the 6818 update-ended interrupt.
            LDA     #<RESIDENT_IRQ
            STA     IRQLOC
            LDA     #>RESIDENT_IRQ
            STA     IRQLOC+1

; Reading Register C clears any stale RTC interrupt flags.
            LDA     #$0C
            JSR     RTC_REG

; Preserve binary/BCD, 12/24-hour, SET and other mode bits; add UIE (bit 4).
            LDA     #$0B
            STA     RTCADR,Y
            LDA     RES_OLD_RTC_B
            ORA     #$10
            STA     RTCDATA,Y

            LDA     #$A5
            STA     RES_ACTIVE

; The resident service requires maskable IRQs to be enabled.
            CLI
            RTS

RES_INSTALL_REDRAW
; Re-running CALL $6000 does not replace the saved vector/window state.  It only
; reconstructs the display and reasserts the four-line text window.
            JSR     RES_SAVE_ZP
            JSR     RES_DRAW_FULL
            JSR     RES_SETUP_WINDOW
            JSR     RES_RESTORE_ZP
            CLI
            RTS

RESIDENT_REFRESH
            LDA     RES_ACTIVE
            BNE     RES_REFRESH_ACTIVE
            JMP     RESIDENT_INSTALL

RES_REFRESH_ACTIVE
            SEI
            CLD
            JSR     RES_SAVE_ZP
            JSR     RES_DRAW_FULL
            JSR     RES_SETUP_WINDOW
            JSR     RES_RESTORE_ZP
            CLI
            RTS

RESIDENT_REMOVE
            PHP
            PLA
            STA     RES_CALLP
            SEI
            CLD

            LDA     RES_ACTIVE
            BNE     RES_REMOVE_ACTIVE

; Not installed: restore the interrupt-enable state that existed on entry.
            LDA     RES_CALLP
            JMP     RES_RESTORE_I

RES_REMOVE_ACTIVE
            LDY     #SERIALOFF

; Restore the exact RTC Register-B value that preceded installation.
            LDA     #$0B
            STA     RTCADR,Y
            LDA     RES_OLD_RTC_B
            STA     RTCDATA,Y

; Clear a pending RTC interrupt before handing IRQ ownership back.
            LDA     #$0C
            JSR     RTC_REG

            LDA     RES_OLDIRQ
            STA     IRQLOC
            LDA     RES_OLDIRQ+1
            STA     IRQLOC+1

; Restore the Monitor text window and cursor position.
            LDA     RES_OLD_WNDLFT
            STA     WNDLFT
            LDA     RES_OLD_WNDWDTH
            STA     WNDWDTH
            LDA     RES_OLD_WNDTOP
            STA     WNDTOP
            LDA     RES_OLD_WNDBTM
            STA     WNDBTM
            LDA     RES_OLD_CH
            STA     CH
            LDA     RES_OLD_CV
            STA     CV
            JSR     VTAB

; Return to ordinary full-screen text without erasing the text page.
            LDA     TXTON
            LDA     FULLSCR
            LDA     PAGE1

            LDA     #$00
            STA     RES_ACTIVE

; Restore the IRQ-enable state from before the clock was originally installed.
            LDA     RES_OLDP

RES_RESTORE_I
            AND     #$04
            BEQ     RES_I_ENABLE
            SEI
            RTS

RES_I_ENABLE
            CLI
            RTS

; Configure rows 20..23 as a normal 40-column Monitor text window.  HOME honors
; WNDTOP/WNDBTM and therefore clears only these four rows.
RES_SETUP_WINDOW
            LDA     #$00
            STA     WNDLFT
            LDA     #$28
            STA     WNDWDTH
            LDA     #$14
            STA     WNDTOP
            LDA     #$18
            STA     WNDBTM
            JSR     HOME
            RTS

; Save/restore only the zero-page workspace owned by this renderer.  All other
; clock state lives in the resident binary itself.
RES_SAVE_ZP
            LDA     VF_DPL
            STA     RES_ZP_F0
            LDA     VF_DPH
            STA     RES_ZP_F1
            LDA     VF_HPL
            STA     RES_ZP_F2
            LDA     VF_HPH
            STA     RES_ZP_F3
            RTS

RES_RESTORE_ZP
            LDA     RES_ZP_F0
            STA     VF_DPL
            LDA     RES_ZP_F1
            STA     VF_DPH
            LDA     RES_ZP_F2
            STA     VF_HPL
            LDA     RES_ZP_F3
            STA     VF_HPH
            RTS

; Build a complete HGR clock image.  This is used only at install/reinstall or
; an explicit CALL $6006; normal IRQ service is incremental.
RES_DRAW_FULL
            LDA     GFXON
            LDA     MIXED
            LDA     PAGE1
            LDA     HIRES
            JSR     HCLR

; Shared analog-clock geometry.
            LDA     #CLOCK_CFG_X0L
            STA     CLOCK_X0L
            LDA     #CLOCK_CFG_X0H
            STA     CLOCK_X0H
            LDA     #CLOCK_CFG_Y0
            STA     CLOCK_Y0
            LDA     #CLOCK_CFG_W
            STA     CLOCK_X1
            LDA     #CLOCK_CFG_H
            STA     CLOCK_Y1

; Static bottom-right branding.
            JSR     DRAW_INSCRIPTION

; Force a complete first-time reconstruction from the next coherent snapshot.
            LDA     #$00
            STA     CLOCK_INIT
            LDA     #$FF
            STA     CLOCK_SECIDX
            STA     DSP_YEAR
            STA     DSP_MONTH
            STA     DSP_DAY
            STA     DSP_DOW
            STA     DSP_PM
            STA     LAST_SEC

            JSR     RTC_SNAPSHOT
            BCC     RES_DRAW_NO_RTC

            LDA     RTC_SEC_RAW
            STA     LAST_SEC
            JSR     CLOCK_UPDATE
            JSR     CAL_UPDATE
            RTS

; If the RTC is invalid, leave a useful static clock ring rather than a blank
; left-hand area.  A later valid IRQ or explicit refresh can populate the hands.
RES_DRAW_NO_RTC
            JSR     CLOCK_TICKMARKS
            RTS

; =============================================================================
; Resident IRQ service
; =============================================================================
;
; MC146818/6818 Register C:
;   bit 7 IRQF  interrupt request flag
;   bit 4 UF    update-ended flag
;
; Reading Register C acknowledges/clears the RTC interrupt.  If this was not our
; update-ended interrupt, all foreground registers/workspace are restored and
; control chains to the IRQ vector that existed before installation.
; -----------------------------------------------------------------------------

RESIDENT_IRQ
; The Apple II Monitor has already saved the interrupted A at $45.
            LDA     ACC
            PHA
            TXA
            PHA
            TYA
            PHA

; Applesoft/DOS may own these locations at the interrupted instant.
            LDA     VF_DPL
            PHA
            LDA     VF_DPH
            PHA
            LDA     VF_HPL
            PHA
            LDA     VF_HPH
            PHA

; NMOS 6502 IRQ does not clear decimal mode.  The clock arithmetic requires
; binary mode; RTI later restores the interrupted processor status.
            CLD

            LDY     #SERIALOFF
            LDA     #$0C
            JSR     RTC_REG
            STA     RES_IRQ_FLAGS

; We own only an asserted update-ended interrupt: IRQF|UF = $90.
            AND     #$90
            CMP     #$90
            BNE     RES_IRQ_CHAIN

            JSR     RTC_SNAPSHOT
            BCC     RES_IRQ_DONE

; Interrupts can be delayed while DOS performs timing-critical disk I/O.  Use
; the current RTC image, not an assumed one-second progression.
            LDA     RTC_SEC_RAW
            CMP     LAST_SEC
            BEQ     RES_IRQ_DONE
            STA     LAST_SEC

            JSR     CLOCK_UPDATE
            JSR     CAL_UPDATE

RES_IRQ_DONE
            PLA
            STA     VF_HPH
            PLA
            STA     VF_HPL
            PLA
            STA     VF_DPH
            PLA
            STA     VF_DPL
            PLA
            TAY
            PLA
            TAX
            PLA
            RTI

RES_IRQ_CHAIN
            PLA
            STA     VF_HPH
            PLA
            STA     VF_HPL
            PLA
            STA     VF_DPH
            PLA
            STA     VF_DPL
            PLA
            TAY
            PLA
            TAX
            PLA
            JMP     (RES_OLDIRQ)


; =============================================================================
; Serial Pro 6818 RTC
; =============================================================================
;
; A coherent calendar snapshot is acquired using the normal MC146818/6818
; discipline:
;
;   1. wait while Register A bit 7 (UIP) is set,
;   2. read seconds,
;   3. read the calendar fields,
;   4. read seconds again,
;   5. retry if seconds changed or UIP became set.
;
; RetroAppleJS currently reports UIP clear because its JavaScript Date snapshot
; is atomic, but keeping the loop makes the same assembly safe on real hardware.
;
; Register B bit 2 selects binary vs BCD and bit 1 selects 24-hour vs 12-hour.
; The RetroAppleJS Serial Pro powers up as Register B=$02: 24-hour, BCD.
; -----------------------------------------------------------------------------

; A = RTC register number. Y must contain SERIALOFF.
; Returns selected register value in A.  Y is preserved.
RTC_REG     STA     RTCADR,Y
            LDA     RTCDATA,Y
            RTS

; Carry set = valid coherent snapshot.
RTC_SNAPSHOT
            LDY     #SERIALOFF

RTC_RETRY   LDA     #$0D            ; Register D: valid time/RAM
            JSR     RTC_REG
            BMI     RTC_D_VALID
            JMP     RTC_FAIL
RTC_D_VALID LDA     #$0A            ; Register A: UIP in bit 7
            JSR     RTC_REG
            BMI     RTC_RETRY

            LDA     #$0B            ; Register B: mode
            JSR     RTC_REG
            STA     RTC_MODE

            LDA     #$00            ; seconds before calendar read
            JSR     RTC_REG
            STA     RTC_SEC0

            LDA     #$02            ; minutes
            JSR     RTC_REG
            STA     RTC_MIN_RAW

            LDA     #$04            ; hour
            JSR     RTC_REG
            STA     RTC_HOUR_RAW

            LDA     #$06            ; day of week, 1..7
            JSR     RTC_REG
            STA     RTC_DOW_RAW

            LDA     #$07            ; day of month, 1..31
            JSR     RTC_REG
            STA     RTC_DAY_RAW

            LDA     #$08            ; month, 1..12
            JSR     RTC_REG
            STA     RTC_MONTH_RAW

            LDA     #$09            ; year, 00..99
            JSR     RTC_REG
            STA     RTC_YEAR_RAW

            LDA     #$00            ; seconds after calendar read
            JSR     RTC_REG
            STA     RTC_SEC1
            CMP     RTC_SEC0
            BEQ     RTC_SEC_STABLE
            JMP     RTC_RETRY

RTC_SEC_STABLE
            LDA     #$0A
            JSR     RTC_REG
            BPL     RTC_UIP_STABLE
            JMP     RTC_RETRY

RTC_UIP_STABLE
; Keep raw seconds as the lightweight polling epoch.
            LDA     RTC_SEC1
            STA     RTC_SEC_RAW

; Decode calendar registers to binary if Register B selects BCD.
            LDA     RTC_DOW_RAW
            JSR     RTC_DECODE
            STA     RTC_DOW
            CMP     #$01
            BCS     RTC_DOW_MINOK
            JMP     RTC_FAIL
RTC_DOW_MINOK
            CMP     #$08
            BCC     RTC_DOW_OK
            JMP     RTC_FAIL
RTC_DOW_OK  LDA     RTC_DAY_RAW
            JSR     RTC_DECODE
            STA     RTC_DAY
            CMP     #$01
            BCS     RTC_DAY_MINOK
            JMP     RTC_FAIL
RTC_DAY_MINOK
            CMP     #$20
            BCC     RTC_DAY_OK
            JMP     RTC_FAIL
RTC_DAY_OK  LDA     RTC_MONTH_RAW
            JSR     RTC_DECODE
            STA     RTC_MONTH
            CMP     #$01
            BCS     RTC_MON_MINOK
            JMP     RTC_FAIL
RTC_MON_MINOK
            CMP     #$0D
            BCC     RTC_MON_OK
            JMP     RTC_FAIL
RTC_MON_OK  LDA     RTC_YEAR_RAW
            JSR     RTC_DECODE
            STA     RTC_YEAR

; Seconds are needed as a 0..59 index for the moving seconds hand.
            LDA     RTC_SEC1
            JSR     RTC_DECODE
            STA     RTC_SEC
            CMP     #$3C
            BCC     RTC_SEC_OK
            JMP     RTC_FAIL
RTC_SEC_OK

; Decode minutes for both the minute and continuously positioned hour hand.
            LDA     RTC_MIN_RAW
            JSR     RTC_DECODE
            STA     RTC_MIN
            CMP     #$3C
            BCC     RTC_MIN_OK
            JMP     RTC_FAIL
RTC_MIN_OK

; Decode the hour to binary 0..23 and derive AM/PM.
            LDA     RTC_MODE
            AND     #$02
            BNE     RTC_24HOUR

; 12-hour mode: bit 7 is PM; lower seven bits are 1..12.
            LDA     RTC_HOUR_RAW
            AND     #$80
            BEQ     RTC_12_AM
            LDA     #$01
            BNE     RTC_12_PMSET
RTC_12_AM   LDA     #$00
RTC_12_PMSET
            STA     RTC_PM

            LDA     RTC_HOUR_RAW
            AND     #$7F
            JSR     RTC_DECODE
            CMP     #$01
            BCS     RTC_12_MINOK
            JMP     RTC_FAIL
RTC_12_MINOK
            CMP     #$0D
            BCC     RTC_12_RANGEOK
            JMP     RTC_FAIL
RTC_12_RANGEOK
            CMP     #$0C
            BNE     RTC_12_NOT12
            LDA     #$00
RTC_12_NOT12
            LDX     RTC_PM
            BEQ     RTC_STORE_HOUR
            CLC
            ADC     #$0C
            BNE     RTC_STORE_HOUR

RTC_24HOUR LDA     RTC_HOUR_RAW
            AND     #$7F
            JSR     RTC_DECODE
            CMP     #$18
            BCC     RTC_24_RANGEOK
            JMP     RTC_FAIL
RTC_24_RANGEOK
            PHA
            CMP     #$0C
            BCC     RTC_24_AM
            LDA     #$01
            BNE     RTC_24_PMSTORE
RTC_24_AM   LDA     #$00
RTC_24_PMSTORE
            STA     RTC_PM
            PLA

RTC_STORE_HOUR
            STA     RTC_HOUR

            SEC
            RTS

RTC_FAIL    CLC
            RTS

; Decode A according to Register B bit 2.
; Binary mode: A is already binary.
; BCD mode:    packed BCD -> binary.
RTC_DECODE  PHA
            LDA     RTC_MODE
            AND     #$04
            BNE     RTC_DEC_BINARY

            PLA
            JMP     RTC_BCD2BIN

RTC_DEC_BINARY
            PLA
            RTS

; Packed BCD in A -> binary A.
RTC_BCD2BIN PHA
            AND     #$0F
            STA     RTC_TMP0
            PLA
            AND     #$F0
            LSR     A
            LSR     A
            LSR     A
            LSR     A               ; A = tens
            ASL     A               ; 2*tens
            STA     RTC_TMP1
            ASL     A               ; 4*tens
            ASL     A               ; 8*tens
            CLC
            ADC     RTC_TMP1         ; 10*tens
            CLC
            ADC     RTC_TMP0
            RTS

; =============================================================================
; Calendar state and update dispatch
; =============================================================================

CAL_UPDATE  LDA     RTC_YEAR
            CMP     DSP_YEAR
            BEQ     CALU_MONTH
            STA     DSP_YEAR
            LDA     #FIELD_YEAR
            STA     CAL_FIELD
            JSR     CAL_FLIP_FIELD

CALU_MONTH  LDA     RTC_MONTH
            CMP     DSP_MONTH
            BEQ     CALU_DAY
            STA     DSP_MONTH
            LDA     #FIELD_MONTH
            STA     CAL_FIELD
            JSR     CAL_FLIP_FIELD

CALU_DAY    LDA     RTC_DAY
            CMP     DSP_DAY
            BEQ     CALU_DOW
            STA     DSP_DAY
            LDA     #FIELD_DAY
            STA     CAL_FIELD
            JSR     CAL_FLIP_FIELD

CALU_DOW    LDA     RTC_DOW
            CMP     DSP_DOW
            BEQ     CALU_PM
            STA     DSP_DOW
            LDA     #FIELD_DOW
            STA     CAL_FIELD
            JSR     CAL_FLIP_FIELD

CALU_PM     LDA     RTC_PM
            CMP     DSP_PM
            BEQ     CALU_RET
            STA     DSP_PM
            LDA     #FIELD_AMPM
            STA     CAL_FIELD
            JSR     CAL_FLIP_FIELD

CALU_RET    RTS

; =============================================================================
; Split-flap field transition
; =============================================================================
;
; Each changing field uses four short stages around its horizontal seam:
;
;   1. erase old upper half
;   2. draw new upper half
;   3. erase old lower half
;   4. draw new lower half
;
; Because VF_DRAW is clipped to one half during stages 2 and 4, this works for
; arbitrary vector glyphs without generating temporary bitmaps.
; -----------------------------------------------------------------------------

CAL_FLIP_FIELD
            JSR     CAL_LOAD_GEOM

; Erase old upper half.
            LDA     CAL_Y0
            STA     CLR_Y0
            LDA     CAL_MID
            STA     CLR_Y1
            JSR     CAL_CLEAR_RECT
            JSR     FLIP_DELAY

; Draw new upper half.
            LDA     #$01
            STA     VF_CLIPON
            LDA     CAL_Y0
            STA     VF_CLIPY0
            LDA     CAL_MID
            STA     VF_CLIPY1
            JSR     CAL_DRAW_FIELD
            JSR     FLIP_DELAY

; Erase old lower half.
            LDA     CAL_MID
            STA     CLR_Y0
            LDA     CAL_Y1
            STA     CLR_Y1
            JSR     CAL_CLEAR_RECT
            JSR     FLIP_DELAY

; Draw new lower half.
            LDA     CAL_MID
            STA     VF_CLIPY0
            LDA     CAL_Y1
            STA     VF_CLIPY1
            JSR     CAL_DRAW_FIELD

            LDA     #$00
            STA     VF_CLIPON
            JSR     FLIP_DELAY
            RTS

; Geometry is derived from one X0/W table and the SAME Y/H values used by
; the actual glyph renderers.  This prevents stale split-flap clipping when a
; field is moved vertically.
CAL_LOAD_GEOM
            LDX     CAL_FIELD

; Horizontal clear box: inclusive X0..X1.
            LDA     CAL_X0_TAB,X
            STA     CLR_X0L
            LDA     #$00
            STA     CLR_X0H

            LDA     CAL_X0_TAB,X
            CLC
            ADC     CAL_W_TAB,X
            STA     CLR_X1L
            LDA     #$00
            ADC     #$00
            STA     CLR_X1H

; Convert exclusive right edge to inclusive.
            LDA     CLR_X1L
            BNE     CLG_DECLO
            DEC     CLR_X1H
CLG_DECLO   DEC     CLR_X1L

; Vertical clip/clear box: Y0..Y1-1.  Midpoint is Y0 + floor(H/2).
            LDA     CAL_Y0_TAB,X
            STA     CAL_Y0

            LDA     CAL_H_TAB,X
            LSR     A
            CLC
            ADC     CAL_Y0
            STA     CAL_MID

            LDA     CAL_H_TAB,X
            CLC
            ADC     CAL_Y0
            STA     CAL_Y1
            RTS

CAL_DRAW_FIELD
            LDA     CAL_FIELD
            CMP     #FIELD_YEAR
            BNE     CDF_NOT_YEAR
            JMP     DRAW_YEAR
CDF_NOT_YEAR
            CMP     #FIELD_MONTH
            BNE     CDF_NOT_MONTH
            JMP     DRAW_MONTH
CDF_NOT_MONTH
            CMP     #FIELD_DAY
            BNE     CDF_NOT_DAY
            JMP     DRAW_DAY
CDF_NOT_DAY
            CMP     #FIELD_DOW
            BNE     CDF_AMPM
            JMP     DRAW_DOW
CDF_AMPM    JMP     DRAW_AMPM

; =============================================================================
; Calendar field renderers
; =============================================================================

; 20YY, centred in the existing top-year box.  The 6818 exposes only a two-digit
; year, so this clock intentionally assumes the 2000-2099 century.
DRAW_YEAR   LDA     #$00
            STA     VF_X0H
            LDA     #YEAR_Y
            STA     VF_Y0
            LDA     #YEAR_H
            STA     VF_Y1

            LDA     DSP_YEAR
            JSR     BIN2ASCII2       ; CAL_TENS / CAL_ONES

            LDA     #YEAR_C0_X
            STA     CAL_DIGX
            LDA     #'2'
            JSR     DRAW_YEAR_DIG

            LDA     #YEAR_C1_X
            STA     CAL_DIGX
            LDA     #'0'
            JSR     DRAW_YEAR_DIG

            LDA     #YEAR_C2_X
            STA     CAL_DIGX
            LDA     CAL_TENS
            JSR     DRAW_YEAR_DIG

            LDA     #YEAR_C3_X
            STA     CAL_DIGX
            LDA     CAL_ONES
            JSR     DRAW_YEAR_DIG
            RTS

; A year digit normally occupies 17 pixels.  Friend Bestie's "1" is kept
; narrower and shifted two pixels into the cell, matching the reference layout.
DRAW_YEAR_DIG
            PHA
            CMP     #'1'
            BNE     DYD_NORMAL
            LDA     CAL_DIGX
            CLC
            ADC     #YEAR_ONE_SHIFT
            STA     VF_X0L
            LDA     #YEAR_ONE_W
            STA     VF_X1
            PLA
            JSR     VF_DRAW
            RTS

DYD_NORMAL  LDA     CAL_DIGX
            STA     VF_X0L
            LDA     #YEAR_DIG_W
            STA     VF_X1
            PLA
            JSR     VF_DRAW
            RTS

DRAW_MONTH  LDA     DSP_MONTH
            SEC
            SBC     #$01
            STA     CAL_TMP
            ASL     A
            CLC
            ADC     CAL_TMP          ; (month-1)*3
            TAX
            LDA     MONTH_TEXT,X
            STA     CAL_CH0
            INX
            LDA     MONTH_TEXT,X
            STA     CAL_CH1
            INX
            LDA     MONTH_TEXT,X
            STA     CAL_CH2

            LDA     #$00
            STA     VF_X0H
            LDA     #MONTH_Y
            STA     VF_Y0
            LDA     #MONTH_H
            STA     VF_Y1

            LDA     #MONTH_C0_X
            STA     VF_X0L
            LDA     #MONTH_C0_W
            STA     VF_X1
            LDA     CAL_CH0
            JSR     VF_DRAW

            LDA     #MONTH_C1_X
            STA     VF_X0L
            LDA     #MONTH_C1_W
            STA     VF_X1
            LDA     CAL_CH1
            JSR     VF_DRAW

            LDA     #MONTH_C2_X
            STA     VF_X0L
            LDA     #MONTH_C2_W
            STA     VF_X1
            LDA     CAL_CH2
            JSR     VF_DRAW
            RTS

DRAW_DAY    LDA     DSP_DAY
            JSR     BIN2ASCII2

            LDA     #$00
            STA     VF_X0H
            LDA     #DAY_Y
            STA     VF_Y0
            LDA     #DAY_C0_W
            STA     VF_X1
            LDA     #DAY_H
            STA     VF_Y1

            LDA     #DAY_C0_X
            STA     VF_X0L
            LDA     CAL_TENS
            JSR     VF_DRAW

            LDA     #DAY_C1_X
            STA     VF_X0L
            LDA     #DAY_C1_W
            STA     VF_X1
            LDA     CAL_ONES
            JSR     VF_DRAW
            RTS

DRAW_DOW    LDA     DSP_DOW
            SEC
            SBC     #$01
            STA     CAL_TMP
            ASL     A
            CLC
            ADC     CAL_TMP          ; (dow-1)*3
            TAX
            LDA     DOW_TEXT,X
            STA     CAL_CH0
            INX
            LDA     DOW_TEXT,X
            STA     CAL_CH1
            INX
            LDA     DOW_TEXT,X
            STA     CAL_CH2

            LDA     #$00
            STA     VF_X0H
            LDA     #DOW_Y
            STA     VF_Y0
            LDA     #DOW_H
            STA     VF_Y1

            LDA     #DOW_C0_X
            STA     VF_X0L
            LDA     #DOW_C0_W
            STA     VF_X1
            LDA     CAL_CH0
            JSR     VF_DRAW

            LDA     #DOW_C1_X
            STA     VF_X0L
            LDA     #DOW_C1_W
            STA     VF_X1
            LDA     CAL_CH1
            JSR     VF_DRAW

            LDA     #DOW_C2_X
            STA     VF_X0L
            LDA     #DOW_C2_W
            STA     VF_X1
            LDA     CAL_CH2
            JSR     VF_DRAW
            RTS

DRAW_AMPM   LDA     #$00
            STA     VF_X0H
            LDA     #AMPM_Y
            STA     VF_Y0
            LDA     #AMPM_H
            STA     VF_Y1

            LDA     #AMPM_C0_X
            STA     VF_X0L
            LDA     #AMPM_C0_W
            STA     VF_X1
            LDA     DSP_PM
            BEQ     DAP_AM
            LDA     #'P'
            BNE     DAP_FIRST
DAP_AM      LDA     #'A'
DAP_FIRST   JSR     VF_DRAW

            LDA     #AMPM_C1_X
            STA     VF_X0L
            LDA     #AMPM_C1_W
            STA     VF_X1
            LDA     #'M'
            JSR     VF_DRAW
            RTS

; =============================================================================
; Bottom-right "SERIAL PRO" branding
; =============================================================================
;
; The vector font renderer itself is monochrome: it ORs filled pixels into HGR.
; To obtain orange, we first draw the inscription normally, then rewrite the
; HGR bytes in its rectangle:
;
;   - keep only global ODD-X pixels from the white glyph silhouette;
;   - set HGR byte bit 7.
;
; In Apple II HGR that selects the orange artifact-color phase.  Since an HGR
; byte covers seven pixels, the odd-X mask alternates by byte-column parity:
;
;       even HGR byte column -> %0101010 = $2A
;       odd  HGR byte column -> %1010101 = $55
;
; The configured rectangle starts on an HGR-byte boundary and ends at X=279.
; If the inscription is moved, keeping the color rectangle on byte boundaries
; avoids changing bit-7 phase for unrelated pixels sharing edge bytes.
; -----------------------------------------------------------------------------

DRAW_INSCRIPTION
            LDA     #$00
            STA     VF_CLIPON

            LDA     #$00
            STA     INS_IDX

            LDA     #INSCR_X0L
            STA     INS_XL
            LDA     #INSCR_X0H
            STA     INS_XH

DI_NEXT     LDX     INS_IDX
            LDA     INSCR_TEXT,X
            BEQ     DI_COLOR

            INC     INS_IDX
            CMP     #' '             ; space?
            BEQ     DI_SPACE

; Render one character in a fixed-width cell.
;
; The edited Friend Bestie dataset already contains the desired per-glyph
; normalized geometry (including the narrow, centered 'I'), so every character
; can use the same cell width here.
            PHA
            LDA     INS_XL
            STA     VF_X0L
            LDA     INS_XH
            STA     VF_X0H
            LDA     #INSCR_CHAR_W
            STA     VF_X1
            LDA     #INSCR_Y
            STA     VF_Y0
            LDA     #INSCR_H
            STA     VF_Y1
            PLA
            JSR     VF_DRAW

; Advance by the fixed cell width. Update the high byte after each add so
; crossing X=$00FF->$0100 is handled correctly.
            LDA     INS_XL
            CLC
            ADC     #INSCR_CHAR_W
            STA     INS_XL
            LDA     INS_XH
            ADC     #$00
            STA     INS_XH

            LDA     INS_XL
            CLC
            ADC     #INSCR_GAP
            STA     INS_XL
            LDA     INS_XH
            ADC     #$00
            STA     INS_XH
            JMP     DI_NEXT

DI_SPACE
; A space consumes only its configured blank width.
            LDA     INS_XL
            CLC
            ADC     #INSCR_SPACE
            STA     INS_XL
            LDA     INS_XH
            ADC     #$00
            STA     INS_XH
            JMP     DI_NEXT

DI_COLOR    JSR     HGR_ORANGE_INSCRIPTION
            RTS

; Convert the already-rendered monochrome pixels inside the configured
; inscription rectangle to HGR orange.
HGR_ORANGE_INSCRIPTION

; Compute first HGR byte column from inscription X0.
            LDA     #INSCR_X0L
            STA     VF_TMPXL
            LDA     #INSCR_X0H
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDA     VF_COL
            STA     INS_SCOL

; Compute inclusive right X = X0 + RECT_W - 1, then its HGR byte column.
            LDA     #INSCR_X0L
            CLC
            ADC     #INSCR_RECT_W
            STA     VF_TMPXL
            LDA     #INSCR_X0H
            ADC     #$00
            STA     VF_TMPXH

            LDA     VF_TMPXL
            BNE     HOI_DECLO
            DEC     VF_TMPXH
HOI_DECLO   DEC     VF_TMPXL

            JSR     VF_XCELL
            LDA     VF_COL
            STA     INS_ECOL

            LDA     #INSCR_Y
            STA     INS_ROW
            CLC
            ADC     #INSCR_H
            STA     INS_ENDY

HOI_ROW     LDX     INS_ROW
            LDA     HGRLO,X
            STA     VF_HPL
            LDA     HGRHI,X
            STA     VF_HPH

            LDY     INS_SCOL

HOI_BYTE
; Orange = odd global pixel positions + HGR phase bit 7.
; Because each HGR byte contains 7 pixels, odd global X alternates mask parity
; from one byte column to the next.
            TYA
            AND     #$01
            BNE     HOI_ODDCOL

; Even byte column: global odd X are local bits 1,3,5.
            LDA     (VF_HPL),Y
            AND     #$2A
            ORA     #$80
            STA     (VF_HPL),Y
            JMP     HOI_NEXTBYTE

; Odd byte column: global odd X are local bits 0,2,4,6.
HOI_ODDCOL  LDA     (VF_HPL),Y
            AND     #$55
            ORA     #$80
            STA     (VF_HPL),Y

HOI_NEXTBYTE
            CPY     INS_ECOL
            BEQ     HOI_NEXTROW
            INY
            JMP     HOI_BYTE

HOI_NEXTROW
            INC     INS_ROW
            LDA     INS_ROW
            CMP     INS_ENDY
            BCC     HOI_ROW
            RTS

; Binary 0..99 in A -> ASCII tens/ones.
BIN2ASCII2  LDX     #$00
B2A_LOOP    CMP     #$0A
            BCC     B2A_DONE
            SEC
            SBC     #$0A
            INX
            BNE     B2A_LOOP
B2A_DONE    ORA     #'0'
            STA     CAL_ONES
            TXA
            ORA     #'0'
            STA     CAL_TENS
            RTS

; =============================================================================
; Rectangle clear helper used by the flip animation
; =============================================================================

CAL_CLEAR_RECT
            LDA     CLR_Y0
            CMP     CLR_Y1
            BCS     CCR_RET
            STA     VF_SCREENY

            LDA     CLR_X0L
            STA     VF_SPANX0L
            LDA     CLR_X0H
            STA     VF_SPANX0H
            LDA     CLR_X1L
            STA     VF_SPANX1L
            LDA     CLR_X1H
            STA     VF_SPANX1H

CCR_ROW     JSR     VF_HSPAN_CLEAR
            INC     VF_SCREENY
            LDA     VF_SCREENY
            CMP     CLR_Y1
            BCC     CCR_ROW
CCR_RET     RTS

; Roughly 35-45 ms per phase on a 1 MHz Apple II.  On a turbo emulator the
; animation intentionally speeds up together with the CPU.
; Resident mode deliberately omits the foreground animation delay.  Calendar
; fields still redraw as upper/lower halves, but the IRQ must return to
; Applesoft/DOS as quickly as practical.
FLIP_DELAY  RTS

; Poll delay keeps the RTC loop from hammering slot I/O continuously.

; =============================================================================
; Calendar text / geometry tables
; =============================================================================

; ASM_core's printable-string directive is ASC (without a leading dot).
; INSCR_TEXT is zero-terminated because DRAW_INSCRIPTION scans until $00.
INSCR_TEXT  ASC     "SERIAL PRO"
            .BYTE   $00

; Fixed 3-character records; DRAW_MONTH indexes (month-1)*3.
MONTH_TEXT  ASC     "JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC"

; Serial Pro's emulated 6818 uses 1=Sunday ... 7=Saturday.
; Fixed 3-character records; DRAW_DOW indexes (dow-1)*3.
DOW_TEXT    ASC     "SUNMONTUEWEDTHUFRISAT"

;                    year            month            day            dow            ampm
CAL_X0_TAB  .BYTE   YEAR_FIELD_X0,  MONTH_FIELD_X0,  DAY_FIELD_X0,  DOW_FIELD_X0,  AMPM_FIELD_X0
CAL_W_TAB   .BYTE   YEAR_FIELD_W,   MONTH_FIELD_W,   DAY_FIELD_W,   DOW_FIELD_W,   AMPM_FIELD_W

; These are the SAME Y/H constants used by DRAW_YEAR/MONTH/DAY/DOW/AMPM.
; CAL_LOAD_GEOM computes midpoint and Y1 at runtime, so the flip clip cannot
; silently drift away from the glyph placement.
CAL_Y0_TAB  .BYTE   YEAR_Y,          MONTH_Y,          DAY_Y,          DOW_Y,          AMPM_Y
CAL_H_TAB   .BYTE   YEAR_H,          MONTH_H,          DAY_H,          DOW_H,          AMPM_H

; =============================================================================
; Generic ad-hoc polygon entry
; =============================================================================
;
; VF_DRAW_POLY uses the exact same filled-vector scan converter as VF_DRAW.
;
; Input:
;   VF_POLYLO/HI = pointer to compact contour stream
;   VF_X0H:X0L   = top-left X
;   VF_Y0        = top-left Y
;   VF_X1        = width
;   VF_Y1        = height
;
; Stream format is identical to the generated font data:
;   contour count
;   for each contour:
;       point count, X0,Y0, X1,Y1, ...
; Coordinates are normalized 0..255.
; -----------------------------------------------------------------------------

VF_DRAW_POLY
            LDA     VF_POLYLO
            STA     VF_GLYPHLO
            LDA     VF_POLYHI
            STA     VF_GLYPHHI
            JMP     VF_DRAW_STREAM

; =============================================================================
; CLOCK_TICKMARKS
; =============================================================================
;
; Draw twelve radial tick marks: one mark every five minutes / 30 degrees.
;
; The caller supplies CENTER coordinates and the complete elliptical layout box:
;
;   CLOCK_X0H:CLOCK_X0L = center X
;   CLOCK_Y0            = center Y
;   CLOCK_X1            = width
;   CLOCK_Y1            = height
;
; The 12 marks are stored as twelve independent quadrilateral contours in one
; normalized 0..255 polygon stream.  Consequently a single call to the same
; even/odd VF polygon renderer draws the complete tick ring.  Non-square X1/Y1
; values naturally produce an elliptical clock-face layout.
;
; The box should normally lie inside the 280x192 HGR viewport.
; -----------------------------------------------------------------------------

CLOCK_TICKMARKS
            JSR     CLOCK_SETUP_BOX
            LDA     CLOCK_LEFTL
            STA     VF_X0L
            LDA     CLOCK_LEFTH
            STA     VF_X0H
            LDA     CLOCK_TOP
            STA     VF_Y0
            LDA     CLOCK_X1
            STA     VF_X1
            LDA     CLOCK_Y1
            STA     VF_Y1

; Tick marks are a static full-box polygon; split-flap clipping must be off.
            LDA     #$00
            STA     VF_CLIPON

            LDA     #<CLOCK_TICK_POLY
            STA     VF_POLYLO
            LDA     #>CLOCK_TICK_POLY
            STA     VF_POLYHI
            JSR     VF_DRAW_POLY
            RTS

; Draw only the 5-minute tick nearest a given minute-hand position.
; Input A = minute 0..59.
;
; Adding 2 before dividing by 5 gives the nearest 5-minute mark.  58/59 wrap
; naturally to the 00-minute tick.  This is used after erasing the old minute
; hand so only the potentially damaged tick is repaired.
CLOCK_RESTORE_MINUTE_TICK
            CLC
            ADC     #$02
            CMP     #$3C
            BCC     CRMT_NOWRAP
            SEC
            SBC     #$3C
CRMT_NOWRAP
            LDX     #$00
CRMT_DIV5   CMP     #$05
            BCC     CRMT_INDEX
            SEC
            SBC     #$05
            INX
            BNE     CRMT_DIV5
CRMT_INDEX  TXA
            JMP     CLOCK_DRAW_ONE_TICK

; Input A = tick index 0..11.
; Copy the selected 9-byte contour (point count + 4 X/Y pairs) into a tiny
; one-contour polygon stream, then render it with the normal vector engine.
CLOCK_DRAW_ONE_TICK
            TAX
            LDA     CLOCK_TICK_OFF,X
            CLC
            ADC     #<CLOCK_TICK_POLY
            STA     VF_DPL
            LDA     #>CLOCK_TICK_POLY
            ADC     #$00
            STA     VF_DPH

            LDY     #$00
            LDX     #$00
CDOT_COPY   LDA     (VF_DPL),Y
            STA     CLOCK_ONE_TICK_POLY+1,X
            INY
            INX
            CPX     #$09
            BNE     CDOT_COPY

            JSR     CLOCK_SETUP_BOX
            LDA     CLOCK_LEFTL
            STA     VF_X0L
            LDA     CLOCK_LEFTH
            STA     VF_X0H
            LDA     CLOCK_TOP
            STA     VF_Y0
            LDA     CLOCK_X1
            STA     VF_X1
            LDA     CLOCK_Y1
            STA     VF_Y1
            LDA     #$00
            STA     VF_CLIPON
            STA     VF_ERASE
            LDA     #<CLOCK_ONE_TICK_POLY
            STA     VF_POLYLO
            LDA     #>CLOCK_ONE_TICK_POLY
            STA     VF_POLYHI
            JMP     VF_DRAW_POLY

; =============================================================================
; Analog clock hands / animation
; =============================================================================
;
; All analog routines use the SAME center + size coordinate system as the
; tickmark renderer:
;
;   CLOCK_X0H:CLOCK_X0L = center X
;   CLOCK_Y0            = center Y
;   CLOCK_X1            = complete clock width
;   CLOCK_Y1            = complete clock height
;
; Hour and minute hands are generated as normalized triangular polygons and
; rendered through VF_DRAW_POLY.  The minute hand has 60 positions; the hour
; hand has 720 half-degree positions, so its angle includes every minute.
;
; The seconds hand is intentionally different for efficiency: a one-pixel XOR
; Bresenham line.  Redrawing the same old line erases it, so each second costs
; only two thin line passes instead of clearing/rasterizing the complete clock.
; It starts a few pixels away from the center, leaving a fixed two-pixel pivot.
; When RTC_MIN changes the old seconds line is erased.  The old hour/minute polygons
; are then erased individually; the complete clock box is NOT cleared.
; Only the single 5-minute tick nearest the OLD minute-hand position is redrawn
; to repair any tick pixels that the old minute-hand erase may have removed.
; The new hour/minute polygons are then drawn.  Thus the other eleven tickmarks
; remain untouched after startup.
; -----------------------------------------------------------------------------

CLOCK_UPDATE
; First good RTC sample: construct the complete analog clock once.
            LDA     CLOCK_INIT
            BNE     CLKU_RUNNING
            JSR     CLOCK_REDRAW_STATIC
            LDA     #$01
            STA     CLOCK_INIT
            JMP     CLKU_DRAWSEC

CLKU_RUNNING
; XOR the previously displayed seconds line to restore the pixels beneath it.
            LDA     CLOCK_SECIDX
            CMP     #$FF
            BEQ     CLKU_AFTER_ERASE
            JSR     CLOCK_SECOND_XOR

CLKU_AFTER_ERASE
; Detect a real minute change instead of assuming the IRQ arrived at second 00.
; DOS may defer IRQ delivery during timing-critical disk I/O, so the first
; service after a boundary may occur at second 01, 02, ... .
            LDA     RTC_MIN
            CMP     CLOCK_LAST_MIN
            BEQ     CLKU_DRAWSEC
            JSR     CLOCK_REFRESH_MINUTE

CLKU_DRAWSEC
            LDA     RTC_SEC
            JSR     CLOCK_SECOND_XOR
            LDA     RTC_SEC
            STA     CLOCK_SECIDX
            JSR     CLOCK_DRAW_PIVOT
            RTS

; Full reconstruction is only needed for the first coherent RTC sample.
CLOCK_REDRAW_STATIC
            LDA     #$00
            STA     VF_ERASE
            JSR     CLOCK_CLEAR_BOX
            JSR     CLOCK_TICKMARKS
            JSR     CLOCK_DRAW_HOUR
            JSR     CLOCK_DRAW_MINUTE
            JSR     CLOCK_DRAW_PIVOT
            JSR     CLOCK_SAVE_HAND_STATE
            RTS

; Minute-boundary update without disturbing all twelve 5-minute tickmarks.
;
; 1. erase the OLD minute and hour polygons using the same vector rasterizer,
; 2. redraw only the one tick nearest the old minute hand,
; 3. draw the NEW hour/minute polygons,
; 4. restore the pivot and remember the new hand state.
;
; The hour hand ends well inside the tick ring, so only the minute-hand segment
; can damage a tick during polygon erasure.
CLOCK_REFRESH_MINUTE
            LDA     #$01
            STA     VF_ERASE
            JSR     CLOCK_DRAW_LAST_MINUTE
            JSR     CLOCK_DRAW_LAST_HOUR

            LDA     #$00
            STA     VF_ERASE

            LDA     CLOCK_LAST_MIN
            JSR     CLOCK_RESTORE_MINUTE_TICK

            JSR     CLOCK_DRAW_HOUR
            JSR     CLOCK_DRAW_MINUTE
            JSR     CLOCK_DRAW_PIVOT
            JSR     CLOCK_SAVE_HAND_STATE
            RTS

CLOCK_SAVE_HAND_STATE
            LDA     RTC_MIN
            STA     CLOCK_LAST_MIN
            LDA     RTC_HOUR
            STA     CLOCK_LAST_HOUR
            RTS

; Derive and cache top-left from the shared center/size parameters.
CLOCK_SETUP_BOX
            LDA     CLOCK_X1
            LSR     A
            STA     CLOCK_HALF
            LDA     CLOCK_X0L
            SEC
            SBC     CLOCK_HALF
            STA     CLOCK_LEFTL
            LDA     CLOCK_X0H
            SBC     #$00
            STA     CLOCK_LEFTH

            LDA     CLOCK_Y1
            LSR     A
            STA     CLOCK_HALF
            LDA     CLOCK_Y0
            SEC
            SBC     CLOCK_HALF
            STA     CLOCK_TOP
            RTS

CLOCK_CLEAR_BOX
            JSR     CLOCK_SETUP_BOX
            LDA     CLOCK_LEFTL
            STA     CLR_X0L
            LDA     CLOCK_LEFTH
            STA     CLR_X0H

; inclusive right edge = left + width - 1
            LDA     CLOCK_LEFTL
            CLC
            ADC     CLOCK_X1
            STA     CLR_X1L
            LDA     CLOCK_LEFTH
            ADC     #$00
            STA     CLR_X1H
            LDA     CLR_X1L
            BNE     CLKCLR_DECLO
            DEC     CLR_X1H
CLKCLR_DECLO
            DEC     CLR_X1L

            LDA     CLOCK_TOP
            STA     CLR_Y0
            CLC
            ADC     CLOCK_Y1
            STA     CLR_Y1           ; exclusive
            JSR     CAL_CLEAR_RECT
            RTS

; Draw a two-pixel horizontal pivot at the center. The seconds line begins
; outside this dot, so XOR erasure never damages it.
CLOCK_DRAW_PIVOT
            LDA     CLOCK_Y0
            STA     VF_SCREENY
            LDA     CLOCK_X0L
            STA     VF_SPANX0L
            STA     VF_SPANX1L
            LDA     CLOCK_X0H
            STA     VF_SPANX0H
            STA     VF_SPANX1H
            INC     VF_SPANX1L
            BNE     CLKP_NOCARRY
            INC     VF_SPANX1H
CLKP_NOCARRY
            JSR     VF_HSPAN
            RTS

; -----------------------------------------------------------------------------
; Filled minute/hour polygons
; -----------------------------------------------------------------------------

CLOCK_DRAW_MINUTE
            LDA     RTC_MIN
            JMP     CLOCK_DRAW_MINUTE_A

; A = minute 0..59.
CLOCK_DRAW_MINUTE_A
            TAX
            LDA     CLOCK_MIN_X,X
            STA     CLOCK_TIPX
            LDA     CLOCK_MIN_Y,X
            STA     CLOCK_TIPY
            LDA     #CLOCK_MIN_WSHIFT
            STA     CLOCK_WSHIFT
            JSR     CLOCK_BUILD_HAND
            JMP     CLOCK_DRAW_HAND_POLY

CLOCK_DRAW_LAST_MINUTE
            LDA     CLOCK_LAST_MIN
            JMP     CLOCK_DRAW_MINUTE_A

CLOCK_DRAW_HOUR
            LDA     RTC_HOUR
            STA     CLOCK_HOUR_WORK
            LDA     RTC_MIN
            STA     CLOCK_MIN_WORK
            JMP     CLOCK_DRAW_HOUR_WORK

CLOCK_DRAW_LAST_HOUR
            LDA     CLOCK_LAST_HOUR
            STA     CLOCK_HOUR_WORK
            LDA     CLOCK_LAST_MIN
            STA     CLOCK_MIN_WORK

CLOCK_DRAW_HOUR_WORK
; index = (hour mod 12)*60 + minute, range 0..719.
            LDA     CLOCK_HOUR_WORK
            CMP     #$0C
            BCC     CLKH_HOUROK
            SEC
            SBC     #$0C
CLKH_HOUROK
            STA     VF_MA
            LDA     #$3C
            STA     VF_MB
            JSR     VF_MUL8
            LDA     VF_PRODL
            CLC
            ADC     CLOCK_MIN_WORK
            STA     CLOCK_HIDXLO
            LDA     VF_PRODH
            ADC     #$00
            STA     CLOCK_HIDXHI
            JSR     CLOCK_HOUR_TIP
            LDA     #CLOCK_HOUR_WSHIFT
            STA     CLOCK_WSHIFT
            JSR     CLOCK_BUILD_HAND
            JMP     CLOCK_DRAW_HAND_POLY

; Fetch one of 720 normalized hour-hand tip coordinates.
CLOCK_HOUR_TIP
            LDX     CLOCK_HIDXLO
            LDA     CLOCK_HIDXHI
            BEQ     CLKH_PAGE0
            CMP     #$01
            BEQ     CLKH_PAGE1
; high byte 2, valid low range 0..207
            LDA     CLOCK_HOUR_X2,X
            STA     CLOCK_TIPX
            LDA     CLOCK_HOUR_Y2,X
            STA     CLOCK_TIPY
            RTS
CLKH_PAGE1  LDA     CLOCK_HOUR_X1,X
            STA     CLOCK_TIPX
            LDA     CLOCK_HOUR_Y1,X
            STA     CLOCK_TIPY
            RTS
CLKH_PAGE0  LDA     CLOCK_HOUR_X0,X
            STA     CLOCK_TIPX
            LDA     CLOCK_HOUR_Y0,X
            STA     CLOCK_TIPY
            RTS

; Build a narrow triangular hand in normalized 0..255 clock coordinates.
; Input CLOCK_TIPX/Y and CLOCK_WSHIFT. Output CLOCK_HAND_POLY point bytes.
CLOCK_BUILD_HAND
; direction = tip - center, signed 8-bit.
            LDA     CLOCK_TIPX
            SEC
            SBC     #$80
            STA     CLOCK_DX
            LDA     CLOCK_TIPY
            SEC
            SBC     #$80
            STA     CLOCK_DY

; perpX = -dy >> shift
            LDA     CLOCK_DY
            EOR     #$FF
            CLC
            ADC     #$01
            JSR     CLOCK_ASR_N
            STA     CLOCK_PX

; perpY = dx >> shift
            LDA     CLOCK_DX
            JSR     CLOCK_ASR_N
            STA     CLOCK_PY

; P0 = center + perpendicular.
            LDA     #$80
            CLC
            ADC     CLOCK_PX
            STA     CLOCK_HAND_X0
            LDA     #$80
            CLC
            ADC     CLOCK_PY
            STA     CLOCK_HAND_Y0

; P1 = tip.
            LDA     CLOCK_TIPX
            STA     CLOCK_HAND_X1
            LDA     CLOCK_TIPY
            STA     CLOCK_HAND_Y1

; P2 = center - perpendicular.
            LDA     #$80
            SEC
            SBC     CLOCK_PX
            STA     CLOCK_HAND_X2
            LDA     #$80
            SEC
            SBC     CLOCK_PY
            STA     CLOCK_HAND_Y2
            RTS

; Arithmetic right shift A by CLOCK_WSHIFT (3 or 4), preserving sign.
CLOCK_ASR_N
            LDX     CLOCK_WSHIFT
CLKASR_LOOP CMP     #$80             ; carry=1 for negative input
            ROR     A
            DEX
            BNE     CLKASR_LOOP
            RTS

CLOCK_DRAW_HAND_POLY
            JSR     CLOCK_SETUP_BOX
            LDA     CLOCK_LEFTL
            STA     VF_X0L
            LDA     CLOCK_LEFTH
            STA     VF_X0H
            LDA     CLOCK_TOP
            STA     VF_Y0
            LDA     CLOCK_X1
            STA     VF_X1
            LDA     CLOCK_Y1
            STA     VF_Y1
            LDA     #$00
            STA     VF_CLIPON
            LDA     #<CLOCK_HAND_POLY
            STA     VF_POLYLO
            LDA     #>CLOCK_HAND_POLY
            STA     VF_POLYHI
            JSR     VF_DRAW_POLY
            RTS

; Mutable compact contour stream: one triangular contour, three points.
CLOCK_HAND_POLY
            .BYTE   $01,$03
CLOCK_HAND_X0 .BYTE $80
CLOCK_HAND_Y0 .BYTE $80
CLOCK_HAND_X1 .BYTE $80
CLOCK_HAND_Y1 .BYTE $20
CLOCK_HAND_X2 .BYTE $80
CLOCK_HAND_Y2 .BYTE $80

; -----------------------------------------------------------------------------
; Lightweight XOR seconds hand
; -----------------------------------------------------------------------------
;
; A = second 0..59.  Tables contain normalized line start/end coordinates.
; Start radius deliberately avoids the two-pixel center pivot.
CLOCK_SECOND_XOR
            STA     CLOCK_SEC_WORK
            JSR     CLOCK_SETUP_BOX
            LDX     CLOCK_SEC_WORK
            LDA     CLOCK_SEC_SX,X
            JSR     CLOCK_SCALE_X
            LDA     CLOCK_SCALEL
            STA     CLOCK_LX0L
            LDA     CLOCK_SCALEH
            STA     CLOCK_LX0H

            LDX     CLOCK_SEC_WORK
            LDA     CLOCK_SEC_SY,X
            JSR     CLOCK_SCALE_Y
            STA     CLOCK_LY0

            LDX     CLOCK_SEC_WORK
            LDA     CLOCK_SEC_EX,X
            JSR     CLOCK_SCALE_X
            LDA     CLOCK_SCALEL
            STA     CLOCK_LX1L
            LDA     CLOCK_SCALEH
            STA     CLOCK_LX1H

            LDX     CLOCK_SEC_WORK
            LDA     CLOCK_SEC_EY,X
            JSR     CLOCK_SCALE_Y
            STA     CLOCK_LY1

            JSR     CLOCK_EOR_LINE
            RTS

; normalized X in A -> absolute HGR X in CLOCK_SCALEH:L using shared clock box.
CLOCK_SCALE_X
            STA     VF_MA
            LDA     CLOCK_X1
            STA     VF_MB
            JSR     VF_MUL8
            LDA     CLOCK_LEFTL
            CLC
            ADC     VF_PRODH
            STA     CLOCK_SCALEL
            LDA     CLOCK_LEFTH
            ADC     #$00
            STA     CLOCK_SCALEH
            RTS

; normalized Y in A -> absolute HGR Y in A.
CLOCK_SCALE_Y
            STA     VF_MA
            LDA     CLOCK_Y1
            STA     VF_MB
            JSR     VF_MUL8
            LDA     CLOCK_TOP
            CLC
            ADC     VF_PRODH
            RTS

; Dominant-axis 1-pixel XOR line. Drawing it twice restores the previous HGR.
CLOCK_EOR_LINE
            LDA     CLOCK_LX0L
            STA     CLOCK_CXL
            LDA     CLOCK_LX0H
            STA     CLOCK_CXH
            LDA     CLOCK_LY0
            STA     CLOCK_CY

; Determine horizontal direction and absolute DX (clock width <=255).
            LDA     CLOCK_LX1H
            CMP     CLOCK_LX0H
            BCC     CLKLINE_XNEG
            BNE     CLKLINE_XPOS
            LDA     CLOCK_LX1L
            CMP     CLOCK_LX0L
            BCC     CLKLINE_XNEG
CLKLINE_XPOS
            LDA     #$01
            STA     CLOCK_SX
            LDA     CLOCK_LX1L
            SEC
            SBC     CLOCK_LX0L
            STA     CLOCK_DLX
            JMP     CLKLINE_DY
CLKLINE_XNEG
            LDA     #$FF
            STA     CLOCK_SX
            LDA     CLOCK_LX0L
            SEC
            SBC     CLOCK_LX1L
            STA     CLOCK_DLX

CLKLINE_DY  LDA     CLOCK_LY1
            CMP     CLOCK_LY0
            BCC     CLKLINE_YNEG
            LDA     #$01
            STA     CLOCK_SY
            LDA     CLOCK_LY1
            SEC
            SBC     CLOCK_LY0
            STA     CLOCK_DLY
            JMP     CLKLINE_KIND
CLKLINE_YNEG
            LDA     #$FF
            STA     CLOCK_SY
            LDA     CLOCK_LY0
            SEC
            SBC     CLOCK_LY1
            STA     CLOCK_DLY

CLKLINE_KIND
            LDA     CLOCK_DLX
            CMP     CLOCK_DLY
            BCC     CLKLINE_YMAJ

; X-major DDA.
            LSR     A
            STA     CLOCK_ERR
CLKLINE_XLOOP
            JSR     CLOCK_EOR_PIXEL
            LDA     CLOCK_CXH
            CMP     CLOCK_LX1H
            BNE     CLKLINE_XSTEP
            LDA     CLOCK_CXL
            CMP     CLOCK_LX1L
            BEQ     CLKLINE_DONE
CLKLINE_XSTEP
            JSR     CLOCK_STEP_X
            LDA     CLOCK_ERR
            SEC
            SBC     CLOCK_DLY
            STA     CLOCK_ERR
            BCS     CLKLINE_XLOOP
            JSR     CLOCK_STEP_Y
            LDA     CLOCK_ERR
            CLC
            ADC     CLOCK_DLX
            STA     CLOCK_ERR
            JMP     CLKLINE_XLOOP

; Y-major DDA.
CLKLINE_YMAJ
            LDA     CLOCK_DLY
            LSR     A
            STA     CLOCK_ERR
CLKLINE_YLOOP
            JSR     CLOCK_EOR_PIXEL
            LDA     CLOCK_CY
            CMP     CLOCK_LY1
            BEQ     CLKLINE_DONE
            JSR     CLOCK_STEP_Y
            LDA     CLOCK_ERR
            SEC
            SBC     CLOCK_DLX
            STA     CLOCK_ERR
            BCS     CLKLINE_YLOOP
            JSR     CLOCK_STEP_X
            LDA     CLOCK_ERR
            CLC
            ADC     CLOCK_DLY
            STA     CLOCK_ERR
            JMP     CLKLINE_YLOOP
CLKLINE_DONE
            RTS

CLOCK_STEP_X
            LDA     CLOCK_SX
            BMI     CLKSTEPX_DEC
            INC     CLOCK_CXL
            BNE     CLKSTEPX_RET
            INC     CLOCK_CXH
CLKSTEPX_RET RTS
CLKSTEPX_DEC
            LDA     CLOCK_CXL
            BNE     CLKSTEPX_DECLO
            DEC     CLOCK_CXH
CLKSTEPX_DECLO
            DEC     CLOCK_CXL
            RTS

CLOCK_STEP_Y
            LDA     CLOCK_SY
            BMI     CLKSTEPY_DEC
            INC     CLOCK_CY
            RTS
CLKSTEPY_DEC
            DEC     CLOCK_CY
            RTS

; XOR one HGR pixel at CLOCK_CXH:CXL,CY. The high phase bit is untouched.
CLOCK_EOR_PIXEL
            LDA     CLOCK_CY
            CMP     #$C0
            BCS     CLKEP_RET
            TAX
            LDA     HGRLO,X
            STA     VF_HPL
            LDA     HGRHI,X
            STA     VF_HPH

            LDA     CLOCK_CXL
            STA     VF_TMPXL
            LDA     CLOCK_CXH
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDX     VF_MOD
            LDA     CLOCK_BITMASK,X
            LDY     VF_COL
            EOR     (VF_HPL),Y
            STA     (VF_HPL),Y
CLKEP_RET   RTS

; 60 second positions: inner start radius 12, outer radius 106.
CLOCK_SEC_SX  .BYTE   $80,$81,$82,$84,$85,$86,$87,$88,$89,$8A,$8A,$8B,$8B,$8C,$8C,$8C
              .BYTE   $8C,$8C,$8B,$8B,$8A,$8A,$89,$88,$87,$86,$85,$84,$82,$81,$80,$7F
              .BYTE   $7E,$7C,$7B,$7A,$79,$78,$77,$76,$76,$75,$75,$74,$74,$74,$74,$74
              .BYTE   $75,$75,$76,$76,$77,$78,$79,$7A,$7B,$7C,$7E,$7F
CLOCK_SEC_SY  .BYTE   $74,$74,$74,$75,$75,$76,$76,$77,$78,$79,$7A,$7B,$7C,$7E,$7F,$80
              .BYTE   $81,$82,$84,$85,$86,$87,$88,$89,$8A,$8A,$8B,$8B,$8C,$8C,$8C,$8C
              .BYTE   $8C,$8B,$8B,$8A,$8A,$89,$88,$87,$86,$85,$84,$82,$81,$80,$7F,$7E
              .BYTE   $7C,$7B,$7A,$79,$78,$77,$76,$76,$75,$75,$74,$74
CLOCK_SEC_EX  .BYTE   $80,$8B,$96,$A1,$AB,$B5,$BE,$C7,$CF,$D6,$DC,$E1,$E5,$E8,$E9,$EA
              .BYTE   $E9,$E8,$E5,$E1,$DC,$D6,$CF,$C7,$BE,$B5,$AB,$A1,$96,$8B,$80,$75
              .BYTE   $6A,$5F,$55,$4B,$42,$39,$31,$2A,$24,$1F,$1B,$18,$17,$16,$17,$18
              .BYTE   $1B,$1F,$24,$2A,$31,$39,$42,$4B,$55,$5F,$6A,$75
CLOCK_SEC_EY  .BYTE   $16,$17,$18,$1B,$1F,$24,$2A,$31,$39,$42,$4B,$55,$5F,$6A,$75,$80
              .BYTE   $8B,$96,$A1,$AB,$B5,$BE,$C7,$CF,$D6,$DC,$E1,$E5,$E8,$E9,$EA,$E9
              .BYTE   $E8,$E5,$E1,$DC,$D6,$CF,$C7,$BE,$B5,$AB,$A1,$96,$8B,$80,$75,$6A
              .BYTE   $5F,$55,$4B,$42,$39,$31,$2A,$24,$1F,$1B,$18,$17

; 60 minute-hand tip positions, normalized radius 90.
CLOCK_MIN_X   .BYTE   $80,$89,$93,$9C,$A5,$AD,$B5,$BC,$C3,$C9,$CE,$D2,$D6,$D8,$DA,$DA
              .BYTE   $DA,$D8,$D6,$D2,$CE,$C9,$C3,$BC,$B5,$AD,$A5,$9C,$93,$89,$80,$77
              .BYTE   $6D,$64,$5B,$53,$4B,$44,$3D,$37,$32,$2E,$2A,$28,$26,$26,$26,$28
              .BYTE   $2A,$2E,$32,$37,$3D,$44,$4B,$53,$5B,$64,$6D,$77
CLOCK_MIN_Y   .BYTE   $26,$26,$28,$2A,$2E,$32,$37,$3D,$44,$4B,$53,$5B,$64,$6D,$77,$80
              .BYTE   $89,$93,$9C,$A5,$AD,$B5,$BC,$C3,$C9,$CE,$D2,$D6,$D8,$DA,$DA,$DA
              .BYTE   $D8,$D6,$D2,$CE,$C9,$C3,$BC,$B5,$AD,$A5,$9C,$93,$89,$80,$77,$6D
              .BYTE   $64,$5B,$53,$4B,$44,$3D,$37,$32,$2E,$2A,$28,$26

; 720 hour-hand tip positions at 0.5-degree steps, normalized radius 60.
CLOCK_HOUR_X0 .BYTE   $80,$81,$81,$82,$82,$83,$83,$84,$84,$85,$85,$86,$86,$87,$87,$88
              .BYTE   $88,$89,$89,$8A,$8A,$8B,$8B,$8C,$8C,$8D,$8D,$8E,$8F,$8F,$90,$90
              .BYTE   $91,$91,$92,$92,$93,$93,$94,$94,$95,$95,$96,$96,$96,$97,$97,$98
              .BYTE   $98,$99,$99,$9A,$9A,$9B,$9B,$9C,$9C,$9D,$9D,$9E,$9E,$9E,$9F,$9F
              .BYTE   $A0,$A0,$A1,$A1,$A2,$A2,$A2,$A3,$A3,$A4,$A4,$A5,$A5,$A5,$A6,$A6
              .BYTE   $A7,$A7,$A7,$A8,$A8,$A9,$A9,$A9,$AA,$AA,$AA,$AB,$AB,$AC,$AC,$AC
              .BYTE   $AD,$AD,$AD,$AE,$AE,$AE,$AF,$AF,$AF,$B0,$B0,$B0,$B1,$B1,$B1,$B1
              .BYTE   $B2,$B2,$B2,$B3,$B3,$B3,$B3,$B4,$B4,$B4,$B4,$B5,$B5,$B5,$B5,$B6
              .BYTE   $B6,$B6,$B6,$B7,$B7,$B7,$B7,$B7,$B8,$B8,$B8,$B8,$B8,$B9,$B9,$B9
              .BYTE   $B9,$B9,$B9,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$BB,$BB,$BB,$BB,$BB
              .BYTE   $BB,$BB,$BB,$BB,$BB,$BB,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC
              .BYTE   $BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC
              .BYTE   $BC,$BC,$BC,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BA,$BA
              .BYTE   $BA,$BA,$BA,$BA,$BA,$BA,$B9,$B9,$B9,$B9,$B9,$B9,$B8,$B8,$B8,$B8
              .BYTE   $B8,$B7,$B7,$B7,$B7,$B7,$B6,$B6,$B6,$B6,$B5,$B5,$B5,$B5,$B4,$B4
              .BYTE   $B4,$B4,$B3,$B3,$B3,$B3,$B2,$B2,$B2,$B1,$B1,$B1,$B1,$B0,$B0,$B0
CLOCK_HOUR_X1 .BYTE   $AF,$AF,$AF,$AE,$AE,$AE,$AD,$AD,$AD,$AC,$AC,$AC,$AB,$AB,$AA,$AA
              .BYTE   $AA,$A9,$A9,$A9,$A8,$A8,$A7,$A7,$A7,$A6,$A6,$A5,$A5,$A5,$A4,$A4
              .BYTE   $A3,$A3,$A2,$A2,$A2,$A1,$A1,$A0,$A0,$9F,$9F,$9E,$9E,$9E,$9D,$9D
              .BYTE   $9C,$9C,$9B,$9B,$9A,$9A,$99,$99,$98,$98,$97,$97,$96,$96,$96,$95
              .BYTE   $95,$94,$94,$93,$93,$92,$92,$91,$91,$90,$90,$8F,$8F,$8E,$8D,$8D
              .BYTE   $8C,$8C,$8B,$8B,$8A,$8A,$89,$89,$88,$88,$87,$87,$86,$86,$85,$85
              .BYTE   $84,$84,$83,$83,$82,$82,$81,$81,$80,$7F,$7F,$7E,$7E,$7D,$7D,$7C
              .BYTE   $7C,$7B,$7B,$7A,$7A,$79,$79,$78,$78,$77,$77,$76,$76,$75,$75,$74
              .BYTE   $74,$73,$73,$72,$71,$71,$70,$70,$6F,$6F,$6E,$6E,$6D,$6D,$6C,$6C
              .BYTE   $6B,$6B,$6A,$6A,$6A,$69,$69,$68,$68,$67,$67,$66,$66,$65,$65,$64
              .BYTE   $64,$63,$63,$62,$62,$62,$61,$61,$60,$60,$5F,$5F,$5E,$5E,$5E,$5D
              .BYTE   $5D,$5C,$5C,$5B,$5B,$5B,$5A,$5A,$59,$59,$59,$58,$58,$57,$57,$57
              .BYTE   $56,$56,$56,$55,$55,$54,$54,$54,$53,$53,$53,$52,$52,$52,$51,$51
              .BYTE   $51,$50,$50,$50,$4F,$4F,$4F,$4F,$4E,$4E,$4E,$4D,$4D,$4D,$4D,$4C
              .BYTE   $4C,$4C,$4C,$4B,$4B,$4B,$4B,$4A,$4A,$4A,$4A,$49,$49,$49,$49,$49
              .BYTE   $48,$48,$48,$48,$48,$47,$47,$47,$47,$47,$47,$46,$46,$46,$46,$46
CLOCK_HOUR_X2 .BYTE   $46,$46,$46,$45,$45,$45,$45,$45,$45,$45,$45,$45,$45,$45,$44,$44
              .BYTE   $44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44
              .BYTE   $44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$45,$45,$45,$45,$45
              .BYTE   $45,$45,$45,$45,$45,$45,$46,$46,$46,$46,$46,$46,$46,$46,$47,$47
              .BYTE   $47,$47,$47,$47,$48,$48,$48,$48,$48,$49,$49,$49,$49,$49,$4A,$4A
              .BYTE   $4A,$4A,$4B,$4B,$4B,$4B,$4C,$4C,$4C,$4C,$4D,$4D,$4D,$4D,$4E,$4E
              .BYTE   $4E,$4F,$4F,$4F,$4F,$50,$50,$50,$51,$51,$51,$52,$52,$52,$53,$53
              .BYTE   $53,$54,$54,$54,$55,$55,$56,$56,$56,$57,$57,$57,$58,$58,$59,$59
              .BYTE   $59,$5A,$5A,$5B,$5B,$5B,$5C,$5C,$5D,$5D,$5E,$5E,$5E,$5F,$5F,$60
              .BYTE   $60,$61,$61,$62,$62,$62,$63,$63,$64,$64,$65,$65,$66,$66,$67,$67
              .BYTE   $68,$68,$69,$69,$6A,$6A,$6A,$6B,$6B,$6C,$6C,$6D,$6D,$6E,$6E,$6F
              .BYTE   $6F,$70,$70,$71,$71,$72,$73,$73,$74,$74,$75,$75,$76,$76,$77,$77
              .BYTE   $78,$78,$79,$79,$7A,$7A,$7B,$7B,$7C,$7C,$7D,$7D,$7E,$7E,$7F,$7F
CLOCK_HOUR_Y0 .BYTE   $44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$45
              .BYTE   $45,$45,$45,$45,$45,$45,$45,$45,$45,$45,$46,$46,$46,$46,$46,$46
              .BYTE   $46,$46,$47,$47,$47,$47,$47,$47,$48,$48,$48,$48,$48,$49,$49,$49
              .BYTE   $49,$49,$4A,$4A,$4A,$4A,$4B,$4B,$4B,$4B,$4C,$4C,$4C,$4C,$4D,$4D
              .BYTE   $4D,$4D,$4E,$4E,$4E,$4F,$4F,$4F,$4F,$50,$50,$50,$51,$51,$51,$52
              .BYTE   $52,$52,$53,$53,$53,$54,$54,$54,$55,$55,$56,$56,$56,$57,$57,$57
              .BYTE   $58,$58,$59,$59,$59,$5A,$5A,$5B,$5B,$5B,$5C,$5C,$5D,$5D,$5E,$5E
              .BYTE   $5E,$5F,$5F,$60,$60,$61,$61,$62,$62,$62,$63,$63,$64,$64,$65,$65
              .BYTE   $66,$66,$67,$67,$68,$68,$69,$69,$6A,$6A,$6A,$6B,$6B,$6C,$6C,$6D
              .BYTE   $6D,$6E,$6E,$6F,$6F,$70,$70,$71,$71,$72,$73,$73,$74,$74,$75,$75
              .BYTE   $76,$76,$77,$77,$78,$78,$79,$79,$7A,$7A,$7B,$7B,$7C,$7C,$7D,$7D
              .BYTE   $7E,$7E,$7F,$7F,$80,$81,$81,$82,$82,$83,$83,$84,$84,$85,$85,$86
              .BYTE   $86,$87,$87,$88,$88,$89,$89,$8A,$8A,$8B,$8B,$8C,$8C,$8D,$8D,$8E
              .BYTE   $8F,$8F,$90,$90,$91,$91,$92,$92,$93,$93,$94,$94,$95,$95,$96,$96
              .BYTE   $96,$97,$97,$98,$98,$99,$99,$9A,$9A,$9B,$9B,$9C,$9C,$9D,$9D,$9E
              .BYTE   $9E,$9E,$9F,$9F,$A0,$A0,$A1,$A1,$A2,$A2,$A2,$A3,$A3,$A4,$A4,$A5
CLOCK_HOUR_Y1 .BYTE   $A5,$A5,$A6,$A6,$A7,$A7,$A7,$A8,$A8,$A9,$A9,$A9,$AA,$AA,$AA,$AB
              .BYTE   $AB,$AC,$AC,$AC,$AD,$AD,$AD,$AE,$AE,$AE,$AF,$AF,$AF,$B0,$B0,$B0
              .BYTE   $B1,$B1,$B1,$B1,$B2,$B2,$B2,$B3,$B3,$B3,$B3,$B4,$B4,$B4,$B4,$B5
              .BYTE   $B5,$B5,$B5,$B6,$B6,$B6,$B6,$B7,$B7,$B7,$B7,$B7,$B8,$B8,$B8,$B8
              .BYTE   $B8,$B9,$B9,$B9,$B9,$B9,$B9,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$BB
              .BYTE   $BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BC,$BC,$BC,$BC,$BC,$BC
              .BYTE   $BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC,$BC
              .BYTE   $BC,$BC,$BC,$BC,$BC,$BC,$BC,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB,$BB
              .BYTE   $BB,$BB,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$BA,$B9,$B9,$B9,$B9,$B9,$B9
              .BYTE   $B8,$B8,$B8,$B8,$B8,$B7,$B7,$B7,$B7,$B7,$B6,$B6,$B6,$B6,$B5,$B5
              .BYTE   $B5,$B5,$B4,$B4,$B4,$B4,$B3,$B3,$B3,$B3,$B2,$B2,$B2,$B1,$B1,$B1
              .BYTE   $B1,$B0,$B0,$B0,$AF,$AF,$AF,$AE,$AE,$AE,$AD,$AD,$AD,$AC,$AC,$AC
              .BYTE   $AB,$AB,$AA,$AA,$AA,$A9,$A9,$A9,$A8,$A8,$A7,$A7,$A7,$A6,$A6,$A5
              .BYTE   $A5,$A5,$A4,$A4,$A3,$A3,$A2,$A2,$A2,$A1,$A1,$A0,$A0,$9F,$9F,$9E
              .BYTE   $9E,$9E,$9D,$9D,$9C,$9C,$9B,$9B,$9A,$9A,$99,$99,$98,$98,$97,$97
              .BYTE   $96,$96,$96,$95,$95,$94,$94,$93,$93,$92,$92,$91,$91,$90,$90,$8F
CLOCK_HOUR_Y2 .BYTE   $8F,$8E,$8D,$8D,$8C,$8C,$8B,$8B,$8A,$8A,$89,$89,$88,$88,$87,$87
              .BYTE   $86,$86,$85,$85,$84,$84,$83,$83,$82,$82,$81,$81,$80,$7F,$7F,$7E
              .BYTE   $7E,$7D,$7D,$7C,$7C,$7B,$7B,$7A,$7A,$79,$79,$78,$78,$77,$77,$76
              .BYTE   $76,$75,$75,$74,$74,$73,$73,$72,$71,$71,$70,$70,$6F,$6F,$6E,$6E
              .BYTE   $6D,$6D,$6C,$6C,$6B,$6B,$6A,$6A,$6A,$69,$69,$68,$68,$67,$67,$66
              .BYTE   $66,$65,$65,$64,$64,$63,$63,$62,$62,$62,$61,$61,$60,$60,$5F,$5F
              .BYTE   $5E,$5E,$5E,$5D,$5D,$5C,$5C,$5B,$5B,$5B,$5A,$5A,$59,$59,$59,$58
              .BYTE   $58,$57,$57,$57,$56,$56,$56,$55,$55,$54,$54,$54,$53,$53,$53,$52
              .BYTE   $52,$52,$51,$51,$51,$50,$50,$50,$4F,$4F,$4F,$4F,$4E,$4E,$4E,$4D
              .BYTE   $4D,$4D,$4D,$4C,$4C,$4C,$4C,$4B,$4B,$4B,$4B,$4A,$4A,$4A,$4A,$49
              .BYTE   $49,$49,$49,$49,$48,$48,$48,$48,$48,$47,$47,$47,$47,$47,$47,$46
              .BYTE   $46,$46,$46,$46,$46,$46,$46,$45,$45,$45,$45,$45,$45,$45,$45,$45
              .BYTE   $45,$45,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44,$44

; -----------------------------------------------------------------------------
; Normalized ad-hoc polygon dataset for the twelve 5-minute marks.
;
; Geometry:
;   normalized center = (128,128)
;   inner radius       = 84
;   outer radius       = 118
;   half thickness     = 6
;
; Since the complete polygon is scaled through VF_X1/VF_Y1, these dimensions
; are proportions, not HGR pixel dimensions.
; -----------------------------------------------------------------------------

CLOCK_TICK_POLY
            .BYTE   $0C             ; 12 five-minute marks
; 00 minutes /   0 degrees
            .BYTE   $04,$7A,$2C,$7A,$0A,$86,$0A,$86,$2C
; 05 minutes /  30 degrees
            .BYTE   $04,$A5,$34,$B6,$17,$C0,$1D,$AF,$3A
; 10 minutes /  60 degrees
            .BYTE   $04,$C6,$51,$E3,$40,$E9,$4A,$CC,$5B
; 15 minutes /  90 degrees
            .BYTE   $04,$D4,$7A,$F6,$7A,$F6,$86,$D4,$86
; 20 minutes / 120 degrees
            .BYTE   $04,$CC,$A5,$E9,$B6,$E3,$C0,$C6,$AF
; 25 minutes / 150 degrees
            .BYTE   $04,$AF,$C6,$C0,$E3,$B6,$E9,$A5,$CC
; 30 minutes / 180 degrees
            .BYTE   $04,$86,$D4,$86,$F6,$7A,$F6,$7A,$D4
; 35 minutes / 210 degrees
            .BYTE   $04,$5B,$CC,$4A,$E9,$40,$E3,$51,$C6
; 40 minutes / 240 degrees
            .BYTE   $04,$3A,$AF,$1D,$C0,$17,$B6,$34,$A5
; 45 minutes / 270 degrees
            .BYTE   $04,$2C,$86,$0A,$86,$0A,$7A,$2C,$7A
; 50 minutes / 300 degrees
            .BYTE   $04,$34,$5B,$17,$4A,$1D,$40,$3A,$51
; 55 minutes / 330 degrees
            .BYTE   $04,$51,$3A,$40,$1D,$4A,$17,$5B,$34

; Byte offset from CLOCK_TICK_POLY to each contour's point-count byte.
; Each tick contour occupies 9 bytes: $04 followed by four X/Y pairs.
CLOCK_TICK_OFF
            .BYTE   $01,$0A,$13,$1C,$25,$2E,$37,$40,$49,$52,$5B,$64

; Mutable stream used when just one tick must be repaired.
; byte 0 = one contour; bytes 1..9 are replaced by CLOCK_DRAW_ONE_TICK.
CLOCK_ONE_TICK_POLY
            .BYTE   $01,$04,$00,$00,$00,$00,$00,$00,$00,$00

; =============================================================================
; VF_DRAW
; =============================================================================
;
; A = low byte of character code.
;
; Looks up the glyph and renders VF_Y1 output scanlines.  We restart the compact
; glyph stream for every output scanline instead of expanding all vertices into
; RAM.  Only the scanline intersections need temporary storage.
; -----------------------------------------------------------------------------

VF_DRAW     STA     VF_CHAR_LO
            LDA     #$00
            STA     VF_CHAR_HI

            JSR     VF_FIND
            BCC     VFD_RET

; Entry used by both font glyphs and ad-hoc polygon streams.
; VF_GLYPHLO/HI must point at:
;   contour-count,
;   then for each contour: point-count, X,Y pairs.
VF_DRAW_STREAM
            LDA     VF_X1
            BEQ     VFD_RET
            LDA     VF_Y1
            BEQ     VFD_RET
            LDA     VF_Y0
            CMP     #$C0
            BCS     VFD_RET

            JSR     VF_YSETUP

            LDA     #$00
            STA     VF_ROW
            LDA     VF_Y0
            STA     VF_SCREENY

VFD_ROW     LDA     VF_SCREENY
            CMP     #$C0
            BCS     VFD_RET

; Optional screen-space clipping is used by the split-flap transition.
            LDA     VF_CLIPON
            BEQ     VFD_DOROW
            LDA     VF_SCREENY
            CMP     VF_CLIPY0
            BCC     VFD_SKIPROW
            CMP     VF_CLIPY1
            BCS     VFD_SKIPROW

VFD_DOROW   JSR     VF_SCANROW

VFD_SKIPROW INC     VF_ROW
            LDA     VF_ROW
            CMP     VF_Y1
            BEQ     VFD_RET

            INC     VF_SCREENY
            JSR     VF_YADV
            JMP     VFD_ROW

VFD_RET     RTS

; -----------------------------------------------------------------------------
; Find character in VF_CODE_LO/VF_CODE_HI.
; Carry set = found, VF_GLYPHLO/HI = absolute glyph stream address.
; -----------------------------------------------------------------------------

VF_FIND     LDX     #$00
VFF_LOOP    LDA     VF_CODE_LO,X
            CMP     VF_CHAR_LO
            BNE     VFF_NEXT
            LDA     VF_CODE_HI,X
            CMP     VF_CHAR_HI
            BNE     VFF_NEXT

            LDA     VF_OFF_LO,X
            CLC
            ADC     #<VF_DATA
            STA     VF_GLYPHLO
            LDA     VF_OFF_HI,X
            ADC     #>VF_DATA
            STA     VF_GLYPHHI
            SEC
            RTS

VFF_NEXT    INX
            CPX     #VF_GLYPH_COUNT
            BNE     VFF_LOOP
            CLC
            RTS

; =============================================================================
; Vertical resampling
; =============================================================================
;
; We sample the outline at destination pixel centres:
;
;   sourceY(row) = floor((row*256 + 128) / height)
;
; Rather than divide for every row, calculate:
;
;   start       = 128 / height
;   step        = 256 / height
;   stepRemain  = 256 % height
;
; then advance with a remainder accumulator.
; -----------------------------------------------------------------------------

VF_YSETUP   LDA     VF_Y1
            CMP     #$01
            BNE     VFYS_MULTI

; A one-pixel-high glyph samples the normalized outline at its centre.
            LDA     #$80
            STA     VF_YSRC
            LDA     #$00
            STA     VF_YACC
            STA     VF_YSTEP
            STA     VF_YREMSTEP
            RTS

VFYS_MULTI  STA     VF_DIVD

; start = 128 / height, remainder = 128 % height
            LDA     #$80
            STA     VF_DIVNLO
            LDA     #$00
            STA     VF_DIVNHI
            JSR     VF_DIV16_8
            LDA     VF_DIVQLO
            STA     VF_YSRC
            LDA     VF_DIVRLO
            STA     VF_YACC

; step = 256 / height, remainder = 256 % height
            LDA     #$00
            STA     VF_DIVNLO
            LDA     #$01
            STA     VF_DIVNHI
            LDA     VF_Y1
            STA     VF_DIVD
            JSR     VF_DIV16_8
            LDA     VF_DIVQLO
            STA     VF_YSTEP
            LDA     VF_DIVRLO
            STA     VF_YREMSTEP
            RTS

VF_YADV     LDA     VF_YSRC
            CLC
            ADC     VF_YSTEP
            STA     VF_YSRC

            LDA     VF_YACC
            CLC
            ADC     VF_YREMSTEP
            CMP     VF_Y1
            BCC     VFYA_STORE
            SEC
            SBC     VF_Y1
            INC     VF_YSRC
VFYA_STORE  STA     VF_YACC
            RTS

; =============================================================================
; Scan one output row
; =============================================================================

VF_SCANROW  LDA     VF_GLYPHLO
            STA     VF_DPL
            LDA     VF_GLYPHHI
            STA     VF_DPH

            LDA     #$00
            STA     VF_XCOUNT

; First byte = contour count.
            JSR     VF_NEXT
            STA     VF_CLEFT
            BEQ     VFSR_SORT

VFSR_CONT   JSR     VF_NEXT
            STA     VF_PLEFT
            BEQ     VFSR_CDONE

; First point is retained so the final edge can close the contour.
            JSR     VF_NEXT
            STA     VF_FIRSTX
            STA     VF_PREVX
            JSR     VF_NEXT
            STA     VF_FIRSTY
            STA     VF_PREVY

            DEC     VF_PLEFT

VFSR_POINT  LDA     VF_PLEFT
            BEQ     VFSR_CLOSE

            JSR     VF_NEXT
            STA     VF_CURX
            JSR     VF_NEXT
            STA     VF_CURY

            JSR     VF_EDGE

            LDA     VF_CURX
            STA     VF_PREVX
            LDA     VF_CURY
            STA     VF_PREVY

            DEC     VF_PLEFT
            JMP     VFSR_POINT

VFSR_CLOSE  LDA     VF_FIRSTX
            STA     VF_CURX
            LDA     VF_FIRSTY
            STA     VF_CURY
            JSR     VF_EDGE

VFSR_CDONE  DEC     VF_CLEFT
            BNE     VFSR_CONT

VFSR_SORT   JSR     VF_SORT_X
            JSR     VF_FILL_PAIRS
            RTS

; Read one byte from compact glyph stream and post-increment the pointer.
VF_NEXT     LDY     #$00
            LDA     (VF_DPL),Y
            INC     VF_DPL
            BNE     VFN_RET
            INC     VF_DPH
VFN_RET     RTS

; =============================================================================
; Edge / scanline intersection
; =============================================================================
;
; Half-open Y rule:
;       lowY <= sourceY < highY
;
; Horizontal edges are ignored. This prevents a shared contour vertex from
; being counted twice and is the standard parity-fill convention.
; -----------------------------------------------------------------------------

VF_EDGE     LDA     VF_PREVY
            CMP     VF_CURY
            BNE     VFE_NONHOR
            RTS
VFE_NONHOR  BCC     VFE_PREVLOW

; current point is the low-Y endpoint
            LDA     VF_CURX
            STA     VF_LOWX
            LDA     VF_CURY
            STA     VF_LOWY
            LDA     VF_PREVX
            STA     VF_HIGHX
            LDA     VF_PREVY
            STA     VF_HIGHY
            JMP     VFE_CHECK

VFE_PREVLOW LDA     VF_PREVX
            STA     VF_LOWX
            LDA     VF_PREVY
            STA     VF_LOWY
            LDA     VF_CURX
            STA     VF_HIGHX
            LDA     VF_CURY
            STA     VF_HIGHY

VFE_CHECK   LDA     VF_YSRC
            CMP     VF_LOWY
            BCS     VFE_LOWOK
            RTS
VFE_LOWOK   CMP     VF_HIGHY
            BCC     VFE_ACTIVE
            RTS

VFE_ACTIVE  SEC
            SBC     VF_LOWY
            STA     VF_T

            LDA     VF_HIGHY
            SEC
            SBC     VF_LOWY
            STA     VF_DY

; Calculate magnitude of horizontal movement and remember its sign.
            LDA     VF_HIGHX
            CMP     VF_LOWX
            BCC     VFE_LEFT

            SEC
            SBC     VF_LOWX
            STA     VF_DX
            LDA     #$00
            STA     VF_XNEG
            JMP     VFE_MULDIV

VFE_LEFT    LDA     VF_LOWX
            SEC
            SBC     VF_HIGHX
            STA     VF_DX
            LDA     #$01
            STA     VF_XNEG

; quotient = (DX * T) / DY
VFE_MULDIV  LDA     VF_DX
            STA     VF_MA
            LDA     VF_T
            STA     VF_MB
            JSR     VF_MUL8

            LDA     VF_PRODL
            STA     VF_DIVNLO
            LDA     VF_PRODH
            STA     VF_DIVNHI
            LDA     VF_DY
            STA     VF_DIVD
            JSR     VF_DIV16_8

            LDA     VF_XNEG
            BNE     VFE_SUB

            LDA     VF_LOWX
            CLC
            ADC     VF_DIVQLO
            JMP     VFE_STORE

VFE_SUB     LDA     VF_LOWX
            SEC
            SBC     VF_DIVQLO

VFE_STORE   LDX     VF_XCOUNT
            CPX     #$80
            BCS     VFE_RET
            STA     VF_XBUF,X
            INC     VF_XCOUNT
VFE_RET     RTS

; =============================================================================
; Intersection sorting and even/odd fill
; =============================================================================

VF_SORT_X   LDA     VF_XCOUNT
            CMP     #$02
            BCC     VFSX_RET
            SEC
            SBC     #$01
            STA     VF_SORTEND

VFSX_OUTER  LDY     #$00
VFSX_INNER  LDA     VF_XBUF,Y
            CMP     VF_XBUF+1,Y
            BCC     VFSX_ORDER
            BEQ     VFSX_ORDER

            TAX
            LDA     VF_XBUF+1,Y
            STA     VF_XBUF,Y
            TXA
            STA     VF_XBUF+1,Y

VFSX_ORDER  INY
            CPY     VF_SORTEND
            BCC     VFSX_INNER

            DEC     VF_SORTEND
            BNE     VFSX_OUTER
VFSX_RET    RTS

VF_FILL_PAIRS
            LDA     #$00
            STA     VF_PAIRIDX

VFFP_LOOP   LDA     VF_PAIRIDX
            CLC
            ADC     #$01
            CMP     VF_XCOUNT
            BCS     VFFP_RET

            LDX     VF_PAIRIDX
            LDA     VF_XBUF,X
            STA     VF_PAIRX0
            INX
            LDA     VF_XBUF,X
            STA     VF_PAIRX1

; Equal normalized intersections are a tangent/zero-area pair: do not emit a
; spurious pixel.  Distinct source intersections that collapse to one display
; pixel are still rendered as that one pixel.
            CMP     VF_PAIRX0
            BEQ     VFFP_NEXT

            LDA     VF_PAIRX0
            JSR     VF_SCALEX
            LDA     VF_SCALEL
            STA     VF_SPANX0L
            LDA     VF_SCALEH
            STA     VF_SPANX0H

            LDA     VF_PAIRX1
            JSR     VF_SCALEX
            LDA     VF_SCALEL
            STA     VF_SPANX1L
            LDA     VF_SCALEH
            STA     VF_SPANX1H

            LDA     VF_ERASE
            BEQ     VFFP_DRAW
            JSR     VF_HSPAN_CLEAR
            JMP     VFFP_NEXT
VFFP_DRAW   JSR     VF_HSPAN

VFFP_NEXT   LDA     VF_PAIRIDX
            CLC
            ADC     #$02
            STA     VF_PAIRIDX
            JMP     VFFP_LOOP

VFFP_RET    RTS

; normalized X in A -> absolute HGR X in VF_SCALEH:VF_SCALEL
;
; Since normalizedX and width are both 8-bit:
;   floor(normalizedX * width / 256)
; is simply the high byte of their 8x8 product.
VF_SCALEX   STA     VF_MA
            LDA     VF_X1
            STA     VF_MB
            JSR     VF_MUL8

            LDA     VF_X0L
            CLC
            ADC     VF_PRODH
            STA     VF_SCALEL
            LDA     VF_X0H
            ADC     #$00
            STA     VF_SCALEH
            RTS

; =============================================================================
; HGR horizontal span
; =============================================================================
;
; Draw inclusive X0..X1 on VF_SCREENY.  Coordinates are clipped to 0..279.
; The middle of a span is ORed with $7F a byte at a time.
; -----------------------------------------------------------------------------

VF_HSPAN    LDA     VF_SCREENY
            CMP     #$C0
            BCC     VFHS_YOK
            RTS
VFHS_YOK

; Reject if start X >= 280.
            LDA     VF_SPANX0H
            CMP     #$01
            BCC     VFHS_STARTOK
            BEQ     VFHS_STARTHI
            RTS
VFHS_STARTHI
            LDA     VF_SPANX0L
            CMP     #$18
            BCC     VFHS_STARTOK
            RTS

VFHS_STARTOK
; Clip end X to 279.
            LDA     VF_SPANX1H
            CMP     #$01
            BCC     VFHS_ENDOK
            BNE     VFHS_CLIPEND
            LDA     VF_SPANX1L
            CMP     #$18
            BCC     VFHS_ENDOK

VFHS_CLIPEND
            LDA     #$01
            STA     VF_SPANX1H
            LDA     #$17
            STA     VF_SPANX1L

VFHS_ENDOK  LDX     VF_SCREENY
            LDA     HGRLO,X
            STA     VF_HPL
            LDA     HGRHI,X
            STA     VF_HPH

; Start HGR byte column + bit number.
            LDA     VF_SPANX0L
            STA     VF_TMPXL
            LDA     VF_SPANX0H
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDA     VF_COL
            STA     VF_SCOL
            LDA     VF_MOD
            STA     VF_SMOD

; End HGR byte column + bit number.
            LDA     VF_SPANX1L
            STA     VF_TMPXL
            LDA     VF_SPANX1H
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDA     VF_COL
            STA     VF_ECOL
            LDA     VF_MOD
            STA     VF_EMOD

; Mask start byte.
            LDX     VF_SMOD
            LDA     VF_LEFTMASK,X
            STA     VF_MASK

            LDA     VF_SCOL
            CMP     VF_ECOL
            BNE     VFHS_MULTI

; Entire span is within one HGR byte.
            LDX     VF_EMOD
            LDA     VF_RIGHTMASK,X
            AND     VF_MASK
            STA     VF_MASK
            LDY     VF_SCOL
            LDA     (VF_HPL),Y
            ORA     VF_MASK
            STA     (VF_HPL),Y
            RTS

VFHS_MULTI  LDY     VF_SCOL
            LDA     (VF_HPL),Y
            ORA     VF_MASK
            STA     (VF_HPL),Y
            INY

VFHS_MID    CPY     VF_ECOL
            BEQ     VFHS_LAST
            LDA     (VF_HPL),Y
            ORA     #$7F
            STA     (VF_HPL),Y
            INY
            JMP     VFHS_MID

VFHS_LAST   LDX     VF_EMOD
            LDA     VF_RIGHTMASK,X
            STA     VF_MASK
            LDA     (VF_HPL),Y
            ORA     VF_MASK
            STA     (VF_HPL),Y
VFHS_RET    RTS


; -----------------------------------------------------------------------------
; Clear inclusive X0..X1 on VF_SCREENY.
;
; This mirrors VF_HSPAN but ANDs the inverse masks.  It is used only for the
; compact calendar field rectangles during flip transitions.
; -----------------------------------------------------------------------------

VF_HSPAN_CLEAR
            LDA     VF_SCREENY
            CMP     #$C0
            BCC     VFHSC_YOK
            RTS
VFHSC_YOK

            LDA     VF_SPANX0H
            CMP     #$01
            BCC     VFHSC_STARTOK
            BEQ     VFHSC_STARTHI
            RTS
VFHSC_STARTHI
            LDA     VF_SPANX0L
            CMP     #$18
            BCC     VFHSC_STARTOK
            RTS

VFHSC_STARTOK
            LDA     VF_SPANX1H
            CMP     #$01
            BCC     VFHSC_ENDOK
            BNE     VFHSC_CLIPEND
            LDA     VF_SPANX1L
            CMP     #$18
            BCC     VFHSC_ENDOK

VFHSC_CLIPEND
            LDA     #$01
            STA     VF_SPANX1H
            LDA     #$17
            STA     VF_SPANX1L

VFHSC_ENDOK LDX     VF_SCREENY
            LDA     HGRLO,X
            STA     VF_HPL
            LDA     HGRHI,X
            STA     VF_HPH

            LDA     VF_SPANX0L
            STA     VF_TMPXL
            LDA     VF_SPANX0H
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDA     VF_COL
            STA     VF_SCOL
            LDA     VF_MOD
            STA     VF_SMOD

            LDA     VF_SPANX1L
            STA     VF_TMPXL
            LDA     VF_SPANX1H
            STA     VF_TMPXH
            JSR     VF_XCELL
            LDA     VF_COL
            STA     VF_ECOL
            LDA     VF_MOD
            STA     VF_EMOD

            LDX     VF_SMOD
            LDA     VF_LEFTMASK,X
            STA     VF_MASK

            LDA     VF_SCOL
            CMP     VF_ECOL
            BNE     VFHSC_MULTI

            LDX     VF_EMOD
            LDA     VF_RIGHTMASK,X
            AND     VF_MASK
            EOR     #$FF
            STA     VF_MASK
            LDY     VF_SCOL
            LDA     (VF_HPL),Y
            AND     VF_MASK
            STA     (VF_HPL),Y
            RTS

VFHSC_MULTI LDY     VF_SCOL
            LDA     VF_MASK
            EOR     #$7F
            STA     VF_MASK
            LDA     (VF_HPL),Y
            AND     VF_MASK
            STA     (VF_HPL),Y
            INY

VFHSC_MID   CPY     VF_ECOL
            BEQ     VFHSC_LAST
            LDA     (VF_HPL),Y
            AND     #$80            ; clear seven HGR color bits, preserve phase bit
            STA     (VF_HPL),Y
            INY
            JMP     VFHSC_MID

VFHSC_LAST  LDX     VF_EMOD
            LDA     VF_RIGHTMASK,X
            EOR     #$FF
            STA     VF_MASK
            LDA     (VF_HPL),Y
            AND     VF_MASK
            STA     (VF_HPL),Y
            RTS

; Convert absolute 9-bit HGR X in VF_TMPXH:VF_TMPXL into:
;   VF_COL = byte column 0..39
;   VF_MOD = pixel bit number 0..6
VF_XCELL    LDA     VF_TMPXH
            BEQ     VFXC_LOW
            LDX     VF_TMPXL
            LDA     XCOL1,X
            STA     VF_COL
            LDA     XMOD1,X
            STA     VF_MOD
            RTS

VFXC_LOW    LDX     VF_TMPXL
            LDA     XCOL0,X
            STA     VF_COL
            LDA     XMOD0,X
            STA     VF_MOD
            RTS

; =============================================================================
; Arithmetic
; =============================================================================

; Unsigned 8x8 multiply.
;   VF_MA * VF_MB -> VF_PRODH:VF_PRODL
VF_MUL8     LDA     #$00
            STA     VF_PRODL
            STA     VF_PRODH
            STA     VF_MCH
            LDA     VF_MA
            STA     VF_MCL
            LDA     VF_MB
            STA     VF_MULR
            LDX     #$08

VFM_LOOP    LSR     VF_MULR
            BCC     VFM_NOADD

            LDA     VF_PRODL
            CLC
            ADC     VF_MCL
            STA     VF_PRODL
            LDA     VF_PRODH
            ADC     VF_MCH
            STA     VF_PRODH

VFM_NOADD   ASL     VF_MCL
            ROL     VF_MCH
            DEX
            BNE     VFM_LOOP
            RTS

; Unsigned 16/8 divide.
;
;   dividend = VF_DIVNHI:VF_DIVNLO
;   divisor  = VF_DIVD (must be nonzero)
;
; Result:
;   quotient = VF_DIVQHI:VF_DIVQLO
;   remainder= VF_DIVRHI:VF_DIVRLO
;
; The glyph intersection quotient is guaranteed <=255, but this routine is
; general and returns the complete 16-bit quotient.
VF_DIV16_8  LDA     #$00
            STA     VF_DIVQLO
            STA     VF_DIVQHI
            STA     VF_DIVRLO
            STA     VF_DIVRHI
            LDX     #$10

VFDV_LOOP   ASL     VF_DIVNLO
            ROL     VF_DIVNHI
            ROL     VF_DIVRLO
            ROL     VF_DIVRHI

            ASL     VF_DIVQLO
            ROL     VF_DIVQHI

            LDA     VF_DIVRHI
            BNE     VFDV_SUB
            LDA     VF_DIVRLO
            CMP     VF_DIVD
            BCC     VFDV_NOSUB

VFDV_SUB    LDA     VF_DIVRLO
            SEC
            SBC     VF_DIVD
            STA     VF_DIVRLO
            LDA     VF_DIVRHI
            SBC     #$00
            STA     VF_DIVRHI

; Q was just shifted left, therefore bit 0 is known clear.
            INC     VF_DIVQLO

VFDV_NOSUB  DEX
            BNE     VFDV_LOOP
            RTS

; =============================================================================
; HGR utility
; =============================================================================

HCLR        LDA     #$00
            STA     VF_HCLRY

HCLR_ROW    LDX     VF_HCLRY
            LDA     HGRLO,X
            STA     VF_HPL
            LDA     HGRHI,X
            STA     VF_HPH

            LDY     #$27
            LDA     #$00
HCLR_BYTE   STA     (VF_HPL),Y
            DEY
            BPL     HCLR_BYTE

            INC     VF_HCLRY
            LDA     VF_HCLRY
            CMP     #$C0
            BNE     HCLR_ROW
            RTS

; =============================================================================
; Resident service state
; =============================================================================

RES_ACTIVE      .BYTE   $00        ; $A5 while installed
RES_CALLP       .BYTE   $00        ; temporary caller processor status
RES_OLDP        .BYTE   $00        ; processor status before first install
RES_OLDIRQ      .BYTE   $00,$00    ; previous $03FE/$03FF vector
RES_OLD_RTC_B   .BYTE   $00        ; 6818 Register B before UIE was added
RES_IRQ_FLAGS   .BYTE   $00

; Monitor text-window state restored by CALL $6003.
RES_OLD_WNDLFT  .BYTE   $00
RES_OLD_WNDWDTH .BYTE   $28
RES_OLD_WNDTOP  .BYTE   $00
RES_OLD_WNDBTM  .BYTE   $18
RES_OLD_CH      .BYTE   $00
RES_OLD_CV      .BYTE   $00

; Foreground zero-page values temporarily displaced by the vector renderer.
RES_ZP_F0       .BYTE   $00
RES_ZP_F1       .BYTE   $00
RES_ZP_F2       .BYTE   $00
RES_ZP_F3       .BYTE   $00

; =============================================================================
; Renderer state
; =============================================================================

; Public call parameters.
VF_X0L      .BYTE   $00
VF_X0H      .BYTE   $00
VF_Y0       .BYTE   $00
VF_X1       .BYTE   $18
VF_Y1       .BYTE   $2E

VF_CHAR_LO  .BYTE   $00
VF_CHAR_HI  .BYTE   $00

; 0 = OR/fill pixels, nonzero = clear filled polygon pixels.
; Used to erase only the old hour/minute hand polygons at minute boundaries.
VF_ERASE    .BYTE   $00

VF_GLYPHLO  .BYTE   $00
VF_GLYPHHI  .BYTE   $00

; Generic ad-hoc polygon stream pointer.
VF_POLYLO   .BYTE   $00
VF_POLYHI   .BYTE   $00

; Shared analog-clock public parameters.
; X0/Y0 are the CENTER; X1/Y1 are complete width/height.
CLOCK_X0L    .BYTE   $00
CLOCK_X0H    .BYTE   $00
CLOCK_Y0     .BYTE   $00
CLOCK_X1     .BYTE   $48
CLOCK_Y1     .BYTE   $48
CLOCK_HALF   .BYTE   $00
CLOCK_LEFTL  .BYTE   $00
CLOCK_LEFTH  .BYTE   $00
CLOCK_TOP    .BYTE   $00
CLOCK_INIT   .BYTE   $00
CLOCK_SECIDX .BYTE   $FF
CLOCK_SEC_WORK .BYTE $00
CLOCK_LAST_MIN .BYTE $00
CLOCK_LAST_HOUR .BYTE $00
CLOCK_MIN_WORK .BYTE $00
CLOCK_HOUR_WORK .BYTE $00
CLOCK_TIPX   .BYTE   $80
CLOCK_TIPY   .BYTE   $20
CLOCK_DX     .BYTE   $00
CLOCK_DY     .BYTE   $00
CLOCK_PX     .BYTE   $00
CLOCK_PY     .BYTE   $00
CLOCK_WSHIFT .BYTE   $04
CLOCK_HIDXLO .BYTE   $00
CLOCK_HIDXHI .BYTE   $00
CLOCK_SCALEL .BYTE   $00
CLOCK_SCALEH .BYTE   $00
CLOCK_LX0L   .BYTE   $00
CLOCK_LX0H   .BYTE   $00
CLOCK_LY0    .BYTE   $00
CLOCK_LX1L   .BYTE   $00
CLOCK_LX1H   .BYTE   $00
CLOCK_LY1    .BYTE   $00
CLOCK_CXL    .BYTE   $00
CLOCK_CXH    .BYTE   $00
CLOCK_CY     .BYTE   $00
CLOCK_DLX    .BYTE   $00
CLOCK_DLY    .BYTE   $00
CLOCK_SX     .BYTE   $01
CLOCK_SY     .BYTE   $01
CLOCK_ERR    .BYTE   $00
CLOCK_BITMASK .BYTE  $01,$02,$04,$08,$10,$20,$40

VF_ROW      .BYTE   $00
VF_SCREENY  .BYTE   $00
VF_YSRC     .BYTE   $00
VF_YSTEP    .BYTE   $00
VF_YREMSTEP .BYTE   $00
VF_YACC     .BYTE   $00

VF_CLEFT    .BYTE   $00
VF_PLEFT    .BYTE   $00
VF_FIRSTX   .BYTE   $00
VF_FIRSTY   .BYTE   $00
VF_PREVX    .BYTE   $00
VF_PREVY    .BYTE   $00
VF_CURX     .BYTE   $00
VF_CURY     .BYTE   $00

VF_LOWX     .BYTE   $00
VF_LOWY     .BYTE   $00
VF_HIGHX    .BYTE   $00
VF_HIGHY    .BYTE   $00
VF_DX       .BYTE   $00
VF_DY       .BYTE   $00
VF_T        .BYTE   $00
VF_XNEG     .BYTE   $00

VF_XCOUNT   .BYTE   $00
VF_SORTEND  .BYTE   $00
VF_PAIRIDX  .BYTE   $00
VF_PAIRX0   .BYTE   $00
VF_PAIRX1   .BYTE   $00

VF_SCALEL   .BYTE   $00
VF_SCALEH   .BYTE   $00
VF_SPANX0L  .BYTE   $00
VF_SPANX0H  .BYTE   $00
VF_SPANX1L  .BYTE   $00
VF_SPANX1H  .BYTE   $00

VF_TMPXL    .BYTE   $00
VF_TMPXH    .BYTE   $00
VF_COL      .BYTE   $00
VF_MOD      .BYTE   $00
VF_SCOL     .BYTE   $00
VF_SMOD     .BYTE   $00
VF_ECOL     .BYTE   $00
VF_EMOD     .BYTE   $00
VF_MASK     .BYTE   $00

VF_MA       .BYTE   $00
VF_MB       .BYTE   $00
VF_MCL      .BYTE   $00
VF_MCH      .BYTE   $00
VF_MULR     .BYTE   $00
VF_PRODL    .BYTE   $00
VF_PRODH    .BYTE   $00

VF_DIVNLO   .BYTE   $00
VF_DIVNHI   .BYTE   $00
VF_DIVD     .BYTE   $01
VF_DIVQLO   .BYTE   $00
VF_DIVQHI   .BYTE   $00
VF_DIVRLO   .BYTE   $00
VF_DIVRHI   .BYTE   $00

VF_HCLRY    .BYTE   $00

; Optional clipping for VF_DRAW.  Y1 is exclusive.
VF_CLIPON   .BYTE   $00
VF_CLIPY0   .BYTE   $00
VF_CLIPY1   .BYTE   $C0

; Serial Pro RTC snapshot.
RTC_MODE      .BYTE $00
RTC_SEC0      .BYTE $00
RTC_SEC1      .BYTE $00
RTC_SEC_RAW   .BYTE $00
RTC_MIN_RAW   .BYTE $00
RTC_HOUR_RAW  .BYTE $00
RTC_DOW_RAW   .BYTE $00
RTC_DAY_RAW   .BYTE $00
RTC_MONTH_RAW .BYTE $00
RTC_YEAR_RAW  .BYTE $00
RTC_SEC       .BYTE $00
RTC_MIN       .BYTE $00
RTC_HOUR      .BYTE $00
RTC_DOW       .BYTE $00
RTC_DAY       .BYTE $00
RTC_MONTH     .BYTE $00
RTC_YEAR      .BYTE $00
RTC_PM        .BYTE $00
RTC_TMP0      .BYTE $00
RTC_TMP1      .BYTE $00

; Last calendar state painted on HGR.
DSP_YEAR    .BYTE   $FF
DSP_MONTH   .BYTE   $FF
DSP_DAY     .BYTE   $FF
DSP_DOW     .BYTE   $FF
DSP_PM      .BYTE   $FF
LAST_SEC    .BYTE   $FF

; Calendar renderer / flip state.
CAL_FIELD   .BYTE   $00
CAL_Y0      .BYTE   $00
CAL_MID     .BYTE   $00
CAL_Y1      .BYTE   $00
CAL_TENS    .BYTE   $30
CAL_ONES    .BYTE   $30
CAL_TMP     .BYTE   $00
CAL_DIGX    .BYTE   $00
CAL_CH0     .BYTE   $00
CAL_CH1     .BYTE   $00
CAL_CH2     .BYTE   $00

; Static inscription renderer / orange-conversion state.
INS_IDX     .BYTE   $00
INS_XL      .BYTE   $00
INS_XH      .BYTE   $00
INS_SCOL    .BYTE   $00
INS_ECOL    .BYTE   $00
INS_ROW     .BYTE   $00
INS_ENDY    .BYTE   $00

CLR_X0L     .BYTE   $00
CLR_X0H     .BYTE   $00
CLR_X1L     .BYTE   $00
CLR_X1H     .BYTE   $00
CLR_Y0      .BYTE   $00
CLR_Y1      .BYTE   $00

VF_LEFTMASK .BYTE   $7F,$7E,$7C,$78,$70,$60,$40
VF_RIGHTMASK
            .BYTE   $01,$03,$07,$0F,$1F,$3F,$7F

; Up to 128 normalized-X crossings for one scanline.
VF_XBUF
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00

; =============================================================================
; HGR lookup tables
; =============================================================================

HGRLO         .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$80,$80,$80,$80,$80,$80,$80,$80
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$80,$80,$80,$80,$80,$80,$80,$80
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$80,$80,$80,$80,$80,$80,$80,$80
              .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$80,$80,$80,$80,$80,$80,$80,$80
              .BYTE   $28,$28,$28,$28,$28,$28,$28,$28,$A8,$A8,$A8,$A8,$A8,$A8,$A8,$A8
              .BYTE   $28,$28,$28,$28,$28,$28,$28,$28,$A8,$A8,$A8,$A8,$A8,$A8,$A8,$A8
              .BYTE   $28,$28,$28,$28,$28,$28,$28,$28,$A8,$A8,$A8,$A8,$A8,$A8,$A8,$A8
              .BYTE   $28,$28,$28,$28,$28,$28,$28,$28,$A8,$A8,$A8,$A8,$A8,$A8,$A8,$A8
              .BYTE   $50,$50,$50,$50,$50,$50,$50,$50,$D0,$D0,$D0,$D0,$D0,$D0,$D0,$D0
              .BYTE   $50,$50,$50,$50,$50,$50,$50,$50,$D0,$D0,$D0,$D0,$D0,$D0,$D0,$D0
              .BYTE   $50,$50,$50,$50,$50,$50,$50,$50,$D0,$D0,$D0,$D0,$D0,$D0,$D0,$D0
              .BYTE   $50,$50,$50,$50,$50,$50,$50,$50,$D0,$D0,$D0,$D0,$D0,$D0,$D0,$D0

HGRHI         .BYTE   $20,$24,$28,$2C,$30,$34,$38,$3C,$20,$24,$28,$2C,$30,$34,$38,$3C
              .BYTE   $21,$25,$29,$2D,$31,$35,$39,$3D,$21,$25,$29,$2D,$31,$35,$39,$3D
              .BYTE   $22,$26,$2A,$2E,$32,$36,$3A,$3E,$22,$26,$2A,$2E,$32,$36,$3A,$3E
              .BYTE   $23,$27,$2B,$2F,$33,$37,$3B,$3F,$23,$27,$2B,$2F,$33,$37,$3B,$3F
              .BYTE   $20,$24,$28,$2C,$30,$34,$38,$3C,$20,$24,$28,$2C,$30,$34,$38,$3C
              .BYTE   $21,$25,$29,$2D,$31,$35,$39,$3D,$21,$25,$29,$2D,$31,$35,$39,$3D
              .BYTE   $22,$26,$2A,$2E,$32,$36,$3A,$3E,$22,$26,$2A,$2E,$32,$36,$3A,$3E
              .BYTE   $23,$27,$2B,$2F,$33,$37,$3B,$3F,$23,$27,$2B,$2F,$33,$37,$3B,$3F
              .BYTE   $20,$24,$28,$2C,$30,$34,$38,$3C,$20,$24,$28,$2C,$30,$34,$38,$3C
              .BYTE   $21,$25,$29,$2D,$31,$35,$39,$3D,$21,$25,$29,$2D,$31,$35,$39,$3D
              .BYTE   $22,$26,$2A,$2E,$32,$36,$3A,$3E,$22,$26,$2A,$2E,$32,$36,$3A,$3E
              .BYTE   $23,$27,$2B,$2F,$33,$37,$3B,$3F,$23,$27,$2B,$2F,$33,$37,$3B,$3F

; X 0..255 -> HGR byte column / bit-within-byte
XCOL0         .BYTE   $00,$00,$00,$00,$00,$00,$00,$01,$01,$01,$01,$01,$01,$01,$02,$02
              .BYTE   $02,$02,$02,$02,$02,$03,$03,$03,$03,$03,$03,$03,$04,$04,$04,$04
              .BYTE   $04,$04,$04,$05,$05,$05,$05,$05,$05,$05,$06,$06,$06,$06,$06,$06
              .BYTE   $06,$07,$07,$07,$07,$07,$07,$07,$08,$08,$08,$08,$08,$08,$08,$09
              .BYTE   $09,$09,$09,$09,$09,$09,$0A,$0A,$0A,$0A,$0A,$0A,$0A,$0B,$0B,$0B
              .BYTE   $0B,$0B,$0B,$0B,$0C,$0C,$0C,$0C,$0C,$0C,$0C,$0D,$0D,$0D,$0D,$0D
              .BYTE   $0D,$0D,$0E,$0E,$0E,$0E,$0E,$0E,$0E,$0F,$0F,$0F,$0F,$0F,$0F,$0F
              .BYTE   $10,$10,$10,$10,$10,$10,$10,$11,$11,$11,$11,$11,$11,$11,$12,$12
              .BYTE   $12,$12,$12,$12,$12,$13,$13,$13,$13,$13,$13,$13,$14,$14,$14,$14
              .BYTE   $14,$14,$14,$15,$15,$15,$15,$15,$15,$15,$16,$16,$16,$16,$16,$16
              .BYTE   $16,$17,$17,$17,$17,$17,$17,$17,$18,$18,$18,$18,$18,$18,$18,$19
              .BYTE   $19,$19,$19,$19,$19,$19,$1A,$1A,$1A,$1A,$1A,$1A,$1A,$1B,$1B,$1B
              .BYTE   $1B,$1B,$1B,$1B,$1C,$1C,$1C,$1C,$1C,$1C,$1C,$1D,$1D,$1D,$1D,$1D
              .BYTE   $1D,$1D,$1E,$1E,$1E,$1E,$1E,$1E,$1E,$1F,$1F,$1F,$1F,$1F,$1F,$1F
              .BYTE   $20,$20,$20,$20,$20,$20,$20,$21,$21,$21,$21,$21,$21,$21,$22,$22
              .BYTE   $22,$22,$22,$22,$22,$23,$23,$23,$23,$23,$23,$23,$24,$24,$24,$24

XMOD0         .BYTE   $00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01
              .BYTE   $02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03
              .BYTE   $04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05
              .BYTE   $06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00
              .BYTE   $01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02
              .BYTE   $03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04
              .BYTE   $05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06
              .BYTE   $00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01
              .BYTE   $02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03
              .BYTE   $04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05
              .BYTE   $06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00
              .BYTE   $01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02
              .BYTE   $03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04
              .BYTE   $05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06
              .BYTE   $00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01
              .BYTE   $02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03

; X 256..279, indexed by low byte 0..23
XCOL1         .BYTE   $24,$24,$24,$25,$25,$25,$25,$25,$25,$25,$26,$26,$26,$26,$26,$26
              .BYTE   $26,$27,$27,$27,$27,$27,$27,$27
XMOD1         .BYTE   $04,$05,$06,$00,$01,$02,$03,$04,$05,$06,$00,$01,$02,$03,$04,$05
              .BYTE   $06,$00,$01,$02,$03,$04,$05,$06

; =============================================================================
; Attached generated Friend Bestie dataset (verbatim)
; =============================================================================

; -----------------------------------------------------------------------------
; Friend Bestie - normalized vector glyph dataset
; Source file: Friend Bestie.otf
; Generated locally in the browser by OTF -> 6502 Vector Font Tables
; Flatten tolerance: 8 font units; max curve segment: 64
; Normalization: tight glyph bounds; Y inverted (0=top)
; Manual normalized-point edits: 36 glyph(s)
;
; Stream format at VF_DATA + offset:
;   byte 0             contour count
;   for each contour:  point count, then X,Y byte pairs
; Closed contours are implicit: the final point connects back to the first.
; Coordinates are 0..255 and intended for runtime scaling to (X0,Y0,X1,Y1).
; Fill with an even/odd or equivalent winding-aware polygon rule to preserve holes.
; VF_ADV is advanceWidth / unitsPerEm normalized to 0..255.
; -----------------------------------------------------------------------------

VF_GLYPH_COUNT EQU     $0024
VF_DATA_BYTES  EQU     $0CBE

VF_CODE_LO
            .BYTE   $30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$41,$42,$43,$44,$45,$46
            .BYTE   $47,$48,$49,$4A,$4B,$4C,$4D,$4E,$4F,$50,$51,$52,$53,$54,$55,$56
            .BYTE   $57,$58,$59,$5A
VF_CODE_HI
            .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
            .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
            .BYTE   $00,$00,$00,$00
VF_OFF_LO
            .BYTE   $00,$61,$9D,$FF,$7B,$D2,$4E,$D7,$13,$91,$F8,$45,$B5,$21,$7E,$B4
            .BYTE   $EC,$50,$A6,$CC,$0E,$68,$8C,$E6,$38,$9F,$EC,$71,$D8,$70,$9A,$EC
            .BYTE   $5E,$D8,$3C,$84
VF_OFF_HI
            .BYTE   $00,$00,$00,$00,$01,$01,$02,$02,$03,$03,$03,$04,$04,$05,$05,$05
            .BYTE   $05,$06,$06,$06,$07,$07,$07,$07,$08,$08,$08,$09,$09,$0A,$0A,$0A
            .BYTE   $0B,$0B,$0C,$0C
VF_ADV
            .BYTE   $A7,$6E,$9B,$9E,$A8,$9E,$A9,$95,$A5,$A9,$BD,$AF,$BD,$BD,$9A,$91
            .BYTE   $BE,$BA,$51,$A1,$B3,$8F,$D7,$B9,$BE,$AE,$BE,$B0,$B4,$A0,$B0,$BD
            .BYTE   $FC,$BD,$B1,$9B

VF_DATA

; U+0030 0  glyph=zero  contours=2 points=47 offset=$0000 edited
VF_G_0030
            .BYTE   $02
; contour 0
            .BYTE   $20,$FD,$99,$FF,$72,$FD,$62,$F4,$43,$E2,$26,$C7,$10,$B6,$09,$9B
            .BYTE   $02,$80,$00,$66,$02,$4F,$08,$3B,$11,$2A,$1E,$1C,$2D,$10,$3E,$08
            .BYTE   $51,$02,$66,$00,$89,$06,$AF,$0D,$C1,$18,$D2,$2D,$E7,$39,$EF,$53
            .BYTE   $FA,$62,$FD,$82,$FF,$9C,$FD,$B2,$F7,$C6,$EE,$D7,$E1,$E5,$D2,$F8
            .BYTE   $AE
; contour 1
            .BYTE   $0F,$78,$B1,$6B,$A4,$64,$87,$68,$67,$70,$54,$81,$4C,$86,$4D,$91
            .BYTE   $56,$97,$63,$9A,$79,$9A,$8A,$98,$96,$93,$A3,$8B,$AE,$7E,$B2

; U+0031 1  glyph=one  contours=1 points=29 offset=$0061 edited
VF_G_0031
            .BYTE   $01
; contour 0
            .BYTE   $1D,$D6,$FF,$EF,$FC,$FA,$F6,$FE,$E7,$FE,$38,$FF,$13,$FB,$0A,$F3
            .BYTE   $04,$E1,$01,$8B,$00,$78,$03,$67,$08,$53,$11,$2B,$20,$0B,$2A,$01
            .BYTE   $33,$00,$3A,$03,$5F,$06,$68,$08,$6A,$0E,$6C,$3D,$5E,$4A,$59,$56
            .BYTE   $59,$57,$5A,$57,$E7,$5A,$F6,$6B,$FD,$7F,$FF

; U+0032 2  glyph=two  contours=1 points=48 offset=$009D edited
VF_G_0032
            .BYTE   $01
; contour 0
            .BYTE   $30,$FB,$FA,$FE,$F2,$FE,$C0,$FB,$B8,$EC,$B3,$AB,$B3,$AA,$AF,$AF
            .BYTE   $A9,$D2,$91,$EC,$7B,$F6,$6D,$FD,$5D,$FF,$4B,$FC,$38,$F4,$28,$E9
            .BYTE   $1B,$D9,$11,$C7,$09,$B3,$04,$9D,$01,$6A,$01,$52,$06,$3E,$0D,$2C
            .BYTE   $17,$1D,$23,$11,$33,$07,$44,$01,$58,$00,$65,$08,$6B,$40,$6B,$51
            .BYTE   $67,$61,$56,$6F,$52,$7D,$54,$87,$59,$87,$67,$7B,$78,$4D,$99,$27
            .BYTE   $AF,$0F,$C0,$06,$CA,$04,$D7,$05,$ED,$08,$F8,$0D,$FD,$1C,$FF,$EC
            .BYTE   $FF

; U+0033 3  glyph=three  contours=1 points=61 offset=$00FF edited
VF_G_0033
            .BYTE   $01
; contour 0
            .BYTE   $3D,$EF,$DF,$FA,$CD,$FF,$B9,$FD,$A5,$F5,$94,$E5,$87,$D6,$7E,$D2
            .BYTE   $79,$D3,$75,$E5,$66,$F4,$54,$FA,$3F,$F7,$29,$EE,$1C,$E0,$12,$D0
            .BYTE   $0A,$BD,$05,$95,$00,$57,$03,$32,$0E,$22,$17,$14,$22,$09,$30,$02
            .BYTE   $41,$01,$4A,$09,$4E,$49,$4F,$5B,$44,$6C,$3F,$86,$44,$8C,$49,$8F
            .BYTE   $4F,$90,$56,$85,$60,$74,$63,$66,$63,$55,$66,$55,$8F,$5A,$93,$83
            .BYTE   $98,$8B,$9E,$8D,$A4,$8C,$AF,$81,$B9,$6E,$BD,$5B,$B8,$49,$AD,$08
            .BYTE   $AD,$00,$B2,$01,$BB,$08,$CD,$13,$DB,$21,$E7,$31,$F0,$43,$F7,$56
            .BYTE   $FC,$90,$FF,$AF,$FC,$CD,$F5,$DB,$EF,$E6,$E8

; U+0034 4  glyph=four  contours=2 points=42 offset=$017B edited
VF_G_0034
            .BYTE   $02
; contour 0
            .BYTE   $23,$C7,$FF,$D3,$FD,$DD,$F7,$E0,$E7,$DF,$DB,$F4,$D8,$FD,$D3,$FF
            .BYTE   $C0,$FE,$A5,$FB,$9F,$F6,$9C,$E6,$9C,$E1,$9A,$DF,$94,$E0,$14,$DE
            .BYTE   $0B,$D9,$05,$CD,$02,$AC,$00,$75,$00,$65,$05,$5A,$11,$40,$39,$07
            .BYTE   $97,$01,$AA,$00,$C3,$04,$D1,$0A,$D5,$13,$D7,$71,$D5,$78,$D7,$78
            .BYTE   $E7,$7A,$F6,$81,$FC,$99,$FF
; contour 1
            .BYTE   $07,$55,$9E,$4C,$9C,$5A,$80,$6F,$62,$77,$5A,$78,$95,$73,$9D

; U+0035 5  glyph=five  contours=1 points=61 offset=$01D2 edited
VF_G_0035
            .BYTE   $01
; contour 0
            .BYTE   $3D,$A9,$FD,$BD,$F8,$D0,$EF,$E0,$E4,$EE,$D7,$F8,$C7,$FE,$B6,$FF
            .BYTE   $A5,$FB,$8F,$F3,$7C,$E6,$6C,$D2,$5E,$B5,$54,$A1,$52,$90,$53,$70
            .BYTE   $5C,$62,$64,$5F,$64,$5D,$62,$5F,$46,$BD,$46,$CC,$47,$DC,$46,$E8
            .BYTE   $42,$EB,$3A,$EC,$22,$EB,$0D,$E8,$05,$DC,$00,$40,$01,$2D,$00,$1A
            .BYTE   $02,$16,$06,$12,$36,$0D,$5E,$0A,$92,$0D,$95,$18,$97,$39,$97,$4E
            .BYTE   $94,$5D,$90,$71,$8D,$8C,$93,$9A,$9D,$9B,$AA,$8F,$B7,$7A,$BA,$67
            .BYTE   $B9,$56,$AF,$4C,$AB,$08,$AC,$00,$B0,$01,$BA,$07,$C9,$0F,$D6,$1A
            .BYTE   $E1,$27,$EB,$35,$F2,$45,$F8,$57,$FC,$7E,$FF

; U+0036 6  glyph=six  contours=2 points=67 offset=$024E edited
VF_G_0036
            .BYTE   $02
; contour 0
            .BYTE   $36,$EE,$D3,$FA,$BD,$FF,$A7,$FF,$9C,$FC,$8C,$F7,$7F,$EE,$73,$E3
            .BYTE   $6A,$D5,$62,$C6,$5C,$B5,$59,$A3,$58,$87,$5B,$60,$69,$5E,$67,$5E
            .BYTE   $5F,$60,$58,$69,$4E,$75,$46,$83,$42,$93,$40,$A1,$41,$D7,$4A,$E7
            .BYTE   $50,$F0,$50,$F4,$42,$F9,$22,$F9,$16,$F7,$12,$F2,$0E,$DE,$09,$B6
            .BYTE   $03,$8E,$00,$6B,$03,$5A,$06,$4A,$0B,$3B,$12,$2D,$1B,$21,$25,$0D
            .BYTE   $45,$02,$69,$00,$88,$03,$A3,$0E,$C4,$1C,$D7,$25,$E0,$43,$F2,$57
            .BYTE   $F9,$6D,$FE,$84,$FF,$9E,$FD,$B8,$F6,$D1,$EC,$DB,$E5
; contour 1
            .BYTE   $0D,$5B,$AE,$5D,$9D,$69,$90,$7E,$8A,$8C,$8C,$98,$92,$9F,$9C,$A2
            .BYTE   $A8,$9F,$B4,$97,$BE,$8C,$C4,$7E,$C6,$68,$BF

; U+0037 7  glyph=seven  contours=1 points=29 offset=$02D7 edited
VF_G_0037
            .BYTE   $01
; contour 0
            .BYTE   $1D,$6B,$FF,$77,$FD,$82,$F9,$8A,$EF,$A8,$BE,$B2,$B0,$F5,$44,$FC
            .BYTE   $35,$FF,$26,$FF,$17,$FC,$0B,$F7,$04,$ED,$01,$D2,$00,$17,$00,$08
            .BYTE   $02,$03,$07,$00,$12,$00,$3A,$03,$45,$08,$4B,$4B,$4C,$63,$4F,$5D
            .BYTE   $60,$29,$B6,$08,$F2,$07,$F8,$0C,$FD,$1A,$FF

; U+0038 8  glyph=eight  contours=3 points=61 offset=$0313 edited
VF_G_0038
            .BYTE   $03
; contour 0
            .BYTE   $27,$9E,$FE,$C5,$F5,$D7,$ED,$EC,$E0,$FA,$CD,$FF,$BB,$FE,$A8,$F6
            .BYTE   $98,$E9,$8A,$CE,$76,$E6,$63,$EC,$59,$F1,$49,$EF,$34,$E8,$26,$E0
            .BYTE   $1C,$D6,$14,$BC,$08,$92,$00,$64,$02,$44,$07,$35,$0C,$1B,$1B,$11
            .BYTE   $26,$0A,$36,$07,$47,$0A,$54,$10,$5F,$24,$72,$2B,$7B,$13,$8F,$05
            .BYTE   $A1,$00,$B6,$04,$CC,$0D,$DB,$1B,$E7,$2C,$F1,$3E,$F7,$63,$FE
; contour 1
            .BYTE   $0A,$62,$4F,$65,$41,$6C,$38,$77,$33,$85,$33,$94,$40,$97,$52,$8E
            .BYTE   $60,$7D,$66,$6B,$5F
; contour 2
            .BYTE   $0C,$6E,$C9,$61,$BE,$5F,$B3,$64,$A4,$72,$9B,$7F,$99,$8E,$9D,$98
            .BYTE   $A7,$9C,$B2,$98,$C0,$8B,$CA,$7E,$CD

; U+0039 9  glyph=nine  contours=2 points=50 offset=$0391 edited
VF_G_0039
            .BYTE   $02
; contour 0
            .BYTE   $25,$FD,$96,$FF,$86,$FC,$5A,$F3,$3F,$E3,$27,$CB,$14,$AD,$07,$7C
            .BYTE   $00,$48,$08,$38,$0E,$1D,$1F,$05,$42,$00,$63,$08,$80,$1C,$95,$2A
            .BYTE   $9D,$49,$A6,$78,$A4,$9F,$96,$A1,$9F,$9F,$A6,$96,$B1,$8A,$B9,$6D
            .BYTE   $BF,$51,$BB,$19,$A9,$12,$AB,$0B,$BC,$06,$DD,$07,$ED,$30,$F9,$71
            .BYTE   $FF,$8C,$FE,$B9,$F2,$DB,$DC,$E8,$CC,$F2,$BA
; contour 1
            .BYTE   $0D,$5D,$56,$60,$4B,$68,$41,$73,$3B,$81,$39,$97,$40,$A4,$51,$A2
            .BYTE   $62,$96,$6F,$81,$75,$73,$73,$67,$6C,$60,$62

; U+0041 A  glyph=A  contours=2 points=37 offset=$03F8 edited
VF_G_0041
            .BYTE   $02
; contour 0
            .BYTE   $21,$4C,$FE,$54,$FC,$5B,$F5,$61,$DF,$9F,$DF,$A1,$EA,$A8,$F9,$AB
            .BYTE   $FB,$B4,$FD,$EB,$FD,$FC,$FB,$FF,$F8,$FC,$E1,$F7,$CA,$E8,$91,$DA
            .BYTE   $63,$C6,$27,$C0,$19,$B6,$08,$AE,$02,$93,$00,$59,$01,$4F,$03,$48
            .BYTE   $0A,$3F,$1B,$31,$40,$2E,$4C,$22,$6E,$0E,$B4,$03,$E3,$00,$F8,$07
            .BYTE   $FD,$18,$FF
; contour 1
            .BYTE   $04,$6F,$A1,$7B,$6E,$80,$5E,$91,$A1

; U+0042 B  glyph=B  contours=3 points=54 offset=$0445 edited
VF_G_0042
            .BYTE   $03
; contour 0
            .BYTE   $23,$9C,$FD,$BF,$F9,$CD,$F6,$DA,$F0,$EF,$E1,$FC,$CB,$FF,$BE,$FF
            .BYTE   $B0,$FB,$9F,$F3,$92,$E7,$87,$D2,$79,$D4,$73,$DA,$6E,$E4,$69,$F0
            .BYTE   $5D,$F6,$50,$F9,$41,$F6,$32,$F1,$27,$E9,$1E,$D7,$0F,$C0,$05,$B4
            .BYTE   $02,$92,$00,$12,$01,$07,$04,$02,$0A,$00,$13,$01,$DE,$00,$E6,$03
            .BYTE   $F6,$0C,$FC,$18,$FE,$45,$FF
; contour 1
            .BYTE   $09,$67,$6A,$66,$43,$68,$41,$85,$42,$92,$4B,$95,$58,$92,$60,$8C
            .BYTE   $66,$79,$6A
; contour 2
            .BYTE   $0A,$67,$BD,$66,$BB,$66,$91,$7B,$90,$8D,$92,$9A,$9E,$9C,$A8,$99
            .BYTE   $B2,$8E,$BB,$80,$BD

; U+0043 C  glyph=C  contours=1 points=53 offset=$04B5 edited
VF_G_0043
            .BYTE   $01
; contour 0
            .BYTE   $35,$FF,$A2,$FF,$98,$F9,$91,$EC,$8E,$AD,$91,$9F,$A5,$96,$AB,$89
            .BYTE   $AE,$7B,$AC,$6E,$A7,$65,$9D,$5F,$91,$5D,$80,$5F,$6F,$67,$5D,$7A
            .BYTE   $51,$90,$4F,$A1,$57,$AD,$65,$BF,$69,$F7,$69,$FF,$63,$FE,$57,$F7
            .BYTE   $42,$ED,$30,$E0,$21,$D0,$15,$BF,$0C,$AC,$05,$97,$01,$81,$00,$63
            .BYTE   $03,$47,$0B,$2E,$1A,$19,$30,$11,$3D,$06,$58,$00,$77,$01,$97,$04
            .BYTE   $A6,$0F,$C3,$17,$D0,$2C,$E6,$39,$EE,$5B,$FB,$80,$FF,$95,$FE,$A9
            .BYTE   $FA,$BB,$F4,$CB,$EB,$DA,$E0,$E7,$D2,$F2,$C2

; U+0044 D  glyph=D  contours=2 points=45 offset=$0521 edited
VF_G_0044
            .BYTE   $02
; contour 0
            .BYTE   $1C,$87,$FF,$99,$FD,$AD,$F8,$BF,$F0,$CF,$E7,$DC,$DB,$E8,$CD,$F1
            .BYTE   $BD,$F8,$AC,$FD,$99,$FF,$85,$FF,$71,$FD,$60,$F9,$50,$EA,$31,$D3
            .BYTE   $18,$C4,$0F,$B3,$08,$93,$01,$5C,$00,$29,$02,$07,$08,$02,$0E,$00
            .BYTE   $17,$00,$E5,$02,$F4,$0B,$FA,$3F,$FE
; contour 1
            .BYTE   $11,$6F,$AF,$63,$AF,$5E,$AA,$5E,$80,$5F,$76,$5E,$54,$60,$4F,$62
            .BYTE   $4D,$82,$4E,$93,$57,$9D,$66,$9F,$6E,$A1,$7F,$9E,$91,$99,$9C,$91
            .BYTE   $A5,$81,$AD

; U+0045 E  glyph=E  contours=1 points=26 offset=$057E edited
VF_G_0045
            .BYTE   $01
; contour 0
            .BYTE   $1A,$EC,$FE,$FB,$F9,$FE,$F1,$FE,$BF,$FA,$B7,$EC,$B1,$78,$B1,$77
            .BYTE   $94,$E1,$96,$EB,$94,$F1,$8E,$F4,$7A,$EF,$66,$E1,$62,$77,$61,$78
            .BYTE   $4A,$F7,$4B,$FE,$40,$FB,$06,$EC,$00,$1D,$00,$08,$04,$02,$0A,$00
            .BYTE   $E7,$03,$F7,$0E,$FD

; U+0046 F  glyph=F  contours=1 points=27 offset=$05B4 edited
VF_G_0046
            .BYTE   $01
; contour 0
            .BYTE   $1B,$5E,$FF,$71,$FC,$79,$F7,$7C,$E7,$7C,$A1,$DF,$A1,$EE,$9D,$F0
            .BYTE   $97,$F0,$73,$ED,$6D,$DF,$69,$7C,$69,$7C,$4D,$EC,$4D,$FB,$48,$FE
            .BYTE   $40,$FE,$0E,$FB,$06,$EC,$00,$1D,$00,$09,$04,$03,$0A,$00,$14,$00
            .BYTE   $E7,$03,$F7,$0F,$FD,$1E,$FF

; U+0047 G  glyph=G  contours=1 points=49 offset=$05EC edited
VF_G_0047
            .BYTE   $01
; contour 0
            .BYTE   $31,$F5,$B6,$FB,$A5,$FF,$81,$FB,$6D,$F7,$6B,$89,$6C,$85,$70,$83
            .BYTE   $94,$89,$A0,$A3,$A2,$95,$B1,$83,$B7,$75,$B4,$6A,$AC,$5D,$93,$5B
            .BYTE   $80,$62,$5E,$6A,$51,$75,$49,$84,$46,$92,$49,$9E,$50,$A6,$5B,$AC
            .BYTE   $5E,$DE,$5D,$F6,$57,$F7,$50,$F2,$3F,$E8,$2E,$CB,$13,$BA,$0B,$93
            .BYTE   $01,$62,$03,$46,$0B,$2D,$1A,$22,$24,$11,$3D,$06,$58,$00,$77,$01
            .BYTE   $97,$0F,$C3,$17,$D0,$2C,$E6,$38,$EE,$5A,$FB,$7E,$FF,$A0,$FC,$CC
            .BYTE   $E9,$E3,$D3

; U+0048 H  glyph=H  contours=1 points=42 offset=$0650 edited
VF_G_0048
            .BYTE   $01
; contour 0
            .BYTE   $2A,$38,$FE,$4C,$FF,$57,$FD,$61,$F7,$63,$E7,$63,$A4,$9A,$A4,$9C
            .BYTE   $A8,$9C,$E7,$9E,$F6,$A5,$FC,$B3,$FE,$DB,$FF,$EF,$FE,$F8,$FB,$FD
            .BYTE   $F2,$FE,$D6,$FD,$5E,$FF,$15,$FD,$0A,$F7,$02,$E9,$00,$AD,$01,$A2
            .BYTE   $04,$9E,$0A,$9C,$14,$9C,$54,$64,$55,$63,$13,$61,$0A,$5D,$04,$52
            .BYTE   $01,$16,$00,$08,$02,$02,$0A,$00,$14,$02,$5E,$01,$E7,$03,$F4,$07
            .BYTE   $FC,$10,$FE,$24,$FF

; U+0049 I  glyph=I  contours=1 points=18 offset=$06A6 edited
VF_G_0049
            .BYTE   $01
; contour 0
            .BYTE   $12,$A0,$FF,$A9,$FA,$AB,$F1,$AC,$D8,$AB,$51,$AB,$31,$A7,$20,$A0
            .BYTE   $12,$9B,$06,$95,$01,$59,$02,$4F,$07,$4C,$0F,$49,$1E,$49,$DA,$4B
            .BYTE   $EA,$4F,$F5,$55,$FF

; U+004A J  glyph=J  contours=1 points=32 offset=$06CC edited
VF_G_004A
            .BYTE   $01
; contour 0
            .BYTE   $20,$FD,$84,$FF,$13,$FD,$0A,$F7,$04,$DC,$00,$1B,$02,$16,$07,$13
            .BYTE   $13,$13,$3A,$16,$45,$1B,$4A,$90,$4E,$92,$55,$8F,$92,$8B,$9F,$83
            .BYTE   $A8,$75,$AC,$63,$A5,$56,$90,$4D,$8E,$00,$92,$01,$A6,$11,$CC,$1D
            .BYTE   $DC,$3D,$F2,$67,$FE,$9A,$FD,$B1,$F7,$C5,$ED,$D6,$E0,$E3,$D1,$F6
            .BYTE   $AC

; U+004B K  glyph=K  contours=1 points=44 offset=$070E edited
VF_G_004B
            .BYTE   $01
; contour 0
            .BYTE   $2C,$F0,$FD,$FA,$FB,$FE,$F8,$FF,$F5,$F7,$D9,$C6,$79,$E6,$3C,$F6
            .BYTE   $17,$F8,$0F,$F8,$08,$F2,$03,$AD,$00,$9D,$03,$97,$07,$80,$32,$6F
            .BYTE   $57,$69,$5D,$66,$5D,$64,$55,$65,$13,$63,$0A,$5E,$04,$53,$01,$17
            .BYTE   $00,$08,$02,$02,$0A,$00,$14,$00,$39,$02,$5E,$01,$E7,$03,$F4,$08
            .BYTE   $FB,$10,$FE,$4D,$FE,$59,$FC,$62,$F6,$65,$E7,$64,$DF,$64,$9F,$67
            .BYTE   $9A,$6F,$A2,$9E,$F9,$A5,$FD,$B1,$FF

; U+004C L  glyph=L  contours=1 points=17 offset=$0768 edited
VF_G_004C
            .BYTE   $01
; contour 0
            .BYTE   $11,$FB,$F9,$FE,$F1,$FE,$BE,$FB,$B5,$EC,$B0,$82,$B0,$7F,$AC,$7F
            .BYTE   $18,$7C,$08,$61,$00,$0F,$02,$03,$09,$00,$18,$00,$EB,$09,$FB,$1E
            .BYTE   $FF,$F2,$FE

; U+004D M  glyph=M  contours=1 points=44 offset=$078C edited
VF_G_004D
            .BYTE   $01
; contour 0
            .BYTE   $2C,$8A,$FF,$93,$FA,$A4,$9C,$A9,$91,$AB,$E6,$AD,$F5,$B2,$FB,$BF
            .BYTE   $FE,$EB,$FE,$F5,$FC,$FD,$F5,$FF,$E6,$FF,$15,$FD,$0C,$F9,$06,$F0
            .BYTE   $03,$A8,$00,$9C,$03,$96,$0E,$84,$76,$7F,$7A,$7C,$75,$76,$5B,$6C
            .BYTE   $1B,$66,$06,$61,$01,$0F,$02,$06,$05,$02,$0B,$00,$14,$00,$E6,$02
            .BYTE   $F5,$0A,$FB,$14,$FD,$40,$FD,$4D,$FA,$52,$F5,$54,$E6,$55,$94,$57
            .BYTE   $91,$5C,$9F,$69,$EF,$6E,$FC,$76,$FF

; U+004E N  glyph=N  contours=1 points=40 offset=$07E6 edited
VF_G_004E
            .BYTE   $01
; contour 0
            .BYTE   $28,$EF,$FD,$F8,$FA,$FC,$F4,$FE,$E6,$FD,$5E,$FF,$14,$FD,$0A,$F7
            .BYTE   $03,$DC,$00,$AD,$01,$A2,$04,$9D,$0A,$9B,$14,$9C,$5E,$9A,$67,$92
            .BYTE   $60,$71,$33,$58,$09,$52,$03,$4A,$00,$23,$00,$08,$03,$02,$0A,$00
            .BYTE   $14,$00,$39,$02,$5E,$01,$E6,$03,$F4,$07,$FB,$10,$FE,$4C,$FE,$58
            .BYTE   $FC,$62,$F6,$64,$E6,$63,$A6,$66,$95,$7E,$B1,$A6,$EA,$B5,$FD,$B9
            .BYTE   $FF

; U+004F O  glyph=O  contours=2 points=50 offset=$0838 edited
VF_G_004F
            .BYTE   $02
; contour 0
            .BYTE   $21,$FD,$99,$FF,$72,$F9,$50,$EA,$32,$E0,$25,$D4,$19,$C6,$10,$B6
            .BYTE   $09,$9B,$02,$74,$00,$52,$07,$3E,$0F,$2D,$1B,$1E,$2A,$12,$3B,$05
            .BYTE   $5A,$00,$78,$01,$98,$04,$A7,$0F,$C4,$17,$D1,$21,$DD,$2C,$E7,$38
            .BYTE   $EF,$4A,$F7,$5C,$FC,$8E,$FF,$AF,$F8,$C2,$EF,$D4,$E4,$E2,$D5,$EE
            .BYTE   $C4,$F7,$B0
; contour 1
            .BYTE   $11,$5D,$91,$5B,$7B,$60,$66,$6D,$55,$81,$4F,$89,$50,$96,$57,$A2
            .BYTE   $69,$A4,$79,$A3,$89,$9F,$97,$98,$A3,$8D,$AC,$7E,$AF,$72,$AC,$68
            .BYTE   $A6,$61,$9C

; U+0050 P  glyph=P  contours=2 points=37 offset=$089F edited
VF_G_0050
            .BYTE   $02
; contour 0
            .BYTE   $1B,$4F,$FF,$5E,$FC,$65,$F7,$67,$E8,$67,$BB,$A8,$BA,$C5,$B3,$DE
            .BYTE   $A6,$F1,$91,$F7,$83,$FD,$6E,$FF,$58,$FC,$44,$F5,$30,$E8,$1E,$D7
            .BYTE   $11,$C3,$09,$AF,$04,$99,$01,$4D,$00,$20,$02,$07,$08,$00,$17,$00
            .BYTE   $E8,$03,$F7,$0D,$FD,$19,$FF
; contour 1
            .BYTE   $0A,$6A,$76,$67,$73,$67,$4F,$78,$4E,$87,$50,$92,$56,$96,$66,$92
            .BYTE   $6D,$8B,$73,$79,$76

; U+0051 Q  glyph=Q  contours=2 points=65 offset=$08EC edited
VF_G_0051
            .BYTE   $02
; contour 0
            .BYTE   $2B,$E7,$FE,$EC,$FB,$EC,$F9,$E8,$F1,$D3,$D9,$D5,$D5,$E3,$C7,$EF
            .BYTE   $B6,$F7,$A3,$FD,$90,$FF,$7D,$FF,$6B,$FD,$5B,$F9,$4B,$EA,$2E,$E0
            .BYTE   $22,$D4,$17,$C6,$0E,$A8,$04,$8B,$00,$6E,$01,$52,$06,$44,$0B,$2C
            .BYTE   $18,$22,$22,$11,$38,$06,$52,$00,$70,$01,$8F,$04,$9D,$0F,$B8,$17
            .BYTE   $C4,$2C,$D9,$38,$E1,$4A,$E8,$5C,$ED,$82,$F0,$94,$EF,$A6,$EC,$AB
            .BYTE   $EF,$AE,$F4,$B8,$FD,$C5,$FF
; contour 1
            .BYTE   $16,$75,$A3,$65,$98,$5D,$88,$5B,$73,$60,$5F,$6D,$4F,$81,$49,$89
            .BYTE   $4A,$96,$51,$A2,$62,$A4,$71,$A3,$80,$9D,$92,$9B,$92,$95,$8C,$8A
            .BYTE   $8A,$74,$8A,$70,$8B,$6E,$8D,$71,$95,$7A,$A3,$79,$A4

; U+0052 R  glyph=R  contours=2 points=50 offset=$0971 edited
VF_G_0052
            .BYTE   $02
; contour 0
            .BYTE   $28,$F4,$FF,$FA,$FE,$FD,$FC,$FF,$F8,$FA,$EB,$D2,$A9,$C7,$99,$D4
            .BYTE   $93,$DF,$8C,$E8,$84,$F4,$70,$FB,$58,$F9,$39,$F1,$28,$E4,$1A,$D4
            .BYTE   $0F,$C0,$07,$AC,$03,$82,$00,$1F,$01,$08,$06,$06,$08,$00,$17,$01
            .BYTE   $DD,$00,$E5,$03,$F4,$0C,$FA,$2A,$FC,$4E,$FC,$5C,$F9,$63,$F4,$66
            .BYTE   $E6,$67,$B0,$68,$AE,$6D,$B2,$7D,$D6,$88,$EA,$90,$F5,$9B,$FC,$AA
            .BYTE   $FE
; contour 1
            .BYTE   $0A,$68,$74,$65,$6F,$65,$4E,$69,$4D,$85,$4E,$90,$54,$94,$65,$90
            .BYTE   $6C,$89,$71,$78,$74

; U+0053 S  glyph=S  contours=1 points=75 offset=$09D8 edited
VF_G_0053
            .BYTE   $01
; contour 0
            .BYTE   $4B,$F7,$CC,$FC,$C0,$FF,$B4,$FF,$A6,$FC,$9A,$F5,$8F,$EA,$83,$DE
            .BYTE   $7A,$D0,$73,$C1,$6E,$82,$62,$75,$5C,$71,$58,$71,$55,$79,$4F,$83
            .BYTE   $4D,$8C,$4D,$98,$4F,$A4,$54,$B0,$5D,$BA,$61,$C4,$61,$F6,$5B,$FB
            .BYTE   $59,$FD,$56,$FD,$4C,$F7,$3B,$EF,$2E,$DA,$19,$CD,$11,$C0,$0B,$B1
            .BYTE   $06,$93,$01,$74,$00,$64,$02,$46,$09,$2B,$16,$1F,$1E,$15,$29,$0D
            .BYTE   $36,$09,$45,$08,$57,$0A,$63,$12,$74,$1E,$82,$2D,$8C,$3E,$93,$51
            .BYTE   $98,$78,$9E,$8D,$A3,$95,$A6,$98,$AA,$98,$AC,$93,$B1,$86,$B5,$78
            .BYTE   $B7,$68,$B4,$5C,$AB,$52,$9F,$06,$A3,$02,$A5,$00,$A9,$01,$AE,$09
            .BYTE   $C0,$17,$D3,$31,$E9,$40,$F1,$50,$F7,$72,$FE,$84,$FF,$A3,$FC,$B4
            .BYTE   $F8,$D5,$EB,$E3,$E2,$EF,$D8

; U+0054 T  glyph=T  contours=1 points=20 offset=$0A70 edited
VF_G_0054
            .BYTE   $01
; contour 0
            .BYTE   $14,$A7,$FD,$B1,$F7,$B3,$50,$EC,$50,$FB,$4B,$FE,$42,$FE,$0E,$FB
            .BYTE   $06,$EB,$00,$08,$02,$03,$08,$00,$13,$00,$3D,$06,$4D,$18,$50,$4B
            .BYTE   $50,$4A,$E7,$4D,$F7,$57,$FD,$63,$FF

; U+0055 U  glyph=U  contours=1 points=40 offset=$0A9A edited
VF_G_0055
            .BYTE   $01
; contour 0
            .BYTE   $28,$DD,$DA,$F1,$BB,$FB,$97,$FE,$71,$FF,$13,$FD,$0A,$F8,$04,$ED
            .BYTE   $01,$AC,$01,$A1,$04,$9C,$0A,$9A,$13,$9A,$86,$95,$9D,$8C,$A9,$81
            .BYTE   $AC,$77,$AA,$70,$A5,$66,$8F,$64,$7A,$66,$13,$64,$0A,$5F,$04,$54
            .BYTE   $01,$12,$01,$07,$04,$02,$0A,$00,$13,$00,$7E,$05,$A6,$0C,$BB,$22
            .BYTE   $DD,$31,$E9,$42,$F3,$55,$FA,$6B,$FE,$82,$FF,$9B,$FD,$BF,$F1,$D4
            .BYTE   $E3

; U+0056 V  glyph=V  contours=1 points=56 offset=$0AEC edited
VF_G_0056
            .BYTE   $01
; contour 0
            .BYTE   $38,$B1,$FC,$BE,$EA,$C7,$D4,$DF,$8C,$ED,$5B,$F9,$2A,$FE,$11,$FF
            .BYTE   $07,$FD,$04,$F2,$02,$C9,$02,$BD,$01,$AA,$03,$A3,$0B,$A1,$16,$9E
            .BYTE   $20,$97,$43,$89,$7F,$82,$93,$80,$95,$7E,$94,$7B,$8E,$72,$6C,$6F
            .BYTE   $5D,$6B,$4E,$65,$31,$61,$22,$5E,$13,$5A,$07,$53,$01,$4B,$00,$3E
            .BYTE   $00,$30,$01,$1C,$00,$07,$01,$03,$02,$00,$05,$01,$10,$03,$1C,$06
            .BYTE   $28,$08,$34,$11,$58,$15,$63,$18,$6F,$1C,$7B,$1F,$87,$27,$9E,$2A
            .BYTE   $AA,$3C,$DF,$43,$EE,$4D,$FA,$53,$FC,$65,$FE,$73,$FD,$8C,$FF,$A5
            .BYTE   $FF

; U+0057 W  glyph=W  contours=1 points=60 offset=$0B5E edited
VF_G_0057
            .BYTE   $01
; contour 0
            .BYTE   $3C,$D3,$F7,$D9,$E9,$E4,$BF,$FF,$21,$FF,$0E,$FA,$06,$F0,$02,$DC
            .BYTE   $00,$D2,$01,$C8,$00,$C2,$01,$BE,$04,$BA,$13,$B0,$73,$AE,$77,$AC
            .BYTE   $76,$A5,$60,$9C,$2E,$98,$10,$94,$05,$91,$02,$8A,$00,$72,$01,$6C
            .BYTE   $03,$67,$11,$63,$30,$5B,$5E,$53,$76,$50,$76,$4D,$63,$45,$13,$42
            .BYTE   $06,$3F,$02,$1F,$00,$09,$03,$02,$09,$00,$11,$02,$2D,$11,$8A,$1C
            .BYTE   $C3,$28,$F0,$2C,$F8,$32,$FC,$42,$FF,$64,$FC,$69,$F6,$6F,$E8,$75
            .BYTE   $CE,$79,$B5,$7E,$A3,$80,$A2,$82,$A4,$88,$BD,$8E,$DE,$93,$EF,$97
            .BYTE   $F8,$9C,$FC,$A3,$FE,$BF,$FF,$CA,$FD

; U+0058 X  glyph=X  contours=1 points=49 offset=$0BD8 edited
VF_G_0058
            .BYTE   $01
; contour 0
            .BYTE   $31,$53,$FE,$5C,$F5,$66,$E2,$7E,$AB,$80,$AB,$8B,$C0,$A0,$EF,$A6
            .BYTE   $F9,$AC,$FD,$B7,$FF,$F1,$FD,$FA,$FB,$FE,$F8,$FF,$F5,$FD,$E9,$F1
            .BYTE   $CA,$CE,$80,$CD,$76,$D3,$66,$D9,$5C,$F7,$17,$F9,$0E,$F9,$08,$F3
            .BYTE   $03,$B3,$00,$A4,$03,$9F,$07,$92,$20,$84,$41,$7F,$46,$7B,$42,$6A
            .BYTE   $19,$64,$0E,$5B,$03,$56,$01,$4A,$00,$14,$02,$0B,$04,$06,$07,$0A
            .BYTE   $1A,$16,$3A,$2F,$6F,$31,$7B,$2E,$86,$09,$D6,$00,$F2,$01,$F8,$05
            .BYTE   $FC,$38,$FF

; U+0059 Y  glyph=Y  contours=1 points=35 offset=$0C3C edited
VF_G_0059
            .BYTE   $01
; contour 0
            .BYTE   $23,$9A,$FF,$A5,$FD,$AF,$F7,$B1,$E7,$B2,$AC,$B9,$93,$CE,$63,$FE
            .BYTE   $09,$FF,$04,$FB,$01,$F3,$00,$CD,$01,$BC,$00,$AB,$01,$A2,$04,$9D
            .BYTE   $08,$95,$19,$84,$4E,$81,$52,$7E,$52,$6A,$18,$5F,$05,$54,$01,$0C
            .BYTE   $00,$05,$01,$00,$04,$01,$09,$39,$73,$48,$99,$4D,$AC,$4F,$C1,$4F
            .BYTE   $E7,$51,$F7,$5B,$FD,$66,$FF

; U+005A Z  glyph=Z  contours=1 points=28 offset=$0C84 edited
VF_G_005A
            .BYTE   $01
; contour 0
            .BYTE   $1C,$FB,$FA,$FE,$F1,$FE,$BF,$FB,$B7,$EC,$B2,$8B,$B1,$8B,$AE,$EC
            .BYTE   $56,$F6,$4A,$FA,$40,$FA,$0E,$F7,$06,$E8,$00,$1D,$00,$0E,$02,$09
            .BYTE   $07,$06,$13,$06,$3B,$09,$46,$0E,$4B,$6F,$4F,$69,$59,$09,$B0,$02
            .BYTE   $BE,$01,$ED,$04,$F8,$09,$FD,$EC,$FF

; End of vector font dataset

            .END
