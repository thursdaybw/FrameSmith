import { buildStscBox } from "../boxes/stscBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export async function testStsc_Structure() {
    console.log("=== testStsc_Structure ===");

    // Canonical minimal layout
    const layout = {
        firstChunk: 1,
        samplesPerChunk: 1,
        sampleDescriptionIndex: 1
    };

    const node = buildStscBox(layout);
    const stsc = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "stsc.type",
        readBoxTypeFromMp4BoxBytes(stsc, 4),
        "stsc"
    );

    assertEqual(
        "stsc.size",
        readUint32FromMp4BoxBytes(stsc, 0),
        28
    );

    // ---------------------------------------------------------
    // FullBox header
    // ---------------------------------------------------------
    const version = stsc[8];
    const flags =
        (stsc[9] << 16) |
        (stsc[10] << 8) |
        stsc[11];

    assertEqual("stsc.version", version, 0);
    assertEqual("stsc.flags", flags, 0);

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "stsc.entry_count",
        readUint32FromMp4BoxBytes(stsc, 12),
        1
    );

    // ---------------------------------------------------------
    // Entry values
    // ---------------------------------------------------------
    assertEqual(
        "stsc.first_chunk",
        readUint32FromMp4BoxBytes(stsc, 16),
        1
    );

    assertEqual(
        "stsc.samples_per_chunk",
        readUint32FromMp4BoxBytes(stsc, 20),
        1
    );

    assertEqual(
        "stsc.sample_description_index",
        readUint32FromMp4BoxBytes(stsc, 24),
        1
    );

    // ---------------------------------------------------------
    // Defensive immutability
    // ---------------------------------------------------------
    layout.firstChunk = 999;

    assertEqual(
        "stsc.immutability",
        readUint32FromMp4BoxBytes(stsc, 16),
        1
    );

    console.log("PASS: stsc structural correctness");
}

export async function testStsc_Conformance() {
    console.log("=== testStsc_Conformance (golden MP4) ===");

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Extract reference STSC
    // -------------------------------------------------------------
    const refStsc = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsc"]
    );

    if (!refStsc) {
        throw new Error("FAIL: stsc box not found in golden MP4");
    }

    // -------------------------------------------------------------
    // 3. Parse reference
    // -------------------------------------------------------------
    const ref = parseStsc(refStsc);

    if (ref.entryCount !== 1) {
        throw new Error(
            `FAIL: golden MP4 stsc uses ${ref.entryCount} entries\n` +
            `Framesmith currently supports canonical single-entry STSC only`
        );
    }

    const refEntry = ref.entries[0];

    // -------------------------------------------------------------
    // 4. Build Framesmith STSC from reference layout
    // -------------------------------------------------------------
    const outStsc = serializeBoxTree(
        buildStscBox({
            firstChunk: refEntry.firstChunk,
            samplesPerChunk: refEntry.samplesPerChunk,
            sampleDescriptionIndex: refEntry.sampleDescriptionIndex
        })
    );

    // -------------------------------------------------------------
    // 5. Parse output
    // -------------------------------------------------------------
    const out = parseStsc(outStsc);

    // -------------------------------------------------------------
    // 6. Field-level conformance
    // -------------------------------------------------------------
    assertEqual("stsc.type", out.type, "stsc");
    assertEqual("stsc.version", out.version, ref.version);
    assertEqual("stsc.flags", out.flags, ref.flags);
    assertEqual("stsc.entry_count", out.entryCount, ref.entryCount);

    const outEntry = out.entries[0];

    assertEqual(
        "stsc.first_chunk",
        outEntry.firstChunk,
        refEntry.firstChunk
    );

    assertEqual(
        "stsc.samples_per_chunk",
        outEntry.samplesPerChunk,
        refEntry.samplesPerChunk
    );

    assertEqual(
        "stsc.sample_description_index",
        outEntry.sampleDescriptionIndex,
        refEntry.sampleDescriptionIndex
    );

    // -------------------------------------------------------------
    // 7. Byte-for-byte conformance
    // -------------------------------------------------------------
    assertEqual(
        "stsc.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `stsc.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: stsc matches golden MP4 byte-for-byte");
}

function parseStsc(box) {
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
        entries.push({
            firstChunk: readUint32FromMp4BoxBytes(box, offset),
            samplesPerChunk: readUint32FromMp4BoxBytes(box, offset + 4),
            sampleDescriptionIndex: readUint32FromMp4BoxBytes(box, offset + 8),
        });
        offset += 12;
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
