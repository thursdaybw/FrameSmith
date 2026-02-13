/**
 * FrameSmith, Application Driver (Pre-Alpha)
 *
 * This file is a temporary orchestration layer used during early development.
 * It wires together preview rendering, offline pre-render planning, and future
 * prerender execution, encode, and export stages.
 *
 * IMPORTANT:
 * This file is NOT the domain model.
 * This file is NOT the timeline compiler.
 * This file is glue code while the architecture is being discovered.
 *
 * -------------------------------------------------
 * Core Architectural Truth
 * -------------------------------------------------
 *
 * FrameSmith is not a video player.
 * FrameSmith is a timeline compiler.
 *
 * Preview exists only to visualise timeline evaluation.
 * Pre-render planning deterministically evaluates the timeline into a plan.
 * Pre-render execution consumes the plan and produces timestamped buffers.
 * Encoding and export consume those buffers.
 *
 * Preview, planning, execution, encode, and export are separate concerns.
 *
 * -------------------------------------------------
 * Current Phases (As Implemented Today)
 * -------------------------------------------------
 *
 * 1. Preview Phase (Real-Time, Non-Deterministic)
 *    - Uses browser playback and rendering APIs.
 *    - Renders frames to a canvas for visual inspection.
 *    - Plays audio via the browser audio output.
 *    - No data produced here is used for encoding or export.
 *
 * 2. Timeline to Pre-Render Planning Phase (Offline, Deterministic)
 *    - Evaluates the Timeline without relying on playback.
 *    - Produces a PreRenderPlan, a list of plan fragments.
 *
 *    Does NOT:
 *    - decode media
 *    - generate VideoFrame
 *    - generate AudioData
 *    - sample wall-clock time
 *
 * 3. Pre-Render Execution (Offline, Deterministic)
 *    - Consumes a PreRenderPlan.
 *    - Executes plan fragments deterministically.
 *    - Uses injected executors:
 *        - container-backed fragments decode access units
 *        - procedural fragments dispatch to procedural renderers
 *    - Produces timestamped buffers (VideoFrame and or AudioData).
 *
 *    Does NOT:
 *    - use preview playback APIs
 *    - encode
 *    - write containers
 *
 * 4. Encode Phase (Planned)
 *    - Consumes VideoFrame and AudioData objects.
 *    - Uses WebCodecs to produce compressed access units.
 *
 * 5. Export Phase (Planned)
 *    - Packages encoded access units into an MP4 container.
 *
 * Notes:
 * - A fragment is not an access unit.
 * - A fragment describes work.
 * - A timeline never owns a plan.
 *
 * -------------------------------------------------
 * Architectural Note: Tracks vs Output Domains
 * -------------------------------------------------
 *
 * FrameSmith does not use "track types" (video, audio, subtitle) as a core
 * engine concept. Tracks are structural groupings that define ordering,
 * overlap, and layering of clips. Rendering semantics are derived from the
 * contribution domain of each clip or asset (video, audio, procedural),
 * not from the track it resides on.
 *
 * -------------------------------------------------
 * Demo Constraints (Non-Architectural)
 * -------------------------------------------------
 *
 * This file represents one temporary application entry point:
 * a container-backed, HTMLVideoElement-driven demo workflow.
 *
 * Assumptions made here are NOT FrameSmith domain rules.
 * FrameSmith as a system does NOT require:
 * - container-backed media
 * - video tracks
 * - HTML elements
 *
 * -------------------------------------------------
 * Scope Warning
 * -------------------------------------------------
 *
 * This file currently uses HTMLVideoElement and browser APIs as a temporary
 * stand-in for future asset and timeline systems.
 *
 * These APIs must not leak into:
 * - the timeline model
 * - the pre-render plan contract
 * - the prerender execution contract
 * - the encoder inputs
 *
 * -------------------------------------------------
 * Glossary
 * -------------------------------------------------
 *
 * * Real-Time Rendering (Preview)
 *   Frames composited live to the canvas for preview. Not used for encoding.
 *
 * * Pre-Render Planning
 *   Deterministic evaluation of a Timeline into a PreRenderPlan, without
 *   decoding, rendering, or producing VideoFrame or AudioData.
 *
 * * PreRenderPlan
 *   An ordered list of plan fragments describing work to be executed later.
 *
 * * Plan Fragment
 *   A typed unit of executable intent.
 *   Examples:
 *   - access-units fragment (container-backed decode work)
 *   - procedural fragment (dispatch to a procedural renderer)
 *
 * * Container-Backed Contributor
 *   A fragment whose execution obtains time and data from encoded access units
 *   and decodes via a media decoder (WebCodecs VideoDecoder or AudioDecoder).
 *
 * * Procedural Contributor
 *   A fragment whose execution resolves authored procedural intent at a given
 *   timecode. It does not produce VideoFrame or AudioData.
 *
 * * Timecode Fragment Intent Resolver
 *   A function registered by proceduralKind that receives
 *   { fragment, timeSeconds } and returns declarative render intent only.
 *   It must not allocate VideoFrame or AudioData.
 *
 * * Media Decoder
 *   Converts encoded access units into raw buffers (VideoFrame, AudioData).
 *
 * * Encoding (WebCodecs)
 *   Converts VideoFrame and AudioData into compressed access units for packaging.
 *
 * * Access Units / Samples
 *   The compressed outputs of encoding that are written into a container.
 *
 * -------------------------------------------------
 * TODO — Concrete Next Actions (Non-Speculative)
 * -------------------------------------------------
 *
 * Add resolver-level unit test
 *    - Assert resolver is invoked via executeProceduralFragmentAtTime.
 *    - Assert correct timeSeconds is received.
 *    - Assert fragment identity is preserved by reference.
 *    - Assert resolver emits render intent, not frames.
 *
 * Explicitly out of scope:
 * - Resolution layers
 * - Materialisation stages
 * - Plan-level orchestration
 * - New abstractions or refactors
 *
 * Container Decode Execution
 *    - Implement access-unit fragment execution via WebCodecs decoders.
 *    - Produce deterministic VideoFrame and AudioData buffers.
 *    - Keep decoding separate from composition and encoding.
 *
 * Composition + Materialisation Stage
 *    - Consume render intents from all contributors at a given timecode.
 *    - Resolve z-order, layering, and overlap deterministically.
 *    - Allocate VideoFrame and AudioData buffers.
 *    - This is the first stage where frames exist.
 *
 * Encode Stage
 *    - Consume composed VideoFrame and AudioData buffers.
 *    - Encode via WebCodecs into compressed access units.
 *
 * Export Stage
 *    - Package encoded access units into an MP4 container.
 *
 * Remove Demo Glue
 *    - Shrink or remove HTMLVideoElement usage.
 *    - Replace demo orchestration with explicit application entry points.
 *
 * Terminology Audit
 *     - Ensure "planning", "execution", "resolution", and "materialisation"
 *       are used consistently across code, tests, and documentation.
 */

