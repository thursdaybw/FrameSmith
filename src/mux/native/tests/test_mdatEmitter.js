import { emitMdatBytes } from "../box-emitters/mdatEmitter.js";

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function testMdatEmitter() {

    console.log("=== testMdatEmitter ===");

    // ---- TEST 1: no samples ---------------------------------------
    let mdat = emitMdatBytes([]);

    if (mdat.length !== 8) {
        throw new Error("FAIL: mdat with no samples should be 8 bytes long");
    }

    if (String.fromCharCode(...mdat.slice(4, 8)) !== "mdat") {
        throw new Error("FAIL: mdat header incorrect for empty payload");
    }

    // ---- TEST 2: single sample ------------------------------------
    const s1 = { data: new Uint8Array([10, 20, 30]) };
    mdat = emitMdatBytes([s1]);

    const expectedSize2 = 8 + 3;
    const size2 =
        (mdat[0] << 24) |
        (mdat[1] << 16) |
        (mdat[2] << 8) |
        (mdat[3]);

    if (size2 !== expectedSize2) {
        throw new Error("FAIL: incorrect mdat size for single sample");
    }

    if (!arraysEqual(mdat.slice(8), s1.data)) {
        throw new Error("FAIL: payload for single sample does not match input");
    }

    // ---- TEST 3: multiple samples ---------------------------------
    const sA = { data: new Uint8Array([1, 2]) };
    const sB = { data: new Uint8Array([9, 9, 9]) };
    const sC = { data: new Uint8Array([7]) };

    mdat = emitMdatBytes([sA, sB, sC]);

    const payload = mdat.slice(8);
    const expectedPayload = new Uint8Array([1, 2, 9, 9, 9, 7]);

    if (!arraysEqual(payload, expectedPayload)) {
        throw new Error("FAIL: multi-sample mdat payload incorrect");
    }

    const expectedSize3 = 8 + expectedPayload.length;
    const size3 =
        (mdat[0] << 24) |
        (mdat[1] << 16) |
        (mdat[2] << 8) |
        (mdat[3]);

    if (size3 !== expectedSize3) {
        throw new Error("FAIL: incorrect mdat size for multiple samples");
    }

    // ---- TEST 4: input mutation does NOT affect output -------------
    const original = new Uint8Array([5, 6, 7]);
    const sOrig = { data: original };

    const mdatBefore = emitMdatBytes([sOrig]);
    original[0] = 99;

    if (mdatBefore[8] !== 5) {
        throw new Error("FAIL: emitMdatBytes must not read mutated input data");
    }

    console.log("PASS: mdat emitter tests");
}
