import { buildMdhdBox } from "../boxes/mdhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32FromMp4BoxBytes, readUint16FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testMdhd_Structure() {
    console.log("=== mdhd Granular structural tests ===");

    const timescale = 90000;
    const duration  = 90000 * 5;

    const box = serializeBoxTree(
        buildMdhdBox({ timescale, duration })
    );

    // ---------------------------------------------------------
    // FIELD 1: size
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.size",
        readUint32FromMp4BoxBytes(box, 0),
        box.length
    );

    // ---------------------------------------------------------
    // FIELD 2: type
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "mdhd"
    );

    // ---------------------------------------------------------
    // FIELD 3: version
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.version",
        box[8],
        0
    );

    // ---------------------------------------------------------
    // FIELD 4: flags
    // ---------------------------------------------------------
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    assertEqual(
        "mdhd.flags",
        flags,
        0
    );

    // ---------------------------------------------------------
    // FIELD 5: creation_time
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.creation_time",
        readUint32FromMp4BoxBytes(box, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.modification_time",
        readUint32FromMp4BoxBytes(box, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: timescale
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.timescale",
        readUint32FromMp4BoxBytes(box, 20),
        timescale
    );

    // ---------------------------------------------------------
    // FIELD 8: duration
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.duration",
        readUint32FromMp4BoxBytes(box, 24),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 9: language
    // ---------------------------------------------------------
    const expectedLanguage = 0x55c4; // "und"

    assertEqual(
        "mdhd.language",
        readUint16FromMp4BoxBytes(box, 28),
        expectedLanguage
    );

    // ---------------------------------------------------------
    // FIELD 10: predefined
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.predefined",
        readUint16FromMp4BoxBytes(box, 30),
        0
    );

    console.log("PASS: mdhd granular structural tests");
}

export async function testMdhd_Conformance() {
    console.log("=== testMdhd_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const refMdhd = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "mdhd"]
    );

    if (!refMdhd) {
        throw new Error("FAIL: mdhd box not found in golden MP4");
    }

    const ref = parseMdhd(refMdhd);

    const outRaw = serializeBoxTree(
        buildMdhdBox({
            timescale: ref.timescale,
            duration:  ref.duration
        })
    );

    const out = parseMdhd(outRaw);

    // ---------------------------------------------------------
    // Field-level conformance
    // ---------------------------------------------------------
    assertEqual("mdhd.version",   out.version,   ref.version);
    assertEqual("mdhd.flags",     out.flags,     ref.flags);
    assertEqual("mdhd.timescale", out.timescale, ref.timescale);
    assertEqual("mdhd.duration",  out.duration,  ref.duration);
    assertEqual("mdhd.language",  out.language,  ref.language);

    // ---------------------------------------------------------
    // Byte-for-byte conformance
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `mdhd.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: mdhd matches golden MP4 byte-for-byte");
}

// ---------------------------------------------------------------------------
// Helper: parse mdhd into field-level representation
// ---------------------------------------------------------------------------

function parseMdhd(box) {
    return {
        type: readBoxTypeFromMp4BoxBytes(box, 4),
        version: box[8],
        flags:
            (box[9] << 16) |
            (box[10] << 8) |
            box[11],

        timescale: readUint32FromMp4BoxBytes(box, 20),
        duration:  readUint32FromMp4BoxBytes(box, 24),
        language:  readUint16FromMp4BoxBytes(box, 28),

        raw: box
    };
}

