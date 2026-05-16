import { collapseDurationsToSttsEntries } from "./adaptStts/helpers/collapseDurationsToSttsEntries.js";

/**
 * adaptSttsWithTailFixFromSamplesAndTrackDuration
 * ===============================================
 *
 * Build STTS entries from samples, reconciling the tail
 * against an authoritative track duration.
 *
 * This is an EXPLICIT remux/oracle reconciliation adapter.
 */
export function adaptSttsWithTailFixFromSamplesAndTrackDuration({
    samples,
    inputTrackDurationInTrackTimescale
}) {

    if (!Number.isInteger(inputTrackDurationInTrackTimescale)) {
        throw new Error(
            "adaptSttsWithTailFixFromSamplesAndTrackDuration: " +
            "authoritative track duration is required"
        );
    }

    assertSamples(samples);

    if (samples.length === 0) {
        return { entries: [] };
    }

    const durations = samples.map((s, i) => {
        if (!Number.isInteger(s.duration) || s.duration < 0) {
            throw new Error(
                `adaptSttsWithTailFixFromSamplesAndTrackDuration: invalid duration at index ${i}`
            );
        }
        return s.duration;
    });

    let accumulated = 0;
    for (let i = 0; i < durations.length - 1; i++) {
        accumulated += durations[i];
    }

    const tail = inputTrackDurationInTrackTimescale - accumulated;

    if (tail > 0) {
        durations[durations.length - 1] = tail;
    }

    return collapseDurationsToSttsEntries(durations);
}

function assertSamples(samples) {
    if (!Array.isArray(samples)) {
        throw new Error("adaptSttsFromSamples: samples must be an array");
    }
}
