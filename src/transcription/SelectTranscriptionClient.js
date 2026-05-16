export const TRANSCRIPTION_MODE = Object.freeze({
    AUTO: "auto",
    LOCAL: "local"
});

/**
 * Select ordered transcription candidates.
 *
 * FrameSmith transcription is client-side only in the mainline product path.
 * The local adapter owns WebGPU -> CPU/WASM fallback, so this policy should not
 * silently route work to remote infrastructure.
 */
export async function selectTranscriptionClientCandidates({
    mode = TRANSCRIPTION_MODE.AUTO,
    clients
}) {
    normalizeTranscriptionMode(mode);
    const availableClients = clients || {};

    return requireClientList([availableClients.local], "local transcription client is required");
}

export function normalizeTranscriptionMode(mode) {
    const value = typeof mode === "string" ? mode.trim().toLowerCase() : "";

    if (value === TRANSCRIPTION_MODE.LOCAL) {
        return TRANSCRIPTION_MODE.LOCAL;
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
