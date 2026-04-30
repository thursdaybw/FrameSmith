import { getGoldenTruthBox } from "./index.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

export async function test_ExtractorEmitter_StructuralAgreement_sgpd() {

    // ------------------------------------------------------------
    // Load oracle MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // Extract structural truth
    // ------------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/sgpd"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    // ------------------------------------------------------------
    // Rebuild via emitter registry
    // ------------------------------------------------------------
    const input = truth.getEmitterInput();

    const schemaPath =
        input.defaultLength === 0
        ? "moov/trak/mdia/minf/stbl/sgpd|variable"
        : "moov/trak/mdia/minf/stbl/sgpd|fixed";

    const node =
        EmitterRegistry.emit(
            schemaPath,
            input
        );

    // ------------------------------------------------------------
    // Structural agreement
    // ------------------------------------------------------------

    assertBoxStructuralEqual(
        "sgpd structural agreement",
        normalizeEmitterNodeToSchemaBox(
            node,
            schemaPath
        ),
        box,
        schemaPath
    );

}
