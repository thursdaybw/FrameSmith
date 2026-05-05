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
 * test_ExtractorEmitter_StructuralAgreement_dref
 *
 * Proves:
 * - dref structure is extracted losslessly
 * - emitter rebuilds identical structural shape
 * - schema, extractor, and emitter agree mechanically
 *
 * Terminal box agreement.
 * No byte comparison.
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_dref() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve dref
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/dinf/dref"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (terminal box)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput(); // {}

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf/dref",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/trak/mdia/minf/dinf/dref";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "dref structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
