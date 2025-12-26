import { emitDataBox } from "../box-emitters/dataBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4
} from "./reference/BoxExtractor.js";

import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * DATA — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates the structural intent of the `data` box.
 *
 * This test does NOT:
 *   - interpret payload meaning
 *   - assume text encoding
 *   - depend on ffmpeg
 *
 * It asserts ONLY:
 *   - FullBox fields are present
 *   - body field ordering is correct
 *   - payload bytes are preserved verbatim
 */
export function testData_Structure() {

    console.log("=== testData_Structure ===");

    // ---------------------------------------------------------
    // 1. Test inputs (explicit, deterministic)
    // ---------------------------------------------------------
    const version = 0;
    const flags   = 0;
    const dataType = 1;
    const locale   = 0;

    const payload = new Uint8Array([
        0x4c, 0x61, 0x76, 0x66,
        0x36, 0x31, 0x2e, 0x37,
        0x2e, 0x31, 0x30, 0x30
    ]);

    // ---------------------------------------------------------
    // 2. Build DATA box
    // ---------------------------------------------------------
    const node = emitDataBox({
        version,
        flags,
        dataType,
        locale,
        payload
    });

    // ---------------------------------------------------------
    // 3. Structural assertions (JSON node)
    // ---------------------------------------------------------
    assertEqual("data.type", node.type, "data");
    assertEqual("data.version", node.version, 0);
    assertEqual("data.flags", node.flags, 0);

    assertExists("data.body", node.body);
    assertEqual("data.body.length", node.body.length, 3);

    assertEqual("data.body[0].int", node.body[0].int, dataType);
    assertEqual("data.body[1].int", node.body[1].int, locale);

    assertEqual("data.body[2].array", node.body[2].array, "byte");
    assertExists("data.body[2].values", node.body[2].values);

    assertEqual(
        "data.body[2].values.length",
        node.body[2].values.length,
        payload.length
    );

    for (let i = 0; i < payload.length; i++) {
        assertEqual(
            `data.body[2].values[${i}]`,
            node.body[2].values[i],
            payload[i]
        );
    }

    // ---------------------------------------------------------
    // 4. Serialization sanity check
    // ---------------------------------------------------------
    const out = serializeBoxTree(node);
    assertExists("serialized data box", out);

    console.log("PASS: DATA structural correctness");
}

/**
 * DATA — Locked Layout Equivalence (ffmpeg)
 *
 * Validates byte-for-byte equivalence of a DATA box
 * when embedded inside an ilst item atom.
 *
 * IMPORTANT:
 * - ilst is NOT a container
 * - item atoms are parsed manually
 * - data itself IS a real MP4 box
 */
export async function testData_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testData_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract ilst
    // ---------------------------------------------------------
    const ilst = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta/ilst"
    );
    assertExists("reference ilst", ilst);

    // ---------------------------------------------------------
    // 3. Extract first item atom
    // ---------------------------------------------------------
    const item = extractFirstIlstItem(ilst);
    assertExists("ilst item atom", item);

    // ---------------------------------------------------------
    // 4. Extract reference data box
    // ---------------------------------------------------------
    const refData = extractChildBox(item, "data");
    assertExists("reference data box", refData);

    // ---------------------------------------------------------
    // 5. Read golden truth DATA
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        refData,
        "moov/udta/meta/ilst/*/data"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 5a. Golden truth sanity (OPTIONAL DIAGNOSTIC)
    // ---------------------------------------------------------
    assertEqual(
        "data.payload.length",
        params.payload.length,
        refData.length - 20
    );

    // ---------------------------------------------------------
    // 6. Build DATA box exclusively from golden truth
    // ---------------------------------------------------------
    const node = emitDataBox(params);

    // ---------------------------------------------------------
    // 7. Serialize
    // ---------------------------------------------------------
    const outData = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 8. FIELD-LEVEL BYTE EQUIVALENCE (DIAGNOSTIC LAYER)
    // ---------------------------------------------------------

    // size (u32)
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `data.size.byte[${i}]`,
            outData[i],
            refData[i]
        );
    }

    // type "data"
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `data.type.byte[${i}]`,
            outData[4 + i],
            refData[4 + i]
        );
    }

    // version (u8)
    assertEqualHex(
        "data.version.byte",
        outData[8],
        refData[8]
    );

    // flags (u24)
    assertEqualHex("data.flags.byte[0]", outData[9],  refData[9]);
    assertEqualHex("data.flags.byte[1]", outData[10], refData[10]);
    assertEqualHex("data.flags.byte[2]", outData[11], refData[11]);

    // dataType (u32)
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `data.dataType.byte[${i}]`,
            outData[12 + i],
            refData[12 + i]
        );
    }

    // locale (u32)
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `data.locale.byte[${i}]`,
            outData[16 + i],
            refData[16 + i]
        );
    }

    // payload (opaque bytes)
    const payload = params.payload;

    for (let i = 0; i < payload.length; i++) {
        assertEqualHex(
            `data.payload.byte[${i}]`,
            outData[20 + i],
            refData[20 + i]
        );
    }

    // ---------------------------------------------------------
    // 9. BYTE-FOR-BYTE SAFETY NET (NOW UNREACHABLE ON SEMANTIC FAIL)
    // ---------------------------------------------------------
    assertEqual("data.size", outData.length, refData.length);

    for (let i = 0; i < refData.length; i++) {
        assertEqualHex(
            `data.byte[${i}]`,
            outData[i],
            refData[i]
        );
    }

    console.log("PASS: DATA locked-layout equivalence with ffmpeg");
}

/**
 * Extracts the first item atom from an ilst box.
 *
 * ilst layout:
 *   size (4)
 *   type (4)
 *   item atoms...
 */
function extractFirstIlstItem(ilstBytes) {

    const ilstSize = readUint32(ilstBytes, 0);

    let offset = 8;

    if (offset + 8 > ilstSize) {
        throw new Error("ilst contains no item atoms");
    }

    const size = readUint32(ilstBytes, offset);
    const type = readFourCC(ilstBytes, offset + 4);

    return ilstBytes.slice(offset, offset + size);
}

/**
 * Extracts a child MP4 box from a raw box payload
 * without using asContainer.
 *
 * Used for ilst item atoms only.
 */
function extractChildBox(parentBytes, fourcc) {

    let offset = 8;

    while (offset + 8 <= parentBytes.length) {

        const size = readUint32(parentBytes, offset);
        const type = readFourCC(parentBytes, offset + 4);

        if (type === fourcc) {
            return parentBytes.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(`FAIL: child box '${fourcc}' not found`);
}
