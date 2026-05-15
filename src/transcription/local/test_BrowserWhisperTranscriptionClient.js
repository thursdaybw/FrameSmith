import {
    BROWSER_WHISPER_MODEL,
    createBrowserWhisperTranscriptionClient
} from "./BrowserWhisperTranscriptionClient.js";
import { TRANSCRIPTION_CLIENT_KIND } from "../TranscriptionClient.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export async function test_browserWhisperTranscriptionClient_returnsNormalizedWordResult() {
    const calls = [];
    const client = createBrowserWhisperTranscriptionClient({
        resolveDeviceCandidates: async ({ selectedDevice }) => {
            calls.push({ selectedDevice });
            return ["webgpu", "wasm"];
        },
        runtime: {
            async transcribe(request) {
                calls.push(request);
                return {
                    device: "webgpu",
                    result: {
                        text: "hello world",
                        chunks: [
                            { text: " hello", timestamp: [1, 1.4] },
                            { text: " world", timestamp: [1.4, 2] }
                        ]
                    }
                };
            }
        },
        now: (() => {
            const values = [1000, 2500];
            return () => values.shift();
        })()
    });

    const result = await client.transcribe({
        mediaSourceUrl: "blob:https://example.test/source",
        localDevice: "auto",
        timestampMode: "word"
    });

    assert(client.kind === TRANSCRIPTION_CLIENT_KIND.LOCAL_BROWSER, "local client kind must be exposed");
    assert(result.ok === true, "local client result must be ok on success");
    assert(result.model === BROWSER_WHISPER_MODEL.TINY_TIMESTAMPED, "local client must default to tiny timestamped model");
    assert(result.device === "webgpu", "local client must report selected runtime device");
    assert(result.text === "hello world", "local client must expose normalized transcript text");
    assert(result.words.length === 2, "local client must expose normalized words");
    assert(result.elapsedSeconds === 1.5, "local client must report elapsed seconds");
    assert(calls[0].selectedDevice === "auto", "local client must pass requested device to probe");
    assert(calls[1].sourceUrl === "blob:https://example.test/source", "local client must pass source URL to runtime");
    assert(calls[1].deviceCandidates.join(",") === "webgpu,wasm", "local client must pass resolved candidates to runtime");
}

export async function test_browserWhisperTranscriptionClient_requiresSourceUrl() {
    const client = createBrowserWhisperTranscriptionClient({
        runtime: {
            async transcribe() {
                throw new Error("runtime should not be called");
            }
        }
    });

    let didThrow = false;
    try {
        await client.transcribe({});
    } catch (error) {
        didThrow = true;
        assert(
            String(error?.message || "").includes("mediaSourceUrl is required"),
            "missing mediaSourceUrl must explain the request contract"
        );
    }

    assert(didThrow, "local client without mediaSourceUrl must throw");
}

export const BROWSER_WHISPER_TRANSCRIPTION_CLIENT_TESTS = [
    test_browserWhisperTranscriptionClient_returnsNormalizedWordResult,
    test_browserWhisperTranscriptionClient_requiresSourceUrl
];
