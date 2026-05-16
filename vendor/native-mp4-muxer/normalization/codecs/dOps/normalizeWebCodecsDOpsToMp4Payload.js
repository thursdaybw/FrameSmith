export class NotWebCodecsOpusHeadError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotWebCodecsOpusHeadError";
    }
}

export function normalizeWebCodecsDopsToFfmpegCompact(input) {

    if (!(input instanceof Uint8Array)) {
        throw new Error(
            "normalizeWebCodecsDopsToFfmpegCompact: expected Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // MP4 compact dOps MUST NOT be normalized
    // ---------------------------------------------------------
    if (input.length === 7) {
        throw new NotWebCodecsOpusHeadError(
            "Received MP4 compact dOps (7 bytes)"
        );
    }

    // ---------------------------------------------------------
    // OpusHead detection
    // ---------------------------------------------------------
    if (
        input.length < 19 ||
        input[0] !== 0x4f || // 'O'
        input[1] !== 0x70 || // 'p'
        input[2] !== 0x75 || // 'u'
        input[3] !== 0x73 || // 's'
        input[4] !== 0x48 || // 'H'
        input[5] !== 0x65 || // 'e'
        input[6] !== 0x61 || // 'a'
        input[7] !== 0x64    // 'd'
    ) {
        throw new Error(
            "normalizeWebCodecsDopsToFfmpegCompact: input is neither OpusHead nor MP4 dOps"
        );
    }

    const opusHeadPayload = stripOpusHead(input);
    const fields          = readOpusHeadFields(opusHeadPayload);

    return normalizeToCompactDopsPayload(fields);
}

function stripOpusHead(webcodecsDops) {
    // "OpusHead" = 8 bytes
    return webcodecsDops.subarray(8);
}

function readOpusHeadFields(opusHeadPayload) {
    const version = opusHeadPayload[0];
    const channelCount = opusHeadPayload[1];

    const preSkipLow  = opusHeadPayload[2];
    const preSkipHigh = opusHeadPayload[3];
    const preSkip = preSkipLow + (preSkipHigh * 256);

    const srByte0 = opusHeadPayload[4];
    const srByte1 = opusHeadPayload[5];
    const srByte2 = opusHeadPayload[6];
    const srByte3 = opusHeadPayload[7];

    const inputSampleRate =
        srByte0 +
        (srByte1 * 256) +
        (srByte2 * 256 * 256) +
        (srByte3 * 256 * 256 * 256);

    return {
        version,
        channelCount,
        preSkip,
        inputSampleRate,
    };
}

function normalizeToCompactDopsPayload(fields) {
    const out = new Uint8Array(7);

    // byte 0: opusVersion
    out[0] = 0;

    // byte 1: channelCount
    out[1] = 0;

    // bytes 2–3: store inputSampleRate (uint16 BE)
    out[2] = (fields.inputSampleRate >> 8) & 0xff;
    out[3] = fields.inputSampleRate & 0xff;

    // bytes 4–6: zeroed (FFmpeg compact form)
    out[4] = 0;
    out[5] = 0;
    out[6] = 0;

    return out;
}

