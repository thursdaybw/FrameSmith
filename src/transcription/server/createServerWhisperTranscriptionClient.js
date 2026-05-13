/**
 * Adapter for the existing server-side Whisper transcription flow.
 *
 * The existing implementation still owns upload, polling, recovery, and
 * transcript application. This adapter gives the app a stable boundary before
 * local transcription is introduced.
 */
export function createServerWhisperTranscriptionClient({
    startServerTranscriptionAndPoll
}) {
    if (typeof startServerTranscriptionAndPoll !== "function") {
        throw new Error("createServerWhisperTranscriptionClient: startServerTranscriptionAndPoll is required.");
    }

    return {
        mode: "server",
        sourceLabel: "server-whisper",
        statusMessage: "Transcribing on the server...",
        stageName: "server_transcription",
        transcribe: startServerTranscriptionAndPoll
    };
}
