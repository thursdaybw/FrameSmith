import { readUint32 } from "./testUtils.js";
import { readType } from "./testUtils.js";
import { buildMoovBox } from "../boxes/moovBox.js";

// Create minimal placeholder boxes.
// They behave like real MP4 boxes: [size(4 bytes), type(4 bytes), payload].
function dummyBox(type, payloadSize = 0) {
    const size = 8 + payloadSize;
    const out = new Uint8Array(size);
    out[0] = (size >>> 24) & 0xFF;
    out[1] = (size >>> 16) & 0xFF;
    out[2] = (size >>>  8) & 0xFF;
    out[3] = (size       ) & 0xFF;

    out[4] = type.charCodeAt(0);
    out[5] = type.charCodeAt(1);
    out[6] = type.charCodeAt(2);
    out[7] = type.charCodeAt(3);

    return out;
}

export async function testMoov() {
    console.log("=== testMoov ===");

    // --- Construct dummy children for structure-only testing --------------
    const mvhd = dummyBox("mvhd", 16);
    const tkhd = dummyBox("tkhd", 16);
    const mdhd = dummyBox("mdhd", 16);
    const hdlr = dummyBox("hdlr", 16);
    const vmhd = dummyBox("vmhd", 16);
    const dref = dummyBox("dref", 16);
    const stsd = dummyBox("stsd", 16);
    const stts = dummyBox("stts", 16);
    const stsc = dummyBox("stsc", 16);
    const stsz = dummyBox("stsz", 16);
    const stco = dummyBox("stco", 16);

    // --- Build moov using the main builder --------------------------------
    const moov = buildMoovBox({
        mvhd,
        tkhd,
        mdhd,
        hdlr,
        vmhd,
        dref,
        stsd,
        stts,
        stsc,
        stsz,
        stco,
    });

    // --- Test 1: moov header ------------------------------------------------
    const moovSize = readUint32(moov, 0);
    if (moovSize !== moov.length) {
        throw new Error("FAIL: moov size field incorrect");
    }
    if (readType(moov, 4) !== "moov") {
        throw new Error("FAIL: moov type incorrect");
    }

    // Expected hierarchy:
    //
    // moov
    //   mvhd
    //   trak
    //     tkhd
    //     mdia
    //       mdhd
    //       hdlr
    //       minf
    //         vmhd
    //         dinf
    //           dref
    //         stbl
    //           stsd
    //           stts
    //           stsc
    //           stsz
    //           stco

    // --- Step 1: mvhd -------------------------------------------------------
    let offset = 8; // moov header ends at 8
    if (readType(moov, offset + 4) !== "mvhd") {
        throw new Error("FAIL: mvhd missing or incorrect position");
    }
    offset += readUint32(moov, offset);

    // --- Step 2: trak --------------------------------------------------------
    if (readType(moov, offset + 4) !== "trak") {
        throw new Error("FAIL: trak missing or incorrect position");
    }
    const trakSize = readUint32(moov, offset);
    const trakStart = offset;
    offset = trakStart + 8;

    // --- Step 3: tkhd --------------------------------------------------------
    if (readType(moov, offset + 4) !== "tkhd") {
        throw new Error("FAIL: tkhd missing inside trak");
    }
    offset += readUint32(moov, offset);

    // --- Step 4: mdia --------------------------------------------------------
    if (readType(moov, offset + 4) !== "mdia") {
        throw new Error("FAIL: mdia missing inside trak");
    }
    const mdiaSize = readUint32(moov, offset);
    const mdiaStart = offset;
    offset = mdiaStart + 8;

    // --- Step 5: mdhd --------------------------------------------------------
    if (readType(moov, offset + 4) !== "mdhd") {
        throw new Error("FAIL: mdhd missing inside mdia");
    }
    offset += readUint32(moov, offset);

    // --- Step 6: hdlr --------------------------------------------------------
    if (readType(moov, offset + 4) !== "hdlr") {
        throw new Error("FAIL: hdlr missing inside mdia");
    }
    offset += readUint32(moov, offset);

    // --- Step 7: minf --------------------------------------------------------
    if (readType(moov, offset + 4) !== "minf") {
        throw new Error("FAIL: minf missing inside mdia");
    }
    const minfSize = readUint32(moov, offset);
    const minfStart = offset;
    offset = minfStart + 8;

    // --- Step 8: vmhd --------------------------------------------------------
    if (readType(moov, offset + 4) !== "vmhd") {
        throw new Error("FAIL: vmhd missing inside minf");
    }
    offset += readUint32(moov, offset);

    // --- Step 9: dinf --------------------------------------------------------
    if (readType(moov, offset + 4) !== "dinf") {
        throw new Error("FAIL: dinf missing inside minf");
    }
    const dinfSize = readUint32(moov, offset);
    const dinfStart = offset;
    offset = dinfStart + 8;

    // dref inside dinf
    if (readType(moov, offset + 4) !== "dref") {
        throw new Error("FAIL: dref missing inside dinf");
    }
    offset = dinfStart + dinfSize;

    // --- Step 10: stbl -------------------------------------------------------
    if (readType(moov, offset + 4) !== "stbl") {
        throw new Error("FAIL: stbl missing inside minf");
    }
    const stblSize = readUint32(moov, offset);
    const stblStart = offset;
    offset = stblStart + 8;

    // stbl children in correct order
    const expectedStbl = ["stsd", "stts", "stsc", "stsz", "stco"];
    for (let type of expectedStbl) {
        if (readType(moov, offset + 4) !== type) {
            throw new Error(`FAIL: expected ${type} inside stbl`);
        }
        offset += readUint32(moov, offset);
    }

    console.log("PASS: moov assembly tests");
}
