/*
 * Validate all embedded offline disk records are complete 143360-byte images.
 * ProDOS 8 must also match its canonical repository .dsk byte-for-byte.
 * Other offline records are historical snapshots, not necessarily identical
 * to their current disk-library counterparts.
 *
 * Run: node --test tests/diskii_offline_embedded_images.test.cjs
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "res/EMU_CARD_appledisk2.js"), "utf8");
const start = source.indexOf("    const OfflineDisks =");
const end = source.indexOf("\n    this.GitHubDirCache =", start);

test("Disk II has a complete, self-contained embedded offline catalog", () => {
    assert.ok(start > 0 && end > start);
    const expression = source.slice(start, end)
        .replace(/^\s*const OfflineDisks\s*=\s*/, "")
        .trim().replace(/;\s*$/, "");
    const records = vm.runInNewContext("(" + expression + ")", {}, {timeout:3000});
    const expected = [
        "disks/Apple DOS 3.3.dsk",
        "disks/BLANK_DOS.DSK",
        "disks/BLANK_PRONTODOS.dsk",
        "disks/ProDOS 8.dsk"
    ];
    assert.deepEqual(Object.keys(records).sort(), expected.slice().sort());
    for(const diskPath of expected) {
        const record = records[diskPath];
        assert.equal(record.encoding, "zlib-base64", diskPath);
        assert.match(record.data, /^[A-Za-z0-9+/]+={0,2}$/, diskPath);
        const compressed = Buffer.from(record.data, "base64");
        let uncompressed;
        assert.doesNotThrow(() => {
            uncompressed = zlib.inflateSync(compressed);
        }, diskPath + " must contain a complete zlib stream");

        const onDisk = fs.readFileSync(path.join(ROOT, diskPath));
        assert.equal(onDisk.length, 143360, diskPath);
        assert.equal(uncompressed.length, 143360, diskPath);
        if(diskPath==="disks/ProDOS 8.dsk")
            assert.equal(Buffer.compare(uncompressed, onDisk), 0,
                diskPath + " must match its canonical repository disk byte-for-byte");
    }
});
