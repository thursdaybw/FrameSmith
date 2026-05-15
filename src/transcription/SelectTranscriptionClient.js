export const TRANSCRIPTION_MODE = Object.freeze({
    AUTO: "auto",
    LOCAL: "local",
    SERVER: "server"
});

/**
 * Select ordered transcription candidates.
 *
 * Policy lives here, not in the infrastructure clients.
 */
export async function selectTranscriptionClientCandidates({
    mode = TRANSCRIPTION_MODE.AUTO,
    clients
}) {
    const selectedMode = normalizeTranscriptionMode(mode);
    const availableClients = clients || {};

    if (selectedMode === TRANSCRIPTION_MODE.SERVER) {
        return requireClientList([availableClients.server], "server transcription client is required");
    }

    // Auto is intentionally local-browser transcription. The local adapter owns
    // WebGPU -> CPU/WASM fallback. Server transcription is expensive remote
    // infrastructure and should only run when the user explicitly selects it.
    return requireClientList([availableClients.local], "local transcription client is required");
}

export function normalizeTranscriptionMode(mode) {
    const value = typeof mode === "string" ? mode.trim().toLowerCase() : "";

    if (value === TRANSCRIPTION_MODE.LOCAL) {
        return TRANSCRIPTION_MODE.LOCAL;
    }

    if (value === TRANSCRIPTION_MODE.SERVER) {
        return TRANSCRIPTION_MODE.SERVER;
    }

    return TRANSCRIPTION_MODE.AUTO;
}

function requireClientList(candidates, message) {
    const usableClients = candidates.filter((client) => client && typeof client.transcribe === "function");

    if (usableClients.length === 0) {
        throw new Error(message);
    }

    return usableClients;
}
