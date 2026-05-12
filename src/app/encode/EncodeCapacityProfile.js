const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;

function toPositiveNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return fallback;
    }
    return number;
}

function toEvenDimension(value) {
    const number = Math.max(2, Math.round(toPositiveNumber(value, 2)));
    return number % 2 === 0 ? number : number - 1;
}

function normalizeForcedProfileName(value) {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (
        normalized === "desktop" ||
        normalized === "desktop-default" ||
        normalized === "default"
    ) {
        return "desktop-default";
    }
    if (
        normalized === "mobile" ||
        normalized === "mobile-safe" ||
        normalized === "constrained"
    ) {
        return "mobile-safe";
    }
    return null;
}

function detectConstrainedSignals(environment = {}) {
    const deviceMemory = Number(environment.deviceMemory);
    const hardwareConcurrency = Number(environment.hardwareConcurrency);
    const coarsePointer = environment.coarsePointer === true;
    const userAgent = typeof environment.userAgent === "string" ? environment.userAgent : "";
    const mobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(userAgent);
    const lowDeviceMemory = Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 4;
    const lowHardwareConcurrency =
        Number.isFinite(hardwareConcurrency) &&
        hardwareConcurrency > 0 &&
        hardwareConcurrency <= 4;

    return {
        coarsePointer,
        mobileUserAgent,
        lowDeviceMemory,
        lowHardwareConcurrency
    };
}

function explainProfileSelection({
    profileName,
    forcedProfileName,
    signals
}) {
    if (forcedProfileName) {
        return `forced-${forcedProfileName}`;
    }
    if (profileName !== "mobile-safe") {
        return "default-capacity";
    }
    if (signals.coarsePointer || signals.mobileUserAgent) {
        return "mobile-or-constrained-memory";
    }
    if (signals.lowDeviceMemory) {
        return "low-device-memory";
    }
    if (signals.lowHardwareConcurrency) {
        return "low-hardware-concurrency";
    }
    return "constrained-browser";
}

function createProfile({
    name,
    reason,
    outputWidth,
    outputHeight,
    fps,
    decodeChunkSeconds,
    diagnostics
}) {
    return Object.freeze({
        name,
        outputWidth: toEvenDimension(outputWidth),
        outputHeight: toEvenDimension(outputHeight),
        fps: toPositiveNumber(fps, 24),
        decodeChunkSeconds,
        reason,
        diagnostics: Object.freeze({ ...diagnostics })
    });
}

export function createEncodeCapacityProfile({
    environment = {},
    defaults = {},
    forcedProfile = null
} = {}) {
    const defaultOutputWidth = toEvenDimension(defaults.outputWidth ?? 720);
    const defaultOutputHeight = toEvenDimension(defaults.outputHeight ?? 1280);
    const defaultFps = toPositiveNumber(defaults.fps, 30);
    const defaultDecodeChunkSeconds = defaults.decodeChunkSeconds ?? null;
    const forcedProfileName = normalizeForcedProfileName(forcedProfile);
    const signals = detectConstrainedSignals(environment);
    const shouldUseMobileSafe =
        forcedProfileName === "mobile-safe" ||
        (
            forcedProfileName !== "desktop-default" &&
            (
                signals.coarsePointer ||
                signals.mobileUserAgent ||
                signals.lowDeviceMemory ||
                signals.lowHardwareConcurrency
            )
        );
    const profileName = shouldUseMobileSafe ? "mobile-safe" : "desktop-default";
    const diagnostics = {
        deviceMemory: Number.isFinite(Number(environment.deviceMemory))
            ? Number(environment.deviceMemory)
            : null,
        hardwareConcurrency: Number.isFinite(Number(environment.hardwareConcurrency))
            ? Number(environment.hardwareConcurrency)
            : null,
        coarsePointer: signals.coarsePointer,
        mobileUserAgent: signals.mobileUserAgent,
        forcedProfile: forcedProfileName
    };
    const reason = explainProfileSelection({
        profileName,
        forcedProfileName,
        signals
    });

    if (profileName === "mobile-safe") {
        return createProfile({
            name: "mobile-safe",
            outputWidth: Math.min(defaultOutputWidth, 540),
            outputHeight: Math.min(defaultOutputHeight, 960),
            fps: Math.min(defaultFps, 24),
            decodeChunkSeconds: 1,
            reason,
            diagnostics
        });
    }

    return createProfile({
        name: "desktop-default",
        outputWidth: defaultOutputWidth,
        outputHeight: defaultOutputHeight,
        fps: defaultFps,
        decodeChunkSeconds: defaultDecodeChunkSeconds,
        reason,
        diagnostics
    });
}

export function resolveDecodeChunkSecondsForCapacityProfile({
    profile,
    exportRange,
    defaultResolver
}) {
    if (Number.isFinite(profile?.decodeChunkSeconds) && profile.decodeChunkSeconds > 0) {
        return profile.decodeChunkSeconds;
    }
    if (typeof defaultResolver === "function") {
        return defaultResolver(exportRange);
    }
    return null;
}

export function readEncodeCapacityEnvironment({
    navigatorRef = globalThis.navigator,
    matchMediaRef = globalThis.matchMedia
} = {}) {
    let coarsePointer = false;
    if (typeof matchMediaRef === "function") {
        try {
            coarsePointer = matchMediaRef("(pointer: coarse)")?.matches === true;
        } catch {
            coarsePointer = false;
        }
    }

    return {
        deviceMemory: navigatorRef?.deviceMemory ?? null,
        hardwareConcurrency: navigatorRef?.hardwareConcurrency ?? null,
        userAgent: navigatorRef?.userAgent ?? "",
        coarsePointer
    };
}
