/**
 * STTS — Decoding Time To Sample Box
 * ---------------------------------
 * This box defines how long each media sample lasts in decoding time.
 *
 * Conceptually, STTS is a run-length encoded table:
 *
 *   “For the next N samples, each sample lasts D time units.”
 *
 * Players walk this table to compute decoding timestamps.
 *
 * What STTS does NOT do:
 * ----------------------
 * - It does NOT define presentation order (see CTTS).
 * - It does NOT care about frame reordering or B-frames.
 * - It does NOT encode timestamps directly.
 *
 * Framesmith simplification:
 * --------------------------
 * Framesmith emits a *constant-frame-rate* video stream with:
 * - no B-frames
 * - fixed duration per sample
 *
 * Therefore, STTS always contains exactly one entry:
 *
 *   entry_count  = 1
 *   sample_count = total number of samples
 *   sample_delta = duration of each sample (in timescale ticks)
 *
 * This is valid MP4 and matches ffmpeg output for CFR video.
 *
 * Structure:
 * ----------
 *   entry_count   (uint32)
 *   sample_count  (uint32)
 *   sample_delta  (uint32)
 *
 * This is a FullBox:
 * - version = 0
 * - flags   = 0
 *
 * @param {number} sampleCount
 *   Total number of samples in the track.
 *
 * @param {number} sampleDuration
 *   Duration of each sample, expressed in the media timescale.
 */
export function buildSttsBox(sampleCount, sampleDuration) {

    // ---------------------------------------------------------------------
    // Defensive validation — Category B (shape + sanity only)
    // ---------------------------------------------------------------------

    if (!Number.isInteger(sampleCount) || sampleCount < 0) {
        throw new Error(
            "buildSttsBox: sampleCount must be a non-negative integer"
        );
    }

    if (!Number.isInteger(sampleDuration) || sampleDuration < 0) {
        throw new Error(
            "buildSttsBox: sampleDuration must be a non-negative integer"
        );
    }

    return {
        type: "stts",
        version: 0,
        flags: 0,

        body: [
            /**
             * entry_count (uint32)
             * --------------------
             * Number of (sample_count, sample_delta) entries.
             *
             * Framesmith emits a single entry because all samples
             * have the same duration.
             */
            { int: 1 },

            /**
             * sample_count (uint32)
             * ---------------------
             * Number of consecutive samples that share the same duration.
             *
             * In Framesmith, this is the total number of samples.
             */
            { int: sampleCount },

            /**
             * sample_delta (uint32)
             * ---------------------
             * Duration of each sample, expressed in timescale ticks.
             *
             * Example:
             *   timescale = 90000
             *   sample_delta = 3000  → 30 fps
             */
            { int: sampleDuration }
        ]
    };
}
