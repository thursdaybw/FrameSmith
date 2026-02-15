/**
 * FrameSmith Browser App Driver
 *
 * Purpose:
 * - Wire UI events to timeline planning, decode, compose, encode, and export.
 *
 * Boundaries:
 * - This file is app orchestration glue, not core domain architecture.
 * - Timeline/compiler rules live in `src/` modules and docs in `docs/`.
 *
 * Source of truth:
 * - `docs/framesmith-architecture.md`
 * - `docs/Architecture.md`
 * - `docs/WebM.Demux.Architecture.md`
 * - `docs/CodingStyle.md`
 *
 * Rule:
 * - Keep this file operational and readable.
 * - Keep deep architecture narrative out of this file.
 */

import { Timeline } from "./src/timeline/Timeline.js";
import { Track } from "./src/timeline/Track.js";
import { Clip } from "./src/timeline/Clip.js";
import { ProceduralClip } from "./src/timeline/ProceduralClip.js";

import { resolveTextOverlayFragmentIntentAtTime } from "./src/timeline/procedural/resolvers/resolvers/textOverlayFragmentIntentResolver.js";
import { resolveImageOverlayFragmentIntentAtTime } from "./src/timeline/procedural/resolvers/resolvers/imageOverlayFragmentIntentResolver.js";

import { openContainerFromMp4 } from "./src/mux/native/demux/container/openContainerFromMp4.js";
import { openContainer } from "./src/mux/native/demux/container/openContainer.js";

// Only import this for current preview, which is a development pscyholgoy convenience, remove this when upgrading preview
// to future API
import { buildPrerenderPlanFromTimeline } from "./src/timeline/compileTimeline.js";

import { resolveProceduralFragmentsAtTimeFromPlan } from "./src/prerender/resolveProceduralFragmentsAtTimeFromPlan.js";
import { ExportExecutionStrategy } from "./src/prerender/strategies/ExportExecutionStrategy.js";
import { createContainerWebCodecsDecodePort } from "./src/prerender/decodePorts/createContainerWebCodecsDecodePort.js";
import { parseAudioSpecificConfigFromEsds } from "./src/mux/native/codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { Mp4BoxDemuxer } from "./src/demux/Mp4BoxDemuxer.js";
import { logEncodeDiagnostics } from "./src/app/debug/logEncodeDiagnostics.js";
import { EncodePipelineRun } from "./src/app/encode/EncodePipelineRun.js";
import { buildDisplayTransformFromTrackMatrix } from "./src/mux/native/demux/track/displayTransform.js";

function summarizeTrackViewKeys(trackView) {
    const summary = {
        sampleCount: 0,
        keyTrueCount: 0,
        keyFalseCount: 0,
        keyUnknownCount: 0
    };
    if (!trackView || typeof trackView.sampleCount !== "number") {
        return summary;
    }
    summary.sampleCount = trackView.sampleCount;
    if (typeof trackView.getSampleByIndex !== "function") {
        summary.keyUnknownCount = summary.sampleCount;
        return summary;
    }
    for (let index = 0; index < trackView.sampleCount; index += 1) {
        const sample = trackView.getSampleByIndex(index);
        if (sample && sample.isKeyframe === true) {
            summary.keyTrueCount += 1;
            continue;
        }
        if (sample && sample.isKeyframe === false) {
            summary.keyFalseCount += 1;
            continue;
        }
        summary.keyUnknownCount += 1;
    }
    return summary;
}

function summarizeTrackViewTiming(trackView) {
    const summary = {
        sampleCount: 0,
        firstPtsUs: null,
        lastPtsUs: null,
        spanUs: 0
    };
    if (!trackView || typeof trackView.sampleCount !== "number") {
        return summary;
    }
    summary.sampleCount = trackView.sampleCount;
    if (trackView.sampleCount === 0 || typeof trackView.getSampleByIndex !== "function") {
        return summary;
    }
    const first = trackView.getSampleByIndex(0);
    const last = trackView.getSampleByIndex(trackView.sampleCount - 1);
    const toUs = (pts) => {
        if (typeof pts !== "number") {
            return null;
        }
        if (typeof trackView.ptsToSeconds === "function") {
            const seconds = Number(trackView.ptsToSeconds(pts));
            if (Number.isFinite(seconds)) {
                return Math.round(seconds * 1_000_000);
            }
        }
        return pts;
    };

    summary.firstPtsUs = toUs(first?.pts);
    summary.lastPtsUs = toUs(last?.pts);
    if (summary.firstPtsUs !== null && summary.lastPtsUs !== null) {
        summary.spanUs = Math.max(0, summary.lastPtsUs - summary.firstPtsUs);
    }
    return summary;
}

function getRotationDegreesFromTrackView(trackView) {
    if (
        !trackView ||
        !trackView.containerMeta ||
        !trackView.containerMeta.displayTransform ||
        typeof trackView.containerMeta.displayTransform.rotationDegrees !== "number"
    ) {
        return null;
    }
    return trackView.containerMeta.displayTransform.rotationDegrees;
}

function buildNormalizationCompletePayload({
    normalized,
    prerenderPlan,
    normalizedVideoTrackView,
    normalizedAudioTrackView,
    sourceRotationDegrees
}) {
    return {
        normalizedContainer: "webm",
        normalizationCaptureMode: normalized.captureMode,
        normalizationRetried: normalized.normalizationRetried,
        normalizationRetryReason: normalized.retryReason,
        sourceRotationDegrees,
        normalizedRotationDegrees: getRotationDegreesFromTrackView(normalizedVideoTrackView),
        fragmentCount: prerenderPlan.fragments.length,
        normalizedVideoKeySummary: summarizeTrackViewKeys(normalizedVideoTrackView),
        normalizedVideoTiming: summarizeTrackViewTiming(normalizedVideoTrackView),
        normalizedAudioTiming: summarizeTrackViewTiming(normalizedAudioTrackView)
    };
}

function retimeVideoTrackViewToExportRange({
    trackView,
    exportRange
}) {
    if (!trackView || trackView.mediaType !== "video") {
        return trackView;
    }
    if (typeof trackView.sampleCount !== "number" || trackView.sampleCount <= 0) {
        return trackView;
    }
    if (typeof trackView.getSampleByIndex !== "function") {
        return trackView;
    }

    const startSeconds = Number(exportRange?.startSeconds);
    const endSeconds = Number(exportRange?.endSeconds);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
        return trackView;
    }

    const sampleCount = trackView.sampleCount;
    const durationUs = Math.max(1, Math.round((endSeconds - startSeconds) * 1_000_000));
    const baseSamples = [];
    for (let index = 0; index < sampleCount; index += 1) {
        const sample = trackView.getSampleByIndex(index);
        if (!sample) {
            continue;
        }
        baseSamples.push(sample);
    }
    if (baseSamples.length === 0) {
        return trackView;
    }

    const deterministicSamples = [];
    if (baseSamples.length === 1) {
        const onlySample = baseSamples[0];
        deterministicSamples.push({
            pts: 0,
            dts: 0,
            duration: durationUs,
            isKeyframe: onlySample.isKeyframe === true,
            data: onlySample.data
        });
    } else {
        const denominator = baseSamples.length - 1;
        for (let index = 0; index < baseSamples.length; index += 1) {
            const sample = baseSamples[index];
            let ptsUs = Math.round((index * durationUs) / denominator);
            if (index === 0) {
                ptsUs = 0;
            }
            let nextPtsUs = durationUs;
            if (index < baseSamples.length - 1) {
                nextPtsUs = Math.round(((index + 1) * durationUs) / denominator);
            }
            const frameDurationUs = Math.max(1, nextPtsUs - ptsUs);
            deterministicSamples.push({
                pts: ptsUs,
                dts: ptsUs,
                duration: frameDurationUs,
                isKeyframe: sample.isKeyframe === true,
                data: sample.data
            });
        }
    }

    let originalContainerMeta = {};
    if (trackView.containerMeta && typeof trackView.containerMeta === "object") {
        originalContainerMeta = trackView.containerMeta;
    }
    const containerMeta = {
        ...originalContainerMeta,
        trackTimescale: 1_000_000
    };

    return {
        mediaType: "video",
        codecConfig: trackView.codecConfig,
        containerMeta,
        sampleCount: deterministicSamples.length,
        ptsToSeconds(pts) {
            return pts / 1_000_000;
        },
        secondsToPts(seconds) {
            return Math.round(seconds * 1_000_000);
        },
        getSampleByIndex(index) {
            const sample = deterministicSamples[index];
            if (!sample) {
                return null;
            }
            return sample;
        },
        *iterateSamplesByPtsRange(startPts, endPts) {
            for (const sample of deterministicSamples) {
                if (sample.pts < startPts) {
                    continue;
                }
                if (sample.pts > endPts) {
                    continue;
                }
                yield sample;
            }
        }
    };
}

const CAPTION_FONT_FAMILY = "FrameSmithAntonSC";
const CAPTION_FONT_URL = "./assets/fonts/AntonSC-Regular.ttf";

async function ensureCaptionFontLoaded() {
    if (typeof document === "undefined" || !document.fonts) return false;

    try {
        const fontFace = new FontFace(
            CAPTION_FONT_FAMILY,
            `url(${CAPTION_FONT_URL}) format('truetype')`,
            { weight: "700", style: "normal" }
        );
        await fontFace.load();
        document.fonts.add(fontFace);
        await document.fonts.load(`700 70px "${CAPTION_FONT_FAMILY}"`);
        console.log("[TextOverlay] caption font loaded", {
            family: CAPTION_FONT_FAMILY,
            source: CAPTION_FONT_URL
        });
        return true;
    } catch (error) {
        console.warn("[TextOverlay] caption font failed to load; using fallback", {
            family: CAPTION_FONT_FAMILY,
            source: CAPTION_FONT_URL,
            error: error?.message ?? String(error)
        });
        return false;
    }
}

