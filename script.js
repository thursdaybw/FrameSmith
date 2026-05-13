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
import { drawRenderIntentsOnCanvas } from "./src/composition/composeAtTime.js";
import { ExportExecutionStrategy } from "./src/prerender/strategies/ExportExecutionStrategy.js?v=2026-02-15-1";
import { createContainerWebCodecsDecodePort } from "./src/prerender/decodePorts/createContainerWebCodecsDecodePort.js";
import { parseAudioSpecificConfigFromEsds } from "./src/mux/native/codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { logEncodeDiagnostics } from "./src/app/debug/logEncodeDiagnostics.js";
import { EncodePipelineRun } from "./src/app/encode/EncodePipelineRun.js";
import {
    createEncodeCapacityProfile,
    readEncodeCapacityEnvironment,
    resolveDecodeChunkSecondsForCapacityProfile
} from "./src/app/encode/EncodeCapacityProfile.js";
import { encodePcm16WavFromAudioBuffer } from "./src/audio/encodePcm16Wav.js";
import { createTimelineFromPreparedAssets } from "./src/engine/createTimelineFromPreparedAssets.js";
import { fetchJsonOrThrow } from "./src/network/fetchJsonOrThrow.js";
import { readBrowserTranscriptionCapabilities } from "./src/transcription/readBrowserTranscriptionCapabilities.js";
import { selectTranscriptionClient } from "./src/transcription/selectTranscriptionClient.js";
import { createServerWhisperTranscriptionClient } from "./src/transcription/server/createServerWhisperTranscriptionClient.js";
import { createLocalBrowserTranscriptionClient } from "./src/transcription/local/createLocalBrowserTranscriptionClient.js";
import {
    mergeFramesmithRecoverySnapshot,
    hasFramesmithRecoveryTask,
    hasFramesmithRecoveryTranscript,
    matchesFramesmithRecoverySource
} from "./src/app/recovery/FramesmithRecoverySnapshot.js";
import { createLocalStorageFramesmithRecoveryStore } from "./src/app/recovery/LocalStorageFramesmithRecoveryStore.js";
import {
    buildTextOverlayItemsFromWhisperJson,
    loadTimelineImageOverlays,
    loadTimelineTextOverlays,
    setRuntimeTranscriptOverlayItems,
    clearRuntimeTranscriptOverlayItems
} from "./src/engine/engineOverlays.js";

const DEFAULT_OUTPUT_WIDTH = 720;
const DEFAULT_OUTPUT_HEIGHT = 1280;
const DEFAULT_PRE_RENDER_FPS = 30;

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

