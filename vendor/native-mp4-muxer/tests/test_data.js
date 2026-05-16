import { emitDataBox } from "../box-emitters/dataBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, } from "../bytes/mp4ByteReader.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

/**
 * DATA — Structural Correctness (Phase A)
 */
export function testData_Structure() {

    const version  = 0;
    const flags    = 0;
    const dataType = 1;
    const locale   = 0;

    const payload = new Uint8Array([
        0x4c, 0x61, 0x76, 0x66,
        0x36, 0x31, 0x2e, 0x37,
        0x2e, 0x31, 0x30, 0x30
    ]);

    const node = emitDataBox({
        version,
        flags,
        dataType,
        locale,
        payload
    });

    assertEqual("data.type", node.type, "data");
    assertEqual("data.version", node.version, 0);
    assertEqual("data.flags", node.flags, 0);

    assertExists("data.body", node.body);
    assertEqual("data.body.length", node.body.length, 3);

    assertEqual("data.body[0].int", node.body[0].int, dataType);
    assertEqual("data.body[1].int", node.body[1].int, locale);

    assertEqual("data.body[2].array", node.body[2].array, "byte");
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

    const out = serializeBoxTree(node);
    assertExists("serialized data box", out);
}

/**
 * DATA — Locked Layout Equivalence (ffmpeg)
 */
export async function testData_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve ilst SEMANTICALLY
    // ---------------------------------------------------------
    const ilstTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/ilst"
        );

    const ilstReport = ilstTruth.readBoxReport();
    const ilstRaw    = ilstReport.raw;

    assertExists("reference ilst raw", ilstRaw);

    // ---------------------------------------------------------
    // Extract first ilst item atom (raw)
    // ---------------------------------------------------------
    const item = extractFirstIlstItem(ilstRaw);
    assertExists("ilst item atom", item);

    // ---------------------------------------------------------
    // Extract reference data box
    // ---------------------------------------------------------
    const refData = extractChildBox(item, "data");
    assertExists("reference data box", refData);

    // ---------------------------------------------------------
    // Golden truth DATA
    // ---------------------------------------------------------
    const extractor = GoldenTruthRegistry.getExtractor(
            "moov/udta/meta/ilst/©too/data",
        );
    const params = extractor.getEmitterInput(refData);

    assertEqual(
        "data.payload.length",
        params.payload.length,
        refData.length - 20
    );

    // ---------------------------------------------------------
    // Rebuild DATA box
    // ---------------------------------------------------------
    const node = emitDataBox(params);
    const outData = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Field-level equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < 4; i++) {
        assertEqualHex(`data.size.byte[${i}]`, outData[i], refData[i]);
        assertEqualHex(`data.type.byte[${i}]`, outData[4 + i], refData[4 + i]);
    }

    assertEqualHex("data.version.byte", outData[8], refData[8]);
    assertEqualHex("data.flags.byte[0]", outData[9],  refData[9]);
    assertEqualHex("data.flags.byte[1]", outData[10], refData[10]);
    assertEqualHex("data.flags.byte[2]", outData[11], refData[11]);

    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `data.dataType.byte[${i}]`,
            outData[12 + i],
            refData[12 + i]
        );
        assertEqualHex(
            `data.locale.byte[${i}]`,
            outData[16 + i],
            refData[16 + i]
        );
    }

    for (let i = 0; i < params.payload.length; i++) {
        assertEqualHex(
            `data.payload.byte[${i}]`,
            outData[20 + i],
            refData[20 + i]
        );
    }

    assertEqual("data.size", outData.length, refData.length);

    for (let i = 0; i < refData.length; i++) {
        assertEqualHex(`data.byte[${i}]`, outData[i], refData[i]);
    }
}

/**
 * Extract first ilst item atom (raw bytes)
 */
function extractFirstIlstItem(ilstBytes) {

    let offset = 8;

    if (offset + 8 > ilstBytes.length) {
        throw new Error("ilst contains no item atoms");
    }

    const size = readUint32(ilstBytes, offset);
    return ilstBytes.slice(offset, offset + size);
}

/**
 * Extract child box from ilst item atom
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
