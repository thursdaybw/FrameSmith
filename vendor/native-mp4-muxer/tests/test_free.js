import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";
import { assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function testFree_Structure() {

    // ---------------------------------------------------------
    // Emit (raw node, no serialization)
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.emit(
            "free",
            {}
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual(
        "free.type",
        node.type,
        "free"
    );

    // ---------------------------------------------------------
    // No payload
    // ---------------------------------------------------------
    assertEqual(
        "free.body",
        node.body,
        undefined
    );
}

export async function testFree_LockedLayoutEquivalence_ffmpeg() {

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Extract golden truth free box
    // ------------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "free"
        );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput(); // {}

    // ------------------------------------------------------------
    // 3. Rebuild free box via registry
    // ------------------------------------------------------------
    const outBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "free",
                params
            )
        );

    const refRaw = refFields.raw;

    // ------------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ------------------------------------------------------------
    if (outBytes.length !== refRaw.length) {
        throw new Error(
            `free.size mismatch: ${outBytes.length} vs ${refRaw.length}`
        );
    }

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `free.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}
