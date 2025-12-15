import { buildSttsBox } from "../boxes/sttsBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testStts_Structure() {
    console.log("=== testStts_Structure ===");

    const fps = 30;
    const delta = Math.floor(90000 / fps);
    const count = 47;

    const node = buildSttsBox(count, delta);
    const stts = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "stts.type",
        readBoxTypeFromMp4BoxBytes(stts, 4),
        "stts"
    );

    assertEqual(
        "stts.version_and_flags",
        readUint32FromMp4BoxBytes(stts, 8),
        0
    );

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "stts.entry_count",
        readUint32FromMp4BoxBytes(stts, 12),
        1
    );

    // ---------------------------------------------------------
    // Sample count
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_count",
        readUint32FromMp4BoxBytes(stts, 16),
        count
    );

    // ---------------------------------------------------------
    // Sample delta
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_delta",
        readUint32FromMp4BoxBytes(stts, 20),
        delta
    );

    // ---------------------------------------------------------
    // Size
    // ---------------------------------------------------------
    assertEqual(
        "stts.size",
        readUint32FromMp4BoxBytes(stts, 0),
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
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Extract reference stts
    // -------------------------------------------------------------
    const refStts = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stts"]
    );

    if (!refStts) {
        throw new Error("FAIL: stts box not found in golden MP4");
    }

    // -------------------------------------------------------------
    // 3. Parse reference
    // -------------------------------------------------------------
    const ref = parseStts(refStts);

    if (ref.entryCount !== 1) {
        throw new Error(
            `FAIL: golden MP4 stts uses ${ref.entryCount} entries\n` +
            `Framesmith currently supports canonical single-entry STTS only`
        );
    }

    const refEntry = ref.entries[0];

    // -------------------------------------------------------------
    // 4. Build Framesmith STTS from reference values
    // -------------------------------------------------------------
    const outStts = serializeBoxTree(
        buildSttsBox(refEntry.sampleCount, refEntry.sampleDelta)
    );

    // -------------------------------------------------------------
    // 5. Parse output
    // -------------------------------------------------------------
    const out = parseStts(outStts);

    // -------------------------------------------------------------
    // 6. Field-level conformance
    // -------------------------------------------------------------
    assertEqual("stts.type", out.type, "stts");
    assertEqual("stts.version", out.version, ref.version);
    assertEqual("stts.flags", out.flags, ref.flags);
    assertEqual("stts.entry_count", out.entryCount, ref.entryCount);

    const outEntry = out.entries[0];

    assertEqual(
        "stts.sample_count",
        outEntry.sampleCount,
        refEntry.sampleCount
    );

    assertEqual(
        "stts.sample_delta",
        outEntry.sampleDelta,
        refEntry.sampleDelta
    );

    // -------------------------------------------------------------
    // 7. Byte-for-byte conformance
    // -------------------------------------------------------------
    assertEqual(
        "stts.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `stts.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: stts matches golden MP4 byte-for-byte");
}

function parseStts(box) {
    const size = readUint32FromMp4BoxBytes(box, 0);
    const type = readBoxTypeFromMp4BoxBytes(box, 4);

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const entryCount = readUint32FromMp4BoxBytes(box, 12);

    const entries = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        const sampleCount = readUint32FromMp4BoxBytes(box, offset);
        const sampleDelta = readUint32FromMp4BoxBytes(box, offset + 4);
        entries.push({ sampleCount, sampleDelta });
        offset += 8;
    }

    return {
        size,
        type,
        version,
        flags,
        entryCount,
        entries,
        raw: box
    };
}

