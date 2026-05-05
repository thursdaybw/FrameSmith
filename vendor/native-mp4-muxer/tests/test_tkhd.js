import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex, assertExists } from "./assertions.js";
import { splitFixed1616 } from "../bytes/mp4NumericFormats.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * TKHD — Structural Contract
 *
 * Asserts the STRUCTURE of the emitted TKHD node.
 *
 * - No serialization
 * - No byte reads
 * - Registry only
 */
export function testTkhd_Structure() {

    const width    = 1920;
    const height   = 1080;
    const duration = 90000 * 10;
    const trackId  = 1;

    const widthFraction  = 0;
    const heightFraction = 0;

    const node =
        EmitterRegistry.emit(
            "moov/trak/tkhd",
            {
                width,
                height,
                widthFraction,
                heightFraction,
                duration,
                trackId
            }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("tkhd.type", node.type, "tkhd");
    assertEqual("tkhd.version", node.version, 0);

    assertExists("tkhd.flags", node.flags);
    assertEqual("tkhd.flags.enabled",   node.flags.enabled,  true);
    assertEqual("tkhd.flags.inMovie",   node.flags.inMovie,  true);
    assertEqual("tkhd.flags.inPreview", !!node.flags.inPreview, false);

    // ---------------------------------------------------------
    // Body structure
    // ---------------------------------------------------------
    assertExists("tkhd.body", node.body);
    assertEqual("tkhd.body.length", node.body.length, 22);

    // creation_time
    assertEqual("tkhd.creation_time", node.body[0].int, 0);

    // modification_time
    assertEqual("tkhd.modification_time", node.body[1].int, 0);

    // track_id
    assertEqual("tkhd.track_id", node.body[2].int, trackId);

    // reserved
    assertEqual("tkhd.reserved.post_track_id", node.body[3].int, 0);

    // duration
    assertEqual("tkhd.duration", node.body[4].int, duration);

    // reserved[2]
    assertEqual("tkhd.reserved[0]", node.body[5].int, 0);
    assertEqual("tkhd.reserved[1]", node.body[6].int, 0);

    // layer
    assertEqual("tkhd.layer", node.body[7].short, 0);

    // alternate_group
    assertEqual("tkhd.alternate_group", node.body[8].short, 0);

    // volume
    assertEqual("tkhd.volume", node.body[9].short, 0);

    // reserved
    assertEqual("tkhd.reserved.post_volume", node.body[10].short, 0);

    // matrix (identity)
    const expectedMatrix = [
        0x00010000, 0, 0,
        0, 0x00010000, 0,
        0, 0, 0x40000000
    ];

    for (let i = 0; i < 9; i++) {
        assertEqual(
            `tkhd.matrix[${i}]`,
            node.body[11 + i].int,
            expectedMatrix[i]
        );
    }

    // width (16.16 fixed-point)
    const widthFixed = node.body[20].int;
    assertEqual("tkhd.width.integer",  widthFixed >>> 16, width);
    assertEqual("tkhd.width.fraction", widthFixed & 0xFFFF, widthFraction);

    // height (16.16 fixed-point)
    const heightFixed = node.body[21].int;
    assertEqual("tkhd.height.integer",  heightFixed >>> 16, height);
    assertEqual("tkhd.height.fraction", heightFixed & 0xFFFF, heightFraction);
}


/**
 * TKHD — Locked Layout (video)
 */
export async function testTkhd_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/tkhd"
        );

    const ref = truth.readBoxReport().raw;
    const input = truth.getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/tkhd",
                input
            )
        );

    assertEqual("tkhd.size", out.length, ref.length);

    for (let i = 0; i < ref.length; i++) {
        assertEqualHex(
            `tkhd.byte[${i}]`,
            out[i],
            ref[i]
        );
    }
}

/**
 * TKHD — Locked Layout (audio)
 */
export async function testTkhd_LockedLayoutEquivalence_ffmpeg_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/tkhd"
        );

    const ref = truth.readBoxReport().raw;
    const input = truth.getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/tkhd",
                input
            )
        );

    assertEqual("tkhd.size", out.length, ref.length);

    for (let i = 0; i < ref.length; i++) {
        assertEqualHex(
            `tkhd.byte[${i}]`,
            out[i],
            ref[i]
        );
    }
}
