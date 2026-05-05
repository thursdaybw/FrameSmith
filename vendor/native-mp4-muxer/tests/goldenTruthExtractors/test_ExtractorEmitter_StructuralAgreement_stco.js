import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_stco
 *
 * Proves:
 * - readBoxReport().box is lossless
 * - readBoxReport().box invents nothing
 * - schema enforcement is truthful
 * - emitter structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_stco() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stco"
        );

    // ---------------------------------------------------------
    // Extractor output
    // ---------------------------------------------------------
    const read = truth.readBoxReport();


    // ---------------------------------------------------------
    // Builder input
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    // ---------------------------------------------------------
    // Emitter output
    // ---------------------------------------------------------
    const node  = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stco",
        input
    );


    // ---------------------------------------------------------
    // Normalized emitter → schema box
    // ---------------------------------------------------------
    const normalized =
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stco"
        );

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitStcoBox(input) structure matches readBoxReport().box",
        normalized,
        read.box,
        "moov/trak/mdia/minf/stbl/stco"
    );
}
