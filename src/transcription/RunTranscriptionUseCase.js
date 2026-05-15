import {
    TRANSCRIPTION_MODE,
    selectTranscriptionClientCandidates
} from "./SelectTranscriptionClient.js";

/**
 * Application-level transcription orchestration.
 *
 * This use-case chooses client order, reports stage changes, and handles fallback.
 * It does not know Drupal endpoint shapes or Transformers.js runtime details.
 */
export function createRunTranscriptionUseCase({
    clients,
    selectCandidates = selectTranscriptionClientCandidates,
    canUseLocal = async () => false,
    applyResult = async (result) => result,
    reporter = createNullTranscriptionReporter()
}) {
    return {
        async run(request = {}) {
            const mode = request.mode || TRANSCRIPTION_MODE.AUTO;
            reporter.stage?.("select_client", { mode });

            const candidates = await selectCandidates({
                mode,
                clients,
                canUseLocal
            });

            let lastError = null;

            for (let index = 0; index < candidates.length; index += 1) {
                const client = candidates[index];
                const isFallbackAttempt = index > 0;

                try {
                    reporter.stage?.("transcribe", {
                        mode,
                        clientKind: client.kind,
                        fallback: isFallbackAttempt
                    });

                    const result = await client.transcribe(request);

                    reporter.stage?.("apply_transcript", {
                        mode,
                        clientKind: client.kind
                    });

                    const appliedResult = await applyResult({
                        result,
                        request,
                        client
                    });

                    reporter.stage?.("done", {
                        mode,
                        clientKind: client.kind
                    });

                    return {
                        ...result,
                        appliedResult,
                        selectedClientKind: client.kind,
                        attemptedClientKinds: candidates.slice(0, index + 1).map((candidate) => candidate.kind),
                        fallbackUsed: isFallbackAttempt
                    };
                } catch (error) {
                    lastError = error;
                    reporter.failure?.({
                        mode,
                        clientKind: client.kind,
                        error,
                        willFallback: index < candidates.length - 1
                    });

                    if (index >= candidates.length - 1) {
                        throw error;
                    }
                }
            }

            throw lastError || new Error("No transcription client could run.");
        }
    };
}

export function createNullTranscriptionReporter() {
    return Object.freeze({
        stage() {},
        failure() {}
    });
}
