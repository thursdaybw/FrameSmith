import { applyMovieTimingPolicy } from "../policies/applyMovieTimingPolicy.js";

export function buildMvhdIntentFromCompilerState({ mp4CompilerState }) {

    const referenceTrackTimescale = mp4CompilerState.tracks[0].buildParameters.trackTimescale;

    // ---------------------------------------------------------
    // FFmpeg behavior:
    // Movie duration comes from authoritative stream timeline,
    // not max(trackDuration)
    // ---------------------------------------------------------

    let movieDurationInMovieTimescale;

    if (Number.isInteger(mp4CompilerState.semanticHints?.movieDuration)) {

        // Oracle / external authority path
        movieDurationInMovieTimescale =
            mp4CompilerState.semanticHints.movieDuration;

    } else {

        // Derived path (WebCodecs, synthetic sources)
        const referenceTrackTimescale =
            mp4CompilerState.tracks[0].buildParameters.trackTimescale;

        const derivedDurationInTrackTimescale =
            getDurationOfLongestTrack(
                mp4CompilerState.tracks,
                referenceTrackTimescale
            );

        movieDurationInMovieTimescale =
            derivedDurationInTrackTimescale;
    }

    const timing = applyMovieTimingPolicy({
        movieDurationInMovieTimescale,
        trackId: mp4CompilerState.highestTrackId,
        movieTimescale: mp4CompilerState.semanticHints?.movieTimescale
    });

    return {
        timescale: timing.timescale,
        duration: timing.duration,
        nextTrackId: timing.nextTrackId
    };
}

function getDurationOfLongestTrack(tracks, referenceTrackTimescale) {


    if (!Array.isArray(tracks)) {
        throw new Error(
            "deriveMovieDurationFromTracks: tracks must be an array, " +
            `received ${Object.prototype.toString.call(tracks)}`
        );
    }

    if (!Number.isInteger(referenceTrackTimescale) || referenceTrackTimescale <= 0) {
        throw new Error(
            "deriveMovieDurationFromTracks: referenceTrackTimescale must be a positive integer, " +
            `received ${referenceTrackTimescale} (${typeof referenceTrackTimescale})`
        );
    }

    let maxSeconds = 0;

    for (const track of tracks) {

        if (!Number.isInteger(track.trackDuration)) {
            throw new Error(
                "deriveMovieDurationFromTracks: track.trackDuration must be an integer"
            );
        }

        const trackTimescale = track.buildParameters.trackTimescale;

        if (!Number.isInteger(trackTimescale) || trackTimescale <= 0) {
            throw new Error(
                "deriveMovieDurationFromTracks: trackTimescale must be a positive integer"
            );
        }

        const seconds = track.trackDuration / trackTimescale;

        if (seconds > maxSeconds) {
            maxSeconds = seconds;
        }
    }

    // Convert ONCE into reference track timescale
    return Math.round(maxSeconds * referenceTrackTimescale);
}
