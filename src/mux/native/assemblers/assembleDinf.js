
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
function assembleDinf(intent, { emitContainer }) {

    // ---------------------------------------------------------
    // DINF has no semantic intent of its own.
    // It always contains exactly one `dref`.
    // ---------------------------------------------------------

    const drefNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf/dref",
            {}
        );

    return emitContainer(
        "moov/trak/mdia/minf/dinf",
        {
            dref: drefNode
        }
    );
}

export function registerDinfAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/dinf",
        assembleDinf
    );
}
