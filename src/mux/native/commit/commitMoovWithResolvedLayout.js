import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { commitStbl } from "./commitStbl.js";
import { commitMinf } from "./commitMinf.js";
import { commitMdia } from "./commitMdia.js";
import { commitTrak } from "./commitTrak.js";
import { commitMoov } from "./commitMoov.js";

/**
 * Commit all layout-dependent tables into MOOV.
 *
 * This is the ONLY place where:
 * - STBL
 * - MINF
 * - MDIA
 * - TRAK
 * - MOOV
 * are composed together.
 *
 * The caller must treat this as atomic.
 */
export function commitMoovWithResolvedLayout({
    originalMoovNode,
    stcoOffsets
}) {
    if (!originalMoovNode || originalMoovNode.type !== "moov") {
        throw new Error("commitMoovWithResolvedLayout: originalMoovNode must be moov");
    }

    if (!Array.isArray(stcoOffsets)) {
        throw new Error("commitMoovWithResolvedLayout: stcoOffsets must be array");
    }

    const stcoNode = emitStcoBox({ chunkOffsets: stcoOffsets });

    const originalTrak = originalMoovNode.children.find(c => c.type === "trak");
    if (!originalTrak) {
        throw new Error("commitMoovWithResolvedLayout: trak not found");
    }

    const originalMdia = originalTrak.children.find(c => c.type === "mdia");
    const originalMinf = originalMdia.children.find(c => c.type === "minf");
    const originalStbl = originalMinf.children.find(c => c.type === "stbl");

    const committedStbl = commitStbl({
        originalStblNode: originalStbl,
        committedStcoNode: stcoNode
    });

    const committedMinf = commitMinf({
        originalMinfNode: originalMinf,
        committedStblNode: committedStbl
    });

    const committedMdia = commitMdia({
        originalMdiaNode: originalMdia,
        committedMinfNode: committedMinf
    });

    const committedTrak = commitTrak({
        originalTrakNode: originalTrak,
        committedMdiaNode: committedMdia
    });

    return commitMoov({
        originalMoovNode,
        committedTrakNodes: [committedTrak]
    });
}