function readRuntimeConfig() {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedVideoDemuxer = searchParams.get("videoDemuxer");
    const videoDemuxer = requestedVideoDemuxer === "mp4box" ? "mp4box" : "native";
    const outputWidth = 720;
    const outputHeight = 1280;
    return {
        demux: {
            videoDemuxer
        },
        output: {
            width: outputWidth,
            height: outputHeight
        },
        debug: {
            enableEncodeDiagnostics: searchParams.get("encodeDiagnostics") !== "0"
        }
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    await ensureCaptionFontLoaded();
    const runtimeConfig = readRuntimeConfig();

    // -------------------------------------------------
    // Pre-render timing configuration
    // -------------------------------------------------
    const PRE_RENDER_FPS = 30;
    const PRE_RENDER_FRAME_DURATION_US = Math.floor(1_000_000 / PRE_RENDER_FPS);

    const previewBtn = document.getElementById("previewBtn");
    const encodeBtn = document.getElementById("encodeBtn");
    const exportBtn = document.getElementById("exportBtn");
    const videoFileInput = document.getElementById("videoFileInput");
    const videoSourceStatus = document.getElementById("videoSourceStatus");
    const encodeDiagnosticsPanel = document.getElementById("encodeDiagnosticsPanel");

    // Demo Orchestration Only:
    // This HTMLVideoElement exists solely to support preview playback.
    // It must not be considered a required dependency of FrameSmith.
    // Future entry points may have no DOM, no video element, and no container.
    const video = document.getElementById("v");
    const canvas = document.getElementById("c");
    const context = canvas.getContext("2d");

    let timeline = null;
    let currentVideoSourceObjectUrl = null;
    let audioDataFrames = [];
    let lastExportBlob = null;
    let lastExportUrl = null;
    let cachedSelectedVideo = null;

    const setVideoSourceStatus = (message, isError = false) => {
        if (!videoSourceStatus) return;
        videoSourceStatus.textContent = message;
        videoSourceStatus.style.color = isError ? "#b00020" : "";
    };

    const appendEncodeDiagnosticsPanelLine = (label, payload) => {
        if (!encodeDiagnosticsPanel) return;
        let payloadText = "";
        if (payload !== undefined) {
            try {
                payloadText = ` ${JSON.stringify(payload)}`;
            } catch {
                payloadText = ` ${String(payload)}`;
            }
        }
        const line = `${label}${payloadText}`;
        if (encodeDiagnosticsPanel.textContent.length > 0) {
            encodeDiagnosticsPanel.textContent += "\n";
        }
        encodeDiagnosticsPanel.textContent += line;
        encodeDiagnosticsPanel.scrollTop = encodeDiagnosticsPanel.scrollHeight;
    };

    const clearEncodeDiagnosticsPanel = () => {
        if (!encodeDiagnosticsPanel) return;
        encodeDiagnosticsPanel.textContent = "";
    };

    const dumpEncodeDiagnosticsPanelToConsole = () => {
        if (!encodeDiagnosticsPanel) return;
        const text = String(encodeDiagnosticsPanel.textContent || "").trim();
        if (text.length === 0) return;
        console.log("[Encode][DIAGNOSTICS_PANEL_DUMP_START]");
        console.log(text);
        console.log("[Encode][DIAGNOSTICS_PANEL_DUMP_END]");
    };

    const emitEncodeSignal = ({
        level = "log",
        label,
        payload
    }) => {
        if (level === "warn") {
            console.warn(label, payload);
        } else if (level === "error") {
            console.error(label, payload);
        } else {
            console.log(label, payload);
        }
        appendEncodeDiagnosticsPanelLine(label, payload);
    };

    const setWorkflowEnabled = (enabled) => {
        previewBtn.disabled = !enabled;
        encodeBtn.disabled = !enabled;
        if (!enabled) {
            exportBtn.disabled = true;
        }
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function readSelectedVideoBytesWithRetry(fileInput, setStatus) {
        const maxAttempts = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const file = fileInput?.files?.[0];
            if (!(file instanceof File)) {
                throw new Error("Selected source file is not available.");
            }
            if (!Number.isFinite(file.size) || file.size <= 0) {
                throw new Error("Selected file is empty.");
            }

            try {
                if (attempt > 1) {
                    setStatus(`Reading selected video (retry ${attempt}/${maxAttempts})...`);
                }
                const bytes = new Uint8Array(await file.arrayBuffer());
                if (bytes.length === 0) {
                    throw new Error("Selected file returned zero bytes.");
                }
                return { file, bytes };
            } catch (error) {
                lastError = error;
                console.warn("[VideoSource] read attempt failed", {
                    attempt,
                    maxAttempts,
                    fileName: file.name,
                    fileSize: file.size,
                    errorName: error?.name || "Error",
                    errorMessage: error?.message || String(error)
                });
                if (attempt < maxAttempts) {
                    await sleep(200 * attempt);
                }
            }
        }

        throw lastError || new Error("Failed to read selected file.");
    }

    async function initializeTimelineFromBytes(mp4Bytes) {
        if (!(mp4Bytes instanceof Uint8Array) || mp4Bytes.length === 0) {
            throw new Error("Provided in-memory MP4 bytes are empty.");
        }
        setWorkflowEnabled(false);
        setVideoSourceStatus("Loading video source...");
        try {
            timeline = await createTimeline({ mp4Bytes, runtimeConfig });
            setWorkflowEnabled(true);
            setVideoSourceStatus("Video ready");
        } catch (error) {
            timeline = null;
            setWorkflowEnabled(false);
            setVideoSourceStatus(
                `Video load failed: ${error?.message ?? String(error)}`,
                true
            );
            throw error;
        }
    }

    const timecodeFragmentIntentResolvers = {
        "text-overlay": resolveTextOverlayFragmentIntentAtTime,
        "image-overlay": resolveImageOverlayFragmentIntentAtTime
    };

    async function configureAudioDecoderForTrack({ audioDecoder, audioTrackView }) {
        const audioDecoderCodec = audioTrackView.codecConfig.codec === "mp4a"
            ? "mp4a.40.2"
            : audioTrackView.codecConfig.codec;

        const extractAudioSpecificConfigBytesFromEsds = (esds) => {
            if (!(esds instanceof Uint8Array)) return null;
            let offset = 0;
            while (offset < esds.length) {
                const tag = esds[offset++];
                let size = 0;
                let guard = 0;
                while (true) {
                    if (offset >= esds.length) return null;
                    const b = esds[offset++];
                    size = (size << 7) | (b & 0x7F);
                    if ((b & 0x80) === 0) break;
                    guard++;
                    if (guard > 4) return null;
                }
                if (tag === 0x05) {
                    if (offset + size > esds.length) return null;
                    return esds.slice(offset, offset + size);
                }
                offset += size;
            }
            return null;
        };

        const createAacLcAudioSpecificConfig = ({ sampleRate, channelCount }) => {
            const samplingFrequencies = [
                96000, 88200, 64000, 48000, 44100, 32000,
                24000, 22050, 16000, 12000, 11025, 8000, 7350
            ];
            const audioObjectType = 2; // AAC-LC
            const samplingFrequencyIndex = samplingFrequencies.indexOf(sampleRate);
            if (samplingFrequencyIndex === -1) return null;
            if (!Number.isInteger(channelCount) || channelCount <= 0 || channelCount > 7) return null;

            const byte0 = (audioObjectType << 3) | (samplingFrequencyIndex >> 1);
            const byte1 = ((samplingFrequencyIndex & 1) << 7) | (channelCount << 3);
            return new Uint8Array([byte0, byte1]);
        };

        const sourceEsds = audioTrackView.codecConfig.esds;
        const aacAsc = sourceEsds
            ? parseAudioSpecificConfigFromEsds({ esds: sourceEsds })
            : null;
        const audioDecoderCodecFromSource = audioTrackView.codecConfig.codec === "mp4a" && aacAsc?.audioObjectType
            ? `mp4a.40.${aacAsc.audioObjectType}`
            : audioDecoderCodec;
        const normalizedAudioSampleRate = (audioTrackView.codecConfig.sampleRate ?? 48_000) > 192_000
            ? ((audioTrackView.codecConfig.sampleRate ?? 48_000) >>> 16)
            : (audioTrackView.codecConfig.sampleRate ?? 48_000);

        let audioDecoderDescription = audioTrackView.codecConfig.codec === "mp4a"
            ? extractAudioSpecificConfigBytesFromEsds(sourceEsds)
            : (audioTrackView.codecConfig.dOps ?? audioTrackView.codecConfig.esds);
        const audioDecoderChannelCount = audioTrackView.codecConfig.channelCount ?? 2;
        const audioDecoderSampleRate = normalizedAudioSampleRate;

        if (!audioDecoderDescription && audioTrackView.codecConfig.codec === "mp4a") {
            audioDecoderDescription = createAacLcAudioSpecificConfig({
                sampleRate: audioDecoderSampleRate,
                channelCount: audioDecoderChannelCount
            });
        }

        const audioDecoderCandidates = [
            {
                codec: audioDecoderCodecFromSource,
                numberOfChannels: audioDecoderChannelCount,
                sampleRate: audioDecoderSampleRate,
                ...(audioDecoderDescription ? { description: audioDecoderDescription } : {})
            },
            {
                codec: audioDecoderCodecFromSource,
                numberOfChannels: audioDecoderChannelCount,
                sampleRate: audioDecoderSampleRate
            },
            {
                codec: "mp4a.40.2",
                numberOfChannels: audioDecoderChannelCount,
                sampleRate: audioDecoderSampleRate,
                ...(audioDecoderDescription ? { description: audioDecoderDescription } : {})
            },
            {
                codec: "mp4a.40.2",
                numberOfChannels: audioDecoderChannelCount,
                sampleRate: audioDecoderSampleRate
            }
        ];

        const preflightAudioDecoderConfigs = async () => {
            const rows = [];
            for (const candidate of audioDecoderCandidates) {
                const row = {
                    codec: candidate.codec,
                    sampleRate: candidate.sampleRate,
                    numberOfChannels: candidate.numberOfChannels,
                    hasDescription: !!candidate.description
                };

                if (typeof AudioDecoder.isConfigSupported !== "function") {
                    row.isConfigSupported = "not-available";
                    rows.push(row);
                    continue;
                }

                try {
                    const support = await AudioDecoder.isConfigSupported(candidate);
                    row.isConfigSupported = support.supported ? "yes" : "no";
                    if (!support.supported) {
                        row.reason = "reported unsupported";
                    }
                } catch (error) {
                    row.isConfigSupported = "error";
                    row.reason = error?.message ?? String(error);
                }

                rows.push(row);
            }

            // Keep this preflight silent unless needed again.
        };

        await preflightAudioDecoderConfigs();

        for (const candidate of audioDecoderCandidates) {
            try {
                if (typeof AudioDecoder.isConfigSupported === "function") {
                    const support = await AudioDecoder.isConfigSupported(candidate);
                    if (!support.supported) {
                        continue;
                    }
                }
                audioDecoder.configure(candidate);
                return candidate;
            } catch {
                // Try next candidate.
            }
        }

        throw new Error("AudioDecoder could not be configured for source audio track.");
    }

    async function configureVideoEncoderForTrack({ videoEncoder, exportFps, outputWidth, outputHeight }) {
        const toEven = (value) => {
            const rounded = Math.max(2, Math.round(value));
            return rounded % 2 === 0 ? rounded : rounded - 1;
        };
        const baseResolution = {
            width: toEven(outputWidth),
            height: toEven(outputHeight)
        };
        const resolutionLadder = [baseResolution];

        const dedupedResolutions = [];
        const seenResolutionKeys = new Set();
        for (const resolution of resolutionLadder) {
            const key = `${resolution.width}x${resolution.height}`;
            if (seenResolutionKeys.has(key)) continue;
            seenResolutionKeys.add(key);
            dedupedResolutions.push(resolution);
        }

        const estimateBitrate = ({ width, height }) => {
            const pixels = width * height;
            const targetBitsPerPixelPerFrame = 0.12;
            const estimated = Math.round(pixels * exportFps * targetBitsPerPixelPerFrame);
            return Math.max(1_200_000, Math.min(8_000_000, estimated));
        };

        const videoEncoderConfigs = [];
        for (const resolution of dedupedResolutions) {
            const bitrate = estimateBitrate(resolution);
            // MVP constraint:
            // Keep timeline export on the same simple WebCodecs shape used by
            // NativeMuxer's semantic E2E test. Prefer realtime configs and
            // avoid quality-oriented reorder paths.
            videoEncoderConfigs.push(
                {
                    codec: "avc1.4D401F",
                    width: resolution.width,
                    height: resolution.height,
                    bitrate,
                    framerate: exportFps,
                    latencyMode: "realtime",
                    avc: { format: "avc" }
                },
                {
                    codec: "avc1.42001E",
                    width: resolution.width,
                    height: resolution.height,
                    bitrate,
                    framerate: exportFps,
                    latencyMode: "realtime",
                    avc: { format: "avc" }
                }
            );
        }

        for (const candidate of videoEncoderConfigs) {
            try {
                if (typeof VideoEncoder.isConfigSupported === "function") {
                    const support = await VideoEncoder.isConfigSupported(candidate);
                    if (!support.supported) {
                        continue;
                    }
                }
                videoEncoder.configure(candidate);
                return candidate;
            } catch {
                // Try next candidate.
            }
        }

        throw new Error("VideoEncoder could not be configured for export.");
    }

    async function configureVideoDecoderForTrack({
        videoDecoder,
        videoTrackView,
        accelerationOrderOverride
    }) {
        const codecShape = deriveDecodeVideoCodecAndDescription(videoTrackView);
        const sourceVideoCodec = codecShape.sourceVideoCodec;
        const decodeVideoCodec = codecShape.decodeVideoCodec;
        const codecDescription = codecShape.codecDescription;

        let accelerationOrder = ["prefer-hardware", "no-preference", "prefer-software"];
        if (Array.isArray(accelerationOrderOverride) && accelerationOrderOverride.length > 0) {
            accelerationOrder = [];
            for (const mode of accelerationOrderOverride) {
                accelerationOrder.push(mode);
            }
        }

        const supportChecks = [];
        const configureFailures = [];

        for (const hardwareAcceleration of accelerationOrder) {
            const candidate = {
                codec: decodeVideoCodec,
                hardwareAcceleration
            };
            if (codecDescription) {
                candidate.description = codecDescription;
            }

            if (typeof VideoDecoder.isConfigSupported === "function") {
                try {
                    const support = await VideoDecoder.isConfigSupported(candidate);
                    supportChecks.push({
                        hardwareAcceleration,
                        supported: Boolean(support && support.supported)
                    });
                    if (!support || !support.supported) {
                        continue;
                    }
                } catch (error) {
                    supportChecks.push({
                        hardwareAcceleration,
                        supported: false,
                        reason: error?.message ?? String(error)
                    });
                    continue;
                }
            }

            try {
                videoDecoder.configure(candidate);
                return candidate;
            } catch (error) {
                configureFailures.push({
                    hardwareAcceleration,
                    reason: error?.message ?? String(error)
                });
            }
        }

        throw new Error(
            `VideoDecoder could not be configured (codec=${decodeVideoCodec}, sourceCodec=${sourceVideoCodec}). ` +
            `supportChecks=${JSON.stringify(supportChecks)} configureFailures=${JSON.stringify(configureFailures)}`
        );
    }

    function waitForVideoEvent(videoElement, eventName, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            let timeoutId = null;

            const cleanup = () => {
                videoElement.removeEventListener(eventName, onEvent);
                videoElement.removeEventListener("error", onError);
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }
            };

            const onEvent = () => {
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                const mediaError = videoElement.error;
                const details = mediaError
                    ? `code=${mediaError.code}`
                    : "unknown media error";
                reject(new Error(`video element ${eventName} failed (${details})`));
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`video element ${eventName} timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            videoElement.addEventListener(eventName, onEvent, { once: true });
            videoElement.addEventListener("error", onError, { once: true });
        });
    }

    function resolveEncodeDecodePathMode({
        didNormalizePredecode
    }) {
        if (didNormalizePredecode === true) {
            return "normalized-webm-predecode";
        }
        return "direct-webcodecs";
    }

    function resolveNormalizationSourceUrl({
        currentVideoSourceUrl
    }) {
        if (typeof currentVideoSourceUrl === "string" && currentVideoSourceUrl.length > 0) {
            return currentVideoSourceUrl;
        }
        return "";
    }

    function selectWebmNormalizationMimeType() {
        if (typeof MediaRecorder !== "function") {
            return "";
        }

        const candidates = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm"
        ];
        if (typeof MediaRecorder.isTypeSupported !== "function") {
            return candidates[0];
        }

        for (const candidate of candidates) {
            if (MediaRecorder.isTypeSupported(candidate)) {
                return candidate;
            }
        }
        return "";
    }

    function collectProceduralItemsByKind({
        timeline,
        kind
    }) {
        const collectedItems = [];
        if (!timeline || !Array.isArray(timeline.tracks)) {
            return collectedItems;
        }

        for (const track of timeline.tracks) {
            if (!track || !Array.isArray(track.clips)) {
                continue;
            }
            for (const clip of track.clips) {
                if (!clip || clip.kind !== kind || !Array.isArray(clip.items)) {
                    continue;
                }
                for (const item of clip.items) {
                    collectedItems.push(item);
                }
            }
        }

        return collectedItems;
    }

    function deriveDecodeVideoCodecAndDescription(videoTrackView) {
        const sourceVideoCodec = videoTrackView.codecConfig.codec;
        const avcC = videoTrackView.codecConfig.avcC;
        const hvcC = videoTrackView.codecConfig.hvcC;

        let decodeVideoCodec = sourceVideoCodec;
        if (sourceVideoCodec === "avc1" && avcC instanceof Uint8Array && avcC.length >= 4) {
            decodeVideoCodec =
                `avc1.${avcC[1].toString(16).padStart(2, "0").toUpperCase()}` +
                `${avcC[2].toString(16).padStart(2, "0").toUpperCase()}` +
                `${avcC[3].toString(16).padStart(2, "0").toUpperCase()}`;
        }

        let codecDescription = null;
        if (avcC instanceof Uint8Array) {
            codecDescription = avcC;
        } else if (hvcC instanceof Uint8Array) {
            codecDescription = hvcC;
        }

        return {
            sourceVideoCodec,
            decodeVideoCodec,
            codecDescription
        };
    }

    async function probeVideoDecoderSupportForTrack({
        videoTrackView,
        accelerationOrder
    }) {
        if (typeof VideoDecoder !== "function") {
            return {
                supported: false,
                checks: [],
                reason: "VideoDecoder is unavailable"
            };
        }

        if (typeof VideoDecoder.isConfigSupported !== "function") {
            return {
                supported: true,
                checks: [],
                reason: "VideoDecoder.isConfigSupported unavailable"
            };
        }

        const codecShape = deriveDecodeVideoCodecAndDescription(videoTrackView);
        const checks = [];
        for (const hardwareAcceleration of accelerationOrder) {
            const candidate = {
                codec: codecShape.decodeVideoCodec,
                hardwareAcceleration
            };
            if (codecShape.codecDescription) {
                candidate.description = codecShape.codecDescription;
            }

            try {
                const support = await VideoDecoder.isConfigSupported(candidate);
                const supported = Boolean(support && support.supported);
                checks.push({ hardwareAcceleration, supported });
                if (supported) {
                    return {
                        supported: true,
                        checks,
                        reason: "supported"
                    };
                }
            } catch (error) {
                checks.push({
                    hardwareAcceleration,
                    supported: false,
                    reason: error?.message ?? String(error)
                });
            }
        }

        return {
            supported: false,
            checks,
            reason: "all decoder support probes reported unsupported"
        };
    }

async function normalizeSourceRangeToWebmBytes({
    sourceUrl,
    exportRange
}) {
        if (typeof document === "undefined") {
            throw new Error("source normalization requires document");
        }
        if (typeof MediaRecorder !== "function") {
            throw new Error("source normalization requires MediaRecorder");
        }
        if (typeof sourceUrl !== "string" || sourceUrl.length === 0) {
            throw new Error("source normalization requires a source URL");
        }

        const videoElement = document.createElement("video");
        videoElement.src = sourceUrl;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.preload = "auto";

        videoElement.style.position = "fixed";
        videoElement.style.right = "8px";
        videoElement.style.bottom = "8px";
        videoElement.style.width = "120px";
        videoElement.style.height = "auto";
        videoElement.style.opacity = "0.01";
        videoElement.style.pointerEvents = "none";
        videoElement.controls = false;
        document.body.appendChild(videoElement);

        let canvasElement = null;
        let canvasContext = null;
        let stream = null;
        let capturedVideoTrack = null;
        let mediaRecorder = null;
        const captureMode = "canvas-frame-drive";
        try {
            await waitForVideoEvent(videoElement, "loadedmetadata");

            const startSecondsRequested = Number(exportRange?.startSeconds);
            const endSecondsRequested = Number(exportRange?.endSeconds);
            if (!Number.isFinite(startSecondsRequested) || !Number.isFinite(endSecondsRequested)) {
                throw new Error("source normalization requires numeric exportRange");
            }

            const sourceDurationSeconds = Number(videoElement.duration);
            if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
                throw new Error("source normalization: source duration unavailable");
            }

            const startSeconds = Math.max(0, Math.min(startSecondsRequested, sourceDurationSeconds));
            const endSeconds = Math.max(
                startSeconds,
                Math.min(endSecondsRequested, sourceDurationSeconds)
            );
            if (endSeconds <= startSeconds) {
                throw new Error("source normalization: invalid range");
            }

            const canvasWidth = Math.max(1, Number(videoElement.videoWidth) || 1);
            const canvasHeight = Math.max(1, Number(videoElement.videoHeight) || 1);
            canvasElement = document.createElement("canvas");
            canvasElement.width = canvasWidth;
            canvasElement.height = canvasHeight;
            canvasElement.style.position = "fixed";
            canvasElement.style.right = "8px";
            canvasElement.style.bottom = "8px";
            canvasElement.style.width = "120px";
            canvasElement.style.height = "auto";
            canvasElement.style.opacity = "0.01";
            canvasElement.style.pointerEvents = "none";
            document.body.appendChild(canvasElement);

            canvasContext = canvasElement.getContext("2d");
            if (!canvasContext) {
                throw new Error("source normalization: unable to create canvas context");
            }

            if (typeof canvasElement.captureStream !== "function") {
                throw new Error("source normalization: canvas captureStream unavailable");
            }
            stream = canvasElement.captureStream(0);
            capturedVideoTrack = stream.getVideoTracks()[0] || null;
            if (!capturedVideoTrack || typeof capturedVideoTrack.requestFrame !== "function") {
                throw new Error("source normalization: canvas capture track requestFrame unavailable");
            }

            const mimeType = selectWebmNormalizationMimeType();
            if (typeof mimeType !== "string" || mimeType.length === 0) {
                throw new Error("source normalization: no supported WebM MediaRecorder mimeType");
            }
            const chunks = [];
            mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 1_400_000,
                audioBitsPerSecond: 128_000
            });
            mediaRecorder.addEventListener("dataavailable", (event) => {
                if (event && event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            });

            const stopped = new Promise((resolve, reject) => {
                mediaRecorder.addEventListener("stop", () => resolve(), { once: true });
                mediaRecorder.addEventListener("error", () => {
                    const error = mediaRecorder.error;
                    let reason = "unknown recorder error";
                    if (error && typeof error.message === "string") {
                        reason = error.message;
                    }
                    reject(new Error(`source normalization recorder failed: ${reason}`));
                }, { once: true });
            });

            mediaRecorder.start();

            const frameRate = PRE_RENDER_FPS;
            const durationSeconds = endSeconds - startSeconds;
            const frameCount = Math.max(1, Math.floor(durationSeconds * frameRate) + 1);
            const seekTolerance = 0.0005;

            const seekAndCaptureFrame = async (targetTimeSeconds) => {
                const currentTime = Number(videoElement.currentTime);
                if (!Number.isFinite(currentTime) || Math.abs(currentTime - targetTimeSeconds) > seekTolerance) {
                    videoElement.currentTime = targetTimeSeconds;
                    await waitForVideoEvent(videoElement, "seeked");
                }
                if (videoElement.readyState < 2) {
                    await waitForVideoEvent(videoElement, "canplay");
                }
                canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
                canvasContext.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
                capturedVideoTrack.requestFrame();
                await new Promise((resolve) => setTimeout(resolve, 0));
            };

            for (let index = 0; index < frameCount; index += 1) {
                const offsetSeconds = index / frameRate;
                const targetTimeSeconds = Math.min(endSeconds, startSeconds + offsetSeconds);
                await seekAndCaptureFrame(targetTimeSeconds);
            }

            const finalFrameTimeSeconds = Math.min(endSeconds, startSeconds + ((frameCount - 1) / frameRate));
            if ((endSeconds - finalFrameTimeSeconds) > (0.5 / frameRate)) {
                await seekAndCaptureFrame(endSeconds);
            }

            videoElement.pause();
            if (mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
            await stopped;

            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size <= 0) {
                throw new Error("source normalization recorder produced empty WebM");
            }
            const arrayBuffer = await blob.arrayBuffer();
            return {
                bytes: new Uint8Array(arrayBuffer),
                captureMode
            };
        } finally {
            try {
                videoElement.pause();
            } catch {
                // no-op
            }
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                try {
                    mediaRecorder.stop();
                } catch {
                    // no-op
                }
            }
            if (stream) {
                const tracks = stream.getTracks();
                for (const track of tracks) {
                    try {
                        track.stop();
                    } catch {
                        // no-op
                    }
                }
            }
            if (stream) {
                const tracks = stream.getTracks();
                for (const track of tracks) {
                    try {
                        track.stop();
                    } catch {
                        // no-op
                    }
                }
            }
            if (videoElement.parentNode) {
                videoElement.parentNode.removeChild(videoElement);
            }
            if (canvasElement && canvasElement.parentNode) {
                canvasElement.parentNode.removeChild(canvasElement);
            }
        }
    }

async function normalizeUnsupportedSourceToWorkingSet({
    timeline,
    sourceUrl,
    exportRange,
    originalAudioTrackView
}) {
        const normalizationResult = await normalizeSourceRangeToWebmBytes({
            sourceUrl,
            exportRange
        });
        const normalizedWebmBytes = normalizationResult.bytes;
        const normalizedContainer = await openContainer({
            containerType: "webm",
            bytes: normalizedWebmBytes
        });
        const normalizedTrackViews = normalizedContainer.createTrackViews();
        const normalizedVideoTrackViews = normalizedTrackViews.filter(
            (trackView) => trackView && trackView.mediaType === "video"
        );
        const retimedNormalizedVideoTrackViews = normalizedVideoTrackViews.map((trackView) =>
            retimeVideoTrackViewToExportRange({
                trackView,
                exportRange
            })
        );

        for (const trackView of retimedNormalizedVideoTrackViews) {
            if (!trackView.containerMeta || typeof trackView.containerMeta !== "object") {
                trackView.containerMeta = {};
            }
            // Normalization capture records already-rendered pixels from a media element/canvas.
            // Those pixels are display-oriented, so source container rotation must not be re-applied.
            trackView.containerMeta.displayTransform = {
                rotationDegrees: 0
            };
        }

        const mergedTrackViews = [];
        for (const videoTrackView of retimedNormalizedVideoTrackViews) {
            mergedTrackViews.push(videoTrackView);
        }
        if (originalAudioTrackView && originalAudioTrackView.mediaType === "audio") {
            mergedTrackViews.push(originalAudioTrackView);
        }
        if (mergedTrackViews.length === 0) {
            throw new Error("source normalization did not produce usable track views");
        }

        const textOverlayItems = collectProceduralItemsByKind({
            timeline,
            kind: "text-overlay"
        });
        const imageOverlayItems = collectProceduralItemsByKind({
            timeline,
            kind: "image-overlay"
        });

        const normalizedTimeline = createTimelineFromPreparedAssets({
            trackViews: mergedTrackViews,
            textOverlayItems,
            imageOverlayItems
        });
        const normalizedSourceBlob = new Blob([normalizedWebmBytes], { type: "video/webm" });
        const normalizedSourceUrl = URL.createObjectURL(normalizedSourceBlob);
        return {
            timeline: normalizedTimeline,
            sourceUrl: normalizedSourceUrl,
            captureMode: normalizationResult.captureMode,
            normalizationRetried: false,
            retryReason: null
        };
    }

    function createSharedRenderExecutionContext({
        decodePort,
        timecodeFragmentIntentResolvers,
        timeline,
        exportFps,
        configuredVideoEncoderConfig,
        videoTrackView
    }) {
        let videoRotationDegrees = 0;
        if (
            videoTrackView &&
            videoTrackView.containerMeta &&
            videoTrackView.containerMeta.displayTransform &&
            typeof videoTrackView.containerMeta.displayTransform.rotationDegrees === "number"
        ) {
            videoRotationDegrees = videoTrackView.containerMeta.displayTransform.rotationDegrees;
        }

        return {
            decodePort,
            timecodeFragmentIntentResolvers,
            activeLayers: timeline.tracks.map((track, index) => ({
                track,
                zIndex: index,
                muted: false
            })),
            options: {
                audioStrategy: "mixToSingleTrack",
                frameDurationSeconds: 1 / exportFps,
                trackTimescale: 1_000_000,
                outputSpec: {
                    width: configuredVideoEncoderConfig.width,
                    height: configuredVideoEncoderConfig.height,
                    videoRotationDegrees,
                    fps: exportFps,
                    sampleRate: 48_000,
                    channels: 2
                },
                decodeChunkSeconds: null,
                background: { r: 0, g: 0, b: 0, a: 1 }
            }
        };
    }

    function createExportExecutionContext({
        sharedContext,
        videoEncoder,
        audioEncoder,
        videoEncodedChunks,
        audioEncodedChunks,
        getVideoDecoderConfig,
        getAudioDecoderConfig
    }) {
        return {
            ...sharedContext,
            encodeVideoFrame({ frame, timeSeconds }) {
                // MVP constraint:
                // Force all-intra output to stay on the NativeMuxer happy path
                // while CTTS/STSS policy work is still pending.
                videoEncoder.encode(frame, { keyFrame: true });
                if (typeof frame.close === "function") {
                    frame.close();
                }
                return {
                    accessUnit: {
                        codecDomain: "video",
                        pts: Math.round(timeSeconds * 1_000_000),
                        data: new Uint8Array(0)
                    }
                };
            },
            encodeAudioData({ audioData, timeSeconds }) {
                audioEncoder.encode(audioData);
                if (typeof audioData.close === "function") {
                    audioData.close();
                }
                return {
                    accessUnit: {
                        codecDomain: "audio",
                        pts: Math.round(timeSeconds * 1_000_000),
                        data: new Uint8Array(0)
                    }
                };
            },
            flushVideoEncoder: async () => {
                await videoEncoder.flush();
            },
            flushAudioEncoder: async () => {
                await audioEncoder.flush();
            },
            getVideoWebCodecsOutput: () => ({
                encodedChunks: videoEncodedChunks,
                decoderConfig: getVideoDecoderConfig()
            }),
            getAudioWebCodecsOutput: () => ({
                encodedChunks: audioEncodedChunks,
                decoderConfig: getAudioDecoderConfig()
            })
        };
    }

    function deriveExportRangeFromTimeline(timeline) {
        let exportEndSeconds = 0;
        let mediaClipEndSeconds = 0;
        let hasMediaClipBound = false;

        if (Array.isArray(timeline.tracks)) {
            for (const track of timeline.tracks) {
                if (!track || !Array.isArray(track.clips)) {
                    continue;
                }
                for (const clip of track.clips) {
                    let clipEndSeconds = Number(clip?.endSeconds);
                    if (!Number.isFinite(clipEndSeconds)) {
                        const clipEndPts = Number(clip?.endPts);
                        const clipTrackView = clip?.trackView;
                        if (
                            Number.isFinite(clipEndPts) &&
                            clipTrackView &&
                            typeof clipTrackView.ptsToSeconds === "function"
                        ) {
                            clipEndSeconds = Number(clipTrackView.ptsToSeconds(clipEndPts));
                        }
                    }
                    if (!Number.isFinite(clipEndSeconds)) {
                        continue;
                    }

                    const trackView = clip?.trackView;
                    const mediaType = trackView?.mediaType;
                    const isContainerMediaClip =
                        (mediaType === "video" || mediaType === "audio") &&
                        typeof clip?.iterateAccessUnits === "function";
                    if (isContainerMediaClip) {
                        hasMediaClipBound = true;
                        if (clipEndSeconds > mediaClipEndSeconds) {
                            mediaClipEndSeconds = clipEndSeconds;
                        }
                    }

                    if (clipEndSeconds > exportEndSeconds) {
                        exportEndSeconds = clipEndSeconds;
                    }
                }
            }
        }

        if (hasMediaClipBound) {
            exportEndSeconds = mediaClipEndSeconds;
        }
        if (!(exportEndSeconds > 0)) {
            const timelineDuration = Number(timeline.duration);
            if (Number.isFinite(timelineDuration) && timelineDuration > 0) {
                exportEndSeconds = timelineDuration;
            }
        }
        if (!(exportEndSeconds > 0)) {
            throw new Error("Unable to derive export range from timeline.");
        }

        return {
            startSeconds: 0,
            endSeconds: exportEndSeconds
        };
    }

    function selectContainerTrackViewsFromTimeline(executionTimeline) {
        const trackViews = executionTimeline.tracks
            .flatMap(track => track.clips)
            .map(clip => clip.trackView);

        const videoTrackView = trackViews.find(
            (view) => view && view.mediaType === "video" && view.codecConfig
        );
        const audioTrackView = trackViews.find(
            (view) => view && view.mediaType === "audio" && view.codecConfig
        );

        if (!videoTrackView) {
            throw new Error("No container-backed video asset found on timeline.");
        }
        if (!audioTrackView) {
            throw new Error("No container-backed audio asset found on timeline.");
        }

        return {
            videoTrackView,
            audioTrackView
        };
    }

    function buildWrappedAudioDecoderForTrack(audioTrackView) {
        const decodedAudioData = [];
        let audioDecoderError = null;
        const audioDecoder = new AudioDecoder({
            output(audioData) {
                decodedAudioData.push(audioData);
            },
            error(error) {
                console.error("AudioDecoder error", error);
                audioDecoderError = error;
            }
        });

        const wrappedAudioDecoder = {
            decode(chunk) {
                if (audioDecoderError) {
                    throw Object.assign(
                        new Error("audioDecoder.decode called after decoder failure"),
                        { cause: audioDecoderError }
                    );
                }
                audioDecoder.decode(chunk);
            },
            async flush() {
                if (audioDecoderError) {
                    throw Object.assign(
                        new Error("audioDecoder.flush called after decoder failure"),
                        { cause: audioDecoderError }
                    );
                }
                await audioDecoder.flush();
            },
            getDecodedOutputs() {
                return decodedAudioData;
            },
            getLastError() {
                return audioDecoderError;
            },
            get decodeQueueSize() {
                return audioDecoder.decodeQueueSize;
            },
            close() {
                audioDecoder.close();
            }
        };

        return {
            audioDecoder,
            wrappedAudioDecoder
        };
    }

    async function createDecodePortForTrack({
        videoTrackView,
        wrappedAudioDecoder,
        didNormalizePredecode,
        onSoftwareFallback
    }) {
        const createWrappedVideoDecoder = async ({ accelerationOrder }) => {
            if (typeof VideoDecoder !== "function") {
                return {
                    wrappedVideoDecoder: null,
                    setupError: new Error("VideoDecoder is not available in this browser.")
                };
            }

            const localDecodedVideoFrames = [];
            let localVideoDecoderError = null;
            const videoDecoder = new VideoDecoder({
                output(frame) {
                    localDecodedVideoFrames.push(frame);
                },
                error(error) {
                    console.error("VideoDecoder error", error);
                    localVideoDecoderError = error;
                }
            });

            try {
                await configureVideoDecoderForTrack({
                    videoDecoder,
                    videoTrackView,
                    accelerationOrderOverride: accelerationOrder
                });
            } catch (error) {
                return {
                    wrappedVideoDecoder: null,
                    setupError: error
                };
            }

            return {
                wrappedVideoDecoder: {
                    decode(chunk) {
                        if (localVideoDecoderError) {
                            throw Object.assign(
                                new Error("videoDecoder.decode called after decoder failure"),
                                { cause: localVideoDecoderError }
                            );
                        }
                        videoDecoder.decode(chunk);
                    },
                    async flush() {
                        if (localVideoDecoderError) {
                            throw Object.assign(
                                new Error("videoDecoder.flush called after decoder failure"),
                                { cause: localVideoDecoderError }
                            );
                        }
                        await videoDecoder.flush();
                    },
                    getDecodedOutputs() {
                        return localDecodedVideoFrames;
                    },
                    getLastError() {
                        return localVideoDecoderError;
                    },
                    get decodeQueueSize() {
                        return videoDecoder.decodeQueueSize;
                    },
                    close() {
                        videoDecoder.close();
                    }
                },
                setupError: null
            };
        };

        let primaryVideoDecoderResult;
        let softwareVideoDecoderResult = {
            wrappedVideoDecoder: null,
            setupError: null
        };
        if (didNormalizePredecode) {
            primaryVideoDecoderResult = await createWrappedVideoDecoder({
                accelerationOrder: ["prefer-software", "no-preference", "prefer-hardware"]
            });
        } else {
            primaryVideoDecoderResult = await createWrappedVideoDecoder({
                accelerationOrder: ["prefer-hardware", "no-preference", "prefer-software"]
            });
            softwareVideoDecoderResult = await createWrappedVideoDecoder({
                accelerationOrder: ["prefer-software", "no-preference", "prefer-hardware"]
            });
        }

        let primaryWebCodecsDecodePort = null;
        let softwareWebCodecsDecodePort = null;
        if (primaryVideoDecoderResult.wrappedVideoDecoder) {
            primaryWebCodecsDecodePort = createContainerWebCodecsDecodePort({
                videoDecoder: primaryVideoDecoderResult.wrappedVideoDecoder,
                audioDecoder: wrappedAudioDecoder
            });
        }
        if (softwareVideoDecoderResult.wrappedVideoDecoder) {
            softwareWebCodecsDecodePort = createContainerWebCodecsDecodePort({
                videoDecoder: softwareVideoDecoderResult.wrappedVideoDecoder,
                audioDecoder: wrappedAudioDecoder
            });
        }

        if (primaryWebCodecsDecodePort) {
            if (softwareWebCodecsDecodePort) {
                let softwareFallbackActive = false;
                return {
                    decodePort: {
                    async decodeRange({ plan, exportRange: range }) {
                        if (softwareFallbackActive) {
                            return softwareWebCodecsDecodePort.decodeRange({
                                plan,
                                exportRange: range
                            });
                        }
                        try {
                            return await primaryWebCodecsDecodePort.decodeRange({
                                plan,
                                exportRange: range
                            });
                        } catch (error) {
                            softwareFallbackActive = true;
                            onSoftwareFallback({
                                error,
                                range
                            });
                            return softwareWebCodecsDecodePort.decodeRange({
                                plan,
                                exportRange: range
                            });
                        }
                    }
                    },
                    releaseDecoders() {
                        primaryVideoDecoderResult.wrappedVideoDecoder.close();
                        softwareVideoDecoderResult.wrappedVideoDecoder.close();
                    }
                };
            }
            return {
                decodePort: primaryWebCodecsDecodePort,
                releaseDecoders() {
                    primaryVideoDecoderResult.wrappedVideoDecoder.close();
                }
            };
        }
        if (softwareWebCodecsDecodePort) {
            return {
                decodePort: softwareWebCodecsDecodePort,
                releaseDecoders() {
                    softwareVideoDecoderResult.wrappedVideoDecoder.close();
                }
            };
        }
        if (primaryVideoDecoderResult.setupError) {
            throw primaryVideoDecoderResult.setupError;
        }
        if (softwareVideoDecoderResult.setupError) {
            throw softwareVideoDecoderResult.setupError;
        }
        throw new Error("Unable to configure any video decode strategy.");
    }

    function finalizeEncodeOutput({
        result,
        tStart,
        videoEncodedChunks,
        audioEncodedChunks,
        didNormalizePredecode,
        didRuntimeSoftwareFallback,
        encodeStartedAt
    }) {
        if (!(result.mp4Bytes instanceof Uint8Array)) {
            throw new Error("Export did not produce MP4 bytes");
        }

        const mp4Blob = new Blob([result.mp4Bytes], { type: "video/mp4" });
        lastExportBlob = mp4Blob;
        window.__lastBlob = mp4Blob;
        window.__lastMp4Bytes = result.mp4Bytes;
        window.__lastMp4BuildInput = result.mp4BuildInput;

        if (lastExportUrl) {
            URL.revokeObjectURL(lastExportUrl);
        }
        lastExportUrl = URL.createObjectURL(mp4Blob);

        video.src = lastExportUrl;
        video.style.display = "block";
        video.controls = true;
        exportBtn.disabled = false;

        const decodePathMode = resolveEncodeDecodePathMode({
            didNormalizePredecode
        });
        emitEncodeSignal({
            label: "[Encode][DECODE_PATH]",
            payload: {
                mode: decodePathMode,
                normalizedPredecode: didNormalizePredecode,
                runtimeSoftwareFallback: didRuntimeSoftwareFallback
            }
        });
        emitEncodeSignal({
            label: "[Encode][SUMMARY]",
            payload: {
                ok: true,
                failedStage: null,
                elapsedMs: Math.round(performance.now() - encodeStartedAt),
                decodePathMode
            }
        });
    }

    /**
     * Try to start a new encode run.
     *
     * Returns false if an encode is already running.
     */
    function tryStartEncodeRun() {
        if (isEncodeInProgress) {
            console.warn("[Encode] ignored duplicate click while encode is in progress");
            return false;
        }
        isEncodeInProgress = true;
        return true;
    }

    /**
     * Validate basic prerequisites before any heavy encode work starts.
     */
    function validateEncodePrerequisites(timeline) {
        if (!timeline) {
            throw new Error("Timeline not ready. Load a video source first.");
        }
        if (typeof VideoEncoder !== "function" || typeof AudioEncoder !== "function") {
            throw new Error("WebCodecs VideoEncoder/AudioEncoder is not available in this browser.");
        }
        if (typeof AudioDecoder !== "function") {
            throw new Error("WebCodecs AudioDecoder is not available in this browser.");
        }
    }

    /**
     * Build the export range and prerender plan from the current timeline.
     */
    function buildEncodePlanContext(timeline) {
        const exportFps = PRE_RENDER_FPS;
        const exportRange = deriveExportRangeFromTimeline(timeline);
        let executionTimeline = timeline;
        let prerenderPlan = buildPrerenderPlanFromTimeline({ timeline: executionTimeline });
        return {
            exportFps,
            exportRange,
            executionTimeline,
            prerenderPlan
        };
    }

    /**
     * Select container-backed track views and read source rotation once.
     */
    function selectExecutionTrackViewsWithRotation(executionTimeline) {
        const selected = selectContainerTrackViewsFromTimeline(executionTimeline);
        const sourceRotationDegrees = getRotationDegreesFromTrackView(selected.videoTrackView);
        return {
            videoTrackView: selected.videoTrackView,
            audioTrackView: selected.audioTrackView,
            sourceRotationDegrees
        };
    }

    /**
     * Normalize source media only when decoder support says the source codec is unsupported.
     */
    async function maybeNormalizeExecutionTimelineForUnsupportedDecoder({
        executionTimeline,
        prerenderPlan,
        exportRange,
        videoTrackView,
        audioTrackView,
        sourceRotationDegrees
    }) {
        const sourceUrlForNormalization = resolveNormalizationSourceUrl({
            currentVideoSourceUrl: currentVideoSourceObjectUrl
        });
        const decoderSupportProbe = await probeVideoDecoderSupportForTrack({
            videoTrackView,
            accelerationOrder: ["prefer-hardware", "no-preference", "prefer-software"]
        });

        if (decoderSupportProbe.supported) {
            return {
                didNormalizePredecode: false,
                executionTimeline,
                prerenderPlan,
                videoTrackView,
                audioTrackView,
                normalizationSourceUrlToRevoke: null
            };
        }

        if (!sourceUrlForNormalization) {
            throw new Error(
                "Unsupported source codec requires normalization, but no canonical source URL is available."
            );
        }

        emitEncodeSignal({
            level: "warn",
            label: "[Encode] source normalization requested for unsupported decoder config",
            payload: {
                codec: videoTrackView.codecConfig?.codec,
                checks: decoderSupportProbe.checks
            }
        });

        const normalized = await normalizeUnsupportedSourceToWorkingSet({
            timeline: executionTimeline,
            sourceUrl: sourceUrlForNormalization,
            exportRange,
            originalAudioTrackView: audioTrackView
        });
        const normalizedTimeline = normalized.timeline;
        const normalizedPlan = buildPrerenderPlanFromTimeline({ timeline: normalizedTimeline });
        const selected = selectContainerTrackViewsFromTimeline(normalizedTimeline);

        emitEncodeSignal({
            label: "[Encode] source normalization complete",
            payload: buildNormalizationCompletePayload({
                normalized,
                prerenderPlan: normalizedPlan,
                normalizedVideoTrackView: selected.videoTrackView,
                normalizedAudioTrackView: selected.audioTrackView,
                sourceRotationDegrees
            })
        });

        return {
            didNormalizePredecode: true,
            executionTimeline: normalizedTimeline,
            prerenderPlan: normalizedPlan,
            videoTrackView: selected.videoTrackView,
            audioTrackView: selected.audioTrackView,
            normalizationSourceUrlToRevoke: normalized.sourceUrl
        };
    }

    /**
     * Create buffers that collect encoded chunks and decoder configs for muxing.
     */
    function createEncodeOutputState() {
        return {
            videoEncodedChunks: [],
            audioEncodedChunks: [],
            videoDecoderConfig: null,
            audioDecoderConfig: null
        };
    }

    /**
     * Build and configure the audio decoder wrapper for the selected audio track.
     */
    async function buildConfiguredAudioDecodeSetup(audioTrackView) {
        const setup = buildWrappedAudioDecoderForTrack(audioTrackView);
        await configureAudioDecoderForTrack({
            audioDecoder: setup.audioDecoder,
            audioTrackView
        });
        return setup;
    }

    /**
     * Emit a single decode fallback signal when software decode takes over.
     */
    function emitDecodeFallbackSignal({
        error,
        range
    }) {
        let rangeStartSeconds = null;
        let rangeEndSeconds = null;
        if (range && typeof range.startSeconds === "number") {
            rangeStartSeconds = range.startSeconds;
        }
        if (range && typeof range.endSeconds === "number") {
            rangeEndSeconds = range.endSeconds;
        }
        emitEncodeSignal({
            level: "warn",
            label: "[Encode] decode strategy fallback engaged",
            payload: {
                reason: error?.message ?? String(error),
                rangeStartSeconds,
                rangeEndSeconds,
                nextStrategy: "webcodecs-video(software)"
            }
        });
    }

    /**
     * Configure both encoders used by export: video and audio.
     */
    async function createConfiguredEncoders({
        exportFps,
        outputWidth,
        outputHeight,
        videoEncodedChunks,
        audioEncodedChunks,
        setVideoDecoderConfig,
        setAudioDecoderConfig
    }) {
        const videoEncoder = new VideoEncoder({
            output(chunk, metadata) {
                videoEncodedChunks.push(chunk);
                if (metadata?.decoderConfig) {
                    setVideoDecoderConfig(metadata.decoderConfig);
                }
            },
            error(error) {
                console.error("VideoEncoder error", error);
                throw error;
            }
        });
        const configuredVideoEncoderConfig = await configureVideoEncoderForTrack({
            videoEncoder,
            exportFps,
            outputWidth,
            outputHeight
        });

        const audioEncoder = new AudioEncoder({
            output(chunk, metadata) {
                audioEncodedChunks.push(chunk);
                if (metadata?.decoderConfig) {
                    setAudioDecoderConfig(metadata.decoderConfig);
                }
            },
            error(error) {
                console.error("AudioEncoder error", error);
                throw error;
            }
        });
        audioEncoder.configure({
            codec: "opus",
            sampleRate: 48_000,
            numberOfChannels: 2,
            bitrate: 128_000
        });

        return {
            videoEncoder,
            audioEncoder,
            configuredVideoEncoderConfig
        };
    }

    /**
     * Build strategy instance with all runtime context wired in.
     */
    function createExportStrategy({
        decodePort,
        executionTimeline,
        exportFps,
        configuredVideoEncoderConfig,
        videoTrackView,
        videoEncoder,
        audioEncoder,
        videoEncodedChunks,
        audioEncodedChunks,
        getVideoDecoderConfig,
        getAudioDecoderConfig
    }) {
        const sharedRenderContext = createSharedRenderExecutionContext({
            decodePort,
            timecodeFragmentIntentResolvers,
            timeline: executionTimeline,
            exportFps,
            configuredVideoEncoderConfig,
            videoTrackView
        });
        const exportExecutionContext = createExportExecutionContext({
            sharedContext: sharedRenderContext,
            videoEncoder,
            audioEncoder,
            videoEncodedChunks,
            audioEncodedChunks,
            getVideoDecoderConfig,
            getAudioDecoderConfig
        });
        return new ExportExecutionStrategy(exportExecutionContext);
    }

    /**
     * Run strategy execution and optional encode diagnostics logging.
     */
    async function executeStrategyAndMaybeLogDiagnostics({
        strategy,
        prerenderPlan,
        exportRange,
        exportFps,
        videoEncodedChunks,
        audioEncodedChunks
    }) {
        const result = await strategy.execute({
            plan: prerenderPlan,
            exportRange,
            fps: exportFps,
            retainComposedFrames: false
        });

        if (runtimeConfig.debug.enableEncodeDiagnostics) {
            logEncodeDiagnostics({
                videoEncodedChunks,
                audioEncodedChunks,
                result,
                exportRange,
                prerenderPlan
            });
        }

        return result;
    }

    /**
     * Emit standardized encode failure summary with stage + decode mode.
     */
    function emitEncodeFailureSummary({
        error,
        encodePipelineRunState
    }) {
        const decodePathMode = resolveEncodeDecodePathMode({
            didNormalizePredecode: encodePipelineRunState.didNormalizePredecode
        });
        emitEncodeSignal({
            label: "[Encode][DECODE_PATH]",
            payload: {
                mode: decodePathMode,
                normalizedPredecode: encodePipelineRunState.didNormalizePredecode,
                runtimeSoftwareFallback: encodePipelineRunState.didRuntimeSoftwareFallback
            }
        });
        console.error("Encode/export failed", error);
        emitEncodeSignal({
            level: "error",
            label: "[Encode][SUMMARY]",
            payload: {
                ok: false,
                failedStage: encodePipelineRunState.currentPipelineStage,
                elapsedMs: Math.round(performance.now() - encodePipelineRunState.encodeStartedAt),
                errorName: error?.name ?? "Error",
                errorMessage: error?.message ?? String(error),
                decodePathMode
            }
        });
    }

    /**
     * Always release temporary URLs and codec resources after encode.
     */
    function cleanupEncodeRunResources({ encodePipelineRunState }) {
        const releaseDecodeResources = encodePipelineRunState.releaseDecodeResources;
        const audioDecoder = encodePipelineRunState.audioDecoder;
        const videoEncoder = encodePipelineRunState.videoEncoder;
        const audioEncoder = encodePipelineRunState.audioEncoder;
        const normalizationSourceUrlToRevoke = encodePipelineRunState.normalizationSourceUrlToRevoke;

        if (typeof releaseDecodeResources === "function") {
            try {
                releaseDecodeResources();
            } catch (error) {
                console.warn("[Encode] decode resource cleanup failed", error);
            }
        }
        if (audioDecoder && typeof audioDecoder.close === "function") {
            try {
                audioDecoder.close();
            } catch (error) {
                console.warn("[Encode] audio decoder cleanup failed", error);
            }
        }
        if (videoEncoder && typeof videoEncoder.close === "function") {
            try {
                videoEncoder.close();
            } catch (error) {
                console.warn("[Encode] video encoder cleanup failed", error);
            }
        }
        if (audioEncoder && typeof audioEncoder.close === "function") {
            try {
                audioEncoder.close();
            } catch (error) {
                console.warn("[Encode] audio encoder cleanup failed", error);
            }
        }
        if (normalizationSourceUrlToRevoke.value) {
            URL.revokeObjectURL(normalizationSourceUrlToRevoke.value);
            normalizationSourceUrlToRevoke.value = null;
        }
    }

    /**
     * Build port bundle for EncodePipelineRun.
     */
    function createEncodePipelineRunPorts() {
        return {
            runtime: {
                now: () => performance.now(),
                outputConfig: runtimeConfig.output
            },
            reporting: {
                clearEncodeDiagnosticsPanel,
                emitDecodeFallbackSignal
            },
            planning: {
                validateEncodePrerequisites,
                buildEncodePlanContext,
                selectExecutionTrackViewsWithRotation
            },
            normalization: {
                maybeNormalizeExecutionTimelineForUnsupportedDecoder
            },
            decoding: {
                createEncodeOutputState,
                buildConfiguredAudioDecodeSetup,
                createDecodePortForTrack
            },
            encoding: {
                createConfiguredEncoders,
                createExportStrategy,
                executeStrategyAndMaybeLogDiagnostics,
                finalizeEncodeOutput
            }
        };
    }

    previewBtn.onclick = () => {
        if (!timeline) {
            console.warn("Timeline not ready. Load a video source first.");
            return;
        }
        console.log("Preview button clicked");

        const ctx = context;
        const width = canvas.width = 640;
        const height = canvas.height = 360;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);

        console.log(
            "DEBUG timeline.tracks",
            timeline.tracks,
            typeof timeline.tracks,
            Array.isArray(timeline.tracks),
            timeline.tracks && timeline.tracks[Symbol.iterator]
        );

        // -------------------------------------------------
        // Resolve procedural intent at a demo time
        // -------------------------------------------------
        const prerenderPlan = buildPrerenderPlanFromTimeline({ timeline });

        const proceduralFragments = prerenderPlan.fragments.filter(
            f => f.prerenderContributorKind === "procedural"
        );

        let startTimeMs = null;

        // -------------------------------------------------
        // PREVIEW-ONLY TIME DRIVER
        //
        // This loop exists purely for UI visualisation.
        //
        // It MUST NOT:
        // - mutate timeline
        // - mutate prerender plan
        // - allocate VideoFrames
        // - perform container decode
        // - leak into execution contracts
        //
        // It evaluates procedural fragments at a timecode
        // and draws declarative render intent to canvas.
        //
        // This is preview glue only.
        // -------------------------------------------------
        function frameLoop(nowMs) {

            if (startTimeMs === null) {
                startTimeMs = nowMs;
            }

            const elapsedMs = nowMs - startTimeMs;
            const timeSeconds = elapsedMs / 1000;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, width, height);

            // PREVIEW → Application Orchestration Boundary
            // We evaluate the PreRenderPlan at a time-slice.
            // Preview does not inspect fragments directly.
            const resolution = resolveProceduralFragmentsAtTimeFromPlan({
                plan: prerenderPlan,
                timeSeconds,
                timecodeFragmentIntentResolvers
            });

            const allRenderIntents = resolution.renderIntents;

            ctx.fillStyle = "#fff";
            ctx.font = "32px sans-serif";
            ctx.textBaseline = "top";

            for (const intent of allRenderIntents) {
                if (intent.kind === "text-overlay") {

                    let y = 40;

                    for (const item of intent.items) {
                        for (const word of item.words) {
                            ctx.fillText(word.text, 40, y);
                            y += 40;
                        }
                    }
                }
            }

            requestAnimationFrame(frameLoop);
        }

        requestAnimationFrame(frameLoop);

    };

    /**
     * Encode Button Handler
     *
     * Purpose:
     * - Takes the pre-rendered VideoFrame and AudioData buffers and encodes them into compressed samples.
     *
     * What it does:
     * - Uses **WebCodecs** to encode video frames into the configured codec (e.g., H.264) and audio samples (e.g., Opus).
     * - Generates encoded video and audio samples ready to be packaged into an MP4 container.
     * - This is a non-real-time process; all frames are processed sequentially from the pre-rendered buffers.
     *
     * Time Considerations:
     * - Encoding is computationally expensive and can take time proportional to video length and resolution.
     * - Any effects already applied during pre-render are preserved and encoded in the output samples.
     *
     * Notes:
     * - Does not create the MP4 container itself. Encoded samples are stored in memory for the final export step.
     * - Works only after preRenderBtn has been executed successfully.
     * - The Export button remains disabled until a separate container packaging step is implemented.
     */
    exportBtn.onclick = () => {
        if (!lastExportBlob) {
            console.warn("No exported MP4 available yet. Run Encode first.");
            return;
        }
        downloadBlob(lastExportBlob, "framesmith-export.mp4");
    };

    let isEncodeInProgress = false;
    encodeBtn.onclick = async () => {

        if (!tryStartEncodeRun())  return;

        const {
            runtime,
            reporting,
            planning,
            normalization,
            decoding,
            encoding
        } = createEncodePipelineRunPorts();

        const encodePipelineRun = new EncodePipelineRun({
            timeline,
            runtime,
            reporting,
            planning,
            normalization,
            decoding,
            encoding
        });
        const encodePipelineRunState = encodePipelineRun.runState;

        try {

            await encodePipelineRun.run();

        } catch (error) {
            
            emitEncodeFailureSummary({ error, encodePipelineRunState });

        } finally {

            cleanupEncodeRunResources({ encodePipelineRunState });
            isEncodeInProgress = false;
            dumpEncodeDiagnosticsPanelToConsole();

        }
    };

    if (videoFileInput) {
        videoFileInput.onchange = async () => {
            const selectedFile = videoFileInput.files?.[0];
            cachedSelectedVideo = null;
            if (!(selectedFile instanceof File)) {
                setVideoSourceStatus("No video loaded");
                return;
            }

            try {
                setWorkflowEnabled(false);
                setVideoSourceStatus("Loading selected video...");
                if (lastExportUrl) {
                    URL.revokeObjectURL(lastExportUrl);
                    lastExportUrl = null;
                }
                lastExportBlob = null;
                exportBtn.disabled = true;
                const { bytes } = await readSelectedVideoBytesWithRetry(videoFileInput, setVideoSourceStatus);
                cachedSelectedVideo = {
                    fileKey: `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`,
                    bytes
                };
                if (currentVideoSourceObjectUrl) {
                    URL.revokeObjectURL(currentVideoSourceObjectUrl);
                    currentVideoSourceObjectUrl = null;
                }
                const sourceBlob = new Blob([cachedSelectedVideo.bytes], {
                    type: selectedFile.type || "video/mp4"
                });
                currentVideoSourceObjectUrl = URL.createObjectURL(sourceBlob);
                video.src = currentVideoSourceObjectUrl;
                video.style.display = "none";
                video.controls = false;

                await initializeTimelineFromBytes(cachedSelectedVideo.bytes);
            } catch (error) {
                console.error("Video source load failed", error);
                const errorText = String(error?.message || error || "");
                const notReadable =
                    String(error?.name || "") === "NotReadableError" ||
                    errorText.includes("NotReadableError");
                if (notReadable) {
                    setVideoSourceStatus(
                        "Video load failed: Android picker returned an unreadable handle. Re-pick using Browse > Downloads.",
                        true
                    );
                } else {
                    setVideoSourceStatus(`Video load failed: ${errorText}`, true);
                }
            }
        };
    }

    setWorkflowEnabled(false);
    setVideoSourceStatus("No video loaded");


});

function downloadBlob(blob, filename) {
    console.log("STEP0: downloadBlob CALLED, blob.size =", blob.size);

    // NEW: dump the blob to the window for manual inspection
    window.__lastBlob = blob;
    console.log("STEP0b: saved blob to window.__lastBlob");

    const url = URL.createObjectURL(blob);
    console.log("STEP1: object URL =", url);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    console.log("STEP2: anchor appended to DOM:", a);

    a.addEventListener("click", () => {
        console.log("STEP3: anchor CLICK event fired");
    });

    console.log("STEP4: calling a.click()");
    a.click();

    console.log("STEP5: after a.click() (if this prints, JS did not crash)");

    // clean up later
    setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log("STEP6: object URL revoked and anchor removed");
    }, 5000);
}
window.downloadBlob = downloadBlob;

window.testDownload = () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");
};
const DEFAULT_TEXT_OVERLAY_STYLE = Object.freeze({
    // Mirrors Drupal caption style: bevan_s_bench_portrait
    fontFamily: `'${CAPTION_FONT_FAMILY}', 'Anton SC', 'Anton', 'Arial Black', sans-serif`,
    fontWeight: 700,
    fontSizePx: 40,
    lineHeightPx: 50,
    // Drupal ASS style uses MarginL/MarginR=200 on 1920 and MarginV=175 on 1080.
    // For 720x1280 export this maps closely to:
    sidePaddingPx: 75,
    bottomPaddingPx: 208,
    textAlign: "center",
    // ASS colors use AABBGGRR; values below are converted to CSS RGB.
    // primaryColour: &H0065bdd7 -> #d7bd65
    // primaryHighlight.primaryColour: &H00e1c46b -> #6bc4e1
    // secondaryHighlight.primaryColour: &H007a5d66 -> #665d7a
    baseFill: "#D7BD65",
    baseStroke: "#000000",
    strokeWidthPx: 2,
    activeFill: "#6BC4E1",
    secondaryActiveFill: "#665D7A",
    secondaryHighlightEvery: 5,
    // Old Drupal ASS chunking defaults (AssSubtitleGenerator)
    maxWordsPerChunk: 6,
    maxChunkDurationSeconds: 2.0,
    pauseSplitThresholdSeconds: 0.3,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlurPx: 0
});

const DEFAULT_IMAGE_OVERLAY_STYLE = Object.freeze({
    anchor: "top-left",
    marginXPct: 3,
    marginYPct: 3,
    opacity: 1
});

const DEFAULT_IMAGE_OVERLAY_PULSE = Object.freeze({
    largeScalePct: 30,
    smallScalePct: 24,
    cycleSeconds: 6.5
});

async function loadImageDrawableFromPath(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        const blob = await response.blob();

        if (typeof createImageBitmap === "function") {
            return await createImageBitmap(blob);
        }

        if (typeof Image === "function") {
            const objectUrl = URL.createObjectURL(blob);
            try {
                const image = new Image();
                const loaded = new Promise((resolve, reject) => {
                    image.onload = () => resolve(image);
                    image.onerror = (error) => reject(error);
                });
                image.src = objectUrl;
                return await loaded;
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        }
    } catch (error) {
        console.warn("[Timeline][image-overlay] failed to load image drawable", {
            path,
            error: error?.message ?? String(error)
        });
    }

    return null;
}

async function loadTimelineImageOverlays() {
    const logoPath = "./logo.png";
    const drawable = await loadImageDrawableFromPath(logoPath);
    if (!drawable) {
        console.warn("[Timeline][image-overlay] logo drawable unavailable; skipping logo overlay", {
            logoPath
        });
        return [];
    }

    const overlayItem = {
        id: "logo-overlay-default",
        startSeconds: 0,
        endSeconds: 10,
        drawable,
        style: {
            ...DEFAULT_IMAGE_OVERLAY_STYLE
        },
        pulse: {
            ...DEFAULT_IMAGE_OVERLAY_PULSE
        }
    };

    console.log("[Timeline][image-overlay] loaded logo overlay item", {
        logoPath
    });
    return [overlayItem];
}

function tokenizeTranscriptText(text) {
    if (typeof text !== "string") return [];
    const matches = text.match(/\S+/g);
    return Array.isArray(matches) ? matches : [];
}

function buildTimedWordsFromSegment(segment) {
    if (!segment || typeof segment.start !== "number" || typeof segment.end !== "number") {
        return [];
    }

    if (Array.isArray(segment.words) && segment.words.length > 0) {
        return segment.words
            .map((word) => {
                const text = typeof word?.word === "string" ? word.word.trim() : "";
                const start = typeof word?.start === "number" ? word.start : null;
                const end = typeof word?.end === "number" ? word.end : null;
                if (!text || typeof start !== "number" || typeof end !== "number") return null;
                return { text, start, end };
            })
            .filter(Boolean);
    }

    const tokens = tokenizeTranscriptText(segment.text);
    if (tokens.length === 0) return [];

    const startSeconds = segment.start;
    const endSeconds = Math.max(segment.end, startSeconds + 0.001);
    const totalDuration = endSeconds - startSeconds;
    const totalWeight = tokens.reduce((sum, token) => sum + Math.max(token.length, 1), 0);

    let cursor = startSeconds;
    return tokens.map((token, index) => {
        const weight = Math.max(token.length, 1);
        const idealDuration = totalDuration * (weight / totalWeight);
        const start = cursor;
        const isLastToken = index === tokens.length - 1;
        const end = isLastToken ? endSeconds : Math.min(endSeconds, cursor + idealDuration);
        cursor = end;
        return {
            text: token,
            start,
            end
        };
    });
}

function buildTextOverlayItemsFromWhisperJson(whisperJson) {
    if (!whisperJson || !Array.isArray(whisperJson.segments)) return [];

    const styleDefaults = { ...DEFAULT_TEXT_OVERLAY_STYLE };
    const maxWordsPerChunk = Math.max(1, Math.floor(styleDefaults.maxWordsPerChunk ?? 6));
    const maxChunkDurationSeconds = Math.max(0.1, Number(styleDefaults.maxChunkDurationSeconds ?? 2.0));
    const pauseSplitThresholdSeconds = Math.max(0, Number(styleDefaults.pauseSplitThresholdSeconds ?? 0.3));

    let nextOverlayIndex = 0;

    return whisperJson.segments
        .flatMap((segment) => {
            const words = buildTimedWordsFromSegment(segment);
            if (words.length === 0) return [];

            const segmentItems = [];
            let chunkWords = [];
            let chunkStartSeconds = words[0].start;

            const pushChunk = () => {
                if (chunkWords.length === 0) return;
                const firstWord = chunkWords[0];
                const lastWord = chunkWords[chunkWords.length - 1];
                segmentItems.push({
                    id: `whisper-segment-${nextOverlayIndex++}`,
                    startSeconds: firstWord.start,
                    endSeconds: lastWord.end,
                    words: chunkWords.map((word) => ({ ...word })),
                    style: {
                        ...styleDefaults
                    },
                    override: [],
                    animate: []
                });
            };

            for (let index = 0; index < words.length; index += 1) {
                const word = words[index];
                const nextWord = words[index + 1];

                if (chunkWords.length === 0) {
                    chunkStartSeconds = word.start;
                }
                chunkWords.push(word);

                const chunkDurationSeconds = word.end - chunkStartSeconds;
                const pauseSeconds = nextWord ? (nextWord.start - word.end) : 0;
                const reachedMaxWords = chunkWords.length >= maxWordsPerChunk;
                const reachedMaxDuration = chunkDurationSeconds >= maxChunkDurationSeconds;
                const reachedPauseSplit = !!nextWord && pauseSeconds >= pauseSplitThresholdSeconds;
                const reachedEndOfSegment = !nextWord;

                if (reachedMaxWords || reachedMaxDuration || reachedPauseSplit || reachedEndOfSegment) {
                    pushChunk();
                    chunkWords = [];
                }
            }

            return segmentItems;
        })
        .filter(Boolean);
}

async function loadTimelineTextOverlays() {
    const transcriptCandidates = [
        "./90502899-3eba-43a0-a8ed-3834d685e7b4.json"
    ];

    for (const transcriptPath of transcriptCandidates) {
        try {
            const response = await fetch(transcriptPath);
            if (!response.ok) continue;
            const json = await response.json();
            const overlayItems = buildTextOverlayItemsFromWhisperJson(json);
            if (overlayItems.length === 0) continue;
            console.log("[Timeline][text-overlay] loaded transcript overlay items", {
                transcriptPath,
                itemCount: overlayItems.length
            });
            return overlayItems;
        } catch (error) {
            console.warn("[Timeline][text-overlay] failed to load transcript candidate", {
                transcriptPath,
                error: error?.message ?? String(error)
            });
        }
    }

    console.warn("[Timeline][text-overlay] no transcript overlay loaded; falling back to default demo overlay");
    return [];
}

/**
 * createTimeline
 * =====================================================
 *
 * APPLICATION SERVICE — TEMPORARY ORCHESTRATION
 *
 * Purpose:
 * --------
 * Assemble a Timeline from editor intent and external assets.
 *
 * This function is an application-level use case.
 * It coordinates infrastructure adapters and domain objects,
 * but contains NO domain rules of its own.
 *
 * Responsibilities (ALLOWED):
 * ---------------------------
 * - Fetch container bytes for referenced media assets
 * - Invoke demux boundary adapters
 * - Construct ContainerTrackView instances
 * - Select which tracks participate in the Timeline
 * - Instantiate Timeline, Track, and Clip objects
 *
 * Responsibilities (EXPLICITLY FORBIDDEN):
 * ---------------------------------------
 * - Parsing MP4 boxes
 * - Interpreting container structure
 * - Inferring codec behavior
 * - Decoding media
 * - Sampling by time
 * - Rendering frames or audio
 * - Applying timeline policy (trimming logic lives in Clip)
 *
 * Architectural Notes:
 * --------------------
 * - Demux EXECUTION lives in the demuxer.
 * - Demux INVOCATION lives here.
 * - Mp4Asset is constructed AFTER demux and must not
 *   acquire container knowledge.
 *
 * - Track selection performed here is APPLICATION POLICY,
 *   not a container rule and not a domain invariant.
 *
 * Lifecycle:
 * ----------
 * - This function is expected to shrink, move, or disappear
 *   as editor intent becomes explicit and persistent.
 * - Its verbosity is intentional to keep boundaries visible.
 *
 * Invariants:
 * -----------
 * - Domain objects (Timeline, Track, Clip) remain container-agnostic.
 * - No HTML, playback, or browser APIs may leak past this boundary.
 */
async function createTimeline({ mp4Bytes, runtimeConfig }) {
    if (!(mp4Bytes instanceof Uint8Array) || mp4Bytes.length === 0) {
        throw new Error("createTimeline: mp4Bytes must be a non-empty Uint8Array");
    }
    const transcriptOverlayItems = await loadTimelineTextOverlays();
    const imageOverlayItems = await loadTimelineImageOverlays();

    const container = openContainerFromMp4({ mp4Bytes });
    const nativeTrackViews = container.createTrackViews();

    const requestedVideoDemuxer = runtimeConfig?.demux?.videoDemuxer;
    const selectedVideoDemuxer = requestedVideoDemuxer === "mp4box"
        ? "mp4box"
        : "native";

    const summarizeTrackCadenceUs = (trackView, sampleLimit = 120) => {
        const sampleCount = Number(trackView?.sampleCount ?? 0);
        const limit = Math.min(sampleCount, sampleLimit);
        const durationsUs = [];
        for (let index = 0; index < limit; index += 1) {
            const sample = trackView.getSampleByIndex(index);
            const durationPts = Number(sample?.duration);
            if (!Number.isFinite(durationPts) || durationPts <= 0) continue;
            const durationUs = Math.round(trackView.ptsToSeconds(durationPts) * 1_000_000);
            if (Number.isFinite(durationUs) && durationUs > 0) {
                durationsUs.push(durationUs);
            }
        }
        if (durationsUs.length === 0) return null;
        const sorted = durationsUs.slice().sort((a, b) => a - b);
        const medianUs = sorted[Math.floor(sorted.length / 2)];
        return { medianUs, minUs: sorted[0], maxUs: sorted[sorted.length - 1], sampleCount: durationsUs.length };
    };

    const shouldFallbackNativeVideoTrack = (trackView) => {
        if (!trackView || trackView.mediaType !== "video") return false;
        const cadence = summarizeTrackCadenceUs(trackView);
        if (!cadence) return false;
        // Practical bounds for phone/social footage:
        // <1ms or >200ms per frame implies broken timescale conversion.
        const invalidCadence = cadence.medianUs < 1_000 || cadence.medianUs > 200_000;
        if (invalidCadence) {
            console.warn("[Timeline] native video cadence invalid; will fallback to mp4box", cadence);
        }
        return invalidCadence;
    };

    const shouldAutoFallbackToMp4Box =
        selectedVideoDemuxer === "native" &&
        shouldFallbackNativeVideoTrack(nativeTrackViews.find(trackView => trackView.mediaType === "video"));

    if (selectedVideoDemuxer === "mp4box") {
        const mp4BoxVideoTrackView = await createMp4BoxVideoTrackView({ mp4Bytes });
        const mergedTrackViews = [
            mp4BoxVideoTrackView,
            ...nativeTrackViews.filter(trackView => trackView.mediaType !== "video")
        ];
        console.log("[Timeline] demux selection", {
            selectedVideoDemuxer,
            trackViewMediaTypes: mergedTrackViews.map(trackView => trackView.mediaType)
        });
        return createTimelineFromPreparedAssets({
            trackViews: mergedTrackViews,
            textOverlayItems: transcriptOverlayItems,
            imageOverlayItems
        });
    }

    if (shouldAutoFallbackToMp4Box) {
        const mp4BoxVideoTrackView = await createMp4BoxVideoTrackView({ mp4Bytes });
        const mergedTrackViews = [
            mp4BoxVideoTrackView,
            ...nativeTrackViews.filter(trackView => trackView.mediaType !== "video")
        ];
        console.log("[Timeline] demux selection", {
            selectedVideoDemuxer: "native->mp4box-fallback",
            trackViewMediaTypes: mergedTrackViews.map(trackView => trackView.mediaType)
        });
        return createTimelineFromPreparedAssets({
            trackViews: mergedTrackViews,
            textOverlayItems: transcriptOverlayItems,
            imageOverlayItems
        });
    }

    console.log("[Timeline] demux selection", {
        selectedVideoDemuxer,
        trackViewMediaTypes: nativeTrackViews.map(trackView => trackView.mediaType)
    });

    return createTimelineFromPreparedAssets({
        trackViews: nativeTrackViews,
        textOverlayItems: transcriptOverlayItems,
        imageOverlayItems
    });
}

async function createMp4BoxVideoTrackView({ mp4Bytes }) {
    const demuxer = new Mp4BoxDemuxer(mp4Bytes.buffer.slice(
        mp4Bytes.byteOffset,
        mp4Bytes.byteOffset + mp4Bytes.byteLength
    ));

    const parsed = await demuxer.parse();
    const videoTrack = parsed?.videoTrack;
    const avcCBuffer = demuxer.getAvcCBuffer();

    if (!videoTrack) {
        throw new Error("createMp4BoxVideoTrackView: video track not found");
    }
    if (!(avcCBuffer instanceof ArrayBuffer)) {
        throw new Error("createMp4BoxVideoTrackView: avcC not available from Mp4BoxDemuxer");
    }

    const toMicroseconds = (value, timescale) => {
        if (typeof value !== "number" || typeof timescale !== "number" || timescale <= 0) {
            return null;
        }
        return Math.round((value / timescale) * 1_000_000);
    };

    const samples = Array.isArray(parsed?.videoSamples) ? parsed.videoSamples : [];
    const normalizedSamples = samples
        .map((sample, index) => {
            const timescale =
                sample?.raw?.timescale ??
                videoTrack.timescale;
            const ptsUs =
                toMicroseconds(sample?.raw?.cts, timescale) ??
                (typeof sample?.timestamp === "number" ? sample.timestamp : null);
            const dtsUs =
                toMicroseconds(sample?.raw?.dts, timescale) ??
                ptsUs;
            const durationUs =
                toMicroseconds(sample?.raw?.duration, timescale) ??
                (typeof sample?.duration === "number" ? sample.duration : null);

            if (typeof ptsUs !== "number" || typeof durationUs !== "number") {
                return null;
            }

            return {
                _index: index,
                ptsUs,
                dtsUs,
                durationUs,
                isKeyframe: sample?.type === "key",
                data: sample?.data
            };
        })
        .filter(Boolean);

    console.log("[Timeline][mp4box] normalized video sample summary", {
        inputSampleCount: samples.length,
        normalizedSampleCount: normalizedSamples.length
    });

    const displayTransform = buildDisplayTransformFromTrackMatrix(videoTrack.matrix);
    if (displayTransform.rotationDegrees !== 0) {
        console.log("[Timeline][mp4box] inferred track rotation", {
            rotationDegrees: displayTransform.rotationDegrees
        });
    }

    return {
        mediaType: "video",
        containerMeta: {
            trackTimescale: 1_000_000,
            codedWidth: videoTrack.track_width,
            codedHeight: videoTrack.track_height,
            displayTransform
        },
        codecConfig: {
            codec: "avc1",
            avcC: new Uint8Array(avcCBuffer)
        },
        sampleCount: normalizedSamples.length,
        ptsToSeconds(pts) {
            return pts / 1_000_000;
        },
        secondsToPts(seconds) {
            return Math.round(seconds * 1_000_000);
        },
        getSampleByIndex(index) {
            const sample = normalizedSamples[index];
            if (!sample) return null;
            return {
                pts: sample.ptsUs,
                dts: sample.dtsUs,
                duration: sample.durationUs,
                isKeyframe: sample.isKeyframe,
                data: sample.data
            };
        },
        *iterateSamplesByPtsRange(startPts, endPts) {
            for (const sample of normalizedSamples) {
                if (sample.ptsUs < startPts) continue;
                if (sample.ptsUs > endPts) continue;
                yield {
                    pts: sample.ptsUs,
                    dts: sample.dtsUs,
                    duration: sample.durationUs,
                    isKeyframe: sample.isKeyframe,
                    data: sample.data
                };
            }
        }
    };
}

/**
 * createTimelineFromPreparedAssets
 * =====================================================
 *
 * DOMAIN-ASSEMBLY — SYNCHRONOUS
 *
 * Purpose:
 * --------
 * Construct a Timeline from already-prepared ContainerTrackView instances.
 *
 * This function is PURELY SYNCHRONOUS.
 * It performs NO I/O, NO demux, NO fetch, NO decoding.
 *
 * Inputs:
 * -------
 * - trackViews: Array<ContainerTrackView>
 *
 * Output:
 * -------
 * - Timeline
 */
export function createTimelineFromPreparedAssets({
    trackViews,
    textOverlayItems = [],
    imageOverlayItems = []
}) {
    if (!Array.isArray(trackViews)) {
        throw new Error("createTimelineFromPreparedAssets: trackViews must be array");
    }

    const timeline = new Timeline(30);

    const videoTracks = trackViews.filter(t => t.mediaType === "video");
    const audioTracks = trackViews.filter(t => t.mediaType === "audio");

    if (!videoTracks[0]) {
        throw new Error("createTimelineFromPreparedAssets: no video track");
    }
    if (!audioTracks[0]) {
        throw new Error("createTimelineFromPreparedAssets: no audio track");
    }

    const videoTrack = new Track();
    const audioTrack = new Track();

    const resolveTrackClipRangeSeconds = (trackView, mediaLabel) => {
        const sampleCount = Number(trackView?.sampleCount ?? 0);
        if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
            throw new Error(`createTimelineFromPreparedAssets: ${mediaLabel} track has no samples`);
        }

        const firstSample = trackView.getSampleByIndex(0);
        const lastSample = trackView.getSampleByIndex(sampleCount - 1);
        if (!firstSample || !lastSample) {
            throw new Error(`createTimelineFromPreparedAssets: ${mediaLabel} track samples are unavailable`);
        }

        const firstPts = Number(firstSample.pts);
        const lastPts = Number(lastSample.pts);
        const lastDuration = Number(lastSample.duration);
        const trackTimescale = Number(trackView?.containerMeta?.trackTimescale);

        if (!Number.isFinite(firstPts) || !Number.isFinite(lastPts)) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} sample timestamps ` +
                `(firstPts=${firstPts}, lastPts=${lastPts}, trackTimescale=${trackTimescale})`
            );
        }

        if (!Number.isFinite(trackTimescale) || trackTimescale <= 0) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} trackTimescale ` +
                `(trackTimescale=${trackTimescale})`
            );
        }

        const inclusiveEndPts = lastPts + (Number.isFinite(lastDuration) && lastDuration > 0 ? lastDuration : 1);

        const startSeconds = trackView.ptsToSeconds(firstPts);
        const endSeconds = trackView.ptsToSeconds(inclusiveEndPts);

        if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} range ` +
                `(startSeconds=${startSeconds}, endSeconds=${endSeconds}, ` +
                `firstPts=${firstPts}, lastPts=${lastPts}, lastDuration=${lastDuration}, trackTimescale=${trackTimescale})`
            );
        }

        return { startSeconds, endSeconds };
    };

    const videoClipRange = resolveTrackClipRangeSeconds(videoTracks[0], "video");
    const audioClipRange = resolveTrackClipRangeSeconds(audioTracks[0], "audio");

    timeline.addTrack(videoTrack);
    timeline.addTrack(audioTrack);

    videoTrack.addClip(
        new Clip({
            trackView: videoTracks[0],
            startSeconds: videoClipRange.startSeconds,
            endSeconds: videoClipRange.endSeconds
        })
    );

    audioTrack.addClip(
        new Clip({
            trackView: audioTracks[0],
            startSeconds: audioClipRange.startSeconds,
            endSeconds: audioClipRange.endSeconds
        })
    );

    const overlayTrack = new Track();
    timeline.addTrack(overlayTrack);

    const overlayItems = Array.isArray(textOverlayItems) && textOverlayItems.length > 0
        ? textOverlayItems
        : [
            {
                id: "fallback-overlay",
                startSeconds: 0,
                endSeconds: 10,
                words: [
                    { start: 0, end: 3, text: "Hello" },
                    { start: 3, end: 6, text: "Beautiful" },
                    { start: 6, end: 9, text: "World" }
                ],
                style: {
                    ...DEFAULT_TEXT_OVERLAY_STYLE
                },
                override: [],
                animate: []
            }
        ];
    const overlayClipStartSeconds = overlayItems.reduce((minStart, item) => {
        const start = typeof item?.startSeconds === "number" ? item.startSeconds : minStart;
        return Math.min(minStart, start);
    }, Number.POSITIVE_INFINITY);
    const overlayClipEndSeconds = overlayItems.reduce((maxEnd, item) => {
        const end = typeof item?.endSeconds === "number" ? item.endSeconds : maxEnd;
        return Math.max(maxEnd, end);
    }, 0);

    overlayTrack.addClip(
        new ProceduralClip({
            kind: "text-overlay",
            startSeconds: Number.isFinite(overlayClipStartSeconds) ? overlayClipStartSeconds : 0,
            endSeconds: overlayClipEndSeconds > 0 ? overlayClipEndSeconds : 10,
            items: overlayItems
        })
    );

    if (Array.isArray(imageOverlayItems) && imageOverlayItems.length > 0) {
        const imageOverlayTrack = new Track();
        timeline.addTrack(imageOverlayTrack);

        const imageOverlayStartSeconds = imageOverlayItems.reduce((minStart, item) => {
            const start = typeof item?.startSeconds === "number" ? item.startSeconds : minStart;
            return Math.min(minStart, start);
        }, Number.POSITIVE_INFINITY);
        const imageOverlayEndSeconds = imageOverlayItems.reduce((maxEnd, item) => {
            const end = typeof item?.endSeconds === "number" ? item.endSeconds : maxEnd;
            return Math.max(maxEnd, end);
        }, 0);

        imageOverlayTrack.addClip(
            new ProceduralClip({
                kind: "image-overlay",
                startSeconds: Number.isFinite(imageOverlayStartSeconds) ? imageOverlayStartSeconds : 0,
                endSeconds: imageOverlayEndSeconds > 0 ? imageOverlayEndSeconds : 10,
                items: imageOverlayItems
            })
        );
    }

    return timeline;
}

import * as TimelineCompiler from "./src/timeline/compileTimeline.js";

export const __test__ = {
    Timeline,
    Track,
    Clip,
    summarizeTrackViewKeys,
    summarizeTrackViewTiming,
    getRotationDegreesFromTrackView,
    buildNormalizationCompletePayload,
    retimeVideoTrackViewToExportRange,
    ...TimelineCompiler
};
