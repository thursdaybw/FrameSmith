import { readUint32 } from "./testUtils.js";
import { buildMvhdBox } from "../boxes/mvhdBox.js";

export async function testMvhd() {
    console.log("=== testMvhd ===");

    const timescale = 90000;
    const duration  = 90000 * 12; // 12 seconds

    const mvhd = buildMvhdBox({
        timescale,
        duration,
        nextTrackId: 2
    });

    // ---- TEST 1: header ------------------------------------------------
    const size = readUint32(mvhd, 0);
    if (size !== mvhd.length) {
        throw new Error("FAIL: mvhd size field does not match length");
    }

    const type = String.fromCharCode(
        mvhd[4], mvhd[5], mvhd[6], mvhd[7]
    );
    if (type !== "mvhd") {
        throw new Error("FAIL: mvhd type incorrect");
    }

    // ---- TEST 2: version + flags ---------------------------------------
    if (mvhd[8] !== 0) {
        throw new Error("FAIL: mvhd version must be 0");
    }
    if (mvhd[9] !== 0 || mvhd[10] !== 0 || mvhd[11] !== 0) {
        throw new Error("FAIL: mvhd flags must be zero");
    }

    // ---- TEST 3: creation_time / modification_time ---------------------
    if (readUint32(mvhd, 12) !== 0 || readUint32(mvhd, 16) !== 0) {
        throw new Error("FAIL: mvhd creation/modification times must be zero");
    }

    // ---- TEST 4: timescale ---------------------------------------------
    if (readUint32(mvhd, 20) !== timescale) {
        throw new Error("FAIL: mvhd timescale incorrect");
    }

    // ---- TEST 5: duration -----------------------------------------------
    if (readUint32(mvhd, 24) !== duration) {
        throw new Error("FAIL: mvhd duration incorrect");
    }

    // ---- TEST 6: preferred rate (16.16 fixed) ---------------------------
    if (readUint32(mvhd, 28) !== 0x00010000) {
        throw new Error("FAIL: mvhd preferred rate must be 1.0 in 16.16");
    }

    // ---- TEST 7: preferred volume (8.8 fixed → 0 for video-only) -------
    const volume = (mvhd[32] << 8) | mvhd[33];
    if (volume !== 0) {
        throw new Error("FAIL: mvhd preferred volume must be 0 for video");
    }

    // ---- TEST 8: matrix (identity) -------------------------------------
    const one = 0x00010000;
    const matrixOffsets = [36, 40, 44, 48, 52, 56, 60, 64, 68];

    // Only 0 or identity constants may appear
    const expectedMatrix = [
        one, 0,   0,
        0,   one, 0,
        0,   0,   one
    ];

    for (let i = 0; i < expectedMatrix.length; i++) {
        const actual = readUint32(mvhd, matrixOffsets[i]);
        const exp = expectedMatrix[i];
        if (actual !== exp) {
            throw new Error(`FAIL: mvhd matrix element ${i} incorrect`);
        }
    }

    // ---- TEST 9: next_track_ID -----------------------------------------
    if (readUint32(mvhd, 108) !== 2) {
        throw new Error("FAIL: mvhd next_track_ID incorrect");
    }

    console.log("PASS: MVHD tests");
}

