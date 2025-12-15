import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildAvcCBox } from "../boxes/stsdBox/avcCBox.js";
import { readUint32FromMp4BoxBytes, readBoxTypeFromMp4BoxBytes } from "./testUtils.js";
import {
    extractBoxByPath,
    extractSampleEntry,
    extractChildBoxFromSampleEntry
} from "./reference/BoxExtractor.js";
import { assertEqual } from "./assertions.js";

/**
 * avcC Structural (Granular) Test
 * --------------------------------
 *
 * Purpose:
 * --------
 * This test verifies the *structural correctness* of the avcC box
 * produced by buildAvcCBox(), independent of any real MP4 file.
 *
 * It answers the question:
 *
 *   "Given a valid AVCDecoderConfigurationRecord payload, do we
 *    serialize an avcC box correctly, byte-for-byte, without
 *    interpreting or mutating the payload?"
 *
 * What this test asserts:
 * -----------------------
 * - The total box size is correct (size field + payload length)
 * - The size field written into the box header is correct
 * - The FourCC type is exactly "avcC"
 * - The payload bytes are copied verbatim and in order
 * - The input buffer is not mutated
 *
 * What this test deliberately does NOT assert:
 * --------------------------------------------
 * - It does not validate the semantic correctness of the payload
 * - It does not parse or understand SPS/PPS contents
 * - It does not depend on ffmpeg, MP4 files, or container structure
 *
 * Why this test exists:
 * ---------------------
 * This test isolates the avcC box as a pure data container.
 * Failures here indicate mistakes in serialization logic,
 * sizing, copying, or mutation — not MP4 structure or codec layout.
 *
 * When this test fails, the error message should point directly
 * to the broken assumption or field.
 */
export async function testAvcC_Structure() {
    console.log("=== AvcC Granular tests ===");

    const avcCInput = Uint8Array.from([
        1, 100, 0, 31,
        0xFF, 0xE1,
        0x00, 0x10,
        9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,
        1,
        0x00, 0x04,
        7,7,7,7
    ]);

    const node = buildAvcCBox({ avcC: avcCInput });
    const box  = serializeBoxTree(node);

    const expectedSize = 8 + avcCInput.length;

    assertEqual(
        "avcC.size",
        box.length,
        expectedSize
    );

    assertEqual(
        "avcC.size_field",
        readUint32FromMp4BoxBytes(box, 0),
        box.length
    );

    assertEqual(
        "avcC.type",
        readBoxTypeFromMp4BoxBytes(box, 4),
        "avcC"
    );

    for (let i = 0; i < avcCInput.length; i++) {
        assertEqual(
            `avcC.payload[${i}]`,
            box[8 + i],
            avcCInput[i]
        );
    }

    // Defensive immutability check
    assertEqual(
        "avcC.input_not_mutated",
        avcCInput[0],
        1
    );

    console.log("PASS: avcC granular tests");
}


export async function testAvcC_Conformance() {
    console.log("=== testAvcC (Golden MP4 conformance) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const stsdBox = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsd"]
    );

    const avc1Box = extractSampleEntry(stsdBox, "avc1");
    const refBox  = extractChildBoxFromSampleEntry(avc1Box, "avcC");

    const refPayload = refBox.slice(8);

    const out = serializeBoxTree(
        buildAvcCBox({ avcC: refPayload })
    );

    assertEqual(
        "avcC.size",
        out.length,
        refBox.length
    );

    for (let i = 0; i < refBox.length; i++) {
        assertEqual(
            `avcC.byte[${i}]`,
            out[i],
            refBox[i]
        );
    }

    console.log("PASS: avcC matches golden MP4");
}
