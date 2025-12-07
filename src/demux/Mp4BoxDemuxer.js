/*ggyG
 * Mp4BoxDemuxer — Clean, deterministic MP4 → compressed samples
 *
 * Uses mp4box.js correctly:
 *   - Begin extraction ONLY after onReady
 *   - Collect samples in onSamples
 *   - Resolve ONLY in onFlush (MP4Box’s “all done” signal)
 *
 * This avoids:
 *   - premature onSamples
 *   - deadlocks
 *   - incorrect nb_samples assumptions
 *   - race conditions
 */

import { EncodedSampleLike } from "../types/EncodedSampleLike.js";


export class Mp4BoxDemuxer {
    constructor(arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
    }

    getVideoTrackInfo() {
        return this.videoTrack;
    }

    // Convert mp4box's parsed AVCConfigurationBox into the binary
    // AVCDecoderConfigurationRecord required by WebCodecs VideoDecoder.
    getAvcCBuffer() {
        const avcC = this._avcC;
        if (!avcC) return null;

        // mp4box parsed fields
        const size = avcC.size;
        const hdr = avcC.hdr_size; // number of bytes NOT part of the record body

        // Total payload excluding header
        const total = size - hdr;
        const out = new Uint8Array(total);
        let offset = 0;

        // 1. Fixed header (ISO/IEC 14496-15 Annex A)
        out[offset++] = avcC.configurationVersion;
        out[offset++] = avcC.AVCProfileIndication;
        out[offset++] = avcC.profile_compatibility;
        out[offset++] = avcC.AVCLevelIndication;

        // lengthSizeMinusOne is in the low 2 bits, upper 6 bits must be all ones
        out[offset++] = (avcC.lengthSizeMinusOne & 0x03) | 0xFC;

        // numOfSequenceParameterSets in lower 5 bits, upper 3 bits all ones
        out[offset++] = (avcC.nb_SPS_nalus & 0x1F) | 0xE0;

        // 2. SPS arrays
        for (const sps of avcC.SPS) {
            out[offset++] = (sps.length >>> 8) & 0xFF;
            out[offset++] = sps.length & 0xFF;
            out.set(sps.data, offset);
            offset += sps.length;
        }

        // 3. PPS count
        out[offset++] = avcC.nb_PPS_nalus;

        // 4. PPS arrays
        for (const pps of avcC.PPS) {
            out[offset++] = (pps.length >>> 8) & 0xFF;
            out[offset++] = pps.length & 0xFF;
            out.set(pps.data, offset);
            offset += pps.length;
        }

        // 5. Extra bytes from mp4box, if any (rare, but spec allows)
        if (avcC.ext && avcC.ext.length > 0) {
            out.set(avcC.ext, offset);
            offset += avcC.ext.length;
        }

        return out.buffer;
    }

    getAudioTrackInfo() {
        return this.info?.audioTracks?.[0] ?? null;
    }

    toNano(value, scale) {
        // MP4 timescale → seconds → micro → nano
        return Math.round((value / scale) * 1_000_000_000);
    };

    async parse() {
        return new Promise((resolve, reject) => {
            try {

                const keepMdatData = true;
                const mp4boxFile = MP4Box.createFile(keepMdatData);


                const videoSamples = [];
                const audioSamples = [];

                mp4boxFile.onError = (e) => {
                    console.error("mp4box error:", e);
                    reject(new Error("mp4box error: " + e));
                };

                mp4boxFile.onSegment = (id, user, buffer, sampleNum) => {
                    // Required for full extraction lifecycle, even if unused
                    // console.log("onSegment", id, sampleNum);
                };

                mp4boxFile.onReady = (info) => {

                    // STORE MOOV TREE FOR AVC CONFIG LOOKUP
                    this.moov = mp4boxFile.moov;
                    const moov = this.moov;

                    // 1. STORE VIDEO AND AUDIO TRACKS FIRST (important: BEFORE logging fields)
                    this.info = info;

                    const videoTrack = info.videoTracks[0];
                    const audioTrack = info.audioTracks[0];

                    if (!videoTrack) {
                        reject(new Error("No video track found"));
                        return;
                    }

                    this.videoTrackId = videoTrack.id;
                    this.audioTrackId = audioTrack?.id ?? null;

                    // STORE FULL TRACK OBJECTS
                    this.videoTrack = videoTrack;
                    this.audioTrack = audioTrack;

                    // 2. NOW LOG THEM (this.videoTrack is defined now)
                    const trak = moov?.traks?.find(t => t.tkhd.track_id === this.videoTrack.id);

                    this._avcC = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.avcC || null;

                    // 4. Enable extraction
                    mp4boxFile.setExtractionOptions(this.videoTrackId, null, {
                        nbSamples: videoTrack.nb_samples
                    });

                    if (this.audioTrackId) {
                        mp4boxFile.setExtractionOptions(this.audioTrackId, null, {
                            nbSamples: audioTrack.nb_samples
                        });
                    }

                };

                mp4boxFile.onSamples = (trackId, _user, samples) => {

                    for (const s of samples) {
                        const encoded = new EncodedSampleLike({
                            type: s.is_sync ? "key" : "delta",
                            timestamp: this.toNano(s.cts, s.timescale),
                            duration: this.toNano(s.duration, s.timescale),

                            // Not sure which is appropriate, toNano or toMicro
                            // timestamp: this.toMicro(s.cts, s.timescale),
                            // duration: this.toMicro(s.duration, s.timescale),
                            data: new Uint8Array(s.data),

                            raw: s  // ← KEEP ORIGINAL SAMPLE. REQUIRED FOR avcC.
                        });
                        if (trackId === this.videoTrackId) {
                            videoSamples.push(encoded);
                        } else if (trackId === this.audioTrackId) {
                            audioSamples.push(encoded);
                        }
                    }
                };

                const finalize = () => {

                    resolve({
                        videoSamples,
                        audioSamples,
                        videoTrack: this.videoTrack,
                        audioTrack: this.audioTrack,
                        duration: this.info.duration,
                        timescale: this.info.timescale
                    });
                };

                const file = this.arrayBuffer;
                const CHUNK = 512 * 1024; // 512 KB
                let offset = 0;

                const feedChunk = () => {
                    if (offset >= file.byteLength) {


                        mp4boxFile.start();
                        mp4boxFile.flush();

                        finalize();

                        return;
                    }

                    const chunk = file.slice(offset, offset + CHUNK);
                    chunk.fileStart = offset;

                    const isLast = (offset + CHUNK >= file.byteLength);
                    const next = mp4boxFile.appendBuffer(chunk, isLast)

                    // If mp4box returned a next offset, follow that; otherwise add CHUNK
                    offset = next ?? (offset + CHUNK);

                    setTimeout(feedChunk, 0);
                };

                feedChunk();



            } catch (e) {
                reject(e);
            }
        });
    }

    /** Convert MP4 timescale → microseconds for WebCodecs */
    toMicro(value, scale) {
        return Math.round((value / scale) * 1_000_000);
    }
}
