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
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    SampleEntryReader,
    getSampleEntryHeaderSize
} from "../reference/SampleEntryReader.js";


/**
 * NOTE
 * ----
 * The btrt box is valid for both video (avc1) and audio (mp4a) SampleEntries.
 *
 * These tests assert the btrt box via the avc1 path only because the
 * reference oracle files used here contain btrt metadata on the video
 * track, but not on the audio track.
 *
 * This is a limitation of the oracle data, not of the btrt schema,
 * emitter, or registry wiring.
 *
 * Structural correctness of btrt under mp4a is guaranteed by reuse of
 * the same emitter and schema, and does not require a duplicate test
 * in the absence of an oracle that includes mp4a/btrt.
 */

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

    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|avc1/btrt",
        {
            bufferSizeDB: 0,
            maxBitrate: 0,
            avgBitrate: 0
        }
    );

    // --------------------------------------------------
    // Box identity
    // --------------------------------------------------

    assertEqual("btrt.type", node.type, "btrt");

    // --------------------------------------------------
    // Body structure
    // --------------------------------------------------

    if (!Array.isArray(node.body)) {
        throw new Error("FAIL: btrt.body must be an array");
    }

    assertEqual("btrt.body.length", node.body.length, 3);

    // --------------------------------------------------
    // Field values (structural)
    // --------------------------------------------------

    assertEqual(
        "btrt.bufferSizeDB",
        node.body[0].int,
        0
    );

    assertEqual(
        "btrt.maxBitrate",
        node.body[1].int,
        0
    );

    assertEqual(
        "btrt.avgBitrate",
        node.body[2].int,
        0
    );
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

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const avc1 = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        buf,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    );

    const sampleEntryRaw = avc1.readBoxReport().raw;

    const headerSize =
        getSampleEntryHeaderSize("avc1");

    const reader =
        new SampleEntryReader(
            sampleEntryRaw,
            headerSize
        );

    const refBtrt = reader.getChild("btrt");

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
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|avc1/btrt",
            {
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

}
