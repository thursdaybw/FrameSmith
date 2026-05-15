export const BROWSER_WHISPER_DEVICE = Object.freeze({
    AUTO: "auto",
    WEBGPU: "webgpu",
    WASM: "wasm"
});

/**
 * Resolve browser Whisper backend candidates.
 *
 * `navigator.gpu` is not enough. Desktop Chromium can expose the API while still
 * refusing to return a real adapter. Auto mode must probe the adapter before
 * trusting WebGPU, then keep WASM as the safe fallback.
 */
export async function resolveBrowserWhisperDeviceCandidates({
    selectedDevice = BROWSER_WHISPER_DEVICE.AUTO,
    canUseWebGpu = canRequestWebGpuAdapter
} = {}) {
    const device = normalizeSelectedDevice(selectedDevice);

    if (device === BROWSER_WHISPER_DEVICE.WEBGPU) {
        return [BROWSER_WHISPER_DEVICE.WEBGPU];
    }

    if (device === BROWSER_WHISPER_DEVICE.WASM) {
        return [BROWSER_WHISPER_DEVICE.WASM];
    }

    if (await canUseWebGpu()) {
        return [BROWSER_WHISPER_DEVICE.WEBGPU, BROWSER_WHISPER_DEVICE.WASM];
    }

    return [BROWSER_WHISPER_DEVICE.WASM];
}

export async function canRequestWebGpuAdapter({
    navigatorRef = globalThis.navigator,
    logger = console
} = {}) {
    if (!navigatorRef?.gpu || typeof navigatorRef.gpu.requestAdapter !== "function") {
        return false;
    }

    try {
        const adapter = await navigatorRef.gpu.requestAdapter();
        return Boolean(adapter);
    } catch (error) {
        logger?.warn?.("[BrowserWhisper] WebGPU adapter probe failed", error);
        return false;
    }
}

function normalizeSelectedDevice(selectedDevice) {
    const value = typeof selectedDevice === "string" ? selectedDevice.trim().toLowerCase() : "";

    if (value === BROWSER_WHISPER_DEVICE.WEBGPU) {
        return BROWSER_WHISPER_DEVICE.WEBGPU;
    }

    if (value === BROWSER_WHISPER_DEVICE.WASM || value === "cpu") {
        return BROWSER_WHISPER_DEVICE.WASM;
    }

    return BROWSER_WHISPER_DEVICE.AUTO;
}
