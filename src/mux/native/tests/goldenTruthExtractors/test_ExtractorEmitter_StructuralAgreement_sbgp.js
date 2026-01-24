import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

export async function test_ExtractorEmitter_StructuralAgreement_sbgp() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/sbgp"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    const input = truth.getEmitterInput();
    const node  =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/sbgp",
            input
        );

    assertBoxStructuralEqual(
        "sbgp structural agreement",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/sbgp"
        ),
        box,
        "moov/trak/mdia/minf/stbl/sbgp"
    );
}
