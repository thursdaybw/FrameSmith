import {
    normalizeWebCodecsDopsToFfmpegCompact,
    NotWebCodecsOpusHeadError
} from "../normalization/codecs/dOps/normalizeWebCodecsDOpsToMp4Payload.js";

import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";

import { parseAudioSpecificConfigFromEsds } from "../codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { getCodecContainerConfig } from "../codec-normalization/getCodecContainerConfig.js";

export function adaptAudioCodecConfigurationToStsdParams({
    semanticCodec,
    buildParameters,
    buildHints
}) {
    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------

    if (!semanticCodec || typeof semanticCodec !== "object") {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: semanticCodec is required"
        );
    }

    if (!buildParameters || typeof buildParameters !== "object") {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: buildParameters is required"
        );
    }

    if (!buildHints || typeof buildHints !== "object") {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: buildHints is required"
        );
    }

    const { containerBytes } = getCodecContainerConfig(semanticCodec);

    let stsdParams;

    // =========================================================
    // OPUS
    // =========================================================

    if (semanticCodec.codec === "opus") {
        let normalizedPayload;

        try {
            normalizedPayload =
                normalizeWebCodecsDopsToFfmpegCompact(containerBytes);
        } catch (err) {
            if (err instanceof NotWebCodecsOpusHeadError) {
                normalizedPayload = containerBytes;
            } else {
                throw err;
            }
        }

        if (normalizedPayload.length !== 7) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: normalized dOps must be 7 bytes"
            );
        }

        const channelCount = buildParameters.channelCount;
        const sampleRate   = buildParameters.sampleRate;

        if (!Number.isInteger(channelCount) || channelCount <= 0) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: invalid channelCount"
            );
        }

        if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: invalid sampleRate"
            );
        }

        stsdParams = {
            codec: "opus",
            channelCount,
            sampleRate: (sampleRate << 16) >>> 0,
            sampleSize: 16,
            dataReferenceIndex: 1,
            dOps: {
                payload: normalizedPayload,
                version: 0,
                flags: 131384
            }
        };
    }

    // =========================================================
    // MP4A (AAC)
    // =========================================================

    else if (semanticCodec.codec.startsWith("mp4a")) {
        let channelCount;
        let sampleRate;

        const asc = parseAudioSpecificConfigFromEsds({
            esds: containerBytes
        });

        if (asc !== null) {
            const samplingFrequencyTable = [
                96000, 88200, 64000, 48000,
                44100, 32000, 24000, 22050,
                16000, 12000, 11025, 8000,
                7350
            ];

            channelCount = asc.channelConfiguration;
            sampleRate   =
                samplingFrequencyTable[asc.samplingFrequencyIndex];
        } else {
            channelCount = buildParameters.channelCount;
            sampleRate   = buildParameters.sampleRate;
        }

        if (!Number.isInteger(channelCount) ||
            !Number.isInteger(sampleRate)) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: unable to resolve channelCount/sampleRate"
            );
        }

        stsdParams = {
            codec: "mp4a",
            esds: new Uint8Array(containerBytes),
            channelCount,
            sampleRate,
            sampleSize: 16,
            dataReferenceIndex: 1
        };
    }

    // =========================================================
    // Unsupported
    // =========================================================

    else {
        throw new Error(
            `adaptAudioCodecConfigurationToStsdParams: unsupported codec ${semanticCodec.codec}`
        );
    }

    // ---------------------------------------------------------
    // Container policies
    // ---------------------------------------------------------

    stsdParams.btrt = applyBtrtContainerPolicy({
        btrt: buildHints?.btrt
    });

    return stsdParams;
}
