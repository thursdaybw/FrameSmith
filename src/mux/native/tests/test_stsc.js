import { emitStscBox } from "../box-emitters/stscBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testStsc_Structure() {
    console.log("=== testStsc_Structure ===");

    // Canonical minimal layout
    const layout = {
        firstChunk: 1,
        samplesPerChunk: 1,
        sampleDescriptionIndex: 1
    };

    const node = emitStscBox(layout);
    const stsc = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "stsc.type",
        readFourCC(stsc, 4),
        "stsc"
    );

    assertEqual(
        "stsc.size",
        readUint32(stsc, 0),
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
        readUint32(stsc, 12),
        1
    );

    // ---------------------------------------------------------
    // Entry values
    // ---------------------------------------------------------
    assertEqual(
        "stsc.first_chunk",
        readUint32(stsc, 16),
        1
    );

    assertEqual(
        "stsc.samples_per_chunk",
        readUint32(stsc, 20),
        1
    );

    assertEqual(
        "stsc.sample_description_index",
        readUint32(stsc, 24),
        1
    );

    // ---------------------------------------------------------
    // Defensive immutability
    // ---------------------------------------------------------
    layout.firstChunk = 999;

    assertEqual(
        "stsc.immutability",
        readUint32(stsc, 16),
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
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference STSC via parser registry
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsc"
    );

    const refFields = ref.readFields();
    const params    = ref.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Guard: supported semantic shape
    // -------------------------------------------------------------
    if (refFields.entryCount !== 1) {
        throw new Error(
            `FAIL: golden MP4 stsc uses ${refFields.entryCount} entries\n` +
            `Framesmith currently supports canonical single-entry STSC only`
        );
    }

    const refEntry = refFields.entries[0];

    // -------------------------------------------------------------
    // 4. Rebuild STSC using Framesmith builder
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitStscBox(params)
    );

    // -------------------------------------------------------------
    // 5. Read rebuilt STSC via same parser
    // -------------------------------------------------------------
    const out = getGoldenTruthBox.fromBox(
        outBytes,
        "moov/trak/mdia/minf/stbl/stsc"
    ).readFields();

    // -------------------------------------------------------------
    // 6. Field-level conformance
    // -------------------------------------------------------------
    assertEqual(
        "stsc.entry_count",
        out.entryCount,
        refFields.entryCount
    );

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
    const refRaw = refFields.raw;

    assertEqual(
        "stsc.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `stsc.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: stsc matches golden MP4 byte-for-byte");
}
