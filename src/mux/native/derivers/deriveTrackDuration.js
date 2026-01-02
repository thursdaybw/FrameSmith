/**
 * deriveTrackDuration
 * ===================
 *
 * Derives the total duration of a media track from semantic samples.
 *
 * This function answers one question:
 *
 *   “Given these samples, how long does this track last?”
 *
 * ---
 *
 * Architectural role:
 * -------------------
 * This is a **derivation**.
 *
 * It:
 * - consumes semantic input (samples)
 * - produces a structural fact (track duration)
 * - performs no I/O
 * - applies no container policy
 * - assumes no MP4-specific behavior
 *
 * It exists at the same layer as:
 * - deriveChunkModel
 * - deriveStscEntries
 *
 * It is deliberately separate from:
 * - emitMdhdBox (which only *declares* duration)
 * - adapters (which translate shapes)
 *
 * ---
 *
 * Definition of duration (v1):
 * ----------------------------
 * Track duration is defined as:
 *
 *   the sum of all sample durations
 *
 * This is the only definition that is:
 * - deterministic
 * - codec-agnostic
 * - independent of PTS/DTS ordering
 * - valid before edit lists or composition rules exist
 *
 * Future features (edit lists, gaps, trimming) may introduce
 * additional derivation layers, but this rule remains foundational.
 *
 * ---
 *
 * Error handling philosophy:
 * --------------------------
 * This function fails fast.
 *
 * If samples are malformed, the caller must fix the fixture or adapter.
 * Silent coercion here would hide upstream errors and corrupt timing.
 *
 * ---
 *
 * @param {Object} params
 * @param {Array<Object>} params.samples
 * @returns {number} duration (in track timescale units)
 */
export function deriveTrackDuration({ samples }) {

    // -----------------------------------------------------------------
    // Contract validation
    // -----------------------------------------------------------------
    if (!Array.isArray(samples)) {
        throw new Error(
            "deriveTrackDuration: samples must be an array"
        );
    }

    let totalDuration = 0;

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];

        if (
            !sample ||
            !Number.isInteger(sample.duration) ||
            sample.duration < 0
        ) {
            throw new Error(
                `deriveTrackDuration: invalid duration at sample index ${i}`
            );
        }

        totalDuration += sample.duration;
    }

    return totalDuration;
}
