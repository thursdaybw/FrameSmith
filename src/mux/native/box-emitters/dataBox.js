/**
 * DATA — Metadata Value Box
 * ========================
 *
 * Wraps a single metadata value inside an ilst item atom.
 *
 * FullBox layout:
 *
 *   size        (4)
 *   type        (4)  "data"
 *   version     (1)
 *   flags       (3)
 *   data_type   (4)
 *   locale      (4)
 *   value       (n)
 *
 * This builder:
 * - assembles structure only
 * - does not infer semantics
 * - preserves payload verbatim
 */
export function emitDataBox(params) {

    if (typeof params !== "object" || params === null) {
        throw new Error("emitDataBox: expected a parameter object");
    }

    const {
        version,
        flags,
        dataType,
        locale,
        payload
    } = params;

    // ---------------------------------------------------------
    // FullBox fields
    // ---------------------------------------------------------
    if (!Number.isInteger(version) || version < 0 || version > 0xFF) {
        throw new Error(
            "emitDataBox: 'version' must be an 8-bit unsigned integer"
        );
    }

    if (!Number.isInteger(flags) || flags < 0 || flags > 0xFFFFFF) {
        throw new Error(
            "emitDataBox: 'flags' must be a 24-bit unsigned integer"
        );
    }

    // ---------------------------------------------------------
    // Body fields
    // ---------------------------------------------------------
    if (!Number.isInteger(dataType) || dataType < 0) {
        throw new Error(
            "emitDataBox: 'dataType' must be a non-negative integer"
        );
    }

    if (!Number.isInteger(locale) || locale < 0) {
        throw new Error(
            "emitDataBox: 'locale' must be a non-negative integer"
        );
    }

    if (!(payload instanceof Uint8Array)) {
        throw new Error(
            "emitDataBox: 'payload' must be a Uint8Array"
        );
    }

    return {
        type: "data",
        version,
        flags,
        body: [
            { int: dataType },
            { int: locale },
            {
                array: "byte",
                values: Array.from(payload)
            }
        ]
    };
}
