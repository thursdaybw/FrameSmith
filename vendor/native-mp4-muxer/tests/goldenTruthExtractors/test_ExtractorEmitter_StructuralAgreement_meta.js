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
 * test_ExtractorEmitter_StructuralAgreement_meta
 *
 * Proves:
 * - meta structure is extracted losslessly
 * - emitter rebuilds identical structural shape
 * - schema, extractor, and emitter agree mechanically
 *
 * Container-only agreement.
 * No byte comparison.
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_meta() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve meta
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (assembler path)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.assemble(
            "moov/udta/meta",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/udta/meta";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "meta structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
