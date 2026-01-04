/**
 * STTS — Decoding Time To Sample Box
 * ---------------------------------
 *
 * This box defines how long each media sample lasts in *decoding time*.
 *
 * Conceptually, STTS is a run-length encoded table:
 *
 *   “For the next N samples, each sample lasts D time units.”
 *
 * Players walk this table to compute decoding timestamps.
 *
 * What STTS does NOT do:
 * ----------------------
 * - It does NOT define presentation order (see CTTS).
 * - It does NOT care about frame reordering or B-frames.
 * - It does NOT encode timestamps directly.
 *
 * NativeMuxer semantics:
 * ----------------------
 *
 * NativeMuxer derives STTS entries directly from semantic sample durations.
 *
 * This means:
 * - Constant-duration input produces a single STTS entry
 * - Variable-duration input produces multiple STTS entries
 *
 * No averaging, quantization, or policy is applied here.
 *
 * This emitter is a *pure serializer*.
 * It assumes all grouping and validation has already occurred upstream.
 *
 * Structure (version 0):
 * ---------------------
 *
 *   entry_count (uint32)
 *   for each entry:
 *     sample_count (uint32)
 *     sample_delta (uint32)
 *
 * This is a FullBox:
 * - version = 0
 * - flags   = 0
 *
 * @param {Object} params
 * @param {Array<{ sampleCount: number, sampleDelta: number }>} params.entries
 *   Run-length encoded decoding-time entries.
 *
 *   Each entry means:
 *     “For the next sampleCount samples,
 *      each sample has duration sampleDelta
 *      expressed in media timescale units.”
 */
export function emitSttsBox({ entries }) {

    // ---------------------------------------------------------------------
    // Defensive validation — Category B (shape + sanity only)
    // ---------------------------------------------------------------------
    //
    // Semantic correctness (grouping, totals, ordering) is enforced upstream.
    // The emitter validates only that it can serialize safely.
    //

    if (!Array.isArray(entries)) {
        throw new Error(
            "emitSttsBox: expected parameter object { entries }"
        );
    }

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (!Number.isInteger(entry.sampleCount) || entry.sampleCount < 0) {
            throw new Error(
                "emitSttsBox: sampleCount must be a non-negative integer"
            );
        }

        if (!Number.isInteger(entry.sampleDelta) || entry.sampleDelta < 0) {
            throw new Error(
                "emitSttsBox: sampleDelta must be a non-negative integer"
            );
        }
    }

    // ---------------------------------------------------------------------
    // STTS box body construction
    // ---------------------------------------------------------------------
    //
    // We build the body explicitly, in order, to make the
    // run-length encoding structure obvious and auditable.
    //

    const body = [];

    /**
     * entry_count (uint32)
     * --------------------
     * Number of (sample_count, sample_delta) entries.
     *
     * Constant-duration streams produce:
     *   entry_count = 1
     *
     * Variable-duration streams produce:
     *   entry_count > 1
     */
    body.push({ int: entries.length });

    /**
     * entries (sample_count, sample_delta) pairs
     * -------------------------------------------
     *
     * Each pair describes a run of samples with
     * identical decoding duration.
     *
     * The sum of all sample_count values MUST equal
     * the total number of samples in the track.
     *
     * This invariant is guaranteed by the adapter.
     */
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        /**
         * sample_count (uint32)
         * ---------------------
         * Number of consecutive samples sharing
         * the same decoding duration.
         */
        body.push({
            int: entry.sampleCount
        });

        /**
         * sample_delta (uint32)
         * ---------------------
         * Decoding duration of each sample in this run,
         * expressed in media timescale units.
         */
        body.push({
            int: entry.sampleDelta
        });
    }

    // ---------------------------------------------------------------------
    // STTS box node
    // ---------------------------------------------------------------------

    return {
        type: "stts",
        version: 0,
        flags: 0,
        body
    };
}
