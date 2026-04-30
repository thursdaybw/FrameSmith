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
function emitSgpdBox({
    groupingType,
    defaultLength,
    descriptions
}) {

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

    const bodyLength =
        defaultLength === 0
        ? 3 + descriptions.length * 2
        : 3 + descriptions.length;

    const body = new Array(bodyLength);


    // grouping_type (FourCC encoded as uint32)
    const groupingTypeUint32 =
        (groupingType.charCodeAt(0) << 24) |
        (groupingType.charCodeAt(1) << 16) |
        (groupingType.charCodeAt(2) << 8)  |
        groupingType.charCodeAt(3);

    body[0] = { int: groupingTypeUint32 >>> 0 };

    // default_length
    body[1] = { int: defaultLength };

    // entry_count
    body[2] = { int: descriptions.length };

    let cursor = 3;

    for (const desc of descriptions) {

        // Per-entry length is written ONLY when defaultLength === 0
        if (defaultLength === 0) {
            body[cursor++] = {
                int: desc.length
            };
        }

        body[cursor++] = {
            array: "byte",
            values: Array.from(desc)
        };
    }

    return {
        type: "sgpd",
        version: 1,
        flags: 0,
        body
    };
}

export function registerSgpdFixedEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/sgpd|fixed",
        emitSgpdBox
    );
}

export function registerSgpdVariableEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/sgpd|variable",
        emitSgpdBox
    );
}
