/**
 * This box stores the AVCDecoderConfigurationRecord.
 *
 * AVC (Advanced Video Coding), also known as H.264, is a video compression
 * standard. It defines *how video frames are encoded*, but it does not define
 * how those frames are stored in a file.
 *
 * The avcC box bridges that gap.
 *
 * It contains a compact, codec-defined binary record that tells decoders
 * how to interpret the H.264 bitstream that follows: profile, level,
 * NAL unit layout, and the SPS/PPS parameter sets required to initialize
 * the decoder.
 *
 * Unlike many MP4 boxes, avcC is **not** a FullBox:
 *   - it does not include a version field
 *   - it does not include flags
 *
 * Its entire payload is defined by the AVC specification itself, not by MP4.
 *
 * Without a correct avcC box, an MP4 file may be structurally valid but
 * fundamentally undecodable by browsers, hardware players, and mobile devices.
 *
 * What the avcC box contains:
 * ---------------------------
 * The record includes:
 *   • Profile, level, and compatibility flags
 *   • NALU length field size (usually 4 bytes)
 *   • SPS list (Sequence Parameter Sets)
 *   • PPS list (Picture Parameter Sets)
 *
 * About Sequence Parameter Set (SPS) and Picture Parameter Set (PPS):
 * ------------------
 * H.264 requires two small metadata structures that describe how the video
 * stream works:
 *
 *   • Sequence Parameter Set (SPS)
 *       Describes global properties of the video stream:
 *       resolution, cropping, profile, level, chroma format,
 *       and timing-related configuration.
 *
 *   • Picture Parameter Set (PPS)
 *       Describes decoding parameters that apply to individual pictures:
 *       entropy coding mode, slice layout, reference picture behavior,
 *       and other per-picture decoding rules.
 *
 * These are not video frames.
 * They are decoder configuration records that must be known
 * *before* any video samples can be decoded.
 *
 * About SPS and PPS:
 * ------------------
 * H.264 requires two small metadata structures that describe how the video
 * stream works:
 *
 *   • SPS – Sequence Parameter Set
 *       Describes global properties: resolution, cropping, profile, level,
 *       chroma format, and timing details.
 *
 *   • PPS – Picture Parameter Set
 *       Describes decoding details for individual pictures: entropy coding
 *       modes, slice settings, etc.
 *
 * These are not video frames. They are decoder configuration packets.
 * WebCodecs encoders typically provide SPS/PPS automatically. Framesmith does
 * not parse or modify them — it simply places them in the correct MP4 box.
 *
 * Responsibilities of this builder:
 * ---------------------------------
 * - Wrap raw SPS/PPS payloads (provided by the caller) into a proper avcC box
 * - Emit JSON structure only — no byte-level encoding
 * - Guarantee that avcC always contains the raw AVCDecoderConfigurationRecord
 * - Never validate or reinterpret SPS/PPS contents
 *
 * Non-responsibilities:
 * ---------------------
 * - Do not parse H.264 syntax
 * - Do not attempt to infer width, height, or profile from SPS
 * - Do not encode bytes (serializer handles that)
 *
 * Why this builder exists:
 * ------------------------
 * Framesmith uses a declarative JSON → byte serialization pipeline. Instead of
 * constructing binary MP4 boxes directly, we describe their structure in
 * clean, testable, deterministic JSON nodes. The serializer handles encoding.
 *
 * External References:
 * --------------------
 * ISO/IEC 14496-15 — AVC File Format Binding  
 * MP4 Conformance Examples:  
 *   https://mpeggroup.github.io/FileFormatConformance/?query=%3D%22avcC%22
 *
 * Summary:
 * --------
 * The avcC box is the heart of H.264 configuration in MP4. It packages SPS/PPS
 * and decoder metadata so that every player knows how to decode the video.
 */
export function emitAvcCBox({ avcC }) {

    /**
     * The avcC payload is a raw AVCDecoderConfigurationRecord.
     *
     * Important:
     * - This data is defined by the H.264 specification, not by MP4.
     * - Its internal structure is opaque at the MP4 container level.
     *
     * Framesmith does not parse, validate, or reinterpret this data.
     * It is treated as an atomic byte sequence and written verbatim.
     *
     * We create a copy so later changes to the input buffer cannot
     * alter the contents of the MP4 box after it is built.
     */
    const payload = new Uint8Array(avcC);

    return {
        /**
         * Box type: avcC
         *
         * This identifies the box as an AVC Decoder Configuration Box.
         * It is always a leaf box and always appears as a child of
         * an avc1 (H.264) sample entry inside stsd.
         */
        type: "avcC",

        body: [
            /**
             * Raw AVCDecoderConfigurationRecord bytes.
             *
             * The MP4 container does not interpret these bytes.
             * Decoders read them directly to configure the H.264
             * decoding pipeline before processing any frames.
             */
            {
                array: "byte",
                values: Array.from(payload)
            }
        ]
    };
}
