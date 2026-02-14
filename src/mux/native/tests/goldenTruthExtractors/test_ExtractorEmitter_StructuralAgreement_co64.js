import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { skipTest } from "../assertions.js";
import { loadCo64OracleTrack0BoxBytes } from "../co64OracleNodeLoader.js";

export async function test_ExtractorEmitter_StructuralAgreement_co64() {
    if (typeof window !== "undefined") {
        skipTest(
            "node-only: co64 oracle is multi-GB; run via node harness"
        );
    }

    const co64Bytes = await loadCo64OracleTrack0BoxBytes();
    const truth = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: co64Bytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/co64",
        targetBoxPath: "moov/trak/mdia/minf/stbl/co64"
    });

    const read = truth.readBoxReport();
    const input = truth.getEmitterInput();
    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/co64",
        input
    );
    const normalized = normalizeEmitterNodeToSchemaBox(
        node,
        "moov/trak/mdia/minf/stbl/co64"
    );

    assertBoxStructuralEqual(
        "emitCo64Box(input) structure matches readBoxReport().box",
        normalized,
        read.box,
        "moov/trak/mdia/minf/stbl/co64"
    );
}
