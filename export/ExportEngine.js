/**
 * ExportEngine (Phase A — Decode → Composite → Encode)
 *
 * Responsibilities:
 *   - Receive compressed video samples from an injected Demuxer
 *   - Decode samples into VideoFrames using WebCodecs
 *   - Composite each decoded frame via RenderPlanRenderer
 *       (video frame + captions + overlays)
 *   - Encode the composited frames into H.264 encoded frames using WebCodecs
 *   - Accumulate encodedFrames for Phase B muxing
 *
 * This class does NOT:
 *   - Mux the encoded frames into an MP4 container (Phase B)
 *   - Handle audio (Phase B)
 *   - Perform layout or style resolution
 *   - Generate or interpret RenderPlan structures
 *
 * Architectural Principles:
 *   - Demuxer is injected (Dependency Inversion)
 *   - Rendering intent (renderPlan, captions) is injected
 *   - ExportEngine owns only the mechanical pipeline:
 *         decode → composite → encode → collect
 *   - No method performs more than one conceptual task
 */

import { renderFrame } from "../renderPlan/RenderPlanRenderer.js";
import { validateEncodedSample } from "../src/types/EncodedSampleLike.js";

export class ExportEngine {

    constructor({ demuxer, fps = 30, renderPlan = null, captions = [], muxer }) {
        if (!demuxer || typeof demuxer.parse !== "function") {
            throw new Error("ExportEngine requires a demuxer with a parse() method.");
        }

        this.demuxer = demuxer;
        this.fps = fps;

        // Injected rendering intent
        this.renderPlan = renderPlan;
        this.captions = captions;

        this.videoSamples = [];
        this.audioSamples = [];

        this.videoDecoder = null;
        this.videoEncoder = null;

        this.canvas = null;
        this.context = null;

        this.width = null;
        this.height = null;

        this.encodedFrames = []; // Phase B will mux these into MP4
    }

    /**
     * Load all compressed samples from the demuxer.
     */
    async load() {
        const { videoSamples, audioSamples } = await this.demuxer.parse();

        this.videoSamples = videoSamples;
        this.audioSamples = audioSamples;

        console.log("ExportEngine: Loaded samples", {
            video: videoSamples.length,
            audio: audioSamples.length,
        });
    }

    /**
     * Main export pipeline:
     *   - Setup decoder & encoder
     *   - For each compressed sample: decode → draw → encode
     */

