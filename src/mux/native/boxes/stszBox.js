/**
 * STSZ — Sample Size Box
 * ---------------------
 * Records the encoded byte size of each media sample in a track.
 *
 * For video tracks:
 *   - one sample == one encoded frame
 *
 * This box answers one question only:
 *
 *   “How many bytes belong to each encoded frame?”
 *
 * It does NOT describe:
 *   - timing
 *   - frame rate
 *   - decode order
 *   - presentation order
 *
 * Those concerns are handled by other boxes (e.g. stts, ctts).
 *
 * ---
 *
 * Variable-size samples are the norm:
 * ----------------------------------
 * Modern video codecs (H.264, H.265, AV1) are predictive.
 * Encoded frame sizes vary naturally due to:
 *   - motion
 *   - inter-frame prediction
 *   - scene changes (IDR frames)
 *
 * Even at a constant frame rate, encoded sizes are not constant.
 *
 * ---
 *
 * Constant-size optimization (and why Framesmith avoids it):
 * ----------------------------------------------------------
 * The MP4 specification allows an optimization:
 *
 *   If *all* samples have identical size:
 *     - `sample_size` may be set to that constant
 *     - the per-sample table may be omitted
 *
 * This is an optimization only.
 *
 * It is unsafe unless the invariant is absolutely true.
 * Declaring a constant size when sizes vary produces an invalid MP4.
 *
 * Framesmith deliberately emits variable-size encoding:
 *   - `sample_size` is always set to 0
 *   - every sample size is explicitly listed
 *
 * This guarantees correctness for all real-world encoders.
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — Sample Size Box (stsz)
 * - MP4 registry: https://mp4ra.org/registered-types/boxes
 * - mp4box.js reference implementation
 */
export function buildStszBox(entries) {

    // ---------------------------------------------------------------------
    // Defensive validation — Category B
    // ---------------------------------------------------------------------

    if (!Array.isArray(entries)) {
        throw new Error(
            "buildStszBox: entries must be an array of sample sizes"
        );
    }

    for (let i = 0; i < entries.length; i++) {
        const size = entries[i];

        if (!Number.isInteger(size) || size < 0) {
            throw new Error(
                `buildStszBox: sample size at index ${i} must be a non-negative integer`
            );
        }
    }

    // `entries` is an array (an object), and in JavaScript objects are passed by reference.
    // We make a copy so later changes to the input array cannot change
    // the contents of this MP4 box after it is built.
    const sizes = entries.slice();

    return {
        // FullBox header (see FullBox.md)
        // - the MP4 specification defines only version 0 for stsz
        // - the specification defines no flags for this box
        type: "stsz",
        version: 0,
        flags: 0,

        body: [
            /**
             * sample_size
             * -----------
             * Declares whether samples use a constant size or per-sample sizes.
             *
             * Spec meaning:
             *   - 0 → sizes are listed explicitly, one per sample
             *   - non-zero → all samples are assumed to have this exact size
             *
             * Framesmith always sets this field to 0.
             *
             * Why this is safe:
             *   - If frames are variable size → required
             *   - If frames are constant size → still valid
             *
             * Why non-zero is dangerous:
             *   - If even one frame differs, declaring a constant size
             *     causes decoders to read the wrong byte offsets
             *   - This corrupts sample boundaries and breaks playback
             *
             * Setting this to 0 is universally correct.
             * Setting it to a constant is an optimization that must be proven.
             */
            { int: 0 },

            /**
             * sample_count
             * ------------
             * The total number of samples (frames) in this track.
             *
             * This value defines how many entries follow in the
             * sample size table below.
             *
             * It must match:
             *   - the number of sample size entries in this box
             *   - the number of samples referenced by stts (timing)
             *   - the number of samples addressed by stsc / stco (offsets)
             *
             * If these counts disagree, the MP4 is structurally invalid.
             */
            { int: sizes.length },

            /**
             * Sample size table
             * -----------------
             * One 32-bit big-endian integer per sample.
             *
             * Each entry declares:
             *   the exact number of bytes occupied by that encoded frame
             *
             * Order is critical.
             * Entry N corresponds to sample N in:
             *   - stts (timing)
             *   - stsc (chunk mapping)
             *   - stco (chunk offsets)
             *
             * This table is used to compute exact byte offsets
             * when reading sample data from the file.
             */
            { array: "int", values: sizes }
        ]
    };
}
