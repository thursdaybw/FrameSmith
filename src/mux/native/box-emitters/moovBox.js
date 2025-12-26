/**
 * MOOV — Movie Box
 *
 * Top-level container for movie metadata.
 *
 * Responsibilities:
 * - Group mvhd, trak(s), and optional udta
 * - Preserve child ordering
 *
 * Non-responsibilities:
 * - No size computation
 * - No offset computation
 * - No policy decisions
 * - No child construction
 */
export function emitMoovBox(params) {

    if (typeof params !== "object" || params === null) {
        throw new Error("emitMoovBox: expected parameter object");
    }

    const { mvhd, traks, udta } = params;

    if (!mvhd) {
        throw new Error("emitMoovBox: mvhd is required");
    }

    if (!Array.isArray(traks) || traks.length === 0) {
        throw new Error("emitMoovBox: traks must be a non-empty array");
    }

    if (typeof mvhd.type !== "string") {
        throw new Error("emitMoovBox: mvhd must be a box node");
    }

    for (let i = 0; i < traks.length; i++) {
        if (!traks[i] || typeof traks[i].type !== "string") {
            throw new Error(
                `emitMoovBox: traks[${i}] must be a box node`
            );
        }
    }

    if (udta && typeof udta.type !== "string") {
        throw new Error("emitMoovBox: udta must be a box node");
    }

    const children = [
        mvhd,
        ...traks
    ];

    if (udta) {
        children.push(udta);
    }

    return {
        type: "moov",
        children
    };
}
