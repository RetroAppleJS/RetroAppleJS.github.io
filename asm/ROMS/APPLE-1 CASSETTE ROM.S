*=$C100

;-------------------------------------------------------------------------
;
; The WOZ Apple Cassette Interface for the Apple 1
; Written by Steve Wozniak somewhere around 1976
;
;   Converted from
;   http://www.willegal.net/appleii/aci-v0.18.pdf
;
;-------------------------------------------------------------------------

;-------------------------------------------------------------------------
;  Memory declaration
;-------------------------------------------------------------------------

HEX1L           EQU      $24             ; Last "opened" location Low
HEX1H           EQU      $25             ; Last "opened" location High
HEX2L           EQU      $26             ; Store address Low
HEX2H           EQU      $27             ; Store address High
SAVIDX          EQU      $28             ; Hex value parsing Low
LSTSTA          EQU      $29             ; Hex value parsing High

IN              EQU      $0200           ; Input buffer ($0200 - $027F)
FLIP            EQU      $C000           ; Output flip-flop
TAPEIN          EQU      $C081           ; Tape input
KBD             EQU      $D010           ; PIA.A keyboard input
KBDCR           EQU      $D011           ; PIA.A keyboard control register
ESCAPE          EQU      $FF1A           ; Escape back to monitor
ECHO            EQU      $FFEF           ; Echo character to terminal

; KBD b7..b0 are inputs, b6..b0 is ASCII input, b7 is constant high
;     Programmed to respond to low to high KBD strobe

;-------------------------------------------------------------------------
;  Constants
;-------------------------------------------------------------------------

CR              EQU      $8D             ; Carriage Return
ESC             EQU      $9B             ; ESC key

;-------------------------------------------------------------------------
;  Let's get started
;-------------------------------------------------------------------------

WOZACI          LDA    #$AA              ;Print the Tape prompt “*”
                JSR    ECHO
                LDA    #CR               ;And drop the cursor one line
                JSR    ECHO
                LDY    #$FF              ;Reset the input buffer index
NXTCHR          INY
KBDWAIT         LDA    KBDCR             ;Wait for a key
                BPL    KBDWAIT           ;Still no key!

                LDA KBD                  ;Read key from keyboard
                STA IN,Y                 ;Save it into buffer
                JSR ECHO                 ;And type it on the screen  
                CMP #ESC
                BEQ WOZACI               ;Start from scratch if ESC!
                CMP #CR
                BNE NXTCHR             ;Read keys until CR

                LDX #$FF                 ;Initialize parse buffer pointer

;-------------------------------------------------------------------------
; Start parsing first or a new tape command
;-------------------------------------------------------------------------

NXTCMD          LDA #0                  ;Clear begin and end values
                STA *HEX1L
                STA *HEX1H
                STA *HEX2L
                STA *HEX2H

NXTCH1          INX                     ;Increment input pointer
                LDA IN,X                ;Get next char from input line
                CMP #$D2                ;Read command? “R”
                BEQ READ                ;Yes!
                CMP #$D7                ;Write command? “W”
                BEQ WRITE               ;Yes! (note: CY=1)
                CMP #$AE                ;Separator?”.”
                BEQ SEP                 ;Yes!
                CMP #CR                 ;End of line?
                BEQ GOESC               ;Escape to monitor! We’re done
                CMP #$A0                ;Ignore spaces: ” “
                BEQ NXTCH1
                EOR #$B0                ;Map digits to 0-9 “0”
                CMP #$0A                ;(9+1) Is it a decimal digit?
                BCC DIG                 ;Yes!
                ADC #$88                ;Map letter “A”-”F” to $FA-$FF
                CMP #$FA                ;Hex letter?
                BCC WOZACI              ;No! Character not hex!

DIG             ASL A                    ;Hex digit to MSD of A
                ASL A
                ASL A
                ASL A

                LDY #4                  ;Shift count
HEXSHIFT        ASL A                   ;Hex digit left, MSB to carry
                ROL *HEX1L              ;Rotate into LSD
                ROL *HEX1H              ;Rotate into MSD
                DEY                     ;Done 4 shifts?
                BNE HEXSHIFT            ;No! Loop
                BEQ NXTCH1              ;Handle next character

