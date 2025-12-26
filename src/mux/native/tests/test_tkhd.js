import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { splitFixed1616 } from "../bytes/mp4NumericFormats.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testTkhd_Structure() {
    console.log("=== tkhd Granular structural tests ===");

    const width    = 1920;
    const height   = 1080;
    const duration = 90000 * 10;
    const trackId  = 1;

    // Explicit fractional components (synthetic intent)
    const widthFraction  = 0;
    const heightFraction = 0;

    const box = serializeBoxTree(
        emitTkhdBox({
            width,
            height,
            widthFraction,
            heightFraction,
            duration,
            trackId
        })
    );

    // ---------------------------------------------------------
    // FIELD 1: total box size
    // ---------------------------------------------------------
    const expectedSize = box.length;
    assertEqual(
        "tkhd.size",
        readUint32(box, 0),
        expectedSize
    );

    // ---------------------------------------------------------
    // FIELD 2: box type
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.type",
        readFourCC(box, 4),
        "tkhd"
    );

    // ---------------------------------------------------------
    // FIELD 3: version
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.version",
        box[8],
        0
    );

    // ---------------------------------------------------------
    // FIELD 4: flags (semantic)
    // ---------------------------------------------------------
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const actualFlags = {
        enabled:   (flags & 0x000001) !== 0,
        inMovie:   (flags & 0x000002) !== 0,
        inPreview: (flags & 0x000004) !== 0,
    };

    const expectedFlags = {
        enabled:   true,
        inMovie:   true,
        inPreview: false,
    };

    for (const name of Object.keys(expectedFlags)) {
        assertEqual(
            `tkhd.flag.${name}`,
            actualFlags[name],
            expectedFlags[name]
        );
    }

    // ---------------------------------------------------------
    // FIELD 5: creation_time
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.creation_time",
        readUint32(box, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.modification_time",
        readUint32(box, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: track_id
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.track_id",
        readUint32(box, 20),
        trackId
    );

    // ---------------------------------------------------------
    // FIELD 8: reserved (post track_id)
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.reserved.post_track_id",
        readUint32(box, 24),
        0
    );

    // ---------------------------------------------------------
    // FIELD 9: duration
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.duration",
        readUint32(box, 28),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 10: reserved[2]
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.reserved[0]",
        readUint32(box, 32),
        0
    );

    assertEqual(
        "tkhd.reserved[1]",
        readUint32(box, 36),
        0
    );

    // ---------------------------------------------------------
    // FIELD 11: layer
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.layer",
        (box[40] << 8) | box[41],
        0
    );

    // ---------------------------------------------------------
    // FIELD 12: alternate_group
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.alternate_group",
        (box[42] << 8) | box[43],
        0
    );

    // ---------------------------------------------------------
    // FIELD 13: volume
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.volume",
        (box[44] << 8) | box[45],
        0
    );

    // ---------------------------------------------------------
    // FIELD 14: reserved (post volume)
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.reserved.post_volume",
        (box[46] << 8) | box[47],
        0
    );

    // ---------------------------------------------------------
    // FIELD 15: matrix (unity)
    // ---------------------------------------------------------
    const expectedMatrix = [
        0x00010000, 0, 0,
        0, 0x00010000, 0,
        0, 0, 0x40000000
    ];

    for (let i = 0; i < 9; i++) {
        assertEqual(
            `tkhd.matrix[${i}]`,
            readUint32(box, 48 + i * 4),
            expectedMatrix[i]
        );
    }

    // ---------------------------------------------------------
    // FIELD 16: width (16.16 fixed)
    // ---------------------------------------------------------
    const widthFixed = readUint32(box, 84);

    assertEqual(
        "tkhd.width.integer",
        widthFixed >>> 16,
        width
    );

    assertEqual(
        "tkhd.width.fraction",
        widthFixed & 0xFFFF,
        widthFraction
    );

    // ---------------------------------------------------------
    // FIELD 17: height (16.16 fixed)
    // ---------------------------------------------------------
    const heightFixed = readUint32(box, 88);

    assertEqual(
        "tkhd.height.integer",
        heightFixed >>> 16,
        height
    );

    assertEqual(
        "tkhd.height.fraction",
        heightFixed & 0xFFFF,
        heightFraction
    );

    console.log("PASS: tkhd granular structural tests");
}

export async function testTkhd_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testTkhd_LockedLayoutEquivalence_ffmpeg(golden MP4) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference TKHD via parser registry
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/tkhd"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild TKHD via Framesmith
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitTkhdBox(params)
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt TKHD via same parser
    // -------------------------------------------------------------
    const outFields = getGoldenTruthBox.fromBox(
        outBytes,
        "moov/trak/tkhd"
    ).readFields();

    // -------------------------------------------------------------
    // 5. Field-level conformance (semantic gate)
    // -------------------------------------------------------------
    assertEqual("tkhd.version", outFields.version, refFields.version);
    assertEqual("tkhd.flags", outFields.flags, refFields.flags);
    assertEqual("tkhd.track_id", outFields.trackId, refFields.trackId);
    assertEqual("tkhd.duration", outFields.duration, refFields.duration);

    const refWidth  = splitFixed1616(refFields.widthFixed);
    const outWidth  = splitFixed1616(outFields.widthFixed);

    const refHeight = splitFixed1616(refFields.heightFixed);
    const outHeight = splitFixed1616(outFields.heightFixed);

    // Integer pixel semantics
    assertEqual(
        "tkhd.width.integer_pixels",
        outWidth.integer,
        refWidth.integer
    );

    assertEqual(
        "tkhd.height.integer_pixels",
        outHeight.integer,
        refHeight.integer
    );

    // Fractional pixel encoding (explicitly asserted)
    assertEqual(
        "tkhd.width.fractional_pixels",
        outWidth.fraction,
        refWidth.fraction
    );

    assertEqual(
        "tkhd.height.fractional_pixels",
        outHeight.fraction,
        refHeight.fraction
    );

    // -------------------------------------------------------------
    // 6. Byte-for-byte conformance (safety net)
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "tkhd.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `tkhd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: tkhd matches golden MP4 byte-for-byte");
}
