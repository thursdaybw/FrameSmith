import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

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

    // ---------------------------------------------------------
    // TEST 1: empty offsets list
    // ---------------------------------------------------------
    let node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: [] }
        );

    assertEqual("stco.type (empty)", node.type, "stco");
    assertEqual("stco.version (empty)", node.version, 0);
    assertEqual("stco.flags (empty)", node.flags, 0);

    assertEqual(
        "stco.entry_count (empty)",
        node.body[0].int,
        0
    );

    assertEqual(
        "stco.body.length (empty)",
        node.body.length,
        2
    );

    // ---------------------------------------------------------
    // TEST 2: single offset
    // ---------------------------------------------------------
    node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: [1000] }
        );

    assertEqual(
        "stco.entry_count (single)",
        node.body[0].int,
        1
    );
    assertEqual(
        "stco.offset[0] (single)",
        node.body[1].values[0],
        1000
    );

    // ---------------------------------------------------------
    // TEST 3: multiple offsets
    // ---------------------------------------------------------
    const offsetsMulti = [8, 512, 4096];

    node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: offsetsMulti }
        );

    assertEqual(
        "stco.entry_count (multiple)",
        node.body[0].int,
        3
    );

    for (let i = 0; i < offsetsMulti.length; i++) {
        assertEqual(
            `stco.offset[${i}]`,
            node.body[1].values[i],
            offsetsMulti[i]
        );
    }

    // ---------------------------------------------------------
    // TEST 4: input immutability
    // ---------------------------------------------------------
    const mutableOffsets = [12, 24, 36];

    node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: mutableOffsets }
        );

    mutableOffsets[0] = 999;

    assertEqual(
        "stco.immutability",
        node.body[1].values[0],
        12
    );

    // ---------------------------------------------------------
    // TEST 5: integer integrity
    // ---------------------------------------------------------
    node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: [0x01020304] }
        );

    assertEqual(
        "stco.integer_integrity",
        node.body[1].values[0],
        0x01020304
    );
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

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth via registry
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stco"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // Authoritative reference bytes
    const refBytes = refReport.raw;

    // ---------------------------------------------------------
    // 3. Rebuild STCO from semantic params
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            params
        )
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
        (outBytes[9]  << 16) |
        (outBytes[10] << 8)  |
        outBytes[11];

    assertEqual(
        "stco.flags",
        flags,
        0
    );

    // entry_count
    const refOffsets = refReport.box.fields.chunkOffsets;

    assertEqual(
        "stco.entry_count",
        readUint32(outBytes, 12),
        refOffsets.length
    );

    // chunk offsets
    let offset = 16;

    for (let i = 0; i < refOffsets.length; i++) {
        assertEqual(
            `stco.chunk_offset[${i}]`,
            readUint32(outBytes, offset),
            refOffsets[i]
        );
        offset += 4;
    }

    // ---------------------------------------------------------
    // 5. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stco.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    assertEqual(
        "stco.size",
        outBytes.length,
        refBytes.length
    );
}
