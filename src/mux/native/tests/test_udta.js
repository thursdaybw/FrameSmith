import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
} from "./assertions.js";

import { asContainer } from "../box-model/Box.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * =========================================================
 * UDTA — Structural Correctness (Phase A)
 * =========================================================
 *
 * Validates UDTA as a pure container.
 *
 * This test asserts:
 *   - udta is a container
 *   - children are preserved
 *   - ordering is preserved
 *
 * This test does NOT:
 *   - interpret child semantics
 *   - assert byte equivalence
 */
export function testUdta_Structure() {

    console.log("=== testUdta_Structure ===");

    // -----------------------------------------------------
    // 1. Minimal valid child (meta)
    // -----------------------------------------------------
    const meta = { type: "meta", children: [] };

    // -----------------------------------------------------
    // 2. Build UDTA
    // -----------------------------------------------------
    const node = emitUdtaBox({
        children: [meta]
    });

    const udta = serializeBoxTree(node);

    // -----------------------------------------------------
    // 3. Structural assertions
    // -----------------------------------------------------
    const container = asContainer(udta);
    const children = container.enumerateChildren();

    assertEqual("udta.child.count", children.length, 1);
    assertEqual("udta.child[0].type", children[0].type, "meta");

    console.log("PASS: UDTA structural correctness");
}


/**
 * =========================================================
 * UDTA — Locked Layout Equivalence (ffmpeg)
 * =========================================================
 *
 * Validates that UDTA is rebuilt byte-for-byte identical
 * to ffmpeg output, given identical semantic children.
 *
 * RULE (NON-NEGOTIABLE):
 *   - No raw byte passthrough
 *   - Every child must be rebuilt semantically
 */
export async function testUdta_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testUdta_LockedLayoutEquivalence_ffmpeg ===");

    // -----------------------------------------------------
    // 1. Load golden MP4
    // -----------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    // -----------------------------------------------------
    // 2. Extract reference UDTA
    // -----------------------------------------------------
    const refUdta = extractBoxByPathFromMp4(
        goldenMp4,
        "moov/udta"
    );

    if (!refUdta) {
        console.log("No udta box present in reference MP4");
        return;
    }

    // -----------------------------------------------------
    // 3. Discover reference children
    // -----------------------------------------------------
    const refContainer = asContainer(refUdta);
    const refChildrenMeta = refContainer.enumerateChildren();
    const refTypes = refChildrenMeta.map(c => c.type);

    console.log("Reference UDTA children:", refTypes.join(", "));

    // -----------------------------------------------------
    // 4. Golden truth → direct rebuild
    // -----------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        refUdta,
        "moov/udta"
    );

    const outUdta = serializeBoxTree(
        emitUdtaBox(truth.getBuilderInput())
    );

    // -----------------------------------------------------
    // 5. Discover output children
    // -----------------------------------------------------
    const outContainer = asContainer(outUdta);
    const outChildrenMeta = outContainer.enumerateChildren();
    const outTypes = outChildrenMeta.map(c => c.type);

    // -----------------------------------------------------
    // 6. Discovery gates
    // -----------------------------------------------------
    assertEqual(
        "udta.child.count",
        outChildrenMeta.length,
        refChildrenMeta.length
    );

    for (let i = 0; i < refTypes.length; i++) {
        assertEqual(
            `udta.child[${i}].type`,
            outTypes[i],
            refTypes[i]
        );
    }

    // -----------------------------------------------------
    // 7. Child-by-child byte equivalence
    // -----------------------------------------------------
    for (const type of refTypes) {

        const ref = extractChildBoxFromContainer(refUdta, type);
        const out = extractChildBoxFromContainer(outUdta, type);

        for (let i = 0; i < ref.length; i++) {
            assertEqualHex(
                `${type}.byte[${i}]`,
                out[i],
                ref[i]
            );
        }

        assertEqual(`${type}.size`, out.length, ref.length);
    }

    // -----------------------------------------------------
    // 9. Full UDTA equivalence (safety net)
    // -----------------------------------------------------
    assertEqual("udta.size", outUdta.length, refUdta.length);

    for (let i = 0; i < refUdta.length; i++) {
        assertEqualHex(
            `udta.byte[${i}]`,
            outUdta[i],
            refUdta[i]
        );
    }

    console.log("PASS: UDTA locked-layout equivalence with ffmpeg");
}
