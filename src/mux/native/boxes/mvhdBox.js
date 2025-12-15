/**
 * MVHD — Movie Header Box (version 0)
 * -----------------------------------
 * The Movie Header Box defines *global* timing and playback parameters for the
 * entire MP4 file. Every player reads this box before anything else. Even when
 * most fields are ignored today, the structure must follow the ISO spec
 * exactly or playback will break on strict players (Safari, iOS, QuickTime).
 *
 * Why this box exists:
 * --------------------
 * Historically, MP4 was based on QuickTime’s MOV format. The container stored
 * global playback defaults here: movie duration, movie scaling units, playback
 * rate, volume, and a transformation matrix for rotating or scaling video.
 * Modern players rarely use most of this information, but for MP4 compliance
 * the box *must* exist and *must* contain a fully-populated, spec-correct
 * structure.
 *
 * Core Concepts:
 * --------------
 * - timescale:
 *     All timestamps in the MP4 are expressed in units of "ticks per second."
 *     If timescale = 90000, then duration = 90000 means 1 second.
 *     This value affects the entire movie. Every track inherits it indirectly.
 *
 * - duration:
 *     Total length of the movie in timescale units.
 *     MP4 containers do not infer duration from samples; it must be provided.
 *
 * - rate (16.16 fixed-point):
 *     A playback rate multiplier. 1.0 = normal speed.
 *     Encoded as 0x00010000. Historically used in QuickTime to play movies at
 *     slow/fast motion. Modern players ignore it — but the field is mandatory.
 *
 * - volume (8.8 fixed-point):
 *     General movie volume. Full volume = 0x0100.
 *     For pure video files, this is always 0. Setting it non-zero without
 *     audio tracks is technically incorrect.
 *
 * - matrix (identity transform):
 *     A 3×3 affine transformation matrix for rotating/scaling video frames.
 *     QuickTime historically allowed transformations at the container level.
 *     Modern MP4 players mostly ignore this. It must still be present.
 *
 *     Spec identity matrix (version 0):
 *       [ 1.0, 0,   0
 *         0,   1.0, 0
 *         0,   0,   1.0 ]
 *     Encoded in 16.16 fixed-point as:
 *       0x00010000, 0, 0,
 *       0, 0x00010000, 0,
 *       0, 0, 0x40000000  <-- this last row is historical QuickTime convention.
 *
 * - next_track_ID:
 *     The next unused track number. Must be non-zero.
 *     If the movie has only one video track with ID=1, then this should be 2.
 *     Increasing this value does not change playback; the field exists to
 *     support editing operations in QuickTime and ISO file editors.
 *
 * Why version 0:
 * --------------
 * MP4 supports two timestamp formats depending on version:
 *   - version 0 → 32-bit timestamps (sufficient for short videos)
 *   - version 1 → 64-bit timestamps (needed for long movies / broadcast)
 *
 * Framesmith generates short-form/medium-form video, so version 0 is correct,
 * simplest, and most widely compatible.
 *
 * External References:
 * --------------------
 * - ISO/IEC 14496-12:2023 — 8.2.2 Movie Header Box
 * - MP4 Conformance Examples (MPEG):  
 *     https://mpeggroup.github.io/FileFormatConformance/?query=%3D%22mvhd%22
 * - General MP4 box registry:  
 *     https://mp4ra.org/registered-types/boxes
 *
 * Why this builder exists:
 * ------------------------
 * Framesmith builds MP4 files directly in-browser. Instead of emitting
 * pre-baked byte arrays, we create structured JSON that exactly mirrors the
 * MP4 spec. The serializer converts JSON → bytes. This gives us:
 *   • simpler debugging
 *   • testable atoms
 *   • clean architecture (each box owns its domain)
 *   • transparent, readable domain logic without “magic offsets”
 *
 * Summary:
 * --------
 * This builder returns a fully spec-compliant MVHD v0 box, with safe defaults
 * and clear separation between domain intent (timing, next track) and encoding
 * details (fixed-point fields, identity matrix).
 */
