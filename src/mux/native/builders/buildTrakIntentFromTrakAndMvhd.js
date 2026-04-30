import { applyEditListPolicy } from "../policies/applyEditListPolicy.js"; import { applyTrackHeaderPolicy } from "../policies/applyTrackHeaderPolicy.js";

export function buildTrakIntentFromTrakAndMvhd({ track, mvhd }) {

    if (!track?.storedIntent?.mdiaIntent) {
        throw new Error(
            "buildTrakIntentFromTrakAndMvhd: mdiaIntent must exist on track"
        );
    }

    if (!track?.storedIntent?.mdhd) {
        throw new Error(
            "buildTrakIntentFromTrakAndMvhd: mdhd must exist on track"
        );
    }

    if (!mvhd) {
        throw new Error(
            "buildTrakIntentFromTrakAndMvhd: mvhd is required"
        );
    }

    const isVideo = track.semanticTrackFamily === "video";

    const trackDurationInMovieTimescale =
        track.semanticHints?.inputTrackDurationInMovieTimescale ??
        mvhd.duration;

    const { duration } = applyTrackHeaderPolicy({
        trackDurationInMovieTimescale
    });

    const isAudio = track.semanticTrackFamily === "audio";

    const trakIntent = {
        tkhd: {
            trackId: track.trackId,
            duration,
            width:  isVideo ? track.buildParameters.codedWidth  : 0,
            height: isVideo ? track.buildParameters.codedHeight : 0,
            widthFraction: 0,
            heightFraction: 0,
            alternateGroup: isAudio ? 1 : 0,
            volume: isAudio ? 0x0100 : 0
        },
        mdia: track.storedIntent.mdiaIntent
    };

    const elstHint = track.semanticHints?.edits?.elst;

    trakIntent.edts = elstHint
        ? { elst: elstHint }          // audio: oracle passthrough
        : applyEditListPolicy({       // video: policy-generated
            track,
            mvhd
        });

    Object.freeze(trakIntent.tkhd);

    return trakIntent;
}
