import {
    createEncodeCapacityProfile,
    resolveDecodeChunkSecondsForCapacityProfile
} from "./EncodeCapacityProfile.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

function createDefaultProfile(args = {}) {
    return createEncodeCapacityProfile({
        defaults: {
            outputWidth: 720,
            outputHeight: 1280,
            fps: 30,
            decodeChunkSeconds: null
        },
        ...args
    });
}

export function test_encodeCapacityProfile_preservesDesktopDefaults() {
    const profile = createDefaultProfile({
        environment: {
            deviceMemory: 8,
            hardwareConcurrency: 8,
            userAgent: "Mozilla/5.0 Desktop",
            coarsePointer: false
        }
    });

    assert(profile.name === "desktop-default", "desktop should use default profile");
    assert(profile.outputWidth === 720, "desktop width should preserve default");
    assert(profile.outputHeight === 1280, "desktop height should preserve default");
    assert(profile.fps === 30, "desktop fps should preserve default");
    assert(profile.decodeChunkSeconds === null, "desktop chunk seconds should preserve resolver behavior");
}

export function test_encodeCapacityProfile_selectsMobileSafeForCoarsePointer() {
    const profile = createDefaultProfile({
        environment: {
            deviceMemory: 8,
            hardwareConcurrency: 8,
            userAgent: "Mozilla/5.0 Desktop",
            coarsePointer: true
        }
    });

    assert(profile.name === "mobile-safe", "coarse pointer should select mobile-safe");
    assert(profile.outputWidth === 540, "mobile-safe width should reduce output");
    assert(profile.outputHeight === 960, "mobile-safe height should reduce output");
    assert(profile.fps === 24, "mobile-safe fps should reduce output");
    assert(profile.decodeChunkSeconds === 1, "mobile-safe decode chunks should be smaller");
}

export function test_encodeCapacityProfile_selectsMobileSafeForLowDeviceMemory() {
    const profile = createDefaultProfile({
        environment: {
            deviceMemory: 4,
            hardwareConcurrency: 8,
            userAgent: "Mozilla/5.0 Desktop",
            coarsePointer: false
        }
    });

    assert(profile.name === "mobile-safe", "low device memory should select mobile-safe");
    assert(profile.reason === "low-device-memory", "low memory reason should be explicit");
}

export function test_encodeCapacityProfile_allowsForcedDesktopOverride() {
    const profile = createDefaultProfile({
        forcedProfile: "desktop",
        environment: {
            deviceMemory: 2,
            hardwareConcurrency: 2,
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile",
            coarsePointer: true
        }
    });

    assert(profile.name === "desktop-default", "force desktop should preserve desktop profile");
    assert(profile.reason === "forced-desktop-default", "forced profile reason should be explicit");
}

export function test_encodeCapacityProfile_keepsOutputDimensionsEvenAndPortrait() {
    const profile = createEncodeCapacityProfile({
        forcedProfile: "mobile-safe",
        defaults: {
            outputWidth: 721,
            outputHeight: 1281,
            fps: 30,
            decodeChunkSeconds: null
        },
        environment: {}
    });

    assert(profile.outputWidth % 2 === 0, "width must be even");
    assert(profile.outputHeight % 2 === 0, "height must be even");
    assert(profile.outputHeight > profile.outputWidth, "profile must remain portrait");
}

export function test_encodeCapacityProfile_usesProfileDecodeChunkWhenPresent() {
    const profile = createDefaultProfile({
        forcedProfile: "mobile-safe",
        environment: {}
    });
    const chunkSeconds = resolveDecodeChunkSecondsForCapacityProfile({
        profile,
        exportRange: { startSeconds: 0, endSeconds: 10 },
        defaultResolver: () => 4
    });

    assert(chunkSeconds === 1, "mobile-safe profile should override chunk seconds");
}

export const ENCODE_CAPACITY_PROFILE_TESTS = [
    test_encodeCapacityProfile_preservesDesktopDefaults,
    test_encodeCapacityProfile_selectsMobileSafeForCoarsePointer,
    test_encodeCapacityProfile_selectsMobileSafeForLowDeviceMemory,
    test_encodeCapacityProfile_allowsForcedDesktopOverride,
    test_encodeCapacityProfile_keepsOutputDimensionsEvenAndPortrait,
    test_encodeCapacityProfile_usesProfileDecodeChunkWhenPresent
];
