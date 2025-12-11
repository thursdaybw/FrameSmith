import { buildTkhdBox } from "../boxes/tkhdBox.js";
import { readUint32, readType } from "./testUtils.js";

export async function testTkhd() {
    console.log("=== testTkhd ===");

    const width = 1920;
    const height = 1080;
    const duration = 90000 * 10; // 10 seconds at 90kHz

    const tkhd = buildTkhdBox({
        width,
        height,
        duration,
        trackId: 1   // explicit is better
    });

    // ---- TEST 1: basic header ----------------------------------
    const boxSize = readUint32(tkhd, 0);
    if (boxSize !== tkhd.length) {
        throw new Error("FAIL: tkhd size field does not match length");
    }

    if (readType(tkhd, 4) !== "tkhd") {
        throw new Error("FAIL: tkhd box type incorrect");
    }

    // ---- TEST 2: version + flags -----------------------------------
    if (tkhd[8] !== 0) throw new Error("FAIL: tkhd version must be 0");
    const flags = (tkhd[9] << 16) | (tkhd[10] << 8) | tkhd[11];
    if (flags !== 0x000007) {
        throw new Error("FAIL: tkhd flags incorrect");
    }

    // ---- TEST 3: track ID -------------------------------------------
    const trackId = readUint32(tkhd, 20);
    if (trackId !== 1) {
        throw new Error("FAIL: tkhd trackId must be 1");
    }

    // ---- TEST 4: duration -------------------------------------------
    const durationRead = readUint32(tkhd, 28);
    if (durationRead !== duration) {
        throw new Error("FAIL: tkhd duration field incorrect");
    }

    // ---- TEST 5: width/height fixed 16.16 ---------------------------
    const widthFixed  = readUint32(tkhd, 84);
    const heightFixed = readUint32(tkhd, 88);

    if (widthFixed !== width << 16) {
        throw new Error("FAIL: tkhd width fixed-point encoding incorrect");
    }

    if (heightFixed !== height << 16) {
        throw new Error("FAIL: tkhd height fixed-point encoding incorrect");
    }

    if (widthFixed !== width << 16) {
        throw new Error("FAIL: tkhd width fixed-point encoding incorrect");
    }

    if (heightFixed !== height << 16) {
        throw new Error("FAIL: tkhd height fixed-point encoding incorrect");
    }

    console.log("PASS: TKHD tests");
}
