import { deriveTrackDuration } from "../derivers/deriveTrackDuration.js";

/**
 * deriveTrackDuration — semantic derivation tests
 *
 * These tests verify that track duration is derived purely from
 * semantic sample durations, with no MP4 or container assumptions.
 */

export function testNativeMuxer_trackDurationDerivation_basicSum() {

    console.log("=== testNativeMuxer_trackDurationDerivation_basicSum ===");

    const samples = [
        { duration: 100 },
        { duration: 200 },
        { duration: 300 }
    ];

    const duration = deriveTrackDuration({ samples });

    if (duration !== 600) {
        throw new Error(
            `deriveTrackDuration failed: expected 600, got ${duration}`
        );
    }

    console.log("PASS: basic duration sum");
}


export function testNativeMuxer_trackDurationDerivation_emptySamples() {

    console.log("=== testNativeMuxer_trackDurationDerivation_emptySamples ===");

    const samples = [];

    const duration = deriveTrackDuration({ samples });

    if (duration !== 0) {
        throw new Error(
            `deriveTrackDuration failed: expected 0, got ${duration}`
        );
    }

    console.log("PASS: empty samples yield zero duration");
}


export function testNativeMuxer_trackDurationDerivation_invalidSampleThrows() {

    console.log("=== testNativeMuxer_trackDurationDerivation_invalidSampleThrows ===");

    const samples = [
        { duration: 100 },
        { duration: -1 } // invalid
    ];

    let threw = false;

    try {
        deriveTrackDuration({ samples });
    } catch (err) {
        threw = true;
    }

    if (!threw) {
        throw new Error(
            "deriveTrackDuration failed: expected error for invalid sample duration"
        );
    }

    console.log("PASS: invalid sample duration throws");
}
