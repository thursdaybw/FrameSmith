function describeValue(value) {
    const typeTag = Object.prototype.toString.call(value);
    if (typeof value === "string") return `${typeTag}(${JSON.stringify(value)})`;
    if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
        return `${typeTag}(${String(value)})`;
    }
    return typeTag;
}

function assertEncoder(name, encoderFn) {
    if (encoderFn === undefined) return;
    if (typeof encoderFn !== "function") {
        throw new Error(
            `encodeAtTime: ${name} must be a function when provided. ` +
            `Received ${describeValue(encoderFn)}`
        );
    }
}

/**
 * encodeAtTime
 *
 * Memory/backpressure policy reference:
 * - docs/framesmith-architecture.md
 * - "Memory Ownership and Future Optimization Seams"
 */
export function encodeAtTime({
    timeSeconds,
    compositionOutput,
    encodeVideoFrame,
    encodeAudioData,
    provenance = {},
    options = {}
}) {
    if (typeof timeSeconds !== "number" || Number.isNaN(timeSeconds)) {
        throw new Error(
            "encodeAtTime: timeSeconds must be a valid number. " +
            `Received ${describeValue(timeSeconds)}`
        );
    }

    if (!compositionOutput || typeof compositionOutput !== "object") {
        throw new Error(
            "encodeAtTime: compositionOutput must be an object. " +
            `Received ${describeValue(compositionOutput)}`
        );
    }

    const composedVideoFrame = compositionOutput.composedVideoFrame;
    const composedAudioData = compositionOutput.composedAudioData;

    if (!composedVideoFrame || typeof composedVideoFrame !== "object") {
        throw new Error(
            "encodeAtTime: compositionOutput.composedVideoFrame must be an object. " +
            `Received ${describeValue(composedVideoFrame)}`
        );
    }

    if (!composedAudioData || typeof composedAudioData !== "object") {
        throw new Error(
            "encodeAtTime: compositionOutput.composedAudioData must be an object. " +
            `Received ${describeValue(composedAudioData)}`
        );
    }

    assertEncoder("encodeVideoFrame", encodeVideoFrame);
    assertEncoder("encodeAudioData", encodeAudioData);

    const encodedAccessUnits = [];

    if (composedVideoFrame.videoFrame && encodeVideoFrame) {
        const videoAccessUnit = encodeVideoFrame({
            frame: composedVideoFrame.videoFrame,
            timeSeconds,
            provenance,
            options
        });
        if (!videoAccessUnit || typeof videoAccessUnit !== "object") {
            throw new Error(
                "encodeAtTime: encodeVideoFrame must return an access-unit object. " +
                `Received ${describeValue(videoAccessUnit)}`
            );
        }
        encodedAccessUnits.push(videoAccessUnit);
    }

    if (composedAudioData.audioData && encodeAudioData) {
        const audioAccessUnit = encodeAudioData({
            audioData: composedAudioData.audioData,
            timeSeconds,
            provenance,
            options
        });
        if (!audioAccessUnit || typeof audioAccessUnit !== "object") {
            throw new Error(
                "encodeAtTime: encodeAudioData must return an access-unit object. " +
                `Received ${describeValue(audioAccessUnit)}`
            );
        }
        encodedAccessUnits.push(audioAccessUnit);
    }

    return {
        timeSeconds,
        encodedAccessUnits
    };
}
