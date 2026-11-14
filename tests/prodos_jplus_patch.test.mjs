// Boot image safety and Apple J-Plus ROM identification compatibility.
// node --test tests/prodos_jplus_patch.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,writeFileSync,existsSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {
    patchProDOS25JPlus,crc32,PRODOS25A8_JPLUS_PATCH
} from "../tools/patch_prodos25_jplus.mjs";

const IMAGE=resolve("disks/ProDOS 8.dsk");
const bytes=readFileSync(IMAGE);
const p=PRODOS25A8_JPLUS_PATCH;

test("repository ProDOS source is the exact version this patch supports",()=>{
    assert.equal(bytes.length,p.size);
    assert.equal(crc32(bytes),0x4811045A);
    assert.equal(bytes[p.byteOffset],0xEA);
    assert.deepEqual(
        [...bytes.subarray(p.byteOffset-3,p.byteOffset-3+p.expectedInstructions.length)],
        [...p.expectedInstructions]
    );
});

test("patch changes exactly the ROM-ID immediate operand, not disk data",()=>{
    const original=Buffer.from(bytes);
    const changed=patchProDOS25JPlus(original);
    assert.equal(changed.length,original.length);
    assert.equal(changed[p.byteOffset],0xC9);
    let count=0;
    for(let i=0;i<bytes.length;i++)
    {
        if(changed[i]!==bytes[i])
        {
            assert.equal(i,p.byteOffset);
            count++;
        }
    }
    assert.equal(count,1);
    assert.deepEqual(original,bytes,"input is not mutated");
});

test("patched ROM detection now recognises authentic A2JP bytes",()=>{
    const original=Uint8Array.from(bytes),patched=patchProDOS25JPlus(bytes);
    // The actual 6502 loader sequence has:
    // LDX $FBB3; ... CPX #$EA; BNE ...; LDX $FB1E; CPX #$AD.
    const detector=original.subarray(0x4E8D,0x4EB2);
    assert.deepEqual([...detector.subarray(0,3)],[0xAE,0xB3,0xFB]);
    assert.deepEqual([...original.subarray(0x4EA4,0x4EAE)],
        [0xE0,0xEA,0xD0,0x0F,0xAE,0x1E,0xFB,0xE0,0xAD,0xF0]);
    assert.deepEqual([...patched.subarray(0x4EA4,0x4EAE)],
        [0xE0,0xC9,0xD0,0x0F,0xAE,0x1E,0xFB,0xE0,0xAD,0xF0]);

    const monitor=readFileSync(resolve("res/EMU_apple2roms.js"),"utf8");
    assert.match(monitor,/case "A2P_RJ"/);
    // Original unmodified Apple J-Plus Monitor ROM from separate archival binary.
    // FBB3=C9 and FB1E=AD, corroborated by the exact ROM artifact.
    const jp={fbb3:0xC9,fb1e:0xAD};
    const a2p={fbb3:0xEA,fb1e:0xAD};
    const accepted=({fbb3,fb1e},source)=>{
        const immediate=source[0x4EA5];
        return fbb3===immediate && fb1e===source[0x4EAC];
    };
    assert.equal(accepted(a2p,original),true);
    assert.equal(accepted(jp,original),false);
    assert.equal(accepted(jp,patched),true);
    assert.equal(accepted(a2p,patched),false,
        "The copy is J-Plus specific; retain the original image for A2P");
});

test("refuses to edit unfamiliar, modified, or truncated disk images",()=>{
    const wrong=Uint8Array.from(bytes);
    wrong[0x234]=wrong[0x234]^1;
    assert.throws(()=>patchProDOS25JPlus(wrong),/Unrecognised source disk CRC32/);
    assert.throws(()=>patchProDOS25JPlus(wrong.subarray(1)),RangeError);
    assert.throws(()=>patchProDOS25JPlus(patchProDOS25JPlus(bytes)),
        /Unrecognised source disk CRC32/);
});

test("CLI generates the patched copy without overwriting the source",()=>{
    const dir=mkdtempSync(join(tmpdir(),"jplus-prodos-"));
    try
    {
        const source=join(dir,"source.dsk"),out=join(dir,"patched.dsk");
        writeFileSync(source,bytes);
        const proc=spawnSync(process.execPath,[
            resolve("tools/patch_prodos25_jplus.mjs"),source,out
        ],{encoding:"utf8"});
        assert.equal(proc.status,0,proc.stderr);
        assert.ok(existsSync(out));
        assert.equal(readFileSync(out)[p.byteOffset],0xC9);
        assert.deepEqual(readFileSync(source),bytes);
        const collision=spawnSync(process.execPath,[
            resolve("tools/patch_prodos25_jplus.mjs"),source,source
        ],{encoding:"utf8"});
        assert.notEqual(collision.status,0);
        const overwrite=spawnSync(process.execPath,[
            resolve("tools/patch_prodos25_jplus.mjs"),source,out
        ],{encoding:"utf8"});
        assert.notEqual(overwrite.status,0);
    }
    finally {rmSync(dir,{recursive:true,force:true});}
});
