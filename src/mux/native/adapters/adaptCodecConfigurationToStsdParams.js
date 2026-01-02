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
    // codec → MP4 sample entry mapping
    // ---------------------------------------------------------
    let sampleEntryType;

    if (codecConfiguration.codec.startsWith("avc1")) {
        sampleEntryType = "avc1";
    } else {
        throw new Error(
            [
                "adaptCodecConfigurationToStsdParams: unsupported codec",
                "",
                `Received: ${codecConfiguration.codec}`,
                "",
                "Expected an RFC 6381 codec string compatible with MP4 emission.",
                "Currently supported:",
                "  - avc1 (H.264)"
            ].join("\n")
        );
    }

    // ---------------------------------------------------------
    // Emit-ready params (container-facing)
    // ---------------------------------------------------------
    return {
        codec: sampleEntryType,
        width: codecConfiguration.width,
        height: codecConfiguration.height,
        compressorName: codecConfiguration.compressorName,
        avcC: new Uint8Array(codecConfiguration.avcC)
    };

}
