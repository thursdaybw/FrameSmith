/**
 * STSS — Sync Sample Box
 * ---------------------
 * Identifies which samples are sync samples (keyframes).
 *
 * This box answers the question:
 *
 *   “Which samples may be used as random access points?”
 *
 * STSS is a FullBox with:
 *   - version = 0
 *   - flags   = 0
 *
 * Body layout:
 *   entry_count (u32)
 *   sample_number[] (u32[])
 *
 * Notes:
 * - sample numbers are 1-based (per ISO spec)
 * - this builder does NOT compute sync samples
 * - it only serializes provided truth
 */
export function emitStssBox({sampleNumbers}) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (!Array.isArray(sampleNumbers)) {
        throw new Error(
            "emitStssBox: sampleNumbers must be an array"
        );
    }

    for (const n of sampleNumbers) {
        if (typeof n !== "number" || !Number.isInteger(n)) {
            throw new Error(
                "emitStssBox: sample numbers must be integers"
            );
        }

        if (n <= 0) {
            throw new Error(
                "emitStssBox: sample numbers must be positive (1-based)"
            );
        }
    }

    // ---------------------------------------------------------
    // Defensive snapshot
    // ---------------------------------------------------------
    const samples = sampleNumbers.slice();

    // ---------------------------------------------------------
    // Box node
    // ---------------------------------------------------------
    return {
        type: "stss",

        // FullBox header
        version: 0,
        flags: 0,

        body: [
            // entry_count
            { int: samples.length },

            // sample_number[]
            { array: "int", values: samples }
        ]
    };
}
