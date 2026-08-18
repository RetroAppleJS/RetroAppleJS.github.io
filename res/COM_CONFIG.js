const _CFG_SYSCODE = {
 "A1":{"Model":"Apple I" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A1_txt" ,"Slotslogphy":"" ,"ROM":"" ,"KeyFont":"A1_US"}
,"A2":{"Model":"Apple II" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"" ,"KeyFont":"A2_US"}
,"A2P":{"Model":"Apple II Plus" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"A2P_R" ,"KeyFont":"A2_US"}
,"A2PE":{"Model":"Apple II EuroPlus" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"" ,"KeyFont":"A2_US"}
,"A2JP":{"Model":"Apple II J-Plus" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"" ,"KeyFont":"A2_JP"}
,"A2B":{"Model":"Bell & Howell" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"" ,"KeyFont":"A1_US_blk"}
,"A3":{"Model":"Apple III" ,"CPU":"6502B" ,"Speeds":"1.8" ,"Display":"A3_dhgr" ,"Slotslogphy":"[0-7] [1-4]" ,"ROM":"" ,"KeyFont":"A3_US"}
,"A3R":{"Model":"Apple III Revised" ,"CPU":"6502B" ,"Speeds":"1.8" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [1-4]" ,"ROM":"" ,"KeyFont":"A3_US"}
,"A2e":{"Model":"Apple IIe RevA/B" ,"CPU":"6502" ,"Speeds":"1.023" ,"Display":"A2_hgr" ,"Slotslogphy":"[0-7] [1-7]" ,"ROM":"" ,"KeyFont":"A2e_US, A2e_UK, A2e_CA, A2e_FR"}
,"A2c":{"Model":"Apple IIc" ,"CPU":"65C02" ,"Speeds":"1.023" ,"Display":"A2_dhgr" ,"Slotslogphy":"[0-7] []" ,"ROM":"" ,"KeyFont":""}
,"A3P":{"Model":"Apple III Plus" ,"CPU":"6502B" ,"Speeds":"1.8" ,"Display":"A3_dhgr" ,"Slotslogphy":"[0-7] [1-4]" ,"ROM":"" ,"KeyFont":""}
,"A2eE":{"Model":"Apple IIe Enhanced" ,"CPU":"65C02" ,"Speeds":"1.023" ,"Display":"A2_dhgr" ,"Slotslogphy":"[0-7] [0-7]" ,"ROM":"" ,"KeyFont":""}
,"A2GS":{"Model":"Apple IIGS" ,"CPU":"65C816" ,"Speeds":"2.8" ,"Display":"AGS" ,"Slotslogphy":"[0-7] [1-7]" ,"ROM":"" ,"KeyFont":""}
,"A2cM":{"Model":"Apple IIc MemoryExp" ,"CPU":"65C02" ,"Speeds":"1.023" ,"Display":"A2_dhgr" ,"Slotslogphy":"[0-7] []" ,"ROM":"" ,"KeyFont":""}
,"A2G3":{"Model":"Apple IIGS ROM3" ,"CPU":"65C816" ,"Speeds":"2.8" ,"Display":"AGS" ,"Slotslogphy":"[0-7] [1-7]" ,"ROM":"" ,"KeyFont":""}
,"A2eP":{"Model":"Apple IIe Platinum" ,"CPU":"65C02" ,"Speeds":"1.023" ,"Display":"A2_dhgr" ,"Slotslogphy":"[0-7] [1-7]" ,"ROM":"" ,"KeyFont":""}
}

const _CFG_ROMRANGES = {
 "A2P_R":{"ROM":"$D000-$FFFF" ,"CRC16":"$CF45"}
}

const _CFG_IORANGES = {
 "A1":{"HostIO":"$D010-$D013" ,"HostROM":"" ,"SlotIO":"" ,"SlotROM":""}
,"A2,A2P,A2PE,A2JP,A2B":{"HostIO":"$C000-$C07F" ,"HostROM":"$C800-$CFFF" ,"SlotIO":"$C0<sub>8+n</sub>0-$C0<sub>8+n</sub>F" ,"SlotROM":"$C<sub>n</sub>00-$C<sub>n</sub>FF"}
,"A2E,A2Ee,A2eP":{"HostIO":"$C000-$C07F" ,"HostROM":"$C800-$CFFF" ,"SlotIO":"$C0<sub>8+n</sub>0-$C0<sub>8+n</sub>F" ,"SlotROM":"$C<sub>n</sub>00-$C<sub>n</sub>FF"}
,"A2c,A2cM":{"HostIO":"$C000-$C07F" ,"HostROM":"$C800-$CFFF" ,"SlotIO":"$C0<sub>8+n</sub>0-$C0<sub>8+n</sub>F" ,"SlotROM":"$C<sub>n</sub>00-$C<sub>n</sub>FF"}
,"A3,A3P,A3R":{"HostIO":"$C000-$C07F" ,"HostROM":"" ,"SlotIO":"$C0<sub>8+n</sub>0-$C0<sub>8+n</sub>F" ,"SlotROM":"$C<sub>n</sub>00-$C<sub>n</sub>FF"}
,"A2G3,A2GS":{"HostIO":"$C000-$C07F" ,"HostROM":"" ,"SlotIO":"$C0<sub>8+n</sub>0-$C0<sub>8+n</sub>F" ,"SlotROM":"$C<sub>n</sub>00-$C<sub>n</sub>FF"}
}

const _CFG_IOADDR = {
 "$C000a":{"Name":"KBD" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Last Key Pressed + 128"}
,"$C000b":{"Name":"80STOREOFF" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Use $C002-$C005 for Aux Memory"}
,"$C000c":{"Name":"KBDBUSA" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"V Keyboard 'A' busdata"}
,"$C001":{"Name":"80STOREON" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Use PAGE2 for Aux Memory"}
,"$C002":{"Name":"RDMAINRAM" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"If 80STORE Off: Read Main Mem $0200-$BFFF"}
,"$C003":{"Name":"RDCARDRAM" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"If 80STORE Off: Read Aux Mem $0200-$BFFF"}
,"$C004":{"Name":"WRMAINRAM" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"If 80STORE Off: Write Main Mem $0200-$BFFF"}
,"$C005":{"Name":"WRCARDRAM" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"If 80STORE Off: Write Aux Mem $0200-$BFFF"}
,"$C006":{"Name":"SETSLOTCXROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Peripheral ROM ($C100-$CFFF)"}
,"$C007":{"Name":"SETINTCXROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Internal ROM ($C100-$CFFF)"}
,"$C008a":{"Name":"SETSTDZP" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Main Stack and Zero Page"}
,"$C008b":{"Name":"KBDBUSB" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"V Keyboard 'B' busdata"}
,"$C009":{"Name":"SETALTZP" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Aux Stack and Zero Page"}
,"$C00A":{"Name":"SETINTC3ROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"ROM in Slot 3"}
,"$C00B":{"Name":"SETSLOTC3ROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"ROM in Aux Slot"}
,"$C00C":{"Name":"CLR80VID" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"40 Columns"}
,"$C00D":{"Name":"SET80VID" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"80 Columns"}
,"$C00E":{"Name":"CLRALTCHAR" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Primary Character Set"}
,"$C00F":{"Name":"SETALTCHAR" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Alternate Character Set"}
,"$C010":{"Name":"KBDSTRB" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Keyboard Strobe"}
,"$C011":{"Name":"RDLCBNK2" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Selected $Dx Bank"}
,"$C012":{"Name":"RDLCRAM" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of $Dx ROM / $Dx RAM"}
,"$C013":{"Name":"RDRAMRD" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Main/Aux RAM Reading"}
,"$C014":{"Name":"RDRAMWRT" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Main/Aux RAM Writing"}
,"$C015a":{"Name":"RDCXROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Periph/ROM Access"}
,"$C015b":{"Name":"RSTXINT" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Reset Mouse X0 Interrupt"}
,"$C016":{"Name":"RDALTZP" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Main/Aux Stack and Zero Page"}
,"$C017a":{"Name":"RDC3ROM" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Slot 3/Aux Slot ROM"}
,"$C017b":{"Name":"RSTYINT" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Reset Mouse Y0 Interrupt"}
,"$C018":{"Name":"RD80STORE" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of $C002-$C005/PAGE2 for Aux Mem"}
,"$C019a":{"Name":"RDVBL" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Vertical Blanking (E:1=drawing G:0=drawing)"}
,"$C019b":{"Name":"RSTVBL" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Reset Vertical Blanking Interrupt"}
,"$C01A":{"Name":"RDTEXT" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Text/Graphics"}
,"$C01B":{"Name":"RDMIXED" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Full Screen/Mixed Graphics"}
,"$C01C":{"Name":"RDPAGE2" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Page 1/Page 2"}
,"$C01D":{"Name":"RDHIRES" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of LoRes/HiRes"}
,"$C01E":{"Name":"RDALTCHAR" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Primary/Alternate Character Set"}
,"$C01F":{"Name":"RD80VID" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of 40/80 Columns"}
,"$C020":{"Name":"TAPEOUT" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Toggle Cassette Tape Output"}
,"$C021":{"Name":"MONOCOLOR" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,BI" ,"Description":"Color/Mono"}
,"$C022":{"Name":"TBCOLOR" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Screen Color: Low Nibble is BG, High Nibble is Text"}
,"$C023":{"Name":"VGCINT" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Video Graphics Controller Interrupts: b0-2=ext,scan,1sec enable b4-7=ext,scan,1sec,VGC"}
,"$C024":{"Name":"MOUSEDATA" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Mouse Data: High Bit is Button, Other Bits are Movement"}
,"$C025":{"Name":"KEYMODREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Modifier Keys: Bit 7: Command, Bit 6: Option, Bit 5: NotUsed, Bit 4: Keypad, Bit 3: Repeat,  Bit 2: Caps, Bit 1: Control, Bit 0: Shift"}
,"$C026":{"Name":"DATAREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"ADB Command/Data b0-2=# b3=valid b4=clr buf b5=reboot b6=abort b7=status"}
,"$C027":{"Name":"KMSTATUS" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"ADB Status: b0=cmdFull b1=mouseX b2=keyIntr b3=key b4=cmdIntr b5=data 6=mouseInt 7=mouse"}
,"$C028":{"Name":"ROMBANK" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"ROM bank select toggle"}
,"$C029":{"Name":"NEWVIDEO" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"New Video: 129=SHR, 1=None, Bit 6=Linearize, Bit 5=BW"}
,"$C02B":{"Name":"LANGSEL" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Bit 3=Secondary Bit 4=50Hz Bits 5-7=Display Language"}
,"$C02C":{"Name":"CHARROM" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Addr for test mode read of character ROM"}
,"$C02D":{"Name":"SLTROMSEL" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Slot Register; Bits 1-7=use slot card"}
,"$C02E":{"Name":"VERTCNT" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Addr for read of video cntr bits V5-VB"}
,"$C02F":{"Name":"HORIZCNT" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Addr for read of video cntr bits VA-H0"}
,"$C030":{"Name":"SPKR" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Toggle Speaker"}
,"$C031":{"Name":"DISKREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Disk Interface: Bit 6=3.5 Bit 7=RWHead 1"}
,"$C032":{"Name":"SCANINT" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"VGC Interrupt-Clear"}
,"$C033":{"Name":"CLOCKDATA" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Interface to Battery RAM (undocumented)"}
,"$C034":{"Name":"CLOCKCTL" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"b0-3=borderColor b5=stopBit b6=read b7=start"}
,"$C035":{"Name":"SHADOW" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Inhibit Shadowing: Bit 6: I/O Memory, Bit 5: Alternate, Display Mode, Bit 4: Auxilary HGR, Bit 3: Super HiRes, Bit 2: HiRes, Page 2, Bit 1: HiRes Page 1, Bit 0: Text/LoRes"}
,"$C036":{"Name":"CYAREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Bits 0-3=Disk Detect Bit 4=Shadow All Banks Bit 7=Fast"}
,"$C037":{"Name":"BMAREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Bit 5=BW"}
,"$C038":{"Name":"SCCBREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"SCC Command Channel B"}
,"$C039":{"Name":"SCCAREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"SCC Command Channel A"}
,"$C03A":{"Name":"SCCBDATA" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"SCC Data Channel B"}
,"$C03B":{"Name":"SCCADATA" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"SCC Data Channel A"}
,"$C03C":{"Name":"SOUNDCTL" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Sound Settings: Bits 0-3=Volume Bit 5=AutoIncr Bit 6=RAM Bit 7=Busy"}
,"$C03D":{"Name":"SOUNDDATA" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Sound Data"}
,"$C03E":{"Name":"SOUNDADRL" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Address Pointer L"}
,"$C03F":{"Name":"SOUNDADRH" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Address Pointer H"}
,"$C040a":{"Name":"STROBE" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Game I/O Strobe Output"}
,"$C040b":{"Name":"RDXYMSK" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Read X0/Y0 Interrupt"}
,"$C040c":{"Name":"BEEPER" ,"SYScode":"A3,A3P,A3R" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Sound hardware beeperC041 RDVBLMSK       C    R7  Read VBL Interrupt"}
,"$C042":{"Name":"RDX0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Read X0 Edge Selector"}
,"$C043":{"Name":"RDY0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Read Y0 Edge Selector"}
,"$C044":{"Name":"MMDELTAX" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Mega II Mouse Delta Movement X"}
,"$C045":{"Name":"MMDELTAY" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"Mega II Mouse Delta Movement Y"}
,"$C046a":{"Name":"DIAGTYPE" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Self or Burn-In diagdistics: Bit 7=burn-in diag"}
,"$C046b":{"Name":"INTFLAG" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"b0=IRQ b1=MMmov b2=MMbut b3=VBL b4=qsec b5=AN3 b6=mouse was down b7=mouse is down"}
,"$C047":{"Name":"CLRVBLINT" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Clear VBL Interrupt"}
,"$C048a":{"Name":"CLRXYINT" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Clear MM Interrupt"}
,"$C048b":{"Name":"RSTXY" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Reset X and Y Interrupts"}
,"$C04E":{"Name":"CHRDIS" ,"SYScode":"A3,A3P,A3R" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Character Ram Disable"}
,"$C04Fa":{"Name":"EMUBYTE" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Emulation ID byte: write once, then read once for program being used, read again for version number. $FE=Bernie, $16=Sweet16, $4B=KEGS, $AB=Appleblossom"}
,"$C04Fb":{"Name":"CHREN" ,"SYScode":"A3,A3P,A3R" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Character Ram Enable"}
,"$C050":{"Name":"TXTCLR" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display Graphics"}
,"$C051":{"Name":"TXTSET" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display Text"}
,"$C052":{"Name":"MIXCLR" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display Full Screen"}
,"$C053":{"Name":"MIXSET" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display Split Screen"}
,"$C054":{"Name":"TXTPAGE1" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display Page 1"}
,"$C055":{"Name":"TXTPAGE2" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If 80STORE Off: Display Page 2"}
,"$C056":{"Name":"LORES" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display LoRes Graphics"}
,"$C057":{"Name":"HIRES" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A3,A3P<br>,A3R,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Display HiRes Graphics"}
,"$C058a":{"Name":"CLRAN0" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 0 Off"}
,"$C058b":{"Name":"DISXY" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Mask X0/Y0 Move Interrupts"}
,"$C059a":{"Name":"SETAN0" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 0 On"}
,"$C059b":{"Name":"ENBXY" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Allow X0/Y0 Move Interrupts"}
,"$C05Aa":{"Name":"CLRAN1" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 1 Off"}
,"$C05Ab":{"Name":"DISVBL" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Disable VBL Interrupts"}
,"$C05Ba":{"Name":"SETAN1" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 1 On"}
,"$C05Bb":{"Name":"ENVBL" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Enable VBL Interrupts"}
,"$C05Ca":{"Name":"CLRAN2" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 2 Off"}
,"$C05Cb":{"Name":"X0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Interrupt on X0 Rising"}
,"$C05Da":{"Name":"SETAN2" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 2 On"}
,"$C05Db":{"Name":"X0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Interrupt on X0 Falling"}
,"$C05Ea":{"Name":"CLRAN3" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A3,A3P,A3R,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 3 Off"}
,"$C05Eb":{"Name":"Y0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Interrupt on Y0 Rising"}
,"$C05Ec":{"Name":"DHIRESON" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A3,A3P,A3R<br>,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"In 80-Column Mode: Double Width Graphics"}
,"$C05Fa":{"Name":"SETAN3" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS off: Annunciator 3 On"}
,"$C05Fb":{"Name":"Y0EDGE" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"If IOUDIS on: Interrupt on Y0 Falling"}
,"$C05Fc":{"Name":"DHIRESOFF" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"In 80-Column Mode: Single Width Graphics"}
,"$C060a":{"Name":"TAPEIN" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Read Cassette Input"}
,"$C060b":{"Name":"COL80SW" ,"SYScode":"A2c,A2cM,A3,A3P<br>,A3R" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of 80/40 Column Switch"}
,"$C060c":{"Name":"BUTN3" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Switch Input 3"}
,"$C061":{"Name":"RDBTN0" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Switch Input 0 / Open Apple"}
,"$C062":{"Name":"BUTN1" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Switch Input 1 / Solid Apple"}
,"$C063a":{"Name":"RD63" ,"SYScode":"A2E,A2Ee,A2eP,A2G3<br>,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Switch Input 2 / Shift Key"}
,"$C063b":{"Name":"RDMOUBTN" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Bit 7 = Mouse Button Not Pressed"}
,"$C064":{"Name":"PADDL0" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Analog Input 0"}
,"$C065":{"Name":"PADDL1" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2c,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Analog Input 1"}
,"$C066a":{"Name":"PADDL2" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Analog Input 2"}
,"$C066b":{"Name":"RDMOUX1" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Mouse Horiz Position"}
,"$C067a":{"Name":"PADDL3" ,"SYScode":"A2,A2P,A2PE,A2JP<br>,A2B,A2E,A2Ee,A2eP<br>,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Analog Input 3"}
,"$C067b":{"Name":"RDMOUY1" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Mouse Vert Position"}
,"$C068":{"Name":"STATEREG" ,"SYScode":"A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"RG" ,"Description":"b0=INTCXROM b1=ROMBANK b2=LCBNK2 b3=RDROM b4=RAMWRT b5=RAMRD b6=PAGE2 b7=ALTZP"}
,"$C06D":{"Name":"TESTREG" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Test Mode Bit Register"}
,"$C06E":{"Name":"CLRTM" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Clear Test Mode"}
,"$C06F":{"Name":"ENTM" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"" ,"Description":"Enable Test Mode"}
,"$C070a":{"Name":"PTRIG" ,"SYScode":"A2E,A2Ee,A2eP" ,"Range":"HI" ,"Behaviors":"RD" ,"Description":"Analog Input Reset"}
,"$C070b":{"Name":"PTRIG" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Analog Input Reset + Reset VBLINT Flag"}
,"$C070c":{"Name":"PTRIG" ,"SYScode":"A3,A3P,A3R" ,"Range":"HI" ,"Behaviors":"WR,RD" ,"Description":"Access Real Time Clock"}
,"$C073":{"Name":"BANKSEL" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM,A2G3,A2GS" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Memory Bank Select for > 128K"}
,"$C077":{"Name":"BLOSSOM" ,"SYScode":"" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Appleblossom Special I/O Address $C1=Install clock driver, $CC=Get time in input buffer, $CF=get time in ProDOS global page."}
,"$C078":{"Name":"BLOSSOM" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Disable IOU Access"}
,"$C079":{"Name":"BLOSSOM" ,"SYScode":"A2c,A2cM" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Enable IOU Access"}
,"$C07Ea":{"Name":"IOUDISON" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Disable IOU"}
,"$C07Eb":{"Name":"RDIOUDIS" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of IOU Disabling"}
,"$C07Fa":{"Name":"IOUDISOFF" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM" ,"Range":"HI" ,"Behaviors":"WR" ,"Description":"Enable IOU"}
,"$C07Fb":{"Name":"RDDHIRES" ,"SYScode":"A2E,A2Ee,A2eP,A2c<br>,A2cM" ,"Range":"HI" ,"Behaviors":"RD,BI" ,"Description":"Status of Double HiRes"}
}

const _CFG_PCODE = {
 "MS16K":{"NAME":"Microsoft 16K Language card" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"" ,"LROMrange":"" ,"SLOTrange":"0" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/storage/memory/Microsoft%20RAMCard%20-%20Manual.pdf)"}
,"TCLKP":{"NAME":"Thunderclock Plus" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"" ,"SLOTrange":"1*,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/clocks/ThunderClock%20Plus.pdf)"}
,"SSC":{"NAME":"Apple Super Serial Card" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/io/super_serial_card/Apple%20II%20Super%20Serial%20Card%20User%27s%20Manual.pdf)"}
,"DISKII":{"NAME":"Apple Disk II Floppy Disk Subsystem" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Peripherals/Disk%20Drives/Apple%20Disk%20II/Manuals/Apple%20Disk%20II%20Floppy%20Disk%20Subsystem%20-%20Installation%20and%20Operating%20Manual.pdf),[technical_manual](https://www.bigmessowires.com/2021/11/12/the-amazing-disk-ii-controller-card/) [deepdive](https://archive.org/details/Beneath_Apple_DOS_alt/page/n15/mode/2up?view=theater)"}
,"VIDEX":{"NAME":"Videx Videoterm 80 Column Display" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"$C800,$CFFF" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/80%20Column%20Cards/Videx%20Videoterm/Manuals/)"}
}

const _CFG_SLOT = {
 0:{"PCODE":"MS16K","IOrange":["$C08<sub>n</sub>0","$C08<sub>n</sub>F"],"ROMrange":[""],"LROMrange":[""] ,"DESCRIPTION":"[16K language card](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md#the-16k-language-cards)"}
,1:{"PCODE":"TCLKP","IOrange":["$C08<sub>n</sub>0","$C08<sub>n</sub>F"],"ROMrange":["$C0<sub>n</sub>00","$C0<sub>n</sub>FF"],"LROMrange":[""] ,"DESCRIPTION":""}
,2:{"PCODE":"SPC" ,"DESCRIPTION":""}
,3:{"PCODE":"VIDEX","IOrange":["$C08<sub>n</sub>0","$C08<sub>n</sub>F"],"ROMrange":["$C0<sub>n</sub>00","$C0<sub>n</sub>FF"],"LROMrange":["$C800","$CFFF"] ,"DESCRIPTION":""}
,4:{"PCODE":"" ,"DESCRIPTION":""}
,5:{"PCODE":"" ,"DESCRIPTION":""}
,6:{"PCODE":"DISKII","IOrange":["$C08<sub>n</sub>0","$C08<sub>n</sub>F"],"ROMrange":["$C0<sub>n</sub>00","$C0<sub>n</sub>FF"],"LROMrange":[""] ,"DESCRIPTION":""}
,7:{"PCODE":"" ,"DESCRIPTION":""}
}

const _CFG_PSLOT = {
 "A2BO":{"NAME":"Motherboard peripheral" ,"HostIO":"X" ,"SlotIO":"" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"H*" ,"SYScode":"A2,A2P,A2E" ,"Manuals":""}
,"MS16K":{"NAME":"Microsoft 16K Language card" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"0*" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/storage/memory/Microsoft%20RAMCard%20-%20Manual.pdf)"}
,"TCLKP":{"NAME":"Thunderclock Plus" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"1,2,3,4*,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/clocks/ThunderClock%20Plus.pdf)"}
,"DISKII":{"NAME":"Apple Disk II Floppy Disk Subsystem" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"" ,"SLOTrange":"1,2,3,4,5,6*,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Peripherals/Disk%20Drives/Apple%20Disk%20II/Manuals/Apple%20Disk%20II%20Floppy%20Disk%20Subsystem%20-%20Installation%20and%20Operating%20Manual.pdf),[technical_manual](https://www.bigmessowires.com/2021/11/12/the-amazing-disk-ii-controller-card/) [deepdive](https://archive.org/details/Beneath_Apple_DOS_alt/page/n15/mode/2up?view=theater)"}
,"VIDEX":{"NAME":"Videx Videoterm 80 Column Display" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"3" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/80%20Column%20Cards/Videx%20Videoterm/Manuals/)"}
,"MOCK":{"NAME":"Mockingboard C" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/80%20Column%20Cards/Videx%20Videoterm/Manuals/)"}
,"SSC":{"NAME":"Apple Super Serial Card" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/io/super_serial_card/Apple%20II%20Super%20Serial%20Card%20User%27s%20Manual.pdf)"}
,"SPC":{"NAME":"Apple Serial Pro Card" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"1,2*,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Serial/AE%20Serial%20Pro/Manuals/AE%20Serial%20Pro%20-%20Manual.pdf)"}
}

const _CFG_KEYFONT = {
 "A2_US":{"MAP_FORMULA":"ch" ,"MAP_JSON":"0x80" ,"":"{\"é\": [0x45],\"“\": [0x22],\"”\": [0x22],\"…\": [0x2E, 0x2E, 0x2E]}"}
}

const _CFG_CHROMA = {
 0:{"COL_num":"" ,"COL_name":"FULL-COLOR"}
,1:{"COL_num":"#FFFFFF" ,"COL_name":"B&W"}
,2:{"COL_num":"#A0FFF0" ,"COL_name":"GREEN"}
,3:{"COL_num":"#FCE7A1" ,"COL_name":"AMBER"}
}

var _TABS = {
"tab1":{"title":"Emulator","DEF_SYS":"A2P"}
,"tab2":{"title":"Assembler","DEF_SYS":"A2P"}
,"tab3":{"title":"Debugger","DEF_SYS":"A2P"}
,"tab4":{"title":"Manual","DEF_SYS":"A2P"}
}

const _CFG_TFUNCTION = {
 ".eq":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"(^[^;]*)(\\.eq |\\.EQ )(.+)" ,"REGEXP_OUTPUT":"'$1EQU$3'" ,"DESCRIPTION":"Replace .eq   by EQU until ;"}
,".var":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"(^[^;]*)(\\.var |\\.VAR )(.+)" ,"REGEXP_OUTPUT":"'$1EQU$3'" ,"DESCRIPTION":"Replace .var  by EQU until ;"}
,".org":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"(^[^;]*)(\\.org |\\.ORG )(.+)" ,"REGEXP_OUTPUT":"'$1ORG$3'" ,"DESCRIPTION":"Replace .org  by ORG until ;"}
,".str":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"(^[^;]*)(\\.str |\\.STR )(.+)" ,"REGEXP_OUTPUT":"'$1ASC$3'" ,"DESCRIPTION":"Replace .str  by ASC until ;"}
,".bulk":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"\\x20.bulk\\x20([\\s\\S]*)$" ,"REGEXP_OUTPUT":"'HEX '+x.split('.bulk')[1].replace(/[,$]/g,' ').replace(/\\s\\s+/g,' ').toUpperCase()" ,"DESCRIPTION":"Replace .bulk by HEX, remove strings and commas"}
,"+":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"\\x20\\+\\x20([\\s\\S]*)$" ,"REGEXP_OUTPUT":"'HEX '+x.split(' + ')[1].replace(/[,$]/g,' ').replace(/\\s\\s+/g,' ').toUpperCase()" ,"DESCRIPTION":"Replace + by HEX, remove strings and commas"}
,".fill":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":".fill\\x20([\\s\\S]*)$" ,"REGEXP_OUTPUT":"'HEX'+(' '+x.split(',')[1].replace(/[ \\n\\$]/g,'')).toUpperCase().repeat(x.split(',')[0].replace(/[^0-9]/g,''))+' '" ,"DESCRIPTION":"Substitute .fill by HEX array"}
,"remove {..}":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"\\{[^{}]*\\}" ,"REGEXP_OUTPUT":"''" ,"DESCRIPTION":"Remove everything between accolades"}
,"*":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"^\\*" ,"REGEXP_OUTPUT":"';*'" ,"DESCRIPTION":"Add semicolumn before any line starting with asterisk"}
,"upper_before;":{"COMPILER":"SourceGen" ,"REGXEP_INPUT":"^[^;^n]*" ,"REGEXP_OUTPUT":"x.toUpperCase()" ,"DESCRIPTION":"Uppercase everything until bumping into a semicolumn"}
}

