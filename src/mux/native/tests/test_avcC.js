import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitAvcCBox } from "../box-emitters/stsdBox/avcCBox.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * avcC — AVC Decoder Configuration Box
 * ===================================
 *
 * The avcC box is fundamentally different from most other MP4 boxes.
 *
 * It is NOT a table.
 * It is NOT derived from samples.
 * It is NOT interpreted by the muxer.
 *
 * Instead, avcC is a *pure payload container* for an
 * AVCDecoderConfigurationRecord, as defined by:
 *
 *   ISO/IEC 14496-15 (AVC file format)
 *
 * ---------------------------------------------------------------------------
 * What avcC contains
 * ---------------------------------------------------------------------------
 *
 * The avcC box contains codec configuration data required by decoders
 * to interpret H.264/AVC samples:
 *
 *   - SPS (Sequence Parameter Sets)
 *   - PPS (Picture Parameter Sets)
 *   - profile/level indicators
 *   - NAL unit length size
 *
 * This data is *opaque* to the MP4 container.
 * The container does not understand or validate its contents.
 *
 * ---------------------------------------------------------------------------
 * Where avcC data comes from
 * ---------------------------------------------------------------------------
 *
 * The avcC payload is produced by an upstream system, such as:
 *
 *   - WebCodecs (VideoEncoderConfig.description)
 *   - ffmpeg / x264 / hardware encoders
 *   - a demuxer extracting codec configuration from an existing MP4
 *
 * The muxer does NOT derive this data from samples.
 * The muxer does NOT parse or inspect SPS/PPS contents.
 *
 * The muxer’s responsibility is limited to:
 *
 *   - preserving the payload byte-for-byte
 *   - placing it correctly inside the MP4 structure
 *
 * ---------------------------------------------------------------------------
 * Why avcC tests are special
 * ---------------------------------------------------------------------------
 *
 * Because avcC is an opaque payload:
 *
 *   - structural correctness means correct box sizing and copying
 *   - semantic correctness means *non-interference*
 *
 * Therefore, avcC tests intentionally assert:
 *
 *   - exact byte preservation
 *   - correct box header encoding
 *   - absence of mutation
 *
 * They do NOT assert:
 *
 *   - codec validity
 *   - SPS/PPS semantics
 *   - decoder compatibility
 *
 * Those concerns belong to encoders and decoders, not the muxer.
 *
 * ---------------------------------------------------------------------------
 * Relationship to Locked-Layout Equivalence
 * ---------------------------------------------------------------------------
 *
 * The avcC conformance test is both:
 *
 *   - an opaque payload preservation test
 *   - a locked-layout equivalence test
 *
 * This is not a contradiction.
 *
 * Because the payload is opaque and supplied externally, byte-for-byte
 * equivalence *is* the semantic guarantee.
 *
 * If any byte differs, the muxer is incorrect.
 */



/**
 * avcC Structural (Granular) Test
 * --------------------------------
 *
 * Purpose:
 * --------
 * This test verifies the *structural correctness* of the avcC box
 * produced by emitAvcCBox(), independent of any real MP4 file.
 *
 * It answers the question:
 *
 *   "Given a valid AVCDecoderConfigurationRecord payload, do we
 *    serialize an avcC box correctly, byte-for-byte, without
 *    interpreting or mutating the payload?"
 *
 * What this test asserts:
 * -----------------------
 * - The total box size is correct (size field + payload length)
 * - The size field written into the box header is correct
 * - The FourCC type is exactly "avcC"
 * - The payload bytes are copied verbatim and in order
 * - The input buffer is not mutated
 *
 * What this test deliberately does NOT assert:
 * --------------------------------------------
 * - It does not validate the semantic correctness of the payload
 * - It does not parse or understand SPS/PPS contents
 * - It does not depend on ffmpeg, MP4 files, or container structure
 *
 * Why this test exists:
 * ---------------------
 * This test isolates the avcC box as a pure data container.
 * Failures here indicate mistakes in serialization logic,
 * sizing, copying, or mutation — not MP4 structure or codec layout.
 *
 * When this test fails, the error message should point directly
 * to the broken assumption or field.
 */
export async function testAvcC_Structure() {
    console.log("=== AvcC Granular tests ===");

    const avcCInput = Uint8Array.from([
        1, 100, 0, 31,
        0xFF, 0xE1,
        0x00, 0x10,
        9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,
        1,
        0x00, 0x04,
        7,7,7,7
    ]);

    const node = emitAvcCBox({ avcC: avcCInput });
    const box  = serializeBoxTree(node);

    const expectedSize = 8 + avcCInput.length;

    assertEqual(
        "avcC.size",
        box.length,
        expectedSize
    );

    assertEqual(
        "avcC.size_field",
        readUint32(box, 0),
        box.length
    );

    assertEqual(
        "avcC.type",
        readFourCC(box, 4),
        "avcC"
    );

    for (let i = 0; i < avcCInput.length; i++) {
        assertEqual(
            `avcC.payload[${i}]`,
            box[8 + i],
            avcCInput[i]
        );
    }

    // Defensive immutability check
    assertEqual(
        "avcC.input_not_mutated",
        avcCInput[0],
        1
    );

    console.log("PASS: avcC granular tests");
}

/**
 * testAvcC_OpaquePayload_LockedLayoutEquivalence_ffmpeg
 * --------------------------------------
 *
 * Purpose
 * -------
 * This test proves that Framesmith preserves AVC codec configuration
 * data exactly as emitted by a real-world encoder (ffmpeg).
 *
 * It answers the question:
 *
 *   “Given an avcC payload from a real MP4,
 *    do we re-emit it without modification?”
 *
 * Test Characteristics
 * --------------------
 * - The avcC payload is treated as opaque bytes
 * - No fields are parsed or interpreted
 * - No normalization or rewriting is allowed
 *
 * This test asserts:
 * - exact payload preservation
 * - correct box sizing
 * - byte-for-byte equivalence with ffmpeg output
 *
 * This test does NOT assert:
 * - correctness of SPS/PPS contents
 * - decoder compatibility
 * - encoder behavior
 *
 * Architectural Note
 * ------------------
 * avcC is the only MP4 box in the movie hierarchy whose
 * correctness is defined entirely by *non-interference*.
 *
 * If this test fails, it indicates a violation of the muxer’s
 * most basic contract: do not change what you do not own.
 */
export async function testAvcC_OpaquePayload_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testAvcC_OpaquePayload_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Read golden truth avcC
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        { sampleEntry: "avc1" }
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Emit avcC exclusively from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitAvcCBox(params)
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence (payload first)
    // ---------------------------------------------------------

    // Payload bytes (most specific signal)
    for (let i = 0; i < params.avcC.length; i++) {
        assertEqual(
            `avcC.payload[${i}]`,
            out[8 + i],
            params.avcC[i]
        );
    }

    // Size check (derived, summary signal)
    const expectedSize = 8 + params.avcC.length;

    assertEqual(
        "avcC.size",
        out.length,
        expectedSize
    );

    console.log("PASS: avcC matches golden MP4");
}

