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
//import { emitAvcCBox } from "../box-emitters/stsdBox/avcCBox.js";
import { applyAvcCContainerPolicy } from "../policies/applyAvcCContainerPolicy.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual } from "./assertions.js";

export async function test_avcC_policy_locked_layout_container_complete() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const avcCTruth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    );

    const oracleAvcC = avcCTruth.readBoxReport().raw;

    // Emit oracle avcC directly (baseline for comparison)
    const oracleBox = serializeBoxTree(
        emitAvcCBox({ avcC: oracleAvcC })
    );

    const policyOut = applyAvcCContainerPolicy({
        avcC: oracleAvcC,
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

}

export async function test_avcC_policy_locked_layout_semantic_high_profile() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const avcCTruth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    );

    const oracleAvcC = avcCTruth.getEmitterInput().avcC;

    const oracleBox = serializeBoxTree(
        emitAvcCBox({ avcC: oracleAvcC })
    );

    // ---------------------------------------------------------
    // Construct semantic avcC explicitly (no container extension)
    // ---------------------------------------------------------
    const semanticAvcC = new Uint8Array([
        oracleAvcC[0], // configurationVersion
        oracleAvcC[1], // AVCProfileIndication
        oracleAvcC[2], // profile_compatibility
        oracleAvcC[3], // AVCLevelIndication
        ...oracleAvcC.slice(4, oracleAvcC.length - 4)
    ]);

    const completed = applyAvcCContainerPolicy({
        avcC: semanticAvcC,
        avcCCompleteness: "semantic",
        profileIndication: oracleAvcC[1]
    });

    const producedBox = serializeBoxTree(
        emitAvcCBox({ avcC: completed })
    );

    for (let i = 0; i < oracleBox.length; i++) {
        assertEqual(
            `avcC.box.byte[${i}]`,
            producedBox[i],
            oracleBox[i]
        );
    }

    assertEqual("avcC box size", producedBox.length, oracleBox.length);
}
