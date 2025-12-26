import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testCtts_Structure() {

    console.log("=== testCtts_Structure ===");

    // ---------------------------------------------------------
    // Canonical version-0 layout
    // ---------------------------------------------------------
    const entries = [
        { count: 10, offset: 0 },
        { count: 5,  offset: 2 }
    ];

    const node = emitCttsBox({ entries });
    const ctts = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "ctts.type",
        readFourCC(ctts, 4),
        "ctts"
    );

    // ---------------------------------------------------------
    // FullBox header
    // ---------------------------------------------------------
    const version = ctts[8];
    const flags =
        (ctts[9] << 16) |
        (ctts[10] << 8) |
        ctts[11];

    assertEqual("ctts.version", version, 0);
    assertEqual("ctts.flags", flags, 0);

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "ctts.entry_count",
        readUint32(ctts, 12),
        entries.length
    );

    // ---------------------------------------------------------
    // Entry payload
    // ---------------------------------------------------------
    let offset = 16;

    for (let i = 0; i < entries.length; i++) {

        assertEqual(
            `ctts.entry[${i}].count`,
            readUint32(ctts, offset),
            entries[i].count
        );

        assertEqual(
            `ctts.entry[${i}].offset`,
            readUint32(ctts, offset + 4),
            entries[i].offset
        );

        offset += 8;
    }

    // ---------------------------------------------------------
    // Size
    // ---------------------------------------------------------
    const expectedSize = 16 + (entries.length * 8);

    assertEqual(
        "ctts.size",
        readUint32(ctts, 0),
        expectedSize
    );

    assertEqual(
        "ctts.length",
        ctts.length,
        expectedSize
    );

    // ---------------------------------------------------------
    // Defensive immutability
    // ---------------------------------------------------------
    entries[0].count = 999;

    assertEqual(
        "ctts.immutability",
        readUint32(ctts, 16),
        10
    );

    console.log("PASS: ctts structural correctness");
}

export async function testCtts_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== testCtts_LockedLayoutEquivalence_ffmpeg (golden MP4) ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference CTTS via parser registry
    // ---------------------------------------------------------
    const parsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/ctts"
    );

    const refFields = parsed.readFields();
    const buildParams = parsed.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild CTTS via Framesmith
    // ---------------------------------------------------------
    const outCtts = serializeBoxTree(
        emitCttsBox(buildParams)
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "ctts.size",
        outCtts.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `ctts.byte[${i}]`,
            outCtts[i],
            refRaw[i]
        );
    }

    console.log(
        "PASS: ctts parser rebuilds ffmpeg output byte-for-byte"
    );
}
