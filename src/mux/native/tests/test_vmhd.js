import { buildVmhdBox } from "../boxes/vmhdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readBoxTypeFromMp4BoxBytes, readUint32FromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

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
    const node = buildVmhdBox();
    const box  = serializeBoxTree(node);

    // ------------------------------------------------------------
    // 2. Box header
    // ------------------------------------------------------------
    assertEqual(
        "vmhd.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "vmhd"
    );

    assertEqual(
        "vmhd.size",
        readUint32FromMp4BoxBytes(box, 0),
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

/**
 * testVmhd_Conformance
 * -------------------
 * Phase C conformance test for the Video Media Header Box (vmhd).
 *
 * This test:
 * - Extracts the real vmhd box from a golden MP4 produced by ffmpeg
 * - Rebuilds vmhd using Framesmith's box builder
 * - Asserts byte-for-byte equality
 *
 * If this test passes, Framesmith's vmhd implementation
 * exactly matches real-world encoder output.
 */
export async function testVmhd_Conformance() {
    console.log("=== testVmhd_Conformance (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Extract reference vmhd
    // ------------------------------------------------------------
    const refVmhd = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "vmhd"]
    );

    if (!refVmhd) {
        throw new Error("FAIL: reference vmhd box not found");
    }

    // ------------------------------------------------------------
    // 3. Build Framesmith vmhd
    // ------------------------------------------------------------
    const outVmhd = serializeBoxTree(buildVmhdBox());

    // ------------------------------------------------------------
    // 4. Parse both
    // ------------------------------------------------------------
    const ref = parseVmhd(refVmhd);
    const out = parseVmhd(outVmhd);

    // ------------------------------------------------------------
    // 5. Field-level conformance
    // ------------------------------------------------------------
    assertEqual("vmhd.type",        out.type,        "vmhd");
    assertEqual("vmhd.version",     out.version,     ref.version);
    assertEqual("vmhd.flags",       out.flags,       ref.flags);
    assertEqual("vmhd.graphicsmode",out.graphicsmode,ref.graphicsmode);

    for (let i = 0; i < 3; i++) {
        assertEqual(
            `vmhd.opcolor[${i}]`,
            out.opcolor[i],
            ref.opcolor[i]
        );
    }

    // ------------------------------------------------------------
    // 6. Byte-for-byte conformance
    // ------------------------------------------------------------
    assertEqual(
        "vmhd.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `vmhd.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: vmhd matches golden MP4 byte-for-byte");
}
function parseVmhd(box) {
    const size = readUint32FromMp4BoxBytes(box, 0);
    const type = readBoxTypeFromMp4BoxBytes(box, 4);

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const graphicsmode =
        (box[12] << 8) | box[13];

    const opcolor = [
        (box[14] << 8) | box[15],
        (box[16] << 8) | box[17],
        (box[18] << 8) | box[19],
    ];

    return {
        size,
        type,
        version,
        flags,
        graphicsmode,
        opcolor,
        raw: box
    };
}

