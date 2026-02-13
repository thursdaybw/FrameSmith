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

export class Mp4BoxDemuxer {
    constructor(arrayBuffer, options = {}) {
        this.arrayBuffer = arrayBuffer;
        this.options = options;
    }

    getVideoTrackInfo() {
        return this.videoTrack;
    }

    getAudioTrackInfo() {
        const track = this.info?.audioTracks?.[0];
        if (!track || !track.audio) {
            return null;
        }

        return {
            codec: track.codec,
            timescale: track.timescale,

            // REQUIRED FOR COMPILER ADMISSIBILITY
            channelCount: track.audio.channel_count,
            sampleRate: track.audio.sample_rate,
            sampleSize: track.audio.sample_size,

            // optional but useful
            bitrate: track.bitrate,
            samplesDuration: track.samples_duration
        };
    }

    getAudioEsds() {
        if (!this.audioTrackId) return null;

        const trak = this.moov?.traks?.find(
            t => t.tkhd.track_id === this.audioTrackId
        );

        return (
            trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.esds ?? null
        );
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

    toNano(value, scale) {
        // MP4 timescale → seconds → micro → nano
        return Math.round((value / scale) * 1_000_000_000);
    };

    async parse() {
        return new Promise((resolve, reject) => {
            try {

                const mp4boxFile = MP4Box.createFile();

                const videoSamples = [];
                const audioSamples = [];
                let resolved = false;
                let ready = false;
                let appendComplete = false;
                let expectedVideoSamples = null;
                let expectedAudioSamples = 0;
                let extractionStarted = false;
                let noProgressTimeoutId = null;
                const parseTimeoutMs = Number.isFinite(this.options?.parseTimeoutMs)
                    ? Math.max(5_000, Math.floor(this.options.parseTimeoutMs))
                    : 120_000;

                const timeoutId = setTimeout(() => {
                    settle(
                        reject,
                        new Error(
                            "Mp4BoxDemuxer.parse timeout " +
                            `(timeoutMs=${parseTimeoutMs}, ready=${ready}, appendComplete=${appendComplete}, ` +
                            `expectedVideoSamples=${expectedVideoSamples}, expectedAudioSamples=${expectedAudioSamples}, ` +
                            `videoSamples=${videoSamples.length}, audioSamples=${audioSamples.length})`
                        )
                    );
                }, parseTimeoutMs);

                const settle = (fn, value) => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeoutId);
                    if (noProgressTimeoutId) {
                        clearTimeout(noProgressTimeoutId);
                        noProgressTimeoutId = null;
                    }
                    fn(value);
                };

                const maybeFinalize = () => {
                    if (!ready || !appendComplete) return;
                    if (typeof expectedVideoSamples !== "number") return;
                    const videoDone = videoSamples.length >= expectedVideoSamples;
                    const audioDone = audioSamples.length >= expectedAudioSamples;
                    if (!videoDone || !audioDone) return;

                    settle(resolve, {
                        videoSamples,
                        audioSamples,
                        videoTrack: this.videoTrack,
                        audioTrack: this.audioTrack,
                        duration: this.info.duration,
                        timescale: this.info.timescale
                    });
                };

                const maybeStartExtraction = () => {
                    if (extractionStarted) return;
                    if (!ready) return;
                    extractionStarted = true;
                    mp4boxFile.start();

                    // If extraction starts but no samples arrive for a while after all bytes
                    // are appended, fail fast instead of waiting for global timeout.
                    const armNoProgressTimeout = () => {
                        if (!appendComplete || noProgressTimeoutId) return;
                        noProgressTimeoutId = setTimeout(() => {
                            if (videoSamples.length === 0 && audioSamples.length === 0) {
                                settle(
                                    reject,
                                    new Error(
                                        "Mp4BoxDemuxer.parse no sample progress " +
                                        `(ready=${ready}, appendComplete=${appendComplete}, ` +
                                        `expectedVideoSamples=${expectedVideoSamples}, expectedAudioSamples=${expectedAudioSamples})`
                                    )
                                );
                            }
                        }, 8000);
                    };
                    armNoProgressTimeout();
                    maybeFinalize();
                };

                const maybeArmNoProgressTimeout = () => {
                    if (!extractionStarted || !appendComplete || noProgressTimeoutId) return;
                    noProgressTimeoutId = setTimeout(() => {
                        if (videoSamples.length === 0 && audioSamples.length === 0) {
                            settle(
                                reject,
                                new Error(
                                    "Mp4BoxDemuxer.parse no sample progress " +
                                    `(ready=${ready}, appendComplete=${appendComplete}, ` +
                                    `expectedVideoSamples=${expectedVideoSamples}, expectedAudioSamples=${expectedAudioSamples})`
                                )
                            );
                        }
                    }, 8000);
                };

                mp4boxFile.onError = (e) => {
                    console.error("mp4box error:", e);
                    settle(reject, new Error("mp4box error: " + e));
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
                        settle(reject, new Error("No video track found"));
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
                    expectedVideoSamples = videoTrack.nb_samples;
                    expectedAudioSamples = audioTrack?.nb_samples ?? 0;
                    mp4boxFile.setExtractionOptions(this.videoTrackId, null, {
                        nbSamples: Math.min(250, Math.max(1, videoTrack.nb_samples))
                    });

                    if (this.audioTrackId) {
                        mp4boxFile.setExtractionOptions(this.audioTrackId, null, {
                            nbSamples: Math.min(250, Math.max(1, audioTrack.nb_samples))
                        });
                    }

                    ready = true;
                    maybeStartExtraction();
                    maybeFinalize();

                };

                mp4boxFile.onSamples = (trackId, _user, samples) => {

                    for (const s of samples) {
                        const timestampUs = this.toMicro(s.cts, s.timescale);
                        const durationUs = this.toMicro(s.duration, s.timescale);
                        const dtsUs = this.toMicro(
                            typeof s.dts === "number" ? s.dts : s.cts,
                            s.timescale
                        );

                        const encoded = {
                            type: s.is_sync ? "key" : "delta",
                            timestamp: timestampUs,
                            duration: durationUs,
                            cts: timestampUs,
                            dts: dtsUs,
                            data: new Uint8Array(s.data),
                            raw: s // preserve mp4box timing/source fields for callers
                        };

                        if (
                            trackId === this.audioTrackId &&
                            audioSamples.length === 0
                        ) {
                            console.log("AUDIO FIRST SAMPLE (µs)", {
                                ts: encoded.timestamp,
                                dur: encoded.duration,
                                rawDuration: s.duration,
                                timescale: s.timescale
                            });
                        }

                        if (trackId === this.videoTrackId) {
                            videoSamples.push(encoded);
                        } else if (trackId === this.audioTrackId) {
                            audioSamples.push(encoded);
                        }
                    }

                    maybeFinalize();
                };

                const file = this.arrayBuffer;
                const CHUNK = 512 * 1024; // 512 KB
                let offset = 0;

                const feedChunk = () => {
                    if (offset >= file.byteLength) {
                        appendComplete = true;
                        maybeStartExtraction();
                        maybeArmNoProgressTimeout();
                        if (extractionStarted) {
                            mp4boxFile.flush();
                        }
                        maybeFinalize();

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
                settle(reject, e);
            }
        });
    }

    /** Convert MP4 timescale → microseconds for WebCodecs */
    toMicro(value, scale) {
        return Math.round((value / scale) * 1_000_000);
    }
}
