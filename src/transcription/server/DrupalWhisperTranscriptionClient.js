import { fetchJsonOrThrow } from "../../network/fetchJsonOrThrow.js";

/**
 * Drupal Whisper transcription HTTP adapter.
 *
 * This module owns Drupal endpoint shapes and HTTP mechanics only. It must not
 * update UI, mutate recovery state, apply captions, or decide local/server
 * fallback policy. Those are application/UI responsibilities above this adapter.
 */
export function createDrupalWhisperTranscriptionClient({
    fetchJson = fetchJsonOrThrow
} = {}) {
    return {
        startTask({ baseUrl, videoId }) {
            return startDrupalTranscriptionTask({ fetchJson, baseUrl, videoId });
        },
        uploadAudioRange({
            baseUrl,
            taskId,
            uploadId,
            offset,
            size,
            totalSize,
            body,
            timeoutMs = 0
        }) {
            return uploadDrupalTranscriptionAudioRange({
                fetchJson,
                baseUrl,
                taskId,
                uploadId,
                offset,
                size,
                totalSize,
                body,
                timeoutMs
            });
        },
        reportUploadFailure({ baseUrl, payload }) {
            return reportDrupalTranscriptionUploadFailure({ fetchJson, baseUrl, payload });
        },
        fetchStatus({ baseUrl, taskId }) {
            return fetchDrupalTranscriptionStatus({ fetchJson, baseUrl, taskId });
        },
        loadResultJson({ baseUrl, statusPayload, taskId = "" }) {
            return loadDrupalTranscriptionResultJson({ fetchJson, baseUrl, statusPayload, taskId });
        }
    };
}

export function createDrupalTranscriptionStartUrl(baseUrl) {
    return new URL("/api/framesmith/transcription/start", baseUrl);
}

export function createDrupalTranscriptionUploadUrl({
    baseUrl,
    taskId,
    uploadId,
    offset,
    size,
    totalSize
}) {
    const uploadUrl = new URL("/api/framesmith/transcription/upload", baseUrl);
    uploadUrl.searchParams.set("task_id", taskId);
    uploadUrl.searchParams.set("upload_id", uploadId);
    uploadUrl.searchParams.set("offset", String(offset));
    uploadUrl.searchParams.set("size", String(size));
    uploadUrl.searchParams.set("total_size", String(totalSize));
    return uploadUrl;
}

export function createDrupalTranscriptionUploadFailureUrl(baseUrl) {
    return new URL("/api/framesmith/transcription/upload-failure", baseUrl);
}

export function createDrupalTranscriptionStatusUrl({ baseUrl, taskId }) {
    const statusUrl = new URL("/api/framesmith/transcription/status", baseUrl);
    statusUrl.searchParams.set("task_id", taskId);
    return statusUrl;
}

export function createDrupalTranscriptionResultUrl({ baseUrl, taskId }) {
    const resultUrl = new URL("/api/framesmith/transcription/result", baseUrl);
    resultUrl.searchParams.set("task_id", taskId);
    return resultUrl;
}

async function startDrupalTranscriptionTask({ fetchJson, baseUrl, videoId }) {
    const startUrl = createDrupalTranscriptionStartUrl(baseUrl);
    return fetchJson(startUrl.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            video_id: videoId
        })
    });
}

async function uploadDrupalTranscriptionAudioRange({
    fetchJson,
    baseUrl,
    taskId,
    uploadId,
    offset,
    size,
    totalSize,
    body,
    timeoutMs
}) {
    const uploadUrl = createDrupalTranscriptionUploadUrl({
        baseUrl,
        taskId,
        uploadId,
        offset,
        size,
        totalSize
    });
    return fetchJson(uploadUrl.toString(), {
        method: "POST",
        credentials: "include",
        body
    }, {
        timeoutMs
    });
}

async function reportDrupalTranscriptionUploadFailure({ fetchJson, baseUrl, payload }) {
    const failureUrl = createDrupalTranscriptionUploadFailureUrl(baseUrl);
    return fetchJson(failureUrl.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
}

async function fetchDrupalTranscriptionStatus({ fetchJson, baseUrl, taskId }) {
    const statusUrl = createDrupalTranscriptionStatusUrl({ baseUrl, taskId });
    return fetchJson(statusUrl.toString(), {
        method: "GET",
        credentials: "include"
    });
}

async function loadDrupalTranscriptionResultJson({ fetchJson, baseUrl, statusPayload, taskId = "" }) {
    const inlineJson = statusPayload?.task?.result?.json;
    if (inlineJson && typeof inlineJson === "object") {
        return inlineJson;
    }

    const jsonUrl = readResultJsonUrl({ baseUrl, statusPayload });
    if (jsonUrl) {
        return fetchJson(jsonUrl.toString(), {
            method: "GET",
            credentials: "include"
        });
    }

    const resolvedTaskId = readResultTaskId({ statusPayload, taskId });
    if (!resolvedTaskId) {
        return null;
    }

    const resultUrl = createDrupalTranscriptionResultUrl({
        baseUrl,
        taskId: resolvedTaskId
    });
    const resultPayload = await fetchJson(resultUrl.toString(), {
        method: "GET",
        credentials: "include"
    });
    const resultJson = resultPayload?.result?.json;
    return resultJson && typeof resultJson === "object" ? resultJson : null;
}

function readResultJsonUrl({ baseUrl, statusPayload }) {
    const jsonUrlValue = String(
        statusPayload?.json_url ||
        statusPayload?.task?.result?.json_url ||
        ""
    ).trim();

    return jsonUrlValue ? new URL(jsonUrlValue, baseUrl) : null;
}

function readResultTaskId({ statusPayload, taskId }) {
    return String(taskId || statusPayload?.task_id || statusPayload?.task?.task_id || "").trim();
}
