; =============================================================================
; Friend Bestie normalized vector font -> Apple II HGR filled-glyph renderer
; =============================================================================
;
; Target assembler : RetroAppleJS ASM_core.js / NMOS 6502
; Load address      : $6000
; HGR page          : page 1 ($2000-$3FFF)
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
; * The intersection buffer has 128 entries.  The attached Friend Bestie
;   dataset's largest glyph has 107 contour vertices, so 128 entries is sufficient.
;
; =============================================================================

            ORG     $6000

; Apple II soft switches
KBD         EQU     $C000
KBDSTRB     EQU     $C010
GFXON       EQU     $C050
TXTON       EQU     $C051
FULLSCR     EQU     $C052
PAGE1       EQU     $C054
HIRES       EQU     $C057

; Zero-page pointers used by the renderer.
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
MONTH_Y         EQU     $30          ; 48
MONTH_H         EQU     $1B          ; 27
MONTH_C0_X      EQU     $30          ; 48
MONTH_C0_W      EQU     $10          ; 13
MONTH_C1_X      EQU     $44          ; 68
MONTH_C1_W      EQU     $10          ; 13
MONTH_C2_X      EQU     $58          ; 88
MONTH_C2_W      EQU     $10          ; 16

; ----- DAY OF MONTH: two digits ----------------------------------------------
DAY_Y           EQU     $29          ; 41
DAY_H           EQU     $34          ; 52
DAY_C0_X        EQU     $95          ; 149
DAY_C0_W        EQU     $17          ; 23
DAY_C1_X        EQU     $B3          ; 179
DAY_C1_W        EQU     $17          ; 23

; ----- DAY OF WEEK: three characters -----------------------------------------
DOW_Y           EQU     $88          ; 136
DOW_H           EQU     $1B          ; 27
DOW_C0_X        EQU     $91          ; 145
DOW_C0_W        EQU     $0E          ; 14
DOW_C1_X        EQU     $A2          ; 162
DOW_C1_W        EQU     $0F          ; 15
DOW_C2_X        EQU     $B4          ; 180
DOW_C2_W        EQU     $0E          ; 14

; ----- AM / PM suffix ----------------------------------------------------------
AMPM_Y          EQU     $98          ; 152
AMPM_H          EQU     $0B          ; 11
AMPM_C0_X       EQU     $C4          ; 196  A or P
AMPM_C0_W       EQU     $07          ; 7
AMPM_C1_X       EQU     $CD          ; 205  M
AMPM_C1_W       EQU     $07          ; 7

; ----- Analog clock shared center/size box ------------------------------------
; Tickmarks and all three hands use these same parameters.
CLOCK_CFG_X0L   EQU     $4B          ; center X = 75
CLOCK_CFG_X0H   EQU     $00
CLOCK_CFG_Y0    EQU     $8C          ; center Y = 140
CLOCK_CFG_W     EQU     $5A          ; total width  = 90
CLOCK_CFG_H     EQU     $5A          ; total height = 90

; Hand thickness is derived from direction / 2^shift.
CLOCK_MIN_WSHIFT  EQU   $04          ; minute hand: thinner
CLOCK_HOUR_WSHIFT EQU   $03          ; hour hand: thicker

; ----- Split-flap clear boxes --------------------------------------------------
; X boxes are deliberately a little wider than the live glyphs so character
; spacing can be adjusted without leaving stale pixels.  Y/H are NOT duplicated:
; CAL_LOAD_GEOM uses YEAR_Y/H, MONTH_Y/H, DAY_Y/H, DOW_Y/H and AMPM_Y/H directly.
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
; Hour/minute hands are filled vector polygons and are refreshed only at minute
; boundaries (seconds=0); the seconds hand is a lightweight XOR line updated
; once per second. Calendar fields are read live from the Serial Pro RTC.
;
; 0-9 and A-Z come directly from the supplied Friend Bestie vector dataset.
; No temporary digit font is needed: the year, day, month, weekday and PM
; suffix all use exactly the same VF_DRAW filled-vector renderer.
; -----------------------------------------------------------------------------

START       CLD
            LDA     GFXON
            LDA     FULLSCR
            LDA     PAGE1
            LDA     HIRES
            JSR     HCLR

; Static analog-clock 5-minute tick marks.
; Public tick API uses CENTER position plus overall box size:
;
;   CLOCK_X0H:CLOCK_X0L = center X (0..279)
;   CLOCK_Y0            = center Y (0..191)
;   CLOCK_X1            = overall tick-ring width
;   CLOCK_Y1            = overall tick-ring height
;
; Layout comes from CLOCK_CFG_X0L/X0H/Y0/W/H in the user-editable section above.
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
            JSR     CLOCK_TICKMARKS

; Analog hand state.  The first coherent RTC snapshot performs one full redraw
; so the hands immediately match the RTC even if startup occurs mid-minute.
            LDA     #$00
            STA     CLOCK_INIT
            LDA     #$FF
            STA     CLOCK_SECIDX

; The Serial Pro is normally mounted in slot 2 in this configuration.
; Change SERIALOFF to $10..$70 for Apple slots 1..7.
;
;   $C084 + $s0 = 6818 address register
;   $C085 + $s0 = 6818 data register
;
SERIALOFF   EQU     $20
RTCADR      EQU     $C084
RTCDATA     EQU     $C085

FIELD_YEAR  EQU     $00
FIELD_MONTH EQU     $01
FIELD_DAY   EQU     $02
FIELD_DOW   EQU     $03
FIELD_AMPM  EQU     $04

; Force every field to be considered "not yet displayed".  The first good RTC
; snapshot therefore reveals the complete calendar through the same flip path
; later used for real changes.
            LDA     #$FF
            STA     DSP_YEAR
            STA     DSP_MONTH
            STA     DSP_DAY
            STA     DSP_DOW
            STA     DSP_PM
            STA     LAST_SEC

MAIN_LOOP   JSR     RTC_SNAPSHOT
            BCC     MAIN_IDLE

; Calendar data can only change when the RTC second changes.  Throttling on
; seconds keeps the program responsive without repeatedly comparing/rasterizing
; the same stable snapshot.
            LDA     RTC_SEC_RAW
            CMP     LAST_SEC
            BEQ     MAIN_IDLE
            STA     LAST_SEC

            JSR     CLOCK_UPDATE
            JSR     CAL_UPDATE

MAIN_IDLE   LDA     KBD
            BPL     MAIN_NOKEY
            BIT     KBDSTRB
            LDA     TXTON
            RTS

MAIN_NOKEY  JSR     POLL_DELAY
            JMP     MAIN_LOOP

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
            LDA     #$32            ; '2'
            JSR     DRAW_YEAR_DIG

            LDA     #YEAR_C1_X
            STA     CAL_DIGX
            LDA     #$30            ; '0'
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
            CMP     #$31
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
            LDA     #$50            ; P
            BNE     DAP_FIRST
DAP_AM      LDA     #$41            ; A
DAP_FIRST   JSR     VF_DRAW

            LDA     #AMPM_C1_X
            STA     VF_X0L
            LDA     #AMPM_C1_W
            STA     VF_X1
            LDA     #$4D            ; M
            JSR     VF_DRAW
            RTS

; Binary 0..99 in A -> ASCII tens/ones.
BIN2ASCII2  LDX     #$00
B2A_LOOP    CMP     #$0A
            BCC     B2A_DONE
            SEC
            SBC     #$0A
            INX
            BNE     B2A_LOOP
B2A_DONE    ORA     #$30
            STA     CAL_ONES
            TXA
            ORA     #$30
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
FLIP_DELAY  LDY     #$20
FLD_OUTER   LDX     #$FF
FLD_INNER   DEX
            BNE     FLD_INNER
            DEY
            BNE     FLD_OUTER
            RTS

; Poll delay keeps the RTC loop from hammering slot I/O continuously.
POLL_DELAY  LDY     #$08
PD_OUTER    LDX     #$FF
PD_INNER    DEX
            BNE     PD_INNER
            DEY
            BNE     PD_OUTER
            RTS

; =============================================================================
; Calendar text / geometry tables
; =============================================================================

