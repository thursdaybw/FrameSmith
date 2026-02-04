/**
 * adaptSttsFromSamples
 * ====================
 *
 * Build STTS entries from semantic samples.
 *
 * Rules:
 * 1. Always collapse consecutive equal durations
 * 2. If inputTrackDurationInTrackTimescale is provided and the total
 *    does not match, adjust the final sample duration (tail)
 *
 * TESTS
 *   testNativeMuxer_DeriveSamplesOnePerPacketFromStbl_OpusOracle
 *   testNativeMuxer_AdaptSttsFromSamples_CFR
 *   testNativeMuxer_AdaptSttsFromSamples_VariableDurationGroups
 */
export function adaptSttsFromSamples({
    samples,
    inputTrackDurationInTrackTimescale
}) {

    assertSamples(samples);

    if (samples.length === 0) {
        return { entries: [] };
    }

    // ---------------------------------------------------------
    // Extract per-sample durations
    // ---------------------------------------------------------
    const durations = samples.map((s, i) => {
        if (!Number.isInteger(s.duration) || s.duration < 0) {
            throw new Error(
                `adaptSttsFromSamples: invalid duration at index ${i}`
            );
        }
        return s.duration;
    });

    // ---------------------------------------------------------
    // Reconcile tail if authoritative track duration supplied
    // ---------------------------------------------------------
    if (Number.isInteger(inputTrackDurationInTrackTimescale)) {

        let accumulated = 0;
        for (let i = 0; i < durations.length - 1; i++) {
            accumulated += durations[i];
        }

        const tail = inputTrackDurationInTrackTimescale - accumulated;

        if (tail > 0) {
            durations[durations.length - 1] = tail;
        }
    }

    // ---------------------------------------------------------
    // Collapse consecutive equal durations into STTS runs
    // ---------------------------------------------------------
    const entries = [];

    let currentDelta = durations[0];
    let currentCount = 1;

    for (let i = 1; i < durations.length; i++) {
        const delta = durations[i];

        if (delta === currentDelta) {
            currentCount++;
        } else {
            entries.push({
                sampleCount: currentCount,
                sampleDelta: currentDelta
            });
            currentDelta = delta;
            currentCount = 1;
        }
    }

    entries.push({
        sampleCount: currentCount,
        sampleDelta: currentDelta
    });

    // ---------------------------------------------------------
    return { entries };
}

function assertSamples(samples) {
    if (!Array.isArray(samples)) {
        throw new Error("adaptSttsFromSamples: samples must be an array");
    }
}
