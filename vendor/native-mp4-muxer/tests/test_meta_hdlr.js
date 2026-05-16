import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { readUint32 } from "../bytes/mp4ByteReader.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * META > HDLR — Structural Correctness (Phase A)
 *
 * JSON-level structural intent only.
 * No serialization.
 */
export function testMetaHdlr_Structure() {

    const node =
        EmitterRegistry.emit(
            "moov/udta/meta/hdlr",
            {
                nameBytes: new Uint8Array([
                    0x61, 0x70, 0x70, 0x6c, // "appl"
                    0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00,
                    0x00
                ])
            }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("hdlr.type", node.type, "hdlr");
    assertEqual("hdlr.version", node.version, 0);
    assertEqual("hdlr.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body structure
    // ---------------------------------------------------------
    assertExists("hdlr.body", node.body);
    assertEqual("hdlr.body.length", node.body.length, 3);

    // zero padding
    assertEqual("hdlr.zeroPadding", node.body[0].int, 0);

    // handler type
    assertEqual("hdlr.handlerType", node.body[1].type, "mdir");

    // name bytes
    assertEqual("hdlr.name.array", node.body[2].array, "byte");
    assertExists("hdlr.name.values", node.body[2].values);
}

/**
 * META > HDLR — Locked Layout Equivalence (ffmpeg)
 *
 * Byte-for-byte safety net.
 */
export async function testMetaHdlr_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Resolve semantic hdlr
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/hdlr"
        );

    const read   = truth.readBoxReport();
    const params = truth.getEmitterInput();
    const refRaw = read.raw;

    // ---------------------------------------------------------
    // 3. Rebuild via registry
    // ---------------------------------------------------------
    const out =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/udta/meta/hdlr",
                params
            )
        );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual("hdlr.size", out.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `hdlr.byte[${i}]`,
            out[i],
            refRaw[i]
        );
    }
}
