import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { readUint32, readUint16, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testMvhd_Structure() {
    console.log("=== mvhd Granular structural tests ===");

    const timescale   = 90000;
    const duration    = 90000 * 12;
    const nextTrackId = 2;

    const mvhd = serializeBoxTree(
        emitMvhdBox({ timescale, duration, nextTrackId })
    );

    // ---------------------------------------------------------
    // FIELD 1: size
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.size",
        readUint32(mvhd, 0),
        mvhd.length
    );

    // ---------------------------------------------------------
    // FIELD 2: type
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.type",
        readFourCC(mvhd, 4),
        "mvhd"
    );

    // ---------------------------------------------------------
    // FIELD 3: version
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.version",
        mvhd[8],
        0
    );

    // ---------------------------------------------------------
    // FIELD 4: flags
    // ---------------------------------------------------------
    const flags =
        (mvhd[9] << 16) |
        (mvhd[10] << 8) |
        mvhd[11];

    assertEqual(
        "mvhd.flags",
        flags,
        0
    );

    // ---------------------------------------------------------
    // FIELD 5: creation_time
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.creation_time",
        readUint32(mvhd, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.modification_time",
        readUint32(mvhd, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: timescale
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.timescale",
        readUint32(mvhd, 20),
        timescale
    );

    // ---------------------------------------------------------
    // FIELD 8: duration
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.duration",
        readUint32(mvhd, 24),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 9: rate (16.16)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.rate",
        readUint32(mvhd, 28),
        0x00010000
    );

    // ---------------------------------------------------------
    // FIELD 10: volume (8.8)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.volume",
        readUint16(mvhd, 32),
        0x0100
    );

    // ---------------------------------------------------------
    // FIELD 11: reserved (uint16)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.reserved.short",
        readUint16(mvhd, 34),
        0
    );

    // ---------------------------------------------------------
    // FIELD 12: reserved (uint32 × 2)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.reserved[0]",
        readUint32(mvhd, 36),
        0
    );

    assertEqual(
        "mvhd.reserved[1]",
        readUint32(mvhd, 40),
        0
    );

    // ---------------------------------------------------------
    // FIELD 13: matrix
    // ---------------------------------------------------------
    const expectedMatrix = [
        0x00010000, 0, 0,
        0, 0x00010000, 0,
        0, 0, 0x40000000
    ];

    for (let i = 0; i < 9; i++) {
        assertEqual(
            `mvhd.matrix[${i}]`,
            readUint32(mvhd, 44 + i * 4),
            expectedMatrix[i]
        );
    }

    // ---------------------------------------------------------
    // FIELD 14: pre_defined (uint32 × 6)
    // ---------------------------------------------------------
    for (let i = 0; i < 6; i++) {
        assertEqual(
            `mvhd.pre_defined[${i}]`,
            readUint32(mvhd, 80 + i * 4),
            0
        );
    }

    // ---------------------------------------------------------
    // FIELD 15: next_track_ID
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.next_track_ID",
        readUint32(mvhd, 104),
        nextTrackId
    );

    console.log("PASS: mvhd granular structural tests");
}

export async function testMvhd_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testMvhd_LockedLayoutEquivalence_ffmpeg (golden MP4) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference MVHD via parser registry
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/mvhd"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild MVHD via Framesmith
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitMvhdBox(params)
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt MVHD via same parser
    // -------------------------------------------------------------
    const outFields = getGoldenTruthBox.fromBox(
        outBytes,
        "moov/mvhd"
    ).readFields();

    // -------------------------------------------------------------
    // 5. Field-level equivalence (semantic gate)
    // -------------------------------------------------------------
    assertEqual("mvhd.version",     outFields.version,     refFields.version);
    assertEqual("mvhd.flags",       outFields.flags,       refFields.flags);
    assertEqual("mvhd.timescale",   outFields.timescale,   refFields.timescale);
    assertEqual("mvhd.duration",    outFields.duration,    refFields.duration);
    assertEqual("mvhd.nextTrackId", outFields.nextTrackId, refFields.nextTrackId);
    assertEqual("mvhd.volume",      outFields.volume,      refFields.volume);
    assertEqual("mvhd.rate",        outFields.rate,        refFields.rate);

    // -------------------------------------------------------------
    // 6. Byte-for-byte equivalence
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "mvhd.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `mvhd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: mvhd matches golden MP4 byte-for-byte");
}
