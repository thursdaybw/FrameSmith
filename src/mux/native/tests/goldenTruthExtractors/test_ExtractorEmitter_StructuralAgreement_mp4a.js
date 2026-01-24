import {
    getGoldenTruthBox
} from "./index.js";


import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
/**
 * test_ExtractorEmitter_StructuralAgreement_mp4a
 *
 * Proves:
 * - mp4a SampleEntry structure is extracted losslessly
 * - assembler + registry builds an identical structural shape
 * - children (esds, optional btrt) are preserved structurally
 *
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_mp4a() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve mp4a via SampleEntry grammar
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (assembler → emitters)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "mp4a SampleEntry assertion: Does Box-emitted output structure match readBoxReport().box?",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|mp4a"
        ),
        box,
        "moov/trak/mdia/minf/stbl/stsd|mp4a"
    );
}
