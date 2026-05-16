
import { getGoldenTruthBox } from "./index.js";
import { assertBoxStructuralEqual } from "./assertBoxStructuralEqual.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { normalizeEmitterNodeToSchemaBox } from "./normalizeEmitterNodeToSchemaBox.js";

/**
 * test_ExtractorEmitter_StructuralAgreement_stbl
 *
 * Proves:
 * - stbl.readBoxReport().box is schema-correct
 * - emitter structure agrees with extractor structure
 * - no assumptions
 * - no loss
 */
export async function test_ExtractorEmitter_StructuralAgreement_stbl_mp4a() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve stbl
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit from builder input
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    // STSZ variant selection (mp4a → variable)
    input.stsz = {
        sampleSize:  0,
        sampleCount: input.stsz.sizes.length,
        sizes:       input.stsz.sizes
    };

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            input
        );

    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitStblBox(mp4a input) matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl"
        ),
        box,
        "moov/trak/mdia/minf/stbl"
    );
}

export async function test_ExtractorEmitter_StructuralAgreement_stbl_opus() {

    // ---------------------------------------------------------
    // Load oracle MP4 (Opus)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve stbl
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl"
        );

    const read = truth.readBoxReport();
    const box  = read.box;

    // ---------------------------------------------------------
    // Emit from builder input
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    // STSZ variant selection (mp4a → variable)
    const refSampleSize = input.stsz.sampleSize;

    if (refSampleSize === 0) {
        input.stsz = {
            sampleSize:  0,
            sampleCount: input.stsz.sizes.length,
            sizes:       input.stsz.sizes
        };
    } else {
        input.stsz = {
            sampleSize:  refSampleSize,
            sampleCount: input.stsz.sampleCount
        };
    }

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            input
        );


    // ---------------------------------------------------------
    // Structural agreement
    // ---------------------------------------------------------
    assertBoxStructuralEqual(
        "emitStblBox(opus input) matches readBoxReport().box",
        normalizeEmitterNodeToSchemaBox(
            node,
            "moov/trak/mdia/minf/stbl"
        ),
        box,
        "moov/trak/mdia/minf/stbl"
    );
}
