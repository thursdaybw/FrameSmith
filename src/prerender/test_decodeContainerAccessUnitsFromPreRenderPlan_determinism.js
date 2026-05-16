/**
 * Pre-Render Execution — Determinism & Idempotence (Contract Test)
 *
 * This test locks the rule that execution MUST be deterministic.
 *
 * Given the same:
 * - PreRenderPlan
 * - decoder inputs
 *
 * Execution MUST produce equivalent outputs across runs.
 *
 * No internal state is allowed to leak between executions.
 */

import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "./decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../../vendor/media-timeline-compiler/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}


/**
 * test_decodeContainerAccessUnit_isDeterministic
 *
 * GIVEN:
 * ------
 * - A PreRenderPlan with container-backed access units
 * - Stateless fake decoders
 *
 * WHEN:
 * -----
 * - decodeContainerAccessUnitsFromPreRenderPlanBatch is invoked multiple times
 *
 * THEN:
 * -----
 * - outputs are structurally equivalent
 * - no execution-time state leaks between runs
 */
async function test_decodeContainerAccessUnit_isDeterministic() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const accessUnitFragment = {
        kind:                     PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind: PreRenderPlanContributorKinds.CONTAINER_TRACK,
        access_units: [
            { pts: 0,    data: new Uint8Array([1]) },
            { pts: 1000, data: new Uint8Array([2]) },
            { pts: 2000, data: new Uint8Array([3]) }
        ]
    };

    const plan = {
        fragments: [ accessUnitFragment ]
    };

    function makeFakeVideoDecoder() {
        return {
            decode() {},
            flush: async () => {}
        };
    }

    // -------------------------------------------------
    // Act
    // -------------------------------------------------

    const resultA = await decodeContainerAccessUnitsFromPreRenderPlanBatch({
        plan,
        videoDecoder: makeFakeVideoDecoder()
    });

    const resultB = await decodeContainerAccessUnitsFromPreRenderPlanBatch({
        plan,
        videoDecoder: makeFakeVideoDecoder()
    });

    // -------------------------------------------------
    // Assert
    // -------------------------------------------------

    assert(
        resultA instanceof DecodedContainerBackedFragmentBatch,
        "first execution must return DecodedContainerBackedFragmentBatch"
    );

    assert(
        resultB instanceof DecodedContainerBackedFragmentBatch,
        "second execution must return DecodedContainerBackedFragmentBatch"
    );

    assert(
        deepEqual(resultA.decodedVideoFrames, resultB.decodedVideoFrames),
        "decodedVideoFrames must be identical across executions"
    );

    assert(
        deepEqual(resultA.decodedAudioData, resultB.decodedAudioData),
        "decodedAudioData must be identical across executions"
    );
}

export const PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DETERMINISM_TESTS = [
    test_decodeContainerAccessUnit_isDeterministic
];
