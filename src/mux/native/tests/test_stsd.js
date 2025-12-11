import { buildStsdBox } from "../boxes/stsdBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testStsd() {
    console.log("=== testStsd ===");

    const width = 1920;
    const height = 1080;
    const dummyAvcC = Uint8Array.from([1, 2, 3, 4]);
    const codec = "avc1";

    const stsd = buildStsdBox({
        width,
        height,
        codec,
        avcC: dummyAvcC
    });


    // ---- TEST 1: basic header -------------------------------------
    const boxSize = readUint32(stsd, 0);
    if (boxSize !== stsd.length) {
        throw new Error("FAIL: stsd box size field does not match length");
    }

    if (readType(stsd, 4) !== "stsd") {
        throw new Error("FAIL: stsd box type incorrect");
    }

    // version(1) + flags(3) = zero
    if (stsd[8] !== 0 || stsd[9] !== 0 || stsd[10] !== 0 || stsd[11] !== 0) {
        throw new Error("FAIL: stsd version/flags must be zero");
    }

    // ---- TEST 2: entry count must be 1 -----------------------------
    const entryCount = readUint32(stsd, 12);
    if (entryCount !== 1) {
        throw new Error("FAIL: stsd entry_count must be 1");
    }

    // ---- TEST 3: verify nested avc1 box ----------------------------
    // avc1 begins immediately after the entry-count field
    const avc1Offset = 16;
    const avc1Type = readType(stsd, avc1Offset + 4);

    if (avc1Type !== "avc1") {
        throw new Error("FAIL: stsd does not contain avc1 box at expected location");
    }

    const avc1Size = readUint32(stsd, avc1Offset);
    if (avc1Offset + avc1Size > stsd.length) {
        throw new Error("FAIL: avc1 box size extends beyond stsd bounds");
    }

    // ---- TEST 4: verify avcC exists inside avc1 --------------------
    // avcC must appear somewhere inside the avc1 payload
    let foundAvcC = false;
    for (let i = avc1Offset; i < avc1Offset + avc1Size - 4; i++) {
        if (readType(stsd, i + 4) === "avcC") {
            foundAvcC = true;
            break;
        }
    }

    if (!foundAvcC) {
        throw new Error("FAIL: avcC box not found inside avc1");
    }

    // ---- TEST 5: input must not mutate -----------------------------
    const originalByte = dummyAvcC[0];
    if (originalByte !== 1) {
        throw new Error("FAIL: buildStsdBox must not mutate avcC input");
    }

    console.log("PASS: STSD tests");
}
