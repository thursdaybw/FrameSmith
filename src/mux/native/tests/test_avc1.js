import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { buildAvc1Box } from "../boxes/stsdBox/avc1Box.js";
import {
    readUint32FromMp4BoxBytes,
    readUint16FromMp4BoxBytes,
    readBoxTypeFromMp4BoxBytes
} from "./testUtils.js";

import {
    extractBoxByPath,
    extractSampleEntry,
    extractChildBoxFromSampleEntry
} from "./reference/BoxExtractor.js";

import { SampleEntryReader } from "./reference/SampleEntryReader.js";

export async function testAvc1_Structure() {
    console.log("=== testAvc1 ===");

    const width  = 1920;
    const height = 1080;
    const avcC   = Uint8Array.from([1, 2, 3, 4]); // minimal dummy

    const node = buildAvc1Box({
        width,
        height,
        avcC,
        btrt: {
            bufferSize: 0,
            maxBitrate: 0,
            avgBitrate: 0
        }
    });

    const avc1 = serializeBoxTree(node);

    //
    // ---- SAFETY: box header ----
    //
    assertEqual(
        "avc1.size",
        readUint32FromMp4BoxBytes(avc1, 0),
        avc1.length
    );

    assertEqual(
        "avc1.type",
        readBoxTypeFromMp4BoxBytes(avc1, 4),
        "avc1"
    );

    //
    // ---- FIELD 1: reserved(6 bytes) ----
    //
    for (let i = 8; i < 14; i++) {
        assertEqual(
            `avc1.reserved[${i - 8}]`,
            avc1[i],
            0
        );
    }

    //
    // ---- FIELD 2: data_reference_index ----
    //
    assertEqual(
        "avc1.data_reference_index",
        readUint16FromMp4BoxBytes(avc1, 14),
        1
    );

    //
    // ---- FIELD 3: pre_defined / reserved ----
    //
    for (let off = 16; off < 16 + 2 + 2 + 12; off++) {
        assertEqual(
            `avc1.visual_reserved@${off}`,
            avc1[off],
            0
        );
    }

    //
    // ---- FIELD 4: width / height ----
    //
    assertEqual(
        "avc1.width",
        readUint16FromMp4BoxBytes(avc1, 32),
        width
    );

    assertEqual(
        "avc1.height",
        readUint16FromMp4BoxBytes(avc1, 34),
        height
    );

    //
    // ---- FIELD 5: resolution ----
    //
    const expectedRes = 0x00480000;

    assertEqualHex(
        "avc1.horizresolution",
        readUint32FromMp4BoxBytes(avc1, 36),
        expectedRes
    );

    assertEqualHex(
        "avc1.vertresolution",
        readUint32FromMp4BoxBytes(avc1, 40),
        expectedRes
    );

    //
    // ---- FIELD 6: reserved ----
    //
    assertEqual(
        "avc1.reserved_44",
        readUint32FromMp4BoxBytes(avc1, 44),
        0
    );

    //
    // ---- FIELD 7: frame_count ----
    //
    assertEqual(
        "avc1.frame_count",
        readUint16FromMp4BoxBytes(avc1, 48),
        1
    );

    //
    // ---- FIELD 8: compressorname ----
    //
    const nameLen = avc1[50];

    const isSentinel = nameLen === 0x80;
    const isPascal   = nameLen >= 0 && nameLen <= 31;

    assertEqual(
        "avc1.compressorname_length_valid",
        isSentinel || isPascal,
        true
    );

    const start = 51;
    const used  = isSentinel ? 0 : nameLen;

    for (let i = start + used; i < 82; i++) {
        assertEqual(
            `avc1.compressorname_padding@${i}`,
            avc1[i],
            0
        );
    }

    //
    // ---- FIELD 9: depth ----
    //
    assertEqualHex(
        "avc1.depth",
        readUint16FromMp4BoxBytes(avc1, 82),
        0x0018
    );

    //
    // ---- FIELD 10: pre_defined (-1) ----
    //
    assertEqualHex(
        "avc1.pre_defined_minus_one",
        readUint16FromMp4BoxBytes(avc1, 84),
        0xffff
    );

    //
    // ---- FIELD 11: must contain avcC ----
    //
    extractChildBoxFromSampleEntry(avc1, "avcC");

    console.log("PASS: avc1 granular tests");
}

