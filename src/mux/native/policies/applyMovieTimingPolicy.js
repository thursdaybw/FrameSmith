/**
 * applyMovieTimingPolicy
 * ======================
 *
 * PURPOSE
 * -------
 * Defines the container-level policy for the Movie Header Box (mvhd).
 *
 * This policy is NOT derivable from semantic media facts.
 * It reflects encoder behavior observed in the oracle (ffmpeg).
 *
 * POLICY (ffmpeg-compatible)
 * --------------------------
 * - mvhd.timescale is fixed at 1000
 * - mvhd.duration is expressed in mvhd.timescale units
 * - mvhd.nextTrackId = max(trackId) + 1
 * - mvhd.rate = 1.0 (0x00010000)
 * - mvhd.volume = 1.0 (0x0100)
 *
 * RATIONALE
 * ---------
 * ffmpeg does NOT reuse track timescale for movie timing.
 * Movie time is an independent container concern.
 *
 * This policy exists to make that decision:
 *   - explicit
 *   - named
 *   - testable
 *
 * It must never be inferred or hidden in emitters.
 */

export function applyMovieTimingPolicy({ movieDurationInMovieTimescale, trackId, movieTimescale }) {

    if (!Number.isInteger(movieDurationInMovieTimescale) || movieDurationInMovieTimescale < 0) {
        throw new Error(
            "applyMovieTimingPolicy: movieDurationInMovieTimescale must be a non-negative integer, " +
            `received ${movieDurationInMovieTimescale} (${typeof movieDurationInMovieTimescale})`
        );
    }

    const resolvedMovieTimescale =
        Number.isInteger(movieTimescale) && movieTimescale > 0
        ? movieTimescale
        : 1000;

    if (!Number.isInteger(trackId) || trackId <= 0) {
        throw new Error(
            "applyMovieTimingPolicy: trackId must be a positive integer, " +
            `received ${trackId} (${typeof trackId})`
        );
    }

    return {
        timescale: resolvedMovieTimescale,
        duration: movieDurationInMovieTimescale,
        nextTrackId: trackId + 1
    };
}
