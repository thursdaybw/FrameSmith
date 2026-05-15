import {
    TRANSCRIPTION_CLIENT_KIND,
    createTranscriptionClient,
    normalizeTranscriptionRequest
} from "./TranscriptionClient.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_normalizeTranscriptionRequest_preservesStableDefaults() {
    const request = normalizeTranscriptionRequest({});

    assert(request.targetSampleRate === 16_000, "default sample rate must be Whisper-ready");
    assert(request.targetChannels === 1, "default channel count must be mono");
    assert(request.pollIntervalMs === 3_000, "default poll interval must match existing server flow");
    assert(request.timeoutMs === 10 * 60 * 1_000, "default timeout must match existing server flow");
    assert(request.slowPollIntervalMs === 15_000, "default slow poll interval must match existing server flow");
    assert(request.hardTimeoutMs === null, "hard timeout should remain optional unless caller supplies it");
}

export function test_normalizeTranscriptionRequest_trimsOptionalStrings() {
    const request = normalizeTranscriptionRequest({
        transcriptionBaseUrl: " https://example.test ",
        videoId: " video-1 ",
        localModel: " tiny ",
        localDevice: " webgpu ",
        timestampMode: " word "
    });

    assert(request.transcriptionBaseUrl === "https://example.test", "base URL must be trimmed");
    assert(request.videoId === "video-1", "video ID must be trimmed");
    assert(request.localModel === "tiny", "local model must be trimmed");
    assert(request.localDevice === "webgpu", "local device must be trimmed");
    assert(request.timestampMode === "word", "timestamp mode must be trimmed");
}

export async function test_createTranscriptionClient_delegatesNormalizedRequest() {
    let receivedRequest = null;
    const client = createTranscriptionClient({
        kind: TRANSCRIPTION_CLIENT_KIND.SERVER,
        transcribe: async (request) => {
            receivedRequest = request;
            return { ok: true, request };
        }
    });

    const result = await client.transcribe({
        videoId: " video-1 ",
        targetSampleRate: "bad"
    });

    assert(client.kind === TRANSCRIPTION_CLIENT_KIND.SERVER, "client kind must be exposed");
    assert(result.ok === true, "client result must be returned");
    assert(receivedRequest.videoId === "video-1", "transcribe must receive normalized request");
    assert(receivedRequest.targetSampleRate === 16_000, "bad sample rate must normalize to default");
}

export function test_createTranscriptionClient_requiresTranscribeFunction() {
    let didThrow = false;
    try {
        createTranscriptionClient({
            kind: TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER,
            transcribe: null
        });
    } catch (error) {
        didThrow = true;
        assert(
            String(error?.message || "").includes("transcribe function is required"),
            "missing transcribe function must explain the boundary violation"
        );
    }

    assert(didThrow, "client without transcribe function must throw");
}

export const TRANSCRIPTION_CLIENT_TESTS = [
    test_normalizeTranscriptionRequest_preservesStableDefaults,
    test_normalizeTranscriptionRequest_trimsOptionalStrings,
    test_createTranscriptionClient_delegatesNormalizedRequest,
    test_createTranscriptionClient_requiresTranscribeFunction
];
