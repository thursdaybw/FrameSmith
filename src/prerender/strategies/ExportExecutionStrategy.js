import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "../decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import { resolveProceduralFragmentsAtTimeFromPlan } from "../resolveProceduralFragmentsAtTimeFromPlan.js";
import { composeAtTime } from "../../composition/composeAtTime.js";
import { encodeAtTime } from "../../encode/encodeAtTime.js";
import { adaptEncodedOutputsToMp4BuildInput } from "../../export/adaptEncodedOutputsToMp4BuildInput.js";
import { createMp4FromInputs } from "../../mux/native/compiler/createMp4FromInputs.js";

function isAudioDataInstance(value) {
    return typeof AudioData === "function" && value instanceof AudioData;
}

function isDrawableVideoFrameCandidate(value) {
    if (!value || typeof value !== "object") return false;
    if (typeof value.timestamp !== "number") return false;
    if (typeof VideoFrame === "function" && value instanceof VideoFrame) return true;
    return !!value.drawable;
}

function isVideoFrameInstance(value) {
    return typeof VideoFrame === "function" && value instanceof VideoFrame;
}

function pickFrameForTargetTimestampUs({
    frames,
    targetTimestampUs,
    searchState
}) {
    if (!Array.isArray(frames) || frames.length === 0) {
        return null;
    }

    // Monotonic advance toward target time.
    while (
        searchState.index + 1 < frames.length &&
        typeof frames[searchState.index + 1]?.timestamp === "number" &&
        frames[searchState.index + 1].timestamp <= targetTimestampUs
    ) {
        searchState.index++;
    }

    const current = frames[searchState.index] ?? null;
    const next = frames[searchState.index + 1] ?? null;

    if (!current) return next;
    if (!next) return current;

    if (typeof current.timestamp !== "number" || typeof next.timestamp !== "number") {
        return current;
    }

    const currentDelta = Math.abs(current.timestamp - targetTimestampUs);
    const nextDelta = Math.abs(next.timestamp - targetTimestampUs);

    return nextDelta < currentDelta ? next : current;
}

export class ExportExecutionStrategy {
    constructor({
        videoDecoder,
        audioDecoder,
        encodeVideoFrame,
        encodeAudioData,
        flushVideoEncoder,
        flushAudioEncoder,
        getVideoWebCodecsOutput,
        getAudioWebCodecsOutput,
        adaptEncodedOutputsToMp4BuildInputFn = adaptEncodedOutputsToMp4BuildInput,
        createMp4FromInputsFn = createMp4FromInputs,
        timecodeFragmentIntentResolvers = {},
        activeLayers = [],
        options = {}
    } = {}) {
        this.videoDecoder = videoDecoder;
        this.audioDecoder = audioDecoder;
        this.encodeVideoFrame = encodeVideoFrame;
        this.encodeAudioData = encodeAudioData;
        this.flushVideoEncoder = flushVideoEncoder;
        this.flushAudioEncoder = flushAudioEncoder;
        this.getVideoWebCodecsOutput = getVideoWebCodecsOutput;
        this.getAudioWebCodecsOutput = getAudioWebCodecsOutput;
        this.adaptEncodedOutputsToMp4BuildInputFn = adaptEncodedOutputsToMp4BuildInputFn;
        this.createMp4FromInputsFn = createMp4FromInputsFn;
        this.timecodeFragmentIntentResolvers = timecodeFragmentIntentResolvers;
        this.activeLayers = activeLayers;
        this.options = options;
    }

