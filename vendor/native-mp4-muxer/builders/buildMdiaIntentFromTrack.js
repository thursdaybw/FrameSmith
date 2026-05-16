import { applyAudioDurationPolicy } from "../policies/applyAudioDurationPolicy.js";

export function buildMdiaIntentFromTrack({ track }) {

    if (!track?.storedIntent?.minfIntent) {
        throw new Error(
            "buildMdiaIntentFromTrack: minfIntent must exist on track"
        );
    }

    const rawDuration = track.trackDuration;
    const codecName = track.semanticCore.codec.codec;

    const mdhdDuration = applyAudioDurationPolicy({
        codecName,
        rawSampleDuration: rawDuration,
        semanticHints: track.semanticHints
    });

    track.storedIntent.mdhd = {
        timescale: track.buildParameters.trackTimescale,
        duration: mdhdDuration
    };

    let handlerType;

    if (track.semanticTrackFamily === "audio") {
        handlerType = "soun";
    } else if (track.semanticTrackFamily === "video") {
        handlerType = "vide";
    } else {
        throw new Error(
            `buildMdiaIntentFromTrack: unknown semanticTrackFamily '${track.semanticTrackFamily}'`
        );
    }

    return {
        mdhd: track.storedIntent.mdhd,

        hdlr: {
            handlerType,
            nameBytes: resolveHdlrNameBytes(
                track.semanticHints?.hdlr,
                track.semanticTrackFamily
            )
        },

        minf: track.storedIntent.minfIntent,
    };
}

function resolveHdlrNameBytes(hdlrIntent, trackFamily) {

    if (hdlrIntent && hdlrIntent.nameBytes instanceof Uint8Array) {
        return hdlrIntent.nameBytes;
    }

    if (hdlrIntent && typeof hdlrIntent.name === "string") {
        return new TextEncoder().encode(hdlrIntent.name + "\0");
    }

    if (trackFamily === "audio") {
        return new TextEncoder().encode("SoundHandler\0");
    }

    return new TextEncoder().encode("VideoHandler\0");
}


