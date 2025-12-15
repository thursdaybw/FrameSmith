import { SampleCollector } from "./SampleCollector.js";
import { AvcCExtractor } from "./AvcCExtractor.js";
import { TimingModel } from "./TimingModel.js";
import { Assembler } from "./Assembler.js";
import { BoxFactory } from "./BoxFactory.js";
import { convertAnnexBToMp4 } from "./convertAnnexBToMp4.js";
import { dumpBoxes } from "./debug/dumpBoxes.js";

export class NativeMuxer {

    /**
     * constructor
     *
     * Temporary design note:
     * -----------------------
     * WebCodecs does not always emit SPS/PPS (sequence and picture
     * parameter sets) inside encoded frames. Some platforms provide these
     * values separately through the encoder configuration record.
     *
     * This parameter allows injecting that configuration record as a
     * temporary workaround until the architecture is refactored to include
     * a dedicated EncoderAdapter layer.
     *
     * Future architecture:
     *   ExportEngine → EncoderAdapter → MuxerEngine
     *
     * At that point, NativeMuxer will no longer receive raw WebCodecs
     * objects or encoder-specific data. For now, accepting the optional
     * configuration record keeps the system functional.
     */
    constructor({ codec, width, height, fps, chunkPolicy }) {
        if (!codec || !width || !height || !fps) {
            throw new Error("NativeMuxer: Missing required constructor params");
        }

        this.codec = codec;
        this.width = width;
        this.height = height;
        this.fps = fps;

        this.collector = new SampleCollector();
        this.avcC = new AvcCExtractor();
        this.timing = new TimingModel(fps);

        this.boxes = BoxFactory;

        this.chunkPolicy = chunkPolicy;

        this._finalized = false;
    }

    /**
     * Temporary API
     * -------------
     * WebCodecs does not always include sequence and picture parameter sets
     * (SPS and PPS) inside encoded frames. Some platforms expose them only
     * through the encoder configuration record.
     *
     * ExportEngine calls this method to supply that record directly.
     *
     * This method will be removed once the architecture is refactored to:
     *     ExportEngine → EncoderAdapter → MuxerEngine
     *
     * At that point NativeMuxer will no longer receive WebCodecs-specific
     * configuration data and this setter will be deleted.
     */
    setCodecConfigurationRecord(record) {
        this.avcC.loadConfigurationRecord(record);
    }

