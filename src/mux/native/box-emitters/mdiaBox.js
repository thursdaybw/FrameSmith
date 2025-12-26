/**
 * MDIA — Media Box
 * =================
 *
 * MDIA defines the *identity* of a media track.
 *
 * It answers three foundational questions:
 *
 *   1. What kind of media is this?        (hdlr)
 *   2. How is time defined for this media? (mdhd)
 *   3. How should samples be interpreted? (minf)
 *
 * MDIA does NOT describe:
 *   - how media is encoded          (stsd)
 *   - where media bytes live        (stco / mdat)
 *   - how chunks are laid out       (NativeMuxer policy)
 *
 * ---
 *
 * Structural role:
 * ----------------
 * MDIA is a pure container box.
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
 * A valid MDIA box MUST contain exactly:
 *
 *   1. mdhd — Media Header Box
 *        - defines the media time scale
 *        - defines duration
 *        - establishes the time domain for this track
 *
 *   2. hdlr — Handler Reference Box
 *        - declares the media type (video, audio, etc.)
 *        - provides the semantic identity of the track
 *
 *   3. minf — Media Information Box
 *        - groups media-type-specific interpretation
 *        - connects data references and sample tables
 *
 * Canonical child order (as emitted by ffmpeg):
 *
 *   mdhd
 *   hdlr
 *   minf
 *
 * This order is stable and observable in real MP4 files.
 *
 * ---
 *
 * Historical context:
 * -------------------
 * MDIA originates from the QuickTime file format.
 *
 * Its purpose was to isolate *media semantics* from:
 *   - storage layout
 *   - editing operations
 *   - multiplexing concerns
 *
 * By placing timing, identity, and interpretation together,
 * QuickTime enabled:
 *   - non-linear editing
 *   - mixed media tracks
 *   - independent media time bases
 *
 * MP4 inherits this design directly.
 *
 * ---
 *
 * Architectural boundaries:
 * -------------------------
 * This builder:
 *   - assembles the MDIA container
 *   - enforces required children
 *   - preserves canonical ordering
 *
 * This builder does NOT:
 *   - infer media type
 *   - compute timing values
 *   - inspect child internals
 *   - perform validation across children
 *
 * All policy decisions are external and injected explicitly.
 *
 * ---
 *
 * Testing strategy:
 * -----------------
 * MDIA is validated in two phases:
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
 * predictable, and easy to reason about.
 *
 * ---
 *
 * References:
 * - ISO/IEC 14496-12 — Media Box (mdia)
 * - MP4RA box registry
 * - mp4box.js reference implementation
 */
export function emitMdiaBox(children) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    //
    // MDIA is a structural container.
    // All required children must be provided explicitly.
    //
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitMdiaBox: expected a parameter object"
        );
    }

    const {
        mdhd,
        hdlr,
        minf
    } = children;

    // ---------------------------------------------------------
    // MDHD validation
    // ---------------------------------------------------------
    //
    // mdhd defines the media time domain.
    //
    if (typeof mdhd !== "object" || mdhd === null) {
        throw new Error(
            "emitMdiaBox: missing or invalid 'mdhd'"
        );
    }

    if (mdhd.type !== "mdhd") {
        throw new Error(
            `emitMdiaBox: expected 'mdhd' box, got '${mdhd.type}'`
        );
    }

    // ---------------------------------------------------------
    // HDLR validation
    // ---------------------------------------------------------
    //
    // hdlr defines the semantic media type.
    //
    if (typeof hdlr !== "object" || hdlr === null) {
        throw new Error(
            "emitMdiaBox: missing or invalid 'hdlr'"
        );
    }

    if (hdlr.type !== "hdlr") {
        throw new Error(
            `emitMdiaBox: expected 'hdlr' box, got '${hdlr.type}'`
        );
    }

    // ---------------------------------------------------------
    // MINF validation
    // ---------------------------------------------------------
    //
    // minf defines how samples are interpreted.
    //
    if (typeof minf !== "object" || minf === null) {
        throw new Error(
            "emitMdiaBox: missing or invalid 'minf'"
        );
    }

    if (minf.type !== "minf") {
        throw new Error(
            `emitMdiaBox: expected 'minf' box, got '${minf.type}'`
        );
    }

    // ---------------------------------------------------------
    // Container assembly
    // ---------------------------------------------------------
    //
    // MDIA has no body.
    // Its meaning is defined entirely by child order.
    //
    return {
        /**
         * Box type
         */
        type: "mdia",

        /**
         * Child boxes in canonical playback order.
         *
         * Order matters:
         *   - mdhd establishes the time domain
         *   - hdlr establishes media identity
         *   - minf establishes interpretation
         */
        children: [
            mdhd,
            hdlr,
            minf
        ]
    };
}
