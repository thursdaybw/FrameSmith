import { normalizeTranscriptionMode } from "./normalizeTranscriptionMode.js";
import { selectTranscriptionClient } from "./selectTranscriptionClient.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function createClientFactories() {
    return {
        createLocalClient: () => ({ mode: "local" }),
        createServerClient: () => ({ mode: "server" })
    };
}

export function test_normalizeTranscriptionMode_defaultsToAuto() {
    assert(normalizeTranscriptionMode("") === "auto", "empty mode should become auto");
    assert(normalizeTranscriptionMode("unknown") === "auto", "unknown mode should become auto");
}

export function test_selectTranscriptionClient_forcesServer() {
    const client = selectTranscriptionClient({
        preferredMode: "server",
        capabilities: {
            hasLocalTranscriptionAdapter: true,
            hasWebAssembly: true,
            hasWebGpu: true,
            hasLikelyEnoughMemory: true
        },
        ...createClientFactories()
    });

    assert(client.mode === "server", "server mode should force server client");
}

export function test_selectTranscriptionClient_forcesLocal() {
    const client = selectTranscriptionClient({
        preferredMode: "local",
        capabilities: {
            hasLocalTranscriptionAdapter: false,
            hasWebAssembly: false,
            hasWebGpu: false,
            hasLikelyEnoughMemory: false
        },
        ...createClientFactories()
    });

    assert(client.mode === "local", "local mode should force local client for adapter testing");
}

export function test_selectTranscriptionClient_autoUsesServerUntilLocalAdapterIsReady() {
    const client = selectTranscriptionClient({
        preferredMode: "auto",
        capabilities: {
            hasLocalTranscriptionAdapter: false,
            hasWebAssembly: true,
            hasWebGpu: true,
            hasLikelyEnoughMemory: true
        },
        ...createClientFactories()
    });

    assert(client.mode === "server", "auto should use server while local adapter is not ready");
}

export function test_selectTranscriptionClient_autoUsesLocalWhenAdapterAndDeviceAreReady() {
    const client = selectTranscriptionClient({
        preferredMode: "auto",
        capabilities: {
            hasLocalTranscriptionAdapter: true,
            hasWebAssembly: true,
            hasWebGpu: true,
            hasLikelyEnoughMemory: true
        },
        ...createClientFactories()
    });

    assert(client.mode === "local", "auto should use local when adapter and device are ready");
}

export const TRANSCRIPTION_CLIENT_SELECTION_TESTS = [
    test_normalizeTranscriptionMode_defaultsToAuto,
    test_selectTranscriptionClient_forcesServer,
    test_selectTranscriptionClient_forcesLocal,
    test_selectTranscriptionClient_autoUsesServerUntilLocalAdapterIsReady,
    test_selectTranscriptionClient_autoUsesLocalWhenAdapterAndDeviceAreReady
];
