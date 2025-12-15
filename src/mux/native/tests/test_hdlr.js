import { buildHdlrBox } from "../boxes/hdlrBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readBoxTypeFromMp4BoxBytes, readUint32FromMp4BoxBytes} from "./testUtils.js";
import { extractBoxByPath } from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

/**
 * testHdlr_Structure
 * ------------------
 * Exhaustive structural test for the Handler Reference Box (hdlr).
 *
 * This test asserts the complete binary layout defined by the MP4 specification:
 *
 * - Box header (size + type)
 * - FullBox header (version + flags)
 * - pre_defined field
 * - handler_type discriminator
 * - reserved padding fields
 * - canonical handler name encoding
 * - null termination
 * - exact size calculation
 *
 * There are no optional fields or alternate layouts for hdlr.
 * Any deviation is a format error.
 */
export function testHdlr_Structure() {
    console.log("=== testHdlr_Structure ===");

    // ------------------------------------------------------------
    // 1. Build and serialize
    // ------------------------------------------------------------
    const node = buildHdlrBox();
    const box  = serializeBoxTree(node);

    // ------------------------------------------------------------
    // 2. Box header
    // ------------------------------------------------------------
    assertEqual(
        "hdlr.size",
        readUint32FromMp4BoxBytes(box, 0),
        box.length
    );

    assertEqual(
        "hdlr.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "hdlr"
    );

    // ------------------------------------------------------------
    // 3. FullBox header
    // ------------------------------------------------------------
    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    assertEqual("hdlr.version", version, 0);
    assertEqual("hdlr.flags",   flags,   0);

    // ------------------------------------------------------------
    // 4. pre_defined field
    // ------------------------------------------------------------
    assertEqual(
        "hdlr.pre_defined",
        readUint32FromMp4BoxBytes(box, 12),
        0
    );

    // ------------------------------------------------------------
    // 5. handler_type discriminator
    // ------------------------------------------------------------
    const handlerType = String.fromCharCode(
        box[16],
        box[17],
        box[18],
        box[19]
    );

    assertEqual(
        "hdlr.handler_type",
        handlerType,
        "vide"
    );

    // ------------------------------------------------------------
    // 6. Reserved padding fields
    // ------------------------------------------------------------
    const reserved1 = readUint32FromMp4BoxBytes(box, 20);
    const reserved2 = readUint32FromMp4BoxBytes(box, 24);
    const reserved3 = readUint32FromMp4BoxBytes(box, 28);

    assertEqual("hdlr.reserved[0]", reserved1, 0);
    assertEqual("hdlr.reserved[1]", reserved2, 0);
    assertEqual("hdlr.reserved[2]", reserved3, 0);

    // ------------------------------------------------------------
    // 7. Handler name (null-terminated C string)
    // ------------------------------------------------------------
    const nameStart = 32;
    const nameBytes = box.slice(nameStart);

    assertEqual(
        "hdlr.name.present",
        nameBytes.length > 0,
        true
    );

    assertEqual(
        "hdlr.name.null_terminated",
        nameBytes[nameBytes.length - 1],
        0
    );

    const name = new TextDecoder().decode(
        nameBytes.slice(0, nameBytes.length - 1)
    );

    assertEqual(
        "hdlr.name.value",
        name,
        "VideoHandler"
    );

    // ------------------------------------------------------------
    // 8. No trailing bytes
    // ------------------------------------------------------------
    assertEqual(
        "hdlr.trailing_bytes",
        readUint32FromMp4BoxBytes(box, 0),
        nameStart + nameBytes.length
    );

    console.log("PASS: hdlr structural contract is correct");
}

/**
 * testHdlr_Conformance
 * -------------------
 * Phase C conformance test for the Handler Reference Box (hdlr).
 *
 * This test:
 * - Extracts the real hdlr box from a golden MP4 produced by ffmpeg
 * - Rebuilds hdlr using Framesmith's box builder
 * - Asserts byte-for-byte equality
 *
 * If this test passes, Framesmith's hdlr implementation
 * exactly matches real-world encoder output.
 */
export async function testHdlr_Conformance() {
    console.log("=== testHdlr_Conformance (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Extract reference hdlr
    // ------------------------------------------------------------
    const refHdlr = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "hdlr"]
    );

    if (!refHdlr) {
        throw new Error("FAIL: reference hdlr box not found");
    }

    // ------------------------------------------------------------
    // 3. Build Framesmith hdlr
    // ------------------------------------------------------------
    const outHdlr = serializeBoxTree(buildHdlrBox());

    // ------------------------------------------------------------
    // 4. Parse both
    // ------------------------------------------------------------
    const ref = parseHdlr(refHdlr);
    const out = parseHdlr(outHdlr);

    // ------------------------------------------------------------
    // 5. Field-level conformance
    // ------------------------------------------------------------
    assertEqual("hdlr.type",        out.type,        "hdlr");
    assertEqual("hdlr.version",     out.version,     ref.version);
    assertEqual("hdlr.flags",       out.flags,       ref.flags);
    assertEqual("hdlr.pre_defined", out.preDefined,  ref.preDefined);
    assertEqual("hdlr.handlerType", out.handlerType, ref.handlerType);

    for (let i = 0; i < 3; i++) {
        assertEqual(
            `hdlr.reserved[${i}]`,
            out.reserved[i],
            ref.reserved[i]
        );
    }

    assertEqual(
        "hdlr.name",
        out.name,
        ref.name
    );

    // ------------------------------------------------------------
    // 6. Byte-for-byte conformance
    // ------------------------------------------------------------
    assertEqual(
        "hdlr.size",
        out.raw.length,
        ref.raw.length
    );

    for (let i = 0; i < ref.raw.length; i++) {
        assertEqual(
            `hdlr.byte[${i}]`,
            out.raw[i],
            ref.raw[i]
        );
    }

    console.log("PASS: hdlr matches golden MP4 byte-for-byte");
}


function parseHdlr(box) {
    const size = readUint32FromMp4BoxBytes(box, 0);
    const type = readBoxTypeFromMp4BoxBytes(box, 4);

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const preDefined = readUint32FromMp4BoxBytes(box, 12);

    const handlerType = String.fromCharCode(
        box[16],
        box[17],
        box[18],
        box[19]
    );

    const reserved = [
        readUint32FromMp4BoxBytes(box, 20),
        readUint32FromMp4BoxBytes(box, 24),
        readUint32FromMp4BoxBytes(box, 28)
    ];

    const nameBytes = box.slice(32);
    const nullTerminated =
        nameBytes.length > 0 &&
        nameBytes[nameBytes.length - 1] === 0;

    const name = nullTerminated
        ? new TextDecoder().decode(nameBytes.slice(0, -1))
        : null;

    return {
        size,
        type,
        version,
        flags,
        preDefined,
        handlerType,
        reserved,
        name,
        raw: box
    };
}
