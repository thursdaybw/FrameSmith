import {
    getGoldenTruthBox
} from "./index.js";

import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_hdlr
 *
 * This test proves:
 * - readBoxReport().box is lossless
 * - readBoxReport().box invents nothing
 * - schema enforcement is truthful
 * - assembler + emitter structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_hdlr() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve hdlr via Golden Truth dispatcher
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/hdlr"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Assemble structural node
    // ---------------------------------------------------------

    // IMPORTANT:
    // getEmitterInput MUST derive from readBoxReport(),
    // not from raw bytes. The parameter is legacy only.
    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/hdlr",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------

    assertBoxStructuralEqual(
        "assembleHdlr(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/hdlr"
        ),
        box,
        "moov/trak/mdia/hdlr"
    );
}
