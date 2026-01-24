import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
/**
 * testStsz_VariableEncoding_Structure
 * --------
 * Granular structural tests for the Sample Size Box (stsz).
 *
 * This test validates:
 * - FullBox header correctness (version, flags)
 * - Variable-size encoding (sample_size = 0)
 * - Accurate sampleCount
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
export function testStsz_Structure() {

    // ------------------------------------------------------------
    // TEST 1: Empty sample list
    // ------------------------------------------------------------
    const emptyNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            { sizes: [] }
        );

    assertEqual("stsz.type", emptyNode.type, "stsz");
    assertEqual("stsz.version", emptyNode.version, 0);
    assertEqual("stsz.flags", emptyNode.flags, 0);

    assertEqual("stsz.body.length (empty)", emptyNode.body.length, 3);

    assertEqual("stsz.sampleSize (empty)",  emptyNode.body[0].int, 0);
    assertEqual("stsz.sampleCount (empty)", emptyNode.body[1].int, 0);

    assertEqual(
        "stsz.sizes.values (empty)",
        emptyNode.body[2].values.length,
        0
    );

    // ------------------------------------------------------------
    // TEST 2: Single sample
    // ------------------------------------------------------------
    const singleNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            { sizes: [100] }
        );

    assertEqual("stsz.body.length (single)", singleNode.body.length, 3);
    assertEqual("stsz.sampleSize (single)",  singleNode.body[0].int, 0);
    assertEqual("stsz.sampleCount (single)", singleNode.body[1].int, 1);

    assertEqual(
        "stsz.entry[0] (single)",
        singleNode.body[2].values[0],
        100
    );

    // ------------------------------------------------------------
    // TEST 3: Multiple samples
    // ------------------------------------------------------------
    const sizes = [5, 10, 15];

    const multiNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            { sizes }
        );

    assertEqual("stsz.sampleCount (multiple)", multiNode.body[1].int, 3);

    for (let i = 0; i < sizes.length; i++) {
        assertEqual(
            `stsz.entry[${i}]`,
            multiNode.body[2].values[i],
            sizes[i]
        );
    }

    // ------------------------------------------------------------
    // TEST 4: Input immutability
    // ------------------------------------------------------------
    const mutable = [3, 4, 5];

    const immutabilityNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            { sizes: mutable }
        );

    mutable[0] = 999;

    assertEqual(
        "stsz.immutability",
        immutabilityNode.body[2].values[0],
        3
    );

    // ------------------------------------------------------------
    // TEST 5: Integer integrity
    // ------------------------------------------------------------
    const bigNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            { sizes: [256] }
        );

    assertEqual(
        "stsz.integer_integrity",
        bigNode.body[2].values[0],
        256
    );
}

export async function testStsz_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth directly (authoritative)
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsz"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const refRaw = refReport.raw;

    // ---------------------------------------------------------
    // 3. Rebuild STSZ from semantic params
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            params
        )
    );

    // ---------------------------------------------------------
    // 4. Field-level structural assertions
    // ---------------------------------------------------------

    // Box type
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

    // sampleCount
    assertEqual(
        "stsz.sampleCount",
        readUint32(outBytes, 16),
        refReport.box.fields.sampleCount
    );

    // per-sample sizes
    let offset = 20;

    const sizes = refReport.box.fields.sizes;

    for (let i = 0; i < sizes.length; i++) {
        assertEqual(
            `stsz.sample_size[${i}]`,
            readUint32(outBytes, offset),
            sizes[i]
        );
        offset += 4;
    }

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stsz.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `stsz.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}


