ORG   $C600

LSLOT  = $2B   ; Last booted slot number * 16
SLOTIO = $C080 ; Slot I/O
M.WAIT = $FCA8 ; ROM WAIT

        LDX   #$20
        LDY   #$00
        LDX   #$03
L1      STX   *$3C          ; DOS register
        TXA
        ASL   A
        BIT   *$3C          ; DOS register 
        BEQ   L3
        ORA   *$3C          ; DOS register 
        EOR   #$FF          ; 255
        AND   #$7E          ; 126
L2      BCS   L3
        LSR   A   
        BNE   L2
        TYA 
        STA   $0356,X       ; Plain memory 
        INY  
L3      INX   
        BPL   L1
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
L4      LDA   SLOTIO,X      ; TRIGGER I/O
        TYA
        AND   #$03          ; 3
        ASL   A             ; *2
        ORA   *LSLOT          
        TAX
        LDA   SLOTIO+1,X    ; TRIGGER I/O
        LDA   #$56          ; LOAD WAITING TIME
        JSR   M.WAIT        ; WAIT 1.9664s
        DEY
        BPL   L4            ; LOOP #$50 (80) times
        STA   *$26          ; LORES cursor row address (LO)      
        STA   *$3D          ; DOS register  
        STA   *$41          ; DOS register
        LDA   #$08
        STA   *$27          ; LORES cursor row address (HI)
L5      CLC
L55     PHP
L6      LDA   SLOTIO+12,X   ; LOAD I/O      
        BPL   L6            ; LOOP IF NEG
L7      EOR   #$D5
        BNE   L6            ; LOOP IF NEG
L8      LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L8            ; LOOP IF POS
        CMP   #$AA
        BNE   L7            ; LOOP IF NEG      
        NOP
L9      LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L9            ; LOOP IF POS
        CMP   #$96
        BEQ   L10           ; JUMP IF =150 
        PLP
        BCC   L5            ; LOOP IF CARRY CLEAR
        EOR   #$AD
        BEQ   L13
        BNE   L5
L10     LDY   #$03
L11     STA   *$40          ; DOS register
        LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L12           ; JUMP IF POS
        ROL   A              
        STA   *$3C           
L12     LDA   SLOTIO+12,X   ; LOAD I/O
        BPL   L12
        AND   *$3C
        DEY
        BNE   L11           ; LOOP IF NEG
        PLP
        CMP   *$3D          ; CMP DOS register
        BNE   L5
        LDA   *$40          ; DOS REGISTER          
        CMP   *$41          ; DOS REGISTER            
        BNE   L5
        BCS   L55
L13     LDY   #$56          ; POINTER
L14     STY   *$3C          ; DOS REGISTER
L15     LDY   SLOTIO+12,X   ; LOAD I/O      
        BPL   L15
        EOR   $02D6,Y       ; Plain memory
        LDY   *$3C          ; DOS REGISTER         
        DEY                 
        STA   $0300,Y       ; Plain memory    
        BNE   L14         
 L16    STY   *$3C          ; DOS REGISTER           
        LDY   SLOTIO+12,X       
        BPL   $C6BC         
        EOR   $02D6,Y       ; Plain memory
        LDY   *$3C          ; DOS REGISTER           
        STA   ($26),Y       ; LORES cursor row address (LO)
        INY                 
        BNE   L16         
 L17    LDY   LOTIO+12,X       
        BPL   L17         
        EOR   $02D6,Y       ; Plain memory       
 L18    BNE   L5         
        LDY   #$00          
 L19    LDX   #$56          
 L20    DEX                 
        BMI   L19           ; LOOP 86 times (delay)     
        LDA   ($26),Y       ; LORES cursor row address (LO)       
        LSR   $0300,X       ; Plain memory       
        ROL   A             
        LSR   $0300,X       ; Plain memory       
        ROL   A              
        STA   ($26),Y       ; LORES cursor row address (LO)       
        INY                 
        BNE   L20
        INC   *$27          ; LORES cursor row address (HI)           
        INC   *$3D          ; DOS register
        LDA   *$3D          ; DOS register           
        CMP   $0800         ; Beginning of BASIC Program
        LDX   *LSLOT           
        BCC   L18         
        JMP   $0801         ; Beginning of BASIC Program