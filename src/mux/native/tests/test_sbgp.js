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
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * sbgp Structural (Granular) Test
 */
export function testSbgp_Structure() {

    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/sbgp",
        {
            groupingType: "roll",
            entries: [
                { sampleCount: 5, groupDescriptionIndex: 1 }
            ]
        }
    );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("sbgp.type", node.type, "sbgp");
    assertEqual("sbgp.version", node.version, 0);
    assertEqual("sbgp.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    assertEqual("sbgp.body.length", node.body.length, 4);

    // grouping_type (uint32 FourCC)
    assertEqual(
        "sbgp.grouping_type.kind",
        "int" in node.body[0],
        true
    );

    const groupingTypeUint32 = node.body[0].int;

    const groupingType =
        String.fromCharCode(
            (groupingTypeUint32 >> 24) & 0xff,
            (groupingTypeUint32 >> 16) & 0xff,
            (groupingTypeUint32 >> 8)  & 0xff,
            groupingTypeUint32 & 0xff
        );

    assertEqual(
        "sbgp.grouping_type",
        groupingType,
        "roll"
    );

    // entry_count
    assertEqual("sbgp.entry_count.kind", "int" in node.body[1], true);
    assertEqual("sbgp.entry_count", node.body[1].int, 1);

    // entry[0].sample_count
    assertEqual("sbgp.entry[0].sampleCount", node.body[2].int, 5);

    // entry[0].group_description_index
    assertEqual("sbgp.entry[0].groupIndex", node.body[3].int, 1);

}


/**
 * sbgp Locked Layout Equivalence (ffmpeg)
 */
export async function testSbgp_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/sbgp",
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const outRaw = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/sbgp",
            params
        )
    );

    assertEqual("sbgp.size", outRaw.length, refFields.raw.length);

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `sbgp.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

}
