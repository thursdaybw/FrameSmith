export function adaptAudioCodecConfigurationToStsdParams(codecConfiguration) {

    if (codecConfiguration === undefined) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: codecConfiguration is missing"
        );
    }

    if (codecConfiguration === null || typeof codecConfiguration !== "object") {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: codecConfiguration must be an object"
        );
    }

    // ---------------------------------------------------------
    // codec
    // ---------------------------------------------------------
    if (codecConfiguration.codec === undefined) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: codec is missing"
        );
    }

    if (typeof codecConfiguration.codec !== "string") {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: codec must be a string"
        );
    }

    // ---------------------------------------------------------
    // esds
    // ---------------------------------------------------------
    if (codecConfiguration.esds === undefined) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: esds is missing"
        );
    }

    if (!(codecConfiguration.esds instanceof Uint8Array)) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: esds must be a Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // codec → MP4 sample entry mapping
    // ---------------------------------------------------------
    let sampleEntryType;

    if (codecConfiguration.codec.startsWith("mp4a")) {
        sampleEntryType = "mp4a";
    } else {
        throw new Error(
            [
                "adaptAudioCodecConfigurationToStsdParams: unsupported codec",
                "",
                `Received: ${codecConfiguration.codec}`,
                "",
                "Expected an RFC 6381 audio codec compatible with MP4 emission.",
                "Currently supported:",
                "  - mp4a (AAC)"
            ].join("\n")
        );
    }


    // ---------------------------------------------------------
    // Required audio properties
    // ---------------------------------------------------------

    if (!Number.isInteger(codecConfiguration.channelCount)) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: channelCount is missing or invalid"
        );
    }

    if (!Number.isInteger(codecConfiguration.sampleRate)) {
        throw new Error(
            "adaptAudioCodecConfigurationToStsdParams: sampleRate is missing or invalid"
        );
    }

    const sampleSize =
        Number.isInteger(codecConfiguration.sampleSize)
        ? codecConfiguration.sampleSize
        : 16;

    // ---------------------------------------------------------
    // Emit-ready params
    // ---------------------------------------------------------
    return {
        codec: sampleEntryType,
        channelCount: codecConfiguration.channelCount,
        sampleRate:   codecConfiguration.sampleRate,
        sampleSize,
        esds: new Uint8Array(codecConfiguration.esds)
    };

}