MONTH_TEXT  .BYTE   $4A,$41,$4E     ; JAN
            .BYTE   $46,$45,$42     ; FEB
            .BYTE   $4D,$41,$52     ; MAR
            .BYTE   $41,$50,$52     ; APR
            .BYTE   $4D,$41,$59     ; MAY
            .BYTE   $4A,$55,$4E     ; JUN
            .BYTE   $4A,$55,$4C     ; JUL
            .BYTE   $41,$55,$47     ; AUG
            .BYTE   $53,$45,$50     ; SEP
            .BYTE   $4F,$43,$54     ; OCT
            .BYTE   $4E,$4F,$56     ; NOV
            .BYTE   $44,$45,$43     ; DEC

; Serial Pro's emulated 6818 uses 1=Sunday ... 7=Saturday.
DOW_TEXT    .BYTE   $53,$55,$4E     ; SUN
            .BYTE   $4D,$4F,$4E     ; MON
            .BYTE   $54,$55,$45     ; TUE
            .BYTE   $57,$45,$44     ; WED
            .BYTE   $54,$48,$55     ; THU
            .BYTE   $46,$52,$49     ; FRI
            .BYTE   $53,$41,$54     ; SAT

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
; At seconds=0 the old seconds line is erased, the clock box is cleared, and the
; static tickmarks + hour/minute polygons are redrawn once for the new minute.
; -----------------------------------------------------------------------------

CLOCK_UPDATE
; First good RTC sample: construct the full clock regardless of current second.
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
; Hour/minute geometry changes only on the minute boundary.
            LDA     RTC_SEC
            BNE     CLKU_DRAWSEC
            JSR     CLOCK_REDRAW_STATIC

CLKU_DRAWSEC
            LDA     RTC_SEC
            JSR     CLOCK_SECOND_XOR
            LDA     RTC_SEC
            STA     CLOCK_SECIDX
            JSR     CLOCK_DRAW_PIVOT
            RTS

; Clear only the clock's shared layout box, then reconstruct the static analog
; layer. This happens at startup and once per minute.
CLOCK_REDRAW_STATIC
            JSR     CLOCK_CLEAR_BOX
            JSR     CLOCK_TICKMARKS
            JSR     CLOCK_DRAW_HOUR
            JSR     CLOCK_DRAW_MINUTE
            JSR     CLOCK_DRAW_PIVOT
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
            LDX     RTC_MIN
            LDA     CLOCK_MIN_X,X
            STA     CLOCK_TIPX
            LDA     CLOCK_MIN_Y,X
            STA     CLOCK_TIPY
            LDA     #CLOCK_MIN_WSHIFT
            STA     CLOCK_WSHIFT
            JSR     CLOCK_BUILD_HAND
            JMP     CLOCK_DRAW_HAND_POLY

CLOCK_DRAW_HOUR
; index = (hour mod 12)*60 + minute, range 0..719.
            LDA     RTC_HOUR
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
            ADC     RTC_MIN
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

            JSR     VF_HSPAN

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
; Manual normalized-point edits: 0 glyph(s)
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
VF_DATA_BYTES  EQU     $12EE

VF_CODE_LO
            .BYTE   $30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$41,$42,$43,$44,$45,$46
            .BYTE   $47,$48,$49,$4A,$4B,$4C,$4D,$4E,$4F,$50,$51,$52,$53,$54,$55,$56
            .BYTE   $57,$58,$59,$5A
VF_CODE_HI
            .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
            .BYTE   $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
            .BYTE   $00,$00,$00,$00
VF_OFF_LO
            .BYTE   $00,$7F,$CD,$4F,$F3,$8A,$2E,$E3,$4D,$F3,$A8,$2D,$C1,$4F,$CA,$28
            .BYTE   $72,$20,$92,$C4,$36,$D2,$12,$AE,$3E,$C5,$2A,$D9,$62,$2C,$62,$F0
            .BYTE   $86,$5E,$0E,$8A
VF_OFF_HI
            .BYTE   $00,$00,$00,$01,$01,$02,$03,$03,$04,$04,$05,$06,$06,$07,$07,$08
            .BYTE   $08,$09,$09,$09,$0A,$0A,$0B,$0B,$0C,$0C,$0D,$0D,$0E,$0F,$0F,$0F
            .BYTE   $10,$11,$12,$12
VF_ADV
            .BYTE   $A7,$6E,$9B,$9E,$A8,$9E,$A9,$95,$A5,$A9,$BD,$AF,$BD,$BD,$9A,$91
            .BYTE   $BE,$BA,$51,$A1,$B3,$8F,$D7,$B9,$BE,$AE,$BE,$B0,$B4,$A0,$B0,$BD
            .BYTE   $FC,$BD,$B1,$9B

VF_DATA

; U+0030 0  glyph=zero  contours=2 points=62 offset=$0000
VF_G_0030
            .BYTE   $02
; contour 0
            .BYTE   $2C,$FD,$99,$FF,$86,$FF,$72,$FD,$62,$F9,$52,$F4,$43,$EC,$34,$E2
            .BYTE   $26,$D5,$1A,$C7,$10,$B6,$09,$A9,$05,$9B,$02,$8E,$01,$80,$00,$66
            .BYTE   $02,$4F,$08,$3B,$11,$2A,$1E,$1C,$2D,$10,$3E,$08,$51,$02,$66,$01
            .BYTE   $78,$00,$89,$02,$9C,$06,$AF,$0D,$C1,$18,$D2,$22,$DD,$2D,$E7,$39
            .BYTE   $EF,$45,$F5,$53,$FA,$62,$FD,$71,$FE,$82,$FF,$9C,$FD,$B2,$F7,$C6
            .BYTE   $EE,$D7,$E1,$E5,$D2,$EF,$C1,$F8,$AE
; contour 1
            .BYTE   $12,$78,$B1,$6B,$A4,$66,$93,$64,$87,$65,$7B,$68,$67,$70,$54,$81
            .BYTE   $4C,$86,$4D,$91,$56,$97,$63,$98,$68,$9A,$79,$9A,$8A,$98,$96,$93
            .BYTE   $A3,$8B,$AE,$7E,$B2

; U+0031 1  glyph=one  contours=1 points=38 offset=$007F
VF_G_0031
            .BYTE   $01
; contour 0
            .BYTE   $26,$D6,$FF,$EF,$FC,$FA,$F6,$FE,$E7,$FE,$38,$FF,$26,$FF,$13,$FB
            .BYTE   $0A,$F3,$04,$E1,$01,$C7,$00,$8B,$00,$78,$03,$67,$08,$53,$11,$3F
            .BYTE   $18,$2B,$20,$15,$27,$0B,$2A,$08,$2C,$01,$33,$00,$3A,$01,$49,$03
            .BYTE   $58,$03,$5F,$06,$68,$07,$68,$08,$6A,$0E,$6C,$27,$65,$3D,$5E,$4A
            .BYTE   $59,$56,$59,$57,$5A,$57,$E7,$5A,$F6,$6B,$FD,$7F,$FF

; U+0032 2  glyph=two  contours=1 points=64 offset=$00CD
VF_G_0032
            .BYTE   $01
; contour 0
            .BYTE   $40,$FB,$FA,$FE,$F2,$FF,$E5,$FF,$D4,$FE,$C0,$FB,$B8,$EC,$B3,$AB
            .BYTE   $B3,$AA,$AF,$AF,$A9,$BF,$9E,$D2,$91,$E0,$86,$EC,$7B,$F6,$6D,$FC
            .BYTE   $60,$FD,$5D,$FF,$4B,$FC,$38,$F4,$28,$E9,$1B,$D9,$11,$C7,$09,$B3
            .BYTE   $04,$9D,$01,$85,$00,$6A,$01,$52,$06,$3E,$0D,$2C,$17,$1D,$23,$11
            .BYTE   $33,$07,$44,$01,$58,$00,$65,$08,$6B,$40,$6B,$4D,$69,$51,$67,$55
            .BYTE   $62,$61,$56,$63,$55,$6F,$52,$7D,$54,$82,$56,$87,$59,$87,$67,$7B
            .BYTE   $78,$6A,$85,$59,$91,$4D,$99,$40,$A0,$33,$A8,$27,$AF,$1B,$B7,$0F
            .BYTE   $C0,$06,$CA,$04,$D7,$05,$E7,$05,$ED,$08,$F8,$0D,$FD,$1C,$FF,$EC
            .BYTE   $FF

