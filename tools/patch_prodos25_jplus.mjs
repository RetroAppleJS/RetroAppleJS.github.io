#!/usr/bin/env node
/**
 * Patch a COPY of this repository's ProDOS 2.5.0a8 startup floppy for the
 * original Apple II J-Plus monitor ROM, without modifying emulator firmware.
 *
 * Usage:
 *   node tools/patch_prodos25_jplus.mjs "disks/ProDOS 8.dsk" "disks/ProDOS_8_JPlus.dsk"
 *
 * The ProDOS ROM identification routine checks the byte at $FBB3:
 *   Apple II Plus = $EA, J-Plus = $C9.
 * This loader supports the II Plus but omits the J-Plus from its table.
 * Replacing ONLY the immediate operand of CPX #$EA with #$C9 routes the
 * J-Plus (whose $FB1E is still $AD) through the same 64K language-card test.
 *
 * This output is specifically for J-Plus. The original file is needed when
 * booting an A2P. Never modify the user's disk or an unknown ProDOS version.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRODOS25A8_JPLUS_PATCH = Object.freeze({
    size: 143360,
    originalCrc32: 0x4811045A,
    byteOffset: 0x4EA5,
    originalByte: 0xEA,
    patchedByte: 0xC9,
    // LDA #$40 ; CPX #$EA ; BNE skip ; LDX $FB1E ; CPX #$AD
    expectedInstructions: Object.freeze([
        0xA9,0x40,0xE0,0xEA,0xD0,0x0F,0xAE,0x1E,0xFB,0xE0,0xAD,0xF0,0x0E
    ])
});

export function crc32(bytes)
{
    let crc=0xFFFFFFFF;
    for(const byte of bytes)
    {
        crc ^= byte;
        for(let i=0;i<8;i++)
            crc=(crc>>>1)^((crc&1) ? 0xEDB88320 : 0);
    }
    return (crc^0xFFFFFFFF)>>>0;
}

export function patchProDOS25JPlus(input)
{
    if(!input || input.length!==PRODOS25A8_JPLUS_PATCH.size)
        throw new RangeError("Expected exactly 143360 bytes of ProDOS 2.5.0a8 .dsk");
    const source=new Uint8Array(input);
    const checksum=crc32(source);
    if(checksum!==PRODOS25A8_JPLUS_PATCH.originalCrc32)
        throw new Error("Unrecognised source disk CRC32 $"+
            checksum.toString(16).toUpperCase().padStart(8,"0")+
            "; refusing to patch unverified media");

    const p=PRODOS25A8_JPLUS_PATCH;
    const start=p.byteOffset-3;
    for(let i=0;i<p.expectedInstructions.length;i++)
        if(source[start+i]!==p.expectedInstructions[i])
            throw new Error("Unexpected ProDOS ROM-identification instruction at disk offset $"+
                (start+i).toString(16));
    const result=source.slice();
    result[p.byteOffset]=p.patchedByte;
    return result;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
{
    const source=resolve(process.argv[2] || "disks/ProDOS 8.dsk");
    const output=resolve(process.argv[3] || "disks/ProDOS_8_JPlus.dsk");
    if(source===output)
        throw new Error("The output must not replace the original ProDOS image");
    const data=patchProDOS25JPlus(readFileSync(source));
    writeFileSync(output,data,{flag:"wx"});
    console.log("J-Plus-compatible ProDOS 2.5.0a8 image saved: "+output);
    console.log("Changed exactly one loader byte at file offset $4EA5: CPX #$EA -> CPX #$C9");
}
