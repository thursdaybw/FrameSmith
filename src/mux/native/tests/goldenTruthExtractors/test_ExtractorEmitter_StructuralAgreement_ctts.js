import {
    getGoldenTruthBox
} from "./index.js";

import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_ctts
 *
 * This test proves:
 * - readBoxReport().box is lossless
 * - readBoxReport().box invents nothing
 * - schema enforcement is truthful
 * - emitter structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_ctts() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve ctts via Golden Truth dispatcher
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/ctts"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit structural node
    // ---------------------------------------------------------

    const input = truth.getEmitterInput();
    const node  = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/ctts",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------

    assertBoxStructuralEqual(
        "emitCttsBox(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/ctts"
        ),
        box,
        "moov/trak/mdia/minf/stbl/ctts"
    );
}
