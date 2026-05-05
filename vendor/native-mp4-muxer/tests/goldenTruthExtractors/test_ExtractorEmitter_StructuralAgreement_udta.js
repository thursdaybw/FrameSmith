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
 * test_ExtractorEmitter_StructuralAgreement_udta
 *
 * Proves:
 * - udta structure is extracted losslessly
 * - assembler + emitter rebuild identical structural shape
 * - schema, extractor, and emitter agree mechanically
 *
 * Container-only agreement.
 * No byte comparison.
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_udta() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve udta
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta"
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
            "moov/udta",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/udta";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "udta structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
