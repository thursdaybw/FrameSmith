/**
 * MuxJsDemuxer (Phase A — MP4 → Compressed Samples)
 *
 * Turn an MP4 file into raw compressed samples for WebCodecs.
 *
 * Responsibility:
 *   - Read an MP4 file
 *   - Extract compressed video samples (H.264 NALUs)
 *   - Extract compressed audio samples (AAC frames)
 *   - Provide clean sample lists for WebCodecs decoders
 *
 * Does NOT:
 *   - Decode samples
 *   - Render frames
 *   - Perform layout or animation
 *   - Know anything about RenderPlan
 *
 * Notes on Architecture:
 *   - This is one concrete demuxer.
 *   - In Phase B, a WASM demuxer or server-side demuxer will implement
 *     the same conceptual interface:
 *
 *       demuxer.parse() → { videoSamples, audioSamples, tracks }
 *
 *   - ExportEngine depends on this *interface*, not this implementation.
 *
 * This module is allowed to be concrete during Phase A because
 * architecture emerges as the system grows. Avoid premature generalization.
 */
export class MuxJsDemuxer {
  constructor(arrayBuffer) {
    this.buffer = new Uint8Array(arrayBuffer);
    this.videoTrack = null;
    this.audioTrack = null;
    this.videoSamples = [];
    this.audioSamples = [];
  }

  async parse() {
    // 1. Inspect MP4 structure
    const parsed = window.muxjs.mp4.tools.inspect(this.buffer);

    // 2. Find video + audio tracks
    const tracks = window.muxjs.mp4.tools.detectTracks(this.buffer);

    this.videoTrack = tracks.videoTrack;
    this.audioTrack = tracks.audioTrack;

    if (!this.videoTrack) {
      throw new Error("No video track found in MP4.");
    }

    // 3. Extract raw samples (NALUs + AAC frames)
    const extraction = window.muxjs.mp4.probe.extractSamples(this.buffer, tracks);

    // extraction looks like:
    // {
    //   video: [{data, timestamp, isSync}, ...],
    //   audio: [{data, timestamp}, ...]
    // }

    this.videoSamples = extraction.video || [];
    this.audioSamples = extraction.audio || [];

    return {
      videoSamples: this.videoSamples,
      audioSamples: this.audioSamples,
      videoTrack: this.videoTrack,
      audioTrack: this.audioTrack,
      duration: parsed[0]?.duration || null,
      timescale: this.videoTrack?.timescale || null
    };
  }

  getVideoSamples() {
    return this.videoSamples;
  }

  getAudioSamples() {
    return this.audioSamples;
  }

  getVideoTrackInfo() {
    return this.videoTrack;
  }

  getAudioTrackInfo() {
    return this.audioTrack;
  }
}
  
