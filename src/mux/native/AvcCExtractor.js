function findStartCode(bytes, pos) {
    const len = bytes.length;

    // 00 00 01
    if (pos + 3 <= len &&
        bytes[pos] === 0x00 &&
        bytes[pos+1] === 0x00 &&
        bytes[pos+2] === 0x01) {
        return { index: pos, size: 3 };
    }

    // 00 00 00 01
    if (pos + 4 <= len &&
        bytes[pos] === 0x00 &&
        bytes[pos+1] === 0x00 &&
        bytes[pos+2] === 0x00 &&
        bytes[pos+3] === 0x01) {
        return { index: pos, size: 4 };
    }

    return null;
}

export class AvcCExtractor {

    constructor() {
        this.sequenceParameterSet = null;
        this.pictureParameterSet = null;
        this.ready = false;
        this.rawAvcC = null;
    }

    /**
     * Ingest a sample encoded in Annex-B format and extract any
     * sequence parameter sets (SPS) and picture parameter sets (PPS).
     *
     * Annex-B consists of start-code-delimited network abstraction
     * layer units (network abstraction layer unit, NALU).
     *
     * This method scans each network abstraction layer unit (NALU),
     * identifies sequence parameter sets (SPS, unit type 7) and picture
     * parameter sets (PPS, unit type 8), and stores them for later
     * construction of the AVC decoder configuration record.
     */
     ingestAnnexBSample(bytes) {
         console.log("TRACE INGEST START: bytes.length =", bytes.length);
         console.log("TRACE INGEST START: bytes =", Array.from(bytes));
         console.log(
             "TRACE INGEST START: hex =",
             Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join(" ")
         );


         // 1. Validate type
         if (!(bytes instanceof Uint8Array)) {
             throw new Error("AvcCExtractor.ingestAnnexBSample: expected Uint8Array (Annex-B), received invalid type");
         }

         // 2. Validate minimal structure
         // Must contain at least one start code (00 00 00 01 or 00 00 01)
         let hasStartCode = false;
         for (let i = 0; i < bytes.length - 3; i++) {
             if (bytes[i] === 0 && bytes[i+1] === 0 &&
                 (bytes[i+2] === 1 || (bytes[i+2] === 0 && bytes[i+3] === 1))) {
                 hasStartCode = true;
                 break;
             }
         }

         if (!hasStartCode) {
             throw new Error(
                 "AvcCExtractor.ingestAnnexBSample: input does not contain Annex-B start codes (invalid input format)"
             );
         }

        // entire current implementation
        if (this.ready) return;

         let i = 0;
         const len = bytes.length;

         while (i < len) {

             // find next start code
             const sc = findStartCode(bytes, i);
             if (!sc) break;

             const naluStart = sc.index + sc.size;

             // find next start code after this NAL
             let j = naluStart;
             while (j < len) {
                 const next = findStartCode(bytes, j);
                 if (next) break;
                 j++;
             }

             // Extract NAL (exclusive of start code)
             const nalu = bytes.subarray(naluStart, j);

             console.log("TRACE NALU: start =", naluStart, "end =", j, "length =", nalu.length);
             console.log(
                 "TRACE NALU BYTES =",
                 Array.from(nalu)
             );
             console.log(
                 "TRACE NALU HEX =",
                 Array.from(nalu).map(b => b.toString(16).padStart(2,"0")).join(" ")
             );

             if (nalu.length > 0) {
                 const type = nalu[0] & 0x1F;

                 if (type === 7) {
                     console.log("TRACE SPS FOUND:", Array.from(nalu));
                     this.sequenceParameterSet = nalu;
                 }

                 if (type === 8) {
                     console.log("TRACE PPS FOUND:", Array.from(nalu));
                     this.pictureParameterSet = nalu;
                 }

                 if (this.sequenceParameterSet && this.pictureParameterSet) {
                     this.ready = true;
                     return;
                 }
             }

             i = j;
         }

     }


