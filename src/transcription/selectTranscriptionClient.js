import { normalizeTranscriptionMode } from "./normalizeTranscriptionMode.js";

/**
 * Selects a transcription client without leaking browser, model, upload, or
 * polling details into the UI event layer.
 */
export function selectTranscriptionClient({
    preferredMode,
    capabilities,
    createLocalClient,
    createServerClient
}) {
    const mode = normalizeTranscriptionMode(preferredMode);

    if (mode === "server") {
        return createServerClient();
    }

    if (mode === "local") {
        return createLocalClient();
    }

    if (canUseLocalTranscription(capabilities)) {
        return createLocalClient();
    }

    return createServerClient();
}

function canUseLocalTranscription(capabilities) {
    if (capabilities?.hasLocalTranscriptionAdapter !== true) {
        return false;
    }

    if (!capabilities?.hasWebAssembly) {
        return false;
    }

    if (!capabilities?.hasWebGpu) {
        return false;
    }

    return capabilities.hasLikelyEnoughMemory === true;
}
