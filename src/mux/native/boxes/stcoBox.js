/**
 * STCO — Chunk Offset Box
 * ----------------------
 * Defines the byte offsets of each chunk within the media data (`mdat`).
 *
 * This box answers the question:
 *
 *   “Given a chunk number,
 *    where does that chunk begin in the file?”
 *
 * The offsets stored here are **absolute byte offsets**
 * from the beginning of the MP4 file.
 *
 * ---
 *
 * What this box does NOT describe:
 * --------------------------------
 * - How many samples are in each chunk        (stsc)
 * - How large each sample is                  (stsz)
 * - How time advances between samples         (stts)
 * - How samples are interleaved or ordered    (assembly logic)
 *
 * STCO is purely *positional*.
 *
 * It does not explain *what* is in a chunk,
 * only *where* that chunk begins.
 *
 * ---
 *
 * Samples, chunks, and offsets:
 * -----------------------------
 * In MP4:
 *
 *   • A *sample* is a single unit of encoded media
 *     (for video: one encoded frame).
 *
 *   • A *chunk* is a contiguous group of samples
 *     stored together in the `mdat` box.
 *
 *   • The STCO table maps:
 *
 *       chunk index → byte offset in file
 *
 * Chunk numbering is 1-based, but offsets are raw byte positions.
 *
 * ---
 *
 * Why STCO depends on final file layout:
 * --------------------------------------
 * Chunk offsets cannot be known until:
 *
 *   - `ftyp` has been written
 *   - `moov` has been fully assembled
 *   - the final size of `moov` is known
 *   - the `mdat` header position is fixed
 *
 * Because of this, STCO offsets are **derived data**.
 *
 * They are not intrinsic properties of samples,
 * but the result of *how the file is assembled*.
 *
 * ---
 *
 * Architectural responsibility split:
 * -----------------------------------
 * This builder intentionally does NOT compute offsets.
 *
 * Responsibilities are split as follows:
 *
 *   • NativeMuxer (assembly layer):
 *       - decides chunking policy
 *       - sizes all boxes
 *       - computes final byte offsets
 *
 *   • STCO builder (this file):
 *       - validates offsets
 *       - serializes them into spec-compliant form
 *
 * This separation keeps the box builder:
 *   - pure
 *   - deterministic
 *   - easy to test in isolation
 *
 * And keeps file-layout logic where it belongs:
 *   in the assembler / finalization phase.
 *
 * ---
 *
 * Two-pass assembly implication:
 * ------------------------------
 * Because STCO depends on final `moov` size,
 * MP4 assembly typically happens in two passes:
 *
 *   1. Build a temporary `moov` with placeholder STCO
 *   2. Compute real chunk offsets
 *   3. Rebuild `moov` with correct STCO
 *
 * This is normal, expected, and required by the format.
 *
 * ---
 *
 * Defensive handling of inputs:
 * -----------------------------
 * The input offsets array is copied immediately.
 *
 * This ensures:
 *   - later mutations by the caller do not affect this box
 *   - serialized MP4 structure is immutable once built
 *   - tests remain deterministic
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — Chunk Offset Box (stco)
 * - MP4 registry: https://mp4ra.org/registered-types/boxes
 * - mp4box.js reference implementation
 */
export function buildStcoBox(chunkOffsets) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    //
    // STCO is a serialization-only box.
    // It does not compute offsets, it only encodes them.
    //
    // Therefore we enforce that the caller provides:
    //   - a concrete array
    //   - containing only valid byte offsets
    //
    if (!Array.isArray(chunkOffsets)) {
        throw new Error(
            "buildStcoBox: chunkOffsets must be an array"
        );
    }

    for (const off of chunkOffsets) {
        if (typeof off !== "number" || off < 0) {
            throw new Error(
                "buildStcoBox: all offsets must be non-negative numbers"
            );
        }
    }

    // ---------------------------------------------------------
    // Defensive snapshot
    // ---------------------------------------------------------
    //
    // Offsets are derived values computed during final assembly.
    // We take an immediate copy to ensure:
    //
    //   - later mutations by the caller do not affect this box
    //   - the serialized MP4 structure remains immutable
    //   - tests remain deterministic
    //
    const offsets = chunkOffsets.slice();

    // ---------------------------------------------------------
    // STCO serialization
    // ---------------------------------------------------------
    return {
        /**
         * Box type
         * --------
         * Identifies this box as a Chunk Offset Box.
         */
        type: "stco",

        /**
         * FullBox version
         * ----------------
         * The spec defines only version 0 for STCO.
         */
        version: 0,

        /**
         * FullBox flags
         * -------------
         * The spec does not define any flags for STCO.
         */
        flags: 0,

        body: [
            /**
             * entry_count
             * -----------
             * Number of chunk offsets that follow.
             *
             * Each entry corresponds to one chunk in the track,
             * in ascending chunk order.
             *
             * This value MUST match the number of chunks implied
             * by the STSC table.
             */
            { int: offsets.length },

            /**
             * chunk_offset[]
             * --------------
             * Absolute byte offsets to the start of each chunk,
             * measured from the beginning of the MP4 file.
             *
             * Offsets are 32-bit unsigned integers.
             *
             * The i-th entry corresponds to chunk (i + 1).
             */
            { array: "int", values: offsets }
        ]
    };
}
