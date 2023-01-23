;-------------------------------------------------------------------------
;
; The WOZ Apple Cassette Interface for the Apple 1
; Written by Steve Wozniak somewhere around 1976
;
;   Converted from
;   http://www.willegal.net/appleii/aci-v0.18.pdf
;
;-------------------------------------------------------------------------
    
*=$C100

;-------------------------------------------------------------------------
;  Memory declaration
;-------------------------------------------------------------------------

HEX1L           EQU      $24             ; Last "opened" location Low
HEX1H           EQU      $25             ; Last "opened" location High
HEX2L           EQU      $26             ; Store address Low
HEX2H           EQU      $27             ; Store address High
SAVEINDEX       EQU      $28             ; Hex value parsing Low
LASTSTATE       EQU      $29             ; Hex value parsing High

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
NEXTCHAR        INY
KBDWAIT         LDA    KBDCR             ;Wait for a key
                BPL    KBDWAIT           ;Still no key!

                LDA KBD                  ;Read key from keyboard
                STA IN,Y                 ;Save it into buffer
                JSR ECHO                 ;And type it on the screen  
                CMP #ESC
                BEQ WOZACI               ;Start from scratch if ESC!
                CMP #CR
                BNE NEXTCHAR             ;Read keys until CR

                LDX #$FF                 ;Initialize parse buffer pointer

;-------------------------------------------------------------------------
; Start parsing first or a new tape command
;-------------------------------------------------------------------------

NEXTCMD         LDA #0                  ;Clear begin and end values
                STA HEX1L
                STA HEX1H
                STA HEX2L
                STA HEX2H

NEXTCHR         INX
                LDA IN,X
                CMP #$D2
                BEQ READ
                CMP #$D7
                BEQ WRITE
                CMP #$AE
                BEQ SEP
                CMP #CR
                BEQ GOESC
                CMP #$A0
                BEQ NEXTCHR
                EOR #$B0
                CMP #9+1
                BCC DIG
                ADC #$88
                CMP #$FA
                BCC WOZACI

DIG             ASL
                ASL
                ASL
                ASL

                LDY #4
HEXSHIFT        ASL
                ROL HEX1L
                ROL HEX1H
                DEY
                BNE HEXSHIFT
                BEQ NEXTCHR

;-------------------------------------------------------------------------
; Return to monitor, prints \ first
;-------------------------------------------------------------------------

GOESC           JMP ESCAPE

;-------------------------------------------------------------------------
; Separating . found. Copy HEX1 to Hex2. Doesn’t clear HEX1!!!
;-------------------------------------------------------------------------

SEP             LDA HEX1L
                STA HEX2L
                

;-------------------------------------------------------------------------
