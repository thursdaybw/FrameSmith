import { adaptCodecConfigurationToStsdParams } from "../../adapters/adaptCodecConfigurationToStsdParams.js";

export const avc1Profile = Object.freeze({
    id: "avc1",
    mediaFamily: "video",
    sampleEntryTypes: Object.freeze(["avc1"]),
    configKeys: Object.freeze(["avcC"]),
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
            avcC: sampleEntryReport.derived.avcC,
            avcCCompleteness: "container-complete"
        };
    },

    adaptStsdParamsFromSemanticTrack({ codecName, semanticCodec, buildParameters, buildHints }) {
        return adaptCodecConfigurationToStsdParams({
            codec:          codecName,
            avcC:           semanticCodec.avcC,
            width:          buildParameters.codedWidth,
            height:         buildParameters.codedHeight,
            compressorName: buildHints?.compressorName ?? "AVC Coding",
            pasp:           buildHints?.pasp,
            btrt:           buildHints?.btrt
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
