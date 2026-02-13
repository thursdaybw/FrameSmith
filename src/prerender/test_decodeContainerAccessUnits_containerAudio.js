/**
 * Pre-Render Container Decode — Audio
 *
 * This file defines the execution-phase contract for
 * container-backed AUDIO tracks.
 *
 * Scope:
 * ------
 * - Container-backed ACCESS-UNITS fragments
 * - Audio domain only
 *
 * What is under test:
 * -------------------
 * - Dispatch by prerenderContributorKind
 * - Audio decoder invocation wiring
 * - Preservation of PTS through execution
 * - Shape of DecodedContainerBackedFragmentBatch
 *
 * What is explicitly NOT under test:
 * ---------------------------------
 * - Audio decoding correctness
 * - Rendering or mixing
 * - Encoding
 * - Muxing
 * - Cross-track synchronisation
 *
 * This test MUST remain structurally symmetric with
 * the container-backed video execution test.
 */

import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "./decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../timeline/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function makeFakeEncodedAudioChunk({ pts }) {
    return {
        timestamp: pts,
        data: new Uint8Array([9, 9, 9])
    };
}

function makeFakeAccessUnitFragment() {
    return {
        kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.CONTAINER_TRACK,

        access_units: [
            { pts: 0, data: makeFakeEncodedAudioChunk({ pts: 0 }) },
            { pts: 21_333, data: makeFakeEncodedAudioChunk({ pts: 21_333 }) }
        ]
    };
}

/**
 * test_containerBackedAudioExecution_emitsAudioFrames
 *
 * GIVEN:
 * ------
 * - A PreRenderPlan containing a single ACCESS-UNITS fragment
 * - The fragment declares a CONTAINER_TRACK contributor
 * - Two encoded audio access units with known PTS values
 *
 * WHEN:
 * -----
 * - Pre-render execution is invoked
 *
 * THEN:
 * -----
 * - The container-backed execution path is selected
 * - The audio decoder is invoked once per access unit
 * - One AudioData-like output is produced per access unit
 * - Frame timestamps preserve access-unit PTS
 * - No video frames are emitted
 *
 * This test mirrors container-backed video execution,
 * locking in audio/video symmetry at the execution boundary.
 */
async function test_decodeContainerAccessUnits_containerAudio() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const plan = {
        fragments: [ makeFakeAccessUnitFragment() ]
    };

    const decodedAudio = [];

    const fakeAudioDecoder = {
        decode(chunk) {
            decodedAudio.push({
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
        Array.isArray(result.decodedAudioData),
        "decodedAudioData must be an array"
    );

    assert(
        result.decodedAudioData.length === 2,
        "must emit one audio frame per access unit"
    );

    assert(
        result.decodedAudioData[0].timestamp === 0,
        "first audio frame PTS must be preserved"
    );

    assert(
        result.decodedAudioData[1].timestamp === 21_333,
        "second audio frame PTS must be preserved"
    );

    assert(
        Array.isArray(result.decodedVideoFrames),
        "decodedVideoFrames must exist even if empty"
    );

    assert(
        result.decodedVideoFrames.length === 0,
        "no video frames expected"
    );
}

export const PRERENDER_DECODE_CONTAINER_AUDIO_TESTS = [
    test_decodeContainerAccessUnits_containerAudio
];