    async execute({
        plan,
        exportRange = { startSeconds: 0, endSeconds: 0 },
        fps = 30,
        retainComposedFrames = true
    }) {
        // Retention and loop-memory policy lives here by design.
        // See docs/framesmith-architecture.md:
        // "Memory Ownership and Future Optimization Seams"
        if (!plan || !Array.isArray(plan.fragments)) {
            throw new Error("ExportExecutionStrategy.execute: plan with fragments is required");
        }
        if (typeof fps !== "number" || fps <= 0) {
            throw new Error("ExportExecutionStrategy.execute: fps must be > 0");
        }

        const decodedContainerBackedFragmentBatch =
            await decodeContainerAccessUnitsFromPreRenderPlanBatch({
                plan,
                videoDecoder: this.videoDecoder,
                audioDecoder: this.audioDecoder,
                exportRange
            });
        const sourceVideoFramesToClose = new Set();
        try {
            const frameStepSeconds = 1 / fps;
            const startSeconds = exportRange.startSeconds ?? 0;
            const endSeconds = exportRange.endSeconds ?? startSeconds;
            const exportStartUs = Math.round(startSeconds * 1_000_000);
            const exportEndUs = Math.round(endSeconds * 1_000_000);

            const composedFrames = [];
            const encodedAccessUnits = [];
            const shouldRetainComposedFrames = retainComposedFrames === true;
            if (!shouldRetainComposedFrames) {
                console.log("[ExportExecutionStrategy] memory mode", {
                    retainComposedFrames: false
                });
            }

            const encodedVideoChunks = [];
            const encodedAudioChunks = [];
            let videoDecoderConfig = null;
            let audioDecoderConfig = null;
            let frameIndex = 0;
            const fallbackFrameTimes = [];
            for (let t = startSeconds; t <= endSeconds + 1e-9; t += frameStepSeconds) {
                fallbackFrameTimes.push(Number(t.toFixed(6)));
            }

            const decodedVideoFrames = Array.isArray(decodedContainerBackedFragmentBatch?.decodedVideoFrames)
                ? decodedContainerBackedFragmentBatch.decodedVideoFrames
                : [];
            const videoFramesFromDecodedRange = decodedVideoFrames
                .filter(isDrawableVideoFrameCandidate)
                .filter(frame => frame.timestamp >= exportStartUs && frame.timestamp <= exportEndUs)
                .sort((a, b) => a.timestamp - b.timestamp);

            // Export video as CFR on requested fps grid while selecting source
            // pixels by nearest decoded timestamp (not raw array index).
            const videoCompositionTimes = fallbackFrameTimes;

            const totalFrames = videoCompositionTimes.length;
            const hasDecodedAudioSamples = Array.isArray(decodedContainerBackedFragmentBatch?.decodedAudioData) &&
                decodedContainerBackedFragmentBatch.decodedAudioData.some(isAudioDataInstance);

            const encodeVideoFrame = this.encodeVideoFrame ? (args) => {
                const result = this.encodeVideoFrame(args) ?? {};
                if (result.encodedChunk) {
                    encodedVideoChunks.push(result.encodedChunk);
                }
                if (!videoDecoderConfig && result.decoderConfig) {
                    videoDecoderConfig = result.decoderConfig;
                }
                return result.accessUnit ?? result;
            } : undefined;

            const encodeAudioData = this.encodeAudioData ? (args) => {
                const result = this.encodeAudioData(args) ?? {};
                if (result.encodedChunk) {
                    encodedAudioChunks.push(result.encodedChunk);
                }
                if (!audioDecoderConfig && result.decoderConfig) {
                    audioDecoderConfig = result.decoderConfig;
                }
                return result.accessUnit ?? result;
            } : undefined;

            const hasDecodedVideoCadence = videoFramesFromDecodedRange.length > 0;
            if (hasDecodedVideoCadence) {
                console.log("[ExportExecutionStrategy] video compose/encode from decoded cadence", {
                    decodedVideoFrames: decodedVideoFrames.length,
                    exportRangeVideoFrames: videoFramesFromDecodedRange.length,
                    cfrOutputFrames: videoCompositionTimes.length
                });
            }

            const videoFrameSearchState = { index: 0 };
            const frameSelectionTrace = [];
            let previousMappedDecodedVideoFrame = null;
            for (let compositionIndex = 0; compositionIndex < videoCompositionTimes.length; compositionIndex++) {
                const timeSeconds = videoCompositionTimes[compositionIndex];
                frameIndex++;

                if (frameIndex === 1 || frameIndex % 30 === 0 || frameIndex === totalFrames) {
                    console.log("[ExportExecutionStrategy] compose/encode progress", {
                        frameIndex,
                        totalFrames,
                        timeSeconds
                    });
                }

                const { renderIntents } = resolveProceduralFragmentsAtTimeFromPlan({
                    plan,
                    timeSeconds,
                    timecodeFragmentIntentResolvers: this.timecodeFragmentIntentResolvers
                });

                const targetTimestampUs = Math.round(timeSeconds * 1_000_000);
                const mappedDecodedVideoFrame = hasDecodedVideoCadence
                    ? pickFrameForTargetTimestampUs({
                        frames: videoFramesFromDecodedRange,
                        targetTimestampUs,
                        searchState: videoFrameSearchState
                    })
                    : null;
                const mappedTimestampUs =
                    typeof mappedDecodedVideoFrame?.timestamp === "number"
                        ? mappedDecodedVideoFrame.timestamp
                        : null;
                frameSelectionTrace.push({
                    frameIndex,
                    targetTimestampUs,
                    sourceTimestampUs: mappedTimestampUs,
                    sourceDeltaUs:
                        typeof mappedTimestampUs === "number"
                            ? mappedTimestampUs - targetTimestampUs
                            : null,
                    repeatedSourceFrame:
                        !!mappedDecodedVideoFrame &&
                        mappedDecodedVideoFrame === previousMappedDecodedVideoFrame
                });
                previousMappedDecodedVideoFrame = mappedDecodedVideoFrame;
                const perTimeDecodedBatch =
                    mappedDecodedVideoFrame
                        ? {
                            ...decodedContainerBackedFragmentBatch,
                            decodedVideoFrames: [mappedDecodedVideoFrame]
                        }
                        : decodedContainerBackedFragmentBatch;

                if (isVideoFrameInstance(mappedDecodedVideoFrame) && typeof mappedDecodedVideoFrame.close === "function") {
                    sourceVideoFramesToClose.add(mappedDecodedVideoFrame);
                }
                const compositionOutput = composeAtTime({
                    timeSeconds,
                    decodedContainerBackedFragmentBatch: perTimeDecodedBatch,
                    activeLayers: this.activeLayers,
                    renderIntents,
                    options: this.options
                });
                if (shouldRetainComposedFrames) {
                    composedFrames.push(compositionOutput);
                }

                const encodedAtTimeResult = encodeAtTime({
                    timeSeconds,
                    compositionOutput,
                    provenance: {
                        planId: plan.id ?? null
                    },
                    options: this.options,
                    encodeVideoFrame,
                    // If decoded AudioData is available, encode it in native audio cadence
                    // after the video-frame loop to avoid re-encoding at video cadence.
                    encodeAudioData: hasDecodedAudioSamples ? undefined : encodeAudioData
                });

                encodedAccessUnits.push(...encodedAtTimeResult.encodedAccessUnits);
            }

            if (frameSelectionTrace.length > 0) {
                const repeatedSourceFrameCount = frameSelectionTrace.filter(entry => entry.repeatedSourceFrame).length;
                const withDelta = frameSelectionTrace.filter(entry => typeof entry.sourceDeltaUs === "number");
                const maxAbsSourceDeltaUs = withDelta.length > 0
                    ? Math.max(...withDelta.map(entry => Math.abs(entry.sourceDeltaUs)))
                    : null;

                console.log("[ExportExecutionStrategy] video frame selection summary", {
                    entries: frameSelectionTrace.length,
                    repeatedSourceFrameCount,
                    maxAbsSourceDeltaUs
                });
                console.log(
                    "[ExportExecutionStrategy] video frame selection trace JSON",
                    JSON.stringify(frameSelectionTrace)
                );
            }

            if (hasDecodedAudioSamples && encodeAudioData) {
                const decodedAudioFrames = decodedContainerBackedFragmentBatch.decodedAudioData
                    .filter(isAudioDataInstance)
                    .sort((a, b) => a.timestamp - b.timestamp);
                const exportRangeAudioFrames = decodedAudioFrames.filter((audioData) =>
                    audioData.timestamp >= exportStartUs && audioData.timestamp <= exportEndUs
                );

                console.log("[ExportExecutionStrategy] audio encode from decoded cadence", {
                    decodedAudioFrames: decodedAudioFrames.length,
                    exportRangeAudioFrames: exportRangeAudioFrames.length
                });

                for (const audioData of exportRangeAudioFrames) {
                    const timeSeconds = audioData.timestamp / 1_000_000;
                    const audioAccessUnit = encodeAudioData({
                        audioData,
                        timeSeconds,
                        provenance: {
                            planId: plan.id ?? null
                        },
                        options: this.options
                    });
                    if (!audioAccessUnit || typeof audioAccessUnit !== "object") {
                        throw new Error("ExportExecutionStrategy: encodeAudioData must return an access-unit object");
                    }
                    encodedAccessUnits.push(audioAccessUnit);
                }
            }

            if (typeof this.flushVideoEncoder === "function") {
                console.log("[ExportExecutionStrategy] flushing video encoder");
                await this.flushVideoEncoder();
            }

            if (typeof this.flushAudioEncoder === "function") {
                console.log("[ExportExecutionStrategy] flushing audio encoder");
                await this.flushAudioEncoder();
            }

            if (encodedVideoChunks.length === 0 && typeof this.getVideoWebCodecsOutput === "function") {
                const videoOutput = this.getVideoWebCodecsOutput();
                if (videoOutput?.encodedChunks) {
                    encodedVideoChunks.push(...videoOutput.encodedChunks);
                }
                if (!videoDecoderConfig && videoOutput?.decoderConfig) {
                    videoDecoderConfig = videoOutput.decoderConfig;
                }
            }

            if (encodedAudioChunks.length === 0 && typeof this.getAudioWebCodecsOutput === "function") {
                const audioOutput = this.getAudioWebCodecsOutput();
                if (audioOutput?.encodedChunks) {
                    encodedAudioChunks.push(...audioOutput.encodedChunks);
                }
                if (!audioDecoderConfig && audioOutput?.decoderConfig) {
                    audioDecoderConfig = audioOutput.decoderConfig;
                }
            }

            const hasEncodedVideo = encodedVideoChunks.length > 0 && !!videoDecoderConfig;
            const hasEncodedAudio = encodedAudioChunks.length > 0 && !!audioDecoderConfig;

            let mp4BuildInput = null;
            let mp4Bytes = null;

            if (hasEncodedVideo || hasEncodedAudio) {
                const trackTimescale = this.options.trackTimescale ?? 1_000_000;
                const outputSpec = this.options.outputSpec ?? {};

                mp4BuildInput = this.adaptEncodedOutputsToMp4BuildInputFn({
                    video: hasEncodedVideo ? {
                        webcodecsOutput: {
                            encodedChunks: encodedVideoChunks,
                            decoderConfig: videoDecoderConfig
                        },
                        buildParameters: {
                            codedWidth: outputSpec.width ?? 2,
                            codedHeight: outputSpec.height ?? 2,
                            trackTimescale
                        }
                    } : undefined,
                    audio: hasEncodedAudio ? {
                        webcodecsOutput: {
                            encodedChunks: encodedAudioChunks,
                            decoderConfig: audioDecoderConfig
                        },
                        buildParameters: {
                            trackTimescale,
                            channelCount: outputSpec.channels ?? 2,
                            sampleRate: outputSpec.sampleRate ?? 48_000
                        }
                    } : undefined
                });
                console.log("[ExportExecutionStrategy] adapted encoded outputs", {
                    hasEncodedVideo,
                    hasEncodedAudio,
                    videoChunkCount: encodedVideoChunks.length,
                    audioChunkCount: encodedAudioChunks.length
                });

                mp4Bytes = this.createMp4FromInputsFn(mp4BuildInput);
                console.log("[ExportExecutionStrategy] MP4 compiled", {
                    byteLength: mp4Bytes?.length ?? null
                });
            }

            return {
                decodedContainerBackedFragmentBatch,
                composedFrames: shouldRetainComposedFrames ? composedFrames : [],
                encodedAccessUnits,
                mp4BuildInput,
                mp4Bytes
            };
        } finally {
            for (const frame of sourceVideoFramesToClose) {
                try {
                    frame.close();
                } catch {
                    // Ignore close failures in cleanup path.
                }
            }
        }
    }
}