    /**
     * Ingest a length-prefixed AVC (AVCC) sample and extract SPS and PPS.
     * This method expects the byte array to contain 4-byte NALU length
     * prefixes followed by raw NALU data.
     */
    ingestAvccSamplesAndExtractSPSPPS(byteArray) {

        if (this.ready) {
            console.log("AVCC: Already ready, skipping ingest");
            return;
        }

        console.log("AVCC: Starting ingest");
        console.log("AVCC: Byte array length =", byteArray.length);
        console.log("AVCC: First 32 bytes =", byteArray.slice(0, 32));

        if (this.ready) {
            return;
        }

        let offset = 0;
        const total = byteArray.length;

        let foundSps = false;
        let foundPps = false;

        while (offset + 4 <= total) {

            // Read NALU length (big endian)
            const length =
                (byteArray[offset] << 24) |
                (byteArray[offset + 1] << 16) |
                (byteArray[offset + 2] << 8) |
                (byteArray[offset + 3]);

            console.log("AVCC: NALU length =", length)

            offset += 4;

            if (length <= 0 || offset + length > total) {
                console.log("AVCC: INVALID OR TRUNCATED NALU, stopping");
                break; // Invalid or truncated sample
            }

            const nalu = byteArray.subarray(offset, offset + length);
            offset += length;

            const naluType = nalu[0] & 0x1F;
            console.log("AVCC: NALU type =", naluType, "size =", nalu.length);

            if (naluType === 7) {
                this.sequenceParameterSet = nalu;
                foundSps = true;
                console.log("AVCC: FOUND SPS (type 7)");
            }

            if (naluType === 8) {
                this.pictureParameterSet = nalu;
                foundPps = true;
                console.log("AVCC: FOUND PPS (type 8)");
            }

            if (foundSps && foundPps) {
                console.log("AVCC: READY = TRUE");
                this.ready = true;
                return;
            }
        }

        console.log("AVCC: Completed ingest. Found SPS:", foundSps, "Found PPS:", foundPps);
        console.log("AVCC: final ready =", this.ready);

    }

    hasConfig() {
        return this.ready;
    }

    /**
     * Construct AVCDecoderConfigurationRecord (avcC) payload.
     * This returns ONLY the payload, NOT the MP4 box wrapper.
     */
    getAvcC() {
        // If a complete avcC record was provided externally,
        // return it unchanged (authoritative).
        if (this.rawAvcC) {
            return this.rawAvcC;
        }


        if (!this.ready) {
            throw new Error("AvcCExtractor: SPS/PPS not extracted");
        }

        const sps = this.sequenceParameterSet;
        const pps = this.pictureParameterSet;

        const spsLength = sps.length;
        const ppsLength = pps.length;

        // Total size = 7 bytes header + 2 + sps + 1 + 2 + pps
        const total =
            7 +
            2 + spsLength +
            1 +
            2 + ppsLength;

        const out = new Uint8Array(total);
        let o = 0;

        // configurationVersion
        out[o++] = 1;

        // SPS-derived fields
        out[o++] = sps[1]; // AVCProfileIndication
        out[o++] = sps[2]; // profile_compatibility
        out[o++] = sps[3]; // AVCLevelIndication

        // reserved (111111) + lengthSizeMinusOne (3 = 4 bytes NALU length)
        out[o++] = 0xFF;

        // reserved (111) + numOfSequenceParameterSets (1)
        out[o++] = 0xE1;

        // SPS length
        out[o++] = (spsLength >>> 8) & 0xFF;
        out[o++] = (spsLength) & 0xFF;

        // SPS payload
        out.set(sps, o);
        o += spsLength;

        // numOfPictureParameterSets = 1
        out[o++] = 1;

        // PPS length
        out[o++] = (ppsLength >>> 8) & 0xFF;
        out[o++] = (ppsLength) & 0xFF;

        // PPS payload
        out.set(pps, o);
        o += ppsLength;

        console.log("AVCC: BUILD RESULT ----------------");
        console.log("AVCC: Total length =", out.length);
        console.log("AVCC: Full bytes =", new Uint8Array(out));
        console.log("AVCC: Hex =", Array.from(out).map(b => b.toString(16).padStart(2, "0")).join(" "));
        console.log("-----------------------------------");

        return out;

    }

    /**
     * loadConfigurationRecord
     *
     * Accepts a pre-built AVCDecoderConfigurationRecord (avcC) that
     * already contains SPS and PPS data. This is used as a temporary
     * compatibility bridge for WebCodecs, which often provides SPS/PPS
     * externally rather than inside encoded video chunks.
     *
     * This method allows NativeMuxer to be functional until the future
     * EncoderAdapter refactor is completed.
     */
    loadConfigurationRecord(avcBytes) {
        if (!(avcBytes instanceof Uint8Array)) {
            throw new Error("AvcCExtractor.loadConfigurationRecord: expected Uint8Array");
        }

        // Store authoritative avcC payload exactly as provided.
        // Do not parse. Browsers may include extensions or multiple SPS/PPS.
        this.rawAvcC = new Uint8Array(avcBytes);
        this.ready = true;
    }

}
