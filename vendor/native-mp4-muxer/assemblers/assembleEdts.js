/**
 * ASSEMBLER CONTRACT
 * ==================
 *
 * This function accepts SEMANTIC INTENT ONLY.
 *
 * It MUST NOT receive:
 * - serialized box bytes
 * - box headers
 * - emitter nodes
 *
 * It MUST:
 * - validate intent types and ranges
 * - construct child boxes via EmitterRegistry
 *
 * If you are unsure whether a value belongs here:
 * - raw bytes → extractor or serializer
 * - structural nodes → emitter
 * - semantic values → assembler
 */

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * ASSEMBLER CONTRACT
 * ==================
 *
 * Accepts SEMANTIC INTENT ONLY.
 *
 * - terminal children → EmitterRegistry.emit
 * - container node    → emitContainer
 */
function assembleEdts(intent, { emitContainer }) {

    const { elst } = intent;

    if (!elst) {
        throw new Error("assembleEdts: elst is required");
    }

    // ---------------------------------------------------------
    // Materialise children
    // ---------------------------------------------------------
    const elstNode =
        EmitterRegistry.emit(
            "moov/trak/edts/elst",
            elst
        );

    // ---------------------------------------------------------
    // EDTS container
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/edts",
        {
            elst: elstNode
        }
    );
}

export function registerEdtsAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/edts",
        assembleEdts
    );
}
