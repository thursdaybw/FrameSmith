/**
 * applyBtrtContainerPolicy
 * =======================
 *
 * Applies an explicit MP4 container compatibility policy for the
 * Bitrate Box (btrt) used inside SampleEntry (stsd).
 *
 * -------------------------------------------------------------------------
 * Architectural role
 * -------------------------------------------------------------------------
 *
 * - btrt is NOT a semantic media fact
 * - btrt is NOT derivable from access units
 * - multiple valid btrt representations exist for the same video
 *
 * Therefore:
 *   - btrt is policy-owned
 *   - its presence is OPTIONAL
 *   - its values are NEVER inferred
 *
 * -------------------------------------------------------------------------
 * Policy rule (v1)
 * -------------------------------------------------------------------------
 *
 * If a btrt value is supplied by the caller (via buildHints),
 * this policy:
 *
 *   - validates it
 *   - passes it through verbatim
 *
 * If no btrt is supplied:
 *
 *   - this policy performs NO ACTION
 *   - the btrt box is omitted
 *
 * This matches ffmpeg behavior when encoder bitrate information
 * is unavailable or intentionally unspecified.
 *
 * -------------------------------------------------------------------------
 * Non-responsibilities
 * -------------------------------------------------------------------------
 *
 * - Does NOT estimate bitrate
 * - Does NOT derive values
 * - Does NOT invent defaults
 * - Does NOT emit MP4 boxes
 */

export function applyBtrtContainerPolicy({ btrt }) {

    // ---------------------------------------------------------
    // Policy applicability
    // ---------------------------------------------------------
    // Absence is allowed and intentional.
    if (btrt === undefined) {
        return undefined;
    }

    // ---------------------------------------------------------
    // Validation (only if supplied)
    // ---------------------------------------------------------
    if (btrt === null || typeof btrt !== "object") {
        throw new Error(
            "applyBtrtContainerPolicy: btrt must be an object when supplied"
        );
    }

    if (!Number.isInteger(btrt.bufferSizeDB)) {
        throw new Error(
            "applyBtrtContainerPolicy: btrt.bufferSizeDB must be an integer"
        );
    }

    if (!Number.isInteger(btrt.maxBitrate)) {
        throw new Error(
            "applyBtrtContainerPolicy: btrt.maxBitrate must be an integer"
        );
    }

    if (!Number.isInteger(btrt.avgBitrate)) {
        throw new Error(
            "applyBtrtContainerPolicy: btrt.avgBitrate must be an integer"
        );
    }

    // ---------------------------------------------------------
    // Policy application
    // ---------------------------------------------------------
    // Pass through exactly. No mutation, no inference.
    return {
        bufferSizeDB: btrt.bufferSizeDB,
        maxBitrate:   btrt.maxBitrate,
        avgBitrate:   btrt.avgBitrate
    };
}
