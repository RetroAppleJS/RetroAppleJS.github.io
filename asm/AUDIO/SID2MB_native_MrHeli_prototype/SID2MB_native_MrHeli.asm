; Native Mr. Heli PSID -> Mockingboard prototype
; Apple II+ / 6502 / slot 4 Mockingboard
; SPECIFICALLY for original PSID: Mr. Heli, Charles Deenen (1989).
; ASSEMBLER: RetroAppleJS ASM_core.js, dialect RetroAppleJS or multi.
;
; CALL 8192 - validate PSID at $6000, copy its C64 payload to $0CA0,
;             patch native SID writes to $5F00, and start 50 Hz IRQ.
; CALL 8195 - stop playback/restore IRQ vector.
; CALL 8198 - reset/reinitialize song (5th subtune).
;
; DANGER: uses $0CA0-$1F0A, a range normally used by Applesoft.
; Use on a cleared BASIC workspace and reserve upper BASIC memory BEFORE
; loading the C64 payload. Do not load/run other Applesoft programs.
; The driver uses $2000-$5FFF: do not enable HGR/HGR2 graphics.
; Does not provide full C64 API. No RSID or generic PSID support.
; Prototype is NOT yet run on Apple II hardware or RetroAppleJS.
;
; The native $0E34 player writes register-like values to $5F00-$5F18.
; An IRQ at 50Hz runs C64 music code with a private saved zero page,
; restores Applesoft zero page, converts to AY, and writes both chips.
;
ORG $2000
STARTV   JMP INSTALL
STOPV    JMP UNINST
RESETV   JMP RESTART

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

; Dedicated non-code state at the end of our reserved memory.
OSZP     EQU $5D00
C64ZP    EQU $5E00
SIDREG   EQU $5F00

INSTALL
    SEI
    LDA ACTIVE
    BEQ CHECKPSID
    CLI
    RTS
CHECKPSID
    LDA $6000
    CMP #$50
    BNE BADFMT
    LDA $6001
    CMP #$53
    BNE BADFMT
    LDA $6002
    CMP #$49
    BNE BADFMT
    LDA $6003
    CMP #$44
    BNE BADFMT
    LDA $6006
    BNE BADFMT
    LDA $6007
    CMP #$7C
    BNE BADFMT
    LDA $6008
    ORA $6009
    BNE BADFMT
    LDA $600A
    CMP #$1E
    BNE BADFMT
    LDA $600B
    CMP #$F3
    BNE BADFMT
    LDA $600C
    CMP #$0E
    BNE BADFMT
    LDA $600D
    CMP #$34
    BNE BADFMT
    LDA $607C
    CMP #$A0
    BNE BADFMT
    LDA $607D
    CMP #$0C
    BNE BADFMT
    JMP CHECKTITLE
BADFMT
    LDA #$01
    STA ERRORCD
    CLI
    RTS
CHECKTITLE
    ; Validate Mr. Heli title and correct binary before modifying RAM.
    LDA $6016
    CMP #$4D
    BNE BADTITLE
    LDA $6017
    CMP #$72
    BNE BADTITLE
    LDA $6018
    CMP #$2E
    BNE BADTITLE
    LDA $6019
    CMP #$20
    BNE BADTITLE
    LDA $601A
    CMP #$48
    BNE BADTITLE
    LDA $601B
    CMP #$65
    BNE BADTITLE
    LDA $601C
    CMP #$6C
    BNE BADTITLE
    LDA $601D
    CMP #$69
    BNE BADTITLE
    JMP COPYPSID
BADTITLE
    JMP BADFMT

; Copies precisely $126B native bytes: $607E..$72E8 to $0CA0..$1F0A.
; This is intentionally exact for Mr. Heli, NOT a generic SID loader.
COPYPSID
    LDA #$00
    STA ERRORCD
    LDA #$7E
    STA COPYREAD+1
    LDA #$60
    STA COPYREAD+2
    LDA #$A0
    STA COPYWRITE+1
    LDA #$0C
    STA COPYWRITE+2
    LDY #$12
COPYPAGE
    LDX #$00
COPYREAD
    LDA $607E,X
COPYWRITE
    STA $0CA0,X
    INX
    BNE COPYREAD
    INC COPYREAD+2
    INC COPYWRITE+2
    DEY
    BNE COPYPAGE
    LDX #$00
COPYLAST
    LDA $727E,X
    STA $1EA0,X
    INX
    CPX #$6B
    BNE COPYLAST

; Validate all original 3-byte store operands ($D4 high byte), then
; write only the high operand byte ($5F). No opcode relocation.
; Example: STA $D400,Y -> STA $5F00,Y.
PATCHSID
    LDX #$00
PATCHTEST
    LDA PATCHLO,X
    STA PATCHREAD+1
    LDA PATCHHI,X
    STA PATCHREAD+2
