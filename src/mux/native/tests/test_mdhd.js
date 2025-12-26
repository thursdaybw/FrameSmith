import { emitMdhdBox } from "../box-emitters/mdhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readUint16, readFourCC } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testMdhd_Structure() {
    console.log("=== mdhd Granular structural tests ===");

    const timescale = 90000;
    const duration  = 90000 * 5;

    const box = serializeBoxTree(
        emitMdhdBox({ timescale, duration })
    );

    // ---------------------------------------------------------
    // FIELD 1: size
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.size",
        readUint32(box, 0),
        box.length
    );

    // ---------------------------------------------------------
    // FIELD 2: type
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.type",
        readFourCC(box, 4),
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
        readUint32(box, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.modification_time",
        readUint32(box, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: timescale
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.timescale",
        readUint32(box, 20),
        timescale
    );

    // ---------------------------------------------------------
    // FIELD 8: duration
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.duration",
        readUint32(box, 24),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 9: language
    // ---------------------------------------------------------
    const expectedLanguage = 0x55c4; // "und"

    assertEqual(
        "mdhd.language",
        readUint16(box, 28),
        expectedLanguage
    );

    // ---------------------------------------------------------
    // FIELD 10: predefined
    // ---------------------------------------------------------
    assertEqual(
        "mdhd.predefined",
        readUint16(box, 30),
        0
    );

    console.log("PASS: mdhd granular structural tests");
}


export async function testMdhd_Conformance() {
    console.log("=== testMdhd_Conformance (golden MP4) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference MDHD via parser registry
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/mdhd"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild MDHD via Framesmith
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitMdhdBox(params)
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt MDHD via same parser
    // -------------------------------------------------------------
    const outFields = getGoldenTruthBox.fromBox(
        outBytes,
        "moov/trak/mdia/mdhd"
    ).readFields();

    // -------------------------------------------------------------
    // 5. Field-level conformance
    // -------------------------------------------------------------
    assertEqual("mdhd.version",   outFields.version,   refFields.version);
    assertEqual("mdhd.flags",     outFields.flags,     refFields.flags);
    assertEqual("mdhd.timescale", outFields.timescale, refFields.timescale);
    assertEqual("mdhd.duration",  outFields.duration,  refFields.duration);
    assertEqual("mdhd.language",  outFields.language,  refFields.language);

    // -------------------------------------------------------------
    // 6. Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "mdhd.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `mdhd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: mdhd matches golden MP4 byte-for-byte");
}

