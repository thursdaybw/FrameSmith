/**
 * pasp — Pixel Aspect Ratio Box
 * =============================
 *
 * The pasp box declares the pixel aspect ratio of a video track.
 *
 * Unlike codec configuration (avcC), pasp does not contain opaque data.
 * Its fields are simple, declarative values understood by the container
 * and players.
 *
 * However, NativeMuxer does NOT infer or compute pixel aspect ratios.
 * It treats pasp as declared metadata supplied by an upstream authority,
 * such as:
 *
 *   - an encoder
 *   - a demuxer
 *   - authoring metadata
 *
 * ---------------------------------------------------------------------------
 * NativeMuxer’s responsibility
 * ---------------------------------------------------------------------------
 *
 * NativeMuxer:
 * - does NOT guess aspect ratios
 * - does NOT derive them from frame dimensions
 * - does NOT normalize or rewrite values
 *
 * Its responsibility is limited to:
 *
 *   - serializing a pasp box correctly
 *   - preserving declared values exactly
 *   - emitting a layout identical to real-world encoders
 *
 * ---------------------------------------------------------------------------
 * Why pasp tests are structured this way
 * ---------------------------------------------------------------------------
 *
 * pasp correctness is defined by:
 *
 *   - correct box structure
 *   - correct field placement
 *   - byte-for-byte equivalence with ffmpeg output
 *
 * Because the values are declarative and fixed-width,
 * semantic correctness and layout correctness coincide.
 *
 * If any byte differs, the muxer is incorrect.
 */

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitPaspBox } from "../box-emitters/stsdBox/paspBox.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testPasp_Structure() {
    console.log("=== pasp Granular structural tests ===");

    const box = serializeBoxTree(emitPaspBox());

    assertEqual("pasp.size", box.length, 16);
    assertEqual(
        "pasp.size field",
        readUint32(box, 0),
        16
    );

    assertEqual(
        "pasp.type",
        readFourCC(box, 4),
        "pasp"
    );

    assertEqual(
        "pasp.hSpacing",
        readUint32(box, 8),
        1
    );

    assertEqual(
        "pasp.vSpacing",
        readUint32(box, 12),
        1
    );

    console.log("PASS: pasp granular structural tests");
}

/**
 * testPasp_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg
 * --------------------------------------------------------
 *
 * Purpose
 * -------
 * This test verifies that NativeMuxer preserves pixel aspect ratio
 * metadata exactly as emitted by ffmpeg.
 *
 * It answers the question:
 *
 *   “Given a pasp declaration from a real MP4,
 *    do we re-emit it without modification?”
 *
 * Test Characteristics
 * --------------------
 * - No inference
 * - No normalization
 * - No policy decisions
 *
 * This test asserts:
 * - correct box sizing
 * - correct field placement
 * - byte-for-byte equivalence with ffmpeg output
 *
 * Any difference indicates an error in serialization or layout.
 */
export async function testPasp_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testPasp_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract pasp via golden truth registry (single authority)
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        buf,
        "moov/trak/mdia/minf/stbl/stsd",
        { sampleEntry: "avc1", child: "pasp" }
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Re-emit pasp strictly from declared metadata
    // ---------------------------------------------------------
    const outRaw = serializeBoxTree(
        emitPaspBox(params)
    );

    // ---------------------------------------------------------
    // 4. Fine-grained byte-for-byte assertions FIRST
    // ---------------------------------------------------------

    // DEBUG: compare size fields explicitly
    console.log(
        "REF pasp size field:",
        (refFields.raw[0] << 24) |
        (refFields.raw[1] << 16) |
        (refFields.raw[2] << 8)  |
        refFields.raw[3]
    );

    console.log(
        "OUT pasp size field:",
        (outRaw[0] << 24) |
        (outRaw[1] << 16) |
        (outRaw[2] << 8)  |
        outRaw[3]
    );
    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `pasp.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

    // ---------------------------------------------------------
    // 5. Derived size assertion LAST
    // ---------------------------------------------------------
    assertEqual(
        "pasp.size",
        outRaw.length,
        refFields.raw.length
    );

    console.log("PASS: pasp matches golden MP4");
}
