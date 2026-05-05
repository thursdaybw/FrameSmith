/**
 * applyPaspContainerPolicy
 * =======================
 *
 * Applies an explicit MP4 container compatibility policy for the
 * Pixel Aspect Ratio Box (pasp) used inside SampleEntry (stsd).
 *
 * -------------------------------------------------------------------------
 * What pasp is
 * -------------------------------------------------------------------------
 *
 * - pasp describes how wide pixels are relative to their height
 * - It affects display, not decoding
 * - It is NOT a semantic media fact
 *
 * WebCodecs does NOT provide this information.
 *
 * -------------------------------------------------------------------------
 * Policy rule
 * -------------------------------------------------------------------------
 *
 * If a pasp value is supplied by the caller (via buildHints):
 *   - validate it
 *   - pass it through verbatim
 *
 * If no pasp is supplied:
 *   - do nothing
 *   - omit the pasp box entirely
 *
 * This matches ffmpeg behaviour when no pixel aspect information
 * is explicitly known.
 *
 * -------------------------------------------------------------------------
 * Important
 * -------------------------------------------------------------------------
 *
 * This policy does NOT:
 * - invent a default (like 1:1)
 * - guess based on resolution
 * - emit MP4 boxes
 *
 * It only decides whether pasp is allowed to exist.
 */

export function applyPaspContainerPolicy({ pasp }) {

    // Absence is allowed and intentional
    if (pasp === undefined) {
        return undefined;
    }

    if (pasp === null || typeof pasp !== "object") {
        throw new Error(
            "applyPaspContainerPolicy: pasp must be an object when supplied"
            `received ${pasp}`
        );
    }

    if (!Number.isInteger(pasp.hSpacing) || pasp.hSpacing <= 0) {
        throw new Error(
            "applyPaspContainerPolicy: hSpacing must be a positive integer" +
            `received ${pasp.hSpacing}`
        );
    }

    if (!Number.isInteger(pasp.vSpacing) || pasp.vSpacing <= 0) {
        throw new Error(
            "applyPaspContainerPolicy: vSpacing must be a positive integer" +
            `received ${pasp.vSpacing}`
        );
    }

    return {
        hSpacing: pasp.hSpacing,
        vSpacing: pasp.vSpacing
    };
}
