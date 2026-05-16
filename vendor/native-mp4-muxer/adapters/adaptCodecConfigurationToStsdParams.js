import {
    applyAvcCContainerPolicySemantic,
    applyAvcCContainerPolicyContainerComplete
} from "../policies/applyAvcCContainerPolicy.js";

import { applyPaspContainerPolicy } from "../policies/applyPaspContainerPolicy.js";

import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";

import { applyCompressorNamePolicy } from "../policies/applyCompressorNamePolicy.js";
import { getCodecContainerConfig } from "../codec-normalization/getCodecContainerConfig.js";

export function adaptCodecConfigurationToStsdParams({
    semanticCodec,
    buildParameters,
    buildHints
}) {

    if (!semanticCodec || typeof semanticCodec !== "object") {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: semanticCodec is required"
        );
    }

    if (!buildParameters || typeof buildParameters !== "object") {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: buildParameters is required"
        );
    }

    if (buildHints === undefined) {
        buildHints = {};
    }

    if (typeof buildHints !== "object") {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: buildHints must be an object"
        );
    }

    const { containerBytes } = getCodecContainerConfig(semanticCodec);

    const width = buildParameters.codedWidth;
    const height = buildParameters.codedHeight;

    if (!Number.isInteger(width)) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: buildParameters.codedWidth must be an integer"
        );
    }

    if (!Number.isInteger(height)) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: buildParameters.codedHeight must be an integer"
        );
    }

    const compressorName = applyCompressorNamePolicy({
        compressorName: buildHints.compressorName
    });

    const pasp = applyPaspContainerPolicy({
        pasp: buildHints.pasp
    });

    const btrt = applyBtrtContainerPolicy({
        btrt: buildHints?.btrt
    });

    let avcCOut;

    const completeness = semanticCodec?.config?.completeness;

    if (completeness === "semantic") {
        avcCOut = applyAvcCContainerPolicySemantic({
            avcC: containerBytes,
            profileIndication: containerBytes[1]
        });

    } else {
        avcCOut = applyAvcCContainerPolicyContainerComplete({
            avcC: containerBytes
        });
    }

    return {
        codec: "avc1",
        width,
        height,
        compressorName,
        pasp,
        btrt,
        avcC: avcCOut,
    };
}
