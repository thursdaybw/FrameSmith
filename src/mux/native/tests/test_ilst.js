import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

/**
 * ILST — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates architectural intent of the ilst container.
 *
 * Assertions:
 * - ilst is a container box
 * - children are ilst item atoms
 * - ordering is preserved
 *
 * Notes:
 * - No serializer involvement
 * - No direct emitter calls
 * - Registry entry points only
 */
export function testIlst_Structure() {

    const intent = {
        items: [
            {
                type: "@too",
                data: {
                    version: 0,
                    flags: 1,
                    dataType: 1,
                    locale: 0,
                    payload: new Uint8Array([0x01, 0x02, 0x03])
                }
            }
        ]
    };

    const node =
        EmitterRegistry.assemble(
            "moov/udta/meta/ilst",
            intent
        );

    // ---------------------------------------------------------
    // Structural assertions
    // ---------------------------------------------------------

    assertEqual("ilst.type", node.type, "ilst");

    assertExists("ilst.children", node.children);
    assertEqual("ilst.children.length", node.children.length, 1);

    assertEqual(
        "ilst.child[0].type",
        node.children[0].type,
        "@too"
    );
}

/**
 * ILST — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates byte-for-byte equivalence against ffmpeg output
 * when rebuilt from semantic golden truth.
 *
 * Rules:
 * - No raw byte passthrough
 * - No direct extractBoxByPathFromMp4 usage
 * - Semantic dispatcher only
 */
export async function testIlst_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve ilst via semantic dispatcher
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/ilst"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const refRaw = refReport.raw;

    // ---------------------------------------------------------
    // Rebuild ilst via registry + serializer
    // ---------------------------------------------------------

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/udta/meta/ilst",
                params
            )
        );

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------

    assertEqual("ilst.size", out.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `ilst.byte[${i}]`,
            out[i],
            refRaw[i]
        );
    }
}