PATCHREAD
    LDA $0CC2
    CMP #$D4
    BNE PATCHFAIL
    INX
    CPX #$0E
    BNE PATCHTEST
    LDX #$00
PATCHLOOP
    LDA PATCHLO,X
    STA PATCHWRITE+1
    LDA PATCHHI,X
    STA PATCHWRITE+2
    LDA #$5F
PATCHWRITE
    STA $0CC2
    INX
    CPX #$0E
    BNE PATCHLOOP
    JMP PREPARE
PATCHFAIL
    LDA #$02
    STA ERRORCD
    CLI
    RTS

PREPARE
    ; Remember interrupt owner, but do not steal it when already active.
    LDA $03FE
    STA OLIRQ
    LDA $03FF
    STA OLIRQ+1
    JSR INITBUS
    ; Save BASIC's current ZP before entering C64 code.
    JSR SAVEOS
    LDX #$00
    LDA #$00
CLEARC64
    STA $0000,X
    STA SIDREG,X
    INX
    BNE CLEARC64
    JSR INITSONG
    JSR SAVEC64
    JSR RESTOREOS
    JSR TRANSLATE
    ; Hook IRQ only after the original tune is initialized.
    LDA #<IRQHAND
    STA $03FE
    LDA #>IRQHAND
    STA $03FF
    LDA #$40
    STA LACR
    LDA #$7F
    STA LIER
    STA RIER
    LDA #$40
    STA LIFR
    LDA #$C0
    STA LIER
    LDA #$E7
    STA LT1CL
    LDA #$4F
    STA LT1CH
    LDA #$01
    STA ACTIVE
    CLI
    RTS

INITSONG
    ; C64 init expects zero-based subtune number in A. Select tune 5.
    LDA #$04
    JSR $1EF3
    RTS

RESTART
    SEI
    LDA ACTIVE
    BNE RESTARTDO
    CLI
    RTS
RESTARTDO
    JSR SAVEOS
    JSR RESTOREC64
    JSR INITSONG
    JSR SAVEC64
    JSR RESTOREOS
    JSR TRANSLATE
    CLI
    RTS

UNINST
    SEI
    LDA ACTIVE
    BNE UNINSTALLDO
    CLI
    RTS
UNINSTALLDO
    LDA #$40
    STA LIER
    STA LIFR
    LDA OLIRQ
    STA $03FE
    LDA OLIRQ+1
    STA $03FF
    LDA #$00
    STA ACTIVE
    JSR MUTEAY
    CLI
    RTS

SAVEOS
    LDX #$00
SAVEOSLOOP
    LDA $0000,X
    STA OSZP,X
    INX
    BNE SAVEOSLOOP
    RTS
RESTOREOS
    LDX #$00
RESTOREOSLOOP
    LDA OSZP,X
    STA $0000,X
    INX
    BNE RESTOREOSLOOP
    RTS
SAVEC64
    LDX #$00
SAVEC64LOOP
    LDA $0000,X
    STA C64ZP,X
    INX
    BNE SAVEC64LOOP
    RTS
RESTOREC64
    LDX #$00
RESTOREC64LOOP
    LDA C64ZP,X
    STA $0000,X
    INX
    BNE RESTOREC64LOOP
    RTS

; Apple II ROM IRQ trampoline convention, as in SID2MB_resident.asm.
; Our modified code shares that dependency; needs in-emulator validation.
IRQHAND
    PHP
    PHA
    TXA
    PHA
    TYA
    PHA
    CLD
    LDA LIFR
    AND #$40
    BEQ OTHERIRQ
    LDA LT1CL
    JSR SAVEOS
    JSR RESTOREC64
    JSR $0E34
    CLD                ; Keep host translator in binary arithmetic
    JSR SAVEC64
    JSR RESTOREOS
    JSR TRANSLATE
    PLA
    TAY
    PLA
    TAX
    PLA
    PLP
    LDA $45
    RTI
OTHERIRQ
    PLA
    TAY
    PLA
    TAX
    PLA
    PLP
    JMP (OLIRQ)

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
; Resident state: driver and AY translation tables.
; ------------------------------------------------------------------
ACTIVE    .BYTE $00
ERRORCD   .BYTE $00
OLIRQ     .BYTE $00,$00
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
AYBUF     .BYTE 0,0,0,0,0,0,0,0,0,0,0

; WARNING: MAKE SURE data structure is within HGR1+HGR2 area.
; Verify the final code size is under $6000 in ASM_core listing.

; Patch addresses for Mr. Heli native C64 binary.
PATCHLO .BYTE $C2,$26,$29,$2C,$89,$A9,$AE,$B5,$BA,$BF,$C4,$C9,$D6,$DB
PATCHHI .BYTE $0C,$0E,$0E,$0E,$12,$13,$13,$13,$13,$13,$13,$13,$13,$13
