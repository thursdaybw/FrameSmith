import { adaptStsdParamsFromSemanticTrackByCodec } from "../codecs/codecRegistry.js";
import { buildStsdIntentFromParams } from "../builders/buildStsdIntentFromParams.js";

export function buildStsdIntentFromSemanticTrack({
    codecName,
    semanticCodec,
    buildParameters,
    buildHints
}) {
    const stsdParams = adaptStsdParamsFromSemanticTrackByCodec({
        codecName,
        semanticCodec,
        buildParameters,
        buildHints,
        callerLabel: "buildStsdIntentFromSemanticTrack"
    });

    return buildStsdIntentFromParams(stsdParams);
}
