import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readUint16 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * testSmhd_Structure
 *
 * Structural test only.
 * - NO serialization
 * - Asserts emitter node shape directly
 */
export function testSmhd_Structure() {

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/smhd",
            { balance: 0 }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("smhd.type", node.type, "smhd");
    assertEqual("smhd.version", node.version, 0);
    assertEqual("smhd.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body fields
    // ---------------------------------------------------------
    assertEqual(
        "smhd.body.length",
        node.body.length,
        2
    );

    assertEqual(
        "smhd.balance",
        node.body[0].short,
        0
    );

    assertEqual(
        "smhd.reserved",
        node.body[1].short,
        0
    );
}


/**
 * testSmhd_LockedLayoutEquivalence_ffmpeg
 *
 * Byte-for-byte equivalence against ffmpeg output.
 */
export async function testSmhd_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const ref =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/smhd",
            { trackType: "audio" }
        );

    const refFields = ref.readBoxReport();
    const params    = ref.getEmitterInput();

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/smhd",
            params
        );

    const out =
        serializeBoxTree(node);

    assertEqual(
        "smhd.size",
        out.length,
        refFields.raw.length
    );

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `smhd.byte[${i}]`,
            out[i],
            refFields.raw[i]
        );
    }
}
