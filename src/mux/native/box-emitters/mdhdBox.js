/**
 * mdhd — Media Header Box (version 0)
 * ----------------------------------
 * The `mdhd` box defines the *temporal coordinate system* for a media track.
 *
 * In plain terms:
 * - It tells the player what a “tick” of time means for this track
 * - It defines how long the track lasts in those ticks
 *
 * Every timestamp in the track’s sample table (`stts`, `ctts`, edit lists)
 * is interpreted relative to the `timescale` declared here.
 *
 * If `mdhd` is wrong:
 * - playback speed will be wrong
 * - sync will be wrong
 * - duration may appear zero or incorrect
 *
 * Structure (version 0):
 * ---------------------
 *   version(1)
 *   flags(3)
 *   creation_time(4)
 *   modification_time(4)
 *   timescale(4)
 *   duration(4)
 *   language(2)
 *   pre_defined(2)
 *
 * Total body size: 24 bytes
 *
 * Why version 0:
 * --------------
 * Version 1 supports 64-bit time fields.
 * ffmpeg and most modern encoders still emit version 0
 * for typical content durations.
 *
 * Framesmith mirrors ffmpeg exactly for byte-for-byte conformance.
 *
 * Spec references:
 * ----------------
 * ISO/IEC 14496-12 — Media Header Box (mdhd)
 */
export function emitMdhdBox({ timescale, duration }) {
    // ---------------------------------------------------------------------
    // Validation (fail fast, no silent coercion)
    // ---------------------------------------------------------------------

    /**
     * timescale
     * ---------
     * Defines the number of time units that pass per second.
     *
     * Example:
     *   timescale = 1000  → duration is expressed in milliseconds
     *   timescale = 90000 → duration uses MPEG clock units
     *
     * Must be:
     * - present
     * - a positive integer
     *
     * A timescale of 0 is invalid and will break playback.
     */
    if (!Number.isInteger(timescale) || timescale <= 0) {
        throw new Error(
            "emitMdhdBox: timescale must be a positive integer"
        );
    }

    /**
     * duration
     * --------
     * Length of the media expressed in `timescale` units.
     *
     * Must be:
     * - present
     * - a non-negative integer
     *
     * A duration of 0 is allowed and means “unknown”.
     */
    if (!Number.isInteger(duration) || duration < 0) {
        throw new Error(
            "emitMdhdBox: duration must be a non-negative integer"
        );
    }

    return {
        type: "mdhd",

        /**
         * FullBox header
         * --------------
         * mdhd is a FullBox, so it declares:
         * - version
         * - flags
         *
         * version = 0 → 32-bit time fields
         * flags   = 0 → no flags defined for mdhd
         */
        version: 0,
        flags: 0,

        body: [
            /**
             * creation_time (uint32)
             * ---------------------
             * Legacy QuickTime metadata.
             *
             * Modern meaning:
             *   None.
             *
             * Framesmith sets this to 0 to match ffmpeg output.
             */
            { int: 0 },

            /**
             * modification_time (uint32)
             * --------------------------
             * Legacy QuickTime metadata.
             *
             * Modern meaning:
             *   None.
             *
             * Framesmith sets this to 0.
             */
            { int: 0 },

            /**
             * timescale (uint32)
             * ------------------
             * Number of time units that pass per second.
             *
             * This field defines the *unit of time* for the entire media track.
             */
            { int: timescale },

            /**
             * duration (uint32)
             * -----------------
             * Length of the media in `timescale` units.
             *
             * This value is authoritative for track length.
             */
            { int: duration },

            /**
             * language (uint16)
             * -----------------
             * ISO-639 language code packed into 15 bits.
             *
             * The value 0x55C4 corresponds to "und" (undetermined).
             *
             * ffmpeg emits this value by default.
             * Framesmith mirrors it for conformance.
             */
            { short: 0x55c4 },

            /**
             * pre_defined (uint16)
             * --------------------
             * Reserved by the specification.
             *
             * Must be zero.
             */
            { short: 0 }
        ]
    };
}
