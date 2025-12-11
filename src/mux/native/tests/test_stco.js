import { buildStcoBox } from "../boxes/stcoBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testStco() {

    console.log("=== testStco ===");

    // ---------------------------------------------------------
    // TEST 1: empty offsets list
    // ---------------------------------------------------------
    let stco = buildStcoBox([]);

    let size1 = readUint32(stco, 0);
    if (size1 !== 16) {
        throw new Error(`FAIL: stco size for zero entries must be 16 bytes, got ${size1}`);
    }

    let type1 = String.fromCharCode(...stco.slice(4, 8));
    if (type1 !== "stco") {
        throw new Error("FAIL: stco type incorrect for empty case");
    }

    let count1 = readUint32(stco, 12);
    if (count1 !== 0) {
        throw new Error("FAIL: empty stco must have entry_count = 0");
    }

    // ---------------------------------------------------------
    // TEST 2: single offset
    // ---------------------------------------------------------
    const offsets1 = [1000];
    stco = buildStcoBox(offsets1);

    let size2 = readUint32(stco, 0);
    if (size2 !== 20) {
        throw new Error(`FAIL: stco size for one entry must be 20 bytes, got ${size2}`);
    }

    let count2 = readUint32(stco, 12);
    if (count2 !== 1) {
        throw new Error("FAIL: stco entry_count incorrect for single offset");
    }

    let offset2 = readUint32(stco, 16);
    if (offset2 !== 1000) {
        throw new Error("FAIL: stco stored offset incorrect for single entry");
    }

    // ---------------------------------------------------------
    // TEST 3: multiple offsets
    // ---------------------------------------------------------
    const offsetsMulti = [8, 512, 4096];
    stco = buildStcoBox(offsetsMulti);

    let count3 = readUint32(stco, 12);
    if (count3 !== 3) {
        throw new Error("FAIL: stco entry_count incorrect for multiple offsets");
    }

    let o0 = readUint32(stco, 16);
    let o1 = readUint32(stco, 20);
    let o2 = readUint32(stco, 24);

    if (o0 !== 8 || o1 !== 512 || o2 !== 4096) {
        throw new Error("FAIL: stco offset entries incorrect");
    }

    // ---------------------------------------------------------
    // TEST 4: input must not mutate post-box
    // ---------------------------------------------------------
    const mutableOffsets = [12, 24, 36];
    stco = buildStcoBox(mutableOffsets);

    mutableOffsets[0] = 999;

    let preserved = readUint32(stco, 16);
    if (preserved !== 12) {
        throw new Error("FAIL: stco must not depend on mutated input");
    }

    // ---------------------------------------------------------
    // TEST 5: big-endian correctness
    // ---------------------------------------------------------
    stco = buildStcoBox([0x01020304]);

    let parsed = readUint32(stco, 16);
    if (parsed !== 0x01020304) {
        throw new Error("FAIL: stco big-endian encoding incorrect");
    }

    console.log("PASS: STCO tests");
}