; U+0033 3  glyph=three  contours=1 points=81 offset=$014F
VF_G_0033
            .BYTE   $01
; contour 0
            .BYTE   $51,$EF,$DF,$FA,$CD,$FF,$B9,$FD,$A5,$F5,$94,$E5,$87,$D6,$7E,$D2
            .BYTE   $79,$D3,$75,$D7,$71,$E5,$66,$F4,$54,$FA,$3F,$FA,$39,$F7,$29,$EE
            .BYTE   $1C,$E0,$12,$D0,$0A,$BD,$05,$A9,$02,$95,$00,$82,$00,$6C,$01,$57
            .BYTE   $03,$44,$08,$32,$0E,$22,$17,$14,$22,$09,$30,$02,$41,$01,$4A,$09
            .BYTE   $4E,$1F,$4F,$49,$4F,$51,$4B,$5B,$44,$6C,$3F,$86,$44,$8C,$49,$8F
            .BYTE   $4F,$90,$56,$85,$60,$74,$63,$66,$63,$55,$66,$54,$69,$54,$8A,$55
            .BYTE   $8F,$5A,$93,$62,$94,$7A,$96,$7B,$96,$83,$98,$8B,$9E,$8D,$A4,$8C
            .BYTE   $AF,$81,$B9,$6E,$BD,$5B,$B8,$51,$B1,$49,$AD,$3C,$AC,$2F,$AD,$08
            .BYTE   $AD,$00,$B2,$01,$BB,$08,$CD,$13,$DB,$21,$E7,$31,$F0,$43,$F7,$56
            .BYTE   $FC,$6B,$FE,$82,$FF,$90,$FF,$9F,$FE,$AF,$FC,$BE,$F9,$CD,$F5,$DB
            .BYTE   $EF,$E6,$E8

; U+0034 4  glyph=four  contours=2 points=74 offset=$01F3
VF_G_0034
            .BYTE   $02
; contour 0
            .BYTE   $3A,$C7,$FF,$D3,$FD,$DD,$F7,$E0,$E7,$DF,$DF,$DF,$DB,$E1,$DA,$E7
            .BYTE   $D9,$F4,$D8,$F7,$D7,$FD,$D3,$FE,$CC,$FF,$C0,$FF,$B4,$FE,$A5,$FB
            .BYTE   $9F,$F6,$9C,$E6,$9C,$E1,$9A,$DF,$94,$DF,$39,$E0,$27,$E0,$14,$DE
            .BYTE   $0B,$D9,$05,$CD,$02,$BF,$01,$B1,$01,$AC,$00,$75,$00,$65,$05,$5A
            .BYTE   $11,$53,$1D,$47,$2E,$40,$39,$39,$45,$33,$50,$2C,$5B,$25,$65,$1F
            .BYTE   $70,$18,$7A,$11,$85,$07,$97,$01,$AA,$00,$B6,$00,$C3,$04,$D1,$0A
            .BYTE   $D5,$13,$D7,$43,$D7,$5A,$D5,$71,$D5,$77,$D6,$78,$D7,$78,$E7,$7A
            .BYTE   $F6,$81,$FC,$99,$FF
; contour 1
            .BYTE   $10,$55,$9E,$4D,$9D,$4C,$9C,$4C,$9B,$52,$8E,$5A,$80,$63,$73,$6C
            .BYTE   $67,$6F,$62,$75,$5B,$77,$5A,$78,$5F,$78,$95,$75,$9B,$73,$9D,$70
            .BYTE   $9E

; U+0035 5  glyph=five  contours=1 points=81 offset=$028A
VF_G_0035
            .BYTE   $01
; contour 0
            .BYTE   $51,$93,$FE,$A9,$FD,$BD,$F8,$D0,$EF,$E0,$E4,$EE,$D7,$F8,$C7,$FE
            .BYTE   $B6,$FF,$A5,$FB,$8F,$F3,$7C,$E6,$6C,$D2,$5E,$C8,$5A,$B5,$54,$A1
            .BYTE   $52,$90,$53,$80,$57,$70,$5C,$62,$64,$5F,$64,$5D,$62,$5D,$5C,$5F
            .BYTE   $46,$BD,$46,$CC,$47,$DC,$46,$E8,$42,$EB,$3A,$EC,$2E,$EC,$22,$EB
            .BYTE   $1F,$EB,$0D,$E8,$05,$DC,$00,$CC,$00,$BD,$01,$40,$01,$35,$00,$2D
            .BYTE   $00,$1A,$02,$16,$06,$15,$0F,$14,$1E,$12,$36,$10,$41,$0F,$4D,$0D
            .BYTE   $5E,$0C,$6D,$0B,$7F,$0A,$8B,$0A,$92,$0D,$95,$18,$97,$39,$97,$4E
            .BYTE   $94,$5D,$90,$71,$8D,$8C,$93,$9A,$9D,$9B,$AA,$8F,$B7,$7A,$BA,$67
            .BYTE   $B9,$64,$B8,$62,$B7,$56,$AF,$4C,$AB,$1F,$AB,$08,$AC,$00,$B0,$01
            .BYTE   $BA,$07,$C9,$0F,$D6,$1A,$E1,$27,$EB,$35,$F2,$45,$F8,$57,$FC,$69
            .BYTE   $FE,$7E,$FF

; U+0036 6  glyph=six  contours=2 points=89 offset=$032E
VF_G_0036
            .BYTE   $02
; contour 0
            .BYTE   $4C,$E4,$DD,$EE,$D3,$F5,$C7,$FA,$BD,$FD,$B2,$FF,$A7,$FF,$9C,$FC
            .BYTE   $8C,$F7,$7F,$EE,$73,$E3,$6A,$D5,$62,$C6,$5C,$B5,$59,$A3,$58,$95
            .BYTE   $59,$87,$5B,$7A,$5F,$6D,$64,$65,$68,$60,$69,$5E,$67,$5E,$5F,$60
            .BYTE   $58,$69,$4E,$75,$46,$83,$42,$93,$40,$A1,$41,$AE,$44,$D8,$52,$E6
            .BYTE   $56,$ED,$53,$F0,$50,$F4,$42,$F6,$32,$F9,$22,$F9,$16,$F7,$12,$F2
            .BYTE   $0E,$DE,$09,$B6,$03,$A2,$01,$8E,$00,$7D,$01,$6B,$03,$5A,$06,$4A
            .BYTE   $0B,$3B,$12,$2D,$1B,$21,$25,$18,$32,$0D,$45,$06,$59,$02,$69,$00
            .BYTE   $79,$00,$88,$02,$98,$03,$A3,$06,$AF,$0A,$B9,$0E,$C4,$15,$CE,$1C
            .BYTE   $D7,$25,$E0,$2F,$E7,$43,$F2,$57,$F9,$6D,$FE,$84,$FF,$9E,$FD,$AB
            .BYTE   $FA,$B8,$F6,$C5,$F1,$D1,$EC,$DB,$E5
; contour 1
            .BYTE   $0D,$5B,$AE,$5D,$9D,$69,$90,$7E,$8A,$8C,$8C,$98,$92,$9F,$9C,$A2
            .BYTE   $A8,$9F,$B4,$97,$BE,$8C,$C4,$7E,$C6,$68,$BF

; U+0037 7  glyph=seven  contours=1 points=52 offset=$03E3
VF_G_0037
            .BYTE   $01
; contour 0
            .BYTE   $34,$6B,$FF,$6F,$FE,$76,$FD,$77,$FD,$82,$F9,$8A,$EF,$96,$DB,$9F
            .BYTE   $CD,$A8,$BE,$B2,$B0,$BB,$A1,$C9,$8B,$D0,$7F,$D7,$74,$DE,$68,$E6
            .BYTE   $5C,$ED,$50,$F5,$44,$FC,$35,$FF,$26,$FF,$17,$FC,$0B,$F7,$04,$ED
            .BYTE   $01,$EB,$01,$D2,$00,$17,$00,$08,$02,$03,$07,$00,$12,$00,$3A,$03
            .BYTE   $45,$08,$4B,$17,$4C,$4B,$4C,$61,$4E,$63,$4F,$63,$50,$62,$54,$5D
            .BYTE   $60,$56,$6C,$4F,$77,$47,$83,$3B,$97,$30,$AA,$29,$B6,$23,$C2,$0E
            .BYTE   $E6,$08,$F2,$07,$F8,$0C,$FD,$1A,$FF

