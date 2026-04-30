import { getGoldenTruthBox } from "./index.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

export async function test_ExtractorEmitter_StructuralAgreement_edts() {

    // ------------------------------------------------------------
    // Load oracle MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // Extract structural truth
    // ------------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/edts"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    // ------------------------------------------------------------
    // Rebuild via emitter registry
    // ------------------------------------------------------------
    const input = truth.getEmitterInput();

    const schemaPath = "moov/trak/edts";

    const node =
        EmitterRegistry.assemble(
            schemaPath,
            input
        );

    // ------------------------------------------------------------
    // Structural agreement
    // ------------------------------------------------------------
    assertBoxStructuralEqual(
        "edts structural agreement",
        normalizeEmitterNodeToSchemaBox(
            node,
            schemaPath
        ),
        box,
        schemaPath
    );
}
