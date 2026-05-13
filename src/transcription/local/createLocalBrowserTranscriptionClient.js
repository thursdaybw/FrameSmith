/**
 * Placeholder for the local browser Whisper adapter.
 *
 * This intentionally fails loudly when forced, while Auto mode can continue to
 * use the stable server adapter until the local model spike is proven.
 */
export function createLocalBrowserTranscriptionClient() {
    return {
        mode: "local",
        sourceLabel: "local-browser-whisper",
        statusMessage: "Transcribing locally on this device...",
        stageName: "local_transcription",
        async transcribe() {
            throw new Error(
                "Local browser transcription is not wired yet. Use transcriptionMode=server while the local Whisper adapter is being built."
            );
        }
    };
}
