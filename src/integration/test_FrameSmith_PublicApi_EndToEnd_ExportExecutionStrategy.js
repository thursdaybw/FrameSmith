import { Timeline } from "../../vendor/media-timeline-compiler/Timeline.js";
import { Track } from "../../vendor/media-timeline-compiler/Track.js";
import { ProceduralClip } from "../../vendor/media-timeline-compiler/ProceduralClip.js";
import { Clip } from "../../vendor/media-timeline-compiler/Clip.js";

import { buildPrerenderPlanFromTimeline } from "../../vendor/media-timeline-compiler/compileTimeline.js";
import { resolveProceduralFragmentsAtTimeFromPlan } from "../prerender/resolveProceduralFragmentsAtTimeFromPlan.js";
import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "../prerender/decodeContainerAccessUnitsFromPreRenderPlanBatch.js";

import { executePreRenderPlan } from "../prerender/executePreRenderPlan.js";
import { composeAtTime } from "../composition/composeAtTime.js";
import { encodeAtTime } from "../encode/encodeAtTime.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

/**
 * Integration contract test for the execution seam.
 *
 * Scope:
 * - Verifies timeline -> plan -> procedural resolution -> container decode setup
 * - Verifies executePreRenderPlan delegates to an injected strategy
 *
 * Not in scope yet:
 * - Concrete ExportExecutionStrategy implementation
 * - Concrete PreviewExecutionStrategy implementation
 *
 * This test uses a fake export strategy to lock seam behavior while
 * concrete strategies are built.
 */
