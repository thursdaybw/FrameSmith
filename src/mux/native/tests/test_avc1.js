import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint16, readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

/**
 * avcC — Opaque Codec Configuration Box
 * ====================================
 *
 * This test suite enforces the contract defined by:
 *
 *   emitAvcCBox (see stsdBox/avcCBox.js)
 *
 * avcC is a codec-owned configuration box whose payload
 * is opaque to the MP4 container.
 *
 * Test focus:
 * -----------
 * - byte-for-byte payload preservation
 * - correct box framing
 * - zero semantic interference
 *
 * These tests do NOT validate codec semantics.
 * They prove that the muxer does not corrupt
 * data it does not own.
 *
 * Related boxes:
 * --------------
 * - esds (audio)
 */
export async function testAvc1_Structure() {

    const width  = 1920;
    const height = 1080;
    const avcC   = Uint8Array.from([1, 2, 3, 4]); // minimal dummy payload

    // -------------------------------------------------------------
    // 1. Build synthetic avc1 via registry
    // -------------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|avc1",
            {
                width,
                height,
                avcC,
                btrt: {
                    bufferSizeDB: 0,
                    maxBitrate:   0,
                    avgBitrate:   0
                }
            }
        );

    // -------------------------------------------------------------
    // 2. Box identity
    // -------------------------------------------------------------
    assertEqual("avc1.type", node.type, "avc1");

    const body = node.body;

    // -------------------------------------------------------------
    // 3. Reserved (6 bytes)
    // -------------------------------------------------------------
    for (let i = 0; i < 6; i++) {
        assertEqual(
            `avc1.reserved[${i}]`,
            body[i].byte,
            0
        );
    }

    // -------------------------------------------------------------
    // 4. data_reference_index
    // -------------------------------------------------------------
    assertEqual(
        "avc1.data_reference_index",
        body[6].short,
        1
    );

    // -------------------------------------------------------------
    // 5. pre_defined / reserved block
    // -------------------------------------------------------------
    assertEqual("avc1.preDefined1", body[7].short, 0);
    assertEqual("avc1.reserved6",   body[8].short, 0);

    assertEqual("avc1.preDefined2", body[9].int,  0);
    assertEqual("avc1.preDefined3", body[10].int, 0);
    assertEqual("avc1.preDefined4", body[11].int, 0);

    // -------------------------------------------------------------
    // 6. width / height
    // -------------------------------------------------------------
    assertEqual("avc1.width",  body[12].short, width);
    assertEqual("avc1.height", body[13].short, height);

    // -------------------------------------------------------------
    // 7. resolution
    // -------------------------------------------------------------
    const expectedRes = 0x00480000;

    assertEqualHex(
        "avc1.horizresolution",
        body[14].int,
        expectedRes
    );

    assertEqualHex(
        "avc1.vertresolution",
        body[15].int,
        expectedRes
    );

    // -------------------------------------------------------------
    // 8. reserved
    // -------------------------------------------------------------
    assertEqual(
        "avc1.reserved7",
        body[16].int,
        0
    );

    // -------------------------------------------------------------
    // 9. frame_count
    // -------------------------------------------------------------
    assertEqual(
        "avc1.frame_count",
        body[17].short,
        1
    );

    // -------------------------------------------------------------
    // 10. compressorname structure
    // -------------------------------------------------------------
    const nameLenField  = body[18];
    const nameArrayField = body[19];

    assertEqual(
        "avc1.compressorname_length_valid",
        typeof nameLenField.byte === "number" &&
        nameLenField.byte >= 0 &&
        nameLenField.byte <= 31,
        true
    );

    assertEqual(
        "avc1.compressorname_array_present",
        nameArrayField.array,
        "byte"
    );

    assertEqual(
        "avc1.compressorname_array_length",
        nameArrayField.values.length,
        31
    );

    const used = nameLenField.byte;

    for (let i = used; i < 31; i++) {
        assertEqual(
            `avc1.compressorname_padding[${i}]`,
            nameArrayField.values[i],
            0
        );
    }

    // -------------------------------------------------------------
    // 11. depth
    // -------------------------------------------------------------
    assertEqualHex(
        "avc1.depth",
        body[20].short,
        0x0018
    );

    // -------------------------------------------------------------
    // 12. pre_defined (-1)
    // -------------------------------------------------------------
    assertEqualHex(
        "avc1.pre_defined_minus_one",
        body[21].short,
        0xffff
    );
    // -------------------------------------------------------------
    // 13. Must contain avcC (structural child)
    // -------------------------------------------------------------
    const avcCNode =
        node.children.find(child => child.type === "avcC");

    assertEqual(
        "avc1.avcC.present",
        avcCNode !== undefined,
        true
    );

    const payload = avcCNode.body[0].values;

    assertEqual(
        "avc1.avcC.length",
        payload.length,
        avcC.length
    );

    for (let i = 0; i < avcC.length; i++) {
        assertEqual(
            `avc1.avcC.byte[${i}]`,
            payload[i],
            avcC[i]
        );
    }
}

export async function testAvc1_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg() {

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Parse reference avc1 via registry (single source of truth)
    // -------------------------------------------------------------
    const refParsed = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    );

    const ref         = refParsed.readBoxReport();
    const buildParams = refParsed.getEmitterInput();
    const refRaw      = ref.raw;

    // -------------------------------------------------------------
    // 3. Rebuild avc1 strictly from declared metadata
    // -------------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|avc1",
            buildParams
        )
    );

    // -------------------------------------------------------------
    // 4. Re-parse rebuilt avc1 via same parser
    // -------------------------------------------------------------
    const extractor = GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl/stsd|avc1",
        );
    const out = extractor.readBoxReport(outBytes);


    // -------------------------------------------------------------
    // 5. Declared metadata equivalence (box)
    // -------------------------------------------------------------
    assertEqual("avc1.width",  out.box.width,  ref.box.width);
    assertEqual("avc1.height", out.box.height, ref.box.height);

    assertEqual(
        "avc1.compressorName",
        out.box.compressorName,
        ref.box.compressorName
    );

    assertEqual(
        "avc1.btrt.bufferSize",
        out.box.children.btrt.bufferSizeDB,
        ref.box.children.btrt.bufferSizeDB
    );

    assertEqual(
        "avc1.btrt.maxBitrate",
        out.box.children.btrt.maxBitrate,
        ref.box.children.btrt.maxBitrate
    );

    assertEqual(
        "avc1.btrt.avgBitrate",
        out.box.children.btrt.avgBitrate,
        ref.box.children.btrt.avgBitrate
    );

    // -------------------------------------------------------------
    // 6. Opaque payload preservation (derived)
    // -------------------------------------------------------------
    assertEqual(
        "avc1.avcC.length",
        out.derived.avcC.length,
        ref.derived.avcC.length
    );

    for (let i = 0; i < ref.derived.avcC.length; i++) {
        assertEqual(
            `avc1.avcC.byte[${i}]`,
            out.derived.avcC[i],
            ref.derived.avcC[i]
        );
    }

    // -------------------------------------------------------------
    // 7. Absolute locked-layout equivalence (raw)
    // -------------------------------------------------------------
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
}
