import { emitMinfBox } from "../box-emitters/minfBox.js";

/**
 * Commit STBL into MINF.
 *
 * Re-emits MINF using a physically-correct STBL.
 *
 * Responsibilities:
 * - replace stbl child
 * - preserve all other children verbatim
 * - force correct size propagation
 *
 * Non-responsibilities:
 * - no offset logic
 * - no layout decisions
 * - no child mutation
 */
export function commitMinf({
    originalMinfNode,
    committedStblNode
}) {
    if (!originalMinfNode) {
        throw new Error("commitMinf: originalMinfNode is required");
    }

    if (!committedStblNode) {
        throw new Error("commitMinf: committedStblNode is required");
    }

    if (originalMinfNode.type !== "minf") {
        throw new Error("commitMinf: originalMinfNode must be a minf box");
    }

    if (committedStblNode.type !== "stbl") {
        throw new Error("commitMinf: committedStblNode must be an stbl box");
    }

    const children = originalMinfNode.children;

    if (!Array.isArray(children)) {
        throw new Error("commitMinf: originalMinfNode.children must be an array");
    }

    const vmhd = children.find(c => c.type === "vmhd");
    const smhd = children.find(c => c.type === "smhd");
    const dinf = children.find(c => c.type === "dinf");

    if (!dinf) {
        throw new Error("commitMinf: dinf box is required");
    }

    return emitMinfBox({
        vmhd,
        smhd,
        dinf,
        stbl: committedStblNode
    });
}
