/**
 * Pre-Render Execution — Empty Access-Units Handling (Contract Test)
 *
 * This test locks the rule that execution must behave
 * correctly when there are NO container-backed access units.
 *
 * Absence is explicit:
 * - no ACCESS_UNITS fragments
 * - no decoder calls
 * - empty execution result
 *
 * There are no "empty fragment" special cases.
 */

import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "./decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../timeline/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

/**
 * test_decodeContainerAccessUnits_withNoAccessUnitFragments_emitsEmptyResult
 *
 * GIVEN:
 * ------
 * - A PreRenderPlan with no ACCESS_UNITS fragments
 * - Only PROCEDURAL fragments present
 *
 * WHEN:
 * -----
 * - decodeContainerAccessUnitsFromPreRenderPlanBatch is invoked
 *
 * THEN:
 * -----
 * - no decoders are called
 * - execution returns empty decodedVideoFrames and decodedAudioData
 * - absence is handled explicitly, not as a special case
 */
async function test_decodeContainerAccessUnits_withNoAccessUnitFragments_emitsEmptyResult() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const proceduralFragment = {
        kind: PreRenderPlanFragmentKinds.PROCEDURAL,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.PROCEDURAL,
        proceduralKind: "text-overlay",
        items: [
            { text: "This should be ignored" }
        ]
    };

    const plan = {
        fragments: [ proceduralFragment ]
    };

    let videoDecodeCalls = 0;
    let audioDecodeCalls = 0;

    const fakeVideoDecoder = {
        decode() {
            videoDecodeCalls++;
        },
        flush: async () => {}
    };

    const fakeAudioDecoder = {
        decode() {
            audioDecodeCalls++;
        },
        flush: async () => {}
    };

    // -------------------------------------------------
    // Act
    // -------------------------------------------------

    const result = await decodeContainerAccessUnitsFromPreRenderPlanBatch({
        plan,
        videoDecoder: fakeVideoDecoder,
        audioDecoder: fakeAudioDecoder
    });

    // -------------------------------------------------
    // Assert
    // -------------------------------------------------

    assert(
        result instanceof DecodedContainerBackedFragmentBatch,
        "execution must return DecodedContainerBackedFragmentBatch"
    );

    assert(
        Array.isArray(result.decodedVideoFrames),
        "decodedVideoFrames must be an array"
    );

    assert(
        Array.isArray(result.decodedAudioData),
        "decodedAudioData must be an array"
    );

    assert(
        result.decodedVideoFrames.length === 0,
        "no access-units means no video frames"
    );

    assert(
        result.decodedAudioData.length === 0,
        "no access-units means no audio frames"
    );

    assert(
        videoDecodeCalls === 0,
        "video decoder must not be called"
    );

    assert(
        audioDecodeCalls === 0,
        "audio decoder must not be called"
    );
}

export const PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_EMPTY_PLAN_TESTS = [
    test_decodeContainerAccessUnits_withNoAccessUnitFragments_emitsEmptyResult
];
