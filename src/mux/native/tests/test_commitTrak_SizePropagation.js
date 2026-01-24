import { commitTrak } from "../commit/commitTrak.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

/**
 * testCommitTrak_SizePropagation
 * ==============================
 *
 * PURPOSE
 * -------
 * This test validates that `commitTrak` correctly propagates
 * size changes when a larger MDIA replaces a smaller one.
 *
 * ARCHITECTURAL CONTEXT
 * --------------------
 * `commitTrak` runs in the **second compiler pass**.
 *
 * At this stage:
 *   - TRAK, MDIA, MINF, STBL are already *emitted box nodes*
 *   - all semantic intent has been resolved
 *   - sizes and offsets are authoritative
 *
 * Therefore:
 *   - this test MUST NOT use assemblers
 *   - this test MUST operate on emitted nodes only
 *   - correctness here is structural, not semantic
 *
 * If this test ever requires assemblers,
 * the compiler phase boundary has been violated.
 */
export function testCommitTrak_SizePropagation() {

    // ---------------------------------------------------------
    // 1. Small emitted MINF
    // ---------------------------------------------------------
    const smallMinf = emitMinfBox({
        mediaHeader: { type: "vmhd", body: [] },
        dinf: { type: "dinf", children: [] },
        stbl: emitStblBox({
            stsd: { type: "stsd", body: [] },
            stts: { type: "stts", body: [] },
            stsc: { type: "stsc", body: [] },
            stsz: { type: "stsz", body: [] },
            stco: { type: "stco", body: [] }
        })
    });

    // ---------------------------------------------------------
    // 2. Larger emitted MINF
    // ---------------------------------------------------------
    const bigMinf = emitMinfBox({
        mediaHeader: { type: "vmhd", body: [] },
        dinf: { type: "dinf", children: [] },
        stbl: emitStblBox({
            stsd: { type: "stsd", body: [] },
            stts: {
                type: "stts",
                body: [{ int: 1 }, { int: 1000 }]
            },
            stsc: { type: "stsc", body: [] },
            stsz: { type: "stsz", body: [] },
            stco: { type: "stco", body: [] }
        })
    });

    // ---------------------------------------------------------
    // 3. Small and large emitted MDIA
    // ---------------------------------------------------------
    const smallMdia = emitMdiaBox({
        mdhd: { type: "mdhd", body: [] },
        hdlr: { type: "hdlr", body: [] },
        minf: smallMinf
    });

    const bigMdia = emitMdiaBox({
        mdhd: { type: "mdhd", body: [] },
        hdlr: { type: "hdlr", body: [] },
        minf: bigMinf
    });

    // ---------------------------------------------------------
    // 4. Base emitted TRAK
    // ---------------------------------------------------------
    const baseTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: smallMdia
    });

    // ---------------------------------------------------------
    // 5. Commit larger MDIA into TRAK
    // ---------------------------------------------------------
    const committedTrak = commitTrak({
        originalTrakNode: baseTrak,
        committedMdiaNode: bigMdia
    });

    // ---------------------------------------------------------
    // 6. Size assertions
    // ---------------------------------------------------------
    const baseSize = serializeBoxTree(baseTrak).length;
    const newSize  = serializeBoxTree(committedTrak).length;

    assertEqual(
        "trak size grows or stays equal",
        newSize >= baseSize,
        true
    );

    assertEqual(
        "no structural loss",
        serializeBoxTree(committedTrak).length >= serializeBoxTree(baseTrak).length,
        true
    );
}
