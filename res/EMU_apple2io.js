//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2io.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{}}}
//else oEMU.component.IO = new Apple2IO();

if(oEMUI===undefined) var oEMUI = {"slotConfig":function(){}} // allow tools to include apple2io.js without apple2main.js


function Apple2IO(vid)
{

    const ROM_ADDR =      0xD000;
    const ROM_SIZE =      0x4000;

    // Slot I/O addresses
    const SLOT_IO =    [0x80,
                        0x90,
                        0xA0,
                        0xB0,
                        0xC0,
                        0xD0, 
                        0xE0,
                        0xF0];
    const SLT_IO_SIZE = 0x10;

    // Slot RAM/ROM spaces
    const SLOT_PROM =  [0,   // SLOT0_PROM does not exist
                        0x100,
                        0x200,
                        0x300,
                        0x400,
                        0x500,
                        0x600,
                        0x700];
    const SLT_PROM_SIZE = 0x100;     

    const KEY_DATA =    0x00,
        KEY_STROBE =    0x10,
        CASS_TOGGLE =   0x20,
        SPKR_TOGGLE =   0x30,
        UTIL_STROBE =   0x40,
        GFX_ON =        0x50,
        GFX_OFF =       0x51,
        GFX_MIX_OFF =   0x52,
        GFX_MIX_ON =    0x53,
        GFX_PAGE1 =     0x54,
        GFX_PAGE2 =     0x55,
        GFX_LORES =     0x56,
        GFX_HIRES =     0x57,
        CASS_IN =       0x60,
        FLAG_IN0 =      0x61,
        FLAG_IN1 =      0x62,
        FLAG_IN2 =      0x63,
        ANALOG_IN0 =    0x64,
        ANALOG_IN1 =    0x65,
        ANALOG_IN2 =    0x66,
        ANALOG_IN3 =    0x67,
        ANALOG_CLR =    0x70;

    // MAP DISK I/O TO SLOT#6 MEMORY
    var DISK_IO =       SLOT_IO[6],
        DISK_IO_SIZE =  SLT_IO_SIZE,
        DISK_PROM =     SLOT_PROM[6],
        DISK_PROM_SIZE = SLT_PROM_SIZE;
 
    // MAP RAMCARD I/O TO SLOT#0 MEMORY
    var MEM_RAMCARD_IO =  SLOT_IO[0], MEM_RAMCARD_IO_SIZE =  SLT_IO_SIZE;

    // MAP 80 COLUMN CARD I/O TO SLOT#3 MEMORY
    var MEM_COL80CARD_IO =  SLOT_IO[3], MEM_COL80CARD_IO_SIZE =  SLT_IO_SIZE;
    
    var video = vid;
    var key = 0x00;
    var key_polling = false;
    
    if(typeof(oEMU.component.IO)!="undefined")
    {
        var keys = oCOM.default(oEMU.component.Keyboard,{keystroke:function(){}},"Keyboard");
        var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{toggle:function(){}},"AppleSpeaker");
        this.ramcard = oCOM.default(oEMU.component.IO.RamCard,{active:false},"RamCard");
        this.col80card = oCOM.default(oEMU.component.IO.col80card,{active:false},"col80card");
        this.disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{reset:function(){},diskBytes:[]},"AppleDisk");
        oEMU.component.IO.self = this;
    }

    this.reset = function()
    {
        key = 0x00;
        this.disk2.reset();
    }

    function line_decode(adr)
    {
        return adr<256 ? adr & 0xF0 : (adr & 0xFF00); // line decoder on IO & PROM addressing
    }

    var ACTION_MAP = IO_map("A2");
    console.log(ACTION_MAP);

    function IO_map(model)
    {

    // Comp:  O = Apple II+  E = Apple IIe  C = Apple IIc  G = Apple IIgs
    // Act:   R = Read       W = Write      7 = Bit 7      V = Value

    const IOMAP = // https://www.kreativekorp.com/miscpages/a2info/iomemory.shtml
         "C000 49152 KBD          OEC G  R   Last Key Pressed + 128\n"
        +"           80STOREOFF    EC G W    Use $C002-$C005 for Aux Memory\n"
        +"           KBDBUSA           T     V Keyboard 'A' busdata\n"
        +"C001 49153 80STOREON     EC G W    Use PAGE2 for Aux Memory\n"
        +"C002 49154 RDMAINRAM     EC G W    If 80STORE Off: Read Main Mem $0200-$BFFF\n"
        +"C003 49155 RDCARDRAM     EC G W    If 80STORE Off: Read Aux Mem $0200-$BFFF\n"
        +"C004 49156 WRMAINRAM     EC G W    If 80STORE Off: Write Main Mem $0200-$BFFF\n"
        +"C005 49157 WRCARDRAM     EC G W    If 80STORE Off: Write Aux Mem $0200-$BFFF\n"
        +"C006 49158 SETSLOTCXROM  E  G W    Peripheral ROM ($C100-$CFFF)\n"
        +"C007 49159 SETINTCXROM   E  G W    Internal ROM ($C100-$CFFF)\n"
        +"C008 49160 SETSTDZP      EC G W    Main Stack and Zero Page\n"
        +"           KBDBUSB           T     V Keyboard 'B' busdata\n"
        +"C009 49161 SETALTZP      EC G W    Aux Stack and Zero Page\n"
        +"C00A 49162 SETINTC3ROM   E  G W    ROM in Slot 3\n"
        +"C00B 49163 SETSLOTC3ROM  E  G W    ROM in Aux Slot\n"
        +"C00C 49164 CLR80VID      EC G W    40 Columns\n"
        +"C00D 49165 SET80VID      EC G W    80 Columns\n"
        +"C00E 49166 CLRALTCHAR    EC G W    Primary Character Set\n"
        +"C00F 49167 SETALTCHAR    EC G W    Alternate Character Set\n"
        +"C010 49168 KBDSTRB      OECTG WR   Keyboard Strobe\n"
        +"C011 49169 RDLCBNK2      EC G  R7  Status of Selected $Dx Bank\n"
        +"C012 49170 RDLCRAM       EC G  R7  Status of $Dx ROM / $Dx RAM\n"
        +"C013 49171 RDRAMRD       EC G  R7  Status of Main/Aux RAM Reading\n"
        +"C014 49172 RDRAMWRT      EC G  R7  Status of Main/Aux RAM Writing\n"
        +"C015 49173 RDCXROM       E  G  R7  Status of Periph/ROM Access\n"
        +"           RSTXINT        C    R   Reset Mouse X0 Interrupt\n"
        +"C016 49174 RDALTZP       EC G  R7  Status of Main/Aux Stack and Zero Page\n"
        +"C017 49175 RDC3ROM       E  G  R7  Status of Slot 3/Aux Slot ROM\n"
        +"           RSTYINT        C    R   Reset Mouse Y0 Interrupt\n"
        +"C018 49176 RD80STORE     EC G  R7  Status of $C002-$C005/PAGE2 for Aux Mem\n"
        +"C019 49177 RDVBL         E  G  R7  Vertical Blanking (E:1=drawing G:0=drawing)\n"
        +"           RSTVBL         C    R   Reset Vertical Blanking Interrupt\n"
        +"C01A 49178 RDTEXT        EC G  R7  Status of Text/Graphics\n"
        +"C01B 49179 RDMIXED       EC G  R7  Status of Full Screen/Mixed Graphics\n"
        +"C01C 49180 RDPAGE2       EC G  R7  Status of Page 1/Page 2\n"
        +"C01D 49181 RDHIRES       EC G  R7  Status of LoRes/HiRes\n"
        +"C01E 49182 RDALTCHAR     EC G  R7  Status of Primary/Alternate Character Set\n"
        +"C01F 49183 RD80VID       EC G  R7  Status of 40/80 Columns\n"
        +"C020 49184 TAPEOUT      OE     R   Toggle Cassette Tape Output\n"
        +"C021 49185 MONOCOLOR        G W 7  Color/Mono\n"
        +"C022 49186 TBCOLOR          G    V Screen Color: Low Nibble is BG, High Nibble is Text\n"
        +"C023 49187 VGCINT           G    V Video Graphics Controller Interrupts: b0-2=ext,scan,1sec enable b4-7=ext,scan,1sec,VGC\n"
        +"C024 49188 MOUSEDATA        G    V Mouse Data: High Bit is Button, Other Bits are Movement\n"
        +"C025 49189 KEYMODREG        G    V Modifier Keys: Bit 7: Command, Bit 6: Option, Bit 5: NotUsed, Bit 4: Keypad, Bit 3: Repeat,  Bit 2: Caps, Bit 1: Control, Bit 0: Shift\n"
        +"C026 49190 DATAREG          G    V ADB Command/Data b0-2=# b3=valid b4=clr buf b5=reboot b6=abort b7=status\n"
        +"C027 49191 KMSTATUS         G    V ADB Status: b0=cmdFull b1=mouseX b2=keyIntr b3=key b4=cmdIntr b5=data 6=mouseInt 7=mouse\n"
        +"C028 49192 ROMBANK      ?????      ROM bank select toggle\n"
        +"C029 49193 NEWVIDEO         G    V New Video: 129=SHR, 1=None, Bit 6=Linearize, Bit 5=BW\n"
        +"C02B 49195 LANGSEL          G      Bit 3=Secondary Bit 4=50Hz Bits 5-7=Display Language\n"
        +"C02C 49196 CHARROM      ?????      Addr for test mode read of character ROM\n"
        +"C02D 49197 SLTROMSEL        G      Slot Register; Bits 1-7=use slot card\n"
        +"C02E 49198 VERTCNT      ?????      Addr for read of video cntr bits V5-VB\n"
        +"C02F 49199 HORIZCNT     ?????      Addr for read of video cntr bits VA-H0\n"
        +"C030 48200 SPKR         OECTG  R   Toggle Speaker\n"
        +"C031 49201 DISKREG          G      Disk Interface: Bit 6=3.5 Bit 7=RWHead 1\n"
        +"C032 49202 SCANINT          G    V VGC Interrupt-Clear\n"
        +"C033 49203 CLOCKDATA        G      Interface to Battery RAM (undocumented)\n"
        +"C034 49204 CLOCKCTL         G      b0-3=borderColor b5=stopBit b6=read b7=start\n"
        +"C035 49205 SHADOW           G      Inhibit Shadowing: Bit 6: I/O Memory, Bit 5: Alternate, Display Mode, Bit 4: Auxilary HGR, Bit 3: Super HiRes, Bit 2: HiRes, Page 2, Bit 1: HiRes Page 1, Bit 0: Text/LoRes\n"
        +"C036 49206 CYAREG           G      Bits 0-3=Disk Detect Bit 4=Shadow All Banks Bit 7=Fast\n"
        +"C037 49207 BMAREG           G      Bit 5=BW\n"
        +"C038 49208 SCCBREG          G      SCC Command Channel B\n"
        +"C039 49209 SCCAREG          G      SCC Command Channel A\n"
        +"C03A 49210 SCCBDATA         G      SCC Data Channel B\n"
        +"C03B 49211 SCCADATA         G      SCC Data Channel A\n"
        +"C03C 49212 SOUNDCTL         G    V Sound Settings: Bits 0-3=Volume Bit 5=AutoIncr Bit 6=RAM Bit 7=Busy\n"
        +"C03D 49213 SOUNDDATA        G      Sound Data\n"
        +"C03E 49214 SOUNDADRL        G      Address Pointer L\n"
        +"C03F 49215 SOUNDADRH        G      Address Pointer H\n"
        +"C040 49216 STROBE       OE     R   Game I/O Strobe Output\n"
        +"           RDXYMSK        C    R7  Read X0/Y0 Interrupt\n"
        +"           BEEPER          T   R   Sound hardware beeper"
        +"C041 49217 RDVBLMSK       C    R7  Read VBL Interrupt\n"
        +"C042 49218 RDX0EDGE       C    R7  Read X0 Edge Selector\n"
        +"C043 49219 RDY0EDGE       C    R7  Read Y0 Edge Selector\n"
        +"C044 49220 MMDELTAX         G    V Mega II Mouse Delta Movement X\n"
        +"C045 49221 MMDELTAY         G    V Mega II Mouse Delta Movement Y\n"
        +"C046 49222 DIAGTYPE     ?????      Self or Burn-In diagdistics: Bit 7=burn-in diag\n"
        +"           INTFLAG      ?????      b0=IRQ b1=MMmov b2=MMbut b3=VBL b4=qsec b5=AN3 b6=mouse was down b7=mouse is down\n"
        +"C047 49223 CLRVBLINT    ?????      Clear VBL Interrupt\n"
        +"C048 49224 CLRXYINT     ?????      Clear MM Interrupt\n"
        +"C048 49224 RSTXY          C   WR   Reset X and Y Interrupts\n"
        +"C04E 49230 CHRDIS          T  WR   Character Ram Disable"
        +"C04F 49231 EMUBYTE            WR   Emulation ID byte: write once, then read once for program being used, read again for version number. $FE=Bernie, $16=Sweet16, $4B=KEGS, $AB=Appleblossom\n"
        +"           CHREN           T  WR   Character Ram Enable"
        +"C050 49232 TXTCLR       OECTG WR   Display Graphics\n"
        +"C051 49233 TXTSET       OECTG WR   Display Text\n"
        +"C052 49234 MIXCLR       OECTG WR   Display Full Screen\n"
        +"C053 49235 MIXSET       OECTG WR   Display Split Screen\n"
        +"C054 49236 TXTPAGE1     OECTG WR   Display Page 1\n"
        +"C055 49237 TXTPAGE2     OECTG WR   If 80STORE Off: Display Page 2\n"
      //+"                         EC G WR   If 80STORE On: Read/Write Aux Display Mem\n"
        +"C056 49238 LORES        OECTG WR   Display LoRes Graphics\n"
        +"C057 49239 HIRES        OECTG WR   Display HiRes Graphics\n"
        +"C058 49240 CLRAN0       OE TG WR   If IOUDIS off: Annunciator 0 Off\n"
        +"           DISXY          C   WR   If IOUDIS on: Mask X0/Y0 Move Interrupts\n"
        +"C059 49241 SETAN0       OE TG WR   If IOUDIS off: Annunciator 0 On\n"
        +"           ENBXY          C   WR   If IOUDIS on: Allow X0/Y0 Move Interrupts\n"
        +"C05A 49242 CLRAN1       OE TG WR   If IOUDIS off: Annunciator 1 Off\n"
        +"           DISVBL         C   WR   If IOUDIS on: Disable VBL Interrupts\n"
        +"C05B 49243 SETAN1       OE TG WR   If IOUDIS off: Annunciator 1 On\n"
        +"           ENVBL          C   WR   If IOUDIS on: Enable VBL Interrupts\n"
        +"C05C 49244 CLRAN2       OE TG WR   If IOUDIS off: Annunciator 2 Off\n"
        +"           X0EDGE         C   WR   If IOUDIS on: Interrupt on X0 Rising\n"
        +"C05D 49245 SETAN2       OE TG WR   If IOUDIS off: Annunciator 2 On\n"
        +"           X0EDGE         C   WR   If IOUDIS on: Interrupt on X0 Falling\n"
        +"C05E 49246 CLRAN3       OE TG WR   If IOUDIS off: Annunciator 3 Off\n"
        +"           Y0EDGE         C   WR   If IOUDIS on: Interrupt on Y0 Rising\n"
        +"           DHIRESON      ECTG WR   In 80-Column Mode: Double Width Graphics\n"
        +"C05F 49247 SETAN3       OE  G WR   If IOUDIS off: Annunciator 3 On\n"
        +"           Y0EDGE         C   WR   If IOUDIS on: Interrupt on Y0 Falling\n"
        +"           DHIRESOFF     EC G WR   In 80-Column Mode: Single Width Graphics\n"
        +"C060 49248 TAPEIN       OE     R7  Read Cassette Input\n"
        +"           COL80SW        CT   R7  Status of 80/40 Column Switch\n"
        +"           BUTN3            G  R7  Switch Input 3\n"
        +"C061 49249 RDBTN0        EC G  R7  Switch Input 0 / Open Apple\n"
        +"C062 49250 BUTN1         E  G  R7  Switch Input 1 / Solid Apple\n"
        +"C063 49251 RD63          E  G  R7  Switch Input 2 / Shift Key\n"
        +"           RDMOUBTN       C    R7  Bit 7 = Mouse Button Not Pressed\n"
        +"C064 49252 PADDL0       OEC G  R7  Analog Input 0\n"
        +"C065 49253 PADDL1       OEC G  R7  Analog Input 1\n"
        +"C066 49254 PADDL2       OE  G  R7  Analog Input 2\n"
        +"           RDMOUX1        C    R7  Mouse Horiz Position\n"
        +"C067 49255 PADDL3       OE  G  R7  Analog Input 3\n"
        +"           RDMOUY1        C    R7  Mouse Vert Position\n"
        +"C068 49256 STATEREG         G    V b0=INTCXROM b1=ROMBANK b2=LCBNK2 b3=RDROM b4=RAMWRT b5=RAMRD b6=PAGE2 b7=ALTZP\n"
        +"C06D 49261 TESTREG      ?????      Test Mode Bit Register\n"
        +"C06E 49262 CLRTM        ?????      Clear Test Mode\n"
        +"C06F 49263 ENTM         ?????      Enable Test Mode\n"
        +"C070 49264 PTRIG         E     R   Analog Input Reset\n"
        +"                          C   WR   Analog Input Reset + Reset VBLINT Flag\n"
        +"                           T  WR   Access Real Time Clock\n"
        +"C073 49267 BANKSEL       EC G W    Memory Bank Select for > 128K\n"
        +"C077 49271 BLOSSOM            W    Appleblossom Special I/O Address $C1=Install clock driver, $CC=Get time in input buffer, $CF=get time in ProDOS global page.\n"
        +"C078 49272                C   W    Disable IOU Access\n"
        +"C079 49273                C   W    Enable IOU Access\n"
        +"C07E 49278 IOUDISON      EC   W    Disable IOU\n"
        +"           RDIOUDIS      EC    R7  Status of IOU Disabling\n"
        +"C07F 49279 IOUDISOFF     EC   W    Enable IOU\n"
        +"           RDDHIRES      EC    R7  Status of Double HiRes\n"
        +"C080 49280              OEC G  R   Read RAM bank 2; no write\n"
        +"C081 49281 ROMIN        OEC G  RR  Read ROM; write RAM bank 2\n"
        +"C082 49282              OEC G  R   Read ROM; no write\n"
        +"C083 49283 LCBANK2      OEC G  RR  Read/write RAM bank 2\n"
        +"C084 49284              OEC G  R   Read RAM bank 2; no write\n"
        +"C085 49285 ROMIN        OEC G  RR  Read ROM; write RAM bank 2\n"
        +"C086 49286              OEC G  R   Read ROM; no write\n"
        +"C087 49287 LCBANK2      OEC G  RR  Read/write RAM bank 2\n"
        +"C088 49288              OEC G  R   Read RAM bank 1; no write\n"
        +"C089 49289              OEC G  RR  Read ROM; write RAM bank 1\n"
        +"C08A 49290              OEC G  R   Read ROM; no write\n"
        +"C08B 49291              OEC G  RR  Read/write RAM bank 1\n"
        +"C08C 49292              OEC G  R   Read RAM bank 1; no write\n"
        +"C08D 49293              OEC G  RR  Read ROM; write RAM bank 1\n"
        +"C08E 49294              OEC G  R   Read ROM; no write\n"
        +"C08F 49295              OEC G  RR  Read/write RAM bank\n"

// APPLE III
// https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/apple3/service_reference_manual/Apple%20III%20Service%20Reference%20Manual-OCR-1982.pdf
// page 33

        const SYSMAP = {
            "A1":"I"
           ,"A2":"O"
           ,"A2P":"O"
           ,"A2EP":"O"
           ,"A2JP":"O"
           ,"A2B":"O"
           ,"A3":"T"
           ,"A3R":"T"
           ,"A2eA":"E"
           ,"A2eB":"E"
           ,"A2c":"C"
           ,"A3P":"T"
           ,"A2eE":"E"
           ,"A2GS":"G"
           ,"A2cM":"C"
           ,"A2G3":"G"
           ,"A2eP":"E"
           ,"A2eC":"E"
           }

        const CALL_MAP = 
        {
            "KBD":          {"ST":null                          ,"RT":function(){ return keys.polling(key) } }
            ,"KBDSTRB":     {"ST":function(){ key &= 0x7f }     ,"RT":0x00}
        }

        var sys_letter = SYSMAP[model];

        var arr = IOMAP.split("\n");
        var output = {};
        for(var i=0;i<arr.length;i++)
        {
            var l = arr[i];

            var addr   = l.substring(0,4)=="    "?addr:l.substring(0,4);
            var addr_n = parseInt(addr,16)-0xC000;
            var name   = l.substring(11,12)==" "?name:oCOM.rtrim( l.substring(11,11+12) );
            var family = l.substring(24,29); 
            var family_C = {"O":family.charAt(0)=="O","E":family.charAt(1)=="E","C":family.charAt(2)=="C","T":family.charAt(3)=="T","G":family.charAt(4)=="G"};
            var act    = l.substring(30,34);
            var desc   = l.substring(35,255);

            var cm  = CALL_MAP[name]===undefined ? null : CALL_MAP[name];

            if(family_C[sys_letter] && cm!=null && (cm.ST!=null || cm!=null))
            {
                output[addr_n] = cm;
                console.log(addr,name,act,desc,cm);
            }
        }
        return output;
    }

    this.read = function(addr)
    {
        var line = line_decode(addr);
        var sub = addr & 0xF;

        if(typeof(ACTION_MAP[addr])!="undefined")
        {
            if(ACTION_MAP[addr].ST!=null)
                ACTION_MAP[addr].ST();
            if(ACTION_MAP[addr].RT!=null)
                return ACTION_MAP[addr].RT()
        }

        switch(line)
        {
            // Built-in I/O locations  (keyboard,speaker,casette,game..)

            case 0x00:  return keys.polling(key);
            case 0x10:  key &= 0x7f;                    return 0x00;
            case 0x20:  // CASSETTE TOGGLE
            case 0x30:  snd.toggle();                   return 0x00;
            case 0x40:  // UTIL_STROBE
            case 0x50:
                switch(sub)
                {
                    case 0x0:  video.setGfx(true);      return 0x00;
                    case 0x1:  video.setGfx(false);     return 0x00;
                    case 0x2:  video.setMix(false);     return 0x00;
                    case 0x3:  video.setMix(true);      return 0x00;
                    case 0x4:  video.setPage2(false);   return 0x00;
                    case 0x5:  video.setPage2(true);    return 0x00;
                    case 0x6:  video.setHires(false);   return 0x00;
                    case 0x7:  video.setHires(true);    return 0x00;
                }
            case 0x60:
            case 0x70:

            case 0x80:  // I/O SLOT #0
            case 0x90:  // I/O SLOT #1
            case 0xA0:  // I/O SLOT #2
            case 0xB0:  // I/O SLOT #3
            case 0xC0:  // I/O SLOT #4
            case 0xD0:  // I/O SLOT #5
            case 0xE0:  // I/O SLOT #6
            case 0xF0:  // I/O SLOT #7

            case 0x100:  // RAM/ROM OPEN FOR SLOT#1
            case 0x200:  // RAM/ROM OPEN FOR SLOT#2
            case 0x300:  // RAM/ROM OPEN FOR SLOT#3
            case 0x400:  // RAM/ROM OPEN FOR SLOT#4
            case 0x500:  // RAM/ROM OPEN FOR SLOT#5
            case 0x600:  // RAM/ROM OPEN FOR SLOT#6
            case 0x700:  // RAM/ROM OPEN FOR SLOT#7

            case 0x800:  // COMMON ROM FOR ALL SLOTS
            case 0x900:
            case 0xA00:
            case 0xB00:
            case 0xC00:
            case 0xD00:
            case 0xE00:
            case 0xF00:
        }
        
        switch(line)
        {
            //case 0xA545:  // DISKII
            case 0xE0: return this.disk2.read(addr - DISK_IO);
            case 0x0600:
                if(this.disk2.diskBytes[this.disk2.drv])
                    return this.disk2.ROM[addr - DISK_PROM];
            break;

            default:

                //if (addr >= KEY_DATA && addr < KEY_DATA + 0x10)
                //{// 0000
                    //console.log("polling "+oCOM.getHexWord(addr));
                //    return keys.polling(key);
                //}
                //else if (addr >= KEY_STROBE && addr < KEY_STROBE + 0x10)
                //{// 0010
                    //console.log("strobe "+oCOM.getHexWord(addr));
                    //key &= 0x7f;
                //}
                /*
                else if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
                {
                    console.log(oCOM.getHexWord(line))
                    var o = this.disk2.read(addr - DISK_IO);
                    return o;
                }
                else if (this.disk2.diskBytes[this.disk2.drv] && addr >= DISK_PROM &&
                        addr < DISK_PROM + DISK_PROM_SIZE)
                {
                    //59 & 5A
                    console.log(oCOM.getHexWord(line))
                    return this.disk2.ROM[addr - DISK_PROM];
                }
                */
                if(this.ramcard.active  && // RAMCARD SOFT SWITCHES
                    addr >= MEM_RAMCARD_IO && addr < MEM_RAMCARD_IO + MEM_RAMCARD_IO_SIZE)
                {// 0080
                    return this.ramcard.soft_switch(addr - MEM_RAMCARD_IO);
                }
                else if(this.ramcard.active &&
                    addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
                {// FD00
                    return this.ramcard.read(addr - ROM_ADDR);
                }
                else if(this.col80card.active &&
                    addr >= MEM_COL80CARD_IO && addr < MEM_COL80CARD_IO + ROM_SIZE)
                    {
                        // TODO: read ROM from 80-column card !!
                        //alert("80_COL $"+oCOM.getHexWord(addr));
                    }
                
                else
                    switch(addr)
                    {
                    /*
                    case SPKR_TOGGLE:
                        snd.toggle();
                        break;
                    case GFX_OFF:
                        video.setGfx(false);
                        console.log("video.setGfx(false) "+oCOM.getHexByte(line)+" "+oCOM.getHexByte(sub));
                        break;
                    case GFX_ON:
                        video.setGfx(true);
                        console.log("video.setGfx(true) "+oCOM.getHexByte(line)+" "+oCOM.getHexByte(sub));
                        break;
                    case GFX_MIX_OFF:
                        video.setMix(false);
                        break;
                    case GFX_MIX_ON:
                        video.setMix(true);
                        break;
                    case GFX_PAGE1:
                        video.setPage2(false);
                        break;
                    case GFX_PAGE2:
                        video.setPage2(true);
                        break;
                    case GFX_LORES:
                        video.setHires(false);
                        break;
                    case GFX_HIRES:
                        video.setHires(true);
                        break;
                        */
                    }
            break;
        }

     

        return 0x00;
    }

    this.write = function(addr, d8)
    {
        if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
            this.disk2.write(addr - DISK_IO, d8);
        else if(this.ramcard.active &&
            addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            return this.ramcard.write(addr - ROM_ADDR,d8)
        
        // Implement same side-effects as read.
        this.read(addr);
    }

    this.cycle = function() {}

    this.keypress = function(code)
    {
        key = code;
        //alert(key)
    }

    this.loadDisk = function(bytes,drv)
    {
        //this.disk2.loadDisk(bytes,drv);
        alert("AppleDisk2() does not have a method called loadDisk")
    }
     
    // SLOT MAPPING
    this.mount = function(arg)
    {   
        //SLOT_NAME[arg.slot] = arg.name.substring(0,4);
        const idx = arg.slot<<3; 
        SLOT_IDX[arg.slot] = idx;

        const noROM  = arg.driver===undefined ? true : arg.driver.ROM===undefined;   // detect presence of ROM in device object
        const noLROM = arg.driver===undefined ? true : arg.driver.LROM===undefined; // detect presence of large ROM (C800-CFFF) in device object

        //var keys = Object.keys(_CFG_PCODE);
        //var key_idx =  keys.indexOf(arg.name);

        SLOT_MAP[idx]   = arg.name.substring(0,6);                                              // STATUS 0x2=active  0x1=inactive 0x0=unmounted   
        SLOT_MAP[idx+1] = arg.active ? oCOM.crc16(new TextEncoder("utf-8").encode(arg.name)) : null ; // DETERMINE DEVICE ID (CRC16 hash) 
        SLOT_MAP[idx+2] = SLOT_IO[arg.slot];                                     // SLOT I/O  range origin
        SLOT_MAP[idx+3] = SLOT_IO[arg.slot] + SLT_IO_SIZE;                       //           range end
        SLOT_MAP[idx+4] = noROM?0:SLOT_PROM[arg.slot];                           // SLOT ROM  range origin
        SLOT_MAP[idx+5] = noROM?0:SLOT_PROM[arg.slot] + SLT_PROM_SIZE;           //           range end
        SLOT_MAP[idx+6] = 0;                                                     // SLOT LROM range origin (TODO)
        SLOT_MAP[idx+7] = 0                                                      //           range end    (TODO)

        var obj_names = new Array();
        for(var o in arg.driver) obj_names.push(o);
        console.log("mounted "+SLOT_MAP[idx]+" [active:"+(SLOT_MAP[idx+1]!=null?true:false)+" deviceID:"+oCOM.getHexWord(SLOT_MAP[idx+1])+"] into SLOT #"+arg.slot+" ("
        +"I/O range: "+oCOM.getHexWord(0xC000 + SLOT_MAP[idx+2])+"-"+oCOM.getHexWord(0xC000 + SLOT_MAP[idx+3])+" "
        +"ROM range: "+(SLOT_MAP[idx+4]==SLOT_MAP[idx+5]?null:oCOM.getHexWord(0xC000 + SLOT_MAP[idx+4])+"-"+oCOM.getHexWord(0xC000 + SLOT_MAP[idx+5]))+" "
        +"LROM range: "+(SLOT_MAP[idx+6]==SLOT_MAP[idx+7]?null:oCOM.getHexWord(0xC000 + SLOT_MAP[idx+6])+"-"+oCOM.getHexWord(0xC000 + SLOT_MAP[idx+7]))+" "
        +"METHODS: "+obj_names.join(",")   
        +")");

        oEMUI.slotConfig({"id":"slot"+arg.slot,"active":arg.active});

        //console.log("SLOT_MAP["+arg.slot+"] = "+SLOT_MAP[idx]+" "+SLOT_MAP[idx+1]+" "+SLOT_MAP[idx+2]+" "+SLOT_MAP[idx+3]+" "+SLOT_MAP[idx+4])
    }    

    this.unmount = function(name,slot_num)
    {
        SLOT_NAME[slot_num] = null;
        const idx = slot_num<<3;
        SLOT_MAP[idx]   = 0;
        SLOT_MAP[idx+1] = 0;
        SLOT_MAP[idx+2] = 0;
        SLOT_MAP[idx+3] = 0;
        SLOT_MAP[idx+4] = 0;
        SLOT_MAP[idx+5] = 0;
        SLOT_MAP[idx+6] = 0;
        SLOT_MAP[idx+7] = 0;
    }

    // SLOT MAPPING
    var SLOT_MAP  = new Uint16Array(8<<3);   // SLOT ADDRESS MAPPING
    //var SLOT_NAME = new Array(8);           // 8 SLOTS, 6 CHARACTERS PER SLOT NAME
    var SLOT_IDX  = new Array(8); 

    // SLOT MAPPING - TODO: take it from _CFG_SLOT
    this.mount({"name":"MS16K" ,"slot":0,"driver":this.ramcard,"active":true});
    this.mount({"name":"VIDEX" ,"slot":3,"driver":this.col80card,"active":true});
    this.mount({"name":"DISKII","slot":6,"driver":this.disk2,"active":true});
}
