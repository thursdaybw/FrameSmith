
import {
    applyAvcCContainerPolicySemantic,
    applyAvcCContainerPolicyContainerComplete
} from "../policies/applyAvcCContainerPolicy.js";

import { applyPaspContainerPolicy } from "../policies/applyPaspContainerPolicy.js";

import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";

import { applyCompressorNamePolicy } from "../policies/applyCompressorNamePolicy.js";

export function adaptCodecConfigurationToStsdParams(codecConfiguration) {

    // ---------------------------------------------------------
    // Top-level object
    // ---------------------------------------------------------
    if (codecConfiguration === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: codecConfiguration is missing"
        );
    }

    if (codecConfiguration === null || typeof codecConfiguration !== "object") {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: codecConfiguration must be an object"
        );
    }

    // ---------------------------------------------------------
    // codec
    // ---------------------------------------------------------
    if (codecConfiguration.codec === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: codec is missing"
        );
    }

    if (typeof codecConfiguration.codec !== "string") {
        throw new Error(
            `adaptCodecConfigurationToStsdParams: codec must be a string (got ${typeof codecConfiguration.codec})`
        );
    }

    // ---------------------------------------------------------
    // width
    // ---------------------------------------------------------
    if (codecConfiguration.width === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: width is missing"
        );
    }

    if (!Number.isInteger(codecConfiguration.width)) {
        throw new Error(
            `adaptCodecConfigurationToStsdParams: width must be an integer (got ${codecConfiguration.width})`
        );
    }

    // ---------------------------------------------------------
    // height
    // ---------------------------------------------------------
    if (codecConfiguration.height === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: height is missing"
        );
    }

    if (!Number.isInteger(codecConfiguration.height)) {
        throw new Error(
            `adaptCodecConfigurationToStsdParams: height must be an integer (got ${codecConfiguration.height})`
        );
    }

    // ---------------------------------------------------------
    // compressorName
    // ---------------------------------------------------------
    if (codecConfiguration.compressorName === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: compressorName is missing"
        );
    }

    if (typeof codecConfiguration.compressorName !== "string") {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: compressorName must be a string"
        );
    }

    // ---------------------------------------------------------
    // avcC (opaque semantic fact)
    // ---------------------------------------------------------
    if (codecConfiguration.avcC === undefined) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: avcC is missing"
        );
    }

    if (!(codecConfiguration.avcC instanceof Uint8Array)) {
        throw new Error(
            "adaptCodecConfigurationToStsdParams: avcC must be a Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // AVC1 container policy (adapter-owned)
    // ---------------------------------------------------------
    let avcCOut;

    if (codecConfiguration.avcCCompleteness === "semantic") {
        avcCOut = applyAvcCContainerPolicySemantic({
            avcC: codecConfiguration.avcC,
            profileIndication: codecConfiguration.avcC[1],
        });
    } else {
        avcCOut = applyAvcCContainerPolicyContainerComplete({
            avcC: codecConfiguration.avcC,
        });
    }

    const pasp = applyPaspContainerPolicy({
        pasp: codecConfiguration.pasp,
    });

    const btrt = applyBtrtContainerPolicy({ btrt: codecConfiguration?.btrt })

    // =====================================================================
    // Tier 4 — Container Policies (declared early for adapter consumption)
    // =====================================================================
    const compressorName = applyCompressorNamePolicy({ compressorName: codecConfiguration.compressorName });

    // ---------------------------------------------------------
    // Emit-ready STSD params (container-facing)
    // ---------------------------------------------------------
    return {
        codec: "avc1",

        width: codecConfiguration.width,
        height: codecConfiguration.height,
        compressorName: compressorName, 

        // Optional container compatibility
        pasp: pasp,

        btrt: btrt,

        // Mandatory AVC container compatibility
        avcC: avcCOut,
    };

}
