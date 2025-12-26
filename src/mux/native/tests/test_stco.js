import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * NOTE ON CONFORMANCE (Phase C)
 * -----------------------------
 * stco (Chunk Offset Box) cannot be validated byte-for-byte
 * in isolation.
 *
 * Its values depend on:
 *   - final moov size
 *   - final mdat placement
 *   - final chunking policy
 *   - final file layout
 *
 * Phase C conformance for stco is therefore deferred to:
 *   - NativeMuxer integration tests
 *   - boundary tests (offset correctness)
 *   - full MP4 round-trip validation
 *
 * This test file intentionally covers only:
 *   Phase A (JSON output)
 *   Phase B (structural correctness)
 */

export async function testStco_Structure() {

    console.log("=== testStco_Structure ===");

    // ---------------------------------------------------------
    // TEST 1: empty offsets list
    // ---------------------------------------------------------
    let node = emitStcoBox({ chunkOffsets: [] })
    let stco = serializeBoxTree(node);

    let size1 = readUint32(stco, 0);
    if (size1 !== 16) {
        throw new Error(`FAIL: stco size for zero entries must be 16 bytes, got ${size1}`);
    }

    let type1 = String.fromCharCode(...stco.slice(4, 8));
    if (type1 !== "stco") {
        throw new Error("FAIL: stco type incorrect for empty case");
    }

    let count1 = readUint32(stco, 12);
    if (count1 !== 0) {
        throw new Error("FAIL: empty stco must have entry_count = 0");
    }

    // ---------------------------------------------------------
    // TEST 2: single offset
    // ---------------------------------------------------------
    const offsets = [1000];
    node = emitStcoBox({ chunkOffsets: offsets })
    stco = serializeBoxTree(node);


    let size2 = readUint32(stco, 0);
    if (size2 !== 20) {
        throw new Error(`FAIL: stco size for one entry must be 20 bytes, got ${size2}`);
    }

    let count2 = readUint32(stco, 12);
    if (count2 !== 1) {
        throw new Error("FAIL: stco entry_count incorrect for single offset");
    }

    let offset2 = readUint32(stco, 16);
    if (offset2 !== 1000) {
        throw new Error("FAIL: stco stored offset incorrect for single entry");
    }

    // ---------------------------------------------------------
    // TEST 3: multiple offsets
    // ---------------------------------------------------------
    const offsetsMulti = [8, 512, 4096];
    node = emitStcoBox({ chunkOffsets: offsetsMulti })
    stco = serializeBoxTree(node);

    let count3 = readUint32(stco, 12);
    if (count3 !== 3) {
        throw new Error("FAIL: stco entry_count incorrect for multiple offsets");
    }

    let o0 = readUint32(stco, 16);
    let o1 = readUint32(stco, 20);
    let o2 = readUint32(stco, 24);

    if (o0 !== 8 || o1 !== 512 || o2 !== 4096) {
        throw new Error("FAIL: stco offset entries incorrect");
    }

    // ---------------------------------------------------------
    // TEST 4: input must not mutate post-box
    // ---------------------------------------------------------
    const mutableOffsets = [12, 24, 36];
    node = emitStcoBox({ chunkOffsets: mutableOffsets})
    stco = serializeBoxTree(node);

    mutableOffsets[0] = 999;

    let preserved = readUint32(stco, 16);
    if (preserved !== 12) {
        throw new Error("FAIL: stco must not depend on mutated input");
    }

    // ---------------------------------------------------------
    // TEST 5: big-endian correctness
    // ---------------------------------------------------------
    node = emitStcoBox({ chunkOffsets: [0x01020304] })
    stco = serializeBoxTree(node);

    let parsed = readUint32(stco, 16);
    if (parsed !== 0x01020304) {
        throw new Error("FAIL: stco big-endian encoding incorrect");
    }

    console.log("PASS: STCO structural correctness");
}

/**
 * STCO — Locked-Layout Equivalence (ffmpeg)
 * ========================================
 *
 * PURPOSE
 * -------
 * Prove that Framesmith’s STCO box builder serializes *identical bytes*
 * to ffmpeg when provided with the same concrete chunk offsets.
 *
 * This test validates **serialization fidelity only**.
 *
 * ------------------------------------------------------------
 * What this test does NOT validate
 * ------------------------------------------------------------
 *
 * This test does NOT validate:
 *   - correctness of chunk offsets
 *   - chunking policy
 *   - interleaving strategy
 *   - final MP4 layout decisions
 *
 * Those responsibilities belong exclusively to NativeMuxer
 * finalization tests, where full file layout is known.
 *
 * ------------------------------------------------------------
 * Why this test exists
 * ------------------------------------------------------------
 *
 * STCO values are *derived* from final MP4 layout.
 * They cannot be computed honestly until:
 *
 *   - moov size is fixed
 *   - mdat placement is fixed
 *   - chunk boundaries are finalized
 *
 * However, before NativeMuxer exists, we still need to prove:
 *
 *   - field ordering is correct
 *   - size accounting is correct
 *   - endianness is correct
 *   - no mutation occurs during serialization
 *
 * This test achieves that by:
 *
 *   1. Extracting the exact STCO offsets emitted by ffmpeg
 *   2. Injecting those offsets verbatim into the Framesmith builder
 *   3. Comparing the serialized output byte-for-byte
 *
 * This is a **locked-layout equivalence test**.
 *
 * ------------------------------------------------------------
 * Architectural integrity
 * ------------------------------------------------------------
 *
 * Although this test extracts raw offsets from a reference MP4,
 * it does NOT parse MP4 semantics inline.
 *
 * Reference extraction is delegated to a narrowly scoped helper
 * whose sole responsibility is to expose *what ffmpeg emitted*,
 * not *what it means*.
 *
 * This preserves the global rule:
 *
 *   Tests do not parse MP4s.
 *   Tests ask explicit readers for truth.
 *
 * ------------------------------------------------------------
 * Historical context
 * ------------------------------------------------------------
 *
 * This test was retained after refactoring the parser layer to
 * enforce strict boundaries between:
 *
 *   - semantic parsing
 *   - reference inspection
 *   - structural serialization
 *
 * STCO was identified as a necessary exception during early
 * bring-up, and this test documents that exception explicitly
 * to prevent architectural drift.
 */

export async function testStco_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== testStco_LockedLayoutEquivalence_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference STCO via registry
    // ---------------------------------------------------------
    const refParsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stco"
    );

    const refFields = refParsed.readFields();
    const params    = refParsed.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild STCO from semantic params
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitStcoBox(params)
    );

    // ---------------------------------------------------------
    // 4. Granular field-level assertions
    // ---------------------------------------------------------

    // Box identity
    assertEqual(
        "stco.type",
        readFourCC(outBytes, 4),
        "stco"
    );

    // FullBox header
    assertEqual(
        "stco.version",
        outBytes[8],
        0
    );

    const flags =
        (outBytes[9] << 16) |
        (outBytes[10] << 8) |
        outBytes[11];

    assertEqual(
        "stco.flags",
        flags,
        0
    );

    // entry_count
    assertEqual(
        "stco.entry_count",
        readUint32(outBytes, 12),
        refFields.entryCount
    );

    // chunk offsets
    let offset = 16;

    for (let i = 0; i < refFields.entryCount; i++) {
        assertEqual(
            `stco.chunk_offset[${i}]`,
            readUint32(outBytes, offset),
            refFields.offsets[i]
        );
        offset += 4;
    }

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stco"
    );

    assertEqual(
        "stco.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stco.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: STCO locked-layout equivalence with ffmpeg"
    );
}

