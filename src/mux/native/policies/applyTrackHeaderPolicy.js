/**
 * applyTrackHeaderPolicy
 * ======================
 *
 * Determines all container-level fields required to emit a
 * byte-for-byte ffmpeg-compatible `tkhd` box.
 *
 * This policy owns:
 *   - tkhd.duration        (movie-timescale domain)
 *   - tkhd.widthFraction
 *   - tkhd.heightFraction
 *
 * It does NOT own:
 *   - trackId
 *   - coded width / height
 *
 * Those remain compiler responsibilities.
 */
export function applyTrackHeaderPolicy({ trackDurationInMovieTimescale }) {

    if (
        !Number.isInteger(trackDurationInMovieTimescale) ||
        trackDurationInMovieTimescale < 0
    ) {
        throw new Error(
            `applyTrackHeaderPolicy: invalid track header duration\n` +
            `  expected: non-negative integer (movie timescale units)\n` +
            `  received: ${trackDurationInMovieTimescale}\n`
        );
    }
    return {
        duration: trackDurationInMovieTimescale
    };
}