; U+0038 8  glyph=eight  contours=3 points=81 offset=$044D
VF_G_0038
            .BYTE   $03
; contour 0
            .BYTE   $3A,$89,$FF,$9E,$FE,$B2,$FA,$C5,$F5,$D7,$ED,$EC,$E0,$FA,$CD,$FF
            .BYTE   $BB,$FE,$A8,$F6,$98,$E9,$8A,$DF,$82,$D4,$7B,$D0,$78,$CE,$76,$D1
            .BYTE   $73,$DD,$6B,$E6,$63,$EC,$59,$F1,$49,$EF,$34,$E8,$26,$E0,$1C,$D6
            .BYTE   $14,$CA,$0E,$BC,$08,$AF,$05,$A0,$02,$92,$00,$84,$00,$64,$02,$54
            .BYTE   $04,$44,$07,$35,$0C,$27,$13,$1B,$1B,$11,$26,$0A,$36,$07,$47,$0A
            .BYTE   $54,$10,$5F,$19,$69,$24,$72,$2B,$7B,$2A,$7D,$24,$82,$13,$8F,$05
            .BYTE   $A1,$00,$B6,$01,$C1,$04,$CC,$0D,$DB,$1B,$E7,$2C,$F1,$3E,$F7,$50
            .BYTE   $FB,$63,$FE,$76,$FF
; contour 1
            .BYTE   $0B,$62,$4F,$65,$41,$6C,$38,$77,$33,$7D,$32,$85,$33,$94,$40,$97
            .BYTE   $52,$8E,$60,$7D,$66,$6B,$5F
; contour 2
            .BYTE   $0C,$6E,$C9,$61,$BE,$5F,$B3,$64,$A4,$72,$9B,$7F,$99,$8E,$9D,$98
            .BYTE   $A7,$9C,$B2,$98,$C0,$8B,$CA,$7E,$CD

; U+0039 9  glyph=nine  contours=2 points=89 offset=$04F3
VF_G_0039
            .BYTE   $02
; contour 0
            .BYTE   $4C,$F9,$A5,$FD,$96,$FF,$86,$FF,$76,$FE,$67,$FC,$5A,$F8,$4C,$F3
            .BYTE   $3F,$EC,$33,$E3,$27,$D8,$1D,$CB,$14,$BC,$0D,$AD,$07,$9D,$03,$8C
            .BYTE   $01,$7C,$00,$6A,$01,$59,$04,$48,$08,$38,$0E,$2A,$16,$1D,$1F,$13
            .BYTE   $2B,$0A,$38,$05,$42,$02,$4D,$00,$58,$00,$63,$03,$72,$08,$80,$11
            .BYTE   $8B,$1C,$95,$2A,$9D,$39,$A2,$49,$A6,$5B,$A7,$6A,$A6,$78,$A4,$85
            .BYTE   $A0,$92,$9B,$9A,$97,$9F,$96,$A0,$98,$A1,$9F,$9F,$A6,$96,$B1,$8A
            .BYTE   $B9,$7C,$BD,$6D,$BF,$5F,$BE,$51,$BB,$3C,$B4,$27,$AC,$19,$A9,$12
            .BYTE   $AB,$0F,$AF,$0B,$BC,$09,$CD,$06,$DD,$06,$E9,$07,$ED,$0D,$F0,$23
            .BYTE   $F6,$30,$F9,$4C,$FD,$5A,$FE,$71,$FF,$7F,$FF,$8C,$FE,$A4,$F9,$B9
            .BYTE   $F2,$CB,$E8,$DB,$DC,$E8,$CC,$F2,$BA
; contour 1
            .BYTE   $0D,$5D,$56,$60,$4B,$68,$41,$73,$3B,$81,$39,$97,$40,$A4,$51,$A2
            .BYTE   $62,$96,$6F,$81,$75,$73,$73,$67,$6C,$60,$62

; U+0041 A  glyph=A  contours=2 points=65 offset=$05A8
VF_G_0041
            .BYTE   $02
; contour 0
            .BYTE   $3B,$4C,$FE,$54,$FC,$5B,$F5,$5E,$EB,$61,$DF,$9F,$DF,$A1,$EA,$A8
            .BYTE   $F9,$AB,$FB,$B4,$FD,$EB,$FD,$F9,$FB,$FC,$FB,$FF,$F8,$FE,$ED,$FC
            .BYTE   $E1,$F9,$D6,$F7,$CA,$F4,$BF,$EE,$A7,$E8,$91,$E4,$85,$E1,$7A,$DD
            .BYTE   $6E,$DA,$63,$D6,$58,$D2,$4C,$CF,$41,$CB,$36,$C6,$27,$C0,$19,$B6
            .BYTE   $08,$AE,$02,$A4,$01,$93,$00,$6E,$00,$59,$01,$4F,$03,$48,$0A,$3F
            .BYTE   $1B,$35,$35,$31,$40,$2E,$4C,$2A,$57,$26,$63,$22,$6E,$1F,$7A,$1B
            .BYTE   $85,$18,$91,$15,$9C,$12,$A8,$0E,$B4,$0C,$BF,$03,$E3,$01,$EF,$00
            .BYTE   $F8,$07,$FD,$18,$FF,$3A,$FF
; contour 1
            .BYTE   $06,$6F,$A1,$7B,$6E,$80,$5E,$84,$6E,$89,$7F,$91,$A1

; U+0042 B  glyph=B  contours=3 points=72 offset=$062D
VF_G_0042
            .BYTE   $03
; contour 0
            .BYTE   $32,$59,$FE,$86,$FE,$9C,$FD,$B1,$FB,$BF,$F9,$CD,$F6,$DA,$F0,$E5
            .BYTE   $E9,$EF,$E1,$F6,$D7,$FC,$CB,$FF,$BE,$FF,$B0,$FB,$9F,$F3,$92,$E7
            .BYTE   $87,$D9,$7D,$D2,$79,$D2,$78,$D4,$73,$DA,$6F,$DA,$6E,$E3,$69,$E4
            .BYTE   $69,$F0,$5D,$F6,$50,$F9,$41,$F6,$32,$F1,$27,$E9,$1E,$D7,$0F,$C0
            .BYTE   $05,$B4,$02,$A7,$01,$92,$00,$1F,$00,$12,$01,$07,$04,$02,$0A,$00
            .BYTE   $13,$00,$26,$01,$38,$01,$DE,$00,$E6,$03,$F6,$0C,$FC,$18,$FE,$1B
            .BYTE   $FE,$32,$FF,$45,$FF
; contour 1
            .BYTE   $0B,$67,$6A,$66,$68,$66,$43,$68,$41,$74,$41,$85,$42,$92,$4B,$95
            .BYTE   $58,$92,$60,$8C,$66,$79,$6A
; contour 2
            .BYTE   $0B,$67,$BD,$66,$BB,$66,$91,$69,$90,$7B,$90,$8D,$92,$9A,$9E,$9C
            .BYTE   $A8,$99,$B2,$8E,$BB,$80,$BD

; U+0043 C  glyph=C  contours=1 points=70 offset=$06C1
VF_G_0043
            .BYTE   $01
; contour 0
            .BYTE   $46,$FA,$B0,$FF,$A2,$FF,$98,$F9,$91,$EC,$8E,$E0,$8F,$C5,$8F,$B6
            .BYTE   $90,$AD,$91,$AA,$94,$9F,$A5,$96,$AB,$89,$AE,$7B,$AC,$6E,$A7,$65
            .BYTE   $9D,$5F,$91,$5D,$80,$5F,$6F,$67,$5D,$7A,$51,$90,$4F,$A1,$57,$AD
            .BYTE   $65,$B1,$67,$BF,$69,$F7,$69,$FF,$63,$FE,$57,$F7,$42,$ED,$30,$E0
            .BYTE   $21,$D0,$15,$BF,$0C,$AC,$05,$97,$01,$81,$00,$72,$01,$63,$03,$55
            .BYTE   $06,$47,$0B,$3A,$12,$2E,$1A,$23,$24,$19,$30,$11,$3D,$0B,$4A,$06
            .BYTE   $58,$03,$66,$00,$77,$00,$89,$01,$97,$04,$A6,$09,$B5,$0F,$C3,$17
            .BYTE   $D0,$21,$DC,$2C,$E6,$39,$EE,$4A,$F5,$5B,$FB,$6E,$FE,$80,$FF,$95
            .BYTE   $FE,$A9,$FA,$BB,$F4,$CB,$EB,$DA,$E0,$E7,$D2,$F2,$C2

