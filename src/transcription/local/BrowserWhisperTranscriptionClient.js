import {
    TRANSCRIPTION_CLIENT_KIND,
    createTranscriptionClient
} from "../TranscriptionClient.js";
import { normalizeWhisperTranscriptionResult } from "../normalizeWhisperTranscriptionResult.js";
import {
    BROWSER_WHISPER_DEVICE,
    resolveBrowserWhisperDeviceCandidates
} from "./BrowserWhisperBackendProbe.js";
import { createTransformersBrowserWhisperRuntime } from "./TransformersBrowserWhisperRuntime.js";

export const BROWSER_WHISPER_MODEL = Object.freeze({
    TINY_TIMESTAMPED: "onnx-community/whisper-tiny.en_timestamped",
    BASE_TIMESTAMPED: "onnx-community/whisper-base_timestamped"
});

const DEFAULT_BROWSER_WHISPER_MODEL = BROWSER_WHISPER_MODEL.TINY_TIMESTAMPED;
const DEFAULT_TIMESTAMP_MODE = "word";

/**
 * Create the local browser Whisper transcription adapter.
 *
 * The adapter conforms to the shared TranscriptionClient port and returns the
 * same normalized result shape future server/local selection policy can consume.
 */
export function createBrowserWhisperTranscriptionClient({
    runtime = createTransformersBrowserWhisperRuntime(),
    resolveDeviceCandidates = resolveBrowserWhisperDeviceCandidates,
    now = () => performance.now()
} = {}) {
    return createTranscriptionClient({
        kind: TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER,
        transcribe: (request) => transcribeWithBrowserWhisper({
            request,
            runtime,
            resolveDeviceCandidates,
            now
        })
    });
}

async function transcribeWithBrowserWhisper({
    request,
    runtime,
    resolveDeviceCandidates,
    now
}) {
    const sourceUrl = readSourceUrl(request);
    const model = request.localModel || DEFAULT_BROWSER_WHISPER_MODEL;
    const timestampMode = request.timestampMode || DEFAULT_TIMESTAMP_MODE;
    const selectedDevice = request.localDevice || BROWSER_WHISPER_DEVICE.AUTO;
    const deviceCandidates = await resolveDeviceCandidates({ selectedDevice });

    const startedAt = now();
    const { result: browserResult, device } = await runtime.transcribe({
        sourceUrl,
        model,
        deviceCandidates,
        timestampMode
    });
    const elapsedSeconds = Math.max(0, (now() - startedAt) / 1000);
    const normalized = normalizeWhisperTranscriptionResult({ browserResult });

    return {
        ok: true,
        source: TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER,
        model,
        device,
        timestampMode,
        elapsedSeconds,
        ...normalized,
        browserResult
    };
}

function readSourceUrl(request) {
    const sourceUrl = typeof request.mediaSourceUrl === "string" ? request.mediaSourceUrl.trim() : "";

    if (!sourceUrl) {
        throw new Error("BrowserWhisperTranscriptionClient: mediaSourceUrl is required.");
    }

    return sourceUrl;
}
