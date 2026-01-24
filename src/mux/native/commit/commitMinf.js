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
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "../tests/goldenTruthExtractors/index.js";

export function commitMinf({
    originalMinfNode,
    committedStblNode
}) {
    // ---------------------------------------------------------
    // Validation
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // Recover canonical MINF intent from bytes
    // ---------------------------------------------------------
    const originalMinfBytes = serializeBoxTree(originalMinfNode);

    const originalMinfIntent =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: originalMinfBytes,
                sourceRegistryKey: "moov/trak/mdia/minf",
                targetBoxPath: "moov/trak/mdia/minf"
            })
            .getEmitterInput();

    // ---------------------------------------------------------
    // Replace STBL only (structural surgery point)
    // ---------------------------------------------------------
    const committedMinfIntent = {
        ...originalMinfIntent,
        stbl:
            getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: serializeBoxTree(committedStblNode),
                    sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                    targetBoxPath: "moov/trak/mdia/minf/stbl"
                })
                .getEmitterInput()
    };

    // ---------------------------------------------------------
    // Re-emit MINF via registry
    // ---------------------------------------------------------
    return EmitterRegistry.assemble(
        "moov/trak/mdia/minf",
        committedMinfIntent
    );
}