function deriveFpsFromTrackViewTiming(trackView) {
    if (!trackView || typeof trackView.sampleCount !== "number" || trackView.sampleCount < 2) {
        return null;
    }
    const timing = summarizeTrackViewTiming(trackView);
    if (!Number.isFinite(timing?.spanUs) || timing.spanUs <= 0) {
        return null;
    }
    const frames = trackView.sampleCount;
    const fps = ((frames - 1) * 1_000_000) / timing.spanUs;
    if (!Number.isFinite(fps) || fps <= 0) {
        return null;
    }
    const clamped = Math.max(12, Math.min(60, fps));
    return Math.round(clamped * 1000) / 1000;
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

function resolveDecodeChunkSecondsForExportRange(exportRange) {
    const startSeconds = Number(exportRange?.startSeconds);
    const endSeconds = Number(exportRange?.endSeconds);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
        return null;
    }
    const durationSeconds = endSeconds - startSeconds;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return null;
    }
    if (durationSeconds <= 180) {
        return 4.0;
    }
    return null;
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
    const videoDemuxer = "native";
    const fixtureUrl = searchParams.get("fixture") || searchParams.get("fixtureUrl");
    const fixtureAutoEncodeOnLoad =
        searchParams.get("fixtureAutoEncode") === "1" ||
        searchParams.get("autoEncode") === "1";
    const transcriptionBaseUrl = searchParams.get("transcriptionBaseUrl") || "";
    const transcriptionMode = searchParams.get("transcriptionMode") || "auto";
    const transcriptionVideoId =
        searchParams.get("transcriptionVideoId") ||
        searchParams.get("videoId") ||
        "";
    const forcedEncodeCapacityProfile =
        searchParams.get("encodeCapacityProfile") ||
        searchParams.get("encodeProfile") ||
        "";
    return {
        demux: {
            videoDemuxer
        },
        output: {
            width: DEFAULT_OUTPUT_WIDTH,
            height: DEFAULT_OUTPUT_HEIGHT
        },
        testing: {
            fixtureUrl,
            fixtureAutoEncodeOnLoad
        },
        transcription: {
            baseUrl: transcriptionBaseUrl,
            videoId: transcriptionVideoId,
            mode: transcriptionMode
        },
        debug: {
            enableEncodeDiagnostics: searchParams.get("encodeDiagnostics") !== "0"
        },
        encodeCapacity: {
            forcedProfile: forcedEncodeCapacityProfile
        }
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    ensureCaptionFontLoaded().catch((error) => {
        console.warn("[TextOverlay] caption font load failed", error);
    });
    const runtimeConfig = readRuntimeConfig();

    // -------------------------------------------------
    // Pre-render timing configuration
    // -------------------------------------------------
    const PRE_RENDER_FPS = DEFAULT_PRE_RENDER_FPS;
    const PRE_RENDER_FRAME_DURATION_US = Math.floor(1_000_000 / PRE_RENDER_FPS);
    const ENCODE_STAGE_PROGRESS = Object.freeze({
        validate: { label: "Validating…", percent: 2 },
        plan: { label: "Planning…", percent: 6 },
        track_select: { label: "Preparing source…", percent: 12 },
        decoder_config_audio: { label: "Configuring audio…", percent: 56 },
        decoder_config_video: { label: "Configuring video…", percent: 62 },
        encoder_config_video: { label: "Preparing encoders…", percent: 68 },
        execute_strategy: { label: "Encoding…", percent: 72 },
        finalize_output: { label: "Finalizing…", percent: 97 }
    });

    const previewBtn = document.getElementById("previewBtn");
    const transcribeBtn = document.getElementById("transcribeBtn");
    const showTranscriptBtn = document.getElementById("showTranscriptBtn");
    const encodeBtn = document.getElementById("encodeBtn");
    const exportBtn = document.getElementById("exportBtn");
    const videoFileInput = document.getElementById("videoFileInput");
    const videoSourceStatus = document.getElementById("videoSourceStatus");
    const transcriptionRunStatus = document.getElementById("transcriptionRunStatus");
    const encodeRunStatus = document.getElementById("encodeRunStatus");
    const encodeDiagnosticsPanel = document.getElementById("encodeDiagnosticsPanel");
    const transcriptPanel = document.getElementById("transcriptPanel");
    const transcriptPanelText = document.getElementById("transcriptPanelText");
    const transcriptPanelCloseBtn = document.getElementById("transcriptPanelCloseBtn");
    const closeTranscriptPanelBtn = document.getElementById("closeTranscriptPanelBtn");
    const copyTranscriptBtn = document.getElementById("copyTranscriptBtn");
    const copyTranscriptBtnDefaultLabel = copyTranscriptBtn?.textContent || "Copy";

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
    let isEncodeInProgress = false;
    let isTranscribeInProgress = false;
    let currentEncodeStageName = "init";
    let currentEncodeCapacityProfile = null;
    let lastEncodedVideoProgressChunkCount = 0;
    let lastEncodedAudioProgressChunkCount = 0;
    let previewAnimationFrameId = null;
    let previewPlan = null;
    let lastWhisperAudioSourceKey = null;
    let latestTranscriptText = "";
    let copyFeedbackTimeoutId = null;

    const setHasLoadedSourceUiState = (hasSource) => {
        document.body.classList.toggle("has-source", !!hasSource);
    };

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

    function summarizeCurrentSourceForEncodeProfile(exportRange, exportFps) {
        const durationSeconds = Number(exportRange?.endSeconds) - Number(exportRange?.startSeconds);
        return {
            sourceBytes: Number.isFinite(cachedSelectedVideo?.bytes?.length)
                ? cachedSelectedVideo.bytes.length
                : null,
            sourceDurationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
                ? Number(durationSeconds.toFixed(3))
                : null,
            estimatedOutputFrames: Number.isFinite(durationSeconds) && durationSeconds > 0
                ? Math.ceil(durationSeconds * exportFps)
                : null
        };
    }

    function selectEncodeCapacityProfileForCurrentRun() {
        const environment = readEncodeCapacityEnvironment({
            navigatorRef: navigator,
            matchMediaRef: window.matchMedia?.bind(window)
        });
        const profile = createEncodeCapacityProfile({
            environment,
            defaults: {
                outputWidth: DEFAULT_OUTPUT_WIDTH,
                outputHeight: DEFAULT_OUTPUT_HEIGHT,
                fps: PRE_RENDER_FPS,
                decodeChunkSeconds: null
            },
            forcedProfile: runtimeConfig.encodeCapacity.forcedProfile
        });

        currentEncodeCapacityProfile = profile;
        runtimeConfig.output.width = profile.outputWidth;
        runtimeConfig.output.height = profile.outputHeight;

        const exportRange = timeline ? deriveExportRangeFromTimeline(timeline) : null;
        const sourceSummary = summarizeCurrentSourceForEncodeProfile(exportRange, profile.fps);
        emitEncodeSignal({
            label: "[Encode][CAPACITY_PROFILE]",
            payload: {
                name: profile.name,
                reason: profile.reason,
                outputWidth: profile.outputWidth,
                outputHeight: profile.outputHeight,
                fps: profile.fps,
                decodeChunkSeconds: profile.decodeChunkSeconds,
                ...sourceSummary,
                ...profile.diagnostics
            }
        });
        return profile;
    }

    function buildEncodeCapacityProfileSummary() {
        if (!currentEncodeCapacityProfile) {
            return null;
        }
        return {
            name: currentEncodeCapacityProfile.name,
            reason: currentEncodeCapacityProfile.reason,
            outputWidth: currentEncodeCapacityProfile.outputWidth,
            outputHeight: currentEncodeCapacityProfile.outputHeight,
            fps: currentEncodeCapacityProfile.fps,
            decodeChunkSeconds: currentEncodeCapacityProfile.decodeChunkSeconds
        };
    }

    function maybeEmitEncodedChunkProgress({
        videoEncodedChunks,
        audioEncodedChunks
    }) {
        const videoChunkCount = videoEncodedChunks.length;
        const audioChunkCount = audioEncodedChunks.length;
        const shouldEmitForVideo =
            videoChunkCount > lastEncodedVideoProgressChunkCount &&
            videoChunkCount > 0 &&
            videoChunkCount % 60 === 0;
        const shouldEmitForAudio =
            audioChunkCount > lastEncodedAudioProgressChunkCount &&
            audioChunkCount > 0 &&
            audioChunkCount % 120 === 0;
        if (!shouldEmitForVideo && !shouldEmitForAudio) {
            return;
        }
        if (shouldEmitForVideo) {
            lastEncodedVideoProgressChunkCount = videoChunkCount;
        }
        if (shouldEmitForAudio) {
            lastEncodedAudioProgressChunkCount = audioChunkCount;
        }
        emitEncodeSignal({
            label: "[Encode][CHUNKS]",
            payload: {
                stage: currentEncodeStageName,
                videoChunkCount,
                audioChunkCount
            }
        });
    }

    const setWorkflowEnabled = (enabled) => {
        const disabled = !enabled || isEncodeInProgress || isTranscribeInProgress;
        previewBtn.disabled = disabled;
        if (transcribeBtn) {
            transcribeBtn.disabled = disabled;
        }
        encodeBtn.disabled = disabled;
        if (!enabled || isEncodeInProgress) {
            exportBtn.disabled = true;
        }
    };

    const setEncodeRunUiState = (isRunning) => {
        if (!encodeRunStatus) {
            return;
        }
        encodeRunStatus.textContent = "Preparing…";
        encodeRunStatus.style.display = isRunning ? "inline-flex" : "none";
    };

    const setEncodeRunProgressPercent = (percent) => {
        if (!encodeRunStatus) {
            return;
        }
        if (!Number.isFinite(percent)) {
            encodeRunStatus.textContent = "Encoding…";
            return;
        }
        const bounded = Math.max(0, Math.min(100, Math.round(percent)));
        encodeRunStatus.textContent = `Encoding… ${bounded}%`;
    };

    const setEncodeRunStageStatus = (stageName) => {
        currentEncodeStageName = stageName;
        if (!encodeRunStatus) {
            return;
        }
        const stageView = ENCODE_STAGE_PROGRESS[stageName];
        if (!stageView) {
            encodeRunStatus.textContent = "Preparing…";
            return;
        }
        if (stageName === "execute_strategy") {
            encodeRunStatus.textContent = `${stageView.label} ${stageView.percent}%`;
            return;
        }
        encodeRunStatus.textContent = stageView.label;
    };

    const setTranscriptionRunBadge = ({
        visible,
        message = "Transcribe…",
        tone = "working"
    }) => {
        if (!transcriptionRunStatus) {
            return;
        }
        transcriptionRunStatus.style.display = visible ? "inline-flex" : "none";
        transcriptionRunStatus.textContent = message;
        transcriptionRunStatus.classList.toggle("done", tone === "done");
        transcriptionRunStatus.classList.toggle("error", tone === "error");
    };

    const setTranscriptionStageStatus = (stage, detail = "") => {
        const stageMap = {
            prepare_audio: { percent: 10, label: "Preparing audio" },
            create_task: { percent: 25, label: "Creating task" },
            upload_audio: { percent: 45, label: "Uploading audio" },
            queue: { percent: 55, label: "Queueing job" },
            polling: { percent: 70, label: "Waiting for worker" },
            apply_transcript: { percent: 92, label: "Applying captions" },
            local_transcription: { percent: 55, label: "Running local transcription" },
            server_transcription: { percent: 55, label: "Running server transcription" },
            done: { percent: 100, label: "Captions ready" }
        };
        const view = stageMap[stage];
        if (!view) {
            setTranscriptionRunBadge({
                visible: true,
                message: "Transcribe…",
                tone: "working"
            });
            return;
        }
        const suffix = detail ? ` (${detail})` : "";
        const tone = stage === "done" ? "done" : "working";
        setTranscriptionRunBadge({
            visible: true,
            message: `Transcribe ${view.percent}% ${view.label}${suffix}`,
            tone
        });
    };

    const setTranscriptionErrorStatus = (detail = "") => {
        const suffix = detail ? `: ${detail}` : "";
        setTranscriptionRunBadge({
            visible: true,
            message: `Transcribe failed${suffix}`,
            tone: "error"
        });
    };

    function openTranscriptPanel() {
        if (!transcriptPanel || !showTranscriptBtn) return;
        const hasTranscript = typeof latestTranscriptText === "string" && latestTranscriptText.trim().length > 0;
        if (!hasTranscript) return;
        transcriptPanel.classList.add("visible");
        transcriptPanel.setAttribute("aria-modal", "true");
    }

    function closeTranscriptPanel() {
        if (!transcriptPanel) return;
        transcriptPanel.classList.remove("visible");
        transcriptPanel.setAttribute("aria-modal", "false");
    }

    const resetCopyBtnLabel = () => {
        if (!copyTranscriptBtn) return;
        if (copyFeedbackTimeoutId !== null) {
            window.clearTimeout(copyFeedbackTimeoutId);
            copyFeedbackTimeoutId = null;
        }
        copyTranscriptBtn.textContent = copyTranscriptBtnDefaultLabel;
    };

    const updateTranscriptPanelDisplayText = (text) => {
        if (!transcriptPanelText) return;
        const normalized = typeof text === "string" ? text : "";
        transcriptPanelText.textContent = normalized.length > 0 ? normalized : "Transcript not available yet.";
    };

    async function writeTextToClipboard(text) {
        if (typeof text !== "string" || text.length === 0) {
            return false;
        }
        if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.select();
        let success = false;
        try {
            success = document.execCommand("copy");
        } catch {
            success = false;
        }
        document.body.removeChild(textarea);
        return success;
    }

    const updateTranscriptControlsState = () => {
        const hasTranscript = typeof latestTranscriptText === "string" && latestTranscriptText.trim().length > 0;
        const disabled = !hasTranscript;
        if (showTranscriptBtn) {
            showTranscriptBtn.disabled = disabled;
        }
        if (copyTranscriptBtn) {
            copyTranscriptBtn.disabled = disabled;
            resetCopyBtnLabel();
        }
        if (disabled) {
            closeTranscriptPanel();
        }
    };

    const setLatestTranscriptText = (text) => {
        latestTranscriptText = typeof text === "string" ? text : "";
        updateTranscriptPanelDisplayText(latestTranscriptText);
        updateTranscriptControlsState();
    };

    function buildTranscriptTextFromWhisperJson(whisperJson) {
        if (!whisperJson || !Array.isArray(whisperJson.segments)) {
            return "";
        }
        const lines = [];
        for (const segment of whisperJson.segments) {
            const trimmed = typeof segment?.text === "string" ? segment.text.trim() : "";
            if (trimmed.length > 0) {
                lines.push(trimmed);
                continue;
            }
            if (Array.isArray(segment?.words)) {
                const wordLine = segment.words
                    .map((word) => (typeof word?.word === "string" ? word.word.trim() : ""))
                    .filter(Boolean)
                    .join(" ");
                if (wordLine.length > 0) {
                    lines.push(wordLine);
                }
            }
        }
        return lines.join("\n");
    }

    const setLatestTranscriptFromJson = (whisperJson) => {
        if (!whisperJson) {
            setLatestTranscriptText("");
            return;
        }
        const text = buildTranscriptTextFromWhisperJson(whisperJson);
        setLatestTranscriptText(text);
    };

    function buildTranscriptTextFromOverlayItems(overlayItems) {
        if (!Array.isArray(overlayItems) || overlayItems.length === 0) {
            return "";
        }
        const lines = overlayItems.map((item) => {
            if (!Array.isArray(item?.words) || item.words.length === 0) {
                return "";
            }
            return item.words
                .map((word) => (typeof word?.text === "string" ? word.text.trim() : ""))
                .filter(Boolean)
                .join(" ");
        });
        return lines.filter(Boolean).join("\n");
    }

    const setLatestTranscriptFromOverlayItems = (overlayItems, fallbackJson) => {
        const text = buildTranscriptTextFromOverlayItems(overlayItems);
        if (text.trim().length > 0) {
            setLatestTranscriptText(text);
            return;
        }
        setLatestTranscriptFromJson(fallbackJson);
    };

    function readFramesmithRecoverySnapshot() {
        return recoveryStore.readSnapshot();
    }

    function saveFramesmithRecoverySnapshot(patch) {
        const previous = readFramesmithRecoverySnapshot();
        const snapshot = mergeFramesmithRecoverySnapshot(previous, patch);
        const saved = recoveryStore.saveSnapshot(snapshot) || snapshot;
        window.__framesmithRecoverySnapshot = saved;
        return saved;
    }

    function clearFramesmithRecoverySnapshot() {
        recoveryStore.clearSnapshot();
        window.__framesmithRecoverySnapshot = null;
    }

    function currentVideoSourceDescriptor() {
        return {
            key: typeof cachedSelectedVideo?.fileKey === "string"
                ? cachedSelectedVideo.fileKey
                : null,
            name: typeof cachedSelectedVideo?.fileName === "string"
                ? cachedSelectedVideo.fileName
                : null,
            size: Number.isFinite(cachedSelectedVideo?.fileSize)
                ? cachedSelectedVideo.fileSize
                : null,
            lastModified: Number.isFinite(cachedSelectedVideo?.fileLastModified)
                ? cachedSelectedVideo.fileLastModified
                : null
        };
    }

    function buildBaseRecoveryPatch() {
        const source = currentVideoSourceDescriptor();
        const patch = {
            baseUrl: resolveTranscriptionBaseUrl()
        };
        if (source.key || source.name || source.size !== null || source.lastModified !== null) {
            patch.videoSourceKey = source.key;
            patch.videoSourceName = source.name;
            patch.videoSourceSize = source.size;
            patch.videoSourceLastModified = source.lastModified;
        }
        return patch;
    }

    function saveTranscriptionRecoverySnapshot(patch = {}) {
        return saveFramesmithRecoverySnapshot({
            ...buildBaseRecoveryPatch(),
            ...patch
        });
    }

    function recoverySnapshotHasSourceDescriptor(snapshot) {
        return typeof snapshot?.videoSourceKey === "string" ||
            typeof snapshot?.videoSourceName === "string" ||
            Number.isFinite(snapshot?.videoSourceSize) ||
            Number.isFinite(snapshot?.videoSourceLastModified);
    }

    function shouldRestoreRecoveredTranscriptForSource(snapshot, source) {
        if (!hasFramesmithRecoveryTranscript(snapshot)) {
            return false;
        }
        if (matchesFramesmithRecoverySource(snapshot, source)) {
            return true;
        }
        // Older recovery saves could lose the source fingerprint during startup
        // refresh. Keep the transcript recoverable instead of clearing the only
        // durable result before the user can preview or export it.
        return !recoverySnapshotHasSourceDescriptor(snapshot);
    }

    async function restoreTranscriptArtifactsFromRecoverySnapshot(snapshot, {
        refreshTimeline = false
    } = {}) {
        if (!hasFramesmithRecoveryTranscript(snapshot)) {
            return false;
        }

        const overlayItems = Array.isArray(snapshot.overlayItems) ? snapshot.overlayItems : [];
        const whisperJson = snapshot.whisperJson || null;
        if (overlayItems.length > 0) {
            setRuntimeTranscriptOverlayItems(overlayItems);
            window.__runtimeTranscriptOverlayItems = overlayItems;
            window.__runtimeWhisperTranscriptJson = whisperJson;
            setLatestTranscriptFromOverlayItems(overlayItems, whisperJson);
        } else if (whisperJson) {
            await applyWhisperTranscriptToTimeline({
                whisperJson,
                sourceLabel: `recovery:${snapshot.taskId || "unknown"}`
            });
        } else {
            setLatestTranscriptText(snapshot.transcriptText || "");
        }

        if (refreshTimeline && cachedSelectedVideo?.bytes instanceof Uint8Array) {
            await initializeTimelineFromBytes(cachedSelectedVideo.bytes);
            previewPlan = null;
            renderPreviewOverlayAtCurrentTime();
        }

        return true;
    }

    async function restoreFramesmithRecoveryStateOnLoad() {
        if (runtimeConfig.testing.fixtureUrl) {
            return;
        }

        const snapshot = readFramesmithRecoverySnapshot();
        window.__framesmithRecoverySnapshot = snapshot;
        if (!snapshot || (!hasFramesmithRecoveryTask(snapshot) && !hasFramesmithRecoveryTranscript(snapshot))) {
            return;
        }

        if (snapshot.taskId) {
            window.__lastWhisperDrupalTaskId = snapshot.taskId;
        }
        await restoreTranscriptArtifactsFromRecoverySnapshot(snapshot);
        if (snapshot.statusPayload) {
            window.__lastWhisperTranscriptionPollState = {
                taskId: snapshot.taskId,
                recoveredAt: Date.now(),
                status: snapshot.taskStatus || "",
                lastStatusPayload: snapshot.statusPayload,
                recoveryPolling: false,
                transportFailureCount: 0
            };
        }
        if (snapshot.transcriptionResult) {
            window.__lastWhisperTranscriptionResult = snapshot.transcriptionResult;
        }

        const taskLabel = snapshot.taskId ? `task ${shortTaskId(snapshot.taskId)}` : "saved transcript";
        if (hasFramesmithRecoveryTranscript(snapshot)) {
            setVideoSourceStatus(
                `Recovered ${taskLabel}. Re-select the source video to preview or export.`
            );
        } else {
            setVideoSourceStatus(`Recovered transcription ${taskLabel}; checking status...`);
        }

        if (!snapshot.taskId) {
            return;
        }

        fetchAndApplyWhisperTranscriptFromTask({
            taskId: snapshot.taskId,
            transcriptionBaseUrl: snapshot.baseUrl || undefined,
            waitForJson: true
        }).then((result) => {
            saveTranscriptionRecoverySnapshot({
                taskId: snapshot.taskId,
                taskStatus: String(result?.statusPayload?.status || "completed"),
                statusPayload: result?.statusPayload || null,
                transcriptFetchResult: result,
                whisperJson: result?.whisperJson || null,
                overlayItems: window.__runtimeTranscriptOverlayItems || [],
                transcriptText: latestTranscriptText,
                transcriptReady: true,
                lastError: null
            });
            setVideoSourceStatus(
                cachedSelectedVideo?.bytes instanceof Uint8Array
                    ? "Captions ready"
                    : `Recovered captions for task ${shortTaskId(snapshot.taskId)}. Re-select the source video to preview or export.`
            );
        }).catch((error) => {
            saveTranscriptionRecoverySnapshot({
                taskId: snapshot.taskId,
                lastError: error?.message || String(error)
            });
            console.warn("[Recovery] recovered transcription task could not be refreshed", error);
        });
    }

    updateTranscriptControlsState();

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const recoveryStore = createLocalStorageFramesmithRecoveryStore({
        logger: console
    });


    async function decodeAudioBufferFromSourceBytes(sourceBytes) {
        const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (typeof AudioContextCtor !== "function") {
            throw new Error("AudioContext is not available in this browser.");
        }
        const audioContext = new AudioContextCtor();
        try {
            const workingCopy = sourceBytes.slice();
            return await audioContext.decodeAudioData(workingCopy.buffer);
        } finally {
            if (typeof audioContext.close === "function") {
                await audioContext.close();
            }
        }
    }

    async function resampleAudioBufferForWhisper({
        audioBuffer,
        targetSampleRate,
        targetChannels
    }) {
        if (!audioBuffer) {
            throw new Error("resampleAudioBufferForWhisper: audioBuffer is required.");
        }
        const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
        const offlineContext = new OfflineAudioContext(
            targetChannels,
            frameCount,
            targetSampleRate
        );
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start(0);
        return await offlineContext.startRendering();
    }

    async function extractWhisperReadyAudioFromLoadedSource({
        targetSampleRate = 16_000,
        targetChannels = 1,
        showStatus = true
    } = {}) {
        if (!cachedSelectedVideo || !(cachedSelectedVideo.bytes instanceof Uint8Array)) {
            throw new Error("No loaded source bytes are available.");
        }
        const currentSourceKey = String(cachedSelectedVideo.fileKey || "");
        const hasCachedWhisperAudio =
            lastWhisperAudioSourceKey === currentSourceKey &&
            window.__lastWhisperAudioBlob instanceof Blob &&
            window.__lastWhisperAudioBytes instanceof Uint8Array;
        if (hasCachedWhisperAudio) {
            if (showStatus) {
                const cachedBytes = Number(window.__lastWhisperAudioBytes?.length || 0);
                const cachedMiB = cachedBytes > 0 ? ` (${(cachedBytes / (1024 * 1024)).toFixed(1)} MiB WAV)` : "";
                setVideoSourceStatus(`Extracted WAV audio ready for upload${cachedMiB}.`);
            }
            return {
                blob: window.__lastWhisperAudioBlob,
                bytes: window.__lastWhisperAudioBytes,
                meta: window.__lastWhisperAudioMeta
            };
        }

        if (showStatus) {
            setVideoSourceStatus("Extracting audio from the selected video for transcription...");
        }
        const decodedAudioBuffer = await decodeAudioBufferFromSourceBytes(cachedSelectedVideo.bytes);
        if (showStatus) {
            setVideoSourceStatus(`Converting extracted audio to ${targetSampleRate} Hz mono WAV for upload...`);
        }
        const renderedAudioBuffer = await resampleAudioBufferForWhisper({
            audioBuffer: decodedAudioBuffer,
            targetSampleRate,
            targetChannels
        });
        if (showStatus) {
            setVideoSourceStatus("Encoding transcription audio as WAV before upload...");
        }
        const wavBytes = encodePcm16WavFromAudioBuffer(renderedAudioBuffer);
        const wavBlob = new Blob([wavBytes], {
            type: "audio/wav"
        });
        window.__lastWhisperAudioBlob = wavBlob;
        window.__lastWhisperAudioBytes = wavBytes;
        window.__lastWhisperAudioMeta = {
            sampleRate: renderedAudioBuffer.sampleRate,
            channels: renderedAudioBuffer.numberOfChannels,
            durationSeconds: Number(renderedAudioBuffer.duration.toFixed(3)),
            bytes: wavBytes.length
        };
        lastWhisperAudioSourceKey = currentSourceKey;
        if (showStatus) {
            setVideoSourceStatus(`Extracted WAV audio ready for upload (${(wavBytes.length / (1024 * 1024)).toFixed(1)} MiB).`);
        }
        return {
            blob: wavBlob,
            bytes: wavBytes,
            meta: window.__lastWhisperAudioMeta
        };
    }

    function createFallbackUuid() {
        const randomHex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
        return (
            `${randomHex()}${randomHex()}-${randomHex()}-4${randomHex().slice(1)}-` +
            `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex().slice(1)}-` +
            `${randomHex()}${randomHex()}${randomHex()}`
        );
    }

    function createTranscriptionVideoId() {
        const configuredVideoId = String(runtimeConfig?.transcription?.videoId || "").trim();
        if (configuredVideoId.length > 0) {
            return configuredVideoId;
        }
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }
        return createFallbackUuid();
    }

    function resolveTranscriptionBaseUrl(explicitBaseUrl) {
        const base = String(explicitBaseUrl || runtimeConfig?.transcription?.baseUrl || "").trim();
        if (base.length > 0) {
            return base;
        }
        return window.location.origin;
    }

    function isBrowserOffline() {
        return typeof navigator !== "undefined" && navigator.onLine === false;
    }

    function createCurrentTranscriptionClient() {
        const capabilities = readBrowserTranscriptionCapabilities({
            navigatorRef: navigator
        });

        return selectTranscriptionClient({
            preferredMode: runtimeConfig.transcription.mode,
            capabilities,
            createLocalClient: createLocalBrowserTranscriptionClient,
            createServerClient: () => createServerWhisperTranscriptionClient({
                startServerTranscriptionAndPoll: startWhisperTranscriptionAndPoll
            })
        });
    }

    async function startTranscription({
        transcriptionBaseUrl,
        videoId,
        targetSampleRate = 16_000,
        targetChannels = 1
    } = {}) {
        const transcriptionClient = createCurrentTranscriptionClient();

        setVideoSourceStatus(transcriptionClient.statusMessage);
        setTranscriptionStageStatus(transcriptionClient.stageName);

        const result = await transcriptionClient.transcribe({
            transcriptionBaseUrl,
            videoId,
            targetSampleRate,
            targetChannels
        });

        return {
            ...result,
            transcriptionMode: transcriptionClient.mode,
            transcriptionSourceLabel: transcriptionClient.sourceLabel
        };
    }

    function classifyFetchFailure(error) {
        const remote = error && typeof error === "object" ? error.remote : null;
        if (remote && typeof remote === "object") {
            return {
                kind: String(remote.kind || "unknown"),
                retryable: remote.retryable !== false,
                status: typeof remote.status === "number" ? remote.status : null,
                url: typeof remote.url === "string" ? remote.url : ""
            };
        }
        const message = error && error.message ? error.message : String(error || "");
        const looksLikeNetworkFailure = /Failed to fetch|Network request failed|Load failed|NetworkError|timeout|abort/i.test(message);
        return {
            kind: isBrowserOffline() ? "offline" : (looksLikeNetworkFailure ? "network" : "unknown"),
            retryable: looksLikeNetworkFailure || isBrowserOffline(),
            status: null,
            url: ""
        };
    }

    function describeRemoteFailure(error) {
        const classification = classifyFetchFailure(error);
        if (classification.kind === "offline") {
            return "network appears offline";
        }
        if (classification.kind === "http" && classification.status !== null) {
            return `server returned HTTP ${classification.status}`;
        }
        if (classification.kind === "invalid_json") {
            return "server returned an unreadable response";
        }
        if (classification.kind === "retry_exhausted") {
            return describeRemoteFailure(error?.lastError || error?.cause || "network retry attempts were exhausted");
        }
        const message = error && error.message ? error.message : String(error || "");
        return message.length > 0 ? message : "network request failed";
    }

    function createRetryPolicy({
        maxAttempts = 3,
        baseDelayMs = 1_000,
        maxDelayMs = 30_000,
        jitterMs = 500
    } = {}) {
        return {
            maxAttempts: Math.max(1, Number(maxAttempts) || 1),
            baseDelayMs: Math.max(0, Number(baseDelayMs) || 0),
            maxDelayMs: Math.max(0, Number(maxDelayMs) || 0),
            jitterMs: Math.max(0, Number(jitterMs) || 0)
        };
    }

    function retryDelayMilliseconds(attempt, retryPolicy = {}) {
        const policy = createRetryPolicy(retryPolicy);
        const exponentialDelayMs = policy.baseDelayMs * (2 ** Math.max(0, attempt - 1));
        const jitterMs = policy.jitterMs > 0 ? Math.floor(Math.random() * policy.jitterMs) : 0;
        return Math.min(policy.maxDelayMs, exponentialDelayMs + jitterMs);
    }

    function formatRetryStatusMessage({
        subject = "Request",
        error,
        nextAttempt,
        maxAttempts,
        delayMs
    }) {
        return `${subject} failed (${describeRemoteFailure(error)}). ` +
            `Retrying ${nextAttempt}/${maxAttempts} in ${Math.round(delayMs / 1000)}s.`;
    }

    function isRetryableRemoteError(error) {
        return classifyFetchFailure(error).retryable !== false;
    }

    function createRemoteOperationExhaustedError({
        operationName,
        attempts,
        lastError
    }) {
        const error = new Error(
            `${operationName} failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ` +
            describeRemoteFailure(lastError)
        );
        error.name = "RemoteOperationExhaustedError";
        error.operationName = operationName;
        error.attempts = attempts;
        error.lastError = lastError;
        error.cause = lastError;
        error.remote = {
            kind: "retry_exhausted",
            retryable: true,
            attempts,
            lastClassification: classifyFetchFailure(lastError)
        };
        return error;
    }

    async function runRetryingRemoteOperation({
        operationName = "remote_operation",
        retryPolicy = {},
        request,
        beforeAttempt = null,
        beforeRetry = null,
        isRetryableError = isRetryableRemoteError
    }) {
        if (typeof request !== "function") {
            throw new Error("runRetryingRemoteOperation: request callback is required.");
        }
        const policy = createRetryPolicy(retryPolicy);
        let lastError = null;

        for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
            if (typeof beforeAttempt === "function") {
                await beforeAttempt({ attempt, maxAttempts: policy.maxAttempts, operationName, retryPolicy: policy });
            }
            try {
                return {
                    result: await request({ attempt, maxAttempts: policy.maxAttempts, operationName, retryPolicy: policy }),
                    attempts: attempt
                };
            } catch (error) {
                lastError = error;
                if (error && typeof error === "object") {
                    error.attempts = attempt;
                    error.operationName = operationName;
                }
                const retryable = isRetryableError(error, { attempt, maxAttempts: policy.maxAttempts, operationName, retryPolicy: policy });
                if (!retryable) {
                    throw error;
                }
                if (attempt >= policy.maxAttempts) {
                    throw createRemoteOperationExhaustedError({
                        operationName,
                        attempts: attempt,
                        lastError
                    });
                }
                const delayMs = retryDelayMilliseconds(attempt, policy);
                if (typeof beforeRetry === "function") {
                    await beforeRetry({
                        attempt,
                        nextAttempt: attempt + 1,
                        maxAttempts: policy.maxAttempts,
                        delayMs,
                        error,
                        operationName,
                        retryPolicy: policy,
                        classification: classifyFetchFailure(error)
                    });
                }
                await sleep(delayMs);
            }
        }

        throw createRemoteOperationExhaustedError({
            operationName,
            attempts: policy.maxAttempts,
            lastError
        });
    }

    async function loadWhisperJsonFromStatusPayload({
        transcriptionBaseUrl,
        statusPayload,
        taskId = ""
    }) {
        const inlineJson = statusPayload?.task?.result?.json;
        if (inlineJson && typeof inlineJson === "object") {
            return inlineJson;
        }

        const jsonUrlValue = String(
            statusPayload?.json_url ||
            statusPayload?.task?.result?.json_url ||
            ""
        ).trim();
        const resolvedBaseUrl = resolveTranscriptionBaseUrl(transcriptionBaseUrl);

        if (jsonUrlValue.length > 0) {
            const resolvedJsonUrl = new URL(jsonUrlValue, resolvedBaseUrl).toString();
            return fetchJsonOrThrow(resolvedJsonUrl, {
                method: "GET",
                credentials: "include"
            });
        }

        const resolvedTaskId = String(taskId || statusPayload?.task_id || statusPayload?.task?.task_id || "").trim();
        if (resolvedTaskId.length === 0) {
            return null;
        }

        const resultUrl = new URL("/api/framesmith/transcription/result", resolvedBaseUrl);
        resultUrl.searchParams.set("task_id", resolvedTaskId);
        const resultPayload = await fetchJsonOrThrow(resultUrl.toString(), {
            method: "GET",
            credentials: "include"
        });
        const resultJson = resultPayload?.result?.json;
        return resultJson && typeof resultJson === "object" ? resultJson : null;
    }

    async function applyWhisperTranscriptToTimeline({
        whisperJson,
        sourceLabel = "runtime-whisper"
    }) {
        const overlayItems = buildTextOverlayItemsFromWhisperJson(whisperJson);
        setRuntimeTranscriptOverlayItems(overlayItems);
        window.__runtimeTranscriptOverlayItems = overlayItems;
        window.__runtimeWhisperTranscriptJson = whisperJson;
        setLatestTranscriptFromOverlayItems(overlayItems, whisperJson);
        const recoveryPatch = {
            whisperJson,
            overlayItems,
            transcriptText: latestTranscriptText,
            transcriptReady: true,
            lastError: null
        };
        if (window.__lastWhisperDrupalTaskId) {
            recoveryPatch.taskId = window.__lastWhisperDrupalTaskId;
        }
        saveTranscriptionRecoverySnapshot(recoveryPatch);

        console.log("[Timeline][text-overlay] applied runtime transcript overlay items", {
            sourceLabel,
            itemCount: overlayItems.length
        });

        if (cachedSelectedVideo?.bytes instanceof Uint8Array) {
            await initializeTimelineFromBytes(cachedSelectedVideo.bytes);
            previewPlan = null;
            renderPreviewOverlayAtCurrentTime();
        }

        return overlayItems;
    }

    /**
     * Builds a fresh multipart body for one upload attempt.
     *
     * Mobile browsers can treat request bodies as one-shot streams once a
     * fetch attempt has started or failed. Rebuilding FormData for every retry
     * keeps chunk retry behaviour independent of those browser internals.
     */
    function createWhisperAudioChunkFormData({
        chunk,
        index,
        taskId,
        autoLaunch
    }) {
        const formData = new FormData();
        formData.append("file", chunk, `part-${index}.bin`);
        formData.append("task_id", taskId);
        formData.append("auto_launch", autoLaunch ? "1" : "0");
        return formData;
    }

    async function waitForBrowserOnline({
        message = "Network appears offline; waiting before retrying request...",
        timeoutMs = 15_000
    } = {}) {
        if (!isBrowserOffline()) {
            return;
        }
        setVideoSourceStatus(message);
        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, timeoutMs);
            window.addEventListener("online", () => {
                clearTimeout(timeout);
                resolve();
            }, { once: true });
        });
    }

    const WHISPER_UPLOAD_INITIAL_CHUNK_SIZE_BYTES = 256 * 1024;
    const WHISPER_UPLOAD_MIN_CHUNK_SIZE_BYTES = 64 * 1024;
    const WHISPER_UPLOAD_ATTEMPTS_BEFORE_RANGE_REDUCTION = 4;
    const WHISPER_UPLOAD_RANGE_REQUEST_TIMEOUT_MS = 30_000;

    function describeUploadFailure(error) {
        return describeRemoteFailure(error);
    }

    function uploadProgressPercent(uploadedBytes, totalBytes) {
        if (!totalBytes) {
            return 0;
        }
        return Math.max(0, Math.min(100, Math.floor((uploadedBytes / totalBytes) * 100)));
    }

    function createWhisperUploadId() {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function smallerUploadRangeSize(currentRangeSize) {
        return Math.max(WHISPER_UPLOAD_MIN_CHUNK_SIZE_BYTES, Math.floor(currentRangeSize / 2));
    }

    function canReduceUploadRangeSize(currentRangeSize) {
        return currentRangeSize > WHISPER_UPLOAD_MIN_CHUNK_SIZE_BYTES;
    }

    function estimateRemainingUploadRanges({ uploadedBytes, totalBytes, rangeSize }) {
        const remainingBytes = Math.max(0, totalBytes - uploadedBytes);
        return Math.max(1, Math.ceil(remainingBytes / rangeSize));
    }

    function setAdaptiveUploadStatus({
        uploadedBytes,
        totalBytes,
        rangeSize,
        message
    }) {
        const percent = uploadProgressPercent(uploadedBytes, totalBytes);
        const rangeSizeKiB = Math.max(1, Math.round(rangeSize / 1024));
        const remainingRanges = estimateRemainingUploadRanges({
            uploadedBytes,
            totalBytes,
            rangeSize
        });
        setVideoSourceStatus(
            `${message} Uploaded ${percent}% (${uploadedBytes}/${totalBytes} bytes, ` +
            `${rangeSizeKiB} KiB ranges, about ${remainingRanges} ranges remaining). ` +
            "Please keep this tab open while the audio upload completes."
        );
    }

    function createWhisperRangeUploadUrl({
        resolvedBaseUrl,
        taskId,
        uploadId,
        offset,
        size,
        totalSize
    }) {
        const uploadUrl = new URL("/api/framesmith/transcription/upload", resolvedBaseUrl);
        uploadUrl.searchParams.set("task_id", taskId);
        uploadUrl.searchParams.set("upload_id", uploadId);
        uploadUrl.searchParams.set("offset", String(offset));
        uploadUrl.searchParams.set("size", String(size));
        uploadUrl.searchParams.set("total_size", String(totalSize));
        return uploadUrl;
    }

    function createWhisperUploadRangeFailure({
        error,
        offset,
        size,
        attempts,
        uploadedBytes,
        totalBytes
    }) {
        const failure = new Error(describeUploadFailure(error));
        failure.name = "WhisperUploadRangeFailure";
        failure.cause = error;
        failure.offset = offset;
        failure.size = size;
        failure.attempts = attempts;
        failure.uploadedBytes = uploadedBytes;
        failure.totalBytes = totalBytes;
        return failure;
    }

    async function uploadWhisperAudioRangeWithRetry({
        resolvedBaseUrl,
        uploadId,
        blob,
        offset,
        rangeSize,
        taskId,
        autoLaunch,
        maxAttempts = WHISPER_UPLOAD_ATTEMPTS_BEFORE_RANGE_REDUCTION
    }) {
        const end = Math.min(offset + rangeSize, blob.size);
        const size = end - offset;
        const retryPolicy = createRetryPolicy({ maxAttempts });

        try {
            const operation = await runRetryingRemoteOperation({
                operationName: "whisper_audio_range_upload",
                retryPolicy,
                beforeAttempt: () => waitForBrowserOnline({
                    message: "Network appears offline; waiting before retrying audio upload..."
                }),
                request: async () => {
                    const chunk = blob.slice(offset, end, blob.type || "audio/wav");
                    const formData = createWhisperAudioChunkFormData({
                        chunk,
                        index: offset,
                        taskId,
                        autoLaunch
                    });
                    const uploadUrl = createWhisperRangeUploadUrl({
                        resolvedBaseUrl,
                        taskId,
                        uploadId,
                        offset,
                        size,
                        totalSize: blob.size
                    });
                    // The upload range transport must be bounded. If the mobile
                    // browser silently hangs instead of failing, the retry
                    // policy never regains control and the task stays pinned in
                    // awaiting_upload with no backend work to resume.
                    return fetchJsonOrThrow(uploadUrl.toString(), {
                        method: "POST",
                        credentials: "include",
                        body: formData
                    }, {
                        timeoutMs: WHISPER_UPLOAD_RANGE_REQUEST_TIMEOUT_MS
                    });
                },
                beforeRetry: ({ error, nextAttempt, maxAttempts: retryMaxAttempts, delayMs }) => {
                    setAdaptiveUploadStatus({
                        uploadedBytes: offset,
                        totalBytes: blob.size,
                        rangeSize,
                        message:
                            `Poor network detected; upload range at byte ${offset} failed ` +
                            `(${describeUploadFailure(error)}). Retrying ${nextAttempt}/${retryMaxAttempts} ` +
                            `in ${Math.round(delayMs / 1000)}s.`
                    });
                }
            });

            return {
                result: operation.result,
                offset,
                size,
                attempts: operation.attempts,
                uploadedBytesAfterRange: end
            };
        } catch (error) {
            throw createWhisperUploadRangeFailure({
                error,
                offset,
                size,
                attempts: typeof error?.attempts === "number" ? error.attempts : maxAttempts,
                uploadedBytes: offset,
                totalBytes: blob.size
            });
        }
    }

    function createFinalWhisperUploadFailureMessage({ taskId, failure }) {
        const uploadedBytes = failure.uploadedBytes || 0;
        const totalBytes = failure.totalBytes || 0;
        const progressPercent = uploadProgressPercent(uploadedBytes, totalBytes);
        const offset = typeof failure.offset === "number" ? failure.offset : "unknown";
        return `Audio upload could not continue after repeated network failures. ` +
            `Uploaded ${progressPercent}% (${uploadedBytes}/${totalBytes} bytes) before failing at byte ${offset}. ` +
            `Task ID: ${taskId}. Keep this tab open if you can; retry/resume is needed instead of starting over. ` +
            `Last error: ${describeUploadFailure(failure)}`;
    }

    async function reportWhisperUploadFailure({
        resolvedBaseUrl,
        taskId,
        uploadId,
        failure,
        message
    }) {
        const failureUrl = new URL("/api/framesmith/transcription/upload-failure", resolvedBaseUrl);
        const payload = {
            task_id: taskId,
            upload_id: uploadId,
            message,
            failed_offset: typeof failure.offset === "number" ? failure.offset : null,
            range_size: typeof failure.size === "number" ? failure.size : null,
            attempts: typeof failure.attempts === "number" ? failure.attempts : null
        };
        try {
            const result = await fetchJsonOrThrow(failureUrl.toString(), {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            window.__lastWhisperUploadFailureReport = result;
            return result;
        } catch (error) {
            window.__lastWhisperUploadFailureReport = {
                ok: false,
                error: describeUploadFailure(error),
                payload
            };
            console.warn("[Whisper][Drupal] upload failure report failed", error);
            return null;
        }
    }

    async function uploadWhisperAudioBlobInChunks({
        resolvedBaseUrl,
        taskId,
        blob,
        filename,
        chunkSize = WHISPER_UPLOAD_INITIAL_CHUNK_SIZE_BYTES
    }) {
        if (!(blob instanceof Blob)) {
            throw new Error("uploadWhisperAudioBlobInChunks: blob is required.");
        }
        if (!taskId) {
            throw new Error("uploadWhisperAudioBlobInChunks: taskId is required.");
        }

        const uploadId = createWhisperUploadId();
        let uploadedBytes = 0;
        let currentRangeSize = Math.max(WHISPER_UPLOAD_MIN_CHUNK_SIZE_BYTES, chunkSize);
        let finalResult = null;
        let lastFailure = null;

        while (uploadedBytes < blob.size) {
            const end = Math.min(uploadedBytes + currentRangeSize, blob.size);
            const size = end - uploadedBytes;
            const autoLaunch = end >= blob.size;
            setAdaptiveUploadStatus({
                uploadedBytes,
                totalBytes: blob.size,
                rangeSize: currentRangeSize,
                message: "Uploading audio to transcription service."
            });

            try {
                const rangeUpload = await uploadWhisperAudioRangeWithRetry({
                    resolvedBaseUrl,
                    uploadId,
                    blob,
                    offset: uploadedBytes,
                    rangeSize: currentRangeSize,
                    taskId,
                    autoLaunch
                });
                const rangeResult = rangeUpload.result;
                uploadedBytes = rangeUpload.uploadedBytesAfterRange;
                window.__lastWhisperUploadProgress = rangeResult?.upload_progress || null;
                window.__lastWhisperUploadAdaptiveState = {
                    uploadId,
                    taskId,
                    uploadedBytes,
                    totalBytes: blob.size,
                    rangeSize: currentRangeSize,
                    lastUploadedOffset: rangeUpload.offset,
                    lastUploadedSize: rangeUpload.size,
                    lastRangeAttempts: rangeUpload.attempts
                };
                saveTranscriptionRecoverySnapshot({
                    taskId,
                    taskStatus: autoLaunch ? "uploaded" : "uploading",
                    uploadProgress: window.__lastWhisperUploadProgress,
                    uploadAdaptiveState: window.__lastWhisperUploadAdaptiveState
                });
                if (autoLaunch) {
                    finalResult = rangeResult;
                }
            } catch (error) {
                lastFailure = error;
                if (!canReduceUploadRangeSize(currentRangeSize)) {
                    break;
                }
                currentRangeSize = smallerUploadRangeSize(currentRangeSize);
                window.__lastWhisperUploadAdaptiveState = {
                    uploadId,
                    taskId,
                    uploadedBytes,
                    totalBytes: blob.size,
                    rangeSize: currentRangeSize,
                    reducedRangeSizeAfterFailure: true,
                    failedOffset: error.offset,
                    restartReason: describeUploadFailure(error)
                };
                saveTranscriptionRecoverySnapshot({
                    taskId,
                    taskStatus: "upload_retrying",
                    uploadAdaptiveState: window.__lastWhisperUploadAdaptiveState,
                    lastError: describeUploadFailure(error)
                });
                setAdaptiveUploadStatus({
                    uploadedBytes,
                    totalBytes: blob.size,
                    rangeSize: currentRangeSize,
                    message:
                        "Poor network detected; reducing upload range size and continuing from the last stored byte."
                });
            }
        }

        if (finalResult) {
            return finalResult;
        }

        const finalFailure = lastFailure || new Error("unknown upload failure");
        const finalMessage = createFinalWhisperUploadFailureMessage({
            taskId,
            failure: finalFailure
        });
        await reportWhisperUploadFailure({
            resolvedBaseUrl,
            taskId,
            uploadId,
            failure: finalFailure,
            message: finalMessage
        });
        throw new Error(finalMessage);
    }

    /**
     * Extract WAV from loaded source and upload it to Drupal transcription endpoints.
     */
    async function sendWhisperAudioToDrupal({
        transcriptionBaseUrl,
        videoId,
        targetSampleRate = 16_000,
        targetChannels = 1,
    } = {}) {
        const resolvedBaseUrl = resolveTranscriptionBaseUrl(transcriptionBaseUrl);
        const resolvedVideoId = String(videoId || createTranscriptionVideoId());

        setVideoSourceStatus("Preparing audio for transcription...");
        setTranscriptionStageStatus("prepare_audio");
        const whisperAudio = await extractWhisperReadyAudioFromLoadedSource({
            targetSampleRate,
            targetChannels,
            showStatus: true
        });

        setVideoSourceStatus("Creating transcription task...");
        setTranscriptionStageStatus("create_task");
        const initUrl = new URL("/api/framesmith/transcription/start", resolvedBaseUrl);
        const taskInit = await fetchJsonOrThrow(initUrl.toString(), {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                video_id: resolvedVideoId
            })
        });
        const taskId = String(taskInit.task_id || "");
        window.__lastWhisperDrupalTaskId = taskId;
        if (taskId.length === 0) {
            throw new Error("Transcription task init response did not include task_id.");
        }
        saveTranscriptionRecoverySnapshot({
            baseUrl: resolvedBaseUrl,
            videoId: resolvedVideoId,
            taskId,
            taskStatus: String(taskInit.status || "created"),
            taskInit,
            statusPayload: taskInit,
            audioMeta: whisperAudio.meta,
            transcriptReady: false,
            lastError: null
        });

        setVideoSourceStatus("Uploading audio to transcription service...");
        setTranscriptionStageStatus("upload_audio");
        const uploadResult = await uploadWhisperAudioBlobInChunks({
            resolvedBaseUrl,
            taskId,
            blob: whisperAudio.blob,
            filename: `${taskId}.wav`
        });

        const provisionResult = uploadResult?.launch || null;

        const result = {
            baseUrl: resolvedBaseUrl,
            videoId: resolvedVideoId,
            taskId,
            taskInit,
            uploadResult,
            provisionResult,
            audioMeta: whisperAudio.meta
        };
        window.__lastWhisperDrupalResult = result;
        saveTranscriptionRecoverySnapshot({
            baseUrl: resolvedBaseUrl,
            videoId: resolvedVideoId,
            taskId,
            taskStatus: String(uploadResult?.status || "uploaded"),
            uploadResult,
            provisionResult,
            statusPayload: uploadResult,
            uploadProgress: uploadResult?.upload_progress || window.__lastWhisperUploadProgress || null,
            audioMeta: whisperAudio.meta,
            transcriptReady: false,
            lastError: null
        });
        setVideoSourceStatus("Transcription queued");
        console.log("[Whisper][Drupal] upload complete", result);
        return result;
    }

    function shortTaskId(taskId) {
        const value = String(taskId || "");
        return value.length > 8 ? `${value.slice(0, 8)}…` : value;
    }

    async function fetchTranscriptionStatusWithResilience({
        resolvedBaseUrl,
        taskId,
        retryPolicy,
        operationName = "whisper_transcription_status_poll"
    }) {
        const statusUrl = new URL("/api/framesmith/transcription/status", resolvedBaseUrl);
        statusUrl.searchParams.set("task_id", taskId);
        return runRetryingRemoteOperation({
            operationName,
            retryPolicy,
            beforeAttempt: () => waitForBrowserOnline({
                message: `Network appears offline; waiting before checking transcription status for task ${shortTaskId(taskId)}.`
            }),
            request: () => fetchJsonOrThrow(statusUrl.toString(), {
                method: "GET",
                credentials: "include"
            }),
            beforeRetry: ({ error, nextAttempt, maxAttempts, delayMs }) => {
                const failure = {
                    taskId,
                    error: describeRemoteFailure(error),
                    classification: classifyFetchFailure(error),
                    nextAttempt,
                    maxAttempts,
                    delayMs,
                    at: Date.now()
                };
                window.__lastWhisperStatusPollTransportFailure = failure;
                setTranscriptionStageStatus("polling", "network retry");
                setVideoSourceStatus(
                    `Poor network while checking transcription status for task ${shortTaskId(taskId)}. ` +
                    `${formatRetryStatusMessage({
                        subject: "Status check",
                        error,
                        nextAttempt,
                        maxAttempts,
                        delayMs
                    })} This does not mean transcription failed. Please keep this tab open.`
                );
            }
        });
    }

    async function pollWhisperTranscriptionStatus({
        transcriptionBaseUrl,
        taskId,
        pollIntervalMs = 3_000,
        timeoutMs = 10 * 60 * 1_000,
        softTimeoutMs = timeoutMs,
        hardTimeoutMs = Math.max(softTimeoutMs, 30 * 60 * 1_000),
        slowPollIntervalMs = 15_000,
        statusRetryPolicy = createRetryPolicy({
            maxAttempts: 4,
            baseDelayMs: 1_000,
            maxDelayMs: 15_000,
            jitterMs: 500
        })
    }) {
        const resolvedBaseUrl = resolveTranscriptionBaseUrl(transcriptionBaseUrl);
        const startedAt = Date.now();
        const history = [];
        let lastStatusPayload = null;
        let lastTransportFailure = null;
        let transportFailureCount = 0;
        let recoveryPolling = false;

        while (Date.now() - startedAt <= hardTimeoutMs) {
            const elapsedMs = Date.now() - startedAt;
            if (!recoveryPolling && elapsedMs > softTimeoutMs) {
                recoveryPolling = true;
                setTranscriptionStageStatus("polling", "still watching");
                setVideoSourceStatus(
                    `Transcription is taking longer than usual for task ${shortTaskId(taskId)}. ` +
                    "Still checking the same task; please keep this tab open."
                );
            }
            const currentPollIntervalMs = recoveryPolling ? slowPollIntervalMs : pollIntervalMs;
            let statusPayload = null;
            try {
                const operation = await fetchTranscriptionStatusWithResilience({
                    resolvedBaseUrl,
                    taskId,
                    retryPolicy: statusRetryPolicy
                });
                statusPayload = operation.result;
                if (transportFailureCount > 0) {
                    setVideoSourceStatus(`Status check recovered for task ${shortTaskId(taskId)}.`);
                }
            } catch (error) {
                const classification = classifyFetchFailure(error);
                const failure = {
                    ok: false,
                    taskId,
                    error: describeRemoteFailure(error),
                    classification,
                    attempts: typeof error?.attempts === "number" ? error.attempts : null,
                    at: Date.now()
                };
                lastTransportFailure = failure;
                transportFailureCount += 1;
                history.push({ transport_error: failure });
                window.__lastWhisperStatusPollTransportFailure = failure;

                if (classification.retryable === false) {
                    setTranscriptionErrorStatus(`status check rejected (${failure.error})`);
                    return {
                        ok: false,
                        taskId,
                        statusPayload: lastStatusPayload,
                        history,
                        transportFailure: failure,
                        reason: "status_poll_non_retryable_transport_failure"
                    };
                }

                setTranscriptionStageStatus("polling", "network retry");
                setVideoSourceStatus(
                    `Poor network while checking transcription status for task ${shortTaskId(taskId)}. ` +
                    `Still waiting; this does not mean transcription failed. Please keep this tab open.`
                );
                await sleep(currentPollIntervalMs);
                continue;
            }

            history.push(statusPayload);
            lastStatusPayload = statusPayload;

            const status = String(statusPayload?.status || "").toLowerCase();
            saveTranscriptionRecoverySnapshot({
                taskId,
                taskStatus: status || null,
                statusPayload,
                transcriptReady: statusPayload?.transcript_ready === true,
                lastError: statusPayload?.task?.last_error || null
            });
            setTranscriptionStageStatus("polling", status || "working");
            const transcriptReady = statusPayload?.transcript_ready === true;
            if (transcriptReady || status === "completed") {
                setVideoSourceStatus("Transcription complete");
                return {
                    ok: true,
                    taskId,
                    statusPayload,
                    history,
                    transportFailureCount
                };
            }

            if (status === "failed" || status === "error") {
                return {
                    ok: false,
                    taskId,
                    statusPayload,
                    history,
                    transportFailureCount
                };
            }

            if (recoveryPolling) {
                setVideoSourceStatus(
                    `Still waiting for transcription task ${shortTaskId(taskId)}. ` +
                    `Latest backend status: ${status || "working"}.`
                );
            } else {
                setVideoSourceStatus(`Transcription status: ${status || "working"}...`);
            }
            window.__lastWhisperTranscriptionPollState = {
                taskId,
                elapsedMs: Date.now() - startedAt,
                recoveryPolling,
                status,
                transportFailureCount,
                lastStatusPayload
            };
            await sleep(currentPollIntervalMs);
        }

        return {
            ok: false,
            taskId,
            statusPayload: lastStatusPayload,
            history,
            timeout: true,
            softTimeoutMs,
            hardTimeoutMs,
            recoveryPolling,
            transportFailure: lastTransportFailure,
            transportFailureCount,
            reason: lastTransportFailure
                ? "hard_timeout_waiting_for_framesmith_transcription_after_status_transport_failures"
                : "hard_timeout_waiting_for_framesmith_transcription"
        };
    }

    /**
     * End-to-end transcription helper:
     * extract WAV -> upload -> queue -> poll until transcript ready.
     */
    async function startWhisperTranscriptionAndPoll({
        transcriptionBaseUrl,
        videoId,
        targetSampleRate = 16_000,
        targetChannels = 1,
        pollIntervalMs = 3_000,
        timeoutMs = 10 * 60 * 1_000,
        hardTimeoutMs = Math.max(timeoutMs, 30 * 60 * 1_000),
        slowPollIntervalMs = 15_000
    } = {}) {
        const uploadAndQueueResult = await sendWhisperAudioToDrupal({
            transcriptionBaseUrl,
            videoId,
            targetSampleRate,
            targetChannels,
        });

        const pollResult = await pollWhisperTranscriptionStatus({
            transcriptionBaseUrl: uploadAndQueueResult.baseUrl,
            taskId: uploadAndQueueResult.taskId,
            pollIntervalMs,
            timeoutMs,
            softTimeoutMs: timeoutMs,
            hardTimeoutMs,
            slowPollIntervalMs
        });

        const result = {
            ...uploadAndQueueResult,
            pollResult
        };

        if (pollResult.ok && pollResult.statusPayload) {
            try {
                setTranscriptionStageStatus("apply_transcript");
                const whisperJson = await loadWhisperJsonFromStatusPayload({
                    transcriptionBaseUrl: uploadAndQueueResult.baseUrl,
                    statusPayload: pollResult.statusPayload,
                    taskId: uploadAndQueueResult.taskId
                });
                if (whisperJson) {
                    const overlayItems = await applyWhisperTranscriptToTimeline({
                        whisperJson,
                        sourceLabel: `task:${uploadAndQueueResult.taskId}`
                    });
                    result.whisperJson = whisperJson;
                    result.overlayItemCount = overlayItems.length;
                }
            } catch (error) {
                result.whisperJsonError = error?.message || String(error);
                console.warn("[Whisper][Drupal] transcript JSON load/apply failed", {
                    taskId: uploadAndQueueResult.taskId,
                    error: result.whisperJsonError
                });
            }
        }

        window.__lastWhisperTranscriptionResult = result;
        saveTranscriptionRecoverySnapshot({
            taskId: uploadAndQueueResult.taskId,
            taskStatus: String(pollResult?.statusPayload?.status || ""),
            statusPayload: pollResult?.statusPayload || null,
            transcriptionResult: result,
            transcriptReady: pollResult.ok === true,
            lastError: pollResult.ok ? null : pollResult?.statusPayload?.task?.last_error || null
        });
        if (pollResult.ok) {
            setTranscriptionStageStatus("done");
            console.log("[Whisper][Drupal] transcription complete", result);
            return result;
        }
        if (pollResult.timeout) {
            setTranscriptionStageStatus("polling", pollResult.transportFailure ? "status unknown" : "timeout");
            setVideoSourceStatus(
                `Stopped watching transcription task ${shortTaskId(uploadAndQueueResult.taskId)} after the extended wait window. ` +
                "Retry/reconnect by task ID instead of starting over."
            );
            console.log("[Whisper][Drupal] extended wait expired before transcription completed", result);
        } else {
            const failedStatus = String(pollResult?.statusPayload?.status || "failed");
            const failedTask = pollResult?.statusPayload?.task || null;
            const failureDetail = String(failedTask?.last_error || failedStatus);
            setTranscriptionErrorStatus(failureDetail);
            setVideoSourceStatus(`Transcription failed: ${failureDetail}`);
            console.warn("[Whisper][Drupal] transcription incomplete", result);
        }
        return result;
    }

    async function fetchAndApplyWhisperTranscriptFromTask({
        taskId,
        transcriptionBaseUrl,
        pollIntervalMs = 3_000,
        timeoutMs = 5 * 60 * 1_000,
        waitForJson = true
    }) {
        if (!taskId || typeof taskId !== "string") {
            throw new Error("fetchAndApplyWhisperTranscriptFromTask: taskId is required.");
        }
        const resolvedBaseUrl = resolveTranscriptionBaseUrl(transcriptionBaseUrl);
        const startedAt = Date.now();
        let statusPayload = null;
        let whisperJson = null;

        while (Date.now() - startedAt <= timeoutMs) {
            const statusUrl = new URL("/api/framesmith/transcription/status", resolvedBaseUrl);
            statusUrl.searchParams.set("task_id", taskId);
            statusPayload = await fetchJsonOrThrow(statusUrl.toString(), {
                method: "GET",
                credentials: "include"
            });

            whisperJson = await loadWhisperJsonFromStatusPayload({
                transcriptionBaseUrl: resolvedBaseUrl,
                statusPayload,
                taskId
            });
            if (whisperJson) {
                break;
            }

            if (!waitForJson) {
                break;
            }

            const status = String(statusPayload?.status || "");
            setVideoSourceStatus(`Waiting for transcript JSON (${status || "queued"})...`);
            await sleep(pollIntervalMs);
        }

        if (!whisperJson) {
            const status = String(statusPayload?.status || "unknown");
            throw new Error(
                `No json_url available yet for task ${taskId} (status=${status}). ` +
                `Framesmith result was not available from the new API yet.`
            );
        }
        const overlayItems = await applyWhisperTranscriptToTimeline({
            whisperJson,
            sourceLabel: `task:${taskId}`
        });
        const result = {
            taskId,
            statusPayload,
            whisperJson,
            overlayItemCount: overlayItems.length
        };
        window.__lastWhisperTranscriptFetchResult = result;
        saveTranscriptionRecoverySnapshot({
            taskId,
            taskStatus: String(statusPayload?.status || "completed"),
            statusPayload,
            transcriptFetchResult: result,
            whisperJson,
            overlayItems,
            transcriptText: latestTranscriptText,
            transcriptReady: true,
            lastError: null
        });
        return result;
    }

    /**
     * Stop preview overlay rendering loop.
     */
    function stopPreviewLoop() {
        if (previewAnimationFrameId !== null) {
            cancelAnimationFrame(previewAnimationFrameId);
            previewAnimationFrameId = null;
        }
    }

    function setPreviewModeUiState(isActive) {
        document.body.classList.toggle("preview-active", !!isActive);
    }

    /**
     * Keep preview overlay canvas in sync with video display size.
     */
    function syncPreviewCanvasToVideo() {
        const targetWidth = Number(runtimeConfig?.output?.width);
        const targetHeight = Number(runtimeConfig?.output?.height);
        const width = Math.max(
            1,
            Number.isFinite(targetWidth) ? Math.round(targetWidth) : (video.videoWidth || Math.round(video.clientWidth) || 1)
        );
        const height = Math.max(
            1,
            Number.isFinite(targetHeight) ? Math.round(targetHeight) : (video.videoHeight || Math.round(video.clientHeight) || 1)
        );
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    /**
     * Draw overlay at current playback time using the same render-intent renderer as composition.
     */
    function renderPreviewOverlayAtCurrentTime() {
        if (!previewPlan) {
            return;
        }
        syncPreviewCanvasToVideo();
        context.clearRect(0, 0, canvas.width, canvas.height);
        const timeSeconds = Number(video.currentTime) || 0;
        const resolution = resolveProceduralFragmentsAtTimeFromPlan({
            plan: previewPlan,
            timeSeconds,
            timecodeFragmentIntentResolvers
        });
        drawRenderIntentsOnCanvas({
            canvas,
            renderIntents: resolution.renderIntents,
            timeSeconds
        });
    }

    /**
     * Preview animation frame loop while video is playing.
     */
    function renderPreviewFrame() {
        renderPreviewOverlayAtCurrentTime();
        if (video.paused || video.ended) {
            previewAnimationFrameId = null;
            return;
        }
        previewAnimationFrameId = requestAnimationFrame(renderPreviewFrame);
    }

    function startPreviewLoop() {
        if (previewAnimationFrameId !== null) {
            return;
        }
        setPreviewModeUiState(true);
        renderPreviewFrame();
    }

    /**
     * Start preview playback with shared overlay rendering.
     */
    async function startPreviewPlayback() {
        if (!timeline) {
            console.warn("Timeline not ready. Load a video source first.");
            return;
        }

        if (!previewPlan) {
            previewPlan = buildPrerenderPlanFromTimeline({ timeline });
        }

        stopPreviewLoop();
        try {
            if (video.paused) {
                await video.play();
            }
        } catch (error) {
            console.warn("Preview playback could not start", error);
        }
        startPreviewLoop();
    }

    video.addEventListener("play", () => {
        if (!timeline) return;
        if (!previewPlan) {
            previewPlan = buildPrerenderPlanFromTimeline({ timeline });
        }
        startPreviewLoop();
    });

    video.addEventListener("pause", () => {
        if (!timeline) return;
        stopPreviewLoop();
        if (document.body.classList.contains("preview-active")) {
            renderPreviewOverlayAtCurrentTime();
        }
    });

    video.addEventListener("seeked", () => {
        if (!timeline) return;
        if (document.body.classList.contains("preview-active")) {
            renderPreviewOverlayAtCurrentTime();
        }
    });

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

    /**
     * Attach loaded source bytes to player state and initialize timeline.
     */
    async function applyLoadedVideoSourceBytes({
        bytes,
        fileKey,
        mimeType,
        fileName = null,
        fileSize = null,
        fileLastModified = null
    }) {
        if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
            throw new Error("Loaded video bytes are empty.");
        }

        if (lastExportUrl) {
            URL.revokeObjectURL(lastExportUrl);
            lastExportUrl = null;
        }
        lastExportBlob = null;
        exportBtn.disabled = true;

        const existingRecoverySnapshot = readFramesmithRecoverySnapshot();
        const shouldRestoreRecoveredTranscript = shouldRestoreRecoveredTranscriptForSource(
            existingRecoverySnapshot,
            {
                key: fileKey,
                name: fileName,
                size: fileSize,
                lastModified: fileLastModified
            }
        );
        cachedSelectedVideo = {
            fileKey,
            fileName,
            fileSize,
            fileLastModified,
            bytes
        };
        clearRuntimeTranscriptOverlayItems();
        window.__runtimeTranscriptOverlayItems = null;
        window.__runtimeWhisperTranscriptJson = null;
        window.__lastWhisperTranscriptFetchResult = null;
        window.__lastWhisperTranscriptionResult = null;
        window.__lastWhisperDrupalResult = null;
        window.__lastWhisperAudioBlob = null;
        window.__lastWhisperAudioBytes = null;
        window.__lastWhisperAudioMeta = null;
        lastWhisperAudioSourceKey = null;
        if (shouldRestoreRecoveredTranscript) {
            await restoreTranscriptArtifactsFromRecoverySnapshot(existingRecoverySnapshot);
        } else {
            setLatestTranscriptText("");
            clearFramesmithRecoverySnapshot();
        }
        setTranscriptionRunBadge({
            visible: false,
            message: "Transcribe…",
            tone: "working"
        });
        previewPlan = null;
        stopPreviewLoop();

        if (currentVideoSourceObjectUrl) {
            URL.revokeObjectURL(currentVideoSourceObjectUrl);
            currentVideoSourceObjectUrl = null;
        }
        const sourceBlob = new Blob([bytes], {
            type: mimeType || "video/mp4"
        });
        currentVideoSourceObjectUrl = URL.createObjectURL(sourceBlob);
        video.src = currentVideoSourceObjectUrl;
        video.style.display = "block";
        video.controls = true;
        setHasLoadedSourceUiState(true);

        await initializeTimelineFromBytes(cachedSelectedVideo.bytes);

        // Warm up audio extraction in the background so "Transcribe" starts faster.
        void extractWhisperReadyAudioFromLoadedSource({ showStatus: false }).catch((error) => {
            console.warn("[Whisper][Drupal] audio warmup skipped", {
                errorName: error?.name || "Error",
                errorMessage: error?.message || String(error)
            });
        });
    }

    /**
     * Load fixture bytes by URL and initialize timeline without file picker.
     */
    async function loadFixtureVideoSourceFromRuntimeConfig() {
        const fixtureUrl = runtimeConfig?.testing?.fixtureUrl;
        if (!fixtureUrl) {
            return false;
        }

        const resolvedFixtureUrl = new URL(fixtureUrl, window.location.href).toString();
        setVideoSourceStatus(`Loading fixture: ${resolvedFixtureUrl}`);

        const response = await fetch(resolvedFixtureUrl);
        if (!response.ok) {
            throw new Error(`Fixture fetch failed (${response.status} ${response.statusText})`);
        }

        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length === 0) {
            throw new Error("Fixture fetch returned zero bytes.");
        }

        await applyLoadedVideoSourceBytes({
            bytes,
            fileKey: `fixture:${resolvedFixtureUrl}`,
            mimeType: blob.type || "video/mp4"
        });

        emitEncodeSignal({
            label: "[Fixture] source loaded",
            payload: {
                fixtureUrl: resolvedFixtureUrl,
                bytes: bytes.length
            }
        });
        return true;
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

        const audioCodecConfig = audioTrackView.codecConfig ?? {};
        const audioCodecRepresentation = audioCodecConfig?.config?.representation;
        const audioCodecBytes = audioCodecConfig?.config?.bytes instanceof Uint8Array
            ? audioCodecConfig.config.bytes
            : null;
        const sourceEsds =
            audioCodecConfig.codec === "mp4a" && audioCodecRepresentation === "container"
                ? audioCodecBytes
                : (audioCodecConfig.esds instanceof Uint8Array ? audioCodecConfig.esds : null);
        const aacAsc = sourceEsds
            ? parseAudioSpecificConfigFromEsds({ esds: sourceEsds })
            : null;
        const audioDecoderCodecFromSource = audioCodecConfig.codec === "mp4a" && aacAsc?.audioObjectType
            ? `mp4a.40.${aacAsc.audioObjectType}`
            : audioDecoderCodec;
        const normalizedAudioSampleRate = (audioCodecConfig.sampleRate ?? 48_000) > 192_000
            ? ((audioCodecConfig.sampleRate ?? 48_000) >>> 16)
            : (audioCodecConfig.sampleRate ?? 48_000);

        let audioDecoderDescription = null;
        if (audioCodecConfig.codec === "mp4a") {
            if (audioCodecRepresentation === "elementary" && audioCodecBytes instanceof Uint8Array) {
                audioDecoderDescription = audioCodecBytes;
            } else {
                audioDecoderDescription = extractAudioSpecificConfigBytesFromEsds(sourceEsds);
            }
        } else {
            audioDecoderDescription =
                (audioCodecBytes instanceof Uint8Array ? audioCodecBytes : null) ??
                audioCodecConfig.dOps ??
                audioCodecConfig.esds;
        }
        const audioDecoderChannelCount = audioCodecConfig.channelCount ?? 2;
        const audioDecoderSampleRate = normalizedAudioSampleRate;

        if (!audioDecoderDescription && audioCodecConfig.codec === "mp4a") {
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

    function getCurrentUserAgent() {
        if (typeof navigator !== "object" || navigator === null) {
            return "";
        }
        if (typeof navigator.userAgent !== "string") {
            return "";
        }
        return navigator.userAgent;
    }

    function isKnownBadHardwareDecodeDevice() {
        const userAgent = getCurrentUserAgent();
        if (userAgent.length === 0) {
            return false;
        }

        const knownBadMatchers = [
            "Android 10; K"
        ];

        for (const matcher of knownBadMatchers) {
            if (userAgent.includes(matcher)) {
                return true;
            }
        }
        return false;
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
        const videoCodecConfig = videoTrackView.codecConfig ?? {};
        const sourceVideoCodec = videoCodecConfig.codec;
        const videoCodecRepresentation = videoCodecConfig?.config?.representation;
        const videoCodecBytes = videoCodecConfig?.config?.bytes instanceof Uint8Array
            ? videoCodecConfig.config.bytes
            : null;
        const avcC =
            sourceVideoCodec === "avc1" && videoCodecRepresentation === "container"
                ? videoCodecBytes
                : videoCodecConfig.avcC;
        const hvcC =
            (sourceVideoCodec === "hvc1" || sourceVideoCodec === "hev1") &&
            videoCodecRepresentation === "container"
                ? videoCodecBytes
                : videoCodecConfig.hvcC;

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
    videoElement.controls = false;
    videoElement.style.position = "fixed";
    videoElement.style.right = "8px";
    videoElement.style.bottom = "8px";
    videoElement.style.width = "120px";
    videoElement.style.height = "auto";
    videoElement.style.opacity = "0.01";
    videoElement.style.pointerEvents = "none";
    document.body.appendChild(videoElement);

    let stream = null;
    let mediaRecorder = null;
    const captureMode = "video-capture-stream";
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

        if (typeof videoElement.captureStream !== "function") {
            throw new Error("source normalization: video captureStream unavailable");
        }

        const capturedStream = videoElement.captureStream();
        const capturedVideoTrack = capturedStream.getVideoTracks()[0] || null;
        if (!capturedVideoTrack) {
            throw new Error("source normalization: no captured video track");
        }
        stream = new MediaStream([capturedVideoTrack]);

        const mimeType = selectWebmNormalizationMimeType();
        if (typeof mimeType !== "string" || mimeType.length === 0) {
            throw new Error("source normalization: no supported WebM MediaRecorder mimeType");
        }

        const chunks = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 1_400_000
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
                const reason = error?.message ?? "unknown recorder error";
                reject(new Error(`source normalization recorder failed: ${reason}`));
            }, { once: true });
        });

        videoElement.currentTime = startSeconds;
        await waitForVideoEvent(videoElement, "seeked");
        if (videoElement.readyState < 2) {
            await waitForVideoEvent(videoElement, "canplay");
        }

        mediaRecorder.start();

        const captureTimeoutMs = Math.min(
            300_000,
            Math.max(30_000, Math.ceil((endSeconds - startSeconds) * 6_000))
        );
        const captureCompletion = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error("source normalization: playback capture timeout"));
            }, captureTimeoutMs);

            let intervalId = null;

            const check = () => {
                const currentTime = Number(videoElement.currentTime);
                if ((Number.isFinite(currentTime) && currentTime >= endSeconds) || videoElement.ended) {
                    cleanup();
                    resolve();
                }
            };

            const onTimeUpdate = () => check();
            const onEnded = () => check();

            const cleanup = () => {
                clearTimeout(timeoutId);
                if (intervalId !== null) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                videoElement.removeEventListener("timeupdate", onTimeUpdate);
                videoElement.removeEventListener("ended", onEnded);
            };

            intervalId = setInterval(check, 100);
            videoElement.addEventListener("timeupdate", onTimeUpdate);
            videoElement.addEventListener("ended", onEnded);
            check();
        });

        const playResult = videoElement.play();
        if (playResult && typeof playResult.then === "function") {
            await playResult;
        }
        await captureCompletion;

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
        if (videoElement.parentNode) {
            videoElement.parentNode.removeChild(videoElement);
        }
    }
}

