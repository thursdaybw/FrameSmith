/**
 * STBL — Sample Table Box
 * ======================
 *
 * STBL is the *index* that makes media data playable.
 *
 * It does not contain media bytes.
 * It does not describe encoding details.
 * It does not define policy.
 *
 * Instead, STBL answers one essential question:
 *
 *   “Given time, which bytes should be read, and how?”
 *
 * ---
 *
 * Conceptual role:
 * ----------------
 * In MP4, media data lives inside the `mdat` box as a raw byte stream.
 * On its own, `mdat` is meaningless.
 *
 * STBL is the structure that gives those bytes meaning.
 *
 * It defines:
 *   - how samples are described
 *   - how samples advance in time
 *   - how samples are grouped into chunks
 *   - how large each sample is
 *   - where chunks are located in the file
 *
 * Without STBL, playback is impossible.
 *
 * ---
 *
 * Historical context:
 * -------------------
 * The Sample Table design originates from QuickTime.
 *
 * It was created for:
 *   - random access
 *   - non-linear editing
 *   - efficient seeking on slow storage
 *
 * This explains why MP4 uses *tables of indirection*
 * instead of a simple linear stream.
 *
 * STBL is deliberately verbose and explicit.
 * That verbosity is a feature, not a flaw.
 *
 * ---
 *
 * What STBL contains:
 * -------------------
 * STBL is a *pure container*.
 *
 * It has:
 *   - no version
 *   - no flags
 *   - no fields of its own
 *
 * It exists only to group and order child boxes.
 *
 * Canonical child order (as emitted by ffmpeg):
 *
 *   1. stsd — Sample Descriptions
 *   2. stts — Decoding Time to Sample
 *   3. stss — Sync Samples (keyframes)
 *   4. ctts — Composition Time Offsets
 *   5. stsc — Sample-to-Chunk mapping
 *   6. stsz — Sample Sizes
 *   7. stco — Chunk Offsets
 *
 * This order is not arbitrary.
 * Many decoders assume it.
 *
 * ---
 *
 * Architectural boundaries:
 * -------------------------
 * This builder:
 *   - assembles child box nodes
 *   - enforces required presence and order
 *   - performs no serialization
 *   - computes no derived data
 *
 * This builder does NOT:
 *   - compute chunk offsets
 *   - decide chunking policy
 *   - interpret sample data
 *   - depend on file layout
 *
 * Those responsibilities belong to the NativeMuxer
 * and final assembly phase.
 *
 * ---
 *
 * Testing strategy:
 * -----------------
 * STBL is validated in three layers:
 *
 *   Phase A: Structural correctness
 *     - required children present
 *     - correct ordering
 *
 *   Phase B: Semantic equivalence
 *     - children interpreted identically to reference MP4s
 *
 *   Phase C: Locked-layout equivalence
 *     - byte-for-byte match against ffmpeg
 *       when all layout decisions are injected
 *
 * This separation keeps tests honest and localized.
 */
export function emitStblBox(children) {
    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    //
    // STBL is a structural container.
    // All required child boxes must already exist.
    //
    // This builder does NOT:
    //   - create defaults
    //   - invent missing boxes
    //   - reorder dynamically
    //
    // If a required child is missing, that is a calling error.
    //
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitStblBox: expected a parameter object"
        );
    }

    /**
     * Required STBL children.
     *
     * These boxes collectively define:
     *   - sample identity
     *   - timing
     *   - chunking
     *   - storage location
     *
     * Removing any of them makes playback undefined.
     */
    const required = [
        "stsd",
        "stts",
        "stsc",
        "stsz",
        "stco"
    ];

    for (const name of required) {
        if (!(name in children)) {
            throw new Error(
                `emitStblBox: missing required child '${name}'`
            );
        }

        const node = children[name];

        if (typeof node !== "object" || node === null) {
            throw new Error(
                `emitStblBox: '${name}' must be a box node`
            );
        }

        /**
         * Defensive check:
         * The child node must declare the correct box type.
         *
         * This prevents accidental cross-wiring during refactors
         * (e.g. passing an stts node where stsz was expected).
         */
        if (node.type !== name) {
            throw new Error(
                `emitStblBox: '${name}' box has incorrect type '${node.type}'`
            );
        }
    }

    const optional = ["stss", "ctts"];

    for (const name of optional) {
        if (name in children) {
            const node = children[name];

            if (typeof node !== "object" || node === null) {
                throw new Error(
                    `emitStblBox: '${name}' must be a box node if provided`
                );
            }

            if (node.type !== name) {
                throw new Error(
                    `emitStblBox: '${name}' box has incorrect type '${node.type}'`
                );
            }
        }
    }

    const ordered = [
        children.stsd,
        children.stts
    ];

    if (children.stss) ordered.push(children.stss);
    if (children.ctts) ordered.push(children.ctts);

    ordered.push(
        children.stsc,
        children.stsz,
        children.stco
    );

    // ---------------------------------------------------------
    // Container assembly
    // ---------------------------------------------------------
    //
    // STBL has no body of its own.
    // Its meaning is entirely defined by child order.
    //
    return {
        /**
         * Box type
         */
        type: "stbl",

        /**
         * Child boxes in canonical playback order.
         *
         * This order matches ffmpeg output and common decoder expectations.
         */
        children: ordered

    };

}