; U+0044 D  glyph=D  contours=2 points=60 offset=$074F
VF_G_0044
            .BYTE   $02
; contour 0
            .BYTE   $28,$87,$FF,$99,$FD,$AD,$F8,$BF,$F0,$CF,$E7,$DC,$DB,$E8,$CD,$F1
            .BYTE   $BD,$F8,$AC,$FD,$99,$FF,$85,$FF,$71,$FD,$60,$F9,$50,$F2,$40,$EA
            .BYTE   $31,$DF,$24,$D3,$18,$C4,$0F,$B3,$08,$A3,$04,$93,$01,$82,$00,$5C
            .BYTE   $00,$4C,$01,$3A,$01,$29,$02,$1A,$04,$07,$08,$02,$0E,$00,$17,$00
            .BYTE   $E5,$02,$F4,$0B,$FA,$17,$FB,$24,$FC,$32,$FD,$3F,$FE,$4D,$FE,$5B
            .BYTE   $FF
; contour 1
            .BYTE   $14,$6F,$AF,$63,$AF,$5F,$AC,$5E,$AA,$5E,$80,$5F,$76,$5E,$69,$5E
            .BYTE   $54,$60,$4F,$62,$4D,$6E,$4D,$82,$4E,$93,$57,$9D,$66,$9F,$6E,$A1
            .BYTE   $7F,$9E,$91,$99,$9C,$91,$A5,$81,$AD

; U+0045 E  glyph=E  contours=1 points=46 offset=$07CA
VF_G_0045
            .BYTE   $01
; contour 0
            .BYTE   $2E,$5B,$FF,$67,$FE,$EC,$FE,$FB,$F9,$FE,$F1,$FF,$E3,$FF,$D3,$FE
            .BYTE   $BF,$FA,$B7,$EC,$B1,$78,$B1,$77,$AF,$77,$9B,$79,$9A,$E1,$9A,$EF
            .BYTE   $96,$F3,$90,$F4,$7D,$F4,$7A,$EF,$66,$E1,$62,$7C,$62,$77,$60,$77
            .BYTE   $4F,$79,$4D,$E5,$4D,$F7,$4B,$FE,$40,$FF,$32,$FF,$21,$FE,$0E,$FB
            .BYTE   $06,$EC,$00,$1D,$00,$0E,$02,$0C,$03,$08,$04,$02,$0A,$00,$14,$00
            .BYTE   $27,$01,$38,$01,$DF,$00,$E7,$03,$F7,$0E,$FD,$1D,$FF

; U+0046 F  glyph=F  contours=1 points=36 offset=$0828
VF_G_0046
            .BYTE   $01
; contour 0
            .BYTE   $24,$5E,$FF,$71,$FC,$79,$F7,$7C,$E7,$7C,$A1,$DF,$A1,$EE,$9D,$F0
            .BYTE   $97,$F1,$84,$F1,$81,$F0,$73,$ED,$6D,$DF,$69,$7C,$69,$7C,$4D,$EC
            .BYTE   $4D,$FB,$48,$FE,$40,$FF,$32,$FF,$21,$FE,$0E,$FB,$06,$EC,$00,$1D
            .BYTE   $00,$0E,$02,$0C,$03,$09,$04,$03,$0A,$00,$14,$00,$27,$01,$38,$01
            .BYTE   $DF,$00,$E7,$03,$F7,$0F,$FD,$1E,$FF

; U+0047 G  glyph=G  contours=1 points=86 offset=$0872
VF_G_0047
            .BYTE   $01
; contour 0
            .BYTE   $56,$EC,$C5,$F5,$B6,$FB,$A5,$FE,$93,$FF,$81,$FD,$73,$FB,$6D,$F7
            .BYTE   $6B,$94,$6B,$89,$6C,$85,$70,$84,$77,$84,$81,$83,$81,$83,$94,$85
            .BYTE   $9C,$89,$A0,$94,$A1,$A1,$A1,$A3,$A2,$A3,$A4,$95,$B1,$83,$B7,$75
            .BYTE   $B4,$6A,$AC,$62,$A0,$5D,$93,$5B,$80,$5E,$6C,$62,$5E,$6A,$51,$75
            .BYTE   $49,$84,$46,$92,$49,$9E,$50,$A4,$57,$A6,$5B,$AC,$5E,$B9,$5F,$CA
            .BYTE   $5E,$DE,$5D,$EF,$5A,$F6,$57,$F7,$54,$F7,$50,$F2,$3F,$E8,$2E,$DA
            .BYTE   $1F,$CB,$13,$BA,$0B,$A7,$05,$93,$01,$80,$00,$71,$01,$62,$03,$54
            .BYTE   $06,$46,$0B,$39,$12,$2D,$1A,$22,$24,$19,$30,$11,$3D,$0B,$4A,$06
            .BYTE   $58,$03,$66,$00,$77,$00,$89,$01,$97,$04,$A6,$09,$B5,$0F,$C3,$17
            .BYTE   $D0,$21,$DC,$2C,$E6,$38,$EE,$49,$F5,$5A,$FB,$6C,$FE,$7E,$FF,$8F
            .BYTE   $FE,$A0,$FC,$AF,$F7,$BE,$F1,$CC,$E9,$D8,$DF,$E3,$D3

; U+0048 H  glyph=H  contours=1 points=56 offset=$0920
VF_G_0048
            .BYTE   $01
; contour 0
            .BYTE   $38,$38,$FE,$4C,$FF,$57,$FD,$61,$F7,$63,$E7,$63,$A4,$9A,$A4,$9A
            .BYTE   $A5,$9C,$A8,$9C,$E7,$9E,$F6,$A5,$FC,$B3,$FE,$C7,$FE,$DB,$FF,$EF
            .BYTE   $FE,$F8,$FB,$FD,$F2,$FD,$E7,$FE,$D6,$FD,$C5,$FD,$5E,$FE,$4B,$FF
            .BYTE   $39,$FF,$15,$FD,$0A,$F7,$02,$E9,$00,$BE,$00,$AD,$01,$A2,$04,$9E
            .BYTE   $0A,$9C,$14,$9C,$54,$9B,$55,$64,$55,$63,$52,$63,$13,$61,$0A,$5D
            .BYTE   $04,$52,$01,$41,$00,$16,$00,$08,$02,$02,$0A,$00,$14,$00,$39,$01
            .BYTE   $4B,$02,$5E,$02,$C5,$01,$D6,$01,$E7,$03,$F4,$07,$FC,$10,$FE,$24
            .BYTE   $FF

; U+0049 I  glyph=I  contours=1 points=24 offset=$0992
VF_G_0049
            .BYTE   $01
; contour 0
            .BYTE   $18,$C2,$FF,$E7,$FC,$F8,$F7,$FE,$E7,$FD,$DF,$FD,$38,$FF,$27,$FF
            .BYTE   $14,$FA,$0A,$ED,$04,$D1,$01,$A6,$00,$4E,$00,$2D,$01,$12,$04,$05
            .BYTE   $0A,$00,$14,$00,$27,$01,$39,$01,$DF,$00,$E7,$06,$F7,$1F,$FD,$3D
            .BYTE   $FF

; U+004A J  glyph=J  contours=1 points=56 offset=$09C4
VF_G_004A
            .BYTE   $01
; contour 0
            .BYTE   $38,$FB,$97,$FD,$84,$FD,$74,$FE,$63,$FE,$45,$FF,$37,$FF,$13,$FD
            .BYTE   $0A,$F7,$04,$F1,$02,$DC,$00,$C0,$00,$AB,$01,$30,$01,$29,$00,$1B
            .BYTE   $02,$16,$07,$13,$13,$13,$3A,$16,$45,$1B,$4A,$29,$4C,$8C,$4C,$90
            .BYTE   $4E,$92,$55,$92,$6E,$8F,$92,$8B,$9F,$83,$A8,$75,$AC,$63,$A5,$5E
            .BYTE   $9E,$5A,$95,$56,$90,$4D,$8E,$32,$8F,$17,$8F,$0B,$90,$00,$92,$01
            .BYTE   $A4,$01,$A6,$08,$BA,$11,$CC,$1D,$DC,$2C,$E8,$3D,$F2,$51,$F9,$67
            .BYTE   $FE,$80,$FF,$9A,$FD,$B1,$F7,$C5,$ED,$D6,$E0,$E3,$D1,$EE,$BF,$F6
            .BYTE   $AC

