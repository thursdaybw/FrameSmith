import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { emitMetaHdlrBox } from "../box-emitters/metaHdlrBox.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * META > HDLR — Structural Correctness (Phase A)
 *
 * Ground truth from inspection:
 *
 * offset  size  meaning
 * 0       4     size = 33
 * 4       4     type = "hdlr"
 * 8       1     version = 0
 * 9       3     flags = 0
 * 12      4     zero padding
 * 16      4     handler_type = "mdir"
 * 20..32  bytes name + padding
 */
export function testMetaHdlr_Structure() {

    console.log("=== testMetaHdlr_Structure ===");

    const node = emitMetaHdlrBox({
        nameBytes: new Uint8Array([
            0x61, 0x70, 0x70, 0x6c, // "appl"
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00
        ])
    });

    const box = serializeBoxTree(node);

    // size + type
    assertEqual("hdlr.size.field", readUint32(box, 0), 33);
    assertEqual("hdlr.type", readFourCC(box, 4), "hdlr");

    // fullbox header
    assertEqual("hdlr.version", box[8], 0);
    assertEqual(
        "hdlr.flags",
        (box[9] << 16) | (box[10] << 8) | box[11],
        0
    );

    // zero padding (12..15)
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `hdlr.zero_pad.byte[${i}]`,
            box[12 + i],
            0x00
        );
    }

    // handler_type (16..19)
    assertEqual("hdlr.handler_type", readFourCC(box, 16), "mdir");

    // name + padding exists
    const nameBytes = box.slice(20);
    assertExists("hdlr.nameBytes", nameBytes);

    console.log("PASS: META hdlr structural correctness");
}


/**
 * META > HDLR — Locked Layout Equivalence (ffmpeg)
 *
 * Field-level, byte-for-byte assertions.
 */
export async function testMetaHdlr_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testMetaHdlr_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference hdlr
    // ---------------------------------------------------------
    const ref = extractBoxByPathFromMp4(
        mp4,
        "moov/udta/meta/hdlr"
    );
    assertExists("reference meta hdlr", ref);

    // ---------------------------------------------------------
    // 3. Golden truth → exact emitter input
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        ref,
        "moov/udta/meta/hdlr"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild exclusively from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitMetaHdlrBox(params)
    );

    // ---------------------------------------------------------
    // 5. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual("hdlr.size", out.length, ref.length);

    for (let i = 0; i < ref.length; i++) {
        assertEqualHex(
            `hdlr.byte[${i}]`,
            out[i],
            ref[i]
        );
    }

    console.log("PASS: META hdlr locked-layout equivalence with ffmpeg");
}
