/**
 * MuxerEngine
 *
 * High-level responsibilities:
 *   - Accept encoded Annex-B H.264 EncodedVideoChunks from ExportEngine
 *   - Accumulate them as media samples
 *   - Produce a final MP4 Blob when finalize() is called
 *
 * Lifetime:
 *   ctor --> addVideoFrame(...) repeated --> finalize() → Blob
 *
 * Invariants:
 *   - addVideoFrame() is called strictly in presentation order
 *   - encodedFrame.type is "key" or "delta"
 *   - encodedFrame.timestamp is strictly increasing (ExportEngine enforces this)
 *   - encodedFrame is Annex-B (start-coded NAL units)
 *   - finalize() is called exactly once
 */
export class MuxerEngine {
    constructor({ codec, width, height, fps }) {}

    /**
     * Called many times.
     * Must NOT block.
     * Must NOT mutate the EncodedVideoChunk.
     *
     * Required behaviors:
     *   - Extract SPS/PPS from the first keyframe (if needed)
     *   - Store size, timestamps, durations
     *   - Retain raw bytes for later mdat assembly
     */
    addVideoFrame(encodedFrame) {}

    /**
     * Called exactly once.
     *
     * Must:
     *   - Build ftyp
     *   - Build moov and all required child boxes (mvhd, trak, tkhd, mdia, mdhd, hdlr, minf, vmhd, dinf, stbl)
     *   - Build sample tables (stts, stsc, stsz, stco)
     *   - Build mdat
     *   - Return playable MP4 Blob
     */
    async finalize() : Promise<Blob> {}
}

