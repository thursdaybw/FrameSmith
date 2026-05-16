import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { asIsoBoxContainer } from "../box-model/Box.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * =========================================================
 * UDTA — Structural Correctness (Phase A)
 * =========================================================
 *
 * Validates UDTA as a pure container.
 *
 * - No serialization
 * - No byte inspection
 * - Registry + assembler only
 */
export function testUdta_Structure() {

    const node =
        EmitterRegistry.assemble(
            "moov/udta",
            {
                children: [
                    {
                        type: "meta",
                        hdlr: { nameBytes: new Uint8Array([0]) },
                        ilst: { items: [] }
                    }
                ]
            }
        );

    // -----------------------------------------------------
    // Structural assertions (emitter output)
    // -----------------------------------------------------
    assertEqual("udta.type", node.type, "udta");
    assertExists("udta.children", node.children);
    assertEqual("udta.children.length", node.children.length, 1);
    assertEqual("udta.child[0].type", node.children[0].type, "meta");
}


/**
 * =========================================================
 * UDTA — Locked Layout Equivalence (ffmpeg)
 * =========================================================
 *
 * - Golden Truth is the sole authority
 * - Full rebuild via registry
 * - Byte-for-byte equivalence
 */
export async function testUdta_LockedLayoutEquivalence_ffmpeg() {

    // -----------------------------------------------------
    // 1. Load oracle MP4
    // -----------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -----------------------------------------------------
    // 2. Resolve UDTA via Golden Truth
    // -----------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta"
        );

    if (!truth) {
        console.log("No udta box present in reference MP4");
        return;
    }

    const read   = truth.readBoxReport();
    const params = truth.getEmitterInput();
    const refRaw = read.raw;

    // -----------------------------------------------------
    // 3. Rebuild via registry
    // -----------------------------------------------------
    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/udta",
                params
            )
        );

    // -----------------------------------------------------
    // 4. Full UDTA byte equivalence
    // -----------------------------------------------------
    assertEqual("udta.size", out.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `udta.byte[${i}]`,
            out[i],
            refRaw[i]
        );
    }

    // -----------------------------------------------------
    // 5. Child discovery equivalence (safety)
    // -----------------------------------------------------
    const refContainer =
        asIsoBoxContainer(refRaw, "moov/udta");

    const outContainer =
        asIsoBoxContainer(out, "moov/udta");

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    for (let i = 0; i < refChildren.length; i++) {
        assertEqual(
            `udta.child[${i}].type`,
            outChildren[i].type,
            refChildren[i].type
        );
    }

    assertEqual(
        "udta.child.count",
        outChildren.length,
        refChildren.length
    );

}
