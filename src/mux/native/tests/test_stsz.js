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

    const emptyNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|variable", { sampleSize: 0, sampleCount: 0, sizes: [] });

    assertEqual("stsz.type", emptyNode.type, "stsz");
    assertEqual("stsz.version", emptyNode.version, 0);
    assertEqual("stsz.flags", emptyNode.flags, 0);

    assertEqual("stsz.body.length (empty)", emptyNode.body.length, 3);

    assertEqual("stsz.sampleSize (empty)",  emptyNode.body[0].int, 0);
    assertEqual("stsz.sampleCount (empty)", emptyNode.body[1].int, 0);

    assertEqual( "stsz.sizes.values (empty)", emptyNode.body[2].values.length, 0);

    // ------------------------------------------------------------
    // TEST 2: Single sample
    // ------------------------------------------------------------

    const singleNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|variable", { sampleSize: 0, sampleCount: 1, sizes: [100] });

    assertEqual("stsz.body.length (single)", singleNode.body.length, 3);
    assertEqual("stsz.sampleSize (single)",  singleNode.body[0].int, 0);
    assertEqual("stsz.sampleCount (single)", singleNode.body[1].int, 1);

    assertEqual( "stsz.entry[0] (single)", singleNode.body[2].values[0], 100);

    // ------------------------------------------------------------
    // TEST 3: Multiple samples
    // ------------------------------------------------------------

    const sizes = [5, 10, 15];

    const multiNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|variable", { sampleSize: 0, sampleCount: sizes.length, sizes });

    assertEqual("stsz.sampleCount (multiple)", multiNode.body[1].int, 3);

    for (let i = 0; i < sizes.length; i++) {
        assertEqual( `stsz.entry[${i}]`, multiNode.body[2].values[i], sizes[i]);
    }

    // ------------------------------------------------------------
    // TEST 4: Input immutability
    // ------------------------------------------------------------

    const mutable = [3, 4, 5];

    const immutabilityNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|variable", { sampleSize: 0, sampleCount: mutable.length, sizes: mutable });

    mutable[0] = 999;

    assertEqual( "stsz.immutability", immutabilityNode.body[2].values[0], 3);

    // ------------------------------------------------------------
    // TEST 5: Integer integrity
    // ------------------------------------------------------------

    const bigNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|variable", { sampleSize: 0, sampleCount: 1, sizes: [256] });

    assertEqual( "stsz.integer_integrity", bigNode.body[2].values[0], 256);
}

