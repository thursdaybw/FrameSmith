import { createRunTranscriptionUseCase } from "./RunTranscriptionUseCase.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function client(kind, transcribe) {
    return { kind, transcribe };
}

export async function test_runTranscriptionUseCase_usesSelectedClientAndAppliesResult() {
    const events = [];
    const useCase = createRunTranscriptionUseCase({
        clients: {},
        selectCandidates: async () => [
            client("local-browser", async () => ({
                ok: true,
                text: "hello",
                whisperJson: { segments: [{ text: "hello" }] }
            }))
        ],
        applyResult: async ({ result, client }) => ({
            applied: true,
            clientKind: client.kind,
            text: result.text
        }),
        reporter: {
            stage(stage, payload) {
                events.push({ type: "stage", stage, payload });
            },
            failure(payload) {
                events.push({ type: "failure", payload });
            }
        }
    });

    const result = await useCase.run({ mode: "local" });

    assert(result.ok === true, "use case must return transcription result");
    assert(result.appliedResult.applied === true, "use case must apply successful result");
    assert(result.selectedClientKind === "local-browser", "use case must report selected client");
    assert(result.fallbackUsed === false, "single successful client must not report fallback");
    assert(events.some((event) => event.stage === "done"), "use case must report done stage");
}

export async function test_runTranscriptionUseCase_fallsBackToSecondClient() {
    const failures = [];
    const useCase = createRunTranscriptionUseCase({
        clients: {},
        selectCandidates: async () => [
            client("local-browser", async () => {
                throw new Error("local failed");
            }),
            client("server", async () => ({
                ok: true,
                taskId: "task-1",
                pollResult: { ok: true }
            }))
        ],
        applyResult: async ({ result }) => result,
        reporter: {
            stage() {},
            failure(payload) {
                failures.push(payload);
            }
        }
    });

    const result = await useCase.run({ mode: "auto" });

    assert(result.selectedClientKind === "server", "fallback must use second client");
    assert(result.fallbackUsed === true, "fallback result must report fallback");
    assert(result.attemptedClientKinds.join(",") === "local-browser,server", "attempt order must be reported");
    assert(failures.length === 1, "failed first client must be reported once");
    assert(failures[0].willFallback === true, "first failure must report fallback");
}

export const RUN_TRANSCRIPTION_USE_CASE_TESTS = [
    test_runTranscriptionUseCase_usesSelectedClientAndAppliesResult,
    test_runTranscriptionUseCase_fallsBackToSecondClient
];
