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
 *   7. stco/co64 — Chunk Offsets
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
 */
function emitStblBox(children) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitStblBox: expected parameter object"
        );
    }

    const required = ["stsd", "stts", "stsc", "stsz"];

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

        if (node.type !== name) {
            throw new Error(
                `emitStblBox: '${name}' box has incorrect type '${node.type}'`
            );
        }
    }

    const hasStco = "stco" in children;
    const hasCo64 = "co64" in children;
    if (!hasStco && !hasCo64) {
        throw new Error("emitStblBox: missing required child 'stco' or 'co64'");
    }
    if (hasStco && hasCo64) {
        throw new Error("emitStblBox: provide only one chunk-offset child ('stco' or 'co64')");
    }

    // Optional children validation
    for (const optional of ["stss", "ctts", "sgpd", "sbgp", "co64"]) {
        if (optional in children) {
            const node = children[optional];

            if (typeof node !== "object" || node === null) {
                throw new Error(
                    `emitStblBox: '${optional}' must be a box node`
                );
            }

            if (node.type !== optional) {
                throw new Error(
                    `emitStblBox: '${optional}' box has incorrect type '${node.type}'`
                );
            }
        }
    }


    // ---------------------------------------------------------
    // Canonical child ordering (ffmpeg-observed)
    // ---------------------------------------------------------
    const orderedChildren = [];

    orderedChildren.push(children.stsd);
    orderedChildren.push(children.stts);

    // Video timing tables
    if (children.stss) {
        orderedChildren.push(children.stss);
    }

    if (children.ctts) {
        orderedChildren.push(children.ctts);
    }

    // Core sample tables
    orderedChildren.push(children.stsc);
    orderedChildren.push(children.stsz);
    orderedChildren.push(hasStco ? children.stco : children.co64);

    // Sample grouping tables (audio)
    if (children.sgpd) {
        orderedChildren.push(children.sgpd);
    }

    if (children.sbgp) {
        orderedChildren.push(children.sbgp);
    }

    return {
        type: "stbl",
        children: orderedChildren
    };
}

export function registerStblEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl",
        emitStblBox
    );
}
