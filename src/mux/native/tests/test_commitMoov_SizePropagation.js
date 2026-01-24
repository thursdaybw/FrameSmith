import { commitMoov } from "../commit/commitMoov.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";

/**
 * testCommitMoov_SizePropagation
 * ==============================
 *
 * PURPOSE
 * -------
 * This test validates that `commitMoov` correctly propagates
 * size changes when a larger TRAK replaces a smaller one.
 *
 * ARCHITECTURAL CONTEXT
 * --------------------
 * `commitMoov` runs in the **final structural compiler pass**.
 *
 * At this stage:
 *   - MOOV, TRAK, MDIA, MINF, STBL are already emitted nodes
 *   - semantic intent has been fully resolved
 *   - offsets and sizes are authoritative
 *
 * Therefore:
 *   - this test MUST NOT use assemblers
 *   - this test MUST operate on emitted box nodes only
 *   - this test validates structure and size propagation only
 *
 * If this test ever requires assemblers,
 * the compiler phase boundary has been violated.
 */
export function testCommitMoov_SizePropagation() {

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
    // 4. Small and large emitted TRAK
    // ---------------------------------------------------------
    const smallTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: smallMdia
    });

    const bigTrak = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: bigMdia
    });

    // ---------------------------------------------------------
    // 5. Base emitted MOOV
    // ---------------------------------------------------------
    const baseMoov = emitMoovBox({
        mvhd: { type: "mvhd", body: [] },
        traks: [smallTrak]
    });

    // ---------------------------------------------------------
    // 6. Commit larger TRAK into MOOV
    // ---------------------------------------------------------
    const committedMoov = commitMoov({
        originalMoovNode: baseMoov,
        committedTrakNodes: [bigTrak]
    });

    // ---------------------------------------------------------
    // 7. Size assertions
    // ---------------------------------------------------------
    const baseSize = serializeBoxTree(baseMoov).length;
    const newSize  = serializeBoxTree(committedMoov).length;

    assertEqual(
        "moov size grows",
        newSize > baseSize,
        true
    );
}
