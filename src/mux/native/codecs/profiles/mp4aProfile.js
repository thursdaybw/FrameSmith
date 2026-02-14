import { adaptAudioCodecConfigurationToStsdParams } from "../../adapters/adaptAudioCodecConfigurationToStsdParams.js";

export const mp4aProfile = Object.freeze({
    id: "mp4a",
    mediaFamily: "audio",
    sampleEntryTypes: Object.freeze(["mp4a"]),
    configKeys: Object.freeze(["esds"]),
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
            esds: sampleEntryReport.derived.esds,
            channelCount,
            sampleRate
        };
    },

    adaptStsdParamsFromSemanticTrack({ codecName, semanticCodec, buildParameters, buildHints }) {
        return adaptAudioCodecConfigurationToStsdParams({
            codecConfiguration: {
                codec:        codecName,
                esds:         semanticCodec.esds,
                channelCount: buildParameters.channelCount,
                sampleRate:   buildParameters.sampleRate,
                btrt:         buildHints?.btrt
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
