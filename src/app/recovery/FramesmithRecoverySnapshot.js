const FRAMESMITH_RECOVERY_SCHEMA_VERSION = 1;

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue(value) {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return null;
    }
}

function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value) {
    const text = cleanString(value);
    return text.length > 0 ? text : null;
}

function cleanNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function cleanArray(value) {
    return Array.isArray(value) ? cloneJsonValue(value) : [];
}

function cleanObject(value) {
    return isPlainObject(value) ? cloneJsonValue(value) : null;
}

export function createEmptyFramesmithRecoverySnapshot({ now = Date.now } = {}) {
    const timestamp = now();
    return {
        schemaVersion: FRAMESMITH_RECOVERY_SCHEMA_VERSION,
        savedAt: timestamp,
        baseUrl: null,
        videoId: null,
        videoSourceKey: null,
        taskId: null,
        taskStatus: null,
        transcriptReady: false,
        statusPayload: null,
        taskInit: null,
        uploadResult: null,
        provisionResult: null,
        transcriptionResult: null,
        transcriptFetchResult: null,
        uploadProgress: null,
        uploadAdaptiveState: null,
        audioMeta: null,
        whisperJson: null,
        overlayItems: [],
        transcriptText: "",
        lastError: null
    };
}

export function normalizeFramesmithRecoverySnapshot(input, { now = Date.now } = {}) {
    const source = isPlainObject(input) ? input : {};
    const empty = createEmptyFramesmithRecoverySnapshot({ now });
    return {
        ...empty,
        schemaVersion: FRAMESMITH_RECOVERY_SCHEMA_VERSION,
        savedAt: cleanNumber(source.savedAt) || empty.savedAt,
        baseUrl: cleanNullableString(source.baseUrl),
        videoId: cleanNullableString(source.videoId),
        videoSourceKey: cleanNullableString(source.videoSourceKey),
        taskId: cleanNullableString(source.taskId),
        taskStatus: cleanNullableString(source.taskStatus),
        transcriptReady: source.transcriptReady === true,
        statusPayload: cleanObject(source.statusPayload),
        taskInit: cleanObject(source.taskInit),
        uploadResult: cleanObject(source.uploadResult),
        provisionResult: cleanObject(source.provisionResult),
        transcriptionResult: cleanObject(source.transcriptionResult),
        transcriptFetchResult: cleanObject(source.transcriptFetchResult),
        uploadProgress: cleanObject(source.uploadProgress),
        uploadAdaptiveState: cleanObject(source.uploadAdaptiveState),
        audioMeta: cleanObject(source.audioMeta),
        whisperJson: cleanObject(source.whisperJson),
        overlayItems: cleanArray(source.overlayItems),
        transcriptText: typeof source.transcriptText === "string" ? source.transcriptText : "",
        lastError: cleanNullableString(source.lastError)
    };
}

export function mergeFramesmithRecoverySnapshot(previous, patch, { now = Date.now } = {}) {
    const base = normalizeFramesmithRecoverySnapshot(previous, { now });
    const source = isPlainObject(patch) ? patch : {};
    const merged = {
        ...base,
        ...cloneJsonValue(source),
        schemaVersion: FRAMESMITH_RECOVERY_SCHEMA_VERSION,
        savedAt: now()
    };
    return normalizeFramesmithRecoverySnapshot(merged, { now });
}

export function hasFramesmithRecoveryTask(snapshot) {
    return cleanString(snapshot?.taskId).length > 0;
}

export function hasFramesmithRecoveryTranscript(snapshot) {
    return (
        typeof snapshot?.transcriptText === "string" && snapshot.transcriptText.trim().length > 0
    ) || (
        Array.isArray(snapshot?.overlayItems) && snapshot.overlayItems.length > 0
    ) || isPlainObject(snapshot?.whisperJson);
}

export const __test__ = {
    FRAMESMITH_RECOVERY_SCHEMA_VERSION,
    cloneJsonValue,
    cleanString,
    cleanObject
};
