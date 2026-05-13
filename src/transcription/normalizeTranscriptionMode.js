/**
 * Normalizes user/runtime transcription mode into the small set of modes
 * understood by the application boundary.
 */
export function normalizeTranscriptionMode(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "local") {
        return "local";
    }

    if (normalized === "server") {
        return "server";
    }

    return "auto";
}
