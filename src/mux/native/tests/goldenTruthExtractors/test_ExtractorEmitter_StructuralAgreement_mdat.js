import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_mdat
 *
 * Proves:
 * - mdat can be extracted as opaque payload
 * - emitter preserves payload verbatim
 * - schema, extractor, and emitter agree structurally
 *
 * Notes:
 * - mdat is opaque
 * - no fields
 * - no children
 * - payload is raw bytes only
 */
export async function test_ExtractorEmitter_StructuralAgreement_mdat() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve mdat
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "mdat"
        );

    // ---------------------------------------------------------
    // Extract golden truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node =
        EmitterRegistry.emit(
            "mdat",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "mdat";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "mdat structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