; U+004B K  glyph=K  contours=1 points=77 offset=$0A36
VF_G_004B
            .BYTE   $01
; contour 0
            .BYTE   $4D,$BD,$FF,$CA,$FE,$E3,$FE,$F0,$FD,$FA,$FB,$FE,$F8,$FF,$F5,$FC
            .BYTE   $E8,$F7,$D9,$EA,$BF,$E1,$AE,$D8,$9C,$CF,$8B,$C6,$79,$D6,$5B,$DE
            .BYTE   $4B,$E6,$3C,$EE,$2A,$F6,$17,$F8,$0F,$F8,$08,$F2,$03,$EA,$02,$D3
            .BYTE   $01,$BC,$01,$AD,$00,$A3,$01,$9D,$03,$97,$07,$92,$0F,$89,$20,$80
            .BYTE   $32,$79,$42,$73,$4F,$6F,$57,$69,$5D,$66,$5D,$64,$55,$64,$38,$65
            .BYTE   $26,$65,$13,$63,$0A,$5E,$04,$53,$01,$42,$00,$17,$00,$08,$02,$02
            .BYTE   $0A,$00,$14,$00,$39,$01,$4B,$02,$5E,$02,$C5,$01,$D6,$01,$E7,$03
            .BYTE   $F4,$08,$FB,$10,$FE,$4D,$FE,$59,$FC,$62,$F6,$65,$E7,$64,$DF,$64
            .BYTE   $9F,$65,$9C,$67,$9A,$6A,$9C,$6F,$A2,$7A,$B5,$81,$C2,$85,$C9,$87
            .BYTE   $CD,$8F,$DE,$98,$EF,$9E,$F9,$A5,$FD,$B1,$FF

; U+004C L  glyph=L  contours=1 points=31 offset=$0AD2
VF_G_004C
            .BYTE   $01
; contour 0
            .BYTE   $1F,$FB,$F9,$FE,$F1,$FF,$DC,$FF,$CB,$FE,$BE,$FB,$B5,$EC,$B0,$82
            .BYTE   $B0,$7F,$AC,$7F,$18,$7C,$08,$74,$03,$61,$00,$1E,$00,$0F,$02,$03
            .BYTE   $09,$00,$18,$01,$20,$01,$C6,$00,$D8,$00,$EB,$03,$F5,$09,$FB,$0D
            .BYTE   $FC,$0E,$FD,$1E,$FF,$5F,$FF,$78,$FE,$C6,$FE,$E5,$FF,$F2,$FE

; U+004D M  glyph=M  contours=1 points=77 offset=$0B12
VF_G_004D
            .BYTE   $01
; contour 0
            .BYTE   $4D,$8A,$FF,$93,$FA,$96,$EF,$98,$E3,$9A,$D6,$9C,$CA,$9E,$BF,$9F
            .BYTE   $B4,$A1,$A8,$A4,$9C,$A9,$91,$AA,$94,$AA,$AF,$AB,$BD,$AB,$E6,$AD
            .BYTE   $F5,$B2,$FB,$BF,$FE,$EB,$FE,$F5,$FC,$FD,$F5,$FF,$E6,$FF,$15,$FD
            .BYTE   $0C,$F9,$06,$F0,$03,$E5,$02,$C5,$02,$B9,$01,$A8,$00,$9C,$03,$96
            .BYTE   $0E,$92,$20,$90,$32,$84,$76,$82,$79,$7F,$7A,$7C,$75,$76,$5B,$75
            .BYTE   $52,$71,$3F,$6E,$2B,$6C,$1B,$68,$0B,$66,$06,$61,$01,$56,$00,$45
            .BYTE   $01,$1A,$01,$0F,$02,$06,$05,$02,$0B,$00,$14,$00,$E6,$02,$F5,$0A
            .BYTE   $FB,$14,$FD,$40,$FD,$4D,$FA,$52,$F5,$54,$E6,$54,$D9,$55,$CB,$55
            .BYTE   $94,$56,$91,$57,$91,$58,$93,$5C,$9F,$5E,$A8,$60,$B3,$61,$BF,$63
            .BYTE   $CA,$67,$E2,$69,$EF,$6E,$FC,$74,$FE,$76,$FF

; U+004E N  glyph=N  contours=1 points=71 offset=$0BAE
VF_G_004E
            .BYTE   $01
; contour 0
            .BYTE   $47,$C2,$FF,$D1,$FE,$E1,$FE,$EF,$FD,$F8,$FA,$FC,$F4,$FE,$E6,$FE
            .BYTE   $D5,$FD,$C5,$FD,$5E,$FE,$50,$FE,$42,$FF,$34,$FF,$14,$FD,$0A,$F7
            .BYTE   $03,$E9,$01,$DC,$00,$BD,$00,$AD,$01,$A2,$04,$9D,$0A,$9B,$14,$9B
            .BYTE   $26,$9C,$38,$9C,$5E,$9B,$65,$9A,$67,$99,$66,$92,$60,$8C,$59,$8B
            .BYTE   $57,$80,$47,$78,$3D,$71,$33,$6B,$28,$64,$1D,$58,$09,$52,$03,$4A
            .BYTE   $00,$23,$00,$16,$01,$08,$03,$02,$0A,$00,$14,$00,$39,$01,$4B,$02
            .BYTE   $5E,$02,$C5,$01,$D5,$01,$E6,$03,$F4,$07,$FB,$10,$FE,$4C,$FE,$58
            .BYTE   $FC,$62,$F6,$64,$E6,$63,$DE,$63,$A6,$65,$97,$66,$95,$74,$A5,$7E
            .BYTE   $B1,$8E,$C7,$96,$D3,$9E,$DE,$A6,$EA,$AF,$F6,$B5,$FD,$B9,$FF

; U+004F O  glyph=O  contours=2 points=66 offset=$0C3E
VF_G_004F
            .BYTE   $02
; contour 0
            .BYTE   $30,$FD,$99,$FF,$86,$FF,$72,$FD,$61,$F9,$50,$F2,$41,$EA,$32,$E0
            .BYTE   $25,$D4,$19,$C6,$10,$B6,$09,$A9,$05,$9B,$02,$8E,$01,$80,$00,$74
            .BYTE   $00,$68,$02,$5D,$04,$52,$07,$3E,$0F,$2D,$1B,$1E,$2A,$12,$3B,$09
            .BYTE   $4F,$05,$5A,$00,$78,$00,$89,$01,$98,$04,$A7,$09,$B5,$0F,$C4,$17
            .BYTE   $D1,$21,$DD,$2C,$E7,$38,$EF,$4A,$F7,$5C,$FC,$6F,$FE,$82,$FF,$8E
            .BYTE   $FF,$99,$FD,$AF,$F8,$C2,$EF,$D4,$E4,$E2,$D5,$EE,$C4,$F7,$B0,$FA
            .BYTE   $A5
; contour 1
            .BYTE   $12,$5D,$91,$5B,$7B,$60,$66,$6D,$55,$81,$4F,$89,$50,$96,$57,$9F
            .BYTE   $64,$A2,$69,$A4,$79,$A3,$89,$9F,$97,$98,$A3,$8D,$AC,$7E,$AF,$72
            .BYTE   $AC,$68,$A6,$61,$9C

; U+0050 P  glyph=P  contours=2 points=49 offset=$0CC5
VF_G_0050
            .BYTE   $02
; contour 0
            .BYTE   $25,$4F,$FF,$5E,$FC,$65,$F7,$67,$E8,$67,$BB,$97,$BB,$A8,$BA,$B7
            .BYTE   $B7,$C5,$B3,$D2,$AD,$DE,$A6,$E8,$9C,$F1,$91,$F7,$83,$FD,$6E,$FF
            .BYTE   $58,$FC,$44,$F5,$30,$E8,$1E,$D7,$11,$C3,$09,$AF,$04,$99,$01,$84
            .BYTE   $00,$4D,$00,$38,$01,$20,$02,$09,$07,$07,$08,$00,$17,$00,$29,$01
            .BYTE   $3B,$01,$E0,$00,$E8,$03,$F7,$0D,$FD,$19,$FF
