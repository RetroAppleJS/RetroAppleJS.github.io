; SID2MB resident SID-register-stream player (prototype v0.1)
; Apple II+ / 6502 / Mockingboard slot 4 / 50 Hz
;
; Assemble with RetroAppleJS ASM_core.js (multi or raJS).
;   CALL 8192 : start or restart
;   CALL 8195 : stop, restore IRQ vector
;   CALL 8198 : silence/restart stream (not a pause)
;   PEEK(8192+...) is not a status interface.
;
; IMPORTANT: This does NOT execute PSID 6510 code.
; Input at $6000 must be an SREG v1 capture stream from
; SID2MB_capture.html and the small jsSID capture patch.
;
; SREG layout:
;   $6000-$6003 'S','R','E','G'
;   $6004       version = $01
;   $6005       playback frequency = 50
;   $6006...    pairs: register ($00..$18), value
;               $FF end-of-frame, $FE repeat from $6006,
;               $FD end-of-song (silence)
;
; Not suitable for playing over DOS/ProDOS operations without
; OS-specific IRQ integration.  $2000-$5FFF is HGR video RAM.
;
ORG $2000
STARTV   JMP INSTALL
STOPV    JMP UNINST
RESETV   JMP RESETUSER

LORB     EQU $C400
LORA     EQU $C401
LDDRB    EQU $C402
LDDRA    EQU $C403
LT1CL    EQU $C404
LT1CH    EQU $C405
LACR     EQU $C40B
LIFR     EQU $C40D
LIER     EQU $C40E
RORB     EQU $C480
RORA     EQU $C481
RDDRB    EQU $C482
RDDRA    EQU $C483
RIER     EQU $C48E

; ------------------------------------------------------------------
; Startup: leave the BASIC interpreter running.
; ------------------------------------------------------------------
INSTALL
    SEI
    LDA $6000
    CMP #$53
    BNE BADFILE
    LDA $6001
    CMP #$52
    BNE BADFILE
    LDA $6002
    CMP #$45
    BNE BADFILE
    LDA $6003
    CMP #$47
    BNE BADFILE
    LDA $6004
    CMP #$01
    BNE BADFILE
    LDA $6005
    CMP #$32
    BNE BADFILE
    LDA ACTIVE
    BNE REINSTALL
    LDA $03FE
    STA OLIRQ
    LDA $03FF
    STA OLIRQ+1
    LDA #$01
    STA ACTIVE
REINSTALL
    JSR INITBUS
    JSR RESETSONG
    LDA #<IRQHAND
    STA $03FE
    LDA #>IRQHAND
    STA $03FF
    LDA #$40             ; 6522 continuous T1 mode
    STA LACR
    LDA #$7F             ; disable all VIA1 interrupts
    STA LIER
    STA RIER             ; no NMI from second VIA
    LDA #$40
    STA LIFR              ; clear residual T1 flag
    LDA #$C0
    STA LIER              ; enable T1 only
    LDA #$E7
    STA LT1CL
    LDA #$4F
    STA LT1CH             ; approximately 50Hz at 1.02 MHz
BADFILE
    CLI
    RTS

UNINST
    SEI
    LDA ACTIVE
    BEQ UNIDONE
    LDA #$40
    STA LIER              ; disable T1
    STA LIFR
    LDA OLIRQ
    STA $03FE
    LDA OLIRQ+1
    STA $03FF
    LDA #$00
    STA ACTIVE
    JSR MUTEAY
UNIDONE
    CLI
    RTS

RESETUSER
    SEI
    JSR RESETSONG
    CLI
    RTS

RESETSONG
    LDA #$06
    STA PTRLO
    LDA #$60
    STA PTRHI
    LDA #$00
    STA ENDED
    LDX #$18
CLRREG
    STA SIDREG,X
    DEX
    BPL CLRREG
    LDX #$02
CLRENV
    STA ENVLEV,X
    STA ENVDLY,X
    STA ENVMOD,X
    STA OLDGAT,X
    DEX
    BPL CLRENV
    JSR MUTEAY
    RTS

