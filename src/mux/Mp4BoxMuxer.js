/**
 * Mp4BoxMuxer
 * -----------
 * MP4Box.js-backed implementation of the MuxerEngine interface.
 *
 * Responsibilities:
 *   - Accept encoded video/audio samples
 *   - Insert them into MP4Box internal structures
 *   - Collect emitted segments
 *   - Produce a final MP4 Blob
 *
 * This class does NOT:
 *   - Decide track structure
 *   - Encode audio or video
 *   - Perform rendering or layout
 */

export class Mp4BoxMuxer {
    constructor({ tracks }) {
        // Example:
        // tracks = [
        //   { id: 1, kind: "video", codec: "avc1", width: 720, height: 1280, avcC: <ArrayBuffer> },
        //   { id: 2, kind: "audio", codec: "mp4a.40.2", channels: 2, sampleRate: 48000 }
        // ]

        this.tracks = tracks;
        this.mp4box = MP4Box.createFile();

        this._segments = [];
        this._initSeg = null;

        this._resolveFinal = null;
        this.finalPromise = new Promise(resolve => this._resolveFinal = resolve);

        this._setupMp4Box();
    }

    _setupMp4Box() {
        // Add all tracks up front.
        for (const t of this.tracks) {
            const trackDef = {
                id: t.id,
                type: "avc1",
                width: t.width,
                height: t.height,
                avcDecoderConfigRecord: t.avcC
            };

            this.mp4box.addTrack(trackDef);
        }

        // MP4Box will give us ftyp+moov here
        this.mp4box.onReady = info => {
            this._initSeg = info.initSeg;
        };

        // Media segments (moof+mdat)
        this.mp4box.onSegment = (id, user, buffer, sampleNum) => {
            this._segments.push(buffer);
        };
    }

    start() {
        // Assign segmentation options BEFORE we start.
        for (const t of this.tracks) {
            this.mp4box.setSegmentOptions(t.id, null, {
                nb_samples: 1,
                fragment_duration: 1000
            });
        }

        // Ensure mp4box.moov.mvex.mehd exists BEFORE initializeSegmentation()
        // -----------------------------------------------------------------------
        // MP4Box.js has a design flaw: initializeSegmentation() reads
        // this.moov.mvex.mehd.fragment_duration, but MP4Box never creates
        // mvex.mehd automatically for new files.
        //
        // Creating mehd manually ensures MP4Box has a valid initialization
        // segment duration and avoids the "fragment_duration undefined" crash.
        const mvex = this.mp4box.moov?.mvex;
        if (mvex) {
            // Create mehd via BoxRegistry
            const mehdCtor = BoxRegistry.box['mehd'];
            if (!mehdCtor) {
                throw new Error("MP4BoxMuxer: mehdBox not found in BoxRegistry");
            }

            // Prevent duplicates
            if (!mvex.mehd) {
                const mehd = new mehdCtor();
                mehd.fragment_duration = 1000; // safe placeholder
                mvex.addBox(mehd);
            }
        }

        // Now initialize segmentation
        this.mp4box.initializeSegmentation();
        this.mp4box.start();
    }

    addSample(trackId, encodedSample) {
        // Copy payload into a Uint8Array
        const data = new Uint8Array(encodedSample.byteLength);
        encodedSample.copyTo(data);

        this.mp4box.addSample(trackId, data, {
            duration: encodedSample.duration,
            dts: encodedSample.timestamp,
            cts: encodedSample.timestamp,
            is_sync: encodedSample.type === "key"
        });
    }

    finalize() {
        this.mp4box.flush();

        const combined = this._concatenateInitAndSegments();
        const blob = new Blob([combined], { type: "video/mp4" });

        this._resolveFinal(blob);
        return this.finalPromise;
    }

    _concatenateInitAndSegments() {
        const all = [];
        if (this._initSeg) all.push(new Uint8Array(this._initSeg));
        for (const seg of this._segments) all.push(new Uint8Array(seg));

        let total = all.reduce((sum, x) => sum + x.byteLength, 0);
        let out = new Uint8Array(total);

        let offset = 0;
        for (const x of all) {
            out.set(x, offset);
            offset += x.byteLength;
        }
        return out;
    }

}
