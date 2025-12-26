import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual, assertEqualHex } from "./assertions.js";

/**
 * HDLR — Structural Contract
 */
export function testHdlr_Structure() {
    console.log("=== testHdlr_Structure ===");

    const node = emitHdlrBox({
        handlerType: "vide",
        nameBytes: new TextEncoder().encode("VideoHandler\0")
    });

    const box = serializeBoxTree(node);

    // size
    assertEqual("hdlr.size", readUint32(box, 0), box.length);

    // type
    assertEqual("hdlr.type", readFourCC(box, 4), "hdlr");

    // version + flags
    assertEqual("hdlr.version", box[8], 0);
    assertEqual(
        "hdlr.flags",
        (box[9] << 16) | (box[10] << 8) | box[11],
        0
    );

    // pre_defined
    assertEqual("hdlr.pre_defined", readUint32(box, 12), 0);

    // handler_type
    assertEqual("hdlr.handler_type", readFourCC(box, 16), "vide");

    // reserved
    assertEqual("hdlr.reserved[0]", readUint32(box, 20), 0);
    assertEqual("hdlr.reserved[1]", readUint32(box, 24), 0);
    assertEqual("hdlr.reserved[2]", readUint32(box, 28), 0);

    // name
    const nameBytes = box.slice(32);
    assertEqual("hdlr.name.null", nameBytes[nameBytes.length - 1], 0);
    assertEqual(
        "hdlr.name.value",
        new TextDecoder().decode(nameBytes.slice(0, -1)),
        "VideoHandler"
    );

    console.log("PASS: hdlr structural contract is correct");
}

/**
 * HDLR — Locked Layout (track-level)
 */
export async function testHdlr_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testHdlr_LockedLayoutEquivalence_ffmpeg (mdia) ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth (single source of truth)
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/hdlr"
    );

    const refFields = truth.readFields();
    const builderInput = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild hdlr strictly from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitHdlrBox(builderInput)
    );

    // ---------------------------------------------------------
    // 4. Locked-layout equivalence
    // ---------------------------------------------------------
    assertHdlrFieldEquality(
        "track",
        refFields.raw,
        out
    );

    console.log("PASS: track-level hdlr locked-layout equivalence");
}


/**
 * Field-by-field, byte-anchored equality.
 * No inference. No shifting. No forgiveness.
 */
function assertHdlrFieldEquality(scope, ref, out) {

    // size
    assertEqual(
        `${scope}.hdlr.size`,
        readUint32(out, 0),
        readUint32(ref, 0)
    );

    // type
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.type.byte[${i}]`,
            out[4 + i],
            ref[4 + i]
        );
    }

    // version
    assertEqual(
        `${scope}.hdlr.version`,
        out[8],
        ref[8]
    );

    // flags
    for (let i = 0; i < 3; i++) {
        assertEqualHex(
            `${scope}.hdlr.flags.byte[${i}]`,
            out[9 + i],
            ref[9 + i]
        );
    }

    // pre_defined
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.pre_defined.byte[${i}]`,
            out[12 + i],
            ref[12 + i]
        );
    }

    // handler_type
    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.handler_type.byte[${i}]`,
            out[16 + i],
            ref[16 + i]
        );
    }

    // reserved (absolute, fixed offsets)
    for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 4; i++) {
            assertEqualHex(
                `${scope}.hdlr.reserved[${r}].byte[${i}]`,
                out[20 + r * 4 + i],
                ref[20 + r * 4 + i]
            );
        }
    }

    // name bytes (exact span)
    const refSize = readUint32(ref, 0);
    const nameStart = 32;
    const nameLen = refSize - nameStart;

    for (let i = 0; i < nameLen; i++) {
        assertEqualHex(
            `${scope}.hdlr.name.byte[${i}]`,
            out[nameStart + i],
            ref[nameStart + i]
        );
    }

    // final guard
    assertEqual(
        `${scope}.hdlr.total.size`,
        out.length,
        ref.length
    );
}
