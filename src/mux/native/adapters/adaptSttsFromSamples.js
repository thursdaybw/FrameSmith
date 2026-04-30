import { collapseDurationsToSttsEntries } from "./adaptStts/helpers/collapseDurationsToSttsEntries.js";

/**
 * adaptSttsFromSamples
 * ====================
 *
 * Build STTS entries from semantic samples.
 *
 * Rules:
 * 1. Always collapse consecutive equal durations
 *
 * PURE:
 * - No reconciliation
 * - No oracle authority
 *
 * Rules:
 * 1. Always collapse consecutive equal durations
 *
 * TESTS
 *   testNativeMuxer_DeriveSamplesOnePerPacketFromStbl_OpusOracle
 *   testNativeMuxer_AdaptSttsFromSamples_CFR
 *   testNativeMuxer_AdaptSttsFromSamples_VariableDurationGroups
 */
export function adaptSttsFromSamples({ samples }) {

    assertSamples(samples);

    if (samples.length === 0) {
        return { entries: [] };
    }

    const durations = samples.map((s, i) => {
        if (!Number.isInteger(s.duration) || s.duration < 0) {
            throw new Error(
                `adaptSttsFromSamples: invalid duration at index ${i}`
            );
        }
        return s.duration;
    });

    return collapseDurationsToSttsEntries(durations);
}

function assertSamples(samples) {
    if (!Array.isArray(samples)) {
        throw new Error("adaptSttsFromSamples: samples must be an array");
    }
}
