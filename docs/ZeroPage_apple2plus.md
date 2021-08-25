  $00-$05 - ???  
  $06-$09 - Free Space  
  $0A-$0C - JMP to USR() User Function Routine  
  $0D-$17 - ???  
  $18     - First Data Track  
  $19     - First Data Sector  
  $1A-$1B - Shape Pointer for DRAW  
  $1C     - Last COLOR Used  
  $1D-$1E - Free Space  
  $1F     - ???  
  $20     - Left Margin (0 - 39/79, 0 is default)  
  $21     - Width (1 - 40/80, 40 is default, 0 crashes Applesoft)  
  $22     - Top Margin (0 - 23, 0 is default, 20 in graphics mode)  
  $23     - Bottom Margin (0 - 23, 23 is default)  
  $24     - Horizontal Cursor Position (0 - 39/79)  
  $25     - Vertical Cursor Position (0 - 23)  
  $26-$27 - Address of Byte Containing X,Y  
  $28-$29 - Base Address of Text Cursor's Position  
  $2A     - ???  
  $2B     - Boot Slot * 16  
  $2C     - Lo-Res HLIN/VLIN Endpoint  
  $2D-$2F - ???  
  $30     - COLOR Value * 17  
  $31     - ???  
  $32     - Text Mask ($FF = Normal, $7F = Inverse, $3F = Flashing)  
  $33     - Prompt Character  
  $34-$35 - ???  
  $36-$37 - Address of Output Routine  
  $38-$39 - Address of Input Routine  
  $3A-$4F - ???  
  $50-$51 - Result of the Conversion of the FAC to a 16-Bit Integer  
  $52-$66 - ???  
  $67-$68 - Address of Beginning of BASIC Program ($0801 is default)  
  $69-$6A - Address of Beginning of BASIC Variables  
  $6B-$6C - Address of Beginning of BASIC Arrays  
  $6D-$6E - Address of End of BASIC Variables  
  $6F-$70 - Address of End of String Data  
  $71-$72 - Address to Move String To  
  $73-$74 - Address of Beginning of String Data  
  $75-$76 - Current Line Number Being Executed  
  $77-$78 - Line Number Where END or STOP or BREAK Occurred  
  $79-$7A - Address of Line Number Being Executed  
  $7B-$7C - Current Address of DATA  
  $7D-$7E - Next Address of DATA  
  $7F-$80 - Address of Input or Data  
  $81-$82 - Last Used Variable's Name  
  $83-$84 - Last Used Variable's Address  
  $85-$9A - ???  
  $9B-$9C - Pointer for $D61A and $F7D9  
  $9D-$A3 - Floating Point Accumulator (FAC)  
  $A4     - ???  
  $A5-$AB - Floating Point Argument Register (ARG)  
  $AC-$AE - ???  
  $AF-$B0 - Address of End of BASIC Program  
  $B1-$B6 - Subroutine to Increase the String Data Pointer  
  $B7-$BE - Subroutine to Return the Character Pointed to by the String Data Pointer  
  $BF-$CD - ???  
  $CE-$CF - Free Space  
  $D0-$D3 - ???  
  $D4     - Error Code Flag  
  $D5-$D6 - ???  
  $D7     - Free Space  
  $D8     - Error Flag (Bit 7 Set if an Error Handler is Used)  
  $D9     - ???  
  $DA-$DB - Line Number Where Error Occurred  
  $DC-$DD - ???  
  $DE     - Error Code  
  $DF     - ???  
  $E0-$E1 - Horizontal Coordinate of HPLOT  
  $E2     - Vertical Coordinate of HPLOT  
  $E3     - Free Space  
  $E4     - HCOLOR Value (0=0, 1=42, 2=85, 3=127, 4=128, 5=170, 6=213, 7=255)  
  $E5     - ???  
  $E6     - High Byte of Address of First Byte of Where HGR is Plotted  
  $E7     - SCALE Value (0 = 256)  
  $E8-$E9 - Address of Shape Table  
  $EA     - DRAW/XDRAW Collision Count  
  $EB-$EF - Free Space  
  $F0     - ???  
  $F1     - SPEED Value (Subtracted From 256)  
  $F2     - ???  
  $F3     - Text OR Mask for Flashing Text  
  $F4-$F5 - Address of Error Handler (Line Number after ONERR GOTO)  
  $F6-$F8 - ???  
  $F9     - ROT Value  
  $FA-$FE - Free Space  
  $FF     - Used by Applesoft's STR$ Function  
  
