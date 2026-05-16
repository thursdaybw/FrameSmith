/*
 *
 * avc1 — H.264 Video Sample Entry
 * -------------------------------
 * The `avc1` box describes *how each video sample (frame) in this track
 * should be interpreted*. It does not contain video frames itself. It wraps:
 *
 *   1. A VisualSampleEntry header (common to all video codecs in MP4)
 *   2. A required avcC (AVCDecoderConfigurationRecord) child box
 *
 * Why the term “Sample Entry” exists:
 * -----------------------------------
 * In MP4 terminology, a "sample" means "a unit of media in a track" — for
 * video, this is typically a frame. A *sample entry* is the metadata record
 * describing how those samples are encoded: width, height, resolution, and
 * codec configuration. It is not a “sample” of anything; it is a descriptor.
 *
 * VisualSampleEntry (explained plainly):
 * --------------------------------------
 * ISO defines a shared structure inherited by all video codecs (H.264, H.265,
 * AV1, VP9, etc). Fields include:
 *
 *   • 6 reserved bytes (always 0)
 *   • data_reference_index (usually 1)
 *   • pre_defined + reserved region (16 bytes)
 *   • width and height
 *   • horizresolution, vertresolution (typically 72dpi → 0x00480000)
 *   • reserved (4 bytes)
 *   • frame_count (usually 1)
 *   • compressorname (length byte + 31 padded ASCII bytes)
 *   • depth (0x0018)
 *   • pre_defined sentinel (-1)
 *
 * Framesmith does not implement VisualSampleEntry as a class. Instead, this
 * builder returns JSON describing that structure, which the serializer converts
 * into bytes. This keeps the architecture declarative, testable, and modular.
 *
 * Required child box: avcC
 * ------------------------
 * Every H.264 sample entry must contain an AVCDecoderConfigurationRecord
 * (the `avcC` box):
 *
 *   • It stores Sequence Parameter Set (SPS)/Picture Parameter Sets (PPS)
 *   • It configures the decoder
 *   • It must appear immediately inside the avc1 box
 *
 * Responsibilities of this builder:
 * ---------------------------------
 * - Construct a complete VisualSampleEntry header
 * - Embed the provided avcC JSON node as a child
 * - Express all structure declaratively in JSON
 * - Leave byte encoding to the serializer
 *
 * Non-responsibilities:
 * ---------------------
 * - Do not interpret the H.264 bitstream
 * - Do not validate Sequence Parameter Set (SPS)/Picture Parameter Sets (PPS)
 * - Do not guess codec profile/level
 *
 * External References:
 * --------------------
 * ISO/IEC 14496-12 — 12.1.3.2 VisualSampleEntry  
 * ISO/IEC 14496-15 — AVC File Format Binding  
 * MP4 registry: https://mp4ra.org/registered-types/boxes
 *
 * Summary:
 * --------
 * The avc1 box is the structural “container” describing H.264 samples.
 * It provides dimensions, layout metadata, and wraps the avcC configuration
 * needed for decoding. In Framesmith, it is expressed as a clean JSON node
 * that the serializer converts into a fully compliant MP4 structure.
 */

function emitAvc1SampleEntryBox({
    width,
    height,
    avcCNode,
    compressorNameFields,
    paspNode,
    btrtNode
}) {
    // ---------------------------------------------------------
    // Required scalar fields
    // ---------------------------------------------------------
    if (!Number.isInteger(width) || width <= 0) {
        throw new Error("emitAvc1SampleEntryBox: width must be a positive integer");
    }

    if (!Number.isInteger(height) || height <= 0) {
        throw new Error("emitAvc1SampleEntryBox: height must be a positive integer");
    }

    // ---------------------------------------------------------
    // Required child: avcCNode (structural, non-negotiable)
    // ---------------------------------------------------------

    if (avcCNode === undefined || avcCNode === null) {
        throw new Error(
            "emitAvc1SampleEntryBox: missing required child 'avcCNode'"
        );
    }

    if (typeof avcCNode !== "object") {
        throw new Error(
            "emitAvc1SampleEntryBox: avcCNode must be an object"
        );
    }

    if (avcCNode.type !== "avcC") {
        throw new Error(
            `emitAvc1SampleEntryBox: avcCNode.type must be 'avcC', ` +
            `got '${avcCNode.type}'`
        );
    }

    if (!Array.isArray(compressorNameFields)) {
        throw new Error(
            "emitAvc1SampleEntryBox: compressorNameFields must be an array"
        );
    }

    // ---------------------------------------------------------
    // Emit avc1 SampleEntry
    // ---------------------------------------------------------
    return {
        type: "avc1",

        body: [
            // reserved (6)
            { byte: 0 }, { byte: 0 }, { byte: 0 },
            { byte: 0 }, { byte: 0 }, { byte: 0 },

            // data_reference_index
            { short: 1 },

            // pre_defined + reserved
            { short: 0 },
            { short: 0 },

            // pre_defined[3]
            { int: 0 },
            { int: 0 },
            { int: 0 },

            // width / height
            { short: width },
            { short: height },

            // horizresolution / vertresolution (72 DPI, 16.16 fixed)
            { int: 0x00480000 },
            { int: 0x00480000 },

            // reserved
            { int: 0 },

            // frame_count
            { short: 1 },

            // compressorname (explicit fields)
            ...compressorNameFields,

            // depth
            { short: 0x0018 },

            // pre_defined sentinel
            { short: 0xffff }
        ],

        children: [
            avcCNode,
            ...(paspNode ? [paspNode] : []),
            ...(btrtNode ? [btrtNode] : [])
        ]
    };
}

export function registerAvc1SampleEntryEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsd|avc1",
        emitAvc1SampleEntryBox
    );
}
