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

export function test_normalizeTranscriptionRequest_defaultsToLocalBrowserShape() {
    const request = normalizeTranscriptionRequest({});

    assert(request.mediaSourceUrl === "", "media source URL must default to empty string");
    assert(request.localModel === "", "local model must default to empty string");
    assert(request.localDevice === "", "local device must default to empty string");
    assert(request.timestampMode === "", "timestamp mode must default to empty string");
    assert(!Object.hasOwn(request, "transcriptionBaseUrl"), "server base URL must not be part of the client-only request shape");
    assert(!Object.hasOwn(request, "videoId"), "server video ID must not be part of the client-only request shape");
    assert(!Object.hasOwn(request, "pollIntervalMs"), "server polling policy must not be part of the client-only request shape");
}

export function test_normalizeTranscriptionRequest_trimsLocalBrowserStrings() {
    const request = normalizeTranscriptionRequest({
        mediaSourceUrl: " blob:https://example.test/source ",
        localModel: " tiny ",
        localDevice: " webgpu ",
        timestampMode: " word "
    });

    assert(request.mediaSourceUrl === "blob:https://example.test/source", "media source URL must be trimmed");
    assert(request.localModel === "tiny", "local model must be trimmed");
    assert(request.localDevice === "webgpu", "local device must be trimmed");
    assert(request.timestampMode === "word", "timestamp mode must be trimmed");
}

export async function test_createTranscriptionClient_delegatesNormalizedRequest() {
    let receivedRequest = null;
    const client = createTranscriptionClient({
        kind: TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER,
        transcribe: async (request) => {
            receivedRequest = request;
            return { ok: true, request };
        }
    });

    const result = await client.transcribe({
        mediaSourceUrl: " blob:https://example.test/source ",
        localModel: " base "
    });

    assert(client.kind === TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER, "client kind must be exposed");
    assert(result.ok === true, "client result must be returned");
    assert(receivedRequest.mediaSourceUrl === "blob:https://example.test/source", "transcribe must receive normalized source URL");
    assert(receivedRequest.localModel === "base", "transcribe must receive normalized local model");
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
    test_normalizeTranscriptionRequest_defaultsToLocalBrowserShape,
    test_normalizeTranscriptionRequest_trimsLocalBrowserStrings,
    test_createTranscriptionClient_delegatesNormalizedRequest,
    test_createTranscriptionClient_requiresTranscribeFunction
];
