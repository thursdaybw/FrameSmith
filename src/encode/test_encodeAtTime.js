import { encodeAtTime } from "./encodeAtTime.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_encodeAtTime_encodesAvailableArtifacts() {
    const videoFrame = { timestamp: 5_000_000, _kind: "VideoFrame" };
    const audioData = { timestamp: 5_000_000, _kind: "AudioData" };
    const provenance = { timelineId: "tl-1", trackId: "tr-1", clipId: "cl-1" };
    const encodeCalls = [];

    const result = encodeAtTime({
        timeSeconds: 5,
        compositionOutput: {
            composedVideoFrame: { videoFrame, timestamp: 5, layerOrder: [0, 10] },
            composedAudioData: { audioData, timestamp: 5, audioStrategy: "mixToSingleTrack" }
        },
        provenance,
        encodeVideoFrame({ frame, timeSeconds, provenance: callProvenance }) {
            encodeCalls.push({ media: "video", timeSeconds });
            assert(frame === videoFrame, "video frame must be passed to video encoder");
            assert(callProvenance === provenance, "provenance object must pass through to video encoder");
            return {
                codecDomain: "video",
                pts: 5_000_000,
                data: new Uint8Array([0x76])
            };
        },
        encodeAudioData({ audioData: inputAudioData, timeSeconds, provenance: callProvenance }) {
            encodeCalls.push({ media: "audio", timeSeconds });
            assert(inputAudioData === audioData, "audio data must be passed to audio encoder");
            assert(callProvenance === provenance, "provenance object must pass through to audio encoder");
            return {
                codecDomain: "audio",
                pts: 5_000_000,
                data: new Uint8Array([0x61])
            };
        }
    });

    assert(result.timeSeconds === 5, "result timeSeconds must match input");
    assert(result.encodedAccessUnits.length === 2, "one video and one audio unit must be emitted");
    assert(encodeCalls.length === 2, "both encoders must be called");
}

export function test_encodeAtTime_skipsMissingArtifacts() {
    let videoCalls = 0;
    let audioCalls = 0;

    const result = encodeAtTime({
        timeSeconds: 7,
        compositionOutput: {
            composedVideoFrame: { videoFrame: null, timestamp: 7, layerOrder: [] },
            composedAudioData: { audioData: null, timestamp: 7, audioStrategy: "mixToSingleTrack" }
        },
        encodeVideoFrame() {
            videoCalls++;
            return {};
        },
        encodeAudioData() {
            audioCalls++;
            return {};
        }
    });

    assert(result.encodedAccessUnits.length === 0, "no artifacts means no encoded units");
    assert(videoCalls === 0, "video encoder must not run without videoFrame");
    assert(audioCalls === 0, "audio encoder must not run without audioData");
}

export function test_encodeAtTime_rejectsInvalidCompositionOutput() {
    let error = null;
    try {
        encodeAtTime({
            timeSeconds: 1,
            compositionOutput: null
        });
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "invalid compositionOutput must throw");
    assert(
        error.message.includes("compositionOutput must be an object"),
        "error message must explain compositionOutput contract"
    );
}

export const ENCODE_TESTS = [
    test_encodeAtTime_encodesAvailableArtifacts,
    test_encodeAtTime_skipsMissingArtifacts,
    test_encodeAtTime_rejectsInvalidCompositionOutput
];