/**
 * Phase C — avc1 Conformance (Golden MP4)
 */
export async function testAvc1_Conformance() {
    console.log("=== testAvc1_Conformance (golden MP4) ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const buf  = new Uint8Array(await resp.arrayBuffer());

    const stsd = extractBoxByPath(
        buf,
        ["moov", "trak", "mdia", "minf", "stbl", "stsd"]
    );

    const refRaw = extractSampleEntry(stsd, "avc1");
    const ref = parseAvc1(refRaw);

    const reader = new SampleEntryReader(ref.raw, 86);
    const refBtrtBox = reader.getChild("btrt");

    const refBtrtFields = {
        bufferSize: readUint32FromMp4BoxBytes(refBtrtBox, 8),
        maxBitrate: readUint32FromMp4BoxBytes(refBtrtBox, 12),
        avgBitrate: readUint32FromMp4BoxBytes(refBtrtBox, 16)
    };

    const outRaw = serializeBoxTree(
        buildAvc1Box({
            width:          ref.width,
            height:         ref.height,
            avcC:           ref.avcC,
            compressorName: ref.compressorName,
            btrt:           refBtrtFields
        })
    );

    const out = parseAvc1(outRaw);

    //
    // ---- Field-level checks ----
    //
    assertEqual("width", out.width, ref.width);
    assertEqual("height", out.height, ref.height);
    assertEqualHex("horizresolution", out.horizRes, ref.horizRes);
    assertEqualHex("vertresolution",  out.vertRes,  ref.vertRes);
    assertEqual("frame_count", out.frameCount, ref.frameCount);
    assertEqualHex("depth", out.depth, ref.depth);
    assertEqual("compressorname", out.compressorName, ref.compressorName);

    //
    // ---- Child boxes ----
    //
    const refAvcC  = extractChildBoxFromSampleEntry(ref.raw, "avcC");
    const outAvcC  = extractChildBoxFromSampleEntry(out.raw, "avcC");

    for (let i = 0; i < refAvcC.length; i++) {
        if (refAvcC[i] !== outAvcC[i]) {
            throw new Error(`FAIL: avcC byte mismatch at ${i}`);
        }
    }

    //
    // ---- Absolute byte-for-byte ----
    //
    if (out.raw.length !== ref.raw.length) {
        throw new Error(`FAIL: avc1 size mismatch`);
    }

    for (let i = 0; i < ref.raw.length; i++) {
        if (out.raw[i] !== ref.raw[i]) {
            throw new Error(`FAIL: avc1 byte mismatch at ${i}`);
        }
    }

    console.log("PASS: avc1 matches golden MP4 byte-for-byte");
}


// ---------------------------------------------------------------------------
// Helpers (ASSERTION ONLY — no extraction logic)
// ---------------------------------------------------------------------------

function parseAvc1(box) {
    return {
        width:          readUint16FromMp4BoxBytes(box, 32),
        height:         readUint16FromMp4BoxBytes(box, 34),
        horizRes:       readUint32FromMp4BoxBytes(box, 36),
        vertRes:        readUint32FromMp4BoxBytes(box, 40),
        frameCount:     readUint16FromMp4BoxBytes(box, 48),
        compressorName: readCompressorName(box),
        depth:          readUint16FromMp4BoxBytes(box, 82),
        avcC:           extractChildBoxFromSampleEntry(box, "avcC").slice(8),
        raw:            box
    };
}

// Extracts the legacy VisualSampleEntry compressorname field.
// This logic is intentionally duplicated across avc1 and stsd tests
// to make semantic equivalence explicit and easy to reason about.
function readCompressorName(box) {
    const len = box[50];
    if (len === 0) return "";
    return new TextDecoder().decode(box.slice(51, 51 + len));
}

function assertEqual(name, actual, expected) {
    if (actual !== expected) {
        throw new Error(`FAIL: avc1 ${name} mismatch`);
    }
}

function assertEqualHex(name, actual, expected) {
    if (actual !== expected) {
        throw new Error(`FAIL: avc1 ${name} mismatch`);
    }
}
