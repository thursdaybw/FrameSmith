/**
 * applyEditListPolicy
 * ===================
 *
 * Container policy for emitting an Edit List (`edts` / `elst`) that matches
 * the observed default behavior of ffmpeg for a simple, single-track MP4.
 *
 * ============================================================================
 * WHY THIS POLICY EXISTS
 * ============================================================================
 *
 * Edit Lists are NOT semantic media facts.
 *
 * They are a container-level construct used to map a track’s internal
 * media timeline (mdhd) into the movie’s presentation timeline (mvhd).
 *
 * The MP4 specification explicitly allows multiple valid edit list
 * representations that result in identical playback.
 *
 * Therefore:
 *
 *   - Edit lists are NOT derivable
 *   - Edit lists are NOT normalization
 *   - Edit lists are NOT adaptation
 *
 * Any compiler that emits an edit list MUST make an explicit policy decision.
 *
 * This file encodes that decision.
 *
 * ============================================================================
 * OBSERVED ORACLE BEHAVIOR (ffmpeg)
 * ============================================================================
 *
 * Inspection of ffmpeg-generated MP4 files for a single video track shows:
 *
 *   - An `edts` box IS present
 *   - It contains exactly ONE `elst` entry
 *   - elst.version = 0
 *   - elst.flags   = 0
 *
 * The single edit entry has the following properties:
 *
 *   editDuration:
 *     - expressed in MOVIE timescale units (mvhd.timescale)
 *     - numerically equals mvhd.duration
 *
 *   mediaTime:
 *     - expressed in TRACK timescale units (mdhd.timescale)
 *     - equals the first decodeable media timestamp
 *       (NOT always zero in general)
 *
 *   mediaRate:
 *     - integer  = 1
 *     - fraction = 0
 *
 * This represents normal (1.0×) playback with no rate adjustment.
 *
 * IMPORTANT:
 * ----------
 *
 * This structure deliberately mixes timescales:
 *
 *   - editDuration → movie timescale
 *   - mediaTime    → track timescale
 *
 * This is legal, intentional, and empirically confirmed.
 *
 * ============================================================================
 * WHAT THIS POLICY DOES
 * ============================================================================
 *
 * This policy encodes EXACTLY the behavior above.
 *
 * It:
 *   - emits a single-entry edit list
 *   - aligns track time to movie time
 *   - performs the required timescale conversion explicitly
 *
 * It does NOT:
 *   - infer trimming
 *   - infer gaps
 *   - infer looping
 *   - infer rate changes
 *   - attempt to generalize beyond the observed oracle
 *
 * ============================================================================
 * SCOPE AND CONSTRAINTS
 * ============================================================================
 *
 * This policy is valid ONLY when:
 *
 *   - exactly one track exists
 *   - no leading empty edit is required
 *   - no trimming or looping is modeled
 *   - playback rate is constant
 *
 * If ANY of these assumptions change, this policy MUST be replaced
 * with a more general edit list strategy.
 *
 * ============================================================================
 * ARCHITECTURAL CLASSIFICATION
 * ============================================================================
 *
 * This logic is:
 *
 *   - NOT normalization (multiple valid answers exist)
 *   - NOT derivation     (not implied by semantic facts)
 *   - NOT adaptation    (no shape translation)
 *
 * It IS:
 *
 *   - an explicit container policy
 *
 * ============================================================================
 * INPUTS
 * ============================================================================
 *
 * @param {Object} params
 *
 * @param {number} params.trackDuration
 *   Track duration in TRACK timescale units (mdhd.duration)
 *
 * @param {number} params.trackTimescale
 *   Track timescale (mdhd.timescale)
 *
 * @param {number} params.movieTimescale
 *   Movie timescale (mvhd.timescale)
 *
 * @param {number} params.mediaStartTime
 *   Media start time in TRACK timescale units.
 *   Empirically observed as the first access unit’s PTS.
 *
 * ============================================================================
 * OUTPUT
 * ============================================================================
 *
 * Returns parameters suitable for:
 *
 *   emitEdtsBox({
 *     elst: emitElstBox(...)
 *   })
 *
 * This function:
 *   - does NOT emit boxes
 *   - does NOT serialize bytes
 *   - does NOT apply layout
 *   - does NOT guess defaults
 *
 * It encodes a single, explicit, documented container decision.
 */
export function applyEditListPolicy({
    trackDuration,
    trackTimescale,
    movieTimescale,
    mediaStartTime
}) {

    // ---------------------------------------------------------------------
    // Defensive validation (grammar + intent)
    // ---------------------------------------------------------------------

    if (!Number.isInteger(trackDuration) || trackDuration < 0) {
        throw new Error(
            "applyEditListPolicy: trackDuration must be a non-negative integer"
        );
    }

    if (!Number.isInteger(trackTimescale) || trackTimescale <= 0) {
        throw new Error(
            "applyEditListPolicy: trackTimescale must be a positive integer"
        );
    }

    if (!Number.isInteger(movieTimescale) || movieTimescale <= 0) {
        throw new Error(
            "applyEditListPolicy: movieTimescale must be a positive integer"
        );
    }

    if (!Number.isInteger(mediaStartTime)) {
        throw new Error(
            "applyEditListPolicy: mediaStartTime must be an integer"
        );
    }

    // ---------------------------------------------------------------------
    // Timescale conversion (EMPIRICAL REQUIREMENT)
    // ---------------------------------------------------------------------
    //
    // Oracle shows:
    //
    //   editDuration = mvhd.duration
    //
    // But we are given:
    //
    //   trackDuration in TRACK timescale units.
    //
    // Therefore:
    //
    //   editDuration =
    //     trackDuration * movieTimescale / trackTimescale
    //
    // This conversion is REQUIRED.
    // Omitting it produces a byte-for-byte mismatch with the oracle.
    //
    // ---------------------------------------------------------------------

    const editDuration =
        (trackDuration * movieTimescale) / trackTimescale;

    console.group("DEBUG applyEditListPolicy");
    console.log("trackDuration:", trackDuration);
    console.log("trackTimescale:", trackTimescale);
    console.log("movieTimescale:", movieTimescale);
    console.log("mediaStartTime:", mediaStartTime);
    console.log("numerator:", trackDuration * movieTimescale);
    console.log("raw editDuration:", editDuration);
    console.log("isInteger:", Number.isInteger(editDuration));
    console.groupEnd();

    if (!Number.isInteger(editDuration)) {
        throw new Error(
            "applyEditListPolicy: computed editDuration is not an integer"
        );
    }

    // ---------------------------------------------------------------------
    // ffmpeg-compatible single-entry edit list
    // ---------------------------------------------------------------------

    return {
        elst: {
            version: 0,
            flags: 0,
            entries: [
                {
                    // duration in MOVIE timescale units
                    editDuration,

                    // start time in TRACK timescale units
                    mediaTime: mediaStartTime,

                    // normal playback rate (1.0×)
                    mediaRateInteger: 1,
                    mediaRateFraction: 0
                }
            ]
        }
    };
}
