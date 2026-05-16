function encodeDescriptorSize(size) {
    if (!Number.isInteger(size) || size < 0) {
        throw new Error(`encodeDescriptorSize: invalid size ${size}`);
    }

    const segments = [];
    do {
        segments.unshift(size & 0x7F);
        size >>>= 7;
    } while (size > 0);

    for (let i = 0; i < segments.length - 1; i++) {
        segments[i] |= 0x80;
    }

    return segments;
}

function buildEsdsDescriptorFromAudioSpecificConfig(audioSpecificConfig) {
    if (!(audioSpecificConfig instanceof Uint8Array)) {
        throw new Error("buildEsdsDescriptorFromAudioSpecificConfig: asc must be Uint8Array");
    }

    const decoderSpecificInfo = [
        0x05,
        ...encodeDescriptorSize(audioSpecificConfig.length),
        ...audioSpecificConfig
    ];

    const decoderConfigBody = [
        0x40, // objectTypeIndication (MPEG-4 Audio)
        0x15, // streamType + upStream + reserved
        0x00, 0x00, 0x00, // bufferSizeDB
        0x00, 0x00, 0x00, 0x00, // maxBitrate
        0x00, 0x00, 0x00, 0x00, // avgBitrate
        ...decoderSpecificInfo
    ];

    const decoderConfigDescriptor = [
        0x04,
        ...encodeDescriptorSize(decoderConfigBody.length),
        ...decoderConfigBody
    ];

    const esDescriptorBody = [
        0x00, 0x00, // ES_ID
        0x00,       // flags
        ...decoderConfigDescriptor
    ];

    const esDescriptor = [
        0x03,
        ...encodeDescriptorSize(esDescriptorBody.length),
        ...esDescriptorBody
    ];

    return new Uint8Array(esDescriptor);
}

export function getCodecContainerConfig(codec) {
    if (!codec || typeof codec !== "object") {
        throw new Error("getCodecContainerConfig: codec must be an object");
    }

    if (typeof codec.codec !== "string") {
        throw new Error("getCodecContainerConfig: codec.codec must be a string");
    }

    const config = codec.config;

    if (!config || typeof config !== "object") {
        throw new Error("getCodecContainerConfig: codec.config is required");
    }

    const { representation, bytes } = config;

    if (representation !== "container" && representation !== "elementary") {
        throw new Error(
            "getCodecContainerConfig: representation must be \"container\" or \"elementary\""
        );
    }

    if (!(bytes instanceof Uint8Array)) {
        throw new Error("getCodecContainerConfig: config.bytes must be a Uint8Array");
    }

    if (representation === "container") {
        return {
            codec: codec.codec,
            containerBytes: bytes
        };
    }

    if (representation === "elementary") {
        if (typeof codec.codec === "string" && codec.codec.startsWith("mp4a")) {
            return {
                codec: codec.codec,
                containerBytes: buildEsdsDescriptorFromAudioSpecificConfig(bytes)
            };
        }
        throw new Error(
            `getCodecContainerConfig: unsupported elementary representation for ${codec.codec}`
        );
    }
}
