/**
 * MINF — Media Information Box
 * ===========================
 *
 * MINF describes *how media samples should be interpreted*.
 *
 * It does NOT describe:
 *   - how media is encoded          (stsd)
 *   - how time advances             (stts / ctts)
 *   - where samples are stored      (stco)
 *
 * Instead, MINF groups three orthogonal concerns:
 *
 *   1. Media-type–specific interpretation
 *   2. Data location information
 *   3. Sample indexing and lookup tables
 *
 * ---
 *
 * Structural role:
 * ----------------
 * MINF is a pure container box.
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
 * A valid MINF box MUST contain exactly:
 *
 *   1. One media header box (exactly one):
 *        - vmhd  Video Media Header
 *        - smhd  Sound Media Header
 *        - hmhd  Hint Media Header
 *        - nmhd  Null Media Header
 *        - sthd  Subtitle Media Header (rare)
 *
 *   2. One DINF — Data Information Box
 *        - describes where media bytes are stored
 *
 *   3. One STBL — Sample Table Box
 *        - describes how to locate and play samples
 *
 * Canonical child order (as emitted by ffmpeg):
 *
 *   <media header>
 *   dinf
 *   stbl
 *
 * ---
 *
 * Historical context:
 * -------------------
 * MINF originates from the QuickTime file format.
 *
 * Its purpose was to support multiple media types
 * (video, audio, subtitles, hints) within a unified
 * container model.
 *
 * Rather than duplicating logic for each media type,
 * the format separates:
 *
 *   - media interpretation (MINF)
 *   - media timing (STBL)
 *   - media storage (MDAT)
 *
 * This separation enables:
 *   - random access
 *   - editing workflows
 *   - mixed media tracks
 *
 * ---
 *
 * Architectural boundaries:
 * -------------------------
 * This builder:
 *   - assembles a MINF container
 *   - enforces required children
 *   - preserves canonical ordering
 *
 * This builder does NOT:
 *   - infer media type
 *   - create default headers
 *   - inspect child internals
 *   - compute derived data
 *
 * Media-type selection is an *external policy decision*,
 * injected explicitly by the caller.
 *
 * ---
 *
 * Testing strategy:
 * -----------------
 * MINF is validated in two phases:
 *
 *   Phase A — Structural correctness
 *     - required children present
 *     - correct ordering
 *
 *   Phase C — Locked-layout equivalence
 *     - byte-for-byte equivalence with ffmpeg
 *       when children are injected verbatim
 *
 * This keeps the builder pure, deterministic,
 * and easy to reason about.
 *
 * ---
 *
 * References:
 * - ISO/IEC 14496-12 — Media Information Box (minf)
 * - MP4RA box registry
 * - mp4box.js reference implementation
 */
export function emitMinfBox(children) {

    if (typeof children !== "object" || children === null) {
        throw new Error("emitMinfBox: expected a parameter object");
    }

    const { vmhd, dinf, stbl } = children;

    // ---------------------------------------------------------
    // VMHD validation (video-only for now)
    // ---------------------------------------------------------
    if (typeof vmhd !== "object" || vmhd === null) {
        throw new Error("emitMinfBox: missing or invalid 'vmhd'");
    }

    if (vmhd.type !== "vmhd") {
        throw new Error(
            `emitMinfBox: expected 'vmhd' media header, got '${vmhd.type}'`
        );
    }

    // ---------------------------------------------------------
    // DINF validation
    // ---------------------------------------------------------
    if (typeof dinf !== "object" || dinf === null) {
        throw new Error("emitMinfBox: missing or invalid 'dinf'");
    }

    if (dinf.type !== "dinf") {
        throw new Error(
            `emitMinfBox: expected 'dinf' box, got '${dinf.type}'`
        );
    }

    // ---------------------------------------------------------
    // STBL validation
    // ---------------------------------------------------------
    if (typeof stbl !== "object" || stbl === null) {
        throw new Error("emitMinfBox: missing or invalid 'stbl'");
    }

    if (stbl.type !== "stbl") {
        throw new Error(
            `emitMinfBox: expected 'stbl' box, got '${stbl.type}'`
        );
    }

    // ---------------------------------------------------------
    // Container assembly
    // ---------------------------------------------------------
    return {
        type: "minf",
        children: [
            vmhd,
            dinf,
            stbl
        ]
    };
}
