import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildMvhdBox } from "../boxes/mvhdBox.js";
import { readUint32FromMp4BoxBytes, readUint16FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testMvhd_Structure() {
    console.log("=== mvhd Granular structural tests ===");

    const timescale   = 90000;
    const duration    = 90000 * 12;
    const nextTrackId = 2;

    const mvhd = serializeBoxTree(
        buildMvhdBox({ timescale, duration, nextTrackId })
    );

    // ---------------------------------------------------------
    // FIELD 1: size
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.size",
        readUint32FromMp4BoxBytes(mvhd, 0),
        mvhd.length
    );

    // ---------------------------------------------------------
    // FIELD 2: type
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.type",
        readBoxTypeFromMp4BoxBytes(mvhd, 4),
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
        readUint32FromMp4BoxBytes(mvhd, 12),
        0
    );

    // ---------------------------------------------------------
    // FIELD 6: modification_time
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.modification_time",
        readUint32FromMp4BoxBytes(mvhd, 16),
        0
    );

    // ---------------------------------------------------------
    // FIELD 7: timescale
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.timescale",
        readUint32FromMp4BoxBytes(mvhd, 20),
        timescale
    );

    // ---------------------------------------------------------
    // FIELD 8: duration
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.duration",
        readUint32FromMp4BoxBytes(mvhd, 24),
        duration
    );

    // ---------------------------------------------------------
    // FIELD 9: rate (16.16)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.rate",
        readUint32FromMp4BoxBytes(mvhd, 28),
        0x00010000
    );

    // ---------------------------------------------------------
    // FIELD 10: volume (8.8)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.volume",
        readUint16FromMp4BoxBytes(mvhd, 32),
        0x0100
    );

    // ---------------------------------------------------------
    // FIELD 11: reserved (uint16)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.reserved.short",
        readUint16FromMp4BoxBytes(mvhd, 34),
        0
    );

    // ---------------------------------------------------------
    // FIELD 12: reserved (uint32 × 2)
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.reserved[0]",
        readUint32FromMp4BoxBytes(mvhd, 36),
        0
    );

    assertEqual(
        "mvhd.reserved[1]",
        readUint32FromMp4BoxBytes(mvhd, 40),
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
            readUint32FromMp4BoxBytes(mvhd, 44 + i * 4),
            expectedMatrix[i]
        );
    }

    // ---------------------------------------------------------
    // FIELD 14: pre_defined (uint32 × 6)
    // ---------------------------------------------------------
    for (let i = 0; i < 6; i++) {
        assertEqual(
            `mvhd.pre_defined[${i}]`,
            readUint32FromMp4BoxBytes(mvhd, 80 + i * 4),
            0
        );
    }

    // ---------------------------------------------------------
    // FIELD 15: next_track_ID
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.next_track_ID",
        readUint32FromMp4BoxBytes(mvhd, 104),
        nextTrackId
    );

    console.log("PASS: mvhd granular structural tests");
}

export async function testMvhd_Conformance() {
    console.log("=== testMvhd_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const refRaw = extractBoxByPath(buf, ["moov", "mvhd"]);
    if (!refRaw) {
        throw new Error("FAIL: mvhd box not found in golden MP4");
    }

    const ref = parseMvhd(refRaw);

    const outRaw = serializeBoxTree(
        buildMvhdBox({
            timescale:   ref.timescale,
            duration:    ref.duration,
            nextTrackId: ref.nextTrackId
        })
    );

    const out = parseMvhd(outRaw);

    // ---------------------------------------------------------
    // Field-level conformance
    // ---------------------------------------------------------
    assertEqual("mvhd.version",     out.version,     ref.version);
    assertEqual("mvhd.flags",       out.flags,       ref.flags);
    assertEqual("mvhd.timescale",   out.timescale,   ref.timescale);
    assertEqual("mvhd.duration",    out.duration,    ref.duration);
    assertEqual("mvhd.nextTrackId", out.nextTrackId, ref.nextTrackId);
    assertEqual("mvhd.volume",      out.volume,      ref.volume);

    // ---------------------------------------------------------
    // Byte-for-byte conformance
    // ---------------------------------------------------------
    assertEqual(
        "mvhd.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `mvhd.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: mvhd matches golden MP4 byte-for-byte");
}

function parseMvhd(box) {
    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const volumeRaw = readUint16FromMp4BoxBytes(box, 32);

    return {
        type: readBoxTypeFromMp4BoxBytes(box, 4),
        version,
        flags,
        timescale: readUint32FromMp4BoxBytes(box, 20),
        duration: readUint32FromMp4BoxBytes(box, 24),
        rate: readUint32FromMp4BoxBytes(box, 28),
        volume: volumeRaw, // ← 8.8 fixed
        nextTrackId: readUint32FromMp4BoxBytes(box, 104),
        raw: box
    };
}
