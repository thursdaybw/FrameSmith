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
 *   “How many bytes belong to each encoded sample?”
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
 * Two valid STSZ layouts
 * ---------------------
 *
 * The MP4 specification defines two equivalent representations:
 *
 * 1. Variable-size form (sampleSize == 0)
 *    - A size entry is listed for every sample
 *    - This form is universally valid
 *    - Required when sample sizes are not identical
 *
 * 2. Fixed-size form (sampleSize != 0)
 *    - Declares all samples have the same byte size
 *    - The per-sample table is omitted
 *    - This is an optimization only
 *
 * Both forms describe the same semantic fact, but with different
 * structural encodings.
 *
 * ---
 *
 * Why the distinction matters
 * ---------------------------
 *
 * Modern codecs often produce variable-sized samples:
 *   - inter-frame prediction
 *   - motion complexity
 *   - scene changes (IDR frames)
 *
 * Declaring a fixed sample size when sizes vary produces
 * an invalid MP4 and corrupts sample boundaries.
 *
 * For this reason, fixed-size encoding is only safe when
 * the invariant is absolutely proven.
 *
 * ---
 *
 * NativeMuxer design
 * ------------------
 *
 * NativeMuxer treats STSZ layout as a *structural choice*, not
 * a semantic one.
 *
 * - Sample sizes are derived upstream
 * - The assembler selects either the fixed or variable layout
 * - The emitter remains a dumb serializer
 *
 * This allows:
 *   - byte-for-byte conformance with external encoders (e.g. FFmpeg)
 *   - explicit control over optimization vs safety
 *   - deterministic, testable output
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — Sample Size Box (stsz)
 * - MP4 registry: https://mp4ra.org/registered-types/boxes
 * - mp4box.js reference implementation
 */
function emitStszBox({ sampleSize, sampleCount, sizes }) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------

    if (!Number.isInteger(sampleSize) || sampleSize < 0) {
        throw new Error(
            `emitStszBox: sampleSize must be a non-negative integer, received ${sampleSize}`
        );
    }

    if (!Number.isInteger(sampleCount) || sampleCount < 0) {
        throw new Error(
            `emitStszBox: sampleCount must be a non-negative integer, received ${sampleCount}`
        );
    }

    // Variable-size form requires explicit sizes
    if (sampleSize === 0) {

        if (!Array.isArray(sizes)) {
            throw new Error(
                `emitStszBox: sizes must be an array when sampleSize == 0, received ${typeof sizes}`
            );
        }

        if (sizes.length !== sampleCount) {
            throw new Error(
                `emitStszBox: sizes.length (${sizes.length}) must equal sampleCount (${sampleCount})`
            );
        }

        for (let i = 0; i < sizes.length; i++) {
            const size = sizes[i];

            if (!Number.isInteger(size) || size < 0) {
                throw new Error(
                    `emitStszBox: sample size at index ${i} must be a non-negative integer, received ${size}`
                );
            }
        }
    }

    // Fixed-size form must NOT include a sizes table
    if (sampleSize !== 0 && sizes !== undefined) {
        throw new Error(
            `emitStszBox: sizes must be omitted when sampleSize != 0 (received sampleSize=${sampleSize}, sizes.length=${sizes?.length})`
        );
    }

    // ---------------------------------------------------------
    // Box construction
    // ---------------------------------------------------------

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
             * Framesmith normally sets this field to 0.
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
            { int: sampleSize },

            /**
             * sample_count
             * ------------
             * The total number of samples (frames) in this track.
             *
             * This value defines how many entries follow in the
             * sample size table below (when present).
             *
             * It must match:
             *   - the number of sample size entries in this box
             *   - the number of samples referenced by stts (timing)
             *   - the number of samples addressed by stsc / stco (offsets)
             *
             * If these counts disagree, the MP4 is structurally invalid.
             */
            { int: sampleCount },

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
            ...(sampleSize === 0
                ? [{ array: "int", values: sizes.slice() }]
                : [])
        ]
    };
}

export function registerStszFixedEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsz|fixed",
        emitStszBox
    );
}

export function registerStszVariableEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsz|variable",
        emitStszBox
    );
}
