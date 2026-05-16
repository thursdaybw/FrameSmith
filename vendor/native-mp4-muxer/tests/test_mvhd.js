import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readUint16 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

export function testMvhd_Structure() {

    const timescale   = 90000;
    const duration    = 90000 * 12;
    const nextTrackId = 2;

    // ---------------------------------------------------------
    // Emit MVHD node (no serialization)
    // ---------------------------------------------------------

    const node =
        EmitterRegistry.emit(
            "moov/mvhd",
            { timescale, duration, nextTrackId }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------

    assertEqual("mvhd.type", node.type, "mvhd");

    // ---------------------------------------------------------
    // FullBox header
    // ---------------------------------------------------------

    assertEqual("mvhd.version", node.version, 0);
    assertEqual("mvhd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body fields (schema order)
    // ---------------------------------------------------------

    let cursor = 0;
    const body = node.body;

    // creation_time
    assertEqual("mvhd.creation_time", body[cursor++].int, 0);

    // modification_time
    assertEqual("mvhd.modification_time", body[cursor++].int, 0);

    // timescale
    assertEqual("mvhd.timescale", body[cursor++].int, timescale);

    // duration
    assertEqual("mvhd.duration", body[cursor++].int, duration);

    // rate (16.16)
    assertEqual("mvhd.rate", body[cursor++].int, 0x00010000);

    // volume (8.8)
    assertEqual("mvhd.volume", body[cursor++].short, 0x0100);

    // reserved (uint16)
    assertEqual("mvhd.reserved.short", body[cursor++].short, 0);

    // reserved (uint32 × 2)
    assertEqual("mvhd.reserved[0]", body[cursor++].int, 0);
    assertEqual("mvhd.reserved[1]", body[cursor++].int, 0);

    // matrix (uint32 × 9)
    const expectedMatrix = [
        0x00010000, 0, 0,
        0, 0x00010000, 0,
        0, 0, 0x40000000
    ];

    for (let i = 0; i < 9; i++) {
        assertEqual(
            `mvhd.matrix[${i}]`,
            body[cursor++].int,
            expectedMatrix[i]
        );
    }

    // pre_defined (uint32 × 6)
    for (let i = 0; i < 6; i++) {
        assertEqual(
            `mvhd.pre_defined[${i}]`,
            body[cursor++].int,
            0
        );
    }

    // next_track_ID
    assertEqual(
        "mvhd.next_track_ID",
        body[cursor++].int,
        nextTrackId
    );
}

export async function testMvhd_LockedLayoutEquivalence_ffmpeg() {

    // -------------------------------------------------------------
    // Load golden MP4 (video only)
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // Read reference MVHD via golden truth extractor
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/mvhd"
    );

    const refFields = ref.readBoxReport();
    const params    = ref.getEmitterInput();

    // -------------------------------------------------------------
    // Rebuild MVHD via Framesmith
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit("moov/mvhd", params)
    );

    // -------------------------------------------------------------
    // Read rebuilt MVHD via same extractor
    // -------------------------------------------------------------
    const outFields = GoldenTruthRegistry
        .getExtractor("moov/mvhd")
        .readBoxReport(outBytes);

    // -------------------------------------------------------------
    // Field-level equivalence (semantic gate)
    // -------------------------------------------------------------
    assertEqual("mvhd.version",
        outFields.box.version,
        refFields.box.version
    );

    assertEqual("mvhd.flags",
        outFields.box.flags,
        refFields.box.flags
    );

    assertEqual("mvhd.timescale",
        outFields.box.timescale,
        refFields.box.timescale
    );

    assertEqual("mvhd.duration",
        outFields.box.duration,
        refFields.box.duration
    );

    assertEqual("mvhd.nextTrackId",
        outFields.box.nextTrackId,
        refFields.box.nextTrackId
    );

    assertEqual("mvhd.volume",
        outFields.box.volume,
        refFields.box.volume
    );

    assertEqual("mvhd.rate",
        outFields.box.rate,
        refFields.box.rate
    );

    // -------------------------------------------------------------
    // Byte-for-byte equivalence
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
}

export async function testMvhd_LockedLayoutEquivalence_ffmpeg_Audio() {

    // -------------------------------------------------------------
    // Load golden MP4 (audio + video)
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // Read reference MVHD via golden truth extractor
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/mvhd"
    );

    const refFields = ref.readBoxReport();
    const params    = ref.getEmitterInput();

    // -------------------------------------------------------------
    // Rebuild MVHD via Framesmith
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit("moov/mvhd", params)
    );

    // -------------------------------------------------------------
    // Read rebuilt MVHD via same extractor
    // -------------------------------------------------------------
    const outFields = GoldenTruthRegistry
        .getExtractor("moov/mvhd")
        .readBoxReport(outBytes);

    // Field-level equivalence (semantic gate)
    // -------------------------------------------------------------
    assertEqual("mvhd.version",
        outFields.box.version,
        refFields.box.version
    );

    assertEqual("mvhd.flags",
        outFields.box.flags,
        refFields.box.flags
    );

    assertEqual("mvhd.timescale",
        outFields.box.timescale,
        refFields.box.timescale
    );

    assertEqual("mvhd.duration",
        outFields.box.duration,
        refFields.box.duration
    );

    assertEqual("mvhd.nextTrackId",
        outFields.box.nextTrackId,
        refFields.box.nextTrackId
    );

    assertEqual("mvhd.volume",
        outFields.box.volume,
        refFields.box.volume
    );

    assertEqual("mvhd.rate",
        outFields.box.rate,
        refFields.box.rate
    );

    // -------------------------------------------------------------
    // Byte-for-byte equivalence
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
}
