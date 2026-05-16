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
function assembleMinf(intent, { emitContainer }) {

    const { mediaHeader, dinf, stbl } = intent;

    if (!mediaHeader || !dinf || !stbl) {
        throw new Error("assembleMinf: missing required child");
    }

    // ---------------------------------------------------------
    // Media header (EXACTLY ONE of vmhd or smhd)
    // ---------------------------------------------------------

    if (!mediaHeader.type) {
        throw new Error("assembleMinf: mediaHeader.type is required");
    }

    let mediaHeaderNode;

    if (mediaHeader.type === "vmhd") {
        mediaHeaderNode =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/vmhd",
            );

    } else if (mediaHeader.type === "smhd") {
        mediaHeaderNode =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/smhd",
            );
    } else {
        throw new Error(
            `assembleMinf: unknown mediaHeader type '${mediaHeader.type}'`
        );
    }

    // ---------------------------------------------------------
    // Required children
    // ---------------------------------------------------------

    const dinfNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf",
            dinf
        );

    const stblNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            stbl
        );

    // ---------------------------------------------------------
    // MINF container
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/mdia/minf",
        {
            mediaHeader: mediaHeaderNode,
            dinf: dinfNode,
            stbl: stblNode
        }
    );

}

export function registerMinfAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf",
        assembleMinf
    );
}
