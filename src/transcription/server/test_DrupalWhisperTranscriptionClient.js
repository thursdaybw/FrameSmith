import {
    createDrupalWhisperTranscriptionClient,
    createDrupalTranscriptionUploadUrl,
    createDrupalTranscriptionStatusUrl
} from "./DrupalWhisperTranscriptionClient.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function createRecordingFetchJson(responseFactory = () => ({ ok: true })) {
    const calls = [];
    const fetchJson = async (url, options = {}, dependencies = {}) => {
        calls.push({ url, options, dependencies });
        return responseFactory({ url, options, dependencies, calls });
    };
    return { fetchJson, calls };
}

export function test_drupalTranscriptionUploadUrl_containsRangeIdentity() {
    const url = createDrupalTranscriptionUploadUrl({
        baseUrl: "https://example.test/base/",
        taskId: "task-1",
        uploadId: "upload-1",
        offset: 1024,
        size: 256,
        totalSize: 4096
    });

    assert(url.pathname === "/api/framesmith/transcription/upload", "upload path must target Drupal upload endpoint");
    assert(url.searchParams.get("task_id") === "task-1", "upload URL must include task ID");
    assert(url.searchParams.get("upload_id") === "upload-1", "upload URL must include upload ID");
    assert(url.searchParams.get("offset") === "1024", "upload URL must include offset");
    assert(url.searchParams.get("size") === "256", "upload URL must include range size");
    assert(url.searchParams.get("total_size") === "4096", "upload URL must include total size");
}

export function test_drupalTranscriptionStatusUrl_containsTaskId() {
    const url = createDrupalTranscriptionStatusUrl({
        baseUrl: "https://example.test",
        taskId: "task-1"
    });

    assert(url.pathname === "/api/framesmith/transcription/status", "status path must target Drupal status endpoint");
    assert(url.searchParams.get("task_id") === "task-1", "status URL must include task ID");
}

export async function test_drupalWhisperClient_startsTaskWithJsonBody() {
    const { fetchJson, calls } = createRecordingFetchJson(() => ({ task_id: "task-1" }));
    const client = createDrupalWhisperTranscriptionClient({ fetchJson });

    const result = await client.startTask({
        baseUrl: "https://example.test",
        videoId: "video-1"
    });

    assert(result.task_id === "task-1", "start task result must be returned");
    assert(calls.length === 1, "start task must issue one request");
    assert(calls[0].url === "https://example.test/api/framesmith/transcription/start", "start task URL mismatch");
    assert(calls[0].options.method === "POST", "start task must POST");
    assert(calls[0].options.credentials === "include", "start task must include credentials");
    assert(JSON.parse(calls[0].options.body).video_id === "video-1", "start task must send video id");
}

export async function test_drupalWhisperClient_uploadsRangeWithTimeout() {
    const { fetchJson, calls } = createRecordingFetchJson(() => ({ status: "uploading" }));
    const client = createDrupalWhisperTranscriptionClient({ fetchJson });
    const body = { fake: "form-data" };

    const result = await client.uploadAudioRange({
        baseUrl: "https://example.test",
        taskId: "task-1",
        uploadId: "upload-1",
        offset: 0,
        size: 10,
        totalSize: 10,
        body,
        timeoutMs: 30_000
    });

    assert(result.status === "uploading", "upload result must be returned");
    assert(calls[0].url.includes("/api/framesmith/transcription/upload"), "upload must call upload endpoint");
    assert(calls[0].options.body === body, "upload body must be passed through");
    assert(calls[0].dependencies.timeoutMs === 30_000, "upload timeout must be passed to fetch helper");
}

export async function test_drupalWhisperClient_loadsInlineResultJsonWithoutFetch() {
    const { fetchJson, calls } = createRecordingFetchJson();
    const client = createDrupalWhisperTranscriptionClient({ fetchJson });

    const result = await client.loadResultJson({
        baseUrl: "https://example.test",
        statusPayload: {
            task: {
                result: {
                    json: { segments: [{ text: "Hello" }] }
                }
            }
        }
    });

    assert(result.segments[0].text === "Hello", "inline result JSON must be returned");
    assert(calls.length === 0, "inline result JSON must not fetch");
}

export async function test_drupalWhisperClient_loadsResultJsonByTaskId() {
    const { fetchJson, calls } = createRecordingFetchJson(() => ({
        result: {
            json: { segments: [{ text: "Hello from task" }] }
        }
    }));
    const client = createDrupalWhisperTranscriptionClient({ fetchJson });

    const result = await client.loadResultJson({
        baseUrl: "https://example.test",
        statusPayload: {},
        taskId: "task-1"
    });

    assert(result.segments[0].text === "Hello from task", "result JSON must be unwrapped from task result payload");
    assert(calls[0].url === "https://example.test/api/framesmith/transcription/result?task_id=task-1", "result URL mismatch");
}

export const DRUPAL_WHISPER_TRANSCRIPTION_CLIENT_TESTS = [
    test_drupalTranscriptionUploadUrl_containsRangeIdentity,
    test_drupalTranscriptionStatusUrl_containsTaskId,
    test_drupalWhisperClient_startsTaskWithJsonBody,
    test_drupalWhisperClient_uploadsRangeWithTimeout,
    test_drupalWhisperClient_loadsInlineResultJsonWithoutFetch,
    test_drupalWhisperClient_loadsResultJsonByTaskId
];
