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
export function applyTrackHeaderPolicy({
    mdhdTimescale,
    mdhdDuration,
    mvhdTimescale
}) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------

    if (!Number.isInteger(mdhdTimescale) || mdhdTimescale <= 0) {
        throw new Error(
            "applyTrackHeaderPolicy: mdhdTimescale must be a positive integer"
        );
    }

    if (!Number.isInteger(mvhdTimescale) || mvhdTimescale <= 0) {
        throw new Error(
            "applyTrackHeaderPolicy: mvhdTimescale must be a positive integer"
        );
    }

    if (!Number.isInteger(mdhdDuration) || mdhdDuration < 0) {
        throw new Error(
            "applyTrackHeaderPolicy: mdhdDuration must be a non-negative integer"
        );
    }

    // ---------------------------------------------------------
    // tkhd.duration (oracle-derived)
    // ---------------------------------------------------------
    //
    // tkhd.duration is expressed in *movie* timescale units
    //
    const duration =
        Math.round(
            mdhdDuration * mvhdTimescale / mdhdTimescale
        );

    // ---------------------------------------------------------
    // tkhd width / height fractions
    // ---------------------------------------------------------
    //
    // ffmpeg emits integer dimensions only.
    // Fractional components are always zero.
    //
    const widthFraction  = 0;
    const heightFraction = 0;

    return {
        duration,
        widthFraction,
        heightFraction
    };
}
