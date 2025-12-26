/**
 * ELST — Edit List Box
 * -------------------
 * Describes how the media timeline should be mapped into the presentation
 * timeline.
 *
 * An Edit List answers the question:
 *
 *   “Which portions of the media timeline are played,
 *    and for how long, in the final presentation?”
 *
 * This box does NOT describe samples, decoding, or storage.
 * It describes *temporal mapping*.
 *
 * ---
 *
 * Conceptual model (plain language):
 * ----------------------------------
 *
 * - The media track has its own internal timeline (media_time)
 * - The movie has a presentation timeline (edit_duration)
 *
 * Each edit entry says:
 *
 *   “Play media starting at time X
 *    for Y duration
 *    at rate R”
 *
 * Multiple entries allow:
 *   - leading gaps (media_time = -1)
 *   - trimming
 *   - looping
 *   - offsets
 *
 * ---
 *
 * Architectural intent:
 * ---------------------
 *
 * This builder:
 *   - expresses JSON intent only
 *   - does NOT infer version
 *   - does NOT validate against ffmpeg behavior
 *   - does NOT serialize bytes
 *
 * It exists to:
 *   - make Edit Lists explicit
 *   - enforce a clean contract
 *   - support isolated testing (Phase A)
 *
 * Any mismatch with real-world MP4 files will be
 * discovered during Phase C locked-layout tests,
 * at which point this builder may be refined.
 *
 * ---
 *
 * Spec references:
 * - ISO/IEC 14496-12 — Edit List Box (elst)
 * - MP4 Registry: https://mp4ra.org/registered-types/boxes/elst
 */
export function emitElstBox(params) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof params !== "object" || params === null) {
        throw new Error(
            "emitElstBox: expected a parameter object"
        );
    }

    const {
        version,
        flags,
        entries
    } = params;

    if (version !== 0 && version !== 1) {
        throw new Error(
            "emitElstBox: version must be 0 or 1"
        );
    }

    if (typeof flags !== "number") {
        throw new Error(
            "emitElstBox: flags must be a number"
        );
    }

    if (!Array.isArray(entries)) {
        throw new Error(
            "emitElstBox: entries must be an array"
        );
    }

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];

        if (typeof e !== "object" || e === null) {
            throw new Error(
                `emitElstBox: entry[${i}] must be an object`
            );
        }

        const requiredFields = [
            "editDuration",
            "mediaTime",
            "mediaRateInteger",
            "mediaRateFraction"
        ];

        for (const field of requiredFields) {
            if (!(field in e)) {
                throw new Error(
                    `emitElstBox: entry[${i}] missing field '${field}'`
                );
            }

            if (typeof e[field] !== "number") {
                throw new Error(
                    `emitElstBox: entry[${i}].${field} must be a number`
                );
            }
        }
    }

    // ---------------------------------------------------------
    // Body construction (FLATTENED)
    // ---------------------------------------------------------
    const body = [
        // entry_count
        { int: entries.length }
    ];

    for (const e of entries) {
        if (version === 1) {
            body.push(
                { uint64: e.editDuration },
                { int64: e.mediaTime }
            );
        } else {
            body.push(
                { int: e.editDuration },
                { int: e.mediaTime }
            );
        }

        body.push(
            { short: e.mediaRateInteger },
            { short: e.mediaRateFraction }
        );
    }

    return {
        type: "elst",
        version,
        flags,
        body
    };
}
