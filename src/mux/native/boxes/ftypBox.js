/**
 * FTYP — File Type Box
 * -------------------
 * Identifies the *file format family* and declares compatibility.
 *
 * This is the very first box in an MP4 file.
 * Parsers read it before touching anything else.
 *
 * Its purpose is simple:
 *
 *   “What kind of file is this,
 *    and which readers are allowed to process it?”
 *
 * ---
 *
 * What FTYP is NOT:
 * -----------------
 * - It does not describe codecs
 * - It does not describe tracks
 * - It does not affect timing or layout
 *
 * FTYP is about *container compatibility*, not media content.
 *
 * ---
 *
 * How players use FTYP:
 * ---------------------
 * When a parser sees an MP4 file, it:
 *
 *   1. Reads `major_brand`
 *   2. Scans `compatible_brands`
 *
 * If the parser recognizes *any* compatible brand,
 * it is allowed to continue parsing the file.
 *
 * If none match, the parser may reject the file outright.
 *
 * ---
 *
 * Framesmith’s strategy:
 * ----------------------
 * Framesmith emits a conservative, widely-compatible FTYP:
 *
 *   - Matches ffmpeg output
 *   - Matches mp4box.js output
 *   - Plays in all major browsers
 *   - Accepted by legacy MP4 tooling
 *
 * This FTYP declares compatibility with:
 *   - ISO Base Media File Format
 *   - Modern MP4 revisions
 *   - H.264 (AVC) video
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — File Type Box (ftyp)
 * - MP4 Registration Authority (mp4ra.org)
 * - ffmpeg reference output
 */
export function buildFtypBox() {
    return {
        type: "ftyp",

        body: [
            /**
             * major_brand
             * -----------
             * Declares the primary file format brand.
             *
             * "isom" means:
             *   ISO Base Media File Format
             *
             * This tells parsers:
             *   “This file follows the ISO BMFF rules.”
             *
             * Almost all modern MP4 files use "isom" here.
             */
            { type: "isom" },

            /**
             * minor_version
             * -------------
             * Declares the minimum revision of the ISO Base Media File Format
             * this file claims compatibility with.
             *
             * Important clarification:
             * This is NOT a codec version.
             * This is NOT a player feature flag.
             * This is NOT used for decoding decisions.
             *
             * Think of it as:
             *   “I am an `isom` file, and I conform to at least this revision
             *    of the container specification.”
             *
             * ---
             *
             * Why 512 (0x0200)?
             * -----------------
             * Reference encoders (ffmpeg, mp4box.js, Apple tooling) consistently
             * emit a minor_version of 512.
             *
             * This value corresponds to:
             *   ISO Base Media File Format, revision 2
             *
             * It is a conservative, widely compatible baseline that modern
             * tools expect and recognize.
             *
             * ---
             *
             * Why not 0?
             * ----------
             * The MP4 specification allows this field to be 0, and many players
             * will happily ignore it.
             *
             * However:
             *   - ffmpeg does NOT emit 0
             *   - mp4box.js does NOT emit 0
             *   - Golden MP4 files do NOT emit 0
             *
             * Setting this to 0 produces a structurally valid file, but breaks
             * byte-for-byte conformance with real-world reference outputs.
             *
             * ---
             *
             * Framesmith’s choice:
             * --------------------
             * Framesmith emits `512` to:
             *   - Match ffmpeg output exactly
             *   - Match mp4box.js output exactly
             *   - Preserve byte-for-byte conformance guarantees
             *
             * This field does not affect playback behavior, but it *does* affect
             * reproducibility, testing confidence, and ecosystem alignment.
             */
            { int: 512 },

            /**
             * compatible_brands
             * -----------------
             * A list of format identifiers this file claims compatibility with.
             *
             * Parsers may accept the file if *any* listed brand is recognized.
             *
             * Order does not matter.
             * Presence matters.
             */

            /**
             * "isom"
             * The base ISO media format.
             * Included for maximum compatibility.
             */
            { type: "isom" },

            /**
             * "iso2"
             * Indicates support for newer MP4 features
             * introduced after the original ISO spec.
             */
            { type: "iso2" },

            /**
             * "avc1"
             * Signals that the file contains H.264 (AVC) video.
             *
             * Some parsers require this brand
             * before attempting AVC decoding.
             */
            { type: "avc1" },

            /**
             * "mp41"
             * Legacy MP4 brand.
             *
             * Included to satisfy older players and tools
             * that still check for it.
             */
            { type: "mp41" }
        ]
    };
}
