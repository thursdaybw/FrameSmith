/**
 * STTS Adapter
 * ===========
 *
 * Purpose
 * -------
 * Collapse semantic sample durations into STTS run-length entries.
 *
 * This adapter:
 * - derives meaning
 * - preserves real-world timing variance
 * - performs no policy decisions
 * - does NOT emit bytes
 *
 * Output shape matches STTS semantics directly.
 */
export function adaptSttsFromSamples({ samples, sttsPolicy = "canonical" }) {

    if (!Array.isArray(samples)) {
        throw new Error(
            "adaptSttsFromSamples: samples must be an array"
        );
    }

    if (samples.length === 0) {
        return { entries: [] };
    }

    if (sttsPolicy === "oracle-faithful") {
        return adaptSttsOracleFaithful({ samples });
    }

    const entries = [];

    let currentDelta = samples[0].duration;
    let currentCount = 1;

    if (!Number.isInteger(currentDelta) || currentDelta < 0) {
        throw new Error(
            "adaptSttsFromSamples: invalid sample duration"
        );
    }

    for (let i = 1; i < samples.length; i++) {
        const delta = samples[i].duration;

        if (!Number.isInteger(delta) || delta < 0) {
            throw new Error(
                "adaptSttsFromSamples: invalid sample duration"
            );
        }

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

    return { entries };
}

function adaptSttsOracleFaithful({ samples }) {
    // Oracle behaviour:
    // - preserve run boundaries as observed
    // - do not over-collapse identical deltas

    const entries = [];

    let currentDelta = samples[0].duration;
    let currentCount = 1;

    for (let i = 1; i < samples.length; i++) {
        const delta = samples[i].duration;

        if (delta === currentDelta) {
            currentCount++;
            continue;
        }

        entries.push({
            sampleCount: currentCount,
            sampleDelta: currentDelta
        });

        currentDelta = delta;
        currentCount = 1;
    }

    entries.push({
        sampleCount: currentCount,
        sampleDelta: currentDelta
    });

    return { entries };
}
