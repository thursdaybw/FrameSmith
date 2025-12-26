/**
 * btrt — Bitrate Box
 * ==================
 *
 * The btrt box provides *optional bitrate hints* for a codec sample entry.
 *
 * It is NOT a timing table.
 * It is NOT derived from samples.
 * It is NOT interpreted or enforced by the MP4 container.
 *
 * Instead, btrt is a *pure metadata passthrough* that conveys encoder-supplied
 * bitrate information to downstream tools.
 *
 * ---------------------------------------------------------------------------
 * What btrt contains
 * ---------------------------------------------------------------------------
 *
 * The btrt box contains exactly three unsigned 32-bit integers:
 *
 *   - bufferSizeDB
 *   - maxBitrate
 *   - avgBitrate
 *
 * These values are:
 *   - encoder hints
 *   - not validated by the container
 *   - not used by playback engines for timing or decoding
 *
 * The MP4 specification allows these values to be zero.
 * ffmpeg commonly emits zeroed btrt boxes.
 *
 * ---------------------------------------------------------------------------
 * Ownership of btrt semantics
 * ---------------------------------------------------------------------------
 *
 * Framesmith does NOT own the meaning of btrt values.
 *
 * They are owned by:
 *   - the encoder (ffmpeg, hardware encoder, WebCodecs)
 *   - or an upstream demuxer extracting existing metadata
 *
 * Framesmith must:
 *   - preserve these values exactly
 *   - serialize them correctly
 *   - never reinterpret or normalize them
 *
 * Framesmith must NOT:
 *   - infer bitrate
 *   - clamp values
 *   - derive values from samples
 *
 * ---------------------------------------------------------------------------
 * Why btrt tests are special
 * ---------------------------------------------------------------------------
 *
 * Like avcC, the btrt box is *semantically opaque* to the muxer.
 *
 * Correctness is defined by:
 *   - non-interference
 *   - exact byte preservation
 *
 * Therefore, btrt tests intentionally assert:
 *   - correct box sizing
 *   - correct header encoding
 *   - byte-for-byte equivalence with reference output
 *
 * They do NOT assert:
 *   - correctness of bitrate values
 *   - playback behavior
 *   - encoder decisions
 *
 * Those concerns are explicitly outside the muxer’s responsibility.
 *
 * ---------------------------------------------------------------------------
 * Relationship to Locked-Layout Equivalence
 * ---------------------------------------------------------------------------
 *
 * The btrt passthrough test is both:
 *
 *   - an opaque payload preservation test
 *   - a locked-layout equivalence test
 *
 * This is not a contradiction.
 *
 * Because Framesmith does not own the semantics of btrt,
 * byte-for-byte equivalence *is* the semantic guarantee.
 *
 * Any mutation, even if numerically “equivalent,” is a bug.
 */
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitBtrtBox } from "../box-emitters/stsdBox/btrtBox.js";
import { assertEqual } from "./assertions.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import {
    extractSampleEntryFromMp4
} from "./reference/BoxExtractor.js";

/**
 * btrt Structural (Granular) Test
 * -------------------------------
 *
 * Purpose
 * -------
 * This test verifies the *structural correctness* of the btrt box
 * produced by emitBtrtBox(), independent of any real MP4 file.
 *
 * It answers the question:
 *
 *   “Given explicit bitrate hint values, do we serialize a valid
 *    btrt box with correct sizing, layout, and field placement?”
 *
 * What this test asserts:
 * -----------------------
 * - The total box size is exactly 20 bytes
 * - The size field written into the box header is correct
 * - The FourCC type is exactly "btrt"
 * - Each bitrate field is written at the correct offset
 * - Zero values are preserved exactly
 *
 * What this test deliberately does NOT assert:
 * --------------------------------------------
 * - Any interpretation of bitrate semantics
 * - Encoder correctness
 * - Decoder behavior
 *
 * Why this test exists:
 * ---------------------
 * This test isolates btrt as a simple metadata record.
 *
 * Failures here indicate:
 *   - incorrect sizing
 *   - incorrect field ordering
 *   - incorrect serialization
 *
 * They do NOT indicate problems with encoding or playback.
 */
export async function testBtrt_Structure() {
    console.log("=== btrt Granular structural tests ===");

    const box = serializeBoxTree(
        emitBtrtBox({
            bufferSizeDB: 0,
            maxBitrate: 0,
            avgBitrate: 0
        })
    );

    const expectedSize = 20;
    const actualSize   = box.length;

    assertEqual("btrt.size", actualSize, expectedSize);

    const sizeField = readUint32(box, 0);
    assertEqual("btrt.sizeField", sizeField, expectedSize);

    const type = readFourCC(box, 4);
    assertEqual("btrt.type", type, "btrt");

    const bufferSizeDB = readUint32(box, 8);
    const maxBitrate   = readUint32(box, 12);
    const avgBitrate   = readUint32(box, 16);

    if (bufferSizeDB !== 0 || maxBitrate !== 0 || avgBitrate !== 0) {
        throw new Error("FAIL: btrt default values incorrect");
    }

    console.log("PASS: btrt granular structural tests");
}

/**
 * testBtrt_OpaquePayload_LockedLayoutEquivalence_ffmpeg
 * ----------------------------------------------------
 *
 * Purpose
 * -------
 * This test proves that Framesmith preserves btrt metadata
 * exactly as emitted by a real-world encoder (ffmpeg).
 *
 * It answers the question:
 *
 *   “Given a btrt box from a real MP4 file,
 *    do we re-emit it without modification?”
 *
 * Test Characteristics
 * --------------------
 * - The btrt payload is treated as opaque metadata
 * - No fields are interpreted or normalized
 * - No policy decisions are applied
 *
 * This test asserts:
 * ------------------
 * - exact byte-for-byte preservation
 * - correct box sizing
 * - correct placement inside the sample entry
 *
 * This test does NOT assert:
 * --------------------------
 * - correctness of bitrate values
 * - decoder behavior
 * - encoder intent
 *
 * Architectural Note
 * ------------------
 * Like avcC, btrt correctness is defined by *non-interference*.
 *
 * Framesmith does not own the meaning of bitrate hints.
 * Its responsibility is limited to preserving them exactly.
 *
 * Any byte difference indicates a muxer bug.
 */
export async function  testBtrt_OpaquePayload_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testBtrt_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const avc1Box = extractSampleEntryFromMp4(
        buf,
        "moov/trak/mdia/minf/stbl/stsd",
        "avc1"
    );

    // Local structural scan for btrt
    let offset = 8 + 78; // VisualSampleEntry header
    let refBtrt = null;

    while (offset + 8 <= avc1Box.length) {
        const size = readUint32(avc1Box, offset);
        const type = readFourCC(avc1Box, offset + 4);

        if (type === "btrt") {
            refBtrt = avc1Box.slice(offset, offset + size);
            break;
        }

        if (size < 8) break;
        offset += size;
    }

    if (!refBtrt) {
        throw new Error("FAIL: btrt box not found in avc1 sample entry");
    }

    const ref = {
        bufferSizeDB: readUint32(refBtrt, 8),
        maxBitrate:   readUint32(refBtrt, 12),
        avgBitrate:   readUint32(refBtrt, 16),
        raw:          refBtrt
    };

    const outRaw = serializeBoxTree(
        emitBtrtBox({
            bufferSizeDB: ref.bufferSizeDB,
            maxBitrate:   ref.maxBitrate,
            avgBitrate:   ref.avgBitrate
        })
    );

    assertEqual("btrt.length", ref.raw.length, outRaw.length);

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `btrt.byte[${i}]`,
            outRaw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: btrt matches golden MP4");
}
