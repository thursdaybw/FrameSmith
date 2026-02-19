import { adaptAudioCodecConfigurationToStsdParams } from "../../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { getCodecContainerConfig } from "../../codec-normalization/getCodecContainerConfig.js";

export const opusProfile = Object.freeze({
    id: "opus",
    mediaFamily: "audio",
    sampleEntryTypes: Object.freeze(["opus"]),
    configKeys: Object.freeze(["config"]),
    supportsMuxEmission: true,
    editListMediaTimeStrategy: "frame_quantized_encoder_delay",
    hasImplicitAudioDurationTrim: false,
    stsdAssemblyPath: "moov/trak/mdia/minf/stbl/stsd|Opus",

    extractDemuxCodecConfig({ sampleEntryReport, callerLabel }) {
        if (!(sampleEntryReport.derived.dOps instanceof Uint8Array)) {
            throw new Error(`${callerLabel}: dOps missing from Opus SampleEntry`);
        }

        const channelCount = sampleEntryReport.box?.fields?.channelCount;
        const sampleRateRaw = sampleEntryReport.box?.fields?.sampleRate;
        const sampleRate = sampleRateRaw >>> 16;

        return {
            codec: "opus",
            config: {
                representation: "container",
                bytes: sampleEntryReport.derived.dOps
            },
            channelCount,
            sampleRate
        };
    },

    adaptStsdParamsFromSemanticTrack({ codecName, semanticCodec, buildParameters, buildHints }) {
        return adaptAudioCodecConfigurationToStsdParams({
            semanticCodec: {
                ...semanticCodec,
                codec: codecName
            },
            buildParameters: {
                channelCount: buildParameters.channelCount,
                sampleRate:   buildParameters.sampleRate
            },
            buildHints: {
                btrt: buildHints?.btrt
            }
        });
    },

    buildStsdAssemblyInputFromParams(stsdParams) {
        return {
            channelCount:       stsdParams.channelCount,
            sampleRate:         stsdParams.sampleRate,
            sampleSize:         stsdParams.sampleSize,
            dataReferenceIndex: stsdParams.dataReferenceIndex,
            dOps:               stsdParams.dOps,
            btrt:               stsdParams.btrt
        };
    }
});
