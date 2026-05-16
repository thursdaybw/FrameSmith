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
 * test_ExtractorEmitter_StructuralAgreement_esds
 *
 * Proves:
 * - esds is treated as an opaque payload
 * - readBoxReport().box is lossless and schema-correct
 * - emitter writes exactly what extractor reads
 *
 * No semantic interpretation is performed.
 */
export async function test_ExtractorEmitter_StructuralAgreement_esds() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve esds via SampleEntry grammar (mp4a)
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit from builder input
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();
    const node  = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|mp4a/esds",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitEsdsBox(input) matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
        ),
        box,
        "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
    );
}

