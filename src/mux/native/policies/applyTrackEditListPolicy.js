/**
 * applyTrackEditListPolicy
 * =======================
 *
 * Defines the container-level policy for emitting track edit lists (edts/elst).
 *
 * This policy matches ffmpeg’s behavior for simple, single-track videos:
 *
 * - Always emit an edit list
 * - Single edit entry
 * - No offset, no trimming
 * - 1.0 playback rate
 *
 * This is NOT semantic media data.
 * This is a container compatibility decision.
 */
export function applyTrackEditListPolicy({
    trackDuration,
    movieTimescale,
    trackTimescale
}) {
    if (!Number.isInteger(trackDuration) || trackDuration < 0) {
        throw new Error(
            "applyTrackEditListPolicy: trackDuration must be a non-negative integer"
        );
    }

    if (!Number.isInteger(movieTimescale) || movieTimescale <= 0) {
        throw new Error(
            "applyTrackEditListPolicy: movieTimescale must be a positive integer"
        );
    }

    if (!Number.isInteger(trackTimescale) || trackTimescale <= 0) {
        throw new Error(
            "applyTrackEditListPolicy: trackTimescale must be a positive integer"
        );
    }

    // Convert track duration into movie timescale units
    const segmentDuration =
        Math.round(
            trackDuration * (movieTimescale / trackTimescale)
        );

    return {
        entries: [
            {
                segmentDuration,
                mediaTime: 0,
                mediaRateInteger: 1,
                mediaRateFraction: 0
            }
        ]
    };
}
