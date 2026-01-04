/**
 * sgpd — Sample Group Description Box
 * ==================================
 *
 * sgpd provides group description records referenced by sbgp.
 *
 * At this stage, NativeMuxer treats sgpd as
 * opaque-or-declared container metadata.
 *
 * Correctness is defined by:
 * - correct box structure
 * - correct field placement
 * - byte-for-byte equivalence with ffmpeg output
 */

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitSgpdBox } from "../box-emitters/sgpdBox.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * sgpd Structural (Granular) Test
 */
export function testSgpd_Structure() {
    console.log("=== sgpd Structural tests ===");

    const node = emitSgpdBox({
        groupingType: "roll",
        defaultLength: 2,
        descriptions: [
            Uint8Array.from([0x00, 0x01])
        ]
    });

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("sgpd.type", node.type, "sgpd");
    assertEqual("sgpd.version", node.version, 1);
    assertEqual("sgpd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    assertEqual("sgpd.body.length", node.body.length, 4);

    assertEqual("sgpd.grouping_type", node.body[0].type, "roll");
    assertEqual("sgpd.default_length", node.body[1].int, 2);
    assertEqual("sgpd.entry_count", node.body[2].int, 1);

    const desc = node.body[3].array;

    assertEqual("sgpd.description.array.type", desc, "byte");
    assertEqual("sgpd.description.length", node.body[3].values.length, 2);

    console.log("PASS: sgpd structural correctness");
}

/**
 * sgpd Locked Layout Equivalence (ffmpeg)
 */
export async function testSgpd_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== sgpd LockedLayoutEquivalence (ffmpeg) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl",
        { child: "sgpd" }
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    const outRaw = serializeBoxTree(
        emitSgpdBox(params)
    );

    assertEqual("sgpd.size", outRaw.length, refFields.raw.length);

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `sgpd.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

    console.log("PASS: sgpd matches golden MP4");
}