export async function test_FrameSmith_PublicApi_EndToEnd_ExportExecutionStrategy() {
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

    // -------------------------------------------------
    // Authoring
    // -------------------------------------------------

    const timeline = new Timeline(30);

    const mediaTrack = new Track();
    const overlayTrack = new Track();

    timeline.addTrack(mediaTrack);
    timeline.addTrack(overlayTrack);

    const containerClip = new Clip({
        startSeconds: 0,
        endSeconds: 30,
        trackView: {
            secondsToPts(seconds) {
                return Math.round(seconds * 1_000_000);
            },
            *iterateSamplesByPtsRange() {
                yield {
                    pts: 0,
                    dts: 0,
                    duration: 33_333,
                    isKeyframe: true,
                    data: new Uint8Array([1, 2, 3])
                };
            }
        }
    });

    mediaTrack.addClip(containerClip);

    const overlayClip = new ProceduralClip({
        kind: "text-overlay",
        startSeconds: 0,
        endSeconds: 30,
        items: [
            { text: "Hello", start: 0, end: 30 }
        ]
    });

    overlayTrack.addClip(overlayClip);

    // -------------------------------------------------
    // Planning
    // -------------------------------------------------

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    assert(Array.isArray(plan.fragments), "plan must contain fragments");

    // -------------------------------------------------
    // Pre-render stages
    // -------------------------------------------------

    const timeSeconds = 5;

    const proceduralResult =
        resolveProceduralFragmentsAtTimeFromPlan({
            plan,
            timeSeconds,
            timecodeFragmentIntentResolvers: {
                "text-overlay": () => ({
                    renderIntents: [{ kind: "text-overlay" }]
                })
            }
        });

    assert(Array.isArray(proceduralResult.renderIntents), "procedural result must include renderIntents array");
    assert(proceduralResult.renderIntents.length === 1, "procedural result must include one render intent");
    assert(proceduralResult.renderIntents[0].kind === "text-overlay", "procedural render intent kind must be text-overlay");

    let videoDecodeCalls = 0;
    let audioDecodeCalls = 0;

    const decodedContainerBackedFragmentBatch =
        await decodeContainerAccessUnitsFromPreRenderPlanBatch({
            plan,
            videoDecoder: {
                decode() { videoDecodeCalls++; },
                async flush() {}
            },
            audioDecoder: {
                decode() { audioDecodeCalls++; },
                async flush() {}
            }
        });

    assert(videoDecodeCalls === 1, "video decoder must be called once");
    assert(audioDecodeCalls === 1, "audio decoder must be called once");
    assert(decodedContainerBackedFragmentBatch.decodedVideoFrames.length === 1, "container decode must emit one video frame");
    assert(decodedContainerBackedFragmentBatch.decodedAudioData.length === 1, "container decode must emit one audio frame");

    const activeLayers = [
        { track: overlayTrack, zIndex: 10, muted: false },
        { track: mediaTrack, zIndex: 0, muted: false }
    ];
    const options = {
        audioStrategy: "mixToSingleTrack",
        frameDurationSeconds: 0.5,
        outputSpec: {
            width: 1920,
            height: 1080,
            fps: 2,
            pixelFormat: "RGBA",
            sampleRate: 48_000,
            channels: 2
        },
        background: { r: 0, g: 0, b: 0, a: 1 },
        qualityMode: "export",
        effectsContext: { deterministicSeed: 1234 },
        audioHeadroomDb: -3,
        normalizePolicy: "none",
        diagnostics: false
    };
    const exportRange = { startSeconds: 5, endSeconds: 6 };
    const fps = 2;
    const expectedTimecodes = [5, 5.5, 6];

    const composeCallTimes = [];
    const encodedAccessUnits = [];
    const videoEncodeCalls = [];
    const audioEncodeCalls = [];

    const videoEncoder = {
        encode({ frame, timeSeconds, provenance }) {
            assert(frame instanceof FakeVideoFrame, "video encoder must receive composed VideoFrame artifact");
            videoEncodeCalls.push(timeSeconds);
            return {
                codecDomain: "video",
                pts: frame.timestamp,
                duration: Math.round((1 / fps) * 1_000_000),
                isKeyframe: timeSeconds === exportRange.startSeconds,
                data: new Uint8Array([0x76, 0x31]),
                provenance
            };
        }
    };

    const audioEncoder = {
        encode({ audioData, timeSeconds, provenance }) {
            assert(audioData instanceof FakeAudioData, "audio encoder must receive composed AudioData artifact");
            audioEncodeCalls.push(timeSeconds);
            return {
                codecDomain: "audio",
                pts: audioData.timestamp,
                duration: Math.round((1 / fps) * 1_000_000),
                isKeyframe: false,
                data: new Uint8Array([0x61, 0x31]),
                provenance
            };
        }
    };

    // -------------------------------------------------
    // Execution strategy seam (export side, fake implementation)
    // -------------------------------------------------

    let strategyWasCalled = false;
    let compositionOutput = null;

    const exportExecutionStrategy = {
        execute({ plan: receivedPlan }) {
            assert(receivedPlan === plan, "execution strategy must receive the same plan object");
            assert(decodedContainerBackedFragmentBatch.decodedVideoFrames.length === 1, "export path must receive decoded video artifacts");
            assert(proceduralResult.renderIntents.length === 1, "export path must receive procedural render artifacts");

            const frameStepSeconds = 1 / fps;
            for (let t = exportRange.startSeconds; t <= exportRange.endSeconds + 1e-9; t += frameStepSeconds) {
                compositionOutput = composeAtTime({
                    timeSeconds: Number(t.toFixed(6)),
                    decodedContainerBackedFragmentBatch,
                    activeLayers,
                    renderIntents: proceduralResult.renderIntents,
                    options
                });
                composeCallTimes.push(Number(t.toFixed(6)));

                const encodedAtTimeResult = encodeAtTime({
                    timeSeconds: Number(t.toFixed(6)),
                    compositionOutput,
                    provenance: {
                        timelineId: timeline.id,
                        trackId: mediaTrack.id,
                        clipId: containerClip.id
                    },
                    encodeVideoFrame({ frame, timeSeconds, provenance }) {
                        return videoEncoder.encode({ frame, timeSeconds, provenance });
                    },
                    encodeAudioData({ audioData, timeSeconds, provenance }) {
                        return audioEncoder.encode({ audioData, timeSeconds, provenance });
                    }
                });

                encodedAccessUnits.push(...encodedAtTimeResult.encodedAccessUnits);
            }
            strategyWasCalled = true;
            return {
                encodedAccessUnits
            };
        }
    };

    const executionResult = await executePreRenderPlan({
        plan,
        executionStrategy: exportExecutionStrategy
    });

    assert(strategyWasCalled, "export execution strategy must be invoked");
    assert(composeCallTimes.length === expectedTimecodes.length, "composeAtTime must be called once per export timecode");
    assert(
        JSON.stringify(composeCallTimes) === JSON.stringify(expectedTimecodes),
        "composeAtTime must be called in export-range timecode order"
    );
    assert(compositionOutput.composedVideoFrame.timestamp === expectedTimecodes.at(-1), "composition must return composedVideoFrame");
    assert(compositionOutput.composedAudioData.timestamp === expectedTimecodes.at(-1), "composition must return composedAudioData");
    assert(
        JSON.stringify(compositionOutput.composedVideoFrame.layerOrder) === JSON.stringify([0, 10]),
        "composition must order layers by zIndex"
    );
    assert(
        compositionOutput.composedAudioData.audioStrategy === "mixToSingleTrack",
        "composition must receive options.audioStrategy"
    );
    assert(videoEncodeCalls.length === expectedTimecodes.length, "video encode must run once per export timecode");
    assert(audioEncodeCalls.length === expectedTimecodes.length, "audio encode must run once per export timecode");
    assert(
        executionResult.encodedAccessUnits.length === expectedTimecodes.length * 2,
        "execution strategy must emit one video and one audio access unit per timecode"
    );

    const encodedVideoUnits = executionResult.encodedAccessUnits.filter(unit => unit.codecDomain === "video");
    const encodedAudioUnits = executionResult.encodedAccessUnits.filter(unit => unit.codecDomain === "audio");

    assert(encodedVideoUnits.length === expectedTimecodes.length, "encoded video unit count must match export timecodes");
    assert(encodedAudioUnits.length === expectedTimecodes.length, "encoded audio unit count must match export timecodes");
    assert(
        JSON.stringify(encodedVideoUnits.map(unit => unit.pts)) === JSON.stringify([5_000_000, 5_500_000, 6_000_000]),
        "encoded video PTS values must follow export range in microseconds"
    );
    assert(
        JSON.stringify(encodedAudioUnits.map(unit => unit.pts)) === JSON.stringify([5_000_000, 5_500_000, 6_000_000]),
        "encoded audio PTS values must follow export range in microseconds"
    );
    assert(
        encodedVideoUnits.every(unit => unit.provenance.trackId === mediaTrack.id && unit.provenance.clipId === containerClip.id),
        "encoded video units must preserve source provenance"
    );
    assert(
        encodedAudioUnits.every(unit => unit.provenance.trackId === mediaTrack.id && unit.provenance.clipId === containerClip.id),
        "encoded audio units must preserve source provenance"
    );
    } finally {
        globalThis.VideoFrame = savedVideoFrame;
        globalThis.AudioData = savedAudioData;
        globalThis.OffscreenCanvas = savedOffscreenCanvas;
    }
}

export const INTEGRATION_TESTS = [
    test_FrameSmith_PublicApi_EndToEnd_ExportExecutionStrategy
];
