// Verify the reproducible J-Plus ProDOS disk binary is actually checked in.
// node --test tests/prodos_jplus_committed_disk.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname,join} from "node:path";
import {patchProDOS25JPlus,crc32} from "../tools/patch_prodos25_jplus.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const original=readFileSync(join(root,"disks/ProDOS 8.dsk"));
const committed=readFileSync(join(root,"disks/ProDOS_8_JPlus.dsk"));

test("J-Plus disk is committed as an ordinary file in disks/",()=>{
    assert.equal(committed.length,143360);
    assert.equal(crc32(original),0x4811045A);
    assert.equal(crc32(committed),0x97D3B457);
});

test("committed J-Plus disk exactly matches the version-guarded one-byte patcher",()=>{
    const regenerated=patchProDOS25JPlus(original);
    assert.deepEqual(committed,Buffer.from(regenerated));
    assert.equal(original[0x4EA5],0xEA);
    assert.equal(committed[0x4EA5],0xC9);
    let changes=0;
    for(let i=0;i<committed.length;i++)
        if(committed[i]!==original[i])
        {
            assert.equal(i,0x4EA5,"unexpected change to the source disk");
            changes++;
        }
    assert.equal(changes,1);
});

test("original disk remains unchanged and can still boot A2P",()=>{
    assert.equal(original[0x4EA5],0xEA);
    assert.equal(original.length,committed.length);
    assert.notDeepEqual(committed,original);
});
