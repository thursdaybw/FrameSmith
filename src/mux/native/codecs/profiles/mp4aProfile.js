import { adaptAudioCodecConfigurationToStsdParams } from "../../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { getCodecContainerConfig } from "../../codec-normalization/getCodecContainerConfig.js";

export const mp4aProfile = Object.freeze({
    id: "mp4a",
    mediaFamily: "audio",
    sampleEntryTypes: Object.freeze(["mp4a"]),
    configKeys: Object.freeze(["config"]),
    supportsMuxEmission: true,
    editListMediaTimeStrategy: "encoder_delay_samples",
    hasImplicitAudioDurationTrim: true,
    stsdAssemblyPath: "moov/trak/mdia/minf/stbl/stsd|mp4a",

    extractDemuxCodecConfig({ sampleEntryReport, callerLabel }) {
        if (!(sampleEntryReport.derived.esds instanceof Uint8Array)) {
            throw new Error(`${callerLabel}: esds missing from mp4a SampleEntry`);
        }

        const channelCount = sampleEntryReport.box?.fields?.channelCount;
        const sampleRate = sampleEntryReport.box?.fields?.sampleRate;

        if (!Number.isInteger(channelCount) || channelCount <= 0) {
            throw new Error(`${callerLabel}: mp4a.channelCount missing or invalid`);
        }

        if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
            throw new Error(`${callerLabel}: mp4a.sampleRate missing or invalid`);
        }

        return {
            codec: "mp4a",
            config: {
                representation: "container",
                bytes: sampleEntryReport.derived.esds
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
            channelCount: stsdParams.channelCount,
            sampleRate:   stsdParams.sampleRate,
            sampleSize:   stsdParams.sampleSize,
            esds:         stsdParams.esds,
            btrt:         stsdParams.btrt
        };
    }
});
