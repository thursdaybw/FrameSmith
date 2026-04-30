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
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * sgpd Structural (Granular) Test
 */
export function testSgpd_Structure_Fixed() {

    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/sgpd|fixed",
        {
            groupingType: "roll",
            defaultLength: 2,
            descriptions: [
                Uint8Array.from([0x00, 0x01])
            ]
        }
    );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("sgpd.type", node.type, "sgpd");
    assertEqual("sgpd.version", node.version, 1);
    assertEqual("sgpd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape (fixed-length variant)
    // ---------------------------------------------------------
    assertEqual("sgpd.body.length", node.body.length, 4);

    // grouping_type
    assertEqual(
        "sgpd.grouping_type",
        node.body[0].int,
        (
            ("r".charCodeAt(0) << 24) |
            ("o".charCodeAt(0) << 16) |
            ("l".charCodeAt(0) << 8)  |
            "l".charCodeAt(0)
        ) >>> 0
    );

    // default_length
    assertEqual("sgpd.default_length", node.body[1].int, 2);

    // entry_count
    assertEqual("sgpd.entry_count", node.body[2].int, 1);

    // description_bytes (no per-entry length in fixed variant)
    assertEqual("sgpd.description.array.type", node.body[3].array, "byte");
    assertEqual("sgpd.description.length", node.body[3].values.length, 2);
}

export function testSgpd_Structure_Variable() {

    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/sgpd|variable",
        {
            groupingType: "roll",
            defaultLength: 0,
            descriptions: [
                Uint8Array.from([0x00, 0x01])
            ]
        }
    );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("sgpd.type", node.type, "sgpd");
    assertEqual("sgpd.version", node.version, 1);
    assertEqual("sgpd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape (variable-length)
    // ---------------------------------------------------------
    assertEqual("sgpd.body.length", node.body.length, 5);

    assertEqual(
        "sgpd.grouping_type",
        node.body[0].int,
        (
            ("r".charCodeAt(0) << 24) |
            ("o".charCodeAt(0) << 16) |
            ("l".charCodeAt(0) << 8)  |
            "l".charCodeAt(0)
        ) >>> 0
    );
    assertEqual("sgpd.default_length", node.body[1].int, 0);
    assertEqual("sgpd.entry_count", node.body[2].int, 1);

    // description_length
    assertEqual("sgpd.description_length", node.body[3].int, 2);

    // description_bytes
    assertEqual("sgpd.description.array.type", node.body[4].array, "byte");
    assertEqual("sgpd.description.length", node.body[4].values.length, 2);
}

/**
 * sgpd Locked Layout Equivalence (ffmpeg)
 */
export async function testSgpd_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/sgpd",
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const outRaw = serializeBoxTree(
        EmitterRegistry.emit(
            params.defaultLength === 0
            ? "moov/trak/mdia/minf/stbl/sgpd|variable"
            : "moov/trak/mdia/minf/stbl/sgpd|fixed",
            params
        )
    );

    assertEqual("sgpd.size", outRaw.length, refFields.raw.length);

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `sgpd.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

}
