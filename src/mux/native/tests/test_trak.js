import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { emitEdtsBox } from "../box-emitters/edtsBox.js";
import { emitElstBox } from "../box-emitters/elstBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex,
} from "./assertions.js";

import { asContainer } from "../box-model/Box.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * TRAK — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates the structural intent of the Track Box.
 *
 * This test does NOT:
 *   - interpret track flags
 *   - test timing or samples
 *   - test byte equivalence
 *
 * It asserts only what TRAK is responsible for:
 *   - container presence
 *   - required children
 *   - canonical ordering
 */
export async function testTrak_Structure() {

    console.log("=== testTrak_Structure ===");

    // ---------------------------------------------------------
    // 1. Explicit children (policy injected by test)
    // ---------------------------------------------------------
    const tkhd = { type: "tkhd", body: [] };
    const mdia = { type: "mdia", body: [] };

    // ---------------------------------------------------------
    // 2. Build TRAK
    // ---------------------------------------------------------
    const node = emitTrakBox({
        tkhd,
        mdia
    });

    const trak = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    assertExists("tkhd", extractChildBoxFromContainer(trak, "tkhd"));
    assertExists("mdia", extractChildBoxFromContainer(trak, "mdia"));

    // ---------------------------------------------------------
    // 4. Ordering assertions
    // ---------------------------------------------------------
    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "trak.childCount",
        childTypes.length,
        2
    );

    assertEqual(
        "trak.childOrder",
        childTypes.join(","),
        "tkhd,mdia"
    );

    console.log("PASS: TRAK structural correctness");
}

/**
 * TRAK — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * This test validates TRAK as a pure container.
 *
 * RULE (NON-NEGOTIABLE):
 *   Every child must be constructed from meaning.
 *   Raw byte passthrough is forbidden.
 *
 * If a required child cannot yet be built semantically,
 * this test MUST fail.
 */
export async function testTrak_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testTrak_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference TRAK
    // ---------------------------------------------------------
    const refTrak = extractBoxByPathFromMp4(
        goldenMp4,
        "moov/trak"
    );
    assertExists("reference trak", refTrak);

    // ---------------------------------------------------------
    // 3. Build TRAK exclusively from golden truth
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        goldenMp4,
        "moov/trak"
    );

    const params = truth.getBuilderInput();

    const outTrak = serializeBoxTree(
        emitTrakBox(params)
    );

    // ---------------------------------------------------------
    // 4. Discover children (semantic layer)
    // ---------------------------------------------------------
    const refContainer = asContainer(refTrak);
    const outContainer = asContainer(outTrak);

    const refMeta = refContainer.enumerateChildren();
    const outMeta = outContainer.enumerateChildren();

    const refTypes = refMeta.map(c => c.type);
    const outTypes = outMeta.map(c => c.type);

    // ---------------------------------------------------------
    // 5. Canonical child ordering
    // ---------------------------------------------------------
    assertEqual(
        "trak.childOrder",
        outTypes.join(","),
        refTypes.join(",")
    );

    // ---------------------------------------------------------
    // 6. Child-by-child byte equivalence
    // ---------------------------------------------------------
    for (const { type } of refMeta) {
        const refChild = extractChildBoxFromContainer(refTrak, type);
        const outChild = extractChildBoxFromContainer(outTrak, type);

        for (let i = 0; i < refChild.length; i++) {
            assertEqualHex(
                `trak.${type}.byte[${i}]`,
                outChild[i],
                refChild[i]
            );
        }

        assertEqual(
            `trak.${type}.size`,
            outChild.length,
            refChild.length
        );
    }

    // ---------------------------------------------------------
    // 7. Full TRAK byte equivalence (safety net)
    // ---------------------------------------------------------
    for (let i = 0; i < refTrak.length; i++) {
        assertEqualHex(
            `trak.byte[${i}]`,
            outTrak[i],
            refTrak[i]
        );
    }

    console.log("PASS: TRAK locked-layout equivalence with ffmpeg");
}

