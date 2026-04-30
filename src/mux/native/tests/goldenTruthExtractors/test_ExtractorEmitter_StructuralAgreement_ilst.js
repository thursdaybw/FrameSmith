import {
    getGoldenTruthBox
} from "./index.js";

import {
    EmitterRegistry
} from "../../box-emitters/EmitterRegistry.js";

import {
    assertBoxStructuralEqual
} from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_ilst
 *
 * This test proves:
 * - readBoxReport().box is lossless for ilst containers
 * - ilst extractor reports children correctly (by presence, not payload)
 * - schema enforcement is truthful
 * - assembler structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_ilst() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve ilst via Golden Truth dispatcher
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/ilst"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit structural node (container ⇒ assemble)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.assemble(
            "moov/udta/meta/ilst",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "assembleIlst(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/udta/meta/ilst"
        ),
        box,
        "moov/udta/meta/ilst"
    );
}
