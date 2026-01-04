/**
 * sbgp — Sample To Group Box
 * =========================
 *
 * sbgp declares sample-to-group mappings.
 *
 * At this stage, NativeMuxer treats sbgp as
 * opaque-or-declared container metadata.
 *
 * Correctness is defined by:
 * - correct box structure
 * - correct field placement
 * - byte-for-byte equivalence with ffmpeg output
 */

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitSbgpBox } from "../box-emitters/sbgpBox.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * sbgp Structural (Granular) Test
 */
export function testSbgp_Structure() {
    console.log("=== sbgp Structural tests ===");

    const node = emitSbgpBox({
        groupingType: "roll",
        entries: [
            { sampleCount: 5, groupDescriptionIndex: 1 }
        ]
    });

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("sbgp.type", node.type, "sbgp");
    assertEqual("sbgp.version", node.version, 1);
    assertEqual("sbgp.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    assertEqual("sbgp.body.length", node.body.length, 4);

    // grouping_type
    assertEqual("sbgp.grouping_type.kind", "type" in node.body[0], true);
    assertEqual("sbgp.grouping_type", node.body[0].type, "roll");

    // entry_count
    assertEqual("sbgp.entry_count.kind", "int" in node.body[1], true);
    assertEqual("sbgp.entry_count", node.body[1].int, 1);

    // entry[0].sample_count
    assertEqual("sbgp.entry[0].sampleCount", node.body[2].int, 5);

    // entry[0].group_description_index
    assertEqual("sbgp.entry[0].groupIndex", node.body[3].int, 1);

    console.log("PASS: sbgp structural correctness");
}


/**
 * sbgp Locked Layout Equivalence (ffmpeg)
 */
export async function testSbgp_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== sbgp LockedLayoutEquivalence (ffmpeg) ===");

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl",
        {
            child: "sbgp",
            trackType: "audio"
        }
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    const outRaw = serializeBoxTree(
        emitSbgpBox(params)
    );

    assertEqual("sbgp.size", outRaw.length, refFields.raw.length);

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `sbgp.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

    console.log("PASS: sbgp matches golden MP4");
}
