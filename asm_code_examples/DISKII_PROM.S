;*************************************
;***     APPLE DISK II PROM        ***
;***        DISASSEMBLY BY         ***
;***       FREDDY VANDRIESSCHE     ***
;***     MIT LICENSE APPLICABLE    ***
;*************************************

ORG   $C600

LSLOT  = $2B   ; Last booted slot number * 16
SLOTIO = $C080 ; Slot I/O
M.WAIT = $FCA8 ; ROM WAIT
DOS.1   = $3C  ; VARIABLE 1
DOS.2   = $3D  ; VARIABLE 2
DOS.3   = $40  ; VARIABLE 3
DOS.4   = $41  ; VARIABLE 4

; Build GCR lookup table (values 0-63)
; ranging from 036C > 03D5

        LDX   #$20          ; 32
        LDY   #$00
        LDX   #$03
L01     STX   *DOS.1        ; Store X in DOS register
        TXA
        ASL   A		    ; *2
        BIT   *DOS.1        ; AND ACC with DOS register 
        BEQ   L03	    ; JUMP IF ZERO 
        ORA   *DOS.1        ; OR ACC with DOS register >> put back in ACC
        EOR   #$FF          ; %11111111 invert all ACC bits 
        AND   #$7E          ; %01111110 remove first & last bit of ACC
L02     BCS   L03
        LSR   A   
        BNE   L02
        TYA 
        STA   $0356,X       ; write in lookup table
        INY  
L03     INX   
        BPL   L01

        JSR   $FF58         ; RTS (in ROM)       
        TSX                 ; Put status register in X
        LDA   $0100,X       ; Stack       
        ASL   A             
        ASL   A             
        ASL   A             
        ASL   A             ; *16 (move lower nibble to upper)
        STA   *LSLOT
        TAX                 
        LDA   SLOTIO+14,X   ; TRIGGER I/O
        LDA   SLOTIO+12,X   ; TRIGGER I/O
        LDA   SLOTIO+10,X   ; TRIGGER I/O
        LDA   SLOTIO+9,X    ; TRIGGER I/O
        LDY   #$50          ; 80
L04     LDA   SLOTIO,X      ; TRIGGER I/O
        TYA
        AND   #$03          ; 3
        ASL   A             ; *2
        ORA   *LSLOT          
        TAX
        LDA   SLOTIO+1,X    ; TRIGGER I/O
        LDA   #$56          ; LOAD WAITING TIME
        JSR   M.WAIT        ; WAIT 1.9664s
        DEY
        BPL   L04           ; LOOP #$50 (80) times
        STA   *$26          ; LORES cursor row address (LO)      
        STA   *DOS.2        ; DOS register  
        STA   *DOS.4        ; DOS register
        LDA   #$08
        STA   *$27          ; LORES cursor row address (HI)
L05     CLC
L06     PHP                 ; PUSH Processor status on stack
L07     LDA   SLOTIO+12,X   ; LOAD I/O      
        BPL   L07           ; LOOP IF NEG
L08     EOR   #$D5
        BNE   L07           ; LOOP IF NEG
L09     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L09           ; LOOP IF POS
        CMP   #$AA
        BNE   L08           ; LOOP IF NEG      
        NOP
L10     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L10           ; LOOP IF POS
        CMP   #$96          
        BEQ   L11           ; JUMP IF = 150 
        PLP                 ; Overwrite processor status register with stack value
        BCC   L05           ; LOOP IF CARRY CLEAR
        EOR   #$AD
        BEQ   L15           ; JUMP IF EQUAL
        BNE   L05           ; LOOP IF NOT EQUAL

L11     LDY   #$03
L12     STA   *DOS.3        ; DOS register
L13     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L13           ; Keep reading until neg value found

        ROL   A              
        STA   *DOS.1           
L14     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L14           ; Keep reading until neg value found

        AND   *DOS.1        ; DOS register
        DEY
        BNE   L12           ; LOOP IF NOT EQUAL

        PLP                 ; PULL processor status from stack
        CMP   *DOS.2        ; CMP DOS register
        BNE   L05           ; LOOP IF NOT EQUAL
        LDA   *DOS.3        ; DOS REGISTER          
        CMP   *DOS.4        ; DOS REGISTER            
        BNE   L05           ; LOOP IF NOT EQUAL
        BCS   L06           ; LOOP IF CARRY SET
L15     LDY   #$56          ; POINTER
L16     STY   *DOS.1        ; DOS REGISTER
L17     LDY   SLOTIO+12,X   ; LOAD I/O      
        BPL   L17
        EOR   $02D6,Y       ; Plain memory
        LDY   *DOS.1        ; DOS REGISTER         
        DEY                 
        STA   $0300,Y       ; Plain memory    
        BNE   L16         
L18     STY   *DOS.1        ; DOS REGISTER           
L19     LDY   SLOTIO+12,X   ; LOAD I/O        
        BPL   L19         
        EOR   $02D6,Y       ; Plain memory
        LDY   *DOS.1        ; DOS REGISTER           
        STA   ($26),Y       ; LORES cursor row address (LO)
        INY                 
        BNE   L18         
 L20    LDY   SLOTIO+12,X   ; LOAD I/O        
        BPL   L20         
        EOR   $02D6,Y       ; Plain memory       
 L21    BNE   L05         
        LDY   #$00          
 L22    LDX   #$56          
 L23    DEX                 
        BMI   L22           ; LOOP 86 times (delay)     
        LDA   ($26),Y       ; LORES cursor row address (LO)       
        LSR   $0300,X       ; Plain memory       
        ROL   A             
        LSR   $0300,X       ; Plain memory       
        ROL   A              
        STA   ($26),Y       ; LORES cursor row address (LO)       
        INY                 
        BNE   L23
        INC   *$27          ; LORES cursor row address (HI)           
        INC   *DOS.2        ; DOS register
        LDA   *DOS.2        ; DOS register           
        CMP   $0800         ; Beginning of BASIC Program
        LDX   *LSLOT           
        BCC   L21
        JMP   $0801         ; Beginning of BASIC Program