; contour 1
            .BYTE   $0C,$6A,$76,$68,$75,$67,$73,$67,$4F,$6B,$4E,$78,$4E,$87,$50,$92
            .BYTE   $56,$96,$66,$92,$6D,$8B,$73,$79,$76

; U+0051 Q  glyph=Q  contours=2 points=86 offset=$0D2A
VF_G_0051
            .BYTE   $02
; contour 0
            .BYTE   $3E,$DE,$FF,$E7,$FE,$EB,$FC,$EC,$FB,$EC,$F9,$E8,$F1,$DE,$E5,$D3
            .BYTE   $D9,$D3,$D8,$D5,$D5,$E3,$C7,$EF,$B6,$F7,$A3,$FD,$90,$FF,$7D,$FF
            .BYTE   $6B,$FD,$5B,$F9,$4B,$F2,$3C,$EA,$2E,$E0,$22,$D4,$17,$C6,$0E,$B6
            .BYTE   $08,$A8,$04,$9A,$02,$8B,$00,$7D,$00,$6E,$01,$60,$03,$52,$06,$44
            .BYTE   $0B,$38,$11,$2C,$18,$22,$22,$19,$2D,$11,$38,$0B,$45,$06,$52,$03
            .BYTE   $5F,$00,$70,$00,$81,$01,$8F,$04,$9D,$09,$AA,$0F,$B8,$17,$C4,$21
            .BYTE   $CF,$2C,$D9,$38,$E1,$4A,$E8,$5C,$ED,$6F,$EF,$82,$F0,$94,$EF,$A5
            .BYTE   $EC,$A6,$EC,$A8,$ED,$AB,$EF,$AE,$F4,$B8,$FD,$C5,$FF
; contour 1
            .BYTE   $18,$75,$A3,$65,$98,$5D,$88,$5B,$73,$60,$5F,$6D,$4F,$81,$49,$89
            .BYTE   $4A,$96,$51,$9F,$5D,$A2,$62,$A4,$71,$A3,$80,$9D,$92,$9B,$92,$95
            .BYTE   $8C,$8A,$8A,$74,$8A,$70,$8B,$6E,$8D,$6F,$90,$71,$95,$7A,$A3,$79
            .BYTE   $A4

; U+0052 R  glyph=R  contours=2 points=67 offset=$0DD9
VF_G_0052
            .BYTE   $02
; contour 0
            .BYTE   $37,$F4,$FF,$FA,$FE,$FD,$FC,$FF,$F8,$FA,$EB,$F2,$DE,$EA,$D0,$D2
            .BYTE   $A9,$C9,$9C,$C7,$99,$D4,$93,$DF,$8C,$E8,$84,$EF,$7A,$F4,$70,$F8
            .BYTE   $64,$FB,$58,$FB,$4C,$F9,$39,$F1,$28,$E4,$1A,$D4,$0F,$C0,$07,$AC
            .BYTE   $03,$97,$01,$82,$00,$4C,$00,$37,$01,$1F,$01,$08,$06,$06,$08,$00
            .BYTE   $17,$00,$29,$01,$3A,$01,$DD,$00,$E5,$03,$F4,$0C,$FA,$18,$FB,$2A
            .BYTE   $FC,$4E,$FC,$5C,$F9,$63,$F4,$66,$E6,$66,$C0,$67,$B0,$68,$AE,$6D
            .BYTE   $B2,$75,$C3,$7D,$D6,$88,$EA,$90,$F5,$9B,$FC,$AA,$FE,$CE,$FF
; contour 1
            .BYTE   $0C,$68,$74,$66,$71,$65,$6F,$65,$4E,$69,$4D,$76,$4D,$85,$4E,$90
            .BYTE   $54,$94,$65,$90,$6C,$89,$71,$78,$74

; U+0053 S  glyph=S  contours=1 points=100 offset=$0E62
VF_G_0053
            .BYTE   $01
; contour 0
            .BYTE   $64,$F7,$CC,$FC,$C0,$FF,$B4,$FF,$A6,$FC,$9A,$F5,$8F,$EA,$83,$DE
            .BYTE   $7A,$D0,$73,$C1,$6E,$A1,$68,$9E,$68,$82,$62,$75,$5C,$71,$58,$71
            .BYTE   $55,$79,$4F,$83,$4D,$8C,$4D,$98,$4F,$A4,$54,$B0,$5D,$BA,$61,$C4
            .BYTE   $61,$D1,$5F,$DD,$5E,$E2,$5D,$F6,$5B,$FB,$59,$FD,$56,$FD,$4C,$FC
            .BYTE   $4A,$F7,$3B,$EF,$2E,$E5,$23,$DA,$19,$CD,$11,$C0,$0B,$B1,$06,$A2
            .BYTE   $03,$93,$01,$83,$00,$74,$00,$64,$02,$55,$05,$46,$09,$38,$0F,$2B
            .BYTE   $16,$1F,$1E,$15,$29,$0D,$36,$09,$45,$08,$57,$0A,$63,$0F,$6E,$12
            .BYTE   $74,$1E,$82,$2D,$8C,$3E,$93,$51,$98,$65,$9B,$78,$9E,$8D,$A3,$95
            .BYTE   $A6,$98,$AA,$98,$AC,$93,$B1,$86,$B5,$78,$B7,$68,$B4,$5C,$AB,$56
            .BYTE   $A3,$52,$9F,$45,$9F,$38,$A0,$2C,$A1,$20,$A1,$13,$A2,$0F,$A2,$06
            .BYTE   $A3,$02,$A5,$00,$A9,$01,$AE,$09,$C0,$0D,$C6,$17,$D3,$24,$DF,$31
            .BYTE   $E9,$40,$F1,$50,$F7,$61,$FB,$72,$FE,$84,$FF,$93,$FE,$A3,$FC,$B4
            .BYTE   $F8,$C5,$F2,$D5,$EB,$E3,$E2,$EF,$D8

; U+0054 T  glyph=T  contours=1 points=26 offset=$0F2C
VF_G_0054
            .BYTE   $01
; contour 0
            .BYTE   $1A,$9A,$FF,$A7,$FD,$B1,$F7,$B3,$E7,$B3,$50,$EC,$50,$FB,$4B,$FE
            .BYTE   $42,$FF,$35,$FF,$23,$FE,$0E,$FB,$06,$EB,$00,$18,$00,$08,$02,$03
            .BYTE   $08,$00,$13,$00,$3D,$06,$4D,$18,$50,$4B,$50,$4B,$DF,$4A,$E7,$4D
            .BYTE   $F7,$57,$FD,$63,$FF

; U+0055 U  glyph=U  contours=1 points=70 offset=$0F62
VF_G_0055
            .BYTE   $01
; contour 0
            .BYTE   $46,$DD,$DA,$E8,$CB,$F1,$BB,$F7,$A9,$FB,$97,$FC,$8E,$FD,$81,$FE
            .BYTE   $71,$FE,$37,$FF,$26,$FF,$13,$FD,$0A,$F8,$04,$ED,$01,$DC,$00,$B9
            .BYTE   $00,$AC,$01,$A1,$04,$9C,$0A,$9A,$13,$9A,$4B,$9B,$5F,$9B,$73,$9A
            .BYTE   $86,$98,$92,$95,$9D,$8C,$A9,$81,$AC,$77,$AA,$70,$A5,$6A,$9B,$66
            .BYTE   $8F,$64,$7A,$64,$64,$65,$4E,$65,$38,$66,$26,$66,$13,$64,$0A,$5F
            .BYTE   $04,$54,$01,$43,$00,$1F,$00,$12,$01,$07,$04,$02,$0A,$00,$13,$00
            .BYTE   $26,$01,$38,$01,$55,$00,$62,$00,$7E,$01,$8B,$03,$98,$05,$A6,$0C
            .BYTE   $BB,$16,$CD,$22,$DD,$31,$E9,$42,$F3,$55,$FA,$6B,$FE,$82,$FF,$8F
            .BYTE   $FE,$9B,$FD,$A8,$FA,$B4,$F6,$BF,$F1,$CA,$EA,$D4,$E3

