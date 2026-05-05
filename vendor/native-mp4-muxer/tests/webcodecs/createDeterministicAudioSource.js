/**
 * Deterministic Audio Source
 * =========================
 *
 * PURPOSE
 * -------
 * Produces AudioData instances representing editor-authored audio.
 *
 * This module:
 * - does NOT encode
 * - does NOT depend on MP4
 * - does NOT know about muxing
 * - does NOT infer defaults
 *
 * It models the output of an editor render graph.
 */

/* ------------------------------------------------------------------ */
/* Offline Audio Rendering                                             */
/* ------------------------------------------------------------------ */

/**
 * renderOscillatorAudioBuffer
 * ---------------------------
 *
 * Renders deterministic audio using OfflineAudioContext.
 *
 * This represents "perfect" editor audio:
 * - sample-accurate
 * - browser-native
 * - no scheduling jitter
 */
export async function renderOscillatorAudioBuffer({
    sampleRate,
    numberOfChannels,
    durationSeconds,
    frequencyHz
}) {
    const totalFrames =
        Math.floor(sampleRate * durationSeconds);

    const context = new OfflineAudioContext(
        numberOfChannels,
        totalFrames,
        sampleRate
    );

    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequencyHz;

    oscillator.connect(context.destination);
    oscillator.start(0);
    oscillator.stop(durationSeconds);

    const renderedBuffer = await context.startRendering();

    return renderedBuffer;
}

/* ------------------------------------------------------------------ */
/* AudioBuffer → AudioData                                             */
/* ------------------------------------------------------------------ */

/**
 * createAudioDataFromAudioBuffer
 * ------------------------------
 *
 * Converts an AudioBuffer into a single AudioData instance.
 *
 * Layout:
 * - f32-planar
 * - contiguous frames
 *
 * Timestamp is supplied by the caller.
 */
export function createAudioDataFromAudioBuffer({
    audioBuffer,
    timestamp
}) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const numberOfFrames = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const planarData =
        new Float32Array(numberOfFrames * numberOfChannels);

    for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        planarData.set(
            channelData,
            ch * numberOfFrames
        );
    }

    return new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames,
        numberOfChannels,
        timestamp,
        data: planarData
    });
}
