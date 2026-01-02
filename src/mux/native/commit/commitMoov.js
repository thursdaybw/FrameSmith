/**
 * Commit TRAK(s) into MOOV.
 *
 * Responsibilities:
 * - replace trak children
 * - preserve mvhd
 * - preserve ordering
 *
 * Non-responsibilities:
 * - no validation of trak internals
 * - no size computation
 * - no serialization
 */
export function commitMoov({
    originalMoovNode,
    committedTrakNodes
}) {
    if (!originalMoovNode || originalMoovNode.type !== "moov") {
        throw new Error("commitMoov: originalMoovNode must be a moov box");
    }

    if (!Array.isArray(committedTrakNodes) || committedTrakNodes.length === 0) {
        throw new Error("commitMoov: committedTrakNodes must be a non-empty array");
    }

    const children = originalMoovNode.children;
    if (!Array.isArray(children)) {
        throw new Error("commitMoov: moov.children must be an array");
    }

    // Preserve all non-trak children verbatim
    const preserved = children.filter(c => c.type !== "trak");

    // Preserve ordering: mvhd first, then trak(s), then everything else
    const mvhd = preserved.find(c => c.type === "mvhd");
    if (!mvhd) {
        throw new Error("commitMoov: moov must contain mvhd");
    }

    const others = preserved.filter(c => c.type !== "mvhd");

    return {
        type: "moov",
        children: [
            mvhd,
            ...committedTrakNodes,
            ...others
        ]
    };
}
