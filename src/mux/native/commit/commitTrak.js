/**
 * Commit MDIA into TRAK.
 *
 * Replaces the existing MDIA child with a committed MDIA node.
 *
 * Responsibilities:
 * - structural substitution only
 * - preserve child ordering
 * - preserve tkhd verbatim
 *
 * Non-responsibilities:
 * - no validation of child internals
 * - no size computation
 * - no serialization
 *
 * RULE:
 * - EXACTLY ONE child is replaced
 * - ALL other children are preserved verbatim
 * - ORDER is preserved
 */
export function commitTrak({
    originalTrakNode,
    committedMdiaNode
}) {
    if (!originalTrakNode || originalTrakNode.type !== "trak") {
        throw new Error("commitTrak: originalTrakNode must be a trak box");
    }

    if (!committedMdiaNode || committedMdiaNode.type !== "mdia") {
        throw new Error("commitTrak: committedMdiaNode must be an mdia box");
    }

    const children = originalTrakNode.children;
    if (!Array.isArray(children)) {
        throw new Error("commitTrak: trak.children must be an array");
    }

    let replaced = false;

    const newChildren = children.map(child => {
        if (child.type === "mdia") {
            replaced = true;
            return committedMdiaNode;
        }
        return child;
    });

    if (!replaced) {
        throw new Error("commitTrak: original trak must contain mdia");
    }

    return {
        type: "trak",
        children: newChildren
    };
}
