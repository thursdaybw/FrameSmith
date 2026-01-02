import { commitMinf } from "../commit/commitMinf.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

export function testCommitMinf_SizePropagation() {

    console.log("=== testCommitMinf_SizePropagation ===");

    // ---------------------------------------------------------
    // 1. Small, valid STBL
    // ---------------------------------------------------------
    const smallStbl = emitStblBox({
        stsd: { type: "stsd", body: [] },
        stts: { type: "stts", body: [] },
        stsc: { type: "stsc", body: [] },
        stsz: { type: "stsz", body: [] },
        stco: { type: "stco", body: [] }
    });

    // ---------------------------------------------------------
    // 2. Larger, still-valid STBL
    // ---------------------------------------------------------
    const bigStbl = emitStblBox({
        stsd: { type: "stsd", body: [] },
        stts: {
            type: "stts",
            body: [
                { int: 1 },
                { int: 1000 }
            ]
        },
        stsc: { type: "stsc", body: [] },
        stsz: { type: "stsz", body: [] },
        stco: { type: "stco", body: [] }
    });

    // ---------------------------------------------------------
    // 3. Base MINF
    // ---------------------------------------------------------
    const baseMinf = emitMinfBox({
        vmhd: { type: "vmhd", body: [] },
        dinf: { type: "dinf", body: [] },
        stbl: smallStbl
    });

    // ---------------------------------------------------------
    // 4. Commit larger STBL
    // ---------------------------------------------------------
    const committedMinf = commitMinf({
        originalMinfNode: baseMinf,
        committedStblNode: bigStbl
    });

    const baseSize = serializeBoxTree(baseMinf).length;
    const newSize  = serializeBoxTree(committedMinf).length;

    assertEqual("minf size increased", newSize > baseSize, true);

    console.log("PASS: commitMinf propagates size change via valid STBL");
}
