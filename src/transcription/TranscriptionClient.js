/**
 * Shared transcription client port.
 *
 * A transcription client has one job:
 *
 * ```text
 * transcribe(request) -> Promise<TranscriptionResult>
 * ```
 *
 * Infrastructure adapters may use Drupal, Transformers.js, WebGPU, WASM, or a
 * future GPU pool behind this boundary. The caller should not need to know those
 * details to ask for a transcription.
 */

export const TRANSCRIPTION_CLIENT_KIND = Object.freeze({
    SERVER: "server",
    LOCAL_BROWSER: "local-browser"
});

/**
 * Wrap an implementation function in the common transcription client shape.
 *
 * This is intentionally small. It gives production code and tests one stable
 * interface while we split server and local implementations into separate
 * adapters.
 */
export function createTranscriptionClient({
    kind,
    transcribe
}) {
    const normalizedKind = normalizeTranscriptionClientKind(kind);

    if (typeof transcribe !== "function") {
        throw new Error("createTranscriptionClient: transcribe function is required.");
    }

    return Object.freeze({
        kind: normalizedKind,
        transcribe(request = {}) {
            return transcribe(normalizeTranscriptionRequest(request));
        }
    });
}

export function normalizeTranscriptionRequest(request = {}) {
    const source = request && typeof request === "object" ? request : {};

    return Object.freeze({
        transcriptionBaseUrl: normalizeOptionalString(source.transcriptionBaseUrl),
        videoId: normalizeOptionalString(source.videoId),
        targetSampleRate: normalizePositiveInteger(source.targetSampleRate, 16_000),
        targetChannels: normalizePositiveInteger(source.targetChannels, 1),
        pollIntervalMs: normalizePositiveInteger(source.pollIntervalMs, 3_000),
        timeoutMs: normalizePositiveInteger(source.timeoutMs, 10 * 60 * 1_000),
        hardTimeoutMs: normalizeOptionalPositiveInteger(source.hardTimeoutMs),
        slowPollIntervalMs: normalizePositiveInteger(source.slowPollIntervalMs, 15_000),
        mediaSourceUrl: normalizeOptionalString(source.mediaSourceUrl),
        localModel: normalizeOptionalString(source.localModel),
        localDevice: normalizeOptionalString(source.localDevice),
        timestampMode: normalizeOptionalString(source.timestampMode)
    });
}

export function normalizeTranscriptionClientKind(kind) {
    const value = normalizeOptionalString(kind);
    if (!value) {
        throw new Error("transcription client kind is required.");
    }
    return value;
}

function normalizeOptionalString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInteger(value, fallback) {
    const normalized = Number(value);
    if (Number.isInteger(normalized) && normalized > 0) {
        return normalized;
    }
    return fallback;
}

function normalizeOptionalPositiveInteger(value) {
    const normalized = Number(value);
    if (Number.isInteger(normalized) && normalized > 0) {
        return normalized;
    }
    return null;
}
