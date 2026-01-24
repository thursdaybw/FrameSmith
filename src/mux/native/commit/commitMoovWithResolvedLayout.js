import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
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
    perTrackStcoOffsets
}) {
    if (!originalMoovNode || originalMoovNode.type !== "moov") {
        throw new Error("commitMoovWithResolvedLayout: originalMoovNode must be moov");
    }

    if (!Array.isArray(perTrackStcoOffsets)) {
        throw new Error(
            "commitMoovWithResolvedLayout: perTrackStcoOffsets must be array"
        );
    }

    const originalTraks =
        originalMoovNode.children.filter(c => c.type === "trak");

    if (originalTraks.length === 0) {
        throw new Error("commitMoovWithResolvedLayout: no trak boxes found");
    }

    const committedTraks = [];

    for (let i = 0; i < originalTraks.length; i++) {

        const originalTrak = originalTraks[i];

        const perTrack = perTrackStcoOffsets[i];
        if (!perTrack || !Array.isArray(perTrack.stcoOffsets)) {
            throw new Error(
                `commitMoovWithResolvedLayout: missing stcoOffsets for track ${i}`
            );
        }

        const stcoNode = EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            { chunkOffsets: perTrack.stcoOffsets }
        );

        const originalMdia =
            originalTrak.children.find(c => c.type === "mdia");
        if (!originalMdia) {
            throw new Error("commitMoovWithResolvedLayout: mdia not found");
        }

        const originalMinf =
            originalMdia.children.find(c => c.type === "minf");
        if (!originalMinf) {
            throw new Error("commitMoovWithResolvedLayout: minf not found");
        }

        const originalStbl =
            originalMinf.children.find(c => c.type === "stbl");
        if (!originalStbl) {
            throw new Error("commitMoovWithResolvedLayout: stbl not found");
        }

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

        committedTraks.push(committedTrak);
    }

    return commitMoov({
        originalMoovNode,
        committedTrakNodes: committedTraks
    });
}