async function normalizeUnsupportedSourceToWorkingSet({
    timeline,
    sourceUrl,
    exportRange,
    originalAudioTrackView,
    sourceRotationDegrees
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
            // Canvas-driven normalization captures display-oriented pixels.
            // video.captureStream() may preserve source orientation, so keep source rotation there.
            const normalizedRotationDegrees =
                normalizationResult.captureMode === "video-capture-stream"
                    ? (typeof sourceRotationDegrees === "number" ? sourceRotationDegrees : 0)
                    : 0;
            trackView.containerMeta.displayTransform = {
                rotationDegrees: normalizedRotationDegrees
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
        videoTrackView,
        decodeChunkSeconds,
        onVideoProgress
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
                decodeChunkSeconds,
                onVideoProgress,
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
        const knownBadHardwareDecodeDevice = isKnownBadHardwareDecodeDevice();
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

            let configuredHardwareAcceleration = null;
            try {
                const configuredDecoderCandidate = await configureVideoDecoderForTrack({
                    videoDecoder,
                    videoTrackView,
                    accelerationOrderOverride: accelerationOrder
                });
                if (
                    configuredDecoderCandidate &&
                    typeof configuredDecoderCandidate.hardwareAcceleration === "string"
                ) {
                    configuredHardwareAcceleration = configuredDecoderCandidate.hardwareAcceleration;
                }
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
                    getConfiguredHardwareAcceleration() {
                        return configuredHardwareAcceleration;
                    },
                    getSegmentFlushTimeoutMs() {
                        if (configuredHardwareAcceleration === "prefer-hardware") {
                            return 2000;
                        }
                        return 6000;
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
        } else if (knownBadHardwareDecodeDevice) {
            emitEncodeSignal({
                level: "warn",
                label: "[Encode] known-bad hardware decode profile matched; starting software decode",
                payload: {
                    userAgent: getCurrentUserAgent()
                }
            });
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
        encodeStartedAt,
        stageTimingMs,
        stageOrder,
        executeBreakdownMs
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
        exportBtn.disabled = false;

        const decodePathMode = resolveEncodeDecodePathMode({
            didNormalizePredecode
        });
        const executeBreakdownSummary = buildExecuteBreakdownSummary({
            executeBreakdownMs
        });
        const stageTimingSummary = buildEncodeStageTimingSummary({
            stageTimingMs,
            stageOrder,
            nowMs: performance.now()
        });
        emitEncodeSignal({
            label: "[Encode][EXECUTE_BREAKDOWN]",
            payload: executeBreakdownSummary
        });
        emitEncodeSignal({
            label: "[Encode][STAGE_TIMINGS]",
            payload: stageTimingSummary
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
                encodeCapacityProfile: buildEncodeCapacityProfileSummary(),
                encodedVideoChunkCount: videoEncodedChunks.length,
                encodedAudioChunkCount: audioEncodedChunks.length,
                decodePathMode,
                stageTimingSeconds: stageTimingSummary.stageTimingSeconds,
                executeBreakdownSeconds: executeBreakdownSummary.executeBreakdownSeconds
            }
        });
    }

    /**
     * Convert per-stage timing from milliseconds into stable seconds payload.
     */
    function buildEncodeStageTimingSummary({
        stageTimingMs,
        stageOrder,
        nowMs
    }) {
        const stageTimingSeconds = {};
        const orderedStages = [];
        const seen = new Set();
        if (Array.isArray(stageOrder)) {
            for (const stageName of stageOrder) {
                if (typeof stageName !== "string" || stageName.length === 0) {
                    continue;
                }
                if (seen.has(stageName)) {
                    continue;
                }
                seen.add(stageName);
                orderedStages.push(stageName);
            }
        }
        let totalStageSeconds = 0;
        for (const stageName of orderedStages) {
            const stage = stageTimingMs?.[stageName];
            if (!stage || typeof stage !== "object") {
                continue;
            }
            let elapsedMs = stage.elapsedMs;
            if (!Number.isFinite(elapsedMs)) {
                if (Number.isFinite(stage.startedAtMs)) {
                    elapsedMs = Math.max(0, Math.round(nowMs - stage.startedAtMs));
                } else {
                    continue;
                }
            }
            const seconds = Number((elapsedMs / 1000).toFixed(3));
            stageTimingSeconds[stageName] = seconds;
            totalStageSeconds += seconds;
        }
        totalStageSeconds = Number(totalStageSeconds.toFixed(3));
        return {
            stageTimingSeconds,
            totalStageSeconds
        };
    }

    /**
     * Convert execute-strategy timing buckets from milliseconds into seconds.
     */
    function buildExecuteBreakdownSummary({
        executeBreakdownMs
    }) {
        const executeBreakdownSeconds = {};
        if (!executeBreakdownMs || typeof executeBreakdownMs !== "object") {
            return {
                executeBreakdownSeconds
            };
        }
        const entries = Object.entries(executeBreakdownMs);
        for (const [key, value] of entries) {
            if (!Number.isFinite(value)) {
                continue;
            }
            if (key.endsWith("Calls")) {
                executeBreakdownSeconds[key] = value;
                continue;
            }
            executeBreakdownSeconds[key] = Number((value / 1000).toFixed(3));
        }
        return {
            executeBreakdownSeconds
        };
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
        const encodeCapacityProfile = selectEncodeCapacityProfileForCurrentRun();
        const exportFps = currentEncodeCapacityProfile?.fps ?? PRE_RENDER_FPS;
        const exportRange = deriveExportRangeFromTimeline(timeline);
        let executionTimeline = timeline;
        let prerenderPlan = buildPrerenderPlanFromTimeline({ timeline: executionTimeline });
        return {
            encodeCapacityProfile,
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
                normalizationSourceUrlToRevoke: null,
                recommendedExportFps: null
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
        const compatibilityNotice =
            "Best compatibility mode may stutter; use Open Camera (H.264) or capture in-app.";
        emitEncodeSignal({
            level: "warn",
            label: "[Encode] compatibility notice",
            payload: {
                message: compatibilityNotice
            }
        });
        setVideoSourceStatus(compatibilityNotice);

        const normalized = await normalizeUnsupportedSourceToWorkingSet({
            timeline: executionTimeline,
            sourceUrl: sourceUrlForNormalization,
            exportRange,
            originalAudioTrackView: audioTrackView,
            sourceRotationDegrees
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

        const recommendedExportFps = deriveFpsFromTrackViewTiming(selected.videoTrackView);
        if (Number.isFinite(recommendedExportFps)) {
            emitEncodeSignal({
                label: "[Encode] normalization export fps override",
                payload: {
                    recommendedExportFps
                }
            });
        }

        return {
            didNormalizePredecode: true,
            executionTimeline: normalizedTimeline,
            prerenderPlan: normalizedPlan,
            videoTrackView: selected.videoTrackView,
            audioTrackView: selected.audioTrackView,
            normalizationSourceUrlToRevoke: normalized.sourceUrl,
            recommendedExportFps
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


        globalThis.__encodeDiag = { ...(globalThis.__encodeDiag || {}), fallbackEngagedAt: performance.now() };
        
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
                maybeEmitEncodedChunkProgress({
                    videoEncodedChunks,
                    audioEncodedChunks
                });
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
                maybeEmitEncodedChunkProgress({
                    videoEncodedChunks,
                    audioEncodedChunks
                });
                if (metadata?.decoderConfig) {
                    setAudioDecoderConfig(metadata.decoderConfig);
                }
            },
            error(error) {
                console.error("AudioEncoder error", error);
                throw error;
            }
        });

        const audioEncoderCandidates = [
            {
                codec: "mp4a.40.2",
                sampleRate: 48_000,
                numberOfChannels: 2,
                bitrate: 192_000
            },
            {
                codec: "opus",
                sampleRate: 48_000,
                numberOfChannels: 2,
                bitrate: 128_000
            }
        ];

        let selectedAudioEncoderConfig = null;
        const supportChecks = [];

        for (const candidate of audioEncoderCandidates) {
            let isSupported = true;

            if (typeof AudioEncoder.isConfigSupported === "function") {
                try {
                    const support = await AudioEncoder.isConfigSupported(candidate);
                    isSupported = Boolean(support?.supported);
                    supportChecks.push({
                        codec: candidate.codec,
                        supported: isSupported
                    });
                } catch (error) {
                    isSupported = false;
                    supportChecks.push({
                        codec: candidate.codec,
                        supported: false,
                        reason: error?.message ?? String(error)
                    });
                }
            }

            if (!isSupported) {
                continue;
            }

            try {
                audioEncoder.configure(candidate);
                selectedAudioEncoderConfig = candidate;
                break;
            } catch (error) {
                supportChecks.push({
                    codec: candidate.codec,
                    supported: false,
                    reason: error?.message ?? String(error)
                });
            }
        }

        if (!selectedAudioEncoderConfig) {
            throw new Error(
                "createConfiguredEncoders: no supported audio encoder config " +
                `checks=${JSON.stringify(supportChecks)}`
            );
        }

        emitEncodeSignal({
            label: "[Encode] selected audio encoder config",
            payload: {
                codec: selectedAudioEncoderConfig.codec,
                sampleRate: selectedAudioEncoderConfig.sampleRate,
                channels: selectedAudioEncoderConfig.numberOfChannels,
                bitrate: selectedAudioEncoderConfig.bitrate
            }
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
        exportRange,
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
            videoTrackView,
            decodeChunkSeconds: resolveDecodeChunkSecondsForCapacityProfile({
                profile: currentEncodeCapacityProfile,
                exportRange,
                defaultResolver: resolveDecodeChunkSecondsForExportRange
            }),
            onVideoProgress: ({ frameIndex, totalFrames }) => {
                if (!isEncodeInProgress) {
                    return;
                }
                if (!Number.isFinite(totalFrames) || totalFrames <= 0) {
                    return;
                }
                if (currentEncodeStageName !== "execute_strategy") {
                    return;
                }
                const stageStart = ENCODE_STAGE_PROGRESS.execute_strategy.percent;
                const stageEnd = 96;
                const stageSpan = stageEnd - stageStart;
                const stagePercent = stageStart + ((frameIndex / totalFrames) * stageSpan);
                setEncodeRunProgressPercent(stagePercent);
            }
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
        const stageTimingSummary = buildEncodeStageTimingSummary({
            stageTimingMs: encodePipelineRunState.stageTimingMs,
            stageOrder: encodePipelineRunState.stageOrder,
            nowMs: performance.now()
        });
        emitEncodeSignal({
            label: "[Encode][STAGE_TIMINGS]",
            payload: stageTimingSummary
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
                encodeCapacityProfile: buildEncodeCapacityProfileSummary(),
                errorName: error?.name ?? "Error",
                errorMessage: error?.message ?? String(error),
                decodePathMode,
                stageTimingSeconds: stageTimingSummary.stageTimingSeconds
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
                emitDecodeFallbackSignal,
                onEncodeStageChange: ({ stageName }) => {
                    setEncodeRunStageStatus(stageName);
                }
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

    previewBtn.onclick = async () => {
        await startPreviewPlayback();
    };

    if (transcribeBtn) {
        transcribeBtn.onclick = async () => {
            if (isTranscribeInProgress || isEncodeInProgress) {
                return;
            }
            if (!timeline || !(cachedSelectedVideo?.bytes instanceof Uint8Array)) {
                setVideoSourceStatus("Load a video before transcribing", true);
                return;
            }

            isTranscribeInProgress = true;
            transcribeBtn.textContent = "Working…";
            setTranscriptionRunBadge({
                visible: true,
                message: "Transcribe 0% Starting",
                tone: "working"
            });
            setWorkflowEnabled(!!timeline);

            try {
                const result = await startTranscription();
                if (result?.pollResult?.ok) {
                    setVideoSourceStatus("Captions ready");
                } else if (result?.taskId) {
                    setVideoSourceStatus(`Transcription queued (task ${result.taskId.slice(0, 8)}…)`);
                }
            } catch (error) {
                setVideoSourceStatus(
                    `Transcription failed: ${error?.message || String(error)}`,
                    true
                );
                setTranscriptionErrorStatus(error?.message || String(error));
                console.error("[Whisper][Drupal] transcription failed", error);
            } finally {
                isTranscribeInProgress = false;
                transcribeBtn.textContent = "Transcribe";
                setWorkflowEnabled(!!timeline);
            }
        };
    }

    if (showTranscriptBtn) {
        showTranscriptBtn.onclick = openTranscriptPanel;
    }
    if (transcriptPanelCloseBtn) {
        transcriptPanelCloseBtn.onclick = closeTranscriptPanel;
    }
    if (closeTranscriptPanelBtn) {
        closeTranscriptPanelBtn.onclick = closeTranscriptPanel;
    }
    if (copyTranscriptBtn) {
        copyTranscriptBtn.onclick = async () => {
            const success = await writeTextToClipboard(latestTranscriptText);
            if (copyTranscriptBtn) {
                copyTranscriptBtn.textContent = success ? "Copied" : "Copy failed";
            }
            if (copyFeedbackTimeoutId !== null) {
                window.clearTimeout(copyFeedbackTimeoutId);
            }
            copyFeedbackTimeoutId = window.setTimeout(() => {
                resetCopyBtnLabel();
                copyFeedbackTimeoutId = null;
            }, 1200);
        };
    }

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

        if (!tryStartEncodeRun())  return;
        currentEncodeCapacityProfile = null;
        lastEncodedVideoProgressChunkCount = 0;
        lastEncodedAudioProgressChunkCount = 0;
        setEncodeRunUiState(true);
        setEncodeRunStageStatus("validate");
        setWorkflowEnabled(!!timeline);
        if (document.body.classList.contains("preview-active")) {
            stopPreviewLoop();
            renderPreviewOverlayAtCurrentTime();
        }

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
            setEncodeRunUiState(false);
            setWorkflowEnabled(!!timeline);
            dumpEncodeDiagnosticsPanelToConsole();

        }
    };

    if (videoFileInput) {
        videoFileInput.addEventListener("click", () => {
            // Allow re-selecting the same file to fire `change` again on mobile.
            videoFileInput.value = "";
        });
        videoFileInput.onchange = async () => {
            const selectedFile = videoFileInput.files?.[0];
            cachedSelectedVideo = null;
            previewPlan = null;
            stopPreviewLoop();
            setPreviewModeUiState(false);
            if (!(selectedFile instanceof File)) {
                setVideoSourceStatus("No video loaded");
                setHasLoadedSourceUiState(false);
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
                await applyLoadedVideoSourceBytes({
                    bytes,
                    fileKey: `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                    fileLastModified: selectedFile.lastModified,
                    mimeType: selectedFile.type || "video/mp4"
                });
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
    setTranscriptionRunBadge({
        visible: false,
        message: "Transcribe…",
        tone: "working"
    });
    setHasLoadedSourceUiState(false);
    setPreviewModeUiState(false);
    window.__extractWhisperAudio = extractWhisperReadyAudioFromLoadedSource;
    window.__sendWhisperAudioToDrupal = sendWhisperAudioToDrupal;
    window.__pollWhisperTranscriptionStatus = pollWhisperTranscriptionStatus;
    window.__startWhisperTranscriptionAndPoll = startWhisperTranscriptionAndPoll;
    window.__startTranscription = startTranscription;
    window.__createCurrentTranscriptionClient = createCurrentTranscriptionClient;
    window.__fetchAndApplyWhisperTranscriptFromTask = fetchAndApplyWhisperTranscriptFromTask;
    window.__framesmithRecoveryStore = recoveryStore;
    window.__framesmithRestoreRecoveryState = restoreFramesmithRecoveryStateOnLoad;

    restoreFramesmithRecoveryStateOnLoad().catch((error) => {
        console.warn("[Recovery] startup restore failed", error);
    });

    if (runtimeConfig.testing.fixtureUrl) {
        try {
            await loadFixtureVideoSourceFromRuntimeConfig();
            if (runtimeConfig.testing.fixtureAutoEncodeOnLoad) {
                emitEncodeSignal({
                    label: "[Fixture] auto encode start"
                });
                await encodeBtn.onclick();
            }
        } catch (error) {
            console.error("Fixture source load failed", error);
            setVideoSourceStatus(
                `Fixture load failed: ${error?.message ?? String(error)}`,
                true
            );
        }
    }


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

    console.log("[Timeline] demux selection", {
        selectedVideoDemuxer: "native",
        trackViewMediaTypes: nativeTrackViews.map(trackView => trackView.mediaType)
    });

    return createTimelineFromPreparedAssets({
        trackViews: nativeTrackViews,
        textOverlayItems: transcriptOverlayItems,
        imageOverlayItems
    });
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
