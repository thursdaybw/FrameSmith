/**
 * STTS Adapter
 * ===========
 *
 * Purpose
 * -------
 * Collapse semantic sample durations into the *restricted*
 * STTS emitter contract.
 *
 * Supported shape (current):
 * - Constant sample duration
 * - Single STTS entry
 *
 * This adapter:
 * - derives meaning
 * - enforces constraints
 * - does NOT emit bytes
 * - does NOT infer policy
 */
export function adaptSttsFromSamples({ samples }) {
    if (!Array.isArray(samples)) {
        throw new Error(
            "adaptSttsFromSamples: samples must be an array"
        );
    }

    if (samples.length === 0) {
        return {
            sampleCount: 0,
            sampleDuration: 0
        };
    }

    const firstDuration = samples[0].duration;

    if (!Number.isInteger(firstDuration) || firstDuration < 0) {
        throw new Error(
            "adaptSttsFromSamples: invalid sample duration"
        );
    }

    for (let i = 1; i < samples.length; i++) {
        if (samples[i].duration !== firstDuration) {
            throw new Error(
                "adaptSttsFromSamples: variable-duration samples are not supported by the STTS emitter"
            );
        }
    }

    return {
        sampleCount: samples.length,
        sampleDuration: firstDuration
    };
}
