import { composeAtTime } from "./composeAtTime.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_composeAtTime_ordersLayersByZIndex() {
    const result = composeAtTime({
        timeSeconds: 2.5,
        decodedContainerBackedFragmentBatch: {
            decodedVideoFrames: [],
            decodedAudioData: []
        },
        activeLayers: [
            { zIndex: 9 },
            { zIndex: 1 },
            { zIndex: 5 }
        ],
        renderIntents: [],
        options: {
            audioStrategy: "mixToSingleTrack"
        }
    });

    assert(
        JSON.stringify(result.composedVideoFrame.layerOrder) === JSON.stringify([1, 5, 9]),
        "layer order must be sorted by zIndex ascending"
    );
    assert(result.composedVideoFrame.timestamp === 2.5, "composedVideoFrame timestamp must match timeSeconds");
    assert(result.composedAudioData.timestamp === 2.5, "composedAudioData timestamp must match timeSeconds");
    assert(result.composedAudioData.audioStrategy === "mixToSingleTrack", "audioStrategy must pass through options");
}

export function test_composeAtTime_usesDefaultAudioStrategy() {
    const result = composeAtTime({
        timeSeconds: 1,
        decodedContainerBackedFragmentBatch: {},
        activeLayers: [],
        renderIntents: []
    });

    assert(
        result.composedAudioData.audioStrategy === "mixToSingleTrack",
        "default audioStrategy must be mixToSingleTrack"
    );
}

export function test_composeAtTime_guardMessageIncludesReceivedValue() {
    let error = null;
    try {
        composeAtTime({
            timeSeconds: "bad-value",
            decodedContainerBackedFragmentBatch: {},
            activeLayers: [],
            renderIntents: []
        });
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "invalid timeSeconds must throw");
    assert(
        error.message.includes("Received [object String]"),
        "guard message must include received value type"
    );
}

export function test_composeAtTime_attachesWebCodecsArtifactsWhenAvailable() {
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

    try {
        const result = composeAtTime({
            timeSeconds: 1.5,
            decodedContainerBackedFragmentBatch: {},
            activeLayers: [{ zIndex: 2 }, { zIndex: 1 }],
            renderIntents: [],
            options: {
                outputSpec: {
                    width: 640,
                    height: 360,
                    sampleRate: 48_000,
                    channels: 2,
                    fps: 30
                },
                frameDurationSeconds: 1 / 30
            }
        });

        assert(result.composedVideoFrame.timestamp === 1.5, "metadata timestamp stays in seconds");
        assert(result.composedVideoFrame.videoFrame instanceof FakeVideoFrame, "videoFrame artifact must be attached");
        assert(result.composedVideoFrame.videoFrame.timestamp === 1_500_000, "videoFrame timestamp must be microseconds");

        assert(result.composedAudioData.audioData instanceof FakeAudioData, "audioData artifact must be attached");
        assert(result.composedAudioData.audioData.timestamp === 1_500_000, "audioData timestamp must be microseconds");
        assert(result.diagnostics.issues.length === 0, "successful artifact creation must report no diagnostics");
    } finally {
        globalThis.VideoFrame = savedVideoFrame;
        globalThis.AudioData = savedAudioData;
        globalThis.OffscreenCanvas = savedOffscreenCanvas;
    }
}

export function test_composeAtTime_preservesArtifactFailureAsDiagnosticsInBestEffortMode() {
    const savedVideoFrame = globalThis.VideoFrame;
    const savedAudioData = globalThis.AudioData;
    const savedOffscreenCanvas = globalThis.OffscreenCanvas;

    class ThrowingVideoFrame {
        constructor() {
            throw new Error("video frame constructor failed");
        }
    }

    class ThrowingAudioData {
        constructor() {
            throw new Error("audio data constructor failed");
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

    globalThis.VideoFrame = ThrowingVideoFrame;
    globalThis.AudioData = ThrowingAudioData;
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;

    try {
        const result = composeAtTime({
            timeSeconds: 2,
            decodedContainerBackedFragmentBatch: {},
            activeLayers: [],
            renderIntents: []
        });

        assert(result.composedVideoFrame.videoFrame === null, "videoFrame must be null when allocation fails");
        assert(result.composedAudioData.audioData === null, "audioData must be null when allocation fails");
        assert(result.diagnostics.issues.length === 2, "both allocation failures must be preserved in diagnostics");
        assert(
            result.diagnostics.issues.some(issue => issue.code === "COMPOSITION_VIDEOFRAME_ALLOCATE_FAILED"),
            "video allocation failure code must be preserved"
        );
        assert(
            result.diagnostics.issues.some(issue => issue.code === "COMPOSITION_AUDIODATA_ALLOCATE_FAILED"),
            "audio allocation failure code must be preserved"
        );
    } finally {
        globalThis.VideoFrame = savedVideoFrame;
        globalThis.AudioData = savedAudioData;
        globalThis.OffscreenCanvas = savedOffscreenCanvas;
    }
}

export function test_composeAtTime_strictModeThrowsOnArtifactFailure() {
    const savedVideoFrame = globalThis.VideoFrame;
    const savedOffscreenCanvas = globalThis.OffscreenCanvas;

    class ThrowingVideoFrame {
        constructor() {
            throw new Error("video frame constructor failed");
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

    globalThis.VideoFrame = ThrowingVideoFrame;
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;

    let error = null;
    try {
        composeAtTime({
            timeSeconds: 2,
            decodedContainerBackedFragmentBatch: {},
            activeLayers: [],
            renderIntents: [],
            options: {
                strictComposition: true
            }
        });
    } catch (caught) {
        error = caught;
    } finally {
        globalThis.VideoFrame = savedVideoFrame;
        globalThis.OffscreenCanvas = savedOffscreenCanvas;
    }

    assert(error instanceof Error, "strict mode must throw when artifact allocation fails");
    assert(error.code === "COMPOSITION_STRICT_FAILURE", "strict mode must throw composition strict failure code");
    assert(error.cause && error.cause.code === "COMPOSITION_VIDEOFRAME_ALLOCATE_FAILED", "strict mode must preserve primary failure cause");
}

export const COMPOSITION_TESTS = [
    test_composeAtTime_ordersLayersByZIndex,
    test_composeAtTime_usesDefaultAudioStrategy,
    test_composeAtTime_guardMessageIncludesReceivedValue,
    test_composeAtTime_attachesWebCodecsArtifactsWhenAvailable,
    test_composeAtTime_preservesArtifactFailureAsDiagnosticsInBestEffortMode,
    test_composeAtTime_strictModeThrowsOnArtifactFailure
];
