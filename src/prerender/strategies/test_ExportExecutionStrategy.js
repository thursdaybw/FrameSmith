import { ExportExecutionStrategy } from "./ExportExecutionStrategy.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../../timeline/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export async function test_ExportExecutionStrategy_decodesOnceAndComposesAcrossRange() {
    let videoDecodeCalls = 0;
    let audioDecodeCalls = 0;

    const strategy = new ExportExecutionStrategy({
        videoDecoder: {
            decode() { videoDecodeCalls++; },
            async flush() {}
        },
        audioDecoder: {
            decode() { audioDecodeCalls++; },
            async flush() {}
        },
        timecodeFragmentIntentResolvers: {
            "text-overlay": () => ({
                renderIntents: [{ kind: "text-overlay" }]
            })
        },
        activeLayers: [{ zIndex: 3 }, { zIndex: 1 }],
        options: { audioStrategy: "mixToSingleTrack" }
    });

    const plan = {
        fragments: [
            {
                kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
                prerenderContributorKind: PreRenderPlanContributorKinds.CONTAINER_TRACK,
                access_units: [
                    { pts: 0, data: new Uint8Array([1]) },
                    { pts: 1, data: new Uint8Array([2]) }
                ]
            },
            {
                kind: PreRenderPlanFragmentKinds.PROCEDURAL,
                prerenderContributorKind: PreRenderPlanContributorKinds.PROCEDURAL,
                proceduralKind: "text-overlay",
                items: []
            }
        ]
    };

    const result = await strategy.execute({
        plan,
        exportRange: { startSeconds: 5, endSeconds: 6 },
        fps: 2
    });

    assert(videoDecodeCalls === 2, "video decode must run once per access unit");
    assert(audioDecodeCalls === 2, "audio decode must run once per access unit");

    assert(
        result.decodedContainerBackedFragmentBatch.decodedVideoFrames.length === 2,
        "decoded batch must include decoded video frames"
    );
    assert(
        result.decodedContainerBackedFragmentBatch.decodedAudioData.length === 2,
        "decoded batch must include decoded audio data"
    );

    assert(result.composedFrames.length === 3, "range 5..6 at 2fps must compose three frames");

    const composedTimes = result.composedFrames.map(frame => frame.composedVideoFrame.timestamp);
    assert(
        JSON.stringify(composedTimes) === JSON.stringify([5, 5.5, 6]),
        "compose timestamps must follow export range at fps step"
    );

    assert(
        JSON.stringify(result.composedFrames[0].composedVideoFrame.layerOrder) === JSON.stringify([1, 3]),
        "composition must respect zIndex order from activeLayers"
    );
}

export async function test_ExportExecutionStrategy_rejectsInvalidFps() {
    const strategy = new ExportExecutionStrategy();

    let error = null;
    try {
        await strategy.execute({
            plan: { fragments: [] },
            exportRange: { startSeconds: 0, endSeconds: 1 },
            fps: 0
        });
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "invalid fps must throw");
    assert(
        error.message.includes("fps must be > 0"),
        "invalid fps error message must explain required contract"
    );
}

