/**
 * TKHD — Track Header Box
 * ----------------------
 * Declares high-level, track-wide metadata.
 *
 * This box answers questions like:
 *   - What is this track’s numeric ID?
 *   - How long does this track last?
 *   - How large is the visual presentation?
 *
 * It does NOT describe:
 *   - codec configuration        (stsd / avcC)
 *   - sample timing rules        (stts / ctts)
 *   - sample sizes or locations  (stsz / stco)
 *
 * Think of tkhd as:
 *   “This track exists, it lasts this long, and this is how big it is.”
 *
 * ---
 *
 * Framesmith design principles:
 * -----------------------------
 * Framesmith emits the **canonical, modern tkhd form**:
 *
 *   - version = 0 (32-bit fields)
 *   - all timestamps = 0 (unused by modern players)
 *   - fixed identity matrix
 *   - fixed flags marking the track as enabled and visible
 *
 * This matches:
 *   - ffmpeg output
 *   - mp4box.js output
 *   - browser-generated MP4s
 *
 * ---
 *
 * Why so many fields are hard-coded:
 * ---------------------------------
 * tkhd originates from QuickTime (early 1990s).
 * Many fields existed for editing workflows that no longer apply.
 *
 * Modern players:
 *   - ignore creation/modification time
 *   - ignore layer and alternate_group
 *   - ignore matrix unless it is invalid
 *
 * But the *presence and correctness* of these fields
 * is still required for a structurally valid MP4.
 *
 * Hard-coding them is not laziness.
 * It is correctness.
 *
 * ---
 *
 * @param {Object} params
 * @param {number} params.width           Display width (integer pixels)
 * @param {number} params.height          Display height (integer pixels)
 * @param {number} params.widthFraction   Fractional width (0–65535)
 * @param {number} params.heightFraction  Fractional height (0–65535)
 * @param {number} params.duration        Track duration in movie timescale units
 * @param {number} params.trackId         Unique track identifier (1-based)
 *
 * @returns {object} BoxNode
 */

// ---------------------------------------------------------------------------
// TKHD flag vocabulary
// ---------------------------------------------------------------------------
//
// Track Header flags declare how this track participates in playback.
//
// Modern MP4 practice (ffmpeg, mp4box.js, browsers):
//   - track_enabled   → the track is active
//   - track_in_movie  → the track participates in the presentation
//
// Historical note:
//   - track_in_preview comes from QuickTime preview modes
//   - It is deprecated
//   - Modern encoders do NOT emit it
//   - Emitting it breaks byte-for-byte conformance
//
const TKHD_FLAG_BITS = {
    enabled:    0x000001, // track_enabled
    inMovie:    0x000002, // track_in_movie
    inPreview:  0x000004, // deprecated, intentionally unused
};

