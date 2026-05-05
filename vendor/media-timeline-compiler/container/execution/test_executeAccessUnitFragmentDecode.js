import {
    executeAccessUnitFragmentDecode
} from "./executeAccessUnitFragmentDecode.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export async function test_accessUnitDecode_emitsDeterministicOrder() {

    const fragment = {
        accessUnits: [
            { type: "video", id: 1 },
            { type: "audio", id: "a" },
            { type: "video", id: 2 }
        ]
    };

    const videoDecoder = {
        decode: async (unit) => [ { kind: "VideoFrame", id: unit.id } ]
    };

    const audioDecoder = {
        decode: async (unit) => [ { kind: "AudioData", id: unit.id } ]
    };

    const result = await executeAccessUnitFragmentDecode({
        fragment,
        videoDecoder,
        audioDecoder
    });

    assert(result.videoFrames.length === 2, "two video frames expected");
    assert(result.audioFrames.length === 1, "one audio frame expected");

    assert(result.videoFrames[0].id === 1, "video frame order preserved");
    assert(result.videoFrames[1].id === 2, "video frame order preserved");

    assert(result.audioFrames[0].id === "a", "audio frame order preserved");
}

export const CONTAINER_DECODE_TESTS = [
    test_accessUnitDecode_emitsDeterministicOrder
];
