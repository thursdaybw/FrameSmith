import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * DREF — Data Reference Box
 * ========================
 *
 * DREF declares *where the media bytes for a track are stored*.
 *
 * Unlike many legacy MP4 boxes, DREF still expresses a real,
 * meaningful decision that decoders actively rely on.
 *
 * It answers exactly one question:
 *
 *   “Should the decoder look for media data inside this file,
 *    or somewhere else?”
 *
 * ---
 *
 * Framesmith design decision:
 * ---------------------------
 *
 * Framesmith **intentionally supports exactly one data model**:
 *
 *   - Self-contained media
 *   - All samples stored inside this MP4 file
 *   - No external references
 *
 * This is expressed as:
 *
 *   dref
 *     └─ url  (version 0, flags = 1, no payload)
 *
 * This matches:
 *   - ffmpeg output
 *   - mp4box.js output
 *   - browser playback expectations
 *   - the vast majority of real-world MP4 files
 *
 * ---
 *
 * Important distinction from VMHD:
 * --------------------------------
 *
 * VMHD exists for historical reasons and has no semantic impact
 * on modern playback pipelines.
 *
 * DREF is different.
 *
 * DREF *does* encode a meaningful policy decision:
 *   - local vs external media
 *   - single-file vs multi-resource assets
 *
 * Framesmith does NOT ignore this decision.
 * Framesmith **chooses one policy and freezes it**.
 *
 * ---
 *
 * Why this box is compiler-owned:
 * -------------------------------
 *
 * Framesmith is a self-contained MP4 compiler.
 *
 * Allowing external media references would:
 *   - complicate assembly
 *   - complicate portability
 *   - complicate browser playback
 *   - violate Framesmith’s design goals
 *
 * Therefore:
 *   - This builder takes no parameters
 *   - Fixtures do NOT carry DREF semantics
 *   - Golden oracles with external references are rejected
 *
 * This is a conscious architectural constraint,
 * not an implementation shortcut.
 *
 * ---
 *
 * Conformance and testing:
 * ------------------------
 *
 * If a future golden MP4 uses a different DREF layout:
 *   - Byte-for-byte conformance tests will fail
 *   - The failure is expected
 *   - The resolution is a design decision, not a bug fix
 *
 * Supporting additional DREF forms would require:
 *   - explicit API changes
 *   - explicit fixture shape changes
 *   - explicit architectural approval
 *
 * ---
 *
 * References:
 * - ISO/IEC 14496-12 — Data Reference Box (dref)
 * - MP4RA box registry
 * - ffmpeg / mp4box.js reference output
 */
export function emitDrefBox() {

    /**
     * `url ` — Data Entry URL Box
     * ---------------------------
     * Declares how media data is accessed.
     *
     * When `flags = 1`:
     *   - The media data is self-contained
     *   - No URL string is present
     *   - No external resource is required
     *
     * This is the canonical modern form.
     *
     * Important:
     * - The trailing space in "url " is part of the FourCC.
     * - This box intentionally has no body fields.
     */
    const urlBox = {
        // FullBox header (see FullBox.md)
        // - the MP4 specification defines only version 0 for dref 
        // - flag bit 0x000001 marks the entry as self-contained
        type: "url ",
        version: 0,
        flags: 1,

        body: [
            // No payload.
            // A self-contained url entry must not include a URL string.
        ]
    };

    return {
        // FullBox header (see FullBox.md)
        // - dref defines only version 0
        // - the specification defines no flags for this box
        type: "dref",
        version: 0,
        flags: 0,

        body: [
            /**
             * entry_count
             * -----------
             * The number of data reference entries that follow.
             *
             * Framesmith always emits exactly one entry:
             *   - a single self-contained `url ` box
             *
             * Multiple entries are allowed by the spec but are not
             * required for self-contained MP4 files.
             */
            { int: 1 }
        ],

        /**
         * Child boxes
         * -----------
         * Each child is a data reference entry.
         *
         * In Framesmith:
         *   - Exactly one entry
         *   - Always a self-contained `url ` box
         */
        children: [
            urlBox
        ]
    };
}

