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
 * - validate intent types and ranges
 * - construct child boxes via EmitterRegistry
 *
 * If you are unsure whether a value belongs here:
 * - raw bytes → extractor or serializer
 * - structural nodes → emitter
 * - semantic values → assembler
 */

function assembleIlstItem(
    intent,
    { emitContainer }
) {
    if (typeof intent !== "object" || intent === null) {
        throw new Error(
            "assembleIlstItem: expected intent object"
        );
    }

    const { type, data } = intent;

    if (typeof type !== "string" || type.length !== 4) {
        throw new Error(
            "assembleIlstItem: 'type' must be a FourCC string"
        );
    }

    if (typeof data !== "object" || data === null) {
        throw new Error(
            "assembleIlstItem: 'data' must be provided"
        );
    }

    // ---------------------------------------------------------
    // Build child via registry (terminal box)
    // ---------------------------------------------------------
    const dataNode =
        EmitterRegistry.emit(
            `moov/udta/meta/ilst/${type}/data`,
            data
        );

    // ---------------------------------------------------------
    // Assemble container via injected capability
    // ---------------------------------------------------------
    return emitContainer(
        `moov/udta/meta/ilst/${type}`,
        {
            type,
            data: dataNode
        }
    );

}

export function registerIlstItemAssembler(registry) {
    registry.registerAssembler(
        "moov/udta/meta/ilst/{atom}",
        assembleIlstItem
    );
}
