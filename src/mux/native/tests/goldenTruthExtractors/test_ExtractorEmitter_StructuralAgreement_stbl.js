
import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_stbl
 *
 * Proves:
 * - stbl.readBoxReport().box is schema-correct
 * - emitter structure agrees with extractor structure
 * - no assumptions
 * - no loss
 */

export async function test_ExtractorEmitter_StructuralAgreement_stbl() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve stbl
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit from builder input
    // ---------------------------------------------------------

    const input = truth.getEmitterInput();
    const node  = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl",
        input
    );


    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitStblBox(input) matches readBoxReport().box correct normalizer",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl"
        ),
        box,
        "moov/trak/mdia/minf/stbl",
    );

}
