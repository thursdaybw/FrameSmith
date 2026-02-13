import { adaptEncodedOutputsToMp4BuildInput } from "./adaptEncodedOutputsToMp4BuildInput.js";
import { validateMp4BuildInput } from "../mux/native/validateMp4BuildInput.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function makeChunk({ timestamp, type, bytes }) {
    return {
        timestamp,
        type,
        byteLength: bytes.length,
        copyTo(target) {
            target.set(bytes);
        }
    };
}

export function test_adaptEncodedOutputsToMp4BuildInput_buildsValidTracks() {
    const videoChunks = [
        makeChunk({ timestamp: 5_000_000, type: "key", bytes: new Uint8Array([1, 2, 3]) }),
        makeChunk({ timestamp: 5_500_000, type: "delta", bytes: new Uint8Array([4, 5, 6]) })
    ];
    const audioChunks = [
        makeChunk({ timestamp: 5_000_000, type: "key", bytes: new Uint8Array([7, 8]) }),
        makeChunk({ timestamp: 5_500_000, type: "key", bytes: new Uint8Array([9, 10]) })
    ];

    const mp4BuildInput = adaptEncodedOutputsToMp4BuildInput({
        video: {
            webcodecsOutput: {
                encodedChunks: videoChunks,
                decoderConfig: {
                    codec: "avc1.4D401F",
                    description: new Uint8Array([11, 12, 13])
                }
            },
            buildParameters: {
                codedWidth: 1920,
                codedHeight: 1080,
                trackTimescale: 1_000_000
            }
        },
        audio: {
            webcodecsOutput: {
                encodedChunks: audioChunks,
                decoderConfig: {
                    codec: "opus",
                    description: new Uint8Array([21, 22, 23])
                }
            },
            buildParameters: {
                trackTimescale: 1_000_000,
                channelCount: 2,
                sampleRate: 48_000
            }
        }
    });

    validateMp4BuildInput(mp4BuildInput);

    assert(mp4BuildInput.tracks.length === 2, "adapter must emit two tracks when video and audio are present");

    const videoTrack = mp4BuildInput.tracks[0];
    const audioTrack = mp4BuildInput.tracks[1];

    assert(videoTrack.semanticCore.accessUnits.length === 2, "video track must contain all encoded video units");
    assert(videoTrack.semanticCore.accessUnits[0].pts === 5_000_000, "video PTS must match encoded chunk timestamp");
    assert(videoTrack.semanticCore.accessUnits[0].isKey === true, "video keyframe flag must map from chunk type");
    assert(videoTrack.semanticCore.codec.avcCCompleteness === "semantic", "video avcC completeness must be semantic");
    assert(videoTrack.payloads.accessUnitPayloads[0] instanceof Uint8Array, "video payloads must be Uint8Array");

    assert(audioTrack.semanticCore.accessUnits.length === 2, "audio track must contain all encoded audio units");
    assert(audioTrack.semanticCore.accessUnits[1].pts === 5_500_000, "audio PTS must match encoded chunk timestamp");
    assert(audioTrack.semanticCore.codec.codec === "opus", "audio codec string must propagate");
    assert(audioTrack.semanticCore.codec.dOps instanceof Uint8Array, "audio dOps must be set from decoder config description");
    assert(audioTrack.payloads.accessUnitPayloads[1] instanceof Uint8Array, "audio payloads must be Uint8Array");
}

export function test_adaptEncodedOutputsToMp4BuildInput_rejectsMissingStreams() {
    let error = null;
    try {
        adaptEncodedOutputsToMp4BuildInput({});
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "missing streams must throw");
    assert(
        error.message.includes("at least one encoded stream"),
        "error message must explain stream requirement"
    );
}

export const EXPORT_ADAPTER_TESTS = [
    test_adaptEncodedOutputsToMp4BuildInput_buildsValidTracks,
    test_adaptEncodedOutputsToMp4BuildInput_rejectsMissingStreams
];