INITBUS
    LDA #$FF
    STA LDDRA
    STA RDDRA
    LDA #$07
    STA LDDRB
    STA RDDRB
    LDA #$04
    STA LORB
    STA RORB
    JSR MUTEAY
    RTS

MUTEAY
    LDX #$08
MUTELOOP
    LDA #$00
    JSR WRITEL
    LDA #$00
    JSR WRITER
    INX
    CPX #$0B
    BNE MUTELOOP
    LDX #$07
    LDA #$3F
    JSR WRITEL
    LDA #$3F
    JSR WRITER
    RTS

; ------------------------------------------------------------------
; Apple II autostart monitor invokes the vector in $03FE/3FF.
; Entry A is shifted processor status; original A is in $45.
; We retain X/Y and the interrupted flags on the IRQ stack.
; ------------------------------------------------------------------
IRQHAND
    PHP                ; preserve entry flags for IRQ chaining
    PHA
    TXA
    PHA
    TYA
    PHA
    CLD                ; interrupts may occur with decimal flag set
    LDA LIFR
    AND #$40
    BEQ OTHERIRQ
    LDA LT1CL             ; acknowledge Timer 1
    JSR FRAME
    PLA
    TAY
    PLA
    TAX
    PLA
    PLP
    LDA $45              ; original accumulator saved by ROM
    RTI
OTHERIRQ
    PLA
    TAY
    PLA
    TAX
    PLA
    PLP
    JMP (OLIRQ)          ; let original handler service it

; ------------------------------------------------------------------
; Decode one 50Hz frame of delta-compressed SID writes.
; ------------------------------------------------------------------
FRAME
    LDA ENDED
    BNE FRAMEEXIT
    LDA #$40
    STA CMDLIMIT
FRAMEREAD
    DEC CMDLIMIT
    BEQ FRAMESTOP
    LDA PTRHI
    CMP #$C0
    BCS FRAMESTOP
    JSR GETBYTE
    CMP #$FF
    BEQ FRAMEEND
    CMP #$FE
    BEQ FRAMELOOP
    CMP #$FD
    BEQ FRAMESTOP
    CMP #$19
    BCS FRAMESTOP        ; malformed register number
    TAX
    JSR GETBYTE
    STA SIDREG,X
    JMP FRAMEREAD
FRAMELOOP
    LDA #$06
    STA PTRLO
    LDA #$60
    STA PTRHI
    JMP FRAMEREAD
FRAMESTOP
    LDA #$01
    STA ENDED
    JSR MUTEAY
    RTS
FRAMEEND
    JSR TRANSLATE
FRAMEEXIT
    RTS

GETBYTE
    LDA PTRLO
    STA STREAMRD+1
    LDA PTRHI
    STA STREAMRD+2
STREAMRD
    LDA $6006
    INC PTRLO
    BNE GETDONE
    INC PTRHI
GETDONE
    RTS

; ------------------------------------------------------------------
; 3 SID voices -> AY channels A,B,C on both chips.
; SID phase increment: Fsid*985248/2^24 (PAL C64)
; AY period: Fapple/(16*Fsid) = round($1097F5 / SIDfreq)
; A 24/16 unsigned restoring divide retains vibrato/pitch slides.
; ------------------------------------------------------------------
TRANSLATE
    LDA #$3F
    STA MIXER
    LDA #$00
    STA NOISEPER
    LDX #$00
VOICELOOP
    STX VOICENO
    LDY SIDBASE,X
    LDA SIDREG,Y
    STA DIVLO
    INY
    LDA SIDREG,Y
    STA DIVHI
    INY
    INY
    INY
    LDA SIDREG,Y       ; control byte: $04,$0B,$12
    STA CONTROL
    INY
    LDA SIDREG,Y       ; attack/decay
    STA ADRATE
    INY
    LDA SIDREG,Y       ; sustain/release
    STA SRRATE
    JSR ENVELOPE
    LDX VOICENO
    LDA DIVLO
    ORA DIVHI
    BEQ NOFREQ
    JSR PERIOD
    JMP GOTPER
NOFREQ
    LDA #$FF
    STA QLO
    LDA #$0F
    STA QHI
