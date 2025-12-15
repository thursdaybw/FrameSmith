import { buildDrefBox } from "../boxes/drefBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readBoxTypeFromMp4BoxBytes, readUint32FromMp4BoxBytes } from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

export function testDref_Structure() {
    console.log("=== testDref_Structure ===");

    const node = buildDrefBox();
    const box  = serializeBoxTree(node);

    // ----------------------------------------
    // Parent box: dref
    // ----------------------------------------
    assertEqual(
        "dref.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "dref"
    );

    assertEqual(
        "dref.size",
        readUint32FromMp4BoxBytes(box, 0),
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
    const entryCount = readUint32FromMp4BoxBytes(box, 12);
    assertEqual("dref.entry_count", entryCount, 1);

    // ----------------------------------------
    // Child box: url
    // ----------------------------------------
    const urlOffset = 16;

    const urlSize = readUint32FromMp4BoxBytes(box, urlOffset);
    const urlType = readBoxTypeFromMp4BoxBytes(box, urlOffset + 4);

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

/**
 * testDref_Conformance
 * -------------------
 * Phase C test: byte-for-byte comparison against a real MP4
 * produced by ffmpeg.
 *
 * This test proves that Framesmith’s dref implementation:
 * - matches the real-world box layout
 * - matches child ordering
 * - matches flags, sizes, and payload exactly
 *
 * If this test passes, the box is not just "valid",
 * it is *identical* to reference output.
 */
export async function testDref_Conformance() {
    console.log("=== testDref_Conformance (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Extract reference dref
    // ------------------------------------------------------------
    const refDref = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "dinf", "dref"]
    );

    if (!refDref) {
        throw new Error("FAIL: reference dref box not found");
    }

    // ------------------------------------------------------------
    // 3. Build Framesmith dref
    // ------------------------------------------------------------
    const outDref = serializeBoxTree(buildDrefBox());

    // ------------------------------------------------------------
    // 4. Parse both
    // ------------------------------------------------------------
    const ref = parseDref(refDref);
    const out = parseDref(outDref);

    // ------------------------------------------------------------
    // 5. Field-level conformance
    // ------------------------------------------------------------
    assertEqual("dref.type",        out.type,        "dref");
    assertEqual("dref.version",     out.version,     ref.version);
    assertEqual("dref.flags",       out.flags,       ref.flags);
    assertEqual("dref.entry_count", out.entryCount, ref.entryCount);

    // ------------------------------------------------------------
    // 6. Child entry conformance (`url `)
    // ------------------------------------------------------------
    assertEqual("dref.child.type",    out.child.type,    ref.child.type);
    assertEqual("dref.child.version", out.child.version, ref.child.version);
    assertEqual("dref.child.flags",   out.child.flags,   ref.child.flags);

    // ------------------------------------------------------------
    // 7. Byte-for-byte conformance
    // ------------------------------------------------------------
    assertEqual(
        "dref.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `dref.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: dref matches golden MP4 byte-for-byte");
}
function parseDref(box) {
    const size = readUint32FromMp4BoxBytes(box, 0);
    const type = readBoxTypeFromMp4BoxBytes(box, 4);

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const entryCount = readUint32FromMp4BoxBytes(box, 12);

    // Parse first child (Framesmith emits exactly one)
    const childOffset = 16;
    const childSize = readUint32FromMp4BoxBytes(box, childOffset);
    const childType = readBoxTypeFromMp4BoxBytes(box, childOffset + 4);

    const childVersion = box[childOffset + 8];
    const childFlags =
        (box[childOffset + 9] << 16) |
        (box[childOffset + 10] << 8) |
        box[childOffset + 11];

    return {
        size,
        type,
        version,
        flags,
        entryCount,
        child: {
            size: childSize,
            type: childType,
            version: childVersion,
            flags: childFlags,
        },
        raw: box
    };
}
