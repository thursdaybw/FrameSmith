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
function assembleMdia(intent, { emitContainer }) {

    const { mdhd, hdlr, minf } = intent;

    // ---------------------------------------------------------
    // Validation: required semantic intent
    // ---------------------------------------------------------
    if (!mdhd || !hdlr || !minf) {
        throw new Error(
            "assembleMdia: mdhd, hdlr, and minf are required"
        );
    }

    // ---------------------------------------------------------
    // Materialise children
    // ---------------------------------------------------------

    const mdhdNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/mdhd",
            mdhd
        );

    const hdlrNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/hdlr",
            hdlr
        );

    const minfNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf",
            minf
        );

    // ---------------------------------------------------------
    // MDIA container
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/mdia",
        {
            mdhd: mdhdNode,
            hdlr: hdlrNode,
            minf: minfNode
        }
    );
}

export function registerMdiaAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia",
        assembleMdia
    );
}
