import { readUint32 } from "./testUtils.js";
import { readType } from "./testUtils.js";
import { buildFtypBox } from "../boxes/ftypBox.js";

export async function testFtyp() {
    console.log("=== testFtyp ===");

    const ftyp = buildFtypBox();

    // ---- TEST 1: header ----------------------------------------------------
    const size = readUint32(ftyp, 0);
    if (size !== ftyp.length) {
        throw new Error("FAIL: ftyp size field incorrect");
    }

    if (readType(ftyp, 4) !== "ftyp") {
        throw new Error("FAIL: ftyp type incorrect");
    }

    // ---- TEST 2: major_brand ------------------------------------------------
    const major = readType(ftyp, 8);
    if (major !== "isom") {
        throw new Error("FAIL: ftyp major_brand must be 'isom'");
    }

    // ---- TEST 3: minor_version ---------------------------------------------
    const minor = readUint32(ftyp, 12);
    if (minor !== 0) {
        throw new Error("FAIL: ftyp minor_version must be 0");
    }

    // ---- TEST 4: compatible_brands -----------------------------------------
    const brand1 = readType(ftyp, 16);
    const brand2 = readType(ftyp, 20);
    const brand3 = readType(ftyp, 24);
    const brand4 = readType(ftyp, 28);

    if (brand1 !== "isom") {
        throw new Error("FAIL: ftyp compatible_brands[0] must be 'isom'");
    }
    if (brand2 !== "iso2") {
        throw new Error("FAIL: ftyp compatible_brands[1] must be 'iso2'");
    }
    if (brand3 !== "avc1") {
        throw new Error("FAIL: ftyp compatible_brands[2] must be 'avc1'");
    }
    if (brand4 !== "mp41") {
        throw new Error("FAIL: ftyp compatible_brands[3] must be 'mp41'");
    }

    console.log("PASS: ftyp tests");
}
