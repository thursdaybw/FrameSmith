/**
 * TRAK — Track Box
 * =================
 *
 * TRAK represents a *single track* within a movie.
 *
 * A movie (`moov`) may contain multiple tracks, each wrapped
 * in its own TRAK box. Each TRAK defines:
 *
 *   - the track’s identity and lifetime
 *   - the media carried by the track
 *
 * TRAK does NOT describe:
 *   - how samples are encoded
 *   - how samples are timed
 *   - how samples are stored
 *
 * Those responsibilities belong to child boxes.
 *
 * ---
 *
 * Structural role:
 * ----------------
 * TRAK is a pure container box.
 *
 * It has:
 *   - no version
 *   - no flags
 *   - no fields of its own
 *
 * Its meaning is entirely defined by its children.
 *
 * ---
 *
 * Required children:
 * ------------------
 * A valid TRAK box MUST contain exactly:
 *
 *   1. tkhd — Track Header Box
 *        - defines track ID
 *        - defines track duration
 *        - defines track enablement flags
 *        - establishes the track’s existence in the movie
 *
 *   2. mdia — Media Box
 *        - defines the media type (via hdlr)
 *        - defines the media time domain (via mdhd)
 *        - defines how samples are interpreted (via minf)
 *
 * Canonical child order (as emitted by ffmpeg):
 *
 *   tkhd
 *   mdia
 *
 * This order is stable and relied upon by tooling.
 *
 * ---
 *
 * Optional children (not handled here):
 * ------------------------------------
 * The MP4 format allows additional optional children,
 * including:
 *
 *   - edts (Edit Box)
 *   - tref (Track Reference Box)
 *   - udta (User Data Box)
 *
 * These boxes introduce editing semantics, track
 * relationships, or metadata.
 *
 * They are intentionally excluded from this builder
 * to keep responsibilities narrow and explicit.
 *
 * ---
 *
 * Historical context:
 * -------------------
 * TRAK originates from the QuickTime file format.
 *
 * The design goal was to allow:
 *   - multiple independent timelines
 *   - multiple media types per movie
 *   - editing operations without touching media data
 *
 * By isolating each track inside a TRAK box,
 * QuickTime (and later MP4) enabled non-linear
 * editing and flexible multiplexing.
 *
 * ---
 *
 * Architectural boundaries:
 * -------------------------
 * This builder:
 *   - assembles the TRAK container
 *   - enforces required children
 *   - preserves canonical ordering
 *
 * This builder does NOT:
 *   - infer track type
 *   - interpret track flags
 *   - inspect child internals
 *   - perform cross-box validation
 *
 * All policy decisions are external and injected
 * explicitly by the caller.
 *
 * ---
 *
 * Testing strategy:
 * -----------------
 * TRAK is validated in two phases:
 *
 *   Phase A — Structural correctness
 *     - required children present
 *     - correct ordering
 *
 *   Phase C — Locked-layout equivalence
 *     - byte-for-byte equivalence with ffmpeg
 *       when children are injected verbatim
 *
 * This keeps the builder deterministic,
 * predictable, and refactor-safe.
 *
 * ---
 *
 * References:
 * - ISO/IEC 14496-12 — Track Box (trak)
 * - MP4RA box registry
 * - mp4box.js reference implementation
 */
export function emitTrakBox(children) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitTrakBox: expected a parameter object"
        );
    }

    const required = ["tkhd", "mdia"];

    for (const name of required) {
        if (!(name in children)) {
            throw new Error(
                `emitTrakBox: missing required child '${name}'`
            );
        }

        const node = children[name];

        if (typeof node !== "object" || node === null) {
            throw new Error(
                `emitTrakBox: '${name}' must be a box node`
            );
        }

        if (node.type !== name) {
            throw new Error(
                `emitTrakBox: '${name}' box has incorrect type '${node.type}'`
            );
        }
    }

    // ---------------------------------------------------------
    // Preserve child order as provided
    // ---------------------------------------------------------
    //
    // TRAK is an open container.
    // The caller (test or assembler) controls ordering.
    //
    const orderedChildren = [];

    if (children.tkhd) orderedChildren.push(children.tkhd);
    if (children.edts) orderedChildren.push(children.edts);
    if (children.mdia) orderedChildren.push(children.mdia);

    return {
        type: "trak",
        children: orderedChildren
    };
}
