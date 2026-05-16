import {
    getGoldenTruthBox
} from "./index.js";

import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_moov
 *
 * This test proves:
 * - readBoxReport().box is lossless
 * - readBoxReport().box invents nothing
 * - schema enforcement is truthful
 * - assembler + emitter structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_moov() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve MOOV via Golden Truth dispatcher
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Assemble structural node
    // ---------------------------------------------------------

    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.assemble(
            "moov",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------

    assertBoxStructuralEqual(
        "assembleMoov(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov"
        ),
        box,
        "moov"
    );
}
