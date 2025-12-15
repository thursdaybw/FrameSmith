import { buildAvc1Box } from "./stsdBox/avc1Box.js";

/**
 * STSD — Sample Description Box
 * -----------------------------
 * The Sample Description Box declares *how samples in a track must be interpreted*.
 *
 * It does NOT describe:
 *   - timing (stts)
 *   - sample sizes (stsz)
 *   - chunk layout (stsc)
 *   - byte offsets (stco)
 *
 * Instead, STSD answers one question only:
 *
 *   “What does one sample look like?”
 *
 * In MP4 terminology:
 * -------------------
 * A *sample* is a unit of encoded media.
 * For video, this usually means one encoded frame.
 *
 * A *sample description* is NOT a sample.
 * It is a *schema* describing how samples should be decoded and displayed.
 *
 * This distinction is critical:
 *   - samples live in `mdat`
 *   - sample descriptions live in `stsd`
 *
 * STSD therefore acts as a *type table* for the track.
 *
 * ---
 *
 * Entry count:
 * ------------
 * STSD contains one or more sample entries.
 *
 * Each entry corresponds to a different encoding format
 * (e.g. avc1, hev1, mp4a).
 *
 * Framesmith policy:
 * ------------------
 * Framesmith currently emits **exactly one** sample entry per track.
 *
 * This matches:
 *   - ffmpeg output for simple streams
 *   - browser-generated MP4s
 *   - mp4box.js defaults
 *
 * Multiple entries are only required for:
 *   - codec switching
 *   - alternate encodings
 *   - advanced editing workflows
 *
 * Those concerns belong in higher-level assembly logic,
 * not in this leaf builder.
 *
 * ---
 *
 * Architectural responsibility:
 * ------------------------------
 * STSD does NOT know codec details.
 *
 * It delegates sample-specific structure to a SampleEntry builder:
 *   - H.264 → buildAvc1Box
 *
 * This preserves separation of concerns:
 *   - STSD owns *table structure*
 *   - avc1 owns *codec semantics*
 *
 * ---
 *
 * Phase A contract:
 * -----------------
 * This builder returns a **pure JSON node** describing the STSD box.
 *
 * It does NOT:
 *   - write bytes
 *   - compute sizes
 *   - assume offsets
 *
 * Serialization is handled later by `serializeBoxTree`.
 *
 * This makes STSD:
 *   - testable in isolation
 *   - readable without byte math
 *   - stable under refactor
 *
 * Parameter enforcement:
 * 
 * - Named parameters only
 * - No silent defaults
 * - Closed contract
 * - Explicit required vs optional
 * - Fails early
 */
export function buildStsdBox(params) {
    if (!params || typeof params !== "object") {
        throw new Error("buildStsdBox: parameter object is required");
    }

    // ------------------------------------------------------------------
    // Explicit, closed contract
    // ------------------------------------------------------------------

    const requiredKeys = [
        "width",
        "height",
        "codec",
        "avcC",
        "compressorName",
        "btrt"
    ];

    const allowedKeys = [...requiredKeys];

    // Reject unknown keys
    for (const key of Object.keys(params)) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `buildStsdBox: unknown parameter '${key}'`
            );
        }
    }

    // Reject missing keys (NO defaults, NO silent omission)
    for (const key of requiredKeys) {
        if (!(key in params)) {
            throw new Error(
                `buildStsdBox: missing required parameter '${key}'`
            );
        }
    }

    // ------------------------------------------------------------------
    // Destructure ONLY after contract enforcement
    // ------------------------------------------------------------------

    const {
        width,
        height,
        codec,
        avcC,
        compressorName,
        btrt
    } = params;

    // ------------------------------------------------------------------
    // Field validation
    // ------------------------------------------------------------------

    if (!Number.isInteger(width) || width <= 0) {
        throw new Error(
            "buildStsdBox: width must be a positive integer"
        );
    }

    if (!Number.isInteger(height) || height <= 0) {
        throw new Error(
            "buildStsdBox: height must be a positive integer"
        );
    }

    if (codec !== "avc1") {
        throw new Error(
            "buildStsdBox: only 'avc1' codec is supported"
        );
    }

    if (!(avcC instanceof Uint8Array) || avcC.length === 0) {
        throw new Error(
            "buildStsdBox: avcC must be a non-empty Uint8Array"
        );
    }

    if (typeof compressorName !== "string") {
        throw new Error(
            "buildStsdBox: compressorName must be a string"
        );
    }

    // btrt is REQUIRED for ffmpeg-compatible output
    if (
        typeof btrt !== "object" ||
        btrt === null ||
        !Number.isInteger(btrt.bufferSize) ||
        !Number.isInteger(btrt.maxBitrate) ||
        !Number.isInteger(btrt.avgBitrate)
    ) {
        throw new Error(
            "buildStsdBox: btrt must contain integer bufferSize, maxBitrate, avgBitrate"
        );
    }
    // ------------------------------------------------------------
    // Sample entry delegation
    // ------------------------------------------------------------

    /**
     * SampleEntry
     * -----------
     * This node describes *how* samples are encoded and displayed.
     *
     * For H.264, this is an `avc1` VisualSampleEntry, which itself
     * contains:
     *   - VisualSampleEntry fields (width, height, depth, etc.)
     *   - avcC (decoder configuration record)
     *   - pasp (pixel aspect ratio)
     *   - btrt (bitrate hints)
     *
     * STSD does not inspect or modify this structure.
     */
    const sampleEntry = buildAvc1Box({
        width,
        height,
        avcC,
        compressorName,
        btrt,
    });

    // ------------------------------------------------------------
    // STSD node
    // ------------------------------------------------------------

    return {
        type: "stsd",

        // FullBox header
        version: 0,
        flags: 0,

        body: [
            /**
             * entry_count (uint32)
             * --------------------
             * Number of sample descriptions that follow.
             *
             * Framesmith always emits exactly one entry.
             *
             * This value must match the number of SampleEntry
             * structures that follow.
             */
            { int: 1 },
        ],
        /**
         * SampleEntry[]
         * -------------
         * One or more sample entry boxes.
         *
         * Each entry fully describes how samples
         * in this track must be decoded.
         *
         * Order matters:
         *   sample_description_index in stsc
         *   refers to this table (1-based).
         */
        children: [
            sampleEntry
        ]
    };
}
