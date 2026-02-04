import {
    getGoldenTruthBox
} from "./index.js";

import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";

import {
  normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
/**
 * test_ExtractorEmitter_StructuralAgreement_stsz
 *
 * This test proves:
 * - readBoxReport().box is lossless
 * - readBoxReport().box invents nothing
 * - schema enforcement is truthful
 * - emitter structure agrees with extractor structure
 *
 * Byte-level equivalence is explicitly out of scope.
 */
export async function test_ExtractorEmitter_StructuralAgreement_stsz() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve stsz via Golden Truth dispatcher
    // ---------------------------------------------------------

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File( mp4, "moov/trak[0]/mdia/minf/stbl/stsz");

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit structural node
    // ---------------------------------------------------------

    const input = truth.getEmitterInput();
    let stszEmitterPath;

    if (input.sampleSize === 0) {
        stszEmitterPath = "moov/trak/mdia/minf/stbl/stsz|variable";
    } else {
        stszEmitterPath = "moov/trak/mdia/minf/stbl/stsz|fixed";
    }

    const node = EmitterRegistry.emit( stszEmitterPath, input);

    // ---------------------------------------------------------
    // Structural agreement assertion
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitStszBox(input) structure matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox( node, stszEmitterPath),
        box,
        stszEmitterPath
    );
}
