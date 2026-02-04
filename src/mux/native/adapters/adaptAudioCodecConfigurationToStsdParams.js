
import {
    normalizeWebCodecsDopsToFfmpegCompact,
    NotWebCodecsOpusHeadError
} from "../normalization/codecs/dOps/normalizeWebCodecsDOpsToMp4Payload.js";

import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";

import { parseAudioSpecificConfigFromEsds } from "../codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";

/**
 * adaptAudioCodecConfigurationToStsdParams
 * ========================================
 *
 * Tier 3 adapter.
 *
 * Translates semantic audio codec configuration into
 * emit-ready STSD sample entry parameters.
 *
 * This adapter:
 * - derives audio shape from codec configuration
 * - normalizes WebCodecs OpusHead → FFmpeg-compatible dOps
 * - applies only single-valid defaults
 *
 * This adapter does NOT:
 * - apply container compatibility policy
 * - invent flags
 * - touch btrt
 */
export function adaptAudioCodecConfigurationToStsdParams({ codecConfiguration }) {

    let stsdParams = {};

    if (codecConfiguration.codec === "opus") {

        if (!(codecConfiguration.dOps instanceof Uint8Array)) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: opus requires dOps Uint8Array"
            );
        }

        // ---------------------------------------------------------
        // Normalize WebCodecs OpusHead → MP4 compact dOps (7 bytes)
        // ---------------------------------------------------------

        let normalizedPayload

        try {
            normalizedPayload = normalizeWebCodecsDopsToFfmpegCompact(codecConfiguration.dOps);
        } catch (err) {
            if (err instanceof NotWebCodecsOpusHeadError) {
                normalizedPayload = codecConfiguration.dOps;
            } else {
                throw err;
            }
        }

        if (normalizedPayload.length !== 7) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: normalized dOps must be 7 bytes"
            );
        }

        if (!Number.isInteger(codecConfiguration.channelCount) || codecConfiguration.channelCount <= 0) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: invalid channelCount from dOps"
            );
        }

        if (!Number.isInteger(codecConfiguration.sampleRate) || codecConfiguration.sampleRate <= 0) {
            throw new Error(
                "adaptAudioCodecConfigurationToStsdParams: invalid sampleRate from dOps"
            );
        }

        // ---------------------------------------------------------
        // Emit-ready STSD params (policy-free)
        // ---------------------------------------------------------
        stsdParams = {
            codec: "opus",

            channelCount: codecConfiguration.channelCount,
            sampleRate:   (codecConfiguration.sampleRate << 16) >>> 0,

            //sampleRate: 0xbb800000, // 48000 << 16
            // MP4 single-valid defaults
            sampleSize: 16,
            dataReferenceIndex: 1,

            // dOps (container policy, hard-coded)
            dOps: {
                payload: normalizedPayload,
                version: 0,
                flags: 131384, 
            },

            btrt: {
            }
        };

    } else if (codecConfiguration.codec.startsWith("mp4a")) {

            if (!(codecConfiguration.esds instanceof Uint8Array)) {
                throw new Error(
                    "adaptAudioCodecConfigurationToStsdParams: mp4a requires esds Uint8Array"
                );
            }

            let channelCount;
            let sampleRate;

            const asc = parseAudioSpecificConfigFromEsds({
                    esds: codecConfiguration.esds
                });

            if (asc !== null) {

                const samplingFrequencyTable = [
                    96000, 88200, 64000, 48000,
                    44100, 32000, 24000, 22050,
                    16000, 12000, 11025, 8000,
                    7350
                ];

                channelCount = asc.channelConfiguration;
                sampleRate   = samplingFrequencyTable[asc.samplingFrequencyIndex];

            } else {

                channelCount = codecConfiguration.channelCount;
                sampleRate   = codecConfiguration.sampleRate;
            }

            if (!Number.isInteger(channelCount) ||
                !Number.isInteger(sampleRate)) {
                throw new Error(
                    "adaptAudioCodecConfigurationToStsdParams: unable to resolve channelCount/sampleRate"
                );
            }

         stsdParams = {
                codec: "mp4a",
                esds: new Uint8Array(codecConfiguration.esds),
                channelCount,
                sampleRate,
                sampleSize: 16,
                dataReferenceIndex: 1,
            };

    } else {

        throw new Error(
            `adaptAudioCodecConfigurationToStsdParams: unsupported codec ${codec}`
        );
    }

    // - sourced ONLY from buildHints
    // - validated and passed through verbatim
    // - omitted if not supplied
    stsdParams.btrt = applyBtrtContainerPolicy({ btrt: codecConfiguration?.btrt })

    return stsdParams;

}
