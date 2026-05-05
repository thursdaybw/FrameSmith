import {
    getGoldenTruthBox
} from "./index.js";

import {
    assertBoxStructuralEqual
} from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_pasp
 *
 * Proves:
 * - pasp fields are extracted losslessly from bytes
 * - emitter reproduces exactly what the extractor reports
 * - schema correctly defines pasp field order and structure
 *
 * No semantic interpretation is performed.
 */
export async function test_ExtractorEmitter_StructuralAgreement_pasp() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve pasp via SampleEntry grammar
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/pasp"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (not direct emitter)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();
    const node  = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|avc1/pasp",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "pasp: registry-built emitter matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|avc1/pasp"
        ),
        box,
        "moov/trak/mdia/minf/stbl/stsd|avc1/pasp"
    );
}
