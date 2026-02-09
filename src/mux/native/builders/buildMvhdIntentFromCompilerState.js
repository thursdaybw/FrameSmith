import { applyMovieTimingPolicy } from "../policies/applyMovieTimingPolicy.js";

export function buildMvhdIntentFromCompilerState({ mp4CompilerState }) {

    // ---------------------------------------------------------
    // FFmpeg behavior:
    // Movie duration comes from authoritative stream timeline,
    // not max(trackDuration)
    // ---------------------------------------------------------

    let movieDurationSeconds;

    if (Number.isInteger(mp4CompilerState.semanticHints?.movieDuration)) {
        // IMPORTANT: semanticHints.movieDuration must already be in MOVIE TIMESCALE
        movieDurationSeconds = mp4CompilerState.semanticHints.movieDuration / (mp4CompilerState.semanticHints.movieTimescale ?? 1000);
    } else {
        movieDurationSeconds = getLongestTrackDurationSeconds(mp4CompilerState.tracks);
    }

    const timing = applyMovieTimingPolicy({
        movieDurationSeconds,
        trackId: mp4CompilerState.highestTrackId,
        movieTimescale: mp4CompilerState.semanticHints?.movieTimescale
    });

    return {
        timescale: timing.timescale,
        duration: timing.duration,
        nextTrackId: timing.nextTrackId
    };
}

function getLongestTrackDurationSeconds(tracks) {

    if (!Array.isArray(tracks)) {
        throw new Error(
            "getLongestTrackDurationSeconds: tracks must be an array, " +
            `received ${Object.prototype.toString.call(tracks)}`
        );
    }

    let maxSeconds = 0;

    for (const track of tracks) {

        if (!Number.isInteger(track.trackDuration)) {
            throw new Error(
                "getLongestTrackDurationSeconds: track.trackDuration must be an integer"
            );
        }

        const trackTimescale = track.buildParameters?.trackTimescale;

        if (!Number.isInteger(trackTimescale) || trackTimescale <= 0) {
            throw new Error(
                "getLongestTrackDurationSeconds: track.buildParameters.trackTimescale must be a positive integer, " +
                `received ${trackTimescale} (${typeof trackTimescale})`
            );
        }

        const seconds = track.trackDuration / trackTimescale;

        if (seconds > maxSeconds) {
            maxSeconds = seconds;
        }
    }

    return maxSeconds;
}
