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
 * test_ExtractorEmitter_StructuralAgreement_avcC
 *
 * Proves:
 * - avcC is treated as an opaque payload
 * - readBoxReport().box is lossless and schema-correct
 * - emitter writes exactly what extractor reads
 *
 * No semantic interpretation is performed.
 */
export async function test_ExtractorEmitter_StructuralAgreement_avcC() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve avcC via SampleEntry grammar
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
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
        "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "avcC: registry-built emitter matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
        ),
        box,
       "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
    );
}