;-------------------------------------------------------------------------
; Return to monitor, prints \ first
;-------------------------------------------------------------------------

GOESC           JMP ESCAPE              ;Escape back to monitor

;-------------------------------------------------------------------------
; Separating . found. Copy HEX1 to Hex2. Doesn’t clear HEX1!!!
;-------------------------------------------------------------------------

SEP             LDA *HEX1L               ;Copy hex value 1 to hex value 2
                STA *HEX2L
                LDA *HEX1H
                STA *HEX2H
                BCS NXTCH1             ;Always taken!

;-------------------------------------------------------------------------
; Write a block of memory to tape
;-------------------------------------------------------------------------

WRITE           LDA #64
                JSR WHEADER

WRNXT           DEY
                LDX #0
                LDA (HEX2L,X)

                LDX #$10                ;(8*2) Shift 8 bits (decremented twice)
WBITLOOP        ASL A               
                JSR WRITEBIT
                BNE WBITLOOP

                JSR INCADDR
                LDY #30
                BCC WRNXT

RESTIDX         LDX *SAVIDX
                BCS NXTCMD

;-------------------------------------------------------------------------
; Read from tape
;-------------------------------------------------------------------------

READ            JSR FULLCYCLE
                LDA #22
                JSR WHEADER
                JSR FULLCYCLE

NOTSTART        LDY #31
                JSR CMPLEVEL
                BCS NOTSTART

                JSR CMPLEVEL

                LDY #58     
RDBYTE          LDX #8
RDBIT           PHA
                JSR FULLCYCLE
                PLA
                ROL A
                LDY #57
                DEX
                BNE RDBIT
                STA (HEX2L,X)

                JSR INCADDR
                LDY #53
                BCC RDBYTE
                BCS RESTIDX

FULLCYCLE       JSR CMPLEVEL
CMPLEVEL        DEY
                LDA TAPEIN
                CMP *LSTSTA
                BEQ CMPLEVEL
                STA *LSTSTA

                CPY #128
                RTS 

;-------------------------------------------------------------------------
; Write header to tape
;
; The header consists of an asymmetric cycle, starting with one phase of
; approximately (66+47)x5=565µs, followed by a second phase of
; approximately (44+47)x5=455µs,
; Total cycle duration is approximately 1020µs ~ 1kHz. The actual
; frequency will be a bit lower because of the additional workload between
; the two loops.
; The header ends with a short phase of (30+47)x5=385µs and a normal
; phase of (44+47)x5=455µs. This start bit must be detected by the read
; routine to trigger the reading of the actual data.
;-------------------------------------------------------------------------

WHEADER         STX *SAVIDX             ;Save index in input line
HCOUNT          LDY #66                 ;Extra long delay
                JSR WDELAY              ;CY is constantly 1, writing a 1
                BNE HCOUNT              ;Do this 64 * 256 time! 
                ADC #$FE                ;Decrement A (CY=1 all the time)
                BCS HCOUNT              ;Not all done!
                LDY #30                 ;Write a final short bit (start)

;-------------------------------------------------------------------------
; Write a full bit cycle
;
; Upon entry Y contains a compensated value for the first phase of 0
; bit length. All subsequent loops don’t have to be time compensated.
;-------------------------------------------------------------------------

WRITEBIT        JSR WDELAY
                LDY #44

WDELAY          DEY
                BNE WDELAY
                BCC WRITE1

                LDY #47
WDELAY0         DEY
                BNE WDELAY0

WRITE1          LDY FLIP,X 
                LDY #41
                DEX
                RTS

;-------------------------------------------------------------------------
; Increment current address and compare with last address
;-------------------------------------------------------------------------

INCADDR         LDA *HEX2L
                CMP *HEX1L
                LDA *HEX2H
                SBC *HEX1H 
                INC *HEX2L
                BNE NOCARRY
                INC *HEX2H
NOCARRY         RTS

;-------------------------------------------------------------------------
