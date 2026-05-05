import { buildVideoTrackFromWebCodecs, buildAudioTrackFromWebCodecs } from "../../vendor/native-mp4-muxer/producers/webcodecsMp4Producer.js";
import { validateMp4BuildInput } from "../../vendor/native-mp4-muxer/validateMp4BuildInput.js";

function describeValue(value) {
    const typeTag = Object.prototype.toString.call(value);
    if (typeof value === "string") return `${typeTag}(${JSON.stringify(value)})`;
    if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
        return `${typeTag}(${String(value)})`;
    }
    return typeTag;
}

function assertTrackInput({ input, name }) {
    if (input === undefined) return;

    if (!input || typeof input !== "object") {
        throw new Error(
            `adaptEncodedOutputsToMp4BuildInput: ${name} must be an object when provided. ` +
            `Received ${describeValue(input)}`
        );
    }

    if (!input.webcodecsOutput || typeof input.webcodecsOutput !== "object") {
        throw new Error(
            `adaptEncodedOutputsToMp4BuildInput: ${name}.webcodecsOutput must be an object. ` +
            `Received ${describeValue(input.webcodecsOutput)}`
        );
    }

    if (!input.buildParameters || typeof input.buildParameters !== "object") {
        throw new Error(
            `adaptEncodedOutputsToMp4BuildInput: ${name}.buildParameters must be an object. ` +
            `Received ${describeValue(input.buildParameters)}`
        );
    }
}

export function adaptEncodedOutputsToMp4BuildInput({
    video,
    audio,
    semanticHints,
    buildHints
} = {}) {
    assertTrackInput({ input: video, name: "video" });
    assertTrackInput({ input: audio, name: "audio" });

    if (!video && !audio) {
        throw new Error(
            "adaptEncodedOutputsToMp4BuildInput: at least one encoded stream (video or audio) is required"
        );
    }

    const tracks = [];

    if (video) {
        tracks.push(
            buildVideoTrackFromWebCodecs({
                webcodecsOutput: video.webcodecsOutput,
                buildParameters: video.buildParameters,
                semanticHints: video.semanticHints,
                buildHints: video.buildHints
            })
        );
    }

    if (audio) {
        const audioTrack = buildAudioTrackFromWebCodecs({
            webcodecsOutput: audio.webcodecsOutput,
            buildParameters: audio.buildParameters
        });

        if (audio.semanticHints) {
            audioTrack.semanticHints = audio.semanticHints;
        }
        if (audio.buildHints) {
            audioTrack.buildHints = {
                ...audioTrack.buildHints,
                ...audio.buildHints
            };
        }

        tracks.push(audioTrack);
    }

    const mp4BuildInput = { tracks };

    if (semanticHints !== undefined) {
        mp4BuildInput.semanticHints = semanticHints;
    }

    if (buildHints !== undefined) {
        mp4BuildInput.buildHints = buildHints;
    }

    validateMp4BuildInput(mp4BuildInput);
    return mp4BuildInput;
}
