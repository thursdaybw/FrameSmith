import {
    buildVideoTrackFromWebCodecs,
    buildAudioTrackFromWebCodecs
} from "../src/mux/native/producers/webcodecsMp4Producer.js";

export class ExportEngine {

    constructor({
        fps,
        width,
        height,
        renderPlan,
        captions,
        codec,
        bitrate,
        audioDataFrames,
        durationSeconds
    }) {
        this.fps = fps;
        this.width = width;
        this.height = height;
        this.renderPlan = renderPlan;
        this.captions = captions;

        this.codec = codec;
        this.bitrate = bitrate;

        this.audioDataFrames = audioDataFrames;
        this.durationSeconds = durationSeconds;

        this.canvas = new OffscreenCanvas(width, height);
        this.ctx = this.canvas.getContext("2d");
    }

    /**
     * Framesmith analogue of runWebCodecsAudioVideoTestClient
     */
    async run() {

        const trackTimescale = 1_000_000;

        // ---------------------------------------------------------
        // Video encode (WebCodecs)
        // ---------------------------------------------------------

        const videoEncodeResult =
            await this.runFramesmithVideoEncode();

        const videoTrack =
            buildVideoTrackFromWebCodecs({
                webcodecsOutput: videoEncodeResult,
                buildParameters: {
                    codedWidth: this.width,
                    codedHeight: this.height,
                    trackTimescale
                }
            });

        if (!Array.isArray(this.audioDataFrames) || this.audioDataFrames.length === 0) {
            throw new Error("ExportEngine: audioDataFrames empty");
        }

        const audioEncodeResult = await encodeAudioWithWebCodecs({
            audioDataFrames: this.audioDataFrames,
            codec: "opus",
            sampleRate: 48000,
            numberOfChannels: 2,
            bitrate: 128_000
        });

        const audioTrack =
            buildAudioTrackFromWebCodecs({
                webcodecsOutput: audioEncodeResult,
                buildParameters: {
                    trackTimescale,
                    channelCount: 2,
                    sampleRate: 48000
                }
            });

        return {
            tracks: [videoTrack, audioTrack]
        };

    }

    // ---------------------------------------------------------
    // Framesmith video source → WebCodecs
    // ---------------------------------------------------------

    async runFramesmithVideoEncode() {

        console.log("FRAMESMITH EXPORT", {
            durationSeconds: this.durationSeconds,
            fps: this.fps,
            expectedFrames: Math.floor(this.fps * this.durationSeconds)
        });

        const encodedChunks = [];
        let decoderConfig = null;

        const encoder = new VideoEncoder({
            output(chunk, meta) {
                encodedChunks.push(chunk);
                if (!decoderConfig && meta?.decoderConfig) {
                    decoderConfig = meta.decoderConfig;
                }
            },
            error(e) {
                throw e;
            }
        });

        encoder.configure({
            codec: this.codec,
            width: this.width,
            height: this.height,
            bitrate: this.bitrate,
            framerate: this.fps
        });

        const frameCount = Math.floor(this.fps * this.durationSeconds);

        for (let i = 0; i < frameCount; i++) {

            const timestamp =
                Math.round(i * (1_000_000 / this.fps));

            // Legacy fallback compositor: fill a black frame.
            // Historical renderPlan renderer has been removed from active code.
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(0, 0, this.width, this.height);

            const frame = new VideoFrame(this.canvas, { timestamp });
            encoder.encode(frame);
            frame.close();
        }

        await encoder.flush();
        encoder.close();

        return {
            encodedChunks,
            decoderConfig
        };
    }

}

// audioEncode.js (or inline in ExportEngine for now)

async function encodeAudioWithWebCodecs({
    audioDataFrames,
    codec = "opus",
    sampleRate = 48000,
    numberOfChannels = 2,
    bitrate = 128_000
}) {
    const encodedChunks = [];
    let decoderConfig = null;

    const encoder = new AudioEncoder({
        output(chunk, meta) {
            encodedChunks.push(chunk);
            if (!decoderConfig && meta?.decoderConfig) {
                decoderConfig = meta.decoderConfig;
            }
        },
        error(e) {
            throw e;
        }
    });

    encoder.configure({
        codec,
        sampleRate,
        numberOfChannels,
        bitrate
    });

    for (const audioData of audioDataFrames) {
        encoder.encode(audioData);
    }

    await encoder.flush();
    encoder.close();

    if (!decoderConfig?.description) {
        throw new Error("AudioEncoder did not provide decoderConfig.description");
    }

    return { encodedChunks, decoderConfig };
}

function collapseAudioDataFramesToSingleAudioData(audioDataFrames) {
    if (!audioDataFrames.length) {
        throw new Error("No audio frames");
    }

    const sampleRate = audioDataFrames[0].sampleRate;
    const numberOfChannels = audioDataFrames[0].numberOfChannels;

    let totalFrames = 0;
    for (const f of audioDataFrames) {
        totalFrames += f.numberOfFrames;
    }

    const audioBuffer = new AudioBuffer({
        length: totalFrames,
        sampleRate,
        numberOfChannels
    });

    let offset = 0;

    for (const frame of audioDataFrames) {
        for (let ch = 0; ch < numberOfChannels; ch++) {
            const tmp = new Float32Array(frame.numberOfFrames);
            frame.copyTo(tmp, { planeIndex: ch });
            audioBuffer.getChannelData(ch).set(tmp, offset);
        }
        offset += frame.numberOfFrames;
        frame.close();
    }

    return new AudioData({
        format: "f32",
        sampleRate,
        numberOfChannels,
        numberOfFrames: audioBuffer.length,
        timestamp: 0,
        data: audioBuffer
    });
}