; U+0056 V  glyph=V  contours=1 points=74 offset=$0FF0
VF_G_0056
            .BYTE   $01
; contour 0
            .BYTE   $4A,$B1,$FC,$BE,$EA,$C3,$DE,$C7,$D4,$DF,$8C,$E2,$80,$E6,$74,$E9
            .BYTE   $68,$ED,$5B,$F3,$43,$F6,$36,$F9,$2A,$FB,$1E,$FE,$11,$FF,$07,$FD
            .BYTE   $04,$F9,$03,$F2,$02,$C9,$02,$BD,$01,$B0,$02,$AA,$03,$A3,$0B,$A1
            .BYTE   $16,$9E,$20,$97,$43,$92,$58,$8D,$6C,$89,$7F,$82,$93,$80,$95,$7E
            .BYTE   $94,$7B,$8E,$7A,$89,$76,$7B,$72,$6C,$6F,$5D,$6B,$4E,$68,$40,$65
            .BYTE   $31,$61,$22,$5E,$13,$5A,$07,$53,$01,$4B,$00,$3E,$00,$30,$01,$1C
            .BYTE   $00,$07,$01,$03,$02,$00,$05,$01,$10,$03,$1C,$06,$28,$08,$34,$11
            .BYTE   $58,$15,$63,$18,$6F,$1C,$7B,$1F,$87,$23,$93,$27,$9E,$2A,$AA,$32
            .BYTE   $C2,$36,$CD,$3C,$DF,$43,$EE,$4D,$FA,$53,$FC,$65,$FE,$73,$FD,$80
            .BYTE   $FE,$8C,$FF,$A5,$FF

; U+0057 W  glyph=W  contours=1 points=107 offset=$1086
VF_G_0057
            .BYTE   $01
; contour 0
            .BYTE   $6B,$D3,$F7,$D9,$E9,$DF,$D4,$E4,$BF,$E7,$AE,$EA,$9E,$F6,$5A,$F8
            .BYTE   $49,$FB,$38,$FD,$2C,$FF,$21,$FF,$0E,$FA,$06,$F0,$02,$DC,$00,$D2
            .BYTE   $01,$C8,$00,$C2,$01,$BE,$04,$BC,$0A,$BA,$13,$B4,$4F,$B2,$62,$B0
            .BYTE   $73,$AE,$77,$AC,$76,$AA,$71,$A5,$60,$A2,$4F,$9F,$3F,$9C,$2E,$9A
            .BYTE   $1D,$98,$10,$94,$05,$91,$02,$8A,$00,$82,$00,$72,$01,$6C,$03,$6A
            .BYTE   $07,$67,$11,$65,$21,$63,$30,$60,$40,$5E,$4F,$5B,$5E,$55,$72,$53
            .BYTE   $76,$50,$76,$4F,$71,$4D,$63,$4B,$4D,$49,$38,$47,$26,$45,$13,$42
            .BYTE   $06,$3F,$02,$3A,$01,$2C,$01,$1F,$00,$12,$01,$09,$03,$02,$09,$00
            .BYTE   $11,$00,$1B,$02,$2D,$04,$39,$06,$44,$0A,$5C,$0C,$67,$10,$7F,$11
            .BYTE   $8A,$13,$94,$16,$A2,$19,$B2,$1C,$C3,$20,$D4,$24,$E3,$28,$F0,$2C
            .BYTE   $F8,$32,$FC,$42,$FF,$4F,$FE,$5E,$FD,$64,$FC,$69,$F6,$6F,$E8,$75
            .BYTE   $CE,$77,$C1,$79,$B5,$7C,$A8,$7D,$A6,$7E,$A3,$80,$A2,$82,$A4,$83
            .BYTE   $A7,$85,$B2,$88,$BD,$8B,$CE,$8E,$DE,$93,$EF,$97,$F8,$9C,$FC,$A3
            .BYTE   $FE,$B1,$FF,$BF,$FF,$CA,$FD

; U+0058 X  glyph=X  contours=1 points=87 offset=$115E
VF_G_0058
            .BYTE   $01
; contour 0
            .BYTE   $57,$53,$FE,$5C,$F5,$66,$E2,$6F,$CE,$76,$BD,$7D,$AD,$7E,$AB,$80
            .BYTE   $AB,$81,$AD,$85,$B4,$8B,$C0,$90,$CD,$A0,$EF,$A6,$F9,$AC,$FD,$B7
            .BYTE   $FF,$C2,$FF,$CE,$FE,$E5,$FE,$F1,$FD,$FA,$FB,$FE,$F8,$FF,$F5,$FD
            .BYTE   $E9,$F7,$D9,$F1,$CA,$EC,$BF,$E4,$B0,$CF,$83,$CE,$80,$CD,$76,$D1
            .BYTE   $6B,$D3,$66,$D9,$5C,$E8,$3B,$F0,$29,$F7,$17,$F9,$0E,$F9,$08,$F3
            .BYTE   $03,$EB,$02,$C1,$00,$B3,$00,$AA,$01,$A4,$03,$9F,$07,$9B,$0E,$92
            .BYTE   $20,$8A,$32,$84,$3F,$84,$41,$7F,$46,$7B,$42,$78,$39,$6E,$23,$6A
            .BYTE   $19,$64,$0E,$5B,$03,$56,$01,$4A,$00,$3E,$01,$29,$01,$14,$02,$0B
            .BYTE   $04,$06,$07,$06,$0A,$0A,$1A,$12,$30,$16,$3A,$1B,$45,$20,$4F,$25
            .BYTE   $5A,$2A,$64,$2F,$6F,$31,$7B,$2E,$86,$25,$9B,$17,$B7,$11,$C4,$09
            .BYTE   $D6,$03,$E8,$00,$F2,$01,$F8,$05,$FC,$0E,$FD,$38,$FF,$48,$FF

; U+0059 Y  glyph=Y  contours=1 points=61 offset=$120E
VF_G_0059
            .BYTE   $01
; contour 0
            .BYTE   $3D,$9A,$FF,$A5,$FD,$AF,$F7,$B1,$E7,$B1,$B8,$B2,$AC,$B5,$A0,$B9
            .BYTE   $93,$BE,$87,$C3,$7A,$C9,$6E,$CE,$63,$D4,$58,$DF,$44,$E9,$30,$F4
            .BYTE   $1C,$FE,$09,$FF,$06,$FF,$04,$FB,$01,$F3,$00,$E0,$00,$CD,$01,$BC
            .BYTE   $00,$AB,$01,$A2,$04,$9D,$08,$95,$19,$91,$26,$8C,$33,$88,$40,$84
            .BYTE   $4E,$81,$52,$7E,$52,$7B,$4C,$77,$3D,$71,$2A,$6A,$18,$62,$0A,$5F
            .BYTE   $05,$54,$01,$35,$01,$20,$00,$0C,$00,$05,$01,$00,$04,$00,$06,$01
            .BYTE   $09,$0F,$23,$16,$31,$2B,$58,$32,$66,$39,$73,$41,$86,$48,$99,$4D
            .BYTE   $AC,$4F,$C1,$4F,$E7,$51,$F7,$5B,$FD,$66,$FF

; U+005A Z  glyph=Z  contours=1 points=49 offset=$128A
VF_G_005A
            .BYTE   $01
; contour 0
            .BYTE   $31,$FB,$FA,$FE,$F1,$FF,$E4,$FF,$D3,$FE,$BF,$FB,$B7,$EC,$B2,$8E
            .BYTE   $B2,$8B,$B1,$8B,$AE,$94,$A4,$95,$A4,$DF,$61,$EC,$56,$F6,$4A,$F6
            .BYTE   $49,$F7,$48,$FA,$40,$FB,$32,$FB,$21,$FA,$0E,$F7,$06,$E8,$00,$1D
            .BYTE   $00,$0E,$02,$09,$07,$06,$13,$06,$3B,$09,$46,$0E,$4B,$1D,$4D,$6A
            .BYTE   $4D,$6F,$4F,$6F,$50,$69,$59,$62,$60,$39,$85,$28,$93,$18,$A2,$09
            .BYTE   $B0,$02,$BE,$00,$CD,$00,$E0,$01,$E7,$01,$ED,$04,$F8,$09,$FD,$19
            .BYTE   $FF,$EC,$FF

; End of vector font dataset

            .END
