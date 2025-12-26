import { emitStszBox } from "../box-emitters/stszBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

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
    let node  = emitStszBox({ sizes: input });
    let stsz  = serializeBoxTree(node);

    // Box header
    assertEqual(
        "stsz.size (empty)",
        readUint32(stsz, 0),
        20
    );

    assertEqual(
        "stsz.type",
        readFourCC(stsz, 4),
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
        readUint32(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (empty)",
        readUint32(stsz, 16),
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
    node  = emitStszBox({ sizes: input });
    stsz  = serializeBoxTree(node);

    const expectedSize2 = 20 + 4;

    assertEqual(
        "stsz.size (single)",
        readUint32(stsz, 0),
        expectedSize2
    );

    assertEqual(
        "stsz.sample_size (single)",
        readUint32(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (single)",
        readUint32(stsz, 16),
        1
    );

    assertEqual(
        "stsz.entry[0]",
        readUint32(stsz, 20),
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
    node = emitStszBox({ sizes: sizes})
    stsz = serializeBoxTree(node);

    const expectedSize3 = 20 + (4 * sizes.length);

    assertEqual(
        "stsz.size (multiple)",
        readUint32(stsz, 0),
        expectedSize3
    );

    assertEqual(
        "stsz.sample_size (multiple)",
        readUint32(stsz, 12),
        0
    );

    assertEqual(
        "stsz.sample_count (multiple)",
        readUint32(stsz, 16),
        sizes.length
    );

    for (let i = 0; i < sizes.length; i++) {
        assertEqual(
            `stsz.entry[${i}]`,
            readUint32(stsz, 20 + (i * 4)),
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
    node = emitStszBox({ sizes: mutable });
    stsz = serializeBoxTree(node);

    mutable[0] = 999;

    assertEqual(
        "stsz.immutability",
        readUint32(stsz, 20),
        3
    );

    // ------------------------------------------------------------
    // TEST 5: Big-endian correctness
    // ------------------------------------------------------------
    node = emitStszBox({ sizes: [256] });
    stsz = serializeBoxTree(node);

    assertEqual(
        "stsz.big_endian_encoding",
        readUint32(stsz, 20),
        256
    );

    console.log("PASS: stsz granular structure is correct");
}


export async function testStsz_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== testStsz_LockedLayoutEquivalence_ffmpeg (golden MP4) ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference STSZ via registry
    // ---------------------------------------------------------
    const refParsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    const refFields = refParsed.readFields();
    const params    = refParsed.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild STSZ from semantic params
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitStszBox(params)
    );

    // ---------------------------------------------------------
    // 4. Field-level structural assertions
    // ---------------------------------------------------------

    // Box header
    assertEqual(
        "stsz.type",
        readFourCC(outBytes, 4),
        "stsz"
    );

    // FullBox header
    assertEqual(
        "stsz.version",
        outBytes[8],
        0
    );

    const flags =
        (outBytes[9] << 16) |
        (outBytes[10] << 8) |
        outBytes[11];

    assertEqual(
        "stsz.flags",
        flags,
        0
    );

    // sample_size (Framesmith invariant)
    assertEqual(
        "stsz.sample_size",
        readUint32(outBytes, 12),
        0
    );

    // sample_count
    assertEqual(
        "stsz.sample_count",
        readUint32(outBytes, 16),
        refFields.sampleCount
    );

    // per-sample sizes
    let offset = 20;

    for (let i = 0; i < refFields.sampleCount; i++) {
        assertEqual(
            `stsz.sample_size[${i}]`,
            readUint32(outBytes, offset),
            refFields.sizes[i]
        );
        offset += 4;
    }

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    assertEqual(
        "stsz.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqual(
            `stsz.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: stsz matches golden MP4 byte-for-byte"
    );
}


