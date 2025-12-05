/**
 * ExportEngine (Phase A — Consolidated)
 *
 * Responsibility:
 *   - Encode video frames (WebCodecs VideoEncoder)
 *   - Encode audio track (WebCodecs AudioEncoder)
 *   - Mux audio + video into MP4 (via MP4Box.js)
 *
 * Temporary Phase A Note:
 *   This module combines responsibilities that will later be split into:
 *     - VideoEncoderEngine
 *     - AudioEncoderEngine
 *     - MuxerEngine
 *     - ExportOrchestrator
 *
 *   This temp combination is deliberate and documented.
 */

export class ExportEngine {
  constructor({ canvas, fps = 30, MP4Box }) {

    console.log("Audio encoder created. No config yet.");

    this.MP4Box = MP4Box;

    this.canvas = canvas;
    this.fps = fps;

    this.videoChunks = [];
    this.audioChunks = [];

    this.ready = false;

    this._initVideoEncoder();
    this._initAudioEncoder();
  }

  /* -------------------------------------------------------------
   * VIDEO ENCODER
   * ------------------------------------------------------------- */
  _initVideoEncoder() {
    this.videoEncoder = new VideoEncoder({
      output: (chunk) => {
        this.videoChunks.push(chunk);
      },
      error: (e) => console.error("VideoEncoder error:", e)
    });

    this.videoEncoder.configure({
      codec: "avc1.640033",
      width: this.canvas.width,
      height: this.canvas.height,
      bitrate: 5_000_000,
      framerate: this.fps
    });
  }

  /* -------------------------------------------------------------
   * AUDIO ENCODER
   * ------------------------------------------------------------- */
  _initAudioEncoder() {
    this.audioEncoder = new AudioEncoder({
      output: (chunk) => {
        this.audioChunks.push(chunk);
      },
      error: (e) => console.error("AudioEncoder error:", e)
    });

    console.log(">>> AUDIO ENCODER CREATED (not configured)");
    this.deferAudioConfig = true;

    // Most browsers deliver 48kHz audio — we detect dynamically later
    this.audioEncoderConfigured = false;
  }

  configureAudioFromTrack(audioTrack) {
    const processor = new MediaStreamTrackProcessor({ track: audioTrack });
    this.audioReader = processor.readable.getReader();

    // We can't configure until we see first chunk (need sample rate)
    this.deferAudioConfig = true;
  }

  /* -------------------------------------------------------------
   * ENCODE LOOP — VIDEO
   * ------------------------------------------------------------- */
  async encodeVideoFrame(canvas, timestamp) {
    const frame = new VideoFrame(canvas, { timestamp });

    this.videoEncoder.encode(frame);
    frame.close();
  }

  /* -------------------------------------------------------------
   * ENCODE LOOP — AUDIO
   * ------------------------------------------------------------- */
    async pumpAudio() {

        console.log("pumpAudio");

        if (!this.audioReader) return;

        console.log("pumpAudio after checking audioReader");

        const { value, done } = await this.audioReader.read();

        console.log("RAW AUDIO FRAME:", {
            valueType: value?.constructor?.name,
            numberOfChannels: value?.numberOfChannels,
            sampleRate: value?.sampleRate,
            format: value?.format,
            timestamp: value?.timestamp
        });


        if (done) return;

        // Skip invalid first frames (WebCodecs often sends a zero-channel placeholder)
        if (
            value.numberOfChannels === 0 ||
            value.numberOfChannels == null ||
            value.sampleRate == null ||
            value.sampleRate === 0
        ) {
            console.warn("Skipping invalid audio frame:", {
                numberOfChannels: value.numberOfChannels,
                sampleRate: value.sampleRate
            });
            value.close();
            return;
        }

        // First audio chunk — configure encoder
        if (this.deferAudioConfig) {
            console.log("CONFIGURING AUDIO ENCODER WITH:", {
                sampleRate: value.sampleRate,
                numberOfChannels: value.numberOfChannels
            });

            this.audioEncoder.configure({
                codec: "aac",
                sampleRate: value.sampleRate,
                numberOfChannels: value.numberOfChannels
            });
            this.deferAudioConfig = false;
        }

        this.audioEncoder.encode(value);
        value.close();
    }

  /* -------------------------------------------------------------
   * FINALIZATION + MP4 MUXING
   * ------------------------------------------------------------- */
  async finalize() {
    await this.videoEncoder.flush();
    await this.audioEncoder.flush();

    this.videoEncoder.close();
    this.audioEncoder.close();

    return await this._muxMP4();
  }

  async _muxMP4() {
    return new Promise((resolve) => {
      const mp4box = this.MP4Box.createFile();
      mp4box.onReady = (info) => {};

      mp4box.onError = (e) => console.error("MP4Box error:", e);
      mp4box.onMoovStart = () => {};
      mp4box.onSegment = () => {};

      // Feed video chunks
      for (const chunk of this.videoChunks) {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        buffer.fileStart = chunk.timestamp;
        mp4box.appendBuffer(buffer);
      }

      // Feed audio chunks
      for (const chunk of this.audioChunks) {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        buffer.fileStart = chunk.timestamp;
        mp4box.appendBuffer(buffer);
      }

      mp4box.flush();

      // Extract MP4
      const mp4Buffers = [];
      mp4box.onSegment = (id, user, buffer, sampleNum, isLast) => {
        mp4Buffers.push(buffer);
        if (isLast) {
          const mp4 = new Blob(mp4Buffers, { type: "video/mp4" });
          resolve(mp4);
        }
      };
    });
  }
}

