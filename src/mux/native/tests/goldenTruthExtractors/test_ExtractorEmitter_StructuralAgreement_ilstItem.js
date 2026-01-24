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
 * test_ExtractorEmitter_StructuralAgreement_ilstItem
 *
 * This test proves:
 * - readBoxReport().box is lossless for ilst items
 * - ilstItem extractor is generic (FourCC-agnostic)
 * - schema enforcement is truthful
 * - assembler structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_ilstItem() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve concrete ilst item via Golden Truth dispatcher
    // (test-scoped choice of atom)
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/ilst/©too"
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
            "moov/udta/meta/ilst/{atom}",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------

    assertBoxStructuralEqual(
        "assembleIlstItem(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/udta/meta/ilst/{atom}"
        ),
        box,
        "moov/udta/meta/ilst/{atom}"
    );
}
