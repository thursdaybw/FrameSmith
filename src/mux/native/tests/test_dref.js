import { emitDrefBox } from "../box-emitters/drefBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";


export function testDref_Structure() {
    console.log("=== testDref_Structure ===");

    const node = emitDrefBox();
    const box  = serializeBoxTree(node);

    // ----------------------------------------
    // Parent box: dref
    // ----------------------------------------
    assertEqual(
        "dref.type",
        readFourCC(box, 4),
        "dref"
    );

    assertEqual(
        "dref.size",
        readUint32(box, 0),
        box.length
    );

    // FullBox header
    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    assertEqual("dref.version", version, 0);
    assertEqual("dref.flags",   flags,   0);

    // entry_count
    const entryCount = readUint32(box, 12);
    assertEqual("dref.entry_count", entryCount, 1);

    // ----------------------------------------
    // Child box: url
    // ----------------------------------------
    const urlOffset = 16;

    const urlSize = readUint32(box, urlOffset);
    const urlType = readFourCC(box, urlOffset + 4);

    assertEqual("dref.url.type", urlType, "url ");
    assertEqual("dref.url.size", urlSize, 12);

    const urlVersion = box[urlOffset + 8];
    const urlFlags =
        (box[urlOffset + 9] << 16) |
        (box[urlOffset + 10] << 8) |
        box[urlOffset + 11];

    assertEqual("dref.url.version", urlVersion, 0);
    assertEqual("dref.url.flags",   urlFlags,   1);

    // ----------------------------------------
    // No trailing bytes
    // ----------------------------------------
    assertEqual(
        "dref.trailing_bytes",
        urlOffset + urlSize,
        box.length
    );

    console.log("PASS: dref structural correctness");
}

export async function testDref_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testDref_LockedLayoutEquivalence_ffmpeg (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Read golden truth (validation + raw bytes)
    // ------------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/dinf/dref"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput(); // {}

    // ------------------------------------------------------------
    // 3. Rebuild dref
    // ------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitDrefBox(params)
    );

    // ------------------------------------------------------------
    // 4. Re-read rebuilt dref
    // ------------------------------------------------------------
    const outFields = getGoldenTruthBox
        .fromBox(outBytes, "moov/trak/mdia/minf/dinf/dref")
        .readFields();

    // ------------------------------------------------------------
    // 5. Byte-for-byte equivalence
    // ------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "dref.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `dref.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: dref matches golden MP4 byte-for-byte");
}
