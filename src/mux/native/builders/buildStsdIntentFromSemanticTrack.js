import { adaptCodecConfigurationToStsdParams } from "../adapters/adaptCodecConfigurationToStsdParams.js";
import { adaptAudioCodecConfigurationToStsdParams } from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { buildStsdIntentFromParams } from "../builders/buildStsdIntentFromParams.js";

export function buildStsdIntentFromSemanticTrack({
    codecName,
    semanticCodec,
    buildParameters,
    buildHints
}) {
    let stsdParams;

    if (codecName.startsWith("avc1")) {
        stsdParams = adaptCodecConfigurationToStsdParams({
            codec:          codecName,
            avcC:           semanticCodec.avcC,
            width:          buildParameters.codedWidth,
            height:         buildParameters.codedHeight,
            compressorName: buildHints?.compressorName ?? "AVC Coding",
            pasp:           buildHints?.pasp,
            btrt:           buildHints?.btrt,
        });

    } else if (codecName === "opus") {
        stsdParams = adaptAudioCodecConfigurationToStsdParams({
            codecConfiguration: {
                codec:        codecName,
                dOps:         semanticCodec.dOps,
                channelCount: buildParameters.channelCount,
                sampleRate:   buildParameters.sampleRate,
                btrt:         buildHints?.btrt,
            }
        });

    } else if (codecName.startsWith("mp4a")) {
        stsdParams = adaptAudioCodecConfigurationToStsdParams({
            codecConfiguration: {
                codec:        codecName,
                esds:         semanticCodec.esds,
                channelCount: buildParameters.channelCount,
                sampleRate:   buildParameters.sampleRate,
                btrt:         buildHints?.btrt,
            }
        });

    } else {
        throw new Error(`buildStsdIntentFromSemanticTrack: unsupported codec ${codecName}`);
    }

    return buildStsdIntentFromParams(stsdParams);
}
