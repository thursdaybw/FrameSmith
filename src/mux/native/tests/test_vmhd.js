import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import {
    assertEqual,
    assertEqualHex
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * testVmhd_Structure
 *
 * Proves:
 * - vmhd is emitted canonically
 * - structure is correct
 * - no serialization involved
 */
export function testVmhd_Structure() {

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/vmhd",
            {}
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("vmhd.type", node.type, "vmhd");
    assertEqual("vmhd.version", node.version, 0);
    assertEqual("vmhd.flags", node.flags, 1);

    // ---------------------------------------------------------
    // Body fields
    // ---------------------------------------------------------
    assertEqual("vmhd.body.length", node.body.length, 4);

    assertEqual("vmhd.graphicsmode", node.body[0].short, 0);
    assertEqual("vmhd.opcolorR",     node.body[1].short, 0);
    assertEqual("vmhd.opcolorG",     node.body[2].short, 0);
    assertEqual("vmhd.opcolorB",     node.body[3].short, 0);

    // ---------------------------------------------------------
    // Children
    // ---------------------------------------------------------
    assertEqual(
        "vmhd.children.length",
        node.children ? node.children.length : 0,
        0
    );
}

export async function testVmhd_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Read golden truth VMHD
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/vmhd"
        );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // ---------------------------------------------------------
    // Rebuild VMHD via registry
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/vmhd",
            params
        )
    );

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "vmhd.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `vmhd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}
