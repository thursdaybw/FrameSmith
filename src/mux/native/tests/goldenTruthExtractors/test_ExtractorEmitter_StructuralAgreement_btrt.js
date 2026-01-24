import {
    getGoldenTruthBox
} from "./index.js";

import {
    assertBoxStructuralEqual
} from "./assertBoxStructuralEqual.js";

import {
    normalizeEmitterNodeToSchemaBox
} from "./normalizeEmitterNodeToSchemaBox.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

/**
 * NOTE
 * ----
 * The btrt box is valid for both video (avc1) and audio (mp4a) SampleEntries.
 *
 * These tests assert the btrt box via the avc1 path because the oracle
 * MP4 files used here include btrt metadata on the video SampleEntry,
 * but do not include btrt on the audio SampleEntry.
 *
 * This asymmetry reflects encoder output in the reference files,
 * not a limitation of the btrt schema, emitter, or registry wiring.
 *
 * Structural correctness of btrt under mp4a is guaranteed by reuse of
 * the same emitter and schema, and does not require a duplicate test
 * in the absence of an mp4a/btrt oracle.
 */

/**
 * test_ExtractorEmitter_StructuralAgreement_btrt
 *
 * Proves:
 * - btrt is structurally represented correctly by the extractor
 * - emitter output matches readBoxReport().box exactly
 * - schema correctly defines field order and structure
 *
 * No semantic interpretation is performed.
 */
export async function test_ExtractorEmitter_StructuralAgreement_btrt() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve btrt via SampleEntry grammar
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/btrt"
        );

    // ---------------------------------------------------------
    // Extract structural truth
    // ---------------------------------------------------------
    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit via registry (not direct emitter)
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();
    const node  = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|avc1/btrt",
        input
    );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "btrt: registry-built emitter matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl/stsd|avc1/btrt"
        ),
        box,
        "moov/trak/mdia/minf/stbl/stsd|avc1/btrt"
    );
}
