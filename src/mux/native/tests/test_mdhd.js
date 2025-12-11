import { buildMdhdBox } from "../boxes/mdhdBox.js";
import { readUint32, readUint16, readType } from "./testUtils.js";

export async function testMdhd() {
    console.log("=== testMdhd ===");

    const timescale = 90000;
    const duration = 90000 * 5; // 5 seconds

    const mdhd = buildMdhdBox({ timescale, duration });

    // ---- TEST 1: header -------------------------------------------------
    const size = readUint32(mdhd, 0);
    if (size !== mdhd.length) {
        throw new Error("FAIL: mdhd size field does not match array length");
    }

    if (readType(mdhd, 4) !== "mdhd") {
        throw new Error("FAIL: mdhd type field incorrect");
    }

    // ---- TEST 2: version + flags (bytes 8–11) ---------------------------
    if (mdhd[8] !== 0) throw new Error("FAIL: mdhd version must be 0");
    if (mdhd[9] !== 0 || mdhd[10] !== 0 || mdhd[11] !== 0) {
        throw new Error("FAIL: mdhd flags must be zero");
    }

    // ---- TEST 3: creation + modification time ---------------------------
    // bytes 12–15 and 16–19 should be zero
    if (readUint32(mdhd, 12) !== 0 || readUint32(mdhd, 16) !== 0) {
        throw new Error("FAIL: mdhd creation/modification time must be zero");
    }

    // ---- TEST 4: timescale + duration -----------------------------------
    const ts = readUint32(mdhd, 20);
    const dur = readUint32(mdhd, 24);

    if (ts !== timescale) {
        throw new Error("FAIL: mdhd timescale incorrect");
    }
    if (dur !== duration) {
        throw new Error("FAIL: mdhd duration incorrect");
    }

    // ---- TEST 5: language + predefined ----------------------------------
    // language at bytes 28–29
    // expected default = 0x55C4 ('und' per ISO-639-2)
    const lang = readUint16(mdhd, 28);
    if (lang !== 0x55c4) {
        throw new Error("FAIL: mdhd language field incorrect");
    }

    const predefined = readUint16(mdhd, 30);
    if (predefined !== 0) {
        throw new Error("FAIL: mdhd predefined field must be zero");
    }

    console.log("PASS: MDHD tests");
}
