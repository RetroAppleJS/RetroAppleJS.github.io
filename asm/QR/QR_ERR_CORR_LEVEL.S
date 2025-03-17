; LAST BUILD 17-MAR-2025

ORG $6000

M.PRBYTE  EQU $FDDA   ; print hex byte
M.CRDO    EQU $DAFB   ; line feed
M.OUTSP   EQU $DB57   ; space
M.COUT    EQU $FDED   ; print char
M.KPRESS  EQU $FD35   ; key press
M.HGR     EQU $F3E2   ; set hires mode + clear screen
M.HGRCOL  EQU $F3F6   ; clear screen colour
M.TEXT    EQU $F399   ; set text mode
M.SELHGR  EQU $F3E4   ; set hires mode only

S0.TA     EQU $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX     EQU $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY     EQU $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ     EQU $1B     ; ONLY USE IN FUNCTIONS with no SUBS