export function testStsz_Structure_Fixed() {

    // ------------------------------------------------------------
    // TEST 1: Zero samples (fixed form)
    // ------------------------------------------------------------

    const emptyNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|fixed", { sampleSize: 240, sampleCount: 0 });

    assertEqual("stsz.type", emptyNode.type, "stsz");
    assertEqual("stsz.version", emptyNode.version, 0);
    assertEqual("stsz.flags", emptyNode.flags, 0);

    assertEqual("stsz.body.length (empty)", emptyNode.body.length, 2);

    assertEqual("stsz.sampleSize (empty)",  emptyNode.body[0].int, 240);
    assertEqual("stsz.sampleCount (empty)", emptyNode.body[1].int, 0);

    // ------------------------------------------------------------
    // TEST 2: Single sample (fixed form)
    // ------------------------------------------------------------

    const singleNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|fixed", { sampleSize: 240, sampleCount: 1 });

    assertEqual("stsz.body.length (single)", singleNode.body.length, 2);
    assertEqual("stsz.sampleSize (single)",  singleNode.body[0].int, 240);
    assertEqual("stsz.sampleCount (single)", singleNode.body[1].int, 1);

    // ------------------------------------------------------------
    // TEST 3: Multiple samples (fixed form)
    // ------------------------------------------------------------

    const multiNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|fixed", { sampleSize: 240, sampleCount: 3 });

    assertEqual("stsz.sampleSize (multiple)",  multiNode.body[0].int, 240);
    assertEqual("stsz.sampleCount (multiple)", multiNode.body[1].int, 3);

    // ------------------------------------------------------------
    // TEST 4: Integer integrity (fixed form)
    // ------------------------------------------------------------

    const bigNode = EmitterRegistry.emit( "moov/trak/mdia/minf/stbl/stsz|fixed", { sampleSize: 1024, sampleCount: 2 });

    assertEqual("stsz.sampleSize (integer_integrity)", bigNode.body[0].int, 1024);
    assertEqual("stsz.sampleCount (integer_integrity)", bigNode.body[1].int, 2);
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
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[0]/mdia/minf/stbl/stsz");

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const refRaw = refReport.raw;

    // ---------------------------------------------------------
    // 3. Rebuild STSZ from semantic params
    // ---------------------------------------------------------
    let stszEmitterPath;

    const refSampleSize = refReport.box.fields.sampleSize;

    if (refSampleSize === 0) {
        stszEmitterPath = "moov/trak/mdia/minf/stbl/stsz|variable";
    } else {
        stszEmitterPath = "moov/trak/mdia/minf/stbl/stsz|fixed";
    }

    let outParams;

    if (refSampleSize === 0) {
        outParams = { sampleSize: 0, sampleCount: params.sizes.length, sizes: params.sizes };
    } else {
        outParams = { sampleSize: refSampleSize, sampleCount: params.sizes.length }; }

    const outBytes = serializeBoxTree(EmitterRegistry.emit( stszEmitterPath, outParams ));

    // ---------------------------------------------------------
    // 4. Field-level structural assertions
    // ---------------------------------------------------------

    // Box type
    assertEqual("stsz.type", readFourCC(outBytes, 4), "stsz");

    // FullBox header
    assertEqual("stsz.version", outBytes[8], 0);

    const flags =
        (outBytes[9] << 16) |
        (outBytes[10] << 8) |
        outBytes[11];

    assertEqual("stsz.flags", flags, 0);

    // sample_size (Framesmith invariant)
    assertEqual("stsz.sample_size", readUint32(outBytes, 12), refSampleSize);

    // sampleCount
    assertEqual("stsz.sampleCount", readUint32(outBytes, 16), refReport.box.fields.sampleCount);

    // per-sample sizes
    if (refSampleSize === 0) {

        let offset = 20;
        const sizes = refReport.box.fields.sizes;

        for (let i = 0; i < sizes.length; i++) {
            assertEqual(`stsz.sample_size[${i}]`, readUint32(outBytes, offset), sizes[i]);
            offset += 4;
        }
    }

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    assertEqual("stsz.size", outBytes.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(`stsz.byte[${i}]`, outBytes[i], refRaw[i]);
    }
}


export async function testStsz_LockedLayoutEquivalence_ffmpeg_opus() {

    // ---------------------------------------------------------
    // 1. Load golden MP4 (Opus)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth directly (authoritative)
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsz"
    );

    const refReport = truth.readBoxReport();
    const refRaw    = refReport.raw;

    // ---------------------------------------------------------
    // 3. Rebuild STSZ from semantic params (fixed form)
    // ---------------------------------------------------------
    const refSampleSize  = refReport.box.fields.sampleSize;
    const refSampleCount = refReport.box.fields.sampleCount;

    assertEqual("opus.sampleSize != 0", refSampleSize !== 0, true);

    const outParams = {
        sampleSize:  refSampleSize,
        sampleCount: refSampleCount
    };

    const outBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsz|fixed",
                outParams
            )
        );

    // ---------------------------------------------------------
    // 4. Field-level structural assertions
    // ---------------------------------------------------------

    // Box type
    assertEqual("stsz.type", readFourCC(outBytes, 4), "stsz");

    // FullBox header
    assertEqual("stsz.version", outBytes[8], 0);

    const flags =
        (outBytes[9]  << 16) |
        (outBytes[10] << 8)  |
        outBytes[11];

    assertEqual("stsz.flags", flags, 0);

    // sample_size (fixed)
    assertEqual("stsz.sample_size", readUint32(outBytes, 12), refSampleSize);

    // sampleCount
    assertEqual(
        "stsz.sampleCount",
        readUint32(outBytes, 16),
        refSampleCount
    );

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    assertEqual("stsz.size", outBytes.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(`stsz.byte[${i}]`, outBytes[i], refRaw[i]);
    }
}
