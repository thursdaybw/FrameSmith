import { resolveProceduralFragmentsAtTimeFromPlan } from "../resolveProceduralFragmentsAtTimeFromPlan.js";
import { composeAtTime } from "../../composition/composeAtTime.js?v=2026-02-15-1";
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

function getNowMs() {
    if (globalThis.performance && typeof globalThis.performance.now === "function") {
        return globalThis.performance.now();
    }
    return Date.now();
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

function canReuseComposedVideoFrame({
    repeatedSourceFrame,
    renderIntents,
    previousCompositionOutput
}) {
    if (!repeatedSourceFrame) return false;
    if (!Array.isArray(renderIntents) || renderIntents.length > 0) return false;
    if (!previousCompositionOutput || typeof previousCompositionOutput !== "object") return false;
    const previousVideoFrame = previousCompositionOutput?.composedVideoFrame?.videoFrame;
    if (!previousVideoFrame) return false;
    return typeof VideoFrame === "function";
}

function cloneComposedVideoFrameForTimestamp({
    previousCompositionOutput,
    targetTimestampUs,
    timeSeconds
}) {
    const previousComposedVideo = previousCompositionOutput.composedVideoFrame ?? {};
    const previousVideoFrame = previousComposedVideo.videoFrame ?? null;
    if (!previousVideoFrame) return null;

    try {
        const reusedVideoFrame = new VideoFrame(previousVideoFrame, {
            timestamp: targetTimestampUs
        });
        return {
            composedVideoFrame: {
                timestamp: timeSeconds,
                layerOrder: Array.isArray(previousComposedVideo.layerOrder)
                    ? previousComposedVideo.layerOrder
                    : [],
                videoFrame: reusedVideoFrame
            },
            composedAudioData: {
                timestamp: timeSeconds,
                audioStrategy: "mixToSingleTrack",
                audioData: null
            },
            diagnostics: {
                issues: [],
                timingMs: {
                    total: 0,
                    videoArtifact: 0,
                    videoSelectSource: 0,
                    videoDrawBaseFrame: 0,
                    videoDrawRenderIntents: 0,
                    videoAllocateFrame: 0,
                    audioArtifact: 0,
                    audioAllocateData: 0
                }
            }
        };
    } catch {
        return null;
    }
}

export class ExportExecutionStrategy {
    constructor({
        decodePort,
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
        this.decodePort = decodePort;
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
        if (!this.decodePort || typeof this.decodePort.decodeRange !== "function") {
            throw new Error("ExportExecutionStrategy.execute: decodePort.decodeRange is required");
        }

        let decodedContainerBackedFragmentBatch = null;
        const executeStartedAtMs = getNowMs();
        const executeTimingMs = {
            decodeRange: 0,
            composeAtTime: 0,
            encodeAtTime: 0,
            composeVideoArtifact: 0,
            composeVideoSelectSource: 0,
            composeVideoDrawBaseFrame: 0,
            composeVideoDrawRenderIntents: 0,
            composeVideoAllocateFrame: 0,
            composeAudioArtifact: 0,
            composeAudioAllocateData: 0,
            composeAndEncodeVideo: 0,
            encodeAudio: 0,
            flushEncoders: 0,
            adaptOutputs: 0,
            compileMp4: 0,
            totalExecute: 0
        };
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

            // Export video as CFR on requested fps grid while selecting source
            // pixels by nearest decoded timestamp (not raw array index).
            const videoCompositionTimes = fallbackFrameTimes;
            const totalFrames = videoCompositionTimes.length;
            const decodeChunkSeconds = Math.max(
                0.5,
                Number.isFinite(this.options.decodeChunkSeconds)
                    ? this.options.decodeChunkSeconds
                    : 1.0
            );

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

            const frameSelectionTrace = [];
            let previousMappedDecodedVideoFrame = null;
            let previousCompositionOutput = null;
            const encodedAudioTimestamps = new Set();
            const closeDecodedBatchArtifacts = (batch) => {
                if (!batch || typeof batch !== "object") return;
                const videoFrames = Array.isArray(batch.decodedVideoFrames) ? batch.decodedVideoFrames : [];
                for (const frame of videoFrames) {
                    if (isVideoFrameInstance(frame) && typeof frame.close === "function") {
                        try { frame.close(); } catch {}
                    }
                }
                const audioFrames = Array.isArray(batch.decodedAudioData) ? batch.decodedAudioData : [];
                for (const audioData of audioFrames) {
                    if (isAudioDataInstance(audioData) && typeof audioData.close === "function") {
                        try { audioData.close(); } catch {}
                    }
                }
            };

            let loggedVideoCadence = false;
            for (let chunkStart = startSeconds; chunkStart < endSeconds + 1e-9; chunkStart += decodeChunkSeconds) {
                const chunkEnd = Math.min(endSeconds, chunkStart + decodeChunkSeconds);
                const isLastChunk = chunkEnd >= endSeconds - 1e-9;
                const chunkRange = {
                    startSeconds: chunkStart,
                    endSeconds: chunkEnd
                };
                const chunkTimes = videoCompositionTimes.filter((timeSeconds) => {
                    if (timeSeconds + 1e-9 < chunkStart) return false;
                    if (isLastChunk) return timeSeconds <= chunkEnd + 1e-9;
                    return timeSeconds < chunkEnd - 1e-9;
                });
                if (chunkTimes.length === 0) {
                    continue;
                }

                let decodedChunkBatch;
                try {
                    const decodeStartedAtMs = getNowMs();
                    decodedChunkBatch = await this.decodePort.decodeRange({
                        plan,
                        exportRange: chunkRange
                    });
                    executeTimingMs.decodeRange += Math.max(0, getNowMs() - decodeStartedAtMs);
                } catch (error) {
                    throw new Error(
                        "ExportExecutionStrategy.execute: decodePort.decodeRange failed " +
                        `(startSeconds=${chunkRange.startSeconds}, endSeconds=${chunkRange.endSeconds}): ` +
                        `${error?.message ?? String(error)}`
                    );
                }
                decodedContainerBackedFragmentBatch = decodedChunkBatch;

                const decodedVideoFrames = Array.isArray(decodedChunkBatch?.decodedVideoFrames)
                    ? decodedChunkBatch.decodedVideoFrames
                    : [];
                const videoFramesFromDecodedRange = decodedVideoFrames
                    .filter(isDrawableVideoFrameCandidate)
                    .filter(frame => frame.timestamp >= exportStartUs && frame.timestamp <= exportEndUs)
                    .sort((a, b) => a.timestamp - b.timestamp);
                const hasDecodedVideoCadence = videoFramesFromDecodedRange.length > 0;
                const hasDecodedAudioSamples = Array.isArray(decodedChunkBatch?.decodedAudioData) &&
                    decodedChunkBatch.decodedAudioData.some(isAudioDataInstance);

                if (hasDecodedVideoCadence && !loggedVideoCadence) {
                    loggedVideoCadence = true;
                    console.log("[ExportExecutionStrategy] video compose/encode from decoded cadence", {
                        decodedVideoFrames: decodedVideoFrames.length,
                        exportRangeVideoFrames: videoFramesFromDecodedRange.length,
                        cfrOutputFrames: videoCompositionTimes.length
                    });
                }

                const videoFrameSearchState = { index: 0 };
                for (let compositionIndex = 0; compositionIndex < chunkTimes.length; compositionIndex++) {
                    const composeEncodeStartedAtMs = getNowMs();
                    const timeSeconds = chunkTimes[compositionIndex];
                    frameIndex++;
                    if (typeof this.options?.onVideoProgress === "function") {
                        try {
                            this.options.onVideoProgress({
                                frameIndex,
                                totalFrames,
                                timeSeconds
                            });
                        } catch {}
                    }

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
                    const repeatedSourceFrame =
                        !!mappedDecodedVideoFrame &&
                        mappedDecodedVideoFrame === previousMappedDecodedVideoFrame;
                    frameSelectionTrace.push({
                        frameIndex,
                        targetTimestampUs,
                        sourceTimestampUs: mappedTimestampUs,
                        sourceDeltaUs:
                            typeof mappedTimestampUs === "number"
                                ? mappedTimestampUs - targetTimestampUs
                                : null,
                        repeatedSourceFrame
                    });
                    previousMappedDecodedVideoFrame = mappedDecodedVideoFrame;
                    const perTimeDecodedBatch =
                        mappedDecodedVideoFrame
                            ? {
                                ...decodedChunkBatch,
                                decodedVideoFrames: [mappedDecodedVideoFrame]
                            }
                            : decodedChunkBatch;

                    const composeStartedAtMs = getNowMs();
                    let compositionOutput = null;
                    if (canReuseComposedVideoFrame({
                        repeatedSourceFrame,
                        renderIntents,
                        previousCompositionOutput
                    })) {
                        compositionOutput = cloneComposedVideoFrameForTimestamp({
                            previousCompositionOutput,
                            targetTimestampUs,
                            timeSeconds
                        });
                    }
                    if (!compositionOutput) {
                        compositionOutput = composeAtTime({
                            timeSeconds,
                            decodedContainerBackedFragmentBatch: perTimeDecodedBatch,
                            activeLayers: this.activeLayers,
                            renderIntents,
                            options: this.options
                        });
                    }
                    executeTimingMs.composeAtTime += Math.max(0, getNowMs() - composeStartedAtMs);
                    const composeTimingMs = compositionOutput?.diagnostics?.timingMs;
                    if (composeTimingMs && typeof composeTimingMs === "object") {
                        executeTimingMs.composeVideoArtifact += composeTimingMs.videoArtifact ?? 0;
                        executeTimingMs.composeVideoSelectSource += composeTimingMs.videoSelectSource ?? 0;
                        executeTimingMs.composeVideoDrawBaseFrame += composeTimingMs.videoDrawBaseFrame ?? 0;
                        executeTimingMs.composeVideoDrawRenderIntents += composeTimingMs.videoDrawRenderIntents ?? 0;
                        executeTimingMs.composeVideoAllocateFrame += composeTimingMs.videoAllocateFrame ?? 0;
                        executeTimingMs.composeAudioArtifact += composeTimingMs.audioArtifact ?? 0;
                        executeTimingMs.composeAudioAllocateData += composeTimingMs.audioAllocateData ?? 0;
                    }
                    if (shouldRetainComposedFrames) {
                        composedFrames.push(compositionOutput);
                    }

                    const encodeAtTimeStartedAtMs = getNowMs();
                    const encodedAtTimeResult = encodeAtTime({
                        timeSeconds,
                        compositionOutput,
                        provenance: {
                            planId: plan.id ?? null
                        },
                        options: this.options,
                        encodeVideoFrame,
                        encodeAudioData: hasDecodedAudioSamples ? undefined : encodeAudioData
                    });
                    executeTimingMs.encodeAtTime += Math.max(0, getNowMs() - encodeAtTimeStartedAtMs);

                    encodedAccessUnits.push(...encodedAtTimeResult.encodedAccessUnits);
                    executeTimingMs.composeAndEncodeVideo += Math.max(0, getNowMs() - composeEncodeStartedAtMs);
                    previousCompositionOutput = compositionOutput;
                }

                if (hasDecodedAudioSamples && encodeAudioData) {
                    const decodedAudioFrames = decodedChunkBatch.decodedAudioData
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
                        const audioEncodeStartedAtMs = getNowMs();
                        const audioKey = `${audioData.timestamp}:${audioData.numberOfFrames ?? 0}`;
                        if (encodedAudioTimestamps.has(audioKey)) {
                            continue;
                        }
                        encodedAudioTimestamps.add(audioKey);
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
                        executeTimingMs.encodeAudio += Math.max(0, getNowMs() - audioEncodeStartedAtMs);
                    }
                }

                closeDecodedBatchArtifacts(decodedChunkBatch);
                if (isLastChunk) {
                    break;
                }
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

            if (typeof this.flushVideoEncoder === "function") {
                console.log("[ExportExecutionStrategy] flushing video encoder");
                const flushVideoStartedAtMs = getNowMs();
                await this.flushVideoEncoder();
                executeTimingMs.flushEncoders += Math.max(0, getNowMs() - flushVideoStartedAtMs);
            }

            if (typeof this.flushAudioEncoder === "function") {
                console.log("[ExportExecutionStrategy] flushing audio encoder");
                const flushAudioStartedAtMs = getNowMs();
                await this.flushAudioEncoder();
                executeTimingMs.flushEncoders += Math.max(0, getNowMs() - flushAudioStartedAtMs);
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

                const adaptStartedAtMs = getNowMs();
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
                executeTimingMs.adaptOutputs += Math.max(0, getNowMs() - adaptStartedAtMs);
                console.log("[ExportExecutionStrategy] adapted encoded outputs", {
                    hasEncodedVideo,
                    hasEncodedAudio,
                    videoChunkCount: encodedVideoChunks.length,
                    audioChunkCount: encodedAudioChunks.length
                });

                const compileStartedAtMs = getNowMs();
                mp4Bytes = this.createMp4FromInputsFn(mp4BuildInput);
                executeTimingMs.compileMp4 += Math.max(0, getNowMs() - compileStartedAtMs);
                console.log("[ExportExecutionStrategy] MP4 compiled", {
                    byteLength: mp4Bytes?.length ?? null
                });
            }
            executeTimingMs.totalExecute = Math.max(0, getNowMs() - executeStartedAtMs);

        return {
            decodedContainerBackedFragmentBatch,
            composedFrames: shouldRetainComposedFrames ? composedFrames : [],
            encodedAccessUnits,
            mp4BuildInput,
            mp4Bytes,
            executeTimingMs
        };
    }
}
