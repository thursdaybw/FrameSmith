import {
    getGoldenTruthBox
} from "./index.js";

import {
    assertBoxStructuralEqual
} from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import {
    EmitterRegistry
} from "../../box-emitters/EmitterRegistry.js";

import {
    getBoxSchemaForPath
} from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_dinf
 *
 * Proves:
 * - dinf structure is extracted losslessly
 * - assembler + emitter rebuild identical structural shape
 * - schema, extractor, and emitter agree mechanically
 *
 * Container box agreement.
 * No byte comparison.
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_dinf() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve dinf
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/dinf"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (container box)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput(); // {}

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/trak/mdia/minf/dinf";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "dinf structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
