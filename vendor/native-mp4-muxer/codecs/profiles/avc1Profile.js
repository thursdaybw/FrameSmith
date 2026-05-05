import { adaptCodecConfigurationToStsdParams } from "../../adapters/adaptCodecConfigurationToStsdParams.js";
import { getCodecContainerConfig } from "../../codec-normalization/getCodecContainerConfig.js";

export const avc1Profile = Object.freeze({
    id: "avc1",
    mediaFamily: "video",
    sampleEntryTypes: Object.freeze(["avc1"]),
    configKeys: Object.freeze(["config"]),
    supportsMuxEmission: true,
    editListMediaTimeStrategy: "encoder_delay_samples",
    hasImplicitAudioDurationTrim: false,
    stsdAssemblyPath: "moov/trak/mdia/minf/stbl/stsd|avc1",

    extractDemuxCodecConfig({ sampleEntryReport, callerLabel }) {
        if (!(sampleEntryReport.derived.avcC instanceof Uint8Array)) {
            throw new Error(`${callerLabel}: avcC missing from avc1 SampleEntry`);
        }

        return {
            codec: "avc1",
            config: {
                representation: "container",
                bytes: sampleEntryReport.derived.avcC
            }
        };
    },

    adaptStsdParamsFromSemanticTrack({
        codecName,
        semanticCodec,
        buildParameters,
        buildHints
    }) {
        return adaptCodecConfigurationToStsdParams({
            semanticCodec,
            buildParameters,
            buildHints
        });
    },

    buildStsdAssemblyInputFromParams(stsdParams) {
        return {
            width:          stsdParams.width,
            height:         stsdParams.height,
            compressorName: stsdParams.compressorName,
            avcC:           stsdParams.avcC,
            pasp:           stsdParams.pasp,
            btrt:           stsdParams.btrt
        };
    }
});
