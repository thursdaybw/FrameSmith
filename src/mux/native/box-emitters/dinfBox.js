/**
 * DINF — Data Information Box
 * ==========================
 *
 * DINF defines *where media data is stored*.
 *
 * It does not describe:
 *   - how media is encoded
 *   - how samples are timed
 *   - how samples are chunked
 *
 * It answers only one question:
 *
 *   “Where should the decoder look for the media bytes?”
 *
 * ---
 *
 * Structural role:
 * ----------------
 * DINF is a pure container box.
 *
 * It has:
 *   - no version
 *   - no flags
 *   - no fields of its own
 *
 * Its sole purpose is to group data reference information
 * via child boxes.
 *
 * In practice, this means it contains:
 *
 *   dref — Data Reference Box
 *
 * ---
 *
 * Historical context:
 * -------------------
 * The MP4 format evolved from QuickTime, which supported:
 *   - external media files
 *   - network-based media references
 *   - editing workflows with shared assets
 *
 * DINF exists to support those use cases.
 *
 * Even though modern MP4 files almost always store media
 * locally inside `mdat`, the indirection remains part of
 * the format for compatibility and extensibility.
 *
 * ---
 *
 * Common modern case:
 * -------------------
 * Most MP4 files contain:
 *
 *   dinf
 *     └─ dref
 *         └─ url (self-contained)
 *
 * This indicates that all media data is stored within
 * the same file.
 *
 * ---
 *
 * Architectural boundaries:
 * -------------------------
 * This builder:
 *   - enforces container structure
 *   - wires required child boxes
 *   - performs no interpretation
 *
 * This builder does NOT:
 *   - decide where data lives
 *   - create implicit references
 *   - assume `mdat` layout
 *
 * Those responsibilities belong to higher-level
 * muxing and assembly logic.
 *
 * ---
 *
 * References:
 * - ISO/IEC 14496-12 — Data Information Box (dinf)
 * - MP4RA box registry
 * - mp4box.js reference implementation
 */
export function emitDinfBox(children) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    //
    // DINF is a structural container.
    // It requires a Data Reference Box (`dref`) as its child.
    //
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitDinfBox: expected a parameter object"
        );
    }

    if (!("dref" in children)) {
        throw new Error(
            "emitDinfBox: missing required child 'dref'"
        );
    }

    const dref = children.dref;

    if (typeof dref !== "object" || dref === null) {
        throw new Error(
            "emitDinfBox: 'dref' must be a box node"
        );
    }

    if (dref.type !== "dref") {
        throw new Error(
            `emitDinfBox: child box has incorrect type '${dref.type}', expected 'dref'`
        );
    }

    // ---------------------------------------------------------
    // Container assembly
    // ---------------------------------------------------------
    //
    // DINF has no body.
    // Its meaning is defined entirely by its child.
    //
    return {
        /**
         * Box type
         */
        type: "dinf",

        /**
         * Child boxes
         */
        children: [
            dref
        ]
    };
}
