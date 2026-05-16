import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_smhd
 *
 * Proves:
 * - smhd structure is extracted
 * - emitter rebuilds canonical smhd
 * - schema, extractor, emitter agree structurally
 *
 * Canonical normalization is intentional.
 */
export async function test_ExtractorEmitter_StructuralAgreement_smhd() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve smhd
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/smhd",
            { trackType: "audio" }
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (terminal box)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput(); // { balance }

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/smhd",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/trak/mdia/minf/smhd";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "smhd structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
