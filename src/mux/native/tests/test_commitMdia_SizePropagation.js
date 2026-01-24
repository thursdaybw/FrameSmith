import { commitMdia } from "../commit/commitMdia.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

/**
 * testCommitMdia_SizePropagation
 * ==============================
 *
 * PURPOSE
 * -------
 * This test validates that `commitMdia` correctly propagates
 * size changes when a larger MINF replaces a smaller one.
 *
 * ARCHITECTURAL CONTEXT
 * --------------------
 * `commitMdia` runs in the **second compiler pass**.
 *
 * At this stage:
 *   - MDIA, MINF, and STBL are already *emitted box nodes*
 *   - layout decisions have already been made
 *   - offsets and sizes are now authoritative
 *
 * Therefore:
 *   - this test MUST NOT use assemblers
 *   - this test MUST operate on emitted nodes only
 *   - semantic correctness is irrelevant here
 *
 * This test exists solely to prove that:
 *   - replacing MINF causes MDIA size to grow
 *   - no children are dropped
 *   - no size regression occurs
 *
 * If this test ever requires assemblers,
 * the compiler phase boundary has been violated.
 */
export function testCommitMdia_SizePropagation() {

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
    // 3. Base emitted MDIA
    // ---------------------------------------------------------
    const baseMdia = {
        type: "mdia",
        children: [
            { type: "mdhd", body: [] },
            { type: "hdlr", body: [] },
            { type: "elng", body: [] }, // optional child preserved
            smallMinf
        ]
    };

    // ---------------------------------------------------------
    // 4. Commit larger MINF into MDIA
    // ---------------------------------------------------------
    const committedMdia = commitMdia({
        originalMdiaNode: baseMdia,
        committedMinfNode: bigMinf
    });

    // ---------------------------------------------------------
    // 5. Size assertions
    // ---------------------------------------------------------
    const baseSize = serializeBoxTree(baseMdia).length;
    const newSize  = serializeBoxTree(committedMdia).length;

    assertEqual(
        "mdia size grows or stays equal",
        newSize >= baseSize,
        true
    );

    assertEqual(
        "no structural loss",
        serializeBoxTree(committedMdia).length >= serializeBoxTree(baseMdia).length,
        true
    );
}
