import { encodePcm16Wav } from "./encodePcm16Wav.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function readAscii(bytes, start, length) {
    let text = "";
    for (let index = 0; index < length; index += 1) {
        text += String.fromCharCode(bytes[start + index]);
    }
    return text;
}

export function test_encodePcm16Wav_buildsValidHeaderAndPayload() {
    const left = new Float32Array([0, 0.5, -0.5]);
    const right = new Float32Array([1, -1, 0.25]);
    const sampleRate = 16_000;

    const wavBytes = encodePcm16Wav({
        channelData: [left, right],
        sampleRate
    });
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

    assert(readAscii(wavBytes, 0, 4) === "RIFF", "WAV must start with RIFF");
    assert(readAscii(wavBytes, 8, 4) === "WAVE", "WAV must declare WAVE");
    assert(readAscii(wavBytes, 12, 4) === "fmt ", "WAV must include fmt chunk");
    assert(readAscii(wavBytes, 36, 4) === "data", "WAV must include data chunk");
    assert(view.getUint16(22, true) === 2, "WAV channel count must be 2");
    assert(view.getUint32(24, true) === sampleRate, "WAV sample rate mismatch");
    assert(view.getUint16(34, true) === 16, "WAV bit depth must be 16");

    const expectedDataSize = left.length * 2 * 2;
    assert(view.getUint32(40, true) === expectedDataSize, "WAV data chunk size mismatch");

    const firstLeft = view.getInt16(44, true);
    const firstRight = view.getInt16(46, true);
    assert(firstLeft === 0, "First left sample must be zero");
    assert(firstRight === 32767, "First right sample must be full-scale positive");
}

export function test_encodePcm16Wav_rejectsMismatchedChannels() {
    let didThrow = false;
    try {
        encodePcm16Wav({
            channelData: [
                new Float32Array([0, 1, 2]),
                new Float32Array([0, 1])
            ],
            sampleRate: 16_000
        });
    } catch (error) {
        didThrow = true;
        assert(
            String(error?.message || "").includes("channel lengths must match"),
            "Expected channel length mismatch error"
        );
    }
    assert(didThrow, "Expected mismatched channel data to throw");
}

export const AUDIO_ENCODE_PCM16_WAV_TESTS = [
    test_encodePcm16Wav_buildsValidHeaderAndPayload,
    test_encodePcm16Wav_rejectsMismatchedChannels
];