export function emitTkhdBox({
    width,
    height,
    widthFraction,
    heightFraction,
    duration,
    trackId
}) {

    if (!Number.isInteger(width) || width < 0) {
        throw new Error(
            "emitTkhdBox: width must be a non-negative integer"
        );
    }

    if (!Number.isInteger(height) || height < 0) {
        throw new Error(
            "emitTkhdBox: height must be a non-negative integer"
        );
    }

    if (!Number.isInteger(widthFraction) ||
        widthFraction < 0 ||
        widthFraction > 0xFFFF) {
        throw new Error(
            "emitTkhdBox: widthFraction must be an integer between 0 and 65535"
        );
    }

    if (!Number.isInteger(heightFraction) ||
        heightFraction < 0 ||
        heightFraction > 0xFFFF) {
        throw new Error(
            "emitTkhdBox: heightFraction must be an integer between 0 and 65535"
        );
    }

    if (!Number.isInteger(duration) || duration < 0) {
        throw new Error(
            "emitTkhdBox: duration must be a non-negative integer"
        );
    }

    if (!Number.isInteger(trackId) || trackId <= 0) {
        throw new Error(
            "emitTkhdBox: trackId must be a positive integer"
        );
    }

    /**
     * Width and height are stored as 16.16 fixed-point values.
     *
     * Representation:
     *   - High 16 bits  → integer pixel count
     *   - Low 16 bits   → fractional pixel component
     *
     * Fractional pixel components are stored explicitly in the file
     * and are preserved verbatim by Framesmith.
     *
     * Notes:
     * - Many files encode integer dimensions (fraction = 0)
     * - Some encoders emit non-zero fractions
     * - Framesmith does not invent or normalize these values
     *
     * Byte-for-byte conformance depends on preserving the
     * original fixed-point representation.
     *
     * This value:
     *   - is valid per the MP4 specification
     *   - is ignored by players for layout
     *   - *does* affect byte-for-byte equivalence
     *
     * This is intentional.
     * Changing this value will break byte equivalence.
     */
    const widthFixed  = (width  << 16) | widthFraction;
    const heightFixed = (height << 16) | heightFraction;

    return {
        type: "tkhd",

        // FullBox header
        // ---------------
        // tkhd is a FullBox, so it must declare:
        //   - version
        //   - flags
        //
        // version = 0 → 32-bit fields
        version: 0,

        /**
         * flags
         * -----
         * Declarative flag intent.
         *
         * These booleans express *meaning*, not bit arithmetic.
         * The serializer is responsible for turning this intent
         * into the correct 24-bit flag value.
         *
         * Framesmith sets:
         *   - enabled   → true
         *   - inMovie   → true
         *   - inPreview → false (deprecated)
         *
         * This resolves to 0x000003 and matches ffmpeg output.
         */
        flags: {
            enabled: true,
            inMovie: true,
            // inPreview intentionally false
        },

        /**
         * flagBits
         * --------
         * Explicit vocabulary of allowed flag bits for this box.
         *
         * This is required whenever flags are specified by name.
         * The serializer enforces correctness using this table.
         */
        flagBits: TKHD_FLAG_BITS,

        body: [
            /**
             * creation_time (uint32)
             * ---------------------
             * Historical metadata from QuickTime.
             *
             * Modern meaning:
             *   None.
             *
             * Players ignore this field.
             * Framesmith sets it to 0 to match reference encoders.
             */
            { int: 0 },

            /**
             * modification_time (uint32)
             * --------------------------
             * Historical metadata from QuickTime.
             *
             * Modern meaning:
             *   None.
             *
             * Framesmith sets it to 0.
             */
            { int: 0 },

            /**
             * track_ID (uint32)
             * -----------------
             * Uniquely identifies this track within the movie.
             *
             * This value is semantically important.
             * Other boxes reference tracks by this ID.
             *
             * Must be non-zero.
             */
            { int: trackId },

            /**
             * reserved (uint32)
             * -----------------
             * Required by the specification.
             * Must be zero.
             */
            { int: 0 },

            /**
             * duration (uint32)
             * -----------------
             * Duration of this track in the *movie timescale*.
             *
             * This value is authoritative for track length.
             *
             * A duration of 0 means “unknown”.
             */
            { int: duration },

            /**
             * reserved[2] (uint32 × 2)
             * -----------------------
             * Legacy padding fields.
             * Must be zero.
             */
            { int: 0 },
            { int: 0 },

            /**
             * layer (int16)
             * -------------
             * Historical track layering (editing use).
             *
             * Modern players ignore this field.
             * Framesmith sets it to 0.
             */
            { short: 0 },

            /**
             * alternate_group (int16)
             * -----------------------
             * Used for alternate tracks (e.g. language variants).
             *
             * Not used in Framesmith.
             * Set to 0.
             */
            { short: 0 },

            /**
             * volume (int16, 8.8 fixed-point)
             * -------------------------------
             * Audio-only field.
             *
             * For video tracks, this must be 0.
             */
            { short: 0 },

            /**
             * reserved (uint16)
             * -----------------
             * Required by the specification.
             * Must be zero.
             */
            { short: 0 },

            /**
             * matrix (int32 × 9)
             * ------------------
             * 3×3 transformation matrix.
             *
             * Canonical identity matrix required by MP4:
             *
             *   [ 0x00010000, 0,          0,
             *     0,          0x00010000, 0,
             *     0,          0,          0x40000000 ]
             *
             * Notes:
             * - The final value (0x40000000) is NOT a typo.
             * - It is required for correct fixed-point math.
             * - ffmpeg and mp4box.js emit this exact matrix.
             *
             * Getting this wrong breaks conformance.
             */
            { int: 0x00010000 }, // a
            { int: 0 },          // b
            { int: 0 },          // u

            { int: 0 },          // c
            { int: 0x00010000 }, // d
            { int: 0 },          // v

            { int: 0 },          // x
            { int: 0 },          // y
            { int: 0x40000000 }, // w

            /**
             * width (uint32, 16.16 fixed-point)
             * --------------------------------
             * Display width of the track.
             */
            { int: widthFixed },

            /**
             * height (uint32, 16.16 fixed-point)
             * ---------------------------------
             * Display height of the track.
             */
            { int: heightFixed }
        ]
    };
}
