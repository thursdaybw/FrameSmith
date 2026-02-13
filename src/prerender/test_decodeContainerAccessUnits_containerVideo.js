/**
 * Pre-Render Execution — Container-Backed Video (Contract Test)
 *
 * This file defines the FIRST execution-phase contract test
 * for FrameSmith pre-render execution.
 *
 * Scope:
 * ------
 * - Container-backed ACCESS-UNITS fragments only
 * - Video domain only
 *
 * What is under test:
 * -------------------
 * - Dispatch by prerenderContributorKind
 * - Decoder invocation wiring
 * - Preservation of PTS through execution
 * - Shape of DecodedContainerBackedFragmentBatch
 *
 * What is explicitly NOT under test:
 * ---------------------------------
 * - Browser decoding correctness
 * - Rendering
 * - Encoding
 * - Muxing
 * - Cross-track synchronisation
 *
 * Architectural role:
 * -------------------
 * This test locks the boundary between:
 *
 *   PreRenderPlan
 *     → Pre-render execution
 *         → Decoded media-domain artifacts
 *
 * If this test breaks, execution semantics have changed
 * and downstream phases (encode, mux) must be reviewed.
 */

import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "./decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../timeline/planFragments.js";

/**
 * NOTE:
 * This test uses a FAKE VideoDecoder.
 * We are testing orchestration, not browser decoding.
 */

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function makeFakeEncodedVideoChunk({ pts }) {
    return {
        timestamp: pts,
        type: "key",
        data: new Uint8Array([1, 2, 3])
    };
}

function makeFakeAccessUnitFragment() {
    return {
        kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.CONTAINER_TRACK,

        access_units: [
            { pts: 0, data: makeFakeEncodedVideoChunk({ pts: 0 }) },
            { pts: 33_333, data: makeFakeEncodedVideoChunk({ pts: 33_333 }) }
        ]
    };
}

/**
 * test_containerBackedVideoExecution_emitsVideoFrames
 *
 * GIVEN:
 * ------
 * - A PreRenderPlan containing a single ACCESS-UNITS fragment
 * - The fragment declares a CONTAINER_TRACK contributor
 * - Two encoded access units with known PTS values
 *
 * WHEN:
 * -----
 * - Pre-render execution is invoked
 *
 * THEN:
 * -----
 * - The container-backed execution path is selected
 * - The video decoder is invoked once per access unit
 * - One decoded frame is produced per access unit
 * - Frame timestamps preserve access-unit PTS
 * - The result conforms to DecodedContainerBackedFragmentBatch
 *
 * This test defines the MINIMUM viable execution behavior
 * for container-backed video tracks.
 */
async function test_decodeContainerAccessUnits_containerVideo() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const plan = {
        fragments: [ makeFakeAccessUnitFragment() ]
    };

    const decodedFrames = [];

    // Fake VideoDecoder injected via execution options
    const fakeVideoDecoder = {
        decode(chunk) {
            decodedFrames.push({
                timestamp: chunk.timestamp,
                _fake: true
            });
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
        Array.isArray(result.decodedVideoFrames),
        "decodedVideoFrames must be an array"
    );

    assert(
        result.decodedVideoFrames.length === 2,
        "must emit one VideoFrame per access unit"
    );

    assert(
        result.decodedVideoFrames[0].timestamp === 0,
        "first frame PTS must be preserved"
    );

    assert(
        result.decodedVideoFrames[1].timestamp === 33_333,
        "second frame PTS must be preserved"
    );

    assert(
        Array.isArray(result.decodedAudioData),
        "decodedAudioData must exist even if empty"
    );

    assert(
        result.decodedAudioData.length === 0,
        "no audio frames expected"
    );
}

export const PRERENDER_DECODE_CONTAINER_VIDEO_TESTS = [
   test_decodeContainerAccessUnits_containerVideo 
];
