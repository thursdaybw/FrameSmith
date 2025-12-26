import { writeUint32, writeString } from "../binary/Writer.js";
/**
 * DREF — Data Reference Box
 * ------------------------
 * Declares where the media data for a track is stored.
 *
 * This box does NOT contain media data.
 * It contains references that explain *how to locate* that data.
 *
 * In practice, there are two broad models:
 *
 *   1. External data
 *      Media samples live in a separate file or resource.
 *
 *   2. Self-contained data
 *      Media samples live inside this same MP4 file.
 *
 * ---
 *
 * Framesmith’s design choice:
 * ---------------------------
 * Framesmith always emits the canonical modern form:
 *
 *   - A single `url ` entry
 *   - Marked as self-contained (flags = 1)
 *
 * Meaning:
 *   “All media data for this track lives inside this MP4 file.”
 *
 * This matches:
 *   - ffmpeg output
 *   - mp4box.js output
 *   - browser expectations
 *   - real-world player behavior
 *
 * External data references are a legacy feature and are not
 * required for modern MP4 generation.
 *
 * ---
 *
 * Why this box still exists:
 * --------------------------
 * Early media formats allowed tracks to reference:
 *   - network streams
 *   - sidecar data files
 *   - shared media repositories
 *
 * MP4 retained this mechanism for compatibility.
 *
 * Modern encoders almost universally emit a self-contained `url `
 * reference, even when no URL string is present.
 *
 * The presence of this box is mandatory.
 * The complexity inside it is mostly historical.
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — Data Reference Box (dref)
 * - MP4 registry: https://mp4ra.org/registered-types/boxes
 * - ffmpeg, mp4box.js reference output
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

