import {
    BROWSER_WHISPER_DEVICE,
    canRequestWebGpuAdapter,
    resolveBrowserWhisperDeviceCandidates
} from "./BrowserWhisperBackendProbe.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export async function test_resolveBrowserWhisperDeviceCandidates_explicitWebGpu() {
    const devices = await resolveBrowserWhisperDeviceCandidates({
        selectedDevice: "webgpu",
        canUseWebGpu: async () => false
    });

    assert(devices.join(",") === "webgpu", "explicit WebGPU must not be rewritten");
}

export async function test_resolveBrowserWhisperDeviceCandidates_autoWithAdapterFallsBackToWasm() {
    const devices = await resolveBrowserWhisperDeviceCandidates({
        selectedDevice: "auto",
        canUseWebGpu: async () => true
    });

    assert(devices.join(",") === "webgpu,wasm", "auto with adapter must try WebGPU then WASM");
}

export async function test_resolveBrowserWhisperDeviceCandidates_autoWithoutAdapterUsesWasm() {
    const devices = await resolveBrowserWhisperDeviceCandidates({
        selectedDevice: "auto",
        canUseWebGpu: async () => false
    });

    assert(devices.join(",") === "wasm", "auto without adapter must use WASM");
}

export async function test_canRequestWebGpuAdapter_requiresRealAdapter() {
    const result = await canRequestWebGpuAdapter({
        navigatorRef: {
            gpu: {
                requestAdapter: async () => null
            }
        },
        logger: null
    });

    assert(result === false, "null adapter must not count as WebGPU capability");
}

export async function test_canRequestWebGpuAdapter_acceptsRealAdapter() {
    const result = await canRequestWebGpuAdapter({
        navigatorRef: {
            gpu: {
                requestAdapter: async () => ({ name: "adapter" })
            }
        },
        logger: null
    });

    assert(result === true, "real adapter must count as WebGPU capability");
}

export const BROWSER_WHISPER_BACKEND_PROBE_TESTS = [
    test_resolveBrowserWhisperDeviceCandidates_explicitWebGpu,
    test_resolveBrowserWhisperDeviceCandidates_autoWithAdapterFallsBackToWasm,
    test_resolveBrowserWhisperDeviceCandidates_autoWithoutAdapterUsesWasm,
    test_canRequestWebGpuAdapter_requiresRealAdapter,
    test_canRequestWebGpuAdapter_acceptsRealAdapter
];
