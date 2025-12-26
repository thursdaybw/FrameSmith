import { emitIlstBox } from "../box-emitters/ilstBox.js";
import { emitIlstItemBox } from "../box-emitters/ilstItemBox.js";
import { emitDataBox } from "../box-emitters/dataBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import {
    extractBoxByPathFromMp4
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { extractIlstItemByKeyFromMp4 } from "./reference/BoxExtractor.js";

/**
 * ILST — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates architectural intent of the ilst container.
 *
 * This test asserts:
 *   - ilst is a container box
 *   - children are ilst item atoms
 *   - ordering is preserved
 *
 * This test does NOT:
 *   - inspect ffmpeg output
 *   - validate byte layout
 */
export function testIlst_Structure() {

    console.log("=== testIlst_Structure ===");

    // ---------------------------------------------------------
    // 1. Build one deterministic ilst item
    // ---------------------------------------------------------
    const data = emitDataBox({
        version:  0,
        flags:    1,
        dataType: 1,
        locale:   0,
        payload:  new Uint8Array([0x01, 0x02, 0x03])
    });

    const item = emitIlstItemBox({
        type: "@too",
        data
    });
    // ---------------------------------------------------------
    // 2. Build ILST
    // ---------------------------------------------------------
    const node = emitIlstBox({
        items: [ item ]
    });

    // ---------------------------------------------------------
    // 3. Structural assertions (JSON-level)
    // ---------------------------------------------------------
    assertEqual("ilst.type", node.type, "ilst");

    assertExists("ilst.children", node.children);
    assertEqual("ilst.children.length", node.children.length, 1);

    assertEqual(
        "ilst.child[0].type",
        node.children[0].type,
        "@too"
    );

    // ---------------------------------------------------------
    // 4. Serializer acceptance gate
    // ---------------------------------------------------------
    const out = serializeBoxTree(node);
    assertExists("serialized ilst", out);

    console.log("PASS: ILST structural correctness");
}

/**
 * ILST — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates that ilst serializes byte-for-byte
 * identically to ffmpeg when built from the same meaning.
 *
 * RULE:
 * - All children must be built semantically
 * - No raw byte passthrough
 * - Byte-for-byte is a safety net only
 */
export async function testIlst_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testIlst_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference ilst
    // ---------------------------------------------------------
    const refIlst = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta/ilst"
    );
    assertExists("reference ilst", refIlst);

    // ---------------------------------------------------------
    // 3. Golden truth → direct builder input (STRAIGHT PIPE)
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        refIlst,
        "moov/udta/meta/ilst"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild ILST exclusively from golden truth
    // ---------------------------------------------------------
    const outIlst = serializeBoxTree(
        emitIlstBox(params)
    );

    // ---------------------------------------------------------
    // 5. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual("ilst.size", outIlst.length, refIlst.length);

    for (let i = 0; i < refIlst.length; i++) {
        assertEqualHex(
            `ilst.byte[${i}]`,
            outIlst[i],
            refIlst[i]
        );
    }

    console.log("PASS: ILST locked-layout equivalence with ffmpeg");
}
