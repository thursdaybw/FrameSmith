/**
 * Commit STCO into STBL.
 *
 * Responsibilities:
 * - Replace existing STCO with committed STCO
 * - Preserve all other children verbatim
 * - Preserve original child ordering
 *
 * Non-responsibilities:
 * - No validation of STCO contents
 * - No byte emission
 * - No policy decisions
 *
 * RULE:
 * - EXACTLY ONE STCO is replaced OR inserted
 * - ALL other children are preserved verbatim
 * - ORDER is preserved
 */
export function commitStbl({
    originalStblNode,
    committedStcoNode
}) {
    if (!originalStblNode || originalStblNode.type !== "stbl") {
        throw new Error("commitStbl: originalStblNode must be an stbl box");
    }

    if (!committedStcoNode || committedStcoNode.type !== "stco") {
        throw new Error("commitStbl: committedStcoNode must be an stco box");
    }

    const children = originalStblNode.children;
    if (!Array.isArray(children)) {
        throw new Error("commitStbl: stbl.children must be an array");
    }

    let replaced = false;

    const newChildren = children.map(child => {
        if (child.type === "stco") {
            replaced = true;
            return committedStcoNode;
        }
        return child;
    });

    // If no STCO existed, append it at the end
    if (!replaced) {
        newChildren.push(committedStcoNode);
    }

    return {
        type: "stbl",
        children: newChildren
    };
}
