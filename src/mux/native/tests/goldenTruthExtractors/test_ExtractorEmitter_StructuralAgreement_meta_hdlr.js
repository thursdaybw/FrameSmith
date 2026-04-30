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
 * test_ExtractorEmitter_StructuralAgreement_meta_hdlr
 *
 * Proves:
 * - meta/hdlr structure is extracted losslessly
 * - emitter rebuilds identical structural shape
 * - schema, extractor, and emitter agree mechanically
 *
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_meta_hdlr() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve meta/hdlr
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/hdlr"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.emit(
            "moov/udta/meta/hdlr",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/udta/meta/hdlr";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "meta/hdlr structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