    async export() {
        console.log("ExportEngine: Starting export…");

        // ---------- CHECKPOINT A ----------
        console.log("A: creating VideoDecoder…");

        this.videoDecoder = new VideoDecoder({
            output: (videoFrame) => {
                if (videoFrame.timestamp % (30 * 1000 * 1000) < 1_000) {
                    //console.log("DECODE OUTPUT FRAME:", videoFrame.timestamp);
                }

                try {
                    this.renderAndEncode(videoFrame);
                } catch (err) {
                    console.error("output callback error:", err);
                }
            },
            error: (e) => console.error("Decoder error:", e),
        });

        const trackInfo = this.demuxer.getVideoTrackInfo();
        console.log("B: trackInfo =", trackInfo);
        console.log("B: trackInfo.codec =", trackInfo?.codec);
        console.log("B: trackInfo.track_width =", trackInfo?.track_width);
        console.log("B: trackInfo.track_height =", trackInfo?.track_height);
        console.log("B: trackInfo.avcDecoderConfigRecord =", trackInfo?.avcDecoderConfigRecord);
        console.log("B: trackInfo.avcDecoderConfigRecord.buffer =", trackInfo?.avcDecoderConfigRecord?.buffer);

        this.videoEncoder = new VideoEncoder({
            output: (encodedFrame) => this.forwardVideoFrameToMuxer(encodedFrame),
            error: (e) => console.error("Encoder error:", e),
        });

        console.log("C: configuring encoder…");
        this.videoEncoder.configure({
            codec: trackInfo.codec,
            width: 720,
            height: 1280,
            bitrate: 2_000_000,     // plenty for 720×1280
            framerate: this.fps,
            avc: { format: "annexb" }
        });

        // TEMPORARY: obtain the encoder configuration record for NativeMuxer
        const encoderSupport = await VideoEncoder.isConfigSupported({
            codec: trackInfo.codec,
            width: 720,
            height: 1280,
            framerate: this.fps
        });

        const codecConfigurationRecord = new Uint8Array(encoderSupport.config.description);

        // Pass configuration record to muxer (temporary pre-adapter API)
        if (this.muxer && typeof this.muxer.setCodecConfigurationRecord === "function") {
            this.muxer.setCodecConfigurationRecord(codecConfigurationRecord);
        }

        console.log("D: configuring decoder…");

        // ----- REQUIRED FOR H.264/AVC -----
        // MP4Box exposes avcC as:
        // trackInfo.avcDecoderConfigRecord.buffer
        // which must go into the WebCodecs "description" field.

        // --- Retrieve AVCDecoderConfigurationRecord ---
        const description = this.demuxer.getAvcCBuffer();

        console.log("ExportEngine: AVC description =", description);

        if (!(description instanceof ArrayBuffer)) {
            throw new Error("ExportEngine: demuxer.getAvcCBuffer() did not return ArrayBuffer");
        }

        // --- Configure the decoder with avcC ---
        this.videoDecoder.configure({
            codec: trackInfo.codec,
            description
        });

        console.log("D: decoder.configure DONE");

        console.log("E: feeding samples…", this.videoSamples.length);

        let index = 0;

        for (const sample of this.videoSamples) {
            if (index === 0) {
                console.log("FIRST SAMPLE TYPE:", sample.type);
                console.log("FIRST SAMPLE TIMESTAMP:", sample.timestamp);
            }

            // Only log ONE sample every 1000
            if (index % 1000 === 0) {
                console.log("FEEDING SAMPLE", index, "type:", sample.type);
            }

            validateEncodedSample(sample);

            try {
                this.videoDecoder.decode(new EncodedVideoChunk(sample));
            } catch (err) {
                console.error("decode() threw at sample", index, err);
                throw err;
            }

            index++;
        }

        console.log("F: awaiting decoder.flush…");

        await this.videoDecoder.flush();
        console.log("G: decoder.flush resolved");

        if (this.videoEncoder) {
            console.log("H: awaiting encoder.flush…");
            await this.videoEncoder.flush();
            console.log("I: encoder.flush resolved");
        }

        console.log("J: Finished export()");
    }
    /**
     * renderAndEncode(videoFrame)
     *
     * Draws the decoded frame + overlays + captions, then encodes the result.
     */
    async renderAndEncode(videoFrame) {
        const TARGET_WIDTH = 720;
        const TARGET_HEIGHT = 1280;

        if (!this.offscreenCanvas) {
            this.offscreenCanvas = new OffscreenCanvas(TARGET_WIDTH, TARGET_HEIGHT);
            this.ctx = this.offscreenCanvas.getContext("2d");
        }

        /**
         * Do not use MP4-domain timestamps but rather our own encoder-domain timestamps.
         *
         * Reason:
         *   - MP4 demuxed timestamps may not start at but rather0
         *   - They may contain gaps, offsets, or non-monotonic jumps
         *   - Raw H.264 has NO timing metadata, so playback order depends entirely
         *     on the order and spacing of timestamps we assign here
         *
         * This ensures:
         *   - Monotonic, gapless timestamps
         *   - Correct decoder frame ordering
         *   - Smooth playback in ffplay, mpv, VLC, etc.
         */


        // Fill the export canvas with the scaled video
        this.ctx.drawImage(
            videoFrame,
            0, 0, videoFrame.codedWidth, videoFrame.codedHeight,  // source
            0, 0, TARGET_WIDTH, TARGET_HEIGHT                    // destination
        );

        // Maintain our own strictly monotonic timestamp counter (microseconds)
        if (!this._frameIndex) this._frameIndex = 0;

        // Calculate timestamp from frame count, NOT from MP4 sample timestamps.
        // Ensures monotonic, gapless, correctly spaced timing for the encoder.
        const encodeTimestamp = this._frameIndex * (1_000_000 / this.fps);

        const composedFrame = new VideoFrame(this.offscreenCanvas, {
            timestamp: encodeTimestamp
        });

        this._frameIndex++;  // Advance counter AFTER assigning timestamp

        // prevent encoder overload
        while (this.videoEncoder.encodeQueueSize > 30) {
            await new Promise(r => setTimeout(r, 0));
        }

        this.videoEncoder.encode(composedFrame);


        composedFrame.close();
        videoFrame.close();
    }

    /**
     * Store encoded frames for Phase B muxing.
     */
    forwardVideoFrameToMuxer(encodedFrame) {

        // start debug code 
        const u8 = new Uint8Array(encodedFrame.byteLength);
        encodedFrame.copyTo(u8);

        console.log("checking for KEYFRAME");
        if (encodedFrame.type === "key") {
            console.log("KEYFRAME SIZE =", u8.length);
            console.log("FIRST 16 BYTES =", [...u8.slice(0,16)]);
        }
        // end debug code

        this.muxer.addVideoFrame(encodedFrame)
    }

    /**
     * getFinalBlob()
     *
     * Responsibility:
     *   - Produce a complete MP4 file from all encoded video encoded frames.
     *
     * Notes:
     *   - ExportEngine does not perform muxing itself.
     *   - Delegates to the muxer to assemble:
     *         init segment (ftyp/moov)
     *         + media fragments (moof/mdat)
     *
     * Returns:
     *   Blob — a playable MP4 video file.
     */
    async getFinalBlob() {
        return await this.muxer.finalize();
    }

}
