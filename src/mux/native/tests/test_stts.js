import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testStts_Structure() {
    console.log("=== testStts_Structure ===");

    const fps = 30;
    const delta = Math.floor(90000 / fps);
    const count = 47;

    const node = emitSttsBox({
        sampleCount: count,
        sampleDuration: delta
    });
    const stts = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "stts.type",
        readFourCC(stts, 4),
        "stts"
    );

    assertEqual(
        "stts.version_and_flags",
        readUint32(stts, 8),
        0
    );

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "stts.entry_count",
        readUint32(stts, 12),
        1
    );

    // ---------------------------------------------------------
    // Sample count
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_count",
        readUint32(stts, 16),
        count
    );

    // ---------------------------------------------------------
    // Sample delta
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_delta",
        readUint32(stts, 20),
        delta
    );

    // ---------------------------------------------------------
    // Size
    // ---------------------------------------------------------
    assertEqual(
        "stts.size",
        readUint32(stts, 0),
        24
    );

    console.log("PASS: stts structural correctness");
}

/**
 * testStts_Conformance
 * -------------------
 * Phase C test: byte-for-byte comparison against a real MP4
 * produced by ffmpeg.
 *
 * This test proves that Framesmith’s STTS output:
 * - matches real-world encoders exactly
 * - uses the same entry layout
 * - uses the same timing values
 */

export async function testStts_Conformance() {
    console.log("=== testStts_Conformance (golden MP4) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference STTS via MP4 navigation
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stts"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild STTS via Framesmith
    // -------------------------------------------------------------
    const outSttsBytes = serializeBoxTree(
        emitSttsBox(params)
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt STTS via box entry
    // -------------------------------------------------------------
    const out = getGoldenTruthBox.fromBox(
        outSttsBytes,
        "moov/trak/mdia/minf/stbl/stts"
    ).readFields();

    // -------------------------------------------------------------
    // 5. Field-level conformance
    // -------------------------------------------------------------
    assertEqual(
        "stts.entryCount",
        out.entryCount,
        refFields.entryCount
    );

    assertEqual(
        "stts.sampleCount",
        out.entries[0].sampleCount,
        refFields.entries[0].sampleCount
    );

    assertEqual(
        "stts.sampleDelta",
        out.entries[0].sampleDelta,
        refFields.entries[0].sampleDelta
    );

    // -------------------------------------------------------------
    // 6. Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "stts.size",
        outSttsBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `stts.byte[${i}]`,
            outSttsBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: stts matches golden MP4 byte-for-byte");
}

