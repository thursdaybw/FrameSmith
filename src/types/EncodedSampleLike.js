/**
 * EncodedSampleLike
 *
 * Framesmith’s domain-level representation of compressed samples
 * that can be passed directly to a WebCodecs VideoDecoder.
 *
 * No browser APIs, no constructors.
 */
export class EncodedSampleLike {
    constructor({ type, timestamp, duration, data }) {
        this.type = type;             // "key" | "delta"
        this.timestamp = timestamp;   // microseconds
        this.duration = duration;     // microseconds
        this.data = data;             // Uint8Array
    }
}

export function validateEncodedSample(sample) {
    if (sample == null || typeof sample !== "object") {
        throw new Error("EncodedSampleSpec: sample must be an object");
    }

    if (sample.type !== "key" && sample.type !== "delta") {
        throw new Error(`EncodedSampleSpec: invalid type '${sample.type}'`);
    }

    if (!Number.isInteger(sample.timestamp) || sample.timestamp < 0) {
        throw new Error("EncodedSampleSpec: timestamp must be a positive integer (nanoseconds)");
    }

    if (!Number.isInteger(sample.duration) || sample.duration < 0) {
        throw new Error("EncodedSampleSpec: duration must be a positive integer (nanoseconds)");
    }

    if (!(sample.data instanceof Uint8Array)) {
        throw new Error("EncodedSampleSpec: data must be Uint8Array");
    }

    if (sample.data.byteLength === 0) {
        throw new Error("EncodedSampleSpec: empty data buffer");
    }

    return sample;
}

