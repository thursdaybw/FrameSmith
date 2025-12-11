import { buildStszBox } from "../boxes/stszBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testStsz() {

    console.log("=== testStsz ===");

    // ---- TEST 1: empty list ----------------------------------------
    let stsz = buildStszBox([]);

    let size1 = readUint32(stsz, 0);
    if (size1 !== 20) throw new Error("FAIL: empty stsz must be 20 bytes long");

    if (String.fromCharCode(...stsz.slice(4, 8)) !== "stsz") {
        throw new Error("FAIL: stsz box type incorrect for empty table");
    }

    let sampleSize1 = readUint32(stsz, 12); // sample_size field
    let sampleCount1 = readUint32(stsz, 16);

    if (sampleSize1 !== 0) throw new Error("FAIL: empty stsz must use sample_size = 0");
    if (sampleCount1 !== 0) throw new Error("FAIL: empty stsz must have sample_count = 0");

    // ---- TEST 2: single sample -------------------------------------
    stsz = buildStszBox([100]);

    let size2 = readUint32(stsz, 0);
    if (size2 !== 24) throw new Error("FAIL: stsz size incorrect for one sample");

    let sampleCount2 = readUint32(stsz, 16);
    if (sampleCount2 !== 1) throw new Error("FAIL: stsz sample_count incorrect");

    let entrySize2 = readUint32(stsz, 20);
    if (entrySize2 !== 100) throw new Error("FAIL: stsz entry size incorrect for single entry");

    // ---- TEST 3: multiple samples ----------------------------------
    const sizesMulti = [5, 10, 15];
    stsz = buildStszBox(sizesMulti);

    let sampleCount3 = readUint32(stsz, 16);
    if (sampleCount3 !== 3) throw new Error("FAIL: multi-sample stsz sample_count incorrect");

    let e0 = readUint32(stsz, 20);
    let e1 = readUint32(stsz, 24);
    let e2 = readUint32(stsz, 28);

    if (e0 !== 5 || e1 !== 10 || e2 !== 15) {
        throw new Error("FAIL: multi-sample stsz entries incorrect");
    }

    // ---- TEST 4: input must not mutate after build ------------------
    const sizesMutable = [3, 4, 5];
    stsz = buildStszBox(sizesMutable);

    sizesMutable[0] = 999;

    const originalEntry = readUint32(stsz, 20);
    if (originalEntry !== 3) {
        throw new Error("FAIL: stsz build must not depend on mutated input");
    }

    // ---- TEST 5: big-endian check ----------------------------------
    stsz = buildStszBox([256]);
    const bigEntry = readUint32(stsz, 20);

    if (bigEntry !== 256) {
        throw new Error("FAIL: stsz big-endian byte writing incorrect");
    }

    console.log("PASS: STSZ tests");
}
