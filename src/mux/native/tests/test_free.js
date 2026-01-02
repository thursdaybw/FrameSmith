import { emitFreeBox } from "../box-emitters/freeBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export function testFree_Structure() {

    console.log("=== testFree_Structure ===");

    // ---------------------------------------------------------
    // 1. Emit + serialize
    // ---------------------------------------------------------
    const node = emitFreeBox();
    const box  = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 2. Box header
    // ---------------------------------------------------------
    assertEqual(
        "free.type",
        readFourCC(box, 4),
        "free"
    );

    assertEqual(
        "free.size",
        readUint32(box, 0),
        8
    );

    // ---------------------------------------------------------
    // 3. Exact size invariant
    // ---------------------------------------------------------
    assertEqual(
        "free.length",
        box.length,
        8
    );

    console.log("PASS: free structural correctness");
}

export async function testFree_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testFree_LockedLayoutEquivalence_ffmpeg (golden MP4) ===");

    // ------------------------------------------------------------
    // 1. Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // 2. Extract golden truth free box
    // ------------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "free"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput(); // {}

    // ------------------------------------------------------------
    // 3. Rebuild free box
    // ------------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitFreeBox(params)
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

    console.log("PASS: free matches golden MP4 byte-for-byte");
}
