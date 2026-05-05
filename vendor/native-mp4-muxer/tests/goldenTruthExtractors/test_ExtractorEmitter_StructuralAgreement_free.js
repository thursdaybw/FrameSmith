import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_free
 *
 * Proves:
 * - free structure is extracted
 * - emitter rebuilds canonical free
 * - schema, extractor, emitter agree structurally
 *
 * free is a terminal, fieldless, header-only box.
 */
export async function test_ExtractorEmitter_StructuralAgreement_free() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve free
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "free"
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
        EmitterRegistry.emit(
            "free",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "free";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "free structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
