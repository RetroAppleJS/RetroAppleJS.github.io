//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_hostio.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"board":new AppleBoard()}}}
else oEMU.component.IO.board= new AppleBoard();


function AppleBoard()
{
    this.id    = {"PCODE":"BOARD", "icon":"fa fa-tv"};
    this.state = {"active":true,"slot":null};
    this.action = 
    { 
         "HostIO" :{ "RD":{"callback":read.bind(this)}
                    ,"WR":{"callback":write.bind(this)}}                                      // by default always 16 bytes
    }

    function read() {alert("test")}
    function write() {}



   this.IOMAP = // https://www.kreativekorp.com/miscpages/a2info/iomemory.shtml http://apple2.guidero.us/doku.php/mg_notes/general/io_page
         "C000 KBD          OEC G  R   Last Key Pressed + 128\n"
        +"     80STOREOFF    EC G W    Use $C002-$C005 for Aux Memory\n"
        +"     KBDBUSA           T     V Keyboard 'A' busdata\n"
        +"C001 80STOREON     EC G W    Use PAGE2 for Aux Memory\n"
        +"C002 RDMAINRAM     EC G W    If 80STORE Off: Read Main Mem $0200-$BFFF\n"
        +"C003 RDCARDRAM     EC G W    If 80STORE Off: Read Aux Mem $0200-$BFFF\n"
        +"C004 WRMAINRAM     EC G W    If 80STORE Off: Write Main Mem $0200-$BFFF\n"
        +"C005 WRCARDRAM     EC G W    If 80STORE Off: Write Aux Mem $0200-$BFFF\n"
        +"C006 SETSLOTCXROM  E  G W    Peripheral ROM ($C100-$CFFF)\n"
        +"C007 SETINTCXROM   E  G W    Internal ROM ($C100-$CFFF)\n"
        +"C008 SETSTDZP      EC G W    Main Stack and Zero Page\n"
        +"     KBDBUSB           T     V Keyboard 'B' busdata\n"
        +"C009 SETALTZP      EC G W    Aux Stack and Zero Page\n"
        +"C00A SETINTC3ROM   E  G W    ROM in Slot 3\n"
        +"C00B SETSLOTC3ROM  E  G W    ROM in Aux Slot\n"
        +"C00C CLR80VID      EC G W    40 Columns\n"
        +"C00D SET80VID      EC G W    80 Columns\n"
        +"C00E CLRALTCHAR    EC G W    Primary Character Set\n"
        +"C00F SETALTCHAR    EC G W    Alternate Character Set\n"
        +"C010 KBDSTRB      OECTG WR   Keyboard Strobe\n"
        +"C011 RDLCBNK2      EC G  R7  Status of Selected $Dx Bank\n"
        +"C012 RDLCRAM       EC G  R7  Status of $Dx ROM / $Dx RAM\n"
        +"C013 RDRAMRD       EC G  R7  Status of Main/Aux RAM Reading\n"
        +"C014 RDRAMWRT      EC G  R7  Status of Main/Aux RAM Writing\n"
        +"C015 RDCXROM       E  G  R7  Status of Periph/ROM Access\n"
        +"     RSTXINT        C    R   Reset Mouse X0 Interrupt\n"
        +"C016 RDALTZP       EC G  R7  Status of Main/Aux Stack and Zero Page\n"
        +"C017 RDC3ROM       E  G  R7  Status of Slot 3/Aux Slot ROM\n"
        +"     RSTYINT        C    R   Reset Mouse Y0 Interrupt\n"
        +"C018 RD80STORE     EC G  R7  Status of $C002-$C005/PAGE2 for Aux Mem\n"
        +"C019 RDVBL         E  G  R7  Vertical Blanking (E:1=drawing G:0=drawing)\n"
        +"     RSTVBL         C    R   Reset Vertical Blanking Interrupt\n"
        +"C01A RDTEXT        EC G  R7  Status of Text/Graphics\n"
        +"C01B RDMIXED       EC G  R7  Status of Full Screen/Mixed Graphics\n"
        +"C01C RDPAGE2       EC G  R7  Status of Page 1/Page 2\n"
        +"C01D RDHIRES       EC G  R7  Status of LoRes/HiRes\n"
        +"C01E RDALTCHAR     EC G  R7  Status of Primary/Alternate Character Set\n"
        +"C01F RD80VID       EC G  R7  Status of 40/80 Columns\n"
        +"C020 TAPEOUT      OE     R   Toggle Cassette Tape Output\n"
        +"C021 MONOCOLOR        G W 7  Color/Mono\n"
        +"C022 TBCOLOR          G    V Screen Color: Low Nibble is BG, High Nibble is Text\n"
        +"C023 VGCINT           G    V Video Graphics Controller Interrupts: b0-2=ext,scan,1sec enable b4-7=ext,scan,1sec,VGC\n"
        +"C024 MOUSEDATA        G    V Mouse Data: High Bit is Button, Other Bits are Movement\n"
        +"C025 KEYMODREG        G    V Modifier Keys: Bit 7: Command, Bit 6: Option, Bit 5: NotUsed, Bit 4: Keypad, Bit 3: Repeat,  Bit 2: Caps, Bit 1: Control, Bit 0: Shift\n"
        +"C026 DATAREG          G    V ADB Command/Data b0-2=# b3=valid b4=clr buf b5=reboot b6=abort b7=status\n"
        +"C027 KMSTATUS         G    V ADB Status: b0=cmdFull b1=mouseX b2=keyIntr b3=key b4=cmdIntr b5=data 6=mouseInt 7=mouse\n"
        +"C028 ROMBANK      ?????      ROM bank select toggle\n"
        +"C029 NEWVIDEO         G    V New Video: 129=SHR, 1=None, Bit 6=Linearize, Bit 5=BW\n"
        +"C02B LANGSEL          G      Bit 3=Secondary Bit 4=50Hz Bits 5-7=Display Language\n"
        +"C02C CHARROM      ?????      Addr for test mode read of character ROM\n"
        +"C02D SLTROMSEL        G      Slot Register; Bits 1-7=use slot card\n"
        +"C02E VERTCNT      ?????      Addr for read of video cntr bits V5-VB\n"
        +"C02F HORIZCNT     ?????      Addr for read of video cntr bits VA-H0\n"
        +"C030 SPKR         OECTG  R   Toggle Speaker\n"
        +"C031 DISKREG          G      Disk Interface: Bit 6=3.5 Bit 7=RWHead 1\n"
        +"C032 SCANINT          G    V VGC Interrupt-Clear\n"
        +"C033 CLOCKDATA        G      Interface to Battery RAM (undocumented)\n"
        +"C034 CLOCKCTL         G      b0-3=borderColor b5=stopBit b6=read b7=start\n"
        +"C035 SHADOW           G      Inhibit Shadowing: Bit 6: I/O Memory, Bit 5: Alternate, Display Mode, Bit 4: Auxilary HGR, Bit 3: Super HiRes, Bit 2: HiRes, Page 2, Bit 1: HiRes Page 1, Bit 0: Text/LoRes\n"
        +"C036 CYAREG           G      Bits 0-3=Disk Detect Bit 4=Shadow All Banks Bit 7=Fast\n"
        +"C037 BMAREG           G      Bit 5=BW\n"
        +"C038 SCCBREG          G      SCC Command Channel B\n"
        +"C039 SCCAREG          G      SCC Command Channel A\n"
        +"C03A SCCBDATA         G      SCC Data Channel B\n"
        +"C03B SCCADATA         G      SCC Data Channel A\n"
        +"C03C SOUNDCTL         G    V Sound Settings: Bits 0-3=Volume Bit 5=AutoIncr Bit 6=RAM Bit 7=Busy\n"
        +"C03D SOUNDDATA        G      Sound Data\n"
        +"C03E SOUNDADRL        G      Address Pointer L\n"
        +"C03F SOUNDADRH        G      Address Pointer H\n"
        +"C040 STROBE       OE     R   Game I/O Strobe Output\n"
        +"     RDXYMSK        C    R7  Read X0/Y0 Interrupt\n"
        +"     BEEPER          T   R   Sound hardware beeper"
        +"C041 RDVBLMSK       C    R7  Read VBL Interrupt\n"
        +"C042 RDX0EDGE       C    R7  Read X0 Edge Selector\n"
        +"C043 RDY0EDGE       C    R7  Read Y0 Edge Selector\n"
        +"C044 MMDELTAX         G    V Mega II Mouse Delta Movement X\n"
        +"C045 MMDELTAY         G    V Mega II Mouse Delta Movement Y\n"
        +"C046 DIAGTYPE     ?????      Self or Burn-In diagdistics: Bit 7=burn-in diag\n"
        +"     INTFLAG      ?????      b0=IRQ b1=MMmov b2=MMbut b3=VBL b4=qsec b5=AN3 b6=mouse was down b7=mouse is down\n"
        +"C047 CLRVBLINT    ?????      Clear VBL Interrupt\n"
        +"C048 CLRXYINT     ?????      Clear MM Interrupt\n"
        +"C048 RSTXY          C   WR   Reset X and Y Interrupts\n"
        +"C04E CHRDIS          T  WR   Character Ram Disable\n"
        +"C04F EMUBYTE            WR   Emulation ID byte: write once, then read once for program being used, read again for version number. $FE=Bernie, $16=Sweet16, $4B=KEGS, $AB=Appleblossom\n"
        +"     CHREN           T  WR   Character Ram Enable\n"
        +"C050 TXTCLR       OECTG WR   Display Graphics\n"
        +"C051 TXTSET       OECTG WR   Display Text\n"
        +"C052 MIXCLR       OECTG WR   Display Full Screen\n"
        +"C053 MIXSET       OECTG WR   Display Split Screen\n"
        +"C054 TXTPAGE1     OECTG WR   Display Page 1\n"
        +"C055 TXTPAGE2     OECTG WR   If 80STORE Off: Display Page 2\n"
      //+"                   EC G WR   If 80STORE On: Read/Write Aux Display Mem\n"
        +"C056 LORES        OECTG WR   Display LoRes Graphics\n"
        +"C057 HIRES        OECTG WR   Display HiRes Graphics\n"
        +"C058 CLRAN0       OE TG WR   If IOUDIS off: Annunciator 0 Off\n"
        +"     DISXY          C   WR   If IOUDIS on: Mask X0/Y0 Move Interrupts\n"
        +"C059 SETAN0       OE TG WR   If IOUDIS off: Annunciator 0 On\n"
        +"     ENBXY          C   WR   If IOUDIS on: Allow X0/Y0 Move Interrupts\n"
        +"C05A CLRAN1       OE TG WR   If IOUDIS off: Annunciator 1 Off\n"
        +"     DISVBL         C   WR   If IOUDIS on: Disable VBL Interrupts\n"
        +"C05B SETAN1       OE TG WR   If IOUDIS off: Annunciator 1 On\n"
        +"     ENVBL          C   WR   If IOUDIS on: Enable VBL Interrupts\n"
        +"C05C CLRAN2       OE TG WR   If IOUDIS off: Annunciator 2 Off\n"
        +"     X0EDGE         C   WR   If IOUDIS on: Interrupt on X0 Rising\n"
        +"C05D SETAN2       OE TG WR   If IOUDIS off: Annunciator 2 On\n"
        +"     X0EDGE         C   WR   If IOUDIS on: Interrupt on X0 Falling\n"
        +"C05E CLRAN3       OE TG WR   If IOUDIS off: Annunciator 3 Off\n"
        +"     Y0EDGE         C   WR   If IOUDIS on: Interrupt on Y0 Rising\n"
        +"     DHIRESON      ECTG WR   In 80-Column Mode: Double Width Graphics\n"
        +"C05F SETAN3       OE  G WR   If IOUDIS off: Annunciator 3 On\n"
        +"     Y0EDGE         C   WR   If IOUDIS on: Interrupt on Y0 Falling\n"
        +"     DHIRESOFF     EC G WR   In 80-Column Mode: Single Width Graphics\n"
        +"C060 TAPEIN       OE     R7  Read Cassette Input\n"
        +"     COL80SW        CT   R7  Status of 80/40 Column Switch\n"
        +"     BUTN3            G  R7  Switch Input 3\n"
        +"C061 RDBTN0        EC G  R7  Switch Input 0 / Open Apple\n"
        +"C062 BUTN1         E  G  R7  Switch Input 1 / Solid Apple\n"
        +"C063 RD63          E  G  R7  Switch Input 2 / Shift Key\n"
        +"     RDMOUBTN       C    R7  Bit 7 = Mouse Button Not Pressed\n"
        +"C064 PADDL0       OEC G  R7  Analog Input 0\n"
        +"C065 PADDL1       OEC G  R7  Analog Input 1\n"
        +"C066 PADDL2       OE  G  R7  Analog Input 2\n"
        +"     RDMOUX1        C    R7  Mouse Horiz Position\n"
        +"C067 PADDL3       OE  G  R7  Analog Input 3\n"
        +"     RDMOUY1        C    R7  Mouse Vert Position\n"
        +"C068 STATEREG         G    V b0=INTCXROM b1=ROMBANK b2=LCBNK2 b3=RDROM b4=RAMWRT b5=RAMRD b6=PAGE2 b7=ALTZP\n"
        +"C06D TESTREG      ?????      Test Mode Bit Register\n"
        +"C06E CLRTM        ?????      Clear Test Mode\n"
        +"C06F ENTM         ?????      Enable Test Mode\n"
        +"C070 PTRIG         E     R   Analog Input Reset\n"
        +"                    C   WR   Analog Input Reset + Reset VBLINT Flag\n"
        +"                     T  WR   Access Real Time Clock\n"
        +"C073 BANKSEL       EC G W    Memory Bank Select for > 128K\n"
        +"C077 BLOSSOM            W    Appleblossom Special I/O Address $C1=Install clock driver, $CC=Get time in input buffer, $CF=get time in ProDOS global page.\n"
        +"C078                C   W    Disable IOU Access\n"
        +"C079                C   W    Enable IOU Access\n"
        +"C07E IOUDISON      EC   W    Disable IOU\n"
        +"     RDIOUDIS      EC    R7  Status of IOU Disabling\n"
        +"C07F IOUDISOFF     EC   W    Enable IOU\n"
        +"     RDDHIRES      EC    R7  Status of Double HiRes\n"
/*
        +"C080              OEC G  R   Read RAM bank 2; no write\n"
        +"C081 ROMIN        OEC G  RR  Read ROM; write RAM bank 2\n"
        +"C082              OEC G  R   Read ROM; no write\n"
        +"C083 LCBANK2      OEC G  RR  Read/write RAM bank 2\n"
        +"C084              OEC G  R   Read RAM bank 2; no write\n"
        +"C085 ROMIN        OEC G  RR  Read ROM; write RAM bank 2\n"
        +"C086              OEC G  R   Read ROM; no write\n"
        +"C087 LCBANK2      OEC G  RR  Read/write RAM bank 2\n"
        +"C088              OEC G  R   Read RAM bank 1; no write\n"
        +"C089              OEC G  RR  Read ROM; write RAM bank 1\n"
        +"C08A              OEC G  R   Read ROM; no write\n"
        +"C08B              OEC G  RR  Read/write RAM bank 1\n"
        +"C08C              OEC G  R   Read RAM bank 1; no write\n"
        +"C08D              OEC G  RR  Read ROM; write RAM bank 1\n"
        +"C08E              OEC G  R   Read ROM; no write\n"
        +"C08F              OEC G  RR  Read/write RAM bank\n"

*/ 


    this.IO_map = function(model,IOMAP_CALLS)
    {

    // Comp:  O = Apple II+  E = Apple IIe  C = Apple IIc  T = Apple III G = Apple IIgs
    // Act:   R = Read       W = Write      7 = Bit        V = Byte

        const IOMAP = oEMU.component.IO.board.IOMAP;


        var IOMAP_ID = null;
        update_IORANGES(model);

        // READ SYSTEM-SPECIFIC I/O RANGES and update oEMU
        function update_IORANGES(sys_model)
        {
            if(oEMU.system===undefined) return;
            for(var o in _CFG_IORANGES)
            {
                if(o.indexOf(model) >= 0)
                {
                    oEMU.system["IORANGES"] = _CFG_IORANGES[o];

                    oEMU.system["IORANGES-SLOT"] = {};
                    for(var r in _CFG_IORANGES[o])
                    {
                        oEMU.system["IORANGES-SLOT"][r] = oCOM.parseRngExpr(_CFG_IORANGES[o][r],{n:3});
   
                    }

                    
          //var a = [this.LData[FIELDdata].IOrange.split(","),this.LData[FIELDdata].ROMrange.split(","),this.LData[FIELDdata].LROMrange.split(",")]
          //a[0] = [oCOM.parseRngExpr(a[0][0]),oCOM.parseRngExpr(a[0][1])];
          //a[0] =  oCOM.format("0x%4x-0x%4x",a[0][0],a[0][1]);

                    break;
                }
                IOMAP_ID++;
            }
        }

        var IOMAP_TBL = [];
        var iomap_rows = [];

        var arr = IOMAP.split("\n");
        var output = {"WR":{},"RD":{},"RR":{},"SV":{},"VA":{}};
        for(var i=0;i<arr.length;i++)
        {
            var l = arr[i];

            var addr   = l.substring(0,4)=="    "?addr:l.substring(0,4);
            var addr_n = parseInt(addr,16)-0xC000;
            var name   = l.substring(11-6,12-6)==" "?name:oCOM.rtrim( l.substring(11-6,11+12-6) );
            var family = l.substring(24-6,29-6);
            // family_C key corresponds to _CFG_IORANGES index
            var family_C = {1:family.charAt(0)=="O",2:family.charAt(1)=="E",3:family.charAt(2)=="C",4:family.charAt(3)=="T",5:family.charAt(4)=="G"};
            var act    = l.substring(30-6,34-6);
            var desc   = l.substring(35-6,255);

            var iomap_ids = [];
            if(family.charAt(0)=="O") iomap_ids.push(2);
            if(family.charAt(1)=="E") iomap_ids.push(3);
            if(family.charAt(2)=="C") iomap_ids.push(4);
            if(family.charAt(3)=="T") iomap_ids.push(5);
            if(family.charAt(4)=="G") iomap_ids.push(6);

            var iomap_str = [];
            if(family.charAt(0)=="O") {iomap_str.push("A2");iomap_str.push("A2P");iomap_str.push("A2PE");iomap_str.push("A2JP");iomap_str.push("A2B");}
            if(family.charAt(1)=="E") {iomap_str.push("A2E");iomap_str.push("A2Ee");iomap_str.push("A2eP");}
            if(family.charAt(2)=="C") {iomap_str.push("A2c");iomap_str.push("A2cM");}
            if(family.charAt(3)=="T") {iomap_str.push("A3");iomap_str.push("A3P");iomap_str.push("A3R");}
            if(family.charAt(4)=="G") {iomap_str.push("A2G3");iomap_str.push("A2GS");}
            if(iomap_str.length>4) iomap_str[3]+="<br>"
            if(iomap_str.length>8) iomap_str[7]+="<br>"
            if(iomap_str.length>12) iomap_str[11]+="<br>"
            iomap_str = iomap_str.join(",");

            // A1,A2,A2P,A2PE,A2JP,A2B, A2E,A2Ee,A2eP, A2c,A2cM, A3,A3P,A3R, A2G3,A2GS
            var iomap_bitmap = 0;
            if(family.charAt(0)=="O") {iomap_bitmap |= 0b0000000000111110}
            if(family.charAt(1)=="E") {iomap_bitmap |= 0b0000000111000000}
            if(family.charAt(2)=="C") {iomap_bitmap |= 0b0000011000000000}
            if(family.charAt(3)=="T") {iomap_bitmap |= 0b0011100000000000}
            if(family.charAt(4)=="G") {iomap_bitmap |= 0b1100000000000000}

            var iomap_idstr = family.replace("O","A2,A2P,A2PE,A2JP,A2B,").replace("E","A2E,A2Ee,A2eP,").replace("C","A2c,A2cM,").replace("T","A3,A3P,A3R,").replace("G","A2G3,A2GS,");
        

            var act_name_str = [];
            if(act.charAt(0)=="W")      act_name_str.push("WR"); // WRITE
            if(act.slice(1,2)=="RR")    act_name_str.push("RR"); // DOUBLE READ
            else if(act.charAt(1)=="R") act_name_str.push("RD"); // READ
            if(act.charAt(2)=="7")      act_name_str.push("BI"); // BIT
            if(act.charAt(3)=="V")      act_name_str.push("RG"); // REGISTER
            act_name_str = act_name_str.join(",");

            IOMAP_TBL.push(["0x"+addr,name,iomap_str,act_name_str,desc])
            //IOMAP_TBL.push(["0x"+addr,name,"0b"+oCOM.getBinMulti(iomap_bitmap,16),act_names,desc])
            //IOMAP_TBL.push(["0x"+addr,name,"0x"+oCOM.getHexMulti(iomap_bitmap,4),act_names,desc])

            iomap_rows.push({
                addr: "0x"+addr,
                addr_n: addr_n,
                name: name,
                systems: iomap_str,
                act: act_name_str,
                desc: desc,
                model_match: family_C[IOMAP_ID]
            });

            var cm  = IOMAP_CALLS[IOMAP_ID]===undefined || IOMAP_CALLS[IOMAP_ID][name]===undefined ? null : IOMAP_CALLS[IOMAP_ID][name];
            if(family_C[IOMAP_ID] && cm!=null && (cm.ST!=null || cm!=null))
            {
                if(act.charAt(0)=="W")      output.WR[addr_n]  = cm; // WRITE
                if(act.slice(1,2)=="RR")    output.RR[addr_n]  = cm; // DOUBLE READ
                else if(act.charAt(1)=="R") output.RD[addr_n]  = cm; // READ
                if(act.charAt(2)=="7")      output.BT[addr_n]  = cm;  // BIT
                if(act.charAt(3)=="V")      output.RG[addr_n]  = cm;  // REGISTER

                console.log(addr,addr_n,name,act,desc,cm);
            }

            
        }

       //console.table(IOMAP_TBL);
        
        this.IOMAP_ROWS = iomap_rows;
        return output;
        
    }


    this.getBoardIORows = function(model)
    {
        model = model || (typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P");

        apple2plus.hwObj().io.IO_map(model);   // refresh parsed rows for this model

        return (apple2plus.hwObj().io.IOMAP_ROWS || []).filter(function(r){
            return r.model_match
                && r.addr_n < 0x80
                && (r.act.indexOf("RD") >= 0 || r.act.indexOf("RR") >= 0);
        });
    }

    this.boardIO_html = function(model)
    {
        var rows = this.getBoardIORows(model);

        var s = '<div style="max-height:420px;overflow:auto;margin-top:6px;">'
            + '<table style="width:100%;border-collapse:collapse;font-size:11px;">'
            + '<tr>'
            + '<th style="text-align:left;padding:2px 4px;">Addr</th>'
            + '<th style="text-align:left;padding:2px 4px;">Name</th>'
            + '<th style="text-align:left;padding:2px 4px;">Act</th>'
            + '<th style="text-align:left;padding:2px 4px;">Description</th>'
            + '</tr>';

        for(var i=0;i<rows.length;i++)
        {
            s += '<tr>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].addr)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].name)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].act)+'</td>'
            + '<td style="text-align:left;vertical-align:top;border-top:1px solid #888;padding:2px 4px;">'+oCOM.escapeHTML(rows[i].desc)+'</td>'
            + '</tr>';
        }

        s += '</table></div>';
        return s;
    }
}