GOTPER
    LDX VOICENO
    LDY AYBASE,X
    LDA QLO
    STA AYBUF,Y
    INY
    LDA QHI
    AND #$0F
    STA AYBUF,Y
    ; Set shared noise period using current computed period.
    LDA CONTROL
    AND #$80
    BEQ TRY_TONE
    LDA QLO
    LSR A
    LSR A
    LSR A
    AND #$1F
    BNE GOODNOISE
    LDA #$01
GOODNOISE
    STA NOISEPER
    LDA MIXER
    AND NOISEMASK,X
    STA MIXER
TRY_TONE
    LDA CONTROL
    AND #$70              ; triangle, saw, pulse -> tone
    BEQ TESTVOLUME
    LDA MIXER
    AND TONEMASK,X
    STA MIXER
TESTVOLUME
    JSR VOLUME
    LDX VOICENO
    STA AYBUF+8,X
    INX
    CPX #$03
    BEQ VOICESDONE
    JMP VOICELOOP
VOICESDONE
    ; Final mixer/noise registers for both chips.
    LDA NOISEPER
    STA AYBUF+6
    LDA MIXER
    STA AYBUF+7
    ; Push 11 AY registers, volume/generator change at 50Hz.
    LDX #$00
FLUSHAY
    LDA AYBUF,X
    JSR WRITEL
    LDA AYBUF,X
    JSR WRITER
    INX
    CPX #$0B
    BNE FLUSHAY
    RTS

; ------------------------------------------------------------------
; 24-bit numerator / 16-bit SID frequency, 24 restoring steps.
; The lower 12 quotient bits are passed to the AY.
; ------------------------------------------------------------------
PERIOD
    LDA DIVLO
    STA DENLO
    LDA DIVHI
    STA DENHI
    LDA #$F5
    STA QLO
    LDA #$97
    STA QHI
    LDA #$10
    STA QTOP
    LDA #$00
    STA REMLO
    STA REMHI
    STA REMTOP
    LDA #$18
    STA DIVCNT
DIVLOOP
    ASL QLO
    ROL QHI
    ROL QTOP
    ROL REMLO
    ROL REMHI
    ROL REMTOP
    SEC
    LDA REMLO
    SBC DENLO
    STA TMPLO
    LDA REMHI
    SBC DENHI
    STA TMPHI
    LDA REMTOP
    SBC #$00
    BCC DIVSKIP
    STA REMTOP
    LDA TMPLO
    STA REMLO
    LDA TMPHI
    STA REMHI
    INC QLO
DIVSKIP
    DEC DIVCNT
    BNE DIVLOOP
    LDA QTOP
    BNE DIVCLAMP
    LDA QHI
    CMP #$10
    BCC DIVGOOD
DIVCLAMP
    LDA #$FF
    STA QLO
    LDA #$0F
    STA QHI
DIVGOOD
    RTS

; ------------------------------------------------------------------
; SID ADSR rough envelope approximation at 50 Hz.
; Attack, decay and release are rate-stepped in 1/50 s units.
; Stores no state in Applesoft zero page.
; ------------------------------------------------------------------
ENVELOPE
    LDX VOICENO
    LDA CONTROL
    AND #$01
    STA GATEBIT
    BEQ GATEOFF
    LDA OLDGAT,X
    BNE RUNENVELOPE
    LDA #$01
    STA ENVMOD,X          ; attack
    LDA #$00
    STA ENVLEV,X
    STA ENVDLY,X
    JMP RUNENVELOPE
GATEOFF
    LDA #$00
    STA ENVMOD,X          ; release
RUNENVELOPE
    LDA GATEBIT
    STA OLDGAT,X
    LDA ENVDLY,X
    BEQ ENVTICK
    DEC ENVDLY,X
    RTS
ENVTICK
    LDA ENVMOD,X
    BEQ RELEASEENV
    CMP #$01
    BEQ ATTACKENV
    ; decay to sustain target
    LDA SRRATE
    LSR A
    LSR A
    LSR A
    LSR A
    STA SUSTAIN
    LDA ENVLEV,X
    CMP SUSTAIN
    BCC ENVRETURN
    BEQ ENVRETURN
    DEC ENVLEV,X
    LDA ADRATE
    AND #$0F
    TAY
    LDA DECAYTBL,Y
    STA ENVDLY,X
