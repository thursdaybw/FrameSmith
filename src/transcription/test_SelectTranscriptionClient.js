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

export async function test_selectTranscriptionClientCandidates_explicitServer() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "server",
        clients: {
            local: client("local-browser"),
            server: client("server")
        },
        canUseLocal: async () => true
    });

    assert(candidates.length === 1, "server mode must select one client");
    assert(candidates[0].kind === "server", "server mode must select server client");
}

export async function test_selectTranscriptionClientCandidates_explicitLocal() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "local",
        clients: {
            local: client("local-browser"),
            server: client("server")
        },
        canUseLocal: async () => false
    });

    assert(candidates.length === 1, "local mode must select one client");
    assert(candidates[0].kind === "local-browser", "local mode must select local client even before capability policy");
}

export async function test_selectTranscriptionClientCandidates_autoWithLocalUsesLocalThenServer() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "auto",
        clients: {
            local: client("local-browser"),
            server: client("server")
        },
        canUseLocal: async () => true
    });

    assert(candidates.length === 2, "auto with local capability must return fallback order");
    assert(candidates[0].kind === "local-browser", "auto must prefer local when credible");
    assert(candidates[1].kind === "server", "auto must keep server fallback");
}

export async function test_selectTranscriptionClientCandidates_autoWithoutLocalUsesServer() {
    const candidates = await selectTranscriptionClientCandidates({
        mode: "auto",
        clients: {
            local: client("local-browser"),
            server: client("server")
        },
        canUseLocal: async () => false
    });

    assert(candidates.length === 1, "auto without local capability must select one client");
    assert(candidates[0].kind === "server", "auto without local capability must select server");
}

export function test_normalizeTranscriptionMode_defaultsToAuto() {
    assert(normalizeTranscriptionMode("wat") === TRANSCRIPTION_MODE.AUTO, "unknown mode must normalize to auto");
    assert(normalizeTranscriptionMode("") === TRANSCRIPTION_MODE.AUTO, "empty mode must normalize to auto");
}

export const SELECT_TRANSCRIPTION_CLIENT_TESTS = [
    test_selectTranscriptionClientCandidates_explicitServer,
    test_selectTranscriptionClientCandidates_explicitLocal,
    test_selectTranscriptionClientCandidates_autoWithLocalUsesLocalThenServer,
    test_selectTranscriptionClientCandidates_autoWithoutLocalUsesServer,
    test_normalizeTranscriptionMode_defaultsToAuto
];
