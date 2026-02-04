/**
 * test_avcC_policy_locked_layout
 * ==============================
 *
 * Locked-layout equivalence test spanning:
 *
 *   semantic avcC
 *        ↓
 * applyAvcCContainerPolicySemantic /
 * applyAvcCContainerPolicyContainerComplete
 *        ↓
 * avcC box emission (via EmitterRegistry)
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

import {
    applyAvcCContainerPolicySemantic,
    applyAvcCContainerPolicyContainerComplete,
} from "../policies/applyAvcCContainerPolicy.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { assertEqual } from "./assertions.js";

export async function test_avcC_policy_locked_layout_container_complete() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const oracleAvcC =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
            )
            .readBoxReport()
            .raw;

    // Emit oracle avcC directly (baseline)
    const oracleBox = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
            { avcC: oracleAvcC }
        )
    );

    const policyOut =
        applyAvcCContainerPolicyContainerComplete({
            avcC: oracleAvcC
        });

    const producedBox = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
            { avcC: policyOut }
        )
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

    // ---------------------------------------------------------
    // Extract oracle avcC payload + raw bytes
    // ---------------------------------------------------------
    const oracleAvcCBox =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
            );

    const oracleAvcC = oracleAvcCBox.getEmitterInput().avcC;
    const oracleBox = oracleAvcCBox.readBoxReport().raw;

    // ---------------------------------------------------------
    // Construct semantic avcC explicitly (strip container extension)
    // ---------------------------------------------------------
    const semanticAvcC = new Uint8Array([
        oracleAvcC[0], // configurationVersion
        oracleAvcC[1], // AVCProfileIndication
        oracleAvcC[2], // profile_compatibility
        oracleAvcC[3], // AVCLevelIndication
        ...oracleAvcC.slice(4, oracleAvcC.length - 4)
    ]);

    // ---------------------------------------------------------
    // Apply container policy (semantic → container-complete)
    // ---------------------------------------------------------
    const completed =
        applyAvcCContainerPolicySemantic({
            avcC: semanticAvcC,
            profileIndication: oracleAvcC[1]
        });

    // ---------------------------------------------------------
    // Emit avcC box from policy output
    // ---------------------------------------------------------
    const producedBox = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
            { avcC: completed }
        )
    );

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual("avcC box size", producedBox.length, oracleBox.length);

    for (let i = 0; i < oracleBox.length; i++) {
        assertEqual(
            `avcC.box.byte[${i}]`,
            producedBox[i],
            oracleBox[i]
        );
    }
}
