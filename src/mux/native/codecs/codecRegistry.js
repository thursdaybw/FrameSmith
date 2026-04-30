import { avc1Profile } from "./profiles/avc1Profile.js";
import { hvc1Profile } from "./profiles/hvc1Profile.js";
import { mp4aProfile } from "./profiles/mp4aProfile.js";
import { opusProfile } from "./profiles/opusProfile.js";

const CODEC_PROFILE_LIST = Object.freeze([
    avc1Profile,
    hvc1Profile,
    mp4aProfile,
    opusProfile
]);

const CODEC_PROFILES = Object.freeze(
    CODEC_PROFILE_LIST.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {})
);

const SAMPLE_ENTRY_TO_PROFILE = Object.freeze(
    CODEC_PROFILE_LIST.reduce((acc, profile) => {
        for (const sampleEntryType of profile.sampleEntryTypes) {
            acc[canonicalSampleEntryType(sampleEntryType)] = profile;
        }
        return acc;
    }, {})
);

const ALL_CODEC_CONFIG_KEYS = Object.freeze(
    Array.from(
        new Set(
            CODEC_PROFILE_LIST.flatMap((profile) =>
                Array.isArray(profile.configKeys) ? profile.configKeys : []
            )
        )
    )
);

function canonicalSampleEntryType(sampleEntryType) {
    if (typeof sampleEntryType !== "string" || sampleEntryType.length === 0) {
        return "";
    }
    return sampleEntryType.toLowerCase();
}

export function canonicalCodecId(codecName) {
    if (typeof codecName !== "string" || codecName.length === 0) {
        return "";
    }

    const lowered = codecName.toLowerCase();
    if (lowered === "opus") {
        return "opus";
    }
    const dotIndex = lowered.indexOf(".");
    if (dotIndex === -1) {
        return lowered;
    }
    return lowered.slice(0, dotIndex);
}

export function getCodecProfileByCodecName(codecName) {
    const canonical = canonicalCodecId(codecName);
    return CODEC_PROFILES[canonical] ?? null;
}

export function getCodecProfileBySampleEntryType(sampleEntryType) {
    return SAMPLE_ENTRY_TO_PROFILE[canonicalSampleEntryType(sampleEntryType)] ?? null;
}

export function requireCodecProfileByCodecName(codecName, callerLabel) {
    const profile = getCodecProfileByCodecName(codecName);
    if (profile) {
        return profile;
    }
    throw new Error(
        `${callerLabel}: unsupported codec '${codecName}'`
    );
}

export function requireCodecProfileBySampleEntryType(sampleEntryType, callerLabel) {
    const profile = getCodecProfileBySampleEntryType(sampleEntryType);
    if (profile) {
        return profile;
    }
    throw new Error(
        `${callerLabel}: unsupported SampleEntry type '${sampleEntryType}'`
    );
}

export function codecUsesImplicitAudioDurationTrim(codecName) {
    const profile = getCodecProfileByCodecName(codecName);
    return profile?.hasImplicitAudioDurationTrim === true;
}

export function getCodecProfiles() {
    return CODEC_PROFILES;
}

export function validateCodecConfigShapeForProfile({ codecConfig, profile, callerLabel }) {
    const requiredKeys = Array.isArray(profile.configKeys)
        ? profile.configKeys
        : [];

    for (const key of requiredKeys) {
        if (codecConfig[key] === undefined) {
            throw new Error(
                `${callerLabel}: codec '${profile.id}' missing required config key '${key}'`
            );
        }
    }

    for (const key of ALL_CODEC_CONFIG_KEYS) {
        if (requiredKeys.includes(key)) {
            continue;
        }
        if (codecConfig[key] !== undefined) {
            throw new Error(
                `${callerLabel}: codec '${profile.id}' must not carry foreign config key '${key}'`
            );
        }
    }
}

export function extractDemuxCodecConfigBySampleEntryType({ sampleEntryReport, callerLabel }) {
    if (!sampleEntryReport || !sampleEntryReport.box) {
        throw new Error(`${callerLabel}: missing SampleEntry report`);
    }
    const sampleEntryType = sampleEntryReport.box.type;
    const profile = requireCodecProfileBySampleEntryType(sampleEntryType, callerLabel);
    if (typeof profile.extractDemuxCodecConfig !== "function") {
        throw new Error(
            `${callerLabel}: codec profile '${profile.id}' does not define extractDemuxCodecConfig`
        );
    }
    const codecConfig = profile.extractDemuxCodecConfig({ sampleEntryReport, callerLabel });
    validateCodecConfigShapeForProfile({ codecConfig, profile, callerLabel });
    return codecConfig;
}

export function adaptStsdParamsFromSemanticTrackByCodec({
    codecName,
    semanticCodec,
    buildParameters,
    buildHints,
    callerLabel
}) {
    const profile = requireCodecProfileByCodecName(codecName, callerLabel);
    if (typeof profile.adaptStsdParamsFromSemanticTrack !== "function") {
        throw new Error(
            `${callerLabel}: codec profile '${profile.id}' does not define adaptStsdParamsFromSemanticTrack`
        );
    }
    const stsdParams = profile.adaptStsdParamsFromSemanticTrack({
        codecName,
        semanticCodec,
        buildParameters,
        buildHints
    });
    validateCodecConfigShapeForProfile({
        codecConfig: semanticCodec,
        profile,
        callerLabel
    });
    return stsdParams;
}

export function buildStsdAssemblyPlanFromParamsByCodec({
    stsdParams,
    callerLabel
}) {
    const profile = requireCodecProfileByCodecName(stsdParams?.codec, callerLabel);
    if (profile.supportsMuxEmission !== true || typeof profile.stsdAssemblyPath !== "string") {
        throw new Error(
            `${callerLabel}: codec '${stsdParams.codec}' has no mux emission support`
        );
    }
    if (typeof profile.buildStsdAssemblyInputFromParams !== "function") {
        throw new Error(
            `${callerLabel}: codec profile '${profile.id}' does not define buildStsdAssemblyInputFromParams`
        );
    }
    return {
        assemblyPath: profile.stsdAssemblyPath,
        assemblyInput: profile.buildStsdAssemblyInputFromParams(stsdParams)
    };
}
