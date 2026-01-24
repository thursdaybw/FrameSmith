import {
    getGoldenTruthBox
} from "./index.js";

import {
    assertBoxStructuralEqual
} from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import {
    EmitterRegistry
} from "../../box-emitters/EmitterRegistry.js";

import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_stsd
 *
 * Proves:
 * - stsd structure is extracted losslessly
 * - assembler + registry rebuild identical structural shape
 * - SampleEntry children are preserved structurally and in order
 *
 * No semantic interpretation.
 */
export async function test_ExtractorEmitter_StructuralAgreement_stsd() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve stsd container
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (assembler → emitters)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    const path = "moov/trak/mdia/minf/stbl/stsd";
    const schema = getBoxSchemaForPath(path);

    assertBoxStructuralEqual(
        "stsd assertion: Does assembled output structure match readBoxReport().box?",
        normalizeEmitterNodeToSchemaBox(node, path),
        box,
        path,
        schema
    );
}
