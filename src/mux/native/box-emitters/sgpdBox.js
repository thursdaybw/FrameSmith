/**
 * sgpd — Sample Group Description Box
 * ----------------------------------
 *
 * Declares group description records referenced by sbgp.
 *
 * NativeMuxer treats sgpd as opaque-or-declared container metadata.
 *
 * Responsibilities:
 * - validate structural shape only
 * - serialize fields in correct order
 * - preserve declared values exactly
 *
 * This emitter does NOT:
 * - interpret description contents
 * - derive descriptions
 * - enforce semantic relationships
 *
 * ISO/IEC 14496-12 — SampleGroupDescriptionBox
 */
export function emitSgpdBox({
    groupingType,
    defaultLength,
    descriptions
}) {
    // -------------------------------------------------------------
    // Defensive validation (structure only)
    // -------------------------------------------------------------
    if (
        typeof groupingType !== "string" ||
        groupingType.length !== 4
    ) {
        throw new Error(
            "emitSgpdBox: groupingType must be a 4-character string"
        );
    }

    if (
        !Number.isInteger(defaultLength) ||
        defaultLength < 0
    ) {
        throw new Error(
            "emitSgpdBox: defaultLength must be a non-negative integer"
        );
    }

    if (!Array.isArray(descriptions)) {
        throw new Error(
            "emitSgpdBox: descriptions must be an array"
        );
    }

    for (const desc of descriptions) {
        if (!(desc instanceof Uint8Array)) {
            throw new Error(
                "emitSgpdBox: each description must be a Uint8Array"
            );
        }

        if (
            defaultLength !== 0 &&
            desc.length !== defaultLength
        ) {
            throw new Error(
                "emitSgpdBox: description length must match defaultLength"
            );
        }
    }

    // -------------------------------------------------------------
    // Emit FullBox
    // -------------------------------------------------------------
    return {
        type: "sgpd",
        version: 1,
        flags: 0,

        body: [
            // grouping_type (4cc)
            { type: groupingType },

            // default_length
            { int: defaultLength },

            // entry_count
            { int: descriptions.length },

            // description records (opaque)
            ...descriptions.map(desc => ({
                array: desc
            }))
        ]
    };
}
