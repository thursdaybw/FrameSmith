import { createMediaElementDecodePort } from "./createMediaElementDecodePort.js";
import { DecodedContainerBackedFragmentBatch } from "../DecodedContainerBackedFragmentBatch.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function makeFrame(timestamp) {
    return {
        timestamp,
        closed: false,
        close() {
            this.closed = true;
        }
    };
}

export async function test_MediaElementDecodePort_decodeRange_returnsDecodedBatchShape() {
    const port = createMediaElementDecodePort({
        mediaElementDriver: {
            async decodeVideoFrames() {
                return [makeFrame(0), makeFrame(33_333)];
            }
        }
    });

    const result = await port.decodeRange({
        plan: { fragments: [] },
        exportRange: { startSeconds: 0, endSeconds: 1 }
    });

    assert(result instanceof DecodedContainerBackedFragmentBatch, "must return decoded batch object");
    assert(Array.isArray(result.decodedVideoFrames), "decodedVideoFrames must be array");
    assert(Array.isArray(result.decodedAudioData), "decodedAudioData must be array");
    assert(result.decodedVideoFrames.length === 2, "must include returned video frames");
    assert(result.decodedAudioData.length === 0, "audio defaults to empty");
}

export async function test_MediaElementDecodePort_decodeRange_forwardsPlanAndRangeToDriver() {
    const calls = [];
    const plan = { id: "plan-1", fragments: [{}] };
    const exportRange = { startSeconds: 2, endSeconds: 3 };
    const port = createMediaElementDecodePort({
        mediaElementDriver: {
            async decodeVideoFrames(args) {
                calls.push(args);
                return [makeFrame(2_000_000)];
            }
        }
    });

    await port.decodeRange({ plan, exportRange });

    assert(calls.length === 1, "driver must be called once");
    assert(calls[0].plan === plan, "driver must receive same plan reference");
    assert(calls[0].exportRange === exportRange, "driver must receive same exportRange reference");
}

export async function test_MediaElementDecodePort_decodeRange_sortsOutputsByTimestamp() {
    const port = createMediaElementDecodePort({
        mediaElementDriver: {
            async decodeVideoFrames() {
                return [makeFrame(66_666), makeFrame(0), makeFrame(33_333)];
            },
            async decodeAudioData() {
                return [{ timestamp: 40_000 }, { timestamp: 20_000 }];
            }
        }
    });

    const result = await port.decodeRange({
        plan: { fragments: [] },
        exportRange: { startSeconds: 0, endSeconds: 1 }
    });

    assert(
        JSON.stringify(result.decodedVideoFrames.map(f => f.timestamp)) === JSON.stringify([0, 33_333, 66_666]),
        "video frames must be timestamp sorted"
    );
    assert(
        JSON.stringify(result.decodedAudioData.map(a => a.timestamp)) === JSON.stringify([20_000, 40_000]),
        "audio frames must be timestamp sorted"
    );
}

export async function test_MediaElementDecodePort_decodeRange_wrapsDriverErrorWithRangeContext() {
    const port = createMediaElementDecodePort({
        mediaElementDriver: {
            async decodeVideoFrames() {
                throw new Error("seek failed");
            }
        }
    });

    let error = null;
    try {
        await port.decodeRange({
            plan: { fragments: [] },
            exportRange: { startSeconds: 4, endSeconds: 5 }
        });
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "driver error must propagate");
    assert(error.message.includes("MediaElementDecodePort.decodeRange failed"), "must include port failure label");
    assert(error.message.includes("startSeconds=4"), "must include startSeconds context");
    assert(error.message.includes("endSeconds=5"), "must include endSeconds context");
}

export async function test_MediaElementDecodePort_decodeRange_closesFramesOnFailure() {
    const frames = [makeFrame(0), makeFrame(33_333)];
    const port = createMediaElementDecodePort({
        mediaElementDriver: {
            async decodeVideoFrames() {
                return frames;
            },
            async decodeAudioData() {
                throw new Error("audio decode fail");
            }
        }
    });

    let error = null;
    try {
        await port.decodeRange({
            plan: { fragments: [] },
            exportRange: { startSeconds: 0, endSeconds: 1 }
        });
    } catch (caught) {
        error = caught;
    }

    assert(error instanceof Error, "failure must be surfaced");
    assert(frames.every(frame => frame.closed === true), "video frames must be closed on failure");
}

export const MEDIA_ELEMENT_DECODE_PORT_TESTS = [
    test_MediaElementDecodePort_decodeRange_returnsDecodedBatchShape,
    test_MediaElementDecodePort_decodeRange_forwardsPlanAndRangeToDriver,
    test_MediaElementDecodePort_decodeRange_sortsOutputsByTimestamp,
    test_MediaElementDecodePort_decodeRange_wrapsDriverErrorWithRangeContext,
    test_MediaElementDecodePort_decodeRange_closesFramesOnFailure
];

