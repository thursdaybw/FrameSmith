/**
 * CTTS — Composition Time to Sample Box
 * ------------------------------------
 * Maps decoding time (DTS) to presentation time (PTS).
 *
 * This implementation:
 *   - supports version 0 only (unsigned offsets)
 *   - emits canonical full-box layout
 *   - does not infer or compress entries
 *   - does not serialize
 *   - does not mutate inputs
 *
 * Entry shape:
 *   {
 *     count:  number,   // sample_count
 *     offset: number    // composition_offset (unsigned)
 *   }
 */
export function emitCttsBox({ entries }) {
    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (!Array.isArray(entries)) {
        throw new Error(
            "emitCttsBox: expected entries array"
        );
    }

    const frozenEntries = entries.map((entry, index) => {

        if (typeof entry !== "object" || entry === null) {
            throw new Error(
                `emitCttsBox: entry[${index}] must be an object`
            );
        }

        const { count, offset } = entry;

        if (!Number.isInteger(count) || count < 0) {
            throw new Error(
                `emitCttsBox: entry[${index}].count must be a non-negative integer`
            );
        }

        if (!Number.isInteger(offset) || offset < 0) {
            throw new Error(
                `emitCttsBox: entry[${index}].offset must be a non-negative integer (version 0 only)`
            );
        }

        return {
            count,
            offset
        };
    });

    // ---------------------------------------------------------
    // Body construction
    // ---------------------------------------------------------
    const body = [];

    // entry_count
    body.push({
        int: frozenEntries.length
    });

    // entries
    for (const entry of frozenEntries) {
        body.push({ int: entry.count });
        body.push({ int: entry.offset });
    }

    // ---------------------------------------------------------
    // Box node
    // ---------------------------------------------------------
    return {
        type: "ctts",
        version: 0,
        flags: 0,
        body
    };
}

