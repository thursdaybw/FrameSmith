import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";


/**
 * testVmhd_Structure
 * ------------------
 * Phase B — Structural correctness test for vmhd.
 *
 * Asserts:
 * - box type == "vmhd"
 * - version == 0
 * - flags == 1 (required by spec)
 * - graphicsmode == 0
 * - opcolor == [0, 0, 0]
 * - exact size calculation
 * - no trailing bytes
 */
export function testVmhd_Structure() {
    console.log("=== testVmhd_Structure ===");

    // ------------------------------------------------------------
    // 1. Build + serialize
    // ------------------------------------------------------------
    const node = emitVmhdBox();
    const box  = serializeBoxTree(node);

    // ------------------------------------------------------------
    // 2. Box header
    // ------------------------------------------------------------
    assertEqual(
        "vmhd.type",
        readFourCC(box, 4),
        "vmhd"
    );

    assertEqual(
        "vmhd.size",
        readUint32(box, 0),
        box.length
    );

    // ------------------------------------------------------------
    // 3. FullBox header
    // ------------------------------------------------------------
    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    assertEqual("vmhd.version", version, 0);
    assertEqual("vmhd.flags",   flags,   1);

    // ------------------------------------------------------------
    // 4. Payload fields (uint16)
    // ------------------------------------------------------------
    const graphicsmode =
        (box[12] << 8) | box[13];

    const opcolor0 =
        (box[14] << 8) | box[15];
    const opcolor1 =
        (box[16] << 8) | box[17];
    const opcolor2 =
        (box[18] << 8) | box[19];

    assertEqual("vmhd.graphicsmode", graphicsmode, 0);
    assertEqual("vmhd.opcolor[0]",   opcolor0,     0);
    assertEqual("vmhd.opcolor[1]",   opcolor1,     0);
    assertEqual("vmhd.opcolor[2]",   opcolor2,     0);

    // ------------------------------------------------------------
    // 5. Exact size (FullBox + 4 uint16 fields)
    // ------------------------------------------------------------
    const expectedSize =
          8  // box header
        + 4  // FullBox header
        + 8; // graphicsmode + opcolor[3]

    assertEqual(
        "vmhd.total_size",
        box.length,
        expectedSize
    );

    console.log("PASS: vmhd structural correctness");
}

export async function testVmhd_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testVmhd_LockedLayoutEquivalence_ffmpeg (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Read golden truth
    // ------------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/vmhd"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ------------------------------------------------------------
    // 3. Rebuild vmhd
    // ------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitVmhdBox(params)
    );

    // ------------------------------------------------------------
    // 4. Re-read rebuilt vmhd
    // ------------------------------------------------------------
    const outFields = getGoldenTruthBox
        .fromBox(outBytes, "moov/trak/mdia/minf/vmhd")
        .readFields();

    // ------------------------------------------------------------
    // 5. Field-level conformance
    // ------------------------------------------------------------
    assertEqual("vmhd.version",      outFields.version,      refFields.version);
    assertEqual("vmhd.flags",        outFields.flags,        refFields.flags);
    assertEqual("vmhd.graphicsmode", outFields.graphicsmode, refFields.graphicsmode);

    for (let i = 0; i < 3; i++) {
        assertEqual(
            `vmhd.opcolor[${i}]`,
            outFields.opcolor[i],
            refFields.opcolor[i]
        );
    }

    // ------------------------------------------------------------
    // 6. Byte-for-byte equivalence
    // ------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "vmhd.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `vmhd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log("PASS: vmhd matches golden MP4 byte-for-byte");
}
