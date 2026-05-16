import {
    TRANSCRIPTION_MODE,
    normalizeTranscriptionMode,
    selectTranscriptionClientCandidates
} from "./SelectTranscriptionClient.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function client(kind) {
    return {
        kind,
        transcribe() {}
    };
}

export async function test_selectTranscriptionClientCandidates_explicitLocal() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "local",
        clients: {
            local: client("local-browser"),
            server: client("server")
        }
    });

    assert(candidates.length === 1, "local mode must select one client");
    assert(candidates[0].kind === "local-browser", "local mode must select local client");
}

export async function test_selectTranscriptionClientCandidates_autoUsesLocalClient() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "auto",
        clients: {
            local: client("local-browser"),
            server: client("server")
        }
    });

    assert(candidates.length === 1, "auto must select local browser transcription only");
    assert(candidates[0].kind === "local-browser", "auto must use local browser transcription");
}

export async function test_selectTranscriptionClientCandidates_serverModeDoesNotSelectServer() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "server",
        clients: {
            local: client("local-browser"),
            server: client("server")
        }
    });

    assert(candidates.length === 1, "server mode must not select a remote client");
    assert(candidates[0].kind === "local-browser", "server mode must normalize back to local product behavior");
}

export function test_normalizeTranscriptionMode_defaultsToAuto() {
    assert(normalizeTranscriptionMode("wat") === TRANSCRIPTION_MODE.AUTO, "unknown mode must normalize to auto");
    assert(normalizeTranscriptionMode("server") === TRANSCRIPTION_MODE.AUTO, "server mode must normalize to auto");
    assert(normalizeTranscriptionMode("") === TRANSCRIPTION_MODE.AUTO, "empty mode must normalize to auto");
}

export const SELECT_TRANSCRIPTION_CLIENT_TESTS = [
    test_selectTranscriptionClientCandidates_explicitLocal,
    test_selectTranscriptionClientCandidates_autoUsesLocalClient,
    test_selectTranscriptionClientCandidates_serverModeDoesNotSelectServer,
    test_normalizeTranscriptionMode_defaultsToAuto
];
