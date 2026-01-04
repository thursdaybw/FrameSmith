/**
 * test_avcC_policy_locked_layout
 * ==============================
 *
 * Locked-layout equivalence test spanning:
 *
 *   semantic avcC
 *        ↓
 * applyAvcCContainerPolicy
 *        ↓
 * emitAvcCBox
 *
 * This test proves that policy + emitter together reproduce
 * the exact avcC box bytes found in a known-good ffmpeg MP4.
 *
 * This is NOT a unit test.
 * This is NOT an end-to-end mux test.
 *
 * This is a seam-locking test.
 */

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitAvcCBox } from "../box-emitters/stsdBox/avcCBox.js";
import { applyAvcCContainerPolicy } from "../policies/applyAvcCContainerPolicy.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual } from "./assertions.js";

export async function test_avcC_policy_locked_layout_container_complete() {
    console.log("=== test_avcC_policy_locked_layout_container_complete ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntry: "avc1",
            trackType: "video"
        }
    );

    const oracleParams = truth.getBuilderInput();

    // Emit oracle avcC directly (baseline for comparison)
    const oracleBox = serializeBoxTree(
        emitAvcCBox({ avcC: oracleParams.avcC })
    );

    const policyOut = applyAvcCContainerPolicy({
        avcC: oracleParams.avcC,
        avcCCompleteness: "container-complete"
    });

    const producedBox = serializeBoxTree(
        emitAvcCBox({ avcC: policyOut })
    );

    assertEqual("avcC box size", producedBox.length, oracleBox.length);

    for (let i = 0; i < oracleBox.length; i++) {
        assertEqual(
            `avcC.box.byte[${i}]`,
            producedBox[i],
            oracleBox[i]
        );
    }

    console.log("PASS: container-complete avcC preserved byte-for-byte");
}

export async function test_avcC_policy_locked_layout_semantic_high_profile() {
    console.log("=== test_avcC_policy_locked_layout_semantic_high_profile ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntry: "avc1",
            trackType: "video"
        }
    );

    const oracleParams = truth.getBuilderInput();

    const oracleBox = serializeBoxTree(
        emitAvcCBox({ avcC: oracleParams.avcC })
    );

    const SEMANTIC_EXTENSION_LENGTH = 4;

    const semanticAvcC = oracleParams.avcC.slice(
        0,
        oracleParams.avcC.length - SEMANTIC_EXTENSION_LENGTH
    );

    const completed = applyAvcCContainerPolicy({
        avcC: semanticAvcC,
        avcCCompleteness: "semantic",
        profileIndication: oracleParams.avcC[1]
    });

    const producedBox = serializeBoxTree(
        emitAvcCBox({ avcC: completed })
    );

    assertEqual("avcC box size", producedBox.length, oracleBox.length);

    for (let i = 0; i < oracleBox.length; i++) {
        assertEqual(
            `avcC.box.byte[${i}]`,
            producedBox[i],
            oracleBox[i]
        );
    }

    console.log("PASS: semantic High Profile avcC completes to oracle");
}