export function buildMvhdBox({ nextTrackId, timescale, duration }) {

    // ---------------------------------------------------------------------
    // Defensive validation — fail fast on invalid movie headers
    // ---------------------------------------------------------------------

    if (!Number.isInteger(timescale) || timescale <= 0) {
        throw new Error(
            "buildMvhdBox: timescale must be a positive integer"
        );
    }

    if (!Number.isInteger(duration) || duration < 0) {
        throw new Error(
            "buildMvhdBox: duration must be a non-negative integer"
        );
    }

    if (!Number.isInteger(nextTrackId) || nextTrackId <= 0) {
        throw new Error(
            "buildMvhdBox: nextTrackId must be a positive integer"
        );
    }

    // MVHD v0 layout (version 0, 32-bit times):
    //
    //  8  bytes  box header (size + type)
    //  4  bytes  version + flags
    //  4  bytes  creation_time
    //  4  bytes  modification_time
    //  4  bytes  timescale
    //  4  bytes  duration
    //  4  bytes  rate (16.16 fixed-point)
    //  2  bytes  volume (8.8 fixed-point)
    //  2  bytes  reserved
    //  8  bytes  reserved
    // 36  bytes  matrix (9 × int32)
    // 24  bytes  pre_defined (6 × int32)
    //  4  bytes  next_track_ID
    // ------------------------------------
    // 112 bytes total

    return {
        type: "mvhd",
        version: 0,
        flags: 0,

        body: [
            /**
             * creation_time (uint32)
             * ----------------------
             * Historical QuickTime field.
             *
             * Modern players ignore this value.
             * Framesmith sets it to 0 to match ffmpeg/mp4box output.
             */
            { int: 0 },

            /**
             * modification_time (uint32)
             * --------------------------
             * Historical QuickTime field.
             *
             * Modern players ignore this value.
             * Framesmith sets it to 0.
             */
            { int: 0 },

            /**
             * timescale (uint32)
             * ------------------
             * Defines the global movie time unit.
             *
             * All movie and track durations are expressed in
             * multiples of this value.
             *
             * Example:
             *   timescale = 90000
             *   duration  = 90000  → 1 second
             */
            { int: timescale },

            /**
             * duration (uint32)
             * -----------------
             * Total movie duration in timescale units.
             *
             * MP4 containers do not infer duration automatically.
             * This value is authoritative.
             */
            { int: duration },

            /**
             * rate (int32, 16.16 fixed-point)
             * -------------------------------
             * Playback rate multiplier.
             *
             * 1.0 = normal speed
             * Encoded as 0x00010000.
             *
             * Historical QuickTime feature.
             * Modern players ignore it, but the field is mandatory.
             */
            { int: 0x00010000 },

            /**
             * volume (int16, 8.8 fixed-point)
             * -------------------------------
             * Default playback volume for the *entire movie*.
             *
             * Historical QuickTime semantics:
             *   0x0100 = full volume (1.0)
             *
             * IMPORTANT:
             * - This is NOT track volume.
             * - Even silent movies set this to full volume.
             * - ffmpeg and mp4box.js both emit 0x0100.
             *
             * Setting this to 0 breaks byte-for-byte conformance.
             */
            { short: 0x0100 },

            /**
             * reserved (uint16)
             * -----------------
             * Must be zero per specification.
             */
            { short: 0 },

            /**
             * reserved (uint32 × 2)
             * ---------------------
             * Legacy padding fields.
             * Must be zero.
             */
            { int: 0 },
            { int: 0 },

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
             * The final value (0x40000000) is a historical
             * QuickTime fixed-point convention and is required.
             */
            { int: 0x00010000 }, { int: 0 },          { int: 0 },
            { int: 0 },          { int: 0x00010000 }, { int: 0 },
            { int: 0 },          { int: 0 },          { int: 0x40000000 },

            /**
             * pre_defined (uint32 × 6)
             * ------------------------
             * Reserved for future use.
             * Must be zero.
             */
            { int: 0 }, { int: 0 }, { int: 0 },
            { int: 0 }, { int: 0 }, { int: 0 },

            /**
             * next_track_ID (uint32)
             * ----------------------
             * The next unused track ID.
             *
             * If the movie has a single track with ID = 1,
             * this value must be 2.
             *
             * Used by editing tools, not playback.
             */
            { int: nextTrackId }
        ]
    };
}
