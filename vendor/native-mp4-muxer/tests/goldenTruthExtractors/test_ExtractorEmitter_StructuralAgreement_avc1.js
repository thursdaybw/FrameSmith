import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

export async function test_ExtractorEmitter_StructuralAgreement_avc1() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
           "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    const read  = truth.readBoxReport();
    const input = truth.getEmitterInput();

    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|avc1",
        input
    );

    const normalized =
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|avc1"
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitAvc1SampleEntryBox(input) structure matches readBoxReport().box",
        normalized,
        read.box,
        "moov/trak/mdia/minf/stbl/stsd|avc1",
    );

}