    addVideoFrame(encodedFrame) {

        if (this._finalized) {
            throw new Error("NativeMuxer: addVideoFrame() called after finalize()");
        }

        // 1. Copy bytes
        const annexB = new Uint8Array(encodedFrame.byteLength);
        encodedFrame.copyTo(annexB);
        const lengthPrefixed = convertAnnexBToMp4(annexB);

        console.log("TRACE ADD: copied annexB.length =", annexB.length);
        console.log("TRACE ADD: copied annexB bytes =", Array.from(annexB));
        console.log(
            "TRACE ADD: copied annexB hex =",
            Array.from(annexB).map(b => b.toString(16).padStart(2,"0")).join(" ")
        );

        // 2. Normalize timestamp + duration NOW
        const timestampMicroseconds = Number(encodedFrame.timestamp);
        const durationMicroseconds = Number(encodedFrame.duration || 0);

        // 3. Extract SPS/PPS with instrumentation
        if (!this.avcC.ready) {
            console.log("MUXER: Incoming annexB length =", annexB.length);
            console.log("MUXER: First 32 bytes of annexB =", annexB.slice(0, 32));
            console.log("MUXER: avcC.ready BEFORE ingest =", this.avcC.ready);
            console.log("MUXER: Calling ingestAnnexBSample...");

            this.avcC.ingestAnnexBSample(annexB);

            console.log("MUXER: avcC.ready AFTER ingest =", this.avcC.ready);
        }

        // 4. Timing model 
        this.timing.addFrame(timestampMicroseconds)

        // 5. SampleCollector
        this.collector.addSample({
            data: lengthPrefixed,
            size: lengthPrefixed.length,
            timestampMicroseconds: timestampMicroseconds,
            durationMicroseconds: durationMicroseconds
        });
    }

/**
 * finalize()
 * ==========
 *
 * Finalizes the MP4 file and returns a playable Blob.
 *
 * This method is intentionally large.
 * It represents the *assembly boundary* of the entire muxing pipeline.
 *
 * Responsibilities (in strict order):
 * ----------------------------------
 *
 * 1. Validate required codec configuration
 *    -------------------------------------
 *    Ensures SPS/PPS (avcC) has been discovered or injected.
 *    MP4 files without codec configuration are invalid and rejected.
 *
 * 2. Freeze sample and timing state
 *    -------------------------------
 *    - Samples are read from SampleCollector
 *    - Timing data is finalized from TimingModel
 *    After this point, no new samples may be added.
 *
 * 3. Build all STBL *leaf* boxes (JSON → bytes)
 *    ------------------------------------------
 *    These boxes describe *what* the samples are:
 *
 *      stsd  Sample descriptions (avc1 → avcC)
 *      stts  Sample timing
 *      stsc  Sample-to-chunk mapping
 *      stsz  Sample sizes
 *      stco  Chunk offsets (TEMPORARY, see below)
 *
 *    IMPORTANT:
 *    These builders do not compute layout.
 *    They only serialize the data they are given.
 *
 * 4. First-pass MOOV assembly (layout discovery)
 *    --------------------------------------------
 *    A temporary `moov` box is built using a dummy stco.
 *
 *    Purpose:
 *      - Freeze the byte size of every box
 *      - Determine the final file layout
 *
 *    This pass answers:
 *      “How large will the metadata be?”
 *
 * 5. Compute real STCO offsets (layout resolution)
 *    ---------------------------------------------
 *    Chunk offsets depend on:
 *
 *      ftyp size
 *      final moov size
 *      mdat header size
 *      cumulative sample sizes
 *
 *    This creates a fundamental dependency:
 *
 *      stco offsets depend on moov size
 *
 *    Because stco *lives inside moov*, this cannot
 *    be resolved in a single pass.
 *
 *    The solution is a second pass.
 *
 * 6. Second-pass MOOV assembly (final metadata)
 *    ------------------------------------------
 *    A new stco is built with correct offsets.
 *    A new moov is built containing that stco.
 *    After this step
 *      - All offsets are correct
 *      - All box sizes are stable
 *
 * 7. Build MDAT
 *    -----------
 *    Media samples are concatenated exactly as described
 *    by the STBL tables.
 *
 * 8. Final file assembly
 *    -------------------
 *    The final MP4 byte layout is:
 *
 *      ftyp
 *      moov
 *      mdat
 *
 * Architectural Notes:
 * --------------------
 *
 * - This method owns *layout*.
 * - Leaf box builders must remain pure and stateless.
 * - The two-pass strategy is not an optimization;
 *   it is required by the MP4 format.
 *
 * Why this method is large:
 * -------------------------
 *
 * This is not accidental complexity.
 *
 * `finalize()` is the point where:
 *   - temporal data becomes structural
 *   - abstract samples become bytes on disk
 *   - circular dependencies are resolved by staging
 *
 * Refactoring will extract helpers,
 * but the *sequence* and *ownership* must remain intact.
 *
 * Any future refactor MUST preserve:
 *   - two-pass moov construction
 *   - stco computed only after moov sizing
 *   - clear separation between layout and serialization
 */
    async finalize() {
        if (this._finalized) {
            throw new Error("NativeMuxer: finalize() called twice");
        }
        this._finalized = true;

        // --------------------------------------------------------
        // 1. Check SPS/PPS availability
        // --------------------------------------------------------
        if (!this.avcC.hasConfig()) {
            throw new Error("NativeMuxer: No SPS/PPS found in samples");
        }

        // --------------------------------------------------------
        // 2. Gather sample + timing data
        // --------------------------------------------------------
        const samples = this.collector.samples;
        if (samples.length === 0) {
            throw new Error("NativeMuxer: No samples added");
        }

        const { sttsEntries, totalDuration } = this.timing.finalize();

        // --------------------------------------------------------
        // 3. Build STBL leaf boxes
        // --------------------------------------------------------
        const avcCBytes = this.avcC.getAvcC();

        console.log("MUXER FINAL: avcC payload length =", avcCBytes.length);
        console.log("MUXER FINAL: avcC payload bytes =", Array.from(avcCBytes));
        console.log("MUXER FINAL: avcC hex =", Array.from(avcCBytes).map(b => b.toString(16).padStart(2,"0")).join(" "));


        const stsd = this.boxes.stsd({
            width: this.width,
            height: this.height,
            codec: this.codec,
            avcC: new Uint8Array(avcCBytes)   // MUST be Uint8Array
        });

        const entry = sttsEntries[0];
        const stts = this.boxes.stts(entry.sampleCount, entry.sampleDuration);

        const chunkLayout = planChunkLayout({
            policy: this.chunkPolicy || "framesmith-simple",
            samples
        });
        const stsc = this.boxes.stsc(chunkLayout);

        const stsz = this.boxes.stsz(samples.map(s => s.size));
        console.log("TRACE STSZ INITIAL:");
        console.log("  len =", stsz.length);
        console.log("  header =", Array.from(stsz.slice(0, 16)));

        const stco = this.boxes.stco([]);                    // we patch offsets later

        // --------------------------------------------------------
        // 4. Build MDIA timeline boxes
        // --------------------------------------------------------
        const mdhd = this.boxes.mdhd({
            timescale: 90000,
            duration: totalDuration
        });

        const hdlr = this.boxes.hdlr();
        const vmhd = this.boxes.vmhd();
        const dref = this.boxes.dref();

        // --------------------------------------------------------
        // 5. Track-level boxes
        // --------------------------------------------------------
        const tkhd = this.boxes.tkhd({
            width: this.width,
            height: this.height,
            duration: totalDuration
        });

        // --------------------------------------------------------
        // 6. Movie-level mvhd box
        // --------------------------------------------------------
        const mvhd = this.boxes.mvhd({
            timescale: 90000,
            duration: totalDuration
        });

        // --------------------------------------------------------
        // 7. Build temp moov WITHOUT stco offsets
        // --------------------------------------------------------
        console.log("DEBUG: BOX SIZES BEFORE MOOV");
        console.log({
            mvhd: mvhd.length,
            tkhd: tkhd.length,
            mdhd: mdhd.length,
            hdlr: hdlr.length,
            vmhd: vmhd.length,
            dref: dref.length,
            stsd: stsd.length,
            stts: stts.length,
            stsc: stsc.length,
            stsz: stsz.length,
            stco: stco.length
        });
        const paramsBefore = {
            mvhd,
            tkhd,
            mdhd,
            hdlr,
            vmhd,
            dref,
            stsd,
            stts,
            stsc,
            stsz,
            stco
        };

        console.log("DEBUG: MOOV PARAM KEYS", Object.keys(paramsBefore));

        const moovBeforeStco = this.boxes.moov(paramsBefore);

        console.log("TRACE STSZ BEFORE FIRST MOOV:");
        console.log("  stsz len =", paramsBefore.stsz.length);
        console.log("  stsz header =", Array.from(paramsBefore.stsz.slice(0, 16)));

        // --------------------------------------------------------
        // 8. Compute stco offsets
        // --------------------------------------------------------
        const ftyp = this.boxes.ftyp();

        const dummyStco = this.boxes.stco([]);

        const moovTemp = this.boxes.moov({
            mvhd,
            tkhd,
            mdhd,
            hdlr,
            vmhd,
            dref,
            stsd,
            stts,
            stsc,
            stsz,
            stco: dummyStco
        });

        const realMoovSize = moovTemp.length;
        const mdatHeaderSize = 8;

        const firstMdatOffset =
            ftyp.length +
            realMoovSize +
            mdatHeaderSize;

        const offsets = [];
        let cursor = firstMdatOffset;

        for (const s of samples) {
            offsets.push(cursor);
            cursor += s.size;
        }

        const stcoFixed = this.boxes.stco(offsets);

        const moov = this.boxes.moov({
            mvhd,
            tkhd,
            mdhd,
            hdlr,
            vmhd,
            dref,
            stsd,
            stts,
            stsc,
            stsz,
            stco: stcoFixed
        });

        console.log("MOOV HEX", Array.from(moov).map(x => x.toString(16).padStart(2,"0")).join(" "));

        console.log("TRACE STSZ BEFORE SECOND MOOV:");
        console.log("  stsz len =", stsz.length);
        console.log("  stsz header =", Array.from(stsz.slice(0, 16)));

        // --------------------------------------------------------
        // 10. Build mdat
        // --------------------------------------------------------
        const mdat = this.boxes.mdat(samples);

        // --------------------------------------------------------
        // 11. Final join
        // --------------------------------------------------------
        const fileBytes = Assembler.concat([ftyp, moov, mdat]);
        const blob = new Blob([fileBytes], { type: "video/mp4" });


        // After building final moov and before returning blob
        console.log("---- DEBUG: MOOV STRUCTURE ----");
        dumpBoxes(moov, 0, moov.length);

        console.log("---- DEBUG: STBL STRUCTURE ----");
        // find stbl inside moov
        let stblOffset = -1;
        for (let i = 0; i < moov.length - 4; i++) {
            if (moov[i] === 0x73 && moov[i+1] === 0x74 && moov[i+2] === 0x62 && moov[i+3] === 0x6C) {
                stblOffset = i - 4; // rewind to size field
                break;
            }
        }
        if (stblOffset >= 0) {
            const stblSize =
                (moov[stblOffset] << 24) |
                (moov[stblOffset+1] << 16) |
                (moov[stblOffset+2] << 8) |
                (moov[stblOffset+3]);
            dumpBoxes(moov, stblOffset, stblSize);
        } else {
            console.error("NO STBL FOUND");
        }


        return blob;
    }

}
