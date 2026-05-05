import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_vmhd
 *
 * Proves:
 * - vmhd structure is extracted
 * - emitter rebuilds canonical vmhd
 * - schema, extractor, emitter agree structurally
 *
 * Canonical normalization is intentional.
 */
export async function test_ExtractorEmitter_StructuralAgreement_vmhd() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve vmhd
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/vmhd"
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
            "moov/trak/mdia/minf/vmhd",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path   = "moov/trak/mdia/minf/vmhd";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "vmhd structural agreement",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
