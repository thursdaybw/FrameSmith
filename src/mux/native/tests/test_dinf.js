import { emitDinfBox } from "../box-emitters/dinfBox.js";
import { emitDrefBox } from "../box-emitters/drefBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * DINF — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * This test validates the *intent* and *structure* of the
 * Data Information Box.
 *
 * It does NOT validate:
 *   - byte layout
 *   - reference resolution
 *   - file assembly
 *
 * It asserts only what DINF is responsible for:
 *   - container presence
 *   - required child wiring
 *   - correct ordering
 */
export async function testDinf_Structure() {

    console.log("=== testDinf_Structure ===");

    // ---------------------------------------------------------
    // 1. Minimal valid child: dref
    // ---------------------------------------------------------
    const dref = {
        type: "dref",
        body: []
    };

    // ---------------------------------------------------------
    // 2. Build DINF
    // ---------------------------------------------------------
    const node = emitDinfBox({ dref });
    const dinf = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------

    const extractedDref = extractChildBoxFromContainer(dinf, "dref");

    assertExists("dref", extractedDref);

    // ---------------------------------------------------------
    // 4. Ordering and containment
    // ---------------------------------------------------------
    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "dinf.childCount",
        childTypes.length,
        1
    );

    assertEqual(
        "dinf.childOrder",
        childTypes[0],
        "dref"
    );

    console.log("PASS: DINF structural correctness");
}

/**
 * DINF — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * This test validates that DINF serializes identically
 * to ffmpeg when provided with the same *canonical* child box.
 *
 * DREF in Framesmith is not configurable.
 * The parser is used as a validation gate only.
 */

/**
 * DINF — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates that DINF rebuilds identically to ffmpeg
 * when constructed exclusively from golden truth inputs.
 */
export async function testDinf_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testDinf_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Read golden truth DINF
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/dinf"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild DINF from golden truth only
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitDinfBox(params)
    );

    // ---------------------------------------------------------
    // 4. Re-read rebuilt DINF
    // ---------------------------------------------------------
    const outFields = getGoldenTruthBox
        .fromBox(outBytes, "moov/trak/mdia/minf/dinf")
        .readFields();

    // ---------------------------------------------------------
    // 5. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "dinf.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `dinf.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: DINF locked-layout equivalence with ffmpeg");
}