import { Timeline } from "./src/timeline/Timeline.js";
import { Track } from "./src/timeline/Track.js";
import { Clip } from "./src/timeline/Clip.js";
import { ProceduralClip } from "./src/timeline/ProceduralClip.js";

import { resolveTextOverlayFragmentIntentAtTime } from "./src/timeline/procedural/resolvers/resolvers/textOverlayFragmentIntentResolver.js";
import { resolveImageOverlayFragmentIntentAtTime } from "./src/timeline/procedural/resolvers/resolvers/imageOverlayFragmentIntentResolver.js";

import { openContainerFromMp4 } from "./src/mux/native/demux/container/openContainerFromMp4.js";

// Only import this for current preview, which is a development pscyholgoy convenience, remove this when upgrading preview
// to future API
import { buildPrerenderPlanFromTimeline } from "./src/timeline/compileTimeline.js";

import { resolveProceduralFragmentsAtTimeFromPlan } from "./src/prerender/resolveProceduralFragmentsAtTimeFromPlan.js";
import { ExportExecutionStrategy } from "./src/prerender/strategies/ExportExecutionStrategy.js";
import { parseAudioSpecificConfigFromEsds } from "./src/mux/native/codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { Mp4BoxDemuxer } from "./src/demux/Mp4BoxDemuxer.js";
import { logEncodeDiagnostics } from "./src/app/debug/logEncodeDiagnostics.js";

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
    return {
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
            timeline = await createTimeline({ mp4Bytes });
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
        console.log("[Encode] audio decoder preflight complete");

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

    async function configureVideoEncoderForTrack({ videoEncoder, videoTrackView, exportFps }) {
        const sourceWidth =
            videoTrackView?.containerMeta?.codedWidth ??
            videoTrackView?.codecConfig?.codedWidth ??
            1080;
        const sourceHeight =
            videoTrackView?.containerMeta?.codedHeight ??
            videoTrackView?.codecConfig?.codedHeight ??
            1920;
        const sourceAspect = sourceWidth > 0 && sourceHeight > 0
            ? sourceWidth / sourceHeight
            : (16 / 9);
        const FORCE_DEBUG_RESOLUTION = true;
        const DEBUG_FORCED_RESOLUTION = { width: 720, height: 1280 };

        const toEven = (value) => {
            const rounded = Math.max(2, Math.round(value));
            return rounded % 2 === 0 ? rounded : rounded - 1;
        };

        const makeResolutionFromHeight = (height) => {
            const h = toEven(height);
            const w = toEven(h * sourceAspect);
            return { width: w, height: h };
        };

        const resolutionLadder = FORCE_DEBUG_RESOLUTION
            ? [DEBUG_FORCED_RESOLUTION]
            : [
                {
                    width: toEven(Math.min(sourceWidth, 1920)),
                    height: toEven(Math.min(sourceHeight, 1080))
                },
                makeResolutionFromHeight(1280),
                makeResolutionFromHeight(960),
                makeResolutionFromHeight(720),
                makeResolutionFromHeight(540),
                { width: 640, height: 360 }
            ];

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
                console.log("[Encode] video encoder configured", {
                    codec: candidate.codec,
                    latencyMode: candidate.latencyMode ?? "quality",
                    width: candidate.width,
                    height: candidate.height,
                    bitrate: candidate.bitrate
                });
                return candidate;
            } catch {
                // Try next candidate.
            }
        }

        throw new Error("VideoEncoder could not be configured for export.");
    }

    async function configureVideoDecoderForTrack({
        videoDecoder,
        videoTrackView
    }) {
        const sourceVideoCodec = videoTrackView.codecConfig.codec;
        const avcC = videoTrackView.codecConfig.avcC;
        const decodeVideoCodec = (sourceVideoCodec === "avc1" && avcC instanceof Uint8Array && avcC.length >= 4)
            ? `avc1.${avcC[1].toString(16).padStart(2, "0").toUpperCase()}${avcC[2].toString(16).padStart(2, "0").toUpperCase()}${avcC[3].toString(16).padStart(2, "0").toUpperCase()}`
            : sourceVideoCodec;

        const candidate = {
            codec: decodeVideoCodec,
            description: avcC,
            hardwareAcceleration: "prefer-software"
        };

        if (typeof VideoDecoder.isConfigSupported === "function") {
            const support = await VideoDecoder.isConfigSupported(candidate);
            if (!support.supported) {
                throw new Error(`VideoDecoder does not support software-preferred config (codec=${decodeVideoCodec}).`);
            }
        }

        videoDecoder.configure(candidate);
        console.log("[Encode] video decoder configured", {
            codec: candidate.codec,
            hardwareAcceleration: candidate.hardwareAcceleration
        });
        return candidate;
    }

    function createSharedRenderExecutionContext({
        videoDecoder,
        audioDecoder,
        getVideoDecoderError,
        getAudioDecoderError,
        decodedVideoFrames,
        decodedAudioData,
        timecodeFragmentIntentResolvers,
        timeline,
        exportFps,
        configuredVideoEncoderConfig
    }) {
        return {
            videoDecoder: {
                decode(chunk) {
                    const videoDecoderError = getVideoDecoderError();
                    if (videoDecoderError) {
                        throw Object.assign(
                            new Error("videoDecoder.decode called after decoder failure"),
                            { cause: videoDecoderError }
                        );
                    }
                    try {
                        videoDecoder.decode(chunk);
                    } catch (error) {
                        console.error("videoDecoder.decode threw", error);
                        throw error;
                    }
                },
                async flush() {
                    const videoDecoderError = getVideoDecoderError();
                    if (videoDecoderError) {
                        throw Object.assign(
                            new Error("videoDecoder.flush called after decoder failure"),
                            { cause: videoDecoderError }
                        );
                    }
                    try {
                        const flushStart = performance.now();
                        let lastDecodedOutputCount = decodedVideoFrames.length;
                        let lastProgressAt = performance.now();
                        let lastStallLogAt = 0;
                        const heartbeat = setInterval(() => {
                            const decodedOutputCount = decodedVideoFrames.length;
                            if (decodedOutputCount !== lastDecodedOutputCount) {
                                lastDecodedOutputCount = decodedOutputCount;
                                lastProgressAt = performance.now();
                            }
                            const now = performance.now();
                            const noProgressMs = now - lastProgressAt;
                            const isStalled = noProgressMs >= 3000;
                            if (isStalled && (now - lastStallLogAt) >= 5000) {
                                lastStallLogAt = now;
                                console.warn("[VideoDecoder.flush][STALLED]", {
                                    elapsedMs: Math.round(now - flushStart),
                                    decodeQueueSize: videoDecoder.decodeQueueSize,
                                    decodedOutputCount,
                                    noProgressMs: Math.round(noProgressMs),
                                    hasDecoderError: !!getVideoDecoderError()
                                });
                            }
                        }, 2000);

                        try {
                            await videoDecoder.flush();
                        } finally {
                            clearInterval(heartbeat);
                        }
                    } catch (error) {
                        console.error("videoDecoder.flush threw", error);
                        throw error;
                    }
                },
                getDecodedOutputs() {
                    return decodedVideoFrames;
                },
                getLastError() {
                    return getVideoDecoderError();
                },
                get decodeQueueSize() {
                    return videoDecoder.decodeQueueSize;
                }
            },
            audioDecoder: {
                decode(chunk) {
                    const audioDecoderError = getAudioDecoderError();
                    if (audioDecoderError) {
                        throw Object.assign(
                            new Error("audioDecoder.decode called after decoder failure"),
                            { cause: audioDecoderError }
                        );
                    }
                    try {
                        audioDecoder.decode(chunk);
                    } catch (error) {
                        console.error("audioDecoder.decode threw", error);
                        throw error;
                    }
                },
                async flush() {
                    const audioDecoderError = getAudioDecoderError();
                    if (audioDecoderError) {
                        throw Object.assign(
                            new Error("audioDecoder.flush called after decoder failure"),
                            { cause: audioDecoderError }
                        );
                    }
                    try {
                        await audioDecoder.flush();
                    } catch (error) {
                        console.error("audioDecoder.flush threw", error);
                        throw error;
                    }
                },
                getDecodedOutputs() {
                    return decodedAudioData;
                },
                getLastError() {
                    return getAudioDecoderError();
                },
                get decodeQueueSize() {
                    return audioDecoder.decodeQueueSize;
                }
            },
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
                    fps: exportFps,
                    sampleRate: 48_000,
                    channels: 2
                },
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

    encodeBtn.onclick = async () => {
        let failedStage = "init";
        const encodeStartedAt = performance.now();
        try {
            failedStage = "validate";
            if (!timeline) {
                throw new Error("Timeline not ready. Load a video source first.");
            }
            const tStart = performance.now();
            console.log("[Encode] start");
            if (typeof VideoEncoder !== "function" || typeof AudioEncoder !== "function") {
                throw new Error("WebCodecs VideoEncoder/AudioEncoder is not available in this browser.");
            }
            if (typeof VideoDecoder !== "function" || typeof AudioDecoder !== "function") {
                throw new Error("WebCodecs VideoDecoder/AudioDecoder is not available in this browser.");
            }

            failedStage = "plan";
            const exportFps = PRE_RENDER_FPS;
            const exportRange = { startSeconds: 0, endSeconds: 10 };

            const prerenderPlan = buildPrerenderPlanFromTimeline({ timeline });
            console.log("[Encode] prerender plan ready", {
                fragmentCount: prerenderPlan.fragments.length
            });

            failedStage = "track_select";
            const videoTrackView = timeline.tracks
                .flatMap(track => track.clips)
                .map(clip => clip.trackView)
                .find(view => view && view.mediaType === "video" && view.codecConfig);

            const audioTrackView = timeline.tracks
                .flatMap(track => track.clips)
                .map(clip => clip.trackView)
                .find(view => view && view.mediaType === "audio" && view.codecConfig);

            if (!videoTrackView) {
                throw new Error("No container-backed video asset found on timeline.");
            }
            if (!audioTrackView) {
                throw new Error("No container-backed audio asset found on timeline.");
            }

            const videoEncodedChunks = [];
            const audioEncodedChunks = [];
            let videoDecoderConfig = null;
            let audioDecoderConfig = null;
            const decodedVideoFrames = [];
            const decodedAudioData = [];
            let videoDecoderError = null;
            let audioDecoderError = null;
            failedStage = "decoder_config_video";
            const videoDecoder = new VideoDecoder({
                output(frame) {
                    decodedVideoFrames.push(frame);
                },
                error(error) {
                    console.error("VideoDecoder error", error);
                    videoDecoderError = error;
                }
            });
            await configureVideoDecoderForTrack({
                videoDecoder,
                videoTrackView
            });

            failedStage = "decoder_config_audio";
            const audioDecoder = new AudioDecoder({
                output(audioData) {
                    decodedAudioData.push(audioData);
                },
                error(error) {
                    console.error("AudioDecoder error", error);
                    audioDecoderError = error;
                }
            });

            await configureAudioDecoderForTrack({
                audioDecoder,
                audioTrackView
            });

            failedStage = "encoder_config_video";
            const videoEncoder = new VideoEncoder({
                output(chunk, metadata) {
                    videoEncodedChunks.push(chunk);
                    if (!videoDecoderConfig && metadata?.decoderConfig) {
                        videoDecoderConfig = metadata.decoderConfig;
                    }
                },
                error(error) {
                    console.error("VideoEncoder error", error);
                    throw error;
                }
            });

            const configuredVideoEncoderConfig = await configureVideoEncoderForTrack({
                videoEncoder,
                videoTrackView,
                exportFps
            });

            failedStage = "encoder_config_audio";
            const audioEncoder = new AudioEncoder({
                output(chunk, metadata) {
                    audioEncodedChunks.push(chunk);
                    if (!audioDecoderConfig && metadata?.decoderConfig) {
                        audioDecoderConfig = metadata.decoderConfig;
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

            const sharedRenderContext = createSharedRenderExecutionContext({
                videoDecoder,
                audioDecoder,
                getVideoDecoderError: () => videoDecoderError,
                getAudioDecoderError: () => audioDecoderError,
                decodedVideoFrames,
                decodedAudioData,
                timecodeFragmentIntentResolvers,
                timeline,
                exportFps,
                configuredVideoEncoderConfig
            });
            const exportExecutionContext = createExportExecutionContext({
                sharedContext: sharedRenderContext,
                videoEncoder,
                audioEncoder,
                videoEncodedChunks,
                audioEncodedChunks,
                getVideoDecoderConfig: () => videoDecoderConfig,
                getAudioDecoderConfig: () => audioDecoderConfig
            });

            const strategy = new ExportExecutionStrategy(exportExecutionContext);

            failedStage = "execute_strategy";
            const result = await strategy.execute({
                plan: prerenderPlan,
                exportRange,
                fps: exportFps,
                retainComposedFrames: false
            });
            console.log("[Encode] strategy execution complete");

            if (runtimeConfig.debug.enableEncodeDiagnostics) {
                logEncodeDiagnostics({
                    videoEncodedChunks,
                    audioEncodedChunks,
                    result,
                    exportRange,
                    prerenderPlan
                });
            }

            failedStage = "finalize_output";
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

            console.log("Encode complete", {
                bytes: result.mp4Bytes.length,
                videoChunks: videoEncodedChunks.length,
                audioChunks: audioEncodedChunks.length,
                elapsedMs: Math.round(performance.now() - tStart)
            });
            console.log("[Encode][SUMMARY]", {
                ok: true,
                failedStage: null,
                elapsedMs: Math.round(performance.now() - encodeStartedAt)
            });
        } catch (error) {
            console.error("Encode/export failed", error);
            console.error("[Encode][SUMMARY]", {
                ok: false,
                failedStage,
                elapsedMs: Math.round(performance.now() - encodeStartedAt),
                errorName: error?.name ?? "Error",
                errorMessage: error?.message ?? String(error)
            });
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
async function createTimeline({ mp4Bytes }) {
    if (!(mp4Bytes instanceof Uint8Array) || mp4Bytes.length === 0) {
        throw new Error("createTimeline: mp4Bytes must be a non-empty Uint8Array");
    }
    const transcriptOverlayItems = await loadTimelineTextOverlays();
    const imageOverlayItems = await loadTimelineImageOverlays();

    const container = openContainerFromMp4({ mp4Bytes });
    const nativeTrackViews = container.createTrackViews();

    // Temporary stability policy:
    // force mp4box for video demux until native demux timing issues are fixed.
    const selectedVideoDemuxer = "mp4box";

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

    return {
        mediaType: "video",
        containerMeta: {
            trackTimescale: 1_000_000,
            codedWidth: videoTrack.track_width,
            codedHeight: videoTrack.track_height
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
    ...TimelineCompiler
};
