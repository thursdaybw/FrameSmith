/**
 * Commit MINF into MDIA.
 *
 * Replaces the existing MINF child with a committed MINF node.
 *
 * Responsibilities:
 * - structural substitution only
 * - preserve child ordering
 * - preserve mdhd and hdlr verbatim
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
export function commitMdia({
    originalMdiaNode,
    committedMinfNode
}) {
    if (!originalMdiaNode || originalMdiaNode.type !== "mdia") {
        throw new Error("commitMdia: originalMdiaNode must be an mdia box");
    }

    if (!committedMinfNode || committedMinfNode.type !== "minf") {
        throw new Error("commitMdia: committedMinfNode must be a minf box");
    }

    const children = originalMdiaNode.children;
    if (!Array.isArray(children)) {
        throw new Error("commitMdia: mdia.children must be an array");
    }

    let replaced = false;

    const newChildren = children.map(child => {
        if (child.type === "minf") {
            replaced = true;
            return committedMinfNode;
        }
        return child;
    });

    if (!replaced) {
        throw new Error("commitMdia: original mdia must contain minf");
    }

    return {
        type: "mdia",
        children: newChildren
    };
}
