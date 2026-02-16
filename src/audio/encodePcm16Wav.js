function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
    }
}

function clampPcmSample(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    if (value < -1) {
        return -1;
    }
    return value;
}

function floatToPcm16(value) {
    const sample = clampPcmSample(value);
    if (sample < 0) {
        return Math.round(sample * 0x8000);
    }
    return Math.round(sample * 0x7fff);
}

/**
 * Build PCM16 little-endian WAV bytes from planar Float32 channels.
 */
export function encodePcm16Wav({
    channelData,
    sampleRate
}) {
    if (!Array.isArray(channelData) || channelData.length === 0) {
        throw new Error("encodePcm16Wav: channelData must be a non-empty array.");
    }
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error("encodePcm16Wav: sampleRate must be a positive number.");
    }

    const channels = channelData.length;
    const frames = channelData[0]?.length ?? 0;
    if (!Number.isInteger(frames) || frames <= 0) {
        throw new Error("encodePcm16Wav: channelData must contain at least one frame.");
    }
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const channel = channelData[channelIndex];
        if (!(channel instanceof Float32Array)) {
            throw new Error("encodePcm16Wav: each channel must be Float32Array.");
        }
        if (channel.length !== frames) {
            throw new Error("encodePcm16Wav: channel lengths must match.");
        }
    }

    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const dataSize = frames * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, totalSize - 8, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true); // PCM fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, channels, true);
    view.setUint32(24, Math.round(sampleRate), true);
    view.setUint32(28, Math.round(sampleRate) * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    let writeOffset = headerSize;
    for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
        for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
            const channel = channelData[channelIndex];
            view.setInt16(writeOffset, floatToPcm16(channel[frameIndex]), true);
            writeOffset += 2;
        }
    }

    return new Uint8Array(buffer);
}

/**
 * Convenience helper for Web Audio `AudioBuffer`.
 */
export function encodePcm16WavFromAudioBuffer(audioBuffer) {
    if (!audioBuffer || typeof audioBuffer !== "object") {
        throw new Error("encodePcm16WavFromAudioBuffer: audioBuffer is required.");
    }
    const channels = Number(audioBuffer.numberOfChannels);
    if (!Number.isInteger(channels) || channels <= 0) {
        throw new Error("encodePcm16WavFromAudioBuffer: invalid channel count.");
    }
    const channelData = [];
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        channelData.push(audioBuffer.getChannelData(channelIndex));
    }
    return encodePcm16Wav({
        channelData,
        sampleRate: Number(audioBuffer.sampleRate)
    });
}
