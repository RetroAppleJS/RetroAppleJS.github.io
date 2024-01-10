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

        LDX   #$20
        LDY   #$00
        LDX   #$03
L01     STX   *$3C          ; DOS register
        TXA
        ASL   A
        BIT   *$3C          ; DOS register 
        BEQ   L03
        ORA   *$3C          ; DOS register 
        EOR   #$FF          ; 255
        AND   #$7E          ; 126
L02     BCS   L03
        LSR   A   
        BNE   L02
        TYA 
        STA   $0356,X       ; Plain memory 
        INY  
L03     INX   
        BPL   L01
        JSR   $FF58         ; RTS (in ROM)       
        TSX                 
        LDA   $0100,X       ; Stack       
        ASL   A             
        ASL   A             
        ASL   A             
        ASL   A  
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
        STA   *$3D          ; DOS register  
        STA   *$41          ; DOS register
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
        BEQ   L11           ; JUMP IF =150 
        PLP                 ; PULL processor status from stack
        BCC   L05           ; LOOP IF CARRY CLEAR
        EOR   #$AD
        BEQ   L15           ; JUMP IF EQUAL
        BNE   L05
L11     LDY   #$03
L12     STA   *$40          ; DOS register
L13     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L13           ; JUMP IF POS
        ROL   A              
        STA   *$3C           
L14     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L14           ; LOOP IF POS
        AND   *$3C
        DEY
        BNE   L12           ; LOOP IF NOT EQUAL
        PLP                 ; PULL processor status from stack
        CMP   *$3D          ; CMP DOS register
        BNE   L05           ; LOOP IF NOT EQUAL
        LDA   *$40          ; DOS REGISTER          
        CMP   *$41          ; DOS REGISTER            
        BNE   L05           ; LOOP IF NOT EQUAL
        BCS   L06           ; LOOP IF CARRY SET
L15     LDY   #$56          ; POINTER
L16     STY   *$3C          ; DOS REGISTER
L17     LDY   SLOTIO+12,X   ; LOAD I/O      
        BPL   L17
        EOR   $02D6,Y       ; Plain memory
        LDY   *$3C          ; DOS REGISTER         
        DEY                 
        STA   $0300,Y       ; Plain memory    
        BNE   L16         
L18     STY   *$3C          ; DOS REGISTER           
L19     LDY   SLOTIO+12,X   ; LOAD I/O        
        BPL   L19         
        EOR   $02D6,Y       ; Plain memory
        LDY   *$3C          ; DOS REGISTER           
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
        INC   *$3D          ; DOS register
        LDA   *$3D          ; DOS register           
        CMP   $0800         ; Beginning of BASIC Program
        LDX   *LSLOT           
        BCC   L21         
        JMP   $0801         ; Beginning of BASIC Program
