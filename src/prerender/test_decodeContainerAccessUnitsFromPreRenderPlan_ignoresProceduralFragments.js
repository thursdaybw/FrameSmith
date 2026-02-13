/**
 * Pre-Render Execution — Dispatch Guard (Contract Test)
 *
 * This test locks the rule that execution MUST ignore
 * non-container-backed fragments.
 *
 * Specifically:
 * - PROCEDURAL fragments must not affect execution
 * - Only ACCESS_UNITS fragments with CONTAINER_TRACK
 *   contributors are eligible for execution
 *
 * This protects execution from future procedural
 * implementations interfering with container-backed paths.
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
 * test_decodeContainerAccessUnits_ignoresProceduralFragments
 *
 * GIVEN:
 * ------
 * - A PreRenderPlan containing:
 *   - one container-backed ACCESS_UNITS fragment
 *   - one PROCEDURAL fragment
 *
 * WHEN:
 * -----
 * - decodeContainerAccessUnitsFromPreRenderPlanBatch is invoked
 *
 * THEN:
 * -----
 * - execution processes ONLY the access-units fragment
 * - procedural fragments are ignored entirely
 * - output is derived solely from container-backed units
 */
async function test_decodeContainerAccessUnits_ignoresProceduralFragments() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const accessUnitFragment = {
        kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.CONTAINER_TRACK,
        access_units: [
            { pts: 0, data: new Uint8Array([1]) },
            { pts: 1000, data: new Uint8Array([2]) }
        ]
    };

    const proceduralFragment = {
        kind: PreRenderPlanFragmentKinds.PROCEDURAL,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.PROCEDURAL,
        proceduralKind: "text-overlay",
        items: [
            { text: "SHOULD NOT RUN" }
        ]
    };

    const plan = {
        fragments: [
            accessUnitFragment,
            proceduralFragment
        ]
    };

    const decodedVideo = [];

    const fakeVideoDecoder = {
        decode(chunk) {
            decodedVideo.push(chunk);
        },
        flush: async () => {}
    };

    // -------------------------------------------------
    // Act
    // -------------------------------------------------

    const result = await decodeContainerAccessUnitsFromPreRenderPlanBatch({
        plan,
        videoDecoder: fakeVideoDecoder
    });

    // -------------------------------------------------
    // Assert
    // -------------------------------------------------

    assert(
        result instanceof DecodedContainerBackedFragmentBatch,
        "execution must return DecodedContainerBackedFragmentBatch"
    );

    assert(
        decodedVideo.length === 2,
        "decoder must be called only for access units"
    );

    assert(
        result.decodedVideoFrames.length === 2,
        "decodedVideoFrames must be produced only from access units"
    );

    assert(
        result.decodedAudioData.length === 0,
        "procedural fragments must not produce audio output"
    );
}

export const PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DISPATCH_TESTS = [
    test_decodeContainerAccessUnits_ignoresProceduralFragments
];
