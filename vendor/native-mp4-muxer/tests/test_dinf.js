import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * DINF — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * This test validates the *intent* and *structure* of the
 * Data Information Box.
 *
 * It does NOT validate:
 *   - byte layout
 *   - reference resolution
 *   - file assembly
 *
 * It asserts only what DINF is responsible for:
 *   - container presence
 *   - required child wiring
 *   - correct ordering
 */
export function testDinf_Structure() {

    // ---------------------------------------------------------
    // 1. Emit DINF via registry (NO serialization)
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf",
            {}
        );

    // ---------------------------------------------------------
    // 2. Box identity
    // ---------------------------------------------------------
    assertEqual("dinf.type", node.type, "dinf");

    // ---------------------------------------------------------
    // 3. DINF has no body
    // ---------------------------------------------------------
    assertEqual(
        "dinf.body.length",
        node.body ? node.body.length : 0,
        0
    );

    // ---------------------------------------------------------
    // 4. Child boxes
    // ---------------------------------------------------------
    assertEqual(
        "dinf.children.length",
        node.children.length,
        1
    );

    const dref = node.children[0];

    assertEqual("dinf.dref.type", dref.type, "dref");
}


/**
 * DINF — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * This test validates that DINF serializes identically
 * to ffmpeg when provided with the same *canonical* child box.
 *
 * DREF in Framesmith is not configurable.
 * The parser is used as a validation gate only.
 */

/**
 * DINF — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates that DINF rebuilds identically to ffmpeg
 * when constructed exclusively from golden truth inputs.
 */
export async function testDinf_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Read golden truth DINF
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/dinf",
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // ---------------------------------------------------------
    // Rebuild DINF from golden truth only
    // --------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf",
            params
        )
    );

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "dinf.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `dinf.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

}

