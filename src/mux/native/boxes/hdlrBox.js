/**
 * HDLR — Handler Reference Box
 * ---------------------------
 * Declares the *type of media* handled by a track.
 *
 * For video tracks:
 *   handler_type = "vide"
 *
 * The optional `name` field is a human-readable label only.
 * It has no semantic meaning for decoding, playback, or muxing.
 * Players and decoders ignore it entirely.
 *
 * Framesmith emits a canonical handler name to match reference
 * encoders and enable byte-for-byte conformance testing.
 *
 * External references:
 * - ISO/IEC 14496-12 — Handler Reference Box
 * - mp4ra.org registered boxes
 * - ffmpeg, mp4box.js reference output
 */
export function buildHdlrBox() {

    // Canonical handler name used by ffmpeg/mp4box.js.
    // Informational only, but required for byte-for-byte
    // conformance with golden MP4 files.
    const name = "VideoHandler";

    return {
        // FullBox header (see FullBox.md)
        // - the MP4 specification defines only version 0 for hdlr
        // - the specification defines no flags for this box
        type: "hdlr",
        version: 0,
        flags: 0,

        body: [
            /**
             * This field exists for historical reasons. Older QuickTime formats used it.
             * ISO MP4 explicitly requires it to be zero.
             * Modern meaning:
             *   None. 
             */
            { int: 0 },

            /**
             * This is the only semantically meaningful field in the entire box.
             * 
             * It declares what subsystem owns this track.
             * - vide → video pipeline
             * - soun → audio pipeline
             * - meta → metadata pipeline
             * 
             * Players use this to decide:
             * - Which decoder graph to build
             * - Which timing model applies
             * - Which boxes are expected downstream
             * 
             * This is a discriminator, not metadata.
             * If this is wrong, nothing else matters.
             */
            { type: "vide" },     // handler_type

            /**
             * These fields exist to keep the binary layout compatible with older formats.
             * 
             * They are not optional.
             * They are not future-proofing.
             * They are not extension points.
             * 
             * They are padding.
             * 
             * Architectural rule
             * Reserved fields are not data.
             * They are constraints.
             * 
             * Hardcode them, comment once, move on.
             */
            { int: 0 },           // reserved 1
            { int: 0 },           // reserved 2
            { int: 0 },           // reserved 3
            /**
             * This is purely informational.
             * 
             * It exists so:
             *  - debugging tools can display something friendly
             *  - humans inspecting the file aren’t staring at emptiness
             * 
             * Decoders:
             * - do not read it
             * - do not validate it
             * - do not care about it
             * 
             * Why it matters
             * Reference encoders (ffmpeg, mp4box.js, Apple tools) emit it.
             * 
             * If it is omitted it changed:
             * the file still plays
             * 
             * but byte-for-byte conformance breaks
             * 
             * That’s why it exists here.
             */
            { bytes: new TextEncoder().encode(name + "\0") }
        ]
    };
}
