/**
 * AudioEncoder Probe
 * ==================
 *
 * PURPOSE
 * -------
 * Ground-truth inspection probe for WebCodecs AudioEncoder.
 *
 * This probe exists solely to answer:
 *   - What does AudioEncoder emit?
 *   - How are timestamps and durations expressed?
 *   - What codec configuration is produced?
 *   - What framing invariants exist?
 *
 * This file:
 * - does NOT depend on MP4
 * - does NOT depend on editor code
 * - does NOT perform passthrough
 * - does NOT return structured data
 *
 * It logs observable truth for muxer design.
 *
 * This file may be deleted at any time.
 */

/* ------------------------------------------------------------------ */
/* Audio Source: Deterministic Offline Render                         */
/* ------------------------------------------------------------------ */

/**
 * renderOscillatorAudioBuffer
 * ---------------------------
 *
 * Produces a deterministic AudioBuffer using OfflineAudioContext.
 *
 * This is ground-truth audio:
 * - browser-native
 * - sample-accurate
 * - no streaming
 * - no scheduling noise
 */
async function renderOscillatorAudioBuffer({
    sampleRate,
    channelCount,
    durationSeconds,
    frequencyHz
}) {
    const totalFrames =
        Math.floor(sampleRate * durationSeconds);

    const context = new OfflineAudioContext(
        channelCount,
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
/* AudioBuffer → AudioData Conversion                                  */
/* ------------------------------------------------------------------ */

/**
 * createAudioDataFromAudioBuffer
 * ------------------------------
 *
 * Converts a Web Audio AudioBuffer into a single AudioData instance.
 *
 * This function makes NO assumptions beyond:
 * - planar Float32 layout
 * - contiguous frames
 *
 * Timestamp is supplied explicitly.
 */
function createAudioDataFromAudioBuffer({
    audioBuffer,
    timestamp
}) {
    const channelCount = audioBuffer.numberOfChannels;
    const frameCount = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    // f32-planar requires a single buffer:
    // [ channel0 frames ][ channel1 frames ] ...
    const planarBuffer =
        new Float32Array(frameCount * channelCount);

    for (let ch = 0; ch < channelCount; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        planarBuffer.set(
            channelData,
            ch * frameCount
        );
    }

    return new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: channelCount,
        timestamp,
        data: planarBuffer
    });
}

/* ------------------------------------------------------------------ */
/* AudioEncoder Construction                                           */
/* ------------------------------------------------------------------ */

/**
 * createLoggingAudioEncoder
 * ------------------------
 *
 * Constructs an AudioEncoder that logs *only* encoder-emitted facts.
 *
 * No interpretation.
 * No transformation.
 */
function createLoggingAudioEncoder() {
    return new AudioEncoder({
        output(chunk, meta) {
            console.log("ENCODED AUDIO CHUNK", {
                type: chunk.type,
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                byteLength: chunk.byteLength
            });

            if (meta?.decoderConfig) {
                console.log("DECODER CONFIG", meta.decoderConfig);
            }
        },
        error(error) {
            console.error("AUDIO ENCODER ERROR", error);
        }
    });
}

/* ------------------------------------------------------------------ */
/* Encoder Configuration                                               */
/* ------------------------------------------------------------------ */

/**
 * configureOpusEncoder
 * --------------------
 *
 * Minimal, explicit Opus configuration.
 *
 * Mirrors AudioEncoder.isConfigSupported() results.
 */
function configureOpusEncoder(encoder) {
    encoder.configure({
        codec: "opus",
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: "variable"
    });
}

/* ------------------------------------------------------------------ */
/* Probe Entry Point                                                   */
/* ------------------------------------------------------------------ */

/**
 * runAudioEncoderProbe
 * --------------------
 *
 * Entry point for the AudioEncoder inspection probe.
 */
export async function runAudioEncoderProbe() {
    console.log("=== AudioEncoder Probe ===");

    if (!window.AudioEncoder) {
        throw new Error("AudioEncoder is not available in this environment");
    }

    const sampleRate = 48000;
    const channelCount = 2;
    const durationSeconds = 1;
    const frequencyHz = 440;

    const audioBuffer =
        await renderOscillatorAudioBuffer({
            sampleRate,
            channelCount,
            durationSeconds,
            frequencyHz
        });

    const audioData =
        createAudioDataFromAudioBuffer({
            audioBuffer,
            timestamp: 0
        });


    const encoder = createLoggingAudioEncoder();

    configureOpusEncoder(encoder);

    console.log("ENCODER CONFIGURED");

    encoder.encode(audioData);

    audioData.close();

    await encoder.flush();
    encoder.close();

    console.log("=== AudioEncoder Probe Complete ===");
}
