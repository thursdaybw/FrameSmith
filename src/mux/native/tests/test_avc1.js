import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitAvc1Box } from "../box-emitters/stsdBox/avc1Box.js";
import { readUint16, readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testAvc1_Structure() {
    console.log("=== testAvc1_Structure ===");

    const width  = 1920;
    const height = 1080;
    const avcC   = Uint8Array.from([1, 2, 3, 4]); // minimal dummy payload

    // -------------------------------------------------------------
    // 1. Build synthetic avc1
    // -------------------------------------------------------------
    const node = emitAvc1Box({
        width,
        height,
        avcC,
        btrt: {
            bufferSizeDB: 0,
            maxBitrate:   0,
            avgBitrate:   0
        }
    });

    const avc1 = serializeBoxTree(node);

    // -------------------------------------------------------------
    // 2. Box header
    // -------------------------------------------------------------
    assertEqual(
        "avc1.size",
        readUint32(avc1, 0),
        avc1.length
    );

    assertEqual(
        "avc1.type",
        readFourCC(avc1, 4),
        "avc1"
    );

    // -------------------------------------------------------------
    // 3. Reserved (6 bytes)
    // -------------------------------------------------------------
    for (let i = 8; i < 14; i++) {
        assertEqual(
            `avc1.reserved[${i - 8}]`,
            avc1[i],
            0
        );
    }

    // -------------------------------------------------------------
    // 4. data_reference_index
    // -------------------------------------------------------------
    assertEqual(
        "avc1.data_reference_index",
        readUint16(avc1, 14),
        1
    );

    // -------------------------------------------------------------
    // 5. pre_defined / reserved block
    // -------------------------------------------------------------
    for (let off = 16; off < 16 + 2 + 2 + 12; off++) {
        assertEqual(
            `avc1.visual_reserved@${off}`,
            avc1[off],
            0
        );
    }

    // -------------------------------------------------------------
    // 6. width / height
    // -------------------------------------------------------------
    assertEqual(
        "avc1.width",
        readUint16(avc1, 32),
        width
    );

    assertEqual(
        "avc1.height",
        readUint16(avc1, 34),
        height
    );

    // -------------------------------------------------------------
    // 7. resolution
    // -------------------------------------------------------------
    const expectedRes = 0x00480000;

    assertEqualHex(
        "avc1.horizresolution",
        readUint32(avc1, 36),
        expectedRes
    );

    assertEqualHex(
        "avc1.vertresolution",
        readUint32(avc1, 40),
        expectedRes
    );

    // -------------------------------------------------------------
    // 8. reserved
    // -------------------------------------------------------------
    assertEqual(
        "avc1.reserved_44",
        readUint32(avc1, 44),
        0
    );

    // -------------------------------------------------------------
    // 9. frame_count
    // -------------------------------------------------------------
    assertEqual(
        "avc1.frame_count",
        readUint16(avc1, 48),
        1
    );

    // -------------------------------------------------------------
    // 10. compressorname padding
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // 11. depth
    // -------------------------------------------------------------
    assertEqualHex(
        "avc1.depth",
        readUint16(avc1, 82),
        0x0018
    );

    // -------------------------------------------------------------
    // 12. pre_defined (-1)
    // -------------------------------------------------------------
    assertEqualHex(
        "avc1.pre_defined_minus_one",
        readUint16(avc1, 84),
        0xffff
    );

    // -------------------------------------------------------------
    // 13. Must contain avcC (parser-owned knowledge)
    // -------------------------------------------------------------
    const parsed = getGoldenTruthBox.fromBox(
        avc1,
        "moov/trak/mdia/minf/stbl/stsd/avc1"
    );

    const fields = parsed.readFields();

    assertEqual(
        "avc1.avcC.present",
        fields.avcC instanceof Uint8Array,
        true
    );

    assertEqual(
        "avc1.avcC.length",
        fields.avcC.length,
        avcC.length
    );

    for (let i = 0; i < avcC.length; i++) {
        assertEqual(
            `avc1.avcC.byte[${i}]`,
            fields.avcC[i],
            avcC[i]
        );
    }

    console.log("PASS: avc1 structural correctness");
}

export async function testAvc1_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg() {
    console.log(
        "=== testAvc1_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg ==="
    );

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Parse reference avc1 via registry (single source of truth)
    // -------------------------------------------------------------
    const refParsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        { sampleEntry: "avc1" }
    );

    const refFields = refParsed.readFields();
    const buildParams = refParsed.getBuilderInput();

    // -------------------------------------------------------------
    // 3. Rebuild avc1 strictly from declared metadata
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitAvc1Box(buildParams)
    );

    // -------------------------------------------------------------
    // 4. Re-parse rebuilt avc1 via same parser
    // -------------------------------------------------------------
    const outParsed = getGoldenTruthBox.fromBox(
        outBytes,
        "moov/trak/mdia/minf/stbl/stsd/avc1"
    );

    const outFields = outParsed.readFields();

    // -------------------------------------------------------------
    // 5. Declared metadata equivalence
    // -------------------------------------------------------------
    assertEqual("avc1.width",  outFields.width,  refFields.width);
    assertEqual("avc1.height", outFields.height, refFields.height);

    assertEqual(
        "avc1.compressorName",
        outFields.compressorName,
        refFields.compressorName
    );

    assertEqual(
        "avc1.btrt.bufferSize",
        outFields.btrt.bufferSizeDB,
        refFields.btrt.bufferSizeDB
    );

    assertEqual(
        "avc1.btrt.maxBitrate",
        outFields.btrt.maxBitrate,
        refFields.btrt.maxBitrate
    );

    assertEqual(
        "avc1.btrt.avgBitrate",
        outFields.btrt.avgBitrate,
        refFields.btrt.avgBitrate
    );

    // -------------------------------------------------------------
    // 6. Opaque payload preservation (avcC)
    // -------------------------------------------------------------
    assertEqual(
        "avc1.avcC.length",
        outFields.avcC.length,
        refFields.avcC.length
    );

    for (let i = 0; i < refFields.avcC.length; i++) {
        assertEqual(
            `avc1.avcC.byte[${i}]`,
            outFields.avcC[i],
            refFields.avcC[i]
        );
    }

    // -------------------------------------------------------------
    // 7. Absolute locked-layout equivalence
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "avc1.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `avc1.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log(
        "PASS: avc1 declared metadata matches golden MP4 byte-for-byte"
    );
}
