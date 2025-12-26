import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitDinfBox } from "../box-emitters/dinfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractChildBoxFromContainer } from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex,
} from "./assertions.js";
import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";


/**
 * MINF — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates the structural intent of the Media Information Box.
 *
 * This test does NOT:
 *   - infer media type
 *   - test semantics
 *   - test serialization equivalence
 *
 * It asserts only what MINF is responsible for:
 *   - container presence
 *   - required children
 *   - correct ordering
 */
export async function testMinf_Structure() {

    console.log("=== testMinf_Structure ===");

    // ---------------------------------------------------------
    // 1. Explicit children (policy injected by test)
    // ---------------------------------------------------------
    const vmhd = { type: "vmhd", body: [] };
    const dinf = { type: "dinf", body: [] };
    const stbl = { type: "stbl", body: [] };

    // ---------------------------------------------------------
    // 2. Build MINF
    // ---------------------------------------------------------
    const node = emitMinfBox({
        vmhd,
        dinf,
        stbl
    });

    const minf = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    assertExists("vmhd", extractChildBoxFromContainer(minf, "vmhd"));
    assertExists("dinf", extractChildBoxFromContainer(minf, "dinf"));
    assertExists("stbl", extractChildBoxFromContainer(minf, "stbl"));

    // ---------------------------------------------------------
    // 4. Ordering assertions
    // ---------------------------------------------------------
    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "minf.childCount",
        childTypes.length,
        3
    );

    assertEqual(
        "minf.childOrder",
        childTypes.join(","),
        "vmhd,dinf,stbl"
    );

    console.log("PASS: MINF structural correctness");
}

/**
 * MINF — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates that MINF serializes identically to ffmpeg
 * when provided with the same resolved child boxes.
 *
 * All layout and policy decisions are injected.
 */
export async function testMinf_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testMinf_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Read golden truth MINF
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild MINF exclusively from golden truth
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitMinfBox(params)
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "minf.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `minf.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: MINF locked-layout equivalence with ffmpeg");
}
