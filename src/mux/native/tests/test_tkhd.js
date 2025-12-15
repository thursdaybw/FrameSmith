import { buildTkhdBox } from "../boxes/tkhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testTkhd_Structure() {
    console.log("=== tkhd Granular structural tests ===");

    const width    = 1920;
    const height   = 1080;
    const duration = 90000 * 10;
    const trackId  = 1;

    const box = serializeBoxTree(
        buildTkhdBox({ width, height, duration, trackId })
    );

    // ---------------------------------------------------------
    // FIELD 1: total box size
    // ---------------------------------------------------------
    const expectedSize = box.length;
    assertEqual(
        "tkhd.size",
        readUint32FromMp4BoxBytes(box, 0),
        expectedSize
    );

    // ---------------------------------------------------------
    // FIELD 2: box type
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
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
        readUint32FromMp4BoxBytes(box, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.modification_time",
        readUint32FromMp4BoxBytes(box, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: track_id
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.track_id",
        readUint32FromMp4BoxBytes(box, 20),
        trackId
    );

    // ---------------------------------------------------------
    // FIELD 8: reserved (post track_id)
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.reserved.post_track_id",
        readUint32FromMp4BoxBytes(box, 24),
        0
    );

    // ---------------------------------------------------------
    // FIELD 9: duration
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.duration",
        readUint32FromMp4BoxBytes(box, 28),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 10: reserved[2]
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.reserved[0]",
        readUint32FromMp4BoxBytes(box, 32),
        0
    );

    assertEqual(
        "tkhd.reserved[1]",
        readUint32FromMp4BoxBytes(box, 36),
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
            readUint32FromMp4BoxBytes(box, 48 + i * 4),
            expectedMatrix[i]
        );
    }

    // ---------------------------------------------------------
    // FIELD 16: width (16.16 fixed)
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.width_fixed",
        readUint32FromMp4BoxBytes(box, 84),
        width << 16
    );

    // ---------------------------------------------------------
    // FIELD 17: height (16.16 fixed)
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.height_fixed",
        readUint32FromMp4BoxBytes(box, 88),
        height << 16
    );

    console.log("PASS: tkhd granular structural tests");
}

export async function testTkhd_Conformance() {
    console.log("=== testTkhd_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const refTkhd = extractBoxByPath(
        buf,
        ["moov", "trak", "tkhd"]
    );

    if (!refTkhd) {
        throw new Error("FAIL: tkhd box not found in golden MP4");
    }

    const ref = parseTkhd(refTkhd);

    const outRaw = serializeBoxTree(
        buildTkhdBox({
            trackId:  ref.trackId,
            duration: ref.duration,
            width:    ref.width  >> 16,
            height:   ref.height >> 16
        })
    );

    const out = parseTkhd(outRaw);

    // ---------------------------------------------------------
    // Field-level conformance
    // ---------------------------------------------------------
    assertEqual("tkhd.version", out.version, ref.version);
    assertEqual("tkhd.flags", out.flags, ref.flags);
    assertEqual("tkhd.track_id", out.trackId, ref.trackId);
    assertEqual("tkhd.duration", out.duration, ref.duration);
    assertEqual("tkhd.width_fixed", out.width, ref.width);
    assertEqual("tkhd.height_fixed", out.height, ref.height);

    // ---------------------------------------------------------
    // Byte-for-byte conformance
    // ---------------------------------------------------------
    assertEqual(
        "tkhd.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `tkhd.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: tkhd matches golden MP4 byte-for-byte");
}

function parseTkhd(box) {
    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    return {
        type: readBoxTypeFromMp4BoxBytes(box, 4),
        version,
        flags,
        trackId: readUint32FromMp4BoxBytes(box, 20),
        duration: readUint32FromMp4BoxBytes(box, 28),
        width: readUint32FromMp4BoxBytes(box, 84),
        height: readUint32FromMp4BoxBytes(box, 88),
        raw: box
    };
}

