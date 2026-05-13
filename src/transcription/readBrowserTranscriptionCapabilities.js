/**
 * Reads browser capabilities relevant to local transcription.
 *
 * This module reports facts only. It does not choose a transcription strategy.
 */
export function readBrowserTranscriptionCapabilities({
    navigatorRef = globalThis.navigator
} = {}) {
    const deviceMemory = readDeviceMemory(navigatorRef);

    return {
        hasWebGpu: !!navigatorRef?.gpu,
        hasWebAssembly: typeof WebAssembly !== "undefined",
        hasLocalTranscriptionAdapter: false,
        deviceMemory,
        hasLikelyEnoughMemory: hasLikelyEnoughMemory(deviceMemory)
    };
}

function readDeviceMemory(navigatorRef) {
    const memory = Number(navigatorRef?.deviceMemory);

    if (!Number.isFinite(memory) || memory <= 0) {
        return null;
    }

    return memory;
}

function hasLikelyEnoughMemory(deviceMemory) {
    if (deviceMemory === null) {
        return true;
    }

    return deviceMemory >= 4;
}
