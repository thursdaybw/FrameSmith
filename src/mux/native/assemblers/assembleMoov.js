import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * ASSEMBLER CONTRACT
 * ==================
 *
 * Accepts semantic intent only.
 * Constructs child boxes via registry.
 * Assembles container structure only.
 */
function assembleMoov(intent, { emitContainer }) {

    const { mvhd, traks, udta } = intent;

    // ---------------------------------------------------------
    // Validation: required semantic intent
    // ---------------------------------------------------------
    if (!mvhd) {
        throw new Error(
            "assembleMoov: mvhd is required"
        );
    }

    if (!Array.isArray(traks) || traks.length === 0) {
        throw new Error(
            "assembleMoov: traks must be a non-empty array"
        );
    }

    // ---------------------------------------------------------
    // Materialise children
    // ---------------------------------------------------------

    const mvhdNode =
        EmitterRegistry.emit(
            "moov/mvhd",
            mvhd
        );

    const trakNodes = traks.map((trak, i) => {
        if (!trak) {
            throw new Error(
                `assembleMoov: traks[${i}] is undefined`
            );
        }

        return EmitterRegistry.assemble(
            "moov/trak",
            trak
        );
    });

    let udtaNode;
    if (udta) {
        udtaNode =
            EmitterRegistry.assemble(
                "moov/udta",
                udta
            );
    }

    // ---------------------------------------------------------
    // MOOV container
    // ---------------------------------------------------------
    return emitContainer(
        "moov",
        {
            mvhd: mvhdNode,
            traks: trakNodes,
            udta: udtaNode
        }
    );
}

export function registerMoovAssembler(registry) {
    registry.registerAssembler(
        "moov",
        assembleMoov
    );
}
