import { buildStscBox } from "../boxes/stscBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testStsc() {

    console.log("=== testStsc ===");

    // STSC entry format:
    // version(1) + flags(3)
    // entry_count (4)
    // Then each entry:
    //   first_chunk (4)
    //   samples_per_chunk (4)
    //   sample_description_index (4)
    //
    // Our MVP uses exactly ONE entry:
    //   first_chunk = 1
    //   samples_per_chunk = 1
    //   sample_description = 1

    // ---------------------------------------------------------
    // TEST 1: empty sample list → still one entry
    // ---------------------------------------------------------
    let stsc = buildStscBox([]);

    let boxSize1 = readUint32(stsc, 0);
    let type1 = String.fromCharCode(...stsc.slice(4, 8));

    if (type1 !== "stsc") {
        throw new Error("FAIL: STSC type incorrect for empty case");
    }

    // size = 8 header + 4 version/flags + 4 entry_count + 12 entry = 28 bytes
    if (boxSize1 !== 28) {
        throw new Error(`FAIL: empty stsc must be 28 bytes, got ${boxSize1}`);
    }

    let entryCount1 = readUint32(stsc, 12);
    if (entryCount1 !== 1) {
        throw new Error("FAIL: empty stsc still requires one structural entry");
    }

    let firstChunk1 = readUint32(stsc, 16);
    let samplesPerChunk1 = readUint32(stsc, 20);
    let descIdx1 = readUint32(stsc, 24);

    if (firstChunk1 !== 1 || samplesPerChunk1 !== 1 || descIdx1 !== 1) {
        throw new Error("FAIL: empty stsc must map chunk 1 → 1 sample of desc 1");
    }

    // ---------------------------------------------------------
    // TEST 2: multiple samples → same table structure
    // ---------------------------------------------------------
    stsc = buildStscBox([100, 200, 300]);

    let entryCount2 = readUint32(stsc, 12);
    if (entryCount2 !== 1) {
        throw new Error("FAIL: multi-sample stsc should still have one entry");
    }

    let firstChunk2 = readUint32(stsc, 16);
    let samplesPerChunk2 = readUint32(stsc, 20);
    let descIdx2 = readUint32(stsc, 24);

    if (firstChunk2 !== 1 || samplesPerChunk2 !== 1 || descIdx2 !== 1) {
        throw new Error("FAIL: multi-sample stsc entry incorrect");
    }

    // ---------------------------------------------------------
    // TEST 3: immutability of input
    // ---------------------------------------------------------
    const sampleList = [10, 20, 30];
    stsc = buildStscBox(sampleList);

    sampleList[0] = 999;

    let originalFirstEntry = readUint32(stsc, 16);
    if (originalFirstEntry !== 1) {
        throw new Error("FAIL: stsc must not depend on mutated input");
    }

    console.log("PASS: STSC tests");
}