export async function test_ExportExecutionStrategy_adaptsEncodedOutputsAndBuildsMp4() {
    const savedVideoFrame = globalThis.VideoFrame;
    const savedAudioData = globalThis.AudioData;
    const savedOffscreenCanvas = globalThis.OffscreenCanvas;

    class FakeVideoFrame {
        constructor(source, init) {
            this.source = source;
            this.timestamp = init.timestamp;
        }
    }

    class FakeAudioData {
        constructor(init) {
            this.timestamp = init.timestamp;
            this.numberOfFrames = init.numberOfFrames;
            this.numberOfChannels = init.numberOfChannels;
            this.sampleRate = init.sampleRate;
            this.format = init.format;
        }
    }

    class FakeOffscreenCanvas {
        constructor(width, height) {
            this.width = width;
            this.height = height;
        }

        getContext() {
            return {
                fillStyle: "",
                fillRect() {}
            };
        }
    }

    globalThis.VideoFrame = FakeVideoFrame;
    globalThis.AudioData = FakeAudioData;
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;

    function makeEncodedChunk({ timestamp, type, bytes }) {
        return {
            timestamp,
            type,
            byteLength: bytes.length,
            copyTo(target) {
                target.set(bytes);
            }
        };
    }

    let adaptedInput = null;
    let compilerInput = null;

    const strategy = new ExportExecutionStrategy({
        videoDecoder: {
            decode() {},
            async flush() {}
        },
        audioDecoder: {
            decode() {},
            async flush() {}
        },
        encodeVideoFrame({ frame, timeSeconds }) {
            assert(frame instanceof FakeVideoFrame, "video encoder must receive VideoFrame artifacts");
            return {
                accessUnit: {
                    codecDomain: "video",
                    pts: Math.round(timeSeconds * 1_000_000),
                    data: new Uint8Array([0x76])
                },
                encodedChunk: makeEncodedChunk({
                    timestamp: Math.round(timeSeconds * 1_000_000),
                    type: timeSeconds === 0 ? "key" : "delta",
                    bytes: new Uint8Array([1, 2, 3])
                }),
                decoderConfig: {
                    codec: "avc1.4D401F",
                    description: new Uint8Array([11, 12, 13])
                }
            };
        },
        encodeAudioData({ audioData, timeSeconds }) {
            assert(audioData instanceof FakeAudioData, "audio encoder must receive AudioData artifacts");
            return {
                accessUnit: {
                    codecDomain: "audio",
                    pts: Math.round(timeSeconds * 1_000_000),
                    data: new Uint8Array([0x61])
                },
                encodedChunk: makeEncodedChunk({
                    timestamp: Math.round(timeSeconds * 1_000_000),
                    type: "key",
                    bytes: new Uint8Array([4, 5])
                }),
                decoderConfig: {
                    codec: "opus",
                    description: new Uint8Array([21, 22, 23])
                }
            };
        },
        adaptEncodedOutputsToMp4BuildInputFn(input) {
            adaptedInput = input;
            return {
                tracks: [{ semanticCore: { accessUnits: [] }, payloads: { accessUnitPayloads: [] }, buildParameters: {} }]
            };
        },
        createMp4FromInputsFn(input) {
            compilerInput = input;
            return new Uint8Array([0, 1, 2, 3]);
        },
        options: {
            outputSpec: {
                width: 1920,
                height: 1080,
                sampleRate: 48_000,
                channels: 2
            },
            trackTimescale: 1_000_000
        }
    });

    const plan = {
        fragments: [
            {
                kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
                prerenderContributorKind: PreRenderPlanContributorKinds.CONTAINER_TRACK,
                access_units: [
                    { pts: 0, data: new Uint8Array([1]) }
                ]
            }
        ]
    };

    try {
        const result = await strategy.execute({
            plan,
            exportRange: { startSeconds: 0, endSeconds: 1 },
            fps: 1
        });

        assert(result.encodedAccessUnits.length === 4, "must emit one video and one audio access unit per timecode");
        assert(adaptedInput !== null, "adapter must be called when encoded chunks exist");
        assert(adaptedInput.video.webcodecsOutput.encodedChunks.length === 2, "video encoded chunks must be collected");
        assert(adaptedInput.audio.webcodecsOutput.encodedChunks.length === 2, "audio encoded chunks must be collected");
        assert(result.mp4Bytes instanceof Uint8Array, "mp4 bytes must be returned");
        assert(compilerInput === result.mp4BuildInput, "compiler input must be returned as mp4BuildInput");
    } finally {
        globalThis.VideoFrame = savedVideoFrame;
        globalThis.AudioData = savedAudioData;
        globalThis.OffscreenCanvas = savedOffscreenCanvas;
    }
}

export const EXPORT_EXECUTION_STRATEGY_TESTS = [
    test_ExportExecutionStrategy_decodesOnceAndComposesAcrossRange,
    test_ExportExecutionStrategy_rejectsInvalidFps,
    test_ExportExecutionStrategy_adaptsEncodedOutputsAndBuildsMp4
];
