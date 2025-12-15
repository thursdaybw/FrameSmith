import { readUint32FromMp4BoxBytes } from "./testUtils.js";
import { readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { buildFtypBox } from "../boxes/ftypBox.js";
import { buildMoovBox } from "../boxes/moovBox.js";
import { buildStcoBox } from "../boxes/stcoBox.js";
import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Validate final MP4 assembly layout:
 *   [ftyp][moov][mdat header][sample data...]
 */
export async function testAssembly() {
    console.log("=== testAssembly ===");

    // -----------------------------
    // Dummy sample payloads
    // -----------------------------
    const samples = [
        new Uint8Array([1,2,3]),
        new Uint8Array([9,9]),
        new Uint8Array([7])
    ];

    const totalData = samples.reduce((a, b) => a + b.length, 0);

    // -----------------------------
    // Build FTYP
    // -----------------------------
    const ftyp = buildFtypBox();

    // -----------------------------
    // First pass:
    // Build moov with placeholder stco (1 byte)
    // This lets us compute the correct final offsets.
    // -----------------------------
    const placeholderStco = buildStcoBox([]);


    const tempMoov = buildMoovBox({
        mvhd: dummy("mvhd"),
        tkhd: dummy("tkhd"),
        mdhd: dummy("mdhd"),
        hdlr: dummy("hdlr"),
        vmhd: dummy("vmhd"),
        dref: dummy("dref"),
        stsd: dummy("stsd"),
        stts: dummy("stts"),
        stsc: dummy("stsc"),
        stsz: dummy("stsz"),
        stco: placeholderStco
    });

    // -----------------------------
    // Compute TEMP dataStart
    // -----------------------------
    const offsetTempMoov = ftyp.length;
    const offsetTempMdat = offsetTempMoov + tempMoov.length;
    const dataStartTemp = offsetTempMdat + 8;

    // -----------------------------
    // Second pass:
    // Compute REAL OFFSETS after final moov is known.
    //
    // To do this correctly:
    //   1. Build final moov using placeholder stco (same as temp)
    //   2. Compute finalDataStart from FINAL moov length
    //   3. Generate correct stco offsets from finalDataStart
    //   4. Rebuild moov using REAL stco
    // -----------------------------
    // 1. Build a temporary moov with REAL stco length but EMPTY offsets.
    //    This gives the true moov byte size that will appear in the file.
    const stcoForLength = buildStcoBox([0,0,0]); // lengths only matter
    const moovForLength = buildMoovBox({
        mvhd: dummy("mvhd"),
        tkhd: dummy("tkhd"),
        mdhd: dummy("mdhd"),
        hdlr: dummy("hdlr"),
        vmhd: dummy("vmhd"),
        dref: dummy("dref"),
        stsd: dummy("stsd"),
        stts: dummy("stts"),
        stsc: dummy("stsc"),
        stsz: dummy("stsz"),
        stco: stcoForLength
    });

    // 2. Now compute finalDataStart using the TRUE moov length:
    const finalOffsetMdat = ftyp.length + moovForLength.length;
    const finalDataStart = finalOffsetMdat + 8;

    // Real stco offsets
    const offsets = [];
    let running = 0;
    for (const s of samples) {
        const off = finalDataStart + running;
        offsets.push(off);
        running += s.length;
    }
    const stco = buildStcoBox(offsets);

    // -----------------------------
    // Third pass:
    // Build TRUE final moov using the REAL stco
    // -----------------------------
    const moov = buildMoovBox({
        mvhd: dummy("mvhd"),
        tkhd: dummy("tkhd"),
        mdhd: dummy("mdhd"),
        hdlr: dummy("hdlr"),
        vmhd: dummy("vmhd"),
        dref: dummy("dref"),
        stsd: dummy("stsd"),
        stts: dummy("stts"),
        stsc: dummy("stsc"),
        stsz: dummy("stsz"),
        stco
    });

    // -----------------------------
    // Build mdat
    // -----------------------------
    const mdatSize = 8 + totalData;
    const mdat = new Uint8Array(mdatSize);
    writeUint32(mdat, 0, mdatSize);
    writeString(mdat, 4, "mdat");

    let ptr = 8;
    for (const s of samples) {
        mdat.set(s, ptr);
        ptr += s.length;
    }

    const full = concat([ftyp, moov, mdat]);

    // -----------------------------
    // TEST 1: box order
    // -----------------------------
    let pos = 0;
    if (readBoxTypeFromMp4BoxBytes(full, pos + 4) !== "ftyp") throw new Error("FAIL: missing ftyp");
    pos += readUint32(full, pos);

    if (readBoxTypeFromMp4BoxBytes(full, pos + 4) !== "moov") throw new Error("FAIL: missing moov");
    pos += readUint32(full, pos);

    if (readBoxTypeFromMp4BoxBytes(full, pos + 4) !== "mdat") throw new Error("FAIL: missing mdat");

    // -----------------------------
    // TEST 2: stco offsets
    // -----------------------------
    for (let i = 0; i < offsets.length; i++) {
        const expected = finalDataStart +
            samples.slice(0, i).reduce((a, b) => a + b.length, 0);

        if (offsets[i] !== expected) {
            throw new Error("FAIL: incorrect stco offset at index " + i);
        }
    }

    // -----------------------------
    // TEST 3: sample bytes
    // -----------------------------
    let checkPtr = finalDataStart;
    console.log("DEBUG checkingStart =", finalDataStart);
    for (const s of samples) {
        for (let b of s) {
            if (full[checkPtr++] !== b) {
                throw new Error("FAIL: sample data mismatch");
            }
        }
    }

    console.log("PASS: assembly test");
}

// -----------------------------
// Helpers
// -----------------------------
function dummy(type) {
    const payload = new Uint8Array(4);  // minimum payload
    const out = new Uint8Array(8 + payload.length);
    writeUint32(out, 0, 8 + payload.length);
    writeString(out, 4, type);
    out.set(payload, 8);
    writeString(out, 4, type);
    return out;
}

function concat(arrays) {
    let total = arrays.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const a of arrays) {
        out.set(a, p);
        p += a.length;
    }
    return out;
}
