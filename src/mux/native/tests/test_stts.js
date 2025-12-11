import { buildSttsBox } from "../boxes/sttsBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testStts() {

    console.log("=== testStts ===");

    // For all tests, we assume fps = 30 unless stated otherwise.
    const fps = 30;
    const expectedDuration = Math.floor(90000 / fps); // 3000

    // ---------------------------------------------------------
    // TEST 1: Zero samples
    // ---------------------------------------------------------
    let stts = buildSttsBox(0, expectedDuration);

    let size1 = readUint32(stts, 0);
    if (size1 !== 24) {
        throw new Error(`FAIL: stts size for zero samples must be 24 bytes, got ${size1}`);
    }

    let type1 = String.fromCharCode(...stts.slice(4, 8));
    if (type1 !== "stts") {
        throw new Error(`FAIL: stts type incorrect, got ${type1}`);
    }

    let entryCount1 = readUint32(stts, 12);
    if (entryCount1 !== 1) {
        throw new Error("FAIL: stts must contain one entry");
    }

    let count1 = readUint32(stts, 16);
    let delta1 = readUint32(stts, 20);

    if (count1 !== 0) throw new Error("FAIL: sample_count for zero samples must be 0");
    if (delta1 !== expectedDuration) {
        throw new Error(`FAIL: expected duration ${expectedDuration}, got ${delta1}`);
    }

    // ---------------------------------------------------------
    // TEST 2: One sample
    // ---------------------------------------------------------
    stts = buildSttsBox(1, expectedDuration);

    let count2 = readUint32(stts, 16);
    let delta2 = readUint32(stts, 20);

    if (count2 !== 1) throw new Error("FAIL: sample_count incorrect for one sample");
    if (delta2 !== expectedDuration) throw new Error("FAIL: sample_delta incorrect for one sample");

    // ---------------------------------------------------------
    // TEST 3: Many samples
    // ---------------------------------------------------------
    const N = 47;
    stts = buildSttsBox(N, expectedDuration);

    let count3 = readUint32(stts, 16);
    let delta3 = readUint32(stts, 20);

    if (count3 !== N) throw new Error("FAIL: sample_count incorrect for many samples");
    if (delta3 !== expectedDuration) throw new Error("FAIL: sample_delta incorrect for many samples");

    // ---------------------------------------------------------
    // TEST 4: Big-endian correctness on duration
    // ---------------------------------------------------------
    const weirdDuration = 12345;
    stts = buildSttsBox(5, weirdDuration);

    let stored4 = readUint32(stts, 20);
    if (stored4 !== weirdDuration) {
        throw new Error("FAIL: stts duration big-endian encoding incorrect");
    }

    console.log("PASS: STTS tests");
}
