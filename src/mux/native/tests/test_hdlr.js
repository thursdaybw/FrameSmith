import { readUint32 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * HDLR — Structural Contract
 *
 * This test asserts the STRUCTURE of the emitted HDLR node.
 *
 * - No serialization
 * - No byte reads
 * - No oracle
 * - Registry only
 */
export function testHdlr_Structure() {

    const node =
        EmitterRegistry.emit(
            "moov/udta/meta/hdlr",
            {
                handlerType: "vide",
                nameBytes: new TextEncoder().encode("VideoHandler\0")
            }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("hdlr.type", node.type, "hdlr");
    assertEqual("hdlr.version", node.version, 0);
    assertEqual("hdlr.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Payload structure
    // ---------------------------------------------------------
    assertExists("hdlr.body", node.body);
    assertEqual("hdlr.body.length", node.body.length, 3);

    // pre_defined
    assertEqual("hdlr.pre_defined.int", node.body[0].int, 0);

    // handler_type
    assertEqual("hdlr.handler_type.type", node.body[1].type, "mdir");

    // name bytes
    assertEqual("hdlr.name.array", node.body[2].array, "byte");

    const values = node.body[2].values;
    assertEqual("hdlr.name.null", values[values.length - 1], 0);

    const decoded =
        new TextDecoder().decode(
            Uint8Array.from(values.slice(0, -1))
        );

    assertEqual("hdlr.name.value", decoded, "VideoHandler");
}


/**
 * HDLR — Locked Layout (track-level)
 */
export async function testHdlr_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/hdlr"
        );

    const ref = truth.readBoxReport().raw;
    const input = truth.getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/hdlr",
                input
            )
        );

    assertHdlrFieldEquality("track", ref, out);
}

export async function testHdlr_LockedLayoutEquivalence_ffmpeg_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/hdlr"
        );

    const ref = truth.readBoxReport().raw;
    const input = truth.getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/hdlr",
                input
            )
        );

    assertHdlrFieldEquality("audio", ref, out);
}

/**
 * Field-by-field, byte-anchored equality.
 * No inference. No shifting. No forgiveness.
 */
function assertHdlrFieldEquality(scope, ref, out) {

    assertEqual(
        `${scope}.hdlr.size`,
        readUint32(out, 0),
        readUint32(ref, 0)
    );

    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.type.byte[${i}]`,
            out[4 + i],
            ref[4 + i]
        );
    }

    assertEqual(`${scope}.hdlr.version`, out[8], ref[8]);

    for (let i = 0; i < 3; i++) {
        assertEqualHex(
            `${scope}.hdlr.flags.byte[${i}]`,
            out[9 + i],
            ref[9 + i]
        );
    }

    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.pre_defined.byte[${i}]`,
            out[12 + i],
            ref[12 + i]
        );
    }

    for (let i = 0; i < 4; i++) {
        assertEqualHex(
            `${scope}.hdlr.handler_type.byte[${i}]`,
            out[16 + i],
            ref[16 + i]
        );
    }

    for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 4; i++) {
            assertEqualHex(
                `${scope}.hdlr.reserved[${r}].byte[${i}]`,
                out[20 + r * 4 + i],
                ref[20 + r * 4 + i]
            );
        }
    }

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

    assertEqual(
        `${scope}.hdlr.total.size`,
        out.length,
        ref.length
    );
}
