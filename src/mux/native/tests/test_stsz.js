import { buildStszBox } from "../boxes/stszBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

/**
 * testStsz_VariableEncoding_Structure
 * --------
 * Granular structural tests for the Sample Size Box (stsz).
 *
 * This test validates:
 * - FullBox header correctness (version, flags)
 * - Variable-size encoding (sample_size = 0)
 * - Accurate sample_count
 * - Exact per-sample entry encoding
 * - Big-endian integer layout
 * - Total box size calculation
 * - Input immutability
 *
 * NOTE:
 * Framesmith intentionally emits variable-size stsz encoding
 * to guarantee correctness for real-world video streams.
 * Constant-size optimization is deliberately omitted.
 */
export async function testStsz_Structure() {
    console.log("=== testStsz (granular structure) ===");

    // ------------------------------------------------------------
    // TEST 1: Empty sample list
    // ------------------------------------------------------------
    let input = [];
    let node  = buildStszBox(input);
    let stsz  = serializeBoxTree(node);

    // Box header
    assertEqual(
        "stsz.size (empty)",
        readUint32FromMp4BoxBytes(stsz, 0),
        20
    );

    assertEqual(
        "stsz.type",
        readBoxTypeFromMp4BoxBytes(stsz, 4),
        "stsz"
    );

    // FullBox header
    const version1 = stsz[8];
    const flags1 =
        (stsz[9] << 16) |
        (stsz[10] << 8) |
        stsz[11];

    assertEqual("stsz.version", version1, 0);
    assertEqual("stsz.flags", flags1, 0);

    // Payload
    assertEqual(
        "stsz.sample_size (empty)",
        readUint32FromMp4BoxBytes(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (empty)",
        readUint32FromMp4BoxBytes(stsz, 16),
        0
    );

    assertEqual(
        "stsz.length (empty)",
        stsz.length,
        20
    );

    // ------------------------------------------------------------
    // TEST 2: Single sample
    // ------------------------------------------------------------
    input = [100];
    node  = buildStszBox(input);
    stsz  = serializeBoxTree(node);

    const expectedSize2 = 20 + 4;

    assertEqual(
        "stsz.size (single)",
        readUint32FromMp4BoxBytes(stsz, 0),
        expectedSize2
    );

    assertEqual(
        "stsz.sample_size (single)",
        readUint32FromMp4BoxBytes(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (single)",
        readUint32FromMp4BoxBytes(stsz, 16),
        1
    );

    assertEqual(
        "stsz.entry[0]",
        readUint32FromMp4BoxBytes(stsz, 20),
        100
    );

    assertEqual(
        "stsz.length (single)",
        stsz.length,
        expectedSize2
    );

    // ------------------------------------------------------------
    // TEST 3: Multiple samples
    // ------------------------------------------------------------
    const sizes = [5, 10, 15];
    node = buildStszBox(sizes);
    stsz = serializeBoxTree(node);

    const expectedSize3 = 20 + (4 * sizes.length);

    assertEqual(
        "stsz.size (multiple)",
        readUint32FromMp4BoxBytes(stsz, 0),
        expectedSize3
    );

    assertEqual(
        "stsz.sample_size (multiple)",
        readUint32FromMp4BoxBytes(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (multiple)",
        readUint32FromMp4BoxBytes(stsz, 16),
        sizes.length
    );

    for (let i = 0; i < sizes.length; i++) {
        assertEqual(
            `stsz.entry[${i}]`,
            readUint32FromMp4BoxBytes(stsz, 20 + (i * 4)),
            sizes[i]
        );
    }

    assertEqual(
        "stsz.length (multiple)",
        stsz.length,
        expectedSize3
    );

    // ------------------------------------------------------------
    // TEST 4: Input immutability
    // ------------------------------------------------------------
    const mutable = [3, 4, 5];
    node = buildStszBox(mutable);
    stsz = serializeBoxTree(node);

    mutable[0] = 999;

    assertEqual(
        "stsz.immutability",
        readUint32FromMp4BoxBytes(stsz, 20),
        3
    );

    // ------------------------------------------------------------
    // TEST 5: Big-endian correctness
    // ------------------------------------------------------------
    node = buildStszBox([256]);
    stsz = serializeBoxTree(node);

    assertEqual(
        "stsz.big_endian_encoding",
        readUint32FromMp4BoxBytes(stsz, 20),
        256
    );

    console.log("PASS: stsz granular structure is correct");
}

export async function testStsz_Conformance() {
    console.log("=== testStsz_Conformance (Phase C: byte-for-byte) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4 produced by ffmpeg
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Extract real stsz box from the MP4
    // -------------------------------------------------------------
    const refStsz = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsz"]
    );

    // -------------------------------------------------------------
    // 3. Parse sample sizes from the real stsz box
    // -------------------------------------------------------------
    const sampleSize  = readUint32FromMp4BoxBytes(refStsz, 12);
    const sampleCount = readUint32FromMp4BoxBytes(refStsz, 16);

    assertEqual(
        "stsz.sample_size",
        sampleSize,
        0,
        "Golden MP4 must use variable-size stsz (sample_size == 0)"
    );

    const realSampleSizes = [];
    let offset = 20;

    for (let i = 0; i < sampleCount; i++) {
        realSampleSizes.push(readUint32FromMp4BoxBytes(refStsz, offset));
        offset += 4;
    }

    // -------------------------------------------------------------
    // 4. Rebuild stsz using Framesmith builder + serializer
    // -------------------------------------------------------------
    const node    = buildStszBox(realSampleSizes);
    const outStsz = serializeBoxTree(node);

    // -------------------------------------------------------------
    // 5. Byte-for-byte comparison
    // -------------------------------------------------------------
    assertEqual(
        "stsz.size",
        outStsz.length,
        refStsz.length
    );

    for (let i = 0; i < refStsz.length; i++) {
        assertEqual(
            `stsz.byte[${i}]`,
            outStsz[i],
            refStsz[i]
        );
    }

    console.log("PASS: stsz matches golden MP4 byte-for-byte");
}
