import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

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
 * - construct child boxes via EmitterRegistry
 * - assemble container structure only
 */
function assembleTrak(intent, { emitContainer }) {

    const { tkhd, mdia, edts } = intent;

    // ---------------------------------------------------------
    // Validation: required semantic intent
    // ---------------------------------------------------------
    if (!tkhd || !mdia) {
        throw new Error(
            "assembleTrak: tkhd and mdia are required"
        );
    }

    // ---------------------------------------------------------
    // Materialise children
    // ---------------------------------------------------------

    const tkhdNode =
        EmitterRegistry.emit(
            "moov/trak/tkhd",
            tkhd
        );

    let edtsNode;
    if (edts) {
        edtsNode =
            EmitterRegistry.assemble(
                "moov/trak/edts",
                edts
            );
    }

    const mdiaNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia",
            mdia
        );

    // ---------------------------------------------------------
    // TRAK container
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak",
        {
            tkhd: tkhdNode,
            edts: edtsNode,
            mdia: mdiaNode
        }
    );
}

export function registerTrakAssembler(registry) {
    registry.registerAssembler(
        "moov/trak",
        assembleTrak
    );
}