ENVRETURN
    RTS
ATTACKENV
    LDA ENVLEV,X
    CMP #$0F
    BEQ ATTACKDONE
    INC ENVLEV,X
    LDA ADRATE
    LSR A
    LSR A
    LSR A
    LSR A
    TAY
    LDA ATTACKTBL,Y
    STA ENVDLY,X
    RTS
ATTACKDONE
    LDA #$02
    STA ENVMOD,X
    RTS
RELEASEENV
    LDA ENVLEV,X
    BEQ ENVRETURN
    DEC ENVLEV,X
    LDA SRRATE
    AND #$0F
    TAY
    LDA DECAYTBL,Y
    STA ENVDLY,X
    RTS

; ------------------------------------------------------------------
; Output V = floor(envelope * master volume / 16).
; Muting on SID gate-off is handled by the release envelope.
; ------------------------------------------------------------------
VOLUME
    LDX VOICENO
    LDA CONTROL
    AND #$F0
    BEQ VOLZERO
    LDA SIDREG+24
    AND #$0F
    TAY
    BEQ VOLZERO
    LDA #$00
VOLMUL
    CLC
    ADC ENVLEV,X
    DEY
    BNE VOLMUL
    LSR A
    LSR A
    LSR A
    LSR A
    RTS
VOLZERO
    LDA #$00
    RTS

; ------------------------------------------------------------------
; $C400 and $C480 VIA AY bus writes. X = AY register, A = value.
; ------------------------------------------------------------------
WRITEL
    PHA
    STX LORA
    LDA #$07
    STA LORB
    LDA #$04
    STA LORB
    PLA
    STA LORA
    LDA #$06
    STA LORB
    LDA #$04
    STA LORB
    RTS
WRITER
    PHA
    STX RORA
    LDA #$07
    STA RORB
    LDA #$04
    STA RORB
    PLA
    STA RORA
    LDA #$06
    STA RORB
    LDA #$04
    STA RORB
    RTS

; ------------------------------------------------------------------
; State and lookup tables: all inside $2000-$5FFF
; ------------------------------------------------------------------
ACTIVE    .BYTE $00
ENDED     .BYTE $00
OLIRQ     .BYTE $00,$00
PTRLO     .BYTE $06
PTRHI     .BYTE $60
VOICENO   .BYTE $00
CONTROL   .BYTE $00
ADRATE    .BYTE $00
SRRATE    .BYTE $00
GATEBIT   .BYTE $00
SUSTAIN   .BYTE $00
MIXER     .BYTE $3F
NOISEPER  .BYTE $00
QLO       .BYTE $00
QHI       .BYTE $00
QTOP      .BYTE $00
DENLO     .BYTE $00
DENHI     .BYTE $00
DIVLO     .BYTE $00
DIVHI     .BYTE $00
REMLO     .BYTE $00
REMHI     .BYTE $00
REMTOP    .BYTE $00
TMPLO     .BYTE $00
TMPHI     .BYTE $00
DIVCNT    .BYTE $00
CMDLIMIT  .BYTE $00
SIDBASE   .BYTE $00,$07,$0E
AYBASE    .BYTE $00,$02,$04
TONEMASK  .BYTE $3E,$3D,$3B
NOISEMASK .BYTE $37,$2F,$1F
ATTACKTBL .BYTE 0,0,0,0,0,0,0,0,0,0,1,2,3,9,16,26
DECAYTBL  .BYTE 0,0,0,0,0,0,0,0,1,2,4,7,9,29,49,79
ENVLEV    .BYTE 0,0,0
ENVDLY    .BYTE 0,0,0
ENVMOD    .BYTE 0,0,0
OLDGAT    .BYTE 0,0,0
SIDREG    .BYTE 0,0,0,0,0,0,0,0,0,0,0,0,0
          .BYTE 0,0,0,0,0,0,0,0,0,0,0,0
AYBUF     .BYTE 0,0,0,0,0,0,0,0,0,0,0

; WARNING: MAKE SURE data structure is within HGR1+HGR2 area.
; Verify the final code size is under $6000 in ASM_core listing.
